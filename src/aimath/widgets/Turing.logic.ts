export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type QA = { q: string; human: string; machine: string; tell: string };

export const QA_POOL: QA[] = [
  { q: "좋아하는 음식이 뭐야?", human: "음... 요즘은 떡볶이에 꽂혔어ㅋㅋ 매운 거 먹고 나면 아이스크림 필수!", machine: "저는 음식을 먹을 수 없지만, 사람들이 좋아하는 음식은 피자, 치킨, 떡볶이 등입니다.", tell: "질문에 직접 답하지 않고 '목록'을 내놓는 템플릿 문장이에요." },
  { q: "어제 뭐 했어?", human: "어제? 그냥 집에서 뒹굴다가 저녁에 친구랑 라면 끓여 먹었어. 별거 없었음.", machine: "어제는 다양한 활동을 했습니다. 구체적으로 어떤 활동이 궁금하신가요?", tell: "되묻기로 넘어가요. 규칙 기반 챗봇이 자주 쓰는 회피 패턴이에요." },
  { q: "농담 하나 해 줘!", human: "아 갑자기? ㅋㅋ 음… 세상에서 가장 뜨거운 바다는? 열받아!", machine: "농담 모드를 실행합니다. 웃음은 건강에 좋습니다. 다른 요청이 있으신가요?", tell: "농담 대신 '농담'이라는 키워드에 반응한 고정 문장이에요." },
  { q: "1+1은 뭐야?", human: "2지 ㅋㅋ 갑자기 왜 물어봐? 함정이야?", machine: "1+1의 계산 결과는 2입니다.", tell: "너무 정확하고 딱딱해요. 사람은 보통 반응을 덧붙여요." },
  { q: "슬플 때 어떻게 해?", human: "난 그냥 노래 크게 틀어놓고 한참 멍때려. 그러다 보면 좀 나아지더라.", machine: "슬플 때는 충분한 휴식, 규칙적인 운동, 전문가 상담을 권장합니다.", tell: "'권장합니다' 식의 안내문 말투예요. 자기 경험이 없어요." },
  { q: "오늘 날씨 어때?", human: "아침에 나갔는데 바람 완전 세더라. 우산은 안 챙겨도 될 듯?", machine: "날씨 정보를 확인할 수 없습니다. 기상청 웹사이트를 이용해 주세요.", tell: "모른다고 하고 다른 곳으로 안내해요. 정해 둔 예외 처리 문장이에요." },
  { q: "가장 무서웠던 기억은?", human: "초등학교 때 엘리베이터에 혼자 갇혔던 거… 지금 생각해도 소름 돋아.", machine: "무서움은 위험에 대한 자연스러운 감정 반응입니다. 무서운 기억이 있으신가요?", tell: "개인 경험 대신 '정의'를 말하고 질문을 돌려줘요." },
  { q: "주말에 뭐 하고 싶어?", human: "일단 늦잠 자고ㅎㅎ 오후엔 친구들이랑 영화 볼까 해. 너는?", machine: "주말에는 휴식, 취미 활동, 가족과의 시간을 추천합니다.", tell: "'추천합니다'로 끝나는 일반론이에요. 자기 계획이 없어요." },
  { q: "너 이름이 뭐야?", human: "민지야~ 너는 이름이 뭐야?", machine: "저의 이름은 챗봇입니다. 무엇을 도와드릴까요?", tell: "'무엇을 도와드릴까요?'는 전형적인 상담 챗봇 인사말이에요." },
  { q: "시험 망쳤을 때 기분이 어때?", human: "하… 진짜 멘붕이지. 하루종일 아무것도 하기 싫고 배는 또 고프고 ㅠㅠ", machine: "시험 결과가 좋지 않으면 부정적인 감정이 생길 수 있습니다. 다음에는 더 노력하세요.", tell: "감정을 설명만 하고 직접 느끼는 말투가 아니에요." },
  { q: "고양이랑 강아지 중에 뭐가 더 좋아?", human: "난 고양이! 근데 강아지도 귀엽긴 해… 아 고민되네 ㅋㅋ", machine: "고양이와 강아지는 모두 인기 있는 반려동물입니다. 선호는 사람마다 다릅니다.", tell: "고르지 않고 중립적인 설명만 해요. 규칙에 '선호' 답변이 없는 거예요." },
  { q: "'사과'라는 말 들으면 뭐가 생각나?", human: "빨간 거? 아니면 '미안해'의 사과… 둘 다 생각났어 ㅋㅋ", machine: "사과는 장미과의 과일입니다. 사과의 영양소는 비타민 C 등이 있습니다.", tell: "키워드 '사과'에 사전 정의를 붙여 답해요. 연상 대신 검색 결과 같아요." },
];

export type Round = { q: string; a: string; b: string; machineIs: "A" | "B"; tell: string };

function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildGame(seed: number, rounds = 8): Round[] {
  const rnd = mulberry32(seed * 7919 + 13);
  return shuffle(QA_POOL, rnd).slice(0, rounds).map((qa) => {
    const machineFirst = rnd() < 0.5;
    return {
      q: qa.q,
      a: machineFirst ? qa.machine : qa.human,
      b: machineFirst ? qa.human : qa.machine,
      machineIs: machineFirst ? "A" : "B",
      tell: qa.tell,
    };
  });
}

export function scoreGame(rounds: Round[], picks: ("A" | "B")[]): number {
  return rounds.reduce((s, r, i) => s + (picks[i] === r.machineIs ? 1 : 0), 0);
}
