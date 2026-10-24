ALTER TABLE "booking_addons" DROP CONSTRAINT "booking_addons_booking_id_bookings_id_fk";
--> statement-breakpoint
ALTER TABLE "invoice_lines" DROP CONSTRAINT "invoice_lines_invoice_id_invoices_id_fk";
--> statement-breakpoint
ALTER TABLE "package_options" DROP CONSTRAINT "package_options_package_id_packages_id_fk";
--> statement-breakpoint
ALTER TABLE "room_occupants" DROP CONSTRAINT "room_occupants_booking_traveler_id_booking_travelers_id_fk";
--> statement-breakpoint
ALTER TABLE "visa_applications" DROP CONSTRAINT "visa_applications_booking_id_bookings_id_fk";
--> statement-breakpoint
ALTER TABLE "booking_addons" ADD CONSTRAINT "booking_addons_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_options" ADD CONSTRAINT "package_options_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_occupants" ADD CONSTRAINT "room_occupants_booking_traveler_id_booking_travelers_id_fk" FOREIGN KEY ("booking_traveler_id") REFERENCES "public"."booking_travelers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visa_applications" ADD CONSTRAINT "visa_applications_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;