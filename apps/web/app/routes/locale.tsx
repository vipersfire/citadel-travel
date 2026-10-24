import { AnalyticsConsent, track } from '../v2';
import { Outlet, useLoaderData, useLocation, data as routeData } from 'react-router';
import { useEffect } from 'react';
import { SiteHeader, SiteFooter } from '../site-shell';
import { serverApi } from '../api';
import { type Locale } from '@citadel/i18n';
export async function loader({ request, params }: any) {
  if (!['id', 'en'].includes(params.lang)) throw new Response('Page not found', { status: 404 });
  const responseHeaders = new Headers();
  const [catalog, auth, config] = await Promise.all([
    serverApi(request, '/api/public/catalog'),
    serverApi(request, '/api/auth/me', responseHeaders),
    serverApi(request, '/api/public/config'),
  ]);
  return routeData(
    { lang: params.lang as Locale, catalog, user: auth.user, config },
    {
      headers: {
        ...Object.fromEntries(responseHeaders),
        'Cache-Control': auth.user ? 'no-store' : 'public, s-maxage=60, stale-while-revalidate=600',
      },
    },
  );
}
export function headers({ loaderHeaders, parentHeaders }: any) {
  return { ...Object.fromEntries(parentHeaders), ...Object.fromEntries(loaderHeaders) };
}
export function meta({ data }: any) {
  return [
    {
      title:
        data?.lang === 'id'
          ? 'Citadel Tour Travel · Perjalanan Anda'
          : 'Citadel Tour Travel · Your journey',
    },
    {
      name: 'description',
      content:
        data?.lang === 'id'
          ? 'Perjalanan olahraga Eropa untuk penggemar Indonesia.'
          : 'European sports experiences for Indonesian fans.',
    },
  ];
}
export default function LocaleLayout() {
  const { lang, catalog, user } = useLoaderData<typeof loader>();
  const location = useLocation();
  const contact = catalog.settings.find((s: any) => s.key === 'contact')?.value || {};
  useEffect(() => {
    try {
      if (!sessionStorage.getItem('citadel_landing')) {
        sessionStorage.setItem('citadel_landing', location.pathname + location.search);
        sessionStorage.setItem('citadel_referrer', document.referrer);
      }
    } catch {}
    document.documentElement.lang = lang;
    document.cookie = `citadel_lang=${lang}; Path=/; Max-Age=31536000; SameSite=Lax`;
    const handle = (e: MouseEvent) => {
      const a = (e.target as Element)?.closest?.('a');
      if (a?.href.startsWith('https://wa.me/'))
        track('whatsapp_click', { locale: lang, path: location.pathname });
    };
    document.addEventListener('click', handle);
    return () => document.removeEventListener('click', handle);
  }, [lang, location.pathname, location.search]);
  return (
    <div className="locale-layout">
      <SiteHeader lang={lang} user={user} contact={contact} />
      <div className="locale-layout__content">
        <Outlet />
      </div>
      <AnalyticsConsent lang={lang} />
      <SiteFooter lang={lang} contact={contact} />
    </div>
  );
}
