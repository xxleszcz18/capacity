import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cropImageToDataUrl, loadImageFromDataUrl } from './captureChartImage';
import type { AnalyticsRow } from './capacityTrends';
import { buildTrendTableWithDeltas, deltaPp, fmtDeltaPp, fmtPctCell, type TrendTableBuildOptions } from './capacityTrends';
import type { Locale } from '../i18n/types';
import {
  linesOverviewLabels,
  localeDateTime,
  pdfAnalyticsHeaders,
  pdfTrendHeaders,
  type DataVizPdfStrings,
} from '../i18n/reportLabels';
import { pdfSafe } from './pdfText';

export type VisualizationPdfSection = {
  title: string;
  headers: string[];
  rows: string[][];
};

export type PdfChartImage = {
  title: string;
  dataUrl: string;
  blockType?: 'chart' | 'table' | 'chrome';
};

export type PdfChartPart = {
  partTitle: string;
  images: PdfChartImage[];
  /** Układ wielu wykresów w wierszu (tryb zaawansowany). */
  gridCols?: 1 | 2 | 3;
};

export type VisualizationPdfInput = {
  locale: Locale;
  strings: DataVizPdfStrings;
  yearFrom: number;
  yearTo: number;
  machineStatusLabel: string;
  machineTypeLabel: string;
  clientLabel: string;
  scenarioName: string | null;
  seriesLabels: string[];
  lineSections: VisualizationPdfSection[];
  machineSections: VisualizationPdfSection[];
  analyticsSection?: VisualizationPdfSection & {
    avgProduction: number | null;
    avgContract: number | null;
    avgScenarioProduction?: number | null;
  };
  linesOverview?: VisualizationPdfSection;
  chartParts?: PdfChartPart[];
  /** Zrzut aktualnego widoku (tryb „jak na ekranie”). */
  viewCapture?: PdfChartPart;
};

async function fetchPdfLogoDataUrl(): Promise<string | null> {
  try {
    const base = String(import.meta.env.BASE_URL || '/');
    const prefix = base.endsWith('/') ? base : `${base}/`;
    const res = await fetch(`${prefix}logo-autoneum.png`);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function addPdfHeaderLogo(doc: jsPDF, logoDataUrl: string | null) {
  if (!logoDataUrl) return;
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 36;
  const logoW = 112;
  const logoH = 26;
  doc.addImage(logoDataUrl, 'PNG', pageW - margin - logoW, 12, logoW, logoH);
}

function tableLayout(doc: jsPDF, headers: string[]) {
  const margin = 40;
  const pageW = doc.internal.pageSize.getWidth();
  const tableW = Math.max(200, pageW - 2 * margin);
  const colCount = headers.length;
  const columnStyles: Record<string, { cellWidth: number; halign: 'left' | 'center'; valign?: 'middle' }> = {};
  const h0 = pdfSafe(headers[0]).toLowerCase();

  /** Przeglad linii: Linia | Rok | Prod | Kontr | Roznica | Scen */
  if (h0 === 'linia' && colCount >= 3 && pdfSafe(headers[1]).toLowerCase() === 'rok') {
    const fixed = [52, 38];
    let used = fixed[0] + fixed[1];
    columnStyles['0'] = { cellWidth: fixed[0], halign: 'left', valign: 'middle' };
    columnStyles['1'] = { cellWidth: fixed[1], halign: 'center', valign: 'middle' };
    const restW = Math.max(44, (tableW - used) / Math.max(1, colCount - 2));
    for (let i = 2; i < colCount; i++) {
      columnStyles[String(i)] = { cellWidth: restW, halign: 'center', valign: 'middle' };
      used += restW;
    }
    return { margin, tableWidth: tableW, columnStyles };
  }

  /** Tabela trendu / analityki: Rok + kilka serii */
  if (h0 === 'rok' && colCount <= 10) {
    columnStyles['0'] = { cellWidth: 42, halign: 'left', valign: 'middle' };
    const restW = Math.max(56, (tableW - 42) / Math.max(1, colCount - 1));
    for (let i = 1; i < colCount; i++) {
      columnStyles[String(i)] = { cellWidth: restW, halign: 'center', valign: 'middle' };
    }
    return { margin, tableWidth: tableW, columnStyles };
  }

  const firstColW = Math.min(64, Math.max(48, tableW * 0.14));
  const restW = Math.max(40, (tableW - firstColW) / Math.max(1, colCount - 1));
  columnStyles['0'] = { cellWidth: firstColW, halign: 'left', valign: 'middle' };
  for (let i = 1; i < colCount; i++) {
    columnStyles[String(i)] = { cellWidth: restW, halign: 'center', valign: 'middle' };
  }
  return { margin, tableWidth: tableW, columnStyles };
}

function drawSectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(pdfSafe(title), 40, y);
  doc.setFont('helvetica', 'normal');
  return y + 16;
}

function ensureSpace(doc: jsPDF, logo: string | null, y: number, need: number): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + need > pageH - 36) {
    doc.addPage();
    addPdfHeaderLogo(doc, logo);
    return 44;
  }
  return y;
}

async function drawSplittableImage(
  doc: jsPDF,
  logo: string | null,
  startY: number,
  img: PdfChartImage,
  continuedLabel: string
): Promise<number> {
  const margin = 40;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const maxW = pageW - 2 * margin;
  const bottomReserve = 36;
  const format = img.dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';

  const imgEl = await loadImageFromDataUrl(img.dataUrl);
  const fullDisplayH = maxW * (imgEl.height / imgEl.width);

  let y = startY;
  let sy = 0;
  let partIdx = 0;

  while (sy < imgEl.height) {
    const titleH = img.title ? (partIdx === 0 ? 12 : 10) : 0;
    let availableH = pageH - y - bottomReserve - titleH;

    if (availableH < 48) {
      doc.addPage();
      addPdfHeaderLogo(doc, logo);
      y = 44;
      availableH = pageH - y - bottomReserve - titleH;
    }

    const remainingSrcH = imgEl.height - sy;
    const remainingDisplayH = maxW * (remainingSrcH / imgEl.width);

    let sliceSrcH: number;
    let sliceDisplayH: number;

    if (remainingDisplayH <= availableH) {
      sliceSrcH = remainingSrcH;
      sliceDisplayH = remainingDisplayH;
    } else {
      sliceDisplayH = availableH;
      sliceSrcH = Math.max(1, Math.floor(imgEl.height * (sliceDisplayH / fullDisplayH)));
      sliceDisplayH = maxW * (sliceSrcH / imgEl.width);
    }

    if (img.title) {
      doc.setFontSize(partIdx === 0 ? 10 : 9);
      doc.setFont('helvetica', partIdx === 0 ? 'bold' : 'italic');
      doc.text(pdfSafe(partIdx === 0 ? img.title : `${img.title} ${continuedLabel}`), margin, y);
      doc.setFont('helvetica', 'normal');
      y += titleH;
    }

    const sliceUrl = cropImageToDataUrl(imgEl, sy, sliceSrcH);
    doc.addImage(sliceUrl, format, margin, y, maxW, sliceDisplayH);
    y += sliceDisplayH + 16;
    sy += sliceSrcH;
    partIdx++;
  }

  return y;
}

/** Wykres zawsze na jednej stronie — ewentualnie skalowany w dół, bez dzielenia. */
async function drawWholeImage(doc: jsPDF, logo: string | null, startY: number, img: PdfChartImage): Promise<number> {
  const margin = 40;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const maxW = pageW - 2 * margin;
  const bottomReserve = 36;
  const format = img.dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
  const titleH = img.title ? 14 : 0;
  const pageTop = 44;
  const maxFullPageImgH = pageH - pageTop - bottomReserve - titleH;

  const imgEl = await loadImageFromDataUrl(img.dataUrl);
  let imgW = maxW;
  let imgH = maxW * (imgEl.height / imgEl.width);

  if (imgH > maxFullPageImgH) {
    imgH = maxFullPageImgH;
    imgW = maxFullPageImgH * (imgEl.width / imgEl.height);
  }

  let y = startY;
  if (y + titleH + imgH + 16 > pageH - bottomReserve) {
    doc.addPage();
    addPdfHeaderLogo(doc, logo);
    y = pageTop;
  }

  if (img.title) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(pdfSafe(img.title), margin, y);
    doc.setFont('helvetica', 'normal');
    y += 12;
  }

  const x = margin + (maxW - imgW) / 2;
  doc.addImage(img.dataUrl, format, x, y, imgW, imgH);
  return y + imgH + 16;
}

async function drawChartImage(doc: jsPDF, logo: string | null, startY: number, img: PdfChartImage, continuedLabel: string): Promise<number> {
  if (img.blockType === 'table') {
    return drawSplittableImage(doc, logo, startY, img, continuedLabel);
  }
  return drawWholeImage(doc, logo, startY, img);
}

async function drawChartGrid(
  doc: jsPDF,
  logo: string | null,
  startY: number,
  images: PdfChartImage[],
  gridCols: 2 | 3
): Promise<number> {
  const margin = 40;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const gap = 10;
  const cellW = (pageW - 2 * margin - gap * (gridCols - 1)) / gridCols;
  const bottomReserve = 36;

  let y = startY;
  const propsList = images.map((img) => doc.getImageProperties(img.dataUrl));
  const titleBlock = (idx: number) => {
    const titleLines = images[idx].title ? doc.splitTextToSize(pdfSafe(images[idx].title), cellW).length : 0;
    return titleLines ? titleLines * 10 + 4 : 0;
  };

  let rowMaxH = 0;
  const rowLayout: { img: PdfChartImage; x: number; imgW: number; imgH: number; titleBlock: number }[] = [];

  for (let c = 0; c < images.length; c++) {
    const img = images[c];
    const x = margin + c * (cellW + gap);
    const props = propsList[c];
    const tb = titleBlock(c);
    let imgW = cellW;
    let imgH = cellW * (props.height / props.width);
    rowLayout.push({ img, x, imgW, imgH, titleBlock: tb });
    rowMaxH = Math.max(rowMaxH, tb + imgH);
  }

  const maxRowH = pageH - 44 - bottomReserve;
  if (rowMaxH > maxRowH) {
    const maxTitle = Math.max(...rowLayout.map((r) => r.titleBlock), 0);
    const maxImgH = Math.max(...rowLayout.map((r) => r.imgH), 1);
    const imgScale = Math.min(1, (maxRowH - maxTitle) / maxImgH);
    if (imgScale < 1) {
      for (const item of rowLayout) {
        item.imgH *= imgScale;
        item.imgW *= imgScale;
      }
      rowMaxH = Math.max(...rowLayout.map((r) => r.titleBlock + r.imgH));
    }
  }

  if (y + rowMaxH + 12 > pageH - bottomReserve) {
    doc.addPage();
    addPdfHeaderLogo(doc, logo);
    y = 44;
  }

  for (const { img, x, imgW, imgH, titleBlock: tb } of rowLayout) {
    let cellY = y;
    if (img.title) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      const titleText = doc.splitTextToSize(pdfSafe(img.title), cellW);
      doc.text(titleText, x, cellY);
      doc.setFont('helvetica', 'normal');
      cellY += tb;
    }
    const format = img.dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
    doc.addImage(img.dataUrl, format, x, cellY, imgW, imgH);
  }

  return y + rowMaxH + 16;
}

async function drawViewCapturePart(
  doc: jsPDF,
  logo: string | null,
  startY: number,
  part: PdfChartPart,
  continuedLabel: string
): Promise<number> {
  if (!part.images.length) return startY;
  let y = drawSectionTitle(doc, part.partTitle, startY);
  const gridCols = part.gridCols ?? 1;

  const chartImages = part.images.filter((img) => img.blockType === 'chart');
  const tableImages = part.images.filter((img) => img.blockType === 'table');

  if (gridCols > 1 && chartImages.length > 0) {
    for (let ri = 0; ri < chartImages.length; ri += gridCols) {
      const row = chartImages.slice(ri, ri + gridCols);
      y = await drawChartGrid(doc, logo, y, row, gridCols === 3 ? 3 : 2);
    }
  } else {
    for (const img of chartImages) {
      y = await drawWholeImage(doc, logo, y, img);
    }
  }

  for (const table of tableImages) {
    doc.addPage();
    addPdfHeaderLogo(doc, logo);
    y = 44;

    const tableEl = await loadImageFromDataUrl(table.dataUrl);
    const margin = 40;
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const maxW = pageW - 2 * margin;
    const titleH = table.title ? 14 : 0;
    const maxFullPageImgH = pageH - 44 - 36 - titleH;
    const naturalH = maxW * (tableEl.height / tableEl.width);

    if (naturalH <= maxFullPageImgH * 1.02) {
      y = await drawWholeImage(doc, logo, y, table);
    } else {
      y = await drawSplittableImage(doc, logo, y, table, continuedLabel);
    }
  }

  return y;
}

async function drawChartPart(doc: jsPDF, logo: string | null, startY: number, part: PdfChartPart, continuedLabel: string): Promise<number> {
  if (!part.images.length) return startY;
  const hasViewBlocks = part.images.some((img) => img.blockType != null);
  if (hasViewBlocks) {
    return drawViewCapturePart(doc, logo, startY, part, continuedLabel);
  }

  let y = drawSectionTitle(doc, part.partTitle, startY);
  y = ensureSpace(doc, logo, y, 40);

  const gridCols = part.gridCols ?? 1;
  if (gridCols > 1 && part.images.length > 1) {
    let yGrid = y;
    for (let ri = 0; ri < part.images.length; ri += gridCols) {
      const row = part.images.slice(ri, ri + gridCols);
      yGrid = await drawChartGrid(doc, logo, yGrid, row, gridCols === 3 ? 3 : 2);
    }
    return yGrid;
  }

  for (const img of part.images) {
    y = await drawChartImage(doc, logo, y, img, continuedLabel);
  }
  return y;
}

function drawTable(
  doc: jsPDF,
  logo: string | null,
  startY: number,
  section: VisualizationPdfSection
): number {
  const head = [section.headers.map((h) => pdfSafe(h))];
  const body = section.rows.map((row) => row.map((c) => pdfSafe(c)));
  const layout = tableLayout(doc, section.headers);
  autoTable(doc, {
    startY,
    margin: { left: layout.margin, right: layout.margin },
    tableWidth: layout.tableWidth,
    head,
    body,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 4,
      lineColor: [224, 224, 224],
      lineWidth: 0.1,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      fontSize: 8,
      overflow: 'linebreak',
      minCellHeight: 16,
    },
    columnStyles: layout.columnStyles,
    didDrawPage: () => addPdfHeaderLogo(doc, logo),
  });
  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY;
  return finalY + 18;
}

/** Czytelny przeglad linii w PDF: wiersz = linia + rok (zamiast dziesiatek waskich kolumn). */
export function buildLinesOverviewPdfSection(input: {
  locale: Locale;
  lines: string[];
  years: number[];
  getProduction: (line: string, year: number) => number | null;
  getContract: (line: string, year: number) => number | null;
  getScenarioProduction?: (line: string, year: number) => number | null;
  showProduction: boolean;
  showContract: boolean;
  showScenarioProduction: boolean;
}): VisualizationPdfSection {
  const lab = linesOverviewLabels(input.locale, {
    showProduction: input.showProduction,
    showContract: input.showContract,
    showScenarioProduction: input.showScenarioProduction,
  });
  const headers: string[] = [lab.line, lab.year];
  if (input.showProduction) headers.push(lab.prod);
  if (input.showContract) headers.push(lab.contract);
  if (input.showProduction && input.showContract) headers.push(lab.diffPp);
  if (input.showScenarioProduction && input.getScenarioProduction) headers.push(lab.scen);

  const rows: string[][] = [];
  for (const line of input.lines) {
    for (const year of input.years) {
      const p = input.getProduction(line, year);
      const k = input.getContract(line, year);
      const cells: string[] = [line, String(year)];
      if (input.showProduction) cells.push(fmtPctCell(p));
      if (input.showContract) cells.push(fmtPctCell(k));
      if (input.showProduction && input.showContract) cells.push(fmtDeltaPp(deltaPp(k, p)));
      if (input.showScenarioProduction && input.getScenarioProduction) {
        cells.push(fmtPctCell(input.getScenarioProduction(line, year)));
      }
      rows.push(cells);
    }
  }

  return {
    title: lab.title,
    headers,
    rows,
  };
}

export function trendSectionFromGetters(
  locale: Locale,
  years: number[],
  getProduction: (year: number) => number | null,
  getContract: (year: number) => number | null,
  getScenarioProduction: ((year: number) => number | null) | undefined,
  getScenarioContract: ((year: number) => number | null) | undefined,
  tableOpts: TrendTableBuildOptions
): Pick<VisualizationPdfSection, 'headers' | 'rows'> {
  const headers = pdfTrendHeaders(locale, tableOpts);
  return buildTrendTableWithDeltas(
    years,
    getProduction,
    getContract,
    getScenarioProduction,
    getScenarioContract,
    tableOpts,
    headers
  );
}

export function analyticsTableRows(
  locale: Locale,
  rows: AnalyticsRow[],
  hasScenario: boolean
): { headers: string[]; body: string[][] } {
  const headers = pdfAnalyticsHeaders(locale, hasScenario);
  const body = rows.map((r) => {
    const line = [
      String(r.year),
      r.production != null ? `${r.production}%` : '—',
      r.contract != null ? `${r.contract}%` : '—',
      fmtDelta(r.deltaContractMinusProd),
    ];
    if (hasScenario) {
      line.push(r.scenarioProduction != null ? `${r.scenarioProduction}%` : '—', fmtDelta(r.deltaScenarioProdMinusProd));
    }
    return line;
  });
  return { headers, body };
}

function fmtDelta(v: number | null): string {
  if (v == null) return '-';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v} p.p.`;
}

export async function downloadCapacityVisualizationPdf(input: VisualizationPdfInput): Promise<void> {
  const s = input.strings;
  const logo = await fetchPdfLogoDataUrl();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  addPdfHeaderLogo(doc, logo);

  doc.setFontSize(16);
  doc.text(pdfSafe(s.docTitle), 40, 36);
  doc.setFontSize(10);
  let y = 54;
  doc.text(pdfSafe(`${s.reportDate}: ${localeDateTime(input.locale)}`), 40, y);
  y += 14;
  doc.text(pdfSafe(`${s.yearRange}: ${input.yearFrom}–${input.yearTo}`), 40, y);
  y += 14;
  doc.text(pdfSafe(`${s.machineStatus}: ${input.machineStatusLabel}`), 40, y);
  y += 14;
  doc.text(pdfSafe(`${s.machineType}: ${input.machineTypeLabel}`), 40, y);
  y += 14;
  doc.text(pdfSafe(`${s.client}: ${input.clientLabel}`), 40, y);
  y += 14;
  doc.text(pdfSafe(`${s.scenario}: ${input.scenarioName ?? s.noScenario}`), 40, y);
  y += 14;
  doc.text(pdfSafe(`${s.seriesOnCharts}: ${input.seriesLabels.join(', ') || '-'}`), 40, y);
  y += 20;

  let partNum = 0;
  const nextPartTitle = (label: string) => {
    partNum += 1;
    return `${partNum}. ${label}`;
  };

  if (input.viewCapture?.images.length) {
    y = await drawChartPart(
      doc,
      logo,
      y,
      {
        partTitle: nextPartTitle(input.viewCapture.partTitle),
        images: input.viewCapture.images,
        gridCols: input.viewCapture.gridCols,
      },
      s.continued
    );
  }

  const addTablePart = (label: string, sections: VisualizationPdfSection[]) => {
    if (!sections.length) return;
    y = drawSectionTitle(doc, nextPartTitle(label), y);
    y = ensureSpace(doc, logo, y, 60);
    for (const sec of sections) {
      y = ensureSpace(doc, logo, y, 80);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(pdfSafe(sec.title), 40, y);
      doc.setFont('helvetica', 'normal');
      y += 12;
      y = drawTable(doc, logo, y, sec);
    }
  };

  if (input.chartParts?.length) {
    for (const cp of input.chartParts) {
      if (!cp.images.length) continue;
      y = await drawChartPart(doc, logo, y, { partTitle: nextPartTitle(cp.partTitle), images: cp.images, gridCols: cp.gridCols }, s.continued);
    }
  }

  addTablePart(s.partLinesTables, input.lineSections);
  addTablePart(s.partMachinesTables, input.machineSections);

  if (input.linesOverview) {
    y = drawSectionTitle(doc, nextPartTitle(s.partLinesOverview), y);
    y = ensureSpace(doc, logo, y, 60);
    y = drawTable(doc, logo, y, input.linesOverview);
  }

  if (input.analyticsSection) {
    y = drawSectionTitle(doc, nextPartTitle(s.partAnalytics), y);
    y = ensureSpace(doc, logo, y, 80);
    doc.setFontSize(10);
    doc.text(pdfSafe(`${s.objectLabel}: ${input.analyticsSection.title}`), 40, y);
    y += 14;
    const avgParts: string[] = [];
    if (input.analyticsSection.avgProduction != null) {
      avgParts.push(`${s.avgProduction}: ${input.analyticsSection.avgProduction}%`);
    }
    if (input.analyticsSection.avgContract != null) {
      avgParts.push(`${s.avgContract}: ${input.analyticsSection.avgContract}%`);
    }
    if (input.analyticsSection.avgScenarioProduction != null) {
      avgParts.push(`${s.avgScenarioProd}: ${input.analyticsSection.avgScenarioProduction}%`);
    }
    if (avgParts.length) {
      doc.text(pdfSafe(avgParts.join('  |  ')), 40, y);
      y += 14;
    }
    drawTable(doc, logo, y, input.analyticsSection);
  }

  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '').slice(0, 12);
  doc.save(`capacity-wizualizacja-${stamp}.pdf`);
}

