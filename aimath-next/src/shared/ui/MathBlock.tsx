// 따로 한 줄로 보이는 수식(KaTeX htmlAndMathml).
//  - 휴대폰·준비 화면: 넘치면 먼저 0.85배로 줄여 보고, 그래도 넘칠 때만 가로 스크롤과 '옆으로 밀어서' 힌트를 보여요.
//  - 칠판: 가로 스크롤 대신 차례로 맞춰요.
//      ① 개념 2단(.bd-cols)의 옆 칸에 있으면 수식 칸을 전체 폭으로 내려요(장면 높이를 넘기면 되돌려요)
//      ② 0.7배까지 줄여요
//      ③ 넘치는 줄은 맨 바깥 '=' · '+' 에서 나눠 aligned 로 맞추고, 한글 글만 있는 줄은 캡션으로 빼요
//      ④ 그래도 넘치는 줄에 \text{한글} 이 있으면 그 줄을 글(캡션)로 풀어 써요
//      그래도 넘치면(거의 없어요) 스크롤만 남기고 힌트는 보이지 않아요(is-overflow 로 시험이 잡아요).
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Surface } from "../contracts.ts";
import { Rich, Tex } from "./tex.tsx";
import { useUiSurface } from "./surface.ts";

export interface MathBlockProps {
  tex: string | string[];
  surface?: Surface;
  /** 읽기 도구용 이름표(없으면 '수식') */
  label?: string;
}

/* ───────── 순수 도우미(시험 가능) ───────── */

const HANGUL = /[가-힣ㄱ-ㆎ]/;
const TEXT_ONLY = /^\s*(?:\\[ ,;:!]|\\quad|\\qquad|\s)*\\text\{([^{}]*)\}(?:\\[ ,;:!]|\\quad|\\qquad|\s)*$/;

/** 줄 전체가 \text{한글…} 하나뿐이면 그 글을 돌려줘요 */
export function textOnlyLine(tex: string): string | null {
  const m = TEXT_ONLY.exec(tex);
  return m && HANGUL.test(m[1]) ? m[1].trim() : null;
}

/** \text{…} 를 글로 풀고 나머지 수식 조각은 $…$ 로 감싼 콘텐츠 글자(Rich)로 바꿔요 */
export function texToCaption(tex: string): string {
  const only = textOnlyLine(tex);
  if (only != null) return only;
  const re = /\\text\{([^{}]*)\}/g;
  let out = "";
  let last = 0;
  const pushMath = (s: string) => {
    const m = s
      .replace(/^(?:\s|\\[ ,;:!]|\\quad|\\qquad)+/, "")
      .replace(/(?:\s|\\[ ,;:!]|\\quad|\\qquad)+$/, "");
    if (!m) return;
    if (out && !/[\s([{]$/.test(out)) out += " ";
    out += "$" + m + "$ ";
  };
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(tex))) {
    pushMath(tex.slice(last, mm.index));
    out += mm[1];
    last = mm.index + mm[0].length;
  }
  pushMath(tex.slice(last));
  return out.replace(/\s+/g, " ").trim();
}

interface Seg {
  op: string;
  s: string;
}

/** 맨 바깥(괄호·중괄호·\left…\right 밖) '=' · '+' 에서 나눠요. 나눌 곳이 없거나 이미 여러 줄 환경이면 null */
export function topSegments(tex: string): Seg[] | null {
  const segs: Seg[] = [];
  let depth = 0;
  let cur = "";
  let op = "";
  let i = 0;
  const n = tex.length;
  const skipDelim = () => {
    while (i < n && tex[i] === " ") cur += tex[i++];
    if (tex[i] === "\\") {
      cur += tex[i++];
      if (/[A-Za-z]/.test(tex[i] || "")) while (i < n && /[A-Za-z]/.test(tex[i])) cur += tex[i++];
      else if (i < n) cur += tex[i++];
    } else if (i < n) cur += tex[i++];
  };
  while (i < n) {
    const c = tex[i];
    if (c === "\\") {
      const nx = tex[i + 1] || "";
      if (/[A-Za-z]/.test(nx)) {
        let j = i + 1;
        while (j < n && /[A-Za-z]/.test(tex[j])) j++;
        const name = tex.slice(i + 1, j);
        cur += tex.slice(i, j);
        i = j;
        if (name === "begin" || name === "end") {
          // \begin{…} … \end{…}(행렬 등)는 한 덩어리예요. 이름 중괄호는 아래에서 depth 를 올렸다 내려요
          depth += name === "begin" ? 1 : -1;
          continue;
        }
        if (name === "left") {
          depth++;
          skipDelim();
        } else if (name === "right") {
          depth--;
          skipDelim();
        }
        continue;
      }
      if (nx === "\\" && depth === 0) return null; // 이미 여러 줄인 식은 그대로 둬요
      cur += c + nx;
      i += 2;
      continue;
    }
    if (c === "&" && depth === 0) return null;
    if (c === "{" || c === "(" || c === "[") depth++;
    else if (c === "}" || c === ")" || c === "]") depth--;
    if (depth === 0 && (c === "=" || c === "+") && cur.trim() && !/[\^_{(]\s*$/.test(cur)) {
      segs.push({ op, s: cur.trim() });
      op = c;
      cur = "";
      i++;
      continue;
    }
    cur += c;
    i++;
  }
  if (cur.trim()) segs.push({ op, s: cur.trim() });
  else if (op) return null; // '=' 로 끝나는 식은 그대로 둬요
  return segs.length > 1 ? segs : null;
}

const plainLen = (s: string) => s.replace(/\\[A-Za-z]+/g, "x").replace(/[{}\s]/g, "").length;

/**
 * 한 줄을 맨 바깥 '=' · '+' 에서 나눠 aligned 로 바꿔요. ratio 는 (쓸 수 있는 폭 / 지금 폭)이에요.
 * 첫 '=' 앞(좌변)을 기준으로 줄을 맞추고, 이어지는 '+' 줄은 조금 들여 써요. 나눌 수 없으면 null.
 */
export function splitAligned(tex: string, ratio: number): string | null {
  const segs = topSegments(tex);
  if (!segs) return null;
  const total = plainLen(tex);
  const target = Math.max(6, Math.floor(total * Math.min(1, ratio) * 0.9));
  const e = segs.findIndex((g) => g.op === "=");
  let lhs = "";
  let rest = segs;
  if (e > 0) {
    const left = segs.slice(0, e);
    const l = left.map((g) => g.op + g.s).join("");
    if (plainLen(l) <= target * 0.6) {
      lhs = l;
      rest = segs.slice(e);
    }
  }
  const rows: Seg[][] = [];
  let row: Seg[] = [];
  let len = plainLen(lhs);
  for (const g of rest) {
    const gl = plainLen(g.op + g.s);
    if (row.length && len + gl > target) {
      rows.push(row);
      row = [];
      len = plainLen(lhs);
    }
    row.push(g);
    len += gl;
  }
  if (row.length) rows.push(row);
  if (rows.length < 2 && !(lhs && rows.length === 1 && plainLen(lhs) + plainLen(rest.map((g) => g.op + g.s).join("")) > target)) return null;
  const lines = rows.map((r, ri) => {
    const head = r[0];
    const tail = r
      .slice(1)
      .map((g) => g.op + g.s)
      .join("");
    if (ri === 0 && !lhs) return "&" + head.op + head.s + tail;
    if (ri === 0 && plainLen(lhs + head.op + head.s + tail) > target) return lhs + " \\\\ &" + head.op + head.s + tail; // 좌변만 윗줄에
    if (ri === 0) return lhs + " &" + head.op + head.s + tail;
    if (head.op === "=") return "&=" + head.s + tail;
    return "&\\quad " + head.op + head.s + tail;
  });
  return "\\begin{aligned}" + lines.join(" \\\\ ") + "\\end{aligned}";
}

/* ───────── 부품 ───────── */

interface Fit {
  /** 0 그대로 · 1 전체 폭 · 2 줄임 · 3 나눔 · 4 캡션 · 5 남은 넘침 */
  stage: number;
  scale: number;
  moved: boolean;
  /** 줄마다: 'split'(aligned) · 'cap'(캡션) · ''(그대로) */
  mode: string[];
  /** 나눌 때 쓸 폭 비율(줄마다) */
  ratio: number[];
  over: boolean;
  /** 이 맞춤을 잰 조건(수식 · 표면 · 다시 재기 번호). 다르면 처음부터 다시 맞춰요 */
  k: string;
}

const FRESH: Fit = { stage: 0, scale: 1, moved: false, mode: [], ratio: [], over: false, k: "" };
const BOARD_MIN = 0.7;
const SOFT_MIN = 0.85;
const WIDE_CLS = "ui-wide-math";

const useIsoLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** 줄마다 실제 폭(px, 무대 확대와 상관없는 배치 단위) */
function lineWidths(el: HTMLElement): number[] {
  const out: number[] = [];
  for (let i = 0; i < el.children.length; i++) {
    const c = el.children[i] as HTMLElement;
    if (!c.classList.contains("ui-tex-d")) {
      out.push(c.scrollWidth);
      continue;
    }
    const h = c.querySelector(".katex-html") as HTMLElement | null;
    out.push(h ? h.scrollWidth : c.scrollWidth);
  }
  return out;
}

function sceneOver(el: HTMLElement): boolean {
  const sc = el.closest(".bd-scene") as HTMLElement | null;
  if (!sc) return false;
  const inner = (sc.querySelector(".bd-scene-inner") as HTMLElement | null) || sc;
  return sc.scrollHeight > sc.clientHeight + 2 || inner.scrollHeight > inner.clientHeight + 2;
}

function releaseWide(cols: Element | null) {
  if (!cols) return;
  if (!cols.querySelector(".ui-math-wrap.is-full")) cols.classList.remove(WIDE_CLS);
}

export function MathBlock({ tex, surface, label }: MathBlockProps) {
  const sf = useUiSurface(surface);
  const board = sf === "board";
  const lines = useMemo(() => (Array.isArray(tex) ? tex : [tex]), [tex]);
  const key = lines.join("\n");
  const [tick, setTick] = useState(0);
  const rk = sf + "|" + tick + "|" + key;
  const [state, setFit] = useState<Fit>(FRESH);
  const fit = state.k === rk ? state : FRESH;
  const ref = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const colsRef = useRef<Element | null>(null);
  const noMove = useRef(false);

  // 창 크기 · 글자 단계 · 글꼴이 바뀌면 tick 을 올려 처음부터 다시 맞춰요(수식 · 표면이 바뀌어도 rk 가 달라져요)
  useEffect(() => {
    let raf = 0;
    let lastW = window.innerWidth;
    const again = (force: boolean) => {
      if (!force && window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      if (raf) window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        setTick((t) => t + 1);
      });
    };
    const onResize = () => again(false);
    window.addEventListener("resize", onResize);
    let mo: MutationObserver | null = null;
    try {
      mo = new MutationObserver(() => again(true));
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-fs", "data-surface"] });
    } catch {
      mo = null;
    }
    try {
      const fonts = (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts;
      if (fonts && fonts.ready) fonts.ready.then(() => again(true), () => undefined);
    } catch {
      /* 글꼴 사건이 없어도 괜찮아요 */
    }
    return () => {
      window.removeEventListener("resize", onResize);
      if (mo) mo.disconnect();
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);
  // 사라질 때 옆 칸 넓힘을 거둬요
  useEffect(
    () => () => {
      const cols = colsRef.current;
      colsRef.current = null;
      if (cols) window.setTimeout(() => releaseWide(cols), 0);
    },
    [],
  );

  useIsoLayout(() => {
    const el = ref.current;
    if (!el) return;
    if (state.k !== rk) {
      // 새로 맞추기: 옆 칸 넓힘을 거두고 처음부터
      if (colsRef.current) {
        if (wrapRef.current) wrapRef.current.classList.remove("is-full");
        releaseWide(colsRef.current);
        colsRef.current = null;
      }
      noMove.current = false;
      setFit({ ...FRESH, k: rk });
      return;
    }
    const avail = el.clientWidth;
    if (avail <= 0) return;
    const ws = lineWidths(el);
    const maxW = ws.reduce((a, b) => Math.max(a, b), 0);
    const over = maxW > avail + 1 || el.scrollWidth > el.clientWidth + 2;
    const s = fit.stage;

    // 옆 칸을 내렸더니 장면 높이를 넘으면 되돌려요
    if (board && fit.moved && s === 1 && sceneOver(el)) {
      noMove.current = true;
      if (wrapRef.current) wrapRef.current.classList.remove("is-full");
      releaseWide(colsRef.current);
      colsRef.current = null;
      setFit({ ...fit, moved: false, stage: 1 });
      return;
    }
    if (!over) {
      if (fit.over) setFit({ ...fit, over: false });
      return;
    }
    if (!board) {
      if (s < 2) setFit({ ...fit, stage: 2, scale: SOFT_MIN });
      else if (s < 5) setFit({ ...fit, stage: 5, over: true });
      return;
    }
    if (s === 0) {
      const side = el.closest(".bd-col-side");
      const cols = side ? side.parentElement : null;
      if (cols && cols.classList.contains("bd-cols") && !noMove.current) {
        cols.classList.add(WIDE_CLS);
        colsRef.current = cols;
        setFit({ ...fit, stage: 1, moved: true });
      } else setFit({ ...fit, stage: 1 });
      return;
    }
    if (s === 1) {
      const k = Math.max(BOARD_MIN, Math.min(1, (avail / maxW) * 0.98));
      setFit({ ...fit, stage: 2, scale: k });
      return;
    }
    if (s === 2) {
      const mode: string[] = [];
      const ratio: number[] = [];
      lines.forEach((t, i) => {
        const w = ws[i] || 0;
        if (w <= avail + 1) {
          mode.push("");
          ratio.push(1);
          return;
        }
        ratio.push(avail / w);
        if (textOnlyLine(t) != null) mode.push("cap");
        else if (splitAligned(t, avail / w)) mode.push("split");
        else mode.push("");
      });
      setFit({ ...fit, stage: 3, mode, ratio });
      return;
    }
    if (s === 3) {
      const mode = fit.mode.slice();
      let changed = false;
      lines.forEach((t, i) => {
        if ((ws[i] || 0) > avail + 1 && mode[i] !== "cap" && /\\text\{[^{}]*[가-힣]/.test(t)) {
          mode[i] = "cap";
          changed = true;
        }
      });
      setFit({ ...fit, stage: changed ? 4 : 5, mode, over: !changed });
      return;
    }
    if (s === 4) setFit({ ...fit, stage: 5, over: true });
  });

  const shown = lines.map((t, i) => {
    const m = fit.mode[i] || "";
    if (m === "cap") return { cap: true, v: texToCaption(t) };
    if (m === "split") return { cap: false, v: splitAligned(t, fit.ratio[i] || 1) || t };
    return { cap: false, v: t };
  });

  let cls = "ui-math scroll-x is-" + sf;
  if (fit.scale < 1) cls += " is-shrink";
  if (fit.over) cls += " is-overflow";
  if (fit.stage >= 3 && fit.mode.some((m) => m === "split")) cls += " is-split";
  const style = fit.scale < 1 ? { fontSize: fit.scale.toFixed(3) + "em" } : undefined;
  const hint = fit.over && !board;
  return (
    <div ref={wrapRef} className={"ui-math-wrap" + (fit.moved ? " is-full" : "")}>
      <div ref={ref} className={cls} style={style} role="group" aria-label={label || "수식"} tabIndex={fit.over ? 0 : undefined}>
        {shown.map((x, i) =>
          x.cap ? (
            <p key={i} className="ui-math-cap">
              <Rich text={x.v} />
            </p>
          ) : (
            <Tex key={i} tex={x.v} display />
          ),
        )}
      </div>
      {hint ? (
        <p className="scroll-hint ui-scroll-hint" aria-hidden="true">
          옆으로 밀어서 끝까지 봐요 →
        </p>
      ) : null}
    </div>
  );
}
