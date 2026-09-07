#!/usr/bin/env node
// Classify and curate raw Flipp flyer data based on user preferences.
import { readFileSync, writeFileSync } from 'fs';

const RAW_PATH = '/tmp/eventfinder-flyer-batch-flipp.json';
const OUT_PATH = '/tmp/eventfinder-flyer-curated.json';

const raw = JSON.parse(readFileSync(RAW_PATH, 'utf8'));

// Skip liquor/beer stores and non-food stores entirely
const SKIP_STORES = new Set([
  'Co-op Wine Spirits Beer',
  'Sobeys & Safeway Liquor',
  'Canadian Tire',
  'London Drugs',
]);

// Sobeys === Safeway (same flyer), drop Sobeys
const DEDUPE_STORE = { 'Sobeys': 'Safeway' };

// Keywords that mark an item as non-food / skip
const SKIP_KEYWORDS = [
  // pharmacy / beauty / personal care
  /tampon|pad\b|liner|kotex|always\s+infinity|pantiliner|condom|contracepti/i,
  /shampoo|conditioner|body\s+wash|soap\s+bar|deodorant|antiperspirant/i,
  /lotion|moisturizer|sunscreen|sunblock|face\s+wash|skin\s+care|serum|toner/i,
  /toothpaste|toothbrush|floss|mouthwash|oral\s+b|colgate|crest|listerine/i,
  /razor|shaving|gillette|schick|venus\b/i,
  /vitamin|supplement|melatonin|probiotic|omega|collagen|biotin|zinc|magnesium/i,
  /advil|tylenol|ibuprofen|acetaminophen|aspirin|naproxen|antacid|tums|rolaids/i,
  /allergy|antihistamine|reactine|claritin|benadryl/i,
  /bandage|band.?aid|tensor|first\s+aid/i,
  /hair\s+dye|hair\s+color|clairol|garnier\s+hair|nice\s+n\s+easy/i,
  /mascara|lipstick|foundation|blush|eyeshadow|concealer|makeup|cosmetic/i,
  /perfume|cologne|fragrance/i,
  /paper\s+towel|toilet\s+paper|tissue|facial\s+tissue|kleenex|scott\s+tow/i,
  /laundry|detergent|tide\b|downy|bounce\b|dryer\s+sheet|fabric\s+softener/i,
  /dish\s+soap|dawn\b|cascade\b|dishwash/i,
  /cleaning|cleaner|lysol|windex|mr\.?\s*clean|febreze|swiffer/i,
  /garbage\s+bag|trash\s+bag|zip\s*loc|storage\s+bag|sandwich\s+bag/i,
  /aluminum\s+foil|plastic\s+wrap|parchment\s+paper/i,
  // baby
  /diaper|pamper|huggies|baby\s+wipe|infant|formula\b|baby\s+food|gerber/i,
  // pet
  /dog\s+food|cat\s+food|pet\s+food|kibble|pedigree|purina|whiskas|friskies/i,
  /dog\s+treat|cat\s+treat|pet\s+treat/i,
  // alcohol
  /beer\b|lager|ale\b|stout|ipa\b|cider\b|wine\b|vodka|whisky|whiskey|rum\b|gin\b|tequila|bourbon|scotch\b|brandy|liqueur|champagne|prosecco|sake/i,
  // non-food general
  /battery|batteries|lightbulb|light\s+bulb|extension\s+cord|power\s+bar/i,
  /garden|fertilizer|potting\s+soil|lawn/i,
  /motor\s+oil|windshield/i,
  /gift\s+card|lottery/i,
];

// Category classification rules (order matters - first match wins)
const CATEGORIES = [
  {
    name: 'Meat & Seafood',
    patterns: [
      /chicken|turkey|duck|cornish/i,
      /beef|steak|brisket|ground\s+beef|sirloin|ribeye|tenderloin|chuck|short\s+rib/i,
      /pork|ham\b|bacon|sausage|chorizo|salami|pepperoni|prosciutto/i,
      /lamb|veal|bison|venison/i,
      /salmon|tuna|cod|tilapia|halibut|shrimp|prawn|crab|lobster|scallop|mussel|clam|oyster/i,
      /seafood|fish\s+fillet|fish\s+stick/i,
    ],
  },
  {
    name: 'Produce',
    patterns: [
      /tomato|pepper|lettuce|spinach|kale|arugula|cabbage|broccoli|cauliflower|brussels/i,
      /carrot|celery|cucumber|zucchini|eggplant|onion|garlic|ginger|leek|asparagus/i,
      /potato|sweet\s+potato|yam|squash|beet|turnip|parsnip/i,
      /apple|banana|orange|lemon|lime|grapefruit|mango|pineapple|peach|plum|pear/i,
      /grape|strawberry|blueberry|raspberry|blackberry|cherry|melon|watermelon/i,
      /avocado|kiwi|pomegranate|fig|date\b|lychee/i,
      /mushroom|corn\b|pea\b|bean\b|green\s+bean|snap\s+pea/i,
      /herb|cilantro|parsley|basil|mint|dill|thyme|rosemary/i,
      /fresh\s+salad|mixed\s+green|baby\s+spinach|romaine/i,
      /scotch\s+bonnet/i,
    ],
  },
  {
    name: 'Dairy',
    patterns: [
      /milk\b|whole\s+milk|skim\s+milk|2%\s+milk|almond\s+milk|oat\s+milk|soy\s+milk/i,
      /butter\b|margarine/i,
      /egg\b|eggs\b/i,
      /cheese|cheddar|mozzarella|parmesan|brie|gouda|feta|gorgonzola|havarti|swiss\s+cheese|cream\s+cheese|ricotta|cottage\s+cheese/i,
      /yogurt|siggi|greek\s+yogurt/i,
      /cream\b|whipping\s+cream|sour\s+cream|half\s+and\s+half|clotted/i,
    ],
  },
  {
    name: 'Bakery',
    patterns: [
      /bread\b|baguette|sourdough|multigrain|whole\s+wheat\s+bread|rye\s+bread/i,
      /bagel|muffin|croissant|scone|danish/i,
      /cake\b|cupcake|donut|doughnut|pastry|tart\b/i,
      /cookie|biscuit\b|cracker\b|wafer/i,
      /flour\b|no\s+name\s+flour/i,
      /tortilla|pita|naan|flatbread|wrap\b/i,
      /cereal|granola|oat\b|oatmeal|porridge/i,
    ],
  },
  {
    name: 'Frozen',
    patterns: [
      /frozen/i,
      /ice\s+cream|gelato|sorbet|sherbet/i,
      /pizza\b|lasagna\b/i,
    ],
  },
  {
    name: 'Pantry',
    patterns: [
      /pasta\b|spaghetti|linguine|penne|rigatoni|fettuccine|noodle/i,
      /rice\b|quinoa|couscous|barley|lentil|chickpea|black\s+bean|kidney\s+bean/i,
      /olive\s+oil|vegetable\s+oil|canola\s+oil|coconut\s+oil/i,
      /tomato\s+sauce|marinara|classico|pasta\s+sauce/i,
      /canned\s+tomato|diced\s+tomato|crushed\s+tomato|tomato\s+paste/i,
      /soup\b|broth|stock\b/i,
      /soy\s+sauce|fish\s+sauce|hot\s+sauce|sriracha|teriyaki|oyster\s+sauce/i,
      /vinegar|mustard|ketchup|mayo|mayonnaise|relish|salsa/i,
      /jam\b|jelly\b|peanut\s+butter|almond\s+butter|nut\s+butter|nutella/i,
      /honey|maple\s+syrup|syrup\b/i,
      /chip\b|chips\b|corn\s+chip|que\s+pasa|tortilla\s+chip|potato\s+chip|nacho/i,
      /chocolate|dark\s+choc|swiss\s+delice|lindt|cocoa/i,
      /coffee|espresso|tea\b|matcha/i,
      /spice|seasoning|pepper\s+corn|cinnamon|cumin|turmeric|paprika/i,
      /salt\b|sugar\b|brown\s+sugar/i,
      /baking\s+powder|baking\s+soda|yeast|vanilla/i,
      /snack\b|granola\s+bar|protein\s+bar/i,
      /nut\b|nuts\b|almond|cashew|walnut|pecan|peanut|pistachio/i,
    ],
  },
  {
    name: 'Beverages',
    patterns: [
      /juice\b|orange\s+juice|apple\s+juice|cranberry\s+juice/i,
      /water\b|sparkling\s+water|mineral\s+water|perrier|san\s+pellegrino/i,
      /soda\b|pop\b|cola\b|pepsi|coca.cola|sprite|ginger\s+ale|7up/i,
      /energy\s+drink|red\s+bull|monster\b/i,
      /kombucha|kefir\b/i,
    ],
  },
];

// Staples list for ranking boost
const STAPLES = [
  /chicken\s+thigh/i,
  /classico/i,
  /scotch\s+bonnet/i,
  /\bpepper\b/i,
  /\bmilk\b/i,
  /\beggs?\b/i,
  /\bbutter\b/i,
  /siggi/i,
  /gorgonzola/i,
  /balderson/i,
  /swiss\s+delice/i,
  /que\s+pasa/i,
  /no\s+name\s+flour/i,
];

function isSkip(name, brand) {
  const text = [name, brand].filter(Boolean).join(' ');
  return SKIP_KEYWORDS.some(re => re.test(text));
}

function classify(name, brand) {
  const text = [name, brand].filter(Boolean).join(' ');
  for (const cat of CATEGORIES) {
    if (cat.patterns.some(re => re.test(text))) return cat.name;
  }
  return null;
}

function isStaple(name, brand) {
  const text = [name, brand].filter(Boolean).join(' ');
  return STAPLES.some(re => re.test(text));
}

function discountPct(item) {
  if (!item.original_price || !item.price) return 0;
  const orig = parseFloat(item.original_price);
  const sale = parseFloat(item.price);
  if (!orig || orig <= sale) return 0;
  return Math.round(((orig - sale) / orig) * 100);
}

function formatPrice(item) {
  let price = item.price ? `$${item.price}` : '';
  if (item.price_unit) price += `/${item.price_unit}`;
  return price;
}

// --- Build a canonical item key for cross-store deduplication ---
function itemKey(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').slice(0, 5).join(' ');
}

// --- Process each store ---
const stats = {};
// key: canonical item key, value: best deal object
const crossStoreMap = {};

const FOOD_STORES = new Set([
  'Shoppers Drug Mart', // only food items pass filter
  'Calgary Co-op',
  'Safeway', // keep; Sobeys dropped
  'Real Canadian Superstore',
  'No Frills',
  'Wholesale Club',
  'T&T Supermarket',
]);

for (const store of raw) {
  const storeName = DEDUPE_STORE[store.store_name] || store.store_name;

  // Skip liquor/non-food stores
  if (SKIP_STORES.has(store.store_name)) {
    stats[store.store_name] = { kept: 0, dropped: store.items.length, reason: 'store skipped' };
    continue;
  }

  // Sobeys is duplicate of Safeway
  if (store.store_name === 'Sobeys') {
    stats['Sobeys'] = { kept: 0, dropped: store.items.length, reason: 'duplicate of Safeway' };
    continue;
  }

  let kept = 0, dropped = 0;

  for (const item of store.items) {
    if (isSkip(item.name, item.brand)) { dropped++; continue; }

    const category = classify(item.name, item.brand);
    if (!category) { dropped++; continue; }

    const key = itemKey(item.name);
    const disc = discountPct(item);
    const staple = isStaple(item.name, item.brand);

    const candidate = {
      name: item.name,
      brand: item.brand || null,
      price: formatPrice(item),
      original_price: item.original_price ? `$${item.original_price}` : null,
      discount_pct: disc,
      store: storeName,
      category,
      staple,
      sale_start: store.sale_start,
      sale_end: store.sale_end,
      image_url: item.image_url || null,
      raw_price: parseFloat(item.price) || 0,
      raw_orig: parseFloat(item.original_price) || 0,
    };

    // Cross-store dedup: keep best price, note alternatives
    if (crossStoreMap[key]) {
      const existing = crossStoreMap[key];
      if (candidate.raw_price < existing.raw_price) {
        candidate.also = `also $${existing.raw_price.toFixed(2)} @ ${existing.store}`;
        crossStoreMap[key] = candidate;
      } else {
        existing.also = existing.also
          ? `${existing.also}, $${candidate.raw_price.toFixed(2)} @ ${candidate.store}`
          : `also $${candidate.raw_price.toFixed(2)} @ ${candidate.store}`;
      }
      kept++;
    } else {
      crossStoreMap[key] = candidate;
      kept++;
    }
  }

  stats[storeName] = (stats[storeName] || { kept: 0, dropped: 0 });
  stats[storeName].kept += kept;
  stats[storeName].dropped += dropped;
}

// --- Sort and cap per category ---
const CATEGORY_ORDER = ['Meat & Seafood', 'Produce', 'Dairy', 'Bakery', 'Frozen', 'Pantry', 'Beverages'];
const CAP = 20;

const byCategory = {};
for (const item of Object.values(crossStoreMap)) {
  if (!byCategory[item.category]) byCategory[item.category] = [];
  byCategory[item.category].push(item);
}

// Rank: staples first, then discount%, then has original price
for (const cat of Object.keys(byCategory)) {
  byCategory[cat].sort((a, b) => {
    if (a.staple !== b.staple) return b.staple - a.staple;
    if (b.discount_pct !== a.discount_pct) return b.discount_pct - a.discount_pct;
    if (!!b.original_price !== !!a.original_price) return !!b.original_price ? 1 : -1;
    return 0;
  });
  byCategory[cat] = byCategory[cat].slice(0, CAP);
}

// Build output (strip internal fields)
const output = {
  date: new Date().toISOString().slice(0, 10),
  categories: {},
};

for (const cat of CATEGORY_ORDER) {
  if (!byCategory[cat] || byCategory[cat].length === 0) continue;
  output.categories[cat] = byCategory[cat].map(item => ({
    name: item.name,
    brand: item.brand,
    price: item.price,
    original_price: item.original_price,
    discount_pct: item.discount_pct || null,
    store: item.store,
    also: item.also || null,
    staple: item.staple || null,
    sale_start: item.sale_start,
    sale_end: item.sale_end,
    image_url: item.image_url,
  }));
}

writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));

// Print stats
console.log('\n=== Classification Stats ===');
for (const [store, s] of Object.entries(stats)) {
  const reason = s.reason ? ` (${s.reason})` : '';
  console.log(`  ${store}: kept ${s.kept}, dropped ${s.dropped}${reason}`);
}

console.log('\n=== Category Totals ===');
let totalKept = 0;
for (const cat of CATEGORY_ORDER) {
  const n = output.categories[cat] ? output.categories[cat].length : 0;
  if (n) { console.log(`  ${cat}: ${n}`); totalKept += n; }
}
console.log(`  TOTAL: ${totalKept} items`);
console.log(`\nWritten to ${OUT_PATH}`);
