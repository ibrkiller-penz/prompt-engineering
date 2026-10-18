// 진리표 만들기: p, q 의 참·거짓으로 ~p, p∧q, p∨q, p⊕q 를 구하고, 연습 진리표를 직접 채워요.
import { useState } from "react";
import type { WidgetProps } from "../../contracts.ts";
import { PAIRS, PRACTICES, combine, evalRow, fmt, gradeCells, truthRows, type Cell, type Notation } from "@legacy/widgets/Truth.logic";
import { Big, Btn, Hide, Note, Row, Seg, Split, Table, Toggle, Verdict, useHidden, useIsBoard } from "../kit.tsx";
import { mission } from "./mission.ts";
import { useMission } from "../useMission.ts";

export default function Truth(props: WidgetProps) {
  const [p, setP] = useState(true);
  const [q, setQ] = useState(false);
  const [mode, setMode] = useState<Notation>("TF");
  const [pairIdx, setPairIdx] = useState(0);
  const [prac, setPrac] = useState(0);
  const [cells, setCells] = useState<Cell[]>([null, null, null, null]);
  const [checked, setChecked] = useState(false);
  const hidden = useHidden();
  const board = useIsBoard();
  // 칠판은 세 부분(연산 값 · 문장으로 · 연습)을 한 번에 하나씩 크게 보여 줘요
  const [part, setPart] = useState<"calc" | "sent" | "prac">("calc");
  const graded = gradeCells(prac, cells);
  useMission(props, mission, { graded, checked });

  const row = evalRow(p, q);
  const f = (v: boolean) => fmt(v, mode);
  const pair = PAIRS[pairIdx];
  const rows = truthRows();
  const cycle = (i: number) => {
    const c = cells[i];
    const next: Cell = c === null ? true : c === true ? false : null;
    setCells(cells.map((x, j) => (j === i ? next : x)));
    setChecked(false);
  };

  const pq = (
    <Row>
      <Toggle label={"p = " + f(p)} on={p} onChange={setP} />
      <Toggle label={"q = " + f(q)} on={q} onChange={setQ} />
      <Seg
        label="표기"
        value={mode}
        options={[
          { value: "TF", label: "T/F" },
          { value: "10", label: "1/0" },
        ]}
        onChange={setMode}
      />
    </Row>
  );
  const calcA = (
    <>
      <Big label="p∧q · p∨q" sub={`~p = ${f(row.notP)}, p⊕q = ${f(row.xor)}`}>
        {f(row.and)} · {f(row.or)}
      </Big>
      <Hide label="연산 값 표">
        <Table
          caption="지금 p, q로 구한 값"
          head={["연산", "값"]}
          rows={[
            ["~p (부정)", f(row.notP)],
            ["p∧q (그리고)", f(row.and)],
            ["p∨q (또는)", f(row.or)],
            ["p⊕q (둘 중 하나만)", f(row.xor)],
          ]}
        />
      </Hide>
    </>
  );
  const calcB = (
    <>
      <Hide label="진리표">
        <Table
          caption="진리표(지금 줄은 진하게)"
          head={["p", "q", "~p", "p∧q", "p∨q", "p⊕q"]}
          rows={rows.map((r) => [f(r.p), f(r.q), f(r.notP), f(r.and), f(r.or), f(r.xor)])}
          hl={(i) => rows[i].p === p && rows[i].q === q}
        />
      </Hide>
    </>
  );
  const sentence = (
    <>
      <h4 className="wg-h">문장으로 해 봐요</h4>
      <Seg label="명제 쌍" value={pairIdx} options={PAIRS.map((x, i) => ({ value: i, label: x.name }))} onChange={setPairIdx} />
      <p className="wg-line">
        p: {pair.p} ({f(pair.pv)}) · q: {pair.q} ({f(pair.qv)})
      </p>
      <ul className="wg-list">
        {combine(pair).map((c) => (
          <li key={c.key}>
            <strong>{c.op}</strong> {c.sentence} → <strong>{hidden ? "?" : f(c.value)}</strong>
          </li>
        ))}
      </ul>
    </>
  );
  const pracHead = (
    <>
      <h4 className="wg-h">연습: 진리표 채우기</h4>
      <Seg
        label="식"
        value={prac}
        options={PRACTICES.map((x, i) => ({ value: i, label: x.label }))}
        onChange={(i) => {
          setPrac(i);
          setCells([null, null, null, null]);
          setChecked(false);
        }}
      />
      <Note>
        칸을 누를 때마다 빈칸 → {f(true)} → {f(false)} 차례로 바뀌어요.
      </Note>
    </>
  );
  const pracGrade = (
    <>
      <Row>
        <Btn primary onClick={() => setChecked(true)}>
          채점하기
        </Btn>
      </Row>
      {checked ? (
        <Verdict keep ok={graded.every((g) => g === true)}>
          {graded.every((g) => g === true)
            ? "네 칸 모두 맞았어요."
            : `맞은 칸 ${graded.filter((g) => g === true).length}개, 틀린 칸 ${graded.filter((g) => g === false).length}개, 빈칸 ${graded.filter((g) => g === null).length}개예요.`}
        </Verdict>
      ) : null}
    </>
  );
  const pracTable = (
    <Table
      caption={PRACTICES[prac].label + " 의 진리표"}
      head={["p", "q", PRACTICES[prac].label]}
      rows={rows.map((r, i) => [
        f(r.p),
        f(r.q),
        <button
          key="c"
          type="button"
          className={"wg-btn wg-cell" + (checked && graded[i] !== null ? (graded[i] ? " is-ok" : " is-bad") : "")}
          aria-label={`${i + 1}번째 줄 답: ${cells[i] === null ? "빈칸" : f(cells[i] as boolean)}`}
          onClick={() => cycle(i)}
        >
          {cells[i] === null ? "?" : f(cells[i] as boolean)}
          {checked && graded[i] !== null ? (graded[i] ? " ✓" : " ✗") : ""}
        </button>,
      ])}
    />
  );

  if (board) {
    return (
      <div className="wg-body wg-body-split">
        <div className="wg-topline">
          {pq}
          <Seg
            label="보기"
            value={part}
            options={[
              { value: "calc", label: "① 연산 값" },
              { value: "sent", label: "② 문장으로" },
              { value: "prac", label: "③ 연습" },
            ]}
            onChange={setPart}
          />
        </div>
        {part === "calc" ? (
          <Split a={calcA} b={calcB} />
        ) : part === "sent" ? (
          <div className="wg-stack">{sentence}</div>
        ) : (
          <Split
            a={
              <>
                {pracHead}
                {pracGrade}
              </>
            }
            b={pracTable}
          />
        )}
      </div>
    );
  }
  return (
    <div className="wg-body">
      {pq}
      {calcA}
      {calcB}
      {sentence}
      {pracHead}
      {pracTable}
      {pracGrade}
    </div>
  );
}
