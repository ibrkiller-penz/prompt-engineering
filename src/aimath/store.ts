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
