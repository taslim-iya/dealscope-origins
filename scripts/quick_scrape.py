#!/usr/bin/env python3
"""Quick scraper using direct parsing of readable text from accessible sites.
For CF-blocked sites, falls back to ScrapingBee or skips."""

import json, re, os, sys
from urllib.request import Request, urlopen
from datetime import datetime, timezone

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'data', 'listings.json')
SCRAPINGBEE_KEY = os.environ.get('SCRAPINGBEE_API_KEY', '')

HEADERS = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'}

def fetch_text(url):
    try:
        req = Request(url, headers=HEADERS)
        with urlopen(req, timeout=20) as r:
            return r.read().decode('utf-8', errors='replace')
    except Exception as e:
        return ''

def bee_fetch(url, render=True):
    if not SCRAPINGBEE_KEY:
        return ''
    from urllib.parse import quote_plus
    bee = f'https://app.scrapingbee.com/api/v1/?api_key={SCRAPINGBEE_KEY}&url={quote_plus(url)}'
    if render:
        bee += '&render_js=true&wait=3000'
    try:
        req = Request(bee)
        with urlopen(req, timeout=45) as r:
            return r.read().decode('utf-8', errors='replace')
    except Exception as e:
        print(f'  Bee error: {e}')
        return ''

# ── Hardcoded reliable data from web_fetch ──

HILTON_SMYTHE = [
    {'title': 'Electrical wholesaler and lighting supplier', 'price': '£1.1m turnover', 'location': 'South East', 'url': 'https://hiltonsmythe.com/business-listing/electrical-wholesaler-and-lighting-supplier/', 'industry': 'Electrical'},
    {'title': 'Award-Winning Multi-Trade Plumbing, Heating and Renewable Contractor', 'price': '£2.8m turnover', 'location': 'Scotland', 'url': 'https://hiltonsmythe.com/business-listing/award-winning-multi-trade-plumbing-heating-and-renewable-contractor/', 'industry': 'Construction'},
    {'title': 'Automation and control systems engineering company', 'price': '£2.8m turnover', 'location': 'North West', 'url': 'https://hiltonsmythe.com/business-listing/automation-and-control-systems-engineering-company/', 'industry': 'Engineering'},
    {'title': 'Artisan viennoiserie bakery and retail/wholesale supplier', 'price': '£1m turnover', 'location': 'North West', 'url': 'https://hiltonsmythe.com/business-listing/artisan-viennoiserie-bakery-and-retail-wholesale-supplier/', 'industry': 'Food & Beverage'},
    {'title': 'Bakery and retail/wholesale operation', 'price': '£1.7m turnover', 'location': 'North West', 'url': 'https://hiltonsmythe.com/business-listing/bakery-and-retail-wholesale-operation/', 'industry': 'Food & Beverage'},
    {'title': 'Supported living and housing provider', 'price': '£1.33m turnover', 'location': 'Lancashire', 'url': 'https://hiltonsmythe.com/business-listing/supported-living-and-housing-provider/', 'industry': 'Healthcare'},
]

def scrape_smergers():
    """SMERGERS UK listings."""
    listings = []
    for page in range(1, 11):
        url = f'https://www.smergers.com/businesses/in-united-kingdom/?page={page}'
        html = fetch_text(url)
        if not html or len(html) < 500:
            break
        # Title pattern: <h3 class="h-title">...<a>Title</a></h3>
        titles = re.findall(r'<a[^>]*href="(/businesses/[^"]+)"[^>]*>([^<]+)</a>', html)
        prices = re.findall(r'(?:USD|GBP|EUR|INR)\s*[\d,.]+\s*(?:K|M|B|Lakh|Crore)?', html)
        count = 0
        for href, title in titles:
            title = title.strip()
            if len(title) < 8 or title.startswith('SMERGERS') or 'cookie' in title.lower():
                continue
            listings.append({
                'title': title,
                'price': prices[count] if count < len(prices) else None,
                'location': 'UK', 'industry': '',
                'url': f'https://www.smergers.com{href}',
            })
            count += 1
        if count == 0:
            break
        print(f'  Page {page}: {count}')
    return listings

def scrape_flippa():
    """Flippa UK businesses."""
    listings = []
    for page in range(1, 11):
        url = f'https://flippa.com/search?filter%5Bproperty_type%5D=established_website&filter%5Bcountry%5D%5B%5D=GB&page={page}'
        html = fetch_text(url)
        if not html:
            break
        titles = re.findall(r'"title"\s*:\s*"([^"]{10,})"', html)
        prices = re.findall(r'"current_price"\s*:\s*(\d+)', html)
        urls = re.findall(r'"url"\s*:\s*"(https://flippa\.com/\d+)"', html)
        if not titles:
            break
        for i, t in enumerate(titles[:20]):
            pv = int(prices[i]) if i < len(prices) else 0
            listings.append({
                'title': t,
                'price': f'${pv:,}' if pv else None,
                'location': 'UK / Online', 'industry': 'Digital',
                'url': urls[i] if i < len(urls) else 'https://flippa.com',
            })
        print(f'  Page {page}: {len(titles[:20])}')
    return listings

def scrape_with_bee(name, search_url, page_param='page', max_pages=20, price_re=r'£[\d,]+', location='UK'):
    """Generic ScrapingBee scraper."""
    if not SCRAPINGBEE_KEY:
        return []
    listings = []
    for page in range(1, max_pages + 1):
        sep = '&' if '?' in search_url else '?'
        url = f'{search_url}{sep}{page_param}={page}' if page > 1 else search_url
        html = bee_fetch(url)
        if not html or len(html) < 200:
            break
        # Generic: find all heading+link combos
        items = re.findall(r'<h[23456][^>]*>\s*(?:<a[^>]*href="([^"]*)"[^>]*>)?\s*([^<]{8,}?)\s*(?:</a>)?\s*</h[23456]>', html, re.S)
        prices = re.findall(price_re, html)
        if not items:
            break
        for i, (href, title) in enumerate(items):
            title = title.strip()
            if len(title) < 8 or any(x in title.lower() for x in ['cookie', 'subscribe', 'sign up', 'register', 'login', 'menu']):
                continue
            listings.append({
                'title': title,
                'price': prices[i] if i < len(prices) else None,
                'location': location, 'industry': '',
                'url': href if href.startswith('http') else f'{search_url.split("/")[0]}//{search_url.split("/")[2]}{href}' if href else search_url,
            })
        print(f'  Page {page}: {len(items)}')
        import time; time.sleep(2)
    return listings

def main():
    all_listings = []
    sources = {}

    # Hilton Smythe (hardcoded from web_fetch)
    print('🏢 Hilton Smythe (cached)...')
    hs = [{'source': 'Hilton Smythe', 'sourceId': 'hiltonsmythe', **l} for l in HILTON_SMYTHE]
    all_listings.extend(hs)
    sources['hiltonsmythe'] = len(hs)
    print(f'  ✅ {len(hs)}')

    # SMERGERS
    print('🤖 SMERGERS...')
    sm = scrape_smergers()
    for l in sm: l['source'] = 'SMERGERS'; l['sourceId'] = 'smergers'
    all_listings.extend(sm)
    sources['smergers'] = len(sm)
    print(f'  ✅ {len(sm)}')

    # Flippa
    print('💻 Flippa...')
    fp = scrape_flippa()
    for l in fp: l['source'] = 'Flippa'; l['sourceId'] = 'flippa'
    all_listings.extend(fp)
    sources['flippa'] = len(fp)
    print(f'  ✅ {len(fp)}')

    # ScrapingBee sites
    if SCRAPINGBEE_KEY:
        bee_sites = [
            ('Rightbiz', 'rightbiz', 'https://www.rightbiz.co.uk/businesses-for-sale', '£'),
            ('Daltons', 'daltons', 'https://www.daltonsbusiness.com/buy/business-for-sale', '£'),
            ('BusinessesForSale', 'businessesforsale', 'https://uk.businessesforsale.com/uk/search/businesses-for-sale', '£'),
            ('Bizdaq', 'bizdaq', 'https://www.bizdaq.com/businesses-for-sale', '£'),
            ('BizBuySell', 'bizbuysell', 'https://www.bizbuysell.com/businesses-for-sale/', '$'),
            ('Acquire.com', 'acquire', 'https://acquire.com/browse', '$'),
        ]
        for name, sid, url, curr in bee_sites:
            print(f'🐝 {name}...')
            items = scrape_with_bee(name, url, price_re=f'\\{curr}[\\d,]+')
            for l in items: l['source'] = name; l['sourceId'] = sid
            all_listings.extend(items)
            sources[sid] = len(items)
            print(f'  ✅ {len(items)}')
    else:
        print('⚠ No SCRAPINGBEE_API_KEY — skipping CF sites')

    # Deduplicate
    seen = set()
    unique = []
    for item in all_listings:
        key = re.sub(r'[^a-z0-9]', '', item['title'].lower())[:40]
        if key not in seen and len(key) > 5:
            seen.add(key)
            item['id'] = f"{item['sourceId']}-{len(unique)}"
            item.setdefault('revenue', None)
            item.setdefault('sourceUrl', item.get('url', ''))
            unique.append(item)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w') as f:
        json.dump({
            'total': len(unique),
            'sources': sources,
            'scrapedAt': datetime.now(timezone.utc).isoformat(),
            'listings': unique,
        }, f, indent=2)

    print(f'\n📊 {len(unique)} unique listings from {sum(1 for v in sources.values() if v)} sources')

if __name__ == '__main__':
    main()
