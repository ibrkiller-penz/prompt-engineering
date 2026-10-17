// 학생 사이트(aimaths) 뿌리. 첫 화면은 학생 홈.
// 해시 라우터(src/shared/router)로 화면을 고르고, 단원 색 축(html[data-unit])을 맞춰요.
// 교사 화면·교사 자료는 이 빌드에 들어오지 않아요(@site 별칭이 src/student 를 가리켜요).
import { useEffect, type ReactNode } from "react";
import { STUDENT_ROUTES, type StudentRoute } from "../shared/contracts.ts";
import { useRoute, type RouteMatch } from "../shared/router/index.ts";
import { lessonMeta } from "../content/index.ts";
import Home from "./pages/Home.tsx";
import UnitPage from "./pages/Unit.tsx";
import LessonPage from "./pages/Lesson.tsx";
import CardsPage from "./pages/Cards.tsx";
import QuizPage from "./pages/Quiz.tsx";
import NotePage from "./pages/Note.tsx";
import ReviewPage from "./pages/Review.tsx";
import DictPage from "./pages/Dict.tsx";
import MePage from "./pages/Me.tsx";
import PrivacyPage from "./pages/Privacy.tsx";
import AnswerCardPage from "./pages/AnswerCard.tsx";
import NotFoundPage from "./pages/NotFound.tsx";

// 학생 화면 틀 스타일(이 폴더) + 학생 전용 스타일(디자인 담당, 파일이 아직 없으면 건너뛰어요)
import "./shell/shell.css";
import.meta.glob("./styles/student.css", { eager: true });

type Match = RouteMatch<typeof STUDENT_ROUTES>;

const PAGES: Record<StudentRoute, (m: Match) => ReactNode> = {
  home: () => <Home />,
  unit: (m) => <UnitPage n={m.params.n} query={m.query} />,
  lesson: (m) => <LessonPage lid={m.params.lid} query={m.query} />,
  card: (m) => <CardsPage lid={m.params.lid} step={m.params.step} card={m.params.card} />,
  quiz: (m) => <QuizPage key={"q" + m.params.lid + (m.query.set || "")} lid={m.params.lid} more={false} query={m.query} />,
  quizMore: (m) => <QuizPage key={"m" + m.params.lid} lid={m.params.lid} more query={m.query} />,
  note: (m) => <NotePage query={m.query} />,
  review: (m) => <ReviewPage query={m.query} />,
  dict: (m) => <DictPage query={m.query} />,
  me: () => <MePage />,
  privacy: () => <PrivacyPage />,
  answerCard: () => <AnswerCardPage />,
};

export default function App() {
  const m = useRoute(STUDENT_ROUTES);

  // 단원 색 축(data-unit): 레슨 화면은 그 레슨의 단원, 단원 화면은 그 단원
  const lid = m && m.params.lid;
  const n = m && m.name === "unit" ? m.params.n : undefined;
  useEffect(() => {
    const html = document.documentElement;
    const meta = lid ? lessonMeta(lid) : undefined;
    const unit = meta ? meta.unit : n ? Number(n) : 0;
    if (unit >= 1 && unit <= 5) html.setAttribute("data-unit", "u" + unit);
    else html.removeAttribute("data-unit");
  }, [lid, n]);

  // 학생 화면은 늘 휴대폰 표면(넓은 화면에서는 가운데 칸으로 보여요)
  useEffect(() => {
    document.documentElement.setAttribute("data-surface", "phone");
  }, []);

  // 화면(경로 이름)이 바뀌면 맨 위로
  const name = m ? m.name : "";
  const path = m ? m.path : "";
  useEffect(() => {
    if (name === "card" || name === "quiz" || name === "quizMore" || name === "review") return; // 카드 틀이 직접 맞춰요
    try {
      window.scrollTo(0, 0);
    } catch {
      /* 무시 */
    }
  }, [name, path]);

  return (
    <>
      <a className="skip-link" href="#main" onClick={(e) => skipToMain(e)}>
        본문으로 건너뛰기
      </a>
      {m ? PAGES[m.name](m) : <NotFoundPage />}
    </>
  );
}

/** 해시 라우터와 부딪히지 않게 '본문으로 건너뛰기'는 초점만 옮겨요 */
function skipToMain(e: { preventDefault: () => void }) {
  e.preventDefault();
  const el = document.getElementById("main");
  if (!el) return;
  if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
  el.focus();
}
