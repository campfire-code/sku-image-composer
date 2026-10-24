// 界面：空状态（一堆散图 → 一张带文件名和水印的拼图）和单张结果（这张图放进格子后的样子）。
import { ArrowRight } from 'lucide-react';
import type { InputItem, ItemResult } from '../kit/types';
import { fileSrc } from '../kit/platform';
import { SAMPLE_WATERMARK, SWATCHES } from './sample';
import './tool.css';

/** 随结果带出的明细，只用来画结果，不写入文件 */
export interface CellData {
  w: number;
  h: number;
  fit: 'contain' | 'cover';
  caption: boolean;
  bg: string;
  wm: 'none' | 'text' | 'image';
  wmText: string;
  wmPosition: string;
  wmOpacity: number;
}

const nameOf = (n: string) => n.replace(/\.[^.]+$/, '');
const dark = (hex: string) => {
  const v = parseInt(hex.slice(1), 16);
  return ((v >> 16) * 299 + ((v >> 8) & 255) * 587 + (v & 255) * 114) / 1000 < 110;
};

export function Empty() {
  const rgb = (c: [number, number, number]) => `rgb(${c.join(',')})`;
  return (
    <div className="sc-empty">
      <div className="sc-empty-hd">
        <h2>几张色卡规格图，拼成一张带名字的图</h2>
        <p>按列表顺序排成网格，每格下面写文件名，再整张盖上水印；一张放不下就自动分成多张。</p>
      </div>
      <div className="sc-flow" aria-hidden="true">
        <div className="sc-pile">
          {SWATCHES.slice(0, 4).map((s, i) => (
            <span key={s.name} className="sc-card" style={{ background: rgb(s.rgb), ['--i' as string]: i }} />
          ))}
        </div>
        <ArrowRight size={22} className="sc-arrow" />
        <div className="sc-sheet">
          <b className="sc-sheet-title">可选颜色</b>
          <div className="sc-grid">
            {SWATCHES.map((s) => (
              <span key={s.name} className="sc-slot"><i style={{ background: rgb(s.rgb) }} /><small>{s.name}</small></span>
            ))}
          </div>
          <span className="sc-mark">{SAMPLE_WATERMARK}</span>
        </div>
      </div>
    </div>
  );
}

const MARK_POS: Record<string, string> = {
  br: 'right: 6%; bottom: 6%', bl: 'left: 6%; bottom: 6%', tr: 'right: 6%; top: 6%', tl: 'left: 6%; top: 6%',
  center: 'left: 50%; top: 50%; transform: translate(-50%, -50%)',
};
const posStyle = (p: string) => Object.fromEntries((MARK_POS[p] ?? MARK_POS.br).split('; ').map((s) => s.split(': '))) as React.CSSProperties;

export function ResultBody({ item, result }: { item: InputItem; result: ItemResult }) {
  const d = result.data as CellData | undefined;
  if (!d) return <p className="sc-plain">{result.summary}</p>;
  const long = Math.max(d.w, d.h);
  const cut = Math.round((1 - Math.min(d.w, d.h) / long) * 100);
  const how = d.fit === 'cover'
    ? (cut > 0 ? `裁成方块，${d.w > d.h ? '左右' : '上下'}共裁掉 ${cut}%` : '本来就是方块，不用裁')
    : (cut > 0 ? `完整显示，${d.w > d.h ? '上下' : '左右'}留空` : '完整显示，正好填满');
  const light = !dark(d.bg);
  return (
    <figure className="sc-cell">
      <div className="sc-cell-box" style={{ background: d.bg, color: light ? '#1F2024' : '#F3F4F6' }}>
        <span className="sc-cell-img">{item.path && <img src={fileSrc(item.path)} alt="" style={{ objectFit: d.fit }} />}</span>
        {d.caption && <span className="sc-cell-cap">{nameOf(item.name)}</span>}
        {d.wm === 'text' && d.wmText && d.wmPosition !== 'tile' && <span className="sc-cell-mark" style={{ ...posStyle(d.wmPosition), opacity: d.wmOpacity / 100 }}>{d.wmText}</span>}
        {d.wm === 'text' && d.wmText && d.wmPosition === 'tile' && <span className="sc-cell-tile" style={{ opacity: d.wmOpacity / 100 }}>{Array.from({ length: 6 }, (_, i) => <i key={i}>{d.wmText}</i>)}</span>}
      </div>
      <figcaption><b className="k-num">{d.w}×{d.h}</b><span className="k-muted">{how}</span></figcaption>
    </figure>
  );
}
