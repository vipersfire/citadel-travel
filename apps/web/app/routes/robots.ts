export async function loader({ request }: any) {
  return new Response(
    `User-agent: *\nDisallow: /admin\nDisallow: /id/account\nDisallow: /en/account\nDisallow: /dev\nSitemap: ${new URL(request.url).origin}/sitemap.xml`,
    { headers: { 'Content-Type': 'text/plain' } },
  );
}
