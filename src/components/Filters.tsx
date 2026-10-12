import { useEffect, useState } from 'preact/hooks';

interface State { people: string; metro: string; alcohol: boolean; catering: boolean; dates: boolean; verified: boolean; maxEvening: string }
const EMPTY: State = { people: '', metro: '', alcohol: false, catering: false, dates: false, verified: false, maxEvening: '' };

const parse = (): State => {
  const p = new URLSearchParams(location.hash.slice(1));
  return { people: p.get('people') ?? '', metro: p.get('metro') ?? '', alcohol: p.get('alcohol') === '1', catering: p.get('catering') === '1', dates: p.get('dates') === '1', verified: p.get('verified') === '1', maxEvening: p.get('max') ?? '' };
};
const serialize = (s: State) => {
  const p = new URLSearchParams();
  if (s.people) p.set('people', s.people); if (s.metro) p.set('metro', s.metro);
  if (s.alcohol) p.set('alcohol', '1'); if (s.catering) p.set('catering', '1'); if (s.dates) p.set('dates', '1'); if (s.verified) p.set('verified', '1');
  if (s.maxEvening) p.set('max', s.maxEvening);
  return p.toString();
};

function apply(s: State): number {
  let shown = 0;
  document.querySelectorAll<HTMLElement>('[data-card]').forEach((el) => {
    const d = el.dataset;
    let ok = true;
    if (s.people && Number(d.cap || 0) < Number(s.people)) ok = false;
    if (s.metro && !(d.metro || '').toLowerCase().includes(s.metro.toLowerCase())) ok = false;
    if (s.alcohol && d.alcohol !== 'yes') ok = false;
    if (s.catering && d.catering !== 'yes') ok = false;
    if (s.dates && d.dates !== 'yes') ok = false;
    if (s.verified && d.verified !== 'yes') ok = false;
    if (s.maxEvening && (!d.evening || Number(d.evening) > Number(s.maxEvening))) ok = false;
    el.hidden = !ok;
    if (ok) shown++;
  });
  return shown;
}

export default function Filters({ total }: { total: number }) {
  const [s, setS] = useState<State>(EMPTY);
  const [shown, setShown] = useState(total);
  useEffect(() => { const init = parse(); setS(init); setShown(apply(init)); }, []);
  const upd = (patch: Partial<State>) => {
    const next = { ...s, ...patch };
    setS(next);
    history.replaceState(null, '', '#' + serialize(next));
    setShown(apply(next));
  };
  const cb = (k: keyof State, label: string) => (
    <label class="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={s[k] as boolean} onChange={(e) => upd({ [k]: (e.target as HTMLInputElement).checked } as any)} />{label}</label>
  );
  return (
    <div class="rounded-xl bg-sand p-4 mb-6 flex flex-wrap gap-x-5 gap-y-3 items-end">
      <label class="text-sm">Гостей<br /><input type="number" min="1" class="mt-1 w-24 rounded border border-ink/20 px-2 py-1" value={s.people} onInput={(e) => upd({ people: (e.target as HTMLInputElement).value })} placeholder="30" /></label>
      <label class="text-sm">Метро<br /><input type="text" class="mt-1 w-36 rounded border border-ink/20 px-2 py-1" value={s.metro} onInput={(e) => upd({ metro: (e.target as HTMLInputElement).value })} placeholder="Курская" /></label>
      <label class="text-sm">Вечер до, ₽<br /><input type="number" step="5000" class="mt-1 w-28 rounded border border-ink/20 px-2 py-1" value={s.maxEvening} onInput={(e) => upd({ maxEvening: (e.target as HTMLInputElement).value })} placeholder="60000" /></label>
      {cb('alcohol', 'свой алкоголь')}
      {cb('catering', 'своя еда')}
      {cb('dates', 'есть даты в декабре')}
      {cb('verified', 'только проверенные')}
      <span class="text-sm text-ink/60 ml-auto">Показано {shown} из {total}</span>
      {serialize(s) && <button class="text-sm text-brick" onClick={() => upd(EMPTY)}>сбросить</button>}
    </div>
  );
}
