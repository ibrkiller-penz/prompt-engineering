// 준비 한 장의 순수 계산(이야기 장면 시간, 다음 차시 예고). 레슨 JSON 의 기존 필드만 써요.
import type { Scene } from "../../shared/contracts.ts";
import { timeVerdict, type TimeState } from "../today/timebar.ts";

export { timeVerdict };
export type { TimeState };

const r05 = (x: number) => Math.round(x * 2) / 2;

export interface StoryAdd {
  /** 꺼진 이야기 장면 수 */
  count: number;
  /** 모두 켜면 늘어나는 분 */
  add: number;
  /** 모두 켰을 때 예상 분 */
  after: number;
  /** 수업 시간을 넘는 분(안 넘으면 0) */
  over: number;
}

/** 꺼진 이야기 장면을 모두 켰을 때. 꺼진 이야기 장면이 없으면 null */
export function storyAdd(scenes: readonly Pick<Scene, "kind" | "on" | "estMin">[], total: number, minutes: number): StoryAdd | null {
  const off = scenes.filter((s) => s.kind === "story" && !s.on);
  if (!off.length) return null;
  const add = r05(off.reduce((a, s) => a + s.estMin, 0));
  const after = r05(total + add);
  return { count: off.length, add, after, over: r05(Math.max(0, after - minutes)) };
}

/** 대략 쓰는 분(반올림한 정수) */
const approx = (m: number) => Math.round(m) + "분";

/** 시간 배분 카드 위 안내 문구(해요체, 한 문장 꼴). 숫자는 반올림해서 '대략'으로 보여 줘요 */
export function storyAddText(a: StoryAdd): string {
  const head = "모두 켜면 대략 " + approx(a.after) + "이에요. ";
  if (a.over > 0) return head + "수업보다 대략 " + approx(Math.max(1, a.over)) + " 길어요.";
  return head + "수업 시간 안에 들어가요.";
}

/** 다음 차시 소제목 글(차례대로). 마지막 차시면 null. 레슨 JSON 의 sections[].heading 만 써요 */
export function nextPeriodHeads(
  sections: readonly { heading?: string }[],
  periods: readonly { p: number; sections: number[] }[],
  p: number,
): string[] | null {
  const nxt = periods.filter((x) => x.p === p + 1)[0];
  if (!nxt) return null;
  const out: string[] = [];
  for (const si of nxt.sections) {
    const h = sections[si] && sections[si].heading;
    if (h) out.push(h);
  }
  return out;
}
