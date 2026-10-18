// 도구 상태가 바뀔 때마다 미션을 판정해 한 번만 알려 줘요. 처음 조작했을 때도 한 번 알려 줘요.
import { useEffect, useRef } from "react";
import type { WidgetProps } from "../contracts.ts";
import { runJudge, type MissionSet } from "./mission.types.ts";

export function useMission<S>(props: WidgetProps, set: MissionSet<S>, state: S): boolean {
  const key = JSON.stringify(state);
  const first = useRef(key);
  const touched = useRef(false);
  const done = useRef(false);
  const ok = runJudge(set, props.mission ? props.mission.judge : undefined, state);
  const onEvent = props.onEvent;

  useEffect(() => {
    if (!onEvent) return;
    if (!touched.current && key !== first.current) {
      touched.current = true;
      onEvent({ type: "interact" });
    }
    if (ok && !done.current && touched.current) {
      done.current = true;
      onEvent({ type: "mission", ok: true });
    }
  }, [key, ok, onEvent]);

  return ok && touched.current;
}
