// 불러오는 동안 보여 주는 뼈대 화면(수업 흐름·차시 찾기 공용).
// 5초가 넘도록 끝나지 않으면 '다시 불러오기' 단추를 보여 줘요. 사진 검사(shots)는 .ui-loading 이 사라질 때까지 기다려요.
import { useEffect, useState } from "react";

export const SLOW_MS = 5000;

export function reloadPage(): void {
  try {
    window.location.reload();
  } catch (e) {
    /* 무시 */
  }
}

/** 5초가 지났는지(지나면 true) */
export function useSlow(active: boolean, ms: number = SLOW_MS): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!active) {
      setSlow(false);
      return;
    }
    const t = window.setTimeout(() => setSlow(true), ms);
    return () => window.clearTimeout(t);
  }, [active, ms]);
  return slow;
}

/** 줄 모양 뼈대(rows 줄) + 5초 뒤 다시 불러오기 */
export function Skeleton({ label, rows = 6, side = false }: { label: string; rows?: number; side?: boolean }) {
  const slow = useSlow(true);
  const lines: number[] = [];
  for (let i = 0; i < rows; i++) lines.push(i);
  return (
    <div className={"ui-loading t-skel" + (side ? " has-side" : "")} role="status" aria-live="polite" aria-busy="true">
      <p className="t-skel-msg">
        <span className="t-spinner" aria-hidden="true" />
        <span>{slow ? "생각보다 오래 걸리고 있어요." : label}</span>
        {slow ? (
          <button type="button" className="btn btn-primary t-skel-retry" onClick={reloadPage}>
            다시 불러오기
          </button>
        ) : null}
      </p>
      <div className="t-skel-body" aria-hidden="true">
        {side ? (
          <div className="t-skel-side">
            <i className="t-skel-bar is-lg" />
            <i className="t-skel-bar" />
            <i className="t-skel-bar is-short" />
            <i className="t-skel-bar is-btn" />
          </div>
        ) : null}
        <div className="t-skel-main">
          {lines.map((i) => (
            <i key={i} className={"t-skel-bar is-row" + (i % 3 === 2 ? " is-short" : "")} />
          ))}
        </div>
      </div>
    </div>
  );
}
