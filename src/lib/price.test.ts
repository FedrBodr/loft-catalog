import { describe, it, expect } from 'vitest';
import { estimate, surchargeFactor, DEFAULT_QUERY } from './price';
import { rowToLoft } from './data';

const base = rowToLoft({
  id: 'x', name: 'X', status: 'verified', address: 'a', lat: '55.75', lon: '37.6', metro: 'Курская', district: 'ЦАО',
  phone: '1', source: 'demo', price_hour_weekday: '2000', price_hour_weekend: '3000', min_hours: '4',
  cleaning_fee: '3000', deposit: '10000', corkage: 'fee:5000', new_year_surcharge: '+30%',
});

describe('estimate', () => {
  it('часов меньше минимума → считаем по минимуму', () => {
    const e = estimate(base, { ...DEFAULT_QUERY, hours: 2, weekend: false, december: false, ownAlcohol: false })!;
    expect(e.hours).toBe(4);
    expect(e.lines[0].amount).toBe(8000);
  });
  it('выходной берёт weekend-ставку', () => {
    const e = estimate(base, { ...DEFAULT_QUERY, hours: 5, weekend: true, december: false, ownAlcohol: false })!;
    expect(e.lines[0].amount).toBe(15000);
  });
  it('пробковый сбор только при своём алкоголе', () => {
    const with_ = estimate(base, { ...DEFAULT_QUERY, december: false, ownAlcohol: true })!;
    const without = estimate(base, { ...DEFAULT_QUERY, december: false, ownAlcohol: false })!;
    expect(with_.lines.some((l) => l.label.includes('Пробковый'))).toBe(true);
    expect(without.lines.some((l) => l.label.includes('Пробковый'))).toBe(false);
    expect(with_.total - without.total).toBe(5000);
  });
  it('декабрь применяет наценку', () => {
    const e = estimate(base, { ...DEFAULT_QUERY, hours: 5, weekend: false, december: true, ownAlcohol: false })!;
    expect(e.lines[0].amount).toBe(13000);
  });
  it('candidate → approx, только ставка × часы, без сборов и залога', () => {
    const c = rowToLoft({ id: 'c', name: 'C', status: 'candidate', address: 'a', lat: '55.75', lon: '37.6', metro: 'Курская', district: 'ЦАО', phone: '1', source: 'demo', price_hour_from: '1500' });
    const e = estimate(c, { ...DEFAULT_QUERY, hours: 5, december: false })!;
    expect(e.approx).toBe(true);
    expect(e.total).toBe(7500);
    expect(e.deposit).toBe(0);
  });
  it('без цены → null', () => {
    const c = rowToLoft({ id: 'c', name: 'C', status: 'candidate', address: 'a', lat: '55.75', lon: '37.6', metro: 'Курская', district: 'ЦАО', phone: '1', source: 'demo' });
    expect(estimate(c, DEFAULT_QUERY)).toBeNull();
  });
  it('surchargeFactor', () => {
    expect(surchargeFactor('+30%')).toBe(1.3);
    expect(surchargeFactor('нет')).toBe(1);
    expect(surchargeFactor('')).toBe(1);
  });
});
