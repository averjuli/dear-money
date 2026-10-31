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
    rub("293 800"),
  );
  await expect(page.getByTestId("daily-remaining")).toHaveText(rub("80 020"));
  await expect(page.getByText("Откладывать в месяц")).toBeVisible();

  const selfCare = page.getByRole("link", { name: /^Self-care/ });
  await expect(selfCare).toContainText("Маникюр");
  await expect(selfCare).toContainText("Здоровье");
  await expect(selfCare).toContainText("Косметология");
  await expect(selfCare).not.toContainText("Брови");
  await expect(selfCare).toContainText("ещё 7");
  await expect(page.getByRole("link", { name: /^Запасные/ })).not.toContainText(
    "ещё",
  );
  await shot(page, "main");
});

test("wallet: table by priority, settings panel on the right", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("link", { name: /^Self-care/ }).click();
  await expect(page.getByRole("heading", { name: "Self-care" })).toBeVisible();
  await expect(page.getByText("Конверты по приоритету")).toBeVisible();
  await expect(page.getByText("минус · получит излишек")).toBeVisible();

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
    `На жизнь останется ${rub("79 020")}`,
  );
  await shot(page, "daily");
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByTestId("daily-left")).toHaveText(rub("79 020"));
  await expect(page).toHaveURL("/daily");
  await expect(page.getByLabel("Сумма")).toHaveValue("");
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
