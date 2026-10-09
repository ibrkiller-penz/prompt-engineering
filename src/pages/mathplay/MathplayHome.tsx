import { Link } from "react-router-dom";
import Shell from "./Shell";
import { FLOORS } from "./FloorPage";

const ONLINE = "https://home.pen.go.kr/bmcm/cm/cntnts/cntntsView.do?mi=17620&cntntsId=3846";

/** 온라인 수학 체험 첫 화면: 부산수학문화관 층별 안내 3곳 + 퍼즐 놀이터 */
export default function MathplayHome() {
  return (
    <Shell
      title="온라인 수학 체험"
      lead={<p>체험관에 가지 못해도 수학을 만져 보고 눈으로 볼 수 있어요. 부산수학문화관의 체험 영상과, 직접 해 볼 수 있는 퍼즐 체험을 모았어요.</p>}
    >
      <h2 className="mt-8 text-xl font-extrabold">부산수학문화관 층별 체험</h2>
      <p className="mt-1 text-muted">층마다 체험 목록을 주제별로 묶고, 영상이 있는 체험은 바로 볼 수 있어요.</p>
      <ul className="mt-4 grid gap-4 sm:grid-cols-3">
        {FLOORS.map((f) => (
          <li key={f.key}>
            <Link to={`/mathplay/busan/${f.key}`} className="group block h-full rounded-card border border-line bg-surface p-5 transition hover:-translate-y-0.5 hover:border-accent hover:shadow-lg">
              <span className="inline-block rounded-full bg-accent-soft px-3 py-0.5 text-sm font-semibold text-accent">{f.who}</span>
              <div className="mt-2 flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-lg font-extrabold text-accent-ink" aria-hidden>
                  {f.label}
                </span>
                <h3 className="text-lg font-extrabold leading-tight">{f.title}</h3>
              </div>
              <p className="mt-2 line-clamp-3 text-sm text-muted">{f.desc}</p>
              <p className="mt-3 text-sm text-muted">
                체험 {f.data.items.length}가지 · 영상 {f.data.items.filter((x) => x.v).length}가지
              </p>
              <span className="mt-1 inline-block font-semibold text-accent group-hover:underline">체험 보러 가기 →</span>
            </Link>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-xl font-extrabold">직접 해 보는 퍼즐</h2>
      <Link to="/mathplay/puzzle" className="group mt-3 block rounded-card border-2 border-accent bg-surface p-5 transition hover:shadow-lg sm:p-6">
        <span className="inline-block rounded-full bg-accent-soft px-3 py-0.5 text-sm font-semibold text-accent">펜토미노 · 테트로미노 · 마방진</span>
        <h3 className="mt-2 text-2xl font-extrabold">퍼즐 놀이터</h3>
        <p className="mt-1 text-muted">
          수학체험관의 퍼즐 교구를 웹으로 옮겼어요. 오늘 날짜만 남기고 10조각으로 덮는 <strong className="text-ink">펜토미노 달력</strong>, 5종 조각으로 빈틈없이 채우는 <strong className="text-ink">테트로미노 퍼즐</strong>, 가로·세로·대각선에 같은 색이 없게 채우는 <strong className="text-ink">색동 마방진</strong>, 그리고 같은 종류의 퍼즐을 더 해 볼 수 있는 사이트 모음이 있어요.
        </p>
        <span className="mt-3 inline-block font-semibold text-accent group-hover:underline">퍼즐 하러 가기 →</span>
      </Link>

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
