// 문제 고르기(#/pick/:lid?p=): 거르기 칩 + 바구니 3개(칠판 · 끝 확인 · 숙제) + 학생 링크 미리 보기·복사.
// 한 문제는 바구니 하나에만 들어가요. 처음에는 자동 제안이 담겨 있고, 고치면 aibn:t1:pick 에 저장해요.
// 학생 링크에는 문제 id 만 들어가요(반·이름 없음).
import { useState } from "react";
import type { Question } from "../../shared/contracts.ts";
import { TEACHER_ROUTES } from "../../shared/contracts.ts";
import { href, intParam } from "../../shared/router/index.ts";
import { Rich, TYPE_LABEL, answerText } from "../../shared/ui/index.ts";
import { TIcon } from "../../shared/icons/teacher.tsx";
import { lessonMeta, useLesson } from "../../content/index.ts";
import { STUDENT_URL } from "../../site.ts";
import type { TeacherPageProps } from "../shell/pages.tsx";
import { Loading, NotFound } from "../shell/Fallbacks.tsx";
import { boardHref, todayHref, useLessonPlan } from "../shell/plan.ts";
import { homeworkFromOff, qKind, questionSections, studentLink, type QKind } from "../logic/index.ts";
import { TEACHER_MARK } from "../mark.ts";
import {
  BASKETS,
  BASKET_LABEL,
  BASKET_MAX,
  basketOf,
  clonePick,
  homeworkWith,
  moveItem,
  toggleBasket,
  useDuration,
  useFlowMap,
  usePickMap,
  usePickState,
  type Basket,
  type PickState,
} from "../store/index.ts";
import "./pick.css";

export const PICK_MARK = TEACHER_MARK;

const KIND_LABEL: Record<QKind, string> = { check: "개념 확인", basic: "기초", easy: "쉬운 응용", adv: "실력 UP", chal: "도전" };
const KINDS: QKind[] = ["check", "basic", "easy", "adv", "chal"];
type TypeF = "all" | Question["type"];

function clip(s: string, n: number): string {
  const t = (s || "").replace(/\n/g, " ");
  if (t.length <= n) return t;
  let cut = t.slice(0, n);
  if ((cut.match(/\$/g) || []).length % 2 === 1) cut = cut.slice(0, cut.lastIndexOf("$"));
  return cut + "…";
}

function copyText(text: string): Promise<boolean> {
  try {
    const nav = navigator as Navigator & { clipboard?: { writeText(t: string): Promise<void> } };
    if (nav.clipboard && nav.clipboard.writeText) return nav.clipboard.writeText(text).then(() => true, () => fallbackCopy(text));
  } catch {
    /* 아래로 */
  }
  return Promise.resolve(fallbackCopy(text));
}
function fallbackCopy(text: string): boolean {
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

export default function PickPage(m: TeacherPageProps) {
  const lid = m.params.lid || "";
  const meta = lessonMeta(lid);
  const pq = intParam(m.query.p, 1, 1, 20);
  const { data: lesson, loading, error } = useLesson(meta ? lid : null);
  const [minutes] = useDuration();
  const flowMap = useFlowMap();
  const pickMap = usePickMap();
  const view = useLessonPlan(lesson, minutes, pq, flowMap, pickMap);
  const p = view ? view.p : pq;
  const [saved, write] = usePickState(lid, p);
  const [kinds, setKinds] = useState<QKind[]>([]);
  const [type, setType] = useState<TypeF>("all");
  const [onlyHere, setOnlyHere] = useState(false);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  if (!meta) return <NotFound />;
  if (loading) return <Loading label="문제를 불러오고 있어요…" />;
  if (error || !lesson || !view) {
    return (
      <section className="page">
        <p className="callout bad" role="alert">
          레슨을 불러오지 못했어요. 새로고침해 보세요.
        </p>
      </section>
    );
  }

  const auto: PickState = { board: view.flow.pick.board.slice(), exit: view.flow.pick.exit.slice(), hw: view.flow.pick.hw.slice() };
  const cur: PickState = saved ? clonePick(saved) : auto;
  const qById: Record<string, Question> = {};
  for (const q of lesson.practice) qById[q.id] = q;
  const secOf = questionSections(lesson);
  const per = view.periods[view.p - 1];
  const here = (q: Question) => !per || secOf[q.id] === -1 || per.sections.indexOf(secOf[q.id]) >= 0;

  const list = lesson.practice.filter((q) => {
    if (kinds.length && kinds.indexOf(qKind(q)) < 0) return false;
    if (type !== "all" && q.type !== type) return false;
    if (onlyHere && !here(q)) return false;
    return true;
  });

  const put = (b: Basket, id: string) => {
    const r = toggleBasket(cur, b, id);
    if (!r.ok) {
      setMsg(BASKET_LABEL[b] + " 바구니는 " + BASKET_MAX[b] + "문제까지 담을 수 있어요.");
      return;
    }
    setMsg("");
    write(r.pick);
  };
  const move = (b: Basket, i: number, d: -1 | 1) => write({ ...cur, [b]: moveItem(cur[b], i, d) });

  // 꺼진 칠판 문제는 숙제로(흐름 화면에서 끈 것)
  const offHw = homeworkFromOff(view.scenes).filter((id) => cur.board.indexOf(id) < 0);
  const hwAll = homeworkWith(cur.hw, offHw, cur.exit);
  const link = studentLink(STUDENT_URL, lid, { hw: hwAll, ex: cur.exit });
  const firstS = view.on.length ? view.on[0].s : 0;

  const toggleKind = (k: QKind) => setKinds((ks) => (ks.indexOf(k) >= 0 ? ks.filter((x) => x !== k) : ks.concat([k])));

  return (
    <div className={"page t-pick t-u" + meta.unit}>
      <header className="t-pick-head">
        <p className="eyebrow">
          {meta.code} · 문제 고르기{view.periods.length > 1 ? " · " + view.p + "/" + view.periods.length + "차시" : ""}
        </p>
        <h1 className="h1">{lesson.title}</h1>
        <p className="muted">문제마다 칠판·끝 확인·숙제 가운데 하나에 담아요. 다시 누르면 빠져요.</p>
      </header>

      <div className="t-pick-grid">
        <section className="t-pick-list" aria-label="문제 목록">
          <div className="t-filters card">
            <div className="row wrap" role="group" aria-label="문제 갈래">
              <button type="button" className="chip" aria-pressed={!kinds.length} onClick={() => setKinds([])}>
                모두
              </button>
              {KINDS.map((k) => (
                <button key={k} type="button" className="chip" aria-pressed={kinds.indexOf(k) >= 0} onClick={() => toggleKind(k)}>
                  {KIND_LABEL[k]}
                </button>
              ))}
            </div>
            <div className="row wrap" role="group" aria-label="문제 꼴">
              {(["all", "choice", "ox", "number", "open"] as TypeF[]).map((t) => (
                <button key={t} type="button" className="chip" aria-pressed={type === t} onClick={() => setType(t)}>
                  {t === "all" ? "모든 꼴" : TYPE_LABEL[t]}
                </button>
              ))}
              {view.periods.length > 1 ? (
                <button type="button" className="chip" aria-pressed={onlyHere} onClick={() => setOnlyHere(!onlyHere)}>
                  이 차시 소제목만
                </button>
              ) : null}
            </div>
            <p className="tiny muted">
              {list.length} / {lesson.practice.length}문제
            </p>
          </div>

          <ol className="t-q-rows">
            {list.map((q) => {
              const inB = basketOf(cur, q.id);
              const isOpen = open === q.id;
              return (
                <li key={q.id} className={"t-q-row" + (inB ? " in-" + inB : "")}>
                  <div className="t-q-top">
                    <span className="chip">{KIND_LABEL[qKind(q)]}</span>
                    <span className="chip">{TYPE_LABEL[q.type]}</span>
                    <span className="t-q-lv" role="img" aria-label={"난이도 " + q.level}>
                      {"★★★★★".slice(0, q.level)}
                    </span>
                    <span className="tiny muted t-q-id">{q.id.replace(lid + "-", "")}</span>
                  </div>
                  <button type="button" className="t-q-prompt" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : q.id)}>
                    <Rich text={isOpen ? q.prompt : clip(q.prompt, 90)} />
                  </button>
                  {isOpen ? (
                    <div className="t-q-more small">
                      {q.type === "choice" ? (
                        <ol className="t-q-choices">
                          {q.choices.map((c, i) => (
                            <li key={i}>
                              <Rich text={c} />
                            </li>
                          ))}
                        </ol>
                      ) : null}
                      <p>
                        <b>정답</b> <Rich text={answerText(q)} />
                      </p>
                    </div>
                  ) : null}
                  <div className="t-q-bask" role="group" aria-label="바구니에 담기">
                    {BASKETS.map((b) => (
                      <button key={b} type="button" className={"btn t-bk is-" + b} aria-pressed={inB === b} onClick={() => put(b, q.id)} disabled={b === "board" && q.type === "open"}>
                        {inB === b ? "✓ " : "+ "}
                        {BASKET_LABEL[b]}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ol>
          {!list.length ? <p className="muted">조건에 맞는 문제가 없어요.</p> : null}
        </section>

        <aside className="t-baskets" aria-label="바구니">
          {msg ? (
            <p className="callout warn small" role="alert">
              {msg}
            </p>
          ) : null}
          {BASKETS.map((b) => (
            <section key={b} className={"card t-basket is-" + b} aria-labelledby={"t-bk-" + b}>
              <h2 className="h3" id={"t-bk-" + b}>
                {BASKET_LABEL[b]} <span className="num muted">{cur[b].length}/{BASKET_MAX[b]}</span>
              </h2>
              {b === "board" && (cur.board.length < 5 || cur.board.length > 8) ? <p className="tiny t-warn">칠판 문제는 5~8개가 알맞아요.</p> : null}
              {cur[b].length ? (
                <ol className="t-bk-list">
                  {cur[b].map((id, i) => {
                    const q = qById[id];
                    return (
                      <li key={id}>
                        <span className="t-bk-n num">{i + 1}</span>
                        <span className="t-bk-txt small">{q ? <Rich text={clip(q.prompt, 40)} /> : id}</span>
                        <span className="t-bk-ctl">
                          <button type="button" className="btn btn-icon" onClick={() => move(b, i, -1)} disabled={i === 0} aria-label="앞으로">
                            ↑
                          </button>
                          <button type="button" className="btn btn-icon" onClick={() => move(b, i, 1)} disabled={i === cur[b].length - 1} aria-label="뒤로">
                            ↓
                          </button>
                          <button type="button" className="btn btn-icon btn-ghost" onClick={() => put(b, id)} aria-label="빼기">
                            ✕
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="small muted">비어 있어요.</p>
              )}
              {b === "hw" && offHw.length ? <p className="tiny muted">흐름에서 끈 칠판 문제 {offHw.length}개도 숙제로 함께 가요.</p> : null}
            </section>
          ))}

          <section className="card t-link" aria-labelledby="t-link-h">
            <h2 className="h3" id="t-link-h">
              학생 링크 미리 보기
            </h2>
            <p className="t-link-url num">{link}</p>
            <p className="tiny muted">문제 번호만 들어 있어요. 수업 끝 화면의 QR 도 이 주소예요.</p>
            <div className="row wrap">
              <button
                type="button"
                className="btn btn-soft"
                onClick={() => {
                  void copyText(link).then((ok) => setMsg(ok ? "학생 링크를 복사했어요." : "복사하지 못했어요. 주소를 길게 눌러 복사해 주세요."));
                }}
              >
                <TIcon name="link" size="em" />
                <span>링크 복사</span>
              </button>
              <a className="btn btn-ghost" href={link} target="_blank" rel="noopener noreferrer">
                학생 화면 열기
              </a>
            </div>
          </section>

          <div className="row wrap t-pick-acts">
            <button type="button" className="btn btn-ghost" onClick={() => write(null)} disabled={!saved}>
              처음 제안으로
            </button>
            <a className="btn" href={href(TEACHER_ROUTES.flow, { lid }, { p: view.p })}>
              수업 흐름
            </a>
            <a className="btn" href={todayHref(lid, view.p)}>
              오늘 수업으로
            </a>
            <a className="btn btn-primary" href={boardHref(lid, view.p, firstS)}>
              칠판 수업 시작
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
}
