// Проверка data/lofts.csv (+ data/updates) перед сборкой. Падает при ошибках.
import { readCsv, readUpdates, mergeUpdates, validateLofts } from '../src/lib/data.ts';

const rows = mergeUpdates(readCsv('data/lofts.csv'), readUpdates('data/updates'));
const errors = validateLofts(rows);
if (errors.length) {
  console.error(`❌ ${errors.length} ошибок в data/lofts.csv:\n` + errors.map((e) => '  ' + e).join('\n'));
  process.exit(1);
}
const verified = rows.filter((r) => r.status === 'verified').length;
console.log(`✓ lofts.csv: ${rows.length} лофтов, из них verified ${verified}`);
