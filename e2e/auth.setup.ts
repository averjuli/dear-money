import { expect, test as setup } from "@playwright/test";
import { DEMO_AUTH_FILE, DEMO_EMAIL } from "./env";
import { waitForEmail } from "./mailpit";

// Signs in the demo user once through the real sign-in (link from the mail
// catcher) and saves it. The scenarios that use the demo data start from it.
setup("sign in the demo user", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Почта").fill(DEMO_EMAIL);
  await page.getByRole("button", { name: "Получить ссылку" }).click();
  await expect(
    page.getByText(`Ссылка для входа отправлена на ${DEMO_EMAIL}`),
  ).toBeVisible();
  await page.goto((await waitForEmail(DEMO_EMAIL)).link);
  await expect(page).toHaveURL("/");
  await page.context().storageState({ path: DEMO_AUTH_FILE });
});
