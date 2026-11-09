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
  // Deletes the anonymous players the run created (tagged e2e by /api/session in test mode).
  globalTeardown: "./tests/e2e/global-teardown.ts",
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
    // Pins the server clock to the browser's mocked clock via a header (lib/api/clock.ts).
    // Rate limiting off: the test suite makes far more requests per minute from localhost than a player.
    env: { ALLOW_TEST_CLOCK: "1", UPSTASH_REDIS_REST_URL: "", UPSTASH_REDIS_REST_TOKEN: "", CHANGEL_NO_ALERT_EMAIL: "1" },
    // Never reuse: a server started without ALLOW_TEST_CLOCK would make date-window tests flaky.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
