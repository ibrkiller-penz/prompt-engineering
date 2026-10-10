// 메인 꼭지 아이콘: 둥근 사각형 + 그라데이션 + 흰 그림, 모두 같은 틀 (48×48)
import type { ReactNode } from "react";

const ICONS: Record<string, { from: string; to: string; glyph: ReactNode }> = {
  // AI 맞춤 설정 — 조절 막대 + 반짝임
  "/setup": {
    from: "#3b5bdb",
    to: "#74a1ff",
    glyph: (
      <g stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M14 13v22M24 13v22M34 21v14" />
        <circle cx="14" cy="28" r="3.6" fill="#fff" stroke="none" />
        <circle cx="24" cy="18" r="3.6" fill="#fff" stroke="none" />
        <circle cx="34" cy="27" r="3.6" fill="#fff" stroke="none" />
        <path d="M36 8.5v6M33 11.5h6" strokeWidth="2.2" />
      </g>
    ),
  },
  // 다시 묻는 AI 교실 — 말풍선 + 다시(↻) 화살표
  "/prompt": {
    from: "#0f766e",
    to: "#2dd4bf",
    glyph: (
      <g fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 14.5a4.5 4.5 0 0 1 4.5-4.5h17a4.5 4.5 0 0 1 4.5 4.5v12a4.5 4.5 0 0 1-4.5 4.5H22l-7 6v-6h0.5A4.5 4.5 0 0 1 11 26.5z" />
        <path d="M29.5 20.5a5.5 5.5 0 1 1-2-4.2" />
        <path d="M28.6 13.4l-.9 3.6 3.6.5" />
      </g>
    ),
  },
  // 해피스탬프 — 도장 + 찍힌 하트
  "https://happystamp.web.app/": {
    from: "#f97316",
    to: "#fb7185",
    glyph: (
      <g fill="#fff">
        <circle cx="24" cy="10.5" r="4.2" />
        <path d="M21.2 14h5.6l1.4 7h-8.4z" />
        <rect x="13" y="21" width="22" height="6" rx="2.2" />
        <path d="M24 41.5l-5.6-5.4a3.4 3.4 0 0 1 4.8-4.8l.8.8.8-.8a3.4 3.4 0 0 1 4.8 4.8z" opacity=".95" />
      </g>
    ),
  },
  // 노래공방 — 음표 두 개
  "https://norae-studio.web.app/": {
    from: "#7c3aed",
    to: "#c084fc",
    glyph: (
      <g fill="#fff">
        <path d="M19 33.5V14.8l17-3.8v18.3" fill="none" stroke="#fff" strokeWidth="3" strokeLinejoin="round" />
        <path d="M19 19.5l17-3.8" fill="none" stroke="#fff" strokeWidth="3" />
        <ellipse cx="15" cy="33.8" rx="4.6" ry="3.7" transform="rotate(-18 15 33.8)" />
        <ellipse cx="32" cy="29.8" rx="4.6" ry="3.7" transform="rotate(-18 32 29.8)" />
      </g>
    ),
  },
  // 제미나이 노트북 — 공책 + 반짝임
  "/notebook": {
    from: "#0284c7",
    to: "#38bdf8",
    glyph: (
      <g>
        <rect x="12" y="9" width="24" height="30" rx="3.5" fill="none" stroke="#fff" strokeWidth="3" />
        <path d="M18 17h12M18 23h12M18 29h7" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        <path d="M38 8.5l1.3 3.2 3.2 1.3-3.2 1.3L38 17.5l-1.3-3.2-3.2-1.3 3.2-1.3z" fill="#fff" />
      </g>
    ),
  },
  // 슬라이드·인포그래픽 프롬프트 — 슬라이드 화면 + 팔레트 점
  "/notebook/slides": {
    from: "#ec4899",
    to: "#f9a8d4",
    glyph: (
      <g>
        <rect x="9" y="10" width="30" height="21" rx="3.5" fill="none" stroke="#fff" strokeWidth="3" />
        <path d="M16 36h16M24 31v5" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        <circle cx="17" cy="21" r="2.6" fill="#fff" />
        <circle cx="24" cy="21" r="2.6" fill="#fff" opacity=".85" />
        <circle cx="31" cy="21" r="2.6" fill="#fff" opacity=".7" />
      </g>
    ),
  },
  // 활용 사례 — 헤드폰 + 반짝임
  "/notebook/cases": {
    from: "#7c3aed",
    to: "#a78bfa",
    glyph: (
      <g fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 28v-4a13 13 0 0 1 26 0v4" />
        <rect x="9" y="27" width="7" height="11" rx="3" fill="#fff" stroke="none" />
        <rect x="32" y="27" width="7" height="11" rx="3" fill="#fff" stroke="none" />
        <path d="M24 19.5l1.3 3 3 1.3-3 1.3-1.3 3-1.3-3-3-1.3 3-1.3z" fill="#fff" stroke="none" />
      </g>
    ),
  },
  // 시간표 단말 — 터치 화면 + 시간표 칸 + 아래 받침
  "/board": {
    from: "#0e7490",
    to: "#22d3ee",
    glyph: (
      <g>
        <rect x="8" y="10" width="32" height="23" rx="3.5" fill="none" stroke="#fff" strokeWidth="3" />
        <path d="M14 18h20M14 24h20M22 14v15" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".9" />
        <circle cx="30" cy="27.5" r="2.4" fill="#fff" />
        <path d="M17 38h14" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      </g>
    ),
  },
  // SVG Forge — 벡터 곡선(제어점) + 레이저 빔
  "https://svg-forge-01.netlify.app/": {
    from: "#dc2626",
    to: "#fb923c",
    glyph: (
      <g fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 33C14 14 26 14 24 26S34 36 38 17" />
        <circle cx="10" cy="33" r="3" fill="#fff" stroke="none" />
        <circle cx="38" cy="17" r="3" fill="#fff" stroke="none" />
        <path d="M24 5v8M20 9h8" strokeWidth="2.4" />
      </g>
    ),
  },
  // 레이저 이미지 변환기 — 사진 틀 + 점(디더링) + 레이저 빔
  "/laser/": {
    from: "#0f172a",
    to: "#475569",
    glyph: (
      <g fill="#fff">
        <rect x="9" y="17" width="30" height="22" rx="3.5" fill="none" stroke="#fff" strokeWidth="3" />
        <circle cx="17" cy="26" r="2" />
        <circle cx="24" cy="31" r="2" />
        <circle cx="31" cy="26" r="2" />
        <circle cx="17" cy="33" r="1.3" opacity=".7" />
        <circle cx="31" cy="33" r="1.3" opacity=".7" />
        <path d="M24 5v9" stroke="#fb923c" strokeWidth="3.4" strokeLinecap="round" />
        <circle cx="24" cy="16" r="2.4" fill="#fb923c" />
      </g>
    ),
  },
  // HappyMpX — 음표 + 아래 화살표(내려받기)
  "https://happymp3.web.app/": {
    from: "#16a34a",
    to: "#86efac",
    glyph: (
      <g fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 29V10l14-3v18" />
        <ellipse cx="15.5" cy="29.5" rx="4.3" ry="3.4" fill="#fff" stroke="none" />
        <ellipse cx="29.5" cy="25.5" rx="4.3" ry="3.4" fill="#fff" stroke="none" />
        <path d="M24 34v8M20 39l4 4 4-4" />
      </g>
    ),
  },
  // 인공지능 기초 — 책 + 반짝이는 AI 점
  "/aibasic/": {
    from: "#0f766e",
    to: "#2dd4bf",
    glyph: (
      <g fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 14c5-2 10-2 14 1 4-3 9-3 14-1v19c-5-2-10-2-14 1-4-3-9-3-14-1z" />
        <path d="M24 15v19" strokeWidth="2" />
        <circle cx="35" cy="10" r="2.4" fill="#fff" stroke="none" />
      </g>
    ),
  },
  // 온라인 과학 체험 — 플라스크 + 거품
  "/science/": {
    from: "#1f6fd1",
    to: "#22c3a6",
    glyph: (
      <g>
        <path d="M19.5 9.5h9" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        <path d="M21.5 9.5v10L12.4 34.6a3 3 0 0 0 2.6 4.4h18a3 3 0 0 0 2.6-4.4L26.5 19.5v-10" fill="none" stroke="#fff" strokeWidth="3" strokeLinejoin="round" />
        <path d="M16.2 29h15.6l3.4 5.9a2.4 2.4 0 0 1-2.1 3.6H14.9a2.4 2.4 0 0 1-2.1-3.6z" fill="#fff" />
        <circle cx="22" cy="24.5" r="1.7" fill="#fff" />
        <circle cx="26.2" cy="21.5" r="1.2" fill="#fff" />
        <circle cx="34.5" cy="12.5" r="2.4" fill="none" stroke="#fff" strokeWidth="2" />
        <circle cx="39" cy="7.5" r="1.6" fill="#fff" />
      </g>
    ),
  },
  // 인공지능 수학 — 시그마 + 연결 점(신경망)
  "/aimath": {
    from: "#4f46e5",
    to: "#a78bfa",
    glyph: (
      <g fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M30 11H15l9 13-9 13h15" />
        <circle cx="35" cy="14" r="2.6" fill="#fff" stroke="none" />
        <circle cx="38" cy="24" r="2.6" fill="#fff" stroke="none" />
        <circle cx="35" cy="34" r="2.6" fill="#fff" stroke="none" />
        <path d="M33 16l3 6M36 26l-2 6" strokeWidth="1.8" />
      </g>
    ),
  },
  // 온라인 수학 체험 — 네 칸 조각(테트로미노) + 반짝임
  "/mathplay": {
    from: "#0ea5a4",
    to: "#34d399",
    glyph: (
      <g>
        <rect x="9" y="13" width="9.5" height="9.5" rx="2.2" fill="#fff" />
        <rect x="19.3" y="13" width="9.5" height="9.5" rx="2.2" fill="#fff" fillOpacity=".85" />
        <rect x="19.3" y="23.3" width="9.5" height="9.5" rx="2.2" fill="#fff" fillOpacity=".85" />
        <rect x="29.6" y="23.3" width="9.5" height="9.5" rx="2.2" fill="#fff" />
        <path d="M36 8v6M33 11h6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      </g>
    ),
  },
  // 손발전기 — 번개 + 돌리는 손잡이
  "/handgen/": {
    from: "#f59e0b",
    to: "#fde047",
    glyph: (
      <g>
        <circle cx="21" cy="25" r="11" fill="none" stroke="#fff" strokeWidth="3" />
        <path d="M23.5 16.5l-6 9.5h4.6l-2.6 7.5 6.8-10.2h-4.6z" fill="#fff" />
        <path d="M31 17.5l6-6" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        <circle cx="38.5" cy="10" r="3" fill="#fff" />
      </g>
    ),
  },
};

// 전체 주소(https://…/aimath/)와 끝 슬래시 차이를 흡수해서 아이콘을 찾는다
// 다른 사이트 첫 화면(경로가 "/")으로 가는 카드는 사이트 주소로 아이콘을 고른다
const HOSTS: Record<string, string> = { "ai-study-science.web.app": "/science/" };
function iconKey(path: string): string | undefined {
  if (ICONS[path]) return path; // 해피스탬프·노래공방처럼 전체 주소로 등록된 아이콘
  let p = path;
  if (path.startsWith("http")) {
    const u = new URL(path);
    if (HOSTS[u.hostname] && (u.pathname === "/" || u.pathname === "")) return HOSTS[u.hostname];
    p = u.pathname;
  }
  return [p, p.replace(/\/$/, ""), p.endsWith("/") ? p : `${p}/`].find((k) => ICONS[k]);
}

export default function SectionIcon({ path, size = 48 }: { path: string; size?: number }) {
  const key = iconKey(path);
  if (!key) return null;
  const icon = ICONS[key];
  const id = `g${key.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className="shrink-0 drop-shadow-sm">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={icon.from} />
          <stop offset="1" stopColor={icon.to} />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill={`url(#${id})`} />
      {icon.glyph}
    </svg>
  );
}
