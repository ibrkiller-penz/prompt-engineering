import type { ReactNode } from "react";
import { useState } from "react";

/** **굵게** 와 줄바꿈(\n)만 지원하는 아주 작은 서식 */
export function Rich({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => (
        <span key={i}>
          {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
            part.startsWith("**") ? (
              <strong key={j} className="font-bold text-ink">
                {part.slice(2, -2)}
              </strong>
            ) : (
              part
            ),
          )}
          {i < lines.length - 1 && <br />}
        </span>
      ))}
    </>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-card border border-line bg-surface p-5 sm:p-6 ${className}`}>{children}</section>
  );
}

export function Label({ children, tone = "accent" }: { children: ReactNode; tone?: "accent" | "muted" }) {
  return (
    <span
      className={`inline-block rounded-full px-3 py-0.5 text-sm font-semibold ${
        tone === "accent" ? "bg-accent-soft text-accent" : "bg-line/60 text-muted"
      }`}
    >
      {children}
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  className = "",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "soft";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  const styles = {
    primary: "bg-accent text-accent-ink hover:brightness-110",
    soft: "bg-accent-soft text-accent hover:brightness-95",
    ghost: "border border-line bg-surface text-ink hover:bg-bg",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-card px-4 py-2 font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function CopyButton({ text, label = "복사" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 1500);
  };
  return (
    <Button variant="soft" onClick={copy}>
      {done ? "복사했어요 ✓" : label}
    </Button>
  );
}

export function Reveal({ label = "예시 답 보기", children }: { label?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="text-sm font-semibold text-accent underline underline-offset-4"
      >
        {open ? "예시 답 접기" : label}
      </button>
      {open && <div className="mt-2 rounded-card bg-accent-soft/60 p-3 text-[0.95rem]">{children}</div>}
    </div>
  );
}

export function TextArea({
  value,
  onChange,
  rows = 2,
  placeholder,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  label?: string;
}) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-[0.95rem] font-semibold">{label}</span>}
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full resize-y rounded-card border border-line bg-surface px-3 py-2 leading-relaxed outline-none focus:border-accent"
      />
    </label>
  );
}

export function Bubble({ speaker, text }: { speaker?: string; text: string }) {
  if (!speaker)
    return (
      <p className="leading-relaxed">
        <Rich text={text} />
      </p>
    );
  const ai = speaker === "AI";
  return (
    <div className={`flex gap-2 ${ai ? "" : "flex-row-reverse"}`}>
      <div
        aria-hidden
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          ai ? "bg-ink text-white" : "bg-accent text-accent-ink"
        }`}
      >
        {ai ? "AI" : speaker.slice(0, 1)}
      </div>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
          ai ? "rounded-tl-sm bg-surface border border-line" : "rounded-tr-sm bg-accent-soft"
        }`}
      >
        <span className="sr-only">{speaker}: </span>
        <span className="mb-0.5 block text-xs font-bold text-muted" aria-hidden>
          {speaker}
        </span>
        <Rich text={text} />
      </div>
    </div>
  );
}
