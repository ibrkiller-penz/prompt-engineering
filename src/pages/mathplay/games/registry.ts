// 게임 목록. 게임 화면은 games/<id>.tsx (기본 내보내기 컴포넌트)에 있다.
export type Floor = "play" | "future" | "classic" | "world";

/** 층별 분위기: 놀이 마당(몸으로 놀듯), 미래 연구소(세상에 쓰이는 수학), 수학 박물관(도형·함수·옛 수학) */
export const FLOORS: { key: Floor; label: string; name: string; emoji: string; desc: string; zone: string; grad: [string, string] }[] = [
  { key: "play", label: "1층", name: "놀이 마당", emoji: "🎈", desc: "누르고 끌며 놀듯이", zone: "#e8552f", grad: ["#ff9a5a", "#ff5e7e"] },
  { key: "future", label: "2층", name: "미래 연구소", emoji: "🚀", desc: "세상을 움직이는 수학", zone: "#2563eb", grad: ["#4fc3ff", "#6a5cff"] },
  { key: "classic", label: "3층", name: "수학 박물관", emoji: "🏛️", desc: "도형·수·옛 수학 이야기", zone: "#7c3aed", grad: ["#b78cff", "#ff6fb5"] },
  { key: "world", label: "4층", name: "세계 놀이터", emoji: "🌍", desc: "전 세계 아이들이 하는 수학 놀이", zone: "#0d9488", grad: ["#34d399", "#3b82f6"] },
];

/** 게임 썸네일: 큰 그림 문자와 배경 그라데이션 */
export const ART: Record<string, { e: string; e2?: string; c: [string, string] }> = {
  bridges: { e: "🌉", e2: "🚶", c: ["#7dd3fc", "#0ea5e9"] },
  mapcolor: { e: "🗺️", e2: "🖍️", c: ["#6ee7b7", "#10b981"] },
  fibstairs: { e: "🪜", e2: "🐰", c: ["#fde047", "#f59e0b"] },
  binaryclock: { e: "💡", e2: "✨", c: ["#c4b5fd", "#7c3aed"] },
  wheel: { e: "🛞", e2: "💨", c: ["#fdba74", "#f97316"] },
  doorangle: { e: "🚪", e2: "📐", c: ["#f9a8d4", "#ec4899"] },
  lever: { e: "⚖️", e2: "🐘", c: ["#93c5fd", "#3b82f6"] },
  timeguess: { e: "⏱️", e2: "🙈", c: ["#fca5a5", "#ef4444"] },
  inside: { e: "🐾", e2: "🔍", c: ["#5eead4", "#14b8a6"] },
  mirror: { e: "🪞", e2: "🧸", c: ["#d8b4fe", "#a855f7"] },
  pizza: { e: "🍕", e2: "😋", c: ["#fed7aa", "#fb923c"] },
  epidemic: { e: "💉", e2: "🦠", c: ["#bbf7d0", "#22c55e"] },
  fishery: { e: "🐟", e2: "🎣", c: ["#7dd3fc", "#0284c7"] },
  hash: { e: "🔐", e2: "🧩", c: ["#64748b", "#1e293b"] },
  rsa: { e: "🗝️", e2: "✉️", c: ["#94a3b8", "#334155"] },
  regression: { e: "📈", e2: "🌡️", c: ["#6ee7b7", "#047857"] },
  cycloid: { e: "🎡", e2: "✏️", c: ["#fda4af", "#f43f5e"] },
  parabolamul: { e: "✖️", e2: "🏹", c: ["#a5b4fc", "#4f46e5"] },
  monty: { e: "🎁", e2: "🚪", c: ["#fde68a", "#f59e0b"] },
  galton: { e: "🎱", e2: "⬇️", c: ["#c4b5fd", "#8b5cf6"] },
  goldbach: { e: "🎈", e2: "➕", c: ["#fecaca", "#ef4444"] },
  slope: { e: "🎢", e2: "📍", c: ["#93c5fd", "#1d4ed8"] },
  lissajous: { e: "🌀", e2: "🎵", c: ["#f0abfc", "#a21caf"] },
  chaos: { e: "🦋", e2: "🌪️", c: ["#67e8f9", "#0e7490"] },
  brachisto: { e: "🛝", e2: "🏁", c: ["#fde68a", "#ea580c"] },
  archpi: { e: "🥧", e2: "⭕", c: ["#fed7aa", "#c2410c"] },
  sliderule: { e: "📏", e2: "✖️", c: ["#d9f99d", "#4d7c0f"] },
  factortree: { e: "🌳", e2: "🍏", c: ["#bbf7d0", "#15803d"] },
  conic: { e: "🪐", e2: "🔦", c: ["#c7d2fe", "#4338ca"] },
  pascal: { e: "🔺", e2: "🎈", c: ["#fecdd3", "#e11d48"] },
  hanoi: { e: "🗼", e2: "🔵", c: ["#a5f3fc", "#0891b2"] },
  gotit: { e: "🎯", e2: "🥇", c: ["#fde68a", "#f97316"] },
  nim: { e: "🪨", e2: "🤖", c: ["#d6d3d1", "#57534e"] },
  lightsout: { e: "💡", e2: "🌙", c: ["#312e81", "#1e1b4b"] },
  sliding: { e: "🧩", e2: "🔢", c: ["#fbcfe8", "#db2777"] },
  jugs: { e: "🫗", e2: "💧", c: ["#bae6fd", "#0284c7"] },
  hundred: { e: "💯", e2: "🧩", c: ["#ddd6fe", "#6d28d9"] },
  geoboard: { e: "📐", e2: "🟡", c: ["#fef08a", "#ca8a04"] },
  matchtime: { e: "⏰", e2: "🕒", c: ["#fecaca", "#dc2626"] },
  timestable: { e: "✖️", e2: "🧮", c: ["#bbf7d0", "#16a34a"] },
  calendar: { e: "📅", e2: "🧩", c: ["#bfdbfe", "#2563eb"] },
  tetromino: { e: "🧱", e2: "🟪", c: ["#fecaca", "#dc2626"] },
  colorsquare: { e: "🎨", e2: "🌈", c: ["#fde68a", "#ec4899"] },
};
export const floorInfo = (k: Floor) => FLOORS.find((f) => f.key === k)!;

export type GameDef = {
  id: string;
  floor: Floor;
  title: string;
  blurb: string;
  how: string;
  think: string[];
  /** elem=초등 3~6학년, upper=중·고 도전 */
  level: "elem" | "upper";
  /** 영감을 받은 해외 사이트(우리가 새로 만든 놀이이고, 원조가 있는 곳을 소개한다) */
  credit?: { site: string; country: string; what: string; href: string };
};

export const GAMES: GameDef[] = [
  // ───── 1층 놀이 마당 ─────
  { id: "bridges", floor: "play", title: "다리 건너기", blurb: "모든 다리를 딱 한 번씩만 건너 보세요. 할 수 있을까요?", how: "출발할 땅을 눌러요. 그다음 반짝이는 땅을 누르면 ‘나’가 다리를 건너가요. 다리를 직접 눌러도 돼요. 다리는 한 번씩만 건널 수 있어요.", think: ["섬마다 이어진 다리가 몇 개인지 세어 보세요. 힌트가 숨어 있어요.", "다리를 하나 없애면 풀릴까요? 해 봐요."], level: "elem" },
  { id: "mapcolor", floor: "play", title: "지도 색칠하기", blurb: "옆에 붙은 나라는 다른 색으로! 색을 몇 가지만 써서 칠할 수 있을까요?", how: "나라를 톡 누를 때마다 색이 바뀌어요. 물감을 고르면 손가락으로 쓱쓱 문질러 칠할 수 있어요. 이웃한 나라가 같은 색이면 빨간 테두리가 떠요.", think: ["3가지 색으로 안 되는 지도도 있어요. 왜 안 될까요?", "어떤 지도든 4가지 색이면 충분하대요."], level: "elem" },
  { id: "fibstairs", floor: "play", title: "피보나치 계단 오르기", blurb: "한 칸 또는 두 칸씩 계단을 올라가요. 올라가는 방법은 모두 몇 가지일까요?", how: "깜빡이는 계단을 직접 눌러서 올라가요. 파랑은 한 칸, 주황은 두 칸이에요.", think: ["계단이 1, 2, 3, 4, 5칸일 때 방법이 몇 가지인지 써 보세요. 어떤 규칙이 보여요?", "앞의 두 수를 더하면 다음 수가 돼요."], level: "elem" },
  { id: "binaryclock", floor: "play", title: "이진법 시계", blurb: "불을 켜고 꺼서 수를 만들어요.", how: "풍선에 적힌 수가 되도록 불을 톡 누르거나 쓱 문질러요. 맞히면 바로 다음 풍선이 떠요.", think: ["불이 5개일 때 만들 수 있는 가장 큰 수는 얼마일까요?", "내 나이를 불로 만들어 봐요."], level: "elem" },
  { id: "wheel", floor: "play", title: "다각형 바퀴 굴리기", blurb: "네모 바퀴도 굴러갈까요? 바퀴 모양을 바꿔 굴려 봐요.", how: "바퀴를 손가락으로 좌우로 쓱 밀어 봐요. 바퀴 모양은 그림 단추로 바꿔요. ‘물결 길’을 고르면 네모 바퀴도 매끄럽게 굴러가요.", think: ["변이 많은 바퀴일수록 덜 덜컹거려요. 왜 그럴까요?", "네모 바퀴가 부드럽게 달리는 길은 어떤 모양일까요?"], level: "elem" },
  { id: "doorangle", floor: "play", title: "문 각도 맞히기", blurb: "문을 열어 목표 각도에 맞춰 봐요.", how: "문을 끌어서 열고 손을 떼면 점수가 나와요. 각도기의 초록 점까지 열어 봐요.", think: ["문을 직각(90°)으로 열면 어떤 모양이 될까요?", "문을 180° 열면 벽과 어떻게 될까요?"], level: "elem" },
  { id: "lever", floor: "play", title: "수평 맞추기", blurb: "무게가 달라도 수평을 맞출 수 있어요. 어디에 놓을까요?", how: "아래 선반의 추를 끌어서 막대 칸에 놓아요. 놓은 추는 끌어서 옮기거나 막대 밖으로 빼요. 수평이 되면 성공! ❓ 동물은 수평을 만든 뒤 몇 kg인지 맞혀요.", think: ["무거운 추는 가운데 가깝게, 가벼운 추는 멀리 놓으면 균형이 맞아요. 시소와 비슷해요. 왜일까요?", "친구와 시소를 탈 때 어디에 앉으면 좋을까요?"], level: "elem" },
  { id: "timeguess", floor: "play", title: "시간 맞히기", blurb: "목표 시간을 마음속으로 세어 봐요. 얼마나 정확할까요?", how: "동그란 단추를 눌러 시작하고, 목표 시간이 됐다고 느끼면 다시 눌러요. 레벨이 오르면 시간이 길어지고 숫자가 숨어요.", think: ["여러 번 하면 내가 빠른 편인지 느린 편인지 알 수 있어요.", "친구와 겨뤄 봐요."], level: "elem" },
  { id: "inside", floor: "play", title: "안일까 바깥일까", blurb: "울타리 안에 양이 있을까요, 밖에 있을까요?", how: "양이 울타리 안인지 밖인지 골라요. 강아지가 양에서 오른쪽으로 걸으며 울타리를 몇 번 넘는지 보여 줘요.", think: ["점에서 옆으로 쭉 가면서 선을 건너는 횟수를 세어 봐요. 홀수번 건너면 안이에요.", "복잡한 선도 같은 방법으로 알 수 있어요."], level: "elem" },
  { id: "mirror", floor: "play", title: "거울 속 세계", blurb: "거울을 돌려 물건이 몇 개로 보이는지 맞춰 봐요.", how: "보석 손잡이를 끌어 거울을 돌리고, 곰도 끌어 움직여 봐요. 보이는 곰 수를 목표에 맞춰요.", think: ["거울이 가까워질수록 물건이 더 많이 보여요. 왜일까요?", "거울이 직각(90°)이면 모두 몇 개로 보일까요?"], level: "elem" },
  { id: "pizza", floor: "play", title: "피자 조각 나누기", blurb: "피자를 똑같이 나누고 먹을 만큼 골라요.", how: "조각 수를 −/+로 고르고, 조각을 눌러 냠냠 먹어요(다시 누르면 되돌아와요). 목표 분수만큼 먹어 봐요. 분수 막대로 길이를 비교해 봐요.", think: ["2조각 중 1조각과 4조각 중 2조각은 같은 양일까요?", "3/4과 5/8 중 어느 쪽이 더 클까요?"], level: "elem" },

  // ───── 2층 미래 연구소 ─────
  { id: "hash", floor: "future", title: "해시 실험실", blurb: "글자 하나만 바꿔도 지문이 완전히 달라져요. 블록을 이어 봐요.", how: "글을 쓰면 해시 값(지문)이 나와요. 블록 체인에서 앞 블록을 고치면 뒤 블록이 어떻게 되는지 보세요.", think: ["왜 한 글자만 바꿔도 해시 전체가 달라질까요?", "블록체인에서 옛 기록을 몰래 고치기 어려운 까닭은 무엇일까요?"], level: "upper" },
  { id: "rsa", floor: "future", title: "RSA 암호 체험", blurb: "작은 소수로 열쇠를 만들어 글을 잠그고 풀어 봐요.", how: "소수 두 개를 고르면 공개 열쇠와 비밀 열쇠가 만들어져요. 글을 쓰면 잠그고, 비밀 열쇠로 풀어요.", think: ["공개 열쇠를 알아도 비밀 열쇠를 알기 어려운 까닭은 무엇일까요?", "소수가 아주 크면 어떤 일이 달라질까요?"], level: "upper" },
  { id: "epidemic", floor: "future", title: "감염병 막기", blurb: "아픈 친구가 퍼지는 걸 막으려면 어떻게 할까요?", how: "손가락으로 칸을 쓸어서 백신을 놓고(다시 쓸면 지워져요) ‘퍼져라!’를 눌러요.", think: ["백신을 맞은 친구가 많으면 어떻게 될까요?", "친구들이 서로 가까이 지내지 않으면 어떻게 될까요?"], level: "elem" },
  { id: "fishery", floor: "future", title: "어획량 정하기", blurb: "바다의 물고기를 오래오래 잡으려면 해마다 몇 마리를 잡아야 할까요?", how: "그물을 위아래로 끌어 올해 잡을 물고기 수를 정하고, ‘한 해 지나기’를 눌러요.", think: ["너무 많이 잡으면 왜 다음 해에 물고기가 줄어들까요?", "오래 잡으려면 어떻게 하면 좋을까요?"], level: "elem" },
  { id: "regression", floor: "future", title: "추세선 긋기", blurb: "점들 사이로 가장 잘 맞는 선을 그어 앞날을 예측해요.", how: "선의 양 끝 손잡이를 끌어서 점들에 맞춰 보세요. 오차가 작을수록 잘 맞는 거예요.", think: ["선이 잘 맞으면 앞으로의 값도 예측할 수 있을까요?", "예측이 틀릴 수 있는 까닭은 무엇일까요? (예시 자료는 가상이에요)"], level: "upper" },

  // ───── 3층 수학 박물관 ─────
  { id: "cycloid", floor: "classic", title: "굴러가는 원", blurb: "바퀴가 굴러갈 때 바퀴 위의 점은 어떤 길을 그릴까요?", how: "바퀴를 옆으로 끌어 굴려 보세요. 목표만큼 굴리면 문제가 나와요.", think: ["바퀴가 한 바퀴 돌면 바퀴 둘레만큼 앞으로 가요.", "점을 바퀴 안쪽에 놓으면 길 모양이 어떻게 달라져요?"], level: "elem" },
  { id: "parabolamul", floor: "classic", title: "포물선으로 곱셈", blurb: "포물선과 직선만으로 곱셈을 해요.", how: "두 수 a, b를 정하면 포물선 위 두 점을 잇는 선이 세로축과 만나는 곳이 곱 a×b예요.", think: ["왜 두 점을 이은 선이 세로축에서 a×b를 가리킬까요?", "곱이 음수가 되는 경우도 해 봐요."], level: "upper" },
  { id: "monty", floor: "classic", title: "문 세 개 게임", blurb: "문 세 개 중 상품이 있는 문을 찾아요. 문을 바꾸는 게 좋을까요?", how: "문을 하나 눌러요. 빈 문이 열리면 내 문을 다시 누르면 ‘그대로’, 다른 닫힌 문을 누르면 ‘바꾸기’예요.", think: ["바꿀 때와 안 바꿀 때, 어느 쪽이 더 많이 이겼어요?", "100번쯤 해 보고 세어 봐요."], level: "elem" },
  { id: "galton", floor: "classic", title: "구슬 떨어뜨리기", blurb: "구슬은 못에 부딪히며 어디로 떨어질까요?", how: "위쪽을 누르면 구슬이 떨어져요(꾹 누르면 계속). 구슬이 어디에 가장 많이 쌓일지 같은 문제를 맞혀요.", think: ["가운데에 구슬이 더 많이 쌓여요. 왜일까요?", "구슬을 많이 떨어뜨리면 어떤 모양이 돼요?"], level: "elem" },
  { id: "goldbach", floor: "classic", title: "골드바흐 짝 찾기", blurb: "짝수는 소수 두 개를 더해서 만들 수 있을까요?", how: "풍선에 짝수가 떠 있어요. 아래 소수 칩 두 개를 눌러서 더하면 풍선이 팡 터져요.", think: ["소수는 1과 자기 자신으로만 나누어지는 수예요(2, 3, 5, 7, 11…).", "안 되는 짝수를 찾을 수 있을까요? 아직 아무도 못 찾았어요."], level: "elem" },
  { id: "slope", floor: "classic", title: "접선 기울기 탐험", blurb: "곡선 위를 움직이면 기울기가 어떻게 변할까요?", how: "곡선 위의 점을 끌어 보세요. 그 점의 접선과 기울기, 기울기 그래프가 함께 움직여요.", think: ["기울기가 0이 되는 곳은 어디예요?", "기울기 그래프는 원래 곡선과 어떤 관계예요?"], level: "upper" },
  { id: "lissajous", floor: "classic", title: "진동이 그리는 그림", blurb: "두 진동을 합치면 아름다운 그림이 나와요.", how: "가로·세로 진동의 빠르기와 어긋남을 바꿔 보세요.", think: ["빠르기의 비가 같은 간단한 비일 때 그림이 닫혀요. 왜 그럴까요?", "빠르기 비를 3:2로 해 보세요."], level: "upper" },
  { id: "chaos", floor: "classic", title: "작은 차이, 큰 결과", blurb: "시작값이 아주 조금 달라도 결과가 크게 달라질 수 있어요.", how: "두 개의 시작값을 아주 조금 다르게 놓고 ‘다음 해’를 눌러 보세요.", think: ["처음에는 비슷하다가 언제부터 달라지나요?", "날씨 예측이 어려운 까닭과 어떤 관계가 있을까요?"], level: "upper" },
  { id: "brachisto", floor: "classic", title: "가장 빠른 길 경주", blurb: "같은 높이에서 출발한 구슬, 어느 길이 가장 빠를까요?", how: "질문(1등은? 두 번째는? 꼴찌는?)에 맞는 공 친구를 톡 누르면 경주가 시작돼요.", think: ["가장 짧은 길(곧은 길)이 가장 빠를까요?", "굽은 길은 어떤 점이 좋을까요?"], level: "elem" },
  { id: "archpi", floor: "classic", title: "원주율 어림하기", blurb: "원 안팎의 도형으로 원의 둘레를 재 봐요.", how: "반짝이는 별 손잡이를 고리를 따라 끌어서 도형의 변을 늘려 봐요.", think: ["변이 많아지면 두 도형이 원과 더 닮아져요.", "원둘레를 지름으로 나누면 3.14쯤이에요."], level: "elem" },
  { id: "sliderule", floor: "classic", title: "로그 자로 곱셈", blurb: "길이를 더하면 곱셈이 돼요. 로그 자를 밀어 봐요.", how: "자를 끌어서 두 수의 곱을 읽어요. 직접 계산한 값과 비교해 보세요.", think: ["길이를 더하는데 왜 곱셈이 될까요?", "큰 수의 곱셈이 로그 덕분에 왜 쉬워질까요?"], level: "upper" },
  { id: "factortree", floor: "classic", title: "수 쪼개기", blurb: "수를 곱셈으로 계속 쪼개 봐요.", how: "풍선을 누르면 곱셈 칩이 떠요. 칩을 누르면 풍선이 둘로 쪼개져요. 더 못 쪼개는 수는 초록 열매가 돼요.", think: ["어떤 순서로 쪼개도 마지막 수들은 같을까요?", "더 못 쪼개는 수는 어떤 수예요?"], level: "elem" },
  { id: "conic", floor: "classic", title: "이차곡선 그리기", blurb: "한 점과 한 직선에서 거리의 비로 타원·포물선·쌍곡선을 그려요.", how: "비(이심률)를 바꾸면 곡선이 타원에서 포물선, 쌍곡선으로 바뀌어요.", think: ["비가 1일 때 어떤 곡선이 돼요?", "비가 0에 가까워지면 곡선은 무엇을 닮아요?"], level: "upper" },
  { id: "pascal", floor: "classic", title: "파스칼 삼각형", blurb: "위의 두 수를 더하면 아래 수가 돼요. 숫자 삼각형 속 규칙을 찾아봐요.", how: "풍선을 ‘?’ 칸으로 끌어다 놓거나 톡 눌러요. 위의 두 수를 더하면 돼요.", think: ["각 줄의 수를 모두 더하면 어떤 규칙이 있어요?", "홀수만 색칠하면 어떤 무늬가 나와요?"], level: "elem" },
  // ───── 조각 맞추기 퍼즐(1층 놀이 마당) ─────
  { id: "calendar", floor: "play", title: "펜토미노 달력", blurb: "오늘 날짜만 남기고 달력을 조각으로 덮어요.", how: "조각을 끌어다 달력 위에 놓아요. 끄는 중에 오른쪽 단추(또는 R)로 돌리고 F로 뒤집어요. 고른 조각을 한 번 더 누르면 돌아가요. 레벨이 오를 때마다 다음 날짜가 나와요.", think: ["덮어야 하는 칸은 47칸이에요. 5칸짜리 조각 7개와 4칸짜리 조각 3개를 합치면 딱 47칸이에요. 계산해 볼까요?", "어떤 날짜를 골라도 풀 수 있어요. 컴퓨터로 모두 확인했어요.", "같은 날짜를 다르게 풀 수 있을까요? 친구와 비교해 봐요."], level: "elem" },
  { id: "tetromino", floor: "play", title: "테트로미노 퍼즐", blurb: "네모 4개를 붙인 조각 5가지로 빈틈없이 채워요.", how: "조각을 끌어다 흰 칸에 놓아요. 끄는 중에 오른쪽 단추(또는 R)로 돌리고 F로 뒤집어요. ‘새 문제’를 누르면 다른 모양이 나와요.", think: ["네모 4개로 만든 모양은 5가지뿐이에요. 종이에 직접 그려 볼까요?", "지그재그 모양과 L 모양은 뒤집으면 방향이 달라져요.", "다르게 채울 수 있는 문제를 찾아봐요."], level: "elem" },
  { id: "colorsquare", floor: "play", title: "색동 마방진", blurb: "가로줄, 세로줄, 대각선에 같은 색이 겹치지 않게 칠해요.", how: "빈칸을 누를 때마다 색이 바뀌어요(색 칩을 고르면 그 색으로 칠해요). 가로·세로·대각선 한 줄에 같은 색이 두 번 나오면 빨간 테두리가 생겨요. 레벨 6부터는 5×5 판이에요.", think: ["4×4 판에서 한 줄에 4가지 색이 모두 있어야 해요. 각 색은 모두 몇 개 필요할까요?", "처음 놓인 칩을 잘 보면 다음 칩을 알 수 있어요.", "옛날 조선의 수학자 최석정 할아버지도 이런 색(숫자) 퍼즐을 연구했다고 알려져 있어요."], level: "elem" },
  // ───── 4층 세계 놀이터(해외 사이트의 놀이에서 영감을 받아 새로 만듦) ─────
  { id: "hanoi", floor: "world", title: "하노이의 탑", blurb: "큰 원반 위에 작은 원반만! 원반을 다른 기둥으로 옮겨요.", how: "원반을 끌어서(또는 기둥을 눌러서) 다른 기둥으로 옮겨요. 큰 원반을 작은 원반 위에 올릴 수는 없어요.", think: ["원반이 3개면 가장 적게 몇 번 옮길까요? 4개, 5개일 때도 세어 보세요.", "원반이 하나 늘 때마다 필요한 횟수가 어떻게 변해요? (힌트: 2배 + 1)"], level: "elem", credit: { site: "Math Playground · Cut-the-Knot", country: "미국", what: "하노이의 탑", href: "https://www.mathplayground.com/math-games.html" } },
  { id: "gotit", floor: "world", title: "Got It! 먼저 만들기", blurb: "번갈아 수를 더해서 목표 수를 먼저 만들면 이겨요.", how: "1~4 중 하나를 골라 번갈아 더해요. 목표 수를 딱 만드는 쪽이 이겨요.", think: ["늘 이기는 방법이 숨어 있어요. 목표에서 거꾸로 생각해 보세요.", "목표가 23이고 1~4를 더할 때, 어떤 수를 만들면 항상 이길 수 있을까요?"], level: "elem", credit: { site: "NRICH", country: "영국", what: "Got It!", href: "https://nrich.maths.org/" } },
  { id: "nim", floor: "world", title: "님 게임", blurb: "돌을 가져가요. 마지막 돌을 가져가는 사람이 이겨요.", how: "한 더미를 골라 돌을 하나 이상 가져가요. 컴퓨터와 번갈아 하며, 마지막 돌을 가져가면 이겨요.", think: ["어떤 모양이 되면 내가 이길 수 있을까요? 여러 번 해 보며 규칙을 찾아봐요.", "돌 더미가 둘이고 개수가 같을 때, 먼저 하는 사람과 나중에 하는 사람 중 누가 유리할까요?"], level: "elem", credit: { site: "Cut-the-Knot", country: "미국", what: "Nim", href: "https://www.cut-the-knot.org/gamesList.shtml" } },
  { id: "lightsout", floor: "world", title: "불 끄기 퍼즐", blurb: "누르면 주변 불도 같이 바뀌어요. 모든 불을 꺼요.", how: "불을 누르면 그 불과 위·아래·양옆의 불이 켜졌다 꺼졌다 해요. 모든 불을 꺼 보세요.", think: ["같은 불을 두 번 누르면 어떻게 될까요?", "누르는 순서는 상관이 있을까요?"], level: "elem", credit: { site: "GeoGebra", country: "오스트리아·국제", what: "Lights Out", href: "https://www.geogebra.org/" } },
  { id: "sliding", floor: "world", title: "숫자 밀기 퍼즐", blurb: "빈칸으로 숫자를 밀어서 1, 2, 3… 순서로 맞춰요.", how: "빈칸 옆의 숫자 칸을 눌러(또는 밀어서) 옮겨요. 숫자를 순서대로 맞추면 성공!", think: ["빈칸을 어떻게 움직이면 한 칸만 바꿀 수 있을까요?", "섞인 모양이 모두 풀릴 수 있는 것은 아니에요. 컴퓨터가 풀 수 있는 것만 섞어 줬어요."], level: "elem", credit: { site: "Cut-the-Knot", country: "미국", what: "Sliders", href: "https://www.cut-the-knot.org/gamesList.shtml" } },
  { id: "jugs", floor: "world", title: "물통 퍼즐", blurb: "크기가 다른 물통으로 딱 맞는 물의 양을 만들어요.", how: "물통을 눌러 가득 채우고, 비우고, 다른 물통으로 옮겨요. 목표 양을 한 통에 만들어요.", think: ["3L와 5L 물통으로 4L를 만들 수 있을까요?", "물통 크기가 어떤 수일 때 만들 수 있는 양이 달라질까요?"], level: "elem", credit: { site: "세계의 옛 퍼즐", country: "프랑스 등", what: "물 붓기 퍼즐", href: "https://www.cut-the-knot.org/gamesList.shtml" } },
  { id: "hundred", floor: "world", title: "100칸 퍼즐", blurb: "100칸 표에서 찢어진 조각이 들어갈 자리를 찾아요.", how: "아래 선반의 조각을 끌어서 100칸 표의 찢어진 자리에 놓아요. 오른쪽 칸은 +1, 아래 칸은 +10! 조각에 보이는 수로 자리를 찾아요.", think: ["오른쪽 칸은 1 커지고, 아래 칸은 10 커져요. 위쪽 칸은 어떨까요?", "조각에 보이는 수 하나만으로도 자리를 찾을 수 있을까요?"], level: "elem", credit: { site: "NRICH", country: "영국", what: "100 Square Jigsaw", href: "https://nrich.maths.org/" } },
  { id: "geoboard", floor: "world", title: "고무줄 판", blurb: "못을 이어 도형을 만들고 넓이를 맞혀요.", how: "못을 차례로 눌러 고무줄을 걸고, 처음 못으로 돌아오면 도형이 완성돼요. 목표 넓이가 되게 만들어 봐요.", think: ["넓이를 어떻게 셀 수 있을까요? 네모 칸이 몇 개 들어가는지 세어 봐요.", "같은 넓이인데 모양이 다른 도형을 만들 수 있을까요?"], level: "elem", credit: { site: "NRICH", country: "영국", what: "Virtual Geoboard", href: "https://nrich.maths.org/" } },
  { id: "matchtime", floor: "world", title: "시계 맞추기", blurb: "시곗바늘과 디지털 시각을 짝 지어요.", how: "시곗바늘(주황=시, 파랑=분)을 끌어 돌려 시각에 맞추거나, 시계를 읽고 맞는 시각 카드를 눌러요. 놓으면 바로 알려 줘요.", think: ["짧은바늘과 긴바늘 중 어느 쪽이 시이고 어느 쪽이 분일까요?", "긴바늘이 3을 가리키면 몇 분일까요?"], level: "elem", credit: { site: "NRICH", country: "영국", what: "Matching Time", href: "https://nrich.maths.org/" } },
  { id: "timestable", floor: "world", title: "구구단 곱셈표 퍼즐", blurb: "곱셈표의 빈칸에 알맞은 수를 끌어다 채워요.", how: "수 조각을 곱셈표의 빈칸으로 끌어다 놓아요. 가로 수와 세로 수를 곱한 값이 들어가요.", think: ["곱셈표는 대각선을 기준으로 똑같은 모양이에요. 왜 그럴까요?", "3단과 6단을 비교해 보면 어떤 규칙이 보여요?"], level: "elem", credit: { site: "NRICH", country: "영국", what: "Tables Teaser", href: "https://nrich.maths.org/" } },
];

export const gameById = (id: string) => GAMES.find((g) => g.id === id);
