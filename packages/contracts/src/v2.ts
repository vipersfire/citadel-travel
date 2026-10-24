import { z } from 'zod';
const localizedSchema = z
  .object({ id: z.string().trim().min(1), en: z.string().optional() })
  .strict();
export const readinessKeys = [
  'supplier_confirmation',
  'quotation_price',
  'ticket_source_category',
  'event_date_status',
  'services_exclusions',
  'terms_attached',
] as const;
export const proofPointSchema = z
  .object({ key: z.string().min(1), label: localizedSchema, value: localizedSchema })
  .strict();
export const offerDetailsSchema = z
  .object({
    services: z.array(localizedSchema).min(1),
    exclusions: z.array(localizedSchema).min(1),
    ticket_category: localizedSchema,
    seating_policy: localizedSchema,
    change_terms: localizedSchema,
    cancellation_terms: localizedSchema,
  })
  .strict();
export const readinessCheckSchema = z
  .object({ passed: z.boolean(), note: z.string().trim().min(1).max(4000) })
  .strict();
export const packageReadinessSchema = z.enum(['draft', 'interest_only', 'ready_to_offer']);
export const clientAnalyticsSchema = z
  .object({
    events: z
      .array(
        z
          .object({
            name: z.enum(['product_view', 'enquiry_started', 'whatsapp_click']),
            package_id: z.uuid().optional(),
            locale: z.enum(['id', 'en']).optional(),
            path: z.string().max(2048).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict();
// Response schemas strip admin-only fields at the boundary.
const publicFields = (keys: string[]) =>
  Object.fromEntries(keys.map((k) => [k, z.unknown().optional()]));
export const publicPackageSchema = z.object({
  ...publicFields([
    'id',
    'code',
    'slug',
    'sport',
    'status',
    'readiness',
    'title',
    'subtitle',
    'summary',
    'story',
    'highlights',
    'inclusions',
    'exclusions',
    'hotel_style',
    'countries',
    'cities',
    'nights_min',
    'nights_max',
    'nights_note',
    'proof_points',
    'interest_label',
    'hero_media_id',
    'hero_video_id',
    'terms',
    'visa_note',
    'seo',
    'featured',
    'sort_order',
    'hero_alt',
    'hero_video',
    'hero_video_mobile',
    'hero_variants',
    'hero_blur',
    'hero_focal_x',
    'hero_focal_y',
  ]),
});
export const publicEventSchema = z.object({
  ...publicFields([
    'id',
    'name',
    'sport',
    'competition',
    'home_side',
    'away_side',
    'venue',
    'city',
    'country',
    'starts_on',
    'ends_on',
    'start_time_local',
    'timezone',
    'date_status',
    'date_verified_at',
    'previous_starts_on',
    'package_id',
    'slug',
    'package_title',
    'subtitle',
    'seo',
    'readiness',
  ]),
});
export function publicPackage(row: Record<string, any>) {
  return publicPackageSchema.parse(row);
}
export function publicEvent(row: Record<string, any>) {
  return publicEventSchema.parse({
    ...row,
    ...Object.fromEntries(
      ['starts_on', 'ends_on', 'previous_starts_on'].map((k) => [
        k,
        row[k] ? new Date(row[k]).toISOString().slice(0, 10) : null,
      ]),
    ),
    ...(row.date_status !== 'changed' ? { previous_starts_on: null } : {}),
    ...(!row.date_verified_at
      ? {
          starts_on: null,
          ends_on: null,
          start_time_local: null,
          date_status: 'tba',
          previous_starts_on: null,
        }
      : {}),
  });
}
export function canonicalJson(value: any): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, v[k]]),
        )
      : v,
  );
}

export const publicPageSchema = z.object({
  ...publicFields(['id', 'slug', 'title', 'body', 'seo', 'published_at']),
});
