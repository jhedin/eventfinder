#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';

const RAW_FILE = '/tmp/eventfinder-flyer-batch-flipp.json';
const OUTPUT_FILE = '/tmp/eventfinder-flyer-curated.json';

// ── Preferences ──────────────────────────────────────────────────────────────

const STAPLES = [
  'chicken thigh', 'boneless skinless',
  'classico', 'tomato sauce', 'pasta sauce',
  'scotch bonnet', 'pepper',
  'milk', 'eggs', 'egg', 'butter',
  "siggi", 'yogurt',
  'gorgonzola',
  'balderson', 'cheddar',
  'swiss delice', 'dark chocolate',
  'que pasa', 'corn chip',
  'no name flour', 'flour',
];

// Keywords that signal non-food / items to skip
const SKIP_KEYWORDS = [
  'pharmacy', 'vitamin', 'supplement', 'medicine', 'medication', 'drug', 'health',
  'beauty', 'cosmetic', 'makeup', 'skincare', 'shampoo', 'conditioner', 'soap',
  'detergent', 'laundry', 'cleaning', 'cleaner', 'bleach', 'dishwash',
  'diaper', 'baby', 'infant', 'toddler', 'formula',
  'pet food', 'dog food', 'cat food', 'pet treat', 'kibble', 'litter',
  'tobacco', 'cigarette',
  'clothing', 'apparel', 'shoe', 'jacket', 'shirt', 'pants', 'dress',
  'tool', 'hardware', 'paint', 'lumber', 'plumbing',
  'electronics', 'appliance', 'blender', 'toaster', 'vacuum', 'television',
  'automotive', 'tire', 'wiper',
  'garden', 'fertilizer', 'pesticide',
  'greeting card', 'gift wrap', 'stationery',
  'moisturizer', 'lotion', 'deodorant', 'toothpaste', 'toothbrush', 'floss',
  'razor', 'shave',
  'bandage', 'first aid', 'antacid', 'cold remedy', 'cough',
  'flower', 'bouquet', 'plant', 'seedling',
  'book', 'magazine',
  'toy', 'game', 'puzzle',
  'candle', 'diffuser',
  'barcode', 'save this', 'friends and family', '% off*',
];

// Stores that are mostly non-food — be aggressive with filtering
const MOSTLY_NONFOOD_STORES = new Set(['Canadian Tire', 'London Drugs', 'Costco', 'Shoppers Drug Mart']);

// Alcohol/liquor stores to skip entirely
const ALCOHOL_STORES = new Set(['Co-op Wine Spirits Beer', 'Sobeys & Safeway Liquor']);

// Categories: keyword → category
const CATEGORY_MAP = [
  ['Meat & Seafood', [
    'chicken', 'beef', 'pork', 'lamb', 'turkey', 'duck', 'veal',
    'salmon', 'tuna', 'shrimp', 'prawn', 'lobster', 'crab', 'cod', 'tilapia', 'halibut',
    'trout', 'mahi', 'scallop', 'clam', 'oyster', 'mussel', 'squid', 'octopus',
    'steak', 'roast', 'rib', 'chop', 'breast', 'thigh', 'wing', 'drumstick',
    'ground beef', 'ground pork', 'ground turkey', 'sausage', 'bacon', 'ham',
    'pepperoni', 'salami', 'deli meat', 'cold cut', 'hot dog', 'wiener',
    'seafood', 'fish', 'filet',
  ]],
  ['Produce', [
    'apple', 'banana', 'orange', 'grape', 'berry', 'strawberry', 'blueberry', 'raspberry',
    'mango', 'pineapple', 'kiwi', 'melon', 'watermelon', 'cantaloupe',
    'peach', 'plum', 'cherry', 'pear', 'lemon', 'lime', 'grapefruit', 'avocado',
    'tomato', 'potato', 'onion', 'garlic', 'carrot', 'celery', 'broccoli',
    'cauliflower', 'cabbage', 'lettuce', 'spinach', 'kale', 'arugula', 'romaine',
    'cucumber', 'zucchini', 'squash', 'eggplant', 'pepper', 'jalapeño', 'habanero',
    'scotch bonnet', 'mushroom', 'corn', 'asparagus', 'green bean', 'pea',
    'sweet potato', 'yam', 'beet', 'radish', 'turnip', 'parsnip',
    'fresh herb', 'cilantro', 'parsley', 'basil', 'mint', 'dill',
    'produce', 'vegetable', 'fruit',
  ]],
  ['Dairy', [
    'milk', 'cream', 'half and half', 'butter', 'margarine', 'egg',
    'cheese', 'cheddar', 'mozzarella', 'parmesan', 'brie', 'camembert', 'gouda',
    'gorgonzola', 'feta', 'ricotta', 'cottage cheese', 'cream cheese',
    'yogurt', 'sour cream', 'whipping cream', 'condensed milk',
    'dairy', 'lactose',
  ]],
  ['Bakery', [
    'bread', 'bun', 'bagel', 'muffin', 'croissant', 'baguette', 'loaf',
    'tortilla', 'wrap', 'pita', 'naan', 'roti',
    'cake', 'cookie', 'brownie', 'pastry', 'donut', 'danish',
    'pie crust', 'tart',
    'bakery', 'baked good',
  ]],
  ['Frozen', [
    'frozen', 'ice cream', 'gelato', 'sorbet', 'popsicle',
    'frozen pizza', 'frozen meal', 'frozen dinner', 'frozen vegetable',
    'frozen fruit', 'frozen fries', 'frozen breakfast',
    'waffles', 'french toast sticks',
  ]],
  ['Pantry', [
    'pasta', 'noodle', 'rice', 'quinoa', 'couscous', 'lentil', 'bean', 'chickpea',
    'flour', 'sugar', 'baking powder', 'baking soda', 'yeast',
    'olive oil', 'vegetable oil', 'canola oil', 'coconut oil',
    'vinegar', 'soy sauce', 'hot sauce', 'salsa', 'ketchup', 'mustard', 'mayonnaise',
    'tomato sauce', 'pasta sauce', 'classico', 'marinara', 'pesto',
    'canned tomato', 'canned bean', 'canned tuna', 'canned salmon', 'canned corn',
    'soup', 'broth', 'stock', 'bouillon',
    'cereal', 'oatmeal', 'granola', 'oat',
    'peanut butter', 'almond butter', 'jam', 'jelly', 'honey', 'maple syrup',
    'chocolate', 'cocoa', 'dark chocolate',
    'chip', 'cracker', 'popcorn', 'pretzel', 'nut', 'almond', 'cashew', 'walnut',
    'trail mix', 'dried fruit', 'raisin',
    'spice', 'seasoning', 'herb', 'salt', 'pepper',
    'tea', 'coffee',
    'corn chip', 'que pasa',
  ]],
  ['Beverages', [
    'juice', 'orange juice', 'apple juice', 'cranberry juice',
    'water', 'sparkling water', 'soda', 'pop', 'cola', 'ginger ale', 'lemonade',
    'kombucha', 'energy drink',
    'coffee', 'tea', 'hot chocolate',
    'smoothie', 'protein shake',
    'beverage', 'drink',
  ]],
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function lc(s) { return (s || '').toLowerCase(); }

function isSkip(item, store) {
  const text = lc(item.name) + ' ' + lc(item.brand);

  // Items with no price and no discount are usually banners/ads
  if (!item.price && !item.discount && !item.original_price) return true;

  // Skip keywords
  for (const kw of SKIP_KEYWORDS) {
    if (text.includes(kw)) return true;
  }

  // For mostly-non-food stores, require an explicit food keyword to keep
  if (MOSTLY_NONFOOD_STORES.has(store)) {
    const FOOD_KEYWORDS = [
      'chicken', 'beef', 'pork', 'fish', 'salmon', 'shrimp', 'tuna', 'crab',
      'milk', 'egg', 'butter', 'cheese', 'yogurt', 'cream',
      'bread', 'pasta', 'rice', 'flour', 'sugar',
      'fruit', 'vegetable', 'produce', 'apple', 'banana', 'orange', 'berry',
      'tomato', 'potato', 'onion', 'carrot', 'pepper',
      'soup', 'sauce', 'juice', 'cereal', 'coffee', 'tea',
      'chocolate', 'chip', 'cracker', 'nut', 'olive oil',
    ];
    if (!FOOD_KEYWORDS.some(kw => text.includes(kw))) return true;
  }

  return false;
}

function categorize(item) {
  const text = lc(item.name) + ' ' + lc(item.brand);
  for (const [cat, keywords] of CATEGORY_MAP) {
    if (keywords.some(kw => text.includes(kw))) return cat;
  }
  return null; // uncategorized — will be dropped
}

function isStaple(item) {
  const text = lc(item.name) + ' ' + lc(item.brand);
  return STAPLES.some(kw => text.includes(kw));
}

function discountPct(item) {
  if (item.discount) return item.discount; // already a percentage
  if (item.original_price && item.price) {
    const orig = parseFloat(item.original_price);
    const sale = parseFloat(item.price);
    if (orig > 0 && sale < orig) return Math.round((1 - sale / orig) * 100);
  }
  return 0;
}

function formatPrice(item) {
  if (!item.price) return item.discount ? `${item.discount}% off` : '?';
  const unit = item.price_unit ? `/${item.price_unit}` : '';
  return `$${parseFloat(item.price).toFixed(2)}${unit}`;
}

function formatOriginal(item) {
  if (!item.original_price) return null;
  return `$${parseFloat(item.original_price).toFixed(2)}`;
}

function score(item) {
  let s = 0;
  if (isStaple(item)) s += 1000;
  s += discountPct(item) * 10;
  if (item.original_price) s += 50; // visible savings = bonus
  return s;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const raw = JSON.parse(readFileSync(RAW_FILE, 'utf8'));

// Merge Sobeys into Safeway (same company, identical flyers — keep Safeway)
const processed = raw.filter(s => !ALCOHOL_STORES.has(s.store_name));
const sobeysStore = processed.find(s => s.store_name === 'Sobeys');
const safewayStore = processed.find(s => s.store_name === 'Safeway');
// Mark Sobeys items to drop
const stores = processed.filter(s => s.store_name !== 'Sobeys');

const stats = {};
// Track items we've seen (deduplicate same item across stores)
// Key: normalized name. Value: best deal seen so far.
const seenItems = new Map(); // normalized name → { item, store, category }

for (const store of stores) {
  const storeName = store.store_name;
  stats[storeName] = { kept: 0, dropped: 0 };

  for (const item of store.items) {
    if (isSkip(item, storeName)) {
      stats[storeName].dropped++;
      continue;
    }
    const cat = categorize(item);
    if (!cat) {
      stats[storeName].dropped++;
      continue;
    }

    // Cross-store deduplication: same item — keep best price
    const key = lc(item.name).replace(/\s+/g, ' ').trim();
    const existing = seenItems.get(key);
    if (existing) {
      const existingPrice = parseFloat(existing.item.price) || Infinity;
      const newPrice = parseFloat(item.price) || Infinity;
      if (newPrice < existingPrice) {
        // Update with better deal, note alternative store
        if (!existing.alsoAt) existing.alsoAt = [];
        existing.alsoAt.push({ store: existing.store, price: existing.item.price });
        existing.item = item;
        existing.store = storeName;
      } else {
        if (!existing.alsoAt) existing.alsoAt = [];
        existing.alsoAt.push({ store: storeName, price: item.price });
      }
      stats[storeName].dropped++; // counted as dedup'd
      continue;
    }

    seenItems.set(key, { item, store: storeName, category: cat, alsoAt: [] });
    stats[storeName].kept++;
  }
}

// Add Sobeys items only if no Safeway equivalent exists
if (sobeysStore) {
  stats['Sobeys (deduped into Safeway)'] = { kept: 0, dropped: 0 };
  for (const item of sobeysStore.items) {
    if (isSkip(item, 'Sobeys')) { stats['Sobeys (deduped into Safeway)'].dropped++; continue; }
    const cat = categorize(item);
    if (!cat) { stats['Sobeys (deduped into Safeway)'].dropped++; continue; }
    const key = lc(item.name).replace(/\s+/g, ' ').trim();
    if (!seenItems.has(key)) {
      seenItems.set(key, { item, store: 'Safeway', category: cat, alsoAt: [] });
      stats['Sobeys (deduped into Safeway)'].kept++;
    } else {
      stats['Sobeys (deduped into Safeway)'].dropped++;
    }
  }
}

// Group by category, rank, and cap
const byCategory = {};
for (const [, entry] of seenItems) {
  const cat = entry.category;
  if (!byCategory[cat]) byCategory[cat] = [];
  byCategory[cat].push(entry);
}

const CAP = 20;
const result = { date: new Date().toISOString().slice(0, 10), categories: {} };

for (const [cat, items] of Object.entries(byCategory)) {
  items.sort((a, b) => score(b.item) - score(a.item));
  const top = items.slice(0, CAP);
  result.categories[cat] = top.map(entry => {
    const obj = {
      name: entry.item.name,
      price: formatPrice(entry.item),
      store: entry.store,
    };
    const orig = formatOriginal(entry.item);
    if (orig) obj.original_price = orig;
    const disc = discountPct(entry.item);
    if (disc) obj.discount_pct = disc;
    if (entry.item.brand) obj.brand = entry.item.brand;
    if (entry.alsoAt && entry.alsoAt.length) {
      obj.also_at = entry.alsoAt.filter(a => a.price).map(a => `${a.store} ($${parseFloat(a.price).toFixed(2)})`);
    }
    obj._staple = isStaple(entry.item);
    return obj;
  });
}

writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));

// ── Report ────────────────────────────────────────────────────────────────────
console.log('\nPhase 2 — Classification Stats\n');
let totalKept = 0, totalDropped = 0;
for (const [store, s] of Object.entries(stats)) {
  console.log(`  ${store}: kept ${s.kept}, dropped ${s.dropped}`);
  totalKept += s.kept;
  totalDropped += s.dropped;
}
console.log(`\nTotal: ${totalKept} kept, ${totalDropped} dropped`);
console.log('\nCategory counts:');
for (const [cat, items] of Object.entries(result.categories)) {
  const staples = items.filter(i => i._staple).length;
  console.log(`  ${cat}: ${items.length} items (${staples} staples)`);
}
console.log(`\nWritten to ${OUTPUT_FILE}`);
