// 준비 한 장의 순수 계산(이야기 장면 시간, 다음 차시 예고). 레슨 JSON 의 기존 필드만 써요.
import type { Scene } from "../../shared/contracts.ts";
import { minLabel } from "../today/timebar.ts";

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

/** 시간 배분 카드 위 안내 문구(해요체) */
export function storyAddText(a: StoryAdd, minutes: number): string {
  const head = "이야기 장면 " + a.count + "장을 모두 켜면 " + minLabel(a.add) + " 늘어서 예상 " + minLabel(a.after) + "이 돼요. ";
  return head + (a.over > 0 ? "수업 " + minutes + "분을 " + minLabel(a.over) + " 넘어요." : "수업 " + minutes + "분 안에 들어가요.");
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
