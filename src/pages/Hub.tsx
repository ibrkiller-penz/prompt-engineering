import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { HUB_NAME, SECTIONS } from "../site";
import SectionIcon from "../components/SectionIcon";

/** 설명은 두 줄까지만 보이고, 더 긴 설명(more)이 있으면 '더보기'로 펼친다 (카드 전체가 링크라서 클릭이 이동하지 않게 막는다) */
function Desc({ text, more }: { text: string; more?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <p className={`text-muted ${open ? "" : "line-clamp-2"}`}>{open && more ? more : text}</p>
      {more && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen((o) => !o);
          }}
          aria-expanded={open}
          className="mt-1 min-h-[32px] text-sm font-semibold text-muted underline underline-offset-4 hover:text-ink"
        >
          {open ? "접기" : "더보기"}
        </button>
      )}
    </div>
  );
}

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 비밀번호를 묻는 작은 창. 맞으면 links 가 있을 때는 고르는 화면으로, 없으면 onOk 로 간다. */
function LockDialog({
  title,
  lock,
  links,
  onOk,
  onClose,
}: {
  title: string;
  lock: string;
  links?: { label: string; href: string; note: string; download?: boolean; withCode?: boolean }[];
  onOk: () => void;
  onClose: () => void;
}) {
  const [pw, setPw] = useState("");
  const [bad, setBad] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((await sha256("penedu-lock:" + pw)) === lock) {
      if (links && links.length) setOpen(true);
      else onOk();
    } else {
      setBad(true);
      setPw("");
      ref.current?.focus();
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={`${title} 비밀번호`} onClick={onClose}>
      {open && links ? (
        <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-card border border-line bg-surface p-6 shadow-xl">
          <h2 className="text-xl font-extrabold">{title}</h2>
          <p className="mt-2 text-sm text-muted">{links.length > 1 ? "어떻게 쓸까요?" : "아래 파일을 받으세요."}</p>
          <ul className="mt-4 space-y-3">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href + (l.withCode ? "#c=" + encodeURIComponent(pw) : "")}
                  {...(l.download ? { download: true } : { target: "_blank", rel: "noopener" })}
                  onClick={onClose}
                  className="block rounded-card border border-line p-4 hover:border-accent hover:bg-accent-soft"
                >
                  <span className="font-bold text-accent">{l.label} {l.download ? "⬇" : "↗"}</span>
                  <span className="mt-1 block text-sm text-muted">{l.note}</span>
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted">저작권이 있는 영상은 이용 조건과 학교 지침을 먼저 확인해 주세요.</p>
          <button type="button" onClick={onClose} className="mt-4 min-h-[44px] w-full rounded-card border border-line px-4 font-semibold hover:bg-bg">
            닫기
          </button>
        </div>
      ) : (
        <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-card border border-line bg-surface p-6 shadow-xl">
          <h2 className="text-xl font-extrabold">🔒 {title}</h2>
          <p className="mt-2 text-sm text-muted">저작권 문제가 있을 수 있어서 비밀번호를 아는 분만 들어갈 수 있어요.</p>
          <input
            ref={ref}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pw}
            onChange={(e) => {
              setPw(e.target.value);
              setBad(false);
            }}
            aria-label="비밀번호"
            placeholder="비밀번호"
            className="mt-4 min-h-[44px] w-full rounded-card border border-line bg-bg px-3 text-lg outline-none focus:border-accent"
          />
          {bad && (
            <p className="mt-2 text-sm font-semibold text-bad" role="alert">
              비밀번호가 맞지 않아요.
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <button type="submit" className="min-h-[44px] flex-1 rounded-card bg-accent px-4 font-semibold text-accent-ink hover:brightness-110">
              들어가기
            </button>
            <button type="button" onClick={onClose} className="min-h-[44px] rounded-card border border-line px-4 font-semibold hover:bg-bg">
              닫기
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function Hub() {
  const [locked, setLocked] = useState<{ title: string; lock: string; path: string; links?: { label: string; href: string; note: string; download?: boolean; withCode?: boolean }[] } | null>(null);
  useEffect(() => {
    document.title = HUB_NAME;
  }, []);
  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-4xl px-4 py-12 sm:py-20">
        <div className="flex items-center gap-4 sm:gap-6">
          <img
            src="/icon-512.png"
            alt="살빠진 임선생"
            width={512}
            height={512}
            className="h-20 w-20 shrink-0 drop-shadow-md sm:h-32 sm:w-32"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-widest text-accent">PENEDU</p>
            <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">{HUB_NAME}</h1>
            <p className="mt-3 max-w-2xl text-lg text-muted">수업에 바로 쓰는 교육자료를 한곳에 모았어요.</p>
          </div>
        </div>

        {SECTIONS.filter((s) => s.featured).map((s) => (
          <Link
            key={s.path}
            to={s.path}
            className="group mt-10 flex flex-col gap-4 rounded-card border-2 border-accent bg-surface p-5 shadow-sm transition hover:shadow-lg sm:flex-row sm:items-center sm:gap-6 sm:p-6"
          >
            <SectionIcon path={s.path} size={64} />
            <div className="min-w-0 flex-1">
              <span className="inline-block rounded-full bg-accent-soft px-3 py-0.5 text-sm font-semibold text-accent">{s.tag}</span>
              <h2 className="mt-1 text-2xl font-extrabold leading-tight sm:text-3xl">{s.title}</h2>
              <p className="mt-1 text-muted">{s.desc}</p>
            </div>
            <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
              <span className="flex gap-1.5 text-sm font-bold" aria-label="ChatGPT, Claude, Gemini용">
                <span className="rounded-full bg-ink px-3 py-1 text-white">ChatGPT</span>
                <span className="rounded-full bg-ink px-3 py-1 text-white">Claude</span>
                <span className="rounded-full bg-ink px-3 py-1 text-white">Gemini</span>
              </span>
              <span className="inline-flex min-h-[44px] items-center rounded-card bg-accent px-4 font-semibold text-accent-ink group-hover:brightness-110">
                {s.cta ?? "들어가기 →"}
              </span>
            </div>
          </Link>
        ))}

        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {SECTIONS.filter((s) => !s.featured).map((s) => {
            const cls =
              "group block h-full rounded-card border border-line bg-surface p-6 transition hover:-translate-y-0.5 hover:border-accent hover:shadow-lg";
            const inner = (
              <>
                <span className="inline-block rounded-full bg-accent-soft px-3 py-0.5 text-sm font-semibold text-accent">{s.tag}</span>
                <div className="mt-3 flex items-center gap-3">
                  <SectionIcon path={s.path} size={44} />
                  <h2 className="text-2xl font-extrabold leading-tight">{s.title}</h2>
                </div>
                <Desc text={s.desc} more={s.more} />
                <span className="mt-3 inline-block font-semibold text-accent group-hover:underline">{s.cta ?? "들어가기 →"}</span>
              </>
            );
            return (
              <li key={s.path}>
                {s.external ? (
                  <a
                    href={s.lock ? "#" : s.path}
                    target="_blank"
                    rel="noopener"
                    className={cls}
                    onClick={
                      s.lock
                        ? (e) => {
                            e.preventDefault();
                            setLocked({ title: s.title, lock: s.lock!, path: s.path, links: s.unlocked });
                          }
                        : undefined
                    }
                  >
                    {inner}
                  </a>
                ) : (
                  <Link to={s.path} className={cls}>
                    {inner}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </main>
      {locked && (
        <LockDialog
          title={locked.title}
          lock={locked.lock}
          links={locked.links}
          onClose={() => setLocked(null)}
          onOk={() => {
            window.open(locked.path, "_blank", "noopener");
            setLocked(null);
          }}
        />
      )}
    </div>
  );
}
