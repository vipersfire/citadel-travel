-- Canonical baseline imported from Backend Schema.pdf. gen_random_uuid is built into PostgreSQL 17.
create extension if not exists citext;
create domain localized_text as jsonb
  check (value is null or (jsonb_typeof(value) = 'object' and 
jsonb_typeof(value->'id') = 'string'));
create type user_role              as enum ('member','admin');
create type user_status            as enum ('active','suspended','deleted');
create type app_locale             as enum ('id','en');
create type oauth_provider         as enum ('google');
create type auth_token_type        as enum ('email_verify','password_reset');
create type passport_gender        as enum ('female','male','x');
create type dietary_need           as enum 
('halal','vegetarian','vegan','no_pork','no_alcohol','other');
create type media_kind             as enum ('image','video');
create type package_kind           as enum ('sport','luxury');
create type sport_kind             as enum 
('football','motorsport','tennis','running','other');
create type publish_status         as enum ('draft','published','archived');
create type event_date_status      as enum 
('provisional','confirmed','changed','postponed','cancelled');
create type batch_status           as enum 
('draft','open','closed','confirmed','in_progress','completed','cancelled');
create type booking_status         as enum 
('requested','reviewing','waitlisted','offered','confirmed','completed','declined','expired','cancelled');
create type room_type              as enum ('twin','double','single');
create type invoice_kind           as enum ('package','supplement');
create type invoice_status         as enum 
('draft','issued','paid','expired','void');
create type payment_attempt_status as enum 
('active','completed','expired','canceled');
create type payment_method         as enum ('xendit','manual_transfer');
create type service_type           as enum 
('flight','hotel','event_ticket','transfer','activity','insurance','dining','other');
create type service_status         as enum 
('not_started','requested','pending_allocation','confirmed','issued','cancelled');
create type visa_stage             as enum 
('not_started','collecting_documents','appointment_booked','submitted','approved','refused','not_required');
create type document_type          as enum 
('flight_ticket','hotel_voucher','event_ticket','transfer_voucher','insurance','itinerary','payment_proof','other');
create type document_status        as enum 
('private','published','withdrawn');
create type lead_status            as enum 
('new','contacted','converted','closed');
create type notification_channel   as enum ('email','whatsapp');
create type notification_status    as enum 
('queued','sending','sent','failed','skipped');
create sequence booking_code_seq;   
create sequence invoice_number_seq; 
create table users (
  id                uuid primary key default gen_random_uuid(),
  email             citext not null unique,
  email_verified_at timestamptz,
  password_hash     text,                         
  full_name         text not null,
  whatsapp_e164     text check (whatsapp_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  whatsapp_opt_in   boolean not null default false,
  locale            app_locale not null default 'id',
  role              user_role not null default 'member',
  status            user_status not null default 'active',
  totp_secret_enc   bytea,                        
  totp_enabled_at   timestamptz,
  last_sign_in_at   timestamptz,
  deleted_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint admin_has_password check (role <> 'admin' or password_hash is 
not null)
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
  token_hash      bytea not null unique,           
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
create table travelers (
  id                    uuid primary key default gen_random_uuid(),
  owner_user_id         uuid not null references users(id),
  is_self               boolean not null default false,
  given_names           text not null,               
  surname               text not null,
  gender                passport_gender,
  date_of_birth         date,
  nationality           char(2),                     
  passport_number_enc   bytea,
  passport_number_last3 text,
  passport_key_version  smallint,
  passport_expiry       date,
  phone_e164            text,
  email                 citext,
  dietary               dietary_need[] not null default '{}',
  dietary_notes         text,
  medical_notes         text,
  relationship          text,                        
  locked_at             timestamptz,                 
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz
);
create index on travelers (owner_user_id);
create unique index one_self_traveler on travelers (owner_user_id) where 
is_self and deleted_at is null;
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
  variants        jsonb not null default '[]',      
  poster_asset_id uuid references media_assets(id),
  is_ai_generated boolean not null default false,
  created_by      uuid references users(id),
  created_at      timestamptz not null default now()
);
create table packages (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,                
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  kind          package_kind not null,
  sport         sport_kind,
  status        publish_status not null default 'draft',
  title         localized_text not null,
  subtitle      localized_text,
  summary       localized_text,
  story         jsonb,                               
  highlights    jsonb not null default '[]',         
  inclusions    jsonb not null default '[]',
  exclusions    jsonb not null default '[]',
  hotel_style   localized_text,
  countries     char(2)[] not null default '{}',
  cities        text[] not null default '{}',
  nights_min    smallint,
  nights_max    smallint,
  hero_media_id uuid references media_assets(id),
  hero_video_id uuid references media_assets(id),
  terms         localized_text,                      
  visa_note     localized_text,
  seo           jsonb not null default '{}',         
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
  package_id           uuid not null references packages(id) on delete 
cascade,
  code                 text not null,               
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
  package_id uuid references packages(id) on delete cascade,   
  question   localized_text not null,
  answer     localized_text not null,
  status     publish_status not null default 'draft',
  sort_order integer not null default 0
);
create table events (
  id               uuid primary key default gen_random_uuid(),
  name             localized_text not null,          
  sport            sport_kind not null,
  competition      text,                             
  home_side        text,
  away_side        text,
  venue            text not null,
  city             text not null,
  country          char(2) not null,
  starts_on        date not null,
  ends_on          date not null check (ends_on >= starts_on),
  start_time_local time,                             
  timezone         text not null,                    
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
  code                 text not null unique,         
  title                localized_text,               
  start_date           date not null,
  end_date             date not null check (end_date >= start_date),
  nights               smallint generated always as ((end_date - start_date)) 
stored,
  capacity             smallint not null check (capacity > 0),
  min_pax              smallint not null default 1,
  hotel_category       text,
  request_cutoff       date,
  status               batch_status not null default 'draft',
  tour_leader_name     text,
  tour_leader_whatsapp text,
  meeting_point        localized_text,
  member_notes         localized_text,
  supplier_name        text,                         
  supplier_ref         text,                         
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
  hotel_service_id uuid,                             
  room_type        room_type not null,
  label            text,                             
  notes            text
);
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
  batch_id             uuid references batches(id),            
  preferred_batch_id   uuid references batches(id),            
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
  constraint batch_needed check (status in 
('requested','reviewing','waitlisted','declined','cancelled') or batch_id is 
not null)
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
  booking_id          uuid not null references bookings(id) on delete 
cascade,
  addon_id            uuid not null references addons(id),
  booking_traveler_id uuid references booking_travelers(id),
  state               text not null check (state in 
('interested','included','declined')),
  notes               text
);
create table room_occupants (
  room_id             uuid not null references rooms(id) on delete cascade,
  booking_traveler_id uuid not null references booking_travelers(id) on 
delete cascade,
  primary key (room_id, booking_traveler_id)
);
create table invoices (
  id               uuid primary key default gen_random_uuid(),
  number           text unique,                       
  booking_id       uuid not null references bookings(id),
  user_id          uuid not null references users(id),
  kind             invoice_kind not null,
  status           invoice_status not null default 'draft',
  currency         char(3) not null default 'IDR' check (currency = 'IDR'),
  subtotal         bigint not null check (subtotal >= 0),
  discount         bigint not null default 0 check (discount >= 0),
  total            bigint not null,
  due_at           timestamptz,
  allowed_channels text[] not null default '{}',      
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
  invoice_id          uuid not null references invoices(id) on delete 
cascade,
  description         localized_text not null,
  booking_traveler_id uuid references booking_travelers(id),
  addon_id            uuid references addons(id),
  quantity            integer not null default 1 check (quantity > 0),
  unit_amount         bigint not null check (unit_amount >= 0),
  amount              bigint generated always as (quantity * unit_amount) 
stored,
  sort_order          integer not null default 0
);
create table payment_attempts (
  id                  uuid primary key default gen_random_uuid(),
  invoice_id          uuid not null references invoices(id),
  attempt_no          smallint not null,
  provider            text not null default 'xendit',
  reference_id        text not null unique,           
  payment_session_id  text unique,                    
  payment_link_url    text,
  status              payment_attempt_status not null default 'active',
  amount              bigint not null,
  expires_at          timestamptz not null,
  completed_at        timestamptz,
  raw_create_response jsonb,
  created_at          timestamptz not null default now(),
  unique (invoice_id, attempt_no)
);
create unique index one_active_attempt on payment_attempts (invoice_id) where 
status = 'active';
create table services (
  id               uuid primary key default gen_random_uuid(),
  batch_id         uuid not null references batches(id) on delete cascade,
  booking_id       uuid references bookings(id),
  traveler_id      uuid references travelers(id),
  type             service_type not null,
  status           service_status not null default 'not_started',
  title            localized_text,
  details          jsonb not null default '{}',       
  starts_at        timestamptz,
  ends_at          timestamptz,
  confirmation_ref text,                              
  member_note      localized_text,
  supplier_name    text,                              
  supplier_ref     text,                              
  internal_notes   text,
  published_at     timestamptz,
  updated_by       uuid references users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint traveler_needs_booking check (traveler_id is null or booking_id 
is not null)
);
create index on services (batch_id, type);
create index on services (booking_id);
create index on services (traveler_id);
alter table rooms add foreign key (hotel_service_id) references services(id) 
on delete set null;
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
  mime         text not null check (mime in 
('application/pdf','image/jpeg','image/png')),
  bytes        integer not null check (bytes <= 20971520),
  sha256       text not null,
  published_at timestamptz,
  withdrawn_at timestamptz,
  uploaded_by  uuid references users(id),
  created_at   timestamptz not null default now(),
  constraint has_owner check (booking_id is not null or batch_id is not null 
or type = 'payment_proof')
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
  provider_payment_id text unique,                    
  channel_code        text,
  reference           text,                           
  paid_at             timestamptz not null,
  proof_document_id   uuid references documents(id),
  recorded_by         uuid references users(id),      
  raw                 jsonb,
  created_at          timestamptz not null default now(),
  constraint manual_has_recorder check (method <> 'manual_transfer' or 
recorded_by is not null)
);
create table refunds (
  id           uuid primary key default gen_random_uuid(),
  payment_id   uuid not null references payments(id),
  amount       bigint not null check (amount > 0),
  method       text not null,                         
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
  destination text not null,                          
  visa_type   text not null,                          
  items       jsonb not null default '[]',            
  updated_at  timestamptz not null default now(),
  unique (destination, visa_type)
);
create table visa_applications (
  id                   uuid primary key default gen_random_uuid(),
  booking_id           uuid not null references bookings(id) on delete 
cascade,
  traveler_id          uuid not null references travelers(id),
  destination          text not null,
  visa_type            text,
  stage                visa_stage not null default 'not_started',
  appointment_at       timestamptz,
  appointment_location text,
  submitted_on         date,
  decided_on           date,
  checklist            jsonb not null default '[]',   
  member_note          localized_text,
  internal_notes       text,
  updated_by           uuid references users(id),
  updated_at           timestamptz not null default now(),
  unique (booking_id, traveler_id, destination)
);
create table content_pages (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,                  
  title        localized_text not null,
  body         jsonb,                                 
  seo          jsonb not null default '{}',
  status       publish_status not null default 'draft',
  published_at timestamptz,
  updated_by   uuid references users(id),
  updated_at   timestamptz not null default now()
);
create table home_sections (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in 
('hero','season','collection','how_it_works','testimonials','cta')),
  data       jsonb not null default '{}',
  status     publish_status not null default 'draft',
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);
create table testimonials (
  id              uuid primary key default gen_random_uuid(),
  quote           localized_text not null,
  author_name     text not null,                      
  author_context  localized_text,                     
  package_id      uuid references packages(id),
  consent_on_file boolean not null default false,
  status          publish_status not null default 'draft',
  sort_order      integer not null default 0,
  constraint real_and_consented check (status <> 'published' or 
consent_on_file)
);
create table site_settings (
  key        text primary key,                        
  value      jsonb not null,
  updated_by uuid references users(id),
  updated_at timestamptz not null default now()
);
create table notification_templates (
  id               uuid primary key default gen_random_uuid(),
  key              text not null,                     
  channel          notification_channel not null,
  locale           app_locale not null,
  subject          text,                              
  body             text,                              
  wa_template_name text,                              
  wa_language      text,                              
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
  actor_user_id uuid references users(id),            
  action        text not null,                        
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
create view batch_seat_counts as
select b.id as batch_id,
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
group by b.id;
