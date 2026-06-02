import { expect, test } from "@playwright/test";

test.describe("auth pages", () => {
  test("login is simple and client-facing", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: "HyperOptimal" })).toBeVisible();
    await expect(page.getByText("Sign in to your account")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.getByLabel("Keep me logged in")).toBeChecked();
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

  test("opt-in capture page stays focused on one action", async ({ page }) => {
    await page.goto("/opt-in");

    await expect(page.getByRole("heading", { name: /Find the three metrics/i })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send me the checklist" })).toBeVisible();
    await expect(page.getByRole("link")).toHaveCount(0);
  });

  test("invite login keeps the invited account context", async ({ page }) => {
    await page.goto(
      "/login?redirect=%2Fsettings%2Fteam%2Faccept%3Ftoken%3Dtest-token&email=invitee%40example.com",
    );

    await expect(page.getByText("Sign in to your account")).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveValue("invitee@example.com");
    await expect(page.locator('input[name="redirect"]')).toHaveValue(
      "/settings/team/accept?token=test-token",
    );
    await expect(page.getByRole("link", { name: "Sign up" })).toHaveAttribute(
      "href",
      "/signup?redirect=%2Fsettings%2Fteam%2Faccept%3Ftoken%3Dtest-token&email=invitee%40example.com",
    );
  });

  test("invite signup keeps users in the inviter workspace flow", async ({ page }) => {
    await page.goto(
      "/signup?redirect=%2Fsettings%2Fteam%2Faccept%3Ftoken%3Dtest-token&email=invitee%40example.com",
    );

    await expect(page.getByText("Create your account to join the workspace")).toBeVisible();
    await expect(page.getByLabel("Organization Name")).toHaveCount(0);
    await expect(page.locator('input[name="organizationName"]')).toHaveValue("");
    await expect(page.getByLabel("Email")).toHaveValue("invitee@example.com");
    await expect(page.locator('input[name="redirect"]')).toHaveValue(
      "/settings/team/accept?token=test-token",
    );
    await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login?redirect=%2Fsettings%2Fteam%2Faccept%3Ftoken%3Dtest-token&email=invitee%40example.com",
    );
  });

  test("legacy invite acceptance URLs preserve the invite token", async ({ page }) => {
    await page.goto("/invite/accept?token=test-token");

    await expect(page).toHaveURL(/\/settings\/team\/accept\?token=test-token/);
  });

  test("reset password requires a real recovery session", async ({ page }) => {
    await page.goto("/reset-password");

    await expect(page).toHaveURL(/\/reset-password/);
    await expect(
      page.getByText("Use the link from your reset email to set a new password."),
    ).toBeVisible();
  });

  test("auth hash callback safely rejects missing recovery tokens", async ({ page }) => {
    await page.goto("/auth/hash-callback");

    await expect(page).toHaveURL(/\/forgot-password\?error=/);
    await expect(page.getByText("Reset link expired. Request a new one.")).toBeVisible();
  });
});
