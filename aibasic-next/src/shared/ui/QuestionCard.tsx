// 문제 카드 하나: 고르기(choice) · OX · 숫자(number) · 서술형(open, 모범 답안과 루브릭으로 스스로 채점).
// 기록은 하지 않아요. 일어난 일을 onResult 로만 알려 주고, 저장은 쓰는 쪽(학생 store)이 해요.
//   attempt  답을 내고 채점했어요(correct, 풀이를 먼저 봤는지 afterSolution)
//   hint     힌트 n 단계를 열었어요
//   solution 풀이를 열었어요
//   self     서술형을 스스로 채점했어요
//   answered 제출했다는 상태 알림(attempt·self 바로 뒤에 한 번 더 와요. correct 와 함께. 쓰는 쪽은 '이번에 제출했는지' 판단에 써요)
//
// 【확정된 새 props — wave2 에서 QRun 이 연결해요】
//   onConcept?(conceptNo:number)  '이 개념 다시 보기' 단추를 눌렀어요. conceptNo 는 conceptNo prop 값(없으면 0 = 개념 처음)
//   conceptNo?: number            이 문제와 이어진 개념 카드 번호(1부터). 0·없음이면 개념 처음으로 가요
//   wrongNote?: WrongNote         오답 한 줄 설명(문자열 하나, 또는 {"0":"…","O":"…","3/4":"…"} 처럼 보기 번호·O/X·적은 답별).
//                                 없으면 q.wrongNote(레슨 JSON, 선택)를 쓰고, 그것도 없으면 wrongTip 문구를 써요
//   onResult 의 QEvent "answered" 와 같이 쓰이는 상태: { type:"answered", qid, correct }
//   '풀이 확인하기'는 오답 직후부터 나와요. 먼저 열면 afterSolution=true 로 기록돼요(기존 'solution' 이벤트도 같이 와요).
import { useRef, useState, type ReactNode } from "react";
import type { Question, Surface, WrongNote } from "../contracts.ts";
import { NUMBER_DIRECTION_HINT, pickWrongNote } from "../contracts.ts";
import { checkAnswer } from "../logic/answer.ts";
import { Rich } from "./tex.tsx";
import { Feedback, type FeedbackKind } from "./Feedback.tsx";
import { HintLadder } from "./HintLadder.tsx";
import { NumberPad } from "./NumberPad.tsx";
import { padKeysForQuestion } from "./padKeys.ts";
import { evalNumeric, hasSymbol } from "./numexpr.ts";
import { useUiSurface } from "./surface.ts";
import { SpeakButton } from "./SpeakButton.tsx";

export type QEvent =
  | { type: "attempt"; qid: string; correct: boolean; afterSolution: boolean; input: string }
  | { type: "hint"; qid: string; level: 1 | 2 }
  | { type: "solution"; qid: string }
  | { type: "self"; qid: string; ok: boolean; afterSolution: boolean }
  | { type: "answered"; qid: string; correct: boolean };

export const CHOICE_KEYS = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧"];

/** 정답을 사람이 읽는 글자로(정답 일괄 표·인쇄·칠판 공용) */
export function answerText(q: Question): string {
  switch (q.type) {
    case "choice":
      return (CHOICE_KEYS[q.answer] || String(q.answer + 1)) + " " + (q.choices[q.answer] || "");
    case "ox":
      return q.answer ? "O" : "X";
    case "number":
      return String(q.answer) + unitJoin(q.unit) + (q.tolerance ? " (±" + q.tolerance + ")" : "");
    case "open":
      return q.model;
  }
}

/** 숫자 뒤 단위 붙이기: 한글 단위·%·° 는 붙여 쓰고(10명, 20%), 영문 단위는 띄어 써요(3 cm) */
export function unitJoin(unit?: string): string {
  const u = String(unit || "").trim();
  if (!u) return "";
  return /^[\uAC00-\uD7A3%°℃]/.test(u) ? u : " " + u;
}

/** 학생이 낸 답을 다시 보여 줄 글자 */
function inputText(q: Question, input: number | boolean | string): string {
  if (q.type === "choice" && typeof input === "number") return (CHOICE_KEYS[input] || String(input + 1)) + " " + (q.choices[input] || "");
  if (q.type === "ox") return input === true ? "O" : "X";
  if (q.type === "number") return String(input).trim() + unitJoin(q.unit);
  return String(input);
}

/** 틀린 횟수에 따라 달라지는 안내(1회: 조건·단위 → 2회: 힌트 → 3회부터: 풀이) */
export function wrongTip(n: number, hasHintLeft: boolean, hasSolution: boolean): string {
  if (n <= 1) return "문제의 조건과 단위를 한 번 더 천천히 읽어 봐요.";
  if (n === 2 && hasHintLeft) return "힌트를 하나 열어 보면 실마리가 보일 거예요.";
  if (hasSolution) return "풀이를 열어 한 줄씩 따라가 봐요. 이해한 뒤 다시 풀면 돼요.";
  return hasHintLeft ? "힌트를 열어 보고 다시 해 봐요." : "개념 카드를 다시 보고 와도 좋아요.";
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
  /** '새로 더해진 것' 띠 보이기(기본 true. 복습·오답노트에서는 끄기) */
  showNew?: boolean;
  /** '이 개념 다시 보기' 를 눌렀을 때(없으면 단추를 숨겨요) */
  onConcept?: (conceptNo: number) => void;
  /** 이 문제와 이어진 개념 카드 번호(1부터, 0·없음 = 개념 처음) */
  conceptNo?: number;
  /** 오답 한 줄 설명(없으면 q.wrongNote → wrongTip) */
  wrongNote?: WrongNote;
  /** 오답 박스 안, 설명 아래에 덧붙일 말(예: '지난번엔 맞혔는데…'). 오답일 때만 보여요 */
  wrongExtra?: ReactNode;
  /** 다시 들어왔을 때 미리 표시할 고른 답(정답 처리는 하지 않고 '고른 것'만 보여요) */
  initialPick?: number | boolean | null;
  /** 다시 들어왔을 때 미리 채울 적은 글 */
  initialText?: string;
  /** 고른 답·적은 글이 바뀔 때마다 알려요(쓰는 쪽이 메모리에 보관) */
  onDraft?: (d: { pick: number | boolean | null; text: string }) => void;
}

const LEVEL_WORD = ["", "쉬움", "쉬움", "보통", "어려움", "어려움"];

function Stars({ level }: { level: number }) {
  let s = "";
  for (let i = 0; i < 5; i++) s += i < level ? "★" : "☆";
  return (
    <span className="ui-q-level">
      <span className="ui-q-stars" role="img" aria-label={"난이도 " + level + " / 5"}>
        {s}
      </span>
      <span className="ui-q-level-word">{LEVEL_WORD[level] || ""}</span>
    </span>
  );
}

export function QuestionCard(props: QuestionCardProps) {
  const { q, onResult } = props;
  const sf = useUiSurface(props.surface);
  const [pick, setPick] = useState<number | boolean | null>(props.initialPick === undefined ? null : props.initialPick);
  const [text, setText] = useState(props.initialText || "");
  const draft = (p: number | boolean | null, t: string) => {
    if (props.onDraft) props.onDraft({ pick: p, text: t });
  };
  const changePick = (v: number | boolean) => {
    setPick(v);
    draft(v, text);
  };
  const changeText = (t: string) => {
    setText(t);
    draft(pick, t);
  };
  const [fb, setFb] = useState<FeedbackKind | null>(null);
  const [solved, setSolved] = useState(false);
  const [level, setLevel] = useState<number>(props.initialLevel || 0);
  const [selfOpen, setSelfOpen] = useState(false);
  const [checks, setChecks] = useState<boolean[]>([]);
  const [selfDone, setSelfDone] = useState<null | boolean>(null);
  const [wrongN, setWrongN] = useState(0);
  const [lastIn, setLastIn] = useState("");
  const [lastNote, setLastNote] = useState<string | undefined>(undefined);
  // 맞힌 뒤 '풀이 확인하기'(기록하지 않아요)
  const [peek, setPeek] = useState(false);
  // 오답 뒤 풀이를 연 적이 있으면 이후 맞혀도 '풀어 봄'(solShown 과 같은 뜻)
  const fbRef = useRef<HTMLDivElement>(null);
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
    else {
      setWrongN((n) => n + 1);
      setLastIn(inputText(q, input));
      setLastNote(pickWrongNote(props.wrongNote || (q as { wrongNote?: WrongNote }).wrongNote, input));
    }
    emit({ type: "attempt", qid: q.id, correct: ok, afterSolution: solShown, input: shownInput });
    emit({ type: "answered", qid: q.id, correct: ok });
    focusFb();
  };
  // 오답 직후 피드백과 두 단추가 고정 하단바 위에 보이게 부드럽게 이동(움직임 줄이기 설정이면 바로 이동)
  const scrollToFb = (el: HTMLElement) => {
    const wrap = (el.closest(".ui-q") as HTMLElement | null) || el;
    const target = (wrap.querySelector(".ui-q-after-wrong") as HTMLElement | null) || el;
    if (typeof target.scrollIntoView !== "function") return;
    const r = target.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (r.top >= 0 && r.bottom <= vh - 96) return;
    const reduce = document.documentElement.getAttribute("data-motion") === "reduce";
    try {
      target.scrollIntoView({ block: "end", behavior: reduce ? "auto" : "smooth" });
    } catch {
      target.scrollIntoView(false);
    }
  };
  // 제출 뒤 피드백으로 포커스를 옮겨 화면 읽기 프로그램이 바로 읽게 해요(다음 렌더 뒤에)
  const focusFb = () => {
    setTimeout(() => {
      const el = fbRef.current;
      if (!el) return;
      // preventScroll: 포커스가 화면을 갑자기 끌지 않게 하고, 스크롤은 아래에서 부드럽게 따로 해요
      if (typeof el.focus === "function") el.focus({ preventScroll: true });
      scrollToFb(el);
    }, 0);
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
                changePick(i);
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
                changePick(v);
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
          {q.unit ? "답(숫자, 단위 " + q.unit + ")" : "답(숫자)"}
        </label>
        <div className={"ui-q-num-row" + (q.unit ? " has-unit" : "")}>
          <input
            id={inputId}
            className="input ui-q-input"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder={q.unit ? "답을 적어요 (" + q.unit + ")" : "답을 적어요"}
            value={text}
            readOnly={locked}
            onChange={(e) => {
              changeText(e.target.value);
              if (fb === "invalid" || fb === "bad") setFb(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (text.trim()) submit(text);
              }
            }}
          />
          {q.unit ? (
            <span className="ui-q-unit" aria-hidden="true">
              {q.unit}
            </span>
          ) : null}
        </div>
        {!locked ? <NumberPad surface={sf} keys={padKeysForQuestion(q)} onKey={(k) => changeText(text + k)} onBack={() => changeText(text.slice(0, -1))} /> : null}
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
            <textarea id={"ui-q-open-" + q.id} className="input ui-q-textarea" rows={4} placeholder="생각을 문장으로 적어 봐요. 적은 글은 저장하지 않아요." value={text} onChange={(e) => changeText(e.target.value)} />
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
                    emit({ type: "answered", qid: q.id, correct: true });
                    focusFb();
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
                    emit({ type: "answered", qid: q.id, correct: false });
                    focusFb();
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
  const needId = "ui-q-need-" + q.id;
  const hintLeft = !!hints && hints.filter((h) => !!h).length > Math.min(level, 2);

  return (
    <article className={"ui-q is-" + sf + (solved ? " is-solved" : "") + (fb === "bad" && !solved ? " is-wrong" : "")} aria-label={"문제 " + q.id}>
      {meta}
      {q.new && props.showNew !== false ? (
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
            <button
              type="button"
              className="btn btn-primary ui-q-check"
              disabled={!canCheck}
              aria-describedby={!canCheck ? needId : undefined}
              onClick={() => submit(q.type === "number" ? text : (pick as number | boolean))}
            >
              확인
            </button>
          ) : null}
          {solved && props.after ? props.after : null}
        </div>
      ) : null}
      {q.type !== "open" && !props.readOnly && !solved && !canCheck ? (
        <p id={needId} className="small ui-q-need">
          {q.type === "number" ? "답을 먼저 적어 주세요" : "답을 먼저 골라 주세요"}
        </p>
      ) : null}
      {fb ? (
        <Feedback kind={fb} focusRef={fbRef}>
          {fb === "bad" ? (
            <>
              {lastIn ? (
                <span className="ui-fb-input" style={{ display: "block" }}>
                  적은 답: <strong><Rich text={lastIn} /></strong>
                </span>
              ) : null}
              {lastNote ? <span style={{ display: "block" }}>{lastNote}</span> : null}
              {!lastNote && q.type === "number" ? <span style={{ display: "block" }}>{NUMBER_DIRECTION_HINT}</span> : null}
              <span style={{ display: "block" }}>{wrongTip(wrongN, hintLeft, !!solution && level < 3)}</span>
              {props.wrongExtra ? <span className="ui-fb-extra" style={{ display: "block" }}>{props.wrongExtra}</span> : null}
            </>
          ) : null}
          {fb === "invalid" ? "숫자로 적어 줘요. 예: 3, -2, 3/4, 0.5, 2√3, π/2" : null}
          {fb === "shown" ? "풀이를 먼저 봤으니 '풀어 봄'으로 남아요. 다음엔 혼자 맞혀 봐요!" : null}
          {fb === "self" ? "모범 답안의 기준을 하나씩 채워서 다시 써 봐요." : null}
          {fb === "ok" && q.type === "open" ? "기준을 잘 갖췄어요." : null}
        </Feedback>
      ) : null}
      {!props.readOnly && !solved && fb === "bad" && (props.onConcept || (solution && level < 3)) ? (
        <div className="ui-q-after-wrong">
          {solution && level < 3 ? (
            <button type="button" className="btn btn-soft ui-q-peek" onClick={() => openLevel(3)}>
              풀이 확인하기
            </button>
          ) : null}
          {props.onConcept ? (
            <button type="button" className="btn btn-soft ui-q-concept" onClick={() => props.onConcept && props.onConcept(props.conceptNo || 0)}>
              이 개념 다시 보기
            </button>
          ) : null}
        </div>
      ) : null}
      {!props.readOnly && !solved ? <HintLadder hints={hints} solution={solution} level={level} onOpen={openLevel} surface={sf} /> : null}
      {!props.readOnly && solved ? (
        <div className={"ui-hints is-" + sf}>
          {solution && (peek || solShown) ? (
            <div className="reveal-step open ui-hint is-sol">
              <span className="ui-hint-tag">풀이</span>
              <div className="ui-hint-txt">
                <Rich text={solution} />
              </div>
            </div>
          ) : solution ? (
            <button type="button" className="btn btn-soft ui-hint-btn ui-q-peek" onClick={() => setPeek(true)}>
              풀이 확인하기
            </button>
          ) : null}
          {props.onConcept ? (
            <button type="button" className="btn btn-soft ui-q-concept" onClick={() => props.onConcept && props.onConcept(props.conceptNo || 0)}>
              이 개념 다시 보기
            </button>
          ) : null}
        </div>
      ) : null}
      {q.type === "choice" && solShown && !solved ? (
        <p className="ui-q-answer">
          정답: <strong><Rich text={answerText(q)} /></strong>
        </p>
      ) : null}
    </article>
  );
}
