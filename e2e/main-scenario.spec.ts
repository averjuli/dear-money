import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { E2E_LOGIN, E2E_PASSWORD, e2eEnv } from "./env";

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

/** Rows of the «Траты» screen: categories and recent expenses. */
const categoryRow = (page: Page, name: string) =>
  page.locator('a[href^="/daily/categories/"]', { hasText: name });
const expenseRow = (page: Page, text: string | RegExp) =>
  page.locator('a[href^="/expenses/"]', { hasText: text });

async function expectEnvelopeSaved(page: Page, name: string, saved: string) {
  await page.goto("/");
  await page.getByRole("link", { name: /^Self-care/ }).click();
  await page.getByRole("link", { name: new RegExp(name) }).click();
  await expect(page.getByText(`накоплено ${rub(saved)}`)).toBeVisible();
}

async function deleteOpenExpense(page: Page) {
  await page.getByRole("button", { name: "Удалить трату" }).click();
  await page.getByRole("button", { name: "Удалить", exact: true }).click();
  await expect(page).toHaveURL("/daily");
}

/** From «Траты»: «Внести трату», daily or from an envelope, then save. */
async function addExpense(
  page: Page,
  input: { amount: string; envelope?: string; category: string },
) {
  await page.goto("/daily");
  await page.getByRole("link", { name: "Внести трату" }).click();
  await page.getByLabel("Сумма").fill(input.amount);
  if (input.envelope) {
    await page.getByRole("button", { name: "Из конверта" }).click();
    await page.getByRole("button", { name: "Все конверты" }).click();
    await page
      .getByRole("button", { name: input.envelope, exact: true })
      .first()
      .click();
  }
  await page.getByRole("button", { name: input.category, exact: true }).click();
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page).toHaveURL("/daily");
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
  await page.getByRole("link", { name: "Пришли деньги", exact: true }).click();
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

test("expense 3 900 from «Маникюр» needs a category: balance 8 700, daily unchanged", async ({
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

  // No category yet: cannot save. Make «Красота» right in the form.
  await expect(page.getByRole("button", { name: "Сохранить" })).toBeDisabled();
  await page.getByRole("button", { name: "+ Новая категория" }).click();
  await expect(page.getByRole("button", { name: "Добавить" })).toBeDisabled();
  await page.getByLabel("Название").fill("Красота");
  await page.getByRole("button", { name: "Добавить" }).click();
  await expect(
    page.getByRole("button", { name: "Красота", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByTestId("daily-remaining")).toHaveText(rub("86 250"));

  await page.getByRole("link", { name: /^Self-care/ }).click();
  await page.getByRole("link", { name: /Маникюр/ }).click();
  await expect(page.getByText(`накоплено ${rub("8 700")}`)).toBeVisible();
});

test("«Траты» shows the envelope expense: category, month total, envelope mark", async ({
  page,
}) => {
  await login(page);
  await page.goto("/daily");
  await expect(page.getByTestId("daily-left")).toHaveText(rub("86 250"));
  await expect(page.getByTestId("month-spent")).toContainText("Потрачено в");
  await expect(page.getByTestId("month-spent")).toContainText(rub("3 900"));
  await expect(categoryRow(page, "Красота")).toContainText(rub("3 900"));
  const recent = expenseRow(page, "Красота");
  await expect(recent).toContainText("из «Маникюр»");
  await expect(recent).toContainText(rub("3 900"));
  await page.screenshot({ path: test.info().outputPath("spending.png") });

  await categoryRow(page, "Красота").click();
  await expect(page.getByText("Траты · категория")).toBeVisible();
  await expect(page.getByText(/^В [а-я]+е потрачено/)).toContainText(
    rub("3 900"),
  );
  await expect(page.getByText(/из «Маникюр»/)).toBeVisible();
});

test("delete returns the money; a mistaken 39 000 fixed to 3 900 gives 8 700", async ({
  page,
}) => {
  await login(page);
  await page.goto("/daily");
  await expenseRow(page, "Красота").click();
  await expect(page.getByLabel("Сумма")).toHaveValue("3 900");
  await expect(
    page.getByRole("button", { name: "Красота", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await deleteOpenExpense(page);
  await expect(page.getByTestId("month-spent")).toContainText(rub("0"));
  await expect(categoryRow(page, "Красота")).toContainText(rub("0"));
  await expectEnvelopeSaved(page, "Маникюр", "12 600");

  await addExpense(page, {
    amount: "39 000",
    envelope: "Маникюр",
    category: "Красота",
  });
  await expenseRow(page, "Красота").click();
  await page.getByLabel("Сумма").fill("3 900");
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page).toHaveURL("/daily");
  await expectEnvelopeSaved(page, "Маникюр", "8 700");
});

test("daily expense: delete returns it to «Осталось на жизнь»", async ({
  page,
}) => {
  await login(page);
  await addExpense(page, { amount: "1 250", category: "Продукты" });
  await expect(page.getByTestId("daily-left")).toHaveText(rub("85 000"));
  await expenseRow(page, "Продукты").click();
  await deleteOpenExpense(page);
  await expect(page.getByTestId("daily-left")).toHaveText(rub("86 250"));
});

test("new category «Такси» with limit 3 000 made from the expense form", async ({
  page,
}) => {
  await login(page);
  await page.goto("/daily");
  await page.getByRole("link", { name: "Внести трату" }).click();
  await page.getByLabel("Сумма").fill("1 800");
  await page.getByRole("button", { name: "+ Новая категория" }).click();
  await page.getByLabel("Название").fill("Такси");
  await page.getByLabel("Лимит в месяц, необязательно").fill("3 000");
  await page.getByRole("button", { name: "Добавить" }).click();
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page).toHaveURL("/daily");

  const row = categoryRow(page, "Такси");
  await expect(row).toContainText(`1 800 из 3 000${NBSP}₽`);
  await expect(row).toContainText(`осталось ${rub("1 200")}`);

  await expenseRow(page, "Такси").click();
  await deleteOpenExpense(page);
  await expect(page.getByTestId("daily-left")).toHaveText(rub("86 250"));
});

test("limit: 2 900 from «Тройка на год» in «Транспорт» after daily 2 300", async ({
  page,
}) => {
  await login(page);
  await addExpense(page, { amount: "2 300", category: "Транспорт" });
  await expect(categoryRow(page, "Транспорт")).toContainText(
    `осталось ${rub("1 700")}`,
  );
  await addExpense(page, {
    amount: "2 900",
    envelope: "Тройка на год",
    category: "Транспорт",
  });
  await expect(page.getByTestId("daily-left")).toHaveText(rub("83 950"));
  await expect(categoryRow(page, "Транспорт")).toContainText(
    `лимит превышен на ${rub("1 200")}`,
  );

  await page.getByRole("link", { name: "Конверты" }).click();
  await expect(
    page.getByText(`Транспорт превышен на ${rub("1 200")}`),
  ).toBeVisible();

  // Back to the starting point for the next scenarios.
  await page.goto("/daily");
  await expenseRow(page, "из «Тройка на год»").click();
  await deleteOpenExpense(page);
  await expenseRow(page, "Транспорт").click();
  await deleteOpenExpense(page);
  await expect(page.getByTestId("daily-left")).toHaveText(rub("86 250"));
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

test("deleting «Красота» keeps its expenses and the money", async ({
  page,
}) => {
  await login(page);
  await addExpense(page, { amount: "1 500", category: "Красота" });
  await expect(page.getByTestId("daily-left")).toHaveText(rub("78 520"));
  const monthBefore = await page.getByTestId("month-spent").innerText();

  await categoryRow(page, "Красота").click();
  await page.getByRole("button", { name: "Удалить категорию" }).click();
  await expect(
    page.getByText(/останутся в истории\. Деньги не вернутся/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Удалить", exact: true }).click();
  await expect(page).toHaveURL("/daily");

  await expect(categoryRow(page, "Красота")).toHaveCount(0);
  await expect(expenseRow(page, "Красота")).toHaveCount(2);
  await expect(expenseRow(page, "из «Маникюр»")).toContainText("Красота");
  await expect(page.getByTestId("month-spent")).toHaveText(monthBefore);
  await expect(page.getByTestId("daily-left")).toHaveText(rub("78 520"));
  await expectEnvelopeSaved(page, "Маникюр", "8 700");

  // Gone from the form in both modes.
  await page.goto("/expenses/new");
  await expect(
    page.getByRole("button", { name: "Красота", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Из конверта" }).click();
  await expect(
    page.getByRole("button", { name: "Красота", exact: true }),
  ).toHaveCount(0);

  // The expense of a deleted category opens with it selected and saves.
  await page.goto("/daily");
  await expenseRow(page, "1 500").click();
  await expect(
    page.getByRole("button", { name: "Красота", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page).toHaveURL("/daily");
  await expect(expenseRow(page, "Красота")).toHaveCount(2);

  await expenseRow(page, "1 500").click();
  await deleteOpenExpense(page);
  await expect(page.getByTestId("daily-left")).toHaveText(rub("80 020"));
});

test("old envelope expense without a category: nothing selected, can be deleted", async ({
  page,
}) => {
  // Entered before envelope expenses had categories: only possible in the database.
  const sql = postgres(e2eEnv.DATABASE_URL, { max: 1, onnotice: () => {} });
  const [{ id }] = await sql<{ id: string }[]>`
    insert into expenses (user_id, amount, date, envelope_id)
    select u.id, 10000, current_date, e.id
    from users u join envelopes e on e.user_id = u.id
    where u.login = ${E2E_LOGIN} and e.name = 'Маникюр'
    returning id`;
  await sql.end();

  await login(page);
  await page.goto(`/expenses/${id}?from=/daily`);
  await expect(page.getByLabel("Сумма")).toHaveValue("100");
  await expect(
    page.getByRole("button", { name: "Продукты", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: "Сохранить" })).toBeDisabled();
  await deleteOpenExpense(page);
  await expectEnvelopeSaved(page, "Маникюр", "8 700");
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

test("settings: gear on the main screen, install guide and logout", async ({
  page,
}) => {
  await login(page);
  await page.screenshot({ path: test.info().outputPath("main.png") });
  await page.getByRole("link", { name: "Настройки" }).click();
  await expect(page).toHaveURL("/settings");
  await expect(
    page.getByRole("link", { name: "Как установить на iPhone" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Выйти" }).click();
  await expect(page).toHaveURL("/login");
});
