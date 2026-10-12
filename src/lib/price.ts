import type { Loft } from './data';

export interface Query {
  people: number;
  hours: number;
  weekend: boolean;
  december: boolean;
  ownAlcohol: boolean;
}

export interface Estimate {
  total: number;
  lines: { label: string; amount: number }[];
  deposit: number;
  approx: boolean;
  hours: number;
}

export const DEFAULT_QUERY: Query = { people: 20, hours: 5, weekend: true, december: true, ownAlcohol: true };

/** Парсит «+30%» → 1.3; пусто/«нет» → 1. */
export function surchargeFactor(s: string): number {
  const m = s.match(/\+?\s*(\d+)\s*%/);
  return m ? 1 + Number(m[1]) / 100 : 1;
}

export function estimate(l: Loft, q: Query): Estimate | null {
  const lines: Estimate['lines'] = [];
  const minHours = l.min_hours ?? 0;
  const hours = Math.max(q.hours, minHours);
  const rate = q.weekend ? (l.price_hour_weekend ?? l.price_hour_weekday ?? l.price_hour_from)
                         : (l.price_hour_weekday ?? l.price_hour_from);
  if (rate == null) return null;

  const approx = l.status !== 'verified';
  let rent = rate * hours;
  const factor = q.december ? surchargeFactor(l.new_year_surcharge) : 1;
  rent = Math.round(rent * factor);
  lines.push({ label: `Аренда ${hours} ч${hours > q.hours ? ` (минимум ${minHours} ч)` : ''}${factor > 1 ? `, наценка ${l.new_year_surcharge}` : ''}`, amount: rent });

  if (!approx) {
    if (l.cleaning_fee) lines.push({ label: 'Уборка', amount: l.cleaning_fee });
    if (q.ownAlcohol && l.corkage?.kind === 'fee' && l.corkage.fee) lines.push({ label: 'Пробковый сбор', amount: l.corkage.fee });
  }
  const total = lines.reduce((s, x) => s + x.amount, 0);
  return { total, lines, deposit: approx ? 0 : (l.deposit ?? 0), approx, hours };
}

export const fmt = (n: number) => n.toLocaleString('ru-RU') + ' ₽';
