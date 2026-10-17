// 선생님 QR 주소(#/l/:lid?hw=q06,q11&ex=q03,q05)의 쿼리 읽기. 순수 함수(DOM 없음).
// 쿼리에는 문제 id 만 들어 있어요(반·이름 없음). 짧은 id("q06")는 레슨 앞머리를 붙여 늘려요.
// 교사 쪽 만들기 규칙(src/teacher/logic/pick.logic.ts 의 studentLink)과 같은 규칙을 학생 쪽에 따로 둬요.

const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
export const ASSIGN_MAX = 12;

/** "q06" → "u1-1-q06", 이미 긴 id 는 그대로 */
export function expandQid(lid: string, id: string): string {
  return /^u\d+-\d+-/.test(id) ? id : lid + "-" + id;
}

/**
 * query: "?hw=q06,q11&ex=q03" 또는 "hw=…&ex=…".
 * exists 를 주면 그 레슨에 실제로 있는 문제만 남겨요. 다른 레슨 문제 id 는 받지 않아요.
 */
export function parseAssignQuery(lid: string, query: string, exists?: (id: string) => boolean): { hw: string[]; ex: string[] } {
  const out = { hw: [] as string[], ex: [] as string[] };
  const qs = String(query || "").replace(/^[^?]*\?/, "").replace(/^\?/, "");
  for (const kv of qs.split("&")) {
    const eq = kv.indexOf("=");
    if (eq < 0) continue;
    const k = kv.slice(0, eq);
    if (k !== "hw" && k !== "ex") continue;
    let v = kv.slice(eq + 1);
    try {
      v = decodeURIComponent(v);
    } catch {
      continue;
    }
    for (const raw of v.split(",")) {
      const s = raw.trim();
      if (!ID_RE.test(s)) continue;
      const id = expandQid(lid, s);
      if (id.indexOf(lid + "-") !== 0) continue;
      if (exists && !exists(id)) continue;
      const list = out[k];
      if (list.indexOf(id) < 0 && list.length < ASSIGN_MAX) list.push(id);
    }
  }
  return out;
}
