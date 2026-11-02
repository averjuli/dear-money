ALTER TABLE "expenses" DROP CONSTRAINT "expenses_target_check";--> statement-breakpoint
ALTER TABLE "spend_categories" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_target_check" CHECK ("expenses"."envelope_id" is not null or "expenses"."category_id" is not null);