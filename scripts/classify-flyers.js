#!/usr/bin/env node
/**
 * Classify and curate flyer items from raw Flipp batch data.
 * Reads: /tmp/eventfinder-flyer-batch-flipp.json
 * Writes: /tmp/eventfinder-flyer-curated.json
 */

import { readFileSync, writeFileSync } from 'fs';

const RAW_PATH = '/tmp/eventfinder-flyer-batch-flipp.json';
const OUT_PATH = '/tmp/eventfinder-flyer-curated.json';

// Stores to keep (food grocery stores only)
const KEEP_STORES = new Set([
  'Safeway',
  'Calgary Co-op',
  'Real Canadian Superstore',
  'No Frills',
  'Wholesale Club',
  'T&T Supermarket',
]);

// Staples from preferences — these get priority when on sale
const STAPLES = [
  'chicken thigh', 'boneless skinless', 'classico', 'scotch bonnet',
  'bell pepper', 'jalapeño', 'jalapeno', 'habanero',
  'milk', 'egg', 'butter',
  "siggi", 'siggi\'s', 'plain yogurt',
  'gorgonzola',
  'balderson', 'cheddar',
  'swiss delice', 'dark chocolate',
  'que pasa', 'corn chip',
  'no name flour', 'all-purpose flour',
];

// Non-food keywords to skip regardless of store
const SKIP_KEYWORDS = [
  'vitamin', 'supplement', 'shampoo', 'conditioner', 'lotion',
  'deodorant', 'toothpaste', 'toothbrush', 'razor', 'tampon', 'pad',
  'detergent', 'bleach', 'cleaner', 'dish soap', 'laundry',
  'diaper', 'baby wipe', 'formula', 'baby food',
  'cat food', 'dog food', 'pet treat', 'litter',
  'batteries', 'paper towel', 'toilet paper', 'tissue',
  'garbage bag', 'ziploc', 'plastic wrap', 'foil',
  'flower', 'plant', 'garden', 'candle', 'greeting card',
  'magazine', 'gift card', 'photo', 'electronics',
];

// Category detection by keyword
const CATEGORIES = [
  {
    name: 'Meat & Seafood',
    keywords: [
      'chicken', 'beef', 'pork', 'salmon', 'fish', 'shrimp', 'prawn',
      'steak', 'ham', 'turkey', 'lamb', 'sausage', 'pepperoni', 'bacon',
      'tuna', 'lobster', 'crab', 'scallop', 'mussel', 'oyster',
      'wing', 'brisket', 'rib', 'roast', 'ground beef', 'ground pork',
      'thigh', 'breast', 'drumstick', 'sirloin', 'tenderloin',
      'deli meat', 'cold cut', 'salami', 'chorizo', 'tilapia', 'cod',
      'halibut', 'trout', 'mussels', 'clam', 'sardine', 'anchovy',
      'hot dog', 'wiener', 'burger patty',
    ],
  },
  {
    name: 'Produce',
    keywords: [
      'apple', 'banana', 'pepper', 'tomato', 'onion', 'garlic',
      'lettuce', 'spinach', 'kale', 'broccoli', 'cucumber', 'zucchini',
      'berry', 'strawberry', 'blueberry', 'raspberry', 'blackberry',
      'avocado', 'lemon', 'lime', 'orange', 'grapefruit', 'carrot',
      'celery', 'mushroom', 'grape', 'mango', 'peach', 'nectarine',
      'corn', 'potato', 'sweet potato', 'yam', 'pear', 'plum', 'cherry',
      'melon', 'watermelon', 'cantaloupe', 'cabbage', 'cauliflower',
      'asparagus', 'beet', 'radish', 'fennel', 'herb', 'cilantro',
      'parsley', 'basil', 'dill', 'ginger', 'leek', 'bok choy',
      'snap pea', 'green bean', 'brussel', 'artichoke', 'eggplant',
      'pineapple', 'papaya', 'fig', 'pomegranate', 'coconut', 'lime',
      'romaine', 'arugula', 'mixed greens', 'salad', 'chard',
    ],
  },
  {
    name: 'Dairy',
    keywords: [
      'milk', 'yogurt', 'cheese', 'butter', 'cream', 'sour cream',
      'cottage cheese', 'cheddar', 'mozzarella', 'parmesan', 'gorgonzola',
      'brie', 'feta', 'ricotta', 'gouda', 'havarti', 'swiss cheese',
      'colby', 'marble', 'cream cheese', 'whipping cream', 'half and half',
      'lactose', 'dairy', 'kefir', 'skyr',
    ],
  },
  {
    name: 'Bakery',
    keywords: [
      'bread', 'bagel', 'bun', 'muffin', 'croissant', 'cake',
      'cookie', 'pastry', 'roll', 'loaf', 'tortilla', 'pita',
      'naan', 'biscuit', 'scone', 'doughnut', 'donut', 'pretzel',
      'crumpet', 'english muffin', 'flatbread', 'wrap',
    ],
  },
  {
    name: 'Frozen',
    keywords: [
      'frozen', 'pizza', 'fries', 'nugget', 'waffle', 'edamame',
      'ice cream', 'sorbet', 'gelato', 'popsicle', 'frozen meal',
      'pot pie', 'burrito', 'dumpling', 'pierogi', 'spring roll',
    ],
  },
  {
    name: 'Pantry',
    keywords: [
      'pasta', 'rice', 'flour', 'oil', 'sauce', 'canned', 'soup',
      'broth', 'stock', 'vinegar', 'soy sauce', 'condiment', 'cracker',
      'chip', 'salsa', 'jam', 'honey', 'syrup', 'maple',
      'cereal', 'granola', 'oat', 'oatmeal', 'quinoa', 'lentil',
      'bean', 'chickpea', 'peanut butter', 'almond butter', 'nut butter',
      'chocolate', 'cocoa', 'baking', 'yeast', 'baking powder', 'baking soda',
      'corn chip', 'popcorn', 'pretzel', 'trail mix', 'nut', 'almond',
      'walnut', 'cashew', 'pistachio', 'dried fruit', 'raisin',
      'tomato paste', 'tomato sauce', 'classico', 'ragu', 'coconut milk',
      'olive oil', 'canola oil', 'vegetable oil', 'sesame oil',
      'mustard', 'mayo', 'ketchup', 'relish', 'bbq sauce', 'hot sauce',
      'soy', 'teriyaki', 'worcestershire', 'fish sauce',
      'sugar', 'salt', 'pepper', 'spice', 'seasoning', 'herb',
    ],
  },
  {
    name: 'Beverages',
    keywords: [
      'juice', 'water', 'soda', 'pop', 'sparkling', 'coffee',
      'tea', 'lemonade', 'drink', 'beverage', 'smoothie', 'kombucha',
      'energy drink', 'gatorade', 'powerade', 'coconut water',
    ],
  },
];

function normalize(str) {
  return (str || '').toLowerCase();
}

function isStaple(name, brand) {
  const text = normalize(name) + ' ' + normalize(brand);
  return STAPLES.some(s => text.includes(s));
}

function shouldSkip(name, brand) {
  const text = normalize(name) + ' ' + normalize(brand);
  return SKIP_KEYWORDS.some(k => text.includes(k));
}

function classifyCategory(name, brand) {
  const text = normalize(name) + ' ' + normalize(brand);
  for (const cat of CATEGORIES) {
    if (cat.keywords.some(k => text.includes(k))) {
      return cat.name;
    }
  }
  return null;
}

function formatPrice(price, priceUnit) {
  if (!price) return null;
  const p = parseFloat(price);
  if (isNaN(p)) return price;
  const formatted = `$${p.toFixed(2)}`;
  if (priceUnit) return `${formatted}/${priceUnit}`;
  return formatted;
}

const raw = JSON.parse(readFileSync(RAW_PATH, 'utf8'));

const stats = {};
const categorized = {};
for (const cat of CATEGORIES) categorized[cat.name] = [];

// Track items by (name_key) → array of candidates for cross-store dedup
const crossStore = {};

for (const store of raw) {
  const storeName = store.store_name;

  // Drop excluded stores
  if (!KEEP_STORES.has(storeName)) {
    stats[storeName] = { kept: 0, dropped: store.items.length, reason: 'excluded store' };
    continue;
  }

  let kept = 0, dropped = 0;

  for (const item of store.items) {
    if (!item.name || !item.price) { dropped++; continue; }
    if (shouldSkip(item.name, item.brand)) { dropped++; continue; }

    const category = classifyCategory(item.name, item.brand);
    if (!category) { dropped++; continue; }

    const staple = isStaple(item.name, item.brand);
    const discountPct = item.discount ? Number(item.discount) : 0;

    const entry = {
      name: item.name,
      brand: item.brand || null,
      price: formatPrice(item.price, item.price_unit),
      price_raw: parseFloat(item.price) || 0,
      original_price: item.original_price ? formatPrice(item.original_price, null) : null,
      discount: discountPct,
      store: storeName,
      staple,
      sale_start: store.sale_start,
      sale_end: store.sale_end,
      image_url: item.image_url || null,
      category,
    };

    // Cross-store dedup key: normalized name
    const key = normalize(item.name).replace(/[^a-z0-9]/g, '');
    if (!crossStore[key]) crossStore[key] = [];
    crossStore[key].push(entry);

    kept++;
  }

  stats[storeName] = { kept, dropped };
}

// Resolve cross-store duplicates: keep cheapest, record alternatives
const seen = new Set();
const allItems = [];

for (const [key, candidates] of Object.entries(crossStore)) {
  if (candidates.length === 1) {
    allItems.push(candidates[0]);
  } else {
    // Sort by price ascending
    candidates.sort((a, b) => a.price_raw - b.price_raw);
    const best = { ...candidates[0] };
    const alts = candidates.slice(1).map(c => `${c.store} (${c.price})`);
    if (alts.length) best.alternatives = alts;
    allItems.push(best);
  }
  seen.add(key);
}

// Sort into categories with ranking
for (const item of allItems) {
  categorized[item.category].push(item);
}

// Rank within each category: staples first, then discount%, then price ascending
const CAP = 20;
const result = {};

for (const cat of CATEGORIES) {
  const items = categorized[cat.name];
  items.sort((a, b) => {
    if (a.staple !== b.staple) return b.staple - a.staple; // staples first
    if (b.discount !== a.discount) return b.discount - a.discount; // higher discount
    return a.price_raw - b.price_raw; // lower price
  });
  result[cat.name] = items.slice(0, CAP).map(i => {
    const out = {
      name: i.name,
      price: i.price,
      store: i.store,
    };
    if (i.brand) out.brand = i.brand;
    if (i.original_price) out.original_price = i.original_price;
    if (i.discount) out.discount_pct = i.discount;
    if (i.alternatives) out.also_at = i.alternatives;
    if (i.staple) out.staple = true;
    return out;
  });
}

const curated = {
  date: new Date().toISOString().slice(0, 10),
  categories: result,
};

writeFileSync(OUT_PATH, JSON.stringify(curated, null, 2));

// Summary report
console.log('\n=== Phase 2: Classification Summary ===\n');
let totalKept = 0, totalDropped = 0;
for (const [store, s] of Object.entries(stats)) {
  const reason = s.reason ? ` (${s.reason})` : '';
  console.log(`  ${store}: ${s.kept} kept, ${s.dropped} dropped${reason}`);
  totalKept += s.kept;
  totalDropped += s.dropped;
}
console.log(`\nTotal: ${totalKept} kept, ${totalDropped} dropped`);
console.log('\nPer category:');
for (const cat of CATEGORIES) {
  console.log(`  ${cat.name}: ${result[cat.name].length} items`);
}
console.log(`\nWritten to ${OUT_PATH}`);
