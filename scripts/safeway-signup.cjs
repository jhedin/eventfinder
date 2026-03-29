#!/usr/bin/env node
// Safeway flyer newsletter signup via Browserless /function endpoint

const { execSync } = require('child_process');
const fs = require('fs');

const token = process.env.BROWSERLESS_TOKEN;
if (!token) {
  console.error('ERROR: BROWSERLESS_TOKEN not set');
  process.exit(1);
}

// Puppeteer function to run in Browserless
const browserCode = `
module.exports = async ({ page }) => {
  // Navigate to subscription page
  await page.goto('https://www.safeway.ca/subscription', {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  // Wait for Gigya form to appear
  await page.waitForSelector('#gigya-textbox-email', { timeout: 15000 });

  // Fill email
  await page.click('#gigya-textbox-email', { clickCount: 3 });
  await page.type('#gigya-textbox-email', 'j.hedin.open.claw+flyers@gmail.com');

  // Fill first name
  await page.click('#gigya-textbox-122033259098094430', { clickCount: 3 });
  await page.type('#gigya-textbox-122033259098094430', 'J');

  // Fill last name
  await page.click('#gigya-textbox-48351557999388700', { clickCount: 3 });
  await page.type('#gigya-textbox-48351557999388700', 'H');

  // Fill postal code (no space, Gigya usually handles format)
  await page.click('#gigya-textbox-99294980864804060', { clickCount: 3 });
  await page.type('#gigya-textbox-99294980864804060', 'T3C0W1');

  // Check both consent checkboxes
  const cb1 = await page.$('#gigya-checkbox-36710405232980536');
  const cb1Checked = await page.evaluate(el => el.checked, cb1);
  if (!cb1Checked) await page.click('#gigya-checkbox-36710405232980536');

  const cb2 = await page.$('#gigya-checkbox-74705580798586320');
  const cb2Checked = await page.evaluate(el => el.checked, cb2);
  if (!cb2Checked) await page.click('#gigya-checkbox-74705580798586320');

  // Verify field values before submitting
  const emailVal = await page.$eval('#gigya-textbox-email', el => el.value);
  const firstVal = await page.$eval('#gigya-textbox-122033259098094430', el => el.value);
  const lastVal = await page.$eval('#gigya-textbox-48351557999388700', el => el.value);
  const postalVal = await page.$eval('#gigya-textbox-99294980864804060', el => el.value);
  const cb1Val = await page.$eval('#gigya-checkbox-36710405232980536', el => el.checked);
  const cb2Val = await page.$eval('#gigya-checkbox-74705580798586320', el => el.checked);

  const formState = { emailVal, firstVal, lastVal, postalVal, cb1Val, cb2Val };

  // Submit the form
  await page.click('input[type="submit"].gigya-input-submit');

  // Wait for response
  await new Promise(r => setTimeout(r, 5000));

  // Get page content after submit
  const content = await page.content();

  // Check for success indicators
  const hasThankYou = content.includes('Thank you') || content.includes('thank you');
  const hasSubscribeThankYou = content.includes('subscribe-thank-you');
  const hasSubscribed = content.toLowerCase().includes('subscribed');

  // Extract thank-you text if present
  let thankYouText = '';
  const tyMatch = content.match(/class="subscribe-thank-you"[^>]*>([\s\S]{0,500}?)<\/div>/);
  if (tyMatch) thankYouText = tyMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  // Find any active error messages
  const errorMatches = content.match(/gigya-error-msg-active[^>]*>(.*?)<\/span>/g) || [];
  const errors = errorMatches.map(e => e.replace(/<[^>]+>/g, '').trim()).filter(Boolean);

  // Get current screen (what screen is displayed now)
  const currentScreen = content.match(/id="gigya-([a-z-]+)-screen"/)?.[1] || 'unknown';

  return {
    formState,
    success: hasThankYou || hasSubscribeThankYou,
    hasThankYou,
    hasSubscribeThankYou,
    hasSubscribed,
    thankYouText,
    errors,
    currentScreen
  };
};
`;

// Write the browser code to a temp file
const tmpFile = '/tmp/safeway-browserless-fn.js';
fs.writeFileSync(tmpFile, browserCode);

console.log('Sending automation script to Browserless /function...');

try {
  const result = execSync(
    `curl -s -X POST "https://production-sfo.browserless.io/function?token=${token}" ` +
    `-H "Content-Type: application/javascript" ` +
    `--data-binary @${tmpFile}`,
    { maxBuffer: 10 * 1024 * 1024, timeout: 90000 }
  ).toString();

  console.log('Raw response:', result.substring(0, 5000));

  try {
    const parsed = JSON.parse(result);
    console.log('\n=== Parsed result ===');
    console.log(JSON.stringify(parsed, null, 2));

    if (parsed.success || parsed.hasThankYou || parsed.hasSubscribeThankYou) {
      console.log('\nSUCCESS: Signup submitted successfully!');
      if (parsed.thankYouText) console.log('Message:', parsed.thankYouText);
    } else {
      console.log('\nOutcome unclear or failed.');
      if (parsed.errors && parsed.errors.length > 0) {
        console.log('Errors:', parsed.errors);
      }
      console.log('Form state:', parsed.formState);
      console.log('Current screen:', parsed.currentScreen);
    }
  } catch (e) {
    console.log('Could not parse JSON response');
  }
} catch (err) {
  console.error('curl failed:', err.message);
}
