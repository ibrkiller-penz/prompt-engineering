# 살빠진 임선생과 함께하는 교육자료 (penedu)

https://penedu.web.app

| 꼭지 | 주소 | 내용 |
|---|---|---|
| 다시 묻는 AI 교실 | `/prompt` | 초·중·고 프롬프트 학습 13차시(차시마다 여는 이야기) · 프롬프트 실험실 · 활동지 PDF · 교사용 지도안 · 수업 모드 |

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
