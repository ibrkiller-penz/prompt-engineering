import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { HUB_NAME } from "../../site";
import GameModal from "./GameModal";
import Thumb from "./Thumb";
import { FLOORS, GAMES, gameById, type Floor, type GameDef } from "./games/registry";
import { useGameFont } from "./theme";

const MORE: { name: string; href: string; note: string }[] = [
  { name: "Panchang Paheli", href: "https://ccl.iitgn.ac.in/panchang-paheli", note: "펜토미노 달력 퍼즐을 날마다(영어)" },
  { name: "Transum — Pentominoes", href: "https://www.transum.org/maths/activity/jigsaw/Pentominoes.asp", note: "펜토미노 12조각 채우기(영어)" },
  { name: "Transum — Tetrominoes", href: "https://www.transum.org/maths/activity/jigsaw/Tetrominoes.asp", note: "테트로미노 직사각형 채우기(영어)" },
  { name: "Mathigon Polypad", href: "https://mathigon.org/polypad", note: "펜토미노·탱그램 디지털 교구(영어)" },
];

/** 게임 타일: 썸네일 + 이름 */
function Tile({ g, onOpen, dark = false }: { g: GameDef; onOpen: (id: string) => void; dark?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(g.id)}
      className={`group block w-full overflow-hidden rounded-[22px] text-left transition duration-200 hover:-translate-y-1 hover:rotate-[-1deg] active:scale-95 ${
        dark ? "bg-white/10 shadow-[0_5px_0_0_rgba(0,0,0,0.35)]" : "bg-white shadow-[0_5px_0_0_rgba(0,0,0,0.08),0_10px_20px_rgba(0,0,0,0.06)]"
      }`}
    >
      <div className="overflow-hidden rounded-[22px] transition group-hover:brightness-110">
        <Thumb id={g.id} />
      </div>
      <div className="px-3 pb-3 pt-2">
        <h3 className={`font-game truncate text-lg leading-tight ${dark ? "text-white" : "text-[#2b2340]"}`}>{g.title}</h3>
        <p className={`mt-0.5 line-clamp-2 text-xs leading-snug ${dark ? "text-white/70" : "text-[#6b6280]"}`}>{g.blurb}</p>
      </div>
    </button>
  );
}

/** 오늘 날짜로 고르는 ‘오늘의 게임’ */
function todayPick(list: GameDef[]) {
  const d = new Date();
  const n = d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate();
  return list[n % list.length];
}

/** 첫 화면: 게임 포털처럼 알록달록한 타일. 누르면 게임 창이 뜬다. */
export default function MathplayHome() {
  useGameFont();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const q = params.get("f");
  const f: Floor | "all" = FLOORS.some((x) => x.key === q) ? (q as Floor) : "all";
  const openId = params.get("g");
  const [more, setMore] = useState(false);
  const elem = GAMES.filter((g) => g.level === "elem");
  const upper = GAMES.filter((g) => g.level === "upper");
  const today = todayPick(elem);

  useEffect(() => {
    document.title = `온라인 수학 체험 · ${HUB_NAME}`;
  }, []);

  const pick = (k: Floor | "all") => setParams(k === "all" ? {} : { f: k }, { replace: true });
  const open = (id: string, replace = false) => {
    const next = new URLSearchParams(params);
    next.set("g", id);
    setParams(next, { replace });
  };
  const close = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) nav(-1);
    else {
      const next = new URLSearchParams(params);
      next.delete("g");
      setParams(next, { replace: true });
    }
  };
  const randomGame = () => open(elem[Math.floor(Math.random() * elem.length)].id);
  const floors = f === "all" ? FLOORS : FLOORS.filter((x) => x.key === f);

  return (
    <div className="min-h-screen bg-[#fff8ef] pb-16">
      {/* 맨 위 작은 막대 */}
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 pt-3">
        <Link to="/" className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-[#6b6280] hover:text-[#2b2340]">
          <img src="/icon-192.png" alt="" width={28} height={28} className="h-7 w-7" />← {HUB_NAME}
        </Link>
      </div>

      {/* 큰 배너 */}
      <header className="mx-auto mt-2 max-w-6xl px-4">
        <div className="relative overflow-hidden rounded-[32px] px-6 py-8 text-white shadow-[0_8px_0_0_rgba(0,0,0,0.08)] sm:px-10 sm:py-12" style={{ background: "linear-gradient(120deg, #ff8a5b 0%, #ff5e9c 45%, #7b61ff 100%)" }}>
          <span className="gz-float absolute right-[6%] top-[12%] text-5xl sm:text-7xl" aria-hidden>🧩</span>
          <span className="gz-float absolute bottom-[10%] right-[24%] text-4xl sm:text-6xl" style={{ animationDelay: "1s" }} aria-hidden>🎈</span>
          <span className="gz-float absolute right-[40%] top-[8%] hidden text-4xl sm:block" style={{ animationDelay: "2s" }} aria-hidden>⭐</span>
          <span className="absolute -bottom-16 -left-10 h-48 w-48 rounded-full bg-white/15" aria-hidden />
          <span className="absolute -right-12 -top-16 h-56 w-56 rounded-full bg-white/10" aria-hidden />
          <p className="relative text-sm font-bold tracking-widest opacity-90">온라인 수학 체험</p>
          <h1 className="font-game relative mt-1 text-5xl drop-shadow sm:text-7xl">수학 놀이터</h1>
          <p className="relative mt-3 max-w-md text-lg font-semibold opacity-95 sm:text-xl">생각 없이 놀다 보면 어느새 수학이 쏙쏙!</p>
          <div className="relative mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={randomGame}
              className="font-game min-h-[60px] rounded-full bg-white px-7 text-2xl text-[#ff5e7e] shadow-[0_6px_0_0_rgba(0,0,0,0.18)] transition hover:scale-105 active:translate-y-[4px] active:shadow-[0_2px_0_0_rgba(0,0,0,0.18)]"
            >
              🎲 아무 게임이나!
            </button>
            <button
              type="button"
              onClick={() => open(today.id)}
              className="font-game min-h-[60px] rounded-full bg-white/20 px-6 text-xl text-white ring-2 ring-white/70 backdrop-blur transition hover:bg-white/30 active:translate-y-[2px]"
            >
              ⭐ 오늘의 게임: {today.title}
            </button>
          </div>
        </div>
      </header>

      {/* 층 고르기 */}
      <nav className="mx-auto mt-6 flex max-w-6xl flex-wrap gap-2 px-4" aria-label="층 고르기">
        <button
          type="button"
          onClick={() => pick("all")}
          aria-pressed={f === "all"}
          className={`font-game min-h-[48px] rounded-full px-5 text-lg shadow-[0_4px_0_0_rgba(0,0,0,0.12)] transition active:translate-y-[2px] ${f === "all" ? "bg-[#2b2340] text-white" : "bg-white text-[#2b2340]"}`}
        >
          🏠 전체 {elem.length}
        </button>
        {FLOORS.map((x) => (
          <button
            key={x.key}
            type="button"
            onClick={() => pick(x.key)}
            aria-pressed={f === x.key}
            className="font-game min-h-[48px] rounded-full px-5 text-lg shadow-[0_4px_0_0_rgba(0,0,0,0.12)] transition active:translate-y-[2px]"
            style={f === x.key ? { background: `linear-gradient(90deg, ${x.grad[0]}, ${x.grad[1]})`, color: "#fff" } : { background: "#fff", color: "#2b2340" }}
          >
            {x.emoji} {x.label} {x.name} {elem.filter((g) => g.floor === x.key).length}
          </button>
        ))}
      </nav>

      {/* 층별 게임 */}
      <main className="mx-auto max-w-6xl px-4">
        {floors.map((fl) => {
          const list = elem.filter((g) => g.floor === fl.key);
          return (
            <section key={fl.key} className="mt-8">
              <div className="flex items-end gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl shadow-[0_4px_0_0_rgba(0,0,0,0.12)]" style={{ background: `linear-gradient(135deg, ${fl.grad[0]}, ${fl.grad[1]})` }} aria-hidden>
                  {fl.emoji}
                </span>
                <div>
                  <h2 className="font-game text-3xl leading-none text-[#2b2340]">
                    {fl.label} {fl.name}
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-[#6b6280]">{fl.desc}</p>
                </div>
              </div>
              <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
                {list.map((g) => (
                  <li key={g.id}>
                    <Tile g={g} onOpen={open} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        {/* 중·고 도전 */}
        <section className="mt-10 rounded-[28px] bg-[#231b3a] p-5 text-white shadow-[0_6px_0_0_rgba(0,0,0,0.15)] sm:p-6">
          <button type="button" onClick={() => setMore((o) => !o)} aria-expanded={more} className="flex min-h-[48px] w-full items-center gap-3 text-left">
            <span className="text-3xl" aria-hidden>🔥</span>
            <span className="min-w-0 flex-1">
              <span className="font-game block text-2xl">중·고등학생 도전 게임 {upper.length}가지</span>
              <span className="block text-sm text-white/70">암호, 접선, 로그 자 같은 조금 어려운 수학이에요.</span>
            </span>
            <span className="font-game rounded-full bg-white/15 px-4 py-2 text-lg">{more ? "접기 ▲" : "보기 ▼"}</span>
          </button>
          {more && (
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {upper.map((g) => (
                <li key={g.id}>
                  <Tile g={g} onOpen={open} dark />
                </li>
              ))}
            </ul>
          )}
        </section>

        <details className="mt-6 rounded-[22px] bg-white p-4 shadow-[0_4px_0_0_rgba(0,0,0,0.06)]">
          <summary className="font-game min-h-[44px] cursor-pointer py-2 text-lg text-[#2b2340]">🔗 조각 퍼즐을 더 해 볼 수 있는 곳</summary>
          <p className="text-sm text-[#6b6280]">대부분 영어 사이트예요. 어른과 함께 보세요. 내용이 바뀌거나 사라질 수 있어요.</p>
          <ul className="mt-2 space-y-2">
            {MORE.map((m) => (
              <li key={m.href}>
                <a href={m.href} target="_blank" rel="noopener" className="font-semibold text-[#7b61ff] underline underline-offset-4">
                  {m.name} ↗
                </a>
                <span className="ml-2 text-sm text-[#6b6280]">{m.note}</span>
              </li>
            ))}
          </ul>
        </details>
      </main>

      {openId && gameById(openId) && <GameModal id={openId} onClose={close} onOpen={(id) => open(id, true)} />}
    </div>
  );
}
