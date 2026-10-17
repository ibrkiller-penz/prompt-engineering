// 7B(1024x600) 보드의 IO 확장 칩. 설명은 include/ioexp.h.
// 화면 라이브러리(ESP32_Display_Panel)가 옛 I2C 드라이버를 쓰므로 여기서도 옛 드라이버(driver/i2c.h)를 쓴다.
// 이 파일이 I2C 0번을 먼저 설치하고, 터치는 그것을 같이 쓴다(TOUCH_BUS_SKIP_INIT_HOST 1). Arduino Wire 는 쓰지 않는다(새 드라이버와 섞이면 충돌).
#include "ioexp.h"

#ifndef BOARD_7B
#define BOARD_7B 0
#endif

#if BOARD_7B
#include <Arduino.h>
#include <driver/i2c.h>
#include <driver/gpio.h>

static const i2c_port_t PORT = I2C_NUM_0;
static const uint8_t ADDR = 0x24, REG_MODE = 0x02, REG_OUT = 0x03;
static const int TOUCH_INT = 4;
static uint8_t s_out = 0xFF;   // 출력 값 기억(한 핀만 바꿀 때 나머지 유지). 처음엔 모두 높음 = 공장 데모와 같음
static bool s_ok = false;

static bool wr(uint8_t reg, uint8_t v) {
  uint8_t d[2] = {reg, v};
  return i2c_master_write_to_device(PORT, ADDR, d, 2, pdMS_TO_TICKS(50)) == ESP_OK;
}
static bool probe(uint8_t a) {   // 주소만 불러 본다(데이터는 보내지 않음)
  i2c_cmd_handle_t c = i2c_cmd_link_create();
  i2c_master_start(c);
  i2c_master_write_byte(c, (a << 1) | I2C_MASTER_WRITE, true);
  i2c_master_stop(c);
  esp_err_t e = i2c_master_cmd_begin(PORT, c, pdMS_TO_TICKS(20));
  i2c_cmd_link_delete(c);
  return e == ESP_OK;
}

bool ioexp_begin(void) {
  i2c_config_t cf = {};
  cf.mode = I2C_MODE_MASTER;
  cf.sda_io_num = 8;
  cf.scl_io_num = 9;
  cf.sda_pullup_en = GPIO_PULLUP_ENABLE;
  cf.scl_pullup_en = GPIO_PULLUP_ENABLE;
  cf.master.clk_speed = 400000;
  if (i2c_param_config(PORT, &cf) != ESP_OK || i2c_driver_install(PORT, I2C_MODE_MASTER, 0, 0, 0) != ESP_OK) {
    Serial.println("ioexp: i2c install failed");
    return false;
  }
  String found;
  for (uint8_t a = 0x08; a < 0x78; a++) if (probe(a)) { char b[8]; snprintf(b, sizeof b, " 0x%02x", a); found += b; }
  Serial.printf("i2c scan:%s\n", found.length() ? found.c_str() : " (none)");
  if (!probe(ADDR)) { Serial.println("ioexp: none (0x24 no answer)"); return false; }
  s_ok = wr(REG_MODE, 0xFF) && wr(REG_OUT, s_out);
  Serial.printf("ioexp: 0x24 %s\n", s_ok ? "ok" : "write failed");
  // 터치(GT911) 리셋: 리셋 중 INT 를 낮게 두면 주소가 0x5D 가 된다(Waveshare 08_TOUCH 와 같은 순서·시간)
  gpio_reset_pin((gpio_num_t)TOUCH_INT);
  gpio_set_direction((gpio_num_t)TOUCH_INT, GPIO_MODE_OUTPUT);
  ioexp_set(1, false);
  delay(100);
  gpio_set_level((gpio_num_t)TOUCH_INT, 0);
  delay(100);
  ioexp_set(1, true);
  delay(200);
  gpio_reset_pin((gpio_num_t)TOUCH_INT);   // 다시 입력으로(터치 드라이버가 INT 로 쓴다)
  gpio_set_direction((gpio_num_t)TOUCH_INT, GPIO_MODE_INPUT);
  return s_ok;
}

bool ioexp_set(int exio, bool on) {
  if (exio < 0 || exio > 7) return false;
  uint8_t v = on ? (s_out | (1 << exio)) : (s_out & ~(1 << exio));
  if (!wr(REG_OUT, v)) return false;
  s_out = v;
  return true;
}
bool ioexp_backlight(bool on) { return s_ok && ioexp_set(2, on); }
bool ioexp_ready(void) { return s_ok; }

#else
bool ioexp_begin(void) { return false; }
bool ioexp_set(int, bool) { return false; }
bool ioexp_backlight(bool) { return false; }
bool ioexp_ready(void) { return false; }
#endif
