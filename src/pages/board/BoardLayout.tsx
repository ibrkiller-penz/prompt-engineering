import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { BOARD_NAME, HUB_NAME } from "../../site";
import { BOARD_PAGES } from "./kit";
import { BoardModeProvider, ModeSwitch } from "./mode";

// 넓은 화면(1024px~): 왼쪽에 쪽 목록, 가운데 본문, 오른쪽(1280px~)에 이 쪽의 차례. 좁은 화면은 위쪽 가로 메뉴 그대로.
const WIDE = "mx-auto w-full max-w-[1600px] px-4 lg:px-8";

type TocItem = { id: string; text: string };

// 본문의 h2 를 모아 오른쪽 차례를 만든다(id 가 없는 제목에는 순서대로 붙인다)
function useToc(path: string) {
  const [items, setItems] = useState<TocItem[]>([]);
  const [active, setActive] = useState("");
  useEffect(() => {
    const main = document.getElementById("main");
    if (!main) return;
    const collect = () => {
      const hs = Array.from(main.querySelectorAll("h2"));
      hs.forEach((h, i) => {
        if (!h.id) h.id = `s${i + 1}`;
      });
      const next = hs.map((h) => ({ id: h.id, text: h.textContent?.trim() ?? "" })).filter((x) => x.text);
      setItems((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };
    collect();
    const mo = new MutationObserver(collect); // 탭 전환 등으로 제목이 바뀌면 다시 모은다
    mo.observe(main, { childList: true, subtree: true });
    const onScroll = () => {
      let cur = "";
      for (const h of Array.from(main.querySelectorAll("h2"))) {
        if (h.getBoundingClientRect().top < 160) cur = h.id;
      }
      setActive(cur);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      mo.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [path]);
  return { items, active };
}

export default function BoardLayout() {
  const { pathname } = useLocation();
  const { items, active } = useToc(pathname);
  useEffect(() => {
    document.title = `${BOARD_NAME} · ${HUB_NAME}`;
  }, []);

  return (
    <BoardModeProvider>
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:p-3">
        본문으로 건너뛰기
      </a>
      <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
        <div className={`${WIDE} flex items-center gap-3 py-1`}>
          <Link to="/board" className="flex min-h-[44px] min-w-0 items-center gap-2 font-extrabold tracking-tight">
            <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-ink">
              ▣
            </span>
            <span className="truncate text-[0.95rem] sm:text-base">{BOARD_NAME}</span>
          </Link>
          <div className="ml-auto">
            <ModeSwitch />
          </div>
          <Link to="/" className="hidden min-h-[44px] shrink-0 items-center text-sm font-semibold text-muted hover:text-ink sm:flex">
            교육자료 첫 화면
          </Link>
        </div>
        <div className="border-t border-line lg:hidden">
          <nav aria-label="쪽 이동" className={`${WIDE} flex gap-1 overflow-x-auto`}>
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

      <div className={`${WIDE} flex-1 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10 xl:grid-cols-[13rem_minmax(0,1fr)_14rem]`}>
        <aside className="hidden lg:block">
          <nav aria-label="쪽 이동" className="sticky top-[4.5rem] py-10">
            <p className="mb-3 px-3 text-xs font-bold tracking-widest text-muted">따라 하기</p>
            <ol className="space-y-1">
              {BOARD_PAGES.map((m, i) => (
                <li key={m.to}>
                  <NavLink
                    to={m.to}
                    end={m.end}
                    className={({ isActive }) =>
                      `flex min-h-[44px] items-center gap-3 rounded-card px-3 text-[0.95rem] font-semibold ${
                        isActive ? "bg-accent text-accent-ink" : "text-muted hover:bg-surface hover:text-ink"
                      }`
                    }
                  >
                    <span aria-hidden className="w-5 shrink-0 text-center text-sm tabular-nums opacity-70">
                      {i + 1}
                    </span>
                    {m.label}
                  </NavLink>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        <main id="main" className="min-w-0 py-8 sm:py-10">
          <Outlet />
        </main>

        <aside className="hidden xl:block">
          {items.length > 1 && (
            <nav aria-label="이 쪽 차례" className="sticky top-[4.5rem] max-h-[calc(100vh-5rem)] overflow-y-auto py-10">
              <p className="mb-3 text-xs font-bold tracking-widest text-muted">이 쪽 차례</p>
              <ul className="space-y-1 border-l border-line">
                {items.map((t) => (
                  <li key={t.id}>
                    <a
                      href={`#${t.id}`}
                      className={`-ml-px block border-l-2 py-1.5 pl-3 text-sm leading-snug ${
                        active === t.id ? "border-accent font-semibold text-accent" : "border-transparent text-muted hover:text-ink"
                      }`}
                    >
                      {t.text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </aside>
      </div>

      <footer className="border-t border-line bg-surface">
        <div className={`${WIDE} flex items-center gap-4 py-6 text-sm text-muted`}>
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
    </BoardModeProvider>
  );
}
