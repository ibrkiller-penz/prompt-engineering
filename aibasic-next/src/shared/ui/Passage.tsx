// 문제의 제시문(passage): 글·표·그림 블록을 문제 본문 앞의 상자에 보여 줘요.
import type { Block, Surface } from "../contracts.ts";
import { Blocks } from "./BlockView.tsx";

export function Passage({ blocks, surface }: { blocks?: Block[]; surface?: Surface }) {
  if (!blocks || !blocks.length) return null;
  return (
    <div className="ui-qpassage" role="group" aria-label="제시문">
      <Blocks blocks={blocks} surface={surface} />
    </div>
  );
}

/** 읽어 주기·길이 어림에 쓰는 제시문 글자 */
export function passageText(blocks?: Block[]): string {
  if (!blocks) return "";
  const out: string[] = [];
  for (const b of blocks) {
    if (b.t === "p") out.push(b.text);
    else if (b.t === "table") out.push([b.head.join(", ")].concat(b.rows.map((r) => r.join(", "))).join(". "));
  }
  return out.join(" ");
}
