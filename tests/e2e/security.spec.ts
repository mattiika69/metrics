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

  test("tenant APIs reject anonymous callers before reading private data", async ({ request }) => {
    const [integrations, teamInvitations, emailSend, smsSend] = await Promise.all([
      request.get("/api/integrations"),
      request.post("/api/team/invitations", {
        data: { email: "teammate@example.com", role: "member" },
      }),
      request.post("/api/email/send", {
        data: {
          tenantId: "00000000-0000-0000-0000-000000000000",
          to: "teammate@example.com",
          subject: "Test",
          text: "Test",
        },
      }),
      request.post("/api/sms/send", {
        data: {
          tenantId: "00000000-0000-0000-0000-000000000000",
          phone: "+15555550123",
          message: "Test",
        },
      }),
    ]);

    expect(integrations.status()).toBe(401);
    expect(teamInvitations.status()).toBe(401);
    expect(emailSend.status()).toBe(401);
    expect(smsSend.status()).toBe(401);
  });
});
