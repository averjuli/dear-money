import { devices, expect, test, type Page } from "@playwright/test";
import { DEMO_AUTH_FILE } from "./env";

// The section menu is drawn by the app frame only, never by the screens:
// one menu on every phone screen of a section, none on the other screens.

const menu = (page: Page) => page.getByRole("navigation", { name: "Разделы" });

test("phone: one menu on section screens, none on the others", async ({
  page,
}) => {
  await page.goto("/");
  for (const path of ["/", "/daily", "/income", "/settings"]) {
    await page.goto(path);
    await expect(menu(page)).toHaveCount(1);
  }
  for (const path of ["/wallets", "/expenses/new"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(menu(page)).toHaveCount(0);
  }
});

test("one menu after the browser switches from computer to phone without reload", async ({
  browser,
}) => {
  const context = await browser.newContext({
    ...devices["Desktop Chrome"],
    viewport: { width: 390, height: 844 },
    locale: "ru-RU",
    storageState: DEMO_AUTH_FILE,
  });
  const page = await context.newPage();
  await page.goto("/");

  // Like turning on the phone emulation in Chrome DevTools: the page stays,
  // the next requests come with a phone user agent.
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.setUserAgentOverride", {
    userAgent: devices["iPhone 13"].userAgent,
  });
  await menu(page).getByRole("link", { name: "Траты" }).click();
  await expect(page).toHaveURL("/daily");
  await expect(
    page.getByRole("heading", { name: "Повседневные траты" }),
  ).toBeVisible();
  await expect(menu(page)).toHaveCount(1);

  await context.close();
});
