import { useRouteLoaderData, Link } from 'react-router';
import { text, date, status, type Locale } from '@citadel/i18n';
import { FixtureStub } from '@citadel/ui';
import { ResponsiveImage } from '@citadel/ui/media';
import { SportGlyph } from './v2';
import { ArrowUpRight } from 'lucide-react';
export function useLocale() {
  return useRouteLoaderData('routes/locale') as {
    lang: Locale;
    catalog: any;
    user: any;
    config: any;
  };
}
export function EventStub({ event, lang }: { event: any; lang: Locale }) {
  return (
    <FixtureStub
      title={text(event.package_title, lang) || event.city}
      event={text(event.name, lang)}
      meta={[event.competition, event.venue].filter(Boolean).join(' · ')}
      date={date(event.starts_on, lang)}
      status={event.date_status || 'tba'}
      statusLabel={status(event.date_status, lang)}
      href={`/${lang}/trips/${event.slug}`}
      action={
        event.readiness === 'interest_only'
          ? lang === 'id'
            ? 'Saya tertarik'
            : 'I’m interested'
          : lang === 'id'
            ? 'Lihat perjalanan'
            : 'Discover journey'
      }
      image={event.seo?.image}
      previousDate={event.previous_starts_on ? date(event.previous_starts_on, lang) : undefined}
    />
  );
}
export function PackageCard({ pkg, lang }: { pkg: any; lang: Locale }) {
  return (
    <article className="journey-card">
      <Link to={`/${lang}/trips/${pkg.slug}`}>
        <div className="image-frame">
          {pkg.seo?.image ? (
            <ResponsiveImage
              src={pkg.seo.image}
              alt={text(pkg.hero_alt, lang) || text(pkg.title, lang)}
              variants={pkg.hero_variants}
              blur={pkg.hero_blur}
              focalX={pkg.hero_focal_x ?? 50}
              focalY={pkg.hero_focal_y ?? 50}
            />
          ) : (
            <div className="journey-image-empty">
              <SportGlyph sport={pkg.sport} />
            </div>
          )}
          <span className="image-caption">{pkg.cities?.join(' · ')}</span>
        </div>
        <h3>{text(pkg.title, lang)}</h3>
        {pkg.readiness === 'interest_only' && (
          <p className="interest-label">
            {lang === 'id' ? 'Kami sedang menyiapkan perjalanan ini' : 'We are preparing this trip'}
          </p>
        )}
        <p>{text(pkg.subtitle, lang)}</p>
        <span className="text-link">
          {pkg.readiness === 'interest_only'
            ? lang === 'id'
              ? 'Saya tertarik'
              : 'I’m interested'
            : lang === 'id'
              ? 'Temukan perjalanan'
              : 'Discover the journey'}{' '}
          <ArrowUpRight size={16} aria-hidden="true" />
        </span>
      </Link>
    </article>
  );
}
export function Steps({ lang, items }: { lang: Locale; items?: any[] }) {
  const steps =
    Array.isArray(items) && items.length
      ? items.map((i) => [text(i.title, lang), text(i.body, lang)])
      : lang === 'id'
        ? [
            ['Diskusikan', 'Ceritakan minat dan rombongan Anda.'],
            ['Pemeriksaan layanan', 'Kami memeriksa ketersediaan dan cakupan.'],
            ['Penawaran', 'Tinjau dan setujui detail personal Anda.'],
            ['Pembayaran', 'Bayar setelah menyetujui penawaran.'],
            ['Persiapan', 'Ikuti itinerary, layanan dan instruksi tiket.'],
          ]
        : [
            ['Discuss', 'Tell us your interests and party size.'],
            ['Service check', 'We check availability and coverage.'],
            ['Offer', 'Review and approve your personal proposal.'],
            ['Payment', 'Pay after approving your offer.'],
            ['Preparation', 'Follow your itinerary, services and ticket instructions.'],
          ];
  return (
    <ol className="steps">
      {steps.map(([title, body], i) => (
        <li key={title}>
          <span className="step-number" aria-hidden="true">
            {String(i + 1).padStart(2, '0')}
          </span>
          <h3>{title}</h3>
          <p className="muted">{body}</p>
        </li>
      ))}
    </ol>
  );
}
export function Alert({ message, success = false }: { message: string; success?: boolean }) {
  return message ? (
    <div className={success ? 'notice success' : 'notice'} role={success ? 'status' : 'alert'}>
      {message}
    </div>
  ) : null;
}
export function RichText({ value, lang }: { value: any; lang: Locale }) {
  const v = value?.[lang] || value?.id || value;
  if (typeof v === 'string') return <p>{v}</p>;
  function render(node: any, i: number): any {
    if (node?.type === 'text') return node.text;
    if (node?.type === 'paragraph') return <p key={i}>{node.content?.map(render)}</p>;
    if (node?.type === 'heading') return <h3 key={i}>{node.content?.map(render)}</h3>;
    return node?.content?.map(render) || null;
  }
  return <>{render(v, 0)}</>;
}

export function SeoLinks({ lang: _lang, path }: { lang: Locale; path: string }) {
  return (
    <>
      <link rel="alternate" hrefLang="id" href={`/id${path}`} />
      <link rel="alternate" hrefLang="en" href={`/en${path}`} />
      <link rel="alternate" hrefLang="x-default" href={`/id${path}`} />
    </>
  );
}
