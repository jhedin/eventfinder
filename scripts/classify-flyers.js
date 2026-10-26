// Phase 2: Classify flyer items
// Reads /tmp/eventfinder-flyer-batch-flipp.json → writes /tmp/eventfinder-flyer-curated.json

import { readFileSync, writeFileSync } from 'fs';

const RAW_PATH = '/tmp/eventfinder-flyer-batch-flipp.json';
const OUT_PATH = '/tmp/eventfinder-flyer-curated.json';

const rawData = JSON.parse(readFileSync(RAW_PATH, 'utf8'));

// Stores to skip entirely (non-food or alcohol)
const SKIP_STORES = new Set([
  'Canadian Tire',
  'London Drugs',
  'Shoppers Drug Mart',
  'Co-op Wine Spirits Beer',
  'Sobeys & Safeway Liquor',
  'Costco', // no flyer this week
]);

// Deduplicate: Safeway and Sobeys are same company - drop Sobeys
const SOBEYS_ALIAS = 'Sobeys';

// Keywords that indicate non-food items to filter out
const SKIP_KEYWORDS = [
  // Personal care / pharmacy
  'deodorant', 'antiperspirant', 'shampoo', 'conditioner', 'toothpaste', 'toothbrush',
  'razor', 'feminine', 'tampon', 'pad ', 'diaper', 'baby wipe', 'sunscreen',
  'vitamin', 'supplement', 'capsule', 'tablet', 'ibuprofen', 'advil', 'tylenol',
  'cold & sinus', 'pain relief', 'pharmacy', 'bandage', 'first aid',
  // Household / non-food
  'bathroom tissue', 'toilet paper', 'paper towel', 'dish soap', 'dishwashing',
  'laundry', 'detergent', 'fabric softener', 'cleaning', 'cleaner', 'lysol',
  'garbage bag', 'ziploc', 'plastic bag', 'candle', 'air freshener',
  // Pet
  'cat food', 'dog food', 'pet food', 'purina', 'friskies', 'fancy feast',
  'kibble', 'pet treat', 'litter',
  // Baby
  'baby food', 'formula', 'infant',
  // Toys / non-food general
  'toy', 'puzzle', 'nerf', 'blaster', 'hot wheels', 'spiderman', 'transformer',
  'figurine', 'plush', 'keyring', 'game ', 'puzzle',
  // Seasonal/non-food promo
  'treat bag', 'halloween bag', 'reflective',
  // Alcohol
  'wine', 'beer', 'spirit', 'vodka', 'whisky', 'whiskey', 'rum ', 'gin ',
  'cider', 'lager', 'ale ', 'corona', 'heineken', 'budweiser',
  // Health/beauty
  'serum', 'moisturizer', 'mascara', 'lipstick', 'foundation', 'concealer',
  'eyeliner', 'eyeshadow', 'blush', 'bronzer',
  // Promo/non-item
  'bonus cash', 'challenge', 'discover the best', 'phar more', 'support',
  'gift card', 'gc ', 'photo',
];

// Category classification keywords
const CATEGORY_RULES = [
  {
    category: 'Meat & Seafood',
    keywords: [
      'chicken', 'beef', 'pork', 'lamb', 'veal', 'turkey', 'duck', 'bison',
      'salmon', 'shrimp', 'prawn', 'tilapia', 'halibut', 'cod', 'tuna', 'crab',
      'lobster', 'scallop', 'mussel', 'oyster', 'fish', 'seafood', 'meat',
      'steak', 'roast', 'ribs', 'wing', 'breast', 'thigh', 'drumstick',
      'ground beef', 'ground turkey', 'sausage', 'bacon', 'ham', 'deli',
      'pepperoni', 'salami', 'chorizo', 'hotdog', 'wiener',
    ],
  },
  {
    category: 'Produce',
    keywords: [
      'apple', 'banana', 'orange', 'strawberry', 'blueberry', 'raspberry', 'blackberry',
      'grape', 'melon', 'watermelon', 'pineapple', 'mango', 'peach', 'pear', 'plum',
      'cherry', 'avocado', 'lemon', 'lime', 'kiwi', 'grapefruit', 'clementine',
      'tomato', 'potato', 'onion', 'carrot', 'celery', 'lettuce', 'spinach', 'kale',
      'broccoli', 'cauliflower', 'cabbage', 'cucumber', 'pepper', 'zucchini',
      'squash', 'asparagus', 'corn', 'mushroom', 'garlic', 'ginger', 'leek',
      'bok choy', 'green onion', 'green bean', 'bean sprout', 'arugula',
      'parsnip', 'beet', 'sweet potato', 'yam', 'radish', 'fennel', 'eggplant',
      'fresh herb', 'basil', 'cilantro', 'parsley', 'dill',
      'produce', 'vegetable', 'fruit',
    ],
  },
  {
    category: 'Dairy',
    keywords: [
      'milk', 'cream', 'butter', 'cheese', 'yogurt', 'yoghurt', 'sour cream',
      'cream cheese', 'cottage cheese', 'kefir', 'ice cream', 'gelato', 'sorbet',
      'cheddar', 'mozzarella', 'parmesan', 'brie', 'camembert', 'gouda', 'swiss',
      'gorgonzola', 'ricotta', 'feta', 'havarti', 'edam', 'gruyere', 'manchego',
      'egg', 'eggs',
    ],
  },
  {
    category: 'Bakery',
    keywords: [
      'bread', 'loaf', 'bun', 'roll', 'bagel', 'croissant', 'muffin', 'scone',
      'donut', 'doughnut', 'cake', 'pie', 'tart', 'pastry', 'danish', 'croissant',
      'tortilla', 'pita', 'naan', 'flatbread', 'sourdough', 'baguette',
      'english muffin', 'wrap', 'baked good',
    ],
  },
  {
    category: 'Frozen',
    keywords: [
      'frozen', 'fries', 'hashbrown', 'hash brown', 'pizza pop', 'pizza bite',
      'nugget', 'finger', 'dumpling', 'gyoza', 'pierogi', 'pot pie', 'stir fry',
      'frozen meal', 'ice cream', 'frozen yogurt', 'popsicle', 'gelato',
      'frozen fruit', 'frozen vegetable', 'edamame', 'wonton',
    ],
  },
  {
    category: 'Pantry',
    keywords: [
      'pasta', 'noodle', 'rice', 'quinoa', 'couscous', 'oat', 'oatmeal', 'granola',
      'cereal', 'flour', 'sugar', 'salt', 'pepper', 'spice', 'seasoning', 'herb',
      'oil', 'olive oil', 'vinegar', 'sauce', 'ketchup', 'mustard', 'mayo',
      'mayonnaise', 'salsa', 'hot sauce', 'soy sauce', 'fish sauce', 'sriracha',
      'tomato', 'canned', 'soup', 'broth', 'stock', 'lentil', 'bean', 'chickpea',
      'pea', 'lentil', 'nut', 'almond', 'cashew', 'walnut', 'peanut', 'seed',
      'peanut butter', 'almond butter', 'tahini', 'jam', 'honey', 'maple syrup',
      'chocolate', 'cocoa', 'vanilla', 'baking', 'yeast', 'baking powder',
      'chip', 'cracker', 'cookie', 'popcorn', 'pretzel', 'snack',
      'coffee', 'tea', 'instant coffee', 'ground coffee',
      'corn chip', 'tortilla chip',
    ],
  },
  {
    category: 'Beverages',
    keywords: [
      'juice', 'orange juice', 'apple juice', 'water', 'sparkling water',
      'soda', 'pop ', 'cola', 'energy drink', 'sports drink', 'gatorade',
      'lemonade', 'iced tea', 'coconut water', 'almond milk', 'oat milk',
      'soy milk', 'smoothie', 'drink',
    ],
  },
];

function shouldSkip(item) {
  const text = (item.name + ' ' + (item.brand || '')).toLowerCase();
  return SKIP_KEYWORDS.some(kw => text.includes(kw));
}

function classifyItem(item) {
  const text = (item.name + ' ' + (item.brand || '')).toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some(kw => text.includes(kw))) {
      return rule.category;
    }
  }
  return null; // uncategorized
}

function discountPct(item) {
  if (item.discount) return Number(item.discount);
  if (item.original_price && item.price) {
    const orig = parseFloat(item.original_price);
    const sale = parseFloat(item.price);
    if (orig > sale && orig > 0) return Math.round((1 - sale / orig) * 100);
  }
  return 0;
}

function isStaple(item) {
  const text = (item.name + ' ' + (item.brand || '')).toLowerCase();
  const staples = [
    'chicken thigh', 'classico', 'scotch bonnet', 'bell pepper',
    'milk', 'egg', 'butter', "siggi's", 'siggis', 'siggi',
    'gorgonzola', 'balderson', 'swiss delice', 'que pasa', 'no name flour',
  ];
  return staples.some(s => text.includes(s));
}

// --- Process stores ---
const storeStats = {};
const bestByItemKey = {}; // "item_name_normalized" → best price entry

// Active food stores (skip non-food, skip Sobeys since Safeway has same flyer)
const activeStores = rawData.filter(s =>
  !SKIP_STORES.has(s.store_name) && s.store_name !== SOBEYS_ALIAS && s.items.length > 0
);

for (const store of activeStores) {
  let kept = 0, dropped = 0;
  for (const item of store.items) {
    // Skip items with no price and no useful info
    if (!item.price && !item.discount) { dropped++; continue; }

    // Skip non-food
    if (shouldSkip(item)) { dropped++; continue; }

    // Classify
    const category = classifyItem(item);
    if (!category) { dropped++; continue; }

    kept++;

    // Dedup across stores: keep best price
    const nameKey = item.name.toLowerCase().trim().slice(0, 40);
    const existing = bestByItemKey[nameKey];

    const price = parseFloat(item.price) || 0;
    const existingPrice = existing ? (parseFloat(existing.price) || 999) : 999;

    if (!existing || price < existingPrice) {
      bestByItemKey[nameKey] = {
        name: item.name,
        brand: item.brand || null,
        price: item.price ? '$' + parseFloat(item.price).toFixed(2) : null,
        original_price: item.original_price ? '$' + parseFloat(item.original_price).toFixed(2) : null,
        discount_pct: discountPct(item),
        store: store.store_name,
        category,
        sale_start: store.sale_start,
        sale_end: store.sale_end,
        image_url: item.image_url || null,
        source_name: store.store_name,
        is_staple: isStaple(item),
        _raw_price: price,
        _alt_stores: [],
      };
    } else {
      // Track as alternative store
      existing._alt_stores.push({ store: store.store_name, price: item.price ? '$' + parseFloat(item.price).toFixed(2) : null });
    }
  }
  storeStats[store.store_name] = { kept, dropped };
}

// Collect and rank all items
const allItems = Object.values(bestByItemKey);

// Sort: staples first, then by discount %, then by having original_price
allItems.sort((a, b) => {
  if (a.is_staple && !b.is_staple) return -1;
  if (!a.is_staple && b.is_staple) return 1;
  if (b.discount_pct !== a.discount_pct) return b.discount_pct - a.discount_pct;
  if (a.original_price && !b.original_price) return -1;
  if (!a.original_price && b.original_price) return 1;
  return 0;
});

// Group by category with cap
const CATEGORY_CAP = 20;
const categories = {};
for (const item of allItems) {
  if (!categories[item.category]) categories[item.category] = [];
  if (categories[item.category].length < CATEGORY_CAP) {
    // Format for output
    const out = {
      name: item.name,
      brand: item.brand,
      price: item.price,
      original_price: item.original_price,
      discount_pct: item.discount_pct || null,
      store: item.store,
      sale_start: item.sale_start,
      sale_end: item.sale_end,
      image_url: item.image_url,
      is_staple: item.is_staple,
    };
    if (item._alt_stores.length > 0) {
      out.also_at = item._alt_stores.slice(0, 2);
    }
    categories[item.category].push(out);
  }
}

// Generate highlights: top staple items with discounts, plus biggest % discounts overall
const highlightCandidates = allItems.filter(i => i.is_staple || i.discount_pct >= 25);
highlightCandidates.sort((a, b) => {
  if (a.is_staple && !b.is_staple) return -1;
  if (!a.is_staple && b.is_staple) return 1;
  return b.discount_pct - a.discount_pct;
});
const highlights = highlightCandidates.slice(0, 10).map(item => ({
  name: item.name,
  brand: item.brand,
  price: item.price,
  original_price: item.original_price,
  discount_pct: item.discount_pct,
  store: item.store,
}));

const result = {
  date: new Date().toISOString().slice(0, 10),
  categories,
  highlights,
};

writeFileSync(OUT_PATH, JSON.stringify(result, null, 2));

// Print report
let totalKept = 0, totalDropped = 0;
console.log('\nPer-store stats:');
for (const [name, stats] of Object.entries(storeStats)) {
  console.log(`  ${name}: ${stats.kept} kept, ${stats.dropped} dropped`);
  totalKept += stats.kept;
  totalDropped += stats.dropped;
}
console.log(`\nTotal: ${totalKept} kept, ${totalDropped} dropped`);
console.log('\nPer category (after dedup + cap):');
let grandTotal = 0;
for (const [cat, items] of Object.entries(categories)) {
  console.log(`  ${cat}: ${items.length} items`);
  grandTotal += items.length;
}
console.log(`\nGrand total: ${grandTotal} curated items`);
console.log(`\nWritten to ${OUT_PATH}`);
