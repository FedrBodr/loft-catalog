"""Сценарий письма для каждой площадки по типу и списку мероприятий loft2rent
(data/private/l2r_types.json) и запись колонок «Тип», «Мероприятия», «Сценарий» в лист
«Очередь» таблицы «LoftMap — проверки» (через сервисный аккаунт, колонки Q:S).

Сценарии: A — «день рождения, 20 человек» (площадка сама сдаётся под дни рождения или
вечеринки); B — «корпоратив, 20 человек» (банкеты/свадьбы/презентации без праздников);
bar — бар/ресторан/кальянная без зала в аренду (отдельная очередь, депозит вместо
аренды); skip — переговорные, коворкинги, учебные залы, фотостудии, детские центры,
кулинарные студии, спорт; check — не разобрали заголовок.

  scenario_queue.py [--dry]
"""
import csv, json, os, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TYPES = json.loads((ROOT / 'data/private/l2r_types.json').read_text(encoding='utf-8'))
SHEET = '19V8zmNfcDPUI2DA7R5bnhfvzqirxg36ekwVpHnfzlS8'
dry = '--dry' in sys.argv

PARTY = {'дня рождения', 'вечеринки'}
FESTIVE = {'банкета', 'свадьбы', 'презентаций', 'семинаров'}
RENT = {'лофт', 'зал', 'банкетный зал', 'веранда', 'крыша', 'апартаменты', 'особняк', 'галерея',
        'концертный зал', 'игровой зал', 'лофт с караоке', 'конференц-зал', 'шатер', 'на открытом воздухе'}
BAR = {'бар', 'ресторан', 'кальянная', 'ночной клуб', 'антикафе', 'клуб'}
SKIP = {'переговорная', 'коворкинг', 'кабинет', 'учебный зал', 'фотостудия', 'детский центр',
        'кулинарная студия', 'спорт-зал', 'квест', 'теплоход', 'аквапарк', 'пляж', 'отель'}

def scenario(t, cap):
    v, e = set(t.get('venue', [])), set(t.get('events', []))
    if not v and not e: return 'check', 'заголовок не разобран'
    if cap and cap < 15: return 'skip', f'вместимость {cap}'
    rent = v & RENT
    if v and not rent and v & BAR: return 'bar', 'бар/ресторан без зала в аренду'
    if v and not rent and v <= SKIP: return 'skip', 'не площадка для праздников: ' + ', '.join(sorted(v))
    if e & PARTY: return 'A', 'день рождения'
    if e & FESTIVE and rent: return 'B', 'корпоратив'
    return 'skip', 'нет праздничных форматов: ' + ', '.join(sorted(e))

rows = {r['id']: r for r in csv.DictReader((ROOT / 'data/private/lofts.csv').open(encoding='utf-8'))}
def cap(r):
    for k in ('cap_standing', 'cap_seated'):
        try: return int(r[k])
        except (ValueError, KeyError): pass
    return 0

result = {}
for lid, t in TYPES.items():
    s, why = scenario(t, cap(rows[lid]) if lid in rows else 0)
    result[lid] = {'scenario': s, 'why': why, 'venue': ', '.join(t.get('venue', [])), 'events': ', '.join(t.get('events', []))}
from collections import Counter
print('по всем loft2rent:', Counter(v['scenario'] for v in result.values()))

from google.oauth2 import service_account
from googleapiclient.discovery import build
creds = service_account.Credentials.from_service_account_file(os.path.expanduser('~/.config/fedrbodr/gsc-sa.json'), scopes=['https://www.googleapis.com/auth/spreadsheets'])
svc = build('sheets', 'v4', credentials=creds, cache_discovery=False).spreadsheets()
ids = [r[0] if r else '' for r in svc.values().get(spreadsheetId=SHEET, range='Очередь!B2:B1000').execute().get('values', [])]
out = []
for lid in ids:
    r = result.get(lid)
    out.append([r['venue'], r['events'], f"{r['scenario']}: {r['why']}"] if r else ['', '', 'check: нет данных loft2rent'])
print('в очереди:', Counter(o[2].split(':')[0] for o in out))
if dry: sys.exit()
meta = svc.get(spreadsheetId=SHEET, fields='sheets.properties').execute()
sh = next(x['properties'] for x in meta['sheets'] if x['properties']['title'] == 'Очередь')
if sh['gridProperties']['columnCount'] < 19:
    svc.batchUpdate(spreadsheetId=SHEET, body={'requests': [{'appendDimension': {'sheetId': sh['sheetId'], 'dimension': 'COLUMNS', 'length': 19 - sh['gridProperties']['columnCount']}}]}).execute()
svc.values().update(spreadsheetId=SHEET, range='Очередь!Q1:S1', valueInputOption='RAW', body={'values': [['Тип (loft2rent)', 'Мероприятия (loft2rent)', 'Сценарий']]}).execute()
svc.values().update(spreadsheetId=SHEET, range=f'Очередь!Q2:S{len(out)+1}', valueInputOption='RAW', body={'values': out}).execute()
(ROOT / 'data/private/scenarios.json').write_text(json.dumps(result, ensure_ascii=False, indent=0), encoding='utf-8')
print('записано строк:', len(out))
