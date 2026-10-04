import type { ReactNode } from "react";
import FreeWrite from "./FreeWrite";
import MatchPairs from "./MatchPairs";
import CompareTable from "./CompareTable";
import RewriteVague from "./RewriteVague";
import Classify from "./Classify";
import RestateCheck from "./RestateCheck";
import FourLines from "./FourLines";
import MarkPassage from "./MarkPassage";
import VerifyTable from "./VerifyTable";
import FormFields, { type Field } from "./FormFields";
import ProjectSteps from "./ProjectSteps";

/** 칸 이름이 JSON에 없을 때 쓰는 기본값 (교재 공통 용어) */
export const DEFAULT_FIELDS: Record<string, Field[]> = {
  ChoiceRecord: [
    { key: "chosen", label: "① 고른 것" },
    { key: "why", label: "② 고른 이유" },
    { key: "dropped", label: "③ 버린 후보" },
    { key: "unsure", label: "④ 확실하지 않은 점" },
    { key: "revisit", label: "⑤ 다시 볼 조건" },
  ],
  RestartSix: [
    { key: "goal", label: "① 현재 목표" },
    { key: "done", label: "② 끝낸 것" },
    { key: "decided", label: "③ 확정한 선택과 이유" },
    { key: "gap", label: "④ 남은 문제" },
    { key: "open", label: "⑤ 아직 정하지 않은 것" },
    { key: "next", label: "⑥ 다음에 시작할 곳" },
  ],
  CloseFive: [
    { key: "problem", label: "① 처음 문제" },
    { key: "done", label: "② 완료 조건" },
    { key: "enough", label: "③ 충분한가?" },
    { key: "gap", label: "④ 남은 아쉬움" },
    { key: "reopen", label: "⑤ 다시 열 조건" },
  ],
  HonestyChecklist: [
    { key: "ai", label: "AI에게 도움받은 것" },
    { key: "me", label: "내가 직접 한 것" },
  ],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Comp = (p: any) => ReactNode;

const formAlias = (name: string): Comp =>
  function Alias(p: { fields?: Field[] } & Record<string, unknown>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <FormFields {...(p as any)} fields={p.fields ?? DEFAULT_FIELDS[name]} />;
  };

export const COMPONENTS: Record<string, Comp> = {
  FreeWrite,
  MatchPairs,
  CompareTable,
  RewriteVague,
  Classify,
  SortExtras: Classify,
  MisVsDiff: Classify,
  ReasonTags: (p) => <Classify lenient {...p} />,
  RestateCheck,
  FourLines,
  MarkPassage,
  VerifyTable,
  FormFields,
  ChoiceRecord: formAlias("ChoiceRecord"),
  RestartSix: formAlias("RestartSix"),
  CloseFive: formAlias("CloseFive"),
  HonestyChecklist: formAlias("HonestyChecklist"),
  ProjectSteps,
};

export function renderActivity(name: string, props: Record<string, unknown> | undefined, storeKey: string) {
  const C = COMPONENTS[name];
  if (!C) return <p className="text-bad">알 수 없는 활동: {name}</p>;
  return <C {...(props ?? {})} storeKey={storeKey} />;
}
