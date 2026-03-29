# Flyer Newsletter Sources

Email: `j.hedin.open.claw+flyers@gmail.com`
Postal code: `T3C 0W1`

## Signup Recon Summary

### Easy — Simple email form, no store selection needed

| # | Store | Signup URL | Method | Notes |
|---|-------|-----------|--------|-------|
| 6 | Shoppers Drug Mart | https://www.shoppersdrugmart.ca/en/email-signup | Email-only form | National flyer, no store selection. No CAPTCHA. Mentions "weekly flyer deals." |
| 8 | Costco | https://www.costco.ca/email-sign-up.html | Email + optional warehouse | Regional (Alberta-wide) flyer. Optional membership # and warehouse dropdown. Site blocks bots — needs Browserless. |

### Medium — Has signup, but needs store selection or account

| # | Store | Signup URL | Method | Notes |
|---|-------|-----------|--------|-------|
| 2 | Safeway | https://www.safeway.ca/subscription | Gigya (SAP) form | Uses Gigya SSO. Needs postal code for store. Store #8812. Empire/Sobeys ecosystem. JS-heavy. |
| 1 | Sobeys Liquor | https://liquor.sobeys.com/subscription/ or /register/ | Gigya (SAP) form | Same Gigya system as Safeway. Store ID 96924 = "Safeway Liquor Mission" at 504 Elbow Dr SW. JS-heavy. |
| 3 | Canadian Tire | Found on flyer page | Email field on flyer page | Has a simple email field on the flyer page itself. flyerStoreId=930. Needs Browserless to interact. |

### Hard — JS-heavy, Cloudflare blocks, or Loblaw ecosystem

| # | Store | Signup URL | Method | Notes |
|---|-------|-----------|--------|-------|
| 11 | No Frills | Loblaw digital flyer subscription | Loblaw CIAM + Flipp | Has `DigitalFlyerSubscriptions` feature flag enabled. Needs PC/Loblaw account or Flipp integration. "By the Kirby Centre" location. |
| 13 | Real Canadian Superstore | Loblaw digital flyer subscription | Loblaw CIAM + Flipp | Same Loblaw ecosystem as No Frills. `DigitalFlyerSubscriptions` flag found. Deerfoot Meadows location. |
| 12 | Wholesale Club | Unknown | Loblaw ecosystem | `DigitalFlyerSubscriptions` flag DISABLED for this brand. May need PC Optimum email prefs. 58th Avenue location. |
| 5 | Save-On-Foods | Unknown (blocked) | Cloudflare blocks | Entire site behind Cloudflare. RSID 1982. Needs Browserless to explore. |

### Likely No Email Subscription Available

| # | Store | Flyer URL | Notes |
|---|-------|-----------|-------|
| 4 | London Drugs | https://www.londondrugs.com/flyer | Entire site blocked by Cloudflare. Has `/enewsletter-settings` page but couldn't access it. London Town Square location. Needs Browserless. |
| 7 | T&T Supermarket | https://www.tntsupermarket.com/eng/store-flyer | **No flyer email found.** Flyer is postal-code based on website. Nearest Calgary stores: 999 36 St NE and 9650 Harvest Hills Blvd NE. Loblaw-owned but separate system. |
| 9 | Calgary Co-op (Food) | https://www.calgarycoop.com/food/flyers/ | **No flyer email found.** Uses Flipp widget (merchant 2051). Has general newsletter but not flyer-specific. Midtown Market location. |
| 10 | Co-op Wine Spirits Beer | https://www.coopwinespiritsbeer.com/flyers/ | **No flyer email found.** Uses Flipp widget (merchant 3407). No email signup anywhere on site. Midtown location. |

## Subscription Status

| # | Store | Status |
|---|-------|--------|
| 1 | Sobeys Liquor | Not subscribed |
| 2 | Safeway | Not subscribed |
| 3 | Canadian Tire | Not subscribed |
| 4 | London Drugs | Not subscribed — needs Browserless recon |
| 5 | Save-On-Foods | Not subscribed — needs Browserless recon |
| 6 | Shoppers Drug Mart | Not subscribed |
| 7 | T&T Supermarket | Not subscribed — likely no email option |
| 8 | Costco | Not subscribed |
| 9 | Calgary Co-op (Food) | Not subscribed — likely no email option |
| 10 | Co-op Wine Spirits Beer | Not subscribed — likely no email option |
| 11 | No Frills | Not subscribed |
| 12 | Wholesale Club | Not subscribed — may not have flyer email |
| 13 | Real Canadian Superstore | Not subscribed |
