CREATE TABLE "pay_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"advance_day" smallint,
	"salary_day" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pay_days_advance_day_check" CHECK ("pay_days"."advance_day" is null or "pay_days"."advance_day" between 1 and 31),
	CONSTRAINT "pay_days_salary_day_check" CHECK ("pay_days"."salary_day" is null or "pay_days"."salary_day" between 1 and 31)
);
--> statement-breakpoint
ALTER TABLE "pay_days" ADD CONSTRAINT "pay_days_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pay_days_user_idx" ON "pay_days" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "incomes" DROP COLUMN "next_income_date";