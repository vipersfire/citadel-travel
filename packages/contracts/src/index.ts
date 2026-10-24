import { z } from 'zod';
import { offerDetailsSchema, readinessCheckSchema } from './v2.js';
export const localeSchema = z.enum(['id', 'en']);
export const localizedSchema = z
  .object({ id: z.string().min(1), en: z.string().optional() })
  .strict();
export const phoneSchema = z.string().regex(/^\+[1-9][0-9]{7,14}$/);
export const signUpSchema = z
  .object({
    full_name: z.string().trim().min(2).max(150),
    email: z.email(),
    password: z.string().min(10).max(128),
    whatsapp_e164: phoneSchema.optional(),
    locale: localeSchema.default('id'),
    whatsapp_opt_in: z.boolean().default(false),
    turnstile_token: z.string().optional(),
  })
  .strict();
export const signInSchema = z
  .object({ email: z.email(), password: z.string().min(1).max(128) })
  .strict();
export const travelerSchema = z
  .object({
    given_names: z.string().trim().min(1).max(100),
    surname: z.string().trim().min(1).max(100),
    is_self: z.boolean().default(false),
    gender: z.enum(['female', 'male', 'x']).nullable().optional(),
    date_of_birth: z.iso.date().nullable().optional(),
    nationality: z.string().length(2).default('ID'),
    passport_number: z
      .string()
      .regex(/^[A-Za-z0-9]{5,20}$/)
      .optional(),
    passport_expiry: z.iso.date().nullable().optional(),
    dietary: z
      .array(z.enum(['halal', 'vegetarian', 'vegan', 'no_pork', 'no_alcohol', 'other']))
      .default([]),
    dietary_notes: z.string().max(2000).optional(),
    medical_notes: z.string().max(2000).optional(),
    relationship: z.string().max(100).optional(),
  })
  .strict();
export const requestSchema = z
  .object({
    package_id: z.uuid(),
    preferred_batch_id: z.uuid().nullable().optional(),
    travelers: z
      .array(
        z
          .object({ traveler_id: z.uuid(), package_option_id: z.uuid().nullable().optional() })
          .strict(),
      )
      .min(1)
      .max(20),
    room_preference: z.enum(['twin', 'double', 'single']),
    addons: z.array(z.uuid()).default([]),
    member_notes: z.string().max(4000).default(''),
  })
  .strict();
export const offerSchema = z
  .object({
    batch_id: z.uuid(),
    issue_now: z.boolean().default(true),
    confirm_amount: z.string(),
    kind: z.enum(['package', 'supplement']).default('package'),
    lines: z
      .array(
        z
          .object({
            description: localizedSchema,
            quantity: z.number().int().min(1).max(100),
            unit_amount: z.number().int().min(0).max(10000000000),
          })
          .strict(),
      )
      .min(1)
      .max(100),
    discount: z.number().int().min(0).default(0),
    due_at: z.iso.datetime({ offset: true }),
    allowed_channels: z.array(z.string()).default([]),
    note: localizedSchema.optional(),
    offer_details: offerDetailsSchema,
    readiness_checks: z.record(z.string(), readinessCheckSchema).default({}),
    replaces_invoice_id: z.uuid().optional(),
  })
  .strict();
export const serviceTypes = [
  'flight',
  'hotel',
  'event_ticket',
  'transfer',
  'activity',
  'insurance',
  'dining',
  'other',
] as const;
const memberFields: Record<string, string[]> = {
  flight: ['segments', 'ticket_number'],
  hotel: [
    'hotel_name',
    'address',
    'city',
    'phone',
    'website',
    'check_in_date',
    'check_out_date',
    'room_type',
    'board',
    'star_rating',
  ],
  event_ticket: ['event_id', 'category', 'section', 'row', 'seat', 'hospitality', 'seats_together'],
  transfer: [
    'pickup_place',
    'dropoff_place',
    'pickup_local',
    'vehicle',
    'driver_name',
    'driver_phone',
  ],
  activity: ['name', 'place', 'meeting_point', 'duration_minutes', 'guide_language'],
  insurance: ['insurer', 'policy_number', 'coverage_summary', 'valid_from', 'valid_to'],
  dining: ['restaurant', 'place', 'time_local', 'halal', 'dress_code'],
  other: ['fields'],
};
export function memberService(row: Record<string, any>) {
  return memberServiceResponseSchema.parse({
    id: row.id,
    type: row.type,
    status: row.status,
    title: row.title,
    confirmation_ref: row.confirmation_ref,
    member_note: row.member_note,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    traveler_id: row.traveler_id,
    published_at: row.published_at,
    ...Object.fromEntries(
      [
        'delivery_method',
        'external_app_name',
        'delivery_instructions',
        'handover_target_on',
        'handover_status',
        'handed_over_at',
      ].map((k) => [k, row[k]]),
    ),
    details: Object.fromEntries(
      Object.entries(row.details).filter(([key]) => memberFields[row.type]?.includes(key)),
    ),
  });
}
export const serviceDetailsSchema = z.discriminatedUnion(
  'type',
  serviceTypes.map((type) =>
    z
      .object({
        type: z.literal(type),
        details: z
          .object(
            Object.fromEntries(
              memberFields[type].map((k) => [
                k,
                k === 'segments'
                  ? z.array(
                      z
                        .object({
                          airline: z.string(),
                          flight_no: z.string(),
                          from_iata: z.string(),
                          to_iata: z.string(),
                          depart_local: z.string(),
                          arrive_local: z.string(),
                          depart_tz: z.string(),
                          arrive_tz: z.string(),
                          cabin: z.string().optional(),
                          baggage: z.string().optional(),
                        })
                        .strict(),
                    )
                  : ['hospitality', 'seats_together', 'halal'].includes(k)
                    ? z.boolean().optional()
                    : k === 'fields'
                      ? z
                          .array(z.object({ label: z.string(), value: z.string() }).strict())
                          .optional()
                      : ['star_rating', 'duration_minutes'].includes(k)
                        ? z.number().optional()
                        : z.string().optional(),
              ]),
            ),
          )
          .strict(),
      })
      .strict(),
  ) as any,
);
export const transitions: Record<string, Record<string, string[]>> = {
  ticket_allocation: {
    not_requested: ['requested'],
    requested: ['partial', 'allocated'],
    partial: ['allocated', 'requested'],
  },
  service_handover: { planned: ['handed_over', 'not_applicable'] },
  booking: {
    requested: ['reviewing', 'declined', 'waitlisted', 'cancelled'],
    reviewing: ['offered', 'declined', 'waitlisted', 'cancelled'],
    waitlisted: ['reviewing', 'cancelled'],
    offered: ['confirmed', 'expired', 'declined', 'cancelled'],
    expired: ['reviewing'],
    confirmed: ['completed', 'cancelled'],
  },
  invoice: { draft: ['issued', 'void'], issued: ['paid', 'expired', 'void'] },
  batch: {
    draft: ['open', 'cancelled'],
    open: ['closed', 'cancelled'],
    closed: ['open', 'confirmed', 'cancelled'],
    confirmed: ['in_progress', 'cancelled'],
    in_progress: ['completed'],
  },
  service: {
    not_started: ['requested'],
    requested: ['pending_allocation', 'confirmed', 'cancelled'],
    pending_allocation: ['confirmed', 'cancelled'],
    confirmed: ['issued', 'cancelled'],
  },
  visa: {
    not_started: ['collecting_documents', 'not_required'],
    collecting_documents: ['appointment_booked', 'submitted'],
    appointment_booked: ['submitted'],
    submitted: ['approved', 'refused'],
  },
};
export function canTransition(entity: string, from: string, to: string) {
  return transitions[entity]?.[from]?.includes(to) ?? false;
}

const bookingFields = new Set([
  'id',
  'code',
  'package_id',
  'batch_id',
  'preferred_batch_id',
  'status',
  'room_preference',
  'member_notes',
  'decline_reason',
  'cancel_reason',
  'requested_at',
  'reviewed_at',
  'offered_at',
  'confirmed_at',
  'completed_at',
  'cancelled_at',
  'expired_at',
  'created_at',
  'updated_at',
  'title',
  'slug',
  'seo',
  'start_date',
  'end_date',
  'date_status',
  'event_name',
]);
const invoiceFields = new Set([
  'id',
  'number',
  'kind',
  'status',
  'currency',
  'subtotal',
  'discount',
  'total',
  'due_at',
  'allowed_channels',
  'note',
  'needs_review',
  'issued_at',
  'paid_at',
  'expired_at',
  'voided_at',
  'created_at',
  'lines',
  'offer_version',
  'superseded_by',
  'offer_details',
  'offer_snapshot',
  'approval',
  'readiness_confirmed_at',
]);
const responseFields = (fields: Set<string>) =>
  Object.fromEntries([...fields].map((k) => [k, z.unknown().optional()]));
export const memberBookingResponseSchema = z.object({
  ...responseFields(bookingFields),
  id: z.string().optional(),
  status: z
    .enum([
      'requested',
      'reviewing',
      'waitlisted',
      'offered',
      'confirmed',
      'completed',
      'declined',
      'expired',
      'cancelled',
    ])
    .optional(),
});
export const memberInvoiceResponseSchema = z.object({
  ...responseFields(invoiceFields),
  id: z.string().optional(),
  subtotal: z.coerce.number().int().nonnegative().optional(),
  discount: z.coerce.number().int().nonnegative().optional(),
  total: z.coerce.number().int().nonnegative().optional(),
});
export const memberServiceResponseSchema = z.object({
  id: z.string().optional(),
  type: z.enum(serviceTypes),
  status: z.string().optional(),
  title: z.unknown().optional(),
  confirmation_ref: z.string().nullable().optional(),
  member_note: z.unknown().optional(),
  starts_at: z.unknown().optional(),
  ends_at: z.unknown().optional(),
  traveler_id: z.string().nullable().optional(),
  published_at: z.unknown().optional(),
  ...responseFields(
    new Set([
      'delivery_method',
      'external_app_name',
      'delivery_instructions',
      'handover_target_on',
      'handover_status',
      'handed_over_at',
    ]),
  ),
  details: z.record(z.string(), z.unknown()),
});
export const publicTravelerResponseSchema = z
  .object(
    responseFields(
      new Set([
        'id',
        'owner_user_id',
        'is_self',
        'given_names',
        'surname',
        'gender',
        'date_of_birth',
        'nationality',
        'passport_expiry',
        'passport_number_last3',
        'passport_masked',
        'phone_e164',
        'email',
        'relationship',
        'dietary',
        'dietary_notes',
        'medical_notes',
        'locked_at',
        'created_at',
        'updated_at',
        'deleted_at',
        'booking_traveler_id',
        'package_option_id',
      ]),
    ),
  )
  .extend({
    dietary: z.array(z.enum(['halal', 'vegetarian', 'vegan', 'no_pork', 'no_alcohol', 'other'])),
  });
export function memberBooking(row: Record<string, any>) {
  return memberBookingResponseSchema.parse(row);
}
export function memberInvoice(row: Record<string, any>) {
  return memberInvoiceResponseSchema.parse(row);
}

export * from './admin.js';

export * from './v2.js';
