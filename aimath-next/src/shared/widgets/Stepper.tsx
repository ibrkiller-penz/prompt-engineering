// ± 스테퍼: [−] 값 [+]. 길게 누르면 반복해요. 칠판에서는 이것만, 휴대폰에서는 slider 를 켜면 미끄럼 막대도 함께 보여요.
import { useEffect, useRef } from "react";
import { repeatDelay, snapValue, stepValue } from "./stepper.logic.ts";
import { fmtNum } from "./plot.logic.ts";
import { useSurface } from "./kit.tsx";

export interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  /** 화면에 보일 값 글자(기본: 숫자) */
  format?: (v: number) => string;
  unit?: string;
  /** 휴대폰에서 미끄럼 막대도 보이기(칠판에서는 보이지 않아요) */
  slider?: boolean;
  disabled?: boolean;
}

export default function Stepper(props: StepperProps) {
  const { label, value, min, max, onChange, unit, disabled } = props;
  const step = props.step || 1;
  const surface = useSurface();
  const fmt = props.format || ((v: number) => fmtNum(v, 4));
  const vRef = useRef(value);
  vRef.current = value;
  const cbRef = useRef(onChange);
  cbRef.current = onChange;
  const timer = useRef<number | null>(null);
  const count = useRef(0);
  const fromPointer = useRef(false);

  const stop = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    count.current = 0;
  };
  useEffect(() => stop, []);

  const bump = (dir: 1 | -1) => {
    const next = stepValue(vRef.current, dir, step, min, max);
    if (next !== vRef.current) {
      vRef.current = next;
      cbRef.current(next);
      return true;
    }
    return false;
  };

  const tick = (dir: 1 | -1) => {
    timer.current = window.setTimeout(() => {
      count.current++;
      if (bump(dir)) tick(dir);
      else stop();
    }, repeatDelay(count.current));
  };

  const down = (dir: 1 | -1) => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || (e.button !== undefined && e.button !== 0)) return;
    fromPointer.current = true;
    stop();
    bump(dir);
    tick(dir);
  };
  const click = (dir: 1 | -1) => () => {
    // 포인터로 이미 한 칸 움직였으면 click 은 건너뛰어요(키보드 Enter·Space 만 여기서 처리)
    if (fromPointer.current) {
      fromPointer.current = false;
      return;
    }
    if (!disabled) bump(dir);
  };

  const shown = fmt(value) + (unit ? " " + unit : "");
  const showSlider = props.slider && surface !== "board";

  return (
    <div className={"wg-stepper" + (disabled ? " is-disabled" : "")} role="group" aria-label={label}>
      <span className="wg-stepper-label">{label}</span>
      <span className="wg-stepper-row">
        <button
          type="button"
          className="wg-btn wg-stepper-btn"
          aria-label={label + " 줄이기"}
          disabled={disabled || value <= min}
          onPointerDown={down(-1)}
          onPointerUp={stop}
          onPointerLeave={stop}
          onPointerCancel={stop}
          onContextMenu={(e) => e.preventDefault()}
          onKeyDown={() => (fromPointer.current = false)}
          onClick={click(-1)}
        >
          −
        </button>
        <output className="wg-stepper-value" aria-live="polite">
          {shown}
        </output>
        <button
          type="button"
          className="wg-btn wg-stepper-btn"
          aria-label={label + " 늘리기"}
          disabled={disabled || value >= max}
          onPointerDown={down(1)}
          onPointerUp={stop}
          onPointerLeave={stop}
          onPointerCancel={stop}
          onContextMenu={(e) => e.preventDefault()}
          onKeyDown={() => (fromPointer.current = false)}
          onClick={click(1)}
        >
          +
        </button>
      </span>
      {showSlider ? (
        <input
          className="wg-slider"
          type="range"
          aria-label={label}
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(snapValue(parseFloat(e.target.value), step, min, max))}
        />
      ) : null}
    </div>
  );
}
