// 체험 도구 자리(블록 t:"widget"). 등록부(widgets/registry)와 안내(data/widget-guides.json)를 이어 줘요.
// 도구 몸체는 화면에 들어갈 때만 불러와요(registry 가 lazy). 칠판에서 따로 크게 띄울 때는 openHref 를 줘요.
import type { Surface, WidgetEvent, WidgetGuide, WidgetGuides, WidgetId } from "../contracts.ts";
import GUIDES from "../../../data/widget-guides.json";
import WidgetHost from "../widgets/WidgetHost.tsx";
import { WIDGET_TITLES, isWidgetId } from "../widgets/ids.ts";
import { Rich } from "./tex.tsx";
import { useUiSurface } from "./surface.ts";

const G = GUIDES as unknown as WidgetGuides;

export function guideOf(id: WidgetId): WidgetGuide | undefined {
  return G[id];
}

export interface WidgetSlotProps {
  id: string;
  caption?: string;
  surface?: Surface;
  /** 틀(예상→조작→알게 된 점) 없이 조작 부분만 */
  bare?: boolean;
  /** 도구 대신 자리표만(인쇄·준비 화면 미리보기) */
  placeholder?: boolean;
  /** 자리표에서 '크게 열기' 링크 */
  openHref?: string;
  onEvent?: (e: WidgetEvent) => void;
}

export function WidgetSlot(props: WidgetSlotProps) {
  const sf = useUiSurface(props.surface);
  const id = props.id;
  if (!isWidgetId(id)) {
    return <p className="ui-note">이 체험 도구({id})는 아직 준비 중이에요.</p>;
  }
  const guide = guideOf(id);
  const title = guide && guide.title ? guide.title : WIDGET_TITLES[id];
  if (props.placeholder) {
    return (
      <div className={"ui-widget-ph is-" + sf}>
        <span className="ui-widget-tag">체험 도구</span>
        <strong className="ui-widget-title">{title}</strong>
        {props.caption ? (
          <p className="ui-widget-cap">
            <Rich text={props.caption} />
          </p>
        ) : null}
        {props.openHref ? (
          <a className="btn btn-soft" href={props.openHref}>
            크게 열기
          </a>
        ) : null}
      </div>
    );
  }
  return (
    <figure className={"ui-widget is-" + sf}>
      <WidgetHost id={id} surface={sf} guide={guide} bare={props.bare} onEvent={props.onEvent} />
      {props.caption ? (
        <figcaption className="ui-widget-cap">
          <Rich text={props.caption} />
        </figcaption>
      ) : null}
    </figure>
  );
}
