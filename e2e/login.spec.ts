import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import postgres from "postgres";
import { DEMO_EMAIL, E2E_BASE_URL, OTHER_EMAIL, e2eEnv } from "./env";
import {
  allEmailsTo,
  countAllEmails,
  countEmailsTo,
  waitForEmail,
} from "./mailpit";

// Sign-in by a link from an email: specs/auth/spec.md in the change «login».
// Every test starts signed out. Each test uses its own email address, so the
// limit of 3 emails per 10 minutes never gets in the way of another test.

const sql = postgres(e2eEnv.DATABASE_URL, { max: 1, onnotice: () => {} });
test.afterAll(async () => {
  await sql.end();
});

let counter = 0;
const newEmail = (name: string) =>
  `${name}-${Date.now().toString(36)}${counter++}@example.test`;

const sentMessage = (email: string) =>
  `Ссылка для входа отправлена на ${email}`;

/** Types the address and presses «Получить ссылку». */
async function submitEmail(page: Page, email: string) {
  await page.getByLabel("Почта").fill(email);
  await page.getByRole("button", { name: "Получить ссылку" }).click();
}

/** Opens the login page and asks for a link; waits for the confirmation. */
async function requestLink(page: Page, email: string) {
  await page.goto("/login");
  await submitEmail(page, email);
  await expect(page.getByText(sentMessage(email))).toBeVisible();
}

/** Asks for a link, takes it from the mail catcher and opens it: signed in. */
async function signIn(page: Page, email: string) {
  await requestLink(page, email);
  const mail = await waitForEmail(email);
  await page.goto(mail.link);
  await expect(page).toHaveURL("/");
}

async function newDevice(browser: Browser): Promise<[BrowserContext, Page]> {
  const context = await browser.newContext({
    baseURL: E2E_BASE_URL,
    locale: "ru-RU",
    timezoneId: "Europe/Moscow",
  });
  return [context, await context.newPage()];
}

test("without sign-in any page leads to the login page", async ({ page }) => {
  await page.goto("/wallets");
  await expect(page).toHaveURL("/login");
  await expect(page.getByLabel("Почта")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Получить ссылку" }),
  ).toBeVisible();
});

test("sign-in by the link: the user with wallets sees them", async ({
  page,
}) => {
  await signIn(page, OTHER_EMAIL);
  await expect(page.getByText("Чужой кошелёк")).toBeVisible();
});

test("first sign-in is the registration: no form, no question about a name", async ({
  page,
}) => {
  const email = newEmail("first");
  await signIn(page, email);
  await expect(page).toHaveURL("/");
  await expect(page.getByLabel("Имя")).toHaveCount(0);
  await page.goto("/settings");
  await expect(page.getByText(email)).toBeVisible();
});

test("link sent: the page confirms and the email arrives", async ({ page }) => {
  const email = newEmail("anna");
  await requestLink(page, email);
  expect(await countEmailsTo(email)).toBe(1);
});

test("a new and a known address get the same answer", async ({ page }) => {
  const fresh = newEmail("fresh");
  const answer = page.getByText("Ссылка для входа отправлена на");
  await requestLink(page, fresh);
  const answerForNew = await answer.innerText();
  await requestLink(page, DEMO_EMAIL);
  const answerForKnown = await answer.innerText();
  expect(answerForNew.replace(fresh, "<email>")).toBe(
    answerForKnown.replace(DEMO_EMAIL, "<email>"),
  );
});

test("a wrong address in the form: error under the field, no email", async ({
  page,
}) => {
  await page.goto("/login");
  const before = await countAllEmails();
  for (const wrong of ["anna@", "anna example.com"]) {
    await submitEmail(page, wrong);
    await expect(page.getByText("Проверьте адрес почты")).toBeVisible();
    await expect(page).toHaveURL("/login");
  }
  expect(await countAllEmails()).toBe(before);
});

test("a wrong address sent past the form is refused by the server", async ({
  request,
}) => {
  const before = await countAllEmails();
  const response = await request.post("/api/auth/sign-in/magic-link", {
    data: { email: "anna@" },
    headers: { origin: E2E_BASE_URL },
  });
  expect(response.status()).toBe(400);
  expect(await countAllEmails()).toBe(before);
});

test("the same address in another spelling reaches the same data", async ({
  page,
}) => {
  await page.goto("/login");
  await submitEmail(page, ` ${OTHER_EMAIL.toUpperCase()} `);
  await expect(page.getByText(sentMessage(OTHER_EMAIL))).toBeVisible();
  await page.goto((await waitForEmail(OTHER_EMAIL)).link);
  await expect(page).toHaveURL("/");
  await expect(page.getByText("Чужой кошелёк")).toBeVisible();
  const [{ count }] = await sql`select count(*)::int as count from users
    where lower(email) = ${OTHER_EMAIL}`;
  expect(count).toBe(1);
});

test("the email: sender, subject, button, lifetime, ignore note", async ({
  page,
}) => {
  const email = newEmail("content");
  await requestLink(page, email);
  const mail = await waitForEmail(email);
  expect(mail.from).toEqual({
    name: "Dear Money",
    address: "noreply@mail.dearmoney.space",
  });
  expect(mail.subject).toBe("Вход в Dear Money");
  expect(mail.html).toContain("Войти");
  expect(mail.html).toContain("15 минут");
  expect(mail.html).toContain(
    "Если вы не запрашивали вход - просто проигнорируйте письмо",
  );
  expect(mail.link.startsWith(E2E_BASE_URL)).toBe(true);
});

test("a link opened 16 minutes after sending is expired", async ({ page }) => {
  const email = newEmail("late");
  await requestLink(page, email);
  const mail = await waitForEmail(email);
  // Time is moved in the real database: the link's life ended a minute ago.
  await sql`update verifications set expires_at = now() - interval '1 minute'
    where value like ${`%"email":"${email}"%`}`;
  await page.goto(mail.link);
  await expect(page).toHaveURL(/\/login\/expired/);
  await expect(
    page.getByText("Ссылка устарела, запросите новую"),
  ).toBeVisible();
  await page.goto("/");
  await expect(page).toHaveURL("/login");
});

test("a link used once does not work on another device", async ({
  page,
  browser,
}) => {
  const email = newEmail("twice");
  await signIn(page, email);
  const link = (await waitForEmail(email)).link;

  const [context, other] = await newDevice(browser);
  await other.goto(link);
  await expect(other).toHaveURL(/\/login\/expired/);
  await expect(
    other.getByText("Ссылка устарела, запросите новую"),
  ).toBeVisible();
  await other.goto("/");
  await expect(other).toHaveURL("/login");
  await context.close();
});

test("a new link cancels the older one", async ({ page, browser }) => {
  const email = newEmail("newer");
  await requestLink(page, email);
  await submitEmail(page, email);
  await expect.poll(() => countEmailsTo(email)).toBe(2);
  const [older, newer] = (await allEmailsTo(email)).map((m) => m.link);

  const [context, other] = await newDevice(browser);
  await other.goto(older);
  await expect(other).toHaveURL(/\/login\/expired/);
  await other.goto(newer);
  await expect(other).toHaveURL("/");
  await context.close();
});

test("the button on the expired-link screen leads to the login page", async ({
  page,
}) => {
  await page.goto("/login/expired");
  await page.getByRole("link", { name: "Запросить новую ссылку" }).click();
  await expect(page).toHaveURL("/login");
});

test("the fourth request in 10 minutes is refused, no fourth email", async ({
  page,
}) => {
  const email = newEmail("limit");
  await requestLink(page, email);
  for (let i = 0; i < 2; i++) {
    await submitEmail(page, email);
    await expect.poll(() => countEmailsTo(email)).toBe(i + 2);
  }
  await submitEmail(page, email);
  await expect(
    page.getByText("Слишком часто, попробуйте через несколько минут"),
  ).toBeVisible();
  expect(await countEmailsTo(email)).toBe(3);
});

test("after 10 minutes a new request goes through", async ({ page }) => {
  const email = newEmail("later");
  await requestLink(page, email);
  for (let i = 0; i < 2; i++) {
    await submitEmail(page, email);
    await expect.poll(() => countEmailsTo(email)).toBe(i + 2);
  }
  // The three emails were sent 11 minutes ago.
  await sql`update sign_in_links set created_at = created_at - interval '11 minutes'
    where email = ${email}`;
  await submitEmail(page, email);
  await expect.poll(() => countEmailsTo(email)).toBe(4);
});

test("the limit is per address: another address still gets its email", async ({
  page,
}) => {
  const a = newEmail("limit-a");
  const b = newEmail("limit-b");
  await requestLink(page, a);
  for (let i = 0; i < 2; i++) {
    await submitEmail(page, a);
    await expect.poll(() => countEmailsTo(a)).toBe(i + 2);
  }
  await submitEmail(page, a);
  await expect(page.getByText("Слишком часто")).toBeVisible();
  await submitEmail(page, b);
  await expect(page.getByText(sentMessage(b))).toBeVisible();
  expect(await countEmailsTo(b)).toBe(1);
});

test("the settings card shows the email, the install link and «Выйти»", async ({
  page,
}) => {
  const email = newEmail("settings");
  await signIn(page, email);
  await page.goto("/settings");
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByText("Как установить на iPhone")).toBeVisible();
  await expect(page.getByRole("button", { name: "Выйти" })).toBeVisible();
});

test("«Выйти» leads to the login page and closes the app on this device", async ({
  page,
}) => {
  await signIn(page, newEmail("out"));
  await page.goto("/settings");
  await page.getByRole("button", { name: "Выйти" }).click();
  await expect(page).toHaveURL("/login");
  await page.goto("/");
  await expect(page).toHaveURL("/login");
});

test("two devices are signed in at once; signing out on one keeps the other", async ({
  page,
  browser,
}) => {
  const email = newEmail("devices");
  await signIn(page, email); // the phone
  const [context, computer] = await newDevice(browser);
  await computer.goto("/login");
  await submitEmail(computer, email);
  await expect.poll(() => countEmailsTo(email)).toBe(2);
  await computer.goto((await waitForEmail(email, 2)).link);
  await expect(computer).toHaveURL("/");
  await page.goto("/");
  await expect(page).toHaveURL("/");

  await computer.goto("/settings");
  await computer.getByRole("button", { name: "Выйти" }).click();
  await expect(computer).toHaveURL("/login");
  await page.goto("/");
  await expect(page).toHaveURL("/");
  await context.close();
});

test("a visit renews the sign-in for 30 days", async ({ page, context }) => {
  const email = newEmail("renew");
  await signIn(page, email);
  const DAY = 24 * 60 * 60;

  // 20 days passed: the session has 10 days left, and so does the cookie.
  await sql`update sessions set expires_at = now() + interval '10 days'
    where user_id = (select id from users where email = ${email})`;
  const cookie = (await context.cookies()).find((c) =>
    c.name.endsWith("session_token"),
  )!;
  await context.addCookies([
    { ...cookie, expires: Date.now() / 1000 + 10 * DAY },
  ]);

  await page.goto("/");
  await expect(page).toHaveURL("/");

  const [{ left }] =
    await sql`select extract(epoch from expires_at - now())::int as left
    from sessions where user_id = (select id from users where email = ${email})`;
  expect(Math.abs(left - 30 * DAY)).toBeLessThan(120);
  const renewed = (await context.cookies()).find((c) =>
    c.name.endsWith("session_token"),
  )!;
  expect(
    Math.abs(renewed.expires - (Date.now() / 1000 + 30 * DAY)),
  ).toBeLessThan(120);
});

test("30 days without a visit: the login page", async ({ page }) => {
  const email = newEmail("old");
  await signIn(page, email);
  await sql`update sessions set expires_at = now() - interval '1 minute'
    where user_id = (select id from users where email = ${email})`;
  await page.goto("/");
  await expect(page).toHaveURL("/login");
});

// ---------- Own data only ----------
// Two people, A and B, sign in in two browsers and each builds a world with
// the same wallet name. Nothing of one may show up for the other.

interface World {
  email: string;
  walletId: string;
  envelopeId: string;
  /** Text of the envelope link on the wallet screen, e.g. «Маникюр». */
  envelope: string;
  category: string;
  expense: string;
}

/** Wallet «Self-care» with one envelope, a category and a 300/500 expense — through the screens. */
async function buildWorld(
  page: Page,
  input: {
    email: string;
    envelope: string;
    startBalance: string;
    category: string;
    expense: string;
  },
): Promise<World> {
  await signIn(page, input.email);

  await page.goto("/wallets/new");
  await page.getByLabel("Название").fill("Self-care");
  await page.getByRole("button", { name: "Сохранить" }).click();
  await page.getByRole("link", { name: "Добавить конверт" }).click();
  await page.getByLabel("Название").fill(input.envelope);
  await page.getByLabel("Сколько стоит один раз").fill("3 000");
  await page.getByLabel("Начальный остаток").fill(input.startBalance);
  await page.getByRole("button", { name: "Сохранить" }).click();
  const envelopeLink = page.getByRole("link", {
    name: new RegExp(input.envelope),
  });
  await expect(envelopeLink).toBeVisible();
  const envelopeId = (await envelopeLink.getAttribute("href"))!
    .split("/")
    .pop()!;
  const walletId = new URL(page.url()).pathname.split("/").pop()!;

  await page.goto("/daily/categories/new");
  await page.getByLabel("Название").fill(input.category);
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page).toHaveURL("/daily");

  await page.getByRole("link", { name: "Внести трату" }).click();
  await page.getByLabel("Сумма").fill(input.expense);
  await page.getByRole("button", { name: input.category, exact: true }).click();
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page).toHaveURL("/daily");

  return {
    email: input.email,
    walletId,
    envelopeId,
    envelope: input.envelope,
    category: input.category,
    expense: input.expense,
  };
}

const NBSP = " ";
const rub = (text: string) => `${text.replace(/ /g, NBSP)}${NBSP}₽`;

test.describe("two users", () => {
  test.describe.configure({ mode: "serial" });

  let a: World;
  let b: World;
  let pageA: Page;
  let pageB: Page;
  const contexts: BrowserContext[] = [];

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(180_000);
    const [contextA, pa] = await newDevice(browser);
    const [contextB, pb] = await newDevice(browser);
    contexts.push(contextA, contextB);
    pageA = pa;
    pageB = pb;
    a = await buildWorld(pageA, {
      email: newEmail("user-a"),
      envelope: "Маникюр",
      startBalance: "1 000",
      category: "Кафе A",
      expense: "300",
    });
    // A's income of 10 000 goes through the allocation screen.
    await pageA.goto("/income");
    await pageA.getByLabel("Сколько пришло").fill("10 000");
    await pageA.getByRole("button", { name: "Разложить" }).click();
    await expect(pageA).toHaveURL("/");
    b = await buildWorld(pageB, {
      email: newEmail("user-b"),
      envelope: "Стрижка",
      startBalance: "2 000",
      category: "Кафе B",
      expense: "500",
    });
  });

  test.afterAll(async () => {
    for (const context of contexts) await context.close();
  });

  /** What `me` sees must hold none of `other`'s records. */
  async function expectOnlyOwn(page: Page, me: World, other: World) {
    // Main screen: one «Self-care», the own one, with only the own envelope.
    await page.goto("/");
    await expect(page.getByRole("link", { name: /^Self-care/ })).toHaveCount(1);
    await page.getByRole("link", { name: /^Self-care/ }).click();
    await expect(
      page.getByRole("link", { name: new RegExp(me.envelope) }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: new RegExp(other.envelope) }),
    ).toHaveCount(0);

    // Daily: own category and expense only.
    await page.goto("/daily");
    const categories = page.locator('a[href^="/daily/categories/"]');
    await expect(categories.filter({ hasText: me.category })).toHaveCount(1);
    await expect(categories.filter({ hasText: other.category })).toHaveCount(0);
    const expenses = page.locator('a[href^="/expenses/"]');
    await expect(expenses.filter({ hasText: rub(me.expense) })).toHaveCount(1);
    await expect(expenses.filter({ hasText: rub(other.expense) })).toHaveCount(
      0,
    );

    // The expense form offers only own envelopes.
    await page.getByRole("link", { name: "Внести трату" }).click();
    await page.getByRole("button", { name: "Из конверта" }).click();
    await page.getByRole("button", { name: "Все конверты" }).click();
    await expect(
      page.getByRole("button", { name: me.envelope, exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: other.envelope, exact: true }),
    ).toHaveCount(0);
  }

  test("two users do not see each other's records", async () => {
    await expectOnlyOwn(pageB, b, a);
    await expectOnlyOwn(pageA, a, b);
  });

  test("totals count only own records", async () => {
    // B: 2 000 in the only envelope, and no income, so no «На жизнь осталось».
    await pageB.goto("/");
    await expect(pageB.getByTestId("total-in-envelopes")).toHaveText(
      rub("2 000"),
    );
    await expect(pageB.getByTestId("daily-remaining")).toHaveText("—");

    // A: the total is exactly what A's envelope holds, and A has a daily balance.
    await pageA.goto(`/envelopes/${a.envelopeId}`);
    const saved = (
      await pageA
        .getByText(/накоплено/)
        .first()
        .innerText()
    ).match(/накоплено\s+([\d\s]+₽)/)![1];
    await pageA.goto("/");
    await expect(pageA.getByTestId("total-in-envelopes")).toHaveText(saved);
    await expect(pageA.getByTestId("daily-remaining")).not.toHaveText("—");
  });

  test("the same wallet name for both is fine", async () => {
    for (const page of [pageA, pageB]) {
      await page.goto("/wallets");
      await expect(page.getByRole("link", { name: /Self-care/ })).toHaveCount(
        1,
      );
    }
  });

  test("another person's wallet by a direct link: «Кошелёк не найден»", async () => {
    for (const [page, other] of [
      [pageB, a],
      [pageA, b],
    ] as const) {
      for (const path of [
        `/wallets/${other.walletId}`,
        `/wallets/${other.walletId}/edit`,
        `/envelopes/new?wallet=${other.walletId}`,
      ]) {
        await page.goto(path);
        await expect(page.getByText("Кошелёк не найден")).toBeVisible();
        await expect(page.getByText(other.envelope)).toHaveCount(0);
      }
      await page.getByRole("link", { name: "На главную" }).click();
      await expect(page).toHaveURL("/");
    }
  });

  test("another person's envelope by a direct link: «Конверт не найден»", async () => {
    for (const [page, other] of [
      [pageB, a],
      [pageA, b],
    ] as const) {
      await page.goto(`/envelopes/${other.envelopeId}`);
      await expect(page.getByText("Конверт не найден")).toBeVisible();
      await expect(page.getByText(other.envelope)).toHaveCount(0);
      await page.getByRole("link", { name: "На главную" }).click();
      await expect(page).toHaveURL("/");
    }
  });
});

test("a new user: empty main screen with «Создайте первый кошелёк»", async ({
  page,
}) => {
  await signIn(page, newEmail("brand-new"));
  await expect(page.getByRole("link", { name: /^Self-care/ })).toHaveCount(0);
  await expect(page.getByTestId("total-in-envelopes")).toHaveText(rub("0"));
  await page.getByRole("link", { name: "Создайте первый кошелёк" }).click();
  await expect(page).toHaveURL("/wallets/new");
});
