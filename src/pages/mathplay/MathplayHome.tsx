import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { HUB_NAME } from "../../site";
import BuildingMap from "./BuildingMap";
import GameModal from "./GameModal";
import Profile, { BADGES } from "./Profile";
import Thumb from "./Thumb";
import { FLOORS, GAMES, gameById, type Floor, type GameDef } from "./games/registry";
import { dayKey, rankOf, starsOf, streak, totalStars, useSave, type Save } from "./progress";
import { useGameFont } from "./theme";

const MORE: { name: string; href: string; note: string }[] = [
  { name: "Panchang Paheli", href: "https://ccl.iitgn.ac.in/panchang-paheli", note: "펜토미노 달력 퍼즐을 날마다(영어)" },
  { name: "Transum — Pentominoes", href: "https://www.transum.org/maths/activity/jigsaw/Pentominoes.asp", note: "펜토미노 12조각 채우기(영어)" },
  { name: "Transum — Tetrominoes", href: "https://www.transum.org/maths/activity/jigsaw/Tetrominoes.asp", note: "테트로미노 직사각형 채우기(영어)" },
  { name: "Mathigon Polypad", href: "https://mathigon.org/polypad", note: "펜토미노·탱그램 디지털 교구(영어)" },
];

/** 별 세 칸 */
function Stars3({ n, light = false }: { n: number; light?: boolean }) {
  return (
    <span className="text-sm tracking-tight" aria-label={`별 ${n}개`}>
      <span className="text-[#f59e0b]">{"★".repeat(n)}</span>
      <span className={light ? "text-white/40" : "text-[#d9d2ee]"}>{"★".repeat(3 - n)}</span>
    </span>
  );
}

/** 게임 타일: 그림 + 이름 + 별 + NEW/오늘 표시 */
function Tile({ g, onOpen, save, today, dark = false }: { g: GameDef; onOpen: (id: string) => void; save: Save; today?: boolean; dark?: boolean }) {
  const n = starsOf(save.wins[g.id]);
  const fresh = !save.plays[g.id];
  return (
    <button
      type="button"
      onClick={() => onOpen(g.id)}
      className={`group relative block w-full overflow-hidden rounded-[22px] text-left transition duration-200 hover:-translate-y-1 hover:rotate-[-1deg] active:scale-95 ${
        dark ? "bg-white/10 shadow-[0_5px_0_0_rgba(0,0,0,0.35)]" : "bg-white shadow-[0_5px_0_0_rgba(0,0,0,0.08),0_10px_20px_rgba(0,0,0,0.06)]"
      }`}
    >
      <div className="overflow-hidden rounded-[22px] transition group-hover:brightness-110">
        <Thumb id={g.id} />
      </div>
      {today ? (
        <span className="font-game absolute left-2 top-2 rounded-full bg-[#ffd166] px-2.5 py-0.5 text-sm text-[#7c2d12] shadow-[0_2px_0_0_rgba(0,0,0,0.15)]">⭐ 오늘</span>
      ) : fresh ? (
        <span className="font-game absolute left-2 top-2 rounded-full bg-[#ff4d6d] px-2.5 py-0.5 text-sm text-white shadow-[0_2px_0_0_rgba(0,0,0,0.15)]">NEW</span>
      ) : null}
      <div className="px-3 pb-3 pt-2">
        <div className="flex items-center justify-between gap-1">
          <h3 className={`font-game min-w-0 truncate text-lg leading-tight ${dark ? "text-white" : "text-[#2b2340]"}`}>{g.title}</h3>
          <Stars3 n={n} light={dark} />
        </div>
        <p className={`mt-0.5 line-clamp-2 text-xs leading-snug ${dark ? "text-white/70" : "text-[#6b6280]"}`}>{g.blurb}</p>
      </div>
    </button>
  );
}

function todayPick(list: GameDef[]) {
  const d = new Date();
  const n = d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate();
  return list[n % list.length];
}

/** 첫 화면: 게임 포털. 놀이터 건물 그림, 내 등급·별·미션, 층별 게임 타일. 누르면 게임 창이 뜬다. */
export default function MathplayHome() {
  useGameFont();
  const save = useSave();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const q = params.get("f");
  const f: Floor | "all" = FLOORS.some((x) => x.key === q) ? (q as Floor) : "all";
  const openId = params.get("g");
  const [more, setMore] = useState(false);
  const [profile, setProfile] = useState(false);
  const elem = GAMES.filter((g) => g.level === "elem");
  const upper = GAMES.filter((g) => g.level === "upper");
  const today = todayPick(elem);
  const total = totalStars(save);
  const rank = rankOf(total);
  const st = streak(save);
  const missionDone = save.today.date === dayKey() && save.today.wins.includes(today.id);
  const badgeCount = BADGES.filter((b) => b.ok(save)).length;
  const recent = save.recent.map((id) => gameById(id)).filter((x): x is GameDef => !!x).slice(0, 6);
  const floorStars = Object.fromEntries(
    FLOORS.map((fl) => {
      const list = elem.filter((g) => g.floor === fl.key);
      return [fl.key, [list.reduce((a, g) => a + starsOf(save.wins[g.id]), 0), list.length * 3]];
    }),
  ) as Record<Floor, [number, number]>;

  useEffect(() => {
    document.title = `온라인 수학 체험 · ${HUB_NAME}`;
  }, []);

  const pick = (k: Floor | "all") => {
    setParams(k === "all" ? {} : { f: k }, { replace: true });
    window.setTimeout(() => document.getElementById("games")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };
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
      {/* 맨 위 막대: 돌아가기 · 내 프로필 */}
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 pt-3">
        <Link to="/" className="inline-flex min-h-[44px] min-w-0 items-center gap-2 text-sm font-semibold text-[#6b6280] hover:text-[#2b2340]">
          <img src="/icon-192.png" alt="" width={28} height={28} className="h-7 w-7 shrink-0" />
          <span className="truncate">← {HUB_NAME}</span>
        </Link>
        <button
          type="button"
          onClick={() => setProfile(true)}
          className="flex min-h-[48px] shrink-0 items-center gap-2 rounded-full bg-white py-1 pl-1 pr-4 shadow-[0_4px_0_0_rgba(0,0,0,0.08)] transition active:translate-y-[2px]"
          aria-label="내 프로필 열기"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#ffd166] to-[#ff8a5b] text-2xl">{save.avatar}</span>
          <span className="font-game text-lg text-[#2b2340]">{save.name || "이름 정하기"}</span>
          <span className="font-game rounded-full bg-[#fff1b8] px-2 text-[#b45309]">⭐ {total}</span>
        </button>
      </div>

      {/* 큰 배너: 왼쪽 글과 단추, 오른쪽 놀이터 건물 그림 */}
      <header className="mx-auto mt-2 max-w-6xl px-4">
        <div className="relative grid overflow-hidden rounded-[32px] text-white shadow-[0_8px_0_0_rgba(0,0,0,0.08)] md:grid-cols-[1.1fr_1fr]" style={{ background: "linear-gradient(135deg, #8fd3ff 0%, #b49bff 55%, #ff9ac6 100%)" }}>
          <span className="absolute -bottom-16 -left-10 h-48 w-48 rounded-full bg-white/15" aria-hidden />
          <div className="relative px-6 pb-2 pt-8 sm:px-10 sm:pt-12">
            <p className="text-sm font-bold tracking-widest opacity-90">온라인 수학 체험</p>
            <h1 className="font-game mt-1 text-5xl drop-shadow-[0_3px_0_rgba(0,0,0,0.15)] sm:text-7xl">수학 놀이터</h1>
            <p className="mt-3 max-w-md text-lg font-semibold opacity-95">생각 없이 놀다 보면 어느새 수학이 쏙쏙!</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={randomGame}
                className="font-game min-h-[60px] rounded-full bg-white px-7 text-2xl text-[#7b61ff] shadow-[0_6px_0_0_rgba(0,0,0,0.18)] transition hover:scale-105 active:translate-y-[4px] active:shadow-[0_2px_0_0_rgba(0,0,0,0.18)]"
              >
                🎲 아무 게임이나!
              </button>
            </div>
            <p className="mt-4 text-sm font-semibold opacity-90">👉 건물의 층을 눌러서 들어가 봐요</p>
          </div>
          <div className="relative px-4 pb-4 md:pt-4">
            <BuildingMap onPick={(k) => pick(k)} stars={floorStars} />
          </div>
        </div>
      </header>

      {/* 내 놀이 현황: 등급 · 연속 · 오늘의 미션 · 배지 */}
      <section className="mx-auto mt-5 grid max-w-6xl grid-cols-2 gap-3 px-4 lg:grid-cols-4" aria-label="내 놀이 현황">
        <button type="button" onClick={() => setProfile(true)} className="rounded-3xl bg-white p-4 text-left shadow-[0_5px_0_0_rgba(0,0,0,0.06)] transition active:translate-y-[2px]">
          <p className="text-xs font-bold text-[#6b6280]">내 등급</p>
          <p className="font-game mt-1 text-xl text-[#2b2340]">
            {rank.icon} {rank.name}
          </p>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-[#f1ecff]">
            <div className="h-full rounded-full bg-gradient-to-r from-[#ffd166] to-[#ff5e7e]" style={{ width: `${rank.pct}%` }} />
          </div>
          <p className="mt-1 text-xs text-[#6b6280]">{rank.next ? `다음 ${rank.next.icon}까지 ⭐ ${rank.next.at - total}` : "최고 등급!"}</p>
        </button>
        <div className="rounded-3xl bg-white p-4 shadow-[0_5px_0_0_rgba(0,0,0,0.06)]">
          <p className="text-xs font-bold text-[#6b6280]">연속 놀이</p>
          <p className="font-game mt-1 text-3xl text-[#ff5e3a]">🔥 {st}일</p>
          <p className="mt-1 text-xs text-[#6b6280]">{st ? "내일도 와서 이어 가요!" : "오늘 하나 해 볼까요?"}</p>
        </div>
        <button type="button" onClick={() => open(today.id)} className={`rounded-3xl p-4 text-left shadow-[0_5px_0_0_rgba(0,0,0,0.06)] transition active:translate-y-[2px] ${missionDone ? "bg-[#dcfce7]" : "bg-gradient-to-br from-[#fff1b8] to-[#ffe0ec]"}`}>
          <p className="text-xs font-bold text-[#6b6280]">🎯 오늘의 미션</p>
          <p className="font-game mt-1 text-lg leading-snug text-[#2b2340]">‘{today.title}’에서 별 받기</p>
          <p className="font-game mt-1 text-sm text-[#b45309]">{missionDone ? "✅ 미션 완료!" : "▶ 지금 하러 가기"}</p>
        </button>
        <button type="button" onClick={() => setProfile(true)} className="rounded-3xl bg-white p-4 text-left shadow-[0_5px_0_0_rgba(0,0,0,0.06)] transition active:translate-y-[2px]">
          <p className="text-xs font-bold text-[#6b6280]">모은 배지</p>
          <p className="font-game mt-1 text-3xl text-[#7b61ff]">🏅 {badgeCount}/{BADGES.length}</p>
          <p className="mt-1 text-xs text-[#6b6280]">눌러서 배지 보기</p>
        </button>
      </section>

      {/* 최근에 한 게임 */}
      {recent.length > 0 && (
        <section className="mx-auto mt-6 max-w-6xl px-4">
          <h2 className="font-game text-2xl text-[#2b2340]">🕹️ 최근에 한 게임</h2>
          <ul className="mt-3 flex gap-3 overflow-x-auto pb-2">
            {recent.map((g) => (
              <li key={g.id} className="w-28 shrink-0 sm:w-32">
                <button type="button" onClick={() => open(g.id)} className="block w-full overflow-hidden rounded-[18px] bg-white text-left shadow-[0_4px_0_0_rgba(0,0,0,0.08)] transition active:scale-95">
                  <Thumb id={g.id} />
                  <p className="font-game truncate px-2 py-1.5 text-center text-[#2b2340]">{g.title}</p>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 층 고르기 */}
      <nav id="games" className="mx-auto mt-6 flex max-w-6xl scroll-mt-4 flex-wrap gap-2 px-4" aria-label="층 고르기">
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
            {x.emoji} {x.label} {x.name}
          </button>
        ))}
      </nav>

      <main className="mx-auto max-w-6xl px-4">
        {floors.map((fl) => {
          const list = elem.filter((g) => g.floor === fl.key);
          const [got, all] = floorStars[fl.key];
          return (
            <section key={fl.key} className="mt-8">
              <div className="flex flex-wrap items-end gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl shadow-[0_4px_0_0_rgba(0,0,0,0.12)]" style={{ background: `linear-gradient(135deg, ${fl.grad[0]}, ${fl.grad[1]})` }} aria-hidden>
                  {fl.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-game text-3xl leading-none text-[#2b2340]">
                    {fl.label} {fl.name}
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-[#6b6280]">{fl.desc}</p>
                </div>
                <div className="w-full sm:w-56">
                  <p className="font-game text-right text-sm text-[#b45309]">
                    ⭐ {got} / {all}
                  </p>
                  <div className="mt-1 h-3 overflow-hidden rounded-full bg-white shadow-inner">
                    <div className="h-full rounded-full" style={{ width: `${all ? (got / all) * 100 : 0}%`, background: `linear-gradient(90deg, ${fl.grad[0]}, ${fl.grad[1]})` }} />
                  </div>
                </div>
              </div>
              <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
                {list.map((g) => (
                  <li key={g.id}>
                    <Tile g={g} onOpen={open} save={save} today={g.id === today.id} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

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
                  <Tile g={g} onOpen={open} save={save} dark />
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
      {profile && <Profile onClose={() => setProfile(false)} />}
    </div>
  );
}
