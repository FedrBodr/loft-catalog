"""Геокодирует кандидатов и дописывает их в data/private/lofts.csv со статусом candidate.

  build_candidates.py <candidates.json> [--cache geocache.json] [--limit N]

Геокодер — Nominatim (OSM), 1 запрос/с, кэш на диске. Округ — обратным геокодированием
(zoom=8 → «Центральный административный округ» → ЦАО). Если адрес не нашёлся —
координаты станции метро и пометка в notes. Дубли (тот же адрес + похожее имя или тот же
телефон + имя) пропускаются.
"""
import sys, re, json, csv, time, urllib.parse, urllib.request, urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CSV = ROOT / 'data/private/lofts.csv'
UA = 'loftmap.ru catalog builder (fedrbodrlain@gmail.com)'
args = sys.argv[1:]
src = Path(args[0])
cache_path = Path(args[args.index('--cache') + 1]) if '--cache' in args else src.with_name('geocache.json')
limit = int(args[args.index('--limit') + 1]) if '--limit' in args else 10**9
cache = json.loads(cache_path.read_text()) if cache_path.exists() else {}

OKRUG = {'Центральный': 'ЦАО', 'Северный': 'САО', 'Северо-Восточный': 'СВАО', 'Восточный': 'ВАО', 'Юго-Восточный': 'ЮВАО',
         'Южный': 'ЮАО', 'Юго-Западный': 'ЮЗАО', 'Западный': 'ЗАО', 'Северо-Западный': 'СЗАО', 'Зеленоградский': 'ЗелАО',
         'Новомосковский': 'НАО', 'Троицкий': 'ТАО'}

def http(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read().decode())

NOMINATIM_BLOCKED_UNTIL = 0.0

def _nominatim(q):
    global NOMINATIM_BLOCKED_UNTIL
    if time.time() < NOMINATIM_BLOCKED_UNTIL: return None
    url = 'https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode(
        {'format': 'json', 'limit': 1, 'accept-language': 'ru', 'countrycodes': 'ru', 'addressdetails': 1, 'q': q})
    try:
        d = http(url)
    except urllib.error.HTTPError as e:
        if e.code == 429: NOMINATIM_BLOCKED_UNTIL = time.time() + 600; print('  nominatim 429 → пауза 10 мин')
        else: print('  nominatim error', q, e)
        return None
    except Exception as e:  # noqa: BLE001
        print('  nominatim error', q, e); return None
    finally:
        time.sleep(1.5)
    if not d: return {}
    a = d[0].get('address', {})
    return {'lat': float(d[0]['lat']), 'lon': float(d[0]['lon']), 'name': d[0]['display_name'],
            'rayon': a.get('city_district') or a.get('suburb') or '', 'src': 'nominatim'}

def _house(a: str):
    m = re.search(r'(\d+)\s*(?:/\s*(\d+))?\s*([ск]\s?\d+)?', a.split(',', 1)[-1])
    return (m.group(1), (m.group(3) or '').replace(' ', '')) if m else (None, '')

def _photon(q):
    """Photon (komoot) — без жёсткого лимита, но нечёткий: принимаем только совпавший номер дома и улицу."""
    url = 'https://photon.komoot.io/api/?' + urllib.parse.urlencode({'q': q, 'limit': 5, 'lang': 'default', 'lat': 55.75, 'lon': 37.62})
    try:
        d = http(url)
    except Exception as e:  # noqa: BLE001
        print('  photon error', q, e); return None
    finally:
        time.sleep(1.0)
    house, bld = _house(q)
    street_words = [w for w in re.findall(r'[А-Яа-яё-]{4,}', q.split(',', 1)[-1]) if w.lower() not in ('улица', 'переулок', 'проспект', 'набережная', 'бульвар', 'шоссе', 'проезд', 'площадь', 'строение', 'корпус')]
    for f in d.get('features', []):
        pr = f['properties']
        if pr.get('city') != 'Москва' and pr.get('state') != 'Москва': continue
        hn = (pr.get('housenumber') or '').replace(' ', '').lower()
        st = (pr.get('street') or pr.get('name') or '').lower()
        if house and not hn.startswith(house): continue
        if bld and bld.lower() not in hn: continue
        if street_words and not any(w.lower()[:5] in st for w in street_words): continue
        lon, lat = f['geometry']['coordinates']
        return {'lat': lat, 'lon': lon, 'name': ', '.join(filter(None, [pr.get('street'), pr.get('housenumber'), pr.get('city')])),
                'rayon': pr.get('district') or '', 'src': 'photon'}
    return {}

TYPE_WORDS = ('улица', 'переулок', 'проспект', 'набережная', 'бульвар', 'шоссе', 'проезд', 'площадь', 'аллея', 'тупик', 'линия', 'вал')

def photon_variants(q: str):
    """«Москва, Бакунинская 72с2» → «Москва, Бакунинская улица 72 с2»: Photon хочет пробел и тип улицы."""
    a = re.sub(r'(\d+)\s*([ск])\s?(\d+)', r'\1 \2\3', q)
    yield a
    tail = a.split(',', 1)[-1].strip()
    if not any(w in tail.lower() for w in TYPE_WORDS):
        m = re.match(r'(.*?)(?=\s*\d)', tail)
        if m and m.group(1).strip():
            yield 'Москва, ' + m.group(1).strip() + ' улица ' + tail[m.end():].strip()

def geocode(q):
    if q in cache: return cache[q]
    g = None
    for v in photon_variants(q):
        g = _photon(v)
        if g: break
    if not g:  # None (ошибка сети) или {} (не нашли) — пробуем Nominatim
        g2 = _nominatim(q)
        if g2 is None: return None  # Nominatim недоступен — не кэшируем, чтобы повторить позже
        g = g2
    cache[q] = g or None
    cache_path.write_text(json.dumps(cache, ensure_ascii=False))
    return cache[q]

STATION_COORDS = {}
def station_coords(metro: str):
    """Координаты станции — медиана по уже известным лофтам у этой станции (без геокодера)."""
    if metro in STATION_COORDS: return STATION_COORDS[metro]
    pts = [(float(r['lat']), float(r['lon'])) for r in rows if r['metro'] == metro and r['lat']]
    if len(pts) >= 2:
        lat = sorted(p[0] for p in pts)[len(pts) // 2]; lon = sorted(p[1] for p in pts)[len(pts) // 2]
        ds = [r['district'] for r in rows if r['metro'] == metro and r['district']]
        STATION_COORDS[metro] = {'lat': lat, 'lon': lon, 'name': f'м. {metro} (по лофтам)', 'rayon': '', 'src': 'station',
                                 'district': max(set(ds), key=ds.count) if ds else ''}
    else:
        STATION_COORDS[metro] = geocode(f'станция метро {metro}, Москва')
    return STATION_COORDS[metro]

RAYON = {
 'ЦАО': 'Арбат Басманный Замоскворечье Красносельский Мещанский Пресненский Таганский Тверской Хамовники Якиманка',
 'САО': 'Аэропорт Беговой Бескудниковский Войковский Восточное Дегунино Головинский Дмитровский Западное Дегунино Коптево Левобережный Молжаниновский Савеловский Сокол Тимирязевский Ховрино Хорошевский',
 'СВАО': 'Алексеевский Алтуфьевский Бабушкинский Бибирево Бутырский Лианозово Лосиноостровский Марфино Марьина Роща Останкинский Отрадное Ростокино Свиблово Северное Медведково Северный Южное Медведково Ярославский',
 'ВАО': 'Богородское Вешняки Восточное Измайлово Восточный Гольяново Ивановское Измайлово Косино-Ухтомский Метрогородок Новогиреево Новокосино Перово Преображенское Северное Измайлово Соколиная Гора Сокольники',
 'ЮВАО': 'Выхино-Жулебино Капотня Кузьминки Лефортово Люблино Марьино Некрасовка Нижегородский Печатники Рязанский Текстильщики Южнопортовый',
 'ЮАО': 'Бирюлево Восточное Бирюлево Западное Братеево Даниловский Донской Зябликово Москворечье-Сабурово Нагатино-Садовники Нагатинский Затон Нагорный Орехово-Борисово Северное Орехово-Борисово Южное Царицыно Чертаново Северное Чертаново Центральное Чертаново Южное',
 'ЮЗАО': 'Академический Гагаринский Зюзино Коньково Котловка Ломоносовский Обручевский Северное Бутово Теплый Стан Черемушки Южное Бутово Ясенево',
 'ЗАО': 'Внуково Дорогомилово Крылатское Кунцево Можайский Ново-Переделкино Очаково-Матвеевское Проспект Вернадского Раменки Солнцево Тропарево-Никулино Филевский Парк Фили-Давыдково',
 'СЗАО': 'Куркино Митино Покровское-Стрешнево Северное Тушино Строгино Хорошево-Мневники Щукино Южное Тушино',
}
R2O = {}
for _o, _names in RAYON.items():
    for _n in re.findall(r'[А-Яа-я-]+(?: [А-Яа-я-]+)?', _names):
        pass
# разбор многословных районов: сначала двухсловные, потом однословные
_TWO = {'Восточное Дегунино','Западное Дегунино','Марьина Роща','Северное Медведково','Южное Медведково','Восточное Измайлово','Северное Измайлово','Соколиная Гора','Бирюлево Восточное','Бирюлево Западное','Нагатинский Затон','Орехово-Борисово Северное','Орехово-Борисово Южное','Чертаново Северное','Чертаново Центральное','Чертаново Южное','Северное Бутово','Теплый Стан','Южное Бутово','Проспект Вернадского','Филевский Парк','Северное Тушино','Южное Тушино'}
for _o, _names in RAYON.items():
    rest = _names
    for t in _TWO:
        if t in rest: R2O[t.lower()] = _o; rest = rest.replace(t, ' ')
    for w in rest.split(): R2O[w.lower()] = _o

# исторические местности, которые Nominatim отдаёт вместо района
R2O.update({'бауманка': 'ЦАО', 'черкизово': 'ВАО', 'канатчиково': 'ЮАО', 'лефортово': 'ЮВАО', 'сити': 'ЦАО', 'москва-сити': 'ЦАО',
            'хамовники': 'ЦАО', 'замоскворечье': 'ЦАО', 'якиманка': 'ЦАО', 'пресня': 'ЦАО', 'сокольники': 'ВАО', 'марьина роща': 'СВАО',
            'дорогомилово': 'ЗАО', 'фили': 'ЗАО', 'измайлово': 'ВАО', 'преображенское': 'ВАО', 'текстильщики': 'ЮВАО', 'кузьминки': 'ЮВАО'})

def okrug(rayon: str) -> str:
    r = (rayon or '').replace('ё', 'е').strip()
    r = re.sub(r'^(район|поселение|муниципальный округ)\s+', '', r, flags=re.I)
    r = re.sub(r'\s+(район|поселение)$', '', r, flags=re.I).lower()
    if r in R2O: return R2O[r]
    # «Таганский район» → «таганский»; словарь хранит именительный падеж без суффикса
    return R2O.get(r.replace('ий', 'ий'), '')

def norm_addr(a: str) -> str:
    a = a.replace('ё', 'е').replace('Ё', 'Е')
    a = re.sub(r'\bстроение\s*', 'с', a, flags=re.I)
    a = re.sub(r'\bстр\.?\s*', 'с', a, flags=re.I)
    a = re.sub(r'\bст\.\s*', 'с', a, flags=re.I)
    a = a.replace('C', 'С').replace('c', 'с')  # латиница в кириллических адресах
    a = re.sub(r'\bкорпус\s*', 'к', a, flags=re.I)
    a = re.sub(r'\bкорп\.?\s*', 'к', a, flags=re.I)
    a = re.sub(r'\b(д|дом)\.?\s*(?=\d)', '', a, flags=re.I)
    a = re.sub(r'\bпл\.\s*', 'площадь ', a); a = re.sub(r'\bпер\.\s*', 'переулок ', a); a = re.sub(r'\bпр-т\s*|\bпросп\.\s*', 'проспект ', a)
    a = re.sub(r'\bнаб\.\s*', 'набережная ', a); a = re.sub(r'\bш\.\s*', 'шоссе ', a); a = re.sub(r'\bб-р\s*', 'бульвар ', a)
    a = re.sub(r'\s+', ' ', a).strip(' ,')
    if not a.lower().startswith('москва'): a = 'Москва, ' + a
    return a

def simplify(a: str) -> str:
    """Убрать корпус/строение/литеру для второй попытки."""
    a = re.sub(r'(?<![А-Яа-яA-Za-z])\s*[ск]\s?\d+[А-Яа-яA-Za-z]?\b', '', a)
    a = re.sub(r'(\d+)[А-Яа-я]\b', r'\1', a)
    return a

def translit(s):
    t = {'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'}
    s = ''.join(t.get(c, c) for c in s.lower())
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', s)).strip('-')[:60]

with CSV.open(encoding='utf-8') as _f:
    _reader = csv.DictReader(_f)
    rows = list(_reader)
    fields = _reader.fieldnames
ids = {r['id'] for r in rows}
addr_names = {(norm_addr(r['address']).lower(), r['name'].lower()[:12]) for r in rows}
phones = {(r['phone'], r['name'].lower()[:12]) for r in rows if r['phone']}

cands = json.loads(src.read_text(encoding='utf-8'))
added = skipped = 0
for c in cands[:limit]:
    name = c['name'].strip()
    if not name or not (c['address'] or c['metro']): skipped += 1; continue
    key = (norm_addr(c['address']).lower(), name.lower()[:12])
    if key in addr_names or (c['phone'] and (c['phone'], name.lower()[:12]) in phones): skipped += 1; continue
    note = '' if re.search(r'\d', c['address'] or '') else 'адрес без номера дома, координаты приблизительные; '
    g = None
    if c['address']:
        a = norm_addr(c['address'])
        g = geocode(a) or geocode(simplify(a))
    if not g and c['metro']:
        g = station_coords(re.split(r'[,/;]', c['metro'])[0].strip())
        note = 'координаты по станции метро, адрес не найден; '
    if not g: skipped += 1; print('  no geo:', name, c['address'], c['metro']); continue
    if not (55.3 <= g['lat'] <= 56.1 and 36.8 <= g['lon'] <= 38.2): skipped += 1; print('  outside Moscow:', name); continue
    d = okrug(g.get('rayon', '')) or g.get('district', '')
    if not d: note += f'округ не определён (район: {g.get("rayon","")}); '; d = 'ЦАО'
    base = translit(name) or 'loft'
    slug = base; n = 2
    while slug in ids: slug = f'{base}-{n}'; n += 1
    ids.add(slug); addr_names.add(key)
    metro = re.split(r'[,/;]', c['metro'])[0].strip().replace('ё', 'е').replace('Ё', 'Е')
    row = {k: '' for k in fields}
    row.update({
        'id': slug, 'name': name, 'status': 'candidate', 'address': c['address'] or f'у метро {metro}',
        'lat': f'{g["lat"]:.5f}', 'lon': f'{g["lon"]:.5f}', 'metro': metro or 'Москва', 'district': d,
        'phone': c['phone'] or '', 'telegram': c['telegram'] or '', 'site': c['site'] or ('' if c['phone'] or c['telegram'] else c['source_url']),
        'area_m2': c['area_m2'] or '', 'cap_seated': c['cap_seated'] or '', 'cap_standing': c['cap_standing'] or '',
        'price_hour_from': c['price_hour_from'] or '', 'source': c['source'],
        'notes': note + ('контакт только через площадку-источник; ' if not (c['phone'] or c['telegram']) else '') + (c['source_url'] or ''),
    })
    rows.append(row); added += 1
    print(f'+ {slug} | {metro} | {d} | {c["phone"] or "-"}')

with CSV.open('w', encoding='utf-8', newline='') as f:
    w = csv.DictWriter(f, fieldnames=fields); w.writeheader(); w.writerows(rows)
print(f'added {added}, skipped {skipped}, total {len(rows)}')
