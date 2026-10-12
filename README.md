Project: loft-catalog
Document: readme

# LoftMap — каталог лофтов Москвы

**loftmap.ru**: все лофты Москвы без комиссии, с проверенной ценой за вечер и свободными
датами. Статика на Astro, данные в приватном репо `FedrBodr/loft-catalog-data` (клонируется в
`data/private/`), деплой на GitHub Pages.

- [docs/idea.md](docs/idea.md) — идея и рынок
- [docs/superpowers/specs/2026-10-12-loftmap-mvp-design.md](docs/superpowers/specs/2026-10-12-loftmap-mvp-design.md) — спек MVP
- [docs/superpowers/plans/2026-10-12-loftmap-mvp.md](docs/superpowers/plans/2026-10-12-loftmap-mvp.md) — план реализации
- [docs/call-script.md](docs/call-script.md) — скрипт обзвона лофтов
- [docs/analytics-search.md](docs/analytics-search.md) — хостинг, GA4, Search Console, дашборд

## Разработка

```bash
git clone git@github.com:FedrBodr/loft-catalog-data.git data/private   # один раз, нужен доступ
npm i
npm run validate   # проверка data/private/lofts.csv
npm test
npm run dev        # http://localhost:4321
npm run build
```

Данные в `data/private/` (приватный репо, в публичный не коммитим): `lofts.csv` (источник
правды), `updates/<id>.json` (правки лофтов), `calls/*.csv` (результаты переписки агента).
Поля — в спеке §5.1. Изменения данных коммитятся и пушатся в `loft-catalog-data`, сайт
пересобирается вручную (`gh workflow run deploy.yml`) или следующим пушем кода.

Связь с «Пространством»: каталог — витрина и источник заявок, продаём 3D-карточки
(репозиторий FedrBodr/prostranstvo).
