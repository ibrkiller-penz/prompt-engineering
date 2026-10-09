import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import Shell from "./Shell";
import { FLOOR2, FLOOR3, FLOOR4, type FloorData } from "./floorData";
import { GAMES, gameForExp } from "./games/registry";

const BASE = "https://home.pen.go.kr/bmcm/cm/cntnts/cntntsView.do";

type Floor = { key: string; label: string; title: string; who: string; desc: string; url: string; data: FloorData; tip?: { to: string; text: string } };

export const FLOORS: Floor[] = [
  {
    key: "2f",
    label: "2F",
    title: "수학놀이관 · 수학도서관",
    who: "미취학 · 초등 저학년",
    desc: "몸으로 직접 해 보면서 수학의 원리를 느끼는 놀이 공간이에요. 여럿이 어울려 몸을 움직이며 체험해요.",
    url: `${BASE}?mi=17603&cntntsId=3829`,
    data: FLOOR2,
    tip: { to: "/mathplay/puzzle", text: "‘꼭 맞는 블록을 찾아요!’가 궁금하면 퍼즐 놀이터에서 조각 맞추기를 해 봐요." },
  },
  {
    key: "3f",
    label: "3F",
    title: "진로탐색관",
    who: "중 · 고등",
    desc: "부산 지역 산업에 쓰이는 첨단 산업수학을 살펴보고, 수학과 관련된 직업 정보로 나의 미래를 이어 보는 공간이에요.",
    url: `${BASE}?mi=17604&cntntsId=3830`,
    data: FLOOR3,
  },
  {
    key: "4f",
    label: "4F",
    title: "교과체험관 · 역사지혜관",
    who: "초 고학년 · 중 · 고등",
    desc: "다면체·회전체·입체도형·평면도형 교구와 모형으로 도형 실험을 하고, 체험물로 함수의 특징을 이해하는 공간이에요. 수학의 역사와 사람도 만나요.",
    url: `${BASE}?mi=17605&cntntsId=3831`,
    data: FLOOR4,
  },
];

export const YT = (id: string) => `https://www.youtube.com/watch?v=${id}`;

export function VideoDialog({ name, id, onClose }: { name: string; id: string; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3" role="dialog" aria-modal="true" aria-label={`${name} 영상`} onClick={onClose}>
      <div className="w-full max-w-3xl rounded-card bg-surface p-3 shadow-xl sm:p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-extrabold leading-snug">{name}</h2>
          <button type="button" onClick={onClose} className="min-h-[44px] shrink-0 rounded-card border border-line px-3 font-semibold hover:bg-bg" autoFocus>
            닫기
          </button>
        </div>
        <div className="mt-2 aspect-video w-full overflow-hidden rounded-card bg-black">
          <iframe
            className="h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
            title={name}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
        <p className="mt-2 text-sm text-muted">
          영상이 안 나오면{" "}
          <a href={YT(id)} target="_blank" rel="noopener" className="font-semibold text-accent underline underline-offset-4">
            유튜브에서 보기 ↗
          </a>
        </p>
      </div>
    </div>
  );
}

export default function FloorPage() {
  const { floor } = useParams();
  const f = FLOORS.find((x) => x.key === floor);
  const [g, setG] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [onlyVideo, setOnlyVideo] = useState(false);
  const [open, setOpen] = useState<{ name: string; id: string } | null>(null);

  const list = useMemo(() => {
    if (!f) return [];
    const t = q.trim();
    return f.data.items.filter((x) => (g === null || x.g === g) && (!onlyVideo || x.v) && (!t || x.n.includes(t)));
  }, [f, g, q, onlyVideo]);

  if (!f) return <Navigate to="/mathplay" replace />;
  const total = f.data.items.length;
  const withVideo = f.data.items.filter((x) => x.v).length;
  const games = GAMES.filter((g) => g.floor === f.key && g.level === "elem").length;

  return (
    <Shell
      title={`${f.label} ${f.title}`}
      lead={
        <>
          <p>{f.desc}</p>
          <p className="mt-2 text-base">
            <span className="mr-2 inline-block rounded-full bg-accent-soft px-3 py-0.5 text-sm font-semibold text-accent">{f.who}</span>
            체험 {total}가지 · 영상 {withVideo}가지 · 게임 {games}가지
          </p>
        </>
      }
    >
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <a href={f.url} target="_blank" rel="noopener" className="inline-flex min-h-[44px] items-center rounded-card bg-accent px-4 font-semibold text-accent-ink hover:brightness-110">
          공식 안내 · 구조도 보기 ↗
        </a>
        {FLOORS.filter((x) => x.key !== f.key).map((x) => (
          <Link key={x.key} to={`/mathplay/busan/${x.key}`} className="inline-flex min-h-[44px] items-center rounded-card border border-line bg-surface px-4 font-semibold hover:bg-bg">
            {x.label} {x.title.split(" ")[0]}
          </Link>
        ))}
      </div>

      {f.tip && (
        <p className="mt-4 rounded-card bg-accent-soft/70 p-3 text-[0.95rem]">
          💡 <Link to={f.tip.to} className="font-semibold text-accent underline underline-offset-4">{f.tip.text}</Link>
        </p>
      )}

      <section className="mt-8" aria-label="체험 찾기">
        <div className="flex flex-wrap items-center gap-2">
          <label className="min-w-0 flex-1 basis-56">
            <span className="sr-only">체험 이름 찾기</span>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="체험 이름으로 찾기 (예: 원, 다리, 확률)"
              className="min-h-[44px] w-full rounded-card border border-line bg-surface px-3 outline-none focus:border-accent"
            />
          </label>
          <label className="inline-flex min-h-[44px] items-center gap-2 rounded-card border border-line bg-surface px-3 font-semibold">
            <input type="checkbox" checked={onlyVideo} onChange={(e) => setOnlyVideo(e.target.checked)} className="h-5 w-5 accent-[var(--accent)]" />
            영상 있는 것만
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="주제 고르기">
          <button
            type="button"
            onClick={() => setG(null)}
            aria-pressed={g === null}
            className={`min-h-[40px] rounded-full border px-4 text-sm font-semibold ${g === null ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface hover:bg-bg"}`}
          >
            전체 {total}
          </button>
          {f.data.groups.map((name, i) => (
            <button
              key={name}
              type="button"
              onClick={() => setG(g === i ? null : i)}
              aria-pressed={g === i}
              className={`min-h-[40px] rounded-full border px-4 text-sm font-semibold ${g === i ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface hover:bg-bg"}`}
            >
              {name} {f.data.items.filter((x) => x.g === i).length}
            </button>
          ))}
        </div>
      </section>

      <div className="mt-6 space-y-8">
        {f.data.groups.map((name, i) => {
          const rows = list.filter((x) => x.g === i);
          if (!rows.length) return null;
          return (
            <section key={name}>
              <h2 className="text-xl font-extrabold">{name}</h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {rows.map((x) => (
                  <li key={x.n} className="flex flex-col justify-between gap-2 rounded-card border border-line bg-surface p-4">
                    <span className="font-semibold leading-snug">{x.n}</span>
                    {gameForExp(x.n) && (
                      <Link
                        to={`/mathplay/game/${gameForExp(x.n)!.id}`}
                        className="inline-flex min-h-[44px] items-center justify-center rounded-card bg-accent px-4 font-semibold text-accent-ink hover:brightness-110"
                      >
                        🎮 게임으로 해 보기{gameForExp(x.n)!.level === "upper" ? " (중·고)" : ""}
                      </Link>
                    )}
                    {x.v ? (
                      <span className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setOpen({ name: x.n, id: x.v })}
                          className="inline-flex min-h-[44px] items-center rounded-card bg-accent-soft px-4 font-semibold text-accent hover:brightness-95"
                          aria-label={`${x.n} 영상 보기`}
                        >
                          ▶ 영상 보기
                        </button>
                        <a href={YT(x.v)} target="_blank" rel="noopener" className="text-sm font-semibold text-muted underline underline-offset-4 hover:text-ink">
                          유튜브 ↗
                        </a>
                      </span>
                    ) : (
                      !gameForExp(x.n) && <span className="text-sm text-muted">영상은 아직 없어요. 공식 안내에서 사진으로 볼 수 있어요.</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        {list.length === 0 && <p className="rounded-card border border-line bg-surface p-6 text-center text-muted">찾는 체험이 없어요. 검색어를 지우거나 주제를 바꿔 봐요.</p>}
      </div>

      {open && <VideoDialog name={open.name} id={open.id} onClose={() => setOpen(null)} />}
    </Shell>
  );
}
