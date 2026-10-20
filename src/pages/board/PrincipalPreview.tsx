/** 교장실 모드 화면 예시(가짜 자료). 실제 보드(1024×600) 배치를 흉내 낸 그림이며 일정·숫자는 모두 지어낸 거예요. */
const C = { bg: "#1c1714", panel: "#26201c", row: "#342c26", line: "#4a4038", text: "#faf5ee", sub: "#e2d8cc", muted: "#b8ab9c", amber: "#fbbf24", next: "#facc15", cream: "#fff4e0", ink: "#2a2320" };

const ROWS: [string, string, string, "cur" | "next" | ""][] = [
  ["오늘", "학교 안전 점검 주간", "~10/24", ""],
  ["오늘", "교육과정 협의회", "15:30 · 회의실", "next"],
  ["10/21 화", "2학년 현장체험학습", "전일", ""],
  ["10/22 수", "학교운영위원회", "15:00 · 회의실", ""],
  ["10/23 목", "학년 협의회", "교무부", ""],
  ["10/27 월", "부장 회의", "7교시 · 회의실", ""],
  ["10/30 목", "교복 구매 설명회", "강당", ""],
  ["11/03 월", "학부모 상담 주간", "~11/07", ""],
];

export default function PrincipalPreview() {
  return (
    <figure className="mx-auto w-full max-w-2xl">
      <svg
        viewBox="0 0 1024 600"
        role="img"
        aria-label="교장실 모드 화면 예시: 왼쪽에 시계·학교 지금·날씨, 오른쪽에 학교 일정 8줄과 학사 일정"
        className="w-full rounded-card border-4 border-[#120e0c] shadow-lg"
      >
        <rect width="1024" height="600" fill={C.bg} />
        {/* 왼쪽 */}
        <rect x="15" y="15" width="532" height="570" rx="16" fill={C.panel} stroke={C.line} />
        <text x="530" y="40" fontSize="17" textAnchor="end" fill={C.muted}>▮ 74%</text>
        <text x="281" y="150" fontSize="126" fontWeight="800" textAnchor="middle" fill={C.text}>15:12</text>
        <text x="281" y="200" fontSize="30" fontWeight="600" textAnchor="middle" fill={C.sub}>10월 20일 월요일</text>
        <rect x="41" y="230" width="480" height="150" rx="14" fill={C.row} stroke={C.sub} />
        <circle cx="108" cy="305" r="46" fill="none" stroke={C.line} strokeWidth="6" />
        <path d="M108 259 A46 46 0 1 1 64 318" fill="none" stroke={C.amber} strokeWidth="6" />
        <text x="108" y="316" fontSize="32" fontWeight="800" textAnchor="middle" fill={C.text}>6</text>
        <text x="178" y="275" fontSize="25" fontWeight="800" fill={C.text}>6교시 수업 중</text>
        <text x="178" y="310" fontSize="20" fill={C.sub}>28분 남음 · 7교시 15:40</text>
        <text x="178" y="360" fontSize="19" fill={C.muted}>수업 중 31명 · 수업 없음 17명 ›</text>
        <rect x="41" y="395" width="480" height="164" rx="14" fill={C.row} stroke={C.line} />
        <text x="61" y="432" fontSize="25" fontWeight="800" fill={C.text}>19° 맑음</text>
        <text x="61" y="466" fontSize="19" fill={C.sub}>
          최고 22° 최저 12° · <tspan fill="#34d399">미세먼지 보통</tspan>
        </text>
        <text x="61" y="500" fontSize="19" fill={C.muted}>급식</text>
        <text x="113" y="500" fontSize="19" fill={C.sub}>잡곡밥, 미역국, 불고기 …</text>
        <line x1="61" x2="501" y1="518" y2="518" stroke={C.line} />
        <text x="61" y="545" fontSize="19" fill="#34d399">
          ● 운동장 활동 가능 <tspan fill={C.muted}> 바깥 활동 문제없음</tspan>
        </text>
        {/* 오른쪽 */}
        <rect x="562" y="15" width="447" height="570" rx="16" fill={C.panel} stroke={C.line} />
        <text x="582" y="46" fontSize="20" fontWeight="700" fill={C.text}>학교 일정 · 교장</text>
        <rect x="806" y="22" width="110" height="34" rx="8" fill={C.row} stroke={C.line} />
        <text x="861" y="45" fontSize="16" textAnchor="middle" fill={C.sub}>30일 일정 ›</text>
        <rect x="924" y="22" width="70" height="34" rx="8" fill={C.row} stroke={C.line} />
        <text x="959" y="45" fontSize="16" textAnchor="middle" fill={C.sub}>설정</text>
        {ROWS.map(([d, t, s, k], i) => {
          const y = 66 + i * 48;
          const today = d === "오늘";
          return (
            <g key={i}>
              <rect x="577" y={y} width="417" height="42" rx="10" fill={C.row} stroke={k === "next" ? C.next : C.line} strokeWidth={k === "next" ? 2 : 1} />
              <rect x="583" y={y + 4} width="80" height="34" rx="10" fill={today ? C.amber : C.line} />
              <text x="623" y={y + 27} fontSize="16" textAnchor="middle" fill={today ? C.ink : C.sub}>{d}</text>
              <text x="675" y={y + 27} fontSize="18" fontWeight="600" fill={C.text}>{t}</text>
              <text x="982" y={y + 27} fontSize="15" textAnchor="end" fill={C.muted}>{s}</text>
            </g>
          );
        })}
        <rect x="577" y="458" width="417" height="112" rx="14" fill={C.row} stroke={C.line} />
        <text x="593" y="484" fontSize="15" fill={C.muted}>학사 일정</text>
        <text x="593" y="513" fontSize="18" fill={C.text}>중간고사 · 10/28~10/30 · D-8</text>
        <text x="593" y="538" fontSize="18" fill={C.sub}>재량휴업일 · 11/14 금 · D-25</text>
        <text x="593" y="563" fontSize="18" fill={C.sub}>수능 · 11/19 목 · D-30</text>
      </svg>
      <figcaption className="mt-2 text-center text-sm text-muted">교장실 모드 화면 예시 (1024×600 보드, 지어낸 일정)</figcaption>
    </figure>
  );
}
