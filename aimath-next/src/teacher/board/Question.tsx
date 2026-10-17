// 칠판 한 문제 모드: 보기 가리기 → (보기) → 힌트1 → 힌트2 → 정답 → 풀이. '다음'이 한 단계씩 열어요.
// 문제와 보기는 무대 폭을 다 쓰고 세로 공간을 채워요(본문 40px, 보기 34px — 길면 36·32px).
// 보기마다 '손든 수'를 세요: − · + 단추가 따로 있고(키보드로도 돼요), 숫자 칸을 누르면 +1, 길게 누르면 −1(지름길).
// 막대는 색 + 빗금 + 글자로 보여요(aimn:t1:results 에 숫자만 저장). 모둠 점수(1~6모둠)는 메모리에만 둬요.
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import type { Question } from "../../shared/contracts.ts";
import { CHOICE_KEYS, Rich, answerText } from "../../shared/ui/index.ts";
import { useTally, barPcts, sum } from "../store/index.ts";
import { QSTAGE_LABEL, qStages, stageOpen, tallyAnswer, tallyLabels, type QStage } from "./board.logic.ts";

export { tallyAnswer, tallyLabels };

const LONG_MS = 600;

/** 손든 수: [−] ✋ n명 [+]. 가운데 숫자 칸은 누르면 +1, 길게 누르면 −1(지름길) */
function Tally({ n, label, onChange }: { n: number; label: string; onChange: (d: number) => void }) {
  const timer = useRef<number | null>(null);
  const longed = useRef(false);
  const clear = () => {
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clear, []);
  const down = (e: RPointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    longed.current = false;
    clear();
    timer.current = window.setTimeout(() => {
      longed.current = true;
      onChange(-1);
    }, LONG_MS);
  };
  return (
    <div className="bdq-tally bd-noswipe" role="group" aria-label={label + " 손든 학생"}>
      <button type="button" className="bdq-tally-step" aria-label={label + " 한 명 빼기"} disabled={n <= 0} onClick={() => onChange(-1)}>
        −
      </button>
      <button
        type="button"
        className="bdq-tally-n"
        aria-label={label + " 손든 학생 " + n + "명. 누르면 한 명 더해요"}
        onPointerDown={down}
        onPointerUp={clear}
        onPointerLeave={clear}
        onPointerCancel={clear}
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => {
          if (longed.current) {
            longed.current = false;
            return;
          }
          onChange(1);
        }}
      >
        <span className="bdq-tally-hand" aria-hidden="true">
          ✋
        </span>
        <span className="num" aria-live="polite">
          {n}
        </span>
        <span className="bdq-tally-unit">명</span>
      </button>
      <button type="button" className="bdq-tally-step" aria-label={label + " 한 명 더하기"} onClick={() => onChange(1)}>
        +
      </button>
    </div>
  );
}

// 모둠 점수: 장면을 옮겨도 남게 모듈 메모리에(저장 안 함)
let memGroups = [0, 0, 0, 0, 0, 0];

function GroupScores({ onClose }: { onClose: () => void }) {
  const [g, setG] = useState(memGroups);
  useEffect(() => {
    memGroups = g;
  }, [g]);
  const ch = (i: number, d: number) => setG((cur) => cur.map((v, k) => (k === i ? Math.max(0, Math.min(99, v + d)) : v)));
  return (
    <div className="bd-groups bdq-groups bd-noswipe" role="group" aria-label="모둠 점수">
      <div className="bd-groups-head">
        <strong>모둠 점수</strong>
        <span className="tiny muted">저장하지 않아요</span>
        <button type="button" className="btn btn-ghost" onClick={() => setG([0, 0, 0, 0, 0, 0])}>
          0으로
        </button>
        <button type="button" className="bd-x" onClick={onClose} aria-label="모둠 점수 닫기">
          ✕
        </button>
      </div>
      <ul className="bd-groups-list">
        {g.map((v, i) => (
          <li key={i}>
            <span className="bd-group-name">{i + 1}모둠</span>
            <div className="stepper">
              <button type="button" onClick={() => ch(i, -1)} aria-label={i + 1 + "모둠 1점 빼기"}>
                −
              </button>
              <span className="val num" aria-live="polite">
                {v}
              </span>
              <button type="button" onClick={() => ch(i, 1)} aria-label={i + 1 + "모둠 1점 더하기"}>
                +
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface BoardQuestionProps {
  lid: string;
  q: Question;
  /** 열린 단계(0부터, qStages(q) 안 위치) */
  r: number;
  onStage: (r: number) => void;
  label?: string;
}

/** 공개 단추 이름(지금 상태가 아니라 '누르면 열리는 것') */
const STAGE_BTN: Record<QStage, string> = {
  hide: "보기 가리기",
  show: "보기 보이기",
  hint1: "힌트 1",
  hint2: "힌트 2",
  answer: "정답",
  sol: "풀이",
};

export function BoardQuestion({ lid, q, r, onStage, label }: BoardQuestionProps) {
  const stages = qStages(q);
  const open = (st: QStage) => stageOpen(stages, r, st);
  const labels = tallyLabels(q);
  const ans = tallyAnswer(q);
  const [counts, change, reset] = useTally(lid, q.id, labels.length);
  const pcts = barPcts(counts);
  const total = sum(counts);
  const [groups, setGroups] = useState(false);
  const hidden = q.type === "choice" && !open("show");
  const showAns = open("answer");
  const hints = Array.isArray(q.hints) ? (q.hints as string[]).filter((h) => !!h) : [];
  const solution = q.type === "open" ? undefined : q.solution;
  const longPrompt = (q.prompt || "").length > 120;

  const bar = (i: number) => {
    const isAns = showAns && i === ans;
    return (
      <div className="bdq-bar" aria-hidden="true">
        <span className={"bd-tbar" + (isAns ? " is-ans" : "")} style={{ width: Math.max(pcts[i], counts[i] ? 4 : 0) + "%" }} />
      </div>
    );
  };

  let body = null;
  if (q.type === "choice") {
    const long = q.choices.length > 4 || q.choices.some((c) => c.length > 28);
    body = (
      <ol className={"bdq-opts" + (long ? " is-long" : " is-grid") + " n" + q.choices.length}>
        {q.choices.map((c, i) => {
          const isAns = showAns && i === q.answer;
          return (
            <li key={i} className={"bdq-opt" + (isAns ? " is-ans" : "") + (hidden ? " is-hidden" : "")}>
              <div className="bdq-opt-main">
                <span className="bdq-key" aria-hidden="true">
                  {CHOICE_KEYS[i] || i + 1}
                </span>
                <span className="bdq-opt-txt">
                  {hidden ? (
                    <span className="bdq-cover">
                      <span className="sr-only">보기 {i + 1}: </span>보기 보이기를 누르면 나타나요
                    </span>
                  ) : (
                    <Rich text={c} />
                  )}
                </span>
                {isAns ? <span className="bdq-mark">✓ 정답</span> : null}
                <Tally n={counts[i]} label={labels[i]} onChange={(d) => change(i, d)} />
              </div>
              {bar(i)}
            </li>
          );
        })}
      </ol>
    );
  } else if (q.type === "ox") {
    body = (
      <ol className="bdq-opts is-grid is-ox n2">
        {[0, 1].map((i) => {
          const isAns = showAns && i === ans;
          return (
            <li key={i} className={"bdq-opt" + (isAns ? " is-ans" : "")}>
              <div className="bdq-opt-main">
                <span className="bdq-ox" aria-hidden="true">
                  {i === 0 ? "O" : "X"}
                </span>
                <span className="bdq-opt-txt">{i === 0 ? "맞아요" : "아니에요"}</span>
                {isAns ? <span className="bdq-mark">✓ 정답</span> : null}
                <Tally n={counts[i]} label={labels[i]} onChange={(d) => change(i, d)} />
              </div>
              {bar(i)}
            </li>
          );
        })}
      </ol>
    );
  } else if (q.type === "number") {
    body = (
      <div className="bdq-num">
        <p className="bdq-num-box">
          답: <span className="bdq-num-blank">{showAns ? <Rich text={answerText(q)} /> : "?"}</span>
        </p>
        <ol className="bdq-opts is-grid n2">
          {[0, 1].map((i) => (
            <li key={i} className="bdq-opt">
              <div className="bdq-opt-main">
                <span className="bdq-opt-txt">{labels[i]}</span>
                <Tally n={counts[i]} label={labels[i]} onChange={(d) => change(i, d)} />
              </div>
              {bar(i)}
            </li>
          ))}
        </ol>
      </div>
    );
  }

  const panelOpen = showAns || open("hint1") || (!!solution && open("sol"));
  const nextIdx = r + 1 < stages.length ? r + 1 : -1;

  return (
    <div className={"bdq" + (panelOpen ? " has-panel" : "") + (longPrompt ? " is-longq" : "")}>
      <div className="bdq-head">
        {label ? <span className="chip is-accent">{label}</span> : null}
        <span className="chip">{q.group.split(" · ")[0]}</span>
        <span className="bd-q-stars" role="img" aria-label={"난이도 " + q.level + " / 5"}>
          {"★★★★★".slice(0, q.level)}
          {"☆☆☆☆☆".slice(0, 5 - q.level)}
        </span>
      </div>
      <div className="bdq-prompt">
        <Rich text={q.prompt} />
      </div>
      {body ? <div className="bdq-body">{body}</div> : <div className="bdq-body is-empty" />}

      {panelOpen ? (
        <div className="bdq-panel" aria-live="polite">
          {showAns ? (
            <p className="bdq-answer">
              <span className="bdq-answer-tag">정답:</span> <Rich text={answerText(q)} />
            </p>
          ) : null}
          {hints.map((h, i) =>
            open(i === 0 ? "hint1" : "hint2") ? (
              <div key={i} className="bdq-card is-hint">
                <span className="bdq-tag">힌트 {i + 1}</span>
                <div className="bdq-card-txt">
                  <Rich text={h} />
                </div>
              </div>
            ) : null,
          )}
          {solution && open("sol") ? (
            <div className="bdq-card is-sol">
              <span className="bdq-tag">풀이</span>
              <div className="bdq-card-txt">
                <Rich text={solution} />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="bdq-controls bd-noswipe">
        <div className="bdq-steps" role="group" aria-label="단계 바로 열기">
          {stages.map((st, i) => {
            const isOpen = i <= r;
            const isNext = i === nextIdx;
            return (
              <button
                key={st}
                type="button"
                className={"bdq-step" + (isOpen ? " is-open" : "") + (isNext ? " is-next" : "") + (i === r ? " is-cur" : "")}
                aria-pressed={isOpen}
                aria-current={isNext ? "step" : undefined}
                title={QSTAGE_LABEL[st]}
                onClick={() => onStage(i <= r && i === r ? Math.max(0, i - 1) : i)}
              >
                {isOpen && st !== "hide" ? "✓ " : ""}
                {STAGE_BTN[st]}
              </button>
            );
          })}
        </div>
        {labels.length ? (
          <p className="bdq-sum">
            손든 학생 <b className="num">{total}</b>명
            {total ? (
              <button type="button" className="btn btn-ghost bdq-reset" onClick={reset}>
                0으로
              </button>
            ) : null}
          </p>
        ) : null}
        <button type="button" className={"btn bdq-groups-open" + (groups ? " is-on" : "")} aria-pressed={groups} onClick={() => setGroups((v) => !v)}>
          모둠 점수
        </button>
      </div>
      {groups ? <GroupScores onClose={() => setGroups(false)} /> : null}
    </div>
  );
}
