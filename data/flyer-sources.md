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
| 2 | Safeway | https://www.safeway.ca/subscription | Gigya lite registration | Fields: email, first name, last name, postal code (T3C 0W1), 2 consent checkboxes. No CAPTCHA, no account needed. Postal code determines store flyer. Store #8812 = Westbrook area. JS-rendered (needs Browserless). |
| 1 | Sobeys Liquor | https://liquor.sobeys.com/subscription/ or /register/ | Gigya (SAP) form | Same Gigya system as Safeway. Store ID 96924 = "Safeway Liquor Mission" at 504 Elbow Dr SW. JS-heavy. |
| 3 | Canadian Tire | https://www.canadiantire.ca/en/triangle-loyalty-offers-program-registration.html | Email widget or Triangle account | Store #930 = Calgary Mount Royal (906 16 Ave SW). Simple email widget on loyalty page (no account needed), or full Triangle Rewards account for store-specific flyer. Akamai bot protection — needs Browserless. May need email verification. |

### Hard — JS-heavy, Cloudflare blocks, or Loblaw ecosystem

| # | Store | Signup URL | Method | Notes |
|---|-------|-----------|--------|-------|
| 11 | No Frills | Loblaw digital flyer subscription | Loblaw CIAM + Flipp | Has `DigitalFlyerSubscriptions` feature flag enabled. Needs PC/Loblaw account or Flipp integration. "By the Kirby Centre" location. |
| 13 | Real Canadian Superstore | Loblaw digital flyer subscription | Loblaw CIAM + Flipp | Same Loblaw ecosystem as No Frills. `DigitalFlyerSubscriptions` flag found. Deerfoot Meadows location. |
| 12 | Wholesale Club | Unknown | Loblaw ecosystem | `DigitalFlyerSubscriptions` flag DISABLED for this brand. May need PC Optimum email prefs. 58th Avenue location. |
| 5 | Save-On-Foods | https://www.flyerbox.ca/save-on-foods/ (or create account at secure.saveonfoods.com) | Account-gated or flyerbox.ca | Store = Mount Royal (RSID 1982, 906 16 Ave SW). No standalone email form — need Save-On-Foods or More Rewards account to get flyer emails directly. flyerbox.ca is the easy no-account alternative. Cloudflare blocks bots. |

### Likely No Email Subscription Available

| # | Store | Flyer URL | Notes |
|---|-------|-----------|-------|
| 4 | London Drugs | https://www.londondrugs.com/enewsletter-settings | eNewsletter form (email, then set preferences) | Store #31 = London Town Square (3545 32nd Ave NE). Email-first signup, then set postal code/store on preferences page. Cloudflare blocks — needs Browserless. No CAPTCHA expected. |
| 7 | T&T Supermarket | https://www.flyerbox.ca/deals/calgary/tt-supermarket/ | **No email on T&T site.** Use flyerbox.ca instead — email-only signup, no CAPTCHA, Calgary-wide flyer. Nearest stores: 999 36 St NE and 9650 Harvest Hills Blvd NE. |
| 9 | Calgary Co-op (Food) | https://www.calgarycoop.com/newsletter/ | General newsletter (HubSpot form). Fields: first name, last name, email, consent. No store selection, no CAPTCHA. Not flyer-specific but covers "special offers, new products." |
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
