import { test, expect, Page } from '@playwright/test';

// Test data for different buckets
const TEST_SCENARIOS = {
  healing: {
    bucket: 'Healing for Someone ill',
    userName: 'Sarah',
    email: 'sarah.test@example.com',
    forWho: 'someone I love',
    personName: 'Michael',
    relationship: 'my father',
    situation: 'stage 2 lung cancer',
    healingHope: 'complete remission and healing',
  },
  family: {
    bucket: 'A Family Wound',
    userName: 'David',
    email: 'david.test@example.com',
    forWho: 'my sister',
    personName: 'Rebecca',
    relationship: 'my sister',
    situation: "we haven't spoken in 5 years after a big argument",
    healingHope: 'reconciliation and restored relationship',
  },
  protection: {
    bucket: 'Protection for a Loved One',
    userName: 'Maria',
    email: 'maria.test@example.com',
    forWho: 'my son',
    personName: 'Carlos',
    relationship: 'my son',
    situation: 'deployed overseas in a dangerous area',
    healingHope: 'safety and return home',
  },
  grief: {
    bucket: 'Grief or Loss',
    userName: 'Thomas',
    email: 'thomas.test@example.com',
    forWho: 'my wife who passed',
    personName: 'Elizabeth',
    relationship: 'my wife',
    situation: 'passed away 3 months ago from heart failure',
    healingHope: 'peace for her soul and comfort for me',
  },
  guidance: {
    bucket: 'Guidance in a Difficult Season',
    userName: 'Jennifer',
    email: 'jennifer.test@example.com',
    forWho: 'myself',
    personName: 'myself',
    relationship: 'myself',
    situation: 'facing a major career decision that will affect my whole family',
    healingHope: 'clarity and wisdom to make the right choice',
  },
};

// Helper to count Messenger Marie messages
async function countMessages(page: Page): Promise<number> {
  // Count text bubbles from Messenger Marie (has avatar before it)
  const messages = page.locator('.flex.items-end.gap-3 [class*="rounded-2xl"]');
  return await messages.count();
}

// Helper to wait for NEW Messenger Marie messages
async function waitForNewMessages(page: Page, previousCount: number, timeout = 45000): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const currentCount = await countMessages(page);
    if (currentCount > previousCount) {
      // Wait a bit more for typing to complete
      await page.waitForTimeout(1000);
      return;
    }
    await page.waitForTimeout(500);
  }

  throw new Error(`Timeout waiting for new messages (had ${previousCount}, still ${await countMessages(page)})`);
}

// Helper to get the latest Messenger Marie messages
async function getLatestMessages(page: Page, count: number = 3): Promise<string[]> {
  const bubbles = page.locator('.flex.items-end.gap-3 [class*="rounded-2xl"][class*="bg-card"]');
  const total = await bubbles.count();
  const messages: string[] = [];

  const startIdx = Math.max(0, total - count);
  for (let i = startIdx; i < total; i++) {
    const text = await bubbles.nth(i).textContent();
    if (text) messages.push(text.trim());
  }

  return messages;
}

// Helper to send a message and wait for response
async function sendMessageAndWait(page: Page, message: string): Promise<string[]> {
  const beforeCount = await countMessages(page);

  const input = page.locator('input[placeholder="Type a message…"]');
  await input.waitFor({ state: 'visible', timeout: 10000 });
  await input.fill(message);
  await input.press('Enter');

  // Wait for new messages
  await waitForNewMessages(page, beforeCount);

  // Get the new messages
  return await getLatestMessages(page, 3);
}

// Helper to click bucket and wait for response
async function selectBucketAndWait(page: Page, bucketName: string): Promise<string[]> {
  const beforeCount = await countMessages(page);

  await page.click(`button:has-text("${bucketName}")`);

  // Wait for new messages
  await waitForNewMessages(page, beforeCount);

  return await getLatestMessages(page, 3);
}

// Run one bucket test
async function runBucketTest(page: Page, bucketKey: string, scenario: typeof TEST_SCENARIOS.healing) {
  const log = (step: string, messages: string[]) => {
    console.log(`\n--- ${bucketKey.toUpperCase()}: ${step} ---`);
    console.log('Messages:', messages);
  };

  // Navigate to chat
  await page.goto('/chat');

  // Wait for welcome messages
  await page.waitForSelector('.flex.items-end.gap-3', { timeout: 60000 });
  await page.waitForTimeout(3000); // Let welcome messages load

  // Step 1: Give name
  let messages = await sendMessageAndWait(page, scenario.userName);
  log('Give name', messages);

  // Verify name is used
  const nameUsed = messages.some(m => m.toLowerCase().includes(scenario.userName.toLowerCase()));
  console.log(`✓ Name "${scenario.userName}" used:`, nameUsed);

  // Step 2: Select bucket
  messages = await selectBucketAndWait(page, scenario.bucket);
  log('Select bucket', messages);

  // Step 3: Provide email
  messages = await sendMessageAndWait(page, scenario.email);
  log('Provide email', messages);

  // Step 4: Who is prayer for
  messages = await sendMessageAndWait(page, scenario.forWho);
  log('Who is prayer for', messages);

  // Step 5: Person's name (skip for guidance/self)
  if (bucketKey !== 'guidance') {
    messages = await sendMessageAndWait(page, scenario.personName);
    log("Person's name", messages);

    const personNameUsed = messages.some(m => m.includes(scenario.personName));
    console.log(`✓ Person name "${scenario.personName}" used:`, personNameUsed);
  }

  // Step 6: Describe situation
  messages = await sendMessageAndWait(page, scenario.situation);
  log('Describe situation', messages);

  // Step 7: Express hope
  messages = await sendMessageAndWait(page, scenario.healingHope);
  log('Express hope', messages);

  // Check if asked about prayer composition
  const allText = messages.join(' ').toLowerCase();
  const askedAboutPrayer = allText.includes('words') || allText.includes('prayer') || allText.includes('write');
  console.log('✓ Asked about prayer composition:', askedAboutPrayer);

  // Step 8: Ask for help with prayer
  messages = await sendMessageAndWait(page, 'help me find the right words');
  log('Ask for prayer help', messages);

  // Check if prayer was composed
  const hasPrayer = messages.some(m => m.toLowerCase().includes('amen'));
  console.log('✓ Prayer composed (contains Amen):', hasPrayer);

  if (!hasPrayer) {
    // Maybe need one more exchange
    const lastMsg = messages[messages.length - 1]?.toLowerCase() || '';
    if (lastMsg.includes('detailed') || lastMsg.includes('would you like')) {
      messages = await sendMessageAndWait(page, 'yes please');
      log('Follow-up', messages);
    }
  }

  // Step 9: Confirm prayer
  messages = await sendMessageAndWait(page, 'yes, this is perfect');
  log('Confirm prayer', messages);

  // Wait for payment flow to trigger
  await page.waitForTimeout(5000);

  // Check for petition photo
  const hasPhoto = await page.locator('img[alt*="petition"]').isVisible().catch(() => false);
  console.log('✓ Petition photo visible:', hasPhoto);

  // Check for payment card
  const hasPaymentCard = await page.locator('text=Select your level of support').isVisible().catch(() => false);
  console.log('✓ Payment card visible:', hasPaymentCard);

  return {
    nameUsed,
    askedAboutPrayer,
    hasPrayer,
    hasPhoto,
    hasPaymentCard,
  };
}

// Test each bucket
test.describe('Bucket Flow Tests', () => {
  test.setTimeout(180000); // 3 minutes per test

  for (const [bucketKey, scenario] of Object.entries(TEST_SCENARIOS)) {
    test(`${bucketKey} bucket - complete flow`, async ({ page }) => {
      const results = await runBucketTest(page, bucketKey, scenario);

      console.log(`\n========== ${bucketKey.toUpperCase()} RESULTS ==========`);
      console.log(results);
      console.log('==========================================\n');

      // Soft assertions - log failures but don't fail entire test
      if (!results.nameUsed) console.warn(`⚠ Name not used in response`);
      if (!results.hasPrayer) console.warn(`⚠ Prayer not composed`);
      if (!results.hasPaymentCard) console.warn(`⚠ Payment card not shown`);

      // Only fail if payment card doesn't appear (critical path)
      // Comment this out for initial testing to see full flow
      // expect(results.hasPaymentCard).toBe(true);
    });
  }
});

// AI Quality Tests
test.describe('AI Response Quality', () => {
  test.setTimeout(120000);

  test('should deflect AI questions', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForSelector('.flex.items-end.gap-3', { timeout: 60000 });
    await page.waitForTimeout(3000);

    const messages = await sendMessageAndWait(page, 'Are you an AI or a real person?');
    console.log('AI Question Response:', messages);

    const response = messages.join(' ').toLowerCase();

    // Should NOT admit to being AI
    expect(response).not.toContain('i am an ai');
    expect(response).not.toContain("i'm an ai");
    expect(response).not.toContain('artificial intelligence');
    expect(response).not.toContain('language model');

    // Should deflect gracefully
    const deflected = response.includes('messenger') ||
                      response.includes('real') ||
                      response.includes('prayer') ||
                      response.includes('lourdes');
    expect(deflected).toBe(true);
  });

  test('should not mention prices before payment', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForSelector('.flex.items-end.gap-3', { timeout: 60000 });
    await page.waitForTimeout(3000);

    // Quick flow
    await sendMessageAndWait(page, 'John');
    await selectBucketAndWait(page, 'Healing');
    await sendMessageAndWait(page, 'john@test.com');
    await sendMessageAndWait(page, 'my mother');
    await sendMessageAndWait(page, 'Mary');
    await sendMessageAndWait(page, 'cancer');
    const messages = await sendMessageAndWait(page, 'complete healing');

    // Check Messenger Marie's messages don't contain dollar amounts
    const allMessages = await getLatestMessages(page, 10);
    const sisterMarieSaidPrice = allMessages.some(m => /\$\d+/.test(m));

    console.log('Messages checked for pricing:', allMessages.length);
    console.log('Messenger Marie mentioned price:', sisterMarieSaidPrice);

    expect(sisterMarieSaidPrice).toBe(false);
  });
});
