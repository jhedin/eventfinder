#!/usr/bin/env node
/**
 * write-curated-flyers.js
 * LLM-authored curation step: reads candidates, applies preferences, writes curated JSON.
 */

import { writeFileSync } from 'fs';

// Curated output based on flyer-preferences.md:
// Staples: chicken thighs, Classico tomato sauces, peppers, milk/eggs/butter,
//   Siggi's yogurt, Gorgonzola, Balderson's cheddar, Swiss Delice dark chocolate,
//   Que Pasa corn chips, No Name flour
// Also interested: meat/seafood, produce, pantry staples on deep discount
// Skip: candy, pharmacy/beauty, alcohol, non-food, baby products, pet

const output = {
  date: "2026-10-12",
  highlights: [
    // Staples on sale + best overall value picks
    { name: "COMPLIMENTS Bone-In Chicken Thighs", price: "$4.49/lb", original_price: null, store: "Safeway" },
    { name: "Classico Sauce 410/600ml", price: "$2.97", original_price: null, store: "No Frills" },
    { name: "SIGGI'S Skyr Yogurt 650/750g", price: "$6.50", original_price: null, store: "No Frills" },
    { name: "No Name Flour", price: "$9.49", original_price: null, store: "Wholesale Club" },
    { name: "Burnbrae Farms NatureGG Eggs 12's", price: "$5.00", original_price: null, store: "No Frills" },
    { name: "Lactantia Butter", price: "$7.99", original_price: null, store: "Calgary Co-op" },
    { name: "Wild Sockeye Salmon Fillets", price: "$5.99", original_price: null, store: "Safeway" },
    { name: "Whole Maple Baked Ham", price: "$1.49/lb", original_price: null, store: "Safeway" },
    { name: "Barilla Pasta 340/410g", price: "$1.97", original_price: null, store: "Real Canadian Superstore" },
    { name: "Broccoli Crowns", price: "$1.99", original_price: null, store: "Real Canadian Superstore" },
  ],
  categories: {
    "Meat & Seafood": [
      // STAPLE: Chicken thighs — best price at Safeway (bone-in, $4.49/lb)
      { name: "COMPLIMENTS Fresh AIR-CHILLED Bone-In Chicken Thighs", brand: "Compliments", price: "$4.49/lb", original_price: null, store: "Safeway" },
      { name: "Chicken Thighs", brand: null, price: "$6.99", original_price: null, store: "Save-On-Foods" },
      // Chicken breast
      { name: "Marinated Chicken Breast", brand: null, price: "$5.99", original_price: null, store: "Save-On-Foods" },
      { name: "MAPLE LEAF PRIME Boneless Skinless Chicken Breast, up to 508g", brand: "Maple Leaf", price: "$8.00", original_price: null, store: "No Frills" },
      // Chicken leg quarters — great deal
      { name: "Chicken Leg Quarters", brand: null, price: "$2.99/lb", original_price: null, store: "Real Canadian Superstore" },
      // Ground chicken/lean pork combo
      { name: "Ground Chicken 454g or Lean Pork 670g", brand: null, price: "$4.00", original_price: null, store: "No Frills" },
      // Pork
      { name: "Whole Pork Tenderloin or Button Bones", brand: null, price: "$3.99/lb", original_price: null, store: "Calgary Co-op" },
      { name: "Fresh Boneless Pork Loin Centre & Rib Combo Chops or Shoulder Blade Roast Family Size", brand: null, price: "$3.99/lb", original_price: null, store: "Safeway" },
      { name: "Pork Side Ribs", brand: null, price: "$3.66/lb", original_price: null, store: "T&T Supermarket" },
      // Whole ham — exceptional deal
      { name: "Whole Maple Baked Ham", brand: null, price: "$1.49/lb", original_price: null, store: "Safeway" },
      // Bacon
      { name: "Bacon", brand: "Maple Leaf | Schneiders", price: "$4.99", original_price: null, store: "Safeway" },
      // Beef
      { name: "Fresh Lean Ground Beef", brand: null, price: "$6.99", original_price: null, store: "Safeway" },
      // Salmon — great deal
      { name: "Wild Sockeye Salmon Fillets", brand: null, price: "$5.99", original_price: null, store: "Safeway" },
      { name: "Chinook Salmon Fillets", brand: null, price: "$3.79/lb", original_price: null, store: "Calgary Co-op" },
      // Lobster tails — specialty
      { name: "Atlantic Canada 3–4 oz. Lobster Tail", brand: null, price: "$8.99/ea", original_price: null, store: "Safeway" },
    ],
    "Produce": [
      // Basics
      { name: "Broccoli Crowns", brand: null, price: "$1.99", original_price: null, store: "Real Canadian Superstore" },
      { name: "Cauliflower", brand: null, price: "$2.99", original_price: null, store: "Safeway" },
      { name: "Green Cabbage", brand: null, price: "$0.79", original_price: null, store: "No Frills" },
      { name: "Jumbo Carrot", brand: null, price: "$0.94", original_price: null, store: "Real Canadian Superstore" },
      { name: "Orange Sweet Potatoes", brand: null, price: "$1.99/lb", original_price: null, store: "Safeway" },
      { name: "Kale, Red or Green Swiss Chard or Fennel", brand: null, price: "$3.77", original_price: null, store: "Safeway" },
      // Fruit
      { name: "Navel Orange", brand: null, price: "$1.28", original_price: null, store: "T&T Supermarket" },
      { name: "Whole Pineapple, 3.8kg", brand: null, price: "$4.97", original_price: null, store: "Real Canadian Superstore" },
      { name: "Ataulfo Mango", brand: null, price: "$4.88", original_price: null, store: "T&T Supermarket" },
      { name: "Green or Black Grapes", brand: null, price: "$3.88/lb", original_price: null, store: "T&T Supermarket" },
      // Unusual / specialty — flagged per preferences
      { name: "Shine Muscat Grape", brand: null, price: "$9.88", original_price: null, store: "T&T Supermarket" },
      { name: "Chanterelle Mushroom, 100g", brand: null, price: "$4.98", original_price: null, store: "T&T Supermarket" },
      { name: "Chinese White Radish", brand: null, price: "$0.88/lb", original_price: null, store: "T&T Supermarket" },
      { name: "Cherry Tomatoes, 1.5lb", brand: null, price: "$3.99", original_price: null, store: "T&T Supermarket" },
    ],
    "Dairy": [
      // STAPLE: Siggi's yogurt
      { name: "IÖGO Yogurt 16x100g OR SIGGI'S Skyr Yogurt 650/750g", brand: "Siggi's", price: "$6.50", original_price: null, store: "No Frills" },
      // Butter
      { name: "Lactantia Butter", brand: "Lactantia", price: "$7.99", original_price: null, store: "Calgary Co-op" },
      // Eggs
      { name: "Burnbrae Farms NatureGG Nest Laid White Eggs, 12's", brand: "Burnbrae Farms", price: "$5.00", original_price: null, store: "No Frills" },
      // Cheese — closest to preferences (no Balderson's or Gorgonzola found, but good alternatives)
      { name: "Cracker Barrel Cheese Bars 400g or Shreds 300/320g", brand: "Cracker Barrel", price: "$5.97", original_price: null, store: "Real Canadian Superstore" },
      { name: "Castello Havarti, Cheddar or Blue Cheese 125–200g", brand: "Castello", price: "$6.00", original_price: null, store: "Real Canadian Superstore" },
      { name: "Blue Cheese", brand: "Castello", price: "$6.99", original_price: null, store: "Safeway" },
      { name: "Boursin Soft Cheese 150/220g", brand: "Boursin", price: "$4.67", original_price: null, store: "No Frills" },
      { name: "Cream Cheese", brand: "Philadelphia", price: "$3.99", original_price: null, store: "Safeway" },
      // Yogurt alternatives
      { name: "Liberté Greek 650/750g or Méditerranée 900g Yogurt", brand: "Liberté", price: "$6.97", original_price: null, store: "Real Canadian Superstore" },
    ],
    "Bakery": [
      { name: "White Bread or 100% Whole Wheat Sliced", brand: null, price: "$2.49", original_price: null, store: "Save-On-Foods" },
      { name: "White or Whole Wheat, Texas Toast or Sandwich Bread", brand: "Dempster's", price: "$2.99", original_price: null, store: "Safeway" },
      { name: "Country Harvest Bread 600g or Bagels 6's", brand: "Country Harvest", price: "$3.00", original_price: null, store: "No Frills" },
      { name: "PC Bread or Buns 565/675g", brand: "PC", price: "$4.00", original_price: null, store: "Real Canadian Superstore" },
      { name: "Farmhouse Sourdough", brand: "Farmhouse", price: "$7.00", original_price: null, store: "Calgary Co-op" },
      { name: "Tenderflake Pie Shells 255–397g", brand: "Tenderflake", price: "$2.97", original_price: null, store: "Real Canadian Superstore" },
      { name: "Byblos Protein, Balady 10\" White or Whole Wheat Pita", brand: "Byblos", price: "$1.99", original_price: null, store: "Calgary Co-op" },
    ],
    "Frozen": [
      { name: "PC Frozen Vegetables 400–750g", brand: "PC", price: "$2.99", original_price: null, store: "Real Canadian Superstore" },
      { name: "Cavendish Farms Fries 800g", brand: "Cavendish Farms", price: "$2.25", original_price: null, store: "Real Canadian Superstore" },
      { name: "O'Tasty Frozen Dumplings 567g", brand: "O'Tasty", price: "$5.99", original_price: null, store: "Real Canadian Superstore" },
      { name: "GUNGJEONBANG Frozen Udon 1.25kg", brand: null, price: "$6.97", original_price: null, store: "T&T Supermarket" },
      { name: "Frozen Vegetables", brand: null, price: "$2.99", original_price: null, store: "Safeway" },
    ],
    "Pantry": [
      // STAPLE: Classico sauce
      { name: "Classico Sauce 410/600ml", brand: "Classico", price: "$2.97", original_price: null, store: "No Frills" },
      // STAPLE: No Name flour
      { name: "No Name Flour", brand: "no name", price: "$9.49", original_price: null, store: "Wholesale Club" },
      // Pasta
      { name: "Barilla Pasta 340/410g", brand: "Barilla", price: "$1.97", original_price: null, store: "Real Canadian Superstore" },
      { name: "Catelli Smart or Whole Grain Pasta 340/375g", brand: "Catelli", price: "$2.47", original_price: null, store: "Real Canadian Superstore" },
      // Broth
      { name: "Campbell's Broth or Concentrated Broth 250/900ml", brand: "Campbell's", price: "$1.47", original_price: null, store: "Real Canadian Superstore" },
      { name: "No Name Broth 900ml", brand: "no name", price: "$1.38", original_price: null, store: "No Frills" },
      // Rice
      { name: "Quality Basmati Rice 3.63kg", brand: "Quality", price: "$9.99", original_price: null, store: "No Frills" },
      // Olive oil
      { name: "Extra Virgin Olive Oil", brand: "Filippo Berio", price: "$12.99", original_price: null, store: "Safeway" },
      // Condiments
      { name: "Hellmann's Mayonnaise or Spread 710–890ml", brand: "Hellmann's", price: "$6.00", original_price: null, store: "No Frills" },
      { name: "Rao's Pasta Sauce 410/660ml", brand: "Rao's", price: "$8.50", original_price: null, store: "Real Canadian Superstore" },
      { name: "Flying Goose Sriracha Hot Chili Sauce 730ml or Sambal Chili Paste 495g", brand: "Flying Goose", price: "$4.49", original_price: null, store: "Real Canadian Superstore" },
      // Soy sauce — large format great deal
      { name: "Kikkoman Less Sodium Soy Sauce 1.89L", brand: "Kikkoman", price: "$13.97", original_price: null, store: "T&T Supermarket" },
      // Frank's RedHot — exceptional bulk deal
      { name: "Frank's RedHot Sauce Original 3.78L", brand: "Frank's", price: "$15.99", original_price: null, store: "Wholesale Club" },
    ],
    "Beverages": [
      { name: "San Pellegrino Carbonated Mineral Water", brand: "San Pellegrino", price: "$2.69", original_price: null, store: "Safeway" },
      { name: "Maison Perrier or San Pellegrino Sparkling Water 6x500ml/8x330ml", brand: "San Pellegrino", price: "$6.99", original_price: null, store: "Real Canadian Superstore" },
      { name: "Bubly Sparkling Water 12x355ml", brand: "bubly", price: "$5.99", original_price: null, store: "Real Canadian Superstore" },
      { name: "Vita Coco Coconut Water 1L", brand: "Vita Coco", price: "$4.00", original_price: null, store: "No Frills" },
    ],
  },
};

const OUTPUT_FILE = '/tmp/eventfinder-flyer-curated.json';
writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
console.log(`Written to ${OUTPUT_FILE}`);

// Print summary
let totalKept = 0;
for (const [cat, items] of Object.entries(output.categories)) {
  console.log(`  ${cat}: ${items.length} items`);
  totalKept += items.length;
}
console.log(`Total curated: ${totalKept} items across ${Object.keys(output.categories).length} categories`);
