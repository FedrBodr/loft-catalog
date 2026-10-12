// Проверка data/private/lofts.csv (+ updates/) перед сборкой. Падает при ошибках.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readCsv, readUpdates, mergeUpdates, validateLofts, DATA } from '../src/lib/data.ts';

if (!existsSync(join(DATA, 'lofts.csv'))) {
  console.error('❌ нет data/private/lofts.csv: git clone git@github.com:FedrBodr/loft-catalog-data.git data/private');
  process.exit(1);
}

const rows = mergeUpdates(readCsv(join(DATA, 'lofts.csv')), readUpdates(join(DATA, 'updates')));
const errors = validateLofts(rows);
if (errors.length) {
  console.error(`❌ ${errors.length} ошибок в data/private/lofts.csv:\n` + errors.map((e) => '  ' + e).join('\n'));
  process.exit(1);
}
const verified = rows.filter((r) => r.status === 'verified').length;
console.log(`✓ lofts.csv: ${rows.length} лофтов, из них verified ${verified}`);
