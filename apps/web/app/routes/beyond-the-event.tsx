import { Link } from 'react-router';
import { useLocale } from '../components';
export function meta() {
  return [{ title: 'Beyond the event · Citadel Tour Travel' }];
}
export default function Beyond() {
  const { lang, config } = useLocale();
  const id = lang === 'id';
  return (
    <main id="main" className="container">
      <div className="page-heading">
        <h1>{lang === 'id' ? 'Di luar arena' : 'Beyond the event'}</h1>
        <p>
          {lang === 'id'
            ? 'Nikmati kota, makanan dan kegiatan pendamping yang melengkapi perjalanan olahraga Anda. Pilihan akhir dijelaskan dalam penawaran personal Anda.'
            : 'Cities, food and companion activities that complement your sport trip. Final arrangements are explained in your personal proposal.'}
        </p>
      </div>
      {config.development && (
        <figure className="static-figure">
          <img
            src="/placeholders/como.webp"
            alt={lang === 'id' ? 'Ilustrasi suasana danau' : 'Illustrative lakeside atmosphere'}
            width="1600"
            height="900"
            className="beyond-image"
          />
          <figcaption className="small muted">
            {id
              ? 'Ilustrasi sementara · Waktu di sekitar acara'
              : 'Illustrative placeholder · Time around the event'}
          </figcaption>
        </figure>
      )}
      <section className="section">
        <h2>
          {lang === 'id' ? 'Waktu bersama, di sekitar acara' : 'Time together, around the event'}
        </h2>
        <p>
          {lang === 'id'
            ? 'Jelajahi Manchester, Paris atau London. Diskusikan waktu bersama keluarga, kegiatan kota atau perpanjangan Milan dan Como untuk akhir pekan Monza.'
            : 'Explore Manchester, Paris or London. Discuss family time, city activities or a Milan and Como extension to the Monza weekend.'}
        </p>
        <div className="why-facts beyond-facts">
          {(id
            ? [
                [
                  'Kenali kotanya',
                  'Diskusikan waktu untuk menjelajahi kota di sekitar jadwal acara.',
                ],
                [
                  'Waktu bersama',
                  'Kegiatan pendamping dapat dibahas bersama keluarga dan rombongan Anda.',
                ],
                [
                  'Tinggal lebih lama',
                  'Perpanjangan perjalanan dan cakupannya dijelaskan dalam penawaran personal Anda.',
                ],
              ]
            : [
                [
                  'Get to know the city',
                  'Discuss time to explore the city around the event schedule.',
                ],
                [
                  'Time together',
                  'Companion activities can be discussed with your family and party.',
                ],
                [
                  'Stay a little longer',
                  'Trip extensions and their coverage are explained in your personal offer.',
                ],
              ]
          ).map(([title, body]) => (
            <div key={title}>
              <h3>{title}</h3>
              <p className="muted">{body}</p>
            </div>
          ))}
        </div>
        <div className="actions">
          <Link className="button" to={`/${lang}/sport`}>
            {lang === 'id' ? 'Lihat pengalaman olahraga' : 'Explore sport experiences'}
          </Link>
          <Link className="text-link" to={`/${lang}/enquire`}>
            {id ? 'Diskusikan perjalanan' : 'Plan your journey'} ↗
          </Link>
        </div>
      </section>
    </main>
  );
}
