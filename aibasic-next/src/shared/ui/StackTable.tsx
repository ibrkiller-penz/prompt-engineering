// 표. 휴대폰에서 3열 이상이면 세로 카드(한 줄 = 카드 한 장)로 보여 주고, '표로 보기'로 바꿀 수 있어요.
// 표로 볼 때 넘치면 가로 스크롤 + 힌트(넘칠 때만).
import { useState } from "react";
import type { Surface } from "../contracts.ts";
import { Rich } from "./tex.tsx";
import { useOverflowX, useUiSurface } from "./surface.ts";

export interface StackTableProps {
  head: string[];
  rows: string[][];
  caption?: string;
  surface?: Surface;
  /** 카드형으로 바꾸는 최소 열 수(기본 3) */
  cardFrom?: number;
}

const NUM_RE = /^\s*[-+−]?\d[\d,]*(\.\d+)?\s*%?\s*$/;

function TableView({ head, rows, caption, surface }: StackTableProps & { surface: Surface }) {
  const [ref, over] = useOverflowX<HTMLDivElement>([head.length, rows.length, surface]);
  const hasCode = rows.some((r) => r.some((c) => c.indexOf("`") >= 0));
  return (
    <div className="ui-table-wrap">
      <div ref={ref} className={"scroll-x ui-table-scroll" + (over ? " is-overflow" : "")} tabIndex={over ? 0 : undefined} role={over ? "region" : undefined} aria-label={over ? "표(옆으로 밀어 볼 수 있어요)" : undefined}>
        <table className={"tbl ui-table is-" + surface + (hasCode ? " has-code" : "")}>
          {caption ? (
            <caption className="ui-caption">
              <Rich text={caption} />
            </caption>
          ) : null}
          <thead>
            <tr>
              {head.map((h, i) => (
                <th key={i} scope="col">
                  <Rich text={h} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri}>
                {r.map((c, ci) =>
                  ci === 0 ? (
                    <th key={ci} scope="row" className={NUM_RE.test(c) ? "num" : undefined}>
                      <Rich text={c} />
                    </th>
                  ) : (
                    <td key={ci} className={NUM_RE.test(c) ? "num" : undefined}>
                      <Rich text={c} />
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {over ? (
        <p className="scroll-hint ui-scroll-hint" aria-hidden="true">
          옆으로 밀어서 나머지 칸을 봐요 →
        </p>
      ) : null}
    </div>
  );
}

function CardView({ head, rows, caption }: StackTableProps) {
  return (
    <div className="ui-tcards" role="list" aria-label={caption ? undefined : "표 내용"}>
      {rows.map((r, ri) => (
        <div key={ri} className="ui-tcard" role="listitem">
          <div className="ui-tcard-title">
            <span className="ui-tcard-k">
              <Rich text={head[0]} />
            </span>
            <Rich text={r[0]} />
          </div>
          <dl className="ui-tcard-dl">
            {head.slice(1).map((h, hi) => (
              <div key={hi} className="ui-tcard-row">
                <dt>
                  <Rich text={h} />
                </dt>
                <dd>
                  <Rich text={r[hi + 1] == null ? "" : r[hi + 1]} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

export function StackTable(props: StackTableProps) {
  const sf = useUiSurface(props.surface);
  const canCard = sf === "phone" && props.head.length >= (props.cardFrom || 3);
  const [asTable, setAsTable] = useState(false);
  if (!canCard) return <TableView {...props} surface={sf} />;
  return (
    <figure className="ui-stack">
      <div className="ui-stack-head">
        {props.caption ? (
          <figcaption className="ui-caption">
            <Rich text={props.caption} />
          </figcaption>
        ) : (
          <span className="ui-caption">표</span>
        )}
        <button type="button" className="btn btn-ghost ui-stack-toggle" aria-pressed={asTable} onClick={() => setAsTable(!asTable)}>
          {asTable ? "카드로 보기" : "표로 보기"}
        </button>
      </div>
      {asTable ? <TableView {...props} caption={undefined} surface={sf} /> : <CardView {...props} />}
    </figure>
  );
}
