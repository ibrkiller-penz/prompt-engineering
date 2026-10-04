// 사이트 이름·꼭지 목록. 새 교육자료를 더할 때는 SECTIONS에 한 줄을 추가하고 라우트를 연결한다.
export const HUB_NAME = "살빠진 임선생과 함께하는 교육자료";
export const COURSE_NAME = "다시 묻는 AI 교실";

export const SECTIONS: { path: string; title: string; tag: string; desc: string; external?: boolean; cta?: string }[] = [
  {
    path: "/prompt",
    title: COURSE_NAME,
    tag: "프롬프트 엔지니어링",
    desc: "AI의 첫 결과물은 끝이 아니라 출발점. 부탁하기 → 되말하기 확인 → 점검·검증 → 선택 기록 → 마무리를 직접 연습하는 초·중·고 13차시.",
  },
  {
    path: "https://happystamp.web.app/",
    external: true,
    title: "해피스탬프",
    tag: "도장 도안 만들기",
    desc: "칭찬 도장·이름 도장의 도안을 만들어 실제 크기로 인쇄해요. 시판 스탬프 110여 종 중에서 크기를 고르고, 그림을 넣으면 흑백 도안으로 바꿔 주고, 둥근 글자를 둘러 넣을 수 있어요. 여러 개를 A4 인쇄 목록에 모아 한 번에 출력해요.",
    cta: "도안 만들러 가기 ↗",
  },
];
