#!/usr/bin/env python3
"""V3 scraper — reliable UK business listing extraction with pagination."""

import json, re, os, time, sys
from urllib.request import Request, urlopen
from urllib.parse import quote_plus, urlencode
from datetime import datetime, timezone
from html import unescape

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'data', 'listings.json')
BEE_KEY = os.environ.get('SCRAPINGBEE_API_KEY', '')
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

def fetch(url, timeout=25):
    try:
        req = Request(url, headers={'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'en-GB,en;q=0.9'})
        with urlopen(req, timeout=timeout) as r:
            return r.read().decode('utf-8', errors='replace')
    except Exception as e:
        print(f'    ✗ fetch: {e}')
        return ''

def bee_fetch(url, js=False, timeout=30):
    if not BEE_KEY:
        print('    ✗ no ScrapingBee key')
        return ''
    params = {'api_key': BEE_KEY, 'url': url, 'render_js': 'true' if js else 'false', 'premium_proxy': 'true', 'country_code': 'gb'}
    api = f'https://app.scrapingbee.com/api/v1/?{urlencode(params)}'
    try:
        req = Request(api, headers={'Accept': 'text/html'})
        with urlopen(req, timeout=timeout) as r:
            return r.read().decode('utf-8', errors='replace')
    except Exception as e:
        print(f'    ✗ bee: {e}')
        return ''

def clean(s):
    if not s: return ''
    return unescape(re.sub(r'<[^>]+>', '', s)).strip()

def parse_price(s):
    if not s: return ''
    m = re.search(r'[£$€]\s*[\d,]+(?:\.\d+)?(?:\s*(?:k|m|million|thousand))?', s, re.I)
    return m.group(0).strip() if m else s.strip()

all_listings = []

# ═══════════════════════════════════════════════════════════════════════════
# 1. HILTON SMYTHE — direct, paginated
# ═══════════════════════════════════════════════════════════════════════════
def scrape_hilton_smythe():
    results = []
    seen = set()
    for page in range(1, 10):
        url = f'https://hiltonsmythe.com/businesses-for-sale/page/{page}/' if page > 1 else 'https://hiltonsmythe.com/businesses-for-sale/'
        html = fetch(url)
        if not html or len(html) < 5000:
            break
        
        # Links follow pattern: /business-listing/slug/
        links = re.findall(r'href="(https://hiltonsmythe\.com/business-listing/[^"#]+)"', html)
        if not links:
            links = [f'https://hiltonsmythe.com{l}' for l in re.findall(r'href="(/business-listing/[^"#]+)"', html)]
        
        unique_links = []
        for l in links:
            l_clean = l.rstrip('/')
            if l_clean not in seen:
                seen.add(l_clean)
                unique_links.append(l_clean)
        
        if not unique_links:
            break
        
        # Extract titles from h2/h3/h4 near each listing
        titles = re.findall(r'<h[234][^>]*>(.*?)</h[234]>', html, re.S)
        titles = [clean(t) for t in titles if clean(t) and len(clean(t)) > 3]
        
        for i, link in enumerate(unique_links):
            slug = link.split('/business-listing/')[-1].rstrip('/')
            title = titles[i] if i < len(titles) else slug.replace('-', ' ').title()
            results.append({
                'title': title,
                'price': '',
                'location': 'UK',
                'url': link,
                'source': 'hiltonsmythe',
            })
        
        time.sleep(1.5)
        print(f'    Hilton Smythe page {page}: {len(unique_links)} listings')
    
    print(f'  Hilton Smythe: {len(results)}')
    return results

# ═══════════════════════════════════════════════════════════════════════════
# 2. NATIONWIDE — direct, paginated
# ═══════════════════════════════════════════════════════════════════════════
def scrape_nationwide():
    results = []
    seen_urls = set()
    for page in range(1, 100):
        url = f'https://www.nationwidebusinesses.co.uk/buy/index.asp?page={page}'
        html = fetch(url)
        if not html:
            break
        
        rows = re.findall(r'<a[^>]*href="(/businessesforsale/[^"]+)"[^>]*>\s*(.*?)\s*</a>', html, re.S)
        new_count = 0
        
        for link, raw_title in rows:
            link_clean = link.rstrip('/')
            if link_clean in seen_urls:
                continue
            title = clean(raw_title)
            if not title or len(title) < 5 or title.lower() in ('buy', 'sell', 'home', 'contact', 'click here', 'more info', 'view'):
                continue
            
            seen_urls.add(link_clean)
            new_count += 1
            
            # Extract price from nearby text
            idx = html.find(link)
            chunk = html[idx:idx+500] if idx >= 0 else ''
            price_m = re.search(r'[£]\s*[\d,]+(?:\.\d+)?', chunk)
            
            loc_match = re.search(r'in[- ]([a-z-]+)[- ]for[- ]sale', link, re.I)
            location = loc_match.group(1).replace('-', ' ').title() if loc_match else 'UK'
            
            results.append({
                'title': title,
                'price': price_m.group(0).strip() if price_m else '',
                'location': location,
                'url': f'https://www.nationwidebusinesses.co.uk{link}',
                'source': 'nationwide',
            })
        
        if new_count == 0:
            print(f'    Nationwide page {page}: 0 new — stopping')
            break
        time.sleep(1.5)
        print(f'    Nationwide page {page}: {new_count} new (total {len(results)})')
    
    print(f'  Nationwide: {len(results)}')
    return results

# ═══════════════════════════════════════════════════════════════════════════
# 3. FLIPPA — ScrapingBee with JS rendering
# ═══════════════════════════════════════════════════════════════════════════
def scrape_flippa():
    results = []
    for page in range(1, 6):  # 5 pages max (bee credits)
        url = f'https://flippa.com/search?filter%5Bproperty_type%5D=established_website&filter%5Bsitetype%5D=website&filter%5Bstatus%5D=open&page={page}'
        html = bee_fetch(url, js=True)
        if not html:
            break
        
        # Flippa listing cards
        cards = re.findall(r'<a[^>]*href="(/[0-9]+[^"]*)"[^>]*class="[^"]*Listing[^"]*"[^>]*>(.*?)</a>', html, re.S)
        if not cards:
            # Try broader pattern
            cards = re.findall(r'href="(https://flippa\.com/\d+[^"]*)"[^>]*>(.*?)</(?:a|div)', html, re.S)
        if not cards:
            # Try JSON-LD or data attributes
            json_blocks = re.findall(r'data-listing="([^"]*)"', html)
            for jb in json_blocks:
                try:
                    d = json.loads(unescape(jb))
                    results.append({
                        'title': d.get('title', ''),
                        'price': f"${d.get('price', '')}",
                        'location': d.get('country', 'Online'),
                        'url': f"https://flippa.com/{d.get('id', '')}",
                        'source': 'flippa',
                    })
                except: pass
        
        # Also try extracting from Next.js __NEXT_DATA__
        nd = re.search(r'<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.S)
        if nd:
            try:
                data = json.loads(nd.group(1))
                listings = data.get('props', {}).get('pageProps', {}).get('listings', {}).get('data', [])
                if not listings:
                    listings = data.get('props', {}).get('pageProps', {}).get('data', {}).get('listings', [])
                for l in listings:
                    title = l.get('title', l.get('name', ''))
                    if not title: continue
                    price = l.get('current_price', l.get('price', l.get('buy_it_now_price', '')))
                    results.append({
                        'title': title,
                        'price': f"${price}" if price else '',
                        'location': l.get('country', 'Online'),
                        'url': f"https://flippa.com/{l.get('id', '')}",
                        'source': 'flippa',
                        'revenue': l.get('average_monthly_profit', l.get('monthly_revenue', '')),
                    })
            except: pass
        
        for link, body in cards:
            title = clean(re.search(r'<h[23][^>]*>(.*?)</h', body, re.S).group(1)) if re.search(r'<h[23][^>]*>(.*?)</h', body, re.S) else clean(body[:100])
            p = re.search(r'[£$]\s*[\d,]+', body)
            if title and len(title) > 3:
                full_url = link if link.startswith('http') else f'https://flippa.com{link}'
                results.append({
                    'title': title,
                    'price': p.group(0) if p else '',
                    'location': 'Online',
                    'url': full_url,
                    'source': 'flippa',
                })
        
        if not cards and not json_blocks:
            break
        time.sleep(2)
        print(f'    Flippa page {page}: {len(cards)} cards')
    
    print(f'  Flippa: {len(results)}')
    return results

# ═══════════════════════════════════════════════════════════════════════════
# 4. BUSINESSESFORSALE.COM — ScrapingBee with premium proxy
# ═══════════════════════════════════════════════════════════════════════════
def scrape_bfs():
    results = []
    for page in range(1, 4):  # Conserve bee credits
        url = f'https://uk.businessesforsale.com/british/search/businesses-for-sale/page-{page}'
        html = bee_fetch(url, js=True)
        if not html or len(html) < 1000:
            break
        
        # BFS cards
        cards = re.findall(r'<div[^>]*class="[^"]*result[^"]*"[^>]*>(.*?)</div>\s*</div>\s*</div>', html, re.S)
        if not cards:
            cards = re.findall(r'<a[^>]*href="(/british/businesses-for-sale/[^"]+)"[^>]*>(.*?)</a>', html, re.S)
        
        links = re.findall(r'href="(/british/businesses-for-sale/detail/[^"]+)"', html)
        titles = re.findall(r'<h[23][^>]*class="[^"]*listing-title[^"]*"[^>]*>(.*?)</h', html, re.S)
        if not titles:
            titles = re.findall(r'<a[^>]*class="[^"]*listing-link[^"]*"[^>]*>(.*?)</a>', html, re.S)
        prices = re.findall(r'[£]\s*[\d,]+(?:\.\d+)?[kK]?\s*(?:GBP)?', html)
        
        for i in range(min(len(links), len(titles))):
            results.append({
                'title': clean(titles[i]),
                'price': prices[i].strip() if i < len(prices) else '',
                'location': 'UK',
                'url': f'https://uk.businessesforsale.com{links[i]}',
                'source': 'businessesforsale',
            })
        
        if len(links) < 5:
            break
        time.sleep(2)
        print(f'    BFS page {page}: {len(links)} listings')
    
    print(f'  BFS: {len(results)}')
    return results

# ═══════════════════════════════════════════════════════════════════════════
# 5. DALTONS BUSINESS — ScrapingBee
# ═══════════════════════════════════════════════════════════════════════════
def scrape_daltons():
    results = []
    for page in range(1, 4):
        url = f'https://www.daltonsbusiness.com/businesses-for-sale?page={page}'
        html = bee_fetch(url, js=True)
        if not html or len(html) < 1000:
            break
        
        links = re.findall(r'href="(/businesses-for-sale/[^"]+)"', html)
        titles = re.findall(r'<h[23][^>]*>(.*?)</h[23]>', html, re.S)
        prices = re.findall(r'[£]\s*[\d,]+', html)
        locs = re.findall(r'(?:Location|Area|Region)[^<]*?[:–]\s*([^<,]+)', html, re.I)
        
        seen = set()
        for link in links:
            if link in seen or '/register' in link or '/login' in link:
                continue
            seen.add(link)
            # Try to find title near this link
            pattern = re.escape(link) + r'[^>]*>\s*(.*?)\s*</a>'
            t = re.search(pattern, html, re.S)
            title = clean(t.group(1)) if t else link.split('/')[-1].replace('-', ' ').title()
            p = re.search(r'[£]\s*[\d,]+', html[html.find(link):html.find(link)+500]) if html.find(link) >= 0 else None
            
            results.append({
                'title': title,
                'price': p.group(0) if p else '',
                'location': 'UK',
                'url': f'https://www.daltonsbusiness.com{link}',
                'source': 'daltons',
            })
        
        if not seen:
            break
        time.sleep(2)
        print(f'    Daltons page {page}: {len(seen)} listings')
    
    print(f'  Daltons: {len(results)}')
    return results

# ═══════════════════════════════════════════════════════════════════════════
# 6. RIGHTBIZ — ScrapingBee
# ═══════════════════════════════════════════════════════════════════════════
def scrape_rightbiz():
    results = []
    for page in range(1, 4):
        url = f'https://www.rightbiz.co.uk/businesses-for-sale?page={page}'
        html = bee_fetch(url, js=True)
        if not html or len(html) < 1000:
            break
        
        links = re.findall(r'href="(/businesses-for-sale/[^"]+)"', html)
        seen = set()
        for link in links:
            if link in seen or '/register' in link:
                continue
            seen.add(link)
            chunk = html[max(0, html.find(link)-200):html.find(link)+500]
            t = re.search(r'<h[23][^>]*>(.*?)</h', chunk, re.S)
            p = re.search(r'[£]\s*[\d,]+', chunk)
            loc = re.search(r'(?:in|Location:?)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)', chunk)
            
            results.append({
                'title': clean(t.group(1)) if t else link.split('/')[-1].replace('-', ' ').title(),
                'price': p.group(0) if p else '',
                'location': loc.group(1) if loc else 'UK',
                'url': f'https://www.rightbiz.co.uk{link}',
                'source': 'rightbiz',
            })
        
        if not seen:
            break
        time.sleep(2)
        print(f'    Rightbiz page {page}: {len(seen)} listings')
    
    print(f'  Rightbiz: {len(results)}')
    return results

# ═══════════════════════════════════════════════════════════════════════════
# 7. BIZQUEST — direct (US-heavy but has UK)
# ═══════════════════════════════════════════════════════════════════════════
def scrape_bizquest():
    results = []
    url = 'https://www.bizquest.com/find/businesses-for-sale/?q=united+kingdom'
    html = fetch(url)
    if html:
        cards = re.findall(r'<a[^>]*href="(/business-for-sale/detail/[^"]+)"[^>]*>(.*?)</a>', html, re.S)
        for link, body in cards[:50]:
            title = clean(body)
            if title and len(title) > 5:
                results.append({
                    'title': title,
                    'price': '',
                    'location': 'UK',
                    'url': f'https://www.bizquest.com{link}',
                    'source': 'bizquest',
                })
    print(f'  BizQuest: {len(results)}')
    return results

# ═══════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════
if __name__ == '__main__':
    print(f'🕷️  DealScope Scraper V3 — {datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")}')
    print(f'   ScrapingBee key: {"✅ set" if BEE_KEY else "❌ missing"}')
    
    print('\n📡 Direct sources:')
    all_listings.extend(scrape_hilton_smythe())
    all_listings.extend(scrape_nationwide())
    all_listings.extend(scrape_bizquest())
    
    if BEE_KEY:
        print('\n🐝 ScrapingBee sources:')
        all_listings.extend(scrape_flippa())
        all_listings.extend(scrape_bfs())
        all_listings.extend(scrape_daltons())
        all_listings.extend(scrape_rightbiz())
    
    # Dedupe by title similarity
    seen_urls = set()
    unique = []
    for l in all_listings:
        url_key = l.get('url', '').rstrip('/')
        if url_key and url_key not in seen_urls:
            seen_urls.add(url_key)
            l['scraped'] = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
            unique.append(l)
        elif not url_key and l.get('title'):
            # No URL - dedupe by title
            title_key = re.sub(r'[^a-z0-9]', '', l['title'].lower())[:60]
            if title_key not in seen_urls:
                seen_urls.add(title_key)
                l['scraped'] = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
                unique.append(l)
    
    # Load existing and merge
    existing = []
    if os.path.exists(OUT):
        try:
            with open(OUT) as f:
                raw = json.load(f)
                existing = raw if isinstance(raw, list) else []
        except: pass
    
    existing_urls = {e.get('url', '').rstrip('/') for e in existing if e.get('url')}
    new_count = 0
    for l in unique:
        url_key = l.get('url', '').rstrip('/')
        if url_key and url_key not in existing_urls:
            existing.append(l)
            existing_urls.add(url_key)
            new_count += 1
        elif not url_key:
            existing.append(l)
            new_count += 1
    
    with open(OUT, 'w') as f:
        json.dump(existing, f, indent=2)
    
    # Summary
    sources = {}
    for l in existing:
        s = l.get('source', 'unknown')
        sources[s] = sources.get(s, 0) + 1
    
    print(f'\n✅ {len(unique)} scraped this run, {new_count} new → {len(existing)} total in listings.json')
    for s, c in sorted(sources.items(), key=lambda x: -x[1]):
        print(f'   {s}: {c}')
