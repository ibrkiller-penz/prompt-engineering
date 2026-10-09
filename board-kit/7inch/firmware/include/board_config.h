#pragma once
// ── 보드마다(사람마다) 바꾸는 값은 여기에만 둔다 ──
// 아래 값을 내 것으로 바꾸고 다시 빌드·업로드하면 내 보드가 된다. (README.md · CLAUDE.md 참고)
// 비워 둔 값("")은 '아직 설정 안 함'이다. 그 기능만 화면에 '설정 필요'로 보이고, 나머지는 정상 동작한다.

// 자기 Firebase 사이트의 보드 자료 주소(끝에 / 까지). 시간표 목록 index.json 과 t/NNN.json 이 여기 있다.
#define BOARD_BASE_URL "https://YOUR-SITE-ID.web.app/board/"   // ← 내 값으로 바꾸기 (YOUR-SITE-ID 를 내 Firebase 사이트 ID 로)

// 처음 켤 때 볼 시간표(목록 index.json 의 name 과 똑같이: 교사 이름, 또는 '1학년1반').
// 켠 뒤에는 설정 화면에서 바꾸고, 바꾼 값은 보드에 저장된다.
#define BOARD_DEFAULT_TT "국어A"   // ← 내 값으로 바꾸기 (샘플 자료의 첫 선생님)

// 위쪽 막대의 이름(시간표를 받기 전에 보인다)
#define BOARD_TITLE "교실"   // ← 내 값으로 바꾸기 (짧게, 한글 3~4자)

// 급식: 나이스 교육정보 개방 포털의 시도교육청 코드와 학교 코드. 둘 다 비워 두면 급식 칸에 '설정 필요'가 보인다.
//   찾기: board-kit 의 common/docs/02_학교코드와_위치_찾기.md  (https://open.neis.go.kr/hub/schoolInfo?Type=json&SCHUL_NM=학교이름)
#define NEIS_ATPT_CODE ""      // ← 내 값으로 바꾸기 (예: 시도교육청 코드 'B10' 같은 영문+숫자 3글자)
#define NEIS_SCHOOL_CODE ""    // ← 내 값으로 바꾸기 (예: 학교 코드 숫자 7자리)

// 수능 날짜: 시계 화면에 'D-n'을 보이고, 다음 날부터 숨긴다. 비워 두면(="") 아예 안 보인다. 형식 "YYYY-MM-DD"
#define SUNEUNG_DATE ""        // ← 내 값으로 바꾸기 (필요하면)

// 날씨·미세먼지: 학교 위치(위도, 경도) — Open-Meteo, 열쇠 없음. 둘 다 비워 두면 '위치 설정 필요'가 보인다.
#define WEATHER_LAT ""         // ← 내 값으로 바꾸기 (예: "37.5665")
#define WEATHER_LON ""         // ← 내 값으로 바꾸기 (예: "126.9780")
