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
const TODAY  = new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Drop Sobeys (same flyer as Safeway) and liquor-only stores
// ---------------------------------------------------------------------------
const DROP_STORES = new Set(['Sobeys', 'Co-op Wine Spirits Beer', 'Sobeys & Safeway Liquor']);

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
  'milk thistle','protein shake','pre-workout','creatine','collagen peptide',
  'nozzle','wand','sprinkler','hose','pendant','chandelier','fixture',
  'roaster','bakeware','cookware','casserole dish','appliance',
  'coffee maker','coffee machine','espresso maker','espresso machine',
  'blender','juicer','air fryer','instant pot','slow cooker','rice cooker',
  'knife','knives','sheath','blade','spirit level','level meter',
  'sewing','iron board','garment','clothing iron',
  'wrench','socket','drill bit','saw blade','chisel','pliers','screwdriver',
  'bottle set','water bottle','tumbler','thermos','travel mug','reusable',
  'impact wrench','nut-busting','busting',
  'chair','lawn chair','camp chair','camping chair','cooler bag','ice chest',
  'hard cooler','beach tote','backpack','tote bag',
  'lawn','patio','outdoor furniture','deck','tent','sleeping bag',
];

// ---------------------------------------------------------------------------
// Category assignment
// ---------------------------------------------------------------------------

function assignCategory(name, brand) {
  const text = (name + ' ' + (brand || '')).toLowerCase();

  // Meat & seafood — use word boundaries for short ambiguous tokens
  if (/chicken|beef|pork|\blamb\b|turkey|\bduck\b|bison|steak|\broast\b|\brib\b|ribs|\bchop\b|tenderloin|\bbreast\b|\bthigh\b|\bwing\b|sausage|bacon|\bham\b|salami|pepperoni|chorizo|prosciutto|deli meat|hot dog|wiener|ground (beef|pork|turkey|meat)|salmon|\btuna\b|tilapia|\bcod\b|halibut|shrimp|prawn|\bcrab\b|lobster|scallop|mussel|\bclam\b|oyster|squid|fish fillet|seafood|smoked fish/.test(text)) {
    return 'Meat & Seafood';
  }
  if (/apple|banana|orange|grape|strawberr|blueberr|raspberr|mango|pineapple|watermelon|cantaloupe|\bmelon\b|\bpeach\b|\bplum\b|\bpear\b|cherr|lemon|lime|avocado|tomato|potato|onion|garlic|ginger|carrot|celery|lettuce|spinach|\bkale\b|broccoli|cauliflower|cabbage|cucumber|zucchini|pepper|mushroom|asparagus|\bcorn\b|\bpeas\b|\bbeans\b|\bsquash\b|\byam\b|sweet potato|\bbeet\b|\bkale\b|\bleek\b|fennel|artichoke|berr|fresh fruit|fresh veg|produce|\bherb\b/.test(text)) {
    return 'Produce';
  }
  if (/\bmilk\b|butter|cream cheese|sour cream|cottage cheese|\bcream\b|cheese|yogurt|yoghurt|mozzarella|cheddar|\bbrie\b|camembert|gouda|parmesan|\bfeta\b|ricotta|\begg\b|\beggs\b|kefir|ice cream|gelato|sherbet|whipping/.test(text)) {
    return 'Dairy & Eggs';
  }
  if (/\bbread\b|\bbun\b|\broll\b|bagel|croissant|muffin|donut|doughnut|\bcake\b|cookie|pastry|\bpie\b|\btart\b|brownie|\bloaf\b|sourdough|pita|\bnaan\b|tortilla|baguette|ciabatta|focaccia|bakery/.test(text)) {
    return 'Bakery';
  }
  if (/frozen|pizza|\bburrito\b/.test(text)) {
    return 'Frozen';
  }
  if (/juice|\bwater\b|sparkling|soda|\bpop\b|energy drink|sports drink|lemonade|iced tea|kombucha|smoothie|coca.cola|pepsi|sprite|7up|dr pepper|mountain dew|gatorade|vitamin water|beverage/.test(text)) {
    return 'Beverages';
  }
  if (/coffee|\btea\b|espresso/.test(text)) {
    return 'Beverages';
  }
  return 'Pantry';
}

// ---------------------------------------------------------------------------
// Is this item food/drink/alcohol?
// ---------------------------------------------------------------------------

// Short keywords that need word-boundary matching to avoid false positives
// (e.g. "ham" in "Hamilton", "wing" in "sewing", "nut" in "Nutribullet",
//       "can" in "canvas", "water" in "watering", "roast" in "roaster")
const WORD_BOUNDARY_FOOD_KW = new Set([
  'ham','wing','nut','bun','roll','pie','tart','dill','mint','pear','plum',
  'corn','beet','leek','kale','peas','egg','eggs','brie','feta','cod','oil',
  'crab','clam','gin','rum','ale','pop','tea','jam','rye','oat',
  'can','water','roast','fresh','lard','loin','rack','roe','spirit',
]);

function isFood(name, brand) {
  const text = (name + ' ' + (brand || '')).toLowerCase();

  // Hard non-food signals — check first
  for (const kw of NON_FOOD_KEYWORDS) {
    if (text.includes(kw)) return false;
  }

  // Check food keywords
  for (const kw of FOOD_KEYWORDS) {
    if (WORD_BOUNDARY_FOOD_KW.has(kw)) {
      if (new RegExp('\\b' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(text)) return true;
    } else {
      if (text.includes(kw)) return true;
    }
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

  const displayName = storeName;

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
  // Canadian Tire: zero — keyword false-positives produce too much noise
  const caps = {
    'Shoppers Drug Mart':      15,
    'London Drugs':            10,
    'Canadian Tire':            0,
    'Costco':                  25,
    'Wholesale Club':          25,
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
// Staple detection — items that match user preferences get priority boost
// ---------------------------------------------------------------------------
const STAPLE_PATTERNS = [
  /classico/i,
  /scotch bonnet/i,
  /\bpeppers?\b/i,
  /\bmilk\b/i,
  /\beggs?\b/i,
  /\bbutter\b/i,
  /siggi'?s/i,
  /gorgonzola/i,
  /balderson/i,
  /swiss delice/i,
  /que pasa/i,
  /no.?name flour|no name.*flour|flour.*no.?name/i,
];

function isStaple(name, brand) {
  const text = (name || '') + ' ' + (brand || '');
  return STAPLE_PATTERNS.some(re => re.test(text));
}

function stapleScore(item) {
  return isStaple(item.name, item.brand) ? 1000 : 0;
}

// ---------------------------------------------------------------------------
// Group into categories
// ---------------------------------------------------------------------------

const CATEGORY_CAP = 20;

const categories = {
  'Meat & Seafood': [],
  'Produce':        [],
  'Dairy & Eggs':   [],
  'Bakery':         [],
  'Frozen':         [],
  'Pantry':         [],
  'Beverages':      [],
};

for (const item of allKept) {
  const cat = assignCategory(item.name, item.brand);
  // Skip alcohol — user prefers to skip liquor store flyers
  if (cat === 'Alcohol') continue;
  if (categories[cat] !== undefined) categories[cat].push(item);
  else categories['Pantry'].push(item);
}

// Rank each category: staples first, then by discount %, then just include
for (const [cat, items] of Object.entries(categories)) {
  items.sort((a, b) => {
    const sa = stapleScore(a) + discountScore(a);
    const sb = stapleScore(b) + discountScore(b);
    return sb - sa;
  });
  categories[cat] = items.slice(0, CATEGORY_CAP);
}

// Remove empty categories
for (const cat of Object.keys(categories)) {
  if (categories[cat].length === 0) delete categories[cat];
}

// ---------------------------------------------------------------------------
// Build highlights: staples on sale first, then biggest discount % deals
// ---------------------------------------------------------------------------

const allCurated = Object.values(categories).flat();

// Score for highlights: staple match + discount %
const highlightCandidates = allCurated
  .filter(item => isStaple(item.name, item.brand) || discountScore(item) >= 20)
  .map(item => ({ ...item, _hlScore: stapleScore(item) + discountScore(item) }))
  .sort((a, b) => b._hlScore - a._hlScore)
  .slice(0, 10)
  .map(({ _hlScore, ...item }) => item);

const output = { date: TODAY, categories, highlights: highlightCandidates };
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
