import { useMemo, useState } from "react";
import PolyBoard, { type CellKind, type PieceDef } from "./PolyBoard";
import { makeTetrominoProblem, solveFill } from "./poly";

/** 테트로미노 5종: 막대(I) · 정사각형(O) · T · 지그재그(S) · L. 뒤집기를 쓰면 S와 L의 거울 모양도 만들 수 있어요. */
const PIECES: PieceDef[] = [
  { id: "i", name: "i", color: "#d63b3b" },
  { id: "o", name: "o", color: "#f08a3c" },
  { id: "s", name: "s", color: "#f2cf3a" },
  { id: "t", name: "t", color: "#1f9d5a" },
  { id: "l", name: "l", color: "#3b5bdb" },
];

export default function TetrominoPuzzle() {
  const [seed, setSeed] = useState(0);
  const problem = useMemo(() => makeTetrominoProblem(6, 7), [seed]);
  const kinds = useMemo<CellKind[][]>(() => problem.open.map((row) => row.map((v) => (v ? "open" : "void"))), [problem]);
  const solution = () => solveFill(problem.open, PIECES.map((p) => p.name)) ?? problem.sample;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSeed((s) => s + 1)}
          className="min-h-[44px] rounded-card bg-accent px-4 font-semibold text-accent-ink hover:brightness-110"
        >
          새 문제
        </button>
        <p className="text-sm text-muted">흰 칸 20개를 5종 조각으로 빈틈없이 덮어요. 조각은 한 번씩만 써요. 답이 둘 이상일 수도 있어요.</p>
      </div>
      <div className="mt-4">
        <PolyBoard kinds={kinds} pieces={PIECES} solution={solution} resetKey={seed} doneText="빈틈없이 5조각으로 덮었어요! 다른 방법도 있을까요?" cellPx={50} />
      </div>
    </div>
  );
}
