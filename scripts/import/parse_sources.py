"""Парсит скачанные страницы источников в единый список кандидатов (JSON).

Берём только факты о бизнесе: название, адрес, метро, телефон, площадь, вместимость,
ставка «от». Описания и фото не копируем.

Использование:
  parse_sources.py <src_dir> <out.json>
    <src_dir>/l2r/pages/*.html   — карточки loft2rent.ru
    <src_dir>/deli/products.json — JSON-LD Product с delispace.ru
"""
import sys, re, json, glob, html
from pathlib import Path

src = Path(sys.argv[1]); out = Path(sys.argv[2])

def clean(t: str) -> str:
    return re.sub(r'\s+', ' ', html.unescape(re.sub('<[^>]+>', ' ', t))).strip()

def num(s):
    s = re.sub(r'[^\d]', '', s or '')
    return int(s) if s else None

def norm_phone(p: str):
    d = re.sub(r'\D', '', p or '')
    if len(d) == 11 and d[0] in '78': return '+7' + d[1:]
    if len(d) == 10: return '+7' + d
    return None

def parse_l2r(path: Path):
    s = path.read_text(encoding='utf-8', errors='ignore')
    m = re.search(r'<h1 itemprop="name"[^>]*>(.*?)</h1>', s, re.S)
    if not m: return None
    name = clean(m.group(1))
    name = re.split(r'\s*/\s*', name)[0].strip()  # «ROYAL - Курская / РОЯЛЬ» → «ROYAL - Курская»
    name = re.sub(r'\s*-\s*[А-ЯЁ][а-яё\s]+$', '', name).strip() or name  # убрать « - Курская»
    addr = re.search(r'itemprop="streetAddress">\s*(.*?)</span>', s, re.S)
    addr = clean(addr.group(1)) if addr else ''
    metro = re.search(r'metro\.svg[^>]*>\s*</span>\s*([^<]+?)\s*(?:<|$)', s, re.S)
    metro = clean(metro.group(1)) if metro else ''
    phones = [norm_phone(p) for p in re.findall(r'href="tel:([^"]+)"', s)]
    phones = [p for p in dict.fromkeys(phones) if p]
    tg = re.search(r'@([A-Za-z0-9_]{5,32})\b', clean(s[s.find('Контакты'):s.find('Контакты') + 3000])) if 'Контакты' in s else None
    area = re.search(r'Площадь</nobr><span>.*?(\d[\d\s]*)\s*м<sup>', s, re.S)
    cap = re.search(r'Макс\. вместимость</nobr><span>\s*([\d\s]+)\s*чел', s, re.S)
    seated = re.search(r'Рассадка банкет\s*</?[^>]*>?\s*([\d\s]+)\s*чел', clean(s))
    price = re.search(r'Час\s*<span><small>от</small>\s*([\d\s]+)\s*<i', s, re.S)
    site = re.search(r'href="(https?://(?!www\.loft2rent|loft2rent)[^"]+)"[^>]*>\s*(?:Сайт|сайт)', s)
    return {
        'source': 'loft2rent', 'source_url': 'https://www.loft2rent.ru' + re.search(r'/loft/\d+/\d+/', str(path).replace('.html', '/').replace('pages/', 'loft/')).group(0) if False else '',
        'name': name, 'address': addr, 'metro': metro, 'phone': phones[0] if phones else '',
        'telegram': tg.group(1) if tg else '', 'site': site.group(1) if site else '',
        'area_m2': num(area.group(1)) if area else None,
        'cap_standing': num(cap.group(1)) if cap else None,
        'cap_seated': num(seated.group(1)) if seated else None,
        'price_hour_from': num(price.group(1)) if price else None,
    }

def parse_deli(products):
    rows = []
    for p in products:
        d = p.get('description', '') or ''
        name = p.get('name', '').strip()
        area = re.search(r'площадью\s*(\d+)\s*м', d)
        cap = re.search(r'вместимостью до\s*(\d+)', d)
        # «по адресу: метро Тульская Новоданиловская наб. Аренда…» — станция, затем улица с типом
        # (ул/наб/пер/пл/шоссе/проспект/бульвар/проезд) в любом порядке «тип имя» или «имя тип».
        m = re.search(r'адресу:\s*метро\s+(.+?)\.\s*Аренда', d)
        tail = m.group(1).strip() if m else ''
        TYPES = r'(?:ул|улица|наб|набережная|пер|переулок|пл|площадь|ш|шоссе|пр-т|просп|проспект|б-р|бульвар|проезд|туп|тупик|аллея|линия)'
        metro, addr = '', ''
        if tail:
            mt = re.search(r'^(.*?)\s+((?:' + TYPES + r'\.?\s+\S.*)|(?:\S.*?\s+' + TYPES + r'\.?))(?:\s+(\d.*))?$', tail)
            if mt:
                metro = mt.group(1).strip()
                addr = (mt.group(2) + (' ' + mt.group(3) if mt.group(3) else '')).strip()
            else:
                metro = tail.split()[0]; addr = ' '.join(tail.split()[1:])
        if not metro:
            mm = re.search(r'на\s+([А-ЯЁ][а-яё-]+(?:ой|ом|ской|ом|е|и|ах))\b', name)
            metro = ''
        price = p.get('offers', {}).get('price')
        rows.append({
            'source': 'delispace', 'source_url': p.get('url', ''), 'name': name, 'address': ('Москва, ' + addr) if addr else '',
            'metro': metro, 'phone': '', 'telegram': '', 'site': '',
            'area_m2': int(area.group(1)) if area else None,
            'cap_standing': int(cap.group(1)) if cap else None, 'cap_seated': None,
            'price_hour_from': int(price) if price and str(price).isdigit() else None,
        })
    return rows

rows = []
for f in sorted(glob.glob(str(src / 'l2r/pages/*.html'))):
    r = parse_l2r(Path(f))
    if r: rows.append(r)
dp = src / 'deli/products.json'
if dp.exists():
    products = json.loads(dp.read_text(encoding='utf-8'))
    # описание с адресом есть только на странице площадки
    for p in products:
        f = src / 'deli/pages' / (p['url'].rstrip('/').split('/')[-1] + '.html')
        if f.exists():
            for b in re.findall(r'<script type="application/ld\+json">(.*?)</script>', f.read_text(encoding='utf-8'), re.S):
                try: j = json.loads(b)
                except Exception: continue
                if j.get('@type') == 'Product' and j.get('description'): p['description'] = j['description']
    rows += parse_deli(products)
out.write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding='utf-8')
by = {}
for r in rows: by[r['source']] = by.get(r['source'], 0) + 1
print(f'{len(rows)} кандидатов: {by}; с телефоном {sum(1 for r in rows if r["phone"])}, с адресом {sum(1 for r in rows if r["address"])}')
