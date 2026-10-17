// 문제 카드 하나: 고르기(choice) · OX · 숫자(number) · 서술형(open, 모범 답안과 루브릭으로 스스로 채점).
// 기록은 하지 않아요. 일어난 일을 onResult 로만 알려 주고, 저장은 쓰는 쪽(학생 store)이 해요.
//   attempt  답을 내고 채점했어요(correct, 풀이를 먼저 봤는지 afterSolution)
//   hint     힌트 n 단계를 열었어요
//   solution 풀이를 열었어요
//   self     서술형을 스스로 채점했어요
import { useState, type ReactNode } from "react";
import type { Question, Surface } from "../contracts.ts";
import { checkAnswer } from "../logic/answer.ts";
import { Rich } from "./tex.tsx";
import { Feedback, type FeedbackKind } from "./Feedback.tsx";
import { HintLadder } from "./HintLadder.tsx";
import { NumberPad } from "./NumberPad.tsx";
import { evalNumeric, hasSymbol } from "./numexpr.ts";
import { useUiSurface } from "./surface.ts";
import { SpeakButton } from "./SpeakButton.tsx";

export type QEvent =
  | { type: "attempt"; qid: string; correct: boolean; afterSolution: boolean; input: string }
  | { type: "hint"; qid: string; level: 1 | 2 }
  | { type: "solution"; qid: string }
  | { type: "self"; qid: string; ok: boolean; afterSolution: boolean };

export const CHOICE_KEYS = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧"];

/** 정답을 사람이 읽는 글자로(정답 일괄 표·인쇄·칠판 공용) */
export function answerText(q: Question): string {
  switch (q.type) {
    case "choice":
      return (CHOICE_KEYS[q.answer] || String(q.answer + 1)) + " " + (q.choices[q.answer] || "");
    case "ox":
      return q.answer ? "O" : "X";
    case "number":
      return String(q.answer) + (q.unit ? " " + q.unit : "") + (q.tolerance ? " (±" + q.tolerance + ")" : "");
    case "open":
      return q.model;
  }
}

export const TYPE_LABEL: Record<Question["type"], string> = { choice: "고르기", ox: "OX", number: "숫자 답", open: "서술형" };

export interface QuestionCardProps {
  q: Question;
  surface?: Surface;
  onResult?: (e: QEvent) => void;
  /** 위쪽 이름표(예: "끝 확인", "3 / 9") */
  label?: ReactNode;
  /** 난이도 별·유형 묶음 보이기(기본 true) */
  showMeta?: boolean;
  /** 이미 연 힌트 단계(다시 들어왔을 때) */
  initialLevel?: 0 | 1 | 2 | 3;
  /** 칠판: 보기 글자 가리기 */
  hideChoices?: boolean;
  /** 칠판: 정답 표시(보기에 ✓) */
  revealAnswer?: boolean;
  /** 칠판: 보기별 손든 수 */
  counts?: number[];
  /** 답 입력 없이 문제만(칠판·인쇄 미리보기) */
  readOnly?: boolean;
  /** 맞힌 뒤 나오는 단추(예: '다음 문제') */
  after?: ReactNode;
}

function Stars({ level }: { level: number }) {
  let s = "";
  for (let i = 0; i < 5; i++) s += i < level ? "★" : "☆";
  return (
    <span className="ui-q-stars" role="img" aria-label={"난이도 " + level + " / 5"}>
      {s}
    </span>
  );
}

export function QuestionCard(props: QuestionCardProps) {
  const { q, onResult } = props;
  const sf = useUiSurface(props.surface);
  const [pick, setPick] = useState<number | boolean | null>(null);
  const [text, setText] = useState("");
  const [fb, setFb] = useState<FeedbackKind | null>(null);
  const [solved, setSolved] = useState(false);
  const [level, setLevel] = useState<number>(props.initialLevel || 0);
  const [selfOpen, setSelfOpen] = useState(false);
  const [checks, setChecks] = useState<boolean[]>([]);
  const [selfDone, setSelfDone] = useState<null | boolean>(null);
  const emit = (e: QEvent) => {
    if (onResult) onResult(e);
  };
  const solShown = level >= 3;
  const locked = solved || !!props.readOnly;
  const hints = q.hints ? (q.hints as string[]) : undefined;
  const solution = q.type === "open" ? undefined : q.solution;

  const openLevel = (n: number) => {
    if (n <= level) return;
    for (let k = level + 1; k <= n; k++) {
      if (k === 1 || k === 2) emit({ type: "hint", qid: q.id, level: k });
      if (k === 3) emit({ type: "solution", qid: q.id });
    }
    setLevel(n);
  };

  const submit = (input: number | boolean | string) => {
    if (locked) return;
    let res;
    let shownInput = String(input);
    if (q.type === "number" && typeof input === "string" && hasSymbol(input)) {
      const v = evalNumeric(input);
      res = v == null ? { status: "invalid" as const } : checkAnswer(q, v);
    } else res = checkAnswer(q, input);
    if (q.type === "choice" && typeof input === "number") shownInput = String(input);
    if (res.status === "invalid") {
      setFb("invalid");
      return;
    }
    const ok = res.status === "correct";
    setFb(ok ? (solShown ? "shown" : "ok") : "bad");
    if (ok) setSolved(true);
    emit({ type: "attempt", qid: q.id, correct: ok, afterSolution: solShown, input: shownInput });
  };

  const meta =
    props.showMeta !== false ? (
      <div className="ui-q-meta">
        {props.label ? <span className="chip is-accent">{props.label}</span> : null}
        <span className="chip">{TYPE_LABEL[q.type]}</span>
        <Stars level={q.level} />
        {q.group ? <span className="ui-q-group">{q.group.split(" · ")[0]}</span> : null}
      </div>
    ) : props.label ? (
      <div className="ui-q-meta">
        <span className="chip is-accent">{props.label}</span>
      </div>
    ) : null;

  let body: ReactNode = null;
  if (q.type === "choice") {
    body = (
      <div className="ui-q-opts" role="group" aria-label="보기">
        {q.choices.map((c, i) => {
          const picked = pick === i;
          const isAns = i === q.answer;
          const showOk = (solved && isAns) || (props.revealAnswer && isAns);
          const showBad = !solved && fb === "bad" && picked;
          let cls = "opt ui-opt";
          if (picked && !showOk && !showBad) cls += " is-picked";
          if (showOk) cls += " is-ok";
          if (showBad) cls += " is-bad";
          if (props.hideChoices) cls += " is-hidden";
          const count = props.counts ? props.counts[i] : undefined;
          return (
            <button
              key={i}
              type="button"
              className={cls}
              aria-pressed={picked}
              disabled={locked}
              onClick={() => {
                setPick(i);
                if (fb === "bad" || fb === "invalid") setFb(null);
              }}
            >
              <span className="key" aria-hidden="true">
                {CHOICE_KEYS[i] || i + 1}
              </span>
              <span className="txt">
                <span className="ui-sr">{i + 1}번 </span>
                <Rich text={c} />
              </span>
              {typeof count === "number" ? <span className="ui-opt-count">{count}명</span> : null}
              {showOk ? <span className="mark">✓ 정답</span> : showBad ? <span className="mark">✗ 아니에요</span> : null}
            </button>
          );
        })}
      </div>
    );
  } else if (q.type === "ox") {
    body = (
      <div className="ui-q-ox" role="group" aria-label="O 또는 X">
        {[true, false].map((v) => {
          const picked = pick === v;
          const isAns = q.answer === v;
          const showOk = (solved && isAns) || (props.revealAnswer && isAns);
          const showBad = !solved && fb === "bad" && picked;
          let cls = "opt ui-ox-btn";
          if (picked && !showOk && !showBad) cls += " is-picked";
          if (showOk) cls += " is-ok";
          if (showBad) cls += " is-bad";
          return (
            <button
              key={String(v)}
              type="button"
              className={cls}
              aria-pressed={picked}
              disabled={locked}
              onClick={() => {
                setPick(v);
                if (fb === "bad" || fb === "invalid") setFb(null);
              }}
            >
              <span className="ui-ox-sym" aria-hidden="true">
                {v ? "O" : "X"}
              </span>
              <span className="ui-ox-txt">{v ? "맞아요" : "아니에요"}</span>
              {showOk ? <span className="mark">✓</span> : showBad ? <span className="mark">✗</span> : null}
            </button>
          );
        })}
      </div>
    );
  } else if (q.type === "number") {
    const inputId = "ui-q-in-" + q.id;
    body = (
      <div className="ui-q-num">
        <label className="ui-sr" htmlFor={inputId}>
          답(숫자)
        </label>
        <div className="ui-q-num-row">
          <input
            id={inputId}
            className="input ui-q-input"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="답을 적어요"
            value={text}
            readOnly={locked}
            onChange={(e) => {
              setText(e.target.value);
              if (fb === "invalid" || fb === "bad") setFb(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (text.trim()) submit(text);
              }
            }}
          />
          {q.unit ? <span className="ui-q-unit">{q.unit}</span> : null}
        </div>
        {!locked ? <NumberPad surface={sf} onKey={(k) => setText((t) => t + k)} onBack={() => setText((t) => t.slice(0, -1))} /> : null}
        {solved || props.revealAnswer ? (
          <p className="ui-q-answer">
            정답: <strong><Rich text={answerText(q)} /></strong>
          </p>
        ) : null}
      </div>
    );
  } else {
    // 서술형
    body = (
      <div className="ui-q-open">
        {!props.readOnly ? (
          <>
            <label className="ui-sr" htmlFor={"ui-q-open-" + q.id}>
              내 답
            </label>
            <textarea id={"ui-q-open-" + q.id} className="input ui-q-textarea" rows={4} placeholder="생각을 문장으로 적어 봐요. 적은 글은 저장하지 않아요." value={text} onChange={(e) => setText(e.target.value)} />
          </>
        ) : null}
        {!selfOpen && !props.revealAnswer ? (
          <button type="button" className="btn btn-soft" onClick={() => setSelfOpen(true)}>
            모범 답안 보기
          </button>
        ) : (
          <div className="ui-q-model">
            <div className="reveal-step open">
              <span className="ui-hint-tag">모범 답안</span>
              <div>
                <Rich text={q.model} />
              </div>
            </div>
            {q.rubric && q.rubric.length ? (
              <fieldset className="ui-rubric">
                <legend>채점 기준 — 내 답에 들어 있으면 표시해요</legend>
                {q.rubric.map((r, i) => (
                  <label key={i} className="switch ui-rubric-row">
                    <input
                      type="checkbox"
                      checked={!!checks[i]}
                      disabled={selfDone !== null || props.readOnly}
                      onChange={(e) => {
                        const c = checks.slice();
                        c[i] = e.target.checked;
                        setChecks(c);
                      }}
                    />
                    <span>
                      <Rich text={r} />
                    </span>
                  </label>
                ))}
              </fieldset>
            ) : null}
            {!props.readOnly && selfDone === null ? (
              <div className="ui-q-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setSelfDone(true);
                    setFb("ok");
                    emit({ type: "self", qid: q.id, ok: true, afterSolution: false });
                  }}
                >
                  기준을 다 갖췄어요
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setSelfDone(false);
                    setFb("self");
                    emit({ type: "self", qid: q.id, ok: false, afterSolution: false });
                  }}
                >
                  조금 모자라요
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    );
  }

  const canCheck = !locked && q.type !== "open" && (q.type === "number" ? text.trim().length > 0 : pick !== null);

  return (
    <article className={"ui-q is-" + sf + (solved ? " is-solved" : "")} aria-label={"문제 " + q.id}>
      {meta}
      {q.new ? (
        <p className="ui-q-new">
          <span className="ui-q-new-tag">새로 더해진 것</span> <Rich text={q.new} />
        </p>
      ) : null}
      <div className="ui-q-prompt">
        <Rich text={q.prompt} />
      </div>
      <SpeakButton text={q.prompt + (q.type === "choice" ? ". " + q.choices.map((c, i) => i + 1 + "번, " + c).join(". ") : "")} />
      {body}
      {q.type !== "open" && !props.readOnly ? (
        <div className="ui-q-actions">
          {!solved ? (
            <button type="button" className="btn btn-primary ui-q-check" disabled={!canCheck} onClick={() => submit(q.type === "number" ? text : (pick as number | boolean))}>
              확인
            </button>
          ) : null}
          {solved && props.after ? props.after : null}
        </div>
      ) : null}
      {fb ? (
        <Feedback kind={fb}>
          {fb === "bad" ? (level < 2 && hints && hints.length ? "힌트를 하나 열어 보고 다시 해 봐요." : "풀이를 천천히 읽고 다시 해 봐요.") : null}
          {fb === "invalid" ? "숫자로 적어 줘요. 예: 3, -2, 3/4, 0.5, 2√3, π/2" : null}
          {fb === "shown" ? "풀이를 먼저 봤으니 '풀어 봄'으로 남아요. 다음엔 혼자 맞혀 봐요!" : null}
          {fb === "self" ? "모범 답안의 기준을 하나씩 채워서 다시 써 봐요." : null}
          {fb === "ok" && q.type === "open" ? "기준을 잘 갖췄어요." : null}
        </Feedback>
      ) : null}
      {!props.readOnly ? <HintLadder hints={hints} solution={solution} level={level} onOpen={openLevel} surface={sf} /> : null}
      {q.type === "choice" && solShown && !solved ? (
        <p className="ui-q-answer">
          정답: <strong><Rich text={answerText(q)} /></strong>
        </p>
      ) : null}
    </article>
  );
}
