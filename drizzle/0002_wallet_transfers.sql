CREATE TYPE "public"."daily_move_source" AS ENUM('transfer', 'expense');--> statement-breakpoint
CREATE TABLE "daily_moves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"income_id" uuid NOT NULL,
	"source" "daily_move_source" NOT NULL,
	"transfer_id" uuid,
	"expense_id" uuid,
	"amount" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_moves_amount_check" CHECK ("daily_moves"."amount" <> 0),
	CONSTRAINT "daily_moves_transfer_ref_check" CHECK ("daily_moves"."source" = 'transfer' or "daily_moves"."transfer_id" is null),
	CONSTRAINT "daily_moves_expense_ref_check" CHECK ("daily_moves"."source" = 'expense' or "daily_moves"."expense_id" is null)
);
--> statement-breakpoint
CREATE TABLE "transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"date" date NOT NULL,
	"from_daily" boolean DEFAULT false NOT NULL,
	"from_envelope_id" uuid,
	"to_daily" boolean DEFAULT false NOT NULL,
	"to_envelope_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transfers_amount_check" CHECK ("transfers"."amount" > 0),
	CONSTRAINT "transfers_not_both_daily_check" CHECK (not ("transfers"."from_daily" and "transfers"."to_daily")),
	CONSTRAINT "transfers_daily_side_check" CHECK ((not "transfers"."from_daily" or "transfers"."from_envelope_id" is null) and (not "transfers"."to_daily" or "transfers"."to_envelope_id" is null)),
	CONSTRAINT "transfers_distinct_envelopes_check" CHECK ("transfers"."from_envelope_id" is null or "transfers"."from_envelope_id" is distinct from "transfers"."to_envelope_id")
);
--> statement-breakpoint
ALTER TABLE "daily_moves" ADD CONSTRAINT "daily_moves_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_moves" ADD CONSTRAINT "daily_moves_income_id_incomes_id_fk" FOREIGN KEY ("income_id") REFERENCES "public"."incomes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_moves" ADD CONSTRAINT "daily_moves_transfer_id_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."transfers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_moves" ADD CONSTRAINT "daily_moves_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_from_envelope_id_envelopes_id_fk" FOREIGN KEY ("from_envelope_id") REFERENCES "public"."envelopes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_to_envelope_id_envelopes_id_fk" FOREIGN KEY ("to_envelope_id") REFERENCES "public"."envelopes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "daily_moves_user_idx" ON "daily_moves" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "daily_moves_income_idx" ON "daily_moves" USING btree ("income_id");--> statement-breakpoint
CREATE INDEX "daily_moves_transfer_idx" ON "daily_moves" USING btree ("transfer_id");--> statement-breakpoint
CREATE INDEX "daily_moves_expense_idx" ON "daily_moves" USING btree ("expense_id");--> statement-breakpoint
CREATE INDEX "transfers_user_idx" ON "transfers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transfers_from_envelope_idx" ON "transfers" USING btree ("from_envelope_id");--> statement-breakpoint
CREATE INDEX "transfers_to_envelope_idx" ON "transfers" USING btree ("to_envelope_id");--> statement-breakpoint
-- Journal of «на жизнь» for expenses that already exist: every daily expense
-- (no envelope) gets a row in the period of the latest income dated not later
-- than the expense (ties: the income entered last, like loadLatestIncome).
-- Expenses before the first income get no row. Expenses themselves are not changed.
INSERT INTO "daily_moves" ("user_id", "income_id", "source", "expense_id", "amount")
SELECT e."user_id", i."id", 'expense', e."id", -e."amount"
FROM "expenses" e
CROSS JOIN LATERAL (
	SELECT i2."id"
	FROM "incomes" i2
	WHERE i2."user_id" = e."user_id" AND i2."date" <= e."date"
	ORDER BY i2."date" DESC, i2."created_at" DESC
	LIMIT 1
) AS i
WHERE e."envelope_id" IS NULL;
