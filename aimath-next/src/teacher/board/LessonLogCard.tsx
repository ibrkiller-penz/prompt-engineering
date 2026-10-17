// 반별 수업 기록 카드(교사 전용): 오늘 수업·숙제 번호·문제별 손든 결과와 정답률·끝 확인 결과를 한 장으로 보여요.
//   - 반 이름은 교사가 고른 값만 쓰고 학생 이름·번호 입력란은 없어요. 세특 같은 평가 문장도 만들지 않아요.
//   - '복사'는 클립보드를 쓰고 막히면 선택 가능한 글상자로 대신해요. '인쇄'는 window.print(흑백·큰 글씨, lessonlog.css).
//   - 카드는 body 에 직접 붙여요(createPortal). 그래야 인쇄할 때 카드만 남기고 나머지를 숨길 수 있어요.
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Lesson, LessonLog, LessonLogQuestion } from "../../shared/contracts.ts";
import { buildLessonLog, hasVotes, lessonLogText, weakQuestions, type LessonLogVote } from "../logic/index.ts";
import { useKlass } from "../shell/klass.tsx";
import { resultKey, useLessonLogs, useResults } from "../store/index.ts";
import { CHOICE_KEYS, hwNumbers, practiceNo, tallyAnswer } from "./board.logic.ts";
import "./lessonlog.css";

/* ─────────── 카드 만들 재료 ─────────── */

/** 지금 수업에서 카드를 만들 재료 */
export interface LogSource {
  lesson: Lesson;
  /** 차시(0 이면 레슨 전체) */
  p: number;
  /** 끝 확인 문제 id */
  exit: readonly string[];
  /** 숙제 문제 id */
  hw: readonly string[];
  /** 이 수업의 켜진 칠판 문제 id */
  boardIds: readonly string[];
  scenesDone: number;
  scenesTotal: number;
}

/** 오늘 날짜(YYYY-MM-DD, 이 기기의 시계) */
export function todayStr(d: Date = new Date()): string {
  return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
}

/**
 * 지금 수업의 카드 한 장과 저장 함수. 득표는 저장된 손들기 결과에서 읽어요.
 * 칠판 문제는 손든 것만, 끝 확인 문제는 손들기를 안 했어도 줄에 올려요.
 */
export function useLogSnapshot(src: LogSource | null): { card: LessonLog | null; save: () => void } {
  const { klass } = useKlass();
  const [results] = useResults();
  const [, put] = useLessonLogs();
  const card = useMemo(() => {
    if (!src) return null;
    const lid = src.lesson.id;
    const ids: string[] = [];
    const seen: Record<string, true> = {};
    const add = (id: string) => {
      if (!id || seen[id]) return;
      seen[id] = true;
      ids.push(id);
    };
    src.boardIds.forEach(add);
    src.exit.forEach(add);
    const exitSet: Record<string, true> = {};
    src.exit.forEach((id) => {
      exitSet[id] = true;
    });
    const votes: LessonLogVote[] = [];
    for (const id of ids) {
      const q = src.lesson.practice.filter((x) => x.id === id)[0];
      if (!q) continue;
      const ans = tallyAnswer(q);
      if (ans < 0) continue;
      const r = results[resultKey(lid, id)];
      const counts = r && Array.isArray(r.counts) ? r.counts : null;
      const voted = !!counts && counts.some((c) => c > 0);
      if (!voted && !exitSet[id]) continue;
      votes.push({ id, answer: ans, counts });
    }
    return buildLessonLog({
      klass: klass || "",
      lid,
      p: src.p,
      date: todayStr(),
      scenesDone: src.scenesDone,
      scenesTotal: src.scenesTotal,
      hw: src.hw,
      exitIds: src.exit,
      votes,
    });
  }, [src, klass, results]);
  const save = () => {
    if (card) put({ ...card, ts: Date.now() });
  };
  return { card, save };
}

/* ─────────── 글 만들기 ─────────── */

const shortQ = (id: string) => {
  const m = /(q\d+)$/.exec(id);
  return m ? m[1] : id;
};

/** 문제 이름: 레슨 연습 순서로 "6번", 못 찾으면 id 끝("q06") */
export function qName(id: string, pids?: readonly string[]): string {
  const no = pids ? practiceNo(pids, id) : 0;
  return no ? no + "번" : shortQ(id);
}

/** 카드 머리 한 줄(반 · 날짜) */
export function logTitle(card: Pick<LessonLog, "klass" | "date">): string {
  return (card.klass ? card.klass : "반을 고르지 않았어요") + " · " + card.date;
}

/** 숙제 번호 줄 */
export function hwLine(card: Pick<LessonLog, "hw">, pids?: readonly string[]): string {
  if (!card.hw.length) return "숙제가 없어요";
  return pids ? hwNumbers(pids, card.hw) : card.hw.map(shortQ).join(" · ");
}

/** '다음 시간 앞부분에 다시 볼 것' 한 줄 */
export function reviewLine(card: LessonLog, pids?: readonly string[]): string {
  const weak = weakQuestions(card, 2);
  if (weak.length) return weak.map((q) => qName(q.id, pids) + (q.exit ? "(끝 확인)" : "") + " 정답률 " + q.rate + "%").join(", ") + " 문제를 다시 봐요.";
  if (!card.qs.some(hasVotes)) return "손든 결과가 없어서 정하지 못했어요.";
  return "정답률이 80% 아래인 문제는 없어요.";
}

/** 끝 확인 한 줄 풀이 */
function exitLine(card: LessonLog): string {
  const ex = card.qs.filter((q) => q.exit);
  if (!card.exitDone || !ex.length) return "끝 확인 문제를 고르지 않았어요.";
  const voted = ex.filter(hasVotes);
  if (!voted.length) return "끝 확인 문제 " + ex.length + "개가 있고, 손들기는 아직 안 했어요.";
  const weak = weakQuestions({ qs: ex }, 2);
  const base = weak.length ? "정답률이 낮은 끝 확인 문제가 " + weak.length + "개 있어요." : "끝 확인 문제는 대체로 잘 맞혔어요.";
  const skipped = ex.length - voted.length;
  return skipped > 0 ? base + " 손들기를 안 한 문제는 " + skipped + "개예요." : base;
}

/* ─────────── 막대 한 줄 ─────────── */

function QRow({ q, pids }: { q: LessonLogQuestion; pids?: readonly string[] }) {
  const voted = hasVotes(q) && q.rate !== null;
  const total = q.counts.reduce((a, b) => a + b, 0);
  return (
    <li className="ll-q">
      <div className="ll-q-head">
        <b className="ll-q-name">{qName(q.id, pids)}</b>
        {q.exit ? <span className="ll-tag">끝 확인</span> : null}
        {voted ? (
          <span className="ll-q-rate num">
            정답률 {q.rate}% <span className="ll-q-sub">({q.counts[q.answer] || 0}/{total}명)</span>
          </span>
        ) : (
          <span className="ll-q-none">아직 손들기를 안 했어요</span>
        )}
      </div>
      {voted ? (
        <>
          <div className="ll-bar" role="img" aria-label={"정답률 " + q.rate + "%"}>
            <i style={{ width: q.rate + "%" }} />
          </div>
          <p className="ll-q-counts num">
            {q.counts.map((c, i) => (
              <span key={i} className={i === q.answer ? "is-ans" : ""}>
                {CHOICE_KEYS[i] || i + 1} {c}명{i === q.answer ? " (정답)" : ""}
              </span>
            ))}
          </p>
        </>
      ) : null}
    </li>
  );
}

/* ─────────── 카드 ─────────── */

export interface LessonLogCardProps {
  card: LessonLog;
  /** 레슨 이름(없으면 lid) */
  lessonTitle?: string;
  /** 레슨 연습 문제 id 순서(문제 번호를 쓰려고) */
  pids?: readonly string[];
}

/** 카드 본문(화면과 인쇄에 같이 써요) */
export function LessonLogSheet({ card, lessonTitle, pids }: LessonLogCardProps) {
  const exits = card.qs.filter((q) => q.exit && hasVotes(q) && q.rate !== null);
  const board = card.qs.filter((q) => !q.exit);
  const period = card.p >= 1 ? " " + card.p + "차시" : " 전체";
  return (
    <article className="ll-sheet" aria-label="오늘 기록 카드">
      <header className="ll-head">
        <p className="ll-kicker">수업 기록 카드</p>
        <h2 className="ll-title">
          <span className={card.klass ? "" : "is-none"}>{card.klass ? card.klass : "반을 고르지 않았어요"}</span>
          <span className="ll-date num"> · {card.date}</span>
        </h2>
        <p className="ll-lesson">
          {lessonTitle || card.lid}
          {period}
        </p>
      </header>

      <section className="ll-sec">
        <h3 className="ll-h">한 일</h3>
        <p className="ll-p">
          수업 장면 <b className="num">{card.scenesTotal}</b>개 가운데 <b className="num">{card.scenesDone}</b>개까지 했어요.
        </p>
      </section>

      <section className="ll-sec">
        <h3 className="ll-h">숙제</h3>
        <p className="ll-p ll-hw num">{hwLine(card, pids)}</p>
      </section>

      <section className="ll-sec">
        <h3 className="ll-h">문제별 손든 결과</h3>
        {board.length ? (
          <ul className="ll-qs">
            {board.map((q) => (
              <QRow key={q.id} q={q} pids={pids} />
            ))}
          </ul>
        ) : (
          <p className="ll-p ll-muted">칠판 문제에서 손들기를 한 기록이 없어요.</p>
        )}
      </section>

      <section className="ll-sec">
        <h3 className="ll-h">끝 확인</h3>
        <p className="ll-p">{exitLine(card)}</p>
        {exits.length ? (
          <ul className="ll-qs">
            {exits.map((q) => (
              <QRow key={q.id} q={q} pids={pids} />
            ))}
          </ul>
        ) : null}
      </section>

      <section className="ll-sec ll-next">
        <h3 className="ll-h">다음 시간 앞부분에 다시 볼 것</h3>
        <p className="ll-p ll-next-txt">{reviewLine(card, pids)}</p>
      </section>
      <p className="ll-foot">이 기기 안에만 남아요. 학생 이름은 들어 있지 않아요.</p>
    </article>
  );
}

/* ─────────── 복사 ─────────── */

type CopyState = "idle" | "ok" | "fail";

/** 클립보드에 써요. 막히면 false */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 아래 예전 방식으로 */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/* ─────────── 떠 있는 카드(복사·인쇄·닫기) ─────────── */

export interface LessonLogModalProps extends LessonLogCardProps {
  onClose: () => void;
  /** 열자마자 할 일 */
  auto?: "copy" | "print";
  /** 카드 아래 단추 옆에 더 넣을 것(예: 저장) */
  note?: string;
}

const NAV_KEYS = ["ArrowRight", "ArrowLeft", "PageDown", "PageUp", "Home", "End", " ", "Spacebar"];

export function LessonLogModal({ card, lessonTitle, pids, onClose, auto, note }: LessonLogModalProps) {
  const [copy, setCopy] = useState<CopyState>("idle");
  const closeRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  const text = useMemo(() => lessonLogText(card, pids || null), [card, pids]);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const doCopy = () => {
    void copyText(text).then((ok) => setCopy(ok ? "ok" : "fail"));
  };
  const doPrint = () => {
    try {
      window.print();
    } catch {
      /* 인쇄를 못 열면 그대로 */
    }
  };

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    if (closeRef.current) closeRef.current.focus();
    // 카드가 떠 있는 동안 칠판 넘김 키는 막고 Esc 는 닫아요(글상자에 글을 읽는 중에는 그대로 둬요)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Esc") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key === "Tab") {
        // 초점이 카드 밖으로 나가지 않게 카드 안 단추·글상자만 돌아요
        const dlg = dialogRef.current;
        if (dlg) {
          const els = Array.prototype.slice.call(dlg.querySelectorAll("button, textarea, [href]")).filter((x: HTMLElement) => !(x as HTMLButtonElement).disabled) as HTMLElement[];
          if (els.length) {
            const first = els[0];
            const last = els[els.length - 1];
            const cur = document.activeElement as HTMLElement | null;
            const inside = !!cur && dlg.contains(cur);
            if (e.shiftKey && (!inside || cur === first)) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && (!inside || cur === last)) {
              e.preventDefault();
              first.focus();
            }
          }
        }
        return;
      }
      const t = e.target as HTMLElement | null;
      const typing = !!t && t.tagName === "TEXTAREA";
      if (!typing && !e.altKey && !e.ctrlKey && !e.metaKey && NAV_KEYS.indexOf(e.key) >= 0) {
        const onBtn = !!t && t.tagName === "BUTTON";
        if (!(onBtn && (e.key === " " || e.key === "Spacebar"))) e.stopPropagation();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      if (prev && prev.focus) prev.focus();
    };
  }, []);

  // 본문이 더 있으면(아래로 스크롤할 수 있으면) 아래쪽에 '아래에 더 있어요' 표시를 둬요
  const checkMore = () => {
    const el = bodyRef.current;
    if (el) setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 8);
  };
  useEffect(() => {
    checkMore();
    const id = window.setTimeout(checkMore, 200);
    window.addEventListener("resize", checkMore);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("resize", checkMore);
    };
  }, []);

  useEffect(() => {
    if (auto === "copy") doCopy();
    else if (auto === "print") {
      const id = window.setTimeout(doPrint, 120);
      return () => window.clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (copy === "fail" && boxRef.current) {
      boxRef.current.focus();
      boxRef.current.select();
    }
    if (copy === "ok") {
      const id = window.setTimeout(() => setCopy("idle"), 2500);
      return () => window.clearTimeout(id);
    }
  }, [copy]);

  return createPortal(
    <div className="ll-root bd-noswipe">
      <div className="ll-scrim" onClick={onClose} aria-hidden="true" />
      <div className="ll-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-label="오늘 기록 카드">
        <div className="ll-bodywrap">
          <div className="ll-body" ref={bodyRef} onScroll={checkMore}>
            <LessonLogSheet card={card} lessonTitle={lessonTitle} pids={pids} />
          </div>
          {more ? (
            <div className="ll-more" aria-hidden="true">
              <span className="ll-more-pill">아래에 더 있어요 ▼</span>
            </div>
          ) : null}
        </div>
        {note ? <p className="ll-note">{note}</p> : null}
        <div className="ll-acts">
          <button type="button" className="btn btn-primary ll-btn" onClick={doCopy}>
            {copy === "ok" ? "복사했어요" : "복사"}
          </button>
          <button type="button" className="btn ll-btn" onClick={doPrint}>
            인쇄
          </button>
          <span className="ll-grow" />
          <button ref={closeRef} type="button" className="btn ll-btn" onClick={onClose}>
            닫기
          </button>
        </div>
        {copy === "fail" ? (
          <div className="ll-fallback">
            <p className="ll-fb-msg" role="status">
              복사가 막혔어요. 아래 글을 눌러 선택한 뒤 직접 복사해 주세요.
            </p>
            <textarea ref={boxRef} className="ll-fb-box" readOnly value={text} rows={8} onFocus={(e) => e.currentTarget.select()} />
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

/** 카드 한 장의 이름("2-3 · 2026-10-17 · Ⅰ-1 1차시") */
export function logLabel(card: Pick<LessonLog, "klass" | "date" | "lid" | "p">, lessonTitle?: string): string {
  return logTitle(card) + " · " + (lessonTitle || card.lid) + (card.p >= 1 ? " " + card.p + "차시" : "");
}
