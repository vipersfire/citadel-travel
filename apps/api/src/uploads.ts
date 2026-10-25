import type { FastifyInstance } from 'fastify';
import { PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { db, transaction } from '@citadel/db';
import { z } from 'zod';
import { uploadInitSchema } from '@citadel/contracts';
import { authenticate } from './auth.js';
import { audit, fail, sha, token, secureEqual } from './core.js';
import { config } from './config.js';
import { s3Client, storeObject, readObject, detectedMime, deleteObject } from './storage.js';
import { wake } from './queue.js';
async function manifest(id: string) {
  const [record] = await db.query(
    "SELECT response_body FROM idempotency_keys WHERE route='upload.reservation' AND key=$1",
    ['upload:' + z.uuid().parse(id)],
  );
  if (!record) fail('not_found', 'Upload reservation not found.', 404);
  return record.response_body;
}
export async function cleanupUploads() {
  for (const row of await db.query(
    "SELECT user_id,key,response_body FROM idempotency_keys WHERE route='upload.reservation' AND (response_body->>'expires')::bigint<$1",
    [Date.now()],
  )) {
    const m = row.response_body;
    // A successful confirm may have committed before the reservation was removed.
    if (
      !(
        await db.query(
          'SELECT id FROM documents WHERE id=$1 UNION ALL SELECT id FROM media_assets WHERE id=$1',
          [m.id],
        )
      ).length
    )
      await deleteObject(m.bucket, m.key);
    await db.query(
      "DELETE FROM idempotency_keys WHERE user_id=$1 AND key=$2 AND route='upload.reservation'",
      [row.user_id, row.key],
    );
  }
}
export async function uploadRoutes(app: FastifyInstance) {
  app.post('/api/admin/uploads/init', async (req) => {
    const u = await authenticate(req, true),
      input = uploadInitSchema.parse(req.body),
      id = randomUUID(),
      secret = token();
    const ext: Record<string, string> = {
      'application/pdf': 'pdf',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
    };
    const key =
      input.kind === 'document'
        ? `docs/${input.booking_id || input.batch_id || 'proofs'}/${id}.${ext[input.mime]}`
        : `media/${id}/original.${ext[input.mime]}`;
    const bucket =
      input.kind === 'document' || !s3Client ? 'local' : process.env.R2_PUBLIC_BUCKET || 'local';
    const record = {
      id,
      user_id: u.id,
      input,
      key,
      bucket,
      secret: sha(secret).toString('hex'),
      expires: Date.now() + 15 * 60000,
    };
    await db.query(
      "INSERT INTO idempotency_keys(user_id,key,route,request_hash,response_body) VALUES($1,$2,'upload.reservation',$3,$4)",
      [u.id, 'upload:' + id, sha(JSON.stringify(input)).toString('hex'), JSON.stringify(record)],
    );
    const url =
      s3Client && bucket !== 'local'
        ? await getSignedUrl(
            s3Client,
            new PutObjectCommand({
              Bucket: bucket,
              Key: key,
              ContentType: input.mime,
              ContentLength: input.bytes,
            }),
            { expiresIn: 900 },
          )
        : `${config.APP_ORIGIN}/api/admin/uploads/${id}/content?token=${secret}`;
    return {
      id,
      url,
      method: 'PUT',
      headers: { 'Content-Type': input.mime },
      expires_at: new Date(record.expires).toISOString(),
    };
  });
  app.put(
    '/api/admin/uploads/:id/content',
    { bodyLimit: 80 * 1024 * 1024, config: { rawUpload: true } },
    async (req) => {
      const u = await authenticate(req, true),
        m = await manifest((req.params as any).id);
      if (
        m.user_id !== u.id ||
        m.expires < Date.now() ||
        !secureEqual(sha(String((req.query as any).token || '')).toString('hex'), m.secret)
      )
        fail('invalid_upload', 'Upload reservation expired.', 403);
      const bytes = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body as Uint8Array);
      if (bytes.length !== m.input.bytes)
        fail('invalid_size', 'Uploaded file size does not match.');
      await storeObject(m.bucket, m.key, bytes, m.input.mime);
      return { ok: true };
    },
  );
  app.post('/api/admin/uploads/:id/confirm', async (req) => {
    const u = await authenticate(req, true),
      id = z.uuid().parse((req.params as any).id);
    const [existingDoc] = await db.query('SELECT * FROM documents WHERE id=$1 AND uploaded_by=$2', [
      id,
      u.id,
    ]);
    const [existingMedia] = await db.query(
      'SELECT * FROM media_assets WHERE id=$1 AND created_by=$2',
      [id, u.id],
    );
    if (existingDoc || existingMedia) return existingDoc || existingMedia;
    const m = await manifest(id);
    if (m.user_id !== u.id || m.expires < Date.now())
      fail('invalid_upload', 'Upload reservation expired.', 403);
    if (s3Client && m.bucket !== 'local') {
      const head = await s3Client.send(new HeadObjectCommand({ Bucket: m.bucket, Key: m.key }));
      if (head.ContentLength !== m.input.bytes || head.ContentType !== m.input.mime)
        fail('invalid_file', 'Uploaded size or type does not match.');
    }
    const bytes = await readObject(m.bucket, m.key);
    if (bytes.length !== m.input.bytes || detectedMime(bytes) !== m.input.mime)
      fail('invalid_file', 'File signature does not match its declared type.');
    if (m.input.kind === 'image') {
      try {
        const sharp = (await import('sharp')).default;
        await sharp(bytes, { limitInputPixels: 60000000 }).resize(1).toBuffer();
      } catch {
        fail('invalid_file', 'The image cannot be decoded. Choose a valid JPG, PNG or WebP.');
      }
    }
    const b = { ...m.input, filename: m.input.filename.replace(/[^\w. -]/g, '_') };
    const row = await transaction(async (tx) => {
      if (b.kind === 'document') {
        if (b.booking_id) {
          const [booking] = await tx.query('SELECT batch_id FROM bookings WHERE id=$1', [
            b.booking_id,
          ]);
          if (!booking || (b.batch_id && booking.batch_id !== b.batch_id))
            fail('invalid_owner', 'Booking does not belong to this batch.');
          b.batch_id = b.batch_id || booking.batch_id;
          if (
            b.traveler_id &&
            !(
              await tx.query(
                'SELECT id FROM booking_travelers WHERE booking_id=$1 AND traveler_id=$2 AND removed_at IS NULL',
                [b.booking_id, b.traveler_id],
              )
            ).length
          )
            fail('invalid_traveler', 'Traveler does not belong to this booking.');
        } else if (b.traveler_id) fail('invalid_owner', 'Traveler documents need a booking.');
        const [d] = await tx.query(
          'INSERT INTO documents(id,batch_id,booking_id,traveler_id,type,title,bucket,storage_key,filename,mime,bytes,sha256,uploaded_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *',
          [
            m.id,
            b.batch_id || null,
            b.booking_id || null,
            b.traveler_id || null,
            b.type,
            JSON.stringify(b.title || { id: b.filename, en: b.filename }),
            m.bucket,
            m.key,
            b.filename,
            b.mime,
            b.bytes,
            sha(bytes).toString('hex'),
            u.id,
          ],
        );
        await audit(tx, req, 'document.upload', 'document', d.id, null, { filename: d.filename });
        return d;
      }
      const [media] = await tx.query(
        'INSERT INTO media_assets(id,kind,bucket,storage_key,mime,bytes,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
        [m.id, b.kind, m.bucket, m.key, b.mime, b.bytes, u.id],
      );
      await audit(tx, req, 'media.upload', 'media', media.id, null, { key: m.key });
      return media;
    });
    await db.query(
      "DELETE FROM idempotency_keys WHERE key=$1 AND user_id=$2 AND route='upload.reservation'",
      ['upload:' + m.id, u.id],
    );
    if (b.kind === 'image') {
      if (config.APP_ENV === 'development')
        setImmediate(() =>
          void import('./media-jobs.js')
            .then(({ generateVariants }) => generateVariants(row.id))
            .catch(() => undefined),
        );
      else await wake('media.variants', { id: row.id });
    }
    return row;
  });
  const serveMedia = async (key: string, bucket: string, reply: any) => {
    if (
      !/^media\/[a-f0-9-]{36}\/(original(?:\.(jpg|jpeg|png|webp|mp4|webm))?|video\.(mp4|webm)|\d+\.(webp|avif))$/.test(
        key,
      )
    )
      fail('not_found', 'Media not found.', 404);
    const ext = key.split('.').pop() ?? '',
      types: Record<string, string> = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
        avif: 'image/avif',
        mp4: 'video/mp4',
        webm: 'video/webm',
      };
    try {
      const bytes = await readObject(bucket, key);
      const mime = types[ext] || detectedMime(bytes) || 'application/octet-stream';
      reply.header('Cache-Control', 'public,max-age=31536000,immutable').type(mime);
      return reply.send(Readable.from(bytes));
    } catch {
      fail('not_found', 'Media not found.', 404);
    }
  };
  app.get('/api/public/media/r2/*', async (req, reply) => {
    const bucket = process.env.R2_PUBLIC_BUCKET;
    if (!bucket || !s3Client) fail('not_found', 'Media not found.', 404);
    return serveMedia((req.params as any)['*'], bucket, reply);
  });
  app.get('/api/public/media/*', async (req, reply) => {
    return serveMedia((req.params as any)['*'], 'local', reply);
  });
}
