// 초등 눈높이 게임(감염병 막기·어획량 정하기)에서 함께 쓰는 큰 글자 부품
import type { ReactNode } from "react";

/** 16px 이상 말풍선 */
export function Talk({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "ok" | "bad" }) {
  const c = tone === "ok" ? "border-ok/40 bg-ok-soft text-ok" : tone === "bad" ? "border-bad/30 bg-bad-soft text-bad" : "border-accent/25 bg-surface text-ink";
  const face = tone === "ok" ? "🥳" : tone === "bad" ? "😅" : "🙂";
  return (
    <p className={`gz-pop flex items-start gap-2 rounded-2xl border-2 px-4 py-3 text-base font-semibold leading-relaxed shadow-[0_3px_0_0_rgba(0,0,0,0.05)] ${c}`} role="status" aria-live="polite">
      <span aria-hidden className="text-xl leading-none">{face}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </p>
  );
}

/** 큰 숫자 알약 */
export function Pill({ label, value, tone = "plain" }: { label: string; value: ReactNode; tone?: "plain" | "ok" | "bad" }) {
  const c = tone === "ok" ? "border-ok/30 bg-ok-soft text-ok" : tone === "bad" ? "border-bad/30 bg-bad-soft text-bad" : "border-line bg-surface text-ink";
  return (
    <span className={`inline-flex items-baseline gap-1.5 rounded-full border-2 px-3 py-1 text-base shadow-[0_2px_0_0_rgba(0,0,0,0.05)] ${c}`}>
      <span>{label}</span>
      <strong className="font-game text-xl tabular-nums">{value}</strong>
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
