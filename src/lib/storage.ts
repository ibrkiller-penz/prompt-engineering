// 학생 기록은 이 기기의 브라우저(localStorage)에만 남는다. 서버로 보내지 않는다.
// 사생활 보호 모드 등에서 저장이 막혀도 화면은 그대로 동작하도록 모든 접근을 try/catch로 감싼다.
import { useEffect, useState } from "react";

const PREFIX = "penedu:prompt:";

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* 저장 실패는 무시 */
  }
}

export function clearAll(): void {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* 무시 */
  }
}

/** useState와 같지만 값이 바뀌면 로컬에 저장된다. */
export function useStored<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => load(key, fallback));
  useEffect(() => {
    setValue(load(key, fallback));
    // key가 바뀔 때만 다시 읽는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const set = (v: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v;
      save(key, next);
      return next;
    });
  };
  return [value, set] as const;
}
