import { Link, useLoaderData, useParams } from 'react-router';
import { serverApi } from '../api';
import { useLocale, RichText, Steps } from '../components';
import { ResponsiveImage } from '@citadel/ui/media';
import { text } from '@citadel/i18n';
export async function loader({ request, params }: any) {
  const data = await serverApi(request, '/api/public/pages/' + params['*']);
  if (
    !data.page &&
    ![
      'about',
      'how-it-works',
      'faq',
      'contact',
      'legal/terms',
      'legal/privacy',
      'legal/cancellation',
    ].includes(params['*'])
  )
    throw new Response('Page not found', { status: 404 });
  return data;
}
export function meta({ data, params }: any) {
  return [
    {
      title: `${text(data?.page?.seo?.title || data?.page?.title, params.lang) || ({ about: { id: 'Tentang Citadel', en: 'About Citadel' }, 'how-it-works': { id: 'Cara kerjanya', en: 'How it works' }, faq: { id: 'Pertanyaan Anda', en: 'Your questions' }, contact: { id: 'Kontak', en: 'Contact' }, 'legal/terms': { id: 'Syarat dan ketentuan', en: 'Terms' }, 'legal/privacy': { id: 'Privasi', en: 'Privacy' }, 'legal/cancellation': { id: 'Pembatalan', en: 'Cancellation' } } as any)[params['*']]?.[params.lang] || 'Citadel'} · Citadel Tour Travel`,
    },
  ];
}
export default function Page() {
  const { lang, catalog, config } = useLocale(),
    { page, faqs } = useLoaderData<typeof loader>(),
    slug = useParams()['*'];
  const titles: any = {
    about: { id: 'Perhatian pada setiap perjalanan.', en: 'Care in every journey.' },
    'how-it-works': { id: 'Dari rencana hingga perjalanan.', en: 'From an idea to your arrival.' },
    faq: { id: 'Pertanyaan Anda.', en: 'Your questions.' },
    contact: { id: 'Mari berbicara.', en: 'Let’s talk.' },
    'legal/terms': { id: 'Syarat dan ketentuan', en: 'Terms & conditions' },
    'legal/privacy': { id: 'Kebijakan privasi', en: 'Privacy policy' },
    'legal/cancellation': { id: 'Kebijakan pembatalan', en: 'Cancellation policy' },
  };
  const contact = catalog.settings.find((s: any) => s.key === 'contact')?.value || {};
  return (
    <main id="main" className="container static-page">
      <div className="page-heading">
        <h1>
          {page
            ? text(page.title, lang)
            : text(
                titles[slug || ''] || { id: 'Halaman tidak ditemukan', en: 'Page not found' },
                lang,
              )}
        </h1>
      </div>
      {config.development && ['about', 'how-it-works'].includes(slug || '') && (
        <figure className="static-figure">
          <ResponsiveImage
            className="static-image"
            src="/placeholders/family.webp"
            alt={
              lang === 'id'
                ? 'Ilustrasi keluarga menikmati tribun'
                : 'Illustration of a family enjoying the stands'
            }
          />
          <figcaption className="small muted">
            {lang === 'id'
              ? 'Ilustrasi sementara, bukan foto pelanggan.'
              : 'Illustrative placeholder, not a customer photograph.'}
          </figcaption>
        </figure>
      )}
      <div className="static-body">
        {page ? (
          <RichText value={page.body} lang={lang} />
        ) : slug === 'how-it-works' ? (
          <Steps lang={lang} />
        ) : slug === 'about' ? (
          <>
            <p>
              {lang === 'id'
                ? 'Citadel mengatur perjalanan olahraga bagi traveler Indonesia. Dari permintaan hingga keberangkatan, tim kami menangani setiap detail bersama Anda.'
                : 'Citadel arranges sport journeys for Indonesian travelers. From your first request to departure, our team handles every detail with you.'}
            </p>
          </>
        ) : slug === 'contact' ? (
          <>
            <p>{contact.address || 'Jakarta, Indonesia'}</p>
            {contact.email && (
              <p>
                <a href={`mailto:${contact.email}`}>{contact.email}</a>
              </p>
            )}
            {contact.whatsapp && (
              <p>
                <a
                  className="text-link"
                  href={`https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`}
                >
                  {contact.whatsapp} · WhatsApp ↗
                </a>
              </p>
            )}
            <Link className="button" to={`/${lang}/enquire`}>
              {lang === 'id' ? 'Hubungi kami' : 'Send an enquiry'} ↗
            </Link>
          </>
        ) : slug === 'faq' ? (
          <>
            {faqs.length ? (
              faqs.map((f: any) => (
                <details key={f.id}>
                  <summary>{text(f.question, lang)}</summary>
                  <p>{text(f.answer, lang)}</p>
                </details>
              ))
            ) : (
              <p>
                {lang === 'id'
                  ? 'Punya pertanyaan? Tim kami siap membantu.'
                  : 'Have a question? Our team is here to help.'}
              </p>
            )}
            <Link className="text-link" to={`/${lang}/enquire`}>
              {lang === 'id' ? 'Hubungi Citadel' : 'Contact Citadel'} ↗
            </Link>
          </>
        ) : (
          <div className="notice subtle">
            {lang === 'id'
              ? 'Halaman ini menunggu tinjauan dan publikasi Citadel. Hubungi kami untuk kebijakan yang berlaku sebelum mengonfirmasi perjalanan.'
              : 'This page is awaiting Citadel’s review and publication. Contact us for the applicable policy before confirming a journey.'}
          </div>
        )}
      </div>
    </main>
  );
}
