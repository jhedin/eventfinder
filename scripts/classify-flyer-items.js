#!/usr/bin/env node
/**
 * Phase 2: Classify flyer items from raw Flipp data
 * Reads /tmp/eventfinder-flyer-batch-flipp.json
 * Writes /tmp/eventfinder-flyer-curated.json
 */

import { readFileSync, writeFileSync } from 'fs';

const RAW_PATH = '/tmp/eventfinder-flyer-batch-flipp.json';
const OUT_PATH = '/tmp/eventfinder-flyer-curated.json';

// Stores to skip entirely (non-food / liquor)
const SKIP_STORES = ['Canadian Tire', 'London Drugs', 'Co-op Wine Spirits Beer', 'Sobeys & Safeway Liquor'];

// Sobeys = Safeway duplicate — drop Sobeys, keep Safeway
const DEDUPE_DROP = ['Sobeys'];

// Staples keywords (case-insensitive substring match)
const STAPLES = [
  'chicken thigh', 'classico', 'scotch bonnet',
  // milk/eggs/butter: match only when not part of another word
  ' milk', 'whole milk', '2% milk', 'skim milk',
  ' eggs', 'free run eggs', 'cage free eggs', 'dozen eggs',
  // standalone butter (not peanut/almond butter)
  ' butter', 'unsalted butter', 'salted butter',
  "siggi's", 'siggis', 'gorgonzola', 'balderson', 'swiss delice', 'swiss délice',
  'que pasa', 'no name flour',
];

// Stores ranked by how grocery-focused they are (higher = better deals to surface first)
const STORE_TIER = {
  'No Frills': 10,
  'Real Canadian Superstore': 10,
  'Calgary Co-op': 9,
  'Safeway': 9,
  'Wholesale Club': 8,
  'T&T Supermarket': 8,
  'Shoppers Drug Mart': 3,
};

// Build regex from keyword — use word-boundary for short ones to avoid false matches
function makeKeywordRegex(kw) {
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Short keywords (<=5 chars) get word boundaries to avoid substring false-matches
  if (kw.length <= 5) return new RegExp(`\\b${escaped}\\b`, 'i');
  return new RegExp(escaped, 'i');
}

// Keywords that indicate non-food / items to skip
const SKIP_PATTERNS = [
  // Electronics & tech
  /\bairpods?\b/i, /\bipad\b/i, /\biphone\b/i, /\bmacbook\b/i, /\bapple watch\b/i,
  /\bheadphones?\b/i, /\bearbuds?\b/i, /\bspeaker(s)?\b/i, /\bcharger\b/i,
  /\blaptop\b/i, /\btablet\b/i, /\bkeyboard\b/i, /\bmouse\b/i, /\btelevision\b/i,
  /\bsmartphone\b/i, /\belectronics?\b/i, /\bcamera\b/i, /\bprinter\b/i,
  // Beauty & cosmetics
  /\bskin care\b/i, /\bface cream\b/i, /\bfacial\b/i, /\bserum\b/i, /\bmoisturizer\b/i,
  /\bmascara\b/i, /\blipstick\b/i, /\blip gloss\b/i, /\blip liner\b/i, /\beye shadow\b/i,
  /\bfoundation\b/i, /\bblush\b/i, /\bconcealer\b/i, /\bmakeup\b/i,
  /\bperfume\b/i, /\bcologne\b/i, /\bfragrance\b/i, /\bafter\s*shave\b/i,
  /\bshampoo\b/i, /\bconditioner\b/i, /\bhair colou?r\b/i, /\bhair dye\b/i, /\bhair care\b/i,
  /\bsunscreen\b/i, /\bspf\b/i, /\bself.?tan\b/i, /tanning micromist/i,
  /\blotion\b/i, /\bbody wash\b/i, /\bscrub\b/i, /\bdeodorant\b/i, /\bantiperspirant\b/i,
  /lancôme/i, /\bfilorga\b/i, /\btoo faced\b/i, /\bnyx\b/i, /\bmaybelline\b/i,
  /\bloreal\b/i, /l'oréal/i, /\brevlon\b/i, /\bolay\b/i, /\bneutrogena\b/i,
  /hugo boss/i, /\bcarnaby sweet\b/i,
  /\bgift set\b/i, /\bgift\s+pack\b/i, /fragrance gift/i,
  // Pharmacy / health
  /\bvitamin\b/i, /\bsupplement\b/i, /\btylenol\b/i, /\badvil\b/i, /\bibuprofen\b/i,
  /\baspir[ei]n\b/i, /\bantacid\b/i, /\bcold \&? flu\b/i, /\bmelatonin\b/i, /\bprobiotics\b/i,
  /\bpharmacy\b/i, /\bmedication\b/i, /pain reliev/i, /\balevex\b/i,
  // Baby
  /\bbaby formula\b/i, /\bbaby food\b/i, /\bdiapers?\b/i, /\bwipes\b/i,
  // Pet
  /\bpet food\b/i, /\bdog food\b/i, /\bcat food\b/i, /\bkitty litter\b/i, /\bbird seed\b/i,
  // Household non-food
  /\blaundry\b/i, /\bdishwasher detergent\b/i, /\bcleaning supplies\b/i,
  /\bgarbage bags?\b/i, /\btrash bags?\b/i, /\bpaper towels?\b/i, /\btoilet paper\b/i,
  /\btissue\b/i, /\bbatteries\b/i, /\blightbulb\b/i, /\bextension cord\b/i,
  /\bmotor oil\b/i, /\bantifreeze\b/i, /\bwindshield washer\b/i,
  /\bclothing\b/i, /\bapparel\b/i, /\bshoes\b/i, /\bboots\b/i, /\bjacket\b/i,
  // K-pop / merch / toys / games
  /k-?pop/i, /\bplush\b/i, /\bfunko\b/i, /\bmerch\b/i, /\baction figure\b/i,
  /hot wheels/i, /\bplayset\b/i, /\btoy\b/i, /\bgame(s)?\b/i, /\bpuzzle\b/i,
  // Candy / confectionery
  /chocolate covered/i, /\bkinder surprise\b/i, /\bkinder bueno\b/i, /\bkinder\b/i,
  /\bcadbury\b/i, /chocolate bar/i,
  // Condiments that false-match bakery patterns
  /bread & butter pickle/i, /bread 'n' butter pickle/i,
  // Sweets/candy (not chocolate cooking)
  /\bgummy candy\b/i, /\bhard candy\b/i, /\bscotch mints\b/i, /\bjelly beans\b/i,
  /\bhalloween candy\b/i, /\bcandy bag\b/i,
  // Alcohol
  /\bbeer\b/i, /\bwine\b/i, /\bspirits\b/i, /\bvodka\b/i, /\bwhisk(e)?y\b/i,
  /\brum\b/i, /\bgin\b/i, /\btequila\b/i, /\bhigh\s?proof\b/i, /\bale\b/i, /\blager\b/i,
];

function shouldSkip(itemName) {
  return SKIP_PATTERNS.some(re => re.test(itemName));
}

// Category classification — ordered by priority (Bakery before Produce so "danish+apple" → Bakery)
// Using word-boundary regex for short keywords
const CATEGORY_RULES = [
  {
    name: 'Meat & Seafood',
    patterns: [
      /chicken/i, /\bbeef\b/i, /\bpork\b/i, /\blamb\b/i, /\bturkey\b/i, /\bduck\b/i,
      /\bbison\b/i, /\bveal\b/i, /\bsalmon\b/i, /\btilapia\b/i, /\bshrimp\b/i,
      /\bprawn\b/i, /\bcrab\b/i, /\blobster\b/i, /\bcod\b/i, /\bhalibut\b/i,
      /\btuna\b/i, /\btrout\b/i, /\bhaddock\b/i, /\bpollock\b/i, /\bscallop\b/i,
      /\bclam\b/i, /\bmussel\b/i, /\bsteak\b/i, /\brib(s)?\b/i, /\btenderloin\b/i,
      /ground beef/i, /ground turkey/i, /ground pork/i, /\bsausage\b/i, /\bbacon\b/i,
      /\bham\b/i, /\bpepperoni\b/i, /\bsalami\b/i, /deli meat/i, /cold cut/i,
      /\bhot dog\b/i, /\bwiener\b/i, /rotisserie/i, /\bdrumstick\b/i, /\bwing(s)?\b/i,
      /boneless.{0,20}breast/i, /boneless.{0,20}thigh/i, /fish fillet/i,
      /\bbasa\b/i, /\bmilkfish\b/i, /\bseafood\b/i,
    ],
  },
  {
    name: 'Frozen',
    patterns: [
      /\bfrozen\b/i, /ice cream/i, /\bgelato\b/i, /\bsorbet\b/i, /\bpopsicle\b/i,
      /\bedamame\b/i, /\bpierogi/i, /\bperogi/i, /\bbreyers\b/i, /\btalenti\b/i,
      /\bhungry.?man\b/i,
    ],
  },
  {
    name: 'Bakery',
    patterns: [
      /\bbread\b(?! ?&? ?butter pickle)/i, /\bbuns?\b/i, /\brolls?\b/i,
      /\bbagel(s)?\b/i, /\bmuffin(s)?\b/i, /\bcroissants?\b/i, /\bbaguettes?\b/i,
      /\bloaf\b/i, /\bpita\b/i, /\bnaan\b/i, /\btortilla\b/i,
      /\bcake\b(?! mix\b)/i, /\bpastry\b/i, /\bdanish\b/i,
      /\bdoughnut\b/i, /\bdonut\b/i, /\bcookie\b/i, /\bbrownie\b/i,
      /\bflour\b(?! tortilla)/i, /\byeast\b/i, /\bbakery\b/i, /\bsourdough\b/i,
      /\bpie\b(?!ce)/i, /butter tart/i,
    ],
  },
  {
    name: 'Produce',
    patterns: [
      /\bapple(s)?\b/i, /\bpear(s)?\b/i, /\borange(s)?\b/i, /\bbanana(s)?\b/i,
      /\bgrape(s)?\b/i, /\bstrawberr/i, /\bblueberr/i, /\braspberr/i,
      /\bmango(s|es)?\b/i, /\bpineapple\b/i, /\bwatermelon\b/i, /\bmelon\b/i,
      /\bpeach(es)?\b/i, /\bplum(s)?\b/i, /\bcherry\b/i, /\bkiwi\b/i,
      /\bavocado\b/i, /\blemon(s)?\b/i, /\blime(s)?\b/i, /\bgrapefruit\b/i,
      /\btomato(es)?\b(?! sauce| paste| soup| can)/i,
      /\bpotato(es)?\b(?! chip)/i, /\bonion(s)?\b/i, /\bgarlic\b/i,
      /\bcarrot(s)?\b/i, /\bcelery\b/i, /\bbroccoli\b/i, /\bcauliflower\b/i,
      /\bspinach\b/i, /\bkale\b/i, /\blettuce\b/i, /salad mix/i, /\barugula\b/i,
      /\bcucumber\b/i, /\bzucchini\b/i, /\bsquash\b(?! sauce)/i, /\bpumpkin\b/i,
      /\basparagus\b/i, /\bartichoke\b/i, /\bbeet(s)?\b/i, /\bradish\b/i,
      /\bparsnip\b/i, /\bfennel\b/i, /\bleek(s)?\b/i, /\bshallot\b/i,
      /\bbell pepper\b/i, /\bjalapen/i, /\bscotch bonnet\b/i, /\bhabanero\b/i,
      /\bmushroom\b/i, /\beggplant\b/i, /sweet potato/i, /\bbok choy\b/i,
      /\bcabbage\b/i, /brussels sprout/i, /\bginger root\b/i,
      /\bcilantro\b/i, /\bparsley\b/i, /\bbasil\b/i, /\bdill\b/i, /\bthyme\b/i,
      /\bfresh produce\b/i,
    ],
  },
  {
    name: 'Dairy',
    patterns: [
      /\bmilk\b/i, /\bcream\b/i,
      // "butter" only — exclude peanut butter, almond butter, hazelnut butter, etc.
      /(?<!(peanut|almond|cashew|hazelnut|sunflower|nut|apple) )butter\b(?! ?(nut|milk|cup|scotch|finger|spread|tart|chicken))/i,
      /\bcheese\b/i, /\bcheddar\b/i, /\bmozzarella\b/i, /\bparmesan\b/i,
      /\bbrie\b/i, /\bcamembert\b/i, /\bfeta\b/i, /\bgouda\b/i, /\bhavarti\b/i,
      /swiss cheese/i, /\bgorgonzola\b/i, /\bbalderson\b/i,
      /\byogurt\b/i, /\byoghurt\b/i, /\bsiggi/i, /sour cream/i, /cottage cheese/i,
      /\bricotta\b/i, /cream cheese/i, /\begg(s)?\b/i, /half & half/i,
      /whipping cream/i, /coffee cream/i, /condensed milk/i,
      /\boat milk\b/i, /\balmond milk\b/i, /\bsoy milk\b/i,
    ],
  },
  {
    name: 'Pantry',
    patterns: [
      /\bpasta\b/i, /\bnoodles?\b/i, /\brice\b/i, /\bquinoa\b/i,
      /\blentils?\b/i, /\bbeans?\b/i, /\bchickpea\b/i,
      /\bolive oil\b/i, /\bvegetable oil\b/i, /\bcanola oil\b/i, /\bcoconut oil\b/i,
      /\bvinegar\b/i, /\bsoy sauce\b/i, /\bhot sauce\b/i, /\bketchup\b/i,
      /\bmustard\b/i, /\bmayonnaise\b/i, /\bsalsa\b/i,
      /\bclassico\b/i, /pasta sauce/i, /tomato sauce/i, /tomato paste/i,
      /canned tomato/i, /diced tomato/i, /crushed tomato/i,
      /\bcanned\b/i, /\bbroth\b/i, /\bstock\b/i, /\bsoup\b/i,
      /\bcereal\b/i, /\boatmeal\b/i, /\boat(s)?\b/i, /\bgranola\b/i,
      /peanut butter/i, /almond butter/i, /\bjam\b/i, /\bjelly\b/i, /\bhoney\b/i,
      /maple syrup/i, /\bsugar\b/i, /\bspices?\b/i, /\bseasoning\b/i,
      /\bchips?\b/i, /\bcrackers?\b/i, /\bpopcorn\b/i, /\bpretzels?\b/i,
      /corn chip/i, /\bque pasa\b/i, /\bnachos?\b/i,
      /\bnuts?\b/i, /\balmonds?\b/i, /\bwalnuts?\b/i, /\bcashews?\b/i, /\bpecans?\b/i,
      /\bpistachios?\b/i, /dried fruit/i, /\braisins?\b/i,
      /\bcoffee\b/i, /\btea\b/i, /\bcocoa\b/i, /chocolate chip/i,
      /baking soda/i, /baking powder/i, /\bcornstarch\b/i, /\bbouillon\b/i, /\bgravy\b/i,
      /no name flour/i,
    ],
  },
  {
    name: 'Beverages',
    patterns: [
      /\bjuice\b/i, /sparkling water/i, /(?<![-k])\bpop\b(?! corn| ?music)/i,
      /\bcola\b/i, /\bsprite\b/i, /\bgatorade\b/i, /\bpowerade\b/i,
      /energy drink/i, /\bkombucha\b/i, /\blemonade\b/i, /\bsmoothie\b/i,
      /\bpepsi\b/i, /\bcoca.?cola\b/i, /\bred bull\b/i, /\bmonster energy\b/i, /\bguru\b/i,
      /\bbeverages?\b/i,
    ],
  },
];

const STAPLE_PATTERNS = [
  /\bchicken thigh/i,
  /\bclassico\b/i,
  /\bscotch bonnet/i,
  // milk — standalone (not "coconut milk", "almond milk", etc.)
  /(?<!(coconut|almond|oat|soy|rice|cashew|chocolate) )\bmilk\b/i,
  // eggs — standalone
  /\begg(s)?\b/i,
  // butter — standalone (not peanut/almond/nut butter)
  /(?<!(peanut|almond|cashew|hazelnut|sunflower|nut|apple) )\bbutter\b(?! ?(nut|milk|cup|scotch|tart|spread|chicken))/i,
  /siggi/i,
  /\bgorgonzola\b/i,
  /\bbalderson\b/i,
  /swiss del[ìi]ce/i,
  /\bque pasa\b/i,
  /no name flour/i,
];

function isStaple(itemName) {
  return STAPLE_PATTERNS.some(re => re.test(itemName));
}

function classifyCategory(itemName) {
  for (const cat of CATEGORY_RULES) {
    if (cat.patterns.some(re => re.test(itemName))) {
      return cat.name;
    }
  }
  return null;
}

function formatPrice(price) {
  if (!price) return null;
  const n = parseFloat(price);
  if (isNaN(n)) return price;
  return '$' + n.toFixed(2);
}

function discountPct(price, originalPrice) {
  if (!price || !originalPrice) return null;
  const p = parseFloat(price);
  const o = parseFloat(originalPrice);
  if (isNaN(p) || isNaN(o) || o <= 0) return null;
  return Math.round(((o - p) / o) * 100);
}

function main() {
  const raw = JSON.parse(readFileSync(RAW_PATH, 'utf8'));

  const stats = {};
  const categorized = {};
  for (const cat of CATEGORY_RULES) categorized[cat.name] = [];

  const processedStores = raw.filter(s => {
    if (SKIP_STORES.includes(s.store_name)) return false;
    if (DEDUPE_DROP.includes(s.store_name)) return false;
    return true;
  });

  for (const store of processedStores) {
    let kept = 0;

    for (const item of store.items) {
      const name = item.name || '';
      if (!item.price) continue;
      if (shouldSkip(name)) continue;

      const category = classifyCategory(name);
      if (!category) continue;

      const pct = discountPct(item.price, item.original_price);
      const staple = isStaple(name);

      categorized[category].push({
        name,
        brand: item.brand || null,
        price: formatPrice(item.price),
        original_price: formatPrice(item.original_price),
        discount_pct: pct,
        store: store.store_name,
        staple,
        sale_start: store.sale_start,
        sale_end: store.sale_end,
        image_url: item.image_url || null,
        raw_price: item.price,
        raw_original: item.original_price,
      });
      kept++;
    }
    const dropped = store.items.length - kept;
    stats[store.store_name] = { kept, dropped, total: store.items.length };
  }

  for (const store of raw) {
    if (SKIP_STORES.includes(store.store_name) || DEDUPE_DROP.includes(store.store_name)) {
      stats[store.store_name] = { kept: 0, dropped: store.items.length, total: store.items.length, skipped: true };
    }
  }

  // Sort and dedupe each category
  for (const [catName, items] of Object.entries(categorized)) {
    items.sort((a, b) => {
      if (a.staple && !b.staple) return -1;
      if (!a.staple && b.staple) return 1;
      const aDisc = a.discount_pct || (a.original_price ? 1 : 0);
      const bDisc = b.discount_pct || (b.original_price ? 1 : 0);
      if (bDisc !== aDisc) return bDisc - aDisc;
      // Tiebreak: prefer grocery stores over drugstores
      const aTier = STORE_TIER[a.store] || 5;
      const bTier = STORE_TIER[b.store] || 5;
      return bTier - aTier;
    });

    // Dedupe same item name across stores — keep best price, note alternates
    const seen = new Map();
    const deduped = [];
    for (const item of items) {
      const key = item.name.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.set(key, item);
        deduped.push(item);
      } else {
        const existing = seen.get(key);
        if (!existing.alternates) existing.alternates = [];
        existing.alternates.push({ store: item.store, price: item.price });
      }
    }

    categorized[catName] = deduped.slice(0, 20);
  }

  // Build output
  const output = {
    date: new Date().toISOString().slice(0, 10),
    categories: {},
  };

  for (const [catName, items] of Object.entries(categorized)) {
    if (items.length === 0) continue;
    output.categories[catName] = items.map(item => {
      const entry = {
        name: item.name,
        price: item.price,
        store: item.store,
      };
      if (item.staple) entry.staple = true;
      if (item.brand) entry.brand = item.brand;
      if (item.original_price) entry.original_price = item.original_price;
      if (item.discount_pct) entry.discount_pct = item.discount_pct;
      if (item.alternates) entry.alternates = item.alternates;
      if (item.sale_start) entry.sale_start = item.sale_start;
      if (item.sale_end) entry.sale_end = item.sale_end;
      if (item.image_url) entry.image_url = item.image_url;
      return entry;
    });
  }

  writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));

  console.log('\n=== Phase 2: Classification Stats ===\n');
  let totalKept = 0, totalDropped = 0;
  for (const [store, s] of Object.entries(stats)) {
    const tag = s.skipped ? ' [SKIPPED]' : '';
    console.log(`  ${store}${tag}: kept ${s.kept}, dropped ${s.dropped} of ${s.total}`);
    totalKept += s.kept;
    totalDropped += s.dropped;
  }
  console.log(`\nTotal: kept ${totalKept}, dropped ${totalDropped}`);
  console.log('\n=== Items per Category ===\n');
  for (const [cat, items] of Object.entries(output.categories)) {
    console.log(`  ${cat}: ${items.length} items`);
  }
  console.log(`\nWritten to ${OUT_PATH}`);
}

main();
