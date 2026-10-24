import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowUpRight, Check, Download } from 'lucide-react';
import { Chip } from '@citadel/ui';
import { date, money, status, text, type Locale } from '@citadel/i18n';
import { Alert } from './components';
import { OfferDetails } from './v2';

export function MemberOffer({
  invoice: i,
  booking,
  payments,
  lang,
  onAct,
  onPay,
}: {
  invoice: any;
  booking: any;
  payments: any[];
  lang: Locale;
  onAct: (url: string, body?: any) => Promise<void>;
  onPay: (id: string) => Promise<void>;
}) {
  const id = lang === 'id';
  const [busy, setBusy] = useState(false);
  const snapshot = i.approval?.snapshot || i.offer_snapshot || i.offer_details;
  const actionable = i.status === 'issued' && !i.needs_review;
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className="panel invoice" aria-label={`${id ? 'Penawaran' : 'Offer'} ${i.number}`}>
      <header className="section-head invoice-heading">
        <div>
          <span className="section-index">
            {id ? 'Penawaran personal Anda' : 'Your personal offer'} · {id ? 'Versi' : 'Version'}{' '}
            {i.offer_version}
          </span>
          <h3>{i.number}</h3>
        </div>
        <Chip
          value={i.status}
          label={
            i.status === 'issued'
              ? !i.approval
                ? id
                  ? 'Penawaran untuk disetujui'
                  : 'Offer to approve'
                : id
                  ? 'Menunggu pembayaran'
                  : 'Awaiting payment'
              : status(i.status, lang)
          }
        />
      </header>
      {i.offer_version > 1 && !i.approval && actionable && (
        <div className="notice subtle" role="status">
          {id
            ? 'Penawaran diperbarui. Tinjau dan setujui kembali.'
            : 'The offer was updated. Please review and approve again.'}
        </div>
      )}
      {i.needs_review && (
        <Alert
          message={
            id
              ? 'Pembayaran memerlukan peninjauan. Tim kami akan menghubungi Anda.'
              : 'Payment needs review. Our team will contact you.'
          }
        />
      )}
      <div className="offer-review-layout">
        <div className="invoice-summary">
          <h4>{id ? 'Ringkasan penawaran' : 'Offer summary'}</h4>
          <dl className="invoice-lines">
            {i.lines.map((line: any) => (
              <div className="invoice-line" key={line.id}>
                <dt>
                  {text(line.description, lang)} <small className="muted">× {line.quantity}</small>
                </dt>
                <dd>{money(line.amount)}</dd>
              </div>
            ))}
            {Number(i.discount) > 0 && (
              <div className="invoice-line">
                <dt>{id ? 'Diskon' : 'Discount'}</dt>
                <dd>−{money(i.discount)}</dd>
              </div>
            )}
          </dl>
          <div className="invoice-total">
            <span>Total</span>
            <strong>{money(i.total)}</strong>
          </div>
          <p className="payment-deadline">
            {id ? 'Bayar sebelum' : 'Pay by'} {date(i.due_at, lang, true)} ·{' '}
            {new Intl.DateTimeFormat(id ? 'id-ID' : 'en-GB', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'Asia/Jakarta',
            }).format(new Date(i.due_at))}{' '}
            WIB
          </p>
          {text(i.note, lang) && <p className="muted">{text(i.note, lang)}</p>}
          {snapshot?.event && (
            <p className="offer-event small">
              {text(snapshot.event.name, lang)}
              <br />
              {date(snapshot.event.starts_on, lang)} ·{' '}
              {status(snapshot.event.date_status || 'tba', lang)}
            </p>
          )}
        </div>
        <OfferDetails details={snapshot} lang={lang} />
      </div>
      {i.approval && (
        <details className="approved-snapshot">
          <summary>
            <Check size={18} aria-hidden="true" />
            {id ? 'Apa yang Anda setujui' : 'What you approved'}
          </summary>
          <div className="snapshot-content">
            <p className="small muted">
              {date(i.approval.approved_at, lang)} · {id ? 'Versi' : 'Version'}{' '}
              {i.approval.offer_version}
            </p>
            <OfferDetails details={i.approval.snapshot} lang={i.approval.locale} />
            <p>
              {text(i.approval.snapshot.event?.name, lang)} ·{' '}
              {date(i.approval.snapshot.event?.starts_on, lang)} ·{' '}
              {status(i.approval.snapshot.event?.date_status || 'tba', lang)}
            </p>
            <p>
              {money(i.approval.snapshot.total)} · {date(i.approval.snapshot.due_at, lang, true)}
            </p>
            {(i.approval.snapshot.lines || []).map((line: any, index: number) => (
              <p key={index}>
                {text(line.description, lang)} × {line.quantity} · {money(line.amount)}
              </p>
            ))}
          </div>
        </details>
      )}
      {actionable && (
        <div className="offer-approval-actions" aria-busy={busy}>
          <div>
            <h4>
              {i.approval
                ? id
                  ? 'Penawaran telah disetujui.'
                  : 'Your offer is approved.'
                : id
                  ? 'Tinjau setiap detail sebelum menyetujui.'
                  : 'Review every detail before approving.'}
            </h4>
            <p className="small muted">
              {i.approval
                ? id
                  ? 'Lanjutkan ke pembayaran untuk mengonfirmasi pemesanan Anda.'
                  : 'Continue to payment to confirm your booking.'
                : id
                  ? 'Persetujuan Anda menyimpan layanan, tiket dan ketentuan dalam versi ini.'
                  : 'Your approval records the services, tickets and terms in this version.'}
            </p>
            <p className="small">
              <Link className="inline-link" to={`/${lang}/legal/terms`}>
                {id ? 'Syarat' : 'Terms'}
              </Link>{' '}
              ·{' '}
              <Link className="inline-link" to={`/${lang}/legal/cancellation`}>
                {id ? 'Kebijakan pembatalan' : 'Cancellation policy'}
              </Link>
            </p>
          </div>
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={() =>
              run(() =>
                i.approval
                  ? onPay(i.id)
                  : onAct(`/api/me/invoices/${i.id}/approve`, {
                      locale: lang,
                      offer_version: i.offer_version,
                    }),
              )
            }
          >
            {busy ? (
              id ? (
                'Memproses…'
              ) : (
                'Processing…'
              )
            ) : i.approval ? (
              <>
                {id ? 'Bayar' : 'Pay'} {money(i.total)}
                <ArrowUpRight size={16} aria-hidden="true" />
              </>
            ) : id ? (
              'Setujui penawaran'
            ) : (
              'Approve offer'
            )}
          </button>
        </div>
      )}
      {actionable && i.kind === 'package' && booking.status === 'offered' && (
        <details className="decline-offer">
          <summary>{id ? 'Tolak penawaran' : 'Decline offer'}</summary>
          <form
            className="form-stack"
            method="post"
            onSubmit={(event) => {
              event.preventDefault();
              const reason = new FormData(event.currentTarget).get('reason');
              void run(() => onAct(`/api/me/bookings/${booking.code}/decline-offer`, { reason }));
            }}
          >
            <label>
              {id ? 'Alasan' : 'Reason'}
              <textarea name="reason" required />
            </label>
            <button className="button outline" disabled={busy}>
              {id ? 'Konfirmasi penolakan' : 'Confirm decline'}
            </button>
          </form>
        </details>
      )}
      {i.needs_review &&
        payments
          .filter((payment) => payment.invoice_id === i.id)
          .map((payment) => (
            <a
              key={payment.id}
              className="button outline"
              href={`/api/me/payments/${payment.id}/receipt.pdf?lang=${lang}`}
            >
              {id ? 'Unduh bukti penerimaan pembayaran' : 'Download payment acknowledgment'}
            </a>
          ))}
      {i.status === 'paid' && (
        <a className="button outline" href={`/api/me/invoices/${i.id}/receipt.pdf?lang=${lang}`}>
          <Download size={16} aria-hidden="true" />
          {id ? 'Unduh kuitansi' : 'Download receipt'}
        </a>
      )}
    </article>
  );
}
