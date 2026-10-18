// 체험 도구 하나를 화면에 놓는 곳: 표면 문맥 + 틀(ToolFrame) + 늦게 불러오기(Suspense) + 오류 막이.
// 쓰는 쪽: <WidgetHost id="knn" surface="phone" guide={guides.knn} onEvent={...} />
// guide 는 data/widget-guides.json 의 한 항목이에요(불러오기는 쓰는 쪽에서 해요).
import { Component, Suspense, useState } from "react";
import type { ReactNode } from "react";
import type { Surface, WidgetEvent, WidgetGuide, WidgetId } from "../contracts.ts";
import { WIDGETS, WIDGET_TITLES } from "./registry.ts";
import { HideContext, SurfaceContext } from "./kit.tsx";
import ToolFrame from "./ToolFrame.tsx";

export interface WidgetHostProps {
  id: WidgetId;
  surface: Surface;
  guide?: WidgetGuide;
  /** 틀 없이 조작 부분만(칠판 장면 안에 작게 넣을 때) */
  bare?: boolean;
  onEvent?: (e: WidgetEvent) => void;
}

class Guard extends Component<{ children: ReactNode }, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError() {
    return { err: true };
  }
  render() {
    if (this.state.err)
      return (
        <p className="wg-note" role="alert">
          체험 도구를 여는 중에 문제가 생겼어요. 화면을 새로 고쳐 다시 해 봐요.
        </p>
      );
    return this.props.children;
  }
}

export default function WidgetHost(props: WidgetHostProps) {
  const { id, surface, guide, onEvent } = props;
  const board = surface === "board";
  const [missionOk, setMissionOk] = useState(false);
  // 처음으로: 도구를 새로 그려서 모든 값을 처음 상태로 돌려요
  const [gen, setGen] = useState(0);
  // 결과 가리기: 칠판에서는 먼저 예상을 듣고 보여 주도록 처음에 켜 둬요
  const [hidden, setHidden] = useState(board);
  const [said, setSaid] = useState("");
  const W = WIDGETS[id];
  if (!W) return <p className="wg-note">이 체험 도구는 아직 준비 중이에요.</p>;

  const handle = (e: WidgetEvent) => {
    if (e.type === "mission" && e.ok && !missionOk) {
      setMissionOk(true);
      setSaid("미션 성공이에요! 잘했어요.");
    }
    if (onEvent) onEvent(e);
  };
  const reset = () => {
    setGen(gen + 1);
    setSaid("처음 상태로 돌아왔어요.");
  };
  const tools = (
      <div className="wg-tools" role="group" aria-label="도구 단추">
        <button type="button" className="wg-btn wg-btn-small" onClick={reset}>
          처음으로
        </button>
        <button type="button" className={"wg-btn wg-btn-small" + (hidden ? " is-on" : "")} aria-pressed={hidden} onClick={() => setHidden(!hidden)}>
          {hidden ? "결과 보이기" : "결과 가리기"}
        </button>
        {missionOk && props.bare ? (
          <span className="wg-mission-chip">
            <span aria-hidden="true">✓ </span>미션 성공
          </span>
        ) : null}
      </div>
  );
  // 칠판 틀에서는 도구 단추를 위쪽 안내 띠로 옮겨 도구의 세로 자리를 아껴요
  const toolsInSide = board && !props.bare && !!guide;
  const body = (
    <Guard>
      {toolsInSide ? null : tools}
      <HideContext.Provider value={hidden}>
        <Suspense fallback={<p className="wg-note">체험 도구를 불러오고 있어요…</p>}>
          <W key={gen} surface={surface} mission={guide ? guide.mission : undefined} onEvent={handle} />
        </Suspense>
      </HideContext.Provider>
      <p className="wg-sr" aria-live="polite" aria-atomic="true">
        {said}
      </p>
    </Guard>
  );
  const title = guide && guide.title ? guide.title : WIDGET_TITLES[id];

  return (
    <SurfaceContext.Provider value={surface}>
      <div className={"wg-host wg-w-" + id + " wg-on-" + surface + (board ? " is-board" : "")} data-widget={id} data-noswipe="">
        {props.bare ? (
          body
        ) : (
          <ToolFrame title={title} surface={surface} guide={guide} missionOk={missionOk} onEvent={onEvent} sideTools={toolsInSide ? tools : undefined}>
            {body}
          </ToolFrame>
        )}
      </div>
    </SurfaceContext.Provider>
  );
}
