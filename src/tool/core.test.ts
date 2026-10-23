import { describe, expect, it } from 'vitest';
import { captionOf, chunk, clampNum, ellipsize, fitRect, gridLayout, isDark, sheetName, sizeProblem, watermarkPlacements } from './core';

describe('分张', () => {
  it('每张最多 4 个：10 个分成 4+4+2；0 表示全部一张；空列表没有拼图', () => {
    expect(chunk([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 4).map((g) => g.length)).toEqual([4, 4, 2]);
    expect(chunk([1, 2, 3], 0)).toEqual([[1, 2, 3]]);
    expect(chunk([1, 2, 3], 9)).toEqual([[1, 2, 3]]);
    expect(chunk([], 4)).toEqual([]);
  });
});

describe('网格版式', () => {
  const base = { cell: 600, gap: 24, margin: 24, captionH: 56, titleH: 0 };
  it('3 列 6 格：宽 = 两侧留白 + 3 格 + 2 个间距，高 = 留白 + 2 行 + 1 个间距', () => {
    const l = gridLayout({ ...base, count: 6, columns: 3 });
    expect(l.width).toBe(24 * 2 + 3 * 600 + 2 * 24);
    expect(l.height).toBe(24 * 2 + 2 * 656 + 24);
    expect(l.rows).toBe(2);
    expect(l.cells[0]).toEqual({ x: 24, y: 24, w: 600, h: 600 });
    expect(l.cells[4]).toEqual({ x: 24 + 624, y: 24 + 680, w: 600, h: 600 });
    expect(l.captions[4]).toEqual({ x: 24 + 624, y: 24 + 680 + 600, w: 600, h: 56 });
  });
  it('5 格 3 列：最后一行 2 格居中', () => {
    const l = gridLayout({ ...base, count: 5, columns: 3 });
    // 整行内容宽 1848，最后一行 2 格宽 1224，左右各空 312
    expect(l.cells[3].x).toBe(24 + 312);
    expect(l.cells[4].x).toBe(24 + 312 + 624);
  });
  it('格数比列数少时列数缩到格数；有标题时整体下移；不写文件名时文字区高度为 0', () => {
    const l = gridLayout({ ...base, count: 2, columns: 5, captionH: 0, titleH: 120 });
    expect(l.columns).toBe(2);
    expect(l.cells[0].y).toBe(24 + 120);
    expect(l.captions[0].h).toBe(0);
    expect(l.height).toBe(24 * 2 + 120 + 600);
  });
  it('单边超过 16000 像素时给出说明，否则通过', () => {
    expect(sizeProblem(16000, 100)).toBeNull();
    expect(sizeProblem(1800, 16001)).toContain('16000');
  });
});

describe('图片适配', () => {
  const box = { x: 100, y: 200, w: 600, h: 600 };
  it('完整显示：2:1 的横图宽度铺满、上下留白居中', () => {
    const f = fitRect(1200, 600, box, 'contain');
    expect([f.dx, f.dy, f.dw, f.dh]).toEqual([100, 350, 600, 300]);
    expect([f.sx, f.sy, f.sw, f.sh]).toEqual([0, 0, 1200, 600]);
  });
  it('完整显示：小图最多放大 4 倍，不会糊成一片', () => {
    const f = fitRect(50, 50, box, 'contain');
    expect(f.dw).toBe(200);
    expect(f.dx).toBe(300);
  });
  it('裁成方块：2:1 的横图左右各裁掉 300 像素', () => {
    const f = fitRect(1200, 600, box, 'cover');
    expect([f.sx, f.sy, f.sw, f.sh]).toEqual([300, 0, 600, 600]);
    expect([f.dx, f.dy, f.dw, f.dh]).toEqual([100, 200, 600, 600]);
  });
});

describe('水印位置', () => {
  it('右下角：水印右边、下边距图边各 3%（取短边）', () => {
    const [p] = watermarkPlacements('br', 2000, 1000, 400, 80);
    expect(p).toEqual({ x: 2000 - 400 - 30, y: 1000 - 80 - 30, rot: 0 });
  });
  it('四个角和正中', () => {
    expect(watermarkPlacements('tl', 2000, 1000, 400, 80)[0]).toMatchObject({ x: 30, y: 30 });
    expect(watermarkPlacements('tr', 2000, 1000, 400, 80)[0]).toMatchObject({ x: 1570, y: 30 });
    expect(watermarkPlacements('bl', 2000, 1000, 400, 80)[0]).toMatchObject({ x: 30, y: 890 });
    expect(watermarkPlacements('center', 2000, 1000, 400, 80)[0]).toMatchObject({ x: 800, y: 460 });
  });
  it('斜着铺满：多处、全部旋转 -30°，且四个象限都有水印', () => {
    const ps = watermarkPlacements('tile', 1800, 1200, 360, 70);
    expect(ps.length).toBeGreaterThan(8);
    expect(ps.every((p) => Math.abs(p.rot + Math.PI / 6) < 1e-9)).toBe(true);
    expect(ps.some((p) => p.x < 900 && p.y < 600)).toBe(true);
    expect(ps.some((p) => p.x > 900 && p.y > 600)).toBe(true);
  });
});

describe('文字与文件名', () => {
  it('说明文字去掉扩展名；没有扩展名或以点开头时原样', () => {
    expect(captionOf('红色.png')).toBe('红色');
    expect(captionOf('XL 码.v2.jpg')).toBe('XL 码.v2');
    expect(captionOf('.hidden')).toBe('.hidden');
  });
  it('过长文字按宽度截断加省略号，够短时不动', () => {
    const m = (s: string) => s.length * 10;
    expect(ellipsize('短名字', 100, m)).toBe('短名字');
    expect(ellipsize('一二三四五六七八九十一二', 100, m)).toBe('一二三四五六七八九…');
    expect(ellipsize('很长', 5, m)).toBe('…');
  });
  it('拼图文件名按总数补零：9 张用两位，120 张用三位', () => {
    expect(sheetName(0, 9, 'png')).toBe('拼图-01.png');
    expect(sheetName(11, 120, 'jpg')).toBe('拼图-012.jpg');
  });
  it('判断深浅色背景', () => {
    expect(isDark('#1F2024')).toBe(true);
    expect(isDark('#FFFFFF')).toBe(false);
    expect(isDark('不是颜色')).toBe(false);
  });
  it('参数拉回范围，不是数字时用默认', () => {
    expect(clampNum('abc', 1, 8, 3)).toBe(3);
    expect(clampNum(99, 1, 8, 3)).toBe(8);
    expect(clampNum(-5, 1, 8, 3)).toBe(1);
  });
});
