// 진입점. @site 별칭이 빌드 모드에 따라 학생(src/student) 또는 교사(src/teacher) 앱을 가리켜요.
import { Component, StrictMode, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "@site/App";
import { DEFAULT_PREFS, type Prefs, type Theme } from "./shared/contracts.ts";
import { studentStore, teacherStore } from "./shared/storage/index.ts";
import { DEFAULT_SURFACE, IS_TEACHER, SITE } from "./site.ts";

// 공용 스타일(src/styles). 파일이 아직 없으면 건너뛰어요. 순서: 토큰 → 바탕 → 부품 → 시각 → 움직임
import.meta.glob("./styles/tokens.css", { eager: true });
import.meta.glob("./styles/base.css", { eager: true });
import.meta.glob("./styles/components.css", { eager: true });
import.meta.glob("./styles/visual.css", { eager: true });
import.meta.glob("./styles/motion.css", { eager: true });

const html = document.documentElement;

/** 저장된 읽기 설정을 html 속성에 반영해요(첫 그림 전에) */
function applyBootPrefs() {
  const p: Prefs = IS_TEACHER ? teacherStore.read("prefs", DEFAULT_PREFS) : studentStore.read("prefs", DEFAULT_PREFS);
  const fs = p && typeof p.fs === "number" && p.fs >= 0 && p.fs <= 3 ? p.fs : DEFAULT_PREFS.fs;
  let theme: Theme = "light";
  const pref = p && p.theme ? p.theme : "auto";
  if (pref === "auto") {
    try {
      theme = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } catch {
      theme = "light";
    }
  } else if (pref === "chalk" && !IS_TEACHER) theme = "dark"; // 칠판 테마는 교사만
  else theme = pref;
  html.setAttribute("data-site", SITE);
  if (!html.getAttribute("data-surface")) html.setAttribute("data-surface", DEFAULT_SURFACE);
  html.setAttribute("data-fs", String(fs));
  html.setAttribute("data-theme", theme);
  if (p && p.contrast) html.setAttribute("data-contrast", "more");
  else html.removeAttribute("data-contrast");
}
applyBootPrefs();

// 키보드로 움직일 때만 초점 테두리를 보여요(:focus-visible 대신 html.kbd :focus)
window.addEventListener(
  "keydown",
  (e) => {
    if (e.key === "Tab" || e.key.indexOf("Arrow") === 0) html.classList.add("kbd");
  },
  true,
);
window.addEventListener("pointerdown", () => html.classList.remove("kbd"), true);

class Guard extends Component<{ children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) {
    return { err };
  }
  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error(err, info.componentStack);
  }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div role="alert" style={{ padding: 24, maxWidth: 560, margin: "40px auto", lineHeight: 1.6 }}>
        <h1 style={{ fontSize: 22 }}>화면을 그리다가 문제가 생겼어요.</h1>
        <p>새로고침하면 대부분 다시 보여요. 공부한 기록은 이 기기에 그대로 남아 있어요.</p>
        <p>
          <button type="button" onClick={() => window.location.reload()} style={{ minHeight: 44, padding: "0 16px" }}>
            새로고침
          </button>{" "}
          <a href="#/" onClick={() => this.setState({ err: null })} style={{ display: "inline-block", minHeight: 44, lineHeight: "44px", padding: "0 12px" }}>
            첫 화면으로
          </a>
        </p>
      </div>
    );
  }
}

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <Guard>
        <App />
      </Guard>
    </StrictMode>,
  );
}
