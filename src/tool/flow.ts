// 拼图流程：把一批图片分成若干张拼图，逐张画出、加水印、保存。
// 画图和读写都从外面传进来，方便用假的画图函数和内存文件系统测试。
import { chunk, clampNum, gridLayout, sheetName, sizeProblem, type GridLayout, type Fit, type OutFormat, type WmPosition } from './core';

export interface Options {
  columns: number;
  cell: number;
  gap: number;
  fit: Fit;
  caption: boolean;
  perSheet: number;
  bg: string;
  title: string;
  wm: 'none' | 'text' | 'image';
  wmText: string;
  wmImagePath: string;
  wmPosition: WmPosition;
  wmOpacity: number;
  wmSize: number;
  format: OutFormat;
  quality: number;
}

const POSITIONS = ['br', 'bl', 'tr', 'tl', 'center', 'tile'];

/** 把界面参数整理成选项：范围外的数字拉回范围，不认识的取值用默认 */
export function readOptions(p: Record<string, string | number | boolean>): Options {
  const wm = p.wm === 'text' || p.wm === 'image' ? p.wm : 'none';
  return {
    columns: Math.round(clampNum(p.columns, 1, 8, 3)),
    cell: Math.round(clampNum(p.cell, 200, 1600, 600)),
    gap: Math.round(clampNum(p.gap, 0, 120, 24)),
    fit: p.fit === 'cover' ? 'cover' : 'contain',
    caption: p.caption !== false,
    perSheet: Math.round(clampNum(p.perSheet, 0, 100, 9)),
    bg: /^#[0-9a-f]{6}$/i.test(String(p.bg)) ? String(p.bg) : '#FFFFFF',
    title: String(p.title ?? '').trim().slice(0, 40),
    wm,
    wmText: String(p.wmText ?? '').trim().slice(0, 40),
    wmImagePath: String(p.wmImage ?? ''),
    wmPosition: (POSITIONS.includes(String(p.wmPosition)) ? p.wmPosition : 'br') as WmPosition,
    wmOpacity: Math.round(clampNum(p.wmOpacity, 5, 100, 40)),
    wmSize: Math.round(clampNum(p.wmSize, 5, 80, 20)),
    format: p.format === 'jpg' ? 'jpg' : 'png',
    quality: Math.round(clampNum(p.quality, 50, 100, 92)),
  };
}

/** 参数检查：返回要告诉用户的问题，没问题返回 null */
export function optionProblem(o: Options): string | null {
  if (o.wm === 'text' && !o.wmText) return '水印选了「文字」，但还没填水印文字';
  if (o.wm === 'image' && !o.wmImagePath) return '水印选了「图片」，但还没选水印图片';
  return null;
}

export const CAPTION_H = 56;
export const TITLE_H = 120;

export function layoutFor(count: number, o: Options): GridLayout {
  return gridLayout({ count, columns: o.columns, cell: o.cell, gap: o.gap, margin: Math.max(o.gap, 24), captionH: o.caption ? CAPTION_H : 0, titleH: o.title ? TITLE_H : 0 });
}

export interface SheetInput { name: string; path: string }

export interface FlowIO {
  join(...parts: string[]): Promise<string>;
  readFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
}

export interface Deps<Img, Mark> {
  load(bytes: Uint8Array): Promise<Img>;
  loadMark(bytes: Uint8Array): Promise<Mark>;
  /** 画出一张拼图并编码成文件内容 */
  render(items: { name: string; img: Img }[], layout: GridLayout, o: Options, mark: Mark | null, sheetNo: number): Promise<Uint8Array>;
}

export interface Report {
  files: string[];
  sheets: number;
  /** 读不出来被跳过的图片 */
  skipped: { name: string; reason: string }[];
}

/** 逐张拼图并保存；单张图读不出来时跳过并记下，不影响其他图 */
export async function composeAll<Img, Mark>(
  io: FlowIO, outDir: string, items: SheetInput[], o: Options, deps: Deps<Img, Mark>, progress?: (r: number) => void,
): Promise<Report> {
  const bad = optionProblem(o);
  if (bad) throw new Error(bad);
  if (!items.length) throw new Error('没有可拼的图片');
  const groups = chunk(items, o.perSheet);
  // 先算好最大一张的尺寸，超限时一张都不画
  const big = layoutFor(Math.max(...groups.map((g) => g.length)), o);
  const problem = sizeProblem(big.width, big.height);
  if (problem) throw new Error(problem);

  const mark = o.wm === 'image' ? await io.readFile(o.wmImagePath).then(deps.loadMark).catch(() => { throw new Error('水印图片读不出来，请换一张 PNG 或 JPG'); }) : null;
  const report: Report = { files: [], sheets: 0, skipped: [] };
  let done = 0;
  for (let gi = 0; gi < groups.length; gi++) {
    const loaded: { name: string; img: Img }[] = [];
    for (const it of groups[gi]) {
      try {
        loaded.push({ name: it.name, img: await deps.load(await io.readFile(it.path)) });
      } catch (e) {
        report.skipped.push({ name: it.name, reason: e instanceof Error ? e.message : String(e) });
      }
      progress?.(++done / items.length * 0.9);
    }
    if (!loaded.length) continue;
    const data = await deps.render(loaded, layoutFor(loaded.length, o), o, mark, gi);
    const path = await io.join(outDir, sheetName(gi, groups.length, o.format));
    await io.writeFile(path, data);
    report.files.push(path);
    report.sheets++;
  }
  progress?.(1);
  if (!report.files.length) throw new Error('所有图片都读不出来，没有生成拼图');
  return report;
}
