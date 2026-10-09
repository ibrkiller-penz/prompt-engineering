/** 시계 화면 예시(샘플 자료). 실제 보드 화면을 흉내 낸 그림이며 글자·숫자는 모두 가짜예요. */
export default function ScreenPreview() {
  const row = (y: number, a: string, b: string, c: string, hot = false) => (
    <g key={y}>
      <rect x="440" y={y} width="348" height="42" rx="8" fill={hot ? "#f8fafc" : "#1e293b"} stroke={hot ? "#f8fafc" : "#334155"} />
      <text x="456" y={y + 28} fontSize="20" fontWeight="700" fill={hot ? "#0f172a" : "#94a3b8"}>
        {a}
      </text>
      <text x="520" y={y + 28} fontSize="20" fontWeight="700" fill={hot ? "#0f172a" : "#e2e8f0"}>
        {b}
      </text>
      <text x="772" y={y + 28} fontSize="18" textAnchor="end" fill={hot ? "#334155" : "#94a3b8"}>
        {c}
      </text>
    </g>
  );
  return (
    <figure className="mx-auto w-full max-w-md">
      <svg viewBox="0 0 800 480" role="img" aria-label="시계 화면 예시: 큰 시계, 날씨, 오늘 시간표" className="w-full rounded-card border-4 border-[#0b1220] bg-[#0b1220] shadow-lg">
        <rect width="800" height="480" fill="#0f172a" />
        <rect x="12" y="12" width="416" height="456" rx="14" fill="#111c33" stroke="#1e293b" />
        <text x="220" y="120" fontSize="104" fontWeight="800" textAnchor="middle" fill="#f8fafc" letterSpacing="2">
          10:25
        </text>
        <text x="220" y="156" fontSize="22" fontWeight="600" textAnchor="middle" fill="#cbd5e1">
          10월 6일 화요일
        </text>
        <rect x="32" y="170" width="376" height="86" rx="12" fill="#1e293b" />
        <text x="52" y="204" fontSize="18" fill="#94a3b8">
          오늘
        </text>
        <text x="52" y="240" fontSize="32" fontWeight="800" fill="#f8fafc">
          ☀ 21°
        </text>
        <text x="232" y="204" fontSize="18" fill="#94a3b8">
          내일
        </text>
        <text x="232" y="240" fontSize="32" fontWeight="800" fill="#f8fafc">
          ⛅ 24°
        </text>
        <rect x="32" y="268" width="376" height="100" rx="12" fill="#1e293b" />
        <text x="52" y="298" fontSize="18" fill="#94a3b8">
          오늘 할 일
        </text>
        <text x="52" y="328" fontSize="20" fill="#e2e8f0">
          급식지도 12:30
        </text>
        <text x="52" y="354" fontSize="20" fill="#e2e8f0">
          점심 · 잡곡밥, 미역국
        </text>
        <rect x="32" y="384" width="376" height="62" rx="10" fill="#dc2626" />
        <text x="220" y="424" fontSize="24" fontWeight="800" textAnchor="middle" fill="#fff">
          다음 4교시 국어 · 301 · 55분 뒤
        </text>
        <text x="440" y="46" fontSize="26" fontWeight="800" fill="#f8fafc">
          오늘 시간표
        </text>
        {row(64, "1", "수학", "201")}
        {row(112, "2", "수학", "202")}
        {row(160, "3", "과학", "과학실", true)}
        {row(208, "4", "국어", "301")}
        {row(256, "5", "국어", "301")}
        {row(304, "6", "지도", "자습")}
        {row(352, "7", "동아리", "도서관")}
        <text x="788" y="466" fontSize="15" textAnchor="end" fill="#475569">
          샘플 자료 · 가짜 이름
        </text>
      </svg>
      <figcaption className="mt-2 text-center text-sm text-muted">시계 화면 예시 (샘플 자료)</figcaption>
    </figure>
  );
}
