// 읽기 설정 순수 로직(DOM 없음 — node --test 로 시험할 수 있어요).
// 글자 4단계(data-fs 0..3), 줄 간격 3단계, 테마(auto·light·dark·chalk), 대비 높이기, 움직임 줄이기, 읽어 주기.
import type { FontStep, Prefs, SiteMode, Theme, ThemePref } from "../contracts.ts";

/** 줄 간격 단계: 0 보통 · 1 넓게 · 2 더 넓게 */
export type LineStep = 0 | 1 | 2;

/** 저장하는 설정(계약의 Prefs + 줄 간격). 줄 간격은 없으면 0 */
export interface PrefsX extends Prefs {
  lh?: LineStep;
}

export const DEFAULTS: PrefsX = { fs: 1, theme: "auto", motion: "auto", speak: false, contrast: false, lh: 0 };

export const FS_LABELS: Record<FontStep, string> = { 0: "작게", 1: "보통", 2: "크게", 3: "아주 크게" };
export const LH_LABELS: Record<LineStep, string> = { 0: "보통", 1: "넓게", 2: "더 넓게" };
/** 줄 간격 값(본문 line-height). 0 이면 표면 기본값을 그대로 써요 */
export const LH_VALUES: Record<LineStep, number | null> = { 0: null, 1: 1.9, 2: 2.15 };
export const THEME_LABELS: Record<ThemePref, string> = { auto: "기기 설정 따라", light: "밝게", dark: "어둡게", chalk: "칠판" };

const isFs = (v: unknown): v is FontStep => v === 0 || v === 1 || v === 2 || v === 3;
const isLh = (v: unknown): v is LineStep => v === 0 || v === 1 || v === 2;

/** 이 사이트에서 고를 수 있는 테마(칠판은 교사만) */
export function themeChoices(site: SiteMode): ThemePref[] {
  return site === "teacher" ? ["auto", "light", "dark", "chalk"] : ["auto", "light", "dark"];
}

/** 깨졌거나 모자란 값을 기본값으로 메워요 */
export function normalizePrefs(raw: unknown, site: SiteMode): PrefsX {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const fsNum = typeof r.fs === "string" ? Number(r.fs) : r.fs;
  const lhNum = typeof r.lh === "string" ? Number(r.lh) : r.lh;
  let theme = (typeof r.theme === "string" ? r.theme : "auto") as ThemePref;
  if (themeChoices(site).indexOf(theme) < 0) theme = theme === "chalk" ? "dark" : "auto";
  return {
    fs: isFs(fsNum) ? fsNum : DEFAULTS.fs,
    theme,
    motion: r.motion === "reduce" ? "reduce" : "auto",
    speak: r.speak === true,
    contrast: r.contrast === true,
    lh: isLh(lhNum) ? lhNum : 0,
  };
}

/** 실제로 쓸 테마 */
export function resolveTheme(pref: ThemePref, site: SiteMode, prefersDark: boolean): Theme {
  if (pref === "auto") return prefersDark ? "dark" : "light";
  if (pref === "chalk" && site !== "teacher") return "dark";
  return pref;
}

/** html 에 걸 속성(값이 null 이면 속성을 지워요) */
export function htmlAttrs(p: PrefsX, site: SiteMode, env: { prefersDark: boolean; prefersReduced: boolean }): Record<string, string | null> {
  const lh = p.lh || 0;
  return {
    "data-fs": String(p.fs),
    "data-theme": resolveTheme(p.theme, site, env.prefersDark),
    "data-contrast": p.contrast ? "more" : null,
    "data-motion": p.motion === "reduce" || env.prefersReduced ? "reduce" : null,
    "data-lh": lh ? String(lh) : null,
  };
}

/**
 * 주소 쿼리의 ?fs=&theme= 를 읽어요(교사가 칠판 주소에 붙여 두거나, 학생에게 큰 글자로 보내 줄 때).
 * 알아볼 수 없는 값은 버려요. contrast=1, motion=reduce 도 받아요.
 */
export function prefsFromQuery(q: Record<string, string | undefined>, site: SiteMode): Partial<PrefsX> {
  const out: Partial<PrefsX> = {};
  if (q.fs != null && q.fs !== "") {
    const n = Number(q.fs);
    if (isFs(n)) out.fs = n;
  }
  if (q.theme && themeChoices(site).indexOf(q.theme as ThemePref) >= 0) out.theme = q.theme as ThemePref;
  if (q.contrast === "1" || q.contrast === "more") out.contrast = true;
  if (q.motion === "reduce") out.motion = "reduce";
  if (q.lh != null && q.lh !== "") {
    const n = Number(q.lh);
    if (isLh(n)) out.lh = n;
  }
  return out;
}

/** 글자 한 단계 키우기/줄이기(0..3 안에서) */
export function stepFs(fs: FontStep, d: number): FontStep {
  const n = Math.max(0, Math.min(3, fs + d));
  return n as FontStep;
}

/** "?a=1&b=2" 또는 "#/x?a=1" 에서 쿼리만 읽어요 */
export function queryOf(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  const i = s.indexOf("?");
  if (i < 0) return out;
  for (const kv of s.slice(i + 1).split("&")) {
    if (!kv) continue;
    const e = kv.indexOf("=");
    const k = e >= 0 ? kv.slice(0, e) : kv;
    const v = e >= 0 ? kv.slice(e + 1) : "";
    try {
      out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, " "));
    } catch {
      out[k] = v;
    }
  }
  return out;
}
