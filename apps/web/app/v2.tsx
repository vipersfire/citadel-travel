import { useEffect, useState } from 'react';
import { text, date, status, type Locale } from '@citadel/i18n';
import { api } from './api';
import { Chip } from '@citadel/ui';
import { CalendarDays, Ticket, Plane, Receipt } from 'lucide-react';
export function track(
  name: 'product_view' | 'enquiry_started' | 'whatsapp_click',
  fields: Record<string, any> = {},
) {
  void api('/api/public/events', {
    method: 'POST',
    body: JSON.stringify({ events: [{ name, ...fields }] }),
  }).catch(() => undefined);
}
export function AnalyticsConsent({ lang }: { lang: Locale }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    setShown(!document.cookie.includes('citadel_analytics_consent='));
  }, []);
  function choose(accept: boolean) {
    document.cookie = `citadel_analytics_consent=${accept ? 'accepted' : 'declined'}; Path=/; Max-Age=34128000; SameSite=Lax`;
    if (accept)
      document.cookie = `citadel_anon=${crypto.randomUUID()}; Path=/; Max-Age=34128000; SameSite=Lax`;
    setShown(false);
  }
  return shown ? (
    <aside
      className="analytics-consent"
      aria-label={lang === 'id' ? 'Pilihan analitik' : 'Analytics choice'}
    >
      <p>
        {lang === 'id'
          ? 'Kami menggunakan analitik pihak pertama untuk memahami penggunaan situs. Izinkan ID sesi anonim?'
          : 'We use first-party analytics to understand site use. Allow an anonymous session ID?'}
      </p>
      <button className="button outline" onClick={() => choose(false)}>
        {lang === 'id' ? 'Tanpa ID sesi' : 'Without session ID'}
      </button>
      <button className="button" onClick={() => choose(true)}>
        {lang === 'id' ? 'Izinkan' : 'Allow'}
      </button>
    </aside>
  ) : null;
}
export function FourStatuses({
  event,
  batch,
  invoice,
  lang,
}: {
  event: any;
  batch: any;
  invoice?: any;
  lang: Locale;
}) {
  const id = lang === 'id';
  const departure =
    batch?.status === 'cancelled'
      ? 'cancelled'
      : batch?.departure_confirmed_at
        ? 'departure_confirmed'
        : 'not_confirmed';
  const payment = !invoice
    ? 'no_invoice'
    : invoice.needs_review
      ? 'needs_review'
      : invoice.status === 'issued'
        ? invoice.approval
          ? 'awaiting_payment'
          : 'approval_required'
        : invoice.status;
  const cells = [
    {
      label: id ? 'Jadwal acara' : 'Event schedule',
      Icon: CalendarDays,
      value: status(event?.date_status || 'tba', lang),
      note: event?.starts_on
        ? date(event.starts_on, lang)
        : id
          ? 'Tanggal belum diverifikasi.'
          : 'Date has not been verified.',
    },
    {
      label: id ? 'Alokasi tiket' : 'Ticket allocation',
      Icon: Ticket,
      value:
        batch?.ticket_allocation_status === 'requested'
          ? id
            ? 'Diminta'
            : 'Requested'
          : status(batch?.ticket_allocation_status || 'not_requested', lang),
      note:
        text(batch?.ticket_allocation_note, lang) ||
        (id ? 'Hak akses dicatat terpisah.' : 'Access rights are recorded separately.'),
    },
    {
      label: id ? 'Keberangkatan' : 'Departure',
      Icon: Plane,
      value: status(departure, lang),
      note: batch?.departure_confirmed_at
        ? date(batch.departure_confirmed_at, lang)
        : id
          ? 'Menunggu konfirmasi perjalanan.'
          : 'Awaiting departure confirmation.',
    },
    ...(invoice !== undefined
      ? [
          {
            label: id ? 'Pembayaran' : 'Payment',
            Icon: Receipt,
            value: status(payment, lang),
            note: id
              ? 'Status pembayaran mengikuti invoice Anda.'
              : 'Payment status follows your invoice.',
          },
        ]
      : []),
  ];
  return (
    <dl
      className="four-statuses"
      data-count={cells.length}
      aria-label={id ? 'Status perjalanan' : 'Trip status'}
    >
      {cells.map((c) => (
        <div key={c.label}>
          <dt>
            <c.Icon size={18} aria-hidden="true" />
            {c.label}
          </dt>
          <dd>
            <strong>{c.value}</strong>
            <p className="small muted">{c.note}</p>
          </dd>
        </div>
      ))}
    </dl>
  );
}
export function OfferDetails({ details, lang }: { details: any; lang: Locale }) {
  if (!details) return null;
  const id = lang === 'id';
  const content = (key: string) =>
    Array.isArray(details[key]) ? (
      <ul>
        {details[key].map((value: any, index: number) => (
          <li key={index}>{text(value, lang)}</li>
        ))}
      </ul>
    ) : (
      <p>{text(details[key], lang)}</p>
    );
  return (
    <div className="offer-details">
      {[
        ['services', 'Termasuk', 'What is included'],
        ['exclusions', 'Tidak termasuk', 'What is not included'],
        ['tickets', 'Tiket dan tempat duduk', 'Tickets and seating'],
        ['change_terms', 'Jika jadwal berubah', 'If the schedule changes'],
        ['cancellation_terms', 'Ketentuan pembatalan', 'Cancellation terms'],
      ].map(([k, idTitle, enTitle]) => (
        <section key={k}>
          <h4>{id ? idTitle : enTitle}</h4>
          {k === 'tickets' ? (
            <dl className="ticket-terms">
              <div>
                <dt>{id ? 'Kategori tiket' : 'Ticket category'}</dt>
                <dd>{content('ticket_category')}</dd>
              </div>
              <div>
                <dt>{id ? 'Kebijakan tempat duduk' : 'Seating policy'}</dt>
                <dd>{content('seating_policy')}</dd>
              </div>
            </dl>
          ) : (
            content(k)
          )}
        </section>
      ))}
    </div>
  );
}
export function TicketDelivery({ service, lang }: { service: any; lang: Locale }) {
  const id = lang === 'id';
  const instructions = text(service.delivery_instructions, lang)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return service.delivery_method || service.handover_target_on ? (
    <div className="delivery-card">
      <div className="delivery-heading">
        <strong>
          {service.external_app_name || (id ? 'Penyerahan layanan' : 'Service handover')}
        </strong>
        <Chip
          value={service.handover_status || 'planned'}
          label={status(service.handover_status || 'planned', lang)}
        />
      </div>
      {service.delivery_method === 'external_app' && (
        <p>
          {lang === 'id'
            ? 'Tiket diterima melalui aplikasi resmi.'
            : 'Tickets arrive through the official app.'}
        </p>
      )}
      {instructions.length > 0 && (
        <ol className="delivery-instructions">
          {instructions.map((line, index) => (
            <li key={index}>{line.replace(/^\d+[.)]\s+/, '')}</li>
          ))}
        </ol>
      )}
      {service.handover_target_on && (
        <p className="handover-target">
          {lang === 'id' ? 'Target penyerahan' : 'Handover target'}:{' '}
          {date(service.handover_target_on, lang)}
        </p>
      )}
    </div>
  ) : null;
}

export function SportGlyph({ sport }: { sport: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {sport === 'football' ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="m12 7 5 4-2 6H9l-2-6 5-4Zm0 0V3m5 8 4-2m-6 8 2 3m-8-3-2 3m0-9L3 9" />
        </>
      ) : sport === 'tennis' ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M7 4c6 4 6 12 0 16M17 4c-6 4-6 12 0 16" />
        </>
      ) : sport === 'motorsport' ? (
        <>
          <path d="M5 21V3c4-3 9 3 14 0v11c-5 3-10-3-14 0M5 8c4-3 9 3 14 0M10 3v11m5-9v11" />
        </>
      ) : (
        <>
          <circle cx="15" cy="4" r="2" />
          <path d="m13 8-3 5 4 3 1 5m-5-8-4 6H3m10-11 4 4h4M7 9l4-2 2 1" />
        </>
      )}
    </svg>
  );
}
