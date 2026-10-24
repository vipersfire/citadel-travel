import { serverApi } from '../api';
export async function loader({ request }: any) {
  const data = await serverApi(request, '/api/public/catalog');
  const escape = (s: string) =>
    s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
  const base = new URL(request.url).origin;
  const paths = [
    '',
    'sport',
    'beyond-the-event',
    'about',
    'how-it-works',
    'faq',
    'contact',
    ...data.packages.map((p: any) => 'trips/' + p.slug),
    ...(data.pages || []).map((p: any) => p.slug),
  ];
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['id', 'en'].flatMap((lang) => [...new Set(paths)].map((path) => `<url><loc>${escape(base + '/' + lang + (path ? '/' + path : ''))}</loc></url>`)).join('')}</urlset>`,
    { headers: { 'Content-Type': 'application/xml' } },
  );
}
