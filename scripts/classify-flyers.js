#!/usr/bin/env node
// Classify and curate flyer items based on user preferences
import fs from 'fs';

const RAW_PATH = '/tmp/eventfinder-flyer-batch-flipp.json';
const CURATED_PATH = '/tmp/eventfinder-flyer-curated.json';

const raw = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'));

// Preferences
const STAPLES = [
  'chicken thigh', 'chicken thighs', 'boneless skinless',
  'classico', 'scotch bonnet', 'jalapeño', 'jalapeno', 'bell pepper', 'peppers',
  'milk', 'eggs', 'egg', 'butter',
  "siggi", "siggi's",
  'gorgonzola',
  'balderson', 'balderson\'s',
  'swiss delice', 'dark chocolate',
  'que pasa', 'corn chip',
  'no name flour', 'flour',
];

// Skip categories/keywords
const SKIP_KEYWORDS = [
  'candy', 'lollipop', 'gummy', 'gummies', 'halloween candy',
  'shampoo', 'conditioner', 'lotion', 'deodorant', 'toothpaste', 'toothbrush',
  'mascara', 'lipstick', 'foundation', 'concealer', 'blush', 'eyeliner',
  'diaper', 'diapers', 'baby formula', 'baby food', 'wipes',
  'dog food', 'cat food', 'pet food', 'litter', 'dog treat', 'cat treat',
  'antibiotic', 'ibuprofen', 'acetaminophen', 'advil', 'tylenol', 'vitamins',
  'supplement', 'protein powder',
  'motor oil', 'windshield', 'car', 'tire', 'automotive',
  'drill', 'saw', 'wrench', 'screwdriver', 'hardware',
  'paint', 'caulk', 'spackle',
  'clothing', 'shirt', 'pants', 'socks', 'underwear', 'jacket', 'shoes',
  'furniture', 'lamp', 'rug', 'curtain', 'pillow', 'towel', 'bedding',
  'toy', 'game', 'puzzle', 'lego',
  'cleaning', 'detergent', 'bleach', 'mop', 'broom', 'vacuum',
  'battery', 'batteries', 'charger', 'cable', 'electronics',
  'office', 'printer', 'ink cartridge',
  'garden', 'fertilizer', 'seed', 'plant',
];

// Skip stores for non-food
const MOSTLY_NONFOOD_STORES = ['Canadian Tire', 'London Drugs', 'Wholesale Club'];
// Canadian Tire: mostly hardware/automotive/seasonal
// London Drugs: mostly pharmacy/electronics
// Wholesale Club: mostly bulk, but can have food - be aggressive filtering

// Skip liquor stores entirely
const SKIP_STORES = ['Co-op Wine Spirits Beer', 'Sobeys & Safeway Liquor'];

// Deduplicate Safeway/Sobeys - keep Safeway, skip Sobeys
const DEDUPLICATE_STORE = 'Sobeys'; // drop

// Category mapping
function categorize(name, brand) {
  const text = (name + ' ' + (brand || '')).toLowerCase();

  if (/chicken|beef|pork|lamb|turkey|bison|sausage|bacon|ham|hot dog|wiener|salami|pepperoni|deli meat|steak|roast|rib|chop|tenderloin|ground|shrimp|salmon|tuna|tilapia|cod|halibut|trout|crab|lobster|scallop|mussel|clam|oyster|seafood|fish fillet|meatball/.test(text)) {
    return 'Meat & Seafood';
  }
  if (/apple|banana|orange|grape|berry|blueberry|strawberry|raspberry|cherry|peach|plum|pear|mango|pineapple|watermelon|melon|kiwi|lemon|lime|avocado|tomato|potato|onion|garlic|ginger|carrot|celery|broccoli|cauliflower|cabbage|lettuce|spinach|kale|chard|pepper|cucumber|zucchini|squash|corn|peas|green bean|asparagus|mushroom|herbs|cilantro|parsley|mint|basil|produce|fruit|vegetable|veggie/.test(text)) {
    return 'Produce';
  }
  if (/milk|cream|butter|cheese|yogurt|yoghurt|cottage|sour cream|cream cheese|brie|cheddar|gouda|mozzarella|parmesan|feta|bocconcini|dairy|half.*half/.test(text)) {
    return 'Dairy';
  }
  if (/bread|bun|roll|croissant|bagel|muffin|cake|cookie|pie|pastry|donut|doughnut|tortilla|pita|naan|baguette|loaf|bakery/.test(text)) {
    return 'Bakery';
  }
  if (/frozen|ice cream|gelato|sorbet|frozen meal|frozen pizza|frozen dinner|frozen vegetable|frozen fruit|edamame/.test(text)) {
    return 'Frozen';
  }
  if (/juice|pop|soda|water|sparkling|coffee|tea|energy drink|sport drink|lemonade|kombucha|drink|beverage/.test(text)) {
    return 'Beverages';
  }
  if (/pasta|rice|grain|lentil|bean|chickpea|sauce|salsa|oil|vinegar|spice|seasoning|soup|broth|stock|flour|sugar|salt|baking|cereal|oat|granola|jam|honey|peanut butter|nut butter|chip|cracker|snack|chocolate|candy bar|popcorn|pretzel|nut|almond|cashew|walnut|trail mix|canned|jar|condiment|mustard|ketchup|mayo|pickle|relish|soy sauce|fish sauce|hot sauce/.test(text)) {
    return 'Pantry';
  }
  // Eggs often comes up without other dairy cues
  if (/egg/.test(text)) {
    return 'Dairy';
  }
  return null; // uncategorizable / non-food
}

function isStaple(name, brand) {
  const text = (name + ' ' + (brand || '')).toLowerCase();
  return STAPLES.some(s => text.includes(s.toLowerCase()));
}

function shouldSkip(name, brand) {
  const text = (name + ' ' + (brand || '')).toLowerCase();
  return SKIP_KEYWORDS.some(k => text.includes(k));
}

function isMostlyNonfood(storeName) {
  return MOSTLY_NONFOOD_STORES.includes(storeName);
}

function parsePrice(priceStr) {
  if (!priceStr) return null;
  const m = priceStr.replace(/[$,]/g, '').match(/[\d.]+/);
  return m ? parseFloat(m[0]) : null;
}

function discountPct(price, original) {
  if (!price || !original || original <= price) return 0;
  return Math.round((original - price) / original * 100);
}

// Process each store
const categories = {
  'Meat & Seafood': [],
  'Produce': [],
  'Dairy': [],
  'Bakery': [],
  'Frozen': [],
  'Pantry': [],
  'Beverages': [],
};

const stats = {};
// Track seen items for deduplication across stores: key = normalized name
const seenItems = {}; // key -> {price, store, original_price}

for (const store of raw) {
  const storeName = store.store_name;
  stats[storeName] = { kept: 0, dropped: 0 };

  if (!store.success || !store.items || store.items.length === 0) {
    continue;
  }

  if (SKIP_STORES.includes(storeName)) {
    stats[storeName].dropped = store.items.length;
    continue;
  }
  if (storeName === DEDUPLICATE_STORE) {
    stats[storeName].dropped = store.items.length;
    continue;
  }

  const aggressiveFilter = isMostlyNonfood(storeName);

  for (const item of store.items) {
    const name = item.name || '';
    const brand = item.brand || '';

    if (shouldSkip(name, brand)) {
      stats[storeName].dropped++;
      continue;
    }

    const cat = categorize(name, brand);
    if (!cat) {
      stats[storeName].dropped++;
      continue;
    }

    // For mostly-non-food stores, only keep staples
    if (aggressiveFilter && !isStaple(name, brand)) {
      stats[storeName].dropped++;
      continue;
    }

    const priceVal = parsePrice(item.price);
    const origVal = parsePrice(item.original_price);
    const discount = discountPct(priceVal, origVal);

    const staple = isStaple(name, brand);
    const hasDiscount = origVal && origVal > (priceVal || 0);

    // Deduplication: same item across stores
    const normalizedKey = (name + '|' + brand).toLowerCase().trim();
    if (seenItems[normalizedKey]) {
      const existing = seenItems[normalizedKey];
      if (priceVal && existing.price && priceVal < existing.price) {
        // Better price — update
        existing.alternatives = existing.alternatives || [];
        existing.alternatives.push({ store: existing.store, price: item.original_price || existing.priceStr });
        existing.store = storeName;
        existing.price = priceVal;
        existing.priceStr = item.price;
        existing.original_price = item.original_price;
        existing.discount = discount;
        stats[storeName].kept++;
      } else {
        // Note as alternative
        const ex = seenItems[normalizedKey];
        ex.alternatives = ex.alternatives || [];
        ex.alternatives.push({ store: storeName, price: item.price });
        stats[storeName].dropped++;
      }
      continue;
    }

    const entry = {
      name,
      brand,
      price: item.price,
      original_price: item.original_price || null,
      store: storeName,
      staple,
      discount,
      category: cat,
      sale_start: store.sale_start,
      sale_end: store.sale_end,
      image_url: item.image_url || null,
    };

    seenItems[normalizedKey] = { ...entry, price: priceVal, priceStr: item.price };
    categories[cat].push(entry);
    stats[storeName].kept++;
  }
}

// Cap per category and rank
for (const cat of Object.keys(categories)) {
  categories[cat].sort((a, b) => {
    // Staples first
    if (a.staple && !b.staple) return -1;
    if (!a.staple && b.staple) return 1;
    // Then by discount %
    return b.discount - a.discount;
  });
  // Cap at 15-20
  categories[cat] = categories[cat].slice(0, 18);
}

// Clean up alternatives for display
for (const cat of Object.keys(categories)) {
  for (const item of categories[cat]) {
    if (item.alternatives && item.alternatives.length > 0) {
      const alts = item.alternatives.slice(0, 2).map(a => `${a.price} @ ${a.store}`).join(', ');
      item.name = item.name + ` (also ${alts})`;
    }
    delete item.alternatives;
    delete item.discount_pct;
  }
}

// Remove empty categories
for (const cat of Object.keys(categories)) {
  if (categories[cat].length === 0) delete categories[cat];
}

const result = {
  date: new Date().toISOString().slice(0, 10),
  categories,
};

fs.writeFileSync(CURATED_PATH, JSON.stringify(result, null, 2));

// Print summary
console.log('\nStore stats:');
let totalKept = 0, totalDropped = 0;
for (const [store, s] of Object.entries(stats)) {
  console.log(`  ${store}: kept=${s.kept}, dropped=${s.dropped}`);
  totalKept += s.kept;
  totalDropped += s.dropped;
}
console.log(`\nTotal: kept=${totalKept}, dropped=${totalDropped}`);
console.log('\nCategory totals:');
for (const [cat, items] of Object.entries(result.categories)) {
  console.log(`  ${cat}: ${items.length}`);
}
console.log(`\nWritten to ${CURATED_PATH}`);
