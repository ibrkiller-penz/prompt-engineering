import { Suspense, lazy, useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import Hub from "./pages/Hub";
import SetupPage from "./pages/SetupPage";
import SlidesPage from "./pages/SlidesPage";
import NotebookHome from "./pages/NotebookHome";
import NotebookCases from "./pages/NotebookCases";
import CourseHome from "./pages/prompt/CourseHome";
import LevelHome from "./pages/prompt/LevelHome";
import LessonPage from "./pages/prompt/LessonPage";
import LabPage from "./pages/prompt/LabPage";
import About from "./pages/prompt/About";
import { CardsPage, GlossaryPage, PledgePage } from "./pages/prompt/Appendix";
import PrintPage from "./pages/prompt/PrintPage";
import { TeacherHome, TeacherLesson } from "./pages/prompt/Teacher";
import EssayPage from "./pages/prompt/EssayPage";
import BoardLayout from "./pages/board/BoardLayout";
import BoardHome from "./pages/board/BoardHome";
import BoardBuy from "./pages/board/Buy";
import BoardPc from "./pages/board/PcSetup";
import BoardFlash from "./pages/board/Flash";
import BoardData from "./pages/board/MyData";
import BoardShake from "./pages/board/Shake";
import BoardHelp from "./pages/board/Help";
import BoardBrief from "./pages/board/Brief";
import NotFound from "./pages/NotFound";
import PromptLayout from "./components/PromptLayout";

const AimathApp = lazy(() => import("./aimath/AimathApp"));

export default function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <Routes>
      <Route path="/" element={<Hub />} />
      <Route path="/setup" element={<SetupPage />} />
      <Route path="/notebook" element={<NotebookHome />} />
      <Route path="/notebook/slides" element={<SlidesPage />} />
      <Route path="/notebook/cases" element={<NotebookCases />} />
      {/* 예전 주소(/slides)로 공유한 링크도 그대로 열리게 새 주소로 보낸다 */}
      <Route path="/slides" element={<SlidesRedirect />} />
      <Route path="/prompt/print" element={<PrintPage />} />
      <Route path="/prompt" element={<PromptLayout />}>
        <Route index element={<CourseHome />} />
        <Route path="about" element={<About />} />
        <Route path="essay" element={<EssayPage />} />
        <Route path=":level" element={<LevelHome />} />
        <Route path=":level/lesson/:n" element={<LessonPage />} />
        <Route path=":level/lab" element={<LabPage />} />
        <Route path=":level/cards" element={<CardsPage />} />
        <Route path=":level/glossary" element={<GlossaryPage />} />
        <Route path=":level/pledge" element={<PledgePage />} />
        <Route path=":level/project" element={<ProjectRedirect />} />
        <Route path=":level/teacher" element={<TeacherHome />} />
        <Route path=":level/teacher/:n" element={<TeacherLesson />} />
        <Route path="teacher" element={<Navigate to="/prompt/middle/teacher" replace />} />
      </Route>
      <Route path="/board" element={<BoardLayout />}>
        <Route index element={<BoardHome />} />
        <Route path="buy" element={<BoardBuy />} />
        <Route path="pc" element={<BoardPc />} />
        <Route path="flash" element={<BoardFlash />} />
        <Route path="data" element={<BoardData />} />
        <Route path="shake" element={<BoardShake />} />
        <Route path="help" element={<BoardHelp />} />
        <Route path="brief" element={<BoardBrief />} />
      </Route>
      <Route
        path="/aimath/*"
        element={
          <Suspense fallback={<p className="p-8 text-center text-muted">불러오는 중…</p>}>
            <AimathApp />
          </Suspense>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function SlidesRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/notebook/slides${search}`} replace />;
}

function ProjectRedirect() {
  const { level } = useParams();
  return <Navigate to={`/prompt/${level}/lesson/13`} replace />;
}
