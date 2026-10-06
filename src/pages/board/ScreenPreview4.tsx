import type { ReactNode, SVGProps } from "react";

/** 4인치(480×480) 화면 예시 세 장 — 샘플(가짜) 자료. 실제 보드는 옆으로 밀어서 넘겨요. */
const C = { bg: "#0b1120", panel: "#111827", card: "#1e293b", line: "#334155", dim: "#94a3b8", soft: "#cbd5e1" };

function Frame({ idx, children, label }: { idx: number; children: ReactNode; label: string }) {
  return (
    <figure className="min-w-0">
      <svg viewBox="0 0 480 480" role="img" aria-label={label} className="w-full rounded-card border-4 border-black bg-[#0b1120] shadow-lg">
        <rect width="480" height="480" fill={C.bg} />
        <rect x="10" y="10" width="460" height="446" rx="14" fill={C.panel} stroke={C.line} />
        {children}
        {[0, 1, 2].map((i) => {
          const x = i < idx ? 205 + i * 14 : i === idx ? 205 + i * 14 : 223 + i * 14;
          return <rect key={i} x={x} y="465" width={i === idx ? 18 : 7} height="7" rx="3.5" fill={i === idx ? C.soft : C.line} />;
        })}
      </svg>
      <figcaption className="mt-2 text-center text-sm text-muted">{label}</figcaption>
    </figure>
  );
}

const T = (p: SVGProps<SVGTextElement>) => <text fontFamily="inherit" {...p} />;

function Clock() {
  return (
    <Frame idx={0} label="① 시계 (기본 화면)">
      <T x="240" y="112" fontSize="112" fontWeight="800" textAnchor="middle" fill="#fff" letterSpacing="-3">
        10:52
      </T>
      <T x="26" y="140" fontSize="20" fill={C.soft}>
        10월 6일 화요일
      </T>
      <rect x="388" y="124" width="76" height="22" rx="11" fill="#7f1d1d" stroke="#ef4444" />
      <T x="426" y="140" fontSize="13" textAnchor="middle" fill="#fecaca">
        수능 D-44
      </T>
      <rect x="26" y="156" width="428" height="100" rx="12" fill={C.card} stroke={C.line} />
      <rect x="239" y="164" width="1" height="58" fill={C.line} />
      <rect x="38" y="230" width="404" height="1" fill={C.line} />
      {(
        [
          ["오늘", "☀ 26°", 36],
          ["내일", "🌧 23°", 250],
        ] as const
      ).map(([t, b, x]) => (
        <g key={t}>
          <T x={x} y="182" fontSize="14" fill={C.dim}>
            {t}
          </T>
          <T x={x} y="220" fontSize="38" fontWeight="800" fill="#fff">
            {b}
          </T>
        </g>
      ))}
      <T x="38" y="248" fontSize="13" fill="#60a5fa">
        ● 미세먼지 좋음
      </T>
      <T x="140" y="248" fontSize="13" fill={C.dim}>
        · PM10 15 · 초미세 12
      </T>
      <defs>
        <linearGradient id="nb4" x1="0" x2="1">
          <stop offset="0" stopColor="#dc2626" />
          <stop offset="1" stopColor="#3730a3" />
        </linearGradient>
      </defs>
      <rect x="26" y="264" width="428" height="66" rx="10" fill="url(#nb4)" />
      <rect x="36" y="271" width="40" height="22" rx="6" fill="rgba(255,255,255,.18)" />
      <T x="56" y="287" fontSize="14" textAnchor="middle" fill="#fff">
        지금
      </T>
      <T x="84" y="288" fontSize="16" fill="#fee2e2">
        3교시 <tspan fontWeight="800" fill="#fff">과학</tspan> · 과학실 · 11:30까지
      </T>
      <rect x="36" y="300" width="408" height="1" fill="rgba(255,255,255,.25)" />
      <rect x="36" y="303" width="40" height="22" rx="6" fill="rgba(255,255,255,.18)" />
      <T x="56" y="319" fontSize="14" textAnchor="middle" fill="#fff">
        다음
      </T>
      <T x="84" y="320" fontSize="16" fill="#fee2e2">
        4교시 <tspan fontWeight="800" fill="#fff">국어</tspan> · 301 · <tspan fill="#fde68a">(48분 뒤)</tspan>
      </T>
      <rect x="26" y="338" width="428" height="106" rx="12" fill={C.card} stroke={C.line} />
      <T x="38" y="362" fontSize="14" fill={C.dim}>
        할 일
      </T>
      <rect x="82" y="346" width="106" height="22" rx="6" fill="#3b2f0a" stroke="#a16207" />
      <T x="135" y="362" fontSize="14" textAnchor="middle" fill="#fcd34d">
        급식지도 12:30
      </T>
      <rect x="38" y="376" width="404" height="1" fill={C.line} />
      <T x="38" y="400" fontSize="14" fill={C.dim}>
        점심
      </T>
      <T x="82" y="400" fontSize="14" fill="#e2e8f0">
        잡곡밥 · 미역국 · 불고기
      </T>
      <T x="82" y="421" fontSize="14" fill="#e2e8f0">
        시금치나물 · 배추김치
      </T>
    </Frame>
  );
}

const TODAY: [string, string, string, string, string?][] = [
  ["1교시", "08:40", "수학", "201"],
  ["2교시", "09:40", "수학", "202"],
  ["3교시", "10:40", "과학", "과학실"],
  ["4교시", "11:40", "국어", "301"],
  ["점심", "", "급식지도", "12:30~13:30"],
  ["5교시", "13:30", "국어", "301", "당겨옴"],
  ["6교시", "14:40", "", ""],
  ["7교시", "15:40", "동아리", "도서관"],
];

function Today() {
  return (
    <Frame idx={1} label="② 오늘 시간표">
      <T x="24" y="40" fontSize="20" fontWeight="700" fill="#fff">
        오늘 · 10월 6일 (화)
      </T>
      <T x="448" y="40" fontSize="16" textAnchor="end" fill={C.dim}>
        10:52
      </T>
      {TODAY.map((r, i) => {
        const now = i === 2;
        const y = 54 + i * 49;
        const edge = now ? "#f1f5f9" : i === 4 ? "#f59e0b" : C.line;
        return (
          <g key={i}>
            <rect x="20" y={y} width="440" height="44" rx="8" fill={now ? "#f1f5f9" : C.card} stroke={edge} />
            <T x="52" y={y + 19} fontSize="14" textAnchor="middle" fill={now ? "#0f172a" : C.soft}>
              {r[0]}
            </T>
            {r[1] && (
              <T x="52" y={y + 35} fontSize="12" textAnchor="middle" fill={now ? "#334155" : C.dim}>
                {r[1]}
              </T>
            )}
            <T x="94" y={y + 28} fontSize="16" fontWeight="700" fill={now ? "#0f172a" : i === 4 ? "#fcd34d" : r[2] ? "#fff" : C.dim}>
              {r[2] || "공강"}
            </T>
            {r[4] && (
              <>
                <rect x="170" y={y + 12} width="46" height="20" rx="6" fill="#ea580c" />
                <T x="193" y={y + 27} fontSize="13" textAnchor="middle" fill="#fff">
                  {r[4]}
                </T>
              </>
            )}
            <T x="446" y={y + 27} fontSize="14" textAnchor="end" fill={now ? "#475569" : C.soft}>
              {r[3]}
            </T>
          </g>
        );
      })}
    </Frame>
  );
}

const WEEK = [
  ["", "과학 과학실", "수학 201", "", "국어 301"],
  ["수학 201", "", "과학 과학실", "수학 201", ""],
  ["과학 과학실", "수학 201", "과학 과학실", "", "과학 과학실"],
  ["", "국어 301", "국어 301", "수학 201", ""],
  ["수학 201", "", "국어 301", "과학 과학실", "수학 201"],
  ["", "동아리 도서관", "", "", "국어 301"],
  ["국어 301", "", "동아리 도서관", "", ""],
];

function Week() {
  const GX = 18;
  const LW = 30;
  const G = 3;
  const CW = (460 - 2 * GX - LW - 5 * G) / 5;
  return (
    <Frame idx={2} label="③ 주간 시간표">
      <T x="22" y="34" fontSize="16" fontWeight="700" fill="#fff">
        샘플선생님 · 10/5 ~ 10/9
      </T>
      {["월 5", "화 6", "수 7", "목 8", "금 9"].map((d, j) => (
        <g key={d}>
          {j === 1 && <rect x={GX + LW + G + j * (CW + G)} y="44" width={CW} height="24" rx="6" fill="#ef4444" />}
          <T x={GX + LW + G + j * (CW + G) + CW / 2} y="61" fontSize="13" textAnchor="middle" fill={j === 1 ? "#fff" : C.dim}>
            {d}
          </T>
        </g>
      ))}
      {WEEK.map((row, r) => {
        const y = 72 + r * 53;
        return (
          <g key={r}>
            <T x={GX + 14} y={y + 28} fontSize="13" textAnchor="middle" fill={C.dim}>
              {r + 1}
            </T>
            {row.map((t, j) => {
              const x = GX + LW + G + j * (CW + G);
              const now = j === 1 && r === 2;
              const [s, room] = t ? t.split(" ") : ["", ""];
              return t ? (
                <g key={j}>
                  <rect x={x} y={y} width={CW} height="50" rx="7" fill={now ? "#f1f5f9" : C.card} stroke={now ? "#f1f5f9" : C.line} />
                  <T x={x + CW / 2} y={y + 22} fontSize="14" fontWeight="700" textAnchor="middle" fill={now ? "#0f172a" : "#fff"}>
                    {s}
                  </T>
                  <T x={x + CW / 2} y={y + 39} fontSize="11.5" textAnchor="middle" fill={now ? "#475569" : C.dim}>
                    {room}
                  </T>
                </g>
              ) : (
                <rect key={j} x={x} y={y} width={CW} height="50" rx="7" fill="none" stroke="#263248" strokeDasharray="4 3" />
              );
            })}
          </g>
        );
      })}
    </Frame>
  );
}

export default function ScreenPreview4() {
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Clock />
        <Today />
        <Week />
      </div>
      <p className="mt-3 text-sm text-muted">
        실제 보드에서는 화면을 <b>옆으로 밀어서</b> 넘겨요(아래 점이 몇 번째인지 보여 줘요). 선생님 찾기·설정 화면이 두 장 더 있어요. 모두 샘플(가짜) 자료로 그린 예시예요.
      </p>
    </div>
  );
}
