// 숫자 답 입력판의 기호 줄: / − . √ π (휴대폰 키보드에서 찾기 어려운 것만). 숫자는 기기 키보드로 써요.
// 칠판에서는 숫자 단추까지 모두 보여요(전자칠판은 화면 키보드가 불편해서).
// 키는 높이 44px 이상, 지우기 키에는 '지우기' 글자를 함께 붙여요.
import type { Surface } from "../contracts.ts";
import { useUiSurface } from "./surface.ts";

const SYMS: { k: string; label: string; name: string }[] = [
  { k: "/", label: "/", name: "분수 막대" },
  { k: "-", label: "−", name: "빼기(음수)" },
  { k: ".", label: ".", name: "소수점" },
  { k: "√", label: "√", name: "제곱근" },
  { k: "π", label: "π", name: "파이" },
];
const DIGITS = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "0"];

export interface NumberPadProps {
  onKey: (k: string) => void;
  onBack?: () => void;
  surface?: Surface;
  /** 숫자 단추도 보이기(기본: 칠판에서만) */
  digits?: boolean;
  disabled?: boolean;
  /** 보일 기호 키(예: ["/","√"]). 없으면 모두, 빈 배열이면 기호 없이 숫자·지우기만(padKeysForQuestion 으로 구해요). '/' 가 있을 때만 분수 안내가 나와요 */
  keys?: string[];
}

export function NumberPad({ onKey, onBack, surface, digits, disabled, keys }: NumberPadProps) {
  const sf = useUiSurface(surface);
  const showDigits = digits != null ? digits : sf === "board";
  const syms = keys ? SYMS.filter((s) => keys.indexOf(s.k) >= 0) : SYMS;
  const hasFrac = syms.some((s) => s.k === "/");
  return (
    <div className={"ui-pad is-" + sf} role="group" aria-label="기호 입력">
      {showDigits ? (
        <div className="ui-pad-digits">
          {DIGITS.map((d) => (
            <button key={d} type="button" className="ui-pad-key" style={{ minHeight: 44 }} disabled={disabled} onClick={() => onKey(d)}>
              {d}
            </button>
          ))}
        </div>
      ) : null}
      <div className="ui-pad-syms">
        {syms.map((s) => (
          <button key={s.k} type="button" className="ui-pad-key" style={{ minHeight: 44 }} aria-label={s.name} title={s.name} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => onKey(s.k)}>
            {s.label}
          </button>
        ))}
        {onBack ? (
          <button
            type="button"
            className="ui-pad-key is-back"
            aria-label="한 글자 지우기"
            title="한 글자 지우기"
            style={{ minHeight: 44 }}
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onBack}
          >
            <span aria-hidden="true">⌫ </span>
            <span style={{ fontSize: "0.8em" }}>지우기</span>
          </button>
        ) : null}
      </div>
      {hasFrac ? <p className="ui-pad-note">분수는 이렇게 적어요. 예: 1/3</p> : null}
    </div>
  );
}
