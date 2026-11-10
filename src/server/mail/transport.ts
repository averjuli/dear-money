import nodemailer from "nodemailer";
import { MAIL_FROM, signInEmail } from "./sign-in-email";

function createTransport() {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) throw new Error("SMTP_HOST is not set");
  const port = Number(process.env.SMTP_PORT?.trim() || "587");
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD;
  return nodemailer.createTransport({
    host,
    port,
    // Implicit TLS on 465 (Resend); a plain mail catcher on 1025 needs no auth.
    secure: port === 465,
    auth: user ? { user, pass } : undefined,
  });
}

/** Sends the sign-in email. Where it goes is decided by the SMTP_* settings only. */
export async function sendSignInEmail(to: string, url: string): Promise<void> {
  const mail = signInEmail(url);
  await createTransport().sendMail({
    from: MAIL_FROM,
    to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });
}
