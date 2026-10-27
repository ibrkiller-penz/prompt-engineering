// 교실 알림판 — Waveshare ESP32-S3-Touch-LCD-4 V4.0 (4인치 480x480)
// 자료(board/index.json, t/NNN.json, where.json)는 BOARD_BASE_URL(include/board_config.h) 에서 받는다(7인치 키트와 같은 형식).
// 화면은 옆으로 밀어 넘기는 여섯 장: 시계(기본) · 오늘 시간표 · 주간 시간표 · 단축키 · 선생님 찾기 · 설정
// 볼 시간표에서 교장·교감을 고르면 교장실 모드(시계 장 = 학교 일정, 주간 장 = 학교 일정 목록).
// 내 값(주소·급식·날씨 위치 등)은 include/board_config.h 에서만 바꾼다. 색은 테마 5가지(설정 '화면 색', 7인치와 같은 값).
// 화면 180도 돌리기: board_config.h 의 BOARD_ROTATE_180(기본 1). 그림은 RGB 드라이버가, 터치는 touchRead 가 뒤집는다.
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
#include <esp_task_wdt.h>
#include <esp_system.h>
#include <time.h>
#include <math.h>
#include <mbedtls/base64.h>
#include "esp_rom_crc.h"
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

static const char *FW_VERSION = "0.2.0";
static const char *BASE_URL = BOARD_BASE_URL;
static const int W = 480, H = 480;
static const char *PERIOD_START[7] = BOARD_PERIOD_START;   // board_config.h
static const char *DOW[5] = {"월", "화", "수", "목", "금"};

// ── 색 ── 테마 5가지(설정 '화면 색', prefs "theme"). 값은 7인치와 똑같다. 1번 '따뜻함'이 원래 값.
// 바꾸면 다시 켜지 않고 화면 물체만 새 색으로 다시 만든다(rebuildUi). 빨강(C_PRIMARY)은 지우기·경고에만 쓴다.
struct Theme {
  const char *name;
  uint32_t C_PRIMARY, C_PRIMARY50, C_TEXT, C_MUTED, C_LIGHT, C_BG, C_SURF, C_ALT, C_BORDER, C_LINE, C_EMERALD, C_ROSE;
  uint32_t D_BG, D_PANEL, D_ROW, D_LINE, D_TEXT, D_SUB, D_MUTED, D_RED;
  uint32_t NOW_ROW, NOW_TAG, NOW_TX, NEXT_BD, C_SEL, C_SEL_TX, C_OK, C_WARN, C_DUTY;
  const char *D_MUTED_S;   // recolor 글(#색 글#)에 쓰는 D_MUTED
  uint32_t kind[8];        // 종류 테두리: n d j x c e f h
};
static const Theme THEMES[5] = {
  {"따뜻함", 0xdc2626, 0xfef2f2, 0x2a2320, 0x5c5048, 0x7a6d60, 0xf6f1e9, 0xffffff, 0xfbf8f3, 0xdcd2c4, 0xece5da, 0x10b981, 0xe11d48,
   0x1c1714, 0x26201c, 0x342c26, 0x4a4038, 0xfaf5ee, 0xe2d8cc, 0xb8ab9c, 0xb91c1c,
   0xfff4e0, 0xfbbf24, 0x2a2320, 0xfacc15, 0xfbbf24, 0x2a2320, 0x34d399, 0xfb923c, 0xfcd34d, "b8ab9c",
   {0x34d399, 0xfb923c, 0x818cf8, 0xf87171, 0xa78bfa, 0xf472b6, 0x38bdf8, 0xf87171}},
  {"남색밤", 0xdc2626, 0xfef2f2, 0x0f1b33, 0x3b4a66, 0x5a6a85, 0xe6ebf3, 0xf8fafd, 0xedf1f7, 0xb9c4d6, 0xdbe2ec, 0x34d399, 0xfb7185,
   0x0e1626, 0x16213a, 0x1f2d4b, 0x2f4064, 0xf4f7fc, 0xd3dcec, 0xa3b1c9, 0xb91c1c,
   0xfef3c7, 0xfbbf24, 0x0e1626, 0xfacc15, 0xfbbf24, 0x0e1626, 0x34d399, 0xfb923c, 0xfcd34d, "a3b1c9",
   {0x34d399, 0xfb923c, 0xa5b4fc, 0xf87171, 0xc4b5fd, 0xf9a8d4, 0x38bdf8, 0x94a3b8}},
  {"밝은종이", 0xb91c1c, 0xfdeceb, 0x1f1914, 0x54483d, 0x6e6152, 0xf3ede1, 0xfffcf5, 0xf8f3ea, 0xd6cab8, 0xe8dfd0, 0x047857, 0xbe123c,
   0xf3ede1, 0xfbf7ef, 0xebe3d4, 0xd9ceb9, 0x1f1914, 0x463b31, 0x685a4c, 0xb91c1c,
   0xffd95a, 0x854000, 0xffffff, 0x995200, 0x854000, 0xffffff, 0x0f6b3e, 0x9a3412, 0x854000, "685a4c",
   {0x0a7a4a, 0xc2500a, 0x5b5bd6, 0xc81e1e, 0x8b3fc9, 0xc72a7a, 0x0a72b0, 0x7a6a5a}},
  {"고대비", 0xb00000, 0xffe5e5, 0x000000, 0x333333, 0x4d4d4d, 0xe6e6e6, 0xffffff, 0xf2f2f2, 0x595959, 0x8c8c8c, 0x3ddc84, 0xff7a7a,
   0x000000, 0x101010, 0x1e1e1e, 0x505050, 0xffffff, 0xe6e6e6, 0xbfbfbf, 0xb00000,
   0xfff59d, 0xffd400, 0x000000, 0xffd400, 0xffd400, 0x000000, 0x3ddc84, 0xff9a2e, 0xffd400, "bfbfbf",
   {0x33dd77, 0xff8a00, 0x9d8cff, 0xff3b3b, 0x4dd2ff, 0xff5fd2, 0x3d8bff, 0xb0b0b0}},
  {"숲초록", 0xdc2626, 0xfef2f2, 0x14261f, 0x3d5a4f, 0x52695f, 0xeef4f0, 0xffffff, 0xf6faf7, 0xc9d9d0, 0xe1ebe5, 0x4ade80, 0xfb7185,
   0x0f1a17, 0x15241f, 0x1d302a, 0x2f4a41, 0xf0f7f3, 0xcfe0d8, 0xa8c0b6, 0xb91c1c,
   0xfff1dc, 0xffb454, 0x1a2420, 0xffcf5c, 0xffb454, 0x1a2420, 0x4ade80, 0xfb923c, 0xffcf5c, "a8c0b6",
   {0x4ade80, 0xfb923c, 0x818cf8, 0xf87171, 0xc084fc, 0xf472b6, 0x38bdf8, 0xb8b2a8}},
};
static const int THEME_N = 5;
static int s_themeIdx = 0;                // prefs "theme"(0~4)
static const Theme *s_th = &THEMES[0];   // setup 에서 prefs "theme" 을 읽어 buildUI 전에 정한다
static uint32_t s_themeReqAt = 0;         // 화면 색을 바꾼 때(잠시 뒤 loop 가 화면을 새 색으로 다시 만든다 — 다시 켜지 않는다)
#define C_PRIMARY (s_th->C_PRIMARY)
#define C_TEXT (s_th->C_TEXT)
#define C_MUTED (s_th->C_MUTED)
#define C_EMERALD (s_th->C_EMERALD)
#define C_ROSE (s_th->C_ROSE)
#define D_BG (s_th->D_BG)
#define D_PANEL (s_th->D_PANEL)
#define D_ROW (s_th->D_ROW)
#define D_LINE (s_th->D_LINE)
#define D_TEXT (s_th->D_TEXT)
#define D_SUB (s_th->D_SUB)
#define D_MUTED (s_th->D_MUTED)
#define D_MUTED_S (s_th->D_MUTED_S)
#define D_RED (s_th->D_RED)
#define NOW_ROW (s_th->NOW_ROW)       // 지금 교시 줄·칸(크림). 그 위 글자는 C_TEXT/C_MUTED
#define D_NOW NOW_ROW
#define NOW_TAG (s_th->NOW_TAG)       // 지금 교시 표지(호박색) — 빨강은 결강·시험처럼 읽혀서 쓰지 않는다
#define NOW_TX (s_th->NOW_TX)
#define NEXT_BD (s_th->NEXT_BD)       // 다음 수업 테두리
#define C_SEL (s_th->C_SEL)           // 고른 단추·주단추 테두리
#define C_SEL_TX (s_th->C_SEL_TX)
#define C_OK (s_th->C_OK)             // 정상 글자(초록)
#define C_WARN (s_th->C_WARN)         // 경고 글자(주황)
#define C_DUTY (s_th->C_DUTY)         // 할 일·D-day 글자(노랑)
#define TAG_BG 0xc2410c               // 보강·지도 꼬리표(흰 글자와 명암비 5.2:1, 테마와 무관)

struct CellStyle { uint32_t border; };
static CellStyle styleOf(char t) {   // 종류 색은 테두리로만
  const uint32_t *k = s_th->kind;
  switch (t) {
    case 'n': return {k[0]};
    case 'd': return {k[1]};
    case 'j': return {k[2]};
    case 'x': return {k[3]};
    case 'c': return {k[4]};
    case 'e': return {k[5]};
    case 'f': return {k[6]};
    case 'h': return {k[7]};
    default: return {D_LINE};
  }
}
static const char *hex6(uint32_t c) {   // recolor 글('#색 글#')용 6자리. 한 줄 안에서 두 번 쓸 수 있게 칸 4개를 돌려 쓴다
  static char b[4][8]; static int i = 0;
  i = (i + 1) & 3; snprintf(b[i], sizeof b[i], "%06lx", (unsigned long)(c & 0xffffff)); return b[i];
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
// 같은 값이면 다시 쓰지 않는다(LVGL 8 은 같은 값이어도 다시 그릴 표시를 한다 → 1분마다 그리는 넓이를 줄인다)
static bool setTextIf(lv_obj_t *o, const char *t) { if (o && strcmp(lv_label_get_text(o), t)) { lv_label_set_text(o, t); return true; } return false; }
static void setBgIf(lv_obj_t *o, uint32_t c) { if (o && lv_obj_get_style_bg_color(o, 0).full != lv_color_hex(c).full) lv_obj_set_style_bg_color(o, lv_color_hex(c), 0); }
static void setBorderIf(lv_obj_t *o, uint32_t c) { if (o && lv_obj_get_style_border_color(o, 0).full != lv_color_hex(c).full) lv_obj_set_style_border_color(o, lv_color_hex(c), 0); }
static void setBorderWIf(lv_obj_t *o, int w) { if (o && lv_obj_get_style_border_width(o, 0) != w) lv_obj_set_style_border_width(o, w, 0); }
static void setTextColIf(lv_obj_t *o, uint32_t c) { if (o && lv_obj_get_style_text_color(o, 0).full != lv_color_hex(c).full) lv_obj_set_style_text_color(o, lv_color_hex(c), 0); }
static void setWidthIf(lv_obj_t *o, lv_coord_t w) { if (o && lv_obj_get_style_width(o, 0) != w) lv_obj_set_width(o, w); }
static void showIf(lv_obj_t *o, bool on) { if (!o) return; if (on == lv_obj_has_flag(o, LV_OBJ_FLAG_HIDDEN)) { if (on) lv_obj_clear_flag(o, LV_OBJ_FLAG_HIDDEN); else lv_obj_add_flag(o, LV_OBJ_FLAG_HIDDEN); } }
static bool setTextFmtIf(lv_obj_t *o, const char *fmt, ...) {   // 형식 글도 같으면 그대로
  static char b[256]; va_list ap; va_start(ap, fmt); vsnprintf(b, sizeof b, fmt, ap); va_end(ap);
  return setTextIf(o, b);
}
static bool s_offToday = false;   // 오늘 쉬는 날인가(주말·휴일). 분이 바뀔 때 한 번 계산(isOffDay 는 일정 JSON 을 훑어 무겁다)
static String s_offName;          // 쉬는 까닭
static bool s_pickMissing = false; // 고른 '볼 시간표' 이름이 목록에 없다 → 다시 고르라고 알린다
static bool s_ttSame = false;     // 마지막 시간표 받기가 304(바뀌지 않음)였나
static uint32_t s_ttGen = 0;      // 시간표를 새로 읽을 때마다 1 오른다(D-day 계산을 그때만)
// 점검표: 항목마다 마지막으로 받은 시각과 결과(0 아직 · 1 성공 · -1 실패)
enum { OK_WIFI, OK_TIME, OK_TT, OK_WHR, OK_WX, OK_AIR, OK_MEAL, OK_SCH, OK_N };
static char s_okHM[OK_N][6];
static int8_t s_okRes[OK_N];
static const char *s_okFail[OK_N];   // 실패 이유(정해 둔 글만 가리킨다)
static const char *s_resetWhy = "-";  // 지난번 다시 켜진 이유(설정 버전 줄)
static int s_crashN = 0;              // 멈춤·오류·전압 부족으로 다시 켜진 횟수(prefs "crashN", [다시 켜기]로 0)
static volatile bool s_syncReq = false;   // 곧 한 번 받기(loop 가 처리)

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
#if BOARD_ROTATE_180
    x[0] = W - 1 - constrain(x[0], 0, W - 1); y[0] = H - 1 - constrain(y[0], 0, H - 1);   // 화면을 180도 돌렸으니 터치 좌표도 함께 뒤집는다(480 이 와도 -1 이 되지 않게)
#endif
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
#if BOARD_ROTATE_180
  // 180도: 박자·PCLK·완충 버퍼는 그대로 두고, 그림을 화면 버퍼에 옮길 때 드라이버가 좌우·위아래를 뒤집어 넣는다
  // (ESP-IDF 5.5 esp_lcd_panel_rgb.c: draw_bitmap 의 CPU 복사가 rotate_mask MIRROR_X|Y 를 따른다. LVGL 쪽 회전(sw_rotate)은 버퍼가 더 들어 쓰지 않는다)
  ESP_ERROR_CHECK(esp_lcd_panel_mirror(s_panel, true, true));
#endif
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
  // 글자색은 단추에 두고 이름표가 물려받는다 → 누를 수 없는(DISABLED) 모양은 바탕 D_PANEL · 글자 D_MUTED 로 한 번에
  lv_obj_set_style_text_color(b, lv_color_hex(fg), 0);
  lv_obj_set_style_bg_color(b, lv_color_hex(D_PANEL), LV_STATE_DISABLED);
  lv_obj_set_style_text_color(b, lv_color_hex(D_MUTED), LV_STATE_DISABLED);
  lv_obj_t *l = label(b, &kr16, fg, txt);
  lv_obj_remove_local_style_prop(l, LV_STYLE_TEXT_COLOR, 0);
  lv_obj_center(l);
  return b;
}
// 주단추: 어두운 바탕 + 호박색 테두리(빨강은 지우기·경고에만 쓴다)
static lv_obj_t *mainButton(lv_obj_t *parent, const char *txt, int w, int h) {
  lv_obj_t *b = button(parent, txt, w, h, D_ROW, D_TEXT);
  lv_obj_set_style_border_color(b, lv_color_hex(C_SEL), 0);
  lv_obj_set_style_border_width(b, 2, 0);
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
static String isoAddDays(const String &iso, int n) {   // "2026-10-25" + n일
  struct tm t = {}; t.tm_year = iso.substring(0, 4).toInt() - 1900; t.tm_mon = iso.substring(5, 7).toInt() - 1; t.tm_mday = iso.substring(8, 10).toInt() + n; t.tm_hour = 12;
  mktime(&t); char b[11]; strftime(b, sizeof b, "%Y-%m-%d", &t); return String(b);
}
static bool afterSchool() { return timeValid() && nowMin() >= toMin("16:30"); }   // 수업이 끝난 뒤(내일 시간표를 보인다)

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
// 오늘(없으면 다음 수업일). 수업이 끝난 뒤(16:30~)와 휴일에는 오늘 대신 다음 수업일을 돌려준다. 다음 날 자료가 없으면 오늘.
// skipped: 돌려준 날이 오늘보다 뒤(방과 후·주말·휴일 미리보기). todayOut: 건너뛴 오늘 칸(있으면)
static JsonObject findDay(bool &isToday, bool *skipped = nullptr, JsonObject *todayOut = nullptr) {
  String t = todayIso();
  isToday = false;
  if (skipped) *skipped = false;
  if (todayOut) *todayOut = JsonObject();
  const bool after = afterSchool();
  JsonObject next, last, today;
  for (JsonObject w : s_tt["weeks"].as<JsonArray>())
    for (JsonObject d : w["days"].as<JsonArray>()) {
      const char *ds = d["date"] | "";
      last = d;
      if (t.length() && t == ds) {
        if (!after && strcmp(d["type"] | "", "holiday")) { isToday = true; return d; }
        today = d; continue;                                   // 방과 후·휴일: 다음 날을 찾는다
      }
      if (t.length() && next.isNull() && strcmp(ds, t.c_str()) > 0) next = d;
    }
  if (todayOut) *todayOut = today;
  if (!next.isNull()) { if (skipped) *skipped = true; return next; }
  if (!today.isNull()) { isToday = true; return today; }
  return last;
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

// '과목 · 교실' (과목은 밝은 글자로 눈에 띄게 색 표시 — 테마 색을 따른다)
static String classText(JsonArray c) {
  String s = "#"; s += hex6(D_TEXT); s += " "; s += (const char *)(c[1] | ""); s += "#";
  const char *b = c[2] | "";
  if (*b) { s += " · "; s += b; }
  return s;
}

// ① 시계 화면의 '지금 / 다음' 띠. 다음은 '수업이 있는 교시'까지 건너뛰어 찾는다(공강은 건너뜀, 지도·보강은 수업으로 친다).
// 띠는 어두운 칸 + 호박색 테두리(빨강 바탕은 경고처럼 읽혀서 쓰지 않는다). 높이가 바뀔 때만 자리를 다시 잡는다.
static void setBand(bool twoLines) {
  static int last = -1;
  if (last == (int)twoLines) return;
  last = (int)twoLines;
  const int CW = 428, NY = 258, NH = twoLines ? 66 : 36;
  lv_obj_set_height(s_band, NH);
  show(s_bandSep, twoLines); show(s_nextTag, twoLines); show(s_nextLbl, twoLines);
  const int IY = NY + NH + 8;
  lv_obj_set_pos(s_info, 16, IY);
  lv_obj_set_size(s_info, CW, 436 - IY);
  lv_obj_set_height(s_meal, 436 - IY - 48);
}
static void resetBandLayout() { setBand(true); setBand(false); }   // 화면을 새로 만든 뒤: 기억한 높이를 버리고 다시 잡게
static void renderBand() {
  if (!s_ttLoaded) {
    setTextIf(s_nowLbl, !s_prefs.getString("ssid", "").length() ? "맨 오른쪽 설정 장에서 와이파이를 연결하세요"
                        : urlUnset() ? "시간표 주소가 아직 없습니다 · 관리자에게 알려 주세요"
                        : s_pickMissing ? "볼 시간표를 다시 고르세요 · 설정 장" : "시간표를 받는 중...");
    setBand(false);
    return;
  }
  bool isToday, skipped;
  JsonObject todayObj;
  JsonObject day = findDay(isToday, &skipped, &todayObj);
  JsonArray cells = day["cells"].as<JsonArray>();
  const char *ty = day["type"] | "";
  const bool exam = !strcmp(ty, "exam");
  const int nm = timeValid() ? nowMin() : -1;
  const bool teacher = isTeacher();
  const String sub = String("#") + hex6(D_SUB) + " ", hi = String("#") + hex6(D_TEXT) + " ";
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
    const String td = todayIso();
    char b[48];
    if (td.length() && isoAddDays(td, 1) == date) snprintf(b, sizeof b, "내일 %d교시 ", fp + 1);
    else snprintf(b, sizeof b, "다음 수업 %d/%d(%s) %d교시 ", atoi(date + 5), atoi(date + 8), dow, fp + 1);
    return String(b) + classText(nd["cells"][fp].as<JsonArray>());
  };

  if (!isToday) {
    String n = nextDayText();
    const bool holidayToday = !todayObj.isNull() && !strcmp(todayObj["type"] | "", "holiday");
    String pre;
    if (skipped && !todayObj.isNull()) pre = holidayToday ? String("오늘 휴일 · ") : hi + "오늘 수업 끝# · ";
    String t = n.length() ? pre + n : (pre.length() ? pre + "다음 수업 없음" : String("오늘은 수업이 없습니다"));
    setTextIf(s_nowLbl, t.c_str());
    setBand(false);
    return;
  }
  String now;
  if (nowP >= 0) {
    JsonArray c = cells[nowP];
    now = String(nowP + 1) + "교시 ";
    now += *(const char *)(c[0] | "") ? classText(c) : (teacher ? sub + "공강#" : sub + "수업 없음#");
    now += exam ? String(" · 시험") : " · " + hm(toMin(PERIOD_START[nowP]) + 50) + "까지";
  } else if (nm >= toMin("12:30") && nm < toMin("13:30")) {
    now = (teacher && *(const char *)(day["lunch"] | "")) ? hi + "급식지도# · 13:30까지" : String("점심시간 · 13:30까지");
  } else if (nm < toMin(PERIOD_START[0])) now = "수업 전";
  else if (nm >= lastEnd || nextP < 0) now = hi + "오늘 수업 끝#";
  else now = "쉬는 시간";

  if (nextP >= 0) {
    JsonArray c = cells[nextP];
    int st = toMin(PERIOD_START[nextP]);
    String next = String(nextP + 1) + "교시 " + classText(c) + " · " + PERIOD_START[nextP] + " #" + hex6(C_DUTY) + " (" + leftText(st - nm) + ")#";
    setTextIf(s_nowLbl, now.c_str());
    setTextIf(s_nextLbl, next.c_str());
    const bool soon = st - nm <= 10 && !exam;   // 수업 10분 전부터 '다음'을 노랗게 — 곧 가야 한다(시험 날은 띄우지 않는다)
    setBgIf(s_nextTag, soon ? NEXT_BD : D_LINE);
    setTextColIf(lv_obj_get_child(s_nextTag, 0), soon ? NOW_TX : D_SUB);
    setBand(true);
  } else {
    String n = nextDayText();
    if (n.length()) now += " · " + n;
    setTextIf(s_nowLbl, now.c_str());
    setBand(false);
  }
}

// ① 할 일: 급식지도 · 공강지도 · 보강 · 야자 감독 · 바뀐 수업(당겨옴·결강·시험 감독·창체·행사, 교실까지).
// 오늘(방과 후·주말·휴일에는 다음 수업일), 3개 넘으면 '외 N건'(시험 날은 7개까지).
// 방과 후여도 오늘 저녁 야자 감독은 18:30 전까지 맨 앞에 남긴다.
static void renderDuty() {
  String duty; int cnt = 0;
  bool isToday = false, showDay = false;
  if (s_ttLoaded) {
    bool skipped; JsonObject todayObj;
    JsonObject day = findDay(isToday, &skipped, &todayObj);
    const bool exam = !strcmp(day["type"] | "", "exam");
    const int cap = exam ? 7 : 3;
    auto add = [&](const String &s) { if (++cnt > cap) return; if (duty.length()) duty += "  ·  "; duty += s; };
    auto roomOf = [](const char *b) { String room = b; int dot = room.indexOf(" · "); if (dot > 0) room = room.substring(0, dot); room.trim(); return room; };
    const bool teacher = isTeacher();
    const String me = String((const char *)(s_tt["name"] | ""));
    const int nm = timeValid() ? nowMin() : -1;
    const bool tonight = skipped && teacher && !todayObj.isNull() && me.length() && me == (const char *)(todayObj["night"] | "")
                         && nm >= 0 && nm < toMin("18:30");
    const String td = todayIso();
    const char *date = day["date"] | "", *dow = day["dow"] | "";
    const bool tomorrow = !isToday && td.length() && isoAddDays(td, 1) == date;
    showDay = isToday || skipped;
    if (showDay) {
      if (teacher && *(const char *)(day["lunch"] | "")) add("급식지도 12:30");
      JsonArray cells = day["cells"].as<JsonArray>();
      for (int p = 0; p < 7; p++) {
        JsonArray c = cells[p];
        const char *t = c[0] | "", *a = c[1] | "", *b = c[2] | "", *g = c[3] | "";
        const String pn = String(p + 1) + "교시 ";
        const String room = roomOf(b), rs = room.length() ? " " + room : String();
        const char *ga = *g ? g : a;
        if (*t == 'j') {
          if (!strcmp(g, "지도")) add(pn + "공강지도" + rs);
          else if (!strcmp(g, "보강")) add(pn + "보강" + rs);
        } else if (*t == 'd') add(pn + "당겨옴 " + a + rs);
        else if (*t == 'x') add(pn + "결강");
        else if (*t == 'e') { if (teacher && room.length()) add(pn + "감독 " + room); else if (*ga) add(pn + ga + rs); }
        else if ((*t == 'c' || *t == 'f') && (*ga || room.length())) add(pn + ga + rs);
      }
      if (teacher && me.length() && me == (const char *)(day["night"] | "")) add("야자 감독 18:30");
      if (cnt > cap) duty += "  ·  외 " + String(cnt - cap) + "건";
      if (duty.length() && !isToday) duty = (tomorrow ? String("내일 · ") : String(dow) + "요일 · ") + duty;
    }
    if (tonight) duty = String("오늘 야자 감독 18:30") + (duty.length() ? "  ·  " + duty : String());
  }
  setTextIf(s_duty, duty.length() ? duty.c_str() : isToday ? "오늘은 따로 맡은 일이 없습니다" : showDay ? "따로 맡은 일이 없습니다" : "-");
  setTextColIf(s_duty, duty.length() ? C_DUTY : D_MUTED);
}

// D-day: 수능(board_config.h 의 SUNEUNG_DATE) 당일까지. 오늘이 시험 날이면 'N일째', 아니면 시간표의 다음 시험(연속된 시험은 첫날).
// 날짜가 바뀌거나 시간표를 새로 받았을 때만 계산한다(1분마다 일정을 훑지 않게).
static bool s_ddayForce = false;   // 화면을 새로 만든 뒤 한 번 다시 쓰게
static void renderDday() {
  static String ddKey; static char dd[64] = ""; static bool ddOn = false, ddHot = false;
  const String td = todayIso();
  const String key = td + "#" + String(s_ttGen) + "#" + String((int)s_ttLoaded);
  if (key != ddKey) {
    ddKey = key; ddOn = ddHot = false; dd[0] = 0;
    auto dayNo = [](const char *iso) { struct tm tm = {}; tm.tm_year = atoi(iso) - 1900; tm.tm_mon = atoi(iso + 5) - 1; tm.tm_mday = atoi(iso + 8); tm.tm_hour = 12; return (long)(mktime(&tm) / 86400); };
    if (td.length()) {
      int run = 0, todayRun = 0; bool prevEx = false; const char *prevTag = ""; char todayTag[48] = "";
      for (JsonObject w : s_tt["weeks"].as<JsonArray>())
        for (JsonObject d : w["days"].as<JsonArray>()) {
          const char *ds = d["date"] | "", *tg = d["tag"] | "";
          const bool ex = !strcmp(d["type"] | "", "exam");
          run = ex ? ((prevEx && !strcmp(prevTag, tg)) ? run + 1 : 1) : 0;
          if (td == ds) { todayRun = run; snprintf(todayTag, sizeof todayTag, "%s", tg); }
          prevEx = ex; prevTag = tg;
        }
      long left = -1;
      if (strlen(SUNEUNG_DATE) == 10) left = dayNo(SUNEUNG_DATE) - dayNo(td.c_str());
      if (left == 0) { snprintf(dd, sizeof dd, "수능 D-DAY"); ddOn = ddHot = true; }
      else if (todayRun > 0) { snprintf(dd, sizeof dd, "%s %d일째", *todayTag ? todayTag : "시험", todayRun); ddOn = ddHot = true; }
      else if (left > 0) { snprintf(dd, sizeof dd, "수능 D-%ld", left); ddOn = true; ddHot = left <= 7; }
      else {
        prevEx = false; prevTag = "";
        for (JsonObject w : s_tt["weeks"].as<JsonArray>()) {
          for (JsonObject d : w["days"].as<JsonArray>()) {
            const char *ds = d["date"] | "", *tg = d["tag"] | "";
            const bool ex = !strcmp(d["type"] | "", "exam");
            if (ex && strcmp(ds, td.c_str()) > 0 && !(prevEx && !strcmp(prevTag, tg))) {
              const long l2 = dayNo(ds) - dayNo(td.c_str());
              snprintf(dd, sizeof dd, "%s D-%ld", *tg ? tg : "시험", l2); ddOn = true; ddHot = l2 <= 7; break;
            }
            prevEx = ex; prevTag = tg;
          }
          if (ddOn) break;
        }
      }
    }
  }
  s_ddayForce = false;
  if (ddOn) setTextIf(s_dday, dd);
  setBgIf(s_dday, ddHot ? NOW_TAG : D_ROW);                          // 7일 안으로 다가오면 호박색으로 눈에 띄게
  setTextColIf(s_dday, ddHot ? NOW_TX : C_DUTY);
  showIf(s_dday, ddOn);
}

// ② 오늘 시간표 (8줄: 1~4교시, 점심, 5~7교시. 지금 교시는 크림색 줄). 16:30 뒤·휴일에는 다음 수업일(내일 시간표).
// 1분마다 다시 부르므로 값이 바뀐 것만 다시 쓴다.
static void renderToday() {
  if (!s_ttLoaded) {
    setTextIf(s_dayTitle, s_pickMissing ? "볼 시간표를 다시 고르세요" : "시간표 없음");
    for (int r = 0; r < 8; r++) { setTextIf(s_rowA[r], ""); setTextIf(s_rowB[r], ""); showIf(s_rowTag[r], false); }
    return;
  }
  bool isToday, skipped;
  JsonObject todayObj;
  JsonObject day = findDay(isToday, &skipped, &todayObj);
  const char *date = day["date"] | "", *dow = day["dow"] | "", *tag = day["tag"] | "";
  const String td = todayIso();
  const bool tomorrow = !isToday && td.length() && isoAddDays(td, 1) == date;
  const bool todayHoliday = !todayObj.isNull() && !strcmp(todayObj["type"] | "", "holiday");
  const char *ty = day["type"] | "";
  const bool holiday = !strcmp(ty, "holiday"), exam = !strcmp(ty, "exam");   // 휴일: '지금' 표시 없음 · 시험: 시험 꼬리표
  const char *tagShow = todayHoliday ? "오늘 휴일" : tag;              // 휴일에는 다음 수업일을 보이고 꼬리표로 알린다
  bool tchg;
  if (isToday) tchg = setTextFmtIf(s_dayTitle, "오늘 · %d월 %d일 (%s)", atoi(date + 5), atoi(date + 8), dow);
  else if (tomorrow) tchg = setTextFmtIf(s_dayTitle, "내일 시간표 · %d/%d (%s)", atoi(date + 5), atoi(date + 8), dow);
  else tchg = setTextFmtIf(s_dayTitle, "다음 수업일 · %d월 %d일 (%s)", atoi(date + 5), atoi(date + 8), dow);
  const bool gchg = setTextIf(s_dayTag, tagShow);
  const int tagKind = (todayHoliday || holiday) ? 1 : exam ? 2 : 0;   // 1 휴일 · 2 시험 · 0 행사
  setBgIf(s_dayTag, tagKind == 1 ? D_LINE : tagKind == 2 ? D_ROW : NOW_ROW);
  setTextColIf(s_dayTag, tagKind == 1 ? D_SUB : tagKind == 2 ? C_DUTY : C_TEXT);
  setBorderWIf(s_dayTag, tagKind == 2 ? 1 : 0);
  const bool tagWas = lv_obj_has_flag(s_dayTag, LV_OBJ_FLAG_HIDDEN) == (bool)*tagShow;
  showIf(s_dayTag, *tagShow);
  if (*tagShow && (tchg || gchg || tagWas)) { lv_obj_update_layout(s_dayTitle); lv_obj_align_to(s_dayTag, s_dayTitle, LV_ALIGN_OUT_RIGHT_MID, 8, 0); }

  const bool teacher = isTeacher();
  const int nm = timeValid() ? nowMin() : -1;
  int nowP = -1, nextP = -1;
  JsonArray cells = day["cells"].as<JsonArray>();
  if (isToday && !holiday)
    for (int p = 0; p < 7; p++) {
      int st = toMin(PERIOD_START[p]);
      if (nm >= st && nm < st + 50) nowP = p;
      if (nextP < 0 && st > nm && *(const char *)(cells[p][0] | "")) nextP = p;   // 다음에 들어갈 수업(공강 건너뜀)
    }
  const bool lunchNow = isToday && !holiday && nm >= toMin("12:30") && nm < toMin("13:30");
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
      if (duty) { border = NEXT_BD; colA = C_DUTY; } else colA = D_MUTED;
      colB = D_MUTED;
    } else {
      JsonArray c = cells[p];
      const char *t = c[0] | "";
      textA = *t ? (const char *)(c[1] | "") : "";   // 공강은 글자도 없이 배경과 같게(공강지도는 수업으로 친다)
      textB = c[2] | "";
      textTag = c[3] | "";
      if (*t) border = styleOf(*t).border; else { colA = D_MUTED; colB = D_MUTED; free = true; border = D_PANEL; }
    }
    const bool past = isToday && !holiday && nm >= 0 && !now && !free && (p >= 0 ? nm >= toMin(PERIOD_START[p]) + 50 : nm >= toMin("13:30"));
    if (past) { colA = colB = D_MUTED; border = D_LINE; }            // 지난 교시는 흐리게, 테두리 색도 끈다
    if (now) { border = D_NOW; colA = C_TEXT; colB = C_MUTED; }
    setBgIf(s_row[r], now ? D_NOW : (free ? D_PANEL : D_ROW));
    const bool nextRow = !now && p >= 0 && p == nextP;   // 다음에 들어갈 수업: 노란 테두리
    setBorderIf(s_row[r], nextRow ? NEXT_BD : border);
    setBorderWIf(s_row[r], nextRow ? 2 : 1);
    const bool ca = setTextIf(s_rowA[r], textA);
    setTextIf(s_rowB[r], textB);
    setTextColIf(s_rowA[r], colA);
    setTextColIf(s_rowB[r], colB);
    const bool cg = setTextIf(s_rowTag[r], textTag);
    const bool was = lv_obj_has_flag(s_rowTag[r], LV_OBJ_FLAG_HIDDEN) == (bool)*textTag;
    showIf(s_rowTag[r], *textTag);
    if (*textTag && (ca || cg || was)) { lv_obj_update_layout(s_rowA[r]); lv_obj_align_to(s_rowTag[r], s_rowA[r], LV_ALIGN_OUT_RIGHT_MID, 8, 0); }
    setBgIf(s_rowP[r], now ? NOW_TAG : (free ? D_PANEL : D_LINE));
    lv_obj_t *pl = lv_obj_get_child(s_rowP[r], 0);
    setTextColIf(pl, now ? NOW_TX : (free ? D_MUTED : D_SUB));
    // 교시 칸: 평소에는 시작 시각, 지금 교시(점심)에는 남은 시간(시험 날은 '시험')
    if (p < 0) { if (now) setTextFmtIf(pl, "점심\n%d분", toMin("13:30") - nm); else setTextIf(pl, "점심"); }
    else if (now && exam) setTextFmtIf(pl, "%d교시\n시험", p + 1);
    else if (now) setTextFmtIf(pl, "%d교시\n%d분 남음", p + 1, toMin(PERIOD_START[p]) + 50 - nm);
    else setTextFmtIf(pl, "%d교시\n%s", p + 1, PERIOD_START[p]);
  }
}

// ③ 주간 시간표 (월~금 × 1~7교시, 오늘은 호박색 머리, 지금 칸은 크림색 칸). 값이 바뀐 칸만 다시 쓴다.
static void renderWeek() {
  if (!s_ttLoaded) { setTextIf(s_weekLbl, "시간표 없음"); return; }
  JsonArray weeks = s_tt["weeks"].as<JsonArray>();
  if (s_week < 0 || s_week >= (int)weeks.size()) s_week = currentWeek();
  JsonObject wk = weeks[s_week];
  JsonArray days = wk["days"].as<JsonArray>();
  String today = todayIso();
  int nm = timeValid() ? nowMin() : -1, nowP = -1;
  for (int p = 0; p < 7; p++) if (nm >= toMin(PERIOD_START[p]) && nm < toMin(PERIOD_START[p]) + 50) nowP = p;
  const char *d0 = days[0]["date"] | "", *d4 = days[days.size() - 1]["date"] | "";
  setTextFmtIf(s_weekLbl, "%s · %d/%d ~ %d/%d", s_ttName.c_str(), atoi(d0 + 5), atoi(d0 + 8), atoi(d4 + 5), atoi(d4 + 8));
  bool anyToday = false;
  for (int d = 0; d < 5; d++) {
    JsonObject day = days[d];
    const char *date = day["date"] | "";
    bool isToday = today.length() && today == date;
    const bool holiday = !strcmp(day["type"] | "", "holiday");
    anyToday |= isToday && !holiday;
    lv_obj_t *hl = lv_obj_get_child(s_hd[d], 0);
    setTextFmtIf(hl, "%s %d", DOW[d], atoi(date + 8));
    if ((lv_obj_get_style_bg_opa(s_hd[d], 0) == LV_OPA_COVER) != isToday) lv_obj_set_style_bg_opa(s_hd[d], isToday ? LV_OPA_COVER : LV_OPA_TRANSP, 0);
    setTextColIf(hl, isToday ? NOW_TX : D_MUTED);
    JsonArray cells = day["cells"].as<JsonArray>();
    for (int p = 0; p < 7; p++) {
      JsonArray c = cells[p];
      const char *t = c[0] | "";
      const bool nowCell = isToday && !holiday && p == nowP;
      lv_obj_t *o = s_cell[d][p];
      const lv_opa_t op = *t || nowCell ? LV_OPA_COVER : LV_OPA_TRANSP;
      if (lv_obj_get_style_bg_opa(o, 0) != op) lv_obj_set_style_bg_opa(o, op, 0);
      setBgIf(o, nowCell ? D_NOW : D_ROW);
      setBorderIf(o, nowCell ? D_NOW : (*t ? styleOf(*t).border : D_PANEL));
      setTextIf(s_cellA[d][p], c[1] | "");
      setTextIf(s_cellB[d][p], c[2] | "");
      setTextColIf(s_cellA[d][p], nowCell ? C_TEXT : D_TEXT);
      setTextColIf(s_cellB[d][p], nowCell ? C_MUTED : D_MUTED);
    }
  }
  for (int p = 0; p < 7; p++) setTextColIf(s_pl[p], anyToday && p == nowP ? NOW_TAG : D_MUTED);
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
  if (e) { Serial.printf("tt.json parse: %s\n", e.c_str()); if (s_prefs.isKey("et_tt")) s_prefs.remove("et_tt"); return false; }   // 다음엔 처음부터 받는다
  lock();   // 해석은 잠그지 않고, 화면이 읽는 자료를 바꾸는 순간만 잠근다
  s_tt = std::move(tmp);
  s_ttName = String((const char *)(s_tt["name"] | ""));
  if (strcmp(s_tt["kind"] | "", "teacher") == 0) s_ttName += " 선생님";
  s_ttLoaded = true;
  s_ttGen++;   // D-day 를 새로 계산
  unlock();
  return true;
}

// ── 받기 공통 (HTTP/1.0, 크기·JSON 을 확인한 뒤에만 저장본을 바꾼다) ──
// 인증서 확인은 아직 하지 않는다 — TODO: 루트 인증서 묶음
// 암호 연결 인사(TLS) 10초 · 연결 5초 상한. 전에는 인사 시간을 정하지 않아(기본 약 120초) 받기가 오래 멈출 수 있었다.
// budget: 이번 받기에 남은 시간(ms). 60초 마감을 넘지 않게 연결·인사·읽기 상한을 그 안으로 줄인다
static void netPrep(NetworkClientSecure &c, uint32_t budget) { c.setInsecure(); c.setHandshakeTimeout(max<uint32_t>(1, min<uint32_t>(10, budget / 1000))); }
static void httpLimits(HTTPClient &http, uint32_t budget, uint32_t readMs = 15000) { http.setConnectTimeout(min<uint32_t>(5000, budget)); http.setTimeout((uint16_t)min<uint32_t>(readMs, budget)); }
static float secs(uint32_t t0) { return (millis() - t0) / 1000.0f; }
// ETag: 바뀌지 않은 파일은 다시 받지 않는다(304). 저장한 파일이 있을 때만 묻는다.
static void etagAsk(HTTPClient &http, const char *key, const char *path) {
  static const char *keys[] = {"ETag"};
  http.collectHeaders(keys, 1);
  if (!LittleFS.exists(path)) return;
  String et = s_prefs.getString(key, "");
  if (et.length()) http.addHeader("If-None-Match", et);
}
static void etagKeep(HTTPClient &http, const char *key) {   // 200 으로 받아 저장한 뒤에만 부른다
  String et = http.header("ETag");
  if (et.length()) { if (s_prefs.getString(key, "") != et) s_prefs.putString(key, et); }
  else if (s_prefs.isKey(key)) s_prefs.remove(key);
}
static void etagForget(const char *key) { if (s_prefs.isKey(key)) s_prefs.remove(key); }
// 받아서 body 에. etKey·path 를 주면 ETag 로 묻고, 304 면 참을 돌려주고 same 을 세운다(body 는 비어 있다)
static bool httpGet(const String &url, String &body, uint32_t budget, uint32_t readMs = 15000, const char *etKey = nullptr, const char *path = nullptr, bool *same = nullptr) {
  if (same) *same = false;
  const uint32_t t0 = millis();
  NetworkClientSecure client; netPrep(client, budget);
  HTTPClient http;
  if (!http.begin(client, url)) return false;
  http.useHTTP10(true);
  httpLimits(http, budget, readMs);
  if (etKey) etagAsk(http, etKey, path);
  int code = http.GET();
  bool ok = code == 200;
  if (ok) body = http.getString();
  if (code == 304 && same) { *same = true; ok = true; }
  if (ok && code == 200 && etKey) etagKeep(http, etKey);   // 저장이 실패하면 아래에서 etagForget 한다
  http.end();
  const int q = url.indexOf('?');
  Serial.printf("GET %s -> %d (%.1fs)\n", (q > 0 ? url.substring(0, q) : url).c_str(), code, secs(t0));
  return ok;
}
// 시간표 파일을 받아 LittleFS 에 둔다. 304(바뀌지 않음)이면 참을 돌려주고 s_ttSame 을 세운다(다시 읽지 않는다).
static bool downloadTT(uint32_t budget = 60000) {
  s_ttSame = false;
  if (!WiFi.isConnected()) return false;
  lock(); const String file = s_ttFile; unlock();   // 설정 화면이 바꾸는 중일 수 있어 한 번만 옮겨 쓴다
  if (!file.length()) return false;
  const uint32_t t0 = millis();
  NetworkClientSecure client; netPrep(client, budget);
  HTTPClient http;
  String url = String(BASE_URL) + file;
  if (!http.begin(client, url)) return false;
  http.useHTTP10(true);
  httpLimits(http, budget);
  etagAsk(http, "et_tt", "/tt.json");
  int code = http.GET();
  s_ttCode = code == 304 ? 200 : code;
  bool ok = false;
  // 받는 사이에 설정에서 다른 시간표를 골랐으면 받은 것을 버리고 곧바로 새 파일을 받는다(옛 사람 시간표가 저장되지 않게)
  auto moved = [&]() { lock(); const bool m = s_ttFile != file; unlock(); if (m) { Serial.println("download: picked another, retry"); s_syncReq = true; } return m; };
  if (code == 304) { if (!moved()) { ok = true; s_ttSame = true; } }
  else if (code == 200) {
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
    if (whole && moved()) LittleFS.remove("/tt.tmp");
    else if (whole) { LittleFS.remove("/tt.json"); LittleFS.rename("/tt.tmp", "/tt.json"); ok = true; etagKeep(http, "et_tt"); }
    else { LittleFS.remove("/tt.tmp"); Serial.printf("download incomplete: %d/%d\n", got, want); }
  }
  http.end();
  Serial.printf("download %s -> %d (%.1fs)\n", url.c_str(), code, secs(t0));
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
static bool s_ttFileKnown = false;   // prefs 에 지난번 받던 파일(ttfile)이 있나
static void setTTFile(const String &f) {   // 다른 파일이면 처음부터 받고, 껐다 켜도 알 수 있게 저장한다
  if (!f.length() || f == s_ttFile) return;
  s_ttFile = f; etagForget("et_tt");
  s_prefs.putString("ttfile", f); s_ttFileKnown = true;
}
// 고른 이름의 파일을 찾는다. (가) 이름만 바뀐 경우: 지금 받고 있는 파일과 같은 항목을 쓰고 새 이름으로 저장
// (나) 처음 쓰는 보드(이름을 저장한 적 없음): 첫 항목. 그래도 없으면 옛 파일을 받지 않고 다시 고르라고 알린다(s_pickMissing)
static void resolvePick() {
  if (s_pickName.startsWith("@")) { s_pickMissing = false; return; }   // 교장·교감은 목록에 없어도 된다
  JsonArray items = s_index["items"].as<JsonArray>();
  if (items.isNull()) return;
  JsonObject hit;
  for (JsonObject it : items) if (s_pickName == (const char *)(it["name"] | "")) { hit = it; break; }
  if (hit.isNull() && s_ttFileKnown)
    for (JsonObject it : items)
      if (s_ttFile == (const char *)(it["file"] | "")) {
        hit = it; s_pickName = (const char *)(it["name"] | "");
        s_prefs.putString("ttname", s_pickName);
        Serial.printf("picker: renamed -> %s\n", s_pickName.c_str());
        break;
      }
  if (hit.isNull() && !s_prefs.isKey("ttname") && items.size()) { hit = items[0]; s_pickName = (const char *)(hit["name"] | ""); }
  s_pickMissing = hit.isNull();
  if (!s_pickMissing) setTTFile((const char *)(hit["file"] | ""));
}
// 드롭다운 맨 앞 두 줄은 교장·교감(학교 일정). 고르면 이름이 '@교장'·'@교감' 으로 저장된다.
static const int PICK_SPECIAL = 2;
static void fillPicker() {
  s_principal = s_pickName.startsWith("@");
  resolvePick();
  if (s_ttPick) {
    String opts = "교장실 · 학교 일정\n교감실 · 학교 일정";
    int sel = s_principal ? (s_pickName == "@교감" ? 1 : 0) : -1, i = PICK_SPECIAL;
    for (JsonObject it : s_index["items"].as<JsonArray>()) {
      const char *lb = it["label"] | "";
      if (!*lb) lb = it["name"] | "";
      opts += "\n"; opts += lb;
      if (!s_principal && s_pickName == (const char *)(it["name"] | "")) sel = i;
      i++;
    }
    lv_dropdown_set_options(s_ttPick, opts.c_str());
    if (sel >= 0) lv_dropdown_set_selected(s_ttPick, sel);
    static char miss[96];   // 드롭다운은 글 주소를 그대로 쓴다(복사하지 않는다) → static
    if (s_pickMissing && !s_principal && s_pickName.length()) { snprintf(miss, sizeof miss, "%s (목록에 없음)", s_pickName.c_str()); lv_dropdown_set_text(s_ttPick, miss); }
    else lv_dropdown_set_text(s_ttPick, nullptr);
  }
  applyMode();
}
static bool parseIndex(const String &body) {
  JsonDocument d(&s_alloc);
  if (deserializeJson(d, body) || d["items"].isNull()) return false;   // 해석은 잠그지 않는다
  lock();   // 바꾸는 순간만 잠근다(재귀 잠금이라 안에서 또 잠가도 된다)
  s_index = std::move(d);
  resolvePick();   // 받기 전에 s_ttFile 이 맞아야 한다
  unlock();
  return true;
}
static bool s_idxSame = false;   // 마지막 목록 받기가 304 였나 → 드롭다운을 다시 채우지 않는다
static String s_idxDay;          // 목록을 받은 날(목록은 거의 바뀌지 않아 하루 한 번 · [볼 시간표]를 열었을 때만 묻는다)
static volatile bool s_idxReq = false;   // [볼 시간표]를 열었다 → 다음 받기 때 목록도 묻는다
static bool downloadIndex(uint32_t budget = 60000) {
  String body;
  bool ok = WiFi.isConnected() && httpGet(String(BASE_URL) + "index.json", body, budget, 15000, "et_idx", "/index.json", &s_idxSame);
  if (ok && !s_idxSame) { ok = parseIndex(body); if (ok && !saveAtomic("/index.json", body)) etagForget("et_idx"); if (!ok) etagForget("et_idx"); }
  Serial.printf("index %s%s\n", ok ? "ok" : "fail", s_idxSame ? " (304)" : "");
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
static bool s_mealCached = false;   // 마지막 급식 받기가 '오늘 이미 받음'이었나(받지 않았으니 점검표 시각을 새로 찍지 않는다)
static bool downloadMeal(uint32_t budget = 60000) {
  String date = todayIso(), body;
  if (!MEAL_ON || !WiFi.isConnected() || !date.length()) return false;
  s_mealCached = false;
  if (s_mealDate == date && (s_mLunch.length() || s_mDinner.length())) { Serial.println("meal: today already"); s_mealCached = true; return true; }   // 오늘 메뉴는 하루 한 번만
  String ymd = date; ymd.replace("-", "");
  bool ok = httpGet(String(MEAL_URL) + ymd, body, budget) && parseMeal(body, date);
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
  if (!MEAL_ON) { setTextIf(s_mealTitle, "급식"); setTextIf(s_meal, "급식을 쓰지 않습니다"); return; }
  setTextIf(s_mealTitle, dinner ? "저녁" : "점심");
  const String &menu = dinner ? s_mDinner : s_mLunch;
  if (!today) setTextIf(s_meal, "급식 정보를 받는 중입니다");
  else if (!menu.length()) setTextIf(s_meal, "오늘은 급식이 없습니다");
  else setTextIf(s_meal, menu.c_str());
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
static bool downloadWeather(uint32_t budget = 60000) {
  String body;
  bool ok = WX_ON && WiFi.isConnected() && httpGet(WX_URL, body, budget) && parseWeather(body);
  if (ok) saveAtomic("/wx.json", body);
  Serial.printf("weather %s\n", ok ? "ok" : "fail");
  return ok;
}
// 같은 글·같은 그림이면 다시 쓰지 않는다(1시간마다 날씨 칸 전체를 다시 그리지 않게)
static void renderWeather() {
  for (int i = 0; i < 2; i++) {
    WxCard &k = s_card[i];
    const WxDay &w = s_wx[i];
    const char *day = i == 0 ? "오늘" : "내일";
    if (!s_wxOk) {
      showIf(k.img, false);
      setTextIf(k.desc, day); setTextIf(k.temp, "--"); setTextIf(k.line, WX_ON ? "날씨 받는 중" : "위치 설정 필요");
      continue;
    }
    const int code = (i == 0 && s_wxNowCode >= 0) ? s_wxNowCode : w.code;
    const float big = i == 0 && !isnan(s_wxNow) ? s_wxNow : w.tmax;
    showIf(k.img, true);
    if (lv_img_get_src(k.img) != (const void *)wxIcon(code)) lv_img_set_src(k.img, wxIcon(code));
    if (isnan(w.tmax) || isnan(w.tmin)) setTextIf(k.desc, day);
    else setTextFmtIf(k.desc, "%s  %d°/%d°", day, (int)lroundf(w.tmax), (int)lroundf(w.tmin));
    if (isnan(big)) setTextIf(k.temp, "--"); else setTextFmtIf(k.temp, "%d°", (int)lroundf(big));
    if (w.pop < 0) setTextIf(k.line, wxName(code));
    else setTextFmtIf(k.line, "%s · #%s 비 %d%%#", wxName(code), w.pop >= 40 ? "60a5fa" : D_MUTED_S, w.pop);
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
static bool downloadAir(uint32_t budget = 60000) {
  String body;
  bool ok = WX_ON && WiFi.isConnected() && httpGet(AIR_URL, body, budget) && parseAir(body);
  if (ok) saveAtomic("/air.json", body);
  Serial.printf("air %s\n", ok ? "ok" : "fail");
  return ok;
}
static void renderAir() {
  if (!WX_ON) { setTextFmtIf(s_dust, "#%s 미세먼지: 위치 설정 필요#", D_MUTED_S); return; }
  if (isnan(s_pm10) && isnan(s_pm25)) { setTextFmtIf(s_dust, "#%s 미세먼지 정보를 받는 중#", D_MUTED_S); return; }
  int g10 = isnan(s_pm10) ? 0 : s_pm10 <= 30 ? 0 : s_pm10 <= 80 ? 1 : s_pm10 <= 150 ? 2 : 3;
  int g25 = isnan(s_pm25) ? 0 : s_pm25 <= 15 ? 0 : s_pm25 <= 35 ? 1 : s_pm25 <= 75 ? 2 : 3;
  int g = g10 > g25 ? g10 : g25;
  static const char *NAME[4] = {"좋음", "보통", "나쁨", "매우 나쁨"};
  static const char *COLOR[4] = {"60a5fa", "34d399", "fb923c", "ef4444"};
  setTextFmtIf(s_dust, "#%s ● 미세먼지 %s#  #%s · PM10 %d · 초미세 %d#", COLOR[g], NAME[g], D_MUTED_S,
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
static bool s_whereSame = false;   // 마지막 받기가 304(바뀌지 않음)였나 → 다시 그리지 않는다
static bool downloadWhere(uint32_t budget = 60000) {
  String body;
  bool ok = WiFi.isConnected() && httpGet(String(BASE_URL) + "where.json", body, budget, 20000, "et_whr", "/where.json", &s_whereSame);
  if (ok && !s_whereSame) { ok = parseWhere(body); if (!ok || !saveAtomic("/where.json", body)) etagForget("et_whr"); }
  Serial.printf("where %s%s\n", ok ? "ok" : "fail", s_whereSame ? " (304)" : "");
  return ok;
}
static char whereKind(const char *s) { return (s && s[0] && s[1] == ':') ? s[0] : 0; }   // "n:102 수학" → 'n'
static const char *whereText(const char *s) { return (s && s[0] && s[1] == ':') ? s + 2 : ""; }
static void renderFinder() {
  JsonArray dates = s_where["dates"].as<JsonArray>();
  JsonObject who;
  for (JsonObject t : s_where["teachers"].as<JsonArray>()) if (s_findSel == (const char *)(t["n"] | "")) { who = t; break; }
  if (who.isNull()) { showIf(s_findDetail, false); showIf(s_findList, true); return; }
  setTextFmtIf(s_findName, "%s 선생님", s_findSel.c_str());
  const char *home = who["h"] | "";
  setTextIf(s_findHome, *home ? (String("담임 ") + home).c_str() : "");
  // 오늘(없으면 다음 수업일). 수업이 끝난 뒤(16:30~)에는 다음 수업일 시간표를 보인다(시계 장과 같은 규칙)
  String today = todayIso();
  const bool after = afterSchool();
  int di = -1; bool isToday = false, todayIn = false;
  for (int i = 0; i < (int)dates.size(); i++) {
    const char *d = dates[i] | "";
    if (today == d) { todayIn = true; if (!after) { di = i; isToday = true; break; } continue; }
    if (di < 0 && strcmp(d, today.c_str()) > 0) { di = i; break; }
  }
  if (di < 0) { di = 0; for (int i = 0; i < (int)dates.size(); i++) if (today == (const char *)(dates[i] | "")) { di = i; isToday = true; } }
  const char *date = dates[di] | "";
  if (isToday) setTextIf(s_findDay, "오늘 시간표");
  else if (today.length() && isoAddDays(today, 1) == date) setTextIf(s_findDay, "내일 시간표");
  else setTextFmtIf(s_findDay, "다음 수업일 %d/%d 시간표", atoi(date + 5), atoi(date + 8));
  JsonArray day = who["d"][di].as<JsonArray>();
  const int nm = timeValid() ? nowMin() : -1;
  int nowP = -1, nextP = -1;
  if (isToday)
    for (int p = 0; p < 7; p++) {
      int st = toMin(PERIOD_START[p]);
      if (nm >= st && nm < st + 50) nowP = p;
      if (nextP < 0 && st > nm && whereKind(day[p] | "")) nextP = p;
    }
  if (!isToday && todayIn && after) { setTextIf(s_findNowT, "지금"); setTextIf(s_findNow, "수업 끝"); }
  else if (!isToday) { setTextIf(s_findNowT, "오늘"); setTextIf(s_findNow, "수업이 없는 날입니다"); }
  else if (nowP >= 0) {
    const char *c = day[nowP] | "";
    setTextFmtIf(s_findNowT, "지금 · %d교시 %s", nowP + 1, PERIOD_START[nowP]);
    setTextIf(s_findNow, whereKind(c) ? whereText(c) : "공강 (교무실)");
  } else if (nm >= toMin("12:30") && nm < toMin("13:30")) { setTextIf(s_findNowT, "지금"); setTextIf(s_findNow, "점심시간"); }
  else if (nm < toMin(PERIOD_START[0])) { setTextIf(s_findNowT, "지금"); setTextIf(s_findNow, "수업 전"); }
  else if (nm >= toMin("16:30")) { setTextIf(s_findNowT, "지금"); setTextIf(s_findNow, "수업 끝"); }
  else { setTextIf(s_findNowT, "지금"); setTextIf(s_findNow, "쉬는 시간 (교무실)"); }
  if (nextP >= 0) setTextFmtIf(s_findNext, "다음  %d교시 %s · %s", nextP + 1, PERIOD_START[nextP], whereText(day[nextP] | ""));
  else setTextIf(s_findNext, isToday ? "오늘 남은 수업 없음" : "");
  for (int p = 0; p < 7; p++) {
    const char *c = day[p] | "";
    char k = whereKind(c);
    bool now = isToday && p == nowP;
    setBgIf(s_findRow[p], now ? D_NOW : (k ? D_ROW : D_PANEL));
    setBorderIf(s_findRow[p], now ? D_NOW : (k ? styleOf(k).border : D_PANEL));
    setTextColIf(s_findRowP[p], now ? C_MUTED : D_MUTED);
    setTextIf(s_findRowT[p], k ? whereText(c) : "");
    setTextColIf(s_findRowT[p], now ? C_TEXT : (k ? D_TEXT : D_MUTED));
  }
  showIf(s_findList, false); showIf(s_findDetail, true);
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
static int s_modeShown = -1;   // 지금 보이는 판(교장 1 · 일반 0). 화면을 새로 만들면 -1 로
static void applyMode() {
  if (s_clockPanel && s_prinPanel && s_weekPanel && s_schedPanel && s_todayHint && s_modeShown != (int)s_principal) {
    s_modeShown = (int)s_principal;
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
static bool downloadSchedule(uint32_t budget = 60000) {
  if (!WiFi.isConnected() || !HAS_SCHED || !timeValid()) return false;   // 오늘 날짜를 모르면 거를 수 없다
  const uint32_t t0 = millis();
  NetworkClientSecure client; netPrep(client, budget);
  HTTPClient http;
  // script.google.com → script.googleusercontent.com 주소 이동을 직접 따라간다(두 번째 연결 전에 멈춤 감시를 쓰다듬고 남은 시간을 다시 잰다)
  static const char *LOC[] = {"Location"};
  String url = SCHEDULE_URL;
  int code = -1;
  for (int hop = 0; hop < 3; hop++) {
    const uint32_t used = millis() - t0;
    if (hop && used + 3000 > budget) break;                   // 남은 시간이 없으면 그만
    if (hop) esp_task_wdt_reset();
    if (!http.begin(client, url)) return false;
    http.setFollowRedirects(HTTPC_DISABLE_FOLLOW_REDIRECTS);
    http.collectHeaders(LOC, 1);
    http.useHTTP10(true);
    httpLimits(http, budget - min(used, budget), 20000);
    code = http.GET();
    if (code != 301 && code != 302 && code != 303 && code != 307 && code != 308) break;
    const String next = http.header("Location");
    http.end();
    if (!next.length()) break;
    url = next;
  }
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
  Serial.printf("schedule -> %d %s (%d items, %.1fs)\n", code, ok ? "ok" : "fail", (int)s_sched["items"].size(), secs(t0));
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
  if (s_ttLoaded) {   // 오늘 날짜 칸의 종류를 직접 본다(findDay 는 휴일에 다음 수업일을 돌려준다)
    const String td = todayIso();
    for (JsonObject w : s_tt["weeks"].as<JsonArray>())
      for (JsonObject d : w["days"].as<JsonArray>())
        if (td == (const char *)(d["date"] | "")) { if (!strcmp(d["type"] | "", "holiday")) { if (name) *name = "휴일"; return true; } return false; }
  }
  return false;
}
// 오늘 시험 날인가(학사 일정의 이름에 '고사'·'시험'). 교장 화면의 '학교 지금'에 쓴다
static bool examTodayAcad() {
  if (!timeValid()) return false;
  const String td = todayIso();
  for (JsonArray a : s_sched["acad"].as<JsonArray>()) {
    if (td != (const char *)(a[0] | "")) continue;
    const char *nm = a[1] | "", *ty = a[2] | "";
    if (strstr(nm, "고사") || strstr(nm, "시험") || strstr(ty, "시험")) return true;
  }
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
  const String &offName = s_offName; const bool off = s_offToday;   // 주말·휴업일(분이 바뀔 때 계산해 둔 값)
  const bool exam = !off && examTodayAcad();                         // 시험 날: '분 남음' 대신 '시험 기간'
  char a[48] = "", b[96] = "", c[128] = "";
  if (!tv) snprintf(a, sizeof a, "%s", "시각을 맞추는 중");
  else if (off) { snprintf(a, sizeof a, "%s", offName == "주말" ? "주말" : "휴업일"); snprintf(b, sizeof b, "%s", offName == "주말" ? "수업 없음" : offName.c_str()); }
  else if (exam && (nowP >= 0 || lunch || nextP >= 0)) {
    snprintf(a, sizeof a, "%s", "시험 기간");
    if (nowP >= 0) snprintf(b, sizeof b, "%d교시 진행 중", nowP + 1);
    else snprintf(b, sizeof b, "%d교시 %s", nextP >= 0 ? nextP + 1 : 5, nextP >= 0 ? PERIOD_START[nextP] : PERIOD_START[4]);
  }
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
    if (i >= n) { showIf(s_pRow[i], false); continue; }
    showIf(s_pRow[i], true);
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
    setWidthIf(s_pRowA[i], sub.length() ? 254 : 354);   // 오른쪽 글이 없으면 제목이 줄 끝까지
    setBgIf(s_pRow[i], cur ? NOW_ROW : D_ROW);
    setBorderIf(s_pRow[i], cur ? NOW_ROW : nxt ? NEXT_BD : D_LINE);
    setBorderWIf(s_pRow[i], nxt ? 2 : 1);
    setBgIf(lv_obj_get_parent(s_pRowT[i]), q.today ? NOW_TAG : D_LINE);
    setTextColIf(s_pRowT[i], q.today ? NOW_TX : D_SUB);
    setTextColIf(s_pRowA[i], cur ? C_TEXT : past ? D_MUTED : D_TEXT);
    setTextColIf(s_pRowB[i], cur ? C_MUTED : D_MUTED);
  }
  if (!n) {   // 일정이 없거나 주소가 없을 때 안내 한 줄
    showIf(s_pRow[0], true);
    lv_obj_clear_flag(s_pRow[0], LV_OBJ_FLAG_CLICKABLE);
    setTextIf(s_pRowT[0], "-");
    setTextIf(s_pRowA[0], HAS_SCHED ? "다가오는 학교 일정이 없습니다" : "학교 일정 주소가 아직 없습니다 · 관리자 확인");
    setTextIf(s_pRowB[0], "");
    setWidthIf(s_pRowA[0], 354);
    setBgIf(s_pRow[0], D_ROW);
    setBorderIf(s_pRow[0], D_LINE);
    setBorderWIf(s_pRow[0], 1);
    setBgIf(lv_obj_get_parent(s_pRowT[0]), D_LINE);
    setTextColIf(s_pRowT[0], D_SUB);
    setTextColIf(s_pRowA[0], D_MUTED);
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
    setTextColIf(s_pAcad[k], left == 0 ? NOW_TAG : left <= 3 ? D_TEXT : D_SUB);
    showIf(s_pAcad[k], true);
    k++;
  }
  if (!k && s_pAcad[0]) { setTextIf(s_pAcad[0], "다가오는 학사 일정이 없습니다"); setTextColIf(s_pAcad[0], D_MUTED); showIf(s_pAcad[0], true); k = 1; }
  for (; k < 3; k++) showIf(s_pAcad[k], false);
}
static int s_detailIdx = -1;                                   // 자세히 창에 보이는 일정(s_sched["items"] 번호)
static lv_obj_t *s_dScroll = nullptr, *s_dPrev = nullptr, *s_dNext = nullptr;
static void showSchedDetail(int i) {
  JsonArray r = s_sched["items"][i];
  if (r.isNull() || !s_pDetail) return;
  s_detailIdx = i;
  {   // [이전 일정]·[다음 일정]: 목록 차례(schedSorted)의 앞뒤. 끝이면 누를 수 없는 모양(DISABLED)으로
    static int idx[64]; const int n = schedSorted(idx, 64);
    int pos = -1; for (int k = 0; k < n; k++) if (idx[k] == i) pos = k;
    auto en = [](lv_obj_t *b, bool on) { if (!b) return; if (on) lv_obj_clear_state(b, LV_STATE_DISABLED); else lv_obj_add_state(b, LV_STATE_DISABLED); };
    en(s_dPrev, pos > 0);
    en(s_dNext, pos >= 0 && pos + 1 < n);
  }
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
  if (s_dScroll) lv_obj_scroll_to_y(s_dScroll, 0, LV_ANIM_OFF);   // 새 일정은 맨 위부터
  show(s_pDetail, true);
  lv_obj_move_foreground(s_pDetail);
}
static void onDetailStep(lv_event_t *e) {   // 자세히 창의 [이전]·[다음]
  const int d = (int)(intptr_t)lv_event_get_user_data(e);
  static int idx[64]; const int n = schedSorted(idx, 64);
  int pos = -1; for (int k = 0; k < n; k++) if (idx[k] == s_detailIdx) pos = k;
  const int to = pos + d;
  if (pos < 0 || to < 0 || to >= n) return;
  showSchedDetail(idx[to]);
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
    if (j >= n) { showIf(s_sRow[k], false); continue; }
    JsonArray r = items[idx[j]];
    const String sd = r[0] | "", ed = r[1] | "";
    const bool today = sd <= td;
    showIf(s_sRow[k], true);
    lv_obj_set_user_data(s_sRow[k], (void *)(intptr_t)idx[j]);
    setTextIf(s_sRowT[k], today ? "오늘" : mdOf(sd).c_str());
    setBgIf(lv_obj_get_parent(s_sRowT[k]), today ? NOW_TAG : D_LINE);
    setTextColIf(s_sRowT[k], today ? NOW_TX : D_SUB);
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
static uint32_t s_syncStart = 0, s_lastSync = 0, s_wifiOnAt = 0;
static bool s_triedOnce = false, s_lastOk = false;
static int s_failCount = 0;   // 잇따라 실패한 횟수
static char s_lastHM[8] = "";
static volatile bool s_scanReq = false;
static const uint32_t SYNC_EVERY_MS = 3600UL * 1000;
static volatile int s_wifiReason = 0;
static bool s_retried = false;
static bool s_mealRetry = false;   // 오늘 급식만 못 받았으면 10분 뒤 한 번 더(하루 한 번)
static bool s_coreRetry = false;   // 시간 초과로 모드의 핵심 자료(교장: 학교 일정, 교사: 시간표)를 못 받음 → 10분 뒤 한 번 더
// 실패 종류(다음 받기 간격·안내 글):
//  FK_NOTFOUND: 시간표 주소에 파일이 없음(404·403) → 6시간 뒤 또는 [지금 받기]
//  FK_NET     : 와이파이·인터넷 실패 → 1·2·5·10분, 그 뒤로 10분마다
//  FK_PARTIAL : 시간표는 못 받았지만 시간·날씨·급식 중 일부는 받음 → 1시간 주기 유지
//  FK_AUTH    : 와이파이 비밀번호가 맞지 않음(이유 202 잇따라 2번, 15·204 잇따라 3번 — 신호가 약해도 나서) → 6시간 뒤
//               (아침 07:00~07:10 에 한 번 더) 또는 새 와이파이·[지금 받기]. 한 번이라도 붙은 비밀번호(prefs pwok)면 걸지 않는다
//  FK_NOAP    : 공유기를 찾지 못함(잇따라 2번) → FK_NET 과 같은 간격
enum FailKind { FK_NONE, FK_NOTFOUND, FK_NET, FK_PARTIAL, FK_AUTH, FK_NOAP };
static FailKind s_failKind = FK_NONE;
static int s_wifiFails = 0;          // 같은 이유(비밀번호·공유기 없음)로 잇따라 실패한 횟수
static int s_lastWifiKind = 0;       // 지난번 실패 이유 묶음(1: 202 · 3: 15·204 · 2: 201)
static bool s_pwOk = false;          // 저장한 비밀번호로 한 번이라도 붙었나(prefs "pwok")
static String s_authRetryDay;        // FK_AUTH 아침 재시도를 한 날
static bool s_renderPending = false; // 화면 불이 꺼진 동안 받은 자료 → 켤 때 그린다
static time_t s_wxAt = 0, s_airAt = 0, s_whrAt = 0;   // 날씨·미세먼지·선생님 위치를 마지막으로 받은 때(밤·주말 건너뛰기 판단)

// 받은 자료가 오래됐으면 글을 만들어 참을 돌려준다(잇따라 2번 실패 또는 마지막 성공이 6시간 넘음). 끝에 까닭 한 토막
static bool staleText(char *buf, size_t n) {
  if (s_failKind == FK_AUTH) { snprintf(buf, n, "와이파이 비밀번호를 확인하세요"); return true; }
  if (s_failKind == FK_NOAP) { snprintf(buf, n, "와이파이 공유기를 찾지 못했습니다"); return true; }
  if (!timeValid()) return false;
  const time_t now = time(nullptr);
  const char *why = s_pickMissing && !s_principal ? " · 시간표 다시 고르기" : s_failKind == FK_NOTFOUND ? " · 시간표 파일 없음"
                  : s_failKind == FK_NET ? " · 인터넷" : s_failKind == FK_PARTIAL ? " · 일부만 받음" : "";
  if (!s_lastOkT) { if (s_failCount >= 2) { snprintf(buf, n, "아직 자료를 받지 못했습니다%s", why); return true; } return false; }
  if (s_failCount < 2 && now - s_lastOkT < 6 * 3600) return false;
  struct tm tm; localtime_r(&s_lastOkT, &tm);
  snprintf(buf, n, "자료 갱신 안 됨 · %d/%d %02d:%02d%s", tm.tm_mon + 1, tm.tm_mday, tm.tm_hour, tm.tm_min, why);
  return true;
}
static void refreshStale() {   // 받기가 끝날 때·분이 바뀔 때만 부른다(lock 안에서)
  char b[128]; const bool st = staleText(b, sizeof b);
  lv_obj_t *l[] = {s_stale, s_pStale};
  for (lv_obj_t *x : l) {
    if (!x) continue;
    if (st) setTextIf(x, b);
    showIf(x, st);
  }
}
static bool quietNow() {   // 밤(22:00~07:00)·주말은 2시간마다만 받는다
  if (!timeValid()) return false;
  time_t t = time(nullptr); struct tm tm; localtime_r(&t, &tm);
  return tm.tm_wday == 0 || tm.tm_wday == 6 || tm.tm_hour < 7 || tm.tm_hour >= 22;
}
static bool inClassNow() {   // 수업 중(평일, 교시 시작 1분 전~끝)에는 받기를 쉬는 시간으로 미룬다(받을 때 화면이 잠깐 깜빡이므로)
  if (!timeValid() || s_offToday) return false;   // 주말·휴일은 수업이 없다
  time_t t = time(nullptr); struct tm tm; localtime_r(&t, &tm);
  if (tm.tm_wday == 0 || tm.tm_wday == 6) return false;
  const int nm = tm.tm_hour * 60 + tm.tm_min;
  for (int p = 0; p < 7; p++) { const int st = toMin(PERIOD_START[p]); if (nm >= st - 1 && nm < st + 50) return true; }
  return false;
}
static uint32_t syncWaitMs() {
  if (s_mealRetry || s_coreRetry) return 10 * 60000UL;
  if (s_triedOnce && !timeValid() && s_failKind != FK_AUTH && s_failKind != FK_NOAP) return 60000UL;   // 시각을 모르면 1분마다 다시
  if (s_lastOk || s_failKind == FK_PARTIAL) return quietNow() ? 2 * 3600UL * 1000 : SYNC_EVERY_MS;
  if (s_failKind == FK_AUTH && timeValid()) {   // 비밀번호 잠김이어도 아침(07:00~07:10)에 한 번은 다시 해 본다
    time_t t = time(nullptr); struct tm tm; localtime_r(&t, &tm);
    if (tm.tm_hour == 7 && tm.tm_min < 10 && s_authRetryDay != todayIso()) return 0;
  }
  if (s_failKind == FK_NOTFOUND || s_failKind == FK_AUTH) return 6 * 3600UL * 1000;   // 사람이 고쳐야 하는 실패
  static const uint32_t RETRY_MS[] = {60000, 120000, 300000, 600000};
  return RETRY_MS[s_failCount < 4 ? (s_failCount > 0 ? s_failCount - 1 : 0) : 3];
}
// 점검표 칸 하나: "O 08:12" / "아직" / 실패 이유 / "설정 없음"
static void okMark(int i, bool ok, const char *why = "실패") {
  if (ok) {
    s_okRes[i] = 1;
    if (timeValid()) { time_t t = time(nullptr); struct tm tm; localtime_r(&t, &tm); snprintf(s_okHM[i], sizeof s_okHM[i], "%02d:%02d", tm.tm_hour, tm.tm_min); }
  } else { s_okRes[i] = -1; s_okFail[i] = why; }
}
static String okCell(int i, bool cfg = true) {
  if (!cfg) return "설정 없음";
  if (s_okRes[i] < 0) return s_okFail[i] ? s_okFail[i] : "실패";
  if (s_okHM[i][0]) return String("O ") + s_okHM[i];
  return s_okRes[i] > 0 ? "O" : "아직";
}

static void setStatus(const char *s) { setTextIf(s_status, s); }
static void refreshWifiLabel() {
  String ssid = s_prefs.getString("ssid", "");
  if (!ssid.length()) {
    setTextIf(s_wifiLbl, LV_SYMBOL_WIFI " 없음");
    setTextColIf(s_wifiLbl, C_ROSE);
    setTextIf(s_wifiInfo, "저장한 와이파이가 없습니다. [찾기]를 누르고 고르세요.");
    return;
  }
  if (s_sync != SYNC_IDLE) {
    setTextIf(s_wifiLbl, LV_SYMBOL_REFRESH " 받는 중");
    setTextColIf(s_wifiLbl, C_WARN);
    setTextFmtIf(s_wifiInfo, "'%s'에 잠깐 연결해 받는 중입니다.", ssid.c_str());
    return;
  }
  char top[48]; uint32_t col = C_OK;
  if (!s_triedOnce) snprintf(top, sizeof top, LV_SYMBOL_WIFI " 대기");
  else if (s_failKind == FK_AUTH) { snprintf(top, sizeof top, "비밀번호 확인"); col = C_ROSE; }
  else if (s_failKind == FK_NOAP) { snprintf(top, sizeof top, "공유기 없음"); col = C_WARN; }
  else if (s_pickMissing && !s_principal) { snprintf(top, sizeof top, "시간표 다시 고르기"); col = C_WARN; }
  else if (s_lastOk) snprintf(top, sizeof top, LV_SYMBOL_WIFI " %s 받음", s_lastHM);
  else if (s_failKind == FK_NOTFOUND) { snprintf(top, sizeof top, "시간표 주소 확인"); col = C_WARN; }
  else if (s_failCount < 2) snprintf(top, sizeof top, LV_SYMBOL_WIFI " %s 대기", s_lastHM);
  else { snprintf(top, sizeof top, LV_SYMBOL_WIFI " %s 실패", s_lastHM); col = C_WARN; }
  setTextIf(s_wifiLbl, top);
  setTextColIf(s_wifiLbl, col);
  // 점검표: 문제(실패·아직·설정 없음)만 첫 줄에 모으고, 정상인 것은 '나머지 정상' 한 줄로. 와이파이 이름·배터리는 맨 뒤 줄
  char next[8] = "";
  if (s_triedOnce && timeValid()) {
    const uint32_t w = syncWaitMs(), gone = millis() - s_lastSync;
    time_t t = time(nullptr) + (time_t)((gone < w ? w - gone : 0) / 1000);
    struct tm tm; localtime_r(&t, &tm); snprintf(next, sizeof next, "%02d:%02d", tm.tm_hour, tm.tm_min);
  }
  struct Item { const char *name; String cell; bool bad; };
  auto item = [](const char *nm, int i, bool cfg) { Item it{nm, okCell(i, cfg), !cfg || s_okRes[i] < 0 || (s_triedOnce && s_okRes[i] == 0 && !s_okHM[i][0])}; return it; };
  Item its[8]; int ni = 0;
  its[ni++] = item("와이파이", OK_WIFI, true);
  if (!timeValid()) its[ni++] = item("시간", OK_TIME, true);
  if (s_principal) its[ni++] = item("학교 일정", OK_SCH, HAS_SCHED);
  else {
    Item t = item("시간표", OK_TT, true);
    if (urlUnset()) { t.cell = "주소 없음"; t.bad = true; } else if (s_pickMissing) { t.cell = "목록에 없음"; t.bad = true; }
    its[ni++] = t;
  }
  { Item w = item("선생님 위치", OK_WHR, true); if (urlUnset()) { w.cell = "주소 없음"; w.bad = true; } its[ni++] = w; }
  its[ni++] = item("날씨", OK_WX, WX_ON);
  if (!s_principal) its[ni++] = item("미세먼지", OK_AIR, WX_ON);
  its[ni++] = item("급식", OK_MEAL, MEAL_ON);
  String bad;
  for (int i = 0; i < ni; i++) if (its[i].bad) { if (bad.length()) bad += " · "; bad += String(its[i].name) + ": " + its[i].cell; }
  char ok2[64];
  if (!s_triedOnce) snprintf(ok2, sizeof ok2, "아직 받기 전입니다");
  else snprintf(ok2, sizeof ok2, "%s%s%s", bad.length() ? "나머지 정상" : "모두 정상", next[0] ? " · 다음 받기 " : "", next);
  char bat[24] = "";
  if (s_batPct >= 0) snprintf(bat, sizeof bat, " · 배터리 %d%%", s_batPct);
  static char info[400];
  if (bad.length()) snprintf(info, sizeof info, "%s\n%s · '%s'%s", bad.c_str(), ok2, ssid.c_str(), bat);
  else snprintf(info, sizeof info, "%s\n'%s' 저장됨%s", ok2, ssid.c_str(), bat);
  setTextIf(s_wifiInfo, info);
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
  s_sync = SYNC_CONNECTING;      // '받는 중' 글자를 박자를 낮추기 전에 그린다(느린 박자 동안 다시 그리지 않게)
  lock(); refreshWifiLabel(); setStatus("연결하는 중..."); unlock();
  lcdSlow(true);   // 받는 동안 화면 박자를 낮춘다
  WiFi.persistent(false);
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(false);
  s_wifiReason = 0; s_retried = false;
  s_coreRetry = false;                                       // 10분 뒤 한 번 더는 이번 받기로 다 썼다
  if (s_failKind == FK_AUTH && timeValid()) s_authRetryDay = todayIso();   // 아침 재시도는 하루 한 번
  wifiBegin();
  s_syncStart = s_wifiOnAt = millis();
  Serial.printf("sync: connecting %s (internal free %u, largest %u)\n", ssid.c_str(),
                (unsigned)heap_caps_get_free_size(MALLOC_CAP_INTERNAL), (unsigned)heap_caps_get_largest_free_block(MALLOC_CAP_INTERNAL));
}
static void finishSync(bool ok, const char *msg) {
  s_triedOnce = true; s_lastOk = ok; s_lastSync = millis();
  s_failCount = ok ? 0 : s_failCount + 1;
  if (ok) s_failKind = FK_NONE;
  if (timeValid()) { time_t t = time(nullptr); struct tm tm; localtime_r(&t, &tm); snprintf(s_lastHM, sizeof s_lastHM, "%02d:%02d", tm.tm_hour, tm.tm_min); }
  {   // 시간표는 받았는데 오늘 급식만 못 받았으면 10분 뒤 한 번 더(낮에만, 하루 한 번)
    static String retried;
    const String td = todayIso();
    s_mealRetry = ok && MEAL_ON && td.length() && s_mealDate != td && retried != td && !quietNow();
    if (s_mealRetry) retried = td;
  }
  if (ok && timeValid()) { s_lastOkT = time(nullptr); s_prefs.putULong("lastok", (uint32_t)s_lastOkT); }   // 성공할 때 한 번만 쓴다
  if (!ok) Serial.printf("sync fail #%d: %s\n", s_failCount, msg);
  Serial.printf("heap: internal free %u, largest %u, min %u, up %luh\n", (unsigned)heap_caps_get_free_size(MALLOC_CAP_INTERNAL),
                (unsigned)heap_caps_get_largest_free_block(MALLOC_CAP_INTERNAL), (unsigned)heap_caps_get_minimum_free_size(MALLOC_CAP_INTERNAL),
                (unsigned long)(millis() / 3600000UL));
  wifiOff();
  lcdSlow(false);  // 되돌리고 박자를 다시 맞춘다
  s_sync = SYNC_IDLE;
  Serial.printf("sync: %s (%lus) %s\n", ok ? "ok" : "fail", (unsigned long)((millis() - s_wifiOnAt) / 1000), msg);   // 와이파이가 켜져 있던 전체 시간
  lock(); refreshWifiLabel(); setStatus(msg); refreshStale(); unlock();
}
// 설정에서 와이파이를 고르면: 화면(LVGL) 작업에서는 값만 적고 깃발만 세운다. 저장·와이파이 끄기는 loop 가 받기와 부딪히지 않을 때 한다
// (전에는 loop 가 받는 중에 화면 쪽에서 와이파이를 꺼 버릴 수 있었다).
static volatile bool s_wifiApplyReq = false, s_forgetReq = false, s_rebootReq = false;
static String s_reqSsid, s_reqPw;
static void connectWifi(const String &ssid, const String &pw) {
  s_reqSsid = ssid; s_reqPw = pw;
  s_wifiApplyReq = true;
  s_wifiFails = 0;
  if (s_sync != SYNC_IDLE) setStatus("받기가 끝난 뒤 적용합니다");
}
static void closePw() { lv_obj_t *o[] = {s_pwBg, s_pwBox, s_kb}; for (lv_obj_t *x : o) if (x) show(x, false); }
static void pwCancel(lv_event_t *) {   // 비밀번호를 모르는 와이파이를 잘못 골랐을 때: 닫고 목록으로
  lv_textarea_set_text(s_pwTa, "");
  closePw();
  lv_label_set_text(s_wifiInfo, "취소했습니다. 목록에서 다른 와이파이를 고르세요.");
}
static void pwBgTap(lv_event_t *e) {   // 뒤 막을 스쳤을 때: 아직 아무것도 안 쳤을 때만 닫는다(친 글자가 날아가지 않게. 닫기는 [취소]·자판 닫기)
  if (!*lv_textarea_get_text(s_pwTa)) pwCancel(e);
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
static void onScan(lv_event_t *) {
  lv_obj_clean(s_wifiList);
  if (s_sync != SYNC_IDLE) { lv_list_add_text(s_wifiList, "받는 중입니다. 잠시 뒤 다시 누르세요"); return; }   // 받는 중에는 찾지 않는다
  s_scanReq = true; lv_list_add_text(s_wifiList, "찾는 중...");
}
// 실수로 누르지 않게: 3초 안에 한 번 더 눌러야 한다. 3초가 지나면 단추 글이 돌아온다(loop).
static uint32_t s_forgetArmed = 0, s_rebootArmed = 0;
static lv_obj_t *s_forgetBtn = nullptr, *s_rebootBtn = nullptr;
static const char *FORGET_TXT = "저장한 와이파이 지우기", *REBOOT_TXT = "다시 켜기";
// [기본 아이콘]: 컴퓨터에서 받은 단축키 그림·이름을 지우고 내장 16개로(받은 설정이 있을 때만 보인다)
static uint32_t s_deckResetArmed = 0;
static lv_obj_t *s_deckResetBtn = nullptr;
static volatile bool s_deckResetReq = false;   // loop(deckPoll)가 처리
static const char *DECKRESET_TXT = "기본 아이콘";
static void onDeckResetBtn(lv_event_t *e) {
  lv_obj_t *b = lv_event_get_current_target(e);
  if (!s_deckResetArmed || millis() - s_deckResetArmed > 3000) { s_deckResetArmed = millis(); lv_label_set_text(lv_obj_get_child(b, 0), "한 번 더"); return; }
  s_deckResetArmed = 0; lv_label_set_text(lv_obj_get_child(b, 0), DECKRESET_TXT);
  s_deckResetReq = true;
}
static void onForget(lv_event_t *e) {
  lv_obj_t *b = lv_event_get_current_target(e);
  if (!s_forgetArmed || millis() - s_forgetArmed > 3000) { s_forgetArmed = millis(); lv_label_set_text(lv_obj_get_child(b, 0), "한 번 더 누르면 지웁니다"); return; }
  s_forgetArmed = 0; lv_label_set_text(lv_obj_get_child(b, 0), FORGET_TXT);
  s_forgetReq = true;
  if (s_sync != SYNC_IDLE) setStatus("받기가 끝난 뒤 지웁니다");
}
static void onReboot(lv_event_t *e) {
  lv_obj_t *b = lv_event_get_current_target(e);
  if (!s_rebootArmed || millis() - s_rebootArmed > 3000) { s_rebootArmed = millis(); lv_label_set_text(lv_obj_get_child(b, 0), "한 번 더"); return; }
  s_rebootArmed = 0; lv_label_set_text(lv_obj_get_child(b, 0), "다시 켜는 중");
  s_rebootReq = true;
}
static void disarmButtons() {   // loop 에서: 3초 지난 '한 번 더' 글을 되돌린다
  if (s_forgetArmed && millis() - s_forgetArmed > 3000) { s_forgetArmed = 0; if (s_forgetBtn) lv_label_set_text(lv_obj_get_child(s_forgetBtn, 0), FORGET_TXT); }
  if (s_rebootArmed && millis() - s_rebootArmed > 3000) { s_rebootArmed = 0; if (s_rebootBtn) lv_label_set_text(lv_obj_get_child(s_rebootBtn, 0), REBOOT_TXT); }
  if (s_deckResetArmed && millis() - s_deckResetArmed > 3000) { s_deckResetArmed = 0; if (s_deckResetBtn) lv_label_set_text(lv_obj_get_child(s_deckResetBtn, 0), DECKRESET_TXT); }
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
      setTTFile((const char *)(it["file"] | ""));   // 다른 파일은 처음부터 받는다
    }
  }
  s_prefs.putString("ttname", s_pickName);
  s_principal = s_pickName.startsWith("@");
  s_pickMissing = false;
  lv_dropdown_set_text(s_ttPick, nullptr);   // '(목록에 없음)' 글을 지운다
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
static lv_obj_t *s_deckImg[16];           // 아이콘(도우미가 꺼져 있으면 흐리게)
static uint32_t s_deckSentAt = 0;         // 마지막으로 보내거나 답을 받은 때(60초 뒤 안내 글로 되돌린다)
static int s_deckWaitKey = -1;            // 보내고 답을 기다리는 단추(5초 안에 답이 없으면 알린다)
static uint32_t s_deckWaitAt = 0;
// ── 단축키 꾸미기(2026-10-26): 컴퓨터 도우미가 보낸 이름·아이콘을 /deck/ 에 두고 켤 때 읽는다(설계_단축키꾸미기.md 5장) ──
#define DECK_ICON_BYTES 15552                     // 72×72×3(RGB565 작은끝 + 알파)
static bool s_deckCustom = false;                 // 받은 설정을 쓰나(아니면 내장 16개)
static char s_deckHash[9] = "0";                  // /deck/cfg.json 의 CRC-32(없으면 "0")
static char s_deckName[16][40];                   // 칸 이름(UTF-8)
static const lv_img_dsc_t *s_deckIco[16];         // 칸 아이콘(받은 것 또는 내장)
static uint32_t s_deckCrc[16];                    // 받은 아이콘 crc(@deckls 답)
static bool s_deckCrcOk[16];                      // 그 칸이 받은 아이콘을 쓰나
static uint8_t *s_deckPix = nullptr;              // PSRAM 16×15552
static lv_img_dsc_t s_deckDsc[16];
static lv_obj_t *s_deckLbl[16];                   // 칸 이름표(받기 끝에 한 번 다시 쓴다)
static volatile bool s_deckUp = false;            // 컴퓨터에서 받는 중
static const lv_img_dsc_t *deckIcon(int i) { return s_deckCustom && s_deckIco[i] ? s_deckIco[i] : DECK[i].icon; }
static const char *deckName(int i) { return s_deckCustom ? s_deckName[i] : DECK[i].label; }
static bool deckBlank(int i) { return s_deckCustom && !s_deckName[i][0]; }   // 이름 없는 칸: 흐리게, 눌러도 안 보냄
static void deckCopyName(char *dst, const char *src) {   // 39바이트 안에서 글자 가운데를 자르지 않게
  size_t n = 0, i = 0;
  while (src[i]) {
    const uint8_t c = (uint8_t)src[i];
    const size_t k = c < 0x80 ? 1 : (c >> 5) == 6 ? 2 : (c >> 4) == 14 ? 3 : (c >> 3) == 30 ? 4 : 1;
    if (n + k > 39) break;
    for (size_t j = 0; j < k && src[i]; j++) dst[n++] = src[i++];
  }
  dst[n] = 0;
}
static void deckClean(bool onlyTmp) {   // /deck/ 안 임시(.tmp) 또는 전부 지우기
  static char paths[40][20]; int np = 0;
  File d = LittleFS.open("/deck");
  if (!d) return;
  if (d.isDirectory())
    for (File f = d.openNextFile(); f && np < 40; f = d.openNextFile()) {
      const char *nm = f.name(); const size_t L = strlen(nm);
      if (!onlyTmp || (L > 4 && !strcmp(nm + L - 4, ".tmp"))) snprintf(paths[np++], sizeof paths[0], "/deck/%s", nm);
      f.close();
    }
  d.close();
  for (int i = 0; i < np; i++) LittleFS.remove(paths[i]);
}
// 켤 때·받기 끝에: cfg.json 을 읽어 이름·아이콘을 PSRAM 에 올린다. 없거나 틀리면 내장 16개.
// 화면이 켜진 뒤에는 lock() 안에서 부른다(그리는 중인 그림을 덮어쓰므로).
static void deckLoad() {
  s_deckCustom = false; strcpy(s_deckHash, "0");
  for (int i = 0; i < 16; i++) { s_deckCrcOk[i] = false; s_deckCrc[i] = 0; s_deckIco[i] = DECK[i].icon; }
  File f = LittleFS.open("/deck/cfg.json", "r");
  if (!f) return;
  const size_t len = f.size();
  if (len == 0 || len > 4096) { f.close(); Serial.println("deck cfg bad (size)"); return; }
  char *raw = (char *)heap_caps_malloc(len + 1, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
  if (!raw) { f.close(); return; }
  const size_t got = f.read((uint8_t *)raw, len); f.close(); raw[got] = 0;
  const uint32_t hash = esp_rom_crc32_le(0, (const uint8_t *)raw, got);
  JsonDocument d(&s_alloc);
  const bool ok = got == len && !deserializeJson(d, (const char *)raw, got) && d["v"].as<int>() == 1 &&
                  d["n"].size() == 16 && d["ic"].size() == 16;
  heap_caps_free(raw);
  if (!ok) { Serial.println("deck cfg bad"); return; }
  if (!s_deckPix) s_deckPix = (uint8_t *)heap_caps_malloc(16 * DECK_ICON_BYTES, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
  for (int i = 0; i < 16; i++) {
    deckCopyName(s_deckName[i], d["n"][i] | "");
    const char *ic = d["ic"][i] | "";
    if (!strncmp(ic, "builtin:", 8)) {
      for (int k = 0; k < 16; k++) if (!strcmp(DECK[k].key, ic + 8)) s_deckIco[i] = DECK[k].icon;
    } else if (strlen(ic) == 8 && s_deckPix) {
      const uint32_t want = strtoul(ic, nullptr, 16);
      char p[16]; snprintf(p, sizeof p, "/deck/%d.bin", i);
      uint8_t *px = s_deckPix + i * DECK_ICON_BYTES;
      File b = LittleFS.open(p, "r");
      if (b && b.size() == DECK_ICON_BYTES && b.read(px, DECK_ICON_BYTES) == DECK_ICON_BYTES && esp_rom_crc32_le(0, px, DECK_ICON_BYTES) == want) {
        lv_img_dsc_t &ds = s_deckDsc[i];
        memset(&ds, 0, sizeof ds);
        ds.header.cf = LV_IMG_CF_TRUE_COLOR_ALPHA; ds.header.w = 72; ds.header.h = 72;
        ds.data_size = DECK_ICON_BYTES; ds.data = px;
        s_deckIco[i] = &ds; s_deckCrc[i] = want; s_deckCrcOk[i] = true;
      } else Serial.printf("deck icon %d missing\n", i);
      if (b) b.close();
    }
  }
  snprintf(s_deckHash, sizeof s_deckHash, "%08lx", (unsigned long)hash);
  s_deckCustom = true;
  Serial.printf("deck custom %s\n", s_deckHash);
}
// 도우미가 없을 때 단축키를 누르면 뜨는 안내 창(맨 위 층): 컴퓨터에서 짧은 주소로 도우미를 받아 설치하게 한다(2026-10-26).
// 바깥 덮개나 [닫기]를 누르면 닫히고, 도우미가 이어지면(deckPoll) 저절로 닫힌다. 주소는 사이트(firebase.json)의 /deck 과 같게.
#define DECK_HELP_URL "penedu.web.app/deck"
static lv_obj_t *s_deckHelp = nullptr;
static void closeDeckHelp() { if (s_deckHelp) { lv_obj_del_async(s_deckHelp); s_deckHelp = nullptr; } }   // 자기 이벤트 안에서도 지울 수 있게 async
static void showDeckHelp() {
  if (s_deckHelp) return;
  s_deckHelp = box(lv_layer_top(), 0x000000, 0, 0);
  lv_obj_set_style_bg_opa(s_deckHelp, LV_OPA_70, 0);
  lv_obj_set_size(s_deckHelp, W, H); lv_obj_set_pos(s_deckHelp, 0, 0);
  lv_obj_add_flag(s_deckHelp, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_add_event_cb(s_deckHelp, [](lv_event_t *) { closeDeckHelp(); }, LV_EVENT_CLICKED, nullptr);
  const int CW = W - 24, TW = CW - 36;
  lv_obj_t *card = box(s_deckHelp, D_PANEL, D_SUB, 14);
  lv_obj_set_size(card, CW, LV_SIZE_CONTENT); lv_obj_center(card);
  lv_obj_add_flag(card, LV_OBJ_FLAG_CLICKABLE);                 // 카드를 눌러도 닫히지 않게(바깥 덮개만 닫는다)
  lv_obj_set_flex_flow(card, LV_FLEX_FLOW_COLUMN);
  lv_obj_set_style_pad_all(card, 18, 0); lv_obj_set_style_pad_row(card, 7, 0);
  auto line = [&](const lv_font_t *f, uint32_t col, const char *t) {
    lv_obj_t *l = label(card, f, col, t);
    lv_obj_set_width(l, TW); lv_label_set_long_mode(l, LV_LABEL_LONG_WRAP);
    return l;
  };
  line(&kr20, D_TEXT, "컴퓨터에 탭덱이 필요해요");
  line(&kr14, D_SUB, "단축키로 컴퓨터 프로그램을 열려면, 이 보드를 꽂은 컴퓨터에 작은 프로그램 '탭덱'을 한 번 깔아야 해요.");
  line(&kr16, D_TEXT, "1. 컴퓨터 인터넷 창의 주소 칸에 이 주소를 쳐요");
  lv_obj_t *url = box(card, D_ROW, D_LINE, 10);
  lv_obj_set_size(url, TW, LV_SIZE_CONTENT); lv_obj_set_style_pad_ver(url, 8, 0);
  lv_obj_t *ul = label(url, &kr20, C_DUTY, DECK_HELP_URL); lv_obj_center(ul);
  line(&kr16, D_TEXT, "2. [탭덱 받기]를 누르고, 받은 파일을 더블클릭해요");
  line(&kr16, D_TEXT, "3. 컴퓨터 화면 오른쪽 아래 아이콘이 초록이 되면 다시 눌러요");
  line(&kr14, C_DUTY, "이미 깔았는데 안 되면: 컴퓨터 시작 메뉴에서 '탭덱'을 눌러 켜요.");
  line(&kr14, D_MUTED, "깔았는데도 안 되면: 이 보드가 USB-C 단자로 컴퓨터에 꽂혀 있는지 보세요(데이터 케이블).");
  lv_obj_t *cb = button(card, "닫기", 100, 40, D_ROW, D_TEXT);
  lv_obj_add_event_cb(cb, [](lv_event_t *) { closeDeckHelp(); }, LV_EVENT_CLICKED, nullptr);
}
static void deckStateText() {
  if (!s_deckState || s_deckUp) return;   // 받는 중에는 진행 글을 그대로 둔다
  setTextIf(s_deckState, s_usbOn ? LV_SYMBOL_OK "  컴퓨터와 연결됨 · 단추를 누르면 컴퓨터에서 프로그램이 열립니다"
                                 : LV_SYMBOL_WARNING "  컴퓨터의 탭덱을 기다리는 중 · 처음이면 컴퓨터에서 " DECK_HELP_URL " 로 받아요");
  setTextColIf(s_deckState, s_usbOn ? C_OK : D_MUTED);   // 기다리는 것은 문제가 아니다(노랑은 '지금'·문제에만)
}
static void deckIconsDim() {   // 도우미가 꺼져 있으면 아이콘을 흐리게(누를 수 없다는 뜻)
  for (int i = 0; i < 16; i++) if (s_deckImg[i]) lv_obj_set_style_img_opa(s_deckImg[i], deckBlank(i) ? LV_OPA_20 : s_usbOn ? LV_OPA_COVER : LV_OPA_50, 0);
}
static void deckSay(uint32_t col, const char *fmt, ...) {   // 상태 글 한 줄(색과 함께)
  if (!s_deckState) return;
  static char b[200]; va_list ap; va_start(ap, fmt); vsnprintf(b, sizeof b, fmt, ap); va_end(ap);
  setTextIf(s_deckState, b); setTextColIf(s_deckState, col);
}
// [새로 고침] 단추(단축키 판 오른쪽 아래): 컴퓨터에 '@pc?' 를 보내 도우미가 살아 있는지 바로 확인한다(2026-10-26).
// 6초 안에 '@pc on' 이 새로 오면 연결됨(새 도우미는 바로, 예전 도우미도 5초마다 보낸다), 안 오면 도우미가 꺼진 것 → 안내 창.
static uint32_t s_deckPingAt = 0;   // 누른 때(0 = 기다리지 않음). 판정은 deckPoll 에서
static void onDeckRefresh(lv_event_t *) {
  s_deckPingAt = millis() ? millis() : 1;
  Serial.printf("\n@pc?\n");
  deckSay(D_SUB, LV_SYMBOL_REFRESH "  컴퓨터의 탭덱을 찾는 중...");
}
static void onDeck(lv_event_t *e) {
  const int i = (int)(intptr_t)lv_event_get_user_data(e);
  if (i < 0 || i >= 16 || deckBlank(i)) return;
  if (s_deckUp) { deckSay(C_WARN, LV_SYMBOL_REFRESH "  받는 중입니다 · 잠시 뒤 누르세요"); return; }
  if (!s_usbOn) {
    showDeckHelp();
    deckSay(NOW_TAG, LV_SYMBOL_WARNING "  컴퓨터의 탭덱과 연결되지 않았습니다 · USB 선과 컴퓨터의 탭덱을 확인하세요");
    s_deckSentAt = millis();                            // 1분 뒤 안내 글로 돌아간다
    return;
  }
  static uint32_t lastMs = 0; static int lastI = -1;
  if (i == lastI && millis() - lastMs < 2000) {         // 2초 안에 같은 단추를 또 누르면 보내지 않는다(창이 두 개 열리지 않게) — 대신 알린다
    deckSay(C_WARN, "'%s' 이미 보냈습니다 · 잠시 기다리세요", deckName(i));
    return;
  }
  lastI = i; lastMs = millis();
  if (s_deckCustom) Serial.printf("\n@deck s%d\n", i);   // 받은 설정: 칸 번호(무엇을 여는지는 컴퓨터가 안다)
  else Serial.printf("\n@deck %s\n", DECK[i].key);         // 앞의 줄바꿈: 다른 기록 줄과 섞이지 않게
  deckSay(C_OK, "'%s' 보냈습니다 · 여는 중", deckName(i));
  s_deckSentAt = millis();
  s_deckWaitKey = i; s_deckWaitAt = millis();
}
static const char *deckLabel(const char *key) {
  if (key[0] == 's' && isdigit((unsigned char)key[1])) { const int i = atoi(key + 1); if (i >= 0 && i < 16) return deckName(i); }
  for (int i = 0; i < 16; i++) if (!strcmp(DECK[i].key, key)) return DECK[i].label;
  return key;
}
// 화면 찍기(7인치 tools/screenshot.py 와 같은 형식): '@shot' 을 받으면 지금 화면(프레임 버퍼, RGB565)을
// [개수 1~255][값 작은끝 2바이트] 묶음으로 보내고 개수 0 으로 끝낸다. 보내는 동안 화면 그리기를 잠가 찍는 사이 바뀌지 않게 한다.
// 180도로 돌려 쓰면 프레임 버퍼도 돌아가 있다(7인치와 같다 → screenshot.py 가 바로 세운다). 머리 줄 끝 r180/r0 은 참고용.
static bool usbWriteAll(const uint8_t *p, size_t n) {   // 칩 내장 USB 는 컴퓨터가 늦게 읽으면 덜 보낼 수 있다 → 다 갈 때까지
  uint32_t t0 = millis();
  while (n) {
    const size_t w = Serial.write(p, n);
    if (w) { p += w; n -= w; t0 = millis(); }
    else { if (millis() - t0 > 3000) return false; delay(1); }
  }
  return true;
}
static void screenShot() {
  void *fb = nullptr;
  if (!s_panel || esp_lcd_rgb_panel_get_frame_buffer(s_panel, 1, &fb) != ESP_OK || !fb) { Serial.println("@shot fail"); return; }
  lock();
#if defined(ARDUINO_USB_CDC_ON_BOOT) && ARDUINO_USB_CDC_ON_BOOT
  Serial.setTxTimeoutMs(500);   // 찍는 동안만 길게(평소 20ms 는 컴퓨터가 늦으면 버린다)
#endif
  const uint16_t *px = (const uint16_t *)fb; const uint32_t n = (uint32_t)W * H;
  Serial.printf("\n@shot %d %d %s\n", W, H, BOARD_ROTATE_180 ? "r180" : "r0"); Serial.flush();
  static uint8_t out[3 * 256]; int o = 0; bool ok = true;
  for (uint32_t i = 0; i < n && ok; ) {
    const uint16_t v = px[i]; uint32_t j = i + 1;
    while (j < n && px[j] == v && j - i < 255) j++;
    out[o++] = (uint8_t)(j - i); out[o++] = v & 0xff; out[o++] = v >> 8;
    if (o >= (int)sizeof out - 3) { ok = usbWriteAll(out, o); o = 0; }
    i = j;
  }
  out[o++] = 0; if (ok) ok = usbWriteAll(out, o);
  Serial.flush();
#if defined(ARDUINO_USB_CDC_ON_BOOT) && ARDUINO_USB_CDC_ON_BOOT
  Serial.setTxTimeoutMs(20);
#endif
  unlock();
  Serial.println(ok ? "\n@shot end" : "\n@shot fail");
}
// ── 단축키 받기(lock-step): 한 줄 받으면 답 한 줄. 줄 약속은 설계_단축키꾸미기.md 2-3 ──
static File s_deckUpFile;
static uint32_t s_deckUpAt = 0, s_deckUpWant = 0, s_deckUpWantCrc = 0, s_deckUpLen = 0, s_deckUpCrc = 0;
static int s_deckUpItem = -1, s_deckUpSeq = 0, s_deckUpN = 0, s_deckUpDone = 0;
static bool s_deckUpGotCfg = false;
static void deckTmpPath(char *p, size_t n, int item, bool tmp) {
  if (item == 16) snprintf(p, n, tmp ? "/deck/cfg.tmp" : "/deck/cfg.json");
  else snprintf(p, n, tmp ? "/deck/%d.tmp" : "/deck/%d.bin", item);
}
static int deckSlot(const char *t) {   // "c" = cfg(16), "0"~"15"
  if (!strcmp(t, "c")) return 16;
  if (!isdigit((unsigned char)t[0])) return -1;
  const int v = atoi(t); return v >= 0 && v <= 15 ? v : -1;
}
static void deckUpStop() {   // 받기 끝내기(임시 파일 지움)
  if (s_deckUpFile) s_deckUpFile.close();
  deckClean(true);
  s_deckUp = false; s_deckUpItem = -1;
}
static void deckRedraw() {   // 16칸을 한 번 다시 그린다(받기 끝·되돌리기). lock() 안에서
  lv_img_cache_invalidate_src(NULL);
  for (int i = 0; i < 16; i++) {
    if (s_deckImg[i]) { lv_img_set_src(s_deckImg[i], deckIcon(i)); lv_obj_invalidate(s_deckImg[i]); }
    if (s_deckLbl[i]) lv_label_set_text(s_deckLbl[i], deckName(i));
  }
  deckIconsDim();
  if (s_deckResetBtn) show(s_deckResetBtn, s_deckCustom);
}
static void deckDoReset(uint32_t ms) {   // '@deckreset' · 설정 장 [기본 아이콘]
  if (s_deckUp) deckUpStop();
  deckClean(false);
  lock(); deckLoad(); deckRedraw(); deckSay(C_OK, LV_SYMBOL_OK "  기본 아이콘으로 되돌렸습니다"); unlock();
  s_deckSentAt = ms ? ms : 1;
  Serial.println("deck reset");
}
static void deckProgress() {   // 안내 줄: '아이콘 받는 중 3/16' (칸마다 한 번)
  lock();
  if (s_deckUpItem == 16) deckSay(D_SUB, LV_SYMBOL_REFRESH "  설정 받는 중");
  else deckSay(D_SUB, LV_SYMBOL_REFRESH "  아이콘 받는 중 %d/%d", s_deckUpItem < 0 ? s_deckUpDone : s_deckUpDone + 1, s_deckUpN);
  unlock();
}
static bool deckUpLine(char *buf, uint32_t ms) {   // 받기 줄이면 처리하고 true
  if (strncmp(buf, "@deck", 5) || buf[5] == ' ' || !strcmp(buf, "@deckhelp")) return false;
  s_pcLast = ms ? ms : 1; s_usbSeen = true;   // 도우미가 살아 있다
  s_deckUpAt = ms;
  if (!strcmp(buf, "@deckls")) {
    static char out[200]; int o = snprintf(out, sizeof out, "\n@deckls %s", s_deckHash);
    for (int i = 0; i < 16; i++) o += s_deckCrcOk[i] ? snprintf(out + o, sizeof out - o, " %08lx", (unsigned long)s_deckCrc[i]) : snprintf(out + o, sizeof out - o, " -");
    Serial.printf("%s\n", out);
  } else if (!strncmp(buf, "@deckbegin ", 11)) {
    char h[12] = ""; int cnt = -1;
    sscanf(buf + 11, "%10s %d", h, &cnt);
    if (s_sync != SYNC_IDLE) { Serial.printf("\n@deckbusy\n"); return true; }
    if (cnt < 0 || cnt > 16) { Serial.printf("\n@deckbegin fail count\n"); return true; }
    if (s_deckUp) deckUpStop(); else deckClean(true);
    if (!LittleFS.exists("/deck")) LittleFS.mkdir("/deck");
    s_deckUp = true; s_deckUpN = cnt; s_deckUpDone = 0; s_deckUpGotCfg = false; s_deckUpItem = -1; s_deckWaitKey = -1;
    deckProgress();
    Serial.printf("deck upload begin %s %d\n@deckbegin ok\n", h, cnt);
  } else if (!strncmp(buf, "@deckitem end ", 14)) {
    const char *t = buf + 14; const int slot = deckSlot(t);
    if (!s_deckUp || slot < 0 || slot != s_deckUpItem) { Serial.printf("\n@deckitem bad %s item\n", t); return true; }
    if (s_deckUpFile) s_deckUpFile.close();
    char tp[20], fp[20]; deckTmpPath(tp, sizeof tp, slot, true); deckTmpPath(fp, sizeof fp, slot, false);
    s_deckUpItem = -1;
    if (s_deckUpLen != s_deckUpWant || s_deckUpCrc != s_deckUpWantCrc) { LittleFS.remove(tp); Serial.printf("\n@deckitem bad %s %s\n", t, s_deckUpLen != s_deckUpWant ? "len" : "crc"); return true; }
    if (LittleFS.exists(fp)) LittleFS.remove(fp);
    if (!LittleFS.rename(tp, fp)) { LittleFS.remove(tp); Serial.printf("\n@deckitem bad %s rename\n", t); return true; }
    if (slot == 16) s_deckUpGotCfg = true; else s_deckUpDone++;
    Serial.printf("\n@deckitem done %s\n", t);
  } else if (!strncmp(buf, "@deckitem ", 10)) {
    char t[8] = ""; unsigned long len = 0, crc = 0;
    sscanf(buf + 10, "%7s %lu %lx", t, &len, &crc);
    const int slot = deckSlot(t);
    if (!s_deckUp) { Serial.printf("\n@deckitem fail %s state\n", t); return true; }
    if (slot < 0) { Serial.printf("\n@deckitem fail %s slot\n", t); return true; }
    if ((slot < 16 && len != DECK_ICON_BYTES) || (slot == 16 && (len == 0 || len > 4096))) { Serial.printf("\n@deckitem fail %s size\n", t); return true; }
    if (s_deckUpFile) s_deckUpFile.close();
    char tp[20]; deckTmpPath(tp, sizeof tp, slot, true);
    s_deckUpFile = LittleFS.open(tp, "w");
    if (!s_deckUpFile) { s_deckUpItem = -1; Serial.printf("\n@deckitem fail %s open\n", t); return true; }
    s_deckUpItem = slot; s_deckUpWant = len; s_deckUpWantCrc = crc; s_deckUpLen = 0; s_deckUpCrc = 0; s_deckUpSeq = 0;
    deckProgress();
    Serial.printf("\n@deckitem ok %s\n", t);
  } else if (!strncmp(buf, "@deckdata ", 10)) {
    char *t = buf + 10, *sp = strchr(t, ' ');
    if (!sp) return true;
    *sp = 0; char *q = sp + 1, *sp2 = strchr(q, ' ');
    if (!sp2) { Serial.printf("\n@deckdata err %s 0 form\n", t); return true; }
    *sp2 = 0; const int seq = atoi(q); char *b64 = sp2 + 1;
    size_t bl = strlen(b64); while (bl && (b64[bl - 1] == ' ' || b64[bl - 1] == '\t')) b64[--bl] = 0;
    const int slot = deckSlot(t);
    if (!s_deckUp || slot < 0 || slot != s_deckUpItem || !s_deckUpFile) { Serial.printf("\n@deckdata err %s %d item\n", t, seq); return true; }
    if (seq == s_deckUpSeq - 1) { Serial.printf("\n@deckdata ok %s %d\n", t, seq); return true; }   // 같은 조각이 또 옴: 쓰지 않고 답만
    if (seq != s_deckUpSeq) { Serial.printf("\n@deckdata err %s %d seq\n", t, seq); return true; }
    static uint8_t dec[256]; size_t ol = 0;
    if (mbedtls_base64_decode(dec, sizeof dec, &ol, (const uint8_t *)b64, bl) != 0 || ol == 0) { Serial.printf("\n@deckdata err %s %d b64\n", t, seq); return true; }
    if (s_deckUpLen + ol > s_deckUpWant) { Serial.printf("\n@deckdata err %s %d size\n", t, seq); return true; }
    if (s_deckUpFile.write(dec, ol) != ol) { Serial.printf("\n@deckdata err %s %d write\n", t, seq); return true; }
    s_deckUpCrc = esp_rom_crc32_le(s_deckUpCrc, dec, ol); s_deckUpLen += ol; s_deckUpSeq++;
    Serial.printf("\n@deckdata ok %s %d\n", t, seq);
  } else if (!strcmp(buf, "@deckend")) {
    if (!s_deckUp) { Serial.printf("\n@deckend fail state\n"); return true; }
    const bool gotCfg = s_deckUpGotCfg;
    deckUpStop();
    if (!gotCfg) { lock(); deckStateText(); unlock(); Serial.printf("\n@deckend fail nocfg\n"); return true; }
    lock();
    deckLoad(); deckRedraw();   // 화면은 여기서 한 번만 다시 그린다
    if (s_deckCustom) deckSay(C_OK, LV_SYMBOL_OK "  새 단축키를 받았습니다");
    else deckSay(NOW_TAG, LV_SYMBOL_WARNING "  받은 설정을 읽지 못했습니다 · 탭덱이 다시 보냅니다");
    unlock();
    s_deckSentAt = ms ? ms : 1;
    if (s_deckCustom) Serial.printf("\n@deckend ok %s\n", s_deckHash); else Serial.printf("\n@deckend fail cfg\n");
  } else if (!strcmp(buf, "@deckabort")) {
    deckUpStop();
    lock(); deckStateText(); unlock();
    Serial.printf("\n@deckabort ok\n");
  } else if (!strcmp(buf, "@deckreset")) {
    deckDoReset(ms);
    Serial.printf("\n@deckreset ok\n");
  } else return false;
  return true;
}
// USB 로 들어온 줄 읽기(loop 에서). '@pc on' 이면 컴퓨터가 켜져 있다. '@deck ok 키' / '@deck fail 키' 는 도우미의 답.
// '@shot' 화면 찍기 · '@view 장번호'(0 시계 ~ 5 설정) 장 바꾸기 · '@theme N'(0~4) 화면 색 바꾸기
static void deckPoll(uint32_t ms) {
  static char buf[320]; static uint16_t n = 0;   // 가장 긴 줄: @deckdata + base64 256자
  while (Serial.available()) {
    const char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      buf[n] = 0;
      if (!strcmp(buf, "@pc on")) { s_pcLast = ms ? ms : 1; s_usbSeen = true; Serial.printf("@board ok\n@board ok deck=%s\n", s_deckHash); }   // 두 줄을 한 번에(첫 줄은 옛 도우미용)
      else if (deckUpLine(buf, ms)) {}
      else if (!strcmp(buf, "@shot")) screenShot();
      else if (!strcmp(buf, "@deckhelp")) { lock(); showDeckHelp(); lv_disp_trig_activity(NULL); unlock(); }   // 도우미 안내 창 미리 보기(화면 찍기 시험용)
      else if (!strncmp(buf, "@view ", 6)) { const int v = atoi(buf + 6); if (v >= 0 && v < P_COUNT) { lock(); goPage(v); lv_disp_trig_activity(NULL); unlock(); Serial.printf("@view ok %d\n", v); } }
      else if (!strncmp(buf, "@theme ", 7)) {
        const int t = atoi(buf + 7);
        if (t >= 0 && t < THEME_N) { s_prefs.putInt("theme", t); s_themeIdx = t; s_themeReqAt = ms ? ms : 1; Serial.printf("@theme ok %d\n", t); }
      }
      else if (!strncmp(buf, "@deck ok ", 9)) {
        s_deckWaitKey = -1;
        lock(); deckSay(C_OK, LV_SYMBOL_OK "  '%s' 열었습니다", deckLabel(buf + 9)); unlock();
        s_deckSentAt = ms ? ms : 1;
      } else if (!strncmp(buf, "@deck fail ", 11)) {
        s_deckWaitKey = -1;
        lock(); deckSay(NOW_TAG, LV_SYMBOL_WARNING "  '%s' 열지 못했습니다 · 컴퓨터의 탭덱 설정을 확인하세요", deckLabel(buf + 11)); unlock();
        s_deckSentAt = ms ? ms : 1;
      }
      n = 0;
    } else if (n < sizeof buf - 1) buf[n++] = c;
    else n = 0;
  }
  if (s_deckPingAt) {                                    // [새로 고침] 판정
    if (s_pcLast && (int32_t)(s_pcLast - s_deckPingAt) >= 0) {   // 누른 뒤에 답이 왔다
      s_deckPingAt = 0;
      s_usbOn = true;
      lock(); deckStateText(); deckIconsDim(); unlock();
    } else if (ms - s_deckPingAt > 6000) {               // 답이 없다 → 도우미가 꺼졌다고 보고 안내 창
      s_deckPingAt = 0; s_pcLast = 0;
      s_usbOn = false;
      lock(); deckStateText(); deckIconsDim(); showDeckHelp(); unlock();
    }
  }
  if (s_deckUp && ms - s_deckUpAt > 30000) {           // 30초 동안 받기 줄이 없다 → 스스로 멈춤
    deckUpStop();
    lock(); deckSay(NOW_TAG, LV_SYMBOL_WARNING "  받기를 멈췄습니다 · 탭덱이 다시 보냅니다"); unlock();
    s_deckSentAt = ms ? ms : 1;
    Serial.println("deck upload timeout");
  }
  if (s_deckResetReq) { s_deckResetReq = false; deckDoReset(ms); }
  s_usbOn = s_pcLast && ms - s_pcLast < 15000;
  if (s_usbOn && s_deckHelp) { lock(); closeDeckHelp(); unlock(); }   // 도우미를 깔아 이어졌으면 안내 창을 닫는다
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
  if (p < 0 || p >= P_COUNT) return;
  lv_obj_set_tile_id(s_tv, p, 0, LV_ANIM_OFF);
  onTile(nullptr);                            // 장이 바뀔 때 할 일(점·찾기·설정·단축키·교장 목록)을 한곳에서
}
// 쓸어 넘기기 대신 누르기(사용자 요청 2026-10-26): 화면 왼쪽 1/4 을 누르면 이전 장, 오른쪽 1/4 은 다음 장. 가운데·단추는 그대로.
// 판(box)은 누르기를 받지 않으므로 빈 곳을 누르면 장(tile)이 받는다. 좌표는 터치에서 이미 180도 돌려 놓은 화면 좌표다.
static void onTileTap(lv_event_t *) {
  lv_point_t pt; lv_indev_t *in = lv_indev_get_act();
  if (!in) return;
  lv_indev_get_point(in, &pt);
  if (pt.x < W / 4) goPage(s_page - 1);
  else if (pt.x >= W * 3 / 4) goPage(s_page + 1);
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
  s_stale = label(p, &kr14, C_WARN, "");   // 맨 위 왼쪽: '자료 갱신 안 됨 · M/D HH:MM · 까닭'(받기가 계속 실패할 때만)
  lv_obj_set_width(s_stale, CW - 120); lv_label_set_long_mode(s_stale, LV_LABEL_LONG_DOT); lv_obj_set_pos(s_stale, P, 3); show(s_stale, false);
  s_bat = label(p, &kr14, D_MUTED, "");      // 맨 위 오른쪽: 배터리(읽을 수 있을 때만)
  lv_obj_align(s_bat, LV_ALIGN_TOP_RIGHT, -12, 3); show(s_bat, false);
  s_bigDate = label(p, &kr20, D_SUB, "");
  lv_obj_set_pos(s_bigDate, P, 118);
  s_dday = label(p, &kr14, C_DUTY, "");    // 수능·시험 D-day. 짙은 빨강은 '문제 있음'으로 읽혀서 호박색 테두리로
  lv_obj_set_style_bg_opa(s_dday, LV_OPA_COVER, 0);
  lv_obj_set_style_bg_color(s_dday, lv_color_hex(D_ROW), 0);
  lv_obj_set_style_border_width(s_dday, 1, 0);
  lv_obj_set_style_border_color(s_dday, lv_color_hex(NOW_TAG), 0);
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

  // 지금 / 다음 띠: 어두운 칸 + 호박색 테두리('지금' 표지 = 호박색, '다음' 표지 = 회색, 10분 전부터 노랑)
  s_band = box(p, D_ROW, NOW_TAG, 10);
  lv_obj_set_style_border_width(s_band, 2, 0);
  lv_obj_set_size(s_band, CW, 66); lv_obj_set_pos(s_band, P, 258);
  auto tag = [&](const char *txt, int y, uint32_t bg, uint32_t fg) {
    lv_obj_t *t = box(s_band, bg, 0, 6);
    lv_obj_set_size(t, 40, 22); lv_obj_set_pos(t, 8, y);
    lv_obj_center(label(t, &kr14, fg, txt));
    return t;
  };
  auto line = [&](int y) {
    lv_obj_t *l = label(s_band, &kr16, D_SUB, "");
    lv_label_set_recolor(l, true);
    lv_obj_set_width(l, CW - 68); lv_label_set_long_mode(l, LV_LABEL_LONG_DOT);
    lv_obj_set_pos(l, 56, y + 1);
    return l;
  };
  s_nowTag = tag("지금", 5, NOW_TAG, NOW_TX); s_nowLbl = line(5);
  s_bandSep = box(s_band, D_LINE, 0, 0);
  lv_obj_set_size(s_bandSep, CW - 20, 1); lv_obj_set_pos(s_bandSep, 8, 33);
  s_nextTag = tag("다음", 37, D_LINE, D_SUB); s_nextLbl = line(37);

  // 할 일 + 점심/저녁
  s_info = box(p, D_ROW, D_LINE, 12);
  lv_obj_set_pos(label(s_info, &kr14, D_MUTED, "할 일"), 12, 10);
  s_duty = label(s_info, &kr14, C_DUTY, "");
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
  lv_obj_set_style_max_width(s_dayTitle, 290, 0); lv_label_set_long_mode(s_dayTitle, LV_LABEL_LONG_DOT);   // 꼬리표·오른쪽 시계와 겹치지 않게
  s_dayTag = label(p, &kr14, C_TEXT, "");
  lv_obj_set_style_bg_opa(s_dayTag, LV_OPA_COVER, 0);
  lv_obj_set_style_bg_color(s_dayTag, lv_color_hex(NOW_ROW), 0);
  lv_obj_set_style_border_color(s_dayTag, lv_color_hex(NOW_TAG), 0);   // 시험 꼬리표만 테두리(두께는 renderToday)
  lv_obj_set_style_border_width(s_dayTag, 0, 0);
  lv_obj_set_style_max_width(s_dayTag, 90, 0); lv_label_set_long_mode(s_dayTag, LV_LABEL_LONG_DOT);
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
    lv_obj_set_style_bg_color(s_rowTag[r], lv_color_hex(TAG_BG), 0);   // 보강·지도 꼬리표(빨강은 경고에만)
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
  lv_obj_t *nowBox = box(s_findDetail, NOW_ROW, 0, 12);   // '지금' = 밝은 크림 칸(오늘 장의 지금 교시 줄과 같은 뜻. 빨강은 경고에만)
  lv_obj_set_size(nowBox, PW - 26, 62); lv_obj_set_pos(nowBox, 12, 50);
  s_findNowT = label(nowBox, &kr14, C_MUTED, "");
  lv_obj_set_pos(s_findNowT, 14, 8);
  s_findNow = label(nowBox, &kr20, C_TEXT, "");
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
// 화면 색: 고른 테마 단추는 굵은 밝은 테두리. 누르면 저장하고 잠시 뒤 loop 가 화면을 새 색으로 다시 만든다(다시 켜지 않는다)
static lv_obj_t *s_themeBtn[5];
static void refreshThemeButtons() {
  for (int i = 0; i < THEME_N; i++) {
    if (!s_themeBtn[i]) continue;
    const bool on = i == s_themeIdx;
    lv_obj_set_style_border_width(s_themeBtn[i], on ? 3 : 1, 0);
    lv_obj_set_style_border_color(s_themeBtn[i], lv_color_hex(on ? D_TEXT : D_LINE), 0);
  }
}
static void onThemePick(lv_event_t *e) {
  const int i = (int)(intptr_t)lv_event_get_user_data(e);
  if (i == s_themeIdx || s_themeReqAt) return;
  s_themeIdx = i;
  s_prefs.putInt("theme", i);
  refreshThemeButtons();
  setStatus("색을 바꾸는 중...");
  s_themeReqAt = millis() ? millis() : 1;   // 단추의 눌림 처리 안에서 화면을 지우지 않게 loop 에 맡긴다
}
// 설정 장(460×446): 와이파이(점검표·목록·지우기·다시 켜기) · 볼 시간표 · 지금 받기 · 화면 색 · 상태 · 버전
static void buildSettings() {
  lv_obj_t *p = panel(P_SET);
  lv_obj_set_pos(label(p, &kr20, D_TEXT, "와이파이"), 14, 12);
  s_wifiLbl = label(p, &kr14, D_MUTED, "");
  lv_obj_set_width(s_wifiLbl, PW - 104 - 100); lv_label_set_long_mode(s_wifiLbl, LV_LABEL_LONG_DOT);
  lv_obj_set_pos(s_wifiLbl, 104, 16);
  lv_obj_t *bScan = mainButton(p, "찾기", 80, 32);
  lv_obj_align(bScan, LV_ALIGN_TOP_RIGHT, -10, 8);
  lv_obj_add_event_cb(bScan, onScan, LV_EVENT_CLICKED, nullptr);
  s_wifiInfo = label(p, &kr14, D_SUB, "");   // 점검표(문제 먼저) 3줄까지
  lv_obj_set_size(s_wifiInfo, PW - 28, 52); lv_label_set_long_mode(s_wifiInfo, LV_LABEL_LONG_DOT);
  lv_obj_set_pos(s_wifiInfo, 14, 46);
  s_wifiList = lv_list_create(p);
  lv_obj_set_size(s_wifiList, PW - 24, 92); lv_obj_set_pos(s_wifiList, 12, 102);
  lv_obj_set_style_text_font(s_wifiList, &kr14, 0);
  lv_obj_set_style_bg_color(s_wifiList, lv_color_hex(D_ROW), 0);
  lv_obj_set_style_border_color(s_wifiList, lv_color_hex(D_LINE), 0);
  lv_obj_t *bForget = s_forgetBtn = button(p, FORGET_TXT, 196, 30, D_ROW, D_MUTED);
  lv_obj_set_pos(bForget, 12, 200);
  lv_obj_add_event_cb(bForget, onForget, LV_EVENT_CLICKED, nullptr);
  s_rebootBtn = button(p, REBOOT_TXT, 120, 30, D_ROW, D_MUTED);   // 3초 안에 두 번 누르면 다시 켠다
  lv_obj_set_pos(s_rebootBtn, PW - 12 - 120, 200);
  lv_obj_add_event_cb(s_rebootBtn, onReboot, LV_EVENT_CLICKED, nullptr);
  s_deckResetBtn = button(p, DECKRESET_TXT, 108, 30, D_ROW, D_MUTED);   // 받은 단축키 → 내장 16개(3초 안에 두 번)
  lv_obj_set_pos(s_deckResetBtn, 214, 200);
  lv_obj_add_event_cb(s_deckResetBtn, onDeckResetBtn, LV_EVENT_CLICKED, nullptr);
  show(s_deckResetBtn, s_deckCustom);

  lv_obj_t *hr = box(p, D_LINE, 0, 0);
  lv_obj_set_size(hr, PW - 24, 1); lv_obj_set_pos(hr, 12, 238);
  lv_obj_set_pos(label(p, &kr16, D_TEXT, "볼 시간표"), 14, 255);
  s_ttPick = lv_dropdown_create(p);
  lv_obj_set_style_text_font(s_ttPick, &kr16, 0);
  lv_obj_set_style_text_font(lv_dropdown_get_list(s_ttPick), &kr16, 0);
  lv_dropdown_set_options(s_ttPick, "교장실 · 학교 일정\n교감실 · 학교 일정");   // 목록(index.json)을 받으면 fillPicker 가 채운다
  lv_obj_set_style_max_height(lv_dropdown_get_list(s_ttPick), 300, 0);
  lv_obj_set_size(s_ttPick, PW - 12 - 104, 40); lv_obj_set_pos(s_ttPick, 104, 246);
  lv_obj_add_event_cb(s_ttPick, onPickTT, LV_EVENT_VALUE_CHANGED, nullptr);
  lv_obj_add_event_cb(s_ttPick, [](lv_event_t *) { s_idxReq = true; }, LV_EVENT_READY, nullptr);   // 목록을 열었다 → 다음 받기 때 목록도 새로
  lv_obj_t *bSync = mainButton(p, "지금 받기", PW - 24, 34);
  lv_obj_set_pos(bSync, 12, 294);
  lv_obj_add_event_cb(bSync, [](lv_event_t *) {
    s_wifiFails = 0; s_lastWifiKind = 0;                                       // 비밀번호·공유기 실패 횟수도 처음부터
    if (s_failKind == FK_AUTH || s_failKind == FK_NOAP) s_failKind = FK_NONE;   // 사람이 다시 해 보라고 눌렀다 → 잠김을 푼다
    s_syncReq = true; setStatus("곧 연결합니다..."); }, LV_EVENT_CLICKED, nullptr);
  // 화면 색: 단추 5개. 단추 바탕·글자·밑줄이 그 테마의 색(견본)
  {
    const int TY = 336, TH = 32, TX0 = 80, TG = 4, TBW = (PW - 12 - TX0 - 4 * TG) / THEME_N;
    lv_obj_set_pos(label(p, &kr14, D_MUTED, "화면 색"), 14, TY + 8);
    for (int i = 0; i < THEME_N; i++) {
      const Theme *keep = s_th; s_th = &THEMES[i];            // 이름이 매크로라 잠깐 바꿔 그 테마 색을 읽는다
      const uint32_t tBg = D_BG, tTx = D_TEXT, tTag = NOW_TAG; s_th = keep;
      lv_obj_t *b = s_themeBtn[i] = button(p, THEMES[i].name, TBW, TH, tBg, tTx);
      lv_obj_set_pos(b, TX0 + i * (TBW + TG), TY);
      lv_obj_set_style_pad_all(b, 0, 0);
      lv_obj_t *l = lv_obj_get_child(b, 0);
      lv_obj_set_style_text_font(l, &kr14, 0);
      lv_obj_align(l, LV_ALIGN_CENTER, 0, -2);
      lv_obj_t *bar = box(b, tTag, 0, 0);                     // 강조색 밑줄
      lv_obj_set_size(bar, TBW - 16, 4); lv_obj_align(bar, LV_ALIGN_BOTTOM_MID, 0, -3);
      lv_obj_add_event_cb(b, onThemePick, LV_EVENT_CLICKED, (void *)(intptr_t)i);
    }
    refreshThemeButtons();
  }
  s_status = label(p, &kr14, D_MUTED, "");
  lv_obj_set_size(s_status, PW - 28, 34); lv_label_set_long_mode(s_status, LV_LABEL_LONG_DOT);
  lv_obj_set_pos(s_status, 14, 374);
  {   // 버전 줄: 빌드 날짜 · 기기 번호(보드마다 다름) · 지난번 다시 켜진 이유 · 멈춘 횟수
    lv_obj_t *ver = label(p, &kr14, D_MUTED, "");
    lv_obj_set_width(ver, PW - 28); lv_label_set_long_mode(ver, LV_LABEL_LONG_DOT);
    static const char *MON = "JanFebMarAprMayJunJulAugSepOctNovDec";
    const char *dt = __DATE__;   // "Oct 26 2026"
    const char *mp = strstr(MON, String(dt).substring(0, 3).c_str());
    const int mon = mp ? (int)(mp - MON) / 3 + 1 : 0, day = atoi(dt + 4);
    const unsigned id = (unsigned)((ESP.getEfuseMac() >> 32) & 0xFFFF);
    lv_label_set_text_fmt(ver, "버전 %s · %d/%d 빌드 · 기기 %04X\n다시 켜짐: %s · 멈춘 횟수 %d", FW_VERSION, mon, day, id, s_resetWhy, s_crashN);
    lv_obj_set_pos(ver, 14, 410);
  }

  // 비밀번호: 뒤 막 + 위 창(제목·[취소]·입력칸) + 아래 키보드 (화면 맨 위 층, 만든 차례가 겹치는 차례)
  s_pwBg = lv_obj_create(lv_layer_top());
  lv_obj_remove_style_all(s_pwBg);
  lv_obj_set_size(s_pwBg, W, H); lv_obj_set_pos(s_pwBg, 0, 0);
  lv_obj_set_style_bg_color(s_pwBg, lv_color_hex(0x000000), 0); lv_obj_set_style_bg_opa(s_pwBg, LV_OPA_50, 0);
  lv_obj_add_flag(s_pwBg, LV_OBJ_FLAG_CLICKABLE);   // 뒤의 와이파이 목록이 눌리지 않게 막고, 아무것도 안 쳤으면 누를 때 취소
  lv_obj_add_event_cb(s_pwBg, pwBgTap, LV_EVENT_CLICKED, nullptr);
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
    lv_obj_t *img = s_deckImg[i] = lv_img_create(cell);
    lv_img_set_src(img, deckIcon(i));
    lv_obj_align(img, LV_ALIGN_TOP_MID, 0, 3);
    lv_obj_t *l = s_deckLbl[i] = label(cell, &kr14, D_SUB, deckName(i));
    lv_obj_set_size(l, CWD - 10, lv_font_get_line_height(&kr14));   // 받은 긴 이름은 … 로 자른다
    lv_label_set_long_mode(l, LV_LABEL_LONG_DOT);
    lv_obj_set_style_text_align(l, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_align(l, LV_ALIGN_BOTTOM_MID, 0, -3);
  }
  const int RB = 46;                                     // 오른쪽 아래 [새로 고침] 단추 폭(가운데 맞춘 상태 글과 겹치지 않게 양쪽을 비운다)
  s_deckState = label(p, &kr14, D_MUTED, "");
  lv_obj_set_width(s_deckState, PW - 24 - 2 * (RB + 6)); lv_label_set_long_mode(s_deckState, LV_LABEL_LONG_WRAP);
  lv_obj_set_style_text_align(s_deckState, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_set_pos(s_deckState, 12 + RB + 6, PH - 44);
  lv_obj_t *rb = button(p, LV_SYMBOL_REFRESH, RB, 36, D_ROW, D_TEXT);
  lv_obj_set_pos(rb, PW - 10 - RB, PH - 44);
  lv_obj_add_event_cb(rb, onDeckRefresh, LV_EVENT_CLICKED, nullptr);
  deckStateText();
  deckIconsDim();
}
// 교장 화면(시계 장 위에 겹치는 두 번째 판): 시계 · 이름+날짜 · 학교 지금 · 일정 5줄 · 학사 D-day 3줄
static void buildPrincipal() {
  lv_obj_t *p = s_prinPanel = panel(P_CLOCK);
  const int P = 16, CW = PW - 2 * P;
  s_pStale = label(p, &kr14, C_WARN, "");
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
  lv_obj_t *b1 = mainButton(p, "선생님 찾기", PW - 28, 44); lv_obj_set_pos(b1, 14, 190);
  lv_obj_add_event_cb(b1, [](lv_event_t *) { goPage(P_FIND); }, LV_EVENT_CLICKED, nullptr);
  lv_obj_t *b2 = button(p, "설정으로 가기", PW - 28, 44, D_ROW, D_TEXT); lv_obj_set_pos(b2, 14, 246);
  lv_obj_add_event_cb(b2, [](lv_event_t *) { goPage(P_SET); }, LV_EVENT_CLICKED, nullptr);
  show(p, false);
}
// 일정 자세히: 어두운 덮개 + 가운데 카드(맨 위 층). 바깥 덮개나 [닫기]를 누르면 닫힌다(카드를 눌러도 닫히지 않는다)
// 긴 내용은 줄을 바꿔 끝까지 보이고, 넘치면 밀어서(스크롤) 읽는다. [이전]·[다음]으로 옆 일정
static void buildSchedDetail() {
  s_pDetail = box(lv_layer_top(), 0x000000, 0, 0);
  lv_obj_set_style_bg_opa(s_pDetail, LV_OPA_70, 0);
  lv_obj_set_size(s_pDetail, W, H); lv_obj_set_pos(s_pDetail, 0, 0);
  lv_obj_add_flag(s_pDetail, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_add_event_cb(s_pDetail, [](lv_event_t *) { show(s_pDetail, false); }, LV_EVENT_CLICKED, nullptr);
  const int DW_ = W - 40, DH_ = 380, BH = 40;
  lv_obj_t *card = box(s_pDetail, D_PANEL, D_SUB, 16);
  lv_obj_set_size(card, DW_, DH_); lv_obj_center(card);
  lv_obj_add_flag(card, LV_OBJ_FLAG_CLICKABLE);                 // 카드를 눌러도 닫히지 않게(바깥 덮개만 닫는다)
  s_dDate = label(card, &kr14, D_MUTED, ""); lv_obj_set_pos(s_dDate, 20, 16);
  s_dTitle = label(card, &kr20, D_TEXT, "");
  lv_obj_set_width(s_dTitle, DW_ - 40); lv_label_set_long_mode(s_dTitle, LV_LABEL_LONG_DOT);
  const int tlh = lv_font_get_line_height(&kr20);
  lv_obj_set_height(s_dTitle, 2 * tlh + 4); lv_obj_set_pos(s_dTitle, 20, 38);
  const int iy = 38 + 2 * tlh + 12;
  s_dScroll = lv_obj_create(card);
  lv_obj_remove_style_all(s_dScroll);
  lv_obj_set_size(s_dScroll, DW_ - 32, DH_ - iy - BH - 24); lv_obj_set_pos(s_dScroll, 20, iy);
  lv_obj_add_flag(s_dScroll, LV_OBJ_FLAG_SCROLLABLE); lv_obj_set_scroll_dir(s_dScroll, LV_DIR_VER);
  lv_obj_clear_flag(s_dScroll, LV_OBJ_FLAG_SCROLL_MOMENTUM | LV_OBJ_FLAG_SCROLL_ELASTIC);   // 딱딱하게(미끄러지지 않게)
  s_dInfo = label(s_dScroll, &kr14, D_SUB, "");
  lv_obj_set_width(s_dInfo, DW_ - 48); lv_label_set_long_mode(s_dInfo, LV_LABEL_LONG_WRAP);
  lv_obj_set_style_text_line_space(s_dInfo, 5, 0); lv_obj_set_pos(s_dInfo, 0, 0);
  s_dPrev = button(card, LV_SYMBOL_LEFT " 이전", 100, BH, D_ROW, D_TEXT);
  lv_obj_align(s_dPrev, LV_ALIGN_BOTTOM_LEFT, 14, -12);
  lv_obj_add_event_cb(s_dPrev, onDetailStep, LV_EVENT_CLICKED, (void *)(intptr_t)-1);
  s_dNext = button(card, "다음 " LV_SYMBOL_RIGHT, 100, BH, D_ROW, D_TEXT);
  lv_obj_align(s_dNext, LV_ALIGN_BOTTOM_LEFT, 14 + 100 + 8, -12);
  lv_obj_add_event_cb(s_dNext, onDetailStep, LV_EVENT_CLICKED, (void *)(intptr_t)1);
  lv_obj_t *cb = mainButton(card, "닫기", 100, BH);
  lv_obj_align(cb, LV_ALIGN_BOTTOM_RIGHT, -14, -12);
  lv_obj_add_event_cb(cb, [](lv_event_t *) { show(s_pDetail, false); }, LV_EVENT_CLICKED, nullptr);
  show(s_pDetail, false);
}
static void buildUI() {
  lv_obj_t *scr = lv_scr_act();
  lv_obj_set_style_bg_color(scr, lv_color_hex(D_BG), 0);
  lv_obj_clear_flag(scr, LV_OBJ_FLAG_SCROLLABLE);
  s_tv = lv_tileview_create(scr);
  lv_obj_set_style_bg_color(s_tv, lv_color_hex(D_BG), 0);
  lv_obj_set_scrollbar_mode(s_tv, LV_SCROLLBAR_MODE_OFF);
  lv_obj_clear_flag(s_tv, LV_OBJ_FLAG_SCROLL_ELASTIC | LV_OBJ_FLAG_SCROLL_MOMENTUM);
  for (int i = 0; i < P_COUNT; i++) {
    s_tile[i] = lv_tileview_add_tile(s_tv, i, 0, LV_DIR_NONE);   // 쓸어 넘기기 끔 — 좌우를 눌러 넘긴다(onTileTap)
    lv_obj_set_scrollbar_mode(s_tile[i], LV_SCROLLBAR_MODE_OFF);
    lv_obj_add_flag(s_tile[i], LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(s_tile[i], onTileTap, LV_EVENT_CLICKED, nullptr);
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
  // 누르는 자리 알림: 아래 양쪽 끝의 작은 화살표(왼쪽을 누르면 이전, 오른쪽은 다음)
  lv_obj_t *al = label(scr, &kr14, D_MUTED, LV_SYMBOL_LEFT); lv_obj_set_pos(al, 10, H - 17);
  lv_obj_t *ar = label(scr, &kr14, D_MUTED, LV_SYMBOL_RIGHT); lv_obj_set_pos(ar, W - 22, H - 17);
  lv_obj_clear_flag(al, LV_OBJ_FLAG_CLICKABLE); lv_obj_clear_flag(ar, LV_OBJ_FLAG_CLICKABLE);
  markDots();
}

// ── 시계 (분이 바뀔 때만 그린다) ──
static void tickMinute(const struct tm &tm) {
  static const char *WD[7] = {"일", "월", "화", "수", "목", "금", "토"};
  setTextFmtIf(s_big, "%02d:%02d", tm.tm_hour, tm.tm_min);
  setTextFmtIf(s_bigDate, "%d월 %d일 %s요일", tm.tm_mon + 1, tm.tm_mday, WD[tm.tm_wday]);
  setTextFmtIf(s_dayClock, "%02d:%02d", tm.tm_hour, tm.tm_min);
  if (s_renderPending) {   // 화면 불이 꺼진 동안 받은 자료
    s_renderPending = false;
    renderWeather(); renderAir();
  }
  renderTT();     // 교장 모드면 안에서 renderPrincipal·renderSchedList 만 그린다(위 시계 글을 먼저 바꿔야 한다)
  renderMeal();
  refreshStale();
  if (s_page == P_FIND) renderFinder();
  if (s_page == P_SET) refreshWifiLabel();   // '다음 받기' 시각
}

// 화면 색을 바꿀 때: 보드를 다시 켜지 않고 화면 물체만 새 색으로 다시 만든다(7인치와 같다).
// 다시 켜면 시계 칩이 없어 시각을 맞추려고 와이파이로 다시 받게 된다. 받은 자료·와이파이·시각은 그대로 두고, setup 의 그리기 순서를 다시 돈다.
// 4인치는 옆으로 넘기는 장(tileview)이라 다시 만든 뒤 보던 장으로 애니메이션 없이 돌아간다.
static void rebuildUi() {
  const int page = s_page;
  const uint32_t t0 = millis();
  lock();
  s_th = &THEMES[s_themeIdx];
  lv_obj_clean(lv_layer_top());          // 덮개 창(비밀번호·자판·일정 자세히)은 맨 위 층에 있다
  lv_obj_clean(lv_scr_act());
  s_pwBg = s_pwBox = s_kb = s_pDetail = s_deckHelp = nullptr;
  for (int i = 0; i < THEME_N; i++) s_themeBtn[i] = nullptr;
  s_modeShown = -1;                      // 교장·일반 판을 새 물체에 다시 적용
  buildUI();
  resetBandLayout();
  s_batPct = -99;                        // 배터리 글을 다음 바퀴에 다시 쓰게
  s_findGridDirty = true;
  s_page = page;
  fillPicker();                          // 안에서 applyMode
  renderWeather(); renderMeal(); renderAir();
  if (timeValid()) { time_t t = time(nullptr); struct tm tm; localtime_r(&t, &tm); tickMinute(tm); }
  else { renderTT(); refreshStale(); }
  refreshWifiLabel();
  lv_obj_update_layout(lv_scr_act());    // 새 장들의 자리(x)를 먼저 계산해야 같은 장으로 옮겨진다(안 하면 첫 장에 머문다)
  goPage(page);                          // 같은 장으로(LV_ANIM_OFF)
  unlock();
  Serial.printf("theme %d applied (%ums, no restart)\n", s_themeIdx, (unsigned)(millis() - t0));
}

SET_LOOP_TASK_STACK_SIZE(16 * 1024);   // loop 스택 8→16KB(교장 화면 그리기·HTTPS 가 깊다)

void setup() {
  Serial.setRxBufferSize(2048);   // 단축키 받기 줄(최대 273자)이 넘치지 않게 — begin 앞에
  Serial.begin(115200);
#if defined(ARDUINO_USB_CDC_ON_BOOT) && ARDUINO_USB_CDC_ON_BOOT
  Serial.setTxTimeoutMs(20);   // 컴퓨터가 안 읽어도 화면·터치가 오래 멈추지 않게(기본 100ms)
#endif
  Serial.printf("\n" BOARD_TITLE " v%s\n", FW_VERSION);
  if (!LittleFS.begin(true)) Serial.println("LittleFS mount failed");
  if (!LittleFS.exists("/deck")) LittleFS.mkdir("/deck");
  deckClean(true);   // 지난번 받다 만 임시 파일
  deckLoad();        // 받은 단축키(없으면 내장 16개) — buildDeck 앞
  s_prefs.begin("board", false);
  s_pickName = s_prefs.getString("ttname", BOARD_DEFAULT_TT);
  s_lastOkT = (time_t)s_prefs.getULong("lastok", 0);
  s_themeIdx = constrain(s_prefs.getInt("theme", 0), 0, THEME_N - 1);   // 화면 색(buildUI 전에)
  s_th = &THEMES[s_themeIdx];
  s_ttFileKnown = s_prefs.isKey("ttfile");                               // 지난번 받던 시간표 파일(이름이 바뀌어도 찾는다)
  if (s_ttFileKnown) s_ttFile = s_prefs.getString("ttfile", s_ttFile);
  s_pwOk = s_prefs.getBool("pwok", false);
  {   // 지난번 왜 다시 켜졌나(설정 장 버전 줄·기록). 스스로 다시 켤 때는 prefs "hr" 에 까닭을 남긴다
    const esp_reset_reason_t rr = esp_reset_reason();
    const int hr = s_prefs.isKey("hr") ? s_prefs.getInt("hr", 0) : 0;
    if (hr) s_prefs.remove("hr");
    switch (rr) {
      case ESP_RST_POWERON: s_resetWhy = "전원 켬"; break;
      case ESP_RST_SW: s_resetWhy = hr == 1 ? "자동 점검(새벽)" : hr == 2 ? "[다시 켜기] 단추" : "프로그램이 다시 켬"; break;
      case ESP_RST_BROWNOUT: s_resetWhy = "전압 부족"; break;
      case ESP_RST_PANIC: s_resetWhy = "오류로 다시 켬"; break;
      case ESP_RST_TASK_WDT: case ESP_RST_INT_WDT: case ESP_RST_WDT: s_resetWhy = "멈춰서 다시 켬"; break;
      case ESP_RST_EXT: s_resetWhy = "리셋 단추"; break;
      case ESP_RST_USB: s_resetWhy = "USB 로 다시 켬"; break;
      default: s_resetWhy = "기타"; break;
    }
    // 멈춤·오류·전압 부족은 횟수를 남긴다(되풀이되는지 설정 장에서 본다). [다시 켜기]로 켜면 0 으로
    s_crashN = s_prefs.getInt("crashN", 0);
    const bool crash = rr == ESP_RST_PANIC || rr == ESP_RST_TASK_WDT || rr == ESP_RST_INT_WDT || rr == ESP_RST_WDT || rr == ESP_RST_BROWNOUT;
    if (crash) s_prefs.putInt("crashN", ++s_crashN);
    else if (rr == ESP_RST_SW && hr == 2 && s_crashN) { s_crashN = 0; s_prefs.putInt("crashN", 0); }
    Serial.printf("reset reason %d (%s) crash#%d\n", (int)rr, s_resetWhy, s_crashN);
  }
  s_lvMutex = xSemaphoreCreateRecursiveMutex();

  initDisplay();
  // 화면을 켠 뒤부터는 64바이트가 넘는 malloc 을 PSRAM 에서 먼저 준다(내부 RAM 이 부족하면 HTTPS(TLS)가 실패한 적이 있다)
  heap_caps_malloc_extmem_enable(64);
  buildUI();
  if (loadTTFromFile()) Serial.println("tt.json loaded from flash");
  parseWeather(readFile("/wx.json")); renderWeather();
  loadMealFromFile(); renderMeal();
  parseAir(readFile("/air.json")); renderAir();
  if (!parseWhere(readFile("/where.json"))) etagForget("et_whr");
  { String idx = readFile("/index.json"); if (!idx.length() || !parseIndex(idx)) etagForget("et_idx"); }
  loadSchedFromFile();
  fillPicker();      // 안에서 applyMode(교장 모드면 겹침 판으로 바꾼다)
  renderTT();
  refreshWifiLabel();
  refreshStale();
  xTaskCreatePinnedToCore(lvTask, "lvgl", 16 * 1024, nullptr, 2, nullptr, 1);

  setenv("TZ", "KST-9", 1); tzset();
  wifiOff();   // 평소에는 꺼 둔다. 켠 뒤 5초 뒤에 첫 연결(loop)
  Serial.printf("ready (internal free %u, psram free %u, theme %d, rotate %d)\n", (unsigned)heap_caps_get_free_size(MALLOC_CAP_INTERNAL),
                (unsigned)heap_caps_get_free_size(MALLOC_CAP_SPIRAM), s_themeIdx, (int)BOARD_ROTATE_180);

  // 멈춤 감시(워치독): loop 가 150초 넘게 돌지 않으면 스스로 다시 켠다(틀린 시계가 그대로 남지 않게).
  // 받기 하나가 연결·암호·읽기로 길게는 30~40초 걸릴 수 있어(60초 마감 직전에 시작하면 그 뒤까지) 진짜 멈춤만 잡게 넉넉히 둔다.
  // 받기 사이마다·loop 끝마다 쓰다듬는다. 쉬는(idle) 작업은 보지 않는다.
  esp_task_wdt_config_t wcfg = {};
  wcfg.timeout_ms = 150000; wcfg.idle_core_mask = 0; wcfg.trigger_panic = true;
  if (esp_task_wdt_reconfigure(&wcfg) != ESP_OK) esp_task_wdt_init(&wcfg);
  esp_task_wdt_add(NULL);
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
    static int lastChg = -1, logPct = -2, logChg = -1; static uint32_t lastLog = 0;
    if (pct != logPct || chg != logChg || lastLog == 0 || ms - lastLog > 600000UL) {   // 기록은 바뀔 때·10분마다만(USB 기록 줄이기)
      logPct = pct; logChg = chg; lastLog = ms;
      Serial.printf("battery %dmV off %d -> %d%% (%s)\n", mv, st ? off : 0, pct, chg == 1 ? "charging" : chg == 2 ? "full" : "-");
    }
    if (pct != s_batPct || chg != lastChg) {
      s_batPct = pct; lastChg = chg;
      const char *ic = pct >= 88 ? LV_SYMBOL_BATTERY_FULL : pct >= 63 ? LV_SYMBOL_BATTERY_3 : pct >= 38 ? LV_SYMBOL_BATTERY_2 : pct >= 13 ? LV_SYMBOL_BATTERY_1 : LV_SYMBOL_BATTERY_EMPTY;
      char t[48];
      if (chg == 1) snprintf(t, sizeof t, LV_SYMBOL_CHARGE " %d%% 충전 중", pct);
      else if (chg == 2) snprintf(t, sizeof t, LV_SYMBOL_CHARGE " 충전 완료");
      else snprintf(t, sizeof t, "%s %d%%", ic, pct);
      const uint32_t col = chg ? C_OK : pct <= 20 ? C_WARN : D_MUTED;
      lock();
      lv_obj_t *labs[] = {s_bat, s_pBat};
      for (lv_obj_t *l : labs) {
        if (!l) continue;
        if (pct < 0) { showIf(l, false); continue; }
        setTextIf(l, t);
        setTextColIf(l, col);
        showIf(l, true);
      }
      unlock();
    }
  }

  // 1시간마다(밤·주말 2시간) 잠깐 연결: 연결 → 시간 맞추기 → 자료 받기 → 끄기. 수업 중에는 쉬는 시간으로 미룬다.
  if (s_sync == SYNC_IDLE) {
    // 설정 장이 남긴 요청(와이파이 고르기·지우기·다시 켜기·화면 색)은 받기가 없을 때 여기서 처리한다
    if (s_forgetReq) {
      s_forgetReq = false;
      if (s_prefs.isKey("ssid")) s_prefs.remove("ssid");
      if (s_prefs.isKey("pw")) s_prefs.remove("pw");
      wifiOff(); s_wifiFails = 0; s_lastWifiKind = 0;
      s_pwOk = false; if (s_prefs.isKey("pwok")) s_prefs.remove("pwok");
      if (s_failKind == FK_AUTH || s_failKind == FK_NOAP) s_failKind = FK_NONE;
      lock(); refreshWifiLabel(); setStatus("저장한 와이파이를 지웠습니다"); refreshStale(); unlock();
    }
    if (s_wifiApplyReq) {
      lock(); const String ss = s_reqSsid, pw = s_reqPw; s_wifiApplyReq = false; unlock();
      s_prefs.putString("ssid", ss); s_prefs.putString("pw", pw);
      s_pwOk = false; if (s_prefs.isKey("pwok")) s_prefs.remove("pwok");   // 새 비밀번호는 아직 맞는지 모른다
      wifiOff(); s_wifiFails = 0; s_lastWifiKind = 0;
      if (s_failKind == FK_AUTH || s_failKind == FK_NOAP) s_failKind = FK_NONE;
      s_syncReq = true;
    }
    if (s_themeReqAt && millis() - s_themeReqAt > 300) { s_themeReqAt = 0; rebuildUi(); }   // 화면 색: 다시 켜지 않는다
    if (s_rebootReq) { Serial.println("restart (button)"); s_prefs.putInt("hr", 2); delay(200); ESP.restart(); }
    bool due = s_prefs.isKey("ssid") && (!s_triedOnce || ms - s_lastSync > syncWaitMs());
    static bool deferLogged = false;   // 켠 직후 첫 받기와 [지금 받기]는 바로
    if (due && s_triedOnce && inClassNow()) { if (!deferLogged) { deferLogged = true; Serial.println("sync: defer (class)"); } due = false; }
    if (due) deferLogged = false;
    if ((s_syncReq || due) && ms >= 5000 && !s_deckUp) { s_syncReq = false; startSync(); }   // 단축키 받는 중이면 끝난 뒤로
  } else if (s_sync == SYNC_CONNECTING) {
    if (WiFi.isConnected()) {
      s_sync = SYNC_TIME; s_syncStart = ms; s_wifiFails = 0; s_lastWifiKind = 0;
      if (!s_pwOk) { s_pwOk = true; s_prefs.putBool("pwok", true); }   // 이 비밀번호는 맞다(한 번만 쓴다)
      configTzTime("KST-9", "pool.ntp.org", "time.google.com", "kr.pool.ntp.org");
      lock(); setStatus("시간을 맞추는 중..."); unlock();
    } else if (!s_retried && ms - s_syncStart > 15000) {
      s_retried = true;
      Serial.printf("sync: retry (reason %d %s)\n", (int)s_wifiReason, wifiReasonText(s_wifiReason));
      WiFi.disconnect(false, false);
      wifiBegin();
    } else if (ms - s_syncStart > 35000) {
      static char msg[160];
      const int r = s_wifiReason;
      Serial.printf("sync: wifi fail reason %d\n", r);   // 숫자 코드는 기록에만
      // 비밀번호가 틀렸으면 몇 분마다 다시 붙어 봐야 소용없다(그때마다 화면 박자를 바꾼다) → 6시간 쉰다. 그러나 15·204 는 신호가 약하거나
      // 공유기가 바쁠 때도 나므로 3번 이어져야 잠그고, 한 번이라도 붙은 비밀번호(pwok)면 잠그지 않는다. 공유기 없음(201)은 잠그지 않는다.
      const bool pwLike = r == 15 || r == 202 || r == 204;
      const int kind = (pwLike && !s_pwOk) ? (r == 202 ? 1 : 3) : r == 201 ? 2 : 0;
      s_wifiFails = kind ? (kind == s_lastWifiKind ? s_wifiFails + 1 : 1) : 0;
      s_lastWifiKind = kind;
      s_failKind = ((kind == 1 && s_wifiFails >= 2) || (kind == 3 && s_wifiFails >= 3)) ? FK_AUTH : (kind == 2 && s_wifiFails >= 2) ? FK_NOAP : FK_NET;
      okMark(OK_WIFI, false, (pwLike && s_pwOk) ? "공유기 응답 없음" : wifiReasonText(r));
      if (s_failKind == FK_AUTH) snprintf(msg, sizeof msg, "와이파이 비밀번호가 맞지 않습니다. [찾기]에서 다시 고르세요(잠시 뒤 다시 해 봅니다).");
      else if (s_failKind == FK_NOAP) snprintf(msg, sizeof msg, "와이파이 공유기를 찾지 못했습니다(잠시 뒤 다시 해 봅니다).");
      else snprintf(msg, sizeof msg, "와이파이에 연결하지 못했습니다(%s). 잠시 뒤 다시 해 봅니다.", wifiReasonText(r));
      finishSync(false, msg);
    }
  } else if (s_sync == SYNC_TIME) {
    bool synced = sntp_get_sync_status() == SNTP_SYNC_STATUS_COMPLETED || (timeValid() && ms - s_syncStart > 8000);
    if (synced || ms - s_syncStart > 15000) {
      okMark(OK_WIFI, true);
      okMark(OK_TIME, timeValid(), "못 맞춤");
      lock(); setStatus("자료를 받는 중..."); unlock();
      const bool noUrl = urlUnset();   // 시간표 주소가 아직 기본값이면 시간표·선생님 위치는 받지 않는다(받을 때마다 화면 박자가 바뀌므로)
      const bool prin = s_principal;   // 받는 동안 사람이 바꿔도 이번 받기는 이 모드로 끝낸다
      bool cut = false, lowB = false, coreLow = false;   // coreLow: 핵심 자료(학교 일정)를 남은 시간이 모자라 건너뜀
      uint32_t B = 0;
      // 받기 사이마다 멈춤 감시를 쓰다듬고, 남은 시간(60초 마감까지)을 받기에 넘긴다. 남은 시간이 need 보다 적으면 그 받기는 건너뛴다.
      auto go = [&](uint32_t need) { esp_task_wdt_reset(); const uint32_t el = millis() - s_syncStart; if (el > 60000) cut = true;
                                     B = cut ? 0 : 60000 - el; lowB = !cut && B < need; return !cut && !lowB; };
      auto mark = [&](int i, bool want, bool good, const char *why) { if (want) okMark(i, good, (cut || lowB) && !good ? "시간 초과" : why); };
      // 밤·주말에는 날씨·미세먼지·선생님 위치를 건너뛴다(오늘 6시간 안에 받은 것이 있을 때만 — 주말 내내 금요일 날씨가 남지 않게)
      auto fresh = [&](time_t at) { if (!at || !quietNow() || !timeValid()) return false; const time_t now = time(nullptr);
                                    struct tm a1, b1; localtime_r(&at, &a1); localtime_r(&now, &b1);
                                    return now - at < 6 * 3600 && a1.tm_yday == b1.tm_yday; };
      const String tdNow = todayIso();
      // 목록(index.json)은 거의 바뀌지 않는다 → 날이 바뀐 뒤 첫 받기 · [볼 시간표]를 연 뒤 · 아직 목록이 없을 때만
      const bool wantIdx = !noUrl && (!tdNow.length() || s_idxDay != tdNow || s_idxReq || s_index["items"].isNull());
      if (wantIdx && go(1) && downloadIndex(B)) {
        if (tdNow.length()) s_idxDay = tdNow;
        s_idxReq = false;
        if (!s_idxSame) { lock(); fillPicker(); unlock(); }            // 304 면 드롭다운을 다시 채우지 않는다
      }
      s_ttCode = 0;
      const bool wantTT = !noUrl && !prin && !s_pickMissing;          // 볼 시간표가 목록에 없으면 옛 파일을 받지 않는다
      const bool wantSch = prin && HAS_SCHED;
      bool ok = false, same = false, loaded = false, ttGood = false, sch = false, whr = false, wx = false, meal = false, air = false;
      bool skipWx = false, skipAir = false, skipWhr = false;
      // 순서: 모드의 핵심 자료를 먼저(60초 마감에 걸려도 잘리지 않게). 교장: 목록 → 학교 일정 → 선생님 위치 → 날씨 → 미세먼지 → 급식
      //                                                     교사: 목록 → 시간표 → 선생님 위치 → 날씨 → 급식 → 미세먼지
      auto doTT = [&]() {
        ok = wantTT && go(1) && downloadTT(B);
        same = ok && s_ttSame;                                        // 304: 이미 화면에 있는 시간표 그대로
        loaded = ok && !same && loadTTFromFile();                     // 해석은 잠금 밖(안에서 바꾸는 순간만 잠근다)
        if (same && !s_ttLoaded) loaded = loadTTFromFile();
        ttGood = loaded || (same && s_ttLoaded);
        mark(OK_TT, wantTT, ttGood, (s_ttCode == 404 || s_ttCode == 403) ? "404 파일 없음" : ok ? "파일 읽기 실패" : "인터넷");
      };
      auto doSch = [&]() { sch = prin && go(20000) && downloadSchedule(B); coreLow = lowB; mark(OK_SCH, wantSch, sch, "인터넷"); };
      auto doWhr = [&]() {
        skipWhr = !noUrl && fresh(s_whrAt) && s_where["teachers"].size();
        if (skipWhr) return;
        whr = !noUrl && go(20000) && downloadWhere(B); mark(OK_WHR, !noUrl, whr, "인터넷");
        if (whr && timeValid()) s_whrAt = time(nullptr);
      };
      auto doWx = [&]() {
        skipWx = WX_ON && s_wxOk && fresh(s_wxAt);
        if (skipWx) return;
        wx = go(1) && downloadWeather(B); mark(OK_WX, WX_ON, wx, "인터넷");
        if (wx && timeValid()) s_wxAt = time(nullptr);
      };
      auto doAir = [&]() {
        skipAir = WX_ON && (!isnan(s_pm10) || !isnan(s_pm25)) && fresh(s_airAt);
        if (skipAir) return;
        air = go(1) && downloadAir(B); mark(OK_AIR, WX_ON, air, "인터넷");
        if (air && timeValid()) s_airAt = time(nullptr);
      };
      auto doMeal = [&]() {
        meal = go(1) && downloadMeal(B);
        if (!(meal && s_mealCached)) mark(OK_MEAL, MEAL_ON, meal, "인터넷");   // '오늘 이미 받음'은 점검표 시각을 새로 찍지 않는다
      };
      if (prin) { doSch(); doWhr(); doWx(); doAir(); doMeal(); }
      else { doTT(); doWhr(); doWx(); doMeal(); doAir(); }
      esp_task_wdt_reset();
      if (cut) Serial.println("sync: 60s limit, rest skipped");
      if (skipWx || skipAir || skipWhr) Serial.printf("sync: quiet skip%s%s%s\n", skipWx ? " weather" : "", skipAir ? " air" : "", skipWhr ? " where" : "");
      {   // 시간 초과로 모드의 핵심 자료를 못 받았으면 10분 뒤 한 번 더(하루 한 번)
        static String coreDay;
        const bool coreMiss = prin ? (wantSch && !sch) : (wantTT && !ttGood);
        s_coreRetry = (cut || coreLow) && coreMiss && tdNow.length() && coreDay != tdNow;
        if (s_coreRetry) coreDay = tdNow;
      }
      const bool newMeal = meal && !s_mealCached;
      lock();
      if (sch && s_pDetail) show(s_pDetail, false);   // 일정 번호가 바뀌므로 열린 자세히 창은 닫는다
      if (loaded) s_week = -1;
      if (s_blOff) {                                  // 화면 불이 꺼져 있으면 그리지 않고 켤 때 한 번에(분 그리기와 함께)
        if (loaded || wx || newMeal || air || sch) s_renderPending = true;
        if (whr && !s_whereSame) s_findGridDirty = true;
      } else {
        if (loaded || prin) renderTT();
        if (wx) renderWeather();
        if (newMeal) renderMeal();
        if (air) renderAir();
        if (whr && !s_whereSame) { s_findGridDirty = true; if (s_page == P_FIND) { fillFinderGrid(); renderFinder(); } }
      }
      unlock();
      bool good; const char *msg;
      if (!timeValid()) { good = false; msg = "시간을 맞추지 못했습니다. 인터넷을 확인하세요."; }   // 시각을 모르면 1분마다 다시(syncWaitMs)
      else if (prin) {
        good = sch || !HAS_SCHED;
        if (!good) s_failKind = (wx || meal || cut || coreLow) ? FK_PARTIAL : FK_NET;
        msg = sch ? "시간과 학교 일정을 받았습니다." : HAS_SCHED ? (cut || coreLow ? "받는 시간이 길어 중간에 멈췄습니다. 곧 다시 받습니다." : "학교 일정을 받지 못했습니다. 인터넷을 확인하세요.")
                                                     : "시간을 맞췄습니다. 학교 일정 주소가 아직 없습니다.";
      } else if (noUrl) { good = true; msg = "시간을 맞췄습니다. 시간표 주소를 넣으면 시간표도 받습니다."; }
      else if (s_pickMissing) {
        static char pm[200];
        snprintf(pm, sizeof pm, "볼 시간표 '%s'이(가) 목록에 없습니다. 설정에서 다시 고르세요.", s_pickName.c_str());
        s_failKind = FK_PARTIAL; good = false; msg = pm;
      } else {
        good = ttGood;
        if (!ttGood) s_failKind = cut ? FK_PARTIAL : (s_ttCode == 404 || s_ttCode == 403) ? FK_NOTFOUND : (wx || meal) ? FK_PARTIAL : FK_NET;
        msg = ttGood ? (same ? "시간을 맞췄습니다. 시간표는 바뀐 것이 없습니다." : "시간과 시간표를 받았습니다.")
              : s_failKind == FK_NOTFOUND ? "시간표 파일이 사이트에 없습니다. 볼 시간표를 다시 고르거나 관리자께 알려 주세요(6시간 뒤 다시 받습니다)."
              : ok ? "시간표 파일을 읽지 못했습니다. 잠시 뒤 다시 받습니다."
              : cut ? "받는 시간이 길어 중간에 멈췄습니다. 곧 다시 받습니다." : "시간표를 받지 못했습니다. 인터넷을 확인하세요.";
      }
      finishSync(good, msg);
    }
  }

  // 시계 (분이 바뀔 때만 그린다). 화면 불이 꺼져 있으면 그리지 않는다(켤 때 한 번에 최신으로)
  if (ms - lastTick >= 1000) {
    lastTick = ms;
    if (timeValid()) {
      time_t t = time(nullptr); struct tm tm; localtime_r(&t, &tm);
      if (tm.tm_min != lastMin) {
        if (lastMin < 0) s_week = -1;
        lastMin = tm.tm_min;
        lock();
        s_offName = ""; s_offToday = isOffDay(&s_offName);   // 2초마다 일정 JSON 을 훑지 않게 1분에 한 번(교장 화면·화면 불도 이 값을 쓴다)
        if (!s_blOff) tickMinute(tm);
        else s_renderPending = true;
        unlock();
        static int lastDay = -1;
        if (lastDay >= 0 && tm.tm_mday != lastDay) s_syncReq = true;   // 날이 바뀌면 오늘 급식·날씨를 새로 받는다
        lastDay = tm.tm_mday;
      }
    }
  }

  // 화면 불. 컴퓨터 도우미 신호를 받는 보드는 컴퓨터를 따른다:
  //   컴퓨터가 켜져 있는 동안은 끄지 않고(단 밤 22:00~07:00 에는 1시간 무입력이면 끈다), 신호가 끊기고 10초가 더 지나고 2분 무입력이면 끈다.
  //   30분 넘게 신호가 없으면(컴퓨터에서 뽑아 옮김) 아래 평소 규칙으로 돌아간다. '@pc on' 이 다시 오면 deckPoll 이 되살린다.
  // 평소 규칙: 밤(22:00~07:00)·주말·휴일에 2분 무입력이면 끈다. 만지면 켜진다(touchRead).
  static uint32_t lastBl = 0;
  if (ms - lastBl > 2000 && (s_usbSeen || timeValid())) {
    lastBl = ms;
    lock();
    const uint32_t idle = lv_disp_get_inactive_time(NULL);
    static uint32_t gone = 0;
    if (s_usbSeen) {
      if (s_usbOn) gone = 0; else if (!gone) gone = ms;
      if (!s_usbOn && gone && ms - gone > 30UL * 60 * 1000) { s_usbSeen = false; gone = 0; Serial.println("pc helper gone 30min: time rules"); }
    }
    bool off;
    int m = -1;
    if (timeValid()) { time_t t = time(nullptr); struct tm tm; localtime_r(&t, &tm); m = tm.tm_hour * 60 + tm.tm_min; }
    const bool night = m >= 0 && (m < 7 * 60 || m >= 22 * 60);
    if (s_usbSeen) {
      off = !s_usbOn && ms - gone > 10000 && idle > 2UL * 60 * 1000;   // 컴퓨터가 꺼진 뒤 만지면 2분 동안은 켜 둔다
      if (!off && night) off = idle > 60UL * 60 * 1000;               // 컴퓨터가 켜져 있어도 밤에는 1시간 안 만지면 끈다
    } else if (m >= 0) {
      off = (night || s_offToday) && idle > 2UL * 60 * 1000;          // 주말·휴일(교장 모드는 학사 일정의 '휴'). 1분마다 계산해 둔 값
    } else off = false;
    if (off != s_blOff) {
      s_blOff = off; backlight(!off); Serial.printf("backlight %s\n", off ? "off" : "on");
      if (!off) lastMin = -1;                                          // 켜질 때 미룬 그리기를 1초 안에 한 번에
    }
    unlock();   // 백라이트도 I2C(터치와 같은 줄)라 잠근 채로 쓴다
  }
  {   // 터치로 켜졌을 때(touchRead 가 켠다): 꺼진 동안 미룬 그리기를 곧바로
    static bool wasOff = false;
    if (wasOff && !s_blOff) lastMin = -1;
    wasOff = s_blOff;
  }

  // 새벽 3시대: 내부 RAM 이 조각났거나(와이파이·HTTPS 가 실패하기 쉬움) 4번 넘게 잇따라 실패했으면 스스로 다시 켠다.
  // 화면이 꺼졌거나 10분 넘게 아무도 안 만졌을 때만, 켠 지 1시간 뒤부터(하루 한 번 이하).
  static uint32_t lastHealth = 0;
  if (ms - lastHealth > 60000 && timeValid()) {
    lastHealth = ms;
    time_t t = time(nullptr); struct tm tm; localtime_r(&t, &tm);
    const unsigned big = heap_caps_get_largest_free_block(MALLOC_CAP_INTERNAL);
    if (tm.tm_hour == 3 && s_sync == SYNC_IDLE && !s_deckUp && ms > 3600000UL && (big < 40000 || s_failCount >= 4)) {
      lock(); const uint32_t idle = lv_disp_get_inactive_time(NULL); unlock();
      if (s_blOff || idle > 10UL * 60 * 1000) {
        Serial.printf("health restart (internal largest %u, fails %d)\n", big, s_failCount);
        s_prefs.putInt("hr", 1);                         // 다음에 켤 때 '자동 점검'으로 보인다
        delay(100); ESP.restart();
      }
    }
  }

  {   // 컴퓨터 도우미: 받은 줄은 0.2초마다 읽고, 상태 글은 바뀔 때만 바꾼다
    static bool lastUsb = false; static uint32_t lastUsbChk = 0;
    if (s_deckUp || ms - lastUsbChk > 200) {   // 받는 중에는 매 바퀴
      lastUsbChk = ms;
      deckPoll(ms);
      if (lastUsb != s_usbOn) { lastUsb = s_usbOn; Serial.printf("pc helper %s\n", s_usbOn ? "on" : "off"); lock(); deckStateText(); deckIconsDim(); unlock(); }
      if (s_deckWaitKey >= 0 && ms - s_deckWaitAt > 5000) {   // 보냈는데 5초 안에 도우미 답이 없다 → 성공처럼 남기지 않는다
        const int k = s_deckWaitKey; s_deckWaitKey = -1;
        lock(); deckSay(NOW_TAG, LV_SYMBOL_WARNING "  '%s' 컴퓨터 답이 없습니다 · 탭덱을 다시 켜 주세요", deckName(k)); unlock();
        s_deckSentAt = ms ? ms : 1;
      }
      if (s_deckSentAt && !s_deckUp && ms - s_deckSentAt > 60000) { s_deckSentAt = 0; lock(); deckStateText(); unlock(); }   // '보냈습니다' 글은 1분 뒤 안내로
      if (s_forgetArmed || s_rebootArmed || s_deckResetArmed) { lock(); disarmButtons(); unlock(); }                                // '한 번 더' 글은 3초 뒤 되돌린다
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
  esp_task_wdt_reset();
  delay(20);
}
