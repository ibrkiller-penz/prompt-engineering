// 반 고르기. 반 목록은 반별 진도(aimn:t1:progress)의 키에서 읽어요(반 이름은 "2-3" 같은 번호, 학생 이름은 넣지 않아요).
// 지금 고른 반은 저장 키가 따로 없어서 이 탭의 메모리에만 둬요(새로 열면 첫 반이 골라져요).
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { TeacherData } from "../../shared/contracts.ts";
import { teacherStore, useStored } from "../../shared/storage/index.ts";

export type ProgressMap = TeacherData["progress"];
export type ProgressMark = "done" | "part";

/** 반 이름 규칙: 글자·숫자·'-'·'.' 1~10자(예: 2-3, 3반, A). 사람 이름처럼 보이는 긴 글은 막아요 */
export const KLASS_RE = /^[0-9A-Za-z가-힣][0-9A-Za-z가-힣.-]{0,9}$/;
export const KLASS_MAX = 20;

export function cleanKlassName(s: string): string | null {
  const v = (s || "").replace(/\s+/g, "").trim();
  return KLASS_RE.test(v) ? v : null;
}

/** 반 이름을 자연스러운 차례로(2-3 < 2-10) */
export function sortKlasses(names: string[]): string[] {
  const key = (s: string) => s.replace(/\d+/g, (d) => ("0000" + d).slice(-4));
  return names.slice().sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
}

interface KlassApi {
  /** 지금 고른 반(없으면 null) */
  klass: string | null;
  classes: string[];
  progress: ProgressMap;
  setKlass: (k: string | null) => void;
  /** 반 추가. 성공하면 이름, 규칙에 안 맞으면 null */
  addKlass: (name: string) => string | null;
  removeKlass: (name: string) => void;
  /** 레슨 진도 표시(null 이면 지워요) */
  markLesson: (klass: string, lid: string, mark: ProgressMark | null) => void;
}

const Ctx = createContext<KlassApi | null>(null);

// 탭 안에서 화면을 옮겨도 유지되게 모듈 메모리에 둬요
let memKlass: string | null = null;

export function KlassProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useStored(teacherStore, "progress", {} as ProgressMap);
  const safe: ProgressMap = progress && typeof progress === "object" ? progress : {};
  const classes = useMemo(() => sortKlasses(Object.keys(safe)), [safe]);
  const [picked, setPicked] = useState<string | null>(memKlass);
  const klass = picked && classes.indexOf(picked) >= 0 ? picked : classes.length ? classes[0] : null;

  const setKlass = useCallback((k: string | null) => {
    memKlass = k;
    setPicked(k);
  }, []);

  const addKlass = useCallback(
    (name: string) => {
      const v = cleanKlassName(name);
      if (!v) return null;
      setProgress((cur) => {
        const c = cur && typeof cur === "object" ? cur : {};
        if (c[v] || Object.keys(c).length >= KLASS_MAX) return c;
        const next: ProgressMap = { ...c };
        next[v] = {};
        return next;
      });
      memKlass = v;
      setPicked(v);
      return v;
    },
    [setProgress],
  );

  const removeKlass = useCallback(
    (name: string) => {
      setProgress((cur) => {
        const next: ProgressMap = { ...(cur || {}) };
        delete next[name];
        return next;
      });
      if (memKlass === name) memKlass = null;
      setPicked((p) => (p === name ? null : p));
    },
    [setProgress],
  );

  const markLesson = useCallback(
    (k: string, lid: string, mark: ProgressMark | null) => {
      setProgress((cur) => {
        const c = cur && typeof cur === "object" ? cur : {};
        const row = { ...(c[k] || {}) };
        if (mark) row[lid] = mark;
        else delete row[lid];
        const next: ProgressMap = { ...c };
        next[k] = row;
        return next;
      });
    },
    [setProgress],
  );

  const api = useMemo<KlassApi>(
    () => ({ klass, classes, progress: safe, setKlass, addKlass, removeKlass, markLesson }),
    [klass, classes, safe, setKlass, addKlass, removeKlass, markLesson],
  );
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

const FALLBACK: KlassApi = {
  klass: null,
  classes: [],
  progress: {},
  setKlass: () => undefined,
  addKlass: () => null,
  removeKlass: () => undefined,
  markLesson: () => undefined,
};

/** 반 고르기 상태. KlassProvider 밖(칠판 무대 등)에서도 안전하게 빈 값이 와요 */
export function useKlass(): KlassApi {
  return useContext(Ctx) || FALLBACK;
}
