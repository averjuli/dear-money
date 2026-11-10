import { describe, expect, it } from "vitest";
import { MAIL_FROM, signInEmail } from "./sign-in-email";

const URL_ =
  "https://app.dearmoney.space/api/auth/magic-link/verify?token=abc&callbackURL=%2F";

describe("signInEmail", () => {
  const mail = signInEmail(URL_);

  it("is sent from Dear Money at noreply@mail.dearmoney.space", () => {
    expect(MAIL_FROM).toBe('"Dear Money" <noreply@mail.dearmoney.space>');
  });

  it("has the agreed subject", () => {
    expect(mail.subject).toBe("Вход в Dear Money");
  });

  it("html has a «Войти» button with the link, the lifetime and the ignore note", () => {
    expect(mail.html).toContain("Войти");
    expect(mail.html).toContain(
      'href="https://app.dearmoney.space/api/auth/magic-link/verify?token=abc&amp;callbackURL=%2F"',
    );
    expect(mail.html).toContain("15 минут");
    expect(mail.html).toContain(
      "Если вы не запрашивали вход - просто проигнорируйте письмо",
    );
  });

  it("text version has the same link and phrases", () => {
    expect(mail.text).toContain(URL_);
    expect(mail.text).toContain("Войти");
    expect(mail.text).toContain("15 минут");
    expect(mail.text).toContain(
      "Если вы не запрашивали вход - просто проигнорируйте письмо",
    );
  });
});
