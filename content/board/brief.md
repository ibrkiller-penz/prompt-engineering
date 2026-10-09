# 작업지시서: 시간표 단말 만들기 (Waveshare ESP32-S3 터치 LCD)

> **사용하는 분에게**: 이 글 전체를 Claude Code(또는 다른 코딩 AI)에 붙여 넣고 "이 지시서대로 한 단계씩 해 줘"라고 하세요.
> AI는 단계마다 확인 결과를 보여 준 뒤 다음으로 넘어갑니다. 로그인·비밀번호·열쇠처럼 **내 계정이 필요한 일은 AI가 대신하지 않고 나에게 부탁**합니다.
> `<...>` 로 적힌 곳은 내 값으로 바꿔서 알려 주세요.

---

## 0. 목표 — 이 지시서가 끝나면

1. 필요한 프로그램이 PC에 깔려 있다(확인표에 X가 없다).
2. 내 보드에 시간표 단말 프로그램이 올라가 있고, 한글이 깨지지 않으며 터치가 된다.
3. 샘플(가짜) 시간표가 내 Firebase 주소에서 내려와 보드에 뜬다.
4. 내 학교 값(시간표·급식 학교 코드·날씨 위치)으로 바꿨다.
5. 화면이 흔들리거나 밀리지 않는다(아래 6장의 규칙을 지켰다).

## 1. 내 보드 고르기 — AI는 먼저 이것부터 물어본다

| | 7인치 | 4인치 |
|---|---|---|
| 제품 | Waveshare ESP32-S3-Touch-LCD-7 (터치 포함) | Waveshare ESP32-S3-Touch-LCD-4 **V4.0** |
| 화면 | 800×480 | 480×480 |
| 칩 메모리 | 플래시 16MB + PSRAM 8MB | 플래시 16MB + PSRAM 8MB |
| 보드에 꽂는 곳 | **‘UART’ 표시된 USB-C** (UART2 핀 단자는 안 됨) | 보드의 USB-C (칩 안쪽 USB) |
| 키트 | `penedu-board-7inch-starter.zip` | `penedu-board-4inch-starter.zip` |

- 보드가 이 표와 다르면(이름·버전·메모리) **여기서 멈추고** 사용자에게 알린다. 설정이 이 숫자들을 전제로 한다.
- 두 키트의 시간표 자료 형식은 같다.

## 2. 준비물

| 준비물 | 비고 |
|---|---|
| Windows 10/11 PC | 관리자 권한(설치 중 ‘허용’ 창에 [예]), C: 여유 **15GB 이상** |
| USB-C 케이블 | **데이터용**(충전 전용은 안 됨) |
| 와이파이 | **2.4GHz**, 웹 로그인(동의 화면) 없는 것 |
| 계정 | Google 계정(Firebase용). GitHub 계정은 선택 |

## 3. Claude Code 작업 규칙 (이 지시서를 받은 AI에게)

- **한 번에 한 단계.** 단계마다 확인 기준을 실제로 돌려 보고 결과를 보여 준 뒤 다음으로 간다.
- **로그인·비밀번호·API 키·서비스 계정 열쇠는 사용자가 직접** 입력·등록하게 한다. 명령을 알려 주고 기다린다. 이런 값을 채팅에 붙여 달라고 하지 않는다.
- 작업 폴더가 **한글·빈칸 경로면 먼저 멈추고** 영문 경로(`C:\dev\...`)로 옮기자고 한다.
- 시리얼(보드 기록)은 항상 **시간 제한**을 두고 읽는다(무한 대기 금지). 4인치는 기록을 볼 때 보드를 강제로 다시 시작하지 않는다(읽기만).
- 빌드 오류는 스스로 고쳐 보되, **같은 오류가 3번** 나면 원인과 선택지를 설명하고 멈춘다.
- 첫 빌드는 25~45분 걸린다. 그동안 PC를 끄지 않도록 미리 알려 주고, 끝날 때까지 기다린다.
- **6장의 화면 설정은 바꾸지 않는다.** 바꾸자는 제안이 생기면 이유와 위험을 먼저 설명하고 사용자의 동의를 받는다.
- 비밀값(`secrets/`, 열쇠 파일, 내 시간표 원본 파일)은 커밋하지 않는다.
- 설명은 **쉬운 한국어**로 하고, 전문 용어는 한 줄 풀이를 붙인다.
- 새 기능을 만들기 전에 `<보드 폴더>/CLAUDE.md` 를 먼저 읽는다(보드 핀·화면 설정·자료 구조가 적혀 있다).

## 4. 단계

### 단계 1 — 프로그램 설치와 로그인
1. 키트 zip을 `C:\dev\` 에 푼다(영문·빈칸 없는 경로). 안에 `common`(공통)과 보드별 폴더(`7inch` 또는 `4inch`)가 나란히 있다. 이후 `<보드 폴더>`는 내 보드의 폴더다.
2. `powershell -NoProfile -ExecutionPolicy Bypass -File common\tools\setup.ps1` 실행. 이미 깔린 건 건너뛴다. 끝의 확인표에 X가 있으면 한 번 더 실행한다.
3. 로그인은 **사용자가 직접**: `git config --global user.name "영문이름"`, `git config --global user.email "메일"`, `firebase login`(GitHub를 쓰면 `gh auth login`).

확인: `python --version`, `node --version`, `git --version`, `python -m platformio --version` 이 모두 나온다. `firebase login:list` 에 내 계정이 보인다.

### 단계 2 — 보드 연결과 확인
1. 1장 표의 단자에 데이터용 케이블로 보드를 PC에 꽂는다.
2. COM 번호를 찾는다(장치 관리자, 또는 `python -c "import serial.tools.list_ports as l; [print(p.device, p.description) for p in l.comports()]"`).
3. `python -m esptool --port COM<번호> flash-id`

확인: **ESP32-S3, 플래시 16MB, PSRAM 8MB** 가 나온다. 아니면 멈추고 알린다.

7인치에서 포트가 안 보이면: BOOT 버튼을 누른 채 케이블을 꽂고 켜진 뒤 BOOT를 놓는다(굽기 뒤에는 RESET).

### 단계 3 — 첫 빌드와 업로드 (샘플 값 그대로)
`<보드 폴더>` 안에서(PowerShell을 그 폴더에서 연다):
```
powershell -NoProfile -ExecutionPolicy Bypass -File tools\build_board.ps1 -Port COM<번호>
```
- 처음 한 번은 **25~45분**(ESP-IDF 라이브러리를 화면 흔들림 방지 설정으로 다시 컴파일). 두 번째부터는 몇 분.
- 끝에 `[SUCCESS]` 와 `Hard resetting via RTS pin...` 이 나오면 올라간 것이다. 올리지 않고 빌드만 하려면 `-NoUpload`.
- 빌드는 반드시 이 스크립트로 한다(영문 경로로 복사해 빌드한다). `platformio run` 을 한글 경로에서 바로 실행하지 않는다.

확인(사용자가 보드를 보고 답한다): 한글이 깨지지 않는다 / 화면을 누르면 반응한다 / 시계 화면이 뜬다.
보드 기록: `python tools/serial_log.py 30 --port COM<번호> --grep "sync,download,weather,meal"` (30초만 읽고 끝난다).

### 단계 4 — 샘플 시간표를 내 Firebase에 올리기
1. `node common/tools/make_sample_data.mjs` 로 샘플(가짜) 자료를 만든다.
2. 사용자가 직접 프로젝트를 만든다: `firebase projects:create <영문이름>-board --display-name "My Board"` (**표시 이름에 한글을 넣으면 실패**, ID가 이미 있다고 나오면 뒤에 숫자).
3. `common/site/firebase.json` 의 `site`, `common/site/.firebaserc` 의 `default` 를 내 프로젝트 ID로 바꾼다.
4. `cd common/site` → `firebase deploy --only hosting --project <프로젝트ID>`
5. 브라우저에서 `https://<프로젝트ID>.web.app/board/index.json` 이 열리는지 확인한다.
6. `<보드 폴더>/firmware/include/board_config.h` 의 `BOARD_BASE_URL` 을 `https://<프로젝트ID>.web.app/board/`(끝 `/` 포함)로 바꾸고 단계 3처럼 다시 올린다.

확인: 보드 화면 [설정]에서 와이파이를 고르면 기록에 `sync: ok` 계열 줄이 나오고 샘플 시간표가 뜬다. 처음에는 와이파이가 없어 비어 있는 게 정상이다. **와이파이 이름·비밀번호는 코드에 넣지 않고 보드 화면에서 입력**한다.

### 단계 5 — 내 값으로 바꾸기 (`<보드 폴더>/firmware/include/board_config.h`)

| 값 | 무엇 |
|---|---|
| `BOARD_BASE_URL` | 시간표 자료 주소(끝 `/`) |
| `BOARD_DEFAULT_TT` | 처음 볼 시간표 이름(내 이름 또는 학급 이름). 켠 뒤 설정에서 바꿀 수 있다 |
| `BOARD_TITLE` | 위쪽 막대 이름 |
| `NEIS_ATPT_CODE`, `NEIS_SCHOOL_CODE` | 급식용 교육청·학교 코드. 찾기: `https://open.neis.go.kr/hub/schoolInfo?Type=json&SCHUL_NM=학교이름` 의 `ATPT_OFCDC_SC_CODE`, `SD_SCHUL_CODE` |
| `WEATHER_LAT`, `WEATHER_LON` | 날씨·미세먼지용 학교 위치(위도, 경도). Open-Meteo는 열쇠가 필요 없다 |
| `SUNEUNG_DATE` | 수능 D-day 날짜(비우면 안 보임) |

### 단계 6 — 내 시간표로 바꾸기
- 학교마다 시간표 파일 형식이 달라서 **변환 도구는 AI가 새로 만든다.** 먼저 `common/tools/data-format.md` 와 샘플 자료(`common/site/public/board/`)를 읽는다.
- 사용자에게 시간표 원본 파일을 어떻게 뽑는지 묻는다(시간표 프로그램 내보내기, 엑셀, 나이스 등). 원본은 **컴퓨터 안에만 두고** 저장소·인터넷에 올리지 않는다.
- 먼저 **한 사람 것만** 변환해 보여 주고 사용자가 맞는지 확인한 뒤 전체로 넓힌다.
- 결과를 `common/site/public/board/` 에 넣고 `firebase deploy` 로 올린다. 보드는 1시간 안에 새 자료를 받는다.

**개인정보 규칙(꼭 지킨다)**: 올린 파일은 주소를 아는 누구나 볼 수 있다. 교사 실명이 든 전체 시간표를 올리기 전에 사용자에게 학교 방침 확인을 권한다. 가장 안전한 시작은 **사용자 본인 시간표 한 장만** 올리는 것이다(이름 대신 ‘국어A’ 같은 표기도 가능). **학생 이름·번호가 든 자료는 올리지 않는다.**

### 단계 7 — 마무리 확인(사용자가 보드를 보고 답한다)
- [ ] 한글이 깨지지 않는다
- [ ] 주간 시간표 월~금이 다 보인다(오른쪽이 잘리지 않는다)
- [ ] 시계 화면에 시계·날씨·급식이 보인다
- [ ] 전원을 껐다 켜도 와이파이가 다시 붙는다
- [ ] 와이파이로 받을 때 말고는 화면이 흔들리거나 밀리지 않는다

## 5. 자주 막히는 곳

| 증상 | 원인 | 해결 |
|---|---|---|
| `CMake Error`, `cannot open map file` | 경로에 한글·빈칸 | `C:\dev\영문이름` 에서 작업, `tools\build_board.ps1` 로 빌드 |
| 응답 없음(`No serial data received`) — 7인치 | ‘UART’가 아닌 단자에 꽂음 | ‘UART’ 표시된 USB-C로 옮김 |
| `Could not open COM.., port is busy` | 다른 창이 시리얼을 잡음 | 시리얼 창을 닫고 케이블 확인 |
| 월~목만 보임 | 해상도 설정 불일치 | 7인치는 800×480(`ESP_PANEL_USE_1024_600_LCD=0`) |
| USB-C 충전기로 안 켜짐 | 충전기 전원 요청 신호 | USB-A 충전기 + A-C 케이블, 5V 2A 이상 |
| 4인치 화면이 깜깜 | 백라이트 값이 거꾸로(0=가장 밝음, 255=꺼짐) | USB(배터리)를 완전히 뽑았다 꽂는다 |
| 4인치 부저가 계속 울림 | USB 신호로 강제 재시작 | USB(배터리)를 뽑고 10초 뒤 다시 꽂는다 |
| `firebase projects:create` 실패 | 표시 이름에 한글 | 영문으로 |
| PowerShell 한글 깨짐 | BOM 없는 UTF-8 | `.ps1` 은 UTF-8 BOM 으로 저장 |
| `SSL - Memory allocation failed` | LVGL이 안쪽 RAM을 다 씀 | 화면을 켠 **뒤에** `heap_caps_malloc_extmem_enable(64)` |

## 6. 화면 설정 — 바꾸지 말 것 (흔들림·밀림 방지)

RGB 화면은 와이파이·플래시 쓰기와 PSRAM 길을 같이 써서 흔들리거나 밀릴 수 있다. 키트는 아래 설정으로 이를 잡아 두었다.

- 화면은 **공장 방식**으로 구동한다(ESP-IDF RGB 패널 드라이버, 공장 박자 값). Arduino로 PSRAM에 직접 그리는 방식은 쓰지 않는다.
- `platformio.ini` 의 `custom_sdkconfig` 를 그대로 둔다. 핵심: `SPIRAM_XIP_FROM_PSRAM`, `ESP32S3_DATA_CACHE_LINE_64B`, (7인치) `SPIRAM_RODATA`·캐시 크기·`FREERTOS_HZ=1000`, (4인치) `LCD_RGB_ISR_IRAM_SAFE`·`COMPILER_OPTIMIZATION_PERF`.
- **`CONFIG_LCD_RGB_RESTART_IN_VSYNC` 는 켜지 않는다.** 완충 버퍼와 함께 쓰면 박자가 한 번만 어긋나도 화면이 영구히 밀린다(espressif/esp-idf#19070).
- **픽셀 클록을 낮추지 않는다.** 16MHz → 14MHz로 낮췄더니 오히려 나빠졌다.
- 그림판(LVGL)은 칩 안쪽 RAM에, 프레임 버퍼는 PSRAM 1장.
- 와이파이를 켜는 동안 PCLK를 6MHz로 낮췄다가 끝나면 16MHz로 되돌리고 `esp_lcd_rgb_panel_restart`로 박자를 다시 맞춘다. 와이파이가 쉬는 동안 **1분마다** 같은 재설정을 한다. 이 코드(`lcdSlow`, `lcdResync`)를 지우지 않는다.
- (4인치만) 완충 버퍼 30줄, LVGL 그림판 10줄, `SPIRAM_TRY_ALLOCATE_WIFI_LWIP=n`. 7인치는 가로가 넓어 칩 안쪽 RAM이 모자라서 완충 버퍼를 10줄로 두고 이 설정을 넣지 않는다.
- 시계는 **분이 바뀔 때만** 다시 그린다. 와이파이는 평소 꺼 두고 1시간마다 잠깐만 켠다.
- 설정을 바꾸면 ESP-IDF를 다시 컴파일해서 첫 빌드가 다시 25~45분 걸린다.

자세한 설명: https://penedu.web.app/board/shake
