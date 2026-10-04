import type { TeacherGuideFile, StoryFile, CardsFile, GlossaryFile, LabScenario, Lesson, Level, LevelMeta, PledgeFile, Rules } from "./types";
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

const cardFiles = import.meta.glob<CardsFile>("../../content/prompt/*/cards.json", { eager: true, import: "default" });
const glossaryFiles = import.meta.glob<GlossaryFile>("../../content/prompt/*/glossary.json", {
  eager: true,
  import: "default",
});
const pledgeFiles = import.meta.glob<PledgeFile>("../../content/prompt/*/pledge.json", { eager: true, import: "default" });

const storyFiles = import.meta.glob<StoryFile>("../../content/prompt/stories/lesson-*.json", {
  eager: true,
  import: "default",
});
export const getStory = (n: number) => Object.values(storyFiles).find((s) => s.lesson === n);

const guideFiles = import.meta.glob<TeacherGuideFile>("../../content/prompt/*/teacher-guide.json", {
  eager: true,
  import: "default",
});
export const getTeacherGuide = (level: Level) => Object.values(guideFiles).find((g) => g.level === level);

export const getCards = (level: Level) => Object.values(cardFiles).find((c) => c.level === level);
export const getGlossary = (level: Level) => Object.values(glossaryFiles).find((c) => c.level === level);
export const getPledge = (level: Level) => Object.values(pledgeFiles).find((c) => c.level === level);

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
