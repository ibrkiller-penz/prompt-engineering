// 기록 파일(백업) 만들기·읽기. 순수 함수(DOM 없음).
// 모양: { app: "aibasic-next", site, v: 1, savedAt, data: { 키: 값 } } — 값에 개인 정보는 없어요.
import type { Backup, SiteMode } from "../contracts.ts";
import { STUDENT_KEYS, TEACHER_KEYS } from "./keys.ts";

export const BACKUP_APP = "aibasic-next";
export const BACKUP_MAX_BYTES = 2 * 1024 * 1024; // 2MB 넘는 파일은 받지 않아요

const allowedKeys = (site: SiteMode) => Object.keys(site === "teacher" ? TEACHER_KEYS : STUDENT_KEYS);

export function makeBackup(site: SiteMode, data: Record<string, unknown>, now: Date = new Date()): Backup {
  const allow = allowedKeys(site);
  const clean: Record<string, unknown> = {};
  for (const k of allow) if (Object.prototype.hasOwnProperty.call(data, k)) clean[k] = data[k];
  return { app: BACKUP_APP, site, v: 1, savedAt: now.toISOString(), data: clean };
}

export function serializeBackup(site: SiteMode, data: Record<string, unknown>, now?: Date): string {
  return JSON.stringify(makeBackup(site, data, now), null, 1);
}

/** 내려받을 파일 이름(날짜만, 이름 없음) */
export function backupFileName(site: SiteMode, now: Date = new Date()): string {
  const p = (n: number) => (n < 10 ? "0" : "") + n;
  const d = now.getFullYear() + "-" + p(now.getMonth() + 1) + "-" + p(now.getDate());
  return "인공지능기초-" + (site === "teacher" ? "교사설정" : "학습기록") + "-" + d + ".json";
}

export type ParseResult = { ok: true; data: Record<string, unknown>; savedAt: string; skipped: string[] } | { ok: false; reason: string };

/** 기록 파일을 읽어 확인해요. 실패 이유는 화면에 그대로 보여 줄 수 있게 해요체로 */
export function parseBackup(text: string, site: SiteMode): ParseResult {
  if (typeof text !== "string" || text.length === 0) return { ok: false, reason: "파일이 비어 있어요." };
  if (text.length > BACKUP_MAX_BYTES) return { ok: false, reason: "파일이 너무 커요. 이 사이트에서 저장한 기록 파일인지 확인해 주세요." };
  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch {
    return { ok: false, reason: "기록 파일 모양이 아니에요(JSON을 읽을 수 없어요)." };
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return { ok: false, reason: "기록 파일 모양이 아니에요." };
  const b = obj as Partial<Backup>;
  if (b.app !== BACKUP_APP) return { ok: false, reason: "이 사이트에서 저장한 기록 파일이 아니에요." };
  if (b.v !== 1) return { ok: false, reason: "지원하지 않는 기록 파일 버전이에요." };
  if (b.site !== site)
    return { ok: false, reason: site === "teacher" ? "학생용 기록 파일이에요. 교사 사이트에서는 불러올 수 없어요." : "교사용 설정 파일이에요. 학생 사이트에서는 불러올 수 없어요." };
  if (!b.data || typeof b.data !== "object" || Array.isArray(b.data)) return { ok: false, reason: "기록 내용이 비어 있어요." };
  const allow = allowedKeys(site);
  const data: Record<string, unknown> = {};
  const skipped: string[] = [];
  for (const k of Object.keys(b.data)) {
    if (allow.indexOf(k) >= 0) data[k] = (b.data as Record<string, unknown>)[k];
    else skipped.push(k);
  }
  return { ok: true, data, savedAt: typeof b.savedAt === "string" ? b.savedAt : "", skipped };
}
