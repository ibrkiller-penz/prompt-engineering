# 교실 알림판 — 4인치 보드 (Waveshare ESP32-S3-Touch-LCD-4 V4.0)

교실 벽에 걸어 두는 작은 터치 화면입니다. 시계, 오늘 시간표, 주간 시간표, 선생님 찾기, 날씨·미세먼지, 급식을 보여 줍니다.
이 폴더의 프로그램(펌웨어)을 보드에 넣으면 같은 화면이 만들어집니다.

> 이 문서는 컴퓨터가 낯선 선생님도 따라 하도록 쉬운 말로 썼습니다. 모르는 말은 그 자리에서 한 줄로 풀어 두었습니다.

## 1. 준비물

| 준비물 | 설명 |
|---|---|
| 보드 | **Waveshare ESP32-S3-Touch-LCD-4 V4.0** (4인치 480×480 터치 화면). 이름이 비슷한 다른 크기·다른 버전은 핀이 달라 이 프로그램이 안 맞습니다. |
| USB-C 케이블 | **데이터 전송이 되는 것**(충전 전용 케이블은 PC가 보드를 못 찾습니다) |
| Windows PC | 와이파이로 인터넷이 되는 곳. 영어 이름 사용자 계정이 편합니다. |
| 와이파이 | 보드가 시간표·날씨를 받아 올 때만 잠깐 씁니다(2.4GHz 와이파이). |
| 시간표 자료 | 내 학교 시간표를 담은 JSON 파일들. 샘플 자료와 만드는 법은 [`../common/`](../common/) 에 있습니다. |

설치할 프로그램: **Python 3** 과 **PlatformIO**(보드 프로그램을 만드는 도구)
```
pip install platformio pyserial
```
(Python을 처음 깔 때 "Add python.exe to PATH" 를 꼭 체크하세요. PATH 는 컴퓨터가 프로그램을 찾는 길 목록입니다.)

## 2. 한눈에 보는 순서

1. `firmware\include\board_config.h` 를 열어 `← 내 값으로 바꾸기` 줄을 내 값으로 고친다.
2. 보드를 USB 로 PC 에 꽂는다.
3. `powershell -ExecutionPolicy Bypass -File tools\build_board.ps1` 를 실행한다 (만들기 + 보드에 넣기).
4. 보드 화면이 뜨면 ⑤ 설정 화면에서 와이파이를 고른다.

## 3. 내 값 고치기 (`firmware\include\board_config.h`)

| 항목 | 뜻 | 비워 두면 |
|---|---|---|
| `BOARD_BASE_URL` | 시간표 자료가 있는 웹 주소(끝에 `/`) | 시간표를 못 받는다고 표시(멈추지는 않음) |
| `BOARD_DEFAULT_TT` | 처음 보여 줄 시간표 이름(`index.json` 목록의 name) | 목록의 첫 번째 시간표 |
| `NEIS_ATPT_CODE`, `NEIS_SCHOOL_CODE` | 급식용 학교 번호([나이스 교육정보 개방 포털](https://open.neis.go.kr) 에서 학교 이름으로 조회) | 급식 칸이 "급식을 쓰지 않습니다" |
| `SUNEUNG_DATE` | 수능 날짜 `YYYY-MM-DD` (시계 화면에 D-n) | D-day 안 보임 |
| `WEATHER_LAT`, `WEATHER_LON` | 학교 위치(위도·경도). 지도 앱에서 학교를 길게 누르면 나옵니다. | 날씨·미세먼지 안 받음 |
| `BOARD_PERIOD_START` | 1~7교시 시작 시각 | (기본: 08:40 시작, 점심 12:30~13:30) |

비밀번호나 열쇠(API 키)는 **이 파일에 적지 않습니다.** 와이파이 비밀번호는 보드 화면에서 직접 입력하고, 보드 안에만 저장됩니다.

## 4. 만들어서 보드에 넣기

```
powershell -ExecutionPolicy Bypass -File tools\build_board.ps1
```
- 보드가 USB(칩 내장 USB, VID 303A)로 보이면 포트를 **자동으로 찾습니다.** 못 찾으면 `-Port COM7` 처럼 직접 알려 주세요(COM 번호는 PC마다 다릅니다. 장치 관리자 > 포트에서 확인).
- 보드 없이 만들기만 해 보려면 `-NoUpload` 를 붙입니다.
- **처음 한 번은 35~45분 걸립니다.** 보드의 화면 칩을 안정적으로 쓰려고 ESP-IDF(보드 기본 소프트웨어)를 설정을 바꿔 다시 만들기 때문입니다. 두 번째부터는 약 9분입니다. 중간에 멈춘 것처럼 보여도 기다리세요.
- 스크립트는 `firmware` 폴더를 `C:\Users\<내 계정>\.pio-build\classroom-board-4inch-src` 로 복사해서 거기서 만듭니다. 폴더 경로에 한글이 있으면 만드는 도구(CMake)가 실패하기 때문입니다. 원본은 항상 `firmware` 폴더입니다.
- 인터넷이 필요합니다(처음 만들 때 도구와 라이브러리를 내려받습니다).

## 5. 처음 켜면

화면은 **옆으로 밀어서** 넘깁니다(아래 점이 몇 번째 장인지 알려 줍니다).

| 장 | 내용 |
|---|---|
| ① 시계 | 큰 시계, 날짜, 수능 D-day, 오늘·내일 날씨와 미세먼지, 지금/다음 수업, 점심·저녁 |
| ② 오늘 시간표 | 1~7교시와 점심. 지금 교시는 흰 줄, 곧 들어갈 수업은 노란 테두리 |
| ③ 주간 시간표 | 월~금 × 7교시. 오른쪽 위 ◀ ▶ 로 주 넘기기 |
| ④ 선생님 찾기 | 이름을 누르면 지금 어디 계신지와 오늘 시간표 |
| ⑤ 설정 | 와이파이 고르기, 볼 시간표 고르기, "지금 받기" |

1. ⑤ 설정 → **찾기** → 내 와이파이를 누르고 비밀번호를 입력 → 엔터.
2. 보드는 평소에는 와이파이를 꺼 두고, **1시간마다 잠깐** 켜서 시간·시간표·날씨·급식을 받습니다. 받는 동안(20~30초) 화면이 조금 떨릴 수 있고 끝나면 멎습니다(정상).
3. 20분 동안 만지지 않으면 ① 시계로 돌아갑니다. 밤 10시~아침 7시, 주말, 휴일에는 2분 뒤 화면이 꺼지고 만지면 켜집니다.

## 6. 자료 주소와 자료 모양

시간표·선생님 찾기 자료의 모양(`index.json`, `t/NNN.json`, `where.json`)은 7인치 키트와 **같습니다.**
샘플 자료와 모양 설명은 공통 폴더에 있습니다.

- 샘플 자료: [`../common/site/public/board/`](../common/site/public/board/)
- 자료 모양 설명: [`../common/tools/data-format.md`](../common/tools/data-format.md)
- 자료를 인터넷에 올리는 법(Firebase 호스팅), 학교 코드·위치 찾는 법, 자료 형식 쉬운 안내: [`../common/docs/`](../common/docs/)
- 샘플 자료를 만드는 도구: [`../common/tools/make_sample_data.mjs`](../common/tools/make_sample_data.mjs) · 준비 스크립트: [`../common/tools/setup.ps1`](../common/tools/setup.ps1)

> 4인치 화면은 7인치보다 작아서 `data-format.md` 에 적힌 일부 항목(`hours` 주당 시간, `home` 담임 반의 주간 화면 표시, `n` 주차 번호)은 **화면에 쓰지 않습니다.** 있어도 되고 없어도 됩니다.

## 7. 이 보드에서 꼭 알아 둘 것 (실제로 겪은 일)

- **화면은 공장 방식으로 그립니다.** 보드 제조사(Waveshare) 공장 프로그램과 같은 방식(ESP-IDF `esp_lcd` RGB 패널, 16MHz, 완충 버퍼 30줄, 화면 버퍼 1장은 PSRAM(보드의 큰 메모리), LVGL(화면 그리는 라이브러리)이 그리는 곳은 **내부 RAM** 10줄)입니다. Arduino GFX 는 화면 칩(ST7701)에 시작 명령을 보낼 때만 씁니다. 데모처럼 Arduino GFX 로 그리면 화면이 떨렸습니다. 이 설정은 바꾸지 마세요.
- **밝기 숫자가 거꾸로입니다.** 도우미 칩(CH32)의 밝기 값은 0 = 가장 밝음, 255 = 꺼짐입니다. 255 를 쓰면 화면이 깜깜해지고, 보드를 리셋하거나 프로그램을 다시 넣어도 안 돌아옵니다. **USB(배터리)를 뽑아 완전히 전원을 끊었다 꽂아야** 돌아옵니다.
- **부저가 계속 울리면**: USB 로 강제 재시작(RTS 리셋)을 건 뒤에 그런 적이 있습니다. USB 를 뽑고 10초 뒤 다시 꽂으면 멈춥니다. 로그만 볼 때는 보드를 재시작시키지 마세요(`tools\serial_log.py` 는 읽기만 합니다).
- **화면이 한쪽으로 밀려 보이면** `custom_sdkconfig` 의 `CONFIG_LCD_RGB_RESTART_IN_VSYNC` 를 켜지 않았는지 확인하세요(켜면 안 됩니다. ESP-IDF 5.5.x 버그 espressif/esp-idf#19070).
  펌웨어에는 밀림 대비책이 더 들어 있습니다: 와이파이를 켜는 동안 화면 박자(PCLK)를 6MHz 로 낮췄다가 끝나면 16MHz 로 되돌리고 박자를 다시 맞춥니다, 1분마다 박자를 다시 맞춥니다, 와이파이 버퍼를 내부 RAM 에 둡니다(`SPIRAM_TRY_ALLOCATE_WIFI_LWIP=n`).
- 글자가 하나도 안 보이고 색 띠만 보이면 `include\lv_conf.h` 의 `LV_USE_FONT_COMPRESSED` 가 1 인지 확인하세요.
- USB 단자가 **왼쪽**에 오도록 걸었을 때 화면이 바로 보이게 맞춰져 있습니다.
- SD 카드를 쓰려면 화면 시작이 끝난 **뒤에** 여세요(SD 핀 1·2 가 화면 초기화 핀과 겹칩니다).
- 이 프로그램은 와이파이 인증서를 확인하지 않고 HTTPS 에 접속합니다(`setInsecure`). 시간표·날씨처럼 공개 자료 전용입니다. 비밀번호나 개인정보를 주고받는 데 쓰지 마세요.

## 8. 폴더 구성

```
4inch/
├─ README.md            이 문서
├─ CLAUDE.md            AI 코딩 도우미(Claude Code 등)에게 주는 작업지시서
├─ firmware/            보드 프로그램(PlatformIO 프로젝트)
│  ├─ platformio.ini    보드·라이브러리·화면 안정화 설정
│  ├─ default_16MB.csv  플래시 16MB 나누기표
│  ├─ include/          board_config.h(내 값), lv_conf.h, 날씨 그림 선언
│  ├─ src/              main.cpp(전체 화면·동작), wx_icons.c(날씨 그림), fonts/(한글 글꼴)
│  ├─ lib/WS_CH32_IO/   Waveshare 도우미 칩 라이브러리(Apache-2.0, 레지스트리에 없어 사본 포함)
│  ├─ lib/GFX_Library_for_Arduino/  Arduino GFX 1.5.3 (Waveshare 가 고친 사본, 레지스트리판은 빌드 실패 — PATCH_NOTE.txt)
│  └─ fonts/            한글 글꼴 만드는 스크립트(build_fonts.cjs, Pretendard)
└─ tools/
   ├─ build_board.ps1   만들기 + 업로드(+ -NoUpload, -Port)
   └─ serial_log.py     보드 로그 읽기(읽기만 함)
```
그 밖의 라이브러리(LVGL 8.4.0, SensorLib 0.2.6, ArduinoJson)는 첫 빌드 때 PlatformIO 가 인터넷에서 자동으로 받아 옵니다.

## 9. 글꼴 바꾸기 (선택)

한글 글꼴(`src/fonts/*.c`)은 이미 만들어 포함되어 있어 보통은 필요 없습니다. 글자 크기·모양을 바꾸고 싶을 때만:
```
cd firmware\fonts
npm install
node build_fonts.cjs
```
(Node.js 가 필요합니다. 글꼴은 Pretendard SemiBold, SIL OFL 라이선스 — `fonts/src/Pretendard-LICENSE.txt`.)

## 10. 문제가 생기면

| 증상 | 확인 |
|---|---|
| `보드를 찾지 못했습니다` | USB 케이블이 데이터용인지, 장치 관리자에 새 COM 포트가 생기는지. `-Port COM숫자` 로 지정 |
| 업로드가 안 됨 | 보드에서 BOOT 버튼을 누른 채 USB 를 꽂고 다시 시도 |
| 만드는 중 `CMake` 오류 | 프로젝트 경로·사용자 계정 이름에 한글이 있는지. 스크립트 안의 `$dst` 를 `C:\pio-build\...` 같은 영문 경로로 바꾸기 |
| 화면은 뜨는데 "시간표를 받지 못했습니다" | `BOARD_BASE_URL` 이 맞는지(주소를 PC 브라우저에 `주소index.json` 으로 열어 보기), 와이파이 연결 |
| 날씨 칸이 "날씨 받는 중" | `WEATHER_LAT/LON` 이 채워져 있는지, 인터넷 |
| 화면이 깜깜 | 위 7번의 "밝기 숫자가 거꾸로" — USB 를 완전히 뽑았다 꽂기 |

보드 로그 보기(읽기 전용, 20초): `python tools\serial_log.py --port COM7 20`
