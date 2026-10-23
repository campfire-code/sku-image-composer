// 生成 samples/ 里的示例图片（只在设置了 MAKE_SAMPLES=1 时运行）。色卡和规格图是用代码画的渐变和圆形，不含任何品牌或他人作品。
import { it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { SWATCHES } from './sample';

const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
/** 写 PNG：channels=3 为 RGB，4 为 RGBA */
function png(w: number, h: number, channels: 3 | 4, pixel: (x: number, y: number) => number[]) {
  const stride = w * channels + 1;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set(pixel(x, y).map((v) => Math.max(0, Math.min(255, Math.round(v)))), y * stride + 1 + x * channels);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = channels === 4 ? 6 : 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

it.runIf(process.env.MAKE_SAMPLES === '1')('生成示例文件', () => {
  mkdirSync('samples', { recursive: true });
  // 色卡：600×600，从上到下略微变亮，中间一个浅色圆
  SWATCHES.forEach((s, i) => {
    writeFileSync(`samples/示例-色卡-${String(i + 1).padStart(2, '0')}${s.name}.png`, png(600, 600, 3, (x, y) => {
      const k = 1 + (y / 600) * 0.18;
      const d = Math.hypot(x - 300, y - 300) / 150;
      const lift = d < 1 ? 0.22 : 0;
      return s.rgb.map((v) => (v * k) + (255 - v) * lift);
    }));
  });
  // 规格图：横向 900×600（故意不是方形，用来试「完整显示」和「裁成方块」），灰底上一个按尺码递增的圆角块
  ['S码', 'M码', 'L码'].forEach((n, i) => {
    const hw = 120 + i * 70;
    const hh = 150 + i * 60;
    writeFileSync(`samples/示例-规格图-${i + 1}${n}.png`, png(900, 600, 3, (x, y) => {
      const inside = Math.abs(x - 450) < hw && Math.abs(y - 300) < hh;
      return inside ? [70, 90, 130] : [226 - (y / 600) * 14, 228 - (y / 600) * 14, 232 - (y / 600) * 14];
    }));
  });
  // 水印图片：透明背景的圆环，RGBA
  writeFileSync('samples/示例-水印图.png', png(400, 400, 4, (x, y) => {
    const d = Math.hypot(x - 200, y - 200);
    return d > 150 && d < 190 ? [255, 255, 255, 255] : d < 70 ? [255, 255, 255, 255] : [0, 0, 0, 0];
  }));
});
