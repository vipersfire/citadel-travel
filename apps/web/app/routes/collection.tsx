import { SportGlyph } from '../v2';
import { Link, useParams } from 'react-router';
import { useLocale, PackageCard, EventStub } from '../components';
export function meta({ params }: any) {
  return [
    {
      title:
        params.lang === 'id'
          ? 'Perjalanan olahraga · Citadel Tour Travel'
          : 'Sport journeys · Citadel Tour Travel',
    },
  ];
}
export default function Collection() {
  const { lang, catalog } = useLocale(),
    { sport } = useParams(),
    id = lang === 'id';
  const sports: Record<string, { name: string; body: string }> = {
    football: {
      name: id ? 'Sepak bola' : 'Football',
      body: id
        ? 'Atmosfer tribun dan waktu untuk menikmati kota, di sekitar pertandingan pilihan Anda.'
        : 'Matchday atmosphere and time for the city, around your chosen fixture.',
    },
    tennis: {
      name: id ? 'Tenis' : 'Tennis',
      body: id
        ? 'Tanah liat Paris atau rumput London. Lapangan, tanggal dan sesi dijelaskan dalam penawaran Anda.'
        : 'Paris clay or London grass. Your court, dates and sessions are explained in your offer.',
    },
    motorsport: {
      name: 'Motorsport',
      body: id
        ? 'Akhir pekan di sekitar sirkuit. Hari akses, kategori tiket dan transfer diperiksa sebelum penawaran.'
        : 'A weekend around the circuit. Access days, ticket categories and transfers are checked before your offer.',
    },
    running: {
      name: id ? 'Lari' : 'Running',
      body: id
        ? 'Perjalanan pekan lomba untuk peserta dan penonton. Hak entri lomba diverifikasi terpisah.'
        : 'A race-week journey for participants and spectators. Race entry rights are verified separately.',
    },
  };
  const current = sport ? sports[sport] : null;
  const items = catalog.packages.filter((p: any) => !sport || p.sport === sport);
  const events = catalog.events
    .filter((e: any) => items.some((p: any) => p.id === e.package_id))
    .sort((a: any, b: any) => (a.starts_on || '9999').localeCompare(b.starts_on || '9999'));
  return (
    <main id="main" className="container collection-page">
      <div className="page-heading sport-heading">
        {current && <SportGlyph sport={sport!} />}
        <h1>{current?.name || (id ? 'Temukan momen Anda.' : 'Find your moment.')}</h1>
        <p className="muted">
          {current?.body ||
            (id
              ? 'Pilih olahraga yang Anda sukai. Jelajahi pengalaman Eropa yang dibangun di sekitar acara pilihan Anda.'
              : 'Start with the sport you love. Explore European journeys built around your chosen event.')}
        </p>
      </div>
      <nav className="filter-tabs" aria-label={id ? 'Pilihan olahraga' : 'Sport filters'}>
        {['', 'football', 'tennis', 'motorsport', 'running'].map((key) => (
          <Link
            key={key}
            className={(sport || '') === key ? 'selected' : ''}
            aria-current={(sport || '') === key ? 'page' : undefined}
            to={`/${lang}/sport${key ? '/' + key : ''}`}
          >
            {key ? sports[key].name : id ? 'Semua olahraga' : 'All sports'}
          </Link>
        ))}
      </nav>
      {sport === 'running' && (
        <nav
          className="participant-paths"
          aria-label={id ? 'Jenis perjalanan lari' : 'Running journey type'}
        >
          <Link to={`/${lang}/enquire?sport=running&path=runner`}>
            <strong>{id ? 'Peserta' : 'Participant'} ↗</strong>
            <span>
              {id
                ? 'Hak entri lomba diperiksa terpisah.'
                : 'Race entry rights are checked separately.'}
            </span>
          </Link>
          <Link to={`/${lang}/enquire?sport=running&path=companion`}>
            <strong>{id ? 'Penonton' : 'Spectator'} ↗</strong>
            <span>
              {id ? 'Pendamping, tanpa entri lomba.' : 'A companion journey, without race entry.'}
            </span>
          </Link>
        </nav>
      )}
      {items.length ? (
        <div className="collection-grid">
          {items.map((p: any) => (
            <PackageCard key={p.id} pkg={p} lang={lang} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>{id ? 'Kami sedang menyiapkan perjalanannya.' : 'The journeys are taking shape.'}</h2>
          <p className="muted">
            {id
              ? 'Ceritakan acara yang Anda minati. Tim kami akan memeriksa pilihan yang sesuai.'
              : 'Tell us the event you have in mind. Our team will check the options that fit.'}
          </p>
          <Link className="button" to={`/${lang}/enquire${sport ? '?sport=' + sport : ''}`}>
            {id ? 'Diskusikan perjalanan' : 'Plan your journey'} ↗
          </Link>
        </div>
      )}
      {events.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>{id ? 'Tanggal untuk dicatat' : 'Dates for your diary'}</h2>
            <p className="muted">
              {id
                ? 'Tanggal yang belum diverifikasi tetap akan diumumkan.'
                : 'Unverified dates stay to be announced.'}
            </p>
          </div>
          <div className="stack">
            {events.map((e: any) => (
              <EventStub key={e.id + e.package_id} event={e} lang={lang} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
