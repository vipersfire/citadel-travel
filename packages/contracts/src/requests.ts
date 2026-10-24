import { z } from 'zod';
import { localizedSchema } from './index.js';
export const inputSchemas = {
  memberCancel: z.object({ reason: z.string().max(2000).default('') }).strict(),
  auth_auth_verify_email_token: z.object({ token: z.string() }).strict(),
  auth_auth_forgot_password_b: z
    .object({ email: z.email(), turnstile_token: z.string().optional() })
    .strict(),
  auth_auth_reset_password_b: z
    .object({ token: z.string(), password: z.string().min(10).max(128) })
    .strict(),
  auth_admin_auth_totp_verify_b: z.object({ code: z.string().min(6).max(64) }).strict(),
  routes_public_leads_b: z
    .object({
      name: z.string().min(2).max(150),
      email: z.email().optional(),
      party_size: z.number().int().min(1).max(50),
      sport: z.enum(['football', 'motorsport', 'tennis', 'running', 'other']).optional(),
      interest_kind: z.enum(['product', 'sport', 'concept', 'other']).default('product'),
      preferred_period: z.string().max(500).optional(),
      budget_note: z.string().max(1000).optional(),
      concept_label: z.string().max(500).optional(),
      landing_path: z.string().max(2048).optional(),
      referrer: z.string().max(2048).optional(),
      utm_source: z.string().max(500).optional(),
      utm_medium: z.string().max(500).optional(),
      utm_campaign: z.string().max(500).optional(),
      utm_content: z.string().max(500).optional(),
      utm_term: z.string().max(500).optional(),
      whatsapp_e164: z.string().regex(/^\+[1-9][0-9]{7,14}$/),
      package_id: z.uuid().nullable().optional(),
      message: z.string().max(4000).default(''),
      locale: z.enum(['id', 'en']),
      website: z.string().max(0).optional(),
      turnstile_token: z.string().optional(),
    })
    .strict()
    .refine((v) => !!(v.package_id || v.sport || v.concept_label), {
      message: 'Choose a product or sport.',
    }),
  routes_admin_bookings_code_status_body: z
    .object({
      status: z.enum(['reviewing', 'declined', 'waitlisted', 'cancelled']),
      reason: z.union([z.string().max(2000), localizedSchema]).optional(),
    })
    .strict(),
  routes_admin_batches_id_publish_body: z
    .object({
      services: z.array(z.uuid()).default([]),
      documents: z.array(z.uuid()).default([]),
      itinerary: z.array(z.uuid()).default([]),
    })
    .strict(),
  routes_admin_batches_id_services_bulk_body: z
    .object({ ids: z.array(z.uuid()).min(1).max(100), status: z.string() })
    .strict(),
  routes_admin_batches_id_broadcast_b: z
    .object({ message: z.union([localizedSchema, z.string().min(1).max(4000)]) })
    .strict(),
  routes_admin_events_id_notify_b: z.object({ message: z.string().min(1).max(2000) }).strict(),
  payments_admin_invoices_id_manual_payment_b: z
    .object({
      amount: z.number().int().positive(),
      confirm_amount: z.string(),
      reference: z.string().min(1),
      paid_at: z.iso.datetime({ offset: true }),
      proof_document_id: z.uuid(),
    })
    .strict(),
  payments_admin_invoices_id_resolve_review_body: z
    .object({ note: z.string().trim().min(10).max(2000) })
    .strict(),
  payments_admin_invoices_id_void_b: z
    .object({ confirm_amount: z.string(), reason: z.string().min(1) })
    .strict(),
  payments_admin_payments_id_refunds_b: z
    .object({
      amount: z.number().int().positive(),
      confirm_amount: z.string(),
      method: z.string().min(1),
      reason: z.string().min(1),
      processed_on: z.iso.date(),
      reference: z.string().optional(),
    })
    .strict(),
  admin_admin_admins_body: z
    .object({
      email: z.email(),
      full_name: z.string().min(2).max(150),
      password: z.string().min(10).max(128),
    })
    .strict(),
  admin_admin_rooms_id_occupants_b: z
    .object({ booking_traveler_ids: z.array(z.uuid()).max(2) })
    .strict(),
  workspaces_admin_batches_id_services_create_bulk_b: z
    .object({
      booking_traveler_ids: z.array(z.uuid()).min(1).max(200),
      type: z.enum([
        'flight',
        'hotel',
        'event_ticket',
        'transfer',
        'activity',
        'insurance',
        'dining',
        'other',
      ]),
    })
    .strict(),
};
