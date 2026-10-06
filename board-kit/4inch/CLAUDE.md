# 작업지시서: 교실 알림판 4인치 보드 (Waveshare ESP32-S3-Touch-LCD-4 V4.0)

이 문서는 **AI 코딩 도우미(Claude Code 등)** 가 읽고 따르는 지시서입니다. 사용자는 코딩을 잘 모르는 교사입니다.
사용자에게는 **쉬운 한국어**로 설명하고, 어려운 말은 한 줄로 풀어 주세요.

## 1. 목표

보드에 펌웨어를 넣어 교실 알림판(시계 · 오늘/주간 시간표 · 선생님 찾기 · 날씨·미세먼지 · 급식)을 만든다.
이 폴더(`board-kit/4inch`)가 완성본 소스다. 사용자가 할 일은 **`firmware/include/board_config.h` 값 채우기, 보드 연결, 와이파이 입력**이다.
시간표 자료(`index.json`, `t/NNN.json`, `where.json`)의 모양은 `../common/tools/data-format.md`, 샘플은 `../common/site/public/board/`.

## 2. 하드웨어

| 항목 | 내용 |
|---|---|
| 보드 | Waveshare **ESP32-S3-Touch-LCD-4 V4.0** |
| 모듈 | ESP32-S3-WROOM-1-N16R8 — 플래시 16MB(QIO), PSRAM 8MB(OPI) |
| 화면 | 4인치 **480×480**, ST7701. 그림은 RGB 병렬, **시작(초기화) 명령은 3선 SPI**: CS 42 / SCK 2 / MOSI 1 |
| RGB 핀 | DE 40, VSYNC 39, HSYNC 38, PCLK 41 / R0~R4 = 46,3,8,18,17 / G0~G5 = 14,13,12,11,10,9 / B0~B4 = 5,45,48,47,21 |
| 터치 | GT911, I2C **SDA 15 / SCL 7**, 주소 0x5D 또는 0x14(둘 다 확인) |
| 도우미 칩 | **CH32V003, I2C 0x24**(터치와 같은 I2C 선). 백라이트 PWM · 화면 리셋 · 터치 리셋 · 부저 · 전원 · 배터리 전압. 라이브러리 `WS_CH32_IO` |
| 기타 | RTC PCF85063(0x51), microSD(1비트 SDMMC CLK 2 · CMD 1 · D0 4), RS485, CAN |
| 연결 | 칩 내장 USB(USB-Serial/JTAG, VID:PID 303A:1001). **굽기와 로그가 같은 USB.** `ARDUINO_USB_MODE=1`, `ARDUINO_USB_CDC_ON_BOOT=1` |

※ 7인치/5인치 키트(ESP32_Display_Panel, IO 확장칩)와 **드라이버가 다르다.** 이 보드는 ESP-IDF `esp_lcd` RGB 패널을 직접 쓴다.

## 3. 폴더 구조

```
4inch/
├─ CLAUDE.md, README.md
├─ firmware/                PlatformIO 프로젝트(원본)
│  ├─ platformio.ini        env: board4inch, custom_sdkconfig, lib_deps(버전 고정)
│  ├─ default_16MB.csv
│  ├─ include/board_config.h   ← 사용자가 고치는 값은 여기에만
│  ├─ include/lv_conf.h, wx_icons.h
│  ├─ src/main.cpp, wx_icons.c, fonts/*.c
│  ├─ lib/WS_CH32_IO/       레지스트리에 없는 Waveshare 라이브러리(Apache-2.0)
│  ├─ lib/GFX_Library_for_Arduino/  Arduino GFX 1.5.3 Waveshare 수정본(PATCH_NOTE.txt 참고, 레지스트리판은 Arduino-ESP32 3.3 에서 빌드 실패)
│  └─ fonts/                build_fonts.cjs, package.json, src/(Pretendard, 한글 2350자 목록)
└─ tools/build_board.ps1, serial_log.py
```
`.pio/`, `node_modules/`, `sdkconfig.*` 는 만들어지는 파일이다(수정·커밋 금지).

## 4. 빌드 규칙

- **빌드는 항상 `tools/build_board.ps1`** 로 한다. `pio run` 을 이 폴더에서 직접 돌리지 않는다.
  스크립트는 `firmware` 를 영문 경로 `%USERPROFILE%\.pio-build\classroom-board-4inch-src` 로 복사해 거기서 빌드한다.
  (한글 경로에서는 `custom_sdkconfig` 가 ESP-IDF 를 다시 컴파일할 때 CMake 가 실패한다. 복사본은 고치지 않는다.)
- 보드 없이 확인: `powershell -ExecutionPolicy Bypass -File tools\build_board.ps1 -NoUpload`
- 업로드: 같은 명령(보드 자동 탐지). 포트가 안 잡히면 `-Port COMx` 또는 환경변수 `PIO_PORT`. COM 번호는 PC마다 다르다(사용자에게 장치 관리자 확인을 부탁).
- **첫 빌드 35~45분, 이후 약 9분.** 도구 호출 제한(보통 10분)에 걸리므로 **분리된(detached) 프로세스로 띄워 로그 파일로 확인**한다. 예(PowerShell):
  `Start-Process powershell -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','tools\build_board.ps1','-NoUpload' -RedirectStandardOutput build.log -WindowStyle Hidden` 후 `Get-Content build.log -Tail 5` 로 짧게 확인.
- 스크립트의 `PYTHONIOENCODING=utf-8`, `PYTHONUTF8=1` 은 지우지 않는다(없으면 esptool 진행 막대가 cp949 오류로 멈추고 COM 포트를 계속 잡는다). `.ps1` 은 **UTF-8 BOM** 이어야 한글이 안 깨진다.
- `lib_ldf_mode = deep+` 를 넣지 않는다(Network.h 를 못 찾는다).
- 라이브러리: ArduinoJson ^7, **LVGL 8.4.0**, SensorLib 0.2.6 은 `lib_deps`(레지스트리, 버전 고정). **로컬 사본은 `lib/WS_CH32_IO`(레지스트리에 없음)와 `lib/GFX_Library_for_Arduino`(레지스트리 1.5.3 은 Arduino-ESP32 3.3 에서 컴파일 오류 — 이 사본은 두 파일이 고쳐져 있음)** 이다. GFX 를 `lib_deps` 로 되돌리지 말 것.
- `lv_conf.h` 는 **`LV_USE_FONT_COMPRESSED 1`** 필수(0 이면 글자가 하나도 안 보임), `LV_MEM_CUSTOM 1`, `LV_TICK_CUSTOM 1`, Montserrat 14/16/20 켜기(한글 글꼴의 대체 글꼴로 쓰임).

## 5. 화면 규칙 — **절대 "개선"하지 말 것**

화면은 Waveshare 공장(BSP) 방식으로 구동한다. 아래를 바꾸면 화면이 떨리거나 밀린다(실제로 겪음).

1. `esp_lcd` RGB 패널: **pclk 16MHz**, hsync front/width/back **20/10/10**, vsync front/width/back **10/10/10**, `bounce_buffer_size_px = 480×20`, `num_fbs = 1`(PSRAM), `psram_trans_align = 64`, 데이터 16비트.
2. LVGL 그리기 버퍼는 **내부 RAM 한 장 30줄**(`MALLOC_CAP_INTERNAL`). PSRAM 버퍼에 그리면 화면 버퍼와 PSRAM 을 다퉈 떨린다.
3. **Arduino GFX 는 ST7701 시작 명령을 3선 SPI 로 보낼 때만** 쓴다(`Arduino_SWSPI(.., 42, 2, 1, ..)`). 그림 그리기에 쓰지 않는다. 시작 명령 표 `ST7701_INIT` 는 **공장(BSP 3.0.0) 것**이다(Arduino 데모와 C2·B1·B2 값이 다름 — 데모 값으로 바꾸지 말 것). 데모의 12MHz(약 42Hz)도 떨려 보였다.
4. `custom_sdkconfig`: `CONFIG_LCD_RGB_ISR_IRAM_SAFE=y`, `CONFIG_SPIRAM_XIP_FROM_PSRAM=y`, `CONFIG_ESP32S3_DATA_CACHE_LINE_64B=y`, `CONFIG_COMPILER_OPTIMIZATION_PERF=y`. **`CONFIG_LCD_RGB_RESTART_IN_VSYNC` 는 켜지 않는다**(ESP-IDF 5.5.x 버그 espressif/esp-idf#19070: 완충 버퍼 모드에서 박자가 한 번 어긋나면 화면이 영구히 밀림).
5. LVGL 은 별도 작업(`lvTask`)에서 돈다. 화면 물체나 받은 자료를 건드리는 곳은 `lock()/unlock()`. 백라이트(I2C)도 터치와 같은 선이라 **잠근 채** 쓴다.
6. 화면을 켠 뒤 `heap_caps_malloc_extmem_enable(64)` 로 큰 할당은 PSRAM 먼저(내부 RAM 은 HTTPS 에 남김). 기본 회전 0(USB 단자 왼쪽).
7. **백라이트 값은 거꾸로**: `WS_CH32_IO::setPwm(Wire, v)` 에서 **0 = 가장 밝음, 255 = 꺼짐.** 255 를 쓰면 깜깜해지고 CH32 는 ESP 리셋·굽기로 안 풀린다 → USB(배터리)를 완전히 뽑았다 꽂아야 돌아온다. 테스트로도 255 를 쓰지 말 것(`backlight(false)` 는 밤·주말 자동 끄기 전용).
8. **부저**: USB RTS 로 강제 리셋한 뒤 비프음이 계속된 적이 있다(전원을 완전히 끊어야 멎음). 프로그램에는 부저를 켜는 코드가 없다. **로그만 볼 때 보드를 리셋하지 않는다(`--reset` 금지).**
9. SD 핀 1·2 는 화면 SPI 초기화 핀과 겹친다 → SD 는 화면 초기화 **뒤에만** 사용.
10. 와이파이 받는 동안(1시간마다 20~30초) 화면이 떨릴 수 있고 끝나면 멎는다 — 정상(PSRAM 공유).

## 6. 단계별 진행 (한 단계씩, 각 단계 끝에 완료 기준을 확인)

| 단계 | 할 일 | 완료 기준 |
|---|---|---|
| 0 | 환경 점검: `python --version`, `pip install platformio pyserial`, `pio --version` | 세 명령이 모두 버전을 출력 |
| 1 | 보드를 USB 로 연결, 장치 관리자에서 COM 포트 확인(사용자에게 부탁) | 새 COM 포트가 보인다(VID 303A) |
| 2 | `firmware/include/board_config.h` 의 `← 내 값으로 바꾸기` 줄을 사용자와 함께 채운다(자료 주소, 급식 코드, 위치, 수능 날짜). 모르는 값은 **비워 둔다**(기능이 꺼질 뿐 멈추지 않음) | 파일의 `#define` 이 사용자 값 또는 `""` |
| 3 | `-NoUpload` 로 **빌드만** 먼저(첫 빌드 35~45분, 분리 실행) | `SUCCESS` 와 RAM/Flash 사용률 출력 |
| 4 | 업로드(`-Port` 필요 시) | `Hash of data verified` 가 나오고 보드가 다시 시작 |
| 5 | 화면 확인: 시계 화면이 뜨고 터치로 옆으로 밀면 장이 넘어간다 | 사용자가 "뜬다/움직인다" 확인 |
| 6 | ⑤ 설정에서 사용자가 와이파이 선택·비밀번호 입력(**사용자 본인이 직접**) | 상태에 "시간과 시간표를 받았습니다" |
| 7 | 시간표·선생님 찾기·날씨·급식이 내 학교 값으로 나오는지 사용자와 확인 | 4가지 모두 표시(안 쓰기로 한 것은 제외) |
| 8 | (선택) 글꼴·색·배치 수정은 `src/main.cpp` / `fonts/`, 수정 후 단계 3부터 다시 | 빌드 성공 + 화면 확인 |

### 로그 읽기 (필요할 때만, 시간 제한)
`python tools/serial_log.py --port COMx 20` — 20초만 읽고 끝난다. 읽기 전용(보드를 다시 시작시키지 않음). 무한 대기·`pio device monitor` 상시 실행 금지.
정상 부팅 로그 예: `CH32` 인식, `GT911 at 0x5D (id ...)`, `ready (internal free ..., psram free ...)`, 1분마다 `hb lv=.. flush=.. touch=..`.

## 7. 작업 규칙

- **한 번에 한 단계만.** 단계가 끝나면 결과를 쉬운 말로 알리고 다음으로 간다.
- **같은 빌드 오류가 3번 나오면 멈추고** 오류 원문, 시도한 것, 의심되는 원인을 사용자에게 설명한다(계속 고쳐 보지 않는다).
- **시리얼(COM 포트)은 시간 제한을 두고 읽는다.** 굽는 중에는 열지 않는다. 포트를 연 채 두지 않는다.
- **로그인·열쇠(API 키)·와이파이 비밀번호는 사용자가 직접 입력한다.** 대화나 파일(특히 `board_config.h`, 커밋 대상)에 비밀번호·키를 적지 않는다. 와이파이 비밀번호는 보드 화면에서 입력하고 보드 안(NVS)에만 저장된다.
- 사용자의 실제 보드에 이미 프로그램이 들어 있을 수 있다. 사용자가 "넣어라" 할 때만 업로드한다.
- 개인정보(이름·학교·교실 이름·주소)를 소스 주석이나 커밋 메시지에 새로 쓰지 않는다.
- `firmware/` 만 원본이다. 영문 경로 복사본(`.pio-build\...`)을 직접 고치지 않는다.
- 화면 규칙(5장)을 바꾸려면 먼저 사용자에게 이유를 설명하고 허락을 받는다.

## 8. 코드 안내 (src/main.cpp)

- 화면 5장은 LVGL `tileview`: `P_CLOCK, P_TODAY, P_WEEK, P_FIND, P_SET`. 만드는 함수 `buildClock/Today/Week/Finder/Settings`, 그리는 함수 `renderBand/Duty/Today/Week/Finder/Meal/Weather/Air`.
- 받기: 1시간마다 와이파이를 잠깐 켜서 `index.json` → 시간표(`t/NNN.json`) → 날씨 → 급식 → 미세먼지 → `where.json`. 내려받은 파일은 크기와 JSON 을 확인한 뒤에만 `LittleFS` 의 저장본으로 바꾼다. 실패하면 1·2·5·10분 뒤 다시.
- 비어 있는 설정은 안전하게 꺼진다: 급식 코드 비면 `MEAL_ON=false`, 위치 비면 `WX_ON=false`, 수능 날짜 비면 D-day 숨김, 기본 시간표 이름이 비었거나 목록에 없으면 `parseIndex` 가 첫 시간표를 고른다.
- 점심 시간 12:30~13:30 은 코드에 고정(`"12:30"`, `"13:30"` 검색). 교시 시작은 `BOARD_PERIOD_START`.
- 한글 글꼴: Pretendard SemiBold → `kr14/kr16/kr20`(한글 2,350자 + 기호), 큰 숫자 `num120`(시계), `num44`(온도). 새 글자가 필요하면 `fonts/build_fonts.cjs` 의 범위를 고쳐 다시 만든다.
