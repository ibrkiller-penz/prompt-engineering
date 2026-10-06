# 01. 시간표 자료를 Firebase 호스팅(무료)에 올리기

보드는 인터넷에서 시간표 파일을 **받아 가는** 방식입니다. 그 파일을 둘 곳이 필요한데, Google 의
**Firebase Hosting**(파일을 인터넷 주소로 보여 주는 서비스)의 **무료 Spark 요금제**로 충분합니다. 카드 등록이 필요 없습니다.

> 이 문서의 경로(`tools\`, `site\`)는 키트의 **`common` 폴더 안** 기준입니다. PowerShell 을 그 폴더에서 여는 것이 편합니다.

> 용어 한 줄: **Firebase 프로젝트** = Google 안의 내 작업 상자 · **사이트 ID** = 주소 앞부분(`<사이트ID>.web.app`) · **배포(deploy)** = 내 PC 파일을 인터넷에 올리는 일

## 준비
- Google 계정 1개
- PC 도구: `tools\setup.ps1` 을 한 번 돌렸다면 Node.js 와 Firebase CLI 가 이미 깔려 있습니다(`firebase --version` 으로 확인).
- 로그인은 **본인이 직접** 합니다(AI 도우미에게 비밀번호를 알려 주지 마세요).

## 1단계. 프로젝트 만들기
1. https://console.firebase.google.com 에서 **프로젝트 추가**.
2. 이름은 **영문·숫자·하이픈**으로(한글을 넣으면 실패합니다). 예: `kimteacher-board`
   - 프로젝트 ID 는 전 세계에서 하나뿐이어야 합니다. 이미 있다고 하면 뒤에 숫자를 붙입니다(`kimteacher-board-2`).
3. Google 애널리틱스는 **끔**(필요 없습니다).
4. 왼쪽 메뉴 **빌드 → Hosting → 시작하기**를 눌러 호스팅을 켭니다(마법사는 [다음]만 눌러 끝내도 됩니다).
   - 사이트 ID 는 기본으로 프로젝트 ID 와 같습니다. 주소는 `https://<프로젝트ID>.web.app` 입니다.

(명령줄로 하려면: `firebase projects:create <영문ID> --display-name "영문 이름"` — 표시 이름도 영문으로.)

## 2단계. 로그인 (본인이 직접)
```
firebase login
```
브라우저가 열리면 Google 계정을 고르고 허용합니다. 확인: `firebase login:list`

## 3단계. 내 ID 넣기
`site` 폴더의 두 파일을 고칩니다(메모장으로 열어도 됩니다).

| 파일 | 바꿀 곳 | 넣을 값 |
|---|---|---|
| `site\.firebaserc` | `"default": "YOUR-PROJECT-ID"` | 내 **프로젝트 ID** |
| `site\firebase.json` | `"site": "YOUR-SITE-ID"` | 내 **사이트 ID**(보통 프로젝트 ID 와 같다) |

## 4단계. 자료 만들고 올리기
```
node tools\make_sample_data.mjs          ← 샘플 자료 만들기(site\public\board\ 에 생긴다)
cd site
firebase deploy --only hosting --project <내 프로젝트 ID>
```
성공하면 끝에 `Hosting URL: https://<사이트ID>.web.app` 이 나옵니다.

**확인**: 브라우저에서 `https://<사이트ID>.web.app/board/index.json` 을 열어 `"items"` 가 보이면 성공입니다.

## 5단계. 보드에 알려 주기
`firmware\include\board_config.h` 의 한 줄을 고칩니다.
```c
#define BOARD_BASE_URL "https://<사이트ID>.web.app/board/"   // 끝의 / 까지
```
그 뒤 보드에 다시 올립니다(README 의 빌드·업로드).

## 자료를 바꿀 때
시간표 파일(`site\public\board\...`)을 새로 만들고 4단계의 `firebase deploy` 만 다시 합니다. 보드는 **1시간 안에**(또는 설정의 [지금 받기]) 새 자료를 받습니다. 형식은 `tools\data-format.md` 를 보세요.

## 무료로 충분한가?
Spark 요금제는 저장 10GB · 하루 전송 약 360MB 입니다. 보드 한 대가 시간표 한 개(약 60KB)와 목록·찾기 파일을 1시간마다 받으므로, 20대가 하루 종일 받아도 약 40MB 라서 여유가 있습니다.

## 막힐 때
| 증상 | 원인 | 해결 |
|---|---|---|
| `Error: Hosting site not found` | `firebase.json` 의 site 가 콘솔의 사이트 ID 와 다름 | 콘솔 Hosting 화면의 도메인 앞부분을 그대로 |
| `HTTP Error: 403` / 권한 오류 | 다른 Google 계정으로 로그인됨 | `firebase logout` 후 다시 `firebase login` |
| 새 자료가 안 바뀜 | 브라우저 저장본 | 주소 끝에 `?x=1` 을 붙여 열어 보기(보드는 항상 새로 받는다) |
| 프로젝트 만들기 실패 | 한글 이름 / 이미 있는 ID | 영문으로, 숫자를 붙여서 |
