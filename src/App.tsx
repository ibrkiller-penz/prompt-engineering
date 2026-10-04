import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import Hub from "./pages/Hub";
import CourseHome from "./pages/prompt/CourseHome";
import LevelHome from "./pages/prompt/LevelHome";
import LessonPage from "./pages/prompt/LessonPage";
import LabPage from "./pages/prompt/LabPage";
import About from "./pages/prompt/About";
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
      <Route path="/prompt" element={<PromptLayout />}>
        <Route index element={<CourseHome />} />
        <Route path="about" element={<About />} />
        <Route path=":level" element={<LevelHome />} />
        <Route path=":level/lesson/:n" element={<LessonPage />} />
        <Route path=":level/lab" element={<LabPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
