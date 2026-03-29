#!/usr/bin/env node
// Fetches flyer deals from the Flipp public API (backflipp.wishabi.com)
// for configured merchants in the Calgary area. Outputs raw item data
// — categorization and filtering are done by the agent, not this script.
//
// Usage: node scripts/fetch-flipp-flyers.js
// Output: /tmp/eventfinder-flyer-batch-flipp.json

import { writeFileSync } from 'fs';
import { setGlobalDispatcher, ProxyAgent } from 'undici';

// Honour standard proxy env vars (Node's built-in fetch/undici ignores them by default)
const proxyUrl = process.env.https_proxy || process.env.HTTPS_PROXY ||
                 process.env.http_proxy  || process.env.HTTP_PROXY;
if (proxyUrl) {
  setGlobalDispatcher(new ProxyAgent(proxyUrl));
}

const POSTAL_CODE = 'T3C0W1';
const OUTPUT_FILE = '/tmp/eventfinder-flyer-batch-flipp.json';

// Flipp merchant IDs for our stores
const MERCHANTS = {
  208:  'Shoppers Drug Mart',
  228:  'London Drugs',
  2051: 'Calgary Co-op',
  2072: 'Sobeys',
  2126: 'Safeway',
  2271: 'Real Canadian Superstore',
  2332: 'No Frills',
  2471: 'Canadian Tire',
  2596: 'Costco',
  2702: 'Wholesale Club',
  3407: 'Co-op Wine Spirits Beer',
  3656: 'Sobeys & Safeway Liquor',
  6373: 'T&T Supermarket',
};

async function fetchJSON(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
  return resp.json();
}

async function main() {
  console.log(`Fetching flyers for postal code ${POSTAL_CODE}...`);
  const flyersResp = await fetchJSON(
    `https://backflipp.wishabi.com/flipp/flyers?locale=en-ca&postal_code=${POSTAL_CODE}`
  );
  const allFlyers = Array.isArray(flyersResp) ? flyersResp : (flyersResp.flyers || []);

  const merchantIds = Object.keys(MERCHANTS).map(Number);
  const ourFlyers = allFlyers.filter(f => merchantIds.includes(f.merchant_id));

  // Pick the most recent flyer per merchant
  const latestByMerchant = {};
  for (const flyer of ourFlyers) {
    const mid = flyer.merchant_id;
    if (!latestByMerchant[mid] || flyer.valid_from > latestByMerchant[mid].valid_from) {
      latestByMerchant[mid] = flyer;
    }
  }

  console.log(`Found ${Object.keys(latestByMerchant).length} merchant flyers out of ${merchantIds.length} configured.\n`);

  const results = [];

  for (const [midStr, merchantName] of Object.entries(MERCHANTS)) {
    const mid = Number(midStr);
    const flyer = latestByMerchant[mid];

    if (!flyer) {
      console.log(`[${merchantName}] No current flyer found, skipping.`);
      results.push({ store_name: merchantName, success: false, error: 'No current flyer', items: [] });
      continue;
    }

    process.stdout.write(`[${merchantName}] Flyer ${flyer.id} (${flyer.valid_from} to ${flyer.valid_to}) ... `);

    try {
      const flyerData = await fetchJSON(`https://backflipp.wishabi.com/flipp/flyers/${flyer.id}`);

      const items = (flyerData.items || [])
        .filter(item => item.name && item.name.trim())
        .map(item => ({
          name: item.name,
          brand: item.brand || null,
          price: item.price || null,
          original_price: item.original_price || null,
          discount: item.discount || null,
          image_url: item.cutout_image_url || null,
          url: item.ttm_url || null,
        }));

      console.log(`${items.length} items`);

      results.push({
        store_name: merchantName,
        success: true,
        error: null,
        sale_start: flyer.valid_from ? flyer.valid_from.split('T')[0] : null,
        sale_end: flyer.valid_to ? flyer.valid_to.split('T')[0] : null,
        items,
      });
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
      results.push({ store_name: merchantName, success: false, error: err.message, items: [] });
    }
  }

  writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));

  const succeeded = results.filter(r => r.success).length;
  const totalItems = results.reduce((sum, r) => sum + r.items.length, 0);
  console.log(`\nDone: ${succeeded} merchants, ${totalItems} total items`);
  console.log(`Written to ${OUTPUT_FILE}`);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
