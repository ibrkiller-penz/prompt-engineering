// 시험용: 원본 콘텐츠(/content/aimath)를 읽기만 해요(고치지 않음).
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const CONTENT_DIR = join(here, "..", "..", "..", "content", "aimath");

export interface RawLesson {
  id: string;
  story: string[];
  sections: { heading: string; blocks: any[] }[];
  practice: any[];
}

export function loadLessons(): { file: string; lesson: RawLesson }[] {
  const out: { file: string; lesson: RawLesson }[] = [];
  for (const u of readdirSync(CONTENT_DIR).filter((d) => /^u\d+$/.test(d)).sort()) {
    for (const f of readdirSync(join(CONTENT_DIR, u)).filter((f) => /^lesson-\d+\.json$/.test(f)).sort()) {
      out.push({ file: u + "/" + f, lesson: JSON.parse(readFileSync(join(CONTENT_DIR, u, f), "utf8")) });
    }
  }
  return out;
}

export function loadUnits(): { file: string; unit: { test: any[] } }[] {
  const out: { file: string; unit: { test: any[] } }[] = [];
  for (const u of readdirSync(CONTENT_DIR).filter((d) => /^u\d+$/.test(d)).sort()) {
    out.push({ file: u + "/unit.json", unit: JSON.parse(readFileSync(join(CONTENT_DIR, u, "unit.json"), "utf8")) });
  }
  return out;
}
