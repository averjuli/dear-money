export const MAIL_FROM = '"Dear Money" <noreply@mail.dearmoney.space>';

// Email clients ignore CSS variables: these are the design tokens of
// specs/02-экраны-и-дизайн.md as plain values.
const BG = "#EDF1EE"; // bg
const INK = "#14211B"; // ink
const INK_MUTED = "#55635C"; // ink-muted
const ACCENT = "#1B6B4D"; // accent

const SUBJECT = "Вход в Dear Money";
const LIFETIME = "Ссылка работает 15 минут.";
const IGNORE = "Если вы не запрашивали вход - просто проигнорируйте письмо";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type SignInEmail = { subject: string; html: string; text: string };

/** The sign-in email: a «Войти» button, how long the link lives, and an ignore note. */
export function signInEmail(url: string): SignInEmail {
  const href = escapeHtml(url);
  const html = `<!doctype html>
<html lang="ru">
  <body style="margin:0;padding:24px;background:${BG};font-family:Arial,Helvetica,sans-serif;color:${INK};">
    <div style="max-width:420px;margin:0 auto;">
      <p style="font-size:20px;font-weight:bold;margin:0 0 16px;">dear money</p>
      <p style="font-size:16px;line-height:1.5;margin:0 0 20px;">Нажмите кнопку, чтобы войти в Dear Money.</p>
      <p style="margin:0 0 20px;">
        <a href="${href}" style="display:inline-block;padding:14px 28px;border-radius:16px;background:${ACCENT};color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none;">Войти</a>
      </p>
      <p style="font-size:14px;line-height:1.5;color:${INK_MUTED};margin:0 0 8px;">${LIFETIME}</p>
      <p style="font-size:14px;line-height:1.5;color:${INK_MUTED};margin:0;">${IGNORE}</p>
    </div>
  </body>
</html>`;
  const text = [
    "Нажмите на ссылку, чтобы войти в Dear Money:",
    "",
    `Войти: ${url}`,
    "",
    LIFETIME,
    IGNORE,
    "",
  ].join("\n");
  return { subject: SUBJECT, html, text };
}
