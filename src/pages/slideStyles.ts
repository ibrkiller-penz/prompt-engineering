// 슬라이드·인포그래픽 프롬프트의 "구성 방식" (그래픽 위주 / 도형 위주 / 주요 내용 위주 / 설명 위주)
// 디자인(색·레이아웃)은 그대로 두고, 실행 지침(user_steering_prompt) 끝에 번호 하나를 더해 붙인다.
// 새 방식을 더하려면 VARIANTS에 항목 하나를 추가하면 된다.

export type Variant = {
  id: string;
  /** 메뉴에서 묶는 이름 */
  group: string;
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
    group: "기본",
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
    group: "내용을 보여 주는 방식",
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
        "Keep one consistent illustration style and the palette above.",
      ],
    },
  },
  {
    id: "shapes",
    group: "내용을 보여 주는 방식",
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
        "Use consistent shape styling (rounded containers and connectors) on a clean modular grid, in the palette above.",
      ],
    },
  },
  {
    id: "keypoints",
    group: "내용을 보여 주는 방식",
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
    group: "내용을 보여 주는 방식",
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
  {
    id: "steps",
    group: "수업에 쓰기 좋은 방식 ⭐",
    icon: "🪜",
    label: "단계·순서 위주",
    hint: "'1단계, 2단계…' 순서대로 따라 하게 만들어요.",
    format: "발표자 슬라이드",
    when: "만들기·실험·사용법·절차를 알려 줄 때",
    ko: [
      "한 장(한 칸)에 동작 하나, 번호 배지와 동사로 끝나는 짧은 제목",
      "동작을 보여 주는 그림 하나와 '팁' 또는 '조심' 한 줄",
      "문장은 12단어 이내로 짧게",
    ],
    slide: {
      head: "Content Style = STEP-BY-STEP (how-to):",
      bullets: [
        "Present the content as a numbered sequence; each slide covers one clear action with a number badge and a short verb-first title.",
        "Show one visual of the action, plus one short 'Tip' or 'Watch out' line; keep sentences under 12 words.",
        "Keep the order exactly as in the source.",
      ],
    },
    info: {
      head: "Content Style = STEP-BY-STEP (how-to):",
      bullets: [
        "Lay the sections out as a numbered path from start to finish, with a number badge, a verb-first title, and one small visual per step.",
        "Add a short 'Tip' or 'Watch out' note to the steps that need it.",
      ],
    },
  },
  {
    id: "quiz",
    group: "수업에 쓰기 좋은 방식 ⭐",
    icon: "❓",
    label: "퀴즈·활동 위주",
    hint: "설명 뒤에 생각해 볼 질문이나 짧은 활동이 붙어요.",
    format: "발표자 슬라이드",
    when: "학생이 직접 생각하고 말하게 하는 수업",
    ko: [
      "핵심 내용을 설명한 뒤 확인 질문·짝과 이야기하기·짧은 활동 칸을 넣기",
      "정답이나 토론 힌트는 따로 작은 칸에 두어 발표자가 나중에 보여 주기",
      "질문은 학생이 읽기 쉬운 짧은 말로",
    ],
    slide: {
      head: "Content Style = QUIZ & ACTIVITY-FIRST:",
      bullets: [
        "After presenting each key idea, add a short check-for-understanding question, a think-pair-share prompt, or a mini activity box labeled 'Quiz', 'Think', or 'Try it'.",
        "Place the answer or a discussion hint in a clearly separated small area so the presenter can reveal it later.",
        "Keep question wording short and student-friendly.",
      ],
    },
    info: {
      head: "Content Style = QUIZ & ACTIVITY-FIRST:",
      bullets: [
        "Add small callout boxes labeled 'Quiz', 'Think', or 'Try it' next to the key sections, each with one short question.",
        "Keep question wording short and student-friendly.",
      ],
    },
  },
  {
    id: "story",
    group: "수업에 쓰기 좋은 방식 ⭐",
    icon: "📚",
    label: "이야기 위주",
    hint: "이야기처럼 흘러가요: 궁금증 → 문제 → 발견 → 정리.",
    format: "발표자 슬라이드",
    when: "흥미를 끌며 시작하는 수업, 저학년, 개념 도입",
    ko: [
      "처음에 궁금증이나 장면으로 시작하고 문제 → 발견 → 해결 → 한 줄 정리 순서로 이어가기",
      "친근한 인물이나 일상 장면을 처음부터 끝까지 반복해서 등장시키기",
      "말풍선이나 짧은 설명 글, 쉬운 입말로",
    ],
    slide: {
      head: "Content Style = STORY-FIRST:",
      bullets: [
        "Frame the content as a narrative arc: a hook (question or scene), a problem, a discovery, a resolution, and a one-line takeaway, while keeping every fact from the source.",
        "Use a relatable character or everyday scene as a recurring visual thread, with short caption-style text or speech bubbles.",
        "Write in plain, conversational language.",
      ],
    },
    info: {
      head: "Content Style = STORY-FIRST:",
      bullets: [
        "Arrange the sections as a story path: hook, problem, discovery, resolution, takeaway, with one recurring character or scene.",
        "Use short caption-style text or speech bubbles in plain, conversational language.",
      ],
    },
  },
  {
    id: "data",
    group: "수업에 쓰기 좋은 방식 ⭐",
    icon: "📊",
    label: "데이터·숫자 위주",
    hint: "큰 숫자와 그래프를 먼저 보여 주고 한 줄로 뜻을 풀어 줘요.",
    format: "발표자 슬라이드",
    when: "통계·조사·실험 결과·비교 자료를 다룰 때",
    ko: [
      "슬라이드마다 큰 숫자, 그래프(막대·선·원·아이콘 배열), 비교 중 하나를 맨 앞에",
      "그래프 아래에 '그래서 무슨 뜻?' 한 줄 풀이",
      "소스에 없는 숫자는 절대 만들어 내지 않기, 가장 중요한 수치만 강조색으로",
    ],
    slide: {
      head: "Content Style = DATA-FIRST:",
      bullets: [
        "Lead each slide with one big number, chart (bar, line, pie, or icon array), or side-by-side comparison drawn from the source.",
        "Add a one-line 'So what?' interpretation under each chart or number.",
        "Use ONLY numbers that appear in the source; never invent data. Highlight the key data point with the accent color.",
      ],
    },
    info: {
      head: "Content Style = DATA-FIRST:",
      bullets: [
        "Lead each section with one big number, chart, or comparison drawn from the source, plus a one-line 'So what?' note.",
        "Use ONLY numbers that appear in the source; never invent data. Highlight the key data point with the accent color.",
      ],
    },
  },
  {
    id: "easy",
    group: "수업에 쓰기 좋은 방식 ⭐",
    icon: "🧒",
    label: "쉬운 말 · 저학년용",
    hint: "아주 쉬운 낱말, 큰 글씨, 귀여운 그림으로 만들어요.",
    format: "발표자 슬라이드",
    when: "초등 저학년, 특수교육 대상, 낯선 개념을 처음 소개할 때",
    ko: [
      "짧은 문장과 일상에서 쓰는 쉬운 낱말만, 어려운 말은 괄호로 쉽게 풀기",
      "제목도 본문도 아주 큰 글씨, 둥글고 친근한 아이콘이나 만화풍 그림",
      "슬라이드마다 글은 짧은 두 줄 이내",
    ],
    slide: {
      head: "Content Style = SIMPLE & FRIENDLY (young learners):",
      bullets: [
        "Use very short sentences and common everyday words; avoid jargon, and explain any necessary term simply in parentheses.",
        "Use extra-large headline and body text with friendly rounded icons or cartoon-style illustrations.",
        "Allow at most 2 short lines of text per slide.",
      ],
    },
    info: {
      head: "Content Style = SIMPLE & FRIENDLY (young learners):",
      bullets: [
        "Use very short sentences and everyday words; explain any necessary term simply in parentheses.",
        "Use extra-large text with friendly rounded icons or cartoon-style illustrations.",
      ],
    },
  },
];

/** 인포그래픽(한 장짜리 그림) 탭에서 보여 줄 설명. 슬라이드 설명과 따로 쓴다. */
const INFO_VIEW: Record<string, { hint: string; when: string; ko: string[]; settings: string }> = {
  basic: {
    hint: "지금까지 쓰던 그대로예요. 구역마다 글과 그림이 균형 있게 들어가요.",
    when: "처음이거나 어떤 걸 고를지 모르겠을 때",
    ko: [],
    settings: "방향은 '세로', 세부 정보 수준은 '간결'을 추천해요. '상세'는 글자 오류가 늘 수 있어요.",
  },
  graphic: {
    hint: "한가운데 큰 그림 하나를 중심으로 아이콘이 둘러싸요. 글은 아주 적어요.",
    when: "포스터처럼 한눈에 눈길을 끌고 싶을 때, 저학년 게시물",
    ko: [
      "큰 중심 그림(상징·비유)을 하나 두고 그 둘레에 아이콘 배치",
      "구역마다 글은 짧은 이름표 하나(8단어 이내)",
      "그림 스타일과 색은 디자인 지침대로 통일",
    ],
    settings: "방향은 '정사각형'이나 '세로', 세부 정보 수준은 '간결'이 잘 어울려요.",
  },
  shapes: {
    hint: "구역들이 도형으로 이어져요: 흐름도·순환도·타임라인·비교 블록.",
    when: "순서·관계·비교를 한 장에서 보여 줄 때",
    ko: [
      "구역을 흐름도·순환도·타임라인·행렬·비교 블록 같은 도형으로 연결",
      "글은 도형 안의 짧은 이름표(1~4단어)만, 문단은 쓰지 않기",
      "도형 모양과 연결선을 디자인 지침대로 통일, 격자에 맞춰 정렬",
    ],
    settings: "방향은 '가로'가 도형을 펼치기 좋아요. 세부 정보 수준은 '간결'이나 '표준'이면 돼요.",
  },
  keypoints: {
    hint: "가장 중요한 3~5가지만 큰 숫자나 키워드로 크게 보여 줘요.",
    when: "게시용 요약 한 장, 복습 정리, 가정통신 요약",
    ko: [
      "핵심 메시지 3~5개만 담기",
      "각각 큰 숫자나 키워드 하나와 받쳐 주는 한 줄",
      "배경 설명과 부수 정보는 빼고 여백을 넉넉히",
    ],
    settings: "방향은 '세로', 세부 정보 수준은 '간결'이 잘 어울려요.",
  },
  explain: {
    hint: "구역마다 제목과 짧은 설명 문장이 있는, 읽는 포스터예요.",
    when: "개념을 한 장으로 정리한 학습 포스터, 읽기 자료",
    ko: [
      "구역마다 제목과 2~3문장의 쉬운 설명, 작은 아이콘 곁들이기",
      "읽는 순서를 분명하게, 글자는 읽기 편한 크기 이하로 줄이지 않기",
    ],
    settings: "방향은 '세로', 세부 정보 수준은 '표준'이 잘 어울려요. 글이 길수록 글자가 깨질 수 있어 '상세'는 피하세요.",
  },
  steps: {
    hint: "위에서 아래로(또는 왼쪽에서 오른쪽으로) 번호 순서대로 따라 하게 만들어요.",
    when: "만들기·실험·사용법 안내 포스터",
    ko: [
      "구역을 번호 배지가 붙은 길(경로)처럼 시작부터 끝까지 배치",
      "각 단계는 동사로 끝나는 짧은 제목과 작은 그림 하나",
      "필요한 단계에는 '팁' 또는 '조심' 한 줄",
    ],
    settings: "방향은 '세로'(위에서 아래로 순서대로 읽기 좋아요), 세부 정보 수준은 '간결'이나 '표준'이면 돼요.",
  },
  quiz: {
    hint: "구역 옆에 '퀴즈', '생각해 보기', '해 보기' 말풍선이 붙어요.",
    when: "게시물을 보며 학생이 질문에 답해 보는 활동",
    ko: [
      "핵심 구역 옆에 '퀴즈'·'생각해 보기'·'해 보기' 이름의 작은 상자 붙이기",
      "각 상자에는 짧은 질문 하나, 학생이 읽기 쉬운 말로",
    ],
    settings: "방향은 '세로', 세부 정보 수준은 '표준'이면 돼요.",
  },
  story: {
    hint: "이야기 길처럼 흘러가요: 궁금증 → 문제 → 발견 → 정리.",
    when: "흥미를 끄는 게시물, 저학년, 개념 도입",
    ko: [
      "구역을 이야기 길(시작 → 문제 → 발견 → 해결 → 정리)로 배치",
      "친근한 인물이나 일상 장면을 길 따라 반복해서 등장시키기",
      "말풍선이나 짧은 설명 글, 쉬운 입말로",
    ],
    settings: "방향은 '가로'가 이야기 길을 펼치기 좋아요. 세부 정보 수준은 '간결'이나 '표준'이면 돼요.",
  },
  data: {
    hint: "구역마다 큰 숫자·그래프·비교를 먼저 보여 주고 한 줄로 뜻을 풀어 줘요.",
    when: "통계·조사·실험 결과를 한 장으로 정리할 때",
    ko: [
      "구역마다 큰 숫자, 그래프, 비교 중 하나를 맨 앞에",
      "그 아래에 '그래서 무슨 뜻?' 한 줄 풀이",
      "소스에 없는 숫자는 만들어 내지 않기, 가장 중요한 수치만 강조색으로",
    ],
    settings: "방향은 '가로' 또는 '세로', 세부 정보 수준은 '표준'이 잘 어울려요.",
  },
  easy: {
    hint: "아주 쉬운 낱말, 큰 글씨, 귀여운 그림으로 만들어요.",
    when: "초등 저학년, 특수교육 대상, 낯선 개념을 처음 소개할 때",
    ko: [
      "짧은 문장과 일상에서 쓰는 쉬운 낱말만, 어려운 말은 괄호로 쉽게 풀기",
      "아주 큰 글씨와 둥글고 친근한 아이콘이나 만화풍 그림",
    ],
    settings: "방향은 '세로', 세부 정보 수준은 '간결'이 잘 어울려요.",
  },
};

export type ViewText = { hint: string; when: string; ko: string[]; settingsLabel: string; settings: string };

/** 슬라이드 탭이면 슬라이드 설명, 인포그래픽 탭이면 인포그래픽 설명을 돌려준다 */
export function viewOf(v: Variant, kind: "slides" | "infographic"): ViewText {
  if (kind === "slides") {
    return {
      hint: v.hint,
      when: v.when,
      ko: v.ko,
      settingsLabel: "노트북LM 맞춤설정의 형식",
      settings: `'${v.format}'를 고르면 잘 어울려요.`,
    };
  }
  const i = INFO_VIEW[v.id] ?? INFO_VIEW.basic;
  return { hint: i.hint, when: i.when, ko: i.ko, settingsLabel: "노트북LM 인포그래픽 설정", settings: i.settings };
}

export type Applied = { text: string; start: number; end: number };

/**
 * 완성 프롬프트(user_steering_prompt 끝)에 구성 방식 지침을 번호 하나로 덧붙인다.
 * start/end는 덧붙인 부분의 위치라서 화면에서 강조 표시할 때 쓴다.
 */
export function applyVariant(text: string, v: Variant, kind: "slides" | "infographic"): Applied {
  const rule = kind === "slides" ? v.slide : v.info;
  if (!rule) return { text, start: -1, end: -1 };

  if (kind === "infographic") {
    // 인포그래픽 프롬프트는 자연어 설명서라서, 끝에 '## Content Style' 구역을 덧붙인다
    const head = rule.head.replace(/:$/, "");
    const body = [...rule.bullets, "Keep it a single page and keep the palette above."].map((b) => `- ${b}`).join("\n");
    const block = `\n## ${head}\n${body}`;
    const base = text.replace(/\s+$/, "");
    const start = base.length + 1; // 덧붙인 구역 앞 줄바꿈의 위치 (화면에서 강조할 때 +1부터 보여 준다)
    return { text: `${base}\n${block}\n`, start, end: start + block.length };
  }

  // 슬라이드 프롬프트: 실행 지침(user_steering_prompt) 끝에 번호 하나를 덧붙인다
  const close = text.lastIndexOf('\n  "\n}');
  const from = text.indexOf("user_steering_prompt");
  if (close < 0 || from < 0) return { text, start: -1, end: -1 };
  const nums = [...text.slice(from, close).matchAll(/\n {4}(\d+)\. /g)].map((m) => Number(m[1]));
  const n = (nums.length ? Math.max(...nums) : 0) + 1;
  const guard = "Do not change the slide count or the mandatory cover and ending slides.";
  const block = `\n    ${n}. ${rule.head}` + [...rule.bullets, guard].map((b) => `\n       - ${b}`).join("");
  return { text: text.slice(0, close) + block + text.slice(close), start: close, end: close + block.length };
}
