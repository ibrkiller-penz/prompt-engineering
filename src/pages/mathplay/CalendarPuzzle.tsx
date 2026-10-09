import { useMemo, useState } from "react";
import PolyBoard, { type CellKind, type PieceDef } from "./PolyBoard";
import { solveFill } from "./poly";

const WEEK = ["월", "화", "수", "목", "금", "토", "일"];

/** 10조각: 펜토미노 7개(F·I·L·N·P·T·U)와 테트로미노 3개(I·O·L). 어느 날짜를 골라도 풀리도록 컴퓨터로 2,562가지(월·일·요일) 모두 확인한 조합이에요. */
const PIECES: PieceDef[] = [
  { id: "F", name: "F", color: "#ef7fb0" },
  { id: "I", name: "I", color: "#3b6fd8" },
  { id: "L", name: "L", color: "#8e5bd1" },
  { id: "N", name: "N", color: "#1f9d8a" },
  { id: "P", name: "P", color: "#f0a02a" },
  { id: "T", name: "T", color: "#4cae4f" },
  { id: "U", name: "U", color: "#e5584c" },
  { id: "i", name: "i", color: "#6bb3e8" },
  { id: "o", name: "o", color: "#f2cf3a" },
  { id: "l", name: "l", color: "#f08a3c" },
];

const R = 8;
const C = 7;

/** 판의 칸 배치: 월 12칸(위 두 줄), 날짜 31칸, 요일 7칸(아래 오른쪽) */
function layout() {
  const month: [number, number][] = [...Array(12)].map((_, m) => [Math.floor(m / 6), m % 6]);
  const day: [number, number][] = [...Array(31)].map((_, k) => [2 + Math.floor(k / 7), k % 7]);
  const week: [number, number][] = [...Array(7)].map((_, w) => (w < 4 ? [6, 3 + w] : [7, w]));
  return { month, day, week };
}
const L = layout();

const pad = (n: number) => String(n).padStart(2, "0");
const toInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default function CalendarPuzzle() {
  const [value, setValue] = useState(() => toInput(new Date()));
  const date = useMemo(() => {
    const [y, m, d] = value.split("-").map(Number);
    const t = new Date(y, (m || 1) - 1, d || 1);
    return Number.isNaN(t.getTime()) ? new Date() : t;
  }, [value]);
  const month = date.getMonth();
  const day = date.getDate();
  const week = (date.getDay() + 6) % 7; // 월=0

  const { kinds, labels } = useMemo(() => {
    const kinds: CellKind[][] = Array.from({ length: R }, () => Array<CellKind>(C).fill("void"));
    const labels: (string | undefined)[][] = Array.from({ length: R }, () => Array<string | undefined>(C).fill(undefined));
    L.month.forEach(([r, c], m) => {
      kinds[r][c] = m === month ? "target" : "open";
      labels[r][c] = `${m + 1}월`;
    });
    L.day.forEach(([r, c], k) => {
      kinds[r][c] = k + 1 === day ? "target" : "open";
      labels[r][c] = String(k + 1);
    });
    L.week.forEach(([r, c], w) => {
      kinds[r][c] = w === week ? "target" : "open";
      labels[r][c] = WEEK[w];
    });
    return { kinds, labels };
  }, [month, day, week]);

  const solution = () => {
    const open = kinds.map((row) => row.map((k) => k === "open"));
    return solveFill(open, PIECES.map((p) => p.name));
  };

  const today = toInput(new Date());
  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="block text-sm font-semibold text-muted">날짜 고르기</span>
          <input
            type="date"
            value={value}
            min="2000-01-01"
            max="2099-12-31"
            onChange={(e) => e.target.value && setValue(e.target.value)}
            className="mt-1 min-h-[44px] rounded-card border border-line bg-surface px-3 outline-none focus:border-accent"
          />
        </label>
        <button
          type="button"
          onClick={() => setValue(today)}
          className="min-h-[44px] rounded-card border border-line bg-surface px-4 font-semibold hover:bg-bg"
        >
          오늘 날짜
        </button>
        <p className="min-h-[44px] flex-1 basis-48 self-center text-lg font-extrabold">
          {month + 1}월 {day}일 {WEEK[week]}요일
          <span className="block text-sm font-normal text-muted">이 세 칸만 남기고 나머지를 10조각으로 덮어요.</span>
        </p>
      </div>
      <div className="mt-4">
        <PolyBoard
          kinds={kinds}
          labels={labels}
          pieces={PIECES}
          solution={solution}
          resetKey={value}
          doneText={`${month + 1}월 ${day}일 ${WEEK[week]}요일만 남기고 모두 덮었어요!`}
          cellPx={46}
        />
      </div>
    </div>
  );
}
