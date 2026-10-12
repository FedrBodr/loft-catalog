import { useState } from 'preact/hooks';
import type { Loft } from '../lib/data';
import { estimate, fmt, DEFAULT_QUERY, type Query } from '../lib/price';

export default function Calculator({ loft }: { loft: Loft }) {
  const [q, setQ] = useState<Query>(DEFAULT_QUERY);
  const e = estimate(loft, q);
  const upd = (p: Partial<Query>) => {
    const next = { ...q, ...p };
    setQ(next);
    (window as any).lmTrack?.('price_calculated', { loft: loft.id, people: next.people, hours: next.hours });
  };
  if (!e) return <p class="text-sm text-ink/60">Цена не указана — уточните у площадки по телефону.</p>;
  return (
    <div class="rounded-xl bg-sand p-4">
      <div class="flex flex-wrap gap-x-5 gap-y-3 items-end mb-3">
        <label class="text-sm">Гостей<br /><input type="number" min="1" class="mt-1 w-20 rounded border border-ink/20 px-2 py-1" value={q.people} onInput={(ev) => upd({ people: Number((ev.target as HTMLInputElement).value) || 1 })} /></label>
        <label class="text-sm">Часов<br /><input type="number" min="1" max="24" class="mt-1 w-20 rounded border border-ink/20 px-2 py-1" value={q.hours} onInput={(ev) => upd({ hours: Number((ev.target as HTMLInputElement).value) || 1 })} /></label>
        <label class="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={q.weekend} onChange={(ev) => upd({ weekend: (ev.target as HTMLInputElement).checked })} />выходной</label>
        <label class="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={q.december} onChange={(ev) => upd({ december: (ev.target as HTMLInputElement).checked })} />декабрь</label>
        <label class="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={q.ownAlcohol} onChange={(ev) => upd({ ownAlcohol: (ev.target as HTMLInputElement).checked })} />свой алкоголь</label>
      </div>
      <table class="w-full text-sm">
        {e.lines.map((l) => <tr><td class="py-1">{l.label}</td><td class="py-1 text-right">{fmt(l.amount)}</td></tr>)}
        <tr class="font-semibold border-t border-ink/20"><td class="pt-2">Итого{e.approx ? ' (ориентировочно)' : ''}</td><td class="pt-2 text-right">{fmt(e.total)}</td></tr>
        {e.deposit > 0 && <tr class="text-ink/60"><td>Залог (возвращается)</td><td class="text-right">{fmt(e.deposit)}</td></tr>}
      </table>
      {q.people > 0 && e.total > 0 && <p class="mt-2 text-sm text-ink/60">≈ {fmt(Math.round(e.total / q.people))} на человека за аренду</p>}
      {e.approx && <p class="mt-2 text-xs text-ink/60">Данные площадки не проверены: взята ставка «от» с сайта, сборы и минимум часов не учтены.</p>}
    </div>
  );
}
