import { useState } from "react";
import { Link } from "react-router-dom";
import Shell from "./Shell";
import { FLOORS } from "./FloorPage";
import { GAMES } from "./games/registry";

const ONLINE = "https://home.pen.go.kr/bmcm/cm/cntnts/cntntsView.do?mi=17620&cntntsId=3846";
const FLOOR_NAME: Record<string, string> = { "2f": "2F 수학놀이관", "3f": "3F 진로탐색관", "4f": "4F 교과체험관" };
type Filter = "all" | "2f" | "3f" | "4f";

/** 온라인 수학 체험 첫 화면: 마우스로 하는 게임 + 층별 체험 목록(영상) + 퍼즐 놀이터 */
export default function MathplayHome() {
  const [f, setF] = useState<Filter>("all");
  const list = GAMES.filter((g) => f === "all" || g.floor === f);
  return (
    <Shell
      title="온라인 수학 체험"
      lead={<p>부산수학문화관의 체험을 마우스로 직접 해 볼 수 있는 게임으로 만들었어요. 끌고, 누르고, 돌려 보면서 수학을 만져 봐요.</p>}
    >
      <h2 className="mt-8 text-xl font-extrabold">🎮 체험 게임 {GAMES.length}가지</h2>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="층 고르기">
        {(["all", "2f", "3f", "4f"] as Filter[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setF(k)}
            aria-pressed={f === k}
            className={`min-h-[44px] rounded-full border px-4 text-sm font-semibold ${f === k ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface hover:bg-bg"}`}
          >
            {k === "all" ? `전체 ${GAMES.length}` : `${FLOOR_NAME[k]} ${GAMES.filter((g) => g.floor === k).length}`}
          </button>
        ))}
      </div>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((g) => (
          <li key={g.id}>
            <Link to={`/mathplay/game/${g.id}`} className="group block h-full rounded-card border border-line bg-surface p-4 transition hover:-translate-y-0.5 hover:border-accent hover:shadow-lg">
              <span className="inline-block rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent">{FLOOR_NAME[g.floor]}</span>
              <h3 className="mt-2 text-lg font-extrabold leading-tight">{g.title}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-muted">{g.blurb}</p>
              <span className="mt-2 inline-block text-sm font-semibold text-accent group-hover:underline">게임 시작 →</span>
            </Link>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-xl font-extrabold">🧩 퍼즐 놀이터</h2>
      <Link to="/mathplay/puzzle" className="group mt-3 block rounded-card border-2 border-accent bg-surface p-5 transition hover:shadow-lg sm:p-6">
        <span className="inline-block rounded-full bg-accent-soft px-3 py-0.5 text-sm font-semibold text-accent">펜토미노 · 테트로미노 · 마방진</span>
        <h3 className="mt-2 text-2xl font-extrabold">조각을 끌어다 맞추는 퍼즐</h3>
        <p className="mt-1 text-muted">
          오늘 날짜만 남기고 10조각으로 덮는 <strong className="text-ink">펜토미노 달력</strong>, 5종 조각으로 빈틈없이 채우는 <strong className="text-ink">테트로미노 퍼즐</strong>, 가로·세로·대각선에 같은 색이 없게 채우는 <strong className="text-ink">색동 마방진</strong>. 조각을 마우스로 끌어다 놓아요.
        </p>
        <span className="mt-3 inline-block font-semibold text-accent group-hover:underline">퍼즐 하러 가기 →</span>
      </Link>

      <h2 className="mt-10 text-xl font-extrabold">📺 부산수학문화관 층별 체험 · 영상</h2>
      <p className="mt-1 text-muted">전체 체험 목록과 실제 체험 영상이에요. 게임이 있는 체험에는 게임 단추가 붙어 있어요.</p>
      <ul className="mt-4 grid gap-4 sm:grid-cols-3">
        {FLOORS.map((fl) => (
          <li key={fl.key}>
            <Link to={`/mathplay/busan/${fl.key}`} className="group block h-full rounded-card border border-line bg-surface p-5 transition hover:-translate-y-0.5 hover:border-accent hover:shadow-lg">
              <span className="inline-block rounded-full bg-accent-soft px-3 py-0.5 text-sm font-semibold text-accent">{fl.who}</span>
              <div className="mt-2 flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-lg font-extrabold text-accent-ink" aria-hidden>
                  {fl.label}
                </span>
                <h3 className="text-lg font-extrabold leading-tight">{fl.title}</h3>
              </div>
              <p className="mt-2 line-clamp-3 text-sm text-muted">{fl.desc}</p>
              <p className="mt-3 text-sm text-muted">
                체험 {fl.data.items.length}가지 · 영상 {fl.data.items.filter((x) => x.v).length}가지 · 게임 {GAMES.filter((g) => g.floor === fl.key).length}가지
              </p>
              <span className="mt-1 inline-block font-semibold text-accent group-hover:underline">체험 보러 가기 →</span>
            </Link>
          </li>
        ))}
      </ul>

      <aside className="mt-8 rounded-card bg-bg p-4 text-[0.95rem] text-muted">
        <p>
          <strong className="text-ink">온라인 부산수학문화관(메타버스)</strong>은 부산수학문화관이 가상공간에 그대로 구현된 곳이에요. 윈도우 PC에서만 쓸 수 있는 프로그램이라서 이 사이트에서는 안내 페이지로 연결해요.
        </p>
        <a href={ONLINE} target="_blank" rel="noopener" className="mt-2 inline-flex min-h-[44px] items-center font-semibold text-accent underline underline-offset-4">
          공식 안내 보기 ↗
        </a>
      </aside>
    </Shell>
  );
}
