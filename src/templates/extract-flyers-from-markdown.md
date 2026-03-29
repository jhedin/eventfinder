# Extract Flyer Deals from Markdown

You are analyzing a grocery store's flyer or deals page that has been converted to markdown.

Your task is to extract all sale items/deals as structured JSON.

---

## Input

You will receive markdown content from a grocery store website. It may contain:
- Weekly flyer deals with sale prices
- Regular/compare-at prices
- Product descriptions, brands, sizes
- Flyer validity dates (e.g., "Valid Mar 27 - Apr 2")
- Category sections (Produce, Meat, Dairy, etc.)
- Images and promotional banners

**Note**: The markdown may be truncated at 100KB. Extract what you can from the available content.

---

## Output Format

Return a JSON object with flyer metadata and an array of deal items:

```json
{
  "store_name": "Real Canadian Superstore",
  "sale_start": "2026-03-27",
  "sale_end": "2026-04-02",
  "items": [
    {
      "item_name": "Boneless Chicken Breast",
      "brand": "Maple Leaf",
      "description": "Family pack, ~1.5kg",
      "sale_price": "$4.99/lb",
      "regular_price": "$7.99/lb",
      "unit": "/lb",
      "category": "Meat & Seafood",
      "item_url": "https://...",
      "image_url": "https://..."
    }
  ]
}
```

### Field Guidelines

**Flyer metadata**:
- `store_name`: Name of the grocery store (infer from page content, URL, or headers)
- `sale_start`: Flyer validity start date. Format: `YYYY-MM-DD`. Null if not found.
- `sale_end`: Flyer validity end date. Format: `YYYY-MM-DD`. Null if not found.

**Required item fields**:
- `item_name`: The product name (e.g., "Boneless Chicken Breast", "Strawberries 1lb")
- `sale_price`: The deal/sale price as a string

**Optional item fields** (use `null` or omit if not found):
- `brand`: Product brand (e.g., "Maple Leaf", "PC Blue Menu", "No Name")
- `description`: Size, weight, pack info (e.g., "Family pack, ~1.5kg", "340g bag")
- `regular_price`: Original/compare-at price
- `unit`: Price unit (e.g., "/lb", "/kg", "/ea", "/100g", "/L")
- `category`: One of the categories below
- `item_url`: Link to the product page
- `image_url`: Product image URL

### Categories

Use one of these standard categories:
- **Produce** — Fruits, vegetables, fresh herbs
- **Meat & Seafood** — Beef, chicken, pork, fish, deli meats
- **Dairy** — Milk, cheese, yogurt, eggs, butter
- **Bakery** — Bread, pastries, baked goods
- **Frozen** — Frozen meals, ice cream, frozen vegetables
- **Pantry** — Canned goods, pasta, rice, sauces, condiments, snacks, cereal
- **Beverages** — Juice, pop, water, coffee, tea
- **Household** — Cleaning supplies, paper products, pet food
- **Personal Care** — Toiletries, health products, pharmacy
- **Other** — Anything that doesn't fit above

---

## Instructions

### 1. Find Flyer Validity Dates

Look at the top of the page for flyer dates:
- "Valid March 27 - April 2, 2026"
- "This week's flyer: Mar 27 - Apr 2"
- "Weekly Deals: March 27 to April 2"

Parse into `sale_start` and `sale_end` (YYYY-MM-DD format).

### 2. Extract All Deal Items

Scan the entire markdown for products on sale:
- Items in lists or grids
- Featured deals and "hot buys"
- Category sections
- Promotional banners with specific products

### 3. Parse Prices Carefully

**Simple prices**:
- "$4.99" → `sale_price: "$4.99"`
- "$4.99/lb" → `sale_price: "$4.99/lb"`, `unit: "/lb"`

**Multi-buy deals**:
- "2 for $5" → `sale_price: "2 for $5"`
- "Buy 2, Get 1 Free" → `sale_price: "Buy 2 Get 1 Free"`
- "3/$10" → `sale_price: "3 for $10"`

**Percentage off**:
- "50% off" → `sale_price: "50% off"`
- "Save $2.00" → include as description, use the final price as `sale_price`

**Per-unit pricing**:
- "$4.99/lb" → `unit: "/lb"`
- "$1.99/100g" → `unit: "/100g"`
- "$3.49 ea" or "$3.49 each" → `unit: "/ea"`

### 4. Identify Brands

Look for brand names in:
- Product titles ("PC Blue Menu Chicken Breast")
- Brand labels or logos in the content
- Store brands: "No Name", "President's Choice", "Great Value", "Kirkland", "Compliments", etc.

### 5. Categorize Items

Assign each item to the most appropriate category from the list above. If the flyer has its own section headers, use them as hints but normalize to the standard categories.

### 6. Handle Special Cases

**No deals found**: Return `{ "store_name": "...", "sale_start": null, "sale_end": null, "items": [] }`

**Truncated content**: Extract what you can from the available content.

**Ambiguous items**: Include them — better to over-extract than miss deals.

**Non-food items**: Include household and personal care items too.

**Coupons/loyalty pricing**: Include with a note in the description (e.g., "PC Optimum price").

---

## Common Flyer Patterns

### Pattern: Table/Grid Layout
```markdown
| Product | Sale Price | Reg Price |
| Chicken Breast | $4.99/lb | $7.99/lb |
| Ground Beef | $3.99/lb | $5.99/lb |
```

### Pattern: Card/Section Layout
```markdown
## Fresh Produce

**Strawberries**
1 lb clamshell
$2.99 ea
Save $1.00

**Avocados**
Product of Mexico
$0.99 ea
Reg. $1.49
```

### Pattern: Feature/Banner Deals
```markdown
# THIS WEEK'S TOP DEALS

BONELESS CHICKEN BREAST
$4.99/lb
Reg. $7.99/lb — SAVE $3.00
```

### Pattern: Multi-buy Promotions
```markdown
Coca-Cola or Pepsi
12-pack, 355mL cans
2 for $12
```

---

## Validation

Before returning, check:
- [ ] All items have `item_name`
- [ ] All items have `sale_price`
- [ ] Dates are in `YYYY-MM-DD` format
- [ ] Categories use the standard list
- [ ] No syntax errors in JSON
- [ ] Return valid JSON even if no items found

---

## Now Extract Deals

Analyze the markdown below and extract all flyer deals as JSON:

**Markdown:**
[The markdown content will be inserted here by the calling agent]

**Output:**
[Return only the JSON object, no other text]
