# 인공지능 수학 고도화판 (aimath-next)

고등학교 『인공지능 수학』을 **한 코드에서 두 사이트**로 만들어요.

| 사이트 | 주소 | Firebase 호스팅 사이트 | 빌드 결과 | 첫 화면 |
|---|---|---|---|---|
| 학생용 | https://aimaths.web.app | `aimaths` | `dist-s/` | 학생 홈(휴대폰 375×812) |
| 교사용 | https://aimatht.web.app | `aimatht` | `dist-t/` | 교사 '오늘 수업'(전자칠판 1920×1080) |

두 사이트 모두 Firebase 프로젝트 **ai-study-math**(기존 수학 사이트 프로젝트)에 올려요.
기존 `/aimath`(저장소 뿌리의 `src/aimath`, `content/aimath`, 뿌리 `firebase.json`, `.github/workflows`)는 그대로 돌아가요. 이 폴더는 그것들을 고치지 않아요.

## 폴더 구조

```
aimath-next/
  package.json        scripts만 있어요(의존성은 상위 /node_modules 를 그대로 써요)
  vite.config.ts      --mode student|teacher → @site 별칭, chrome80 대상, dist-s / dist-t
  index.html          하나만 두고 모드별로 제목·robots·viewport 를 채워요
  .env.student  .env.teacher   VITE_STUDENT_URL · VITE_TEACHER_URL
  firebase.json  .firebaserc   두 사이트 배포 설정(이 폴더 안에서 씀)
  public/             robots.txt(학생) · robots-teacher.txt(교사, 모두 막음)
  data/               새 사이트 전용 보조 데이터(새로 쓴 문장만)
    plan.json  widget-guides.json  characters.json  overrides/tone.json
    teacher/prep/u1..u5.json   교사 빌드에서만 import
  src/
    main.tsx  site.ts          진입점, 사이트 모드와 두 주소
    styles/                    공용 토큰·바탕·부품 CSS
    shared/                    라우터·저장·설정·체험 도구 17종·순수 로직
    content/                   content/aimath 읽기 계층(복사하지 않고 빌드 때 읽어요)
    student/                   학생 화면(학생 빌드에만)
    teacher/                   교사 화면(교사 빌드에만)
      App.tsx  shell/  today/  find/  board/  flow/  pick/  prep/  print/  progress/  results/  logic/  qr/
  scripts/  tests/  tools/
```

콘텐츠 원본은 `../content/aimath`(units.json, u1~u5)예요. 빌드할 때 **읽기만** 하고 복사하거나 고치지 않아요.

### 학생 번들에 교사 코드가 들어가지 않는 방법

`src/main.tsx`는 `import App from "@site/App"` 한 줄로 앱을 불러와요. `@site` 별칭이 모드에 따라 `src/student` 또는 `src/teacher`를 가리켜서, 학생 빌드의 의존 그래프에는 `src/teacher`가 아예 없어요. 교사 코드에는 표식 문자열 `__AIMN_TEACHER_ONLY__`가 있어서 `scripts/check-leak.mjs`가 `dist-s`에서 이 글자를 찾으면 실패해요.

### 교사 화면 연결 약속

교사 화면은 `src/teacher/<폴더>/index.tsx`의 **default 내보내기**를 경로에 연결해요(`src/teacher/shell/pages.tsx`). 화면 부품은 경로 일치 정보(`TeacherPageProps`: `name`, `params`, `query`, `path`)를 받아요. 파일이 아직 없으면 '준비 중' 화면이 나와요.

| 경로 | 폴더 |
|---|---|
| `#/` 오늘 수업 · `#/find` 차시 찾기 | `today/` · `find/` (틀과 함께 바로 불러와요) |
| `#/flow/:lid?p=` · `#/pick/:lid?p=` · `#/prep/:lid` · `#/print/:lid` | `flow/` · `pick/` · `prep/` · `print/` |
| `#/progress` · `#/results` · `#/unit/:n/test` | `progress/` · `results/` · `unit/` |
| `#/board/:lid?p=&s=` · `/q/:qid` · `/tool/:wid` · `/end` | `board/` (하나의 default 가 `name` 으로 나눠요, 틀 없이 화면 전체) |
| `#/privacy` | `privacy/` (없으면 틀의 기본 안내) |

`#/board/:lid?p=&s=`의 `s`는 장면 목록(`buildScenes` 결과) 안의 위치(0부터)예요. 화면에 보이는 장면 번호는 켜진 장면만 1부터 센 값이에요.

## 명령 (모두 `aimath-next/` 안에서)

새 패키지를 설치하지 않아요. 저장소 뿌리에서 `npm ci`를 한 번 해 두면 `aimath-next`의 `npm run`이 상위 `node_modules/.bin`(vite, tsc)을 찾아 써요.

| 명령 | 하는 일 |
|---|---|
| `npm run dev:s` / `npm run dev:t` | 학생(4201) / 교사(4202) 개발 서버 |
| `npm run build:s` / `npm run build:t` | `dist-s` / `dist-t` 빌드 |
| `npm run build` | 두 사이트 모두 빌드 |
| `npm run preview:s` / `npm run preview:t` | 빌드 결과 미리보기(배포와 같은 보안 헤더) |
| `npm run typecheck` | 타입 검사(tsc) |
| `npm test` | 순수 로직 시험(node --test) |
| `npm run verify` | 배포 전 전체 검사: tsc → node --test → check-content → build:s / build:t → check-es → check-css → check-leak / check-imports → check-contrast → smoke. **0으로 끝나야 배포해요** |
| `npm run shots` | 학생 375×812 22장 · 교사 1920×1080 20장을 `tools/shots/`에 찍고, 콘솔 오류 · pageerror · 외부 요청 · 가로 넘침을 검사 |
| `npm run shots -- --all-scenes` | 20레슨 × 모든 차시 × 모든 칠판 장면을 공개 단계마다 넘기며 본문이 896px 안에 드는지 검사(약 5분) |
| `npm run shots -- --qa` | 통합 점검 사진 `qa-board-1920-01~12`(b판 포함) · `qa-phone-375-01~09`를 다시 찍고, 오늘 수업의 '수업 시작' 단추가 1080 안에 있는지 검사 |
| `npm run shots -- --smoke` | 저장 없이 두 사이트 몇 화면만 빠르게 검사(verify 마지막 단계) |
| `npm run gen:plan` | `data/plan.json` 자동 초안 다시 만들기 |

### 검사 스크립트(`scripts/`)

| 스크립트 | 보는 것 |
|---|---|
| `verify.mjs` | 아래 단계를 차례로 모두 돌리고 표로 보여 줘요. 하나라도 실패하면 1로 끝나요(`--no-smoke`, `--stop`) |
| `check-content.mjs` | 5단원 · 20레슨, 체험 도구 17종(옛 WidgetId 와 같은지), `data/plan.json`의 문제 id · 소제목 번호 · 차시, `widget-guides.json` 17종, 등장인물, `tone.json` 원문이 그 자리에 정확히 있는지, 교사 준비 자료, 출판사 이름 같은 금지어 |
| `check-es.mjs` | `dist-*/assets/*.js`가 ES2020(acorn)으로 파싱되는지, Chrome 80에 없는 API(`.at(`, `replaceAll`, `Object.hasOwn`, `structuredClone`, `findLast`, `crypto.randomUUID` 등) |
| `check-css.mjs` | 원본 CSS와 빌드 CSS를 규칙 블록 단위로 읽어 flex gap · aspect-ratio · `:has` · `:is` · `:where` · `:focus-visible` · inset · dvh · `@layer` · oklch · color-mix · `@property` · CSS 중첩, TSX 인라인 style 의 aspectRatio · inset |
| `check-leak.mjs` | `dist-s`에 `__AIMN_TEACHER_ONLY__`, `aimn:t1`, '정답 일괄' · '문제 고르기' · '수업 진행' · '교사 준비', 교사 준비 자료 문장 표본이 0건인지(그리고 `dist-t`에는 표식이 있는지) |
| `check-imports.mjs` | 학생 · 공용 코드가 교사 코드나 `data/teacher`를 가져오지 않는지, `@site`는 `main.tsx`에서만, `@legacy`는 `widgets/*.logic`과 `types`만, 순수 로직은 react · DOM 없이 `.ts` 상대 경로로 |
| `check-contrast.mjs` | 테마 × 사이트 × 단원 색 대비(글자 4.5:1, 그래픽 3:1) |
| `shots.mjs` | 촬영과 화면 검사. playwright 는 설치하지 않고 `/opt/node-tools/node_modules/playwright`(또는 `npm root -g`)를, 브라우저는 `/opt/pw-browsers/chromium`(또는 `AIMN_CHROMIUM`)을 써요. `tools/fixtures/student.json` · `teacher.json`의 가짜 기록(개인 정보 없음)을 미리 넣고 찍어요 |

## 배포 (선생님이 하세요)

이 세션은 설정 파일까지만 준비했어요. 실제 배포는 선생님 컴퓨터에서 아래 차례로 해요. `firebase` 명령은 `npm i -g firebase-tools`로 설치했거나 `npx firebase-tools`로 바꿔 써도 돼요.

```bash
# 0) 로그인(처음 한 번)
firebase login

# 1) 호스팅 사이트 두 개 만들기(처음 한 번). 이미 있으면 건너뛰어요
firebase hosting:sites:create aimaths --project ai-study-math
firebase hosting:sites:create aimatht --project ai-study-math

# 2) 대상 이름 연결(.firebaserc 에 이미 적혀 있어요. 확인만)
cd aimath-next
firebase target:apply hosting aimaths aimaths --project ai-study-math
firebase target:apply hosting aimatht aimatht --project ai-study-math

# 3) 검사와 빌드(dist-s, dist-t 가 새로 만들어져요)
npm run verify

# 4) 두 사이트 배포
firebase deploy --only hosting:aimaths,hosting:aimatht --project ai-study-math

# 한 사이트만 다시 올릴 때
firebase deploy --only hosting:aimaths --project ai-study-math
```

### 학생 빌드에 교사 화면이 없는지 확인하기

`npm run verify`의 `check-leak` 단계가 자동으로 확인해요(통과하면 "dist-s 파일 n개에 교사 표식·문구 6종과 준비 자료 표본 …줄이 없어요"가 나와요). 배포 전에 손으로 한 번 더 보려면:

```bash
cd aimath-next
node scripts/check-leak.mjs                      # 0으로 끝나야 해요
grep -rl "__AIMN_TEACHER_ONLY__" dist-s || echo "학생 빌드에 교사 표식 없음"
grep -rl "__AIMN_TEACHER_ONLY__" dist-t | head -1   # 교사 빌드에는 있어야 해요
```

배포한 뒤에는 https://aimaths.web.app/#/board/u1-1 처럼 교사 경로를 학생 주소에 붙여 열어 봐요. 학생 화면(없는 화면 안내)만 나오면 맞아요.

꼭 `aimath-next/` 폴더 안에서 `firebase deploy`를 실행해요. 그래야 이 폴더의 `firebase.json`(두 사이트)을 써요. 저장소 뿌리의 `firebase.json`(penedu 사이트)은 이 배포와 관계없어요.

`firebase.json`이 하는 일:

- `aimaths` → `dist-s`, `aimatht` → `dist-t`
- 모든 경로를 `index.html`로(화면 이동은 해시 주소 `#/…`라서 사실상 첫 화면만 받아요)
- 보안 헤더: Content-Security-Policy(외부 스크립트·글꼴·연결 없음), Referrer-Policy `no-referrer`, Permissions-Policy(카메라·마이크·위치 끔, 전체 화면만 허용), X-Content-Type-Options
- `/assets/**`는 1년 캐시(`immutable`, 파일 이름에 해시가 붙어요), `index.html`·`robots`는 `no-cache`
- 교사 사이트에는 `X-Robots-Tag: noindex, nofollow`와 모두 막는 robots.txt

주소를 바꾸려면 `.env.student`와 `.env.teacher`의 `VITE_STUDENT_URL`, `VITE_TEACHER_URL`을 고친 뒤 다시 빌드해요. 수업 끝 QR과 링크는 `VITE_STUDENT_URL`, 학생 화면의 '교사용' 링크는 `VITE_TEACHER_URL`로 가요.

## 구형 Chrome 80(전자칠판) 대응

- `vite.config.ts`의 `build.target`과 `cssTarget`을 `chrome80`으로 둬요. `@vitejs/plugin-legacy`는 쓰지 않아요. 결과물이 ES2020으로 파싱되는지 `scripts/check-es.mjs`가 검사해요(`?.`, `??`는 Chrome 80이 원래 지원해요).
- 쓰지 않는 CSS: flex `gap`, `aspect-ratio`, `:has`, `:is`, `:where`, `:focus-visible`, `inset`, `dvh`, `@layer`, `oklch`, `color-mix`, `@property`, CSS 중첩. 대신 `> * + *` 형제 margin, `grid-gap`, `padding-top` 비율 상자, `html.kbd :focus`를 써요(`scripts/check-css.mjs`).
- 쓰지 않는 API: `.at`, `replaceAll`, `Object.hasOwn`, `structuredClone`, `findLast`, `crypto.randomUUID`.
- 해시 라우터(자체 제작)라 서버 설정 없이 어느 화면이든 새로고침해도 돼요.
- 글꼴은 시스템 글꼴만, 수식(KaTeX) 글꼴은 번들 안에 있어요. 외부 CDN을 부르지 않아요.

## 저장(이 기기 안에만)

모든 기록과 설정은 브라우저 localStorage에만 남고 서버로 보내지 않아요. 키 목록은 `src/shared/storage/keys.ts` 한 곳에서 관리해요.

- 학생: `aimn:s1:*` (문제 기록, 읽은 소제목, 보던 카드, 읽기 설정, 선생님이 고른 문제 등). '내 기록'에서 JSON 파일로 저장·불러오기를 해요.
- 교사: `aimn:t1:*` (화면 설정, 이어서 하기, 수업 시간, 수업 흐름, 고른 문제, 반 이름과 진도 표시, 손들기 수). 학생 학습 기록·판서·모둠 점수는 저장하지 않아요.
- 이름·학번 같은 개인 정보는 받지 않아요. 수업 끝 QR 주소에는 문제 번호만 들어가요(`https://aimaths.web.app/#/l/u1-1?hw=q06,q11&ex=q03`).

## 선생님께 확인받을 것

1. **체험 도구는 17종이에요.** 처음 요청에는 25종으로 적혀 있었지만, 기존 `/aimath`의 실제 도구(`types.ts`의 WidgetId, `widgets/index.ts`)는 17종이에요. 17종을 모두 새 화면으로 다시 만들었어요.
2. **학생 사이트에도 레슨 정답이 들어 있어요.** 학생이 혼자 풀고 바로 채점하려면 정답이 필요해서 지금 `/aimath`처럼 번들에 들어가요. 학생 빌드에서 빠지는 것은 교사 화면과 교사 자료(준비 한 장, 발문, 오개념, 정답 일괄 보기 등)예요.
3. **교사 사이트에는 비밀번호가 없어요.** 검색에 나오지 않게(`noindex`, robots.txt) 해 두었을 뿐, 주소를 아는 사람은 열 수 있어요. 교사 자료가 꼭 숨겨져야 한다면 다음 단계에서 다른 방법을 정해야 해요.
4. **옛 `/aimath` 학습 기록은 넘어오지 않아요.** 주소(출처)가 달라 브라우저가 기록을 나눠 보관하기 때문이에요. 학생들은 새 사이트에서 처음부터 기록이 쌓여요.
5. 교사 화면에서 고른 '반'은 반별 진도에 반 이름으로 저장되지만, **지금 고른 반**은 탭을 닫으면 첫 반으로 돌아가요.
6. **전자칠판(구형 Chrome 80) 실물에서는 아직 열어 보지 못했어요.** 촬영은 최신 Chromium 으로 했고, Chrome 80 호환은 빌드 대상(chrome80)과 정적 검사(`check-es`, `check-css`)로 대신 확인했어요. 배포한 뒤 교실 칠판에서 교사 주소를 한 번 열어 '수업 시작 → 다음'과 판서를 눌러 봐 주세요.

## 대표 화면 사진

`tools/shots/final_*.png` 12장(합계 약 1.4MB)만 저장소에 올려요. 나머지 촬영 결과(`qa-*`, `student-*`, `teacher-*` 등)는 `npm run shots`로 언제든 다시 만들 수 있어서 `.gitignore`로 뺐어요.

| 파일 | 화면 |
|---|---|
| `final_board-01-오늘수업.png` | 교사 첫 화면 '오늘 수업'(1920×1080) |
| `final_board-02-개념설명.png` | 칠판 개념 장면 |
| `final_board-03-수식.png` | 칠판 긴 수식(u4-3 경사하강) |
| `final_board-04-체험도구.png` | 칠판 체험 도구(회귀) |
| `final_board-05-한문제.png` | 칠판 한 문제 장면(보기 가림) |
| `final_board-06-수업끝QR.png` | 수업 끝 QR(학생 주소) |
| `final_board-07-준비화면.png` | 교사 준비 화면 |
| `final_phone-01-홈.png` | 학생 홈(375×812) |
| `final_phone-02-개념카드.png` | 개념 카드 |
| `final_phone-03-수식.png` | 개념 카드 수식 |
| `final_phone-04-문제피드백.png` | 문제 오답 안내와 기호 입력판 |
| `final_phone-05-복습.png` | 오늘의 복습 |

## 팀 구성과 진행 기록

| 담당 | 맡은 일 |
|---|---|
| 개발1(팀장) | 통합·배포 준비, 해요체 변환 규칙(`src/content/tone.ts`)과 콘텐츠 검사 |
| 개발2 | 차시 정합성(문제 고르기·`plan.json`·`gen-plan`), 칠판 장면 생성 로직, 통합 점검 |
| 개발3 | 학생 기록·복습 규칙, 문제 카드 피드백, 학생 화면 로직 |
| 개발4 | 칠판 장면 화면(한 문제·수업 끝·공개 자리표시·상단 구간 표시) |
| 개발5 | 교사 '오늘 수업'·수업 흐름·차시 찾기·준비 화면, 촬영 스크립트 |
| 디자인1 | 공용 토큰·바탕·부품 CSS, KaTeX svg, 대비 검사 |
| 디자인2 | 수식 블록 맞춤(칠판 줄바꿈·축소), 공용 UI CSS |
| 디자인3 | 체험 도구 17종 칠판 배치(28px 글자·64px 단추) |
| 디자인4 | 칠판 도구 막대(더 보기·나가기 확인), 교사 상단 메뉴 |
| 디자인5 | 학생 겉모양(홈·개요·비활성 단추·카드) |

진행 순서

1. **뼈대**: 한 코드 두 빌드(`--mode student|teacher`), `@site` 별칭으로 학생 번들에서 교사 코드 제외, 해시 라우터, localStorage 저장 키(`aimn:s1:*`, `aimn:t1:*`).
2. **1차 구현**: 20레슨 읽기 계층, 학생 카드·문제·복습·오답노트, 교사 오늘 수업·칠판 장면·수업 흐름·준비 화면, 체험 도구 17종.
3. **시험·수정**: 검사 스크립트 11단계(`verify`), 모든 칠판 장면 896px 검사(`--all-scenes`), 통합 점검 사진(`--qa`).
4. **2차 고도화**: 차시별 문제·정리·핵심 질문 분리, 시간 넘침은 자동으로 끄지 않고 '줄이기' 제안, 수업 끝 QR 크게, 문제 본문 해라체 → 해요체 규칙 변환(864문제 남은 해라체 0건), 칠판 수식 줄바꿈, 체험 도구 칠판 크기.
5. **최종 점검(이번)**: 칠판 도구 막대를 새 `BoardToolbar`(나가기 확인·더 보기 묶음)로 연결, 휴대폰 기호 입력판이 375px에서 잘리지 않게 줄바꿈, 진도 표시 '일부' → '진행 중', 오늘 수업의 '다른 차시 고르기' → '차시 찾기'. `npm run verify` 11단계 통과, `--all-scenes` 20레슨 1109장면 · 공개 단계 4104번 모두 896px 안, `--qa` 27장 콘솔 오류 0건, 저장소 뿌리 `npm run build` 통과.

남은 일(다음 단계)

- 문제 해설의 서술형 모범 답안(`model`)·채점 기준(`rubric`)과 원본 핵심 질문·정리 줄 일부는 아직 해라체예요(화면 문제 본문·보기·힌트·풀이는 해요체).
- 쓰지 않게 된 옛 칠판 CSS(`.bd-side`, 옛 `.bd-q-*`) 정리.
- 일부 45·50분 수업은 장면 합이 수업 시간을 넘어요. 오늘 수업 화면의 '줄이기'로 끌 장면을 제안해요.

다음 할 일(이번 고도화에서 미룬 것)

- 반별 수업 기록 카드(세특용 복사·인쇄)와 학생 학습 요약 내보내기: 새 저장 구조가 필요해요. 먼저 기존 `backup.ts` 와 겹치는지 확인해요.
- exit ticket, 개념별 약점 요약, 일일 목표, 배지, 연속 학습일.
- 낱말을 누르면 뜻이 뜨는 Term 확대 적용, 모국어 번역, 어려운 말('차시' 등) 이름 변경(용어 일관성 검토 필요).
- 칠판 키보드 단축키 안내, 수업 흐름 순서 바꾸기 버튼, 반별 진도 카드 재배치, 특수학급 개별 지원 메모.
- 오답 뒤 '이 개념 다시 보기'로 이동했다가 돌아오면 고른 답·적은 글이 사라져요. `QuestionCard` 에 `initialPick`·`initialText`·`onDraft` 를 두어 유지해요(범위가 커서 미뤘어요).
- 키패드 기호 키 규칙은 `padKeysForQuestion` 하나만 써요(`padSymbolsFor` 직접 호출 금지). 소수 10자리 이상(1/3 꼴)만 분수로 봐요.
- 학생 화면의 '교사용 사이트로 가기' 링크 제거(한 줄 작업).
- 이야기 개수 '1/10' 과 '1/11' 이 달리 보이는 지적: 촬영 시점 차이로 보지만 코드로 한 번 더 확인해요.

검사와 촬영 메모

- `npm run shots -- --qa` 는 칠판 1920 과 1366×768, 정답 공개(득표 없음·있음), 마무리, 학생 오답 피드백·오답노트·복습·개념 수식을 찍어요. 촬영 뒤 vite preview 는 모두 닫혀요.
- `node tests/student/phone-sweep.mjs` 는 375 폭 가로 넘침과, 오답 직후 '풀이 확인하기'·'이 개념 다시 보기' 단추가 보이는지 확인해요.
- `check-a11y`(모든 img 의 alt, 글자 없는 button 의 aria-label)와 `check-leak`(교사 화면 이름 표식 포함)이 verify 에 들어 있어요.

## 2차 고도화 기록

고친 것
- 학생 문제 화면: 오답 직후 '풀이 확인하기'·'이 개념 다시 보기'를 오답 박스 아래로, 하단바에 가리지 않게 스크롤·여백, '지난번엔 맞혔는데…'는 오답 박스 안(`wrongExtra`), 키패드 '/' 키는 분수 정답일 때만.
- 학생 단원 화면: 삽화를 맨 위에, 이야기는 접힌 한 줄, '시작하기 전에 읽는 이야기'·'왜 배울까'는 레슨 목록 아래. '틀린 횟수'는 '다시 본 횟수'로, 오답노트 카드 빨간 줄은 중립색으로.
- 교사 오늘 수업: 상태 한 줄, 끝난 레슨은 '처음부터 수업'과 보조 '이어서 수업', 수업 전 준비 묶음, 이야기 장면 시간 안내.
- 교사 칠판: 정답 공개 득표 화면에서 정답률 줄을 머리 줄로 옮겨 카드가 안 잘려요. 수업 끝 QR은 숙제 번호 줄·차시 이름 두 줄·QR 크기 조정. '0으로' 단추는 '모둠 점수 0으로'·'득표 0으로'.
- 수업 흐름: 같은 장면 순번 표시, 필수 장면 잠금 표시, 설명 두 줄.
- 진도 문구는 레슨 단위('끝난 레슨이에요', '끝')로 통일.

팀 구성: 교사 위원 5 · 학생 10 · 에듀테크 5 · 검토자 3 · 총괄 1 · 개발 3.

남은 일(검토자 권고)
- 이야기 장면 시간 안내 문구(`prep.logic.ts` `storyAddText`)에 '대략'을 붙이고, 한 줄씩 공개하는 시간 어림(`estMin`)을 다시 계산해요.
- 오답 뒤 '이 개념 다시 보기'에서 돌아오면 고른 답이 사라져요(`initialPick`·`onDraft` 필요).
- 사람 눈 확인이 필요한 사진: 학생 단원 1(375x812)에서 레슨 2~3개와 시작 단추, 교사 1920 첫 화면·08b, 1366 장면. 사진 폴더는 git 무시라 `final_*.png` 는 갱신되지 않아요.
- '0으로' 단추 누르기 전 확인 단계.

## 3차 고도화 기록

고친 것
- 학생: 오답노트 설명 글자·간격 키움('아직' 빈 화면은 체크 아이콘), '이 개념 다시 보기'를 진한 단추로, 내 기록 라벨('끝낸 레슨'·'맞힌 문제'·'체험 미션 완료')과 단원 보조 문구 가독성, 교사용 링크 제거, 오답 뒤 개념 보러 갔다 돌아와도 고른 답·글 유지(`draft.logic.ts`), 오답 문구는 `prevNote` 한 곳에서 관리.
- 교사 칠판: 4지선다·O/X에서 정답·힌트·풀이를 열어도 보기와 득표 단추가 보이게 왼쪽 보기·오른쪽 상자로 나눔(풀이가 길면 오른쪽 칸 안에서 스크롤).
- 교사 수업 기록 카드(`LessonLogCard.tsx`, `lessonlog.logic.ts`): 복사 글 번호를 화면과 같게, 반이 없으면 저장 안 함과 안내, 스크롤 표시, Tab 초점 가두기, 손들기 안 한 끝 확인은 한 줄로, 잘못된 모양의 기록은 건너뜀(`isLessonLog`).
- 시간 안내: 넘침 판단을 `overMin`(0.5분 이하는 '맞아요') 한 곳으로 통일(Today·flow·Prep·줄이기 상자). `storyAddText` 는 한 문장 꼴을 바로 돌려줌.

팀 구성: 교사 위원 5 · 학생 10 · 에듀테크 5 · 검토자 3 · 총괄 1 · 개발 3.

남은 일
- '졸업'을 쉬운 말로 바꾸고 `prevNote` 의 졸업 문구와 함께 정리해요.
- 손든 문항과 안 한 문항이 섞인 기록 카드, '아직' 탭 빈 화면(오답 없는 기록) 사진 확인이 필요해요.
- `lessonLogText`(복사 글)에는 끝 확인 반복 정리가 아직 없어요.
- `QuestionCard.tsx` 주석 예시에 옛 문구('지난번엔')가 남아 있어요.
- 문제 글 3줄에 풀이가 긴 문제(u3-1-q30)는 오른쪽 풀이 칸에서 스크롤해야 해요.
- 사진 폴더는 git 무시라 일부 `final_*.png` 는 갱신되지 않아요. `tools/shots/*.pdf` 는 커밋하지 않아요.
