import { test, expect } from "@playwright/test";

// Helper to create a session and get confirmation URL
async function createTestSession(request: any): Promise<{ sessionId: string; url: string }> {
  const response = await request.post("/api/chat/start");
  const data = await response.json();
  return {
    sessionId: data.sessionId,
    url: `/confirmation/${data.sessionId}`,
  };
}

// Helper to wait for typing to complete (no more typing indicators)
async function waitForTypingComplete(page: any, timeout = 30000) {
  // Wait for thinking dots to disappear
  await page.waitForFunction(
    () => !document.querySelector('[class*="animate-bounce"]'),
    { timeout }
  );
  // Small buffer for final render
  await page.waitForTimeout(500);
}

// Helper to get all visible message text
async function getPageMessages(page: any): Promise<string> {
  return await page.locator("body").innerText();
}

// Helper to check if image is visible
async function isImageVisible(page: any, srcPattern: string): Promise<boolean> {
  const img = page.locator(`img[src*="${srcPattern}"]`);
  return await img.isVisible().catch(() => false);
}

// =============================================================================
// HAPPY PATHS
// =============================================================================

test.describe("Happy Paths", () => {
  test("1. Full accept flow (praying for other)", async ({ page, request }) => {
    const { url } = await createTestSession(request);
    await page.goto(url);

    // Wait for transition messages
    await waitForTypingComplete(page);

    // Should see "Yes, please" button
    const yesButton = page.getByRole("button", { name: "Yes, please" });
    await expect(yesButton).toBeVisible();
    await yesButton.click();

    // Wait through all auto-advancing phases until medal offer appears
    const acceptMedalButton = page.getByRole("button", { name: /Send Me the Medal/i });
    await expect(acceptMedalButton).toBeVisible({ timeout: 180000 });
    await acceptMedalButton.click();

    // Wait for acceptance messages
    await waitForTypingComplete(page);

    // Should see shipping form
    const shippingForm = page.locator('input[name="name"], input[placeholder*="name" i]');
    await expect(shippingForm).toBeVisible({ timeout: 10000 });
  });

  test("2. Full accept flow verifies transition messages", async ({ page, request }) => {
    const { url } = await createTestSession(request);
    await page.goto(url);
    await waitForTypingComplete(page);

    // Verify transition messages appear
    const pageText = await getPageMessages(page);
    expect(pageText).toContain("Before you go");
    expect(pageText).toContain("may I show you something");
  });

  test("3. Tell me more -> accept", async ({ page, request }) => {
    const { url } = await createTestSession(request);
    await page.goto(url);
    await waitForTypingComplete(page);

    // Click Yes please
    await page.getByRole("button", { name: "Yes, please" }).click();

    // Wait for medal offer
    const tellMeMore = page.getByRole("button", { name: "Tell me more" });
    await expect(tellMeMore).toBeVisible({ timeout: 180000 });
    await tellMeMore.click();

    // Wait for more info
    await waitForTypingComplete(page, 60000);

    // Should see offer again
    const acceptButton = page.getByRole("button", { name: /Send Me the Medal/i });
    await expect(acceptButton).toBeVisible({ timeout: 30000 });
  });

  test("4. Downsell accept (candle)", async ({ page, request }) => {
    const { url } = await createTestSession(request);
    await page.goto(url);
    await waitForTypingComplete(page);

    // Click Yes please
    await page.getByRole("button", { name: "Yes, please" }).click();

    // Wait for medal offer and decline
    const declineButton = page.getByRole("button", { name: "No thank you" }).first();
    await expect(declineButton).toBeVisible({ timeout: 180000 });
    await declineButton.click();

    // Wait for downsell candle offer
    await waitForTypingComplete(page, 30000);

    // Should see candle offer
    const candleAccept = page.getByRole("button", { name: /Light a Candle/i });
    await expect(candleAccept).toBeVisible({ timeout: 30000 });
    await candleAccept.click();

    // Wait for thank you
    await waitForTypingComplete(page);

    // Verify completion message
    const pageText = await getPageMessages(page);
    expect(pageText.toLowerCase()).toContain("god bless");
  });
});

// =============================================================================
// DECLINE PATHS
// =============================================================================

test.describe("Decline Paths", () => {
  test("5. Early exit", async ({ page, request }) => {
    const { url } = await createTestSession(request);
    await page.goto(url);
    await waitForTypingComplete(page);

    // Click "I need to go"
    const goButton = page.getByRole("button", { name: "I need to go" });
    await expect(goButton).toBeVisible();
    await goButton.click();

    // Wait for graceful close
    await waitForTypingComplete(page);

    // Should see blessing message
    const pageText = await getPageMessages(page);
    expect(pageText.toLowerCase()).toContain("god bless");
  });

  test("6. Decline medal -> decline candle", async ({ page, request }) => {
    const { url } = await createTestSession(request);
    await page.goto(url);
    await waitForTypingComplete(page);

    // Go through flow
    await page.getByRole("button", { name: "Yes, please" }).click();

    // Wait for medal offer and decline
    const declineMedal = page.getByRole("button", { name: "No thank you" }).first();
    await expect(declineMedal).toBeVisible({ timeout: 180000 });
    await declineMedal.click();

    // Wait for candle offer
    await waitForTypingComplete(page, 30000);

    // Decline candle
    const declineCandle = page.getByRole("button", { name: "No thank you" }).first();
    await expect(declineCandle).toBeVisible({ timeout: 30000 });
    await declineCandle.click();

    // Wait for graceful close
    await waitForTypingComplete(page);

    // Should see blessing
    const pageText = await getPageMessages(page);
    expect(pageText.toLowerCase()).toContain("god bless");
  });

  test("7. Tell me more -> decline medal -> accept candle", async ({ page, request }) => {
    const { url } = await createTestSession(request);
    await page.goto(url);
    await waitForTypingComplete(page);

    await page.getByRole("button", { name: "Yes, please" }).click();

    // Tell me more
    const tellMeMore = page.getByRole("button", { name: "Tell me more" });
    await expect(tellMeMore).toBeVisible({ timeout: 180000 });
    await tellMeMore.click();
    await waitForTypingComplete(page, 60000);

    // Decline medal
    const declineMedal = page.getByRole("button", { name: "No thank you" }).first();
    await expect(declineMedal).toBeVisible({ timeout: 30000 });
    await declineMedal.click();
    await waitForTypingComplete(page, 30000);

    // Accept candle
    const acceptCandle = page.getByRole("button", { name: /Light a Candle/i });
    await expect(acceptCandle).toBeVisible({ timeout: 30000 });
    await acceptCandle.click();
    await waitForTypingComplete(page);

    const pageText = await getPageMessages(page);
    expect(pageText.toLowerCase()).toContain("god bless");
  });
});

// =============================================================================
// EDGE CASES
// =============================================================================

test.describe("Edge Cases", () => {
  test("8. No user name - uses 'friend' fallback", async ({ page, request }) => {
    const { url } = await createTestSession(request);
    await page.goto(url);
    await waitForTypingComplete(page);

    // Check for "friend" in messages
    const pageText = await getPageMessages(page);
    expect(pageText.toLowerCase()).toContain("friend");
  });

  test("9. No person name - uses 'loved one' fallback", async ({ page, request }) => {
    const { url } = await createTestSession(request);
    await page.goto(url);
    await waitForTypingComplete(page);

    // Check for "loved one" in messages
    const pageText = await getPageMessages(page);
    expect(pageText.toLowerCase()).toContain("loved one");
  });

  test("10. Session not found - shows error", async ({ page }) => {
    await page.goto("/confirmation/invalid-session-id-12345");

    // Should show error message
    await expect(page.getByText("Unable to load this page")).toBeVisible({ timeout: 10000 });
  });

  test("11. Refresh mid-flow - page reloads", async ({ page, request }) => {
    const { url } = await createTestSession(request);
    await page.goto(url);
    await waitForTypingComplete(page);

    // Click yes to start
    await page.getByRole("button", { name: "Yes, please" }).click();

    // Wait a bit then refresh
    await page.waitForTimeout(3000);
    await page.reload();

    // Page should still load
    await waitForTypingComplete(page, 10000);
    const pageText = await getPageMessages(page);
    expect(pageText.length).toBeGreaterThan(50);
  });
});

// =============================================================================
// IMAGE POSITIONING
// =============================================================================

test.describe("Image Positioning", () => {
  test("12a. Medal front image appears", async ({ page, request }) => {
    const { url } = await createTestSession(request);
    await page.goto(url);
    await waitForTypingComplete(page);

    await page.getByRole("button", { name: "Yes, please" }).click();

    // Look for medal front image
    const medalImage = page.locator('img[src*="medal-front"]');
    await expect(medalImage).toBeVisible({ timeout: 60000 });
  });

  test("12b. Bernadette portrait appears", async ({ page, request }) => {
    const { url } = await createTestSession(request);
    await page.goto(url);
    await waitForTypingComplete(page);

    await page.getByRole("button", { name: "Yes, please" }).click();

    const bernadetteImage = page.locator('img[src*="bernadette"]');
    await expect(bernadetteImage).toBeVisible({ timeout: 90000 });
  });

  test("12c. Medal back appears", async ({ page, request }) => {
    const { url } = await createTestSession(request);
    await page.goto(url);
    await waitForTypingComplete(page);

    await page.getByRole("button", { name: "Yes, please" }).click();

    const medalBackImage = page.locator('img[src*="medal-back"]');
    await expect(medalBackImage).toBeVisible({ timeout: 120000 });
  });

  test("12d. Testimonial image appears", async ({ page, request }) => {
    const { url } = await createTestSession(request);
    await page.goto(url);
    await waitForTypingComplete(page);

    await page.getByRole("button", { name: "Yes, please" }).click();

    const testimonialImage = page.locator('img[src*="testimonial"]');
    await expect(testimonialImage).toBeVisible({ timeout: 150000 });
  });

  test("12e. Certificate image appears", async ({ page, request }) => {
    const { url } = await createTestSession(request);
    await page.goto(url);
    await waitForTypingComplete(page);

    await page.getByRole("button", { name: "Yes, please" }).click();

    const certificateImage = page.locator('img[src*="certificate"]');
    await expect(certificateImage).toBeVisible({ timeout: 180000 });
  });

  test("12f. Candle image appears in downsell", async ({ page, request }) => {
    const { url } = await createTestSession(request);
    await page.goto(url);
    await waitForTypingComplete(page);

    await page.getByRole("button", { name: "Yes, please" }).click();

    // Wait for and decline medal offer
    const declineButton = page.getByRole("button", { name: "No thank you" }).first();
    await expect(declineButton).toBeVisible({ timeout: 180000 });
    await declineButton.click();

    // Wait for candle image
    const candleImage = page.locator('img[src*="candle"]');
    await expect(candleImage).toBeVisible({ timeout: 30000 });
  });
});

// =============================================================================
// UI COMPONENTS
// =============================================================================

test.describe("UI Components", () => {
  test("13. Continue/Go buttons work and disappear", async ({ page, request }) => {
    const { url } = await createTestSession(request);
    await page.goto(url);
    await waitForTypingComplete(page);

    // Both buttons should be visible
    const yesButton = page.getByRole("button", { name: "Yes, please" });
    const goButton = page.getByRole("button", { name: "I need to go" });

    await expect(yesButton).toBeVisible();
    await expect(goButton).toBeVisible();

    // Click yes
    await yesButton.click();

    // Buttons should disappear
    await expect(yesButton).not.toBeVisible({ timeout: 5000 });
    await expect(goButton).not.toBeVisible({ timeout: 5000 });
  });

  test("14. Medal offer card shows $79 and all buttons", async ({ page, request }) => {
    const { url } = await createTestSession(request);
    await page.goto(url);
    await waitForTypingComplete(page);

    await page.getByRole("button", { name: "Yes, please" }).click();

    // Wait for medal offer
    const acceptButton = page.getByRole("button", { name: /Send Me the Medal/i });
    await expect(acceptButton).toBeVisible({ timeout: 180000 });

    // Check for price
    const priceText = page.getByText("$79");
    await expect(priceText).toBeVisible();

    // Check for all three buttons
    await expect(page.getByRole("button", { name: /Send Me the Medal/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "Tell me more" })).toBeVisible();
    await expect(page.getByRole("button", { name: "No thank you" }).first()).toBeVisible();
  });

  test("15. Candle offer card shows $19", async ({ page, request }) => {
    const { url } = await createTestSession(request);
    await page.goto(url);
    await waitForTypingComplete(page);

    await page.getByRole("button", { name: "Yes, please" }).click();

    // Wait for and decline medal
    const declineMedal = page.getByRole("button", { name: "No thank you" }).first();
    await expect(declineMedal).toBeVisible({ timeout: 180000 });
    await declineMedal.click();
    await waitForTypingComplete(page, 30000);

    // Check for candle price
    const priceText = page.getByText("$19");
    await expect(priceText).toBeVisible({ timeout: 30000 });

    // Check for buttons
    await expect(page.getByRole("button", { name: /Light a Candle/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "No thank you" }).first()).toBeVisible();
  });

  test("16. Shipping form appears after accepting medal", async ({ page, request }) => {
    const { url } = await createTestSession(request);
    await page.goto(url);
    await waitForTypingComplete(page);

    await page.getByRole("button", { name: "Yes, please" }).click();

    // Accept medal
    const acceptButton = page.getByRole("button", { name: /Send Me the Medal/i });
    await expect(acceptButton).toBeVisible({ timeout: 180000 });
    await acceptButton.click();
    await waitForTypingComplete(page, 15000);

    // Shipping form should appear - look for any input
    const formInput = page.locator('input').first();
    await expect(formInput).toBeVisible({ timeout: 10000 });
  });
});

// =============================================================================
// TYPING ANIMATION
// =============================================================================

test.describe("Typing Animation", () => {
  test("17. Typing cursor appears during message", async ({ page, request }) => {
    const { url } = await createTestSession(request);
    await page.goto(url);

    // Watch for typing cursor (animated pulse)
    const typingCursor = page.locator('[class*="animate-pulse"]');
    await expect(typingCursor).toBeVisible({ timeout: 5000 });
  });

  test("18. Thinking dots appear", async ({ page, request }) => {
    const { url } = await createTestSession(request);
    await page.goto(url);

    // Look for bouncing dots
    const thinkingDots = page.locator('[class*="animate-bounce"]');
    await expect(thinkingDots.first()).toBeVisible({ timeout: 10000 });
  });

  test("19. Messages appear progressively", async ({ page, request }) => {
    const { url } = await createTestSession(request);
    await page.goto(url);
    await waitForTypingComplete(page);

    // Click yes to start
    await page.getByRole("button", { name: "Yes, please" }).click();

    // Get initial text length
    await page.waitForTimeout(2000);
    const text1 = await getPageMessages(page);

    // Wait and check again - should have more text
    await page.waitForTimeout(5000);
    const text2 = await getPageMessages(page);

    expect(text2.length).toBeGreaterThan(text1.length);
  });
});

// =============================================================================
// MOBILE / RESPONSIVE
// =============================================================================

test.describe("Mobile / Responsive", () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

  test("20. Responsive layout on mobile", async ({ page, request }) => {
    const { url } = await createTestSession(request);
    await page.goto(url);
    await waitForTypingComplete(page);

    // Check that buttons are visible
    const yesButton = page.getByRole("button", { name: "Yes, please" });
    await expect(yesButton).toBeVisible();

    // Check button is within viewport
    const box = await yesButton.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(375);
    }
  });

  test("21. Touch targets are adequate size", async ({ page, request }) => {
    const { url } = await createTestSession(request);
    await page.goto(url);
    await waitForTypingComplete(page);

    // Check button sizes (minimum ~40px for touch)
    const yesButton = page.getByRole("button", { name: "Yes, please" });
    const box = await yesButton.boundingBox();

    expect(box).not.toBeNull();
    if (box) {
      expect(box.height).toBeGreaterThanOrEqual(40);
    }
  });
});

// =============================================================================
// API TESTS
// =============================================================================

test.describe("API Tests", () => {
  test("API: Confirmation endpoint creates upsell session", async ({ request }) => {
    const chatResponse = await request.post("/api/chat/start");
    const chatData = await chatResponse.json();

    const confirmResponse = await request.get(`/api/confirmation/${chatData.sessionId}`);
    expect(confirmResponse.ok()).toBeTruthy();

    const confirmData = await confirmResponse.json();
    expect(confirmData.upsellSessionId).toBeDefined();
    expect(confirmData.messages).toBeDefined();
    expect(confirmData.messages.length).toBeGreaterThan(0);
    expect(confirmData.phase).toBe("transition");
  });

  test("API: Action 'continue' advances to introduction", async ({ request }) => {
    const chatResponse = await request.post("/api/chat/start");
    const chatData = await chatResponse.json();

    const confirmResponse = await request.get(`/api/confirmation/${chatData.sessionId}`);
    const confirmData = await confirmResponse.json();

    const actionResponse = await request.post("/api/upsell/action", {
      data: {
        upsellSessionId: confirmData.upsellSessionId,
        action: "continue",
      },
    });

    expect(actionResponse.ok()).toBeTruthy();
    const actionData = await actionResponse.json();
    expect(actionData.phase).toBe("introduction");
    expect(actionData.messages.length).toBeGreaterThan(0);
  });

  test("API: Advance progresses through phases", async ({ request }) => {
    const chatResponse = await request.post("/api/chat/start");
    const chatData = await chatResponse.json();

    const confirmResponse = await request.get(`/api/confirmation/${chatData.sessionId}`);
    const confirmData = await confirmResponse.json();

    // Continue to introduction
    await request.post("/api/upsell/action", {
      data: {
        upsellSessionId: confirmData.upsellSessionId,
        action: "continue",
      },
    });

    // Advance to show_front
    const advanceResponse = await request.post("/api/upsell/advance", {
      data: { upsellSessionId: confirmData.upsellSessionId },
    });

    expect(advanceResponse.ok()).toBeTruthy();
    const advanceData = await advanceResponse.json();
    expect(advanceData.phase).toBe("show_front");
    expect(advanceData.image).toBe("medal_front");
    expect(advanceData.imageAfterMessage).toBe(1);
  });

  test("API: Full phase progression", async ({ request }) => {
    const chatResponse = await request.post("/api/chat/start");
    const chatData = await chatResponse.json();

    const confirmResponse = await request.get(`/api/confirmation/${chatData.sessionId}`);
    const { upsellSessionId } = await confirmResponse.json();

    // Continue
    await request.post("/api/upsell/action", {
      data: { upsellSessionId, action: "continue" },
    });

    // Track phases
    const phases: string[] = ["introduction"];

    // Advance through all phases
    for (let i = 0; i < 7; i++) {
      const response = await request.post("/api/upsell/advance", {
        data: { upsellSessionId },
      });
      const data = await response.json();
      if (data.phase && data.phase !== phases[phases.length - 1]) {
        phases.push(data.phase);
      }
    }

    // Should have progressed through expected phases
    expect(phases).toContain("show_front");
    expect(phases).toContain("bernadette_story");
    expect(phases).toContain("water_reveal");
  });
});
