Project: loft-catalog
Document: implementation-plan

# LoftMap MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Поднять loftmap.ru как статический каталог лофтов Москвы с калькулятором цены, лендингом «корпоратив», GEO-пакетом и подключённой Google-аналитикой до 1 ноября 2026.

**Architecture:** Astro (static) генерирует все страницы из `data/lofts.csv` + `data/updates/*.json`; деплой через GitHub Actions на GitHub Pages с кастомным доменом; формы заявки/правки — отдельные воркеры (Cloudflare или VPS), подключаются после появления аккаунта и не блокируют индексацию.

**Tech Stack:** Node 23, Astro 5, TypeScript, Tailwind 4, Preact (островки), Vitest, csv-parse, GitHub Pages, Google Site Verification / Search Console / GA4 Admin API, gcloud SA `indexing@fedrbodr-indexing`.

**Spec:** `docs/superpowers/specs/2026-10-12-loftmap-mvp-design.md`

## Global Constraints

- Все URL латиницей, без параметров, со слешем на конце, самоканоничные.
- Программная страница создаётся только при ≥ 4 лофтах.
- `edit_token` никогда не попадает в `public/data/lofts.json` и в HTML.
- Карточки `candidate` не участвуют в калькуляторе и фильтре по датам, несут плашку «данные не проверены».
- Секреты (токены Google/Яндекс) не в репо, не в логах, не в чате.
- Сборка падает при ошибке валидации данных.

## Review Focus

1. CSV с пустым `price_evening_30` у `verified` лофта → валидатор должен упасть с указанием id, а не собрать карточку с «NaN ₽». Тест в Task 2.
2. Лофт с `status: closed` → страница отдаёт 410/не генерится, в sitemap его нет. Тест в Task 3.
3. Калькулятор: часов меньше `min_hours` → считаем по `min_hours`; `corkage: fee:3000` и «без алкоголя» → сбор не добавляется. Тест в Task 4.
4. Станция метро с 3 лофтами → страницы `/metro/<station>/` нет и ссылки на неё нет. Тест в Task 5.
5. `updates/<id>.json` для несуществующего id → сборка предупреждает и игнорирует, а не падает. Тест в Task 3.

---

### Task 1: Каркас Astro + деплой на GitHub Pages + DNS

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `src/pages/index.astro`, `src/layouts/Base.astro`, `public/robots.txt`, `public/CNAME`, `.github/workflows/deploy.yml`, `.gitignore`

- [ ] `npm create astro@latest . -- --template minimal --typescript strict --no-install --no-git`, затем `npm i`, `npx astro add tailwind preact sitemap --yes`.
- [ ] `astro.config.mjs`: `site: 'https://loftmap.ru'`, `trailingSlash: 'always'`, `integrations: [tailwind(), preact(), sitemap()]`.
- [ ] `public/CNAME` = `loftmap.ru`. `public/robots.txt`:
  ```
  User-agent: *
  Allow: /
  Disallow: /edit/
  Sitemap: https://loftmap.ru/sitemap-index.xml
  ```
- [ ] `.github/workflows/deploy.yml`: `withastro/action@v3` + `actions/deploy-pages@v4` на push в `main`.
- [ ] `gh api -X POST repos/FedrBodr/loft-catalog/pages -f build_type=workflow`; после первого деплоя `gh api -X PUT repos/FedrBodr/loft-catalog/pages -f cname=loftmap.ru -F https_enforced=true`.
- [ ] DNS на reg.ru: A `@` → 185.199.108.153 / .109 / .110 / .111; CNAME `www` → `fedrbodr.github.io`.
- [ ] Проверка: `curl -sI https://loftmap.ru/` → 200, `<title>` есть. Commit.

### Task 2: Данные и валидатор

**Files:**
- Create: `data/lofts.csv` (заголовок + 3 тестовых строки), `data/districts.json`, `src/lib/data.ts`, `src/lib/data.test.ts`, `scripts/validate.ts`

**Interfaces:**
- Produces: `type Loft` (поля §5.1 спека, `metro: string[]`, `free_dates_dec: string[]`, `corkage: {kind:'free'|'no'|'fee', fee?:number}`), `loadLofts(): Loft[]` (CSV + updates, без `edit_token`), `validateLofts(rows): string[]` (список ошибок).

- [ ] Тест: `verified` без `price_evening_30` → ошибка содержит id; дубль id → ошибка; координаты вне бокса Москвы (55.3–56.1, 36.8–38.2) → ошибка; корректная строка → `[]`.
- [ ] Реализация парсера (`csv-parse/sync`), нормализация массивов через `;`, `corkage` парсится из `free|no|fee:<n>`.
- [ ] `scripts/validate.ts` вызывается в `prebuild`; при ошибках `process.exit(1)`.
- [ ] `npm test` зелёный. Commit.

### Task 3: Карточка лофта и слияние updates

**Files:**
- Create: `src/pages/loft/[id].astro`, `src/components/LoftCard.astro`, `src/components/JsonLd.astro`, `src/lib/merge.ts`, `src/lib/merge.test.ts`

- [ ] Тест merge: update перекрывает поля; update с неизвестным id → warning, не исключение; `edit_token` в результате отсутствует.
- [ ] `[id].astro`: `getStaticPaths` только `status !== 'closed'`; первый абзац-ответ 40–60 слов из шаблона; контакты `tel:`/`t.me`; таблица параметров; блок дат только при `verified` и `checked_at` ≤ 21 дня; плашки «Проверено DD.MM» / «Обновлено лофтом» / «данные не проверены».
- [ ] JSON-LD: `EventVenue` (name, address, geo, telephone, maximumAttendeeCapacity), `BreadcrumbList`, `FAQPage` из 3 стандартных вопросов с подстановкой значений.
- [ ] Sitemap: `closed` исключены (`sitemap({ filter })`). Commit.

### Task 4: Калькулятор цены

**Files:**
- Create: `src/lib/price.ts`, `src/lib/price.test.ts`, `src/components/Calculator.tsx`

**Interfaces:**
- Produces: `estimate(loft: Loft, q: {people:number; hours:number; weekend:boolean; december:boolean; ownAlcohol:boolean}): {total:number; lines:{label:string; amount:number}[]; deposit:number; approx:boolean}`.

- [ ] Тесты: hours < min_hours → min_hours; weekend → `price_hour_weekend`; `corkage fee` + ownAlcohol → строка «пробковый сбор»; без ownAlcohol → нет; `candidate` → `approx: true` и только `price_hour_from × hours`; `new_year_surcharge '+30%'` + december → ×1.3.
- [ ] Реализация + Preact-островок с предзаполнением (30 чел, сб, 5 ч, декабрь). Commit.

### Task 5: Списки, фильтры, программные страницы

**Files:**
- Create: `src/lib/pages.ts`, `src/lib/pages.test.ts`, `src/pages/metro/[station].astro`, `src/pages/rayon/[district].astro`, `src/pages/dlya/[task].astro`, `src/pages/na/[n]-chelovek.astro`, `src/pages/dlya/[task]/[station].astro`, `src/pages/na/[n]-chelovek/[station].astro`, `src/pages/so-svoim-alkogolem.astro`, `src/pages/so-svoim-keyteringom.astro`, `src/pages/bez-zaloga.astro`, `src/components/LoftList.astro`, `src/components/Filters.tsx`

- [ ] Тест `programmaticPages(lofts)`: станция с 3 лофтами отсутствует; с 4 — присутствует; title содержит число лофтов и минимальную цену за вечер.
- [ ] Шаблон title: `{N} лофтов {где} на {n} человек: цена за вечер от {min} ₽ — LoftMap`.
- [ ] `Filters.tsx`: состояние в `location.hash`, фильтрует статический список по `data-*` атрибутам. Commit.

### Task 6: Главная, лендинг `/korporativ/`, исследование, GEO-файлы

**Files:**
- Create: `src/pages/index.astro` (переписать), `src/pages/korporativ.astro`, `src/pages/ceny/korporativ-2026.astro`, `src/pages/o-proekte.astro`, `src/pages/dlya-loftov.astro`, `public/llms.txt`, `src/pages/data/lofts.json.ts`, `src/lib/stats.ts`, `src/lib/stats.test.ts`

- [ ] Тест `stats(lofts)`: медиана `price_evening_30` по verified; группировка по вместимости и округу; пустая выборка → `null`, не NaN.
- [ ] `/korporativ/`: H1 из спека, таблица 20 verified по цене, калькулятор, FAQ (6) + FAQPage, ссылка на исследование.
- [ ] `/ceny/korporativ-2026/`: цифры из `stats`, методика, дата сборки, `Dataset` JSON-LD.
- [ ] `lofts.json.ts`: публичная выгрузка без `edit_token`/`notes`. `llms.txt` со ссылками на ключевые страницы. Commit.

### Task 7: Google: Site Verification, Search Console, GA4

**Files:**
- Create: `scripts/google/verify.py`, `scripts/google/gsc.py`, `docs/analytics-search.md`, Modify: `src/layouts/Base.astro` (gtag)

- [ ] `verify.py` (google-auth, SA `~/.config/fedrbodr/gsc-sa.json`): `webResource.getToken` для `sc-domain` → TXT; опубликовать TXT на reg.ru; `webResource.insert`; затем `webResource.update` с `owners += fedrbodr@gmail.com`.
- [ ] `gsc.py`: `PUT sites/sc-domain:loftmap.ru`, `PUT sitemaps/https://loftmap.ru/sitemap-index.xml`, GET статус.
- [ ] GA4: создать ресурс «LoftMap» (TZ Europe/Moscow, RUB) и web-поток `https://loftmap.ru` в UI; `measurementId` → `PUBLIC_GA_ID` в `.env`/CI; gtag в `Base.astro`; события `generate_lead`, `contact_click`, `price_calculated`; key event `generate_lead`.
- [ ] `docs/analytics-search.md`: ID ресурсов, даты, что подтверждено, что в ожидании.

### Task 8: Дашборд

**Files:**
- Create: `scripts/dashboard/build.py`, `docs/dashboard.md`

- [ ] Скрипт тянет GSC Search Analytics (клики/показы/топ-страницы/топ-запросы за 28 дней) и GA4 Data API (сессии, источники, посадочные, `generate_lead`) через SA → `dashboard/index.html` (статический, приватный Artifact или локальный файл), с датой обновления и часовым поясом.
- [ ] Looker Studio: ссылка-шаблон через Linking API на GSC+GA4 как альтернатива.

### Task 9: Форма заявки и правка карточки (после появления Cloudflare)

**Files:**
- Create: `workers/lead/src/index.ts`, `workers/edit/src/index.ts`, `src/pages/edit.astro`, `src/components/EditForm.tsx`, `src/components/LeadForm.tsx`

- [ ] Lead: POST JSON → Telegram Bot API `sendMessage` владельцу; honeypot-поле; 429 при > 10/мин с IP.
- [ ] Edit: GET `?t=` → данные лофта по токену (из приватного `data/private/tokens.json`, деплоится как секрет Worker'а); POST → валидация → `PUT /repos/.../contents/data/updates/<id>.json` → Pages пересобирается. Тест: неверный токен → 403.
- [ ] Шаблон ссылки правки добавить в `docs/call-script.md` после запуска.
