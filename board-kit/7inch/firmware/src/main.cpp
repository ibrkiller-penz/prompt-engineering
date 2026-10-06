// 교실 알림판 — Waveshare ESP32-S3-Touch-LCD-7 (800x480)
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
#include "wx_icons.h"
#include "board_config.h"   // 보드(사람)마다 바꾸는 값
#include <math.h>

LV_FONT_DECLARE(kr14);
LV_FONT_DECLARE(kr16);
LV_FONT_DECLARE(kr20);
LV_FONT_DECLARE(kr28);
LV_FONT_DECLARE(num120);   // 시계 (2026-10-06 140 → 120, 미리보기 F)
LV_FONT_DECLARE(num36);    // 날씨 기온 (44 → 36)

using namespace esp_panel::drivers;
using namespace esp_panel::board;

static const char *FW_VERSION = "0.1.0";
static const char *BASE_URL = BOARD_BASE_URL;

// board_config.h 의 값이 비어 있으면(=아직 설정 안 함) 그 기능은 조용히 건너뛰고 화면에 '설정 필요'만 보인다.
constexpr bool cfgSet(const char *s) { return s && s[0]; }
static constexpr bool HAS_MEAL = cfgSet(NEIS_ATPT_CODE) && cfgSet(NEIS_SCHOOL_CODE);   // 급식
static constexpr bool HAS_WX = cfgSet(WEATHER_LAT) && cfgSet(WEATHER_LON);              // 날씨·미세먼지
static bool urlUnset() { return strstr(BASE_URL, "YOUR-SITE-ID") != nullptr; }            // 사이트 주소를 아직 안 바꿨나
static int s_W = 800, s_H = 480;   // 화면 크기(initDisplay 가 패널에서 읽는다)
// ← 우리 학교 교시 시작 시각으로 바꾸기. 아래 코드의 "12:30"·"13:30"(점심), "08:40"(수업 전), "16:30"(수업 끝) 도 같이 확인한다.
static const char *PERIOD_START[7] = {"08:40", "09:40", "10:40", "11:40", "13:30", "14:40", "15:40"};
static const char *DOW[5] = {"월", "화", "수", "목", "금"};

// ── 색 ──
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
#define D_RED 0xef4444

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
static lv_obj_t *s_wifiList, *s_wifiInfo, *s_pwBox, *s_pwTa, *s_kb, *s_ttPick;
static String s_pickSsid;

// ── 화면 밀림 대처(Waveshare/Espressif 매뉴얼 'Why do I get drift', 19_개발보드2 와 같게 2026-10-06) ──
// · 와이파이·플래시 쓰기 동안은 PSRAM 이 바빠 박자가 어긋난다 → 그동안 PCLK 를 6MHz 로 낮춘다.
// · 끝나면 16MHz 로 되돌리고 esp_lcd_rgb_panel_restart() 로 박자를 다시 맞춘다.
// · 그래도 밀릴 수 있으니 1분마다 한 번 다시 맞춘다(loop) — 밀려도 1분 안에 제자리.
// (CONFIG_LCD_RGB_RESTART_IN_VSYNC 는 쓰지 않는다 — esp-idf#19070)
static LCD *s_lcd = nullptr;
static const uint32_t PCLK_HZ = 16 * 1000 * 1000, PCLK_SLOW_HZ = 6 * 1000 * 1000;
static bool s_lcdSlow = false;
static esp_lcd_panel_handle_t panelHandle() { return s_lcd ? (esp_lcd_panel_handle_t)s_lcd->getHandle() : nullptr; }
static void panelResync() {
  esp_lcd_panel_handle_t p = panelHandle();
  if (!p) return;
  esp_err_t e = esp_lcd_rgb_panel_restart(p);
  if (e != ESP_OK) Serial.printf("panel restart: %s\n", esp_err_to_name(e));
}
static void lcdSlow(bool slow) {
  esp_lcd_panel_handle_t p = panelHandle();
  if (!p || slow == s_lcdSlow) return;
  s_lcdSlow = slow;
  esp_lcd_rgb_panel_set_pclk(p, slow ? PCLK_SLOW_HZ : PCLK_HZ);
  delay(slow ? 40 : 25);           // 한 장 그려질 때까지(6MHz 에서 약 30ms)
  if (!slow) panelResync();
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
  const int CLK_Y = S(22), CLK_H = 88, DATE_H = 29;                     // num120 줄 높이 88, kr28 줄 높이 29
  lv_obj_align(s_big, LV_ALIGN_TOP_MID, s_h12 ? S(30) : 0, CLK_Y);
  const int DATE_Y = CLK_Y + CLK_H + S(20);
  lv_obj_set_width(s_bigDate, LW); lv_obj_set_pos(s_bigDate, 0, DATE_Y);
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
  lv_obj_set_style_radius(o, radius, 0);
  lv_obj_clear_flag(o, LV_OBJ_FLAG_SCROLLABLE);
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

static void renderToday() {
  lv_label_set_text(s_title, s_ttName.length() ? s_ttName.c_str() : BOARD_TITLE);
  if (!s_ttLoaded) {
    lv_label_set_text(s_dayTitle, urlUnset() ? "시간표 주소 설정 필요" : s_prefs.getString("ssid", "").length() ? "시간표를 받는 중…" : "설정에서 와이파이를 연결하세요");
    return;
  }
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
    if (now) { border = 0xf1f5f9; colA = C_TEXT; colB = C_MUTED; }
    lv_obj_set_style_bg_color(s_row[r], lv_color_hex(now ? 0xf1f5f9 : D_ROW), 0);
    lv_obj_set_style_border_color(s_row[r], lv_color_hex(border), 0);
    lv_obj_set_style_border_width(s_row[r], 1, 0);
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
    lv_obj_set_style_bg_color(s_rowP[r], lv_color_hex(now ? D_RED : D_LINE), 0);
    lv_obj_t *pl = lv_obj_get_child(s_rowP[r], 0);
    lv_obj_set_style_text_color(pl, lv_color_hex(now ? 0xffffff : D_SUB), 0);
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
      lv_obj_set_style_bg_color(o, lv_color_hex(nowCell ? 0xf1f5f9 : (*t ? D_ROW : D_PANEL)), 0);
      lv_obj_set_style_border_color(o, lv_color_hex(nowCell ? 0xf1f5f9 : (*t ? st.border : D_LINE)), 0);
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
    lv_obj_set_style_bg_color(s_pl[p], lv_color_hex(now ? D_RED : D_PANEL), 0);
    lv_obj_set_style_text_color(lv_obj_get_child(s_pl[p], 0), lv_color_hex(now ? 0xffffff : D_SUB), 0);
  }
}

static void renderTT() { renderToday(); renderWeek(); }

static bool loadTTFromFile() {
  File f = LittleFS.open("/tt.json", "r");
  if (!f) return false;
  JsonDocument tmp(&s_alloc);
  DeserializationError e = deserializeJson(tmp, f);
  f.close();
  if (e) { Serial.printf("tt.json parse: %s\n", e.c_str()); return false; }
  s_tt = std::move(tmp);
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
static void fillPicker() {
  JsonArray items = s_index["items"].as<JsonArray>();
  if (items.isNull() || !s_ttPick) return;
  String opts; int sel = -1, i = 0;
  for (JsonObject it : items) {
    const char *lb = it["label"] | "";
    if (!*lb) lb = it["name"] | "";
    if (i) opts += "\n";
    opts += lb;
    if (s_pickName == (const char *)(it["name"] | "")) { sel = i; s_ttFile = (const char *)(it["file"] | ""); }
    i++;
  }
  lv_dropdown_set_options(s_ttPick, opts.c_str());
  if (sel >= 0) lv_dropdown_set_selected(s_ttPick, sel);
}
static bool parseIndex(const String &body) {
  JsonDocument d(&s_alloc);
  if (deserializeJson(d, body) || d["items"].isNull()) return false;
  s_index = std::move(d);
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
    if (parseIndex(body)) { File f = LittleFS.open("/index.json", "w"); if (f) { f.print(body); f.close(); } ok = true; }
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
      File f = LittleFS.open("/meal.json", "w");
      if (f) { f.print(date); f.print('\n'); f.print(body); f.close(); }
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
      File f = LittleFS.open("/wx.json", "w");
      if (f) { f.print(body); f.close(); }
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
    if (parseAir(body)) { File f = LittleFS.open("/air.json", "w"); if (f) { f.print(body); f.close(); } ok = true; }
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
  if (!HAS_MEAL) { lv_label_set_text(s_mealTitle, "급식"); lv_label_set_text(s_meal, "급식 설정 필요 (board_config.h)"); lv_label_set_text(s_kcal, ""); return; }
  const bool today = s_mealDate.length() && s_mealDate == todayIso();
  const int nm = timeValid() ? nowMin() : 0;
  bool dinner = today && nm >= toMin("13:30") && s_mDinner.length();
  if (today && !s_mLunch.length() && s_mDinner.length()) dinner = true;
  lv_label_set_text(s_mealTitle, dinner ? "저녁" : "점심");
  const String &menu = dinner ? s_mDinner : s_mLunch;
  const String &kcal = dinner ? s_mDinnerKcal : s_mLunchKcal;
  if (!today) { lv_label_set_text(s_meal, "급식 정보를 받는 중입니다"); lv_label_set_text(s_kcal, ""); }
  else if (!menu.length()) { lv_label_set_text(s_meal, "오늘은 급식이 없습니다"); lv_label_set_text(s_kcal, ""); }
  else { lv_label_set_text(s_meal, menu.c_str()); lv_label_set_text(s_kcal, kcal.c_str()); }
}
// ── 와이파이 ──
// 와이파이가 켜져 있으면 PSRAM 을 같이 써서 화면이 흔들린다. 그래서 평소에는 꺼 두고,
// 1시간마다(그리고 켤 때·설정에서 와이파이를 고를 때) 잠깐 켜서 시간을 맞추고 시간표를 받은 뒤 끈다(사용자 지시 2026-09-30).
enum SyncState { SYNC_IDLE, SYNC_CONNECTING, SYNC_TIME };
static SyncState s_sync = SYNC_IDLE;
static uint32_t s_syncStart = 0, s_lastSync = 0;
static bool s_triedOnce = false, s_lastOk = false;
static int s_failCount = 0;   // 잇따라 실패한 횟수. 실패하면 1·2·5·10분 뒤 다시, 그 뒤로는 10분마다
static char s_lastHM[8] = "";
static volatile bool s_syncReq = false;
static const uint32_t SYNC_EVERY_MS = 3600UL * 1000;

static void setStatus(const char *s) { if (s_status) lv_label_set_text(s_status, s); }
static void refreshWifiLabel() {
  String ssid = s_prefs.getString("ssid", "");
  if (!ssid.length()) {
    lv_label_set_text(s_wifiLbl, LV_SYMBOL_WIFI " 와이파이 없음");
    lv_obj_set_style_text_color(s_wifiLbl, lv_color_hex(C_ROSE), 0);
    lv_label_set_text(s_wifiInfo, "저장한 와이파이가 없습니다. [찾기]를 누르고 목록에서 고르세요.");
    return;
  }
  if (s_sync != SYNC_IDLE) {
    lv_label_set_text(s_wifiLbl, LV_SYMBOL_REFRESH " 받는 중…");
    lv_obj_set_style_text_color(s_wifiLbl, lv_color_hex(0xb45309), 0);
    lv_label_set_text_fmt(s_wifiInfo, "'%s'에 잠깐 연결해 시간과 시간표를 받는 중입니다.", ssid.c_str());
    return;
  }
  if (!s_triedOnce) lv_label_set_text(s_wifiLbl, LV_SYMBOL_WIFI " 대기");
  else lv_label_set_text_fmt(s_wifiLbl, "%s %s %s", LV_SYMBOL_WIFI, s_lastHM, s_lastOk ? "받음" : "실패");
  lv_obj_set_style_text_color(s_wifiLbl, lv_color_hex(!s_triedOnce || s_lastOk ? C_EMERALD : C_ROSE), 0);
  lv_label_set_text_fmt(s_wifiInfo, "'%s' 저장됨. 1시간마다 잠깐 연결해 시간과 시간표를 받고 끕니다.%s%s",
                        ssid.c_str(), s_triedOnce ? (s_lastOk ? " 마지막: " : " 마지막 시도 실패: ") : "", s_triedOnce ? s_lastHM : "");
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
  lcdSlow(true);                 // 받는 동안 화면 박자를 낮춘다(매뉴얼)
  WiFi.persistent(false);        // Arduino 의 자체 저장본은 쓰지 않는다(설정 저장본 하나만)
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(false);
  s_wifiReason = 0; s_retried = false;
  wifiBegin();
  s_sync = SYNC_CONNECTING; s_syncStart = millis();
  Serial.printf("sync: connecting %s (internal free %u, largest %u)\n", ssid.c_str(),
                (unsigned)heap_caps_get_free_size(MALLOC_CAP_INTERNAL), (unsigned)heap_caps_get_largest_free_block(MALLOC_CAP_INTERNAL));
  lock(); refreshWifiLabel(); setStatus("연결하는 중…"); unlock();
}
static void finishSync(bool ok, const char *msg) {
  s_triedOnce = true; s_lastOk = ok; s_lastSync = millis();
  s_failCount = ok ? 0 : s_failCount + 1;
  if (timeValid()) { time_t t = time(nullptr); struct tm tm; localtime_r(&t, &tm); snprintf(s_lastHM, sizeof s_lastHM, "%02d:%02d", tm.tm_hour, tm.tm_min); }
  wifiOff();
  lcdSlow(false);                // 되돌리고 박자를 다시 맞춘다
  s_sync = SYNC_IDLE;
  Serial.printf("sync: %s (%s)\n", ok ? "ok" : "fail", msg);
  lock(); refreshWifiLabel(); setStatus(msg); unlock();
}

// 설정에서 와이파이를 고르면 저장하고 바로 한 번 받아 온다
static void connectWifi(const String &ssid, const String &pw, bool save) {
  if (save) { s_prefs.putString("ssid", ssid); s_prefs.putString("pw", pw); }
  if (s_sync != SYNC_IDLE) wifiOff();
  s_sync = SYNC_IDLE;
  s_syncReq = true;
}
static void onPwOk(lv_event_t *e);
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
  lv_obj_clear_flag(s_pwBox, LV_OBJ_FLAG_HIDDEN);
  lv_obj_clear_flag(s_kb, LV_OBJ_FLAG_HIDDEN);
}
static void onPwOk(lv_event_t *e) {
  lv_event_code_t code = lv_event_get_code(e);
  if (code == LV_EVENT_READY) {
    String pw = lv_textarea_get_text(s_pwTa);
    lv_obj_add_flag(s_pwBox, LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_flag(s_kb, LV_OBJ_FLAG_HIDDEN);
    lv_label_set_text_fmt(s_wifiInfo, "'%s'에 연결하는 중…", s_pickSsid.c_str());
    connectWifi(s_pickSsid, pw, true);
  } else if (code == LV_EVENT_CANCEL) {
    lv_obj_add_flag(s_pwBox, LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_flag(s_kb, LV_OBJ_FLAG_HIDDEN);
  }
}
static volatile bool s_scanReq = false;
static void onScan(lv_event_t *e) { s_scanReq = true; lv_obj_clean(s_wifiList); lv_list_add_text(s_wifiList, "찾는 중…"); }
static void onForget(lv_event_t *e) {
  s_prefs.remove("ssid"); s_prefs.remove("pw"); wifiOff(); s_sync = SYNC_IDLE; refreshWifiLabel();
}

// 화면: 0 주간 시간표 · 1 설정 · 2 시계 모드 · 3 선생님 찾기
enum View { V_WEEK = 0, V_SET = 1, V_CLOCK = 2, V_FIND = 3 };
static View s_view = V_WEEK;

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
  s_where = std::move(d);
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
    if (parseWhere(body)) { File f = LittleFS.open("/where.json", "w"); if (f) { f.print(body); f.close(); } ok = true; }
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
    lv_obj_set_style_bg_color(s_findRow[p], lv_color_hex(now ? 0xf1f5f9 : D_ROW), 0);
    lv_obj_set_style_border_color(s_findRow[p], lv_color_hex(now ? 0xf1f5f9 : (k ? styleOf(k).border : D_LINE)), 0);
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
    lv_obj_set_style_radius(b, 8, 0);
    lv_obj_t *l = lv_label_create(b);
    lv_obj_set_style_text_font(l, &kr16, 0);
    lv_obj_set_style_text_color(l, lv_color_hex(D_TEXT), 0);
    lv_label_set_text(l, t["n"] | "");
    lv_obj_center(l);
    lv_obj_add_event_cb(b, onFindPick, LV_EVENT_CLICKED, nullptr);
  }
}
static void buildFinder(lv_obj_t *scr, int top) {
  const int M = 12, H = s_H - top;
  s_viewFind = box(scr, D_BG, 0, 0);
  lv_obj_set_size(s_viewFind, s_W, H); lv_obj_set_pos(s_viewFind, 0, top);
  lv_obj_add_flag(s_viewFind, LV_OBJ_FLAG_HIDDEN);
  const int LW = 440, PH = H - 2 * M + 4;
  lv_obj_t *left = box(s_viewFind, D_PANEL, D_LINE, 16);
  lv_obj_set_size(left, LW, PH); lv_obj_set_pos(left, M, M - 4);
  lv_obj_set_pos(label(left, &kr14, D_MUTED, "선생님을 고르세요"), 16, 12);
  s_findGrid = lv_obj_create(left);
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
  lv_obj_set_style_bg_grad_dir(nowBox, LV_GRAD_DIR_HOR, 0);
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
  lv_obj_set_style_bg_color(tab, lv_color_hex(on ? D_LINE : D_ROW), 0);
  lv_obj_set_style_text_color(lv_obj_get_child(tab, 0), lv_color_hex(on ? D_TEXT : D_MUTED), 0);
}
static void showView(View v) {
  s_view = v;
  auto vis = [](lv_obj_t *o, bool on) { if (on) lv_obj_clear_flag(o, LV_OBJ_FLAG_HIDDEN); else lv_obj_add_flag(o, LV_OBJ_FLAG_HIDDEN); };
  vis(s_viewTT, v == V_WEEK);
  vis(s_viewSet, v == V_SET);
  vis(s_viewClock, v == V_CLOCK);
  vis(s_viewFind, v == V_FIND);
  tabStyle(s_tabTT, v == V_WEEK);
  tabStyle(s_tabSet, v == V_SET);
  tabStyle(s_tabClock, v == V_CLOCK);
  tabStyle(s_tabFind, v == V_FIND);
  if (v == V_FIND) { if (s_findGridDirty) fillFinderGrid(); renderFinder(); }
  if (v == V_SET) refreshWifiLabel();
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
static void onThisWeek(lv_event_t *e) { s_week = currentWeek(); renderWeek(); }static void onPickTT(lv_event_t *e) {
  uint16_t i = lv_dropdown_get_selected(s_ttPick);
  JsonObject it = s_index["items"][i];
  if (!it.isNull()) {
    s_pickName = (const char *)(it["name"] | "");
    s_ttFile = (const char *)(it["file"] | "");
    s_prefs.putString("ttname", s_pickName);
  }
  s_syncReq = true;
}

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
  lv_obj_set_style_bg_grad_dir(logo, LV_GRAD_DIR_HOR, 0);
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
      lv_obj_set_style_bg_color(s_cellTag[d][p], lv_color_hex(0xea580c), 0);
      lv_obj_set_style_radius(s_cellTag[d][p], 6, 0);
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
  s_big = label(left, &num120, D_TEXT, "--:--");
  s_bigAmPm = label(left, &kr28, D_SUB, "");
  lv_obj_add_flag(s_bigAmPm, LV_OBJ_FLAG_HIDDEN);
  s_bigDate = label(left, &kr28, D_SUB, "");
  lv_obj_set_style_text_align(s_bigDate, LV_TEXT_ALIGN_CENTER, 0);

  // 날씨 카드(오늘 | 내일, 아래 줄 미세먼지)
  lv_obj_t *wc = s_wxCard = box(left, D_ROW, D_LINE, 14);
  lv_obj_clear_flag(wc, LV_OBJ_FLAG_CLICKABLE);
  s_wxSep = box(wc, D_LINE, 0, 0);
  s_wxSep2 = box(wc, D_LINE, 0, 0);
  s_dust = label(wc, &kr14, D_SUB, "");                               // '● 미세먼지 좋음 · PM10 15 · 초미세 12'
  lv_label_set_recolor(s_dust, true);
  lv_label_set_long_mode(s_dust, LV_LABEL_LONG_DOT);
  for (int i = 0; i < 2; i++) {
    WxCard &k = s_card[i];
    k.img = lv_img_create(wc);
    k.desc = label(wc, &kr14, D_MUTED, i == 0 ? "오늘" : "내일");      // "오늘 27°/19°"
    k.temp = label(wc, &num36, D_TEXT, "");
    k.hilo = label(wc, &kr14, D_SUB, "");                               // "맑음 · 비 0%"
    lv_label_set_recolor(k.hilo, true);
    lv_label_set_long_mode(k.hilo, LV_LABEL_LONG_DOT);
    k.rain = nullptr;
  }

  // '오늘' 카드(할 일 · 점심/저녁)
  lv_obj_t *ic = s_infoCard = box(left, D_ROW, D_LINE, 14);
  lv_obj_clear_flag(ic, LV_OBJ_FLAG_CLICKABLE);
  s_dutyTitle = label(ic, &kr14, D_MUTED, "할 일");
  s_duty = label(ic, &kr14, 0xfcd34d, "");
  lv_label_set_long_mode(s_duty, LV_LABEL_LONG_DOT);
  s_infoHr = box(ic, D_LINE, 0, 0);
  s_mealTitle = label(ic, &kr14, D_MUTED, "점심");
  s_meal = label(ic, &kr14, 0xe2e8f0, "");
  lv_obj_set_style_text_line_space(s_meal, 2, 0);
  lv_label_set_long_mode(s_meal, LV_LABEL_LONG_DOT);
  s_kcal = label(ic, &kr14, 0x64748b, "");

  // 맨 아래: 수업 10분 전부터 '다음 수업' 띠
  s_notice = box(left, C_PRIMARY, 0, 18);
  lv_obj_clear_flag(s_notice, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_set_style_bg_grad_color(s_notice, lv_color_hex(0x3730a3), 0);
  lv_obj_set_style_bg_grad_dir(s_notice, LV_GRAD_DIR_HOR, 0);
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
  lv_obj_set_style_radius(s_dayTag, 10, 0);
  lv_obj_set_style_pad_hor(s_dayTag, 8, 0);
  lv_obj_align(s_dayTag, LV_ALIGN_TOP_RIGHT, -S(12), S(12));
  lv_obj_add_flag(s_dayTag, LV_OBJ_FLAG_HIDDEN);
  s_dday = label(right, &kr14, 0xfecaca, "");                        // 수능 D-day (수능 다음 날부터 숨긴다)
  lv_obj_set_style_bg_opa(s_dday, LV_OPA_COVER, 0);
  lv_obj_set_style_bg_color(s_dday, lv_color_hex(0x7f1d1d), 0);
  lv_obj_set_style_border_width(s_dday, 1, 0);
  lv_obj_set_style_border_color(s_dday, lv_color_hex(0xef4444), 0);
  lv_obj_set_style_radius(s_dday, 11, 0);
  lv_obj_set_style_pad_hor(s_dday, 10, 0);
  lv_obj_set_style_pad_ver(s_dday, 2, 0);
  lv_obj_align(s_dday, LV_ALIGN_TOP_RIGHT, -S(12), S(11));
  lv_obj_add_flag(s_dday, LV_OBJ_FLAG_HIDDEN);
  const int ROW_Y0 = S(44), ROW_X = S(12), ROW_W = RW - 2 * ROW_X;
  const int ROW_PITCH = (PH - ROW_Y0 - S(12)) / 8, ROW_H = ROW_PITCH - S(6), PW = S(64);
  for (int r = 0; r < 8; r++) {
    int p = periodOfRow(r);
    s_row[r] = box(right, D_ROW, D_LINE, 8);
    lv_obj_clear_flag(s_row[r], LV_OBJ_FLAG_CLICKABLE);
    lv_obj_set_size(s_row[r], ROW_W, ROW_H); lv_obj_set_pos(s_row[r], ROW_X, ROW_Y0 + r * ROW_PITCH);
    s_rowP[r] = box(s_row[r], D_LINE, 0, 6);
    lv_obj_set_size(s_rowP[r], PW, ROW_H - 8); lv_obj_align(s_rowP[r], LV_ALIGN_LEFT_MID, S(6) - 1, 0);
    lv_obj_t *pl = label(s_rowP[r], &kr14, D_SUB, "");
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
    s_rowB[r] = label(s_row[r], &kr14, D_SUB, "");
    lv_obj_set_width(s_rowB[r], S(110)); lv_label_set_long_mode(s_rowB[r], LV_LABEL_LONG_DOT);
    lv_obj_set_style_text_align(s_rowB[r], LV_TEXT_ALIGN_RIGHT, 0);
    lv_obj_align(s_rowB[r], LV_ALIGN_RIGHT_MID, -S(14), 0);
    s_rowTag[r] = label(s_row[r], &kr14, 0xffffff, "");
    lv_obj_set_style_bg_opa(s_rowTag[r], LV_OPA_COVER, 0);
    lv_obj_set_style_bg_color(s_rowTag[r], lv_color_hex(0xea580c), 0);
    lv_obj_set_style_radius(s_rowTag[r], 6, 0);
    lv_obj_set_style_pad_hor(s_rowTag[r], 5, 0);
    lv_obj_add_flag(s_rowTag[r], LV_OBJ_FLAG_HIDDEN);
  }

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
  s_wifiInfo = label(wbox, &kr14, C_MUTED, "");
  lv_obj_set_width(s_wifiInfo, WBW - 130); lv_label_set_long_mode(s_wifiInfo, LV_LABEL_LONG_WRAP);
  lv_obj_set_pos(s_wifiInfo, 12, small ? 36 : 44);
  lv_obj_t *bScan = button(wbox, "찾기", small ? 90 : 110, small ? 34 : 40, C_PRIMARY, 0xffffff);
  lv_obj_align(bScan, LV_ALIGN_TOP_RIGHT, -10, 8); lv_obj_add_event_cb(bScan, onScan, LV_EVENT_CLICKED, nullptr);
  const int LY = small ? 76 : 90, FH = small ? 30 : 34;
  s_wifiList = lv_list_create(wbox);
  lv_obj_set_size(s_wifiList, WBW - 24, BOXH - LY - FH - 16); lv_obj_set_pos(s_wifiList, 12, LY);
  lv_obj_set_style_text_font(s_wifiList, fBody, 0);
  lv_obj_t *bForget = button(wbox, "저장한 와이파이 지우기", small ? 190 : 220, FH, C_ALT, C_MUTED);
  lv_obj_align(bForget, LV_ALIGN_BOTTOM_LEFT, 12, -8); lv_obj_add_event_cb(bForget, onForget, LV_EVENT_CLICKED, nullptr);

  lv_obj_t *obox = box(s_viewSet, C_SURF, C_BORDER, 10);
  lv_obj_set_size(obox, OBW, BOXH); lv_obj_set_pos(obox, 2 * M + WBW, M);
  lv_obj_set_pos(label(obox, fTitle, C_TEXT, "볼 시간표"), 12, 10);
  s_ttPick = lv_dropdown_create(obox);
  lv_obj_set_style_text_font(s_ttPick, fBody, 0);
  lv_obj_set_style_text_font(lv_dropdown_get_list(s_ttPick), fBody, 0);
  lv_dropdown_set_options(s_ttPick, BOARD_DEFAULT_TT);   // 목록(index.json)을 받으면 fillPicker 가 채운다
  lv_obj_set_style_max_height(lv_dropdown_get_list(s_ttPick), s_H * 2 / 3, 0);
  lv_obj_set_width(s_ttPick, OBW - 24); lv_obj_set_pos(s_ttPick, 12, small ? 40 : 50);

  lv_obj_add_event_cb(s_ttPick, onPickTT, LV_EVENT_VALUE_CHANGED, nullptr);
  lv_obj_t *bSync = button(obox, "지금 받기", OBW - 24, small ? 34 : 40, C_PRIMARY, 0xffffff);
  lv_obj_set_pos(bSync, 12, small ? 88 : 104);
  lv_obj_add_event_cb(bSync, [](lv_event_t *) { s_syncReq = true; setStatus("곧 연결합니다…"); }, LV_EVENT_CLICKED, nullptr);
  s_status = label(obox, &kr14, C_MUTED, "");
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
  s_pwBox = box(scr, C_SURF, C_BORDER, 12);
  lv_obj_set_size(s_pwBox, s_W - 160, small ? 110 : 130); lv_obj_align(s_pwBox, LV_ALIGN_TOP_MID, 0, TOP + 6);
  lv_obj_set_style_shadow_width(s_pwBox, 30, 0); lv_obj_set_style_shadow_opa(s_pwBox, LV_OPA_30, 0);
  lv_obj_align(label(s_pwBox, fTitle, C_TEXT, ""), LV_ALIGN_TOP_LEFT, 14, 10);
  s_pwTa = lv_textarea_create(s_pwBox);
  lv_textarea_set_one_line(s_pwTa, true);
  lv_textarea_set_password_mode(s_pwTa, false);   // 칠판 앞에서 치므로 보이게(오타 확인)
  lv_obj_set_style_text_font(s_pwTa, small ? &lv_font_montserrat_20 : &lv_font_montserrat_24, 0);
  lv_obj_set_size(s_pwTa, s_W - 192, small ? 48 : 56); lv_obj_align(s_pwTa, LV_ALIGN_BOTTOM_MID, 0, -10);
  lv_obj_add_flag(s_pwBox, LV_OBJ_FLAG_HIDDEN);
  s_kb = lv_keyboard_create(scr);
  lv_obj_set_size(s_kb, s_W, s_H / 2);
  lv_keyboard_set_textarea(s_kb, s_pwTa);
  lv_obj_add_event_cb(s_kb, onPwOk, LV_EVENT_ALL, nullptr);
  lv_obj_add_flag(s_kb, LV_OBJ_FLAG_HIDDEN);
}

// ── 화면 장치 ──
static void initDisplay() {
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
}

void setup() {
  Serial.begin(115200);
  Serial.printf("\n교실 알림판 v%s\n", FW_VERSION);
  if (!LittleFS.begin(true)) Serial.println("LittleFS mount failed");
  s_prefs.begin("board", false);
  s_pickName = s_prefs.getString("ttname", BOARD_DEFAULT_TT);           // 설정에서 고른 시간표 이름(없으면 board_config.h 의 처음 값)
  s_h12 = s_prefs.getBool("h12", false);
  s_autoClkMin = s_prefs.getInt("autoclk", 20);
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
  fillPicker();
  renderTT();
  refreshWifiLabel();
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

  // 1분마다 화면 박자를 다시 맞춘다(밀려도 1분 안에 제자리로). 받는 중에는 끝날 때 맞춘다.
  static uint32_t lastResync = 0;
  if (ms - lastResync > 60000 && s_sync == SYNC_IDLE) {
    lastResync = ms;
    if (s_lcdSlow) lcdSlow(false); else panelResync();   // 와이파이 재설정 등으로 느린 채 남았으면 되돌린다
  }

  // 1시간마다 잠깐 연결: 연결 → 시간 맞추기 → 시간표 받기 → 끄기
  if (s_sync == SYNC_IDLE) {
    static const uint32_t RETRY_MS[] = {60000, 120000, 300000, 600000};
    uint32_t wait = s_lastOk ? SYNC_EVERY_MS : RETRY_MS[s_failCount < 4 ? (s_failCount > 0 ? s_failCount - 1 : 0) : 3];
    bool due = s_prefs.isKey("ssid") && (!s_triedOnce || ms - s_lastSync > wait);
    if (ms < 5000) due = false;                                  // 켠 뒤 5초는 기다린다
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
      finishSync(false, msg);
    }
  } else if (s_sync == SYNC_TIME) {
    bool synced = sntp_get_sync_status() == SNTP_SYNC_STATUS_COMPLETED || (timeValid() && ms - s_syncStart > 8000);
    if (synced || ms - s_syncStart > 15000) {
      lock(); setStatus("시간표를 받는 중…"); unlock();
      if (downloadIndex()) { lock(); fillPicker(); unlock(); }
      bool ok = downloadTT();
      bool loaded = ok && loadTTFromFile();
      bool wx = downloadWeather();
      bool meal = downloadMeal();
      bool air = downloadAir();
      bool whr = downloadWhere();
      lock(); if (loaded) { s_week = -1; renderTT(); } if (wx) renderWeather(); if (meal) renderMeal(); if (air) renderAir(); if (whr) { fillFinderGrid(); renderFinder(); } unlock();
      finishSync(loaded, loaded ? "시간과 시간표를 받았습니다." : (ok ? "시간표 파일을 읽지 못했습니다." : "시간표를 받지 못했습니다. 인터넷을 확인하세요."));
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
        if (s_view == V_FIND) renderFinder();
        static int lastDay = -1;
        if (lastDay >= 0 && tm.tm_mday != lastDay) s_syncReq = true;   // 날이 바뀌면 오늘 급식·날씨를 새로 받는다
        lastDay = tm.tm_mday;
        unlock();
      }
    }
  }
  // 밤(22:00~07:00)·주말·휴일에는 2분 동안 터치가 없으면 화면 불을 끈다. 만지면 켜진다(사용자 지시 2026-09-30).
  static uint32_t lastBl = 0;
  if (ms - lastBl > 2000 && s_board && s_board->getBacklight() && timeValid()) {
    lastBl = ms;
    time_t t = time(nullptr); struct tm tm; localtime_r(&t, &tm);
    const int m = tm.tm_hour * 60 + tm.tm_min;
    bool quiet = tm.tm_wday == 0 || tm.tm_wday == 6 || m < 7 * 60 || m >= 22 * 60;   // 22:00~07:00(사용자 지시 2026-10-01)
    lock();
    if (!quiet && s_ttLoaded) { bool isToday; JsonObject d = findDay(isToday); if (isToday && !strcmp(d["type"] | "", "holiday")) quiet = true; }
    bool off = quiet && lv_disp_get_inactive_time(NULL) > 2UL * 60 * 1000;
    unlock();
    if (off != s_blOff) {
      s_blOff = off;
      if (off) s_board->getBacklight()->off(); else s_board->getBacklight()->on();
      Serial.printf("backlight %s\n", off ? "off" : "on");
    }
  }

  // 20분 동안 터치가 없으면 시계 모드(큰 시계 + 오늘 시간표)로 간다(사용자 지시 2026-09-30)
  static uint32_t lastIdleCheck = 0;
  if (ms - lastIdleCheck > 5000) {
    lastIdleCheck = ms;
    lock();
    if (s_autoClkMin > 0 && lv_disp_get_inactive_time(NULL) > (uint32_t)s_autoClkMin * 60 * 1000 && s_view != V_CLOCK) {
      lv_obj_add_flag(s_pwBox, LV_OBJ_FLAG_HIDDEN);
      lv_obj_add_flag(s_kb, LV_OBJ_FLAG_HIDDEN);
      showView(V_CLOCK);
    }
    unlock();
  }
  delay(20);
}