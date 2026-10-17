// 진행 막대(퍼센트)와 단계 점 막대(카드 n장 중 몇 번째).
export function ProgressBar({ value, max, label, showText }: { value: number; max: number; label: string; showText?: boolean }) {
  const m = max > 0 ? max : 1;
  const v = Math.max(0, Math.min(m, value));
  const pct = Math.round((v / m) * 100);
  return (
    <div className="ui-progress">
      <div className="meter" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={m} aria-valuenow={v} aria-valuetext={v + " / " + m}>
        <i style={{ width: pct + "%" }} />
      </div>
      {showText ? (
        <span className="ui-progress-txt">
          {v}/{m}
        </span>
      ) : null}
    </div>
  );
}

/** 단계 점 막대: total 칸 중 앞 done 칸 채움, now 칸 강조 */
export function StepBar({ total, now, label }: { total: number; now: number; label: string }) {
  const cells = [];
  for (let i = 0; i < total; i++) cells.push(<i key={i} className={i < now ? "done" : i === now ? "now" : undefined} />);
  return (
    <div className="ui-stepbar" role="progressbar" aria-label={label} aria-valuemin={1} aria-valuemax={total} aria-valuenow={Math.min(total, now + 1)} aria-valuetext={Math.min(total, now + 1) + "번째 / 모두 " + total + "장"}>
      {cells}
    </div>
  );
}
