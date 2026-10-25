import type { FastifyInstance } from 'fastify';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { db, transaction } from '@citadel/db';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID, createHmac } from 'node:crypto';
import { resolve } from 'node:path';
import { z } from 'zod';
import { config, projectRoot } from './config.js';
import { s3Client, storeObject, readObject } from './storage.js';
import { cachedPdf, itineraryRows, receiptRows } from './pdf-cache.js';
import { authenticate } from './auth.js';
import { audit, fail, sha, secureEqual, ownedBooking } from './core.js';
import { date } from '@citadel/i18n';
const localFilesRoot = process.env.LOCAL_FILES_DIR || resolve(projectRoot, '.data/files');
export const s3 = s3Client;
function mimeOf(b: Buffer) {
  if (b.subarray(0, 5).toString() === '%PDF-') return 'application/pdf';
  if (b[0] === 255 && b[1] === 216 && b[2] === 255) return 'image/jpeg';
  if (b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP')
    return 'image/webp';
  if (
    b.subarray(4, 8).toString() === 'ftyp' &&
    ['isom', 'iso2', 'avc1', 'mp41', 'mp42', 'M4V '].includes(b.subarray(8, 12).toString())
  )
    return 'video/mp4';
  if (b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return 'video/webm';
  return null;
}
export async function filesRoutes(app: FastifyInstance) {
  app.post('/api/admin/documents/upload', async (req) => {
    const u = await authenticate(req, true);
    const data = await req.file();
    if (!data) fail('missing_file', 'Choose a document.');
    const bytes = await data.toBuffer();
    const rawFields = Object.fromEntries(
      Object.entries(data.fields)
        .filter(([k]) => k !== 'file')
        .map(([k, v]) => [k, (v as any).value]),
    );
    const optionalId = z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.uuid().optional(),
    );
    const fields = z
      .object({
        batch_id: optionalId,
        booking_id: optionalId,
        traveler_id: optionalId,
        type: z.enum([
          'flight_ticket',
          'hotel_voucher',
          'event_ticket',
          'transfer_voucher',
          'insurance',
          'itinerary',
          'payment_proof',
          'other',
        ]),
        title: z.string().max(250).optional(),
      })
      .strict()
      .parse(rawFields);
    const mime = mimeOf(bytes);
    if (
      !mime ||
      !['application/pdf', 'image/jpeg', 'image/png'].includes(mime) ||
      bytes.length > 20971520 ||
      bytes.includes(Buffer.from('<script'))
    )
      fail('invalid_file', 'Use a PDF, JPG or PNG no larger than 20 MB.');
    const types = [
      'flight_ticket',
      'hotel_voucher',
      'event_ticket',
      'transfer_voucher',
      'insurance',
      'itinerary',
      'payment_proof',
      'other',
    ];
    if (!types.includes(fields.type)) fail('invalid_type', 'Choose a document type.');
    if (!fields.booking_id && !fields.batch_id && fields.type !== 'payment_proof')
      fail('missing_owner', 'Assign the document to a booking or batch.');
    if (fields.booking_id) {
      const [b] = await db.query('SELECT * FROM bookings WHERE id=$1', [fields.booking_id]);
      if (!b || (fields.batch_id && b.batch_id !== fields.batch_id))
        fail('invalid_owner', 'Booking does not belong to the selected batch.');
      if (!fields.batch_id && b.batch_id) fields.batch_id = b.batch_id;
      if (
        fields.traveler_id &&
        !(
          await db.query(
            'SELECT id FROM booking_travelers WHERE booking_id=$1 AND traveler_id=$2 AND removed_at IS NULL',
            [b.id, fields.traveler_id],
          )
        ).length
      )
        fail('invalid_traveler', 'Traveler does not belong to this booking.');
    } else if (fields.traveler_id) fail('missing_booking', 'Traveler documents require a booking.');
    const key = `docs/${fields.booking_id || fields.batch_id || 'proofs'}/${randomUUID()}.${mime === 'application/pdf' ? 'pdf' : mime === 'image/jpeg' ? 'jpg' : 'png'}`;
    const bucket = 'local';
    await mkdir(resolve(localFilesRoot, key, '..'), { recursive: true });
    await writeFile(resolve(localFilesRoot, key), bytes, { mode: 0o600 });
    return transaction(async (tx) => {
      const [doc] = await tx.query(
        'INSERT INTO documents(batch_id,booking_id,traveler_id,type,title,bucket,storage_key,filename,mime,bytes,sha256,uploaded_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *',
        [
          fields.batch_id || null,
          fields.booking_id || null,
          fields.traveler_id || null,
          fields.type,
          JSON.stringify({ id: fields.title || data.filename, en: fields.title || data.filename }),
          bucket,
          key,
          data.filename.replace(/[^\w. -]/g, '_'),
          mime,
          bytes.length,
          sha(bytes).toString('hex'),
          u.id,
        ],
      );
      await audit(tx, req, 'document.upload', 'document', doc.id, null, { filename: doc.filename });
      return doc;
    });
  });
  app.post('/api/admin/documents/:id/withdraw', async (req) => {
    await authenticate(req, true);
    return transaction(async (tx) => {
      const [doc] = await tx.query(
        "UPDATE documents SET status='withdrawn',withdrawn_at=now(),published_at=null WHERE id=$1 RETURNING *",
        [(req.params as any).id],
      );
      if (!doc) fail('not_found', 'Document not found.', 404);
      await audit(tx, req, 'document.withdraw', 'document', doc.id, null, { status: 'withdrawn' });
      return { ok: true };
    });
  });
  app.get('/api/admin/documents/:id/download', async (req, reply) => {
    await authenticate(req, true);
    const [doc] = await db.query('SELECT * FROM documents WHERE id=$1', [
      z.uuid().parse((req.params as any).id),
    ]);
    if (!doc) fail('not_found', 'Document not found.', 404);
    await transaction((tx) =>
      audit(tx, req, 'document.preview', 'document', doc.id, null, { filename: doc.filename }),
    );
    const disposition = `attachment; filename="${doc.filename.replace(/[^\w. -]/g, '_')}"`;
    reply.header('Cache-Control', 'no-store');
    if (doc.bucket !== 'local' && s3)
      return reply.redirect(
        await getSignedUrl(
          s3,
          new GetObjectCommand({
            Bucket: doc.bucket,
            Key: doc.storage_key,
            ResponseContentDisposition: disposition,
          }),
          { expiresIn: 300 },
        ),
      );
    reply.type(doc.mime).header('Content-Disposition', disposition);
    return readObject(doc.bucket, doc.storage_key);
  });
  app.get('/api/me/documents/:id/download', async (req, reply) => {
    const u = await authenticate(req);
    const [doc] = await db.query(
      `SELECT DISTINCT d.* FROM documents d JOIN bookings b ON (b.id=d.booking_id OR (d.booking_id IS NULL AND b.batch_id=d.batch_id)) WHERE d.id=$1 AND b.user_id=$2 AND d.status='published' AND d.type<>'payment_proof' AND (d.traveler_id IS NULL OR EXISTS(SELECT 1 FROM booking_travelers bt WHERE bt.booking_id=b.id AND bt.traveler_id=d.traveler_id AND bt.removed_at IS NULL))`,
      [(req.params as any).id, u.id],
    );
    if (!doc) fail('not_found', 'Document not found.', 404);
    if (s3 && doc.bucket !== 'local')
      return reply.redirect(
        await getSignedUrl(
          s3,
          new GetObjectCommand({
            Bucket: doc.bucket,
            Key: doc.storage_key,
            ResponseContentDisposition: `attachment; filename="${doc.filename}"`,
          }),
          { expiresIn: 300 },
        ),
      );
    const expires = Date.now() + 300000;
    const signature = createHmac('sha256', config.sessionSecret)
      .update(`${doc.id}:${expires}`)
      .digest('hex');
    return reply.redirect(`/api/files/${doc.id}?expires=${expires}&signature=${signature}`);
  });
  if (!s3)
    app.get('/api/files/:id', async (req, reply) => {
      const id = (req.params as any).id,
        q = req.query as any,
        expected = createHmac('sha256', config.sessionSecret)
          .update(`${id}:${q.expires}`)
          .digest('hex');
      if (
        Number(q.expires) < Date.now() ||
        Number(q.expires) > Date.now() + 300000 ||
        !secureEqual(q.signature || '', expected)
      )
        fail('expired_url', 'This download link has expired.', 403);
      const [doc] = await db.query("SELECT * FROM documents WHERE id=$1 AND status='published'", [
        id,
      ]);
      if (!doc) fail('not_found', 'Document not found.', 404);
      reply.type(doc.mime).header('Content-Disposition', `attachment; filename="${doc.filename}"`);
      return readFile(resolve(localFilesRoot, doc.storage_key));
    });
  app.post('/api/admin/media/upload', async (req) => {
    const u = await authenticate(req, true),
      data = await req.file();
    if (!data) fail('missing_file', 'Choose an image.');
    const bytes = await data.toBuffer(),
      mime = mimeOf(bytes);
    if (mime?.startsWith('video/')) {
      if (bytes.length > 83886080) fail('invalid_file', 'Video must be under 80 MB.');
      const id = randomUUID(),
        key = `media/${id}/video.${mime === 'video/mp4' ? 'mp4' : 'webm'}`,
        bucket = process.env.R2_PUBLIC_BUCKET || 'local';
      if (s3)
        await s3.send(
          new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: mime }),
        );
      else {
        await storeObject('local', key, bytes, mime);
      }
      return transaction(async (tx) => {
        const [asset] = await tx.query(
          "INSERT INTO media_assets(id,kind,bucket,storage_key,mime,bytes,created_by) VALUES($1,'video',$2,$3,$4,$5,$6) RETURNING *",
          [id, bucket, key, mime, bytes.length, u.id],
        );
        await audit(tx, req, 'media.upload', 'media', id, null, { key, kind: 'video' });
        return asset;
      });
    }
    if (!mime || mime === 'application/pdf' || bytes.length > 26214400)
      fail('invalid_file', 'Use a JPG, PNG or WebP under 25 MB.');
    const sharp = (await import('sharp')).default;
    const image = sharp(bytes, { limitInputPixels: 40000000 }),
      meta = await image.metadata();
    const id = randomUUID(),
      key = `media/${id}/original.${mime === 'image/jpeg' ? 'jpg' : mime === 'image/png' ? 'png' : 'webp'}`,
      variants: { format: string; width: number; key: string }[] = [];
    const bucket = s3 ? process.env.R2_PUBLIC_BUCKET || 'local' : 'local';
    const store = async (k: string, b: Buffer, m: string) => {
      if (s3 && bucket !== 'local')
        await s3.send(new PutObjectCommand({ Bucket: bucket, Key: k, Body: b, ContentType: m }));
      else {
        await storeObject('local', k, b, m);
      }
    };
    await store(key, bytes, mime);
    for (const width of [480, 960, 1600, 2560])
      for (const format of ['webp', 'avif'] as const) {
        const k = `media/${id}/${width}.${format}`;
        await store(
          k,
          await sharp(bytes)
            .resize({ width, withoutEnlargement: true })
            .toFormat(format)
            .toBuffer(),
          `image/${format}`,
        );
        variants.push({ format, width, key: k });
      }
    const blur =
      'data:image/webp;base64,' +
      (await sharp(bytes).resize(20).webp().toBuffer()).toString('base64');
    return transaction(async (tx) => {
      const [m] = await tx.query(
        "INSERT INTO media_assets(id,kind,bucket,storage_key,mime,bytes,width,height,variants,blur_data_url,created_by) VALUES($1,'image',$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *",
        [
          id,
          bucket,
          key,
          mime,
          bytes.length,
          meta.width,
          meta.height,
          JSON.stringify(variants),
          blur,
          u.id,
        ],
      );
      await audit(tx, req, 'media.upload', 'media', id, null, { key });
      return m;
    });
  });
  app.get('/api/me/bookings/:code/itinerary.pdf', async (req, reply) => {
    const u = await authenticate(req),
      b = await ownedBooking(u.id, (req.params as any).code);
    const locale = z.enum(['id', 'en']).parse((req.query as any).lang || u.locale);
    const [p] = await db.query('SELECT title FROM packages WHERE id=$1', [b.package_id]);
    const rows = await db.query(
      'SELECT * FROM batch_itinerary_items WHERE batch_id=$1 AND published_at IS NOT NULL ORDER BY day_number,sort_order',
      [b.batch_id],
    );
    reply
      .type('application/pdf')
      .header('Content-Disposition', `attachment; filename="${b.code}-itinerary.pdf"`);
    const [batch] = await db.query('SELECT start_date FROM batches WHERE id=$1', [b.batch_id]);
    return cachedPdf(
      p.title[locale] || p.title.id,
      b.code,
      itineraryRows(rows, locale, batch?.start_date),
      locale,
    );
  });
  app.get('/api/me/invoices/:id/receipt.pdf', async (req, reply) => {
    const u = await authenticate(req);
    const locale = z.enum(['id', 'en']).parse((req.query as any).lang || u.locale);
    const [i] = await db.query(
      "SELECT * FROM invoices WHERE id=$1 AND user_id=$2 AND status='paid'",
      [(req.params as any).id, u.id],
    );
    if (!i) fail('not_found', 'Paid invoice not found.', 404);
    const lines = await db.query(
      'SELECT * FROM invoice_lines WHERE invoice_id=$1 ORDER BY sort_order',
      [i.id],
    );
    reply
      .type('application/pdf')
      .header('Content-Disposition', `attachment; filename="${i.number}.pdf"`);
    return cachedPdf(
      `${locale === 'id' ? 'Kuitansi' : 'Receipt'} · ${i.number}`,
      u.full_name,
      receiptRows(lines, i, locale),
      locale,
    );
  });
  app.get('/api/me/payments/:id/receipt.pdf', async (req, reply) => {
    const u = await authenticate(req),
      locale = z.enum(['id', 'en']).parse((req.query as any).lang || u.locale);
    const [p] = await db.query(
      'SELECT p.id,p.amount,p.currency,p.paid_at,i.number,i.needs_review,i.status FROM payments p JOIN invoices i ON i.id=p.invoice_id WHERE p.id=$1 AND i.user_id=$2',
      [(req.params as any).id, u.id],
    );
    if (!p) fail('not_found', 'Payment not found.', 404);
    const review = p.needs_review || p.status !== 'paid';
    reply
      .type('application/pdf')
      .header('Content-Disposition', `attachment; filename="${p.number}-payment.pdf"`);
    return cachedPdf(
      `${locale === 'id' ? 'Bukti penerimaan pembayaran' : 'Payment acknowledgment'} · ${p.number}`,
      u.full_name,
      [
        {
          title: locale === 'id' ? 'Diterima' : 'Received',
          body: `${p.currency} ${Number(p.amount).toLocaleString(locale === 'id' ? 'id-ID' : 'en-GB')} · ${date(p.paid_at, locale, true)}`,
        },
        {
          title: locale === 'id' ? 'Status' : 'Status',
          body: review
            ? locale === 'id'
              ? 'Pembayaran memerlukan peninjauan. Bukti ini tidak mengonfirmasi penawaran atau perjalanan Anda. Tim Citadel akan menghubungi Anda.'
              : 'Payment requires review. This acknowledgment does not confirm your offer or journey. Citadel will contact you.'
            : locale === 'id'
              ? 'Pembayaran tercatat. Lihat akun Anda untuk status perjalanan.'
              : 'Payment recorded. See your account for the journey status.',
        },
      ],
      locale,
    );
  });
}
