# 살빠진 임선생과 함께하는 교육자료 (penedu)

https://penedu.web.app

| 꼭지 | 주소 | 내용 |
|---|---|---|
| 다시 묻는 AI 교실 | `/prompt` | 초·중·고 프롬프트 학습 13차시(차시마다 여는 이야기) · 프롬프트 실험실 · 활동지 PDF · 교사용 지도안 · 수업 모드 |
| 제미나이 노트북(노트북LM) | `/notebook` | 첫 화면(세 칸·소스 넣는 법) → `/notebook/slides` 슬라이드·인포그래픽 프롬프트(디자인 33종 + 내 색 · 스타일 템플릿 9종 · 구성 방식 · 보강 지침) · `/notebook/cases` 활용 사례(오디오·동영상·퀴즈·마인드맵·표·채팅). 예전 `/slides` 주소는 자동 연결 |
| 온라인 수학 체험 | `/mathplay` | 마우스로 놀며 배우는 수학 게임(초등용 24 + 중·고 도전 9, 1층 놀이 마당·2층 미래 연구소·3층 수학 박물관) · 게임을 누르면 팝업으로 열림(펜토미노 달력·테트로미노·색동 마방진 포함) |
| 학습 사이트 만들기 레퍼런스 | `/handgen/` | 안내 → 같이 해보기 → 손발전기 완성 사이트 · 작업지시서 · 제작 가이드(`docs/학습사이트_제작가이드.md`) |

## 개발

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 타입 검사 + dist/ 빌드
npm run pdfs     # 활동지 PDF 다시 만들기 (Edge/Chrome 필요)
npm run deploy   # 빌드 후 Firebase Hosting(penedu)에 배포
```

## 폴더

- `content/prompt/` — 차시·이야기(stories)·실험실·점검 규칙·교사용 지도서 JSON (문장을 고치려면 여기만 고치면 됨, 형식은 `src/content/types.ts`)
- `src/site.ts` — 사이트 이름과 꼭지 목록 (새 교육자료를 더할 때 여기에 한 줄)
- `docs/` — 작업지시서, 선택 기록(DECISIONS), 진행 기록(PROGRESS), 추가 제안
- `source/` — 원본 교재 PDF (저장소에 올리지 않음)

## 개인정보

로그인 없음, 서버 저장 없음, 분석 도구 없음. 학생이 쓴 내용은 그 기기의 브라우저(localStorage)에만 남습니다.
