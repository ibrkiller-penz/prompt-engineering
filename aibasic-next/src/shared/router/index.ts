// 해시 라우터(자체 제작, react-router 안 씀). 서버 rewrite 가 필요 없고 Chrome 80 에서도 안전해요.
import { useMemo, useSyncExternalStore } from "react";
import { fillPath, formatHash, matchTable, parseHash, type Loc, type Params, type Query } from "./match.ts";

export * from "./match.ts";

function subscribe(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}
const getHash = () => window.location.hash;
const getServerHash = () => "";

/** 지금 주소(해시)를 경로·쿼리로 */
export function useLocation(): Loc {
  const hash = useSyncExternalStore(subscribe, getHash, getServerHash);
  return useMemo(() => parseHash(hash), [hash]);
}

export interface RouteMatch<T extends Record<string, string>> {
  name: keyof T & string;
  params: Params;
  query: Query;
  path: string;
}

/** 경로 표(contracts 의 STUDENT_ROUTES·TEACHER_ROUTES)로 지금 화면을 골라요. 맞는 것이 없으면 null */
export function useRoute<T extends Record<string, string>>(table: T): RouteMatch<T> | null {
  const loc = useLocation();
  return useMemo(() => {
    const m = matchTable(table, loc.path);
    return m ? { name: m.name, params: m.params, query: loc.query, path: loc.path } : null;
  }, [table, loc]);
}

/** 화면 이동. replace 면 뒤로 가기 기록을 남기지 않아요(카드 넘기기 위치 저장 등) */
export function navigate(
  path: string,
  query?: Record<string, string | number | undefined | null>,
  opts?: { replace?: boolean },
): void {
  const h = formatHash(path, query);
  if (h === window.location.hash) return;
  if (opts && opts.replace) {
    try {
      window.history.replaceState(window.history.state, "", h);
    } catch {
      window.location.replace(h);
      return;
    }
    // replaceState 는 hashchange 를 내지 않으므로 직접 알려요
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    window.location.hash = h;
  }
}

/** 패턴 + 매개변수로 이동 */
export function go(pattern: string, params: Record<string, string | number> = {}, query?: Record<string, string | number | undefined | null>, opts?: { replace?: boolean }) {
  navigate(fillPath(pattern, params), query, opts);
}

/** <a href> 에 쓸 주소 */
export function href(pattern: string, params: Record<string, string | number> = {}, query?: Record<string, string | number | undefined | null>): string {
  return formatHash(fillPath(pattern, params), query);
}

// 이 사이트 안에서 화면을 옮긴 횟수(뒤로 가기가 사이트 밖으로 나가지 않게)
let inAppMoves = 0;
if (typeof window !== "undefined") window.addEventListener("hashchange", () => inAppMoves++);

/** 이 사이트 안에서 온 화면이면 뒤로, 아니면(QR 로 바로 들어온 경우 등) fallback 으로 */
export function back(fallbackPath = "/"): void {
  if (inAppMoves > 0) window.history.back();
  else navigate(fallbackPath, undefined, { replace: true });
}
