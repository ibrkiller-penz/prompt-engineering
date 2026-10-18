// 콘텐츠 읽기 계층. 원본(content/aibasic)은 빌드할 때 읽기만 하고 복사·수정하지 않아요.
// - 색인(INDEX)은 모든 화면에서 바로 써요(작아요).
// - 레슨·단원 본문은 화면에 들어갈 때 불러와요(레슨마다 따로 나뉜 조각).
import { useEffect, useState } from "react";
import INDEX from "virtual:content-index";
import type { ContentIndex, Lesson, LessonIndex, Question, TermEntry, UnitContent, UnitIndex } from "../shared/contracts.ts";
import { overlay } from "./overrides.ts";
import { lessonsOfUnit, unitByNumber, unitOfLesson, whereIsQuestion } from "./order.ts";

export const INDEX_DATA: ContentIndex = INDEX;
export { INDEX_DATA as INDEX };

// 파일 → 불러오기 함수. 키 모양은 빌드 도구에 따라 다를 수 있어 끝부분 "uN/xxx.json" 으로 맞춰요
const lessonLoaders = import.meta.glob<Lesson>("@content/*/lesson-*.json", { import: "default" });
const unitLoaders = import.meta.glob<UnitContent>("@content/*/unit.json", { import: "default" });

function loaderFor<T>(table: Record<string, () => Promise<T>>, file: string): (() => Promise<T>) | undefined {
  const tail = "/" + file;
  for (const k of Object.keys(table)) if (k.slice(-tail.length) === tail) return table[k];
  return undefined;
}

const lessonCache: Record<string, Lesson> = {};
const unitCache: Record<number, UnitContent> = {};
const pending: Record<string, Promise<unknown>> = {};

/** 레슨 본문(해요체 덧씌움 적용). 없는 id 면 오류 */
export function loadLesson(lid: string): Promise<Lesson> {
  if (lessonCache[lid]) return Promise.resolve(lessonCache[lid]);
  const meta = INDEX.lessons[lid];
  if (!meta) return Promise.reject(new Error("없는 레슨이에요: " + lid));
  const key = "l:" + lid;
  if (!pending[key]) {
    const ld = loaderFor(lessonLoaders, meta.file);
    if (!ld) return Promise.reject(new Error("레슨 파일을 찾지 못했어요: " + meta.file));
    pending[key] = ld().then((raw) => {
      const l = overlay(raw, lid);
      lessonCache[lid] = l;
      delete pending[key];
      return l;
    });
  }
  return pending[key] as Promise<Lesson>;
}

/** 단원 본문(도입·마무리 문제·미래 이야기) */
export function loadUnit(n: number): Promise<UnitContent> {
  if (unitCache[n]) return Promise.resolve(unitCache[n]);
  const u = unitByNumber(INDEX, n);
  if (!u) return Promise.reject(new Error("없는 단원이에요: " + n));
  const key = "u:" + n;
  if (!pending[key]) {
    const ld = loaderFor(unitLoaders, u.file);
    if (!ld) return Promise.reject(new Error("단원 파일을 찾지 못했어요: " + u.file));
    pending[key] = ld().then((raw) => {
      const doc = overlay(raw, u.slug);
      unitCache[n] = doc;
      delete pending[key];
      return doc;
    });
  }
  return pending[key] as Promise<UnitContent>;
}

/** 이미 불러온 레슨이면 바로(동기) */
export const peekLesson = (lid: string): Lesson | undefined => lessonCache[lid];
export const peekUnit = (n: number): UnitContent | undefined => unitCache[n];

/** 사전(용어 전체) — 사전 화면에서만 불러와요 */
let termsP: Promise<TermEntry[]> | null = null;
export function loadTerms(): Promise<TermEntry[]> {
  if (!termsP) termsP = import("virtual:content-terms").then((m) => m.default);
  return termsP;
}

/** 문제 id 로 문제 본문과 위치 찾기(오답노트·복습·칠판 문제) */
export async function loadQuestion(qid: string): Promise<{ q: Question; lid: string | null; unit: number; where: string } | null> {
  const w = whereIsQuestion(INDEX, qid);
  if (!w) return null;
  if (w.kind === "practice") {
    const l = await loadLesson(w.lid);
    const q = l.practice.find((x) => x.id === qid);
    return q ? { q, lid: w.lid, unit: w.unit, where: INDEX.lessons[w.lid].code + " " + l.title } : null;
  }
  const u = await loadUnit(w.unit);
  const q = u.test.find((x) => x.id === qid);
  return q ? { q, lid: null, unit: w.unit, where: "단원 마무리" } : null;
}

type Async<T> = { data: T | undefined; error: Error | null; loading: boolean };

function useAsync<T>(key: string | number | null | undefined, peek: () => T | undefined, load: () => Promise<T>): Async<T> {
  const [st, setSt] = useState<Async<T>>(() => {
    const d = key == null ? undefined : peek();
    return { data: d, error: null, loading: key != null && !d };
  });
  useEffect(() => {
    if (key == null) {
      setSt({ data: undefined, error: null, loading: false });
      return;
    }
    const d = peek();
    if (d) {
      setSt({ data: d, error: null, loading: false });
      return;
    }
    let alive = true;
    setSt({ data: undefined, error: null, loading: true });
    load().then(
      (v) => alive && setSt({ data: v, error: null, loading: false }),
      (e: unknown) => alive && setSt({ data: undefined, error: e instanceof Error ? e : new Error(String(e)), loading: false }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return st;
}

/** 레슨 본문 훅: { data, error, loading } */
export function useLesson(lid: string | null | undefined): Async<Lesson> {
  return useAsync(lid && INDEX.lessons[lid] ? lid : lid ? "?" + lid : null, () => (lid ? lessonCache[lid] : undefined), () => loadLesson(lid as string));
}

/** 단원 본문 훅 */
export function useUnit(n: number | null | undefined): Async<UnitContent> {
  return useAsync(n, () => (n != null ? unitCache[n] : undefined), () => loadUnit(n as number));
}

/** 사전 훅 */
export function useTerms(): Async<TermEntry[]> {
  return useAsync("terms", () => undefined, loadTerms);
}

/* 색인 바로 쓰기(동기) */
export const lessonMeta = (lid: string): LessonIndex | undefined => INDEX.lessons[lid];
export const unitMeta = (n: number): UnitIndex | undefined => unitByNumber(INDEX, n);
export const unitOf = (lid: string): UnitIndex | undefined => unitOfLesson(INDEX, lid);
export const lessonsOf = (n: number): LessonIndex[] => lessonsOfUnit(INDEX, n);
