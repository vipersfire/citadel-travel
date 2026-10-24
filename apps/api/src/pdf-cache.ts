import { db } from '@citadel/db';
import { pdf } from '@citadel/pdf';
import { sha } from './core.js';
import { readObject, storeObject } from './storage.js';
import { date, money } from '@citadel/i18n';
type PDFRow = { title: string; body: string };
export async function cachedPdf(
  title: string,
  subtitle: string,
  rows: PDFRow[],
  locale: 'id' | 'en',
) {
  const hash = sha(JSON.stringify({ version: 2, title, subtitle, rows, locale })).toString('hex'),
    key = `docs/pdf-cache/${hash}.pdf`,
    bucket = 'local';
  try {
    return await readObject(bucket, key);
  } catch {
    const bytes = await pdf(title, subtitle, rows, locale);
    await storeObject(bucket, key, bytes, 'application/pdf');
    return bytes;
  }
}
export async function warmPublishedPdf(batchId: string) {
  const [b] = await db.query(
    'SELECT ba.*,p.title AS package_title FROM batches ba JOIN packages p ON p.id=ba.package_id WHERE ba.id=$1',
    [batchId],
  );
  if (!b) return;
  const rows = await db.query(
    'SELECT * FROM batch_itinerary_items WHERE batch_id=$1 AND published_at IS NOT NULL ORDER BY day_number,sort_order',
    [batchId],
  );
  for (const lang of ['id', 'en'] as const)
    for (const booking of await db.query(
      "SELECT code FROM bookings WHERE batch_id=$1 AND status IN ('confirmed','completed')",
      [batchId],
    ))
      await cachedPdf(
        b.package_title[lang] || b.package_title.id,
        booking.code,
        itineraryRows(rows, lang, b.start_date),
        lang,
      );
}
export function itineraryRows(rows: any[], lang: 'id' | 'en', startDate?: string) {
  return rows.map((r) => {
    const day = startDate
      ? new Date(new Date(startDate).getTime() + (r.day_number - 1) * 86400000)
      : null;
    return {
      title: `${lang === 'id' ? 'Hari' : 'Day'} ${r.day_number}${day ? ' · ' + date(day.toISOString(), lang) : ''} · ${r.title[lang] || r.title.id}`,
      body: `${r.starts_at_local || ''}${r.ends_at_local ? ' – ' + r.ends_at_local : ''} ${r.timezone}\n${r.body?.[lang] || r.body?.id || ''}\n${r.location_name || ''}${r.map_url ? '\n' + r.map_url : ''}`,
    };
  });
}
export function receiptRows(lines: any[], invoice: any, lang: 'id' | 'en') {
  return [
    ...lines.map((l) => ({
      title: l.description[lang] || l.description.id,
      body: `${l.quantity} × ${money(l.unit_amount)} = ${money(l.amount)}`,
    })),
    { title: lang === 'id' ? 'Diskon' : 'Discount', body: money(invoice.discount) },
    {
      title: lang === 'id' ? 'Dibayar' : 'Paid',
      body: `${money(invoice.total)} · ${date(invoice.paid_at, lang, true)} · ${new Intl.DateTimeFormat(lang === 'id' ? 'id-ID' : 'en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).format(new Date(invoice.paid_at))} WIB`,
    },
  ];
}
