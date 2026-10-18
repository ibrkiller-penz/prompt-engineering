// 해시 라우터의 순수 함수(DOM 없음). node --test 로 바로 시험해요.
// 주소 모양: "#/l/u1-1/s/c2/3?hw=u1-1-q06,u1-1-q11"

export type Query = Record<string, string>;
export type Params = Record<string, string>;

export interface Loc {
  path: string; // 항상 "/" 로 시작하고, 끝의 "/" 는 떼요(뿌리 "/" 는 그대로)
  query: Query;
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** "/a//b/" → "/a/b" */
export function normalizePath(p: string): string {
  const parts = p.split("/").filter((x) => x !== "");
  return "/" + parts.join("/");
}

/** location.hash 를 경로와 쿼리로 나눠요. "", "#", "#/" 는 모두 "/" */
export function parseHash(hash: string): Loc {
  let h = hash || "";
  if (h.charAt(0) === "#") h = h.slice(1);
  const qi = h.indexOf("?");
  const rawPath = qi >= 0 ? h.slice(0, qi) : h;
  const rawQuery = qi >= 0 ? h.slice(qi + 1) : "";
  const query: Query = {};
  if (rawQuery) {
    for (const pair of rawQuery.split("&")) {
      if (!pair) continue;
      const ei = pair.indexOf("=");
      const k = safeDecode((ei >= 0 ? pair.slice(0, ei) : pair).replace(/\+/g, " "));
      const v = safeDecode((ei >= 0 ? pair.slice(ei + 1) : "").replace(/\+/g, " "));
      if (k && k !== "__proto__" && k !== "constructor" && k !== "prototype") query[k] = v;
    }
  }
  return { path: normalizePath(rawPath), query };
}

/** 쿼리 값의 쉼표는 그대로 두어 주소가 읽기 쉽게 해요 */
function enc(s: string): string {
  return encodeURIComponent(s).replace(/%2C/gi, ",");
}

/** 경로와 쿼리로 "#/..." 를 만들어요. 값이 빈 문자열·undefined 인 쿼리는 빼요 */
export function formatHash(path: string, query?: Record<string, string | number | undefined | null>): string {
  const p = normalizePath(path);
  const qs: string[] = [];
  if (query) {
    for (const k of Object.keys(query)) {
      const v = query[k];
      if (v === undefined || v === null || v === "") continue;
      qs.push(enc(k) + "=" + enc(String(v)));
    }
  }
  return "#" + p + (qs.length ? "?" + qs.join("&") : "");
}

/** 패턴("/l/:lid/s/:step/:card")과 경로를 맞춰 매개변수를 돌려줘요. 안 맞으면 null */
export function matchPath(pattern: string, path: string): Params | null {
  const a = normalizePath(pattern).split("/");
  const b = normalizePath(path).split("/");
  if (a.length !== b.length) return null;
  const params: Params = {};
  for (let i = 0; i < a.length; i++) {
    const seg = a[i];
    if (seg.charAt(0) === ":") {
      const v = safeDecode(b[i]);
      if (!v) return null;
      params[seg.slice(1)] = v;
    } else if (seg !== b[i]) {
      return null;
    }
  }
  return params;
}

/** 경로 표에서 처음 맞는 것을 찾아요. 표는 { 이름: 패턴 } 모양(contracts 의 STUDENT_ROUTES 등) */
export function matchTable<T extends Record<string, string>>(
  table: T,
  path: string,
): { name: keyof T & string; params: Params } | null {
  for (const name of Object.keys(table)) {
    const params = matchPath(table[name], path);
    if (params) return { name, params };
  }
  return null;
}

/** 패턴에 매개변수를 채워 경로를 만들어요. 빠진 매개변수가 있으면 오류 */
export function fillPath(pattern: string, params: Record<string, string | number>): string {
  return normalizePath(
    normalizePath(pattern)
      .split("/")
      .map((seg) => {
        if (seg.charAt(0) !== ":") return seg;
        const k = seg.slice(1);
        const v = params[k];
        if (v === undefined || v === "") throw new Error("경로 매개변수가 빠졌어요: " + k);
        return encodeURIComponent(String(v));
      })
      .join("/"),
  );
}

/** 문제 id 목록 쿼리("u1-1-q06,u1-1-q11")를 안전하게 읽어요. id 모양이 아닌 것은 버리고 최대 max 개 */
export const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/;
export function idList(v: string | undefined | null, max = 30): string[] {
  if (!v) return [];
  const out: string[] = [];
  for (const raw of v.split(",")) {
    const s = raw.trim();
    if (ID_RE.test(s) && out.indexOf(s) < 0) out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

/** 정수 쿼리(차시 p, 장면 s 등). 범위 밖·숫자 아님이면 기본값 */
export function intParam(v: string | undefined | null, def: number, min = 0, max = 999): number {
  if (v == null || !/^-?\d+$/.test(v)) return def;
  const n = parseInt(v, 10);
  return n < min || n > max ? def : n;
}

/** 다른 사이트(학생 주소 등)로 가는 절대 주소: base + "/" + "#/..." */
export function absoluteUrl(base: string, path: string, query?: Record<string, string | number | undefined | null>): string {
  return base.replace(/\/+$/, "") + "/" + formatHash(path, query);
}
