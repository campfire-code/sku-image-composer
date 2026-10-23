import { describe, expect, it } from 'vitest';
import { composeAll, optionProblem, readOptions, type Deps, type FlowIO } from './flow';

function fakeIO(files: Record<string, string>) {
  const written = new Map<string, Uint8Array>();
  const io: FlowIO = {
    join: async (...p) => p.join('/'),
    readFile: async (p) => {
      if (!(p in files)) throw new Error('找不到文件');
      return new TextEncoder().encode(files[p]);
    },
    writeFile: async (p, d) => void written.set(p, d),
  };
  return { io, written };
}

const o = (extra: Record<string, string | number | boolean> = {}) => readOptions({ perSheet: 2, columns: 2, cell: 300, wm: 'none', ...extra });

function deps(log: string[]): Deps<string, string> {
  return {
    load: async (b) => {
      const t = new TextDecoder().decode(b);
      if (t === 'BAD') throw new Error('无法识别这张图片');
      return t;
    },
    loadMark: async (b) => new TextDecoder().decode(b),
    render: async (items, layout, _o, mark, no) => {
      log.push(`${no}:${items.map((i) => i.img).join('+')}:${layout.width}x${layout.height}:${mark ?? '-'}`);
      return new Uint8Array([no]);
    },
  };
}

describe('读取参数', () => {
  it('缺省值与越界值被整理', () => {
    const d = readOptions({});
    expect(d).toMatchObject({ columns: 3, cell: 600, gap: 24, fit: 'contain', caption: true, perSheet: 9, wm: 'none', format: 'png' });
    expect(readOptions({ columns: 99, cell: 10, wm: 'xx', format: 'jpg', bg: 'red' })).toMatchObject({ columns: 8, cell: 200, wm: 'none', format: 'jpg', bg: '#FFFFFF' });
  });
  it('选了文字/图片水印却没填内容时报错', () => {
    expect(optionProblem(readOptions({ wm: 'text', wmText: ' ' }))).toContain('水印文字');
    expect(optionProblem(readOptions({ wm: 'image', wmImage: '' }))).toContain('水印图片');
    expect(optionProblem(readOptions({ wm: 'text', wmText: '示例店铺' }))).toBeNull();
  });
});

describe('拼图流程', () => {
  const files = { '/a.png': 'A', '/b.png': 'B', '/c.png': 'C', '/bad.png': 'BAD', '/mark.png': 'M' };
  const items = [{ name: 'a.png', path: '/a.png' }, { name: 'b.png', path: '/b.png' }, { name: 'c.png', path: '/c.png' }];

  it('3 张图每张最多 2 格：分成 2 张拼图，文件名带序号，版式按实际格数计算', async () => {
    const { io, written } = fakeIO(files);
    const log: string[] = [];
    const prog: number[] = [];
    const r = await composeAll(io, '/出', items, o(), deps(log), (x) => prog.push(x));
    expect(r.files).toEqual(['/出/拼图-01.png', '/出/拼图-02.png']);
    // 第 1 张 2 格 2 列：宽 24*2+300*2+24=672；高 24*2+356=404。第 2 张 1 格：宽 348
    expect(log).toEqual(['0:A+B:672x404:-', '1:C:348x404:-']);
    expect([...written.keys()]).toEqual(r.files);
    expect(prog[prog.length - 1]).toBe(1);
  });
  it('图片水印：水印图只读一次并传给每张拼图', async () => {
    const { io } = fakeIO(files);
    const log: string[] = [];
    await composeAll(io, '/出', items, o({ wm: 'image', wmImage: '/mark.png' }), deps(log));
    expect(log.every((l) => l.endsWith(':M'))).toBe(true);
    expect(log).toHaveLength(2);
  });
  it('有一张图读不出来：跳过并记下，其他照常拼', async () => {
    const { io } = fakeIO(files);
    const log: string[] = [];
    const r = await composeAll(io, '/出', [items[0], { name: 'bad.png', path: '/bad.png' }, items[2]], o(), deps(log));
    expect(r.skipped).toEqual([{ name: 'bad.png', reason: '无法识别这张图片' }]);
    // 按原始顺序先分组 [A, bad] [C]，所以第 1 张只剩 A
    expect(log).toEqual(['0:A:348x404:-', '1:C:348x404:-']);
  });
  it('全部读不出来、没有图、水印图读不出来、尺寸超限：都报错且不写文件', async () => {
    const { io, written } = fakeIO(files);
    await expect(composeAll(io, '/出', [{ name: 'bad.png', path: '/bad.png' }], o(), deps([]))).rejects.toThrow('都读不出来');
    await expect(composeAll(io, '/出', [], o(), deps([]))).rejects.toThrow('没有可拼的图片');
    await expect(composeAll(io, '/出', items, o({ wm: 'image', wmImage: '/nope.png' }), deps([]))).rejects.toThrow('水印图片读不出来');
    const many = Array.from({ length: 40 }, (_, i) => ({ name: `${i}.png`, path: '/a.png' }));
    await expect(composeAll(io, '/出', many, readOptions({ perSheet: 0, columns: 1, cell: 600 }), deps([]))).rejects.toThrow('16000');
    expect(written.size).toBe(0);
  });
  it('JPG 输出时文件扩展名是 .jpg', async () => {
    const { io } = fakeIO(files);
    const r = await composeAll(io, '/出', items, o({ format: 'jpg', perSheet: 0 }), deps([]));
    expect(r.files).toEqual(['/出/拼图-01.jpg']);
  });
});
