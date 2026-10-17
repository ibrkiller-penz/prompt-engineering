// 장면 종류별 칠판 화면과, 넘침을 다루는 본문 틀(SceneBody).
//  넘침: 렌더 뒤 실제 높이가 896px 를 넘으면 ① 글자를 한 단계 줄이고(28px) ② 그래도 넘치면 한 단으로 바꾼 뒤
//  "이어서" 쪽으로 나눠요. 쪽은 '다음'이 공개를 다 쓴 뒤에 넘겨요.
//  공개 전 블록은 자리만 차지하고(visibility: hidden) 보이지 않아서, 공개해도 배치가 흔들리지 않아요.
import { useLayoutEffect, useEffect, useRef, useState, type ReactNode } from "react";
import type { Block, Lesson, Scene, SceneBlock } from "../../shared/contracts.ts";
import { BlockView, Rich } from "../../shared/ui/index.ts";
import { revealStepOf } from "../logic/index.ts";
import { pageOfBlock, pageStarts } from "./board.logic.ts";
import { BODY_H } from "./Stage.tsx";

export const KIND_LABEL: Record<Scene["kind"], string> = {
  question: "핵심 질문",
  story: "이야기",
  prereq: "먼저 알고 가요",
  concept: "개념",
  example: "예제",
  widget: "체험",
  problem: "문제",
  aiStory: "AI 이야기",
  summary: "정리",
  qr: "수업 끝",
};

export interface Layout {
  /** 쪽 수 */
  pages: number;
  /** 지금 보이는 쪽 */
  display: number;
  /** 공개 r 일 때 보여야 하는 쪽(인덱스 r) */
  pfr: number[];
  /** 글자 줄임·한 단 단계 */
  level: number;
}

/* ─────────── 본문 틀(넘침 처리) ─────────── */

export interface SceneBodyProps {
  scene: Scene;
  r: number;
  /** 원하는 쪽(-1 = 마지막) */
  page: number;
  /** 쪽 나누기를 하는 장면인지(문제·체험·끝은 스스로 배치) */
  pageable: boolean;
  onLayout: (l: Layout) => void;
  children: (level: number) => ReactNode;
}

/** 쓰는 쪽은 key={장면 id + 글자 단계} 로 장면·글자 크기가 바뀔 때 새로 만들어요(처음 단계부터 다시 재요) */
export function SceneBody(props: SceneBodyProps) {
  const { scene, r, page, pageable, onLayout } = props;
  const start = scene.fsDown ? 1 : 0;
  const [level, setLevel] = useState(start);
  const [starts, setStarts] = useState<number[]>([0]);
  const [pfr, setPfr] = useState<number[]>([0]);
  const inner = useRef<HTMLDivElement>(null);
  const maxLevel = pageable ? 2 : 1;

  const measure = () => {
    const el = inner.current;
    if (!el) return;
    const H = el.scrollHeight;
    if (H > BODY_H + 2 && level < maxLevel) {
      setLevel(level + 1);
      return;
    }
    if (!pageable || level < 2 || H <= BODY_H + 2) {
      if (starts.length !== 1 || starts[0] !== 0) setStarts([0]);
      if (pfr.length !== 1 || pfr[0] !== 0) setPfr([0]);
      return;
    }
    const base = el.getBoundingClientRect();
    const k = el.offsetHeight ? base.height / el.offsetHeight : 1; // 무대 scale
    const blocks: { top: number; height: number; rv: number }[] = [];
    const nodes = el.querySelectorAll<HTMLElement>("[data-rv]");
    for (let i = 0; i < nodes.length; i++) {
      const b = nodes[i].getBoundingClientRect();
      blocks.push({ top: (b.top - base.top) / k, height: b.height / k, rv: parseInt(nodes[i].getAttribute("data-rv") || "0", 10) || 0 });
    }
    blocks.sort((a, b) => a.top - b.top);
    const st = pageStarts(blocks, BODY_H);
    // 공개 r 일 때 보여야 할 쪽: 그 단계에서 새로 보이는 블록 가운데 가장 아래 것이 들어가는 쪽
    let maxRv = 0;
    for (const b of blocks) if (b.rv > maxRv) maxRv = b.rv;
    const arr: number[] = [];
    for (let rr = 0; rr <= maxRv; rr++) {
      let pg = rr === 0 ? 0 : arr[rr - 1];
      for (const b of blocks) if (b.rv === rr) pg = Math.max(pg, pageOfBlock(st, b, BODY_H));
      arr.push(pg);
    }
    if (st.join(",") !== starts.join(",")) setStarts(st);
    if (arr.join(",") !== pfr.join(",")) setPfr(arr);
  };

  useLayoutEffect(measure);

  // 글꼴·그림이 늦게 그려져도 다시 재요
  useEffect(() => {
    const el = inner.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => measure());
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  });

  const last = starts.length - 1;
  let display = page < 0 ? last : Math.min(page, last);
  const need = pfr[Math.min(r, pfr.length - 1)] || 0;
  if (need > display) display = need;

  const report = useRef("");
  useEffect(() => {
    const sig = starts.length + "|" + display + "|" + pfr.join(",") + "|" + level;
    if (sig === report.current) return;
    report.current = sig;
    onLayout({ pages: starts.length, display, pfr, level });
  });

  const offset = starts[display] || 0;
  const cls = "bd-scene kind-" + scene.kind + (level >= 1 ? " is-down" : "") + (level >= 2 ? " is-single" : "") + (starts.length > 1 ? " is-paged" : "");
  return (
    <div className={cls}>
      <div ref={inner} className="bd-scene-inner" style={offset ? { transform: "translateY(" + -offset + "px)" } : undefined}>
        {props.children(level)}
      </div>
      {starts.length > 1 ? (
        <p className="bd-pageno num" aria-live="polite">
          {display < last ? "이어서 ▾ " : ""}
          {display + 1} / {starts.length}쪽
        </p>
      ) : null}
    </div>
  );
}

/* ─────────── 공개 조각 ─────────── */

function Rv({ step, r, children, className }: { step: number; r: number; children: ReactNode; className?: string }) {
  const hidden = step > r;
  return (
    <div className={"bd-rv" + (className ? " " + className : "") + (hidden ? " is-hidden" : " is-shown")} data-rv={step} aria-hidden={hidden || undefined}>
      {children}
    </div>
  );
}

/* ─────────── 종류별 ─────────── */

export function QuestionScene({ scene }: { scene: Scene }) {
  const items = linesOf(scene);
  return (
    <div className="bd-question">
      <p className="bd-eyebrow">오늘의 핵심 질문</p>
      {items.map((t, i) => (
        <Rv key={i} step={0} r={0} className="bd-question-text">
          <Rich text={t} />
        </Rv>
      ))}
      <p className="bd-question-tip">잠깐 생각해 보고, 짝과 한마디씩 나눠 봐요.</p>
    </div>
  );
}

function linesOf(scene: Scene): string[] {
  const out: string[] = [];
  for (const b of scene.blocks) if (b.t === "lines") for (const it of b.items) out.push(it);
  return out;
}

/** 이야기·AI 이야기·정리: 한 줄씩 */
export function LinesScene({ scene, r }: { scene: Scene; r: number }) {
  const items = linesOf(scene);
  const stepwise = scene.reveal > 0;
  const summary = scene.kind === "summary";
  return (
    <div className={"bd-lines" + (summary ? " is-summary" : "")}>
      {scene.title ? (
        <h2 className="bd-h">
          <Rich text={scene.title} />
          {scene.part ? <span className="chip bd-part">이어서 {scene.part.i}/{scene.part.n}</span> : null}
        </h2>
      ) : null}
      <ol className="bd-lines-list">
        {items.map((t, i) => (
          <li key={i}>
            <Rv step={stepwise ? i : 0} r={r} className="bd-line">
              {summary ? (
                <span className="bd-line-no num" aria-hidden="true">
                  {i + 1}
                </span>
              ) : null}
              <span className="bd-line-txt">
                <Rich text={t} />
              </span>
            </Rv>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** 먼저 알고 가요: 용어 카드 뒤집기('다음' 한 번에 한 장, 카드를 눌러도 뒤집혀요) */
export function PrereqScene({ scene, r }: { scene: Scene; r: number }) {
  const [manual, setManual] = useState<Record<number, boolean>>({});
  useEffect(() => setManual({}), [scene.id]);
  let k = -1;
  return (
    <div className="bd-prereq">
      <h2 className="bd-h">
        <Rich text={scene.title || "먼저 알고 가요"} />
        {scene.part ? <span className="chip bd-part">이어서 {scene.part.i}/{scene.part.n}</span> : null}
      </h2>
      {scene.blocks.map((b, i) => {
        if (b.t === "p")
          return (
            <Rv key={i} step={0} r={r} className="bd-prereq-intro">
              <Rich text={b.text} />
            </Rv>
          );
        return null;
      })}
      <div className="bd-flips">
        {scene.blocks.map((b, i) => {
          if (b.t !== "term") return null;
          k++;
          const idx = k;
          const flipped = idx < r || !!manual[idx];
          return (
            <div key={i} className="bd-rv is-shown bd-flip-cell" data-rv={idx + 1}>
              <button
                type="button"
                className={"bd-flip" + (flipped ? " is-flipped" : "")}
                aria-pressed={flipped}
                onClick={() => setManual((m) => ({ ...m, [idx]: !flipped }))}
              >
                <span className="bd-flip-term">
                  <Rich text={b.term} />
                </span>
                {flipped ? (
                  <span className="bd-flip-def">
                    <Rich text={b.def} />
                  </span>
                ) : (
                  <span className="bd-flip-ask">무슨 뜻일까요? 눌러서 확인해요</span>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const isVisual = (b: SceneBlock) => b.t === "math" || b.t === "table";

/** 개념: 블록 하나씩 공개. 글과 식·표가 함께 있으면 2단(오른쪽 760px) */
export function ConceptScene({ scene, r, level, lid }: { scene: Scene; r: number; level: number; lid: string }) {
  const head = scene.blocks.filter((b) => b.t === "heading")[0] as { t: "heading"; text: string } | undefined;
  const items = scene.blocks.map((b, k) => ({ b, k, step: revealStepOf(scene, k) })).filter((x) => x.b.t !== "heading");
  const vis = items.filter((x) => isVisual(x.b));
  const txt = items.filter((x) => !isVisual(x.b));
  const two = level < 2 && vis.length > 0 && txt.length > 0;
  const one = (x: { b: SceneBlock; k: number; step: number }) => (
    <Rv key={x.k} step={x.step} r={r} className={"bd-blk t-" + x.b.t}>
      <BlockView block={x.b as Block} surface="board" where={lid} />
    </Rv>
  );
  return (
    <div className={"bd-concept" + (two ? " is-two" : "")}>
      {head ? (
        <h2 className="bd-h">
          <Rich text={head.text} />
          {scene.part ? <span className="chip bd-part">이어서 {scene.part.i}/{scene.part.n}</span> : null}
        </h2>
      ) : scene.part && scene.part.i > 1 ? (
        <p className="bd-cont">
          <span className="chip bd-part">이어서 {scene.part.i}/{scene.part.n}</span> <Rich text={scene.title || ""} />
        </p>
      ) : null}
      {two ? (
        <div className="bd-cols">
          <div className="bd-col-main">{txt.map(one)}</div>
          <div className="bd-col-side">{vis.map(one)}</div>
        </div>
      ) : (
        <div className="bd-col-main">{items.map(one)}</div>
      )}
    </div>
  );
}

/** 예제: 문제 → 풀이 단계 하나씩 → 답 */
export function ExampleScene({ scene, r }: { scene: Scene; r: number }) {
  const ex = scene.blocks.filter((b) => b.t === "example")[0] as Extract<Block, { t: "example" }> | undefined;
  if (!ex) return null;
  const n = ex.steps.length;
  return (
    <section className="bd-example" aria-label="예제">
      <header className="bd-example-head">
        <span className="bd-example-tag">예제</span>
        <span className="bd-example-title">
          <Rich text={ex.title} />
        </span>
        {scene.part ? <span className="chip bd-part">이어서 {scene.part.i}/{scene.part.n}</span> : null}
      </header>
      {ex.problem ? (
        <Rv step={0} r={r} className="bd-example-problem">
          <Rich text={ex.problem} />
        </Rv>
      ) : null}
      <ol className="bd-example-steps">
        {ex.steps.map((s, i) => (
          <li key={i}>
            <Rv step={i + 1} r={r} className="bd-ex-step">
              <span className="bd-ex-n num" aria-hidden="true">
                {i + 1}
              </span>
              <span className="bd-ex-txt">
                <Rich text={s} />
              </span>
            </Rv>
          </li>
        ))}
      </ol>
      {ex.answer ? (
        <Rv step={n + 1} r={r} className="bd-example-answer">
          <span className="bd-example-ans-tag">답</span> <Rich text={ex.answer} />
        </Rv>
      ) : null}
    </section>
  );
}

/** 레슨 안 문제 찾기 */
export function findQ(lesson: Lesson | undefined, qid: string) {
  return lesson ? lesson.practice.filter((q) => q.id === qid)[0] : undefined;
}
