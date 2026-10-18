// 순수 로직에서 쓰는 최소 형식. 옛 src/aimath/types.ts 의 Block·Question 과 구조가 맞아서
// 그 값을 그대로 넘겨도 돼요(별칭 import 없이 node --test 로 바로 돌리려고 여기 따로 둬요).

export type Text = string;

export type LBlock =
  | { t: "p"; text: Text }
  | { t: "math"; tex: string | string[] }
  | { t: "term"; term: string; def: Text }
  | { t: "callout"; kind: "tip" | "warn" | "aha" | "try"; title?: string; text: Text }
  | { t: "table"; head: Text[]; rows: Text[][]; caption?: Text }
  | { t: "list"; items: Text[]; ordered?: boolean }
  | { t: "example"; title: Text; problem: Text; steps: Text[]; answer: Text }
  | { t: "dialog"; lines: { who: string; text: Text }[] }
  | { t: "widget"; id: string; caption?: Text };

interface QB {
  id: string;
  level?: number;
  prompt?: Text;
}
export type LQuestion =
  | (QB & { type: "choice"; choices: Text[]; answer: number })
  | (QB & { type: "number"; answer: number; tolerance?: number; unit?: string })
  | (QB & { type: "ox"; answer: boolean })
  | (QB & { type: "open" });
