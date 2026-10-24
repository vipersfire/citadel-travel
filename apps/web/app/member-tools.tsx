import { TicketDelivery } from './v2';
import { useState } from 'react';
import { useRevalidator } from 'react-router';
import { Button, Field, Chip } from '@citadel/ui';
import { useForm, zodResolver } from '@citadel/ui/forms';
import { changePasswordSchema } from '@citadel/contracts';
import { api } from './api';
import { text, date, status } from '@citadel/i18n';
import { Plane, Hotel, Ticket, Car, Shield, FileText, Download } from 'lucide-react';
export function AccountSecurity({ links, lang }: { links: any; lang: 'id' | 'en' }) {
  const [message, setMessage] = useState('');
  const form = useForm({ resolver: zodResolver(changePasswordSchema) });
  return (
    <section className="form-stack">
      <h2>{lang === 'id' ? 'Keamanan akun' : 'Account security'}</h2>
      <form
        className="form-stack"
        onSubmit={form.handleSubmit(async (body) => {
          try {
            await api('/api/me/change-password', { method: 'POST', body: JSON.stringify(body) });
            setMessage(
              lang === 'id'
                ? 'Kata sandi diperbarui. Sesi lain telah diakhiri.'
                : 'Password updated. Other sessions were signed out.',
            );
            form.reset();
          } catch (e) {
            setMessage((e as Error).message);
          }
        })}
      >
        {links.has_password && (
          <Field label={lang === 'id' ? 'Kata sandi saat ini' : 'Current password'}>
            <input
              type="password"
              autoComplete="current-password"
              {...form.register('current_password')}
            />
          </Field>
        )}
        <Field
          label={lang === 'id' ? 'Kata sandi baru' : 'New password'}
          error={form.formState.errors.password?.message}
        >
          <input type="password" autoComplete="new-password" {...form.register('password')} />
        </Field>
        <Button type="submit">{lang === 'id' ? 'Ubah kata sandi' : 'Change password'}</Button>
      </form>
      {message && <p role="status">{message}</p>}
      <h3>Google</h3>
      {links.links.length ? (
        <p>
          {lang === 'id' ? 'Terhubung:' : 'Linked:'} {links.links[0].email}
        </p>
      ) : links.google_enabled ? (
        <a
          className="text-link"
          href={`/auth/google/start?link=true&next=/${lang}/account/profile`}
        >
          {lang === 'id'
            ? 'Hubungkan akun Google dengan email yang sama'
            : 'Link Google using the same email'}{' '}
          ↗
        </a>
      ) : (
        <p className="muted">
          {lang === 'id' ? 'Masuk dengan email tersedia.' : 'Email sign-in is available.'}
        </p>
      )}
    </section>
  );
}
export function InlineWhatsApp({ user, lang }: { user: any; lang: 'id' | 'en' }) {
  const revalidator = useRevalidator(),
    [error, setError] = useState('');
  return (
    <form
      className="panel form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        try {
          await api('/api/me/profile', {
            method: 'PATCH',
            body: JSON.stringify({
              full_name: user.full_name,
              locale: user.locale,
              whatsapp_e164: f.get('phone'),
              whatsapp_opt_in: f.get('opt_in') === 'on',
            }),
          });
          revalidator.revalidate();
        } catch (e) {
          setError((e as Error).message);
        }
      }}
    >
      <h2>{lang === 'id' ? 'Nomor untuk perjalanan Anda' : 'A number for your journey'}</h2>
      <Field
        label="WhatsApp"
        help={
          lang === 'id'
            ? 'Gunakan format internasional, misalnya +628123456789.'
            : 'Use international format, for example +628123456789.'
        }
      >
        <input name="phone" type="tel" autoComplete="tel" required pattern="\+[1-9][0-9]{7,14}" />
      </Field>
      <label className="checkbox">
        <input name="opt_in" type="checkbox" />
        {lang === 'id'
          ? 'Saya ingin menerima pembaruan melalui WhatsApp.'
          : 'I would like journey updates on WhatsApp.'}
      </label>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      <Button type="submit">{lang === 'id' ? 'Simpan dan lanjutkan' : 'Save and continue'}</Button>
    </form>
  );
}
const typeIcons: Record<string, any> = {
  flight_ticket: Plane,
  hotel_voucher: Hotel,
  event_ticket: Ticket,
  transfer_voucher: Car,
  insurance: Shield,
  other: FileText,
  itinerary: FileText,
};
const typeNames: Record<string, { id: string; en: string }> = {
  flight_ticket: { id: 'Tiket penerbangan', en: 'Flight tickets' },
  hotel_voucher: { id: 'Voucher hotel', en: 'Hotel vouchers' },
  event_ticket: { id: 'Tiket acara', en: 'Event tickets' },
  transfer_voucher: { id: 'Voucher transfer', en: 'Transfer vouchers' },
  insurance: { id: 'Asuransi', en: 'Insurance' },
  other: { id: 'Dokumen lain', en: 'Other documents' },
  itinerary: { id: 'Itinerary', en: 'Itinerary' },
};
export function GroupedDocuments({ trip, lang }: { trip: any; lang: 'id' | 'en' }) {
  const owners = [null, ...trip.travelers.map((t: any) => t.id)];
  return (
    <>
      {owners.map((owner) => {
        const documents = trip.documents.filter((d: any) => (d.traveler_id || null) === owner),
          t = trip.travelers.find((t: any) => t.id === owner);
        if (!documents.length) return null;
        return (
          <section className="grouped-documents" key={owner || 'party'}>
            <h3>
              {t
                ? `${t.given_names} ${t.surname}`
                : lang === 'id'
                  ? 'Rombongan Anda'
                  : 'Your party'}
            </h3>
            {Object.keys(typeNames).map((type) => {
              const list = documents.filter((d: any) => d.type === type);
              if (!list.length) return null;
              const Icon = typeIcons[type] || FileText;
              return (
                <div key={type}>
                  <h4>{text(typeNames[type], lang)}</h4>
                  {list.map((doc: any) => (
                    <div className="document-row" key={doc.id}>
                      <Icon size={24} aria-hidden />
                      <div>
                        <strong>{text(doc.title, lang) || doc.filename}</strong>
                        <p className="muted small">{date(doc.published_at, lang)}</p>
                      </div>
                      <a className="button outline" href={`/api/me/documents/${doc.id}/download`}>
                        <Download size={16} />
                        {lang === 'id' ? 'Unduh' : 'Download'}
                      </a>
                    </div>
                  ))}
                </div>
              );
            })}
          </section>
        );
      })}
    </>
  );
}
export function GroupedServices({
  trip,
  lang,
  render,
}: {
  trip: any;
  lang: 'id' | 'en';
  render: (details: any) => React.ReactNode;
}) {
  return (
    <>
      {[null, ...trip.travelers.map((t: any) => t.id)].map((owner) => {
        const records = trip.services.filter((s: any) => (s.traveler_id || null) === owner),
          t = trip.travelers.find((t: any) => t.id === owner);
        if (!records.length) return null;
        return (
          <section className="grouped-documents" key={owner || 'party'}>
            <h3>
              {t
                ? `${t.given_names} ${t.surname}`
                : lang === 'id'
                  ? 'Rombongan Anda'
                  : 'Your party'}
            </h3>
            {records.map((s: any) => (
              <article className="panel service-card" key={s.id}>
                <div className="section-head">
                  <h4>{text(s.title, lang) || s.type}</h4>
                  <Chip
                    value={s.status}
                    label={
                      ['not_started', 'requested', 'pending_allocation'].includes(s.status)
                        ? lang === 'id'
                          ? 'Sedang diatur'
                          : 'Being arranged'
                        : status(s.status, lang)
                    }
                  />
                </div>
                <p>{text(s.member_note, lang)}</p>
                {s.confirmation_ref && (
                  <p>
                    {lang === 'id' ? 'Referensi konfirmasi' : 'Confirmation reference'}:{' '}
                    {s.confirmation_ref}
                  </p>
                )}
                {render(s.details)}
                <TicketDelivery service={s} lang={lang} />
              </article>
            ))}
          </section>
        );
      })}
    </>
  );
}
