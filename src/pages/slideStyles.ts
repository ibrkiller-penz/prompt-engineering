// 슬라이드·인포그래픽 프롬프트의 "구성 방식" (그래픽 위주 / 도형 위주 / 주요 내용 위주 / 설명 위주)
// 디자인(색·레이아웃)은 그대로 두고, 실행 지침(user_steering_prompt) 끝에 번호 하나를 더해 붙인다.
// 새 방식을 더하려면 VARIANTS에 항목 하나를 추가하면 된다.

export type Variant = {
  id: string;
  icon: string;
  label: string;
  /** 사람이 읽는 한 줄 설명 */
  hint: string;
  /** 노트북LM 맞춤설정 창에서 같이 고르면 좋은 '형식' */
  format: string;
  /** 어울리는 경우 */
  when: string;
  /** 사람이 읽는 풀이 (더해지는 지침이 무슨 뜻인지) */
  ko: string[];
  /** 슬라이드 프롬프트에 더하는 영어 지침 (제목 + 세부) */
  slide: { head: string; bullets: string[] } | null;
  /** 인포그래픽(한 장) 프롬프트에 더하는 영어 지침 */
  info: { head: string; bullets: string[] } | null;
};

export const VARIANTS: Variant[] = [
  {
    id: "basic",
    icon: "📄",
    label: "기본",
    hint: "지금까지 쓰던 그대로예요. 글과 그림이 균형 있게 들어가요.",
    format: "발표자 슬라이드",
    when: "처음이거나 어떤 걸 고를지 모르겠을 때",
    ko: [],
    slide: null,
    info: null,
  },
  {
    id: "graphic",
    icon: "🖼️",
    label: "그래픽 위주",
    hint: "큰 그림·일러스트·아이콘이 중심이고 글은 아주 적어요.",
    format: "발표자 슬라이드",
    when: "눈길을 끌어야 하는 발표, 저학년 대상, 분위기를 전할 때",
    ko: [
      "슬라이드마다 화면의 60% 이상을 차지하는 큰 그림 하나",
      "글은 제목과 짧은 한 줄(12단어 이내)만",
      "목록 대신 비유·장면·아이콘으로 이야기하기",
    ],
    slide: {
      head: "Content Style = GRAPHIC-FIRST:",
      bullets: [
        "Every slide has one dominant hero visual (illustration, icon cluster, or large symbolic image) occupying at least 60% of the canvas.",
        "Limit on-slide text to a short headline plus at most ONE short line (max 12 words); leave all other details out of the slide.",
        "Prefer metaphors, scenes, and icon-based storytelling over bullet lists.",
        "Keep one consistent illustration style and the palette from [Global Design System].",
      ],
    },
    info: {
      head: "Content Style = GRAPHIC-FIRST:",
      bullets: [
        "Build the canvas around one dominant central illustration or visual metaphor, with icons placed around it.",
        "Each section gets at most one short label (max 8 words); keep text minimal.",
        "Keep one consistent illustration style and the palette from [Global Design System].",
      ],
    },
  },
  {
    id: "shapes",
    icon: "🔷",
    label: "도형·도식 위주",
    hint: "흐름도·순환도·표·타임라인 같은 도형으로 내용을 정리해요.",
    format: "발표자 슬라이드",
    when: "개념의 관계·순서·비교를 보여 줄 때",
    ko: [
      "핵심 내용을 흐름도·순환도·타임라인·비교표·벤다이어그램 같은 도형 구조로 바꾸기",
      "글은 도형 안의 짧은 이름표(1~4단어)만, 문단·목록은 쓰지 않기",
      "도형 모양·연결선·번호 표시를 디자인 지침대로 통일하고 격자에 맞춰 정렬",
    ],
    slide: {
      head: "Content Style = SHAPE & DIAGRAM-FIRST:",
      bullets: [
        "Convert every key idea into a structured shape layout: flowchart, cycle, process arrows, timeline, matrix, Venn diagram, comparison table, hierarchy tree, or pyramid/funnel.",
        "Put text only inside shapes as short labels (1-4 words each); no paragraphs and no bullet lists.",
        "Use consistent shape styling (rounded containers, connectors, numbered markers) from [Global Design System] and align everything on a clean grid.",
      ],
    },
    info: {
      head: "Content Style = SHAPE & DIAGRAM-FIRST:",
      bullets: [
        "Organize every section as connected shapes: flow, cycle, timeline, matrix, or comparison blocks.",
        "Put text only inside shapes as short labels (1-4 words each); no paragraphs.",
        "Use consistent shape styling from [Global Design System] on a clean modular grid.",
      ],
    },
  },
  {
    id: "keypoints",
    icon: "🎯",
    label: "주요 내용 위주",
    hint: "한 장에 핵심 한 줄과 키워드 몇 개만. 요점만 빠르게 전달해요.",
    format: "발표자 슬라이드",
    when: "시간이 짧은 발표, 요약 자료, 복습",
    ko: [
      "슬라이드마다 핵심 메시지는 딱 하나(굵은 제목)",
      "받쳐 주는 키워드는 3개 이내(각 8단어 이내)",
      "가장 중요한 낱말이나 숫자 하나를 강조색·큰 글씨로",
      "배경 설명·예시·부수 정보는 빼고 여백을 넉넉히",
    ],
    slide: {
      head: "Content Style = KEY-POINTS-FIRST:",
      bullets: [
        "Each slide delivers exactly ONE core message as a bold headline, supported by at most 3 short keyword bullets (max 8 words each).",
        "Highlight the single most important keyword or number on each slide in the accent color and large type.",
        "Omit background details, examples, and secondary information; keep generous whitespace for readability.",
      ],
    },
    info: {
      head: "Content Style = KEY-POINTS-FIRST:",
      bullets: [
        "Include only the 3-5 most important messages; show each with a large number or keyword and one short supporting line.",
        "Omit background details and secondary information; keep generous whitespace.",
      ],
    },
  },
  {
    id: "explain",
    icon: "📖",
    label: "설명 위주",
    hint: "문장으로 풀어 쓴 자세한 설명이 중심이에요. 혼자 읽는 자료에 좋아요.",
    format: "자세한 자료",
    when: "혼자 읽는 수업 자료, 이메일로 보내는 자료, 개념 설명",
    ko: [
      "슬라이드마다 제목과 4~6문장의 쉬운 설명",
      "소스에 있으면 뜻풀이·이유(왜)·예시 하나를 넣기",
      "작은 그림이나 아이콘은 곁들이되 글이 중심, 글자는 읽기 편한 크기 이하로 줄이지 않기",
    ],
    slide: {
      head: "Content Style = EXPLANATION-FIRST (reading material):",
      bullets: [
        "Each slide has a clear headline and an explanatory body of 4-6 complete sentences written in plain language.",
        "Include a definition, the reason (why), and one concrete example or analogy whenever the source provides them.",
        "Add a small supporting diagram or icon beside the text, but keep text as the main content and never shrink body text below a comfortable reading size.",
      ],
    },
    info: {
      head: "Content Style = EXPLANATION-FIRST (reading poster):",
      bullets: [
        "Each section has a heading and 2-3 short explanatory sentences in plain language, with a small icon.",
        "Keep the reading order clear and the body text at a comfortable reading size.",
      ],
    },
  },
];

export type Applied = { text: string; start: number; end: number };

/**
 * 완성 프롬프트(user_steering_prompt 끝)에 구성 방식 지침을 번호 하나로 덧붙인다.
 * start/end는 덧붙인 부분의 위치라서 화면에서 강조 표시할 때 쓴다.
 */
export function applyVariant(text: string, v: Variant, kind: "slides" | "infographic"): Applied {
  const rule = kind === "slides" ? v.slide : v.info;
  if (!rule) return { text, start: -1, end: -1 };
  const close = text.lastIndexOf('\n  "\n}');
  const from = text.indexOf("user_steering_prompt");
  if (close < 0 || from < 0) return { text, start: -1, end: -1 };
  const nums = [...text.slice(from, close).matchAll(/\n {4}(\d+)\. /g)].map((m) => Number(m[1]));
  const n = (nums.length ? Math.max(...nums) : 0) + 1;
  const block = `\n    ${n}. ${rule.head}` + rule.bullets.map((b) => `\n       - ${b}`).join("");
  return { text: text.slice(0, close) + block + text.slice(close), start: close, end: close + block.length };
}
