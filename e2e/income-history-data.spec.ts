import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import {
  AB_AUTH_FILE,
  AB_EMAIL,
  DEMO_COPY_AUTH_FILE,
  DEMO_COPY_EMAIL,
  INCOME_OWNER_EMAIL,
  e2eEnv,
} from "./env";

// Incomes on real data: a correction or a deletion lays the later incomes out
// again, an income of another person is out of reach, the history grows past
// 10 rows. Each describe has a user of its own (see global-setup.ts), so these
// scenarios do not touch the demo data and do not depend on the order of files.
// Every scenario puts back what it changed.

const NBSP = " ";
const rub = (text: string) => `${text.replace(/ /g, NBSP)}${NBSP}₽`;

/** "−12 345 ₽" or "12 345 ₽" → whole rubles. */
function parseRub(text: string): number {
  const match = text.match(/(−?)(\d[\d\s]*)\s*₽/);
  if (!match) throw new Error(`No amount in: ${text}`);
  const value = Number(match[2].replace(/\s/g, ""));
  return match[1] === "−" ? -value : value;
}

const rows = (page: Page) => page.getByTestId("income-row");

/** Rows of the incomes with exactly this amount ("5 000 ₽" is not "35 000 ₽"). */
const rowsOf = (page: Page, amount: string) =>
  rows(page).filter({ has: page.getByText(rub(amount), { exact: true }) });

/** «Осталось на жизнь», or null while there is no income. */
async function dailyLeft(page: Page): Promise<number | null> {
  await page.goto("/daily");
  const left = page.getByTestId("daily-left");
  if ((await left.count()) === 0) return null;
  return parseRub(await left.innerText());
}

async function allocate(
  page: Page,
  amount: string,
  kind: string,
  opts: { uncheck?: string; days?: [string, string] } = {},
) {
  await page.goto("/income");
  await page.getByLabel("Сколько пришло").fill(amount);
  await page.getByRole("button", { name: kind, exact: true }).click();
  if (opts.days) {
    await page.getByLabel("Аванс приходит").fill(opts.days[0]);
    await page.getByLabel("Зарплата приходит").fill(opts.days[1]);
  }
  if (opts.uncheck) {
    await page
      .getByRole("checkbox", { name: new RegExp(opts.uncheck) })
      .click();
  }
  await page.getByRole("button", { name: "Разложить" }).click();
  await expect(page).toHaveURL("/");
}

async function openIncome(page: Page, amount: string) {
  await page.goto("/income");
  await rowsOf(page, amount).first().click();
  await expect(page.getByRole("heading", { name: "Доход" })).toBeVisible();
}

async function editIncome(page: Page, amount: string, newAmount: string) {
  await openIncome(page, amount);
  await page.getByRole("link", { name: "Изменить" }).click();
  await page.getByLabel("Сколько пришло").fill(newAmount);
  await page.getByRole("button", { name: "Сохранить" }).click();
}

async function deleteIncome(page: Page, amount: string) {
  await openIncome(page, amount);
  await page.getByRole("button", { name: "Удалить доход" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Удалить", exact: true })
    .click();
  await expect(page).toHaveURL("/income");
}

/** A daily expense, or one from an envelope when `envelope` is given. */
async function addExpense(page: Page, amount: string, envelope?: string) {
  await page.goto("/daily");
  await page.getByRole("link", { name: "Внести трату" }).click();
  await page.getByLabel("Сумма").fill(amount);
  if (envelope) {
    await page.getByRole("button", { name: "Из конверта" }).click();
    await page.getByRole("button", { name: "Все конверты" }).click();
    await page
      .getByRole("button", { name: envelope, exact: true })
      .first()
      .click();
  }
  await page.getByRole("button", { name: "Продукты", exact: true }).click();
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page).toHaveURL("/daily");
}

const expenseRow = (page: Page, amount: string) =>
  page.locator('a[href^="/expenses/"]', { hasText: rub(amount) }).first();

async function openExpense(page: Page, amount: string) {
  await page.goto("/daily");
  await expenseRow(page, amount).click();
}

async function deleteExpense(page: Page, amount: string) {
  await openExpense(page, amount);
  await page.getByRole("button", { name: "Удалить трату" }).click();
  await page.getByRole("button", { name: "Удалить", exact: true }).click();
  await expect(page).toHaveURL("/daily");
}

async function envelopeBalance(
  page: Page,
  wallet: string,
  envelope: string,
): Promise<number> {
  await page.goto("/");
  await page.getByRole("link", { name: new RegExp(`^${wallet}`) }).click();
  await page.getByRole("link", { name: new RegExp(envelope) }).click();
  const text = await page.getByText(/^накоплено [−\d]/).innerText();
  return parseRub(text.replace(/^накоплено\s+/, "").split("₽")[0] + "₽");
}

/** What the income screen shows, to compare before and after. */
const screenText = (page: Page) => page.locator("main").innerText();

test.describe("wallet with two envelopes", () => {
  // Wallet: Alpha (cost 1 000, balance 500) and Beta (cost 800, balance 0),
  // both save for 1 time. One income gives Alpha 500 and Beta 400, so 900 go
  // to envelopes. Daily category: «Продукты».
  test.use({ storageState: AB_AUTH_FILE });
  test.describe.configure({ mode: "serial" });

  test("one income: an expense stays counted, is deleted or corrected while there is no income", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    // 10 900 − 900 for envelopes leaves exactly 10 000.
    await allocate(page, "10 900", "Другое");
    expect(await dailyLeft(page)).toBe(10000);
    await addExpense(page, "2000");
    expect(await dailyLeft(page)).toBe(8000);

    // The income is deleted: the screens are as before the first allocation.
    await deleteIncome(page, "10 900");
    expect(await dailyLeft(page)).toBeNull();
    await page.goto("/transfers/new");
    await expect(page.getByText("На жизнь", { exact: true })).toHaveCount(0);
    // A new income: the expense is still counted.
    await allocate(page, "10 900", "Другое");
    expect(await dailyLeft(page)).toBe(8000);

    // The expense is deleted while there is no income.
    await deleteIncome(page, "10 900");
    await deleteExpense(page, "2 000");
    await allocate(page, "10 900", "Другое");
    expect(await dailyLeft(page)).toBe(10000);

    // The expense is made again, the income deleted, the expense corrected.
    await addExpense(page, "2000");
    expect(await dailyLeft(page)).toBe(8000);
    await deleteIncome(page, "10 900");
    await openExpense(page, "2 000");
    await page.getByLabel("Сумма").fill("2500");
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(page).toHaveURL("/daily");
    await allocate(page, "10 900", "Другое");
    expect(await dailyLeft(page)).toBe(7500);

    await deleteIncome(page, "10 900");
    await deleteExpense(page, "2 500");
  });

  test("an earlier income, the pay days and the expenses stay when a later income changes", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await allocate(page, "5 000", "Аванс", { days: ["25", "10"] });
    await openIncome(page, "5 000");
    const earlier = await screenText(page);

    await allocate(page, "10 900", "Зарплата");
    await addExpense(page, "1000");
    await editIncome(page, "10 900", "12 900");
    await openIncome(page, "5 000");
    expect(await screenText(page)).toBe(earlier);
    await deleteIncome(page, "12 900");
    await openIncome(page, "5 000");
    expect(await screenText(page)).toBe(earlier);

    await page.goto("/income");
    await expect(page.getByLabel("Аванс приходит")).toHaveValue("25");
    await expect(page.getByLabel("Зарплата приходит")).toHaveValue("10");
    await page.goto("/daily");
    await expect(expenseRow(page, "1 000")).toBeVisible();

    await deleteExpense(page, "1 000");
    await deleteIncome(page, "5 000");
  });

  test("more is spent than is left: the daily balance goes below zero", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await allocate(page, "5 000", "Другое"); // 4 100 for daily life
    await allocate(page, "10 900", "Другое"); // 10 000 for daily life
    expect(await dailyLeft(page)).toBe(14100);
    await addExpense(page, "20000");
    expect(await dailyLeft(page)).toBe(-5900);
    await deleteIncome(page, "10 900");
    expect(await dailyLeft(page)).toBe(-15900);

    await deleteIncome(page, "5 000");
    await deleteExpense(page, "20 000");
  });

  test("an envelope goes below zero when the income that filled it is deleted", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    expect(await envelopeBalance(page, "Wallet", "Alpha")).toBe(500);
    await allocate(page, "10 900", "Другое"); // Alpha 500 → 1 000
    expect(await envelopeBalance(page, "Wallet", "Alpha")).toBe(1000);
    await addExpense(page, "1000", "Alpha");
    expect(await envelopeBalance(page, "Wallet", "Alpha")).toBe(0);
    await deleteIncome(page, "10 900");
    expect(await envelopeBalance(page, "Wallet", "Alpha")).toBe(-500);
    // On the wallet screen the envelope has the status «минус».
    await page.goto("/");
    await page.getByRole("link", { name: /^Wallet/ }).click();
    await expect(page.getByRole("link", { name: /Alpha/ })).toContainText(
      "минус",
    );

    await deleteExpense(page, "1 000");
    expect(await envelopeBalance(page, "Wallet", "Alpha")).toBe(500);
  });

  test("a correction of the first of two incomes lays the second out again", async ({
    page,
  }) => {
    await allocate(page, "10 000", "Другое");
    await allocate(page, "10 000", "Другое");
    // The second income gave the full Alpha's contribution to Beta as a surplus.
    expect(await envelopeBalance(page, "Wallet", "Alpha")).toBe(1000);
    expect(await envelopeBalance(page, "Wallet", "Beta")).toBe(1300);
    const before = await dailyLeft(page);

    // The older of the two is the second row of the history.
    await page.goto("/income");
    await rows(page).nth(1).click();
    await page.getByRole("link", { name: "Изменить" }).click();
    await page.getByLabel("Сколько пришло").fill("300");
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(page.getByTestId("income-to-envelopes")).toHaveText(
      rub("300"),
    );
    await expect(page.getByTestId("income-to-daily")).toHaveText(rub("0"));

    expect(await envelopeBalance(page, "Wallet", "Alpha")).toBe(1300);
    expect(await envelopeBalance(page, "Wallet", "Beta")).toBe(400);
    expect(await dailyLeft(page)).toBe((before ?? 0) - 9100);

    // The second income now gives Alpha 500 and Beta 400, no surplus.
    await page.goto("/income");
    await rows(page).nth(0).click();
    await expect(page.getByTestId("income-to-envelopes")).toHaveText(
      rub("900"),
    );
    await expect(page.getByTestId("income-to-daily")).toHaveText(rub("9 100"));
    await expect(page.getByText("излишек")).toHaveCount(0);
  });

  test("a deletion of the first income lays the second out again", async ({
    page,
  }) => {
    const before = await dailyLeft(page);
    await page.goto("/income");
    await rows(page).nth(1).click();
    await page.getByRole("button", { name: "Удалить доход" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Удалить", exact: true })
      .click();
    await expect(page).toHaveURL("/income");

    expect(await envelopeBalance(page, "Wallet", "Alpha")).toBe(1000);
    expect(await envelopeBalance(page, "Wallet", "Beta")).toBe(400);
    // The first income had nothing for daily life: only its envelopes go.
    expect(await dailyLeft(page)).toBe(before);
    await page.goto("/income");
    await rows(page).nth(0).click();
    await expect(page.getByTestId("income-to-envelopes")).toHaveText(
      rub("900"),
    );
  });

  test("the history shows 10 rows and «Все доходы» only past 10", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const more = page.getByRole("link", { name: "Все доходы" });
    // One income of 10 000 is there; nine more make exactly 10.
    for (let amount = 101; amount <= 109; amount++) {
      await allocate(page, String(amount), "Другое");
    }
    await page.goto("/income");
    await expect(rows(page)).toHaveCount(10);
    await expect(more).toHaveCount(0);

    await allocate(page, "110", "Другое");
    await allocate(page, "111", "Другое");
    await page.goto("/income");
    await expect(rows(page)).toHaveCount(10);
    await expect(rows(page).first()).toContainText(rub("111"));
    await more.click();

    await expect(page).toHaveURL("/income/all");
    await expect(
      page.getByRole("heading", { name: "Все доходы" }),
    ).toBeVisible();
    await expect(rows(page)).toHaveCount(12);
    await expect(rows(page).first()).toContainText(rub("111"));
    await expect(rows(page).last()).toContainText(rub("10 000"));

    // An income opened from there goes back there.
    await rows(page).last().click();
    await page.getByRole("link", { name: "Назад" }).click();
    await expect(page).toHaveURL("/income/all");
  });

  test("an income of another person is out of reach: screens and changes", async ({
    page,
  }) => {
    const sql = postgres(e2eEnv.DATABASE_URL, { max: 1, onnotice: () => {} });
    try {
      const owned = () => sql`
        select id, amount from incomes
        where user_id = (select id from users where email = ${INCOME_OWNER_EMAIL})`;
      const [foreign] = await owned();
      const ownCount = async () =>
        (
          await sql`select count(*)::int as count from incomes
            where user_id = (select id from users where email = ${AB_EMAIL})`
        )[0].count;
      await allocate(page, "7 777", "Другое");
      const ownBefore = await ownCount();

      // Screens look like a missing income and say nothing about it.
      for (const path of [
        `/income/${foreign.id}`,
        `/income/${foreign.id}/edit`,
      ]) {
        await page.goto(path);
        await expect(page.getByText("Доход не найден")).toBeVisible();
        await expect(page.getByText(rub("1 234"))).toHaveCount(0);
      }

      /** Sends the next server action with the other person's id instead of ours. */
      async function aimAtForeign(ownId: string) {
        await page.route("**/*", async (route) => {
          const request = route.request();
          const body = request.postData();
          if (
            request.method() === "POST" &&
            request.headers()["next-action"] &&
            body?.includes(ownId)
          ) {
            await route.continue({
              postData: body.replaceAll(ownId, foreign.id),
            });
          } else {
            await route.continue();
          }
        });
      }

      // A correction.
      await page.goto("/income");
      await rowsOf(page, "7 777").first().click();
      await expect(page).toHaveURL(/\/income\/[0-9a-f-]{36}/);
      const ownId = page.url().match(/\/income\/([0-9a-f-]{36})/)![1];
      await aimAtForeign(ownId);
      await page.getByRole("link", { name: "Изменить" }).click();
      await page.getByLabel("Сколько пришло").fill("9 999");
      await page.getByRole("button", { name: "Сохранить" }).click();
      await expect(page.getByText("Доход не найден")).toBeVisible();
      expect(await owned()).toEqual([foreign]);

      // A deletion.
      await page.goto(`/income/${ownId}`);
      await page.getByRole("button", { name: "Удалить доход" }).click();
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: "Удалить", exact: true })
        .click();
      await expect(page.getByText("Доход не найден")).toBeVisible();
      expect(await owned()).toEqual([foreign]);
      expect(await ownCount()).toBe(ownBefore);
      await page.unroute("**/*");
      await deleteIncome(page, "7 777");
    } finally {
      await sql.end();
    }
  });
});

test.describe("copy of the demo data", () => {
  test.use({ storageState: DEMO_COPY_AUTH_FILE });
  test.describe.configure({ mode: "serial" });

  test("a deleted salary takes back what it gave to the envelopes", async ({
    page,
  }) => {
    await allocate(page, "150 000", "Зарплата");
    expect(await envelopeBalance(page, "Self-care", "Косметология")).toBe(
      -27400 + 4475,
    );
    await deleteIncome(page, "150 000");
    expect(await envelopeBalance(page, "Self-care", "Косметология")).toBe(
      -27400,
    );
    expect(await envelopeBalance(page, "Clothes", "Одежда")).toBe(6400);
    expect(await envelopeBalance(page, "Clothes", "Украшения")).toBe(27300);
    await page.goto("/");
    await expect(page.getByTestId("total-in-envelopes")).toHaveText(
      rub("230 350"),
    );
  });

  test("the checkboxes are remembered: the form, the later income after a correction", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await allocate(page, "150 000", "Зарплата");
    await allocate(page, "20 000", "Другое", { uncheck: "Clothes" });
    const before = await dailyLeft(page);

    // The correction of the salary: the daily share grows by 10 000.
    await editIncome(page, "150 000", "160 000");
    await expect(page.getByTestId("income-to-envelopes")).toHaveText(
      rub("30 775"),
    );
    await expect(page.getByTestId("income-to-daily")).toHaveText(
      rub("129 225"),
    );
    expect(await dailyLeft(page)).toBe((before ?? 0) + 10000);
    await page.goto("/income");
    await expect(rowsOf(page, "160 000").first()).toContainText(
      `в конверты ${rub("30 775")} · на жизнь ${rub("129 225")}`,
    );

    // The later income is laid out as before: Clothes unchecked.
    await openIncome(page, "20 000");
    const wallet = (name: string) =>
      page.getByTestId("income-wallet").filter({ hasText: name });
    await expect(wallet("Clothes")).toHaveCount(0);
    await expect(wallet("Self-care")).toContainText(rub("5 925"));
    await expect(wallet("Miscellaneous")).toContainText(rub("6 550"));
    await expect(wallet("Long term")).toContainText(rub("5 700"));
    await expect(wallet("Goals WB")).toContainText(rub("1 825"));

    // Its form is filled, the unchecked wallet stays unchecked.
    await page.getByRole("link", { name: "Изменить" }).click();
    await expect(page.getByLabel("Сколько пришло")).toHaveValue("20 000");
    await expect(
      page.getByRole("checkbox", { name: /Clothes/ }),
    ).not.toBeChecked();
    await expect(
      page.getByRole("checkbox", { name: /Self-care/ }),
    ).toBeChecked();
    await expect(page.getByLabel("Аванс приходит")).toHaveCount(0);
    await expect(page.getByLabel("Зарплата приходит")).toHaveCount(0);

    // A changed kind leaves the numbers as they are.
    await openIncome(page, "160 000");
    await page.getByRole("link", { name: "Изменить" }).click();
    await page.getByRole("button", { name: "Аванс", exact: true }).click();
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(page.getByTestId("income-to-daily")).toHaveText(
      rub("129 225"),
    );

    // Deleting the salary takes its daily share away.
    const withSalary = await dailyLeft(page);
    await deleteIncome(page, "160 000");
    expect(await dailyLeft(page)).toBe((withSalary ?? 0) - 129225);
    await deleteIncome(page, "20 000");
  });

  test("an envelope deleted after the allocation: its share stays through corrections", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await allocate(page, "150 000", "Зарплата");
    await allocate(page, "80 000", "Аванс");

    // Deleting an envelope removes its lines from the incomes.
    const sql = postgres(e2eEnv.DATABASE_URL, { max: 1, onnotice: () => {} });
    await sql`delete from envelopes where name = 'Одежда'
      and user_id = (select id from users where email = ${DEMO_COPY_EMAIL})`;
    await sql.end();

    const deletedRow = () =>
      page.getByText("В удалённые конверты").locator("..");
    await openIncome(page, "150 000");
    await expect(
      page.getByTestId("income-wallet").filter({ hasText: "Clothes" }),
    ).toContainText(rub("300"));
    await expect(deletedRow()).toContainText(rub("4 500"));
    await expect(page.getByTestId("income-to-envelopes")).toHaveText(
      rub("30 775"),
    );

    // Less than went to the deleted envelope: refused.
    await page.getByRole("link", { name: "Изменить" }).click();
    await page.getByLabel("Сколько пришло").fill("4 000");
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(
      page.getByText("Не меньше 4 500 ₽: столько ушло в удалённые конверты"),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/edit/);

    // A correction keeps the share of the deleted envelope, in both incomes.
    await page.getByLabel("Сколько пришло").fill("160 000");
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(deletedRow()).toContainText(rub("4 500"));
    await expect(page.getByTestId("income-to-envelopes")).toHaveText(
      rub("30 775"),
    );
    await openIncome(page, "80 000");
    await expect(deletedRow()).toContainText(rub("4 500"));
    await expect(page.getByTestId("income-to-envelopes")).toHaveText(
      rub("30 775"),
    );
    await expect(page.getByTestId("income-to-daily")).toHaveText(rub("49 225"));
  });
});
