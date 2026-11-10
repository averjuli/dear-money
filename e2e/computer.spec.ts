import {
  chromium,
  expect,
  test,
  type Locator,
  type Page,
} from "@playwright/test";
import { E2E_LOGIN, E2E_PASSWORD, E2E_PORT } from "./env";

// Layout by window width: openspec/specs/screen-layout (change width-based-layout).
// Runs on a computer after the iPhone scenario on the same data: salary 150 000
// allocated, 3 900 from «Маникюр», 6 230 in «Транспорт», «Массаж» added.

const NBSP = " ";
const rub = (text: string) => `${text.replace(/ /g, NBSP)}${NBSP}₽`;

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Логин").fill(E2E_LOGIN);
  await page.getByLabel("Пароль").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL("/");
}

const menu = (page: Page) => page.getByRole("navigation", { name: "Разделы" });
const plus = (page: Page) => page.getByRole("link", { name: "Внести трату" });
/** The big green «Всего в конвертах» block of the main screen. */
const totalBlock = (page: Page) =>
  page.locator("section", { has: page.getByTestId("total-in-envelopes") });

async function box(locator: Locator) {
  const found = await locator.boundingBox();
  expect(found).not.toBeNull();
  return found!;
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

/** All four menu items on one row (same top). */
async function expectMenuInOneRow(page: Page) {
  const tops = await menu(page)
    .getByRole("link")
    .evaluateAll((links) =>
      links.map((l) => Math.round(l.getBoundingClientRect().top)),
    );
  expect(tops).toHaveLength(4);
  expect(new Set(tops).size).toBe(1);
}

/**
 * Where the blocks stand: the content is up to 1180 px wide, side paddings
 * 20 px (32 px from 600 px). The room for a scrollbar is always reserved, so
 * on a computer the area is the window width minus the scrollbar.
 */
async function area(page: Page) {
  const { inner, client } = await page.evaluate(() => ({
    inner: window.innerWidth,
    client: document.body.getBoundingClientRect().width,
  }));
  const padding = inner >= 600 ? 32 : 20;
  const content = Math.min(1180, client - 2 * padding);
  return { content, left: (client - content) / 2 };
}

test.describe.configure({ mode: "serial" });

test("1440 px: blocks 1180 px in the center, one menu with «+» on the right", async ({
  page,
}) => {
  await login(page);
  await expect(menu(page)).toHaveCount(1);
  await expect(
    menu(page).getByRole("link", { name: "Конверты" }),
  ).toHaveAttribute("aria-current", "page");

  const total = await box(totalBlock(page));
  expect(total.width).toBeCloseTo((await area(page)).content, 0);
  expect(total.x).toBeCloseTo((await area(page)).left, 0);
  await expect(page.getByTestId("total-in-envelopes")).toHaveText(
    rub("257 225"),
  );
  await expect(page.getByText("Пришли деньги?")).toBeVisible();
  await expect(page.getByText("На жизнь осталось")).toBeVisible();

  // Menu at the bottom, «+» on the right of it, the same height.
  const nav = await box(menu(page));
  const fab = await box(plus(page));
  expect(nav.y).toBeGreaterThan(total.y + total.height);
  expect(fab.x).toBeGreaterThan(nav.x + nav.width - 1);
  expect(fab.height).toBeCloseTo(nav.height, 0);
  expect(fab.y).toBeCloseTo(nav.y, 0);
  expect(fab.x + fab.width - nav.x).toBeCloseTo((await area(page)).content, 0);
  expect(nav.x).toBeCloseTo((await area(page)).left, 0);
  await expectMenuInOneRow(page);

  // «Пришли деньги» is one line, like «Траты».
  const incomeLabel = await box(
    menu(page).getByText("Пришли деньги", { exact: true }),
  );
  const dailyLabel = await box(menu(page).getByText("Траты", { exact: true }));
  expect(incomeLabel.height).toBeCloseTo(dailyLabel.height, 0);

  await plus(page).click();
  await expect(page).toHaveURL(/\/expenses\/new/);
  await expect(
    page.getByRole("heading", { name: "Новая трата" }),
  ).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test("1440 px: «Пришли деньги» and «Настройки» have «+» beside the menu, together 1180 px", async ({
  page,
}) => {
  await login(page);
  for (const [name, path] of [
    ["Пришли деньги", "/income"],
    ["Настройки", "/settings"],
  ]) {
    await menu(page).getByRole("link", { name }).click();
    await expect(page).toHaveURL(path);
    await expect(menu(page)).toHaveCount(1);
    const nav = await box(menu(page));
    const fab = await box(plus(page));
    expect(nav.x).toBeCloseTo((await area(page)).left, 0);
    expect(fab.x).toBeGreaterThan(nav.x + nav.width - 1);
    expect(fab.height).toBeCloseTo(nav.height, 0);
    expect(fab.x + fab.width - nav.x).toBeCloseTo(
      (await area(page)).content,
      0,
    );
    await expectMenuInOneRow(page);
    const incomeLabel = await box(
      menu(page).getByText("Пришли деньги", { exact: true }),
    );
    const dailyLabel = await box(
      menu(page).getByText("Траты", { exact: true }),
    );
    expect(incomeLabel.height).toBeCloseTo(dailyLabel.height, 0);
    await expectNoHorizontalScroll(page);
  }

  // «+» opens the new expense; closing it returns to the screen it came from.
  await plus(page).click();
  await expect(page).toHaveURL(/\/expenses\/new\?from=%2Fsettings/);
  await page.getByRole("link", { name: "Закрыть" }).click();
  await expect(page).toHaveURL("/settings");
});

test("menu stands at the same height on every section screen", async ({
  page,
}) => {
  await login(page);
  for (const [width, height] of [
    [1440, 1000],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    for (const path of ["/", "/daily", "/income", "/settings"]) {
      await page.goto(path);
      await expect(menu(page)).toHaveCount(1);
      const nav = await box(menu(page));
      // 12 px from the bottom edge of the window, short screen or scrolling one.
      expect(height - (nav.y + nav.height), `${width} px ${path}`).toBeCloseTo(
        12,
        0,
      );
    }
  }
});

test("menu does not shift between screens when a scrollbar appears", async () => {
  // Headless Chrome hides scrollbars; a real one takes room on long screens.
  const browser = await chromium.launch({
    ignoreDefaultArgs: ["--hide-scrollbars"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 700 },
    locale: "ru-RU",
  });
  await page.goto(`http://localhost:${E2E_PORT}/login`);
  await page.getByLabel("Логин").fill(E2E_LOGIN);
  await page.getByLabel("Пароль").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL("/");

  const seen: Record<string, string> = {};
  for (const path of ["/", "/daily", "/income", "/settings"]) {
    await page.goto(path);
    const nav = await box(menu(page));
    const scrollbar = await page.evaluate(
      () => window.innerWidth - document.documentElement.clientWidth,
    );
    seen[path] =
      `x=${Math.round(nav.x)} width=${Math.round(nav.width)} scrollbar=${scrollbar}`;
  }
  await browser.close();
  const positions = Object.values(seen).map((v) =>
    v.replace(/ scrollbar=\d+/, ""),
  );
  expect(new Set(positions).size, JSON.stringify(seen)).toBe(1);
});

test("800 px: blocks 736 px, «+» on the right of the menu", async ({
  page,
}) => {
  await page.setViewportSize({ width: 800, height: 900 });
  await login(page);
  const total = await box(totalBlock(page));
  expect(total.width).toBeCloseTo((await area(page)).content, 0);
  expect(total.x).toBeCloseTo((await area(page)).left, 0);

  const nav = await box(menu(page));
  const fab = await box(plus(page));
  expect(nav.y).toBeGreaterThan(total.y + total.height);
  expect(fab.x).toBeGreaterThan(nav.x + nav.width - 1);
  expect(fab.height).toBeCloseTo(nav.height, 0);
  expect(fab.x + fab.width - nav.x).toBeCloseTo((await area(page)).content, 0);
  await expectMenuInOneRow(page);
  await expectNoHorizontalScroll(page);
});

test("390 px on a computer: like a phone, «+» above the menu", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await expect(menu(page)).toHaveCount(1);
  const total = await box(totalBlock(page));
  expect(total.width).toBeCloseTo((await area(page)).content, 0);
  expect(total.x).toBeCloseTo((await area(page)).left, 0);

  const nav = await box(menu(page));
  const fab = await box(plus(page));
  expect(nav.width).toBeCloseTo((await area(page)).content, 0);
  expect(nav.x).toBeCloseTo((await area(page)).left, 0);
  expect(fab.y + fab.height).toBeLessThanOrEqual(nav.y);
  expect(fab.x + fab.width).toBeCloseTo(nav.x + nav.width, 0);
  await expectMenuInOneRow(page);
  await expectNoHorizontalScroll(page);

  // «Пришли деньги» takes two lines in the narrow menu.
  const incomeLabel = await box(
    menu(page).getByText("Пришли деньги", { exact: true }),
  );
  const dailyLabel = await box(menu(page).getByText("Траты", { exact: true }));
  expect(incomeLabel.height).toBeGreaterThan(dailyLabel.height * 1.5);
});

test("599 px: «+» above the menu, 600 px: «+» on the right", async ({
  page,
}) => {
  await page.setViewportSize({ width: 599, height: 900 });
  await login(page);
  let nav = await box(menu(page));
  let fab = await box(plus(page));
  expect(fab.y + fab.height).toBeLessThanOrEqual(nav.y);

  await page.setViewportSize({ width: 600, height: 900 });
  nav = await box(menu(page));
  fab = await box(plus(page));
  expect(fab.x).toBeGreaterThan(nav.x + nav.width - 1);
  expect(fab.x + fab.width - nav.x).toBeCloseTo((await area(page)).content, 0);
});

test("340 px: menu has icons only, links keep their names; 360 px: labels", async ({
  page,
}) => {
  await page.setViewportSize({ width: 340, height: 740 });
  await login(page);
  for (const name of ["Конверты", "Траты", "Пришли деньги", "Настройки"]) {
    await expect(menu(page).getByRole("link", { name })).toHaveCount(1);
    // Hidden visually: the label takes no room.
    const label = await box(menu(page).getByText(name, { exact: true }));
    expect(label.width).toBeLessThanOrEqual(1);
    expect(label.height).toBeLessThanOrEqual(1);
  }
  const fab = await box(plus(page));
  const nav = await box(menu(page));
  expect(fab.y + fab.height).toBeLessThanOrEqual(nav.y);
  await expectNoHorizontalScroll(page);

  await page.setViewportSize({ width: 360, height: 740 });
  for (const name of ["Конверты", "Траты", "Настройки"]) {
    const label = await box(menu(page).getByText(name, { exact: true }));
    expect(label.width).toBeGreaterThan(20);
    expect(label.height).toBeGreaterThan(10);
  }
});

test("1440 px: wallet has no menu, back arrow, envelopes by priority", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("link", { name: /^Self-care/ }).click();
  await expect(page.getByRole("heading", { name: "Self-care" })).toBeVisible();
  await expect(menu(page)).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Назад к конвертам" }),
  ).toBeVisible();
  await expect(page.getByText("Конверты по приоритету")).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test("1440 px: the expense form is stretched like the other blocks", async ({
  page,
}) => {
  await login(page);
  await page.goto("/expenses/new");
  await expect(
    page.getByRole("heading", { name: "Новая трата" }),
  ).toBeVisible();
  await expect(menu(page)).toHaveCount(0);
  const save = await box(page.getByRole("button", { name: "Сохранить" }));
  expect(save.width).toBeCloseTo((await area(page)).content, 0);
  expect(save.x).toBeCloseTo((await area(page)).left, 0);
  await expectNoHorizontalScroll(page);
});

test("1440 px: the transfer screen and the «i» note", async ({ page }) => {
  await login(page);
  await page.goto("/transfers/new");
  await expect(page.getByRole("heading", { name: "Перевод" })).toBeVisible();
  await expect(menu(page)).toHaveCount(0);
  const send = page.getByRole("button", { name: "Перевести" });
  const wide = await box(send);
  expect(wide.width).toBeCloseTo((await area(page)).content, 0);
  expect(wide.x).toBeCloseTo((await area(page)).left, 0);
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: test.info().outputPath("transfer-1440.png") });

  // The note opens under the «i» inside the screen and closes by a tap outside.
  await page.goto("/daily");
  await page.getByRole("button", { name: "Пояснение" }).click();
  const note = page.getByText(/^Это всё, что осталось от зарплаты/);
  await expect(note).toBeVisible();
  const noteBox = await box(note);
  const inner = await page.evaluate(() => window.innerWidth);
  expect(noteBox.x).toBeGreaterThanOrEqual(0);
  expect(noteBox.x + noteBox.width).toBeLessThanOrEqual(inner);
  await page.screenshot({ path: test.info().outputPath("info-note-1440.png") });
  await page.getByRole("heading", { name: "Повседневные траты" }).click();
  await expect(note).toHaveCount(0);
});

// Scenarios that do not depend on the layout, on the phone screens.

test("expense 1 000 in «Продукты»: daily hint, saved, daily balance drops", async ({
  page,
}) => {
  await login(page);
  await menu(page).getByRole("link", { name: "Траты" }).click();
  // «+» opens the form from the active section: wait until «Траты» is active.
  await expect(page).toHaveURL("/daily");
  await plus(page).click();
  await expect(page).toHaveURL(/\/expenses\/new/);

  await page.getByLabel("Сумма").fill("1 000");
  await page.getByRole("button", { name: "Продукты", exact: true }).click();
  await expect(page.getByTestId("daily-hint")).toHaveText(
    `На жизнь останется ${rub("111 995")}`,
  );
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page).toHaveURL("/daily");
  await expect(page.getByTestId("daily-left")).toHaveText(rub("111 995"));
  // 3 900 from «Маникюр» + 6 230 + 1 000: the month total includes envelope expenses.
  await expect(page.getByTestId("month-spent")).toContainText(rub("11 130"));
});

test("income is short: uncheck a wallet, it gets nothing, the rest is saved", async ({
  page,
}) => {
  // «Массаж» was added on the iPhone run: contributions per income are
  // Clothes 4 800, Self-care 6 675, Miscellaneous 6 550, Long term 5 700,
  // Goals WB 7 800 = 31 525.
  await login(page);
  await menu(page).getByRole("link", { name: "Пришли деньги" }).click();
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
  // Wait until the envelope is saved and shown in the wallet.
  await expect(page.getByRole("link", { name: /Ремонт/ })).toBeVisible();

  await page.goto("/income");
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

test("settings through the menu: install guide and logout", async ({
  page,
}) => {
  await login(page);
  await menu(page).getByRole("link", { name: "Настройки" }).click();
  await expect(page).toHaveURL("/settings");
  await expect(
    menu(page).getByRole("link", { name: "Настройки" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("link", { name: "Как установить на iPhone" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Выйти" }).click();
  await expect(page).toHaveURL("/login");
});
