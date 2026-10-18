// 반별 수업 기록 카드의 순수 계산(DOM 없음). 반 이름은 교사가 고른 값만 쓰고 학생 이름·번호는 받지 않아요.
// 세특 같은 평가 문장은 만들지 않고, 있었던 일(숫자)만 정리해요.
// [개발2용 함수 목록]
//   lessonLogText(card, order?: readonly string[]): string
//     order = 연습 순서대로 나열한 문제 id 배열(화면의 '6번'은 order.indexOf(id)+1). 있으면 복사 글도 '6번' 형식, 생략하면 예전처럼 'q06'.
//   shouldSaveLog(klass: string | null | undefined): boolean
//     반 이름이 비어 있으면 false → 저장하지 않고 '반을 먼저 골라 주세요' 안내.
//   practiceNo(id, order?): string  (화면과 복사 글이 같은 번호 문구를 쓰게 하는 함수)
import type { LessonLog, LessonLogQuestion } from "../../shared/contracts.ts";

export interface LessonLogVote {
  id: string;
  /** 정답 보기 번호(0부터) */
  answer: number;
  /** 보기별 손든 수(손들기를 안 했으면 null) */
  counts?: readonly number[] | null;
}

export interface LessonLogInput {
  klass: string;
  lid: string;
  p: number;
  /** YYYY-MM-DD */
  date: string;
  scenesDone: number;
  scenesTotal: number;
  /** 숙제 문제 id(순서대로) */
  hw: readonly string[];
  /** 끝 확인 문제 id */
  exitIds: readonly string[];
  /** 칠판·끝 확인 문제의 득표 결과 */
  votes: readonly LessonLogVote[];
  ts?: number;
}

const cleanCounts = (c: readonly number[] | null | undefined): number[] => (c ? c.map((v) => (typeof v === "number" && v > 0 ? Math.floor(v) : 0)) : []);
const total = (c: readonly number[]) => c.reduce((a, b) => a + b, 0);

/** 손든 수가 있는 문항인지 */
export const hasVotes = (q: Pick<LessonLogQuestion, "counts">) => total(q.counts) > 0;

/** 저장소에서 읽은 값이 기록 카드 모양인지(hw·qs 배열, 각 qs 의 counts 배열, klass·lid 문자열) */
export function isLessonLog(x: unknown): x is LessonLog {
  if (!x || typeof x !== "object") return false;
  const c = x as Partial<LessonLog>;
  if (typeof c.klass !== "string" || typeof c.lid !== "string") return false;
  if (!Array.isArray(c.hw) || !Array.isArray(c.qs)) return false;
  return c.qs.every((q) => !!q && typeof q === "object" && Array.isArray((q as LessonLogQuestion).counts));
}

/** 입력 → 카드 데이터. 손든 수가 0이면 정답률은 null(0% 로 보이지 않아요) */
export function buildLessonLog(input: LessonLogInput): LessonLog {
  const exit: Record<string, true> = {};
  for (const id of input.exitIds) exit[id] = true;
  const seen: Record<string, true> = {};
  const qs: LessonLogQuestion[] = [];
  for (const v of input.votes) {
    if (seen[v.id]) continue;
    seen[v.id] = true;
    const counts = cleanCounts(v.counts);
    const t = total(counts);
    const ok = t > 0 && v.answer >= 0 && v.answer < counts.length;
    qs.push({ id: v.id, counts: t > 0 ? counts : [], answer: v.answer, rate: ok ? Math.round((counts[v.answer] / t) * 100) : null, exit: !!exit[v.id] });
  }
  const done = Math.max(0, Math.floor(input.scenesDone) || 0);
  const all = Math.max(done, Math.floor(input.scenesTotal) || 0);
  return {
    klass: String(input.klass || "").trim(),
    lid: input.lid,
    p: input.p,
    date: input.date,
    scenesDone: done,
    scenesTotal: all,
    hw: input.hw.slice(),
    qs,
    exitDone: input.exitIds.length > 0,
    ts: input.ts === undefined ? Date.now() : input.ts,
  };
}

/** 정답률이 낮은 문항 1~n개(정답률 80% 미만, 손든 수가 있는 것만). 낮은 순, 같으면 끝 확인 문제 먼저 */
export function weakQuestions(card: Pick<LessonLog, "qs">, n: number = 2): LessonLogQuestion[] {
  const max = Math.max(1, Math.min(2, Math.floor(n) || 2));
  const idx: { q: LessonLogQuestion; i: number }[] = [];
  card.qs.forEach((q, i) => {
    if (q.rate !== null && hasVotes(q) && q.rate < 80) idx.push({ q, i });
  });
  idx.sort((a, b) => (a.q.rate as number) - (b.q.rate as number) || Number(b.q.exit) - Number(a.q.exit) || a.i - b.i);
  return idx.slice(0, max).map((x) => x.q);
}

/** 문제 id 끝 번호만("u1_1_1-q6" → "q6") */
const shortQ = (id: string) => {
  const m = /(q\d+)$/.exec(id);
  return m ? m[1] : id;
};

/** 문제 이름: 연습 순서 목록에 있으면 "6번", 없으면 예전 그대로 "q6" */
export function practiceNo(id: string, order?: readonly string[] | null): string {
  if (order) {
    const i = order.indexOf(id);
    if (i >= 0) return i + 1 + "번";
  }
  return shortQ(id);
}

/** 반 이름이 있어야 기록을 저장해요(비면 false) */
export function shouldSaveLog(klass: string | null | undefined): boolean {
  return String(klass || "").trim().length > 0;
}

/** 한 문항의 한 줄 결과 */
export function questionLine(q: LessonLogQuestion, order?: readonly string[] | null): string {
  const head = practiceNo(q.id, order) + (q.exit ? "(끝 확인)" : "");
  if (!hasVotes(q) || q.rate === null) return head + " 아직 손들기를 안 했어요";
  return head + " 정답률 " + q.rate + "% (" + q.counts.join("·") + "명, 정답 " + (q.answer + 1) + "번)";
}

/** 복사용 일반 글(메신저·메모에 붙여 넣기용). 학생 이름·번호·평가 문장은 없어요 */
export function lessonLogText(card: LessonLog, order?: readonly string[] | null): string {
  const out: string[] = [];
  out.push((card.klass ? card.klass + " " : "") + "수업 기록 · " + card.date);
  out.push("수업: " + card.lid + " " + card.p + "차시 (장면 " + card.scenesDone + "/" + card.scenesTotal + "개 진행)");
  out.push("숙제: " + (card.hw.length ? card.hw.map((id) => practiceNo(id, order)).join(", ") : "없어요"));
  if (!card.qs.length) {
    out.push("문제별 결과: 아직 손들기를 안 했어요");
  } else {
    out.push("문제별 결과:");
    for (const q of card.qs) out.push("- " + questionLine(q, order));
  }
  const weak = weakQuestions(card, 2);
  if (card.exitDone || weak.length) {
    out.push(weak.length ? "다시 짚을 문항: " + weak.map((q) => practiceNo(q.id, order) + " " + q.rate + "%").join(", ") : "다시 짚을 문항: 없어요");
  }
  return out.join("\n");
}
