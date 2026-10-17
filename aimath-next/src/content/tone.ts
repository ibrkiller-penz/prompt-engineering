// 표시용 덧씌우기(해요체 치환·칩) 순수 함수. 원본 JSON 은 고치지 않고, 화면에 보일 때만 바꿔요.
// 규칙: 문장이 '정확히' 들어 있을 때만 바꿔요. 경로(path)를 주면 그 글자에서만.
import type { ChipRule, ToneFile, ToneRule } from "../shared/contracts.ts";

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object";

/** 문서 안의 모든 문자열을 경로와 함께 바꿔요(새 객체를 돌려줘요) */
export function mapStrings<T>(doc: T, fn: (s: string, path: string) => string, base = ""): T {
  const walk = (v: unknown, p: string): unknown => {
    if (typeof v === "string") return fn(v, p);
    if (Array.isArray(v)) return v.map((x, i) => walk(x, p ? p + "." + i : String(i)));
    if (isObj(v)) {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(v)) out[k] = walk(v[k], p ? p + "." + k : k);
      return out;
    }
    return v;
  };
  return walk(doc, base) as T;
}

function rulesFor(rules: ToneRule[] | undefined, where: string): ToneRule[] {
  return (rules || []).filter((r) => r.where === where && typeof r.from === "string" && r.from.length > 0 && typeof r.to === "string");
}

export interface ToneReport {
  applied: number;
  unused: ToneRule[]; // 원문을 못 찾은 규칙(원본이 바뀌었을 수 있어요 — 검사 스크립트가 알려 줘요)
}

/** where(레슨 id "u1-1" 또는 단원 "u1") 문서에 tone 규칙을 적용해요 */
export function applyTone<T>(doc: T, where: string, file: ToneFile | null | undefined, report?: ToneReport): T {
  const rules = rulesFor(file ? file.replace : undefined, where);
  if (!rules.length) return doc;
  const used = new Set<ToneRule>();
  const out = mapStrings(doc, (s, p) => {
    let cur = s;
    for (const r of rules) {
      if (r.path && r.path !== p) continue;
      if (cur.indexOf(r.from) >= 0) {
        cur = cur.split(r.from).join(r.to);
        used.add(r);
      }
    }
    return cur;
  });
  if (report) {
    report.applied += used.size;
    for (const r of rules) if (!used.has(r)) report.unused.push(r);
  }
  return out;
}

/** 이 글자(경로 path, 내용 text)에 붙일 칩 이름들 */
export function chipsFor(file: ToneFile | null | undefined, where: string, path: string, text: string): string[] {
  const out: string[] = [];
  for (const c of (file && file.chips) || ([] as ChipRule[])) {
    if (c.where !== where) continue;
    if (c.path && c.path !== path) continue;
    if (c.match && text.indexOf(c.match) >= 0 && out.indexOf(c.label) < 0) out.push(c.label);
  }
  return out;
}
