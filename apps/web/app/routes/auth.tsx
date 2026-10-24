import { Link, useLocation, useNavigate, useSearchParams, useRevalidator } from 'react-router';
import { useState, useEffect } from 'react';
import { api } from '../api';
import { useLocale, Alert } from '../components';
import Turnstile from '../turnstile';
export function meta({ params }: any) {
  return [
    {
      title:
        params.lang === 'id'
          ? 'Akun Anda · Citadel Tour Travel'
          : 'Your account · Citadel Tour Travel',
    },
    { name: 'robots', content: 'noindex, nofollow' },
  ];
}
export default function Auth() {
  const { lang, config, catalog } = useLocale(),
    loc = useLocation(),
    [q] = useSearchParams(),
    navigate = useNavigate(),
    revalidator = useRevalidator(),
    mode = loc.pathname.split('/').pop(),
    [error, setError] = useState(''),
    [done, setDone] = useState(false),
    [busy, setBusy] = useState(false),
    [devToken, setDevToken] = useState(''),
    [bot, setBot] = useState('');
  const hero = catalog.sections.find((section: any) => section.kind === 'hero')?.data;
  useEffect(() => {
    setDone(false);
    setError('');
    setDevToken('');
  }, [mode]);
  const next = q.get('next')?.match(/^\/(id|en)\/account(\/|$)/)
    ? q.get('next')!
    : `/${lang}/account`;
  const titles: any = {
    'sign-in': lang === 'id' ? 'Selamat datang kembali.' : 'Welcome back.',
    'sign-up': lang === 'id' ? 'Perjalanan Anda dimulai di sini.' : 'Your journey begins here.',
    'forgot-password': lang === 'id' ? 'Atur ulang kata sandi.' : 'Reset your password.',
    'reset-password': lang === 'id' ? 'Kata sandi baru.' : 'A new password.',
    'verify-email': lang === 'id' ? 'Verifikasi email Anda.' : 'Verify your email.',
  };
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      let result: any;
      if (mode === 'verify-email')
        result = await api('/api/auth/verify-email', {
          method: 'POST',
          body: JSON.stringify({ token: q.get('token') || f.get('token') }),
        });
      else if (mode === 'reset-password')
        result = await api('/api/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({
            token: q.get('token') || f.get('token'),
            password: f.get('password'),
          }),
        });
      else if (mode === 'forgot-password')
        result = await api('/api/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email: f.get('email'), turnstile_token: bot }),
        });
      else if (mode === 'sign-up')
        result = await api('/api/auth/sign-up', {
          method: 'POST',
          body: JSON.stringify({
            full_name: f.get('full_name'),
            email: f.get('email'),
            password: f.get('password'),
            whatsapp_e164: f.get('whatsapp_e164') || undefined,
            locale: lang,
            whatsapp_opt_in: f.get('whatsapp_opt_in') === 'on',
            turnstile_token: bot,
          }),
        });
      else
        result = await api('/api/auth/sign-in', {
          method: 'POST',
          body: JSON.stringify({ email: f.get('email'), password: f.get('password') }),
        });
      await revalidator.revalidate();
      if (result.development_token) setDevToken(result.development_token);
      if (mode === 'sign-in') navigate(result.mfa_required ? '/admin/sign-in' : next);
      else setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main" className="auth-layout">
      <div className="auth-image">
        {(hero?.poster || config.development) && (
          <img
            src={hero?.poster || '/placeholders/london.webp'}
            alt=""
            width="1200"
            height="1600"
          />
        )}
        <div>
          <h2>
            Be There
            <br />
            When It Matters.
          </h2>
          <p>
            {lang === 'id'
              ? 'Citadel Tour Travel · Tribun para member'
              : 'Citadel Tour Travel · The members’ stand'}
          </p>
          {(hero?.is_placeholder || (!hero?.poster && config.development)) && (
            <small className="media-note">
              {lang === 'id' ? 'Ilustrasi sementara' : 'Illustrative placeholder'}
            </small>
          )}
        </div>
      </div>
      <div className="auth-form">
        <span className="section-index">
          {lang === 'id' ? 'Akun Citadel Anda' : 'Your Citadel account'}
        </span>
        <h1>{titles[mode!]}</h1>
        <Alert message={error} />
        {done ? (
          <>
            <Alert
              success
              message={
                mode === 'sign-up'
                  ? lang === 'id'
                    ? 'Akun dibuat. Periksa email Anda untuk verifikasi.'
                    : 'Account created. Check your email to verify your account.'
                  : mode === 'forgot-password'
                    ? lang === 'id'
                      ? 'Jika akun ditemukan, tautan reset telah dikirim.'
                      : 'If an account exists, a reset link has been sent.'
                    : lang === 'id'
                      ? 'Berhasil. Anda dapat melanjutkan.'
                      : 'All done. You can continue.'
              }
            />
            {devToken && (
              <div className="notice subtle">
                <strong>{lang === 'id' ? 'Email development' : 'Development email'}</strong>
                <p>
                  {lang === 'id'
                    ? 'Tautan ditampilkan karena penyedia email dalam mode development.'
                    : 'This link appears here because the email provider is in development mode.'}
                </p>
                <Link
                  className="text-link"
                  to={`/${lang}/${mode === 'forgot-password' ? 'reset-password' : 'verify-email'}?token=${devToken}&next=${encodeURIComponent(next)}`}
                >
                  {lang === 'id' ? 'Buka tautan email' : 'Open email link'} ↗
                </Link>
              </div>
            )}
            <Link className="button" to={mode === 'reset-password' ? `/${lang}/sign-in` : next}>
              {lang === 'id' ? 'Lanjut' : 'Continue'} →
            </Link>
          </>
        ) : (
          <>
            <form method="post" onSubmit={submit} className="form-stack">
              {mode === 'sign-up' && (
                <label>
                  {lang === 'id' ? 'Nama lengkap' : 'Full name'}
                  <input name="full_name" autoComplete="name" required />
                </label>
              )}
              {['sign-in', 'sign-up', 'forgot-password'].includes(mode!) && (
                <label>
                  Email
                  <input name="email" type="email" autoComplete="email" required />
                </label>
              )}
              {['sign-in', 'sign-up', 'reset-password'].includes(mode!) && (
                <label>
                  {lang === 'id' ? 'Kata sandi' : 'Password'}
                  <input
                    name="password"
                    type="password"
                    autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                    required
                    minLength={mode === 'sign-in' ? 1 : 10}
                  />
                  {mode !== 'sign-in' && (
                    <small>
                      {lang === 'id' ? 'Minimal 10 karakter.' : 'At least 10 characters.'}
                    </small>
                  )}
                </label>
              )}
              {['verify-email', 'reset-password'].includes(mode!) && !q.get('token') && (
                <label>
                  Token
                  <input name="token" required />
                </label>
              )}
              {mode === 'sign-up' && (
                <>
                  <label>
                    WhatsApp
                    <input
                      name="whatsapp_e164"
                      type="tel"
                      autoComplete="tel"
                      placeholder="+628123456789"
                      pattern="\+[1-9][0-9]{7,14}"
                      required
                    />
                  </label>
                  <label className="checkbox">
                    <input type="checkbox" name="whatsapp_opt_in" />
                    {lang === 'id'
                      ? 'Kirim pembaruan perjalanan melalui WhatsApp.'
                      : 'Send journey updates on WhatsApp.'}
                  </label>
                </>
              )}
              {['sign-up', 'forgot-password'].includes(mode!) && (
                <Turnstile siteKey={config.turnstile_site_key} onToken={setBot} />
              )}
              <button className="button full" disabled={busy}>
                {busy
                  ? lang === 'id'
                    ? 'Memproses…'
                    : 'Processing…'
                  : mode === 'sign-in'
                    ? lang === 'id'
                      ? 'Masuk'
                      : 'Sign in'
                    : mode === 'sign-up'
                      ? lang === 'id'
                        ? 'Buat akun'
                        : 'Create account'
                      : lang === 'id'
                        ? 'Lanjut'
                        : 'Continue'}{' '}
                →
              </button>
            </form>
            {['sign-in', 'sign-up'].includes(mode!) && (
              <>
                {config.google && (
                  <>
                    <div className="or">{lang === 'id' ? 'atau' : 'or'}</div>
                    <a
                      className="button outline full"
                      href={`/auth/google/start?next=${encodeURIComponent(next)}`}
                    >
                      {lang === 'id' ? 'Lanjut dengan Google' : 'Continue with Google'}
                    </a>
                  </>
                )}
                <p className="small auth-links">
                  {mode === 'sign-in' ? (
                    <>
                      <Link to={`/${lang}/forgot-password`}>
                        {lang === 'id' ? 'Lupa kata sandi?' : 'Forgot password?'}
                      </Link>
                      <br />
                      <Link to={`/${lang}/sign-up?next=${encodeURIComponent(next)}`}>
                        {lang === 'id' ? 'Buat akun Citadel' : 'Create a Citadel account'} ↗
                      </Link>
                    </>
                  ) : (
                    <Link to={`/${lang}/sign-in?next=${encodeURIComponent(next)}`}>
                      {lang === 'id' ? 'Sudah punya akun? Masuk' : 'Already a member? Sign in'} ↗
                    </Link>
                  )}
                </p>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
