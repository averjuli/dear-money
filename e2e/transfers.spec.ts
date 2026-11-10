import { expect, test, type Locator, type Page } from "@playwright/test";
import { E2E_LOGIN, E2E_PASSWORD } from "./env";

// Transfers, back-dated expenses and the «i» note. They run after the main
// scenario on the same database: the income is already allocated, and every
// scenario puts the amounts back before it ends, so the next ones (and the
// computer screens) see the same numbers. Expected values are counted from
// what is on the screen before the action.

const NBSP = " ";

/** Whole rubles as the screen shows them: 112995 → "112 995 ₽", −500 → "−500 ₽". */
function money(rubles: number): string {
  const digits = String(Math.abs(rubles)).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    NBSP,
  );
  return `${rubles < 0 ? "−" : ""}${digits}${NBSP}₽`;
}

/** "−33 300 ₽" → -33300. */
function parseRub(text: string): number {
  return Number(text.replace(/[^\d−-]/g, "").replace("−", "-"));
}

/** The last amount in a block of text. */
function lastMoney(text: string): number {
  const all = text.match(/−?\d[\d\s]*₽/g);
  if (!all) throw new Error(`No amount in: ${text}`);
  return parseRub(all[all.length - 1]);
}

function shiftDay(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Логин").fill(E2E_LOGIN);
  await page.getByLabel("Пароль").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL("/");
}

async function openWallet(page: Page, wallet: string) {
  await page.goto("/");
  await page.getByRole("link", { name: new RegExp(`^${wallet}`) }).click();
}

async function openEnvelope(page: Page, wallet: string, envelope: string) {
  await openWallet(page, wallet);
  await page.getByRole("link", { name: new RegExp(envelope) }).click();
  await expect(page.getByText(/^накоплено [−\d]/)).toBeVisible();
}

async function envelopeBalance(
  page: Page,
  wallet: string,
  envelope: string,
): Promise<number> {
  await openEnvelope(page, wallet, envelope);
  const text = await page.getByText(/^накоплено [−\d]/).innerText();
  return parseRub(text.replace(/^накоплено\s+/, "").split("₽")[0]);
}

async function walletTotal(page: Page, wallet: string): Promise<number> {
  await page.goto("/");
  const row = page.getByRole("link", { name: new RegExp(`^${wallet}`) });
  return lastMoney(await row.innerText());
}

async function totalInEnvelopes(page: Page): Promise<number> {
  await page.goto("/");
  return parseRub(await page.getByTestId("total-in-envelopes").innerText());
}

async function dailyLeft(page: Page): Promise<number> {
  await page.goto("/daily");
  return parseRub(await page.getByTestId("daily-left").innerText());
}

/** «потрачено X из Y ₽» on the card: [X, Y]. */
async function spentOfBudget(page: Page): Promise<[number, number]> {
  const text = await page.getByText(/^потрачено .* из /).innerText();
  const [spent, budget] = text.replace(/^потрачено\s+/, "").split(" из ");
  return [parseRub(spent), parseRub(budget)];
}

/** Chooses one side of a transfer; opens the list if it is closed. */
async function pick(page: Page, which: "Откуда" | "Куда", name: string) {
  const group = page.getByRole("group", { name: which, exact: true });
  const chip = group.getByRole("button", { name, exact: true });
  if (!(await chip.isVisible()))
    await group.getByRole("button").first().click();
  await chip.click();
}

const transferRow = (page: Page, text: string | RegExp): Locator =>
  page.getByTestId("transfers").locator('a[href^="/transfers/"]', {
    hasText: text,
  });

async function deleteOpenTransfer(page: Page, confirmText?: string) {
  await page.getByRole("button", { name: "Удалить перевод" }).click();
  if (confirmText) {
    await expect(page.getByRole("alertdialog")).toContainText(confirmText);
  }
  await page.getByRole("button", { name: "Удалить", exact: true }).click();
}

test.describe.configure({ mode: "serial" });

test("between wallets: made, fixed, moved to another envelope, deleted", async ({
  page,
}) => {
  await login(page);
  const m0 = await envelopeBalance(page, "Self-care", "Маникюр");
  const k0 = await envelopeBalance(page, "Self-care", "Косметология");
  const o0 = await envelopeBalance(page, "Clothes", "Одежда");
  const sc0 = await walletTotal(page, "Self-care");
  const cl0 = await walletTotal(page, "Clothes");
  const total0 = await totalInEnvelopes(page);

  // 42 000 by mistake instead of 4 200, from the wallet screen.
  await openWallet(page, "Self-care");
  await page.getByRole("link", { name: "Перевести" }).click();
  await expect(page).toHaveURL(/\/transfers\/new/);
  await expect(page.getByLabel("Дата")).toHaveValue(
    (await page.getByLabel("Дата").getAttribute("max"))!,
  );
  await page.getByLabel("Сумма").fill("42 000");
  await pick(page, "Откуда", "Маникюр");
  await pick(page, "Куда", "Одежда");
  await expect(page.getByTestId("transfer-hint-from")).toHaveText(
    `В конверте «Маникюр» станет ${money(m0 - 42000)}.`,
  );
  await expect(page.getByTestId("transfer-hint-to")).toContainText(
    `станет ${money(o0 + 42000)}`,
  );
  await page.screenshot({ path: test.info().outputPath("transfer-new.png") });
  await page.getByRole("button", { name: "Перевести" }).click();
  await expect(page).toHaveURL(/\/wallets\//);

  expect(await walletTotal(page, "Self-care")).toBe(sc0 - 42000);
  expect(await walletTotal(page, "Clothes")).toBe(cl0 + 42000);
  expect(await totalInEnvelopes(page)).toBe(total0);

  // Open it from the history of «Маникюр»: fix the amount and the date.
  expect(await envelopeBalance(page, "Self-care", "Маникюр")).toBe(m0 - 42000);
  const row = transferRow(page, "В конверт «Одежда»");
  await expect(row).toContainText(money(-42000));
  await row.click();
  await expect(page).toHaveURL(/\/transfers\/[0-9a-f-]{36}/);
  const today = (await page.getByLabel("Дата").getAttribute("max"))!;
  await page.getByLabel("Сумма").fill("4 200");
  await page.getByLabel("Дата").fill(shiftDay(today, -1));
  // The hint counts as if the old transfer had never been made.
  await expect(page.getByTestId("transfer-hint-from")).toContainText(
    `станет ${money(m0 - 4200)}`,
  );
  await expect(page.getByTestId("transfer-hint-to")).toContainText(
    `станет ${money(o0 + 4200)}`,
  );
  await page.screenshot({ path: test.info().outputPath("transfer-edit.png") });
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page).toHaveURL(/\/envelopes\//);
  await expect(page.getByText(/^накоплено [−\d]/)).toContainText(
    money(m0 - 4200),
  );
  const fixed = transferRow(page, "В конверт «Одежда»");
  await expect(fixed).toContainText("вчера");
  await expect(fixed).toContainText(money(-4200));
  // The other side sees it as «из конверта».
  await openEnvelope(page, "Clothes", "Одежда");
  await expect(transferRow(page, "Из конверта «Маникюр»")).toContainText(
    `+${money(4200)}`,
  );

  // Another receiver: «Одежда» is back, «Косметология» gets the money.
  await openEnvelope(page, "Self-care", "Маникюр");
  await transferRow(page, "В конверт «Одежда»").click();
  await pick(page, "Куда", "Косметология");
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page).toHaveURL(/\/envelopes\//);
  expect(await envelopeBalance(page, "Clothes", "Одежда")).toBe(o0);
  expect(await envelopeBalance(page, "Self-care", "Косметология")).toBe(
    k0 + 4200,
  );
  await expect(transferRow(page, "Из конверта «Маникюр»")).toContainText(
    `+${money(4200)}`,
  );

  // Delete: the confirmation says where the money goes back.
  await openEnvelope(page, "Self-care", "Маникюр");
  await transferRow(page, "В конверт «Косметология»").click();
  await deleteOpenTransfer(page, `${money(4200)} вернутся в конверт «Маникюр»`);
  await expect(page).toHaveURL(/\/envelopes\//);
  await expect(page.getByTestId("transfers")).toHaveCount(0);
  expect(await envelopeBalance(page, "Self-care", "Маникюр")).toBe(m0);
  expect(await envelopeBalance(page, "Self-care", "Косметология")).toBe(k0);
  expect(await walletTotal(page, "Self-care")).toBe(sc0);
  expect(await walletTotal(page, "Clothes")).toBe(cl0);
  expect(await totalInEnvelopes(page)).toBe(total0);
});

test("«на жизнь»: top-up from an envelope, fix, back to an envelope, delete", async ({
  page,
}) => {
  await login(page);
  const m0 = await envelopeBalance(page, "Self-care", "Маникюр");
  const o0 = await envelopeBalance(page, "Clothes", "Одежда");
  const d0 = await dailyLeft(page);
  const [x0, y0] = await spentOfBudget(page);
  const month0 = await page.getByTestId("month-spent").innerText();
  const expenses0 = await page.locator('a[href^="/expenses/"]').count();
  await expect(page.getByTestId("transfers")).toHaveCount(0);

  // «Пополнить» opens the transfer with «На жизнь» already chosen.
  await page.getByRole("link", { name: "Пополнить" }).click();
  await expect(page).toHaveURL(/\/transfers\/new/);
  await expect(
    page
      .getByRole("group", { name: "Куда", exact: true })
      .getByRole("button")
      .first(),
  ).toHaveText("На жизнь");
  await page.getByLabel("Сумма").fill("5 000");
  await pick(page, "Откуда", "Маникюр");
  const today = (await page.getByLabel("Дата").getAttribute("max"))!;
  await page.getByLabel("Дата").fill(shiftDay(today, -1));
  await expect(page.getByTestId("transfer-hint-to")).toHaveText(
    `На жизнь останется ${money(d0 + 5000)}`,
  );
  await page.getByRole("button", { name: "Перевести" }).click();
  await expect(page).toHaveURL("/daily");

  // Back-dated, yet in the current «на жизнь»; it is not an expense.
  await expect(page.getByTestId("daily-left")).toHaveText(money(d0 + 5000));
  expect(await spentOfBudget(page)).toEqual([x0, y0 + 5000]);
  await expect(page.getByTestId("month-spent")).toHaveText(month0);
  expect(await page.locator('a[href^="/expenses/"]').count()).toBe(expenses0);
  const topUp = transferRow(page, "Из конверта «Маникюр»");
  await expect(topUp).toContainText(`+${money(5000)}`);
  await expect(topUp).toContainText("вчера");
  await page.goto("/");
  await expect(page.getByTestId("daily-remaining")).toHaveText(
    money(d0 + 5000),
  );
  expect(await envelopeBalance(page, "Self-care", "Маникюр")).toBe(m0 - 5000);
  await expect(transferRow(page, "На жизнь")).toContainText(money(-5000));

  // Fix the amount: «на жизнь» changes by the difference; the hint says so.
  await page.goto("/daily");
  await topUp.click();
  await page.getByLabel("Сумма").fill("6 000");
  await expect(page.getByTestId("transfer-hint-to")).toHaveText(
    `На жизнь останется ${money(d0 + 6000)}`,
  );
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page).toHaveURL("/daily");
  await expect(page.getByTestId("daily-left")).toHaveText(money(d0 + 6000));

  // Only the date: nothing changes.
  await topUp.click();
  await page.getByLabel("Дата").fill(today);
  await expect(page.getByTestId("transfer-hint-to")).toHaveText(
    `На жизнь останется ${money(d0 + 6000)}`,
  );
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page).toHaveURL("/daily");
  await expect(page.getByTestId("daily-left")).toHaveText(money(d0 + 6000));
  await expect(topUp).toContainText("сегодня");

  // The top-up becomes a transfer between envelopes: «на жизнь» is as before.
  await topUp.click();
  await pick(page, "Куда", "Одежда");
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page).toHaveURL("/daily");
  await expect(page.getByTestId("daily-left")).toHaveText(money(d0));
  await expect(page.getByTestId("transfers")).toHaveCount(0);
  expect(await envelopeBalance(page, "Clothes", "Одежда")).toBe(o0 + 6000);
  await transferRow(page, "Из конверта «Маникюр»").click();
  await deleteOpenTransfer(page);
  await expect(page).toHaveURL(/\/envelopes\//);
  expect(await envelopeBalance(page, "Clothes", "Одежда")).toBe(o0);
  expect(await envelopeBalance(page, "Self-care", "Маникюр")).toBe(m0);

  // From «на жизнь» into an envelope, more than is left: it goes below zero.
  await page.goto("/daily");
  await page.getByRole("link", { name: "Пополнить" }).click();
  await pick(page, "Куда", "Подушка");
  await pick(page, "Откуда", "На жизнь");
  await page.getByLabel("Сумма").fill(String(d0 + 10000));
  await expect(page.getByTestId("transfer-hint-from")).toHaveText(
    `На жизнь останется ${money(-10000)}`,
  );
  await expect(page.getByTestId("transfer-hint-from")).toHaveClass(/text-warn/);
  await page.getByRole("button", { name: "Перевести" }).click();
  await expect(page).toHaveURL("/daily");
  await expect(page.getByTestId("daily-left")).toHaveText(money(-10000));
  expect(await spentOfBudget(page)).toEqual([x0, y0 - d0 - 10000]);
  const out = transferRow(page, "В конверт «Подушка»");
  await expect(out).toContainText(money(-(d0 + 10000)));
  await out.click();
  await deleteOpenTransfer(page, "вернутся на жизнь");
  await expect(page).toHaveURL("/daily");
  await expect(page.getByTestId("daily-left")).toHaveText(money(d0));
  expect(await spentOfBudget(page)).toEqual([x0, y0]);
  await expect(page.getByTestId("month-spent")).toHaveText(month0);
  await expect(page.getByTestId("transfers")).toHaveCount(0);
});

test("a deleted envelope: its transfer stays, can be fixed and deleted", async ({
  page,
}) => {
  await login(page);
  const m0 = await envelopeBalance(page, "Self-care", "Маникюр");

  // «Тест» with 1 100 in Self-care.
  await openWallet(page, "Self-care");
  await page.getByRole("link", { name: "Добавить конверт" }).click();
  await page.getByLabel("Название").fill("Тест");
  await page.getByLabel("Сколько стоит один раз").fill("1 100");
  await page.getByLabel("Как часто").fill("1");
  await page.getByRole("button", { name: "месяца" }).click();
  await page.getByLabel("Начальный остаток").fill("1 100");
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByRole("link", { name: /Тест/ })).toBeVisible();

  // Move all of it to «Маникюр», then delete «Тест».
  await page.getByRole("link", { name: "Перевести" }).click();
  await page.getByLabel("Сумма").fill("1 100");
  await pick(page, "Откуда", "Тест");
  await pick(page, "Куда", "Маникюр");
  await page.getByRole("button", { name: "Перевести" }).click();
  await expect(page).toHaveURL(/\/wallets\//);
  await page.getByRole("link", { name: /Тест/ }).click();
  await page.getByRole("button", { name: "Удалить конверт" }).click();
  await page.getByRole("button", { name: "Удалить", exact: true }).click();
  await expect(page.getByRole("link", { name: /Тест/ })).toHaveCount(0);

  // The money stays where it went.
  expect(await envelopeBalance(page, "Self-care", "Маникюр")).toBe(m0 + 1100);
  const row = transferRow(page, "Из удалённого конверта");
  await expect(row).toContainText(`+${money(1100)}`);

  // Fix: the source stays «Удалённый конверт».
  await row.click();
  await expect(
    page
      .getByRole("group", { name: "Откуда", exact: true })
      .getByRole("button")
      .first(),
  ).toHaveText("Удалённый конверт");
  await page.getByLabel("Сумма").fill("800");
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page).toHaveURL(/\/envelopes\//);
  await expect(page.getByText(/^накоплено [−\d]/)).toContainText(
    money(m0 + 800),
  );
  await expect(transferRow(page, "Из удалённого конверта")).toContainText(
    `+${money(800)}`,
  );

  // Delete: there is nowhere to return the money, the screen says so.
  await transferRow(page, "Из удалённого конверта").click();
  await deleteOpenTransfer(page, `${money(800)} уйдут из конверта «Маникюр»`);
  await expect(page).toHaveURL(/\/envelopes\//);
  expect(await envelopeBalance(page, "Self-care", "Маникюр")).toBe(m0);
  await expect(page.getByTestId("transfers")).toHaveCount(0);
});

test("protection: other people's envelopes, unknown transfers, a date in the future", async ({
  page,
}) => {
  await login(page);
  await page.goto("/transfers/new");
  await page.getByRole("group", { name: "Откуда", exact: true }).waitFor();
  await expect(page.getByText("Чужой кошелёк")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Чужой конверт" })).toHaveCount(
    0,
  );

  const response = await page.goto(
    "/transfers/00000000-0000-4000-8000-000000000000",
  );
  expect(response?.status()).toBe(404);

  await page.goto("/transfers/new");
  const today = (await page.getByLabel("Дата").getAttribute("max"))!;
  await page.getByLabel("Сумма").fill("100");
  await pick(page, "Откуда", "Маникюр");
  await pick(page, "Куда", "Одежда");
  await expect(page.getByRole("button", { name: "Перевести" })).toBeEnabled();
  await page.getByLabel("Дата").fill(shiftDay(today, 1));
  await expect(page.getByRole("button", { name: "Перевести" })).toBeDisabled();
  await page.getByLabel("Дата").fill(today);
  await pick(page, "Куда", "Маникюр");
  await expect(page.getByRole("button", { name: "Перевести" })).toBeDisabled();
});

test("daily expense back-dated: «на жизнь» and «потрачено» change at once", async ({
  page,
}) => {
  await login(page);
  const d0 = await dailyLeft(page);
  const [x0, y0] = await spentOfBudget(page);

  // A day before today is before the allocation of the income.
  await page.getByRole("link", { name: "Внести трату" }).click();
  const today = (await page.getByLabel("Дата").getAttribute("max"))!;
  await page.getByLabel("Сумма").fill("1 000");
  await page.getByRole("button", { name: "Продукты", exact: true }).click();
  await page.getByLabel("Дата").fill(shiftDay(today, -1));
  await expect(page.getByTestId("daily-hint")).toHaveText(
    `На жизнь останется ${money(d0 - 1000)}`,
  );
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page).toHaveURL("/daily");
  await expect(page.getByTestId("daily-left")).toHaveText(money(d0 - 1000));
  expect(await spentOfBudget(page)).toEqual([x0 + 1000, y0]);

  // Fix the amount: the hint counts the difference with the old one.
  const row = page
    .locator('a[href^="/expenses/"]', { hasText: "Продукты" })
    .filter({ hasText: "вчера" });
  await row.click();
  await page.getByLabel("Сумма").fill("1 500");
  await expect(page.getByTestId("daily-hint")).toHaveText(
    `На жизнь останется ${money(d0 - 1500)}`,
  );
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page).toHaveURL("/daily");
  await expect(page.getByTestId("daily-left")).toHaveText(money(d0 - 1500));
  expect(await spentOfBudget(page)).toEqual([x0 + 1500, y0]);

  // Only the date: nothing changes.
  await row.click();
  await page.getByLabel("Дата").fill(today);
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page).toHaveURL("/daily");
  await expect(page.getByTestId("daily-left")).toHaveText(money(d0 - 1500));
  await page.locator('a[href^="/expenses/"]', { hasText: "Продукты" }).click();
  await page.getByLabel("Дата").fill(shiftDay(today, -1));
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page).toHaveURL("/daily");
  await expect(page.getByTestId("daily-left")).toHaveText(money(d0 - 1500));

  // Delete: the money is back.
  await row.click();
  await page.getByRole("button", { name: "Удалить трату" }).click();
  await page.getByRole("button", { name: "Удалить", exact: true }).click();
  await expect(page).toHaveURL("/daily");
  await expect(page.getByTestId("daily-left")).toHaveText(money(d0));
  expect(await spentOfBudget(page)).toEqual([x0, y0]);
});

test("the «i» note on «Осталось на жизнь» opens and closes", async ({
  page,
}) => {
  // The clock is controlled so that the 8 seconds need not be waited for.
  await page.clock.install();
  await login(page);
  await page.goto("/daily");
  const note = page.getByText(/^Это всё, что осталось от зарплаты/);
  const open = page.getByRole("button", { name: "Пояснение" });

  // No paragraph under the card; the note is behind «i».
  await expect(note).toHaveCount(0);
  await open.click();
  await expect(note).toBeVisible();
  await expect(note).toContainText("с пополнениями из конвертов");
  await page.screenshot({ path: test.info().outputPath("info-note.png") });

  // The cross.
  await page.getByRole("button", { name: "Закрыть" }).click();
  await expect(note).toHaveCount(0);

  // A tap anywhere on the screen.
  await open.click();
  await expect(note).toBeVisible();
  await page.getByRole("heading", { name: "Повседневные траты" }).click();
  await expect(note).toHaveCount(0);

  // A tap on the note itself.
  await open.click();
  await note.click();
  await expect(note).toHaveCount(0);

  // Esc.
  await open.click();
  await expect(note).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(note).toHaveCount(0);

  // By itself after 8 seconds, not before.
  await open.click();
  await expect(note).toBeVisible();
  await page.clock.fastForward(5000);
  await expect(note).toBeVisible();
  await page.clock.fastForward(4000);
  await expect(note).toHaveCount(0);
});
