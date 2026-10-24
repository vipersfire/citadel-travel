import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { SiteHeader } from '../app/site-shell';
import { MemberOffer } from '../app/member-offer';
import { TicketDelivery } from '../app/v2';
import { DateWithStatus } from '@citadel/ui/feedback';
import { Field } from '@citadel/ui';
const render = (element: any, path = '/en') =>
  renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] }, element));
const localized = (value: string) => ({ id: value, en: value });
function invoice() {
  return {
    id: 'invoice-1',
    number: 'INV-001',
    status: 'issued',
    offer_version: 1,
    kind: 'package',
    lines: [
      {
        id: 'line-1',
        description: localized('Manchester journey'),
        quantity: 2,
        amount: '12000000',
      },
    ],
    discount: '0',
    total: '12000000',
    due_at: '2027-01-20T16:59:00Z',
    offer_snapshot: {
      services: [localized('Hotel and match transfer')],
      exclusions: [localized('Flights')],
      ticket_category: localized('Category recorded in offer'),
      seating_policy: localized('Seating policy recorded in offer'),
      change_terms: localized('Schedule change terms'),
      cancellation_terms: localized('Cancellation terms recorded in offer'),
    },
  };
}
const offer = (value: any, lang: 'en' | 'id' = 'en') =>
  render(
    createElement(MemberOffer, {
      invoice: value,
      booking: { code: 'CTD-001', status: 'offered' },
      payments: [],
      lang,
      onAct: async () => {},
      onPay: async () => {},
    }),
  );
describe('Shared header and V2 review screens', () => {
  for (const lang of ['id', 'en'] as const)
    it('keeps full identity, account entry and a named mobile disclosure in ' + lang, () => {
      const html = render(
        createElement(SiteHeader, { lang, user: null, contact: {} }),
        `/${lang}/trips/old-trafford?source=season`,
      );
      expect(html).toContain('Citadel Tour Travel');
      expect(html).toContain('Sports Travel');
      expect(html).not.toContain('wordmark');
      expect(html).toContain(`href="/${lang}/sign-in"`);
      expect(html).toContain(`href="/${lang}/sport"`);
      expect(html).toContain(`href="/${lang}/beyond-the-event"`);
      expect(html).toContain(`href="/${lang}/about"`);
      expect(html).toContain(`href="/${lang}/contact"`);
      expect(html).toContain(
        `href="/${lang === 'id' ? 'en' : 'id'}/trips/old-trafford?source=season"`,
      );
      expect(html).toContain('aria-controls="primary-navigation"');
      expect(html).toContain('id="primary-navigation"');
      expect(html).toContain('aria-expanded="false"');
      expect(html).toContain(lang === 'id' ? 'Buka navigasi' : 'Open navigation');
    });
  it('sends a signed-in member to the account', () => {
    const html = render(
      createElement(SiteHeader, { lang: 'en', user: { id: 'member-1' }, contact: {} }),
    );
    expect(html).toContain('href="/en/account"');
    expect(html).not.toContain('/en/sign-in');
  });
  for (const lang of ['id', 'en'] as const)
    it('requires approval and shows the required terms in review order in ' + lang, () => {
      const html = offer(invoice(), lang);
      expect(html).toContain(lang === 'id' ? 'Setujui penawaran' : 'Approve offer');
      expect(html).not.toMatch(/<button[^>]*>\s*(Pay|Bayar) /);
      const labels =
        lang === 'id'
          ? [
              'Termasuk',
              'Tidak termasuk',
              'Tiket dan tempat duduk',
              'Jika jadwal berubah',
              'Ketentuan pembatalan',
            ]
          : [
              'What is included',
              'What is not included',
              'Tickets and seating',
              'If the schedule changes',
              'Cancellation terms',
            ];
      for (let index = 1; index < labels.length; index++)
        expect(html.indexOf(labels[index])).toBeGreaterThan(html.indexOf(labels[index - 1]));
      expect(html).toContain(lang === 'id' ? 'Kategori tiket' : 'Ticket category');
      expect(html).toContain(lang === 'id' ? 'Kebijakan tempat duduk' : 'Seating policy');
      expect(html).toContain('WIB');
    });
  it('shows payment only after approval and renders the frozen terms rather than a live edit', () => {
    const value = invoice();
    const html = offer({
      ...value,
      offer_details: { services: [localized('UNAPPROVED LIVE EDIT')] },
      approval: {
        approved_at: '2027-01-01',
        offer_version: 1,
        locale: 'en',
        snapshot: {
          ...value.offer_snapshot,
          services: [localized('FROZEN APPROVED SERVICE')],
          total: '12000000',
          due_at: value.due_at,
          lines: value.lines,
        },
      },
    });
    expect(html).toMatch(/<button[^>]*>Pay /);
    expect(html).toContain('What you approved');
    expect(html).toContain('FROZEN APPROVED SERVICE');
    expect(html).not.toContain('UNAPPROVED LIVE EDIT');
    expect(html).not.toContain('Approve offer');
  });
  it('asks for approval again on a replaced offer and hides actions when payment needs review', () => {
    expect(offer({ ...invoice(), offer_version: 2 })).toContain(
      'The offer was updated. Please review and approve again.',
    );
    const html = offer({ ...invoice(), needs_review: true });
    expect(html).toContain('Payment needs review.');
    expect(html).not.toContain('Approve offer');
    expect(html).not.toMatch(/<button[^>]*>Pay /);
  });
  it('never prints a date on a TBA stub even if one is accidentally supplied', () => {
    const html = render(
      createElement(DateWithStatus, {
        date: 'UNVERIFIED DATE',
        status: 'tba',
        label: 'To be announced',
      }),
    );
    expect(html).toContain('To be announced');
    expect(html).not.toContain('UNVERIFIED DATE');
    expect(html.match(/To be announced/g)).toHaveLength(1);
  });
  it('presents app handover as numbered instructions without a PDF action', () => {
    const html = render(
      createElement(TicketDelivery, {
        lang: 'en',
        service: {
          delivery_method: 'external_app',
          external_app_name: 'Event ticket app',
          handover_status: 'planned',
          handover_target_on: '2027-06-20',
          delivery_instructions: localized(
            '1. Install the official app.\n2. Use the email given to Citadel.',
          ),
        },
      }),
    );
    expect(html).toContain('Tickets arrive through the official app.');
    expect(html).toContain('<ol');
    expect(html.match(/<li>/g)).toHaveLength(2);
    expect(html).toContain('Handover target');
    expect(html).not.toContain('Download');
    expect(html).not.toContain('.pdf');
  });
  it('connects shared input labels, help and errors while preserving autofill', () => {
    const html = render(
      createElement(Field, {
        label: 'Traveler email',
        help: 'Use your travel email.',
        error: 'Enter a valid email.',
        children: createElement('input', {
          id: 'traveler-email',
          name: 'email',
          type: 'email',
          autoComplete: 'email',
          'aria-describedby': 'existing-help',
        }),
      }),
    );
    expect(html).toContain('for="traveler-email"');
    expect(html).toContain(
      'aria-describedby="existing-help traveler-email-help traveler-email-error"',
    );
    expect(html).toContain('id="traveler-email-help"');
    expect(html).toContain('id="traveler-email-error"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('autoComplete="email"');
  });
});
