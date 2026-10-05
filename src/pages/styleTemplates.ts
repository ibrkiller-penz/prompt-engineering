// 스타일 템플릿: 색(팔레트)과 따로 고르는 "모양" — 글꼴 느낌, 도형, 제목·본문·숫자·도식의 배치 규칙
// 선택한 디자인의 'Style:'과 'Type A~D' 줄만 바꾼다 (COLOR_* 변수는 그대로라서 어떤 팔레트와도 어울린다).
// 새 템플릿을 더하려면 STYLES에 항목 하나를 추가하고 StyleMock.tsx에 작은 그림을 더한다.
import { buildInfographic, type DesignLike } from "./designTools";

export type StyleTemplate = {
  id: string;
  icon: string;
  label: string;
  /** 사람이 읽는 한 줄 설명 */
  hint: string;
  when: string;
  /** 프롬프트의 Style 줄 */
  style: string;
  /** Type A 제목 / B 본문 / C 숫자 / D 도식 */
  a: string;
  b: string;
  c: string;
  d: string;
  /** 인포그래픽 프롬프트의 'Overall look' 앞부분 */
  look: string;
};

export const STYLES: StyleTemplate[] = [
  {
    id: "basic",
    icon: "📄",
    label: "기본",
    hint: "지금까지 쓰던 깔끔한 미니멀 그대로예요.",
    when: "어떤 걸 고를지 모르겠을 때",
    style: "",
    a: "",
    b: "",
    c: "",
    d: "",
    look: "",
  },
  {
    id: "editorial",
    icon: "📰",
    label: "에디토리얼 매거진",
    hint: "큰 명조 제목과 가는 선, 여백이 넉넉한 잡지 느낌이에요.",
    when: "읽는 자료, 보고서, 인문·사회 수업",
    style: "Editorial Magazine: elegant serif headlines (like Noto Serif KR) with clean sans-serif body text, generous margins, thin hairline rules, asymmetric two-column layouts.",
    a: "Left-aligned oversized serif title with a thin COLOR_ACCENT_1 rule above it and a small uppercase kicker line.",
    b: "Two-column text with a short pull-quote in COLOR_ACCENT_1; bullets as small em-dashes.",
    c: "Giant serif numerals in COLOR_POINT with a hairline underline and a tiny caption.",
    d: "Simple line diagrams with hairline connectors and small numbered circles.",
    look: "an editorial magazine-style infographic with elegant serif headings, thin hairline rules, and generous margins",
  },
  {
    id: "bento",
    icon: "🍱",
    label: "벤토 그리드",
    hint: "크기가 다른 둥근 타일을 격자로 짜 맞춘 모양이에요.",
    when: "핵심 요약, 한눈에 보는 정리, 대시보드",
    style: "Bento Grid: modular rounded tiles of different sizes in a tidy grid, friendly modern sans-serif (like Pretendard), soft contrast between tiles.",
    a: "One large hero tile with the bold title, plus two small tiles for the subtitle and an icon.",
    b: "Content split across 3 to 4 rounded tiles, each with one icon and one short line; tile fills alternate between soft tints of COLOR_ACCENT_1 and COLOR_ACCENT_2.",
    c: "One big tile per key number in COLOR_POINT with a small label tile beside it.",
    d: "Tiles linked by short arrows to show the flow.",
    look: "a bento-grid infographic made of rounded tiles of different sizes in a tidy modular layout",
  },
  {
    id: "playful",
    icon: "🎈",
    label: "둥글둥글 놀이터",
    hint: "아주 둥근 모양, 큰 글씨, 스티커 같은 아이콘이에요.",
    when: "초등 저학년, 활기찬 분위기",
    style: "Rounded Playful: very rounded shapes, big friendly rounded sans-serif (like Jua), sticker-like icons, wavy dividers, cheerful but tidy.",
    a: "Big rounded centered title on a blob shape in COLOR_ACCENT_1 with small sticker icons around it.",
    b: "Large rounded text with circle bullets in COLOR_ACCENT_2 and one big sticker icon per slide.",
    c: "Numbers inside big circles or speech bubbles in COLOR_POINT.",
    d: "Chunky rounded arrows and bubble-shaped steps.",
    look: "a playful infographic with very rounded shapes, sticker-like icons, wavy dividers, and big friendly letters",
  },
  {
    id: "sketch",
    icon: "✏️",
    label: "손그림 노트",
    hint: "손으로 그린 선과 형광펜 표시, 공책 같은 느낌이에요.",
    when: "개념 정리, 필기·노트 느낌",
    style: "Hand-drawn Notebook: sketchy hand-drawn lines and doodle icons, marker highlights, handwritten-style headings (like Gaegu), paper-tape and sticky-note accents.",
    a: "Handwritten-style title with a hand-drawn COLOR_ACCENT_1 underline and small doodles.",
    b: "Short handwritten-style lines with hand-drawn check marks; key words highlighted with a COLOR_ACCENT_2 marker stroke.",
    c: "Big hand-drawn numbers in COLOR_POINT circled with a sketchy ring.",
    d: "Hand-drawn arrows and boxes like a whiteboard sketch.",
    look: "a hand-drawn notebook-style infographic with sketchy lines, doodle icons, marker highlights, and handwritten-style headings",
  },
  {
    id: "poster",
    icon: "🔠",
    label: "대형 타이포 포스터",
    hint: "아주 큰 글자와 굵은 색 면, 강한 대비예요.",
    when: "발표 도입, 구호, 핵심 메시지 한 줄",
    style: "Bold Poster: huge heavy typography (like Black Han Sans), large flat color blocks, strong contrast, minimal decoration.",
    a: "Giant title filling most of the slide on a COLOR_ACCENT_1 color block.",
    b: "One huge key sentence with at most 3 short supporting lines; flat color blocks instead of bullets.",
    c: "Enormous numerals in COLOR_POINT taking up half of the slide.",
    d: "Big blocky shapes joined by thick arrows.",
    look: "a bold poster-style infographic with huge heavy typography, large flat color blocks, and strong contrast",
  },
  {
    id: "blueprint",
    icon: "📐",
    label: "기술 도면",
    hint: "가는 선과 격자, 고정폭 글자 이름표가 있는 도면 느낌이에요.",
    when: "과학·기술·공학 수업",
    style: "Technical Blueprint: fine grid background, thin precise lines, monospace labels (like D2Coding), callout lines, engineering-drawing feel.",
    a: "Left-aligned title with a monospace section code (like 01 / 12) inside a thin COLOR_ACCENT_1 frame.",
    b: "Short lines with square bullets and monospace labels; thin callout lines pointing to key terms.",
    c: "Numbers in monospace with unit labels, framed by thin COLOR_POINT corner marks.",
    d: "Precise orthogonal flow diagrams with thin connectors and labeled nodes.",
    look: "a technical blueprint-style infographic with a fine grid, thin precise lines, monospace labels, and callout lines",
  },
  {
    id: "glass",
    icon: "🫧",
    label: "소프트 글래스",
    hint: "반투명 카드와 부드러운 그림자, 은은한 그라데이션이에요.",
    when: "세련된 발표, 서비스·프로젝트 소개",
    style: "Soft Glass: translucent frosted cards over a soft COLOR_BG gradient, gentle shadows, large rounded corners, clean modern sans-serif.",
    a: "Title on a frosted card centered over a soft glow that blends COLOR_ACCENT_1 and COLOR_ACCENT_2.",
    b: "Content on frosted cards with soft shadows; icons in COLOR_ACCENT_1.",
    c: "Numbers on a glass card in COLOR_POINT with a subtle gradient.",
    d: "Glass nodes connected by soft glowing lines.",
    look: "a soft glass-style infographic with translucent frosted cards, gentle shadows, and large rounded corners",
  },
  {
    id: "classic",
    icon: "🎓",
    label: "클래식 학술",
    hint: "단정한 명조체, 가운데 정렬, 격식 있는 느낌이에요.",
    when: "연구·논문 소개, 공식 발표, 연수",
    style: "Classic Academic: refined serif typography (like Noto Serif KR), centered titles, formal hierarchy, numbered sections, footnote-style captions.",
    a: "Centered serif title with a thin double rule in COLOR_ACCENT_1 and the subtitle in COLOR_TEXT_SUB.",
    b: "Numbered points in serif text; section numbers in COLOR_ACCENT_1.",
    c: "Figures and numbers in a clean bordered callout with COLOR_POINT highlights.",
    d: "Formal flowcharts with thin boxes and labeled arrows.",
    look: "a classic academic-style infographic with refined serif typography, centered titles, and numbered sections",
  },
];

/** 선택한 디자인의 글이 스타일을 바꿀 수 있는 형식인가 (부산 원본 2종은 형식이 달라 고정) */
export const canStyle = (d: Pick<DesignLike, "design">) =>
  /^- Style:/m.test(d.design) && ["A (Title)", "B (Body)", "C (Data)", "D (Diagram)"].every((t) => d.design.includes(`- Type ${t}:`));

/** 디자인 글(design·slides)의 Style/Type 줄과 인포그래픽 프롬프트의 전체 모양을 스타일에 맞게 바꾼다 */
export function applyStyle<T extends DesignLike>(d: T, s: StyleTemplate): T {
  if (s.id === "basic" || !canStyle(d)) return d;
  const swap = (t: string) =>
    t
      .replace(/^- Style:.*$/m, () => `- Style: ${s.style}`)
      .replace(/^- Type A \(Title\):.*$/m, () => `- Type A (Title): ${s.a}`)
      .replace(/^- Type B \(Body\):.*$/m, () => `- Type B (Body): ${s.b}`)
      .replace(/^- Type C \(Data\):.*$/m, () => `- Type C (Data): ${s.c}`)
      .replace(/^- Type D \(Diagram\):.*$/m, () => `- Type D (Diagram): ${s.d}`);
  const n: T = { ...d, design: swap(d.design), slides: swap(d.slides) };
  n.infographic = buildInfographic(n, s.look);
  return n;
}
