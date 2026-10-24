// Test-only commercial proof. Never imported by production seed or app code.
export const offerFixture = {
  offer_details: {
    services: [{ id: 'Fixture hotel', en: 'Fixture hotel' }],
    exclusions: [{ id: 'Fixture visa', en: 'Fixture visa' }],
    ticket_category: { id: 'Fixture stand', en: 'Fixture stand' },
    seating_policy: { id: 'Fixture allocation', en: 'Fixture allocation' },
    change_terms: { id: 'Fixture changes', en: 'Fixture changes' },
    cancellation_terms: { id: 'Fixture cancellation', en: 'Fixture cancellation' },
  },
  readiness_checks: Object.fromEntries(
    [
      'supplier_confirmation',
      'quotation_price',
      'ticket_source_category',
      'event_date_status',
      'services_exclusions',
      'terms_attached',
    ].map((key) => [key, { passed: true, note: 'TEST ONLY: ' + key }]),
  ),
};
export async function preparePilotFixture(db: {
  query: (sql: string, args?: any[]) => Promise<any[]>;
}) {
  await db.query("UPDATE events SET date_status='tba'");
  await db.query(
    `UPDATE packages SET readiness='ready_to_offer',status='published',supplier_verified_at=now(),coverage_verified_at=now(),sales_rights_note='TEST FIXTURE ONLY - no commercial validity',terms='{"id":"Fixture terms","en":"Fixture terms"}',proof_points='[{"key":"ticket","label":{"id":"Fixture"},"value":{"id":"Fixture"}}]'`,
  );
  await db.query(
    "UPDATE batches SET start_date=CASE WHEN code='OT-27-0313' THEN '2027-03-11'::date ELSE '2027-04-22'::date END,end_date=CASE WHEN code='OT-27-0313' THEN '2027-03-15'::date ELSE '2027-04-26'::date END",
  );
}
