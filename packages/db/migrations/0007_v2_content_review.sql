-- Retire old product-language claims without deleting authored content.
UPDATE content_pages SET status='draft',published_at=null WHERE status='published' AND (title::text||' '||coalesce(body::text,'')) ~* '\mluxury\M';
--> statement-breakpoint
UPDATE home_sections SET status='draft' WHERE status='published' AND data::text ~* '\mluxury\M';
--> statement-breakpoint
UPDATE faqs SET status='draft' WHERE status='published' AND (question::text||' '||answer::text) ~* '\mluxury\M';
--> statement-breakpoint
UPDATE testimonials SET status='draft' WHERE status='published' AND quote::text ~* '\mluxury\M';
--> statement-breakpoint
UPDATE packages SET title=CASE code
 WHEN 'OT' THEN '{"id":"Old Trafford Experience","en":"Old Trafford Experience"}'::localized_text
 WHEN 'EC' THEN '{"id":"El Clásico Experience","en":"El Clásico Experience"}'::localized_text
 WHEN 'RG' THEN '{"id":"Paris Tennis & Lifestyle","en":"Paris Tennis & Lifestyle"}'::localized_text
 WHEN 'WB' THEN '{"id":"Wimbledon & London","en":"Wimbledon & London"}'::localized_text
 WHEN 'F1' THEN '{"id":"Monza Race Weekend","en":"Monza Race Weekend"}'::localized_text
 WHEN 'BM' THEN '{"id":"Berlin Marathon Experience","en":"Berlin Marathon Experience"}'::localized_text
 ELSE title END
 WHERE title->>'id' IN ('Old Trafford, Manchester','El Clásico, Madrid','Paris, di tepi lapangan tanah liat','Wimbledon & London','Monza. Milan. Como.','Berlin, setiap langkah berarti');
--> statement-breakpoint
UPDATE home_sections SET data=data||'{"title":{"id":"Be There When It Matters.","en":"Be There When It Matters."},"body":{"id":"Rasakan langsung atmosfer pertandingan pilihan Anda. Citadel merancang perjalanan olahraga ke Eropa dengan pilihan pengalaman, akomodasi, dan layanan yang dijelaskan dalam penawaran personal Anda.","en":"Experience the atmosphere of the sporting events you love. Citadel designs journeys to Europe around your chosen event, with experiences, accommodation and services clearly set out in your personal proposal."}}'::jsonb WHERE kind='hero' AND data->>'is_placeholder'='true';
