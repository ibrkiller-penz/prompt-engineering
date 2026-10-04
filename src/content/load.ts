import type { LabScenario, Lesson, Level, LevelMeta, Rules } from "./types";
import levelsJson from "../../content/prompt/levels.json";
import vague from "../../content/prompt/rules/vague.json";
import elements from "../../content/prompt/rules/elements.json";
import privacy from "../../content/prompt/rules/privacy.json";

const lessonFiles = import.meta.glob<Lesson>("../../content/prompt/*/lesson-*.json", {
  eager: true,
  import: "default",
});
const labFiles = import.meta.glob<LabScenario>("../../content/prompt/lab/*/*.json", {
  eager: true,
  import: "default",
});

export const LEVELS = levelsJson as LevelMeta[];
export const LEVEL_IDS: Level[] = ["elementary", "middle", "high"];

export const rules = { vague, elements, privacy } as unknown as Rules;

export function isLevel(v: string | undefined): v is Level {
  return !!v && (LEVEL_IDS as string[]).includes(v);
}

export function levelMeta(level: Level): LevelMeta {
  return LEVELS.find((l) => l.id === level)!;
}

export function getLesson(level: Level, n: number): Lesson | undefined {
  return Object.values(lessonFiles).find((l) => l.level === level && l.lesson === n);
}

export function availableLessons(level: Level): number[] {
  return Object.values(lessonFiles)
    .filter((l) => l.level === level)
    .map((l) => l.lesson)
    .sort((a, b) => a - b);
}

export function labScenarios(level: Level): LabScenario[] {
  return Object.values(labFiles).filter((s) => s.level === level);
}
