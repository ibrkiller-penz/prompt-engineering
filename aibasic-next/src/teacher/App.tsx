// 교사 사이트(aibasict) 뿌리. 첫 화면은 '오늘 수업'(#/).
//  - 준비 화면(data-surface="prep"): 사이트 띠 + '교사용' 이름표 + 탭 + 반 고르기 칩(src/teacher/shell)
//  - 칠판 무대(#/board/…, data-surface="board"): 틀 없이 화면 전체, 핀치 확대 막기
//  - 다른 담당 화면은 src/teacher/<폴더>/index.tsx 의 default 를 따로 불러와요(shell/pages.tsx 의 약속)
// 교사 화면은 학습 기록(aibn:s1:)을 쓰지 않아요.
import { useEffect, type ReactNode } from "react";
import { TEACHER_ROUTES, type TeacherRoute } from "../shared/contracts.ts";
import { useRoute } from "../shared/router/index.ts";
import { lessonMeta } from "../content/index.ts";
import { SITE_NAME } from "../site.ts";
import { mountTeacherIcons } from "../shared/icons/teacher.tsx";
import { markTeacher } from "./mark.ts";
import { TeacherShell } from "./shell/Shell.tsx";
import { KlassProvider } from "./shell/klass.tsx";
import { useTeacherPrefs } from "./shell/prefs.ts";
import { hasPage, RoutedPage, type TeacherPageProps } from "./shell/pages.tsx";
import { NotFound } from "./shell/Fallbacks.tsx";
import Privacy from "./shell/Privacy.tsx";
import Today from "./today/index.tsx";
import Find from "./find/index.tsx";

// 교사 전용 스타일. 공용(src/styles)은 main.tsx 가 먼저 불러요.
// styles/ 는 칠판·인쇄 담당 파일(아직 없으면 건너뛰어요), shell·today·find 는 이 담당 파일이에요.
import.meta.glob("./styles/teacher.css", { eager: true });
import "./shell/shell.css";
import "./today/today.css";
import "./find/find.css";
import.meta.glob("./styles/board.css", { eager: true });
import.meta.glob("./styles/print.css", { eager: true });
import "./styles/frev.css";

markTeacher();
mountTeacherIcons();

const BOARD_ROUTES: TeacherRoute[] = ["board", "boardQ", "boardTool", "boardEnd"];

const VIEWPORT_NORMAL = "width=device-width, initial-scale=1, viewport-fit=cover";
const VIEWPORT_BOARD = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";

const TITLES: Partial<Record<TeacherRoute, string>> = {
  today: "오늘 수업",
  find: "차시 찾기",
  flow: "수업 흐름",
  pick: "문제 고르기",
  prep: "준비 한 장",
  print: "학습지 인쇄",
  progress: "반별 진도",
  results: "손들기 결과",
  unitTest: "단원 평가",
  privacy: "저장 내용 안내",
  board: "칠판 수업",
  boardQ: "칠판 문제",
  boardTool: "칠판 체험 도구",
  boardEnd: "수업 끝",
};

/** 이 담당이 직접 그리는 화면. 나머지는 shell/pages.tsx 가 따로 불러와요 */
const OWN: Partial<Record<TeacherRoute, (m: TeacherPageProps) => ReactNode>> = {
  today: (m) => <Today {...m} />,
  find: (m) => <Find {...m} />,
};

function body(m: TeacherPageProps | null): ReactNode {
  if (!m) return <NotFound />;
  const own = OWN[m.name];
  if (own) return own(m);
  // 저장 내용 안내: privacy/ 화면이 따로 생기기 전까지는 틀의 기본 안내
  if (m.name === "privacy" && !hasPage("privacy")) return <Privacy />;
  return <RoutedPage m={m} />;
}

export default function App() {
  const m = useRoute(TEACHER_ROUTES) as TeacherPageProps | null;
  const name = m ? m.name : null;
  const isBoard = !!name && BOARD_ROUTES.indexOf(name) >= 0;
  const lid = m && m.params.lid ? m.params.lid : null;
  // 설정이 바뀌면 html 속성에 반영(공용 prefs 훅이 해요). 첫 반영은 main.tsx 가 그리기 전에 해요
  useTeacherPrefs();

  // 표면(prep/board)과 칠판에서만 핀치 확대 막기
  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute("data-surface", isBoard ? "board" : "prep");
    const vp = document.querySelector('meta[name="viewport"]');
    if (vp) vp.setAttribute("content", isBoard ? VIEWPORT_BOARD : VIEWPORT_NORMAL);
  }, [isBoard]);

  // 화면 이름(인쇄·스타일용)과 문서 제목
  useEffect(() => {
    const html = document.documentElement;
    if (name) html.setAttribute("data-page", name);
    else html.removeAttribute("data-page");
    const meta = lid ? lessonMeta(lid) : undefined;
    const parts = [name ? TITLES[name] || "" : "찾는 화면이 없어요"];
    if (meta) parts.unshift(meta.code + " " + meta.title);
    try {
      document.title = parts.filter(Boolean).join(" · ") + " — " + SITE_NAME;
    } catch {
      /* 무시 */
    }
  }, [name, lid]);

  // 단원 색 축
  useEffect(() => {
    const html = document.documentElement;
    const meta = lid ? lessonMeta(lid) : undefined;
    if (meta) html.setAttribute("data-unit", "u" + meta.unit);
    else html.removeAttribute("data-unit");
  }, [lid]);

  return (
    <KlassProvider>
      {isBoard ? (
        <main id="main" className="t-board-root">
          {body(m)}
        </main>
      ) : (
        <TeacherShell route={name}>{body(m)}</TeacherShell>
      )}
    </KlassProvider>
  );
}
