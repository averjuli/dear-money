import { expect, test as setup, type Page } from "@playwright/test";
import {
  AB_AUTH_FILE,
  AB_EMAIL,
  DEMO_AUTH_FILE,
  DEMO_COPY_AUTH_FILE,
  DEMO_COPY_EMAIL,
  DEMO_EMAIL,
} from "./env";
import { waitForEmail } from "./mailpit";

// Signs in the users of the scenarios once through the real sign-in (link from
// the mail catcher) and saves it. The scenarios start from the saved sign-in.
async function signIn(page: Page, email: string, file: string) {
  await page.goto("/login");
  await page.getByLabel("Почта").fill(email);
  await page.getByRole("button", { name: "Получить ссылку" }).click();
  await expect(
    page.getByText(`Ссылка для входа отправлена на ${email}`),
  ).toBeVisible();
  await page.goto((await waitForEmail(email)).link);
  await expect(page).toHaveURL("/");
  await page.context().storageState({ path: file });
}

setup("sign in the demo user", async ({ page }) => {
  await signIn(page, DEMO_EMAIL, DEMO_AUTH_FILE);
});

setup("sign in the users of the income scenarios", async ({ browser }) => {
  for (const [email, file] of [
    [AB_EMAIL, AB_AUTH_FILE],
    [DEMO_COPY_EMAIL, DEMO_COPY_AUTH_FILE],
  ]) {
    const context = await browser.newContext({
      baseURL: "http://localhost:3100",
      locale: "ru-RU",
    });
    await signIn(await context.newPage(), email, file);
    await context.close();
  }
});
