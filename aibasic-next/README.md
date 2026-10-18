# 인공지능 기초 고도화판 (aibasic-next)

고등학교 『인공지능 기초』를 **한 코드에서 두 사이트**로 만들어요. `aimath-next/`와 같은 구성(학생용 휴대폰 + 교사용 전자칠판)이에요.

| 사이트 | 주소 | Firebase 호스팅 사이트 | 빌드 결과 | 첫 화면 |
|---|---|---|---|---|
| 학생용 | https://aibasics.web.app | `aibasics` | `dist-s/` | 학생 홈(휴대폰 375×812) |
| 교사용 | https://aibasict.web.app | `aibasict` | `dist-t/` | 교사 '오늘 수업'(전자칠판 1920×1080) |

두 사이트 모두 Firebase 프로젝트 **ai-study-math** 에 올려요(배포 비밀값 `AI_STUDY_MATH_TOKEN`, `.github/workflows/deploy-aibasic-next.yml`).
기존 `/aibasic`(`public/aibasic`), `aimath-next/`, `src/aimath`, `content/aimath` 는 고치지 않아요.

## 내용(콘텐츠)

- 원본: `content/aibasic/`(`units.json`, `u1`~`u4` 폴더). 4단원 26레슨, 레슨마다 계단(소제목) 3~6개와 문제 32~50개(선택형·OX, 힌트 2개, 풀이).
  변환은 `tools/aibasic/convert.mjs`가 해요. 이 폴더는 **읽기만** 하고 복사·수정하지 않아요(그림은 빌드 때 `c/img/`로 함께 내보내요).
- 레슨 id 는 `u2_1_3`, `u1_A` 처럼 `u<단원>_<원본 id 의 - 를 _ 로>`, 문제 id 는 `u2_1_3-q7`, 단원 마무리 문제는 `u1-t1` 이에요. 저장 키로 쓰니 바꾸지 않아요.
- 화면 번호는 원본 id 를 따라 `Ⅱ-1-3`(활동은 `Ⅱ-A`)이에요.
- 형식은 `src/content/types.ts`(`aimath` 의 types 를 확장): `code` 블록(파이썬), `image` 블록(그림), 문제의 `passage`(제시문), 레슨의 `goals`(학습 목표) · 소제목의 `keypoints`(한 줄 정리, 같은 내용이 `callout aha '한 줄 정리'` 로도 들어 있어요), `prereq`·`aiStory`·`project` 는 선택이라 없으면 화면에서 자연스럽게 빠져요.
- 글 서식: `**굵게**`, 백틱 `코드`, 줄바꿈 `\n`, 글자 `$` 는 `\$`. `<`·`>`·`&` 는 글자 그대로예요. **수식(KaTeX)과 체험 도구(위젯)는 쓰지 않아서** 번들에 들어 있지 않아요(체험 도구 id 형식과 빈 등록부만 남겨 뒀어요).
- 해요체 덧씌우기(`tone.json`)는 비어 있어요. 시험 문제의 말투(~한다)는 원문 그대로 보여 줘요.
- `unit.json` 의 `why`·`opening`·`future` 는 원본에 없어서 최소 내용(`enrich: true`)이에요. 보강하려면 `content/aibasic/uN/unit.json` 을 고쳐요(이 앱은 읽기만 해요).

## 화면에서 새로 그리는 것

| 블록 | 학생 카드 | 칠판 장면 | 인쇄 |
|---|---|---|---|
| `code` | 고정폭 글자, 줄이 길면 옆으로 밀기(키보드로도), 파이썬 색(보조) | 본문의 0.875배(28px), 줄 바꿈, 너무 길면 장면을 나눠요 | 흑백, 줄 바꿈 |
| `image` | 가로 폭에 맞춰, 설명 줄 | 높이 460px 이내 | 흑백, 70mm 이내 |
| 문제 `passage` | 문제 위 제시문 상자(글·표·코드·그림) | 문제 위에 작게 | 문제 앞 |
| 긴 읽을거리 상자(`📖 스토리 보기`) | 카드 | 따로 장면(기본 꺼짐, 흐름에서 켜요), 문단에서 나눠요 | 본문 |
| 한 줄 정리(`keypoints` → `callout aha`) | 소제목 마지막 카드 | 개념 장면 끝 | 본문 |

레슨마다 문제가 많아서 학생 '더 풀기'는 계단별 고르기 화면을 먼저 보여 줘요(`#/l/:lid/q/more`, 계단을 고르면 `?g=번호`).

## 보조 데이터(`data/`)

모두 원본 레슨에서 새로 만들어요(aimath 것을 복사하지 않아요).

| 파일 | 만드는 명령 | 내용 |
|---|---|---|
| `plan.json` | `npm run gen:plan` | 레슨당 1~2차시(계단 5개 이상이면 2차시), 계단 끝 확인 문제, 칠판·끝 확인·숙제 바구니, 정리 줄 → 소제목 |
| `teacher/prep/u1~u4.json` | `npm run gen:prep` | 교사 준비 자료: 목표, 발문 3개, 막히는 곳, 오개념, 준비물(모두 레슨에 있는 글에서 골라요) |
| `characters.json` | 손으로 | 지우 · 도윤 · 민준 · 아라 쌤 |
| `widget-guides.json`, `overrides/tone.json` | 손으로 | 비어 있어요 |
| `tools/fixtures/*.json` | `node scripts/gen-fixtures.mjs` | 촬영·시험용 가짜 기록 |

## 폴더 구조

```
aibasic-next/
  package.json  vite.config.ts  index.html  .env.student  .env.teacher
  firebase.json  .firebaserc   두 사이트 배포 설정(이 폴더 안에서 firebase deploy)
  data/  scripts/  tests/  tools/ (content-index.mjs 색인기, fixtures/, shots/)
  src/
    main.tsx  site.ts   진입점, 사이트 모드와 두 주소
    content/            types.ts · 읽기 계층(../content/aibasic 를 빌드 때 읽어요)
    styles/  shared/    공용 토큰·부품·라우터·저장·순수 로직
    student/  teacher/  화면(학생 빌드에는 student 만, 교사 빌드에는 teacher 만)
```

학생 번들에 교사 코드가 들어가지 않는 방법과 교사 화면 연결 약속은 `aimath-next` 와 같아요. `src/main.tsx` 가 `@site/App` 한 줄로 앱을 불러오고 `@site` 별칭이 모드에 따라 `src/student` 또는 `src/teacher` 를 가리켜요. 교사 코드에는 표식 `__AIBN_TEACHER_ONLY__` 가 있어서 `scripts/check-leak.mjs` 가 `dist-s` 에서 찾으면 실패해요. 저장 키 접두사는 `aibn:`(학생 `aibn:s1:…`, 교사 `aibn:t1:…`)라서 aimath 와 겹치지 않아요.

## 명령 (모두 `aibasic-next/` 안에서)

새 패키지를 설치하지 않아요. 저장소 뿌리에서 `npm ci` 를 한 번 해 두면 상위 `node_modules/.bin`(vite, tsc)을 써요.

| 명령 | 하는 일 |
|---|---|
| `npm run dev:s` / `npm run dev:t` | 학생(4201) / 교사(4202) 개발 서버 |
| `npm run build` | `dist-s`, `dist-t` 빌드(`build:s`, `build:t`) |
| `npm run preview:s` / `npm run preview:t` | 빌드 결과 미리보기(배포와 같은 보안 헤더) |
| `npm run typecheck` / `npm test` | 타입 검사 / 순수 로직·브라우저 시험(node --test) |
| `npm run verify` | 배포 전 전체 검사: tsc → node --test → check-content → build:s / build:t → check-es → check-css → check-leak / check-imports → check-a11y → check-contrast → smoke. **0으로 끝나야 배포해요** |
| `npm run shots` | 학생 375×812 · 교사 1920×1080 화면을 `tools/shots/` 에 찍고 콘솔 오류 · 외부 요청 · 가로 넘침 검사 |
| `npm run shots -- --all-scenes` | 26레슨 × 모든 차시 × 모든 칠판 장면이 본문 896px 안에 드는지 검사(오래 걸려요) |
| `npm run gen:plan` / `npm run gen:prep` | `data/plan.json` / 교사 준비 자료 다시 만들기 |

시험용으로 다른 콘텐츠 폴더를 읽으려면 환경 변수 `AIBASIC_CONTENT_DIR` 를 줘요(색인기·빌드·시험이 모두 따라가요).

## 배포

선생님 컴퓨터에서(또는 Actions 의 `Deploy aibasic-next` 를 수동 실행):

```bash
firebase login
firebase hosting:sites:create aibasics --project ai-study-math   # 처음 한 번
firebase hosting:sites:create aibasict --project ai-study-math   # 처음 한 번
cd aibasic-next
npm run verify
firebase deploy --only hosting:aibasics,hosting:aibasict --project ai-study-math
```

꼭 `aibasic-next/` 안에서 `firebase deploy` 를 실행해요(이 폴더의 `firebase.json` 을 써요). 배포한 뒤 https://aibasics.web.app/#/board/u1_1_1 처럼 교사 경로를 학생 주소에 붙여 열어 보면 교사 화면이 아니라 '없는 화면' 안내만 나와야 해요.

`firebase.json`: `aibasics` → `dist-s`, `aibasict` → `dist-t`, 모든 경로 `index.html`, 보안 헤더(CSP 외부 요청 없음, no-referrer, Permissions-Policy, nosniff), `/assets/**` 1년 캐시, 교사 사이트는 `X-Robots-Tag: noindex, nofollow` 와 모두 막는 robots.txt.
주소를 바꾸려면 `.env.student` · `.env.teacher` 의 `VITE_STUDENT_URL`, `VITE_TEACHER_URL` 을 고치고 다시 빌드해요.
