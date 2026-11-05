import { expect, test, type Page } from "@playwright/test";
import { E2E_LOGIN, E2E_PASSWORD } from "./env";

// Desktop layout from specs/02-экраны-и-дизайн.md, section «Десктоп».
// Runs after the iPhone scenario on the same data: salary 150 000 allocated,
// 3 900 from «Маникюр», 6 230 in «Транспорт», «Массаж» added, «Маникюр» first.

const NBSP = " ";
const rub = (text: string) => `${text.replace(/ /g, NBSP)}${NBSP}₽`;

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Логин").fill(E2E_LOGIN);
  await page.getByLabel("Пароль").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL("/");
}

async function shot(page: Page, name: string) {
  await page.screenshot({
    path: test.info().outputPath(`${name}.png`),
    fullPage: true,
  });
}

test.describe.configure({ mode: "serial" });

test("envelopes: side menu, three cards, wallet cards with main envelopes", async ({
  page,
}) => {
  await login(page);
  const menu = page.getByRole("navigation", { name: "Разделы" });
  await expect(menu.getByRole("link", { name: "Конверты" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await expect(page.getByTestId("total-in-envelopes")).toHaveText(
    rub("257 225"),
  );
  await expect(page.getByTestId("daily-remaining")).toHaveText(rub("112 995"));
  await expect(page.getByText("Откладывать в месяц")).toBeVisible();

  const selfCare = page.getByRole("link", { name: /^Self-care/ });
  await expect(selfCare).toContainText("Маникюр");
  await expect(selfCare).toContainText("Здоровье");
  await expect(selfCare).toContainText("Косметология");
  await expect(selfCare).not.toContainText("Брови");
  await expect(selfCare).toContainText("ещё 7");
  await expect(page.getByRole("link", { name: /^Clothes/ })).not.toContainText(
    "ещё",
  );
  await expect(page.getByText("Запасные")).toHaveCount(0);
  await shot(page, "main");
});

test("wallet: table by priority, settings panel on the right", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("link", { name: /^Self-care/ }).click();
  await expect(page.getByRole("heading", { name: "Self-care" })).toBeVisible();
  await expect(page.getByText("Конверты по приоритету")).toBeVisible();
  // «Маникюр» (first by priority, 8 700 of 12 600) is the only receiver.
  await expect(page.getByText("копится · получит излишек")).toBeVisible();
  await expect(page.getByText("минус · получит излишек")).toHaveCount(0);

  await page.getByRole("link", { name: /Маникюр/ }).click();
  await expect(page).toHaveURL(/\?envelope=/);
  await expect(page.getByText("Конверт · приоритет 1 из 10")).toBeVisible();
  await expect(page.getByLabel("Название")).toHaveValue("Маникюр");
  await expect(
    page.getByRole("button", { name: "Удалить конверт" }),
  ).toBeVisible();
  await shot(page, "wallet");

  await page.getByRole("link", { name: "Закрыть настройку" }).click();
  await expect(page.getByLabel("Название")).toHaveCount(0);

  // A new envelope gets the full width in place of the table.
  await page.getByRole("link", { name: "Добавить конверт" }).click();
  await expect(page.getByLabel("Название")).toBeVisible();
  await expect(page.getByText("Конверты по приоритету")).toHaveCount(0);
  await expect(
    page.getByText(`накоплено ${rub("0")}`, { exact: true }),
  ).toBeVisible();
  await shot(page, "new-envelope");
  await page.getByRole("link", { name: "Закрыть настройку" }).click();
  await expect(page.getByText("Конверты по приоритету")).toBeVisible();
});

test("expenses: form always open, daily hint, stays on the screen after saving", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("link", { name: "Внести трату" }).click();
  await expect(page).toHaveURL("/daily");
  await expect(
    page.getByRole("heading", { name: "Новая трата" }),
  ).toBeVisible();

  await page.getByLabel("Сумма").fill("1 000");
  await page.getByRole("button", { name: "Продукты" }).click();
  await expect(page.getByTestId("daily-hint")).toHaveText(
    `На жизнь останется ${rub("111 995")}`,
  );
  await shot(page, "daily");
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByTestId("daily-left")).toHaveText(rub("111 995"));
  await expect(page).toHaveURL("/daily");
  await expect(page.getByLabel("Сумма")).toHaveValue("");

  // 3 900 from «Маникюр» + 6 230 + 1 000: the month total includes envelope expenses.
  await expect(page.getByTestId("month-spent")).toContainText(rub("11 130"));
  await expect(page.getByText("из «Маникюр»")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "+ Новая категория" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Из конверта" }).click();
  await expect(
    page
      .locator("section", { hasText: "Новая трата" })
      .getByText("Категория", { exact: true }),
  ).toBeVisible();
  await shot(page, "daily-envelope-mode");
});

test("income: form on the left, preview on the right", async ({ page }) => {
  await login(page);
  await page
    .getByRole("navigation", { name: "Разделы" })
    .getByRole("link", { name: "Пришли деньги" })
    .click();
  await page.getByLabel("Сколько пришло").fill("150 000");
  await page.getByLabel("Следующие деньги придут").fill("2099-01-01");
  await expect(page.getByTestId("to-envelopes")).toBeVisible();
  await expect(page.getByTestId("to-daily")).toBeVisible();
  await expect(page.getByText(/в день до 1 января 2099/)).toBeVisible();
  await expect(page.getByText("Взносы по кошелькам")).toBeVisible();
  await shot(page, "income");
});

test("income is short: uncheck a wallet, it gets nothing, the rest is saved", async ({
  page,
}) => {
  // «Массаж» was added on the iPhone run: contributions per income are
  // Clothes 4 800, Self-care 6 675, Miscellaneous 6 550, Long term 5 700,
  // Goals WB 7 800 = 31 525.
  await login(page);
  await page
    .getByRole("navigation", { name: "Разделы" })
    .getByRole("link", { name: "Пришли деньги" })
    .click();
  await page.getByLabel("Сколько пришло").fill("20 000");
  await expect(
    page.getByText(`Не хватает ${rub("11 525")} на все взносы`),
  ).toBeVisible();
  const clothes = page.getByRole("checkbox", { name: /Clothes/ });
  await expect(clothes).toBeChecked();
  await clothes.click();
  await expect(
    page.getByText(`Не хватает ${rub("6 725")} на взносы отмеченных кошельков`),
  ).toBeVisible();
  await expect(page.locator("label", { hasText: "Goals WB" })).toContainText(
    rub("1 075"),
  );
  await expect(page.getByTestId("to-daily")).toHaveText(rub("0"));
  await shot(page, "income-short");

  await page.getByRole("button", { name: "Разложить" }).click();
  await expect(page).toHaveURL("/");
  // After the salary Clothes held 33 700 + 4 800 and got nothing now; Goals WB held 60 900 + 7 800 and gets 1 075 more.
  await expect(page.getByRole("link", { name: /^Clothes/ })).toContainText(
    rub("38 500"),
  );
  await expect(page.getByRole("link", { name: /^Goals WB/ })).toContainText(
    rub("69 775"),
  );
  await expect(page.getByTestId("total-in-envelopes")).toHaveText(
    rub("277 225"),
  );
});

test("income: a wallet with only full envelopes keeps its contributions above the ceiling", async ({
  page,
}) => {
  await login(page);
  await page.goto("/wallets/new");
  await page.getByLabel("Название").fill("Резерв");
  await page.getByRole("button", { name: "Сохранить" }).click();
  await page.getByRole("link", { name: "Добавить конверт" }).click();
  await page.getByLabel("Название").fill("Ремонт");
  await page.getByLabel("Сколько стоит один раз").fill("3 000");
  await page.getByLabel("Начальный остаток").fill("9 000");
  await page.getByRole("button", { name: "Сохранить" }).click();

  await page
    .getByRole("navigation", { name: "Разделы" })
    .getByRole("link", { name: "Пришли деньги" })
    .click();
  await page.getByLabel("Сколько пришло").fill("150 000");
  await expect(
    page.getByText(`Излишек ${rub("1 500")} в Резерв`),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Все конверты кошелька полные, их взносы останутся в них сверх потолка.",
    ),
  ).toBeVisible();
  await expect(page.getByText(/уйдут на повседневные/)).toHaveCount(0);
});

test("narrow window: menu is one row at the bottom", async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 900 });
  await login(page);
  const nav = page.getByRole("navigation", { name: "Разделы" });
  const menu = (await nav.boundingBox())!;
  const title = (await page
    .getByRole("heading", { name: "Конверты" })
    .boundingBox())!;
  expect(menu.width).toBeGreaterThan(550);
  expect(menu.y + menu.height).toBeGreaterThan(899);
  expect(title.y).toBeLessThan(menu.y);
  const tops = await nav
    .getByRole("link")
    .evaluateAll((links) =>
      links
        .filter((l) => (l as HTMLElement).offsetParent !== null)
        .map((l) => Math.round(l.getBoundingClientRect().top)),
    );
  expect(tops).toHaveLength(4);
  expect(new Set(tops).size).toBe(1);
  await shot(page, "narrow");
});

test("side menu: settings screen with install guide and logout", async ({
  page,
}) => {
  await login(page);
  const menu = page.getByRole("navigation", { name: "Разделы" });
  await menu.getByRole("link", { name: "Настройки" }).click();
  await expect(page).toHaveURL("/settings");
  await expect(menu.getByRole("link", { name: "Настройки" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await page.getByRole("link", { name: "Как установить на iPhone" }).click();
  await expect(page).toHaveURL("/install");
  await expect(menu.getByRole("link", { name: "Настройки" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.goBack();

  await page.getByRole("button", { name: "Выйти" }).click();
  await expect(page).toHaveURL("/login");
});
