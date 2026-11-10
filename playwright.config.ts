import { defineConfig, devices } from "@playwright/test";
import { DEMO_AUTH_FILE, E2E_PORT, e2eEnv } from "./e2e/env";

// Scenarios share one database and run in order, like a person using the app.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    locale: "ru-RU",
    timezoneId: "Europe/Moscow",
    trace: "retain-on-failure",
  },
  projects: [
    // Signs in the demo user once and saves the sign-in for the projects below:
    // a sign-in before every test would hit the limit of 3 emails per 10 minutes.
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    // Sign-in itself: no saved sign-in, every test starts signed out.
    {
      name: "login",
      testMatch: /login\.spec\.ts/,
      use: { ...devices["iPhone 13"], browserName: "chromium" },
    },
    {
      name: "iphone",
      testIgnore: /computer\.spec\.ts|login\.spec\.ts|auth\.setup\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
        storageState: DEMO_AUTH_FILE,
      },
    },
    {
      name: "computer",
      testMatch: /computer\.spec\.ts/,
      dependencies: ["iphone"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
        storageState: DEMO_AUTH_FILE,
      },
    },
  ],
  webServer: {
    command: `pnpm start --port ${E2E_PORT}`,
    url: `http://localhost:${E2E_PORT}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: e2eEnv,
  },
});
