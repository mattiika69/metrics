import { expect, test } from "@playwright/test";

test.describe("app shell sidebar", () => {
  test.skip(
    process.env.PLAYWRIGHT_APP_SHELL !== "1",
    "Set PLAYWRIGHT_APP_SHELL=1 with an authenticated or bypassed app URL to verify the full app shell.",
  );

  test("matches the Scaling Metrics sidebar sizing and accordion behavior", async ({ page }) => {
    await page.goto("/metrics/most-important");

    const nav = page.locator(".side-nav");
    await expect(nav).toBeVisible();

    const shell = await nav.evaluate((element) => {
      const styles = getComputedStyle(element);
      return {
        width: styles.width,
        backgroundImage: styles.backgroundImage,
      };
    });
    expect(shell.width).toBe("220px");
    expect(shell.backgroundImage).toContain("linear-gradient");

    const metricsParent = page.locator(".sidebar-parent-link", { hasText: "Metrics" });
    const parentStyles = await metricsParent.evaluate((element) => {
      const styles = getComputedStyle(element);
      return {
        color: styles.color,
        fontSize: styles.fontSize,
        fontWeight: styles.fontWeight,
        letterSpacing: styles.letterSpacing,
        paddingTop: styles.paddingTop,
        paddingBottom: styles.paddingBottom,
      };
    });
    expect(parentStyles.color).toBe("rgb(100, 116, 139)");
    expect(parentStyles.fontSize).toBe("9.7px");
    expect(parentStyles.fontWeight).toBe("500");
    expect(parentStyles.paddingTop).toBe("2px");
    expect(parentStyles.paddingBottom).toBe("2px");
    expect(Number.parseFloat(parentStyles.letterSpacing)).toBeCloseTo(0.56, 1);

    const activeChild = page.locator(".sidebar-sub-link.active", { hasText: "Most Important Metrics" });
    await expect(activeChild).toBeVisible();
    const childStyles = await activeChild.evaluate((element) => {
      const styles = getComputedStyle(element);
      return {
        color: styles.color,
        fontSize: styles.fontSize,
        fontWeight: styles.fontWeight,
        lineHeight: styles.lineHeight,
        paddingTop: styles.paddingTop,
        paddingRight: styles.paddingRight,
        paddingBottom: styles.paddingBottom,
        paddingLeft: styles.paddingLeft,
      };
    });
    expect(childStyles.color).toBe("rgb(219, 234, 254)");
    expect(childStyles.fontSize).toBe("12px");
    expect(childStyles.fontWeight).toBe("400");
    expect(childStyles.lineHeight).toBe("16px");
    expect(childStyles.paddingTop).toBe("4px");
    expect(childStyles.paddingRight).toBe("8px");
    expect(childStyles.paddingBottom).toBe("4px");
    expect(childStyles.paddingLeft).toBe("8px");

    await page.getByRole("button", { name: "Financials" }).click();
    await expect(page.getByRole("link", { name: "Overview" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Most Important Metrics" })).toBeHidden();
  });
});
