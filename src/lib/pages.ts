import type { Loft } from './data';
import districts from '../../data/districts.json';

export const MIN_PER_PAGE = 4;
/** Комбинации «задача × метро» и «вместимость × метро» — почти дубли страниц метро, пока
 *  нет проверенных данных не генерируем (риск фильтра за тонкий/дублирующий контент). */
export const COMBO_PAGES = false;
/** Больше карточек на одной странице не рендерим: ~1 КБ на карточку, дальше — ссылки на метро. */
export const MAX_CARDS = 240;

/** Станции метро с ≥ MIN_PER_PAGE лофтов, по убыванию числа лофтов — для блока «уточните по метро». */
export const metroLinks = (ls: Loft[]) =>
  [...byMetro(ls)].filter(([, v]) => v.length >= MIN_PER_PAGE).sort((a, b) => b[1].length - a[1].length)
    .map(([station, v]) => ({ station, count: v.length, path: `/metro/${translit(station)}/` }));
export const TASKS = districts.tasks as Record<string, { title: string; h1: string }>;
export const CAPACITIES = districts.capacities as number[];
export const DISTRICTS = districts.districts as string[];

export const translit = (s: string) =>
  s.toLowerCase()
    .replace(/[а-яё]/g, (c) => ({ а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya' } as Record<string,string>)[c] ?? c)
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const slugDistrict = (d: string) => translit(d);

const minEvening = (ls: Loft[]) => {
  const v = ls.map((l) => l.price_evening_30).filter((x): x is number => x != null);
  return v.length ? Math.min(...v) : null;
};
const minHour = (ls: Loft[]) => {
  const v = ls.map((l) => l.price_hour_from ?? l.price_hour_weekday).filter((x): x is number => x != null);
  return v.length ? Math.min(...v) : null;
};

export const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
};
export const loftsWord = (n: number) => `${n} ${plural(n, 'лофт', 'лофта', 'лофтов')}`;

export interface ListPage {
  path: string;
  h1: string;
  title: string;
  description: string;
  lofts: Loft[];
  crumbs: { name: string; path: string }[];
  /** noindex,follow: страница есть для навигации, но в индекс и sitemap не идёт. */
  noindex?: boolean;
}

function titleFor(where: string, ls: Loft[], people?: number): { title: string; description: string } {
  const n = ls.length;
  const ev = minEvening(ls), hr = minHour(ls);
  const price = ev ? `цена за вечер от ${ev.toLocaleString('ru-RU')} ₽` : hr ? `от ${hr.toLocaleString('ru-RU')} ₽/час` : 'реальные цены';
  const who = people ? ` на ${people} человек` : '';
  return {
    title: `${loftsWord(n)} ${where}${who}: ${price} — LoftMap`,
    description: `${loftsWord(n)} ${where}${who} с проверенными ценами, свободными датами и прямыми контактами. Без комиссии и посредников.`,
  };
}

export function fitsPeople(l: Loft, n: number): boolean {
  const cap = Math.max(l.cap_seated ?? 0, l.cap_standing ?? 0);
  return cap >= n;
}

export const byMetro = (ls: Loft[]) => {
  const m = new Map<string, Loft[]>();
  for (const l of ls) for (const s of l.metro) m.set(s, [...(m.get(s) ?? []), l]);
  return m;
};

/** Все списочные страницы, которые нужно сгенерировать. Правило ≥ MIN_PER_PAGE лофтов. */
export function listPages(all: Loft[]): ListPage[] {
  const pages: ListPage[] = [];
  const home = { name: 'Лофты Москвы', path: '/' };
  const enough = (ls: Loft[]) => ls.length >= MIN_PER_PAGE;

  for (const [station, ls] of byMetro(all)) {
    if (!enough(ls)) continue;
    const path = `/metro/${translit(station)}/`;
    pages.push({ path, h1: `Лофты у метро ${station}`, ...titleFor(`у метро ${station}`, ls), lofts: ls, crumbs: [home, { name: `м. ${station}`, path }] });
  }
  for (const d of DISTRICTS) {
    const ls = all.filter((l) => l.district === d);
    if (!enough(ls)) continue;
    const path = `/rayon/${slugDistrict(d)}/`;
    pages.push({ path, h1: `Лофты в ${d}`, ...titleFor(`в ${d}`, ls), lofts: ls, crumbs: [home, { name: d, path }] });
  }
  for (const [slug, t] of Object.entries(TASKS)) {
    const ls = all; // задача пока не фильтрует данные — все лофты подходят, фильтры уточняют
    if (!enough(ls)) continue;
    const path = `/dlya/${slug}/`;
    pages.push({ path, h1: `${t.h1} в Москве`, ...titleFor(`для ${t.title === 'корпоратив' ? 'корпоратива' : t.title} в Москве`, ls), lofts: ls, crumbs: [home, { name: t.h1, path }], noindex: true });
    if (!COMBO_PAGES) continue;
    for (const [station, sls] of byMetro(ls)) {
      if (!enough(sls)) continue;
      const p2 = `/dlya/${slug}/${translit(station)}/`;
      pages.push({ path: p2, h1: `${t.h1} у метро ${station}`, ...titleFor(`для ${t.title} у метро ${station}`, sls), lofts: sls, crumbs: [home, { name: t.h1, path }, { name: `м. ${station}`, path: p2 }] });
    }
  }
  for (const n of CAPACITIES) {
    const ls = all.filter((l) => fitsPeople(l, n));
    if (!enough(ls)) continue;
    const path = `/na/${n}-chelovek/`;
    pages.push({ path, h1: `Лофты на ${n} человек в Москве`, ...titleFor('в Москве', ls, n), lofts: ls, crumbs: [home, { name: `на ${n} человек`, path }] });
    if (!COMBO_PAGES) continue;
    for (const [station, sls] of byMetro(ls)) {
      if (!enough(sls)) continue;
      const p2 = `/na/${n}-chelovek/${translit(station)}/`;
      pages.push({ path: p2, h1: `Лофты на ${n} человек у метро ${station}`, ...titleFor(`у метро ${station}`, sls, n), lofts: sls, crumbs: [home, { name: `на ${n} человек`, path }, { name: `м. ${station}`, path: p2 }] });
    }
  }
  const feature = (path: string, h1: string, where: string, pred: (l: Loft) => boolean) => {
    const ls = all.filter(pred);
    if (enough(ls)) pages.push({ path, h1, ...titleFor(where, ls), lofts: ls, crumbs: [home, { name: h1, path }] });
  };
  feature('/so-svoim-alkogolem/', 'Лофты со своим алкоголем', 'со своим алкоголем в Москве', (l) => l.corkage?.kind === 'free' || l.corkage?.kind === 'fee');
  feature('/so-svoim-keyteringom/', 'Лофты со своим кейтерингом', 'со своей едой и кейтерингом в Москве', (l) => l.own_catering === true);
  feature('/bez-zaloga/', 'Лофты без залога', 'без залога в Москве', (l) => l.status === 'verified' && !l.deposit);
  return pages;
}
