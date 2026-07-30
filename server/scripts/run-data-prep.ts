import fs from 'fs';
import path from 'path';
import { runDataPreparation } from '../src/services/dataPreparation/index.ts';

async function main() {
  const downloads = 'c:/Users/lniemczy/Downloads';
  const katowice = fs.readFileSync(path.join(downloads, 'Katowice_Data (2).xlsm'));
  const routing = fs.readFileSync(path.join(downloads, 'routing.txt'));
  const transition = fs.readFileSync(path.join(downloads, 'Tabela przejścia .xlsx'));

  console.log('sizes MB', {
    katowice: +(katowice.length / 1e6).toFixed(1),
    routing: +(routing.length / 1e6).toFixed(1),
    transition: +(transition.length / 1e3).toFixed(1) + 'KB',
  });

  const t0 = Date.now();
  const result = await runDataPreparation(katowice, routing, transition);
  console.log('elapsed_s', ((Date.now() - t0) / 1000).toFixed(1));
  console.log(JSON.stringify(result.stats, null, 2));

  const outDir = path.join(process.cwd(), 'tmp-data-prep');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, result.xlsxFilename), result.xlsx);
  fs.writeFileSync(path.join(outDir, 'raport_uzupelnienia.csv'), result.fillReportCsv);
  fs.writeFileSync(path.join(outDir, 'raport_rozbieznosci.csv'), result.discrepancyCsv);
  console.log('wrote', outDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
