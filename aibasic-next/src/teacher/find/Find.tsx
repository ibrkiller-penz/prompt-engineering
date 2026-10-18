// 차시 찾기(#/find): units.json 순서 번호(Ⅰ-3) · 초성 검색 · 단원 칩 · 레슨 카드 격자 · 차시 시트.
// 주소: #/find?u=2&q=ㅂㅌ (단원 칩·검색어만, 개인 정보 없음)
import { useEffect, useMemo, useRef, useState } from "react";
import type { LessonIndex, TeacherData } from "../../shared/contracts.ts";
import { intParam, navigate } from "../../shared/router/index.ts";
import { chosungFilter } from "../../shared/logic/chosung.ts";
import { teacherStore, useStored } from "../../shared/storage/index.ts";
import { INDEX, lessonMeta, unitOf, useLesson } from "../../content/index.ts";
import { Rich } from "../../shared/widgets/kit.tsx";
import { TIcon } from "../../shared/icons/teacher.tsx";
import type { TeacherPageProps } from "../shell/pages.tsx";
import { useKlass, type ProgressMark } from "../shell/klass.tsx";
import { boardHref, cleanDuration, computePlan, todayHref, type Duration } from "../shell/plan.ts";
import { Skeleton, reloadPage } from "../flow/Skeleton.tsx";

const MARK_LABEL: Record<ProgressMark, string> = { done: "끝", part: "진행 중" };

/** 검색에 쓰는 글자들(앞일수록 먼저): 제목 · 짧은 제목 · 번호 · 핵심 질문 · 소제목 */
function keysOf(l: LessonIndex): string[] {
  return [l.title, l.short, l.code, l.subtitle || "", l.question, l.sections.map((s) => s.heading).join(" ")];
}

function plain(s: string): string {
  return s.replace(/\$[^$]*\$/g, "").replace(/\*\*/g, "");
}

/* ─────────── 레슨 카드 ─────────── */

function LessonCard({ l, mark, onOpen }: { l: LessonIndex; mark: ProgressMark | undefined; onOpen: (lid: string, el: HTMLElement) => void }) {
  const nQ = l.qids.length;
  const nW = l.widgetIds.length;
  return (
    <li className={"t-lcard-wrap t-u" + l.unit}>
      <button type="button" className="card t-lcard" onClick={(e) => onOpen(l.id, e.currentTarget)} aria-haspopup="dialog">
        <span className="t-lcard-top">
          <span className="t-lcard-code">{l.code}</span>
          {mark ? <span className={"chip " + (mark === "done" ? "is-ok" : "is-warn")}>{mark === "done" ? "✓ 끝" : "◐ 진행 중"}</span> : null}
        </span>
        <span className="t-lcard-title">{l.title}</span>
        <span className="t-lcard-short">{l.short}</span>
        <span className="t-lcard-meta">
          약 {l.minutes}분 · 소제목 {l.sections.length} · 문제 {nQ}
          {nW ? " · 체험 " + nW : ""}
        </span>
      </button>
    </li>
  );
}

/* ─────────── 차시 시트 ─────────── */

function LessonSheet({ lid, onClose }: { lid: string; onClose: () => void }) {
  const meta = lessonMeta(lid) as LessonIndex;
  const unit = unitOf(lid);
  const [durRaw, setDur] = useStored(teacherStore, "duration", 45 as Duration);
  const dur = cleanDuration(durRaw);
  const [flowSt] = useStored(teacherStore, "flow", {} as TeacherData["flow"]);
  const [pickSt] = useStored(teacherStore, "pick", {} as TeacherData["pick"]);
  const { klass, progress, markLesson } = useKlass();
  const mark = klass && progress[klass] ? progress[klass][lid] : undefined;
  const { data: lesson, error, loading } = useLesson(lid);
  const closeRef = useRef<HTMLButtonElement>(null);

  const plans = useMemo(() => {
    if (!lesson) return null;
    try {
      const first = computePlan(lesson, dur, 1, flowSt, pickSt);
      return first.periods.map((pp) => (pp.p === 1 ? first : computePlan(lesson, dur, pp.p, flowSt, pickSt)));
    } catch (e) {
      console.error(e);
      return null;
    }
  }, [lesson, dur, flowSt, pickSt]);

  useEffect(() => {
    if (closeRef.current) closeRef.current.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className={"sheet t-lsheet t-u" + meta.unit} role="dialog" aria-modal="true" aria-labelledby="t-lsheet-h">
        <div className="row between nowrap t-lsheet-head">
          <div className="grow stack tight">
            <p className="eyebrow">
              {meta.code}
              {unit ? " · " + unit.title : ""}
            </p>
            <h2 className="h2" id="t-lsheet-h">
              {meta.title}
            </h2>
          </div>
          <button ref={closeRef} type="button" className="btn btn-ghost" onClick={onClose}>
            닫기
          </button>
        </div>

        <div className="stack">
          <p className="t-question">
            <span className="t-q-tag">핵심 질문</span> <Rich text={meta.question} />
          </p>

          <div className="row t-chips t-sheet-opts" role="group" aria-label="수업 시간">
            <span className="t-set-label">수업 시간</span>
            {[45, 50, 70].map((d) => (
              <button key={d} type="button" className="btn t-dur" aria-pressed={dur === d} onClick={() => setDur(d as Duration)}>
                {d}분
              </button>
            ))}
          </div>

          {klass ? (
            <div className="row t-chips t-sheet-opts" role="group" aria-label={"이 반(" + klass + "반) 진도에 기록하기"}>
              <span className="t-set-label">이 반 진도에 기록하기 · {klass}반</span>
              <button type="button" className="btn t-dur" aria-pressed={!mark} onClick={() => markLesson(klass, lid, null)}>
                아직
              </button>
              {(["part", "done"] as ProgressMark[]).map((m) => (
                <button key={m} type="button" className="btn t-dur" aria-pressed={mark === m} onClick={() => markLesson(klass, lid, m)}>
                  {MARK_LABEL[m]}
                </button>
              ))}
            </div>
          ) : null}

          {loading ? <Skeleton label="차시를 나누는 중이에요…" rows={3} /> : null}
          {error ? (
            <div className="callout bad" role="alert">
              <p>
                <b>레슨을 불러오지 못했어요.</b>
              </p>
              <button type="button" className="btn btn-primary" onClick={reloadPage}>
                다시 불러오기
              </button>
            </div>
          ) : null}

          {plans ? (
            <ol className="t-periods">
              {plans.map((v) => {
                const per = v.periods[v.p - 1];
                const first = v.on.length ? v.on[0].s : 0;
                return (
                  <li key={v.p} className="card t-period">
                    <div className="row between">
                      <h3 className="h3">
                        {plans.length > 1 ? v.p + "차시" : "한 차시"}
                        <span className="muted small"> · 장면 {v.on.length}개 · 예상 {Math.round(v.total)}분</span>
                      </h3>
                    </div>
                    <ul className="t-secs">
                      {per
                        ? per.sections.map((si) => (
                            <li key={si}>
                              <Rich text={meta.sections[si] ? meta.sections[si].heading : ""} />
                            </li>
                          ))
                        : null}
                    </ul>
                    <div className="row wrap t-period-acts">
                      <a className="btn btn-primary" href={todayHref(lid, v.p)} onClick={onClose}>
                        오늘 수업으로
                      </a>
                      <a className="btn" href={boardHref(lid, v.p, first)}>
                        <TIcon name="play" size="em" />
                        <span>바로 칠판</span>
                      </a>
                      <a className="btn" href={"#/flow/" + lid + "?p=" + v.p}>
                        수업 흐름
                      </a>
                      <a className="btn" href={"#/pick/" + lid + "?p=" + v.p}>
                        문제 고르기
                      </a>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : null}

          <div className="row wrap">
            <a className="btn" href={"#/prep/" + lid}>
              <TIcon name="flag" size="em" />
              <span>준비 한 장 · 정답</span>
            </a>
            <a className="btn" href={"#/print/" + lid}>
              <TIcon name="print" size="em" />
              <span>학습지 인쇄</span>
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─────────── 차시 찾기 ─────────── */

export default function Find({ query }: TeacherPageProps) {
  const [q, setQ] = useState(query.q || "");
  const u = intParam(query.u, 0, 0, INDEX.units.length + 1);
  const unitOk = u && INDEX.units.some((x) => x.id === u) ? u : 0;
  const [open, setOpen] = useState<string | null>(query.lid && lessonMeta(query.lid) ? query.lid : null);
  const opener = useRef<HTMLElement | null>(null);
  const { klass, progress } = useKlass();
  const row = klass ? progress[klass] || {} : {};

  // 검색어는 잠깐 뒤에 주소에 남겨요(뒤로 가기로 돌아와도 그대로)
  useEffect(() => {
    const t = window.setTimeout(() => {
      if ((query.q || "") !== q) navigate("/find", { u: unitOk || undefined, q: q || undefined }, { replace: true });
    }, 400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const all = useMemo(() => INDEX.order.map((id) => INDEX.lessons[id]), []);
  const list = useMemo(() => {
    const byUnit = unitOk ? all.filter((l) => l.unit === unitOk) : all;
    return q.trim() ? chosungFilter(byUnit, q, (l) => keysOf(l).map(plain)) : byUnit;
  }, [all, unitOk, q]);

  const close = useMemo(
    () => () => {
      setOpen(null);
      const el = opener.current;
      if (el && el.focus) el.focus();
    },
    [],
  );
  const openSheet = (lid: string, el: HTMLElement) => {
    opener.current = el;
    setOpen(lid);
  };

  const setUnit = (n: number) => navigate("/find", { u: n || undefined, q: q || undefined }, { replace: true });
  const searching = !!q.trim();

  return (
    <div className="page stack-lg t-find">
      <header className="stack tight">
        <p className="eyebrow">교사용 · 차시 찾기</p>
        <h1 className="h1">차시 찾기</h1>
        <p className="muted">레슨을 누르면 차시 나눔과 바로 가기가 나와요. 초성으로도 찾아요(예: ㅂㅌ → 벡터).</p>
      </header>

      <div className="t-find-tools stack">
        <div className="t-search">
          <label className="sr-only" htmlFor="t-find-q">
            레슨 찾기
          </label>
          <TIcon name="search" />
          <input
            id="t-find-q"
            className="input"
            type="search"
            value={q}
            placeholder="제목·용어·초성으로 찾기"
            autoComplete="off"
            onChange={(e) => setQ(e.target.value)}
          />
          {q ? (
            <button type="button" className="btn btn-ghost" onClick={() => setQ("")}>
              지우기
            </button>
          ) : null}
        </div>
        <div className="row t-chips" role="group" aria-label="단원 고르기">
          <button type="button" className="btn t-dur t-unit-chip" aria-pressed={!unitOk} onClick={() => setUnit(0)}>
            전체
          </button>
          {INDEX.units.map((x) => (
            <button key={x.id} type="button" className={"btn t-dur t-unit-chip t-u" + x.id} aria-pressed={unitOk === x.id} onClick={() => setUnit(x.id)}>
              {x.roman} {x.title}
            </button>
          ))}
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        레슨 {list.length}개
      </p>

      {list.length === 0 ? (
        <div className="card empty">
          <p>'{q}'에 맞는 레슨이 없어요. 다른 낱말이나 초성으로 찾아봐요.</p>
        </div>
      ) : searching ? (
        <ul className="t-lgrid">
          {list.map((l) => (
            <LessonCard key={l.id} l={l} mark={row[l.id]} onOpen={openSheet} />
          ))}
        </ul>
      ) : (
        INDEX.units
          .filter((x) => !unitOk || x.id === unitOk)
          .map((x) => (
            <section key={x.id} className={"stack t-u" + x.id} aria-labelledby={"t-unit-" + x.id}>
              <h2 className="h2 unit-bar t-unit-h" id={"t-unit-" + x.id}>
                <span className="t-unit-roman">{x.roman}</span> {x.title}
              </h2>
              <ul className="t-lgrid">
                {x.lessonIds.map((id) => (
                  <LessonCard key={id} l={INDEX.lessons[id]} mark={row[id]} onOpen={openSheet} />
                ))}
              </ul>
            </section>
          ))
      )}

      {open && lessonMeta(open) ? <LessonSheet lid={open} onClose={close} /> : null}
    </div>
  );
}
