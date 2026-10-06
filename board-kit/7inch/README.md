# 교실 알림판 키트 — 7인치 (Waveshare ESP32-S3-Touch-LCD-7)

교실 칠판 옆에 걸어 두는 **시간표·시계 알림판**을 직접 만드는 키트입니다.
오늘 시간표, 지금 교시, 큰 시계, 날씨·미세먼지, 오늘 급식, 선생님 찾기가 7인치 터치 화면(800×480)에 뜹니다.
시간표는 내 Firebase 무료 사이트에서 1시간마다 받아 옵니다. 코딩 경험이 없어도 **AI 코딩 도우미(Claude Code 등)에게 이 폴더의 `CLAUDE.md` 를 주고** 따라 하면 됩니다.

## 준비물
| 준비물 | 비고 |
|---|---|
| 보드 | Waveshare **ESP32-S3-Touch-LCD-7** (7인치, 800×480) 1개 |
| USB-C 케이블 | **데이터용**(충전 전용은 안 됨). 보드의 **UART** 단자에 꽂는다 |
| 전원 | 5V 2A 이상 USB 충전기 (USB-C 충전기로는 안 켜질 수 있다 → USB-A 충전기 + A-C 케이블) |
| PC | Windows 10/11, C: 여유 **15GB 이상** |
| 계정 | Google 계정(Firebase 무료 사이트용) |
| 와이파이 | **2.4GHz**, 웹 로그인 화면이 없는 것(보드는 5GHz 를 못 잡는다) |

## 폴더
```
board-kit\
  common\     두 크기(7인치·4인치) 공통: site\(Firebase 사이트) · tools\(설치·샘플자료) · docs\(안내)
  7inch\      이 폴더 — firmware\(보드 프로그램) · tools\(빌드·기록 도구) · README.md · CLAUDE.md
```

## 빠른 시작 (처음 한 번)
1. **폴더 위치**: 이 키트를 `C:\dev\board-kit` 처럼 **영문 폴더**에 풉니다(권장).
2. **도구 설치**: `common\tools\setup.ps1` 을 PowerShell 로 실행 → 끝의 확인표에서 X 가 없을 때까지(두 번 돌려도 됨).
   `powershell -NoProfile -ExecutionPolicy Bypass -File common\tools\setup.ps1`
3. **로그인**(본인이 직접): `firebase login`
4. **샘플 자료 올리기**: `common\docs\01_Firebase_호스팅_올리기.md` 를 따라 합니다. 끝나면 `https://<내사이트ID>.web.app/board/index.json` 이 열립니다.
5. **내 값 넣기**: `7inch\firmware\include\board_config.h` 의 `← 내 값으로 바꾸기` 줄을 고칩니다.
   - 꼭 바꿀 것: `BOARD_BASE_URL`(내 사이트 주소). 나머지(학교 코드·위치·수능)는 비워 두어도 됩니다 → `common\docs\02_학교코드와_위치_찾기.md`
6. **빌드**(보드 없이도 됨): `7inch` 폴더에서
   `powershell -NoProfile -ExecutionPolicy Bypass -File tools\build_board.ps1 -NoUpload`
   - **처음 한 번은 25~45분**(ESP32 도구를 받아 화면 흔들림 방지 설정으로 다시 컴파일). 두 번째부터 1~2분.
   - 끝에 `[SUCCESS]` 가 나오면 성공입니다.
7. **보드에 올리기**: 보드를 UART 단자로 연결하고(장치 관리자의 COM 번호 확인)
   `powershell -NoProfile -ExecutionPolicy Bypass -File tools\build_board.ps1 -Port COM5`  (← 내 번호)
8. **와이파이 연결**: 보드 화면 위쪽 **[설정] → [찾기]** → 와이파이 고르기 → 비밀번호. 잠시 뒤 시간표가 뜹니다.

## 완료 확인
- [ ] 한글이 깨지지 않고, 오른쪽이 잘리지 않는다
- [ ] [시계] 화면에 시계·오늘 시간표가 보인다(샘플은 `국어A 선생님`)
- [ ] 와이파이를 연결하면 위쪽에 `받음` 이 보인다
- [ ] 재부팅해도 와이파이가 붙는다: `python tools\reboot_test.py 3` → `성공 3/3`

## 이 키트에서 바꾸면 안 되는 것 (화면 흔들림 대책)
이 보드의 RGB 화면은 메모리(PSRAM)를 와이파이·플래시 쓰기와 나눠 쓰기 때문에 설정을 잘못 건드리면 **화면이 지지직거리거나 옆으로 밀립니다.**
힘들게 찾은 값이니 `firmware\platformio.ini` 의 `custom_sdkconfig`, `include\esp_panel_board_custom_conf.h` 의 화면 박자(16MHz 픽셀 클록 등), `src\main.cpp` 의 `initDisplay()` 는 **그대로 두세요.** 이유와 목록은 `CLAUDE.md` 5장.

## 자주 막히는 곳
| 증상 | 해결 |
|---|---|
| 빌드가 `CMake Error` / `cannot open map file` | 한글·빈칸 경로 문제. 반드시 `tools\build_board.ps1` 로 빌드(영문 경로로 복사해서 빌드한다) |
| `No serial data received` / 보드 응답 없음 | USB 케이블을 **UART** 단자로 옮긴다 · 데이터용 케이블인지 확인 |
| `port is busy` | 다른 프로그램이 COM 포트를 잡고 있음 → 닫기 |
| 보드가 안 켜짐 | USB-A 충전기 + A-C 케이블, 5V 2A 이상 |
| 화면에 "설정 필요"가 보임 | `board_config.h` 에서 비워 둔 값(급식·위치). 나머지 기능은 정상 |
| 시간표 주소 설정 필요 | `BOARD_BASE_URL` 의 `YOUR-SITE-ID` 를 내 사이트 ID 로 |

자료 형식을 알고 싶으면 `common\tools\data-format.md`, AI 도우미용 지시서는 `CLAUDE.md` 입니다.

> 이 키트의 화면 글꼴은 Pretendard(SIL OFL), 화면 라이브러리는 LVGL(MIT)·Espressif ESP32_Display_Panel 등(Apache-2.0)입니다. 각 라이선스 파일이 `firmware\fonts\src`, `firmware\lib\*` 에 들어 있습니다.
