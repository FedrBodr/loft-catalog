import { describe, it, expect } from 'vitest';
import { validateLofts, mergeUpdates, parseCorkage, rowToLoft, datesAreFresh, type RawRow } from './data';

const ok: RawRow = {
  id: 'test-loft', name: 'Test', status: 'candidate', address: 'Москва, ул. Тестовая 1',
  lat: '55.75', lon: '37.62', metro: 'Курская;Чкаловская', district: 'ЦАО', phone: '+79990000000',
  source: '2gis',
};

describe('validateLofts', () => {
  it('корректная строка проходит', () => expect(validateLofts([ok])).toEqual([]));
  it('verified без price_evening_30 — ошибка с id', () => {
    const errs = validateLofts([{ ...ok, status: 'verified', cap_seated: '30', cap_standing: '50', min_hours: '4', checked_at: '2026-10-12', corkage: 'free', noise_after_23: 'ok' }]);
    expect(errs.some((e) => e.includes('[test-loft]') && e.includes('price_evening_30'))).toBe(true);
  });
  it('дубль id — ошибка', () => expect(validateLofts([ok, ok]).join()).toContain('дубль id'));
  it('координаты вне Москвы — ошибка', () => expect(validateLofts([{ ...ok, lat: '59.9', lon: '30.3' }]).join()).toContain('вне Москвы'));
  it('нет контакта — ошибка', () => expect(validateLofts([{ ...ok, phone: '' }]).join()).toContain('phone или telegram'));
  it('candidate с одним site проходит, verified — нет', () => {
    expect(validateLofts([{ ...ok, phone: '', site: 'https://x.ru' }])).toEqual([]);
    expect(validateLofts([{ ...ok, status: 'verified', phone: '', site: 'https://x.ru' }]).join()).toContain('phone или telegram');
  });
  it('кривой corkage — ошибка', () => expect(validateLofts([{ ...ok, corkage: 'maybe' }]).join()).toContain('corkage'));
});

describe('parseCorkage', () => {
  it('free/no/fee', () => {
    expect(parseCorkage('free')).toEqual({ kind: 'free' });
    expect(parseCorkage('no')).toEqual({ kind: 'no' });
    expect(parseCorkage('fee:3000')).toEqual({ kind: 'fee', fee: 3000 });
    expect(parseCorkage('')).toBeNull();
  });
});

describe('mergeUpdates', () => {
  it('перекрывает редактируемые поля и ставит updated_by_loft_at', () => {
    const [r] = mergeUpdates([ok], [{ id: 'test-loft', updated_at: '2026-11-01', fields: { price_evening_30: '60000', free_dates_dec: '2026-12-19' } }]);
    expect(r.price_evening_30).toBe('60000');
    expect(r.updated_by_loft_at).toBe('2026-11-01');
    expect(r.checked_at).toBe('2026-11-01');
    expect(r.status).toBe('verified');
  });
  it('не даёт править id/status/координаты', () => {
    const [r] = mergeUpdates([ok], [{ id: 'test-loft', updated_at: '2026-11-01', fields: { id: 'hack', lat: '0', status: 'closed' } }]);
    expect(r.id).toBe('test-loft'); expect(r.lat).toBe('55.75'); expect(r.status).toBe('verified');
  });
  it('неизвестный id — предупреждение, не исключение', () => {
    const warns: string[] = [];
    const rows = mergeUpdates([ok], [{ id: 'nope', updated_at: '2026-11-01', fields: {} }], (m) => warns.push(m));
    expect(rows).toHaveLength(1);
    expect(warns[0]).toContain('nope');
  });
});

describe('rowToLoft / datesAreFresh', () => {
  it('парсит списки и числа', () => {
    const l = rowToLoft({ ...ok, free_dates_dec: '2026-12-12;2026-12-19', cap_seated: '30', own_catering: 'yes' });
    expect(l.metro).toEqual(['Курская', 'Чкаловская']);
    expect(l.free_dates_dec).toHaveLength(2);
    expect(l.cap_seated).toBe(30);
    expect(l.own_catering).toBe(true);
    expect(l.area_m2).toBeNull();
  });
  it('даты свежие ≤ 21 дня только у verified', () => {
    const base = rowToLoft({ ...ok, status: 'verified', checked_at: '2026-12-01', free_dates_dec: '2026-12-19' });
    expect(datesAreFresh(base, new Date('2026-12-10'))).toBe(true);
    expect(datesAreFresh(base, new Date('2026-12-30'))).toBe(false);
    expect(datesAreFresh({ ...base, status: 'candidate' }, new Date('2026-12-10'))).toBe(false);
  });
});
