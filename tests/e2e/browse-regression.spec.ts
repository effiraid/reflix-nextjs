import { expect, test } from "@playwright/test";

test.describe("browse regression", () => {
  test("renders the default feed and can switch into a visible masonry grid without console errors", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await page.addInitScript(() => {
      window.localStorage.setItem("reflix-visited", "1");
    });

    await page.goto("/ko/browse");

    const feedViewButtons = page.getByRole("button", { name: "전체 보기 →" });
    await expect
      .poll(async () => feedViewButtons.count(), {
        message: "browse page should default to the feed view",
      })
      .toBeGreaterThan(0);

    await feedViewButtons.first().click();

    const clipCards = page.locator("[data-clip-id]");
    await expect
      .poll(async () => clipCards.count(), {
        message: "browse page should render clip cards after entering masonry view",
      })
      .toBeGreaterThan(0);

    await expect(clipCards.first()).toBeVisible();
    await expect(page.locator('main [data-clip-id] img').first()).toBeVisible();

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
