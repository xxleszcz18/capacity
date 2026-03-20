import { initDb, saveDb } from './connection.js';

async function main() {
  await initDb();
  saveDb();
  console.log('Migrations complete.');
}
main().catch((e) => { console.error(e); process.exit(1); });
