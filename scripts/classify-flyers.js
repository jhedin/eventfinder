#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';

const RAW_PATH = '/tmp/eventfinder-flyer-batch-flipp.json';
const OUT_PATH = '/tmp/eventfinder-flyer-curated.json';

const raw = JSON.parse(readFileSync(RAW_PATH, 'utf8'));

// ── Skip entirely ──────────────────────────────────────────────────────────
const SKIP_STORES = new Set([
  'Sobeys',                    // duplicate of Safeway
  'Co-op Wine Spirits Beer',   // alcohol
  'Sobeys & Safeway Liquor',   // alcohol
  'Shoppers Drug Mart',        // pharmacy/non-food
  'London Drugs',              // electronics/non-food
  'Canadian Tire',             // hardware/non-food
]);

// ── Non-food term blocklist ────────────────────────────────────────────────
const NON_FOOD_TERMS = [
  /light bulb/i, /candle/i, /storage product/i, /halloween/i, /decoration/i,
  /bluetooth/i, /speaker/i, /headphone/i, /laptop/i, /tablet/i, /phone/i,
  /camera/i, /printer/i, /keyboard/i, /mouse\b/i, /monitor\b/i,
  /vitamin/i, /supplement/i, /protein powder/i,
  /blood pressure/i, /thermometer/i, /medical/i, /pharmacy/i,
  /shampoo/i, /conditioner/i, /deodorant/i, /toothpaste/i, /toothbrush/i,
  /lotion/i, /moisturizer/i, /sunscreen/i, /makeup/i, /mascara/i, /lipstick/i,
  /skincare/i, /skin care/i, /cleanser/i, /serum/i, /facial/i,
  /laundry/i, /detergent/i, /dish soap/i, /dishwasher/i, /cleaner\b/i, /wipes/i,
  /paper towel/i, /toilet paper/i, /kleenex/i, /tissue/i,
  /diaper/i, /baby formula/i, /infant formula/i, /toddler formula/i,
  /pet food/i, /dog food/i, /cat food/i, /kibble/i, /pet treat/i,
  /legging/i, /clothing/i, /apparel/i, /luggage/i, /bag\b/i,
  /tool\b/i, /drill/i, /saw\b/i, /wrench/i, /fastener/i,
  /motor oil/i, /antifreeze/i, /car wash/i, /automotive/i,
  /notepad/i, /stationery/i, /pen\b/i, /pencil/i,
  /candle/i, /air freshener/i, /garbage bag/i,
  /barcode/i, /coupon/i, /scan/i,
  /bar soap/i, /hand soap/i, /body wash/i, /bath bomb/i,
  /razor\b/i, /shave/i, /nail\b/i,
  /vitamin c/i, /omega/i, /probiotic/i, /melatonin/i,
  /allergy/i, /cold\s+&\s+flu/i, /antacid/i, /laxative/i,
];

// ── Dietary filter: skip alcohol ──────────────────────────────────────────
const ALCOHOL_TERMS = [
  /\bwine\b/i, /\bbeer\b/i, /\bale\b/i, /\blager\b/i, /\bwhisky\b/i,
  /\bwhiskey\b/i, /\bvodka\b/i, /\brum\b/i, /\bgin\b/i, /\btequila\b/i,
  /\bbourbon\b/i, /\bspirit\b/i, /\bliquor\b/i, /\bchampagne\b/i,
  /\bprosecco\b/i, /\bcider\b/i, /\bmead\b/i, /\bbrewery\b/i,
];

// ── Category patterns (checked in order) ──────────────────────────────────
const CATEGORIES = [
  {
    key: 'Meat & Seafood',
    terms: [
      /chicken/i, /beef/i, /pork/i, /salmon/i, /fish/i, /shrimp/i, /prawn/i,
      /turkey/i, /lamb/i, /steak/i, /rib\b/i, /ribs\b/i, /sausage/i, /bacon/i,
      /ham\b/i, /cod\b/i, /tilapia/i, /tuna/i, /crab/i, /lobster/i, /scallop/i,
      /seafood/i, /brisket/i, /ground beef/i, /ground turkey/i, /ground pork/i,
      /meatball/i, /pepperoni/i, /salami/i, /prosciutto/i,
      /weakfish/i, /eel\b/i, /anchovy/i, /croaker/i, /squid/i, /pompano/i,
      /steelhead/i, /trout/i,
    ],
  },
  {
    key: 'Produce',
    terms: [
      /apple/i, /banana/i, /orange/i, /grape/i, /strawberr/i, /blueberr/i,
      /raspberr/i, /blackberr/i, /mango/i, /pineapple/i, /peach/i, /pear/i,
      /plum/i, /cherry/i, /watermelon/i, /melon/i, /avocado/i, /lemon/i, /lime/i,
      /tomato/i, /potato/i, /onion/i, /garlic/i, /ginger/i, /carrot/i,
      /broccoli/i, /cauliflower/i, /spinach/i, /lettuce/i, /kale/i, /cabbage/i,
      /pepper\b/i, /peppers\b/i, /zucchini/i, /eggplant/i, /squash/i, /corn\b/i,
      /cucumber/i, /celery/i, /mushroom/i, /asparagus/i, /bean\b/i, /pea\b/i,
      /sweet potato/i, /yam/i, /leek/i, /shallot/i, /beet\b/i,
      /herb\b/i, /basil/i, /cilantro/i, /parsley/i, /dill/i,
      /fruit\b/i, /vegetable/i, /produce/i, /fresh/i,
    ],
    exclude: [/fruit snack/i, /fruit punch/i, /fruit juice/i],
  },
  {
    key: 'Dairy',
    terms: [
      /\bmilk\b/i, /\begg\b/i, /\beggs\b/i, /\bbutter\b/i, /cheese/i, /yogurt/i,
      /yoghurt/i, /sour cream/i, /cream cheese/i, /cottage cheese/i,
      /\bcream\b/i, /whipping cream/i, /heavy cream/i,
      /brie/i, /cheddar/i, /gouda/i, /mozzarella/i, /parmesan/i, /parmigiano/i,
      /feta/i, /havarti/i, /bocconcini/i, /ricotta/i, /gorgonzola/i,
      /siggi/i, /skyr/i, /kefir/i, /ghee/i,
    ],
    exclude: [
      /milk chocolate/i, /coconut milk/i, /almond milk/i, /oat milk/i,
      /evaporated milk/i, /condensed milk/i, /chocolate milk/i, /breast milk/i,
      /milk.based/i, /milk powder/i, /goat.s milk bar soap/i,
      /ice milk/i, /peanut butter/i, /formula/i, /toddler/i,
      /egg roll/i, /egg noodle/i, /spring roll/i,
    ],
  },
  {
    key: 'Bakery',
    terms: [
      /bread/i, /loaf/i, /bun\b/i, /buns\b/i, /bagel/i, /muffin/i, /croissant/i,
      /pastry/i, /tortilla/i, /pita/i, /naan/i, /baguette/i, /sourdough/i,
      /rye\b/i, /multigrain/i, /flatbread/i, /wrap\b/i,
      /cake\b/i, /donut/i, /doughnut/i, /cookie\b/i, /crackers/i, /wafer/i,
    ],
  },
  {
    key: 'Frozen',
    terms: [
      /frozen/i, /ice cream/i, /gelato/i, /sorbet/i, /popsicle/i,
      /pizza\b/i, /lasagna/i, /entrée/i, /entree/i, /meal/i,
      /waffle/i, /nugget/i, /finger/i, /wing/i,
    ],
    exclude: [/fish sauce/i],
  },
  {
    key: 'Pantry',
    terms: [
      /pasta\b/i, /noodle/i, /rice\b/i, /flour\b/i, /oil\b/i, /vinegar/i,
      /sauce\b/i, /salsa/i, /classico/i, /ketchup/i, /mustard/i, /mayo/i,
      /mayonnaise/i, /soy sauce/i, /hot sauce/i, /worcestershire/i,
      /canned/i, /tomato/i, /bean\b/i, /lentil/i, /chickpea/i,
      /soup\b/i, /broth/i, /stock\b/i, /bouillon/i,
      /cereal/i, /oatmeal/i, /granola/i, /oat\b/i,
      /peanut butter/i, /jam\b/i, /jelly\b/i, /honey/i, /syrup/i, /maple/i,
      /chocolate\b/i, /cocoa/i, /nutella/i, /chips\b/i, /popcorn/i,
      /cracker/i, /pretzel/i, /nuts\b/i, /almond\b/i, /cashew/i, /walnut/i,
      /spice\b/i, /seasoning/i, /herb\b/i, /salt\b/i, /pepper\b/i,
      /sugar\b/i, /sweetener/i, /baking/i, /yeast/i,
      /fish sauce/i, /oyster sauce/i, /hoisin/i, /teriyaki/i,
      /coconut milk/i, /evaporated milk/i, /condensed milk/i,
    ],
  },
  {
    key: 'Beverages',
    terms: [
      /juice\b/i, /coffee\b/i, /tea\b/i, /water\b/i, /pop\b/i, /soda\b/i,
      /lemonade/i, /drink\b/i, /beverage/i, /sparkling/i, /smoothie/i,
      /milkshake/i, /kombucha/i, /energy drink/i, /sports drink/i, /gatorade/i,
      /powerade/i, /crystal light/i,
    ],
    exclude: [/\bwine\b/i, /\bbeer\b/i, /\bale\b/i, /\blager\b/i, /\bcider\b/i],
  },
];

// ── Staples list (for highlighting) ───────────────────────────────────────
const STAPLE_TERMS = [
  /chicken thigh/i,
  /classico/i,
  /scotch bonnet/i,
  // milk: actual dairy milk only, not coconut/almond/oat/evaporated/condensed
  /(?:whole|skim|2%|1%|homo|partly skimmed|lactose.free)\s+milk\b/i,
  /\bdairyland\b.*\bmilk\b|\bmilk\b.*\bdairyland\b/i,
  /\blactantia\b.*\bmilk\b|\bprairie farms milk\b/i,
  // eggs: cartons only (not egg rolls, egg noodles, egg whites labelled as creations etc.)
  /\beggs?,\s*\d+/i,
  /\blarge\s+egg/i,
  /\begg\b.*\d+['\s]?s\b(?!.*roll)/i,
  // butter: dairy butter products, not peanut butter, nut butter, etc.
  /(?<!peanut )(?<!nut )\bbutter\b(?! lettuce| danish| rice| tart| chicken| sauce| cream| cup| scotch| nut| bean)/i,
  /siggi/i,
  /gorgonzola/i,
  /balderson/i,
  /swiss delice/i,
  /que pasa/i,
  /\bno name\b.*flour\b|\bflour\b.*\bno name\b/i,
];

function isStaple(name) {
  return STAPLE_TERMS.some(t => t.test(name));
}

function isNonFood(name) {
  if (!name) return true;
  return NON_FOOD_TERMS.some(t => t.test(name));
}

function isAlcohol(name) {
  if (!name) return false;
  return ALCOHOL_TERMS.some(t => t.test(name));
}

function categorize(name) {
  if (!name) return null;
  for (const cat of CATEGORIES) {
    const matches = cat.terms.some(t => t.test(name));
    if (!matches) continue;
    if (cat.exclude && cat.exclude.some(t => t.test(name))) continue;
    return cat.key;
  }
  return null;
}

// ── Process stores ─────────────────────────────────────────────────────────
const storeStats = {};
const categorized = {};
CATEGORIES.forEach(c => { categorized[c.key] = []; });

// Track seen item keys for deduplication across stores (best price wins)
// key = normalized name; value = { idx, price }
const seenItems = new Map();

// Process food stores in priority order (cheaper/bigger stores first for dedup)
const STORE_ORDER = [
  'Real Canadian Superstore',
  'No Frills',
  'Safeway',      // keep instead of Sobeys
  'Calgary Co-op',
  'T&T Supermarket',
  'Wholesale Club',
  'Costco',
];

// For Wholesale Club/Costco, scale prices aren't per-unit so be selective
const BULK_STORES = new Set(['Wholesale Club', 'Costco']);

function normalizeItemKey(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(the|a|an|or|and|with|of|in|on|for|to|from|at|by|as)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 4)
    .join(' ');
}

for (const storeName of STORE_ORDER) {
  const store = raw.find(s => s.store_name === storeName);
  if (!store) continue;

  let kept = 0, dropped = 0;
  storeStats[storeName] = { kept: 0, dropped: 0 };

  for (const item of store.items) {
    if (!item.name || !item.price) { dropped++; continue; }
    if (isNonFood(item.name)) { dropped++; continue; }
    if (isAlcohol(item.name)) { dropped++; continue; }

    const category = categorize(item.name);
    if (!category) { dropped++; continue; }

    const price = parseFloat(item.price);
    if (isNaN(price) || price <= 0) { dropped++; continue; }

    // Skip obviously mega-bulk items from Wholesale Club unless staple
    if (BULK_STORES.has(storeName) && !isStaple(item.name)) {
      // Skip items over $30 from bulk stores (too large for household use)
      if (price > 30) { dropped++; continue; }
    }

    const key = normalizeItemKey(item.name);
    const existing = seenItems.get(key);

    if (existing) {
      // Keep if same category and this price is better
      if (existing.category === category && price < existing.price) {
        // Update with better price, note both stores
        const entry = categorized[category][existing.idx];
        entry.store_alt = `${entry.store} → ${storeName} @ $${item.price}`;
        entry.price = `$${item.price}`;
        entry.store = storeName;
        seenItems.set(key, { ...existing, price, storeName });
      } else if (existing.category === category) {
        // Mention alternative store
        const entry = categorized[existing.category][existing.idx];
        if (!entry.alt_stores) entry.alt_stores = [];
        entry.alt_stores.push({ store: storeName, price: `$${item.price}` });
      }
      dropped++;
      continue;
    }

    const entry = {
      name: item.name,
      brand: item.brand || null,
      price: `$${item.price}`,
      original_price: item.original_price ? `$${item.original_price}` : null,
      discount: item.discount || null,
      store: storeName,
      staple: isStaple(item.name),
      sale_start: store.sale_start,
      sale_end: store.sale_end,
      image_url: item.image_url || null,
    };

    const idx = categorized[category].length;
    categorized[category].push(entry);
    seenItems.set(key, { idx, category, price, storeName });
    kept++;
  }

  storeStats[storeName] = { kept, dropped };
}

// ── Rank items within each category ───────────────────────────────────────
function rankScore(item) {
  let score = 0;
  if (item.staple) score += 100;
  if (item.discount) score += Math.min(item.discount, 50);
  if (item.original_price) score += 20;
  return score;
}

for (const key of Object.keys(categorized)) {
  categorized[key].sort((a, b) => rankScore(b) - rankScore(a));
  // Cap at 20 per category
  categorized[key] = categorized[key].slice(0, 20);
}

// ── Remove empty categories ────────────────────────────────────────────────
for (const key of Object.keys(categorized)) {
  if (categorized[key].length === 0) delete categorized[key];
}

// ── Output ─────────────────────────────────────────────────────────────────
const today = new Date().toISOString().split('T')[0];
const output = { date: today, categories: categorized };
writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));

// ── Summary ────────────────────────────────────────────────────────────────
console.log('\n=== Phase 2: Classify Summary ===');
console.log('Store statistics:');
for (const [store, stats] of Object.entries(storeStats)) {
  console.log(`  ${store}: kept ${stats.kept}, dropped ${stats.dropped}`);
}
console.log('\nCategory totals:');
let totalKept = 0;
for (const [cat, items] of Object.entries(categorized)) {
  console.log(`  ${cat}: ${items.length} items`);
  totalKept += items.length;
}
const totalDropped = Object.values(storeStats).reduce((s, v) => s + v.dropped, 0);
console.log(`\nTotal: ${totalKept} kept, ${totalDropped} dropped`);
console.log(`\nWritten to ${OUT_PATH}`);
