#!/usr/bin/env node
/**
 * Classify and curate raw flyer items from fetch-flipp-flyers output.
 * Reads: /tmp/eventfinder-flyer-batch-flipp.json
 * Writes: /tmp/eventfinder-flyer-curated.json
 */

import fs from 'fs';

const RAW_PATH = '/tmp/eventfinder-flyer-batch-flipp.json';
const OUT_PATH = '/tmp/eventfinder-flyer-curated.json';

// ── Preferences ──────────────────────────────────────────────────────────────

const STAPLES = [
  'chicken thigh', 'classico', 'scotch bonnet', 'bell pepper', 'pepper',
  'milk', 'egg', 'butter', "siggi", 'gorgonzola', 'balderson', 'cheddar',
  'swiss delice', 'que pasa', 'corn chip', 'no name flour', 'flour',
];

// Stores to skip entirely (liquor only)
const SKIP_STORES = ['co-op wine spirits beer', 'sobeys & safeway liquor'];

// Sobeys deduplication: drop Sobeys, keep Safeway
const SOBEYS_ALIAS = 'safeway';
const SOBEYS_DROP = 'sobeys';

// Keywords that indicate non-food / skip items
const SKIP_KEYWORDS = [
  'pharmacy', 'vitamin', 'supplement', 'beauty', 'mascara', 'lipstick',
  'shampoo', 'conditioner', 'deodorant', 'toothpaste', 'toothbrush',
  'razor', 'tampon', 'pad ', 'diaper', 'baby ', 'infant', 'formula ',
  'pet food', 'dog food', 'cat food', 'litter', 'floss', 'mouthwash',
  'greeting card', 'photo ', 'battery', 'batteries', 'motor oil',
  'tire ', 'tool ', 'drill ', 'paint ', 'wrench', 'hardware', 'automotive',
  'clothing', 'apparel', 'shoe', 'toy', 'game ', 'dvd', 'blu-ray',
  'printer', 'laptop', 'tablet', 'phone ', 'headphone', 'speaker ',
  'candle', 'décor', 'decor', 'pillow', 'bedding', 'towel', 'laundry',
  'dish soap', 'cleaner', 'garbage bag', 'paper towel', 'toilet paper',
  'hand wash', 'hand soap', 'sanitizer', 'bleach', 'fabric',
  // Canadian Tire / London Drugs non-food
  'motor', 'oil change', 'wiper blade', 'antifreeze',
  // Alcohol (unless in a grocery flyer as general food section)
  'wine ', 'beer ', 'spirits', 'whisky', 'vodka', 'rum ', 'gin ',
  'liqueur', 'champagne', 'prosecco', 'cider (beer)', 'ale ', 'lager ',
];

// Mostly-non-food stores — be aggressive about skipping non-food
const NON_FOOD_STORES = ['canadian tire', 'london drugs', 'shoppers drug mart', 'wholesale club'];

// ── Category mapping ──────────────────────────────────────────────────────────

const CATEGORIES = {
  'Meat & Seafood': [
    'chicken', 'beef', 'pork', 'turkey', 'lamb', 'veal', 'bison', 'duck',
    'salmon', 'shrimp', 'prawn', 'tuna', 'tilapia', 'cod', 'halibut', 'trout',
    'crab', 'lobster', 'scallop', 'oyster', 'clam', 'mussels',
    'bacon', 'ham ', 'sausage', 'hot dog', 'pepperoni', 'salami', 'prosciutto',
    'ground ', 'steak', 'roast ', 'ribs', 'tenderloin', 'brisket', 'fillet',
    'seafood', 'fish ',
  ],
  'Produce': [
    'apple', 'banana', 'orange', 'grape', 'strawberr', 'blueberr', 'raspberr',
    'blackberr', 'mango', 'pineapple', 'melon', 'watermelon', 'peach', 'pear',
    'plum', 'cherry', 'kiwi', 'avocado', 'lemon', 'lime', 'grapefruit',
    'tomato', 'potato', 'onion', 'garlic', 'carrot', 'broccoli', 'cauliflower',
    'lettuce', 'spinach', 'kale', 'cabbage', 'celery', 'cucumber', 'zucchini',
    'pepper', 'mushroom', 'corn ', 'pea ', 'bean ', 'asparagus', 'artichoke',
    'eggplant', 'squash', 'beet', 'turnip', 'parsnip', 'radish', 'fennel',
    'ginger', 'herb', 'cilantro', 'parsley', 'basil', 'mint',
    'fruit', 'vegetable', 'veggie', 'salad', 'greens',
  ],
  'Dairy': [
    'milk', 'butter', 'cream', 'cheese', 'yogurt', 'yoghurt', 'sour cream',
    'cottage cheese', 'cream cheese', 'mozzarella', 'cheddar', 'parmesan',
    'brie', 'gouda', 'feta', 'gorgonzola', 'bocconcini', 'ricotta',
    'half and half', 'whipping cream', 'egg', 'margarine',
  ],
  'Bakery': [
    'bread', 'bagel', 'bun ', 'buns', 'roll ', 'rolls', 'muffin', 'croissant',
    'pita', 'tortilla', 'wrap ', 'naan', 'flatbread', 'english muffin',
    'cake', 'pie', 'pastry', 'donut', 'doughnut', 'cookie', 'cracker',
    'brownie', 'waffle', 'pancake mix',
  ],
  'Frozen': [
    'frozen', 'ice cream', 'gelato', 'sorbet', 'popsicle', 'pizza ',
  ],
  'Pantry': [
    'pasta', 'noodle', 'rice ', 'rice,', 'flour', 'sugar', 'salt ', 'pepper ',
    'oil ', 'olive oil', 'canola', 'vinegar', 'sauce', 'ketchup', 'mustard',
    'mayonnaise', 'salsa', 'hummus', 'peanut butter', 'almond butter', 'jam ',
    'honey', 'maple syrup', 'syrup', 'canned tomato', 'tomato paste',
    'tomato sauce', 'classico', 'broth', 'stock ', 'soup ', 'beans ',
    'lentil', 'chickpea', 'tuna can', 'sardine', 'anchovy', 'cereal',
    'granola', 'oat', 'granola bar', 'cracker', 'chip', 'popcorn',
    'nuts ', 'almonds', 'cashews', 'walnuts', 'trail mix', 'dried fruit',
    'chocolate', 'cocoa', 'coffee', 'tea ', 'spice', 'seasoning', 'herb ',
    'baking powder', 'baking soda', 'yeast', 'vanilla', 'bouillon',
    'condiment', 'dressing', 'spread', 'butter', 'ghee', 'lard',
  ],
  'Beverages': [
    'juice', 'water ', 'sparkling water', 'soda', 'pop ', 'cola', 'ginger ale',
    'energy drink', 'sports drink', 'iced tea', 'lemonade', 'smoothie',
    'coffee', 'tea ', 'kombucha', 'coconut water', 'drink ', 'beverage',
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalize(s) {
  return (s || '').toLowerCase().trim();
}

function matchesAny(text, keywords) {
  const n = normalize(text);
  return keywords.some(k => n.includes(k));
}

function isSkipItem(item, storeName) {
  const text = normalize(item.name) + ' ' + normalize(item.brand);

  // Skip if matches skip keywords
  if (matchesAny(text, SKIP_KEYWORDS)) return true;

  // For non-food stores, only keep items that clearly match food categories
  if (NON_FOOD_STORES.some(s => storeName.toLowerCase().includes(s))) {
    const isFood = Object.values(CATEGORIES).some(kws => matchesAny(text, kws));
    if (!isFood) return true;
  }

  return false;
}

function categorize(item) {
  const text = normalize(item.name) + ' ' + normalize(item.brand);
  for (const [cat, kws] of Object.entries(CATEGORIES)) {
    if (matchesAny(text, kws)) return cat;
  }
  return null; // uncategorized → skip
}

function isStaple(item) {
  const text = normalize(item.name) + ' ' + normalize(item.brand);
  return STAPLES.some(s => text.includes(s));
}

function discountPct(item) {
  if (!item.original_price || !item.price) return 0;
  const orig = parseFloat(item.original_price);
  const sale = parseFloat(item.price);
  if (!orig || !sale || orig <= sale) return 0;
  return Math.round((1 - sale / orig) * 100);
}

function formatPrice(item) {
  const p = item.price ? `$${parseFloat(item.price).toFixed(2)}` : null;
  if (item.price_unit) return p ? `${p}/${item.price_unit}` : null;
  return p;
}

function formatOriginal(item) {
  if (!item.original_price) return null;
  return `$${parseFloat(item.original_price).toFixed(2)}`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const raw = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'));
const stores = Object.values(raw);

const stats = {}; // per-store kept/dropped counts
const byCategory = {}; // category → items[]
for (const cat of Object.keys(CATEGORIES)) byCategory[cat] = [];

// Track item deduplication across stores (best-price wins)
// Key: normalize(name), value: {item, store, discountPct}
const seen = new Map();

// Process Safeway first so it "wins" over Sobeys
const ordered = [...stores].sort((a, b) => {
  if (normalize(a.store_name) === 'safeway') return -1;
  if (normalize(b.store_name) === 'safeway') return 1;
  return 0;
});

for (const store of ordered) {
  if (!store.success || !store.items) continue;
  const storeName = store.store_name;
  const storeKey = normalize(storeName);

  // Skip liquor stores
  if (SKIP_STORES.some(s => storeKey.includes(s.toLowerCase()))) continue;

  // Drop Sobeys (duplicate of Safeway)
  if (storeKey === SOBEYS_DROP) continue;

  stats[storeName] = { kept: 0, dropped: 0 };

  for (const item of store.items) {
    if (isSkipItem(item, storeName)) {
      stats[storeName].dropped++;
      continue;
    }

    const cat = categorize(item);
    if (!cat) {
      stats[storeName].dropped++;
      continue;
    }

    const key = normalize(item.name);
    const dpct = discountPct(item);
    const price = parseFloat(item.price) || 999;

    // Dedup: keep best price, track alternatives
    if (seen.has(key)) {
      const existing = seen.get(key);
      const existingPrice = parseFloat(existing.item.price) || 999;

      if (price < existingPrice) {
        // Current store has better price — update, note alternative
        if (!existing.alts) existing.alts = [];
        existing.alts.push({ store: existing.store, price: existing.item.price, price_unit: existing.item.price_unit });
        existing.item = item;
        existing.store = storeName;
        existing.saleStart = store.sale_start;
        existing.saleEnd = store.sale_end;
        existing.discountPct = dpct;
      } else {
        // Existing is cheaper — just note as alternative
        if (!existing.alts) existing.alts = [];
        existing.alts.push({ store: storeName, price: item.price, price_unit: item.price_unit });
      }
      stats[storeName].dropped++;
      continue;
    }

    const entry = {
      item,
      store: storeName,
      category: cat,
      saleStart: store.sale_start,
      saleEnd: store.sale_end,
      discountPct: dpct,
      staple: isStaple(item),
      alts: [],
    };
    seen.set(key, entry);
    byCategory[cat].push(entry);
    stats[storeName].kept++;
  }
}

// Cap per category at 20, prioritized: staples first, then discount %, then general food items
const CAP = 20;
const curated = {};

for (const [cat, items] of Object.entries(byCategory)) {
  const sorted = [...items].sort((a, b) => {
    if (a.staple !== b.staple) return b.staple ? 1 : -1;
    return b.discountPct - a.discountPct;
  });
  curated[cat] = sorted.slice(0, CAP).map(entry => {
    const out = {
      name: entry.item.name,
      price: formatPrice(entry.item),
      store: entry.store,
    };
    if (entry.item.brand) out.brand = entry.item.brand;
    if (entry.item.original_price) out.original_price = formatOriginal(entry.item);
    if (entry.discountPct > 0) out.discount_pct = entry.discountPct;
    if (entry.staple) out.staple = true;
    if (entry.alts && entry.alts.length > 0) {
      out.also_at = entry.alts.map(a => {
        const p = a.price ? `$${parseFloat(a.price).toFixed(2)}${a.price_unit ? '/' + a.price_unit : ''}` : '?';
        return `${a.store} ${p}`;
      }).join(', ');
    }
    return out;
  });
}

// Remove empty categories
for (const cat of Object.keys(curated)) {
  if (curated[cat].length === 0) delete curated[cat];
}

const output = {
  date: new Date().toISOString().slice(0, 10),
  categories: curated,
};

fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));

// Print stats
let totalKept = 0, totalDropped = 0;
console.log('\nPer-store stats:');
for (const [store, s] of Object.entries(stats)) {
  console.log(`  ${store}: kept ${s.kept}, dropped ${s.dropped}`);
  totalKept += s.kept;
  totalDropped += s.dropped;
}

console.log('\nPer-category counts:');
for (const [cat, items] of Object.entries(curated)) {
  console.log(`  ${cat}: ${items.length} items`);
}

console.log(`\nTotal kept: ${totalKept}, dropped: ${totalDropped}`);
console.log(`Written to ${OUT_PATH}`);
