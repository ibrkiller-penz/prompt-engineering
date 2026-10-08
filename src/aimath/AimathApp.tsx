import { Route, Routes } from "react-router-dom";
import Layout from "./Layout";
import Glossary from "./pages/Glossary";
import Home from "./pages/Home";
import LessonPage from "./pages/LessonPage";
import Notebook from "./pages/Notebook";
import TestPage from "./pages/TestPage";
import UnitPage from "./pages/UnitPage";

export default function AimathApp() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="glossary" element={<Glossary />} />
        <Route path="notebook" element={<Notebook />} />
        <Route path=":unit" element={<UnitPage />} />
        <Route path=":unit/test" element={<TestPage />} />
        <Route path=":unit/:lesson" element={<LessonPage />} />
        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
  );
}
