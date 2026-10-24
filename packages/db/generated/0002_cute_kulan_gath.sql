ALTER TABLE "users" DROP CONSTRAINT "users_whatsapp_e164_check";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_whatsapp_e164_check" CHECK (whatsapp_e164 ~ '^\+[1-9][0-9]{7,14}$');