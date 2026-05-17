import { defineConfig, devices } from "@playwright/test";

const serverPort = process.env.PLAYWRIGHT_PORT ?? "3100";
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${serverPort}`;
const useWebServer = !process.env.PLAYWRIGHT_BASE_URL;
const webServerCommand = process.env.CI
  ? `npm run build && npm run start -- -p ${serverPort}`
  : `npm run dev -- -p ${serverPort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: useWebServer
    ? {
        command: webServerCommand,
        url: `${baseURL}/login`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          ...process.env,
          DISABLE_LOGIN_AUTH: process.env.DISABLE_LOGIN_AUTH ?? "false",
        },
      }
    : undefined,
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
