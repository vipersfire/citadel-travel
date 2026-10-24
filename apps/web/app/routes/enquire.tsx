import { Link, useSearchParams } from 'react-router';
import { useState, useEffect, useRef } from 'react';
import { ArrowUpRight, Check, Minus, Plus } from 'lucide-react';
import { api } from '../api';
import { useLocale, Alert } from '../components';
import { text } from '@citadel/i18n';
import { track } from '../v2';
import Turnstile from '../turnstile';
export function meta({ params }: any) {
  return [
    {
      title:
        params.lang === 'id'
          ? 'Diskusikan perjalanan · Citadel Tour Travel'
          : 'Plan your journey · Citadel Tour Travel',
    },
  ];
}
export default function Enquire() {
  const { lang, catalog, config, user } = useLocale(),
    [q] = useSearchParams(),
    [error, setError] = useState(''),
    [done, setDone] = useState(false),
    [busy, setBusy] = useState(false),
    [bot, setBot] = useState(''),
    [partySize, setPartySize] = useState('1'),
    [interest, setInterest] = useState(
      catalog.packages.find((p: any) => p.slug === q.get('package'))?.id ||
        (q.get('sport') ? 'sport:' + q.get('sport') : ''),
    );
  const id = lang === 'id';
  const feedback = useRef<HTMLDivElement>(null);
  const contact = catalog.settings.find((setting: any) => setting.key === 'contact')?.value || {};
  const whatsapp = contact.whatsapp ? `https://wa.me/${contact.whatsapp.replace(/\D/g, '')}` : null;
  const pkg = catalog.packages.find((p: any) => p.id === interest);
  const concept = pkg?.readiness === 'interest_only';
  useEffect(() => {
    track('enquiry_started', { locale: lang, path: window.location.pathname });
  }, [lang]);
  useEffect(() => {
    if (done || error) feedback.current?.focus();
  }, [done, error]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const f = new FormData(e.currentTarget);
    try {
      const landing =
        sessionStorage.getItem('citadel_landing') ||
        window.location.pathname + window.location.search;
      const attribution = new URL(landing, window.location.origin).searchParams;
      await api('/api/public/leads', {
        method: 'POST',
        body: JSON.stringify({
          name: f.get('name'),
          whatsapp_e164: f.get('whatsapp_e164'),
          party_size: Number(f.get('party_size')),
          package_id: pkg?.id || null,
          sport: interest.startsWith('sport:') ? interest.slice(6) : undefined,
          interest_kind: concept ? 'concept' : pkg ? 'product' : 'sport',
          email: f.get('email') || undefined,
          preferred_period: f.get('preferred_period') || undefined,
          budget_note: f.get('budget_note') || undefined,
          locale: lang,
          website: f.get('website'),
          turnstile_token: bot,
          landing_path: landing,
          referrer: sessionStorage.getItem('citadel_referrer') || document.referrer,
          ...Object.fromEntries(
            ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].map((k) => [
              k,
              attribution.get(k) || undefined,
            ]),
          ),
        }),
      });
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main" className="container enquiry-layout">
      <div className="page-heading">
        <h1>
          {concept
            ? id
              ? 'Saya tertarik'
              : 'I’m interested'
            : id
              ? 'Diskusikan perjalanan'
              : 'Plan your journey'}
        </h1>
        <p>
          {concept
            ? id
              ? 'Kami sedang menyiapkan perjalanan ini.'
              : 'We are preparing this trip.'
            : id
              ? 'Ceritakan momen yang ingin Anda saksikan.'
              : 'Tell us the moment you want to experience.'}
        </p>
        <div className="enquiry-reassurance">
          <p>
            {id ? 'Tanpa akun. Tanpa paspor dulu.' : 'No account needed. No passport needed yet.'}
          </p>
          <p className="muted">
            {id ? 'Kami membalas dalam 1 hari kerja.' : 'We reply within one business day.'}
          </p>
          {whatsapp && (
            <a className="text-link" href={whatsapp}>
              {id ? 'Tanya via WhatsApp' : 'Ask on WhatsApp'}
              <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
      <div className="enquiry-form">
        <div ref={feedback} tabIndex={-1} className="form-feedback">
          <Alert message={error} />
          {done && (
            <div className="enquiry-success" role="status">
              <Check size={28} aria-hidden="true" />
              <h2>{id ? 'Pesan Anda sudah kami terima.' : 'We have your enquiry.'}</h2>
              <p>
                {id ? 'Kami membalas dalam 1 hari kerja.' : 'We reply within one business day.'}
              </p>
              <p className="muted">
                {id
                  ? 'Tim Citadel akan menghubungi Anda melalui WhatsApp untuk mendiskusikan langkah berikutnya.'
                  : 'The Citadel team will contact you on WhatsApp to discuss the next step.'}
              </p>
              {whatsapp ? (
                <a className="button" href={whatsapp}>
                  {id ? 'Lanjut di WhatsApp' : 'Continue on WhatsApp'}
                  <ArrowUpRight size={16} aria-hidden="true" />
                </a>
              ) : (
                <Link className="button" to={`/${lang}/contact`}>
                  {id ? 'Hubungi Citadel' : 'Contact Citadel'}
                </Link>
              )}
            </div>
          )}
        </div>
        {done ? (
          <Link className="text-link" to={`/${lang}/sport`}>
            {id ? 'Kembali ke pengalaman olahraga' : 'Back to sport experiences'}
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        ) : (
          <form onSubmit={submit} className="form-stack" aria-busy={busy}>
            <label>
              WhatsApp
              <input
                type="tel"
                name="whatsapp_e164"
                autoComplete="tel"
                defaultValue={user?.whatsapp_e164 || '+62'}
                required
                pattern="\+[1-9][0-9]{7,14}"
                aria-describedby="whatsapp-help"
              />
              <small id="whatsapp-help">
                {id
                  ? 'Gunakan kode negara, misalnya +628123456789.'
                  : 'Include your country code, for example +628123456789.'}
              </small>
            </label>
            <label>
              {id ? 'Minat perjalanan' : 'Travel interest'}
              <select
                name="interest"
                value={interest}
                onChange={(e) => setInterest(e.target.value)}
                required
              >
                <option value="">
                  {id ? 'Pilih pengalaman atau olahraga' : 'Choose an experience or sport'}
                </option>
                {catalog.packages.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {text(p.title, lang)}
                  </option>
                ))}
                {[
                  ['football', id ? 'Sepak bola' : 'Football'],
                  ['tennis', id ? 'Tenis' : 'Tennis'],
                  ['motorsport', 'Motorsport'],
                  ['running', id ? 'Lari' : 'Running'],
                ].map(([key, label]) => (
                  <option key={key} value={'sport:' + key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <div className="field">
              <label htmlFor="party-size">{id ? 'Jumlah traveler' : 'Number of travelers'}</label>
              <div className="number-stepper">
                <button
                  type="button"
                  className="icon-button"
                  aria-label={id ? 'Kurangi jumlah traveler' : 'Fewer travelers'}
                  disabled={Number(partySize) <= 1}
                  onClick={() => setPartySize(String(Math.max(1, Number(partySize) - 1)))}
                >
                  <Minus size={18} aria-hidden="true" />
                </button>
                <input
                  id="party-size"
                  name="party_size"
                  type="number"
                  inputMode="numeric"
                  value={partySize}
                  onChange={(e) => setPartySize(e.target.value)}
                  min={1}
                  max={50}
                  step={1}
                  required
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={id ? 'Tambah jumlah traveler' : 'More travelers'}
                  disabled={Number(partySize) >= 50}
                  onClick={() => setPartySize(String(Math.min(50, (Number(partySize) || 1) + 1)))}
                >
                  <Plus size={18} aria-hidden="true" />
                </button>
              </div>
            </div>
            <label>
              {id ? 'Nama' : 'Name'}
              <input
                name="name"
                autoComplete="name"
                defaultValue={user?.full_name}
                required
                minLength={2}
                maxLength={150}
              />
            </label>
            <details className="optional-details">
              <summary>{id ? 'Tambahkan detail (opsional)' : 'Add details (optional)'}</summary>
              <div className="form-stack">
                <label>
                  {id ? 'Waktu perjalanan yang diinginkan' : 'Preferred travel period'}
                  <input
                    name="preferred_period"
                    placeholder={id ? 'Fleksibel' : 'Flexible'}
                    maxLength={500}
                  />
                </label>
                <label>
                  Email
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    defaultValue={user?.email}
                  />
                </label>
                <label>
                  {id ? 'Anggaran' : 'Budget'}
                  <input name="budget_note" maxLength={1000} />
                </label>
              </div>
            </details>
            <div className="honeypot" aria-hidden="true">
              <label>
                Website
                <input name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>
            <Turnstile siteKey={config.turnstile_site_key} onToken={setBot} />
            <button className="button" disabled={busy}>
              {busy
                ? id
                  ? 'Mengirim…'
                  : 'Sending…'
                : concept
                  ? id
                    ? 'Kirim minat'
                    : 'Submit interest'
                  : id
                    ? 'Kirim pertanyaan'
                    : 'Send enquiry'}
            </button>
            <p className="small">
              {id
                ? 'Data Anda digunakan untuk menanggapi pertanyaan ini. '
                : 'Your details are used to respond to this enquiry. '}
              <Link to={`/${lang}/legal/privacy`}>
                {id ? 'Kebijakan privasi' : 'Privacy policy'}
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
