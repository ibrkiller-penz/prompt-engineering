// 슬라이드 디자인 도구: 색 계산, 분위기 분류, "내 색으로 만들기"
// scripts/make-infographic-prompts.py 와 같은 규칙이다 (인포그래픽 프롬프트·색 이름). 규칙을 바꾸면 두 곳을 같이 고친다.

export type Palette = { bg: string; text: string; sub: string; a1: string; a2: string; point: string };

export const PALETTE_FIELDS: { key: keyof Palette; label: string; need: number; hint: string }[] = [
  { key: "bg", label: "배경", need: 0, hint: "슬라이드 바탕색" },
  { key: "text", label: "본문 글자", need: 7, hint: "제목·본문 글자" },
  { key: "sub", label: "보조 글자", need: 4.5, hint: "작은 설명 글자" },
  { key: "a1", label: "강조 1", need: 3, hint: "선·글머리·강조" },
  { key: "a2", label: "강조 2", need: 3, hint: "보조 강조" },
  { key: "point", label: "포인트", need: 3, hint: "큰 숫자·눈에 띌 곳" },
];

export const HEX = /^#[0-9a-fA-F]{6}$/;

const rgb = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];

/** WCAG 상대 밝기 */
export function lum(h: string): number {
  const [r, g, b] = rgb(h).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 두 색의 명도 대비 (1~21) */
export function contrast(a: string, b: string): number {
  const la = lum(a);
  const lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** 어두운 배경인가 (글자가 밝은 색이어야 하는 배경) */
export const isDarkBg = (hex: string) => lum(hex) < 0.2;

// ---------------------------------------------------------------- 색 이름 (파이썬 colorsys 와 같은 계산)
function hls(r: number, g: number, b: number): [number, number, number] {
  const maxc = Math.max(r, g, b);
  const minc = Math.min(r, g, b);
  const sumc = maxc + minc;
  const rangec = maxc - minc;
  const l = sumc / 2;
  if (minc === maxc) return [0, l, 0];
  const s = l <= 0.5 ? rangec / sumc : rangec / (2 - maxc - minc);
  const rc = (maxc - r) / rangec;
  const gc = (maxc - g) / rangec;
  const bc = (maxc - b) / rangec;
  let h = r === maxc ? bc - gc : g === maxc ? 2 + rc - bc : 4 + gc - rc;
  h = (h / 6) % 1;
  if (h < 0) h += 1;
  return [h, l, s];
}

/** #RRGGBB → 'deep blue' 같은 쉬운 영어 이름 (white/black 낱말은 피한다) */
export function colorName(hex: string): string {
  const [r, g, b] = rgb(hex);
  const [hh, ll, ss] = hls(r, g, b);
  const deg = hh * 360;
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  if (chroma < 0.06) {
    if (ll < 0.15) return "charcoal";
    if (ll < 0.35) return "dark gray";
    if (ll < 0.65) return "medium gray";
    if (ll < 0.9) return "light gray";
    return "clean light";
  }
  if (chroma < 0.14 && ll < 0.88) {
    const shade = ll < 0.35 ? "dark" : ll < 0.65 ? "medium" : "light";
    return `${deg < 70 || deg >= 330 ? "warm" : "cool"} ${shade} gray`;
  }
  let base: string;
  if (deg < 15 || deg >= 345) base = "red";
  else if (deg < 40) base = "orange";
  else if (deg < 55) base = "golden yellow";
  else if (deg < 70) base = "yellow";
  else if (deg < 165) base = "green";
  else if (deg < 195) base = "teal";
  else if (deg < 250) base = "blue";
  else if (deg < 280) base = "indigo";
  else if (deg < 310) base = "purple";
  else base = "pink";
  if (base === "orange" && ll < 0.42) base = "rust brown";
  let tone: string;
  if (ll < 0.22) tone = "very dark";
  else if (ll < 0.38) tone = "deep";
  else if (ll < 0.62) tone = ss > 0.7 ? "vivid" : "";
  else if (ll < 0.82) tone = "soft";
  else tone = "pale";
  return `${tone} ${base}`.trim();
}

// ---------------------------------------------------------------- 인포그래픽 프롬프트 (자연어 디자인 설명서)
const ROLE_EN: Record<string, string> = {
  배경: "background",
  "제목·본문 글자": "titles and body text",
  "본문 글자": "body text",
  "보조 글자": "secondary text",
  "강조·밑줄·체크": "accents, underlines and check marks",
  "글머리 아이콘": "bullet icons",
  "강조 1": "primary accent",
  "강조 2": "secondary accent",
  "주 강조": "main accent",
  포인트: "highlight color for key numbers",
  "포인트·큰 숫자": "highlight color for big numbers",
};

export type DesignLike = {
  id: string;
  name: string;
  mood: string;
  tone?: string;
  bg: string;
  text: string;
  accents: string[];
  audience: string;
  colors: { role: string; name: string; hex: string }[];
  design: string;
  slides: string;
  infographic: string;
  script20: string;
  script60: string;
  infoScript: string;
};

/** look: 스타일 템플릿이 정한 전체 모양 설명 (없으면 기본 문장) */
export function buildInfographic(d: Pick<DesignLike, "name" | "mood" | "bg" | "audience" | "colors" | "design">, look?: string): string {
  const surface = isDarkBg(d.bg) ? "dark" : "light";
  const palette = d.colors.map((c) => `  - ${ROLE_EN[c.role] ?? c.role}: ${colorName(c.hex)} (${c.hex})`).join("\n");
  const gr = d.design.match(/^Graphics:\s*(.+)$/m);
  const motif = gr ? gr[1].replace(/\s+/g, " ").trim().replace(/ ,/g, ",") : "";
  const extra = motif ? `- Graphic motifs: ${motif}\n` : "";
  return `Create ONE infographic from the selected source (an [Infographic Master Blueprint] script).

## Content
- Use only information that is in the source. Copy each section's title and its "On-Screen Text" lines exactly as written. Do not add facts or change any numbers.
- Make one block per blueprint section (3 to 4 blocks). In each block, draw the icon or chart described in its "Visualization Suggestion", and show its "Highlighted Data/Keyword" in the largest type of that block.
- If the source is not a blueprint, choose the 3 to 4 most important ideas yourself, using only facts from the source.
- Write all text in Korean, the same language as the source.
- Target Audience: ${d.audience}

## Reading flow
- Top: one bold title with a one-line subtitle.
- Middle: the section blocks in a clear top-to-bottom path, grouped by theme, with generous white space.
- Bottom: one short takeaway line.
- Viewers should notice the title and the biggest number first, then the supporting points.

## Visual style: ${d.name} (${d.mood})
- Overall look: ${look ? `${look}, on a ${surface} background` : `a clean, modern, well-organized infographic on a ${surface} background, with rounded cards, thin lines, and one consistent flat icon style`}.
- Palette:
${palette}
${extra}- Keep strong contrast between text and background so every letter stays readable.

## Text rules (important)
- Keep text minimal: short labels and phrases, about 8 words per line at most, no long sentences.
- Large, clean, easy-to-read Korean letters. No overlapping and no tiny text.
- Emphasize at most 3 elements; keep everything else calm.
`;
}

// ---------------------------------------------------------------- 분위기 분류 (Color Hunt 같은 사이트의 태그 방식)
export const TAGS = ["밝은 배경", "어두운 배경", "따뜻한 색", "시원한 색"] as const;

export function tagsOf(d: { bg: string; accents: string[] }): string[] {
  const [r, g, b] = rgb(d.accents[0] ?? "#2563eb");
  const deg = hls(r, g, b)[0] * 360;
  return [isDarkBg(d.bg) ? "어두운 배경" : "밝은 배경", deg < 70 || deg >= 330 ? "따뜻한 색" : "시원한 색"];
}

// ---------------------------------------------------------------- 내 색으로 만들기
const VARS: [keyof Palette, string][] = [
  ["bg", "COLOR_BG"],
  ["text", "COLOR_TEXT_MAIN"],
  ["sub", "COLOR_TEXT_SUB"],
  ["a1", "COLOR_ACCENT_1"],
  ["a2", "COLOR_ACCENT_2"],
  ["point", "COLOR_POINT"],
];

/** 5~6색을 넣으면 밝은/어두운 틀을 복제해 새 디자인을 만든다 (색 줄과 이름·분위기만 바뀐다) */
export function makeCustomDesign<T extends DesignLike>(light: T, dark: T, pal: Palette): T {
  const base = isDarkBg(pal.bg) ? dark : light;
  const d: T = JSON.parse(JSON.stringify(base));
  const swap = (t: string) => {
    let r = t;
    for (const [k, v] of VARS) r = r.replace(new RegExp(`(- ${v}: )#[0-9A-Fa-f]{6}`), `$1${pal[k].toUpperCase()}`);
    return r;
  };
  d.design = swap(base.design);
  d.slides = swap(base.slides);
  d.id = "custom";
  d.name = "내 색";
  d.mood = "내가 고른 색";
  d.tone = isDarkBg(pal.bg) ? "dark" : "light";
  d.bg = pal.bg.toUpperCase();
  d.text = pal.text.toUpperCase();
  d.accents = [pal.a1, pal.a2, pal.point].map((x) => x.toUpperCase());
  d.colors = base.colors.map((c) => {
    const f = VARS.find(([, v]) => v === `COLOR_${c.name}`);
    return { ...c, hex: f ? pal[f[0]].toUpperCase() : c.hex };
  });
  d.infographic = buildInfographic(d);
  return d;
}

/** 주소에 넣는 짧은 글(#없는 6색)과 팔레트 사이를 바꾼다 */
export const paletteToParam = (p: Palette) => [p.bg, p.text, p.sub, p.a1, p.a2, p.point].map((x) => x.replace("#", "").toLowerCase()).join("-");
export function paletteFromParam(s: string | null): Palette | null {
  if (!s) return null;
  const v = s.split("-").map((x) => `#${x}`);
  if (v.length !== 6 || !v.every((x) => HEX.test(x))) return null;
  return { bg: v[0], text: v[1], sub: v[2], a1: v[3], a2: v[4], point: v[5] };
}
