import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const state = vi.hoisted(() => ({
  lang: 'en',
  development: true,
  pkg: null as any,
  catalog: null as any,
}));
vi.mock('../app/components', async (original) => ({
  ...(await original<any>()),
  useLocale: () => ({
    lang: state.lang,
    catalog: state.catalog,
    config: { development: state.development },
    user: null,
  }),
}));
vi.mock('react-router', async (original) => ({
  ...(await original<any>()),
  useLoaderData: () => state.pkg,
}));
import { MemoryRouter, Routes, Route, createMemoryRouter, RouterProvider } from 'react-router';
import Home from '../app/routes/home';
import Enquire from '../app/routes/enquire';
import Package from '../app/routes/package';
import Auth from '../app/routes/auth';
import Collection from '../app/routes/collection';
import Page from '../app/routes/page';
import { FourStatuses } from '../app/v2';
const render = (component: any, props: any = {}) =>
  renderToStaticMarkup(createElement(MemoryRouter, null, createElement(component, props)));
function setup() {
  state.development = true;
  state.pkg = {
    id: 'fixture',
    slug: 'old-trafford',
    title: { id: 'Old Trafford Experience', en: 'Old Trafford Experience' },
    sport: 'football',
    readiness: 'interest_only',
    cities: ['Manchester'],
    events: [
      {
        id: 'e',
        name: { id: 'Match' },
        date_status: 'tba',
        starts_on: null,
        ends_on: null,
        city: 'Manchester',
      },
    ],
    batches: [],
    itinerary: [],
    highlights: [],
    inclusions: [],
    exclusions: [],
    addons: [],
    faqs: [],
    seo: {},
    proof_points: [],
  };
  state.catalog = {
    packages: [state.pkg],
    events: state.pkg.events.map((e: any) => ({
      ...e,
      package_title: state.pkg.title,
      slug: state.pkg.slug,
    })),
    sections: [],
    settings: [],
    testimonials: [],
    team: [],
  };
}
describe('V2 public screen rendering', () => {
  for (const lang of ['id', 'en'])
    it('renders the sport-only home in V2 order with a TBA group in ' + lang, () => {
      setup();
      state.lang = lang;
      const html = render(Home);
      expect(html.replace(/<[^>]*>/g, '')).toContain('Be There When It Matters.');
      expect(html.toLowerCase()).not.toContain('luxury');
      const labels =
        lang === 'en'
          ? [
              'Why Citadel',
              'Pick a sport',
              'The 2027 season',
              'Beyond the event',
              'How to book',
              'Team and proof',
            ]
          : [
              'Mengapa Citadel',
              'Pilih olahraga',
              'Musim 2027',
              'Di luar arena',
              'Cara memesan',
              'Tim dan bukti',
            ];
      for (let i = 1; i < labels.length; i++)
        expect(html.indexOf(labels[i])).toBeGreaterThan(html.indexOf(labels[i - 1]));
      expect(html).toContain(lang === 'en' ? 'To be announced' : 'Akan diumumkan');
      expect(html).not.toContain(
        'Ticket categories, travel services and change terms are explained before payment.',
      );
    });
  it('shows only interest actions for an unverified concept', () => {
    setup();
    state.lang = 'en';
    const html = render(Package);
    expect(html).toContain('We are preparing this trip');
    expect(html).not.toContain('/account/request/');
    expect(html).not.toContain('Request this journey');
    expect(html).toContain('/en/enquire?package=old-trafford');
  });
  it('keeps email and optional details optional and does not ask for passports', () => {
    setup();
    state.lang = 'en';
    const html = render(Enquire);
    expect(html).toContain('name="party_size"');
    expect(html).toContain('No passport needed yet');
    expect(html).not.toContain('name="passport');
    const email = html.match(/<input[^>]*name="email"[^>]*>/)?.[0];
    expect(email).toBeTruthy();
    expect(email).not.toContain('required');
    expect(html).toContain('Add details (optional)');
    expect(html.indexOf('name="whatsapp_e164"')).toBeLessThan(html.indexOf('name="interest"'));
    expect(html).toContain('Fewer travelers');
    expect(html).toContain('More travelers');
  });
  it('labels each certainty independently when a paid trip has no tickets or guaranteed departure', () => {
    state.lang = 'en';
    const html = render(FourStatuses, {
      lang: 'en',
      event: { date_status: 'tba' },
      batch: { ticket_allocation_status: 'requested' },
      invoice: { status: 'paid' },
    });
    expect(html).toContain('Event schedule');
    expect(html).toContain('Ticket allocation');
    expect(html).toContain('Requested');
    expect(html).toContain('Not yet confirmed');
    expect(html).toContain('Paid');
    expect(html).not.toContain('confirmed tickets');
  });
  it('separates running participants from spectators on the sport hub', () => {
    setup();
    state.lang = 'en';
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ['/en/sport/running'] },
        createElement(
          Routes,
          null,
          createElement(Route, { path: '/:lang/sport/:sport', element: createElement(Collection) }),
        ),
      ),
    );
    expect(html).toContain('<h1>Running</h1>');
    expect(html).toContain('Participant');
    expect(html).toContain('Spectator');
    expect(html).toContain('Race entry rights are checked separately.');
    expect(html).toContain('A companion journey, without race entry.');
  });
  it('shows payment review as its own state without implying tickets or departure are confirmed', () => {
    state.lang = 'en';
    const html = render(FourStatuses, {
      lang: 'en',
      event: { date_status: 'tba' },
      batch: { ticket_allocation_status: 'requested' },
      invoice: { status: 'issued', needs_review: true },
    });
    expect(html).toContain('Needs review');
    expect(html).not.toContain('Awaiting payment');
    expect(html).toContain('Not yet confirmed');
  });
  it('keeps prototype imagery off production entry and product screens when no approved image exists', () => {
    setup();
    state.lang = 'en';
    state.development = false;
    for (const component of [Home, Package])
      expect(render(component)).not.toContain('src="/placeholders/');
    const auth = renderToStaticMarkup(
      createElement(RouterProvider, {
        router: createMemoryRouter([{ path: '/:lang/sign-in', element: createElement(Auth) }], {
          initialEntries: ['/en/sign-in'],
        }),
      }),
    );
    expect(auth).toContain('Welcome back.');
    expect(auth).not.toContain('src="/placeholders/');
    state.pkg = { page: null, faqs: [] };
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ['/en/about'] },
        createElement(
          Routes,
          null,
          createElement(Route, { path: '/:lang/*', element: createElement(Page) }),
        ),
      ),
    );
    expect(html).not.toContain('/placeholders/family');
  });
});
