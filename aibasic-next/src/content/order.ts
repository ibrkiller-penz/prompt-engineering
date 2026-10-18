// 화면 순서·번호 순수 함수. 순서의 기준은 units.json 의 배열 순서예요(레슨 파일 번호·order 값이 아니에요).
import type { ContentIndex, LessonIndex, QWhere, UnitIndex } from "../shared/contracts.ts";

/** 레슨 화면 번호 "Ⅱ-1-3"(원본 id 가 있으면 그 번호, 없으면 단원 안 순서 "Ⅱ-3") */
export const screenCode = (roman: string, n: number, origId?: string) =>
  roman + "-" + (origId && /^\d+-/.test(origId) ? origId.split("-").slice(1).join("-") : n);

export function unitByNumber(idx: ContentIndex, n: number): UnitIndex | undefined {
  for (const u of idx.units) if (u.id === n) return u;
  return undefined;
}

export function unitOfLesson(idx: ContentIndex, lid: string): UnitIndex | undefined {
  const l = idx.lessons[lid];
  return l ? unitByNumber(idx, l.unit) : undefined;
}

export function lessonsOfUnit(idx: ContentIndex, n: number): LessonIndex[] {
  const u = unitByNumber(idx, n);
  return u ? u.lessonIds.map((id) => idx.lessons[id]) : [];
}

/** 문제 id 가 어디 있는지(레슨 연습 · 단원 마무리) */
export function whereIsQuestion(idx: ContentIndex, qid: string): QWhere | null {
  for (const id of idx.order) {
    const l = idx.lessons[id];
    if (l.qids.indexOf(qid) >= 0) return { kind: "practice", lid: id, unit: l.unit };
  }
  for (const u of idx.units) {
    if (u.testIds.indexOf(qid) >= 0) return { kind: "test", lid: null, unit: u.id };
  }
  return null;
}

/** 레슨의 화면용 이름 "Ⅰ-3 알고리즘과 순서도" */
export function lessonLabel(idx: ContentIndex, lid: string): string {
  const l = idx.lessons[lid];
  return l ? l.code + " " + l.title : lid;
}

/** 단원별 진행을 셀 때 쓰는 레슨 기본 문제 id 전체 */
export function unitBasicIds(idx: ContentIndex, n: number): string[] {
  const out: string[] = [];
  for (const l of lessonsOfUnit(idx, n)) for (const id of l.basicIds) out.push(id);
  return out;
}
