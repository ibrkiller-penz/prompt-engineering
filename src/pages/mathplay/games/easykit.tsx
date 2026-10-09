// 초등 눈높이 게임(감염병 막기·어획량 정하기)에서 함께 쓰는 큰 글자 부품
import type { ReactNode } from "react";

/** 16px 이상 말풍선 */
export function Talk({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "ok" | "bad" }) {
  const c = tone === "ok" ? "bg-ok-soft text-ok" : tone === "bad" ? "bg-bad-soft text-bad" : "bg-accent-soft/70 text-ink";
  return (
    <p className={`rounded-card px-4 py-3 text-base font-semibold leading-relaxed ${c}`} role="status" aria-live="polite">
      {children}
    </p>
  );
}

/** 큰 숫자 알약 */
export function Pill({ label, value, tone = "plain" }: { label: string; value: ReactNode; tone?: "plain" | "ok" | "bad" }) {
  const c = tone === "ok" ? "bg-ok-soft text-ok" : tone === "bad" ? "bg-bad-soft text-bad" : "bg-bg text-ink";
  return (
    <span className={`inline-flex items-baseline gap-1.5 rounded-full px-4 py-1.5 text-base ${c}`}>
      <span>{label}</span>
      <strong className="text-lg font-extrabold tabular-nums">{value}</strong>
    </span>
  );
}

/** 별 0~max 개 */
export function Stars({ n, max = 3 }: { n: number; max?: number }) {
  return (
    <span className="text-2xl tracking-wider text-[#f59e0b]" role="img" aria-label={`별 ${max}개 중 ${n}개`}>
      {"★".repeat(n)}
      <span className="opacity-30">{"☆".repeat(max - n)}</span>
    </span>
  );
}

/** 48px 이상 큰 단추용 덧붙임 클래스 */
export const BIG = "min-h-[48px]! text-base";
