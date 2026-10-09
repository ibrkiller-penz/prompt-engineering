// 감염병 막기의 그림 부품(만화풍 마을·친구 얼굴). 게임 로직은 epidemic.tsx / epidemic.logic.ts 에 있어요.
import { I, R, S, V } from "./epidemic.logic";

export const EPI_CSS = `
.epi-jump{opacity:0}
@media (prefers-reduced-motion: no-preference){
.epi-wob{animation:epi-wob 1.1s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.epi-tw{animation:epi-tw 1.6s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.epi-jump{animation:epi-jump .75s ease-out both;transform-box:fill-box;transform-origin:center}
.epi-party .epi-face{animation:epi-hop .45s ease-in-out 4;transform-box:fill-box;transform-origin:center bottom}
.epi-shake{animation:epi-shake .5s ease-in-out 1}
.epi-sway{animation:epi-sway 3s ease-in-out infinite;transform-box:fill-box;transform-origin:center bottom}
}
@keyframes epi-wob{0%,100%{transform:rotate(-7deg)}50%{transform:rotate(7deg)}}
@keyframes epi-tw{0%,100%{transform:scale(.5);opacity:.4}50%{transform:scale(1.25);opacity:1}}
@keyframes epi-jump{0%{transform:translateY(-24px) scale(.4);opacity:0}35%{transform:translateY(0) scale(1.2);opacity:1}55%{transform:translateY(-7px) scale(.95);opacity:1}75%{transform:translateY(0) scale(1);opacity:1}100%{transform:translateY(0) scale(.5);opacity:0}}
@keyframes epi-hop{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px) scale(1.08)}}
@keyframes epi-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-9px)}40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(3px)}}
@keyframes epi-sway{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}
`;

/** 그라데이션 모음(한 번만 넣기) */
export function EpiDefs() {
  const g = (id: string, a: string, b: string) => (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor={a} />
      <stop offset="1" stopColor={b} />
    </linearGradient>
  );
  return (
    <defs>
      {g("epi-grass", "#a7f3a0", "#4ade80")}
      {g("epi-sand", "#fff1c9", "#fcd99a")}
      {g("epi-tS", "#ecfccb", "#bef264")}
      {g("epi-tI", "#ffe4e6", "#fda4af")}
      {g("epi-tR", "#d1fae5", "#6ee7b7")}
      {g("epi-tV", "#e0f2fe", "#93c5fd")}
      {g("epi-fS", "#fff3b0", "#ffc53d")}
      {g("epi-fI", "#ffc2c2", "#ff5d5d")}
      {g("epi-fR", "#c7f9d4", "#2fcf7f")}
      {g("epi-fV", "#bfe0ff", "#3b82f6")}
      {g("epi-vir", "#d8b4fe", "#9333ea")}
    </defs>
  );
}

const TILE: Record<number, [string, string]> = { [S]: ["url(#epi-tS)", "#84cc16"], [I]: ["url(#epi-tI)", "#f43f5e"], [R]: ["url(#epi-tR)", "#10b981"], [V]: ["url(#epi-tV)", "#3b82f6"] };

/** 친구 얼굴 하나. (cx,cy) 가운데, 반지름 약 13 */
export function Face({ s, cx, cy }: { s: number; cx: number; cy: number }) {
  const ink = "#3b2a2a";
  if (s === V)
    return (
      <g className="epi-face">
        <path d={`M${cx} ${cy - 15} L${cx + 13} ${cy - 10} V${cy + 1} Q${cx + 13} ${cy + 11} ${cx} ${cy + 16} Q${cx - 13} ${cy + 11} ${cx - 13} ${cy + 1} V${cy - 10} Z`} fill="url(#epi-fV)" stroke="#1d4ed8" strokeWidth={2} strokeLinejoin="round" />
        <path d={`M${cx - 8} ${cy - 9} L${cx} ${cy - 12} L${cx + 3} ${cy - 11}`} stroke="#fff" strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.7} />
        <ellipse cx={cx - 4.5} cy={cy - 1} rx={1.8} ry={2.4} fill="#0b2a6b" />
        <ellipse cx={cx + 4.5} cy={cy - 1} rx={1.8} ry={2.4} fill="#0b2a6b" />
        <path d={`M${cx - 4.5} ${cy + 4} Q${cx} ${cy + 8.5} ${cx + 4.5} ${cy + 4}`} stroke="#0b2a6b" strokeWidth={1.8} fill="none" strokeLinecap="round" />
        <path className="epi-tw" d={`M${cx + 11} ${cy - 17} l1.4 3.6 3.6 1.4 -3.6 1.4 -1.4 3.6 -1.4 -3.6 -3.6 -1.4 3.6 -1.4z`} fill="#fff" stroke="#93c5fd" strokeWidth={0.6} />
      </g>
    );
  const fill = s === I ? "url(#epi-fI)" : s === R ? "url(#epi-fR)" : "url(#epi-fS)";
  const stroke = s === I ? "#c81e1e" : s === R ? "#059669" : "#d99a0b";
  return (
    <g className={`epi-face ${s === I ? "epi-wob" : ""}`}>
      <circle cx={cx} cy={cy} r={13} fill={fill} stroke={stroke} strokeWidth={2} />
      <ellipse cx={cx - 4} cy={cy - 7} rx={4} ry={2.2} fill="#fff" opacity={0.55} />
      {s === S && (
        <>
          <ellipse cx={cx - 4.5} cy={cy - 1.5} rx={1.7} ry={2.3} fill={ink} />
          <ellipse cx={cx + 4.5} cy={cy - 1.5} rx={1.7} ry={2.3} fill={ink} />
          <path d={`M${cx - 5} ${cy + 3.5} Q${cx} ${cy + 8.5} ${cx + 5} ${cy + 3.5}`} stroke={ink} strokeWidth={1.8} fill="none" strokeLinecap="round" />
          <circle cx={cx - 8} cy={cy + 3} r={2.2} fill="#ff8fa3" opacity={0.6} />
          <circle cx={cx + 8} cy={cy + 3} r={2.2} fill="#ff8fa3" opacity={0.6} />
        </>
      )}
      {s === I && (
        <>
          <path d={`M${cx - 7} ${cy - 4} l3 2 -3 2 M${cx + 7} ${cy - 4} l-3 2 3 2`} stroke={ink} strokeWidth={1.7} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d={`M${cx - 5} ${cy + 5} q1.7 -2 3.3 0 q1.7 2 3.3 0`} stroke={ink} strokeWidth={1.6} fill="none" strokeLinecap="round" />
          <circle cx={cx - 8.5} cy={cy + 2} r={2.8} fill="#e11d48" opacity={0.65} />
          <circle cx={cx + 8.5} cy={cy + 2} r={2.8} fill="#e11d48" opacity={0.65} />
          <line x1={cx + 2} y1={cy + 6} x2={cx + 11} y2={cy + 12} stroke="#fff" strokeWidth={3.2} strokeLinecap="round" />
          <line x1={cx + 2} y1={cy + 6} x2={cx + 11} y2={cy + 12} stroke="#94a3b8" strokeWidth={0.8} strokeLinecap="round" />
          <circle cx={cx + 11.5} cy={cy + 12.3} r={2.3} fill="#ef4444" stroke="#991b1b" strokeWidth={0.7} />
          <path d={`M${cx + 10} ${cy - 15} q3 4 0 6 q-3 -2 0 -6z`} fill="#7dd3fc" stroke="#0284c7" strokeWidth={0.7} />
        </>
      )}
      {s === R && (
        <>
          {[-4.8, 4.8].map((dx) => (
            <path key={dx} d={`M${cx + dx} ${cy - 5.2} l1.1 2.3 2.5 .3 -1.8 1.7 .5 2.5 -2.3 -1.2 -2.3 1.2 .5 -2.5 -1.8 -1.7 2.5 -.3z`} fill="#facc15" stroke="#a16207" strokeWidth={0.6} />
          ))}
          <path d={`M${cx - 5.5} ${cy + 3} Q${cx} ${cy + 10} ${cx + 5.5} ${cy + 3} Z`} fill="#9f1239" stroke="#4c0519" strokeWidth={1} strokeLinejoin="round" />
          <circle cx={cx - 8.5} cy={cy + 3} r={2.2} fill="#ff8fa3" opacity={0.6} />
          <circle cx={cx + 8.5} cy={cy + 3} r={2.2} fill="#ff8fa3" opacity={0.6} />
        </>
      )}
    </g>
  );
}

/** 집 마당 한 칸 + 친구 얼굴 */
export function Tile({ s, x, y, size, manual }: { s: number; x: number; y: number; size: number; manual: boolean }) {
  const [fill, stroke] = TILE[s];
  return (
    <g>
      <rect x={x + 2.5} y={y + 4.5} width={size - 5} height={size - 5} rx={10} fill="#000" opacity={0.12} />
      <rect x={x + 2.5} y={y + 2.5} width={size - 5} height={size - 5} rx={10} fill={fill} stroke={manual ? "#1d4ed8" : stroke} strokeWidth={manual ? 2.6 : 1.6} />
      <Face s={s} cx={x + size / 2} cy={y + size / 2 + 0.5} />
    </g>
  );
}

/** 막 옮은 칸에 통통 튀어 들어가는 바이러스 */
export function VirusPop({ cx, cy }: { cx: number; cy: number }) {
  const spikes = Array.from({ length: 7 }, (_, k) => {
    const a = (k / 7) * Math.PI * 2;
    return <circle key={k} cx={cx + Math.cos(a) * 8} cy={cy - 10 + Math.sin(a) * 8} r={2} fill="#c084fc" stroke="#6b21a8" strokeWidth={0.8} />;
  });
  return (
    <g className="epi-jump" pointerEvents="none">
      {spikes}
      <circle cx={cx} cy={cy - 10} r={7} fill="url(#epi-vir)" stroke="#6b21a8" strokeWidth={1.4} />
      <circle cx={cx - 2.2} cy={cy - 11} r={1.2} fill="#fff" />
      <circle cx={cx + 2.2} cy={cy - 11} r={1.2} fill="#fff" />
      <path d={`M${cx - 2} ${cy - 7.5} q2 -1.6 4 0`} stroke="#fff" strokeWidth={1} fill="none" strokeLinecap="round" />
    </g>
  );
}

/** 마을 둘레: 울타리 같은 덤불과 나무·꽃 (판 바깥 여백에 그려요) */
export function VillageFrame({ w, pad }: { w: number; pad: number }) {
  const trees = [
    [-pad / 2, -pad / 2],
    [w + pad / 2, -pad / 2],
    [-pad / 2, w + pad / 2],
    [w + pad / 2, w + pad / 2],
  ];
  const flowers = Array.from({ length: 10 }, (_, k) => {
    const t = (k + 0.5) / 10;
    return k % 2 ? [t * w, -pad / 2] : [t * w, w + pad / 2];
  });
  return (
    <g pointerEvents="none">
      <rect x={-pad} y={-pad} width={w + pad * 2} height={w + pad * 2} rx={18} fill="url(#epi-grass)" stroke="#16a34a" strokeWidth={2} />
      <rect x={-2} y={-2} width={w + 4} height={w + 4} rx={8} fill="url(#epi-sand)" stroke="#e7b860" strokeWidth={1.5} />
      {flowers.map(([x, y], k) => (
        <g key={k}>
          {[0, 72, 144, 216, 288].map((a) => (
            <circle key={a} cx={x + Math.cos((a * Math.PI) / 180) * 2.6} cy={y + Math.sin((a * Math.PI) / 180) * 2.6} r={1.9} fill={k % 3 ? "#fda4af" : "#fde047"} />
          ))}
          <circle cx={x} cy={y} r={1.5} fill="#f59e0b" />
        </g>
      ))}
      {trees.map(([x, y], k) => (
        <g key={k} className="epi-sway">
          <rect x={x - 1.5} y={y} width={3} height={6} rx={1} fill="#92400e" />
          <circle cx={x} cy={y - 1} r={6.5} fill="#22c55e" stroke="#15803d" strokeWidth={1.2} />
          <circle cx={x - 2} cy={y - 3} r={2} fill="#bbf7d0" opacity={0.7} />
        </g>
      ))}
    </g>
  );
}

/** 범례용 작은 얼굴 */
export function MiniFace({ s }: { s: number }) {
  return (
    <svg viewBox="0 0 40 40" width={30} height={30} aria-hidden="true">
      <Face s={s} cx={20} cy={21} />
    </svg>
  );
}
