import { ART, FLOORS, GAMES, type Floor } from "./games/registry";

/** 첫 화면 그림: 3층짜리 ‘수학 놀이터’ 건물. 층을 누르면 그 층 게임으로 간다. */
export default function BuildingMap({ onPick, stars }: { onPick: (f: Floor) => void; stars: Record<Floor, [number, number]> }) {
  const order = [...FLOORS].reverse(); // 위에서부터 3층 → 1층
  const W = 420;
  const top = 92;
  const fh = 86;
  const n = FLOORS.length;
  const H = top + n * fh + 56;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full select-none" role="group" aria-label="수학 놀이터 건물. 층을 누르면 그 층 게임으로 가요">
      <defs>
        {FLOORS.map((f) => (
          <linearGradient key={f.key} id={`bm-${f.key}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={f.grad[0]} />
            <stop offset="1" stopColor={f.grad[1]} />
          </linearGradient>
        ))}
        <linearGradient id="bm-roof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd166" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
      </defs>

      {/* 해와 구름 */}
      <circle cx="372" cy="46" r="26" fill="#ffe17a" opacity="0.95" />
      <g fill="#fff" opacity="0.9">
        <ellipse cx="60" cy="54" rx="34" ry="14" />
        <ellipse cx="82" cy="44" rx="22" ry="14" />
        <ellipse cx="330" cy="104" rx="26" ry="10" />
      </g>

      {/* 땅 */}
      <ellipse cx={W / 2} cy={H - 8} rx="240" ry="34" fill="#7bd389" />
      <ellipse cx={W / 2} cy={H - 14} rx="200" ry="20" fill="#9be59f" />

      {/* 나무 */}
      {[34, 386].map((x) => (
        <g key={x}>
          <rect x={x - 4} y={H - 70} width="8" height="40" rx="3" fill="#a16207" />
          <circle cx={x} cy={H - 78} r="22" fill="#4ade80" stroke="#16a34a" strokeWidth="3" />
          <circle cx={x - 7} cy={H - 85} r="5" fill="#ef4444" />
        </g>
      ))}

      {/* 지붕과 깃발 */}
      <path d={`M 70 ${top} L ${W / 2} ${top - 58} L ${W - 70} ${top} Z`} fill="url(#bm-roof)" stroke="#b45309" strokeWidth="4" strokeLinejoin="round" />
      <line x1={W / 2} y1={top - 58} x2={W / 2} y2={top - 90} stroke="#7c2d12" strokeWidth="4" />
      <path d={`M ${W / 2} ${top - 90} l 34 9 l -34 9 Z`} fill="#ff4d6d">
        <animateTransform attributeName="transform" type="skewY" values="0;-6;0" dur="1.6s" repeatCount="indefinite" />
      </path>

      {/* 층 */}
      {order.map((f, i) => {
        const y = top + i * fh;
        const games = GAMES.filter((g) => g.floor === f.key && g.level === "elem").slice(0, 3);
        const [got, all] = stars[f.key];
        return (
          <g
            key={f.key}
            role="button"
            tabIndex={0}
            aria-label={`${f.label} ${f.name}, 별 ${got}/${all}`}
            onClick={() => onPick(f.key)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onPick(f.key))}
            className="cursor-pointer outline-none transition hover:brightness-110 focus-visible:brightness-110"
          >
            <rect x="86" y={y + 6} width={W - 172} height={fh - 4} rx="14" fill="rgba(0,0,0,.15)" />
            <rect x="80" y={y} width={W - 160} height={fh - 6} rx="14" fill={`url(#bm-${f.key})`} stroke="#fff" strokeWidth="4" />
            {/* 층 이름표 */}
            <rect x="92" y={y + 10} width="92" height="26" rx="13" fill="#fff" />
            <text x="138" y={y + 29} textAnchor="middle" fontSize="15" fill="#2b2340" style={{ fontFamily: "S-Core Dream, Pretendard Variable, sans-serif" }}>
              {f.emoji} {f.label}
            </text>
            <text x="138" y={y + 58} textAnchor="middle" fontSize="16" fill="#fff" style={{ fontFamily: "S-Core Dream, Pretendard Variable, sans-serif" }}>
              {f.name}
            </text>
            <text x="138" y={y + 75} textAnchor="middle" fontSize="12" fill="#fff" opacity="0.95" style={{ fontFamily: "S-Core Dream, Pretendard Variable, sans-serif" }}>
              ⭐ {got}/{all}
            </text>
            {/* 창문: 그 층 게임 그림 */}
            {games.map((g, k) => (
              <g key={g.id}>
                <rect x={200 + k * 46} y={y + 14} width="40" height="52" rx="10" fill="#fffaf0" stroke="rgba(0,0,0,.18)" strokeWidth="2" />
                <text x={220 + k * 46} y={y + 50} textAnchor="middle" fontSize="24">
                  {ART[g.id]?.e ?? "🎮"}
                </text>
              </g>
            ))}
          </g>
        );
      })}

      {/* 손 흔드는 친구들 */}
      <text x={W / 2 + 54} y={top + n * fh + 22} fontSize="30" pointerEvents="none">
        🐰
        <animateTransform attributeName="transform" type="translate" values="0 0;0 -6;0 0" dur="1.2s" repeatCount="indefinite" />
      </text>
      <text x={W / 2 - 92} y={top + n * fh + 24} fontSize="28" pointerEvents="none">
        🐻
      </text>
    </svg>
  );
}
