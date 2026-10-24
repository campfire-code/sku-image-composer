// 工具声明：SKU 规格图拼图加水印（在本机用浏览器引擎完成，不联网、不上传）。
import { LayoutGrid as LayoutGridAsIcon } from 'lucide-react';
import type { BatchTool } from '../kit/types';
import { composeAll, optionProblem, readOptions } from './flow';
import { Empty, ResultBody, type CellData } from './ui';
import { drawSheet, encodeCanvas, loadImage } from './render';

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'];

const tool: BatchTool = {
  id: 'e08',
  name: 'SKU 规格图拼图加水印',
  tagline: '把一批规格图、色卡按文件名顺序排成网格，每格下面写文件名，再整张加文字或图片水印，导出 PNG / JPG。不联网、不上传。',
  icon: LayoutGridAsIcon,
  category: '电商运营',
  type: 'media',
  mode: 'batch',
  resultView: 'list',
  Empty,
  ResultBody,
  concurrency: 3,
  accept: { label: '规格图 / 色卡', extensions: IMAGE_EXT },
  params: [
    { key: 'columns', label: '每行几格', type: 'number', default: 3, min: 1, max: 8 },
    { key: 'perSheet', label: '每张拼图最多几格', type: 'number', default: 9, min: 0, max: 100, help: '0 = 全部拼在一张里；超过就自动分成多张' },
    { key: 'cell', label: '每格边长', type: 'number', default: 600, min: 200, max: 1600, unit: '像素', help: '整张图太大（单边超过 16000 像素）时会提示' },
    { key: 'gap', label: '格间距', type: 'number', default: 24, min: 0, max: 120, unit: '像素' },
    { key: 'fit', label: '图片放进格子的方式', type: 'segment', options: [['contain', '完整显示'], ['cover', '裁成方块']], default: 'contain', help: '色卡建议「裁成方块」，规格图建议「完整显示」' },
    { key: 'caption', label: '格子下面写文件名', type: 'toggle', default: true, help: '文件名去掉扩展名后写在图下方，所以先把文件改成「红色」「大码」这样的名字' },
    { key: 'title', label: '顶部标题', type: 'text', default: '', placeholder: '可选，例如：可选颜色' },
    { key: 'bg', label: '背景色', type: 'segment', options: [['#FFFFFF', '白色'], ['#F3F4F6', '浅灰'], ['#1F2024', '深色']], default: '#FFFFFF' },
    { key: 'wm', label: '水印', type: 'segment', options: [['none', '不加'], ['text', '文字'], ['image', '图片']], default: 'text' },
    { key: 'wmText', label: '水印文字', type: 'text', when: (p) => p.wm === 'text', default: '示例店铺', placeholder: '例如店铺名' },
    { key: 'wmImage', label: '水印图片', type: 'file', when: (p) => p.wm === 'image', extensions: ['png', 'jpg', 'jpeg', 'webp'], fileLabel: '图片', default: '', help: '建议用透明背景的 PNG' },
    { key: 'wmPosition', label: '水印位置', type: 'select', when: (p) => p.wm !== 'none', options: [['br', '右下角'], ['bl', '左下角'], ['tr', '右上角'], ['tl', '左上角'], ['center', '正中'], ['tile', '斜着铺满']], default: 'br' },
    { key: 'wmOpacity', label: '水印不透明度', type: 'number', when: (p) => p.wm !== 'none', default: 40, min: 5, max: 100, unit: '%' },
    { key: 'wmSize', label: '水印宽度', type: 'number', when: (p) => p.wm !== 'none', default: 20, min: 5, max: 80, unit: '% 图宽', help: '铺满时是每个水印的宽度' },
    { key: 'format', label: '输出格式', type: 'segment', options: [['png', 'PNG'], ['jpg', 'JPG']], default: 'png' },
    { key: 'quality', label: 'JPG 质量', type: 'number', when: (p) => p.format === 'jpg', default: 92, min: 50, max: 100, unit: '%' },
    { key: 'out', label: '保存到', type: 'folder', default: '' },
  ],
  check: (item) => (item.size != null && item.size > 100 * 1024 * 1024 ? '文件超过 100 MB' : null),

  // 每张图先检查能不能读出来；拼图在整批处理完后一次做完
  async run(item, ctx) {
    const bad = optionProblem(readOptions(ctx.params));
    if (bad) throw new Error(bad);
    const img = await loadImage(await ctx.readFile(item.path!));
    const o = readOptions(ctx.params);
    const data: CellData = { w: img.naturalWidth, h: img.naturalHeight, fit: o.fit, caption: o.caption, bg: o.bg, wm: o.wm, wmText: o.wmText, wmPosition: o.wmPosition, wmOpacity: o.wmOpacity };
    return { preview: item.path, summary: `${img.naturalWidth}×${img.naturalHeight}，等待拼图`, data };
  },

  async afterAll(results, ctx) {
    const o = readOptions(ctx.params);
    const items = results.map((r) => ({ name: r.item.name, path: r.item.path! }));
    const report = await composeAll(ctx, ctx.outputDir, items, o, {
      load: loadImage,
      loadMark: loadImage,
      render: async (list, layout, opt, mark) => encodeCanvas(drawSheet(list, layout, opt, mark), opt.format, opt.quality),
    }, ctx.progress);
    const skip = report.skipped.length ? `，${report.skipped.length} 张读不出来已跳过（${report.skipped.map((s) => s.name).join('、')}）` : '';
    return `已拼成 ${report.sheets} 张，保存在 ${ctx.outputDir}${skip}`;
  },
};

export default tool;
