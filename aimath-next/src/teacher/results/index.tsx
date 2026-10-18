// 손들기 결과(#/results): 칠판 한 문제 모드에서 센 '보기별 손든 수'를 문제마다 막대로 보여요.
// 막대는 색 + 빗금(정답이 아닌 칸) + 글자(명·%)로 구분해요. 숫자만 aimn:t1:results 에 있어요(이름 없음).
import type { Lesson, LessonLog } from "../../shared/contracts.ts";
import { TEACHER_ROUTES } from "../../shared/contracts.ts";
import { href } from "../../shared/router/index.ts";
import { Rich } from "../../shared/ui/index.ts";
import { INDEX, lessonMeta, useLesson } from "../../content/index.ts";
import { useState } from "react";
import type { TeacherPageProps } from "../shell/pages.tsx";
import { TEACHER_MARK } from "../mark.ts";
import { isLessonLog } from "../logic/lessonlog.logic.ts";
import { tallyAnswer, tallyLabels } from "../board/board.logic.ts";
import { barPcts, correctRate, splitResultKey, sum, useLessonLogs, useResults } from "../store/index.ts";
import { sortKlasses } from "../shell/klass.tsx";
import { LessonLogModal, logLabel } from "../board/LessonLogCard.tsx";
import "./results.css";

export const RESULTS_MARK = TEACHER_MARK;

type Entry = { key: string; qid: string; counts: number[]; ts: number };

function clip(s: string, n: number): string {
  const t = (s || "").replace(/\n/g, " ");
  if (t.length <= n) return t;
  let cut = t.slice(0, n);
  if ((cut.match(/\$/g) || []).length % 2 === 1) cut = cut.slice(0, cut.lastIndexOf("$"));
  return cut + "…";
}

function dateLabel(ts: number): string {
  try {
    const d = new Date(ts);
    return d.getMonth() + 1 + "월 " + d.getDate() + "일 " + d.getHours() + ":" + ("0" + d.getMinutes()).slice(-2);
  } catch {
    return "";
  }
}

function ask(msg: string): boolean {
  try {
    return window.confirm(msg);
  } catch {
    return true;
  }
}

function LessonResults({ lid, entries, onClear }: { lid: string; entries: Entry[]; onClear: (keys: string[]) => void }) {
  const { data: lesson } = useLesson(lid);
  const meta = lessonMeta(lid);
  return (
    <section className={"card t-res-lesson t-u" + (meta ? meta.unit : 1)} aria-labelledby={"t-res-" + lid}>
      <div className="row between">
        <h2 className="h3" id={"t-res-" + lid}>
          <span className="unit-dot" aria-hidden="true" /> {meta ? meta.code + " " + meta.title : lid}
        </h2>
        <button type="button" className="btn btn-ghost" onClick={() => ask("이 레슨의 손들기 결과를 지울까요?") && onClear(entries.map((e) => e.key))}>
          이 레슨 지우기
        </button>
      </div>
      <ol className="t-res-list">
        {entries.map((e) => (
          <ResultRow key={e.key} lid={lid} lesson={lesson} e={e} onClear={() => onClear([e.key])} />
        ))}
      </ol>
    </section>
  );
}

function ResultRow({ lid, lesson, e, onClear }: { lid: string; lesson: Lesson | undefined; e: Entry; onClear: () => void }) {
  const q = lesson ? lesson.practice.filter((x) => x.id === e.qid)[0] : undefined;
  const labels = q ? tallyLabels(q) : e.counts.map((_, i) => String(i + 1));
  const ans = q ? tallyAnswer(q) : -1;
  const n = Math.max(labels.length, e.counts.length);
  const counts: number[] = [];
  for (let i = 0; i < n; i++) counts.push(e.counts[i] || 0);
  const pcts = barPcts(counts);
  const total = sum(counts);
  const rate = ans >= 0 ? correctRate(counts, ans) : null;
  return (
    <li className="t-res-row">
      <div className="t-res-q">
        <p className="t-res-prompt">{q ? <Rich text={clip(q.prompt, 110)} /> : <span className="muted">문제를 불러오는 중이에요…</span>}</p>
        <p className="small muted">
          손든 학생 <b className="num">{total}</b>명{rate != null ? " · 정답 칸 " + rate + "%" : ""} · {dateLabel(e.ts)}
        </p>
      </div>
      <ul className="t-res-bars" aria-label="보기별 손든 수">
        {counts.map((c, i) => {
          const isAns = i === ans;
          const pct = total ? Math.round((c / total) * 100) : 0;
          return (
            <li key={i} className={"t-res-bar-row" + (isAns ? " is-ans" : "")}>
              <span className="t-res-label">
                {labels[i] || i + 1}
                {isAns ? <span className="t-res-ok"> ✓ 정답</span> : null}
              </span>
              <span className="t-res-track" aria-hidden="true">
                <span className={"t-res-bar" + (isAns ? " is-ans" : "")} style={{ width: Math.max(pcts[i], c ? 3 : 0) + "%" }} />
              </span>
              <span className="t-res-val num">
                {c}명 <span className="muted">({pct}%)</span>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="t-res-acts">
        <a className="btn btn-soft" href={href(TEACHER_ROUTES.boardQ, { lid, qid: e.qid }, {})}>
          칠판에 다시 띄우기
        </a>
        <button type="button" className="btn btn-ghost" onClick={onClear}>
          지우기
        </button>
      </div>
    </li>
  );
}


/* ─────────── 저장된 수업 기록 카드 ─────────── */

/** 반 이름 차례(자연스러운 순서, 반이 없는 카드는 맨 뒤) → 날짜 최신 순 → 차시 */
function sortLogs(map: Record<string, LessonLog>): { key: string; card: LessonLog }[] {
  const rows = Object.keys(map)
    .filter((k) => isLessonLog(map[k]))
    .map((k) => ({ key: k, card: map[k] }));
  const names = sortKlasses(rows.map((r) => r.card.klass || "").filter((n, i, a) => !!n && a.indexOf(n) === i));
  const rank = (k: string) => (k ? names.indexOf(k) : names.length);
  return rows.sort((a, b) => rank(a.card.klass) - rank(b.card.klass) || (a.card.date < b.card.date ? 1 : a.card.date > b.card.date ? -1 : 0) || a.card.p - b.card.p);
}

function LogModalFor({ card, auto, onClose }: { card: LessonLog; auto?: "copy" | "print"; onClose: () => void }) {
  const { data: lesson } = useLesson(card.lid);
  const meta = lessonMeta(card.lid);
  return <LessonLogModal card={card} auto={auto} lessonTitle={meta ? meta.code + " " + meta.title : card.lid} pids={lesson ? lesson.practice.map((q) => q.id) : undefined} onClose={onClose} />;
}

function LogList({ logs, remove }: { logs: Record<string, LessonLog>; remove: (key: string) => void }) {
  const rows = sortLogs(logs);
  const [view, setView] = useState<{ key: string; auto?: "copy" | "print" } | null>(null);
  const [ask, setAsk] = useState<string | null>(null);
  const cur = view ? logs[view.key] : null;
  return (
    <section className="card t-res-lesson t-res-logs" aria-labelledby="t-res-logs-h">
      <h2 className="h3" id="t-res-logs-h">
        수업 기록 카드
      </h2>
      <p className="small muted">칠판 수업 끝에서 '수업 마치기'를 누르면 반별로 한 장씩 남아요. 최근 60개까지 이 기기에만 저장하고, 학생 이름은 넣지 않아요.</p>
      {rows.length ? (
        <ul className="t-res-loglist">
          {rows.map(({ key, card }) => {
            const meta = lessonMeta(card.lid);
            const voted = card.qs.filter((q) => q.rate !== null).length;
            return (
              <li key={key} className="t-res-logrow">
                <div className="t-res-logname">
                  <b>{logLabel(card, meta ? meta.code + " " + meta.title : undefined)}</b>
                  <span className="small muted">
                    {" "}
                    · 손들기 한 문제 <span className="num">{voted}</span>개 · 숙제 <span className="num">{card.hw.length}</span>문제
                  </span>
                </div>
                <div className="t-res-acts">
                  <button type="button" className="btn btn-soft" onClick={() => setView({ key })}>
                    다시 보기
                  </button>
                  <button type="button" className="btn" onClick={() => setView({ key, auto: "copy" })}>
                    복사
                  </button>
                  <button type="button" className="btn" onClick={() => setView({ key, auto: "print" })}>
                    인쇄
                  </button>
                  {ask === key ? (
                    <>
                      <span className="small t-res-sure">이 카드를 지울까요?</span>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => {
                          remove(key);
                          setAsk(null);
                        }}
                      >
                        지워요
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={() => setAsk(null)}>
                        안 지워요
                      </button>
                    </>
                  ) : (
                    <button type="button" className="btn btn-ghost" onClick={() => setAsk(key)}>
                      지우기
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted">아직 저장된 카드가 없어요. 칠판 수업 끝 화면에서 '오늘 기록 카드'를 열어 보고 '수업 마치기'를 누르면 남아요.</p>
      )}
      {view && cur ? <LogModalFor key={view.key + (view.auto || "")} card={cur} auto={view.auto} onClose={() => setView(null)} /> : null}
    </section>
  );
}

export default function ResultsPage(_m: TeacherPageProps) {
  const [all, update] = useResults();
  const [logs, , removeLog] = useLessonLogs();
  const byLesson: Record<string, Entry[]> = {};
  for (const key of Object.keys(all)) {
    const k = splitResultKey(key);
    const v = all[key];
    if (!k || !v || !Array.isArray(v.counts)) continue;
    (byLesson[k.lid] = byLesson[k.lid] || []).push({ key, qid: k.qid, counts: v.counts, ts: v.ts || 0 });
  }
  const lids = INDEX.order.filter((id) => byLesson[id]).concat(Object.keys(byLesson).filter((id) => INDEX.order.indexOf(id) < 0));
  for (const id of lids) byLesson[id].sort((a, b) => b.ts - a.ts);

  const clear = (keys: string[]) =>
    update((m) => {
      for (const k of keys) delete m[k];
      return m;
    });

  return (
    <div className="page t-res">
      <header className="t-res-head">
        <p className="eyebrow">교사용 · 손들기 결과</p>
        <h1 className="h1">손들기 결과</h1>
        <p className="muted">칠판 문제에서 보기마다 손든 학생 수를 센 결과예요. 숫자만 이 기기에 남고, 이름은 저장하지 않아요.</p>
      </header>
      <LogList logs={logs} remove={removeLog} />
      {!lids.length ? (
        <section className="card empty stack">
          <p>아직 센 결과가 없어요.</p>
          <p className="small muted">칠판 문제 화면에서 보기 옆 '✋ 0명' 단추를 누르면 한 명씩 세져요. 길게 누르면 한 명 빼요.</p>
        </section>
      ) : (
        <>
          {lids.map((lid) => (
            <LessonResults key={lid} lid={lid} entries={byLesson[lid]} onClear={clear} />
          ))}
          <p>
            <button type="button" className="btn btn-ghost" onClick={() => ask("손들기 결과를 모두 지울까요?") && update(() => ({}))}>
              결과 모두 지우기
            </button>
          </p>
        </>
      )}
    </div>
  );
}
