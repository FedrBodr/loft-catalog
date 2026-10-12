import { parse } from 'csv-parse/sync';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export type Corkage = { kind: 'free' | 'no' | 'fee'; fee?: number };
export type Status = 'candidate' | 'verified' | 'closed';

export interface Loft {
  id: string;
  name: string;
  status: Status;
  address: string;
  lat: number;
  lon: number;
  metro: string[];
  metro_walk_min: number | null;
  district: string;
  phone: string;
  telegram: string;
  whatsapp: string;
  site: string;
  area_m2: number | null;
  cap_seated: number | null;
  cap_standing: number | null;
  price_hour_from: number | null;
  price_hour_weekday: number | null;
  price_hour_weekend: number | null;
  price_evening_30: number | null;
  price_evening_50: number | null;
  min_hours: number | null;
  deposit: number | null;
  cleaning_fee: number | null;
  corkage: Corkage | null;
  own_catering: boolean | null;
  kitchen: boolean | null;
  sound: boolean | null;
  projector: boolean | null;
  parking: boolean | null;
  noise_after_23: 'ok' | 'quiet' | 'no' | null;
  new_year_surcharge: string;
  free_dates_dec: string[];
  checked_at: string;
  updated_by_loft_at: string;
  source: string;
  photos: string[];
  has_3d: string;
  notes: string;
}

/** Поля, которые лофт может править сам через форму (§7.1 спека). */
export const EDITABLE_FIELDS = [
  'phone', 'telegram', 'whatsapp', 'site', 'area_m2', 'cap_seated', 'cap_standing',
  'price_hour_from', 'price_hour_weekday', 'price_hour_weekend', 'price_evening_30',
  'price_evening_50', 'min_hours', 'deposit', 'cleaning_fee', 'corkage', 'own_catering',
  'kitchen', 'sound', 'projector', 'parking', 'noise_after_23', 'new_year_surcharge',
  'free_dates_dec', 'photos',
] as const;

const MOSCOW = { latMin: 55.3, latMax: 56.1, lonMin: 36.8, lonMax: 38.2 };

const num = (v: string | undefined): number | null => {
  if (v === undefined || v.trim() === '') return null;
  const n = Number(v.replace(/\s/g, ''));
  return Number.isFinite(n) ? n : null;
};
const bool = (v: string | undefined): boolean | null =>
  v === undefined || v.trim() === '' ? null : ['yes', 'true', '1', 'да'].includes(v.trim().toLowerCase());
const list = (v: string | undefined): string[] =>
  v ? v.split(';').map((s) => s.trim()).filter(Boolean) : [];

export function parseCorkage(v: string | undefined): Corkage | null {
  if (!v || !v.trim()) return null;
  const s = v.trim().toLowerCase();
  if (s === 'free') return { kind: 'free' };
  if (s === 'no') return { kind: 'no' };
  const m = s.match(/^fee:(\d+)$/);
  if (m) return { kind: 'fee', fee: Number(m[1]) };
  return null;
}

export type RawRow = Record<string, string>;

export function rowToLoft(r: RawRow): Loft {
  return {
    id: r.id?.trim() ?? '',
    name: r.name?.trim() ?? '',
    status: (r.status?.trim() as Status) || 'candidate',
    address: r.address ?? '',
    lat: Number(r.lat),
    lon: Number(r.lon),
    metro: list(r.metro),
    metro_walk_min: num(r.metro_walk_min),
    district: r.district?.trim() ?? '',
    phone: r.phone?.trim() ?? '',
    telegram: r.telegram?.trim().replace(/^@/, '') ?? '',
    whatsapp: r.whatsapp?.trim() ?? '',
    site: r.site?.trim() ?? '',
    area_m2: num(r.area_m2),
    cap_seated: num(r.cap_seated),
    cap_standing: num(r.cap_standing),
    price_hour_from: num(r.price_hour_from),
    price_hour_weekday: num(r.price_hour_weekday),
    price_hour_weekend: num(r.price_hour_weekend),
    price_evening_30: num(r.price_evening_30),
    price_evening_50: num(r.price_evening_50),
    min_hours: num(r.min_hours),
    deposit: num(r.deposit),
    cleaning_fee: num(r.cleaning_fee),
    corkage: parseCorkage(r.corkage),
    own_catering: bool(r.own_catering),
    kitchen: bool(r.kitchen),
    sound: bool(r.sound),
    projector: bool(r.projector),
    parking: bool(r.parking),
    noise_after_23: (r.noise_after_23?.trim() as Loft['noise_after_23']) || null,
    new_year_surcharge: r.new_year_surcharge?.trim() ?? '',
    free_dates_dec: list(r.free_dates_dec),
    checked_at: r.checked_at?.trim() ?? '',
    updated_by_loft_at: r.updated_by_loft_at?.trim() ?? '',
    source: r.source?.trim() ?? '',
    photos: list(r.photos),
    has_3d: r.has_3d?.trim() ?? '',
    notes: r.notes ?? '',
  };
}

/** Возвращает список ошибок; пустой список = данные валидны. */
export function validateLofts(rows: RawRow[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const id = r.id?.trim();
    const where = `[${id || '<без id>'}]`;
    if (!id) { errors.push(`${where} пустой id`); continue; }
    if (!/^[a-z0-9-]+$/.test(id)) errors.push(`${where} id только a-z, 0-9 и дефис`);
    if (seen.has(id)) errors.push(`${where} дубль id`);
    seen.add(id);
    if (!r.name?.trim()) errors.push(`${where} нет name`);
    if (!['candidate', 'verified', 'closed'].includes(r.status?.trim())) errors.push(`${where} status должен быть candidate|verified|closed`);
    if (!r.address?.trim()) errors.push(`${where} нет address`);
    const lat = Number(r.lat), lon = Number(r.lon);
    if (!(lat >= MOSCOW.latMin && lat <= MOSCOW.latMax && lon >= MOSCOW.lonMin && lon <= MOSCOW.lonMax))
      errors.push(`${where} координаты вне Москвы: ${r.lat},${r.lon}`);
    if (list(r.metro).length === 0) errors.push(`${where} нет metro`);
    if (!r.district?.trim()) errors.push(`${where} нет district`);
    if (!r.phone?.trim() && !r.telegram?.trim()) errors.push(`${where} нужен phone или telegram`);
    if (!r.source?.trim()) errors.push(`${where} нет source`);
    if (r.corkage?.trim() && !parseCorkage(r.corkage)) errors.push(`${where} corkage: free|no|fee:<₽>`);
    for (const d of list(r.free_dates_dec)) if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) errors.push(`${where} free_dates_dec: дата ${d} не YYYY-MM-DD`);
    if (r.status?.trim() === 'verified') {
      for (const f of ['cap_seated', 'cap_standing', 'price_evening_30', 'min_hours', 'checked_at'] as const)
        if (!r[f]?.trim()) errors.push(`${where} verified без ${f}`);
      if (!r.corkage?.trim()) errors.push(`${where} verified без corkage`);
      if (!r.noise_after_23?.trim()) errors.push(`${where} verified без noise_after_23`);
    }
  }
  return errors;
}

export function readCsv(path: string): RawRow[] {
  return parse(readFileSync(path, 'utf8'), { columns: true, skip_empty_lines: true, trim: true, bom: true }) as RawRow[];
}

export type Update = { id: string; fields: Partial<RawRow>; updated_at: string };

export function readUpdates(dir: string): Update[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as Update);
}

/** Накладывает правки лофтов поверх CSV. Неизвестный id — предупреждение, не ошибка. */
export function mergeUpdates(rows: RawRow[], updates: Update[], warn: (m: string) => void = console.warn): RawRow[] {
  const byId = new Map(rows.map((r) => [r.id, { ...r }]));
  for (const u of updates) {
    const row = byId.get(u.id);
    if (!row) { warn(`update для неизвестного id ${u.id} пропущен`); continue; }
    for (const [k, v] of Object.entries(u.fields)) {
      if ((EDITABLE_FIELDS as readonly string[]).includes(k) && typeof v === 'string') row[k] = v;
    }
    row.updated_by_loft_at = u.updated_at;
    if (row.status === 'candidate') row.status = 'verified';
    if (!row.checked_at || row.checked_at < u.updated_at) row.checked_at = u.updated_at;
  }
  return [...byId.values()];
}

const ROOT = process.cwd();

let cache: Loft[] | null = null;
export function loadLofts(): Loft[] {
  if (cache) return cache;
  const rows = mergeUpdates(readCsv(join(ROOT, 'data/lofts.csv')), readUpdates(join(ROOT, 'data/updates')));
  const errors = validateLofts(rows);
  if (errors.length) throw new Error('Ошибки в data/lofts.csv:\n' + errors.join('\n'));
  cache = rows.map(rowToLoft);
  return cache;
}

export const publicLofts = () => loadLofts().filter((l) => l.status !== 'closed');
export const verifiedLofts = () => publicLofts().filter((l) => l.status === 'verified');

/** Свежесть: verified старше 21 дня теряет блок свободных дат (§5.3). */
export function datesAreFresh(l: Loft, now = new Date()): boolean {
  if (l.status !== 'verified' || !l.checked_at) return false;
  const age = (now.getTime() - new Date(l.checked_at).getTime()) / 86_400_000;
  return age <= 21 && l.free_dates_dec.length > 0;
}
