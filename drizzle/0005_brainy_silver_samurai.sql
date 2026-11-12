ALTER TABLE "daily_moves" DROP CONSTRAINT "daily_moves_income_id_incomes_id_fk";
--> statement-breakpoint
ALTER TABLE "daily_moves" ALTER COLUMN "income_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "incomes" ADD COLUMN "skipped_wallet_ids" uuid[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_moves" ADD CONSTRAINT "daily_moves_income_id_incomes_id_fk" FOREIGN KEY ("income_id") REFERENCES "public"."incomes"("id") ON DELETE set null ON UPDATE no action;