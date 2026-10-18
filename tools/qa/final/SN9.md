# SN9 검수: 보안·배포 설정 (읽기 전용, 포트 9901~9904)

배포 막음 0건 · 고침 권장 2건 · 참고 5건

| 심각도 | 위치(빌드·화면·폭) | 증상 | 재현 방법 | 추정 원인 |
|---|---|---|---|---|
| 고침 권장 | .github/workflows/deploy-aimath-next.yml · deploy-aibasic-next.yml | 배포 직전 검사가 학생 빌드에서 표식 2개(`__AIMN/AIBN_TEACHER_ONLY__`, `aimn/aibn:t1`)만 찾는다. `npm run verify`(check-leak·check-es·타입검사·시험)는 CI 에서 돌지 않아 로컬에서 verify 를 안 거친 코드가 main 에 오르면 그대로 배포된다 | 워크플로 `run:` 단계 확인 | 워크플로가 build 와 grep 한 줄만 실행 |
| 고침 권장 | 허브 ai-study-hub/aiworld | 허브 배포 워크플로가 없고 `.firebaserc` 도 없다. `firebase.aiworld.json` 은 site=aiworld 만 지정하고 project 는 명령에서 `--project ai-study-math` 로 줘야 한다. 수동 배포라 한 번 깜빡하면 허브와 4개 사이트 주소 안내가 어긋난다. 단 라이브 aiworld.web.app 은 이미 있고(SN10 확인) 허브 링크 4개는 맞다 | `grep aiworld .github` 는 move-ai-study-math.yml 의 주석 1줄만 나온다 | 허브는 수동 배포 구조 |
| 참고 | aibasic 학생·교사 빌드 / 레슨 본문 | `https://wrtn.ai`(회원 가입 안내), playground.tensorflow.org, poloclub.github.io, aiopen.etri.re.kr, keris-eduai.co.kr 주소가 레슨 본문에 있다. 링크가 아니라 글자라 눌러도 이동하지 않고 CSP 와 무관. 학생이 직접 입력해 외부 서비스에 가입하게 하는 교재 내용(개인정보는 교재 원문 문제) | dist-s 에서 grep | 교재 원문을 그대로 옮김 |
| 참고 | 학생 빌드 · 내 정보 화면 | `선생님용 사이트` 링크가 학생 빌드에 있다. aimatht.web.app / aibasict.web.app 주소만 들어가고 교사 코드·자료는 없다. 의도된 링크 | dist-s `index-*.js` 에서 `선생님용 사이트` | `TEACHER_URL` |
| 참고 | 학생 빌드 | `speechSynthesis`(읽어 주기)가 있다. 앱은 네트워크 요청을 만들지 않지만, 일부 기기의 음성은 OS 가 원격 음성을 쓸 수 있다(CSP 밖). 외부 요청 0건은 로컬 Chromium 기준 | dist-s grep | 브라우저 기능 |
| 참고 | 배포 대상 | 학생 사이트에도 favicon-t·robots-teacher.txt, 교사 사이트에도 favicon-s·robots.txt(허용) 가 들어 있다. firebase.json `ignore` 로 robots 쪽은 걸러지고 파비콘은 무해 | dist 목록 | public/ 을 두 빌드가 공유 |
| 참고 | Firebase 사이트 4개 | aimaths·aimatht·aibasics·aibasict 사이트가 Firebase 콘솔에 실제로 있고 AI_STUDY_MATH_TOKEN 이 저장소 비밀값에 들어 있는지 확인하지 못했다(미확인). 없으면 배포 단계에서 실패하지만 사이트가 깨지지는 않는다 | 해당 없음 | 읽기 전용·외부 접근 없음 |

## 확인한 범위 (모두 이상 없음)
- **호스팅 대상 이름**: aimath-next/.firebaserc·firebase.json 은 aimaths→dist-s, aimatht→dist-t. aibasic-next 는 aibasics→dist-s, aibasict→dist-t. 뒤바뀜 없음. 프로젝트 ai-study-math. `.env.student/.env.teacher` 의 학생·교사 주소와 `site.ts` 기본값, 허브 카드 링크 4개, 워크플로 이름이 전부 일치. 두 `.firebaserc`·`.env.*` 는 git 에 올라 있고(.gitignore 예외) 작업 트리는 깨끗함.
- **CSP**: 4개 firebase.json 모두 `default-src 'self'; script-src 'self'; connect-src 'self'; ...` 같은 값(vite.config.ts 의 CSP 와 동일), nosniff·no-referrer·Permissions-Policy 있음. 교사 사이트만 X-Robots-Tag noindex. index.html 에 인라인 스크립트·외부 `<link>`·`<script>` 없음. 빌드 결과 외부 URL: w3.org 이름공간·react.dev 오류 문구(문자열)·web.app 이웃 사이트 주소(텍스트)뿐이고 CDN·구글 폰트·분석 0건. fetch 는 vite 의 modulepreload 와 katex 문자열뿐.
- **실제 동작**: 로컬 서버에 firebase.json 과 같은 CSP 를 붙여 4개 빌드를 Playwright 로 열었다(학생 375×812, 교사 1920×1080, 해시 경로 9~13개씩). 외부 요청 0건, CSP 위반·콘솔 경고·페이지 오류 0건, 404 없음. 이미지 참조(aimath 12, aibasic 51)는 전부 빌드에 존재.
- **학생 빌드 교사 유출(직접 grep)**: dist-s 에서 `TEACHER_ONLY`·`aimn:t1`·`aibn:t1`·`icons-teacher`·`data-build` 0건. dist-s 에는 board·flow·pick·prep·print·progress·results·qr·LessonLogCard·u1~u5 청크가 없다(dist-t 에만). data/teacher/prep 의 교사 전용 항목(질문 asks·막힘 stuck·오개념·준비물)을 dist-s 와 대조해 aimath 는 안 나오고, aibasic 은 일치하는 문장이 모두 학생 레슨 본문(content/aibasic)에서 온 것을 확인(교사 prep 파일에서 온 것이 아님). 학생 화면에 나오는 `채점 기준`(rubric)은 학생용 자기 점검 기능.
- **교사 사이트 검색 차단**: meta robots noindex·X-Robots-Tag·`/robots.txt`→robots-teacher.txt(Disallow /) 3중. 학생 사이트는 robots 허용이고 robots-teacher.txt 는 ignore. 로컬 재현으로 응답 내용 확인. 교사 사이트에서 robots.txt 자체는 ignore 되어 올라가지 않으므로 rewrite 가 적용됨.
- **저장 키**: aimath `aimn:s1:`/`aimn:t1:`, aibasic `aibn:s1:`/`aibn:t1:`. 접두사가 서로 달라 충돌 없고 각 사이트는 origin 도 따로. localStorage 사용 위치는 shared/storage 한 곳. 키 8+8개 모두 이름·학번·연락처 없음(반 이름과 숫자만).
- **개인정보·외부 전송**: 소스·빌드에서 XMLHttpRequest·sendBeacon·WebSocket·EventSource·document.cookie·form·iframe·geolocation·getUserMedia·firebase·analytics·gtag 0건. `window.open` 0건. 외부 링크(`선생님용 사이트`·학생 주소)는 rel noopener(교사→학생 링크는 noopener noreferrer).
- **워크플로**: deploy-aimath-next/aibasic-next 는 working-directory 와 `--only hosting:aimaths,hosting:aimatht`(aibasics,aibasict)·`--project ai-study-math`·비밀값 `AI_STUDY_MATH_TOKEN` 존재 검사까지 맞다. `paths` 필터(aimath-next·content/aimath·src/aimath, aibasic-next·content/aibasic)와 실제 import(`content/aimath`, `content/aibasic`, 각 data/) 일치. 루트 deploy.yml 은 FIREBASE_TOKEN·penedu(firsttest-5db1f), move-ai-study-math.yml 은 AI_STUDY_MATH_TOKEN·ai-study-math 로 서로 안 섞임. 루트 `/` → aiworld 302.
- **파비콘·정적 파일**: 4개 index.html 이 가리키는 favicon-(s|t).svg·-32.png·-180.png 가 모두 있고 실제 형식(SVG/PNG)이 확장자와 맞다. 로컬 서버에서 확장자별 content-type 확인(js/css/svg/png/jpg/woff/woff2/txt). 허브 파비콘 3개·글꼴 3개도 존재. 소스 수정 없음.

## 확인하지 못한 것
- 실제 Firebase 호스팅이 보내는 헤더·content-type(로컬 서버로 모의함). 특히 `firebase.json` 의 headers·rewrites 가 배포 후 그대로 먹는지.
- Firebase 사이트·토큰 존재, GitHub Actions 실제 실행(읽기 전용이라 돌리지 않음), `firebase-tools@13` 의 `ignore` 처리.
- 허브(aiworld)의 헤더·CSP(없음, 허브는 정적 링크 페이지라 영향 낮음).
- 화면 위치·레이아웃은 다른 검수자 담당이라 보지 않음.
