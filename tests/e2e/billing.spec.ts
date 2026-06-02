import { expect, test } from "@playwright/test";

test.describe("billing", () => {
  test("plans endpoint exposes the default monthly plan", async ({ request }) => {
    const response = await request.get("/api/billing/plans");
    expect(response.status()).toBe(200);

    const payload = await response.json();
    expect(payload.plans[0]).toMatchObject({
      id: "v1",
      name: "HyperOptimal Metrics",
      priceCents: 100,
      currency: "usd",
      interval: "month",
      displayPrice: "$1/mo",
      seatBased: true,
    });
  });

  test("legacy checkout route is protected and preserves the redirect", async ({ request }) => {
    const response = await request.get("/billing/checkout", {
      maxRedirects: 0,
    });

    expect([307, 308]).toContain(response.status());
    expect(response.headers().location).toContain("/login?redirect=%2Fbilling%2Fcheckout");
  });

  test("billing portal action rejects anonymous callers", async ({ request }) => {
    const response = await request.post("/api/billing/portal");

    expect(response.status()).toBe(401);
  });
});
