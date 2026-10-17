#pragma once
// 7B(1024x600) 보드의 IO 확장 칩 (I2C 0x24, Waveshare 'IO EXTENSION' — 레지스터 방식: 방향 0x02, 출력 0x03, PWM 0x05)
// 근거: waveshareteam/ESP32-S3-Touch-LCD-7B examples/Arduino/08_TOUCH (io_extension.cpp, gt911.cpp)
//   EXIO1 터치 리셋 · EXIO2 백라이트(DISP) · EXIO4 SD_CS · EXIO5 USB/CAN 선택 · EXIO6 LCD_VDD_EN
// 800x480 보드(CH422G)는 화면 라이브러리가 확장 칩을 맡으므로 이 파일을 쓰지 않는다(BOARD_7B=0 이면 함수가 비어 있다).
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

bool ioexp_begin(void);            // I2C 0번(SDA8/SCL9) 설치 → 주소 훑기(기록) → 모두 출력·높음 → 터치 리셋. 확장 칩이 없으면 false
bool ioexp_set(int exio, bool on); // 핀 하나만 바꾼다(나머지는 그대로)
bool ioexp_backlight(bool on);     // EXIO2
bool ioexp_ready(void);

#ifdef __cplusplus
}
#endif
