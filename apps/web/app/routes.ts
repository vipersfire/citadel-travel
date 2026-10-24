import { type RouteConfig, index, route } from '@react-router/dev/routes';
export default [
  index('routes/index.tsx'),
  route('sitemap.xml', 'routes/sitemap.ts'),
  route('robots.txt', 'routes/robots.ts'),
  route('dev/ui', 'routes/ui-gallery.tsx'),
  route('dev/checkout/:reference', 'routes/checkout.tsx'),
  route('admin/sign-in', 'routes/admin.tsx', { id: 'admin-sign-in' }),
  route('admin/*', 'routes/admin.tsx'),
  route(':lang', 'routes/locale.tsx', [
    index('routes/home.tsx'),
    route('sport/:sport?', 'routes/collection.tsx'),
    route('beyond-the-event', 'routes/beyond-the-event.tsx'),
    route('trips/:slug', 'routes/package.tsx'),
    route('enquire', 'routes/enquire.tsx'),
    route('account/*', 'routes/member.tsx'),
    route('sign-in', 'routes/auth.tsx', { id: 'sign-in' }),
    route('sign-up', 'routes/auth.tsx', { id: 'sign-up' }),
    route('verify-email', 'routes/auth.tsx', { id: 'verify-email' }),
    route('forgot-password', 'routes/auth.tsx', { id: 'forgot-password' }),
    route('reset-password', 'routes/auth.tsx', { id: 'reset-password' }),
    route('*', 'routes/page.tsx'),
  ]),
] satisfies RouteConfig;
