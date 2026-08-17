#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';

const RAW_PATH = '/tmp/eventfinder-flyer-batch-flipp.json';
const OUTPUT_PATH = '/tmp/eventfinder-flyer-curated.json';

// Stores to skip entirely (liquor, duplicate)
const SKIP_STORES = new Set([
  'Co-op Wine Spirits Beer',
  'Sobeys & Safeway Liquor',
  'Sobeys', // duplicate of Safeway
]);

// Stores where we apply aggressive food-only filtering
const AGGRESSIVE_FILTER_STORES = new Set([
  'Canadian Tire',
  'London Drugs',
  'Costco',
  'Shoppers Drug Mart',
]);

// Food keywords for aggressive filtering (only keep if name matches one)
const FOOD_KEYWORDS = [
  'chicken', 'beef', 'pork', 'lamb', 'turkey', 'fish', 'salmon', 'shrimp', 'lobster', 'crab',
  'milk', 'butter', 'egg', 'cheese', 'yogurt', 'cream', 'cottage', 'sour cream',
  'bread', 'bagel', 'bun', 'muffin', 'tortilla', 'croissant', 'loaf',
  'pasta', 'rice', 'flour', 'sugar', 'oil', 'olive', 'sauce', 'tomato', 'soup', 'broth',
  'cereal', 'granola', 'oat', 'nut', 'almond', 'cashew', 'peanut', 'walnut',
  'coffee', 'tea', 'juice', 'water', 'soda', 'pop', 'sparkling',
  'apple', 'banana', 'orange', 'berry', 'strawberry', 'blueberry', 'mango', 'peach', 'pear',
  'potato', 'carrot', 'broccoli', 'spinach', 'lettuce', 'onion', 'pepper', 'tomato',
  'chocolate', 'chip', 'cookie', 'cracker', 'snack', 'popcorn',
  'frozen', 'pizza', 'meal', 'dinner', 'entree',
  'canned', 'beans', 'lentil', 'chickpea', 'pea',
  'dressing', 'mayo', 'mustard', 'ketchup', 'vinegar',
  'jam', 'honey', 'syrup', 'spread',
  'protein', 'bar', 'supplement', 'vitamin',
  'diaper', // actually skip these - but handle below
];

// Skip keywords (non-food / unwanted items)
const SKIP_KEYWORDS = [
  'shampoo', 'conditioner', 'lotion', 'moisturizer', 'sunscreen', 'deodorant', 'toothpaste',
  'toothbrush', 'razor', 'shave', 'hair', 'skin care', 'beauty', 'cosmetic', 'makeup', 'lipstick',
  'nail', 'perfume', 'cologne', 'soap', 'body wash', 'hand wash', 'sanitizer',
  'diaper', 'wipe', 'baby', 'formula', 'infant',
  'pet food', 'dog food', 'cat food', 'dog treat', 'cat treat', 'bird seed', 'litter',
  'toilet paper', 'paper towel', 'tissue', 'napkin', 'plastic bag', 'storage bag', 'wrap',
  'detergent', 'laundry', 'fabric softener', 'dish soap', 'cleaning', 'bleach', 'spray',
  'battery', 'light bulb', 'hardware', 'tool', 'motor oil', 'tire', 'paint',
  'vitamin', 'supplement', 'medication', 'medicine', 'pharmacy', 'drug', 'pill',
  'gift card', 'app', 'digital', 'electronics', 'appliance', 'phone', 'tablet',
  'clothing', 'shirt', 'pants', 'shoes', 'boots', 'jacket', 'sweater',
  'toy', 'game', 'book', 'magazine', 'stationery',
  'air freshener', 'candle', 'home decor', 'furniture',
  'alcohol', 'beer', 'wine', 'spirit', 'liquor', 'vodka', 'rum', 'whisky', 'gin',
  'cooler', 'cider', 'craft beer', 'lager', 'ale',
  'candy', 'gummy', 'licorice', 'halloween', 'easter', 'seasonal chocolate',
];

// Category keyword rules
const CATEGORIES = {
  'Meat & Seafood': [
    'chicken', 'breast', 'thigh', 'wing', 'drumstick', 'beef', 'steak', 'ground beef',
    'pork', 'bacon', 'ham', 'sausage', 'lamb', 'turkey', 'veal',
    'salmon', 'tuna', 'shrimp', 'prawn', 'cod', 'tilapia', 'halibut', 'trout',
    'lobster', 'crab', 'scallop', 'clam', 'mussel', 'oyster',
    'fish', 'seafood', 'filet', 'fillet', 'roast', 'loin', 'rib', 'brisket', 'chop',
  ],
  'Produce': [
    'apple', 'banana', 'orange', 'lemon', 'lime', 'grapefruit', 'mango', 'pineapple',
    'strawberry', 'blueberry', 'raspberry', 'blackberry', 'grape', 'cherry', 'peach',
    'pear', 'plum', 'nectarine', 'apricot', 'kiwi', 'papaya', 'melon', 'watermelon',
    'potato', 'sweet potato', 'yam', 'carrot', 'broccoli', 'cauliflower', 'cabbage',
    'lettuce', 'spinach', 'kale', 'arugula', 'chard', 'celery', 'cucumber', 'zucchini',
    'pepper', 'tomato', 'onion', 'garlic', 'mushroom', 'corn', 'pea', 'bean',
    'asparagus', 'artichoke', 'beet', 'radish', 'fennel', 'eggplant', 'squash',
    'avocado', 'lime', 'herb', 'cilantro', 'parsley', 'basil', 'ginger', 'leek',
    'produce', 'fruit', 'vegetable', 'fresh',
    'scotch bonnet', 'habanero', 'jalapen', 'serrano',
  ],
  'Dairy': [
    'milk', 'butter', 'egg', 'eggs', 'cheese', 'yogurt', 'cream', 'sour cream',
    'cottage cheese', 'ricotta', 'mozzarella', 'cheddar', 'parmesan', 'brie', 'camembert',
    'gorgonzola', 'feta', 'gouda', 'provolone', 'swiss', 'cream cheese', 'whipped cream',
    'half and half', 'heavy cream', 'evaporated milk', 'condensed milk',
    'dairy', 'siggi', 'skyr', 'kefir', 'lactose',
  ],
  'Bakery': [
    'bread', 'bagel', 'bun', 'roll', 'croissant', 'muffin', 'loaf', 'sourdough',
    'baguette', 'pita', 'naan', 'tortilla', 'wrap', 'rye', 'whole wheat', 'white bread',
    'english muffin', 'hot dog bun', 'hamburger bun', 'dinner roll',
    'cake', 'pastry', 'danish', 'scone', 'biscuit', 'flatbread', 'crouton',
    'bakery', 'dough', 'pie crust',
  ],
  'Frozen': [
    'frozen', 'ice cream', 'gelato', 'sorbet', 'frozen yogurt', 'popsicle',
    'frozen pizza', 'frozen meal', 'frozen dinner', 'frozen entree', 'frozen vegetable',
    'frozen fruit', 'frozen fish', 'edamame', 'hash brown', 'french fry', 'waffle',
    'frozen appetizer', 'pot pie', 'burrito', 'lasagna', 'tv dinner',
  ],
  'Pantry': [
    'pasta', 'spaghetti', 'penne', 'fusilli', 'macaroni', 'noodle', 'rice', 'quinoa',
    'flour', 'sugar', 'oil', 'olive oil', 'canola', 'vegetable oil', 'cooking spray',
    'sauce', 'tomato sauce', 'pasta sauce', 'classico', 'pesto', 'marinara', 'alfredo',
    'canned tomato', 'crushed tomato', 'tomato paste', 'diced tomato',
    'soup', 'broth', 'stock', 'bouillon', 'canned', 'beans', 'lentil', 'chickpea',
    'mayo', 'mustard', 'ketchup', 'relish', 'vinegar', 'soy sauce', 'worcestershire',
    'hot sauce', 'salsa', 'hummus', 'tahini', 'peanut butter', 'almond butter', 'jam',
    'honey', 'maple syrup', 'corn syrup', 'molasses', 'chocolate chips',
    'cereal', 'granola', 'oat', 'oatmeal', 'pancake mix', 'waffle mix',
    'chip', 'cracker', 'popcorn', 'pretzel', 'nut', 'almond', 'cashew', 'walnut', 'pecan',
    'que pasa', 'tortilla chip', 'corn chip',
    'chocolate', 'cocoa', 'baking powder', 'baking soda', 'yeast', 'vanilla',
    'spice', 'seasoning', 'salt', 'pepper', 'cumin', 'paprika', 'oregano',
    'dressing', 'ranch', 'caesar', 'balsamic', 'italian dressing',
    'protein bar', 'granola bar', 'energy bar', 'trail mix',
    'no name', 'store brand',
    'swiss delice',
    'balderson',
  ],
  'Beverages': [
    'coffee', 'espresso', 'latte', 'tea', 'herbal tea', 'green tea', 'black tea',
    'juice', 'orange juice', 'apple juice', 'cranberry juice', 'grape juice',
    'water', 'sparkling water', 'mineral water', 'soda', 'pop', 'cola', 'sprite',
    'energy drink', 'sports drink', 'gatorade', 'powerade', 'coconut water',
    'protein shake', 'smoothie', 'lemonade', 'iced tea', 'kombucha',
    'coffee beans', 'ground coffee', 'k-cup', 'nespresso', 'instant coffee',
  ],
};

// Staples from preferences (for priority ranking)
const STAPLES = [
  'chicken thigh', 'chicken thighs', 'boneless skinless',
  'classico', 'tomato sauce', 'pasta sauce',
  'scotch bonnet', 'pepper',
  'milk', 'egg', 'eggs', 'butter',
  "siggi", 'siggi\'s', 'yogurt',
  'gorgonzola',
  'balderson', 'cheddar',
  'swiss delice', 'dark chocolate',
  'que pasa', 'corn chip',
  'no name flour', 'flour',
];

function normalizeStr(s) {
  return (s || '').toLowerCase().trim();
}

function containsAny(str, keywords) {
  const normalized = normalizeStr(str);
  return keywords.some(kw => normalized.includes(kw.toLowerCase()));
}

function categorize(name, brand) {
  const combined = normalizeStr(name) + ' ' + normalizeStr(brand);
  for (const [cat, keywords] of Object.entries(CATEGORIES)) {
    if (containsAny(combined, keywords)) return cat;
  }
  return null;
}

function isStaple(name, brand) {
  const combined = normalizeStr(name) + ' ' + normalizeStr(brand);
  return STAPLES.some(s => combined.includes(s.toLowerCase()));
}

function calcDiscountPct(price, originalPrice) {
  if (!originalPrice || !price) return 0;
  const p = parseFloat(price);
  const op = parseFloat(originalPrice);
  if (!p || !op || op <= p) return 0;
  return Math.round((1 - p / op) * 100);
}

function parsePrice(val) {
  if (!val) return null;
  return String(val).replace(/[^0-9.]/g, '') || null;
}

function main() {
  const raw = JSON.parse(readFileSync(RAW_PATH, 'utf8'));
  const today = new Date().toISOString().slice(0, 10);

  const storeStats = {};

  // Collect all valid food items, with store info
  const allItems = [];

  for (const store of raw) {
    const storeName = store.store_name;
    storeStats[storeName] = { total: store.items.length, kept: 0, dropped: 0 };

    if (SKIP_STORES.has(storeName)) {
      storeStats[storeName].dropped = store.items.length;
      storeStats[storeName].reason = 'store skipped';
      continue;
    }

    const isAggressive = AGGRESSIVE_FILTER_STORES.has(storeName);

    for (const item of store.items) {
      const name = item.name || '';
      const brand = item.brand || '';
      const combined = normalizeStr(name) + ' ' + normalizeStr(brand);

      // Skip items with skip keywords
      if (containsAny(combined, SKIP_KEYWORDS)) {
        storeStats[storeName].dropped++;
        continue;
      }

      // For aggressive-filter stores, only keep if clearly food
      if (isAggressive) {
        const hasFoodKw = FOOD_KEYWORDS.filter(kw => kw !== 'diaper').some(kw => combined.includes(kw.toLowerCase()));
        if (!hasFoodKw) {
          storeStats[storeName].dropped++;
          continue;
        }
      }

      // Must have a price to be useful
      const price = parsePrice(item.price);
      if (!price && !item.discount) {
        storeStats[storeName].dropped++;
        continue;
      }

      const cat = categorize(name, brand);
      if (!cat) {
        storeStats[storeName].dropped++;
        continue;
      }

      const originalPrice = parsePrice(item.original_price);
      const discountPct = item.discount
        ? parseInt(item.discount)
        : calcDiscountPct(price, originalPrice);

      allItems.push({
        store: storeName,
        name: name.trim(),
        brand: brand.trim() || null,
        price: price,
        price_unit: item.price_unit || null,
        original_price: originalPrice,
        discount_pct: discountPct,
        category: cat,
        is_staple: isStaple(name, brand),
        has_original: !!originalPrice,
        sale_start: store.sale_start,
        sale_end: store.sale_end,
        image_url: item.image_url || null,
      });
      storeStats[storeName].kept++;
    }
  }

  // Deduplicate: merge same item across stores (by normalized name keywords)
  // Group by category, then within category deduplicate similar items
  const categories = {};
  for (const cat of Object.keys(CATEGORIES)) {
    categories[cat] = [];
  }

  // Group items by category
  const catGroups = {};
  for (const item of allItems) {
    if (!catGroups[item.category]) catGroups[item.category] = [];
    catGroups[item.category].push(item);
  }

  // For each category: deduplicate across stores, rank, cap
  for (const [cat, items] of Object.entries(catGroups)) {
    // Simple dedup: group by normalized name (first 4 words)
    const nameGroups = {};
    for (const item of items) {
      const key = normalizeStr(item.name).split(/\s+/).slice(0, 4).join(' ');
      if (!nameGroups[key]) nameGroups[key] = [];
      nameGroups[key].push(item);
    }

    const deduped = [];
    for (const [key, group] of Object.entries(nameGroups)) {
      // Pick best price item as primary
      const sorted = group.sort((a, b) => {
        const pa = parseFloat(a.price) || 999;
        const pb = parseFloat(b.price) || 999;
        return pa - pb;
      });
      const primary = sorted[0];
      const alternatives = sorted.slice(1).filter(x => x.store !== primary.store);

      deduped.push({
        ...primary,
        alternatives: alternatives.map(x => ({ store: x.store, price: x.price })),
      });
    }

    // Sort: staples first, then by discount %, then items with original price, then price
    deduped.sort((a, b) => {
      if (a.is_staple && !b.is_staple) return -1;
      if (!a.is_staple && b.is_staple) return 1;
      if (b.discount_pct !== a.discount_pct) return b.discount_pct - a.discount_pct;
      if (a.has_original && !b.has_original) return -1;
      if (!a.has_original && b.has_original) return 1;
      return parseFloat(a.price || 999) - parseFloat(b.price || 999);
    });

    // Cap at 20 items
    categories[cat] = deduped.slice(0, 20);
  }

  // Format output
  const output = {
    date: today,
    categories: {},
  };

  let totalKept = 0;
  for (const [cat, items] of Object.entries(categories)) {
    if (items.length === 0) continue;
    output.categories[cat] = items.map(item => {
      const entry = {
        name: item.name,
        price: formatPrice(item.price, item.price_unit),
        store: item.store,
        is_staple: item.is_staple,
        discount_pct: item.discount_pct || 0,
        sale_start: item.sale_start,
        sale_end: item.sale_end,
        image_url: item.image_url,
      };
      if (item.brand) entry.brand = item.brand;
      if (item.original_price) entry.original_price = `$${item.original_price}`;
      if (item.alternatives && item.alternatives.length > 0) {
        entry.also_at = item.alternatives.map(a => `$${a.price} @ ${a.store}`).join(', ');
      }
      return entry;
    });
    totalKept += items.length;
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));

  // Print summary
  console.log('\n=== Phase 2: Classification Summary ===\n');
  let totalDropped = 0;
  for (const [store, stats] of Object.entries(storeStats)) {
    const reason = stats.reason ? ` (${stats.reason})` : '';
    console.log(`  ${store}: ${stats.kept || 0} kept, ${stats.dropped || stats.total} dropped${reason}`);
    totalDropped += stats.dropped || 0;
  }
  console.log('\n  Per category:');
  for (const [cat, items] of Object.entries(output.categories)) {
    console.log(`    ${cat}: ${items.length} items`);
  }
  console.log(`\n  Total kept: ${totalKept}`);
  console.log(`  Total dropped: ${totalDropped}`);
  console.log(`\nWritten to ${OUTPUT_PATH}`);
}

function formatPrice(price, unit) {
  if (!price) return 'N/A';
  const p = `$${parseFloat(price).toFixed(2)}`;
  return unit ? `${p}/${unit}` : p;
}

main();
