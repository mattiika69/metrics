import { expect, test } from "@playwright/test";

test.describe("production security guardrails", () => {
  test("protected app routes do not render for logged-out users", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText("Sign in to your account")).toBeVisible();
  });

  test("admin pages do not render for logged-out users", async ({ page }) => {
    await page.goto("/admin");

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText("Sign in to your account")).toBeVisible();
  });

  test("admin API rejects anonymous callers", async ({ request }) => {
    const response = await request.get("/api/admin/overview");

    expect(response.status()).toBe(401);
  });
});
