import { expect, test } from "@playwright/test";

test.describe("auth pages", () => {
  test("login is simple and client-facing", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: "HyperOptimal" })).toBeVisible();
    await expect(page.getByText("Sign in to your account")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("signup includes the required account fields", async ({ page }) => {
    await page.goto("/signup");

    await expect(page.getByRole("heading", { name: "HyperOptimal" })).toBeVisible();
    await expect(page.getByLabel("Organization Name")).toBeVisible();
    await expect(page.getByLabel("First Name")).toBeVisible();
    await expect(page.getByLabel("Last Name")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('input[name="confirmPassword"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
  });

  test("forgot password is available", async ({ page }) => {
    await page.goto("/forgot-password");

    await expect(page.getByRole("heading", { name: "HyperOptimal" })).toBeVisible();
    await expect(page.getByText("Reset your password", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send reset link" })).toBeVisible();
  });

  test("invite login keeps the invited account context", async ({ page }) => {
    await page.goto(
      "/login?next=%2Fsettings%2Fteam%2Faccept%3Ftoken%3Dtest-token&email=invitee%40example.com",
    );

    await expect(page.getByText("Sign in to your account")).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveValue("invitee@example.com");
    await expect(page.locator('input[name="next"]')).toHaveValue(
      "/settings/team/accept?token=test-token",
    );
    await expect(page.getByRole("link", { name: "Sign up" })).toHaveAttribute(
      "href",
      "/signup?next=%2Fsettings%2Fteam%2Faccept%3Ftoken%3Dtest-token&email=invitee%40example.com",
    );
  });

  test("reset password requires a real recovery session", async ({ page }) => {
    await page.goto("/reset-password");

    await expect(page).toHaveURL(/\/forgot-password\?error=/);
    await expect(page.getByText("Reset link expired. Request a new one.")).toBeVisible();
  });

  test("auth hash callback safely rejects missing recovery tokens", async ({ page }) => {
    await page.goto("/auth/hash-callback");

    await expect(page).toHaveURL(/\/forgot-password\?error=/);
    await expect(page.getByText("Reset link expired. Request a new one.")).toBeVisible();
  });
});
