import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { SportGlyph } from '../v2';
import { Link } from 'react-router';
import { dictionaries, text } from '@citadel/i18n';
import { useLocale, EventStub, Steps } from '../components';
import { BackgroundVideo } from '../video';
import { MobileActions } from '../site-shell';
export function meta({ params }: any) {
  return [
    { title: 'Citadel Tour Travel · Sports Travel' },
    {
      name: 'description',
      content:
        params.lang === 'id'
          ? 'Perjalanan olahraga Eropa untuk penggemar Indonesia.'
          : 'European sports experiences for Indonesian fans.',
    },
  ];
}
export default function Home() {
  const { lang, catalog, config } = useLocale();
  const d = dictionaries[lang],
    id = lang === 'id';
  const sectionData = (kind: string) => catalog.sections.find((s: any) => s.kind === kind)?.data;
  const section = (kind: string, field: string, fallback: string) =>
    text(sectionData(kind)?.[field], lang) || fallback;
  const hero = sectionData('hero');
  const title = section('hero', 'title', d.hero);
  const whyItems = Array.isArray(sectionData('why')?.items)
    ? sectionData('why').items.map((item: any) => [text(item.title, lang), text(item.body, lang)])
    : [];
  const dated = catalog.events
    .filter((e: any) => e.starts_on)
    .sort((a: any, b: any) => a.starts_on.localeCompare(b.starts_on));
  const months = [...new Set(dated.map((e: any) => e.starts_on.slice(0, 7)))] as string[];
  const tba = catalog.events.filter((e: any) => !e.starts_on);
  const trust = catalog.settings.find((s: any) => s.key === 'trust_line_enabled')?.value === true;
  const sports = [
    [
      'football',
      id ? 'Sepak bola' : 'Football',
      id ? 'Atmosfer tribun. Cerita sebuah kota.' : 'The stands. The city. The matchday.',
    ],
    [
      'tennis',
      id ? 'Tenis' : 'Tennis',
      id ? 'Tanah liat Paris. Rumput London.' : 'Paris clay. London grass.',
    ],
    [
      'motorsport',
      'Motorsport',
      id ? 'Akhir pekan di sekitar sirkuit.' : 'A weekend around the circuit.',
    ],
    [
      'running',
      id ? 'Lari' : 'Running',
      id ? 'Untuk peserta dan penonton.' : 'For participants and spectators.',
    ],
  ];
  return (
    <main id="main" className="home-page">
      <section className="hero" aria-labelledby="hero-title">
        {(hero?.poster || config.development) && (
          <picture className="hero-poster">
            <source
              media="(max-width:760px)"
              srcSet={hero?.mobile_poster || hero?.poster || '/placeholders/hero-mobile.avif'}
            />
            <img
              src={hero?.poster || '/placeholders/hero-desktop.avif'}
              alt=""
              fetchPriority="high"
              width="1800"
              height="1000"
            />
          </picture>
        )}
        {hero?.video && (
          <BackgroundVideo
            src={hero.video}
            mobileSrc={hero.mobile_video}
            poster={hero.poster}
            lang={lang}
          />
        )}
        <div className="hero-shade" />
        <div className="container hero-content">
          <p className="hero-intro">
            {id
              ? 'Perjalanan olahraga Eropa untuk penggemar Indonesia'
              : 'European sports experiences for Indonesian fans'}
          </p>
          <h1 id="hero-title">
            {title === 'Be There When It Matters.' ? (
              <>
                <span className="headline-line">Be There</span>{' '}
                <span className="headline-line">When It Matters.</span>
              </>
            ) : (
              title
            )}
          </h1>
          <p className="hero-description">{section('hero', 'body', d.heroBody)}</p>
          <div className="hero-actions">
            <a className="button paper" href="#sports">
              {d.explore}
              <ArrowRight size={18} aria-hidden="true" />
            </a>
            <Link className="hero-link" to={`/${lang}/enquire`}>
              {id ? 'Diskusikan perjalanan' : 'Plan your journey'}
              <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          </div>
          {trust && (
            <p className="hero-trust">
              {id
                ? 'Berbasis event · Penawaran personal · Portal perjalanan'
                : 'Event led · Personal offers · Your trip portal'}
            </p>
          )}
        </div>
        {(hero?.is_placeholder || (!hero?.poster && config.development)) && (
          <div className="container hero-foot">
            <small>{id ? 'Ilustrasi sementara' : 'Illustrative placeholder'}</small>
          </div>
        )}
      </section>

      <section className="container section why-section" aria-labelledby="why-title">
        <p className="home-introduction">
          {text(hero?.intro, lang) ||
            (id
              ? 'Setiap penggemar punya momen yang ingin disaksikan langsung. Gemuruh tribun ketika rivalitas besar dimulai. Hening sebelum servis penentu. Deru mesin saat balapan berlangsung. Kami merancang perjalanan mengelilingi momen itu, dengan waktu untuk menikmati kota dan orang-orang yang ikut bersama Anda.'
              : 'Every fan has a moment they want to see in person. The roar of the stands as a great rivalry begins. The hush before the deciding serve. The engines as the race gets under way. We design journeys around those moments, with time to enjoy the city and the people travelling with you.')}
        </p>
        <div className="section-head editorial-heading">
          <h2 id="why-title">{section('why', 'title', id ? 'Mengapa Citadel' : 'Why Citadel')}</h2>
          {section('why', 'body', '') && <p>{section('why', 'body', '')}</p>}
        </div>
        <div className="why-facts">
          {(whyItems.length
            ? whyItems
            : id
              ? [
                  [
                    'Penawaran personal',
                    'Tinjau layanan, kategori tiket dan ketentuan sebelum membayar.',
                  ],
                  [
                    'Cakupan perjalanan',
                    'Penginapan, transportasi dan pengalaman dijelaskan per penawaran.',
                  ],
                  [
                    'Portal perjalanan',
                    'Ikuti itinerary, status dan instruksi layanan di akun Anda.',
                  ],
                ]
              : [
                  [
                    'Your personal offer',
                    'Review services, ticket categories and terms before payment.',
                  ],
                  [
                    'Trip coverage',
                    'Accommodation, transfers and experiences are explained per offer.',
                  ],
                  [
                    'Your trip portal',
                    'Follow your itinerary, statuses and service instructions in your account.',
                  ],
                ]
          ).map(([heading, body]: string[]) => (
            <div key={heading}>
              <h3>{heading}</h3>
              <p className="muted">{body}</p>
            </div>
          ))}
        </div>
        {trust && (
          <p className="trust-note">
            {id
              ? 'Kategori tiket, layanan perjalanan, dan ketentuan perubahan dijelaskan sebelum pembayaran.'
              : 'Ticket categories, travel services and change terms are explained before payment.'}
          </p>
        )}
      </section>

      <section className="container section" id="sports" aria-labelledby="sports-title">
        <div className="section-head">
          <h2 id="sports-title">
            {section('sports', 'title', id ? 'Pilih olahraga' : 'Pick a sport')}
          </h2>
          <p className="muted">
            {section(
              'sports',
              'body',
              id
                ? 'Temukan momen Anda. Kami mulai dari olahraga yang Anda sukai.'
                : 'Find your moment. Start with the sport you love.',
            )}
          </p>
        </div>
        <nav className="sport-links" aria-label={id ? 'Pilihan olahraga' : 'Choose a sport'}>
          {sports.map(([key, label, body]) => (
            <Link key={key} to={`/${lang}/sport/${key}`}>
              <SportGlyph sport={key} />
              <span>
                <strong>{label}</strong>
                <small>{body}</small>
              </span>
              <ArrowUpRight className="sport-arrow" size={18} aria-hidden="true" />
            </Link>
          ))}
        </nav>
      </section>

      <section className="container section season" id="season" aria-labelledby="season-title">
        <div className="section-head">
          <h2 id="season-title">{section('season', 'title', d.season)}</h2>
          <p className="muted">
            {section(
              'season',
              'body',
              id
                ? 'Jadwal, alokasi tiket dan keberangkatan dikonfirmasi secara terpisah.'
                : 'Schedules, ticket allocation and departures are confirmed separately.',
            )}
          </p>
        </div>
        <div className="season-list">
          {months.map((month) => (
            <div className="month-group" key={month}>
              <h3 className="month-label">
                {new Intl.DateTimeFormat(id ? 'id-ID' : 'en-GB', {
                  month: 'long',
                  year: 'numeric',
                  timeZone: 'UTC',
                }).format(new Date(month + '-15'))}
              </h3>
              <div className="month-fixtures">
                {dated
                  .filter((e: any) => e.starts_on.startsWith(month))
                  .map((e: any) => (
                    <EventStub key={e.id + e.package_id} event={e} lang={lang} />
                  ))}
              </div>
            </div>
          ))}
          {tba.length > 0 && (
            <div className="month-group tba-group">
              <div className="month-label">
                <h3>{id ? 'Akan diumumkan' : 'To be announced'}</h3>
                <p className="small muted">
                  {id
                    ? 'Tanggal mengikuti verifikasi penyelenggara.'
                    : 'Dates follow organiser verification.'}
                </p>
              </div>
              <div className="month-fixtures">
                {tba.map((e: any) => (
                  <EventStub key={e.id + e.package_id} event={e} lang={lang} />
                ))}
              </div>
            </div>
          )}
        </div>
        {!catalog.events.length && (
          <div className="empty-state">
            <p>
              {id
                ? 'Kami sedang mempersiapkan pengalaman olahraga. Ceritakan acara yang ingin Anda saksikan.'
                : 'We are preparing sport experiences. Tell us the event you would like to attend.'}
            </p>
            <Link className="text-link" to={`/${lang}/enquire`}>
              {id ? 'Diskusikan minat Anda' : 'Discuss your interests'}
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
        )}
      </section>

      <section className="container section beyond-feature" aria-labelledby="beyond-title">
        <div className="beyond-copy">
          <h2 id="beyond-title">{section('beyond', 'title', d.beyond)}</h2>
          <p>
            {section(
              'beyond',
              'body',
              id
                ? 'Kota, makanan dan kegiatan pendamping yang melengkapi perjalanan olahraga Anda.'
                : 'Cities, food and companion activities that complement your sport trip.',
            )}
          </p>
          <p className="muted">
            {id
              ? 'Waktu bersama keluarga. Jalan-jalan setelah pertandingan. Beberapa hari lagi di kota pilihan Anda.'
              : 'Time with family. A walk after the match. A few more days in your chosen city.'}
          </p>
          <Link className="text-link" to={`/${lang}/beyond-the-event`}>
            {id ? 'Jelajahi di luar arena' : 'Explore beyond the event'}
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
        {config.development && (
          <figure className="beyond-visual">
            <img
              src="/placeholders/como.webp"
              alt={
                id
                  ? 'Ilustrasi suasana danau di Italia'
                  : 'Illustrative lakeside atmosphere in Italy'
              }
              loading="lazy"
              width="1200"
              height="900"
            />
            <figcaption>
              {id
                ? 'Waktu di sekitar acara · Ilustrasi sementara'
                : 'Time around the event · Illustrative placeholder'}
            </figcaption>
          </figure>
        )}
      </section>

      <section className="container section" aria-labelledby="booking-title">
        <div className="section-head">
          <h2 id="booking-title">
            {section('how_to_book', 'title', id ? 'Cara memesan' : 'How to book')}
          </h2>
          <p className="muted">
            {section(
              'how_to_book',
              'body',
              id
                ? 'Dari percakapan pertama hingga persiapan keberangkatan.'
                : 'From the first conversation to your departure preparations.',
            )}
          </p>
        </div>
        <Steps lang={lang} items={sectionData('how_to_book')?.items} />
      </section>

      <section className="container section team-section" aria-labelledby="team-title">
        <div className="section-head">
          <h2 id="team-title">
            {section('team', 'title', id ? 'Tim dan bukti' : 'Team and proof')}
          </h2>
          <p className="muted">
            {section(
              'team',
              'body',
              id
                ? 'Kenali orang-orang yang mempersiapkan perjalanan Anda.'
                : 'Meet the people preparing your journey.',
            )}
          </p>
        </div>
        <div className="team-grid">
          {catalog.team?.map((member: any) => (
            <article className="team-member" key={member.name}>
              {member.photo_url && (
                <img
                  src={member.photo_url}
                  alt={member.name}
                  width="480"
                  height="480"
                  loading="lazy"
                />
              )}
              <h3>{member.name}</h3>
              <p className="team-role">{text(member.role, lang)}</p>
              <p className="muted">{text(member.bio, lang)}</p>
            </article>
          ))}
        </div>
        {!catalog.team?.length && (
          <Link className="text-link" to={`/${lang}/about`}>
            {id ? 'Kenali Citadel' : 'About Citadel'}
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        )}
        {catalog.testimonials.map((t: any, index: number) => (
          <figure className="traveler-quote" key={index}>
            <blockquote>{text(t.quote, lang)}</blockquote>
            <figcaption>{t.author_name}</figcaption>
          </figure>
        ))}
      </section>
      <MobileActions
        className="mobile-home-actions"
        label={id ? 'Aksi perjalanan' : 'Journey actions'}
      >
        <Link className="button" to={`/${lang}/sport`}>
          {id ? 'Lihat pengalaman' : 'Explore experiences'}
        </Link>
        <Link className="button outline" to={`/${lang}/enquire`}>
          {id ? 'Hubungi Citadel' : 'Contact Citadel'}
        </Link>
      </MobileActions>
    </main>
  );
}
