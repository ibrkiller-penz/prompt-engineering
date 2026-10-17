// 읽기 설정: 저장(학생 aimn:s1:prefs · 교사 aimn:t1:prefs) + html 속성 반영 + 주소 ?fs=&theme= 첫 적용.
//   bootPrefs()      진입점에서 첫 그림 전에 한 번(저장값 + 주소 쿼리 덮어쓰기)
//   usePrefs()       설정 화면·도구 띠에서 [설정, 바꾸기]
//   applyPrefs(p)    html 속성만 다시 걸기
import { useCallback, useEffect } from "react";
import type { SiteMode } from "../contracts.ts";
import { studentStore, teacherStore, useStored, type Store } from "../storage/index.ts";
import { SITE } from "../../site.ts";
import { DEFAULTS, LH_VALUES, htmlAttrs, normalizePrefs, prefsFromQuery, queryOf, type PrefsX } from "./logic.ts";

export * from "./logic.ts";

// 두 저장소 모두 "prefs" 키에 같은 모양을 저장해요(교사 aimn:t1:prefs · 학생 aimn:s1:prefs)
const store = (SITE === "teacher" ? teacherStore : studentStore) as unknown as Store<{ prefs: PrefsX }>;

function media(q: string): boolean {
  try {
    return !!(window.matchMedia && window.matchMedia(q).matches);
  } catch {
    return false;
  }
}

/** 주소 쿼리로 잠시 덮어쓴 값(저장하지 않아요. 이 탭에서만) */
let urlOverride: Partial<PrefsX> = {};

/** 저장된 설정(정리된 값) */
export function readPrefs(site: SiteMode = SITE): PrefsX {
  return normalizePrefs(store.read("prefs", DEFAULTS), site);
}

/** html 속성에 설정을 걸어요 */
export function applyPrefs(p: PrefsX, site: SiteMode = SITE): void {
  try {
    const html = document.documentElement;
    const merged: PrefsX = { ...p, ...urlOverride };
    const attrs = htmlAttrs(merged, site, { prefersDark: media("(prefers-color-scheme: dark)"), prefersReduced: media("(prefers-reduced-motion: reduce)") });
    for (const k of Object.keys(attrs)) {
      const v = attrs[k];
      if (v == null) html.removeAttribute(k);
      else html.setAttribute(k, v);
    }
    const lh = LH_VALUES[merged.lh || 0];
    if (lh) html.style.setProperty("--lh-body", String(lh));
    else html.style.removeProperty("--lh-body");
  } catch {
    /* 무시 */
  }
}

/** 진입점에서 한 번: 저장값 + 주소 ?fs=&theme= (주소 값은 이 탭에서만, 저장하지 않아요) */
export function bootPrefs(site: SiteMode = SITE): PrefsX {
  try {
    const q = { ...queryOf(window.location.search || ""), ...queryOf(window.location.hash || "") };
    urlOverride = prefsFromQuery(q, site);
  } catch {
    urlOverride = {};
  }
  const p = readPrefs(site);
  applyPrefs(p, site);
  // 기기의 밝기·움직임 설정이 바뀌면 'auto' 를 다시 반영
  try {
    const re = () => applyPrefs(readPrefs(site), site);
    const a = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
    const b = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
    for (const m of [a, b]) if (m && m.addListener) m.addListener(re); // Chrome 80 은 addEventListener('change') 도 되지만 옛 방식이 더 넓게 돼요
  } catch {
    /* 무시 */
  }
  return p;
}

/** 주소로 덮어쓴 값이 있는지(설정 화면에서 '이 주소로 잠시 바뀌었어요' 안내용) */
export function hasUrlOverride(): boolean {
  return Object.keys(urlOverride).length > 0;
}

/** 설정 화면 훅. 바꾸면 저장하고 바로 html 에 반영해요. 직접 바꾼 항목은 주소 덮어쓰기를 풀어요 */
export function usePrefs(): [PrefsX, (patch: Partial<PrefsX>) => void] {
  const [raw, setRaw] = useStored(store, "prefs", DEFAULTS);
  const p = normalizePrefs(raw, SITE);
  useEffect(() => {
    applyPrefs(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.fs, p.theme, p.motion, p.contrast, p.lh]);
  const set = useCallback((patch: Partial<PrefsX>) => {
    const next: Record<string, unknown> = {};
    for (const k of Object.keys(patch)) {
      next[k] = (patch as Record<string, unknown>)[k];
      delete (urlOverride as Record<string, unknown>)[k];
    }
    setRaw((cur) => normalizePrefs({ ...normalizePrefs(cur, SITE), ...next }, SITE));
  }, [setRaw]);
  return [p, set];
}
