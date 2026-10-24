CREATE TYPE "public"."package_readiness" AS ENUM('draft', 'interest_only', 'ready_to_offer');--> statement-breakpoint
CREATE TYPE "public"."ticket_allocation_status" AS ENUM('not_requested', 'requested', 'partial', 'allocated');--> statement-breakpoint
ALTER TYPE "public"."event_date_status" ADD VALUE 'tba' BEFORE 'confirmed';--> statement-breakpoint
ALTER TYPE "public"."lead_status" ADD VALUE 'qualified' BEFORE 'converted';--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "analytics_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"anon_session_id" uuid,
	"user_id" uuid,
	"package_id" uuid,
	"lead_id" uuid,
	"booking_id" uuid,
	"locale" "app_locale",
	"path" text,
	"utm" jsonb DEFAULT '{}' NOT NULL,
	CONSTRAINT "analytics_name" CHECK (name in ('product_view','enquiry_started','enquiry_submitted','interest_submitted','whatsapp_click','offer_issued','offer_approved','payment_valid'))
);
--> statement-breakpoint
CREATE TABLE "offer_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"booking_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"offer_version" smallint NOT NULL,
	"snapshot" jsonb NOT NULL,
	"snapshot_sha256" text NOT NULL,
	"terms_version" text NOT NULL,
	"locale" "app_locale" NOT NULL,
	"ip" "inet",
	"user_agent" text,
	"approved_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offer_approvals_invoice_id_unique" UNIQUE("invoice_id")
);
--> statement-breakpoint
CREATE TABLE "offer_readiness_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"check_key" text NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"passed_at" timestamp with time zone,
	"passed_by" uuid,
	"note" text,
	CONSTRAINT "offer_readiness_checks_invoice_id_check_key_unique" UNIQUE("invoice_id","check_key"),
	CONSTRAINT "readiness_key" CHECK (check_key in ('supplier_confirmation','quotation_price','ticket_source_category','event_date_status','services_exclusions','terms_attached')),
	CONSTRAINT "pass_needs_note" CHECK (passed_at is null or (passed_by is not null and length(btrim(note)) > 0))
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"role" "localized_text" NOT NULL,
	"bio" "localized_text",
	"photo_media_id" uuid,
	"verified_at" timestamp with time zone,
	"status" "publish_status" DEFAULT 'draft' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "published_needs_verified" CHECK (status <> 'published' or verified_at is not null)
);
--> statement-breakpoint
ALTER TABLE "home_sections" DROP CONSTRAINT "home_sections_kind_check";--> statement-breakpoint
ALTER TABLE "packages" DROP CONSTRAINT "sport_required";--> statement-breakpoint
ALTER TABLE "batches" ALTER COLUMN "start_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "batches" ALTER COLUMN "end_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "starts_on" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "ends_on" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "packages" ALTER COLUMN "sport" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "batches" ADD COLUMN "ticket_allocation_status" "ticket_allocation_status" DEFAULT 'not_requested' NOT NULL;--> statement-breakpoint
ALTER TABLE "batches" ADD COLUMN "ticket_allocation_note" "localized_text";--> statement-breakpoint
ALTER TABLE "batches" ADD COLUMN "departure_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "date_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "date_verified_by" uuid;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "date_source_note" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "offer_version" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "superseded_by" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "readiness_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "readiness_confirmed_by" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "offer_details" jsonb DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "interest_kind" text DEFAULT 'product' NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "sport" "sport_kind";--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "party_size" smallint;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "preferred_period" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "budget_note" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "concept_label" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "landing_path" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "referrer" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "utm_source" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "utm_medium" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "utm_campaign" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "utm_content" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "utm_term" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "anon_session_id" uuid;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "qualified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "qualified_by" uuid;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "first_response_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "first_response_by" uuid;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "rights_status" text DEFAULT 'unverified' NOT NULL;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "license_note" text;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "license_expires_on" date;--> statement-breakpoint
ALTER TABLE "packages" ADD COLUMN "readiness" "package_readiness" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "packages" ADD COLUMN "supplier_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "packages" ADD COLUMN "supplier_verified_by" uuid;--> statement-breakpoint
ALTER TABLE "packages" ADD COLUMN "coverage_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "packages" ADD COLUMN "quotation_ref" text;--> statement-breakpoint
ALTER TABLE "packages" ADD COLUMN "sales_rights_note" text;--> statement-breakpoint
ALTER TABLE "packages" ADD COLUMN "nights_note" "localized_text";--> statement-breakpoint
ALTER TABLE "packages" ADD COLUMN "proof_points" jsonb DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "packages" ADD COLUMN "interest_label" "localized_text";--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD COLUMN "approval_id" uuid;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "delivery_method" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "external_app_name" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "delivery_instructions" "localized_text";--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "handover_target_on" date;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "handover_status" text DEFAULT 'planned' NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "handed_over_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_approvals" ADD CONSTRAINT "offer_approvals_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_approvals" ADD CONSTRAINT "offer_approvals_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_approvals" ADD CONSTRAINT "offer_approvals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_readiness_checks" ADD CONSTRAINT "offer_readiness_checks_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_readiness_checks" ADD CONSTRAINT "offer_readiness_checks_passed_by_users_id_fk" FOREIGN KEY ("passed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_photo_media_id_media_assets_id_fk" FOREIGN KEY ("photo_media_id") REFERENCES "public"."media_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_name_date" ON "analytics_events" USING btree ("name","occurred_at");--> statement-breakpoint
CREATE INDEX "analytics_package_name_date" ON "analytics_events" USING btree ("package_id","name","occurred_at");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_date_verified_by_users_id_fk" FOREIGN KEY ("date_verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_superseded_by_invoices_id_fk" FOREIGN KEY ("superseded_by") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_readiness_confirmed_by_users_id_fk" FOREIGN KEY ("readiness_confirmed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_qualified_by_users_id_fk" FOREIGN KEY ("qualified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_first_response_by_users_id_fk" FOREIGN KEY ("first_response_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packages" ADD CONSTRAINT "packages_supplier_verified_by_users_id_fk" FOREIGN KEY ("supplier_verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_approval_id_offer_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."offer_approvals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packages" DROP COLUMN "kind";--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "dates_needed_after_draft" CHECK (status in ('draft','cancelled') or (start_date is not null and end_date is not null));--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "verified_date_needs_source" CHECK (date_verified_at is null or (starts_on is not null and ends_on is not null and source_url is not null));--> statement-breakpoint
ALTER TABLE "home_sections" ADD CONSTRAINT "home_sections_kind_check" CHECK (kind in 
('hero','why','sports','season','beyond','how_to_book','team','cta'));--> statement-breakpoint
ALTER TABLE "packages" ADD CONSTRAINT "ready_requires_verification" CHECK (readiness <> 'ready_to_offer' or (supplier_verified_at is not null and coverage_verified_at is not null and length(btrim(sales_rights_note)) > 0));--> statement-breakpoint
ALTER TABLE "packages" ADD CONSTRAINT "published_not_draft" CHECK (status <> 'published' or readiness <> 'draft');--> statement-breakpoint
CREATE VIEW "public"."funnel_daily" AS (select (occurred_at at time zone 'Asia/Jakarta')::date as day,name,package_id,count(*) as events,count(distinct anon_session_id) as sessions from analytics_events group by 1,2,3);--> statement-breakpoint
DROP TYPE "public"."package_kind";