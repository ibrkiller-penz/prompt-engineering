// 부품이 놓인 표면(휴대폰·준비 화면·칠판)과 넘침 감지 훅.
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { Surface } from "../contracts.ts";

/** 감싸는 쪽이 표면을 정해 줄 때(칠판 무대 등). 없으면 html[data-surface] 를 읽어요 */
export const UiSurfaceContext = createContext<Surface | null>(null);

function htmlSurface(): Surface {
  try {
    const s = document.documentElement.getAttribute("data-surface");
    return s === "board" || s === "prep" ? s : "phone";
  } catch {
    return "phone";
  }
}

/** prop → 문맥 → html 속성 순서로 표면을 골라요 */
export function useUiSurface(prop?: Surface): Surface {
  const ctx = useContext(UiSurfaceContext);
  return prop || ctx || htmlSurface();
}

const useIsoLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * 가로로 넘치는지 살펴요. 넘치면 true. 창 크기·글자 크기(data-fs)가 바뀌어도 다시 재요.
 * ResizeObserver 는 Chrome 64+ 라 Chrome 80 에서 돼요. 없으면 창 크기 변화만 봐요.
 */
export function useOverflowX<T extends HTMLElement>(deps: unknown[] = []): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [over, setOver] = useState(false);
  useIsoLayout(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => {
      const o = el.scrollWidth - el.clientWidth > 2;
      setOver((cur) => (cur === o ? cur : o));
    };
    check();
    let ro: ResizeObserver | null = null;
    const W = window as unknown as { ResizeObserver?: typeof ResizeObserver };
    if (W.ResizeObserver) {
      ro = new W.ResizeObserver(check);
      ro.observe(el);
      if (el.firstElementChild) ro.observe(el.firstElementChild);
    }
    window.addEventListener("resize", check);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", check);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return [ref, over];
}
