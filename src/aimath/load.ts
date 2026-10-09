import unitsJson from "../../content/aimath/units.json";
import type { Lesson, UnitContent, UnitMeta } from "./types";

const lessonFiles = import.meta.glob<Lesson>("../../content/aimath/*/lesson-*.json", { eager: true, import: "default" });
const unitFiles = import.meta.glob<UnitContent>("../../content/aimath/*/unit.json", { eager: true, import: "default" });

export const UNITS = unitsJson as UnitMeta[];

export const unitBySlug = (slug: string | undefined) => UNITS.find((u) => u.slug === slug);
export const unitContent = (id: number) => Object.values(unitFiles).find((u) => u.id === id);
export const getLesson = (id: string) => Object.values(lessonFiles).find((l) => l.id === id);
export const lessonsOf = (unit: UnitMeta) =>
  unit.lessons.map((m) => ({ meta: m, data: getLesson(m.id) }));
export const allLessons = () => Object.values(lessonFiles).sort((a, b) => a.unit - b.unit || a.order - b.order);

/** 레슨 id → 단원 */
export const unitOfLesson = (id: string) => UNITS.find((u) => u.lessons.some((l) => l.id === id));

/** 용어 사전용: 모든 레슨의 용어 카드 + 개념 속 term 블록(같은 용어는 먼저 나온 것) */
export function allTerms() {
  const seen = new Set<string>();
  const out: { term: string; def: string; lesson: string; unit: number }[] = [];
  for (const l of allLessons()) {
    const push = (term: string, def: string) => {
      const key = term.trim();
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push({ term: key, def, lesson: l.id, unit: l.unit });
    };
    l.terms.forEach((t) => push(t.term, t.def));
    l.sections.forEach((s) => s.blocks.forEach((b) => b.t === "term" && push(b.term, b.def)));
  }
  return out.sort((a, b) => a.term.localeCompare(b.term, "ko"));
}

/** 문제 id 로 문제와 소속 찾기(오답노트용) */
export function findQuestion(qid: string) {
  for (const l of allLessons()) {
    const q = l.practice.find((x) => x.id === qid);
    if (q) return { q, lessonId: l.id, unit: l.unit, where: l.title };
  }
  for (const u of Object.values(unitFiles)) {
    const q = u.test.find((x) => x.id === qid);
    if (q) return { q, lessonId: `test-${u.id}`, unit: u.id, where: "대단원 마무리" };
  }
  return undefined;
}
