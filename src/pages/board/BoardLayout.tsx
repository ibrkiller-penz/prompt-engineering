import { useEffect } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { BOARD_NAME, HUB_NAME } from "../../site";
import { BOARD_PAGES } from "./kit";

export default function BoardLayout() {
  useEffect(() => {
    document.title = `${BOARD_NAME} · ${HUB_NAME}`;
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:p-3">
        본문으로 건너뛰기
      </a>
      <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-1">
          <Link to="/board" className="flex min-h-[44px] min-w-0 items-center gap-2 font-extrabold tracking-tight">
            <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-ink">
              ▣
            </span>
            <span className="truncate text-[0.95rem] sm:text-base">{BOARD_NAME}</span>
          </Link>
          <Link to="/" className="ml-auto flex min-h-[44px] shrink-0 items-center text-sm font-semibold text-muted hover:text-ink">
            교육자료 첫 화면
          </Link>
        </div>
        <div className="border-t border-line">
          <nav aria-label="쪽 이동" className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4">
            {BOARD_PAGES.map((m) => (
              <NavLink
                key={m.to}
                to={m.to}
                end={m.end}
                className={({ isActive }) =>
                  `flex min-h-[44px] shrink-0 items-center border-b-2 px-3 text-sm font-semibold ${
                    isActive ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"
                  }`
                }
              >
                {m.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:py-10">
        <Outlet />
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-6 text-sm text-muted">
          <Link to="/" className="shrink-0" aria-label={HUB_NAME}>
            <img src="/icon-192.png" alt="" width={56} height={56} className="h-14 w-14 drop-shadow-sm" />
          </Link>
          <div className="min-w-0">
            <p>
              Waveshare·Espressif 공식 문서와 직접 만들며 겪은 일을 바탕으로 썼어요. 보드·부품 이름은 각 제작사의 것이에요.
            </p>
            <p className="mt-1">
              이 사이트는 이름·연락처를 받지 않아요. 내려받는 키트에는 학교·교사 정보가 들어 있지 않아요.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
