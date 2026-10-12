import type { Loft } from './data';
import { CAPACITIES, fitsPeople } from './pages';

export const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

const evenings = (ls: Loft[]) => ls.map((l) => l.price_evening_30).filter((x): x is number => x != null);

export interface Stats {
  total: number;
  verified: number;
  median30: number | null;
  min30: number | null;
  max30: number | null;
  medianDeposit: number | null;
  shareOwnAlcohol: number | null;
  shareOwnCatering: number | null;
  byCapacity: { people: number; count: number; median30: number | null }[];
  byDistrict: { district: string; count: number; median30: number | null }[];
}

export function stats(all: Loft[]): Stats {
  const v = all.filter((l) => l.status === 'verified');
  const ev = evenings(v);
  const share = (pred: (l: Loft) => boolean, pool: Loft[]) => (pool.length ? Math.round((pool.filter(pred).length / pool.length) * 100) : null);
  const withCork = v.filter((l) => l.corkage);
  const withCat = v.filter((l) => l.own_catering != null);
  const districts = [...new Set(v.map((l) => l.district))].sort();
  return {
    total: all.filter((l) => l.status !== 'closed').length,
    verified: v.length,
    median30: median(ev),
    min30: ev.length ? Math.min(...ev) : null,
    max30: ev.length ? Math.max(...ev) : null,
    medianDeposit: median(v.map((l) => l.deposit).filter((x): x is number => x != null)),
    shareOwnAlcohol: share((l) => l.corkage!.kind !== 'no', withCork),
    shareOwnCatering: share((l) => l.own_catering === true, withCat),
    byCapacity: CAPACITIES.map((people) => {
      const ls = v.filter((l) => fitsPeople(l, people));
      return { people, count: ls.length, median30: median(evenings(ls)) };
    }),
    byDistrict: districts.map((district) => {
      const ls = v.filter((l) => l.district === district);
      return { district, count: ls.length, median30: median(evenings(ls)) };
    }),
  };
}
