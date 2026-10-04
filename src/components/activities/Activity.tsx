import type { Block } from "../../content/types";
import { Card, Label, Rich } from "../ui";
import { renderActivity } from "./registry";

type ActivityBlock = Extract<Block, { type: "activity" }>;

export function Activity({ block, storeKey }: { block: ActivityBlock; storeKey: string }) {
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Label>{block.n === "연습" ? "연습" : `활동 ${block.n}`}</Label>
        <h2 className="text-xl font-bold">{block.title}</h2>
      </div>
      {block.instruction && (
        <p className="mb-3">
          <Rich text={block.instruction} />
        </p>
      )}
      {block.situation && (
        <div className="mb-4 rounded-card border border-line bg-bg p-4">
          <p className="mb-1 text-sm font-bold text-accent">상황</p>
          <p>
            <Rich text={block.situation} />
          </p>
        </div>
      )}
      {renderActivity(block.component, block.props, storeKey)}
    </Card>
  );
}
