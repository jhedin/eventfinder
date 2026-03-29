# Subscribe to Flyer Newsletter

Sign up the flyer email address to receive a grocery store's weekly flyer newsletter, using Browserless.io for browser automation.

## Prerequisites

- `BROWSERLESS_TOKEN` must be set in the environment
- The email address to use: `j.hedin.open.claw+flyers@gmail.com`
- Default postal code: `T3C 0W1`

## Workflow

1. **Get the store** — accept a store name or URL as argument, or prompt interactively
2. **Look up signup approach** — check `data/flyer-sources.md` for the store's flyer URL and location details
3. **Navigate to the store's website** using Browserless.io:
   - Go to the store's main page or flyer page
   - Find the newsletter/flyer signup form (often in the footer, or a dedicated page)
   - If the store requires selecting a location first, use the postal code `T3C 0W1` and select the correct store from the list (refer to `data/flyer-sources.md` for which location)
4. **Fill out the signup form**:
   - Email: `j.hedin.open.claw+flyers@gmail.com`
   - Postal code: `T3C 0W1` (if asked)
   - Store location: as specified in `data/flyer-sources.md`
   - Check any required consent boxes
   - Uncheck any optional marketing/partner boxes
   - Submit the form
5. **Verify submission**:
   - Check for a success message on the page
   - Report the result
6. **Update tracking** — add a note to `data/flyer-sources.md` marking the store as subscribed with the date

## Usage

```
/subscribe-flyer Safeway
/subscribe-flyer https://www.nofrills.ca
/subscribe-flyer       (interactive — will show list of unsubscribed stores)
```

## Browserless.io Usage

Use the Browserless.io API for browser automation. The agent should use `fetch()` to call Browserless endpoints:

**Navigate and get content:**
```bash
node -e "
const token = process.env.BROWSERLESS_TOKEN;
const body = JSON.stringify({
  url: '<URL>',
  gotoOptions: { waitUntil: 'networkidle2', timeout: 30000 },
});
fetch('https://production-sfo.browserless.io/content?token=' + token, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body
}).then(r => r.text()).then(console.log);
"
```

**Run browser actions (click, type, etc.):**
```bash
node -e "
const token = process.env.BROWSERLESS_TOKEN;
const body = JSON.stringify({
  url: '<URL>',
  gotoOptions: { waitUntil: 'networkidle2', timeout: 30000 },
  actions: [
    { type: 'click', selector: '<CSS_SELECTOR>' },
    { type: 'type', selector: '<CSS_SELECTOR>', text: '<TEXT>' },
    { type: 'click', selector: '<SUBMIT_BUTTON_SELECTOR>' },
    { type: 'wait', timeout: 3000 },
    { type: 'content' }
  ]
});
fetch('https://production-sfo.browserless.io/function?token=' + token, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body
}).then(r => r.text()).then(console.log);
"
```

## Tips

- Many Canadian grocery stores use Flipp for their flyers — the newsletter signup is usually on the store's main website, not on the Flipp page
- Look for "Email Sign Up", "Newsletter", "Weekly Flyer Email", or similar in the footer
- Some stores (Costco, T&T) may not offer flyer email subscriptions — note this in the tracking file
- If a CAPTCHA blocks signup, report it and suggest the user sign up manually
- Some stores require email verification — note this so the user can click the confirmation link

## Output

```
Subscribing to Safeway flyer newsletter...

1. Navigating to safeway.ca...
2. Found newsletter signup in footer
3. Setting store: #8812 (postal code T3C 0W1)
4. Entering email: j.hedin.open.claw+flyers@gmail.com
5. Submitting...

✓ Signup submitted successfully!
  Check inbox for confirmation email.

Updated data/flyer-sources.md — marked Safeway as subscribed.
```

## Notes

- This is a **manual/interactive** command — run it once per store
- Some stores may need manual signup if they have CAPTCHAs or complex flows
- After subscribing, the `/discover-flyers` command will pick up newsletters from Gmail automatically
