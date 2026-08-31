#!/usr/bin/env node
// Classify raw flyer data into curated deals based on user preferences

import { readFileSync, writeFileSync } from 'fs';

const RAW_PATH = '/tmp/eventfinder-flyer-batch-flipp.json';
const OUT_PATH = '/tmp/eventfinder-flyer-curated.json';

const raw = JSON.parse(readFileSync(RAW_PATH, 'utf8'));

// Preference config
const STAPLES = [
  'chicken thigh', 'classico', 'scotch bonnet', 'bell pepper', 'jalapeño', 'jalapeno',
  'milk', 'eggs', 'butter', "siggi", "siggis", 'gorgonzola', 'balderson', 'swiss delice',
  'que pasa', 'no name flour', 'flour'
];

const SKIP_STORES = new Set(['Co-op Wine Spirits Beer', 'Sobeys & Safeway Liquor', 'Shoppers Drug Mart']);
const DEDUP_DROP = new Set(['Sobeys']); // Keep Safeway

// Non-food keyword patterns for aggressive filtering
const NON_FOOD_PATTERNS = [
  /toilet|paper towel|kleenex|tissue|laundry|detergent|dish soap|cleaner|cleaning|mop|broom|vacuum/i,
  /shampoo|conditioner|body wash|deodorant|toothpaste|toothbrush|razor|shaving|skincare|moisturizer|lotion|sunscreen/i,
  /vitamin|supplement|medication|medicine|pharmacy|allergy|cold & flu|pain relief|tylenol|advil|ibuprofen/i,
  /baby|diaper|formula|infant|wipe|pamper/i,
  /pet food|cat food|dog food|cat litter|dog treat/i,
  /tool|drill|wrench|paint|hardware|lumber|fertilizer|weed|pesticide|lawn/i,
  /tire|automotive|battery|motor oil|windshield/i,
  /clothing|apparel|shoes|socks|underwear|shirt|pants|jacket|coat/i,
  /electronics|laptop|computer|phone|tablet|headphone|speaker|tv|television|camera/i,
  /furniture|mattress|pillow|bedding|towel|bath mat/i,
  /toy|game|book|stationery|office supply/i,
  /candle|home decor|picture frame|storage bin/i,
  /gift card|voucher|coupon/i,
  /bbq|grill|cookware|utensil|knife set|blender|coffee maker|air fryer|instant pot/i,
  /garden|plant pot|soil|mulch/i,
  /alcohol|beer|wine|spirits|cider|liquor|whisky|vodka|rum|gin|tequila|lager|ale/i,
  /candy|chocolate bar|gummy|licorice|halloween|easter/i,
];

// Food category classification
function categorize(name, brand) {
  const text = `${name} ${brand || ''}`.toLowerCase();

  if (/chicken|beef|pork|lamb|turkey|veal|bison|duck|salmon|tuna|shrimp|prawn|tilapia|cod|halibut|trout|crab|lobster|scallop|mussel|clam|squid|anchov|sardine|herring|sausage|bacon|ham|pepperoni|salami|chorizo|steak|rib|wing|drumstick|loin|ground meat|ground turkey|ground chicken/.test(text)) {
    return 'Meat & Seafood';
  }
  if (/apple|banana|orange|lemon|lime|strawberr|blueberr|raspberry|blackberr|mango|pineapple|peach|pear|plum|grape|watermelon|cantaloupe|avocado|tomato|potato|onion|garlic|carrot|broccoli|cauliflower|spinach|lettuce|kale|celery|cucumber|zucchini|pepper|mushroom|corn|pea|bean|asparagus|brussel|sweet potato|yam|beet|radish|cabbage|bok choy|ginger|herbs|cilantro|parsley|basil|arugula|fennel|leek|squash/.test(text)) {
    return 'Produce';
  }
  if (/milk|cream|butter|cheese|yogurt|yoghurt|kefir|cottage cheese|sour cream|whipping cream|half and half|egg/.test(text)) {
    return 'Dairy';
  }
  if (/bread|bun|roll|bagel|muffin|croissant|loaf|baguette|pita|tortilla|naan|wrap|cake|pie|pastry|donut|cookie|cracker|crouton/.test(text)) {
    return 'Bakery';
  }
  if (/frozen|ice cream|gelato|sorbet|popsicle|pizza|lasagna|perogies|edamame|fries|nugget|fish stick|waffle|frozen meal|frozen entree/.test(text)) {
    return 'Frozen';
  }
  if (/pasta|rice|flour|sugar|salt|oil|vinegar|sauce|salsa|hummus|peanut butter|jam|jelly|honey|maple|syrup|ketchup|mustard|mayo|dressing|seasoning|spice|herb|broth|stock|soup|canned|bean|lentil|chickpea|tomato paste|coconut milk|cereal|oat|granola|chip|cracker|nut|seed|popcorn|dried fruit|raisin/.test(text)) {
    return 'Pantry';
  }
  if (/juice|coffee|tea|water|soda|pop|drink|beverage|smoothie|kombucha/.test(text)) {
    return 'Beverages';
  }
  return null;
}

function isNonFood(name, brand) {
  const text = `${name} ${brand || ''}`;
  return NON_FOOD_PATTERNS.some(p => p.test(text));
}

function isStaple(name, brand) {
  const text = `${name} ${brand || ''}`.toLowerCase();
  return STAPLES.some(s => text.includes(s));
}

function discountPct(item) {
  if (item.original_price && item.price) {
    const orig = parseFloat(item.original_price);
    const sale = parseFloat(item.price);
    if (orig > 0 && sale < orig) return Math.round((1 - sale / orig) * 100);
  }
  return 0;
}

// Aggregate by category with dedup across stores
const byCategory = {};
const seen = new Map(); // key -> best item

let dropCount = {};
let keepCount = {};

for (const store of raw) {
  const storeName = store.store_name;
  dropCount[storeName] = 0;
  keepCount[storeName] = 0;

  if (SKIP_STORES.has(storeName) || DEDUP_DROP.has(storeName)) {
    dropCount[storeName] = store.items.length;
    continue;
  }

  for (const item of store.items) {
    if (!item.name || !item.price) { dropCount[storeName]++; continue; }

    if (isNonFood(item.name, item.brand)) { dropCount[storeName]++; continue; }

    const cat = categorize(item.name, item.brand);
    if (!cat) { dropCount[storeName]++; continue; }

    // Dedup: if same item at multiple stores, keep best price
    const dedupeKey = (item.name + (item.brand || '')).toLowerCase().replace(/\s+/g, ' ').trim();
    const existing = seen.get(dedupeKey);
    const thisPct = discountPct(item);

    if (existing) {
      // Track as alternative price mention
      if (parseFloat(item.price) < parseFloat(existing.price)) {
        // This store is cheaper - update primary, keep old as alt
        existing.alts = existing.alts || [];
        existing.alts.push({ store: existing.store, price: existing.price });
        existing.price = item.price;
        existing.original_price = item.original_price || existing.original_price;
        existing.store = storeName === 'Real Canadian Superstore' ? 'Superstore' : storeName;
        existing.image_url = item.image_url || existing.image_url;
        existing.sale_start = store.sale_start;
        existing.sale_end = store.sale_end;
      } else {
        existing.alts = existing.alts || [];
        existing.alts.push({ store: storeName === 'Real Canadian Superstore' ? 'Superstore' : storeName, price: item.price });
      }
      dropCount[storeName]++;
      continue;
    }

    const displayStore = storeName === 'Real Canadian Superstore' ? 'Superstore' : storeName;

    const entry = {
      name: item.name,
      brand: item.brand || null,
      price: item.price,
      price_unit: item.price_unit || null,
      original_price: item.original_price || null,
      discount_pct: thisPct,
      store: displayStore,
      sale_start: store.sale_start,
      sale_end: store.sale_end,
      image_url: item.image_url || null,
      staple: isStaple(item.name, item.brand),
      category: cat,
      alts: [],
    };

    seen.set(dedupeKey, entry);
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(entry);
    keepCount[storeName]++;
  }
}

// Rank items within each category
function rankItems(items) {
  return items.sort((a, b) => {
    if (a.staple !== b.staple) return b.staple - a.staple; // staples first
    return b.discount_pct - a.discount_pct;
  });
}

const CAP = 20;
const curated = { date: '2026-08-31', categories: {} };

for (const [cat, items] of Object.entries(byCategory)) {
  const ranked = rankItems(items).slice(0, CAP);
  curated.categories[cat] = ranked.map(i => {
    const obj = {
      name: i.name,
      price: `$${i.price}${i.price_unit ? `/${i.price_unit}` : ''}`,
      store: i.store,
      staple: i.staple,
      discount_pct: i.discount_pct,
    };
    if (i.original_price) obj.original_price = `$${i.original_price}`;
    if (i.brand) obj.brand = i.brand;
    if (i.alts && i.alts.length > 0) obj.alts = i.alts.map(a => `$${a.price} @ ${a.store === 'Real Canadian Superstore' ? 'Superstore' : a.store}`);
    if (i.sale_start) obj.sale_start = i.sale_start;
    if (i.sale_end) obj.sale_end = i.sale_end;
    if (i.image_url) obj.image_url = i.image_url;
    return obj;
  });
}

writeFileSync(OUT_PATH, JSON.stringify(curated, null, 2));

// Summary
console.log('\n=== Phase 2 Summary ===');
console.log('\nPer-store breakdown:');
for (const store of raw) {
  const k = keepCount[store.store_name] ?? 0;
  const d = dropCount[store.store_name] ?? store.items.length;
  let note = '';
  if (SKIP_STORES.has(store.store_name)) note = ' [skipped - liquor/pharmacy]';
  if (DEDUP_DROP.has(store.store_name)) note = ' [dropped - duplicate of Safeway]';
  console.log(`  ${store.store_name}: kept ${k}, dropped ${d}${note}`);
}

console.log('\nCategory totals:');
let totalKept = 0;
for (const [cat, items] of Object.entries(curated.categories)) {
  console.log(`  ${cat}: ${items.length} items`);
  totalKept += items.length;
}
console.log(`\nTotal curated: ${totalKept} items`);
console.log(`Output: ${OUT_PATH}`);
