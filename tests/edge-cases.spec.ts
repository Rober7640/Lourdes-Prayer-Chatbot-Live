import { test, expect, Page } from '@playwright/test';

// Helper to wait for AI response by watching for typing to finish
async function waitForResponse(page: Page, timeout = 45000): Promise<void> {
  // Wait for typing indicator to appear
  try {
    await page.waitForSelector('[class*="animate-bounce"]', { timeout: 5000 });
  } catch {
    // Typing indicator might have already finished
  }

  // Wait for typing indicator to disappear (response complete)
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const isTyping = await page.locator('[class*="animate-bounce"]').count();
    if (isTyping === 0) {
      await page.waitForTimeout(500); // Small buffer after typing ends
      return;
    }
    await page.waitForTimeout(300);
  }
}

// Helper to get all Sister Marie messages from the page
async function getAllMessages(page: Page): Promise<string[]> {
  // Get all text bubbles - they're spans inside rounded-2xl elements with bg-card class
  const bubbles = page.locator('.flex.items-end.gap-3 [class*="rounded-2xl"][class*="bg-card"] span');

  // Use allTextContents for atomic retrieval (avoids stale element issues)
  try {
    const allTexts = await bubbles.allTextContents();
    return allTexts.filter(text => text && text.trim()).map(text => text.trim());
  } catch {
    // Fallback to individual retrieval if allTextContents fails
    const count = await bubbles.count();
    const messages: string[] = [];
    for (let i = 0; i < count; i++) {
      try {
        const text = await bubbles.nth(i).textContent({ timeout: 5000 });
        if (text && text.trim()) messages.push(text.trim());
      } catch {
        // Skip stale elements
      }
    }
    return messages;
  }
}

// Helper to send message and get response
async function sendMessage(page: Page, message: string): Promise<string[]> {
  // Get all messages BEFORE sending
  const beforeMessages = await getAllMessages(page);
  const beforeCount = beforeMessages.length;
  console.log(`[DEBUG] Before sending "${message}": ${beforeCount} messages`);

  const input = page.locator('input[placeholder="Type a message…"]');
  await input.waitFor({ state: 'visible', timeout: 10000 });
  await input.fill(message);
  await input.press('Enter');

  // Wait for AI to respond using multiple strategies
  // Strategy 1: Wait for typing indicator to appear and disappear
  await waitForResponse(page);

  // Strategy 2: Wait for message count to increase (backup if typing indicator didn't work)
  const startTime = Date.now();
  const timeout = 60000; // 60 second timeout for API response
  let afterMessages = await getAllMessages(page);

  while (afterMessages.length <= beforeCount && Date.now() - startTime < timeout) {
    console.log(`[DEBUG] Waiting for new messages... current: ${afterMessages.length}, before: ${beforeCount}`);
    await page.waitForTimeout(1000);
    afterMessages = await getAllMessages(page);
  }

  // Extra buffer for rendering
  await page.waitForTimeout(1000);
  afterMessages = await getAllMessages(page);

  console.log(`[DEBUG] After response: ${afterMessages.length} messages`);

  // Return only new messages (ones that weren't there before)
  const newMessages = afterMessages.slice(beforeCount);
  console.log(`[DEBUG] New messages: ${newMessages.length}`);
  newMessages.forEach((m, i) => console.log(`[DEBUG] New[${i}]: ${m.substring(0, 60)}...`));

  return newMessages;
}

// Helper to select bucket
async function selectBucket(page: Page, bucketName: string): Promise<void> {
  await page.click(`button:has-text("${bucketName}")`);
  await waitForResponse(page);
  await page.waitForTimeout(1000); // Let messages render
}

// Helper to setup to email step
async function setupToEmailStep(page: Page, userName: string = 'TestUser'): Promise<void> {
  await page.goto('/chat');
  await page.waitForSelector('.flex.items-end.gap-3', { timeout: 30000 });
  await page.waitForTimeout(2000);

  // Give name
  await sendMessage(page, userName);

  // Select bucket
  await selectBucket(page, 'Healing');
}

// Helper to setup to deepening step (past email)
async function setupToDeepening(page: Page, userName: string = 'TestUser'): Promise<void> {
  await setupToEmailStep(page, userName);
  await sendMessage(page, 'test@example.com');
}

// Helper to setup to payment step
async function setupToPayment(page: Page): Promise<void> {
  await setupToDeepening(page, 'PaymentTest');
  await sendMessage(page, 'my mother');
  await sendMessage(page, 'Maria');
  await sendMessage(page, 'stage 2 cancer');
  await sendMessage(page, 'complete healing');
  await sendMessage(page, 'help me find the words');
  await page.waitForTimeout(3000);
  // Confirm prayer
  await sendMessage(page, 'yes, that\'s perfect');
  await page.waitForTimeout(3000);
}

// =============================================================================
// EMAIL CAPTURE EDGE CASES
// =============================================================================

test.describe('Email Capture Edge Cases', () => {
  test.setTimeout(90000);

  test('direct refusal - "no"', async ({ page }) => {
    await setupToEmailStep(page);
    const messages = await sendMessage(page, 'no');

    console.log('Response to "no":', messages);
    const response = messages.join(' ').toLowerCase();

    // Should accept gracefully, not push
    expect(response).not.toContain('please');
    expect(response).not.toContain('need your email');
    // Should move to deepening question
    expect(
      response.includes('yourself') ||
      response.includes('someone') ||
      response.includes('prayer') ||
      response.includes('fine') ||
      response.includes('okay') ||
      response.includes('understand')
    ).toBe(true);
  });

  test('polite refusal - "I\'d rather not share that"', async ({ page }) => {
    await setupToEmailStep(page);
    const messages = await sendMessage(page, "I'd rather not share that");

    console.log('Response to polite refusal:', messages);
    const response = messages.join(' ').toLowerCase();

    // Should accept gracefully
    expect(response).not.toContain('need');
    expect(response).not.toContain('must');
  });

  test('ask why - short "why?"', async ({ page }) => {
    await setupToEmailStep(page);
    const messages = await sendMessage(page, 'why?');

    console.log('Response to "why?":', messages);
    const response = messages.join(' ').toLowerCase();

    // Should explain purpose
    expect(
      response.includes('confirmation') ||
      response.includes('reach you') ||
      response.includes('send') ||
      response.includes('photo')
    ).toBe(true);

    // Should NOT immediately ask deepening question
    const hasDeepeningQuestion = response.includes('yourself') && response.includes('someone you love');
    expect(hasDeepeningQuestion).toBe(false);
  });

  test('ask why - "why do you need my email?"', async ({ page }) => {
    await setupToEmailStep(page);
    const messages = await sendMessage(page, 'why do you need my email?');

    console.log('Response to why question:', messages);
    const response = messages.join(' ').toLowerCase();

    // Should explain
    expect(
      response.includes('confirmation') ||
      response.includes('reach') ||
      response.includes('send') ||
      response.includes('grotto')
    ).toBe(true);
  });

  test('privacy concern - "is my email safe?"', async ({ page }) => {
    await setupToEmailStep(page);
    const messages = await sendMessage(page, 'is my email safe with you?');

    console.log('Response to privacy concern:', messages);
    const response = messages.join(' ').toLowerCase();

    // Should reassure about privacy
    expect(
      response.includes('private') ||
      response.includes('safe') ||
      response.includes('never share') ||
      response.includes('won\'t share') ||
      response.includes('protect')
    ).toBe(true);
  });

  test('spam concern - "will you spam me?"', async ({ page }) => {
    await setupToEmailStep(page);
    const messages = await sendMessage(page, 'will you spam me?');

    console.log('Response to spam concern:', messages);
    const response = messages.join(' ').toLowerCase();

    // Should reassure no spam
    expect(
      response.includes('no') ||
      response.includes('won\'t') ||
      response.includes('never') ||
      response.includes('only')
    ).toBe(true);
  });

  test('provide later - "can I give it later?"', async ({ page }) => {
    await setupToEmailStep(page);
    const messages = await sendMessage(page, 'can I give it later?');

    console.log('Response to "later":', messages);
    const response = messages.join(' ').toLowerCase();

    // Should accept
    expect(
      response.includes('of course') ||
      response.includes('sure') ||
      response.includes('fine') ||
      response.includes('no problem') ||
      response.includes('okay')
    ).toBe(true);
  });

  test('user jumps ahead - ignores email, shares situation', async ({ page }) => {
    await setupToEmailStep(page);
    const messages = await sendMessage(page, 'my mother is very sick with cancer');

    console.log('Response to jumping ahead:', messages);
    const response = messages.join(' ').toLowerCase();

    // Should acknowledge the situation OR gently redirect
    expect(
      response.includes('mother') ||
      response.includes('cancer') ||
      response.includes('sick') ||
      response.includes('email') ||
      response.includes('sorry')
    ).toBe(true);
  });
});

// =============================================================================
// PAYMENT PHASE EDGE CASES
// =============================================================================

test.describe('Payment Phase Edge Cases', () => {
  test.setTimeout(180000);

  test('price shock - "that\'s a lot of money"', async ({ page }) => {
    await setupToPayment(page);
    const messages = await sendMessage(page, "that's a lot of money");

    console.log('Response to price shock:', messages);
    const response = messages.join(' ').toLowerCase();

    // Should NOT guilt
    expect(response).not.toContain('pilgrims work hard');
    expect(response).not.toContain('costs us');

    // Should point to lower tier or be understanding
    expect(
      response.includes('28') ||
      response.includes('understand') ||
      response.includes('lower') ||
      response.includes('option')
    ).toBe(true);
  });

  test('scam accusation - "this is a scam"', async ({ page }) => {
    await setupToPayment(page);
    const messages = await sendMessage(page, 'this is a scam');

    console.log('Response to scam accusation:', messages);
    const response = messages.join(' ').toLowerCase();

    // Should NOT get defensive or offended
    expect(response).not.toContain('how dare');
    expect(response).not.toContain('offended');

    // Should reassure calmly
    expect(
      response.includes('understand') ||
      response.includes('real') ||
      response.includes('photos') ||
      response.includes('pilgrims')
    ).toBe(true);
  });

  test('hesitation - "hmm let me think"', async ({ page }) => {
    await setupToPayment(page);
    const messages = await sendMessage(page, 'hmm let me think');

    console.log('Response to hesitation:', messages);
    const response = messages.join(' ').toLowerCase();

    // Should honor their pace
    expect(
      response.includes('time') ||
      response.includes('no rush') ||
      response.includes('take') ||
      response.includes('ready')
    ).toBe(true);

    // Should NOT pressure
    expect(response).not.toContain('hurry');
    expect(response).not.toContain('limited');
    expect(response).not.toContain('now or never');
  });

  test('decline - "no thanks, not today"', async ({ page }) => {
    await setupToPayment(page);
    const messages = await sendMessage(page, 'no thanks, not today');

    console.log('Response to decline:', messages);
    const response = messages.join(' ').toLowerCase();

    // Should accept gracefully
    expect(
      response.includes('understand') ||
      response.includes('bless') ||
      response.includes('okay') ||
      response.includes('welcome')
    ).toBe(true);

    // Should NOT push or guilt
    expect(response).not.toContain('are you sure');
    expect(response).not.toContain('reconsider');
  });

  test('technical question - "do you take Apple Pay?"', async ({ page }) => {
    await setupToPayment(page);
    const messages = await sendMessage(page, 'do you take Apple Pay?');

    console.log('Response to technical question:', messages);
    const response = messages.join(' ').toLowerCase();

    // Should answer the question (or redirect appropriately)
    // Not expecting specific answer, just that it's handled
    expect(response.length).toBeGreaterThan(10);
  });

  test('trust concern - "is this legitimate?"', async ({ page }) => {
    await setupToPayment(page);
    const messages = await sendMessage(page, 'is this legitimate?');

    console.log('Response to trust concern:', messages);
    const response = messages.join(' ').toLowerCase();

    // Should provide reassurance
    expect(
      response.includes('real') ||
      response.includes('pilgrims') ||
      response.includes('photos') ||
      response.includes('grotto') ||
      response.includes('understand')
    ).toBe(true);
  });
});

// =============================================================================
// PRAYER COMPOSITION EDGE CASES
// =============================================================================

test.describe('Prayer Composition Edge Cases', () => {
  test.setTimeout(180000);

  test('vague confirmation - just "ok"', async ({ page }) => {
    await setupToDeepening(page, 'OkTest');
    await sendMessage(page, 'my mother');
    await sendMessage(page, 'Sarah');
    await sendMessage(page, 'diabetes');
    await sendMessage(page, 'healing');
    await sendMessage(page, 'help me write it');
    await page.waitForTimeout(2000);

    // After simple prayer is shown, say just "ok"
    const messages = await sendMessage(page, 'ok');

    console.log('Response to "ok":', messages);
    const response = messages.join(' ').toLowerCase();

    // Should either confirm or clarify
    expect(response.length).toBeGreaterThan(10);
  });

  test('request modification with confirmation - "yes but shorter"', async ({ page }) => {
    await setupToDeepening(page, 'ModifyTest');
    await sendMessage(page, 'my father');
    await sendMessage(page, 'John');
    await sendMessage(page, 'heart surgery');
    await sendMessage(page, 'successful surgery');
    await sendMessage(page, 'please help me');
    await page.waitForTimeout(2000);

    const messages = await sendMessage(page, 'yes but can you make it shorter?');

    console.log('Response to "yes but shorter":', messages);
    const response = messages.join(' ').toLowerCase();

    // Should modify, not just confirm
    expect(
      response.includes('shorter') ||
      response.includes('here') ||
      response.includes('amen')
    ).toBe(true);
  });

  test('add to prayer - "can you add about his surgery?"', async ({ page }) => {
    await setupToDeepening(page, 'AddTest');
    await sendMessage(page, 'my brother');
    await sendMessage(page, 'Michael');
    await sendMessage(page, 'car accident');
    await sendMessage(page, 'recovery');
    await sendMessage(page, 'help me find words');
    await page.waitForTimeout(2000);

    const messages = await sendMessage(page, 'can you add something about his upcoming surgery?');

    console.log('Response to add request:', messages);
    const response = messages.join(' ').toLowerCase();

    // Should include surgery in response
    expect(
      response.includes('surgery') ||
      response.includes('add') ||
      response.includes('include')
    ).toBe(true);
  });

  test('neither prayer liked - "I don\'t like either"', async ({ page }) => {
    await setupToDeepening(page, 'NeitherTest');
    await sendMessage(page, 'my wife');
    await sendMessage(page, 'Emma');
    await sendMessage(page, 'anxiety');
    await sendMessage(page, 'peace');
    await sendMessage(page, 'help me write');
    await page.waitForTimeout(2000);

    // See detailed version
    await sendMessage(page, 'yes show me detailed');
    await page.waitForTimeout(2000);

    const messages = await sendMessage(page, "I don't like either one");

    console.log('Response to neither:', messages);
    const response = messages.join(' ').toLowerCase();

    // Should ask what they'd prefer
    expect(
      response.includes('what') ||
      response.includes('would you') ||
      response.includes('prefer') ||
      response.includes('like') ||
      response.includes('change')
    ).toBe(true);

    // Should NOT be defensive
    expect(response).not.toContain('but');
  });
});

// =============================================================================
// CROSS-PHASE EDGE CASES
// =============================================================================

test.describe('Cross-Phase Edge Cases', () => {
  test.setTimeout(120000);

  test('AI question mid-flow', async ({ page }) => {
    await setupToDeepening(page, 'AITest');
    await sendMessage(page, 'my son');

    // Ask if AI mid-conversation
    const messages = await sendMessage(page, 'wait, are you a real person or a bot?');

    console.log('Response to AI question:', messages);
    const response = messages.join(' ').toLowerCase();

    // Should deflect without admitting AI
    expect(response).not.toContain('i am an ai');
    expect(response).not.toContain("i'm an ai");
    expect(response).not.toContain('language model');

    // Should deflect gracefully
    expect(
      response.includes('real') ||
      response.includes('pilgrims') ||
      response.includes('prayer')
    ).toBe(true);
  });

  test('user provides email unprompted early', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForSelector('.flex.items-end.gap-3', { timeout: 30000 });
    await page.waitForTimeout(2000);

    // Give name with email
    const messages = await sendMessage(page, "I'm John, my email is john@test.com");

    console.log('Response to unprompted email:', messages);
    // Should acknowledge both name and email
    const response = messages.join(' ').toLowerCase();
    expect(
      response.includes('john') ||
      response.includes('thank')
    ).toBe(true);
  });
});
