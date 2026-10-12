import type { APIRoute } from 'astro';
import { verifiedLofts } from '../../lib/data';

// Публичная выгрузка: только проверенные лофты (данные, полученные от самих площадок), без notes.
// edit_token в Loft отсутствует by design.
export const GET: APIRoute = () => {
  const lofts = verifiedLofts().map(({ notes, ...rest }) => rest);
  const body = {
    source: 'https://loftmap.ru',
    license: 'CC BY 4.0',
    updated: new Date().toISOString().slice(0, 10),
    count: lofts.length,
    lofts,
  };
  return new Response(JSON.stringify(body, null, 1), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
