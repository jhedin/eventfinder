#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';

const INPUT = '/tmp/eventfinder-flyer-batch-flipp.json';
const OUTPUT = '/tmp/eventfinder-flyer-curated.json';

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

// User staples (from data/flyer-preferences.md)
const STAPLES = [
  'chicken thigh',
  'classico',
  'scotch bonnet',
  'pepper',
  'milk',
  'egg',
  'butter',
  "siggi",
  'gorgonzola',
  'balderson',
  'swiss delice',
  'que pasa',
  'no name flour',
];

// Keywords to skip (non-food, alcohol, pharmacy, baby, pet)
const SKIP_KEYWORDS = [
  // pharmacy/personal care
  'shampoo', 'conditioner', 'deodorant', 'toothpaste', 'toothbrush', 'mouthwash',
  'vitamin', 'supplement', 'medicine', 'advil', 'tylenol', 'ibuprofen', 'reactine',
  'moisturizer', 'lotion', 'cream', 'sunscreen', 'makeup', 'mascara', 'lipstick',
  'foundation', 'concealer', 'nail', 'hair dye', 'razors', 'feminine', 'tampon',
  'pad ', 'diaper', 'baby wipe', 'baby food', 'formula',
  // pet
  'dog food', 'cat food', 'pet food', 'kitty litter', 'dog treat', 'cat treat',
  'dog toy', 'cat toy',
  // household/non-food
  'paper towel', 'toilet paper', 'tissue', 'laundry', 'detergent', 'dishwasher',
  'garbage bag', 'zip lock', 'plastic bag', 'aluminum foil', 'parchment',
  'cleaning', 'cleaner', 'bleach', 'mop', 'broom', 'sponge',
  // alcohol
  'beer', 'wine', 'spirits', 'whisky', 'vodka', 'rum', 'gin', 'tequila',
  'cider', 'lager', 'ale ', 'stout', 'champagne', 'prosecco', 'liqueur',
  // candy/seasonal chocolate
  'halloween', 'christmas candy', 'easter',
  // non-food misc
  'batteries', 'light bulb', 'extension cord', 'phone', 'tablet', 'laptop',
  'television', 'appliance', 'cookware', 'clothing', 'shoe', 'toy ',
];

// Category classification keywords (order matters — first match wins)
const CATEGORIES = [
  {
    name: 'Meat & Seafood',
    keywords: [
      'chicken', 'beef', 'pork', 'lamb', 'veal', 'turkey', 'duck',
      'salmon', 'tuna', 'shrimp', 'prawn', 'crab', 'lobster', 'scallop',
      'tilapia', 'cod', 'halibut', 'trout', 'mussels', 'clam',
      'steak', 'roast', 'ribs', 'sausage', 'bacon', 'ham', 'pepperoni',
      'ground meat', 'ground beef', 'ground turkey', 'ground pork',
      'seafood', 'fish fillet', 'fish steak', 'meat',
    ],
  },
  {
    name: 'Produce',
    keywords: [
      'apple', 'banana', 'orange', 'grape', 'strawberry', 'blueberry',
      'raspberry', 'mango', 'pineapple', 'watermelon', 'melon', 'peach',
      'nectarine', 'plum', 'cherry', 'lemon', 'lime', 'avocado',
      'tomato', 'cucumber', 'pepper', 'lettuce', 'spinach', 'kale',
      'broccoli', 'cauliflower', 'carrot', 'celery', 'onion', 'garlic',
      'potato', 'yam', 'sweet potato', 'mushroom', 'zucchini', 'squash',
      'green bean', 'corn', 'asparagus', 'arugula', 'cabbage',
      'ginger', 'green onion', 'leek', 'beet', 'radish', 'fennel',
      'fresh herb', 'parsley', 'cilantro', 'basil', 'mint', 'dill',
      'fruit', 'vegetable', 'produce', 'berries',
    ],
  },
  {
    name: 'Dairy',
    keywords: [
      'milk', 'cream', 'butter', 'cheese', 'yogurt', 'egg', 'kefir',
      'sour cream', 'cottage cheese', 'ricotta', 'mozzarella', 'cheddar',
      'brie', 'camembert', 'feta', 'parmesan', 'gouda', 'swiss',
      'gorgonzola', 'blue cheese', 'cream cheese', 'whipping cream',
      'half and half', 'lactose', 'dairy',
    ],
  },
  {
    name: 'Bakery',
    keywords: [
      'bread', 'bun', 'roll', 'bagel', 'croissant', 'muffin', 'cake',
      'cookie', 'cracker', 'tortilla', 'wrap', 'pita', 'naan',
      'baguette', 'sourdough', 'rye bread', 'flour tortilla', 'pastry',
      'donut', 'danish', 'brownie', 'scone', 'biscuit',
    ],
  },
  {
    name: 'Frozen',
    keywords: [
      'frozen', 'ice cream', 'gelato', 'sorbet', 'popsicle', 'pizza',
      'frozen meal', 'frozen dinner', 'frozen vegetable', 'frozen fruit',
      'edamame', 'frozen shrimp', 'frozen chicken', 'frozen beef',
    ],
  },
  {
    name: 'Beverages',
    keywords: [
      'juice', 'coffee', 'tea', 'pop', 'soda', 'sparkling water',
      'water', 'energy drink', 'sports drink', 'smoothie', 'kombucha',
      'hot chocolate', 'almond milk', 'oat milk', 'soy milk', 'coconut milk',
      'lemonade', 'iced tea',
    ],
  },
  {
    name: 'Pantry',
    keywords: [
      'pasta', 'rice', 'noodle', 'soup', 'broth', 'stock', 'sauce',
      'tomato', 'olive oil', 'oil ', 'vinegar', 'spice', 'seasoning',
      'salt', 'pepper', 'flour', 'sugar', 'honey', 'maple syrup',
      'jam', 'peanut butter', 'almond butter', 'nut butter', 'spread',
      'canned', 'chips', 'corn chip', 'crackers', 'granola', 'cereal',
      'oat', 'trail mix', 'nut', 'almond', 'cashew', 'walnut',
      'chocolate', 'cocoa', 'baking', 'yeast', 'baking powder',
      'condiment', 'ketchup', 'mustard', 'mayo', 'relish', 'hot sauce',
      'soy sauce', 'fish sauce', 'oyster sauce', 'sriracha',
      'salsa', 'hummus', 'dip', 'bean', 'lentil', 'chickpea',
      'tuna can', 'sardine', 'anchovy',
    ],
  },
];

function normalizedName(name) {
  return (name || '').toLowerCase();
}

function isStaple(name) {
  const n = normalizedName(name);
  return STAPLES.some(s => n.includes(s));
}

function shouldSkip(name) {
  const n = normalizedName(name);
  return SKIP_KEYWORDS.some(k => n.includes(k));
}

function getCategory(name) {
  const n = normalizedName(name);
  for (const cat of CATEGORIES) {
    if (cat.keywords.some(k => n.includes(k))) {
      return cat.name;
    }
  }
  return null; // uncategorized
}

function parsePrice(price) {
  if (!price) return null;
  const match = String(price).replace(/[^0-9.]/g, '');
  const val = parseFloat(match);
  return isNaN(val) ? null : val;
}

function discountPct(price, originalPrice) {
  const p = parsePrice(price);
  const op = parsePrice(originalPrice);
  if (!p || !op || op <= p) return 0;
  return Math.round(((op - p) / op) * 100);
}

function formatPrice(price) {
  if (!price) return null;
  return String(price).startsWith('$') ? price : '$' + price;
}

const raw = JSON.parse(readFileSync(INPUT, 'utf8'));

const stats = {};
const categoryMap = {};
for (const cat of CATEGORIES) categoryMap[cat.name] = [];

let totalKept = 0;
let totalDropped = 0;

for (const store of raw) {
  const storeName = store.store_name;
  stats[storeName] = { kept: 0, dropped: 0 };

  if (SKIP_STORES.has(storeName)) {
    stats[storeName].dropped = store.items.length;
    totalDropped += store.items.length;
    continue;
  }

  for (const item of store.items) {
    if (!item.name) {
      stats[storeName].dropped++;
      totalDropped++;
      continue;
    }

    // Skip if no price (can't evaluate deal)
    if (!item.price && !item.discount) {
      stats[storeName].dropped++;
      totalDropped++;
      continue;
    }

    // Skip pharmacy, non-food, etc.
    if (shouldSkip(item.name)) {
      stats[storeName].dropped++;
      totalDropped++;
      continue;
    }

    const category = getCategory(item.name);
    if (!category) {
      stats[storeName].dropped++;
      totalDropped++;
      continue;
    }

    const pct = discountPct(item.price, item.original_price) || (item.discount || 0);
    const staple = isStaple(item.name);

    categoryMap[category].push({
      name: item.name,
      brand: item.brand || null,
      price: formatPrice(item.price),
      original_price: item.original_price ? formatPrice(item.original_price) : null,
      discount_pct: pct,
      store: storeName,
      staple,
      sale_start: store.sale_start,
      sale_end: store.sale_end,
      image_url: item.image_url || null,
    });

    stats[storeName].kept++;
    totalKept++;
  }
}

// Dedup: for same item across stores, keep best price, note alternatives
function dedup(items) {
  const byName = {};
  for (const item of items) {
    const key = item.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!byName[key]) {
      byName[key] = { best: item, alts: [] };
    } else {
      const existing = byName[key].best;
      const ep = parsePrice(existing.price);
      const np = parsePrice(item.price);
      if (np !== null && (ep === null || np < ep)) {
        byName[key].alts.push(existing);
        byName[key].best = item;
      } else {
        byName[key].alts.push(item);
      }
    }
  }
  return Object.values(byName).map(({ best, alts }) => {
    if (alts.length > 0) {
      const altStores = alts.map(a => `${a.price} @ ${a.store}`).join(', ');
      return { ...best, also: altStores };
    }
    return best;
  });
}

// Sort: staples first, then discount %, then items with original_price
function rankItems(items) {
  return items.sort((a, b) => {
    if (a.staple && !b.staple) return -1;
    if (!a.staple && b.staple) return 1;
    const ad = a.discount_pct || 0;
    const bd = b.discount_pct || 0;
    if (bd !== ad) return bd - ad;
    const aOrig = a.original_price ? 1 : 0;
    const bOrig = b.original_price ? 1 : 0;
    return bOrig - aOrig;
  });
}

const CAP = 20;
const result = { date: new Date().toISOString().slice(0, 10), categories: {} };

for (const cat of CATEGORIES) {
  let items = dedup(categoryMap[cat.name]);
  items = rankItems(items);
  if (items.length > CAP) items = items.slice(0, CAP);
  if (items.length > 0) {
    result.categories[cat.name] = items;
  }
}

writeFileSync(OUTPUT, JSON.stringify(result, null, 2));

// Print report
console.log('\nPhase 2 Classification Summary:');
for (const [store, s] of Object.entries(stats)) {
  const skipped = SKIP_STORES.has(store) ? ' [SKIPPED - non-food/dupe]' : '';
  console.log(`  ${store}: ${s.kept} kept, ${s.dropped} dropped${skipped}`);
}
console.log(`\nTotal: ${totalKept} kept, ${totalDropped} dropped`);
console.log('\nCategory breakdown:');
for (const [cat, items] of Object.entries(result.categories)) {
  console.log(`  ${cat}: ${items.length} items (${items.filter(i => i.staple).length} staples)`);
}
console.log(`\nWritten to ${OUTPUT}`);
