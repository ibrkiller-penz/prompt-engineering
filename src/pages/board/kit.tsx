import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { CopyButton } from "../../components/ui";

/** 보드 꼭지의 쪽 순서 — 위 메뉴와 아래 '이전·다음'이 함께 쓴다 */
export const BOARD_PAGES = [
  { to: "/board", label: "시작", end: true },
  { to: "/board/buy", label: "준비물·구매", end: false },
  { to: "/board/pc", label: "PC 준비", end: false },
  { to: "/board/flash", label: "처음 굽기", end: false },
  { to: "/board/data", label: "내 시간표", end: false },
  { to: "/board/shake", label: "화면 흔들림", end: false },
  { to: "/board/help", label: "막힐 때", end: false },
  { to: "/board/brief", label: "AI 작업지시서", end: false },
] as const;

export function PageTitle({ tag, title, lead }: { tag: string; title: string; lead?: ReactNode }) {
  return (
    <header className="mb-6">
      <p className="text-sm font-semibold tracking-widest text-accent">{tag}</p>
      <h1 className="mt-1 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">{title}</h1>
      {lead && <p className="mt-3 max-w-3xl text-lg text-muted">{lead}</p>}
    </header>
  );
}

export function H2({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2 id={id} className="mt-10 scroll-mt-28 text-2xl font-extrabold leading-snug tracking-tight">
      {children}
    </h2>
  );
}

export function H3({ children }: { children: ReactNode }) {
  return <h3 className="mt-6 text-lg font-bold">{children}</h3>;
}

export function P({ children }: { children: ReactNode }) {
  return <p className="mt-3 max-w-3xl leading-relaxed">{children}</p>;
}

const TONES = {
  info: { box: "border-accent/40 bg-accent-soft", tag: "알아 두기", text: "text-accent" },
  warn: { box: "border-warn/40 bg-warn-soft", tag: "조심", text: "text-warn" },
  bad: { box: "border-bad/50 bg-bad-soft", tag: "꼭 지키기", text: "text-bad" },
  ok: { box: "border-ok/40 bg-ok-soft", tag: "확인", text: "text-ok" },
} as const;

export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: keyof typeof TONES;
  title?: string;
  children: ReactNode;
}) {
  const t = TONES[tone];
  return (
    <aside className={`mt-5 max-w-3xl rounded-card border p-4 ${t.box}`} role="note">
      <p className={`text-sm font-bold ${t.text}`}>{title ?? t.tag}</p>
      <div className="mt-1 leading-relaxed [&_code]:rounded [&_code]:bg-white/70 [&_code]:px-1">{children}</div>
    </aside>
  );
}

/** 복사 단추가 붙은 코드 상자 */
export function Code({ children, label = "복사" }: { children: string; label?: string }) {
  const text = children.replace(/\n$/, "");
  return (
    <div className="mt-3 max-w-3xl overflow-hidden rounded-card border border-line bg-[#1f2328]">
      <div className="flex justify-end border-b border-white/10 bg-white/5 px-2 py-1">
        <CopyButton text={text} label={label} />
      </div>
      <pre className="overflow-x-auto p-4 text-[0.9rem] leading-relaxed text-[#e6edf3]">
        <code>{text}</code>
      </pre>
    </div>
  );
}

/** 번호 단계: 1 2 3 … */
export function Steps({ children }: { children: ReactNode[] }) {
  return (
    <ol className="mt-4 max-w-3xl space-y-5">
      {children.map((c, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-ink">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1 leading-relaxed">{c}</div>
        </li>
      ))}
    </ol>
  );
}

export function Check({ children }: { children: ReactNode[] }) {
  return (
    <ul className="mt-3 max-w-3xl space-y-2">
      {children.map((c, i) => (
        <li key={i} className="flex gap-2">
          <span aria-hidden className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-ok text-xs text-ok">
            ✓
          </span>
          <span className="leading-relaxed">{c}</span>
        </li>
      ))}
    </ul>
  );
}

export function Table({ head, rows, small }: { head: string[]; rows: ReactNode[][]; small?: boolean }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-card border border-line bg-surface">
      <table className={`w-full min-w-[34rem] border-collapse text-left ${small ? "text-[0.9rem]" : ""}`}>
        <thead>
          <tr className="bg-bg">
            {head.map((h) => (
              <th key={h} scope="col" className="border-b border-line px-3 py-2 font-bold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="align-top">
              {r.map((c, j) => (
                <td key={j} className={`border-b border-line px-3 py-2 leading-relaxed ${j === 0 ? "font-semibold" : ""}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 보드 이름 칩 */
export function BoardChip({ board }: { board: "7" | "4" }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${
        board === "7" ? "bg-accent text-accent-ink" : "bg-ink text-white"
      }`}
    >
      {board === "7" ? "7인치" : "4인치"}
    </span>
  );
}

export function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener" className="font-semibold text-accent underline underline-offset-2">
      {children} ↗
    </a>
  );
}

export function PageNav({ current }: { current: string }) {
  const i = BOARD_PAGES.findIndex((p) => p.to === current);
  const prev = i > 0 ? BOARD_PAGES[i - 1] : null;
  const next = i >= 0 && i < BOARD_PAGES.length - 1 ? BOARD_PAGES[i + 1] : null;
  return (
    <nav aria-label="이전·다음 쪽" className="mt-14 flex flex-wrap justify-between gap-3 border-t border-line pt-6">
      {prev ? (
        <Link to={prev.to} className="inline-flex min-h-[44px] items-center rounded-card border border-line bg-surface px-4 font-semibold hover:border-accent">
          ← {prev.label}
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link to={next.to} className="inline-flex min-h-[44px] items-center rounded-card bg-accent px-4 font-semibold text-accent-ink hover:brightness-110">
          {next.label} →
        </Link>
      )}
    </nav>
  );
}
