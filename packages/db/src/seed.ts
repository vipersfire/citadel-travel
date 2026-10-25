import { transaction, closeDb } from './index.js';
import { migrate } from './migrate.js';
import { completeContent } from './development-content.js';
export const catalog = [
  {
    code: 'OT',
    slug: 'old-trafford',
    sport: 'football',
    title: { id: 'Old Trafford Experience', en: 'Old Trafford Experience' },
    subtitle: { id: 'Akhir pekan di Theatre of Dreams', en: 'A weekend at the Theatre of Dreams' },
    city: 'Manchester',
    country: 'GB',
    timezone: 'Europe/London',
    image: 'manchester',
    events: [
      ['Manchester United v Everton', '2027-03-13', '2027-03-13'],
      ['Manchester United v Crystal Palace', '2027-04-24', '2027-04-24'],
      ['Manchester United v Fulham', '2027-05-30', '2027-05-30'],
    ],
    venue: 'Old Trafford',
    competition: 'Premier League',
  },
  {
    code: 'EC',
    slug: 'el-clasico',
    sport: 'football',
    title: { id: 'El Clásico Experience', en: 'El Clásico Experience' },
    subtitle: { id: 'Dua rival. Kota tuan rumah dikonfirmasi.', en: 'Two rivals. Host city to be confirmed.' },
    city: 'Madrid',
    country: 'ES',
    timezone: 'Europe/Madrid',
    image: 'madrid',
    events: [['Real Madrid v Barcelona', '2027-05-09', '2027-05-09']],
    venue: 'Bernabéu',
    competition: 'La Liga',
  },
  {
    code: 'RG',
    slug: 'paris-tennis',
    sport: 'tennis',
    title: { id: 'Paris Tennis & Lifestyle', en: 'Paris Tennis & Lifestyle' },
    subtitle: { id: 'Tennis dan kehidupan Paris', en: 'Tennis & the Parisian art of living' },
    city: 'Paris',
    country: 'FR',
    timezone: 'Europe/Paris',
    image: 'paris',
    events: [
      ['Roland-Garros · opening days', '2027-05-23', '2027-05-25'],
      ['Roland-Garros · middle weekend', '2027-05-28', '2027-05-29'],
    ],
    venue: 'Paris',
    competition: 'Roland-Garros',
  },
  {
    code: 'WB',
    slug: 'wimbledon',
    sport: 'tennis',
    title: { id: 'Wimbledon & London', en: 'Wimbledon & London' },
    subtitle: { id: 'Tradisi musim panas Inggris', en: 'An English summer tradition' },
    city: 'London',
    country: 'GB',
    timezone: 'Europe/London',
    image: 'london',
    events: [['Wimbledon Championships', '2027-06-28', '2027-07-11']],
    venue: 'London',
    competition: 'Wimbledon',
  },
  {
    code: 'F1',
    slug: 'monza-milan-como',
    sport: 'motorsport',
    title: { id: 'Monza Race Weekend', en: 'Monza Race Weekend' },
    subtitle: { id: 'Kecepatan, gaya, dan tepian danau', en: 'Speed, style & the lakeside' },
    city: 'Monza',
    country: 'IT',
    timezone: 'Europe/Rome',
    image: 'como',
    events: [['Italian Grand Prix', '2027-09-03', '2027-09-05']],
    venue: 'Monza',
    competition: 'Formula 1',
  },
  {
    code: 'BM',
    slug: 'berlin-marathon',
    sport: 'running',
    title: { id: 'Berlin Marathon Experience', en: 'Berlin Marathon Experience' },
    subtitle: { id: 'Berlari atau mendukung. Bersama.', en: 'Run it. Cheer it. Be there.' },
    city: 'Berlin',
    country: 'DE',
    timezone: 'Europe/Berlin',
    image: 'berlin',
    events: [['Berlin Marathon', '2027-09-26', '2027-09-26']],
    venue: 'Berlin',
    competition: 'Marathon',
  },
];
export async function seed() {
  await migrate();
  await transaction(async (tx) => {
    for (const p of catalog) {
      const existing = await tx.query('SELECT id FROM packages WHERE code=$1', [p.code]);
      if (existing.length) continue;
      const story = {
        id: `Nikmati ${p.city} dengan layanan pribadi Citadel. Pilihan pengalaman, penginapan dan layanan dijelaskan dalam penawaran personal Anda. Detail perjalanan dan penawaran disesuaikan untuk rombongan Anda.`,
        en: `Experience ${p.city} with Citadel’s personal care. Experiences, accommodation and services are explained in your personal proposal. Your journey and offer are tailored to your party.`,
      };
      const [pkg] = await tx.query(
        `INSERT INTO packages(code,slug,sport,status,title,subtitle,summary,story,countries,cities,hotel_style,visa_note,highlights,inclusions,exclusions,seo,featured) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,true) RETURNING *`,
        [
          p.code,
          p.slug,
          p.sport,
          'draft',
          JSON.stringify(p.title),
          JSON.stringify(p.subtitle),
          JSON.stringify(story),
          JSON.stringify(story),
          [p.country],
          [p.city],
          JSON.stringify({
            id: 'Hotel premium pilihan. Properti akhir dikonfirmasi dalam penawaran.',
            en: 'Hand-picked premium hotels. Final properties confirmed in your offer.',
          }),
          JSON.stringify({
            id: 'Visa mungkin diperlukan. Kirim dokumen visa melalui WhatsApp atau email kepada Citadel. Tanggal acara masih sementara.',
            en: 'A visa may be required. Send visa documents to Citadel by WhatsApp or email. Event dates remain provisional.',
          }),
          JSON.stringify([
            { id: 'Pilihan pendamping dijelaskan per penawaran', en: 'Tour leader arrangements explained per offer' },
            { id: 'Kebutuhan makanan dibahas bersama Anda', en: 'Dietary needs discussed with you' },
            {
              id: 'Detail yang diatur untuk rombongan Anda',
              en: 'The details, arranged for your party',
            },
          ]),
          JSON.stringify([
            { id: 'Akomodasi sesuai penawaran', en: 'Accommodation as offered' },
            { id: 'Transportasi terjadwal', en: 'Scheduled transfers' },
            { id: 'Tiket acara sesuai opsi', en: 'Event tickets for your selected option' },
          ]),
          JSON.stringify([
            { id: 'Visa dan pengeluaran pribadi', en: 'Visa fees & personal expenses' },
            {
              id: 'Penerbangan kecuali tercantum dalam penawaran',
              en: 'Flights unless stated in your offer',
            },
          ]),
          JSON.stringify({ image: `/images/${p.image}.jpg` }),
        ],
      );
      for (const code of p.code === 'BM'
        ? ['RUNNER', 'COMPANION']
        : p.sport === 'football'
          ? ['STANDARD', 'HOSPITALITY']
          : ['STANDARD'])
        await tx.query(
          'INSERT INTO package_options(package_id,code,name,includes_event_entry) VALUES($1,$2,$3,$4)',
          [
            pkg.id,
            code,
            JSON.stringify({
              id:
                code === 'RUNNER'
                  ? 'Pelari'
                  : code === 'COMPANION'
                    ? 'Pendamping'
                    : code === 'HOSPITALITY'
                      ? 'Hospitality'
                      : 'Standard',
              en: code[0] + code.slice(1).toLowerCase(),
            }),
            code !== 'COMPANION',
          ],
        );
      for (let day = 1; day <= 4; day++)
        await tx.query(
          'INSERT INTO package_itinerary_days(package_id,day_number,title,body,city) VALUES($1,$2,$3,$4,$5)',
          [
            pkg.id,
            day,
            JSON.stringify({
              id: [
                'Kedatangan dan sambutan',
                'Jelajahi kota',
                'Hari utama Anda',
                'Waktu untuk pulang',
              ][day - 1],
              en: [
                'Arrival & a warm welcome',
                'A city, at your pace',
                'Your main event',
                'Time to head home',
              ][day - 1],
            }),
            JSON.stringify({
              id: 'Contoh itinerary. Rencana akhir menyesuaikan tanggal keberangkatan dan alokasi.',
              en: 'Sample itinerary. Your final plan follows confirmed departure dates and allocations.',
            }),
            p.city,
          ],
        );
      for (const [name, start, end] of p.events) {
        const [event] = await tx.query(
          "INSERT INTO events(name,sport,competition,venue,city,country,starts_on,ends_on,timezone,date_status,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'provisional',$10) RETURNING *",
          [
            JSON.stringify({ id: name, en: name }),
            p.sport,
            p.competition,
            p.venue,
            p.city,
            p.country,
            start,
            end,
            p.timezone,
            'Imported from the supplied brief; dates are not independently verified.',
          ],
        );
        const before = new Date(start + 'T12:00:00Z');
        before.setDate(before.getDate() - 2);
        const after = new Date(start + 'T12:00:00Z');
        after.setDate(after.getDate() + 2);
        const [batch] = await tx.query(
          "INSERT INTO batches(package_id,event_id,code,start_date,end_date,capacity,min_pax,status,internal_notes) VALUES($1,$2,$3,$4,$5,20,10,'draft',$6) RETURNING *",
          [
            pkg.id,
            event.id,
            `${p.code}-27-${start.slice(5).replace('-', '')}`,
            null,
            null,
            'Illustrative trip dates. Admin must confirm with supplier before opening.',
          ],
        );
        await tx.query(
          'INSERT INTO batch_itinerary_items(batch_id,day_number,timezone,title,body,location_name) SELECT $1,day_number,$2,title,body,city FROM package_itinerary_days WHERE package_id=$3',
          [batch.id, p.timezone, pkg.id],
        );
      }
    }
    const addons = [
      ['HOSP', 'Hospitality seats', 'Kursi hospitality'],
      ['HOTEL', 'Hotel upgrade', 'Upgrade hotel'],
      ['TRANSFER', 'Private airport transfer', 'Transfer bandara pribadi'],
      ['DINING', 'Fine dining evening', 'Makan malam istimewa'],
      ['CITY', 'Guided city experience', 'Pengalaman kota berpemandu'],
    ];
    for (const [code, en, id] of addons)
      await tx.query(
        "INSERT INTO addons(code,name,applies_to_all,status) VALUES($1,$2,true,'published') ON CONFLICT(code) DO NOTHING",
        [code, JSON.stringify({ id, en })],
      );
    for (const destination of ['SCHENGEN', 'GB'])
      await tx.query(
        'INSERT INTO visa_checklist_templates(destination,visa_type,items) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
        [
          destination,
          destination === 'GB' ? 'standard_visitor' : 'short_stay_tourism',
          JSON.stringify([
            { label: { id: 'Paspor yang berlaku', en: 'Valid passport' } },
            {
              label: {
                id: 'Foto dan bukti keuangan; konfirmasi daftar akhir dengan Citadel',
                en: 'Photograph & financial evidence; confirm the final checklist with Citadel',
              },
            },
          ]),
        ],
      );
    for (const key of [
      'lead_autoreply',
      'email_verify',
      'password_reset',
      'request_received',
      'offer_ready',
      'payment_reminder',
      'payment_received',
      'offer_expired',
      'trip_updated',
      'visa_status_changed',
      'event_date_changed',
      'departure_reminder',
      'batch_message',
    ])
      for (const locale of ['id', 'en'])
        for (const channel of ['email', 'whatsapp'])
          await tx.query(
            'INSERT INTO notification_templates(key,channel,locale,subject,body,wa_template_name,wa_language) VALUES($1,$2,$3,$4,$5,$1,$6) ON CONFLICT DO NOTHING',
            [
              key,
              channel,
              locale,
              `Citadel · ${key.replaceAll('_', ' ')}`,
              locale === 'id'
                ? 'Halo {{name}}, ada pembaruan perjalanan Anda. {{message}} {{url}}'
                : 'Hello {{name}}, there is an update to your journey. {{message}} {{url}}',
              locale,
            ],
          );
    for (const slug of [
      'about',
      'how-it-works',
      'faq',
      'contact',
      'legal/terms',
      'legal/privacy',
      'legal/cancellation',
    ])
      await tx.query(
        "INSERT INTO content_pages(slug,title,body,status) VALUES($1,$2,$3,'draft') ON CONFLICT DO NOTHING",
        [
          slug,
          JSON.stringify({ id: slug.split('/').pop(), en: slug.split('/').pop() }),
          JSON.stringify({
            id: 'Konten ini harus ditinjau dan diterbitkan oleh Citadel.',
            en: 'This content must be reviewed and published by Citadel.',
          }),
        ],
      );
    await tx.query(
      "INSERT INTO site_settings(key,value) VALUES('contact',$1) ON CONFLICT DO NOTHING",
      [JSON.stringify({ email: '', whatsapp: '', address: 'Jakarta, Indonesia' })],
    );
    if (process.env.SEED_ADMIN_EMAIL && process.env.SEED_ADMIN_PASSWORD) {
      const { hash } = await import('@node-rs/argon2');
      await tx.query(
        "INSERT INTO users(email,full_name,password_hash,role,email_verified_at) VALUES($1,'Citadel Administrator',$2,'admin',now()) ON CONFLICT(email) DO NOTHING",
        [
          process.env.SEED_ADMIN_EMAIL,
          await hash(process.env.SEED_ADMIN_PASSWORD, {
            memoryCost: 19456,
            timeCost: 2,
            parallelism: 1,
          }),
        ],
      );
    }
  });
  await transaction(completeContent);
  console.log('Six draft sport products seeded. Event dates provisional; departure batches draft.');
}
if (process.argv[1]?.endsWith('seed.ts')) {
  await seed();
  await closeDb();
}
