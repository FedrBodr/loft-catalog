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
- Домен зарегистрирован 2026-10-12 01:31 UTC, делегирован в `.ru` ~03:20 UTC.
- HTTPS: три недели GitHub держал `dns_resolves: false` / `Dnsruby::ServFail` при верных
  DNS (резолвер GitHub, не наша сторона). 2026-11-02 health показал `dns_resolves: true`;
  после снятия и повторного добавления домена через API (`PUT .../pages -F cname=`, затем
  `-F cname=loftmap.ru`) сертификат Let's Encrypt выпущен за минуту, `https_enforced=true`.
  Рецепт на будущее: если cert «не выпускается», сначала смотреть `pages/health`.

## Данные каталога (2026-10-12, вечер)

- 1 967 кандидатов: loft2rent.ru — полный обход sitemap (1 760 площадок / 3 177 залов,
  взято 1 847 московских залов с телефоном, адресом, вместимостью, ставкой «от»);
  delispace.ru — 120 (адрес без дома, без телефона, контакт через источник). Подмосковье
  отфильтровано по названиям городов (`OBLAST` в parse_sources.py) и bbox.
- Геокодинг: Photon (komoot, 1 запрос/с, принимаем только совпавший дом и улицу) →
  Nominatim (резерв, при 429 пауза 10 мин) → координаты станции метро как медиана уже
  известных лофтов у этой станции (236 карточек, пометка в notes). Метро для 126 карточек
  без станции проставлено по ближайшему лофту (`scripts/import/fill_metro.py`, радиус
  1,2 км). У 42 карточек округ не определён → ЦАО с пометкой.
- Ключи API (локально, `~/.config/fedrbodr/`): 2ГИС демо-ключ `2gis.key` (Places +
  Geocoder, 1 000 запросов/мес каждый, до 2026-11-11, кабинет platform.2gis.ru, workspace
  loftmap.ru); Яндекс Геокодер `yandex-geocoder.key` (бесплатный тариф, кабинет
  yandex.ru/maps-api/console) — активировался примерно через час после создания, 1 000 запросов/сутки; `regeocode_2gis.py --yandex` уточнил ещё 14 карточек.
  `scripts/import/regeocode_2gis.py` уточнил координаты/округ у 240 карточек, которые
  стояли на станции метро; осталось 17 приблизительных и 24 без округа.
- Скрипты: `scripts/import/parse_sources.py` (HTML → candidates.json, карта URL
  `l2r/urls.txt`), `build_candidates.py` (геокодинг, дедуп, запись в CSV),
  `fill_metro.py`. Сырые страницы и кэш геокодера — в scratchpad, не в репо.
- Защита от фильтра за тонкий/дублирующий контент (2026-10-12): комбинации «задача × метро»
  и «вместимость × метро» (926 страниц) не генерируются (`COMBO_PAGES=false` в pages.ts);
  страницы `/dlya/<задача>/` — `noindex, follow` и вне sitemap, пока не фильтруют данные;
  404 — noindex; www и fedrbodr.github.io → 301 на loftmap.ru; canonical на всех страницах.
  В индекс идут: карточки (1 967), метро (104), округа (9), вместимость (6), 6 основных.
  Sitemap 2 092 URL. Включать комбинации обратно — когда появятся verified-данные.
- Страницы списков ограничены 240 карточками (`MAX_CARDS`), дальше блок «уточните по
  метро» (`MetroNav.astro`). Сборка: 3 024 страницы, sitemap 3 023 URL.
- Не взяты: bash.today и goloft.ru (нет адресов и прямых контактов, только метро и
  ставка), 2ГИС/Яндекс (нужен ключ API).

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

## Яндекс (включено 2026-11-03 по команде владельца)

- Метрика: счётчик **114034230** «LoftMap (loftmap.ru)», TZ Europe/Moscow. Цели типа
  JS-событие: `generate_lead` (678307022, «Заявка отправлена»), `contact_click`
  (678307023, «Клик по контакту лофта»). ID передаётся в сборку переменной GitHub Actions
  `PUBLIC_YM_ID`; тег в `src/layouts/Base.astro`, события шлёт `lmTrack` вместе с GA.
  Проверка: на странице `window.lmYM = 114034230`; статус кода в кабинете обновится
  после первых визитов.
- Вебмастер: хост `https:loftmap.ru:443` добавлен и подтверждён файлом
  `public/yandex_4c4948565030fbf8.html` (HTML_FILE, не удалять). Sitemap
  `sitemap-index.xml` есть в robots.txt; запись через API (`user-added-sitemaps`,
  `recrawl/queue`) в день подключения отвечала 504, повторять позже. Токен
  `~/.config/fedrbodr/webmaster.token` (user_id 287569571); `yandex-webmaster.token`
  протух, не использовать.

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
- Вебмастер: добавить sitemap и переобход через API, когда перестанет отвечать 504.
