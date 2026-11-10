import { MAILPIT_URL } from "./env";

// The mail catcher: every email the app sends lands here. API: <MAILPIT_URL>/api/v1.

export interface CaughtEmail {
  id: string;
  createdAt: string;
  from: { name: string; address: string };
  to: string[];
  subject: string;
  html: string;
  text: string;
  /** The sign-in link from the «Войти» button. */
  link: string;
}

interface Summary {
  ID: string;
  Created: string;
  To: { Address: string }[];
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${MAILPIT_URL}/api/v1${path}`, init);
  } catch {
    throw new Error(
      `Mailpit is not reachable at ${MAILPIT_URL}. Start it: docker compose up -d mailpit`,
    );
  }
  if (!response.ok) throw new Error(`Mailpit ${path}: ${response.status}`);
  // Some calls answer with plain text ("ok"), not JSON.
  const body = await response.text();
  try {
    return JSON.parse(body) as T;
  } catch {
    return body as T;
  }
}

export async function clearMailbox(): Promise<void> {
  await api("/messages", { method: "DELETE" });
}

/** Summaries of the emails to this address, newest first. */
async function summariesTo(address: string): Promise<Summary[]> {
  const found = await api<{ messages: Summary[] }>(
    `/search?query=${encodeURIComponent(`to:${address}`)}&limit=200`,
  );
  return found.messages
    .filter((m) => m.To.some((t) => t.Address.toLowerCase() === address))
    .sort((a, b) => Date.parse(b.Created) - Date.parse(a.Created));
}

export async function countEmailsTo(address: string): Promise<number> {
  return (await summariesTo(address)).length;
}

async function readEmail(id: string): Promise<CaughtEmail> {
  const m = await api<{
    ID: string;
    Created: string;
    From: { Name: string; Address: string };
    To: { Address: string }[];
    Subject: string;
    HTML: string;
    Text: string;
  }>(`/message/${id}`);
  const link = m.Text.match(/https?:\/\/\S+/)?.[0];
  if (!link) throw new Error("No sign-in link in the email text");
  return {
    id: m.ID,
    createdAt: m.Created,
    from: { name: m.From.Name, address: m.From.Address },
    to: m.To.map((t) => t.Address),
    subject: m.Subject,
    html: m.HTML,
    text: m.Text,
    link,
  };
}

/**
 * Waits until at least `count` emails to this address are in the mailbox
 * (default 1) and returns the newest one.
 */
export async function waitForEmail(
  address: string,
  count = 1,
): Promise<CaughtEmail> {
  const deadline = Date.now() + 15_000;
  for (;;) {
    const all = await summariesTo(address);
    if (all.length >= count) return readEmail(all[0].ID);
    if (Date.now() > deadline) {
      throw new Error(
        `No email #${count} to ${address} after 15 s (found ${all.length})`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

/** Every email to this address, oldest first. */
export async function allEmailsTo(address: string): Promise<CaughtEmail[]> {
  const all = await summariesTo(address);
  return Promise.all(all.reverse().map((s) => readEmail(s.ID)));
}

/** How many emails are in the mailbox, to any address. */
export async function countAllEmails(): Promise<number> {
  const list = await api<{ total: number }>("/messages?limit=1");
  return list.total;
}
