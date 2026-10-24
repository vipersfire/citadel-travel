CREATE FUNCTION offer_approvals_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'offer_approvals is append-only'; END;
$$;
--> statement-breakpoint
CREATE TRIGGER offer_approvals_no_change BEFORE UPDATE OR DELETE ON offer_approvals FOR EACH ROW EXECUTE FUNCTION offer_approvals_append_only();
--> statement-breakpoint
-- Existing attempts remain historical evidence, without fabricated member approval.
-- Every new attempt must reference an approval for this invoice and version.
CREATE FUNCTION payment_attempt_approval_required() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM offer_approvals a JOIN invoices i ON i.id=a.invoice_id WHERE a.id=NEW.approval_id AND i.id=NEW.invoice_id AND a.offer_version=i.offer_version AND (a.snapshot->>'total')::bigint=NEW.amount) THEN
  RAISE EXCEPTION 'approval_required' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER payment_attempt_requires_approval BEFORE INSERT ON payment_attempts FOR EACH ROW EXECUTE FUNCTION payment_attempt_approval_required();
--> statement-breakpoint
CREATE FUNCTION issued_offer_readiness_required() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status='issued' AND (TG_OP='INSERT' OR OLD.status<>'issued') AND NEW.readiness_confirmed_at IS NULL THEN RAISE EXCEPTION 'readiness_incomplete' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER issued_offer_requires_readiness BEFORE INSERT OR UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION issued_offer_readiness_required();
--> statement-breakpoint
INSERT INTO site_settings(key,value) VALUES ('trust_line_enabled','false'),('claims_terms','["first","pertama","official partner","mitra resmi","vip","24 jam","24 hours","24/7","exclusive","eksklusif"]') ON CONFLICT DO NOTHING;
--> statement-breakpoint
UPDATE media_assets SET rights_status='ai_placeholder' WHERE is_ai_generated;
--> statement-breakpoint
UPDATE services SET delivery_method=CASE details->>'delivery' WHEN 'mobile_app' THEN 'external_app' ELSE details->>'delivery' END,details=details-'delivery' WHERE type='event_ticket' AND details ? 'delivery';
