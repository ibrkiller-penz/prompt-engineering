// 칠판 한 문제 모드: 보기 가리기 → (보기) → 힌트1 → 힌트2 → 정답 → 풀이. '다음'이 한 단계씩 열어요.
// 보기마다 '손든 수'를 세요: 누르면 +1, 길게 누르면 −1. 막대는 색 + 빗금 + 글자로 보여요(aimn:t1:results 에 숫자만 저장).
// 모둠 점수(1~6모둠)는 메모리에만 두고 저장하지 않아요.
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import type { Question } from "../../shared/contracts.ts";
import { CHOICE_KEYS, Rich, answerText } from "../../shared/ui/index.ts";
import { useTally, barPcts, sum } from "../store/index.ts";
import { QSTAGE_LABEL, qStages, stageOpen, tallyAnswer, tallyLabels, type QStage } from "./board.logic.ts";

export { tallyAnswer, tallyLabels };

const LONG_MS = 600;

/** 손든 수 단추: 누르면 +1, 길게 누르면 −1 */
function TallyBtn({ n, label, onChange }: { n: number; label: string; onChange: (d: number) => void }) {
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
    <button
      type="button"
      className="bd-tally-btn bd-noswipe"
      aria-label={label + " 손든 학생 " + n + "명. 누르면 한 명 더, 길게 누르면 한 명 빼요"}
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
      <span className="bd-tally-hand" aria-hidden="true">
        ✋
      </span>
      <span className="bd-tally-n num">{n}</span>
      <span className="bd-tally-unit">명</span>
    </button>
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
    <div className="bd-groups" role="group" aria-label="모둠 점수">
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

  const bar = (i: number) => {
    const isAns = showAns && i === ans;
    return (
      <div className="bd-tbar-row" aria-hidden="true">
        <span className={"bd-tbar" + (isAns ? " is-ans" : "")} style={{ width: Math.max(pcts[i], counts[i] ? 4 : 0) + "%" }} />
      </div>
    );
  };

  let body = null;
  if (q.type === "choice") {
    body = (
      <ol className={"bd-opts" + (q.choices.length > 4 || q.choices.some((c) => c.length > 30) ? " is-long" : "")}>
        {q.choices.map((c, i) => {
          const isAns = showAns && i === q.answer;
          return (
            <li key={i} className={"bd-opt" + (isAns ? " is-ans" : "") + (hidden ? " is-hidden" : "")}>
              <div className="bd-opt-main">
                <span className="bd-opt-key" aria-hidden="true">
                  {CHOICE_KEYS[i] || i + 1}
                </span>
                <span className="bd-opt-txt">{hidden ? <span className="bd-opt-cover">보기 {i + 1}</span> : <Rich text={c} />}</span>
                {isAns ? <span className="bd-mark">✓ 정답</span> : null}
                <TallyBtn n={counts[i]} label={labels[i]} onChange={(d) => change(i, d)} />
              </div>
              {bar(i)}
            </li>
          );
        })}
      </ol>
    );
  } else if (q.type === "ox") {
    body = (
      <ol className="bd-opts is-ox">
        {[0, 1].map((i) => {
          const isAns = showAns && i === ans;
          return (
            <li key={i} className={"bd-opt" + (isAns ? " is-ans" : "")}>
              <div className="bd-opt-main">
                <span className="bd-ox-sym" aria-hidden="true">
                  {i === 0 ? "O" : "X"}
                </span>
                <span className="bd-opt-txt">{i === 0 ? "맞아요" : "아니에요"}</span>
                {isAns ? <span className="bd-mark">✓ 정답</span> : null}
                <TallyBtn n={counts[i]} label={labels[i]} onChange={(d) => change(i, d)} />
              </div>
              {bar(i)}
            </li>
          );
        })}
      </ol>
    );
  } else if (q.type === "number") {
    body = (
      <div className="bd-num">
        <p className="bd-num-box">
          답: <span className="bd-num-blank">{showAns ? <Rich text={answerText(q)} /> : "?"}</span>
        </p>
        <ol className="bd-opts is-ox">
          {[0, 1].map((i) => (
            <li key={i} className="bd-opt">
              <div className="bd-opt-main">
                <span className="bd-opt-txt">{labels[i]}</span>
                <TallyBtn n={counts[i]} label={labels[i]} onChange={(d) => change(i, d)} />
              </div>
              {bar(i)}
            </li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <div className="bd-q">
      <div className="bd-q-main">
        <div className="bd-q-meta">
          {label ? <span className="chip is-accent">{label}</span> : null}
          <span className="chip">{q.group.split(" · ")[0]}</span>
          <span className="bd-q-stars" role="img" aria-label={"난이도 " + q.level + " / 5"}>
            {"★★★★★".slice(0, q.level)}
            {"☆☆☆☆☆".slice(0, 5 - q.level)}
          </span>
        </div>
        <div className="bd-q-prompt">
          <Rich text={q.prompt} />
        </div>
        {body}
        {labels.length ? (
          <p className="bd-tally-sum small">
            손든 학생 <b className="num">{total}</b>명 · 누르면 +1, 길게 누르면 −1
            {total ? (
              <button type="button" className="btn btn-ghost bd-tally-reset" onClick={reset}>
                0으로
              </button>
            ) : null}
          </p>
        ) : null}
      </div>

      <aside className="bd-q-side" aria-label="힌트와 풀이">
        <div className="bd-q-steps" role="group" aria-label="단계 바로 열기">
          {stages.map((st, i) => (
            <button key={st} type="button" className={"chip bd-q-stage" + (i <= r ? " is-open" : "")} aria-pressed={i <= r} onClick={() => onStage(i <= r && i === r ? Math.max(0, i - 1) : i)}>
              {QSTAGE_LABEL[st]}
            </button>
          ))}
        </div>
        <div className="bd-q-panel">
          {hints.map((h, i) =>
            open(i === 0 ? "hint1" : "hint2") ? (
              <div key={i} className="bd-q-card is-hint">
                <span className="bd-q-tag">힌트 {i + 1}</span>
                <div>
                  <Rich text={h} />
                </div>
              </div>
            ) : null,
          )}
          {showAns ? (
            <div className="bd-q-card is-ans">
              <span className="bd-q-tag">✓ 정답</span>
              <div>
                <Rich text={answerText(q)} />
              </div>
            </div>
          ) : null}
          {solution && open("sol") ? (
            <div className="bd-q-card is-sol">
              <span className="bd-q-tag">풀이</span>
              <div>
                <Rich text={solution} />
              </div>
            </div>
          ) : null}
          {!hints.length && !showAns ? <p className="muted bd-q-wait">먼저 혼자 풀어 보고, 손을 들어 답을 골라 봐요.</p> : null}
        </div>
        {groups ? (
          <GroupScores onClose={() => setGroups(false)} />
        ) : (
          <button type="button" className="btn bd-groups-open" onClick={() => setGroups(true)}>
            모둠 점수 열기
          </button>
        )}
      </aside>
    </div>
  );
}
