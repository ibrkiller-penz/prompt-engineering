# 작업지시서: 교실 알림판 만들기 — 7인치 (Waveshare ESP32-S3-Touch-LCD-7)

> **사용자(교사)에게**: 이 파일을 AI 코딩 도우미(Claude Code 등)에 주고 **"이 지시서대로 해 줘"** 라고 하세요.
> 도우미는 아래 단계를 **하나씩** 진행하고, 단계마다 확인 결과를 보여 준 뒤 다음으로 넘어갑니다.
> 로그인·열쇠·비밀번호처럼 **본인 계정이 필요한 일**은 도우미가 대신하지 않고 여러분께 부탁합니다.

> **도우미(Claude)에게**: 아래 2~5장은 사실과 금지 사항이고, 7장이 할 일 순서, 9장이 작업 규칙이다. 사용자는 프로그래머가 아니다.
> 모든 설명은 **쉬운 한국어**로 하고, 전문 용어는 한 줄 풀이를 붙인다.

---

## 1. 목표

교실 칠판 옆에 걸 **시간표·시계 알림판**을 만든다.
- 평소 화면: 오늘 시간표 + 지금 교시 + 큰 시계 + 날씨·미세먼지 + 오늘 급식 + 할 일(급식지도·공강지도·보강·야자 감독)
- 위쪽 탭: **시간표**(주간) · **시계**(기본, 20분 무입력이면 자동) · **찾기**(선생님이 지금 어디 있는지) · **설정**(와이파이·볼 시간표)
- 시간표는 사용자의 **Firebase 무료 호스팅**에서 받아 온다(보드는 1시간마다 와이파이를 잠깐만 켠다). 와이파이 설정은 보드 화면 안에서 한다.
- 끝나면: 내 Firebase 사이트에 시간표가 올라가 있고, 보드가 그 시간표·날씨·급식을 화면에 보여 준다.

## 2. 하드웨어

| 항목 | 내용 |
|---|---|
| 보드 | Waveshare **ESP32-S3-Touch-LCD-7** |
| 화면 | 7인치 **800×480**, RGB 병렬, 컨트롤러 **ST7262**, 정전식 터치 **GT911** |
| 모듈 | ESP32-S3-WROOM-1-N16R8 → **플래시 16MB(QIO) + PSRAM 8MB(OPI)** |
| IO 확장 칩 | **CH422G**(I2C 주소 0x20대). 백라이트·터치 리셋·LCD 리셋을 맡는다 |
| 연결 | 데이터용 USB-C 케이블을 **UART 단자**에 꽂는다(CH343 → Windows COM 포트). 자동 내려받기 회로가 있어 BOOT 버튼 없이 굽는다 |
| 전원 | 5V 2A 이상. USB-C 충전기로는 안 켜질 수 있다 → USB-A 충전기 + A-C 케이블 |
| 와이파이 | **2.4GHz** 만(5GHz 불가), 웹 로그인 화면(포털)이 없는 망 |

핀(이미 `firmware\include\esp_panel_board_custom_conf.h` 에 들어 있다 — 바꾸지 말 것. Waveshare 7인치 설명서·공식 라이브러리와 대조해 확인했다):

| 신호 | GPIO / 확장핀 |
|---|---|
| RGB 데이터 B3~B7 (`DATA0~4`) | 14, 38, 18, 17, 10 |
| RGB 데이터 G2~G7 (`DATA5~10`) | 39, 0, 45, 48, 47, 21 |
| RGB 데이터 R3~R7 (`DATA11~15`) | 1, 2, 42, 41, 40 |
| HSYNC / VSYNC / DE / PCLK | 46 / 3 / 5 / 7 |
| 터치 I2C SDA / SCL / INT | 8 / 9 / 4 (IO 확장 칩과 같은 I2C 버스) |
| 백라이트 | CH422G EXIO2 (켜기/끄기만 된다, 밝기 조절 없음) |
| 터치 리셋 / LCD 리셋 | CH422G EXIO1 / EXIO3 |

## 3. 폴더 구조

```
board-kit\
  common\
    site\                 Firebase 호스팅 뼈대(firebase.json, .firebaserc, public\board\ 샘플 자료)
    tools\                setup.ps1(프로그램 설치) · make_sample_data.mjs(샘플 자료) · data-format.md(자료 형식)
    docs\                 01 Firebase 올리기 · 02 학교 코드·위치 찾기 · 03 자료 형식 안내
  7inch\                  ← 이 프로젝트
    CLAUDE.md             이 문서
    README.md             쉬운 빠른 시작
    firmware\
      platformio.ini      보드 설정 + 화면 흔들림 대책(custom_sdkconfig)  ← 5장
      default_16MB.csv    플래시 구획표(앱 2개 + 저장공간)
      include\            board_config.h(내 값) · esp_panel_board_custom_conf.h(핀·화면 박자) · lv_conf.h · wx_icons.h
      src\                main.cpp(앱 전체) · esp_lv_adapter_arduino.*(화면 연결부) · wx_icons.c(날씨 그림) · fonts\(한글 글꼴 C 파일)
      lib\                ESP32_Display_Panel · ESP32_IO_Expander · esp-lib-utils (Espressif 화면·IO 라이브러리, 라이선스 파일 포함)
      fonts\              build_fonts.cjs · package.json · src\(Pretendard 글꼴·한글 2,350자 목록) — 글꼴을 다시 만들 때만
    tools\
      build_board.ps1     빌드·업로드(영문 경로로 복사해 빌드)
      serial_log.py       보드 기록을 잠깐 읽기(시간 제한)
      reboot_test.py      보드를 여러 번 다시 켜 와이파이 연결 시험
      make_weather_icons.py  날씨 그림 다시 만들기(Pillow)
```

## 4. 빌드 규칙

- **빌드·업로드는 항상 `tools\build_board.ps1`** 로 한다(PlatformIO 를 firmware 폴더에서 직접 돌리지 말 것).
  - 이유: `custom_sdkconfig` 때문에 ESP-IDF 를 다시 컴파일하는데, **경로에 한글·빈칸이 있으면 CMake·링커가 실패**한다.
    스크립트가 `firmware` 를 `%USERPROFILE%\.pio-build\penedu-board-7inch-src` 로 복사해 거기서 빌드한다. 복사본은 고치지 말고 **원본 `firmware` 만 고친다.**
  - `-NoUpload`: 빌드만 · `-Port COM번호`(또는 환경변수 `PIO_PORT`): 업로드 포트 · 둘 다 없으면 USB 시리얼 칩을 자동으로 찾는다.
- **처음 한 번은 25~45분**(약 3GB 받아 7GB 로 풀림). 두 번째부터 1~2분. 첫 빌드는 **끝까지 기다린다**(중간에 끄지 말 것).
- 플랫폼은 **pioarduino**(Arduino-ESP32 3.x). 공식 espressif32 는 Arduino 2.x 라 화면 드라이버가 안 맞는다.
- **LVGL 은 8.3.11 고정**(`lib_deps`), ArduinoJson 7.x. 버전을 올리지 말 것.
- 한글 글꼴(`src\fonts\kr*.c`, `num*.c`)은 만들어 둔 것을 쓴다. 글자(예: 드문 이름 글자)를 더해야 할 때만 `fonts\` 에서 `npm install` → `node build_fonts.cjs`.
- 빌드 결과 끝의 `RAM:`·`Flash:` 줄과 `[SUCCESS]` 를 확인한다. 참고: 첫 부팅 시 RAM 15% 안팎, 플래시 40% 안팎(앱 영역 6.4MB 중).
- 시리얼 도구는 `python tools\serial_log.py 30 --reset --grep sync,download,index,weather,meal` 처럼 **초를 정해서** 읽는다. 포트는 `--port COM번호` 또는 `PIO_PORT`.

## 5. 화면(디스플레이) 규칙 — 손대지 말 것

이 보드의 RGB 화면은 **한 프레임을 PSRAM 에서 읽어 쉬지 않고 화면으로 보낸다.** 그 사이에 와이파이나 플래시 쓰기가 PSRAM 을 막으면 박자가 어긋나
화면이 **지지직거리거나 옆으로 밀린 채 남는다.** 아래는 오랜 시행착오 끝에 정한 최종 값이다. **이유를 이해하기 전에는 바꾸지 말고, 바꾸고 싶으면 사용자에게 먼저 설명하고 허락을 받는다.**

| 항목 | 값 | 이유 |
|---|---|---|
| `custom_sdkconfig` (platformio.ini) | `CONFIG_SPIRAM_XIP_FROM_PSRAM=y` · `CONFIG_SPIRAM_RODATA=y` · `CONFIG_ESP32S3_INSTRUCTION_CACHE_32KB=y` · `CONFIG_ESP32S3_DATA_CACHE_64KB=y` · `CONFIG_ESP32S3_DATA_CACHE_LINE_64B=y` · `CONFIG_FREERTOS_HZ=1000` | Waveshare 공장 예제와 같은 값. 코드·상수를 PSRAM 에서 실행해 플래시 쓰기 중에도 캐시가 안 멈추고, 캐시 크기가 완충(bounce) 버퍼 방식에 맞는다 |
| **넣지 말 것** | `CONFIG_LCD_RGB_RESTART_IN_VSYNC` | ESP-IDF 5.5.x 버그(espressif/esp-idf#19070): 완충 버퍼와 함께 쓰면 EOF 하나만 놓쳐도 화면이 **영구히** 어긋난다(리셋해야 복구) |
| 픽셀 클록 | **16MHz** (`ESP_PANEL_BOARD_LCD_RGB_CLK_HZ`) | 14MHz 로 낮췄더니 더 나빠졌다. 올리지도 낮추지도 말 것 |
| 화면 박자 | HPW 4 · HBP 8 · HFP 8 · VPW 4 · VBP 8 · VFP 8, `PCLK_ACTIVE_NEG`=1 | 공장 값. `PCLK_ACTIVE_NEG`=0 이면 글자가 붉게 보인다 |
| 완충 버퍼 | 가로 폭 × **10줄** (`configRGB_BounceBufferSize(width*10)`) | 공장 예제 값 |
| LVGL 그림판 | **내부 RAM 작은 버퍼(10줄)** + PSRAM 프레임 버퍼 **1장** (`esp_lv_adapter` · `use_psram`) | PSRAM 병목을 줄인다(바뀐 곳만 그린다) |
| 다시 그리기 | **분이 바뀔 때만** 글자를 바꾼다(매초 바꾸지 말 것) | 한 번 그릴 때마다 화면 전체를 PSRAM 에 다시 쓰므로 매초 바꾸면 흔들린다 |
| 와이파이 | 평소 **끄고 1시간마다 잠깐(10~20초)만** 켠다 | 와이파이가 PSRAM 을 같이 쓰면 흔들린다 |
| `heap_caps_malloc_extmem_enable(64)` | **화면 초기화(`initDisplay()`) 뒤에** 호출 | 64바이트 넘는 메모리를 PSRAM 에서 먼저 준다. 화면 물체가 내부 RAM 을 다 쓰면 HTTPS 가 `SSL - Memory allocation failed` 로 실패했다. **앞에 두면 RGB 드라이버 객체가 PSRAM 으로 가서 부팅이 멈춘다** |
| `esp_lcd_rgb_panel_restart` | 쓰지 않는다(`panelResync()` 는 남겨 두기만 함) | 예전 대책이었으나 완충 버퍼 방식에서는 소용없었다 |

**흔들림이 다시 보이면**(순서대로, 한 가지씩 시험하고 사용자에게 사진·영상으로 확인받는다):
1. 보드를 껐다 켠다(전원). 전원이 약하면(USB-C 충전기, 가는 케이블) 그것부터 바꾼다.
2. 와이파이가 오래 켜져 있지 않은지 `serial_log.py` 로 `sync:` 줄을 본다(10~20초 안에 끝나야 한다).
3. 코드에서 매초 글자를 바꾸는 곳이 생기지 않았는지 본다.
4. 그래도 안 되면 **원인과 선택지를 설명하고 멈춘다**(9장 작업 규칙 3번).

## 6. 자료 형식 (보드가 받는 파일)

`BOARD_BASE_URL` + `index.json` / `t/NNN.json` / `where.json`. 자세한 형식은 **`..\common\tools\data-format.md`**.
- 칸 하나 = `[종류, 위 글, 아래 글, 꼬리표]`, 하루 = 7칸, 한 주 = 월~금 5일, 첫 날은 월요일.
- 종류: `n` 수업 · `d` 당겨옴 · `j` 공강지도/보강 · `x` 결강 · `c` 창체 · `e` 시험 · `f` 행사 · `h` 휴일 · `""` 빈칸.
- 샘플 자료: `..\common\tools\make_sample_data.mjs`(가짜 선생님 국어A…, 가짜 학급 1학년1반…).
- 급식(나이스)·날씨·미세먼지(Open-Meteo)는 **보드가 직접** 받는다. `board_config.h` 의 코드·위치가 비어 있으면 그 칸에 "설정 필요"만 보이고 나머지는 정상이다.
- **교시 시작 시각**은 `src\main.cpp` 의 `PERIOD_START[7]` 에 들어 있다(샘플: 08:40, 09:40, 10:40, 11:40, 13:30, 14:40, 15:40). 우리 학교와 다르면 고친다.
  같은 파일의 `"12:30"`·`"13:30"`(점심), `"08:40"`(수업 전), `"16:30"`(수업 끝) 도 함께 확인한다. 고친 뒤 샘플/내 자료의 `periods` 도 맞춘다.

## 7. 단계 — 하나씩, 완료 기준을 통과해야 다음으로

화면 결과는 사용자가 사진으로 확인해 준다.

| 단계 | 할 일 | 완료 기준 |
|---|---|---|
| 0 | **환경 확인.** 작업 폴더에 한글·빈칸이 있으면 먼저 알린다(빌드는 스크립트가 해결하지만 영문 폴더를 권한다). `common\tools\setup.ps1` 실행 | 확인표에 필수 항목(Git·Python·Node·PlatformIO·esptool·Firebase CLI)이 모두 O |
| 1 | **Firebase 프로젝트·로그인.** `common\docs\01_Firebase_호스팅_올리기.md` 1~3단계. `firebase login` 은 **사용자가 직접** | `firebase login:list` 에 사용자 계정이 보인다 |
| 2 | **샘플 자료 만들기.** `node common\tools\make_sample_data.mjs` | 18개 파일(`t\001~018.json`)과 `index.json`·`where.json` 이 생긴다 |
| 3 | **올리기.** `site\.firebaserc`·`firebase.json` 의 YOUR-… 를 사용자의 ID 로 바꾸고 `firebase deploy --only hosting --project <ID>` | 브라우저에서 `https://<ID>.web.app/board/index.json` 이 열리고 `items` 가 보인다 |
| 4 | **내 값 넣기.** `firmware\include\board_config.h`: `BOARD_BASE_URL`(필수), 나머지는 사용자가 원하면(`common\docs\02_…`). 값을 **사용자에게 물어서** 넣는다 | `YOUR-SITE-ID` 가 남아 있지 않다. 한글 등 따옴표가 깨지지 않았다 |
| 5 | **첫 빌드(업로드 없이).** `tools\build_board.ps1 -NoUpload` — 25~45분, 끝까지 기다린다 | `[SUCCESS]`, RAM·Flash 사용량 줄 |
| 6 | **보드 연결 확인.** UART 단자에 꽂고 COM 번호 확인(`python -m esptool --port COM번호 flash-id` 는 **연결 확인용 읽기만**). 칩 정보를 확인한다 | `ESP32-S3`, 플래시 16MB, PSRAM 8MB 가 보인다 |
| 7 | **업로드.** `tools\build_board.ps1 -Port COM번호` | `Hard resetting via RTS pin...` |
| 8 | **화면 확인.** 사용자가 사진으로 | 한글이 깨지지 않는다 · 오른쪽이 잘리지 않는다 · 흔들리지 않는다 · [설정] 화면이 열린다 |
| 9 | **와이파이.** 사용자가 보드 [설정] → [찾기] 에서 와이파이를 고르고 비밀번호를 **직접** 입력(도우미에게 비밀번호를 알리지 않는다) | `serial_log.py 40 --reset --grep sync,download,index` 에 `sync: ok` 와 `download … -> 200` 이 보인다 |
| 10 | **재부팅 시험.** `python tools\reboot_test.py 3` | `성공 3/3` |
| 11 | **내 시간표로 바꾸기.** 사용자의 실제 시간표(엑셀·표)를 `data-format.md` 모양으로 만들어 `site\public\board\` 에 넣고 다시 올린다. `BOARD_DEFAULT_TT` 를 목록의 `name` 과 같게. 만든 파일은 **검사**한다(월요일로 시작·하루 7칸·`index.json` 의 파일이 모두 존재·JSON 문법) | 보드 [설정]의 '볼 시간표'에 내 이름이 나오고, 시계 화면에 내 시간표가 보인다 |
| 12 | **(선택)** 교시 시각·급식·날씨·수능 값 맞추기, 매일 자동 갱신(GitHub Actions 등) | 사용자가 정한 대로 |

각 단계가 끝날 때마다 **무엇을 했고 무엇을 확인했는지** 짧게 보고한다.

## 8. 자주 막히는 곳 (실제로 겪은 것)

| 증상 | 원인 | 해결 |
|---|---|---|
| 빌드가 `CMake Error` · `cannot open map file` | 프로젝트 경로에 **한글·빈칸** | `tools\build_board.ps1` 로 빌드(영문 경로로 복사해 빌드한다) |
| `No serial data received` | 보드의 다른 USB 단자에 꽂음 / 충전 전용 케이블 | **UART** 단자 + 데이터용 케이블 |
| `Could not open COMx, the port is busy` | 다른 창이 시리얼을 잡고 있음 / 보드가 빠짐 | 시리얼 창 닫기, 케이블 확인 |
| 월~목만 보이고 금요일이 잘림 | 해상도 설정 불일치 | 7인치는 `ESP_PANEL_USE_1024_600_LCD=0`(800×480) |
| 화면이 지지직·옆으로 밀림 | 5장 참고 | 5장 순서대로. **픽셀 클록을 낮추지 말 것**(더 나빠진다) |
| USB-C 충전기로는 안 켜짐 | 충전기 전력 협상 | USB-A 충전기 + A-C 케이블, 5V 2A 이상 |
| 화면에 `설정 필요` | `board_config.h` 값이 비어 있음 | 정상. 필요하면 값을 넣는다 |
| 시간표를 받지 못함(`download … -> -1` 또는 404) | 주소 오타 · 아직 안 올림 · 와이파이 | 브라우저로 `…/board/index.json` 이 열리는지 먼저 확인 |
| PowerShell 스크립트 한글이 깨짐 | `.ps1` 이 BOM 없는 UTF-8 | **UTF-8 BOM** 으로 저장 |
| `firebase projects:create` 실패 | 표시 이름에 한글 · 이미 있는 ID | 영문 이름, 숫자를 붙인 ID |

## 9. 작업 규칙 (도우미가 지킬 것)

1. **한 번에 한 단계.** 단계마다 완료 기준을 실제로 돌려 보고 결과를 보여 준 뒤 다음으로 간다.
2. **로그인·비밀번호·API 키·서비스 계정 열쇠·와이파이 비밀번호는 사용자가 직접** 입력·등록하게 한다. 명령만 알려 주고 기다린다. 사용자에게 비밀 값을 붙여 넣어 달라고 하지 않는다. 비밀 값을 파일·로그·커밋에 쓰지 않는다.
3. **빌드 오류는 스스로 고쳐 보되, 같은 오류가 3번** 나면 원인과 선택지를 설명하고 **멈춘다.**
4. **시리얼은 항상 시간 제한**을 둔다(`serial_log.py 30` 처럼). 무한 대기(`monitor` 를 그냥 켜 두기) 금지.
5. **화면 설정(5장)은 바꾸지 않는다.** 바꿔야 할 것 같으면 이유와 위험을 설명하고 사용자의 허락을 받는다.
6. **보드를 지우거나 다른 펌웨어를 덮어쓰는 명령**(`erase_flash` 등)은 사용자에게 먼저 묻는다. 업로드는 사용자가 보드를 연결했다고 말한 뒤에만 한다.
7. 새 기능을 넣기 전에 이 문서와 `common\tools\data-format.md` 를 읽는다. 단계가 끝날 때마다 git 커밋(이미 저장소를 쓰는 경우).
   `node_modules`, `.pio`, `sdkconfig*`, 열쇠(`*.json` 서비스 계정), 학생 명단 원본은 **커밋하지 않는다.**
8. 설명은 **쉬운 한국어**로, 전문 용어는 한 줄 풀이를 붙인다. 사용자에게 보여 주는 화면 글은 한글 2,350자(KS X 1001) 안의 글자만 쓴다(그 밖의 글자는 화면에 빈 칸으로 보인다).
9. 학생·교사 **실명 등 개인정보**는 Firebase 호스팅(공개 주소)에 올리지 않는 쪽을 권한다. 올려야 하면 사용자에게 위험을 설명하고 허락을 받는다.
