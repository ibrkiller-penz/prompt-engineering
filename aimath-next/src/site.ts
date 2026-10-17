// 지금 빌드가 어느 사이트인지와 두 사이트 주소. 빌드할 때 정해져요(vite --mode student|teacher).
// 주소는 .env.student / .env.teacher(또는 .env.local)의 VITE_STUDENT_URL · VITE_TEACHER_URL 로 덮어쓸 수 있어요.
import type { SiteMode, Surface } from "./shared/contracts.ts";

export const SITE: SiteMode = __SITE__;
export const IS_TEACHER = SITE === "teacher";

const trim = (u: string | undefined, def: string) => (u && /^https?:\/\//.test(u) ? u : def).replace(/\/+$/, "");

/** 학생 사이트(aimaths). 수업 끝 QR·링크는 이 주소로 */
export const STUDENT_URL = trim(import.meta.env.VITE_STUDENT_URL, "https://aimaths.web.app");
/** 교사 사이트(aimatht). 학생 화면 '교사용' 링크는 이 주소로 */
export const TEACHER_URL = trim(import.meta.env.VITE_TEACHER_URL, "https://aimatht.web.app");

export const SITE_NAME = IS_TEACHER ? "인공지능 수학 · 교사용" : "인공지능 수학";
/** 첫 화면의 기본 표면 */
export const DEFAULT_SURFACE: Surface = IS_TEACHER ? "prep" : "phone";
