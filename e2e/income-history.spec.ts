import { expect, test, type Page } from "@playwright/test";

// The history of incomes, an income screen, a correction and a deletion.
// The scenario lays out two small incomes of its own at the end of the chain,
// corrects and deletes them, and in the end checks that the balances are the
// same as before them. Whatever other scenarios have allocated stays as it was.

const NBSP = " ";

/** "−12 345 ₽" or "12 345 ₽" → whole rubles. */
function parseRub(text: string): number {
  const match = text.match(/(−?)(\d[\d\s]*)\s*₽/);
  if (!match) throw new Error(`No amount in: ${text}`);
  const value = Number(match[2].replace(/\s/g, ""));
  return match[1] === "−" ? -value : value;
}

const rub = (text: string) => `${text.replace(/ /g, NBSP)}${NBSP}₽`;

const rows = (page: Page) => page.getByTestId("income-row");

async function totalInEnvelopes(page: Page): Promise<number> {
  await page.goto("/");
  return parseRub(await page.getByTestId("total-in-envelopes").innerText());
}

/** «Осталось на жизнь», or null while there is no income at all. */
async function dailyLeft(page: Page): Promise<number | null> {
  await page.goto("/daily");
  const left = page.getByTestId("daily-left");
  if ((await left.count()) === 0) return null;
  return parseRub(await left.innerText());
}

async function allocate(page: Page, amount: string) {
  await page.goto("/income");
  await page.getByLabel("Сколько пришло").fill(amount);
  await page.getByRole("button", { name: "Другое", exact: true }).click();
  await page.getByRole("button", { name: "Разложить" }).click();
  await expect(page).toHaveURL("/");
}

/** Rows of the incomes with exactly this amount ("5 000 ₽" is not "35 000 ₽"). */
function rowsOf(page: Page, amount: string) {
  return rows(page).filter({
    has: page.getByText(rub(amount), { exact: true }),
  });
}

/** The row of the income with this amount in the history, the newest first. */
function rowOf(page: Page, amount: string) {
  return rowsOf(page, amount).first();
}

async function openIncome(page: Page, amount: string) {
  await page.goto("/income");
  await rowOf(page, amount).click();
  await expect(page.getByRole("heading", { name: "Доход" })).toBeVisible();
}

let envelopesBefore = 0;
let dailyBefore: number | null = null;

test.describe.configure({ mode: "serial" });

test("before: the balances to compare with at the end", async ({ page }) => {
  envelopesBefore = await totalInEnvelopes(page);
  dailyBefore = await dailyLeft(page);
});

test("two incomes appear in the history, the newest first", async ({
  page,
}) => {
  await allocate(page, "40 000");
  await allocate(page, "35 000");
  await page.goto("/income");
  await expect(page.getByRole("heading", { name: "История" })).toBeVisible();
  const first = rows(page).nth(0);
  const second = rows(page).nth(1);
  await expect(first).toContainText("Другое");
  await expect(first).toContainText(rub("35 000"));
  await expect(first).toContainText("сегодня");
  await expect(first).toContainText(/в конверты [\d\s]+₽ · на жизнь [\d\s]+₽/);
  await expect(second).toContainText(rub("40 000"));
  // Up to 10 rows and no «Все доходы» while there are not more than 10.
  expect(await rows(page).count()).toBeLessThanOrEqual(10);
});

test("the income screen shows the split and goes back", async ({ page }) => {
  await openIncome(page, "40 000");
  await expect(page).toHaveURL(/\/income\/[0-9a-f-]{36}\?from=%2Fincome$/);
  await expect(page.getByText("Другое").first()).toBeVisible();
  await expect(page.getByText(rub("40 000")).first()).toBeVisible();
  await expect(page.getByText("В конверты", { exact: true })).toBeVisible();
  await expect(page.getByText("На повседневные траты")).toBeVisible();
  const toEnvelopes = parseRub(
    await page.getByTestId("income-to-envelopes").innerText(),
  );
  const toDaily = parseRub(
    await page.getByTestId("income-to-daily").innerText(),
  );
  expect(toEnvelopes + toDaily).toBe(40000);
  // The split by wallets: the wallets that got money, in their order.
  await expect(page.getByTestId("income-wallet").first()).toBeVisible();
  await page.getByRole("link", { name: "Назад" }).click();
  await expect(page).toHaveURL("/income");
});

test("the new screens do not scroll sideways at 360 and 1440 px", async ({
  page,
}) => {
  await page.goto("/income");
  const href = await rowOf(page, "40 000").getAttribute("href");
  expect(href).not.toBeNull();
  const incomePath = href!.split("?")[0];
  for (const width of [360, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      "/income",
      "/income/all",
      incomePath,
      `${incomePath}/edit`,
    ]) {
      await page.goto(path);
      await expect(page.getByRole("heading").first()).toBeVisible();
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow, `${path} at ${width} px`).toBeLessThanOrEqual(0);
    }
  }
});

test("an unknown income is not found", async ({ page }) => {
  await page.goto("/income/00000000-0000-4000-8000-000000000000");
  await expect(page.getByText("Доход не найден")).toBeVisible();
  await expect(page.getByRole("link", { name: "На главную" })).toBeVisible();
  await page.goto("/income/not-an-id/edit");
  await expect(page.getByText("Доход не найден")).toBeVisible();
});

test("the correction form is filled and has no pay-day fields", async ({
  page,
}) => {
  await openIncome(page, "40 000");
  await page.getByRole("link", { name: "Изменить" }).click();
  await expect(page).toHaveURL(/\/income\/[0-9a-f-]{36}\/edit/);
  await expect(page.getByLabel("Сколько пришло")).toHaveValue("40 000");
  await expect(
    page.getByRole("button", { name: "Другое", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Аванс приходит")).toHaveCount(0);
  await expect(page.getByLabel("Зарплата приходит")).toHaveCount(0);
  await expect(
    page.getByText("Следующие раскладки пересчитаются: 1"),
  ).toBeVisible();

  // An empty amount cannot be saved.
  await page.getByLabel("Сколько пришло").fill("");
  await expect(page.getByRole("button", { name: "Сохранить" })).toBeDisabled();
  await page.getByLabel("Сколько пришло").fill("0");
  await expect(page.getByRole("button", { name: "Сохранить" })).toBeDisabled();
});

test("a corrected amount: the history, the screens and «Осталось на жизнь»", async ({
  page,
}) => {
  await openIncome(page, "40 000");
  const dailyShareBefore = parseRub(
    await page.getByTestId("income-to-daily").innerText(),
  );
  const leftBefore = await dailyLeft(page);

  await openIncome(page, "40 000");
  await page.getByRole("link", { name: "Изменить" }).click();
  await page.getByLabel("Сколько пришло").fill("5 000");
  await page.getByRole("button", { name: "Сохранить" }).click();

  // Back to the income screen with the new numbers.
  await expect(page).toHaveURL(/\/income\/[0-9a-f-]{36}\?from=%2Fincome$/);
  await expect(page.getByText(rub("5 000")).first()).toBeVisible();
  // 5 000 is less than the contributions: all of it goes to envelopes.
  await expect(page.getByTestId("income-to-envelopes")).toHaveText(
    rub("5 000"),
  );
  await expect(page.getByTestId("income-to-daily")).toHaveText(rub("0"));

  // The history shows it, the other income is still there.
  await page.goto("/income");
  await expect(rowOf(page, "5 000")).toContainText(
    "в конверты " + rub("5 000"),
  );
  await expect(rowOf(page, "35 000")).toBeVisible();
  await expect(rowsOf(page, "40 000")).toHaveCount(0);

  // «Осталось на жизнь» moved by the difference of the daily shares.
  const leftAfter = await dailyLeft(page);
  expect(leftAfter).toBe((leftBefore ?? 0) - dailyShareBefore);

  // The later income was laid out again: its two parts still add up.
  await openIncome(page, "35 000");
  const toEnvelopes = parseRub(
    await page.getByTestId("income-to-envelopes").innerText(),
  );
  const toDaily = parseRub(
    await page.getByTestId("income-to-daily").innerText(),
  );
  expect(toEnvelopes + toDaily).toBe(35000);
});

test("the kind can be changed without touching the numbers", async ({
  page,
}) => {
  await openIncome(page, "5 000");
  const envelopes = await page.getByTestId("income-to-envelopes").innerText();
  await page.getByRole("link", { name: "Изменить" }).click();
  await page.getByRole("button", { name: "Аванс", exact: true }).click();
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page).toHaveURL(/\/income\/[0-9a-f-]{36}\?from=%2Fincome$/);
  await expect(page.getByText("Аванс").first()).toBeVisible();
  await expect(page.getByTestId("income-to-envelopes")).toHaveText(envelopes);
  await page.goto("/income");
  await expect(rowOf(page, "5 000")).toContainText("Аванс");
});

test("the confirmation tells what goes away; «Отмена» changes nothing", async ({
  page,
}) => {
  await openIncome(page, "5 000");
  const envelopes = await totalInEnvelopes(page);
  await openIncome(page, "5 000");
  await page.getByRole("button", { name: "Удалить доход" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("Из конвертов уйдёт " + rub("5 000"));
  await expect(dialog).toContainText("из денег на жизнь " + rub("0"));
  await expect(dialog).toContainText("Следующие раскладки пересчитаются: 1");
  await expect(dialog).toContainText("Траты и переводы останутся");
  await dialog.getByRole("button", { name: "Отмена" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/income\/[0-9a-f-]{36}/);
  expect(await totalInEnvelopes(page)).toBe(envelopes);
  await page.goto("/income");
  await expect(rowOf(page, "5 000")).toBeVisible();
});

test("the first income is deleted; the later one stays", async ({ page }) => {
  await openIncome(page, "5 000");
  await page.getByRole("button", { name: "Удалить доход" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Удалить", exact: true })
    .click();
  // Back to where the income was opened from.
  await expect(page).toHaveURL("/income");
  await expect(rowsOf(page, "5 000")).toHaveCount(0);
  await expect(rowOf(page, "35 000")).toBeVisible();
});

test("the last income is deleted; the balances are as before the scenario", async ({
  page,
}) => {
  await openIncome(page, "35 000");
  await page.getByRole("button", { name: "Удалить доход" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).not.toContainText("Следующие раскладки");
  await dialog.getByRole("button", { name: "Удалить", exact: true }).click();
  await expect(page).toHaveURL("/income");
  await expect(rowsOf(page, "35 000")).toHaveCount(0);

  expect(await totalInEnvelopes(page)).toBe(envelopesBefore);
  expect(await dailyLeft(page)).toBe(dailyBefore);
});
