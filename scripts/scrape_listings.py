#!/usr/bin/env python3
"""DealScope listing scraper — paginates all accessible sites, supports ScrapingBee for CF sites."""

import json, re, time, os, sys
from urllib.request import Request, urlopen
from urllib.parse import quote_plus, urljoin
from html.parser import HTMLParser
from datetime import datetime, timezone

SCRAPINGBEE_KEY = os.environ.get('SCRAPINGBEE_API_KEY', '')
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'data', 'listings.json')
HEADERS = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
DELAY = 1.5  # seconds between requests

def fetch(url, use_bee=False, render_js=False):
    """Fetch URL content. Uses ScrapingBee if use_bee=True and key available."""
    if use_bee and SCRAPINGBEE_KEY:
        bee_url = f'https://app.scrapingbee.com/api/v1/?api_key={SCRAPINGBEE_KEY}&url={quote_plus(url)}'
        if render_js:
            bee_url += '&render_js=true&wait=3000'
        req = Request(bee_url)
    else:
        req = Request(url, headers=HEADERS)
    try:
        with urlopen(req, timeout=30) as r:
            return r.read().decode('utf-8', errors='replace')
    except Exception as e:
        print(f'    ⚠ Fetch failed: {e}')
        return ''

def extract_text(html, tag='title'):
    """Simple regex text extractor."""
    m = re.findall(f'<{tag}[^>]*>(.*?)</{tag}>', html, re.S | re.I)
    return [t.strip() for t in m if t.strip()]

# ─── Source scrapers ───

def scrape_hiltonsmythe(max_pages=10):
    """Hilton Smythe — paginated."""
    listings = []
    for page in range(1, max_pages + 1):
        url = f'https://www.hiltonsmythe.com/businesses-for-sale/page/{page}/' if page > 1 else 'https://www.hiltonsmythe.com/businesses-for-sale/'
        html = fetch(url)
        if not html or 'No results found' in html:
            break
        # Extract listing cards
        cards = re.findall(r'<h[23][^>]*class="[^"]*entry-title[^"]*"[^>]*>\s*<a[^>]*href="([^"]*)"[^>]*>(.*?)</a>', html, re.S)
        prices = re.findall(r'£[\d,]+(?:\.\d+)?', html)
        locations = re.findall(r'<span[^>]*class="[^"]*location[^"]*"[^>]*>(.*?)</span>', html, re.S)
        if not cards:
            # Alternative pattern
            cards = re.findall(r'<a[^>]*href="(https://hiltonsmythe\.com/businesses-for-sale/[^"]+/)"[^>]*>\s*<h\d[^>]*>(.*?)</h\d>', html, re.S)
        for i, (href, title) in enumerate(cards):
            title = re.sub(r'<[^>]+>', '', title).strip()
            if not title or title.lower() in ('businesses for sale', 'next', 'prev'):
                continue
            listings.append({
                'title': title,
                'price': prices[i] if i < len(prices) else None,
                'location': re.sub(r'<[^>]+>', '', locations[i]).strip() if i < len(locations) else '',
                'url': href,
                'source': 'Hilton Smythe', 'sourceId': 'hiltonsmythe',
            })
        print(f'    Page {page}: {len(cards)} items')
        time.sleep(DELAY)
    return listings

def scrape_smergers(max_pages=10):
    """SMERGERS UK — paginated."""
    listings = []
    for page in range(1, max_pages + 1):
        url = f'https://www.smergers.com/businesses-for-sale-and-investors/c/in-united-kingdom/?page={page}'
        html = fetch(url)
        if not html:
            break
        cards = re.findall(r'<a[^>]*class="[^"]*card[^"]*"[^>]*href="(/businesses/[^"]+)"[^>]*>.*?<h\d[^>]*>(.*?)</h\d>.*?(?:USD|GBP|EUR)\s*[\d,.]+\s*(?:K|M|B)?', html, re.S)
        if not cards:
            # Simpler pattern
            titles = re.findall(r'<h\d[^>]*class="[^"]*card-title[^"]*"[^>]*>(.*?)</h\d>', html, re.S)
            links = re.findall(r'href="(/businesses/[^"]+)"', html)
            prices_found = re.findall(r'(?:USD|GBP|EUR)\s*[\d,.]+\s*(?:K|M|B)?', html)
            for i, title in enumerate(titles):
                title = re.sub(r'<[^>]+>', '', title).strip()
                if not title:
                    continue
                listings.append({
                    'title': title,
                    'price': prices_found[i] if i < len(prices_found) else None,
                    'location': 'UK',
                    'url': f'https://www.smergers.com{links[i]}' if i < len(links) else 'https://www.smergers.com',
                    'source': 'SMERGERS', 'sourceId': 'smergers',
                })
        else:
            for href, title in cards:
                title = re.sub(r'<[^>]+>', '', title).strip()
                listings.append({
                    'title': title, 'price': None, 'location': 'UK',
                    'url': f'https://www.smergers.com{href}',
                    'source': 'SMERGERS', 'sourceId': 'smergers',
                })
        if len(titles if not cards else cards) == 0:
            break
        print(f'    Page {page}: found items')
        time.sleep(DELAY)
    return listings

def scrape_flippa(max_pages=5):
    """Flippa UK — paginated."""
    listings = []
    for page in range(1, max_pages + 1):
        url = f'https://flippa.com/search?filter%5Bproperty_type%5D=established_website&filter%5Bcountry%5D%5B%5D=GB&page={page}'
        html = fetch(url)
        if not html:
            break
        titles = re.findall(r'"title"\s*:\s*"([^"]+)"', html)
        prices = re.findall(r'"current_price"\s*:\s*(\d+)', html)
        urls = re.findall(r'"url"\s*:\s*"(https://flippa\.com/[^"]+)"', html)
        for i, title in enumerate(titles[:20]):
            price_val = int(prices[i]) if i < len(prices) else 0
            listings.append({
                'title': title,
                'price': f'${price_val:,}' if price_val else None,
                'location': 'UK / Online',
                'url': urls[i] if i < len(urls) else 'https://flippa.com',
                'source': 'Flippa', 'sourceId': 'flippa',
            })
        if not titles:
            break
        print(f'    Page {page}: {len(titles[:20])} items')
        time.sleep(DELAY)
    return listings

def scrape_dealstream(max_pages=5):
    """DealStream — US/Global."""
    listings = []
    for page in range(1, max_pages + 1):
        url = f'https://dealstream.com/businesses-for-sale?page={page}'
        html = fetch(url)
        if not html:
            break
        titles = re.findall(r'<h\d[^>]*class="[^"]*listing-title[^"]*"[^>]*>\s*<a[^>]*href="([^"]*)"[^>]*>(.*?)</a>', html, re.S)
        if not titles:
            titles = re.findall(r'<a[^>]*href="(/listing/[^"]*)"[^>]*>(.*?)</a>', html, re.S)
        prices = re.findall(r'\$[\d,]+(?:\.\d+)?', html)
        for i, (href, title) in enumerate(titles):
            title = re.sub(r'<[^>]+>', '', title).strip()
            if len(title) < 5:
                continue
            listings.append({
                'title': title,
                'price': prices[i] if i < len(prices) else None,
                'location': 'US',
                'url': f'https://dealstream.com{href}' if href.startswith('/') else href,
                'source': 'DealStream', 'sourceId': 'dealstream',
            })
        if not titles:
            break
        print(f'    Page {page}: {len(titles)} items')
        time.sleep(DELAY)
    return listings

def scrape_bizquest(max_pages=5):
    """BizQuest — US."""
    listings = []
    for page in range(1, max_pages + 1):
        url = f'https://www.bizquest.com/businesses-for-sale/?page={page}'
        html = fetch(url)
        if not html or 'Page Not Found' in html:
            break
        cards = re.findall(r'<a[^>]*href="(/listing/[^"]*)"[^>]*class="[^"]*listing[^"]*"[^>]*>.*?<h\d[^>]*>(.*?)</h\d>', html, re.S)
        if not cards:
            cards = re.findall(r'<h\d[^>]*>\s*<a[^>]*href="(/listing/[^"]*)"[^>]*>(.*?)</a>', html, re.S)
        prices = re.findall(r'\$[\d,]+', html)
        for i, (href, title) in enumerate(cards):
            title = re.sub(r'<[^>]+>', '', title).strip()
            if len(title) < 5:
                continue
            listings.append({
                'title': title,
                'price': prices[i] if i < len(prices) else None,
                'location': 'US',
                'url': f'https://www.bizquest.com{href}',
                'source': 'BizQuest', 'sourceId': 'bizquest',
            })
        if not cards:
            break
        print(f'    Page {page}: {len(cards)} items')
        time.sleep(DELAY)
    return listings

def scrape_with_scrapingbee(site_config, max_pages=20):
    """Generic ScrapingBee scraper for CF-protected sites."""
    if not SCRAPINGBEE_KEY:
        print(f'    ⚠ No ScrapingBee key — skipping')
        return []
    
    listings = []
    name = site_config['name']
    base_url = site_config['searchUrl']
    page_param = site_config.get('pageParam', 'page')
    title_pattern = site_config.get('titlePattern', r'<h\d[^>]*>(.*?)</h\d>')
    link_pattern = site_config.get('linkPattern', r'href="([^"]*business[^"]*)"')
    price_pattern = site_config.get('pricePattern', r'£[\d,]+(?:\.\d+)?')
    source_id = site_config['sourceId']
    render_js = site_config.get('renderJs', True)

    for page in range(1, max_pages + 1):
        sep = '&' if '?' in base_url else '?'
        url = f'{base_url}{sep}{page_param}={page}' if page > 1 else base_url
        html = fetch(url, use_bee=True, render_js=render_js)
        if not html or len(html) < 500:
            break
        
        titles = re.findall(title_pattern, html, re.S)
        links = re.findall(link_pattern, html, re.S)
        prices = re.findall(price_pattern, html)
        
        if not titles:
            break
        
        for i, title in enumerate(titles):
            title = re.sub(r'<[^>]+>', '', title).strip()
            if len(title) < 5 or title.lower() in ('businesses for sale', 'search results'):
                continue
            href = links[i] if i < len(links) else ''
            if href and not href.startswith('http'):
                href = urljoin(base_url, href)
            listings.append({
                'title': title,
                'price': prices[i] if i < len(prices) else None,
                'location': site_config.get('defaultLocation', 'UK'),
                'url': href or base_url,
                'source': name, 'sourceId': source_id,
            })
        
        print(f'    Page {page}: {len(titles)} items (via ScrapingBee)')
        time.sleep(2)  # Be nice to ScrapingBee credits
    
    return listings

# ScrapingBee site configs for Cloudflare-protected sites
CF_SITES = [
    {
        'name': 'Rightbiz', 'sourceId': 'rightbiz',
        'searchUrl': 'https://www.rightbiz.co.uk/businesses-for-sale',
        'pageParam': 'page', 'renderJs': True,
        'titlePattern': r'<h\d[^>]*class="[^"]*listing[^"]*title[^"]*"[^>]*>(.*?)</h\d>',
        'linkPattern': r'href="(/detail/[^"]*)"',
        'pricePattern': r'£[\d,]+',
        'defaultLocation': 'UK',
    },
    {
        'name': 'BusinessesForSale', 'sourceId': 'businessesforsale',
        'searchUrl': 'https://uk.businessesforsale.com/uk/search/businesses-for-sale',
        'pageParam': 'page', 'renderJs': True,
        'titlePattern': r'<h\d[^>]*class="[^"]*listing[^"]*"[^>]*>\s*<a[^>]*>(.*?)</a>',
        'linkPattern': r'href="(/uk/[^"]*for-sale[^"]*)"',
        'pricePattern': r'£[\d,]+',
        'defaultLocation': 'UK',
    },
    {
        'name': 'Bizdaq', 'sourceId': 'bizdaq',
        'searchUrl': 'https://www.bizdaq.com/businesses-for-sale',
        'pageParam': 'page', 'renderJs': True,
        'titlePattern': r'<h\d[^>]*>(.*?)</h\d>',
        'linkPattern': r'href="(/business-for-sale/[^"]*)"',
        'pricePattern': r'£[\d,]+',
        'defaultLocation': 'UK',
    },
    {
        'name': 'BizBuySell', 'sourceId': 'bizbuysell',
        'searchUrl': 'https://www.bizbuysell.com/businesses-for-sale/',
        'pageParam': 'page', 'renderJs': True,
        'titlePattern': r'<a[^>]*class="[^"]*diamond-title[^"]*"[^>]*>(.*?)</a>',
        'linkPattern': r'href="(/Business-Opportunity/[^"]*)"',
        'pricePattern': r'\$[\d,]+',
        'defaultLocation': 'US',
    },
    {
        'name': 'Daltons Business', 'sourceId': 'daltons',
        'searchUrl': 'https://www.daltonsbusiness.com/buy/business-for-sale',
        'pageParam': 'page', 'renderJs': True,
        'titlePattern': r'<h\d[^>]*class="[^"]*title[^"]*"[^>]*>(.*?)</h\d>',
        'linkPattern': r'href="(/buy/[^"]*)"',
        'pricePattern': r'£[\d,]+',
        'defaultLocation': 'UK',
    },
]

def scrape_google_results(site_domain, max_pages=3):
    """Scrape business listings via Google search cache."""
    listings = []
    for page in range(max_pages):
        query = f'site:{site_domain} business for sale'
        url = f'https://www.google.com/search?q={quote_plus(query)}&start={page * 10}'
        html = fetch(url)
        if not html:
            break
        # Extract result titles and URLs
        results = re.findall(r'<a[^>]*href="(https?://(?:www\.)?{0}[^"]*)"[^>]*>.*?<h3[^>]*>(.*?)</h3>'.format(re.escape(site_domain)), html, re.S)
        for href, title in results:
            title = re.sub(r'<[^>]+>', '', title).strip()
            if len(title) < 5:
                continue
            listings.append({
                'title': title, 'price': None, 'location': 'UK',
                'url': href,
                'source': site_domain.split('.')[0].title(), 'sourceId': site_domain.split('.')[0],
            })
        if not results:
            break
        time.sleep(2)
    return listings


def main():
    all_listings = []
    sources = {}

    # Direct scrapers (no Cloudflare)
    scrapers = [
        ('Hilton Smythe', scrape_hiltonsmythe),
        ('SMERGERS', scrape_smergers),
        ('Flippa', scrape_flippa),
        ('DealStream', scrape_dealstream),
        ('BizQuest', scrape_bizquest),
    ]

    for name, fn in scrapers:
        print(f'🏢 Scraping {name}...')
        try:
            items = fn()
            all_listings.extend(items)
            sources[name.lower().replace(' ', '')] = len(items)
            print(f'  ✅ {len(items)} listings')
        except Exception as e:
            print(f'  ❌ {e}')
            sources[name.lower().replace(' ', '')] = 0

    # ScrapingBee scrapers (Cloudflare-protected)
    if SCRAPINGBEE_KEY:
        for site in CF_SITES:
            print(f'🐝 Scraping {site["name"]} via ScrapingBee...')
            try:
                items = scrape_with_scrapingbee(site, max_pages=20)
                all_listings.extend(items)
                sources[site['sourceId']] = len(items)
                print(f'  ✅ {len(items)} listings')
            except Exception as e:
                print(f'  ❌ {e}')
                sources[site['sourceId']] = 0
    else:
        print('⚠ No SCRAPINGBEE_API_KEY set — skipping Cloudflare-protected sites')
        print('  Affected: Rightbiz, Daltons, BusinessesForSale, Bizdaq, BizBuySell')

    # Assign IDs and deduplicate
    seen = set()
    unique = []
    for item in all_listings:
        key = item['title'].lower().replace(' ', '')[:40]
        if key not in seen:
            seen.add(key)
            item['id'] = f"{item['sourceId']}-{len(unique)}"
            item['industry'] = ''
            item['sourceUrl'] = item.get('url', '')
            item['revenue'] = None
            unique.append(item)

    # Write output
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    data = {
        'total': len(unique),
        'sources': sources,
        'scrapedAt': datetime.now(timezone.utc).isoformat(),
        'listings': unique,
    }
    with open(OUT, 'w') as f:
        json.dump(data, f, indent=2)

    print(f'\n📊 Total: {len(unique)} unique listings from {len(sources)} sources')
    print(f'📁 Written to {OUT}')


if __name__ == '__main__':
    main()
