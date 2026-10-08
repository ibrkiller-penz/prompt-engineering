# 진행 기록 (PROGRESS)

## 2026-10-08 — 10번째 꼭지 `/aimath` 인공지능 수학 추가
- 5개 대단원 · 12개 레슨 · 레슨마다 이야기·개념·용어·AI 이야기·계단 문제(22~24개)·프로젝트·요약. 대단원마다 도입 이야기·왜 배울까·마무리 문제 19~20개·미래(진로) 이야기. 체험 도구 13개(`src/aimath/widgets/`, 수식은 KaTeX).
- 내용은 `content/aimath/uN/lesson-K.json`·`unit.json`, 형식은 `docs/인공지능수학_콘텐츠형식.md`, 검사기는 `node scripts/check-aimath.mjs --strict <파일>`. 결정은 D13.
- 출처 자료(비상교육 교과서·지도서)는 저작권이 있어 **저장소에 넣지 않았고**, 글·예제·문제는 모두 새로 썼다. 푼 기록은 브라우저 localStorage(`penedu:aimath:`)에만 남는다.
- 점검: 검사기 0/0, tsc 통과, 헤드리스 브라우저로 모든 쪽 PC·모바일(콘솔 오류·수식 깨짨·가로 넘침 없음), 정답 독립 재계산 검수(5조).
- 같은 날 오후 **다시 짓기**: 천재교육 교과서·문제지를 범위·유형 참고로 섞어, 레슨마다 '먼저 알고 가요'(이전 수학 복습 카드)·이야기 8~12문단·개념 1만 자 안팎·유형별 연습 포함 문제 40~45개로 재작성. 새 레슨 3개(u1-4 알고리즘과 순서도, u2-3 벡터로 자료 다루기, u4-4 변화율과 미분계수), 새 체험 도구 4개(truth·flow·vecops·tangent), 단원마다 '시작하기 전에 읽는 이야기' 4편과 학력진단평가 A·B회. 지침은 `docs/인공지능수학_다시짓기_지침.md`. 총 레슨 15개·문제 835개(레슨 연습 652 + 단원 시험 183).
- 검수: 8개 검수 에이전트가 문제 약 835개 전부(서술형은 모범답안만)를 독립 재계산(오류 정답 없음, 설명·표기 40여 곳 수정). 푸터에 '© 2026 살빠진 임선생' 표시.
- 2026-10-08 저녁: 읽을거리(aiStory·stories 등)의 연도·인명 44곳을 아는 범위에서 대조해 오류 없음 확인(외부 자료 재검색은 안 함).
- 남은 일: 실제 학생·교사 눈으로 난이도·표현 검토.

## 2026-10-06 — 6번째 꼭지 `/board` 추가
- 쪽 8개 + AI 작업지시서(`content/board/brief.md`) + 시작 프로젝트 zip(`board-kit/` → `scripts/make-board-zips.py`). 결정은 D12.
- 키트 두 개 컴파일 성공(업로드·실물 시험은 안 함), 개인정보 검색 0건, 모바일 확인, **배포 완료(2026-10-06)**.
- 2026-10-06 오후: 밀림 3차 대책(두 보드)·7인치 새 기능(12/24시간, 시계 복귀 시간, 보이기 설정)을 키트에 반영·재컴파일, 7번째 꼭지 SVG Forge 추가.
- 2026-10-08 밤: HappyMpX 카드 = 비밀번호 → 프로그램(HappyMpX.zip) 받기만. 웹 변환은 **중단**(유튜브가 Render 서버 주소를 막아 yt-dlp 접속 방식 9가지가 모두 실패). 변환 서버·웹페이지는 비공개가 아닌 공개 저장소 ibrkiller-penz/happymp3 에 남겨 두었고 happymp3.web.app 은 안내 페이지다.
- 주의: `public/happy/HappyMpX.zip` 은 git 에 없다(.gitignore). 다른 PC 에서 배포하기 전에 https://github.com/ibrkiller-penz/happymp3/releases/download/files-2026-10-08/HappyMpX.zip 을 `public/happy/` 에 받아 둔다(안 그러면 사이트에서 빠진다).
- 남은 일: 실물 보드에서 키트 시험, 흔들림 ‘지켜보는 중’ 상자 갱신, 교시 시각(PERIOD_START)을 board_config.h로 옮길지 결정.

## 재시작 여섯 줄 — 2026-10-04 (1~3단계 끝)

1. **현재 목표**: 1~3단계 완료·배포. 4단계(학급 코드로 결과물 모으기, 실제 AI 연결)는 실제 수업에 써 본 뒤 필요할 때만.
2. **끝낸 것**:
   - 콘텐츠 39차시(초·중·고 각 13) + 교사용 내용 + 지도서 앞부분(지도 원칙·평가 계획), 부록(말 카드·사전·약속), 실험실 시나리오 6개.
   - 차시를 여는 이야기 13편 × 학교급별 문체 3가지(수필 『다 된 줄 알았다』에서) + Canva 삽화 14장. 활동지 PDF 첫 쪽에도 들어감.
   - 활동지 PDF(인쇄용 화면 + 미리 만든 PDF 45개), 교사용 화면(`/prompt/:level/teacher`, 차시 지도안), 수업 모드(전자칠판, ← → 넘기기, 글자 크기), ‘실제 AI로 해 보기’ 켜기/끄기(중·고만, 기본 꺼짐).
   - 모든 차시에 생각 노트, 띄어쓰기 오탈자 정리.
3. **확정한 선택과 이유**: DECISIONS D1~D11.
4. **남은 차이와 위험**: 이야기·실험실 응답 문장은 새로 줄이거나 쓴 것(사용자 검토 권장). PDF는 콘텐츠를 고칠 때마다 `npm run pdfs`.
5. **미정 사항**: 4단계 착수 여부.
6. **다음 시작점**: 실제 수업에서 써 본 뒤 고칠 곳 모으기 → `docs/추가제안.md` 검토.

---

## 원문 대조표

| 학교급 | 차시 | 원문 대조 | 비고 |
|---|---|---|---|
| 초등 | 1~12 | 완료 | 수업 흐름 표는 -layout 없이 다시 뽑아 맞춤 |
| 초등 | 13 | 완료 | 교재에 ‘스스로 점검해요’·‘오늘의 한 문장’ 없음 → 넣지 않음 |
| 중학 | 1~12 | 완료 | 1~6은 1단계 본문 그대로 + teacher 추가(본문 변경 없음 확인) |
| 중학 | 13 | 완료 | 초등 13과 같음 |
| 고등 | 1~6, 8~12 | 완료 | |
| 고등 | 7 | 검토 1곳 | 활동 1 지문 『한국식품과학회지』 — PDF 줄바꿈 자리라 띄어쓰기 불명 |
| 고등 | 13 | 완료 | 처음 옮길 때 표지 뒷면 문장·약속을 끌어와 넣었던 것을 뺌(교재에 없음) |
| 실험실 | 6개 | 일부 | 숨은 조건·첫 되말하기·선택 기록 예시는 교재 그대로, 응답 문장은 새로 씀 — TODO(검토) |

### '오늘의 한 문장' 대조 (지시서 4-1 표)
초·중·고 1~12차시 36문장 모두 일치(둥근/곧은 따옴표 차이만). 13차시는 세 학교급 모두 교재에 없음.

### 교재에서 그대로 둔 것 (오탈자 의심)
| 곳 | 원문 | 비고 |
|---|---|---|
| 초등 7차시 | “따로 확인 해야 해요” | 한 줄 안의 띄어쓰기 — 원문 유지 |
| 초등 9차시 | “때문 이에요” | 한 줄 안의 띄어쓰기 — 원문 유지 |
| 고등 11차시 | 본문 “지금도 이 기준이 유효한지” / 오늘의 한 문장 “지금도 유효한지” | 둘 다 원문대로 |

## 2026-10-08 — /aibasic 모바일 줄 줄이기 (소스가 이 저장소에 없음)
- `penedu.web.app/aibasic/` 소스(index.html·app.js·style.css·lessons.js·fonts·img)는 이 저장소에 **없다**(교재 이미지가 있어 공개 저장소에 올리지 않은 것으로 보임). 배포는 그 소스가 있는 PC 에서 `npm run deploy` 로 해야 하고, 그 PC 의 `public/aibasic/` 가 없는 곳에서 배포하면 /aibasic 이 사이트에서 빠진다.
- 링크 미리보기: 꼭지별 이름이 뜨도록 vite.config.ts 의 section-meta 플러그인이 빌드 때 /setup·/prompt·/slides·/board·/aimath 마다 meta 가 다른 index.html 을 만든다(하위 쪽 주소는 꼭지 이름까지만 나옴). /aibasic 은 패치에 og 태그 포함.
- 변경(모바일 줄 줄이기): 헤더 '인공지능 기초'·'용어 사전' 한 줄, 단원 카드 이모지 옆에 단원명, 배지 4+3 두 줄, 첫 화면 제목·설명을 단어 단위로 줄바꿈. 패치: `scripts/aibasic-mobile.patch` → `cd public/aibasic && patch -p1 < ../../scripts/aibasic-mobile.patch` (style.css·app.js).

## 다른 PC 에서 배포하는 법 (aibasic·HappyMpX 가 빠지지 않게)
```
git clone https://github.com/ibrkiller-penz/prompt-engineering && cd prompt-engineering
git checkout ccr-f6979783-ajhov6        # (main 에 합친 뒤에는 main)
npm ci
node scripts/fetch-aibasic.mjs          # /aibasic 을 배포본에서 복원 (이미지 포함)
(cd public/aibasic && patch -p1 < ../../scripts/aibasic-mobile.patch)   # 처음 한 번만(이미 적용했으면 건너뜀)
mkdir -p public/happy && curl -L -o public/happy/HappyMpX.zip https://github.com/ibrkiller-penz/happymp3/releases/download/files-2026-10-08/HappyMpX.zip
npx firebase-tools login:ci             # 처음 한 번, 나온 토큰을 FIREBASE_TOKEN 으로
FIREBASE_TOKEN=<토큰> npm run deploy
```
- 패치를 이미 적용한 뒤 `--force` 로 다시 받으면 패치 전 상태로 돌아가니, 다시 받았다면 패치도 다시 적용한다.
