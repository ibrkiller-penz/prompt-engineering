/** 7인치 알림판 색 테마 5가지 견본(펌웨어 THEMES 표와 같은 값). 글자·시간표는 지어낸 것이다. */
const THEMES = [
  { name: "따뜻함", d: "지금 기본 — 갈색 바탕, 호박색 강조", bg: "#1c1714", panel: "#26201c", row: "#342c26", line: "#4a4038", text: "#faf5ee", sub: "#e2d8cc", muted: "#b8ab9c", tag: "#fbbf24", tagTx: "#2a2320", nowRow: "#fff4e0", next: "#facc15" },
  { name: "남색밤", d: "깊은 남색에 금색 — 저녁·교무실", bg: "#0e1626", panel: "#16213a", row: "#1f2d4b", line: "#2f4064", text: "#f4f7fc", sub: "#d3dcec", muted: "#a3b1c9", tag: "#fbbf24", tagTx: "#0e1626", nowRow: "#fef3c7", next: "#facc15" },
  { name: "밝은종이", d: "미색 종이에 먹색 — 햇빛 드는 낮 교실", bg: "#f3ede1", panel: "#fbf7ef", row: "#ebe3d4", line: "#d9ceb9", text: "#1f1914", sub: "#463b31", muted: "#685a4c", tag: "#854000", tagTx: "#ffffff", nowRow: "#ffd95a", next: "#995200" },
  { name: "고대비", d: "검정·흰 글자·노랑 — 멀리서 가장 또렷", bg: "#000000", panel: "#101010", row: "#1e1e1e", line: "#505050", text: "#ffffff", sub: "#e6e6e6", muted: "#bfbfbf", tag: "#ffd400", tagTx: "#000000", nowRow: "#fff59d", next: "#ffd400" },
  { name: "숲초록", d: "짙은 초록에 살구색 — 눈이 편함", bg: "#0f1a17", panel: "#15241f", row: "#1d302a", line: "#2f4a41", text: "#f0f7f3", sub: "#cfe0d8", muted: "#a8c0b6", tag: "#ffb454", tagTx: "#1a2420", nowRow: "#fff1dc", next: "#ffcf5c" },
];

function Mini({ t }: { t: (typeof THEMES)[number] }) {
  const rows: [string, string, "now" | "next" | ""][] = [
    ["1교시", "국어A · 301", ""],
    ["2교시", "수학B · 202", "now"],
    ["3교시", "공강", "next"],
    ["4교시", "과학 · 실험실", ""],
  ];
  return (
    <svg viewBox="0 0 320 188" className="w-full rounded-lg border border-line" role="img" aria-label={`${t.name} 테마 화면 견본`}>
      <rect width="320" height="188" fill={t.bg} />
      <rect x="6" y="6" width="150" height="176" rx="10" fill={t.panel} stroke={t.line} />
      <text x="81" y="62" fontSize="40" fontWeight="800" textAnchor="middle" fill={t.text}>10:25</text>
      <text x="81" y="82" fontSize="11" textAnchor="middle" fill={t.sub}>10월 26일 월요일</text>
      <rect x="16" y="94" width="130" height="38" rx="7" fill={t.row} stroke={t.line} />
      <text x="26" y="118" fontSize="15" fontWeight="800" fill={t.text}>19°</text>
      <text x="60" y="117" fontSize="10" fill={t.muted}>맑음 · 미세먼지 좋음</text>
      <rect x="16" y="138" width="130" height="36" rx="7" fill={t.row} stroke={t.line} />
      <text x="26" y="160" fontSize="10" fill={t.muted}>점심</text>
      <text x="52" y="160" fontSize="10" fill={t.sub}>잡곡밥 · 미역국</text>
      <rect x="164" y="6" width="150" height="176" rx="10" fill={t.panel} stroke={t.line} />
      <text x="174" y="26" fontSize="11" fontWeight="700" fill={t.text}>오늘 시간표</text>
      {rows.map(([p, s, k], i) => {
        const y = 36 + i * 36;
        const now = k === "now";
        return (
          <g key={p}>
            <rect x="172" y={y} width="134" height="30" rx="6" fill={now ? t.nowRow : t.row} stroke={k === "next" ? t.next : now ? t.nowRow : t.line} strokeWidth={k === "next" ? 2 : 1} />
            <rect x="176" y={y + 4} width="38" height="22" rx="5" fill={now ? t.tag : t.line} />
            <text x="195" y={y + 19} fontSize="9" textAnchor="middle" fill={now ? t.tagTx : t.sub}>{p}</text>
            <text x="220" y={y + 19} fontSize="10" fontWeight="700" fill={now ? "#2a2320" : t.text}>{s}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function ThemePreview() {
  return (
    <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {THEMES.map((t, i) => (
        <li key={t.name} className="rounded-card border border-line bg-surface p-3">
          <Mini t={t} />
          <p className="mt-2 font-bold">
            {i + 1}. {t.name}
          </p>
          <p className="text-sm text-muted">{t.d}</p>
        </li>
      ))}
    </ul>
  );
}
