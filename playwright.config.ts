import { defineConfig, devices } from "@playwright/test";
import { E2E_PORT, e2eEnv } from "./e2e/env";

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
    {
      name: "iphone",
      testIgnore: /desktop\.spec\.ts/,
      use: { ...devices["iPhone 13"], browserName: "chromium" },
    },
    {
      name: "desktop",
      testMatch: /desktop\.spec\.ts/,
      dependencies: ["iphone"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
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
