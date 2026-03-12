#!/usr/bin/env node
/**
 * Scrapes all apps from the Atlassian Marketplace REST API
 * and writes the results to marketplace-apps.json
 *
 * Usage: node scripts/scrape-marketplace.js [output-file]
 * Default output: marketplace-apps.json
 *
 * API docs: https://marketplace.atlassian.com/rest/2/addons
 */

'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://marketplace.atlassian.com/rest/2/addons';
const PAGE_SIZE = 50;
const OUTPUT_FILE = process.argv[2] || path.join(__dirname, '..', 'marketplace-apps.json');

/**
 * Fetch a URL and return parsed JSON.
 */
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'atlassian-marketplace-scraper/1.0',
      },
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchJson(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }

      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(new Error(`Failed to parse JSON from ${url}: ${err.message}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy(new Error(`Timeout fetching ${url}`));
    });
  });
}

/**
 * Sleep for ms milliseconds (used for rate-limiting between pages).
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch a single page of addons.
 * Returns { addons: [...], total: number, hasMore: boolean }
 */
async function fetchPage(offset) {
  const url = `${BASE_URL}?limit=${PAGE_SIZE}&offset=${offset}`;
  const data = await fetchJson(url);

  const addons = (data._embedded && data._embedded.addons) || [];
  const total = (data._links && data._links.self && data.total)
    || (data.total)
    || null;

  // Try to get total from the response
  const pageTotal = data.total || (data._links && data._links.last
    ? extractOffsetFromUrl(data._links.last.href)
    : null);

  return {
    addons,
    total: pageTotal,
    hasMore: addons.length === PAGE_SIZE,
    raw: data,
  };
}

function extractOffsetFromUrl(url) {
  if (!url) return null;
  const match = url.match(/[?&]offset=(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Normalize an addon record to a clean flat object.
 */
function normalizeAddon(addon) {
  const links = addon._links || {};
  const embedded = addon._embedded || {};
  const summary = embedded.summary || {};

  return {
    key: addon.key || null,
    name: addon.name || null,
    tagLine: addon.tagLine || null,
    summary: typeof summary === 'string' ? summary : (addon.summary || null),
    description: addon.description || null,
    status: addon.status || null,
    distributionType: addon.distributionType || null,
    pricingType: addon.pricingType || null,
    currency: addon.currency || null,
    releasedAt: addon.releasedAt || null,
    lastUpdated: addon.lastUpdated || null,
    version: addon.version || null,
    installCount: addon.installCount || null,
    logo: (addon.logo && addon.logo.uri) || (links.logo && links.logo.href) || null,
    marketplaceUrl: (links.alternate && links.alternate.href)
      || (addon.key ? `https://marketplace.atlassian.com/apps/${addon.key}` : null),
    documentationUrl: (links.documentation && links.documentation.href) || null,
    supportUrl: (links.support && links.support.href) || null,
    bugsUrl: (links.bugs && links.bugs.href) || null,
    vendor: addon.vendor
      ? {
          name: addon.vendor.name || null,
          marketplaceUrl: (addon.vendor._links && addon.vendor._links.alternate && addon.vendor._links.alternate.href) || null,
        }
      : null,
    categories: Array.isArray(addon.categories)
      ? addon.categories.map((c) => (typeof c === 'string' ? c : c.name || c.key || c))
      : [],
    hosting: Array.isArray(addon.hosting)
      ? addon.hosting
      : (addon.hosting ? [addon.hosting] : []),
    compatibleApplications: Array.isArray(addon.compatibleApplications)
      ? addon.compatibleApplications
      : [],
    reviews: addon.reviews || null,
    rating: addon.rating || null,
  };
}

async function main() {
  console.log('Atlassian Marketplace Scraper');
  console.log(`Output file: ${OUTPUT_FILE}\n`);

  const allAddons = [];
  let offset = 0;
  let total = null;
  let page = 1;

  while (true) {
    const progress = total
      ? `[${Math.min(offset + PAGE_SIZE, total)}/${total}]`
      : `[page ${page}]`;

    process.stdout.write(`Fetching ${progress} offset=${offset} ... `);

    let result;
    try {
      result = await fetchPage(offset);
    } catch (err) {
      console.error(`\nError on page ${page}: ${err.message}`);
      console.error('Saving partial results and exiting...');
      break;
    }

    const { addons, hasMore } = result;

    if (total === null && result.total !== null) {
      total = result.total;
    }

    const normalized = addons.map(normalizeAddon);
    allAddons.push(...normalized);

    console.log(`got ${addons.length} addons (total collected: ${allAddons.length})`);

    if (!hasMore || addons.length === 0) {
      console.log('Reached last page.');
      break;
    }

    offset += PAGE_SIZE;
    page += 1;

    // Polite rate limiting: 200ms between requests
    await sleep(200);
  }

  console.log(`\nWriting ${allAddons.length} apps to ${OUTPUT_FILE} ...`);

  const output = {
    scrapedAt: new Date().toISOString(),
    source: 'https://marketplace.atlassian.com',
    apiBase: BASE_URL,
    totalApps: allAddons.length,
    apps: allAddons,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf8');
  console.log('Done.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
