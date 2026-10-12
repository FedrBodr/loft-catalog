import { describe, it, expect } from 'vitest';
import { listPages, translit, loftsWord, noindexPaths, INDEX_MIN_VERIFIED } from './pages';
import { rowToLoft, stripUnverified } from './data';

const mk = (id: string, metro: string, extra: Record<string, string> = {}) =>
  rowToLoft({ id, name: id, status: 'verified', address: 'a', lat: '55.75', lon: '37.6', metro, district: 'ЦАО', phone: '1', source: 'demo',
    cap_seated: '30', cap_standing: '60', price_evening_30: '40000', min_hours: '4', checked_at: '2026-10-12', corkage: 'free', noise_after_23: 'ok', ...extra });

describe('listPages', () => {
  it('станция с 3 лофтами не получает страницу, с 4 — получает', () => {
    const three = [mk('a', 'Курская'), mk('b', 'Курская'), mk('c', 'Курская'), mk('d', 'Тульская')];
    expect(listPages(three).some((p) => p.path === '/metro/kurskaya/')).toBe(false);
    const four = [...three, mk('e', 'Курская')];
    expect(listPages(four).some((p) => p.path === '/metro/kurskaya/')).toBe(true);
  });
  it('title содержит число лофтов и минимальную цену за вечер', () => {
    const ls = [mk('a', 'Курская'), mk('b', 'Курская', { price_evening_30: '25000' }), mk('c', 'Курская'), mk('d', 'Курская')];
    const p = listPages(ls).find((p) => p.path === '/metro/kurskaya/')!;
    expect(p.title).toContain('4 лофта');
    expect(p.title).toContain('25');
    expect(p.title).toContain('000 ₽');
  });
  it('страницы вместимости фильтруют по cap', () => {
    const ls = [mk('a', 'Курская', { cap_standing: '20' }), mk('b', 'Курская'), mk('c', 'Курская'), mk('d', 'Курская'), mk('e', 'Курская')];
    const p50 = listPages(ls).find((p) => p.path === '/na/50-chelovek/')!;
    expect(p50.lofts.map((l) => l.id)).not.toContain('a');
    expect(listPages(ls).some((p) => p.path === '/na/100-chelovek/')).toBe(false);
  });
  it('все пути латиницей со слешем', () => {
    const ls = [mk('a', 'Чкаловская'), mk('b', 'Чкаловская'), mk('c', 'Чкаловская'), mk('d', 'Чкаловская')];
    for (const p of listPages(ls)) expect(p.path).toMatch(/^\/[a-z0-9\-\/]+\/$/);
  });
});

describe('индексация', () => {
  const cand = (id: string) => mk(id, 'Курская', { status: 'candidate', price_hour_from: '3000' });
  it('список индексируется только при INDEX_MIN_VERIFIED проверенных', () => {
    const few = [...Array.from({ length: INDEX_MIN_VERIFIED - 1 }, (_, i) => mk(`v${i}`, 'Курская')), cand('c1'), cand('c2')];
    expect(listPages(few).find((p) => p.path === '/metro/kurskaya/')!.indexable).toBe(false);
    const enough = [...few, mk('v-last', 'Курская')];
    expect(listPages(enough).find((p) => p.path === '/metro/kurskaya/')!.indexable).toBe(true);
  });
  it('noindexPaths содержит непроверенные карточки и закрытые списки, но не проверенные карточки', () => {
    const hidden = noindexPaths([mk('v1', 'Курская'), cand('c1'), cand('c2'), cand('c3')]);
    expect(hidden.has('/loft/c1/')).toBe(true);
    expect(hidden.has('/loft/v1/')).toBe(false);
    expect(hidden.has('/metro/kurskaya/')).toBe(true);
  });
  it('у непроверенной карточки нет ставки агрегатора, у проверенной остаётся', () => {
    expect(stripUnverified(cand('c1')).price_hour_from).toBeNull();
    expect(stripUnverified(mk('v1', 'Курская', { price_hour_from: '3000' })).price_hour_from).toBe(3000);
  });
});

describe('helpers', () => {
  it('translit', () => { expect(translit('Площадь Ильича')).toBe('ploschad-ilicha'); expect(translit('ЦАО')).toBe('tsao'); });
  it('plural', () => { expect(loftsWord(1)).toBe('1 лофт'); expect(loftsWord(4)).toBe('4 лофта'); expect(loftsWord(11)).toBe('11 лофтов'); expect(loftsWord(21)).toBe('21 лофт'); });
});
