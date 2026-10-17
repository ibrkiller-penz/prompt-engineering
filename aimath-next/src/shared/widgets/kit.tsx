// 체험 도구가 함께 쓰는 작은 화면 조각: 표면 문맥, 수식(KaTeX), 글+수식, 고르기 단추, 켜기/끄기, 결과 칸, 표.
import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import katex from "katex";
// 도구만 따로 띄우는 화면(칠판 도구 크게 보기)에서도 KaTeX 모양·글꼴이 꼭 들어가게 해요(번들러가 한 번만 넣어요)
import "katex/dist/katex.min.css";
import type { Surface } from "../contracts.ts";
import { parseInline, type InlineToken } from "../logic/inlineMath.ts";

/** 지금 도구가 놓인 표면(휴대폰·준비 화면·칠판). WidgetHost 가 정해 줘요 */
export const SurfaceContext = createContext<Surface>("phone");
export const useSurface = () => useContext(SurfaceContext);
export const useIsBoard = () => useContext(SurfaceContext) === "board";

/** '결과 가리기'가 켜져 있는지. WidgetHost 가 정해 줘요(칠판에서는 처음에 켜져 있어요) */
export const HideContext = createContext<boolean>(false);
export const useHidden = () => useContext(HideContext);

const MASK = "가려 두었어요";

/** 결과 부분. 결과 가리기가 켜져 있으면 자리만 남기고 가려요 */
export function Hide({ children, label }: { children: ReactNode; label?: string }) {
  const hidden = useHidden();
  if (!hidden) return <>{children}</>;
  return (
    <div className="wg-mask" role="note">
      <span aria-hidden="true">?</span> {label ? label + ": " : ""}
      {MASK}
    </div>
  );
}

/** 큰 결과 숫자 하나(칠판에서는 120px). 결과 가리기가 켜져 있으면 ? 로 가려요 */
export function Big(props: { label: string; children: ReactNode; tone?: "ok" | "bad" | "warn" | "plain"; sub?: ReactNode }) {
  const hidden = useHidden();
  const tone = props.tone || "plain";
  return (
    <div className={"wg-bignum wg-tone-" + (hidden ? "plain" : tone)}>
      <span className="wg-bignum-label">{props.label}</span>
      {hidden ? (
        <span className="wg-bignum-value is-masked" aria-label={props.label + " " + MASK}>
          ?
        </span>
      ) : (
        <span className="wg-bignum-value">{props.children}</span>
      )}
      {props.sub && !hidden ? <span className="wg-bignum-sub">{props.sub}</span> : null}
    </div>
  );
}

const cache = new Map<string, string>();
function texHtml(tex: string, display: boolean): string {
  const key = (display ? "D:" : "I:") + tex;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let html: string;
  try {
    html = katex.renderToString(tex, { displayMode: display, output: "htmlAndMathml", throwOnError: false, strict: "ignore" });
  } catch (e) {
    html = tex.replace(/[&<>]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"));
  }
  if (cache.size > 400) cache.clear();
  cache.set(key, html);
  return html;
}

/** 수식 하나. block 이면 가운데 줄로, 넘치면 가로 스크롤.
 *  칠판에서는 가로 스크롤 대신 큰 꼴(\\displaystyle)의 줄 안 수식으로 그려 맨 바깥 =·+ 뒤에서 줄을 바꿔요 */
export function Tex({ tex, block }: { tex: string; block?: boolean }) {
  const surface = useContext(SurfaceContext);
  const wrap = !!block && surface === "board";
  const html = useMemo(() => (wrap ? texHtml("\\displaystyle " + tex, false) : texHtml(tex, !!block)), [tex, block, wrap]);
  if (wrap)
    return (
      <div className="wg-tex-block is-wrap">
        <span className="wg-tex" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    );
  if (block) return <div className="wg-tex-block" tabIndex={0} dangerouslySetInnerHTML={{ __html: html }} />;
  return <span className="wg-tex" dangerouslySetInnerHTML={{ __html: html }} />;
}

function renderTokens(ts: InlineToken[], key: string): ReactNode[] {
  return ts.map((t, i) => {
    const k = key + i;
    if (t.t === "text") return <span key={k}>{t.v}</span>;
    if (t.t === "math") return <Tex key={k} tex={t.v} />;
    if (t.t === "br") return <br key={k} />;
    return <strong key={k}>{renderTokens(t.c, k + "-")}</strong>;
  });
}

/** 콘텐츠 글자(**굵게**, $수식$, 줄바꿈) */
export function Rich({ text }: { text: string }) {
  const nodes = useMemo(() => renderTokens(parseInline(text), "r"), [text]);
  return <>{nodes}</>;
}

export interface SegOption<T extends string | number> {
  value: T;
  label: string;
}

/** 여러 개 중 하나 고르기(라디오처럼) */
export function Seg<T extends string | number>(props: { label: string; value: T; options: SegOption<T>[]; onChange: (v: T) => void }) {
  return (
    <div className="wg-seg" role="radiogroup" aria-label={props.label}>
      <span className="wg-seg-label">{props.label}</span>
      <span className="wg-seg-row">
        {props.options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={o.value === props.value}
            className={"wg-btn wg-seg-btn" + (o.value === props.value ? " is-on" : "")}
            onClick={() => props.onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </span>
    </div>
  );
}

/** 켜기/끄기 단추 */
export function Toggle(props: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" className={"wg-btn wg-toggle" + (props.on ? " is-on" : "")} aria-pressed={props.on} onClick={() => props.onChange(!props.on)}>
      <span className="wg-toggle-mark" aria-hidden="true">
        {props.on ? "✓" : ""}
      </span>
      {props.label}
    </button>
  );
}

/** 평범한 단추 */
export function Btn(props: { children: ReactNode; onClick: () => void; primary?: boolean; disabled?: boolean; label?: string }) {
  return (
    <button type="button" className={"wg-btn" + (props.primary ? " wg-btn-primary" : "")} disabled={props.disabled} aria-label={props.label} onClick={props.onClick}>
      {props.children}
    </button>
  );
}

/** 단추·스테퍼를 한 줄에(줄바꿈 허용). flex gap 대신 margin 으로 간격 */
export function Row({ children }: { children: ReactNode }) {
  return <div className="wg-row">{children}</div>;
}

/** 결과 한 칸: 이름과 값. keep 이면 결과 가리기가 켜져도 보여요(진행 횟수처럼 정답이 아닌 값) */
export function Readout(props: { label: string; children: ReactNode; tone?: "ok" | "bad" | "warn" | "plain"; keep?: boolean }) {
  const hidden = useHidden() && !props.keep;
  const tone = hidden ? "plain" : props.tone || "plain";
  return (
    <div className={"wg-readout wg-tone-" + tone}>
      <span className="wg-readout-label">{props.label}</span>
      {hidden ? <span className="wg-readout-value is-masked">? {MASK}</span> : <span className="wg-readout-value">{props.children}</span>}
    </div>
  );
}

/** 정오 표시: 색 + ✓/✗ + 글자 */
export function Verdict({ ok, children, keep }: { ok: boolean | null; children: ReactNode; keep?: boolean }) {
  const hidden = useHidden() && !keep;
  if (hidden && ok !== null)
    return (
      <p className="wg-verdict wg-mask" role="status">
        ? 판정을 {MASK}
      </p>
    );
  const cls = ok === null ? "wg-verdict" : ok ? "wg-verdict is-ok" : "wg-verdict is-bad";
  return (
    <p className={cls} role="status">
      {ok === null ? null : <span aria-hidden="true">{ok ? "✓ " : "✗ "}</span>}
      {children}
    </p>
  );
}

/** 간단한 표. 넘치면 가로 스크롤 */
export function Table(props: { caption?: string; head: ReactNode[]; rows: ReactNode[][]; hl?: (r: number) => boolean }) {
  return (
    <div className="wg-table-wrap" tabIndex={0}>
      <table className="wg-table">
        {props.caption ? <caption>{props.caption}</caption> : null}
        <thead>
          <tr>
            {props.head.map((h, i) => (
              <th key={i} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((r, i) => (
            <tr key={i} className={props.hl && props.hl(i) ? "is-hl" : undefined}>
              {r.map((c, j) =>
                j === 0 ? (
                  <th key={j} scope="row">
                    {c}
                  </th>
                ) : (
                  <td key={j}>{c}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 짧은 설명 글 */
export function Note({ children }: { children: ReactNode }) {
  return <p className="wg-note">{children}</p>;
}

/** 칠판에서 왼쪽(그림)·오른쪽(조작) 두 칸(c 를 주면 세 칸). 휴대폰·준비 화면에서는 위아래로 쌓여요.
 *  쓰는 쪽 몸통은 className="wg-body wg-body-split" 로 두어 칠판의 두 단 흘리기를 꺼요 */
export function Split(props: { a: ReactNode; b: ReactNode; c?: ReactNode; wideA?: boolean }) {
  return (
    <div className={"wg-split" + (props.c ? " is-three" : "") + (props.wideA ? " is-wide-a" : "")}>
      <div className="wg-split-a">{props.a}</div>
      <div className="wg-split-b">{props.b}</div>
      {props.c ? <div className="wg-split-b wg-split-c">{props.c}</div> : null}
    </div>
  );
}
