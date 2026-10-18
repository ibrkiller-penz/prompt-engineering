// 교사 준비 화면 틀: 사이트 띠(주황갈색) + '교사용' 이름표 + 상단 탭(넓은 화면) / 하단 탭(좁은 화면) + 반 고르기 칩 + 화면 설정.
// 메뉴줄 한 줄: [이름][오늘 수업 · 차시 찾기 · 반별 진도 · 손들기 결과][반 칩(오른쪽)][화면 설정]. 차시를 고르는 곳은 '차시 찾기' 하나예요.
// 칠판 무대(#/board/…)는 이 틀 없이 화면 전체를 써요.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { TeacherRoute } from "../../shared/contracts.ts";
import { TIcon } from "../../shared/icons/teacher.tsx";
import type { AnyIconName } from "../../shared/icons/names.ts";
import { STUDENT_URL } from "../../site.ts";
import { KLASS_MAX, useKlass } from "./klass.tsx";
import { FS_LABELS, THEME_OPTIONS, stepFs, useTeacherPrefs } from "./prefs.ts";

interface Tab {
  key: string;
  label: string;
  href: string;
  icon: AnyIconName;
  routes: TeacherRoute[];
}

export const TABS: Tab[] = [
  { key: "today", label: "오늘 수업", href: "#/", icon: "home", routes: ["today"] },
  { key: "find", label: "차시 찾기", href: "#/find", icon: "search", routes: ["find", "flow", "pick", "prep", "print", "unitTest"] },
  { key: "progress", label: "반별 진도", href: "#/progress", icon: "progress", routes: ["progress"] },
  { key: "results", label: "손들기 결과", href: "#/results", icon: "group", routes: ["results"] },
];

function tabOf(route: TeacherRoute | null): string | null {
  if (!route) return null;
  for (const t of TABS) if (t.routes.indexOf(route) >= 0) return t.key;
  return null;
}

/* ─────────── 반 고르기 칩 ─────────── */

export function KlassChips({ compact }: { compact?: boolean }) {
  const { klass, classes, setKlass, addKlass } = useKlass();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding && inputRef.current) inputRef.current.focus();
  }, [adding]);

  const submit = () => {
    if (classes.length >= KLASS_MAX) {
      setErr("반은 " + KLASS_MAX + "개까지 넣을 수 있어요.");
      return;
    }
    const ok = addKlass(name);
    if (!ok) {
      setErr("반 이름은 '2-3'처럼 숫자·글자 10자 안으로 적어요.");
      return;
    }
    setName("");
    setErr("");
    setAdding(false);
  };

  return (
    <div className={"t-klass" + (compact ? " is-compact" : "")} role="group" aria-label="반 고르기">
      <span className="t-klass-label">반</span>
      <div className="t-klass-chips">
        {classes.map((c) => (
          <button key={c} type="button" className="chip" aria-pressed={c === klass} onClick={() => setKlass(c)}>
            {c}
          </button>
        ))}
        {adding ? (
          <form
            className="t-klass-add"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <label className="sr-only" htmlFor="t-klass-name">
              새 반 이름
            </label>
            <input
              id="t-klass-name"
              ref={inputRef}
              className="input"
              value={name}
              maxLength={10}
              placeholder="예: 2-3"
              autoComplete="off"
              aria-describedby="t-klass-help"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setAdding(false);
                  setErr("");
                }
              }}
            />
            <button type="submit" className="btn btn-soft">
              넣기
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setAdding(false);
                setErr("");
              }}
            >
              그만
            </button>
          </form>
        ) : (
          <button type="button" className="chip t-klass-plus" onClick={() => setAdding(true)}>
            + 반 추가
          </button>
        )}
      </div>
      {adding ? (
        <p id="t-klass-help" className={"t-klass-help" + (err ? " is-bad" : "")} role={err ? "alert" : undefined}>
          {err || "반 이름만 적어요. 학생 이름은 적지 않아요."}
        </p>
      ) : null}
    </div>
  );
}

/* ─────────── 화면 설정 시트 ─────────── */

function SettingsSheet({ onClose }: { onClose: () => void }) {
  const [prefs, patch] = useTeacherPrefs();
  const { classes, removeKlass } = useKlass();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    if (closeRef.current) closeRef.current.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (prev && prev.focus) prev.focus();
    };
  }, [onClose]);

  const removeAsk = (c: string) => {
    let ok = true;
    try {
      ok = window.confirm("'" + c + "' 반과 그 반의 진도 표시를 지울까요?");
    } catch {
      ok = true;
    }
    if (ok) removeKlass(c);
  };

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet t-settings" role="dialog" aria-modal="true" aria-labelledby="t-settings-title">
        <div className="row between nowrap">
          <h2 id="t-settings-title" className="h3">
            화면 설정
          </h2>
          <button ref={closeRef} type="button" className="btn btn-ghost" onClick={onClose}>
            닫기
          </button>
        </div>

        <div className="stack loose">
          <div className="stack tight">
            <p className="t-set-label">글자 크기</p>
            <div className="row">
              <button type="button" className="btn" onClick={() => patch({ fs: stepFs(prefs.fs, -1) })} disabled={prefs.fs <= 0} aria-label="글자 작게">
                A−
              </button>
              <span className="t-set-val num" aria-live="polite">
                {FS_LABELS[prefs.fs]}
              </span>
              <button type="button" className="btn" onClick={() => patch({ fs: stepFs(prefs.fs, 1) })} disabled={prefs.fs >= 3} aria-label="글자 크게">
                A+
              </button>
            </div>
          </div>

          <div className="stack tight">
            <p className="t-set-label" id="t-theme-label">
              화면 색
            </p>
            <div className="row wrap" role="radiogroup" aria-labelledby="t-theme-label">
              {THEME_OPTIONS.map((o) => (
                <button key={o.value} type="button" role="radio" aria-checked={prefs.theme === o.value} aria-pressed={prefs.theme === o.value} className="btn" onClick={() => patch({ theme: o.value })}>
                  {o.label}
                </button>
              ))}
            </div>
            <p className="tiny muted">'칠판'은 눈부심을 줄인 짙은 초록 바탕이에요. 전자칠판이 너무 밝을 때 써 보세요.</p>
          </div>

          <div className="stack tight">
            <label className="switch">
              <input type="checkbox" checked={prefs.motion === "reduce"} onChange={(e) => patch({ motion: e.target.checked ? "reduce" : "auto" })} />
              <span>움직임 줄이기</span>
            </label>
            <label className="switch">
              <input type="checkbox" checked={prefs.contrast} onChange={(e) => patch({ contrast: e.target.checked })} />
              <span>글자 대비 높이기</span>
            </label>
          </div>

          {classes.length ? (
            <div className="stack tight">
              <p className="t-set-label">반 관리</p>
              <ul className="list">
                {classes.map((c) => (
                  <li key={c} className="list-row">
                    <span className="grow">{c}</span>
                    <button type="button" className="btn btn-ghost" onClick={() => removeAsk(c)}>
                      지우기
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="row wrap">
            <a className="btn" href="#/privacy" onClick={onClose}>
              저장 내용 안내
            </a>
            <a className="btn" href={STUDENT_URL + "/"} target="_blank" rel="noopener noreferrer">
              학생 사이트 열기
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─────────── 틀 ─────────── */

export function TeacherShell({ route, children }: { route: TeacherRoute | null; children: ReactNode }) {
  const [settings, setSettings] = useState(false);
  const closeSettings = useCallback(() => setSettings(false), []);
  const active = tabOf(route);
  const mainRef = useRef<HTMLElement>(null);

  // 화면이 바뀌면 맨 위로(해시 라우터라 브라우저가 해 주지 않아요)
  useEffect(() => {
    try {
      window.scrollTo(0, 0);
    } catch {
      /* 무시 */
    }
  }, [route]);

  const skip = (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (mainRef.current) mainRef.current.focus();
  };

  return (
    <div className="t-app">
      <a className="skip-link" href="#/" onClick={skip}>
        본문으로 건너뛰기
      </a>
      <div className="site-band" />
      <header className="t-head no-print">
        <div className="t-head-row">
          <a className="t-brand" href="#/" aria-label="인공지능 기초 교사용, 오늘 수업으로">
            <span className="t-flag" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="t-brand-name">인공지능 기초</span>
            <span className="site-tag">교사용</span>
          </a>
          <nav className="t-tabs" aria-label="교사 화면">
            {TABS.map((t, i) => (
              <a key={t.key} className="t-tab" href={t.href} aria-current={active === t.key ? "page" : undefined}>
                <span className="t-tab-n num" aria-hidden="true">
                  {i + 1}
                </span>
                <span>{t.label}</span>
              </a>
            ))}
          </nav>
          <KlassChips compact={true} />
          <button type="button" className="btn btn-ghost t-gear" onClick={() => setSettings(true)} aria-haspopup="dialog">
            <TIcon name="gear" size="em" />
            <span>화면 설정</span>
          </button>
        </div>
      </header>

      <main id="main" ref={mainRef} tabIndex={-1} className="t-main">
        {children}
      </main>

      <nav className="tabbar t-tabbar no-print" aria-label="교사 화면">
        {TABS.map((t) => (
          <a key={t.key} href={t.href} aria-current={active === t.key ? "page" : undefined}>
            <TIcon name={t.icon} />
            <span>{t.label}</span>
          </a>
        ))}
      </nav>

      {settings ? <SettingsSheet onClose={closeSettings} /> : null}
    </div>
  );
}
