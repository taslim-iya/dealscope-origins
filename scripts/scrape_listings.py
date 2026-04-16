#!/usr/bin/env python3
"""
Scrape UK business-for-sale listings from all accessible sites.
Outputs JSON to public/data/listings.json for the app to consume.
"""

import json, re, time, os, hashlib
from urllib.request import urlopen, Request
from html.parser import HTMLParser
from datetime import datetime

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-GB,en;q=0.9',
}

def fetch(url, timeout=15):
    """Fetch URL with browser-like headers."""
    try:
        req = Request(url, headers=HEADERS)
        with urlopen(req, timeout=timeout) as resp:
            return resp.read().decode('utf-8', errors='replace')
    except Exception as e:
        print(f"  ❌ Failed to fetch {url}: {e}")
        return ""

def clean(text):
    """Strip HTML tags and clean whitespace."""
    text = re.sub(r'<[^>]+>', '', text)
    text = re.sub(r'&amp;', '&', text)
    text = re.sub(r'&lt;', '<', text)
    text = re.sub(r'&gt;', '>', text)
    text = re.sub(r'&#\d+;', '', text)
    text = re.sub(r'&[a-z]+;', '', text)
    return re.sub(r'\s+', ' ', text).strip()

def make_id(source, title, url=""):
    """Deterministic ID for deduplication."""
    key = f"{source}::{title}::{url}"
    return hashlib.md5(key.encode()).hexdigest()[:12]

# ─────────────────────────────────────────────────────────────
# SCRAPERS
# ─────────────────────────────────────────────────────────────

def scrape_hiltonsmythe():
    """Hilton Smythe — WordPress, no Cloudflare."""
    print("🏛️  Scraping Hilton Smythe...")
    listings = []
    base = "https://hiltonsmythe.com"
    
    for page in range(1, 6):  # First 5 pages
        url = f"{base}/businesses-for-sale/" if page == 1 else f"{base}/businesses-for-sale/page/{page}/"
        html = fetch(url)
        if not html:
            break
        
        # Extract listing blocks
        blocks = re.findall(
            r'<a[^>]*href="(https://hiltonsmythe\.com/business-listing/[^"]+)"[^>]*>.*?</a>',
            html, re.DOTALL
        )
        titles = re.findall(r'<h2[^>]*>(.*?)</h2>', html, re.DOTALL)
        prices = re.findall(r'£([\d,]+)', html)
        
        # Better extraction - find listing cards
        cards = re.findall(
            r'<article[^>]*>(.*?)</article>',
            html, re.DOTALL
        )
        if not cards:
            cards = re.findall(r'class="[^"]*listing[^"]*"[^>]*>(.*?)</div>\s*</div>', html, re.DOTALL)
        
        for i, title_match in enumerate(titles):
            title = clean(title_match)
            if len(title) < 10 or title.startswith('{'):
                continue
            
            price = None
            if i < len(prices):
                price = f"£{prices[i]}"
            
            link_match = re.findall(r'href="(https://hiltonsmythe\.com/business-listing/[^"]+)"', html)
            link = link_match[i] if i < len(link_match) else f"{base}/businesses-for-sale/"
            
            listings.append({
                'id': make_id('hiltonsmythe', title, link),
                'title': title,
                'price': price,
                'location': '',
                'industry': '',
                'source': 'Hilton Smythe',
                'sourceId': 'hiltonsmythe',
                'url': link,
                'sourceUrl': base,
            })
        
        if f'page/{page + 1}' not in html:
            break
        time.sleep(0.5)
    
    print(f"  ✅ {len(listings)} listings")
    return listings


def scrape_smergers():
    """SMERGERS — server-rendered, no Cloudflare."""
    print("🤖 Scraping SMERGERS...")
    listings = []
    
    html = fetch("https://www.smergers.com/businesses-for-sale-and-investment-in-uk/c83b/")
    if not html:
        return listings
    
    # SMERGERS uses structured cards with title + location + price
    # Pattern: title in h2/h3, location after, price with USD/GBP
    title_blocks = re.findall(
        r'<h[2-4][^>]*>(.*?)</h[2-4]>',
        html, re.DOTALL
    )
    
    prices = re.findall(r'(?:USD|GBP|£|\$)\s?[\d,.]+\s?(?:Lakh|Crore|Million|K|M)?', html, re.I)
    locations = re.findall(r'(?:in|located in)\s+([A-Z][a-z]+(?:\s*,\s*[A-Z][a-z]+)*(?:,\s*UK)?)', html, re.I)
    
    for i, t in enumerate(title_blocks):
        title = clean(t)
        if len(title) < 15 or 'for Sale' not in title and 'Equity' not in title and 'Investment' not in title:
            continue
        
        price = prices[i] if i < len(prices) else None
        location = locations[i] if i < len(locations) else ''
        
        listings.append({
            'id': make_id('smergers', title),
            'title': title,
            'price': price,
            'location': location if isinstance(location, str) else '',
            'industry': '',
            'source': 'SMERGERS',
            'sourceId': 'smergers',
            'url': 'https://www.smergers.com/businesses-for-sale-and-investment-in-uk/c83b/',
            'sourceUrl': 'https://www.smergers.com',
        })
    
    print(f"  ✅ {len(listings)} listings")
    return listings


def scrape_intelligent():
    """Intelligent Business Partners — paginated, server-rendered."""
    print("🧠 Scraping Intelligent...")
    listings = []
    base = "https://www.intelligent.co.uk"
    
    for page in range(1, 6):
        url = f"{base}/businesses-for-sale" if page == 1 else f"{base}/businesses-for-sale?page={page}"
        html = fetch(url)
        if not html:
            break
        
        # Extract listing data from price/turnover data attributes
        prices = re.findall(r'data-price="(\d+)"', html)
        turnovers = re.findall(r'data-turnover="(\d+)"', html)
        
        # Extract titles from anchor tags
        title_links = re.findall(
            r'<a[^>]*href="(/businesses-for-sale/[^"]+)"[^>]*>(.*?)</a>',
            html, re.DOTALL
        )
        
        for i, (href, title_html) in enumerate(title_links):
            title = clean(title_html)
            if len(title) < 10:
                continue
            
            price = f"£{int(prices[i]):,}" if i < len(prices) and prices[i] != '0' else None
            
            listings.append({
                'id': make_id('intelligent', title, href),
                'title': title,
                'price': price,
                'revenue': f"£{int(turnovers[i]):,}" if i < len(turnovers) and turnovers[i] != '0' else None,
                'location': '',
                'industry': '',
                'source': 'Intelligent',
                'sourceId': 'intelligent',
                'url': f"{base}{href}",
                'sourceUrl': base,
            })
        
        if f'page={page + 1}' not in html and page > 1:
            break
        time.sleep(0.5)
    
    print(f"  ✅ {len(listings)} listings")
    return listings


def scrape_daltons():
    """Daltons Business — check for sitemap/feed."""
    print("🔵 Scraping Daltons (sitemap)...")
    listings = []
    
    # Try sitemap
    sitemap = fetch("https://www.daltonsbusiness.com/sitemap.xml")
    if sitemap:
        urls = re.findall(r'<loc>(https://www\.daltonsbusiness\.com/buy/[^<]+)</loc>', sitemap)
        print(f"  Found {len(urls)} URLs in sitemap")
        
        for url in urls[:50]:  # Sample first 50
            slug = url.split('/')[-1]
            title = slug.replace('-', ' ').title()
            listings.append({
                'id': make_id('daltons', title, url),
                'title': title,
                'price': None,
                'location': '',
                'industry': '',
                'source': 'Daltons Business',
                'sourceId': 'daltons',
                'url': url,
                'sourceUrl': 'https://www.daltonsbusiness.com',
            })
    
    # Also try RSS
    rss = fetch("https://www.daltonsbusiness.com/feed")
    if rss and '<item>' in rss:
        items = re.findall(r'<item>(.*?)</item>', rss, re.DOTALL)
        for item in items:
            title_m = re.search(r'<title>(.*?)</title>', item)
            link_m = re.search(r'<link>(.*?)</link>', item)
            if title_m:
                title = clean(title_m.group(1))
                link = link_m.group(1) if link_m else ''
                listings.append({
                    'id': make_id('daltons', title, link),
                    'title': title,
                    'price': None,
                    'location': '',
                    'industry': '',
                    'source': 'Daltons Business',
                    'sourceId': 'daltons',
                    'url': link,
                    'sourceUrl': 'https://www.daltonsbusiness.com',
                })
    
    print(f"  ✅ {len(listings)} listings")
    return listings


def scrape_flippa():
    """Flippa — search page, heavy JS but has meta tags."""
    print("💻 Scraping Flippa...")
    listings = []
    
    html = fetch("https://flippa.com/online-businesses-united-kingdom")
    if not html:
        return listings
    
    # Flippa embeds listing data in script tags
    json_blocks = re.findall(r'"listing":\s*(\{[^}]{50,500}\})', html)
    
    # Also try meta/og tags
    titles = re.findall(r'"title":\s*"([^"]{10,120})"', html)
    prices_raw = re.findall(r'"(?:price|asking_price|current_price)":\s*(\d+)', html)
    urls_raw = re.findall(r'"(?:url|listing_url)":\s*"(https://flippa\.com/[^"]+)"', html)
    
    seen = set()
    for i, title in enumerate(titles):
        if title in seen or len(title) < 10:
            continue
        seen.add(title)
        
        price = f"${int(prices_raw[i]):,}" if i < len(prices_raw) else None
        url = urls_raw[i] if i < len(urls_raw) else 'https://flippa.com/online-businesses-united-kingdom'
        
        listings.append({
            'id': make_id('flippa', title, url),
            'title': title,
            'price': price,
            'location': 'Online',
            'industry': 'Digital',
            'source': 'Flippa',
            'sourceId': 'flippa',
            'url': url,
            'sourceUrl': 'https://flippa.com',
        })
    
    print(f"  ✅ {len(listings)} listings")
    return listings


def scrape_nationwidebusinesses():
    """Nationwide Businesses — small site."""
    print("🏴 Scraping Nationwide Businesses...")
    listings = []
    
    html = fetch("https://www.nationwidebusinesses.co.uk/businesses-for-sale")
    if not html:
        return listings
    
    titles = re.findall(r'<h[2-4][^>]*>(.*?)</h[2-4]>', html, re.DOTALL)
    prices = re.findall(r'£[\d,]+', html)
    
    for i, t in enumerate(titles):
        title = clean(t)
        if len(title) < 10:
            continue
        price = prices[i] if i < len(prices) else None
        listings.append({
            'id': make_id('nationwide', title),
            'title': title,
            'price': price,
            'location': '',
            'industry': '',
            'source': 'Nationwide Businesses',
            'sourceId': 'nationwidebusinesses',
            'url': 'https://www.nationwidebusinesses.co.uk/businesses-for-sale',
            'sourceUrl': 'https://www.nationwidebusinesses.co.uk',
        })
    
    print(f"  ✅ {len(listings)} listings")
    return listings


# ─────────────────────────────────────────────────────────────
# CLOUDFLARE-BLOCKED SITES — try sitemaps instead
# ─────────────────────────────────────────────────────────────

def scrape_via_sitemap(domain, source_name, source_id, listing_pattern):
    """Try to scrape via sitemap for Cloudflare-protected sites."""
    print(f"🔍 Trying sitemap for {source_name}...")
    listings = []
    
    for sitemap_url in [
        f"https://{domain}/sitemap.xml",
        f"https://{domain}/sitemap_index.xml",
        f"https://{domain}/sitemap-0.xml",
        f"https://www.{domain}/sitemap.xml",
    ]:
        xml = fetch(sitemap_url)
        if xml and '<url>' in xml:
            urls = re.findall(r'<loc>([^<]*' + listing_pattern + r'[^<]*)</loc>', xml)
            print(f"  Found {len(urls)} listing URLs in {sitemap_url}")
            
            for url in urls[:100]:  # Cap at 100
                slug = url.rstrip('/').split('/')[-1]
                title = slug.replace('-', ' ').replace('_', ' ').title()
                if len(title) < 5:
                    continue
                listings.append({
                    'id': make_id(source_id, title, url),
                    'title': title,
                    'price': None,
                    'location': '',
                    'industry': '',
                    'source': source_name,
                    'sourceId': source_id,
                    'url': url,
                    'sourceUrl': f"https://{domain}",
                })
            break
    
    print(f"  ✅ {len(listings)} listings")
    return listings


# ─────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────

def main():
    all_listings = []
    sources_summary = {}
    
    scrapers = [
        scrape_hiltonsmythe,
        scrape_smergers,
        scrape_intelligent,
        scrape_daltons,
        scrape_flippa,
        scrape_nationwidebusinesses,
    ]
    
    # Cloudflare sites — try sitemaps
    sitemap_sources = [
        ('rightbiz.co.uk', 'Rightbiz', 'rightbiz', '/businesses-for-sale/'),
        ('businessesforsale.com', 'BusinessesForSale.com', 'businessesforsale', '/uk/'),
        ('business-sale.com', 'Business Sale Report', 'businesssale', '/businesses/'),
        ('bizdaq.com', 'Bizdaq', 'bizdaq', '/businesses-for-sale/'),
    ]
    
    # Run direct scrapers
    for scraper in scrapers:
        try:
            results = scraper()
            all_listings.extend(results)
            source_id = results[0]['sourceId'] if results else scraper.__name__.replace('scrape_', '')
            sources_summary[source_id] = len(results)
        except Exception as e:
            print(f"  ❌ Error in {scraper.__name__}: {e}")
        time.sleep(1)
    
    # Run sitemap scrapers
    for domain, name, sid, pattern in sitemap_sources:
        try:
            results = scrape_via_sitemap(domain, name, sid, pattern)
            all_listings.extend(results)
            sources_summary[sid] = len(results)
        except Exception as e:
            print(f"  ❌ Error scraping {name}: {e}")
        time.sleep(0.5)
    
    # Deduplicate
    seen = set()
    unique = []
    for l in all_listings:
        key = l['title'].lower()[:50]
        if key not in seen:
            seen.add(key)
            unique.append(l)
    
    # Save
    output = {
        'total': len(unique),
        'sources': sources_summary,
        'scrapedAt': datetime.utcnow().isoformat() + 'Z',
        'listings': unique,
    }
    
    out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'data')
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, 'listings.json')
    
    with open(out_path, 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"\n{'='*50}")
    print(f"Total: {len(unique)} unique listings from {len(sources_summary)} sources")
    print(f"Saved to: {out_path}")
    for sid, count in sorted(sources_summary.items(), key=lambda x: -x[1]):
        print(f"  {sid}: {count}")


if __name__ == '__main__':
    main()
