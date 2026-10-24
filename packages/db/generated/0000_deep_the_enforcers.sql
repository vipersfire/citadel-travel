CREATE TYPE "public"."app_locale" AS ENUM('id', 'en');--> statement-breakpoint
CREATE TYPE "public"."auth_token_type" AS ENUM('email_verify', 'password_reset');--> statement-breakpoint
CREATE TYPE "public"."batch_status" AS ENUM('draft', 'open', 'closed', 'confirmed', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('requested', 'reviewing', 'waitlisted', 'offered', 'confirmed', 'completed', 'declined', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."dietary_need" AS ENUM('halal', 'vegetarian', 'vegan', 'no_pork', 'no_alcohol', 'other');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('private', 'published', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('flight_ticket', 'hotel_voucher', 'event_ticket', 'transfer_voucher', 'insurance', 'itinerary', 'payment_proof', 'other');--> statement-breakpoint
CREATE TYPE "public"."event_date_status" AS ENUM('provisional', 'confirmed', 'changed', 'postponed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."invoice_kind" AS ENUM('package', 'supplement');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'issued', 'paid', 'expired', 'void');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('new', 'contacted', 'converted', 'closed');--> statement-breakpoint
CREATE TYPE "public"."media_kind" AS ENUM('image', 'video');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('email', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('queued', 'sending', 'sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."oauth_provider" AS ENUM('google');--> statement-breakpoint
CREATE TYPE "public"."package_kind" AS ENUM('sport', 'luxury');--> statement-breakpoint
CREATE TYPE "public"."passport_gender" AS ENUM('female', 'male', 'x');--> statement-breakpoint
CREATE TYPE "public"."payment_attempt_status" AS ENUM('active', 'completed', 'expired', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('xendit', 'manual_transfer');--> statement-breakpoint
CREATE TYPE "public"."publish_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."room_type" AS ENUM('twin', 'double', 'single');--> statement-breakpoint
CREATE TYPE "public"."service_status" AS ENUM('not_started', 'requested', 'pending_allocation', 'confirmed', 'issued', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."service_type" AS ENUM('flight', 'hotel', 'event_ticket', 'transfer', 'activity', 'insurance', 'dining', 'other');--> statement-breakpoint
CREATE TYPE "public"."sport_kind" AS ENUM('football', 'motorsport', 'tennis', 'running', 'other');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('member', 'admin');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."visa_stage" AS ENUM('not_started', 'collecting_documents', 'appointment_booked', 'submitted', 'approved', 'refused', 'not_required');--> statement-breakpoint
CREATE TABLE "addons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" "localized_text" NOT NULL,
	"description" "localized_text",
	"media_id" uuid,
	"applies_to_all" boolean DEFAULT false NOT NULL,
	"status" "publish_status" DEFAULT 'draft' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "addons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "admin_recovery_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"ip" "inet",
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "auth_token_type" NOT NULL,
	"token_hash" "bytea" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "batch_itinerary_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"day_number" smallint NOT NULL,
	"starts_at_local" time,
	"ends_at_local" time,
	"timezone" text NOT NULL,
	"title" "localized_text" NOT NULL,
	"body" "localized_text",
	"location_name" text,
	"map_url" text,
	"service_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL,
	"event_id" uuid,
	"code" text NOT NULL,
	"title" "localized_text",
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"nights" smallint GENERATED ALWAYS AS ((end_date - start_date)) STORED,
	"capacity" smallint NOT NULL,
	"min_pax" smallint DEFAULT 1 NOT NULL,
	"hotel_category" text,
	"request_cutoff" date,
	"status" "batch_status" DEFAULT 'draft' NOT NULL,
	"tour_leader_name" text,
	"tour_leader_whatsapp" text,
	"meeting_point" "localized_text",
	"member_notes" "localized_text",
	"supplier_name" text,
	"supplier_ref" text,
	"internal_notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "batches_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "booking_addons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"addon_id" uuid NOT NULL,
	"booking_traveler_id" uuid,
	"state" text NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "booking_travelers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"traveler_id" uuid NOT NULL,
	"package_option_id" uuid,
	"is_lead" boolean DEFAULT false NOT NULL,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"user_id" uuid NOT NULL,
	"package_id" uuid NOT NULL,
	"batch_id" uuid,
	"preferred_batch_id" uuid,
	"status" "booking_status" DEFAULT 'requested' NOT NULL,
	"room_preference" "room_type",
	"member_notes" text,
	"internal_notes" text,
	"decline_reason" "localized_text",
	"cancel_reason" text,
	"cancelled_by_user_id" uuid,
	"lead_id" uuid,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"offered_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"expired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "content_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" "localized_text" NOT NULL,
	"body" jsonb,
	"seo" jsonb DEFAULT '{}' NOT NULL,
	"status" "publish_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_pages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid,
	"booking_id" uuid,
	"traveler_id" uuid,
	"service_id" uuid,
	"type" "document_type" NOT NULL,
	"status" "document_status" DEFAULT 'private' NOT NULL,
	"title" "localized_text",
	"bucket" text NOT NULL,
	"storage_key" text NOT NULL,
	"filename" text NOT NULL,
	"mime" text NOT NULL,
	"bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"published_at" timestamp with time zone,
	"withdrawn_at" timestamp with time zone,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" "localized_text" NOT NULL,
	"sport" "sport_kind" NOT NULL,
	"competition" text,
	"home_side" text,
	"away_side" text,
	"venue" text NOT NULL,
	"city" text NOT NULL,
	"country" char(2) NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"start_time_local" time,
	"timezone" text NOT NULL,
	"date_status" "event_date_status" DEFAULT 'provisional' NOT NULL,
	"source_url" text,
	"last_checked_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faqs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid,
	"question" "localized_text" NOT NULL,
	"answer" "localized_text" NOT NULL,
	"status" "publish_status" DEFAULT 'draft' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "home_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"data" jsonb DEFAULT '{}' NOT NULL,
	"status" "publish_status" DEFAULT 'draft' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"user_id" uuid NOT NULL,
	"key" text NOT NULL,
	"route" text NOT NULL,
	"request_hash" text NOT NULL,
	"response_status" integer,
	"response_body" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"description" "localized_text" NOT NULL,
	"booking_traveler_id" uuid,
	"addon_id" uuid,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_amount" bigint NOT NULL,
	"amount" bigint GENERATED ALWAYS AS (quantity * unit_amount) STORED,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text,
	"booking_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "invoice_kind" NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"currency" char(3) DEFAULT 'IDR' NOT NULL,
	"subtotal" bigint NOT NULL,
	"discount" bigint DEFAULT 0 NOT NULL,
	"total" bigint NOT NULL,
	"due_at" timestamp with time zone,
	"allowed_channels" text[] DEFAULT '{}' NOT NULL,
	"note" "localized_text",
	"needs_review" boolean DEFAULT false NOT NULL,
	"review_reason" text,
	"issued_at" timestamp with time zone,
	"issued_by" uuid,
	"paid_at" timestamp with time zone,
	"expired_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"void_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" "citext" NOT NULL,
	"whatsapp_e164" text,
	"package_id" uuid,
	"message" text,
	"locale" "app_locale" DEFAULT 'id' NOT NULL,
	"status" "lead_status" DEFAULT 'new' NOT NULL,
	"user_id" uuid,
	"source" text,
	"ip" "inet",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "media_kind" NOT NULL,
	"bucket" text NOT NULL,
	"storage_key" text NOT NULL,
	"mime" text NOT NULL,
	"bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"duration_ms" integer,
	"alt" "localized_text",
	"focal_x" numeric(5, 2) DEFAULT 50 NOT NULL,
	"focal_y" numeric(5, 2) DEFAULT 50 NOT NULL,
	"blur_data_url" text,
	"variants" jsonb DEFAULT '[]' NOT NULL,
	"poster_asset_id" uuid,
	"is_ai_generated" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_assets_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "notification_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"locale" "app_locale" NOT NULL,
	"subject" text,
	"body" text,
	"wa_template_name" text,
	"wa_language" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"booking_id" uuid,
	"channel" "notification_channel" NOT NULL,
	"template_key" text NOT NULL,
	"locale" "app_locale" NOT NULL,
	"to_address" text NOT NULL,
	"payload" jsonb DEFAULT '{}' NOT NULL,
	"status" "notification_status" DEFAULT 'queued' NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"provider_message_id" text,
	"last_error" text,
	"send_after" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "oauth_provider" NOT NULL,
	"provider_user_id" text NOT NULL,
	"email" "citext" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "package_addons" (
	"package_id" uuid NOT NULL,
	"addon_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "package_itinerary_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL,
	"day_number" smallint NOT NULL,
	"title" "localized_text" NOT NULL,
	"body" "localized_text",
	"city" text,
	"media_id" uuid
);
--> statement-breakpoint
CREATE TABLE "package_media" (
	"package_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"caption" "localized_text",
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "package_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" "localized_text" NOT NULL,
	"description" "localized_text",
	"includes_event_entry" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"slug" text NOT NULL,
	"kind" "package_kind" NOT NULL,
	"sport" "sport_kind",
	"status" "publish_status" DEFAULT 'draft' NOT NULL,
	"title" "localized_text" NOT NULL,
	"subtitle" "localized_text",
	"summary" "localized_text",
	"story" jsonb,
	"highlights" jsonb DEFAULT '[]' NOT NULL,
	"inclusions" jsonb DEFAULT '[]' NOT NULL,
	"exclusions" jsonb DEFAULT '[]' NOT NULL,
	"hotel_style" "localized_text",
	"countries" char(2)[] DEFAULT '{}' NOT NULL,
	"cities" text[] DEFAULT '{}' NOT NULL,
	"nights_min" smallint,
	"nights_max" smallint,
	"hero_media_id" uuid,
	"hero_video_id" uuid,
	"terms" "localized_text",
	"visa_note" "localized_text",
	"seo" jsonb DEFAULT '{}' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "packages_code_unique" UNIQUE("code"),
	CONSTRAINT "packages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "payment_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"attempt_no" smallint NOT NULL,
	"provider" text DEFAULT 'xendit' NOT NULL,
	"reference_id" text NOT NULL,
	"payment_session_id" text,
	"payment_link_url" text,
	"status" "payment_attempt_status" DEFAULT 'active' NOT NULL,
	"amount" bigint NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"raw_create_response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_attempts_reference_id_unique" UNIQUE("reference_id"),
	CONSTRAINT "payment_attempts_payment_session_id_unique" UNIQUE("payment_session_id")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"attempt_id" uuid,
	"method" "payment_method" NOT NULL,
	"amount" bigint NOT NULL,
	"currency" char(3) DEFAULT 'IDR' NOT NULL,
	"provider_payment_id" text,
	"channel_code" text,
	"reference" text,
	"paid_at" timestamp with time zone NOT NULL,
	"proof_document_id" uuid,
	"recorded_by" uuid,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_provider_payment_id_unique" UNIQUE("provider_payment_id")
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"method" text NOT NULL,
	"reason" text NOT NULL,
	"processed_on" date NOT NULL,
	"reference" text,
	"recorded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_occupants" (
	"room_id" uuid NOT NULL,
	"booking_traveler_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"hotel_service_id" uuid,
	"room_type" "room_type" NOT NULL,
	"label" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"booking_id" uuid,
	"traveler_id" uuid,
	"type" "service_type" NOT NULL,
	"status" "service_status" DEFAULT 'not_started' NOT NULL,
	"title" "localized_text",
	"details" jsonb DEFAULT '{}' NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"confirmation_ref" text,
	"member_note" "localized_text",
	"supplier_name" text,
	"supplier_ref" text,
	"internal_notes" text,
	"published_at" timestamp with time zone,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" "bytea" NOT NULL,
	"user_id" uuid NOT NULL,
	"mfa_verified_at" timestamp with time zone,
	"ip" "inet",
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "testimonials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote" "localized_text" NOT NULL,
	"author_name" text NOT NULL,
	"author_context" "localized_text",
	"package_id" uuid,
	"consent_on_file" boolean DEFAULT false NOT NULL,
	"status" "publish_status" DEFAULT 'draft' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "travelers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"is_self" boolean DEFAULT false NOT NULL,
	"given_names" text NOT NULL,
	"surname" text NOT NULL,
	"gender" "passport_gender",
	"date_of_birth" date,
	"nationality" char(2),
	"passport_number_enc" "bytea",
	"passport_number_last3" text,
	"passport_key_version" smallint,
	"passport_expiry" date,
	"phone_e164" text,
	"email" "citext",
	"dietary" "dietary_need"[] DEFAULT '{}' NOT NULL,
	"dietary_notes" text,
	"medical_notes" text,
	"relationship" text,
	"locked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" "citext" NOT NULL,
	"email_verified_at" timestamp with time zone,
	"password_hash" text,
	"full_name" text NOT NULL,
	"whatsapp_e164" text,
	"whatsapp_opt_in" boolean DEFAULT false NOT NULL,
	"locale" "app_locale" DEFAULT 'id' NOT NULL,
	"role" "user_role" DEFAULT 'member' NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"totp_secret_enc" "bytea",
	"totp_enabled_at" timestamp with time zone,
	"last_sign_in_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "visa_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"traveler_id" uuid NOT NULL,
	"destination" text NOT NULL,
	"visa_type" text,
	"stage" "visa_stage" DEFAULT 'not_started' NOT NULL,
	"appointment_at" timestamp with time zone,
	"appointment_location" text,
	"submitted_on" date,
	"decided_on" date,
	"checklist" jsonb DEFAULT '[]' NOT NULL,
	"member_note" "localized_text",
	"internal_notes" text,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visa_checklist_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"destination" text NOT NULL,
	"visa_type" text NOT NULL,
	"items" jsonb DEFAULT '[]' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "webhook_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"provider" text NOT NULL,
	"event_key" text NOT NULL,
	"event_type" text,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text
);
