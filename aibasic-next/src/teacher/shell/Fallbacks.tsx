// 교사 화면 공통 대체 화면: 불러오는 중 · 준비 중 · 찾는 화면 없음.
const NAMES: Record<string, string> = {
  flow: "수업 흐름",
  pick: "문제 고르기",
  prep: "준비 한 장",
  print: "학습지 인쇄",
  progress: "반별 진도",
  results: "손들기 결과",
  unitTest: "단원 평가",
  privacy: "저장 내용 안내",
  board: "칠판 수업",
  boardQ: "칠판 문제",
  boardTool: "칠판 체험 도구",
  boardEnd: "수업 끝",
};

export function Loading({ label }: { label?: string }) {
  return (
    <div className="t-loading" role="status" aria-live="polite">
      <span className="t-spinner" aria-hidden="true" />
      <span>{label || "불러오는 중이에요…"}</span>
    </div>
  );
}

export function Soon({ name }: { name: string }) {
  return (
    <section className="page">
      <div className="card empty">
        <h1 className="h2">{(NAMES[name] || "이 화면") + "은 준비 중이에요"}</h1>
        <p className="muted">곧 열려요. 지금은 오늘 수업에서 바로 칠판 수업을 시작할 수 있어요.</p>
        <p>
          <a className="btn btn-primary" href="#/">
            오늘 수업으로 가요
          </a>
        </p>
      </div>
    </section>
  );
}

export function NotFound() {
  return (
    <section className="page">
      <div className="card empty">
        <h1 className="h2">찾는 화면이 없어요</h1>
        <p className="muted">주소가 바뀌었거나 잘못 들어온 것 같아요.</p>
        <p>
          <a className="btn btn-primary" href="#/">
            오늘 수업으로 가요
          </a>
        </p>
      </div>
    </section>
  );
}
