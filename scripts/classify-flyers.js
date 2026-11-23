#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';

const RAW_INPUT = '/tmp/eventfinder-flyer-batch-flipp.json';
const CURATED_OUTPUT = '/tmp/eventfinder-flyer-curated.json';
const TODAY = new Date().toISOString().slice(0, 10);

// Staples from flyer-preferences.md
const STAPLES = [
  'chicken thigh', 'chicken thighs', 'boneless skinless',
  'classico', 'tomato sauce',
  'scotch bonnet', 'pepper', 'peppers',
  'milk', 'eggs', 'butter',
  "siggi's", 'siggis', 'siggi',
  'gorgonzola',
  'balderson',
  'swiss delice', 'dark chocolate',
  'que pasa', 'corn chip', 'corn chips',
  'no name flour', 'flour',
];

// Keywords to skip entirely
const SKIP_KEYWORDS = [
  // non-food
  'puzzle', 'game', 'toy', 'book', 'clothing', 'apparel', 'shoe', 'boots',
  'tools', 'hardware', 'paint', 'garden', 'lawn', 'snow', 'tire', 'automotive',
  'electronic', 'appliance', 'vacuum', 'television', 'tv ', 'laptop', 'tablet',
  'phone', 'headphone', 'speaker', 'printer', 'camera',
  'luggage', 'bag', 'backpack',
  'bed', 'pillow', 'blanket', 'towel', 'sheet',
  'furniture', 'lamp', 'curtain',
  'cleaning supply', 'laundry', 'detergent', 'dishwasher',
  'toilet paper', 'bathroom tissue', 'paper towel', 'tiger towel', 'royale',
  'kleenex', 'tissue',
  'shampoo', 'conditioner', 'hair ', 'makeup', 'cosmetic', 'lipstick',
  'toothpaste', 'toothbrush', 'floss', 'mouthwash', 'deodorant', 'razor',
  'sunscreen', 'lotion', 'cream', 'moisturizer',
  'vitamin', 'supplement', 'medicine', 'drug', 'advil', 'tylenol', 'robitussin',
  'bandage', 'first aid',
  'baby ', 'infant', 'diaper', 'formula',
  'pet food', 'dog food', 'cat food', 'pet supply', 'kibble',
  'candle', 'gift wrap', 'greeting card',
  'exercise', 'fitness', 'yoga', 'gym',
  'bicycle', 'bike',
  'bike lock',
  // pharmacy
  'pharmacy', 'health card', 'get offer',
];

// Alcohol keywords - skip per preferences
const ALCOHOL_KEYWORDS = [
  'wine', 'beer', 'spirits', 'whisky', 'whiskey', 'vodka', 'rum', 'gin',
  'tequila', 'brandy', 'cognac', 'champagne', 'prosecco', 'cider', 'mead',
  'ale', 'lager', 'stout', 'porter', 'ipa', 'pale ale',
  'liqueur', 'vermouth', 'port', 'sherry',
];

// Stores to skip entirely (non-food focused)
const SKIP_STORES = ['Canadian Tire', 'London Drugs', 'Co-op Wine Spirits Beer', 'Sobeys & Safeway Liquor', 'Shoppers Drug Mart'];

// Category classification
function categorize(name, brand) {
  const text = (name + ' ' + (brand || '')).toLowerCase();

  if (/chicken|beef|pork|lamb|turkey|duck|veal|bison|bacon|sausage|ham|salami|pepperoni|deli meat|roast|steak|ground|chop|rib|wing|drumstick|thigh|breast|tenderloin|shrimp|salmon|tuna|cod|halibut|tilapia|crab|lobster|scallop|oyster|mussel|clam|fish|seafood|meat/.test(text)) return 'Meat & Seafood';
  if (/apple|banana|orange|lemon|lime|grape|strawberr|blueberr|raspberr|blackberr|mango|pineapple|melon|watermelon|peach|pear|plum|cherry|avocado|tomato|lettuce|spinach|kale|broccoli|cauliflower|carrot|celery|cucumber|zucchini|pepper|onion|garlic|potato|sweet potato|yam|corn|mushroom|beet|radish|parsnip|turnip|cabbage|bok choy|ginger|herb|basil|cilantro|parsley|produce|vegetable|fruit|salad|greens/.test(text)) return 'Produce';
  if (/milk|cream|cheese|yogurt|yoghurt|butter|egg|eggs|margarine|sour cream|cottage cheese|cream cheese|ricotta|mozzarella|cheddar|parmesan|gouda|brie|camembert|gorgonzola|balderson|siggi|dairy/.test(text)) return 'Dairy';
  if (/bread|bun|roll|bagel|muffin|croissant|pastry|cake|cookie|doughnut|donut|tortilla|pita|naan|wrap|baguette|loaf|bakery|bakehouse/.test(text)) return 'Bakery';
  if (/frozen|ice cream|gelato|sorbet|popsicle|freeze|frigid/.test(text)) return 'Frozen';
  if (/juice|pop|soda|cola|water|coffee|tea|energy drink|sport drink|lemonade|kombucha|broth|stock|drink|beverage/.test(text)) return 'Beverages';
  // Default to Pantry
  return 'Pantry';
}

function matchesStaple(name, brand) {
  const text = (name + ' ' + (brand || '')).toLowerCase();
  return STAPLES.some(s => text.includes(s));
}

function shouldSkip(name, brand) {
  const text = (name + ' ' + (brand || '')).toLowerCase();
  if (SKIP_KEYWORDS.some(k => text.includes(k))) return true;
  if (ALCOHOL_KEYWORDS.some(k => text.includes(k))) return true;
  return false;
}

// Format price string
function formatPrice(price, priceUnit) {
  if (!price) return null;
  const p = parseFloat(price);
  if (isNaN(p)) return price;
  const formatted = '$' + p.toFixed(2);
  if (priceUnit) return formatted + '/' + priceUnit;
  return formatted;
}

const raw = JSON.parse(readFileSync(RAW_INPUT, 'utf8'));

// Skip stores with no food content and liquor stores
const foodStores = raw.filter(s => !SKIP_STORES.includes(s.store_name) && s.items.length > 0);

// Deduplicate Safeway/Sobeys - keep Safeway, drop Sobeys
const deduped = foodStores.filter(s => s.store_name !== 'Sobeys');

const stats = {};
const allItems = [];

for (const store of deduped) {
  let kept = 0, dropped = 0;
  const seen = new Set();

  for (const item of store.items) {
    if (!item.price || !item.name) { dropped++; continue; }

    const name = item.name.trim();
    const key = name.toLowerCase() + '|' + store.store_name;
    if (seen.has(key)) { dropped++; continue; }
    seen.add(key);

    if (shouldSkip(name, item.brand)) { dropped++; continue; }

    const category = categorize(name, item.brand);
    const isStaple = matchesStaple(name, item.brand);
    const discountPct = item.discount || 0;

    allItems.push({
      name,
      brand: item.brand || null,
      price: formatPrice(item.price, item.price_unit),
      original_price: item.original_price ? formatPrice(item.original_price) : null,
      discount: discountPct,
      store: store.store_name,
      category,
      isStaple,
      sale_start: store.sale_start,
      sale_end: store.sale_end,
      image_url: item.image_url || null,
      raw_price: parseFloat(item.price),
    });
    kept++;
  }

  stats[store.store_name] = { kept, dropped, total: store.items.length };
}

// Now deduplicate cross-store: same item name, keep best price, note alternatives
const byItemName = {};
for (const item of allItems) {
  const key = item.name.toLowerCase().slice(0, 40);
  if (!byItemName[key]) {
    byItemName[key] = { ...item, alternatives: [] };
  } else {
    const existing = byItemName[key];
    if (item.raw_price < existing.raw_price) {
      existing.alternatives.push({ store: existing.store, price: existing.price });
      byItemName[key] = { ...item, alternatives: existing.alternatives };
    } else {
      existing.alternatives.push({ store: item.store, price: item.price });
    }
  }
}

const deduplicatedItems = Object.values(byItemName);

// Categorize and rank
const categories = {
  'Meat & Seafood': [],
  'Produce': [],
  'Dairy': [],
  'Bakery': [],
  'Frozen': [],
  'Pantry': [],
  'Beverages': [],
};

for (const item of deduplicatedItems) {
  const cat = categories[item.category];
  if (cat) cat.push(item);
}

// Sort each category: staples first, then by discount %, then by price
const CAP = 20;
for (const cat of Object.keys(categories)) {
  categories[cat].sort((a, b) => {
    if (a.isStaple !== b.isStaple) return a.isStaple ? -1 : 1;
    if (b.discount !== a.discount) return b.discount - a.discount;
    return a.raw_price - b.raw_price;
  });
  categories[cat] = categories[cat].slice(0, CAP);
}

// Remove raw_price from output
for (const cat of Object.keys(categories)) {
  categories[cat] = categories[cat].map(({ raw_price, ...rest }) => rest);
}

const output = { date: TODAY, categories };
writeFileSync(CURATED_OUTPUT, JSON.stringify(output, null, 2));

// Print stats
let totalKept = 0, totalDropped = 0;
for (const [store, s] of Object.entries(stats)) {
  console.log(store + ': kept ' + s.kept + ', dropped ' + s.dropped + ' (of ' + s.total + ')');
  totalKept += s.kept;
  totalDropped += s.dropped;
}
console.log('\nCategory counts:');
let grandTotal = 0;
for (const [cat, items] of Object.entries(categories)) {
  console.log('  ' + cat + ': ' + items.length);
  grandTotal += items.length;
}
console.log('\nTotal kept before dedup: ' + totalKept + ', dropped: ' + totalDropped);
console.log('Total after dedup + cap: ' + grandTotal);
console.log('Written to ' + CURATED_OUTPUT);
