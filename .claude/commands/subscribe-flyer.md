# Subscribe to Flyer Newsletter

Sign up the flyer email address for a store's newsletter using Browserless.io browser automation.

## Config

- Email: `j.hedin.open.claw+flyers@gmail.com`
- Postal code: `T3C 0W1`
- Store details: See `data/flyer-sources.md`

## Workflow

1. **Identify the store** from argument or prompt. Check `data/flyer-sources.md` for signup URL and location.
2. **Navigate** to the signup page via Browserless `/content` endpoint to inspect the form.
3. **Fill and submit** via Browserless `/function` endpoint:
   - Email: `j.hedin.open.claw+flyers@gmail.com`
   - Postal code: `T3C 0W1` (if asked)
   - Store location: per `data/flyer-sources.md`
   - Check required consent boxes, uncheck optional marketing
4. **Verify** success message on page.
5. **Update** `data/flyer-sources.md` with subscription date.

## Browserless API

```bash
# Inspect page
node -e "
const r = await fetch('https://production-sfo.browserless.io/content?token=' + process.env.BROWSERLESS_TOKEN, {
  method: 'POST', headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({ url: '<URL>', gotoOptions: { waitUntil: 'networkidle2', timeout: 30000 }, bestAttempt: true })
}); console.log(await r.text());
"

# Fill and submit (Puppeteer code runs server-side)
node -e "
const r = await fetch('https://production-sfo.browserless.io/function?token=' + process.env.BROWSERLESS_TOKEN, {
  method: 'POST', headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({ code: '<PUPPETEER_CODE>', context: {} })
}); console.log(await r.text());
"
```

## Notes

- Run once per store — this is a manual/interactive command
- If CAPTCHA blocks signup, report it for manual signup
- Some stores may need email verification — note this for the user
- For Gigya (Safeway/Sobeys) forms, use `setNativeValue()` with `_valueTracker` for React-style inputs
