import { deflateRawSync, inflateRawSync } from 'zlib';

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;
const SIG_DATA_DESC = 0x08074b50;

function crc32(buf: Buffer): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]!;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}

export type ZipCdEntry = {
  name: string;
  versionMadeBy: number;
  versionNeeded: number;
  gpFlag: number;
  method: number;
  modTime: number;
  modDate: number;
  crc: number;
  compressedSize: number;
  uncompressedSize: number;
  internalAttr: number;
  externalAttr: number;
  localHeaderOffset: number;
  centralExtra: Buffer;
  comment: Buffer;
  /** Pełny lokalny rekord (nagłówek + extra + skompresowane dane [+ data descriptor]). */
  localRecord: Buffer;
};

function findEocd(buf: Buffer): number {
  // EOCD: 22 bytes + comment; skan od końca z walidacją (unikaj fałszywych PK\x05\x06 w binariach).
  const maxComment = 0xffff;
  const start = Math.max(0, buf.length - (22 + maxComment));
  for (let i = buf.length - 22; i >= start; i--) {
    if (buf.readUInt32LE(i) !== SIG_EOCD) continue;
    const commentLen = buf.readUInt16LE(i + 20);
    if (i + 22 + commentLen !== buf.length) continue;
    const cdEntries = buf.readUInt16LE(i + 10);
    const cdSize = buf.readUInt32LE(i + 12);
    const cdOffset = buf.readUInt32LE(i + 16);
    if (cdOffset === 0xffffffff || cdSize === 0xffffffff || cdEntries === 0xffff) {
      // ZIP64 — lokalizator tuż przed EOCD
      const zip64Locator = i - 20;
      if (zip64Locator < 0 || buf.readUInt32LE(zip64Locator) !== 0x07064b50) {
        continue;
      }
      const zip64EocdOffset = Number(buf.readBigUInt64LE(zip64Locator + 8));
      if (buf.readUInt32LE(zip64EocdOffset) !== 0x06064b50) continue;
      return i; // caller handles via ZIP64 extras on entries; cd read uses zip64 eocd below
    }
    if (cdOffset >= buf.length || cdOffset + Math.min(cdSize, 4) > buf.length) continue;
    if (buf.readUInt32LE(cdOffset) !== SIG_CENTRAL) continue;
    return i;
  }
  throw new Error('ZIP: nie znaleziono EOCD.');
}

function readCdStart(buf: Buffer, eocd: number): { cdOffset: number; cdEntries: number; comment: Buffer } {
  const commentLen = buf.readUInt16LE(eocd + 20);
  const comment = buf.subarray(eocd + 22, eocd + 22 + commentLen);
  let cdOffset = buf.readUInt32LE(eocd + 16);
  let cdEntries = buf.readUInt16LE(eocd + 10);

  if (cdOffset === 0xffffffff || cdEntries === 0xffff) {
    const zip64Locator = eocd - 20;
    if (buf.readUInt32LE(zip64Locator) !== 0x07064b50) {
      throw new Error('ZIP: brak ZIP64 locator.');
    }
    const zip64EocdOffset = Number(buf.readBigUInt64LE(zip64Locator + 8));
    if (buf.readUInt32LE(zip64EocdOffset) !== 0x06064b50) {
      throw new Error('ZIP: uszkodzony ZIP64 EOCD.');
    }
    cdEntries = Number(buf.readBigUInt64LE(zip64EocdOffset + 32));
    cdOffset = Number(buf.readBigUInt64LE(zip64EocdOffset + 48));
  }

  return { cdOffset, cdEntries, comment };
}

/** Odczytuje wpisy ZIP z zachowaniem surowych lokalnych rekordów (dla copy-through). */
export function readZipEntries(buf: Buffer): { entries: ZipCdEntry[]; comment: Buffer } {
  const eocd = findEocd(buf);
  const { cdOffset, cdEntries, comment } = readCdStart(buf, eocd);

  const entries: ZipCdEntry[] = [];
  let off = cdOffset;
  for (let i = 0; i < cdEntries; i++) {
    if (off + 46 > buf.length || buf.readUInt32LE(off) !== SIG_CENTRAL) {
      throw new Error(`ZIP: uszkodzony central directory @${off}`);
    }
    const versionMadeBy = buf.readUInt16LE(off + 4);
    const versionNeeded = buf.readUInt16LE(off + 6);
    const gpFlag = buf.readUInt16LE(off + 8);
    const method = buf.readUInt16LE(off + 10);
    const modTime = buf.readUInt16LE(off + 12);
    const modDate = buf.readUInt16LE(off + 14);
    const crc = buf.readUInt32LE(off + 16);
    let compressedSize = buf.readUInt32LE(off + 20);
    let uncompressedSize = buf.readUInt32LE(off + 24);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentEntryLen = buf.readUInt16LE(off + 32);
    const internalAttr = buf.readUInt16LE(off + 36);
    const externalAttr = buf.readUInt32LE(off + 38);
    let localHeaderOffset = buf.readUInt32LE(off + 42);
    const name = buf.subarray(off + 46, off + 46 + nameLen).toString('utf8');
    const centralExtra = Buffer.from(buf.subarray(off + 46 + nameLen, off + 46 + nameLen + extraLen));
    const entryComment = Buffer.from(
      buf.subarray(off + 46 + nameLen + extraLen, off + 46 + nameLen + extraLen + commentEntryLen)
    );

    // ZIP64 extra (0x0001) — gdy rozmiary / offset = 0xFFFFFFFF
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localHeaderOffset === 0xffffffff) {
      let x = 0;
      while (x + 4 <= centralExtra.length) {
        const id = centralExtra.readUInt16LE(x);
        const sz = centralExtra.readUInt16LE(x + 2);
        if (id === 0x0001) {
          let p = x + 4;
          if (uncompressedSize === 0xffffffff) {
            uncompressedSize = Number(centralExtra.readBigUInt64LE(p));
            p += 8;
          }
          if (compressedSize === 0xffffffff) {
            compressedSize = Number(centralExtra.readBigUInt64LE(p));
            p += 8;
          }
          if (localHeaderOffset === 0xffffffff) {
            localHeaderOffset = Number(centralExtra.readBigUInt64LE(p));
          }
          break;
        }
        x += 4 + sz;
      }
    }

    if (localHeaderOffset + 30 > buf.length || buf.readUInt32LE(localHeaderOffset) !== SIG_LOCAL) {
      throw new Error(`ZIP: zły local header dla ${name} @${localHeaderOffset}`);
    }
    const locNameLen = buf.readUInt16LE(localHeaderOffset + 26);
    const locExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + locNameLen + locExtraLen;
    const hasDescriptor = (gpFlag & 0x8) !== 0;
    let descriptorLen = 0;
    if (hasDescriptor) {
      const after = dataStart + compressedSize;
      descriptorLen = after + 4 <= buf.length && buf.readUInt32LE(after) === SIG_DATA_DESC ? 16 : 12;
    }
    const localEnd = dataStart + compressedSize + descriptorLen;
    if (localEnd > buf.length) {
      throw new Error(`ZIP: lokalny rekord poza plikiem (${name})`);
    }
    const localRecord = Buffer.from(buf.subarray(localHeaderOffset, localEnd));

    entries.push({
      name,
      versionMadeBy,
      versionNeeded,
      gpFlag,
      method,
      modTime,
      modDate,
      crc,
      compressedSize,
      uncompressedSize,
      internalAttr,
      externalAttr,
      localHeaderOffset,
      centralExtra,
      comment: entryComment,
      localRecord,
    });

    off += 46 + nameLen + extraLen + commentEntryLen;
  }

  return { entries, comment };
}

export function inflateZipEntry(entry: ZipCdEntry): Buffer {
  const locNameLen = entry.localRecord.readUInt16LE(26);
  const locExtraLen = entry.localRecord.readUInt16LE(28);
  const dataStart = 30 + locNameLen + locExtraLen;
  const compressed = entry.localRecord.subarray(dataStart, dataStart + entry.compressedSize);
  if (entry.method === 0) return Buffer.from(compressed);
  if (entry.method === 8) return inflateRawSync(compressed);
  throw new Error(`ZIP: nieobsługiwana kompresja ${entry.method} (${entry.name})`);
}

function buildLocalRecord(
  name: string,
  data: Buffer,
  meta: Pick<ZipCdEntry, 'versionNeeded' | 'modTime' | 'modDate' | 'gpFlag'>
): { record: Buffer; crc: number; compressedSize: number; uncompressedSize: number; method: number; gpFlag: number } {
  const nameBuf = Buffer.from(name, 'utf8');
  const compressed = deflateRawSync(data, { level: 6 });
  const crc = crc32(data);
  const gpFlag = meta.gpFlag & ~0x8; // bez data descriptor
  const method = 8;
  const header = Buffer.alloc(30);
  header.writeUInt32LE(SIG_LOCAL, 0);
  header.writeUInt16LE(meta.versionNeeded || 20, 4);
  header.writeUInt16LE(gpFlag, 6);
  header.writeUInt16LE(method, 8);
  header.writeUInt16LE(meta.modTime, 10);
  header.writeUInt16LE(meta.modDate, 12);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(compressed.length, 18);
  header.writeUInt32LE(data.length, 22);
  header.writeUInt16LE(nameBuf.length, 26);
  header.writeUInt16LE(0, 28); // no extra
  return {
    record: Buffer.concat([header, nameBuf, compressed]),
    crc,
    compressedSize: compressed.length,
    uncompressedSize: data.length,
    method,
    gpFlag,
  };
}

/** Podmienia wskazane pliki w ZIP; pozostałe wpisy kopiowane bitowo (Excel-safe). */
export function rewriteZipEntries(input: Buffer, replacements: Map<string, Buffer>): Buffer {
  const { entries, comment } = readZipEntries(input);
  const localParts: Buffer[] = [];
  const updated: ZipCdEntry[] = [];
  let offset = 0;

  for (const entry of entries) {
    const repl = replacements.get(entry.name);
    let next: ZipCdEntry;
    if (repl) {
      const built = buildLocalRecord(entry.name, repl, entry);
      next = {
        ...entry,
        method: built.method,
        gpFlag: built.gpFlag,
        crc: built.crc,
        compressedSize: built.compressedSize,
        uncompressedSize: built.uncompressedSize,
        localHeaderOffset: offset,
        localRecord: built.record,
        centralExtra: Buffer.alloc(0),
      };
    } else {
      next = { ...entry, localHeaderOffset: offset, localRecord: entry.localRecord };
    }
    localParts.push(next.localRecord);
    updated.push(next);
    offset += next.localRecord.length;
  }

  const cdParts: Buffer[] = [];
  const cdOffset = offset;
  for (const entry of updated) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const extra = entry.centralExtra;
    const cmt = entry.comment;
    const hdr = Buffer.alloc(46);
    hdr.writeUInt32LE(SIG_CENTRAL, 0);
    hdr.writeUInt16LE(entry.versionMadeBy, 4);
    hdr.writeUInt16LE(entry.versionNeeded, 6);
    hdr.writeUInt16LE(entry.gpFlag, 8);
    hdr.writeUInt16LE(entry.method, 10);
    hdr.writeUInt16LE(entry.modTime, 12);
    hdr.writeUInt16LE(entry.modDate, 14);
    hdr.writeUInt32LE(entry.crc, 16);
    hdr.writeUInt32LE(entry.compressedSize, 20);
    hdr.writeUInt32LE(entry.uncompressedSize, 24);
    hdr.writeUInt16LE(nameBuf.length, 28);
    hdr.writeUInt16LE(extra.length, 30);
    hdr.writeUInt16LE(cmt.length, 32);
    hdr.writeUInt16LE(0, 34); // disk start
    hdr.writeUInt16LE(entry.internalAttr, 36);
    hdr.writeUInt32LE(entry.externalAttr, 38);
    hdr.writeUInt32LE(entry.localHeaderOffset, 42);
    cdParts.push(Buffer.concat([hdr, nameBuf, extra, cmt]));
  }
  const cd = Buffer.concat(cdParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(SIG_EOCD, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(updated.length, 8);
  eocd.writeUInt16LE(updated.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  eocd.writeUInt16LE(comment.length, 20);

  return Buffer.concat([...localParts, cd, eocd, comment]);
}
