#!/usr/bin/env node
/**
 * classify-flyer-items.js
 *
 * Reads /tmp/eventfinder-flyer-batch-flipp.json, filters to food/drink/alcohol,
 * deduplicates (Sobeys = Safeway), categorizes, ranks by discount, and writes
 * /tmp/eventfinder-flyer-curated.json.
 */

import { readFileSync, writeFileSync } from 'fs';

const INPUT  = '/tmp/eventfinder-flyer-batch-flipp.json';
const OUTPUT = '/tmp/eventfinder-flyer-curated.json';
const TODAY  = '2026-03-30';

// ---------------------------------------------------------------------------
// Drop Sobeys (same flyer as Safeway)
// ---------------------------------------------------------------------------
const DROP_STORES = new Set(['Sobeys']);

// ---------------------------------------------------------------------------
// Keyword lists for food vs non-food classification
// ---------------------------------------------------------------------------

const FOOD_KEYWORDS = [
  // meat & seafood
  'chicken','beef','pork','lamb','turkey','duck','bison','veal','venison',
  'steak','roast','ribs','chops','cutlet','tenderloin','breast','thigh','wing',
  'sausage','bacon','ham','salami','pepperoni','chorizo','prosciutto','pancetta',
  'salmon','tuna','tilapia','cod','halibut','shrimp','prawn','crab','lobster',
  'scallop','mussel','clam','oyster','squid','fish','seafood','fillet','smoked salmon',
  'ground beef','ground turkey','ground pork','deli meat','hot dog','wiener',
  // produce
  'apple','banana','orange','grape','strawberry','blueberry','raspberry',
  'mango','pineapple','watermelon','cantaloupe','melon','peach','plum','pear',
  'cherry','lemon','lime','avocado','tomato','potato','onion','garlic','ginger',
  'carrot','celery','lettuce','spinach','kale','broccoli','cauliflower','cabbage',
  'cucumber','zucchini','pepper','mushroom','asparagus','corn','peas','beans',
  'squash','yam','sweet potato','beet','radish','leek','fennel','artichoke',
  'berry','berries','fruit','vegetable','veggie','salad','herb','cilantro',
  'parsley','basil','dill','mint','produce','fresh','organic',
  // dairy & eggs
  'milk','butter','cream','cheese','yogurt','yoghurt','sour cream','cottage cheese',
  'cream cheese','ricotta','mozzarella','cheddar','brie','camembert','gouda',
  'parmesan','feta','egg','eggs','half & half','whipping cream','kefir',
  'ice cream','gelato','sherbet',
  // bakery
  'bread','bun','roll','bagel','croissant','muffin','donut','doughnut',
  'cake','cookie','pastry','pie','tart','brownie','loaf','sourdough',
  'pita','naan','tortilla','wrap','baguette','ciabatta','focaccia',
  // frozen
  'frozen','pizza','burrito','frozen dinner','frozen meal','TV dinner',
  'frozen vegetable','frozen fruit','frozen fish','frozen shrimp',
  // pantry & grocery
  'pasta','noodle','rice','quinoa','oat','cereal','granola','flour','sugar',
  'oil','olive oil','canola oil','vegetable oil','vinegar','sauce','salsa',
  'ketchup','mustard','mayo','mayonnaise','dressing','marinade','seasoning',
  'spice','salt','pepper','stock','broth','soup','chili','stew','chowder',
  'canned','can of','tin of','jar of','tomato sauce','tomato paste',
  'peanut butter','jam','jelly','honey','syrup','maple syrup','nutella',
  'chocolate','candy','chips','crackers','popcorn','pretzel','snack',
  'nut','almond','cashew','walnut','peanut','pistachio','sunflower seed',
  'dried fruit','raisin','cranberry','trail mix','granola bar','protein bar',
  'tofu','tempeh','hummus','dip','salsa','guacamole',
  'coffee','tea','espresso','latte',
  // beverages
  'juice','water','sparkling water','soda','pop','energy drink','sports drink',
  'lemonade','iced tea','drink','beverage','bottle','can','pack','case',
  'coca-cola','pepsi','sprite','7up','dr pepper','mountain dew','gatorade',
  'vitamin water','kombucha','smoothie',
  // alcohol
  'beer','wine','spirit','whisky','whiskey','vodka','gin','rum','tequila',
  'bourbon','scotch','brandy','cognac','champagne','prosecco','cider','ale',
  'lager','pilsner','stout','porter','seltzer','hard seltzer','cooler',
  'liquor','liqueur','mead','sake','6-pack','12-pack','24-pack','case of beer',
  'bottle of wine','can of beer',
];

const NON_FOOD_KEYWORDS = [
  'shampoo','conditioner','body wash','deodorant','razor','shave','toothbrush',
  'toothpaste','floss','mouthwash','sunscreen','lotion','moisturizer','cream',
  'mascara','lipstick','foundation','blush','eyeliner','nail','makeup',
  'vitamin','supplement','probiotic','omega','collagen','protein powder',
  'medicine','medication','antibiotic','ibuprofen','tylenol','advil','aspirin',
  'bandage','first aid','pregnancy test','ovulation','condom','tampon','pad',
  'diaper','wipe','baby formula','baby food','infant',
  'detergent','laundry','fabric softener','dryer sheet','bleach','cleaner',
  'dish soap','dishwasher','garbage bag','paper towel','toilet paper','tissue',
  'foil','plastic wrap','ziploc','storage bag',
  'shaver','electric','razor blade','mach3','venus',
  'tool','hardware','battery','light bulb','extension cord','drill','hammer',
  'garden','hose','fertilizer','pesticide','weed',
  'clothing','shirt','pants','jacket','shoe','boot','sock','underwear',
  'toy','game','puzzle','doll','lego',
  'electronics','phone','tablet','laptop','computer','printer','camera',
  'tire','motor oil','antifreeze','wiper blade',
  'pet food','dog food','cat food','litter','kibble',
  'air freshener','candle','incense',
  'magazine','book','stationery',
  'mop','broom','vacuum','sponge',
];

// ---------------------------------------------------------------------------
// Category assignment
// ---------------------------------------------------------------------------

function assignCategory(name, brand) {
  const text = (name + ' ' + (brand || '')).toLowerCase();

  if (/chicken|beef|pork|lamb|turkey|duck|bison|steak|roast|rib|chop|tenderloin|breast|thigh|wing|sausage|bacon|ham|salami|pepperoni|chorizo|prosciutto|deli meat|hot dog|wiener|ground (beef|pork|turkey|meat)|salmon|tuna|tilapia|cod|halibut|shrimp|prawn|crab|lobster|scallop|mussel|clam|oyster|squid|fish fillet|seafood|smoked fish/.test(text)) {
    return 'Meat & Seafood';
  }
  if (/apple|banana|orange|grape|strawberr|blueberr|raspberr|mango|pineapple|watermelon|cantaloupe|melon|peach|plum|pear|cherr|lemon|lime|avocado|tomato|potato|onion|garlic|ginger|carrot|celery|lettuce|spinach|kale|broccoli|cauliflower|cabbage|cucumber|zucchini|pepper|mushroom|asparagus|\bcorn\b|peas|\bbeans\b|squash|yam|sweet potato|beet|radish|leek|fennel|artichoke|berr|fresh fruit|fresh veg|produce|herb/.test(text)) {
    return 'Produce';
  }
  if (/\bmilk\b|butter|cream cheese|sour cream|cottage cheese|cream|cheese|yogurt|yoghurt|mozzarella|cheddar|brie|camembert|gouda|parmesan|feta|ricotta|\begg\b|\beggs\b|kefir|ice cream|gelato|sherbet|whipping/.test(text)) {
    return 'Dairy & Eggs';
  }
  if (/\bbread\b|bun|roll|bagel|croissant|muffin|donut|doughnut|\bcake\b|cookie|pastry|\bpie\b|\btart\b|brownie|\bloaf\b|sourdough|pita|naan|tortilla|baguette|ciabatta|focaccia|bakery/.test(text)) {
    return 'Bakery';
  }
  if (/frozen|pizza|\bburrito\b|TV dinner/.test(text)) {
    return 'Frozen';
  }
  if (/beer|wine|spirit|whisky|whiskey|vodka|\bgin\b|rum|tequila|bourbon|scotch|brandy|cognac|champagne|prosecco|cider|\bale\b|lager|pilsner|stout|porter|seltzer|hard seltzer|cooler|liquor|liqueur|mead|sake|6-pack|12-pack|24-pack|can of beer|bottle of wine/.test(text)) {
    return 'Alcohol';
  }
  if (/juice|water|sparkling|soda|\bpop\b|energy drink|sports drink|lemonade|iced tea|kombucha|smoothie|coca.cola|pepsi|sprite|7up|dr pepper|mountain dew|gatorade|vitamin water|beverage/.test(text)) {
    return 'Beverages';
  }
  if (/coffee|tea|espresso/.test(text)) {
    return 'Beverages';
  }
  return 'Pantry';
}

// ---------------------------------------------------------------------------
// Is this item food/drink/alcohol?
// ---------------------------------------------------------------------------

function isFood(name, brand) {
  const text = (name + ' ' + (brand || '')).toLowerCase();

  // Hard non-food signals
  for (const kw of NON_FOOD_KEYWORDS) {
    if (text.includes(kw)) return false;
  }

  // Check food keywords
  for (const kw of FOOD_KEYWORDS) {
    if (text.includes(kw)) return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Discount score for ranking (higher = better deal)
// ---------------------------------------------------------------------------

function discountScore(item) {
  if (item.discount) {
    const pct = parseFloat(String(item.discount).replace('%',''));
    if (!isNaN(pct)) return pct;
  }
  if (item.original_price && item.price) {
    const orig = parseFloat(item.original_price);
    const sale = parseFloat(item.price);
    if (!isNaN(orig) && !isNaN(sale) && orig > 0) {
      return Math.round(((orig - sale) / orig) * 100);
    }
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const raw = JSON.parse(readFileSync(INPUT, 'utf8'));

const stats = {};
const allKept = [];

for (const store of raw) {
  const storeName = store.store_name;

  if (DROP_STORES.has(storeName)) {
    stats[storeName] = { kept: 0, dropped: store.items.length, reason: 'duplicate (same as Safeway)' };
    continue;
  }

  // Normalize "Sobeys & Safeway Liquor" label
  const displayName = storeName === 'Sobeys & Safeway Liquor' ? 'Safeway Liquor' : storeName;

  const storeStats = { kept: 0, dropped: 0 };
  stats[storeName] = storeStats;

  const kept = [];

  for (const item of (store.items || [])) {
    if (isFood(item.name, item.brand)) {
      kept.push({
        name:           item.name,
        brand:          item.brand || null,
        price:          item.price || null,
        original_price: item.original_price || null,
        discount:       item.discount || null,
        store:          displayName,
        _score:         discountScore(item),
      });
    } else {
      storeStats.dropped++;
    }
  }

  // Sort by discount score desc, then keep top N
  kept.sort((a, b) => b._score - a._score);

  // Per-store caps (generous for grocery stores, tight for drug/hardware)
  const caps = {
    'Shoppers Drug Mart':      20,
    'London Drugs':            15,
    'Canadian Tire':           10,
    'Costco':                  30,
    'Wholesale Club':          30,
  };
  const cap = caps[storeName] ?? 40;
  const final = kept.slice(0, cap);

  storeStats.kept    = final.length;
  storeStats.dropped += (store.items.length - kept.length) + (kept.length - final.length);

  for (const item of final) {
    delete item._score;
    allKept.push(item);
  }
}

// ---------------------------------------------------------------------------
// Group into categories
// ---------------------------------------------------------------------------

const categories = {
  'Meat & Seafood': [],
  'Produce':        [],
  'Dairy & Eggs':   [],
  'Bakery':         [],
  'Frozen':         [],
  'Pantry':         [],
  'Beverages':      [],
  'Alcohol':        [],
};

for (const item of allKept) {
  const cat = assignCategory(item.name, item.brand);
  categories[cat].push(item);
}

// Remove empty categories
for (const cat of Object.keys(categories)) {
  if (categories[cat].length === 0) delete categories[cat];
}

const output = { date: TODAY, categories };
writeFileSync(OUTPUT, JSON.stringify(output, null, 2));

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

console.log('\nPer-store summary:');
console.log('─'.repeat(60));
for (const [store, s] of Object.entries(stats)) {
  const note = s.reason ? ` (${s.reason})` : '';
  console.log(`  ${store}: kept ${s.kept}, dropped ${s.dropped}${note}`);
}

console.log('\nPer-category totals:');
console.log('─'.repeat(60));
let grandTotal = 0;
for (const [cat, items] of Object.entries(categories)) {
  console.log(`  ${cat}: ${items.length}`);
  grandTotal += items.length;
}
console.log(`\nTotal kept: ${grandTotal}`);
console.log(`Output written to ${OUTPUT}`);
