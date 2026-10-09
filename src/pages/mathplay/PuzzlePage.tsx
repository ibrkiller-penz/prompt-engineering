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
      lead={<p>전북수학체험센터 같은 수학체험관에서 볼 수 있는 퍼즐 교구 — 펜토미노 달력, 테트로미노 퍼즐, 색동 마방진 — 을 웹에서 직접 해 볼 수 있게 만들었어요.</p>}
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
              “오늘 날짜에 해당하는 ‘월’, ‘요일’, ‘일’을 한 칸씩, 총 세 칸을 남기고 나머지를 펜토미노 10조각으로 가려 주세요.” 달력 판 위의 조각 놀이예요. 오늘이 아닌 다른 날짜도 골라서 해 봐요.
            </p>
            <div className="mt-4">
              <CalendarPuzzle />
            </div>
            <Think
              items={[
                "판은 모두 50칸이고 세 칸을 남기니 덮을 칸은 47칸이에요. 5칸 조각 7개와 4칸 조각 3개면 딱 맞아요(5×7 + 4×3 = 47). 왜 딱 맞는지 식으로 확인해 봐요.",
                "날짜를 바꿔도 풀릴까요? 이 10조각으로는 월·일·요일 2,562가지 조합이 모두 풀린다는 것을 컴퓨터로 확인했어요. 풀리지 않는 날짜가 하나라도 있으면 퍼즐로는 실패예요.",
                "같은 날짜를 두 가지 이상 다르게 풀 수 있을까요? 풀이를 사진으로 찍어서 친구와 비교해 봐요.",
              ]}
              note="사진 속 교구와 조각 모양·판 배치는 다를 수 있어요. 이 사이트의 판은 월 12칸, 날짜 31칸, 요일 7칸으로 새로 만들었어요."
            />
          </>
        )}
        {tab === "tetromino" && (
          <>
            <h2 className="text-2xl font-extrabold">테트로미노 퍼즐</h2>
            <p className="mt-2 text-muted">
              정사각형 4개를 변끼리 이어 붙인 도형이 테트로미노예요. 모양은 5종뿐이에요. 문제의 흰 부분을 5종 조각으로 모두 채워 봐요. 조각은 밀고(평행이동), 돌리고(회전), 뒤집을(대칭) 수 있어요.
            </p>
            <div className="mt-4">
              <TetrominoPuzzle />
            </div>
            <Think
              items={[
                "왜 4칸 조각은 5종뿐일까요? 돌리거나 뒤집어서 같아지는 모양은 한 가지로 세어요. 손으로 직접 만들어 확인해 봐요.",
                "S 모양(지그재그)과 L 모양은 뒤집으면 다른 방향이 되어요. 뒤집기 단추를 쓰지 않으면 풀리지 않는 문제도 있을까요?",
                "답이 두 가지 이상인 문제를 찾아 보고, 두 풀이가 어떻게 다른지 말해 봐요.",
              ]}
              note="문제는 컴퓨터가 5조각을 무작위로 이어 붙여 만들어서 답이 반드시 하나 이상 있어요. ‘답 하나 보기’는 그중 하나를 보여 줘요."
            />
          </>
        )}
        {tab === "color" && (
          <>
            <h2 className="text-2xl font-extrabold">색동 마방진</h2>
            <p className="mt-2 text-muted">
              문제를 보고 칩을 놓은 다음, 나머지 빈칸을 <strong className="text-ink">각 줄(가로·세로·두 대각선)에 서로 다른 색이 놓이도록</strong> 채워요. 4×4는 4색, 5×5는 5색이에요.
            </p>
            <div className="mt-4">
              <ColorSquare />
            </div>
            <Think
              items={[
                "한 줄에 같은 색이 없으려면 4×4에서는 각 색이 모두 몇 개씩 놓여야 할까요?",
                "처음 놓인 칩이 너무 적으면 답이 여러 개가 돼요. 이 문제들은 답이 하나뿐인 것만 골라 냈어요. 가장 적은 칩으로도 하나뿐일지 새 문제를 눌러 가며 알아봐요.",
                "대각선 조건을 빼면 문제가 얼마나 쉬워질까요? (가로·세로만 겹치지 않는 판을 ‘라틴방진’이라고 해요. 숫자 스도쿠도 라틴방진의 한 종류예요.)",
              ]}
              pieces={false}
              note="조선의 수학자 최석정(1646~1715)은 《구수략》(1700)에서 오늘날 직교라틴방진으로 해석되는 9차 배열을 다룬 것으로 알려져 있어요. 오일러보다 앞선 것으로 국제적으로 소개된 것은 2006년 『조합론 디자인 편람』이에요."
            />
          </>
        )}
        {tab === "more" && (
          <>
            <h2 className="text-2xl font-extrabold">더 해 볼 체험</h2>
            <p className="mt-2 text-muted">같은 종류의 퍼즐을 더 해 볼 수 있는 곳이에요. 대부분 영어 사이트라서 화면 번역을 켜면 도움이 돼요. 바깥 사이트라서 내용이 바뀌거나 사라질 수 있어요.</p>
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
