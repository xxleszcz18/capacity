import fs from 'fs';
import {
  parseRoutingBuffer,
  findShallowestMatches,
  parseEuNumber,
  parseDimensions,
  isS2102Formatka,
} from '../src/services/dataPreparation/index.ts';

const buf = fs.readFileSync('c:/Users/lniemczy/Downloads/routing.txt');
const idx = parseRoutingBuffer(buf);
console.log('materialsWithDesc', idx.materialsWithDesc);
console.log('materialsWithComponents', idx.materialsWithComponents);

const m1 = findShallowestMatches(idx, '106220230105', 'S2102');
console.log(
  '106220230105 count',
  m1.length,
  m1.map((x) => `${x.materialNumber} ${x.length}x${x.width} @${x.bfsLevel}`)
);

const m2 = findShallowestMatches(idx, '106673340103', 'S2102');
console.log(
  '106673340103 count',
  m2.length,
  m2.map((x) => `${x.materialNumber} L${x.bfsLevel} ${x.description}`)
);

console.log('eu', parseEuNumber('1.000,000'), parseEuNumber('0,500'));
console.log(
  'dim',
  parseDimensions('S2102 4.5kg 1F 2100x1250 /A07A'),
  'phantom',
  isS2102Formatka('S2102 HL KAT Phantom')
);
