Project: loft-catalog
Document: readme

# LoftMap — каталог лофтов Москвы

**loftmap.ru**: все лофты Москвы без комиссии, с проверенной ценой за вечер и свободными
датами. Статика на Astro, данные в `data/lofts.csv`, деплой на GitHub Pages.

- [docs/idea.md](docs/idea.md) — идея и рынок
- [docs/superpowers/specs/2026-10-12-loftmap-mvp-design.md](docs/superpowers/specs/2026-10-12-loftmap-mvp-design.md) — спек MVP
- [docs/superpowers/plans/2026-10-12-loftmap-mvp.md](docs/superpowers/plans/2026-10-12-loftmap-mvp.md) — план реализации
- [docs/call-script.md](docs/call-script.md) — скрипт обзвона лофтов
- [docs/analytics-search.md](docs/analytics-search.md) — хостинг, GA4, Search Console, дашборд

## Разработка

```bash
npm i
npm run validate   # проверка data/lofts.csv
npm test
npm run dev        # http://localhost:4321
npm run build
```

Данные: `data/lofts.csv` (источник правды), `data/updates/<id>.json` (правки лофтов),
`data/calls/*.csv` (результаты обзвона). Поля — в спеке §5.1.

Связь с «Пространством»: каталог — витрина и источник заявок, продаём 3D-карточки
(репозиторий FedrBodr/prostranstvo).
