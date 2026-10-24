import type { Connection } from './index.js';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
const copy: Record<string, { id: string; en: string }> = {
  OT: {
    id: 'Di Manchester, jalan bata merah menuju malam pertandingan. Nikmati kota sebelum memasuki tribun, dengan pilihan layanan yang dijelaskan dalam penawaran personal Anda.',
    en: 'In Manchester, red-brick streets lead to a matchday evening. Take time in the city before the stands, with service choices explained in your personal proposal.',
  },
  EC: {
    id: 'Dua rival besar dan pengalaman kota tuan rumah. Tuan rumah dan venue untuk edisi ini diverifikasi sebelum penawaran. Kategori tiket dan tempat duduk rombongan dikonfirmasi dalam penawaran pribadi.',
    en: 'Two great rivals and a host-city experience. The host and venue for this edition are verified before an offer. Ticket category and your party’s seating are confirmed in your personal offer.',
  },
  RG: {
    id: 'Di Paris, pertandingan tenis berpadu dengan pagi yang tenang di kota. Pilih hari di lapangan tanah liat; hotel, transfer, dan waktu untuk menikmati Paris kami susun bersama Anda.',
    en: 'In Paris, tennis days meet unhurried mornings in the city. Choose your time by the clay courts; we arrange your stay, transfers and time to enjoy Paris with you.',
  },
  WB: {
    id: 'Tradisi tenis musim panas dan kehidupan London. Hari pertandingan, jalan-jalan kota, dan penginapan premium disusun mengikuti tanggal serta alokasi yang dikonfirmasi.',
    en: 'Summer tennis tradition and London life. Match days, city walks and a premium stay follow confirmed dates and allocations.',
  },
  F1: {
    id: 'Monza untuk kecepatan, Milan untuk gaya, Como untuk ketenangan. Rute ini memberi ruang bagi sirkuit dan kota, dengan kategori tiket serta penginapan yang dikonfirmasi dalam penawaran.',
    en: 'Monza for speed, Milan for style, Como for quiet. This journey leaves room for circuit and city, with ticket category and accommodation confirmed in your offer.',
  },
  BM: {
    id: 'Berlin, selangkah demi selangkah. Pelari dan pendamping mempunyai pilihan berbeda; keikutsertaan resmi hanya termasuk bila tercantum pada opsi dan penawaran Anda.',
    en: 'Berlin, step by step. Runners and companions have different options; official entry is included only when stated in your selected option and offer.',
  },
};
export const messages: Record<string, { id: [string, string]; en: [string, string] }> = {
  lead_autoreply: {
    id: [
      'Pertanyaan Anda diterima',
      'Halo {{name}}, terima kasih telah menghubungi Citadel. Kami membalas dalam 1 hari kerja. {{message}}',
    ],
    en: [
      'Your enquiry is received',
      'Hello {{name}}, thank you for contacting Citadel. We reply within one business day. {{message}}',
    ],
  },
  email_verify: {
    id: [
      'Verifikasi email Anda',
      'Halo {{name}}, verifikasi email Anda melalui tautan berikut. Tautan berlaku 24 jam. {{url}}',
    ],
    en: [
      'Verify your email',
      'Hello {{name}}, verify your email using this link. It expires in 24 hours. {{url}}',
    ],
  },
  password_reset: {
    id: [
      'Atur ulang kata sandi Anda',
      'Halo {{name}}, gunakan tautan ini untuk mengatur kata sandi baru. Berlaku 30 menit. Abaikan pesan ini bila Anda tidak meminta perubahan. {{url}}',
    ],
    en: [
      'Reset your password',
      'Hello {{name}}, use this link to choose a new password. It expires in 30 minutes. Ignore this message if you did not request a change. {{url}}',
    ],
  },
  request_received: {
    id: [
      'Permintaan perjalanan diterima',
      'Halo {{name}}, permintaan Anda telah diterima. Tim Citadel akan meninjau detail dan menghubungi Anda. {{message}} {{url}}',
    ],
    en: [
      'Your journey request is received',
      'Hello {{name}}, we have received your request. Citadel will review the details and contact you. {{message}} {{url}}',
    ],
  },
  offer_ready: {
    id: [
      'Penawaran pribadi Anda siap',
      'Halo {{name}}, tinjau dan setujui penawaran {{message}} sebelum membayar. Total {{amount}}. Bayar sebelum {{deadline}}. Tinjau detail dan syarat di akun Anda. {{url}}',
    ],
    en: [
      'Your personal offer is ready',
      'Hello {{name}}, review and approve offer {{message}} before paying. Total {{amount}}. Pay by {{deadline}}. Review the details and terms in your account. {{url}}',
    ],
  },
  payment_reminder: {
    id: [
      'Pengingat batas pembayaran',
      'Halo {{name}}, pembayaran {{message}} jatuh tempo {{deadline}}. Tinjau atau selesaikan pembayaran melalui akun Anda. {{url}}',
    ],
    en: [
      'Payment deadline reminder',
      'Hello {{name}}, payment for {{message}} is due by {{deadline}}. Review or complete payment in your account. {{url}}',
    ],
  },
  payment_received: {
    id: [
      'Pembayaran diterima',
      'Halo {{name}}, pembayaran {{message}} telah tercatat. Kuitansi dan status perjalanan tersedia di akun Anda. {{url}}',
    ],
    en: [
      'Payment received',
      'Hello {{name}}, payment for {{message}} is recorded. Your receipt and journey status are available in your account. {{url}}',
    ],
  },
  payment_review: {
    id: [
      'Pembayaran memerlukan peninjauan',
      'Halo {{name}}, dana untuk {{message}} telah tercatat dan sedang ditinjau. Bukti penerimaan tersedia di akun Anda. Perjalanan belum dikonfirmasi oleh bukti ini. Tim Citadel akan menghubungi Anda. {{url}}',
    ],
    en: [
      'Payment requires review',
      'Hello {{name}}, funds for {{message}} are recorded and under review. An acknowledgment is available in your account. It does not confirm your journey. Citadel will contact you. {{url}}',
    ],
  },
  offer_expired: {
    id: [
      'Batas penawaran telah lewat',
      'Halo {{name}}, penawaran {{message}} sudah kedaluwarsa. Hubungi Citadel untuk penawaran baru. {{url}}',
    ],
    en: [
      'Your offer deadline has passed',
      'Hello {{name}}, offer {{message}} has expired. Contact Citadel for a new offer. {{url}}',
    ],
  },
  trip_updated: {
    id: [
      'Detail perjalanan diperbarui',
      'Halo {{name}}, ada detail perjalanan baru. {{message}} Tinjau dokumen dan itinerary dalam akun Anda. {{url}}',
    ],
    en: [
      'Your journey has been updated',
      'Hello {{name}}, new journey details are available. {{message}} Review your documents and itinerary in your account. {{url}}',
    ],
  },
  visa_status_changed: {
    id: [
      'Status visa diperbarui',
      'Halo {{name}}, status visa diperbarui: {{message}}. Tinjau daftar dokumen dan janji melalui tab Traveler. {{url}}',
    ],
    en: [
      'Visa status updated',
      'Hello {{name}}, the visa status is updated: {{message}}. Review the checklist and appointments in Travelers. {{url}}',
    ],
  },
  event_date_changed: {
    id: [
      'Pembaruan tanggal acara',
      'Halo {{name}}, {{message}} Tanggal perjalanan mengikuti konfirmasi Citadel. {{url}}',
    ],
    en: [
      'Event date update',
      'Hello {{name}}, {{message}}. Journey dates follow confirmation by Citadel. {{url}}',
    ],
  },
  departure_reminder: {
    id: [
      'Persiapan keberangkatan dalam 7 hari',
      'Halo {{name}}, perjalanan {{message}} berangkat dalam 7 hari. Periksa paspor, visa, dokumen, dan titik pertemuan Anda. {{url}}',
    ],
    en: [
      'Prepare for departure in 7 days',
      'Hello {{name}}, journey {{message}} departs in 7 days. Check your passport, visa, documents and meeting point. {{url}}',
    ],
  },
  batch_message: {
    id: ['Pesan dari tim Citadel', 'Halo {{name}}, {{message}} {{url}}'],
    en: ['A message from Citadel', 'Hello {{name}}, {{message}} {{url}}'],
  },
  account_deletion_requested: {
    id: ['Permintaan penghapusan akun', '{{message}} {{url}}'],
    en: ['Account deletion request', '{{message}} {{url}}'],
  },
  reconciliation_alert: {
    id: ['Pembayaran memerlukan peninjauan', '{{message}} {{url}}'],
    en: ['Payment review required', '{{message}} {{url}}'],
  },
  predeparture_alert: {
    id: ['Periksa kesiapan keberangkatan', '{{message}} {{url}}'],
    en: ['Departure readiness review', '{{message}} {{url}}'],
  },
};
export async function completeContent(tx: Connection) {
  for (const [key, text] of Object.entries(messages))
    for (const locale of ['id', 'en'] as const)
      for (const channel of ['email', 'whatsapp']) {
        if (['email_verify', 'password_reset'].includes(key) && channel === 'whatsapp') continue;
        await tx.query(
          'INSERT INTO notification_templates(key,channel,locale,subject,body,wa_template_name,wa_language) VALUES($1,$2,$3::app_locale,$4,$5,$1,$3::text) ON CONFLICT DO NOTHING',
          [key, channel, locale, text[locale][0], text[locale][1]],
        );
        await tx.query(
          'UPDATE notification_templates SET subject=$1,body=$2 WHERE key=$3 AND channel=$4 AND locale=$5 AND body IN ($6,$7)',
          [
            text[locale][0],
            text[locale][1],
            key,
            channel,
            locale,
            'Halo {{name}}, ada pembaruan perjalanan Anda. {{message}} {{url}}',
            'Hello {{name}}, there is an update to your journey. {{message}} {{url}}',
          ],
        );
      }
  for (const locale of ['id', 'en'])
    await tx.query(
      "INSERT INTO notification_templates(key,channel,locale,subject,body) VALUES('lead_autoreply','email',$1,$2,$3) ON CONFLICT DO NOTHING",
      [
        locale,
        locale === 'id' ? 'Pertanyaan Anda diterima' : 'Your enquiry is received',
        locale === 'id'
          ? 'Halo {{name}}, kami membalas dalam 1 hari kerja.'
          : 'Hello {{name}}, we reply within one business day.',
      ],
    );
  if (process.env.APP_ENV === 'production') return;
  const root = resolve(import.meta.dirname, '../../../apps/web/public/placeholders');
  const metadata = JSON.parse(await readFile(resolve(root, 'metadata.json'), 'utf8'));
  const images: Record<string, string> = {
    OT: 'manchester',
    EC: 'madrid',
    RG: 'paris',
    WB: 'grass',
    F1: 'monza',
    BM: 'berlin',
  };
  for (const [code, image] of Object.entries(images)) {
    const [pkg] = await tx.query('SELECT * FROM packages WHERE code=$1', [code]);
    if (!pkg) continue;
    const key = `placeholders/${image}.webp`,
      meta = metadata[image];
    const variants = [480, 960, 1600, 2560].flatMap((width) =>
      ['avif', 'webp'].map((format) => ({
        width,
        format,
        key: `placeholders/${image}-${width}.${format}`,
      })),
    );
    const [m] = await tx.query(
      "INSERT INTO media_assets(kind,bucket,storage_key,mime,bytes,width,height,alt,is_ai_generated,variants,blur_data_url) VALUES('image','bundled',$1,'image/webp',$2,1600,$6,$3,true,$4,$5) ON CONFLICT(storage_key) DO UPDATE SET bytes=excluded.bytes,width=excluded.width,height=excluded.height,variants=excluded.variants,blur_data_url=excluded.blur_data_url RETURNING id",
      [
        key,
        meta.bytes,
        JSON.stringify({
          id: 'Ilustrasi sementara untuk perjalanan ' + pkg.title.id,
          en: 'Illustrative journey placeholder: ' + (pkg.title.en || pkg.title.id),
        }),
        JSON.stringify(variants),
        meta.blur,
        meta.height,
      ],
    );
    if (!pkg.hero_media_id && (pkg.seo?.image || '').startsWith('/images/'))
      await tx.query(
        'UPDATE packages SET hero_media_id=$1,seo=$2,story=$3::jsonb,summary=$3::jsonb::localized_text,updated_at=now() WHERE id=$4',
        [
          m.id,
          JSON.stringify({ ...pkg.seo, image: '/' + key, is_placeholder: true }),
          JSON.stringify(copy[code]),
          pkg.id,
        ],
      );
    if (code === 'F1' && pkg.seo?.is_placeholder)
      await tx.query(
        "UPDATE packages SET hero_media_id=$1,seo=jsonb_set(seo,'{image}',to_jsonb($2::text)),updated_at=now() WHERE id=$3",
        [m.id, '/' + key, pkg.id],
      );
  }
  for (const name of ['hero', 'london', 'paris-life', 'london-life', 'family']) {
    const meta = metadata[name];
    await tx.query(
      "INSERT INTO media_assets(kind,bucket,storage_key,mime,bytes,width,height,alt,is_ai_generated,variants,blur_data_url) VALUES('image','bundled',$1,'image/webp',$2,1600,$6,$3,true,$4,$5) ON CONFLICT(storage_key) DO UPDATE SET bytes=excluded.bytes,width=excluded.width,height=excluded.height,variants=excluded.variants,blur_data_url=excluded.blur_data_url",
      [
        'placeholders/' + name + '.webp',
        meta.bytes,
        JSON.stringify({
          id: 'Ilustrasi sementara · ' + name,
          en: 'Illustrative placeholder · ' + name,
        }),
        JSON.stringify(
          [480, 960, 1600, 2560].flatMap((width) =>
            ['avif', 'webp'].map((format) => ({
              width,
              format,
              key: `placeholders/${name}-${width}.${format}`,
            })),
          ),
        ),
        meta.blur,
        meta.height,
      ],
    );
  }
  for (const name of ['hero', 'monza', 'como'])
    for (const orientation of ['desktop', 'mobile']) {
      const key = `placeholders/${name}-${orientation}.webp`,
        info = await stat(resolve(root, `${name}-${orientation}.webp`));
      await tx.query(
        "INSERT INTO media_assets(kind,bucket,storage_key,mime,bytes,width,height,alt,is_ai_generated) VALUES('image','bundled',$1,'image/webp',$2,$3,$4,$5,true) ON CONFLICT(storage_key) DO UPDATE SET bytes=excluded.bytes",
        [
          key,
          info.size,
          orientation === 'mobile' ? 1080 : 1920,
          orientation === 'mobile' ? 1920 : 1080,
          JSON.stringify({
            id: 'Poster ilustrasi sementara · ' + name,
            en: 'Illustrative first-frame poster · ' + name,
          }),
        ],
      );
    }
  for (const name of ['hero', 'monza', 'como'])
    for (const suffix of ['.mp4', '-mobile.mp4', '.webm', '-mobile.webm']) {
      const key = 'placeholders/' + name + suffix,
        info = await stat(resolve(root, name + suffix));
      const [video] = await tx.query(
        "INSERT INTO media_assets(kind,bucket,storage_key,mime,bytes,width,height,alt,is_ai_generated,duration_ms) VALUES('video','bundled',$1,$2,$3,$4,$5,$6,true,$7) ON CONFLICT(storage_key) DO UPDATE SET bytes=excluded.bytes,width=excluded.width,height=excluded.height,duration_ms=excluded.duration_ms RETURNING id",
        [
          key,
          suffix.endsWith('mp4') ? 'video/mp4' : 'video/webm',
          info.size,
          suffix.includes('mobile') ? 1080 : 1920,
          suffix.includes('mobile') ? 1920 : 1080,
          JSON.stringify({
            id: 'Video ilustrasi sementara · ' + name,
            en: 'Illustrative placeholder video · ' + name,
          }),
          name === 'monza' || (name === 'hero' && suffix.includes('mobile')) ? 8000 : 10000,
        ],
      );
      await tx.query(
        'UPDATE media_assets SET poster_asset_id=(SELECT id FROM media_assets WHERE storage_key=$1) WHERE id=$2',
        [
          'placeholders/' + name + (suffix.includes('mobile') ? '-mobile.webp' : '-desktop.webp'),
          video.id,
        ],
      );
      if (suffix === '.mp4' && name !== 'hero')
        await tx.query(
          "UPDATE packages SET hero_video_id=$1,updated_at=now() WHERE code=$2 AND hero_video_id IS NULL AND seo->>'is_placeholder'='true'",
          [video.id, name === 'monza' ? 'F1' : 'LC'],
        );
    }
  await tx.query(
    "INSERT INTO home_sections(kind,data,status,sort_order) SELECT 'hero',$1,'published',0 WHERE NOT EXISTS(SELECT 1 FROM home_sections WHERE kind='hero')",
    [
      JSON.stringify({
        title: {
          id: 'Be There When It Matters.',
          en: 'Be There When It Matters.',
        },
        body: {
          id: 'Rasakan langsung atmosfer pertandingan pilihan Anda. Citadel merancang perjalanan olahraga ke Eropa dengan pilihan pengalaman, akomodasi, dan layanan yang dijelaskan dalam penawaran personal Anda.',
          en: 'Experience the atmosphere of the sporting events you love. Citadel designs journeys to Europe around your chosen event, with experiences, accommodation and services clearly set out in your personal proposal.',
        },
        poster: '/placeholders/hero-desktop.webp',
        mobile_poster: '/placeholders/hero-mobile.webp',
        video: '/placeholders/hero.mp4',
        video_webm: '/placeholders/hero.webm',
        mobile_video: '/placeholders/hero-mobile.mp4',
        mobile_video_webm: '/placeholders/hero-mobile.webm',
        is_placeholder: true,
      }),
    ],
  );
  await tx.query(
    "UPDATE home_sections SET data=data||$1::jsonb,updated_at=now() WHERE kind='hero' AND data->>'is_placeholder'='true'",
    [
      JSON.stringify({
        poster: '/placeholders/hero-desktop.webp',
        mobile_poster: '/placeholders/hero-mobile.webp',
      }),
    ],
  );
  await tx.query(
    "UPDATE media_assets SET rights_status='ai_placeholder' WHERE is_ai_generated AND rights_status='unverified'",
  );
}
