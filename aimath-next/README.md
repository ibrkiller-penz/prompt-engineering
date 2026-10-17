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
