/** 화면 흔들림 설명 그림 두 장 (인라인 SVG, 색은 사이트 색을 따라가요) */

/** 그림 1 — 그림이 화면까지 가는 길과 길을 막는 것들 */
export function PathFigure() {
  const box = "fill-surface stroke-line";
  const bad = "fill-bad-soft stroke-bad";
  return (
    <figure className="mt-5 max-w-3xl">
      <svg
        viewBox="0 0 760 330"
        role="img"
        aria-label="그림이 화면까지 가는 길. 그림 그리기에서 프레임 버퍼(PSRAM), 완충 버퍼(칩 안쪽 RAM)를 거쳐 화면으로 가고, 와이파이·저장·코드 읽기·전체 다시 그리기가 PSRAM과 플래시가 나눠 쓰는 길을 막는다."
        className="w-full rounded-card border border-line bg-surface"
      >
        <defs>
          <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" className="fill-muted" />
          </marker>
          <marker id="arrbad" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" className="fill-bad" />
          </marker>
        </defs>

        <text x="20" y="26" className="fill-muted" fontSize="14" fontWeight="700">
          ① 그림이 화면에 가는 길 (쉬지 않고 매 1/60초쯤 한 장 전체)
        </text>

        <rect x="14" y="40" width="150" height="64" rx="10" className={box} strokeWidth="2" />
        <text x="89" y="68" textAnchor="middle" fontSize="15" fontWeight="800" className="fill-ink">
          그림 그리기
        </text>
        <text x="89" y="89" textAnchor="middle" fontSize="13" className="fill-muted">
          (LVGL)
        </text>

        <rect x="214" y="40" width="172" height="64" rx="10" className="fill-accent-soft stroke-accent" strokeWidth="2" />
        <text x="300" y="68" textAnchor="middle" fontSize="15" fontWeight="800" className="fill-ink">
          프레임 버퍼
        </text>
        <text x="300" y="89" textAnchor="middle" fontSize="13" className="fill-muted">
          PSRAM(칩 바깥 창고)
        </text>

        <rect x="438" y="40" width="160" height="64" rx="10" className={box} strokeWidth="2" />
        <text x="518" y="68" textAnchor="middle" fontSize="15" fontWeight="800" className="fill-ink">
          완충 버퍼
        </text>
        <text x="518" y="89" textAnchor="middle" fontSize="13" className="fill-muted">
          칩 안쪽 RAM(책상 위)
        </text>

        <rect x="650" y="40" width="96" height="64" rx="10" className="fill-ink" />
        <text x="698" y="78" textAnchor="middle" fontSize="16" fontWeight="800" fill="#fff">
          화면
        </text>

        {[
          [164, 214, "바뀐 곳만"],
          [386, 438, "블록씩"],
          [598, 650, "박자마다"],
        ].map(([x1, x2, t]) => (
          <g key={String(t)}>
            <line x1={Number(x1) + 2} y1="72" x2={Number(x2) - 2} y2="72" className="stroke-muted" strokeWidth="2.5" markerEnd="url(#arr)" />
            <text x={(Number(x1) + Number(x2)) / 2} y="62" textAnchor="middle" fontSize="11" className="fill-muted">
              {t}
            </text>
          </g>
        ))}

        <line x1="300" y1="104" x2="300" y2="148" className="stroke-accent" strokeWidth="2.5" />
        <rect x="214" y="148" width="360" height="30" rx="8" className="fill-warn-soft stroke-warn" strokeWidth="2" />
        <text x="394" y="168" textAnchor="middle" fontSize="13" fontWeight="800" className="fill-warn">
          PSRAM과 플래시가 나눠 쓰는 같은 길(SPI)
        </text>
        <line x1="574" y1="163" x2="610" y2="163" className="stroke-warn" strokeWidth="2.5" />
        <rect x="610" y="140" width="136" height="46" rx="10" className={box} strokeWidth="2" />
        <text x="678" y="160" textAnchor="middle" fontSize="14" fontWeight="800" className="fill-ink">
          플래시
        </text>
        <text x="678" y="177" textAnchor="middle" fontSize="11" className="fill-muted">
          프로그램·저장
        </text>

        <text x="20" y="226" className="fill-bad" fontSize="14" fontWeight="700">
          ② 길을 막는 것들
        </text>
        {[
          [14, "와이파이", "받는 동안 길을 많이 써요"],
          [214, "저장하기", "쓰는 동안 PSRAM 멈춤"],
          [414, "코드·상수 읽기", "읽을 때도 길을 써요"],
          [614, "전체 다시 그리기", "매초 시계를 바꾸면 매초"],
        ].map(([x, t, d], i) => (
          <g key={String(t)}>
            <rect x={Number(x)} y="268" width="132" height="50" rx="9" className={bad} strokeWidth="2" />
            <text x={Number(x) + 66} y="289" textAnchor="middle" fontSize="13.5" fontWeight="800" className="fill-bad">
              {t}
            </text>
            <text x={Number(x) + 66} y="306" textAnchor="middle" fontSize="10.5" className="fill-ink">
              {d}
            </text>
            <line
              x1={Number(x) + 66}
              y1="268"
              x2={i < 2 ? 330 + i * 80 : 430 + (i - 2) * 100}
              y2="178"
              className="stroke-bad"
              strokeWidth="2"
              strokeDasharray="5 4"
              markerEnd="url(#arrbad)"
            />
          </g>
        ))}
      </svg>
      <figcaption className="mt-2 text-sm text-muted">
        하나라도 길을 오래 막으면, 화면에 보낼 그림이 제때 오지 못해서 박자가 어긋나요. 그림은 설명을 위해 단순하게 그렸어요.
      </figcaption>
    </figure>
  );
}

/** 그림 2 — 증상 세 가지를 작은 화면으로 */
export function SymptomFigure() {
  const rows = [
    { y: 26, w: 120, c: "fill-ink" },
    { y: 46, w: 150, c: "fill-muted" },
    { y: 66, w: 100, c: "fill-ink" },
    { y: 86, w: 140, c: "fill-muted" },
    { y: 106, w: 90, c: "fill-ink" },
  ];
  const Screen = ({ x, shifts, label, sub, tone }: { x: number; shifts: number[]; label: string; sub: string; tone: string }) => (
    <g transform={`translate(${x} 0)`}>
      <rect x="0" y="10" width="200" height="120" rx="8" className="fill-[#0f172a]" />
      <clipPath id={`clip${x}`}>
        <rect x="0" y="10" width="200" height="120" rx="8" />
      </clipPath>
      <g clipPath={`url(#clip${x})`}>
        {rows.map((r, i) => (
          <g key={i}>
            <rect x={14 + shifts[i]} y={r.y + 10} width={r.w} height="10" rx="3" fill="#e2e8f0" opacity={i % 2 ? 0.7 : 1} />
            {shifts[i] > 20 && <rect x={14 + shifts[i] - 200} y={r.y + 10} width={r.w} height="10" rx="3" fill="#e2e8f0" opacity={i % 2 ? 0.7 : 1} />}
          </g>
        ))}
      </g>
      <text x="100" y="152" textAnchor="middle" fontSize="15" fontWeight="800" className={tone}>
        {label}
      </text>
      <text x="100" y="170" textAnchor="middle" fontSize="12" className="fill-muted">
        {sub}
      </text>
    </g>
  );
  return (
    <figure className="mt-5 max-w-3xl">
      <svg viewBox="0 0 680 184" role="img" aria-label="증상 세 가지. 정상, 줄이 들쭉날쭉 떨리는 지지직 떨림, 그림 전체가 옆으로 밀려 글자가 반대편에 걸리는 밀림" className="w-full rounded-card border border-line bg-surface">
        <Screen x={14} shifts={[0, 0, 0, 0, 0]} label="정상" sub="줄이 가지런해요" tone="fill-ok" />
        <Screen x={240} shifts={[0, 7, -5, 9, -3]} label="지지직 떨림" sub="줄마다 들쭉날쭉, 가끔 번쩍" tone="fill-warn" />
        <Screen x={466} shifts={[62, 62, 62, 62, 62]} label="옆으로 밀림" sub="통째로 밀려 한쪽에 걸려요" tone="fill-bad" />
      </svg>
      <figcaption className="mt-2 text-sm text-muted">실제 화면을 찍은 사진이 아니라 증상을 단순하게 그린 그림이에요.</figcaption>
    </figure>
  );
}
