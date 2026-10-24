import { FourStatuses } from '../v2';
import { MemberOffer } from '../member-offer';
import {
  Link,
  data as routeData,
  redirect,
  useLoaderData,
  useLocation,
  useNavigate,
  useRevalidator,
} from 'react-router';
import { useEffect, useState } from 'react';
import { Download, Plus } from 'lucide-react';
import { serverApi, api } from '../api';
import { useLocale, Alert } from '../components';
import { text, date, time, status, dictionaries } from '@citadel/i18n';
import {
  AccountSecurity,
  InlineWhatsApp,
  GroupedDocuments,
  GroupedServices,
} from '../member-tools';
import { TripPass } from '@citadel/ui/trip-pass';
import { Chip, Empty } from '@citadel/ui';
export async function loader({ request, params }: any) {
  const responseHeaders = new Headers();
  const auth = await serverApi(request, '/api/auth/me', responseHeaders);
  if (!auth.user)
    throw redirect(
      `/${params.lang}/sign-in?next=${encodeURIComponent(new URL(request.url).pathname)}`,
    );
  const path = params['*'] || '';
  const [travelers, bookings] = await Promise.all([
    serverApi(request, '/api/me/travelers'),
    serverApi(request, '/api/me/bookings'),
  ]);
  let trip = null,
    pkg = null;
  if (path.startsWith('trips/'))
    trip = await serverApi(request, '/api/me/bookings/' + path.split('/')[1]);
  if (path.startsWith('request/')) {
    pkg = await serverApi(request, '/api/public/packages/' + path.split('/')[1]);
    if (pkg.readiness !== 'ready_to_offer')
      throw redirect(`/${params.lang}/enquire?package=${pkg.slug}`);
  }
  return routeData(
    {
      user: auth.user,
      travelers,
      bookings,
      trip,
      pkg,
      path,
      auth_links: path === 'profile' ? await serverApi(request, '/api/me/auth-links') : null,
    },
    { headers: responseHeaders },
  );
}
export function headers({ parentHeaders, loaderHeaders }: any) {
  return {
    ...Object.fromEntries(parentHeaders),
    ...Object.fromEntries(loaderHeaders),
    'Cache-Control': 'no-store',
  };
}
export function meta({ params }: any) {
  return [
    {
      title:
        params.lang === 'id'
          ? 'Perjalanan Anda · Citadel Tour Travel'
          : 'Your journeys · Citadel Tour Travel',
    },
    { name: 'robots', content: 'noindex, nofollow' },
  ];
}
function TravelerForm({
  traveler,
  onDone,
  lang,
  collectPassport = true,
}: {
  collectPassport?: boolean;
  traveler?: any;
  onDone: () => void;
  lang: string;
}) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const body = {
      given_names: f.get('given_names'),
      surname: f.get('surname'),
      gender: f.get('gender') || null,
      date_of_birth: f.get('date_of_birth') || null,
      nationality: f.get('nationality'),
      passport_number: f.get('passport_number') || undefined,
      passport_expiry: f.get('passport_expiry') || null,
      dietary: f.getAll('dietary'),
      relationship: f.get('relationship') || '',
      medical_notes: f.get('medical_notes') || '',
      is_self: f.get('is_self') === 'on',
    };
    try {
      await api('/api/me/travelers' + (traveler ? '/' + traveler.id : ''), {
        method: traveler ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form method="post" className="panel form-stack" onSubmit={submit}>
      <h3>
        {traveler
          ? lang === 'id'
            ? 'Ubah traveler'
            : 'Edit traveler'
          : lang === 'id'
            ? 'Tambahkan traveler'
            : 'Add a traveler'}
      </h3>
      <Alert message={error} />
      <div className="form-grid">
        <label>
          {lang === 'id' ? 'Nama sesuai paspor' : 'Given names on passport'}
          <input name="given_names" defaultValue={traveler?.given_names} required />
        </label>
        <label>
          {lang === 'id' ? 'Nama belakang' : 'Surname on passport'}
          <input name="surname" defaultValue={traveler?.surname} required />
        </label>
        <label>
          {lang === 'id' ? 'Tanggal lahir' : 'Date of birth'}
          <input
            name="date_of_birth"
            type="date"
            defaultValue={traveler?.date_of_birth?.slice(0, 10)}
          />
        </label>
        <label>
          {lang === 'id' ? 'Kewarganegaraan (kode 2 huruf)' : 'Nationality (2-letter code)'}
          <input
            name="nationality"
            maxLength={2}
            minLength={2}
            defaultValue={traveler?.nationality || 'ID'}
            required
          />
        </label>
        <label>
          {lang === 'id' ? 'Jenis kelamin' : 'Gender'}
          <select name="gender" defaultValue={traveler?.gender || ''}>
            <option value="">—</option>
            <option value="female">{lang === 'id' ? 'Perempuan' : 'Female'}</option>
            <option value="male">{lang === 'id' ? 'Laki-laki' : 'Male'}</option>
            <option value="x">X</option>
          </select>
        </label>
        <label>
          {lang === 'id' ? 'Hubungan' : 'Relationship'}
          <input name="relationship" defaultValue={traveler?.relationship} />
        </label>
        {collectPassport && (
          <>
            {' '}
            <label>
              {lang === 'id' ? 'Nomor paspor' : 'Passport number'}
              <input
                name="passport_number"
                placeholder={
                  traveler?.passport_masked ||
                  (lang === 'id' ? 'Boleh dilengkapi nanti' : 'Optional for now')
                }
                autoComplete="off"
                pattern="[A-Za-z0-9]{5,20}"
              />
              <small>
                {lang === 'id'
                  ? 'Disimpan terenkripsi. Hanya 3 karakter terakhir ditampilkan.'
                  : 'Encrypted at rest. Only the last 3 characters are shown.'}
              </small>
            </label>
            <label>
              {lang === 'id' ? 'Paspor berlaku hingga' : 'Passport expiry'}
              <input
                name="passport_expiry"
                type="date"
                defaultValue={traveler?.passport_expiry?.slice(0, 10)}
              />
            </label>
          </>
        )}
      </div>
      <fieldset>
        <legend>{lang === 'id' ? 'Preferensi makanan' : 'Dietary needs'}</legend>
        <div className="checkbox-row">
          {['halal', 'vegetarian', 'vegan', 'no_pork', 'no_alcohol', 'other'].map((v) => (
            <label key={v} className="checkbox">
              <input
                name="dietary"
                type="checkbox"
                value={v}
                defaultChecked={traveler?.dietary.includes(v)}
              />
              {lang === 'id'
                ? (
                    {
                      halal: 'Halal',
                      vegetarian: 'Vegetarian',
                      vegan: 'Vegan',
                      no_pork: 'Tanpa babi',
                      no_alcohol: 'Tanpa alkohol',
                      other: 'Lainnya',
                    } as Record<string, string>
                  )[v]
                : v.replaceAll('_', ' ')}
            </label>
          ))}
        </div>
      </fieldset>
      <label>
        {lang === 'id' ? 'Catatan medis / mobilitas' : 'Medical / mobility notes'}
        <textarea name="medical_notes" defaultValue={traveler?.medical_notes} />
      </label>
      <label className="checkbox">
        <input type="checkbox" name="is_self" defaultChecked={traveler?.is_self} />
        {lang === 'id' ? 'Ini profil saya' : 'This is my profile'}
      </label>
      <div className="actions">
        <button className="button" disabled={busy}>
          {busy ? '…' : lang === 'id' ? 'Simpan traveler' : 'Save traveler'}
        </button>
        <button type="button" className="button outline" onClick={onDone}>
          {lang === 'id' ? 'Tutup' : 'Close'}
        </button>
      </div>
    </form>
  );
}
export default function Member() {
  const data = useLoaderData<typeof loader>(),
    { lang } = useLocale(),
    d = dictionaries[lang],
    navigate = useNavigate(),
    revalidator = useRevalidator(),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(''),
    [editing, setEditing] = useState<any>(null),
    [adding, setAdding] = useState(false);
  const refresh = () => {
    setAdding(false);
    setEditing(null);
    revalidator.revalidate();
  };
  const path = data.path;
  const nav = [
    ['', d.account],
    ['travelers', d.travelers],
    ['profile', lang === 'id' ? 'Profil' : 'Profile'],
  ];
  useEffect(() => {
    setError('');
    setSaved('');
  }, [path]);
  async function act(url: string, body: any = {}) {
    setError('');
    try {
      await api(url, { method: 'POST', body: JSON.stringify(body) });
      await revalidator.revalidate();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (data.pkg) return <RequestWizard data={data} lang={lang} onRefresh={refresh} />;
  return (
    <main id="main" className="container member-page">
      <div className="member-top">
        <div>
          <span className="section-index">
            {lang === 'id' ? 'Akun Citadel Anda' : 'Your Citadel account'}
          </span>
          <p>
            {lang === 'id' ? 'Selamat datang' : 'Welcome'}, {data.user.full_name.split(' ')[0]}.
          </p>
        </div>
        <button
          className="text-button"
          onClick={async () => {
            await api('/api/auth/sign-out', { method: 'POST' });
            window.location.assign(`/${lang}/sign-in`);
          }}
        >
          {d.logout} ↗
        </button>
      </div>
      <nav
        className="filter-tabs"
        aria-label={lang === 'id' ? 'Navigasi akun' : 'Account navigation'}
      >
        {nav.map(([key, label]) => (
          <Link
            key={key}
            to={`/${lang}/account${key ? '/' + key : ''}`}
            className={path === key ? 'selected' : ''}
            aria-current={path === key ? 'page' : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      <Alert message={error} />
      <Alert message={saved} success />
      {data.trip ? (
        <>
          <TripWorkspace
            trip={data.trip}
            lang={lang}
            tab={path.split('/')[2] || 'overview'}
            onAct={act}
          />
        </>
      ) : path === 'travelers' ? (
        <>
          <div className="section-head">
            <h1>{d.travelers}</h1>
            <button className="button" onClick={() => setAdding(true)}>
              <Plus size={16} />
              {lang === 'id' ? 'Tambah traveler' : 'Add traveler'}
            </button>
          </div>
          {(adding || editing) && <TravelerForm traveler={editing} lang={lang} onDone={refresh} />}
          <div className="stack">
            {data.travelers.map((t: any) => (
              <div className="panel traveler-row" key={t.id}>
                <div>
                  <h3>
                    {t.given_names} {t.surname}
                  </h3>
                  <p className="muted small">
                    {t.passport_masked ||
                      (lang === 'id' ? 'Paspor belum dilengkapi' : 'Passport not supplied')}{' '}
                    · {t.nationality} · {t.dietary.join(', ') || '—'}
                  </p>
                  {t.locked_at && (
                    <span className="small muted">
                      {lang === 'id' ? 'Detail dikontrol admin' : 'Details controlled by admin'}
                    </span>
                  )}
                </div>
                <div className="actions">
                  <button
                    className="text-button"
                    disabled={!!t.locked_at}
                    onClick={() => setEditing(t)}
                  >
                    Edit
                  </button>
                  <button
                    className="text-button"
                    disabled={!!t.locked_at}
                    onClick={async () => {
                      try {
                        await api('/api/me/travelers/' + t.id, { method: 'DELETE' });
                        refresh();
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    {lang === 'id' ? 'Hapus' : 'Remove'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : path === 'profile' ? (
        <div className="profile-panel">
          <h1>{lang === 'id' ? 'Profil Anda' : 'Your profile'}</h1>
          <form
            method="post"
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                await api('/api/me/profile', {
                  method: 'PATCH',
                  body: JSON.stringify({
                    full_name: f.get('full_name'),
                    whatsapp_e164: f.get('whatsapp_e164') || null,
                    locale: f.get('locale'),
                    whatsapp_opt_in: f.get('whatsapp_opt_in') === 'on',
                  }),
                });
                setSaved(lang === 'id' ? 'Profil disimpan.' : 'Profile saved.');
                revalidator.revalidate();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <label>
              {lang === 'id' ? 'Nama lengkap' : 'Full name'}
              <input name="full_name" defaultValue={data.user.full_name} required />
            </label>
            <label>
              Email
              <input value={data.user.email} disabled />
            </label>
            <label>
              WhatsApp
              <input
                name="whatsapp_e164"
                defaultValue={data.user.whatsapp_e164 || ''}
                type="tel"
                placeholder="+628123456789"
              />
            </label>
            <label>
              {lang === 'id' ? 'Bahasa' : 'Language'}
              <select name="locale" defaultValue={data.user.locale}>
                <option value="id">Bahasa Indonesia</option>
                <option value="en">English</option>
              </select>
            </label>
            <label className="checkbox">
              <input
                name="whatsapp_opt_in"
                type="checkbox"
                defaultChecked={data.user.whatsapp_opt_in}
              />
              {lang === 'id' ? 'Pembaruan via WhatsApp' : 'Updates via WhatsApp'}
            </label>
            <button className="button">{d.save}</button>
          </form>
          <hr />
          <AccountSecurity links={data.auth_links} lang={lang} />
          <p>
            <button
              className="text-button"
              onClick={async () => {
                await act('/api/me/delete-account');
                setSaved(
                  lang === 'id'
                    ? 'Permintaan penghapusan diterima. Tim kami akan menghubungi Anda.'
                    : 'Deletion request received. Our team will contact you.',
                );
              }}
            >
              {lang === 'id' ? 'Ajukan penghapusan akun' : 'Request account deletion'}
            </button>
          </p>
        </div>
      ) : (
        <>
          <div className="section-head">
            <h1>{d.account}</h1>
            <Link className="text-link" to={`/${lang}/sport`}>
              {d.season} ↗
            </Link>
          </div>
          {!data.user.email_verified_at && (
            <div className="notice">
              <p>
                {lang === 'id'
                  ? 'Verifikasi email sebelum mengajukan perjalanan.'
                  : 'Verify your email before requesting a journey.'}
              </p>
              <button
                className="text-button"
                onClick={async () => {
                  const r = await api('/api/auth/resend-verification', { method: 'POST' });
                  if (r.development_token)
                    navigate(`/${lang}/verify-email?token=${r.development_token}`);
                  else
                    setSaved(
                      lang === 'id' ? 'Email verifikasi dikirim.' : 'Verification email sent.',
                    );
                }}
              >
                {lang === 'id' ? 'Kirim ulang email verifikasi' : 'Resend verification email'}
              </button>
            </div>
          )}
          {data.bookings.length ? (
            <div className="trip-pass-list">
              {data.bookings.map((b: any) => (
                <Link className="trip-pass" to={`/${lang}/account/trips/${b.code}`} key={b.id}>
                  <div>
                    <span className="small">{b.code}</span>
                    {b.event_name && (
                      <p>
                        {text(b.event_name, lang)} · {status(b.date_status, lang)}
                      </p>
                    )}
                    <h2>{text(b.title, lang)}</h2>
                    <p>
                      {b.start_date
                        ? `${date(b.start_date, lang)} — ${date(b.end_date, lang)}`
                        : lang === 'id'
                          ? 'Kami akan menyarankan tanggal'
                          : 'We’ll suggest your dates'}
                    </p>
                  </div>
                  <div className="trip-pass-stub">
                    <Chip value={b.status} label={status(b.status, lang)} />
                    {b.start_date && (
                      <span>
                        {Math.max(
                          0,
                          Math.ceil((new Date(b.start_date).getTime() - Date.now()) / 86400000),
                        )}{' '}
                        {lang === 'id' ? 'hari menuju keberangkatan' : 'days until departure'}
                      </span>
                    )}
                    <span>{lang === 'id' ? 'Lihat perjalanan' : 'View journey'} ↗</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <Empty
              title={d.noTrips}
              body={lang === 'id' ? 'Pilih momen Anda di Eropa.' : 'Find your moment in Europe.'}
              href={`/${lang}/sport`}
              action={d.explore}
            />
          )}
        </>
      )}
    </main>
  );
}
function RequestWizard({
  data,
  lang,
  onRefresh,
}: {
  data: any;
  lang: 'id' | 'en';
  onRefresh: () => void;
}) {
  const d = dictionaries[lang],
    p = data.pkg,
    navigate = useNavigate(),
    [step, setStep] = useState(1),
    [batch, setBatch] = useState(''),
    [selected, setSelected] = useState<string[]>([]),
    [options, setOptions] = useState<Record<string, string>>({}),
    [addons, setAddons] = useState<string[]>([]),
    [room, setRoom] = useState('twin'),
    [notes, setNotes] = useState(''),
    [adding, setAdding] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const end = p.batches.find((b: any) => b.id === batch)?.end_date;
  function expiryWarn(t: any) {
    if (!end || !t.passport_expiry) return false;
    const minimum = new Date(end);
    minimum.setMonth(minimum.getMonth() + 6);
    return new Date(t.passport_expiry) < minimum;
  }
  async function send() {
    setBusy(true);
    try {
      const b = await api('/api/me/bookings', {
        method: 'POST',
        body: JSON.stringify({
          package_id: p.id,
          preferred_batch_id: batch || null,
          travelers: selected.map((id) => ({
            traveler_id: id,
            package_option_id: options[id] || p.options[0]?.id || null,
          })),
          room_preference: room,
          addons,
          member_notes: notes,
        }),
      });
      navigate(`/${lang}/account/trips/${b.code}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main" className="container wizard">
      <Link className="text-link" to={`/${lang}/trips/${p.slug}`}>
        ← {text(p.title, lang)}
      </Link>
      <h1>{d.request}</h1>
      <div className="wizard-steps">
        {[
          lang === 'id' ? 'Kapan' : 'When',
          lang === 'id' ? 'Siapa' : 'Who',
          lang === 'id' ? 'Preferensi' : 'Preferences',
        ].map((v, i) => (
          <span
            className={step === i + 1 ? 'active' : ''}
            aria-current={step === i + 1 ? 'step' : undefined}
            key={v}
          >
            0{i + 1} · {v}
          </span>
        ))}
      </div>
      <Alert message={error} />
      {!data.user.email_verified_at ? (
        <div className="notice">
          {lang === 'id'
            ? 'Verifikasi email Anda terlebih dahulu.'
            : 'Verify your email before requesting a journey.'}
          <Link to={`/${lang}/account`}> {d.account} ↗</Link>
        </div>
      ) : !data.user.whatsapp_e164 ? (
        <InlineWhatsApp user={data.user} lang={lang} />
      ) : (
        <>
          <div className="panel">
            {step === 1 ? (
              <>
                <h2>
                  {lang === 'id' ? 'Kapan Anda ingin berangkat?' : 'When would you like to travel?'}
                </h2>
                <label className="choice">
                  <input type="radio" checked={batch === ''} onChange={() => setBatch('')} />
                  <div>
                    <strong>
                      {lang === 'id' ? 'Fleksibel, sarankan tanggal' : 'Flexible, suggest dates'}
                    </strong>
                    <p className="muted small">
                      {lang === 'id'
                        ? 'Tim kami akan menyarankan keberangkatan yang sesuai.'
                        : 'Our team will suggest a departure that fits.'}
                    </p>
                  </div>
                </label>
                {p.batches.map((b: any) => {
                  const e = p.events.find((e: any) => e.id === b.event_id);
                  return (
                    <label className="choice" key={b.id}>
                      <input
                        type="radio"
                        checked={batch === b.id}
                        onChange={() => setBatch(b.id)}
                      />
                      <div>
                        <strong>
                          {date(b.start_date, lang)} — {date(b.end_date, lang)}
                        </strong>
                        {e && (
                          <>
                            <p>{text(e.name, lang)}</p>
                            <Chip value={e.date_status} label={status(e.date_status, lang)} />
                          </>
                        )}
                      </div>
                    </label>
                  );
                })}
              </>
            ) : step === 2 ? (
              <>
                <div className="section-head">
                  <h2>{lang === 'id' ? 'Siapa yang ikut?' : 'Who’s coming?'}</h2>
                  <button className="text-button" onClick={() => setAdding(true)}>
                    + {lang === 'id' ? 'Tambah traveler' : 'Add traveler'}
                  </button>
                </div>
                {adding && (
                  <TravelerForm
                    collectPassport={false}
                    lang={lang}
                    onDone={() => {
                      setAdding(false);
                      onRefresh();
                    }}
                  />
                )}
                {data.travelers.map((t: any) => (
                  <div className="choice" key={t.id}>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={selected.includes(t.id)}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [...selected, t.id]
                              : selected.filter((v) => v !== t.id),
                          )
                        }
                      />
                      <span>
                        <strong>
                          {t.given_names} {t.surname}
                        </strong>
                        <br />
                        <small>{t.passport_masked || 'Passport can be supplied later'}</small>
                      </span>
                    </label>
                    {selected.includes(t.id) && (
                      <label className="option-select">
                        {lang === 'id' ? 'Opsi' : 'Option'}
                        <select
                          value={options[t.id] || p.options[0]?.id}
                          onChange={(e) => setOptions({ ...options, [t.id]: e.target.value })}
                        >
                          {p.options.map((o: any) => (
                            <option key={o.id} value={o.id}>
                              {text(o.name, lang)}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {expiryWarn(t) && (
                      <div className="notice small">
                        {lang === 'id'
                          ? 'Paspor berlaku kurang dari 6 bulan setelah perjalanan.'
                          : 'Passport expires less than 6 months after the trip.'}
                      </div>
                    )}
                  </div>
                ))}
              </>
            ) : (
              <>
                <h2>
                  {lang === 'id' ? 'Bagaimana Anda suka bepergian?' : 'How do you like to travel?'}
                </h2>
                <label>
                  {lang === 'id' ? 'Preferensi kamar' : 'Room preference'}
                  <select value={room} onChange={(e) => setRoom(e.target.value)}>
                    <option value="twin">Twin</option>
                    <option value="double">Double</option>
                    <option value="single">Single</option>
                  </select>
                </label>
                <fieldset>
                  <legend>
                    {lang === 'id' ? 'Tambahan yang Anda minati' : 'Add-ons of interest'}
                  </legend>
                  {p.addons.map((a: any) => (
                    <label className="checkbox" key={a.id}>
                      <input
                        type="checkbox"
                        checked={addons.includes(a.id)}
                        onChange={(e) =>
                          setAddons(
                            e.target.checked ? [...addons, a.id] : addons.filter((v) => v !== a.id),
                          )
                        }
                      />
                      {text(a.name, lang)}
                    </label>
                  ))}
                </fieldset>
                <label>
                  {lang === 'id' ? 'Catatan untuk tim kami' : 'A note for our team'}
                  <textarea
                    rows={4}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    maxLength={4000}
                  />
                </label>
                <div className="request-review">
                  <h3>{lang === 'id' ? 'Permintaan Anda' : 'Your request'}</h3>
                  <p>
                    {text(p.title, lang)} · {selected.length}{' '}
                    {lang === 'id' ? 'traveler' : 'travelers'} · {room}
                  </p>
                  <p>
                    {data.travelers
                      .filter((t: any) => selected.includes(t.id))
                      .map((t: any) => `${t.given_names} ${t.surname}`)
                      .join(', ')}
                  </p>
                  <p className="muted small">
                    {lang === 'id'
                      ? 'Ini permintaan penawaran. Tempat belum dikonfirmasi hingga pembayaran diterima.'
                      : 'This is a request for an offer. Your places are confirmed once payment is received.'}
                  </p>
                </div>
              </>
            )}
          </div>
          <div className="actions wizard-actions">
            {step > 1 && (
              <button className="button outline" onClick={() => setStep(step - 1)}>
                {d.back}
              </button>
            )}
            {step < 3 ? (
              <button
                className="button"
                disabled={step === 2 && !selected.length}
                onClick={() => setStep(step + 1)}
              >
                {d.next} →
              </button>
            ) : (
              <button className="button" disabled={busy} onClick={send}>
                {busy ? '…' : d.send} ↗
              </button>
            )}
          </div>
        </>
      )}
    </main>
  );
}
function TripWorkspace({
  trip,
  lang,
  tab,
  onAct,
}: {
  trip: any;
  lang: 'id' | 'en';
  tab: string;
  onAct: (url: string, body?: any) => Promise<void>;
}) {
  const d = dictionaries[lang],
    b = trip.booking,
    batch = trip.batch,
    [error, setError] = useState(''),
    [poll, setPoll] = useState(false),
    revalidator = useRevalidator(),
    location = useLocation();
  useEffect(() => {
    if (!location.search.includes('result=success')) return;
    setPoll(true);
    let ticks = 0;
    const timer = setInterval(() => {
      revalidator.revalidate();
      if (++ticks >= 20) {
        clearInterval(timer);
        setPoll(false);
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [location.search]);
  const countdown = batch?.start_date
    ? Math.max(0, Math.ceil((new Date(batch.start_date).getTime() - Date.now()) / 86400000))
    : null;
  async function pay(id: string) {
    setError('');
    try {
      const r = await api('/api/me/invoices/' + id + '/pay', { method: 'POST' });
      window.location.assign(r.url);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <TripPass className="trip-pass-large" code={b.code} status={b.status}>
        <div>
          <span>{b.code}</span>
          <h1>{text(trip.package.title, lang)}</h1>
          <p>
            {batch
              ? `${date(batch.start_date, lang)} — ${date(batch.end_date, lang)}`
              : lang === 'id'
                ? 'Kami akan menyarankan tanggal'
                : 'We’ll suggest your dates'}
          </p>
          {trip.event && (
            <p className="small">
              {text(trip.event.name, lang)} · {date(trip.event.starts_on, lang)} ·{' '}
              {status(trip.event.date_status, lang)}
            </p>
          )}
        </div>
        <div className="trip-pass-stub">
          <Chip value={b.status} label={status(b.status, lang)} />
          {countdown !== null && (
            <>
              <strong className="countdown">{countdown}</strong>
              <span>{lang === 'id' ? 'hari menuju keberangkatan' : 'days until departure'}</span>
            </>
          )}
        </div>
      </TripPass>
      <nav
        className="filter-tabs trip-tabs"
        aria-label={lang === 'id' ? 'Navigasi perjalanan' : 'Trip navigation'}
      >
        {[
          ['', d.overview],
          ['itinerary', d.itinerary],
          ['documents', d.documents],
          ['travelers', d.travelers],
          ['payments', d.payments],
        ].map(([key, label]) => (
          <Link
            key={key}
            className={(key || 'overview') === tab ? 'selected' : ''}
            aria-current={(key || 'overview') === tab ? 'page' : undefined}
            to={`/${lang}/account/trips/${b.code}${key ? '/' + key : ''}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <Alert message={error} />
      {tab === 'overview' ? (
        <>
          <FourStatuses
            event={trip.event}
            batch={batch}
            invoice={
              trip.invoices.find((i: any) => i.kind === 'package' && i.status !== 'void') || null
            }
            lang={lang}
          />
          <div className="next-panel">
            <span className="section-index">
              {lang === 'id' ? 'Langkah berikutnya' : 'What’s next'}
            </span>
            <h2>{text(trip.next_action?.message, lang)}</h2>
            {trip.next_action?.date && (
              <p>
                {date(trip.next_action.date, lang, true)}
                {trip.next_action.timed ? ' · ' + time(trip.next_action.date, lang) : ''}
              </p>
            )}
            {b.status === 'offered' && (
              <Link className="button" to={`/${lang}/account/trips/${b.code}/payments`}>
                {lang === 'id' ? 'Lihat penawaran' : 'Review your offer'} →
              </Link>
            )}
          </div>
          <div className="timeline">
            {['requested', 'reviewing', 'offered', 'confirmed', 'completed'].map((v, i) => (
              <div
                key={v}
                className={
                  ['requested', 'reviewing', 'offered', 'confirmed', 'completed'].indexOf(
                    b.status,
                  ) >= i
                    ? 'complete'
                    : ''
                }
              >
                <span>{i + 1}</span>
                {status(v, lang)}
              </div>
            ))}
          </div>
          <div className="included-grid">
            <div className="panel">
              <h3>{lang === 'id' ? 'Tour leader Anda' : 'Your tour leader'}</h3>
              <p>
                {batch?.tour_leader_name ||
                  (lang === 'id' ? 'Akan dikonfirmasi' : 'To be confirmed')}
              </p>
              {batch?.tour_leader_whatsapp && (
                <a
                  className="text-link"
                  href={`https://wa.me/${batch.tour_leader_whatsapp.replace(/\D/g, '')}`}
                >
                  WhatsApp ↗
                </a>
              )}
            </div>
            <div className="panel">
              <h3>{lang === 'id' ? 'Titik pertemuan' : 'Meeting point'}</h3>
              <p>
                {text(batch?.meeting_point, lang) ||
                  (lang === 'id'
                    ? 'Akan dipublikasikan sebelum keberangkatan.'
                    : 'Published before departure.')}
              </p>
            </div>
          </div>
          {['requested', 'reviewing', 'waitlisted', 'offered'].includes(b.status) && (
            <details className="cancel-details">
              <summary>{lang === 'id' ? 'Batalkan permintaan' : 'Cancel request'}</summary>
              <form
                method="post"
                className="form-stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  onAct(`/api/me/bookings/${b.code}/cancel`, {
                    reason: new FormData(e.currentTarget).get('reason') || '',
                  });
                }}
              >
                <label>
                  {lang === 'id' ? 'Alasan' : 'Reason'}
                  <textarea name="reason" />
                </label>
                <button className="button outline">
                  {lang === 'id' ? 'Konfirmasi pembatalan' : 'Confirm cancellation'}
                </button>
              </form>
            </details>
          )}
        </>
      ) : tab === 'itinerary' ? (
        <>
          <div className="section-head">
            <h2>{d.itinerary}</h2>
            {trip.itinerary.length > 0 && (
              <a
                className="button outline"
                href={`/api/me/bookings/${b.code}/itinerary.pdf?lang=${lang}`}
              >
                <Download size={16} />
                {lang === 'id' ? 'Unduh itinerary' : 'Download itinerary'}
              </a>
            )}
          </div>
          {trip.itinerary.length ? (
            trip.itinerary.map((item: any) => (
              <div className="itinerary-day" key={item.id}>
                <span className="day-num">
                  {lang === 'id' ? 'Hari' : 'Day'} {item.day_number}
                  {batch && (
                    <small>
                      {date(
                        new Date(
                          new Date(batch.start_date).getTime() + (item.day_number - 1) * 86400000,
                        ).toISOString(),
                        lang,
                      )}
                    </small>
                  )}
                  <br />
                  {item.starts_at_local?.slice(0, 5)}
                  <br />
                  <small>{item.timezone}</small>
                </span>
                <div>
                  <h3>{text(item.title, lang)}</h3>
                  <p>{text(item.body, lang)}</p>
                  <p className="muted small">{item.location_name}</p>
                  {item.map_url && (
                    <a className="text-link" href={item.map_url} target="_blank" rel="noreferrer">
                      {lang === 'id' ? 'Peta' : 'Map'} ↗
                    </a>
                  )}
                </div>
              </div>
            ))
          ) : (
            <Empty
              title={
                lang === 'id' ? 'Hari-hari Anda sedang dirancang.' : 'Your days are being arranged.'
              }
              body={
                lang === 'id'
                  ? 'Itinerary muncul setelah dipublikasikan tim kami.'
                  : 'Your itinerary appears once our team publishes it.'
              }
            />
          )}
        </>
      ) : tab === 'documents' ? (
        <>
          <h2>{d.documents}</h2>
          {trip.documents.length ? (
            <GroupedDocuments trip={trip} lang={lang} />
          ) : (
            <Empty
              title={
                lang === 'id'
                  ? 'Dokumen Anda akan muncul di sini.'
                  : 'Your documents will appear here.'
              }
            />
          )}
          <h2>{lang === 'id' ? 'Pengaturan perjalanan' : 'Your travel arrangements'}</h2>
          <GroupedServices
            trip={trip}
            lang={lang}
            render={(details) => <ServiceDetails details={details} lang={lang} />}
          />
        </>
      ) : tab === 'travelers' ? (
        <>
          <h2>{d.travelers}</h2>
          {trip.travelers.map((t: any) => (
            <div className="panel" key={t.id}>
              <h3>
                {t.given_names} {t.surname}
              </h3>
              <p className="muted">
                {t.passport_masked ||
                  (lang === 'id' ? 'Paspor belum dilengkapi' : 'Passport not supplied')}{' '}
                · {t.dietary.join(', ')}
              </p>
              {t.locked_at && (
                <p className="small muted">
                  {lang === 'id'
                    ? 'Detail dikontrol admin. Hubungi Citadel untuk perubahan.'
                    : 'Details controlled by admin. Contact Citadel for changes.'}
                </p>
              )}
              {trip.visas
                .filter((v: any) => v.traveler_id === t.id)
                .map((v: any) => (
                  <div key={v.id}>
                    <div className="section-head">
                      <h4>Visa · {v.destination}</h4>
                      <Chip value={v.stage} label={status(v.stage, lang)} />
                    </div>
                    {v.appointment_at && (
                      <p>
                        {date(v.appointment_at, lang)} · {time(v.appointment_at, lang)} ·{' '}
                        {v.appointment_location}
                      </p>
                    )}
                    <ul>
                      {v.checklist.map((c: any, i: number) => (
                        <li key={i}>
                          {c.done ? '✓' : '○'} {text(c.label, lang)}
                        </li>
                      ))}
                    </ul>
                    <p>{text(v.member_note, lang)}</p>
                    <p className="small muted">
                      {lang === 'id'
                        ? 'Kirim dokumen visa melalui WhatsApp atau email kepada Citadel.'
                        : 'Send visa documents to Citadel by WhatsApp or email.'}
                    </p>
                  </div>
                ))}
            </div>
          ))}
        </>
      ) : (
        <>
          <h2>{d.payments}</h2>
          {location.search.includes('result=success') &&
            !(new URLSearchParams(location.search).get('invoice')
              ? trip.invoices.find(
                  (i: any) => i.id === new URLSearchParams(location.search).get('invoice'),
                )?.status === 'paid'
              : trip.invoices.some((i: any) => i.status === 'paid')) && (
              <div className="notice subtle">
                {poll
                  ? lang === 'id'
                    ? 'Mengonfirmasi pembayaran Anda…'
                    : 'Confirming your payment…'
                  : lang === 'id'
                    ? 'Pembayaran sedang diverifikasi. Kami akan mengirim pembaruan.'
                    : 'We’re verifying your payment. You’ll receive an update.'}
              </div>
            )}
          {trip.invoices.length ? (
            trip.invoices.map((invoice: any) => (
              <MemberOffer
                key={invoice.id}
                invoice={invoice}
                booking={b}
                payments={trip.payments || []}
                lang={lang}
                onAct={onAct}
                onPay={pay}
              />
            ))
          ) : (
            <Empty
              title={
                lang === 'id'
                  ? 'Penawaran pribadi sedang disiapkan.'
                  : 'Your personal offer is being prepared.'
              }
            />
          )}
        </>
      )}
    </>
  );
}

const serviceLabels: Record<string, [string, string]> = {
  ticket_number: ['Nomor tiket', 'Ticket number'],
  hotel_name: ['Hotel', 'Hotel'],
  address: ['Alamat', 'Address'],
  city: ['Kota', 'City'],
  phone: ['Telepon', 'Phone'],
  website: ['Situs web', 'Website'],
  check_in_date: ['Check-in', 'Check-in'],
  check_out_date: ['Check-out', 'Check-out'],
  room_type: ['Tipe kamar', 'Room type'],
  board: ['Paket makan', 'Meal plan'],
  star_rating: ['Kategori hotel', 'Hotel category'],
  event_id: ['Acara', 'Event'],
  category: ['Kategori', 'Category'],
  section: ['Bagian tribun', 'Section'],
  row: ['Baris', 'Row'],
  seat: ['Kursi', 'Seat'],
  hospitality: ['Hospitality', 'Hospitality'],
  seats_together: ['Kursi berdekatan', 'Seats together'],
  delivery: ['Pengiriman', 'Delivery'],
  pickup_place: ['Penjemputan', 'Pickup'],
  dropoff_place: ['Tujuan', 'Drop-off'],
  pickup_local: ['Waktu penjemputan', 'Pickup time'],
  vehicle: ['Kendaraan', 'Vehicle'],
  driver_name: ['Pengemudi', 'Driver'],
  driver_phone: ['Telepon pengemudi', 'Driver phone'],
  name: ['Nama', 'Name'],
  place: ['Tempat', 'Place'],
  meeting_point: ['Titik pertemuan', 'Meeting point'],
  duration_minutes: ['Durasi (menit)', 'Duration (minutes)'],
  guide_language: ['Bahasa pemandu', 'Guide language'],
  insurer: ['Penyedia asuransi', 'Insurer'],
  policy_number: ['Nomor polis', 'Policy number'],
  coverage_summary: ['Cakupan', 'Coverage'],
  valid_from: ['Berlaku sejak', 'Valid from'],
  valid_to: ['Berlaku hingga', 'Valid to'],
  restaurant: ['Restoran', 'Restaurant'],
  time_local: ['Waktu setempat', 'Local time'],
  halal: ['Halal', 'Halal'],
  dress_code: ['Aturan pakaian', 'Dress code'],
};
function ServiceDetails({ details, lang }: { details: any; lang: 'id' | 'en' }) {
  return (
    <>
      {Object.entries(details).map(([key, value]) =>
        key === 'segments' ? (
          <div key={key}>
            {(value as any[]).map((segment: any, i: number) => (
              <div className="panel" key={i}>
                <h4>
                  {segment.airline} · {segment.flight_no}
                </h4>
                <p>
                  {segment.from_iata} → {segment.to_iata}
                </p>
                <p>
                  {segment.depart_local} ({segment.depart_tz}) — {segment.arrive_local} (
                  {segment.arrive_tz})
                </p>
                <p className="muted small">
                  {segment.cabin} · {segment.baggage}
                </p>
              </div>
            ))}
          </div>
        ) : key === 'fields' ? (
          <div key={key}>
            {(value as any[]).map((field: any, i: number) => (
              <p key={i}>
                {field.label}: {field.value}
              </p>
            ))}
          </div>
        ) : (
          <p key={key}>
            <span className="muted">
              {serviceLabels[key]?.[lang === 'id' ? 0 : 1] || key.replaceAll('_', ' ')}:
            </span>{' '}
            {typeof value === 'boolean'
              ? value
                ? lang === 'id'
                  ? 'Ya'
                  : 'Yes'
                : lang === 'id'
                  ? 'Tidak'
                  : 'No'
              : String(value)}
          </p>
        ),
      )}
    </>
  );
}
