import {
  pgTable,
  pgEnum,
  pgView,
  customType,
  uuid,
  text,
  boolean,
  integer,
  smallint,
  bigint,
  timestamp,
  date,
  time,
  jsonb,
  numeric,
  char,
  check,
  unique,
  primaryKey,
  index,
  uniqueIndex,
  foreignKey,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
const citext = customType<{ data: string }>({ dataType: () => 'citext' });
const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' });
const inet = customType<{ data: string }>({ dataType: () => 'inet' });
const localized = customType<{ data: { id: string; en?: string } }>({
  dataType: () => 'localized_text',
});
export const user_roleEnum = pgEnum('user_role', ['member', 'admin']);
export const user_statusEnum = pgEnum('user_status', ['active', 'suspended', 'deleted']);
export const app_localeEnum = pgEnum('app_locale', ['id', 'en']);
export const oauth_providerEnum = pgEnum('oauth_provider', ['google']);
export const auth_token_typeEnum = pgEnum('auth_token_type', ['email_verify', 'password_reset']);
export const passport_genderEnum = pgEnum('passport_gender', ['female', 'male', 'x']);
export const dietary_needEnum = pgEnum('dietary_need', [
  'halal',
  'vegetarian',
  'vegan',
  'no_pork',
  'no_alcohol',
  'other',
]);
export const media_kindEnum = pgEnum('media_kind', ['image', 'video']);
export const package_readinessEnum = pgEnum('package_readiness', [
  'draft',
  'interest_only',
  'ready_to_offer',
]);
export const ticket_allocation_statusEnum = pgEnum('ticket_allocation_status', [
  'not_requested',
  'requested',
  'partial',
  'allocated',
]);
export const sport_kindEnum = pgEnum('sport_kind', [
  'football',
  'motorsport',
  'tennis',
  'running',
  'other',
]);
export const publish_statusEnum = pgEnum('publish_status', ['draft', 'published', 'archived']);
export const event_date_statusEnum = pgEnum('event_date_status', [
  'provisional',
  'tba',
  'confirmed',
  'changed',
  'postponed',
  'cancelled',
]);
export const batch_statusEnum = pgEnum('batch_status', [
  'draft',
  'open',
  'closed',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
]);
export const booking_statusEnum = pgEnum('booking_status', [
  'requested',
  'reviewing',
  'waitlisted',
  'offered',
  'confirmed',
  'completed',
  'declined',
  'expired',
  'cancelled',
]);
export const room_typeEnum = pgEnum('room_type', ['twin', 'double', 'single']);
export const invoice_kindEnum = pgEnum('invoice_kind', ['package', 'supplement']);
export const invoice_statusEnum = pgEnum('invoice_status', [
  'draft',
  'issued',
  'paid',
  'expired',
  'void',
]);
export const payment_attempt_statusEnum = pgEnum('payment_attempt_status', [
  'active',
  'completed',
  'expired',
  'canceled',
]);
export const payment_methodEnum = pgEnum('payment_method', ['xendit', 'manual_transfer']);
export const service_typeEnum = pgEnum('service_type', [
  'flight',
  'hotel',
  'event_ticket',
  'transfer',
  'activity',
  'insurance',
  'dining',
  'other',
]);
export const service_statusEnum = pgEnum('service_status', [
  'not_started',
  'requested',
  'pending_allocation',
  'confirmed',
  'issued',
  'cancelled',
]);
export const visa_stageEnum = pgEnum('visa_stage', [
  'not_started',
  'collecting_documents',
  'appointment_booked',
  'submitted',
  'approved',
  'refused',
  'not_required',
]);
export const document_typeEnum = pgEnum('document_type', [
  'flight_ticket',
  'hotel_voucher',
  'event_ticket',
  'transfer_voucher',
  'insurance',
  'itinerary',
  'payment_proof',
  'other',
]);
export const document_statusEnum = pgEnum('document_status', ['private', 'published', 'withdrawn']);
export const lead_statusEnum = pgEnum('lead_status', [
  'new',
  'contacted',
  'qualified',
  'converted',
  'closed',
]);
export const notification_channelEnum = pgEnum('notification_channel', ['email', 'whatsapp']);
export const notification_statusEnum = pgEnum('notification_status', [
  'queued',
  'sending',
  'sent',
  'failed',
  'skipped',
]);
export const users = pgTable(
  'users',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    email: citext('email').notNull().unique(),
    email_verified_at: timestamp('email_verified_at', { withTimezone: true, mode: 'string' }),
    password_hash: text('password_hash'),
    full_name: text('full_name').notNull(),
    whatsapp_e164: text('whatsapp_e164'),
    whatsapp_opt_in: boolean('whatsapp_opt_in')
      .notNull()
      .default(sql`false`),
    locale: app_localeEnum('locale')
      .notNull()
      .default(sql`'id'`),
    role: user_roleEnum('role')
      .notNull()
      .default(sql`'member'`),
    status: user_statusEnum('status')
      .notNull()
      .default(sql`'active'`),
    totp_secret_enc: bytea('totp_secret_enc'),
    totp_enabled_at: timestamp('totp_enabled_at', { withTimezone: true, mode: 'string' }),
    last_sign_in_at: timestamp('last_sign_in_at', { withTimezone: true, mode: 'string' }),
    deleted_at: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
    updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`)
      .$onUpdate(() => new Date().toISOString()),
  },
  (_t) => [
    check('users_whatsapp_e164_check', sql`whatsapp_e164 ~ '^\\+[1-9][0-9]{7,14}$'`),
    check(
      'admin_has_password',
      sql`role <> 'admin' or password_hash is 
not null`,
    ),
  ],
);
export const oauth_accounts = pgTable(
  'oauth_accounts',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    user_id: uuid('user_id')
      .notNull()
      .references((): AnyPgColumn => users.id, { onDelete: 'cascade' }),
    provider: oauth_providerEnum('provider').notNull(),
    provider_user_id: text('provider_user_id').notNull(),
    email: citext('email').notNull(),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [unique().on(t.provider, t.provider_user_id), unique().on(t.user_id, t.provider)],
);
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    token_hash: bytea('token_hash').notNull().unique(),
    user_id: uuid('user_id')
      .notNull()
      .references((): AnyPgColumn => users.id, { onDelete: 'cascade' }),
    mfa_verified_at: timestamp('mfa_verified_at', { withTimezone: true, mode: 'string' }),
    ip: inet('ip'),
    user_agent: text('user_agent'),
    expires_at: timestamp('expires_at', { withTimezone: true, mode: 'string' }).notNull(),
    last_seen_at: timestamp('last_seen_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index('sessions_idx_1').on(t.user_id), index('sessions_idx_2').on(t.expires_at)],
);
export const auth_tokens = pgTable('auth_tokens', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  user_id: uuid('user_id')
    .notNull()
    .references((): AnyPgColumn => users.id, { onDelete: 'cascade' }),
  type: auth_token_typeEnum('type').notNull(),
  token_hash: bytea('token_hash').notNull().unique(),
  expires_at: timestamp('expires_at', { withTimezone: true, mode: 'string' }).notNull(),
  used_at: timestamp('used_at', { withTimezone: true, mode: 'string' }),
  created_at: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .default(sql`now()`),
});
export const admin_recovery_codes = pgTable('admin_recovery_codes', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  user_id: uuid('user_id')
    .notNull()
    .references((): AnyPgColumn => users.id, { onDelete: 'cascade' }),
  code_hash: text('code_hash').notNull(),
  used_at: timestamp('used_at', { withTimezone: true, mode: 'string' }),
});
export const travelers = pgTable(
  'travelers',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    owner_user_id: uuid('owner_user_id')
      .notNull()
      .references((): AnyPgColumn => users.id),
    is_self: boolean('is_self')
      .notNull()
      .default(sql`false`),
    given_names: text('given_names').notNull(),
    surname: text('surname').notNull(),
    gender: passport_genderEnum('gender'),
    date_of_birth: date('date_of_birth'),
    nationality: char('nationality', { length: 2 }),
    passport_number_enc: bytea('passport_number_enc'),
    passport_number_last3: text('passport_number_last3'),
    passport_key_version: smallint('passport_key_version'),
    passport_expiry: date('passport_expiry'),
    phone_e164: text('phone_e164'),
    email: citext('email'),
    dietary: dietary_needEnum('dietary')
      .array()
      .notNull()
      .default(sql`'{}'`),
    dietary_notes: text('dietary_notes'),
    medical_notes: text('medical_notes'),
    relationship: text('relationship'),
    locked_at: timestamp('locked_at', { withTimezone: true, mode: 'string' }),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
    updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`)
      .$onUpdate(() => new Date().toISOString()),
    deleted_at: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  (t) => [
    uniqueIndex('one_self_traveler').on(t.owner_user_id).where(sql`
is_self and deleted_at is null`),
    index('travelers_idx_1').on(t.owner_user_id),
  ],
);
export const media_assets = pgTable('media_assets', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  kind: media_kindEnum('kind').notNull(),
  bucket: text('bucket').notNull(),
  storage_key: text('storage_key').notNull().unique(),
  mime: text('mime').notNull(),
  bytes: integer('bytes').notNull(),
  width: integer('width'),
  height: integer('height'),
  duration_ms: integer('duration_ms'),
  alt: localized('alt'),
  focal_x: numeric('focal_x', { precision: 5, scale: 2 })
    .notNull()
    .default(sql`50`),
  focal_y: numeric('focal_y', { precision: 5, scale: 2 })
    .notNull()
    .default(sql`50`),
  blur_data_url: text('blur_data_url'),
  variants: jsonb('variants')
    .notNull()
    .default(sql`'[]'`),
  poster_asset_id: uuid('poster_asset_id').references((): AnyPgColumn => media_assets.id),
  is_ai_generated: boolean('is_ai_generated')
    .notNull()
    .default(sql`false`),
  rights_status: text('rights_status').notNull().default('unverified'),
  license_note: text('license_note'),
  license_expires_on: date('license_expires_on'),
  created_by: uuid('created_by').references((): AnyPgColumn => users.id),
  created_at: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .default(sql`now()`),
});
export const packages = pgTable(
  'packages',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    code: text('code').notNull().unique(),
    slug: text('slug').notNull().unique(),
    sport: sport_kindEnum('sport').notNull(),
    status: publish_statusEnum('status')
      .notNull()
      .default(sql`'draft'`),
    readiness: package_readinessEnum('readiness').notNull().default('draft'),
    supplier_verified_at: timestamp('supplier_verified_at', { withTimezone: true, mode: 'string' }),
    supplier_verified_by: uuid('supplier_verified_by').references((): AnyPgColumn => users.id),
    coverage_verified_at: timestamp('coverage_verified_at', { withTimezone: true, mode: 'string' }),
    quotation_ref: text('quotation_ref'),
    sales_rights_note: text('sales_rights_note'),
    nights_note: localized('nights_note'),
    proof_points: jsonb('proof_points')
      .notNull()
      .default(sql`'[]'`),
    interest_label: localized('interest_label'),
    title: localized('title').notNull(),
    subtitle: localized('subtitle'),
    summary: localized('summary'),
    story: jsonb('story'),
    highlights: jsonb('highlights')
      .notNull()
      .default(sql`'[]'`),
    inclusions: jsonb('inclusions')
      .notNull()
      .default(sql`'[]'`),
    exclusions: jsonb('exclusions')
      .notNull()
      .default(sql`'[]'`),
    hotel_style: localized('hotel_style'),
    countries: char('countries', { length: 2 })
      .array()
      .notNull()
      .default(sql`'{}'`),
    cities: text('cities')
      .array()
      .notNull()
      .default(sql`'{}'`),
    nights_min: smallint('nights_min'),
    nights_max: smallint('nights_max'),
    hero_media_id: uuid('hero_media_id').references((): AnyPgColumn => media_assets.id),
    hero_video_id: uuid('hero_video_id').references((): AnyPgColumn => media_assets.id),
    terms: localized('terms'),
    visa_note: localized('visa_note'),
    seo: jsonb('seo')
      .notNull()
      .default(sql`'{}'`),
    featured: boolean('featured')
      .notNull()
      .default(sql`false`),
    sort_order: integer('sort_order')
      .notNull()
      .default(sql`0`),
    published_at: timestamp('published_at', { withTimezone: true, mode: 'string' }),
    created_by: uuid('created_by').references((): AnyPgColumn => users.id),
    updated_by: uuid('updated_by').references((): AnyPgColumn => users.id),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
    updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`)
      .$onUpdate(() => new Date().toISOString()),
  },
  (_t) => [
    check('packages_slug_check', sql`slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check(
      'ready_requires_verification',
      sql`readiness <> 'ready_to_offer' or (supplier_verified_at is not null and coverage_verified_at is not null and sales_rights_note is not null and length(btrim(sales_rights_note)) > 0)`,
    ),
    check('published_not_draft', sql`status <> 'published' or readiness <> 'draft'`),
  ],
);
export const package_media = pgTable(
  'package_media',
  {
    package_id: uuid('package_id')
      .notNull()
      .references((): AnyPgColumn => packages.id, { onDelete: 'cascade' }),
    media_id: uuid('media_id')
      .notNull()
      .references((): AnyPgColumn => media_assets.id),
    caption: localized('caption'),
    sort_order: integer('sort_order')
      .notNull()
      .default(sql`0`),
  },
  (t) => [primaryKey({ columns: [t.package_id, t.media_id] })],
);
export const package_options = pgTable(
  'package_options',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    package_id: uuid('package_id')
      .notNull()
      .references((): AnyPgColumn => packages.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    name: localized('name').notNull(),
    description: localized('description'),
    includes_event_entry: boolean('includes_event_entry')
      .notNull()
      .default(sql`true`),
    active: boolean('active')
      .notNull()
      .default(sql`true`),
    sort_order: integer('sort_order')
      .notNull()
      .default(sql`0`),
  },
  (t) => [unique().on(t.package_id, t.code)],
);
export const package_itinerary_days = pgTable(
  'package_itinerary_days',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    package_id: uuid('package_id')
      .notNull()
      .references((): AnyPgColumn => packages.id, { onDelete: 'cascade' }),
    day_number: smallint('day_number').notNull(),
    title: localized('title').notNull(),
    body: localized('body'),
    city: text('city'),
    media_id: uuid('media_id').references((): AnyPgColumn => media_assets.id),
  },
  (t) => [
    check('package_itinerary_days_day_number_check', sql`day_number > 0`),
    unique().on(t.package_id, t.day_number),
  ],
);
export const addons = pgTable('addons', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  code: text('code').notNull().unique(),
  name: localized('name').notNull(),
  description: localized('description'),
  media_id: uuid('media_id').references((): AnyPgColumn => media_assets.id),
  applies_to_all: boolean('applies_to_all')
    .notNull()
    .default(sql`false`),
  status: publish_statusEnum('status')
    .notNull()
    .default(sql`'draft'`),
  sort_order: integer('sort_order')
    .notNull()
    .default(sql`0`),
});
export const package_addons = pgTable(
  'package_addons',
  {
    package_id: uuid('package_id')
      .notNull()
      .references((): AnyPgColumn => packages.id, { onDelete: 'cascade' }),
    addon_id: uuid('addon_id')
      .notNull()
      .references((): AnyPgColumn => addons.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.package_id, t.addon_id] })],
);
export const faqs = pgTable('faqs', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  package_id: uuid('package_id').references((): AnyPgColumn => packages.id, {
    onDelete: 'cascade',
  }),
  question: localized('question').notNull(),
  answer: localized('answer').notNull(),
  status: publish_statusEnum('status')
    .notNull()
    .default(sql`'draft'`),
  sort_order: integer('sort_order')
    .notNull()
    .default(sql`0`),
});
export const events = pgTable(
  'events',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: localized('name').notNull(),
    sport: sport_kindEnum('sport').notNull(),
    competition: text('competition'),
    home_side: text('home_side'),
    away_side: text('away_side'),
    venue: text('venue').notNull(),
    city: text('city').notNull(),
    country: char('country', { length: 2 }).notNull(),
    starts_on: date('starts_on'),
    ends_on: date('ends_on'),
    start_time_local: time('start_time_local'),
    timezone: text('timezone').notNull(),
    date_status: event_date_statusEnum('date_status')
      .notNull()
      .default(sql`'provisional'`),
    date_verified_at: timestamp('date_verified_at', { withTimezone: true, mode: 'string' }),
    date_verified_by: uuid('date_verified_by').references((): AnyPgColumn => users.id),
    date_source_note: text('date_source_note'),
    source_url: text('source_url'),
    last_checked_at: timestamp('last_checked_at', { withTimezone: true, mode: 'string' }),
    notes: text('notes'),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
    updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`)
      .$onUpdate(() => new Date().toISOString()),
  },
  (_t) => [
    check('events_ends_on_check', sql`ends_on >= starts_on`),
    check(
      'verified_date_needs_source',
      sql`date_verified_at is null or (starts_on is not null and ends_on is not null and source_url is not null)`,
    ),
  ],
);
export const batches = pgTable(
  'batches',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    package_id: uuid('package_id')
      .notNull()
      .references((): AnyPgColumn => packages.id),
    event_id: uuid('event_id').references((): AnyPgColumn => events.id),
    code: text('code').notNull().unique(),
    title: localized('title'),
    start_date: date('start_date'),
    end_date: date('end_date'),
    nights: smallint('nights').generatedAlwaysAs(sql`(end_date - start_date)`),
    capacity: smallint('capacity').notNull(),
    min_pax: smallint('min_pax')
      .notNull()
      .default(sql`1`),
    hotel_category: text('hotel_category'),
    request_cutoff: date('request_cutoff'),
    status: batch_statusEnum('status')
      .notNull()
      .default(sql`'draft'`),
    ticket_allocation_status: ticket_allocation_statusEnum('ticket_allocation_status')
      .notNull()
      .default('not_requested'),
    ticket_allocation_note: localized('ticket_allocation_note'),
    departure_confirmed_at: timestamp('departure_confirmed_at', {
      withTimezone: true,
      mode: 'string',
    }),
    tour_leader_name: text('tour_leader_name'),
    tour_leader_whatsapp: text('tour_leader_whatsapp'),
    meeting_point: localized('meeting_point'),
    member_notes: localized('member_notes'),
    supplier_name: text('supplier_name'),
    supplier_ref: text('supplier_ref'),
    internal_notes: text('internal_notes'),
    created_by: uuid('created_by').references((): AnyPgColumn => users.id),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
    updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`)
      .$onUpdate(() => new Date().toISOString()),
  },
  (t) => [
    check(
      'dates_needed_after_draft',
      sql`status in ('draft','cancelled') or (start_date is not null and end_date is not null)`,
    ),
    check('batches_end_date_check', sql`end_date >= start_date`),
    check('batches_capacity_check', sql`capacity > 0`),
    check('min_le_capacity', sql`min_pax <= capacity`),
    index('batches_idx_1').on(t.package_id, t.status),
    index('batches_idx_2').on(t.event_id),
  ],
);
export const rooms = pgTable(
  'rooms',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    batch_id: uuid('batch_id')
      .notNull()
      .references((): AnyPgColumn => batches.id, { onDelete: 'cascade' }),
    hotel_service_id: uuid('hotel_service_id'),
    room_type: room_typeEnum('room_type').notNull(),
    label: text('label'),
    notes: text('notes'),
  },
  (t) => [
    foreignKey({ columns: [t.hotel_service_id], foreignColumns: [services.id] }).onDelete(
      'set null',
    ),
  ],
);
export const leads = pgTable('leads', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  email: citext('email'),
  whatsapp_e164: text('whatsapp_e164'),
  package_id: uuid('package_id').references((): AnyPgColumn => packages.id),
  message: text('message'),
  locale: app_localeEnum('locale')
    .notNull()
    .default(sql`'id'`),
  status: lead_statusEnum('status')
    .notNull()
    .default(sql`'new'`),
  user_id: uuid('user_id').references((): AnyPgColumn => users.id),
  interest_kind: text('interest_kind').notNull().default('product'),
  sport: sport_kindEnum('sport'),
  party_size: smallint('party_size'),
  preferred_period: text('preferred_period'),
  budget_note: text('budget_note'),
  concept_label: text('concept_label'),
  landing_path: text('landing_path'),
  referrer: text('referrer'),
  utm_source: text('utm_source'),
  utm_medium: text('utm_medium'),
  utm_campaign: text('utm_campaign'),
  utm_content: text('utm_content'),
  utm_term: text('utm_term'),
  anon_session_id: uuid('anon_session_id'),
  qualified_at: timestamp('qualified_at', { withTimezone: true, mode: 'string' }),
  qualified_by: uuid('qualified_by').references((): AnyPgColumn => users.id),
  first_response_at: timestamp('first_response_at', { withTimezone: true, mode: 'string' }),
  first_response_by: uuid('first_response_by').references((): AnyPgColumn => users.id),
  source: text('source'),
  ip: inet('ip'),
  created_at: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .default(sql`now()`),
  updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .default(sql`now()`)
    .$onUpdate(() => new Date().toISOString()),
});
export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    code: text('code').notNull().unique(),
    user_id: uuid('user_id')
      .notNull()
      .references((): AnyPgColumn => users.id),
    package_id: uuid('package_id')
      .notNull()
      .references((): AnyPgColumn => packages.id),
    batch_id: uuid('batch_id').references((): AnyPgColumn => batches.id),
    preferred_batch_id: uuid('preferred_batch_id').references((): AnyPgColumn => batches.id),
    status: booking_statusEnum('status')
      .notNull()
      .default(sql`'requested'`),
    room_preference: room_typeEnum('room_preference'),
    member_notes: text('member_notes'),
    internal_notes: text('internal_notes'),
    decline_reason: localized('decline_reason'),
    cancel_reason: text('cancel_reason'),
    cancelled_by_user_id: uuid('cancelled_by_user_id').references((): AnyPgColumn => users.id),
    lead_id: uuid('lead_id').references((): AnyPgColumn => leads.id),
    requested_at: timestamp('requested_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
    reviewed_at: timestamp('reviewed_at', { withTimezone: true, mode: 'string' }),
    offered_at: timestamp('offered_at', { withTimezone: true, mode: 'string' }),
    confirmed_at: timestamp('confirmed_at', { withTimezone: true, mode: 'string' }),
    completed_at: timestamp('completed_at', { withTimezone: true, mode: 'string' }),
    cancelled_at: timestamp('cancelled_at', { withTimezone: true, mode: 'string' }),
    expired_at: timestamp('expired_at', { withTimezone: true, mode: 'string' }),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
    updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`)
      .$onUpdate(() => new Date().toISOString()),
  },
  (t) => [
    check(
      'batch_needed',
      sql`status in 
('requested','reviewing','waitlisted','declined','cancelled') or batch_id is 
not null`,
    ),
    index('bookings_idx_1').on(t.user_id),
    index('bookings_idx_2').on(t.batch_id, t.status),
    index('bookings_idx_3').on(t.status, t.requested_at),
  ],
);
export const booking_travelers = pgTable(
  'booking_travelers',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    booking_id: uuid('booking_id')
      .notNull()
      .references((): AnyPgColumn => bookings.id, { onDelete: 'cascade' }),
    traveler_id: uuid('traveler_id')
      .notNull()
      .references((): AnyPgColumn => travelers.id),
    package_option_id: uuid('package_option_id').references((): AnyPgColumn => package_options.id),
    is_lead: boolean('is_lead')
      .notNull()
      .default(sql`false`),
    removed_at: timestamp('removed_at', { withTimezone: true, mode: 'string' }),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    unique().on(t.booking_id, t.traveler_id),
    index('booking_travelers_idx_1').on(t.traveler_id),
  ],
);
export const booking_addons = pgTable(
  'booking_addons',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    booking_id: uuid('booking_id')
      .notNull()
      .references((): AnyPgColumn => bookings.id, { onDelete: 'cascade' }),
    addon_id: uuid('addon_id')
      .notNull()
      .references((): AnyPgColumn => addons.id),
    booking_traveler_id: uuid('booking_traveler_id').references(
      (): AnyPgColumn => booking_travelers.id,
    ),
    state: text('state').notNull(),
    notes: text('notes'),
  },
  (_t) => [
    check(
      'booking_addons_state_check',
      sql`state in 
('interested','included','declined')`,
    ),
  ],
);
export const room_occupants = pgTable(
  'room_occupants',
  {
    room_id: uuid('room_id')
      .notNull()
      .references((): AnyPgColumn => rooms.id, { onDelete: 'cascade' }),
    booking_traveler_id: uuid('booking_traveler_id')
      .notNull()
      .references((): AnyPgColumn => booking_travelers.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.room_id, t.booking_traveler_id] })],
);
export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    offer_version: smallint('offer_version').notNull().default(1),
    superseded_by: uuid('superseded_by').references((): AnyPgColumn => invoices.id),
    readiness_confirmed_at: timestamp('readiness_confirmed_at', {
      withTimezone: true,
      mode: 'string',
    }),
    readiness_confirmed_by: uuid('readiness_confirmed_by').references((): AnyPgColumn => users.id),
    offer_details: jsonb('offer_details')
      .notNull()
      .default(sql`'{}'`),
    offer_snapshot: jsonb('offer_snapshot'),
    number: text('number').unique(),
    booking_id: uuid('booking_id')
      .notNull()
      .references((): AnyPgColumn => bookings.id),
    user_id: uuid('user_id')
      .notNull()
      .references((): AnyPgColumn => users.id),
    kind: invoice_kindEnum('kind').notNull(),
    status: invoice_statusEnum('status')
      .notNull()
      .default(sql`'draft'`),
    currency: char('currency', { length: 3 })
      .notNull()
      .default(sql`'IDR'`),
    subtotal: bigint('subtotal', { mode: 'number' }).notNull(),
    discount: bigint('discount', { mode: 'number' })
      .notNull()
      .default(sql`0`),
    total: bigint('total', { mode: 'number' }).notNull(),
    due_at: timestamp('due_at', { withTimezone: true, mode: 'string' }),
    allowed_channels: text('allowed_channels')
      .array()
      .notNull()
      .default(sql`'{}'`),
    note: localized('note'),
    needs_review: boolean('needs_review')
      .notNull()
      .default(sql`false`),
    review_reason: text('review_reason'),
    issued_at: timestamp('issued_at', { withTimezone: true, mode: 'string' }),
    issued_by: uuid('issued_by').references((): AnyPgColumn => users.id),
    paid_at: timestamp('paid_at', { withTimezone: true, mode: 'string' }),
    expired_at: timestamp('expired_at', { withTimezone: true, mode: 'string' }),
    voided_at: timestamp('voided_at', { withTimezone: true, mode: 'string' }),
    void_reason: text('void_reason'),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
    updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`)
      .$onUpdate(() => new Date().toISOString()),
  },
  (t) => [
    check('invoices_currency_check', sql`currency = 'IDR'`),
    check('invoices_subtotal_check', sql`subtotal >= 0`),
    check('invoices_discount_check', sql`discount >= 0`),
    check('total_math', sql`total = subtotal - discount and total > 0`),
    check('issued_has_due', sql`status = 'draft' or due_at is not null`),
    uniqueIndex('one_live_package_invoice')
      .on(t.booking_id)
      .where(sql`kind = 'package' and status in ('issued','paid')`),
    index('invoices_idx_1').on(t.status, t.due_at),
  ],
);
export const invoice_lines = pgTable(
  'invoice_lines',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    invoice_id: uuid('invoice_id')
      .notNull()
      .references((): AnyPgColumn => invoices.id, { onDelete: 'cascade' }),
    description: localized('description').notNull(),
    booking_traveler_id: uuid('booking_traveler_id').references(
      (): AnyPgColumn => booking_travelers.id,
    ),
    addon_id: uuid('addon_id').references((): AnyPgColumn => addons.id),
    quantity: integer('quantity')
      .notNull()
      .default(sql`1`),
    unit_amount: bigint('unit_amount', { mode: 'number' }).notNull(),
    amount: bigint('amount', { mode: 'number' }).generatedAlwaysAs(sql`quantity * unit_amount`),
    sort_order: integer('sort_order')
      .notNull()
      .default(sql`0`),
  },
  (_t) => [
    check('invoice_lines_quantity_check', sql`quantity > 0`),
    check('invoice_lines_unit_amount_check', sql`unit_amount >= 0`),
  ],
);
export const payment_attempts = pgTable(
  'payment_attempts',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    invoice_id: uuid('invoice_id')
      .notNull()
      .references((): AnyPgColumn => invoices.id),
    approval_id: uuid('approval_id').references((): AnyPgColumn => offer_approvals.id),
    attempt_no: smallint('attempt_no').notNull(),
    provider: text('provider')
      .notNull()
      .default(sql`'xendit'`),
    reference_id: text('reference_id').notNull().unique(),
    payment_session_id: text('payment_session_id').unique(),
    payment_link_url: text('payment_link_url'),
    status: payment_attempt_statusEnum('status')
      .notNull()
      .default(sql`'active'`),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    expires_at: timestamp('expires_at', { withTimezone: true, mode: 'string' }).notNull(),
    completed_at: timestamp('completed_at', { withTimezone: true, mode: 'string' }),
    raw_create_response: jsonb('raw_create_response'),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    unique().on(t.invoice_id, t.attempt_no),
    uniqueIndex('one_active_attempt').on(t.invoice_id).where(sql`
status = 'active'`),
  ],
);
export const services = pgTable(
  'services',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    batch_id: uuid('batch_id')
      .notNull()
      .references((): AnyPgColumn => batches.id, { onDelete: 'cascade' }),
    booking_id: uuid('booking_id').references((): AnyPgColumn => bookings.id),
    traveler_id: uuid('traveler_id').references((): AnyPgColumn => travelers.id),
    type: service_typeEnum('type').notNull(),
    status: service_statusEnum('status')
      .notNull()
      .default(sql`'not_started'`),
    title: localized('title'),
    details: jsonb('details')
      .notNull()
      .default(sql`'{}'`),
    starts_at: timestamp('starts_at', { withTimezone: true, mode: 'string' }),
    ends_at: timestamp('ends_at', { withTimezone: true, mode: 'string' }),
    delivery_method: text('delivery_method'),
    external_app_name: text('external_app_name'),
    delivery_instructions: localized('delivery_instructions'),
    handover_target_on: date('handover_target_on'),
    handover_status: text('handover_status').notNull().default('planned'),
    handed_over_at: timestamp('handed_over_at', { withTimezone: true, mode: 'string' }),
    confirmation_ref: text('confirmation_ref'),
    member_note: localized('member_note'),
    supplier_name: text('supplier_name'),
    supplier_ref: text('supplier_ref'),
    internal_notes: text('internal_notes'),
    published_at: timestamp('published_at', { withTimezone: true, mode: 'string' }),
    updated_by: uuid('updated_by').references((): AnyPgColumn => users.id),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
    updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`)
      .$onUpdate(() => new Date().toISOString()),
  },
  (t) => [
    check(
      'traveler_needs_booking',
      sql`traveler_id is null or booking_id 
is not null`,
    ),
    check('service_delivery_method',sql`delivery_method is null or delivery_method in ('pdf','wallet','external_app','paper','in_person')`),
    check('service_handover_status',sql`handover_status in ('planned','handed_over','not_applicable')`),
    index('services_idx_1').on(t.batch_id, t.type),
    index('services_idx_2').on(t.booking_id),
    index('services_idx_3').on(t.traveler_id),
  ],
);
export const documents = pgTable(
  'documents',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    batch_id: uuid('batch_id').references((): AnyPgColumn => batches.id),
    booking_id: uuid('booking_id').references((): AnyPgColumn => bookings.id),
    traveler_id: uuid('traveler_id').references((): AnyPgColumn => travelers.id),
    service_id: uuid('service_id').references((): AnyPgColumn => services.id, {
      onDelete: 'set null',
    }),
    type: document_typeEnum('type').notNull(),
    status: document_statusEnum('status')
      .notNull()
      .default(sql`'private'`),
    title: localized('title'),
    bucket: text('bucket').notNull(),
    storage_key: text('storage_key').notNull().unique(),
    filename: text('filename').notNull(),
    mime: text('mime').notNull(),
    bytes: integer('bytes').notNull(),
    sha256: text('sha256').notNull(),
    published_at: timestamp('published_at', { withTimezone: true, mode: 'string' }),
    withdrawn_at: timestamp('withdrawn_at', { withTimezone: true, mode: 'string' }),
    uploaded_by: uuid('uploaded_by').references((): AnyPgColumn => users.id),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    check(
      'documents_mime_check',
      sql`mime in 
('application/pdf','image/jpeg','image/png')`,
    ),
    check('documents_bytes_check', sql`bytes <= 20971520`),
    check(
      'has_owner',
      sql`booking_id is not null or batch_id is not null 
or type = 'payment_proof'`,
    ),
    index('documents_idx_1').on(t.booking_id, t.status),
    index('documents_idx_2').on(t.batch_id),
  ],
);
export const payments = pgTable(
  'payments',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    invoice_id: uuid('invoice_id')
      .notNull()
      .references((): AnyPgColumn => invoices.id),
    attempt_id: uuid('attempt_id').references((): AnyPgColumn => payment_attempts.id),
    method: payment_methodEnum('method').notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    currency: char('currency', { length: 3 })
      .notNull()
      .default(sql`'IDR'`),
    provider_payment_id: text('provider_payment_id').unique(),
    channel_code: text('channel_code'),
    reference: text('reference'),
    paid_at: timestamp('paid_at', { withTimezone: true, mode: 'string' }).notNull(),
    proof_document_id: uuid('proof_document_id').references((): AnyPgColumn => documents.id),
    recorded_by: uuid('recorded_by').references((): AnyPgColumn => users.id),
    raw: jsonb('raw'),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
  },
  (_t) => [
    check('payments_amount_check', sql`amount > 0`),
    check(
      'manual_has_recorder',
      sql`method <> 'manual_transfer' or 
recorded_by is not null`,
    ),
  ],
);
export const refunds = pgTable(
  'refunds',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    payment_id: uuid('payment_id')
      .notNull()
      .references((): AnyPgColumn => payments.id),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    method: text('method').notNull(),
    reason: text('reason').notNull(),
    processed_on: date('processed_on').notNull(),
    reference: text('reference'),
    recorded_by: uuid('recorded_by')
      .notNull()
      .references((): AnyPgColumn => users.id),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
  },
  (_t) => [check('refunds_amount_check', sql`amount > 0`)],
);
export const batch_itinerary_items = pgTable(
  'batch_itinerary_items',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    batch_id: uuid('batch_id')
      .notNull()
      .references((): AnyPgColumn => batches.id, { onDelete: 'cascade' }),
    day_number: smallint('day_number').notNull(),
    starts_at_local: time('starts_at_local'),
    ends_at_local: time('ends_at_local'),
    timezone: text('timezone').notNull(),
    title: localized('title').notNull(),
    body: localized('body'),
    location_name: text('location_name'),
    map_url: text('map_url'),
    service_id: uuid('service_id').references((): AnyPgColumn => services.id, {
      onDelete: 'set null',
    }),
    sort_order: integer('sort_order')
      .notNull()
      .default(sql`0`),
    published_at: timestamp('published_at', { withTimezone: true, mode: 'string' }),
    updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`)
      .$onUpdate(() => new Date().toISOString()),
  },
  (t) => [
    check('batch_itinerary_items_day_number_check', sql`day_number > 0`),
    index('batch_itinerary_items_idx_1').on(t.batch_id, t.day_number, t.sort_order),
  ],
);
export const visa_checklist_templates = pgTable(
  'visa_checklist_templates',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    destination: text('destination').notNull(),
    visa_type: text('visa_type').notNull(),
    items: jsonb('items')
      .notNull()
      .default(sql`'[]'`),
    updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`)
      .$onUpdate(() => new Date().toISOString()),
  },
  (t) => [unique().on(t.destination, t.visa_type)],
);
export const visa_applications = pgTable(
  'visa_applications',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    booking_id: uuid('booking_id')
      .notNull()
      .references((): AnyPgColumn => bookings.id, { onDelete: 'cascade' }),
    traveler_id: uuid('traveler_id')
      .notNull()
      .references((): AnyPgColumn => travelers.id),
    destination: text('destination').notNull(),
    visa_type: text('visa_type'),
    stage: visa_stageEnum('stage')
      .notNull()
      .default(sql`'not_started'`),
    appointment_at: timestamp('appointment_at', { withTimezone: true, mode: 'string' }),
    appointment_location: text('appointment_location'),
    submitted_on: date('submitted_on'),
    decided_on: date('decided_on'),
    checklist: jsonb('checklist')
      .notNull()
      .default(sql`'[]'`),
    member_note: localized('member_note'),
    internal_notes: text('internal_notes'),
    updated_by: uuid('updated_by').references((): AnyPgColumn => users.id),
    updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`)
      .$onUpdate(() => new Date().toISOString()),
  },
  (t) => [unique().on(t.booking_id, t.traveler_id, t.destination)],
);
export const content_pages = pgTable('content_pages', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  slug: text('slug').notNull().unique(),
  title: localized('title').notNull(),
  body: jsonb('body'),
  seo: jsonb('seo')
    .notNull()
    .default(sql`'{}'`),
  status: publish_statusEnum('status')
    .notNull()
    .default(sql`'draft'`),
  published_at: timestamp('published_at', { withTimezone: true, mode: 'string' }),
  updated_by: uuid('updated_by').references((): AnyPgColumn => users.id),
  updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .default(sql`now()`)
    .$onUpdate(() => new Date().toISOString()),
});
export const home_sections = pgTable(
  'home_sections',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    kind: text('kind').notNull(),
    data: jsonb('data')
      .notNull()
      .default(sql`'{}'`),
    status: publish_statusEnum('status')
      .notNull()
      .default(sql`'draft'`),
    sort_order: integer('sort_order')
      .notNull()
      .default(sql`0`),
    updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`)
      .$onUpdate(() => new Date().toISOString()),
  },
  (_t) => [
    check(
      'home_sections_kind_check',
      sql`kind in 
('hero','why','sports','season','beyond','how_to_book','team','cta')`,
    ),
  ],
);
export const testimonials = pgTable(
  'testimonials',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    quote: localized('quote').notNull(),
    author_name: text('author_name').notNull(),
    author_context: localized('author_context'),
    package_id: uuid('package_id').references((): AnyPgColumn => packages.id),
    consent_on_file: boolean('consent_on_file')
      .notNull()
      .default(sql`false`),
    status: publish_statusEnum('status')
      .notNull()
      .default(sql`'draft'`),
    sort_order: integer('sort_order')
      .notNull()
      .default(sql`0`),
  },
  (_t) => [
    check(
      'real_and_consented',
      sql`status <> 'published' or 
consent_on_file`,
    ),
  ],
);
export const site_settings = pgTable('site_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updated_by: uuid('updated_by').references((): AnyPgColumn => users.id),
  updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .default(sql`now()`)
    .$onUpdate(() => new Date().toISOString()),
});
export const notification_templates = pgTable(
  'notification_templates',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    key: text('key').notNull(),
    channel: notification_channelEnum('channel').notNull(),
    locale: app_localeEnum('locale').notNull(),
    subject: text('subject'),
    body: text('body'),
    wa_template_name: text('wa_template_name'),
    wa_language: text('wa_language'),
    updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`)
      .$onUpdate(() => new Date().toISOString()),
  },
  (t) => [unique().on(t.key, t.channel, t.locale)],
);
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    user_id: uuid('user_id').references((): AnyPgColumn => users.id),
    booking_id: uuid('booking_id').references((): AnyPgColumn => bookings.id),
    channel: notification_channelEnum('channel').notNull(),
    template_key: text('template_key').notNull(),
    locale: app_localeEnum('locale').notNull(),
    to_address: text('to_address').notNull(),
    payload: jsonb('payload')
      .notNull()
      .default(sql`'{}'`),
    status: notification_statusEnum('status')
      .notNull()
      .default(sql`'queued'`),
    attempts: smallint('attempts')
      .notNull()
      .default(sql`0`),
    provider_message_id: text('provider_message_id'),
    last_error: text('last_error'),
    send_after: timestamp('send_after', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
    sent_at: timestamp('sent_at', { withTimezone: true, mode: 'string' }),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index('notifications_idx_1').on(t.status, t.send_after),
    index('notifications_idx_2').on(t.booking_id),
  ],
);
export const webhook_events = pgTable(
  'webhook_events',
  {
    id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
    provider: text('provider').notNull(),
    event_key: text('event_key').notNull(),
    event_type: text('event_type'),
    payload: jsonb('payload').notNull(),
    received_at: timestamp('received_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
    processed_at: timestamp('processed_at', { withTimezone: true, mode: 'string' }),
    error: text('error'),
  },
  (t) => [unique().on(t.provider, t.event_key)],
);
export const idempotency_keys = pgTable(
  'idempotency_keys',
  {
    user_id: uuid('user_id')
      .notNull()
      .references((): AnyPgColumn => users.id),
    key: text('key').notNull(),
    route: text('route').notNull(),
    request_hash: text('request_hash').notNull(),
    response_status: integer('response_status'),
    response_body: jsonb('response_body'),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [primaryKey({ columns: [t.user_id, t.key] })],
);
export const audit_logs = pgTable(
  'audit_logs',
  {
    id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
    actor_user_id: uuid('actor_user_id').references((): AnyPgColumn => users.id),
    action: text('action').notNull(),
    entity_type: text('entity_type').notNull(),
    entity_id: text('entity_id').notNull(),
    before: jsonb('before'),
    after: jsonb('after'),
    ip: inet('ip'),
    user_agent: text('user_agent'),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index('audit_logs_idx_1').on(t.entity_type, t.entity_id),
    index('audit_logs_idx_2').on(t.actor_user_id, t.created_at),
  ],
);
export const batch_seat_counts = pgView('batch_seat_counts', {
  batch_id: uuid('batch_id'),
  capacity: smallint('capacity'),
  held: bigint('held', { mode: 'number' }),
  confirmed: bigint('confirmed', { mode: 'number' }),
  remaining: bigint('remaining', { mode: 'number' }),
}).as(sql`select b.id as batch_id,
       b.capacity,
       count(bt.id) filter (where bk.status = 'offered')                  as 
held,
       count(bt.id) filter (where bk.status in ('confirmed','completed')) as 
confirmed,
       b.capacity - count(bt.id) filter (where bk.status in 
('offered','confirmed','completed')) as remaining
from batches b
left join bookings bk          on bk.batch_id = b.id
left join booking_travelers bt on bt.booking_id = bk.id and bt.removed_at is 
null
group by b.id`);

export const offer_readiness_checks = pgTable(
  'offer_readiness_checks',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    invoice_id: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    check_key: text('check_key').notNull(),
    required: boolean('required').notNull().default(true),
    passed_at: timestamp('passed_at', { withTimezone: true, mode: 'string' }),
    passed_by: uuid('passed_by').references(() => users.id),
    note: text('note'),
  },
  (t) => [
    unique().on(t.invoice_id, t.check_key),
    check(
      'readiness_key',
      sql`check_key in ('supplier_confirmation','quotation_price','ticket_source_category','event_date_status','services_exclusions','terms_attached')`,
    ),
    check(
      'pass_needs_note',
      sql`passed_at is null or (passed_by is not null and note is not null and length(btrim(note)) > 0)`,
    ),
  ],
);
export const offer_approvals = pgTable('offer_approvals', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  invoice_id: uuid('invoice_id')
    .notNull()
    .unique()
    .references(() => invoices.id),
  booking_id: uuid('booking_id')
    .notNull()
    .references(() => bookings.id),
  user_id: uuid('user_id')
    .notNull()
    .references(() => users.id),
  offer_version: smallint('offer_version').notNull(),
  snapshot: jsonb('snapshot').notNull(),
  snapshot_sha256: text('snapshot_sha256').notNull(),
  terms_version: text('terms_version').notNull(),
  locale: app_localeEnum('locale').notNull(),
  ip: inet('ip'),
  user_agent: text('user_agent'),
  approved_at: timestamp('approved_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
});
export const team_members = pgTable(
  'team_members',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text('name').notNull(),
    role: localized('role').notNull(),
    bio: localized('bio'),
    photo_media_id: uuid('photo_media_id').references(() => media_assets.id),
    verified_at: timestamp('verified_at', { withTimezone: true, mode: 'string' }),
    status: publish_statusEnum('status').notNull().default('draft'),
    sort_order: integer('sort_order').notNull().default(0),
  },
  () => [check('published_needs_verified', sql`status <> 'published' or verified_at is not null`)],
);
export const analytics_events = pgTable(
  'analytics_events',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    occurred_at: timestamp('occurred_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    name: text('name').notNull(),
    anon_session_id: uuid('anon_session_id'),
    user_id: uuid('user_id').references(() => users.id),
    package_id: uuid('package_id').references(() => packages.id),
    lead_id: uuid('lead_id').references(() => leads.id),
    booking_id: uuid('booking_id').references(() => bookings.id),
    locale: app_localeEnum('locale'),
    path: text('path'),
    utm: jsonb('utm')
      .notNull()
      .default(sql`'{}'`),
  },
  (t) => [
    check(
      'analytics_name',
      sql`name in ('product_view','enquiry_started','enquiry_submitted','interest_submitted','whatsapp_click','offer_issued','offer_approved','payment_valid')`,
    ),
    index('analytics_name_date').on(t.name, t.occurred_at),
    index('analytics_package_name_date').on(t.package_id, t.name, t.occurred_at),
  ],
);
export const funnel_daily = pgView('funnel_daily', {
  day: date('day'),
  name: text('name'),
  package_id: uuid('package_id'),
  events: bigint('events', { mode: 'number' }),
  sessions: bigint('sessions', { mode: 'number' }),
}).as(
  sql`select (occurred_at at time zone 'Asia/Jakarta')::date as day,name,package_id,count(*) as events,count(distinct anon_session_id) as sessions from analytics_events group by 1,2,3`,
);
