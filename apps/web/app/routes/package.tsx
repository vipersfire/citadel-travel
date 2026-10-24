import { useEffect } from 'react';
import { FourStatuses, track } from '../v2';
import { Link, useLoaderData } from 'react-router';
import { serverApi } from '../api';
import { useLocale, RichText, EventStub } from '../components';
import { FixtureStub } from '@citadel/ui';
import { DateWithStatus } from '@citadel/ui/feedback';
import { BackgroundVideo } from '../video';
import { MobileActions } from '../site-shell';
import { ResponsiveImage } from '@citadel/ui/media';
import { text, date, status, dictionaries } from '@citadel/i18n';
export async function loader({ request, params }: any) {
  return serverApi(request, '/api/public/packages/' + params.slug);
}
export function meta({ data, params }: any) {
  return [
    { title: `${text(data?.seo?.title || data?.title, params.lang)} · Citadel Tour Travel` },
    { name: 'description', content: text(data?.seo?.description || data?.summary, params.lang) },
  ];
}
export function headers({ parentHeaders }: any) {
  return Object.fromEntries(parentHeaders);
}
export default function Package() {
  const p = useLoaderData<typeof loader>(),
    { lang, user, config, catalog } = useLocale(),
    d = dictionaries[lang];
  useEffect(() => {
    track('product_view', { package_id: p.id, locale: lang, path: `/${lang}/trips/${p.slug}` });
  }, [p.id, p.slug, lang]);
  const ready = p.readiness === 'ready_to_offer';
  const interest = lang === 'id' ? 'Saya tertarik' : 'I’m interested';
  const target = `/${lang}/account/request/${p.slug}`,
    href = ready
      ? user
        ? target
        : `/${lang}/sign-in?next=${encodeURIComponent(target)}`
      : `/${lang}/enquire?package=${p.slug}`;
  const first = p.events[0],
    dateText = p.batches[0]
      ? `${date(p.batches[0].start_date, lang)} — ${date(p.batches[0].end_date, lang)}`
      : first
        ? date(first.starts_on, lang)
        : lang === 'id'
          ? 'Tanggal fleksibel'
          : 'Flexible dates';
  const asset = p.seo?.image || (config.development ? '/placeholders/como.webp' : '');
  const contact = catalog.settings.find((setting: any) => setting.key === 'contact')?.value || {};
  const contactHref = contact.whatsapp
    ? `https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`
    : `/${lang}/enquire?package=${p.slug}`;
  const contactLabel = contact.whatsapp
    ? lang === 'id'
      ? 'Tanya via WhatsApp'
      : 'Ask on WhatsApp'
    : lang === 'id'
      ? 'Hubungi Citadel'
      : 'Contact Citadel';
  const highlightAssets = [
    asset,
    '/placeholders/' +
      (p.sport === 'tennis'
        ? p.slug === 'wimbledon'
          ? 'london-life'
          : 'paris-life'
        : p.sport === 'running'
          ? 'berlin'
          : p.sport === 'motorsport'
            ? 'como'
            : 'london') +
      '.webp',
    asset,
  ];
  return (
    <main id="main" className="package-page">
      <section className="package-hero">
        {asset && (
          <ResponsiveImage
            className="package-hero-image"
            src={asset}
            alt={text(p.hero_alt, lang) || p.cities.join(', ')}
            variants={p.hero_variants}
            blur={p.hero_blur}
            focalX={p.hero_focal_x ?? 50}
            focalY={p.hero_focal_y ?? 50}
            loading="eager"
          />
        )}
        {p.hero_video && (
          <BackgroundVideo
            src={p.hero_video}
            mobileSrc={p.hero_video_mobile}
            poster={asset}
            lang={lang}
          />
        )}
        <div className="hero-shade" />
        <div className="container package-hero-content">
          <Link className="back-link" to={`/${lang}/sport/${p.sport}`}>
            ← {d.sport}
          </Link>
          <h1>{text(p.title, lang)}</h1>
          <p>{text(p.subtitle, lang)}</p>
          {p.seo?.is_placeholder && (
            <small className="media-note">
              {lang === 'id' ? 'Ilustrasi sementara' : 'Illustrative placeholder'}
            </small>
          )}
        </div>
      </section>
      <section className="container package-fixtures">
        {!ready && (
          <p className="notice">
            {text(p.interest_label, lang) ||
              (lang === 'id'
                ? 'Kami sedang menyiapkan perjalanan ini'
                : 'We are preparing this trip')}
          </p>
        )}
        <div className="stack">
          {p.batches.length
            ? p.batches.map((b: any) => {
                const e = p.events.find((v: any) => v.id === b.event_id);
                return (
                  <article className="batch-offer-card" key={b.id}>
                    <FixtureStub
                      title={text(b.title, lang) || text(p.title, lang)}
                      event={text(e?.name, lang)}
                      meta={e?.venue || p.cities.join(', ')}
                      date={`${date(b.start_date, lang)} — ${date(b.end_date, lang)}`}
                      status={e?.date_status || 'tba'}
                      statusLabel={status(e?.date_status || 'tba', lang)}
                      href={href}
                      action={ready ? d.request : interest}
                    />
                    <FourStatuses event={e} batch={b} lang={lang} />
                  </article>
                );
              })
            : p.events.map((e: any) => (
                <EventStub
                  key={e.id}
                  event={{
                    ...e,
                    slug: p.slug,
                    package_title: p.title,
                    seo: p.seo,
                    readiness: p.readiness,
                  }}
                  lang={lang}
                />
              ))}
        </div>
      </section>
      <div className="container package-layout">
        <div className="package-body">
          <section className="section package-story">
            <h2>{p.cities.join(' · ')}</h2>
            <p>
              {text(p.nights_note, lang) ||
                (p.nights_min
                  ? `${p.nights_min}–${p.nights_max || p.nights_min} ${lang === 'id' ? 'malam' : 'nights'}`
                  : lang === 'id'
                    ? 'Durasi dijelaskan dalam penawaran personal Anda.'
                    : 'Duration is explained in your personal proposal.')}
            </p>
            {(p.proof_points || []).map((point: any) => (
              <p key={point.key}>
                <strong>{text(point.label, lang)}</strong>: {text(point.value, lang)}
              </p>
            ))}
            <RichText value={p.story || p.summary} lang={lang} />
          </section>
          {p.highlights.length > 0 && (
            <section className="section photographed-highlights">
              <h2>{lang === 'id' ? 'Detail perjalanan Anda' : 'Your journey, in detail'}</h2>
              {p.highlights.slice(0, 3).map((h: any, i: number) => (
                <figure className={'editorial-highlight ' + (i % 2 ? 'reverse' : '')} key={i}>
                  <ResponsiveImage
                    src={config.development ? highlightAssets[i] : asset}
                    alt={
                      config.development || p.seo?.is_placeholder
                        ? lang === 'id'
                          ? 'Ilustrasi suasana perjalanan'
                          : 'Illustrative journey atmosphere'
                        : text(p.hero_alt, lang) || p.cities.join(', ')
                    }
                  />
                  <figcaption>
                    <p>{text(h, lang)}</p>
                    {p.seo?.is_placeholder && (
                      <small className="muted">
                        {lang === 'id'
                          ? 'Ilustrasi sementara; detail akhir mengikuti penawaran.'
                          : 'Illustrative placeholder; final details follow your offer.'}
                      </small>
                    )}
                  </figcaption>
                </figure>
              ))}
            </section>
          )}
          <div className="package-reading">
            <section className="section">
              <h2>{lang === 'id' ? 'Contoh itinerary' : 'A sense of your days'}</h2>
              <p className="muted">
                {lang === 'id'
                  ? 'Rencana akhir diberikan setelah detail dikonfirmasi.'
                  : 'Your final itinerary follows confirmed arrangements.'}
              </p>
              {p.itinerary.map((day: any) => (
                <div className="itinerary-day" key={day.id}>
                  <span className="day-num">
                    {lang === 'id' ? 'Hari' : 'Day'} {day.day_number}
                  </span>
                  <div>
                    <h3>{text(day.title, lang)}</h3>
                    <p>{text(day.body, lang)}</p>
                  </div>
                </div>
              ))}
            </section>
            <section className="section included-grid">
              <div>
                <h3>{lang === 'id' ? 'Termasuk' : 'Included'}</h3>
                <ul>
                  {p.inclusions.map((v: any, i: number) => (
                    <li key={i}>{text(v, lang)}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>{lang === 'id' ? 'Tidak termasuk' : 'Not included'}</h3>
                <ul>
                  {p.exclusions.map((v: any, i: number) => (
                    <li key={i}>{text(v, lang)}</li>
                  ))}
                </ul>
              </div>
            </section>
            <section className="section">
              <h2>
                {lang === 'id' ? 'Penginapan dan pilihan Anda' : 'Your stay and your choices'}
              </h2>
              <p>{text(p.hotel_style, lang)}</p>
              <h3>{lang === 'id' ? 'Tambahkan sentuhan pribadi' : 'A personal touch'}</h3>
              <div className="tags">
                {p.addons.map((a: any) => (
                  <span key={a.id}>{text(a.name, lang)}</span>
                ))}
              </div>
              <h3>Visa</h3>
              <p>{text(p.visa_note, lang)}</p>
            </section>
            {p.faqs.length > 0 && (
              <section className="section">
                <h2>{lang === 'id' ? 'Pertanyaan Anda' : 'Your questions'}</h2>
                {p.faqs.map((f: any) => (
                  <details key={f.id}>
                    <summary>{text(f.question, lang)}</summary>
                    <p>{text(f.answer, lang)}</p>
                  </details>
                ))}
              </section>
            )}
            <section className="closing-cta">
              <div>
                <h2>{text(p.title, lang)}</h2>
                <p>
                  {lang === 'id' ? 'Mari susun perjalanan Anda.' : 'Let’s arrange your journey.'}
                </p>
              </div>
              <div className="stack">
                <Link className="button" to={href}>
                  {ready ? d.request : interest} ↗
                </Link>
                <a className="text-link" href={contactHref}>
                  {contactLabel} ↗
                </a>
              </div>
            </section>
          </div>
        </div>
        <aside className="request-panel">
          <div className="request-ticket">
            <h3>{text(p.title, lang)}</h3>
            <DateWithStatus
              date={dateText}
              status={first?.date_status || 'tba'}
              label={status(first?.date_status || 'tba', lang)}
              previousDate={
                first?.previous_starts_on ? date(first.previous_starts_on, lang) : undefined
              }
            />
            <p className="muted">
              {lang === 'id'
                ? 'Penawaran pribadi untuk rombongan Anda.'
                : 'A personal offer for your party.'}
            </p>
            <div className="ticket-seam" />
            <Link className="button full" to={href}>
              {ready ? d.request : interest} ↗
            </Link>
            <a className="text-link" href={contactHref}>
              {contactLabel} ↗
            </a>
          </div>
        </aside>
      </div>
      <MobileActions
        className="mobile-request"
        label={lang === 'id' ? 'Ajukan perjalanan' : 'Request a journey'}
      >
        <DateWithStatus
          date={dateText}
          status={first?.date_status || 'tba'}
          label={status(first?.date_status || 'tba', lang)}
        />
        <Link className="button" to={href}>
          {ready ? d.request : interest} ↗
        </Link>
      </MobileActions>
    </main>
  );
}
