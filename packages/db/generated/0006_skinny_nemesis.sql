ALTER TABLE "offer_readiness_checks" DROP CONSTRAINT "pass_needs_note";--> statement-breakpoint
ALTER TABLE "packages" DROP CONSTRAINT "ready_requires_verification";--> statement-breakpoint
ALTER TABLE "offer_readiness_checks" ADD CONSTRAINT "pass_needs_note" CHECK (passed_at is null or (passed_by is not null and note is not null and length(btrim(note)) > 0));--> statement-breakpoint
ALTER TABLE "packages" ADD CONSTRAINT "ready_requires_verification" CHECK (readiness <> 'ready_to_offer' or (supplier_verified_at is not null and coverage_verified_at is not null and sales_rights_note is not null and length(btrim(sales_rights_note)) > 0));--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "service_delivery_method" CHECK (delivery_method is null or delivery_method in ('pdf','wallet','external_app','paper','in_person'));--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "service_handover_status" CHECK (handover_status in ('planned','handed_over','not_applicable'));