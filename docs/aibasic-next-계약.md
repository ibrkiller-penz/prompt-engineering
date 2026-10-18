# aibasic-next 만들기 계약 (인공지능 기초 → 학생용 aibasics · 교사용 aibasict)

목표: `aimath-next/` 와 같은 구성(학생용 휴대폰 + 교사용 전자칠판, 한 코드 두 빌드)으로 `aibasic-next/` 를 만든다.
Firebase: 프로젝트 `ai-study-math`, 사이트 `aibasics`(학생, https://aibasics.web.app) · `aibasict`(교사, https://aibasict.web.app).
기존 `/aibasic/`(public/aibasic), `aimath-next/`, `src/aimath`, `content/aimath` 는 **고치지 않는다**.

## 원본 데이터
- `tools/aibasic/data/lessons/<id>.json` (26레슨), `tools/aibasic/data/qbank/<id>.json` (`{checks:[계단별 확인 문제[]], quiz:[...]}`).
- 레슨 id: 1-1-1, 1-1-2, 1-2-1, 1-2-2, 1-A, 2-1-1 … 2-1-5, 2-2-1 … 2-2-4, 2-A, 3-1-1, 3-1-2, 3-2-1 … 3-2-3, 3-A, 4-1-1, 4-1-2, 4-2, 4-3, 4-A. 단원 4개(1 인공지능의 이해, 2 기계학습과 딥러닝, 3 인공지능과 사회, 4 인공지능 프로젝트; 단원 이름은 원본 `public/aibasic/app.js` 에서 확인).
- 원본 Lesson 모양: `{id, unit, title, tagline, pages, goals[], story{title, paras[]}, steps[{level, title, body(HTML), keypoints[], check{type:'choice'|'ox', q, choices?, answer, explain}}], recap[], terms[{term, def}], quiz[...] }`. `body` 는 `<p> <b> <code> <table> <ul>/<ol> <pre class="code"><code> <div class="box tip|warn|ex|…">` 등 제한된 HTML.
- 등장인물: 지우, 도윤, 아라 쌤(AI랩). 인공지능 수학의 인물과 섞지 않는다.

## 변환 계약 (원본 → aimath 형식 확장)
변환 결과는 `content/aibasic/` 아래에 둔다(aimath 와 같은 폴더 모양):
```
content/aibasic/units.json                 UnitMeta[] (id, slug, roman, title, short, icon, color, soft, lessons[{id,title,short}])
content/aibasic/u1/unit.json … u4/         UnitContent (why, opening, test[], future) — 원본에 없으면 최소 내용으로 채우고 보강 대상으로 표시
content/aibasic/u1/lesson-<id>.json        Lesson (aimath types 확장)
```
레슨 id 는 `u<단원>-<원본id 의 - 를 _ 로>`(예: `u2-1-3` → `u2_1_3`). 안정적이어야 하며 저장 키로 쓴다. (aimath 는 `u2-1` 모양이므로 라우터·정규식이 `-` 를 쓰는 곳은 B 가 맞춘다.)
`src/aimath/types.ts` 와 호환되는 `aibasic-next/src/content/types.ts` 를 새로 둔다. 차이:
- `Block` 에 `{t:"code", code: string, lang?: "python"}` 추가(원본 `<pre class="code">`). 코드 설명 표는 `table` 블록.
- `Lesson.question`(핵심 질문)은 원본 `tagline` 을 질문으로 다듬어 쓴다. `prereq`, `aiStory`, `project` 는 선택(optional)로 바꾼다. `goals?: string[]`(학습 목표)와 `sections[].keypoints?: string[]` 추가.
- 원본 `steps[i]` 1개 = `sections[i]` 1개: `heading` = `${level} · ${title}`, `blocks` = `body` 를 변환한 블록들, 끝에 keypoints 는 `callout aha`(제목 '한 줄 정리'), `check` 는 그 섹션의 확인 문제로 `practice` 앞부분에 `group:'계단 확인 ' + level` 로 연결.
- 변환할 수 없는 HTML 은 버리지 말고 가장 가까운 블록(p/list/callout)으로 옮기고, 못 옮긴 것은 변환 보고서에 적는다.
- 글 서식은 aimath 규칙(`**굵게**`, `$수식$`, HTML 금지)을 따른다.
- 문제: `choice`(answer 0부터), `ox`(boolean). 문제 id = `레슨id-q번호`. 힌트 2개와 `solution`(= 원본 explain)을 채운다(힌트는 새로 쓰지 않고 `hints:[ '보기를 하나씩 소거해 봐요.', explain 앞부분 ]` 같은 임시 문구는 금지 → 원본 explain 을 두 문장으로 나눠 쓴다).
- 위젯: 원본에 체험 도구가 없다. `WidgetId` 는 aimath 의 것을 가져오되 쓰지 않는 도구는 번들에서 빠지게 한다(`widget` 블록이 없으면 도구 코드는 안 쓰인다).

## 사이트 계약
- 폴더 `aibasic-next/` = `aimath-next/` 를 복사해 시작. 이름·주소·문구·색(단원 4색 + 사이트 색은 aimath-next 의 새 디자인 토큰 그대로)을 바꾼다. 저장 키 접두사는 `aibn:`(교사용 `aibn:t1` …) 로 aimath 와 겹치지 않게.
- 콘텐츠는 `../content/aibasic` 를 읽는다. 학생 빌드에 교사 코드가 섞이면 안 된다(check-leak 유지).
- `data/plan.json`(차시 계획: 레슨당 1~2차시)과 교사 `prep` 자료는 원본 레슨으로 새로 만든다(aimath 의 것을 복사해 쓰지 않는다).
- 모든 검사(`npm run verify`)가 통과해야 한다. aimath 전용 숫자·문구(수학 위젯, 5단원 가정, 40차시 등)는 4단원·26레슨 기준으로 바꾼다.
- 한글 UI 문구는 해요체. Chrome 80, CSP 외부 요청 금지, 새 npm 패키지 금지.
