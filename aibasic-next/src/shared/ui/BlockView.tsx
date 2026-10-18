// 콘텐츠 블록 하나를 그려요(학생 카드·칠판 장면·준비 화면·인쇄 공용).
//   p → 문단 · math → MathBlock · code → CodeBlock · table → StackTable · term → TermView
//   callout → Callout · example → StepReveal · dialog → Bubbles · widget → WidgetSlot · list → 목록
// where/path 를 주면 data/overrides/tone.json 의 칩(예: "가상의 예")을 붙여요.
import type { Block, Surface, WidgetEvent } from "../contracts.ts";
import { chips as chipsOf } from "../../content/overrides.ts";
import { Rich } from "./tex.tsx";
import { MathBlock } from "./MathBlock.tsx";
import { CodeBlock } from "./CodeBlock.tsx";
import { StackTable } from "./StackTable.tsx";
import { TermView } from "./Term.tsx";
import { Callout } from "./Callout.tsx";
import { StepReveal } from "./StepReveal.tsx";
import { Bubbles } from "./Bubbles.tsx";
import { WidgetSlot } from "./WidgetSlot.tsx";
import { useUiSurface } from "./surface.ts";

export interface BlockViewProps {
  block: Block;
  surface?: Surface;
  /** 칩을 찾을 문서(레슨 id "u1-1" 또는 단원 "u1") */
  where?: string;
  /** 문서 안 이 블록의 경로(예 "sections.0.blocks.2") */
  path?: string;
  /** 예제·대화의 공개 단계(칠판). 없으면 학생 방식(안쪽 단추) */
  shown?: number;
  /** 예제를 처음부터 모두 펼침(인쇄·준비 화면) */
  openAll?: boolean;
  /** 체험 도구를 자리표로만(인쇄·준비 화면) */
  widgetPlaceholder?: boolean;
  /** 체험 도구 '크게 열기' 주소 만들기 */
  widgetHref?: (id: string) => string | undefined;
  onWidgetEvent?: (id: string, e: WidgetEvent) => void;
}

function chipList(where: string | undefined, path: string | undefined, field: string, text: string): string[] | undefined {
  if (!where || !path) return undefined;
  const c = chipsOf(where, path + "." + field, text);
  return c.length ? c : undefined;
}

export function BlockView(props: BlockViewProps) {
  const { block: b, where, path } = props;
  const sf = useUiSurface(props.surface);
  switch (b.t) {
    case "p":
      return (
        <p className={"ui-p is-" + sf}>
          <Rich text={b.text} chips={chipList(where, path, "text", b.text)} />
        </p>
      );
    case "math":
      return <MathBlock tex={b.tex} surface={sf} />;
    case "code":
      return <CodeBlock code={b.code} lang={b.lang} surface={sf} />;
    case "table":
      return <StackTable head={b.head} rows={b.rows} caption={b.caption} surface={sf} />;
    case "term":
      return <TermView term={b.term} def={b.def} surface={sf} />;
    case "callout":
      return <Callout kind={b.kind} title={b.title} text={b.text} surface={sf} chips={chipList(where, path, "text", b.text)} />;
    case "list": {
      const items = b.items.map((it, i) => (
        <li key={i}>
          <Rich text={it} chips={chipList(where, path, "items." + i, it)} />
        </li>
      ));
      return b.ordered ? <ol className={"ui-list is-" + sf}>{items}</ol> : <ul className={"ui-list is-" + sf}>{items}</ul>;
    }
    case "example":
      return <StepReveal title={b.title} problem={b.problem} steps={b.steps} answer={b.answer} surface={sf} shown={props.shown} open={props.openAll} />;
    case "dialog":
      return <Bubbles lines={b.lines} surface={sf} shown={props.shown} />;
    case "widget":
      return (
        <WidgetSlot
          id={b.id}
          caption={b.caption}
          surface={sf}
          placeholder={props.widgetPlaceholder}
          openHref={props.widgetHref ? props.widgetHref(b.id) : undefined}
          onEvent={props.onWidgetEvent ? (e) => (props.onWidgetEvent as (id: string, e: WidgetEvent) => void)(b.id, e) : undefined}
        />
      );
    default:
      return null;
  }
}

export interface BlocksProps extends Omit<BlockViewProps, "block" | "path" | "shown"> {
  blocks: Block[];
  /** 블록들이 있는 경로(예 "sections.0.blocks"). 블록마다 ".i" 를 붙여요 */
  basePath?: string;
  /** blocks 의 i 번째가 원래 몇 번째 블록인지(카드로 나눴을 때) */
  idx?: number[];
}

/** 블록 여러 개(간격은 > * + * 여백) */
export function Blocks(props: BlocksProps) {
  const { blocks, basePath, idx, ...rest } = props;
  return (
    <div className="ui-blocks">
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} path={basePath != null ? basePath + "." + (idx ? idx[i] : i) : undefined} {...rest} />
      ))}
    </div>
  );
}
