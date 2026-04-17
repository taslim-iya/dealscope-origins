#!/usr/bin/env python3
"""V2 scraper — extract real listings from working UK business-for-sale sites."""

import json, re, os, time
from urllib.request import Request, urlopen
from urllib.parse import quote_plus
from datetime import datetime, timezone

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'data', 'listings.json')
BEE_KEY = os.environ.get('SCRAPINGBEE_API_KEY', '')
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

def fetch(url, timeout=25):
    try:
        req = Request(url, headers={'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml'})
        with urlopen(req, timeout=timeout) as r:
            return r.read().decode('utf-8', errors='replace')
    except Exception as e:
        print(f'    ✗ fetch error: {e}')
        return ''

def bee(url, render=True):
    if not BEE_KEY: return ''
    params = f'api_key={BEE_KEY}&url={quote_plus(url)}'
    if render: params += '&render_js=true&wait=5000'
    try:
        req = Request(f'https://app.scrapingbee.com/api/v1/?{params}', headers={'User-Agent': UA})
        with urlopen(req, timeout=90) as r:
            return r.read().decode('utf-8', errors='replace')
    except Exception as e:
        print(f'    ✗ bee error: {e}')
        return ''

def clean(s):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', s)).strip()

def parse_price(text):
    m = re.search(r'[£$]\s?[\d,]+(?:\.\d+)?', text)
    return m.group(0).strip() if m else None

# ─── HILTON SMYTHE ───
def scrape_hiltonsmythe():
    listings = []
    for page in range(1, 15):
        url = f'https://hiltonsmythe.com/businesses-for-sale/page/{page}/' if page > 1 else 'https://hiltonsmythe.com/businesses-for-sale/'
        html = fetch(url)
        if not html or len(html) < 1000: break
        
        # Find listing links + titles
        blocks = re.findall(r'<a\s+href="(https://hiltonsmythe\.com/business-listing/[^"]+)"[^>]*>(.*?)</a>', html, re.S)
        found = 0
        for href, inner in blocks:
            title = clean(inner)
            if len(title) < 5 or title.lower() in ('read more', 'view details', 'find out more'): continue
            # Look for price near this listing
            idx = html.find(href)
            chunk = html[max(0,idx-500):idx+1000] if idx >= 0 else ''
            price = parse_price(chunk) if chunk else None
            loc_m = re.search(r'(?:North West|South East|South West|North East|East Midlands|West Midlands|London|Yorkshire|Scotland|Wales|UK)', chunk, re.I)
            listings.append({
                'title': title[:120],
                'price': price,
                'location': loc_m.group(0) if loc_m else 'UK',
                'industry': '',
                'url': href,
                'source': 'Hilton Smythe', 'sourceId': 'hiltonsmythe',
            })
            found += 1
        if found == 0: break
        time.sleep(1.5)
    print(f'  Hilton Smythe: {len(listings)}')
    return listings

# ─── NATIONWIDE BUSINESSES ───
def scrape_nationwide():
    listings = []
    for page in range(1, 50):
        url = f'https://www.nationwidebusinesses.co.uk/buy/index.asp?page={page}'
        html = fetch(url)
        if not html or len(html) < 500: break
        
        # Find /businessesforsale/ links with text
        pattern = r'href="(/businessesforsale/[^"]+)"[^>]*>\s*(.*?)\s*</a>'
        links = re.findall(pattern, html, re.S)
        # Also get all prices on page
        prices = re.findall(r'£[\d,]+', html)
        
        found = 0
        for i, (href, raw_title) in enumerate(links):
            title = clean(raw_title)
            if len(title) < 3: continue
            # Extract location from title pattern "X in Y for sale"
            loc_m = re.search(r'\bin\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)', title)
            location = loc_m.group(1) if loc_m else 'UK'
            listings.append({
                'title': title[:120],
                'price': prices[found] if found < len(prices) else None,
                'location': location,
                'industry': '',
                'url': f'https://www.nationwidebusinesses.co.uk{href}',
                'source': 'Nationwide', 'sourceId': 'nationwide',
            })
            found += 1
        if found == 0: break
        time.sleep(1.5)
    print(f'  Nationwide: {len(listings)}')
    return listings

# ─── FLIPPA (via ScrapingBee — JS rendered) ───
def scrape_flippa():
    if not BEE_KEY:
        print('  Flippa: skipped (needs ScrapingBee)')
        return []
    listings = []
    for page in range(1, 8):
        url = f'https://flippa.com/search?filter%5Bproperty_type%5D=established_website&filter%5Bcountry%5D%5B%5D=GB&page={page}'
        html = bee(url)
        if not html or len(html) < 500: break
        
        # Flippa renders listing cards
        titles = re.findall(r'class="[^"]*ListingCard[^"]*Title[^"]*"[^>]*>(.*?)</', html, re.S)
        if not titles:
            titles = re.findall(r'<h[234][^>]*>(.*?)</h[234]>', html, re.S)
        links = re.findall(r'href="(https://flippa\.com/\d+)"', html)
        if not links:
            links = re.findall(r'href="(/\d+)"', html)
            links = [f'https://flippa.com{l}' for l in links]
        prices = re.findall(r'\$[\d,]+', html)
        revenues = re.findall(r'(?:Revenue|revenue)[^$]*(\$[\d,]+)', html)
        
        for i, t in enumerate(titles[:20]):
            t_clean = clean(t)
            if len(t_clean) < 5 or t_clean.lower() in ('flippa', 'search', 'login'): continue
            listings.append({
                'title': t_clean[:120],
                'price': prices[i] if i < len(prices) else None,
                'revenue': revenues[i] if i < len(revenues) else None,
                'location': 'UK / Online',
                'industry': 'Online Business',
                'url': links[i] if i < len(links) else 'https://flippa.com',
                'source': 'Flippa', 'sourceId': 'flippa',
            })
        time.sleep(2.5)
        if len(listings) >= 100: break
    print(f'  Flippa: {len(listings)}')
    return listings

# ─── BUSINESSES FOR SALE (via ScrapingBee) ───
def scrape_bfs():
    if not BEE_KEY:
        print('  BFS: skipped')
        return []
    listings = []
    for page in range(1, 15):
        url = f'https://uk.businessesforsale.com/uk/search/businesses-for-sale?page={page}'
        html = bee(url)
        if not html or len(html) < 1000: break
        
        # BFS listing structure: links with /uk/ paths containing "for-sale"
        pattern = r'href="(https://uk\.businessesforsale\.com/uk/[^"]*for-sale[^"]*)"[^>]*>\s*(.*?)\s*</a>'
        found_links = re.findall(pattern, html, re.S)
        if not found_links:
            pattern = r'href="(/uk/[^"]*for-sale[^"]*)"[^>]*>\s*(.*?)\s*</a>'
            found_links = [(f'https://uk.businessesforsale.com{h}', t) for h, t in re.findall(pattern, html, re.S)]
        
        prices = re.findall(r'£[\d,]+', html)
        
        found = 0
        for i, (href, raw) in enumerate(found_links):
            title = clean(raw)
            if len(title) < 8 or title.lower() in ('search', 'home', 'login', 'register', 'choose your country'): continue
            loc_m = re.search(r'\bin\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)', title)
            listings.append({
                'title': title[:120],
                'price': prices[found] if found < len(prices) else None,
                'location': loc_m.group(1) if loc_m else 'UK',
                'industry': '',
                'url': href,
                'source': 'BusinessesForSale', 'sourceId': 'businessesforsale',
            })
            found += 1
        if found == 0: break
        time.sleep(2.5)
        if len(listings) >= 300: break
    print(f'  BFS: {len(listings)}')
    return listings

# ─── RIGHTBIZ (via ScrapingBee) ───
def scrape_rightbiz():
    if not BEE_KEY:
        print('  Rightbiz: skipped')
        return []
    listings = []
    for page in range(1, 8):
        url = f'https://www.rightbiz.co.uk/businesses-for-sale?page={page}'
        html = bee(url)
        if not html or len(html) < 500: break
        
        pattern = r'href="((?:https://www\.rightbiz\.co\.uk)?/business-for-sale/[^"]+)"[^>]*>\s*(.*?)\s*</a>'
        found_links = re.findall(pattern, html, re.S)
        prices = re.findall(r'£[\d,]+', html)
        
        found = 0
        for i, (href, raw) in enumerate(found_links):
            title = clean(raw)
            if len(title) < 5: continue
            full_url = href if href.startswith('http') else f'https://www.rightbiz.co.uk{href}'
            listings.append({
                'title': title[:120],
                'price': prices[found] if found < len(prices) else None,
                'location': 'UK',
                'industry': '',
                'url': full_url,
                'source': 'Rightbiz', 'sourceId': 'rightbiz',
            })
            found += 1
        if found == 0: break
        time.sleep(2.5)
        if len(listings) >= 150: break
    print(f'  Rightbiz: {len(listings)}')
    return listings

# ─── MAIN ───
def main():
    print(f'🕷️  DealScope V2 — {datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")}')
    print(f'   ScrapingBee: {"✅" if BEE_KEY else "❌"}')
    
    all_listings = []
    
    print('\n📡 Direct:')
    all_listings += scrape_hiltonsmythe()
    all_listings += scrape_nationwide()
    
    if BEE_KEY:
        print('\n🐝 ScrapingBee:')
        all_listings += scrape_flippa()
        all_listings += scrape_bfs()
        all_listings += scrape_rightbiz()
    
    # Dedupe
    seen = set()
    unique = []
    for l in all_listings:
        key = re.sub(r'[^a-z0-9]', '', l['title'].lower())[:50]
        if key and key not in seen and len(l['title']) > 4:
            seen.add(key)
            l['id'] = f"{l['sourceId']}-{len(unique)}"
            unique.append(l)
    
    sources = {}
    for l in unique:
        sources[l['sourceId']] = sources.get(l['sourceId'], 0) + 1
    
    output = {
        'total': len(unique),
        'sources': sources,
        'scrapedAt': datetime.now(timezone.utc).isoformat(),
        'listings': unique,
    }
    
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w') as f:
        json.dump(output, f)
    
    print(f'\n✅ {len(unique)} unique listings')
    for src, count in sorted(sources.items(), key=lambda x: -x[1]):
        print(f'   {src}: {count}')

if __name__ == '__main__':
    main()
