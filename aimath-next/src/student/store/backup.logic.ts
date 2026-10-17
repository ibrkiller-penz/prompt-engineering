// 학생 기록 파일(백업) 내보내기·불러오기. 순수 함수(DOM·저장소 없음).
// 공용 모양(src/shared/storage/backup.ts)을 그대로 쓰고, 공용 키 목록에 없는 학생 전용 키(extra.ts)도 함께 담아요.
// 불러올 때는 값 모양을 하나하나 확인해서, 깨진 값은 빼고 알려 줘요.
import type { Backup, CardPos, QMap } from "../../shared/contracts.ts";
import { makeBackup, parseBackup } from "../../shared/storage/backup.ts";
import { STUDENT_KEYS } from "../../shared/storage/keys.ts";
import { EXTRA_KEYS, THINK_MAX } from "./extra.ts";
import { normRec } from "./record.logic.ts";

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const LID = /^u\d+-\d+$/;
const QID = /^[A-Za-z0-9_-]{1,60}$/;

/** 기록 파일에 담는 키(공용 + 학생 전용, 겹치면 하나) */
export function backupKeys(): string[] {
  const out: string[] = [];
  for (const k of Object.keys(STUDENT_KEYS)) if (STUDENT_KEYS[k as keyof typeof STUDENT_KEYS].backup) out.push(k);
  for (const k of Object.keys(EXTRA_KEYS)) if (EXTRA_KEYS[k as keyof typeof EXTRA_KEYS].backup && out.indexOf(k) < 0) out.push(k);
  return out;
}

/** 저장소에서 모은 값 → 기록 파일 객체 */
export function makeStudentBackup(data: Record<string, unknown>, now: Date = new Date()): Backup {
  const b = makeBackup("student", data, now);
  for (const k of backupKeys()) if (!(k in b.data) && Object.prototype.hasOwnProperty.call(data, k)) b.data[k] = data[k];
  return b;
}

export function serializeStudentBackup(data: Record<string, unknown>, now?: Date): string {
  return JSON.stringify(makeStudentBackup(data, now), null, 1);
}

function numList(v: unknown): number[] | null {
  if (!Array.isArray(v)) return null;
  const out: number[] = [];
  for (const x of v) if (typeof x === "number" && Number.isInteger(x) && x >= 0 && x < 100 && out.indexOf(x) < 0) out.push(x);
  return out;
}
function idList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && QID.test(x)).slice(0, 50);
}
const num = (v: unknown, d = 0) => (typeof v === "number" && isFinite(v) ? v : d);

/** 레슨 id 를 키로 하는 표를 하나씩 확인해요 */
function byLesson<T>(v: unknown, fn: (x: unknown) => T | null): Record<string, T> | null {
  if (!isObj(v)) return null;
  const out: Record<string, T> = {};
  for (const k of Object.keys(v)) {
    if (!LID.test(k)) continue;
    const x = fn(v[k]);
    if (x !== null) out[k] = x;
  }
  return out;
}

const STEP = /^(story|prereq|wrap|c\d{1,2})$/;

/** 키마다 값 모양 확인. 쓸 수 없으면 null */
export function sanitize(key: string, v: unknown): unknown {
  switch (key) {
    case "q": {
      if (!isObj(v)) return null;
      const out: QMap = {};
      for (const id of Object.keys(v)) if (QID.test(id) && isObj(v[id])) out[id] = normRec(v[id]);
      return out;
    }
    case "read":
    case "seen":
      return byLesson(v, numList);
    case "pos":
      return byLesson<CardPos>(v, (x) => {
        if (!isObj(x) || typeof x.step !== "string" || !STEP.test(x.step)) return null;
        return { step: x.step as CardPos["step"], card: Math.max(1, Math.floor(num(x.card, 1))), ts: num(x.ts) };
      });
    case "last": {
      if (v === null) return null;
      if (!isObj(v) || typeof v.path !== "string" || v.path.charAt(0) !== "/") return null;
      return { path: v.path.slice(0, 200), title: typeof v.title === "string" ? v.title.slice(0, 120) : "", ts: num(v.ts) };
    }
    case "prefs": {
      if (!isObj(v)) return null;
      const fs = v.fs === 0 || v.fs === 1 || v.fs === 2 || v.fs === 3 ? v.fs : 1;
      const theme = v.theme === "light" || v.theme === "dark" || v.theme === "auto" ? v.theme : "auto";
      return { fs, theme, motion: v.motion === "reduce" ? "reduce" : "auto", speak: v.speak === true, contrast: v.contrast === true };
    }
    case "prereq":
      return byLesson(v, (x) => {
        if (!isObj(x)) return null;
        const o: Record<string, "know" | "unsure"> = {};
        for (const t of Object.keys(x)) if (x[t] === "know" || x[t] === "unsure") o[t.slice(0, 60)] = x[t] as "know" | "unsure";
        return o;
      });
    case "assigned":
      return byLesson(v, (x) => (isObj(x) ? { hw: idList(x.hw), ex: idList(x.ex), ts: num(x.ts) } : null));
    case "tools": {
      if (!isObj(v)) return null;
      const o: Record<string, { done: boolean; ts: number }> = {};
      for (const k of Object.keys(v)) {
        const x = v[k];
        if (/^[a-z]{2,20}$/.test(k) && isObj(x)) o[k] = { done: x.done === true, ts: num(x.ts) };
      }
      return o;
    }
    case "think":
      return byLesson(v, (x) => {
        if (!isObj(x)) return null;
        const o: Record<string, string> = {};
        for (const k of Object.keys(x)) if (typeof x[k] === "string" && /^[a-z0-9_-]{1,20}$/.test(k)) o[k] = (x[k] as string).slice(0, THINK_MAX);
        return o;
      });
    case "self":
      return byLesson(v, (x) => (isObj(x) && (x.level === 1 || x.level === 2 || x.level === 3) ? { level: x.level, ts: num(x.ts) } : null));
    case "proj":
      return byLesson(v, (x) => (isObj(x) ? { steps: numList(x.steps) || [], done: x.done === true, ts: num(x.ts) } : null));
    default:
      return null;
  }
}

export type StudentImport =
  | { ok: true; data: Record<string, unknown>; savedAt: string; skipped: string[]; questions: number }
  | { ok: false; reason: string };

/** 기록 파일 글자 → 저장할 값. 이유는 해요체로 화면에 그대로 보여 줘요 */
export function parseStudentBackup(text: string): StudentImport {
  const base = parseBackup(text, "student");
  if (!base.ok) return base;
  // 공용 검사는 공용 키만 남겨요. 학생 전용 키는 원문에서 다시 꺼내요(공용 검사를 통과했으니 JSON 은 올발라요).
  const raw = (JSON.parse(text) as Backup).data as Record<string, unknown>;
  const allow = backupKeys();
  const data: Record<string, unknown> = {};
  const skipped: string[] = [];
  for (const k of Object.keys(raw)) {
    if (allow.indexOf(k) < 0) {
      skipped.push(k);
      continue;
    }
    const v = sanitize(k, raw[k]);
    if (v === null && k !== "last") skipped.push(k);
    else data[k] = v;
  }
  const q = data.q as QMap | undefined;
  return { ok: true, data, savedAt: base.savedAt, skipped, questions: q ? Object.keys(q).length : 0 };
}
