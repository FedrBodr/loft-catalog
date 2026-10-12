import { describe, it, expect } from 'vitest';
import { stats, median } from './stats';
import { rowToLoft } from './data';

const mk = (id: string, extra: Record<string, string> = {}) =>
  rowToLoft({ id, name: id, status: 'verified', address: 'a', lat: '55.75', lon: '37.6', metro: 'Курская', district: 'ЦАО', phone: '1', source: 'demo',
    cap_seated: '30', cap_standing: '60', price_evening_30: '40000', min_hours: '4', checked_at: '2026-10-12', corkage: 'free', noise_after_23: 'ok', ...extra });

describe('stats', () => {
  it('median', () => { expect(median([])).toBeNull(); expect(median([3, 1, 2])).toBe(2); expect(median([1, 2, 3, 10])).toBe(3); });
  it('пустая выборка → null, не NaN', () => {
    const s = stats([]);
    expect(s.median30).toBeNull(); expect(s.shareOwnAlcohol).toBeNull(); expect(s.byCapacity[0].median30).toBeNull();
  });
  it('считает только verified и группирует', () => {
    const s = stats([mk('a'), mk('b', { price_evening_30: '60000', district: 'ЮАО', corkage: 'no' }), mk('c', { status: 'candidate', price_evening_30: '' })]);
    expect(s.total).toBe(3); expect(s.verified).toBe(2);
    expect(s.median30).toBe(50000);
    expect(s.shareOwnAlcohol).toBe(50);
    expect(s.byDistrict.find((d) => d.district === 'ЮАО')?.median30).toBe(60000);
  });
});
