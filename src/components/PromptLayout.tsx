import { useEffect } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { COURSE_NAME, HUB_NAME } from "../site";
import { LEVELS, getCards, getGlossary, getPledge, isLevel } from "../content/load";

export default function PromptLayout() {
  const { pathname } = useLocation();
  const seg = pathname.split("/")[2];
  const level = isLevel(seg) ? seg : undefined;
  const rest = level ? pathname.split("/").slice(3).join("/") : "";

  useEffect(() => {
    const html = document.documentElement;
    if (level) html.dataset.level = level;
    else delete html.dataset.level;
    return () => {
      delete html.dataset.level;
    };
  }, [level]);

  useEffect(() => {
    document.title = `${COURSE_NAME} · ${HUB_NAME}`;
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:p-3">
        본문으로 건너뛰기
      </a>
      <header className="no-print sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-1 sm:gap-4">
          <Link to="/prompt" className="flex min-h-[44px] min-w-0 items-center gap-2 font-extrabold tracking-tight">
            <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-ink">
              ↻
            </span>
            <span className="truncate text-[0.95rem] sm:text-base">{COURSE_NAME}</span>
          </Link>
          <nav aria-label="학교급" className="ml-auto flex shrink-0 gap-0.5">
            {LEVELS.map((l) => (
              <NavLink
                key={l.id}
                to={`/prompt/${l.id}${rest ? "/" + rest : ""}`}
                className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full px-2.5 text-sm font-semibold ${
                  level === l.id ? "bg-accent text-accent-ink" : "text-muted hover:bg-bg"
                }`}
              >
                {l.short}
              </NavLink>
            ))}
          </nav>
        </div>
        {level && (
          <div className="border-t border-line">
            <nav aria-label="메뉴" className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4">
              {[
                { to: `/prompt/${level}`, label: "전체보기", end: true, show: true },
                { to: `/prompt/${level}/lab`, label: "프롬프트 실험실", end: false, show: true },
                { to: `/prompt/${level}/cards`, label: "말 카드", end: false, show: !!getCards(level) },
                { to: `/prompt/${level}/glossary`, label: "사전", end: false, show: !!getGlossary(level) },
                { to: `/prompt/${level}/pledge`, label: "약속", end: false, show: !!getPledge(level) },
                { to: `/prompt/${level}/teacher`, label: "👩‍🏫 교사용", end: false, show: true },
              ]
                .filter((m) => m.show)
                .map((m) => (
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
        )}
      </header>

      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-8">
        <Outlet />
      </main>

      <footer className="no-print border-t border-line bg-surface">
        <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-muted">
          <p>
            원저작 『첫 결과물이 곧 완성은 아니다』 · 교재 부산 AI&amp;창의 교사 연구회
          </p>
          <p className="mt-1">
            이 사이트는 이름·연락처를 받지 않으며, 입력한 내용은 이 기기에만 저장돼요.{" "}
            <Link to="/prompt/about" className="underline underline-offset-2">
              이용 안내
            </Link>{" "}
            · <Link to="/" className="underline underline-offset-2">{HUB_NAME}</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
