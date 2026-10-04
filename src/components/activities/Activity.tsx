import type { Block } from "../../content/types";
import { Card, Label } from "../ui";
import FreeWrite from "./FreeWrite";
import MatchPairs from "./MatchPairs";
import CompareTable from "./CompareTable";
import RewriteVague from "./RewriteVague";
import SortExtras from "./SortExtras";
import RestateCheck from "./RestateCheck";
import FourLines from "./FourLines";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const COMPONENTS: Record<string, (p: any) => React.ReactNode> = {
  FreeWrite,
  MatchPairs,
  CompareTable,
  RewriteVague,
  SortExtras,
  RestateCheck,
  FourLines,
};

type ActivityBlock = Extract<Block, { type: "activity" }>;

export function Activity({ block, storeKey }: { block: ActivityBlock; storeKey: string }) {
  const C = COMPONENTS[block.component];
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Label>{typeof block.n === "number" ? `활동 ${block.n}` : block.n === "연습" ? "연습" : `활동 ${block.n}`}</Label>
        <h2 className="text-xl font-bold">{block.title}</h2>
      </div>
      {block.instruction && <p className="mb-3">{block.instruction}</p>}
      {block.situation && (
        <div className="mb-4 rounded-card border border-line bg-bg p-4">
          <p className="mb-1 text-sm font-bold text-accent">상황</p>
          <p>{block.situation}</p>
        </div>
      )}
      {C ? <C {...(block.props ?? {})} storeKey={storeKey} /> : <p className="text-bad">알 수 없는 활동: {block.component}</p>}
    </Card>
  );
}
