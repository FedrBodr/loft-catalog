"""Уточняет координаты и округ через геокодер 2ГИС для карточек с приблизительной геопозицией.

Берёт строки data/private/lofts.csv, у которых в notes «координаты по станции метро» или «округ не
определён», шлёт адрес в 2ГИС (ключ ~/.config/fedrbodr/2gis.key, демо-лимит 1 000/мес) и,
если ответ — конкретное здание, пишет lat/lon/district и снимает пометку.

  regeocode_2gis.py [--dry] [--limit N] [--yandex]   # --yandex: геокодер Яндекса вместо 2ГИС
"""
import sys, re, csv, json, time, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CSV = ROOT / 'data/private/lofts.csv'
KEY = (Path.home() / '.config/fedrbodr/2gis.key').read_text().strip()
args = sys.argv[1:]
dry = '--dry' in args
use_yandex = '--yandex' in args
YKEY = (Path.home() / '.config/fedrbodr/yandex-geocoder.key').read_text().strip() if use_yandex else ''
limit = int(args[args.index('--limit') + 1]) if '--limit' in args else 10**9

# округ по району — та же таблица, что в build_candidates.py
bc = (ROOT / 'scripts/import/build_candidates.py').read_text(encoding='utf-8')
ns: dict = {"re": re}
exec(bc[bc.index('OKRUG = {'):bc.index('def http(')], ns)  # OKRUG
exec(bc[bc.index('RAYON = {'):bc.index('def norm_addr(')], ns)  # RAYON, R2O, okrug
okrug = ns['okrug']

def geocode_yandex(q: str):
    url = 'https://geocode-maps.yandex.ru/v1/?' + urllib.parse.urlencode({'apikey': YKEY, 'format': 'json', 'results': 1, 'geocode': q})
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'loftmap.ru'}), timeout=20) as r:
        d = json.loads(r.read().decode())
    fm = d.get('response', {}).get('GeoObjectCollection', {}).get('featureMember', [])
    if not fm: return None
    g = fm[0]['GeoObject']; md = g['metaDataProperty']['GeocoderMetaData']
    if md.get('precision') not in ('exact', 'number'): return None
    comp = {c['kind']: c['name'] for c in md['Address'].get('Components', [])}
    if comp.get('locality') != 'Москва' and comp.get('province') != 'Москва': return None
    lon, lat = map(float, g['Point']['pos'].split())
    return {'lat': lat, 'lon': lon, 'rayon': comp.get('district', ''), 'name': md.get('text', '')}

def geocode(q: str):
    if use_yandex: return geocode_yandex(q)
    url = 'https://catalog.api.2gis.com/3.0/items/geocode?' + urllib.parse.urlencode(
        {'q': q, 'fields': 'items.point,items.adm_div', 'key': KEY})
    req = urllib.request.Request(url, headers={'User-Agent': 'loftmap.ru (fedrbodrlain@gmail.com)'})
    with urllib.request.urlopen(req, timeout=20) as r:
        d = json.loads(r.read().decode())
    if d['meta'].get('error'): raise RuntimeError(d['meta']['error']['message'])
    items = d.get('result', {}).get('items', [])
    if not items: return None
    it = items[0]
    if it.get('type') != 'building' or not it.get('point'): return None
    adm = {a['type']: a['name'] for a in it.get('adm_div', [])}
    if adm.get('city') != 'Москва': return None
    return {'lat': it['point']['lat'], 'lon': it['point']['lon'], 'rayon': adm.get('district', ''), 'name': it.get('full_name', '')}

with CSV.open(encoding='utf-8') as f:
    rd = csv.DictReader(f); rows = list(rd); fields = rd.fieldnames

NOTE_RE = re.compile(r'(координаты по станции метро, адрес не найден; |округ не определён \(район: [^)]*\); )')
todo = [r for r in rows if NOTE_RE.search(r['notes'] or '') and re.search(r'\d', r['address'] or '')]
print(f'к уточнению: {len(todo)}')
fixed = miss = 0
for r in todo[:limit]:
    try:
        g = geocode(r['address'])
    except Exception as e:  # noqa: BLE001
        print('  error', r['id'], e); time.sleep(2); continue
    time.sleep(0.2)
    if not g: miss += 1; print('  не здание:', r['id'], r['address']); continue
    d = okrug(g['rayon'])
    print(f'+ {r["id"]} | {r["address"]} → {g["name"]} | {g["rayon"]} → {d or "?"}')
    if dry: continue
    r['lat'] = f'{g["lat"]:.5f}'; r['lon'] = f'{g["lon"]:.5f}'
    if d: r['district'] = d
    r['notes'] = NOTE_RE.sub('', r['notes']) + ('' if d else f'округ не определён (район 2ГИС: {g["rayon"]}); ')
    r['notes'] = (('координаты Яндекс; ' if use_yandex else 'координаты 2ГИС; ') + r['notes']).strip()
    fixed += 1

if not dry:
    with CSV.open('w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=fields); w.writeheader(); w.writerows(rows)
print(f'уточнено {fixed}, не найдено {miss}')
