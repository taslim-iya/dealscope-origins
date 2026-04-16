#!/usr/bin/env python3
"""
Scrape UK business-for-sale listings from all accessible sites.
Outputs JSON to public/data/listings.json
"""

import json, re, time, os, hashlib
from urllib.request import urlopen, Request
from datetime import datetime, timezone

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-GB,en;q=0.9',
}

def fetch(url, timeout=15):
    try:
        req = Request(url, headers=HEADERS)
        with urlopen(req, timeout=timeout) as resp:
            return resp.read().decode('utf-8', errors='replace')
    except Exception as e:
        print(f"  ❌ {url}: {e}")
        return ""

def clean(text):
    text = re.sub(r'<[^>]+>', '', text)
    text = re.sub(r'&amp;', '&', text)
    text = re.sub(r'&#8217;', "'", text)
    text = re.sub(r'&#038;', '&', text)
    text = re.sub(r'&nbsp;', ' ', text)
    text = re.sub(r'&#\d+;', '', text)
    text = re.sub(r'&[a-z]+;', '', text)
    return re.sub(r'\s+', ' ', text).strip()

def make_id(source, title, url=""):
    key = f"{source}::{title}::{url}"
    return hashlib.md5(key.encode()).hexdigest()[:12]

def parse_price(text):
    """Extract price from text like '£79,950' or 'USD 210 K'."""
    m = re.search(r'£([\d,]+(?:\.\d{2})?)', text)
    if m:
        return f"£{m.group(1)}"
    m = re.search(r'(?:USD|GBP)\s?([\d,.]+)\s?(K|M|Lakh|Crore|Million)?', text, re.I)
    if m:
        val = m.group(1).replace(',', '')
        suffix = (m.group(2) or '').upper()
        num = float(val)
        if suffix == 'K': num *= 1000
        elif suffix == 'M' or suffix == 'MILLION': num *= 1_000_000
        return f"£{int(num):,}"
    return None


# ─────────────────────────────────────────────────────────
# SCRAPERS
# ─────────────────────────────────────────────────────────

def scrape_hiltonsmythe():
    """Hilton Smythe — WordPress, no CF."""
    print("🏛️  Hilton Smythe...")
    listings = []
    base = "https://hiltonsmythe.com"
    for page in range(1, 4):
        url = f"{base}/businesses-for-sale/" if page == 1 else f"{base}/businesses-for-sale/page/{page}/"
        html = fetch(url)
        if not html: break
        
        # Extract listing links with titles
        blocks = re.findall(r'<h2[^>]*>(.*?)</h2>', html, re.DOTALL)
        link_matches = re.findall(r'href="(https://hiltonsmythe\.com/business-listing/[^"]+)"', html)
        links = list(dict.fromkeys(link_matches))  # dedupe preserving order
        
        for i, h in enumerate(blocks):
            title = clean(h)
            if len(title) < 10 or title.startswith('{'): continue
            link = links[i] if i < len(links) else f"{base}/businesses-for-sale/"
            listings.append({
                'id': make_id('hiltonsmythe', title, link),
                'title': title, 'price': None,
                'location': '', 'industry': '',
                'source': 'Hilton Smythe', 'sourceId': 'hiltonsmythe',
                'url': link, 'sourceUrl': base,
            })
        if f'page/{page+1}' not in html: break
        time.sleep(0.5)
    print(f"  ✅ {len(listings)}")
    return listings


def scrape_smergers():
    """SMERGERS — server-rendered."""
    print("🤖 SMERGERS...")
    listings = []
    html = fetch("https://www.smergers.com/businesses-for-sale-and-investment-in-uk/c83b/")
    if not html: return []
    
    titles = re.findall(r'<h[2-4][^>]*>(.*?)</h[2-4]>', html, re.DOTALL)
    prices = re.findall(r'(?:USD|GBP)\s?[\d,.]+\s?(?:Lakh|Crore|Million|K|M)?', html, re.I)
    
    for i, t in enumerate(titles):
        title = clean(t)
        if len(title) < 15: continue
        if 'for Sale' not in title and 'Equity' not in title and 'Investment' not in title: continue
        
        price = parse_price(prices[i]) if i < len(prices) else None
        loc_m = re.search(r'in\s+([A-Z][a-z]+(?:\s*,\s*[A-Z][a-z]+)*)', title)
        location = loc_m.group(1) if loc_m else ''
        
        listings.append({
            'id': make_id('smergers', title),
            'title': title, 'price': price,
            'location': location, 'industry': '',
            'source': 'SMERGERS', 'sourceId': 'smergers',
            'url': 'https://www.smergers.com/businesses-for-sale-and-investment-in-uk/c83b/',
            'sourceUrl': 'https://www.smergers.com',
        })
    print(f"  ✅ {len(listings)}")
    return listings


def scrape_sovereign():
    """Sovereign Business Transfer — WordPress."""
    print("👑 Sovereign BT...")
    listings = []
    html = fetch("https://www.sovereignbt.co.uk/businesses-for-sale/")
    if not html: return []
    
    titles = re.findall(r'<h2[^>]*>(.*?)</h2>', html, re.DOTALL)
    prices = re.findall(r'£[\d,]+', html)
    links = re.findall(r'href="(https://www\.sovereignbt\.co\.uk/[^"]*for-sale[^"]*)"', html)
    
    for i, t in enumerate(titles):
        title = clean(t)
        if len(title) < 15 or 'Reset' in title or 'Social' in title: continue
        if 'For Sale' not in title and 'for sale' not in title.lower(): continue
        
        price = prices[i] if i < len(prices) else None
        if price and len(price) < 4: price = None  # Skip £1, £2 etc
        
        loc_m = re.search(r'(?:in|For Sale)\s+([\w\s]+?)(?:\s+Area|\s+Town|\s+City)?$', title)
        location = ''
        for area in ['Manchester', 'Liverpool', 'Cheshire', 'Leeds', 'Sheffield', 'Wales', 'London']:
            if area.lower() in title.lower():
                location = area
                break
        
        listings.append({
            'id': make_id('sovereign', title),
            'title': title, 'price': f"£{price}" if price and not price.startswith('£') else price,
            'location': location, 'industry': '',
            'source': 'Sovereign BT', 'sourceId': 'sovereign',
            'url': links[i] if i < len(links) else 'https://www.sovereignbt.co.uk/businesses-for-sale/',
            'sourceUrl': 'https://www.sovereignbt.co.uk',
        })
    print(f"  ✅ {len(listings)}")
    return listings


def scrape_hornblower():
    """Hornblower Business Brokers — WordPress."""
    print("📯 Hornblower...")
    listings = []
    html = fetch("https://hornblower-businesses.co.uk/businesses-for-sale/")
    if not html: return []
    
    # Extract business names from h3/h4 tags
    titles = re.findall(r'<h[3-4][^>]*>(.*?)</h[3-4]>', html, re.DOTALL)
    links = re.findall(r'href="(https://hornblower-businesses\.co\.uk/business/[^"]+)"', html)
    
    seen = set()
    for t in titles:
        title = clean(t)
        if len(title) < 10 or title.lower() in seen: continue
        if any(skip in title.lower() for skip in ['sector', 'businesses for sale', 'industrial']): continue
        seen.add(title.lower())
        
        listings.append({
            'id': make_id('hornblower', title),
            'title': title, 'price': None,
            'location': '', 'industry': 'Engineering / B2B',
            'source': 'Hornblower', 'sourceId': 'hornblower',
            'url': links.pop(0) if links else 'https://hornblower-businesses.co.uk/businesses-for-sale/',
            'sourceUrl': 'https://hornblower-businesses.co.uk',
        })
    print(f"  ✅ {len(listings)}")
    return listings


def scrape_sellingmybusiness():
    """SellingMyBusiness — 800+ listings, well-structured."""
    print("🏷️  SellingMyBusiness...")
    listings = []
    
    for page in range(1, 6):
        url = f"https://www.sellingmybusiness.co.uk/buy-a-business" if page == 1 else f"https://www.sellingmybusiness.co.uk/buy-a-business?page={page}"
        html = fetch(url)
        if not html: break
        
        # Pattern: Price + Name + Location + Tenure + Date
        blocks = re.findall(r'Price:\s*£([\d,]+).*?(?:\n|<br>)\s*(.*?)(?:\n|<br>)\s*Location:\s*(.*?)(?:\n|<br>)', html, re.DOTALL)
        if not blocks:
            # Try alternative parsing
            prices = re.findall(r'Price:\s*£([\d,]+)', html)
            names = re.findall(r'£[\d,]+\s*\n\s*([A-Z][\w\s,\'-]+)', html)
            locations = re.findall(r'Location:\s*([\w\s]+)', html)
            
            for i in range(min(len(prices), len(names))):
                title = clean(names[i]) if i < len(names) else f"Business #{i}"
                location = clean(locations[i]) if i < len(locations) else ''
                price = f"£{prices[i]}"
                
                listings.append({
                    'id': make_id('sellingmybusiness', title, price),
                    'title': title, 'price': price,
                    'location': location, 'industry': '',
                    'source': 'SellingMyBusiness', 'sourceId': 'sellingmybusiness',
                    'url': 'https://www.sellingmybusiness.co.uk/buy-a-business',
                    'sourceUrl': 'https://www.sellingmybusiness.co.uk',
                })
        else:
            for price, name, location in blocks:
                listings.append({
                    'id': make_id('sellingmybusiness', clean(name), price),
                    'title': clean(name), 'price': f"£{price}",
                    'location': clean(location), 'industry': '',
                    'source': 'SellingMyBusiness', 'sourceId': 'sellingmybusiness',
                    'url': 'https://www.sellingmybusiness.co.uk/buy-a-business',
                    'sourceUrl': 'https://www.sellingmybusiness.co.uk',
                })
        
        if f'page={page+1}' not in html and page > 1: break
        time.sleep(0.5)
    
    print(f"  ✅ {len(listings)}")
    return listings


def scrape_cogogo():
    """Cogogo — UK business marketplace."""
    print("🚀 Cogogo...")
    listings = []
    html = fetch("https://letscogogo.com/businesses-for-sale/")
    if not html: return []
    
    # Cogogo has listing cards with prices
    prices = re.findall(r'£[\d,]+', html)
    titles = re.findall(r'<h[2-4][^>]*>(.*?)</h[2-4]>', html, re.DOTALL)
    links = re.findall(r'href="(https://letscogogo\.com/business/[^"]+)"', html)
    
    # Also try card-based extraction
    cards = re.findall(r'<article[^>]*>(.*?)</article>', html, re.DOTALL)
    if cards:
        for card in cards:
            title_m = re.search(r'<h[2-4][^>]*>(.*?)</h[2-4]>', card, re.DOTALL)
            price_m = re.search(r'£[\d,]+', card)
            link_m = re.search(r'href="(https://letscogogo\.com/business/[^"]+)"', card)
            loc_m = re.search(r'(?:Location|Area):\s*([\w\s,]+)', card)
            
            if title_m:
                title = clean(title_m.group(1))
                if len(title) < 8: continue
                listings.append({
                    'id': make_id('cogogo', title),
                    'title': title,
                    'price': price_m.group(0) if price_m else None,
                    'location': clean(loc_m.group(1)) if loc_m else '',
                    'industry': '',
                    'source': 'Cogogo', 'sourceId': 'cogogo',
                    'url': link_m.group(1) if link_m else 'https://letscogogo.com/businesses-for-sale/',
                    'sourceUrl': 'https://letscogogo.com',
                })
    
    # If no cards found, use prices list as indicator
    if not listings and prices:
        for i, price in enumerate(prices[:20]):
            listings.append({
                'id': make_id('cogogo', f"cogogo-listing-{i}", price),
                'title': f"Business Listed at {price}",
                'price': price,
                'location': '', 'industry': '',
                'source': 'Cogogo', 'sourceId': 'cogogo',
                'url': 'https://letscogogo.com/businesses-for-sale/',
                'sourceUrl': 'https://letscogogo.com',
            })
    
    print(f"  ✅ {len(listings)}")
    return listings


def scrape_mybizdaq():
    """MyBizdaq — alternative Bizdaq domain, no CF."""
    print("🔷 MyBizdaq...")
    listings = []
    html = fetch("https://www.mybizdaq.com/businesses-for-sale")
    if not html: return []
    
    # MyBizdaq has 1155 listings, look for listing cards
    cards = re.findall(r'<div[^>]*class="[^"]*listing-card[^"]*"[^>]*>(.*?)</div>\s*</div>', html, re.DOTALL)
    titles = re.findall(r'<h[2-4][^>]*>(.*?)</h[2-4]>', html, re.DOTALL)
    links = re.findall(r'href="(/businesses-for-sale/[^"]+)"', html)
    prices = re.findall(r'£[\d,]+', html)
    
    # Also look for JSON-LD or structured data
    json_ld = re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.DOTALL)
    
    for i, t in enumerate(titles):
        title = clean(t)
        if len(title) < 10 or 'Available' in title: continue
        link = f"https://www.mybizdaq.com{links[i]}" if i < len(links) else 'https://www.mybizdaq.com/businesses-for-sale'
        listings.append({
            'id': make_id('mybizdaq', title, link),
            'title': title, 'price': prices[i] if i < len(prices) else None,
            'location': '', 'industry': '',
            'source': 'MyBizdaq', 'sourceId': 'mybizdaq',
            'url': link, 'sourceUrl': 'https://www.mybizdaq.com',
        })
    
    print(f"  ✅ {len(listings)}")
    return listings


def scrape_christie():
    """Christie & Co — major UK hospitality/care broker."""
    print("🏨 Christie & Co...")
    listings = []
    base = "https://www.christie.com"
    
    # Try their search results with different sectors
    for sector in ['hotels', 'pubs', 'restaurants', 'care', 'retail', 'childcare', 'dental', 'pharmacy']:
        url = f"{base}/businesses-for-sale/{sector}/"
        html = fetch(url)
        if not html: continue
        
        links = re.findall(r'href="(/businesses-for-sale/detail/\d+/[^"]+)"', html)
        titles = re.findall(r'<h[2-4][^>]*class="[^"]*(?:title|name)[^"]*"[^>]*>(.*?)</h[2-4]>', html, re.DOTALL)
        
        # Broader title extraction
        if not titles:
            titles = re.findall(r'<h[3-4][^>]*>(.*?)</h[3-4]>', html, re.DOTALL)
        
        for i, link in enumerate(links[:10]):
            slug = link.split('/')[-1]
            title = slug.replace('-', ' ').title()
            if len(title) < 8: continue
            
            listings.append({
                'id': make_id('christie', title, link),
                'title': title, 'price': None,
                'location': '', 'industry': sector.title(),
                'source': 'Christie & Co', 'sourceId': 'christie',
                'url': f"{base}{link}",
                'sourceUrl': base,
            })
        time.sleep(0.3)
    
    print(f"  ✅ {len(listings)}")
    return listings


def scrape_flippa():
    """Flippa — digital/online businesses."""
    print("💻 Flippa...")
    listings = []
    html = fetch("https://flippa.com/online-businesses-united-kingdom")
    if not html: return []
    
    titles = re.findall(r'"title":\s*"([^"]{10,120})"', html)
    prices_raw = re.findall(r'"(?:price|asking_price|current_price)":\s*(\d+)', html)
    urls_raw = re.findall(r'"(?:url|listing_url)":\s*"(https://flippa\.com/\d+)"', html)
    
    seen = set()
    for i, title in enumerate(titles):
        if title in seen or len(title) < 10: continue
        seen.add(title)
        price = f"${int(prices_raw[i]):,}" if i < len(prices_raw) else None
        url = urls_raw[i] if i < len(urls_raw) else 'https://flippa.com/online-businesses-united-kingdom'
        listings.append({
            'id': make_id('flippa', title, url),
            'title': title, 'price': price,
            'location': 'Online', 'industry': 'Digital',
            'source': 'Flippa', 'sourceId': 'flippa',
            'url': url, 'sourceUrl': 'https://flippa.com',
        })
    print(f"  ✅ {len(listings)}")
    return listings


def scrape_blacksbrokers():
    """Blacks Brokers — 15+ years, Business Transfer Group member."""
    print("⬛ Blacks Brokers...")
    listings = []
    for url in [
        "https://www.blacksbrokers.com/buy-a-business/",
        "https://www.blacksbrokers.com/businesses-for-sale/",
    ]:
        html = fetch(url)
        if not html or '404' in html[:500]: continue
        
        titles = re.findall(r'<h[2-4][^>]*>(.*?)</h[2-4]>', html, re.DOTALL)
        prices = re.findall(r'£[\d,]+', html)
        
        for i, t in enumerate(titles):
            title = clean(t)
            if len(title) < 10: continue
            listings.append({
                'id': make_id('blacks', title),
                'title': title, 'price': prices[i] if i < len(prices) else None,
                'location': '', 'industry': '',
                'source': 'Blacks Brokers', 'sourceId': 'blacksbrokers',
                'url': url, 'sourceUrl': 'https://www.blacksbrokers.com',
            })
        if listings: break
    print(f"  ✅ {len(listings)}")
    return listings


# Google cache scraping for CF-protected sites
def scrape_google_search(site_domain, source_name, source_id):
    """Use Google search to find recent listings on CF-protected sites."""
    print(f"🔍 Google search: {source_name}...")
    listings = []
    
    query = f"site:{site_domain} business for sale"
    url = f"https://www.google.com/search?q={query.replace(' ', '+')}&num=30"
    html = fetch(url)
    if not html: return []
    
    # Extract Google result titles and URLs
    results = re.findall(r'<a[^>]*href="/url\?q=(https://[^"&]+)[^"]*"[^>]*>.*?<h3[^>]*>(.*?)</h3>', html, re.DOTALL)
    if not results:
        # Try alternative pattern
        results = re.findall(r'href="(https://(?:www\.)?{}/[^"]+)"[^>]*>.*?<h3[^>]*>(.*?)</h3>'.format(re.escape(site_domain)), html, re.DOTALL)
    
    for url_match, title_html in results:
        title = clean(title_html)
        if len(title) < 10: continue
        if any(skip in title.lower() for skip in ['privacy', 'terms', 'about', 'contact', 'login', 'sign up']): continue
        
        listings.append({
            'id': make_id(source_id, title, url_match),
            'title': title, 'price': None,
            'location': '', 'industry': '',
            'source': source_name, 'sourceId': source_id,
            'url': url_match, 'sourceUrl': f"https://{site_domain}",
        })
    
    print(f"  ✅ {len(listings)}")
    return listings


# ─────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────

def main():
    all_listings = []
    sources_summary = {}
    
    # Direct scrapers (no Cloudflare)
    scrapers = [
        scrape_hiltonsmythe,
        scrape_smergers,
        scrape_sovereign,
        scrape_hornblower,
        scrape_sellingmybusiness,
        scrape_cogogo,
        scrape_mybizdaq,
        scrape_christie,
        scrape_flippa,
        scrape_blacksbrokers,
    ]
    
    # Google search for CF-protected sites
    google_targets = [
        ('www.rightbiz.co.uk', 'Rightbiz', 'rightbiz'),
        ('www.daltonsbusiness.com', 'Daltons Business', 'daltons'),
        ('uk.businessesforsale.com', 'BusinessesForSale.com', 'businessesforsale'),
    ]
    
    for scraper in scrapers:
        try:
            results = scraper()
            all_listings.extend(results)
            sid = results[0]['sourceId'] if results else scraper.__name__.replace('scrape_', '')
            sources_summary[sid] = len(results)
        except Exception as e:
            print(f"  ❌ Error in {scraper.__name__}: {e}")
        time.sleep(0.8)
    
    for domain, name, sid in google_targets:
        try:
            results = scrape_google_search(domain, name, sid)
            all_listings.extend(results)
            sources_summary[sid] = len(results)
        except Exception as e:
            print(f"  ❌ Google search error for {name}: {e}")
        time.sleep(1)
    
    # Deduplicate
    seen = set()
    unique = []
    for l in all_listings:
        key = l['title'].lower()[:50]
        if key not in seen:
            seen.add(key)
            unique.append(l)
    
    output = {
        'total': len(unique),
        'sources': sources_summary,
        'scrapedAt': datetime.now(timezone.utc).isoformat(),
        'listings': unique,
    }
    
    out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'data')
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, 'listings.json')
    
    with open(out_path, 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"\n{'='*50}")
    print(f"Total: {len(unique)} unique listings from {len([v for v in sources_summary.values() if v > 0])} sources")
    print(f"Saved to: {out_path}")
    for sid, count in sorted(sources_summary.items(), key=lambda x: -x[1]):
        print(f"  {sid}: {count}")


if __name__ == '__main__':
    main()
