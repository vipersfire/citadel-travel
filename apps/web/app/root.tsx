import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
  isRouteErrorResponse,
  useLoaderData,
  useRouteLoaderData,
  useMatches,
  useLocation,
  data as routeData,
} from 'react-router';
import { randomBytes } from 'node:crypto';
import { useEffect, useState } from 'react';
import cssText from './style.css?inline';
import { BrandMark } from './site-shell';
const fontCSS = `@font-face{font-family:'Libre Caslon Display';font-style:normal;font-weight:400;font-display:swap;src:url('/fonts/font-0.woff2') format('woff2')}@font-face{font-family:'Schibsted Grotesk';font-style:normal;font-weight:400 600;font-display:swap;src:url('/fonts/grotesk-variable-ext.woff2') format('woff2');unicode-range:U+0100-02BA,U+02BD-02FF,U+1D00-1EFF,U+2C60-2C7F,U+A720-A7FF}@font-face{font-family:'Schibsted Grotesk';font-style:normal;font-weight:400 600;font-display:swap;src:url('/fonts/grotesk-variable.woff2') format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}`;
import { serverApi } from './api';
export async function loader({ request }: any) {
  const url = new URL(request.url);
  const publicConfig = await serverApi(request, '/api/public/config');
  const uploadOrigin = publicConfig.upload_origin || '';
  let sentryOrigin = '';
  try {
    if (publicConfig.sentry_dsn) sentryOrigin = new URL(publicConfig.sentry_dsn).origin;
  } catch {}
  const nonce = randomBytes(16).toString('base64');
  const lang = url.pathname.match(/^\/(id|en)(\/|$)/)?.[1] || 'en';
  const path = url.pathname.replace(/^\/(id|en)/, '');
  const csp =
    process.env.NODE_ENV === 'production'
      ? `default-src 'self'; script-src 'self' 'nonce-${nonce}' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; media-src 'self' https:; connect-src 'self' https://challenges.cloudflare.com ${sentryOrigin} ${uploadOrigin}; frame-src https://challenges.cloudflare.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`
      : '';
  return routeData(
    {
      nonce,
      lang,
      path,
      origin: process.env.APP_ORIGIN || url.origin,
      sentryDsn: publicConfig.sentry_dsn,
    },
    { headers: csp ? { 'Content-Security-Policy': csp } : {} },
  );
}
export function headers({ loaderHeaders }: any) {
  return {
    ...Object.fromEntries(loaderHeaders),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'X-Frame-Options': 'DENY',
  };
}
export function links() {
  return [
    {
      rel: 'preload',
      href: '/fonts/font-0.woff2',
      as: 'font',
      type: 'font/woff2',
      crossOrigin: 'anonymous',
    },
    {
      rel: 'preload',
      href: '/fonts/grotesk-variable.woff2',
      as: 'font',
      type: 'font/woff2',
      crossOrigin: 'anonymous',
    },
    { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
  ];
}
export default function App() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const { nonce, lang, path, origin, sentryDsn } = useLoaderData<typeof loader>();
  useEffect(() => {
    if (sentryDsn)
      void import('@sentry/react').then((Sentry) => {
        Sentry.init({
          dsn: sentryDsn,
          beforeSend(event) {
            delete event.user;
            for (const crumb of event.breadcrumbs || [])
              if (crumb.data?.url) crumb.data.url = String(crumb.data.url).split('?')[0];
            if (event.request) {
              delete event.request.data;
              delete event.request.cookies;
              delete event.request.headers;
              if (event.request.url) event.request.url = event.request.url.split('?')[0];
            }
            return event;
          },
        });
      });
  }, [sentryDsn]);
  const matches = useMatches(),
    location = useLocation();
  const localeData = matches.find((match) => match.id === 'routes/locale')?.data as any;
  const currentLang = localeData?.lang || lang;
  const lastData = matches.at(-1)?.data as any;
  const page = lastData?.page || lastData;
  const local = (value: any) =>
    typeof value === 'string' ? value : value?.[currentLang] || value?.id || '';
  const defaultImage = localeData?.catalog?.settings?.find(
    (setting: any) => setting.key === 'default_og_image',
  )?.value;
  const image =
    page?.seo?.image ||
    defaultImage?.url ||
    (typeof defaultImage === 'string' ? defaultImage : '/placeholders/hero.webp');
  const ogTitle = local(page?.seo?.title || page?.title) || 'Citadel Tour Travel';
  const description =
    local(page?.seo?.description || page?.summary) ||
    (currentLang === 'id'
      ? 'Perjalanan olahraga di Eropa, diatur untuk Anda.'
      : 'Sport journeys in Europe, arranged for you.');
  const currentPath = location.pathname.replace(/^\/(id|en)/, '');
  const homeHero = localeData?.catalog?.sections?.find((s: any) => s.kind === 'hero')?.data;
  const isHome = /^\/(id|en)\/?$/.test(location.pathname);
  const avifSet = page?.hero_variants
    ?.filter((v: any) => v.format === 'avif')
    .map((v: any) => `${v.url} ${v.width}w`)
    .join(', ');
  return (
    <html lang={lang} data-citadel-ready={hydrated ? 'true' : 'false'}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {isHome &&
          (homeHero?.poster || localeData?.config?.development) &&
          (!homeHero?.poster ||
            ['/placeholders/hero.webp', '/placeholders/hero-desktop.webp'].includes(
              homeHero.poster,
            )) && (
            <>
              <link
                rel="preload"
                as="image"
                href="/placeholders/hero-mobile.avif"
                media="(max-width:760px)"
                fetchPriority="high"
              />
              <link
                rel="preload"
                as="image"
                href="/placeholders/hero-desktop.avif"
                media="(min-width:761px)"
                fetchPriority="high"
              />
            </>
          )}
        {!isHome && page?.hero_variants && (
          <link
            rel="preload"
            as="image"
            href={page.seo.image}
            imageSrcSet={avifSet}
            imageSizes="(max-width:760px) 100vw, (max-width:1240px) 88vw, 1240px"
            fetchPriority="high"
          />
        )}
        <Meta />
        <link rel="canonical" href={origin + location.pathname} />
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={new URL(image, origin).toString()} />
        <meta property="og:url" content={origin + location.pathname} />
        <meta property="og:locale" content={currentLang === 'id' ? 'id_ID' : 'en_GB'} />
        {!path.startsWith('/admin') && (
          <>
            <link rel="alternate" hrefLang="id" href={`${origin}/id${currentPath}`} />
            <link rel="alternate" hrefLang="en" href={`${origin}/en${currentPath}`} />
            <link rel="alternate" hrefLang="x-default" href={`${origin}/id${currentPath}`} />
          </>
        )}
        <style dangerouslySetInnerHTML={{ __html: fontCSS + cssText }} />
        <Links />
      </head>
      <body>
        <a href="#main" className="skip-link">
          {lang === 'id' ? 'Langsung ke konten' : 'Skip to content'}
        </a>
        <Outlet />
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
      </body>
    </html>
  );
}
export function ErrorBoundary() {
  const e = useRouteError(),
    root = useRouteLoaderData('root') as any;
  useEffect(() => {
    if (root?.sentryDsn && !isRouteErrorResponse(e))
      void import('@sentry/react').then((Sentry) =>
        Sentry.captureException(
          e instanceof Error ? new Error(e.message) : new Error('Unexpected browser error'),
        ),
      );
  }, [e, root?.sentryDsn]);
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <style dangerouslySetInnerHTML={{ __html: fontCSS + cssText }} />
        <Links />
      </head>
      <body>
        <main className="container empty">
          <BrandMark to="/" />
          <h1>
            {isRouteErrorResponse(e)
              ? e.status === 404
                ? 'This journey isn’t here.'
                : 'Unable to load this page.'
              : 'Something went wrong.'}
          </h1>
          <p>{isRouteErrorResponse(e) ? e.data : 'Please try again in a moment.'}</p>
          <a className="button" href="/id">
            Return to Citadel
          </a>
        </main>
        <Scripts nonce={root?.nonce} />
      </body>
    </html>
  );
}
