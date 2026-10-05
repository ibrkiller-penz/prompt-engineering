import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import Hub from "./pages/Hub";
import SetupPage from "./pages/SetupPage";
import CourseHome from "./pages/prompt/CourseHome";
import LevelHome from "./pages/prompt/LevelHome";
import LessonPage from "./pages/prompt/LessonPage";
import LabPage from "./pages/prompt/LabPage";
import About from "./pages/prompt/About";
import { CardsPage, GlossaryPage, PledgePage } from "./pages/prompt/Appendix";
import PrintPage from "./pages/prompt/PrintPage";
import { TeacherHome, TeacherLesson } from "./pages/prompt/Teacher";
import EssayPage from "./pages/prompt/EssayPage";
import NotFound from "./pages/NotFound";
import PromptLayout from "./components/PromptLayout";

export default function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <Routes>
      <Route path="/" element={<Hub />} />
      <Route path="/setup" element={<SetupPage />} />
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
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function ProjectRedirect() {
  const { level } = useParams();
  return <Navigate to={`/prompt/${level}/lesson/13`} replace />;
}
