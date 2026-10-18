// 내 기록(#/me): 진행률 · 단원별 레슨 상태 · 기록 파일 저장/불러오기 · 읽기 설정 · 기록 지우기
// 기록은 이 기기의 브라우저에만 있어요. 다른 기기로 옮기려면 기록 파일로 저장해 불러와요.
import { useRef, useState } from "react";
import { STUDENT_ROUTES } from "../../shared/contracts.ts";
import { href } from "../../shared/router/index.ts";
import { INDEX } from "../../content/index.ts";
import { Icon, UnitIcon } from "../../shared/icons/index.ts";
import { PrefsPanel, ProgressBar } from "../../shared/ui/index.ts";
import { Screen, useDocTitle } from "../shell/Shell.tsx";
import { MASTERY_LABEL, exportBackup, importBackup, masteryOf, overall, resetAll, unitStatusOf, useQ, useRead, useTools } from "../store/index.ts";
import { pct } from "./student.logic.ts";

function download(name: string, text: string): boolean {
  try {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      if (a.parentNode) a.parentNode.removeChild(a);
    }, 1000);
    return true;
  } catch {
    return false;
  }
}

export default function MePage() {
  useDocTitle("내 기록");
  const q = useQ();
  const read = useRead();
  const tools = useTools();
  const sum = overall(INDEX.lessons, INDEX.order, q, read);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const toolDone = Object.keys(tools).filter((k) => {
    const t = (tools as Record<string, { done: boolean } | undefined>)[k];
    return !!t && t.done;
  }).length;

  const onSave = () => {
    const b = exportBackup();
    setMsg(download(b.name, b.text) ? { ok: true, text: "기록 파일(" + b.name + ")을 저장했어요. 다른 기기에서 '불러오기'로 이어서 할 수 있어요." } : { ok: false, text: "이 브라우저에서는 파일을 저장하지 못했어요." });
  };
  const onFile = (f: File | undefined) => {
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      setMsg({ ok: false, text: "파일이 너무 커요. 이 사이트에서 저장한 기록 파일인지 확인해 주세요." });
      return;
    }
    const r = new FileReader();
    r.onload = () => {
      const res = importBackup(String(r.result || ""));
      if (res.ok) setMsg({ ok: true, text: "기록을 불러왔어요(문제 기록 " + res.questions + "개). 지금 기록이 파일 내용으로 바뀌었어요." });
      else setMsg({ ok: false, text: res.reason || "기록 파일을 읽지 못했어요." });
      if (fileRef.current) fileRef.current.value = "";
    };
    r.onerror = () => setMsg({ ok: false, text: "파일을 읽지 못했어요." });
    r.readAsText(f);
  };

  return (
    <Screen title="내 기록" noBack tab="me">
      <div className="page stack-lg">
        <section className="card" aria-labelledby="h-sum">
          <h2 id="h-sum" className="h3">
            전체 진행
          </h2>
          <ProgressBar value={sum.complete} max={sum.lessons} label={"레슨 " + sum.lessons + "개 중 " + sum.complete + "개 완료"} showText />
          <div className="s-stats">
            <p>
              <span className="bignum s-stat">{pct(sum.complete, sum.lessons)}%</span>
              <span className="tiny muted s-block">끝낸 레슨</span>
            </p>
            <p>
              <span className="bignum s-stat">{sum.ok}</span>
              <span className="tiny muted s-block">맞힌 문제</span>
            </p>
            <p>
              <span className="bignum s-stat">{toolDone}</span>
              <span className="tiny muted s-block">체험 미션 완료</span>
            </p>
          </div>
        </section>

        <section aria-labelledby="h-units">
          <h2 id="h-units" className="section-title">
            단원별 레슨
          </h2>
          <div className="stack">
            {INDEX.units.map((u) => {
              const st = unitStatusOf(u.id, q, read);
              return (
                <details key={u.id} className="card s-me-unit" data-unit={u.slug}>
                  <summary className="row nowrap">
                    <UnitIcon unit={u.id} badge />
                    <span className="grow">
                      <strong>
                        {u.roman}. {u.title}
                      </strong>
                      <span className="tiny muted s-block">
                        레슨 {st ? st.done : 0}/{u.lessonIds.length} 완료 · 진행 {st ? st.percent : 0}%
                      </span>
                    </span>
                  </summary>
                  <ul className="list">
                    {u.lessonIds.map((lid) => {
                      const m = INDEX.lessons[lid];
                      const ms = masteryOf(lid, q, read);
                      return (
                        <li key={lid}>
                          <a className="list-row" href={href(STUDENT_ROUTES.lesson, { lid })}>
                            <span className="grow small">
                              {m.code} {m.title}
                            </span>
                            <span className={"chip" + (ms >= 2 ? " is-ok" : ms === 1 ? " is-warn" : "")}>
                              {ms >= 2 ? "✓ " : ""}
                              {MASTERY_LABEL[ms]}
                            </span>
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              );
            })}
          </div>
        </section>

        <section className="card stack" aria-labelledby="h-file">
          <h2 id="h-file" className="h3">
            기록 파일
          </h2>
          <p className="small">기록은 이 기기의 브라우저에만 있어요. 기기를 바꾸거나 브라우저 기록을 지우기 전에 파일로 저장해 두면 안심이에요.</p>
          <div className="row wrap">
            <button type="button" className="btn" onClick={onSave}>
              <Icon name="download" />
              <span>기록 파일 저장</span>
            </button>
            <button type="button" className="btn" onClick={() => fileRef.current && fileRef.current.click()}>
              <Icon name="upload" />
              <span>기록 불러오기</span>
            </button>
            <input ref={fileRef} type="file" accept=".json,application/json" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => onFile(e.target.files ? e.target.files[0] : undefined)} />
          </div>
          {msg ? (
            <p className={"verdict " + (msg.ok ? "ok" : "bad")} role="status">
              {msg.text}
            </p>
          ) : null}
        </section>

        <section className="card" aria-labelledby="h-prefs">
          <h2 id="h-prefs" className="h3">
            읽기 설정
          </h2>
          <PrefsPanel />
        </section>

        <section className="card stack" aria-labelledby="h-reset">
          <h2 id="h-reset" className="h3">
            기록 지우기
          </h2>
          <p className="small">이 기기에 남은 학습 기록과 설정을 모두 지워요. 되돌릴 수 없어요.</p>
          {!confirm ? (
            <button type="button" className="btn btn-danger" onClick={() => setConfirm(true)}>
              기록 모두 지우기
            </button>
          ) : (
            <div className="row wrap" role="group" aria-label="정말 지울까요?">
              <span className="small">정말 지울까요?</span>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  resetAll();
                  setConfirm(false);
                  setMsg({ ok: true, text: "기록을 모두 지웠어요." });
                }}
              >
                네, 지워요
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirm(false)}>
                그만두기
              </button>
            </div>
          )}
        </section>

        <nav className="stack tight s-me-links" aria-label="더 보기">
          <a className="list-row" href={href(STUDENT_ROUTES.privacy)}>
            <Icon name="lock" />
            <span className="grow">저장 내용 안내</span>
            <Icon name="next" />
          </a>
          <a className="list-row" href={href(STUDENT_ROUTES.answerCard)}>
            <Icon name="badge" />
            <span className="grow">응답 카드(수업 중 손들기)</span>
            <Icon name="next" />
          </a>
        </nav>
      </div>
    </Screen>
  );
}
