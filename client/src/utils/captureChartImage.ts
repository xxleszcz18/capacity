/** Czeka na wyrenderowanie wykresów Recharts przed zrzutem DOM. */
export function waitForChartsPaint(ms = 700): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setTimeout(resolve, ms));
    });
  });
}

function prepareClonedExportNode(cloned: HTMLElement) {
  cloned.style.opacity = '1';
  cloned.style.maxHeight = 'none';
  cloned.style.overflow = 'visible';
  cloned.style.boxShadow = 'none';
  cloned.querySelectorAll('[data-viz-export-hide]').forEach((el) => {
    (el as HTMLElement).style.display = 'none';
  });
}

function findClonedExportTarget(doc: Document, el: HTMLElement): HTMLElement | null {
  const exportId = el.getAttribute('data-viz-export-id');
  if (exportId) {
    return doc.querySelector(`[data-viz-export-id="${exportId}"]`) as HTMLElement | null;
  }
  const panelId = el.getAttribute('data-viz-export-panel');
  if (panelId) {
    return doc.querySelector(`[data-viz-export-panel="${panelId}"]`) as HTMLElement | null;
  }
  const pdfKey = el.getAttribute('data-pdf-chart');
  if (pdfKey) {
    return doc.querySelector(`[data-pdf-chart="${pdfKey}"]`) as HTMLElement | null;
  }
  if (el.hasAttribute('data-viz-export-chrome')) {
    return doc.querySelector('[data-viz-export-chrome]') as HTMLElement | null;
  }
  return null;
}

export async function captureElementAsJpeg(el: HTMLElement, quality = 0.9): Promise<string> {
  const html2canvas = (await import('html2canvas')).default;
  const canvas = await html2canvas(el, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    scrollY: -window.scrollY,
    windowHeight: Math.max(el.scrollHeight, el.offsetHeight) + 100,
    onclone: (doc) => {
      const cloned = findClonedExportTarget(doc, el);
      if (cloned) prepareClonedExportNode(cloned);
    },
  });
  return canvas.toDataURL('image/jpeg', quality);
}

export type PdfImageSlice = {
  dataUrl: string;
  displayWidthPt: number;
  displayHeightPt: number;
};

export type ViewCaptureBlock = {
  title: string;
  dataUrl: string;
  blockType: 'chart' | 'table' | 'chrome';
};

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = dataUrl;
  });
}

export function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return loadImage(dataUrl);
}

export function cropImageToDataUrl(img: HTMLImageElement, sy: number, srcHeight: number, quality = 0.92): string {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = srcHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, srcHeight);
  ctx.drawImage(img, 0, sy, img.width, srcHeight, 0, 0, img.width, srcHeight);
  return canvas.toDataURL('image/jpeg', quality);
}

/** Dzieli obraz na fragmenty o maks. wysokości wyświetlania w PDF (pt), bez skalowania w dół. */
export async function sliceImageForPdfDisplay(
  dataUrl: string,
  maxDisplayWidthPt: number,
  maxDisplayHeightPt: number
): Promise<PdfImageSlice[]> {
  const img = await loadImage(dataUrl);
  const fullDisplayHeightPt = maxDisplayWidthPt * (img.height / img.width);
  if (fullDisplayHeightPt <= maxDisplayHeightPt + 0.5) {
    return [{ dataUrl, displayWidthPt: maxDisplayWidthPt, displayHeightPt: fullDisplayHeightPt }];
  }

  const slices: PdfImageSlice[] = [];
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return [{ dataUrl, displayWidthPt: maxDisplayWidthPt, displayHeightPt: fullDisplayHeightPt }];
  }

  canvas.width = img.width;
  const sliceSrcHeight = Math.max(1, Math.floor(img.height * (maxDisplayHeightPt / fullDisplayHeightPt)));
  let sy = 0;
  while (sy < img.height) {
    const sh = Math.min(sliceSrcHeight, img.height - sy);
    const displayHeightPt = maxDisplayWidthPt * (sh / img.width);
    canvas.height = sh;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, sh);
    ctx.drawImage(img, 0, sy, img.width, sh, 0, 0, img.width, sh);
    slices.push({
      dataUrl: canvas.toDataURL('image/jpeg', 0.92),
      displayWidthPt: maxDisplayWidthPt,
      displayHeightPt,
    });
    sy += sh;
  }
  return slices.length ? slices : [{ dataUrl, displayWidthPt: maxDisplayWidthPt, displayHeightPt: fullDisplayHeightPt }];
}

/** Maks. proporcja wysokość/szerokość tabeli — powyżej dzielimy wg lat. */
const TABLE_SPLIT_ASPECT = 1.35;

async function captureTableBlockForPdf(block: HTMLElement, title: string): Promise<ViewCaptureBlock[]> {
  const fullUrl = await captureElementAsJpeg(block);
  const img = await loadImage(fullUrl);
  if (img.height / img.width <= TABLE_SPLIT_ASPECT) {
    return [{ title, dataUrl: fullUrl, blockType: 'table' }];
  }

  const parts = block.querySelectorAll('[data-viz-export-table-part]');
  if (parts.length <= 1) {
    return [{ title, dataUrl: fullUrl, blockType: 'table' }];
  }

  const table = block.querySelector('table');
  if (!table) {
    return [{ title, dataUrl: fullUrl, blockType: 'table' }];
  }

  const out: ViewCaptureBlock[] = [];
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-12000px;top:0;background:#fff;padding:0;';
  document.body.appendChild(host);

  try {
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!(part instanceof HTMLElement)) continue;
      const year = part.getAttribute('data-viz-export-table-year') ?? String(i + 1);
      const wrapper = document.createElement('div');
      wrapper.style.background = '#fff';
      const miniTable = document.createElement('table');
      miniTable.style.cssText = table.style.cssText;
      miniTable.style.width = '100%';
      miniTable.style.borderCollapse = 'collapse';
      miniTable.style.tableLayout = 'fixed';
      const colgroup = table.querySelector('colgroup');
      if (colgroup) miniTable.appendChild(colgroup.cloneNode(true));
      const thead = table.querySelector('thead');
      if (thead) miniTable.appendChild(thead.cloneNode(true));
      miniTable.appendChild(part.cloneNode(true));
      wrapper.appendChild(miniTable);
      host.appendChild(wrapper);
      const partTitle = i === 0 ? title : `${title} — ${year}`;
      out.push({
        title: partTitle,
        dataUrl: await captureElementAsJpeg(wrapper),
        blockType: 'table',
      });
      host.removeChild(wrapper);
    }
  } finally {
    document.body.removeChild(host);
  }

  return out.length ? out : [{ title, dataUrl: fullUrl, blockType: 'table' }];
}

/** Przechwytuje bloki widoku (wykres i tabela osobno) z zachowaniem kolejności DOM. */
export async function captureViewPanelForPdf(panel: HTMLElement): Promise<ViewCaptureBlock[]> {
  const out: ViewCaptureBlock[] = [];

  const blocks = panel.querySelectorAll('[data-viz-export-block]');
  if (blocks.length) {
    for (const block of blocks) {
      if (!(block instanceof HTMLElement)) continue;
      const blockType = (block.getAttribute('data-viz-export-block-type') ?? 'chart') as ViewCaptureBlock['blockType'];
      const title = block.getAttribute('data-viz-export-title') ?? '';
      if (blockType === 'table') {
        const tableBlocks = await captureTableBlockForPdf(block, title);
        out.push(...tableBlocks);
      } else {
        out.push({
          title,
          dataUrl: await captureElementAsJpeg(block),
          blockType,
        });
      }
    }
    return out;
  }

  const cards = panel.querySelectorAll('[data-viz-export-card]');
  if (cards.length) {
    for (const card of cards) {
      if (!(card instanceof HTMLElement)) continue;
      out.push({
        title: card.getAttribute('data-viz-export-title') ?? '',
        dataUrl: await captureElementAsJpeg(card),
        blockType: 'chart',
      });
    }
    return out;
  }

  out.push({ title: '', dataUrl: await captureElementAsJpeg(panel), blockType: 'chart' });
  return out;
}

export async function captureChartsBySelector(
  root: HTMLElement,
  selector = '[data-pdf-chart]'
): Promise<{ key: string; title: string; dataUrl: string }[]> {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>(selector));
  const out: { key: string; title: string; dataUrl: string }[] = [];
  for (const node of nodes) {
    const key = node.getAttribute('data-pdf-chart') ?? String(out.length);
    const title = node.getAttribute('data-pdf-chart-title') ?? key;
    const dataUrl = await captureElementAsJpeg(node);
    out.push({ key, title, dataUrl });
  }
  return out;
}
