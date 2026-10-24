-- Preserve legacy bookings and financial records. Old catalog claims have no V2
-- proof, so archive non-sport concepts and return sport products to draft.
UPDATE packages SET status=CASE WHEN kind='luxury' THEN 'archived'::publish_status ELSE 'draft'::publish_status END, sport=coalesce(sport,'other'::sport_kind), updated_at=now();
--> statement-breakpoint
ALTER TABLE home_sections DROP CONSTRAINT home_sections_kind_check;
--> statement-breakpoint
UPDATE home_sections SET kind=CASE kind WHEN 'collection' THEN 'beyond' WHEN 'how_it_works' THEN 'how_to_book' WHEN 'testimonials' THEN 'team' ELSE kind END WHERE kind IN ('collection','how_it_works','testimonials');

--> statement-breakpoint
ALTER TABLE home_sections ADD CONSTRAINT home_sections_kind_check CHECK (kind IN ('hero','why','sports','season','beyond','how_to_book','team','cta'));
