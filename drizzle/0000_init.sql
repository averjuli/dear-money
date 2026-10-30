CREATE TYPE "public"."allocation_kind" AS ENUM('contribution', 'surplus');--> statement-breakpoint
CREATE TYPE "public"."income_kind" AS ENUM('salary', 'advance', 'other');--> statement-breakpoint
CREATE TYPE "public"."period_unit" AS ENUM('week', 'month', 'year');--> statement-breakpoint
CREATE TABLE "allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"income_id" uuid NOT NULL,
	"envelope_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"kind" "allocation_kind" NOT NULL,
	"source_envelope_id" uuid
);
--> statement-breakpoint
CREATE TABLE "envelopes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"wallet_id" uuid NOT NULL,
	"name" text NOT NULL,
	"priority" integer NOT NULL,
	"cost_per_time" integer NOT NULL,
	"period_n" integer NOT NULL,
	"period_unit" "period_unit" NOT NULL,
	"contribution_override" integer,
	"times_to_save" integer DEFAULT 3 NOT NULL,
	"start_balance" integer DEFAULT 0 NOT NULL,
	"seed_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "envelopes_cost_check" CHECK ("envelopes"."cost_per_time" >= 0),
	CONSTRAINT "envelopes_period_check" CHECK ("envelopes"."period_n" >= 1),
	CONSTRAINT "envelopes_times_check" CHECK ("envelopes"."times_to_save" >= 1)
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"date" date NOT NULL,
	"note" text,
	"envelope_id" uuid,
	"category_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expenses_amount_check" CHECK ("expenses"."amount" > 0),
	CONSTRAINT "expenses_target_check" CHECK (("expenses"."envelope_id" is null) <> ("expenses"."category_id" is null))
);
--> statement-breakpoint
CREATE TABLE "incomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"amount" integer NOT NULL,
	"kind" "income_kind" NOT NULL,
	"next_income_date" date,
	"to_envelopes" integer NOT NULL,
	"to_daily" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "incomes_amount_check" CHECK ("incomes"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "spend_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"monthly_limit" integer,
	"position" integer NOT NULL,
	"seed_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"login" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_login_unique" UNIQUE("login")
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"seed_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_income_id_incomes_id_fk" FOREIGN KEY ("income_id") REFERENCES "public"."incomes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_envelope_id_envelopes_id_fk" FOREIGN KEY ("envelope_id") REFERENCES "public"."envelopes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_source_envelope_id_envelopes_id_fk" FOREIGN KEY ("source_envelope_id") REFERENCES "public"."envelopes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "envelopes" ADD CONSTRAINT "envelopes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "envelopes" ADD CONSTRAINT "envelopes_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_envelope_id_envelopes_id_fk" FOREIGN KEY ("envelope_id") REFERENCES "public"."envelopes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_spend_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."spend_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spend_categories" ADD CONSTRAINT "spend_categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "allocations_user_idx" ON "allocations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "allocations_envelope_idx" ON "allocations" USING btree ("envelope_id");--> statement-breakpoint
CREATE INDEX "envelopes_user_idx" ON "envelopes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "envelopes_wallet_idx" ON "envelopes" USING btree ("wallet_id");--> statement-breakpoint
CREATE UNIQUE INDEX "envelopes_user_seed_key_idx" ON "envelopes" USING btree ("user_id","seed_key");--> statement-breakpoint
CREATE INDEX "expenses_user_idx" ON "expenses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "expenses_envelope_idx" ON "expenses" USING btree ("envelope_id");--> statement-breakpoint
CREATE INDEX "expenses_category_idx" ON "expenses" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "incomes_user_idx" ON "incomes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "spend_categories_user_idx" ON "spend_categories" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "spend_categories_user_seed_key_idx" ON "spend_categories" USING btree ("user_id","seed_key");--> statement-breakpoint
CREATE INDEX "wallets_user_idx" ON "wallets" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wallets_user_seed_key_idx" ON "wallets" USING btree ("user_id","seed_key");