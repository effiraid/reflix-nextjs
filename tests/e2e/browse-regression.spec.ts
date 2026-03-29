import { expect, test, type Page } from "@playwright/test";

const E2E_AUTH_KEY = "reflix-e2e-auth";

async function seedBrowseSession(
  page: Page,
  override?: { tier: "free" | "pro"; userId: string; email: string }
) {
  await page.addInitScript(
    ([authKey, authOverride]) => {
      window.localStorage.setItem("reflix-visited", "1");

      if (authOverride) {
        window.localStorage.setItem(authKey, JSON.stringify(authOverride));
      } else {
        window.localStorage.removeItem(authKey);
      }
    },
    [E2E_AUTH_KEY, override] as const
  );
}

async function waitForRenderedSearchResults(page: Page) {
  await page.goto("/ko/browse?q=아케인");

  const clipCards = page.locator("[data-clip-id]");
  await expect
    .poll(async () => clipCards.count(), {
      message: "search results should render a visible masonry grid",
    })
    .toBeGreaterThan(5);

  return clipCards;
}

async function readRenderedCardStates(page: Page) {
  return page.locator("[data-clip-id]").evaluateAll((elements) =>
    elements.map((element) => {
      const clipButton = element.querySelector<HTMLElement>('div[role="button"][aria-label]');
      const name = clipButton?.getAttribute("aria-label") ?? "";

      return {
        id: element.getAttribute("data-clip-id") ?? "",
        name,
        locked: Boolean(element.querySelector('[data-testid="clip-lock-overlay"]')),
      };
    })
  );
}

function clipCardLocator(page: Page, clipId: string) {
  return page.locator(`[data-clip-id="${clipId}"] div[role="button"][aria-label]`).first();
}

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

  test("guest search shows full results but every rendered card stays locked behind login", async ({
    page,
  }) => {
    await seedBrowseSession(page);
    const clipCards = await waitForRenderedSearchResults(page);

    await expect(page.getByText("로그인하면 결과를 열 수 있어요")).toBeVisible();
    await expect(clipCards.first()).toBeVisible();

    const cardStates = await readRenderedCardStates(page);
    expect(cardStates.length).toBeGreaterThan(5);
    expect(cardStates.every((card) => card.locked)).toBe(true);

    await clipCardLocator(page, cardStates[0].id).dblclick();
    await expect(page.getByRole("dialog", { name: "로그인" })).toBeVisible();
  });

  test("free search keeps some rendered cards unlocked while locking the rest after the first five", async ({
    page,
  }) => {
    await seedBrowseSession(page, {
      tier: "free",
      userId: "e2e-free-user",
      email: "free@example.com",
    });
    const clipCards = await waitForRenderedSearchResults(page);

    await expect(page.getByText(/결과는 Pro 전용/)).toBeVisible();
    await expect(clipCards.first()).toBeVisible();

    const cardStates = await readRenderedCardStates(page);
    const unlockedCard = cardStates.find((card) => !card.locked);
    const lockedCard = cardStates.find((card) => card.locked);

    expect(unlockedCard).toBeTruthy();
    expect(lockedCard).toBeTruthy();

    await clipCardLocator(page, lockedCard!.id).click();
    await expect(page.getByRole("dialog", { name: "요금제" })).toBeVisible();
  });

  test("pro search unlocks every rendered card", async ({ page }) => {
    await seedBrowseSession(page, {
      tier: "pro",
      userId: "e2e-pro-user",
      email: "pro@example.com",
    });
    const clipCards = await waitForRenderedSearchResults(page);

    await expect(clipCards.first()).toBeVisible();

    const cardStates = await readRenderedCardStates(page);
    expect(cardStates.length).toBeGreaterThan(5);
    expect(cardStates.some((card) => card.locked)).toBe(false);

    await clipCardLocator(page, cardStates[0].id).click();
    await page.waitForTimeout(300);
    await expect(page.getByRole("dialog", { name: "로그인" })).toHaveCount(0);
    await expect(page.getByRole("dialog", { name: "요금제" })).toHaveCount(0);
  });
});
