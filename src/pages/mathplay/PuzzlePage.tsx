import { useEffect, useState } from "react";
import Shell from "./Shell";
import CalendarPuzzle from "./CalendarPuzzle";
import TetrominoPuzzle from "./TetrominoPuzzle";
import ColorSquare from "./ColorSquare";

type Tab = "calendar" | "tetromino" | "color" | "more";

const TABS: { key: Tab; label: string; sub: string }[] = [
  { key: "calendar", label: "펜토미노 달력", sub: "오늘 날짜만 남기기" },
  { key: "tetromino", label: "테트로미노 퍼즐", sub: "5종으로 빈틈없이" },
  { key: "color", label: "색동 마방진", sub: "색이 겹치지 않게" },
  { key: "more", label: "더 해 볼 체험", sub: "다른 사이트·자료" },
];

const MORE: { group: string; items: { name: string; href: string; note: string; en?: boolean }[] }[] = [
  {
    group: "펜토미노 · 달력 퍼즐",
    items: [
      { name: "Panchang Paheli (인도공과대 간디나가르)", href: "https://ccl.iitgn.ac.in/panchang-paheli", note: "펜토미노 달력 퍼즐을 날마다 다른 방식으로 풀어 보는 웹 퍼즐이에요. 초보자용 7조각 풀이도 안내해요.", en: true },
      { name: "Pentomino Calendar Puzzle (Math Equals Love)", href: "https://mathequalslove.net/pentomino-calendar-puzzle/", note: "교실에서 쓰는 펜토미노 달력 퍼즐 이야기와 만드는 법이에요. 종이로 오려서 해 볼 수 있어요.", en: true },
      { name: "Transum — Pentominoes", href: "https://www.transum.org/maths/activity/jigsaw/Pentominoes.asp", note: "펜토미노 12조각을 끌어서 직사각형에 채우는 무료 웹 퍼즐이에요.", en: true },
    ],
  },
  {
    group: "테트로미노",
    items: [
      { name: "Transum — Tetrominoes", href: "https://www.transum.org/maths/activity/jigsaw/Tetrominoes.asp", note: "테트로미노 10개를 끌어서 5×8 직사각형을 채우는 무료 웹 퍼즐이에요. 단계가 올라가요.", en: true },
    ],
  },
  {
    group: "여러 도형 교구를 한곳에서",
    items: [
      { name: "Mathigon Polypad", href: "https://mathigon.org/polypad", note: "펜토미노·폴리오미노·탱그램·패턴블록 같은 디지털 교구를 마음대로 놓아 볼 수 있어요. 교사와 학생 모두 무료로 쓸 수 있다고 소개돼요.", en: true },
    ],
  },
  {
    group: "최석정과 라틴방진",
    items: [
      { name: "Choi Seok-jeong (위키백과, 영어)", href: "https://en.wikipedia.org/wiki/Choi_Seok-jeong", note: "조선의 수학자 최석정과 《구수략》을 소개해요.", en: true },
      { name: "최석정 관련 글 모음 (연세대 한상근 교수 사이트)", href: "https://coding.yonsei.ac.kr/publications/csj/csj.html", note: "최석정과 직교라틴방진을 다룬 글 목록이에요." },
    ],
  },
];

const fromHash = (): Tab => {
  const h = window.location.hash.replace("#", "");
  return TABS.some((t) => t.key === h) ? (h as Tab) : "calendar";
};

export default function PuzzlePage() {
  const [tab, setTab] = useState<Tab>(fromHash);
  useEffect(() => {
    const h = () => setTab(fromHash());
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);
  const go = (t: Tab) => {
    setTab(t);
    window.history.replaceState(null, "", `#${t}`);
  };

  return (
    <Shell
      title="퍼즐 놀이터"
      lead={<p>수학체험관에 있는 퍼즐 놀이를 웹에서 해 봐요. 조각을 마우스로 끌어다 놓아요!</p>}
    >
      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4" role="tablist" aria-label="체험 고르기">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => go(t.key)}
            className={`min-h-[56px] rounded-card border px-3 py-2 text-left transition ${tab === t.key ? "border-accent bg-accent-soft" : "border-line bg-surface hover:bg-bg"}`}
          >
            <span className={`block font-extrabold ${tab === t.key ? "text-accent" : ""}`}>{t.label}</span>
            <span className="block text-xs text-muted">{t.sub}</span>
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-card border border-line bg-surface p-4 sm:p-6" role="tabpanel">
        {tab === "calendar" && (
          <>
            <h2 className="text-2xl font-extrabold">펜토미노 달력</h2>
            <p className="mt-2 text-muted">
              달력에서 오늘의 ‘월’, ‘요일’, ‘일’ 세 칸만 남기고, 나머지를 10개의 조각으로 모두 덮어요. 다른 날짜도 골라서 해 봐요.
            </p>
            <div className="mt-4">
              <CalendarPuzzle />
            </div>
            <Think
              items={[
                "덮어야 하는 칸은 47칸이에요. 5칸짜리 조각 7개와 4칸짜리 조각 3개를 합치면 딱 47칸이에요. 계산해 볼까요?",
                "어떤 날짜를 골라도 풀 수 있어요. 컴퓨터로 모두 확인했어요.",
                "같은 날짜를 다르게 풀 수 있을까요? 친구와 비교해 봐요.",
              ]}
              note="사진 속 교구와 조각 모양·판 배치는 다를 수 있어요. 이 사이트의 판은 월 12칸, 날짜 31칸, 요일 7칸으로 새로 만들었어요."
            />
          </>
        )}
        {tab === "tetromino" && (
          <>
            <h2 className="text-2xl font-extrabold">테트로미노 퍼즐</h2>
            <p className="mt-2 text-muted">
              네모 4개를 붙여 만든 조각이 테트로미노예요. 모양은 5가지뿐이에요. 흰 칸을 5가지 조각으로 모두 채워 봐요. 조각을 돌리고 뒤집어도 돼요.
            </p>
            <div className="mt-4">
              <TetrominoPuzzle />
            </div>
            <Think
              items={[
                "네모 4개로 만든 모양은 5가지뿐이에요. 종이에 직접 그려 볼까요?",
                "지그재그 모양과 L 모양은 뒤집으면 방향이 달라져요. 뒤집기 단추를 써 보세요.",
                "다르게 채울 수 있는 문제를 찾아봐요.",
              ]}
              note="문제는 컴퓨터가 만들어서 답이 꼭 있어요. ‘답 하나 보기’를 누르면 하나를 보여 줘요."
            />
          </>
        )}
        {tab === "color" && (
          <>
            <h2 className="text-2xl font-extrabold">색동 마방진</h2>
            <p className="mt-2 text-muted">
              칸을 색으로 채워요. <strong className="text-ink">가로줄, 세로줄, 대각선(×)에 같은 색이 두 번 나오면 안 돼요.</strong> 4×4는 4가지 색, 5×5는 5가지 색이에요.
            </p>
            <div className="mt-4">
              <ColorSquare />
            </div>
            <Think
              items={[
                "4×4 판에서 한 줄에 4가지 색이 모두 있어야 해요. 각 색은 모두 몇 개 필요할까요?",
                "처음 놓인 칩을 잘 보면 다음 칩을 알 수 있어요.",
                "대각선 규칙이 없으면 더 쉬울까요? 스도쿠도 비슷한 퍼즐이에요.",
              ]}
              pieces={false}
              note="옛날 조선의 수학자 최석정 할아버지도 이런 색(숫자) 퍼즐을 연구했다고 알려져 있어요."
            />
          </>
        )}
        {tab === "more" && (
          <>
            <h2 className="text-2xl font-extrabold">더 해 볼 체험</h2>
            <p className="mt-2 text-muted">비슷한 퍼즐을 더 해 볼 수 있는 곳이에요. 대부분 영어 사이트라서 어른과 함께 보세요. 내용이 바뀌거나 사라질 수 있어요.</p>
            <div className="mt-5 space-y-6">
              {MORE.map((g) => (
                <section key={g.group}>
                  <h3 className="text-lg font-extrabold">{g.group}</h3>
                  <ul className="mt-2 grid gap-3 sm:grid-cols-2">
                    {g.items.map((x) => (
                      <li key={x.href}>
                        <a href={x.href} target="_blank" rel="noopener" className="block h-full rounded-card border border-line p-4 hover:border-accent hover:bg-accent-soft/50">
                          <span className="font-bold text-accent">{x.name} ↗</span>
                          {x.en && <span className="ml-2 rounded-full bg-line/60 px-2 py-0.5 text-xs font-semibold text-muted">영어</span>}
                          <span className="mt-1 block text-sm text-muted">{x.note}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}

function Think({ items, note, pieces = true }: { items: string[]; note: string; pieces?: boolean }) {
  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      <div className="rounded-card bg-accent-soft/60 p-4">
        <h3 className="font-extrabold">🤔 생각해 봐요</h3>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[0.95rem]">
          {items.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>
      <div className="rounded-card bg-bg p-4 text-[0.95rem] text-muted">
        <h3 className="font-extrabold text-ink">알아 둘 것</h3>
        <p className="mt-2">{note}</p>
        {pieces && <p className="mt-2">조작: 조각을 마우스로 끌어다 놓아요. 끄는 중에 오른쪽 단추(또는 R)로 돌리고 F로 뒤집어요. 놓은 조각을 다시 끌면 옮길 수 있어요. 터치는 조각을 고르고 칸을 한 번 눌러 보고, 같은 칸을 다시 눌러 놓아요.</p>}
      </div>
    </div>
  );
}
