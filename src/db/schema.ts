import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// All money columns are integer kopecks.

export const periodUnit = pgEnum("period_unit", ["week", "month", "year"]);
export const incomeKind = pgEnum("income_kind", ["salary", "advance", "other"]);
export const allocationKind = pgEnum("allocation_kind", [
  "contribution",
  "surplus",
]);

export const dailyMoveSource = pgEnum("daily_move_source", [
  "transfer",
  "expense",
]);

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

// Users, sessions, accounts and verifications follow the Better Auth schema.
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull().default(""),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// One row per signed-in device.
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

// Required by Better Auth; sign-in is by email link only, so nothing is stored here yet.
export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("accounts_user_idx").on(t.userId)],
);

// Sign-in link tokens waiting to be opened.
export const verifications = pgTable(
  "verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

// Journal of sent sign-in emails: the 3-per-10-minutes limit and "only the latest link works".
// No user_id: a row appears before the user exists; this is sign-in bookkeeping, not user data.
export const signInLinks = pgTable(
  "sign_in_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sign_in_links_email_created_idx").on(t.email, t.createdAt)],
);

const userId = () =>
  uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });

export const wallets = pgTable(
  "wallets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    name: text("name").notNull(),
    position: integer("position").notNull(),
    seedKey: text("seed_key"),
    createdAt: createdAt(),
  },
  (t) => [
    index("wallets_user_idx").on(t.userId),
    uniqueIndex("wallets_user_seed_key_idx").on(t.userId, t.seedKey),
  ],
);

export const envelopes = pgTable(
  "envelopes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => wallets.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    priority: integer("priority").notNull(),
    costPerTime: integer("cost_per_time").notNull(),
    periodN: integer("period_n").notNull(),
    periodUnit: periodUnit("period_unit").notNull(),
    contributionOverride: integer("contribution_override"),
    timesToSave: integer("times_to_save").notNull().default(3),
    startBalance: integer("start_balance").notNull().default(0),
    seedKey: text("seed_key"),
    createdAt: createdAt(),
  },
  (t) => [
    index("envelopes_user_idx").on(t.userId),
    index("envelopes_wallet_idx").on(t.walletId),
    uniqueIndex("envelopes_user_seed_key_idx").on(t.userId, t.seedKey),
    check("envelopes_cost_check", sql`${t.costPerTime} >= 0`),
    check("envelopes_period_check", sql`${t.periodN} >= 1`),
    check("envelopes_times_check", sql`${t.timesToSave} >= 1`),
  ],
);

export const spendCategories = pgTable(
  "spend_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    name: text("name").notNull(),
    monthlyLimit: integer("monthly_limit"),
    position: integer("position").notNull(),
    seedKey: text("seed_key"),
    /** Hidden from lists and pickers; its expenses stay in the history. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("spend_categories_user_idx").on(t.userId),
    uniqueIndex("spend_categories_user_seed_key_idx").on(t.userId, t.seedKey),
  ],
);

export const incomes = pgTable(
  "incomes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    date: date("date").notNull(),
    amount: integer("amount").notNull(),
    kind: incomeKind("kind").notNull(),
    toEnvelopes: integer("to_envelopes").notNull(),
    toDaily: integer("to_daily").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("incomes_user_idx").on(t.userId),
    check("incomes_amount_check", sql`${t.amount} > 0`),
  ],
);

/**
 * The days of the month when the advance and the salary usually arrive, one
 * row per user. «≈ N ₽ в день» counts down to the nearest of these days.
 * A missing row or an empty day means the day is not set.
 */
export const payDays = pgTable(
  "pay_days",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    advanceDay: smallint("advance_day"),
    salaryDay: smallint("salary_day"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("pay_days_user_idx").on(t.userId),
    check(
      "pay_days_advance_day_check",
      sql`${t.advanceDay} is null or ${t.advanceDay} between 1 and 31`,
    ),
    check(
      "pay_days_salary_day_check",
      sql`${t.salaryDay} is null or ${t.salaryDay} between 1 and 31`,
    ),
  ],
);

/** Saved allocation lines: never recalculated after the fact. */
export const allocations = pgTable(
  "allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    incomeId: uuid("income_id")
      .notNull()
      .references(() => incomes.id, { onDelete: "cascade" }),
    envelopeId: uuid("envelope_id")
      .notNull()
      .references(() => envelopes.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    kind: allocationKind("kind").notNull(),
    sourceEnvelopeId: uuid("source_envelope_id").references(
      () => envelopes.id,
      { onDelete: "set null" },
    ),
  },
  (t) => [
    index("allocations_user_idx").on(t.userId),
    index("allocations_envelope_idx").on(t.envelopeId),
  ],
);

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    amount: integer("amount").notNull(),
    date: date("date").notNull(),
    note: text("note"),
    envelopeId: uuid("envelope_id").references(() => envelopes.id, {
      onDelete: "cascade",
    }),
    categoryId: uuid("category_id").references(() => spendCategories.id, {
      onDelete: "cascade",
    }),
    createdAt: createdAt(),
  },
  (t) => [
    index("expenses_user_idx").on(t.userId),
    index("expenses_envelope_idx").on(t.envelopeId),
    index("expenses_category_idx").on(t.categoryId),
    check("expenses_amount_check", sql`${t.amount} > 0`),
    check(
      "expenses_target_check",
      sql`${t.envelopeId} is not null or ${t.categoryId} is not null`,
    ),
  ],
);

/**
 * A transfer of money between two sides. A side is «на жизнь» (the flag) or
 * an envelope. A flag off and an empty envelope mean the envelope was deleted:
 * the transfer stays, the money stays where it went.
 */
export const transfers = pgTable(
  "transfers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    amount: integer("amount").notNull(),
    date: date("date").notNull(),
    fromDaily: boolean("from_daily").notNull().default(false),
    fromEnvelopeId: uuid("from_envelope_id").references(() => envelopes.id, {
      onDelete: "set null",
    }),
    toDaily: boolean("to_daily").notNull().default(false),
    toEnvelopeId: uuid("to_envelope_id").references(() => envelopes.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (t) => [
    index("transfers_user_idx").on(t.userId),
    index("transfers_from_envelope_idx").on(t.fromEnvelopeId),
    index("transfers_to_envelope_idx").on(t.toEnvelopeId),
    check("transfers_amount_check", sql`${t.amount} > 0`),
    check(
      "transfers_not_both_daily_check",
      sql`not (${t.fromDaily} and ${t.toDaily})`,
    ),
    check(
      "transfers_daily_side_check",
      sql`(not ${t.fromDaily} or ${t.fromEnvelopeId} is null) and (not ${t.toDaily} or ${t.toEnvelopeId} is null)`,
    ),
    check(
      "transfers_distinct_envelopes_check",
      sql`${t.fromEnvelopeId} is null or ${t.fromEnvelopeId} is distinct from ${t.toEnvelopeId}`,
    ),
  ],
);

/**
 * Journal of changes to «на жизнь»: every save or delete of a transfer or of
 * a daily expense writes the difference «now − before» into the period of the
 * latest income, whatever the date of the item.
 */
export const dailyMoves = pgTable(
  "daily_moves",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    incomeId: uuid("income_id")
      .notNull()
      .references(() => incomes.id, { onDelete: "cascade" }),
    source: dailyMoveSource("source").notNull(),
    transferId: uuid("transfer_id").references(() => transfers.id, {
      onDelete: "set null",
    }),
    expenseId: uuid("expense_id").references(() => expenses.id, {
      onDelete: "set null",
    }),
    /** Kopecks with a sign: + into «на жизнь», − out of it. */
    amount: integer("amount").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("daily_moves_user_idx").on(t.userId),
    index("daily_moves_income_idx").on(t.incomeId),
    index("daily_moves_transfer_idx").on(t.transferId),
    index("daily_moves_expense_idx").on(t.expenseId),
    check("daily_moves_amount_check", sql`${t.amount} <> 0`),
    check(
      "daily_moves_transfer_ref_check",
      sql`${t.source} = 'transfer' or ${t.transferId} is null`,
    ),
    check(
      "daily_moves_expense_ref_check",
      sql`${t.source} = 'expense' or ${t.expenseId} is null`,
    ),
  ],
);
