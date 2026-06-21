#!/usr/bin/env node
/**
 * Classify raw flyer items into curated categories based on user preferences.
 * Input:  /tmp/eventfinder-flyer-batch-flipp.json
 * Output: /tmp/eventfinder-flyer-curated.json
 */

import { readFileSync, writeFileSync } from 'fs';

const raw = JSON.parse(readFileSync('/tmp/eventfinder-flyer-batch-flipp.json', 'utf8'));

// ── Staples — precise matches only ──────────────────────────────────────────
const STAPLE_PATTERNS = [
  /classico/i,
  /scotch bonnet/i,
  /\bsiggi/i,
  /\bgorgonzola\b/i,
  /\bbalderson\b/i,
  /swiss delice/i,
  /que pasa/i,
  // milk/eggs/butter — require them to be the main subject, not just a word in "egg rolls"
  /^(whole |2%|skim |1%|fat.?free )?milk\b/i,
  /\blarge eggs?\b/i,
  /\bfree.?range eggs?\b/i,
  /\borganic eggs?\b/i,
  /\bdozen eggs?\b/i,
  /^eggs?\b/i,
  /\bunsalted butter\b/i,
  /\bsalted butter\b/i,
  /^butter\b/i,
  /\bno.?name.*flour\b/i,
  /\bflour\b.*no.?name/i,
  /^all.?purpose flour\b/i,
];

// ── Stores to skip entirely ───────────────────────────────────────────────────
const SKIP_STORES = new Set([
  'Canadian Tire',
  'Co-op Wine Spirits Beer',
  'Sobeys & Safeway Liquor',
  'Sobeys',               // duplicate of Safeway
  'London Drugs',         // mostly non-food
  'Shoppers Drug Mart',   // mostly pharmacy/beauty — aggressive filter per preferences
]);

// ── Skip patterns — non-food / unwanted ──────────────────────────────────────
const SKIP_NAME_PATTERNS = [
  // Baby / infant
  /\bdiaper(s)?\b/i, /\bbaby\b/i, /\binfant\b/i, /\bformula\b/i, /\bnewborn\b/i,
  // Pet
  /\bpet\b/i, /\bdog\b/i, /\bcat\b/i, /\bbird food\b/i, /\bkibble\b/i,
  // Personal care / pharmacy
  /\bshampoo\b/i, /\bconditioner\b/i, /\bbody wash\b/i, /\bdeodorant\b/i,
  /\btoothpaste\b/i, /\btoothbrush\b/i, /\bmouthwash\b/i,
  /\blipstick\b/i, /\bmascara\b/i, /\bfoundation\b/i, /\bblush\b/i,
  /\beyeliner\b/i, /\bsunscreen\b/i, /\bsunblock\b/i, /\bsun.*spf\b/i,
  /\bcottonelle\b/i, /\bcharmin\b/i, /\bkleenex\b/i, /\btissue\b/i,
  /\btampon\b/i, /\bfeminine\b/i, /\bpad\b.*\bhygiene\b/i,
  /\bvitamin.*tablet\b/i, /\bvitamin.*capsule\b/i, /\bsupplement\b/i,
  /\bepsom salt\b/i, /\bsaline\b/i, /\btopical\b/i,
  /\bdetergent\b/i, /\bfabric softener\b/i, /\blaundry\b/i,
  /\bbleach\b/i, /\bdishwasher.*tab\b/i, /\bcleaner\b/i, /\bdisinfect\b/i,
  /\bpaper towel\b/i, /\bgarbage bag\b/i, /\bfoil wrap\b/i, /\bwrap.*dispenser\b/i,
  /\bcandle\b/i, /\bflowers?\b/i, /\bplant.*pot\b/i, /\bair freshener\b/i,
  /\bbattery\b/i, /\bbatteries\b/i,
  /\bhdmi\b/i, /\busb.*cable\b/i, /\bcharger\b/i,
  /\bgift card\b/i,
  // Candy / seasonal treats
  /\bgummy\b/i, /\blollipop\b/i, /\bjelly bean\b/i,
  // Health / pharmacy items
  /\ballergy relief\b/i, /\bcough syrup\b/i, /\bchloraseptic\b/i,
  /\baerius\b/i, /\bclaritin\b/i, /\badvil\b/i, /\btylenol\b/i,
  /\bibuprofen\b/i, /\bacetaminophen\b/i, /\bantacid\b/i,
  /\btums\b/i, /\bpepto\b/i, /\bband.?aid\b/i, /\bfirst aid\b/i,
  /\bepinephrine\b/i, /\bnasal spray\b/i, /\bvapour rub\b/i,
  /\bcream.*topical\b/i, /\bcortisone\b/i, /\bpolysporin\b/i,
  /\bbath.*product\b/i, /\bskincare\b/i, /\bmoisturiz\b/i,
  /\bserum\b/i, /\bcollagen.*skin\b/i, /\bbotox\b/i,
  /\bwax.*strip\b/i, /\bshave.*oil\b/i, /\bshave.*gel\b/i,
  /\bnair\b/i, /\bschick\b/i, /\bgillette\b/i, /\brazor\b/i,
  /\barch sleeve\b/i, /\bcorn.*callus\b/i, /\bbunion\b/i, /\bfoot care\b/i,
  // Cooking-adjacent non-food
  /\bstorage container\b/i, /\bbaking pan\b/i, /\bcooking.*pan\b/i,
  /\bpot.*lid\b/i, /\bkitchen.*tool\b/i, /\bcutting board\b/i,
];

// ── Categorize by food type ───────────────────────────────────────────────────
function categorize(name, brand) {
  const text = `${name} ${brand || ''}`.toLowerCase();

  // Meat & Seafood
  if (/\b(chicken breast|chicken thigh|chicken drumstick|chicken wing|whole chicken|ground chicken|ground beef|ground turkey|beef steak|sirloin|ribeye|striploin|tenderloin|pork chop|pork loin|pork belly|pork shoulder|back ribs|side ribs|lamb chop|veal|bison|venison|turkey breast|turkey|salmon|halibut|tilapia|cod|shrimp|prawn|crab|lobster|scallop|clam|mussel|oyster|tuna steak|fish fillet|sausage|breakfast sausage|italian sausage|kielbasa|bratwurst|bacon|side bacon|back bacon|ham|prosciutto|salami|pepperoni|deli meat|sliced turkey|sliced ham|deli chicken|hot dog|wiener|ground pork|pork tenderloin|beef roast|chuck roast|pot roast|brisket|flank steak|skirt steak|pork butt|beef short rib)\b/.test(text)) {
    return 'Meat & Seafood';
  }
  // Don't use "meat" alone — too many false positives with "deli meat" in other contexts

  // Produce — actual fruits and vegetables
  if (/\b(apple|banana|orange|mandarin|clementine|grapefruit|grape|strawberr|blueberr|raspberr|blackberr|mango|peach|nectarine|plum|cherry|pear|melon|watermelon|cantaloupe|honeydew|pineapple|kiwi|lemon|lime|avocado|bell pepper|jalape|serrano|habanero|scotch bonnet|hot pepper|chili pepper|roma tomato|grape tomato|cherry tomato|beefsteak tomato|field tomato|tomato|cucumber|zucchini|squash|carrot|celery|romaine|iceberg lettuce|spinach|kale|arugula|broccoli|cauliflower|asparagus|green bean|snap pea|snow pea|corn on the cob|sweet corn|onion|shallot|leek|green onion|scallion|garlic|ginger|cremini|portobello|shiitake|mushroom|potato|russet potato|sweet potato|yam|eggplant|radish|beet|red cabbage|green cabbage|napa cabbage|bok choy|swiss chard|collard|brussel sprout|fennel|artichoke|turnip|parsnip|rutabaga|jicama|daikon|lychee|dragon fruit|papaya|guava|starfruit|jackfruit|durian|rambutan|longan|pomelo|persimmon)\b/.test(text)) {
    return 'Produce';
  }
  if (/\b(salad greens|mixed greens|spring mix|baby spinach|herb.*fresh|fresh.*herb|cut fruit|vegetable tray|fruit tray|stir.?fry vegetable)\b/.test(text)) {
    return 'Produce';
  }

  // Dairy — actual dairy products
  if (/\b(2% milk|whole milk|skim milk|1% milk|chocolate milk|oat milk|almond milk|soy milk|homo milk|dairy milk|partly skimmed milk|organic milk|butter|cream cheese|sour cream|heavy cream|whipping cream|half.?and.?half|cottage cheese|ricotta|mozzarella|cheddar cheese|parmesan|brie|camembert|gouda|havarti|provolone|feta|swiss cheese|gorgonzola|goat cheese|cream cheese|yogurt|yoghurt|greek yogurt|kefir|siggi|balderson|baldersons|marble cheese|tex mex blend|shredded cheese|sliced cheese|cheese block|brick cheese|chèvre)\b/.test(text)) {
    return 'Dairy';
  }
  if (/^(milk|eggs?|butter|cheese|yogurt)\b/i.test(name)) {
    return 'Dairy';
  }

  // Bakery — baked goods
  if (/\b(whole wheat bread|white bread|multigrain bread|sourdough bread|rye bread|artisan bread|sandwich loaf|bread loaf|hamburger bun|hot dog bun|dinner roll|kaiser roll|bagel|croissant|muffin|scone|donut|doughnut|birthday cake|coffee cake|lemon cake|chocolate cake|pie shell|pastry|danish|brioche|baguette|tortilla|pita|naan|flatbread|waffle mix|pancake mix)\b/.test(text)) {
    return 'Bakery';
  }
  if (/\b(que pasa|tortilla chips|corn chips)\b/.test(text)) {
    return 'Bakery'; // snacks under bakery
  }

  // Frozen — frozen foods
  if (/\b(frozen pizza|frozen entree|frozen meal|frozen dinner|tv dinner|frozen vegetable|frozen fruit|frozen berry|ice cream|gelato|sorbet|popsicle|ice bar|drumstick ice cream|edamame|frozen shrimp|frozen salmon|frozen fish|frozen chicken|frozen lasagna|frozen pasta|frozen waffle|frozen breakfast|frozen snack|frozen spring roll|frozen dumpling)\b/.test(text)) {
    return 'Frozen';
  }

  // Beverages — drinks
  if (/\b(orange juice|apple juice|pineapple juice|grape juice|cranberry juice|tomato juice|vegetable juice|fruit juice|lemonade|sparkling water|mineral water|club soda|tonic water|cola|pepsi|coca.?cola|7up|sprite|ginger ale|root beer|dr pepper|energy drink|red bull|monster energy|coffee|espresso|tea|green tea|black tea|herbal tea|iced tea|kombucha|smoothie|kool.?aid|crystal light|gatorade|powerade|protein shake|plant.?based drink)\b/.test(text)) {
    return 'Beverages';
  }

  // Pantry — shelf-stable food
  if (/\b(jasmine rice|basmati rice|brown rice|white rice|long grain rice|arborio rice|sushi rice|rice bag|pasta sauce|marinara|tomato sauce|classico|olive oil|vegetable oil|canola oil|coconut oil|sesame oil|avocado oil|peanut oil|butter spread|plant.?based butter|margarine|strawberry jam|raspberry jam|peach jam|marmalade|honey|maple syrup|peanut butter|almond butter|cashew butter|nutella|dark chocolate|milk chocolate|white chocolate|baking chocolate|chocolate bar|cocoa powder|oatmeal|rolled oats|steel cut oats|granola|cereal|all.?purpose flour|bread flour|whole wheat flour|cake flour|white sugar|brown sugar|icing sugar|powdered sugar|sea salt|kosher salt|black pepper|red pepper flakes|cayenne|paprika|cumin|coriander|turmeric|cinnamon|garlic powder|onion powder|chili powder|italian seasoning|herbs.*spice|chicken broth|beef broth|vegetable broth|chicken stock|beef stock|tomato soup|cream of mushroom|lentil soup|canned tomato|diced tomato|crushed tomato|tomato paste|canned beans|black beans|kidney beans|chickpea|lentil|canned tuna|canned salmon|canned sardine|crackers|ritz|triscuit|wheat thin|chips|tortilla chips|potato chips|popcorn|trail mix|almonds|cashews|walnuts|pecans|pistachios|mixed nuts|sunflower seed|pumpkin seed|dried cranberr|dried mango|raisin|dried fruit|soy sauce|fish sauce|oyster sauce|hoisin sauce|sriracha|hot sauce|tabasco|worcestershire|vinegar|balsamic|rice vinegar|apple cider vinegar|salsa|guacamole|hummus|tahini|curry paste|coconut milk|canned coconut|stuffing mix|bread crumbs|panko|baking soda|baking powder|yeast|vanilla extract|corn starch|xanthan gum|couscous|quinoa|barley|bulgur|farro|polenta|cornmeal)\b/.test(text)) {
    return 'Pantry';
  }

  return null;
}

// ── Price helpers ─────────────────────────────────────────────────────────────
function fmtPrice(p) {
  if (!p && p !== 0) return null;
  const n = parseFloat(p);
  if (isNaN(n)) return String(p);
  return `$${n.toFixed(2)}`;
}

function discountPct(sale, original) {
  const s = parseFloat(sale);
  const o = parseFloat(original);
  if (!s || !o || o <= s) return 0;
  return Math.round((1 - s / o) * 100);
}

function isStaple(name) {
  return STAPLE_PATTERNS.some(p => p.test(name));
}

function shouldSkip(name, brand) {
  const text = `${name} ${brand || ''}`;
  return SKIP_NAME_PATTERNS.some(p => p.test(text));
}

// ── Main processing ───────────────────────────────────────────────────────────
const stats = {};
const categorized = {};

for (const store of raw) {
  const storeName = store.store_name;
  if (SKIP_STORES.has(storeName)) {
    stats[storeName] = { kept: 0, dropped: store.items.length, reason: 'store skipped' };
    continue;
  }

  stats[storeName] = { kept: 0, dropped: 0 };

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

    const salePrice = item.price;
    const origPrice = item.original_price;
    const pct = discountPct(salePrice, origPrice);
    const staple = isStaple(name);

    // Skip items with no price unless they're a staple (then include anyway)
    if (!salePrice && !staple) {
      stats[storeName].dropped++;
      continue;
    }

    const entry = {
      name,
      brand: brand || null,
      price: fmtPrice(salePrice),
      original_price: origPrice ? fmtPrice(origPrice) : null,
      discount_pct: pct || null,
      store: storeName,
      staple,
      _raw_price: parseFloat(salePrice) || 0,
      _raw_orig: parseFloat(origPrice) || 0,
    };

    if (!categorized[cat]) categorized[cat] = [];
    categorized[cat].push(entry);
    stats[storeName].kept++;
  }
}

// ── Deduplicate within categories (same item, best price) ────────────────────
function dedupeAndRank(items, cap = 20) {
  const groups = {};
  for (const item of items) {
    const key = item.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }

  const deduped = [];
  for (const group of Object.values(groups)) {
    if (group.length === 1) {
      deduped.push(group[0]);
    } else {
      group.sort((a, b) => {
        if (a._raw_price && b._raw_price) return a._raw_price - b._raw_price;
        return a._raw_price ? -1 : 1;
      });
      const best = { ...group[0] };
      const alts = group.slice(1)
        .map(i => `${i.store}${i.price ? ' ' + i.price : ''}`)
        .join(', ');
      if (alts) best.also_at = alts;
      deduped.push(best);
    }
  }

  deduped.sort((a, b) => {
    if (a.staple && !b.staple) return -1;
    if (!a.staple && b.staple) return 1;
    const ad = a.discount_pct || 0;
    const bd = b.discount_pct || 0;
    if (bd !== ad) return bd - ad;
    const aDrop = a._raw_orig - a._raw_price;
    const bDrop = b._raw_orig - b._raw_price;
    return bDrop - aDrop;
  });

  return deduped.slice(0, cap).map(({ _raw_price, _raw_orig, ...rest }) => rest);
}

const finalCategories = {};
const CATEGORY_ORDER = ['Meat & Seafood', 'Produce', 'Dairy', 'Bakery', 'Frozen', 'Pantry', 'Beverages'];
for (const cat of CATEGORY_ORDER) {
  if (categorized[cat] && categorized[cat].length > 0) {
    finalCategories[cat] = dedupeAndRank(categorized[cat], 20);
  }
}

// ── Highlights — top staple deals sorted by discount % ───────────────────────
const allCuratedItems = Object.values(finalCategories).flat();
const highlights = allCuratedItems
  .filter(i => i.staple)
  .sort((a, b) => (b.discount_pct || 0) - (a.discount_pct || 0))
  .slice(0, 10);

// ── Output ────────────────────────────────────────────────────────────────────
const today = new Date().toISOString().split('T')[0];
const output = { date: today, categories: finalCategories, highlights };
writeFileSync('/tmp/eventfinder-flyer-curated.json', JSON.stringify(output, null, 2));

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n── Store stats ──────────────────────────────────────────────────────');
for (const [store, s] of Object.entries(stats)) {
  console.log(`  ${store.padEnd(30)} kept: ${String(s.kept).padStart(4)}  dropped: ${s.dropped}${s.reason ? '  (' + s.reason + ')' : ''}`);
}

console.log('\n── Category counts ─────────────────────────────────────────────────');
let totalKept = 0;
for (const [cat, items] of Object.entries(finalCategories)) {
  console.log(`  ${cat.padEnd(20)} ${items.length} items`);
  totalKept += items.length;
}
console.log(`  Total: ${totalKept} items`);

const totalDropped = Object.values(stats).reduce((s, v) => s + v.dropped, 0);
const totalRaw = raw.reduce((s, v) => s + v.items.length, 0);
console.log(`\nRaw: ${totalRaw}  Kept: ${totalKept}  Dropped: ${totalRaw - totalKept}`);
console.log('Written to /tmp/eventfinder-flyer-curated.json');
