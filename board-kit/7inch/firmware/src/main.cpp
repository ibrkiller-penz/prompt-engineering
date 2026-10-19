// 교실 알림판 — Waveshare ESP32-S3-Touch-LCD-7 (800x480) / 7B (1024x600, [env:board7b])
// 평소 화면: 오늘 시간표 + 큰 시계(미리 계산해 Firebase 에 올려 둔 board/t/NNN.json 을 1시간마다 받는다)
// 설정: 와이파이(목록 → 비밀번호 → 연결, 보드에 저장), 볼 시간표 고르기
// 내 값(사이트 주소·학교 코드·위치·수능 날짜)은 include/board_config.h 에서 바꾼다.
#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <NetworkClientSecure.h>
#include <Preferences.h>
#include <LittleFS.h>
#include <ArduinoJson.h>
#include <esp_display_panel.hpp>
#include <esp_heap_caps.h>
#include <lvgl.h>
#include <time.h>
#include <esp_sntp.h>
#include <esp_lcd_panel_rgb.h>
#include "esp_lv_adapter_arduino.h"
#include "ioexp.h"
#ifndef BOARD_7B
#define BOARD_7B 0
#endif
#include "wx_icons.h"
#include "board_config.h"   // 보드(사람)마다 바꾸는 값
#include <math.h>

LV_FONT_DECLARE(kr14);
LV_FONT_DECLARE(kr16);
LV_FONT_DECLARE(kr20);
LV_FONT_DECLARE(kr28);
LV_FONT_DECLARE(num120);   // 시계 (2026-10-06 140 → 120, 미리보기 F)
LV_FONT_DECLARE(num36);    // 날씨 기온 (44 → 36)
LV_FONT_DECLARE(num140);   // 1024x600 시계
LV_FONT_DECLARE(num44);    // 1024x600 기온

using namespace esp_panel::drivers;
using namespace esp_panel::board;

static const char *FW_VERSION = "0.1.0";
// 화면 꾸밈: 1 이면 둥근 모서리·그라데이션, 0 이면 각진 모서리·단색(메뉴를 바꿀 때 다시 그리기가 빨라진다)
#define UI_FANCY 0
// UI_SOFT: 딱딱하지 않게(2026-10-17 디자인팀 안). 따뜻한 어두운 색 · 큰 카드만 둥근 모서리 · 알약 꼬리표 · 탭 밑줄 · 노란 '지금' 칸.
// 둥근 모서리는 다시 그리기를 느리게 하므로 반경 10 이상인 큰 면에만 준다(줄·칸·찾기 단추는 각진 채). 두 보드 모두 켠다.
#ifndef UI_SOFT
#define UI_SOFT 1   // 2026-10-19: 800 보드도 켠다(사용자 요청). 글꼴 크기는 big() 이 따로 정한다
#endif
static inline int R(int r) { return UI_FANCY ? r : (UI_SOFT && r >= 10 ? r : 0); }
static inline int RP(int r) { return UI_SOFT ? LV_RADIUS_CIRCLE : R(r); }   // 작은 꼬리표는 알약 모양
static const char *BASE_URL = BOARD_BASE_URL;

// board_config.h 의 값이 비어 있으면(=아직 설정 안 함) 그 기능은 조용히 건너뛰고 화면에 '설정 필요'만 보인다.
constexpr bool cfgSet(const char *s) { return s && s[0]; }
static constexpr bool HAS_MEAL = cfgSet(NEIS_ATPT_CODE) && cfgSet(NEIS_SCHOOL_CODE);   // 급식
static constexpr bool HAS_WX = cfgSet(WEATHER_LAT) && cfgSet(WEATHER_LON);              // 날씨·미세먼지
static bool urlUnset() { return strstr(BASE_URL, "YOUR-SITE-ID") != nullptr; }            // 사이트 주소를 아직 안 바꿨나
static int s_W = 800, s_H = 480;   // 화면 크기(initDisplay 가 패널에서 읽는다)
static bool big() { return s_W > 800; }                                   // 1024x600 인가
static const lv_font_t *FM() { return big() ? &kr16 : &kr14; }             // 작은 설명 글자(1024 는 한 단계 크게)
static const lv_font_t *FCLK() { return big() ? &num140 : &num120; }       // 큰 시계
static const lv_font_t *FTEMP() { return big() ? &num44 : &num36; }        // 기온
// ← 우리 학교 교시 시작 시각으로 바꾸기. 아래 코드의 "12:30"·"13:30"(점심), "08:40"(수업 전), "16:30"(수업 끝) 도 같이 확인한다.
static const char *PERIOD_START[7] = {"08:40", "09:40", "10:40", "11:40", "13:30", "14:40", "15:40"};
static const char *DOW[5] = {"월", "화", "수", "목", "금"};

// ── 색 ── (UI_SOFT 이면 차가운 남색·회색 대신 따뜻한 갈색·크림. 동래 주색·종류색은 그대로)
#if UI_SOFT
#define C_PRIMARY 0xdc2626
#define C_PRIMARY50 0xfef2f2
#define C_TEXT 0x2a2320
#define C_MUTED 0x5c5048
#define C_LIGHT 0x7a6d60
#define C_BG 0xf6f1e9
#define C_SURF 0xffffff
#define C_ALT 0xfbf8f3
#define C_BORDER 0xdcd2c4
#define C_LINE 0xece5da
#define C_EMERALD 0x10b981
#define C_ROSE 0xe11d48
#define D_BG 0x1c1714
#define D_PANEL 0x26201c
#define D_ROW 0x342c26
#define D_LINE 0x4a4038
#define D_TEXT 0xfaf5ee
#define D_SUB 0xe2d8cc
#define D_MUTED 0xb8ab9c
#define D_RED 0xb91c1c
#define NOW_ROW 0xfff4e0      // 지금 교시 줄(따뜻한 크림)
#define NOW_TAG 0xfbbf24      // 지금 교시 칸(호박색) — 빨강은 결강·시험처럼 읽혀서 쓰지 않는다
#define NOW_TX 0x2a2320
#define NEXT_BD 0xfacc15      // 다음 수업 줄 테두리
#else
#define C_PRIMARY 0xdc2626
#define C_PRIMARY50 0xfef2f2
#define C_TEXT 0x0f172a
#define C_MUTED 0x475569
#define C_LIGHT 0x64748b
#define C_BG 0xf1f5f9
#define C_SURF 0xffffff
#define C_ALT 0xf8fafc
#define C_BORDER 0xcbd5e1
#define C_LINE 0xe2e8f0
#define C_EMERALD 0x10b981
#define C_ROSE 0xe11d48
// 시계 모드(어두운 바탕)
#define D_BG 0x0b1120
#define D_PANEL 0x111827
#define D_ROW 0x1e293b
#define D_LINE 0x334155
#define D_TEXT 0xffffff
#define D_SUB 0xcbd5e1
#define D_MUTED 0x94a3b8
#define D_RED 0xb91c1c      // 지금 교시 칸. 흰 글자와 명암비 6.5:1(전 0xef4444 는 3.8:1)
#define NOW_ROW 0xf1f5f9
#define NOW_TAG D_RED
#define NOW_TX 0xffffff
#define NEXT_BD 0
#endif

struct CellStyle { uint32_t bg, border, text, sub; };
static CellStyle styleOf(char t) {
  switch (t) {
    case 'n': return {0xe6f9f0, 0x34d399, C_TEXT, 0x047857};
    case 'd': return {0xffedd5, 0xfb923c, 0x9a3412, 0x9a3412};
    case 'j': return {0xe0e7ff, 0x818cf8, 0x3730a3, 0x3730a3};
    case 'x': return {0xfff1f2, 0xf87171, 0x991b1b, 0x991b1b};
    case 'c': return {0xede9fe, 0xa78bfa, 0x6b21a8, 0x6b21a8};
    case 'e': return {0xfce7f3, 0xf472b6, 0x831843, 0x831843};
    case 'f': return {0xcffafe, 0x38bdf8, 0x075985, 0x075985};
    case 'h': return {0xfee2e2, 0xf87171, 0x991b1b, 0x991b1b};
    default: return {C_SURF, C_LINE, C_LIGHT, C_LIGHT};
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
static int s_ttCode = 0;         // 마지막 시간표 받기의 HTTP 응답 번호(404 면 주소 확인)
// 같은 글이면 다시 그리지 않는다(작은 글자 하나 바꿔도 그 칸을 다시 그린다)
static void setTextIf(lv_obj_t *o, const char *t) { if (o && strcmp(lv_label_get_text(o), t)) lv_label_set_text(o, t); }
static int s_week = -1;          // 보고 있는 주 (0부터)
static String s_ttFile = "t/001.json";   // 목록(index.json)을 받기 전에 쓰는 기본 파일(목록의 첫 시간표)
static String s_ttName = "";

static Preferences s_prefs;

// ── 화면 조각 ──
static lv_obj_t *s_top, *s_title, *s_clock, *s_date, *s_wifiLbl, *s_tabTT, *s_tabSet;
static lv_obj_t *s_viewTT, *s_viewSet;
static lv_obj_t *s_weekLbl, *s_ttSub, *s_grid, *s_status;
static lv_obj_t *s_hd[5], *s_pl[7], *s_cell[5][7], *s_cellA[5][7], *s_cellB[5][7], *s_cellTag[5][7], *s_lunch[5];
static lv_obj_t *s_viewClock, *s_tabClock;
static lv_obj_t *s_dday = nullptr;
static lv_obj_t *s_duty, *s_mealTitle, *s_meal, *s_kcal, *s_notice, *s_noticeLbl;
static Board *s_board = nullptr;
static bool s_blOff = false;
static lv_obj_t *s_big, *s_bigAmPm, *s_bigDate, *s_dayTitle, *s_dayTag;
// 시계 화면 '보이기' 설정(prefs "show" 비트). 끈 것은 숨기고 남은 것이 자리를 나눠 갖는다(layoutClock).
enum { SH_WX = 1, SH_DUST = 2, SH_DUTY = 4, SH_MEAL = 8, SH_TT = 16, SH_DDAY = 32, SH_ALL = 63 };
static int s_show = SH_ALL;
static lv_obj_t *s_left, *s_right, *s_wxCard, *s_wxSep, *s_wxSep2, *s_infoCard, *s_dutyTitle, *s_infoHr, *s_showBtn[6];
static bool s_noticeOn = false;                      // '다음 수업' 띠가 보이는 중(자리를 비워 둔다)
struct WxCard { lv_obj_t *img, *temp, *desc, *hilo, *rain; };
static WxCard s_card[2];
static lv_obj_t *s_dust = nullptr;
// 설정 '시계 화면': 시간 표시(24/12시간) · 시계로 자동 전환(20분/5분/안 함)
static lv_obj_t *s_fmtBtn[2], *s_autoBtn[3];
static bool s_h12 = false;                           // prefs "h12"
static int s_autoClkMin = 20;                        // prefs "autoclk" (0 = 안 함)
static const int AUTO_CLK_MIN[3] = {20, 5, 0};
// 시계 글: 24시간 "15:40" / 12시간 "3:40"(앞의 "오후"는 따로 둔다)
static void clockText(const struct tm &tm, char *out, size_t n, const char **ampm) {
  int h = tm.tm_hour;
  if (s_h12) { *ampm = h < 12 ? "오전" : "오후"; h %= 12; if (h == 0) h = 12; snprintf(out, n, "%d:%02d", h, tm.tm_min); }
  else { *ampm = ""; snprintf(out, n, "%02d:%02d", h, tm.tm_min); }
}
static lv_obj_t *s_row[8], *s_rowP[8], *s_rowA[8], *s_rowB[8], *s_rowTag[8];
static lv_obj_t *s_guide = nullptr;   // 시간표가 없을 때 오른쪽 칸에 띄우는 할 일 안내
static lv_obj_t *s_stale = nullptr;   // 시계 화면 날짜 바로 아래: '자료 갱신 안 됨 · 10/16 기준'(받기가 계속 실패할 때만)
static lv_obj_t *s_pBat = nullptr;    // 교장 화면의 배터리 표시(같은 글)
static lv_obj_t *s_bat = nullptr;     // 배터리 남은 양(7B, 시계 화면 왼쪽 칸 오른쪽 위)
static int s_batPct = -1;             // -1: 배터리 없음·못 읽음
// 리튬 배터리 전압 → 남은 양(%) 어림값(3.3V 0% ~ 4.2V 100%)
static int batteryPct(int mv) {
  static const int V[] = {3300, 3500, 3600, 3700, 3800, 3900, 4000, 4100, 4200}, P[] = {0, 10, 20, 40, 60, 75, 85, 95, 100};
  if (mv <= V[0]) return 0;
  for (int i = 1; i < 9; i++) if (mv <= V[i]) return P[i - 1] + (P[i] - P[i - 1]) * (mv - V[i - 1]) / (V[i] - V[i - 1]);
  return 100;
}
static lv_obj_t *s_wifiList, *s_wifiInfo, *s_pwBox, *s_pwTa, *s_kb, *s_ttPick;
static lv_obj_t *s_pwBg = nullptr;   // 비밀번호 창 뒤 어두운 막: 누르면 취소(뒤의 와이파이 목록이 눌리지 않게)
static String s_pickSsid;

// ── 화면 밀림 대처(Waveshare/Espressif 매뉴얼 'Why do I get drift', 19_개발보드2 와 같게 2026-10-06) ──
// · 와이파이·플래시 쓰기 동안은 PSRAM 이 바빠 박자가 어긋난다 → 그동안 PCLK 를 6MHz 로 낮춘다.
// · 끝나면 16MHz 로 되돌리고 esp_lcd_rgb_panel_restart() 로 박자를 다시 맞춘다.
// · 그래도 밀릴 수 있으니 1분마다 한 번 다시 맞춘다(loop) — 밀려도 1분 안에 제자리.
// (CONFIG_LCD_RGB_RESTART_IN_VSYNC 는 platformio.ini 에서 =n 으로 명시해 끈다 — 기본값이 y 다. esp-idf#19070)
static LCD *s_lcd = nullptr;
#if BOARD_7B   // 1024x600: 박자는 esp_panel_board_custom_conf.h 와 같게(21MHz, 초당 약 23장). 받는 동안 12MHz
static const uint32_t PCLK_HZ = 28 * 1000 * 1000, PCLK_SLOW_HZ = 12 * 1000 * 1000;   // 2026-10-18 21→28MHz 시험(초당 약 30장)(PSRAM 80MHz 권장 한계 22MHz 근처 — 와이파이 때 밀리면 되돌린다)
static const uint32_t FRAME_SLOW_MS = 86, FRAME_FAST_MS = 54;   // 한 장 그리는 시간 + 10ms ((1024+362)x(600+61)/pclk)
#else
static const uint32_t PCLK_HZ = 16 * 1000 * 1000, PCLK_SLOW_HZ = 6 * 1000 * 1000;
static const uint32_t FRAME_SLOW_MS = 40, FRAME_FAST_MS = 25;
#endif
static bool s_lcdSlow = false;
static const bool s_diagResync = false;   // true 면 1분마다 하는 다시 맞추기도 기록한다(진단할 때만)
static esp_lcd_panel_handle_t panelHandle() { return s_lcd ? (esp_lcd_panel_handle_t)s_lcd->getHandle() : nullptr; }
static void panelResync() {
  esp_lcd_panel_handle_t p = panelHandle();
  if (!p) return;
  esp_err_t e = esp_lcd_rgb_panel_restart(p);
  if (e != ESP_OK) Serial.printf("panel restart: %s\n", esp_err_to_name(e));
}
static void lcdLog(const char *what) { Serial.printf("lcd: %s (%lus)\n", what, (unsigned long)(millis() / 1000)); }   // 깜빡임 시각을 맞춰 보는 기록
static void lcdSlow(bool slow) {
  esp_lcd_panel_handle_t p = panelHandle();
  if (!p || slow == s_lcdSlow) return;
  s_lcdSlow = slow;
  char w[32]; snprintf(w, sizeof w, "pclk %luMHz%s", (unsigned long)((slow ? PCLK_SLOW_HZ : PCLK_HZ) / 1000000), slow ? "" : "+restart");
  lcdLog(w);
  esp_lcd_rgb_panel_set_pclk(p, slow ? PCLK_SLOW_HZ : PCLK_HZ);
  delay(slow ? FRAME_SLOW_MS : FRAME_FAST_MS);   // 한 장 그려질 때까지
  if (!slow) panelResync();
}

// 화면 불: 800 보드는 화면 라이브러리의 백라이트, 7B 는 IO 확장 칩 EXIO2
static bool blReady() {
#if BOARD_7B
  return ioexp_ready();
#else
  return s_board && s_board->getBacklight();
#endif
}
static void blSet(bool on) {
#if BOARD_7B
  ioexp_backlight(on);
#else
  if (on) s_board->getBacklight()->on(); else s_board->getBacklight()->off();
#endif
}

static void lock() { esp_lv_adapter_lock(-1); }
static void unlock() { esp_lv_adapter_unlock(); }

// ── 시계 화면 배치 ──
// 왼쪽 칸: 큰 시계 → 바로 아래 날짜 → 남은 자리에 카드(날씨 · 오늘). 맨 아래는 '다음 수업' 띠 자리(보일 때만 비운다).
// 오른쪽 시간표를 끄면 왼쪽 칸이 화면 전체가 되고 카드 둘이 옆으로 나란히 선다. 끈 카드의 자리는 남은 카드가 가져간다.
// 값은 800×480 기준이고 1024×600 이면 비율대로 늘린다(S).
static void layoutClock() {
  if (!s_left) return;
  const float K = s_W / 800.0f;
  auto S = [&](int v) { return (int)lroundf(v * K); };
  auto vis = [](lv_obj_t *o, bool on) { if (on) lv_obj_clear_flag(o, LV_OBJ_FLAG_HIDDEN); else lv_obj_add_flag(o, LV_OBJ_FLAG_HIDDEN); };
  const int CM = S(12), PH = s_H - 2 * CM, P = S(20), GAP = S(10);
  const bool tt = s_show & SH_TT, wx = s_show & SH_WX, dust = wx && (s_show & SH_DUST);
  const bool duty = s_show & SH_DUTY, meal = s_show & SH_MEAL, info = duty || meal;
  const int LW = tt ? S(416) : s_W - 2 * CM, CW = LW - 2 * P;
  lv_obj_set_size(s_left, LW, PH);
  vis(s_right, tt);

  // 시계와 날짜(시계 바로 아래)
  // 미리보기 F(web/sample/dev/clock_preview2.html?v=F): 시계 120(줄 높이 88) · 시계→날짜 20 · 날짜→카드 24
  const int CLK_Y = S(22), CLK_H = big() ? lv_font_get_line_height(FCLK()) : 88, DATE_H = 29;   // num120 줄 높이 88, kr28 줄 높이 29
  lv_obj_align(s_big, LV_ALIGN_TOP_MID, s_h12 ? S(30) : 0, CLK_Y);
  const int DATE_Y = CLK_Y + CLK_H + S(20);
  lv_obj_set_width(s_bigDate, LW); lv_obj_set_pos(s_bigDate, 0, DATE_Y);
  if (s_stale) { lv_obj_set_width(s_stale, LW); lv_obj_set_pos(s_stale, 0, DATE_Y + DATE_H + S(3)); }
  if (!lv_obj_has_flag(s_bigAmPm, LV_OBJ_FLAG_HIDDEN)) { lv_obj_update_layout(s_big); lv_obj_align_to(s_bigAmPm, s_big, LV_ALIGN_OUT_LEFT_BOTTOM, -8, -14); }

  // 카드 자리: 날짜 아래 ~ (띠가 보이면 띠 위, 아니면 아래 여백)
  const int NOTICE_H = S(40);
  lv_obj_set_size(s_notice, CW, NOTICE_H); lv_obj_set_pos(s_notice, P, PH - P - NOTICE_H + S(6));
  lv_obj_set_width(s_noticeLbl, CW - S(24)); lv_obj_center(s_noticeLbl);
  const int TOP = DATE_Y + DATE_H + S(24);
  const int BOT = PH - P - (s_noticeOn ? NOTICE_H + S(4) : 0);
  const int avail = BOT - TOP;
  const int WX_BASE = dust ? S(96) : S(74);                            // 날씨 카드: 위 블록 70 + 미세먼지 줄 28
  int wxX = P, wxY = TOP, wxW = CW, wxH = 0, inX = P, inY = TOP, inW = CW, inH = 0;
  if (tt) {                                                            // 세로로 쌓기
    wxH = wx ? WX_BASE : 0;
    const int rest = avail - (wx ? wxH + GAP : 0);
    inH = info ? ((duty && meal) ? max(rest, S(96)) : (meal ? max(rest, S(70)) : S(44))) : 0;
    if (info && !meal) inY = wxY + (wx ? wxH + GAP : 0);               // 할 일만: 날씨 바로 아래 작은 카드
    else if (info) inY = wxY + (wx ? wxH + GAP : 0);
    if (!info && wx) wxY = TOP + (avail - wxH) / 2;                    // 날씨만: 가운데
  } else {                                                             // 옆으로 나란히(시간표를 껐을 때)
    const int n = (wx ? 1 : 0) + (info ? 1 : 0);
    const int cw = n == 2 ? (CW - S(16)) / 2 : CW;
    wxW = inW = cw;
    const int h = min(avail, S(150));
    wxH = wx ? h : 0; inH = info ? h : 0;
    wxY = inY = TOP + (avail - h) / 2;
    inX = wx ? P + cw + S(16) : P;
  }

  // 날씨 카드 안
  vis(s_wxCard, wx);
  if (wx) {
    lv_obj_set_size(s_wxCard, wxW, wxH); lv_obj_set_pos(s_wxCard, wxX, wxY);
    const int topArea = dust ? wxH - S(28) : wxH, yOff = (topArea - S(70)) / 2;   // 그림 52 · 기온 36 블록 높이 70
    lv_obj_set_size(s_wxSep, 1, S(48)); lv_obj_set_pos(s_wxSep, wxW / 2, yOff + S(10));
    vis(s_wxSep2, dust); vis(s_dust, dust);
    lv_obj_set_size(s_wxSep2, wxW - S(28), 1); lv_obj_set_pos(s_wxSep2, S(14), wxH - S(28));
    lv_obj_set_width(s_dust, wxW - S(28)); lv_obj_set_pos(s_dust, S(14), wxH - S(21));
    for (int i = 0; i < 2; i++) {
      const int x0 = i * wxW / 2;
      WxCard &k = s_card[i];
      lv_obj_set_pos(k.img, x0 + S(8), yOff + (S(70) - 2 - 52) / 2);
      lv_obj_set_pos(k.desc, x0 + S(66), yOff + S(10));
      lv_obj_set_pos(k.temp, x0 + S(66), yOff + S(26));
      lv_obj_set_width(k.hilo, wxW / 2 - S(74)); lv_obj_set_pos(k.hilo, x0 + S(66), yOff + S(52));
    }
  }
  // '오늘' 카드 안
  vis(s_infoCard, info);
  if (info) {
    lv_obj_set_size(s_infoCard, inW, inH); lv_obj_set_pos(s_infoCard, inX, inY);
    vis(s_dutyTitle, duty); vis(s_duty, duty); vis(s_infoHr, duty && meal);
    vis(s_mealTitle, meal); vis(s_meal, meal); vis(s_kcal, meal);
    lv_obj_set_pos(s_dutyTitle, S(14), S(14));
    lv_obj_set_width(s_duty, inW - S(76)); lv_obj_set_pos(s_duty, S(62), S(14));
    lv_obj_set_size(s_infoHr, inW - S(28), 1); lv_obj_set_pos(s_infoHr, S(14), S(40));
    const int mealY = duty ? S(52) : S(14);
    lv_obj_set_pos(s_mealTitle, S(14), mealY);
    lv_obj_set_size(s_meal, inW - S(76), max(18, inH - mealY - S(26)));  // 남은 줄 수만큼, 넘치면 …
    lv_obj_set_pos(s_meal, S(62), mealY - 1);
    lv_obj_set_pos(s_kcal, S(62), inH - 2 - S(22));
  }
}

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
  lv_obj_set_style_radius(o, R(radius), 0);
  lv_obj_clear_flag(o, LV_OBJ_FLAG_SCROLLABLE);
  return o;
}
static lv_obj_t *button(lv_obj_t *parent, const char *txt, int w, int h, uint32_t bg, uint32_t fg) {
  lv_obj_t *b = lv_btn_create(parent);
  lv_obj_set_size(b, w, h);
  lv_obj_set_style_bg_color(b, lv_color_hex(bg), 0);
  lv_obj_set_style_shadow_width(b, 0, 0);
  lv_obj_set_style_radius(b, UI_SOFT ? 10 : R(8), 0);
  lv_obj_set_style_border_width(b, 1, 0);
  lv_obj_set_style_border_color(b, lv_color_hex(D_LINE), 0);
  // 누를 때 색이 천천히 바뀌는 효과(테마 기본 80ms)를 없앤다 — 딱딱 바로 반응(2026-10-18 사용자 요청)
  static const lv_style_prop_t NO_PROPS[] = {(lv_style_prop_t)0};
  static lv_style_transition_dsc_t noTrans;
  static bool inited = false;
  if (!inited) { lv_style_transition_dsc_init(&noTrans, NO_PROPS, lv_anim_path_linear, 0, 0, nullptr); inited = true; }
  lv_obj_set_style_transition(b, &noTrans, 0);
  lv_obj_set_style_transition(b, &noTrans, LV_STATE_PRESSED);
  lv_obj_t *l = label(b, &kr16, fg, txt);
  lv_obj_center(l);
  return b;
}

// ── 시간·날짜 ──
static bool timeValid() { return time(nullptr) > 1700000000; }
static String todayIso() {
  if (!timeValid()) return "";
  time_t t = time(nullptr); struct tm tm; localtime_r(&t, &tm);
  char b[12]; strftime(b, sizeof b, "%Y-%m-%d", &tm); return String(b);
}
static int nowMin() { time_t t = time(nullptr); struct tm tm; localtime_r(&t, &tm); return tm.tm_hour * 60 + tm.tm_min; }
static int toMin(const char *hm) { return atoi(hm) * 60 + atoi(hm + 3); }

// ── 시간표 (오늘 하루) ──
// 교실 칠판에는 주간표보다 오늘 시간표와 큰 시계가 잘 보여, 시계 모드가 기본이다(20분 무입력이면 자동).
// 주말·휴일이면 다음 수업일을 보인다.
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
// 줄 차례: 1~4교시, 점심, 5~7교시
static int periodOfRow(int r) { return r < 4 ? r : (r == 4 ? -1 : r - 1); }

// 받기 상태(renderToday·renderMeal 이 읽으므로 앞에 둔다)
enum SyncState { SYNC_IDLE, SYNC_CONNECTING, SYNC_TIME };
static SyncState s_sync = SYNC_IDLE;
static uint32_t s_syncStart = 0, s_lastSync = 0;
static bool s_triedOnce = false, s_lastOk = false;
static int s_failCount = 0;   // 잇따라 실패한 횟수
// 실패 종류에 따라 다시 받는 간격을 다르게 한다(받을 때마다 화면 박자를 바꿔 깜빡이므로 쓸데없이 자주 받지 않는다. 2026-10-16)
//  FK_NOTFOUND: 시간표 주소에 파일이 없음(404·403) → 6시간 뒤 또는 [지금 받기]
//  FK_NET     : 와이파이·인터넷 실패 → 2·4·8·16·32분, 그 뒤로 60분마다
//  FK_PARTIAL : 시간표는 못 받았지만 시간·날씨·급식 중 일부는 받음 → 1시간 주기 유지
enum FailKind { FK_NONE, FK_NOTFOUND, FK_NET, FK_PARTIAL };
static FailKind s_failKind = FK_NONE;
static char s_lastOkHM[8] = "";      // 마지막으로 성공한 시각
static time_t s_lastOkT = 0;         // 마지막으로 성공한 때(prefs "lastok" — 껐다 켜도 남는다)
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
// 위쪽 막대용 '받음' 시각: 오늘이면 08:12, 아니면 10/16 08:12
static void okStamp(char *buf, size_t n) {
  if (!s_lastOkT) { snprintf(buf, n, "%s", s_lastOkHM); return; }
  struct tm a, b; const time_t now = time(nullptr); localtime_r(&s_lastOkT, &a); localtime_r(&now, &b);
  if (a.tm_yday == b.tm_yday && a.tm_year == b.tm_year) snprintf(buf, n, "%02d:%02d", a.tm_hour, a.tm_min);
  else snprintf(buf, n, "%d/%d %02d:%02d", a.tm_mon + 1, a.tm_mday, a.tm_hour, a.tm_min);
}
static bool s_mealOk = false;    // 날씨는 위의 s_wxOk 를 같이 쓴다
static char s_lastHM[8] = "";
static volatile bool s_syncReq = false;
static const uint32_t SYNC_EVERY_MS = 3600UL * 1000;

static void setTopTitle();
static void renderToday() {
  setTopTitle();
  if (!s_ttLoaded) {
    const bool noWifi = !s_prefs.getString("ssid", "").length();
    setTextIf(s_dayTitle, urlUnset() ? "시간표 주소가 없습니다" : noWifi ? "설정에서 와이파이를 연결하세요"
              : (s_triedOnce && !s_lastOk) ? (s_failKind == FK_NOTFOUND ? "시간표 파일을 찾지 못했습니다" : "시간표를 받지 못했습니다 · 곧 다시 받습니다")
              : "시간표를 받는 중…");
    if (s_guide && (urlUnset() || noWifi)) {
      setTextIf(s_guide, noWifi
        ? "시간표를 아직 불러오지 못했습니다\n\n1. [설정] → [찾기]에서 학교 와이파이를 고르세요\n2. 계속 안 되면 정보 담당 선생님께 알려 주세요\n\n시계는 지금도 정상입니다"
        : "시간표 주소가 아직 없습니다\n\n정보 담당 선생님의 확인이 필요합니다\n\n시계·날씨·급식은 지금도 정상입니다");
      lv_obj_clear_flag(s_guide, LV_OBJ_FLAG_HIDDEN);
    }
    return;
  }
  if (s_guide) lv_obj_add_flag(s_guide, LV_OBJ_FLAG_HIDDEN);
  bool isToday;
  JsonObject day = findDay(isToday);
  const char *date = day["date"] | "", *dow = day["dow"] | "", *tag = day["tag"] | "";
  // 오늘 날짜는 왼쪽 아래에 이미 있으므로 제목에 다시 쓰지 않는다(중복 없이). 다음 수업일일 때만 날짜를 쓴다.
  if (isToday) lv_label_set_text(s_dayTitle, "오늘 시간표");
  else lv_label_set_text_fmt(s_dayTitle, "다음 수업일 · %d월 %d일 (%s)", atoi(date + 5), atoi(date + 8), dow);
  lv_label_set_text(s_dayTag, tag);
  if (*tag) {                                                        // 휴일·행사 꼬리표는 제목 바로 뒤에
    lv_obj_clear_flag(s_dayTag, LV_OBJ_FLAG_HIDDEN);
    lv_obj_update_layout(s_dayTitle);
    lv_obj_align_to(s_dayTag, s_dayTitle, LV_ALIGN_OUT_RIGHT_MID, 8, 0);
  } else lv_obj_add_flag(s_dayTag, LV_OBJ_FLAG_HIDDEN);
  // 수능 D-day: 당일은 D-DAY, 다음 날부터 숨긴다(board_config.h 의 SUNEUNG_DATE)
  {
    String td = todayIso();
    if (td.length() && strlen(SUNEUNG_DATE) == 10) {   // 날짜를 비워 두면(설정 안 함) 숨겨 둔 채로 둔다
      auto dayNo = [](const char *iso) { struct tm tm = {}; tm.tm_year = atoi(iso) - 1900; tm.tm_mon = atoi(iso + 5) - 1; tm.tm_mday = atoi(iso + 8); tm.tm_hour = 12; return (long)(mktime(&tm) / 86400); };
      long left = dayNo(SUNEUNG_DATE) - dayNo(td.c_str());
      if (left > 0) lv_label_set_text_fmt(s_dday, "수능 D-%ld", left);
      else if (left == 0) lv_label_set_text(s_dday, "수능 D-DAY");
      if (left >= 0 && (s_show & SH_DDAY)) lv_obj_clear_flag(s_dday, LV_OBJ_FLAG_HIDDEN); else lv_obj_add_flag(s_dday, LV_OBJ_FLAG_HIDDEN);
    }
  }

  const bool teacher = strcmp(s_tt["kind"] | "teacher", "teacher") == 0;
  const int nm = timeValid() ? nowMin() : -1;
  int nowP = -1, nextP = -1;
  if (isToday) {
    for (int p = 0; p < 7; p++) {
      int st = toMin(PERIOD_START[p]);
      if (nm >= st && nm < st + 50) nowP = p;
      if (nextP < 0 && st > nm) nextP = p;
    }
  }
  const bool lunchNow = isToday && nm >= toMin("12:30") && nm < toMin("13:30");
  JsonArray cells = day["cells"].as<JsonArray>();

  // 지금 교시 줄은 밝은 칸(옅은 회색 + 검은 글씨)으로 눈에 띄게(사용자 지시). 종류 색은 테두리로만.
  for (int r = 0; r < 8; r++) {
    int p = periodOfRow(r);
    bool now = (p >= 0 && p == nowP) || (p < 0 && lunchNow);
    uint32_t border = D_LINE, colA = D_TEXT, colB = D_SUB;
    const char *textA = "", *textB = "", *textTag = "";
    if (p < 0) {
      const char *lunch = day["lunch"] | "";
      bool duty = teacher && *lunch;
      textA = duty ? "급식지도" : "점심시간";
      textB = teacher ? "12:30 ~ 13:30" : lunch;
      if (duty) { border = 0xf59e0b; colA = 0xfcd34d; } else colA = D_MUTED;
      colB = D_MUTED;
    } else {
      JsonArray c = cells[p];
      const char *t = c[0] | "";
      textA = *t ? (const char *)(c[1] | "") : (teacher ? "공강" : "");
      textB = c[2] | "";
      textTag = c[3] | "";
      if (*t) border = styleOf(*t).border; else { colA = D_MUTED; colB = D_MUTED; }
    }
    const bool past = isToday && nm >= 0 && !now && (p >= 0 ? nm >= toMin(PERIOD_START[p]) + 50 : nm >= toMin("13:30"));
    if (past) { colA = D_MUTED; colB = D_MUTED; }
    const bool next = UI_SOFT && !now && p >= 0 && p == nextP && nm >= 0;
    if (now) { border = NOW_ROW; colA = C_TEXT; colB = C_MUTED; }
    if (next) border = NEXT_BD;
    lv_obj_set_style_bg_color(s_row[r], lv_color_hex(now ? NOW_ROW : D_ROW), 0);
    lv_obj_set_style_border_color(s_row[r], lv_color_hex(border), 0);
    lv_obj_set_style_border_width(s_row[r], next ? 2 : 1, 0);
    lv_label_set_text(s_rowA[r], textA);
    lv_label_set_text(s_rowB[r], textB);
    lv_obj_set_style_text_color(s_rowA[r], lv_color_hex(colA), 0);
    lv_obj_set_style_text_color(s_rowB[r], lv_color_hex(colB), 0);
    lv_label_set_text(s_rowTag[r], textTag);
    if (*textTag) {
      lv_obj_clear_flag(s_rowTag[r], LV_OBJ_FLAG_HIDDEN);
      lv_obj_update_layout(s_rowA[r]);                                  // 과목 글 폭이 정해진 뒤 그 뒤에 붙인다
      lv_obj_align_to(s_rowTag[r], s_rowA[r], LV_ALIGN_OUT_RIGHT_MID, 8, 0);
    } else lv_obj_add_flag(s_rowTag[r], LV_OBJ_FLAG_HIDDEN);
    lv_obj_set_style_bg_color(s_rowP[r], lv_color_hex(now ? NOW_TAG : D_LINE), 0);
    lv_obj_t *pl = lv_obj_get_child(s_rowP[r], 0);
    lv_obj_set_style_text_color(pl, lv_color_hex(now ? NOW_TX : D_SUB), 0);
    // 교시 칸: 평소에는 시작 시각, 지금 교시(점심)에는 남은 시간 — 한눈에 '지금 어디쯤인지' 보이게
    if (p < 0) { if (now) lv_label_set_text_fmt(pl, "점심\n%d분 남음", toMin("13:30") - nm); else lv_label_set_text(pl, "점심"); }
    else if (now) lv_label_set_text_fmt(pl, "%d교시\n%d분 남음", p + 1, toMin(PERIOD_START[p]) + 50 - nm);
    else lv_label_set_text_fmt(pl, "%d교시\n%s", p + 1, PERIOD_START[p]);
  }
  // 할 일: 급식지도 · 공강지도 · 보강 · 야자 감독 (오늘만)
  {
    String duty;
    auto add = [&](const String &s) { if (duty.length()) duty += "  ·  "; duty += s; };
    if (isToday) {
      if (teacher && *(const char *)(day["lunch"] | "")) add("급식지도 12:30");
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
    lv_label_set_text(s_duty, duty.length() ? duty.c_str() : (isToday ? "오늘은 따로 맡은 일이 없습니다" : "-"));
    lv_obj_set_style_text_color(s_duty, lv_color_hex(duty.length() ? 0xfcd34d : D_MUTED), 0);
  }
  // 다음 수업 알림: 수업 시작 10분 전부터(다음이 공강이면 띄우지 않는다). 그동안 날짜 대신 보인다.
  {
    int soonP = -1;
    if (isToday && nowP < 0)
      for (int p = 0; p < 7; p++) { int d = toMin(PERIOD_START[p]) - nm; if (d > 0 && d <= 10) { soonP = p; break; } }
    JsonArray sc = soonP >= 0 ? cells[soonP].as<JsonArray>() : JsonArray();
    if (soonP >= 0 && *(const char *)(sc[0] | "")) {
      const char *a = sc[1] | "", *b = sc[2] | "";
      int left = toMin(PERIOD_START[soonP]) - nm;
      lv_label_set_text_fmt(s_noticeLbl, "다음 %d교시  %s%s%s  ·  %d분 뒤", soonP + 1, a, *b ? " · " : "", b, left);
      lv_obj_clear_flag(s_notice, LV_OBJ_FLAG_HIDDEN);
    } else lv_obj_add_flag(s_notice, LV_OBJ_FLAG_HIDDEN);
    const bool on = soonP >= 0 && *(const char *)(sc[0] | "");
    if (on != s_noticeOn) { s_noticeOn = on; layoutClock(); }       // 띠가 생기거나 사라지면 카드 자리를 다시 잡는다
  }
  (void)nextP;   // '지금/다음' 글은 두지 않는다 — 오른쪽의 밝은 줄과 '남은 시간', 아래 '다음 수업' 띠가 그 역할을 한다
}

// ── 주간 시간표 ──
static void renderWeek() {
  if (!s_ttLoaded) {
    lv_label_set_text(s_weekLbl, "시간표 없음");
    lv_label_set_text(s_ttSub, s_prefs.getString("ssid", "").length() ? "시간표를 받는 중…" : "설정에서 와이파이를 연결하세요");
    return;
  }
  JsonArray weeks = s_tt["weeks"].as<JsonArray>();
  if (s_week < 0 || s_week >= (int)weeks.size()) s_week = currentWeek();
  JsonObject wk = weeks[s_week];
  JsonArray days = wk["days"].as<JsonArray>();
  String today = todayIso();
  int nm = timeValid() ? nowMin() : -1;
  int nowP = -1;
  for (int p = 0; p < 7; p++) if (nm >= toMin(PERIOD_START[p]) && nm < toMin(PERIOD_START[p]) + 50) nowP = p;

  const char *d0 = days[0]["date"] | "", *d4 = days[days.size() - 1]["date"] | "";
  lv_label_set_text_fmt(s_weekLbl, "%d주차  %d/%d ~ %d/%d", wk["n"].as<int>(), atoi(d0 + 5), atoi(d0 + 8), atoi(d4 + 5), atoi(d4 + 8));
  const char *kind = s_tt["kind"] | "teacher";
  if (strcmp(kind, "teacher") == 0) lv_label_set_text_fmt(s_ttSub, "주당 %s시간 · 담임 %s", (const char *)(s_tt["hours"] | "-"), (const char *)(s_tt["home"] | "-"));
  else lv_label_set_text(s_ttSub, "교실 시간표");

  for (int d = 0; d < 5; d++) {
    JsonObject day = days[d];
    const char *date = day["date"] | "";
    bool isToday = today.length() && today == date;
    const char *tag = day["tag"] | "";
    lv_label_set_text_fmt(lv_obj_get_child(s_hd[d], 0), "%s %d/%d%s%s", DOW[d], atoi(date + 5), atoi(date + 8), *tag ? "  " : "", tag);
    lv_obj_set_style_bg_color(s_hd[d], lv_color_hex(isToday ? 0x3f1d24 : D_PANEL), 0);
    lv_obj_set_style_text_color(lv_obj_get_child(s_hd[d], 0), lv_color_hex(isToday ? 0xfca5a5 : D_SUB), 0);

    JsonArray cells = day["cells"].as<JsonArray>();
    for (int p = 0; p < 7; p++) {
      JsonArray c = cells[p];
      const char *t = c[0] | "", *a = c[1] | "", *b = c[2] | "", *g = c[3] | "";
      CellStyle st = styleOf(*t);
      lv_obj_t *o = s_cell[d][p];
      // 어두운 바탕: 종류 색은 테두리로만
      const bool nowCell = isToday && p == nowP;   // 지금 교시는 흰 칸으로 눈에 띄게(사용자 지시)
      lv_obj_set_style_bg_color(o, lv_color_hex(nowCell ? NOW_ROW : (*t ? D_ROW : D_PANEL)), 0);
      lv_obj_set_style_border_color(o, lv_color_hex(nowCell ? NOW_ROW : (*t ? st.border : D_LINE)), 0);
      lv_obj_set_style_border_width(o, isToday && p == nowP ? 3 : 1, 0);
      lv_label_set_text(s_cellA[d][p], a);
      lv_label_set_text(s_cellB[d][p], b);
      lv_label_set_text(s_cellTag[d][p], g);
      lv_obj_set_style_text_color(s_cellA[d][p], lv_color_hex(nowCell ? C_TEXT : D_TEXT), 0);
      lv_obj_set_style_text_color(s_cellB[d][p], lv_color_hex(nowCell ? C_MUTED : D_SUB), 0);
      if (*g) lv_obj_clear_flag(s_cellTag[d][p], LV_OBJ_FLAG_HIDDEN); else lv_obj_add_flag(s_cellTag[d][p], LV_OBJ_FLAG_HIDDEN);
    }
    const char *lunch = day["lunch"] | "";
    bool duty = strcmp(kind, "teacher") == 0 && *lunch;
    lv_obj_set_style_bg_color(s_lunch[d], lv_color_hex(D_ROW), 0);
    lv_obj_set_style_border_color(s_lunch[d], lv_color_hex(duty ? 0xf59e0b : D_LINE), 0);
    lv_label_set_text(lv_obj_get_child(s_lunch[d], 0), duty ? "급식지도" : (*lunch ? lunch : "점심"));
    lv_obj_set_style_text_color(lv_obj_get_child(s_lunch[d], 0), lv_color_hex(duty ? 0xfcd34d : D_MUTED), 0);
  }
  for (int p = 0; p < 7; p++) {
    bool now = p == nowP;
    lv_obj_set_style_bg_color(s_pl[p], lv_color_hex(now ? NOW_TAG : D_PANEL), 0);
    lv_obj_set_style_text_color(lv_obj_get_child(s_pl[p], 0), lv_color_hex(now ? NOW_TX : D_SUB), 0);
  }
}

static void renderTT() { renderToday(); renderWeek(); }

// 파일을 '/x.tmp' 에 다 쓴 뒤 이름을 바꾼다(쓰는 도중 전원이 끊겨도 예전 파일이 남는다)
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

static bool loadTTFromFile() {
  File f = LittleFS.open("/tt.json", "r");
  if (!f) return false;
  JsonDocument tmp(&s_alloc);
  DeserializationError e = deserializeJson(tmp, f);
  f.close();
  if (e) { Serial.printf("tt.json parse: %s\n", e.c_str()); return false; }
  lock(); s_tt = std::move(tmp); unlock();   // 화면(LVGL)이 읽는 중에 바꾸지 않게
  s_ttName = String((const char *)(s_tt["name"] | ""));
  if (strcmp(s_tt["kind"] | "", "teacher") == 0) s_ttName += " 선생님";
  s_ttLoaded = true;
  return true;
}

// 시간표 파일을 받아 LittleFS 에 둔다. (인증서 확인은 아직 하지 않는다 — TODO: 루트 인증서 묶음)
static bool downloadTT() {
  if (!WiFi.isConnected()) return false;
  NetworkClientSecure client; client.setInsecure();
  HTTPClient http;
  String url = String(BASE_URL) + s_ttFile;
  if (!http.begin(client, url)) return false;
  // Firebase 는 조각(chunked)으로 보내는데, 조각 사이에서 읽기 시간 초과(-11)로 끊긴 적이 있다.
  // HTTP/1.0 으로 청해 한 덩어리(Content-Length)로 받고, 기다리는 시간도 늘린다.
  http.useHTTP10(true);
  http.setTimeout(15000);
  int code = http.GET();
  s_ttCode = code;
  bool ok = false;
  if (code == 200) {
    // 받다가 끊기면 반쪽 파일이 남는다 → 크기와 JSON 을 확인한 뒤에만 저장본을 바꾼다
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

// ── 시간표 목록 (board/index.json: 선생님·학급·특별실) ──
// 설정의 '볼 시간표'를 채우고, 고른 이름으로 파일(board/t/NNN.json)을 찾는다. 고른 것은 이름으로 저장한다(목록 차례가 바뀌어도 유지).
static JsonDocument s_index(&s_alloc);
static String s_pickName = BOARD_DEFAULT_TT;
// '볼 시간표' 고르기: 펼침 목록(스크롤·애니메이션이 느리고 88개를 위로 밀어 고르기 힘들었다) 대신
// 단추 판(한 쪽 30개, 6×5)을 쪽으로 넘긴다. 단추는 처음에 한 번만 만들고 글자만 바꾼다(2026-10-18 사용자 요청).
static lv_obj_t *s_pickView = nullptr, *s_pickBtn[30], *s_pickTab[2], *s_pickPage = nullptr;
static bool s_principal = false;   // 교장실 모드: s_pickName 이 '@교장'·'@교감' 이면 켜진다
// 위쪽 막대 왼쪽 제목: 교장실 모드면 '교장실'·'교감실'(전에 보던 선생님 이름이 남지 않게, 2026-10-18 사용자 요청)
static void setTopTitle() {
  if (!s_title) return;
  const char *t = s_principal ? (s_pickName == "@교감" ? "교감실" : "교장실") : s_ttName.length() ? s_ttName.c_str() : BOARD_TITLE;
  if (strcmp(lv_label_get_text(s_title), t)) lv_label_set_text(s_title, t);
}
static int s_pickKind = 0, s_pickPg = 0;   // 0: 선생님 · 1: 학급·특별실
static const char *pickLabel(JsonObject it) {   // 선생님은 이름만(단추가 짧게), 학급은 '1학년 1반'
  const char *kind = it["kind"] | "teacher", *lb = it["label"] | "";
  if (!strcmp(kind, "teacher") || !*lb) return it["name"] | "";
  return lb;
}
static void renderPicker() {
  if (!s_pickView) return;
  JsonArray items = s_index["items"].as<JsonArray>();
  int idx[160], n = 0, cnt[2] = {2, 0};
  if (s_pickKind == 0) { idx[n++] = -1; idx[n++] = -2; }   // 교장·교감 → 교장실 모드(학교 일정)
  int i = 0;
  for (JsonObject it : items) {
    const int k = strcmp(it["kind"] | "teacher", "teacher") ? 1 : 0;
    cnt[k]++;
    if (k == s_pickKind && n < 160) idx[n++] = i;
    i++;
  }
  const int pages = max(1, (n + 29) / 30);
  if (s_pickPg >= pages) s_pickPg = pages - 1;
  for (int t = 0; t < 2; t++) {
    const bool on = t == s_pickKind;
    lv_obj_set_style_bg_color(s_pickTab[t], lv_color_hex(on ? C_PRIMARY : C_ALT), 0);
    lv_obj_t *l = lv_obj_get_child(s_pickTab[t], 0);
    lv_label_set_text_fmt(l, "%s %d", t ? "학급·특별실" : "선생님", cnt[t]);
    lv_obj_set_style_text_color(l, lv_color_hex(on ? 0xffffff : C_MUTED), 0);
  }
  for (int b = 0; b < 30; b++) {
    const int k = s_pickPg * 30 + b;
    lv_obj_t *btn = s_pickBtn[b];
    if (k >= n) { lv_obj_add_flag(btn, LV_OBJ_FLAG_HIDDEN); continue; }
    const bool special = idx[k] < 0;
    const char *sname = idx[k] == -1 ? "@교장" : "@교감";
    JsonObject it = special ? JsonObject() : items[idx[k]].as<JsonObject>();
    const bool sel = special ? s_pickName == sname : s_pickName == (const char *)(it["name"] | "");
    lv_obj_clear_flag(btn, LV_OBJ_FLAG_HIDDEN);
    lv_obj_set_user_data(btn, (void *)(intptr_t)idx[k]);
    lv_obj_set_style_bg_color(btn, lv_color_hex(sel ? C_PRIMARY : special ? 0xfff4e0 : C_SURF), 0);
    lv_obj_t *l = lv_obj_get_child(btn, 0);
    lv_label_set_text(l, special ? sname + 1 : pickLabel(it));
    lv_obj_set_style_text_color(l, lv_color_hex(sel ? 0xffffff : C_TEXT), 0);
  }
  lv_label_set_text_fmt(s_pickPage, "%d / %d", s_pickPg + 1, pages);
}
static void setPrincipalTitles();
static void fillPicker() {
  s_principal = s_pickName.startsWith("@");
  setTopTitle();
  if (s_tabTT) lv_label_set_text(lv_obj_get_child(s_tabTT, 0), s_principal ? "학교 일정" : "시간표");
  if (s_principal && s_ttPick) {
    lv_label_set_text_fmt(lv_obj_get_child(s_ttPick, 0), "%s · 학교 일정  " LV_SYMBOL_RIGHT, s_pickName.c_str() + 1);
    setPrincipalTitles();
    renderPicker();
    return;
  }
  JsonArray items = s_index["items"].as<JsonArray>();
  if (items.isNull() || !s_ttPick) return;
  for (JsonObject it : items)
    if (s_pickName == (const char *)(it["name"] | "")) {
      s_ttFile = (const char *)(it["file"] | "");
      const char *lb = it["label"] | "";
      lv_label_set_text_fmt(lv_obj_get_child(s_ttPick, 0), "%s  " LV_SYMBOL_RIGHT, *lb ? lb : (const char *)(it["name"] | ""));
      s_pickKind = strcmp(it["kind"] | "teacher", "teacher") ? 1 : 0;
    }
  renderPicker();
}
static bool parseIndex(const String &body) {
  JsonDocument d(&s_alloc);
  if (deserializeJson(d, body) || d["items"].isNull()) return false;
  lock(); s_index = std::move(d); unlock();
  return true;
}
static bool downloadIndex() {
  if (!WiFi.isConnected()) return false;
  NetworkClientSecure client; client.setInsecure();
  HTTPClient http;
  if (!http.begin(client, String(BASE_URL) + "index.json")) return false;
  http.useHTTP10(true);
  http.setTimeout(15000);
  int code = http.GET();
  bool ok = false;
  if (code == 200) {
    String body = http.getString();
    if (parseIndex(body)) { saveAtomic("/index.json", body); ok = true; }
  }
  http.end();
  Serial.printf("index -> %d %s\n", code, ok ? "ok" : "fail");
  return ok;
}
static void loadIndexFromFile() {
  File f = LittleFS.open("/index.json", "r");
  if (!f) return;
  String body = f.readString(); f.close();
  parseIndex(body);
}
// ── 급식 (나이스 교육정보 개방 포털, 인증키 없이 하루치. 교육청·학교 코드는 board_config.h) ──
// 13:30 전에는 점심, 그 뒤에는 저녁(야자) 메뉴를 보인다. 받은 원문은 /meal.json 에 날짜와 함께 둔다.
static const char *MEAL_URL = "https://open.neis.go.kr/hub/mealServiceDietInfo?Type=json&ATPT_OFCDC_SC_CODE=" NEIS_ATPT_CODE "&SD_SCHUL_CODE=" NEIS_SCHOOL_CODE "&MLSV_YMD=";
static String s_mealDate, s_mLunch, s_mDinner, s_mLunchKcal, s_mDinnerKcal;

// "발아현미밥 <br/>감자탕 (5.6.9.10.13)<br/>..." → "발아현미밥 · 감자탕 · ..." (알레르기 번호 괄호는 뺀다)
static String cleanMenu(const char *raw) {
  String s(raw), out, item;
  s.replace("<br/>", "\n");
  s += "\n";
  for (size_t i = 0; i < s.length(); i++) {
    char ch = s[i];
    if (ch == '(') {                       // 괄호 안이 숫자·점·쉼표뿐이면 건너뛴다
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
  s_mLunch = s_mDinner = s_mLunchKcal = s_mDinnerKcal = "";
  s_mealDate = date;
  for (JsonObject r : d["mealServiceDietInfo"][1]["row"].as<JsonArray>()) {
    const char *kind = r["MMEAL_SC_NM"] | "";
    String menu = cleanMenu(r["DDISH_NM"] | ""), kcal = String((const char *)(r["CAL_INFO"] | ""));
    if (strcmp(kind, "중식") == 0) { s_mLunch = menu; s_mLunchKcal = kcal; }
    else if (strcmp(kind, "석식") == 0) { s_mDinner = menu; s_mDinnerKcal = kcal; }
  }
  return true;                              // 급식이 없는 날(주말)도 '받음'으로 본다
}
static bool downloadMeal() {
  if (!HAS_MEAL) return false;               // 학교 코드를 안 넣었으면 받지 않는다
  String date = todayIso();
  if (!WiFi.isConnected() || !date.length()) return false;
  String ymd = date; ymd.replace("-", "");
  NetworkClientSecure client; client.setInsecure();
  HTTPClient http;
  if (!http.begin(client, String(MEAL_URL) + ymd)) return false;
  http.useHTTP10(true);
  http.setTimeout(15000);
  int code = http.GET();
  bool ok = false;
  if (code == 200) {
    String body = http.getString();
    if (parseMeal(body, date)) {
      saveAtomic("/meal.json", String(date) + "\n", body);
      ok = true;
    }
  }
  http.end();
  Serial.printf("meal %s -> %d %s\n", ymd.c_str(), code, ok ? "ok" : "fail");
  return ok;
}
static void loadMealFromFile() {
  File f = LittleFS.open("/meal.json", "r");
  if (!f) return;
  String date = f.readStringUntil('\n'), body = f.readString();
  f.close();
  parseMeal(body, date);
}

// ── 날씨 (Open-Meteo, 열쇠 없음. 학교 위치는 board_config.h) ──
// 1시간마다 시간표와 함께 받는다. 받은 원문은 /wx.json 에 두어 켤 때 먼저 보인다.
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

// WMO 날씨 코드 → 그림 종류(0 해 1 해+구름 2 구름 3 비 4 눈 5 천둥 6 안개)
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
  s_wxNow = d["current"]["temperature_2m"] | NAN;
  s_wxNowCode = d["current"]["weather_code"] | -1;
  for (int i = 0; i < 2; i++) {
    s_wx[i].code = d["daily"]["weather_code"][i] | -1;
    s_wx[i].tmax = d["daily"]["temperature_2m_max"][i] | NAN;
    s_wx[i].tmin = d["daily"]["temperature_2m_min"][i] | NAN;
    s_wx[i].pop = d["daily"]["precipitation_probability_max"][i] | -1;
  }
  s_wxOk = s_wx[0].code >= 0;
  return s_wxOk;
}
static bool downloadWeather() {
  if (!HAS_WX || !WiFi.isConnected()) return false;
  NetworkClientSecure client; client.setInsecure();
  HTTPClient http;
  if (!http.begin(client, WX_URL)) return false;
  http.useHTTP10(true);
  http.setTimeout(15000);
  int code = http.GET();
  bool ok = false;
  if (code == 200) {
    String body = http.getString();
    if (parseWeather(body)) {
      saveAtomic("/wx.json", body);
      ok = true;
    }
  }
  http.end();
  Serial.printf("weather -> %d %s\n", code, ok ? "ok" : "fail");
  return ok;
}
static void loadWeatherFromFile() {
  File f = LittleFS.open("/wx.json", "r");
  if (!f) return;
  String body = f.readString();
  f.close();
  parseWeather(body);
}
static void renderWeather() {
  for (int i = 0; i < 2; i++) {
    WxCard &k = s_card[i];
    const WxDay &w = s_wx[i];
    const char *day = i == 0 ? "오늘" : "내일";
    if (!s_wxOk) {
      lv_obj_add_flag(k.img, LV_OBJ_FLAG_HIDDEN);
      lv_label_set_text(k.desc, day);
      lv_label_set_text(k.temp, "--");
      lv_label_set_text(k.hilo, HAS_WX ? "날씨 받는 중" : "위치 설정 필요");
      continue;
    }
    // 오늘은 지금 날씨·지금 기온, 내일은 하루 날씨·최고 기온을 크게. 윗줄에 최고/최저, 아랫줄에 날씨·비
    const int code = (i == 0 && s_wxNowCode >= 0) ? s_wxNowCode : w.code;
    const float big = i == 0 && !isnan(s_wxNow) ? s_wxNow : w.tmax;
    lv_obj_clear_flag(k.img, LV_OBJ_FLAG_HIDDEN);
    lv_img_set_src(k.img, wxIcon(code));
    if (isnan(w.tmax) || isnan(w.tmin)) lv_label_set_text(k.desc, day);
    else lv_label_set_text_fmt(k.desc, "%s  %d°/%d°", day, (int)lroundf(w.tmax), (int)lroundf(w.tmin));
    if (isnan(big)) lv_label_set_text(k.temp, "--");
    else lv_label_set_text_fmt(k.temp, "%d°", (int)lroundf(big));
    if (w.pop < 0) lv_label_set_text(k.hilo, wxName(code));
    else lv_label_set_text_fmt(k.hilo, "%s · #%s 비 %d%%#", wxName(code), w.pop >= 40 ? "60a5fa" : "94a3b8", w.pop);
  }
}

// ── 미세먼지 (Open-Meteo 대기질, 열쇠 없음) ──
// 등급은 환경부 기준. PM10: 좋음 ~30 · 보통 ~80 · 나쁨 ~150 · 매우나쁨. PM2.5: ~15 · ~35 · ~75 · 그 위. 둘 중 나쁜 쪽.
static const char *AIR_URL = "https://air-quality-api.open-meteo.com/v1/air-quality?latitude=" WEATHER_LAT "&longitude=" WEATHER_LON
                             "&current=pm10,pm2_5&timezone=Asia%2FSeoul";
static float s_pm10 = NAN, s_pm25 = NAN;
static bool parseAir(const String &body) {
  JsonDocument d(&s_alloc);
  if (deserializeJson(d, body)) return false;
  s_pm10 = d["current"]["pm10"] | NAN;
  s_pm25 = d["current"]["pm2_5"] | NAN;
  return !isnan(s_pm10) || !isnan(s_pm25);
}
static bool downloadAir() {
  if (!HAS_WX || !WiFi.isConnected()) return false;
  NetworkClientSecure client; client.setInsecure();
  HTTPClient http;
  if (!http.begin(client, AIR_URL)) return false;
  http.useHTTP10(true);
  http.setTimeout(15000);
  int code = http.GET();
  bool ok = false;
  if (code == 200) {
    String body = http.getString();
    if (parseAir(body)) { saveAtomic("/air.json", body); ok = true; }
  }
  http.end();
  Serial.printf("air -> %d %s\n", code, ok ? "ok" : "fail");
  return ok;
}
static void loadAirFromFile() {
  File f = LittleFS.open("/air.json", "r");
  if (!f) return;
  String body = f.readString(); f.close();
  parseAir(body);
}
static void renderAir() {
  if (!s_dust) return;
  if (!HAS_WX) { lv_label_set_text(s_dust, "#94a3b8 미세먼지: 위치 설정 필요#"); return; }
  if (isnan(s_pm10) && isnan(s_pm25)) { lv_label_set_text(s_dust, "#94a3b8 미세먼지 정보를 받는 중#"); return; }
  int g10 = isnan(s_pm10) ? 0 : s_pm10 <= 30 ? 0 : s_pm10 <= 80 ? 1 : s_pm10 <= 150 ? 2 : 3;
  int g25 = isnan(s_pm25) ? 0 : s_pm25 <= 15 ? 0 : s_pm25 <= 35 ? 1 : s_pm25 <= 75 ? 2 : 3;
  int g = g10 > g25 ? g10 : g25;
  static const char *NAME[4] = {"좋음", "보통", "나쁨", "매우 나쁨"};
  static const char *COLOR[4] = {"60a5fa", "34d399", "fb923c", "ef4444"};
  lv_label_set_text_fmt(s_dust, "#%s ● 미세먼지 %s#  #94a3b8 · PM10 %d · 초미세 %d#", COLOR[g], NAME[g],
                        isnan(s_pm10) ? 0 : (int)lroundf(s_pm10), isnan(s_pm25) ? 0 : (int)lroundf(s_pm25));
}

// 점심(13:30 전)·저녁(그 뒤) 메뉴
static void renderMeal() {
  if (!HAS_MEAL) { setTextIf(s_mealTitle, "급식"); setTextIf(s_meal, "급식 정보 설정 안 됨"); setTextIf(s_kcal, ""); return; }
  const bool today = s_mealDate.length() && s_mealDate == todayIso();
  const int nm = timeValid() ? nowMin() : 0;
  bool dinner = today && nm >= toMin("13:30") && s_mDinner.length();
  if (today && !s_mLunch.length() && s_mDinner.length()) dinner = true;
  setTextIf(s_mealTitle, dinner ? "저녁" : "점심");
  const String &menu = dinner ? s_mDinner : s_mLunch;
  const String &kcal = dinner ? s_mDinnerKcal : s_mLunchKcal;
  // 오늘 자료가 없을 때: 오늘 이미 받아 봤는데 없으면 '급식 없음'(주말·방학), 아직이면 '받는 중'
  if (!today) { setTextIf(s_meal, s_mealOk && s_lastOk ? "오늘은 급식 정보가 없습니다" : "급식 정보를 받는 중입니다"); setTextIf(s_kcal, ""); }
  else if (!menu.length()) { setTextIf(s_meal, "오늘은 급식이 없습니다"); setTextIf(s_kcal, ""); }
  else { setTextIf(s_meal, menu.c_str()); setTextIf(s_kcal, kcal.c_str()); }
}
// ── 와이파이 ──
// 와이파이가 켜져 있으면 PSRAM 을 같이 써서 화면이 흔들린다. 그래서 평소에는 꺼 두고,
// 1시간마다(그리고 켤 때·설정에서 와이파이를 고를 때) 잠깐 켜서 시간을 맞추고 시간표를 받은 뒤 끈다(사용자 지시 2026-09-30).
static void setStatus(const char *s) { setTextIf(s_status, s); }
// 수업 중인가(평일, 교시 시작 1분 전 ~ 끝). 수업 중에는 받기를 쉬는 시간으로 미룬다(받을 때 화면이 잠깐 깜빡이므로).
static bool inClassNow() {
  if (!timeValid()) return false;
  time_t t = time(nullptr); struct tm tm; localtime_r(&t, &tm);
  if (tm.tm_wday == 0 || tm.tm_wday == 6) return false;
  const int nm = tm.tm_hour * 60 + tm.tm_min;
  for (int p = 0; p < 7; p++) { int st = toMin(PERIOD_START[p]); if (nm >= st - 1 && nm < st + 50) return true; }
  return false;
}
static bool quietNow() {   // 밤(22:00~07:00)·주말: 2시간마다만 받는다
  if (!timeValid()) return false;
  time_t t = time(nullptr); struct tm tm; localtime_r(&t, &tm);
  return tm.tm_wday == 0 || tm.tm_wday == 6 || tm.tm_hour < 7 || tm.tm_hour >= 22;
}
static bool s_mealRetry = false;   // 오늘 급식을 못 받았을 때 10분 뒤 한 번 더(하루 한 번)
static uint32_t syncWaitMs() {
  if (s_mealRetry) return 10 * 60000UL;
  if (s_triedOnce && !timeValid()) return 60000UL;   // 시각을 모르면 시계·일정이 다 틀린다 → 1분마다 다시
  if (s_lastOk || s_failKind == FK_PARTIAL) return quietNow() ? 2 * 3600UL * 1000 : SYNC_EVERY_MS;
  if (s_failKind == FK_NOTFOUND) return 6 * 3600UL * 1000;
  static const uint8_t BACKOFF_MIN[] = {2, 4, 8, 16, 32, 60};
  int i = s_failCount > 0 ? s_failCount - 1 : 0; if (i > 5) i = 5;
  return BACKOFF_MIN[i] * 60000UL;
}
static void refreshWifiLabel() {
  String ssid = s_prefs.getString("ssid", "");
  if (!ssid.length()) {
    setTextIf(s_wifiLbl, "와이파이 없음");
    lv_obj_set_style_text_color(s_wifiLbl, lv_color_hex(C_ROSE), 0);
    lv_label_set_text(s_wifiInfo, "저장한 와이파이가 없습니다. [찾기]를 누르고 목록에서 고르세요.");
    return;
  }
  if (s_sync != SYNC_IDLE) {
    setTextIf(s_wifiLbl, "받는 중…");
    lv_obj_set_style_text_color(s_wifiLbl, lv_color_hex(0xb45309), 0);
    lv_label_set_text_fmt(s_wifiInfo, "'%s'에 잠깐 연결해 시간과 시간표를 받는 중입니다.", ssid.c_str());
    return;
  }
  // 위쪽 막대: 한 번 실패는 조용히 넘긴다(마지막 성공 시각 그대로). 잇따라 2번째 실패부터 주황.
  const bool noUrl = urlUnset() && s_triedOnce && s_lastOk;   // 시간은 맞췄지만 시간표 주소가 없다
  char top[48]; uint32_t col = C_EMERALD;
  if (!s_triedOnce) snprintf(top, sizeof top, "대기");
  else if (noUrl) { snprintf(top, sizeof top, "시간표 주소 없음"); col = D_MUTED; }
  else if (s_lastOk) snprintf(top, sizeof top, "%s 받음", s_lastHM);
  else if (s_failKind == FK_NOTFOUND) { snprintf(top, sizeof top, "시간표 주소 확인"); col = 0xfb923c; }
  else if (s_failCount < 2 && (s_lastOkHM[0] || s_lastOkT)) { char st[16]; okStamp(st, sizeof st); snprintf(top, sizeof top, "%s 받음", st);
    if (timeValid() && s_lastOkT && time(nullptr) - s_lastOkT > 26 * 3600) col = 0xfb923c; }   // 하루 넘게 못 받음
  else if (s_failCount < 2) { snprintf(top, sizeof top, "대기"); }
  else { snprintf(top, sizeof top, "%s 연결 안 됨", s_lastHM); col = 0xfb923c; }
  setTextIf(s_wifiLbl, top);
  lv_obj_set_style_text_color(s_wifiLbl, lv_color_hex(col), 0);
  // 설정 화면: 준비 상태 점검표 + 다음 받기 시각
  char next[24] = "";
  if (s_triedOnce && timeValid()) {
    const uint32_t w = syncWaitMs(), gone = millis() - s_lastSync;
    time_t t = time(nullptr) + (time_t)((gone < w ? w - gone : 0) / 1000);
    struct tm tm; localtime_r(&t, &tm); snprintf(next, sizeof next, "%02d:%02d", tm.tm_hour, tm.tm_min);
  }
  const char *tt = urlUnset() ? "주소 없음" : s_ttLoaded ? "O" : s_failKind == FK_NOTFOUND ? "파일 없음" : "아직";
  char info[320];
  snprintf(info, sizeof info,
           "'%s' 저장됨. 잠깐 연결해 받고 바로 끕니다(수업 중에는 쉬는 시간에 받습니다).\n"
           "와이파이 %s · 시간 %s · 날씨 %s · 급식 %s · 시간표 %s\n"
           "마지막 받음 %s%s%s%s",
           ssid.c_str(), s_lastOkHM[0] ? "O" : (s_triedOnce ? "실패" : "아직"), timeValid() ? "O" : "아직",
           !HAS_WX ? "설정 없음" : s_wxOk ? "O" : "아직", !HAS_MEAL ? "설정 없음" : s_mealOk ? "O" : "아직", tt,
           s_lastOkHM[0] ? s_lastOkHM : (s_lastOkT ? "전에 받음" : "-"), next[0] ? " · 다음 받기 " : "", next,
           s_batPct >= 0 ? (String(" · 배터리 ") + s_batPct + "%").c_str() : "");
  setTextIf(s_wifiInfo, info);
}

static void wifiOff() { if (WiFi.getMode() == WIFI_OFF) return; WiFi.disconnect(true, false); WiFi.mode(WIFI_OFF); }

// 연결이 끊긴 이유(ESP-IDF 이유 코드). 실패하면 설정 화면과 기록에 사람 말로 남긴다.
static volatile int s_wifiReason = 0;
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
static bool s_retried = false;   // 한 번의 동기화 안에서 다시 붙어 본 적이 있는지
static void wifiBegin() {
  String ssid = s_prefs.getString("ssid", ""), pw = s_prefs.getString("pw", "");
  // 학교처럼 같은 이름의 공유기가 여러 대면, 모든 채널을 훑어 신호가 가장 센 공유기에 붙는다
  WiFi.setScanMethod(WIFI_ALL_CHANNEL_SCAN);
  WiFi.setSortMethod(WIFI_CONNECT_AP_BY_SIGNAL);
  WiFi.begin(ssid.c_str(), pw.c_str());
  WiFi.setSleep(false);          // 잠깐 켜 있는 동안은 무선 절전을 끄고 확실히 붙는다
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
  lock(); refreshWifiLabel(); setStatus("연결하는 중…"); unlock();
  lcdSlow(true);                 // 받는 동안 화면 박자를 낮춘다(매뉴얼)
  WiFi.persistent(false);        // Arduino 의 자체 저장본은 쓰지 않는다(설정 저장본 하나만)
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(false);
  s_wifiReason = 0; s_retried = false;
  wifiBegin();
  s_sync = SYNC_CONNECTING; s_syncStart = millis();
  Serial.printf("sync: connecting %s (internal free %u, largest %u)\n", ssid.c_str(),
                (unsigned)heap_caps_get_free_size(MALLOC_CAP_INTERNAL), (unsigned)heap_caps_get_largest_free_block(MALLOC_CAP_INTERNAL));
}
static void setPrincipalTitles();
static void refreshStale() {   // 동기화가 끝날 때·분이 바뀔 때만 부른다
  char b[64]; const bool st = staleText(b, sizeof b);
  if (s_stale) { if (st) { setTextIf(s_stale, b); lv_obj_clear_flag(s_stale, LV_OBJ_FLAG_HIDDEN); } else if (!lv_obj_has_flag(s_stale, LV_OBJ_FLAG_HIDDEN)) lv_obj_add_flag(s_stale, LV_OBJ_FLAG_HIDDEN); }
  setPrincipalTitles();
}
static void finishSync(bool ok, const char *msg) {
  s_triedOnce = true; s_lastOk = ok; s_lastSync = millis();
  s_failCount = ok ? 0 : s_failCount + 1;
  if (ok) s_failKind = FK_NONE;
  if (timeValid()) { time_t t = time(nullptr); struct tm tm; localtime_r(&t, &tm); snprintf(s_lastHM, sizeof s_lastHM, "%02d:%02d", tm.tm_hour, tm.tm_min); }
  if (ok) memcpy(s_lastOkHM, s_lastHM, sizeof s_lastOkHM);
  {   // 시간표·일정은 받았는데 오늘 급식만 못 받았으면 10분 뒤 한 번 더(낮에만, 하루 한 번)
    static String retried;
    const String td = todayIso();
    s_mealRetry = ok && HAS_MEAL && td.length() && s_mealDate != td && retried != td && !quietNow();
    if (s_mealRetry) retried = td;
  }
  if (ok && timeValid()) { s_lastOkT = time(nullptr); s_prefs.putULong("lastok", (uint32_t)s_lastOkT); }   // 성공할 때 한 번만 쓴다
  if (!ok) Serial.printf("sync fail #%d: %s\n", s_failCount, msg);
  Serial.printf("heap: internal free %u, largest %u\n", (unsigned)heap_caps_get_free_size(MALLOC_CAP_INTERNAL), (unsigned)heap_caps_get_largest_free_block(MALLOC_CAP_INTERNAL));
  wifiOff();
  lcdSlow(false);                // 되돌리고 박자를 다시 맞춘다
  s_sync = SYNC_IDLE;
  Serial.printf("sync: %s (%s)\n", ok ? "ok" : "fail", msg);
  lock(); refreshWifiLabel(); setStatus(msg); refreshStale(); unlock();
}

// 설정에서 와이파이를 고르면 저장하고 바로 한 번 받아 온다
static void connectWifi(const String &ssid, const String &pw, bool save) {
  if (save) { s_prefs.putString("ssid", ssid); s_prefs.putString("pw", pw); }
  if (s_sync != SYNC_IDLE) wifiOff();
  s_sync = SYNC_IDLE;
  s_syncReq = true;
}
static void onPwOk(lv_event_t *e);
static void pwShow(bool on) {   // 비밀번호 창·자판·뒤 막을 함께 열고 닫는다
  lv_obj_t *o[] = {s_pwBg, s_pwBox, s_kb};
  for (lv_obj_t *x : o) if (x) { if (on) { lv_obj_clear_flag(x, LV_OBJ_FLAG_HIDDEN); lv_obj_move_foreground(x); } else lv_obj_add_flag(x, LV_OBJ_FLAG_HIDDEN); }
}
static void pwCancel(lv_event_t *) {   // 비밀번호를 모르는 와이파이를 잘못 골랐을 때: 닫고 목록으로
  lv_textarea_set_text(s_pwTa, "");
  pwShow(false);
  lv_label_set_text(s_wifiInfo, "취소했습니다. 목록에서 다른 와이파이를 고르세요.");
}
static void onSsidPick(lv_event_t *e) {
  lv_obj_t *btn = lv_event_get_target(e);
  s_pickSsid = String(lv_list_get_btn_text(s_wifiList, btn));
  int sp = s_pickSsid.lastIndexOf("  (");
  if (sp > 0) s_pickSsid = s_pickSsid.substring(0, sp);
  // 비밀번호 없는(개방형) 와이파이는 묻지 않고 바로 연결한다
  if ((intptr_t)lv_obj_get_user_data(btn) == 1) {
    lv_label_set_text_fmt(s_wifiInfo, "'%s'에 연결하는 중… (비밀번호 없음)", s_pickSsid.c_str());
    connectWifi(s_pickSsid, "", true);
    return;
  }
  lv_label_set_text_fmt(lv_obj_get_child(s_pwBox, 0), "'%s' 비밀번호", s_pickSsid.c_str());
  lv_textarea_set_text(s_pwTa, "");
  pwShow(true);
}
static void onPwOk(lv_event_t *e) {
  lv_event_code_t code = lv_event_get_code(e);
  if (code == LV_EVENT_READY) {
    String pw = lv_textarea_get_text(s_pwTa);
    if (!pw.length()) { pwCancel(e); return; }   // 빈 채로 입력을 누르면 취소(빈 비밀번호를 저장하지 않는다)
    pwShow(false);
    lv_label_set_text_fmt(s_wifiInfo, "'%s'에 연결하는 중…", s_pickSsid.c_str());
    connectWifi(s_pickSsid, pw, true);
  } else if (code == LV_EVENT_CANCEL) pwCancel(e);   // 자판의 닫기 단추
}
static volatile bool s_scanReq = false;
static void onScan(lv_event_t *e) { s_scanReq = true; lv_obj_clean(s_wifiList); lv_list_add_text(s_wifiList, "찾는 중…"); }
static void onForget(lv_event_t *e) {   // 실수로 지우지 않게: 3초 안에 한 번 더 눌러야 지운다
  static uint32_t armed = 0;
  lv_obj_t *b = lv_event_get_current_target(e);
  if (!armed || millis() - armed > 3000) { armed = millis(); lv_label_set_text(lv_obj_get_child(b, 0), "한 번 더 누르면 지웁니다"); return; }
  armed = 0; lv_label_set_text(lv_obj_get_child(b, 0), "저장한 와이파이 지우기");
  s_prefs.remove("ssid"); s_prefs.remove("pw"); wifiOff(); s_sync = SYNC_IDLE; refreshWifiLabel();
}

// 화면: 0 주간 시간표 · 1 설정 · 2 시계 모드 · 3 선생님 찾기
enum View { V_WEEK = 0, V_SET = 1, V_CLOCK = 2, V_FIND = 3 };
static View s_view = V_CLOCK;   // 켜면 시계 화면(교장 모드면 교장 화면)

// ── 선생님 찾기 (board/where.json: 선생님 전체 × 오늘부터 수업일 10일) ──
// 이름을 누르면 지금 어디 계신지(교실·과목 / 공강 / 수업 끝)와 다음 수업, 오늘 시간표를 보인다.
static JsonDocument s_where(&s_alloc);
static lv_obj_t *s_viewFind, *s_tabFind, *s_findGrid, *s_findName, *s_findHome, *s_findNowT, *s_findNow, *s_findNext, *s_findDay;
static lv_obj_t *s_findRow[7], *s_findRowP[7], *s_findRowT[7];
static String s_findSel;
static bool s_findGridDirty = true;   // 단추를 (다시) 만들어야 하는지 — 찾기 탭을 열 때 만든다
static bool parseWhere(const String &body) {
  JsonDocument d(&s_alloc);
  if (deserializeJson(d, body) || d["teachers"].isNull()) return false;
  lock(); s_where = std::move(d); unlock();
  return true;
}
static bool downloadWhere() {
  if (!WiFi.isConnected()) return false;
  NetworkClientSecure client; client.setInsecure();
  HTTPClient http;
  if (!http.begin(client, String(BASE_URL) + "where.json")) return false;
  http.useHTTP10(true);
  http.setTimeout(20000);
  int code = http.GET();
  bool ok = false;
  if (code == 200) {
    String body = http.getString();
    if (parseWhere(body)) { saveAtomic("/where.json", body); ok = true; }
  }
  http.end();
  Serial.printf("where -> %d %s\n", code, ok ? "ok" : "fail");
  return ok;
}
static void loadWhereFromFile() {
  File f = LittleFS.open("/where.json", "r");
  if (!f) return;
  String body = f.readString(); f.close();
  parseWhere(body);
}
// "n:102 수학" → 종류 'n', 글 "102 수학"
static char whereKind(const char *s) { return (s && s[0] && s[1] == ':') ? s[0] : 0; }
static const char *whereText(const char *s) { return (s && s[0] && s[1] == ':') ? s + 2 : ""; }

static void renderFinder() {
  if (!s_viewFind) return;
  JsonArray dates = s_where["dates"].as<JsonArray>();
  JsonObject who;
  for (JsonObject t : s_where["teachers"].as<JsonArray>()) if (s_findSel == (const char *)(t["n"] | "")) { who = t; break; }
  if (who.isNull()) {
    lv_label_set_text(s_findName, dates.isNull() ? "자료를 받는 중" : "선생님을 고르세요");
    lv_label_set_text(s_findHome, ""); lv_label_set_text(s_findNowT, ""); lv_label_set_text(s_findNow, "");
    lv_label_set_text(s_findNext, ""); lv_label_set_text(s_findDay, "");
    for (int p = 0; p < 7; p++) lv_obj_add_flag(s_findRow[p], LV_OBJ_FLAG_HIDDEN);
    return;
  }
  lv_label_set_text_fmt(s_findName, "%s 선생님", s_findSel.c_str());
  const char *home = who["h"] | "";
  lv_label_set_text(s_findHome, *home ? (String("담임 ") + home).c_str() : "");

  // 오늘(없으면 다음 수업일)
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
    lv_obj_clear_flag(s_findRow[p], LV_OBJ_FLAG_HIDDEN);
    lv_obj_set_style_bg_color(s_findRow[p], lv_color_hex(now ? NOW_ROW : D_ROW), 0);
    lv_obj_set_style_border_color(s_findRow[p], lv_color_hex(now ? NOW_ROW : (k ? styleOf(k).border : D_LINE)), 0);
    lv_obj_set_style_text_color(s_findRowP[p], lv_color_hex(now ? C_MUTED : D_MUTED), 0);
    lv_label_set_text(s_findRowT[p], k ? whereText(c) : "공강");
    lv_obj_set_style_text_color(s_findRowT[p], lv_color_hex(now ? C_TEXT : (k ? D_TEXT : D_MUTED)), 0);
  }
}
static void onFindPick(lv_event_t *e) {
  lv_obj_t *b = lv_event_get_target(e);
  s_findSel = lv_label_get_text(lv_obj_get_child(b, 0));
  renderFinder();
}
// 이름 단추를 where.json 의 선생님으로 채운다(가나다순)
static void fillFinderGrid() {
  if (!s_findGrid) return;
  if (s_view != V_FIND) { s_findGridDirty = true; return; }   // 보이지 않으면 나중에
  s_findGridDirty = false;
  lv_obj_clean(s_findGrid);
  for (JsonObject t : s_where["teachers"].as<JsonArray>()) {
    lv_obj_t *b = lv_btn_create(s_findGrid);
    lv_obj_set_size(b, 96, 40);
    lv_obj_set_style_bg_color(b, lv_color_hex(D_ROW), 0);
    lv_obj_set_style_border_width(b, 1, 0);
    lv_obj_set_style_border_color(b, lv_color_hex(D_LINE), 0);
    lv_obj_set_style_shadow_width(b, 0, 0);
    lv_obj_set_style_radius(b, R(8), 0);
    lv_obj_t *l = lv_label_create(b);
    lv_obj_set_style_text_font(l, &kr16, 0);
    lv_obj_set_style_text_color(l, lv_color_hex(D_TEXT), 0);
    lv_label_set_text(l, t["n"] | "");
    lv_obj_center(l);
    lv_obj_add_event_cb(b, onFindPick, LV_EVENT_CLICKED, nullptr);
  }
}
static lv_obj_t *s_findGridParent = nullptr;
static void buildFinder(lv_obj_t *scr, int top) {
  const int M = 12, H = s_H - top;
  s_viewFind = box(scr, D_BG, 0, 0);
  lv_obj_set_size(s_viewFind, s_W, H); lv_obj_set_pos(s_viewFind, 0, top);
  lv_obj_add_flag(s_viewFind, LV_OBJ_FLAG_HIDDEN);
  const int LW = 440, PH = H - 2 * M + 4;
  lv_obj_t *left = box(s_viewFind, D_PANEL, D_LINE, 16);
  lv_obj_set_size(left, LW, PH); lv_obj_set_pos(left, M, M - 4);
  lv_obj_set_pos(label(left, &kr14, D_MUTED, "선생님을 고르세요"), 16, 12);
  s_findGridParent = left;
  s_findGrid = lv_obj_create(left);
  lv_obj_clear_flag(s_findGrid, LV_OBJ_FLAG_SCROLL_MOMENTUM | LV_OBJ_FLAG_SCROLL_ELASTIC);
  lv_obj_remove_style_all(s_findGrid);
  lv_obj_set_size(s_findGrid, LW - 20, PH - 44); lv_obj_set_pos(s_findGrid, 10, 36);
  lv_obj_set_flex_flow(s_findGrid, LV_FLEX_FLOW_ROW_WRAP);
  lv_obj_set_style_pad_gap(s_findGrid, 8, 0);
  lv_obj_set_style_pad_all(s_findGrid, 4, 0);
  lv_obj_add_flag(s_findGrid, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_scroll_dir(s_findGrid, LV_DIR_VER);

  const int RX = M + LW + M, RW = s_W - RX - M;
  lv_obj_t *right = box(s_viewFind, D_PANEL, D_LINE, 16);
  lv_obj_set_size(right, RW, PH); lv_obj_set_pos(right, RX, M - 4);
  s_findName = label(right, &kr20, D_TEXT, "");
  lv_obj_set_pos(s_findName, 16, 14);
  s_findHome = label(right, &kr14, D_MUTED, "");
  lv_obj_align(s_findHome, LV_ALIGN_TOP_RIGHT, -16, 18);
  lv_obj_t *nowBox = box(right, C_PRIMARY, 0, 12);
  lv_obj_set_style_bg_grad_color(nowBox, lv_color_hex(0x3730a3), 0);
  lv_obj_set_style_bg_grad_dir(nowBox, UI_FANCY ? LV_GRAD_DIR_HOR : LV_GRAD_DIR_NONE, 0);
  lv_obj_set_size(nowBox, RW - 24, 64); lv_obj_set_pos(nowBox, 12, 46);
  s_findNowT = label(nowBox, &kr14, 0xfecaca, "");
  lv_obj_set_pos(s_findNowT, 14, 9);
  s_findNow = label(nowBox, &kr20, 0xffffff, "");
  lv_obj_set_width(s_findNow, RW - 52); lv_label_set_long_mode(s_findNow, LV_LABEL_LONG_DOT);
  lv_obj_set_pos(s_findNow, 14, 31);
  s_findNext = label(right, &kr14, D_SUB, "");
  lv_obj_set_width(s_findNext, RW - 32); lv_label_set_long_mode(s_findNext, LV_LABEL_LONG_DOT);
  lv_obj_set_pos(s_findNext, 16, 120);
  s_findDay = label(right, &kr14, D_MUTED, "");
  lv_obj_set_pos(s_findDay, 16, 146);
  for (int p = 0; p < 7; p++) {
    s_findRow[p] = box(right, D_ROW, D_LINE, 6);
    lv_obj_set_size(s_findRow[p], RW - 24, 30); lv_obj_set_pos(s_findRow[p], 12, 168 + p * 34);
    s_findRowP[p] = label(s_findRow[p], &kr14, D_MUTED, "");
    lv_label_set_text_fmt(s_findRowP[p], "%d교시", p + 1);
    lv_obj_align(s_findRowP[p], LV_ALIGN_LEFT_MID, 10, 0);
    s_findRowT[p] = label(s_findRow[p], &kr14, D_TEXT, "");
    lv_obj_set_width(s_findRowT[p], RW - 24 - 72); lv_label_set_long_mode(s_findRowT[p], LV_LABEL_LONG_DOT);
    lv_obj_align(s_findRowT[p], LV_ALIGN_LEFT_MID, 62, 0);
    lv_obj_add_flag(s_findRow[p], LV_OBJ_FLAG_HIDDEN);
  }
}

// ── 탭 ──
// 화면: 0 주간 시간표 · 1 설정 · 2 시계 모드(화면 전체, 누르면 주간으로)
static void tabStyle(lv_obj_t *tab, bool on) {
#if UI_SOFT   // 면을 바꾸지 않고 아래 밑줄(호박색)과 글자 밝기로만 표시 — 부드럽고, 다시 그리는 넓이도 작다
  lv_obj_set_style_bg_color(tab, lv_color_hex(D_ROW), 0);
  lv_obj_set_style_border_side(tab, LV_BORDER_SIDE_BOTTOM, 0);
  lv_obj_set_style_border_width(tab, on ? 4 : 0, 0);
  lv_obj_set_style_border_color(tab, lv_color_hex(NOW_TAG), 0);
  lv_obj_set_style_text_color(lv_obj_get_child(tab, 0), lv_color_hex(on ? D_TEXT : D_MUTED), 0);
  return;
#endif
  lv_obj_set_style_bg_color(tab, lv_color_hex(on ? D_LINE : D_ROW), 0);
  lv_obj_set_style_text_color(lv_obj_get_child(tab, 0), lv_color_hex(on ? D_TEXT : D_MUTED), 0);
}
// ── 교장실 모드 (볼 시간표에서 '교장'·'교감'을 고르면 켜진다, 2026-10-18) ──
// 평소 시계 화면 대신: 왼쪽 큰 시계·날짜·'학교 지금'(교시 링 + 수업 중/아닌 선생님 수, 개인별 위치는 안 보임)·날씨·급식,
// 오른쪽 오늘 일정(학교 일정 사이트, SCHEDULE_URL)·야외 활동 안전 신호등·교장실 상태(접견 중/곧 도착/자유).
// 학교 일정 사이트(Apps Script)는 JSON 주소가 따로 없어서, 페이지에 들어 있는 init-data JSON 을 꺼내 쓴다:
//   ① goog.script.init(" … ", " 사이 ② JS 이스케이프 풀기 ③ "userHtml":" 문자열 ④ JSON 이스케이프 풀기 ⑤ init-data JSON
// (tools/sched_extract.py 로 같은 순서를 PC 에서 검증했다)
static void showView(View v);
static void onSchedRow(lv_event_t *e);
static void onTeachOpen(lv_event_t *e);
static void renderSchedList();
static JsonDocument s_sched(&s_alloc);              // {"items":[[날짜, 끝날짜, 시간, 제목, 장소, 부서, 담당, 내용], …], "acad":[[날짜, 이름, 종류], …]}
static lv_obj_t *s_viewPrin = nullptr, *s_pClock, *s_pDate, *s_pNowA, *s_pNowB, *s_pNowC, *s_pNowN, *s_pRing, *s_pWx, *s_pWx2, *s_pMeal, *s_pNews;
static const int P_ROWS = 8;   // 학교 일정 줄 수(오늘부터 다가오는 날까지)
static lv_obj_t *s_pRow[P_ROWS], *s_pRowT[P_ROWS], *s_pRowA[P_ROWS], *s_pRowB[P_ROWS], *s_pAcad[3], *s_pTitle;

// JS/JSON 이스케이프 풀기: \xNN(글자 0~255) \uNNNN \n \r \t, 그 밖은 다음 글자 그대로. stopAtQuote 면 따옴표에서 멈춘다.
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
      if (e == 'x' && i + 3 < n) { put(hex(s + i + 2, 2)); i += 4; continue; }   // 글자(코드포인트) — PC 검증과 같은 뜻
      if (e == 'u' && i + 5 < n) { put(hex(s + i + 2, 4)); i += 6; continue; }
      out += (e == 'n') ? (char)10 : (e == 'r') ? (char)13 : (e == 't') ? (char)9 : e;
      i += 2; continue;
    }
    out += c; i++;
  }
}
// \xNN 은 0x80~0xFF 도 '글자'(Latin-1)라서, 그 바이트를 UTF-8 로 다시 써야 하는 경우는 한글 쪽엔 없다(한글은 이미 UTF-8 로 들어 있다).

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
  if (!WiFi.isConnected() || !cfgSet(SCHEDULE_URL) || !timeValid()) return false;   // 오늘 날짜를 모르면 거를 수 없다
  NetworkClientSecure client; client.setInsecure();
  HTTPClient http;
  if (!http.begin(client, SCHEDULE_URL)) return false;
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);   // script.google.com → script.googleusercontent.com
  http.useHTTP10(true);
  http.setTimeout(20000);
  const int code = http.GET();
  bool ok = false;
  if (code == 200) {
    String raw = http.getString();                            // 약 150KB(PSRAM)
    const int a0 = raw.indexOf("goog.script.init(\"");
    const int a1 = a0 >= 0 ? raw.indexOf("\", \"", a0) : -1;
    if (a0 >= 0 && a1 > a0) {
      String A; unescJs(raw.c_str() + a0 + 18, a1 - a0 - 18, A, false);
      raw = String();                                         // 메모리 돌려주기
      const int k = A.indexOf("\"userHtml\":\"");
      if (k >= 0) {
        String B; unescJs(A.c_str() + k + 12, A.length() - k - 12, B, true);
        A = String();
        const int j = B.indexOf("type=\"application/json\">");
        if (j >= 0) {
          JsonDocument src(&s_alloc);
          if (!deserializeJson(src, B.c_str() + j + 24)) {
            // 오늘 하루 전 ~ 14일 뒤 일정, 오늘 ~ 60일 뒤 학사 일정만 남긴다
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
            // 학사 일정은 날짜순으로 넣는다(사이트 순서가 날짜순이 아닐 수 있다)
            for (JsonObject x : src["academic"].as<JsonArray>()) {
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
// 오늘 쉬는 날인지(주말 · 교장 모드는 학사 일정의 '휴' · 교사 모드는 시간표의 holiday). name 에 이유
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

// 일정의 '시간' 글(예: "7교시", "점심시간", "13:00~13:30", "")을 정렬용 분으로
static int schedMin(const char *t) {
  if (!*t) return -1;                                          // 종일 → 맨 앞
  if (strstr(t, "점심")) return toMin("12:30");
  const char *g = strstr(t, "교시");
  if (g && g > t && isdigit((unsigned char)g[-1])) { const int p = g[-1] - '1'; if (p >= 0 && p < 7) return toMin(PERIOD_START[p]); }
  if (isdigit((unsigned char)t[0]) && t[1] && (t[2] == ':' || t[1] == ':')) { const int h = atoi(t), m = atoi(strchr(t, ':') + 1); return h * 60 + m; }
  return 24 * 60;
}
// 끝나는 분: '13:00~13:30' 은 끝 시각, 교시는 +50, 점심은 +60, 시각 하나면 +60, 모르면 -1
static int schedEnd(const char *t, int st) {
  if (st < 0 || st >= 24 * 60) return -1;
  const char *sep = strpbrk(t, "~-");
  if (sep) { const char *q = sep + 1; while (*q == ' ') q++; if (isdigit((unsigned char)q[0]) && strchr(q, ':')) { const int e = atoi(q) * 60 + atoi(strchr(q, ':') + 1); if (e > st) return e; } }
  if (strstr(t, "교시")) return st + 50;
  return st + 60;
}

static lv_obj_t *s_pAmPm = nullptr;
static void renderPrincipal() {
  if (!s_viewPrin) return;
  const bool tv = timeValid();
  const int nm = tv ? nowMin() : -1;
  // 시계·날짜는 시계 화면과 같은 글을 쓴다
  lv_label_set_text(s_pClock, lv_label_get_text(s_big));
  lv_label_set_text(s_pDate, lv_label_get_text(s_bigDate));
  if (s_pAmPm) {   // 12시간제면 '오후'를 숫자 왼쪽 아래에(시계 화면과 같게)
    const char *ap = lv_label_get_text(s_bigAmPm);
    if (*ap && !lv_obj_has_flag(s_bigAmPm, LV_OBJ_FLAG_HIDDEN)) {
      lv_label_set_text(s_pAmPm, ap); lv_obj_clear_flag(s_pAmPm, LV_OBJ_FLAG_HIDDEN);
      lv_obj_update_layout(s_pClock); lv_obj_align_to(s_pAmPm, s_pClock, LV_ALIGN_OUT_LEFT_BOTTOM, -8, -14);
    } else lv_obj_add_flag(s_pAmPm, LV_OBJ_FLAG_HIDDEN);
  }
  // 학교 지금
  int nowP = -1, nextP = -1;
  for (int p = 0; p < 7; p++) { const int st = toMin(PERIOD_START[p]); if (nm >= st && nm < st + 50) nowP = p; if (nextP < 0 && st > nm) nextP = p; }
  const bool lunch = nm >= toMin("12:30") && nm < toMin("13:30");
  time_t tt0 = time(nullptr); struct tm tmn; localtime_r(&tt0, &tmn);
  String offName; const bool weekend = isOffDay(&offName);   // 주말·휴업일
  (void)tmn;
  int ring = 0;   // 0~100
  if (!tv) { lv_label_set_text(s_pNowA, "시각을 맞추는 중"); lv_label_set_text(s_pNowB, ""); lv_label_set_text(s_pNowN, "-"); }
  else if (weekend) { lv_label_set_text(s_pNowA, offName == "주말" ? "주말" : "휴업일"); lv_label_set_text(s_pNowB, offName == "주말" ? "수업 없음" : offName.c_str()); lv_label_set_text(s_pNowN, "-"); }
  else if (nowP >= 0) {
    const int end = toMin(PERIOD_START[nowP]) + 50; ring = (end - nm) * 100 / 50;
    lv_label_set_text_fmt(s_pNowA, "%d교시 수업 중", nowP + 1);
    if (nextP >= 0) lv_label_set_text_fmt(s_pNowB, "%d분 남음 · %d교시 %s", end - nm, nextP + 1, PERIOD_START[nextP]);
    else lv_label_set_text_fmt(s_pNowB, "%d분 남음 · 마지막 교시", end - nm);
    lv_label_set_text_fmt(s_pNowN, "%d", nowP + 1);
  } else if (lunch) { ring = (toMin("13:30") - nm) * 100 / 60; lv_label_set_text(s_pNowA, "점심시간"); lv_label_set_text_fmt(s_pNowB, "%d분 남음 · 5교시 13:30", toMin("13:30") - nm); lv_label_set_text(s_pNowN, "점"); }
  else if (nextP >= 0) { ring = 100; lv_label_set_text(s_pNowA, nm < toMin(PERIOD_START[0]) ? "수업 전" : "쉬는 시간"); lv_label_set_text_fmt(s_pNowB, "%d교시 %s 시작", nextP + 1, PERIOD_START[nextP]); lv_label_set_text_fmt(s_pNowN, "%d", nextP + 1); }
  else { lv_label_set_text(s_pNowA, "수업 끝"); lv_label_set_text(s_pNowB, "방과 후"); lv_label_set_text(s_pNowN, "-"); }
  lv_arc_set_value(s_pRing, ring);
  // 수업 중인 선생님 수(where.json 의 오늘 칸에서 셈 — 이름은 쓰지 않는다)
  {
    int inClass = 0, total = 0, di = -1;
    const String td = todayIso();
    JsonArray dates = s_where["dates"].as<JsonArray>();
    for (int i = 0; i < (int)dates.size(); i++) if (td == (const char *)(dates[i] | "")) di = i;
    const int bp = weekend ? -1 : nowP >= 0 ? nowP : nextP;   // 쉬는 시간·점심·수업 전이면 다음 교시 기준
    for (JsonObject t : s_where["teachers"].as<JsonArray>()) {
      total++;
      if (di >= 0 && bp >= 0 && teachingCell(t["d"][di][bp] | "")) inClass++;
    }
    if (total && di >= 0 && nowP >= 0 && !weekend) lv_label_set_text_fmt(s_pNowC, "수업 중 %d명 · 수업 없음 %d명  " LV_SYMBOL_RIGHT, inClass, total - inClass);
    else if (total && di >= 0 && bp >= 0) lv_label_set_text_fmt(s_pNowC, "다음 %d교시 수업 %d명  " LV_SYMBOL_RIGHT, bp + 1, inClass);
    else if (total) lv_label_set_text_fmt(s_pNowC, "선생님 %d명 · 눌러서 명단  " LV_SYMBOL_RIGHT, total);
    else lv_label_set_text(s_pNowC, "");
  }
  // 날씨·미세먼지·급식
  int g = -1;
  if (!isnan(s_pm10) || !isnan(s_pm25)) {
    const int g10 = isnan(s_pm10) ? 0 : s_pm10 <= 30 ? 0 : s_pm10 <= 80 ? 1 : s_pm10 <= 150 ? 2 : 3;
    const int g25 = isnan(s_pm25) ? 0 : s_pm25 <= 15 ? 0 : s_pm25 <= 35 ? 1 : s_pm25 <= 75 ? 2 : 3;
    g = max(g10, g25);
  }
  static const char *GN[4] = {"좋음", "보통", "나쁨", "매우 나쁨"};
  static const char *GC[4] = {"60a5fa", "34d399", "fb923c", "ef4444"};
  const float tnow = !isnan(s_wxNow) ? s_wxNow : s_wx[0].tmax;
  if (!isnan(tnow)) lv_label_set_text_fmt(s_pWx, "%d° %s", (int)lroundf(tnow), wxName(s_wxNowCode >= 0 ? s_wxNowCode : s_wx[0].code));
  else lv_label_set_text(s_pWx, HAS_WX ? "날씨 받는 중" : "날씨 설정 필요");
  if (g >= 0 && !isnan(s_wx[0].tmax)) lv_label_set_text_fmt(s_pWx2, "최고 %d° 최저 %d° · #%s 미세먼지 %s#", (int)lroundf(s_wx[0].tmax), (int)lroundf(s_wx[0].tmin), GC[g], GN[g]);
  else lv_label_set_text(s_pWx2, "");
  lv_label_set_text(s_pMeal, s_mLunch.length() ? s_mLunch.c_str() : (HAS_MEAL ? "오늘은 급식이 없습니다" : "급식 설정 필요"));
  // 학교 일정(일정 사이트): 오늘 진행 중인 것부터 다가오는 날 차례로 8줄(2026-10-18: 교장실 상태 칸을 빼고 일정 위주로)
  static const char *DW[7] = {"일", "월", "화", "수", "목", "금", "토"};
  auto dowOf = [](const String &iso) { struct tm t = {}; t.tm_year = iso.substring(0, 4).toInt() - 1900; t.tm_mon = iso.substring(5, 7).toInt() - 1; t.tm_mday = iso.substring(8, 10).toInt(); t.tm_hour = 12; mktime(&t); return t.tm_wday; };
  auto mdOf = [&](const String &iso) { return String(iso.substring(5, 7).toInt()) + "/" + iso.substring(8, 10).toInt() + " " + DW[dowOf(iso)]; };
  {
    const String td = todayIso();
    // 정렬은 정수 키(날짜*10000+분)로 한다(String 을 맞바꾸면 내부 RAM 이 조각난다). 큰 배열은 static(스택 16KB)
    struct C { int idx; long long key; int m, e; bool today; };
    static C cand[64]; int c = 0;
    const long tdN = td.length() ? td.substring(0, 4).toInt() * 10000L + td.substring(5, 7).toInt() * 100 + td.substring(8, 10).toInt() : 0;
    int ii = -1;
    for (JsonArray r : s_sched["items"].as<JsonArray>()) {
      ii++;
      const char *sd = r[0] | "", *ed = r[1] | "";
      if (strcmp(ed, td.c_str()) < 0) continue;                // 끝난 일정
      if (c >= 64) break;
      const bool today = strcmp(sd, td.c_str()) <= 0;
      const String d = today ? td : String(sd);
      const long dN = d.substring(0, 4).toInt() * 10000L + d.substring(5, 7).toInt() * 100 + d.substring(8, 10).toInt();
      const int m = schedMin(r[2] | ""), e = schedEnd(r[2] | "", m);
      long long key = (long long)dN * 10000 + (m + 1);
      if (today && e > 0 && nm >= 0 && e <= nm) key += 100000000000000LL;   // 오늘 이미 끝난 일정은 맨 뒤로
      cand[c].idx = ii; cand[c].key = key; cand[c].m = m; cand[c].e = e; cand[c].today = today; c++;
    }
    for (int x = 1; x < c; x++) { C v = cand[x]; int y = x - 1; while (y >= 0 && cand[y].key > v.key) { cand[y + 1] = cand[y]; y--; } cand[y + 1] = v; }
    const int n = min(c, P_ROWS);
    (void)tdN;
    int nextI = -1;
    for (int i = 0; i < n; i++) if (cand[i].today && cand[i].m > nm && cand[i].m < 24 * 60 && nextI < 0) nextI = i;
    JsonArray its = s_sched["items"].as<JsonArray>();
    for (int i = 0; i < P_ROWS; i++) {
      if (i >= n) { lv_obj_add_flag(s_pRow[i], LV_OBJ_FLAG_HIDDEN); continue; }
      lv_obj_clear_flag(s_pRow[i], LV_OBJ_FLAG_HIDDEN);
      const C &q = cand[i];
      JsonArray r = its[q.idx];
      const char *sd = r[0] | "", *ed = r[1] | "";
      const bool cur = q.today && q.m >= 0 && q.e > 0 && q.m <= nm && nm < q.e;
      const bool past = q.today && q.e > 0 && q.e <= nm;
      const bool nxt = i == nextI && !cur;
      lv_label_set_text(s_pRowT[i], q.today ? "오늘" : mdOf(String(sd)).c_str());
      lv_obj_set_user_data(s_pRow[i], (void *)(intptr_t)q.idx);   // 누르면 자세히
      lv_label_set_long_mode(s_pRowA[i], q.today ? LV_LABEL_LONG_WRAP : LV_LABEL_LONG_DOT);   // 오늘 일정은 두 줄까지
      lv_obj_set_height(s_pRowA[i], q.today ? 2 * lv_font_get_line_height(lv_obj_get_style_text_font(s_pRowA[i], 0)) + 2 : LV_SIZE_CONTENT);
      lv_label_set_text(s_pRowA[i], r[3] | "");
      String sub = (const char *)(r[2] | "");
      const char *pl = r[4] | "";
      if (*pl) { if (sub.length()) sub += " · "; sub += pl; }
      if (q.today && strcmp(ed, td.c_str()) > 0) {               // 여러 날 일정: 언제까지
        if (sub.length()) sub += " · ";
        sub += "~" + String(String(ed).substring(5, 7).toInt()) + "/" + String(ed).substring(8, 10).toInt();
      }
      if (!sub.length()) sub = (const char *)(r[5] | "");          // 시간·장소가 없으면 부서(사이트의 [부서] 표시)
      lv_label_set_text(s_pRowB[i], sub.c_str());
      {   // 시간·장소가 없으면 제목이 줄 끝까지 쓴다
        lv_obj_t *tb = lv_obj_get_parent(s_pRowT[i]);
        const int full = lv_obj_get_width(s_pRow[i]) - lv_obj_get_width(tb) - 30;
        lv_obj_set_width(s_pRowA[i], sub.length() ? full - lv_obj_get_width(s_pRowB[i]) - 6 : full);
      }
      lv_obj_set_style_bg_color(s_pRow[i], lv_color_hex(cur ? NOW_ROW : D_ROW), 0);
      lv_obj_set_style_border_color(s_pRow[i], lv_color_hex(cur ? NOW_ROW : nxt ? NEXT_BD : D_LINE), 0);
      lv_obj_set_style_border_width(s_pRow[i], nxt ? 2 : 1, 0);
      lv_obj_set_style_bg_color(lv_obj_get_parent(s_pRowT[i]), lv_color_hex(q.today ? NOW_TAG : D_LINE), 0);
      lv_obj_set_style_text_color(s_pRowT[i], lv_color_hex(q.today ? NOW_TX : D_SUB), 0);
      lv_obj_set_style_text_color(s_pRowA[i], lv_color_hex(cur ? C_TEXT : past ? D_MUTED : D_TEXT), 0);
      lv_obj_set_style_text_color(s_pRowB[i], lv_color_hex(cur ? C_MUTED : D_MUTED), 0);
    }
    if (!n) {
      lv_obj_clear_flag(s_pRow[0], LV_OBJ_FLAG_HIDDEN);
      lv_label_set_text(s_pRowT[0], "-");
      lv_label_set_text(s_pRowA[0], cfgSet(SCHEDULE_URL) ? "다가오는 학교 일정이 없습니다" : "학교 일정 주소가 없습니다 · 관리자 확인");
      lv_label_set_text(s_pRowB[0], "");
    }
    // 학사 일정 D-day(시험·행사·휴일, 오늘부터 3개)
    int k = 0;
    auto dayNo = [](const String &iso) { struct tm t = {}; t.tm_year = iso.substring(0, 4).toInt() - 1900; t.tm_mon = iso.substring(5, 7).toInt() - 1; t.tm_mday = iso.substring(8, 10).toInt(); t.tm_hour = 12; return (long)(mktime(&t) / 86400); };
    JsonArray ac = s_sched["acad"].as<JsonArray>();
    for (int ai = 0; ai < (int)ac.size() && k < 3; ai++) {
      const String dt = ac[ai][0] | "";
      if (dt < td) continue;
      const char *nmA = ac[ai][1] | "";
      String endD = dt;                                          // 같은 이름이 다음 날 이어지면 묶는다(중간고사 10/20~10/22)
      while (ai + 1 < (int)ac.size() && !strcmp(ac[ai + 1][1] | "", nmA) && dayNo(String((const char *)(ac[ai + 1][0] | ""))) - dayNo(endD) == 1) { ai++; endD = (const char *)(ac[ai][0] | ""); }
      const long left = dayNo(dt) - dayNo(td);
      String when = mdOf(dt);
      if (endD != dt) when += "~" + String(endD.substring(5, 7).toInt()) + "/" + endD.substring(8, 10).toInt();
      String line = String(nmA) + "  ·  " + when + "  ·  " + (left == 0 ? String("오늘") : String("D-") + left);
      lv_label_set_text(s_pAcad[k], line.c_str());
      lv_obj_set_style_text_color(s_pAcad[k], lv_color_hex(left == 0 ? NOW_TAG : left <= 3 ? D_TEXT : D_SUB), 0);
      lv_obj_clear_flag(s_pAcad[k], LV_OBJ_FLAG_HIDDEN);
      k++;
    }
    for (; k < 3; k++) lv_obj_add_flag(s_pAcad[k], LV_OBJ_FLAG_HIDDEN);
  }
  // 야외 활동 안전: 왼쪽 날씨 칸 맨 아래 한 줄(미세먼지 나쁨 · 최고 31° 이상 · 최저 0° 이하)
  {
    const float hi = s_wx[0].tmax, lo = s_wx[0].tmin;
    const int dl = g >= 3 ? 2 : g >= 2 ? 1 : 0;
    const int heat = !isnan(hi) && hi >= 33 ? 2 : !isnan(hi) && hi >= 31 ? 1 : 0;
    const int cold = !isnan(lo) && lo <= -5 ? 2 : !isnan(lo) && lo <= 0 ? 1 : 0;
    const int level = max(dl, max(heat, cold));
    static const char *LCx[3] = {"34d399", "fbbf24", "f87171"};
    static const char *VD[3] = {"운동장 활동 가능", "야외 활동 주의", "실내 활동 권장"};
    String why;
    if (dl) why += String("미세먼지 ") + GN[g];
    if (heat) { if (why.length()) why += " · "; why += "폭염"; }
    if (cold) { if (why.length()) why += " · "; why += "한파"; }
    if (g < 0 && isnan(hi)) lv_label_set_text(s_pNews, "#94a3b8 야외 활동: 날씨를 받는 중#");
    else lv_label_set_text_fmt(s_pNews, "#%s ● %s#  #94a3b8 %s#", LCx[level], VD[level], why.length() ? why.c_str() : "바깥 활동 문제없음");
  }
}

// 화면 만들기(buildUI 끝에서 한 번). 배치는 tools/sim/index.html 의 buildPrincipal 과 같다.
static void buildPrincipal(lv_obj_t *scr) {
  const float K = s_W / 800.0f;
  auto S = [&](int v) { return (int)lroundf(v * K); };
  const int CM = S(12), PH = s_H - 2 * CM, P = S(20), LW = S(416), CW = LW - 2 * P;
  s_viewPrin = box(scr, D_BG, 0, 0);
  lv_obj_set_size(s_viewPrin, s_W, s_H); lv_obj_set_pos(s_viewPrin, 0, 0);
  lv_obj_add_flag(s_viewPrin, LV_OBJ_FLAG_HIDDEN);
  lv_obj_clear_flag(s_viewPrin, LV_OBJ_FLAG_CLICKABLE);       // 빈 곳 누르기는 없앴다(어디로 가는지 헷갈림) → 오른쪽 위 단추로 간다
  lv_obj_t *left = box(s_viewPrin, D_PANEL, D_LINE, 16);
  lv_obj_set_size(left, LW, PH); lv_obj_set_pos(left, CM, CM); lv_obj_clear_flag(left, LV_OBJ_FLAG_CLICKABLE);
  s_pClock = label(left, FCLK(), D_TEXT, "--:--");
  lv_obj_align(s_pClock, LV_ALIGN_TOP_MID, 0, S(18));
  s_pAmPm = label(left, &kr28, D_SUB, ""); lv_obj_add_flag(s_pAmPm, LV_OBJ_FLAG_HIDDEN);
  s_pBat = label(left, FM(), D_MUTED, ""); lv_obj_align(s_pBat, LV_ALIGN_TOP_RIGHT, -S(12), S(6)); lv_obj_add_flag(s_pBat, LV_OBJ_FLAG_HIDDEN);   // 배터리(읽을 수 있을 때만)
  const int DATE_Y = S(18) + lv_font_get_line_height(FCLK()) + S(12);
  s_pDate = label(left, &kr28, D_SUB, "");
  lv_obj_set_width(s_pDate, LW); lv_obj_set_style_text_align(s_pDate, LV_TEXT_ALIGN_CENTER, 0); lv_obj_set_pos(s_pDate, 0, DATE_Y);
  const int nowY = DATE_Y + 29 + S(20), nowH = S(118);
  lv_obj_t *nc = box(left, D_ROW, D_LINE, 14);
  lv_obj_set_size(nc, CW, nowH); lv_obj_set_pos(nc, P, nowY);
  lv_obj_add_flag(nc, LV_OBJ_FLAG_CLICKABLE); lv_obj_add_event_cb(nc, onTeachOpen, LV_EVENT_CLICKED, nullptr);   // 누르면 수업 중/없음 선생님
  lv_obj_set_style_border_color(nc, lv_color_hex(D_SUB), 0);   // 누를 수 있는 칸은 테두리를 조금 밝게
  lv_obj_set_style_bg_color(nc, lv_color_hex(D_LINE), LV_STATE_PRESSED);
  const int RR = S(38);
  s_pRing = lv_arc_create(nc);                                // 얇은 교시 링(남은 시간)
  lv_obj_set_size(s_pRing, 2 * RR, 2 * RR); lv_obj_set_pos(s_pRing, S(14), (nowH - 2 * RR) / 2);
  lv_arc_set_rotation(s_pRing, 270); lv_arc_set_bg_angles(s_pRing, 0, 360); lv_arc_set_range(s_pRing, 0, 100);
  lv_obj_remove_style(s_pRing, nullptr, LV_PART_KNOB); lv_obj_clear_flag(s_pRing, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_set_style_arc_width(s_pRing, 5, LV_PART_MAIN); lv_obj_set_style_arc_color(s_pRing, lv_color_hex(D_LINE), LV_PART_MAIN);
  lv_obj_set_style_arc_width(s_pRing, 5, LV_PART_INDICATOR); lv_obj_set_style_arc_color(s_pRing, lv_color_hex(NOW_TAG), LV_PART_INDICATOR);
  s_pNowN = label(s_pRing, &kr28, D_TEXT, "-"); lv_obj_center(s_pNowN);
  const int tx = S(14) + 2 * RR + S(16);
  s_pNowA = label(nc, &kr20, D_TEXT, ""); lv_obj_set_pos(s_pNowA, tx, S(16));
  s_pNowB = label(nc, FM(), D_SUB, ""); lv_obj_set_pos(s_pNowB, tx, S(16) + 28);
  s_pNowC = label(nc, FM(), D_MUTED, ""); lv_obj_set_pos(s_pNowC, tx, nowH - S(14) - 18);
  const int wy = nowY + nowH + S(12), wh = PH - P - wy;
  lv_obj_t *wc = box(left, D_ROW, D_LINE, 14);
  lv_obj_set_size(wc, CW, wh); lv_obj_set_pos(wc, P, wy); lv_obj_clear_flag(wc, LV_OBJ_FLAG_CLICKABLE);
  s_pWx = label(wc, &kr20, D_TEXT, ""); lv_obj_set_pos(s_pWx, S(14), S(12));
  s_pWx2 = label(wc, FM(), D_SUB, ""); lv_label_set_recolor(s_pWx2, true); lv_obj_set_pos(s_pWx2, S(14), S(12) + 28);
  lv_obj_t *mt = label(wc, FM(), D_MUTED, "급식"); lv_obj_set_pos(mt, S(14), S(12) + 58);
  s_pMeal = label(wc, FM(), D_SUB, ""); lv_obj_set_width(s_pMeal, CW - S(28) - 50); lv_label_set_long_mode(s_pMeal, LV_LABEL_LONG_DOT); lv_obj_set_pos(s_pMeal, S(14) + 50, S(12) + 58);
  lv_obj_t *hr = box(wc, D_LINE, 0, 0); lv_obj_set_size(hr, CW - S(28), 1); lv_obj_set_pos(hr, S(14), wh - S(44));
  s_pNews = label(wc, FM(), D_MUTED, ""); lv_label_set_recolor(s_pNews, true); lv_obj_set_width(s_pNews, CW - S(28)); lv_label_set_long_mode(s_pNews, LV_LABEL_LONG_DOT); lv_obj_set_pos(s_pNews, S(14), wh - S(32));

  const int RX = CM + LW + CM, RW = s_W - RX - CM;
  lv_obj_t *right = box(s_viewPrin, D_PANEL, D_LINE, 16);
  lv_obj_set_size(right, RW, PH); lv_obj_set_pos(right, RX, CM); lv_obj_clear_flag(right, LV_OBJ_FLAG_CLICKABLE);
  s_pTitle = label(right, &kr16, D_TEXT, "학교 일정"); lv_label_set_recolor(s_pTitle, true); lv_obj_set_pos(s_pTitle, S(16), S(14));
  {   // 오른쪽 위 단추: [30일 일정 ›] [설정]
    const int BH = big() ? 40 : 34, BW1 = big() ? 150 : 124, BW2 = big() ? 84 : 70;
    lv_obj_t *b1 = button(right, "30일 일정  " LV_SYMBOL_RIGHT, BW1, BH, D_ROW, D_SUB);
    lv_obj_set_style_border_color(b1, lv_color_hex(D_LINE), 0); lv_obj_set_style_border_width(b1, 1, 0);
    lv_obj_align(b1, LV_ALIGN_TOP_RIGHT, -S(12) - BW2 - 8, S(6));
    lv_obj_add_event_cb(b1, [](lv_event_t *) { showView(V_WEEK); }, LV_EVENT_CLICKED, nullptr);
    lv_obj_t *b2 = button(right, "설정", BW2, BH, D_ROW, D_SUB);
    lv_obj_set_style_border_color(b2, lv_color_hex(D_LINE), 0); lv_obj_set_style_border_width(b2, 1, 0);
    lv_obj_align(b2, LV_ALIGN_TOP_RIGHT, -S(12), S(6));
    lv_obj_add_event_cb(b2, [](lv_event_t *) { showView(V_SET); }, LV_EVENT_CLICKED, nullptr);
    lv_obj_set_width(s_pTitle, RW - S(16) - BW1 - BW2 - S(12) - 24); lv_label_set_long_mode(s_pTitle, LV_LABEL_LONG_DOT);
  }
  const int AH = S(84);                                        // 아래 학사 일정 칸
  const int ROW_Y0 = S(40), ROW_X = S(12), ROW_W = RW - 2 * ROW_X, RP_ = (PH - ROW_Y0 - AH - S(16)) / P_ROWS, RH_ = RP_ - S(5), TW = S(70);
  for (int i = 0; i < P_ROWS; i++) {
    s_pRow[i] = box(right, D_ROW, D_LINE, UI_SOFT ? 10 : 8);
    lv_obj_set_size(s_pRow[i], ROW_W, RH_); lv_obj_set_pos(s_pRow[i], ROW_X, ROW_Y0 + i * RP_);
    lv_obj_add_flag(s_pRow[i], LV_OBJ_FLAG_CLICKABLE); lv_obj_add_event_cb(s_pRow[i], onSchedRow, LV_EVENT_CLICKED, nullptr);
    lv_obj_t *tb = box(s_pRow[i], D_LINE, 0, UI_SOFT ? 10 : 6);
    lv_obj_set_size(tb, TW, RH_ - 8); lv_obj_align(tb, LV_ALIGN_LEFT_MID, S(5) - 1, 0);
    s_pRowT[i] = label(tb, FM(), D_SUB, ""); lv_obj_center(s_pRowT[i]);
    s_pRowA[i] = label(s_pRow[i], &kr16, D_TEXT, ""); lv_obj_set_width(s_pRowA[i], ROW_W - TW - S(20) - S(118)); lv_label_set_long_mode(s_pRowA[i], LV_LABEL_LONG_DOT);
    lv_obj_align(s_pRowA[i], LV_ALIGN_LEFT_MID, TW + S(14), 0);
    s_pRowB[i] = label(s_pRow[i], FM(), D_MUTED, ""); lv_obj_set_width(s_pRowB[i], S(114)); lv_label_set_long_mode(s_pRowB[i], LV_LABEL_LONG_DOT);
    lv_obj_set_style_text_align(s_pRowB[i], LV_TEXT_ALIGN_RIGHT, 0); lv_obj_align(s_pRowB[i], LV_ALIGN_RIGHT_MID, -S(10), 0);
    lv_obj_add_flag(s_pRow[i], LV_OBJ_FLAG_HIDDEN);
  }
  lv_obj_t *ac = box(right, D_ROW, D_LINE, 14);
  lv_obj_set_size(ac, ROW_W, AH); lv_obj_set_pos(ac, ROW_X, PH - S(12) - AH); lv_obj_clear_flag(ac, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_set_pos(label(ac, &kr14, D_MUTED, "학사 일정"), S(12), S(8));
  for (int i = 0; i < 3; i++) {
    s_pAcad[i] = label(ac, FM(), D_SUB, "");
    lv_obj_set_width(s_pAcad[i], ROW_W - S(24)); lv_label_set_long_mode(s_pAcad[i], LV_LABEL_LONG_DOT);
    lv_obj_set_pos(s_pAcad[i], S(12), S(8) + 18 + i * ((AH - S(8) - 18 - S(6)) / 3));
    lv_obj_add_flag(s_pAcad[i], LV_OBJ_FLAG_HIDDEN);
  }
}
static void setPrincipalTitles() {   // 제목에 누구 책상인지(교장·교감)
  if (!s_pTitle) return;
  char b[64]; const bool st = staleText(b, sizeof b);
  if (st) lv_label_set_text_fmt(s_pTitle, "학교 일정 · %s   #fb923c %s#", s_pickName == "@교감" ? "교감" : "교장", b);
  else lv_label_set_text_fmt(s_pTitle, "학교 일정 · %s", s_pickName == "@교감" ? "교감" : "교장");
}

// ── 교장실 모드 더하기(2026-10-18 사용자 요청) ──
// · 일정 줄을 누르면 자세히(제목 전체·기간·시간·장소·부서·담당·내용)
// · 교장실 모드에서는 [시간표] 탭이 [학교 일정] 목록(30일, 한 쪽 7개, 쪽 넘기기)이 된다
// · '학교 지금' 칸을 누르면 수업 중/수업 없음 선생님 이름 단추 → 이름을 누르면 '찾기' 화면에 그 선생님 하루
static lv_obj_t *s_pDetail = nullptr, *s_dDate, *s_dTitle, *s_dInfo;
static lv_obj_t *s_viewSched = nullptr, *s_sRow[7], *s_sRowT[7], *s_sRowA[7], *s_sRowB[7], *s_sPage;
static int s_sPg = 0;
static lv_obj_t *s_pTeach = nullptr, *s_tBtn[30], *s_tTab[2], *s_tPage, *s_tNote;
static int s_tKind = 0, s_tPg = 0;   // 0 수업 중 · 1 수업 없음

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
static String schedDay(const String &sd, const String &ed) {   // "10/21 수" · "10/16 금 ~ 10/20 화"
  static const char *DW[7] = {"일", "월", "화", "수", "목", "금", "토"};
  auto one = [&](const String &iso) {
    struct tm t = {}; t.tm_year = iso.substring(0, 4).toInt() - 1900; t.tm_mon = iso.substring(5, 7).toInt() - 1; t.tm_mday = iso.substring(8, 10).toInt(); t.tm_hour = 12; mktime(&t);
    return String(iso.substring(5, 7).toInt()) + "/" + iso.substring(8, 10).toInt() + " " + DW[t.tm_wday];
  };
  return (ed.length() && ed != sd) ? one(sd) + " ~ " + one(ed) : one(sd);
}

static void showSchedDetail(int i) {
  JsonArray r = s_sched["items"][i];
  if (r.isNull() || !s_pDetail) return;
  const String sd = r[0] | "", ed = r[1] | "";
  {   // 날짜 줄 끝에 오늘·내일·D-n
    auto dn = [](const String &iso) { struct tm t = {}; t.tm_year = iso.substring(0, 4).toInt() - 1900; t.tm_mon = iso.substring(5, 7).toInt() - 1; t.tm_mday = iso.substring(8, 10).toInt(); t.tm_hour = 12; return (long)(mktime(&t) / 86400); };
    const String td = todayIso();
    String d = schedDay(sd, ed);
    if (td.length()) { const long l = dn(sd) - dn(td); d += l <= 0 ? (ed >= td ? "  ·  오늘" : "") : l == 1 ? "  ·  내일" : (String("  ·  D-") + l).c_str(); }
    lv_label_set_text(s_dDate, d.c_str());
  }
  lv_label_set_text(s_dTitle, r[3] | "");
  String info;
  auto line = [&](const char *k, const char *v) { if (v && *v) { if (info.length()) info += (char)10; info += k; info += "   "; info += v; } };
  line("시간", r[2] | ""); line("장소", r[4] | ""); line("부서", r[5] | ""); line("담당", r[6] | ""); line("내용", r[7] | "");
  if (!info.length()) info = "자세한 내용이 없습니다";
  lv_label_set_text(s_dInfo, info.c_str());
  lv_obj_clear_flag(s_pDetail, LV_OBJ_FLAG_HIDDEN);
  lv_obj_move_foreground(s_pDetail);
}
static void onSchedRow(lv_event_t *e) { showSchedDetail((int)(intptr_t)lv_obj_get_user_data(lv_event_get_current_target(e))); }

static void renderSchedList() {
  if (!s_viewSched) return;
  static int idx[64]; const int n = schedSorted(idx, 64);
  const int pages = max(1, (n + 6) / 7);
  if (s_sPg >= pages) s_sPg = pages - 1;
  const String td = todayIso();
  JsonArray items = s_sched["items"].as<JsonArray>();
  for (int k = 0; k < 7; k++) {
    const int j = s_sPg * 7 + k;
    if (j >= n) { lv_obj_add_flag(s_sRow[k], LV_OBJ_FLAG_HIDDEN); continue; }
    JsonArray r = items[idx[j]];
    const String sd = r[0] | "", ed = r[1] | "";
    const bool today = sd <= td;
    lv_obj_clear_flag(s_sRow[k], LV_OBJ_FLAG_HIDDEN);
    lv_obj_set_user_data(s_sRow[k], (void *)(intptr_t)idx[j]);
    lv_label_set_text(s_sRowT[k], today ? "오늘" : schedDay(sd, "").c_str());
    lv_obj_set_style_bg_color(lv_obj_get_parent(s_sRowT[k]), lv_color_hex(today ? NOW_TAG : D_LINE), 0);
    lv_obj_set_style_text_color(s_sRowT[k], lv_color_hex(today ? NOW_TX : D_SUB), 0);
    lv_label_set_text(s_sRowA[k], r[3] | "");
    String sub = schedDay(sd, ed);
    const char *tm = r[2] | "", *pl = r[4] | "", *dp = r[5] | "";
    if (*tm) { sub += " · "; sub += tm; }
    if (*pl) { sub += " · "; sub += pl; }
    if (*dp) { sub += " · "; sub += dp; }
    lv_label_set_text(s_sRowB[k], sub.c_str());
  }
  lv_label_set_text_fmt(s_sPage, n ? "%d / %d" : "다가오는 일정 없음", s_sPg + 1, pages);
}
static void onSchedPage(lv_event_t *e) { s_sPg = max(0, s_sPg + (int)(intptr_t)lv_event_get_user_data(e)); renderSchedList(); }

// 수업 중/없음 선생님 단추(이름만). 오늘이 수업일이 아니면 다음 수업일 기준
static int teachDay(String &label) {
  const String td = todayIso();
  JsonArray dates = s_where["dates"].as<JsonArray>();
  for (int i = 0; i < (int)dates.size(); i++) if (td == (const char *)(dates[i] | "")) { label = ""; return i; }
  for (int i = 0; i < (int)dates.size(); i++) {               // 오늘 자료가 없으면 앞으로 올 첫 수업일(지난 날은 쓰지 않는다)
    const char *d = dates[i] | "";
    if (strcmp(d, td.c_str()) > 0) { label = schedDay(String(d), "") + " 기준"; return i; }
  }
  return -1;
}
static void renderTeach() {
  if (!s_pTeach) return;
  String lbl; const int di = teachDay(lbl);
  const int nm = timeValid() ? nowMin() : -1;
  int p = -1, nextP = -1;
  for (int q = 0; q < 7; q++) { const int st = toMin(PERIOD_START[q]); if (nm >= st && nm < st + 50) p = q; if (nextP < 0 && st > nm) nextP = q; }
  const bool inClass = p >= 0;
  if (p < 0) p = nextP;                                        // 쉬는 시간·점심·수업 전이면 다음 교시 기준
  if (lbl.length()) p = 0;                                     // 다음 수업일이면 1교시 기준
  String off; const bool offDay = !lbl.length() && isOffDay(&off);
  const bool none = di < 0 || p < 0 || offDay;                 // 볼 교시가 없다(방과 후·휴일·자료 없음)
  JsonArray ts = s_where["teachers"].as<JsonArray>();
  static int idx[160]; int n = 0, cnt[2] = {0, 0};
  const int tn = min((int)ts.size(), 160);
  for (int i = 0; i < tn && !none; i++) {
    const int k = teachingCell(ts[i]["d"][di][p] | "") ? 0 : 1;
    cnt[k]++;
    if (k == s_tKind) idx[n++] = i;
  }
  for (int t = 0; t < 2; t++) {
    const bool on = t == s_tKind;
    lv_obj_set_style_bg_color(s_tTab[t], lv_color_hex(on ? C_PRIMARY : C_ALT), 0);
    lv_obj_t *l = lv_obj_get_child(s_tTab[t], 0);
    if (none) lv_label_set_text(l, t ? "수업 없음 -" : "수업 중 -");
    else lv_label_set_text_fmt(l, "%s %d", t ? "수업 없음" : inClass || lbl.length() ? "수업 중" : "수업 있음", cnt[t]);
    lv_obj_set_style_text_color(l, lv_color_hex(on ? 0xffffff : C_MUTED), 0);
  }
  const int pages = max(1, (n + 29) / 30);
  if (s_tPg >= pages) s_tPg = pages - 1;
  for (int b = 0; b < 30; b++) {
    const int k = s_tPg * 30 + b;
    if (k >= n) { lv_obj_add_flag(s_tBtn[b], LV_OBJ_FLAG_HIDDEN); continue; }
    lv_obj_clear_flag(s_tBtn[b], LV_OBJ_FLAG_HIDDEN);
    lv_label_set_text(lv_obj_get_child(s_tBtn[b], 0), ts[idx[k]]["n"] | "");
  }
  lv_label_set_text_fmt(s_tPage, "%d / %d", s_tPg + 1, pages);
  if (di < 0) lv_label_set_text(s_tNote, s_where["teachers"].size() ? "다음 수업일 자료가 없습니다" : "선생님 자료를 아직 받지 못했습니다");
  else if (offDay) lv_label_set_text_fmt(s_tNote, "오늘은 수업이 없습니다(%s)", off.c_str());
  else if (p < 0) lv_label_set_text(s_tNote, "오늘 수업이 끝났습니다");
  else if (!inClass && !lbl.length()) lv_label_set_text_fmt(s_tNote, "쉬는 시간 · 다음 %d교시(%s) 기준 · 이름을 누르면 오늘 수업%s", p + 1, PERIOD_START[p], (int)ts.size() > 160 ? " (일부만)" : "");
  else lv_label_set_text_fmt(s_tNote, "%s%s%d교시 · 이름을 누르면 오늘 수업%s", lbl.c_str(), lbl.length() ? " · " : "", p + 1, (int)ts.size() > 160 ? " (일부만)" : "");
}
static void onTeachOpen(lv_event_t *) { s_tKind = 0; s_tPg = 0; renderTeach(); lv_obj_clear_flag(s_pTeach, LV_OBJ_FLAG_HIDDEN); lv_obj_move_foreground(s_pTeach); }
static void onTeachTab(lv_event_t *e) { s_tKind = (int)(intptr_t)lv_event_get_user_data(e); s_tPg = 0; renderTeach(); }
static void onTeachPage(lv_event_t *e) { s_tPg = max(0, s_tPg + (int)(intptr_t)lv_event_get_user_data(e)); renderTeach(); }
static lv_obj_t *s_findBack = nullptr;
static bool s_findFromTeach = false;
static void onTeachName(lv_event_t *e) {   // 이름 → '찾기' 화면에 그 선생님 하루
  s_findFromTeach = true;
  s_findSel = lv_label_get_text(lv_obj_get_child(lv_event_get_current_target(e), 0));
  lv_obj_add_flag(s_pTeach, LV_OBJ_FLAG_HIDDEN);
  showView(V_FIND);
}

// 화면 만들기(buildUI 에서 한 번)
static void buildPrincipalMore(lv_obj_t *scr, int top) {
  if (s_findGridParent) {
    s_findBack = button(s_findGridParent, LV_SYMBOL_LEFT "  지금 선생님", 150, 32, D_ROW, D_SUB);
    lv_obj_set_style_border_color(s_findBack, lv_color_hex(D_LINE), 0); lv_obj_set_style_border_width(s_findBack, 1, 0);
    lv_obj_align(s_findBack, LV_ALIGN_TOP_RIGHT, -10, 2);
    lv_obj_add_flag(s_findBack, LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_event_cb(s_findBack, [](lv_event_t *) {   // 교장 화면으로 돌아가 선생님 판을 다시 연다(고르던 탭은 그대로)
      showView(V_CLOCK); s_tPg = 0; renderTeach(); lv_obj_clear_flag(s_pTeach, LV_OBJ_FLAG_HIDDEN); lv_obj_move_foreground(s_pTeach);
    }, LV_EVENT_CLICKED, nullptr);
  }
  const bool small = s_W <= 800;
  const int M = small ? 8 : 12, HB = small ? 38 : 46;
  const lv_font_t *fTitle = small ? &kr16 : &kr20, *fCellA = small ? &kr16 : &kr20;
  // 일정 자세히(어두운 덮개 + 가운데 카드, 아무 데나 누르면 닫힘)
  s_pDetail = box(scr, 0x000000, 0, 0);
  lv_obj_set_style_bg_opa(s_pDetail, LV_OPA_70, 0);
  lv_obj_set_size(s_pDetail, s_W, s_H); lv_obj_set_pos(s_pDetail, 0, 0);
  lv_obj_add_flag(s_pDetail, LV_OBJ_FLAG_HIDDEN | LV_OBJ_FLAG_CLICKABLE);
  lv_obj_add_event_cb(s_pDetail, [](lv_event_t *) { lv_obj_add_flag(s_pDetail, LV_OBJ_FLAG_HIDDEN); }, LV_EVENT_CLICKED, nullptr);
  lv_obj_t *card = box(s_pDetail, C_SURF, C_BORDER, 16);
  lv_obj_set_size(card, s_W * 7 / 10, s_H * 7 / 10); lv_obj_center(card); lv_obj_clear_flag(card, LV_OBJ_FLAG_CLICKABLE);
  s_dDate = label(card, FM(), C_MUTED, ""); lv_obj_set_pos(s_dDate, 24, 20);
  s_dTitle = label(card, &kr28, C_TEXT, ""); lv_obj_set_width(s_dTitle, s_W * 7 / 10 - 48); lv_label_set_long_mode(s_dTitle, LV_LABEL_LONG_DOT);
  lv_obj_set_height(s_dTitle, 2 * lv_font_get_line_height(&kr28) + 4); lv_obj_set_pos(s_dTitle, 24, 46);
  s_dInfo = label(card, &kr20, C_MUTED, ""); lv_obj_set_width(s_dInfo, s_W * 7 / 10 - 48); lv_label_set_long_mode(s_dInfo, LV_LABEL_LONG_WRAP);
  lv_obj_set_style_text_line_space(s_dInfo, 8, 0); lv_obj_align(s_dInfo, LV_ALIGN_TOP_LEFT, 24, 46 + 29 * 2 + 20);
  lv_label_set_long_mode(s_dInfo, LV_LABEL_LONG_DOT); lv_obj_set_height(s_dInfo, s_H * 7 / 10 - (46 + 29 * 2 + 20) - 72);   // 내용이 길면 말줄임(넘치지 않게)
  lv_obj_t *cb = button(card, "닫기", 120, 48, C_PRIMARY, 0xffffff);
  lv_obj_align(cb, LV_ALIGN_BOTTOM_RIGHT, -16, -12);
  lv_obj_add_event_cb(cb, [](lv_event_t *) { lv_obj_add_flag(s_pDetail, LV_OBJ_FLAG_HIDDEN); }, LV_EVENT_CLICKED, nullptr);
  lv_obj_t *hint = label(card, &kr14, C_LIGHT, "바깥을 눌러도 닫힙니다"); lv_obj_align(hint, LV_ALIGN_BOTTOM_LEFT, 24, -26);

  // 학교 일정 목록(교장실 모드의 [학교 일정] 탭)
  const int VH = s_H - top;
  s_viewSched = box(scr, D_BG, 0, 0);
  lv_obj_set_size(s_viewSched, s_W, VH); lv_obj_set_pos(s_viewSched, 0, top);
  lv_obj_add_flag(s_viewSched, LV_OBJ_FLAG_HIDDEN);
  lv_obj_t *t = label(s_viewSched, fTitle, D_TEXT, "학교 일정 · 30일"); lv_obj_set_pos(t, M + 4, M + (HB - 21) / 2);
  const int RY = M + HB + M / 2, FB = HB, RH = (VH - RY - FB - 2 * M) / 7;
  for (int k = 0; k < 7; k++) {
    s_sRow[k] = box(s_viewSched, D_ROW, D_LINE, UI_SOFT ? 10 : 8);
    lv_obj_set_size(s_sRow[k], s_W - 2 * M, RH - 6); lv_obj_set_pos(s_sRow[k], M, RY + k * RH);
    lv_obj_add_flag(s_sRow[k], LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(s_sRow[k], onSchedRow, LV_EVENT_CLICKED, nullptr);
    lv_obj_t *tb = box(s_sRow[k], D_LINE, 0, UI_SOFT ? 10 : 6);
    lv_obj_set_size(tb, small ? 70 : 92, RH - 14); lv_obj_align(tb, LV_ALIGN_LEFT_MID, 4, 0); lv_obj_clear_flag(tb, LV_OBJ_FLAG_CLICKABLE);
    s_sRowT[k] = label(tb, FM(), D_SUB, ""); lv_obj_center(s_sRowT[k]);
    s_sRowA[k] = label(s_sRow[k], fCellA, D_TEXT, ""); lv_obj_set_width(s_sRowA[k], s_W - 2 * M - (small ? 90 : 116)); lv_label_set_long_mode(s_sRowA[k], LV_LABEL_LONG_DOT);
    lv_obj_set_pos(s_sRowA[k], small ? 82 : 106, 6);
    s_sRowB[k] = label(s_sRow[k], FM(), D_MUTED, ""); lv_obj_set_width(s_sRowB[k], s_W - 2 * M - (small ? 90 : 116)); lv_label_set_long_mode(s_sRowB[k], LV_LABEL_LONG_DOT);
    lv_obj_set_pos(s_sRowB[k], small ? 82 : 106, RH - 6 - 22);
    lv_obj_add_flag(s_sRow[k], LV_OBJ_FLAG_HIDDEN);
  }
  const int FY = VH - M - FB, PW = small ? 120 : 150;
  lv_obj_t *bp = button(s_viewSched, LV_SYMBOL_LEFT "  이전", PW, FB, D_ROW, D_TEXT); lv_obj_set_pos(bp, s_W / 2 - PW - 70, FY);
  lv_obj_add_event_cb(bp, onSchedPage, LV_EVENT_CLICKED, (void *)(intptr_t)-1);
  s_sPage = label(s_viewSched, FM(), D_MUTED, ""); lv_obj_set_width(s_sPage, 140); lv_obj_set_style_text_align(s_sPage, LV_TEXT_ALIGN_CENTER, 0); lv_obj_set_pos(s_sPage, s_W / 2 - 70, FY + (FB - 17) / 2);
  lv_obj_t *bn = button(s_viewSched, "다음  " LV_SYMBOL_RIGHT, PW, FB, D_ROW, D_TEXT); lv_obj_set_pos(bn, s_W / 2 + 70, FY);
  lv_obj_add_event_cb(bn, onSchedPage, LV_EVENT_CLICKED, (void *)(intptr_t)1);

  // 수업 중/없음 선생님 판(화면 전체, 위쪽 막대 아래)
  s_pTeach = box(scr, C_BG, 0, 0);
  lv_obj_set_size(s_pTeach, s_W, s_H); lv_obj_set_pos(s_pTeach, 0, 0);
  lv_obj_add_flag(s_pTeach, LV_OBJ_FLAG_HIDDEN);
  lv_obj_t *tt = label(s_pTeach, fTitle, C_TEXT, "지금 선생님"); lv_obj_align(tt, LV_ALIGN_TOP_LEFT, M + 4, M + (HB - 21) / 2);
  for (int k = 0; k < 2; k++) {
    s_tTab[k] = button(s_pTeach, "", small ? 130 : 170, HB, C_ALT, C_MUTED);
    lv_obj_set_style_border_color(s_tTab[k], lv_color_hex(C_BORDER), 0);
    lv_obj_set_pos(s_tTab[k], (small ? 200 : 260) + k * ((small ? 130 : 170) + 8), M);
    lv_obj_add_event_cb(s_tTab[k], onTeachTab, LV_EVENT_CLICKED, (void *)(intptr_t)k);
  }
  lv_obj_t *bc = button(s_pTeach, "닫기", small ? 90 : 110, HB, C_ALT, C_MUTED);
  lv_obj_set_style_border_color(bc, lv_color_hex(C_BORDER), 0); lv_obj_align(bc, LV_ALIGN_TOP_RIGHT, -M, M);
  lv_obj_add_event_cb(bc, [](lv_event_t *) { lv_obj_add_flag(s_pTeach, LV_OBJ_FLAG_HIDDEN); }, LV_EVENT_CLICKED, nullptr);
  s_tNote = label(s_pTeach, FM(), C_MUTED, ""); lv_obj_set_pos(s_tNote, M + 4, M + HB + 6);
  const int GY = M + HB + 30, GH = s_H - GY - FB - 2 * M, GAP = small ? 6 : 8, BW = (s_W - 2 * M - 5 * GAP) / 6, BH = (GH - 4 * GAP) / 5;
  for (int b = 0; b < 30; b++) {
    s_tBtn[b] = button(s_pTeach, "", BW, BH, C_SURF, C_TEXT);
    lv_obj_set_style_border_color(s_tBtn[b], lv_color_hex(C_BORDER), 0);
    lv_obj_set_style_text_font(lv_obj_get_child(s_tBtn[b], 0), fCellA, 0);
    lv_obj_set_pos(s_tBtn[b], M + (b % 6) * (BW + GAP), GY + (b / 6) * (BH + GAP));
    lv_obj_add_event_cb(s_tBtn[b], onTeachName, LV_EVENT_CLICKED, nullptr);
    lv_obj_add_flag(s_tBtn[b], LV_OBJ_FLAG_HIDDEN);
  }
  const int TFY = s_H - M - FB;
  lv_obj_t *tp = button(s_pTeach, LV_SYMBOL_LEFT "  이전", PW, FB, C_ALT, C_TEXT); lv_obj_set_style_border_color(tp, lv_color_hex(C_BORDER), 0); lv_obj_set_pos(tp, s_W / 2 - PW - 70, TFY);
  lv_obj_add_event_cb(tp, onTeachPage, LV_EVENT_CLICKED, (void *)(intptr_t)-1);
  s_tPage = label(s_pTeach, FM(), C_MUTED, ""); lv_obj_set_width(s_tPage, 140); lv_obj_set_style_text_align(s_tPage, LV_TEXT_ALIGN_CENTER, 0); lv_obj_set_pos(s_tPage, s_W / 2 - 70, TFY + (FB - 17) / 2);
  lv_obj_t *tn = button(s_pTeach, "다음  " LV_SYMBOL_RIGHT, PW, FB, C_ALT, C_TEXT); lv_obj_set_style_border_color(tn, lv_color_hex(C_BORDER), 0); lv_obj_set_pos(tn, s_W / 2 + 70, TFY);
  lv_obj_add_event_cb(tn, onTeachPage, LV_EVENT_CLICKED, (void *)(intptr_t)1);
}

static void hideOverlays() {   // 덮개 창(선생님 판·일정 자세히·볼 시간표·비밀번호·자판)을 모두 닫는다
  lv_obj_t *o[] = {s_pTeach, s_pDetail, s_pickView, s_pwBox, s_kb, s_pwBg};
  for (lv_obj_t *x : o) if (x && !lv_obj_has_flag(x, LV_OBJ_FLAG_HIDDEN)) lv_obj_add_flag(x, LV_OBJ_FLAG_HIDDEN);
}
static bool overlayOpen() {
  lv_obj_t *o[] = {s_pTeach, s_pDetail, s_pickView, s_pwBox};
  for (lv_obj_t *x : o) if (x && !lv_obj_has_flag(x, LV_OBJ_FLAG_HIDDEN)) return true;
  return false;
}

static void showView(View v) {
  const View old = s_view;
  s_view = v;
  if (v == V_WEEK && old != V_WEEK) s_sPg = 0;   // [학교 일정]은 들어올 때마다 첫 쪽부터
  auto vis = [](lv_obj_t *o, bool on) { if (on) lv_obj_clear_flag(o, LV_OBJ_FLAG_HIDDEN); else lv_obj_add_flag(o, LV_OBJ_FLAG_HIDDEN); };
  vis(s_viewTT, v == V_WEEK && !s_principal);
  if (s_viewSched) vis(s_viewSched, v == V_WEEK && s_principal);
  if (s_pTeach) vis(s_pTeach, false);
  if (s_pDetail) vis(s_pDetail, false);
  if (v != V_SET && s_pwBox) { vis(s_pwBox, false); vis(s_kb, false); if (s_pwBg) vis(s_pwBg, false); }
  vis(s_viewSet, v == V_SET);
  vis(s_viewClock, v == V_CLOCK && !s_principal);
  if (s_viewPrin) vis(s_viewPrin, v == V_CLOCK && s_principal);
  vis(s_viewFind, v == V_FIND);
  if (s_pickView) vis(s_pickView, false);   // 다른 탭으로 가면 '볼 시간표' 판은 닫는다
  tabStyle(s_tabTT, v == V_WEEK);
  tabStyle(s_tabSet, v == V_SET);
  tabStyle(s_tabClock, v == V_CLOCK);
  tabStyle(s_tabFind, v == V_FIND);
  if (v != V_FIND) s_findFromTeach = false;
  if (s_findBack) vis(s_findBack, v == V_FIND && s_findFromTeach && s_principal);
  if (v == V_FIND) { if (s_findGridDirty) fillFinderGrid(); renderFinder(); }
  if (v == V_SET) refreshWifiLabel();
  if (v == V_CLOCK && s_principal) renderPrincipal();
  if (v == V_WEEK && s_principal) renderSchedList();
}
static void onTabTT(lv_event_t *e) { showView(V_WEEK); }
static void onTabSet(lv_event_t *e) { showView(V_SET); }
static void onTabClock(lv_event_t *e) { showView(V_CLOCK); }

// ── 설정 '시계 화면' ──
static int s_lastMin = -1;                           // 시계 글을 분이 바뀔 때만 다시 그린다(loop). -1 이면 곧 다시 그린다
static void segStyle(lv_obj_t *b, bool on) {
  lv_obj_set_style_bg_color(b, lv_color_hex(on ? C_PRIMARY : C_ALT), 0);
  lv_obj_set_style_border_color(b, lv_color_hex(on ? C_PRIMARY : D_LINE), 0);
  lv_obj_set_style_text_color(lv_obj_get_child(b, 0), lv_color_hex(on ? 0xffffff : C_MUTED), 0);
}
static void refreshClockSettings() {
  for (int i = 0; i < 2; i++) segStyle(s_fmtBtn[i], (i == 1) == s_h12);
  for (int i = 0; i < 3; i++) segStyle(s_autoBtn[i], AUTO_CLK_MIN[i] == s_autoClkMin);
}
static void onFmtPick(lv_event_t *e) {
  s_h12 = (intptr_t)lv_event_get_user_data(e) == 1;
  s_prefs.putBool("h12", s_h12);
  refreshClockSettings();
  layoutClock();
  s_lastMin = -1;                                    // 시계 글을 바로 새 모양으로
}
// 보이기 단추: 누를 때마다 켜짐/꺼짐. 바로 저장하고 시계 화면 자리를 다시 잡는다.
static const int SHOW_BIT[6] = {SH_WX, SH_DUST, SH_DUTY, SH_MEAL, SH_TT, SH_DDAY};
static void refreshShowButtons() { for (int i = 0; i < 6; i++) segStyle(s_showBtn[i], s_show & SHOW_BIT[i]); }
static void onShowPick(lv_event_t *e) {
  s_show ^= SHOW_BIT[(intptr_t)lv_event_get_user_data(e)];
  s_prefs.putInt("show", s_show);
  refreshShowButtons();
  layoutClock();
  renderToday();                                     // D-day 등 보이기가 바뀐 것을 반영
}
static void onAutoPick(lv_event_t *e) {
  s_autoClkMin = AUTO_CLK_MIN[(intptr_t)lv_event_get_user_data(e)];
  s_prefs.putInt("autoclk", s_autoClkMin);
  refreshClockSettings();
}
static void onTabFind(lv_event_t *e) { showView(V_FIND); }
static void onClockTap(lv_event_t *e) { showView(V_WEEK); }
static void onPrev(lv_event_t *e) { if (s_week > 0) { s_week--; renderWeek(); } }
static void onNext(lv_event_t *e) { if (s_ttLoaded && s_week + 1 < (int)s_tt["weeks"].size()) { s_week++; renderWeek(); } }
static void onThisWeek(lv_event_t *e) { s_week = currentWeek(); renderWeek(); }static void onPickTT(lv_event_t *e) {   // 단추 판에서 하나를 눌렀다 → 고르고 판을 닫고 바로 받기
  const int i = (int)(intptr_t)lv_obj_get_user_data(lv_event_get_target(e));
  if (i < 0) {   // 교장·교감 → 교장실 모드
    s_pickName = i == -1 ? "@교장" : "@교감";
    s_prefs.putString("ttname", s_pickName);
    lv_obj_add_flag(s_pickView, LV_OBJ_FLAG_HIDDEN);
    fillPicker();
    s_syncReq = true;
    setStatus("학교 일정을 곧 받습니다…");
    return;
  }
  JsonObject it = s_index["items"][i];
  if (!it.isNull()) {
    if (s_pickName != (const char *)(it["name"] | "")) { s_ttLoaded = false; s_ttName = ""; }   // 다른 사람을 고르면 옛 시간표를 보이지 않는다
    s_pickName = (const char *)(it["name"] | "");
    s_ttFile = (const char *)(it["file"] | "");
    s_prefs.putString("ttname", s_pickName);
  }
  lv_obj_add_flag(s_pickView, LV_OBJ_FLAG_HIDDEN);
  fillPicker();
  s_syncReq = true;
  setStatus("고른 시간표를 곧 받습니다…");
}
static void onPickOpen(lv_event_t *) { s_pickPg = 0; renderPicker(); lv_obj_clear_flag(s_pickView, LV_OBJ_FLAG_HIDDEN); }
static void onPickClose(lv_event_t *) { lv_obj_add_flag(s_pickView, LV_OBJ_FLAG_HIDDEN); }
static void onPickTab(lv_event_t *e) { s_pickKind = (int)(intptr_t)lv_event_get_user_data(e); s_pickPg = 0; renderPicker(); }
static void onPickPage(lv_event_t *e) { s_pickPg = max(0, s_pickPg + (int)(intptr_t)lv_event_get_user_data(e)); renderPicker(); }

// ── 화면 만들기 ──
// 배치는 화면 크기(s_W × s_H)에서 계산한다. 이 키트의 7인치 보드는 800×480 이다.
static void buildUI() {
  const bool small = s_W <= 800;
  const lv_font_t *fTitle = small ? &kr16 : &kr20;
  const lv_font_t *fClock = small ? &kr20 : &kr28;
  const lv_font_t *fBody = small ? &kr14 : &kr16;
  const lv_font_t *fCellA = small ? &kr16 : &kr20;
  const int TOP = small ? 50 : 60, M = small ? 8 : 12;

  lv_obj_t *scr = lv_scr_act();
  lv_obj_set_style_bg_color(scr, lv_color_hex(D_BG), 0);
  lv_obj_clear_flag(scr, LV_OBJ_FLAG_SCROLLABLE);

  // 위쪽 막대
  s_top = box(scr, D_PANEL, 0, 0);
  lv_obj_set_size(s_top, s_W, TOP);
  lv_obj_set_style_border_side(s_top, LV_BORDER_SIDE_BOTTOM, 0);
  lv_obj_set_style_border_width(s_top, 1, 0);
  lv_obj_set_style_border_color(s_top, lv_color_hex(D_LINE), 0);
  const int LOGO = TOP - 16;
  lv_obj_t *logo = box(s_top, C_PRIMARY, 0, 8);
  lv_obj_set_size(logo, LOGO, LOGO); lv_obj_align(logo, LV_ALIGN_LEFT_MID, M, 0);
  lv_obj_set_style_bg_grad_color(logo, lv_color_hex(0x2563eb), 0);
  lv_obj_set_style_bg_grad_dir(logo, UI_FANCY ? LV_GRAD_DIR_HOR : LV_GRAD_DIR_NONE, 0);
  lv_obj_center(label(logo, fTitle, 0xffffff, "교"));
  s_title = label(s_top, fTitle, D_TEXT, BOARD_TITLE);
  lv_obj_set_width(s_title, small ? 116 : 180);
  lv_label_set_long_mode(s_title, LV_LABEL_LONG_DOT);
  lv_obj_align(s_title, LV_ALIGN_LEFT_MID, M + LOGO + 8, 0);

  // 탭 넷: 시간표 · 시계 · 찾기 · 설정
  const int TABW = small ? 72 : 100, TABH = TOP - 14;
  lv_obj_t *tabs = box(s_top, D_ROW, D_LINE, 10);
  lv_obj_set_size(tabs, TABW * 4 + 3 * 2 + 8, TOP - 6); lv_obj_align(tabs, LV_ALIGN_LEFT_MID, small ? 178 : 250, 0);
  auto mkTab = [&](const char *txt, int i, bool on, lv_event_cb_t cb) {
    lv_obj_t *b = button(tabs, txt, TABW, TABH, on ? D_LINE : D_ROW, on ? D_TEXT : D_MUTED);
    lv_obj_set_pos(b, 4 + i * (TABW + 2), 3);
    lv_obj_set_style_border_width(b, 0, 0);
    lv_obj_add_event_cb(b, cb, LV_EVENT_CLICKED, nullptr);
    return b;
  };
  s_tabTT = mkTab("시간표", 0, true, onTabTT);
  s_tabClock = mkTab("시계", 1, false, onTabClock);
  s_tabFind = mkTab("찾기", 2, false, onTabFind);
  s_tabSet = mkTab("설정", 3, false, onTabSet);


  s_wifiLbl = label(s_top, &kr14, C_ROSE, LV_SYMBOL_WIFI " 연결 안 됨");
  lv_obj_set_width(s_wifiLbl, small ? 150 : 200);
  lv_label_set_long_mode(s_wifiLbl, LV_LABEL_LONG_DOT);
  lv_obj_set_style_text_align(s_wifiLbl, LV_TEXT_ALIGN_RIGHT, 0);
  lv_obj_align(s_wifiLbl, LV_ALIGN_RIGHT_MID, small ? -118 : -156, 0);   // 12시간 모드 "오후 3:40" 자리까지
  s_clock = label(s_top, fClock, D_TEXT, "--:--");
  lv_obj_align(s_clock, LV_ALIGN_RIGHT_MID, -M, small ? -7 : -8);
  s_date = label(s_top, &kr14, D_MUTED, "");
  lv_obj_align(s_date, LV_ALIGN_RIGHT_MID, -M, small ? 13 : 16);

  {
  // ── 시간표 보기 ──
  const int VH = s_H - TOP;
  s_viewTT = box(scr, D_BG, 0, 0);
  lv_obj_set_size(s_viewTT, s_W, VH); lv_obj_set_pos(s_viewTT, 0, TOP);
  const int SH = small ? 38 : 46;
  lv_obj_t *strip = box(s_viewTT, D_PANEL, D_LINE, 10);
  lv_obj_set_size(strip, s_W - 2 * M, SH); lv_obj_set_pos(strip, M, M / 2 + 2);
  s_ttSub = label(strip, fBody, D_SUB, "");
  lv_obj_set_width(s_ttSub, small ? 300 : 440); lv_label_set_long_mode(s_ttSub, LV_LABEL_LONG_DOT);
  lv_obj_align(s_ttSub, LV_ALIGN_LEFT_MID, 12, 0);
  const int BH = SH - 8;
  lv_obj_t *bNow = button(strip, "이번 주", small ? 64 : 74, BH, D_ROW, D_TEXT);
  lv_obj_align(bNow, LV_ALIGN_RIGHT_MID, -4, 0);
  lv_obj_add_event_cb(bNow, onThisWeek, LV_EVENT_CLICKED, nullptr);
  lv_obj_t *bNext = button(strip, LV_SYMBOL_RIGHT, 40, BH, D_ROW, D_TEXT);
  lv_obj_align_to(bNext, bNow, LV_ALIGN_OUT_LEFT_MID, -6, 0);
  lv_obj_add_event_cb(bNext, onNext, LV_EVENT_CLICKED, nullptr);
  s_weekLbl = label(strip, fBody, D_TEXT, "");
  lv_obj_set_width(s_weekLbl, small ? 150 : 190); lv_obj_set_style_text_align(s_weekLbl, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_align_to(s_weekLbl, bNext, LV_ALIGN_OUT_LEFT_MID, -4, 0);
  lv_obj_t *bPrev = button(strip, LV_SYMBOL_LEFT, 40, BH, D_ROW, D_TEXT);
  lv_obj_align_to(bPrev, s_weekLbl, LV_ALIGN_OUT_LEFT_MID, -4, 0);
  lv_obj_add_event_cb(bPrev, onPrev, LV_EVENT_CLICKED, nullptr);

  // 표: 교시칸 + 요일 5칸 / 머리 + 교시 7줄 + 점심 한 줄
  const int GY = M / 2 + 2 + SH + M / 2 + 2, GW = s_W - 2 * M, GH = VH - GY - M / 2 - 2;
  s_grid = box(s_viewTT, D_PANEL, D_LINE, 10);
  lv_obj_set_size(s_grid, GW, GH); lv_obj_set_pos(s_grid, M, GY);
  const int X0 = small ? 56 : 70, CW = (GW - X0 - 2) / 5, HH = small ? 30 : 40, LH = small ? 24 : 30;
  const int RH = (GH - HH - LH - 2) / 7;
  auto rowY = [&](int p) { return HH + p * RH + (p >= 4 ? LH : 0); };
  const int PAD = small ? 2 : 3;
  for (int d = 0; d < 5; d++) {
    s_hd[d] = box(s_grid, D_PANEL, 0, 0);
    lv_obj_set_size(s_hd[d], CW, HH); lv_obj_set_pos(s_hd[d], X0 + d * CW, 0);
    lv_obj_t *hl = label(s_hd[d], fBody, D_SUB, DOW[d]);
    lv_obj_set_width(hl, CW - 6); lv_label_set_long_mode(hl, LV_LABEL_LONG_DOT);
    lv_obj_set_style_text_align(hl, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_center(hl);
    s_lunch[d] = box(s_grid, D_ROW, D_LINE, 6);
    lv_obj_set_size(s_lunch[d], CW - 2 * PAD, LH - 2 * PAD); lv_obj_set_pos(s_lunch[d], X0 + d * CW + PAD, HH + 4 * RH + PAD);
    lv_obj_t *ll = label(s_lunch[d], &kr14, D_MUTED, "점심");
    lv_label_set_long_mode(ll, LV_LABEL_LONG_DOT); lv_obj_set_width(ll, CW - 12); lv_obj_set_style_text_align(ll, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_center(ll);
    for (int p = 0; p < 7; p++) {
      lv_obj_t *c = box(s_grid, D_ROW, D_LINE, 6);
      lv_obj_set_size(c, CW - 2 * PAD, RH - 2 * PAD); lv_obj_set_pos(c, X0 + d * CW + PAD, rowY(p) + PAD);
      s_cell[d][p] = c;
      s_cellA[d][p] = label(c, fCellA, C_TEXT, "");
      lv_label_set_long_mode(s_cellA[d][p], LV_LABEL_LONG_DOT); lv_obj_set_width(s_cellA[d][p], CW - 14);
      lv_obj_set_style_text_align(s_cellA[d][p], LV_TEXT_ALIGN_CENTER, 0);
      lv_obj_align(s_cellA[d][p], LV_ALIGN_CENTER, 0, small ? -8 : -9);
      s_cellB[d][p] = label(c, &kr14, C_LIGHT, "");
      lv_label_set_long_mode(s_cellB[d][p], LV_LABEL_LONG_DOT); lv_obj_set_width(s_cellB[d][p], CW - 14);
      lv_obj_set_style_text_align(s_cellB[d][p], LV_TEXT_ALIGN_CENTER, 0);
      lv_obj_align(s_cellB[d][p], LV_ALIGN_CENTER, 0, small ? 10 : 13);
      s_cellTag[d][p] = label(c, &kr14, 0xffffff, "");
      lv_obj_set_style_bg_opa(s_cellTag[d][p], LV_OPA_COVER, 0);
      lv_obj_set_style_bg_color(s_cellTag[d][p], lv_color_hex(0xc2410c), 0);
      lv_obj_set_style_radius(s_cellTag[d][p], RP(6), 0);
      lv_obj_set_style_pad_hor(s_cellTag[d][p], 3, 0);
      lv_obj_align(s_cellTag[d][p], LV_ALIGN_TOP_RIGHT, -1, 0);
      lv_obj_add_flag(s_cellTag[d][p], LV_OBJ_FLAG_HIDDEN);
    }
  }
  for (int p = 0; p < 7; p++) {
    s_pl[p] = box(s_grid, D_PANEL, 0, 0);
    lv_obj_set_size(s_pl[p], X0, RH); lv_obj_set_pos(s_pl[p], 0, rowY(p));
    lv_obj_t *l = label(s_pl[p], &kr14, D_SUB, "");
    lv_label_set_text_fmt(l, "%d교시\n%s", p + 1, PERIOD_START[p]);
    lv_obj_set_style_text_align(l, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_center(l);
  }
  lv_obj_t *pl = label(s_grid, &kr14, D_MUTED, "점심");
  lv_obj_set_pos(pl, (X0 - 28) / 2, HH + 4 * RH + (LH - 16) / 2);

  }
  {
  // ── 시계 모드: 왼쪽 큰 시계·날씨·날짜, 오른쪽 오늘 시간표 (누르면 주간 시간표로) ──
  // 배치는 tools/out/clock_preview.html 에서 맞춘 값(800×480 기준). 1024×600 이면 비율대로 늘린다.
  // 바깥 여백 12 · 칸 사이 12 · 왼쪽 칸 안쪽 여백 20. 날씨 카드는 시계와 날짜 사이의 정가운데.
  const float K = s_W / 800.0f;
  auto S = [&](int v) { return (int)lroundf(v * K); };
  const int CM = S(12), LW = S(416), PH = s_H - 2 * CM, P = S(20);
  s_viewClock = box(scr, D_BG, 0, 0);
  lv_obj_set_size(s_viewClock, s_W, s_H); lv_obj_set_pos(s_viewClock, 0, 0);   // 위쪽 막대까지 덮는다
  lv_obj_add_flag(s_viewClock, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_HIDDEN);
  lv_obj_add_event_cb(s_viewClock, onClockTap, LV_EVENT_CLICKED, nullptr);

  // 왼쪽 칸의 물체는 여기서 만들기만 하고, 자리·크기는 layoutClock() 이 정한다(설정 '보이기'에 따라 달라진다).
  lv_obj_t *left = s_left = box(s_viewClock, D_PANEL, D_LINE, 16);
  lv_obj_set_pos(left, CM, CM);
  lv_obj_clear_flag(left, LV_OBJ_FLAG_CLICKABLE);                    // 눌러도 시계 화면이 받게
  s_big = label(left, FCLK(), D_TEXT, "--:--");
  s_bigAmPm = label(left, &kr28, D_SUB, "");
  lv_obj_add_flag(s_bigAmPm, LV_OBJ_FLAG_HIDDEN);
  s_bigDate = label(left, &kr28, D_SUB, "");
  lv_obj_set_style_text_align(s_bigDate, LV_TEXT_ALIGN_CENTER, 0);
  s_stale = label(left, FM(), 0xfb923c, "");                          // 자리는 layoutClock(날짜와 카드 사이 빈 줄)
  lv_obj_set_style_text_align(s_stale, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_add_flag(s_stale, LV_OBJ_FLAG_HIDDEN);
  s_bat = label(left, FM(), D_MUTED, "");                             // "배터리 87%" (배터리를 읽을 수 있을 때만)
  lv_obj_align(s_bat, LV_ALIGN_TOP_RIGHT, -S(14), S(10));
  lv_obj_add_flag(s_bat, LV_OBJ_FLAG_HIDDEN);

  // 날씨 카드(오늘 | 내일, 아래 줄 미세먼지)
  lv_obj_t *wc = s_wxCard = box(left, D_ROW, D_LINE, 14);
  lv_obj_clear_flag(wc, LV_OBJ_FLAG_CLICKABLE);
  s_wxSep = box(wc, D_LINE, 0, 0);
  s_wxSep2 = box(wc, D_LINE, 0, 0);
  s_dust = label(wc, FM(), D_SUB, "");                               // '● 미세먼지 좋음 · PM10 15 · 초미세 12'
  lv_label_set_recolor(s_dust, true);
  lv_label_set_long_mode(s_dust, LV_LABEL_LONG_DOT);
  for (int i = 0; i < 2; i++) {
    WxCard &k = s_card[i];
    k.img = lv_img_create(wc);
    k.desc = label(wc, FM(), D_MUTED, i == 0 ? "오늘" : "내일");      // "오늘 27°/19°"
    k.temp = label(wc, FTEMP(), D_TEXT, "");
    k.hilo = label(wc, FM(), D_SUB, "");                               // "맑음 · 비 0%"
    lv_label_set_recolor(k.hilo, true);
    lv_label_set_long_mode(k.hilo, LV_LABEL_LONG_DOT);
    k.rain = nullptr;
  }

  // '오늘' 카드(할 일 · 점심/저녁)
  lv_obj_t *ic = s_infoCard = box(left, D_ROW, D_LINE, 14);
  lv_obj_clear_flag(ic, LV_OBJ_FLAG_CLICKABLE);
  s_dutyTitle = label(ic, FM(), D_MUTED, "할 일");
  s_duty = label(ic, FM(), 0xfcd34d, "");
  lv_label_set_long_mode(s_duty, LV_LABEL_LONG_DOT);
  s_infoHr = box(ic, D_LINE, 0, 0);
  s_mealTitle = label(ic, FM(), D_MUTED, "점심");
  s_meal = label(ic, FM(), UI_SOFT ? D_SUB : 0xe2e8f0, "");
  lv_obj_set_style_text_line_space(s_meal, 2, 0);
  lv_label_set_long_mode(s_meal, LV_LABEL_LONG_DOT);
  s_kcal = label(ic, FM(), D_MUTED, "");

  // 맨 아래: 수업 10분 전부터 '다음 수업' 띠
  s_notice = box(left, C_PRIMARY, 0, 18);
  lv_obj_clear_flag(s_notice, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_set_style_bg_grad_color(s_notice, lv_color_hex(0x3730a3), 0);
  lv_obj_set_style_bg_grad_dir(s_notice, UI_FANCY ? LV_GRAD_DIR_HOR : LV_GRAD_DIR_NONE, 0);
  s_noticeLbl = label(s_notice, &kr16, 0xffffff, "");
  lv_label_set_long_mode(s_noticeLbl, LV_LABEL_LONG_DOT);
  lv_obj_set_style_text_align(s_noticeLbl, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_add_flag(s_notice, LV_OBJ_FLAG_HIDDEN);

  // 오른쪽: 오늘 시간표. 제목 아래 8줄(1~4교시·점심·5~7교시), 줄 간격 50.
  const int RX = CM + LW + CM, RW = s_W - RX - CM;
  lv_obj_t *right = s_right = box(s_viewClock, D_PANEL, D_LINE, 16);
  lv_obj_clear_flag(right, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_set_size(right, RW, PH); lv_obj_set_pos(right, RX, CM);
  s_dayTitle = label(right, &kr16, D_TEXT, "");
  lv_obj_set_pos(s_dayTitle, S(16), S(14));
  s_dayTag = label(right, &kr14, 0x991b1b, "");
  lv_obj_set_style_bg_opa(s_dayTag, LV_OPA_COVER, 0);
  lv_obj_set_style_bg_color(s_dayTag, lv_color_hex(0xfee2e2), 0);
  lv_obj_set_style_radius(s_dayTag, RP(10), 0);
  lv_obj_set_style_pad_hor(s_dayTag, 8, 0);
  lv_obj_align(s_dayTag, LV_ALIGN_TOP_RIGHT, -S(12), S(12));
  lv_obj_add_flag(s_dayTag, LV_OBJ_FLAG_HIDDEN);
  s_dday = label(right, &kr14, 0xfecaca, "");                        // 수능 D-day (수능 다음 날부터 숨긴다)
  lv_obj_set_style_bg_opa(s_dday, LV_OPA_COVER, 0);
  lv_obj_set_style_bg_color(s_dday, lv_color_hex(0x7f1d1d), 0);
  lv_obj_set_style_border_width(s_dday, 1, 0);
  lv_obj_set_style_border_color(s_dday, lv_color_hex(0xef4444), 0);
  lv_obj_set_style_radius(s_dday, RP(11), 0);
  lv_obj_set_style_pad_hor(s_dday, 10, 0);
  lv_obj_set_style_pad_ver(s_dday, 2, 0);
  lv_obj_align(s_dday, LV_ALIGN_TOP_RIGHT, -S(12), S(11));
  lv_obj_add_flag(s_dday, LV_OBJ_FLAG_HIDDEN);
  const int ROW_Y0 = S(44), ROW_X = S(12), ROW_W = RW - 2 * ROW_X;
  const int ROW_PITCH = (PH - ROW_Y0 - S(12)) / 8, ROW_H = ROW_PITCH - S(6), PW = S(64);
  for (int r = 0; r < 8; r++) {
    int p = periodOfRow(r);
    s_row[r] = box(right, D_ROW, D_LINE, UI_SOFT ? 10 : 8);   // UI_SOFT: 시계 화면 줄도 둥글게(사각이 날카롭다는 의견, 2026-10-18)
    lv_obj_clear_flag(s_row[r], LV_OBJ_FLAG_CLICKABLE);
    lv_obj_set_size(s_row[r], ROW_W, ROW_H); lv_obj_set_pos(s_row[r], ROW_X, ROW_Y0 + r * ROW_PITCH);
    s_rowP[r] = box(s_row[r], D_LINE, 0, UI_SOFT ? 10 : 6);
    lv_obj_set_size(s_rowP[r], PW, ROW_H - 8); lv_obj_align(s_rowP[r], LV_ALIGN_LEFT_MID, S(6) - 1, 0);
    lv_obj_t *pl = label(s_rowP[r], FM(), D_SUB, "");
    if (p < 0) lv_label_set_text(pl, "점심");
    else lv_label_set_text_fmt(pl, "%d교시\n%s", p + 1, PERIOD_START[p]);
    lv_obj_set_style_text_align(pl, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_center(pl);
    // 과목은 왼쪽 정렬, 교실은 오른쪽 정렬(세로로 줄이 맞게), 꼬리표는 과목 바로 뒤
    s_rowA[r] = label(s_row[r], &kr16, D_TEXT, "");
    lv_obj_set_width(s_rowA[r], LV_SIZE_CONTENT);
    lv_obj_set_style_max_width(s_rowA[r], S(150), 0);
    lv_label_set_long_mode(s_rowA[r], LV_LABEL_LONG_DOT);
    lv_obj_align(s_rowA[r], LV_ALIGN_LEFT_MID, PW + S(18), 0);
    s_rowB[r] = label(s_row[r], FM(), D_SUB, "");
    lv_obj_set_width(s_rowB[r], S(110)); lv_label_set_long_mode(s_rowB[r], LV_LABEL_LONG_DOT);
    lv_obj_set_style_text_align(s_rowB[r], LV_TEXT_ALIGN_RIGHT, 0);
    lv_obj_align(s_rowB[r], LV_ALIGN_RIGHT_MID, -S(14), 0);
    s_rowTag[r] = label(s_row[r], &kr14, 0xffffff, "");
    lv_obj_set_style_bg_opa(s_rowTag[r], LV_OPA_COVER, 0);
    lv_obj_set_style_bg_color(s_rowTag[r], lv_color_hex(0xc2410c), 0);   // 흰 글자와 명암비 5.2:1
    lv_obj_set_style_radius(s_rowTag[r], RP(6), 0);
    lv_obj_set_style_pad_hor(s_rowTag[r], 5, 0);
    lv_obj_add_flag(s_rowTag[r], LV_OBJ_FLAG_HIDDEN);
  }
  s_guide = label(right, &kr16, D_TEXT, "");                         // 시간표 줄들을 덮는 안내(없을 때만 보인다)
  lv_obj_set_style_bg_opa(s_guide, LV_OPA_COVER, 0);
  lv_obj_set_style_bg_color(s_guide, lv_color_hex(D_PANEL), 0);
  lv_obj_set_style_pad_all(s_guide, S(16), 0);
  lv_obj_set_size(s_guide, ROW_W, PH - ROW_Y0 - S(12)); lv_obj_set_pos(s_guide, ROW_X, ROW_Y0);
  lv_label_set_long_mode(s_guide, LV_LABEL_LONG_WRAP);
  lv_obj_add_flag(s_guide, LV_OBJ_FLAG_HIDDEN);

  }
  // ── 설정 보기 ──
  const int VH = s_H - TOP;
  s_viewSet = box(scr, C_BG, 0, 0);
  lv_obj_set_size(s_viewSet, s_W, VH); lv_obj_set_pos(s_viewSet, 0, TOP);
  lv_obj_add_flag(s_viewSet, LV_OBJ_FLAG_HIDDEN);
  const int WBW = (s_W - 3 * M) * 50 / 100, OBW = s_W - 3 * M - WBW, BOXH = VH - 2 * M;   // 반반(오른쪽에 시계 설정 단추가 많다)
  lv_obj_t *wbox = box(s_viewSet, C_SURF, C_BORDER, 10);
  lv_obj_set_size(wbox, WBW, BOXH); lv_obj_set_pos(wbox, M, M);
  lv_obj_set_pos(label(wbox, fTitle, C_TEXT, "와이파이"), 12, 10);
  s_wifiInfo = label(wbox, FM(), C_MUTED, "");
  lv_obj_set_width(s_wifiInfo, WBW - 130); lv_label_set_long_mode(s_wifiInfo, LV_LABEL_LONG_WRAP);
  lv_obj_set_pos(s_wifiInfo, 12, small ? 36 : 44);
  lv_obj_t *bScan = button(wbox, "찾기", small ? 90 : 110, small ? 34 : 40, C_PRIMARY, 0xffffff);
  lv_obj_align(bScan, LV_ALIGN_TOP_RIGHT, -10, 8); lv_obj_add_event_cb(bScan, onScan, LV_EVENT_CLICKED, nullptr);
  const int LY = small ? 76 : 90, FH = small ? 30 : 34;
  s_wifiList = lv_list_create(wbox);
  lv_obj_clear_flag(s_wifiList, LV_OBJ_FLAG_SCROLL_MOMENTUM | LV_OBJ_FLAG_SCROLL_ELASTIC);   // 밀어도 미끄러지지 않게(딱딱)
  lv_obj_set_size(s_wifiList, WBW - 24, BOXH - LY - FH - 16); lv_obj_set_pos(s_wifiList, 12, LY);
  lv_obj_set_style_text_font(s_wifiList, fBody, 0);
  lv_obj_t *bForget = button(wbox, "저장한 와이파이 지우기", small ? 190 : 220, FH, C_ALT, C_MUTED);
  lv_obj_align(bForget, LV_ALIGN_BOTTOM_LEFT, 12, -8); lv_obj_add_event_cb(bForget, onForget, LV_EVENT_CLICKED, nullptr);

  lv_obj_t *obox = box(s_viewSet, C_SURF, C_BORDER, 10);
  lv_obj_set_size(obox, OBW, BOXH); lv_obj_set_pos(obox, 2 * M + WBW, M);
  lv_obj_set_pos(label(obox, fTitle, C_TEXT, "볼 시간표"), 12, 10);
  s_ttPick = button(obox, BOARD_DEFAULT_TT "  " LV_SYMBOL_RIGHT, OBW - 24, small ? 34 : 40, C_SURF, C_TEXT);   // 누르면 단추 판
  lv_obj_set_style_border_color(s_ttPick, lv_color_hex(C_BORDER), 0);
  lv_obj_set_pos(s_ttPick, 12, small ? 40 : 50);
  lv_obj_add_event_cb(s_ttPick, onPickOpen, LV_EVENT_CLICKED, nullptr);
  lv_obj_t *bSync = button(obox, "지금 받기", OBW - 24, small ? 34 : 40, C_PRIMARY, 0xffffff);
  lv_obj_set_pos(bSync, 12, small ? 88 : 104);
  lv_obj_add_event_cb(bSync, [](lv_event_t *) {
    if (!s_prefs.getString("ssid", "").length()) { setStatus("먼저 [찾기]에서 와이파이를 고르세요"); return; }
    s_syncReq = true; setStatus("곧 연결합니다…"); }, LV_EVENT_CLICKED, nullptr);
  s_status = label(obox, FM(), C_MUTED, "");
  lv_obj_set_width(s_status, OBW - 24); lv_label_set_long_mode(s_status, LV_LABEL_LONG_WRAP);
  lv_obj_set_pos(s_status, 12, small ? 132 : 156);
  // 시계 화면 설정: 고르는 단추(켜진 것은 빨강). 바꾸면 바로 저장되고 시계에 바로 반영된다.
  {
    const int SY = small ? 190 : 226, RH2 = small ? 30 : 34, LBW = small ? 66 : 80, BW2 = (OBW - 24 - LBW - 12) / 3;
    lv_obj_set_pos(label(obox, fTitle, C_TEXT, "시계 화면"), 12, SY);
    const int Y1 = SY + (small ? 30 : 36), Y2 = Y1 + RH2 + 8;
    lv_obj_set_pos(label(obox, &kr14, C_MUTED, "시간 표시"), 12, Y1 + (RH2 - 16) / 2);
    lv_obj_set_pos(label(obox, &kr14, C_MUTED, "시계로 전환"), 12, Y2 + (RH2 - 16) / 2);
    static const char *FMT[2] = {"24시간", "12시간"};
    static const char *AUTO[3] = {"20분 뒤", "5분 뒤", "안 함"};
    for (int i = 0; i < 2; i++) {
      s_fmtBtn[i] = button(obox, FMT[i], BW2, RH2, C_ALT, C_MUTED);
      lv_obj_set_pos(s_fmtBtn[i], 12 + LBW + i * (BW2 + 6), Y1);
      lv_obj_add_event_cb(s_fmtBtn[i], onFmtPick, LV_EVENT_CLICKED, (void *)(intptr_t)i);
    }
    for (int i = 0; i < 3; i++) {
      s_autoBtn[i] = button(obox, AUTO[i], BW2, RH2, C_ALT, C_MUTED);
      lv_obj_set_pos(s_autoBtn[i], 12 + LBW + i * (BW2 + 6), Y2);
      lv_obj_add_event_cb(s_autoBtn[i], onAutoPick, LV_EVENT_CLICKED, (void *)(intptr_t)i);
    }
    refreshClockSettings();
    // 보이기: 켜진 것은 빨강. 끄면 그 자리를 남은 것이 쓴다.
    const int Y3 = Y2 + RH2 + 8, Y4 = Y3 + RH2 + 6;
    lv_obj_set_pos(label(obox, &kr14, C_MUTED, "보이기"), 12, Y3 + (RH2 - 16) / 2);
    static const char *SHOW[6] = {"날씨", "미세먼지", "할 일", "급식", "시간표", "D-day"};
    for (int i = 0; i < 6; i++) {
      s_showBtn[i] = button(obox, SHOW[i], BW2, RH2, C_ALT, C_MUTED);
      lv_obj_set_pos(s_showBtn[i], 12 + LBW + (i % 3) * (BW2 + 6), i < 3 ? Y3 : Y4);
      lv_obj_add_event_cb(s_showBtn[i], onShowPick, LV_EVENT_CLICKED, (void *)(intptr_t)i);
    }
    refreshShowButtons();
  }
  lv_obj_t *ver = label(obox, &kr14, C_LIGHT, "");
  lv_obj_set_width(ver, OBW - 24); lv_label_set_long_mode(ver, LV_LABEL_LONG_WRAP);
  lv_label_set_text_fmt(ver, "교실 알림판 v%s · 화면 %dx%d", FW_VERSION, s_W, s_H);
  lv_obj_align(ver, LV_ALIGN_BOTTOM_LEFT, 12, -10);

  layoutClock();                                     // 시계 화면 자리 잡기(설정 '보이기' 반영)
  buildFinder(scr, TOP);

  // 비밀번호 입력 (위쪽 창 + 화면 아래 키보드)
  buildPrincipal(scr);   // 교장실 모드 화면(숨김)
  buildPrincipalMore(scr, TOP);   // 일정 자세히 · 학교 일정 목록 · 선생님 판(숨김)

  // ── '볼 시간표' 단추 판(설정 위에 덮는 화면, 처음엔 숨김) ──
  {
    s_pickView = box(scr, C_BG, 0, 0);
    lv_obj_set_size(s_pickView, s_W, s_H - TOP); lv_obj_set_pos(s_pickView, 0, TOP);
    lv_obj_add_flag(s_pickView, LV_OBJ_FLAG_HIDDEN);
    const int HB = small ? 38 : 46;
    lv_obj_t *t = label(s_pickView, fTitle, C_TEXT, "볼 시간표 고르기");
    lv_obj_align(t, LV_ALIGN_TOP_LEFT, M + 4, M + (HB - 21) / 2);
    for (int k = 0; k < 2; k++) {
      s_pickTab[k] = button(s_pickView, "", small ? 130 : 170, HB, C_ALT, C_MUTED);
      lv_obj_set_style_border_color(s_pickTab[k], lv_color_hex(C_BORDER), 0);
      lv_obj_set_pos(s_pickTab[k], (small ? 230 : 300) + k * ((small ? 130 : 170) + 8), M);
      lv_obj_add_event_cb(s_pickTab[k], onPickTab, LV_EVENT_CLICKED, (void *)(intptr_t)k);
    }
    lv_obj_t *bc = button(s_pickView, "닫기", small ? 90 : 110, HB, C_ALT, C_MUTED);
    lv_obj_set_style_border_color(bc, lv_color_hex(C_BORDER), 0);
    lv_obj_align(bc, LV_ALIGN_TOP_RIGHT, -M, M);
    lv_obj_add_event_cb(bc, onPickClose, LV_EVENT_CLICKED, nullptr);
    // 6×5 단추. 아래 한 줄은 쪽 넘기기
    const int GY = M + HB + M, FB = HB, GH = s_H - TOP - GY - FB - 2 * M;
    const int GAP = small ? 6 : 8, BW = (s_W - 2 * M - 5 * GAP) / 6, BH = (GH - 4 * GAP) / 5;
    for (int b = 0; b < 30; b++) {
      s_pickBtn[b] = button(s_pickView, "", BW, BH, C_SURF, C_TEXT);
      lv_obj_set_style_border_color(s_pickBtn[b], lv_color_hex(C_BORDER), 0);
      lv_obj_set_style_text_font(lv_obj_get_child(s_pickBtn[b], 0), fCellA, 0);
      lv_obj_set_pos(s_pickBtn[b], M + (b % 6) * (BW + GAP), GY + (b / 6) * (BH + GAP));
      lv_obj_add_event_cb(s_pickBtn[b], onPickTT, LV_EVENT_CLICKED, nullptr);
      lv_obj_add_flag(s_pickBtn[b], LV_OBJ_FLAG_HIDDEN);
    }
    const int FY = s_H - TOP - M - FB;
    lv_obj_t *bp = button(s_pickView, LV_SYMBOL_LEFT "  이전", small ? 120 : 150, FB, C_ALT, C_TEXT);
    lv_obj_set_style_border_color(bp, lv_color_hex(C_BORDER), 0);
    lv_obj_set_pos(bp, s_W / 2 - (small ? 120 : 150) - 70, FY);
    lv_obj_add_event_cb(bp, onPickPage, LV_EVENT_CLICKED, (void *)(intptr_t)-1);
    s_pickPage = label(s_pickView, fBody, C_MUTED, "1 / 1");
    lv_obj_set_width(s_pickPage, 120); lv_obj_set_style_text_align(s_pickPage, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_set_pos(s_pickPage, s_W / 2 - 60, FY + (FB - 17) / 2);
    lv_obj_t *bn = button(s_pickView, "다음  " LV_SYMBOL_RIGHT, small ? 120 : 150, FB, C_ALT, C_TEXT);
    lv_obj_set_style_border_color(bn, lv_color_hex(C_BORDER), 0);
    lv_obj_set_pos(bn, s_W / 2 + 70, FY);
    lv_obj_add_event_cb(bn, onPickPage, LV_EVENT_CLICKED, (void *)(intptr_t)1);
  }

  s_pwBg = lv_obj_create(scr);                                   // 뒤 막(누르면 취소)
  lv_obj_remove_style_all(s_pwBg);
  lv_obj_set_size(s_pwBg, s_W, s_H); lv_obj_set_pos(s_pwBg, 0, 0);
  lv_obj_set_style_bg_color(s_pwBg, lv_color_hex(0x000000), 0); lv_obj_set_style_bg_opa(s_pwBg, LV_OPA_50, 0);
  lv_obj_add_flag(s_pwBg, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_HIDDEN);
  lv_obj_add_event_cb(s_pwBg, pwCancel, LV_EVENT_CLICKED, nullptr);
  s_pwBox = box(scr, C_SURF, C_BORDER, 12);
  lv_obj_set_size(s_pwBox, s_W - 160, small ? 110 : 130); lv_obj_align(s_pwBox, LV_ALIGN_TOP_MID, 0, TOP + 6);
  lv_obj_set_style_shadow_width(s_pwBox, 30, 0); lv_obj_set_style_shadow_opa(s_pwBox, LV_OPA_30, 0);
  lv_obj_align(label(s_pwBox, fTitle, C_TEXT, ""), LV_ALIGN_TOP_LEFT, 14, 10);
  s_pwTa = lv_textarea_create(s_pwBox);
  lv_textarea_set_one_line(s_pwTa, true);
  lv_textarea_set_password_mode(s_pwTa, false);   // 칠판 앞에서 치므로 보이게(오타 확인)
  lv_obj_set_style_text_font(s_pwTa, small ? &lv_font_montserrat_20 : &lv_font_montserrat_24, 0);
  lv_obj_set_size(s_pwTa, s_W - 192, small ? 48 : 56); lv_obj_align(s_pwTa, LV_ALIGN_BOTTOM_MID, 0, -10);
  {
    lv_obj_t *cb = button(s_pwBox, "취소", small ? 80 : 100, small ? 34 : 40, C_ALT, C_TEXT);   // 비밀번호를 모르면 여기서 닫는다
    lv_obj_set_style_border_color(cb, lv_color_hex(C_BORDER), 0); lv_obj_set_style_border_width(cb, 1, 0);
    lv_obj_align(cb, LV_ALIGN_TOP_RIGHT, -12, 6);
    lv_obj_add_event_cb(cb, pwCancel, LV_EVENT_CLICKED, nullptr);
  }
  lv_obj_add_flag(s_pwBox, LV_OBJ_FLAG_HIDDEN);
  s_kb = lv_keyboard_create(scr);
  lv_obj_set_size(s_kb, s_W, s_H / 2);
  lv_keyboard_set_textarea(s_kb, s_pwTa);
  lv_obj_add_event_cb(s_kb, onPwOk, LV_EVENT_ALL, nullptr);
  lv_obj_add_flag(s_kb, LV_OBJ_FLAG_HIDDEN);
}

// ── 화면 장치 ──
static void initDisplay() {
#if BOARD_7B
  ioexp_begin();   // I2C 0번 설치 · 확장 칩(0x24) 모두 출력 · 터치 리셋 — 화면 라이브러리보다 먼저
#endif
  Board *board = new Board();
  s_board = board;
  if (!board || !board->init()) { Serial.println("Board init failed"); while (true) delay(1000); }
  LCD *lcd = board->getLCD();
  s_lcd = lcd;
  auto *bus = lcd->getBus();
  const auto tear = ESP_LV_ADAPTER_TEAR_AVOID_MODE_DEFAULT_RGB;
  const auto rot = ESP_LV_ADAPTER_ROTATE_0;
  if (bus->getBasicAttributes().type == ESP_PANEL_BUS_TYPE_RGB) {
    lcd->configFrameBufferNumber(esp_lv_adapter_get_required_frame_buffer_count(tear, rot));
    static_cast<BusRGB *>(bus)->configRGB_BounceBufferSize(lcd->getFrameWidth() * 10);  // 공장 예제 10줄
  }
  assert(board->begin());
  esp_lv_adapter_config_t cfg = ESP_LV_ADAPTER_DEFAULT_CONFIG();
  cfg.task_stack_size = 16 * 1024;
  ESP_ERROR_CHECK(esp_lv_adapter_init(&cfg));
  esp_lv_adapter_display_config_t dc = ESP_LV_ADAPTER_DISPLAY_RGB_DEFAULT_CONFIG(lcd, lcd->getFrameWidth(), lcd->getFrameHeight(), rot);
  dc.profile.use_psram = true;
  s_W = lcd->getFrameWidth(); s_H = lcd->getFrameHeight();
  lv_display_t *disp = esp_lv_adapter_register_display(&dc);
  if (board->getTouch()) {
    esp_lv_adapter_touch_config_t tc = ESP_LV_ADAPTER_TOUCH_DEFAULT_CONFIG(disp, board->getTouch());
    esp_lv_adapter_register_touch(&tc);
  }
  ESP_ERROR_CHECK(esp_lv_adapter_start());
  Serial.printf("screen %dx%d pclk %luMHz%s\n", s_W, s_H, (unsigned long)(PCLK_HZ / 1000000), BOARD_7B ? " (7B)" : "");
}

SET_LOOP_TASK_STACK_SIZE(16 * 1024);   // loop 스택 8→16KB(교장실 화면 그리기가 깊다)

void setup() {
  Serial.begin(115200);
  Serial.printf("\n교실 알림판 v%s\n", FW_VERSION);
  if (!LittleFS.begin(true)) Serial.println("LittleFS mount failed");
  s_prefs.begin("board", false);
  s_pickName = s_prefs.getString("ttname", BOARD_DEFAULT_TT);           // 설정에서 고른 시간표 이름(없으면 board_config.h 의 처음 값)
  s_h12 = s_prefs.getBool("h12", false);
  s_autoClkMin = s_prefs.getInt("autoclk", 20);
  s_lastOkT = (time_t)s_prefs.getULong("lastok", 0);
  s_show = s_prefs.getInt("show", SH_ALL);

  initDisplay();
  // 화면을 켠 뒤부터는 64바이트가 넘는 malloc 을 PSRAM 에서 먼저 준다. 화면 물체(LVGL)가 내부 RAM 을 다 쓰면
  // HTTPS(TLS)가 'SSL - Memory allocation failed' 로 모두 실패한 적이 있다(선생님 찾기 단추 58개, 2026-09-30).
  // 화면을 켜기 **전**에 하면 안 된다: RGB 화면 드라이버 객체는 내부 RAM 에 있어야 한다(ISR_IRAM_SAFE).
  heap_caps_malloc_extmem_enable(64);
  lock();
  buildUI();
  if (loadTTFromFile()) Serial.println("tt.json loaded from flash");
  loadWeatherFromFile();
  renderWeather();
  loadMealFromFile();
  renderMeal();
  loadAirFromFile();
  renderAir();
  loadWhereFromFile();
  fillFinderGrid();
  renderFinder();
  loadIndexFromFile();
  loadSchedFromFile();
  fillPicker();
  renderTT();
  refreshWifiLabel();
  showView(V_CLOCK);   // 켜자마자 시계 화면(2026-10-18 팀 의견)
  refreshStale();
  unlock();

  setenv("TZ", "KST-9", 1); tzset();
  wifiOff();                                              // 평소에는 꺼 둔다
  // 켜자마자는 전원·화면이 안정되기 전이라 첫 연결이 잘 실패한다 → 5초 뒤에 첫 연결(loop 에서)
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

  // 배터리: 켠 뒤 5초, 그 뒤 1분마다 읽는다. 글자는 값이 바뀔 때만 바꾼다(다시 그리기 줄이기). 3.0V 밑이면 배터리 없음으로 보고 숨긴다.
  static uint32_t lastBat = 0;
  if (BOARD_7B && ms > 5000 && (lastBat == 0 || ms - lastBat > 15000)) {
    lastBat = ms;
    const int mv = ioexp_battery_mv();
    const bool have = mv >= 3000 && mv <= 4500;
    // 충전 여부: 이 보드는 충전 신호(CHRG)를 읽을 수 없다(충전 칩 CS8501 은 LED 만 켠다).
    // 충전기를 꽂으면 충전 전류 때문에 전압이 0.1~0.3V 뛰어 %가 실제보다 크게 나온다(2026-10-19: 빼면 24%, 꽂으면 60%).
    // 그래서 ① 15초 사이 70mV 넘게 뛰면 '꽂음'으로 보고 그 뛴 만큼(off)을 빼서 계산하고, ② 70mV 넘게 떨어지면 '뺌'.
    // ③ 켤 때부터 꽂혀 있던 경우는 10분 동안 30mV 넘게 오르면 충전 중으로 보고 off 를 보통 값(150mV)으로 둔다.
    // ④ 충전 중 4.15V 이상(보정 전)에서 10분 동안 거의 그대로면 '충전 완료'(100%).
    static int prev = -1, cand = 0, off = 0, st = 0, shown = -1;   // st: 0 방전 · 1 충전 중 · 2 충전 완료
    static int hist[21]; static int hn = 0; static uint32_t lastHist = 0;
    // 와이파이를 켜면 전기를 많이 써서 전압이 내려갔다가, 끄면(또는 화면 불이 꺼지면) 다시 올라온다.
    // 이것을 '꽂음'으로 잘못 보던 문제(2026-10-19: 안 꽂았는데 충전 중) → 받는 중·끝난 뒤 45초·화면 불이 바뀐 뒤 45초는 판단하지 않는다.
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
    Serial.printf("battery %dmV off %d -> %d%% (%s)\n", mv, st ? off : 0, pct, chg == 1 ? "charging" : chg == 2 ? "full" : "-");
    static int lastChg = -1;
    if ((pct != s_batPct || chg != lastChg) && s_bat) {
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

  // 1분마다 화면 박자를 다시 맞춘다(밀려도 1분 안에 제자리로). 받는 중에는 끝날 때 맞춘다.
  static uint32_t lastResync = 0;
  if (ms - lastResync > 60000 && s_sync == SYNC_IDLE) {
    lastResync = ms;
    if (s_lcdSlow) lcdSlow(false); else panelResync();   // 와이파이 재설정 등으로 느린 채 남았으면 되돌린다
    if (s_diagResync) lcdLog("resync");
  }

  // 1시간마다 잠깐 연결: 연결 → 시간 맞추기 → 시간표 받기 → 끄기
  if (s_sync == SYNC_IDLE) {
    bool due = s_prefs.isKey("ssid") && (!s_triedOnce || ms - s_lastSync > syncWaitMs());
    if (ms < 5000) due = false;                                  // 켠 뒤 5초는 기다린다
    // 수업 중에는 쉬는 시간까지 미룬다(켠 직후 첫 받기와 [지금 받기]는 바로)
    static bool deferLogged = false;
    if (due && s_triedOnce && inClassNow()) { if (!deferLogged) { deferLogged = true; Serial.println("sync: defer (class)"); } due = false; }
    if (due) deferLogged = false;
    if ((s_syncReq || due) && ms >= 5000) { s_syncReq = false; startSync(); }
  } else if (s_sync == SYNC_CONNECTING) {
    if (WiFi.isConnected()) {
      s_sync = SYNC_TIME; s_syncStart = ms;
      configTzTime("KST-9", "pool.ntp.org", "time.google.com", "kr.pool.ntp.org");
      lock(); setStatus("시간을 맞추는 중…"); unlock();
    } else if (!s_retried && ms - s_syncStart > 15000) {
      s_retried = true;
      Serial.printf("sync: retry (reason %d %s)\n", (int)s_wifiReason, wifiReasonText(s_wifiReason));
      WiFi.disconnect(false, false);
      wifiBegin();
    } else if (ms - s_syncStart > 35000) {
      static char msg[96];
      snprintf(msg, sizeof msg, "와이파이에 연결하지 못했습니다(%s, %d). 잠시 뒤 다시 해 봅니다.", wifiReasonText(s_wifiReason), (int)s_wifiReason);
      s_failKind = FK_NET;
      finishSync(false, msg);
    }
  } else if (s_sync == SYNC_TIME) {
    bool synced = sntp_get_sync_status() == SNTP_SYNC_STATUS_COMPLETED || (timeValid() && ms - s_syncStart > 8000);
    if (synced || ms - s_syncStart > 15000) {
      lock(); setStatus("시간표를 받는 중…"); unlock();
      // 시간표 주소를 아직 안 넣었으면(YOUR-SITE-ID) 시간표·선생님 위치는 받지 않는다. 404 로 실패해 몇 분마다
      // 다시 받으면 그때마다 화면 박자를 바꿔 화면이 깜빡였다(2026-10-16). 시간·날씨·급식은 그대로 받는다.
      const bool noUrl = urlUnset();
      if (!noUrl && downloadIndex()) { lock(); fillPicker(); unlock(); }
      s_ttCode = 0;
      bool ok = !noUrl && !s_principal && downloadTT();
      bool loaded = ok && loadTTFromFile();
      bool wx = downloadWeather();
      bool meal = downloadMeal();
      if (meal) s_mealOk = true;
      bool air = downloadAir();
      bool whr = !noUrl && downloadWhere();
      const bool sch = s_principal && downloadSchedule();
      lock(); if (loaded) { s_week = -1; renderTT(); } if (wx) renderWeather(); if (meal) renderMeal(); if (air) renderAir(); if (whr) { fillFinderGrid(); renderFinder(); } unlock();
      if (s_principal) { lock(); if (sch && s_pDetail) lv_obj_add_flag(s_pDetail, LV_OBJ_FLAG_HIDDEN); renderPrincipal(); renderSchedList(); if (s_pTeach && !lv_obj_has_flag(s_pTeach, LV_OBJ_FLAG_HIDDEN)) renderTeach(); unlock(); }
      if (s_principal && !noUrl && !sch && cfgSet(SCHEDULE_URL)) s_failKind = (wx || meal) ? FK_PARTIAL : FK_NET;
      if (s_principal && !noUrl) finishSync(timeValid() && (sch || !cfgSet(SCHEDULE_URL)), sch ? "시간과 학교 일정을 받았습니다." : cfgSet(SCHEDULE_URL) ? "학교 일정을 받지 못했습니다. 인터넷을 확인하세요." : "학교 일정 주소가 없습니다(SCHEDULE_URL).");
      else if (noUrl) finishSync(timeValid(), timeValid() ? "시간을 맞췄습니다. 시간표 주소를 넣으면 시간표도 받습니다." : "시간을 맞추지 못했습니다. 인터넷을 확인하세요.");
      else {
        if (!loaded) s_failKind = (s_ttCode == 404 || s_ttCode == 403) ? FK_NOTFOUND : (wx || meal) ? FK_PARTIAL : FK_NET;
        finishSync(loaded, loaded ? "시간과 시간표를 받았습니다."
                   : s_failKind == FK_NOTFOUND ? "시간표 주소에 파일이 없습니다. 주소를 확인하세요(6시간 뒤 다시 받습니다)."
                   : ok ? "시간표 파일을 읽지 못했습니다." : "시간표를 받지 못했습니다. 인터넷을 확인하세요.");
      }
    }
  }

  // 시계와 '지금' 표시 (1초마다 시계, 1분마다 표)
  if (ms - lastTick >= 1000) {
    lastTick = ms;
    if (timeValid()) {
      time_t t = time(nullptr); struct tm tm; localtime_r(&t, &tm);
      static const char *W[7] = {"일", "월", "화", "수", "목", "금", "토"};
      // 분이 바뀔 때만 그린다. 이 보드(RGB 화면)는 한 번 그릴 때마다 화면 전체를 PSRAM 에 다시 쓰므로
      // 매초 글자를 바꾸면 화면이 흔들린다(2026-09-30 확인).
      if (tm.tm_min != s_lastMin) {
        bool first = lastMin < 0; lastMin = tm.tm_min; s_lastMin = tm.tm_min;
        lock();
        char hm[12]; const char *ampm;
        clockText(tm, hm, sizeof hm, &ampm);
        lv_label_set_text_fmt(s_clock, "%s%s%s", ampm, *ampm ? " " : "", hm);
        lv_label_set_text_fmt(s_date, "%d월 %d일 (%s)", tm.tm_mon + 1, tm.tm_mday, W[tm.tm_wday]);
        lv_label_set_text(s_big, hm);
        lv_label_set_text(s_bigAmPm, ampm);
        if (*ampm) {                                   // "오후"를 숫자 왼쪽 아래에 붙인다(자리는 layoutClock 이 잡는다)
          lv_obj_clear_flag(s_bigAmPm, LV_OBJ_FLAG_HIDDEN);
          lv_obj_update_layout(s_big);
          lv_obj_align_to(s_bigAmPm, s_big, LV_ALIGN_OUT_LEFT_BOTTOM, -8, -14);
        } else lv_obj_add_flag(s_bigAmPm, LV_OBJ_FLAG_HIDDEN);
        lv_label_set_text_fmt(s_bigDate, "%d월 %d일 %s요일", tm.tm_mon + 1, tm.tm_mday, W[tm.tm_wday]);
        if (first) s_week = -1;
        renderTT();
        renderMeal();
        if (s_principal && s_view == V_CLOCK) renderPrincipal();
        if (s_pTeach && !lv_obj_has_flag(s_pTeach, LV_OBJ_FLAG_HIDDEN)) renderTeach();   // 교시가 바뀌면 명단도
        if (s_principal && s_view == V_WEEK && tm.tm_hour == 0 && tm.tm_min == 0) renderSchedList();   // 자정에 '오늘' 바꾸기
        refreshStale();
        if (s_view == V_FIND) renderFinder();
        static int lastDay = -1;
        if (lastDay >= 0 && tm.tm_mday != lastDay) s_syncReq = true;   // 날이 바뀌면 오늘 급식·날씨를 새로 받는다
        lastDay = tm.tm_mday;
        unlock();
      }
    }
  }
  // 불이 꺼져 있을 때 터치가 오면 바로 켠다. 그 터치는 단추로 가지 않는다(esp_lv_adapter 가 삼킨다).
  if (s_blOff && g_touchWoke && blReady()) {
    g_touchWoke = false; g_touchSwallow = false; s_blOff = false;
    blSet(true);
    lock(); lv_disp_trig_activity(NULL); unlock();
    Serial.println("backlight on (touch)");
  }
  // 밤(22:00~07:00)·주말·휴일에는 2분 동안 터치가 없으면 화면 불을 끈다. 만지면 켜진다(사용자 지시 2026-09-30).
  static uint32_t lastBl = 0;
  if (ms - lastBl > 2000 && blReady() && timeValid()) {
    lastBl = ms;
    time_t t = time(nullptr); struct tm tm; localtime_r(&t, &tm);
    const int m = tm.tm_hour * 60 + tm.tm_min;
    bool quiet = m < 7 * 60 || m >= 22 * 60;   // 22:00~07:00(사용자 지시 2026-10-01)
    lock();
    if (!quiet) quiet = isOffDay(nullptr);      // 주말·휴일(교장 모드는 학사 일정의 '휴')
    bool off = quiet && lv_disp_get_inactive_time(NULL) > 2UL * 60 * 1000;
    unlock();
    if (off != s_blOff) {
      s_blOff = off;
      g_touchSwallow = off;
      blSet(!off);
      Serial.printf("backlight %s\n", off ? "off" : "on");
    }
  }

  // 새벽 3시대: 화면이 꺼져 있고 받는 중이 아닐 때, 내부 RAM 이 조각났거나(와이파이·HTTPS 가 실패하기 쉬움) 4번 넘게 잇따라
  // 실패했으면 스스로 다시 켠다(하루 한 번). 낮에는 하지 않는다.
  static uint32_t lastHealth = 0;
  if (ms - lastHealth > 60000 && timeValid()) {
    lastHealth = ms;
    time_t t = time(nullptr); struct tm tm; localtime_r(&t, &tm);
    const unsigned big = heap_caps_get_largest_free_block(MALLOC_CAP_INTERNAL);
    if (tm.tm_hour == 3 && s_blOff && s_sync == SYNC_IDLE && ms > 3600000UL && (big < 40000 || s_failCount >= 4)) {
      Serial.printf("health restart (internal largest %u, fails %d)\n", big, s_failCount);
      delay(100); ESP.restart();
    }
  }

  // 20분 동안 터치가 없으면 시계 모드(큰 시계 + 오늘 시간표)로 간다(사용자 지시 2026-09-30)
  static uint32_t lastIdleCheck = 0;
  if (ms - lastIdleCheck > 5000) {
    lastIdleCheck = ms;
    lock();
    const uint32_t idle = lv_disp_get_inactive_time(NULL), lim = (uint32_t)s_autoClkMin * 60 * 1000;
    // 비밀번호를 입력하던 중이면 한도의 두 배까지 기다린다. 시계 화면이어도 열린 덮개 창은 닫는다.
    const bool typing = s_pwBox && !lv_obj_has_flag(s_pwBox, LV_OBJ_FLAG_HIDDEN) && idle < lim * 2;
    if (s_autoClkMin > 0 && idle > lim && !typing && (s_view != V_CLOCK || overlayOpen())) {
      hideOverlays();
      if (s_view != V_CLOCK) showView(V_CLOCK);
    }
    unlock();
  }
  delay(20);
}