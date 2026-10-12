Project: loft-catalog
Document: analytics-search

# Запуск loftmap.ru: хостинг, аналитика, поиск

Обновлено 2026-10-12.

## Хостинг и DNS

- Репо `FedrBodr/loft-catalog` (public), GitHub Pages через `.github/workflows/deploy.yml`
  (push в `main` → `npm test` → `astro build` → Pages). Custom domain `loftmap.ru`
  (`public/CNAME`, настройка Pages `cname=loftmap.ru`).
- DNS на reg.ru (ns1/ns2.reg.ru): A `@` → 185.199.108/109/110/111.153; CNAME `www` →
  `fedrbodr.github.io`; TXT `@` google-site-verification (DNS-подтверждение домена).
- Домен зарегистрирован 2026-10-12 01:31 UTC, делегирован в `.ru` ~03:20 UTC; HTTP
  работает. HTTPS: сертификат GitHub выпускает после делегирования; `https_enforced`
  включить, когда `curl -I https://loftmap.ru/` ответит 200
  (`gh api -X PUT repos/FedrBodr/loft-catalog/pages -F https_enforced=true`).

## Данные каталога (2026-10-12)

- 290 кандидатов из открытых источников: loft2rent.ru (180, с телефонами, адресами,
  вместимостью, ставкой «от») и delispace.ru (127, адрес без номера дома, без телефона —
  контакт через площадку-источник до проверки). Скрипты: `scripts/import/parse_sources.py`
  (HTML → candidates.json) и `scripts/import/build_candidates.py` (Nominatim-геокодинг,
  округ по району, дедуп, запись в `data/lofts.csv`). Сырые страницы и кэш геокодера —
  в scratchpad, не в репо.
- Не взяты: bash.today (API без публичной схемы), goloft (ссылки на карточки не
  отдаются без JS), 2ГИС/Яндекс (нужен ключ API). Overpass OSM отвечал 406.

## Google Analytics 4

- Аккаунт GA 408932779 (fedrbodrlain@gmail.com), ресурс **LoftMap (loftmap.ru)**,
  `properties/558431834`, TZ Europe/Moscow, RUB.
- Web-поток 16109139316, `https://loftmap.ru`, Measurement ID **G-XC5JXPCYE0**.
  Передаётся в сборку переменной GitHub Actions `PUBLIC_GA_ID`; тег gtag в
  `src/layouts/Base.astro`.
- События сайта: `generate_lead` (форма заявки, после успешной отправки или открытия
  Telegram), `contact_click` (клик по телефону/Telegram/WhatsApp, параметр `loft`),
  `price_calculated` (изменение калькулятора). Имена общие для GA и Метрики (`lmTrack`).
- Key event `generate_lead`: **ожидает** — в новом UI GA пометить можно только после
  первого полученного события (Admin → Events → звёздочка).
- Сервисный аккаунт `indexing@fedrbodr-indexing.iam.gserviceaccount.com` добавлен как
  Viewer на ресурс (для дашборда). APIs включены в проекте `fedrbodr-indexing`:
  analyticsadmin, analyticsdata, searchconsole, siteverification.

## Search Console

- Скрипт `scripts/google/verify.py` (SA): `token` → TXT; `verify` → подтверждение
  `sc-domain:loftmap.ru` + добавление владельца fedrbodr@gmail.com; `gsc` → добавление
  сайта и sitemap `https://loftmap.ru/sitemap-index.xml`; `status`.
- Состояние: TXT опубликован на reg.ru; верификация **ожидает** делегирования домена
  (фоновый монитор повторяет `verify` + `gsc` автоматически).

## Яндекс (отложено по решению владельца 2026-10-12)

- Метрика: API отвечает, счётчик не создавался. Создать: `metrika.py POST
  /management/v1/counters` с `site2.site=loftmap.ru`, цели `generate_lead`,
  `contact_click`; ID → переменная `PUBLIC_YM_ID` (тег уже в Base.astro).
- Вебмастер: добавить хост, DNS/meta-подтверждение, sitemap. Скрипт по аналогии с
  verify.py через `~/.config/fedrbodr/webmaster.token`.

## Дашборд

- `scripts/dashboard/build.py` → `dashboard/index.html` (в .gitignore): KPI, сессии по
  дням, источники, посадочные, события (GA4 Data API) + клики/показы/запросы/страницы
  (Search Console) за 28 дней, статус sitemap. Запуск: `.venv/bin/python
  scripts/dashboard/build.py`. Публиковать как приватный Artifact по запросу.
- Проверено 2026-10-12: GA4 читается (0 сессий — сайт ещё не в DNS); GSC вернёт
  данные после добавления сайта.

## Что ещё не сделано

- Формы заявки/правки сейчас работают через fallback: заявка открывает Telegram
  владельца с готовым текстом (`PUBLIC_OWNER_TG`, по умолчанию `fedrbodr` — заменить
  на реальный ник). Worker'ы (§7.1 спека) — после появления Cloudflare/VPS.
- Метрика и Вебмастер — по команде владельца.
