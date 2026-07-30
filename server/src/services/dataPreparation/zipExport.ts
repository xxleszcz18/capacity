import JSZip from 'jszip';
import { runDataPreparation, type DataPrepStats } from './fillEngine.js';

export type DataPreparationZipResult = {
  buffer: Buffer;
  filename: string;
  stats: DataPrepStats;
};

/** Uruchamia silnik i pakuje Input_S2102_S1619.xlsx + 2 CSV do ZIP. */
export async function generateDataPreparationZip(
  katowiceBuffer: Buffer,
  routingBuffer: Buffer,
  transitionBuffer: Buffer
): Promise<DataPreparationZipResult> {
  const result = await runDataPreparation(katowiceBuffer, routingBuffer, transitionBuffer);
  const zip = new JSZip();
  zip.file(result.xlsxFilename, result.xlsx);
  zip.file('raport_uzupelnienia.csv', result.fillReportCsv);
  zip.file('raport_rozbieznosci.csv', result.discrepancyCsv);
  const buffer = Buffer.from(await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
  return {
    buffer,
    filename: 'Data_preparation_S2102_S1619.zip',
    stats: result.stats,
  };
}

export type { DataPrepStats };
