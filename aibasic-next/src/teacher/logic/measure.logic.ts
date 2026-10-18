// 칠판 장면의 무게(예산)와 높이(px)를 어림하는 순수 로직(DOM 없음).
// 칠판 무대는 1920×1080 고정이고 장면 본문은 BOARD_BODY_H(896px) 안에 들어가야 해요.
// 실제 그리기(board.css)와 숫자를 맞춰 두었어요: 본문 32px · 줄 높이 1.5 · 본문 폭 1760px.
// 글자를 한 단계 줄이면(fsDown) 28px 로 봐요.
import type { Block, SceneBlock } from "../../shared/contracts.ts";

/** 읽을거리 상자('📖 스토리 보기'처럼 이야기로 풀어 쓴 긴 callout): 칠판에서는 따로 장면을 만들고 기본은 꺼 둬요 */
export function isAside(b: { t: string; title?: string; text?: string }): boolean {
  return b.t === "callout" && !!b.title && b.title.indexOf("📖") === 0;
}

/** 장면 본문 높이(px) */
export const BODY_H = 896;
/** 장면 본문 폭(px). 무대 1920 - 좌우 여백 80*2 */
export const BODY_W = 1760;
/** 칠판 본문 글자 크기(px): 기본, 한 단계 줄임 */
export const BOARD_FS = [32, 28] as const;
export const LINE = 1.5;
/** 블록 사이 간격(px, 기본 글자 기준) */
export const GAP = 24;

/* ─────────── 예산(가중치) ─────────── */

/** 보이는 글자 수: ** 와 백틱 표시는 빼고 줄바꿈도 빼요 */
export function visibleLen(s: string): number {
  if (!s) return 0;
  return s.replace(/\*\*/g, "").replace(/`/g, "").replace(/\n/g, "").length;
}

/** TeX 의 보이는 길이 어림(math 블록이 들어올 때만 써요) */
export function texLen(tex: string): number {
  const t = tex
    .replace(/\\(left|right|displaystyle|quad|qquad|,|;|!|text|mathrm|mathbf|operatorname)\b/g, " ")
    .replace(/\\[a-zA-Z]+/g, "x")
    .replace(/[{}_^\\ ]/g, "");
  return Math.max(1, Math.ceil(t.length * 0.8));
}

/**
 * 블록 한 개의 무게. 장면 하나의 예산은 100이에요.
 *  p = 글자수/6, math = 18/줄, table = 12/행 + 20, example·widget = 100(혼자 한 장면).
 */
export function blockWeight(b: Block): number {
  switch (b.t) {
    case "p":
      return Math.max(4, visibleLen(b.text) / 6);
    case "math":
      return 18 * (Array.isArray(b.tex) ? Math.max(1, b.tex.length) : 1);
    case "term":
      return 10 + visibleLen(b.def) / 6;
    case "callout":
      return 8 + (b.title ? 4 : 0) + visibleLen(b.text) / 6;
    case "table":
      return 12 * b.rows.length + 20;
    case "list": {
      let w = 0;
      for (const it of b.items) w += 4 + visibleLen(it) / 6;
      return Math.max(6, w);
    }
    case "dialog": {
      let w = 0;
      for (const l of b.lines) w += 4 + visibleLen(l.text) / 6;
      return Math.max(6, w);
    }
    case "code":
      return 14 + 7 * codeLines(b.code);
    case "image":
      return 45 + (b.caption ? 5 : 0);
    case "example":
    case "widget":
      return 100;
  }
}

/** 칠판에서 그림 한 장의 최대 높이(px, 글자 32 기준) */
export const IMG_H = 460;
/** 칠판 코드 글자는 본문의 0.875배(32px → 28px) */
export const CODE_FS = 0.875;
/** 코드 한 줄이 칠판에서 차지하는 글자 수(가로 1760 - 안쪽 여백 64, 고정폭 0.6em) */
export function codeCols(fs: number): number {
  return Math.max(20, Math.floor((BODY_W - 64) / (fs * CODE_FS * 0.6)));
}
/** 코드 줄 수(끝 빈 줄은 빼요) */
export function codeLines(code: string): number {
  return Math.max(1, code.replace(/\s+$/, "").split("\n").length);
}
/** 칠판에서 줄바꿈까지 센 코드 줄 수(한글은 폭 2칸) */
export function codeRows(code: string, fs: number): number {
  const cols = codeCols(fs);
  let n = 0;
  for (const line of code.replace(/\s+$/, "").split("\n")) {
    let w = 0;
    for (const ch of line) w += ch.charCodeAt(0) >= 0x1100 ? 2 : 1;
    n += Math.max(1, Math.ceil(w / cols));
  }
  return n;
}

/** 표가 혼자 장면을 써야 하나(6행 초과 또는 5열 이상) */
export function isBigTable(b: Block): boolean {
  if (b.t !== "table") return false;
  const cols = Math.max(b.head.length, ...b.rows.map((r) => r.length));
  return b.rows.length > 6 || cols >= 5;
}

/* ─────────── 높이(px) ─────────── */

/** 한 줄 글자 폭 어림(em): 한글·한자 1, 영문·숫자 0.56, 공백 0.3 */
export function textEm(s: string): number {
  if (!s) return 0;
  let em = 0;
  const part = s.replace(/\*\*/g, "").replace(/`/g, "");
  for (let k = 0; k < part.length; k++) {
    const c = part.charCodeAt(k);
    if (c === 10) continue;
    em += c >= 0x1100 ? 1 : c === 32 ? 0.3 : 0.56;
  }
  return em;
}

/** 폭 width(px), 글자 fs(px)에서 몇 줄인지. \n 은 줄을 새로 열어요 */
export function lineCount(s: string, width: number, fs: number): number {
  if (!s) return 0;
  const perLine = Math.max(4, width / fs);
  let n = 0;
  for (const seg of s.split("\n")) n += Math.max(1, Math.ceil(textEm(seg) / perLine));
  return n;
}

const hasTall = (tex: string) => /\\(frac|dfrac|sum|prod|int|sqrt|begin|binom|lim|overline|vec)/.test(tex);

/** 블록 높이 어림(px). fs = 32 또는 28 */
export function blockHeight(b: SceneBlock, fs: number): number {
  const lh = fs * LINE;
  const k = fs / 32; // 여백도 글자 크기에 맞춰 줄어요
  // 글 속 큰 분수(\dfrac)·시그마·루트는 그 줄을 높여요(줄마다 한 번만 셈)
  const tallInline = (s: string, w: number) => {
    const m = s.match(/\$[^$]*\\(dfrac|sum|sqrt|frac)[^$]*\$/g);
    return m ? Math.min(m.length, lineCount(s, w, fs)) * fs * 0.5 : 0;
  };
  const lines = (s: string, w = BODY_W) => lineCount(s, w, fs) * lh + tallInline(s, w);
  switch (b.t) {
    case "heading":
      return lineCount(b.text, BODY_W, fs * 1.25) * fs * 1.25 * 1.3 + 8 * k;
    case "p":
      return lines(b.text);
    case "lines": {
      let h = 0;
      for (const it of b.items) h += lines(it, BODY_W - 48) + 16 * k;
      return h;
    }
    case "math": {
      const arr = Array.isArray(b.tex) ? b.tex : [b.tex];
      let h = 16 * k;
      for (const t of arr) {
        const w = texLen(t) * 0.6 * fs * 1.1;
        const rows = Math.max(1, Math.ceil(w / BODY_W));
        h += rows * (hasTall(t) ? fs * 3.2 : fs * 2.1);
      }
      return h;
    }
    case "term":
      return 32 * k + lh + lines(b.def, BODY_W - 64);
    case "callout":
      return 40 * k + (b.title ? lh : 0) + lines(b.text, BODY_W - 96);
    case "table": {
      const cols = Math.max(1, b.head.length, ...b.rows.map((r) => r.length));
      const cw = BODY_W / cols - 32 * k;
      const rowH = (cells: string[]) => {
        let m = 1;
        for (const c of cells) {
          const n = lineCount(c, c.indexOf("`") >= 0 ? cw / 2 : cw, fs); // 코드 칸은 글자가 넓고 끊기지 않아요
          const tall = /\$[^$]*\\(frac|sqrt|sum)/.test(c) ? 1.6 : 1;
          m = Math.max(m, n * tall);
        }
        return m * lh + 20 * k;
      };
      let h = rowH(b.head);
      for (const r of b.rows) h += rowH(r);
      if (b.caption) h += lines(b.caption) * 0.85 + 8 * k;
      return h * 1.1; // 긴 칸 글이 많은 표는 어림이 모자라서 10% 더해요(칠판 실측으로 맞춤)
    }
    case "list": {
      let h = 0;
      for (const it of b.items) h += lines(it, BODY_W - 64) + 8 * k;
      return h;
    }
    case "dialog": {
      let h = 0;
      for (const l of b.lines) h += lines(l.text, BODY_W - 240) + 16 * k;
      return h;
    }
    case "example": {
      let h = 48 * k + lineCount(b.title, BODY_W - 64, fs) * lh + lines(b.problem, BODY_W - 64) + 16 * k;
      for (const s of b.steps) h += lines(s, BODY_W - 112) + 8 * k;
      h += 16 * k + lines("답: " + b.answer, BODY_W - 64);
      return h;
    }
    case "code":
      // 이름표 한 줄 + 코드 줄(줄바꿈 포함, 글자 0.8배·줄 높이 1.5) + 상자 안쪽 여백
      return Math.ceil(fs * CODE_FS * 1.2 + 48 * k + codeRows(b.code, fs) * fs * CODE_FS * 1.5);
    case "image":
      // 그림은 칠판에서 최대 높이 IMG_H 안에 맞춰 그려요(board.css 의 .ui-image.is-board) + 설명 줄
      return Math.ceil(IMG_H * k + (b.caption ? lineCount(b.caption, BODY_W, fs * 0.875) * fs * 0.875 * 1.4 + 8 * k : 0));
    case "widget":
      return BODY_H; // 체험 장면은 무대를 통째로 써요
    case "q":
      return 4 * lh; // 문제 본문은 qHeight 로 따로 어림해요
  }
}

/** 블록 여러 개를 한 장면에 쌓은 높이 */
export function stackHeight(blocks: readonly SceneBlock[], fs: number): number {
  let h = 0;
  blocks.forEach((b, i) => {
    h += blockHeight(b, fs) + (i ? GAP * (fs / 32) : 0);
  });
  return Math.ceil(h);
}

/** 문제 한 개의 높이(본문 + 보기). 보기는 2열로 놓되 길면 1열 */
export function qHeight(q: { prompt: string; type: string; choices?: string[] }, fs: number): number {
  const lh = fs * LINE;
  let h = lineCount(q.prompt, BODY_W, fs) * lh + 24;
  if (q.type === "choice" && q.choices) {
    const long = q.choices.some((c) => textEm(c) * fs > BODY_W / 2 - 120);
    if (long) for (const c of q.choices) h += lineCount(c, BODY_W - 120, fs) * lh + 16;
    else {
      for (let i = 0; i < q.choices.length; i += 2) {
        const a = lineCount(q.choices[i], BODY_W / 2 - 120, fs);
        const b = i + 1 < q.choices.length ? lineCount(q.choices[i + 1], BODY_W / 2 - 120, fs) : 0;
        h += Math.max(a, b) * lh + 16;
      }
    }
  } else if (q.type === "ox") h += 96;
  else if (q.type === "number") h += 88;
  return Math.ceil(h);
}

/* ─────────── 실제 그리기에 맞춘 장면별 높이(정리·이야기 줄, 예제) ───────────
 * board/board.css · styles/board.css 와 숫자를 맞췄어요(전자칠판 1920×1080, 실제 촬영으로 확인):
 *   장면 폭 1680 - 안쪽 여백 좌우 8 = 글 폭 1664, 안쪽 여백 위 20 + 아래 24, 줄 높이 1.55.
 *   제목(bd-h) 1.75em × 1.25 + 아래 28. 정리 줄: 위아래 14 + 번호 원 1.6em + 20, 좌우 24, 줄 사이 16.
 *   예제 상자: 위아래 28, 좌우 32, 머리줄 아래 16, 문제 아래 16, 단계 번호 1.5em × .85 + 16, 단계 사이 12, 답 위 20 + 16 + 2.
 * 글자 폭 어림이 조금 모자랄 수 있어 한 줄 글자 수를 FILL 만큼만 써요. */
export const SCENE_TEXT_W = 1664;
export const SCENE_PAD = 44;
export const SCENE_LINE = 1.55;
const FILL = 0.96;

function rows(s: string, width: number, fs: number): number {
  return lineCount(s, width * FILL, fs);
}

/** 장면 안 제목 줄(bd-h) 높이 */
export function sceneTitleHeight(title: string | undefined, fs: number): number {
  if (!title) return 0;
  const tfs = fs * 1.75;
  return rows(title, SCENE_TEXT_W - 34, tfs) * tfs * 1.25 + 28;
}

/** 이야기·AI 이야기·정리 장면 높이(안쪽 여백 포함). summary 면 줄마다 상자·번호가 붙어요 */
export function linesSceneHeight(items: readonly string[], fs: number, opts: { title?: string; summary?: boolean }): number {
  const lh = fs * SCENE_LINE;
  let h = SCENE_PAD + sceneTitleHeight(opts.title, fs);
  items.forEach((it, i) => {
    if (i) h += 16;
    if (opts.summary) h += 28 + rows(it, SCENE_TEXT_W - 48 - (1.6 * fs + 20), fs) * lh;
    else h += rows(it, SCENE_TEXT_W, fs) * lh;
  });
  return Math.ceil(h);
}

/** 예제 장면 높이(안쪽 여백 포함). part 가 있으면 머리줄에 '이어서' 이름표가 붙어요 */
export function exampleSceneHeight(ex: { title: string; problem: string; steps: readonly string[]; answer: string }, fs: number, part = false): number {
  const lh = fs * SCENE_LINE;
  const inner = SCENE_TEXT_W - 64;
  const head = inner - (0.7 * fs * 2 + 32) - 16 - (part ? 7 * 0.875 * fs + 16 : 0);
  let h = SCENE_PAD + 56 + rows(ex.title, head, fs) * lh + 16;
  if (ex.problem) h += rows(ex.problem, inner, fs) * lh + 16;
  const stepW = inner - (1.5 * 0.85 * fs + 16);
  ex.steps.forEach((s, i) => {
    if (i) h += 12;
    h += rows(s, stepW, fs) * lh;
  });
  if (ex.answer) h += 20 + 16 + 2 + rows("답 " + ex.answer, inner - 0.7 * fs * 2, fs) * lh;
  return Math.ceil(h);
}
