import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Shell from "./Shell";
import { FLOORS, GAMES, floorInfo, type Floor } from "./games/registry";

/** 첫 화면: 생각 없이 바로 놀 수 있게 큰 시작 단추와 층별 게임 */
export default function MathplayHome() {
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const q = params.get("f");
  const f: Floor | "all" = FLOORS.some((x) => x.key === q) ? (q as Floor) : "all";
  const [more, setMore] = useState(false);
  const elem = GAMES.filter((g) => g.level === "elem");
  const upper = GAMES.filter((g) => g.level === "upper");
  const list = elem.filter((g) => f === "all" || g.floor === f);
  const pick = (k: Floor | "all") => setParams(k === "all" ? {} : { f: k }, { replace: true });
  const randomGame = () => nav(`/mathplay/game/${elem[Math.floor(Math.random() * elem.length)].id}`);

  return (
    <Shell title="온라인 수학 체험" lead={<p>생각 없이 놀다 보면 어느새 수학이 쏙쏙! 누르고, 끌고, 돌려 보세요.</p>}>
      <button type="button" onClick={randomGame} className="mt-6 min-h-[64px] w-full rounded-card bg-accent px-6 text-xl font-extrabold text-accent-ink shadow transition hover:brightness-110 sm:w-auto">
        🎲 아무 게임이나 시작!
      </button>

      <div className="mt-8 flex flex-wrap gap-2" role="group" aria-label="층 고르기">
        <button type="button" onClick={() => pick("all")} aria-pressed={f === "all"} className={`min-h-[44px] rounded-full border px-4 font-semibold ${f === "all" ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface hover:bg-bg"}`}>
          전체 {elem.length}
        </button>
        {FLOORS.map((x) => (
          <button key={x.key} type="button" onClick={() => pick(x.key)} aria-pressed={f === x.key} className={`min-h-[44px] rounded-full border px-4 font-semibold ${f === x.key ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface hover:bg-bg"}`}>
            {x.emoji} {x.label} {x.name} {elem.filter((g) => g.floor === x.key).length}
          </button>
        ))}
      </div>
      {f !== "all" && <p className="mt-2 text-muted">{floorInfo(f).emoji} {floorInfo(f).desc}</p>}

      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((g) => (
          <li key={g.id}>
            <Link to={`/mathplay/game/${g.id}`} className="group block h-full rounded-card border border-line bg-surface p-4 transition hover:-translate-y-0.5 hover:border-accent hover:shadow-lg">
              <span className="inline-block rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent">
                {floorInfo(g.floor).emoji} {floorInfo(g.floor).label} {floorInfo(g.floor).name}
              </span>
              <h3 className="mt-2 text-lg font-extrabold leading-tight">{g.title}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-muted">{g.blurb}</p>
              <span className="mt-2 inline-block text-sm font-semibold text-accent group-hover:underline">시작 →</span>
            </Link>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-xl font-extrabold">🧩 조각 맞추기 퍼즐</h2>
      <Link to="/mathplay/puzzle" className="group mt-3 block rounded-card border-2 border-accent bg-surface p-5 transition hover:shadow-lg sm:p-6">
        <h3 className="text-2xl font-extrabold">펜토미노 달력 · 테트로미노 · 색동 마방진</h3>
        <p className="mt-1 text-muted">조각을 마우스로 끌어다 맞춰요. 오늘 날짜만 남기고 달력을 덮어 보세요!</p>
        <span className="mt-3 inline-block font-semibold text-accent group-hover:underline">퍼즐 하러 가기 →</span>
      </Link>

      <div className="mt-8 rounded-card border border-line bg-bg p-4">
        <button type="button" onClick={() => setMore((o) => !o)} aria-expanded={more} className="min-h-[44px] w-full text-left font-bold">
          {more ? "▼" : "▶"} 중·고등학생 도전 게임 {upper.length}가지 {more ? "접기" : "보기"}
          <span className="block text-sm font-normal text-muted">암호, 접선, 로그 자 같은 조금 어려운 수학이에요.</span>
        </button>
        {more && (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {upper.map((g) => (
              <li key={g.id}>
                <Link to={`/mathplay/game/${g.id}`} className="block h-full rounded-card border border-line bg-surface p-4 hover:border-accent">
                  <span className="inline-block rounded-full bg-line/60 px-2.5 py-0.5 text-xs font-semibold text-muted">{floorInfo(g.floor).name} · 중·고</span>
                  <h3 className="mt-2 font-extrabold leading-tight">{g.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{g.blurb}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Shell>
  );
}
