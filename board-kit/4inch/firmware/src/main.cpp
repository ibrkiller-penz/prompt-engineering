// 교실 알림판 — Waveshare ESP32-S3-Touch-LCD-4 V4.0 (4인치 480x480)
// 자료(board/index.json, t/NNN.json, where.json)는 BOARD_BASE_URL(include/board_config.h) 에서 받는다(7인치 키트와 같은 형식).
// 화면은 옆으로 밀어 넘기는 여섯 장: 시계(기본) · 오늘 시간표 · 주간 시간표 · 단축키 · 선생님 찾기 · 설정
// 볼 시간표에서 교장·교감을 고르면 교장실 모드(시계 장 = 학교 일정, 주간 장 = 학교 일정 목록).
// 내 값(주소·급식·날씨 위치 등)은 include/board_config.h 에서만 바꾼다. 색은 따뜻한 어두운 테마(D_*, 7인치 UI_SOFT 와 같다).
#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <NetworkClientSecure.h>
#include <Preferences.h>
#include <LittleFS.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <esp_heap_caps.h>
#include <esp_sntp.h>
#include <lvgl.h>
#include <esp_lcd_panel_rgb.h>
#include <esp_lcd_panel_ops.h>
#include <time.h>
#include <math.h>
#include "Arduino_GFX_Library.h"
#include "TouchDrvGT911.hpp"
#include "WS_CH32_IO.h"
#include "wx_icons.h"
#include "board_config.h"   // 보드(사람)마다 바꾸는 값

LV_FONT_DECLARE(kr14);
LV_FONT_DECLARE(kr16);
LV_FONT_DECLARE(kr20);
LV_FONT_DECLARE(num120);
LV_FONT_DECLARE(num44);

static const char *FW_VERSION = "0.1.0";
static const char *BASE_URL = BOARD_BASE_URL;
static const int W = 480, H = 480;
static const char *PERIOD_START[7] = BOARD_PERIOD_START;   // board_config.h
static const char *DOW[5] = {"월", "화", "수", "목", "금"};

// ── 색 ──
#define C_PRIMARY 0xdc2626
#define C_TEXT 0x2a2320
#define C_MUTED 0x5c5048
#define D_BG 0x1c1714
#define D_PANEL 0x26201c
#define D_ROW 0x342c26
#define D_LINE 0x4a4038
#define D_TEXT 0xfaf5ee
#define D_SUB 0xe2d8cc
#define D_MUTED 0xb8ab9c
#define D_RED 0xb91c1c
#define D_NOW 0xfff4e0     // 지금 교시 줄·칸(크림). 그 위 글자는 C_TEXT/C_MUTED(어두운 갈색)
#define NOW_ROW D_NOW
#define NOW_TAG 0xfbbf24   // 지금 교시 표지(호박색)
#define NOW_TX 0x2a2320
#define NEXT_BD 0xfacc15   // 다음 수업 테두리

struct CellStyle { uint32_t border; };
static CellStyle styleOf(char t) {   // 종류 색은 테두리로만(어두운 바탕)
  switch (t) {
    case 'n': return {0x34d399};
    case 'd': return {0xfb923c};
    case 'j': return {0x818cf8};
    case 'x': return {0xf87171};
    case 'c': return {0xa78bfa};
    case 'e': return {0xf472b6};
    case 'f': return {0x38bdf8};
    case 'h': return {0xf87171};
    default: return {D_LINE};
  }
}

// ── PSRAM 에 JSON 을 둔다 ──
struct SpiRamAllocator : ArduinoJson::Allocator {
  void *allocate(size_t n) override { return heap_caps_malloc(n, MALLOC_CAP_SPIRAM); }
  void deallocate(void *p) override { heap_caps_free(p); }
  void *reallocate(void *p, size_t n) override { return heap_caps_realloc(p, n, MALLOC_CAP_SPIRAM); }
};
static SpiRamAllocator s_alloc;
static JsonDocument s_tt(&s_alloc);
static bool s_ttLoaded = false;
static int s_week = -1;
static String s_ttFile = "tt-1.json";
static String s_ttName = "";
static Preferences s_prefs;
constexpr bool cfgSet(const char *s) { return s && s[0]; }
static constexpr bool HAS_SCHED = cfgSet(SCHEDULE_URL);   // 학교 일정 주소가 있나
static bool urlUnset() { return strstr(BASE_URL, "YOUR-SITE-ID") != nullptr || strstr(BASE_URL, "example.invalid") != nullptr; }
static bool s_principal = false;       // 볼 시간표가 '@교장'·'@교감' 이면 교장실 모드
static JsonDocument s_sched(&s_alloc); // {"items":[[시작,끝,시간,제목,장소,부서,담당,내용]..],"acad":[[날짜,이름,종류]..]}
static time_t s_lastOkT = 0;           // 마지막으로 성공한 때(prefs "lastok" — 껐다 켜도 남는다)
static int s_ttCode = 0;               // 마지막 시간표 받기의 HTTP 코드
static void setTextIf(lv_obj_t *o, const char *t) { if (o && strcmp(lv_label_get_text(o), t)) lv_label_set_text(o, t); }   // 같은 글이면 다시 그리지 않는다

// ── 화면 장치: ESP-IDF RGB 드라이버(공장 프로그램과 같은 방식) + GT911 터치 + CH32(백라이트·리셋) ──
// 화면 칩(ST7701) 초기화 명령만 Arduino GFX 의 3선 SPI(st7701_type1_init_operations)로 보내고,
// 그림은 ESP-IDF 의 esp_lcd RGB 패널로 바로 보낸다. 박자·완충 버퍼는 Waveshare BSP 3.0.0(공장 프로그램)과 같다.
// (Arduino GFX 로 그리면 LVGL 버퍼·화면 버퍼가 모두 PSRAM 이라 PSRAM 이 바빠져 화면이 떨렸다)
static Arduino_DataBus *s_bus = new Arduino_SWSPI(GFX_NOT_DEFINED /* DC */, 42 /* CS */, 2 /* SCK */, 1 /* MOSI */, GFX_NOT_DEFINED);
static esp_lcd_panel_handle_t s_panel = nullptr;
// ── 화면 밀림 대처(Espressif ESP-FAQ(LCD) 'RGB 화면 전체가 밀리는 drift') ──
// · 와이파이 연결·찾기 동안은 PSRAM 이 바빠 박자가 어긋난다 → 그동안 PCLK 를 6MHz 로 낮추고 한 장(약 20ms) 기다린다.
// · 끝나면 16MHz 로 되돌리고 esp_lcd_rgb_panel_restart() 로 박자를 다시 맞춘다(영구 밀림 방지).
// · 그래도 밀릴 수 있으니 1분마다 한 번 다시 맞춘다(loop).
static const uint32_t PCLK_HZ = 16 * 1000 * 1000, PCLK_SLOW_HZ = 6 * 1000 * 1000;
static void lcdSlow(bool slow) {
  if (!s_panel) return;
  esp_lcd_rgb_panel_set_pclk(s_panel, slow ? PCLK_SLOW_HZ : PCLK_HZ);
  delay(slow ? 40 : 25);
  if (!slow) esp_lcd_rgb_panel_restart(s_panel);
}
static void lcdResync() { if (s_panel) esp_lcd_rgb_panel_restart(s_panel); }
// 화면 칩(ST7701) 초기화 명령 — Waveshare BSP 3.0.0(공장 프로그램) esp32_s3_touch_lcd_4.c 의 lcd_init_cmds 그대로.
// Arduino 데모(st7701_type1)와 C2(줄 타이밍)·B1·B2 값이 달라, 공장 박자(16MHz)와 함께 쓰면 화면이 밀렸다.
struct InitCmd { uint8_t cmd; uint8_t len; uint8_t data[16]; uint16_t delayMs; };
static const InitCmd ST7701_INIT[] = {
  {0x11, 0, {}, 120},
  {0xFF, 5, {0x77, 0x01, 0x00, 0x00, 0x10}, 0},
  {0xC0, 2, {0x3B, 0x00}, 0},
  {0xC1, 2, {0x0D, 0x02}, 0},
  {0xC2, 2, {0x21, 0x08}, 0},
  {0xCD, 1, {0x08}, 0},
  {0xB0, 16, {0x00, 0x11, 0x18, 0x0E, 0x11, 0x06, 0x07, 0x08, 0x07, 0x22, 0x04, 0x12, 0x0F, 0xAA, 0x31, 0x18}, 0},
  {0xB1, 16, {0x00, 0x11, 0x19, 0x0E, 0x12, 0x07, 0x08, 0x08, 0x08, 0x22, 0x04, 0x11, 0x11, 0xA9, 0x32, 0x18}, 0},
  {0xFF, 5, {0x77, 0x01, 0x00, 0x00, 0x11}, 0},
  {0xB0, 1, {0x60}, 0},
  {0xB1, 1, {0x30}, 0},
  {0xB2, 1, {0x87}, 0},
  {0xB3, 1, {0x80}, 0},
  {0xB5, 1, {0x49}, 0},
  {0xB7, 1, {0x85}, 0},
  {0xB8, 1, {0x21}, 0},
  {0xC1, 1, {0x78}, 0},
  {0xC2, 1, {0x78}, 20},
  {0xE0, 3, {0x00, 0x1B, 0x02}, 0},
  {0xE1, 11, {0x08, 0xA0, 0x00, 0x00, 0x07, 0xA0, 0x00, 0x00, 0x00, 0x44, 0x44}, 0},
  {0xE2, 12, {0x11, 0x11, 0x44, 0x44, 0xED, 0xA0, 0x00, 0x00, 0xEC, 0xA0, 0x00, 0x00}, 0},
  {0xE3, 4, {0x00, 0x00, 0x11, 0x11}, 0},
  {0xE4, 2, {0x44, 0x44}, 0},
  {0xE5, 16, {0x0A, 0xE9, 0xD8, 0xA0, 0x0C, 0xEB, 0xD8, 0xA0, 0x0E, 0xED, 0xD8, 0xA0, 0x10, 0xEF, 0xD8, 0xA0}, 0},
  {0xE6, 4, {0x00, 0x00, 0x11, 0x11}, 0},
  {0xE7, 2, {0x44, 0x44}, 0},
  {0xE8, 16, {0x09, 0xE8, 0xD8, 0xA0, 0x0B, 0xEA, 0xD8, 0xA0, 0x0D, 0xEC, 0xD8, 0xA0, 0x0F, 0xEE, 0xD8, 0xA0}, 0},
  {0xEB, 7, {0x02, 0x00, 0xE4, 0xE4, 0x88, 0x00, 0x40}, 0},
  {0xEC, 2, {0x3C, 0x00}, 0},
  {0xED, 16, {0xAB, 0x89, 0x76, 0x54, 0x02, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0x20, 0x45, 0x67, 0x98, 0xBA}, 0},
  {0xFF, 5, {0x77, 0x01, 0x00, 0x00, 0x00}, 0},
  {0x36, 1, {0x00}, 0},
  {0x3A, 1, {0x66}, 0},
  {0x21, 0, {}, 120},
  {0x29, 0, {}, 0},
};
static void sendSt7701Init() {
  for (const InitCmd &c : ST7701_INIT) {
    s_bus->beginWrite();
    s_bus->writeCommand(c.cmd);
    for (int i = 0; i < c.len; i++) s_bus->write(c.data[i]);
    s_bus->endWrite();
    if (c.delayMs) delay(c.delayMs);
  }
}
static TouchDrvGT911 s_touch;
static bool s_touchOk = false;
static SemaphoreHandle_t s_lvMutex;
static void lock() { xSemaphoreTakeRecursive(s_lvMutex, portMAX_DELAY); }
static void unlock() { xSemaphoreGiveRecursive(s_lvMutex); }
// 받은 자료를 바꾸는 일은 화면이 읽는 도중이 아니게 잠근 채로 한다(받는 일은 잠그지 않는다)
template <class F> static bool locked(F f) { lock(); bool r = f(); unlock(); return r; }

static volatile uint32_t s_flushes = 0, s_touches = 0, s_lvLoops = 0, s_reads = 0;   // 상태 기록용
static void dispFlush(lv_disp_drv_t *d, const lv_area_t *a, lv_color_t *px) {
  s_flushes++;
  esp_lcd_panel_draw_bitmap(s_panel, a->x1, a->y1, a->x2 + 1, a->y2 + 1, px);   // 화면 버퍼로 한 번에 복사
  lv_disp_flush_ready(d);
}
// 화면 불 상태: touchRead 가 꺼진 화면의 첫 터치를 삼키려고 앞에서 선언한다(정의는 아래 backlight())
static bool s_blOff = false;
static void backlight(bool on);
static void touchRead(lv_indev_drv_t *, lv_indev_data_t *data) {
  int16_t x[1], y[1];
  static bool swallow = false;   // 꺼진 화면을 깨운 손가락은 뗄 때까지 단추로 보내지 않는다(어두운 화면에서 단축키가 눌리지 않게)
  s_reads++;
  if (s_touchOk && s_touch.getPoint(x, y, 1) > 0) {
    if (s_blOff) {               // 불이 꺼져 있었다 → 켜고 이 터치는 삼킨다(lvTask 가 lock 을 쥔 채 부른다. I2C 는 터치와 같은 줄)
      s_blOff = false; backlight(true); lv_disp_trig_activity(NULL); swallow = true;
      Serial.printf("backlight on (touch)\n");
    }
    if (swallow) { data->state = LV_INDEV_STATE_REL; return; }
    data->state = LV_INDEV_STATE_PR;
    data->point.x = x[0]; data->point.y = y[0];
    if (s_touches++ % 10 == 0) Serial.printf("touch %d,%d\n", x[0], y[0]);
  } else { swallow = false; data->state = LV_INDEV_STATE_REL; }
}
// LVGL 은 따로 돈다(받는 동안에도 화면·터치가 멈추지 않게). 화면 물체를 만지는 곳은 모두 lock()/unlock().
static void lvTask(void *) {
  for (;;) { lock(); lv_timer_handler(); unlock(); s_lvLoops++; vTaskDelay(pdMS_TO_TICKS(5)); }
}
static void initDisplay() {
  if (!WS_CH32_IO::begin(Wire, WS_CH32_IO::DEFAULT_I2C_SDA, WS_CH32_IO::DEFAULT_I2C_SCL, WS_CH32_IO::DEFAULT_I2C_FREQ, &Serial))
    Serial.println("CH32 init failed");
  // GT911 주소는 0x5D 또는 0x14 (리셋 순서에 따라). 둘 다 본다.
  for (uint8_t addr : {GT911_SLAVE_ADDRESS_L, GT911_SLAVE_ADDRESS_H}) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      s_touch.setPins(-1, -1);
      s_touchOk = s_touch.begin(Wire, addr, WS_CH32_IO::DEFAULT_I2C_SDA, WS_CH32_IO::DEFAULT_I2C_SCL);
      // 칩 설정(최대 손가락 수 등)은 쓰지 않는다 — Waveshare BSP 3.0.0 도 읽기만 한다
      if (s_touchOk) Serial.printf("GT911 at 0x%02X (id %lu)\n", addr, (unsigned long)s_touch.getChipID());
      break;
    }
  }
  if (!s_touchOk) Serial.println("GT911 not found");
  // 화면 칩 초기화(3선 SPI): 소프트 리셋 → 공장(BSP) 명령
  s_bus->begin();
  s_bus->sendCommand(0x01);
  delay(120);
  sendSt7701Init();   // 공장 명령(위 표)
  // RGB 패널: 16MHz, hsync 앞20·폭10·뒤10, vsync 앞10·폭10·뒤10(약 60Hz), 완충 버퍼 20줄(내부 RAM), 화면 버퍼 1장(PSRAM)
  esp_lcd_rgb_panel_config_t pc = {};
  pc.clk_src = LCD_CLK_SRC_DEFAULT;
  pc.timings.pclk_hz = PCLK_HZ;
  pc.timings.h_res = W; pc.timings.v_res = H;
  pc.timings.hsync_pulse_width = 10; pc.timings.hsync_back_porch = 10; pc.timings.hsync_front_porch = 20;
  pc.timings.vsync_pulse_width = 10; pc.timings.vsync_back_porch = 10; pc.timings.vsync_front_porch = 10;
  pc.data_width = 16;
  pc.bits_per_pixel = 16;
  pc.num_fbs = 1;
  pc.bounce_buffer_size_px = W * 30;   // ESP-FAQ: 클수록 밀림이 덜하다(내부 RAM 2×28KB). 480×480/(480×30)=16 → 짝수 조건 맞음
  pc.psram_trans_align = 64;
  pc.hsync_gpio_num = 38; pc.vsync_gpio_num = 39; pc.de_gpio_num = 40; pc.pclk_gpio_num = 41; pc.disp_gpio_num = -1;
  const int data[16] = {5, 45, 48, 47, 21 /* B0~B4 */, 14, 13, 12, 11, 10, 9 /* G0~G5 */, 46, 3, 8, 18, 17 /* R0~R4 */};
  for (int i = 0; i < 16; i++) pc.data_gpio_nums[i] = data[i];
  pc.flags.fb_in_psram = 1;
  ESP_ERROR_CHECK(esp_lcd_new_rgb_panel(&pc, &s_panel));
  ESP_ERROR_CHECK(esp_lcd_panel_reset(s_panel));
  ESP_ERROR_CHECK(esp_lcd_panel_init(s_panel));
  WS_CH32_IO::setPwm(Wire, 0);   // 화면 불 켜기 — 이 보드는 거꾸로다(0 = 가장 밝음, 255 = 꺼짐. Waveshare BSP 3.0.0)

  lv_init();
  // 그리기 버퍼는 내부 RAM 한 장(가로 10줄). PSRAM 에서 그리면 화면 버퍼와 다투어 떨린다.
  // 나머지 내부 RAM 은 HTTPS(TLS)에 남긴다(켠 뒤 약 110KB 를 목표).
  static lv_disp_draw_buf_t buf;
  const size_t n = W * 10;   // 10줄 — 내부 RAM 을 완충 버퍼·와이파이에 남긴다
  lv_color_t *b1 = (lv_color_t *)heap_caps_malloc(n * sizeof(lv_color_t), MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT);
  lv_disp_draw_buf_init(&buf, b1, nullptr, n);
  static lv_disp_drv_t dd;
  lv_disp_drv_init(&dd);
  dd.hor_res = W; dd.ver_res = H; dd.flush_cb = dispFlush; dd.draw_buf = &buf;
  lv_disp_drv_register(&dd);
  static lv_indev_drv_t id;
  lv_indev_drv_init(&id);
  id.type = LV_INDEV_TYPE_POINTER; id.read_cb = touchRead;
  lv_indev_drv_register(&id);
}
static void backlight(bool on) { WS_CH32_IO::setPwm(Wire, on ? 0 : 255); }   // 0 = 켜짐(가장 밝음), 255 = 꺼짐
// 배터리 전압(mV). CH32 ADC(레지스터 0x06, 2바이트 작은 끝, 10비트 · 3:1 분압 = raw*3*3.3/1023 V). 못 읽으면 -1
// Wire 는 터치와 같은 줄이라 한 번 읽을 때마다 lock() 으로 터치 읽기와 겹치지 않게 한다(loop 맨 위에서만 부를 것).
static int batteryMv() {
  uint32_t sum = 0; int n = 0;
  for (int i = 0; i < 8; i++) {
    uint16_t raw = 0;
    lock(); const bool ok = WS_CH32_IO::readAdcRaw(Wire, &raw); unlock();
    if (ok && raw <= 1023) { sum += raw; n++; }
    delay(5);
  }
  if (!n) return -1;
  return (int)((sum / (float)n) * 3.0f * 3.3f / 1023.0f * 1000.0f + 0.5f);
}
// 리튬 배터리 전압 → 남은 양(%) 어림값(3.3V 0% ~ 4.2V 100%)
static int batteryPct(int mv) {
  static const int V[] = {3300, 3500, 3600, 3700, 3800, 3900, 4000, 4100, 4200}, P[] = {0, 10, 20, 40, 60, 75, 85, 95, 100};
  if (mv <= V[0]) return 0;
  for (int i = 1; i < 9; i++) if (mv <= V[i]) return P[i - 1] + (P[i] - P[i - 1]) * (mv - V[i - 1]) / (V[i] - V[i - 1]);
  return 100;
}

// ── 작은 도우미 ──
static lv_obj_t *label(lv_obj_t *parent, const lv_font_t *font, uint32_t color, const char *txt) {
  lv_obj_t *l = lv_label_create(parent);
  lv_obj_set_style_text_font(l, font, 0);
  lv_obj_set_style_text_color(l, lv_color_hex(color), 0);
  lv_label_set_text(l, txt);
  return l;
}
static lv_obj_t *box(lv_obj_t *parent, uint32_t bg, uint32_t border, int radius) {
  lv_obj_t *o = lv_obj_create(parent);
  lv_obj_remove_style_all(o);
  lv_obj_set_style_bg_opa(o, LV_OPA_COVER, 0);
  lv_obj_set_style_bg_color(o, lv_color_hex(bg), 0);
  if (border) { lv_obj_set_style_border_width(o, 1, 0); lv_obj_set_style_border_color(o, lv_color_hex(border), 0); }
  lv_obj_set_style_radius(o, radius, 0);
  lv_obj_clear_flag(o, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_clear_flag(o, LV_OBJ_FLAG_CLICKABLE);   // 누르기·밀기는 바깥(tileview)이 받게
  return o;
}
static lv_obj_t *button(lv_obj_t *parent, const char *txt, int w, int h, uint32_t bg, uint32_t fg) {
  lv_obj_t *b = lv_btn_create(parent);
  lv_obj_set_size(b, w, h);
  lv_obj_set_style_bg_color(b, lv_color_hex(bg), 0);
  lv_obj_set_style_shadow_width(b, 0, 0);
  lv_obj_set_style_radius(b, 8, 0);
  lv_obj_set_style_border_width(b, 1, 0);
  lv_obj_set_style_border_color(b, lv_color_hex(D_LINE), 0);
  lv_obj_center(label(b, &kr16, fg, txt));
  return b;
}
static void show(lv_obj_t *o, bool on) { if (on) lv_obj_clear_flag(o, LV_OBJ_FLAG_HIDDEN); else lv_obj_add_flag(o, LV_OBJ_FLAG_HIDDEN); }

// ── 시간·날짜 ──
static bool timeValid() { return time(nullptr) > 1700000000; }
static String todayIso() {
  if (!timeValid()) return "";
  time_t t = time(nullptr); struct tm tm; localtime_r(&t, &tm);
  char b[12]; strftime(b, sizeof b, "%Y-%m-%d", &tm); return String(b);
}
static int nowMin() { time_t t = time(nullptr); struct tm tm; localtime_r(&t, &tm); return tm.tm_hour * 60 + tm.tm_min; }
static int toMin(const char *hm) { return atoi(hm) * 60 + atoi(hm + 3); }
static String hm(int m) { char b[8]; snprintf(b, sizeof b, "%02d:%02d", m / 60, m % 60); return String(b); }
static String leftText(int d) {   // 48 → "48분 뒤", 80 → "1시간 20분 뒤"
  char b[24];
  if (d < 60) snprintf(b, sizeof b, "%d분 뒤", d);
  else if (d % 60 == 0) snprintf(b, sizeof b, "%d시간 뒤", d / 60);
  else snprintf(b, sizeof b, "%d시간 %d분 뒤", d / 60, d % 60);
  return String(b);
}

// ── 화면 조각 ──
enum Page { P_CLOCK = 0, P_TODAY, P_WEEK, P_DECK, P_FIND, P_SET, P_COUNT };
static void goPage(int p);
static void renderPrincipal();
static void renderSchedList();
static void refreshStale();
static void applyMode();
static void closePw();
static lv_obj_t *s_tv, *s_tile[P_COUNT], *s_dot[P_COUNT];
static int s_page = P_CLOCK;
// ① 시계
static lv_obj_t *s_big, *s_bigDate, *s_dday, *s_band, *s_bandSep, *s_nowTag, *s_nextTag, *s_nowLbl, *s_nextLbl;
static lv_obj_t *s_info, *s_duty, *s_mealTitle, *s_meal;
// ② 오늘
static lv_obj_t *s_dayTitle, *s_dayTag, *s_dayClock;
static lv_obj_t *s_row[8], *s_rowP[8], *s_rowA[8], *s_rowB[8], *s_rowTag[8];
// ③ 주간
static lv_obj_t *s_weekLbl, *s_hd[5], *s_pl[7], *s_cell[5][7], *s_cellA[5][7], *s_cellB[5][7];
// ⑤ 설정
static lv_obj_t *s_wifiLbl, *s_wifiInfo, *s_wifiList, *s_pwBox, *s_pwTa, *s_kb, *s_ttPick, *s_status;
static String s_pickSsid;
static lv_obj_t *s_pwBg = nullptr;   // 비밀번호 창 뒤 어두운 막(누르면 취소)
// 교장실 모드: 같은 장 위에 겹치는 두 번째 판(applyMode 가 보이고 숨긴다)
static lv_obj_t *s_clockPanel, *s_prinPanel, *s_weekPanel, *s_schedPanel, *s_todayHint;
static lv_obj_t *s_stale, *s_bat, *s_pStale, *s_pBat;   // 자료 오래됨 글 / 배터리 글(일반·교장 화면)
static int s_batPct = -1;                               // -1: 배터리 없음·못 읽음
static lv_obj_t *s_pClock, *s_pDate, *s_pNowA, *s_pNowB, *s_pNowC;
static const int PRIN_ROWS = 5;   // 교장 화면 일정 줄 수(480 폭·446 높이 판에 맞춤)
static lv_obj_t *s_pRow[PRIN_ROWS], *s_pRowT[PRIN_ROWS], *s_pRowA[PRIN_ROWS], *s_pRowB[PRIN_ROWS], *s_pAcad[3];
static lv_obj_t *s_pDetail, *s_dDate, *s_dTitle, *s_dInfo;   // 일정 자세히 창(맨 위 층)
static lv_obj_t *s_sTitle, *s_sPage, *s_sRow[7], *s_sRowT[7], *s_sRowA[7], *s_sRowB[7];   // 주간 장: 학교 일정 목록
static int s_sPg = 0;
static lv_obj_t *s_deckState = nullptr;

// ── 시간표 ──
static int currentWeek() {
  String t = todayIso();
  JsonArray weeks = s_tt["weeks"].as<JsonArray>();
  if (!t.length() || weeks.isNull()) return 0;
  int best = 0;
  for (int w = 0; w < (int)weeks.size(); w++) {
    const char *mon = weeks[w]["days"][0]["date"] | "";
    if (strcmp(mon, t.c_str()) <= 0) best = w;
  }
  return best;
}
// 오늘(없으면 다음 수업일)
static JsonObject findDay(bool &isToday) {
  String t = todayIso();
  isToday = false;
  JsonObject next, last;
  for (JsonObject w : s_tt["weeks"].as<JsonArray>())
    for (JsonObject d : w["days"].as<JsonArray>()) {
      const char *ds = d["date"] | "";
      last = d;
      if (t.length() && t == ds) { isToday = true; return d; }
      if (t.length() && next.isNull() && strcmp(ds, t.c_str()) > 0) next = d;
    }
  return !next.isNull() ? next : last;
}
// 오늘 뒤의 첫 수업일과 그날 첫 수업 교시
static JsonObject nextClassDay(int &firstP) {
  String t = todayIso();
  firstP = -1;
  for (JsonObject w : s_tt["weeks"].as<JsonArray>())
    for (JsonObject d : w["days"].as<JsonArray>()) {
      if (strcmp(d["date"] | "", t.c_str()) <= 0) continue;
      JsonArray cells = d["cells"].as<JsonArray>();
      for (int p = 0; p < 7; p++) if (*(const char *)(cells[p][0] | "")) { firstP = p; return d; }
    }
  return JsonObject();
}
static int periodOfRow(int r) { return r < 4 ? r : (r == 4 ? -1 : r - 1); }   // 1~4교시, 점심, 5~7교시
static bool isTeacher() { return strcmp(s_tt["kind"] | "teacher", "teacher") == 0; }

// '과목 · 교실' (과목은 흰색 굵게 보이게 색 표시)
static String classText(JsonArray c) {
  String s = "#ffffff "; s += (const char *)(c[1] | ""); s += "#";
  const char *b = c[2] | "";
  if (*b) { s += " · "; s += b; }
  return s;
}

// ① 시계 화면의 '지금 / 다음' 띠. 다음은 '수업이 있는 교시'까지 건너뛰어 찾는다(공강은 건너뜀, 지도·보강은 수업으로 친다).
static void setBand(bool twoLines) {
  const int CW = 428, NY = 258, NH = twoLines ? 66 : 36;
  lv_obj_set_height(s_band, NH);
  show(s_bandSep, twoLines); show(s_nextTag, twoLines); show(s_nextLbl, twoLines);
  const int IY = NY + NH + 8;
  lv_obj_set_pos(s_info, 16, IY);
  lv_obj_set_size(s_info, CW, 436 - IY);
  lv_obj_set_height(s_meal, 436 - IY - 48);
}
static void renderBand() {
  if (!s_ttLoaded) {
    lv_label_set_text(s_nowLbl, !s_prefs.getString("ssid", "").length() ? "맨 오른쪽 설정 장에서 와이파이를 연결하세요"
                              : urlUnset() ? "시간표 주소가 아직 없습니다 · 관리자에게 알려 주세요" : "시간표를 받는 중...");
    setBand(false);
    return;
  }
  bool isToday;
  JsonObject day = findDay(isToday);
  JsonArray cells = day["cells"].as<JsonArray>();
  const int nm = timeValid() ? nowMin() : -1;
  const bool teacher = isTeacher();
  int nowP = -1, nextP = -1;
  if (isToday)
    for (int p = 0; p < 7; p++) {
      int st = toMin(PERIOD_START[p]);
      if (nm >= st && nm < st + 50) nowP = p;
      if (nextP < 0 && st > nm && *(const char *)(cells[p][0] | "")) nextP = p;
    }
  const int lastEnd = toMin(PERIOD_START[6]) + 50;

  // 다음 수업이 오늘 없으면: 다음 수업일의 첫 수업
  auto nextDayText = [&]() -> String {
    int fp; JsonObject nd = nextClassDay(fp);
    if (nd.isNull() || fp < 0) return String("");
    const char *date = nd["date"] | "", *dow = nd["dow"] | "";
    char b[48]; snprintf(b, sizeof b, "다음 수업 %d/%d(%s) %d교시 ", atoi(date + 5), atoi(date + 8), dow, fp + 1);
    return String(b) + classText(nd["cells"][fp].as<JsonArray>());
  };

  if (!isToday) {
    String n = nextDayText();
    lv_label_set_text(s_nowLbl, n.length() ? n.c_str() : "오늘은 수업이 없습니다");
    setBand(false);
    return;
  }
  String now;
  if (nowP >= 0) {
    JsonArray c = cells[nowP];
    now = String(nowP + 1) + "교시 ";
    now += *(const char *)(c[0] | "") ? classText(c) : String(teacher ? "#e2d8cc 공강#" : "#e2d8cc 수업 없음#");
    now += " · " + hm(toMin(PERIOD_START[nowP]) + 50) + "까지";
  } else if (nm >= toMin("12:30") && nm < toMin("13:30")) {
    now = (teacher && *(const char *)(day["lunch"] | "")) ? "#ffffff 급식지도# · 13:30까지" : "점심시간 · 13:30까지";
  } else if (nm < toMin(PERIOD_START[0])) now = "수업 전";
  else if (nm >= lastEnd || nextP < 0) now = "#ffffff 오늘 수업 끝#";
  else now = "쉬는 시간";

  if (nextP >= 0) {
    JsonArray c = cells[nextP];
    int st = toMin(PERIOD_START[nextP]);
    String next = String(nextP + 1) + "교시 " + classText(c) + " · " + PERIOD_START[nextP] + " #fde68a (" + leftText(st - nm) + ")#";
    lv_label_set_text(s_nowLbl, now.c_str());
    lv_label_set_text(s_nextLbl, next.c_str());
    const bool soon = st - nm <= 10;   // 수업 10분 전부터 '다음'을 노랗게 — 곧 가야 한다
    lv_obj_set_style_bg_color(s_nextTag, lv_color_hex(soon ? 0xfacc15 : 0xffffff), 0);
    lv_obj_set_style_bg_opa(s_nextTag, soon ? LV_OPA_COVER : 46, 0);
    lv_obj_set_style_text_color(lv_obj_get_child(s_nextTag, 0), lv_color_hex(soon ? C_TEXT : 0xffffff), 0);
    setBand(true);
  } else {
    String n = nextDayText();
    if (n.length()) now += " · " + n;
    lv_label_set_text(s_nowLbl, now.c_str());
    setBand(false);
  }
}

// ① 할 일: 급식지도 · 공강지도 · 보강 · 야자 감독 (오늘만)
static void renderDuty() {
  String duty;
  auto add = [&](const String &s) { if (duty.length()) duty += "  ·  "; duty += s; };
  bool isToday = false;
  if (s_ttLoaded) {
    JsonObject day = findDay(isToday);
    if (isToday) {
      const bool teacher = isTeacher();
      if (teacher && *(const char *)(day["lunch"] | "")) add("급식지도 12:30");
      JsonArray cells = day["cells"].as<JsonArray>();
      for (int p = 0; p < 7; p++) {
        JsonArray c = cells[p];
        const char *t = c[0] | "", *b = c[2] | "", *g = c[3] | "";
        if (*t != 'j') continue;
        String room = b; int dot = room.indexOf(" · "); if (dot > 0) room = room.substring(0, dot);
        if (!strcmp(g, "지도")) add(String(p + 1) + "교시 공강지도 " + room);
        else if (!strcmp(g, "보강")) add(String(p + 1) + "교시 보강 " + room);
      }
      String me = String((const char *)(s_tt["name"] | ""));
      if (teacher && me.length() && me == (const char *)(day["night"] | "")) add("야자 감독 18:30");
    }
  }
  lv_label_set_text(s_duty, duty.length() ? duty.c_str() : (isToday ? "오늘은 따로 맡은 일이 없습니다" : "-"));
  lv_obj_set_style_text_color(s_duty, lv_color_hex(duty.length() ? 0xfcd34d : D_MUTED), 0);
}

// 수능 D-day: 당일은 D-DAY, 다음 날부터 숨긴다(board_config.h 의 SUNEUNG_DATE)
static void renderDday() {
  String td = todayIso();
  if (!td.length() || sizeof(SUNEUNG_DATE) <= 1) { show(s_dday, false); return; }   // 날짜가 비면 보이지 않는다
  auto dayNo = [](const char *iso) { struct tm tm = {}; tm.tm_year = atoi(iso) - 1900; tm.tm_mon = atoi(iso + 5) - 1; tm.tm_mday = atoi(iso + 8); tm.tm_hour = 12; return (long)(mktime(&tm) / 86400); };
  long left = dayNo(SUNEUNG_DATE) - dayNo(td.c_str());
  if (left > 0) lv_label_set_text_fmt(s_dday, "수능 D-%ld", left);
  else if (left == 0) lv_label_set_text(s_dday, "수능 D-DAY");
  show(s_dday, left >= 0);
}

// ② 오늘 시간표 (8줄: 1~4교시, 점심, 5~7교시. 지금 교시는 크림색 줄)
static void renderToday() {
  if (!s_ttLoaded) {
    lv_label_set_text(s_dayTitle, "시간표 없음");
    for (int r = 0; r < 8; r++) { lv_label_set_text(s_rowA[r], ""); lv_label_set_text(s_rowB[r], ""); show(s_rowTag[r], false); }
    return;
  }
  bool isToday;
  JsonObject day = findDay(isToday);
  const char *date = day["date"] | "", *dow = day["dow"] | "", *tag = day["tag"] | "";
  lv_label_set_text_fmt(s_dayTitle, isToday ? "오늘 · %d월 %d일 (%s)" : "다음 수업일 · %d월 %d일 (%s)", atoi(date + 5), atoi(date + 8), dow);
  lv_label_set_text(s_dayTag, tag);
  if (*tag) { show(s_dayTag, true); lv_obj_update_layout(s_dayTitle); lv_obj_align_to(s_dayTag, s_dayTitle, LV_ALIGN_OUT_RIGHT_MID, 8, 0); }
  else show(s_dayTag, false);

  const bool teacher = isTeacher();
  const int nm = timeValid() ? nowMin() : -1;
  int nowP = -1, nextP = -1;
  JsonArray cells0 = day["cells"].as<JsonArray>();
  if (isToday)
    for (int p = 0; p < 7; p++) {
      int st = toMin(PERIOD_START[p]);
      if (nm >= st && nm < st + 50) nowP = p;
      if (nextP < 0 && st > nm && *(const char *)(cells0[p][0] | "")) nextP = p;   // 다음에 들어갈 수업(공강 건너뜀)
    }
  const bool lunchNow = isToday && nm >= toMin("12:30") && nm < toMin("13:30");
  JsonArray cells = day["cells"].as<JsonArray>();
  for (int r = 0; r < 8; r++) {
    int p = periodOfRow(r);
    bool now = (p >= 0 && p == nowP) || (p < 0 && lunchNow);
    bool free = false;   // 공강: 배경과 같게
    uint32_t border = D_LINE, colA = D_TEXT, colB = D_SUB;
    const char *textA = "", *textB = "", *textTag = "";
    if (p < 0) {
      const char *lunch = day["lunch"] | "";
      bool duty = teacher && *lunch;
      textA = duty ? "급식지도" : "";   // 급식지도가 없으면 점심 줄도 배경과 같게
      if (!duty) { free = true; border = D_PANEL; }
      textB = teacher ? "12:30~13:30" : lunch;
      if (duty) { border = 0xf59e0b; colA = 0xfcd34d; } else colA = D_MUTED;
      colB = D_MUTED;
    } else {
      JsonArray c = cells[p];
      const char *t = c[0] | "";
      textA = *t ? (const char *)(c[1] | "") : "";   // 공강은 글자도 없이 배경과 같게(공강지도는 수업으로 친다)
      textB = c[2] | "";
      textTag = c[3] | "";
      if (*t) border = styleOf(*t).border; else { colA = D_MUTED; colB = D_MUTED; free = true; border = D_PANEL; }
    }
    if (now) { border = D_NOW; colA = C_TEXT; colB = C_MUTED; }
    lv_obj_set_style_bg_color(s_row[r], lv_color_hex(now ? D_NOW : (free ? D_PANEL : D_ROW)), 0);
    const bool nextRow = !now && p >= 0 && p == nextP;   // 다음에 들어갈 수업: 노란 테두리
    lv_obj_set_style_border_color(s_row[r], lv_color_hex(nextRow ? NEXT_BD : border), 0);
    lv_obj_set_style_border_width(s_row[r], nextRow ? 2 : 1, 0);
    lv_label_set_text(s_rowA[r], textA);
    lv_label_set_text(s_rowB[r], textB);
    lv_obj_set_style_text_color(s_rowA[r], lv_color_hex(colA), 0);
    lv_obj_set_style_text_color(s_rowB[r], lv_color_hex(colB), 0);
    lv_label_set_text(s_rowTag[r], textTag);
    if (*textTag) {
      show(s_rowTag[r], true);
      lv_obj_set_style_bg_color(s_rowTag[r], lv_color_hex(!strcmp(textTag, "지도") ? C_PRIMARY : 0xea580c), 0);
      lv_obj_update_layout(s_rowA[r]);
      lv_obj_align_to(s_rowTag[r], s_rowA[r], LV_ALIGN_OUT_RIGHT_MID, 8, 0);
    } else show(s_rowTag[r], false);
    lv_obj_set_style_bg_color(s_rowP[r], lv_color_hex(now ? NOW_TAG : (free ? D_PANEL : D_LINE)), 0);
    lv_obj_set_style_text_color(lv_obj_get_child(s_rowP[r], 0), lv_color_hex(now ? NOW_TX : (free ? D_MUTED : D_SUB)), 0);
  }
}

// ③ 주간 시간표 (월~금 × 1~7교시, 오늘은 호박색 머리, 지금 칸은 크림색 칸)
static void renderWeek() {
  if (!s_ttLoaded) { lv_label_set_text(s_weekLbl, "시간표 없음"); return; }
  JsonArray weeks = s_tt["weeks"].as<JsonArray>();
  if (s_week < 0 || s_week >= (int)weeks.size()) s_week = currentWeek();
  JsonObject wk = weeks[s_week];
  JsonArray days = wk["days"].as<JsonArray>();
  String today = todayIso();
  int nm = timeValid() ? nowMin() : -1, nowP = -1;
  for (int p = 0; p < 7; p++) if (nm >= toMin(PERIOD_START[p]) && nm < toMin(PERIOD_START[p]) + 50) nowP = p;
  const char *d0 = days[0]["date"] | "", *d4 = days[days.size() - 1]["date"] | "";
  lv_label_set_text_fmt(s_weekLbl, "%s · %d/%d ~ %d/%d", s_ttName.c_str(), atoi(d0 + 5), atoi(d0 + 8), atoi(d4 + 5), atoi(d4 + 8));
  bool anyToday = false;
  for (int d = 0; d < 5; d++) {
    JsonObject day = days[d];
    const char *date = day["date"] | "";
    bool isToday = today.length() && today == date;
    anyToday |= isToday;
    lv_label_set_text_fmt(lv_obj_get_child(s_hd[d], 0), "%s %d", DOW[d], atoi(date + 8));
    lv_obj_set_style_bg_opa(s_hd[d], isToday ? LV_OPA_COVER : LV_OPA_TRANSP, 0);
    lv_obj_set_style_text_color(lv_obj_get_child(s_hd[d], 0), lv_color_hex(isToday ? NOW_TX : D_MUTED), 0);
    JsonArray cells = day["cells"].as<JsonArray>();
    for (int p = 0; p < 7; p++) {
      JsonArray c = cells[p];
      const char *t = c[0] | "";
      const bool nowCell = isToday && p == nowP;
      lv_obj_t *o = s_cell[d][p];
      lv_obj_set_style_bg_opa(o, *t || nowCell ? LV_OPA_COVER : LV_OPA_TRANSP, 0);
      lv_obj_set_style_bg_color(o, lv_color_hex(nowCell ? D_NOW : D_ROW), 0);
      lv_obj_set_style_border_color(o, lv_color_hex(nowCell ? D_NOW : (*t ? styleOf(*t).border : D_PANEL)), 0);
      lv_label_set_text(s_cellA[d][p], c[1] | "");
      lv_label_set_text(s_cellB[d][p], c[2] | "");
      lv_obj_set_style_text_color(s_cellA[d][p], lv_color_hex(nowCell ? C_TEXT : D_TEXT), 0);
      lv_obj_set_style_text_color(s_cellB[d][p], lv_color_hex(nowCell ? C_MUTED : D_MUTED), 0);
    }
  }
  for (int p = 0; p < 7; p++)
    lv_obj_set_style_text_color(s_pl[p], lv_color_hex(anyToday && p == nowP ? NOW_TAG : D_MUTED), 0);
}

static void renderTT() {
  if (s_principal) { renderPrincipal(); renderSchedList(); return; }   // 교장실 모드: 한 사람의 시간표는 그리지 않는다
  renderBand(); renderDuty(); renderDday(); renderToday(); renderWeek();
}

static bool loadTTFromFile() {
  File f = LittleFS.open("/tt.json", "r");
  if (!f) return false;
  JsonDocument tmp(&s_alloc);
  DeserializationError e = deserializeJson(tmp, f);
  f.close();
  if (e) { Serial.printf("tt.json parse: %s\n", e.c_str()); return false; }
  lock();   // 해석은 잠그지 않고, 화면이 읽는 자료를 바꾸는 순간만 잠근다
  s_tt = std::move(tmp);
  s_ttName = String((const char *)(s_tt["name"] | ""));
  if (strcmp(s_tt["kind"] | "", "teacher") == 0) s_ttName += " 선생님";
  s_ttLoaded = true;
  unlock();
  return true;
}

// ── 받기 (HTTP/1.0 + 15초, 크기·JSON 을 확인한 뒤에만 저장본을 바꾼다) ──
// 인증서 확인은 아직 하지 않는다 — TODO: 루트 인증서 묶음
static bool httpGet(const String &url, String &body, uint32_t timeout = 15000) {
  NetworkClientSecure client; client.setInsecure();
  HTTPClient http;
  if (!http.begin(client, url)) return false;
  http.useHTTP10(true);
  http.setTimeout(timeout);
  int code = http.GET();
  bool ok = code == 200;
  if (ok) body = http.getString();
  http.end();
  if (!ok) Serial.printf("GET %s -> %d\n", url.c_str(), code);
  return ok;
}
static bool downloadTT() {
  if (!WiFi.isConnected()) return false;
  NetworkClientSecure client; client.setInsecure();
  HTTPClient http;
  String url = String(BASE_URL) + s_ttFile;
  if (!http.begin(client, url)) return false;
  http.useHTTP10(true);
  http.setTimeout(15000);
  int code = http.GET();
  s_ttCode = code;
  bool ok = false;
  if (code == 200) {
    int want = http.getSize();
    File f = LittleFS.open("/tt.tmp", "w");
    int got = f ? http.writeToStream(&f) : -1;
    if (f) f.close();
    bool whole = got > 0 && (want < 0 || got == want);
    if (whole) {
      File r = LittleFS.open("/tt.tmp", "r");
      JsonDocument probe(&s_alloc);
      whole = r && !deserializeJson(probe, r);
      if (r) r.close();
    }
    if (whole) { LittleFS.remove("/tt.json"); LittleFS.rename("/tt.tmp", "/tt.json"); ok = true; }
    else { LittleFS.remove("/tt.tmp"); Serial.printf("download incomplete: %d/%d\n", got, want); }
  }
  http.end();
  Serial.printf("download %s -> %d\n", url.c_str(), code);
  return ok;
}
// 파일을 '/x.tmp' 에 다 쓴 뒤 이름을 바꾼다(쓰는 도중 전원이 끊겨도 반쪽 파일이 남지 않는다)
static bool saveAtomic(const char *path, const String &a, const String &b = String()) {
  String tmp = String(path); tmp.replace(".json", ".tmp");
  File f = LittleFS.open(tmp, "w");
  if (!f) return false;
  const size_t want = a.length() + b.length();
  size_t n = f.print(a); if (b.length()) n += f.print(b);
  f.close();
  if (n != want) { LittleFS.remove(tmp); return false; }
  LittleFS.remove(path); return LittleFS.rename(tmp, path);
}
static String readFile(const char *path) {
  File f = LittleFS.open(path, "r");
  if (!f) return "";
  String s = f.readString(); f.close();
  return s;
}

// 시간표 목록 (board/index.json). 고른 것은 이름으로 저장한다(목록 차례가 바뀌어도 유지).
static JsonDocument s_index(&s_alloc);
static String s_pickName = BOARD_DEFAULT_TT;
// 드롭다운 맨 앞 두 줄은 교장·교감(학교 일정). 고르면 이름이 '@교장'·'@교감' 으로 저장된다.
static const int PICK_SPECIAL = 2;
static void fillPicker() {
  s_principal = s_pickName.startsWith("@");
  if (s_ttPick) {
    String opts = "교장실 · 학교 일정\n교감실 · 학교 일정";
    int sel = s_principal ? (s_pickName == "@교감" ? 1 : 0) : -1, i = PICK_SPECIAL;
    for (JsonObject it : s_index["items"].as<JsonArray>()) {
      const char *lb = it["label"] | "";
      if (!*lb) lb = it["name"] | "";
      opts += "\n"; opts += lb;
      if (!s_principal && s_pickName == (const char *)(it["name"] | "")) { sel = i; s_ttFile = (const char *)(it["file"] | ""); }
      i++;
    }
    lv_dropdown_set_options(s_ttPick, opts.c_str());
    if (sel >= 0) lv_dropdown_set_selected(s_ttPick, sel);
  }
  applyMode();
}
static bool parseIndex(const String &body) {
  JsonDocument d(&s_alloc);
  if (deserializeJson(d, body) || d["items"].isNull()) return false;   // 해석은 잠그지 않는다
  lock();   // 바꾸는 순간만 잠근다(재귀 잠금이라 안에서 또 잠가도 된다)
  s_index = std::move(d);
  // 고른 이름의 파일을 바로 찾아 둔다(받기 전에 s_ttFile 이 맞아야 한다)
  // 이름이 비었거나 목록에 없으면(처음 켠 보드 등) 목록의 첫 번째 시간표를 쓴다. 교장·교감(@)은 목록에 없어도 그대로 둔다
  if (!s_pickName.startsWith("@")) {
    bool found = false;
    for (JsonObject it : s_index["items"].as<JsonArray>())
      if (s_pickName == (const char *)(it["name"] | "")) { s_ttFile = (const char *)(it["file"] | ""); found = true; }
    JsonObject first = s_index["items"][0];
    if (!found && !first.isNull()) { s_pickName = (const char *)(first["name"] | ""); s_ttFile = (const char *)(first["file"] | ""); }
  }
  unlock();
  return true;
}
static bool downloadIndex() {
  String body;
  bool ok = WiFi.isConnected() && httpGet(String(BASE_URL) + "index.json", body) && parseIndex(body);
  if (ok) saveAtomic("/index.json", body);
  Serial.printf("index %s\n", ok ? "ok" : "fail");
  return ok;
}

// ── 급식 (나이스, 인증키 없이 하루치) — 13:30 전 점심, 뒤 저녁 ──
static const bool MEAL_ON = sizeof(NEIS_ATPT_CODE) > 1 && sizeof(NEIS_SCHOOL_CODE) > 1;   // 코드가 비면 급식을 쓰지 않는다
static const char *MEAL_URL = "https://open.neis.go.kr/hub/mealServiceDietInfo?Type=json&ATPT_OFCDC_SC_CODE=" NEIS_ATPT_CODE "&SD_SCHUL_CODE=" NEIS_SCHOOL_CODE "&MLSV_YMD=";
static String s_mealDate, s_mLunch, s_mDinner;
static String cleanMenu(const char *raw) {   // 알레르기 번호 괄호는 뺀다
  String s(raw), out, item;
  s.replace("<br/>", "\n");
  s += "\n";
  for (size_t i = 0; i < s.length(); i++) {
    char ch = s[i];
    if (ch == '(') {
      size_t j = i + 1; bool num = true;
      while (j < s.length() && s[j] != ')') { if (!(isdigit((uint8_t)s[j]) || s[j] == '.' || s[j] == ',' || s[j] == ' ')) num = false; j++; }
      if (num && j < s.length()) { i = j; continue; }
    }
    if (ch == '\n') {
      item.trim();
      while (item.endsWith(",")) { item.remove(item.length() - 1); item.trim(); }
      if (item.length()) { if (out.length()) out += " · "; out += item; }
      item = "";
    } else item += ch;
  }
  return out;
}
static bool parseMeal(const String &body, const String &date) {
  JsonDocument d(&s_alloc);
  if (deserializeJson(d, body)) return false;
  String lunch, dinner;
  for (JsonObject r : d["mealServiceDietInfo"][1]["row"].as<JsonArray>()) {
    const char *kind = r["MMEAL_SC_NM"] | "";
    String menu = cleanMenu(r["DDISH_NM"] | "");
    if (strcmp(kind, "중식") == 0) lunch = menu;
    else if (strcmp(kind, "석식") == 0) dinner = menu;
  }
  lock(); s_mLunch = lunch; s_mDinner = dinner; s_mealDate = date; unlock();   // 바꾸는 순간만 잠근다
  return true;   // 급식이 없는 날(주말)도 '받음'으로 본다
}
static bool downloadMeal() {
  String date = todayIso(), body;
  if (!MEAL_ON || !WiFi.isConnected() || !date.length()) return false;
  String ymd = date; ymd.replace("-", "");
  bool ok = httpGet(String(MEAL_URL) + ymd, body) && parseMeal(body, date);
  if (ok) saveAtomic("/meal.json", date + "\n", body);   // 첫 줄 날짜 + 원문(loadMealFromFile 과 같은 모양)
  Serial.printf("meal %s %s\n", ymd.c_str(), ok ? "ok" : "fail");
  return ok;
}
static void loadMealFromFile() {
  File f = LittleFS.open("/meal.json", "r");
  if (!f) return;
  String date = f.readStringUntil('\n'), body = f.readString();
  f.close();
  parseMeal(body, date);
}
static void renderMeal() {
  const bool today = s_mealDate.length() && s_mealDate == todayIso();
  const int nm = timeValid() ? nowMin() : 0;
  bool dinner = today && nm >= toMin("13:30") && s_mDinner.length();
  if (today && !s_mLunch.length() && s_mDinner.length()) dinner = true;
  if (!MEAL_ON) { lv_label_set_text(s_mealTitle, "급식"); lv_label_set_text(s_meal, "급식을 쓰지 않습니다"); return; }
  lv_label_set_text(s_mealTitle, dinner ? "저녁" : "점심");
  const String &menu = dinner ? s_mDinner : s_mLunch;
  if (!today) lv_label_set_text(s_meal, "급식 정보를 받는 중입니다");
  else if (!menu.length()) lv_label_set_text(s_meal, "오늘은 급식이 없습니다");
  else lv_label_set_text(s_meal, menu.c_str());
}

// ── 날씨 (Open-Meteo, 열쇠 없음) — 오늘=지금 기온·지금 날씨, 내일=최고 기온 ──
static const bool WX_ON = sizeof(WEATHER_LAT) > 1 && sizeof(WEATHER_LON) > 1;   // 위치가 비면 날씨·미세먼지를 받지 않는다
static const char *WX_URL =
    "https://api.open-meteo.com/v1/forecast?latitude=" WEATHER_LAT "&longitude=" WEATHER_LON
    "&current=temperature_2m,weather_code"
    "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max"
    "&timezone=Asia%2FSeoul&forecast_days=2";
struct WxDay { int code = -1; float tmax = NAN, tmin = NAN; int pop = -1; };
static float s_wxNow = NAN;
static int s_wxNowCode = -1;
static WxDay s_wx[2];
static bool s_wxOk = false;
struct WxCard { lv_obj_t *img, *temp, *desc, *line; };
static WxCard s_card[2];
static int wxKind(int c) {
  if (c == 0) return 0;
  if (c <= 2) return 1;
  if (c == 3) return 2;
  if (c == 45 || c == 48) return 6;
  if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return 3;
  if ((c >= 71 && c <= 77) || c == 85 || c == 86) return 4;
  if (c >= 95) return 5;
  return 2;
}
static const char *wxName(int c) {
  if (c == 0) return "맑음";
  if (c == 1) return "대체로 맑음";
  if (c == 2) return "구름 조금";
  if (c == 3) return "흐림";
  if (c == 45 || c == 48) return "안개";
  if (c >= 51 && c <= 57) return "이슬비";
  if (c >= 61 && c <= 67) return "비";
  if (c >= 71 && c <= 77) return "눈";
  if (c >= 80 && c <= 82) return "소나기";
  if (c == 85 || c == 86) return "눈";
  if (c >= 95) return "뇌우";
  return "-";
}
static const lv_img_dsc_t *wxIcon(int c) {
  static const lv_img_dsc_t *L[7] = {&wx_sun_L, &wx_partly_L, &wx_cloud_L, &wx_rain_L, &wx_snow_L, &wx_thunder_L, &wx_fog_L};
  return L[wxKind(c)];
}
static bool parseWeather(const String &body) {
  JsonDocument d(&s_alloc);
  if (deserializeJson(d, body)) return false;
  WxDay w[2];
  const float now = d["current"]["temperature_2m"] | NAN;
  const int nowCode = d["current"]["weather_code"] | -1;
  for (int i = 0; i < 2; i++) {
    w[i].code = d["daily"]["weather_code"][i] | -1;
    w[i].tmax = d["daily"]["temperature_2m_max"][i] | NAN;
    w[i].tmin = d["daily"]["temperature_2m_min"][i] | NAN;
    w[i].pop = d["daily"]["precipitation_probability_max"][i] | -1;
  }
  if (w[0].code < 0) return false;
  lock(); s_wxNow = now; s_wxNowCode = nowCode; s_wx[0] = w[0]; s_wx[1] = w[1]; s_wxOk = true; unlock();
  return true;
}
static bool downloadWeather() {
  String body;
  bool ok = WX_ON && WiFi.isConnected() && httpGet(WX_URL, body) && parseWeather(body);
  if (ok) saveAtomic("/wx.json", body);
  Serial.printf("weather %s\n", ok ? "ok" : "fail");
  return ok;
}
static void renderWeather() {
  for (int i = 0; i < 2; i++) {
    WxCard &k = s_card[i];
    const WxDay &w = s_wx[i];
    const char *day = i == 0 ? "오늘" : "내일";
    if (!s_wxOk) {
      show(k.img, false);
      lv_label_set_text(k.desc, day); lv_label_set_text(k.temp, "--"); lv_label_set_text(k.line, "날씨 받는 중");
      continue;
    }
    const int code = (i == 0 && s_wxNowCode >= 0) ? s_wxNowCode : w.code;
    const float big = i == 0 && !isnan(s_wxNow) ? s_wxNow : w.tmax;
    show(k.img, true);
    lv_img_set_src(k.img, wxIcon(code));
    if (isnan(w.tmax) || isnan(w.tmin)) lv_label_set_text(k.desc, day);
    else lv_label_set_text_fmt(k.desc, "%s  %d°/%d°", day, (int)lroundf(w.tmax), (int)lroundf(w.tmin));
    if (isnan(big)) lv_label_set_text(k.temp, "--"); else lv_label_set_text_fmt(k.temp, "%d°", (int)lroundf(big));
    if (w.pop < 0) lv_label_set_text(k.line, wxName(code));
    else lv_label_set_text_fmt(k.line, "%s · #%s 비 %d%%#", wxName(code), w.pop >= 40 ? "60a5fa" : "b8ab9c", w.pop);
  }
}

// ── 미세먼지 (Open-Meteo 대기질, 환경부 등급, PM10·PM2.5 중 나쁜 쪽) ──
static const char *AIR_URL = "https://air-quality-api.open-meteo.com/v1/air-quality?latitude=" WEATHER_LAT "&longitude=" WEATHER_LON
                             "&current=pm10,pm2_5&timezone=Asia%2FSeoul";
static float s_pm10 = NAN, s_pm25 = NAN;
static lv_obj_t *s_dust = nullptr;
static bool parseAir(const String &body) {
  JsonDocument d(&s_alloc);
  if (deserializeJson(d, body)) return false;
  const float a = d["current"]["pm10"] | NAN, b = d["current"]["pm2_5"] | NAN;
  if (isnan(a) && isnan(b)) return false;
  lock(); s_pm10 = a; s_pm25 = b; unlock();
  return true;
}
static bool downloadAir() {
  String body;
  bool ok = WX_ON && WiFi.isConnected() && httpGet(AIR_URL, body) && parseAir(body);
  if (ok) saveAtomic("/air.json", body);
  Serial.printf("air %s\n", ok ? "ok" : "fail");
  return ok;
}
static void renderAir() {
  if (isnan(s_pm10) && isnan(s_pm25)) { lv_label_set_text(s_dust, "#b8ab9c 미세먼지 정보를 받는 중#"); return; }
  int g10 = isnan(s_pm10) ? 0 : s_pm10 <= 30 ? 0 : s_pm10 <= 80 ? 1 : s_pm10 <= 150 ? 2 : 3;
  int g25 = isnan(s_pm25) ? 0 : s_pm25 <= 15 ? 0 : s_pm25 <= 35 ? 1 : s_pm25 <= 75 ? 2 : 3;
  int g = g10 > g25 ? g10 : g25;
  static const char *NAME[4] = {"좋음", "보통", "나쁨", "매우 나쁨"};
  static const char *COLOR[4] = {"60a5fa", "34d399", "fb923c", "ef4444"};
  lv_label_set_text_fmt(s_dust, "#%s ● 미세먼지 %s#  #b8ab9c · PM10 %d · 초미세 %d#", COLOR[g], NAME[g],
                        isnan(s_pm10) ? 0 : (int)lroundf(s_pm10), isnan(s_pm25) ? 0 : (int)lroundf(s_pm25));
}

// ── ④ 선생님 찾기 (board/where.json: 선생님 × 오늘부터 수업일 10일) ──
// 이름 단추 목록 → 누르면 자세히(지금 위치·다음 수업·그날 시간표). [◀ 목록]으로 돌아간다.
static JsonDocument s_where(&s_alloc);
static lv_obj_t *s_findList, *s_findGrid, *s_findDetail, *s_findName, *s_findHome, *s_findNowT, *s_findNow, *s_findNext, *s_findDay;
static lv_obj_t *s_findRow[7], *s_findRowP[7], *s_findRowT[7];
static String s_findSel;
static bool s_findGridDirty = true;   // 단추는 찾기 장을 처음 열 때 만든다(내부 RAM 아끼기)
static bool parseWhere(const String &body) {
  JsonDocument d(&s_alloc);
  if (deserializeJson(d, body) || d["teachers"].isNull()) return false;   // 해석(큰 파일)은 잠그지 않는다
  lock(); s_where = std::move(d); unlock();
  return true;
}
static bool downloadWhere() {
  String body;
  bool ok = WiFi.isConnected() && httpGet(String(BASE_URL) + "where.json", body, 20000) && parseWhere(body);
  if (ok) saveAtomic("/where.json", body);
  Serial.printf("where %s\n", ok ? "ok" : "fail");
  return ok;
}
static char whereKind(const char *s) { return (s && s[0] && s[1] == ':') ? s[0] : 0; }   // "n:102 수학" → 'n'
static const char *whereText(const char *s) { return (s && s[0] && s[1] == ':') ? s + 2 : ""; }
static void renderFinder() {
  JsonArray dates = s_where["dates"].as<JsonArray>();
  JsonObject who;
  for (JsonObject t : s_where["teachers"].as<JsonArray>()) if (s_findSel == (const char *)(t["n"] | "")) { who = t; break; }
  if (who.isNull()) { show(s_findDetail, false); show(s_findList, true); return; }
  lv_label_set_text_fmt(s_findName, "%s 선생님", s_findSel.c_str());
  const char *home = who["h"] | "";
  lv_label_set_text(s_findHome, *home ? (String("담임 ") + home).c_str() : "");
  String today = todayIso();
  int di = -1; bool isToday = false;
  for (int i = 0; i < (int)dates.size(); i++) {
    const char *d = dates[i] | "";
    if (today == d) { di = i; isToday = true; break; }
    if (di < 0 && strcmp(d, today.c_str()) > 0) di = i;
  }
  if (di < 0) di = 0;
  const char *date = dates[di] | "";
  lv_label_set_text_fmt(s_findDay, isToday ? "오늘 시간표" : "다음 수업일 %d/%d 시간표", atoi(date + 5), atoi(date + 8));
  JsonArray day = who["d"][di].as<JsonArray>();
  const int nm = timeValid() ? nowMin() : -1;
  int nowP = -1, nextP = -1;
  if (isToday)
    for (int p = 0; p < 7; p++) {
      int st = toMin(PERIOD_START[p]);
      if (nm >= st && nm < st + 50) nowP = p;
      if (nextP < 0 && st > nm && whereKind(day[p] | "")) nextP = p;
    }
  if (!isToday) { lv_label_set_text(s_findNowT, "오늘"); lv_label_set_text(s_findNow, "수업이 없는 날입니다"); }
  else if (nowP >= 0) {
    const char *c = day[nowP] | "";
    lv_label_set_text_fmt(s_findNowT, "지금 · %d교시 %s", nowP + 1, PERIOD_START[nowP]);
    lv_label_set_text(s_findNow, whereKind(c) ? whereText(c) : "공강 (교무실)");
  } else if (nm >= toMin("12:30") && nm < toMin("13:30")) { lv_label_set_text(s_findNowT, "지금"); lv_label_set_text(s_findNow, "점심시간"); }
  else if (nm < toMin("08:40")) { lv_label_set_text(s_findNowT, "지금"); lv_label_set_text(s_findNow, "수업 전"); }
  else if (nm >= toMin("16:30")) { lv_label_set_text(s_findNowT, "지금"); lv_label_set_text(s_findNow, "수업 끝"); }
  else { lv_label_set_text(s_findNowT, "지금"); lv_label_set_text(s_findNow, "쉬는 시간 (교무실)"); }
  if (nextP >= 0) lv_label_set_text_fmt(s_findNext, "다음  %d교시 %s · %s", nextP + 1, PERIOD_START[nextP], whereText(day[nextP] | ""));
  else lv_label_set_text(s_findNext, isToday ? "오늘 남은 수업 없음" : "");
  for (int p = 0; p < 7; p++) {
    const char *c = day[p] | "";
    char k = whereKind(c);
    bool now = isToday && p == nowP;
    lv_obj_set_style_bg_color(s_findRow[p], lv_color_hex(now ? D_NOW : (k ? D_ROW : D_PANEL)), 0);
    lv_obj_set_style_border_color(s_findRow[p], lv_color_hex(now ? D_NOW : (k ? styleOf(k).border : D_PANEL)), 0);
    lv_obj_set_style_text_color(s_findRowP[p], lv_color_hex(now ? C_MUTED : D_MUTED), 0);
    lv_label_set_text(s_findRowT[p], k ? whereText(c) : "");
    lv_obj_set_style_text_color(s_findRowT[p], lv_color_hex(now ? C_TEXT : (k ? D_TEXT : D_MUTED)), 0);
  }
  show(s_findList, false); show(s_findDetail, true);
}
static void onFindPick(lv_event_t *e) {
  s_findSel = lv_label_get_text(lv_obj_get_child(lv_event_get_target(e), 0));
  renderFinder();
}
static void onFindBack(lv_event_t *) { s_findSel = ""; renderFinder(); }
static void fillFinderGrid() {
  if (s_page != P_FIND) { s_findGridDirty = true; return; }   // 보이지 않으면 나중에
  s_findGridDirty = false;
  lv_obj_clean(s_findGrid);
  if (s_where["teachers"].isNull()) { label(s_findGrid, &kr14, D_MUTED, "자료를 받는 중입니다"); return; }
  for (JsonObject t : s_where["teachers"].as<JsonArray>()) {
    lv_obj_t *b = button(s_findGrid, t["n"] | "", 101, 42, D_ROW, D_TEXT);
    lv_obj_add_event_cb(b, onFindPick, LV_EVENT_CLICKED, nullptr);
  }
}

// ── 교장실·교감실 모드 (볼 시간표에서 교장·교감) ──
static const char *principalName() { return s_pickName == "@교감" ? "교감실" : "교장실"; }
// 교장 모드면 같은 장 위의 두 번째 판을 보이고 원래 판을 숨긴다(판은 만들어 둔 것을 보이고 숨기기만 한다)
static void applyMode() {
  static int last = -1;
  if (s_clockPanel && s_prinPanel && s_weekPanel && s_schedPanel && s_todayHint && last != (int)s_principal) {
    last = (int)s_principal;
    show(s_clockPanel, !s_principal); show(s_prinPanel, s_principal);
    show(s_weekPanel, !s_principal); show(s_schedPanel, s_principal);
    show(s_todayHint, s_principal);
    if (!s_principal && s_pDetail) show(s_pDetail, false);
  }
  if (s_sTitle) { String t = String(principalName()) + " · 학교 일정 (30일)"; setTextIf(s_sTitle, t.c_str()); }
}
// 학교 일정 사이트(Apps Script)는 JSON 주소가 따로 없어서 페이지 안의 init-data JSON 을 꺼내 쓴다(7인치와 같은 순서):
//   ① goog.script.init(" ... ", " 사이 ② JS 이스케이프 풀기 ③ "userHtml":" 문자열 ④ JSON 이스케이프 풀기 ⑤ init-data JSON
static void unescJs(const char *s, size_t n, String &out, bool stopAtQuote) {
  const char BS = 92;
  out.reserve(n);
  auto put = [&](uint32_t cp) {   // 코드포인트 → UTF-8
    if (cp < 0x80) out += (char)cp;
    else if (cp < 0x800) { out += (char)(0xC0 | (cp >> 6)); out += (char)(0x80 | (cp & 0x3F)); }
    else { out += (char)(0xE0 | (cp >> 12)); out += (char)(0x80 | ((cp >> 6) & 0x3F)); out += (char)(0x80 | (cp & 0x3F)); }
  };
  auto hex = [](const char *p, int k) { uint32_t v = 0; for (int i = 0; i < k; i++) { char c = p[i]; v = v * 16 + (c >= 'a' ? c - 'a' + 10 : c >= 'A' ? c - 'A' + 10 : c - '0'); } return v; };
  for (size_t i = 0; i < n; ) {
    const char c = s[i];
    if (stopAtQuote && c == '"') return;
    if (c == BS && i + 1 < n) {
      const char e = s[i + 1];
      if (e == 'x' && i + 3 < n) { put(hex(s + i + 2, 2)); i += 4; continue; }
      if (e == 'u' && i + 5 < n) { put(hex(s + i + 2, 4)); i += 6; continue; }
      out += (e == 'n') ? (char)10 : (e == 'r') ? (char)13 : (e == 't') ? (char)9 : e;
      i += 2; continue;
    }
    out += c; i++;
  }
}
static bool loadSchedFromFile() {
  File f = LittleFS.open("/sched.json", "r");
  if (!f) return false;
  JsonDocument d(&s_alloc);
  const bool ok = !deserializeJson(d, f);
  f.close();
  if (ok) { lock(); s_sched = std::move(d); unlock(); }
  return ok;
}
static String cutUtf8(const char *s, size_t maxB) {   // UTF-8 글자 경계에서 자른다
  size_t n = strlen(s);
  if (n <= maxB) return String(s);
  while (maxB > 0 && ((uint8_t)s[maxB] & 0xC0) == 0x80) maxB--;
  return String(s).substring(0, maxB) + "...";
}
static bool downloadSchedule() {
  if (!WiFi.isConnected() || !HAS_SCHED || !timeValid()) return false;   // 오늘 날짜를 모르면 거를 수 없다
  NetworkClientSecure client; client.setInsecure();
  HTTPClient http;
  if (!http.begin(client, SCHEDULE_URL)) return false;
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);   // script.google.com → script.googleusercontent.com
  http.useHTTP10(true);
  http.setTimeout(20000);
  const int code = http.GET();
  bool ok = false;
  if (code == 200) {
    String raw = http.getString();                            // 약 150KB(PSRAM: heap_caps_malloc_extmem_enable 덕분)
    const int a0 = raw.indexOf(R"X(goog.script.init(")X");
    const int a1 = a0 >= 0 ? raw.indexOf(R"X(", ")X", a0) : -1;
    if (a0 >= 0 && a1 > a0) {
      String A; unescJs(raw.c_str() + a0 + 18, a1 - a0 - 18, A, false);
      raw = String();                                         // 메모리 돌려주기
      const int k = A.indexOf(R"X("userHtml":")X");
      if (k >= 0) {
        String B; unescJs(A.c_str() + k + 12, A.length() - k - 12, B, true);
        A = String();
        const int j = B.indexOf(R"X(type="application/json">)X");
        if (j >= 0) {
          JsonDocument src(&s_alloc);
          if (!deserializeJson(src, B.c_str() + j + 24)) {
            // 오늘 하루 전 ~ 30일 뒤 일정, 오늘 ~ 60일 뒤 학사 일정만 남긴다
            const String today = todayIso();
            auto addDays = [](const String &iso, int n) { struct tm t = {}; t.tm_year = iso.substring(0, 4).toInt() - 1900; t.tm_mon = iso.substring(5, 7).toInt() - 1; t.tm_mday = iso.substring(8, 10).toInt() + n; t.tm_hour = 12; mktime(&t); char b[11]; strftime(b, sizeof b, "%Y-%m-%d", &t); return String(b); };
            const String from = addDays(today, -1), to = addDays(today, 30), to2 = addDays(today, 60);
            JsonDocument out(&s_alloc);
            JsonArray items = out["items"].to<JsonArray>(), acad = out["acad"].to<JsonArray>();
            for (JsonObject x : src["schedules"].as<JsonArray>()) {
              const char *sd = x["startDate"] | "", *ed = x["endDate"] | "";
              const String end = *ed ? String(ed) : String(sd);
              if (end < from || String(sd) > to) continue;
              JsonArray r = items.add<JsonArray>();
              r.add(sd); r.add(end); r.add(x["time"] | ""); r.add(x["title"] | ""); r.add(x["place"] | ""); r.add(x["dept"] | ""); r.add(x["manager"] | ""); r.add(cutUtf8(x["content"] | "", 400));
            }
            for (JsonObject x : src["academic"].as<JsonArray>()) {   // 학사 일정은 날짜순으로 넣는다
              const char *dt = x["date"] | "";
              if (String(dt) < today || String(dt) > to2) continue;
              JsonArray r = acad.add<JsonArray>();
              r.add(dt); r.add(x["name"] | ""); r.add(x["type"] | "");
              for (int q = (int)acad.size() - 1; q > 0 && strcmp(acad[q - 1][0] | "", acad[q][0] | "") > 0; q--) {
                JsonDocument t1(&s_alloc); t1.set(acad[q - 1]); acad[q - 1].set(acad[q]); acad[q].set(t1);
              }
            }
            const bool empty = !items.size() && src["schedules"].as<JsonArray>().size() > 0;   // 거르다 다 빠졌으면 이상하다 → 예전 것을 둔다
            if (!empty) {
              String js; serializeJson(out, js);
              saveAtomic("/sched.json", js);
              lock(); s_sched = std::move(out); unlock();
              ok = true;
            }
          }
        }
      }
    }
  }
  http.end();
  Serial.printf("schedule -> %d %s (%d items)\n", code, ok ? "ok" : "fail", (int)s_sched["items"].size());
  return ok;
}
// where.json 칸이 '수업'인지: 수업·당겨옴·창체·시험은 수업, 보강은 수업, 공강지도·결강·휴일·행사·빈칸은 아님
static bool teachingCell(const char *c) {
  const char k = whereKind(c);
  if (k == 'n' || k == 'd' || k == 'c' || k == 'e') return true;
  if (k == 'j') return strstr(whereText(c), "보강") != nullptr;
  return false;
}
// 오늘 쉬는 날인지(주말 · 교장 모드는 학사 일정의 '휴' · 교사 모드는 시간표의 holiday). name 에 이유. 화면 불 규칙도 쓴다
static bool isOffDay(String *name) {
  if (!timeValid()) return false;
  time_t t = time(nullptr); struct tm tm; localtime_r(&t, &tm);
  if (tm.tm_wday == 0 || tm.tm_wday == 6) { if (name) *name = "주말"; return true; }
  if (s_principal) {
    const String td = todayIso();
    for (JsonArray a : s_sched["acad"].as<JsonArray>()) {
      if (td != (const char *)(a[0] | "")) continue;
      const char *nm = a[1] | "", *ty = a[2] | "";
      if (strstr(nm, "휴") || strstr(ty, "휴")) { if (name) *name = nm; return true; }
    }
    return false;
  }
  if (s_ttLoaded) { bool isToday; JsonObject d = findDay(isToday); if (isToday && !strcmp(d["type"] | "", "holiday")) { if (name) *name = "휴일"; return true; } }
  return false;
}
// 일정의 '시간' 글("7교시", "점심시간", "13:00~13:30", "")을 정렬용 분으로
static int schedMin(const char *t) {
  if (!*t) return -1;                                          // 종일 → 맨 앞
  if (strstr(t, "점심")) return toMin("12:30");
  const char *g = strstr(t, "교시");
  if (g && g > t && isdigit((unsigned char)g[-1])) { const int p = g[-1] - '1'; if (p >= 0 && p < 7) return toMin(PERIOD_START[p]); }
  if (isdigit((unsigned char)t[0]) && t[1] && (t[2] == ':' || t[1] == ':')) { const int h = atoi(t), m = atoi(strchr(t, ':') + 1); return h * 60 + m; }
  return 24 * 60;
}
// 끝나는 분: '13:00~13:30' 은 끝 시각, 교시는 +50, 시각 하나면 +60, 모르면 -1
static int schedEnd(const char *t, int st) {
  if (st < 0 || st >= 24 * 60) return -1;
  const char *sep = strpbrk(t, "~-");
  if (sep) { const char *q = sep + 1; while (*q == ' ') q++; if (isdigit((unsigned char)q[0]) && strchr(q, ':')) { const int e = atoi(q) * 60 + atoi(strchr(q, ':') + 1); if (e > st) return e; } }
  if (strstr(t, "교시")) return st + 50;
  return st + 60;
}
static const char *DOW7[7] = {"일", "월", "화", "수", "목", "금", "토"};
static long dayNoOf(const String &iso) {
  struct tm t = {}; t.tm_year = iso.substring(0, 4).toInt() - 1900; t.tm_mon = iso.substring(5, 7).toInt() - 1; t.tm_mday = iso.substring(8, 10).toInt(); t.tm_hour = 12;
  return (long)(mktime(&t) / 86400);
}
static String mdOf(const String &iso) {   // "10/21 수"
  struct tm t = {}; t.tm_year = iso.substring(0, 4).toInt() - 1900; t.tm_mon = iso.substring(5, 7).toInt() - 1; t.tm_mday = iso.substring(8, 10).toInt(); t.tm_hour = 12; mktime(&t);
  return String(iso.substring(5, 7).toInt()) + "/" + iso.substring(8, 10).toInt() + " " + DOW7[t.tm_wday];
}
static String schedDay(const String &sd, const String &ed) { return (ed.length() && ed != sd) ? mdOf(sd) + " ~ " + mdOf(ed) : mdOf(sd); }
static void showSchedDetail(int i);
static void onSchedRow(lv_event_t *e) { showSchedDetail((int)(intptr_t)lv_obj_get_user_data(lv_event_get_current_target(e))); }
// 일정 차례(끝나지 않은 것, 날짜 → 시간). idx 에 s_sched["items"] 번호를 담고 개수를 돌려준다
static int schedSorted(int *idx, int maxn) {
  const String td = todayIso();
  JsonArray items = s_sched["items"].as<JsonArray>();
  int n = 0;
  static long long key[64];
  for (int i = 0; i < (int)items.size() && n < maxn && n < 64; i++) {
    JsonArray r = items[i];
    const char *sd = r[0] | "", *ed = r[1] | "";
    if (strcmp(ed, td.c_str()) < 0) continue;
    const String d = strcmp(sd, td.c_str()) <= 0 ? td : String(sd);
    key[n] = (long long)(d.substring(0, 4).toInt() * 10000L + d.substring(5, 7).toInt() * 100 + d.substring(8, 10).toInt()) * 10000 + schedMin(r[2] | "") + 1;
    idx[n] = i; n++;
  }
  for (int a = 1; a < n; a++) { long long kv = key[a]; int iv = idx[a], b = a - 1; while (b >= 0 && key[b] > kv) { key[b + 1] = key[b]; idx[b + 1] = idx[b]; b--; } key[b + 1] = kv; idx[b + 1] = iv; }
  return n;
}
// 교장 화면: 시계 + 학교 지금 + 일정 5줄 + 학사 D-day 3줄 (분이 바뀔 때·받은 뒤에만 부른다)
static void renderPrincipal() {
  if (!s_prinPanel) return;
  const bool tv = timeValid();
  const int nm = tv ? nowMin() : -1;
  setTextIf(s_pClock, lv_label_get_text(s_big));
  { String d = String(principalName()) + " · " + lv_label_get_text(s_bigDate); setTextIf(s_pDate, d.c_str()); }
  // 학교 지금
  int nowP = -1, nextP = -1;
  for (int p = 0; p < 7; p++) { const int st = toMin(PERIOD_START[p]); if (nm >= st && nm < st + 50) nowP = p; if (nextP < 0 && st > nm) nextP = p; }
  const bool lunch = nm >= toMin("12:30") && nm < toMin("13:30");
  String offName; const bool off = isOffDay(&offName);
  char a[48] = "", b[96] = "", c[128] = "";
  if (!tv) snprintf(a, sizeof a, "%s", "시각을 맞추는 중");
  else if (off) { snprintf(a, sizeof a, "%s", offName == "주말" ? "주말" : "휴업일"); snprintf(b, sizeof b, "%s", offName == "주말" ? "수업 없음" : offName.c_str()); }
  else if (nowP >= 0) {
    const int end = toMin(PERIOD_START[nowP]) + 50;
    snprintf(a, sizeof a, "%d교시 수업 중", nowP + 1);
    if (nextP >= 0) snprintf(b, sizeof b, "%d분 남음 · 다음 %d교시 %s", end - nm, nextP + 1, PERIOD_START[nextP]);
    else snprintf(b, sizeof b, "%d분 남음 · 마지막 교시", end - nm);
  } else if (lunch) { snprintf(a, sizeof a, "%s", "점심시간"); snprintf(b, sizeof b, "%d분 남음 · 5교시 %s", toMin("13:30") - nm, PERIOD_START[4]); }
  else if (nextP >= 0) { snprintf(a, sizeof a, "%s", nm < toMin(PERIOD_START[0]) ? "수업 전" : "쉬는 시간"); snprintf(b, sizeof b, "%d교시 %s 시작", nextP + 1, PERIOD_START[nextP]); }
  else { snprintf(a, sizeof a, "%s", "수업 끝"); snprintf(b, sizeof b, "%s", "방과 후"); }
  setTextIf(s_pNowA, a); setTextIf(s_pNowB, b);
  {   // 수업 중인 선생님 수(where.json 의 오늘 칸에서 셈 — 이름은 쓰지 않는다)
    int inClass = 0, total = 0, di = -1;
    const String td = todayIso();
    JsonArray dates = s_where["dates"].as<JsonArray>();
    for (int i = 0; i < (int)dates.size(); i++) if (td == (const char *)(dates[i] | "")) di = i;
    const int bp = off ? -1 : nowP >= 0 ? nowP : nextP;   // 쉬는 시간·점심·수업 전이면 다음 교시 기준
    for (JsonObject t : s_where["teachers"].as<JsonArray>()) { total++; if (di >= 0 && bp >= 0 && teachingCell(t["d"][di][bp] | "")) inClass++; }
    if (total && di >= 0 && nowP >= 0 && !off) snprintf(c, sizeof c, "수업 중 %d명 · 수업 없음 %d명 · 누르면 선생님 찾기  " LV_SYMBOL_RIGHT, inClass, total - inClass);
    else if (total && di >= 0 && bp >= 0) snprintf(c, sizeof c, "다음 %d교시 수업 %d명 · 누르면 선생님 찾기  " LV_SYMBOL_RIGHT, bp + 1, inClass);
    else if (total) snprintf(c, sizeof c, "선생님 %d명 · 누르면 선생님 찾기  " LV_SYMBOL_RIGHT, total);
  }
  setTextIf(s_pNowC, c);
  // 학교 일정: 오늘 진행 중인 것부터 다가오는 날 차례로 PRIN_ROWS 줄
  const String td = todayIso();
  struct Cand { int idx; long long key; int m, e; bool today; };
  static Cand cand[64]; int cn = 0;   // 큰 배열은 static(내부 RAM·스택 아끼기)
  int ii = -1;
  for (JsonArray r : s_sched["items"].as<JsonArray>()) {
    ii++;
    const char *sd = r[0] | "", *ed = r[1] | "";
    if (strcmp(ed, td.c_str()) < 0) continue;                  // 끝난 일정
    if (cn >= 64) break;
    const bool today = strcmp(sd, td.c_str()) <= 0;
    const String d = today ? td : String(sd);
    const long dN = d.substring(0, 4).toInt() * 10000L + d.substring(5, 7).toInt() * 100 + d.substring(8, 10).toInt();
    const int m = schedMin(r[2] | ""), e = schedEnd(r[2] | "", m);
    long long key = (long long)dN * 10000 + (m + 1);
    if (today && e > 0 && nm >= 0 && e <= nm) key += 100000000000000LL;   // 오늘 이미 끝난 일정은 맨 뒤로
    cand[cn].idx = ii; cand[cn].key = key; cand[cn].m = m; cand[cn].e = e; cand[cn].today = today; cn++;
  }
  for (int x = 1; x < cn; x++) { Cand v = cand[x]; int y = x - 1; while (y >= 0 && cand[y].key > v.key) { cand[y + 1] = cand[y]; y--; } cand[y + 1] = v; }
  const int n = cn < PRIN_ROWS ? cn : PRIN_ROWS;
  int nextI = -1;
  for (int i = 0; i < n; i++) if (cand[i].today && cand[i].m > nm && cand[i].m < 24 * 60 && nextI < 0) nextI = i;
  JsonArray its = s_sched["items"].as<JsonArray>();
  for (int i = 0; i < PRIN_ROWS; i++) {
    if (i >= n) { show(s_pRow[i], false); continue; }
    show(s_pRow[i], true);
    const Cand &q = cand[i];
    JsonArray r = its[q.idx];
    const char *sd = r[0] | "", *ed = r[1] | "";
    const bool cur = q.today && q.m >= 0 && q.e > 0 && q.m <= nm && nm < q.e;
    const bool past = q.today && q.e > 0 && q.e <= nm;
    const bool nxt = i == nextI && !cur;
    lv_obj_set_user_data(s_pRow[i], (void *)(intptr_t)q.idx);   // 누르면 자세히
    lv_obj_add_flag(s_pRow[i], LV_OBJ_FLAG_CLICKABLE);
    setTextIf(s_pRowT[i], q.today ? "오늘" : mdOf(String(sd)).c_str());
    setTextIf(s_pRowA[i], r[3] | "");
    String sub = (const char *)(r[2] | "");
    const char *pl = r[4] | "";
    if (*pl) { if (sub.length()) sub += " · "; sub += pl; }
    if (q.today && strcmp(ed, td.c_str()) > 0) { if (sub.length()) sub += " · "; sub += "~" + String(String(ed).substring(5, 7).toInt()) + "/" + String(ed).substring(8, 10).toInt(); }
    if (!sub.length()) sub = (const char *)(r[5] | "");   // 시간·장소가 없으면 부서
    setTextIf(s_pRowB[i], sub.c_str());
    lv_obj_set_width(s_pRowA[i], sub.length() ? 254 : 354);   // 오른쪽 글이 없으면 제목이 줄 끝까지
    lv_obj_set_style_bg_color(s_pRow[i], lv_color_hex(cur ? NOW_ROW : D_ROW), 0);
    lv_obj_set_style_border_color(s_pRow[i], lv_color_hex(cur ? NOW_ROW : nxt ? NEXT_BD : D_LINE), 0);
    lv_obj_set_style_border_width(s_pRow[i], nxt ? 2 : 1, 0);
    lv_obj_set_style_bg_color(lv_obj_get_parent(s_pRowT[i]), lv_color_hex(q.today ? NOW_TAG : D_LINE), 0);
    lv_obj_set_style_text_color(s_pRowT[i], lv_color_hex(q.today ? NOW_TX : D_SUB), 0);
    lv_obj_set_style_text_color(s_pRowA[i], lv_color_hex(cur ? C_TEXT : past ? D_MUTED : D_TEXT), 0);
    lv_obj_set_style_text_color(s_pRowB[i], lv_color_hex(cur ? C_MUTED : D_MUTED), 0);
  }
  if (!n) {   // 일정이 없거나 주소가 없을 때 안내 한 줄
    show(s_pRow[0], true);
    lv_obj_clear_flag(s_pRow[0], LV_OBJ_FLAG_CLICKABLE);
    setTextIf(s_pRowT[0], "-");
    setTextIf(s_pRowA[0], HAS_SCHED ? "다가오는 학교 일정이 없습니다" : "학교 일정 주소가 아직 없습니다 · 관리자 확인");
    setTextIf(s_pRowB[0], "");
    lv_obj_set_width(s_pRowA[0], 354);
    lv_obj_set_style_bg_color(s_pRow[0], lv_color_hex(D_ROW), 0);
    lv_obj_set_style_border_color(s_pRow[0], lv_color_hex(D_LINE), 0);
    lv_obj_set_style_border_width(s_pRow[0], 1, 0);
    lv_obj_set_style_bg_color(lv_obj_get_parent(s_pRowT[0]), lv_color_hex(D_LINE), 0);
    lv_obj_set_style_text_color(s_pRowT[0], lv_color_hex(D_SUB), 0);
    lv_obj_set_style_text_color(s_pRowA[0], lv_color_hex(D_MUTED), 0);
  }
  // 학사 일정 D-day(시험·행사·휴일, 오늘부터 3개, 같은 이름이 이어지면 묶는다: 중간고사 10/20~10/22)
  int k = 0;
  JsonArray ac = s_sched["acad"].as<JsonArray>();
  for (int ai = 0; ai < (int)ac.size() && k < 3; ai++) {
    const String dt = ac[ai][0] | "";
    if (dt < td) continue;
    const char *nmA = ac[ai][1] | "";
    String endD = dt;
    while (ai + 1 < (int)ac.size() && !strcmp(ac[ai + 1][1] | "", nmA) && dayNoOf(String((const char *)(ac[ai + 1][0] | ""))) - dayNoOf(endD) == 1) { ai++; endD = (const char *)(ac[ai][0] | ""); }
    const long left = dayNoOf(dt) - dayNoOf(td);
    String when = mdOf(dt);
    if (endD != dt) when += "~" + String(endD.substring(5, 7).toInt()) + "/" + endD.substring(8, 10).toInt();
    String line = String(nmA) + "  ·  " + when + "  ·  " + (left == 0 ? String("오늘") : String("D-") + left);
    setTextIf(s_pAcad[k], line.c_str());
    lv_obj_set_style_text_color(s_pAcad[k], lv_color_hex(left == 0 ? NOW_TAG : left <= 3 ? D_TEXT : D_SUB), 0);
    show(s_pAcad[k], true);
    k++;
  }
  if (!k && s_pAcad[0]) { setTextIf(s_pAcad[0], "다가오는 학사 일정이 없습니다"); lv_obj_set_style_text_color(s_pAcad[0], lv_color_hex(D_MUTED), 0); show(s_pAcad[0], true); k = 1; }
  for (; k < 3; k++) show(s_pAcad[k], false);
}
static void showSchedDetail(int i) {
  JsonArray r = s_sched["items"][i];
  if (r.isNull() || !s_pDetail) return;
  const String sd = r[0] | "", ed = r[1] | "";
  String d = schedDay(sd, ed);
  const String td = todayIso();
  if (td.length()) { const long l = dayNoOf(sd) - dayNoOf(td); d += l <= 0 ? String(ed >= td ? "  ·  오늘" : "") : l == 1 ? String("  ·  내일") : String("  ·  D-") + l; }
  lv_label_set_text(s_dDate, d.c_str());
  lv_label_set_text(s_dTitle, r[3] | "");
  String info;
  auto line = [&](const char *k, const char *v) { if (v && *v) { if (info.length()) info += (char)10; info += k; info += "   "; info += v; } };
  line("시간", r[2] | ""); line("장소", r[4] | ""); line("부서", r[5] | ""); line("담당", r[6] | ""); line("내용", r[7] | "");
  if (!info.length()) info = "자세한 내용이 없습니다";
  lv_label_set_text(s_dInfo, info.c_str());
  show(s_pDetail, true);
  lv_obj_move_foreground(s_pDetail);
}
static void renderSchedList() {   // 주간 장(교장 모드): 학교 일정 30일, 한 쪽 7개
  if (!s_schedPanel) return;
  static int idx[64]; const int n = schedSorted(idx, 64);
  const int pages = n > 0 ? (n + 6) / 7 : 1;
  if (s_sPg >= pages) s_sPg = pages - 1;
  const String td = todayIso();
  JsonArray items = s_sched["items"].as<JsonArray>();
  for (int k = 0; k < 7; k++) {
    const int j = s_sPg * 7 + k;
    if (j >= n) { show(s_sRow[k], false); continue; }
    JsonArray r = items[idx[j]];
    const String sd = r[0] | "", ed = r[1] | "";
    const bool today = sd <= td;
    show(s_sRow[k], true);
    lv_obj_set_user_data(s_sRow[k], (void *)(intptr_t)idx[j]);
    setTextIf(s_sRowT[k], today ? "오늘" : mdOf(sd).c_str());
    lv_obj_set_style_bg_color(lv_obj_get_parent(s_sRowT[k]), lv_color_hex(today ? NOW_TAG : D_LINE), 0);
    lv_obj_set_style_text_color(s_sRowT[k], lv_color_hex(today ? NOW_TX : D_SUB), 0);
    setTextIf(s_sRowA[k], r[3] | "");
    String sub = schedDay(sd, ed);
    const char *tm = r[2] | "", *pl = r[4] | "", *dp = r[5] | "";
    if (*tm) { sub += " · "; sub += tm; }
    if (*pl) { sub += " · "; sub += pl; }
    if (*dp) { sub += " · "; sub += dp; }
    setTextIf(s_sRowB[k], sub.c_str());
  }
  char pg[48];
  if (n) snprintf(pg, sizeof pg, "%d / %d", s_sPg + 1, pages);
  else snprintf(pg, sizeof pg, "%s", HAS_SCHED ? "다가오는 일정 없음" : "학교 일정 주소가 아직 없습니다");
  setTextIf(s_sPage, pg);
}
static void onSchedPage(lv_event_t *e) { s_sPg += (int)(intptr_t)lv_event_get_user_data(e); if (s_sPg < 0) s_sPg = 0; renderSchedList(); }

// ── 와이파이 (평소 꺼 두고 1시간마다 잠깐 켜서 시간·자료를 받는다) ──
enum SyncState { SYNC_IDLE, SYNC_CONNECTING, SYNC_TIME };
static SyncState s_sync = SYNC_IDLE;
static uint32_t s_syncStart = 0, s_lastSync = 0;
static bool s_triedOnce = false, s_lastOk = false;
static int s_failCount = 0;   // 실패하면 1·2·5·10분 뒤 다시, 그 뒤로는 10분마다
static char s_lastHM[8] = "";
static volatile bool s_syncReq = false, s_scanReq = false;
static const uint32_t SYNC_EVERY_MS = 3600UL * 1000;
static volatile int s_wifiReason = 0;
static bool s_retried = false;
static bool s_mealRetry = false;   // 오늘 급식만 못 받았으면 10분 뒤 한 번 더(하루 한 번)

// 받은 자료가 오래됐으면 글을 만들어 참을 돌려준다(잇따라 2번 실패 또는 마지막 성공이 6시간 넘음)
static bool staleText(char *buf, size_t n) {
  if (!timeValid()) return false;
  const time_t now = time(nullptr);
  if (!s_lastOkT) { if (s_failCount >= 2) { snprintf(buf, n, "아직 자료를 받지 못했습니다"); return true; } return false; }
  if (s_failCount < 2 && now - s_lastOkT < 6 * 3600) return false;
  struct tm tm; localtime_r(&s_lastOkT, &tm);
  snprintf(buf, n, "자료 갱신 안 됨 · %d/%d %02d:%02d 기준", tm.tm_mon + 1, tm.tm_mday, tm.tm_hour, tm.tm_min);
  return true;
}
static void refreshStale() {   // 받기가 끝날 때·분이 바뀔 때만 부른다(lock 안에서)
  char b[80]; const bool st = staleText(b, sizeof b);
  lv_obj_t *l[] = {s_stale, s_pStale};
  for (lv_obj_t *x : l) {
    if (!x) continue;
    if (st) { setTextIf(x, b); lv_obj_clear_flag(x, LV_OBJ_FLAG_HIDDEN); }
    else if (!lv_obj_has_flag(x, LV_OBJ_FLAG_HIDDEN)) lv_obj_add_flag(x, LV_OBJ_FLAG_HIDDEN);
  }
}
static bool quietNow() {   // 밤(22:00~07:00)·주말은 2시간마다만 받는다
  if (!timeValid()) return false;
  time_t t = time(nullptr); struct tm tm; localtime_r(&t, &tm);
  return tm.tm_wday == 0 || tm.tm_wday == 6 || tm.tm_hour < 7 || tm.tm_hour >= 22;
}
static bool inClassNow() {   // 수업 중(평일, 교시 시작 1분 전~끝)에는 받기를 쉬는 시간으로 미룬다(받을 때 화면이 잠깐 깜빡이므로)
  if (!timeValid()) return false;
  time_t t = time(nullptr); struct tm tm; localtime_r(&t, &tm);
  if (tm.tm_wday == 0 || tm.tm_wday == 6) return false;
  const int nm = tm.tm_hour * 60 + tm.tm_min;
  for (int p = 0; p < 7; p++) { const int st = toMin(PERIOD_START[p]); if (nm >= st - 1 && nm < st + 50) return true; }
  return false;
}
static uint32_t syncWaitMs() {
  if (s_mealRetry) return 10 * 60000UL;
  if (s_triedOnce && !timeValid()) return 60000UL;   // 시각을 모르면 시계·일정이 다 틀린다 → 1분마다 다시
  if (s_lastOk) return quietNow() ? 2 * 3600UL * 1000 : SYNC_EVERY_MS;
  if (s_ttCode == 404 || s_ttCode == 403) return 6 * 3600UL * 1000;   // 주소에 파일이 없다 → 6시간 뒤
  static const uint32_t RETRY_MS[] = {60000, 120000, 300000, 600000};
  return RETRY_MS[s_failCount < 4 ? (s_failCount > 0 ? s_failCount - 1 : 0) : 3];
}

static void setStatus(const char *s) { lv_label_set_text(s_status, s); }
static void refreshWifiLabel() {
  String ssid = s_prefs.getString("ssid", "");
  if (!ssid.length()) {
    lv_label_set_text(s_wifiLbl, "#e11d48 " LV_SYMBOL_WIFI " 없음#");
    lv_label_set_text(s_wifiInfo, "저장한 와이파이가 없습니다. [찾기]를 누르고 고르세요.");
    return;
  }
  if (s_sync != SYNC_IDLE) {
    lv_label_set_text(s_wifiLbl, "#f59e0b " LV_SYMBOL_REFRESH " 받는 중#");
    lv_label_set_text_fmt(s_wifiInfo, "'%s'에 잠깐 연결해 받는 중입니다.", ssid.c_str());
    return;
  }
  if (!s_triedOnce) lv_label_set_text(s_wifiLbl, "#10b981 " LV_SYMBOL_WIFI " 대기#");
  else lv_label_set_text_fmt(s_wifiLbl, "#%s %s %s %s#", s_lastOk ? "10b981" : "e11d48", LV_SYMBOL_WIFI, s_lastHM, s_lastOk ? "받음" : "실패");
  lv_label_set_text_fmt(s_wifiInfo, "'%s' 저장됨. 1시간마다 잠깐 연결해 받고 끕니다.", ssid.c_str());
}
static void wifiOff() { if (WiFi.getMode() == WIFI_OFF) return; WiFi.disconnect(true, false); WiFi.mode(WIFI_OFF); }
static const char *wifiReasonText(int r) {
  switch (r) {
    case 201: return "공유기를 찾지 못함";
    case 200: case 2: return "신호가 약함";
    case 15: case 204: case 202: return "비밀번호가 맞지 않음";
    case 203: return "공유기가 연결을 받지 않음";
    case 0: return "응답 없음";
    default: return "연결 실패";
  }
}
static void wifiBegin() {
  String ssid = s_prefs.getString("ssid", ""), pw = s_prefs.getString("pw", "");
  WiFi.setScanMethod(WIFI_ALL_CHANNEL_SCAN);          // 같은 이름 공유기가 여러 대면 신호가 가장 센 곳에
  WiFi.setSortMethod(WIFI_CONNECT_AP_BY_SIGNAL);
  WiFi.begin(ssid.c_str(), pw.c_str());
  WiFi.setSleep(false);
}
static void startSync() {
  String ssid = s_prefs.getString("ssid", "");
  if (!ssid.length()) return;
  static bool evt = false;
  if (!evt) {
    evt = true;
    WiFi.onEvent([](arduino_event_id_t, arduino_event_info_t info) { s_wifiReason = info.wifi_sta_disconnected.reason; },
                 ARDUINO_EVENT_WIFI_STA_DISCONNECTED);
  }
  lcdSlow(true);   // 받는 동안 화면 박자를 낮춘다
  WiFi.persistent(false);
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(false);
  s_wifiReason = 0; s_retried = false;
  wifiBegin();
  s_sync = SYNC_CONNECTING; s_syncStart = millis();
  Serial.printf("sync: connecting %s (internal free %u, largest %u)\n", ssid.c_str(),
                (unsigned)heap_caps_get_free_size(MALLOC_CAP_INTERNAL), (unsigned)heap_caps_get_largest_free_block(MALLOC_CAP_INTERNAL));
  lock(); refreshWifiLabel(); setStatus("연결하는 중..."); unlock();
}
static void finishSync(bool ok, const char *msg) {
  s_triedOnce = true; s_lastOk = ok; s_lastSync = millis();
  s_failCount = ok ? 0 : s_failCount + 1;
  if (timeValid()) { time_t t = time(nullptr); struct tm tm; localtime_r(&t, &tm); snprintf(s_lastHM, sizeof s_lastHM, "%02d:%02d", tm.tm_hour, tm.tm_min); }
  {   // 시간표는 받았는데 오늘 급식만 못 받았으면 10분 뒤 한 번 더(낮에만, 하루 한 번)
    static String retried;
    const String td = todayIso();
    s_mealRetry = ok && MEAL_ON && td.length() && s_mealDate != td && retried != td && !quietNow();
    if (s_mealRetry) retried = td;
  }
  if (ok && timeValid()) { s_lastOkT = time(nullptr); s_prefs.putULong("lastok", (uint32_t)s_lastOkT); }   // 성공할 때 한 번만 쓴다
  if (!ok) Serial.printf("sync fail #%d: %s\n", s_failCount, msg);
  Serial.printf("heap: internal free %u, largest %u\n", (unsigned)heap_caps_get_free_size(MALLOC_CAP_INTERNAL), (unsigned)heap_caps_get_largest_free_block(MALLOC_CAP_INTERNAL));
  wifiOff();
  lcdSlow(false);  // 되돌리고 박자를 다시 맞춘다
  s_sync = SYNC_IDLE;
  Serial.printf("sync: %s (%s)\n", ok ? "ok" : "fail", msg);
  lock(); refreshWifiLabel(); setStatus(msg); refreshStale(); unlock();
}
static void connectWifi(const String &ssid, const String &pw) {
  s_prefs.putString("ssid", ssid); s_prefs.putString("pw", pw);
  if (s_sync != SYNC_IDLE) wifiOff();
  s_sync = SYNC_IDLE;
  s_syncReq = true;
}
static void closePw() { lv_obj_t *o[] = {s_pwBg, s_pwBox, s_kb}; for (lv_obj_t *x : o) if (x) show(x, false); }
static void pwCancel(lv_event_t *) {   // 비밀번호를 모르는 와이파이를 잘못 골랐을 때: 닫고 목록으로
  lv_textarea_set_text(s_pwTa, "");
  closePw();
  lv_label_set_text(s_wifiInfo, "취소했습니다. 목록에서 다른 와이파이를 고르세요.");
}
static void hideOverlays() {   // 덮개 창(비밀번호·자판·일정 자세히·열린 목록)을 모두 닫는다
  closePw();
  if (s_pDetail) show(s_pDetail, false);
  if (s_ttPick && lv_dropdown_is_open(s_ttPick)) lv_dropdown_close(s_ttPick);
}
static bool overlayOpen() {
  lv_obj_t *o[] = {s_pDetail, s_pwBox};
  for (lv_obj_t *x : o) if (x && !lv_obj_has_flag(x, LV_OBJ_FLAG_HIDDEN)) return true;
  return s_ttPick && lv_dropdown_is_open(s_ttPick);
}
static void onSsidPick(lv_event_t *e) {
  lv_obj_t *btn = lv_event_get_target(e);
  s_pickSsid = String(lv_list_get_btn_text(s_wifiList, btn));
  int sp = s_pickSsid.lastIndexOf("  (");
  if (sp > 0) s_pickSsid = s_pickSsid.substring(0, sp);
  if ((intptr_t)lv_obj_get_user_data(btn) == 1) {     // 비밀번호 없는 와이파이는 바로 연결
    lv_label_set_text_fmt(s_wifiInfo, "'%s'에 연결하는 중... (비밀번호 없음)", s_pickSsid.c_str());
    connectWifi(s_pickSsid, "");
    return;
  }
  lv_label_set_text_fmt(lv_obj_get_child(s_pwBox, 0), "'%s' 비밀번호", s_pickSsid.c_str());
  lv_textarea_set_text(s_pwTa, "");
  { lv_obj_t *o[] = {s_pwBg, s_pwBox, s_kb}; for (lv_obj_t *x : o) { show(x, true); lv_obj_move_foreground(x); } }   // 막 → 창 → 자판 차례로 위에
}
static void onKb(lv_event_t *e) {
  lv_event_code_t code = lv_event_get_code(e);
  if (code == LV_EVENT_READY) {
    String pw = lv_textarea_get_text(s_pwTa);
    if (!pw.length()) { pwCancel(e); return; }   // 빈 채로 입력을 누르면 취소(빈 비밀번호를 저장하지 않는다)
    closePw();
    lv_label_set_text_fmt(s_wifiInfo, "'%s'에 연결하는 중...", s_pickSsid.c_str());
    connectWifi(s_pickSsid, pw);
  } else if (code == LV_EVENT_CANCEL) pwCancel(e);
}
static void onScan(lv_event_t *) { s_scanReq = true; lv_obj_clean(s_wifiList); lv_list_add_text(s_wifiList, "찾는 중..."); }
static void onForget(lv_event_t *e) {   // 실수로 지우지 않게: 3초 안에 한 번 더 눌러야 지운다
  static uint32_t armed = 0;
  lv_obj_t *b = lv_event_get_current_target(e);
  if (!armed || millis() - armed > 3000) { armed = millis(); lv_label_set_text(lv_obj_get_child(b, 0), "한 번 더 누르면 지웁니다"); return; }
  armed = 0; lv_label_set_text(lv_obj_get_child(b, 0), "저장한 와이파이 지우기");
  s_prefs.remove("ssid"); s_prefs.remove("pw"); wifiOff(); s_sync = SYNC_IDLE; refreshWifiLabel();
}
static void onPickTT(lv_event_t *) {
  const int sel = (int)lv_dropdown_get_selected(s_ttPick);
  if (sel < PICK_SPECIAL) {   // 교장·교감 → 교장실 모드
    s_pickName = sel == 0 ? "@교장" : "@교감";
  } else {
    JsonObject it = s_index["items"][sel - PICK_SPECIAL];
    if (!it.isNull()) {
      if (s_pickName != (const char *)(it["name"] | "")) { s_ttLoaded = false; s_ttName = ""; }   // 다른 사람을 고르면 옛 시간표를 보이지 않는다
      s_pickName = (const char *)(it["name"] | "");
      s_ttFile = (const char *)(it["file"] | "");
    }
  }
  s_prefs.putString("ttname", s_pickName);
  s_principal = s_pickName.startsWith("@");
  applyMode();   // 드롭다운 안에서 목록을 다시 만들지 않고 장만 바꾼다
  renderTT();
  s_syncReq = true;
  setStatus(s_principal ? "곧 학교 일정을 받습니다..." : "곧 새 시간표를 받습니다...");
}

// ── 단축키 장 (스트림덱처럼) ──
// 보드는 칩 내장 USB(USB-Serial/JTAG, ARDUINO_USB_CDC_ON_BOOT=1)로 컴퓨터와 이어져 있다. 단추를 누르면 그 선으로 '@deck 이름' 한 줄을 보내고,
// 컴퓨터의 도우미(tools/deck_helper.ps1)가 받아 프로그램·사이트를 연다. 도우미는 5초마다 '@pc on' 을 보내 준다 → 보드는 '@board ok' 로 답한다
// (도우미가 알림판 포트를 가려내는 데 쓴다). 15초 넘게 안 오면 '컴퓨터 꺼짐'. 이 신호는 화면 불 규칙에도 쓴다(loop).
extern const lv_img_dsc_t deck_explorer, deck_claude, deck_gemini, deck_gpt, deck_cmd, deck_powershell, deck_neis, deck_naver,
    deck_youtube, deck_coolmsg, deck_kakao, deck_excel, deck_ppt, deck_close, deck_hwp, deck_desktop;
struct DeckItem { const char *label; const lv_img_dsc_t *icon; const char *key; };   // key: 도우미에게 보내는 이름(영문)
static const DeckItem DECK[16] = {
  {"탐색기", &deck_explorer, "explorer"}, {"Claude", &deck_claude, "claude"}, {"제미나이", &deck_gemini, "gemini"}, {"GPT", &deck_gpt, "gpt"},
  {"CMD", &deck_cmd, "cmd"}, {"파워셸", &deck_powershell, "powershell"}, {"나이스", &deck_neis, "neis"}, {"네이버", &deck_naver, "naver"},
  {"유튜브", &deck_youtube, "youtube"}, {"쿨메신저", &deck_coolmsg, "coolmsg"}, {"카카오톡", &deck_kakao, "kakao"}, {"엑셀", &deck_excel, "excel"},
  {"PPT", &deck_ppt, "ppt"}, {"창닫기", &deck_close, "close"}, {"한글", &deck_hwp, "hwp"}, {"바탕화면", &deck_desktop, "desktop"},
};
static volatile bool s_usbOn = false;     // 컴퓨터 도우미가 살아 있나('@pc on' 이 15초 안에 왔나)
static volatile bool s_usbSeen = false;   // 켠 뒤 한 번이라도 도우미 신호를 받았나 → 화면 불은 컴퓨터를 따른다
static uint32_t s_pcLast = 0;             // 마지막 '@pc on' 받은 때(millis)
static void deckStateText() {
  if (!s_deckState) return;
  lv_label_set_text(s_deckState, s_usbOn ? LV_SYMBOL_OK "  컴퓨터와 연결됨 · 단추를 누르면 컴퓨터에서 프로그램이 열립니다"
                                         : LV_SYMBOL_WARNING "  컴퓨터 도우미를 기다리는 중 · USB 선을 꽂고 컴퓨터에서 도우미를 켜 주세요");
  lv_obj_set_style_text_color(s_deckState, lv_color_hex(s_usbOn ? 0x34d399 : D_MUTED), 0);
}
static void onDeck(lv_event_t *e) {
  const int i = (int)(intptr_t)lv_event_get_user_data(e);
  if (i < 0 || i >= 16) return;
  if (!s_usbOn) {
    if (s_deckState) {
      lv_label_set_text(s_deckState, LV_SYMBOL_WARNING "  컴퓨터 도우미와 연결되지 않았습니다 · USB 선과 컴퓨터의 도우미 프로그램을 확인하세요");
      lv_obj_set_style_text_color(s_deckState, lv_color_hex(0xfb923c), 0);
    }
    return;
  }
  Serial.printf("\n@deck %s\n", DECK[i].key);   // 앞의 줄바꿈: 다른 기록 줄과 섞이지 않게
  if (s_deckState) {
    lv_label_set_text_fmt(s_deckState, LV_SYMBOL_OK "  '%s' 신호를 컴퓨터로 보냈습니다", DECK[i].label);
    lv_obj_set_style_text_color(s_deckState, lv_color_hex(0x34d399), 0);
  }
}
// USB 로 들어온 줄 읽기(loop 에서). '@pc on' 이면 컴퓨터가 켜져 있다.
static void deckPoll(uint32_t ms) {
  static char buf[32]; static uint8_t n = 0;
  while (Serial.available()) {
    const char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      buf[n] = 0;
      if (!strcmp(buf, "@pc on")) { s_pcLast = ms ? ms : 1; s_usbSeen = true; Serial.printf("@board ok\n"); }   // 한 번에 보낸다(중간에 다른 기록이 끼지 않게)
      n = 0;
    } else if (n < sizeof buf - 1) buf[n++] = c;
    else n = 0;
  }
  s_usbOn = s_pcLast && ms - s_pcLast < 15000;
}

// ── 장 넘기기 ──
static void markDots() {
  for (int i = 0; i < P_COUNT; i++) {
    lv_obj_set_width(s_dot[i], i == s_page ? 18 : 7);
    lv_obj_set_style_bg_color(s_dot[i], lv_color_hex(i == s_page ? D_SUB : D_LINE), 0);
  }
}
static void onTile(lv_event_t *) {
  lv_obj_t *t = lv_tileview_get_tile_act(s_tv);
  for (int i = 0; i < P_COUNT; i++) if (s_tile[i] == t) s_page = i;
  markDots();
  if (s_page == P_FIND && s_findGridDirty) fillFinderGrid();
  if (s_page == P_FIND) renderFinder();
  if (s_page == P_SET) refreshWifiLabel();
  if (s_page == P_DECK) deckStateText();      // 들어오기 전에 신호가 바뀌었을 수 있다
  if (s_page == P_WEEK && s_principal) { s_sPg = 0; renderSchedList(); }
  if (s_page != P_SET) closePw();
}
static void goPage(int p) {
  lv_obj_set_tile_id(s_tv, p, 0, LV_ANIM_OFF);
  s_page = p; markDots();
  if (p == P_FIND && s_findGridDirty) fillFinderGrid();
  if (p == P_FIND) renderFinder();
  if (p == P_DECK) deckStateText();
}

// ── 화면 만들기  ──
static const int M = 10, PW = W - 2 * M, PH = H - 2 * M - 14;   // 장마다 판 하나, 아래 14px 는 점
static lv_obj_t *panel(int page) {
  lv_obj_t *p = box(s_tile[page], D_PANEL, D_LINE, 14);
  lv_obj_set_size(p, PW, PH); lv_obj_set_pos(p, M, M);
  return p;
}
static void buildClock() {
  lv_obj_t *p = panel(P_CLOCK);
  s_clockPanel = p;
  const int P = 16, CW = PW - 2 * P;
  s_big = label(p, &num120, D_TEXT, "--:--");
  lv_obj_set_width(s_big, PW); lv_obj_set_style_text_align(s_big, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_set_pos(s_big, 0, 18);
  s_stale = label(p, &kr14, 0xfb923c, "");   // 맨 위 왼쪽: '자료 갱신 안 됨 · M/D HH:MM 기준'(받기가 계속 실패할 때만)
  lv_obj_set_width(s_stale, CW - 120); lv_label_set_long_mode(s_stale, LV_LABEL_LONG_DOT); lv_obj_set_pos(s_stale, P, 3); show(s_stale, false);
  s_bat = label(p, &kr14, D_MUTED, "");      // 맨 위 오른쪽: 배터리(읽을 수 있을 때만)
  lv_obj_align(s_bat, LV_ALIGN_TOP_RIGHT, -12, 3); show(s_bat, false);
  s_bigDate = label(p, &kr20, D_SUB, "");
  lv_obj_set_pos(s_bigDate, P, 118);
  s_dday = label(p, &kr14, 0xfecaca, "");
  lv_obj_set_style_bg_opa(s_dday, LV_OPA_COVER, 0);
  lv_obj_set_style_bg_color(s_dday, lv_color_hex(0x7f1d1d), 0);
  lv_obj_set_style_border_width(s_dday, 1, 0);
  lv_obj_set_style_border_color(s_dday, lv_color_hex(D_RED), 0);
  lv_obj_set_style_radius(s_dday, 12, 0);
  lv_obj_set_style_pad_hor(s_dday, 10, 0);
  lv_obj_set_style_pad_ver(s_dday, 3, 0);
  lv_obj_align(s_dday, LV_ALIGN_TOP_RIGHT, -P, 116);
  show(s_dday, false);

  // 날씨: 오늘 | 내일 + 미세먼지
  const int WY = 150, WH = 100;
  lv_obj_t *wc = box(p, D_ROW, D_LINE, 12);
  lv_obj_set_size(wc, CW, WH); lv_obj_set_pos(wc, P, WY);
  lv_obj_t *sep = box(wc, D_LINE, 0, 0);
  lv_obj_set_size(sep, 1, 58); lv_obj_set_pos(sep, CW / 2, 9);
  lv_obj_t *sep2 = box(wc, D_LINE, 0, 0);
  lv_obj_set_size(sep2, CW - 24, 1); lv_obj_set_pos(sep2, 12, 75);
  s_dust = label(wc, &kr14, D_SUB, "");
  lv_label_set_recolor(s_dust, true);
  lv_obj_set_width(s_dust, CW - 24); lv_label_set_long_mode(s_dust, LV_LABEL_LONG_DOT);
  lv_obj_set_pos(s_dust, 12, 80);
  for (int i = 0; i < 2; i++) {
    const int x = i * CW / 2;
    WxCard &k = s_card[i];
    k.img = lv_img_create(wc);
    lv_obj_set_pos(k.img, x + 6, 5);
    k.desc = label(wc, &kr14, D_MUTED, i == 0 ? "오늘" : "내일");
    lv_obj_set_pos(k.desc, x + 76, 6);
    k.temp = label(wc, &num44, D_TEXT, "");
    lv_obj_set_pos(k.temp, x + 76, 24);
    k.line = label(wc, &kr14, D_SUB, "");
    lv_label_set_recolor(k.line, true);
    lv_obj_set_width(k.line, CW / 2 - 84); lv_label_set_long_mode(k.line, LV_LABEL_LONG_DOT);
    lv_obj_set_pos(k.line, x + 76, 58);
  }

  // 지금 / 다음 띠
  s_band = box(p, C_PRIMARY, 0, 10);
  lv_obj_set_style_bg_grad_color(s_band, lv_color_hex(0x9a3412), 0);
  lv_obj_set_style_bg_grad_dir(s_band, LV_GRAD_DIR_HOR, 0);
  lv_obj_set_size(s_band, CW, 66); lv_obj_set_pos(s_band, P, 258);
  auto tag = [&](const char *txt, int y) {
    lv_obj_t *t = box(s_band, 0xffffff, 0, 6);
    lv_obj_set_style_bg_opa(t, 46, 0);
    lv_obj_set_size(t, 40, 22); lv_obj_set_pos(t, 10, y);
    lv_obj_center(label(t, &kr14, 0xffffff, txt));
    return t;
  };
  auto line = [&](int y) {
    lv_obj_t *l = label(s_band, &kr16, 0xfee2e2, "");
    lv_label_set_recolor(l, true);
    lv_obj_set_width(l, CW - 68); lv_label_set_long_mode(l, LV_LABEL_LONG_DOT);
    lv_obj_set_pos(l, 58, y + 2);
    return l;
  };
  s_nowTag = tag("지금", 7); s_nowLbl = line(7);
  s_bandSep = box(s_band, 0xffffff, 0, 0);
  lv_obj_set_style_bg_opa(s_bandSep, 64, 0);
  lv_obj_set_size(s_bandSep, CW - 20, 1); lv_obj_set_pos(s_bandSep, 10, 36);
  s_nextTag = tag("다음", 39); s_nextLbl = line(39);

  // 할 일 + 점심/저녁
  s_info = box(p, D_ROW, D_LINE, 12);
  lv_obj_set_pos(label(s_info, &kr14, D_MUTED, "할 일"), 12, 10);
  s_duty = label(s_info, &kr14, 0xfcd34d, "");
  lv_obj_set_width(s_duty, CW - 68); lv_label_set_long_mode(s_duty, LV_LABEL_LONG_DOT);
  lv_obj_set_pos(s_duty, 56, 10);
  lv_obj_t *hr = box(s_info, D_LINE, 0, 0);
  lv_obj_set_size(hr, CW - 24, 1); lv_obj_set_pos(hr, 12, 34);
  s_mealTitle = label(s_info, &kr14, D_MUTED, "점심");
  lv_obj_set_pos(s_mealTitle, 12, 42);
  s_meal = label(s_info, &kr14, D_SUB, "");
  lv_obj_set_style_text_line_space(s_meal, 3, 0);
  lv_obj_set_width(s_meal, CW - 68); lv_label_set_long_mode(s_meal, LV_LABEL_LONG_DOT);
  lv_obj_set_pos(s_meal, 56, 41);
  setBand(true);
}
static void buildToday() {
  lv_obj_t *p = panel(P_TODAY);
  s_dayTitle = label(p, &kr20, D_TEXT, "");
  lv_obj_set_pos(s_dayTitle, 14, 12);
  s_dayTag = label(p, &kr14, 0x991b1b, "");
  lv_obj_set_style_bg_opa(s_dayTag, LV_OPA_COVER, 0);
  lv_obj_set_style_bg_color(s_dayTag, lv_color_hex(0xfee2e2), 0);
  lv_obj_set_style_radius(s_dayTag, 10, 0);
  lv_obj_set_style_pad_hor(s_dayTag, 8, 0);
  show(s_dayTag, false);
  s_dayClock = label(p, &kr16, D_MUTED, "");
  lv_obj_align(s_dayClock, LV_ALIGN_TOP_RIGHT, -14, 14);
  const int Y0 = 44, PITCH = 50, RH = 45, TW = 62, RW = PW - 20;
  for (int r = 0; r < 8; r++) {
    int per = periodOfRow(r);
    s_row[r] = box(p, D_ROW, D_LINE, 8);
    lv_obj_set_size(s_row[r], RW, RH); lv_obj_set_pos(s_row[r], 10, Y0 + r * PITCH);
    s_rowP[r] = box(s_row[r], D_LINE, 0, 6);
    lv_obj_set_size(s_rowP[r], TW, RH - 10); lv_obj_align(s_rowP[r], LV_ALIGN_LEFT_MID, 4, 0);
    lv_obj_t *pl = label(s_rowP[r], &kr14, D_SUB, "");
    if (per < 0) lv_label_set_text(pl, "점심");
    else lv_label_set_text_fmt(pl, "%d교시\n%s", per + 1, PERIOD_START[per]);
    lv_obj_set_style_text_line_space(pl, -2, 0);
    lv_obj_set_style_text_align(pl, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_center(pl);
    s_rowA[r] = label(s_row[r], &kr16, D_TEXT, "");
    lv_obj_set_style_max_width(s_rowA[r], 180, 0);
    lv_label_set_long_mode(s_rowA[r], LV_LABEL_LONG_DOT);
    lv_obj_align(s_rowA[r], LV_ALIGN_LEFT_MID, TW + 16, 0);
    s_rowB[r] = label(s_row[r], &kr14, D_SUB, "");
    lv_obj_set_width(s_rowB[r], 120); lv_label_set_long_mode(s_rowB[r], LV_LABEL_LONG_DOT);
    lv_obj_set_style_text_align(s_rowB[r], LV_TEXT_ALIGN_RIGHT, 0);
    lv_obj_align(s_rowB[r], LV_ALIGN_RIGHT_MID, -12, 0);
    s_rowTag[r] = label(s_row[r], &kr14, 0xffffff, "");
    lv_obj_set_style_bg_opa(s_rowTag[r], LV_OPA_COVER, 0);
    lv_obj_set_style_radius(s_rowTag[r], 6, 0);
    lv_obj_set_style_pad_hor(s_rowTag[r], 5, 0);
    show(s_rowTag[r], false);
  }
}
static void onPrevWeek(lv_event_t *) { if (s_week > 0) { s_week--; renderWeek(); } }
static void onNextWeek(lv_event_t *) { if (s_ttLoaded && s_week + 1 < (int)s_tt["weeks"].size()) { s_week++; renderWeek(); } }
static void buildWeek() {
  lv_obj_t *p = panel(P_WEEK);
  s_weekPanel = p;
  s_weekLbl = label(p, &kr16, D_TEXT, "");
  lv_obj_set_width(s_weekLbl, PW - 110); lv_label_set_long_mode(s_weekLbl, LV_LABEL_LONG_DOT);
  lv_obj_set_pos(s_weekLbl, 12, 9);
  lv_obj_t *bn = button(p, LV_SYMBOL_RIGHT, 40, 28, D_ROW, D_TEXT);
  lv_obj_align(bn, LV_ALIGN_TOP_RIGHT, -8, 4);
  lv_obj_add_event_cb(bn, onNextWeek, LV_EVENT_CLICKED, nullptr);
  lv_obj_t *bp = button(p, LV_SYMBOL_LEFT, 40, 28, D_ROW, D_TEXT);
  lv_obj_align(bp, LV_ALIGN_TOP_RIGHT, -54, 4);
  lv_obj_add_event_cb(bp, onPrevWeek, LV_EVENT_CLICKED, nullptr);
  const int GX = 8, GY = 38, LW = 30, G = 3, HH = 24;
  const int CW = (PW - 2 * GX - LW - 5 * G) / 5, CH = (PH - GY - HH - G - 8 - 6 * G) / 7;
  for (int d = 0; d < 5; d++) {
    const int x = GX + LW + G + d * (CW + G);
    s_hd[d] = box(p, NOW_TAG, 0, 6);
    lv_obj_set_size(s_hd[d], CW, HH); lv_obj_set_pos(s_hd[d], x, GY);
    lv_obj_center(label(s_hd[d], &kr14, D_MUTED, DOW[d]));
    for (int r = 0; r < 7; r++) {
      lv_obj_t *c = box(p, D_ROW, D_LINE, 7);
      lv_obj_set_size(c, CW, CH); lv_obj_set_pos(c, x, GY + HH + G + r * (CH + G));
      s_cell[d][r] = c;
      s_cellA[d][r] = label(c, &kr14, D_TEXT, "");
      lv_obj_set_width(s_cellA[d][r], CW - 6); lv_label_set_long_mode(s_cellA[d][r], LV_LABEL_LONG_DOT);
      lv_obj_set_style_text_align(s_cellA[d][r], LV_TEXT_ALIGN_CENTER, 0);
      lv_obj_align(s_cellA[d][r], LV_ALIGN_CENTER, 0, -8);
      s_cellB[d][r] = label(c, &kr14, D_MUTED, "");
      lv_obj_set_width(s_cellB[d][r], CW - 6); lv_label_set_long_mode(s_cellB[d][r], LV_LABEL_LONG_DOT);
      lv_obj_set_style_text_align(s_cellB[d][r], LV_TEXT_ALIGN_CENTER, 0);
      lv_obj_align(s_cellB[d][r], LV_ALIGN_CENTER, 0, 9);
    }
  }
  for (int r = 0; r < 7; r++) {
    s_pl[r] = label(p, &kr16, D_MUTED, "");
    lv_label_set_text_fmt(s_pl[r], "%d", r + 1);
    lv_obj_set_width(s_pl[r], LW); lv_obj_set_style_text_align(s_pl[r], LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_set_pos(s_pl[r], GX, GY + HH + G + r * (CH + G) + (CH - 18) / 2);
  }
}
static void buildFinder() {
  lv_obj_t *p = panel(P_FIND);
  // 목록
  s_findList = box(p, D_PANEL, 0, 14);
  lv_obj_set_size(s_findList, PW - 2, PH - 2); lv_obj_set_pos(s_findList, 1, 1);
  lv_obj_set_pos(label(s_findList, &kr16, D_TEXT, "선생님 찾기"), 14, 12);
  lv_obj_align(label(s_findList, &kr14, D_MUTED, "이름을 누르세요"), LV_ALIGN_TOP_RIGHT, -14, 14);
  s_findGrid = lv_obj_create(s_findList);
  lv_obj_remove_style_all(s_findGrid);
  lv_obj_set_size(s_findGrid, PW - 16, PH - 50); lv_obj_set_pos(s_findGrid, 6, 42);
  lv_obj_set_flex_flow(s_findGrid, LV_FLEX_FLOW_ROW_WRAP);
  lv_obj_set_style_pad_gap(s_findGrid, 8, 0);
  lv_obj_set_style_pad_all(s_findGrid, 4, 0);
  lv_obj_set_scroll_dir(s_findGrid, LV_DIR_VER);
  // 자세히
  s_findDetail = box(p, D_PANEL, 0, 14);
  lv_obj_set_size(s_findDetail, PW - 2, PH - 2); lv_obj_set_pos(s_findDetail, 1, 1);
  show(s_findDetail, false);
  lv_obj_t *back = button(s_findDetail, LV_SYMBOL_LEFT " 목록", 76, 32, D_ROW, D_TEXT);
  lv_obj_set_pos(back, 8, 8);
  lv_obj_add_event_cb(back, onFindBack, LV_EVENT_CLICKED, nullptr);
  s_findName = label(s_findDetail, &kr20, D_TEXT, "");
  lv_obj_set_pos(s_findName, 96, 13);
  s_findHome = label(s_findDetail, &kr14, D_MUTED, "");
  lv_obj_align(s_findHome, LV_ALIGN_TOP_RIGHT, -14, 17);
  lv_obj_t *nowBox = box(s_findDetail, C_PRIMARY, 0, 12);
  lv_obj_set_style_bg_grad_color(nowBox, lv_color_hex(0x9a3412), 0);
  lv_obj_set_style_bg_grad_dir(nowBox, LV_GRAD_DIR_HOR, 0);
  lv_obj_set_size(nowBox, PW - 26, 62); lv_obj_set_pos(nowBox, 12, 50);
  s_findNowT = label(nowBox, &kr14, 0xfecaca, "");
  lv_obj_set_pos(s_findNowT, 14, 8);
  s_findNow = label(nowBox, &kr20, 0xffffff, "");
  lv_obj_set_width(s_findNow, PW - 54); lv_label_set_long_mode(s_findNow, LV_LABEL_LONG_DOT);
  lv_obj_set_pos(s_findNow, 14, 30);
  s_findNext = label(s_findDetail, &kr14, D_SUB, "");
  lv_obj_set_width(s_findNext, PW - 32); lv_label_set_long_mode(s_findNext, LV_LABEL_LONG_DOT);
  lv_obj_set_pos(s_findNext, 16, 122);
  s_findDay = label(s_findDetail, &kr14, D_MUTED, "");
  lv_obj_set_pos(s_findDay, 16, 146);
  for (int r = 0; r < 7; r++) {
    s_findRow[r] = box(s_findDetail, D_ROW, D_LINE, 6);
    lv_obj_set_size(s_findRow[r], PW - 26, 34); lv_obj_set_pos(s_findRow[r], 12, 170 + r * 38);
    s_findRowP[r] = label(s_findRow[r], &kr14, D_MUTED, "");
    lv_label_set_text_fmt(s_findRowP[r], "%d교시", r + 1);
    lv_obj_align(s_findRowP[r], LV_ALIGN_LEFT_MID, 10, 0);
    s_findRowT[r] = label(s_findRow[r], &kr16, D_TEXT, "");
    lv_obj_set_width(s_findRowT[r], PW - 26 - 80); lv_label_set_long_mode(s_findRowT[r], LV_LABEL_LONG_DOT);
    lv_obj_align(s_findRowT[r], LV_ALIGN_LEFT_MID, 66, 0);
  }
}
static void buildSettings() {
  lv_obj_t *p = panel(P_SET);
  lv_obj_set_pos(label(p, &kr20, D_TEXT, "와이파이"), 14, 12);
  s_wifiLbl = label(p, &kr14, D_MUTED, "");
  lv_label_set_recolor(s_wifiLbl, true);
  lv_obj_set_pos(s_wifiLbl, 104, 16);
  lv_obj_t *bScan = button(p, "찾기", 80, 32, C_PRIMARY, 0xffffff);
  lv_obj_align(bScan, LV_ALIGN_TOP_RIGHT, -10, 8);
  lv_obj_add_event_cb(bScan, onScan, LV_EVENT_CLICKED, nullptr);
  s_wifiInfo = label(p, &kr14, D_SUB, "");
  lv_obj_set_width(s_wifiInfo, PW - 28); lv_label_set_long_mode(s_wifiInfo, LV_LABEL_LONG_WRAP);
  lv_obj_set_pos(s_wifiInfo, 14, 46);
  s_wifiList = lv_list_create(p);
  lv_obj_set_size(s_wifiList, PW - 24, 136); lv_obj_set_pos(s_wifiList, 12, 86);
  lv_obj_set_style_text_font(s_wifiList, &kr14, 0);
  lv_obj_set_style_bg_color(s_wifiList, lv_color_hex(D_ROW), 0);
  lv_obj_set_style_border_color(s_wifiList, lv_color_hex(D_LINE), 0);
  lv_obj_t *bForget = button(p, "저장한 와이파이 지우기", 230, 30, D_ROW, D_MUTED);
  lv_obj_set_pos(bForget, 12, 230);
  lv_obj_add_event_cb(bForget, onForget, LV_EVENT_CLICKED, nullptr);

  lv_obj_t *hr = box(p, D_LINE, 0, 0);
  lv_obj_set_size(hr, PW - 24, 1); lv_obj_set_pos(hr, 12, 272);
  lv_obj_set_pos(label(p, &kr20, D_TEXT, "볼 시간표"), 14, 284);
  lv_obj_t *ver = label(p, &kr14, D_MUTED, "");
  lv_label_set_text_fmt(ver, "버전 %s", FW_VERSION);
  lv_obj_align(ver, LV_ALIGN_TOP_RIGHT, -14, 288);
  s_ttPick = lv_dropdown_create(p);
  lv_obj_set_style_text_font(s_ttPick, &kr16, 0);
  lv_obj_set_style_text_font(lv_dropdown_get_list(s_ttPick), &kr16, 0);
  lv_dropdown_set_options(s_ttPick, "교장실 · 학교 일정\n교감실 · 학교 일정");   // 목록(index.json)을 받으면 fillPicker 가 채운다(setup 에서도 곧 덮어쓴다)
  lv_obj_set_style_max_height(lv_dropdown_get_list(s_ttPick), 300, 0);
  lv_obj_set_width(s_ttPick, PW - 24); lv_obj_set_pos(s_ttPick, 12, 314);
  lv_obj_add_event_cb(s_ttPick, onPickTT, LV_EVENT_VALUE_CHANGED, nullptr);
  lv_obj_t *bSync = button(p, "지금 받기", PW - 24, 34, C_PRIMARY, 0xffffff);
  lv_obj_set_pos(bSync, 12, 360);
  lv_obj_add_event_cb(bSync, [](lv_event_t *) { s_syncReq = true; setStatus("곧 연결합니다..."); }, LV_EVENT_CLICKED, nullptr);
  s_status = label(p, &kr14, D_MUTED, "");
  lv_obj_set_width(s_status, PW - 28); lv_label_set_long_mode(s_status, LV_LABEL_LONG_WRAP);
  lv_obj_set_pos(s_status, 14, 402);

  // 비밀번호: 뒤 막 + 위 창(제목·[취소]·입력칸) + 아래 키보드 (화면 맨 위 층, 만든 차례가 겹치는 차례)
  s_pwBg = lv_obj_create(lv_layer_top());
  lv_obj_remove_style_all(s_pwBg);
  lv_obj_set_size(s_pwBg, W, H); lv_obj_set_pos(s_pwBg, 0, 0);
  lv_obj_set_style_bg_color(s_pwBg, lv_color_hex(0x000000), 0); lv_obj_set_style_bg_opa(s_pwBg, LV_OPA_50, 0);
  lv_obj_add_flag(s_pwBg, LV_OBJ_FLAG_CLICKABLE);   // 뒤의 와이파이 목록이 눌리지 않게 막고, 누르면 취소
  lv_obj_add_event_cb(s_pwBg, pwCancel, LV_EVENT_CLICKED, nullptr);
  show(s_pwBg, false);
  s_pwBox = box(lv_layer_top(), D_PANEL, D_SUB, 12);
  lv_obj_set_size(s_pwBox, W - 20, 110); lv_obj_set_pos(s_pwBox, 10, 40);
  lv_obj_add_flag(s_pwBox, LV_OBJ_FLAG_CLICKABLE);   // 창을 눌러도 뒤 막(취소)으로 넘어가지 않게
  lv_obj_t *pt = label(s_pwBox, &kr16, D_TEXT, "");   // 0번째 자식 = 제목(onSsidPick 이 글을 바꾼다)
  lv_obj_set_width(pt, W - 20 - 120); lv_label_set_long_mode(pt, LV_LABEL_LONG_DOT); lv_obj_set_pos(pt, 14, 12);
  s_pwTa = lv_textarea_create(s_pwBox);
  lv_textarea_set_one_line(s_pwTa, true);
  lv_textarea_set_password_mode(s_pwTa, false);   // 보이게(오타 확인)
  lv_obj_set_style_text_font(s_pwTa, &lv_font_montserrat_20, 0);
  lv_obj_set_size(s_pwTa, W - 48, 48); lv_obj_align(s_pwTa, LV_ALIGN_BOTTOM_MID, 0, -10);
  lv_obj_t *cbn = button(s_pwBox, "취소", 80, 34, D_ROW, D_TEXT);   // 비밀번호를 모르면 여기서 닫는다
  lv_obj_align(cbn, LV_ALIGN_TOP_RIGHT, -10, 6);
  lv_obj_add_event_cb(cbn, pwCancel, LV_EVENT_CLICKED, nullptr);
  show(s_pwBox, false);
  s_kb = lv_keyboard_create(lv_layer_top());
  lv_obj_set_size(s_kb, W, H / 2);
  lv_obj_align(s_kb, LV_ALIGN_BOTTOM_MID, 0, 0);
  lv_keyboard_set_textarea(s_kb, s_pwTa);
  lv_obj_add_event_cb(s_kb, onKb, LV_EVENT_ALL, nullptr);
  show(s_kb, false);
}
// 단축키 장: 4×4 칸(칸 107×95, 아이콘 72 위·이름 kr14 아래), 맨 아래 두 줄까지 쓰는 상태 글
static void buildDeck() {
  lv_obj_t *p = panel(P_DECK);
  const int COLS = 4, GX = 8, GY = 6, CWD = (PW - 2 * GX) / COLS /* 111 */, CHT = 95, PITCH = 97;
  for (int i = 0; i < 16; i++) {
    const int c = i % COLS, r = i / COLS;
    lv_obj_t *cell = box(p, D_ROW, D_LINE, 12);
    lv_obj_set_size(cell, CWD - 4, CHT);
    lv_obj_set_pos(cell, GX + c * CWD + 2, GY + r * PITCH);
    lv_obj_set_style_bg_color(cell, lv_color_hex(D_LINE), LV_STATE_PRESSED);   // 누르는 동안 밝게
    lv_obj_add_flag(cell, LV_OBJ_FLAG_CLICKABLE);   // box() 는 누르기를 끄므로 칸만 다시 켠다(옆으로 밀기는 tileview 가 받는다)
    lv_obj_add_event_cb(cell, onDeck, LV_EVENT_CLICKED, (void *)(intptr_t)i);
    lv_obj_t *img = lv_img_create(cell);
    lv_img_set_src(img, DECK[i].icon);
    lv_obj_align(img, LV_ALIGN_TOP_MID, 0, 3);
    lv_obj_t *l = label(cell, &kr14, D_SUB, DECK[i].label);
    lv_obj_align(l, LV_ALIGN_BOTTOM_MID, 0, -3);
  }
  s_deckState = label(p, &kr14, D_MUTED, "");
  lv_obj_set_width(s_deckState, PW - 24); lv_label_set_long_mode(s_deckState, LV_LABEL_LONG_WRAP);
  lv_obj_set_style_text_align(s_deckState, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_set_pos(s_deckState, 12, PH - 44);
  deckStateText();
}
// 교장 화면(시계 장 위에 겹치는 두 번째 판): 시계 · 이름+날짜 · 학교 지금 · 일정 5줄 · 학사 D-day 3줄
static void buildPrincipal() {
  lv_obj_t *p = s_prinPanel = panel(P_CLOCK);
  const int P = 16, CW = PW - 2 * P;
  s_pStale = label(p, &kr14, 0xfb923c, "");
  lv_obj_set_width(s_pStale, CW - 120); lv_label_set_long_mode(s_pStale, LV_LABEL_LONG_DOT); lv_obj_set_pos(s_pStale, P, 3); show(s_pStale, false);
  s_pBat = label(p, &kr14, D_MUTED, ""); lv_obj_align(s_pBat, LV_ALIGN_TOP_RIGHT, -12, 3); show(s_pBat, false);
  s_pClock = label(p, &num120, D_TEXT, "--:--");
  lv_obj_set_width(s_pClock, PW); lv_obj_set_style_text_align(s_pClock, LV_TEXT_ALIGN_CENTER, 0); lv_obj_set_pos(s_pClock, 0, 18);
  s_pDate = label(p, &kr20, D_SUB, "");   // '교장실 · 10월 25일 일요일'
  lv_obj_set_width(s_pDate, CW); lv_label_set_long_mode(s_pDate, LV_LABEL_LONG_DOT); lv_obj_set_pos(s_pDate, P, 110);
  lv_obj_t *nc = box(p, D_ROW, D_SUB, 12);   // 학교 지금(누르면 선생님 찾기 장으로)
  lv_obj_set_size(nc, CW, 72); lv_obj_set_pos(nc, P, 138);
  lv_obj_add_flag(nc, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_set_style_bg_color(nc, lv_color_hex(D_LINE), LV_STATE_PRESSED);
  lv_obj_add_event_cb(nc, [](lv_event_t *) { goPage(P_FIND); }, LV_EVENT_CLICKED, nullptr);
  s_pNowA = label(nc, &kr20, D_TEXT, ""); lv_obj_set_pos(s_pNowA, 14, 6);
  s_pNowB = label(nc, &kr14, D_SUB, ""); lv_obj_set_width(s_pNowB, CW - 28); lv_label_set_long_mode(s_pNowB, LV_LABEL_LONG_DOT); lv_obj_set_pos(s_pNowB, 14, 31);
  s_pNowC = label(nc, &kr14, D_MUTED, ""); lv_obj_set_width(s_pNowC, CW - 28); lv_label_set_long_mode(s_pNowC, LV_LABEL_LONG_DOT); lv_obj_set_pos(s_pNowC, 14, 50);
  const int RY0 = 216, RP = 29, RH = 27, RX = 10, RW = PW - 20, TW = 62;   // 일정 5줄(renderPrincipal 의 제목 폭 254/354 와 맞춘 값)
  for (int i = 0; i < PRIN_ROWS; i++) {
    s_pRow[i] = box(p, D_ROW, D_LINE, 8);
    lv_obj_set_size(s_pRow[i], RW, RH); lv_obj_set_pos(s_pRow[i], RX, RY0 + i * RP);
    lv_obj_add_flag(s_pRow[i], LV_OBJ_FLAG_CLICKABLE); lv_obj_add_event_cb(s_pRow[i], onSchedRow, LV_EVENT_CLICKED, nullptr);
    lv_obj_set_style_bg_color(s_pRow[i], lv_color_hex(D_LINE), LV_STATE_PRESSED);
    lv_obj_t *tb = box(s_pRow[i], D_LINE, 0, 6);
    lv_obj_set_size(tb, TW, RH - 6); lv_obj_align(tb, LV_ALIGN_LEFT_MID, 3, 0);
    s_pRowT[i] = label(tb, &kr14, D_SUB, ""); lv_obj_center(s_pRowT[i]);
    s_pRowA[i] = label(s_pRow[i], &kr16, D_TEXT, "");
    lv_obj_set_width(s_pRowA[i], 254); lv_label_set_long_mode(s_pRowA[i], LV_LABEL_LONG_DOT); lv_obj_align(s_pRowA[i], LV_ALIGN_LEFT_MID, TW + 10, 0);
    s_pRowB[i] = label(s_pRow[i], &kr14, D_MUTED, "");
    lv_obj_set_width(s_pRowB[i], 96); lv_label_set_long_mode(s_pRowB[i], LV_LABEL_LONG_DOT);
    lv_obj_set_style_text_align(s_pRowB[i], LV_TEXT_ALIGN_RIGHT, 0); lv_obj_align(s_pRowB[i], LV_ALIGN_RIGHT_MID, -8, 0);
    show(s_pRow[i], false);
  }
  lv_obj_t *ac = box(p, D_ROW, D_LINE, 12);   // 학사 D-day 3줄
  lv_obj_set_size(ac, CW, 70); lv_obj_set_pos(ac, P, 366);
  for (int i = 0; i < 3; i++) {
    s_pAcad[i] = label(ac, &kr14, D_SUB, "");
    lv_obj_set_width(s_pAcad[i], CW - 24); lv_label_set_long_mode(s_pAcad[i], LV_LABEL_LONG_DOT); lv_obj_set_pos(s_pAcad[i], 12, 5 + i * 21);
    show(s_pAcad[i], false);
  }
  show(p, false);
}
// 주간 장 위의 학교 일정 목록(한 쪽 7개, 이전/다음)
static void buildSchedList() {
  lv_obj_t *p = s_schedPanel = panel(P_WEEK);
  s_sTitle = label(p, &kr16, D_TEXT, ""); lv_obj_set_pos(s_sTitle, 14, 10);
  const int RW = PW - 20, TW = 64, RY0 = 40, RP = 50, RH = 46;
  for (int k = 0; k < 7; k++) {
    s_sRow[k] = box(p, D_ROW, D_LINE, 10);
    lv_obj_set_size(s_sRow[k], RW, RH); lv_obj_set_pos(s_sRow[k], 10, RY0 + k * RP);
    lv_obj_add_flag(s_sRow[k], LV_OBJ_FLAG_CLICKABLE); lv_obj_add_event_cb(s_sRow[k], onSchedRow, LV_EVENT_CLICKED, nullptr);
    lv_obj_set_style_bg_color(s_sRow[k], lv_color_hex(D_LINE), LV_STATE_PRESSED);
    lv_obj_t *tb = box(s_sRow[k], D_LINE, 0, 8);
    lv_obj_set_size(tb, TW, RH - 12); lv_obj_align(tb, LV_ALIGN_LEFT_MID, 5, 0);
    s_sRowT[k] = label(tb, &kr14, D_SUB, ""); lv_obj_center(s_sRowT[k]);
    s_sRowA[k] = label(s_sRow[k], &kr16, D_TEXT, "");
    lv_obj_set_width(s_sRowA[k], RW - TW - 26); lv_label_set_long_mode(s_sRowA[k], LV_LABEL_LONG_DOT); lv_obj_set_pos(s_sRowA[k], TW + 16, 4);
    s_sRowB[k] = label(s_sRow[k], &kr14, D_MUTED, "");
    lv_obj_set_width(s_sRowB[k], RW - TW - 26); lv_label_set_long_mode(s_sRowB[k], LV_LABEL_LONG_DOT); lv_obj_set_pos(s_sRowB[k], TW + 16, 25);
    show(s_sRow[k], false);
  }
  const int FY = PH - 8 - 36;
  lv_obj_t *bp = button(p, LV_SYMBOL_LEFT "  이전", 110, 36, D_ROW, D_TEXT); lv_obj_set_pos(bp, PW / 2 - 170, FY);
  lv_obj_add_event_cb(bp, onSchedPage, LV_EVENT_CLICKED, (void *)(intptr_t)-1);
  s_sPage = label(p, &kr14, D_MUTED, ""); lv_obj_set_width(s_sPage, 120); lv_label_set_long_mode(s_sPage, LV_LABEL_LONG_DOT);
  lv_obj_set_style_text_align(s_sPage, LV_TEXT_ALIGN_CENTER, 0); lv_obj_set_pos(s_sPage, PW / 2 - 60, FY + 10);
  lv_obj_t *bn = button(p, "다음  " LV_SYMBOL_RIGHT, 110, 36, D_ROW, D_TEXT); lv_obj_set_pos(bn, PW / 2 + 60, FY);
  lv_obj_add_event_cb(bn, onSchedPage, LV_EVENT_CLICKED, (void *)(intptr_t)1);
  show(p, false);
}
static void buildTodayHint() {   // 교장 모드의 오늘 장: 시간표 대신 안내
  lv_obj_t *p = s_todayHint = panel(P_TODAY);
  lv_obj_set_pos(label(p, &kr20, D_TEXT, "교장실·교감실 화면"), 14, 14);
  lv_obj_t *t = label(p, &kr16, D_SUB, "학교 일정은 시계 장과 주간 장에서 봅니다. 일정을 누르면 자세한 내용이 나옵니다.");
  lv_obj_set_width(t, PW - 28); lv_label_set_long_mode(t, LV_LABEL_LONG_WRAP); lv_obj_set_pos(t, 14, 54);
  lv_obj_t *t2 = label(p, &kr16, D_SUB, "선생님 시간표를 보려면 설정 장의 '볼 시간표'를 바꾸세요.");
  lv_obj_set_width(t2, PW - 28); lv_label_set_long_mode(t2, LV_LABEL_LONG_WRAP); lv_obj_set_pos(t2, 14, 120);
  lv_obj_t *b1 = button(p, "선생님 찾기", PW - 28, 44, C_PRIMARY, 0xffffff); lv_obj_set_pos(b1, 14, 190);
  lv_obj_add_event_cb(b1, [](lv_event_t *) { goPage(P_FIND); }, LV_EVENT_CLICKED, nullptr);
  lv_obj_t *b2 = button(p, "설정으로 가기", PW - 28, 44, D_ROW, D_TEXT); lv_obj_set_pos(b2, 14, 246);
  lv_obj_add_event_cb(b2, [](lv_event_t *) { goPage(P_SET); }, LV_EVENT_CLICKED, nullptr);
  show(p, false);
}
static void buildSchedDetail() {   // 일정 자세히: 어두운 덮개 + 가운데 카드(맨 위 층). [닫기] 또는 아무 데나 누르면 닫힌다
  s_pDetail = box(lv_layer_top(), 0x000000, 0, 0);
  lv_obj_set_style_bg_opa(s_pDetail, LV_OPA_70, 0);
  lv_obj_set_size(s_pDetail, W, H); lv_obj_set_pos(s_pDetail, 0, 0);
  lv_obj_add_flag(s_pDetail, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_add_event_cb(s_pDetail, [](lv_event_t *) { show(s_pDetail, false); }, LV_EVENT_CLICKED, nullptr);
  const int DW_ = W - 40, DH_ = 360;
  lv_obj_t *card = box(s_pDetail, D_PANEL, D_SUB, 16);
  lv_obj_set_size(card, DW_, DH_); lv_obj_center(card);
  s_dDate = label(card, &kr14, D_MUTED, ""); lv_obj_set_pos(s_dDate, 20, 16);
  s_dTitle = label(card, &kr20, D_TEXT, "");
  lv_obj_set_width(s_dTitle, DW_ - 40); lv_label_set_long_mode(s_dTitle, LV_LABEL_LONG_DOT);
  const int tlh = lv_font_get_line_height(&kr20);
  lv_obj_set_height(s_dTitle, 2 * tlh + 4); lv_obj_set_pos(s_dTitle, 20, 38);
  const int iy = 38 + 2 * tlh + 14;
  s_dInfo = label(card, &kr14, D_SUB, "");
  lv_obj_set_width(s_dInfo, DW_ - 40); lv_label_set_long_mode(s_dInfo, LV_LABEL_LONG_DOT);
  lv_obj_set_style_text_line_space(s_dInfo, 5, 0);
  lv_obj_set_height(s_dInfo, DH_ - iy - 64); lv_obj_set_pos(s_dInfo, 20, iy);   // 내용이 길면 말줄임(넘치지 않게)
  lv_obj_t *cb = button(card, "닫기", 100, 42, C_PRIMARY, 0xffffff);
  lv_obj_align(cb, LV_ALIGN_BOTTOM_RIGHT, -14, -12);
  lv_obj_add_event_cb(cb, [](lv_event_t *) { show(s_pDetail, false); }, LV_EVENT_CLICKED, nullptr);
  lv_obj_align(label(card, &kr14, D_MUTED, "아무 데나 눌러도 닫힙니다"), LV_ALIGN_BOTTOM_LEFT, 20, -24);
  show(s_pDetail, false);
}
static void buildUI() {
  lv_obj_t *scr = lv_scr_act();
  lv_obj_set_style_bg_color(scr, lv_color_hex(D_BG), 0);
  lv_obj_clear_flag(scr, LV_OBJ_FLAG_SCROLLABLE);
  s_tv = lv_tileview_create(scr);
  lv_obj_set_style_bg_color(s_tv, lv_color_hex(D_BG), 0);
  lv_obj_set_scrollbar_mode(s_tv, LV_SCROLLBAR_MODE_OFF);
  for (int i = 0; i < P_COUNT; i++) {
    lv_dir_t dir = (lv_dir_t)((i > 0 ? LV_DIR_LEFT : 0) | (i < P_COUNT - 1 ? LV_DIR_RIGHT : 0));
    s_tile[i] = lv_tileview_add_tile(s_tv, i, 0, dir);
    lv_obj_set_scrollbar_mode(s_tile[i], LV_SCROLLBAR_MODE_OFF);
  }
  lv_obj_add_event_cb(s_tv, onTile, LV_EVENT_VALUE_CHANGED, nullptr);
  buildClock(); buildToday(); buildWeek(); buildDeck(); buildFinder(); buildSettings();
  buildPrincipal(); buildSchedList(); buildTodayHint(); buildSchedDetail();   // 교장 모드용 겹침 판(숨긴 채 시작, 일반 판보다 뒤에 만들어 위에 쌓인다)
  // 아래 점: 지금 몇 번째 장인지
  lv_obj_t *dots = box(scr, D_BG, 0, 0);
  lv_obj_set_style_bg_opa(dots, LV_OPA_TRANSP, 0);
  lv_obj_set_size(dots, W, 12); lv_obj_set_pos(dots, 0, H - 12);
  lv_obj_set_flex_flow(dots, LV_FLEX_FLOW_ROW);
  lv_obj_set_flex_align(dots, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
  lv_obj_set_style_pad_column(dots, 8, 0);
  for (int i = 0; i < P_COUNT; i++) {
    s_dot[i] = box(dots, D_LINE, 0, 4);
    lv_obj_set_size(s_dot[i], 7, 7);
  }
  markDots();
}

// ── 시계 (분이 바뀔 때만 그린다) ──
static void tickMinute(const struct tm &tm) {
  static const char *WD[7] = {"일", "월", "화", "수", "목", "금", "토"};
  lv_label_set_text_fmt(s_big, "%02d:%02d", tm.tm_hour, tm.tm_min);
  lv_label_set_text_fmt(s_bigDate, "%d월 %d일 %s요일", tm.tm_mon + 1, tm.tm_mday, WD[tm.tm_wday]);
  lv_label_set_text_fmt(s_dayClock, "%02d:%02d", tm.tm_hour, tm.tm_min);
  renderTT();     // 교장 모드면 안에서 renderPrincipal·renderSchedList 만 그린다(위 시계 글을 먼저 바꿔야 한다)
  renderMeal();
  refreshStale();
  if (s_page == P_FIND) renderFinder();
}

SET_LOOP_TASK_STACK_SIZE(16 * 1024);   // loop 스택 8→16KB(교장 화면 그리기·HTTPS 가 깊다)

void setup() {
  Serial.begin(115200);
#if defined(ARDUINO_USB_CDC_ON_BOOT) && ARDUINO_USB_CDC_ON_BOOT
  Serial.setTxTimeoutMs(20);   // 컴퓨터가 안 읽어도 화면·터치가 오래 멈추지 않게(기본 100ms)
#endif
  Serial.printf("\n" BOARD_TITLE " v%s\n", FW_VERSION);
  if (!LittleFS.begin(true)) Serial.println("LittleFS mount failed");
  s_prefs.begin("board", false);
  s_pickName = s_prefs.getString("ttname", BOARD_DEFAULT_TT);
  s_lastOkT = (time_t)s_prefs.getULong("lastok", 0);
  s_lvMutex = xSemaphoreCreateRecursiveMutex();

  initDisplay();
  // 화면을 켠 뒤부터는 64바이트가 넘는 malloc 을 PSRAM 에서 먼저 준다(내부 RAM 이 부족하면 HTTPS(TLS)가 실패한 적이 있다)
  heap_caps_malloc_extmem_enable(64);
  buildUI();
  if (loadTTFromFile()) Serial.println("tt.json loaded from flash");
  parseWeather(readFile("/wx.json")); renderWeather();
  loadMealFromFile(); renderMeal();
  parseAir(readFile("/air.json")); renderAir();
  parseWhere(readFile("/where.json"));
  { String idx = readFile("/index.json"); if (idx.length()) parseIndex(idx); }
  loadSchedFromFile();
  fillPicker();      // 안에서 applyMode(교장 모드면 겹침 판으로 바꾼다)
  renderTT();
  refreshWifiLabel();
  refreshStale();
  xTaskCreatePinnedToCore(lvTask, "lvgl", 16 * 1024, nullptr, 2, nullptr, 1);

  setenv("TZ", "KST-9", 1); tzset();
  wifiOff();   // 평소에는 꺼 둔다. 켠 뒤 5초 뒤에 첫 연결(loop)
  Serial.printf("ready (internal free %u, psram free %u)\n", (unsigned)heap_caps_get_free_size(MALLOC_CAP_INTERNAL),
                (unsigned)heap_caps_get_free_size(MALLOC_CAP_SPIRAM));
}

void loop() {
  static uint32_t lastTick = 0;
  static int lastMin = -1;
  uint32_t ms = millis();

  // 와이파이 찾기: 찾는 동안만 켠다
  if (s_scanReq) {
    s_scanReq = false;
    if (s_sync == SYNC_IDLE) { lcdSlow(true); WiFi.mode(WIFI_STA); }
    int n = WiFi.scanNetworks(false, false);
    lock();
    lv_obj_clean(s_wifiList);
    if (n <= 0) lv_list_add_text(s_wifiList, "찾은 와이파이가 없습니다");
    for (int i = 0; i < n && i < 30; i++) {
      String s = WiFi.SSID(i);
      if (!s.length()) continue;
      char row[96];
      const bool open = WiFi.encryptionType(i) == WIFI_AUTH_OPEN;
      snprintf(row, sizeof row, "%s  (%d%s)", s.c_str(), WiFi.RSSI(i), open ? ", 비밀번호 없음" : "");
      lv_obj_t *b = lv_list_add_btn(s_wifiList, LV_SYMBOL_WIFI, row);
      lv_obj_set_user_data(b, (void *)(intptr_t)(open ? 1 : 0));
      lv_obj_add_event_cb(b, onSsidPick, LV_EVENT_CLICKED, nullptr);
    }
    unlock();
    WiFi.scanDelete();
    if (s_sync == SYNC_IDLE) { wifiOff(); lcdSlow(false); }
  }

  // 배터리: 켠 뒤 5초, 그 뒤 15초마다 읽는다. 글자는 값이 바뀔 때만 바꾼다(다시 그리기 줄이기). 3.0V 밑이면 배터리 없음으로 보고 숨긴다.
  // 충전 신호(CHRG)는 읽을 수 없어 전압 변화로 짐작한다(충전기를 꽂으면 충전 전류로 전압이 뛴다). 7인치(7B) 규칙과 같다.
  static uint32_t lastBat = 0;
  if (ms > 5000 && (lastBat == 0 || ms - lastBat > 15000)) {
    lastBat = ms;
    const int mv = batteryMv();
    const bool have = mv >= 3000 && mv <= 4500;
    // ① 15초 사이 70mV 넘게 뛰고 다음에도 유지되면 '꽂음', 그 뛴 만큼(off)을 빼서 %를 계산 ② 70mV 넘게 떨어지면 '뺌'
    // ③ 켤 때부터 꽂혀 있던 경우: 10분 추세(앞 5분·뒤 5분 모두 상승)면 충전 중, off=150 ④ 충전 중 4.15V 이상에서 10분 거의 그대로면 완료
    static int prev = -1, cand = 0, off = 0, st = 0, shown = -1;   // st: 0 방전 · 1 충전 중 · 2 충전 완료
    static int hist[21]; static int hn = 0; static uint32_t lastHist = 0;
    // 와이파이를 켜거나 화면 불이 바뀌면 전압이 출렁인다 → 받는 중·끝난 뒤 45초·화면 불 바뀐 뒤 45초는 판단하지 않는다
    static uint32_t calmAt = 0; static bool lastBlOff = false;
    if (s_sync != SYNC_IDLE || s_blOff != lastBlOff) { calmAt = ms + 45000; lastBlOff = s_blOff; }
    const bool calm = (int32_t)(ms - calmAt) >= 0;
    if (!have) { prev = -1; cand = 0; hn = 0; st = 0; off = 0; shown = -1; }
    else if (!calm) { prev = -1; cand = 0; }                       // 흔들리는 동안은 비교 기준을 버린다
    else {
      if (cand) {                                                // 지난번에 뛰었다 → 이번에도 높게 남아 있어야 꽂음
        if (mv - prev >= -20) { st = 1; off = cand; hn = 0; Serial.printf("battery: plugged (+%dmV)\n", cand); }
        cand = 0;
      } else if (prev > 0) {
        const int d = mv - prev;
        if (st == 0 && d >= 70) cand = d;
        else if (st != 0 && d <= -70) { st = 0; off = 0; hn = 0; shown = -1; Serial.printf("battery: unplugged (%dmV)\n", d); }
      }
      prev = mv;
      if (lastHist == 0 || ms - lastHist >= 60000) {             // 1분마다 기록(10·20분 비교용)
        lastHist = ms;
        if (hn < 21) hist[hn++] = mv; else { memmove(hist, hist + 1, 20 * sizeof(int)); hist[20] = mv; }
        const int n = hn;
        if (n >= 11) {
          const int a = hist[n - 11], m = hist[n - 6], b = hist[n - 1];
          // 켤 때부터 꽂혀 있었다: 앞 5분·뒤 5분 모두 꾸준히 올라야(쉬고 난 뒤 잠깐 회복되는 것과 구별)
          if (st == 0 && m - a >= 15 && b - m >= 15) { st = 1; off = 150; Serial.println("battery: charging (trend)"); }
          else if (st == 1 && mv >= 4150 && b - a > -10 && b - a < 15) st = 2;
        }
        if (n >= 21 && st == 1 && hist[20] - hist[0] <= -20) { st = 0; off = 0; shown = -1; Serial.println("battery: not charging (falling)"); }   // 충전 중인데 20분 동안 내려가면 잘못 본 것
      }
    }
    int pct = -1;
    if (have) {
      pct = st == 2 ? 100 : batteryPct(mv - (st ? off : 0));
      if (st == 1 && shown >= 0 && pct < shown) pct = shown;     // 충전 중에는 내려가지 않는다
      if (st == 0 && shown >= 0 && pct > shown && pct < shown + 5) pct = shown;   // 방전 중 1~4% 흔들림은 무시
      shown = pct;
    }
    const int chg = st;
    static int lastChg = -1; static uint32_t lastLog = 0;
    if (pct != s_batPct || chg != lastChg || lastLog == 0 || ms - lastLog > 300000) {   // 기록은 바뀔 때·5분마다만(USB 기록 줄이기)
      lastLog = ms;
      Serial.printf("battery %dmV off %d -> %d%% (%s)\n", mv, st ? off : 0, pct, chg == 1 ? "charging" : chg == 2 ? "full" : "-");
    }
    if (pct != s_batPct || chg != lastChg) {
      s_batPct = pct; lastChg = chg;
      const char *ic = pct >= 88 ? LV_SYMBOL_BATTERY_FULL : pct >= 63 ? LV_SYMBOL_BATTERY_3 : pct >= 38 ? LV_SYMBOL_BATTERY_2 : pct >= 13 ? LV_SYMBOL_BATTERY_1 : LV_SYMBOL_BATTERY_EMPTY;
      char t[48];
      if (chg == 1) snprintf(t, sizeof t, LV_SYMBOL_CHARGE " %d%% 충전 중", pct);
      else if (chg == 2) snprintf(t, sizeof t, LV_SYMBOL_CHARGE " 충전 완료");
      else snprintf(t, sizeof t, "%s %d%%", ic, pct);
      const uint32_t col = chg ? 0x34d399 : pct <= 20 ? 0xfb923c : D_MUTED;
      lock();
      lv_obj_t *labs[] = {s_bat, s_pBat};
      for (lv_obj_t *l : labs) {
        if (!l) continue;
        if (pct < 0) { lv_obj_add_flag(l, LV_OBJ_FLAG_HIDDEN); continue; }
        lv_label_set_text(l, t);
        lv_obj_set_style_text_color(l, lv_color_hex(col), 0);
        lv_obj_clear_flag(l, LV_OBJ_FLAG_HIDDEN);
      }
      unlock();
    }
  }

  // 1시간마다(밤·주말 2시간) 잠깐 연결: 연결 → 시간 맞추기 → 자료 받기 → 끄기. 수업 중에는 쉬는 시간으로 미룬다.
  if (s_sync == SYNC_IDLE) {
    bool due = s_prefs.isKey("ssid") && (!s_triedOnce || ms - s_lastSync > syncWaitMs());
    static bool deferLogged = false;   // 켠 직후 첫 받기와 [지금 받기]는 바로
    if (due && s_triedOnce && inClassNow()) { if (!deferLogged) { deferLogged = true; Serial.println("sync: defer (class)"); } due = false; }
    if (due) deferLogged = false;
    if ((s_syncReq || due) && ms >= 5000) { s_syncReq = false; startSync(); }
  } else if (s_sync == SYNC_CONNECTING) {
    if (WiFi.isConnected()) {
      s_sync = SYNC_TIME; s_syncStart = ms;
      configTzTime("KST-9", "pool.ntp.org", "time.google.com", "kr.pool.ntp.org");
      lock(); setStatus("시간을 맞추는 중..."); unlock();
    } else if (!s_retried && ms - s_syncStart > 15000) {
      s_retried = true;
      Serial.printf("sync: retry (reason %d %s)\n", (int)s_wifiReason, wifiReasonText(s_wifiReason));
      WiFi.disconnect(false, false);
      wifiBegin();
    } else if (ms - s_syncStart > 35000) {
      static char msg[128];
      Serial.printf("sync: wifi fail reason %d\n", (int)s_wifiReason);   // 숫자 코드는 기록에만
      snprintf(msg, sizeof msg, "와이파이에 연결하지 못했습니다(%s). 잠시 뒤 다시 해 봅니다.", wifiReasonText(s_wifiReason));
      finishSync(false, msg);
    }
  } else if (s_sync == SYNC_TIME) {
    bool synced = sntp_get_sync_status() == SNTP_SYNC_STATUS_COMPLETED || (timeValid() && ms - s_syncStart > 8000);
    if (synced || ms - s_syncStart > 15000) {
      lock(); setStatus("자료를 받는 중..."); unlock();
      const bool noUrl = urlUnset();   // 시간표 주소가 아직 기본값이면 시간표·선생님 위치는 받지 않는다(받을 때마다 화면 박자가 바뀌므로)
      if (!noUrl && downloadIndex()) { lock(); fillPicker(); unlock(); }
      const bool prin = s_principal;   // 받는 동안 사람이 바꿔도 이번 받기는 이 모드로 끝낸다
      s_ttCode = 0;
      const bool ok = !noUrl && !prin && downloadTT();
      const bool wx = downloadWeather(), meal = downloadMeal(), air = downloadAir();
      const bool whr = !noUrl && downloadWhere();
      const bool sch = prin && downloadSchedule();
      const bool loaded = ok && loadTTFromFile();   // 해석은 잠금 밖(안에서 바꾸는 순간만 잠근다)
      lock();
      if (sch && s_pDetail) show(s_pDetail, false);   // 일정 번호가 바뀌므로 열린 자세히 창은 닫는다
      if (loaded || prin) { s_week = -1; renderTT(); }
      if (wx) renderWeather();
      if (meal) renderMeal();
      if (air) renderAir();
      if (whr) { s_findGridDirty = true; if (s_page == P_FIND) { fillFinderGrid(); renderFinder(); } }
      unlock();
      bool good; const char *msg;
      if (!timeValid()) { good = false; msg = "시간을 맞추지 못했습니다. 인터넷을 확인하세요."; }   // 시각을 모르면 1분마다 다시(syncWaitMs)
      else if (prin) {
        good = sch || !HAS_SCHED;
        msg = sch ? "시간과 학교 일정을 받았습니다." : HAS_SCHED ? "학교 일정을 받지 못했습니다. 인터넷을 확인하세요." : "시간을 맞췄습니다. 학교 일정 주소가 아직 없습니다.";
      } else if (noUrl) { good = true; msg = "시간을 맞췄습니다. 시간표 주소를 넣으면 시간표도 받습니다."; }
      else {
        good = loaded;
        msg = loaded ? "시간과 시간표를 받았습니다."
              : (s_ttCode == 404 || s_ttCode == 403) ? "시간표 주소에 파일이 없습니다. 관리자에게 알려 주세요."
              : ok ? "시간표를 읽지 못했습니다. 잠시 뒤 다시 받습니다." : "시간표를 받지 못했습니다. 인터넷을 확인하세요.";
      }
      finishSync(good, msg);
    }
  }

  // 시계 (분이 바뀔 때만 그린다)
  if (ms - lastTick >= 1000) {
    lastTick = ms;
    if (timeValid()) {
      time_t t = time(nullptr); struct tm tm; localtime_r(&t, &tm);
      if (tm.tm_min != lastMin) {
        if (lastMin < 0) s_week = -1;
        lastMin = tm.tm_min;
        lock(); tickMinute(tm); unlock();
        static int lastDay = -1;
        if (lastDay >= 0 && tm.tm_mday != lastDay) s_syncReq = true;   // 날이 바뀌면 오늘 급식·날씨를 새로 받는다
        lastDay = tm.tm_mday;
      }
    }
  }

  // 화면 불. 컴퓨터 도우미 신호를 한 번이라도 받은 보드는 컴퓨터를 따른다(사용자 지시 2026-10-25):
  //   컴퓨터가 켜져 있는 동안은 끄지 않고, 신호가 끊기고(15초) 10초가 더 지나고 2분 무입력이면 끈다.
  // 신호를 받은 적이 없으면 기존 규칙: 밤(22:00~07:00)·주말·휴일에 2분 무입력이면 끈다. 만지면 켜진다(touchRead).
  static uint32_t lastBl = 0;
  if (ms - lastBl > 2000 && (s_usbSeen || timeValid())) {
    lastBl = ms;
    lock();
    const uint32_t idle = lv_disp_get_inactive_time(NULL);
    bool off;
    if (s_usbSeen) {
      static uint32_t gone = 0;
      if (s_usbOn) gone = 0; else if (!gone) gone = ms;
      off = !s_usbOn && ms - gone > 10000 && idle > 2UL * 60 * 1000;
    } else {
      time_t t = time(nullptr); struct tm tm; localtime_r(&t, &tm);
      const int m = tm.tm_hour * 60 + tm.tm_min;
      bool quiet = m < 7 * 60 || m >= 22 * 60;
      if (!quiet) quiet = isOffDay(nullptr);   // 주말·휴일(교장 모드는 학사 일정의 '휴')
      off = quiet && idle > 2UL * 60 * 1000;
    }
    if (off != s_blOff) { s_blOff = off; backlight(!off); Serial.printf("backlight %s\n", off ? "off" : "on"); }
    unlock();   // 백라이트도 I2C(터치와 같은 줄)라 잠근 채로 쓴다
  }

  // 새벽 3시대: 내부 RAM 이 조각났거나(와이파이·HTTPS 가 실패하기 쉬움) 4번 넘게 잇따라 실패했으면 스스로 다시 켠다.
  // 화면이 꺼졌거나 10분 넘게 아무도 안 만졌을 때만, 켠 지 1시간 뒤부터(하루 한 번 이하).
  static uint32_t lastHealth = 0;
  if (ms - lastHealth > 60000 && timeValid()) {
    lastHealth = ms;
    time_t t = time(nullptr); struct tm tm; localtime_r(&t, &tm);
    const unsigned big = heap_caps_get_largest_free_block(MALLOC_CAP_INTERNAL);
    if (tm.tm_hour == 3 && s_sync == SYNC_IDLE && ms > 3600000UL && (big < 40000 || s_failCount >= 4)) {
      lock(); const uint32_t idle = lv_disp_get_inactive_time(NULL); unlock();
      if (s_blOff || idle > 10UL * 60 * 1000) {
        Serial.printf("health restart (internal largest %u, fails %d)\n", big, s_failCount);
        delay(100); ESP.restart();
      }
    }
  }

  {   // 컴퓨터 도우미: 받은 줄은 0.2초마다 읽고, 상태 글은 바뀔 때만 바꾼다
    static bool lastUsb = false; static uint32_t lastUsbChk = 0;
    if (ms - lastUsbChk > 200) {
      lastUsbChk = ms;
      deckPoll(ms);
      if (lastUsb != s_usbOn) { lastUsb = s_usbOn; Serial.printf("pc helper %s\n", s_usbOn ? "on" : "off"); lock(); deckStateText(); unlock(); }
    }
  }

  // 20분 동안 터치가 없으면 시계 장으로 돌아간다. 열린 덮개 창(비밀번호·일정 자세히·열린 목록)도 닫는다.
  // 비밀번호를 치던 중이면 두 배까지 기다린다.
  static uint32_t lastIdle = 0;
  if (ms - lastIdle > 5000) {
    lastIdle = ms;
    lock();
    const uint32_t idle = lv_disp_get_inactive_time(NULL), lim = 20UL * 60 * 1000;
    const bool typing = s_pwBox && !lv_obj_has_flag(s_pwBox, LV_OBJ_FLAG_HIDDEN) && idle < lim * 2;
    if (idle > lim && !typing && (s_page != P_CLOCK || overlayOpen())) {
      hideOverlays();
      s_findSel = "";   // 찾기 장은 목록부터 다시
      if (s_page != P_CLOCK) goPage(P_CLOCK);
    }
    unlock();
  }
  // 1분마다 화면 박자를 다시 맞춘다(밀려도 1분 안에 제자리로). 받는 중에는 끝날 때 맞춘다.
  static uint32_t lastResync = 0;
  if (ms - lastResync > 60000 && s_sync == SYNC_IDLE) { lastResync = ms; lcdResync(); }
  // 1분마다 상태 한 줄(화면·터치가 도는지)
  static uint32_t lastHb = 0;
  if (ms - lastHb > 60000) {
    lastHb = ms;
    Serial.printf("hb lv=%u flush=%u touch=%u page=%d sync=%d pc=%d inactive=%u\n", (unsigned)s_lvLoops, (unsigned)s_flushes,
                  (unsigned)s_touches, s_page, (int)s_sync, (int)s_usbOn, (unsigned)lv_disp_get_inactive_time(NULL));
  }
  delay(20);
}
