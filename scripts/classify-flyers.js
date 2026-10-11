#!/usr/bin/env node
/**
 * Pre-filter and categorize flyer items for LLM review.
 * Outputs candidates grouped by category to /tmp/eventfinder-flyer-candidates.json
 */

import { readFileSync, writeFileSync } from 'fs';

const BATCH_FILE = '/tmp/eventfinder-flyer-batch-flipp.json';
const OUTPUT_FILE = '/tmp/eventfinder-flyer-candidates.json';

// Stores to skip entirely
const SKIP_STORES = new Set([
  'Canadian Tire',
  'London Drugs',
  'Costco',
  'Shoppers Drug Mart',
  'Co-op Wine Spirits Beer',
  'Sobeys & Safeway Liquor',
  'Sobeys', // duplicate of Safeway
]);

// Category keyword patterns (checked in order, first match wins)
const CATEGORIES = [
  {
    name: 'Meat & Seafood',
    keywords: [
      /\b(chicken|beef|pork|lamb|turkey|veal|bison|duck|salmon|tuna|shrimp|prawn|tilapia|cod|halibut|trout|crab|lobster|scallop|oyster|mussel|clam|fish|steak|roast|rib|chop|loin|breast|thigh|wing|drumstick|sausage|bacon|ham|deli|pepperoni|salami|chorizo|ground|minced)\b/i,
      /\b(seafood|meat|poultry|cutlet|tenderloin|brisket|sirloin|filet|meatball|burger patty)\b/i,
    ],
  },
  {
    name: 'Produce',
    keywords: [
      /\b(apple|banana|orange|grape|berry|strawberr|blueberr|raspberr|blackberr|cherry|peach|plum|pear|mango|pineapple|melon|watermelon|cantaloupe|avocado|tomato|lettuce|spinach|kale|broccoli|cauliflower|carrot|celery|cucumber|pepper|zucchini|squash|potato|onion|garlic|ginger|mushroom|corn|asparagus|green bean|pea|leek|cabbage|beet|radish|turnip|parsnip|sweet potato|yam|arugula|romaine|herb|cilantro|parsley|basil|lemon|lime|grapefruit|clementine|mandarin|kiwi|fig|date|pomegranate)\b/i,
      /\b(produce|fruit|vegetable|fresh|salad mix|coleslaw)\b/i,
    ],
  },
  {
    name: 'Dairy',
    keywords: [
      /\b(milk|cream|butter|cheese|yogurt|yoghurt|egg|eggs|cheddar|mozzarella|brie|gouda|parmesan|feta|ricotta|cottage cheese|sour cream|cream cheese|whipping cream|half.and.half|kefir|ghee|margarine|lactose|siggi|balderson|gorgonzola)\b/i,
    ],
  },
  {
    name: 'Bakery',
    keywords: [
      /\b(bread|bun|roll|bagel|croissant|muffin|donut|doughnut|cake|pie|tart|pastry|cookie|biscuit|cracker|tortilla|pita|naan|flatbread|loaf|sourdough|rye|multigrain|whole wheat)\b/i,
    ],
  },
  {
    name: 'Frozen',
    keywords: [
      /\b(frozen|ice cream|gelato|sorbet|popsicle|pizza|fries|nugget|waffle|edamame|pierog|dim sum)\b/i,
    ],
  },
  {
    name: 'Beverages',
    keywords: [
      /\b(juice|coffee|tea|water|sparkling|soda|pop|energy drink|sport drink|lemonade|kombucha|coconut water|oat milk|almond milk|soy milk|drink mix)\b/i,
    ],
  },
  {
    name: 'Pantry',
    keywords: [
      /\b(rice|pasta|flour|sugar|salt|oil|olive oil|canola|vegetable oil|vinegar|sauce|salsa|ketchup|mustard|mayonnaise|soy sauce|hot sauce|barbecue|ranch|dressing|soup|broth|stock|bean|lentil|chickpea|canned|tomato|tuna can|sardine|anchov|jam|honey|syrup|peanut butter|almond butter|nut butter|cereal|oat|granola|muesli|quinoa|couscous|lentil|split pea|chip|cracker|popcorn|snack|nut|almond|cashew|walnut|pistachio|sunflower seed|chocolate|cocoa|baking|yeast|baking powder|baking soda|vanilla|spice|herb|seasoning|condiment|relish|pickle|olive|capers|corn chip|salted)\b/i,
    ],
  },
];

// Items to skip by keyword (non-food / personal care / baby / pet)
const SKIP_KEYWORDS = [
  /\b(vitamin|supplement|medication|medicine|pharmacy|shampoo|conditioner|soap|body wash|lotion|moisturizer|deodorant|toothpaste|toothbrush|floss|mouthwash|razor|shave|tampon|pad|diaper|baby|formula|wipe|pet food|dog|cat|litter|bird seed|fish food|detergent|laundry|bleach|fabric softener|dishwasher|sponge|cleaner|disinfect|paper towel|toilet paper|tissue|garbage bag|plastic bag|foil|wrap|container|storage|battery|light bulb|candle|air freshener|hardware|tool|garden|automotive|tire|oil change|electronic|phone|computer|tablet|headphone|speaker|cable|charger|remote|game|toy|book|magazine|clothing|shoe|sock|shirt|pant|jacket|cosmetic|makeup|lipstick|mascara|foundation|perfume|cologne|nail)\b/i,
];

function categorize(item) {
  const text = `${item.name} ${item.brand || ''}`.toLowerCase();

  // Skip non-food
  for (const pattern of SKIP_KEYWORDS) {
    if (pattern.test(text)) return null;
  }

  // Skip items with no price
  if (!item.price) return null;

  // Categorize
  for (const cat of CATEGORIES) {
    for (const pattern of cat.keywords) {
      if (pattern.test(text)) return cat.name;
    }
  }

  return null; // uncategorized = skip
}

const batch = JSON.parse(readFileSync(BATCH_FILE, 'utf8'));
const stats = {};
const categorized = {
  'Meat & Seafood': [],
  'Produce': [],
  'Dairy': [],
  'Bakery': [],
  'Frozen': [],
  'Pantry': [],
  'Beverages': [],
};

let totalKept = 0;
let totalDropped = 0;

for (const store of batch) {
  if (SKIP_STORES.has(store.store_name)) {
    stats[store.store_name] = { kept: 0, dropped: store.items.length, reason: 'store skipped' };
    continue;
  }

  let kept = 0;
  let dropped = 0;

  for (const item of store.items) {
    const cat = categorize(item);
    if (cat) {
      categorized[cat].push({
        name: item.name,
        brand: item.brand || null,
        price: item.price,
        price_unit: item.price_unit || null,
        original_price: item.original_price || null,
        discount: item.discount || null,
        sale_story: item.sale_story || null,
        image_url: item.image_url || null,
        store: store.store_name,
        sale_start: store.sale_start,
        sale_end: store.sale_end,
      });
      kept++;
      totalKept++;
    } else {
      dropped++;
      totalDropped++;
    }
  }

  stats[store.store_name] = { kept, dropped };
}

// Output
const output = {
  stats,
  totalKept,
  totalDropped,
  categories: categorized,
  categoryCounts: Object.fromEntries(
    Object.entries(categorized).map(([k, v]) => [k, v.length])
  ),
};

writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
console.log(`Written to ${OUTPUT_FILE}`);
console.log(`Total: ${totalKept} kept, ${totalDropped} dropped`);
console.log('\nPer store:');
for (const [store, s] of Object.entries(stats)) {
  console.log(`  ${store}: ${s.kept} kept, ${s.dropped} dropped${s.reason ? ' (' + s.reason + ')' : ''}`);
}
console.log('\nPer category:');
for (const [cat, items] of Object.entries(categorized)) {
  console.log(`  ${cat}: ${items.length}`);
}
