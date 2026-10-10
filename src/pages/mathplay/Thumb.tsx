import { ART, gameById } from "./games/registry";

/** 게임 썸네일 그림: 층마다 다른 배경 장면 + 반짝이 + 큰 그림 문자(주인공) + 작은 그림 문자(친구) */
export default function Thumb({ id, size = "md", bob = false }: { id: string; size?: "md" | "lg"; bob?: boolean }) {
  const a = ART[id] ?? { e: "🎮", c: ["#c4b5fd", "#7c3aed"] as [string, string] };
  const floor = gameById(id)?.floor ?? "play";
  const big = size === "lg";
  const gid = `th-${id}`;
  return (
    <div className="relative overflow-hidden" style={{ aspectRatio: "1 / 1" }} aria-hidden>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        <defs>
          <radialGradient id={gid} cx="30%" cy="22%" r="90%">
            <stop offset="0" stopColor={a.c[0]} />
            <stop offset="1" stopColor={a.c[1]} />
          </radialGradient>
        </defs>
        <rect width="100" height="100" fill={`url(#${gid})`} />
        {floor === "play" && (
          // 놀이 마당: 둥근 언덕과 구름
          <g>
            <ellipse cx="18" cy="104" rx="46" ry="26" fill="#fff" opacity="0.22" />
            <ellipse cx="86" cy="108" rx="44" ry="28" fill="#fff" opacity="0.18" />
            <g fill="#fff" opacity="0.55">
              <ellipse cx="22" cy="18" rx="11" ry="5" />
              <ellipse cx="29" cy="15" rx="7" ry="5" />
            </g>
          </g>
        )}
        {floor === "future" && (
          // 미래 연구소: 모눈과 궤도
          <g stroke="#fff" opacity="0.22" fill="none">
            {[20, 40, 60, 80].map((v) => (
              <path key={v} d={`M ${v} 0 V 100 M 0 ${v} H 100`} strokeWidth="0.8" />
            ))}
            <ellipse cx="50" cy="52" rx="44" ry="16" strokeWidth="2" transform="rotate(-18 50 52)" />
          </g>
        )}
        {floor === "classic" && (
          // 수학 박물관: 기둥과 아치
          <g fill="#fff" opacity="0.2">
            <path d="M 8 100 V 62 H 16 V 100 Z M 84 100 V 62 H 92 V 100 Z" />
            <path d="M 4 62 H 20 V 58 H 4 Z M 80 62 H 96 V 58 H 80 Z" />
            <path d="M 30 100 V 80 A 20 20 0 0 1 70 80 V 100 Z" opacity="0.6" />
          </g>
        )}
        {floor === "world" && (
          // 세계 놀이터: 지구본 줄무늬
          <g stroke="#fff" opacity="0.28" fill="none" strokeWidth="1.4">
            <circle cx="50" cy="52" r="42" />
            <ellipse cx="50" cy="52" rx="18" ry="42" />
            <path d="M 8 52 H 92 M 14 30 H 86 M 14 74 H 86" />
          </g>
        )}
        {/* 반짝이 */}
        {[
          [80, 16, 4],
          [12, 44, 2.6],
          [70, 82, 2.4],
        ].map(([x, y, r], i) => (
          <path key={i} d={`M ${x} ${y - r * 2} Q ${x} ${y} ${x + r * 2} ${y} Q ${x} ${y} ${x} ${y + r * 2} Q ${x} ${y} ${x - r * 2} ${y} Q ${x} ${y} ${x} ${y - r * 2} Z`} fill="#fff" opacity="0.85" />
        ))}
        {/* 주인공 뒤 빛 */}
        <circle cx="50" cy="50" r="27" fill="#fff" opacity="0.25" />
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center ${bob ? "gz-bob" : ""}`}
        style={{ fontSize: big ? 112 : 60, filter: "drop-shadow(0 5px 0 rgba(0,0,0,.18)) drop-shadow(0 8px 10px rgba(0,0,0,.18))" }}
      >
        {a.e}
      </span>
      {a.e2 && (
        <span className="absolute bottom-[8%] right-[9%]" style={{ fontSize: big ? 50 : 28, filter: "drop-shadow(0 3px 0 rgba(0,0,0,.18))" }}>
          {a.e2}
        </span>
      )}
    </div>
  );
}
