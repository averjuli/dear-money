// Interactive: asks for a login and password, writes AUTH_USERNAME,
// AUTH_PASSWORD_HASH and AUTH_SECRET into .env. The password itself is never stored.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { hashPassword } from "../src/server/auth/password";

const ENV_FILE = ".env";

let muted = false;
const output = new Writable({
  write(chunk, _encoding, callback) {
    if (!muted) process.stdout.write(chunk);
    callback();
  },
});
const rl = createInterface({ input: process.stdin, output, terminal: true });

function ask(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question);
    muted = hidden;
    rl.question("", (answer) => {
      muted = false;
      if (hidden) process.stdout.write("\n");
      resolve(answer);
    });
  });
}

function upsertEnv(text: string, values: Record<string, string>): string {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text === "" ? [] : text.split(/\r?\n/);
  for (const [key, value] of Object.entries(values)) {
    const index = lines.findIndex((l) => l.startsWith(`${key}=`));
    if (index >= 0) lines[index] = `${key}=${value}`;
    else lines.push(`${key}=${value}`);
  }
  return lines.join(eol).replace(/(\r?\n)*$/, eol);
}

const login = (await ask("Логин: ")).trim();
if (!/^[\w.@-]{3,64}$/.test(login)) {
  console.error("Логин: от 3 до 64 символов, латиница, цифры, . _ - @");
  process.exit(1);
}
const password = await ask("Пароль (не отображается): ", true);
if (password.length < 8) {
  console.error("Пароль должен быть не короче 8 символов");
  process.exit(1);
}
const repeat = await ask("Повторите пароль: ", true);
rl.close();
if (password !== repeat) {
  console.error("Пароли не совпадают");
  process.exit(1);
}

const current = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
const hasSecret = /^AUTH_SECRET=.{32,}$/m.test(current);
const updated = upsertEnv(current, {
  AUTH_USERNAME: login,
  AUTH_PASSWORD_HASH: await hashPassword(password),
  ...(hasSecret ? {} : { AUTH_SECRET: randomBytes(32).toString("hex") }),
});
writeFileSync(ENV_FILE, updated, { mode: 0o600 });
console.log(`Готово: вход для «${login}» записан в ${ENV_FILE}`);
