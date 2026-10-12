"""Проставляет метро лофтам, у которых источник его не указал (metro == 'Москва').

Берём станцию ближайшего лофта с известным метро в радиусе RADIUS_KM — в каталоге
2 000+ точек, покрытие центра плотное. Если соседей нет, оставляем «Москва».

  fill_metro.py            # правит data/lofts.csv на месте
"""
import csv, math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CSV = ROOT / 'data/lofts.csv'
RADIUS_KM = 1.2

def dist(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(h))

with CSV.open(encoding='utf-8') as f:
    r = csv.DictReader(f); rows = list(r); fields = r.fieldnames

known = [(float(x['lat']), float(x['lon']), x['metro']) for x in rows if x['metro'] and x['metro'] != 'Москва' and x['lat']]
filled = 0
for x in rows:
    if x['metro'] and x['metro'] != 'Москва': continue
    if not x['lat']: continue
    p = (float(x['lat']), float(x['lon']))
    best = min(known, key=lambda k: dist(p, k[:2]), default=None)
    if best and dist(p, best[:2]) <= RADIUS_KM:
        x['metro'] = best[2]
        x['notes'] = ('метро по ближайшему лофту; ' + (x['notes'] or '')).strip()
        filled += 1

# Округ для карточек с пометкой «округ не определён» — по ближайшему лофту с уверенным округом.
import re
UNK = re.compile(r'округ не определён \([^)]*\); ')
sure = [(float(x['lat']), float(x['lon']), x['district']) for x in rows if x['district'] and not UNK.search(x['notes'] or '') and x['lat']]
okr = 0
for x in rows:
    if not UNK.search(x['notes'] or '') or not x['lat']: continue
    p = (float(x['lat']), float(x['lon']))
    best = min(sure, key=lambda k: dist(p, k[:2]), default=None)
    if best and dist(p, best[:2]) <= 1.5:
        x['district'] = best[2]; x['notes'] = UNK.sub('округ по ближайшему лофту; ', x['notes']); okr += 1
print(f'okrug filled: {okr}')

with CSV.open('w', encoding='utf-8', newline='') as f:
    w = csv.DictWriter(f, fieldnames=fields); w.writeheader(); w.writerows(rows)
print(f'metro filled: {filled}, still unknown: {sum(1 for x in rows if x["metro"] in ("", "Москва"))}')
