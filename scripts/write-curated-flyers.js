#!/usr/bin/env node
/**
 * Writes the LLM-curated flyer deals to /tmp/eventfinder-flyer-curated.json
 * Items selected based on user preferences (staples, everyday value, meat/produce focus).
 */

import { writeFileSync } from 'fs';

const OUTPUT_FILE = '/tmp/eventfinder-flyer-curated.json';

const curated = {
  date: '2026-10-11',
  categories: {
    'Meat & Seafood': [
      // STAPLE: closest to boneless skinless chicken thighs
      { name: 'Fresh AIR-CHILLED Chicken Drumsticks or Bone-In Chicken Thighs', brand: 'Compliments', price: '$4.49', store: 'Safeway', note: 'staple' },
      { name: 'Boneless Skinless Chicken Breast', brand: 'Maple Leaf Prime', price: '$8.00', store: 'No Frills', alt_stores: 'also $8.99 @ Co-op' },
      { name: 'Ground Chicken 454g or Lean Pork 670g', brand: null, price: '$4.00', store: 'No Frills' },
      { name: 'Chicken Leg Quarters', brand: null, price: '$2.99', store: 'Real Canadian Superstore' },
      { name: 'Fresh Lean Ground Beef', brand: null, price: '$6.99', store: 'Safeway' },
      { name: 'Lean Ground Beef 450g', brand: null, price: '$9.00', store: 'Real Canadian Superstore' },
      { name: 'Pork Loin Centre-Cut Chops Boneless', brand: null, price: '$7.00', store: 'Real Canadian Superstore' },
      { name: 'Whole Pork Tenderloin or Button Bones', brand: null, price: '$3.99', store: 'Calgary Co-op' },
      { name: 'Chinook Salmon Fillets', brand: null, price: '$3.79', store: 'Calgary Co-op' },
      { name: 'Wild Sockeye Salmon Fillets', brand: null, price: '$5.99', store: 'Safeway' },
      { name: 'Fresh Atlantic Salmon Skinless Fillets', brand: null, price: '$14.00', store: 'Real Canadian Superstore' },
      { name: 'Atlantic Canada 3-4 oz. Lobster Tail', brand: null, price: '$8.99', store: 'Safeway' },
      { name: 'Pork Side Ribs', brand: null, price: '$3.66', store: 'T&T Supermarket' },
      { name: 'Boneless Rib Roast', brand: null, price: '$10.88', store: 'No Frills' },
      { name: 'Smoked Pink Salmon Nuggets', brand: 'PREMIER SEAFOODS', price: '$10.99', store: 'Safeway' },
    ],
    'Produce': [
      { name: 'Cauliflower', brand: null, price: '$2.99', store: 'Safeway', alt_stores: 'also $3.44 @ Superstore, $3.99 @ No Frills' },
      { name: 'Broccoli Crowns', brand: null, price: '$1.99', store: 'No Frills', alt_stores: 'also $1.99 @ Superstore, $2.49 @ Co-op' },
      { name: 'Jumbo Carrot', brand: null, price: '$0.94', store: 'Real Canadian Superstore' },
      { name: 'Green Cabbage', brand: null, price: '$0.79', store: 'No Frills', alt_stores: 'also $0.99 @ Safeway' },
      { name: 'Orange Sweet Potatoes', brand: null, price: '$1.99', store: 'Safeway' },
      { name: 'Celery', brand: null, price: '$1.69', store: 'Calgary Co-op', alt_stores: 'also $2.49 @ No Frills' },
      { name: 'Kale, Red or Green Swiss Chard or Fennel Anise', brand: null, price: '$3.77', store: 'Safeway' },
      { name: 'Unico Roasted Peppers, Peperoncini, Olives or Pepper Rings 370-750ml', brand: 'Unico', price: '$3.29', store: 'No Frills' },
      { name: 'Cherry Tomatoes 1.5lb', brand: null, price: '$3.99', store: 'T&T Supermarket' },
      { name: 'Farmer\'s Market Grape Tomatoes or Mini Cucumbers', brand: null, price: '$5.99', store: 'No Frills' },
      { name: 'Romaine Hearts pkg of 3', brand: null, price: '$4.99', store: 'No Frills' },
      { name: 'Whole Pineapple 3.8kg', brand: null, price: '$4.97', store: 'Real Canadian Superstore' },
      { name: 'Ataulfo Mango', brand: null, price: '$4.88', store: 'T&T Supermarket' },
      { name: 'Chanterelle Mushroom 100g', brand: null, price: '$4.98', store: 'T&T Supermarket' },
      { name: 'Navel Orange', brand: null, price: '$1.28', store: 'T&T Supermarket' },
      { name: 'Black Fig Case', brand: null, price: '$9.99', store: 'Safeway', note: 'seasonal/unusual' },
    ],
    'Dairy': [
      // STAPLE: Siggi's
      { name: "Siggi's Skyr Yogurt 650/750g (or Iögo 16x100g)", brand: "Siggi's", price: '$6.50', store: 'No Frills', note: 'staple' },
      { name: "Siggi's Skyr Yogurt 4x100g (or Iögo Nano)", brand: "Siggi's", price: '$3.27', store: 'No Frills', note: 'staple' },
      // Eggs
      { name: 'Eggs 12\'s', brand: 'Burnbrae Farms Naturegg', price: '$5.00', store: 'No Frills' },
      { name: 'COMPLIMENTS Organic Large Eggs', brand: 'Compliments', price: '$7.99', store: 'Safeway' },
      // Butter
      { name: 'Spreadables Butter', brand: 'Gay Lea', price: '$4.99', store: 'Safeway' },
      { name: 'Lactantia Butter', brand: 'Lactantia', price: '$7.99', store: 'Calgary Co-op' },
      // Cheese - closest to staples
      { name: 'Castello Havarti, Cheddar or Blue Cheese 125-200g', brand: 'Castello', price: '$6.00', store: 'Real Canadian Superstore', note: 'blue cheese ≈ gorgonzola' },
      { name: 'Blue Cheese', brand: 'Castello', price: '$6.99', store: 'Safeway' },
      { name: 'Cathedral City Cheddar', brand: 'Cathedral City', price: '$8.99', store: 'Calgary Co-op' },
      { name: 'Cracker Barrel Cheese Bars 400g or Shreds 300/320g', brand: 'Cracker Barrel', price: '$5.97', store: 'Real Canadian Superstore', alt_stores: 'also $4.77 slices @ No Frills' },
      // Cream/sour cream
      { name: 'Dairyland Sour Cream 450/500ml', brand: 'Dairyland', price: '$3.50', store: 'No Frills' },
      { name: 'Cream 473ml-1L', brand: 'Lactantia/Dairyland', price: '$3.75', store: 'No Frills' },
      { name: 'Cream Cheese', brand: 'Philadelphia', price: '$3.99', store: 'Safeway' },
      // Greek yogurt
      { name: 'Liberté Greek Yogurt 650/750g', brand: 'Liberté', price: '$6.97', store: 'Real Canadian Superstore', alt_stores: 'also $6.99 @ Safeway' },
      // Milk
      { name: 'Dairyland Microfiltered Milk or 18g Protein Beverage', brand: 'Dairyland', price: '$5.99', store: 'Calgary Co-op' },
    ],
    'Bakery': [
      { name: 'White or Whole Wheat Bread', brand: "Dempster's", price: '$2.99', store: 'Safeway' },
      { name: 'PC Bread or Buns', brand: 'PC', price: '$4.00', store: 'Real Canadian Superstore' },
      { name: 'Sourdough or Pumpernickel Bread', brand: null, price: '$3.50', store: 'Real Canadian Superstore' },
      { name: 'Farmhouse Sourdough', brand: 'Farmhouse', price: '$7.00', store: 'Calgary Co-op' },
      { name: 'Farmer\'s Market Croissants', brand: "Farmer's Market", price: '$4.50', store: 'No Frills' },
      { name: 'La Fournée Dorée Sliced Brioche Bread 500g', brand: 'La Fournée Dorée', price: '$5.00', store: 'No Frills' },
      { name: 'Tenderflake Pie/Tart Shells or Puff Pastry', brand: 'Tenderflake', price: '$2.97', store: 'Real Canadian Superstore' },
    ],
    'Frozen': [
      { name: 'Frozen Vegetables', brand: null, price: '$2.99', store: 'Safeway', alt_stores: 'also $2.99 @ Superstore, $2.99 @ Co-op' },
      { name: 'Cavendish Farms Fries 800g', brand: 'Cavendish Farms', price: '$2.25', store: 'Real Canadian Superstore', alt_stores: 'also $2.25 @ No Frills' },
      { name: "O'Tasty Frozen Dumplings 567g", brand: "O'Tasty", price: '$5.99', store: 'Real Canadian Superstore' },
      { name: 'Giuseppe Stuffed Crust Pizza', brand: 'Dr. Oetker', price: '$7.99', store: 'Safeway' },
      { name: 'Red Baron Classic Crust Pizza 584-665g', brand: 'Red Baron', price: '$3.99', store: 'Real Canadian Superstore', alt_stores: 'also $4.00 @ No Frills' },
      { name: 'Righteous Gelato or Sorbetto', brand: 'Righteous', price: '$6.99', store: 'Safeway' },
    ],
    'Pantry': [
      // STAPLE: Classico sauce
      { name: 'Classico Sauce 410/600ml', brand: 'Classico', price: '$2.97', store: 'No Frills', note: 'staple' },
      // STAPLE: No Name flour
      { name: 'No Name Flour', brand: 'No Name', price: '$9.49', store: 'Wholesale Club', note: 'staple' },
      { name: 'Barilla Pasta 340/410g', brand: 'Barilla', price: '$1.97', store: 'Real Canadian Superstore', alt_stores: 'also $1.97 @ No Frills' },
      { name: 'Kriti Gold Extra Virgin Olive Oil 750ml', brand: 'Kriti Gold', price: '$12.00', store: 'Real Canadian Superstore', alt_stores: 'also $12.99 Filippo Berio @ Safeway' },
      { name: "Rao's Pasta Sauce 410/660ml", brand: "Rao's", price: '$8.50', store: 'Real Canadian Superstore' },
      { name: 'Quality Basmati Rice 8lb', brand: 'Quality', price: '$9.99', store: 'Real Canadian Superstore', alt_stores: 'also $9.99 3.63kg @ No Frills' },
      { name: 'T&T Thai Jasmine Rice 18lb', brand: 'T&T', price: '$14.99', store: 'Real Canadian Superstore' },
      { name: "Campbell's Broth 900ml", brand: "Campbell's", price: '$1.47', store: 'Real Canadian Superstore', alt_stores: 'also $1.69 @ Co-op' },
      { name: 'Heinz Beans or Pasta 398ml', brand: 'Heinz', price: '$1.25', store: 'Real Canadian Superstore' },
      { name: 'Classico Sauce (alternative)', brand: null, price: '$8.50', store: 'Real Canadian Superstore', note: "Greens & Beans 7 Veggie Pasta Sauce at Co-op $9.99" },
      { name: 'Flying Goose Sriracha Hot Chilli Sauce 730ml or Sambal Paste 495g', brand: 'Flying Goose', price: '$4.49', store: 'Real Canadian Superstore' },
      { name: 'Jamaican Jerk Seasoning', brand: 'Grace', price: '$5.49', store: 'Safeway' },
      { name: 'Peace River Honey 500g', brand: 'Peace River', price: '$8.99', store: 'Real Canadian Superstore' },
      { name: 'Lindt Excellence or Ghirardelli Chocolate Bars 50-100g', brand: 'Lindt/Ghirardelli', price: '$10.00', store: 'Real Canadian Superstore' },
      { name: 'Lee Kum Kee Premium Soy Sauce 500ml', brand: 'Lee Kum Kee', price: '$3.00', store: 'Real Canadian Superstore' },
    ],
    'Beverages': [
      { name: 'San Pellegrino Carbonated Mineral Water', brand: 'San Pellegrino', price: '$2.69', store: 'Safeway' },
      { name: 'Bubly Sparkling Water 12x355ml', brand: 'bubly', price: '$5.99', store: 'Real Canadian Superstore' },
      { name: 'AHA Sparkling Water 12x355ml', brand: 'AHA', price: '$6.49', store: 'Real Canadian Superstore' },
      { name: 'Vita Coco Coconut Water 1L', brand: 'Vita Coco', price: '$4.00', store: 'No Frills' },
      { name: 'PC Herbal Tea 20\'s', brand: 'PC', price: '$3.00', store: 'Real Canadian Superstore' },
      { name: 'Celestial Seasonings or Twinings Tea', brand: null, price: '$4.99', store: 'Safeway' },
      { name: 'No Name Instant Coffee 150g', brand: 'No Name', price: '$5.49', store: 'No Frills' },
    ],
  },
};

writeFileSync(OUTPUT_FILE, JSON.stringify(curated, null, 2));

// Summary
let totalKept = 0;
for (const [cat, items] of Object.entries(curated.categories)) {
  console.log(`${cat}: ${items.length} items`);
  totalKept += items.length;
}
console.log(`\nTotal curated: ${totalKept} items across ${Object.keys(curated.categories).length} categories`);
console.log(`Written to ${OUTPUT_FILE}`);
