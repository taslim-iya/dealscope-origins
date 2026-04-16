import type { VercelRequest, VercelResponse } from '@vercel/node';

interface ScrapedListing {
  id: string;
  title: string;
  description: string;
  price: string | null;
  revenue: string | null;
  location: string;
  industry: string;
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  listingUrl: string;
  scrapedAt: string;
}

// Scraper functions per source
async function scrapeRightbiz(): Promise<ScrapedListing[]> {
  try {
    const res = await fetch('https://www.rightbiz.co.uk/businesses-for-sale', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DealScope/1.0)' },
    });
    const html = await res.text();
    return extractListingsFromHTML(html, 'rightbiz', 'Rightbiz', 'https://www.rightbiz.co.uk');
  } catch { return []; }
}

async function scrapeDaltons(): Promise<ScrapedListing[]> {
  try {
    const res = await fetch('https://www.daltonsbusiness.com/buy/business-for-sale', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DealScope/1.0)' },
    });
    const html = await res.text();
    return extractListingsFromHTML(html, 'daltons', 'Daltons Business', 'https://www.daltonsbusiness.com');
  } catch { return []; }
}

async function scrapeBusinessSale(): Promise<ScrapedListing[]> {
  try {
    const res = await fetch('https://www.business-sale.com/businesses-for-sale', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DealScope/1.0)' },
    });
    const html = await res.text();
    return extractListingsFromHTML(html, 'businesssale', 'Business Sale Report', 'https://www.business-sale.com');
  } catch { return []; }
}

async function scrapeBusinessesForSale(): Promise<ScrapedListing[]> {
  try {
    const res = await fetch('https://uk.businessesforsale.com/uk/search/businesses-for-sale', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DealScope/1.0)' },
    });
    const html = await res.text();
    return extractListingsFromHTML(html, 'businessesforsale', 'BusinessesForSale.com', 'https://uk.businessesforsale.com');
  } catch { return []; }
}

function extractListingsFromHTML(html: string, sourceId: string, sourceName: string, baseUrl: string): ScrapedListing[] {
  const listings: ScrapedListing[] = [];
  
  // Generic HTML parser - extract listings from common patterns
  // Look for listing cards/items with title + price + location
  const titleRegex = /<(?:h[2-4]|a)[^>]*class="[^"]*(?:title|listing-name|business-name)[^"]*"[^>]*>([^<]+)</gi;
  const priceRegex = /(?:£|GBP\s?)[\d,]+(?:\.\d{2})?/gi;
  const locationRegex = /(?:Location|Area|Region)[:\s]*([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)/gi;
  
  // Try structured data first (JSON-LD)
  const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi);
  if (jsonLdMatch) {
    for (const match of jsonLdMatch) {
      try {
        const jsonStr = match.replace(/<[^>]+>/g, '');
        const data = JSON.parse(jsonStr);
        if (data['@type'] === 'ItemList' && data.itemListElement) {
          for (const item of data.itemListElement.slice(0, 50)) {
            listings.push({
              id: `${sourceId}-${listings.length}`,
              title: item.name || 'Untitled',
              description: item.description || '',
              price: item.offers?.price ? `£${Number(item.offers.price).toLocaleString()}` : null,
              revenue: null,
              location: item.contentLocation?.name || '',
              industry: item.category || '',
              sourceId,
              sourceName,
              sourceUrl: baseUrl,
              listingUrl: item.url || baseUrl,
              scrapedAt: new Date().toISOString(),
            });
          }
        }
      } catch {}
    }
  }

  // Fallback: extract from meta tags and title patterns
  if (listings.length === 0) {
    const titles = [...html.matchAll(/<(?:h[2-4]|a|div)[^>]*>([^<]{10,120}(?:for sale|business|limited|ltd)[^<]*)</gi)];
    const prices = [...html.matchAll(/(?:£|GBP\s?)([\d,]+(?:\.\d{2})?)/gi)];

    for (let i = 0; i < Math.min(titles.length, 30); i++) {
      listings.push({
        id: `${sourceId}-${i}`,
        title: titles[i][1].replace(/&amp;/g, '&').replace(/&#\d+;/g, '').trim(),
        description: '',
        price: prices[i] ? `£${prices[i][1]}` : null,
        revenue: null,
        location: '',
        industry: '',
        sourceId,
        sourceName,
        sourceUrl: baseUrl,
        listingUrl: baseUrl,
        scrapedAt: new Date().toISOString(),
      });
    }
  }

  return listings;
}

const SCRAPERS: Record<string, () => Promise<ScrapedListing[]>> = {
  rightbiz: scrapeRightbiz,
  daltons: scrapeDaltons,
  businesssale: scrapeBusinessSale,
  businessesforsale: scrapeBusinessesForSale,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { source, all } = req.query;

  if (all === 'true') {
    // Scrape all sources in parallel
    const results = await Promise.allSettled(
      Object.entries(SCRAPERS).map(async ([id, fn]) => {
        const listings = await fn();
        return { sourceId: id, listings, count: listings.length };
      })
    );

    const allListings: ScrapedListing[] = [];
    const summary: Record<string, number> = {};

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allListings.push(...result.value.listings);
        summary[result.value.sourceId] = result.value.count;
      }
    }

    res.setHeader('Cache-Control', 'public, s-maxage=3600');
    return res.status(200).json({
      total: allListings.length,
      summary,
      listings: allListings,
      scrapedAt: new Date().toISOString(),
    });
  }

  if (typeof source === 'string' && SCRAPERS[source]) {
    const listings = await SCRAPERS[source]();
    res.setHeader('Cache-Control', 'public, s-maxage=3600');
    return res.status(200).json({ sourceId: source, count: listings.length, listings });
  }

  return res.status(200).json({
    availableSources: Object.keys(SCRAPERS),
    usage: '/api/scrape?source=rightbiz or /api/scrape?all=true',
  });
}
