// 纯函数：拼图版式、图片适配、水印位置、文件名。不依赖界面和本机能力，便于单元测试。

export type OutFormat = 'png' | 'jpg';
export type Fit = 'contain' | 'cover';
export type WmPosition = 'br' | 'bl' | 'tr' | 'tl' | 'center' | 'tile';

/** 画布单边上限：浏览器对画布大小有限制，超过时直接提示，不去试 */
export const MAX_SIDE = 16000;

export function chunk<T>(list: T[], size: number): T[][] {
  if (!size || size <= 0 || size >= list.length) return list.length ? [list] : [];
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export interface Rect { x: number; y: number; w: number; h: number }

export interface GridSpec {
  count: number;
  columns: number;
  /** 每格图片区域边长 */
  cell: number;
  gap: number;
  /** 四周留白 */
  margin: number;
  /** 每格下方文字区高度，0 表示不写文件名 */
  captionH: number;
  /** 顶部标题区高度，0 表示没有标题 */
  titleH: number;
}

export interface GridLayout {
  width: number;
  height: number;
  columns: number;
  rows: number;
  /** 每格的图片区域 */
  cells: Rect[];
  /** 每格的文字区域（captionH 为 0 时高度为 0） */
  captions: Rect[];
}

/** 网格版式：最后一行不满时居中 */
export function gridLayout(s: GridSpec): GridLayout {
  const count = Math.max(0, Math.floor(s.count));
  const columns = Math.max(1, Math.min(Math.floor(s.columns) || 1, count || 1));
  const rows = Math.ceil(count / columns) || 0;
  const rowH = s.cell + s.captionH;
  const width = s.margin * 2 + columns * s.cell + (columns - 1) * s.gap;
  const height = s.margin * 2 + s.titleH + rows * rowH + Math.max(0, rows - 1) * s.gap;
  const cells: Rect[] = [];
  const captions: Rect[] = [];
  for (let i = 0; i < count; i++) {
    const r = Math.floor(i / columns);
    const c = i % columns;
    const inRow = r === rows - 1 ? count - r * columns : columns;
    const rowW = inRow * s.cell + (inRow - 1) * s.gap;
    const x0 = s.margin + (width - s.margin * 2 - rowW) / 2;
    const x = Math.round(x0 + c * (s.cell + s.gap));
    const y = s.margin + s.titleH + r * (rowH + s.gap);
    cells.push({ x, y, w: s.cell, h: s.cell });
    captions.push({ x, y: y + s.cell, w: s.cell, h: s.captionH });
  }
  return { width, height, columns, rows, cells, captions };
}

/** 超出画布上限时返回说明，否则返回 null */
export function sizeProblem(width: number, height: number): string | null {
  if (width > MAX_SIDE || height > MAX_SIDE) return `拼出来的图是 ${width}×${height} 像素，超过 ${MAX_SIDE} 像素的上限，请减少列数、每张格数或缩小每格尺寸`;
  return null;
}

export interface FitResult { sx: number; sy: number; sw: number; sh: number; dx: number; dy: number; dw: number; dh: number }

/** 把 srcW×srcH 的图放进 box：contain 完整显示居中（不放大超过原图的 4 倍），cover 铺满并裁掉多余部分 */
export function fitRect(srcW: number, srcH: number, box: Rect, mode: Fit): FitResult {
  if (mode === 'cover') {
    const k = Math.max(box.w / srcW, box.h / srcH);
    const sw = box.w / k;
    const sh = box.h / k;
    return { sx: (srcW - sw) / 2, sy: (srcH - sh) / 2, sw, sh, dx: box.x, dy: box.y, dw: box.w, dh: box.h };
  }
  const k = Math.min(box.w / srcW, box.h / srcH, 4);
  const dw = srcW * k;
  const dh = srcH * k;
  return { sx: 0, sy: 0, sw: srcW, sh: srcH, dx: box.x + (box.w - dw) / 2, dy: box.y + (box.h - dh) / 2, dw, dh };
}

export interface Placement { x: number; y: number; rot: number }

/** 水印位置：角落/居中返回一处（x,y 为水印左上角），平铺返回斜着铺满整张图的多处（x,y 为水印中心） */
export function watermarkPlacements(pos: WmPosition, sheetW: number, sheetH: number, markW: number, markH: number): Placement[] {
  const pad = Math.round(Math.min(sheetW, sheetH) * 0.03);
  switch (pos) {
    case 'br': return [{ x: sheetW - markW - pad, y: sheetH - markH - pad, rot: 0 }];
    case 'bl': return [{ x: pad, y: sheetH - markH - pad, rot: 0 }];
    case 'tr': return [{ x: sheetW - markW - pad, y: pad, rot: 0 }];
    case 'tl': return [{ x: pad, y: pad, rot: 0 }];
    case 'center': return [{ x: (sheetW - markW) / 2, y: (sheetH - markH) / 2, rot: 0 }];
    case 'tile': {
      const stepX = markW * 1.8;
      const stepY = Math.max(markH * 3.2, markW * 0.9);
      const out: Placement[] = [];
      // 旋转后需要多铺一圈才能盖满四角
      const rows = Math.ceil((sheetH + sheetW) / stepY) + 1;
      const cols = Math.ceil((sheetW + sheetH) / stepX) + 1;
      for (let r = -rows; r <= rows; r++) {
        for (let c = -cols; c <= cols; c++) {
          const x = sheetW / 2 + c * stepX + (r % 2 ? stepX / 2 : 0);
          const y = sheetH / 2 + r * stepY;
          if (x > -markW && x < sheetW + markW && y > -markH && y < sheetH + markH) out.push({ x, y, rot: -Math.PI / 6 });
        }
      }
      return out;
    }
  }
}

/** 文件名去掉扩展名，作为格子下面的说明文字 */
export function captionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return (dot > 0 ? name.slice(0, dot) : name).trim();
}

/** 文字太长时按宽度截断并加省略号；measure 返回文字宽度 */
export function ellipsize(text: string, maxW: number, measure: (s: string) => number): string {
  if (measure(text) <= maxW) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measure(text.slice(0, mid) + '…') <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return lo ? text.slice(0, lo) + '…' : '…';
}

export function sheetName(index: number, total: number, format: OutFormat): string {
  const pad = String(index + 1).padStart(Math.max(2, String(total).length), '0');
  return `拼图-${pad}.${format}`;
}

/** 背景色是深色时返回 true（用于决定文字用浅色还是深色） */
export function isDark(hex: string): boolean {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return false;
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => parseInt(x, 16));
  return 0.299 * r + 0.587 * g + 0.114 * b < 128;
}

/** 把参数里的数字限制在范围内；不是数字时用默认值 */
export function clampNum(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
