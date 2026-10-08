import { useEffect } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { HUB_NAME } from "../site";
import { UNITS } from "./load";

export default function Layout() {
  const { pathname } = useLocation();
  const slug = pathname.split("/")[2];
  const unit = UNITS.find((u) => u.slug === slug);

  // 단원마다 포인트 색이 달라진다(사이트의 --accent 변수를 바꾼다)
  useEffect(() => {
    const html = document.documentElement;
    if (unit) html.dataset.aiunit = String(unit.id);
    else html.dataset.aiunit = "0";
    return () => {
      delete html.dataset.aiunit;
    };
  }, [unit]);

  useEffect(() => {
    document.title = `인공지능 수학 · ${HUB_NAME}`;
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:p-3">본문으로 건너뛰기</a>
      <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-1">
          <Link to="/aimath" className="flex min-h-[44px] min-w-0 items-center gap-2 font-extrabold tracking-tight">
            <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-ink">∑</span>
            <span className="truncate">인공지능 수학</span>
          </Link>
          <nav aria-label="바로가기" className="ml-auto flex shrink-0 gap-0.5 text-sm font-semibold">
            <NavLink to="/aimath/glossary" className={({ isActive }) => `flex min-h-[44px] items-center rounded-full px-3 ${isActive ? "bg-accent text-accent-ink" : "text-muted hover:bg-bg"}`}>용어 사전</NavLink>
            <NavLink to="/aimath/notebook" className={({ isActive }) => `flex min-h-[44px] items-center rounded-full px-3 ${isActive ? "bg-accent text-accent-ink" : "text-muted hover:bg-bg"}`}>오답노트</NavLink>
          </nav>
        </div>
        <div className="border-t border-line">
          <nav aria-label="대단원" className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4">
            {UNITS.map((u) => (
              <NavLink
                key={u.id}
                to={`/aimath/${u.slug}`}
                className={() =>
                  `flex min-h-[44px] shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm font-semibold ${
                    unit?.id === u.id ? "text-accent" : "border-transparent text-muted hover:text-ink"
                  }`
                }
                style={unit?.id === u.id ? { borderColor: u.color } : undefined}
              >
                <span aria-hidden>{u.icon}</span> {u.roman}. {u.title}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-8">
        <Outlet />
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-6 text-sm text-muted">
          <Link to="/" className="shrink-0" aria-label={HUB_NAME}>
            <img src="/icon-192.png" alt="" width={56} height={56} className="h-14 w-14 drop-shadow-sm" />
          </Link>
          <div className="min-w-0">
            <p className="font-semibold text-ink">© 2026 살빠진 임선생. All rights reserved.</p>
            <p className="mt-1">인공지능 수학 단원 구성에 맞춰 새로 쓴 학습 자료예요. 이야기·설명·문제·체험 도구는 모두 새로 만들었고, 교과서의 글과 문제를 옮기지 않았어요.</p>
            <p className="mt-1">푼 기록은 이 기기의 브라우저에만 저장되고 어디로도 보내지 않아요. <Link to="/" className="underline underline-offset-2">{HUB_NAME}</Link></p>
          </div>
        </div>
      </footer>
    </div>
  );
}
