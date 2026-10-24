# 4 · Backend Schema

The schema has 41 tables in migration 0001 (45 after the V2 migration 0002 at the end of this tab) in PostgreSQL 17, in nine groups. The **batch** is the operational center: bookings attach to a batch, and services, rooms, itinerary items, documents and visa records hang off the batch and its travelers. The DDL below is the source of truth for migration 0001, and the V2 migration 0002 at the end of this tab overrides it: the luxury package kind is removed, dates become optional until verified, and offer approvals are added. Translate it 1:1 into Drizzle in `packages/db/schema/*.ts` and generate migrations with drizzle-kit; never hand-edit generated migrations.

## Conventions

- Primary keys are `uuid default gen_random_uuid()`. Exceptions are append-only logs, which use `bigint generated always as identity`.
- Every mutable table has `created_at` and `updated_at timestamptz`. `updated_at` is set by the app (Drizzle `$onUpdate`), not a trigger.
- Money is `bigint` whole Rupiah. IDR has no minor unit in Xendit, so never use floats or `numeric` for amounts.
- Translatable text uses the `localized_text` domain: `{"id": "...", "en": "..."}`. `id` is required; `en` may be missing and falls back to `id`.
- Rich text (package story, pages) is TipTap JSON per locale: `{"id": <doc>, "en": <doc>}`.
- Soft delete (`deleted_at`) only on `users` and `travelers`. Everything else is hard-deleted or moved to a terminal status.
- Timestamps are UTC. Event and itinerary times are stored as local `time` plus an IANA zone, because a kickoff is "15:00 in Manchester", not an instant.

## Groups

| Group | Tables |
| --- | --- |
| Identity | `users`, `oauth_accounts`, `sessions`, `auth_tokens`, `admin_recovery_codes` |
| Travelers | `travelers` |
| Catalog | `packages`, `package_media`, `package_options`, `package_itinerary_days`, `addons`, `package_addons`, `faqs`, `media_assets` |
| Events and batches | `events`, `batches`, `batch_itinerary_items`, `rooms`, `room_occupants` |
| Bookings | `leads`, `bookings`, `booking_travelers`, `booking_addons` |
| Money | `invoices`, `invoice_lines`, `payment_attempts`, `payments`, `refunds` |
| Operations | `services`, `visa_applications`, `visa_checklist_templates`, `documents` |
| Content | `content_pages`, `home_sections`, `testimonials`, `site_settings` |
| Platform | `notification_templates`, `notifications`, `webhook_events`, `idempotency_keys`, `audit_logs` |

## DDL part 1 · Identity, travelers, catalog, events, bookings

```sql
create extension if not exists citext;
create extension if not exists pgcrypto;

create domain localized_text as jsonb
  check (value is null or (jsonb_typeof(value) = 'object' and jsonb_typeof(value->'id') = 'string'));

-- Enums ---------------------------------------------------------------
create type user_role              as enum ('member','admin');
create type user_status            as enum ('active','suspended','deleted');
create type app_locale             as enum ('id','en');
create type oauth_provider         as enum ('google');
create type auth_token_type        as enum ('email_verify','password_reset');
create type passport_gender        as enum ('female','male','x');
create type dietary_need           as enum ('halal','vegetarian','vegan','no_pork','no_alcohol','other');
create type media_kind             as enum ('image','video');
create type package_kind           as enum ('sport','luxury');
create type sport_kind             as enum ('football','motorsport','tennis','running','other');
create type publish_status         as enum ('draft','published','archived');
create type event_date_status      as enum ('provisional','confirmed','changed','postponed','cancelled');
create type batch_status           as enum ('draft','open','closed','confirmed','in_progress','completed','cancelled');
create type booking_status         as enum ('requested','reviewing','waitlisted','offered','confirmed','completed','declined','expired','cancelled');
create type room_type              as enum ('twin','double','single');
create type invoice_kind           as enum ('package','supplement');
create type invoice_status         as enum ('draft','issued','paid','expired','void');
create type payment_attempt_status as enum ('active','completed','expired','canceled');
create type payment_method         as enum ('xendit','manual_transfer');
create type service_type           as enum ('flight','hotel','event_ticket','transfer','activity','insurance','dining','other');
create type service_status         as enum ('not_started','requested','pending_allocation','confirmed','issued','cancelled');
create type visa_stage             as enum ('not_started','collecting_documents','appointment_booked','submitted','approved','refused','not_required');
create type document_type          as enum ('flight_ticket','hotel_voucher','event_ticket','transfer_voucher','insurance','itinerary','payment_proof','other');
create type document_status        as enum ('private','published','withdrawn');
create type lead_status            as enum ('new','contacted','converted','closed');
create type notification_channel   as enum ('email','whatsapp');
create type notification_status    as enum ('queued','sending','sent','failed','skipped');

create sequence booking_code_seq;   -- CTD-<yy>-<5 digits>
create sequence invoice_number_seq; -- INV-<yyyy>-<6 digits>, assigned at issue time

-- Identity ------------------------------------------------------------
create table users (
  id                uuid primary key default gen_random_uuid(),
  email             citext not null unique,
  email_verified_at timestamptz,
  password_hash     text,                         -- null for Google-only accounts
  full_name         text not null,
  whatsapp_e164     text check (whatsapp_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  whatsapp_opt_in   boolean not null default false,
  locale            app_locale not null default 'id',
  role              user_role not null default 'member',
  status            user_status not null default 'active',
  totp_secret_enc   bytea,                        -- admins only, AES-256-GCM
  totp_enabled_at   timestamptz,
  last_sign_in_at   timestamptz,
  deleted_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint admin_has_password check (role <> 'admin' or password_hash is not null)
);

create table oauth_accounts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references users(id) on delete cascade,
  provider         oauth_provider not null,
  provider_user_id text not null,
  email            citext not null,
  created_at       timestamptz not null default now(),
  unique (provider, provider_user_id),
  unique (user_id, provider)
);

create table sessions (
  id              uuid primary key default gen_random_uuid(),
  token_hash      bytea not null unique,           -- sha256(token)
  user_id         uuid not null references users(id) on delete cascade,
  mfa_verified_at timestamptz,
  ip              inet,
  user_agent      text,
  expires_at      timestamptz not null,
  last_seen_at    timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create index on sessions (user_id);
create index on sessions (expires_at);

create table auth_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  type       auth_token_type not null,
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

create table admin_recovery_codes (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references users(id) on delete cascade,
  code_hash text not null,
  used_at   timestamptz
);

-- Travelers -----------------------------------------------------------
create table travelers (
  id                    uuid primary key default gen_random_uuid(),
  owner_user_id         uuid not null references users(id),
  is_self               boolean not null default false,
  given_names           text not null,               -- exactly as in passport
  surname               text not null,
  gender                passport_gender,
  date_of_birth         date,
  nationality           char(2),                     -- ISO 3166-1 alpha-2
  passport_number_enc   bytea,
  passport_number_last3 text,
  passport_key_version  smallint,
  passport_expiry       date,
  phone_e164            text,
  email                 citext,
  dietary               dietary_need[] not null default '{}',
  dietary_notes         text,
  medical_notes         text,
  relationship          text,                        -- 'spouse', 'child', 'colleague'...
  locked_at             timestamptz,                 -- set while on a confirmed booking (BR-04)
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz
);
create index on travelers (owner_user_id);
create unique index one_self_traveler on travelers (owner_user_id) where is_self and deleted_at is null;

-- Catalog -------------------------------------------------------------
create table media_assets (
  id              uuid primary key default gen_random_uuid(),
  kind            media_kind not null,
  bucket          text not null,
  storage_key     text not null unique,
  mime            text not null,
  bytes           integer not null,
  width           integer,
  height          integer,
  duration_ms     integer,
  alt             localized_text,
  focal_x         numeric(5,2) not null default 50,
  focal_y         numeric(5,2) not null default 50,
  blur_data_url   text,
  variants        jsonb not null default '[]',      -- [{format,width,key}]
  poster_asset_id uuid references media_assets(id),
  is_ai_generated boolean not null default false,
  created_by      uuid references users(id),
  created_at      timestamptz not null default now()
);

create table packages (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,                -- 'OT','EC','RG','WB','F1','BM'
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  kind          package_kind not null,
  sport         sport_kind,
  status        publish_status not null default 'draft',
  title         localized_text not null,
  subtitle      localized_text,
  summary       localized_text,
  story         jsonb,                               -- {id: tiptapDoc, en: tiptapDoc}
  highlights    jsonb not null default '[]',         -- localized_text[]
  inclusions    jsonb not null default '[]',
  exclusions    jsonb not null default '[]',
  hotel_style   localized_text,
  countries     char(2)[] not null default '{}',
  cities        text[] not null default '{}',
  nights_min    smallint,
  nights_max    smallint,
  hero_media_id uuid references media_assets(id),
  hero_video_id uuid references media_assets(id),
  terms         localized_text,                      -- cancellation terms shown before payment
  visa_note     localized_text,
  seo           jsonb not null default '{}',         -- {title, description, og_image_id}
  featured      boolean not null default false,
  sort_order    integer not null default 0,
  published_at  timestamptz,
  created_by    uuid references users(id),
  updated_by    uuid references users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint sport_required check (kind = 'luxury' or sport is not null)
);

create table package_media (
  package_id uuid not null references packages(id) on delete cascade,
  media_id   uuid not null references media_assets(id),
  caption    localized_text,
  sort_order integer not null default 0,
  primary key (package_id, media_id)
);

create table package_options (
  id                   uuid primary key default gen_random_uuid(),
  package_id           uuid not null references packages(id) on delete cascade,
  code                 text not null,               -- 'STANDARD','HOSPITALITY','RUNNER','COMPANION'
  name                 localized_text not null,
  description          localized_text,
  includes_event_entry boolean not null default true,
  active               boolean not null default true,
  sort_order           integer not null default 0,
  unique (package_id, code)
);

create table package_itinerary_days (
  id         uuid primary key default gen_random_uuid(),
  package_id uuid not null references packages(id) on delete cascade,
  day_number smallint not null check (day_number > 0),
  title      localized_text not null,
  body       localized_text,
  city       text,
  media_id   uuid references media_assets(id),
  unique (package_id, day_number)
);

create table addons (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,
  name           localized_text not null,
  description    localized_text,
  media_id       uuid references media_assets(id),
  applies_to_all boolean not null default false,
  status         publish_status not null default 'draft',
  sort_order     integer not null default 0
);

create table package_addons (
  package_id uuid not null references packages(id) on delete cascade,
  addon_id   uuid not null references addons(id) on delete cascade,
  primary key (package_id, addon_id)
);

create table faqs (
  id         uuid primary key default gen_random_uuid(),
  package_id uuid references packages(id) on delete cascade,   -- null = site-wide FAQ
  question   localized_text not null,
  answer     localized_text not null,
  status     publish_status not null default 'draft',
  sort_order integer not null default 0
);

-- Events and batches --------------------------------------------------
create table events (
  id               uuid primary key default gen_random_uuid(),
  name             localized_text not null,          -- 'Manchester United vs Everton'
  sport            sport_kind not null,
  competition      text,                             -- 'Premier League', 'Italian Grand Prix'
  home_side        text,
  away_side        text,
  venue            text not null,
  city             text not null,
  country          char(2) not null,
  starts_on        date not null,
  ends_on          date not null check (ends_on >= starts_on),
  start_time_local time,                             -- null until announced
  timezone         text not null,                    -- IANA, e.g. 'Europe/London'
  date_status      event_date_status not null default 'provisional',
  source_url       text,
  last_checked_at  timestamptz,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table batches (
  id                   uuid primary key default gen_random_uuid(),
  package_id           uuid not null references packages(id),
  event_id             uuid references events(id),
  code                 text not null unique,         -- 'OT-27-0313'
  title                localized_text,               -- optional override of package title
  start_date           date not null,
  end_date             date not null check (end_date >= start_date),
  nights               smallint generated always as ((end_date - start_date)) stored,
  capacity             smallint not null check (capacity > 0),
  min_pax              smallint not null default 1,
  hotel_category       text,
  request_cutoff       date,
  status               batch_status not null default 'draft',
  tour_leader_name     text,
  tour_leader_whatsapp text,
  meeting_point        localized_text,
  member_notes         localized_text,
  supplier_name        text,                         -- admin-only (D-01)
  supplier_ref         text,                         -- admin-only
  internal_notes       text,
  created_by           uuid references users(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint min_le_capacity check (min_pax <= capacity)
);
create index on batches (package_id, status);
create index on batches (event_id);

create table rooms (
  id               uuid primary key default gen_random_uuid(),
  batch_id         uuid not null references batches(id) on delete cascade,
  hotel_service_id uuid,                             -- fk added in part 2, after services
  room_type        room_type not null,
  label            text,                             -- 'Room 1'
  notes            text
);

-- Bookings ------------------------------------------------------------
create table leads (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  email         citext not null,
  whatsapp_e164 text,
  package_id    uuid references packages(id),
  message       text,
  locale        app_locale not null default 'id',
  status        lead_status not null default 'new',
  user_id       uuid references users(id),
  source        text,
  ip            inet,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table bookings (
  id                   uuid primary key default gen_random_uuid(),
  code                 text not null unique,
  user_id              uuid not null references users(id),
  package_id           uuid not null references packages(id),
  batch_id             uuid references batches(id),            -- assigned by admin
  preferred_batch_id   uuid references batches(id),            -- member's choice, may be null
  status               booking_status not null default 'requested',
  room_preference      room_type,
  member_notes         text,
  internal_notes       text,
  decline_reason       localized_text,
  cancel_reason        text,
  cancelled_by_user_id uuid references users(id),
  lead_id              uuid references leads(id),
  requested_at         timestamptz not null default now(),
  reviewed_at          timestamptz,
  offered_at           timestamptz,
  confirmed_at         timestamptz,
  completed_at         timestamptz,
  cancelled_at         timestamptz,
  expired_at           timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint batch_needed check (status in ('requested','reviewing','waitlisted','declined','cancelled') or batch_id is not null)
);
create index on bookings (user_id);
create index on bookings (batch_id, status);
create index on bookings (status, requested_at);

create table booking_travelers (
  id                uuid primary key default gen_random_uuid(),
  booking_id        uuid not null references bookings(id) on delete cascade,
  traveler_id       uuid not null references travelers(id),
  package_option_id uuid references package_options(id),
  is_lead           boolean not null default false,
  removed_at        timestamptz,
  created_at        timestamptz not null default now(),
  unique (booking_id, traveler_id)
);
create index on booking_travelers (traveler_id);

create table booking_addons (
  id                  uuid primary key default gen_random_uuid(),
  booking_id          uuid not null references bookings(id) on delete cascade,
  addon_id            uuid not null references addons(id),
  booking_traveler_id uuid references booking_travelers(id),
  state               text not null check (state in ('interested','included','declined')),
  notes               text
);

create table room_occupants (
  room_id             uuid not null references rooms(id) on delete cascade,
  booking_traveler_id uuid not null references booking_travelers(id) on delete cascade,
  primary key (room_id, booking_traveler_id)
);
```

## DDL part 2 · Money, operations, content, platform

```sql
-- Money ---------------------------------------------------------------
create table invoices (
  id               uuid primary key default gen_random_uuid(),
  number           text unique,                       -- null while draft
  booking_id       uuid not null references bookings(id),
  user_id          uuid not null references users(id),
  kind             invoice_kind not null,
  status           invoice_status not null default 'draft',
  currency         char(3) not null default 'IDR' check (currency = 'IDR'),
  subtotal         bigint not null check (subtotal >= 0),
  discount         bigint not null default 0 check (discount >= 0),
  total            bigint not null,
  due_at           timestamptz,
  allowed_channels text[] not null default '{}',      -- Xendit channel codes; empty = all active
  note             localized_text,
  needs_review     boolean not null default false,
  review_reason    text,
  issued_at        timestamptz,
  issued_by        uuid references users(id),
  paid_at          timestamptz,
  expired_at       timestamptz,
  voided_at        timestamptz,
  void_reason      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint total_math check (total = subtotal - discount and total > 0),
  constraint issued_has_due check (status = 'draft' or due_at is not null)
);
create unique index one_live_package_invoice on invoices (booking_id)
  where kind = 'package' and status in ('issued','paid');
create index on invoices (status, due_at);

create table invoice_lines (
  id                  uuid primary key default gen_random_uuid(),
  invoice_id          uuid not null references invoices(id) on delete cascade,
  description         localized_text not null,
  booking_traveler_id uuid references booking_travelers(id),
  addon_id            uuid references addons(id),
  quantity            integer not null default 1 check (quantity > 0),
  unit_amount         bigint not null check (unit_amount >= 0),
  amount              bigint generated always as (quantity * unit_amount) stored,
  sort_order          integer not null default 0
);

create table payment_attempts (
  id                  uuid primary key default gen_random_uuid(),
  invoice_id          uuid not null references invoices(id),
  attempt_no          smallint not null,
  provider            text not null default 'xendit',
  reference_id        text not null unique,           -- inv_<invoice_id>_a<n>
  payment_session_id  text unique,                    -- ps-...
  payment_link_url    text,
  status              payment_attempt_status not null default 'active',
  amount              bigint not null,
  expires_at          timestamptz not null,
  completed_at        timestamptz,
  raw_create_response jsonb,
  created_at          timestamptz not null default now(),
  unique (invoice_id, attempt_no)
);
create unique index one_active_attempt on payment_attempts (invoice_id) where status = 'active';

-- Operations ----------------------------------------------------------
create table services (
  id               uuid primary key default gen_random_uuid(),
  batch_id         uuid not null references batches(id) on delete cascade,
  booking_id       uuid references bookings(id),
  traveler_id      uuid references travelers(id),
  type             service_type not null,
  status           service_status not null default 'not_started',
  title            localized_text,
  details          jsonb not null default '{}',       -- validated per type (table below)
  starts_at        timestamptz,
  ends_at          timestamptz,
  confirmation_ref text,                              -- member-visible: PNR, hotel conf. no.
  member_note      localized_text,
  supplier_name    text,                              -- admin-only
  supplier_ref     text,                              -- admin-only
  internal_notes   text,
  published_at     timestamptz,
  updated_by       uuid references users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint traveler_needs_booking check (traveler_id is null or booking_id is not null)
);
create index on services (batch_id, type);
create index on services (booking_id);
create index on services (traveler_id);

alter table rooms add foreign key (hotel_service_id) references services(id) on delete set null;

create table documents (
  id           uuid primary key default gen_random_uuid(),
  batch_id     uuid references batches(id),
  booking_id   uuid references bookings(id),
  traveler_id  uuid references travelers(id),
  service_id   uuid references services(id) on delete set null,
  type         document_type not null,
  status       document_status not null default 'private',
  title        localized_text,
  bucket       text not null,
  storage_key  text not null unique,
  filename     text not null,
  mime         text not null check (mime in ('application/pdf','image/jpeg','image/png')),
  bytes        integer not null check (bytes <= 20971520),
  sha256       text not null,
  published_at timestamptz,
  withdrawn_at timestamptz,
  uploaded_by  uuid references users(id),
  created_at   timestamptz not null default now(),
  constraint has_owner check (booking_id is not null or batch_id is not null or type = 'payment_proof')
);
create index on documents (booking_id, status);
create index on documents (batch_id);

create table payments (
  id                  uuid primary key default gen_random_uuid(),
  invoice_id          uuid not null references invoices(id),
  attempt_id          uuid references payment_attempts(id),
  method              payment_method not null,
  amount              bigint not null check (amount > 0),
  currency            char(3) not null default 'IDR',
  provider_payment_id text unique,                    -- Xendit payment id
  channel_code        text,
  reference           text,                           -- bank transfer reference
  paid_at             timestamptz not null,
  proof_document_id   uuid references documents(id),
  recorded_by         uuid references users(id),      -- manual only
  raw                 jsonb,
  created_at          timestamptz not null default now(),
  constraint manual_has_recorder check (method <> 'manual_transfer' or recorded_by is not null)
);

create table refunds (
  id           uuid primary key default gen_random_uuid(),
  payment_id   uuid not null references payments(id),
  amount       bigint not null check (amount > 0),
  method       text not null,                         -- 'bank_transfer', 'card_reversal'...
  reason       text not null,
  processed_on date not null,
  reference    text,
  recorded_by  uuid not null references users(id),
  created_at   timestamptz not null default now()
);

create table batch_itinerary_items (
  id              uuid primary key default gen_random_uuid(),
  batch_id        uuid not null references batches(id) on delete cascade,
  day_number      smallint not null check (day_number > 0),
  starts_at_local time,
  ends_at_local   time,
  timezone        text not null,
  title           localized_text not null,
  body            localized_text,
  location_name   text,
  map_url         text,
  service_id      uuid references services(id) on delete set null,
  sort_order      integer not null default 0,
  published_at    timestamptz,
  updated_at      timestamptz not null default now()
);
create index on batch_itinerary_items (batch_id, day_number, sort_order);

create table visa_checklist_templates (
  id          uuid primary key default gen_random_uuid(),
  destination text not null,                          -- 'SCHENGEN', 'GB'
  visa_type   text not null,                          -- 'short_stay_tourism', 'standard_visitor'
  items       jsonb not null default '[]',            -- [{label: localized_text}]
  updated_at  timestamptz not null default now(),
  unique (destination, visa_type)
);

create table visa_applications (
  id                   uuid primary key default gen_random_uuid(),
  booking_id           uuid not null references bookings(id) on delete cascade,
  traveler_id          uuid not null references travelers(id),
  destination          text not null,
  visa_type            text,
  stage                visa_stage not null default 'not_started',
  appointment_at       timestamptz,
  appointment_location text,
  submitted_on         date,
  decided_on           date,
  checklist            jsonb not null default '[]',   -- [{label: localized_text, done: bool}]
  member_note          localized_text,
  internal_notes       text,
  updated_by           uuid references users(id),
  updated_at           timestamptz not null default now(),
  unique (booking_id, traveler_id, destination)
);

-- Content -------------------------------------------------------------
create table content_pages (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,                  -- 'about', 'how-it-works', 'legal/terms'
  title        localized_text not null,
  body         jsonb,                                 -- {id: tiptapDoc, en: tiptapDoc}
  seo          jsonb not null default '{}',
  status       publish_status not null default 'draft',
  published_at timestamptz,
  updated_by   uuid references users(id),
  updated_at   timestamptz not null default now()
);

create table home_sections (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('hero','season','collection','how_it_works','testimonials','cta')),
  data       jsonb not null default '{}',
  status     publish_status not null default 'draft',
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create table testimonials (
  id              uuid primary key default gen_random_uuid(),
  quote           localized_text not null,
  author_name     text not null,                      -- as the guest agreed, e.g. 'Rina, Jakarta'
  author_context  localized_text,                     -- 'El Clásico 2027'
  package_id      uuid references packages(id),
  consent_on_file boolean not null default false,
  status          publish_status not null default 'draft',
  sort_order      integer not null default 0,
  constraint real_and_consented check (status <> 'published' or consent_on_file)
);

create table site_settings (
  key        text primary key,                        -- 'contact', 'social', 'whatsapp_click_to_chat'
  value      jsonb not null,
  updated_by uuid references users(id),
  updated_at timestamptz not null default now()
);

-- Platform ------------------------------------------------------------
create table notification_templates (
  id               uuid primary key default gen_random_uuid(),
  key              text not null,                     -- 'offer_ready'
  channel          notification_channel not null,
  locale           app_locale not null,
  subject          text,                              -- email only
  body             text,                              -- email markdown with {{vars}}
  wa_template_name text,                              -- approved Meta template name
  wa_language      text,                              -- 'id', 'en'
  updated_at       timestamptz not null default now(),
  unique (key, channel, locale)
);

create table notifications (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references users(id),
  booking_id          uuid references bookings(id),
  channel             notification_channel not null,
  template_key        text not null,
  locale              app_locale not null,
  to_address          text not null,
  payload             jsonb not null default '{}',
  status              notification_status not null default 'queued',
  attempts            smallint not null default 0,
  provider_message_id text,
  last_error          text,
  send_after          timestamptz not null default now(),
  sent_at             timestamptz,
  created_at          timestamptz not null default now()
);
create index on notifications (status, send_after);
create index on notifications (booking_id);

create table webhook_events (
  id           bigint generated always as identity primary key,
  provider     text not null,
  event_key    text not null,
  event_type   text,
  payload      jsonb not null,
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  error        text,
  unique (provider, event_key)
);

create table idempotency_keys (
  user_id         uuid not null references users(id),
  key             text not null,
  route           text not null,
  request_hash    text not null,
  response_status integer,
  response_body   jsonb,
  created_at      timestamptz not null default now(),
  primary key (user_id, key)
);

create table audit_logs (
  id            bigint generated always as identity primary key,
  actor_user_id uuid references users(id),            -- null = system job
  action        text not null,                        -- 'invoice.issue', 'service.status'
  entity_type   text not null,
  entity_id     text not null,
  before        jsonb,
  after         jsonb,
  ip            inet,
  user_agent    text,
  created_at    timestamptz not null default now()
);
create index on audit_logs (entity_type, entity_id);
create index on audit_logs (actor_user_id, created_at);

-- Derived: seat counter (FR-72) --------------------------------------
create view batch_seat_counts as
select b.id as batch_id,
       b.capacity,
       count(bt.id) filter (where bk.status = 'offered')                  as held,
       count(bt.id) filter (where bk.status in ('confirmed','completed')) as confirmed,
       b.capacity - count(bt.id) filter (where bk.status in ('offered','confirmed','completed')) as remaining
from batches b
left join bookings bk          on bk.batch_id = b.id
left join booking_travelers bt on bt.booking_id = bk.id and bt.removed_at is null
group by b.id;
```

## Service details by type

`services.details` is validated by a Zod discriminated union on `type` in `packages/contracts`. Fields marked *member* are returned to members once the service is published; the rest are admin-only.

| Type | Fields in `details` |
| --- | --- |
| `flight` | `segments[]`: airline (member), flight\_no (member), from\_iata, to\_iata, depart\_local, arrive\_local, depart\_tz, arrive\_tz (all member), cabin (member), baggage (member); ticket\_number (member) |
| `hotel` | hotel\_name, address, city, phone, website, check\_in\_date, check\_out\_date, room\_type, board (`room_only`, `breakfast`, `half_board`), star\_rating (all member) |
| `event_ticket` | event\_id, category (member), section, row, seat (member once allocated), hospitality (bool, member), seats\_together (bool, member), delivery (`mobile_app`, `pdf`, `paper`, member) |
| `transfer` | pickup\_place, dropoff\_place, pickup\_local, vehicle (`private_car`, `van`, `coach`), driver\_name, driver\_phone (all member) |
| `activity` | name, place, meeting\_point, duration\_minutes, guide\_language (`id`, `en`) (all member) |
| `insurance` | insurer, policy\_number, coverage\_summary, valid\_from, valid\_to (all member) |
| `dining` | restaurant, place, time\_local, halal (`certified`, `friendly`, `no`), dress\_code (all member) |
| `other` | free `label` + `value` pairs (member) |

**Which services fill an operations board cell** (traveler T, type X): rows where `traveler_id = T`; plus rows where `traveler_id is null and booking_id = T's booking` (shared by the booking); plus rows where `booking_id is null` in T's batch (shared by everyone, e.g. the group coach).

## Seed data (`packages/db/seed.ts`)

1. One admin user from env (`SEED_ADMIN_EMAIL`), forced to enroll TOTP on first sign-in.
2. The six packages from the PRD pilot catalog (codes OT, EC, RG, WB, F1, BM), as `draft`, with ID/EN titles and options. BM gets `RUNNER` and `COMPANION`. Football packages get `STANDARD` and `HOSPITALITY`.
3. Events from the brief with `date_status = 'provisional'`, the right IANA zone (Europe/London, Europe/Madrid, Europe/Paris, Europe/Rome, Europe/Berlin), and `source_url` from the brief's source list.
4. One `draft` batch per event with capacity 20 and min\_pax 10. Admin sets the dates.
5. Add-ons: hospitality seats, 5-star hotel upgrade, private airport transfer, fine dining evening, personal shopping concierge.
6. Visa checklist templates for `SCHENGEN / short_stay_tourism` and `GB / standard_visitor`, with placeholder items for Citadel to complete.
7. Notification templates for every key listed in the TRD, in ID and EN.

## Schema pitfalls

- [ ] **Seat races:** issuing an offer must `select ... from batches where id = $1 for update` before counting seats. Otherwise two admins can oversell the last seats.
- [ ] **One traveler, one active booking per batch:** enforce it in the issue-offer transaction. It spans tables, so a partial unique index can't express it.
- [ ] **`invoice_number_seq` can skip numbers** when a transaction rolls back. That's fine for receipts. Confirm with Citadel's accountant before invoice numbers are used on tax documents.
- [ ] **Generated columns** (`nights`, `amount`) must be declared `generatedAlwaysAs` in Drizzle and never inserted.
- [ ] **`localized_text` domain:** Drizzle has no domain type. Declare it as `jsonb().$type<LocalizedText>()` and keep the domain in a hand-written SQL migration that runs first.
- [ ] **Enums only grow:** after launch, add values with `alter type ... add value`, and never rename or remove them.
- [ ] **Never cascade-delete money:** `invoices`, `payments` and `refunds` have no `on delete cascade` from bookings or users. Account deletion anonymizes; it never deletes.

## V2 migration 0002

This is a specification, not a migration that has run. It follows the V2 brief (18 October 2026) and the owner direction of 23 October 2026: the catalog is sport only. **If 0001 has not been applied anywhere yet, fold these statements into 0001 and delete `package_kind`** instead of running both. Statements marked *own transaction* must be committed before anything uses the new enum value.

```sql
-- 1. Sport-only catalog: remove the luxury kind
alter table packages drop constraint sport_required;
alter table packages alter column sport set not null;
alter table packages drop column kind;
drop type package_kind;

-- 2. Package readiness, supplier proof and pre-payment proof points
create type package_readiness as enum ('draft','interest_only','ready_to_offer');

alter table packages
  add column readiness            package_readiness not null default 'draft',
  add column supplier_verified_at timestamptz,
  add column supplier_verified_by uuid references users(id),
  add column coverage_verified_at timestamptz,
  add column quotation_ref        text,            -- admin-only
  add column sales_rights_note    text,            -- admin-only: how the right to sell was verified
  add column nights_note          localized_text,  -- known duration or night range, public
  add column proof_points         jsonb not null default '[]',  -- [{key, label, value}] shown before payment
  add column interest_label       localized_text;  -- 'Kami sedang menyiapkan perjalanan ini'

alter table packages add constraint ready_requires_verification
  check (readiness <> 'ready_to_offer'
         or (supplier_verified_at is not null
             and coverage_verified_at is not null
             and sales_rights_note is not null));
alter table packages add constraint published_not_draft
  check (status <> 'published' or readiness <> 'draft');

-- 3. Event dates optional until verified
-- (own transaction) the new value cannot be used before commit
alter type event_date_status add value if not exists 'tba';

alter table events
  alter column starts_on drop not null,
  alter column ends_on   drop not null,
  add column date_verified_at timestamptz,
  add column date_verified_by uuid references users(id),
  add column date_source_note text;

alter table events add constraint verified_date_needs_source
  check (date_verified_at is null
         or (starts_on is not null and ends_on is not null and source_url is not null));

-- 4. Batches: dates optional while draft; four certainties kept separate
alter table batches
  alter column start_date drop not null,
  alter column end_date   drop not null;

alter table batches add constraint dates_needed_after_draft
  check (status in ('draft','cancelled') or (start_date is not null and end_date is not null));

create type ticket_allocation_status as enum ('not_requested','requested','partial','allocated');

alter table batches
  add column ticket_allocation_status ticket_allocation_status not null default 'not_requested',
  add column ticket_allocation_note   localized_text,
  add column departure_confirmed_at   timestamptz;

alter table batches add constraint confirmed_has_timestamp
  check (status not in ('confirmed','in_progress','completed') or departure_confirmed_at is not null);

-- 5. Leads: light enquiry and attribution
-- (own transaction)
alter type lead_status add value if not exists 'qualified' before 'converted';

alter table leads
  alter column email drop not null,
  alter column whatsapp_e164 set not null,
  add column interest_kind    text not null default 'product'
      check (interest_kind in ('product','sport','concept','other')),
  add column sport            sport_kind,
  add column party_size       smallint check (party_size between 1 and 50),  -- required by the API, optional in the database
  add column preferred_period text,
  add column budget_note      text,
  add column concept_label    text,
  add column landing_path     text,
  add column referrer         text,
  add column utm_source       text,
  add column utm_medium       text,
  add column utm_campaign     text,
  add column utm_content      text,
  add column utm_term         text,
  add column anon_session_id  uuid,
  add column qualified_at     timestamptz,
  add column qualified_by     uuid references users(id),
  add column first_response_at timestamptz,
  add column first_response_by uuid references users(id);

alter table leads add constraint whatsapp_format
  check (whatsapp_e164 ~ '^\+[1-9][0-9]{7,14}$');

-- 6. Offers: versions, readiness checks and the approval snapshot
-- Each offer version is its own invoice row. Editing an issued offer voids the old
-- invoice (set superseded_by) and creates a new one with offer_version + 1.
alter table invoices
  add column offer_version          smallint not null default 1,
  add column superseded_by          uuid references invoices(id),
  add column readiness_confirmed_at timestamptz,
  add column readiness_confirmed_by uuid references users(id);

alter table invoices add constraint issued_needs_readiness
  check (status in ('draft','void') or readiness_confirmed_at is not null);

create table offer_readiness_checks (
  id         uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  check_key  text not null check (check_key in (
               'supplier_confirmation','quotation_price','ticket_source_category',
               'event_date_status','services_exclusions','terms_attached')),
  required   boolean not null default true,
  passed_at  timestamptz,
  passed_by  uuid references users(id),
  note       text,
  unique (invoice_id, check_key),
  constraint pass_needs_note check (
    passed_at is null or (passed_by is not null and note is not null and length(btrim(note)) > 0))
);

create table offer_approvals (
  id              uuid primary key default gen_random_uuid(),
  invoice_id      uuid not null unique references invoices(id),
  booking_id      uuid not null references bookings(id),
  user_id         uuid not null references users(id),
  offer_version   smallint not null,
  snapshot        jsonb not null,        -- lines, totals, deadline, services, tickets, event status, terms
  snapshot_sha256 text not null,
  terms_version   text not null,
  locale          app_locale not null,
  ip              inet,
  user_agent      text,
  approved_at     timestamptz not null default now()
);

-- Append-only: approvals are evidence and are never edited or deleted.
create function offer_approvals_append_only() returns trigger language plpgsql as $$
begin
  raise exception 'offer_approvals is append-only';
end $$;
create trigger offer_approvals_no_change
  before update or delete on offer_approvals
  for each row execute function offer_approvals_append_only();

-- No pay link without an approval (run before any attempt rows exist)
alter table payment_attempts
  add column approval_id uuid not null references offer_approvals(id);

-- 7. Services: delivery method and handover target
alter table services
  add column delivery_method       text
      check (delivery_method in ('pdf','wallet','external_app','paper','in_person')),
  add column external_app_name     text,
  add column delivery_instructions localized_text,
  add column handover_target_on    date,
  add column handover_status       text not null default 'planned'
      check (handover_status in ('planned','handed_over','not_applicable')),
  add column handed_over_at        timestamptz;
create index on services (handover_target_on) where handover_status = 'planned';

-- 8. Media rights
alter table media_assets
  add column rights_status text not null default 'unverified'
      check (rights_status in ('unverified','owned','licensed','commissioned','ai_placeholder')),
  add column license_note  text,
  add column license_expires_on date;

-- 9. Team profiles and home sections
create table team_members (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  role           localized_text not null,
  bio            localized_text,
  photo_media_id uuid references media_assets(id),
  verified_at    timestamptz,
  status         publish_status not null default 'draft',
  sort_order     integer not null default 0,
  constraint published_needs_verified check (status <> 'published' or verified_at is not null)
);

alter table home_sections drop constraint home_sections_kind_check;
alter table home_sections add constraint home_sections_kind_check
  check (kind in ('hero','why','sports','season','beyond','how_to_book','team','cta'));

insert into site_settings (key, value) values
  ('trust_line_enabled', 'false'),
  ('claims_terms', '["first","pertama","official partner","mitra resmi","vip","24 jam","24 hours","24/7"]');

-- 10. Minimum first-party analytics
create table analytics_events (
  id              bigint generated always as identity primary key,
  occurred_at     timestamptz not null default now(),
  name            text not null check (name in (
                    'product_view','enquiry_started','enquiry_submitted','interest_submitted',
                    'whatsapp_click','offer_issued','offer_approved','payment_valid')),
  anon_session_id uuid,
  user_id         uuid references users(id),
  package_id      uuid references packages(id),
  lead_id         uuid references leads(id),
  booking_id      uuid references bookings(id),
  locale          app_locale,
  path            text,
  utm             jsonb not null default '{}'
);
create index on analytics_events (name, occurred_at);
create index on analytics_events (package_id, name, occurred_at);

create view funnel_daily as
select (occurred_at at time zone 'Asia/Jakarta')::date as day,
       name, package_id,
       count(*)                        as events,
       count(distinct anon_session_id) as sessions
from analytics_events
group by 1, 2, 3;
```

## V2 changes to seed data

1. Packages use the V2 names with codes unchanged: OT *Old Trafford Experience*, EC *El Clásico Experience*, RG *Paris Tennis & Lifestyle*, WB *Wimbledon & London*, F1 *Monza Race Weekend*, BM *Berlin Marathon Experience*. All are `readiness = 'draft'`. `sport` is set (football, football, tennis, tennis, motorsport, running). There are no luxury packages and no `kind`.
2. Events keep the dates from the original brief with `date_status = 'provisional'` and `date_verified_at = null`, so the public site shows them as “To be announced” until an admin verifies them with a source.
3. Draft batches may have empty dates. This also fixes migration 0001, whose seed assumed empty dates although `start_date` and `end_date` were `not null`.
4. Add-ons: hospitality seats, hotel upgrade, private airport transfer, dining evening, guided city experience. They are plain add-ons.
5. The `event_ticket` service type no longer has a `delivery` field in `details`; use `services.delivery_method`.
6. Notification templates: add `lead_autoreply` (email, ID/EN). The existing `offer_ready` text now asks the member to review and approve the offer.

## V2 schema pitfalls

- [ ] **Enum additions** (`tba`, `qualified`) run in their own transaction. Drizzle-kit may need them split into separate migration files.
- [ ] **`nights` is null** while batch dates are empty. The UI and CSV exports must handle null.
- [ ] **`offer_approvals` is append-only** by trigger. Tests must prove an update or delete fails, and that account anonymization never touches it.
- [ ] **`payment_attempts.approval_id`** is `not null`. Add it before any attempt exists, or backfill first.
- [ ] **One approval per invoice:** a new offer version is a new invoice, so approvals never need an update.
- [ ] **Never leak draft dates:** the public API checks `date_verified_at`, not just `starts_on`.
- [ ] **`party_size` and `whatsapp`:** the API requires party size, but the database allows null because leads can come from other channels. The WhatsApp format check applies to every lead.
- [ ] **Do not reuse `package_kind`:** any code, seed or UI that mentions it is a leftover from the baseline.
