# Flyer Newsletter Sources

Email: `j.hedin.open.claw+flyers@gmail.com`
Postal code: `T3C 0W1`

## Subscription Status

| # | Store | Status | Method | Notes |
|---|-------|--------|--------|-------|
| 1 | Sobeys Liquor | **Not subscribed** — Browserless quota hit | Gigya form at liquor.sobeys.com/subscription/ | Same Gigya as Safeway. Auto-subs all Sobeys banners. Store 96924 = Safeway Liquor Mission (504 Elbow Dr SW). |
| 2 | Safeway | **Subscribed 2026-03-29** | Gigya form at safeway.ca/subscription | Fields: email, first/last name, postal code (T3C 0W1), 2 checkboxes. Store #8812 Westbrook. |
| 3 | Canadian Tire | **Not subscribed** — Browserless quota hit | Email widget at canadiantire.ca/en/triangle-loyalty-offers-program-registration.html | Store #930 = Calgary Mount Royal (906 16 Ave SW). Akamai bot protection. |
| 4 | London Drugs | **Not subscribed** — Browserless quota hit | eNewsletter at londondrugs.com/enewsletter-settings | Store #31 = London Town Square (3545 32nd Ave NE). Cloudflare. |
| 5 | Save-On-Foods | **Submitted, needs email confirmation** | flyerbox.ca/save-on-foods/ | Store = Mount Royal (RSID 1982, 906 16 Ave SW). Check inbox for confirmation link. |
| 6 | Shoppers Drug Mart | **Not subscribed** — Browserless quota hit | Email form at shoppersdrugmart.ca/en/email-signup | National flyer, no store selection needed. |
| 7 | T&T Supermarket | **Needs manual signup** — Turnstile CAPTCHA | flyerbox.ca/deals/calgary/tt-supermarket/ | No email on T&T site. Flyerbox has CAPTCHA. Nearest stores: 999 36 St NE, 9650 Harvest Hills NE. |
| 8 | Costco | **Not subscribed** — Browserless quota hit | Email form at costco.ca/email-sign-up.html | Regional (Alberta-wide). Optional warehouse dropdown for S Calgary. |
| 9 | Calgary Co-op (Food) | **Subscribed 2026-03-29** | HubSpot form at calgarycoop.com/newsletter/ | General newsletter. Fields: first/last name, email, consent. |
| 10 | Co-op Wine Spirits Beer | **No email option** — use Flipp API | Flipp merchant 3407 | backflipp.wishabi.com API returns structured JSON. |
| 11 | No Frills | **Subscribed 2026-03-29** | PC Optimum eflyer at pcoptimum.ca/eflyers-subscription | Province: AB, Banner: No Frills, Language: EN. |
| 12 | Wholesale Club | **No email option** — use Flipp API | Flipp merchant 2702 | DigitalFlyerSubscriptions flag disabled. backflipp.wishabi.com API works. |
| 13 | Real Canadian Superstore | **Subscribed 2026-03-29** | PC Optimum eflyer at pcoptimum.ca/eflyers-subscription | Province: AB, Banner: RCSS, Language: EN. |

## Flipp API (for stores without email)

Public JSON API — no auth needed:
```
# Step 1: Get current flyers for Calgary
GET https://backflipp.wishabi.com/flipp/flyers?locale=en-ca&postal_code=T3C0W1
# Filter by merchant_id client-side

# Step 2: Get all items for a specific flyer
GET https://backflipp.wishabi.com/flipp/flyers/{flyer_id}
```

Known merchant IDs:
- Calgary Co-op Food: 2051 (126 items in current flyer)
- Co-op Wine Spirits Beer: 3407 (41 items)
- Wholesale Club: 2702 (123 items)

Returns: item name, brand, price, discount %, image URL, validity dates.

## Still TODO

1. **Confirm Save-On-Foods** — click confirmation link in email
2. **Manual signup: T&T** — flyerbox.ca, needs browser for Turnstile CAPTCHA
3. **Retry when Browserless resets**: Shoppers, Costco, Sobeys Liquor, Canadian Tire, London Drugs
4. **Add Flipp API support** to discover-flyers workflow for Co-op WSB + Wholesale Club
