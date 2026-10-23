// 画布绘制：用页面里的画布出图（不用 OffscreenCanvas，兼容 macOS 11 起的系统网页引擎与 Windows WebView2）。
import { captionOf, ellipsize, fitRect, isDark, watermarkPlacements } from './core';
import type { GridLayout } from './core';
import { CAPTION_H, type Options } from './flow';

export const FONT = '"PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif';

export async function loadImage(bytes: Uint8Array): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart]));
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode().catch(() => {
      throw new Error('无法识别这张图片，可能已损坏或格式不受支持');
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

type Src = CanvasImageSource & { width: number; height: number };
const dims = (s: Src): [number, number] => {
  const i = s as HTMLImageElement;
  return [i.naturalWidth || s.width, i.naturalHeight || s.height];
};

/** 画一张拼图（同步，画完返回画布） */
export function drawSheet(items: { name: string; img: Src }[], layout: GridLayout, o: Options, mark: Src | null): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = layout.width;
  canvas.height = layout.height;
  const g = canvas.getContext('2d')!;
  g.fillStyle = o.bg;
  g.fillRect(0, 0, canvas.width, canvas.height);
  const dark = isDark(o.bg);
  g.imageSmoothingQuality = 'high';

  if (o.title) {
    g.fillStyle = dark ? '#F4F4F5' : '#1F2328';
    g.font = `600 44px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(ellipsize(o.title, layout.width - 80, (s) => g.measureText(s).width), layout.width / 2, Math.max(o.gap, 24) + 52);
  }
  items.forEach((it, i) => {
    const cell = layout.cells[i];
    // 格子底色：与背景略有区别，完整显示时留白也好看
    g.fillStyle = dark ? '#2A2A2E' : o.bg.toUpperCase() === '#FFFFFF' ? '#F5F5F7' : '#FFFFFF';
    g.fillRect(cell.x, cell.y, cell.w, cell.h);
    const [w, h] = dims(it.img);
    const f = fitRect(w, h, cell, o.fit);
    g.save();
    g.beginPath();
    g.rect(cell.x, cell.y, cell.w, cell.h);
    g.clip();
    g.drawImage(it.img, f.sx, f.sy, f.sw, f.sh, f.dx, f.dy, f.dw, f.dh);
    g.restore();
    if (o.caption) {
      const cap = layout.captions[i];
      g.fillStyle = dark ? '#D4D4D8' : '#4B5563';
      g.font = `400 26px ${FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(ellipsize(captionOf(it.name), cap.w - 16, (s) => g.measureText(s).width), cap.x + cap.w / 2, cap.y + CAPTION_H / 2 + 2);
    }
  });
  drawWatermark(g, canvas.width, canvas.height, o, mark);
  return canvas;
}

function drawWatermark(g: CanvasRenderingContext2D, W: number, H: number, o: Options, mark: Src | null) {
  if (o.wm === 'none') return;
  const markW = (W * o.wmSize) / 100;
  let markH: number;
  let paint: (cx: number, cy: number) => void;
  if (o.wm === 'image' && mark) {
    const [mw, mh] = dims(mark);
    markH = (markW * mh) / mw;
    paint = (x, y) => g.drawImage(mark, x, y, markW, markH);
  } else {
    // 文字：把 100 像素字号下的宽度缩放到目标宽度
    g.font = `700 100px ${FONT}`;
    const k = markW / Math.max(1, g.measureText(o.wmText).width);
    const px = Math.max(12, Math.round(100 * k));
    g.font = `700 ${px}px ${FONT}`;
    markH = px * 1.2;
    const light = isDark(o.bg);
    paint = (x, y) => {
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      g.lineWidth = Math.max(1, px / 16);
      g.strokeStyle = light ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.75)';
      g.strokeText(o.wmText, x, y + markH / 2);
      g.fillStyle = light ? '#FFFFFF' : '#2B2B2B';
      g.fillText(o.wmText, x, y + markH / 2);
    };
  }
  g.save();
  g.globalAlpha = o.wmOpacity / 100;
  for (const p of watermarkPlacements(o.wmPosition, W, H, markW, markH)) {
    if (p.rot) {
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      paint(-markW / 2, -markH / 2);
      g.restore();
    } else paint(p.x, p.y);
  }
  g.restore();
}

export async function encodeCanvas(canvas: HTMLCanvasElement, format: 'png' | 'jpg', quality: number): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, format === 'png' ? 'image/png' : 'image/jpeg', format === 'png' ? undefined : quality / 100));
  if (!blob) throw new Error('编码失败，图片可能太大');
  return new Uint8Array(await blob.arrayBuffer());
}
