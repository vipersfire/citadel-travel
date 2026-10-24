ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_key_pk" PRIMARY KEY("user_id","key");--> statement-breakpoint
ALTER TABLE "package_addons" ADD CONSTRAINT "package_addons_package_id_addon_id_pk" PRIMARY KEY("package_id","addon_id");--> statement-breakpoint
ALTER TABLE "package_media" ADD CONSTRAINT "package_media_package_id_media_id_pk" PRIMARY KEY("package_id","media_id");--> statement-breakpoint
ALTER TABLE "room_occupants" ADD CONSTRAINT "room_occupants_room_id_booking_traveler_id_pk" PRIMARY KEY("room_id","booking_traveler_id");--> statement-breakpoint
ALTER TABLE "addons" ADD CONSTRAINT "addons_media_id_media_assets_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_recovery_codes" ADD CONSTRAINT "admin_recovery_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_itinerary_items" ADD CONSTRAINT "batch_itinerary_items_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_itinerary_items" ADD CONSTRAINT "batch_itinerary_items_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_addons" ADD CONSTRAINT "booking_addons_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_addons" ADD CONSTRAINT "booking_addons_addon_id_addons_id_fk" FOREIGN KEY ("addon_id") REFERENCES "public"."addons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_addons" ADD CONSTRAINT "booking_addons_booking_traveler_id_booking_travelers_id_fk" FOREIGN KEY ("booking_traveler_id") REFERENCES "public"."booking_travelers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_travelers" ADD CONSTRAINT "booking_travelers_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_travelers" ADD CONSTRAINT "booking_travelers_traveler_id_travelers_id_fk" FOREIGN KEY ("traveler_id") REFERENCES "public"."travelers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_travelers" ADD CONSTRAINT "booking_travelers_package_option_id_package_options_id_fk" FOREIGN KEY ("package_option_id") REFERENCES "public"."package_options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_preferred_batch_id_batches_id_fk" FOREIGN KEY ("preferred_batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cancelled_by_user_id_users_id_fk" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_pages" ADD CONSTRAINT "content_pages_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_traveler_id_travelers_id_fk" FOREIGN KEY ("traveler_id") REFERENCES "public"."travelers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_booking_traveler_id_booking_travelers_id_fk" FOREIGN KEY ("booking_traveler_id") REFERENCES "public"."booking_travelers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_addon_id_addons_id_fk" FOREIGN KEY ("addon_id") REFERENCES "public"."addons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_issued_by_users_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_poster_asset_id_media_assets_id_fk" FOREIGN KEY ("poster_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_addons" ADD CONSTRAINT "package_addons_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_addons" ADD CONSTRAINT "package_addons_addon_id_addons_id_fk" FOREIGN KEY ("addon_id") REFERENCES "public"."addons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_itinerary_days" ADD CONSTRAINT "package_itinerary_days_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_itinerary_days" ADD CONSTRAINT "package_itinerary_days_media_id_media_assets_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_media" ADD CONSTRAINT "package_media_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_media" ADD CONSTRAINT "package_media_media_id_media_assets_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_options" ADD CONSTRAINT "package_options_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packages" ADD CONSTRAINT "packages_hero_media_id_media_assets_id_fk" FOREIGN KEY ("hero_media_id") REFERENCES "public"."media_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packages" ADD CONSTRAINT "packages_hero_video_id_media_assets_id_fk" FOREIGN KEY ("hero_video_id") REFERENCES "public"."media_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packages" ADD CONSTRAINT "packages_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packages" ADD CONSTRAINT "packages_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_attempt_id_payment_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."payment_attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_proof_document_id_documents_id_fk" FOREIGN KEY ("proof_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_occupants" ADD CONSTRAINT "room_occupants_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_occupants" ADD CONSTRAINT "room_occupants_booking_traveler_id_booking_travelers_id_fk" FOREIGN KEY ("booking_traveler_id") REFERENCES "public"."booking_travelers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_hotel_service_id_services_id_fk" FOREIGN KEY ("hotel_service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_traveler_id_travelers_id_fk" FOREIGN KEY ("traveler_id") REFERENCES "public"."travelers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "travelers" ADD CONSTRAINT "travelers_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visa_applications" ADD CONSTRAINT "visa_applications_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visa_applications" ADD CONSTRAINT "visa_applications_traveler_id_travelers_id_fk" FOREIGN KEY ("traveler_id") REFERENCES "public"."travelers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visa_applications" ADD CONSTRAINT "visa_applications_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_idx_1" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_idx_2" ON "audit_logs" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "batch_itinerary_items_idx_1" ON "batch_itinerary_items" USING btree ("batch_id","day_number","sort_order");--> statement-breakpoint
CREATE INDEX "batches_idx_1" ON "batches" USING btree ("package_id","status");--> statement-breakpoint
CREATE INDEX "batches_idx_2" ON "batches" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "booking_travelers_idx_1" ON "booking_travelers" USING btree ("traveler_id");--> statement-breakpoint
CREATE INDEX "bookings_idx_1" ON "bookings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bookings_idx_2" ON "bookings" USING btree ("batch_id","status");--> statement-breakpoint
CREATE INDEX "bookings_idx_3" ON "bookings" USING btree ("status","requested_at");--> statement-breakpoint
CREATE INDEX "documents_idx_1" ON "documents" USING btree ("booking_id","status");--> statement-breakpoint
CREATE INDEX "documents_idx_2" ON "documents" USING btree ("batch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "one_live_package_invoice" ON "invoices" USING btree ("booking_id") WHERE kind = 'package' and status in ('issued','paid');--> statement-breakpoint
CREATE INDEX "invoices_idx_1" ON "invoices" USING btree ("status","due_at");--> statement-breakpoint
CREATE INDEX "notifications_idx_1" ON "notifications" USING btree ("status","send_after");--> statement-breakpoint
CREATE INDEX "notifications_idx_2" ON "notifications" USING btree ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "one_active_attempt" ON "payment_attempts" USING btree ("invoice_id") WHERE 
status = 'active';--> statement-breakpoint
CREATE INDEX "services_idx_1" ON "services" USING btree ("batch_id","type");--> statement-breakpoint
CREATE INDEX "services_idx_2" ON "services" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "services_idx_3" ON "services" USING btree ("traveler_id");--> statement-breakpoint
CREATE INDEX "sessions_idx_1" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_idx_2" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "one_self_traveler" ON "travelers" USING btree ("owner_user_id") WHERE 
is_self and deleted_at is null;--> statement-breakpoint
CREATE INDEX "travelers_idx_1" ON "travelers" USING btree ("owner_user_id");--> statement-breakpoint
ALTER TABLE "booking_travelers" ADD CONSTRAINT "booking_travelers_booking_id_traveler_id_unique" UNIQUE("booking_id","traveler_id");--> statement-breakpoint
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_key_channel_locale_unique" UNIQUE("key","channel","locale");--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_provider_provider_user_id_unique" UNIQUE("provider","provider_user_id");--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_provider_unique" UNIQUE("user_id","provider");--> statement-breakpoint
ALTER TABLE "package_itinerary_days" ADD CONSTRAINT "package_itinerary_days_package_id_day_number_unique" UNIQUE("package_id","day_number");--> statement-breakpoint
ALTER TABLE "package_options" ADD CONSTRAINT "package_options_package_id_code_unique" UNIQUE("package_id","code");--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_invoice_id_attempt_no_unique" UNIQUE("invoice_id","attempt_no");--> statement-breakpoint
ALTER TABLE "visa_applications" ADD CONSTRAINT "visa_applications_booking_id_traveler_id_destination_unique" UNIQUE("booking_id","traveler_id","destination");--> statement-breakpoint
ALTER TABLE "visa_checklist_templates" ADD CONSTRAINT "visa_checklist_templates_destination_visa_type_unique" UNIQUE("destination","visa_type");--> statement-breakpoint
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_provider_event_key_unique" UNIQUE("provider","event_key");--> statement-breakpoint
ALTER TABLE "batch_itinerary_items" ADD CONSTRAINT "batch_itinerary_items_day_number_check" CHECK (day_number > 0);--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_end_date_check" CHECK (end_date >= start_date);--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_capacity_check" CHECK (capacity > 0);--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "min_le_capacity" CHECK (min_pax <= capacity);--> statement-breakpoint
ALTER TABLE "booking_addons" ADD CONSTRAINT "booking_addons_state_check" CHECK (state in 
('interested','included','declined'));--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "batch_needed" CHECK (status in 
('requested','reviewing','waitlisted','declined','cancelled') or batch_id is 
not null);--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_mime_check" CHECK (mime in 
('application/pdf','image/jpeg','image/png'));--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_bytes_check" CHECK (bytes <= 20971520);--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "has_owner" CHECK (booking_id is not null or batch_id is not null 
or type = 'payment_proof');--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_ends_on_check" CHECK (ends_on >= starts_on);--> statement-breakpoint
ALTER TABLE "home_sections" ADD CONSTRAINT "home_sections_kind_check" CHECK (kind in 
('hero','season','collection','how_it_works','testimonials','cta'));--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_quantity_check" CHECK (quantity > 0);--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_unit_amount_check" CHECK (unit_amount >= 0);--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_currency_check" CHECK (currency = 'IDR');--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subtotal_check" CHECK (subtotal >= 0);--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_discount_check" CHECK (discount >= 0);--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "total_math" CHECK (total = subtotal - discount and total > 0);--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "issued_has_due" CHECK (status = 'draft' or due_at is not null);--> statement-breakpoint
ALTER TABLE "package_itinerary_days" ADD CONSTRAINT "package_itinerary_days_day_number_check" CHECK (day_number > 0);--> statement-breakpoint
ALTER TABLE "packages" ADD CONSTRAINT "packages_slug_check" CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');--> statement-breakpoint
ALTER TABLE "packages" ADD CONSTRAINT "sport_required" CHECK (kind = 'luxury' or sport is not null);--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_check" CHECK (amount > 0);--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "manual_has_recorder" CHECK (method <> 'manual_transfer' or 
recorded_by is not null);--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_amount_check" CHECK (amount > 0);--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "traveler_needs_booking" CHECK (traveler_id is null or booking_id 
is not null);--> statement-breakpoint
ALTER TABLE "testimonials" ADD CONSTRAINT "real_and_consented" CHECK (status <> 'published' or 
consent_on_file);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_whatsapp_e164_check" CHECK (whatsapp_e164 ~ '^+[1-9][0-9]{7,14}$');--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "admin_has_password" CHECK (role <> 'admin' or password_hash is 
not null);--> statement-breakpoint
CREATE VIEW "public"."batch_seat_counts" AS (select b.id as batch_id,
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
group by b.id);