// 사이트 이름·꼭지 목록. 새 교육자료를 더할 때는 SECTIONS에 한 줄을 추가하고 라우트를 연결한다.
export const HUB_NAME = "살빠진 임선생과 함께하는 교육자료";
export const COURSE_NAME = "다시 묻는 AI 교실";

export const SECTIONS: { path: string; title: string; tag: string; desc: string; external?: boolean; cta?: string; featured?: boolean; more?: string; credit?: string }[] = [
  {
    path: "/setup",
    featured: true,
    title: "AI 맞춤 설정",
    tag: "먼저 해 두면 좋아요",
    desc: "ChatGPT·Claude·Gemini에 한 번 넣어 두는 설정 글이에요. 모델을 난이도에 맞게 고르게 해서 토큰을 아껴요.",
    cta: "설정 복사하러 가기 →",
    credit: "자료 · uniquelfie 선생님",
  },
  {
    path: "/prompt",
    title: COURSE_NAME,
    tag: "프롬프트 엔지니어링",
    desc: "AI의 첫 결과물은 끝이 아니라 출발점. 부탁하고, 확인하고, 바로잡는 연습을 하는 초·중·고 13차시.",
    credit: "자료 · uniquelfie 선생님",
    more: "AI의 첫 결과물은 끝이 아니라 출발점. 부탁하기 → 되말하기 확인 → 점검·검증 → 선택 기록 → 마무리를 직접 연습하는 초·중·고 13차시.",
  },
  {
    path: "https://happystamp.web.app/",
    external: true,
    title: "해피스탬프",
    tag: "도장 도안 만들기",
    desc: "칭찬 도장·이름 도장의 도안을 만들어 실제 크기로 인쇄해요. 시판 스탬프 110여 종을 골라요.",
    more: "칭찬 도장·이름 도장의 도안을 만들어 실제 크기로 인쇄해요. 시판 스탬프 110여 종 중에서 크기를 고르고, 그림을 넣으면 흑백 도안으로 바꿔 주고, 둥근 글자를 둘러 넣을 수 있어요. 여러 개를 A4 인쇄 목록에 모아 한 번에 출력해요.",
    cta: "도안 만들러 가기 ↗",
  },
  {
    path: "https://norae-studio.web.app/",
    external: true,
    title: "노래공방",
    tag: "AI 작곡 프로그램",
    desc: "가사와 분위기를 적으면 노래가 든 음원을 만들어 주는 윈도우 프로그램이에요. 사용료가 없어요.",
    more: "가사와 분위기를 적으면 반주와 노래가 함께 든 음원을 만들어 주는 윈도우 프로그램이에요(수노 같은 AI 작곡). 내 컴퓨터의 그래픽카드로 만들어서 곡이 인터넷으로 나가지 않고 사용료도 없어요. 연주곡, 커버·편곡, 참고곡 분석도 돼요. NVIDIA RTX 30 시리즈 이상, 그래픽 메모리 8GB가 필요해요.",
    cta: "프로그램 받으러 가기 ↗",
  },
  {
    path: "/slides",
    title: "노트북LM 슬라이드 프롬프트",
    tag: "슬라이드·인포그래픽 만들기",
    desc: "노트북LM으로 슬라이드·인포그래픽을 만드는 프롬프트예요. 디자인을 고르면 프롬프트가 채워져요.",
    more: "노트북LM으로 슬라이드와 인포그래픽을 만드는 프롬프트 모음이에요. 디자인을 고르면 디자인 지침, 슬라이드 대본, 인포그래픽 대본, 완성 프롬프트가 그 디자인으로 채워져요. 단계마다 복사 버튼이 있어서 붙여 넣기만 하면 돼요.",
    cta: "디자인 고르러 가기 →",
  },
  {
    path: "/handgen/",
    external: true,
    title: "학습 사이트 만들기 레퍼런스 — 손발전기",
    tag: "같이 만들기 · 작업지시서",
    desc: "학습 사이트를 AI와 함께 만드는 방법을 안내해요. 편집해서 복사할 수 있는 작업지시서와 단계별 확인표가 있어요.",
    more: "학습 사이트를 AI와 함께 만드는 방법을 안내해요. 편집해서 복사할 수 있는 작업지시서, 내 주제 정하기, 단계별 확인표를 따라 해 보고, 본보기인 손발전기 사이트(4단계 만들기·교육과정 기초자료·실험·영상·퀴즈·학습지)로 이어져요.",
    cta: "안내 보기 →",
  },
];
