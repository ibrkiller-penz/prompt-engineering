// 어획량 정하기의 그림 부품(만화풍 바닷속 장면·물고기·배·그물). 로직은 fishery.tsx / fishery.logic.ts 에 있어요.
export const SEA_W = 300;
export const SEA_H = 240;
export const BOAT = { x: 150, y: 20 };
const COLORS = [
  ["#ffb347", "#e8730c"],
  ["#ff8fb1", "#d6336c"],
  ["#5cc8ff", "#1c7ed6"],
  ["#7ee8a2", "#2b9348"],
  ["#c7a6ff", "#7048e8"],
];

export const FISH_CSS = `
.fish-catch{opacity:0}
@media (prefers-reduced-motion: no-preference){
.fish-tail{animation:fish-tail .5s ease-in-out infinite;transform-box:fill-box;transform-origin:right center}
.fish-born{animation:fish-born .9s cubic-bezier(.2,1.5,.4,1) both;transform-box:fill-box;transform-origin:center}
.fish-catch{animation:fish-catch .9s ease-in both}
.sea-bubble{animation:sea-bubble 5s linear infinite}
.sea-weed{animation:sea-weed 3.2s ease-in-out infinite;transform-box:fill-box;transform-origin:center bottom}
.sea-boat{animation:sea-boat 2.6s ease-in-out infinite;transform-box:fill-box;transform-origin:center bottom}
.fish-party .fish-body{animation:fish-hop .5s ease-in-out 4;transform-box:fill-box;transform-origin:center}
.sea-shake{animation:sea-shake .55s ease-in-out 1}
.sea-spark{animation:sea-spark .9s ease-out both;transform-box:fill-box;transform-origin:center}
}
@keyframes fish-tail{0%,100%{transform:scaleY(1) skewY(0)}50%{transform:scaleY(.75) skewY(12deg)}}
@keyframes fish-born{0%{transform:scale(0);opacity:0}60%{transform:scale(1.35);opacity:1}100%{transform:scale(1);opacity:1}}
@keyframes fish-catch{0%{transform:translate(0,0) scale(1);opacity:1}70%{opacity:1}100%{transform:translate(var(--dx),var(--dy)) scale(.25);opacity:0}}
@keyframes sea-bubble{0%{transform:translateY(0);opacity:0}10%{opacity:.85}90%{opacity:.6}100%{transform:translateY(-190px);opacity:0}}
@keyframes sea-weed{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}}
@keyframes sea-boat{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(2px) rotate(3deg)}}
@keyframes fish-hop{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px) scale(1.1)}}
@keyframes sea-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-9px)}40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(3px)}}
@keyframes sea-spark{0%{transform:scale(0) rotate(0);opacity:0}50%{transform:scale(1.3) rotate(45deg);opacity:1}100%{transform:scale(.6) rotate(90deg);opacity:0}}
`;

/** i번째 물고기의 자리(시간 t 에 따라 살랑살랑) */
export function fishPos(i: number, t: number) {
  const bx = (i * 0.618034 * 7919) % 1;
  const by = (i * 0.754877 * 104729) % 1;
  const dir = i % 2 ? 1 : -1;
  return { x: 24 + bx * 252 + Math.sin(t * 0.8 + i) * 7, y: 46 + by * 158 + Math.cos(t * 0.6 + i * 1.7) * 3, dir };
}

export function SeaDefs() {
  return (
    <defs>
      <linearGradient id="sea-water" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#7dd3fc" />
        <stop offset="0.55" stopColor="#0ea5e9" />
        <stop offset="1" stopColor="#0369a1" />
      </linearGradient>
      <linearGradient id="sea-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff7d6" />
        <stop offset="1" stopColor="#c7f0ff" />
      </linearGradient>
      <linearGradient id="sea-sand" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fde68a" />
        <stop offset="1" stopColor="#f5b84a" />
      </linearGradient>
      <linearGradient id="sea-hull" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ff7a59" />
        <stop offset="1" stopColor="#d9480f" />
      </linearGradient>
      <pattern id="sea-net" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="5" height="5" fill="#fff7ed" fillOpacity="0.25" />
        <path d="M0 0 H5 M0 0 V5" stroke="#fb923c" strokeWidth="1" />
      </pattern>
      {COLORS.map(([a, b], k) => (
        <linearGradient key={k} id={`sea-f${k}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
      ))}
    </defs>
  );
}

/** 귀여운 물고기(오른쪽을 봐요). 가운데 (0,0) */
export function Fish({ k }: { k: number }) {
  const [, dark] = COLORS[k % COLORS.length];
  return (
    <g className="fish-body">
      <path className="fish-tail" d="M-8 0 L-16 -6 Q-14 0 -16 6 Z" fill={`url(#sea-f${k % COLORS.length})`} stroke={dark} strokeWidth={1.2} strokeLinejoin="round" />
      <path d="M-3 -6 Q1 -11 5 -6" fill={`url(#sea-f${k % COLORS.length})`} stroke={dark} strokeWidth={1.1} />
      <ellipse cx={0} cy={0} rx={10.5} ry={6.8} fill={`url(#sea-f${k % COLORS.length})`} stroke={dark} strokeWidth={1.3} />
      <ellipse cx={-1} cy={2.6} rx={6} ry={2.6} fill="#fff" opacity={0.35} />
      <circle cx={4.6} cy={-1.4} r={2.7} fill="#fff" stroke={dark} strokeWidth={0.6} />
      <circle cx={5.3} cy={-1.2} r={1.4} fill="#1e1b2e" />
      <circle cx={5.8} cy={-1.8} r={0.5} fill="#fff" />
      <path d="M6.5 2.6 q1.6 1 3 -0.4" stroke={dark} strokeWidth={1} fill="none" strokeLinecap="round" />
    </g>
  );
}

/** 잡힐 물고기에 씌우는 그물 동그라미 */
export function NetRing() {
  return <circle cx={-1} cy={0} r={13.5} fill="url(#sea-net)" stroke="#f97316" strokeWidth={2} />;
}

function Boat() {
  const { x, y } = BOAT;
  return (
    <g className="sea-boat">
      <line x1={x + 16} y1={y - 2} x2={x + 30} y2={y + 30} stroke="#78350f" strokeWidth={1.2} />
      <path d={`M${x + 30} ${y + 30} l-4 6 h8 z`} fill="#fb923c" />
      <rect x={x - 2} y={y - 22} width={2.5} height={18} fill="#92400e" />
      <path d={`M${x + 0.5} ${y - 22} l12 4 -12 4 z`} fill="#facc15" stroke="#ca8a04" strokeWidth={0.8} />
      <circle cx={x - 8} cy={y - 9} r={5.5} fill="#ffd8a8" stroke="#c2410c" strokeWidth={1} />
      <path d={`M${x - 14} ${y - 12} q6 -7 12 0 z`} fill="#3b82f6" stroke="#1d4ed8" strokeWidth={0.8} />
      <circle cx={x - 6.5} cy={y - 9.5} r={0.9} fill="#1e1b2e" />
      <path d={`M${x - 9} ${y - 6.5} q2 1.5 4 0`} stroke="#9a3412" strokeWidth={0.8} fill="none" />
      <path d={`M${x - 26} ${y - 4} H${x + 24} L${x + 16} ${y + 8} H${x - 18} Z`} fill="url(#sea-hull)" stroke="#9a3412" strokeWidth={1.5} strokeLinejoin="round" />
      <path d={`M${x - 22} ${y} H${x + 20}`} stroke="#fff" strokeWidth={1.5} opacity={0.7} />
    </g>
  );
}

/** 바닷속 배경(하늘·물결·빛·해초·모래·거품·배) */
export function SeaBack() {
  const weeds = [18, 44, 232, 268, 120];
  const bubbles = [30, 80, 140, 190, 250, 285, 60, 215];
  return (
    <g pointerEvents="none">
      <rect x={0} y={0} width={SEA_W} height={SEA_H} fill="url(#sea-water)" />
      <rect x={0} y={0} width={SEA_W} height={26} fill="url(#sea-sky)" />
      <circle cx={268} cy={10} r={7} fill="#fde047" stroke="#f59e0b" strokeWidth={1} />
      <path d={`M0 26 ${Array.from({ length: 16 }, () => `q${SEA_W / 32} -5 ${SEA_W / 16} 0`).join(" ")} V32 H0 Z`} fill="#e0f7ff" opacity={0.85} />
      {[40, 120, 200].map((x) => (
        <polygon key={x} points={`${x},30 ${x + 26},30 ${x + 60},214 ${x + 14},214`} fill="#fff" opacity={0.08} />
      ))}
      <path d={`M0 214 Q40 206 80 214 T160 212 T240 214 T300 210 V${SEA_H} H0 Z`} fill="url(#sea-sand)" stroke="#d6922a" strokeWidth={1.2} />
      {weeds.map((x, k) => (
        <path key={x} className="sea-weed" style={{ animationDelay: `${k * 0.4}s` }} d={`M${x} 216 q-7 -16 0 -30 q7 -14 0 -30 ${k % 2 ? "q-6 -12 0 -22" : ""}`} stroke={k % 2 ? "#16a34a" : "#22c55e"} strokeWidth={5} fill="none" strokeLinecap="round" />
      ))}
      <ellipse cx={176} cy={220} rx={11} ry={6} fill="#c084fc" stroke="#7e22ce" strokeWidth={1.2} />
      <ellipse cx={92} cy={222} rx={8} ry={4.5} fill="#f9a8d4" stroke="#be185d" strokeWidth={1.2} />
      <path d="M205 226 l3 -7 3 7 7 1 -6 4 2 7 -6 -4 -6 4 2 -7 -6 -4z" fill="#fb7185" stroke="#be123c" strokeWidth={1} />
      {bubbles.map((x, k) => (
        <circle key={k} className="sea-bubble" style={{ animationDelay: `${k * 0.65}s` }} cx={x} cy={210} r={2 + (k % 3)} fill="#fff" fillOpacity={0.35} stroke="#fff" strokeWidth={0.8} />
      ))}
      <Boat />
    </g>
  );
}

/** 그물 손잡이(세로 막대의 엄지) */
export function NetKnob() {
  return (
    <svg viewBox="0 0 60 60" width={56} height={56} aria-hidden="true">
      <defs>
        <pattern id="knob-net" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="#fff7ed" />
          <path d="M0 0 H6 M0 0 V6" stroke="#ea580c" strokeWidth="1.3" />
        </pattern>
      </defs>
      <circle cx={30} cy={32} r={25} fill="#000" opacity={0.15} />
      <circle cx={30} cy={29} r={25} fill="url(#knob-net)" stroke="#f97316" strokeWidth={5} />
      {[0, 90, 180, 270].map((a) => (
        <circle key={a} cx={30 + Math.cos((a * Math.PI) / 180) * 25} cy={29 + Math.sin((a * Math.PI) / 180) * 25} r={3.5} fill="#fde047" stroke="#ca8a04" strokeWidth={1} />
      ))}
    </svg>
  );
}
