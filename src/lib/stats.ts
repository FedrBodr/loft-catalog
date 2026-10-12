import type { Loft } from './data';
import { CAPACITIES, fitsPeople } from './pages';

export const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

const evenings = (ls: Loft[]) => ls.map((l) => l.price_evening_30).filter((x): x is number => x != null);
const hours = (ls: Loft[]) => ls.map((l) => l.price_hour_from ?? l.price_hour_weekday).filter((x): x is number => x != null && x > 0);

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
  /** По заявленным ставкам «от» с сайтов площадок (все лофты, не только verified). */
  hour: {
    count: number;
    median: number | null;
    byCapacity: { people: number; count: number; median: number | null }[];
    byDistrict: { district: string; count: number; median: number | null }[];
  };
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
    hour: (() => {
      const pub = all.filter((l) => l.status !== 'closed');
      const withHour = pub.filter((l) => hours([l]).length);
      const ds = [...new Set(withHour.map((l) => l.district))].sort();
      return {
        count: withHour.length,
        median: median(hours(withHour)),
        byCapacity: CAPACITIES.map((people) => { const ls = withHour.filter((l) => fitsPeople(l, people)); return { people, count: ls.length, median: median(hours(ls)) }; }),
        byDistrict: ds.map((district) => { const ls = withHour.filter((l) => l.district === district); return { district, count: ls.length, median: median(hours(ls)) }; }),
      };
    })(),
  };
}
