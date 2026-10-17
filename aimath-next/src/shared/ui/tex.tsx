// 수식(KaTeX)과 콘텐츠 글자(**굵게**, $수식$, 줄바꿈) 그리기.
// - KaTeX 는 htmlAndMathml 로 그려요(화면은 HTML, 읽기 도구는 MathML).
// - KaTeX 글꼴은 katex.min.css 를 통해 번들에 들어가요(CDN 을 쓰지 않아요).
import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import "./ui.css";
import { parseInline, type InlineToken } from "../logic/inlineMath.ts";
import { wrapTextChars } from "../logic/texText.ts";

const cache = new Map<string, string>();

const escHtml = (s: string) => s.replace(/[&<>"]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;"));

/** TeX → HTML 문자열(캐시). 잘못된 식이어도 오류를 내지 않고 원문을 보여요 */
export function texToHtml(tex: string, display = false): string {
  const key = (display ? "D:" : "I:") + tex;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let html: string;
  try {
    html = katex.renderToString(wrapTextChars(tex), { displayMode: display, output: "htmlAndMathml", throwOnError: false, strict: "ignore", trust: false });
  } catch {
    html = '<span class="ui-tex-raw">' + escHtml(tex) + "</span>";
  }
  if (cache.size > 800) cache.clear();
  cache.set(key, html);
  return html;
}

/* ── 줄보다 넓은 줄 안 수식 살피기 ──
 * 줄 안 수식은 맨 바깥 = · + 뒤에서 줄을 바꿔요(ui.css). 그래도 한 덩어리(긴 분수 등)가 글 상자보다 넓으면
 * 그 수식에만 is-wide 를 붙여 옆으로 밀어 보게 해요. 창 크기 · 글자 크기(data-fs) · 표면이 바뀌면 다시 재요. */
const wideChecks = new Set<() => void>();
let wideHooked = false;
let wideLater = 0;
/** 수식이 많이 한꺼번에 붙으면(긴 쪽 · 글꼴이 늦게 옴) 자리가 잡힌 뒤 한 번 더 재요 */
function recheckSoon() {
  if (typeof window === "undefined") return;
  if (wideLater) window.clearTimeout(wideLater);
  wideLater = window.setTimeout(() => {
    wideLater = 0;
    wideChecks.forEach((f) => f());
  }, 120);
}
function hookWide() {
  if (wideHooked || typeof window === "undefined") return;
  wideHooked = true;
  let raf = 0;
  const all = () => {
    if (raf) return;
    raf = window.requestAnimationFrame(() => {
      raf = 0;
      wideChecks.forEach((f) => f());
    });
  };
  window.addEventListener("resize", all);
  // KaTeX 글꼴이 늦게 들어오면 폭이 바뀌어요
  try {
    const fonts = (document as unknown as { fonts?: { ready?: Promise<unknown>; addEventListener?: (n: string, f: () => void) => void } }).fonts;
    if (fonts) {
      if (fonts.addEventListener) fonts.addEventListener("loadingdone", all);
      if (fonts.ready) fonts.ready.then(all, () => undefined);
    }
  } catch {
    /* 글꼴 사건이 없어도 괜찮아요 */
  }
  try {
    new MutationObserver(all).observe(document.documentElement, { attributes: true, attributeFilter: ["data-fs", "data-surface"] });
  } catch {
    /* 없으면 창 크기 변화만 봐요 */
  }
}
const useIsoLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;

function blockBox(el: HTMLElement): HTMLElement | null {
  let p = el.parentElement;
  while (p) {
    const d = window.getComputedStyle(p).display;
    if (d !== "inline" && d !== "contents") return p;
    p = p.parentElement;
  }
  return null;
}

/** 글 속(textstyle) 맨 바깥 분수에 ui-tfrac 을 붙여요. 분자·분모가 0.7배 글자(.katex-sizing.size3)인 분수만이고,
 *  \dfrac 이나 첨자 속 분수는 빼요. ui.css 가 휴대폰에서 이 분수만 키워요(분자·분모 13px 이상). */
function tagTextFracs(el: HTMLElement) {
  const fr = el.querySelectorAll<HTMLElement>(".katex-html > .katex-base > .mord > .mfrac, .katex-html > .katex-base > .minner > .mord > .mfrac, .katex-html > .base > .mord > .mfrac, .katex-html > .base > .minner > .mord > .mfrac");
  for (let i = 0; i < fr.length; i++) {
    const f = fr[i];
    if (f.querySelector(".vlist > span > .katex-sizing.size3, .vlist > span > .sizing.size3")) f.classList.add("ui-tfrac");
  }
}

function useWideInline(key: string) {
  const ref = useRef<HTMLSpanElement | null>(null);
  useIsoLayout(() => {
    const el = ref.current;
    if (!el) return;
    hookWide();
    tagTextFracs(el);
    const check = () => {
      el.classList.remove("is-wide");
      const box = blockBox(el);
      if (!box) return;
      const k = el.firstElementChild as HTMLElement | null;
      if (!k) return;
      const cs = window.getComputedStyle(box);
      const inner = box.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
      // 덩어리(.base) 하나라도 글 상자보다 넓으면
      const bases = k.querySelectorAll<HTMLElement>(".katex-html > .katex-base, .katex-html > .base");
      let widest = 0;
      if (el.classList.contains("is-short")) widest = k.getBoundingClientRect().width; // 짧은 식은 통째로 한 덩어리
      else for (let i = 0; i < bases.length; i++) widest = Math.max(widest, bases[i].getBoundingClientRect().width);
      if (inner > 0 && widest > inner + 1) el.classList.add("is-wide");
    };
    check();
    wideChecks.add(check);
    recheckSoon();
    return () => {
      wideChecks.delete(check);
    };
  }, [key]);
  return ref;
}

/** 줄 안 수식 하나(display 면 한 줄 수식) */
export function Tex({ tex, display }: { tex: string; display?: boolean }) {
  const html = useMemo(() => texToHtml(tex, !!display), [tex, display]);
  if (display) return <div className="ui-tex-d" dangerouslySetInnerHTML={{ __html: html }} />;
  return <InlineTex html={html} short={tex.length <= SHORT_TEX} />;
}

/** 이보다 짧은 줄 안 수식은 가운데서 줄을 바꾸지 않아요(예: $I \le 10$) */
const SHORT_TEX = 16;

function InlineTex({ html, short }: { html: string; short: boolean }) {
  const ref = useWideInline(html);
  return <span ref={ref} className={short ? "ui-tex is-short" : "ui-tex"} dangerouslySetInnerHTML={{ __html: html }} />;
}

function render(ts: InlineToken[], key: string): ReactNode[] {
  return ts.map((t, i) => {
    const k = key + i;
    if (t.t === "text") return t.v;
    if (t.t === "math") return <Tex key={k} tex={t.v} />;
    if (t.t === "br") return <br key={k} />;
    return <strong key={k}>{render(t.c, k + ".")}</strong>;
  });
}

export interface RichProps {
  text: string | null | undefined;
  /** 글자 뒤에 붙일 칩(예: "가상의 예") */
  chips?: string[];
}

/** 콘텐츠 글자(**굵게**, $수식$, 줄바꿈 \n). 그 밖의 HTML 은 해석하지 않아요 */
export function Rich({ text, chips }: RichProps) {
  const nodes = useMemo(() => render(parseInline(text == null ? "" : String(text)), "r"), [text]);
  return (
    <>
      {nodes}
      {chips && chips.length
        ? chips.map((c) => (
            <span key={c} className="chip is-fiction ui-chip">
              {c}
            </span>
          ))
        : null}
    </>
  );
}
