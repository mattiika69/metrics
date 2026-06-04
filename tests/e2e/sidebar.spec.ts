import { expect, test } from "@playwright/test";

test.describe("app shell sidebar", () => {
  test.skip(
    process.env.PLAYWRIGHT_APP_SHELL !== "1",
    "Set PLAYWRIGHT_APP_SHELL=1 with an authenticated or bypassed app URL to verify the full app shell.",
  );

  test("matches the requested sidebar sizing and accordion behavior", async ({ page }) => {
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
    expect(shell.width).toBe("266px");
    expect(shell.backgroundImage).toContain("linear-gradient");

    const metricsParent = page.locator(".sidebar-parent-trigger", { hasText: "Metrics" });
    const parentStyles = await metricsParent.evaluate((element) => {
      const styles = getComputedStyle(element);
      const label = element.querySelector("span");
      const labelStyles = label ? getComputedStyle(label) : null;
      return {
        color: styles.color,
        height: styles.height,
        borderRadius: styles.borderRadius,
        paddingLeft: styles.paddingLeft,
        paddingRight: styles.paddingRight,
        labelFontSize: labelStyles?.fontSize,
        labelFontWeight: labelStyles?.fontWeight,
        labelLetterSpacing: labelStyles?.letterSpacing,
      };
    });
    expect(parentStyles.color).toBe("rgb(100, 116, 139)");
    expect(parentStyles.height).toBe("48px");
    expect(parentStyles.borderRadius).toBe("10px");
    expect(parentStyles.paddingLeft).toBe("16px");
    expect(parentStyles.paddingRight).toBe("16px");
    expect(parentStyles.labelFontSize).toBe("17px");
    expect(parentStyles.labelFontWeight).toBe("700");
    expect(Number.parseFloat(parentStyles.labelLetterSpacing ?? "0")).toBeCloseTo(0, 1);

    const activeChild = page.locator(".sidebar-sub-link.active", { hasText: "Most Important Metrics" });
    await expect(activeChild).toBeVisible();
    const childStyles = await activeChild.evaluate((element) => {
      const styles = getComputedStyle(element);
      return {
        color: styles.color,
        height: styles.height,
        fontSize: styles.fontSize,
        fontWeight: styles.fontWeight,
        paddingTop: styles.paddingTop,
        paddingRight: styles.paddingRight,
        paddingBottom: styles.paddingBottom,
        paddingLeft: styles.paddingLeft,
        borderRadius: styles.borderRadius,
      };
    });
    expect(childStyles.color).toBe("rgb(219, 234, 254)");
    expect(childStyles.height).toBe("48px");
    expect(childStyles.fontSize).toBe("17px");
    expect(childStyles.fontWeight).toBe("650");
    expect(childStyles.paddingTop).toBe("0px");
    expect(childStyles.paddingRight).toBe("16px");
    expect(childStyles.paddingBottom).toBe("0px");
    expect(childStyles.paddingLeft).toBe("16px");
    expect(childStyles.borderRadius).toBe("10px");

    await page.getByRole("button", { name: "Financials" }).click();
    await expect(page.getByRole("link", { name: "Overview" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Most Important Metrics" })).toBeHidden();
  });
});
