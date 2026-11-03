"""Тип площадки и список мероприятий из <title> страницы loft2rent.

На loft2rent заголовок каждой страницы зала имеет вид
  «<Название> - <тип площадки>. Аренда лофта для проведения <мероприятий, через запятую>
   в Москве у метро <станция> / LOFT 2 RENT ...»
Список мероприятий — то, под что площадка сама себя сдаёт. Это главный фильтр для
рассылки: если в списке нет праздничных форматов (день рождения, вечеринка, корпоратив,
свадьба), сценарий «день рождения на 20 человек» площадке не подходит.

Читает data/private/lofts.csv (URL loft2rent лежит в notes), пишет
data/private/l2r_types.json: {id: {"venue": [...], "events": [...], "title": "..."}}.
Уже известные id пропускает, поэтому можно перезапускать.

  classify_l2r.py [--limit N] [--ids id1,id2]
"""
import csv, json, re, sys, time, html, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CSV = ROOT / 'data/private/lofts.csv'
OUT = ROOT / 'data/private/l2r_types.json'
URL_RE = re.compile(r'https://www\.loft2rent\.ru/loft/\d+/\d+/')
TITLE_RE = re.compile(r'<title>(.*?)</title>', re.S)
UA = 'Mozilla/5.0 (loftmap.ru catalog; fedrbodrlain@gmail.com)'

args = sys.argv[1:]
limit = int(args[args.index('--limit') + 1]) if '--limit' in args else 10**9
only = set(args[args.index('--ids') + 1].split(',')) if '--ids' in args else None

def parse_title(t: str):
    t = re.sub(r'\s+', ' ', html.unescape(t)).strip()
    head = t.split(' / ')[0]
    m = re.match(r'(.*?)\s+-\s+(.*?)\s*\.\s*Аренда (?:лофта|помещения) для\s*(.*?)\s+в Москве', head)
    if not m:
        return {'venue': [], 'events': [], 'title': head}
    venue = [v.strip().lower() for v in m.group(2).split(',') if v.strip()]
    events = [re.sub(r'^проведения\s+', '', e.strip().lower()) for e in m.group(3).split(',') if e.strip()]
    return {'venue': venue, 'events': events, 'title': head}

def fetch(url: str):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=25) as r:
        return r.read().decode('utf-8', 'ignore')

rows = list(csv.DictReader(CSV.open(encoding='utf-8')))
done = json.loads(OUT.read_text(encoding='utf-8')) if OUT.exists() else {}
todo = []
for r in rows:
    if r['source'] != 'loft2rent' or r['id'] in done: continue
    if only and r['id'] not in only: continue
    m = URL_RE.search(r['notes'] or '')
    if m: todo.append((r['id'], m.group(0)))
print(f'известно {len(done)}, к загрузке {len(todo)}', flush=True)

n = err = 0
for lid, url in todo[:limit]:
    try:
        page = fetch(url)
        m = TITLE_RE.search(page)
        done[lid] = parse_title(m.group(1)) if m else {'venue': [], 'events': [], 'title': ''}
        done[lid]['url'] = url
        n += 1
    except Exception as e:  # noqa: BLE001
        err += 1
        print('  error', lid, url, str(e)[:80], flush=True)
        if '429' in str(e) or '503' in str(e): time.sleep(60)
    if n % 50 == 0 and n:
        OUT.write_text(json.dumps(done, ensure_ascii=False, indent=0), encoding='utf-8')
        print(f'  {n} загружено, {err} ошибок', flush=True)
    time.sleep(1.0)

OUT.write_text(json.dumps(done, ensure_ascii=False, indent=0), encoding='utf-8')
print(f'готово: {n} новых, {err} ошибок, всего {len(done)}')
