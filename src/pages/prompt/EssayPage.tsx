import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageFlip } from "page-flip/dist/js/page-flip.module.js";
import essay from "../../../content/prompt/essay.json";

const pageSrc = (n: number) => `/essay/p${String(n).padStart(3, "0")}.webp`;

/** 수필 『다 된 줄 알았다』 플립북 — PC는 두 쪽 펼침, 좁은 화면은 한 쪽씩 */
export default function EssayPage() {
  const host = useRef<HTMLDivElement>(null);
  const book = useRef<PageFlip | null>(null);
  const [sp] = useSearchParams();
  const startPage = Math.min(essay.pages, Math.max(1, Number(sp.get("p")) || 1));
  const [page, setPage] = useState(startPage - 1);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    // page-flip이 DOM을 직접 다루므로 React가 관리하지 않는 상자를 따로 만든다
    const stage = document.createElement("div");
    el.appendChild(stage);
    const pages: HTMLElement[] = [];
    for (let n = 1; n <= essay.pages; n++) {
      const p = document.createElement("div");
      p.className = "essay-page";
      const img = document.createElement("img");
      img.alt = `${n}쪽`;
      img.loading = n <= 4 || Math.abs(n - startPage) <= 3 ? "eager" : "lazy";
      img.src = pageSrc(n);
      img.draggable = false;
      p.appendChild(img);
      stage.appendChild(p);
      pages.push(p);
    }
    const pf = new PageFlip(stage, {
      width: 450,
      height: 639,
      size: "stretch",
      minWidth: 260,
      maxWidth: 620,
      minHeight: 370,
      maxHeight: 880,
      showCover: true,
      usePortrait: true,
      mobileScrollSupport: false,
      maxShadowOpacity: 0.35,
      flippingTime: 700,
      startPage: startPage - 1,
    });
    pf.loadFromHTML(pages);
    pf.on("flip", (e) => setPage(Number(e.data)));
    book.current = pf;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") pf.flipNext();
      if (e.key === "ArrowLeft") pf.flipPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      try {
        pf.destroy();
      } catch {
        /* 이미 지워짐 */
      }
      stage.remove();
      book.current = null;
    };
    // 처음 한 번만 만든다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = (n: number) => book.current?.flip(n - 1);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-semibold text-accent">수필 보기</p>
          <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">『{essay.title}』</h1>
          <p className="text-muted">{essay.subtitle}</p>
        </div>
        <Link to="/prompt" className="text-sm font-semibold text-accent underline underline-offset-4">
          ← 다시 묻는 AI 교실
        </Link>
      </div>

      <details className="mt-4 rounded-card border border-line bg-surface p-3">
        <summary className="min-h-[36px] cursor-pointer font-semibold">차례로 바로 가기</summary>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {essay.toc.map((t) => (
            <li key={t.page}>
              <button
                type="button"
                onClick={() => go(t.page)}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-accent-soft"
              >
                <span>{t.label}</span>
                <span className="shrink-0 text-sm text-muted">
                  {t.lessons ? `${t.lessons.join("·")}차시 · ` : ""}
                  {t.page}쪽
                </span>
              </button>
            </li>
          ))}
        </ul>
      </details>

      <div className="essay-book mt-5 select-none" ref={host} aria-label="수필 책" />

      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => book.current?.flipPrev()}
          className="min-h-[44px] rounded-card border border-line bg-surface px-4 font-semibold"
        >
          ← 앞쪽
        </button>
        <span className="min-w-[90px] text-center text-sm text-muted" aria-live="polite">
          {page + 1} / {essay.pages}쪽
        </span>
        <button
          type="button"
          onClick={() => book.current?.flipNext()}
          className="min-h-[44px] rounded-card bg-accent px-4 font-semibold text-accent-ink"
        >
          뒤쪽 →
        </button>
      </div>
      <p className="mt-3 text-center text-sm text-muted">책장 모서리를 끌거나, ← → 키나 버튼으로 넘겨요.</p>
      <p className="mt-6 text-xs text-muted">{essay.note}</p>
    </div>
  );
}
