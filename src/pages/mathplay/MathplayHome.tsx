import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Shell from "./Shell";
import GameModal from "./GameModal";
import { FLOORS, GAMES, floorInfo, gameById, type Floor } from "./games/registry";

const MORE: { name: string; href: string; note: string }[] = [
  { name: "Panchang Paheli", href: "https://ccl.iitgn.ac.in/panchang-paheli", note: "펜토미노 달력 퍼즐을 날마다 해 보는 웹 퍼즐(영어)" },
  { name: "Transum — Pentominoes", href: "https://www.transum.org/maths/activity/jigsaw/Pentominoes.asp", note: "펜토미노 12조각을 끌어서 채우기(영어)" },
  { name: "Transum — Tetrominoes", href: "https://www.transum.org/maths/activity/jigsaw/Tetrominoes.asp", note: "테트로미노 10개로 직사각형 채우기(영어)" },
  { name: "Mathigon Polypad", href: "https://mathigon.org/polypad", note: "펜토미노·탱그램 같은 디지털 교구(영어)" },
];

/** 첫 화면: 생각 없이 바로 놀 수 있게 큰 시작 단추와 층별 게임. 게임은 팝업으로 열린다. */
export default function MathplayHome() {
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const q = params.get("f");
  const f: Floor | "all" = FLOORS.some((x) => x.key === q) ? (q as Floor) : "all";
  const openId = params.get("g");
  const [more, setMore] = useState(false);
  const elem = GAMES.filter((g) => g.level === "elem");
  const upper = GAMES.filter((g) => g.level === "upper");
  const list = elem.filter((g) => f === "all" || g.floor === f);

  const pick = (k: Floor | "all") => setParams(k === "all" ? {} : { f: k }, { replace: true });
  // 열 때는 기록을 쌓아서 ‘뒤로’ 가기로도 닫히고, 팝업 안에서 다른 게임으로 넘어갈 때는 기록을 바꾼다.
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

  return (
    <Shell title="온라인 수학 체험" lead={<p>생각 없이 놀다 보면 어느새 수학이 쏙쏙! 게임을 누르면 팝업으로 열려요.</p>}>
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
      {f !== "all" && (
        <p className="mt-2 text-muted">
          {floorInfo(f).emoji} {floorInfo(f).desc}
        </p>
      )}

      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((g) => (
          <li key={g.id}>
            <button type="button" onClick={() => open(g.id)} className="group block h-full w-full rounded-card border border-line bg-surface p-4 text-left transition hover:-translate-y-0.5 hover:border-accent hover:shadow-lg">
              <span className="inline-block rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent">
                {floorInfo(g.floor).emoji} {floorInfo(g.floor).label} {floorInfo(g.floor).name}
              </span>
              <h3 className="mt-2 text-lg font-extrabold leading-tight">{g.title}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-muted">{g.blurb}</p>
              <span className="mt-2 inline-block text-sm font-semibold text-accent group-hover:underline">시작 →</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-8 rounded-card border border-line bg-bg p-4">
        <button type="button" onClick={() => setMore((o) => !o)} aria-expanded={more} className="min-h-[44px] w-full text-left font-bold">
          {more ? "▼" : "▶"} 중·고등학생 도전 게임 {upper.length}가지 {more ? "접기" : "보기"}
          <span className="block text-sm font-normal text-muted">암호, 접선, 로그 자 같은 조금 어려운 수학이에요.</span>
        </button>
        {more && (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {upper.map((g) => (
              <li key={g.id}>
                <button type="button" onClick={() => open(g.id)} className="block h-full w-full rounded-card border border-line bg-surface p-4 text-left hover:border-accent">
                  <span className="inline-block rounded-full bg-line/60 px-2.5 py-0.5 text-xs font-semibold text-muted">{floorInfo(g.floor).name} · 중·고</span>
                  <h3 className="mt-2 font-extrabold leading-tight">{g.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{g.blurb}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <details className="mt-4 rounded-card border border-line bg-surface p-4">
        <summary className="min-h-[44px] cursor-pointer py-2 font-bold">🔗 조각 퍼즐을 더 해 볼 수 있는 곳</summary>
        <p className="text-sm text-muted">대부분 영어 사이트예요. 어른과 함께 보세요. 내용이 바뀌거나 사라질 수 있어요.</p>
        <ul className="mt-2 space-y-2">
          {MORE.map((m) => (
            <li key={m.href}>
              <a href={m.href} target="_blank" rel="noopener" className="font-semibold text-accent underline underline-offset-4">
                {m.name} ↗
              </a>
              <span className="ml-2 text-sm text-muted">{m.note}</span>
            </li>
          ))}
        </ul>
      </details>

      {openId && gameById(openId) && <GameModal id={openId} onClose={close} onOpen={(id) => open(id, true)} />}
    </Shell>
  );
}
