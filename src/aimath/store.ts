// 학습 기록은 이 기기의 브라우저(localStorage)에만 남는다. 서버로 보내지 않는다.
import { useEffect, useState } from "react";

const PREFIX = "penedu:aimath:";
const EVENT = "aimath-store";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* 저장이 막혀도 화면은 동작한다 */
  }
  window.dispatchEvent(new Event(EVENT));
}

export interface QResult {
  ok: boolean; // 가장 최근 결과
  tries: number; // 시도 횟수
  best: boolean; // 한 번이라도 스스로 맞힌 적
  ts: number;
}
type QMap = Record<string, QResult>;

/** 문제 결과 기록 */
export function recordResult(qid: string, ok: boolean) {
  const all = read<QMap>("q", {});
  const prev = all[qid];
  all[qid] = { ok, tries: (prev?.tries ?? 0) + 1, best: ok || (prev?.best ?? false), ts: Date.now() };
  write("q", all);
}

export function useQResults(): QMap {
  const [v, setV] = useState<QMap>(() => read<QMap>("q", {}));
  useEffect(() => {
    const on = () => setV(read<QMap>("q", {}));
    window.addEventListener(EVENT, on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener(EVENT, on);
      window.removeEventListener("storage", on);
    };
  }, []);
  return v;
}

/** 레슨/단원 진행: 맞힌 문제 수 / 전체 문제 수 */
export function progressOf(ids: string[], results: QMap) {
  const total = ids.length;
  const done = ids.filter((id) => results[id]?.ok).length;
  const tried = ids.filter((id) => results[id]).length;
  return { total, done, tried, pct: total ? Math.round((done / total) * 100) : 0 };
}

/** 레슨 완료 기준. '기본 문제' = group 에 '실력'·'도전'이 없는 문제(개념 확인·기초력 UP·쉬운 응용). */
export const isBasic = (q: { group: string }) => !/실력|도전/.test(q.group);
const PASS_RATE = 0.6; // 기본 문제의 60% 이상 맞히면 완료

/** 개념 소제목을 펼쳐 본 기록: { [lessonId]: [섹션 번호...] } */
type ReadMap = Record<string, number[]>;
export function markSectionRead(lessonId: string, idx: number) {
  const all = read<ReadMap>("read", {});
  const cur = all[lessonId] ?? [];
  if (cur.includes(idx)) return;
  all[lessonId] = [...cur, idx];
  write("read", all);
}
export function useSectionsRead(): ReadMap {
  const [v, setV] = useState<ReadMap>(() => read<ReadMap>("read", {}));
  useEffect(() => {
    const on = () => setV(read<ReadMap>("read", {}));
    window.addEventListener(EVENT, on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener(EVENT, on);
      window.removeEventListener("storage", on);
    };
  }, []);
  return v;
}

/** 레슨 하나의 상태: 개념을 다 읽고, 기본 문제를 다 풀어 보고(맞히거나 풀이를 보고), 그중 60% 이상 맞히면 완료 */
export function lessonStatus(
  lesson: { id: string; sections: unknown[]; practice: { id: string; group: string }[] },
  results: QMap,
  readMap: ReadMap,
) {
  const basic = lesson.practice.filter(isBasic);
  const basicIds = basic.map((q) => q.id);
  const bp = progressOf(basicIds, results);
  const sectionsTotal = lesson.sections.length;
  const sectionsRead = (readMap[lesson.id] ?? []).filter((i) => i < sectionsTotal).length;
  const allRead = sectionsRead >= sectionsTotal;
  const allTried = bp.tried >= bp.total;
  const passed = bp.total > 0 && bp.done >= Math.ceil(bp.total * PASS_RATE);
  const need = Math.ceil(bp.total * PASS_RATE);
  return { basicIds, basic: bp, sectionsRead, sectionsTotal, allRead, allTried, passed, need, complete: allRead && allTried && passed };
}

/** 오답노트에서 지울 때 */
export function clearResult(qid: string) {
  const all = read<QMap>("q", {});
  delete all[qid];
  write("q", all);
}

export function resetAll() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* 무시 */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** 마지막으로 보던 곳 */
export function saveLast(path: string, title: string) {
  write("last", { path, title });
}
export const loadLast = () => read<{ path: string; title: string } | null>("last", null);
