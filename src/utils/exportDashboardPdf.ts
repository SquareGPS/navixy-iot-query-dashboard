/**
 * Client-side dashboard → PDF export (FEAT-826).
 *
 * A dashboard is a heterogeneous grid of Recharts / Leaflet / table panels that
 * only render faithfully in a real browser, so we rasterize the rendered grid with
 * modern-screenshot and assemble a paginated PDF with jsPDF — entirely client-side.
 * Nothing is uploaded: the PDF is built and downloaded locally, which keeps request
 * bodies small (no data/rows/images ever cross the wire) and makes the export
 * WYSIWYG — it reflects the current filters, timepicker and table page on screen.
 *
 * modern-screenshot draws the DOM through an SVG <foreignObject>, i.e. the browser's
 * own layout/paint engine, so the raster matches the screen exactly (flex centering,
 * the donut "Total" label, title-icon alignment, fonts) — unlike html2canvas, whose
 * reimplemented CSS engine skewed those. We capture an off-screen clone so we can
 * reveal content the panels clip on screen without disturbing the live dashboard:
 * each panel's hidden vertical overflow is measured and the panel grown (reflowing
 * the rows below it) so full tables render — capped per panel, with an "export
 * Excel/CSV" note when a table is too large to fit.
 *
 * modern-screenshot and jsPDF are dynamically imported so they only ship to users
 * who actually export (they stay out of the main bundle).
 */

export interface DashboardPdfOptions {
  /** Report page title, printed in the PDF header. */
  title: string;
  /** Optional subtitle, printed under the title. */
  subtitle?: string;
  /** Output file name (without extension). Falls back to a slug of the title. */
  fileName?: string;
  /** Generation timestamp; defaults to now. */
  generatedAt?: Date;
}

// A4 landscape in PDF points (1pt = 1/72"). Dashboards use a wide 24-column grid,
// so landscape wastes less space than portrait.
const PAGE = { width: 841.89, height: 595.28 };
const MARGIN = 28; // pt, around the page
const HEADER_HEIGHT = 46; // pt, reserved above the image on page 1 only
const FOOTER_HEIGHT = 20; // pt, reserved below the image on every page

// Cap the capture so an extremely tall dashboard can't blow past the browser's
// max-canvas-area limit (which yields a blank capture). Height in device px.
const MAX_CAPTURE_HEIGHT = 14000;
const CAPTURE_SCALE = 2;

// How much a single panel may grow to reveal a scrolled table (CSS px). Beyond
// this the table is clipped and gets an "export Excel/CSV" note, so one huge table
// can't inflate (and force a downscale of) the whole PDF. ~50 rows.
const MAX_PANEL_EXPAND = 2200;
const DISCLAIMER_HEIGHT = 26; // px strip appended to a clipped table panel
// Ignore sub-pixel / cosmetic overflow so tiles and charts aren't nudged for nothing.
const MIN_PANEL_OVERFLOW = 4;

/** Turn an arbitrary title into a safe, compact file-name slug. */
function slugify(input: string, fallback = 'dashboard'): string {
  const slug = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics left by NFKD
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || fallback;
}

/** Parse a CSS color (`rgb()`, `rgba()` or `#hex`) into 0–255 components. */
function parseColor(color: string): { r: number; g: number; b: number } {
  const rgbMatch = color.match(/rgba?\(([^)]+)\)/i);
  if (rgbMatch) {
    const [r, g, b] = rgbMatch[1].split(',').map((v) => parseFloat(v.trim()));
    return { r: r || 0, g: g || 0, b: b || 0 };
  }
  const hex = color.replace('#', '').trim();
  if (hex.length === 3) {
    return {
      r: parseInt(hex[0] + hex[0], 16),
      g: parseInt(hex[1] + hex[1], 16),
      b: parseInt(hex[2] + hex[2], 16),
    };
  }
  if (hex.length >= 6) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }
  return { r: 255, g: 255, b: 255 };
}

/**
 * Walk up from the element to the first element with a non-transparent
 * background, falling back to the document body. Used both as the capture
 * backdrop and to theme the PDF chrome (light vs dark) to match the app.
 */
function resolveBackground(element: HTMLElement): { r: number; g: number; b: number } {
  let node: HTMLElement | null = element;
  while (node) {
    const bg = getComputedStyle(node).backgroundColor;
    if (bg && bg !== 'transparent' && !bg.startsWith('rgba(0, 0, 0, 0')) {
      return parseColor(bg);
    }
    node = node.parentElement;
  }
  const bodyBg = getComputedStyle(document.body).backgroundColor;
  return parseColor(bodyBg || 'rgb(255,255,255)');
}

/** Relative luminance — used to pick readable header/footer text over the page fill. */
function isDark({ r, g, b }: { r: number; g: number; b: number }): boolean {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5;
}

/** Yield to the browser so a "generating…" spinner can paint before the heavy capture. */
function nextFrame(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

interface PanelPlan {
  newTop: number;
  newHeight: number;
  /** This panel had hidden overflow we expand to reveal. */
  grow: boolean;
  /** Overflow exceeded the cap — clip and show the disclaimer instead. */
  clip: boolean;
}

interface ExpansionPlan {
  panels: PanelPlan[];
  captureHeight: number;
}

/** The absolutely-positioned grid container inside the export root. */
function findGridContainer(root: HTMLElement): HTMLElement | null {
  const candidate = root.querySelector<HTMLElement>('.relative.w-full');
  return candidate ?? null;
}

/** Absolutely-positioned grid children (panels + row headers), in DOM order. */
function gridItems(container: HTMLElement): HTMLElement[] {
  return Array.from(container.children).filter(
    (el): el is HTMLElement => el instanceof HTMLElement && el.style.position === 'absolute',
  );
}

/**
 * Measure how much each panel must grow to reveal its scrolled content, then reflow
 * every grid row downward so nothing overlaps. Runs on the off-screen clone; the plan
 * is applied to that same clone, so the live dashboard is never mutated.
 */
function measureExpansion(root: HTMLElement): ExpansionPlan {
  const container = findGridContainer(root);
  if (!container) return { panels: [], captureHeight: root.scrollHeight };

  const items = gridItems(container);
  const measured = items.map((el) => {
    const top = parseFloat(el.style.top) || 0;
    const height = parseFloat(el.style.height) || el.getBoundingClientRect().height;
    // Largest vertical overflow among descendants that actually scroll — the real
    // table/content scroller. Only pay for getComputedStyle on overflowing nodes.
    let overflow = 0;
    el.querySelectorAll('*').forEach((d) => {
      if (!(d instanceof HTMLElement)) return;
      const o = d.scrollHeight - d.clientHeight;
      if (o > overflow) {
        const oy = getComputedStyle(d).overflowY;
        if (oy === 'auto' || oy === 'scroll') overflow = o;
      }
    });
    return { top, height, overflow };
  });

  // Group panels into grid rows by their (shared) top coordinate.
  const rowsByTop = new Map<number, number[]>();
  measured.forEach((m, i) => {
    const key = Math.round(m.top);
    const bucket = rowsByTop.get(key);
    if (bucket) bucket.push(i);
    else rowsByTop.set(key, [i]);
  });

  const panels: PanelPlan[] = new Array(measured.length);
  let offset = 0; // accumulated downward shift from expanded rows above
  for (const top of [...rowsByTop.keys()].sort((a, b) => a - b)) {
    const idxs = rowsByTop.get(top)!;
    let rowGrow = 0;
    for (const i of idxs) {
      const m = measured[i];
      const meaningful = m.overflow > MIN_PANEL_OVERFLOW;
      const clip = m.overflow > MAX_PANEL_EXPAND;
      const grow = meaningful
        ? Math.min(m.overflow, MAX_PANEL_EXPAND) + (clip ? DISCLAIMER_HEIGHT : 0)
        : 0;
      panels[i] = {
        newTop: Math.round(top + offset),
        newHeight: Math.round(m.height + grow),
        grow: grow > 0,
        clip,
      };
      if (grow > rowGrow) rowGrow = grow;
    }
    offset += rowGrow;
  }

  const containerHeight = container.getBoundingClientRect().height;
  return { panels, captureHeight: Math.ceil(containerHeight + offset) };
}

/** Apply the reflow/expansion plan to the off-screen clone of the grid. */
function applyExpansion(root: HTMLElement, plan: ExpansionPlan): void {
  root.style.height = `${plan.captureHeight}px`;
  const container = findGridContainer(root);
  if (!container) return;
  container.style.minHeight = `${plan.captureHeight}px`;
  container.style.height = `${plan.captureHeight}px`;

  gridItems(container).forEach((el, i) => {
    const p = plan.panels[i];
    if (!p) return;
    el.style.top = `${p.newTop}px`;
    el.style.height = `${p.newHeight}px`;
    if (!p.grow) return;

    // Grow the panel's inner boxes so content it clips on screen (mainly long tables)
    // renders in full. The browser clips overflow:auto/scroll/hidden to each element's
    // box, so revealing it means pinning each scroller's minHeight to its content
    // height, dropping maxHeight caps, and opening overflow:hidden wrappers — a
    // percentage-height box wouldn't grow from just flipping overflow to visible. When
    // a table is capped we instead clip its scroller so it stops at the disclaimer
    // strip. Horizontal overflow is left alone (wide tables clip at the panel edge).
    el.querySelectorAll('*').forEach((d) => {
      if (!(d instanceof HTMLElement)) return;
      const cs = getComputedStyle(d);
      const scrolls = cs.overflowY === 'auto' || cs.overflowY === 'scroll';
      if (p.clip) {
        if (scrolls) d.style.overflowY = 'hidden';
        return;
      }
      if (scrolls) {
        d.style.overflowY = 'visible';
        d.style.maxHeight = 'none';
        d.style.minHeight = `${d.scrollHeight}px`; // grow the box to contain all content
      } else {
        if (cs.overflowY === 'hidden') d.style.overflowY = 'visible';
        if (cs.maxHeight !== 'none') d.style.maxHeight = 'none';
      }
    });

    if (p.clip) {
      const note = document.createElement('div');
      note.textContent = 'Partial data shown — export Excel or CSV for all rows.';
      note.style.cssText =
        `position:absolute;left:0;right:0;bottom:0;height:${DISCLAIMER_HEIGHT}px;` +
        'display:flex;align-items:center;justify-content:center;' +
        'font-size:11px;font-family:helvetica,arial,sans-serif;color:#64748b;' +
        'background:rgba(148,163,184,0.12);border-top:1px solid rgba(148,163,184,0.30);';
      el.appendChild(note); // el is position:absolute, so the note anchors to it
    }
  });
}

/**
 * Capture a rendered dashboard grid element and download it as a multi-page PDF.
 *
 * @param element The DOM node wrapping the panel grid (the full-height container).
 * @param options Title/subtitle/filename metadata for the PDF header.
 */
export async function exportDashboardToPdf(
  element: HTMLElement,
  options: DashboardPdfOptions,
): Promise<void> {
  const [{ domToCanvas }, { jsPDF }] = await Promise.all([
    import('modern-screenshot'),
    import('jspdf'),
  ]);

  const generatedAt = options.generatedAt ?? new Date();
  const bg = resolveBackground(element);
  const bgCss = `rgb(${bg.r}, ${bg.g}, ${bg.b})`;
  const width = Math.ceil(element.getBoundingClientRect().width);

  // Let the loading state paint before the heavy work.
  await nextFrame();

  // Render from an off-screen clone. modern-screenshot draws the DOM through an SVG
  // <foreignObject> — the browser's own paint engine — so the PDF matches the
  // on-screen layout exactly (flex centering, the donut's "Total" label, title-icon
  // alignment, fonts), which html2canvas's reimplemented CSS engine could not.
  // Cloning lets us reveal content the panels clip on screen (full tables) without
  // disturbing the live dashboard.
  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.position = 'fixed';
  clone.style.left = '-100000px';
  clone.style.top = '0';
  clone.style.width = `${width}px`;
  clone.style.maxWidth = 'none';
  clone.style.margin = '0';
  clone.style.background = bgCss;
  document.body.appendChild(clone);

  let canvas: HTMLCanvasElement | null = null;
  try {
    const plan = measureExpansion(clone);
    applyExpansion(clone, plan);
    void clone.offsetHeight; // force a layout pass before capturing

    // Clamp the scale so a very tall dashboard doesn't exceed the canvas-area limit.
    const scale =
      plan.captureHeight * CAPTURE_SCALE > MAX_CAPTURE_HEIGHT
        ? Math.max(1, MAX_CAPTURE_HEIGHT / plan.captureHeight)
        : CAPTURE_SCALE;

    canvas = await domToCanvas(clone, { scale, backgroundColor: bgCss });
  } finally {
    clone.remove();
  }

  if (!canvas || !canvas.width || !canvas.height) {
    throw new Error('Nothing to export — the dashboard did not render any content.');
  }

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  const contentW = PAGE.width - MARGIN * 2;
  const pxToPt = contentW / canvas.width; // image px → pt when fitted to content width
  const usableFirst = PAGE.height - MARGIN - HEADER_HEIGHT - MARGIN - FOOTER_HEIGHT;
  const usableRest = PAGE.height - MARGIN - MARGIN - FOOTER_HEIGHT;

  // Reusable slice canvas: we copy a horizontal band of the source per page so no
  // panel-heavy page is ever a single oversized image.
  const slice = document.createElement('canvas');
  const sliceCtx = slice.getContext('2d');
  if (!sliceCtx) throw new Error('Unable to prepare the export canvas.');

  let srcY = 0;
  let pageIndex = 0;
  while (srcY < canvas.height) {
    const isFirst = pageIndex === 0;
    const usablePt = isFirst ? usableFirst : usableRest;
    const topPt = isFirst ? MARGIN + HEADER_HEIGHT : MARGIN;
    const sliceHpx = Math.min(canvas.height - srcY, Math.floor(usablePt / pxToPt));
    if (sliceHpx <= 0) break;

    slice.width = canvas.width;
    slice.height = sliceHpx;
    sliceCtx.fillStyle = bgCss;
    sliceCtx.fillRect(0, 0, slice.width, slice.height);
    sliceCtx.drawImage(canvas, 0, srcY, canvas.width, sliceHpx, 0, 0, canvas.width, sliceHpx);
    // JPEG (high quality) keeps multi-page dashboards to a sane file size vs PNG.
    const img = slice.toDataURL('image/jpeg', 0.95);

    if (!isFirst) pdf.addPage();
    // Fill the page so margins match the dashboard background in both themes.
    pdf.setFillColor(bg.r, bg.g, bg.b);
    pdf.rect(0, 0, PAGE.width, PAGE.height, 'F');
    if (isFirst) drawHeader(pdf, options, generatedAt, bg);
    pdf.addImage(img, 'JPEG', MARGIN, topPt, contentW, sliceHpx * pxToPt);

    srcY += sliceHpx;
    pageIndex++;
  }

  // Footer / page numbers, stamped once the total is known.
  const total = pdf.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    drawFooter(pdf, i, total, options.title, bg);
  }

  pdf.save(`${slugify(options.fileName || options.title)}.pdf`);
}

function drawHeader(
  pdf: import('jspdf').jsPDF,
  options: DashboardPdfOptions,
  generatedAt: Date,
  bg: { r: number; g: number; b: number },
): void {
  const dark = isDark(bg);
  const strong: [number, number, number] = dark ? [233, 241, 255] : [15, 23, 42];
  const muted: [number, number, number] = dark ? [148, 163, 184] : [100, 116, 139];

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(15);
  pdf.setTextColor(...strong);
  pdf.text(options.title || 'Dashboard', MARGIN, MARGIN + 15);

  if (options.subtitle) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(...muted);
    pdf.text(options.subtitle, MARGIN, MARGIN + 31);
  }

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(...muted);
  const stamp = generatedAt.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  pdf.text(`Generated ${stamp}`, PAGE.width - MARGIN, MARGIN + 15, { align: 'right' });

  // Divider under the header.
  pdf.setDrawColor(dark ? 34 : 226, dark ? 49 : 232, dark ? 75 : 240);
  pdf.setLineWidth(0.5);
  pdf.line(MARGIN, MARGIN + HEADER_HEIGHT - 8, PAGE.width - MARGIN, MARGIN + HEADER_HEIGHT - 8);
}

function drawFooter(
  pdf: import('jspdf').jsPDF,
  page: number,
  total: number,
  title: string,
  bg: { r: number; g: number; b: number },
): void {
  const muted: [number, number, number] = isDark(bg)
    ? [120, 137, 163]
    : [148, 163, 184];
  const y = PAGE.height - MARGIN + 4;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(...muted);
  if (title) {
    const label = title.length > 90 ? `${title.slice(0, 90)}…` : title;
    pdf.text(label, MARGIN, y);
  }
  pdf.text(`Page ${page} of ${total}`, PAGE.width - MARGIN, y, { align: 'right' });
}
