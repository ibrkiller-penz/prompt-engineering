// 저장 값을 React 화면에서 쓰는 훅. 같은 탭(STORE_EVENT)과 다른 탭(storage) 변경을 모두 따라가요.
import { useCallback, useEffect, useState } from "react";
import { STORE_EVENT, type Store } from "./store.ts";

export function useStored<D, K extends keyof D & string>(store: Store<D>, key: K, fallback: D[K]): [D[K], (v: D[K] | ((cur: D[K]) => D[K])) => void] {
  const [v, setV] = useState<D[K]>(() => store.read(key, fallback));
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ prefix: string; key: string }>).detail;
      if (e.type === STORE_EVENT && d && d.prefix === store.prefix && d.key !== key && d.key !== "*") return;
      setV(store.read(key, fallback));
    };
    window.addEventListener(STORE_EVENT, on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener(STORE_EVENT, on);
      window.removeEventListener("storage", on);
    };
    // fallback 은 처음 값만 써요(객체 리터럴이 매번 바뀌어도 다시 구독하지 않게)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, key]);
  const set = useCallback(
    (next: D[K] | ((cur: D[K]) => D[K])) => {
      const val = typeof next === "function" ? (next as (cur: D[K]) => D[K])(store.read(key, fallback)) : next;
      store.write(key, val);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, key],
  );
  return [v, set];
}
