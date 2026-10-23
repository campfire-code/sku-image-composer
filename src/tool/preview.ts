// 截图与预览用的示例数据（不会进入正式运行）。图片是画布现画的色块，名字标「示例」。
import type { Params } from '../kit/types';
import type { Row } from '../kit/runner';
import { layoutFor, readOptions } from './flow';
import { drawSheet } from './render';
import { SAMPLE_WATERMARK, SWATCHES } from './sample';

function swatchCanvas(rgb: [number, number, number], round = false) {
  const c = document.createElement('canvas');
  c.width = c.height = 160;
  const g = c.getContext('2d')!;
  g.fillStyle = `rgb(${rgb.join(',')})`;
  g.fillRect(0, 0, 160, 160);
  g.fillStyle = 'rgba(255,255,255,0.25)';
  g.beginPath();
  g.arc(80, 80, round ? 30 : 38, 0, Math.PI * 2);
  g.fill();
  return c;
}
const swatch = (rgb: [number, number, number], round = false) => swatchCanvas(rgb, round).toDataURL('image/png');

/** 用真实的拼图代码画一张结果图，截图里显示的就是实际输出 */
function realSheet() {
  const o = readOptions(params);
  const items = SWATCHES.map((s, i) => ({ name: `示例-色卡-${String(i + 1).padStart(2, '0')}${s.name}.png`, img: swatchCanvas(s.rgb) }));
  return drawSheet(items, layoutFor(items.length, o), o, null).toDataURL('image/png');
}

const NAMES = [...SWATCHES.map((s, i) => `示例-色卡-${String(i + 1).padStart(2, '0')}${s.name}.png`), '示例-规格图-1S码.png', '示例-规格图-2M码.png', '示例-规格图-3L码.png'];

export const rows = (state: string): Row[] => {
  if (state === 'empty') return [];
  return NAMES.map((name, i) => {
    const rgb = (SWATCHES[i % SWATCHES.length]).rgb;
    const status: Row['status'] = state === 'done' ? 'ok' : i < 5 ? 'ok' : i === 5 ? 'run' : 'wait';
    return {
      item: { id: `s${i}`, name, path: swatch(rgb, i >= 6), size: 180_000 + i * 21_000 },
      status,
      progress: status === 'run' ? 0.5 : status === 'ok' ? 1 : 0,
      result: status === 'ok' ? { preview: i === 0 ? realSheet() : swatch(rgb, i >= 6), summary: i < 6 ? '600×600，等待拼图' : '900×600，等待拼图' } : undefined,
    };
  });
};

export const params: Params = { columns: 3, perSheet: 9, fit: 'cover', caption: true, title: '可选颜色（示例）', wm: 'text', wmText: SAMPLE_WATERMARK, wmPosition: 'tile', wmOpacity: 30 };
export const notice = { kind: 'ok' as const, text: '拼图会在所有图片读完后一次生成，保存在 /Users/demo/Downloads/SKU 规格图拼图加水印' };
