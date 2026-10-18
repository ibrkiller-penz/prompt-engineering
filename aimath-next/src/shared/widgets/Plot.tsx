// 좌표 그림. viewBox 를 실제 px 로 맞춰(ResizeObserver) 글자·선 굵기가 늘어나지 않아요.
// 계열 s1~s5 는 색 + 선 모양 + 표식으로 구분하고, '표로 보기'로 숫자를 볼 수 있어요. 요약은 aria-live 로 읽어 줘요.
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { PointerGate, arrowDelta, clampTo, clientToData, fmtNum, handleSize, linScale, markerPath, niceTicks, plotHeight, seriesStyle, summarize, type Box, type Scale, type XY } from "./plot.logic.ts";
import { useSurface } from "./kit.tsx";

export type { XY } from "./plot.logic.ts";

export interface PlotSeries {
  label: string;
  /** 계열 번호 1..5(색·선 모양·표식) */
  s?: number;
  /** line: 선(점이 12개 이하면 표식도), points: 점만, segs: 두 점씩 끊어 그린 선분 */
  kind?: "line" | "points" | "segs";
  data: XY[];
  /** 표식 크기 배율 */
  size?: number;
  /** 표로 보기에서 빼기 */
  noTable?: boolean;
  /** 선 굵기 배율 */
  weight?: number;
}

/** 끌어서 옮기는 손잡이 하나. 칠판·키보드를 위해 쓰는 쪽은 스테퍼 같은 대체 조작을 꼭 함께 둬요 */
export interface PlotHandle {
  id: string;
  x: number;
  y: number;
  /** 읽어 줄 이름(예: "새 점", "벡터 a 의 끝") */
  label: string;
  /** 계열 번호 1..5(색) */
  s?: number;
  /** 화살표 키 한 번에 움직이는 크기(기본: 범위의 1/20) */
  step?: number;
  /** 작게 그리기(점이 많을 때 고르지 않은 점). 잡히는 영역은 그대로예요 */
  small?: boolean;
}

export interface PlotScale {
  x: Scale;
  y: Scale;
  box: Box;
  width: number;
  height: number;
  unit: number; // 칠판이면 1.6, 아니면 1(글자·선 굵기 배율)
}

export interface PlotProps {
  title: string; // 그림 이름(aria-label)
  x: [number, number];
  y: [number, number];
  series: PlotSeries[];
  xLabel?: string;
  yLabel?: string;
  xTicks?: number[];
  yTicks?: number[];
  /** 높이/너비(기본 0.62) */
  ratio?: number;
  /** x·y 한 칸 길이를 같게 */
  equal?: boolean;
  /** 읽어 줄 요약(없으면 계열로 자동) */
  summary?: string;
  /** 그림을 누르면 그 자리의 값(데이터 좌표)을 알려 줘요. 칠판에서는 스테퍼 같은 대체 조작을 꼭 함께 두세요 */
  onPick?: (p: XY) => void;
  /** 계열 뒤(아래)에 그릴 것 */
  under?: (sc: PlotScale) => ReactNode;
  /** 계열 위에 그릴 것 */
  over?: (sc: PlotScale) => ReactNode;
  /** 표로 보기 단추 숨기기 */
  noTable?: boolean;
  /** 범례 숨기기 */
  noLegend?: boolean;
  /** 칠판에서 그림 높이 상한(기본 500). 도구가 무대 세로 안에 들도록 쓰는 쪽이 줄여요 */
  boardMaxH?: number;
  /** 끌어서 옮기는 손잡이들 */
  handles?: PlotHandle[];
  /** 손잡이를 끌거나 화살표 키로 옮길 때(데이터 좌표, 그림 범위 안으로 붙여서). 눈금 맞추기는 쓰는 쪽에서 해요 */
  onDrag?: (id: string, p: XY) => void;
}

const MAX_ROWS = 80;

export default function Plot(props: PlotProps) {
  const surface = useSurface();
  const board = surface === "board";
  const unit = board ? 1.6 : surface === "prep" ? 1.2 : 1;
  const wrap = useRef<HTMLDivElement | null>(null);
  const [boxW, setWidth] = useState(board ? 1100 : 340);
  const [asTable, setAsTable] = useState(false);
  const gate = useRef(new PointerGate());
  const lastDragEnd = useRef(0);
  const [dragging, setDragging] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const hasHandles = !!props.onDrag && !!props.handles && props.handles.length > 0;

  // 손잡이 위에서 시작한 터치는 화면 스크롤·확대로 넘어가지 않게 막아요.
  // (SVG 안쪽 요소의 touch-action 을 무시하는 브라우저가 있고, React 의 touch 이벤트는 passive 라 여기서 직접 걸어요)
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !hasHandles) return;
    const onStart = (e: TouchEvent) => {
      const t = e.target as Element | null;
      if (t && t.closest && t.closest(".wg-handle")) e.preventDefault();
    };
    const onMove = (e: TouchEvent) => {
      if (gate.current.active !== null) e.preventDefault();
    };
    const opt: AddEventListenerOptions = { passive: false };
    svg.addEventListener("touchstart", onStart, opt);
    svg.addEventListener("touchmove", onMove, opt);
    return () => {
      svg.removeEventListener("touchstart", onStart, opt);
      svg.removeEventListener("touchmove", onMove, opt);
    };
  }, [hasHandles, asTable]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => {
      // 칠판 무대는 transform: scale 로 줄어 있어서 getBoundingClientRect 는 줄어든 폭을 줘요. 배치 폭(clientWidth)을 먼저 써요
      const w = Math.round(el.clientWidth || el.getBoundingClientRect().width);
      if (w > 0) setWidth((old) => (Math.abs(old - w) >= 1 ? w : old));
    };
    measure();
    const RO = (window as unknown as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
    if (RO) {
      const ro = new RO(() => measure());
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [asTable]);

  const pad: Box = {
    left: Math.round((props.yLabel ? 58 : 46) * unit),
    right: Math.round(14 * unit),
    top: Math.round(14 * unit),
    bottom: Math.round((props.xLabel ? 50 : 32) * unit),
  };
  const maxH = board ? props.boardMaxH || 500 : surface === "prep" ? 520 : 440;
  let width = boxW;
  if (props.equal) {
    // 한 칸 길이를 같게 하려면 높이가 넘칠 때 너비를 줄여요(가운데 정렬)
    const dx = props.x[1] - props.x[0];
    const dy = props.y[1] - props.y[0];
    const need = ((boxW - pad.left - pad.right) * dy) / Math.max(1e-9, dx) + pad.top + pad.bottom;
    if (dx > 0 && dy > 0 && need > maxH) width = Math.round(pad.left + pad.right + ((maxH - pad.top - pad.bottom) * dx) / dy);
  }
  const height = plotHeight(width, props.ratio || 0.62, 160 * unit, maxH, props.equal ? { x: props.x, y: props.y, pad } : undefined);
  const sx = linScale(props.x[0], props.x[1], pad.left, width - pad.right);
  const sy = linScale(props.y[0], props.y[1], height - pad.bottom, pad.top);
  const sc: PlotScale = { x: sx, y: sy, box: pad, width, height, unit };
  const xt = props.xTicks || niceTicks(props.x[0], props.x[1], width < 420 ? 4 : 6);
  const yt = props.yTicks || niceTicks(props.y[0], props.y[1], height < 260 ? 4 : 6);
  // 칠판 글자는 28px 이상
  const fs = board ? 28 : Math.round(13 * unit);
  const hs = handleSize(surface);

  const summary = useMemo(() => props.summary || summarize(props.series), [props.summary, props.series]);

  const pick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!props.onPick) return;
    // 손잡이를 끌고 난 뒤 따라오는 click 은 점 찍기로 치지 않아요
    if (Date.now() - lastDragEnd.current < 400) return;
    const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const px = ((e.clientX - r.left) * width) / (r.width || width);
    const py = ((e.clientY - r.top) * height) / (r.height || height);
    if (px < pad.left || px > width - pad.right || py < pad.top || py > height - pad.bottom) return;
    props.onPick({ x: sx.inv(px), y: sy.inv(py) });
  };

  const toData = (svg: SVGSVGElement, cx: number, cy: number): XY => clientToData(cx, cy, svg.getBoundingClientRect(), width, height, sx, sy, props.x, props.y);

  const onHandleDown = (id: string) => (e: React.PointerEvent<SVGGElement>) => {
    if (!props.onDrag) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // 두 번째 손가락·손바닥은 무시해요(첫 손가락을 뗄 때까지)
    if (!gate.current.down(e.pointerId, e.isPrimary, id)) return;
    e.preventDefault();
    e.stopPropagation();
    const svg = e.currentTarget.ownerSVGElement;
    if (svg) {
      try {
        svg.setPointerCapture(e.pointerId);
      } catch {
        /* 캡처가 안 되는 브라우저면 svg 안에서만 따라가요 */
      }
    }
    setDragging(id);
  };
  const onSvgMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const id = gate.current.move(e.pointerId);
    if (id === null || !props.onDrag) return;
    e.preventDefault();
    props.onDrag(id, toData(e.currentTarget, e.clientX, e.clientY));
  };
  const onSvgUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!gate.current.up(e.pointerId)) return;
    lastDragEnd.current = Date.now();
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* 무시 */
    }
    setDragging(null);
  };
  const onHandleKey = (h: PlotHandle) => (e: React.KeyboardEvent<SVGGElement>) => {
    if (!props.onDrag) return;
    const d = arrowDelta(e.key);
    if (!d) return;
    e.preventDefault();
    const st = h.step || Math.abs(props.x[1] - props.x[0]) / 20;
    const lim = (v: number, a: [number, number]) => Math.max(Math.min(a[0], a[1]), Math.min(Math.max(a[0], a[1]), v));
    props.onDrag(h.id, { x: lim(h.x + d[0] * st, props.x), y: lim(h.y + d[1] * st, props.y) });
  };
  const handles = props.handles || [];
  const canDrag = !!props.onDrag && handles.length > 0;

  const clipId = useMemo(() => "wgclip" + Math.random().toString(36).slice(2, 9), []);
  const lo = (v: number, a: [number, number]) => clampTo(v, a[0], a[1]);

  return (
    <figure className={"wg-plot" + (board ? " is-board" : "")}>
      <div className="wg-plot-bar">
        {props.noLegend ? null : (
          <ul className="wg-legend" aria-label="범례">
            {props.series
              .filter((s) => s.label)
              .map((s, i) => {
                const st = seriesStyle(s.s || i + 1);
                return (
                  <li key={i} className={st.cls}>
                    <svg width={34 * unit} height={14 * unit} aria-hidden="true" focusable="false">
                      {s.kind === "points" ? null : <line x1={2} x2={32 * unit} y1={7 * unit} y2={7 * unit} className="wg-line" strokeDasharray={st.dash} />}
                      <path d={markerPath(st.marker, 17 * unit, 7 * unit, 4.5 * unit)} className="wg-mark" />
                    </svg>
                    <span>{s.label}</span>
                  </li>
                );
              })}
          </ul>
        )}
        {props.noTable ? null : (
          <button type="button" className="wg-btn wg-btn-small" aria-pressed={asTable} onClick={() => setAsTable(!asTable)}>
            {asTable ? "그림으로 보기" : "표로 보기"}
          </button>
        )}
      </div>
      {asTable ? (
        <div className="wg-table-wrap" tabIndex={0}>
          <table className="wg-table">
            <caption>{props.title}</caption>
            <thead>
              <tr>
                <th scope="col">계열</th>
                <th scope="col">{props.xLabel || "x"}</th>
                <th scope="col">{props.yLabel || "y"}</th>
              </tr>
            </thead>
            <tbody>
              {props.series
                .filter((s) => !s.noTable)
                .map((s, i) =>
                  s.data.slice(0, MAX_ROWS).map((p, j) => (
                    <tr key={i + ":" + j}>
                      <th scope="row">{s.label || "계열 " + (i + 1)}</th>
                      <td>{fmtNum(p.x, 3)}</td>
                      <td>{fmtNum(p.y, 3)}</td>
                    </tr>
                  )),
                )}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={wrap} className="wg-plot-box">
          <svg
            ref={svgRef}
            className={"wg-plot-svg" + (props.onPick ? " is-pick" : "") + (canDrag ? " has-handles" : "") + (dragging ? " is-dragging" : "")}
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={props.title}
            onClick={pick}
            onPointerMove={canDrag ? onSvgMove : undefined}
            onPointerUp={canDrag ? onSvgUp : undefined}
            onPointerCancel={canDrag ? onSvgUp : undefined}
            onLostPointerCapture={canDrag ? onSvgUp : undefined}
            onPointerLeave={canDrag ? onSvgUp : undefined}
            style={{ fontSize: fs + "px" }}
          >
            <defs>
              <clipPath id={clipId}>
                <rect x={pad.left} y={pad.top} width={Math.max(0, width - pad.left - pad.right)} height={Math.max(0, height - pad.top - pad.bottom)} />
              </clipPath>
            </defs>
            <g className="wg-grid">
              {xt.map((t) => (
                <line key={"gx" + t} x1={sx(t)} x2={sx(t)} y1={pad.top} y2={height - pad.bottom} />
              ))}
              {yt.map((t) => (
                <line key={"gy" + t} x1={pad.left} x2={width - pad.right} y1={sy(t)} y2={sy(t)} />
              ))}
            </g>
            <g className="wg-axis">
              {props.y[0] <= 0 && props.y[1] >= 0 ? <line x1={pad.left} x2={width - pad.right} y1={sy(0)} y2={sy(0)} /> : null}
              {props.x[0] <= 0 && props.x[1] >= 0 ? <line x1={sx(0)} x2={sx(0)} y1={pad.top} y2={height - pad.bottom} /> : null}
              <rect className="wg-frame" x={pad.left} y={pad.top} width={Math.max(0, width - pad.left - pad.right)} height={Math.max(0, height - pad.top - pad.bottom)} />
            </g>
            <g className="wg-ticks">
              {xt.map((t) => (
                <text key={"tx" + t} x={sx(t)} y={height - pad.bottom + fs * 1.3} textAnchor="middle">
                  {fmtNum(t, 3)}
                </text>
              ))}
              {yt.map((t) => (
                <text key={"ty" + t} x={pad.left - fs * 0.5} y={sy(t) + fs * 0.35} textAnchor="end">
                  {fmtNum(t, 3)}
                </text>
              ))}
              {props.xLabel ? (
                <text x={(pad.left + width - pad.right) / 2} y={height - fs * 0.5} textAnchor="middle" className="wg-axis-label">
                  {props.xLabel}
                </text>
              ) : null}
              {props.yLabel ? (
                <text x={fs * 0.9} y={(pad.top + height - pad.bottom) / 2} textAnchor="middle" className="wg-axis-label" transform={`rotate(-90 ${fs * 0.9} ${(pad.top + height - pad.bottom) / 2})`}>
                  {props.yLabel}
                </text>
              ) : null}
            </g>
            <g clipPath={`url(#${clipId})`}>
              {props.under ? props.under(sc) : null}
              {props.series.map((s, i) => {
                const st = seriesStyle(s.s || i + 1);
                const kind = s.kind || "line";
                const pts = s.data.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
                const sw = 2.5 * unit * (s.weight || 1);
                const r = 5 * unit * (s.size || 1);
                const showMarks = kind === "points" || (kind === "line" && pts.length >= 3 && pts.length <= 12);
                let d = "";
                if (kind === "line")
                  d = pts.map((p, j) => (j ? "L" : "M") + sx(p.x).toFixed(1) + "," + sy(lo(p.y, props.y)).toFixed(1)).join("");
                if (kind === "segs")
                  for (let j = 0; j + 1 < pts.length; j += 2)
                    d += "M" + sx(pts[j].x).toFixed(1) + "," + sy(lo(pts[j].y, props.y)).toFixed(1) + "L" + sx(pts[j + 1].x).toFixed(1) + "," + sy(lo(pts[j + 1].y, props.y)).toFixed(1);
                return (
                  <g key={i} className={st.cls}>
                    {d ? <path d={d} className="wg-line" strokeWidth={sw} strokeDasharray={st.dash ? st.dash.split(" ").map((v) => String(Number(v) * unit)).join(" ") : undefined} /> : null}
                    {showMarks ? pts.map((p, j) => <path key={j} d={markerPath(st.marker, sx(p.x), sy(p.y), r)} className="wg-mark" />) : null}
                  </g>
                );
              })}
              {props.over ? props.over(sc) : null}
            </g>
            {canDrag ? (
              <g className="wg-handles">
                {handles.map((h, i) => {
                  const st = seriesStyle(h.s || i + 1);
                  const cx = sx(h.x);
                  const cy = sy(h.y);
                  const on = dragging === h.id;
                  const r = h.small && !on ? Math.max(6, hs.r * 0.45) : hs.r;
                  return (
                    <g
                      key={h.id}
                      className={"wg-handle " + st.cls + (on ? " is-on" : "") + (h.small ? " is-small" : "")}
                      tabIndex={0}
                      role="button"
                      aria-label={`${h.label} (${fmtNum(h.x, 2)}, ${fmtNum(h.y, 2)}). 끌거나 화살표 키로 옮겨요`}
                      onPointerDown={onHandleDown(h.id)}
                      onKeyDown={onHandleKey(h)}
                      style={{ touchAction: "none" }}
                    >
                      <circle className="wg-handle-hit" cx={cx} cy={cy} r={hs.hit} />
                      <circle className="wg-handle-dot" cx={cx} cy={cy} r={r} />
                    </g>
                  );
                })}
              </g>
            ) : null}
          </svg>
        </div>
      )}
      <p className="wg-sr" aria-live="polite">
        {summary}
      </p>
    </figure>
  );
}
