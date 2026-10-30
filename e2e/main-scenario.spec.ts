import { expect, test, type Page } from "@playwright/test";
import { E2E_LOGIN, E2E_PASSWORD } from "./env";

// Success criteria from specs/01-продуктовая-идея.md on the demo data.
// Tests run in order and build on each other.

const NBSP = " ";
const rub = (text: string) => `${text.replace(/ /g, NBSP)}${NBSP}₽`;

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Логин").fill(E2E_LOGIN);
  await page.getByLabel("Пароль").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL("/");
}

test.describe.configure({ mode: "serial" });

test("/health answers without login and without data", async ({ request }) => {
  const response = await request.get("/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
});

test("without login any page leads to the login screen", async ({ page }) => {
  await page.goto("/wallets");
  await expect(page).toHaveURL("/login");
});

test("wrong password is rejected", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Логин").fill(E2E_LOGIN);
  await page.getByLabel("Пароль").fill("wrong-password");
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page.getByText("Неверный логин или пароль")).toBeVisible();
  await expect(page).toHaveURL("/login");
});

test("opened: all wallets with sums, total in envelopes and daily", async ({
  page,
}) => {
  await login(page);
  await expect(page.getByTestId("total-in-envelopes")).toHaveText(
    rub("233 950"),
  );
  await expect(
    page.getByText(`Откладывать ${rub("63 750")} в месяц`),
  ).toBeVisible();
  for (const [name, sum] of [
    ["Clothes", "33 700"],
    ["Self-care", "55 200"],
    ["Запасные", "3 600"],
  ]) {
    const row = page.getByRole("link", { name: new RegExp(`^${name}`) });
    await expect(row).toContainText(rub(sum));
  }
  await expect(page.getByText("На жизнь осталось")).toBeVisible();
  await expect(page.getByText("Чужой кошелёк")).toHaveCount(0);
});

test("salary 150 000: preview, surplus to «Косметология», allocate", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("link", { name: /Пришли деньги/ }).click();
  await page.getByLabel("Сколько пришло").fill("150 000");
  await expect(page.getByTestId("to-envelopes")).toHaveText(rub("63 750"));
  await expect(page.getByTestId("to-daily")).toHaveText(rub("86 250"));
  await expect(
    page.getByText(`Излишек ${rub("7 450")} в Self-care`),
  ).toBeVisible();
  await expect(
    page.getByText(/их взносы уйдут в «Косметология»/),
  ).toBeVisible();

  await page.getByRole("button", { name: "Разложить" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByTestId("total-in-envelopes")).toHaveText(
    rub("297 700"),
  );
  await expect(page.getByTestId("daily-remaining")).toHaveText(rub("86 250"));
  await expect(page.getByRole("link", { name: /^Self-care/ })).toContainText(
    rub("67 050"),
  );
});

test("expense 3 900 from «Маникюр»: hint, balance 8 700, daily unchanged", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("link", { name: "Внести трату" }).click();
  await page.getByLabel("Сумма").fill("3 900");
  await page.getByRole("button", { name: "Из конверта" }).click();
  await page.getByRole("button", { name: "Все конверты" }).click();
  await page
    .getByRole("button", { name: "Маникюр", exact: true })
    .first()
    .click();
  await expect(page.getByTestId("expense-hint")).toHaveText(
    `В конверте «Маникюр» станет ${rub("8 700")}, хватит ещё на 2 раза.`,
  );
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByTestId("daily-remaining")).toHaveText(rub("86 250"));

  await page.getByRole("link", { name: /^Self-care/ }).click();
  await page.getByRole("link", { name: /Маникюр/ }).click();
  await expect(page.getByText(`накоплено ${rub("8 700")}`)).toBeVisible();
});

test("daily expense 6 230 in «Транспорт» over the 4 000 limit", async ({
  page,
}) => {
  await login(page);
  await page.goto("/daily");
  await page.getByRole("link", { name: "Внести трату" }).click();
  await page.getByLabel("Сумма").fill("6 230");
  await page.getByRole("button", { name: "Транспорт" }).click();
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page).toHaveURL("/daily");
  await expect(
    page.getByText(`лимит превышен на ${rub("2 230")}`),
  ).toBeVisible();
  await expect(page.getByTestId("daily-left")).toHaveText(rub("80 020"));

  await page.getByRole("link", { name: "Конверты" }).click();
  await expect(
    page.getByText(`Транспорт превышен на ${rub("2 230")}`),
  ).toBeVisible();
});

test("envelope settings: 3 000 once in 2 months → 1 500 a month", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("link", { name: /^Self-care/ }).click();
  await page.getByRole("link", { name: "Добавить конверт" }).click();
  await page.getByLabel("Название").fill("Массаж");
  await page.getByLabel("Сколько стоит один раз").fill("3 000");
  await page.getByLabel("Как часто").fill("2");
  await page.getByRole("button", { name: "месяца" }).click();
  await expect(page.getByTestId("monthly-contribution")).toHaveText(
    rub("1 500"),
  );
  await expect(
    page.getByText(`Считается само: ${rub("3 000")} ÷ 2 месяца`),
  ).toBeVisible();
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByRole("link", { name: /Массаж/ })).toContainText(
    `${rub("1 500")}/мес`,
  );
});

test("drag «Маникюр» from 4th to 1st place", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: /^Self-care/ }).click();
  const handle = page.getByRole("button", { name: "Перетащить «Маникюр»" });
  const target = page.getByRole("button", { name: "Перетащить «Здоровье»" });
  const from = (await handle.boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, to.y + 4, { steps: 12 });
  const saved = page.waitForResponse((r) => r.request().method() === "POST");
  await page.mouse.up();
  await saved;

  await page.reload();
  const names = await page
    .getByRole("button", { name: /^Перетащить/ })
    .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")));
  expect(names.slice(0, 5)).toEqual([
    "Перетащить «Маникюр»",
    "Перетащить «Здоровье»",
    "Перетащить «Косметология»",
    "Перетащить «Стоматолог»",
    "Перетащить «Стрижка»",
  ]);
});
