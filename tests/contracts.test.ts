import { describe, it, expect } from 'vitest';
import {
  canTransition,
  transitions,
  offerSchema,
  uploadInitSchema,
  memberService,
  memberBooking,
  memberInvoice,
  listQuerySchema,
} from '../packages/contracts/src/index';
import { text, date, money, status, errorText } from '../packages/i18n/src/index';
describe('Shared domain contracts', () => {
  it('translates payment and request errors with an actionable fallback', () => {
    expect(errorText('approval_required', 'Review first', 'id')).toContain('setujui');
    expect(errorText('unknown', 'Internal English message', 'id')).toContain('hubungi Citadel');
    expect(errorText('approval_required', 'Review first', 'en')).toBe('Review first');
  });
  for (const [entity, states] of Object.entries(transitions))
    for (const [from, targets] of Object.entries(states))
      for (const to of targets)
        it(`${entity}: ${from} → ${to}`, () => expect(canTransition(entity, from, to)).toBe(true));
  for (const entity of Object.keys(transitions))
    it(`${entity} rejects an unknown transition`, () => {
      expect(canTransition(entity, 'unknown', 'confirmed')).toBe(false);
      expect(canTransition(entity, 'confirmed', 'requested')).toBe(false);
    });
  it('rejects unknown fields and fractional IDR', () => {
    expect(
      offerSchema.safeParse({
        batch_id: crypto.randomUUID(),
        confirm_amount: '1',
        lines: [{ description: { id: 'Paket' }, quantity: 1, unit_amount: 1.5 }],
        due_at: new Date(Date.now() + 10000).toISOString(),
      }).success,
    ).toBe(false);
    expect(listQuerySchema.safeParse({ password: 'anything' }).success).toBe(false);
  });
  it('validates declared file kind, mime and size', () => {
    expect(
      uploadInitSchema.safeParse({
        kind: 'image',
        filename: 'fake.jpg',
        mime: 'video/mp4',
        bytes: 100,
      }).success,
    ).toBe(false);
    expect(
      uploadInitSchema.safeParse({
        kind: 'document',
        filename: 'proof.pdf',
        mime: 'application/pdf',
        bytes: 21 * 1024 * 1024,
        type: 'payment_proof',
      }).success,
    ).toBe(false);
  });
  it('strips internal fields from member records', () => {
    expect(memberBooking({ id: 'x', internal_notes: 'private', supplier_ref: 'supplier' })).toEqual(
      { id: 'x' },
    );
    expect(memberInvoice({ id: 'x', issued_by: 'private', review_reason: 'internal' })).toEqual({
      id: 'x',
    });
    const s = memberService({
      type: 'hotel',
      details: { hotel_name: 'Stay', cost: 500, supplier_ref: 'private' },
      internal_notes: 'private',
    });
    expect(s.details).toEqual({ hotel_name: 'Stay' });
    expect('internal_notes' in s).toBe(false);
  });
  it('formats integer IDR and fallback localized content', () => {
    expect(money(312500000)).toContain('312.500.000');
    expect(text({ id: 'Perjalanan' }, 'en')).toBe('Perjalanan');
    expect(date('2027-03-13', 'en')).toContain('2027');
    expect(status('collecting_documents', 'id')).toBe('Mengumpulkan dokumen');
  });
});
