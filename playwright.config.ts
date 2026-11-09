import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.PW_PORT ?? 3100);

const mobile = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
};

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    browserName: "chromium",
    locale: "en-US",
    timezoneId: "Australia/Sydney",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "e2e",
      testIgnore: /visual\.spec\.ts/,
      use: { ...mobile, permissions: ["clipboard-read", "clipboard-write"] },
    },
    {
      name: "visual",
      testMatch: /visual\.spec\.ts/,
    },
  ],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
