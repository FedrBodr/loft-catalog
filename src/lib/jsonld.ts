import type { Loft } from './data';

const SITE = 'https://loftmap.ru';

export const faqLd = (items: { q: string; a: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: items.map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a.replace(/<[^>]+>/g, '') } })),
});

export const breadcrumbLd = (crumbs: { name: string; path: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: SITE + c.path })),
});

export const venueLd = (l: Loft) => ({
  '@context': 'https://schema.org',
  '@type': 'EventVenue',
  name: l.name,
  url: `${SITE}/loft/${l.id}/`,
  address: { '@type': 'PostalAddress', streetAddress: l.address, addressLocality: 'Москва', addressCountry: 'RU' },
  geo: { '@type': 'GeoCoordinates', latitude: l.lat, longitude: l.lon },
  ...(l.phone ? { telephone: l.phone } : {}),
  ...(l.site ? { sameAs: l.site } : {}),
  ...(l.cap_standing || l.cap_seated ? { maximumAttendeeCapacity: Math.max(l.cap_standing ?? 0, l.cap_seated ?? 0) } : {}),
  ...(l.photos.length ? { image: l.photos } : {}),
  amenityFeature: [
    l.kitchen != null && { '@type': 'LocationFeatureSpecification', name: 'Кухня', value: l.kitchen },
    l.projector != null && { '@type': 'LocationFeatureSpecification', name: 'Проектор', value: l.projector },
    l.sound != null && { '@type': 'LocationFeatureSpecification', name: 'Звук', value: l.sound },
    l.parking != null && { '@type': 'LocationFeatureSpecification', name: 'Парковка', value: l.parking },
    l.corkage && { '@type': 'LocationFeatureSpecification', name: 'Свой алкоголь', value: l.corkage.kind !== 'no' },
  ].filter(Boolean),
});

export const itemListLd = (name: string, lofts: Loft[]) => ({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name,
  numberOfItems: lofts.length,
  itemListElement: lofts.slice(0, 50).map((l, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/loft/${l.id}/`, name: l.name })),
});

export const orgLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'LoftMap',
  url: SITE,
  logo: `${SITE}/favicon.svg`,
  description: 'Каталог всех лофтов Москвы с проверенными ценами и свободными датами. Без комиссии.',
});

export const datasetLd = (built: string, n: number) => ({
  '@context': 'https://schema.org',
  '@type': 'Dataset',
  name: 'Лофты Москвы: цены за вечер, вместимость, условия',
  description: `Открытый набор данных о ${n} лофтах Москвы: адрес, метро, вместимость, цена за вечер на 20 человек, минимум часов, залог, условия по алкоголю и кейтерингу.`,
  url: `${SITE}/ceny/korporativ-2026/`,
  license: 'https://creativecommons.org/licenses/by/4.0/',
  creator: { '@type': 'Organization', name: 'LoftMap', url: SITE },
  dateModified: built,
  distribution: [{ '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: `${SITE}/data/lofts.json` }],
});
