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
#include <esp_task_wdt.h>
#include <esp_system.h>
#include <mbedtls/base64.h>   // 단축키 꾸미기: 받은 조각 풀기
#include "esp_rom_crc.h"      // 단축키 꾸미기: CRC-32(zlib 과 같은 값)
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
LV_FONT_DECLARE(num38);    // 1024x600 기온(44 는 위아래 글자에 붙어 보여 줄임, 2026-11-03)
LV_FONT_DECLARE(nix100g); LV_FONT_DECLARE(nix100c); LV_FONT_DECLARE(nix70g); LV_FONT_DECLARE(nix70c);   // 닉시 시계 1024x600(시·초)
LV_FONT_DECLARE(nix80g); LV_FONT_DECLARE(nix80c); LV_FONT_DECLARE(nix56g); LV_FONT_DECLARE(nix56c);     // 닉시 시계 800x480(시·초)

using namespace esp_panel::drivers;
using namespace esp_panel::board;

static const char *FW_VERSION = "0.2.0";
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
static const lv_font_t *FTEMP() { return big() ? &num38 : &num36; }        // 기온
// ← 우리 학교 교시 시작 시각으로 바꾸기. 아래 코드의 "12:30"·"13:30"(점심), "08:40"(수업 전), "16:30"(수업 끝) 도 같이 확인한다.
static const char *PERIOD_START[7] = {"08:40", "09:40", "10:40", "11:40", "13:30", "14:40", "15:40"};
static const char *DOW[5] = {"월", "화", "수", "목", "금"};

// ── 색 ── 테마 5가지(설정 '화면 색', prefs "theme"). 1번 '따뜻함'이 원래 값. 바꾸면 다시 켜지 않고 화면 물체만 새로 만든다(rebuildUi).
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
static uint32_t s_themeRestartAt = 0;     // 화면 색을 바꾼 때(잠시 뒤 화면을 새 색으로 다시 만든다 — 다시 켜지 않는다)
#define C_PRIMARY (s_th->C_PRIMARY)
#define C_PRIMARY50 (s_th->C_PRIMARY50)
#define C_TEXT (s_th->C_TEXT)
#define C_MUTED (s_th->C_MUTED)
#define C_LIGHT (s_th->C_LIGHT)
#define C_BG (s_th->C_BG)
#define C_SURF (s_th->C_SURF)
#define C_ALT (s_th->C_ALT)
#define C_BORDER (s_th->C_BORDER)
#define C_LINE (s_th->C_LINE)
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
#define NOW_ROW (s_th->NOW_ROW)       // 지금 교시 줄
#define NOW_TAG (s_th->NOW_TAG)       // 지금 교시 칸 — 빨강은 결강·시험처럼 읽혀서 쓰지 않는다
#define NOW_TX (s_th->NOW_TX)
#define NEXT_BD (s_th->NEXT_BD)       // 다음 수업 줄 테두리
#define C_SEL (s_th->C_SEL)           // 고른 단추·켜진 단추. 빨강(C_PRIMARY)은 지우기·경고에만
#define C_SEL_TX (s_th->C_SEL_TX)
#define C_OK (s_th->C_OK)             // 정상 글자(초록)
#define C_WARN (s_th->C_WARN)         // 경고 글자(주황)
#define C_DUTY (s_th->C_DUTY)         // 할 일·D-day 글자(노랑)

struct CellStyle { uint32_t bg, border, text, sub; };
static CellStyle styleOf(char t) {
  const uint32_t *k = s_th->kind;
  switch (t) {
    case 'n': return {0xe6f9f0, k[0], C_TEXT, 0x047857};
    case 'd': return {0xffedd5, k[1], 0x9a3412, 0x9a3412};
    case 'j': return {0xe0e7ff, k[2], 0x3730a3, 0x3730a3};
    case 'x': return {0xfff1f2, k[3], 0x991b1b, 0x991b1b};
    case 'c': return {0xede9fe, k[4], 0x6b21a8, 0x6b21a8};
    case 'e': return {0xfce7f3, k[5], 0x831843, 0x831843};
    case 'f': return {0xcffafe, k[6], 0x075985, 0x075985};
    case 'h': return {0xfee2e2, k[7], 0x991b1b, 0x991b1b};
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
static bool setTextIf(lv_obj_t *o, const char *t) { if (o && strcmp(lv_label_get_text(o), t)) { lv_label_set_text(o, t); return true; } return false; }
// 색·테두리·크기도 값이 다를 때만 바꾼다(LVGL 8.3 은 같은 값이어도 다시 그릴 표시를 한다 → 1분마다 그리는 넓이를 줄인다)
static void setBgIf(lv_obj_t *o, uint32_t c) { if (lv_obj_get_style_bg_color(o, 0).full != lv_color_hex(c).full) lv_obj_set_style_bg_color(o, lv_color_hex(c), 0); }
static void setBorderIf(lv_obj_t *o, uint32_t c) { if (lv_obj_get_style_border_color(o, 0).full != lv_color_hex(c).full) lv_obj_set_style_border_color(o, lv_color_hex(c), 0); }
static void setBorderWIf(lv_obj_t *o, int w) { if (lv_obj_get_style_border_width(o, 0) != w) lv_obj_set_style_border_width(o, w, 0); }
static void setTextColIf(lv_obj_t *o, uint32_t c) { if (lv_obj_get_style_text_color(o, 0).full != lv_color_hex(c).full) lv_obj_set_style_text_color(o, lv_color_hex(c), 0); }
static void setWidthIf(lv_obj_t *o, lv_coord_t w) { if (lv_obj_get_style_width(o, 0) != w) lv_obj_set_width(o, w); }
static void showIf(lv_obj_t *o, bool on) { if (!o) return; if (on == lv_obj_has_flag(o, LV_OBJ_FLAG_HIDDEN)) { if (on) lv_obj_clear_flag(o, LV_OBJ_FLAG_HIDDEN); else lv_obj_add_flag(o, LV_OBJ_FLAG_HIDDEN); } }
static bool setTextFmtIf(lv_obj_t *o, const char *fmt, ...) {   // 형식 글도 같으면 그대로
  char b[160]; va_list ap; va_start(ap, fmt); vsnprintf(b, sizeof b, fmt, ap); va_end(ap);
  return setTextIf(o, b);
}
static int s_week = -1;          // 보고 있는 주 (0부터)
static String s_ttFile = "t/001.json";   // 목록(index.json)을 받기 전에 쓰는 기본 파일(목록의 첫 시간표)
static String s_ttName = "";
static bool s_offToday = false;   // 오늘 쉬는 날인가(주말·휴일). 분이 바뀔 때 한 번 계산한다(isOffDay 는 일정 JSON 을 훑어 무겁다)
static String s_offName;          // 쉬는 까닭(주말·휴일 이름). s_offToday 와 함께 계산
static bool s_principal = false;   // 교장실 모드: s_pickName 이 '@교장'·'@교감' 이면 켜진다
static bool s_pickMissing = false; // 고른 '볼 시간표' 이름이 목록(index.json)에 없다 → 다시 고르라고 알린다
static bool s_ttSame = false;     // 마지막 시간표 받기가 304(바뀌지 않음)였나
static bool s_weekDirty = false;  // 주간표를 다시 그려야 하나(숨어 있을 때는 미뤘다가 열 때 그린다)
// 점검표: 항목마다 마지막으로 받은 시각과 마지막 결과(0 아직 · 1 성공 · -1 실패)
enum { OK_WIFI, OK_TIME, OK_TT, OK_WHR, OK_WX, OK_AIR, OK_MEAL, OK_SCH, OK_N };
static char s_okHM[OK_N][6];
static int8_t s_okRes[OK_N];
static const char *s_okFail[OK_N];   // 실패 이유(정해 둔 글만 가리킨다)
static const char *s_resetWhy = "-";  // 지난번 다시 켜진 이유(설정 버전 줄 · 기록)
static int s_crashN = 0;              // 멈춤·오류·전압 부족으로 다시 켜진 횟수(prefs "crashN", [다시 켜기]로 0)

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
static lv_obj_t *s_fmtBtn[2], *s_autoBtn[3], *s_themeBtn[5];
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
static lv_obj_t *s_rowRem[8] = {};    // 1024: 지금 줄 교시 칸 아래의 큰 '45분'(평소 숨김)
static bool s_rowRemOn[8] = {};
static int s_rowW = 0, s_rowPW = 0, s_rightW = 0;   // 오늘 시간표 줄 폭 · 교시 칸 폭 · 오른쪽 칸 폭(buildUI 에서)
static bool s_ttLayoutDirty = true;   // 제목·꼬리표·D-day 자리를 다시 계산해야 하나
static uint32_t s_ttGen = 0;          // 시간표를 새로 읽을 때마다 1 오른다(D-day 계산을 그때만 한다)
static int SC(int v) { return (int)lroundf(v * s_W / 800.0f); }   // 800 기준 값을 화면 비율대로
static int textW(const char *t, const lv_font_t *f) { lv_point_t p; lv_txt_get_size(&p, t, f, 0, 0, LV_COORD_MAX, LV_TEXT_FLAG_NONE); return p.x; }
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

// Claude 사용량 상태(설정 [사용량] 을 켠 보드만 보인다 — 처음엔 꺼짐, 사용자 지시 2026-10-31). 그리기는 renderUse
static bool s_useOn = false;
static int s_useP5 = 0, s_useP7 = 0, s_useW7 = -1, s_useErr = 0;
static char s_useR5[6] = "", s_useR7[6] = "", s_useName[13] = "";   // s_useName: 주간 한도 모델 이름(예: Fable, 팀 요금제)
static uint32_t s_useAt = 0;
static lv_obj_t *s_logo, *s_useL5, *s_useL7, *s_useBtn, *s_useClk, *s_useDeck;   // s_useClk·s_useDeck: 막대 두 줄을 담는 틀(시계·단축키 화면)
// 사용량 막대 한 줄(claude.ai 설정의 '사용 한도' 모양): 이름 | 막대 | 12% | 19:30 초기화. 만들기 useRowMake · 자리 useRowPlace · 값 useRowSet
struct UseRow { lv_obj_t *row = nullptr, *name, *track, *fill, *pct, *rst; int tw = 0, fw = -1; uint32_t col = 0; };
static UseRow s_ucRow[2], s_udRow[2];   // 시계 화면 · 단축키 화면, [0] 현재 세션 [1] 주간
static void useRowsSet(UseRow *u);
static void useRowPlace(UseRow &u, int w, int y) {   // 폭 w 로 한 줄을 다시 잡는다(시계 화면은 시간표를 켜고 끄면 폭이 바뀐다)
  if (!u.row) return;
  const int lh = lv_obj_get_style_height(u.row, 0), BH = max(6, lh * 45 / 100), G = 8;
  const int nameW = lh * 9 / 2, pctW = lh * 5 / 2, rstW = lh * 9;   // rstW: "(토) 20:00 초기화" 가 잘리지 않게
  u.tw = max(20, w - nameW - pctW - rstW - 3 * G);
  lv_obj_set_pos(u.row, 0, y); lv_obj_set_width(u.row, w);
  lv_obj_set_width(u.name, nameW); lv_obj_set_pos(u.name, 0, 0);
  lv_obj_set_size(u.track, u.tw, BH); lv_obj_set_pos(u.track, nameW + G, (lh - BH) / 2);
  lv_obj_set_width(u.pct, pctW); lv_obj_set_pos(u.pct, nameW + G + u.tw + G, 0);
  lv_obj_set_width(u.rst, rstW); lv_obj_set_pos(u.rst, w - rstW, 0);
  u.fw = -1;                                   // 막대 길이는 다음 useRowSet 에서 새 폭으로
}
static const uint32_t USE_STALE_MS = 20UL * 60000UL;              // 20분 넘게 소식이 없으면(탭덱 꺼짐) 숨긴다
static bool useShown() { return s_useOn && s_useAt && millis() - s_useAt < USE_STALE_MS; }
// 닉시 시계(설정 [닉시] — 처음부터 켜짐, 사용자 지시 2026-11-03). 숫자는 tools/make_nixie_font.py 로 만든 글꼴.
// 한 숫자를 빛(주황, 아래)과 심지(밝은 호박색, 위) 두 글자로 겹쳐 그리고, 초를 분 오른쪽에 70% 크기로 붙인다.
// 글꼴 상자에 빛 여백(base_line 과 같은 값)이 있어 글자 좌우에 같은 여백(pad)을 준다(안 주면 빛이 잘린다).
static bool s_nixOn = false;
static lv_obj_t *s_bigGlow, *s_sec, *s_secGlow, *s_nixBtn;
static const uint32_t NIX_GLOW = 0xFF4A0A, NIX_CORE = 0xFFA24C;   // 진짜 닉시관 사진처럼 주황(심지가 노랗지 않게, 사용자 지시 2026-11-01)
static const lv_font_t *FNIX(bool core) { return big() ? (core ? &nix100c : &nix100g) : (core ? &nix80c : &nix80g); }
static const lv_font_t *FNIXS(bool core) { return big() ? (core ? &nix70c : &nix70g) : (core ? &nix56c : &nix56g); }
static int nixH() { return big() ? 100 : 80; }                    // 시·분 숫자 높이
static int nixGap() { return nixH() * (s_h12 ? 6 : 12) / 100; }   // 분 → 초 간격(12시간은 오전/오후 자리 때문에 좁게)
static char s_secTxt[3] = "--";   // 닉시 초: 빛·심지 라벨이 함께 보는 글(set_text_static). 매초 이것만 고치고 바뀐 칸만 다시 그린다
// 큰 시계 둘레(오전/오후 · 닉시 빛 · 초)를 큰 시계 글자에 맞춰 놓는다. 시계 글이 바뀌어 폭이 달라질 때마다 부른다
static void placeClock() {
  lv_obj_update_layout(s_big);
  const int m = s_nixOn ? FNIX(true)->base_line : 1;              // 글자 아래 여백(num120·140 은 1)
  if (!lv_obj_has_flag(s_bigAmPm, LV_OBJ_FLAG_HIDDEN))
    lv_obj_align_to(s_bigAmPm, s_big, LV_ALIGN_OUT_LEFT_BOTTOM, s_nixOn ? -4 + m : -8, -13 - m);
  if (!s_nixOn) return;
  const int ms = FNIXS(true)->base_line;
  // 빛은 심지와 같은 자리에. align_to(TOP_LEFT)는 기준 글자의 안쪽 여백(pad)을 더해 빛이 여백만큼 오른쪽으로 밀렸다 → 좌표를 그대로 옮긴다
  lv_obj_set_pos(s_bigGlow, lv_obj_get_x(s_big), lv_obj_get_y(s_big));
  lv_obj_align_to(s_sec, s_big, LV_ALIGN_OUT_RIGHT_BOTTOM, -m - ms + nixGap(), ms - m);   // 숫자 아랫줄을 맞춘다
  lv_obj_update_layout(s_sec);                                    // 방금 옮긴 초의 좌표를 읽기 전에
  lv_obj_set_pos(s_secGlow, lv_obj_get_x(s_sec), lv_obj_get_y(s_sec));
}
// 닉시 초를 sec 로. 바뀐 숫자 칸만 다시 그리게 알린다(라벨 상자만, LVGL 이 붙이는 줄높이/4 여유 없이).
// 초의 90%는 일의 자리 칸만 → 매초 PSRAM 에 쓰는 양이 전보다 약 70% 적다(흔들림 위험을 줄인다).
// 숫자 폭이 모두 같아 라벨 크기는 그대로라 다시 정렬할 필요가 없다. LVGL 잠금 안에서 부른다.
static void nixSecShow(int sec, bool force) {
  const char t = '0' + sec / 10, u = '0' + sec % 10;
  const bool tens = force || s_secTxt[0] != t;
  if (!tens && s_secTxt[1] == u) return;
  s_secTxt[0] = t; s_secTxt[1] = u;
  const int adv = lv_font_get_glyph_width(FNIXS(false), '0', '0');
  lv_obj_t *objs[2] = {s_secGlow, s_sec};
  for (lv_obj_t *o : objs) {
    lv_area_t a; lv_obj_get_coords(o, &a);
    if (!tens) a.x1 += adv;                 // 일의 자리 칸만
    lv_obj_invalidate_area(o, &a);          // 두 번째는 같은 영역이라 LVGL 이 합친다
  }
}
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
  const int CLK_Y = S(22), DATE_H = 29;   // kr28 줄 높이 29
  const int CLK_H = s_nixOn ? nixH() : big() ? lv_font_get_line_height(FCLK()) : 88;   // num120 줄 높이 88
  if (s_nixOn) {   // 시·분과 초를 한 덩어리로 가운데에. 글자 위 빛 여백만큼 올린다
    lv_obj_update_layout(s_sec);
    const int wSec = lv_obj_get_width(s_sec) - 2 * FNIXS(true)->base_line + nixGap();
    lv_obj_align(s_big, LV_ALIGN_TOP_MID, (s_h12 ? S(24) : 0) - wSec / 2, CLK_Y - FNIX(true)->base_line);   // 12시간: 초 빛이 칸 밖으로 잘리지 않게 조금 왼쪽
  } else lv_obj_align(s_big, LV_ALIGN_TOP_MID, s_h12 ? S(30) : 0, CLK_Y);
  const int DATE_Y = CLK_Y + CLK_H + S(20);
  lv_obj_set_width(s_bigDate, LW); lv_obj_set_pos(s_bigDate, 0, DATE_Y);
  if (s_stale) { lv_obj_set_width(s_stale, LW); lv_obj_set_pos(s_stale, 0, DATE_Y + DATE_H + S(3)); }
  placeClock();

  // 카드 자리: 날짜 아래 ~ (띠가 보이면 띠 위, 아니면 아래 여백)
  const int NOTICE_H = S(40);
  lv_obj_set_size(s_notice, CW, NOTICE_H); lv_obj_set_pos(s_notice, P, PH - P - NOTICE_H + S(6));
  lv_obj_set_width(s_noticeLbl, CW - S(24)); lv_obj_center(s_noticeLbl);
  const int TOP = DATE_Y + DATE_H + S(24);
  const int bandTop = PH - P - (s_noticeOn ? NOTICE_H + S(4) : 0);   // 띠 위(띠가 없으면 아래 여백)
  const int ULH = lv_font_get_line_height(FM()), USE_H = 2 * ULH + S(8), useY = bandTop - USE_H + S(8);   // Claude 사용량 막대 두 줄(켰을 때만): 카드 아래·띠 위
  const bool useOn = s_useClk && useShown();
  if (s_useClk) {
    vis(s_useClk, useOn); lv_obj_set_size(s_useClk, CW, USE_H); lv_obj_set_pos(s_useClk, P, useY);
    useRowPlace(s_ucRow[0], CW, S(2)); useRowPlace(s_ucRow[1], CW, S(6) + ULH);
    if (useOn) useRowsSet(s_ucRow);            // 폭이 바뀌었으면 막대 길이도 다시
  }
  const int BOT = bandTop - (useOn ? USE_H - S(8) + GAP : 0);   // 카드 ~ 막대도 카드 사이와 같은 간격
  const int avail = BOT - TOP;
  const int WX_BASE = dust ? S(106) : S(84);                           // 날씨 카드: 위 블록 80 + 미세먼지 줄 28
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
    const int topArea = dust ? wxH - S(28) : wxH, yOff = (topArea - S(80)) / 2;   // 그림 52 · 기온 블록 높이 80(위·아래 글과 기온 사이를 띄운다, 디자인 검토 2026-11-03)
    lv_obj_set_size(s_wxSep, 1, S(48)); lv_obj_set_pos(s_wxSep, wxW / 2, yOff + S(15));
    vis(s_wxSep2, dust); vis(s_dust, dust);
    lv_obj_set_size(s_wxSep2, wxW - S(28), 1); lv_obj_set_pos(s_wxSep2, S(14), wxH - S(28));
    lv_obj_set_width(s_dust, wxW - S(28)); lv_obj_set_pos(s_dust, S(14), wxH - S(21));
    for (int i = 0; i < 2; i++) {
      const int x0 = i * wxW / 2;
      WxCard &k = s_card[i];
      lv_obj_set_pos(k.img, x0 + S(8), yOff + (S(80) - 2 - 52) / 2);
      lv_obj_set_pos(k.desc, x0 + S(66), yOff + S(6));
      lv_obj_set_pos(k.temp, x0 + S(66), yOff + S(27));
      lv_obj_set_width(k.hilo, wxW / 2 - S(74)); lv_obj_set_pos(k.hilo, x0 + S(66), yOff + S(58));
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
  lv_obj_set_style_text_line_space(l, lv_font_get_line_height(font) / 8, 0);   // 두 줄 글이 붙어 보이지 않게(에스코어 드림으로 바꾸며 2026-11-03)
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
  // 글자색은 단추에 두고 이름표가 물려받는다 → 누를 수 없는(DISABLED) 상태는 바탕 D_PANEL · 글자 D_MUTED 로 한 번에
  lv_obj_set_style_text_color(b, lv_color_hex(fg), 0);
  lv_obj_set_style_bg_color(b, lv_color_hex(D_PANEL), LV_STATE_DISABLED);
  lv_obj_set_style_text_color(b, lv_color_hex(D_MUTED), LV_STATE_DISABLED);
  lv_obj_set_style_border_color(b, lv_color_hex(D_LINE), LV_STATE_DISABLED);
  lv_obj_t *l = label(b, &kr16, fg, txt);
  lv_obj_remove_local_style_prop(l, LV_STYLE_TEXT_COLOR, 0);
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
static String isoAddDays(const String &iso, int n) {   // "2026-10-25" + n일
  struct tm t = {}; t.tm_year = iso.substring(0, 4).toInt() - 1900; t.tm_mon = iso.substring(5, 7).toInt() - 1; t.tm_mday = iso.substring(8, 10).toInt() + n; t.tm_hour = 12;
  mktime(&t); char b[11]; strftime(b, sizeof b, "%Y-%m-%d", &t); return String(b);
}
static bool afterSchool() { return timeValid() && nowMin() >= toMin("16:30"); }   // 수업이 끝난 뒤(내일 시간표를 보인다)

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
// 수업이 끝난 뒤(16:30~)와 휴일에는 오늘 대신 다음 수업일을 돌려준다. 다음 날 자료가 없으면 오늘.
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
//  FK_AUTH    : 와이파이 비밀번호가 맞지 않음(이유 202 잇따라 2번, 15·204 잇따라 3번 — 신호가 약해도 나서) → 6시간 뒤
//               (아침 07:00~07:10 에 한 번 더) 또는 새 와이파이·[지금 받기]. 한 번이라도 붙은 비밀번호(prefs pwok)면 걸지 않는다
//  FK_NOAP    : 공유기를 찾지 못함(잇따라 2번, 밤에 공유기를 끄는 학교) → FK_NET 과 같은 간격(2·4·8…60분)
enum FailKind { FK_NONE, FK_NOTFOUND, FK_NET, FK_PARTIAL, FK_AUTH, FK_NOAP };
static FailKind s_failKind = FK_NONE;
static int s_wifiFails = 0;          // 같은 이유(비밀번호·공유기 없음)로 잇따라 실패한 횟수
static int s_lastWifiKind = 0;       // 지난번 실패 이유 묶음(1: 202 · 3: 15·204 · 2: 201)
static bool s_pwOk = false;          // 저장한 비밀번호로 한 번이라도 붙었나(prefs "pwok")
static String s_authRetryDay;        // FK_AUTH 아침 재시도를 한 날
static uint32_t s_wifiOnAt = 0;      // 와이파이를 켠 때(받기 전체 시간 기록용)
static bool s_coreRetry = false;     // 시간 초과로 모드의 핵심 자료(교장: 학교 일정, 교사: 시간표)를 못 받음 → 10분 뒤 한 번 더
static char s_lastOkHM[8] = "";      // 마지막으로 성공한 시각
static time_t s_lastOkT = 0;         // 마지막으로 성공한 때(prefs "lastok" — 껐다 켜도 남는다)
// 받은 자료가 오래됐으면 글을 만들어 참을 돌려준다(잇따라 2번 실패 또는 마지막 성공이 6시간 넘음)
static bool staleText(char *buf, size_t n) {
  if (s_failKind == FK_AUTH) { snprintf(buf, n, "와이파이 비밀번호를 확인하세요"); return true; }
  if (s_failKind == FK_NOAP) { snprintf(buf, n, "와이파이 공유기를 찾지 못했습니다"); return true; }
  if (!timeValid()) return false;
  const time_t now = time(nullptr);
  // 까닭 한 토막(설정을 열지 않아도 무엇이 문제인지 보이게)
  const char *why = s_pickMissing && !s_principal ? " · 시간표 다시 고르기" : s_failKind == FK_NOTFOUND ? " · 시간표 파일 없음"
                  : s_failKind == FK_NET ? " · 인터넷" : s_failKind == FK_PARTIAL ? " · 일부만 받음" : "";
  if (!s_lastOkT) { if (s_failCount >= 2) { snprintf(buf, n, "아직 자료를 받지 못했습니다%s", why); return true; } return false; }
  if (s_failCount < 2 && now - s_lastOkT < 6 * 3600) return false;
  struct tm tm; localtime_r(&s_lastOkT, &tm);
  snprintf(buf, n, "자료 갱신 안 됨 · %d/%d %02d:%02d%s", tm.tm_mon + 1, tm.tm_mday, tm.tm_hour, tm.tm_min, why);
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
static bool s_pcOnly = false;    // 설정 '컴퓨터만': 와이파이를 쓰지 않고, 시간은 컴퓨터의 탭덱이 알려 준다
// '컴퓨터만' 일 때 시간표·날씨·급식은 컴퓨터의 탭덱이 대신 받아 USB 로 넘겨 준다(pcfLine · pcSyncTick)
static const int PC_MAX = 7;
static const char *s_pcId[PC_MAX]; static int s_pcN = 0;
static int s_pcStep = -1;                              // -1: 쉬는 중 · 0..: 지금 부탁한 칸
static bool s_pcGood[PC_MAX], s_pcAsk[PC_MAX]; static int s_pcMissN = 0;   // 부탁한 것 · 못 받은 바퀴가 이어진 횟수
static bool s_pcAsked = false, s_pcGotBegin = false, s_pcDone = false, s_pcRes = false;
static uint32_t s_pcStepAt = 0, s_pcActAt = 0;
static File s_pcFile; static size_t s_pcLen = 0, s_pcWant = 0; static uint32_t s_pcCrc = 0, s_pcWantCrc = 0; static int s_pcSeq = -1;
static String s_pcMealDate;
static const uint32_t SYNC_EVERY_MS = 3600UL * 1000;

static void setTopTitle();
static void renderToday() {
  setTopTitle();
  if (!s_ttLoaded) {
    const bool noWifi = !s_pcOnly && !s_prefs.getString("ssid", "").length();
    setTextIf(s_dayTitle, s_pcOnly ? "컴퓨터가 시간표를 받아 오면 보입니다" : urlUnset() ? "시간표 주소가 없습니다" : noWifi ? "설정에서 와이파이를 연결하세요"
              : s_pickMissing ? "볼 시간표를 다시 고르세요"
              : (s_triedOnce && !s_lastOk) ? (s_failKind == FK_NOTFOUND ? "시간표 파일을 찾지 못했습니다" : "시간표를 받지 못했습니다 · 곧 다시 받습니다")
              : "시간표를 받는 중...");
    if (s_guide && (s_pcOnly || urlUnset() || noWifi || s_pickMissing)) {
      setTextIf(s_guide, s_pcOnly
        ? "컴퓨터만 연결해서 쓰는 중입니다\n\n컴퓨터의 탭덱이 시간·시간표·날씨·급식을 대신 받아 줍니다\n컴퓨터에 인터넷이 있고 탭덱이 켜져 있어야 해요\n\n와이파이를 쓰려면 [설정]에서 [컴퓨터만]을 끄세요"
        : noWifi
        ? "시간표를 아직 불러오지 못했습니다\n\n1. [설정] → [찾기]에서 학교 와이파이를 고르세요\n2. 계속 안 되면 정보 담당 선생님께 알려 주세요\n\n시계는 지금도 정상입니다"
        : urlUnset() ? "시간표 주소가 아직 없습니다\n\n정보 담당 선생님의 확인이 필요합니다\n\n시계·날씨·급식은 지금도 정상입니다"
        : "고른 시간표 이름이 목록에 없습니다\n\n[설정] → [볼 시간표]에서 다시 고르세요\n\n시계·날씨·급식은 지금도 정상입니다");
      showIf(s_guide, true);
    }
    return;
  }
  showIf(s_guide, false);
  bool isToday, skipped;
  JsonObject todayObj;                                               // 건너뛴 오늘 칸(방과 후·휴일)
  JsonObject day = findDay(isToday, &skipped, &todayObj);
  const char *date = day["date"] | "", *dow = day["dow"] | "", *tag = day["tag"] | "";
  const String td = todayIso();
  const bool tomorrow = !isToday && td.length() && isoAddDays(td, 1) == date;
  const bool todayHoliday = !todayObj.isNull() && !strcmp(todayObj["type"] | "", "holiday");
  const char *dty = day["type"] | "";
  const char *tagShow = todayHoliday ? "오늘 휴일" : tag;            // 휴일에는 다음 수업일을 보이고 꼬리표로 알린다
  // D-day: 수능(board_config.h 의 SUNEUNG_DATE) 당일까지. 오늘이 시험 날이면 'N일째', 아니면 시간표의 다음 시험(연속된 시험은 첫날).
  // 날짜가 바뀌거나 시간표를 새로 받았을 때만 계산한다(1분마다 일정을 훑지 않게).
  static String ddKey; static char dd[64] = ""; static bool ddOn = false, ddHot = false;
  bool ddChg = false;
  {
    const String key = td + "#" + String(s_ttGen);
    if (key != ddKey) {
      ddKey = key; ddOn = ddHot = false; dd[0] = 0; ddChg = true;
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
    if (ddOn && setTextIf(s_dday, dd)) ddChg = true;
    setBgIf(s_dday, ddHot ? NOW_TAG : D_ROW);                        // 7일 안으로 다가오면 호박색으로 눈에 띄게
    setTextColIf(s_dday, ddHot ? NOW_TX : C_DUTY);
  }
  // 제목: 오늘 날짜는 왼쪽에 이미 있으므로 다시 쓰지 않는다. 다음 수업일일 때만 짧게 날짜를 쓴다(16:30~ 는 내일 시간표).
  bool tchg;
  if (isToday) tchg = setTextIf(s_dayTitle, "오늘 시간표");
  else if (tomorrow) tchg = setTextIf(s_dayTitle, "내일 시간표");
  else tchg = setTextFmtIf(s_dayTitle, "%d/%d(%s) 시간표", atoi(date + 5), atoi(date + 8), dow);
  const bool gchg = setTextIf(s_dayTag, tagShow);
  const int tagKind = (todayHoliday || !strcmp(dty, "holiday")) ? 1 : !strcmp(dty, "exam") ? 2 : 0;   // 1 휴일 · 2 시험
  setBgIf(s_dayTag, tagKind == 1 ? D_LINE : tagKind == 2 ? D_ROW : 0xfee2e2);
  setTextColIf(s_dayTag, tagKind == 1 ? D_SUB : tagKind == 2 ? C_DUTY : 0x991b1b);
  setBorderWIf(s_dayTag, tagKind == 2 ? 1 : 0);
  {   // 제목·꼬리표·D-day 가 겹치지 않게: 제목 폭 상한을 정하고, 그래도 좁으면 D-day 를 숨긴다(글이 바뀔 때만 계산)
    static bool crowded = false;
    const bool tagWas = lv_obj_has_flag(s_dayTag, LV_OBJ_FLAG_HIDDEN) == (bool)*tagShow;
    const bool wantDD = ddOn && (s_show & SH_DDAY);
    if (tchg || gchg || ddChg || tagWas || s_ttLayoutDirty) {
      s_ttLayoutDirty = false;
      const int avail = s_rightW - SC(16) - SC(12);
      const int tagW = *tagShow ? textW(tagShow, FM()) + 16 + 8 : 0;
      int ddW = wantDD ? textW(dd, FM()) + 22 + 8 : 0;
      crowded = wantDD && avail - ddW - tagW < SC(100);
      if (crowded) ddW = 0;
      const lv_coord_t mw = max(SC(80), avail - ddW - tagW);
      if (lv_obj_get_style_max_width(s_dayTitle, 0) != mw) lv_obj_set_style_max_width(s_dayTitle, mw, 0);
      showIf(s_dayTag, *tagShow);
      if (*tagShow) { lv_obj_update_layout(s_dayTitle); lv_obj_align_to(s_dayTag, s_dayTitle, LV_ALIGN_OUT_RIGHT_MID, 8, 0); }
    }
    showIf(s_dday, wantDD && !crowded);
  }

  const char *ty = day["type"] | "";
  const bool holiday = !strcmp(ty, "holiday"), exam = !strcmp(ty, "exam");   // 휴일: '지금' 표시 없음 · 시험: '분 남음' 대신 '시험'
  const bool teacher = strcmp(s_tt["kind"] | "teacher", "teacher") == 0;
  const int nm = timeValid() ? nowMin() : -1;
  int nowP = -1, nextP = -1;
  if (isToday && !holiday) {
    for (int p = 0; p < 7; p++) {
      int st = toMin(PERIOD_START[p]);
      if (nm >= st && nm < st + 50) nowP = p;
      if (nextP < 0 && st > nm) nextP = p;
    }
  }
  const bool lunchNow = isToday && !holiday && nm >= toMin("12:30") && nm < toMin("13:30");
  JsonArray cells = day["cells"].as<JsonArray>();

  // 지금 교시 줄은 밝은 칸(옅은 회색 + 검은 글씨)으로 눈에 띄게(사용자 지시). 종류 색은 테두리로만.
  // 값이 바뀐 것만 다시 쓴다(1분마다 같은 값을 쓰면 그 칸을 다시 그린다)
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
      if (duty) { border = NEXT_BD; colA = C_DUTY; } else colA = D_MUTED;
      colB = D_MUTED;
    } else {
      JsonArray c = cells[p];
      const char *t = c[0] | "";
      textA = *t ? (const char *)(c[1] | "") : (teacher ? "공강" : "");
      textB = c[2] | "";
      textTag = c[3] | "";
      if (*t) border = styleOf(*t).border; else { colA = D_MUTED; colB = D_MUTED; }
    }
    const bool past = isToday && !holiday && nm >= 0 && !now && (p >= 0 ? nm >= toMin(PERIOD_START[p]) + 50 : nm >= toMin("13:30"));
    if (past) { colA = colB = D_MUTED; border = D_LINE; }            // 지난 교시는 테두리 색도 끈다
    const bool next = UI_SOFT && !now && p >= 0 && p == nextP && nm >= 0;
    if (now) { border = NOW_ROW; colA = C_TEXT; colB = C_MUTED; }
    if (next) border = NEXT_BD;
    setBgIf(s_row[r], now ? NOW_ROW : D_ROW);
    setBorderIf(s_row[r], border);
    setBorderWIf(s_row[r], next ? 2 : 1);
    const bool ca = setTextIf(s_rowA[r], textA);
    const bool cb = setTextIf(s_rowB[r], textB);
    setTextColIf(s_rowA[r], colA);
    setTextColIf(s_rowB[r], colB);
    const bool cg = setTextIf(s_rowTag[r], textTag);
    const bool tagWas = lv_obj_has_flag(s_rowTag[r], LV_OBJ_FLAG_HIDDEN) == (bool)*textTag;
    showIf(s_rowTag[r], *textTag);
    if (ca || cb || cg || tagWas) {                                   // 글이 바뀐 줄만: 과목 폭 상한(꼬리표·교실 글 자리를 남긴다) → 꼬리표를 과목 뒤에
      const int tagW = *textTag ? textW(textTag, FM()) + 2 * (big() ? 8 : 5) + 8 : 0;
      const int bW = *textB ? min(textW(textB, FM()), SC(110)) : 0;
      const lv_coord_t mw = max(SC(40), min(SC(150), s_rowW - s_rowPW - SC(18) - tagW - bW - SC(24)));
      if (lv_obj_get_style_max_width(s_rowA[r], 0) != mw) lv_obj_set_style_max_width(s_rowA[r], mw, 0);
      if (*textTag) { lv_obj_update_layout(s_rowA[r]); lv_obj_align_to(s_rowTag[r], s_rowA[r], LV_ALIGN_OUT_RIGHT_MID, 8, 0); }
    }
    setBgIf(s_rowP[r], now ? NOW_TAG : D_LINE);
    lv_obj_t *pl = lv_obj_get_child(s_rowP[r], 0);
    setTextColIf(pl, now ? NOW_TX : D_SUB);
    // 교시 칸: 평소에는 시작 시각, 지금 교시(점심)에는 남은 시간 — 한눈에 '지금 어디쯤인지' 보이게(시험 날은 '시험')
    if (s_rowRem[r]) {   // 1024: 지금 줄은 위 '3교시'(작게) 아래 '45분'(크게) — 가장 중요한 숫자를 가장 크게
      if (now) {
        if (p < 0) setTextIf(pl, "점심"); else setTextFmtIf(pl, "%d교시", p + 1);
        if (p < 0) setTextFmtIf(s_rowRem[r], "%d분", toMin("13:30") - nm);
        else if (exam) setTextIf(s_rowRem[r], "시험");
        else setTextFmtIf(s_rowRem[r], "%d분", toMin(PERIOD_START[p]) + 50 - nm);
      } else if (p < 0) setTextIf(pl, "점심");
      else setTextFmtIf(pl, "%d교시\n%s", p + 1, PERIOD_START[p]);
      if (now != s_rowRemOn[r]) {
        s_rowRemOn[r] = now;
        showIf(s_rowRem[r], now);
        if (now) lv_obj_align(pl, LV_ALIGN_TOP_MID, 0, 2); else lv_obj_center(pl);
      }
    } else if (p < 0) { if (now) setTextFmtIf(pl, "점심\n%d분 남음", toMin("13:30") - nm); else setTextIf(pl, "점심"); }
    else if (now && exam) setTextFmtIf(pl, "%d교시\n시험", p + 1);
    else if (now) setTextFmtIf(pl, "%d교시\n%d분 남음", p + 1, toMin(PERIOD_START[p]) + 50 - nm);
    else setTextFmtIf(pl, "%d교시\n%s", p + 1, PERIOD_START[p]);
  }
  // 할 일: 급식지도 · 공강지도 · 보강 · 야자 감독 · 바뀐 수업(당겨옴·결강·시험 감독·창체·행사, 교실까지).
  // 오늘(방과 후·주말·휴일에는 다음 수업일), 3개 넘으면 '외 N건'(시험 날은 7개까지 모두).
  // 방과 후여도 오늘 저녁 야자 감독은 18:30 전까지 맨 앞에 남긴다(16:30 부터 사라지던 문제).
  {
    String duty; int cnt = 0;
    const int cap = exam ? 7 : 3;
    auto add = [&](const String &s) { if (++cnt > cap) return; if (duty.length()) duty += "  ·  "; duty += s; };
    auto roomOf = [](const char *b) { String room = b; int dot = room.indexOf(" · "); if (dot > 0) room = room.substring(0, dot); room.trim(); return room; };
    const bool showDay = isToday || skipped;
    const String me = String((const char *)(s_tt["name"] | ""));
    const bool tonight = skipped && teacher && !todayObj.isNull() && me.length() && me == (const char *)(todayObj["night"] | "")
                         && nm >= 0 && nm < toMin("18:30");
    if (showDay) {
      if (teacher && *(const char *)(day["lunch"] | "")) add("급식지도 12:30");
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
    setTextIf(s_duty, duty.length() ? duty.c_str() : isToday ? "오늘은 따로 맡은 일이 없습니다" : showDay ? "따로 맡은 일이 없습니다" : "-");
    setTextColIf(s_duty, duty.length() ? C_DUTY : D_MUTED);
  }
  // 다음 수업 알림: 수업 시작 10분 전부터(다음이 공강이면 띄우지 않는다. 휴일·시험 날은 띄우지 않는다).
  // 잘려도 '몇 분 뒤'가 남도록 시간을 앞에 둔다.
  {
    int soonP = -1;
    if (isToday && nowP < 0 && !holiday && !exam)
      for (int p = 0; p < 7; p++) { int d = toMin(PERIOD_START[p]) - nm; if (d > 0 && d <= 10) { soonP = p; break; } }
    JsonArray sc = soonP >= 0 ? cells[soonP].as<JsonArray>() : JsonArray();
    const bool on = soonP >= 0 && *(const char *)(sc[0] | "");
    if (on) {
      const char *a = sc[1] | "", *b = sc[2] | "";
      setTextFmtIf(s_noticeLbl, "%d분 뒤  ·  %d교시 %s%s%s", toMin(PERIOD_START[soonP]) - nm, soonP + 1, a, *b ? " · " : "", b);
    }
    showIf(s_notice, on);
    if (on != s_noticeOn) { s_noticeOn = on; layoutClock(); }       // 띠가 생기거나 사라지면 카드 자리를 다시 잡는다
  }
  (void)nextP;   // '지금/다음' 글은 두지 않는다 — 오른쪽의 밝은 줄과 '남은 시간', 아래 '다음 수업' 띠가 그 역할을 한다
}

// ── 주간 시간표 ──
// 1분마다 다시 부르므로 값이 바뀐 칸만 다시 쓴다. 숨어 있으면 부르지 않는다(s_weekDirty).
static int s_cellAOff = -9;   // 교실 줄이 있을 때 과목 줄을 위로 올리는 만큼(buildWeek 에서 정한다)
static void renderWeek() {
  s_weekDirty = false;
  if (!s_ttLoaded) {
    setTextIf(s_weekLbl, "시간표 없음");
    setTextIf(s_ttSub, s_prefs.getString("ssid", "").length() ? "시간표를 받는 중..." : "설정에서 와이파이를 연결하세요");
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
  setTextFmtIf(s_weekLbl, "%d주차  %d/%d ~ %d/%d", wk["n"].as<int>(), atoi(d0 + 5), atoi(d0 + 8), atoi(d4 + 5), atoi(d4 + 8));
  const char *kind = s_tt["kind"] | "teacher";
  if (strcmp(kind, "teacher") == 0) setTextFmtIf(s_ttSub, "주당 %s시간 · 담임 %s", (const char *)(s_tt["hours"] | "-"), (const char *)(s_tt["home"] | "-"));
  else setTextIf(s_ttSub, "교실 시간표");

  for (int d = 0; d < 5; d++) {
    JsonObject day = days[d];
    const char *date = day["date"] | "";
    bool isToday = today.length() && today == date;
    const bool holiday = !strcmp(day["type"] | "", "holiday");
    const char *tag = day["tag"] | "";
    lv_obj_t *hl = lv_obj_get_child(s_hd[d], 0);
    setTextFmtIf(hl, "%s %d/%d%s%s", DOW[d], atoi(date + 5), atoi(date + 8), *tag ? "  " : "", tag);
    setBgIf(s_hd[d], isToday ? D_LINE : D_PANEL);                    // 오늘 = 호박색 글자(빨강은 결강·휴일 뜻이라 쓰지 않는다)
    setTextColIf(hl, isToday ? NOW_TAG : D_SUB);

    JsonArray cells = day["cells"].as<JsonArray>();
    for (int p = 0; p < 7; p++) {
      JsonArray c = cells[p];
      const char *t = c[0] | "", *a = c[1] | "", *b = c[2] | "", *g = c[3] | "";
      CellStyle st = styleOf(*t);
      lv_obj_t *o = s_cell[d][p];
      // 어두운 바탕: 종류 색은 테두리로만
      const bool nowCell = isToday && !holiday && p == nowP;   // 지금 교시는 흰 칸으로 눈에 띄게(사용자 지시)
      setBgIf(o, nowCell ? NOW_ROW : (*t ? D_ROW : D_PANEL));
      setBorderIf(o, nowCell ? NOW_ROW : (*t ? st.border : D_LINE));
      setBorderWIf(o, nowCell ? 3 : 1);
      setTextIf(s_cellA[d][p], a);
      setTextIf(s_cellB[d][p], b);
      setTextIf(s_cellTag[d][p], g);
      setTextColIf(s_cellA[d][p], nowCell ? C_TEXT : D_TEXT);
      setTextColIf(s_cellB[d][p], nowCell ? C_MUTED : D_SUB);
      showIf(s_cellTag[d][p], *g);
      {   // 교실 줄이 없으면 과목을 칸 가운데로. 꼬리표가 있으면 과목을 왼쪽에 붙여 꼬리표와 겹치지 않게(디자인 검토 2026-11-03)
        lv_obj_t *A = s_cellA[d][p];
        const int cw = lv_obj_get_style_width(o, LV_PART_MAIN);   // 처음 그릴 때는 좌표가 아직 0 일 수 있어 정한 폭을 읽는다
        lv_obj_set_width(A, *g ? cw * 5 / 9 : cw - 12);
        lv_obj_set_style_text_align(A, *g ? LV_TEXT_ALIGN_LEFT : LV_TEXT_ALIGN_CENTER, 0);
        if (*g) lv_obj_align(A, LV_ALIGN_LEFT_MID, 6, *b ? s_cellAOff : 0);
        else lv_obj_align(A, LV_ALIGN_CENTER, 0, *b ? s_cellAOff : 0);
      }
    }
    const char *lunch = day["lunch"] | "";
    bool duty = strcmp(kind, "teacher") == 0 && *lunch;
    lv_obj_t *ll = lv_obj_get_child(s_lunch[d], 0);
    setBgIf(s_lunch[d], D_ROW);
    setBorderIf(s_lunch[d], duty ? NEXT_BD : D_LINE);
    setTextIf(ll, duty ? "급식지도" : (*lunch ? lunch : "점심"));
    setTextColIf(ll, duty ? C_DUTY : D_MUTED);
  }
  bool todayHoliday = false;
  for (int d = 0; d < 5; d++) if (today == (const char *)(days[d]["date"] | "") && !strcmp(days[d]["type"] | "", "holiday")) todayHoliday = true;
  for (int p = 0; p < 7; p++) {
    bool now = p == nowP && !todayHoliday;
    setBgIf(s_pl[p], now ? NOW_TAG : D_PANEL);
    setTextColIf(lv_obj_get_child(s_pl[p], 0), now ? NOW_TX : D_SUB);
  }
}

static void renderTT();   // 아래(화면 종류 뒤)에 있다

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
  if (e) { Serial.printf("tt.json parse: %s\n", e.c_str()); if (s_prefs.isKey("et_tt")) s_prefs.remove("et_tt"); return false; }   // 다음엔 처음부터 받는다
  lock(); s_tt = std::move(tmp); unlock();   // 화면(LVGL)이 읽는 중에 바꾸지 않게
  s_ttName = String((const char *)(s_tt["name"] | ""));
  if (strcmp(s_tt["kind"] | "", "teacher") == 0) s_ttName += " 선생님";
  s_ttLoaded = true;
  s_ttGen++; s_ttLayoutDirty = true;   // D-day·제목 자리를 새로 계산
  return true;
}

/// ── 받기 공통 ──
// 암호 연결 인사(TLS) 10초 · 연결 5초 상한. 전에는 인사 시간을 정하지 않아(기본 약 120초) 받기가 오래 멈출 수 있었다.
// budget: 이번 받기에 남은 시간(ms). 60초 마감을 넘지 않게 연결·인사·읽기 상한을 그 안으로 줄인다
static void netPrep(NetworkClientSecure &c, uint32_t budget) { c.setInsecure(); c.setHandshakeTimeout(max<uint32_t>(1, min<uint32_t>(10, budget / 1000))); }
static void httpLimits(HTTPClient &http, uint32_t budget) { http.setConnectTimeout(min<uint32_t>(5000, budget)); http.setTimeout((uint16_t)min<uint32_t>(15000, budget)); }
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

// 시간표 파일을 받아 LittleFS 에 둔다. (인증서 확인은 아직 하지 않는다 — TODO: 루트 인증서 묶음)
// 304(바뀌지 않음)이면 참을 돌려주고 s_ttSame 을 세운다(다시 읽지 않는다).
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
  // Firebase 는 조각(chunked)으로 보내는데, 조각 사이에서 읽기 시간 초과(-11)로 끊긴 적이 있다.
  // HTTP/1.0 으로 청해 한 덩어리(Content-Length)로 받고, 기다리는 시간도 늘린다.
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
    if (whole && moved()) LittleFS.remove("/tt.tmp");
    else if (whole) { LittleFS.remove("/tt.json"); LittleFS.rename("/tt.tmp", "/tt.json"); ok = true; etagKeep(http, "et_tt"); }
    else { LittleFS.remove("/tt.tmp"); Serial.printf("download incomplete: %d/%d\n", got, want); }
  }
  http.end();
  Serial.printf("download %s -> %d (%.1fs)\n", url.c_str(), code, secs(t0));
  return ok;
}

// ── 시간표 목록 (board/index.json: 선생님·학급·특별실) ──
// 설정의 '볼 시간표'를 채우고, 고른 이름으로 파일(board/t/NNN.json)을 찾는다. 고른 것은 이름으로 저장한다(목록 차례가 바뀌어도 유지).
static JsonDocument s_index(&s_alloc);
static String s_pickName = BOARD_DEFAULT_TT;
static bool s_ttFileKnown = false;   // prefs 에 지난번 받던 파일(ttfile)이 있나
static void setTTFile(const String &f) {   // 다른 파일이면 처음부터 받고, 껐다 켜도 알 수 있게 저장한다
  if (!f.length() || f == s_ttFile) return;
  s_ttFile = f; etagForget("et_tt");
  s_prefs.putString("ttfile", f); s_ttFileKnown = true;
}
// '볼 시간표' 고르기: 펼침 목록(스크롤·애니메이션이 느리고 88개를 위로 밀어 고르기 힘들었다) 대신
// 단추 판(한 쪽 30개, 6×5)을 쪽으로 넘긴다. 단추는 처음에 한 번만 만들고 글자만 바꾼다(2026-10-18 사용자 요청).
static lv_obj_t *s_pickView = nullptr, *s_pickBtn[30], *s_pickTab[2], *s_pickPage = nullptr;
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
    lv_obj_set_style_bg_color(s_pickTab[t], lv_color_hex(on ? C_SEL : C_ALT), 0);
    lv_obj_t *l = lv_obj_get_child(s_pickTab[t], 0);
    lv_label_set_text_fmt(l, "%s %d", t ? "학급·특별실" : "선생님", cnt[t]);
    lv_obj_set_style_text_color(l, lv_color_hex(on ? C_SEL_TX : C_MUTED), 0);
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
    lv_obj_set_style_bg_color(btn, lv_color_hex(sel ? C_SEL : special ? NOW_ROW : C_SURF), 0);
    lv_obj_t *l = lv_obj_get_child(btn, 0);
    lv_label_set_text(l, special ? sname + 1 : pickLabel(it));
    lv_obj_set_style_text_color(l, lv_color_hex(sel ? C_SEL_TX : C_TEXT), 0);
  }
  lv_label_set_text_fmt(s_pickPage, "%d / %d", s_pickPg + 1, pages);
}
static void setPrincipalTitles();
static lv_obj_t *s_showLbl = nullptr;   // 설정 '보이기' 제목(교장 모드에서는 단추 6개와 함께 숨긴다 — 교장 화면에는 영향이 없다)
static void fillPicker() {
  s_principal = s_pickName.startsWith("@");
  setTopTitle();
  if (s_tabTT) setTextIf(lv_obj_get_child(s_tabTT, 0), s_principal ? "학교 일정" : "시간표");
  showIf(s_showLbl, !s_principal);
  for (int i = 0; i < 6; i++) if (s_showBtn[i]) showIf(s_showBtn[i], !s_principal);
  if (s_principal && s_ttPick) {
    s_pickMissing = false;
    lv_label_set_text_fmt(lv_obj_get_child(s_ttPick, 0), "%s · 학교 일정  " LV_SYMBOL_RIGHT, s_pickName.c_str() + 1);
    setPrincipalTitles();
    renderPicker();
    return;
  }
  JsonArray items = s_index["items"].as<JsonArray>();
  if (items.isNull() || !s_ttPick) return;
  JsonObject hit;
  for (JsonObject it : items) if (s_pickName == (const char *)(it["name"] | "")) { hit = it; break; }
  if (hit.isNull() && s_ttFileKnown)   // (가) 이름만 바뀐 경우: 지금 받고 있는 파일과 같은 항목을 쓰고 새 이름으로 저장
    for (JsonObject it : items)
      if (s_ttFile == (const char *)(it["file"] | "")) {
        hit = it; s_pickName = (const char *)(it["name"] | "");
        s_prefs.putString("ttname", s_pickName);
        Serial.printf("picker: renamed -> %s\n", s_pickName.c_str());
        break;
      }
  if (hit.isNull() && !s_prefs.isKey("ttname") && items.size()) {   // (나) 처음 쓰는 보드(기본 이름이 목록에 없음): 첫 항목
    hit = items[0]; s_pickName = (const char *)(hit["name"] | "");
  }
  const bool found = !hit.isNull();
  if (found) {
    setTTFile((const char *)(hit["file"] | ""));
    const char *lb = hit["label"] | "";
    lv_label_set_text_fmt(lv_obj_get_child(s_ttPick, 0), "%s  " LV_SYMBOL_RIGHT, *lb ? lb : (const char *)(hit["name"] | ""));
    s_pickKind = strcmp(hit["kind"] | "teacher", "teacher") ? 1 : 0;
  }
  s_pickMissing = !found;   // 그래도 없으면 옛 파일을 받지 않고 다시 고르라고 알린다
  if (!found) lv_label_set_text_fmt(lv_obj_get_child(s_ttPick, 0), "%s (목록에 없음)  " LV_SYMBOL_RIGHT, s_pickName.c_str());
  renderPicker();
}
static bool parseIndex(const String &body) {
  JsonDocument d(&s_alloc);
  if (deserializeJson(d, body) || d["items"].isNull()) return false;
  lock(); s_index = std::move(d); unlock();
  return true;
}
static bool s_idxSame = false;   // 마지막 목록 받기가 304(바뀌지 않음)였나 → 단추 판을 다시 채우지 않는다
static String s_idxDay;          // 목록을 받은 날(목록은 거의 바뀌지 않아 하루 한 번 · [볼 시간표]를 열었을 때만 묻는다)
static bool s_idxReq = false;    // [볼 시간표] 판을 열었다 → 다음 받기 때 목록도 묻는다
static bool downloadIndex(uint32_t budget = 60000) {
  s_idxSame = false;
  if (!WiFi.isConnected()) return false;
  const uint32_t t0 = millis();
  NetworkClientSecure client; netPrep(client, budget);
  HTTPClient http;
  if (!http.begin(client, String(BASE_URL) + "index.json")) return false;
  http.useHTTP10(true);
  httpLimits(http, budget);
  etagAsk(http, "et_idx", "/index.json");
  int code = http.GET();
  bool ok = code == 304;   // 바뀌지 않음: 켤 때 읽은 목록을 그대로 쓴다
  s_idxSame = ok;
  if (code == 200) {
    String body = http.getString();
    if (parseIndex(body)) { ok = true; if (saveAtomic("/index.json", body)) etagKeep(http, "et_idx"); }
  }
  http.end();
  Serial.printf("index -> %d %s (%.1fs)\n", code, ok ? "ok" : "fail", secs(t0));
  return ok;
}
static void loadIndexFromFile() {
  File f = LittleFS.open("/index.json", "r");
  if (!f) return;
  String body = f.readString(); f.close();
  if (!parseIndex(body)) etagForget("et_idx");
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
static bool s_mealCached = false;   // 마지막 급식 받기가 '오늘 이미 받음'이었나(받지 않았으니 점검표 시각을 새로 찍지 않는다)
static bool downloadMeal(uint32_t budget = 60000) {
  if (!HAS_MEAL) return false;               // 학교 코드를 안 넣었으면 받지 않는다
  String date = todayIso();
  if (!WiFi.isConnected() || !date.length()) return false;
  s_mealCached = false;
  if (s_mealDate == date && (s_mLunch.length() || s_mDinner.length())) { Serial.println("meal: today already"); s_mealCached = true; return true; }   // 오늘 메뉴는 하루 한 번만(점검표 시각은 그대로)
  String ymd = date; ymd.replace("-", "");
  const uint32_t t0 = millis();
  NetworkClientSecure client; netPrep(client, budget);
  HTTPClient http;
  if (!http.begin(client, String(MEAL_URL) + ymd)) return false;
  http.useHTTP10(true);
  httpLimits(http, budget);
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
  Serial.printf("meal %s -> %d %s (%.1fs)\n", ymd.c_str(), code, ok ? "ok" : "fail", secs(t0));
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
static bool downloadWeather(uint32_t budget = 60000) {
  if (!HAS_WX || !WiFi.isConnected()) return false;
  const uint32_t t0 = millis();
  NetworkClientSecure client; netPrep(client, budget);
  HTTPClient http;
  if (!http.begin(client, WX_URL)) return false;
  http.useHTTP10(true);
  httpLimits(http, budget);
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
  Serial.printf("weather -> %d %s (%.1fs)\n", code, ok ? "ok" : "fail", secs(t0));
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
    // 같은 글·같은 그림이면 다시 쓰지 않는다(1시간마다 날씨 카드 전체를 다시 그리지 않게)
    if (!s_wxOk) {
      showIf(k.img, false);
      setTextIf(k.desc, day);
      setTextIf(k.temp, "--");
      setTextIf(k.hilo, HAS_WX ? "날씨 받는 중" : "위치 설정 필요");
      continue;
    }
    // 오늘은 지금 날씨·지금 기온, 내일은 하루 날씨·최고 기온을 크게. 윗줄에 최고/최저, 아랫줄에 날씨·비
    const int code = (i == 0 && s_wxNowCode >= 0) ? s_wxNowCode : w.code;
    const float big = i == 0 && !isnan(s_wxNow) ? s_wxNow : w.tmax;
    showIf(k.img, true);
    if (lv_img_get_src(k.img) != (const void *)wxIcon(code)) lv_img_set_src(k.img, wxIcon(code));
    if (isnan(w.tmax) || isnan(w.tmin)) setTextIf(k.desc, day);
    else setTextFmtIf(k.desc, "%s  %d°/%d°", day, (int)lroundf(w.tmax), (int)lroundf(w.tmin));
    if (isnan(big)) setTextIf(k.temp, "--");
    else setTextFmtIf(k.temp, "%d°", (int)lroundf(big));
    if (w.pop < 0) setTextIf(k.hilo, wxName(code));
    else setTextFmtIf(k.hilo, "%s · #%s 비 %d%%#", wxName(code), w.pop >= 40 ? "60a5fa" : D_MUTED_S, w.pop);
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
static bool downloadAir(uint32_t budget = 60000) {
  if (!HAS_WX || !WiFi.isConnected()) return false;
  const uint32_t t0 = millis();
  NetworkClientSecure client; netPrep(client, budget);
  HTTPClient http;
  if (!http.begin(client, AIR_URL)) return false;
  http.useHTTP10(true);
  httpLimits(http, budget);
  int code = http.GET();
  bool ok = false;
  if (code == 200) {
    String body = http.getString();
    if (parseAir(body)) { saveAtomic("/air.json", body); ok = true; }
  }
  http.end();
  Serial.printf("air -> %d %s (%.1fs)\n", code, ok ? "ok" : "fail", secs(t0));
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
  if (!HAS_WX) { setTextFmtIf(s_dust, "#%s 미세먼지: 위치 설정 필요#", D_MUTED_S); return; }
  if (isnan(s_pm10) && isnan(s_pm25)) { setTextFmtIf(s_dust, "#%s 미세먼지 정보를 받는 중#", D_MUTED_S); return; }
  int g10 = isnan(s_pm10) ? 0 : s_pm10 <= 30 ? 0 : s_pm10 <= 80 ? 1 : s_pm10 <= 150 ? 2 : 3;
  int g25 = isnan(s_pm25) ? 0 : s_pm25 <= 15 ? 0 : s_pm25 <= 35 ? 1 : s_pm25 <= 75 ? 2 : 3;
  int g = g10 > g25 ? g10 : g25;
  static const char *NAME[4] = {"좋음", "보통", "나쁨", "매우 나쁨"};
  static const char *COLOR[4] = {"60a5fa", "34d399", "fb923c", "ef4444"};
  setTextFmtIf(s_dust, "#%s ● 미세먼지 %s#  #%s · PM10 %d · 초미세 %d#", COLOR[g], NAME[g], D_MUTED_S,
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
  if (!timeValid() || s_offToday) return false;   // 주말·휴일은 수업이 없다
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
static bool s_renderPending = false;   // 화면 불이 꺼진 동안 받은 자료 → 켤 때 그린다
static time_t s_wxAt = 0, s_airAt = 0, s_whrAt = 0;   // 날씨·미세먼지·선생님 위치를 마지막으로 받은 때(밤·주말 건너뛰기 판단)
static uint32_t syncWaitMs() {
  if (s_mealRetry || s_coreRetry) return 10 * 60000UL;
  if (s_triedOnce && !timeValid() && s_failKind != FK_AUTH && s_failKind != FK_NOAP) return 60000UL;   // 시각을 모르면 시계·일정이 다 틀린다 → 1분마다 다시
  if (s_lastOk || s_failKind == FK_PARTIAL) return quietNow() ? 2 * 3600UL * 1000 : SYNC_EVERY_MS;
  if (s_failKind == FK_AUTH && timeValid()) {   // 비밀번호 잠김이어도 아침(07:00~07:10)에 한 번은 다시 해 본다(새벽 사고가 낮까지 가지 않게)
    time_t t = time(nullptr); struct tm tm; localtime_r(&t, &tm);
    if (tm.tm_hour == 7 && tm.tm_min < 10 && s_authRetryDay != todayIso()) return 0;
  }
  if (s_failKind == FK_NOTFOUND || s_failKind == FK_AUTH) return 6 * 3600UL * 1000;   // 사람이 고쳐야 하는 실패(공유기 없음은 아래 간격으로)
  static const uint8_t BACKOFF_MIN[] = {2, 4, 8, 16, 32, 60};
  int i = s_failCount > 0 ? s_failCount - 1 : 0; if (i > 5) i = 5;
  return BACKOFF_MIN[i] * 60000UL;
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
static void refreshWifiLabel() {
  String ssid = s_prefs.getString("ssid", "");
  if (s_pcOnly) {
    const bool tv = timeValid();
    setTextIf(s_wifiLbl, tv ? "컴퓨터만 연결" : "컴퓨터 시간 기다림");
    setTextColIf(s_wifiLbl, tv ? C_EMERALD : C_WARN);
    char pi[200];
    if (!tv) snprintf(pi, sizeof pi, "컴퓨터만 연결해서 쓰는 중입니다.\n컴퓨터에서 탭덱을 켜 두면 시간이 맞춰집니다.\n(탭덱은 오른쪽 아래 작업 표시줄에 있어요)");
    else if (s_pcStep >= 0) snprintf(pi, sizeof pi, "컴퓨터만 연결해서 쓰는 중입니다.\n컴퓨터에 시간표·날씨·급식을 부탁하는 중입니다.");
    else snprintf(pi, sizeof pi, "컴퓨터만 연결해서 쓰는 중입니다.\n시간·시간표·날씨·급식은 컴퓨터의 탭덱이 받아 줍니다.\n%s%s", s_lastOkHM[0] ? s_lastOkHM : "아직 받기 전입니다", s_lastOkHM[0] ? " 받음" : "");
    setTextIf(s_wifiInfo, pi);
    return;
  }
  if (!ssid.length()) {
    setTextIf(s_wifiLbl, "와이파이 없음");
    setTextColIf(s_wifiLbl, C_ROSE);
    setTextIf(s_wifiInfo, "저장한 와이파이가 없습니다. [찾기]를 누르고 목록에서 고르세요.");
    return;
  }
  if (s_sync != SYNC_IDLE) {
    setTextIf(s_wifiLbl, "받는 중...");
    setTextColIf(s_wifiLbl, C_WARN);
    setTextFmtIf(s_wifiInfo, "'%s'에 잠깐 연결해 시간과 시간표를 받는 중입니다.", ssid.c_str());
    return;
  }
  // 위쪽 막대: 한 번 실패는 조용히 넘긴다(마지막 성공 시각 그대로). 잇따라 2번째 실패부터 주황.
  const bool noUrl = urlUnset() && s_triedOnce && s_lastOk;   // 시간은 맞췄지만 시간표 주소가 없다
  char top[48]; uint32_t col = C_EMERALD;
  if (!s_triedOnce) snprintf(top, sizeof top, "대기");
  else if (s_failKind == FK_AUTH) { snprintf(top, sizeof top, "와이파이 비밀번호 확인"); col = C_ROSE; }
  else if (s_failKind == FK_NOAP) { snprintf(top, sizeof top, "공유기를 찾지 못함"); col = C_WARN; }
  else if (noUrl) { snprintf(top, sizeof top, "시간표 주소 없음"); col = D_MUTED; }
  else if (s_pickMissing && !s_principal) { snprintf(top, sizeof top, "시간표 다시 고르기"); col = C_WARN; }
  else if (s_lastOk) snprintf(top, sizeof top, "%s 받음", s_lastHM);
  else if (s_failKind == FK_NOTFOUND) { snprintf(top, sizeof top, "시간표 주소 확인"); col = C_WARN; }
  else if (s_failCount < 2 && (s_lastOkHM[0] || s_lastOkT)) { char st[16]; okStamp(st, sizeof st); snprintf(top, sizeof top, "%s 받음", st);
    if (timeValid() && s_lastOkT && time(nullptr) - s_lastOkT > 26 * 3600) col = C_WARN; }   // 하루 넘게 못 받음
  else if (s_failCount < 2) { snprintf(top, sizeof top, "대기"); }
  else { snprintf(top, sizeof top, "%s 연결 안 됨", s_lastHM); col = C_WARN; }
  setTextIf(s_wifiLbl, top);
  setTextColIf(s_wifiLbl, col);
  // 설정 화면: 준비 상태 점검표(모드에 맞게) + 다음 받기 시각
  char next[24] = "";
  if (s_triedOnce && timeValid()) {
    const uint32_t w = syncWaitMs(), gone = millis() - s_lastSync;
    time_t t = time(nullptr) + (time_t)((gone < w ? w - gone : 0) / 1000);
    struct tm tm; localtime_r(&t, &tm); snprintf(next, sizeof next, "%02d:%02d", tm.tm_hour, tm.tm_min);
  }
  // 점검표: 문제(실패·아직·설정 없음)만 첫 줄에 모으고, 정상인 것은 '나머지 정상' 한 줄로. 와이파이 이름·배터리는 맨 뒤 줄
  // (전에는 7개 항목 시각을 다 늘어놓아 4~5줄이 되고 끝쪽의 실패 이유가 잘렸다)
  struct Item { const char *name; String cell; bool bad; };
  auto item = [](const char *nm, int i, bool cfg) { Item it{nm, okCell(i, cfg), !cfg || s_okRes[i] < 0 || (s_triedOnce && s_okRes[i] == 0 && !s_okHM[i][0])}; return it; };
  Item its[8]; int ni = 0;
  its[ni++] = item("와이파이", OK_WIFI, true);
  if (!timeValid()) its[ni++] = item("시간", OK_TIME, true);
  if (s_principal) its[ni++] = item("학교 일정", OK_SCH, cfgSet(SCHEDULE_URL));
  else {
    Item t = item("시간표", OK_TT, true);
    if (urlUnset()) { t.cell = "주소 없음"; t.bad = true; } else if (s_pickMissing) { t.cell = "목록에 없음"; t.bad = true; }
    its[ni++] = t;
  }
  { Item w = item("선생님 위치", OK_WHR, true); if (urlUnset()) { w.cell = "주소 없음"; w.bad = true; } its[ni++] = w; }
  its[ni++] = item("날씨", OK_WX, HAS_WX);
  if (!s_principal) its[ni++] = item("미세먼지", OK_AIR, HAS_WX);
  its[ni++] = item("급식", OK_MEAL, HAS_MEAL);
  String bad;
  for (int i = 0; i < ni; i++) if (its[i].bad) { if (bad.length()) bad += " · "; bad += String(its[i].name) + ": " + its[i].cell; }
  const char *last = s_lastOkHM[0] ? s_lastOkHM : (s_lastOkT ? "전에" : "-");
  char ok2[64];
  if (!s_triedOnce) snprintf(ok2, sizeof ok2, "아직 받기 전입니다");
  else snprintf(ok2, sizeof ok2, "%s · %s 받음%s%s", bad.length() ? "나머지 정상" : "모두 정상", last, next[0] ? " · 다음 " : "", next);
  char bat[24] = "";
  if (s_batPct >= 0) snprintf(bat, sizeof bat, " · 배터리 %d%%", s_batPct);
  char info[400];
  if (bad.length()) snprintf(info, sizeof info, "%s\n%s\n'%s' 저장됨%s", bad.c_str(), ok2, ssid.c_str(), bat);
  else snprintf(info, sizeof info, "%s\n'%s' 저장됨%s", ok2, ssid.c_str(), bat);
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
  lock(); refreshWifiLabel(); setStatus("연결하는 중..."); unlock();
  lcdSlow(true);                 // 받는 동안 화면 박자를 낮춘다(매뉴얼)
  WiFi.persistent(false);        // Arduino 의 자체 저장본은 쓰지 않는다(설정 저장본 하나만)
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(false);
  s_wifiReason = 0; s_retried = false;
  s_coreRetry = false;                                       // 10분 뒤 한 번 더는 이번 받기로 다 썼다
  if (s_failKind == FK_AUTH && timeValid()) s_authRetryDay = todayIso();   // 아침 재시도는 하루 한 번
  wifiBegin();
  s_sync = SYNC_CONNECTING; s_syncStart = s_wifiOnAt = millis();
  Serial.printf("sync: connecting %s (internal free %u, largest %u)\n", ssid.c_str(),
                (unsigned)heap_caps_get_free_size(MALLOC_CAP_INTERNAL), (unsigned)heap_caps_get_largest_free_block(MALLOC_CAP_INTERNAL));
}
static void setPrincipalTitles();
static void refreshStale() {   // 동기화가 끝날 때·분이 바뀔 때만 부른다
  char b[128]; const bool st = staleText(b, sizeof b);   // 한글(3바이트)과 까닭 토막이 들어가도 잘리지 않게 128
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
  Serial.printf("heap: internal free %u, largest %u, min %u, up %luh\n", (unsigned)heap_caps_get_free_size(MALLOC_CAP_INTERNAL),
                (unsigned)heap_caps_get_largest_free_block(MALLOC_CAP_INTERNAL), (unsigned)heap_caps_get_minimum_free_size(MALLOC_CAP_INTERNAL),
                (unsigned long)(millis() / 3600000UL));
  wifiOff();
  lcdSlow(false);                // 되돌리고 박자를 다시 맞춘다
  s_sync = SYNC_IDLE;
  Serial.printf("sync: %s (%lus) %s\n", ok ? "ok" : "fail", (unsigned long)((millis() - s_wifiOnAt) / 1000), msg);   // 와이파이가 켜져 있던 전체 시간(10~20초 규칙)
  lock(); refreshWifiLabel(); setStatus(msg); refreshStale(); unlock();
}

// 설정에서 와이파이를 고르면 저장하고 바로 한 번 받아 온다
// 화면(LVGL) 작업에서는 값만 적고 깃발만 세운다. 저장·와이파이 끄기는 loop 가 받기와 부딪히지 않을 때 한다
// (전에는 loop 가 받는 중에 화면 쪽에서 와이파이를 꺼 버릴 수 있었다).
static volatile bool s_wifiApplyReq = false, s_forgetReq = false, s_rebootReq = false;
static String s_reqSsid, s_reqPw;
static void connectWifi(const String &ssid, const String &pw, bool save) {
  s_reqSsid = ssid; s_reqPw = save ? pw : String();
  s_wifiApplyReq = true;
  s_wifiFails = 0;
  if (s_sync != SYNC_IDLE) setStatus("받기가 끝난 뒤 적용합니다");
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
static void pwBgTap(lv_event_t *e) {   // 뒤 막을 스쳤을 때: 아직 아무것도 안 쳤을 때만 닫는다(친 글자가 날아가지 않게. 닫기는 [취소]·자판 닫기)
  if (!*lv_textarea_get_text(s_pwTa)) pwCancel(e);
}
static void onSsidPick(lv_event_t *e) {
  lv_obj_t *btn = lv_event_get_target(e);
  s_pickSsid = String(lv_list_get_btn_text(s_wifiList, btn));
  int sp = s_pickSsid.lastIndexOf("  (");
  if (sp > 0) s_pickSsid = s_pickSsid.substring(0, sp);
  // 비밀번호 없는(개방형) 와이파이는 묻지 않고 바로 연결한다
  if ((intptr_t)lv_obj_get_user_data(btn) == 1) {
    lv_label_set_text_fmt(s_wifiInfo, "'%s'에 연결하는 중... (비밀번호 없음)", s_pickSsid.c_str());
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
    lv_label_set_text_fmt(s_wifiInfo, "'%s'에 연결하는 중...", s_pickSsid.c_str());
    connectWifi(s_pickSsid, pw, true);
  } else if (code == LV_EVENT_CANCEL) pwCancel(e);   // 자판의 닫기 단추
}
static volatile bool s_scanReq = false;
static void onScan(lv_event_t *e) {
  lv_obj_clean(s_wifiList);
  if (s_sync != SYNC_IDLE) { lv_list_add_text(s_wifiList, "받는 중입니다. 잠시 뒤 다시 누르세요"); return; }   // 받는 중에는 찾지 않는다
  s_scanReq = true; lv_list_add_text(s_wifiList, "찾는 중...");
}
// 실수로 누르지 않게: 3초 안에 한 번 더 눌러야 한다. 3초가 지나면 단추 글이 돌아온다(loop).
static uint32_t s_forgetArmed = 0, s_rebootArmed = 0;
static lv_obj_t *s_forgetBtn = nullptr, *s_rebootBtn = nullptr;
static const char *FORGET_TXT = "저장한 와이파이 지우기", *REBOOT_TXT = "다시 켜기";
static void onForget(lv_event_t *e) {
  lv_obj_t *b = lv_event_get_current_target(e);
  if (!s_forgetArmed || millis() - s_forgetArmed > 3000) { s_forgetArmed = millis(); lv_label_set_text(lv_obj_get_child(b, 0), "한 번 더 누르면 지웁니다"); return; }
  s_forgetArmed = 0; lv_label_set_text(lv_obj_get_child(b, 0), FORGET_TXT);
  s_forgetReq = true;
  if (s_sync != SYNC_IDLE) setStatus("받기가 끝난 뒤 지웁니다");
}
static void onReboot(lv_event_t *e) {
  lv_obj_t *b = lv_event_get_current_target(e);
  if (!s_rebootArmed || millis() - s_rebootArmed > 3000) { s_rebootArmed = millis(); lv_label_set_text(lv_obj_get_child(b, 0), "한 번 더 누르세요"); return; }
  s_rebootArmed = 0; lv_label_set_text(lv_obj_get_child(b, 0), "다시 켜는 중");
  s_rebootReq = true;
}
static void disarmButtons() {   // loop 에서: 3초 지난 '한 번 더' 글을 되돌린다(바뀔 때 한 번만 그린다)
  if (s_forgetArmed && millis() - s_forgetArmed > 3000) { s_forgetArmed = 0; if (s_forgetBtn) lv_label_set_text(lv_obj_get_child(s_forgetBtn, 0), FORGET_TXT); }
  if (s_rebootArmed && millis() - s_rebootArmed > 3000) { s_rebootArmed = 0; if (s_rebootBtn) lv_label_set_text(lv_obj_get_child(s_rebootBtn, 0), REBOOT_TXT); }
}

// 화면: 0 주간 시간표 · 1 설정 · 2 시계 모드 · 3 선생님 찾기
enum View { V_WEEK = 0, V_SET = 1, V_CLOCK = 2, V_FIND = 3, V_DECK = 4, V_OFF = 5 };
static View s_view = V_CLOCK;   // 켜면 시계 화면(교장 모드면 교장 화면)
static View s_backView = V_WEEK; // 시계 화면을 누르면 돌아갈 탭(자동 전환 전에 보던 시간표·단축키)
// 주간표는 보일 때만 그리고, 숨어 있으면 표시만 해 두었다가 열 때 그린다
// 오늘 시간표(시계 화면)도 보일 때만 그린다. 다른 탭·교장 모드에서는 표시만 해 두었다가 시계 화면을 열 때 그린다.
static bool s_todayDirty = false;
static void renderTT() {
  setTopTitle();                                                     // 위쪽 막대 제목은 어느 탭에서나 보인다
  if (s_view == V_CLOCK && !s_principal) { s_todayDirty = false; renderToday(); } else s_todayDirty = true;
  if (s_view == V_WEEK && !s_principal) renderWeek(); else s_weekDirty = true;
}

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
static bool s_whereSame = false;   // 마지막 받기가 304(바뀌지 않음)였나 → 다시 그리지 않는다
static bool downloadWhere(uint32_t budget = 60000) {
  s_whereSame = false;
  if (!WiFi.isConnected()) return false;
  const uint32_t t0 = millis();
  NetworkClientSecure client; netPrep(client, budget);
  HTTPClient http;
  if (!http.begin(client, String(BASE_URL) + "where.json")) return false;
  http.useHTTP10(true);
  httpLimits(http, budget);
  etagAsk(http, "et_whr", "/where.json");
  int code = http.GET();
  bool ok = false;
  if (code == 304) { ok = true; s_whereSame = true; }
  else if (code == 200) {
    String body = http.getString();
    if (parseWhere(body)) { ok = true; if (saveAtomic("/where.json", body)) etagKeep(http, "et_whr"); }
  }
  http.end();
  Serial.printf("where -> %d %s (%.1fs)\n", code, ok ? "ok" : "fail", secs(t0));
  return ok;
}
static void loadWhereFromFile() {
  File f = LittleFS.open("/where.json", "r");
  if (!f) return;
  String body = f.readString(); f.close();
  if (!parseWhere(body)) etagForget("et_whr");
}
// "n:102 수학" → 종류 'n', 글 "102 수학"
static char whereKind(const char *s) { return (s && s[0] && s[1] == ':') ? s[0] : 0; }
static const char *whereText(const char *s) { return (s && s[0] && s[1] == ':') ? s + 2 : ""; }

static bool s_findScrollPending = false;   // 교장 '선생님 판'에서 이름을 눌러 왔다 → 그 단추가 보이게 한 번 굴린다
static void markFinderPick() {   // 고른 선생님 단추를 호박색으로(누구를 보고 있는지 보이게). 바뀐 단추만 다시 그린다
  if (!s_findGrid) return;
  const uint32_t n = lv_obj_get_child_cnt(s_findGrid);
  for (uint32_t i = 0; i < n; i++) {
    lv_obj_t *b = lv_obj_get_child(s_findGrid, i), *l = lv_obj_get_child(b, 0);
    if (!l) continue;
    const bool sel = s_findSel.length() && s_findSel == lv_label_get_text(l);
    setBgIf(b, sel ? NOW_TAG : D_ROW);
    setTextColIf(l, sel ? NOW_TX : D_TEXT);
    if (sel && s_findScrollPending) { s_findScrollPending = false; lv_obj_update_layout(s_findGrid); lv_obj_scroll_to_view(b, LV_ANIM_OFF); }
  }
  s_findScrollPending = false;
}
static void renderFinder() {
  if (!s_viewFind) return;
  markFinderPick();
  JsonArray dates = s_where["dates"].as<JsonArray>();
  JsonObject who;
  for (JsonObject t : s_where["teachers"].as<JsonArray>()) if (s_findSel == (const char *)(t["n"] | "")) { who = t; break; }
  if (who.isNull()) {
    setTextIf(s_findName, dates.isNull() ? "자료를 받는 중" : "선생님을 고르세요");
    setTextIf(s_findHome, ""); setTextIf(s_findNowT, ""); setTextIf(s_findNow, "");
    setTextIf(s_findNext, ""); setTextIf(s_findDay, "");
    for (int p = 0; p < 7; p++) showIf(s_findRow[p], false);
    return;
  }
  setTextFmtIf(s_findName, "%s 선생님", s_findSel.c_str());
  const char *home = who["h"] | "";
  setTextIf(s_findHome, *home ? (String("담임 ") + home).c_str() : "");

  // 오늘(없으면 다음 수업일). 수업이 끝난 뒤(16:30~)에는 다음 수업일 시간표를 보인다(시계 화면과 같은 규칙)
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
  else if (nm < toMin("08:40")) { setTextIf(s_findNowT, "지금"); setTextIf(s_findNow, "수업 전"); }
  else if (nm >= toMin("16:30")) { setTextIf(s_findNowT, "지금"); setTextIf(s_findNow, "수업 끝"); }
  else { setTextIf(s_findNowT, "지금"); setTextIf(s_findNow, "쉬는 시간 (교무실)"); }
  if (nextP >= 0) setTextFmtIf(s_findNext, "다음  %d교시 %s · %s", nextP + 1, PERIOD_START[nextP], whereText(day[nextP] | ""));
  else setTextIf(s_findNext, isToday ? "오늘 남은 수업 없음" : "");

  for (int p = 0; p < 7; p++) {
    const char *c = day[p] | "";
    char k = whereKind(c);
    bool now = isToday && p == nowP;
    showIf(s_findRow[p], true);
    setBgIf(s_findRow[p], now ? NOW_ROW : D_ROW);
    setBorderIf(s_findRow[p], now ? NOW_ROW : (k ? styleOf(k).border : D_LINE));
    setTextColIf(s_findRowP[p], now ? C_MUTED : D_MUTED);
    setTextIf(s_findRowT[p], k ? whereText(c) : "공강");
    setTextColIf(s_findRowT[p], now ? C_TEXT : (k ? D_TEXT : D_MUTED));
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
    lv_obj_set_size(b, big() ? (lv_obj_get_style_width(s_findGrid, 0) - 8 - 4 * 8) / 5 : 96, big() ? 48 : 40);   // 1024: 한 줄 5개, 손가락 크기
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
  const float K = s_W / 800.0f;
  auto S = [&](int v) { return (int)lroundf(v * K); };
  const bool B = big();
  const lv_font_t *fRow = B ? &kr16 : &kr14;                         // 1024 는 한 단계 큰 글자
  s_viewFind = box(scr, D_BG, 0, 0);
  lv_obj_set_size(s_viewFind, s_W, H); lv_obj_set_pos(s_viewFind, 0, top);
  lv_obj_add_flag(s_viewFind, LV_OBJ_FLAG_HIDDEN);
  const int LW = B ? S(440) : 440, PH = H - 2 * M + 4;               // 1024 는 비율대로 넓힌다
  lv_obj_t *left = box(s_viewFind, D_PANEL, D_LINE, 16);
  lv_obj_set_size(left, LW, PH); lv_obj_set_pos(left, M, M - 4);
  lv_obj_set_pos(label(left, fRow, D_MUTED, "선생님을 고르세요"), 16, B ? 16 : 12);
  s_findGridParent = left;
  s_findGrid = lv_obj_create(left);
  lv_obj_clear_flag(s_findGrid, LV_OBJ_FLAG_SCROLL_MOMENTUM | LV_OBJ_FLAG_SCROLL_ELASTIC);
  lv_obj_remove_style_all(s_findGrid);
  const int GY = B ? 52 : 36;
  lv_obj_set_size(s_findGrid, LW - 20, PH - GY - 8); lv_obj_set_pos(s_findGrid, 10, GY);
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
  s_findHome = label(right, fRow, D_MUTED, "");
  lv_obj_align(s_findHome, LV_ALIGN_TOP_RIGHT, -16, 18);
  const int NOW_Y = 46, NOW_H = B ? S(64) : 64;
  lv_obj_t *nowBox = box(right, NOW_ROW, 0, 12);                    // '지금' = 밝은 크림 칸(시계 화면의 지금 교시 줄과 같은 뜻. 빨강은 경고에만)
  lv_obj_set_size(nowBox, RW - 24, NOW_H); lv_obj_set_pos(nowBox, 12, NOW_Y);
  s_findNowT = label(nowBox, fRow, C_MUTED, "");
  lv_obj_set_pos(s_findNowT, 14, B ? 12 : 9);
  s_findNow = label(nowBox, &kr20, C_TEXT, "");
  lv_obj_set_width(s_findNow, RW - 52); lv_label_set_long_mode(s_findNow, LV_LABEL_LONG_DOT);
  lv_obj_set_pos(s_findNow, 14, B ? 42 : 31);
  const int NEXT_Y = NOW_Y + NOW_H + 10, DAY_Y = NEXT_Y + (B ? 28 : 26), ROW_Y = DAY_Y + (B ? 26 : 22);
  s_findNext = label(right, fRow, D_SUB, "");
  lv_obj_set_width(s_findNext, RW - 32); lv_label_set_long_mode(s_findNext, LV_LABEL_LONG_DOT);
  lv_obj_set_pos(s_findNext, 16, NEXT_Y);
  s_findDay = label(right, fRow, D_MUTED, "");
  lv_obj_set_pos(s_findDay, 16, DAY_Y);
  const int RP_ = B ? (PH - ROW_Y - 10) / 7 : 34, RH = RP_ - 4;     // 1024: 남은 높이를 7줄이 나눠 쓴다
  for (int p = 0; p < 7; p++) {
    s_findRow[p] = box(right, D_ROW, D_LINE, 6);
    lv_obj_set_size(s_findRow[p], RW - 24, RH); lv_obj_set_pos(s_findRow[p], 12, ROW_Y + p * RP_);
    s_findRowP[p] = label(s_findRow[p], fRow, D_MUTED, "");
    lv_label_set_text_fmt(s_findRowP[p], "%d교시", p + 1);
    lv_obj_align(s_findRowP[p], LV_ALIGN_LEFT_MID, 10, 0);
    const int TX = B ? 72 : 62;
    s_findRowT[p] = label(s_findRow[p], fRow, D_TEXT, "");
    lv_obj_set_width(s_findRowT[p], RW - 24 - TX - 10); lv_label_set_long_mode(s_findRowT[p], LV_LABEL_LONG_DOT);
    lv_obj_align(s_findRowT[p], LV_ALIGN_LEFT_MID, TX, 0);
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

// ── 단축키(스트림덱처럼, 2026-10-25 사용자 요청) ──
// 보드는 UART 선(CH343, 굽기·기록에 쓰는 단자)으로 컴퓨터와 이어져 있다. 단추를 누르면 그 선으로 '@deck 이름' 한 줄을 보내고,
// 컴퓨터의 도우미(tools/deck_helper.ps1)가 받아 프로그램·사이트를 연다. 도우미는 5초마다 '@pc on' 을 보내 준다
// → 15초 넘게 안 오면 '컴퓨터 꺼짐'으로 본다(화면 불 규칙에도 쓴다).
// USB 키보드(TinyUSB) 방식은 이 빌드(custom_sdkconfig 로 ESP-IDF 를 다시 컴파일)에 TinyUSB 부품이 빠져 있어 쓰지 못했다.
// 어떤 프로그램을 열지는 컴퓨터 쪽 도우미 표에서 정한다(학교 컴퓨터마다 경로가 달라서).
extern const lv_img_dsc_t deck_explorer, deck_claude, deck_gemini, deck_gpt, deck_cmd, deck_powershell, deck_neis, deck_naver,
    deck_youtube, deck_coolmsg, deck_kakao, deck_excel, deck_ppt, deck_close, deck_hwp, deck_desktop;
struct DeckItem { const char *label; const lv_img_dsc_t *icon; const char *key; };   // key: 도우미에게 보내는 이름(영문)
// 2026-10-25: 웹→나이스, 오피스·터미널 빼고 제미나이·GPT, 워드 → 창닫기(Alt+F4)(사용자 요청)
static const DeckItem DECK[16] = {
  {"탐색기", &deck_explorer, "explorer"}, {"Claude", &deck_claude, "claude"}, {"제미나이", &deck_gemini, "gemini"}, {"GPT", &deck_gpt, "gpt"},
  {"CMD", &deck_cmd, "cmd"}, {"파워셸", &deck_powershell, "powershell"}, {"나이스", &deck_neis, "neis"}, {"네이버", &deck_naver, "naver"},
  {"유튜브", &deck_youtube, "youtube"}, {"쿨메신저", &deck_coolmsg, "coolmsg"}, {"카카오톡", &deck_kakao, "kakao"}, {"엑셀", &deck_excel, "excel"},
  {"PPT", &deck_ppt, "ppt"}, {"창닫기", &deck_close, "close"}, {"한글", &deck_hwp, "hwp"}, {"바탕화면", &deck_desktop, "desktop"},
};
static lv_obj_t *s_viewDeck = nullptr, *s_tabDeck = nullptr, *s_deckState = nullptr;
static lv_obj_t *s_deckImg[16];         // 아이콘(도우미가 꺼져 있으면 흐리게)
static volatile bool s_usbOn = false;   // 컴퓨터 도우미가 살아 있나('@pc on' 이 15초 안에 왔나)
static volatile bool s_usbSeen = false; // 켠 뒤 한 번이라도 도우미 신호를 받았나 → 화면 불은 컴퓨터를 따른다
static uint32_t s_pcLast = 0;           // 마지막 '@pc on' 받은 때(millis)
static uint32_t s_deckSentAt = 0;       // 마지막으로 보내거나 답을 받은 때(60초 뒤 안내 글로 되돌린다)
static int s_deckWaitKey = -1;          // 보내고 답을 기다리는 단추(5초 안에 답이 없으면 알린다)
static uint32_t s_deckWaitAt = 0;

// ── 단축키 꾸미기(2026-10-26): 컴퓨터에서 바꾼 이름·아이콘을 받아 LittleFS /deck/ 에 두고 켤 때 읽는다 ──
// 줄 약속·바이트 형식은 common/deck-helper/설계_단축키꾸미기.md 2~5장(바꾸지 않는다).
#define DECK_PX 15552                   // 72×72×3(RGB565 작은끝 + 알파)
static bool s_deckCustom = false;       // 받은 설정을 쓰는 중인가
static char s_deckHash[9] = "0";        // /deck/cfg.json 의 CRC-32(없으면 "0")
static uint8_t *s_deckPix = nullptr;    // 받은 아이콘 16칸(PSRAM, 약 250KB)
static lv_img_dsc_t s_deckDsc[16];
static const lv_img_dsc_t *s_deckIco[16];
static char s_deckName[16][40];
static char s_deckIcCrc[16][9];         // '@deckls' 에 알릴 칸별 crc("-" = 내장)
static lv_obj_t *s_deckLbl[16];         // 이름 글(받기 끝에 한 번 다시 쓴다)
static lv_obj_t *s_deckResetBtn = nullptr;
static uint32_t s_deckResetArmed = 0;
static int s_deckPW = 0, s_deckM = 0, s_deckEditW = 0;   // 안내 줄 폭 계산용([꾸미기] 단추 폭)
// 받는 중 상태
static bool s_deckUp = false;
static uint32_t s_deckUpAt = 0;
static int s_deckUpItem = -1;           // -1 없음 · 0~15 아이콘 · 16 cfg
static File s_deckUpFile;
static uint32_t s_deckUpLen = 0, s_deckUpWant = 0, s_deckUpCrc = 0, s_deckUpWantCrc = 0;
static int s_deckUpSeq = -1, s_deckUpN = 0, s_deckUpDone = 0;
static bool s_deckUpCfg = false;        // 이번에 cfg 를 다 받았나
static char s_deckUpMsg[64] = "";       // 받는 중 안내 줄 글

static const lv_img_dsc_t *deckIcon(int i) { return s_deckCustom ? s_deckIco[i] : DECK[i].icon; }
static const char *deckName(int i) { return s_deckCustom ? s_deckName[i] : DECK[i].label; }
static bool deckEmpty(int i) { return s_deckCustom && !s_deckName[i][0]; }   // 이름 없는 칸: 흐리게, 눌러도 안 보냄
static void deckTmpPath(int item, char *p, size_t n) { if (item == 16) snprintf(p, n, "/deck/cfg.tmp"); else snprintf(p, n, "/deck/%d.tmp", item); }
static void deckDstPath(int item, char *p, size_t n) { if (item == 16) snprintf(p, n, "/deck/cfg.json"); else snprintf(p, n, "/deck/%d.bin", item); }
// /deck 안 파일 지우기(tmpOnly 면 .tmp 만)
static void deckRemoveFiles(bool tmpOnly) {
  if (!LittleFS.exists("/deck")) { LittleFS.mkdir("/deck"); return; }
  char paths[40][32]; int k = 0;
  File dir = LittleFS.open("/deck");
  if (!dir) return;
  for (File e = dir.openNextFile(); e && k < 40; e = dir.openNextFile()) {
    const char *nm = e.name();
    if (!tmpOnly || strstr(nm, ".tmp")) snprintf(paths[k++], 32, "/deck/%s", nm);
    e.close();
  }
  dir.close();
  for (int i = 0; i < k; i++) LittleFS.remove(paths[i]);
}
// UTF-8 을 글자 가운데에서 자르지 않고 39바이트까지 복사
static void deckCopyName(char *dst, const char *src) {
  size_t o = 0;
  while (src && *src) {
    const uint8_t c = (uint8_t)*src;
    const size_t w = c < 0x80 ? 1 : (c >> 5) == 6 ? 2 : (c >> 4) == 14 ? 3 : (c >> 3) == 30 ? 4 : 1;
    if (o + w > 39) break;
    for (size_t j = 0; j < w && src[j]; j++) dst[o++] = src[j];
    src += w;
  }
  dst[o] = 0;
}
// 켤 때·받기 끝에: /deck/cfg.json 을 읽어 이름·아이콘을 채운다. 없거나 틀리면 내장 16개.
static void deckLoad() {
  s_deckCustom = false; strcpy(s_deckHash, "0");
  for (int i = 0; i < 16; i++) { s_deckIco[i] = DECK[i].icon; strcpy(s_deckIcCrc[i], "-"); s_deckName[i][0] = 0; }
  File f = LittleFS.open("/deck/cfg.json", "r");
  if (!f) return;
  const size_t len = f.size();
  if (len == 0 || len > 4096) { f.close(); Serial.println("deck cfg bad (size)"); return; }
  char *cb = (char *)heap_caps_malloc(len + 1, MALLOC_CAP_SPIRAM);
  if (!cb) { f.close(); return; }
  const size_t got = f.read((uint8_t *)cb, len); f.close(); cb[got] = 0;
  const uint32_t crc = esp_rom_crc32_le(0, (const uint8_t *)cb, got);
  JsonDocument d(&s_alloc);
  const bool ok = got == len && !deserializeJson(d, cb, got) && d["v"] == 1 && d["n"].size() == 16 && d["ic"].size() == 16;
  heap_caps_free(cb);
  if (!ok) { Serial.println("deck cfg bad"); return; }
  if (!s_deckPix) s_deckPix = (uint8_t *)heap_caps_malloc(16 * DECK_PX, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
  if (!s_deckPix) { Serial.println("deck psram fail"); return; }
  for (int i = 0; i < 16; i++) {
    deckCopyName(s_deckName[i], d["n"][i] | "");
    const char *ic = d["ic"][i] | "";
    if (strlen(ic) == 8 && strspn(ic, "0123456789abcdefABCDEF") == 8) {
      char p[24]; snprintf(p, sizeof p, "/deck/%d.bin", i);
      File b = LittleFS.open(p, "r");
      uint8_t *dst = s_deckPix + i * DECK_PX;
      if (b && b.size() == DECK_PX && b.read(dst, DECK_PX) == DECK_PX && esp_rom_crc32_le(0, dst, DECK_PX) == strtoul(ic, nullptr, 16)) {
        lv_img_dsc_t &ds = s_deckDsc[i];
        memset(&ds, 0, sizeof ds);
        ds.header.cf = LV_IMG_CF_TRUE_COLOR_ALPHA; ds.header.w = 72; ds.header.h = 72;
        ds.data_size = DECK_PX; ds.data = dst;
        s_deckIco[i] = &ds;
        snprintf(s_deckIcCrc[i], 9, "%08lx", (unsigned long)strtoul(ic, nullptr, 16));
      } else Serial.printf("deck icon %d bad\n", i);
      if (b) b.close();
    } else if (!strncmp(ic, "builtin:", 8)) {
      for (int k = 0; k < 16; k++) if (!strcmp(DECK[k].key, ic + 8)) { s_deckIco[i] = DECK[k].icon; break; }
    }
  }
  s_deckCustom = true;
  snprintf(s_deckHash, sizeof s_deckHash, "%08lx", (unsigned long)crc);
  Serial.printf("deck custom %s\n", s_deckHash);
}
// 도우미가 없을 때 단축키를 누르면 뜨는 안내 창(맨 위 층): 컴퓨터에서 짧은 주소로 도우미를 받아 설치하게 한다(2026-10-26).
// 바깥 덮개나 [닫기]를 누르면 닫히고, 도우미가 이어지면(deckPoll) 저절로 닫힌다. 주소는 사이트(firebase.json)의 /deck 과 같게.
#define DECK_HELP_URL "penedu.web.app/deck"
static lv_obj_t *s_deckHelp = nullptr;
static void closeDeckHelp() { if (s_deckHelp) { lv_obj_del_async(s_deckHelp); s_deckHelp = nullptr; } }   // 자기 이벤트 안에서도 지울 수 있게 async
static void showDeckHelp() {
  if (s_deckHelp) return;
  const bool small = s_W <= 800;
  s_deckHelp = box(lv_layer_top(), 0x000000, 0, 0);
  lv_obj_set_style_bg_opa(s_deckHelp, LV_OPA_70, 0);
  lv_obj_set_size(s_deckHelp, s_W, s_H); lv_obj_set_pos(s_deckHelp, 0, 0);
  lv_obj_add_flag(s_deckHelp, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_add_event_cb(s_deckHelp, [](lv_event_t *) { closeDeckHelp(); }, LV_EVENT_CLICKED, nullptr);
  const int CW = small ? 600 : 700, TW = CW - 56;
  lv_obj_t *card = box(s_deckHelp, D_PANEL, D_SUB, 16);
  lv_obj_set_size(card, CW, LV_SIZE_CONTENT); lv_obj_center(card);
  lv_obj_add_flag(card, LV_OBJ_FLAG_CLICKABLE);                 // 카드를 눌러도 닫히지 않게(바깥 덮개만 닫는다)
  lv_obj_set_flex_flow(card, LV_FLEX_FLOW_COLUMN);
  lv_obj_set_style_pad_all(card, small ? 22 : 28, 0); lv_obj_set_style_pad_row(card, small ? 8 : 12, 0);
  auto line = [&](const lv_font_t *f, uint32_t col, const char *t) {
    lv_obj_t *l = label(card, f, col, t);
    lv_obj_set_width(l, TW); lv_label_set_long_mode(l, LV_LABEL_LONG_WRAP);
    return l;
  };
  line(&kr28, D_TEXT, "컴퓨터에 탭덱이 필요해요");
  line(&kr16, D_SUB, "단축키로 컴퓨터 프로그램을 열려면, 이 보드를 꽂은 컴퓨터에 작은 프로그램 '탭덱'을 한 번 깔아야 해요.");
  line(&kr20, D_TEXT, "1. 컴퓨터 인터넷 창의 주소 칸에 이 주소를 쳐요");
  lv_obj_t *url = box(card, D_ROW, D_LINE, 10);
  lv_obj_set_size(url, TW, LV_SIZE_CONTENT); lv_obj_set_style_pad_ver(url, 10, 0);
  lv_obj_t *ul = label(url, &kr28, C_DUTY, DECK_HELP_URL); lv_obj_center(ul);
  line(&kr20, D_TEXT, "2. [탭덱 받기]를 누르고, 받은 파일을 더블클릭해요");
  line(&kr20, D_TEXT, "3. 컴퓨터 화면 오른쪽 아래 아이콘이 초록이 되면 다시 눌러요");
  line(&kr16, C_DUTY, "이미 깔았는데 안 되면: 컴퓨터 시작 메뉴에서 '탭덱'을 눌러 켜요.");
  line(&kr14, D_MUTED, "깔았는데도 안 되면: 이 보드가 'UART' 단자로 컴퓨터에 꽂혀 있는지 보세요(데이터 케이블).");
  lv_obj_t *cb = button(card, "닫기", 120, 44, D_ROW, D_TEXT);
  lv_obj_add_event_cb(cb, [](lv_event_t *) { closeDeckHelp(); }, LV_EVENT_CLICKED, nullptr);
}
// [새로 고침] 단추(단축키 판 오른쪽 아래): 컴퓨터에 '@pc?' 를 보내 도우미가 살아 있는지 바로 확인한다(2026-10-26).
// 6초 안에 '@pc on' 이 새로 오면 연결됨(새 도우미는 바로, 예전 도우미도 5초마다 보낸다), 안 오면 도우미가 꺼진 것 → 안내 창.
static uint32_t s_deckPingAt = 0;   // 누른 때(0 = 기다리지 않음). 판정은 deckPoll 에서
static void onDeckRefresh(lv_event_t *) {
  s_deckPingAt = millis() ? millis() : 1;
  Serial.printf("\n@pc?\n");
  if (s_deckState) {
    lv_label_set_text(s_deckState, LV_SYMBOL_REFRESH "  컴퓨터의 탭덱을 찾는 중...");
    lv_obj_set_style_text_color(s_deckState, lv_color_hex(D_SUB), 0);
  }
}
// [꾸미기] 단추(단축키 판 왼쪽 아래): 컴퓨터에 '@pcui' 를 보내 탭덱의 꾸미기 창을 띄운다(2026-10-27).
// 탭덱이 '@pcui ok' 로 답하면 연 것(예전 탭덱은 이 줄을 모르고 그냥 넘긴다 → 6초 뒤 안내).
static uint32_t s_deckUiAt = 0;   // 누른 때(0 = 기다리지 않음)
static void onDeckEdit(lv_event_t *) {
  if (!s_usbOn) { showDeckHelp(); return; }             // 탭덱이 없으면 받는 법 안내
  s_deckUiAt = millis() ? millis() : 1;
  Serial.printf("\n@pcui\n");
  if (s_deckState) {
    lv_label_set_text(s_deckState, LV_SYMBOL_UPLOAD "  컴퓨터에 꾸미기 창을 여는 중...");
    lv_obj_set_style_text_color(s_deckState, lv_color_hex(D_SUB), 0);
  }
  s_deckSentAt = millis();
}
static void onDeck(lv_event_t *e) {
  const int i = (int)(intptr_t)lv_event_get_user_data(e);
  if (i < 0 || i >= 16) return;
  if (s_deckUp) {                                       // 아이콘을 받는 중에는 누르지 않는다
    if (s_deckState) lv_label_set_text(s_deckState, "받는 중입니다 · 잠시 뒤 누르세요");
    return;
  }
  if (deckEmpty(i)) return;                             // 비워 둔 칸
  if (!s_usbOn) {
    showDeckHelp();
    if (s_deckState) {
      lv_label_set_text(s_deckState, "컴퓨터의 탭덱과 연결되지 않았습니다 · UART 선과 컴퓨터의 탭덱을 확인하세요");
      lv_obj_set_style_text_color(s_deckState, lv_color_hex(NOW_TAG), 0);
    }
    s_deckSentAt = millis();                            // 1분 뒤 안내 글로 돌아간다
    return;
  }
  static uint32_t lastMs = 0; static int lastI = -1;
  if (i == lastI && millis() - lastMs < 2000) {         // 2초 안에 같은 단추를 또 누르면 보내지 않는다(창이 두 개 열리지 않게) — 대신 알린다
    if (s_deckState) lv_label_set_text_fmt(s_deckState, "'%s' 이미 보냈습니다 · 잠시 기다리세요", deckName(i));
    return;
  }
  lastI = i; lastMs = millis();
  if (s_deckCustom) Serial.printf("\n@deck s%d\n", i);   // 꾸민 설정: 칸 번호(무엇을 열지는 컴퓨터가 안다)
  else Serial.printf("\n@deck %s\n", DECK[i].key);      // 앞의 줄바꿈: 다른 기록 줄과 섞이지 않게
  if (s_deckState) {
    lv_label_set_text_fmt(s_deckState, "'%s' 보냈습니다 · 여는 중", deckName(i));
    lv_obj_set_style_text_color(s_deckState, lv_color_hex(C_OK), 0);
  }
  s_deckSentAt = millis();
  s_deckWaitKey = i; s_deckWaitAt = millis();
}
static void deckStateText() {
  if (!s_deckState) return;
  if (s_deckUp) { setTextIf(s_deckState, s_deckUpMsg); setTextColIf(s_deckState, C_DUTY); return; }   // 받는 중에는 진행 글
  setTextIf(s_deckState, s_usbOn ? LV_SYMBOL_OK "  컴퓨터와 연결됨 · 단추를 누르면 프로그램이 열립니다"
                                 : LV_SYMBOL_WARNING "  컴퓨터의 탭덱을 기다리는 중 · 처음이면 " DECK_HELP_URL " 에서 받아요");
  setTextColIf(s_deckState, s_usbOn ? C_OK : D_MUTED);   // 기다리는 것은 문제가 아니다(노랑은 '지금'·문제에만)
}
static void deckIconsDim() {   // 도우미가 꺼져 있으면 아이콘을 흐리게(누를 수 없다는 뜻)
  for (int i = 0; i < 16; i++) if (s_deckImg[i]) lv_obj_set_style_img_opa(s_deckImg[i], deckEmpty(i) ? LV_OPA_20 : s_usbOn ? LV_OPA_COVER : LV_OPA_50, 0);
}
static const char *deckLabel(const char *key) {
  if (key[0] == 's' && isdigit((unsigned char)key[1])) { const int i = atoi(key + 1); if (i >= 0 && i < 16) return deckName(i); }   // '@deck ok s3'
  for (int i = 0; i < 16; i++) if (!strcmp(DECK[i].key, key)) return DECK[i].label;
  return key;
}
static volatile bool s_deckResetReq = false;   // [기본 아이콘] 단추 → loop 에서 되돌린다
// 안내 줄 폭: [기본 아이콘] 단추가 보이면 양쪽을 그만큼 비운다(가운데 맞춤 유지)
static void deckResetBtnVis() {
  if (!s_deckResetBtn || !s_deckState) return;
  if (s_deckCustom) lv_obj_clear_flag(s_deckResetBtn, LV_OBJ_FLAG_HIDDEN); else lv_obj_add_flag(s_deckResetBtn, LV_OBJ_FLAG_HIDDEN);
  // 왼쪽 = [꾸미기], 오른쪽 = [새로 고침](+ [기본 아이콘]). 넓은 쪽만큼 양쪽을 비운다
  const int right = 56 + (s_deckCustom ? 8 + lv_obj_get_style_width(s_deckResetBtn, 0) : 0);
  const int side = right > s_deckEditW ? right : s_deckEditW;
  lv_obj_set_width(s_deckState, s_deckPW - 2 * s_deckM - 2 * (side + 8));
}
// 16칸을 지금 설정으로 한 번 다시 그린다(받기 끝·되돌리기에서만). lock() 안에서 부른다.
static void deckRedraw() {
  lv_img_cache_invalidate_src(NULL);   // 같은 주소에 새 그림을 썼으니 그림 기억을 비운다
  for (int i = 0; i < 16; i++) {
    if (s_deckImg[i]) lv_img_set_src(s_deckImg[i], deckIcon(i));
    if (s_deckLbl[i]) lv_label_set_text(s_deckLbl[i], deckName(i));
  }
  deckIconsDim();
  deckResetBtnVis();
}
static void deckSay(const char *msg) {   // 받는 중 안내 줄
  snprintf(s_deckUpMsg, sizeof s_deckUpMsg, "%s", msg);
  lock(); deckStateText(); unlock();
}
// 받기 중단(임시 파일 지움)
static void deckAbortUp() {
  if (s_deckUpFile) s_deckUpFile.close();
  if (s_deckUp) deckRemoveFiles(true);
  s_deckUp = false; s_deckUpItem = -1;
}
// 기본 아이콘으로 되돌리기('@deckreset', [기본 아이콘] 단추)
static void deckReset() {
  deckAbortUp();
  deckRemoveFiles(false);
  s_deckCustom = false; strcpy(s_deckHash, "0");
  for (int i = 0; i < 16; i++) strcpy(s_deckIcCrc[i], "-");
  lock(); deckRedraw();
  if (s_deckState) { lv_label_set_text(s_deckState, LV_SYMBOL_OK "  기본 아이콘으로 되돌렸습니다"); lv_obj_set_style_text_color(s_deckState, lv_color_hex(C_OK), 0); }
  unlock();
  s_deckSentAt = millis() ? millis() : 1;
  Serial.println("deck reset");
}
// 받는 줄 처리(설계 2-3). 처리했으면 true
static bool deckUpLine(char *buf, uint32_t ms) {
  if (strncmp(buf, "@deck", 5) || !strncmp(buf, "@deck ok ", 9) || !strncmp(buf, "@deck fail ", 11) || !strcmp(buf, "@deckhelp")) return false;
  s_pcLast = ms ? ms : 1; s_usbSeen = true;              // 도우미가 살아 있다
  if (s_deckUp) s_deckUpAt = ms;
  if (!strcmp(buf, "@deckls")) {
    Serial.printf("\n@deckls %s", s_deckHash);
    for (int i = 0; i < 16; i++) Serial.printf(" %s", s_deckCustom ? s_deckIcCrc[i] : "-");
    Serial.print("\n");
  } else if (!strncmp(buf, "@deckbegin ", 11)) {
    if (s_sync != SYNC_IDLE || s_pcStep >= 0) { Serial.print("\n@deckbusy\n"); return true; }   // 와이파이 받기 중(또는 컴퓨터가 대신 받는 중)
    char h[16] = ""; int n = -1;
    if (sscanf(buf + 11, "%15s %d", h, &n) != 2 || n < 0 || n > 16) { Serial.print("\n@deckbegin fail args\n"); return true; }
    if (s_deckUpFile) s_deckUpFile.close();
    s_deckUp = true;
    deckRemoveFiles(true);                               // 남은 .tmp 지우기
    s_deckUpAt = ms; s_deckUpItem = -1; s_deckUpN = n; s_deckUpDone = 0; s_deckUpCfg = false; s_deckSentAt = 0;
    char m[48];
    if (n) snprintf(m, sizeof m, LV_SYMBOL_DOWNLOAD "  아이콘 받는 중 0/%d", n); else snprintf(m, sizeof m, LV_SYMBOL_DOWNLOAD "  설정 받는 중");
    deckSay(m);
    Serial.printf("deck upload begin %s %d\n", h, n);
    Serial.print("\n@deckbegin ok\n");
  } else if (!strncmp(buf, "@deckitem end ", 14)) {
    const char *ks = buf + 14;
    const int k = !strcmp(ks, "c") ? 16 : atoi(ks);
    if (!s_deckUp || k != s_deckUpItem || !s_deckUpFile) { Serial.printf("\n@deckitem bad %s state\n", ks); return true; }
    s_deckUpFile.close();
    char tp[24], dp[24]; deckTmpPath(k, tp, sizeof tp); deckDstPath(k, dp, sizeof dp);
    if (s_deckUpLen == s_deckUpWant && s_deckUpCrc == s_deckUpWantCrc) {
      LittleFS.remove(dp);
      if (!LittleFS.rename(tp, dp)) { LittleFS.remove(tp); s_deckUpItem = -1; Serial.printf("\n@deckitem bad %s rename\n", ks); return true; }
      if (k == 16) s_deckUpCfg = true; else s_deckUpDone++;
      Serial.printf("\n@deckitem done %s\n", ks);
    } else {
      LittleFS.remove(tp);
      Serial.printf("\n@deckitem bad %s %s\n", ks, s_deckUpLen != s_deckUpWant ? "size" : "crc");
    }
    s_deckUpItem = -1;
  } else if (!strncmp(buf, "@deckitem ", 10)) {
    char ks[8] = ""; unsigned long len = 0; char cs[16] = "";
    if (sscanf(buf + 10, "%7s %lu %15s", ks, &len, cs) != 3) { Serial.print("\n@deckitem fail ? args\n"); return true; }
    if (!s_deckUp) { Serial.printf("\n@deckitem fail %s state\n", ks); return true; }
    const bool isCfg = !strcmp(ks, "c");
    const int k = isCfg ? 16 : atoi(ks);
    if (!isCfg && (!isdigit((unsigned char)ks[0]) || k < 0 || k > 15)) { Serial.printf("\n@deckitem fail %s slot\n", ks); return true; }
    if (isCfg ? (len == 0 || len > 4096) : len != DECK_PX) { Serial.printf("\n@deckitem fail %s size\n", ks); return true; }
    if (s_deckUpFile) s_deckUpFile.close();
    char tp[24]; deckTmpPath(k, tp, sizeof tp);
    s_deckUpFile = LittleFS.open(tp, "w");
    if (!s_deckUpFile) { s_deckUpItem = -1; Serial.printf("\n@deckitem fail %s open\n", ks); return true; }
    s_deckUpItem = k; s_deckUpLen = 0; s_deckUpWant = len; s_deckUpCrc = 0; s_deckUpWantCrc = strtoul(cs, nullptr, 16); s_deckUpSeq = -1;
    char m[48];
    const int tot = s_deckUpN > 0 ? s_deckUpN : 1;
    if (isCfg) snprintf(m, sizeof m, LV_SYMBOL_DOWNLOAD "  설정 받는 중");
    else snprintf(m, sizeof m, LV_SYMBOL_DOWNLOAD "  아이콘 받는 중 %d/%d", s_deckUpDone + 1 < tot ? s_deckUpDone + 1 : tot, tot);
    deckSay(m);
    Serial.printf("\n@deckitem ok %s\n", ks);
  } else if (!strncmp(buf, "@deckdata ", 10)) {
    char ks[8] = ""; int seq = -1; int off = 0;
    if (sscanf(buf + 10, "%7s %d %n", ks, &seq, &off) < 2 || off <= 0) { Serial.print("\n@deckdata err ? ? args\n"); return true; }
    const int k = !strcmp(ks, "c") ? 16 : atoi(ks);
    if (!s_deckUp || k != s_deckUpItem || !s_deckUpFile) { Serial.printf("\n@deckdata err %s %d state\n", ks, seq); return true; }
    if (seq == s_deckUpSeq) { Serial.printf("\n@deckdata ok %s %d\n", ks, seq); return true; }   // 답이 사라져 다시 온 것: 쓰지 않는다
    if (seq != s_deckUpSeq + 1) { Serial.printf("\n@deckdata err %s %d seq\n", ks, seq); return true; }
    static uint8_t dec[256]; size_t olen = 0;
    const char *b64 = buf + 10 + off;
    if (mbedtls_base64_decode(dec, sizeof dec, &olen, (const unsigned char *)b64, strlen(b64)) != 0) { Serial.printf("\n@deckdata err %s %d b64\n", ks, seq); return true; }
    if (s_deckUpLen + olen > s_deckUpWant) { Serial.printf("\n@deckdata err %s %d size\n", ks, seq); return true; }
    if (s_deckUpFile.write(dec, olen) != olen) { s_deckUpFile.seek(s_deckUpLen); Serial.printf("\n@deckdata err %s %d write\n", ks, seq); return true; }
    s_deckUpCrc = esp_rom_crc32_le(s_deckUpCrc, dec, olen); s_deckUpLen += olen; s_deckUpSeq = seq;
    Serial.printf("\n@deckdata ok %s %d\n", ks, seq);
  } else if (!strcmp(buf, "@deckend")) {
    if (!s_deckUp) { Serial.print("\n@deckend fail state\n"); return true; }
    if (s_deckUpFile) s_deckUpFile.close();
    if (!s_deckUpCfg || !LittleFS.exists("/deck/cfg.json")) { deckAbortUp(); lock(); deckStateText(); unlock(); Serial.print("\n@deckend fail nocfg\n"); return true; }
    s_deckUp = false; s_deckUpItem = -1;
    lock();
    deckLoad();                                          // PSRAM 에 올리고
    deckRedraw();                                        // 화면은 여기서 한 번만
    if (s_deckState) {
      lv_label_set_text(s_deckState, s_deckCustom ? LV_SYMBOL_OK "  새 단축키를 받았습니다" : LV_SYMBOL_WARNING "  받은 설정이 맞지 않아 기본 아이콘을 씁니다");
      lv_obj_set_style_text_color(s_deckState, lv_color_hex(s_deckCustom ? C_OK : NOW_TAG), 0);
    }
    unlock();
    s_deckSentAt = ms ? ms : 1;                          // 60초 뒤 평소 글로
    Serial.printf("deck upload end %s\n", s_deckHash);
    if (s_deckCustom) Serial.printf("\n@deckend ok %s\n", s_deckHash); else Serial.print("\n@deckend fail cfg\n");
  } else if (!strcmp(buf, "@deckabort")) {
    const bool was = s_deckUp;
    deckAbortUp();
    if (was) { lock(); deckStateText(); unlock(); }
    Serial.print("\n@deckabort ok\n");
  } else if (!strcmp(buf, "@deckreset")) {
    deckReset();
    Serial.print("\n@deckreset ok\n");
  } else return false;
  return true;
}
// UART 로 들어온 줄 읽기(loop 에서). '@pc on' 이면 컴퓨터가 켜져 있다. '@deck ok 키' / '@deck fail 키' 는 도우미의 답.
// 화면 찍기(tools/screenshot.py): '@shot' 을 받으면 지금 화면(프레임 버퍼, RGB565)을 [개수 1~255][값 작은끝 2바이트] 묶음으로 보내고
// 개수 0 으로 끝낸다. 보내는 동안(약 10~30초) 화면 그리기를 잠가 찍는 사이 바뀌지 않게 한다. '@view 번호' 는 화면을 바꾼다.
static void screenShot() {
  esp_lcd_panel_handle_t p = panelHandle(); void *fb = nullptr;
  if (!p || esp_lcd_rgb_panel_get_frame_buffer(p, 1, &fb) != ESP_OK || !fb) { Serial.println("@shot fail"); return; }
  lock();
  const uint16_t *px = (const uint16_t *)fb; const uint32_t n = (uint32_t)s_W * s_H;
  Serial.printf("\n@shot %d %d\n", s_W, s_H); Serial.flush();
  static uint8_t out[3 * 256]; int o = 0;
  for (uint32_t i = 0; i < n; ) {
    const uint16_t v = px[i]; uint32_t j = i + 1;
    while (j < n && px[j] == v && j - i < 255) j++;
    out[o++] = (uint8_t)(j - i); out[o++] = v & 0xff; out[o++] = v >> 8;
    if (o >= (int)sizeof out - 3) { Serial.write(out, o); o = 0; }
    i = j;
  }
  out[o++] = 0; Serial.write(out, o); Serial.flush();
  unlock();
  Serial.println("\n@shot end");
}
static void showView(View v);
static bool pcfLine(char *buf, uint32_t ms);
static void segStyle(lv_obj_t *b, bool on);
static lv_obj_t *s_pcBtn;   // 설정의 [컴퓨터만] 단추
// Claude 사용량(사용자 지시 2026-10-31): 탭덱이 1분마다 '@use 5시간% 요일 초기화 주간% 요일 초기화' 또는 '@use err 번호' 를 보낸다.
// 위쪽 막대 왼쪽(로고·제목 자리)에 두 줄로 보인다. 설정 [사용량] 으로 끄면 원래 제목. 20분 넘게 소식이 없으면 숨긴다(탭덱이 꺼짐)
static uint32_t useCol(int p) { return p >= 90 ? C_ROSE : p >= 70 ? C_WARN : C_EMERALD; }
static uint32_t useBarCol(int p) { return p >= 90 ? C_ROSE : 0xD97757; }   // 막대는 Claude 주황(사용자 지시 2026-11-01), 90% 넘으면 빨강
static void useRowMake(UseRow &u, lv_obj_t *parent, const lv_font_t *f) {
  const int lh = lv_font_get_line_height(f), BH = max(6, lh * 45 / 100);
  u.row = box(parent, D_PANEL, 0, 0); lv_obj_set_style_bg_opa(u.row, LV_OPA_TRANSP, 0);
  lv_obj_set_height(u.row, lh); lv_obj_clear_flag(u.row, LV_OBJ_FLAG_CLICKABLE);
  u.name = label(u.row, f, D_TEXT, ""); lv_label_set_long_mode(u.name, LV_LABEL_LONG_DOT);
  u.track = box(u.row, D_LINE, 0, BH / 2);
  u.fill = box(u.track, 0xD97757, 0, BH / 2); lv_obj_set_size(u.fill, 0, BH); lv_obj_add_flag(u.fill, LV_OBJ_FLAG_HIDDEN);
  u.pct = label(u.row, f, D_SUB, ""); lv_obj_set_style_text_align(u.pct, LV_TEXT_ALIGN_RIGHT, 0);
  u.rst = label(u.row, f, D_MUTED, ""); lv_label_set_long_mode(u.rst, LV_LABEL_LONG_DOT);
}
// 한 줄 값 넣기. pct < 0 이면 막대·퍼센트 없이 글만. 바뀐 것만 다시 그린다
static void useRowSet(UseRow &u, const char *name, int pct, const char *rst, uint32_t rstCol) {
  if (!u.row) return;
  setTextIf(u.name, name); setTextIf(u.rst, rst); setTextColIf(u.rst, rstCol);
  char b[8] = ""; if (pct >= 0) snprintf(b, sizeof b, "%d%%", pct);
  setTextIf(u.pct, b);
  const int BH = lv_obj_get_style_height(u.fill, 0);
  const int fw = pct <= 0 ? 0 : max(BH, u.tw * pct / 100);   // 1% 도 점 하나는 보이게
  if (fw != u.fw) { u.fw = fw; if (fw) lv_obj_set_width(u.fill, fw); showIf(u.fill, fw > 0); }
  const uint32_t c = useBarCol(pct);
  if (c != u.col) { u.col = c; lv_obj_set_style_bg_color(u.fill, lv_color_hex(c), 0); }
}
static void useRowsSet(UseRow *u) {   // 두 줄(현재 세션 · 주간)에 지금 값
  static const char *WD[7] = {"일", "월", "화", "수", "목", "금", "토"};
  char r[40];
  if (s_useErr) {
    useRowSet(u[0], "Claude", -1, s_useErr == 1 ? "로그인 없음" : s_useErr == 2 ? "로그인 다시 필요" : "받기 실패", C_WARN);
    showIf(u[1].row, false);
    return;
  }
  showIf(u[1].row, true);
  if (s_useR5[0]) snprintf(r, sizeof r, "%s 초기화", s_useR5); else r[0] = 0;
  useRowSet(u[0], "현재 세션", s_useP5, r, D_MUTED);
  const char *nm = s_useName[0] ? s_useName : "주간";
  if (s_useP7 < 0) { useRowSet(u[1], nm, -1, "주간 한도 없음", D_MUTED); return; }
  if (s_useR7[0] && s_useW7 >= 0 && s_useW7 < 7) snprintf(r, sizeof r, "(%s) %s 초기화", WD[s_useW7], s_useR7); else r[0] = 0;
  useRowSet(u[1], nm, s_useP7, r, D_MUTED);
}
static void renderUse() {
  if (!s_useL5 || !s_useL7 || !s_title) return;
  const bool show = useShown();
  static bool clkWas = false;
  if (s_useClk && show != clkWas) { clkWas = show; layoutClock(); }   // 시계 화면: 줄이 생기거나 없어지면 카드 자리를 다시 잡는다
  // 보이기·색은 바뀔 때만(showIf·setTextColIf). 같은 값으로 다시 부르기만 해도 LVGL 이 다시 그린다 → 1분마다 막대가 다시 그려졌다
  // 위쪽 막대 두 줄은 막대가 없는 화면에서만(시계·단축키 화면은 아래에 막대가 있다, 사용자 지시 2026-11-01)
  const bool top = show && !(s_view == V_DECK || (s_view == V_CLOCK && !s_principal));
  showIf(s_title, !top); showIf(s_logo, !top); showIf(s_useL5, top); showIf(s_useL7, top); showIf(s_useDeck, show);
  if (!show) return;
  static const char *WD[7] = {"일", "월", "화", "수", "목", "금", "토"};
  char a[64], b[64];
  if (s_useErr) {
    snprintf(a, sizeof a, "Claude 사용량");
    snprintf(b, sizeof b, "%s", s_useErr == 1 ? "로그인 없음" : s_useErr == 2 ? "로그인 다시 필요" : "받기 실패");
    setTextColIf(s_useL5, D_MUTED); setTextColIf(s_useL7, C_WARN);
  } else {
    if (s_useR5[0]) snprintf(a, sizeof a, "5시간 %d%% · %s 리셋", s_useP5, s_useR5); else snprintf(a, sizeof a, "5시간 %d%%", s_useP5);
    if (s_useP7 < 0) snprintf(b, sizeof b, "주간 한도 없음");
    else if (s_useR7[0] && s_useW7 >= 0 && s_useW7 < 7) snprintf(b, sizeof b, "주간 %d%% · %s %s 리셋", s_useP7, WD[s_useW7], s_useR7); else snprintf(b, sizeof b, "주간 %d%%", s_useP7);
    setTextColIf(s_useL5, useCol(s_useP5)); setTextColIf(s_useL7, s_useP7 < 0 ? D_MUTED : useCol(s_useP7));
  }
  if (strcmp(lv_label_get_text(s_useL5), a)) lv_label_set_text(s_useL5, a);
  if (strcmp(lv_label_get_text(s_useL7), b)) lv_label_set_text(s_useL7, b);
  useRowsSet(s_ucRow); useRowsSet(s_udRow);   // 시계·단축키 화면 막대(틀 보이기는 layoutClock · 위 showIf)
}
// '@use 12 6 15:00 35 1 09:00' → 숫자로. 시각 자리 '-' 는 모름
static void agLine(const char *p);   // 사무실 탭(아래 showView 앞)
static void useLine(const char *p) {
  if (!strncmp(p, "err ", 4)) { s_useErr = atoi(p + 4); if (s_useErr < 1 || s_useErr > 3) s_useErr = 3; }
  else {
    char r5[8] = "", r7[8] = "", w7[4] = "", nm[13] = ""; int p5 = 0, p7 = 0;
    if (sscanf(p, "%d %*s %7s %d %3s %7s %12s", &p5, r5, &p7, w7, r7, nm) < 5) return;   // 5시간 요일은 건너뛴다(화면에 안 씀). 끝 이름은 새 탭덱만 보낸다
    snprintf(s_useName, sizeof s_useName, "%s", nm);
    s_useErr = 0; s_useP5 = constrain(p5, 0, 100); s_useP7 = p7 < 0 ? -1 : constrain(p7, 0, 100);   // -1 = 주간 한도 없는 요금제
    s_useW7 = w7[0] == '-' ? -1 : atoi(w7);
    snprintf(s_useR5, sizeof s_useR5, "%s", r5[0] == '-' ? "" : r5); snprintf(s_useR7, sizeof s_useR7, "%s", r7[0] == '-' ? "" : r7);
  }
  s_useAt = millis() ? millis() : 1;
  lock(); renderUse(); unlock();
}
static void petLine(const char *p);   // 사무실 펫(아래)
static void deckPoll(uint32_t ms) {
  static char buf[320]; static uint16_t n = 0;   // 가장 긴 줄 '@deckdata 15 80 <base64 256자>' 273자
  while (Serial.available()) {
    const char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      buf[n] = 0;
      if (!strcmp(buf, "@pc on")) {   // 도우미가 알림판 포트를 가려내는 답. 첫 줄은 옛 도우미용, 둘째 줄에 꾸민 설정 해시
        s_pcLast = ms ? ms : 1; s_usbSeen = true;
        Serial.printf("@board ok\n@board ok deck=%s\n", s_deckHash);
      }
      else if (deckUpLine(buf, ms)) {}
      else if (pcfLine(buf, ms)) {}
      else if (!strncmp(buf, "@time ", 6)) {   // 컴퓨터의 탭덱이 알려 주는 지금 시각(초). '컴퓨터만' 일 때만 따른다
        const long long t = atoll(buf + 6);
        if (s_pcOnly && t > 1700000000LL) {
          const bool first = !timeValid();
          struct timeval tv = {(time_t)t, 0}; settimeofday(&tv, nullptr);
          setenv("TZ", "KST-9", 1); tzset();
          if (first) { lock(); refreshWifiLabel(); unlock(); Serial.println("sync: time from pc"); }
        }
      }
      else if (!strncmp(buf, "@use ", 5)) useLine(buf + 5);   // 탭덱이 알려 주는 Claude 사용량
      else if (!strcmp(buf, "@ag") || !strncmp(buf, "@ag ", 4)) agLine(buf + 3);   // 탭덱이 알려 주는 Claude 작업(사무실 탭)
      else if (!strncmp(buf, "@pet ", 5)) petLine(buf + 5);                          // 탭덱이 키우는 Claude 펫(사무실 쉼터)
      else if (!strncmp(buf, "@pconly ", 8)) {   // 시험용: '컴퓨터만' 을 컴퓨터에서 켜고 끈다(설정 단추와 같다)
        const bool on = atoi(buf + 8) != 0;
        if (on != s_pcOnly) { lock(); s_pcOnly = on; s_prefs.putBool("pconly", on); segStyle(s_pcBtn, on); if (!on && s_prefs.isKey("ssid")) s_syncReq = true; else if (on) s_syncReq = true; refreshWifiLabel(); renderToday(); unlock(); }
        Serial.printf("@pconly ok %d\n", on ? 1 : 0);
      }
      else if (!strcmp(buf, "@shot")) screenShot();
      else if (!strncmp(buf, "@theme ", 7)) {   // 화면 찍기 자동화용: 테마를 바꾸고 다시 켠다
        const int t = atoi(buf + 7);
        if (t >= 0 && t < THEME_N) { s_prefs.putInt("theme", t); s_themeIdx = t; Serial.printf("@theme ok %d", t); Serial.println(); s_themeRestartAt = ms ? ms : 1; }
      }
      else if (!strncmp(buf, "@view ", 6)) { const int v = atoi(buf + 6); if (v >= 0 && v <= 5) { lock(); showView((View)v); lv_disp_trig_activity(NULL); unlock(); } }
      else if (!strcmp(buf, "@deckhelp")) { lock(); showDeckHelp(); lv_disp_trig_activity(NULL); unlock(); }   // 도우미 안내 창 미리 보기(화면 찍기 시험용)
      else if (!strcmp(buf, "@pcui ok") && s_deckState) {   // [꾸미기] 탭덱이 창을 열었다
        s_deckUiAt = 0;
        lock(); lv_label_set_text(s_deckState, LV_SYMBOL_OK "  컴퓨터에 꾸미기 창을 열었습니다 · 컴퓨터 화면을 보세요");
        lv_obj_set_style_text_color(s_deckState, lv_color_hex(C_OK), 0); unlock();
        s_deckSentAt = ms ? ms : 1;
      }
      else if (!strncmp(buf, "@deck ok ", 9) && s_deckState) {
        s_deckWaitKey = -1;
        lock(); lv_label_set_text_fmt(s_deckState, LV_SYMBOL_OK "  '%s' 열었습니다", deckLabel(buf + 9));
        lv_obj_set_style_text_color(s_deckState, lv_color_hex(C_OK), 0); unlock();
        s_deckSentAt = ms ? ms : 1;
      } else if (!strncmp(buf, "@deck fail ", 11) && s_deckState) {
        s_deckWaitKey = -1;
        lock(); lv_label_set_text_fmt(s_deckState, LV_SYMBOL_WARNING "  '%s' 열지 못했습니다 · 컴퓨터의 탭덱 설정을 확인하세요", deckLabel(buf + 11));
        lv_obj_set_style_text_color(s_deckState, lv_color_hex(NOW_TAG), 0); unlock();
        s_deckSentAt = ms ? ms : 1;
      }
      n = 0;
    } else if (n < sizeof buf - 1) buf[n++] = c;
    else n = 0;
  }
  if (s_deckUiAt && ms - s_deckUiAt > 6000) {            // [꾸미기] 답이 없다 → 예전 탭덱
    s_deckUiAt = 0;
    lock(); if (s_deckState) { lv_label_set_text(s_deckState, "컴퓨터의 탭덱이 예전 판입니다 · 컴퓨터 화면 오른쪽 아래 탭덱 아이콘을 두 번 누르세요");
      lv_obj_set_style_text_color(s_deckState, lv_color_hex(NOW_TAG), 0); } unlock();
    s_deckSentAt = ms ? ms : 1;
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
  s_usbOn = s_pcLast && ms - s_pcLast < 15000;
  if (s_usbOn && s_deckHelp) { lock(); closeDeckHelp(); unlock(); }   // 도우미를 깔아 이어졌으면 안내 창을 닫는다
}
static void buildDeck(lv_obj_t *scr, int top) {
  const bool small = s_W <= 800;
  const int M = small ? 10 : 16, VH = s_H - top;
  s_viewDeck = box(scr, D_BG, 0, 0);
  lv_obj_set_size(s_viewDeck, s_W, VH); lv_obj_set_pos(s_viewDeck, 0, top);
  lv_obj_add_flag(s_viewDeck, LV_OBJ_FLAG_HIDDEN);
  lv_obj_t *panel = box(s_viewDeck, D_PANEL, D_LINE, 16);
  const int PW = s_W - 2 * M, PH = VH - 2 * M;
  lv_obj_set_size(panel, PW, PH); lv_obj_set_pos(panel, M, M);
  lv_obj_clear_flag(panel, LV_OBJ_FLAG_CLICKABLE);
  // 8칸 × 2줄. 칸 하나 = 아이콘(72) + 이름. 칸은 판보다 밝은 단추 모양(누를 수 있게 보이도록)
  const int COLS = 8, CW = (PW - 2 * M) / COLS, CH = small ? 118 : 160, GY = small ? 18 : 14;
  const int gridH = 2 * CH + GY, y0 = small ? (PH - 40 - gridH) / 2 : M + 4;   // 1024: 위에서 20(디자인 검토 2026-11-03)
  const int BI = small ? M - 10 : 12;                     // 아래 단추와 판 끝 사이
  for (int i = 0; i < 16; i++) {
    const int c = i % COLS, r = i / COLS;
    lv_obj_t *cell = box(panel, D_ROW, D_LINE, 14);
    lv_obj_set_style_border_width(cell, 1, 0);
    lv_obj_set_size(cell, CW - 6, CH); lv_obj_set_pos(cell, M + c * CW + 3, y0 + r * (CH + GY));
    lv_obj_set_style_bg_color(cell, lv_color_hex(D_LINE), LV_STATE_PRESSED);   // 누르는 동안 밝게
    lv_obj_add_flag(cell, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(cell, onDeck, LV_EVENT_CLICKED, (void *)(intptr_t)i);
    lv_obj_t *img = s_deckImg[i] = lv_img_create(cell);
    lv_img_set_src(img, deckIcon(i));
    lv_obj_align(img, LV_ALIGN_TOP_MID, 0, small ? 10 : 18);
    lv_obj_clear_flag(img, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_t *l = s_deckLbl[i] = label(cell, small ? &kr14 : &kr16, D_SUB, deckName(i));
    lv_obj_set_width(l, CW - 14); lv_label_set_long_mode(l, LV_LABEL_LONG_DOT);   // 긴 이름은 … 로
    lv_obj_set_style_text_align(l, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_align(l, LV_ALIGN_BOTTOM_MID, 0, small ? -8 : -14);
  }
  {   // Claude 사용량 막대 두 줄: 단추 칸 아래 ~ 아래 단추 줄 위 빈자리 가운데(보이기는 renderUse)
    const lv_font_t *f = small ? &kr14 : &kr16;
    const int lh = lv_font_get_line_height(f), UH = 2 * lh + 6, UW = (PW - 2 * M) * 2 / 3;
    const int gridB = y0 + gridH, btnT = PH - BI - 38;
    s_useDeck = box(panel, D_PANEL, 0, 0);
    lv_obj_set_style_bg_opa(s_useDeck, LV_OPA_TRANSP, 0); lv_obj_clear_flag(s_useDeck, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_set_size(s_useDeck, UW, UH); lv_obj_set_pos(s_useDeck, (PW - UW) / 2, gridB + max(0, (btnT - gridB - UH) / 2));
    useRowMake(s_udRow[0], s_useDeck, f); useRowMake(s_udRow[1], s_useDeck, f);
    useRowPlace(s_udRow[0], UW, 0); useRowPlace(s_udRow[1], UW, lh + 6);
    lv_obj_add_flag(s_useDeck, LV_OBJ_FLAG_HIDDEN);
  }
  const int RB = 56;                                     // 오른쪽 아래 [새로 고침] 단추 폭(가운데 맞춘 상태 글과 겹치지 않게 양쪽을 비운다)
  s_deckState = label(panel, small ? &kr14 : &kr16, D_MUTED, "");
  lv_obj_set_width(s_deckState, PW - 2 * M - 2 * (RB + 8)); lv_label_set_long_mode(s_deckState, LV_LABEL_LONG_DOT);
  lv_obj_set_height(s_deckState, lv_font_get_line_height(small ? &kr14 : &kr16));   // 한 줄로(넘치면 … 로). 두 줄이 되면 단추 줄 밖으로 밀린다
  lv_obj_set_style_text_align(s_deckState, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_align(s_deckState, LV_ALIGN_BOTTOM_MID, 0, -M);
  lv_obj_t *rb = button(panel, LV_SYMBOL_REFRESH, RB, 38, D_ROW, D_TEXT);
  lv_obj_align(rb, LV_ALIGN_BOTTOM_RIGHT, -M, -BI);
  lv_obj_add_event_cb(rb, onDeckRefresh, LV_EVENT_CLICKED, nullptr);
  // 왼쪽 아래 [꾸미기]: 컴퓨터에 탭덱의 꾸미기 창을 띄운다(늘 보인다)
  s_deckEditW = small ? 104 : 124;
  lv_obj_t *eb = button(panel, LV_SYMBOL_SETTINGS " 꾸미기", s_deckEditW, 38, D_ROW, D_TEXT);
  lv_obj_set_style_text_font(lv_obj_get_child(eb, 0), small ? &kr14 : &kr16, 0);
  lv_obj_align(eb, LV_ALIGN_BOTTOM_LEFT, M, -BI);
  lv_obj_add_event_cb(eb, onDeckEdit, LV_EVENT_CLICKED, nullptr);
  // [새로 고침] 왼쪽 옆 [기본 아이콘]: 컴퓨터에서 꾸민 설정이 있을 때만 보인다. 3초 안에 두 번 눌러야 되돌린다.
  // (설계는 설정 화면이지만 설정 화면에 빈자리가 없어 단축키 화면에 둔다)
  s_deckPW = PW; s_deckM = M; s_deckResetArmed = 0;
  s_deckResetBtn = button(panel, "기본 아이콘", small ? 112 : 136, 38, D_ROW, D_SUB);
  lv_obj_set_style_text_font(lv_obj_get_child(s_deckResetBtn, 0), &kr14, 0);
  lv_obj_align(s_deckResetBtn, LV_ALIGN_BOTTOM_RIGHT, -(M + RB + 8), -BI);
  lv_obj_add_event_cb(s_deckResetBtn, [](lv_event_t *e) {
    lv_obj_t *b = lv_event_get_current_target(e);
    if (!s_deckResetArmed || millis() - s_deckResetArmed > 3000) { s_deckResetArmed = millis(); lv_label_set_text(lv_obj_get_child(b, 0), "한 번 더"); return; }
    s_deckResetArmed = 0; lv_label_set_text(lv_obj_get_child(b, 0), "기본 아이콘");
    s_deckResetReq = true;                               // 파일 지우기는 loop 에서(그리기 잠금 안이라)
  }, LV_EVENT_CLICKED, nullptr);
  deckResetBtnVis();
  deckStateText();
  deckIconsDim();
}
static void onSchedRow(lv_event_t *e);
static void onTeachOpen(lv_event_t *e);
static void renderSchedList();
static JsonDocument s_sched(&s_alloc);              // {"items":[[날짜, 끝날짜, 시간, 제목, 장소, 부서, 담당, 내용], …], "acad":[[날짜, 이름, 종류], …]}
static lv_obj_t *s_viewPrin = nullptr, *s_pClock, *s_pDate, *s_pNowA, *s_pNowB, *s_pNowC, *s_pNowN, *s_pRing, *s_pWx, *s_pWx2, *s_pMeal, *s_pNews;
static const int P_ROWS = 8;   // 학교 일정 줄 수(오늘부터 다가오는 날까지)
static lv_obj_t *s_pRow[P_ROWS], *s_pRowT[P_ROWS], *s_pRowA[P_ROWS], *s_pRowB[P_ROWS], *s_pAcad[3], *s_pAcadD[3], *s_pTitle;

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
// 학교 일정 사이트(구글 앱스 스크립트) 화면 글에서 일정을 꺼내 /sched.json 에 둔다(와이파이 받기·컴퓨터 받기가 함께 쓴다)
static bool parseSchedule(String &raw) {
  bool ok = false;
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
  return ok;
}

static bool downloadSchedule(uint32_t budget = 60000) {
  if (!WiFi.isConnected() || !cfgSet(SCHEDULE_URL) || !timeValid()) return false;   // 오늘 날짜를 모르면 거를 수 없다
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
    httpLimits(http, budget - min(used, budget));
    code = http.GET();
    if (code != 301 && code != 302 && code != 303 && code != 307 && code != 308) break;
    const String next = http.header("Location");
    http.end();
    if (!next.length()) break;
    url = next;
  }
  bool ok = false;
  if (code == 200) {
    String raw = http.getString();                            // 약 150KB(PSRAM)
    ok = parseSchedule(raw);
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
  if (s_ttLoaded) {   // 오늘 날짜 칸의 종류를 직접 본다(findDay 는 휴일에 다음 수업일을 돌려준다)
    const String td = todayIso();
    for (JsonObject w : s_tt["weeks"].as<JsonArray>())
      for (JsonObject d : w["days"].as<JsonArray>())
        if (td == (const char *)(d["date"] | "")) { if (!strcmp(d["type"] | "", "holiday")) { if (name) *name = "휴일"; return true; } return false; }
  }
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
// 1분마다 다시 부르므로 값이 바뀐 것만 다시 쓴다(setTextIf·set*If)
static void renderPrincipal() {
  if (!s_viewPrin) return;
  const bool tv = timeValid();
  const int nm = tv ? nowMin() : -1;
  // 시계·날짜는 시계 화면과 같은 글을 쓴다
  const bool clkChg = setTextIf(s_pClock, lv_label_get_text(s_big));
  setTextIf(s_pDate, lv_label_get_text(s_bigDate));
  if (s_pAmPm) {   // 12시간제면 '오후'를 숫자 왼쪽 아래에(시계 화면과 같게)
    const char *ap = lv_label_get_text(s_bigAmPm);
    if (*ap && !lv_obj_has_flag(s_bigAmPm, LV_OBJ_FLAG_HIDDEN)) {
      const bool was = lv_obj_has_flag(s_pAmPm, LV_OBJ_FLAG_HIDDEN);
      const bool chg = setTextIf(s_pAmPm, ap); showIf(s_pAmPm, true);
      if (chg || clkChg || was) { lv_obj_update_layout(s_pClock); lv_obj_align_to(s_pAmPm, s_pClock, LV_ALIGN_OUT_LEFT_BOTTOM, -8, -14); }
    } else showIf(s_pAmPm, false);
  }
  // 학교 지금
  int nowP = -1, nextP = -1;
  for (int p = 0; p < 7; p++) { const int st = toMin(PERIOD_START[p]); if (nm >= st && nm < st + 50) nowP = p; if (nextP < 0 && st > nm) nextP = p; }
  const bool lunch = nm >= toMin("12:30") && nm < toMin("13:30");
  const String &offName = s_offName; const bool weekend = s_offToday;   // 주말·휴업일(분이 바뀔 때 계산해 둔 값)
  const bool exam = !weekend && examTodayAcad();               // 시험 날: 링·'분 남음' 대신 '시험 기간'
  int ring = 0;   // 0~100
  if (!tv) { setTextIf(s_pNowA, "시각을 맞추는 중"); setTextIf(s_pNowB, ""); setTextIf(s_pNowN, "-"); }
  else if (weekend) { setTextIf(s_pNowA, offName == "주말" ? "주말" : "휴업일"); setTextIf(s_pNowB, offName == "주말" ? "수업 없음" : offName.c_str()); setTextIf(s_pNowN, "-"); }
  else if (exam && (nowP >= 0 || lunch || nextP >= 0)) {
    setTextIf(s_pNowA, "시험 기간");
    if (nowP >= 0) setTextFmtIf(s_pNowB, "%d교시 진행 중", nowP + 1); else setTextFmtIf(s_pNowB, "%d교시 %s", nextP >= 0 ? nextP + 1 : 5, nextP >= 0 ? PERIOD_START[nextP] : "13:30");
    setTextFmtIf(s_pNowN, "%d", nowP >= 0 ? nowP + 1 : nextP >= 0 ? nextP + 1 : 5);
  }
  else if (nowP >= 0) {
    const int end = toMin(PERIOD_START[nowP]) + 50; ring = (end - nm) * 100 / 50;
    setTextFmtIf(s_pNowA, "%d교시 수업 중", nowP + 1);
    if (nextP >= 0) setTextFmtIf(s_pNowB, "%d분 남음 · %d교시 %s", end - nm, nextP + 1, PERIOD_START[nextP]);
    else setTextFmtIf(s_pNowB, "%d분 남음 · 마지막 교시", end - nm);
    setTextFmtIf(s_pNowN, "%d", nowP + 1);
  } else if (lunch) { ring = (toMin("13:30") - nm) * 100 / 60; setTextIf(s_pNowA, "점심시간"); setTextFmtIf(s_pNowB, "%d분 남음 · 5교시 13:30", toMin("13:30") - nm); setTextIf(s_pNowN, "점"); }
  else if (nextP >= 0) { ring = 100; setTextIf(s_pNowA, nm < toMin(PERIOD_START[0]) ? "수업 전" : "쉬는 시간"); setTextFmtIf(s_pNowB, "%d교시 %s 시작", nextP + 1, PERIOD_START[nextP]); setTextFmtIf(s_pNowN, "%d", nextP + 1); }
  else { setTextIf(s_pNowA, "수업 끝"); setTextIf(s_pNowB, "방과 후"); setTextIf(s_pNowN, "-"); }
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
    if (total && di >= 0 && nowP >= 0 && !weekend) setTextFmtIf(s_pNowC, "수업 중 %d명 · 수업 없음 %d명  " LV_SYMBOL_RIGHT, inClass, total - inClass);
    else if (total && di >= 0 && bp >= 0) setTextFmtIf(s_pNowC, "다음 %d교시 수업 %d명  " LV_SYMBOL_RIGHT, bp + 1, inClass);
    else if (total) setTextFmtIf(s_pNowC, "선생님 %d명 · 눌러서 명단  " LV_SYMBOL_RIGHT, total);
    else setTextIf(s_pNowC, "");
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
  if (!isnan(tnow)) setTextFmtIf(s_pWx, "%d° %s", (int)lroundf(tnow), wxName(s_wxNowCode >= 0 ? s_wxNowCode : s_wx[0].code));
  else setTextIf(s_pWx, HAS_WX ? "날씨 받는 중" : "날씨 설정 필요");
  if (g >= 0 && !isnan(s_wx[0].tmax)) setTextFmtIf(s_pWx2, "최고 %d° 최저 %d° · #%s 미세먼지 %s#", (int)lroundf(s_wx[0].tmax), (int)lroundf(s_wx[0].tmin), GC[g], GN[g]);
  else setTextIf(s_pWx2, "");
  setTextIf(s_pMeal, s_mLunch.length() ? s_mLunch.c_str() : (HAS_MEAL ? "오늘은 급식이 없습니다" : "급식 설정 필요"));
  // 학교 일정(일정 사이트): 오늘 진행 중인 것부터 다가오는 날 차례로 8줄(2026-10-18: 교장실 상태 칸을 빼고 일정 위주로)
  static const char *DW[7] = {"일", "월", "화", "수", "목", "금", "토"};
  auto dowOf = [](const String &iso) { struct tm t = {}; t.tm_year = iso.substring(0, 4).toInt() - 1900; t.tm_mon = iso.substring(5, 7).toInt() - 1; t.tm_mday = iso.substring(8, 10).toInt(); t.tm_hour = 12; mktime(&t); return t.tm_wday; };
  auto mdOf = [&](const String &iso) { return String(iso.substring(5, 7).toInt()) + "/" + iso.substring(8, 10).toInt() + " " + DW[dowOf(iso)]; };
  {
    const String td = todayIso();
    // 정렬은 정수 키(날짜*10000+분)로 한다(String 을 맞바꾸면 내부 RAM 이 조각난다). 큰 배열은 static(스택 16KB)
    struct C { int idx; long long key; int m, e; bool today; };
    static C cand[64]; int c = 0;
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
    int nextI = -1;
    for (int i = 0; i < n; i++) if (cand[i].today && cand[i].m > nm && cand[i].m < 24 * 60 && nextI < 0) nextI = i;
    JsonArray its = s_sched["items"].as<JsonArray>();
    for (int i = 0; i < P_ROWS; i++) {
      if (i >= n) { showIf(s_pRow[i], false); continue; }
      showIf(s_pRow[i], true);
      const C &q = cand[i];
      JsonArray r = its[q.idx];
      const char *sd = r[0] | "", *ed = r[1] | "";
      const bool cur = q.today && q.m >= 0 && q.e > 0 && q.m <= nm && nm < q.e;
      const bool past = q.today && q.e > 0 && q.e <= nm;
      const bool nxt = i == nextI && !cur;
      setTextIf(s_pRowT[i], q.today ? "오늘" : mdOf(String(sd)).c_str());
      lv_obj_set_user_data(s_pRow[i], (void *)(intptr_t)q.idx);   // 누르면 자세히
      const bool two = q.today && !big();   // 오늘 일정은 두 줄까지(800). 1024 는 큰 글자(kr20) 한 줄 — 두 줄은 줄 높이에 들어가지 않는다
      const lv_label_long_mode_t lm = two ? LV_LABEL_LONG_WRAP : LV_LABEL_LONG_DOT;
      if (lv_label_get_long_mode(s_pRowA[i]) != lm) lv_label_set_long_mode(s_pRowA[i], lm);
      const lv_coord_t h = two ? 2 * lv_font_get_line_height(lv_obj_get_style_text_font(s_pRowA[i], 0)) + 2 : LV_SIZE_CONTENT;
      if (lv_obj_get_style_height(s_pRowA[i], 0) != h) lv_obj_set_height(s_pRowA[i], h);
      setTextIf(s_pRowA[i], r[3] | "");
      String sub = (const char *)(r[2] | "");
      const char *pl = r[4] | "";
      if (*pl) { if (sub.length()) sub += " · "; sub += pl; }
      if (q.today && strcmp(ed, td.c_str()) > 0) {               // 여러 날 일정: 언제까지
        if (sub.length()) sub += " · ";
        sub += "~" + String(String(ed).substring(5, 7).toInt()) + "/" + String(ed).substring(8, 10).toInt();
      }
      if (!sub.length()) sub = (const char *)(r[5] | "");          // 시간·장소가 없으면 부서(사이트의 [부서] 표시)
      setTextIf(s_pRowB[i], sub.c_str());
      {   // 시간·장소가 없으면 제목이 줄 끝까지 쓴다(오른쪽 끝 '>' 자리 18 은 비운다)
        lv_obj_t *tb = lv_obj_get_parent(s_pRowT[i]);
        const int full = lv_obj_get_width(s_pRow[i]) - lv_obj_get_width(tb) - 30 - 18;
        setWidthIf(s_pRowA[i], sub.length() ? full - lv_obj_get_width(s_pRowB[i]) - 6 : full);
      }
      setBgIf(s_pRow[i], cur ? NOW_ROW : D_ROW);
      setBorderIf(s_pRow[i], cur ? NOW_ROW : nxt ? NEXT_BD : D_LINE);
      setBorderWIf(s_pRow[i], nxt ? 2 : 1);
      setBgIf(lv_obj_get_parent(s_pRowT[i]), q.today ? NOW_TAG : D_LINE);
      setTextColIf(s_pRowT[i], q.today ? NOW_TX : D_SUB);
      setTextColIf(s_pRowA[i], cur ? C_TEXT : past ? D_MUTED : D_TEXT);
      setTextColIf(s_pRowB[i], cur ? C_MUTED : D_MUTED);
    }
    if (!n) {
      showIf(s_pRow[0], true);
      setTextIf(s_pRowT[0], "-");
      setTextIf(s_pRowA[0], cfgSet(SCHEDULE_URL) ? "다가오는 학교 일정이 없습니다" : "학교 일정 주소가 없습니다 · 관리자 확인");
      setTextIf(s_pRowB[0], "");
    }
    // 학사 일정 D-day(시험·행사·휴일, 오늘부터 3개). 'D-3'은 오른쪽에 따로 크게(이름이 길어도 잘리지 않게)
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
      const String line = String(nmA) + "  ·  " + when;
      setTextIf(s_pAcad[k], line.c_str());
      setTextColIf(s_pAcad[k], D_SUB);
      if (left == 0) setTextIf(s_pAcadD[k], "오늘"); else setTextFmtIf(s_pAcadD[k], "D-%ld", left);
      setTextColIf(s_pAcadD[k], left == 0 ? NOW_TAG : left <= 3 ? D_TEXT : D_SUB);
      showIf(s_pAcad[k], true); showIf(s_pAcadD[k], true);
      k++;
    }
    for (; k < 3; k++) { showIf(s_pAcad[k], false); showIf(s_pAcadD[k], false); }
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
    if (g < 0 && isnan(hi)) setTextFmtIf(s_pNews, "#%s 야외 활동: 날씨를 받는 중#", D_MUTED_S);
    else setTextFmtIf(s_pNews, "#%s ● %s#  #%s %s#", LCx[level], VD[level], D_MUTED_S, why.length() ? why.c_str() : "바깥 활동 문제없음");
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
  s_pTitle = label(right, big() ? &kr20 : &kr16, D_TEXT, "학교 일정"); lv_label_set_recolor(s_pTitle, true); lv_obj_set_pos(s_pTitle, S(16), S(14));   // 1024: 교사 화면 제목과 같은 크기
  {   // 오른쪽 위 단추: [단축키](1024 만) [30일 일정 ›] [설정] — 제목보다 물러난 '보조 단추'(어두운 바탕·흐린 글자). 1024 는 손가락 크기
    const int BH = big() ? 46 : 34, BW0 = big() ? 96 : 0, BW1 = big() ? 140 : 124, BW2 = big() ? 80 : 70, G = big() ? 12 : 8;
    auto sub = [&](const char *t, int w) { lv_obj_t *b = button(right, t, w, BH, D_PANEL, D_MUTED); lv_obj_set_style_border_color(b, lv_color_hex(D_LINE), 0); lv_obj_set_style_border_width(b, 1, 0); return b; };
    if (BW0) {   // 800 은 자리가 좁아 두지 않는다(위쪽 탭의 [단축키]로 간다)
      lv_obj_t *b0 = sub("단축키", BW0);
      lv_obj_align(b0, LV_ALIGN_TOP_RIGHT, -S(12) - BW2 - G - BW1 - G, S(6));
      lv_obj_add_event_cb(b0, [](lv_event_t *) { showView(V_DECK); }, LV_EVENT_CLICKED, nullptr);
    }
    lv_obj_t *b1 = sub("30일 일정  " LV_SYMBOL_RIGHT, BW1);
    lv_obj_align(b1, LV_ALIGN_TOP_RIGHT, -S(12) - BW2 - G, S(6));
    lv_obj_add_event_cb(b1, [](lv_event_t *) { showView(V_WEEK); }, LV_EVENT_CLICKED, nullptr);
    lv_obj_t *b2 = sub("설정", BW2);
    lv_obj_align(b2, LV_ALIGN_TOP_RIGHT, -S(12), S(6));
    lv_obj_add_event_cb(b2, [](lv_event_t *) { showView(V_SET); }, LV_EVENT_CLICKED, nullptr);
    // 제목 폭 = 칸 폭 - 왼쪽 여백 - (단추들 + 사이 간격 + 오른쪽 여백) - 제목과 단추 사이 여유
    lv_obj_set_width(s_pTitle, RW - S(16) - (S(12) + BW2 + G + BW1 + (BW0 ? G + BW0 : 0)) - (BW0 ? 12 : 16)); lv_label_set_long_mode(s_pTitle, LV_LABEL_LONG_DOT);
  }
  const int AH = S(84);                                        // 아래 학사 일정 칸
  const int ROW_Y0 = S(40) + (big() ? 8 : 0), ROW_X = S(12), ROW_W = RW - 2 * ROW_X, RP_ = (PH - ROW_Y0 - AH - S(16)) / P_ROWS, RH_ = RP_ - S(5), TW = S(70);
  for (int i = 0; i < P_ROWS; i++) {
    s_pRow[i] = box(right, D_ROW, D_LINE, UI_SOFT ? 10 : 8);
    lv_obj_set_size(s_pRow[i], ROW_W, RH_); lv_obj_set_pos(s_pRow[i], ROW_X, ROW_Y0 + i * RP_);
    lv_obj_add_flag(s_pRow[i], LV_OBJ_FLAG_CLICKABLE); lv_obj_add_event_cb(s_pRow[i], onSchedRow, LV_EVENT_CLICKED, nullptr);
    lv_obj_set_style_bg_color(s_pRow[i], lv_color_hex(D_LINE), LV_STATE_PRESSED);   // 누를 수 있다는 표시: 눌림 색 + 오른쪽 끝 '>'
    lv_obj_t *tb = box(s_pRow[i], D_LINE, 0, UI_SOFT ? 10 : 6);
    lv_obj_set_size(tb, TW, RH_ - 8); lv_obj_align(tb, LV_ALIGN_LEFT_MID, S(5) - 1, 0);
    s_pRowT[i] = label(tb, FM(), D_SUB, ""); lv_obj_center(s_pRowT[i]);
    s_pRowA[i] = label(s_pRow[i], big() ? &kr20 : &kr16, D_TEXT, "");   // 1024: 3m 에서 읽히게 한 단계 크게(한 줄) lv_obj_set_width(s_pRowA[i], ROW_W - TW - S(20) - S(118) - 18); lv_label_set_long_mode(s_pRowA[i], LV_LABEL_LONG_DOT);
    lv_obj_align(s_pRowA[i], LV_ALIGN_LEFT_MID, TW + S(14), 0);
    s_pRowB[i] = label(s_pRow[i], FM(), D_MUTED, ""); lv_obj_set_width(s_pRowB[i], S(114) - 18); lv_label_set_long_mode(s_pRowB[i], LV_LABEL_LONG_DOT);
    lv_obj_set_style_text_align(s_pRowB[i], LV_TEXT_ALIGN_RIGHT, 0); lv_obj_align(s_pRowB[i], LV_ALIGN_RIGHT_MID, -S(10) - 18, 0);
    lv_obj_align(label(s_pRow[i], FM(), D_MUTED, LV_SYMBOL_RIGHT), LV_ALIGN_RIGHT_MID, -S(10), 0);
    lv_obj_add_flag(s_pRow[i], LV_OBJ_FLAG_HIDDEN);
  }
  lv_obj_t *ac = box(right, D_ROW, D_LINE, 14);
  lv_obj_set_size(ac, ROW_W, AH); lv_obj_set_pos(ac, ROW_X, PH - S(12) - AH); lv_obj_clear_flag(ac, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_set_pos(label(ac, FM(), D_MUTED, "학사 일정"), S(12), S(8));
  for (int i = 0; i < 3; i++) {
    const int y = S(8) + 18 + i * ((AH - S(8) - 18 - S(6)) / 3);
    s_pAcad[i] = label(ac, FM(), D_SUB, "");
    lv_obj_set_width(s_pAcad[i], ROW_W - S(24) - S(70)); lv_label_set_long_mode(s_pAcad[i], LV_LABEL_LONG_DOT);
    lv_obj_set_pos(s_pAcad[i], S(12), y);
    lv_obj_add_flag(s_pAcad[i], LV_OBJ_FLAG_HIDDEN);
    s_pAcadD[i] = label(ac, big() ? &kr20 : &kr16, D_SUB, "");    // 'D-3' 은 오른쪽에 따로 크게
    lv_obj_set_width(s_pAcadD[i], S(70)); lv_obj_set_style_text_align(s_pAcadD[i], LV_TEXT_ALIGN_RIGHT, 0);
    lv_obj_align(s_pAcadD[i], LV_ALIGN_TOP_RIGHT, -S(12), y - 2);
    lv_obj_add_flag(s_pAcadD[i], LV_OBJ_FLAG_HIDDEN);
  }
}
static void setPrincipalTitles() {   // 제목에 누구 책상인지(교장·교감)
  if (!s_pTitle) return;
  char b[128]; const bool st = staleText(b, sizeof b);
  char t[200];   // 글을 먼저 만들고 같으면 다시 쓰지 않는다(1분마다 refreshStale 이 부른다)
  if (st) snprintf(t, sizeof t, "학교 일정 · %s   #fb923c %s#", s_pickName == "@교감" ? "교감" : "교장", b);
  else snprintf(t, sizeof t, "학교 일정 · %s", s_pickName == "@교감" ? "교감" : "교장");
  setTextIf(s_pTitle, t);
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
  if (s_dScroll) lv_obj_scroll_to_y(s_dScroll, 0, LV_ANIM_OFF);   // 새 일정은 맨 위부터
  lv_obj_clear_flag(s_pDetail, LV_OBJ_FLAG_HIDDEN);
  lv_obj_move_foreground(s_pDetail);
}
static void onSchedRow(lv_event_t *e) { showSchedDetail((int)(intptr_t)lv_obj_get_user_data(lv_event_get_current_target(e))); }
static void onDetailStep(lv_event_t *e) {   // 자세히 창의 [이전 일정]·[다음 일정]
  const int d = (int)(intptr_t)lv_event_get_user_data(e);
  static int idx[64]; const int n = schedSorted(idx, 64);
  int pos = -1; for (int k = 0; k < n; k++) if (idx[k] == s_detailIdx) pos = k;
  const int to = pos + d;
  if (pos < 0 || to < 0 || to >= n) return;
  showSchedDetail(idx[to]);
}

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
    lv_obj_set_style_bg_color(s_tTab[t], lv_color_hex(on ? C_SEL : C_ALT), 0);
    lv_obj_t *l = lv_obj_get_child(s_tTab[t], 0);
    if (none) lv_label_set_text(l, t ? "수업 없음 -" : "수업 중 -");
    else lv_label_set_text_fmt(l, "%s %d", t ? "수업 없음" : inClass || lbl.length() ? "수업 중" : "수업 있음", cnt[t]);
    lv_obj_set_style_text_color(l, lv_color_hex(on ? C_SEL_TX : C_MUTED), 0);
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
  s_findFromTeach = true; s_findScrollPending = true;
  s_findSel = lv_label_get_text(lv_obj_get_child(lv_event_get_current_target(e), 0));
  lv_obj_add_flag(s_pTeach, LV_OBJ_FLAG_HIDDEN);
  showView(V_FIND);
}

// 화면 만들기(buildUI 에서 한 번)
static void buildPrincipalMore(lv_obj_t *scr, int top) {
  if (s_findGridParent) {
    s_findBack = button(s_findGridParent, LV_SYMBOL_LEFT "  지금 선생님", big() ? 170 : 150, big() ? 44 : 32, D_ROW, D_SUB);
    lv_obj_set_style_border_color(s_findBack, lv_color_hex(D_LINE), 0); lv_obj_set_style_border_width(s_findBack, 1, 0);
    lv_obj_align(s_findBack, LV_ALIGN_TOP_RIGHT, -10, big() ? 4 : 2);
    lv_obj_add_flag(s_findBack, LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_event_cb(s_findBack, [](lv_event_t *) {   // 교장 화면으로 돌아가 선생님 판을 다시 연다(고르던 탭·쪽은 그대로)
      showView(V_CLOCK); renderTeach(); lv_obj_clear_flag(s_pTeach, LV_OBJ_FLAG_HIDDEN); lv_obj_move_foreground(s_pTeach);
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
  // 1024 는 카드를 크게(86%). 긴 내용은 줄을 바꿔 끝까지 보이고, 넘치면 밀어서(스크롤) 읽는다.
  const int CWd = big() ? s_W * 86 / 100 : s_W * 7 / 10, CHd = big() ? s_H * 86 / 100 : s_H * 7 / 10, DBH = big() ? 46 : 40;
  lv_obj_t *card = box(s_pDetail, C_SURF, C_BORDER, 16);
  lv_obj_set_size(card, CWd, CHd); lv_obj_center(card);
  lv_obj_add_flag(card, LV_OBJ_FLAG_CLICKABLE);                // 카드를 눌러도 닫히지 않게(바깥 덮개만 닫는다)
  s_dDate = label(card, FM(), C_MUTED, ""); lv_obj_set_pos(s_dDate, 24, 20);
  // [닫기]는 오른쪽 위(선생님 판·볼 시간표 판과 같은 자리). 바깥 덮개를 눌러도 닫힌다
  lv_obj_t *cb = button(card, "닫기", 120, DBH, D_ROW, D_TEXT);
  lv_obj_set_style_border_color(cb, lv_color_hex(NOW_TAG), 0);
  lv_obj_align(cb, LV_ALIGN_TOP_RIGHT, -16, 12);
  lv_obj_add_event_cb(cb, [](lv_event_t *) { lv_obj_add_flag(s_pDetail, LV_OBJ_FLAG_HIDDEN); }, LV_EVENT_CLICKED, nullptr);
  s_dTitle = label(card, &kr28, C_TEXT, ""); lv_obj_set_width(s_dTitle, CWd - 48 - 136); lv_label_set_long_mode(s_dTitle, LV_LABEL_LONG_DOT);
  lv_obj_set_height(s_dTitle, 2 * lv_font_get_line_height(&kr28) + 4); lv_obj_set_pos(s_dTitle, 24, 46);
  const int IY = 46 + 29 * 2 + 20;
  s_dScroll = lv_obj_create(card);
  lv_obj_remove_style_all(s_dScroll);
  lv_obj_set_size(s_dScroll, CWd - 40, CHd - IY - DBH - 24); lv_obj_set_pos(s_dScroll, 24, IY);
  lv_obj_add_flag(s_dScroll, LV_OBJ_FLAG_SCROLLABLE); lv_obj_set_scroll_dir(s_dScroll, LV_DIR_VER);
  lv_obj_clear_flag(s_dScroll, LV_OBJ_FLAG_SCROLL_MOMENTUM | LV_OBJ_FLAG_SCROLL_ELASTIC);   // 딱딱하게(미끄러지지 않게)
  s_dInfo = label(s_dScroll, &kr20, C_MUTED, ""); lv_obj_set_width(s_dInfo, CWd - 56); lv_label_set_long_mode(s_dInfo, LV_LABEL_LONG_WRAP);
  lv_obj_set_style_text_line_space(s_dInfo, 8, 0); lv_obj_set_pos(s_dInfo, 0, 0);
  const int SBW = big() ? 150 : 130;
  s_dPrev = button(card, LV_SYMBOL_LEFT "  이전 일정", SBW, DBH, C_ALT, C_TEXT);
  lv_obj_set_style_border_color(s_dPrev, lv_color_hex(C_BORDER), 0); lv_obj_align(s_dPrev, LV_ALIGN_BOTTOM_LEFT, 16, -12);
  lv_obj_add_event_cb(s_dPrev, onDetailStep, LV_EVENT_CLICKED, (void *)(intptr_t)-1);
  s_dNext = button(card, "다음 일정  " LV_SYMBOL_RIGHT, SBW, DBH, C_ALT, C_TEXT);
  lv_obj_set_style_border_color(s_dNext, lv_color_hex(C_BORDER), 0); lv_obj_align(s_dNext, LV_ALIGN_BOTTOM_LEFT, 16 + SBW + 8, -12);
  lv_obj_add_event_cb(s_dNext, onDetailStep, LV_EVENT_CLICKED, (void *)(intptr_t)1);

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
    lv_obj_set_style_bg_color(s_sRow[k], lv_color_hex(D_LINE), LV_STATE_PRESSED);   // 눌림 색 + 오른쪽 끝 '>'
    lv_obj_align(label(s_sRow[k], FM(), D_MUTED, LV_SYMBOL_RIGHT), LV_ALIGN_RIGHT_MID, -10, 0);
    lv_obj_t *tb = box(s_sRow[k], D_LINE, 0, UI_SOFT ? 10 : 6);
    lv_obj_set_size(tb, small ? 70 : 92, RH - 14); lv_obj_align(tb, LV_ALIGN_LEFT_MID, 4, 0); lv_obj_clear_flag(tb, LV_OBJ_FLAG_CLICKABLE);
    s_sRowT[k] = label(tb, FM(), D_SUB, ""); lv_obj_center(s_sRowT[k]);
    s_sRowA[k] = label(s_sRow[k], fCellA, D_TEXT, ""); lv_obj_set_width(s_sRowA[k], s_W - 2 * M - (small ? 90 : 116) - 18); lv_label_set_long_mode(s_sRowA[k], LV_LABEL_LONG_DOT);
    lv_obj_set_pos(s_sRowA[k], small ? 82 : 106, 6);
    s_sRowB[k] = label(s_sRow[k], FM(), D_MUTED, ""); lv_obj_set_width(s_sRowB[k], s_W - 2 * M - (small ? 90 : 116) - 18); lv_label_set_long_mode(s_sRowB[k], LV_LABEL_LONG_DOT);
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

// 닉시 초를 지금 값으로(시계 화면이 다시 보일 때·닉시를 켤 때). LVGL 잠금 안에서 부른다
static void nixSecNow() {
  if (!s_nixOn || !s_sec || !timeValid()) return;
  time_t t = time(nullptr); struct tm tm; localtime_r(&t, &tm);
  nixSecShow(tm.tm_sec, true);
}
static void renderUse();
// ── 사무실 탭(2026-11-01 사용자 지시): 컴퓨터의 Claude 작업 하나 = 직원 한 명. Pixel Agents(MIT)를 본뜸, 그림 출처 tools/office_art/출처.md
//  탭덱이 '@ag 자리,캐릭터,상태,이름;…' 을 바뀔 때마다·10초마다 보낸다. 30초 넘게 못 받으면 비운다(탭덱 꺼짐).
//  상태 w 타자 · r 읽기 · q 허락 기다림(노란 ?) · d 끝남(초록 ✓) · i 쉬는 중(오른쪽 쉼터로)
//  그림은 작은 원본(office_art.c)을 켤 때 OFF_Z 배로 늘려 PSRAM 에 둔다. 자리 수치는 tools/make_office.py 와 같아야 한다
extern const lv_img_dsc_t office_bg, office_desk, office_chr0, office_chr1, office_chr2, office_chr3, office_chr4, office_chr5;
extern const lv_img_dsc_t office_pet0, office_pet1, office_pet2, office_pet3, office_pet4, office_pet5, office_pet6;
// ── Claude 펫(사용자 지시 2026-11-03, Tamamon 처럼): 탭덱이 Claude 가 쓴 글의 양으로 키우고 '@pet 종류 단계 % 기분 먹음 뽑기표 도감' 을 보낸다.
//  펫은 쉼터 바닥을 천천히 돌아다닌다(사무실 움직임과 같은 0.45초 박자 — 더 자주 그리면 화면이 흔들린다).
//  밤(22~7시)에는 잔다. 누르면 기뻐한다. 선물 상자(한 주에 한 번)를 누르면 '@petgacha', 위의 이름표를 누르면 '@petsel'(다음 펫)
static const int PET_N = 7;
static const char *PET_NM[PET_N] = {"말랑이", "냥냥이", "토실이", "뿔뿔이", "새싹이", "별빛이", "부캉이"};
static const char *PET_STN[4] = {"알", "아기", "어린이", "어른"};
static const int PET_WP[6][2] = {{240, 140}, {252, 150}, {232, 150}, {254, 136}, {246, 146}, {236, 144}};   // 돌아다니는 곳(16x16 칸의 왼쪽 위, 작은 그림 점). 이름표가 정수기를 덮지 않게 왼쪽(x 254 까지)
static const lv_img_dsc_t *s_petBig = nullptr;   // 지금 종류의 늘린 그림(종류가 바뀌면 지우고 다시 만든다)
static int s_petBigK = -1;
static lv_obj_t *s_petImg, *s_petFx, *s_petTag, *s_petGift, *s_petPop, *s_petPopT;   // s_petPop: 누르면 뜨는 상태 창
static int s_petSp = -1, s_petSt = 0, s_petPct = 0, s_petTicket = 0;
static char s_petMood = 'i', s_petDex[8] = "-------";
static uint32_t s_petAt = 0, s_petFedAt = 0;
static int s_petX = 244, s_petY = 144, s_petTo = 0, s_petTouch = 0, s_petWow = 0, s_petGiftWait = 0, s_petPopTick = 0;
static const int OFF_DX[3] = {16, 80, 144}, OFF_DY[2] = {56, 127};
static const int OFF_LX[3] = {244, 292, 236}, OFF_LY[3] = {62, 62, 100};
static const int OFF_W = 336, OFF_H = 176, OFF_N = 6, OFF_LN = 3;
static const int OFF_CX[2] = {286, 318}, OFF_CY = 128;   // 정수기 2대(5시간 · 주간 사용량). 물통 안쪽 x-5~x+4, y+1~y+14
static lv_obj_t *s_offWater[2], *s_offPct[2], *s_offCNm[2];
struct OffAgent { int8_t slot, chr; char st; char name[40]; };
static OffAgent s_ag[OFF_N];
static int s_agN = 0;
static uint32_t s_agAt = 0;                 // 마지막으로 '@ag' 를 받은 때
static int s_offZ = 3;
static lv_obj_t *s_viewOff = nullptr, *s_tabOff = nullptr, *s_offEmpty = nullptr;
static lv_obj_t *s_offChr[OFF_N], *s_offBub[OFF_N], *s_offBubT[OFF_N], *s_offTag[OFF_N];
static lv_obj_t *s_offLChr[OFF_LN], *s_offLTag[OFF_LN];
static char s_offSt[OFF_N];                 // 책상마다 지금 상태(0 = 빈 책상) — 움직임 타이머가 본다
static const lv_img_dsc_t *s_offChrImg[6];
static uint32_t s_offTick = 0;

// 작은 그림을 z 배로 늘린다(점을 그대로 키움 — 픽셀 그림이 흐려지지 않게). 실패하면 원본을 쓴다
static const lv_img_dsc_t *imgScale(const lv_img_dsc_t *src, int z) {
  const int bpp = src->header.cf == LV_IMG_CF_TRUE_COLOR_ALPHA ? 3 : 2;
  const int w = src->header.w, h = src->header.h, W2 = w * z, H2 = h * z;
  uint8_t *d = (uint8_t *)heap_caps_malloc((size_t)W2 * H2 * bpp, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
  lv_img_dsc_t *ds = (lv_img_dsc_t *)heap_caps_calloc(1, sizeof(lv_img_dsc_t), MALLOC_CAP_SPIRAM);
  if (!d || !ds) { if (d) heap_caps_free(d); if (ds) heap_caps_free(ds); return src; }
  for (int y = 0; y < h; y++) {
    uint8_t *row = d + (size_t)y * z * W2 * bpp;
    const uint8_t *s = src->data + (size_t)y * w * bpp;
    for (int x = 0; x < w; x++) for (int k = 0; k < z; k++) memcpy(row + ((size_t)x * z + k) * bpp, s + x * bpp, bpp);
    for (int k = 1; k < z; k++) memcpy(row + (size_t)k * W2 * bpp, row, (size_t)W2 * bpp);
  }
  ds->header = src->header; ds->header.w = W2; ds->header.h = H2;
  ds->data_size = (uint32_t)W2 * H2 * bpp; ds->data = d;
  return ds;
}
// 직원 그림(7칸 줄)에서 col 번째 칸만 보이게 한다: 0~2 걷기 · 3~4 타자 · 5~6 읽기
static void offFrame(lv_obj_t *img, int col) {
  const lv_coord_t ox = -col * 16 * s_offZ;
  if (lv_img_get_offset_x(img) != ox) lv_img_set_offset_x(img, ox);
}
static void offChrSrc(lv_obj_t *img, int chr) {
  const lv_img_dsc_t *d = s_offChrImg[chr % 6];
  if (lv_img_get_src(img) != d) lv_img_set_src(img, d);
  lv_obj_set_size(img, 16 * s_offZ, 32 * s_offZ);   // set_src 가 크기를 그림 전체로 되돌린다
}
static void offUse();
static void renderOffice() {
  if (!s_viewOff) return;
  bool desk[OFF_N] = {}; int lounge = 0;
  for (int i = 0; i < s_agN; i++) {
    const OffAgent &a = s_ag[i];
    if (a.st == 'i') {   // 쉬는 중: 쉼터 세 자리까지(넘치면 안 보인다)
      if (lounge >= OFF_LN) continue;
      offChrSrc(s_offLChr[lounge], a.chr); offFrame(s_offLChr[lounge], 1);
      setTextIf(s_offLTag[lounge], a.name);
      showIf(s_offLChr[lounge], true); showIf(s_offLTag[lounge], true);
      lounge++;
      continue;
    }
    const int k = a.slot;
    desk[k] = true; s_offSt[k] = a.st;
    offChrSrc(s_offChr[k], a.chr);
    setTextIf(s_offTag[k], a.name);
    showIf(s_offChr[k], true); showIf(s_offTag[k], true); showIf(s_offBub[k], true);
    const bool q = a.st == 'q', d = a.st == 'd';
    setBgIf(s_offBub[k], q ? 0xFFC440 : d ? 0x6ED278 : 0xF0F0F0);
    if (q) setTextIf(s_offBubT[k], "?");
    else if (d) setTextIf(s_offBubT[k], LV_SYMBOL_OK);
    if (q || d) offFrame(s_offChr[k], 1);
  }
  for (int k = 0; k < OFF_N; k++) if (!desk[k]) { s_offSt[k] = 0; showIf(s_offChr[k], false); showIf(s_offTag[k], false); showIf(s_offBub[k], false); }
  for (int j = lounge; j < OFF_LN; j++) { showIf(s_offLChr[j], false); showIf(s_offLTag[j], false); }
  showIf(s_offEmpty, s_agN == 0);
  offUse();
}
static const lv_img_dsc_t *const PET_SRC[PET_N] = {&office_pet0, &office_pet1, &office_pet2, &office_pet3, &office_pet4, &office_pet5, &office_pet6};
// 그림을 종류 k 로. 늘린 그림은 하나만 둔다(6종을 미리 늘리면 PSRAM 이 모자랐다 2026-11-03). 늘리기에 실패하면 펫을 숨긴다
static bool petSrc(int k) {
  if (!s_petImg) return false;
  if (k != s_petBigK || !s_petBig) {
    if (s_petBig && s_petBig != PET_SRC[s_petBigK]) { heap_caps_free((void *)s_petBig->data); heap_caps_free((void *)s_petBig); }
    s_petBig = imgScale(PET_SRC[k], s_offZ); s_petBigK = k;
    lv_img_set_src(s_petImg, s_petBig);
    lv_obj_set_size(s_petImg, 16 * s_offZ, 16 * s_offZ);   // set_src 가 크기를 그림 전체로 되돌린다
  }
  return s_petBig != PET_SRC[k] || s_offZ == 1;
}
static void petInfo() {   // 위 이름표·선물 상자(바뀐 것만 다시 그린다)
  if (!s_petTag) return;
  const bool on = s_petSp >= 0 && s_petAt && millis() - s_petAt < 60000 && petSrc(s_petSp);
  showIf(s_petImg, on); showIf(s_petTag, on); showIf(s_petGift, on && s_petTicket);
  if (!on) { showIf(s_petFx, false); return; }
  int n = 0; for (int k = 0; k < PET_N; k++) if (s_petDex[k] != '-') n++;
  char b[80];
  snprintf(b, sizeof b, "%s", s_petGiftWait ? "두근두근..." : PET_NM[s_petSp]);   // 이름표는 이름만(자세한 것은 눌러서 뜨는 창, 사용자 지시)
  if (s_petPopT) {   // 상태 창 글
    static const char *NEXT[3] = {"알에서 깨기까지", "어린이까지", "어른까지"};
    char t[200];
    if (s_petSt >= 3) snprintf(t, sizeof t, "%s · 어른\n다 자랐어요!\n도감 %d/%d", PET_NM[s_petSp], n, PET_N);
    else snprintf(t, sizeof t, "%s · %s\n%s %d%%\n도감 %d/%d", PET_NM[s_petSp], PET_STN[s_petSt], NEXT[s_petSt], s_petPct, n, PET_N);
    setTextIf(s_petPopT, t);
  }
  if (setTextIf(s_petTag, b)) {
    lv_obj_update_layout(s_petTag);
    lv_obj_set_pos(s_petTag, (s_petX + 8) * s_offZ - lv_obj_get_width(s_petTag) / 2, (s_petY + 16) * s_offZ);
  }
}
static void petLine(const char *p) {
  int sp, st, pct, fed, tk; char mood; char dex[8] = "";
  if (sscanf(p, "%d %d %d %c %d %d %7s", &sp, &st, &pct, &mood, &fed, &tk, dex) < 6 || sp < 0 || sp >= PET_N || st < 0 || st > 3) return;
  lock();
  if (s_petSp >= 0 && (sp != s_petSp || st != s_petSt)) s_petWow = 8;   // 새 펫·자람: 잠깐 '★'
  s_petSp = sp; s_petSt = st; s_petPct = constrain(pct, 0, 100); s_petMood = mood; s_petTicket = tk;
  if (dex[0]) snprintf(s_petDex, sizeof s_petDex, "%s", dex);
  if (fed) s_petFedAt = millis() ? millis() : 1;
  s_petAt = millis() ? millis() : 1;
  s_petGiftWait = 0;
  petInfo();
  unlock();
}
static void petFrame(int col) {
  const lv_coord_t ox = -col * 16 * s_offZ, oy = -s_petSt * 16 * s_offZ;
  if (lv_img_get_offset_x(s_petImg) != ox) lv_img_set_offset_x(s_petImg, ox);
  if (lv_img_get_offset_y(s_petImg) != oy) lv_img_set_offset_y(s_petImg, oy);
}
static void petFx(const char *t, uint32_t col) {
  if (!t) { showIf(s_petFx, false); return; }
  setTextIf(s_petFx, t); setTextColIf(s_petFx, col);
  const int Z = s_offZ;
  lv_obj_set_pos(s_petFx, (s_petX + 11) * Z, (s_petY - 2) * Z - lv_font_get_line_height(FM()) / 2);
  showIf(s_petFx, true);
}
static void petTick() {   // offTimer 가 사무실을 볼 때만 부른다
  if (!s_petImg || s_petSp < 0 || lv_obj_has_flag(s_petImg, LV_OBJ_FLAG_HIDDEN)) return;
  const int Z = s_offZ, t = (int)s_offTick;
  bool night = false;
  if (timeValid()) { time_t now = time(nullptr); struct tm tm; localtime_r(&now, &tm); night = tm.tm_hour >= 22 || tm.tm_hour < 7; }
  const bool fed = s_petFedAt && millis() - s_petFedAt < 8000;
  int col = 0;
  if (s_petWow) { s_petWow--; col = 3; petFx("★", 0xFFD84A); }
  else if (s_petTouch) { s_petTouch--; col = 3; petFx("♥", 0xFF6680); }
  else if (night) { col = 2; petFx((t >> 2) & 1 ? "Zz" : "z", 0xBFD8FF); }
  else if (s_petSt == 0) { col = (t % 6 == 0) ? 1 : 0; petFx(nullptr, 0); }        // 알: 가끔 흔들
  else if (fed) { col = (t & 1) ? 4 : 0; petFx("♪", 0xFFFFFF); }                    // Claude 가 방금 글을 써서 먹는 중
  else if (s_petMood == 'q') { col = (t & 1) ? 3 : 0; petFx("?", 0xFFC440); }       // 허락을 기다리는 작업이 있다
  else {
    petFx(nullptr, 0);
    const int tx = PET_WP[s_petTo][0], ty = PET_WP[s_petTo][1];
    const bool walk = s_petMood == 'w' || (t / 20) % 3 == 0;                        // 일하는 중이면 계속, 쉬면 가끔 걷는다
    if (walk && (s_petX != tx || s_petY != ty)) {
      s_petX += (tx > s_petX) - (tx < s_petX); s_petY += (ty > s_petY) - (ty < s_petY);
      col = (t & 1) ? 1 : 0;
    } else {
      if (s_petX == tx && s_petY == ty) s_petTo = (s_petTo + 1 + (t % 3)) % 6;
      col = (t % 9 == 0) ? 3 : 0;                                                     // 서 있다가 가끔 웃는다
    }
  }
  petFrame(col);
  if (s_petPopTick && !--s_petPopTick) showIf(s_petPop, false);   // 상태 창은 10초 뒤 저절로 닫힌다
  if (lv_obj_get_x(s_petImg) != s_petX * Z || lv_obj_get_y(s_petImg) != s_petY * Z) {
    lv_obj_set_pos(s_petImg, s_petX * Z, s_petY * Z);
    lv_obj_set_pos(s_petTag, (s_petX + 8) * Z - lv_obj_get_width(s_petTag) / 2, (s_petY + 16) * Z);   // 이름표도 따라간다
  }
  if (s_petGift && s_petTicket && !lv_obj_has_flag(s_petGift, LV_OBJ_FLAG_HIDDEN)) lv_obj_set_y(s_petGift, (104 - ((t >> 1) & 1)) * Z);   // 선물 상자가 통통
}
// 정수기 물 = 남은 사용량(사용자 지시 2026-11-01): 많이 쓸수록 물이 줄어든다. 탭덱 소식이 없으면 빈 통과 '-'
static void offUse() {
  if (!s_offWater[0]) return;
  const bool on = s_useAt && millis() - s_useAt < USE_STALE_MS && !s_useErr;
  const int P[2] = {s_useP5, s_useP7};
  for (int i = 0; i < 2; i++) {
    const bool has = on && P[i] >= 0;
    const int left = has ? 100 - P[i] : 0, full = 14 * s_offZ;
    const int h = left <= 0 ? 0 : max(2, full * left / 100);
    if (lv_obj_get_height(s_offWater[i]) != h) { lv_obj_set_height(s_offWater[i], h); lv_obj_set_y(s_offWater[i], (OFF_CY + 15) * s_offZ - h); }
    showIf(s_offWater[i], h > 0);
    char b[8] = "-"; if (has) snprintf(b, sizeof b, "%d%%", P[i]); else if (on && i == 1) snprintf(b, sizeof b, "없음");
    setTextIf(s_offPct[i], b);
    setTextColIf(s_offPct[i], has && P[i] >= 90 ? 0xD03030 : 0x2A3240);
  }
  setTextIf(s_offCNm[1], s_useName[0] ? s_useName : "주간");   // 팀 요금제는 모델별 주간 한도(예: Fable) — 그 이름을 보인다
}
// 0.45초마다: 타자·읽기 움직임, 일하는 중 말풍선의 점. 탭덱이 30초 넘게 조용하면 비운다
static void offTimer(lv_timer_t *) {
  if (s_agN && millis() - s_agAt > 30000) { s_agN = 0; renderOffice(); }
  if (s_petAt && millis() - s_petAt > 60000) { s_petAt = 0; petInfo(); }   // 탭덱이 1분 넘게 조용하면 펫을 숨긴다
  if (s_view != V_OFF) return;
  petTick();
  if (!(s_offTick & 7)) offUse();   // 약 4초마다(바뀐 것만 다시 그린다)
  s_offTick++;
  static const char *DOTS[3] = {"·", "··", "···"};
  for (int k = 0; k < OFF_N; k++) {
    const char st = s_offSt[k];
    if (st == 'w') offFrame(s_offChr[k], 3 + (s_offTick & 1));
    else if (st == 'r') offFrame(s_offChr[k], 5 + ((s_offTick >> 1) & 1));
    else continue;
    setTextIf(s_offBubT[k], DOTS[(s_offTick >> 1) % 3]);
  }
}
static void agLine(const char *p) {
  int n = 0;
  while (*p == ' ') p++;
  while (*p && n < OFF_N) {
    const char *e = strchr(p, ';'); if (!e) e = p + strlen(p);
    int slot, chr; char st; int used = 0;
    if (sscanf(p, "%d,%d,%c,%n", &slot, &chr, &st, &used) == 3 && used > 0 && slot >= 0 && slot < OFF_N && chr >= 0 && strchr("wrqdi", st)) {
      OffAgent &a = s_ag[n++];
      a.slot = slot; a.chr = chr % 6; a.st = st;
      size_t len = e - (p + used); if (len >= sizeof a.name) len = sizeof a.name - 1;
      memcpy(a.name, p + used, len); a.name[len] = 0;
    }
    p = *e ? e + 1 : e;
  }
  s_agN = n; s_agAt = millis();
  lock(); renderOffice(); unlock();
}
static void buildOffice(lv_obj_t *scr, int top) {
  const int Z = s_offZ = big() ? 3 : 2;
  const lv_img_dsc_t *CH[6] = {&office_chr0, &office_chr1, &office_chr2, &office_chr3, &office_chr4, &office_chr5};
  for (int i = 0; i < 6; i++) s_offChrImg[i] = imgScale(CH[i], Z);
  const lv_img_dsc_t *bg = imgScale(&office_bg, Z), *desk = imgScale(&office_desk, Z);
  const int VH = s_H - top;
  s_viewOff = box(scr, D_BG, 0, 0);
  lv_obj_set_size(s_viewOff, s_W, VH); lv_obj_set_pos(s_viewOff, 0, top);
  lv_obj_add_flag(s_viewOff, LV_OBJ_FLAG_HIDDEN);
  lv_obj_t *sc = lv_img_create(s_viewOff);   // 바닥·벽·가구(맨 아래 판). 직원·책상은 이 위에 놓는다
  lv_img_set_src(sc, bg);
  lv_obj_clear_flag(sc, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_pos(sc, (s_W - OFF_W * Z) / 2, (VH - OFF_H * Z) / 2);
  auto mkTag = [&](int cx, int ty, int tw) {   // tw: 이름표 너비(작은 그림 점)
    lv_obj_t *t = label(sc, FM(), D_TEXT, "");
    lv_obj_set_style_bg_color(t, lv_color_hex(0x14181F), 0); lv_obj_set_style_bg_opa(t, LV_OPA_80, 0);
    lv_obj_set_style_radius(t, 6, 0); lv_obj_set_style_pad_hor(t, 4, 0); lv_obj_set_style_pad_ver(t, 1, 0);
    lv_obj_set_width(t, tw * Z); lv_label_set_long_mode(t, LV_LABEL_LONG_DOT);
    lv_obj_set_style_text_align(t, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_set_pos(t, cx - tw * Z / 2, ty);
    lv_obj_add_flag(t, LV_OBJ_FLAG_HIDDEN);
    return t;
  };
  auto mkChr = [&](int x, int y) {
    lv_obj_t *c = lv_img_create(sc);
    lv_img_set_src(c, s_offChrImg[0]);
    lv_obj_set_size(c, 16 * Z, 32 * Z); lv_obj_set_pos(c, x, y);
    lv_obj_add_flag(c, LV_OBJ_FLAG_HIDDEN);
    return c;
  };
  for (int k = 0; k < OFF_N; k++) s_offChr[k] = mkChr((OFF_DX[k % 3] + 16) * Z, (OFF_DY[k / 3] - 22) * Z);
  for (int j = 0; j < OFF_LN; j++) s_offLChr[j] = mkChr(OFF_LX[j] * Z, OFF_LY[j] * Z);
  for (int k = 0; k < OFF_N; k++) {   // 책상은 직원보다 나중에 만들어 위에 그린다(다리를 가린다)
    lv_obj_t *dk = lv_img_create(sc);
    lv_img_set_src(dk, desk);
    lv_obj_set_pos(dk, OFF_DX[k % 3] * Z, (OFF_DY[k / 3] - 23) * Z);
  }
  const int BW = big() ? 44 : 34, BH = big() ? 30 : 24;
  for (int k = 0; k < OFF_N; k++) {
    const int cx = (OFF_DX[k % 3] + 24) * Z, y = OFF_DY[k / 3];
    s_offTag[k] = mkTag(cx, (y + 26) * Z, 48);
    lv_obj_t *b = s_offBub[k] = box(sc, 0xF0F0F0, 0, 0);
    lv_obj_set_style_radius(b, BH / 2, 0);   // box() 의 R() 는 테마에 따라 0 이 된다 → 말풍선은 늘 둥글게
    lv_obj_set_size(b, BW, BH); lv_obj_set_pos(b, cx - BW / 2, (y - 20) * Z - BH - 4);
    s_offBubT[k] = label(b, FM(), 0x1E1E1E, "");
    lv_obj_center(s_offBubT[k]);
    lv_obj_add_flag(b, LV_OBJ_FLAG_HIDDEN);
  }
  for (int j = 0; j < OFF_LN; j++) s_offLTag[j] = mkTag((OFF_LX[j] + 8) * Z, (OFF_LY[j] + 33) * Z, 44);
  for (int i = 0; i < 2; i++) {   // 정수기: 물(아래부터 차오름) · 몸통에 사용량 % · 아래에 이름
    const int cx = OFF_CX[i];
    lv_obj_t *w = s_offWater[i] = box(sc, 0x3E9BE0, 0, 0);
    lv_obj_set_style_radius(w, 0, 0);
    lv_obj_set_style_border_side(w, LV_BORDER_SIDE_TOP, 0); lv_obj_set_style_border_width(w, Z, 0);
    lv_obj_set_style_border_color(w, lv_color_hex(0x9AD6F7), 0); lv_obj_set_style_border_opa(w, LV_OPA_COVER, 0);
    lv_obj_set_size(w, 10 * Z, 0); lv_obj_set_pos(w, (cx - 5) * Z, (OFF_CY + 15) * Z);
    lv_obj_add_flag(w, LV_OBJ_FLAG_HIDDEN);
    lv_obj_t *t = s_offPct[i] = label(sc, FM(), 0x2A3240, "-");
    lv_obj_set_width(t, 16 * Z); lv_obj_set_style_text_align(t, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_set_pos(t, (cx - 8) * Z, (OFF_CY + 25) * Z);
    s_offCNm[i] = mkTag(cx * Z, (OFF_CY + 37) * Z, 30);
    setTextIf(s_offCNm[i], i ? "주간" : "5시간"); lv_obj_clear_flag(s_offCNm[i], LV_OBJ_FLAG_HIDDEN);
  }
  {   // Claude 펫: 그림(종류마다 80x64 → Z 배) · 효과 글(♥ Zz ♪ ★) · 위 이름표 · 선물 상자
    lv_obj_t *pi = s_petImg = lv_img_create(sc);   // 그림은 첫 '@pet' 을 받을 때 petSrc 가 넣는다
    s_petBig = nullptr; s_petBigK = -1;                 // 화면을 다시 만들 때(화면 색 바꿈) 옛 그림은 버린다
    lv_obj_set_size(pi, 16 * Z, 16 * Z); lv_obj_set_pos(pi, s_petX * Z, s_petY * Z);
    lv_obj_add_flag(pi, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_flag(pi, LV_OBJ_FLAG_HIDDEN);
    lv_obj_set_ext_click_area(pi, 8);
    auto petOpen = [](lv_event_t *) { s_petTouch = 6; petInfo(); showIf(s_petPop, true); lv_obj_move_foreground(s_petPop); s_petPopTick = 22; };
    lv_obj_add_event_cb(pi, petOpen, LV_EVENT_CLICKED, nullptr);
    s_petFx = label(sc, FM(), 0xFFFFFF, "");
    lv_obj_add_flag(s_petFx, LV_OBJ_FLAG_HIDDEN);
    s_petTag = mkTag((s_petX + 8) * Z, (s_petY + 16) * Z, 70);
    lv_obj_set_width(s_petTag, LV_SIZE_CONTENT);   // 글 길이만큼(가운데는 petTick 이 맞춘다)
    lv_obj_add_flag(s_petTag, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(s_petTag, petOpen, LV_EVENT_CLICKED, nullptr);
    lv_obj_t *g = s_petGift = box(sc, 0xE04848, 0x7A1E1E, 0);   // 선물 상자 12x10(작은 그림 점) + 노란 끈
    lv_obj_set_style_radius(g, Z, 0); lv_obj_set_style_border_width(g, Z / 2 + 1, 0);
    lv_obj_set_size(g, 12 * Z, 10 * Z); lv_obj_set_pos(g, 312 * Z, 104 * Z);
    lv_obj_t *r1 = box(g, 0xFFD84A, 0, 0); lv_obj_set_size(r1, 2 * Z, 10 * Z); lv_obj_center(r1); lv_obj_clear_flag(r1, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_t *r2 = box(g, 0xFFD84A, 0, 0); lv_obj_set_size(r2, 12 * Z, 2 * Z); lv_obj_align(r2, LV_ALIGN_TOP_MID, 0, 2 * Z); lv_obj_clear_flag(r2, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_flag(g, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_flag(g, LV_OBJ_FLAG_HIDDEN);
    lv_obj_set_ext_click_area(g, 10);
    lv_obj_add_event_cb(g, [](lv_event_t *) { Serial.printf("\n@petgacha\n"); s_petGiftWait = 1; petInfo(); }, LV_EVENT_CLICKED, nullptr);
    // 상태 창: 쉼터 위 가운데. 글 세 줄 + [다음 펫] [닫기]
    const int PW = big() ? 300 : 240, PH = big() ? 190 : 160, BW = (PW - 36) / 2, BH = big() ? 44 : 36;
    lv_obj_t *pp = s_petPop = box(s_viewOff, 0x1C2230, 0x6A7A96, 0);
    lv_obj_set_style_radius(pp, 14, 0); lv_obj_set_style_border_width(pp, 2, 0);
    lv_obj_set_size(pp, PW, PH); lv_obj_set_pos(pp, (s_W - OFF_W * Z) / 2 + 282 * Z - PW / 2, (VH - OFF_H * Z) / 2 + 40 * Z);   // 좌표가 아직 0 일 수 있어 직접 셈
    s_petPopT = label(pp, FM(), 0xFFFFFF, "");
    lv_obj_set_width(s_petPopT, PW - 24); lv_obj_set_style_text_align(s_petPopT, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_align(s_petPopT, LV_ALIGN_TOP_MID, 0, 14);
    lv_obj_t *bn = button(pp, "다음 펫", BW, BH, C_ALT, C_TEXT);
    lv_obj_align(bn, LV_ALIGN_BOTTOM_LEFT, 12, -12);
    lv_obj_add_event_cb(bn, [](lv_event_t *) { Serial.printf("\n@petsel\n"); showIf(s_petPop, false); s_petPopTick = 0; }, LV_EVENT_CLICKED, nullptr);
    lv_obj_t *bc = button(pp, "닫기", BW, BH, C_ALT, C_TEXT);
    lv_obj_align(bc, LV_ALIGN_BOTTOM_RIGHT, -12, -12);
    lv_obj_add_event_cb(bc, [](lv_event_t *) { showIf(s_petPop, false); s_petPopTick = 0; }, LV_EVENT_CLICKED, nullptr);
    lv_obj_add_flag(pp, LV_OBJ_FLAG_HIDDEN);
  }
  s_offEmpty = label(s_viewOff, FM(), D_TEXT, "Claude 작업을 기다리는 중이에요\n컴퓨터의 탭덱이 작업을 알려 주면 직원이 자리에 앉아요");
  lv_obj_set_style_text_align(s_offEmpty, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_set_style_bg_color(s_offEmpty, lv_color_hex(0x14181F), 0); lv_obj_set_style_bg_opa(s_offEmpty, LV_OPA_80, 0);
  lv_obj_set_style_radius(s_offEmpty, 10, 0); lv_obj_set_style_pad_all(s_offEmpty, 14, 0);
  lv_obj_align(s_offEmpty, LV_ALIGN_CENTER, -60, 0);
  lv_timer_create(offTimer, 450, nullptr);
}

static void showView(View v) {
  const View old = s_view;
  s_view = v;
  if (v == V_WEEK && old != V_WEEK) s_sPg = 0;   // [학교 일정]은 들어올 때마다 첫 쪽부터
  if (v == V_CLOCK && (old == V_WEEK || old == V_DECK)) s_backView = old;   // 시계 화면을 누르면 이 탭으로 돌아간다
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
  if (s_viewDeck) vis(s_viewDeck, v == V_DECK);
  if (s_viewOff) vis(s_viewOff, v == V_OFF);
  if (s_pickView) vis(s_pickView, false);   // 다른 탭으로 가면 '볼 시간표' 판은 닫는다
  tabStyle(s_tabTT, v == V_WEEK);
  tabStyle(s_tabSet, v == V_SET);
  tabStyle(s_tabClock, v == V_CLOCK);
  tabStyle(s_tabFind, v == V_FIND);
  if (s_tabDeck) tabStyle(s_tabDeck, v == V_DECK);
  if (s_tabOff) tabStyle(s_tabOff, v == V_OFF);
  if (v == V_DECK) deckStateText();
  if (v == V_OFF) renderOffice();
  if (v == V_WEEK && !s_principal && s_weekDirty) renderWeek();   // 숨어 있는 동안 미뤄 둔 주간표
  if (v == V_CLOCK && !s_principal && s_todayDirty) { s_todayDirty = false; renderToday(); }   // 미뤄 둔 오늘 시간표
  if (v == V_CLOCK && !s_principal) nixSecNow();                  // 숨어 있던 동안 멈춘 초를 바로 지금 값으로
  if (v == V_SET) disarmButtons();
  if (v != V_FIND) s_findFromTeach = false;
  if (s_findBack) vis(s_findBack, v == V_FIND && s_findFromTeach && s_principal);
  if (v == V_FIND) { if (s_findGridDirty) fillFinderGrid(); renderFinder(); }
  if (v == V_SET) refreshWifiLabel();
  if (v == V_CLOCK && s_principal) renderPrincipal();
  if (v == V_WEEK && s_principal) renderSchedList();
  renderUse();                                                    // 위쪽 사용량 두 줄은 막대가 없는 화면에서만
}
static void onTabTT(lv_event_t *e) { showView(V_WEEK); }
static void onTabSet(lv_event_t *e) { showView(V_SET); }
static void onTabClock(lv_event_t *e) { showView(V_CLOCK); }

// ── 설정 '시계 화면' ──
static int s_lastMin = -1;                           // 시계 글을 분이 바뀔 때만 다시 그린다(loop). -1 이면 곧 다시 그린다
static void segStyle(lv_obj_t *b, bool on) {
  lv_obj_set_style_bg_color(b, lv_color_hex(on ? C_SEL : C_ALT), 0);   // 켜진 것은 호박색(빨강이 줄지어 있으면 오류처럼 보였다)
  lv_obj_set_style_border_color(b, lv_color_hex(on ? C_SEL : D_LINE), 0);
  lv_obj_set_style_text_color(lv_obj_get_child(b, 0), lv_color_hex(on ? C_SEL_TX : C_MUTED), 0);
}
static void refreshClockSettings() {
  for (int i = 0; i < 2; i++) segStyle(s_fmtBtn[i], (i == 1) == s_h12);
  if (s_nixBtn) segStyle(s_nixBtn, s_nixOn);
  for (int i = 0; i < 3; i++) segStyle(s_autoBtn[i], AUTO_CLK_MIN[i] == s_autoClkMin);
}
// 닉시 시계를 켜고 끈다: 심지 글꼴·색·여백을 바꾸고 빛·초 글자를 보이거나 숨긴다
static void applyNixie() {
  lv_obj_set_style_text_font(s_big, s_nixOn ? FNIX(true) : FCLK(), 0);
  lv_obj_set_style_text_color(s_big, lv_color_hex(s_nixOn ? NIX_CORE : D_TEXT), 0);
  lv_obj_set_style_pad_hor(s_big, s_nixOn ? FNIX(true)->base_line : 0, 0);
  showIf(s_bigGlow, s_nixOn); showIf(s_sec, s_nixOn); showIf(s_secGlow, s_nixOn);
  nixSecNow();
}
static void onNixBtn(lv_event_t *) {
  s_nixOn = !s_nixOn;
  s_prefs.putBool("nixie", s_nixOn);
  refreshClockSettings();
  applyNixie(); layoutClock();
  setStatus(s_principal ? "닉시 시계는 교사용 시계 화면에서만 보입니다"
            : s_nixOn ? "닉시 시계: 숫자를 닉시관처럼, 초도 보입니다" : "닉시 시계를 껐습니다");
}
// 탭 줄: 설정 [사용량]을 끄면 [사무실] 탭을 숨기고 나머지를 당겨 붙인다(사용자 지시 2026-11-04). 사무실을 보던 중이면 시계로
static lv_obj_t *s_tabBox = nullptr;
static int s_tabW = 74;
static void layoutTabs() {
  if (!s_tabBox) return;
  showIf(s_tabOff, s_useOn);
  lv_obj_t *t[6] = {s_tabTT, s_tabClock, s_tabDeck, s_tabOff, s_tabFind, s_tabSet};
  int n = 0;
  for (int i = 0; i < 6; i++) {
    if (!t[i] || (t[i] == s_tabOff && !s_useOn)) continue;
    lv_obj_set_pos(t[i], 4 + n * (s_tabW + 2), 3);
    n++;
  }
  lv_obj_set_width(s_tabBox, s_tabW * n + (n - 1) * 2 + 8);
  if (!s_useOn && s_view == V_OFF) showView(V_CLOCK);
}
static void onUseBtn(lv_event_t *) {   // [사용량]: 누를 때마다 켜짐/꺼짐
  s_useOn = !s_useOn;
  s_prefs.putBool("useon", s_useOn);
  segStyle(s_useBtn, s_useOn);
  renderUse();
  layoutTabs();
  setStatus(s_useOn ? (s_useAt ? "Claude 사용량을 위쪽에 보입니다" : "Claude 사용량: 컴퓨터의 탭덱이 알려 주면 위쪽에 보입니다") : "Claude 사용량을 숨겼습니다");
}
static void onPcOnly(lv_event_t *) {   // [컴퓨터만]: 누를 때마다 켜짐/꺼짐. 켜면 와이파이를 쓰지 않는다
  s_pcOnly = !s_pcOnly;
  s_prefs.putBool("pconly", s_pcOnly);
  segStyle(s_pcBtn, s_pcOnly);
  if (!s_pcOnly && s_prefs.isKey("ssid")) s_syncReq = true;   // 끄면 바로 한 번 받는다
  refreshWifiLabel(); renderToday();
  setStatus(s_pcOnly ? "컴퓨터만 연결합니다 · 와이파이를 쓰지 않아요" : "와이파이로 받습니다");
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
  s_ttLayoutDirty = true;                            // D-day 를 켜고 끄면 제목 자리도 다시
  renderToday();                                     // D-day 등 보이기가 바뀐 것을 반영
}
static void onAutoPick(lv_event_t *e) {
  s_autoClkMin = AUTO_CLK_MIN[(intptr_t)lv_event_get_user_data(e)];
  s_prefs.putInt("autoclk", s_autoClkMin);
  refreshClockSettings();
}
// 화면 색: 고른 테마 단추는 굵은 테두리. 누르면 저장하고 1초 뒤 다시 켠다(화면을 새로 만들기보다 안전)
static void refreshThemeButtons() {
  for (int i = 0; i < THEME_N; i++) {
    if (!s_themeBtn[i]) continue;
    const bool on = i == s_themeIdx;
    lv_obj_set_style_border_width(s_themeBtn[i], on ? 3 : 1, 0);
    lv_obj_set_style_border_color(s_themeBtn[i], lv_color_hex(on ? C_TEXT : C_BORDER), 0);
  }
}
static void onThemePick(lv_event_t *e) {
  const int i = (int)(intptr_t)lv_event_get_user_data(e);
  if (i == s_themeIdx || s_themeRestartAt) return;
  s_themeIdx = i;
  s_prefs.putInt("theme", i);
  refreshThemeButtons();
  setStatus("색을 바꾸는 중...");
  s_themeRestartAt = millis() ? millis() : 1;
}
static void onTabFind(lv_event_t *e) { showView(V_FIND); }
static void onClockTap(lv_event_t *e) { showView(s_principal ? V_WEEK : s_backView); }   // 자동 전환 전에 보던 탭(시간표·단축키)으로
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
    setStatus("학교 일정을 곧 받습니다...");
    return;
  }
  JsonObject it = s_index["items"][i];
  if (!it.isNull()) {
    if (s_pickName != (const char *)(it["name"] | "")) { s_ttLoaded = false; s_ttName = ""; }   // 다른 사람을 고르면 옛 시간표를 보이지 않는다
    s_pickName = (const char *)(it["name"] | "");
    setTTFile((const char *)(it["file"] | ""));   // 다른 파일은 처음부터 받는다
    s_prefs.putString("ttname", s_pickName);
  }
  lv_obj_add_flag(s_pickView, LV_OBJ_FLAG_HIDDEN);
  fillPicker();
  s_syncReq = true;
  setStatus("고른 시간표를 곧 받습니다...");
}
static void onPickOpen(lv_event_t *) { s_idxReq = true; s_pickPg = 0; renderPicker(); lv_obj_clear_flag(s_pickView, LV_OBJ_FLAG_HIDDEN); }
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
  lv_obj_t *logo = s_logo = box(s_top, NOW_TAG, 0, 8);                       // 호박색(빨강은 경고에만 쓴다)
  lv_obj_set_size(logo, LOGO, LOGO); lv_obj_align(logo, LV_ALIGN_LEFT_MID, M, 0);
  lv_obj_set_style_bg_grad_color(logo, lv_color_hex(0x2563eb), 0);
  lv_obj_set_style_bg_grad_dir(logo, UI_FANCY ? LV_GRAD_DIR_HOR : LV_GRAD_DIR_NONE, 0);
  lv_obj_center(label(logo, fTitle, NOW_TX, "교"));
  s_title = label(s_top, fTitle, D_TEXT, BOARD_TITLE);
  lv_obj_set_width(s_title, small ? 116 : 180);
  lv_label_set_long_mode(s_title, LV_LABEL_LONG_DOT);
  lv_obj_align(s_title, LV_ALIGN_LEFT_MID, M + LOGO + 8, 0);
  {   // Claude 사용량 두 줄: 보일 때는 로고·제목을 숨기고 그 자리(탭 앞까지)를 쓴다
    const int UW = (small ? 178 : 250) - M - 6, DY = small ? 11 : 13;
    s_useL5 = label(s_top, FM(), C_EMERALD, ""); s_useL7 = label(s_top, FM(), C_EMERALD, "");
    lv_obj_t *ul[2] = {s_useL5, s_useL7};
    for (int i = 0; i < 2; i++) {
      lv_obj_set_width(ul[i], UW); lv_label_set_long_mode(ul[i], LV_LABEL_LONG_CLIP);
      lv_obj_align(ul[i], LV_ALIGN_LEFT_MID, M, i ? DY : -DY);
      lv_obj_add_flag(ul[i], LV_OBJ_FLAG_HIDDEN);
    }
  }

  // 탭 여섯: 시간표 · 시계 · 단축키 · 사무실 · 찾기 · 설정(2026-10-25 사용자 지정 순서, 사무실은 2026-11-01 더함)
  const int TABW = small ? 56 : 74, TABH = TOP - 14;
  lv_obj_t *tabs = s_tabBox = box(s_top, D_ROW, D_LINE, 10);
  s_tabW = TABW;
  lv_obj_set_size(tabs, TABW * 6 + 5 * 2 + 8, TOP - 6); lv_obj_align(tabs, LV_ALIGN_LEFT_MID, small ? 178 : 250, 0);
  auto mkTab = [&](const char *txt, int i, bool on, lv_event_cb_t cb) {
    lv_obj_t *b = button(tabs, txt, TABW, TABH, on ? D_LINE : D_ROW, on ? D_TEXT : D_MUTED);
    lv_obj_set_pos(b, 4 + i * (TABW + 2), 3);
    lv_obj_set_style_border_width(b, 0, 0);
    lv_obj_add_event_cb(b, cb, LV_EVENT_CLICKED, nullptr);
    return b;
  };
  s_tabTT = mkTab("시간표", 0, true, onTabTT);
  s_tabClock = mkTab("시계", 1, false, onTabClock);
  s_tabDeck = mkTab("단축키", 2, false, [](lv_event_t *) { showView(V_DECK); });
  s_tabOff = mkTab("사무실", 3, false, [](lv_event_t *) { showView(V_OFF); });
  s_tabFind = mkTab("찾기", 4, false, onTabFind);
  s_tabSet = mkTab("설정", 5, false, onTabSet);
  layoutTabs();                                   // [사용량]이 꺼져 있으면 [사무실] 탭을 숨긴다


  s_wifiLbl = label(s_top, FM(), D_MUTED, LV_SYMBOL_WIFI " 연결 안 됨");   // 켤 때의 상태(경고가 아니다 → 흐린 글자)
  lv_obj_set_width(s_wifiLbl, small ? 112 : 148);   // 탭이 여섯이 되어 조금 줄임
  lv_label_set_long_mode(s_wifiLbl, LV_LABEL_LONG_DOT);
  lv_obj_set_style_text_align(s_wifiLbl, LV_TEXT_ALIGN_RIGHT, 0);
  lv_obj_align(s_wifiLbl, LV_ALIGN_RIGHT_MID, small ? -118 : -156, 0);   // 12시간 모드 "오후 3:40" 자리까지
  s_clock = label(s_top, fClock, D_TEXT, "--:--");
  lv_obj_align(s_clock, LV_ALIGN_RIGHT_MID, -M, small ? -7 : -8);
  s_date = label(s_top, FM(), D_MUTED, "");
  lv_obj_align(s_date, LV_ALIGN_RIGHT_MID, -M, small ? 13 : 16);

  {
  // ── 시간표 보기 ──
  const int VH = s_H - TOP;
  s_viewTT = box(scr, D_BG, 0, 0);
  lv_obj_set_size(s_viewTT, s_W, VH); lv_obj_set_pos(s_viewTT, 0, TOP);
  const int SH = small ? 38 : 54;                                    // 1024: 단추를 손가락 크기(46)로
  lv_obj_t *strip = box(s_viewTT, D_PANEL, D_LINE, 10);
  lv_obj_set_size(strip, s_W - 2 * M, SH); lv_obj_set_pos(strip, M, M / 2 + 2);
  s_ttSub = label(strip, fBody, D_SUB, "");
  lv_obj_set_width(s_ttSub, small ? 300 : 440); lv_label_set_long_mode(s_ttSub, LV_LABEL_LONG_DOT);
  lv_obj_align(s_ttSub, LV_ALIGN_LEFT_MID, 12, 0);
  const int BH = SH - 8, AW = small ? 40 : 56;
  lv_obj_t *bNow = button(strip, "이번 주", small ? 64 : 80, BH, D_ROW, D_TEXT);
  lv_obj_align(bNow, LV_ALIGN_RIGHT_MID, -4, 0);
  lv_obj_add_event_cb(bNow, onThisWeek, LV_EVENT_CLICKED, nullptr);
  lv_obj_t *bNext = button(strip, LV_SYMBOL_RIGHT, AW, BH, D_ROW, D_TEXT);
  lv_obj_align_to(bNext, bNow, LV_ALIGN_OUT_LEFT_MID, -6, 0);
  lv_obj_add_event_cb(bNext, onNext, LV_EVENT_CLICKED, nullptr);
  s_weekLbl = label(strip, fBody, D_TEXT, "");
  lv_obj_set_width(s_weekLbl, small ? 150 : 190); lv_obj_set_style_text_align(s_weekLbl, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_align_to(s_weekLbl, bNext, LV_ALIGN_OUT_LEFT_MID, -4, 0);
  lv_obj_t *bPrev = button(strip, LV_SYMBOL_LEFT, AW, BH, D_ROW, D_TEXT);
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
      s_cellAOff = small ? -8 : -9;
      s_cellB[d][p] = label(c, FM(), C_LIGHT, "");
      lv_label_set_long_mode(s_cellB[d][p], LV_LABEL_LONG_DOT); lv_obj_set_width(s_cellB[d][p], CW - 14);
      lv_obj_set_style_text_align(s_cellB[d][p], LV_TEXT_ALIGN_CENTER, 0);
      lv_obj_align(s_cellB[d][p], LV_ALIGN_CENTER, 0, small ? 10 : 13);
      s_cellTag[d][p] = label(c, &kr14, 0xffffff, "");
      lv_obj_set_style_bg_opa(s_cellTag[d][p], LV_OPA_COVER, 0);
      lv_obj_set_style_bg_color(s_cellTag[d][p], lv_color_hex(0xc2410c), 0);
      lv_obj_set_style_radius(s_cellTag[d][p], RP(6), 0);
      lv_obj_set_style_pad_hor(s_cellTag[d][p], 3, 0);
      lv_obj_align(s_cellTag[d][p], LV_ALIGN_TOP_RIGHT, -3, 3);
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
  s_bigGlow = label(left, FNIX(false), NIX_GLOW, "--:--");          // 닉시 빛(심지 글자 아래). 켜고 끄기는 applyNixie
  lv_obj_set_style_pad_hor(s_bigGlow, FNIX(false)->base_line, 0);
  s_secGlow = label(left, FNIXS(false), NIX_GLOW, "");
  lv_label_set_text_static(s_secGlow, s_secTxt);                    // 초는 setTextIf 를 쓰지 않는다(nixSecShow)
  lv_obj_set_style_pad_hor(s_secGlow, FNIXS(false)->base_line, 0);
  s_sec = label(left, FNIXS(true), NIX_CORE, "");
  lv_label_set_text_static(s_sec, s_secTxt);
  lv_obj_set_style_pad_hor(s_sec, FNIXS(true)->base_line, 0);
  s_big = label(left, FCLK(), D_TEXT, "--:--");
  s_bigAmPm = label(left, &kr28, D_SUB, "");
  lv_obj_add_flag(s_bigAmPm, LV_OBJ_FLAG_HIDDEN);
  s_bigDate = label(left, &kr28, D_SUB, "");
  lv_obj_set_style_text_align(s_bigDate, LV_TEXT_ALIGN_CENTER, 0);
  s_stale = label(left, FM(), C_WARN, "");                          // 자리는 layoutClock(날짜와 카드 사이 빈 줄)
  lv_obj_set_style_text_align(s_stale, LV_TEXT_ALIGN_CENTER, 0);
  lv_label_set_long_mode(s_stale, LV_LABEL_LONG_DOT);                 // 한 줄(카드 위로 넘치지 않게)
  lv_obj_add_flag(s_stale, LV_OBJ_FLAG_HIDDEN);
  s_useClk = box(left, D_PANEL, 0, 0);                               // Claude 사용량 막대 두 줄(자리는 layoutClock)
  lv_obj_set_style_bg_opa(s_useClk, LV_OPA_TRANSP, 0); lv_obj_clear_flag(s_useClk, LV_OBJ_FLAG_CLICKABLE);
  useRowMake(s_ucRow[0], s_useClk, FM()); useRowMake(s_ucRow[1], s_useClk, FM());
  lv_obj_add_flag(s_useClk, LV_OBJ_FLAG_HIDDEN);
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
  s_duty = label(ic, FM(), C_DUTY, "");
  lv_label_set_long_mode(s_duty, LV_LABEL_LONG_DOT);
  s_infoHr = box(ic, D_LINE, 0, 0);
  s_mealTitle = label(ic, FM(), D_MUTED, "점심");
  s_meal = label(ic, FM(), D_SUB, "");
  lv_obj_set_style_text_line_space(s_meal, 6, 0);   // 반찬이 두 줄일 때 읽기 좋게
  lv_label_set_long_mode(s_meal, LV_LABEL_LONG_DOT);
  s_kcal = label(ic, FM(), D_MUTED, "");

  // 맨 아래: 수업 10분 전부터 '다음 수업' 띠
#if UI_SOFT   // '다음' = 노란 테두리(오른쪽 '다음 수업' 줄과 같은 뜻). 빨강 바탕은 경고처럼 읽혀서 쓰지 않는다
  s_notice = box(left, D_ROW, NEXT_BD, 18);
  lv_obj_set_style_border_width(s_notice, 2, 0);
  const uint32_t noticeTx = D_TEXT;
#else
  s_notice = box(left, C_PRIMARY, 0, 18);
  const uint32_t noticeTx = 0xffffff;
#endif
  lv_obj_clear_flag(s_notice, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_set_style_bg_grad_color(s_notice, lv_color_hex(0x3730a3), 0);
  lv_obj_set_style_bg_grad_dir(s_notice, UI_FANCY ? LV_GRAD_DIR_HOR : LV_GRAD_DIR_NONE, 0);
  s_noticeLbl = label(s_notice, big() ? &kr20 : &kr16, noticeTx, "");   // 1024: 3m 에서 읽히게 한 단계 크게
  lv_label_set_long_mode(s_noticeLbl, LV_LABEL_LONG_DOT);
  lv_obj_set_style_text_align(s_noticeLbl, LV_TEXT_ALIGN_CENTER, 0);
  lv_obj_add_flag(s_notice, LV_OBJ_FLAG_HIDDEN);

  // 오른쪽: 오늘 시간표. 제목 아래 8줄(1~4교시·점심·5~7교시), 줄 간격 50.
  const int RX = CM + LW + CM, RW = s_W - RX - CM;
  lv_obj_t *right = s_right = box(s_viewClock, D_PANEL, D_LINE, 16);
  lv_obj_clear_flag(right, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_set_size(right, RW, PH); lv_obj_set_pos(right, RX, CM);
  s_rightW = RW;
  s_dayTitle = label(right, big() ? &kr20 : &kr16, D_TEXT, "");
  lv_obj_set_style_max_width(s_dayTitle, RW - S(28), 0);             // 폭 상한은 renderToday 가 꼬리표·D-day 를 보고 다시 정한다
  lv_label_set_long_mode(s_dayTitle, LV_LABEL_LONG_DOT);
  lv_obj_set_pos(s_dayTitle, S(16), S(14));
  s_dayTag = label(right, FM(), 0x991b1b, "");
  lv_obj_set_style_border_color(s_dayTag, lv_color_hex(NOW_TAG), 0);   // 시험 꼬리표만 테두리(두께는 renderToday)
  lv_obj_set_style_border_width(s_dayTag, 0, 0);
  lv_obj_set_style_bg_opa(s_dayTag, LV_OPA_COVER, 0);
  lv_obj_set_style_bg_color(s_dayTag, lv_color_hex(0xfee2e2), 0);
  lv_obj_set_style_radius(s_dayTag, RP(10), 0);
  lv_obj_set_style_pad_hor(s_dayTag, 8, 0);
  lv_obj_align(s_dayTag, LV_ALIGN_TOP_RIGHT, -S(12), S(12));
  lv_obj_add_flag(s_dayTag, LV_OBJ_FLAG_HIDDEN);
  s_dday = label(right, FM(), C_DUTY, "");                         // 수능·시험 D-day. 짙은 빨강은 '문제 있음'으로 읽혀서 호박색 테두리로
  lv_obj_set_style_bg_opa(s_dday, LV_OPA_COVER, 0);
  lv_obj_set_style_bg_color(s_dday, lv_color_hex(D_ROW), 0);
  lv_obj_set_style_border_width(s_dday, 1, 0);
  lv_obj_set_style_border_color(s_dday, lv_color_hex(NOW_TAG), 0);
  lv_obj_set_style_radius(s_dday, RP(11), 0);
  lv_obj_set_style_pad_hor(s_dday, 10, 0);
  lv_obj_set_style_pad_ver(s_dday, 2, 0);
  lv_obj_align(s_dday, LV_ALIGN_TOP_RIGHT, -S(12), S(11));
  lv_obj_add_flag(s_dday, LV_OBJ_FLAG_HIDDEN);
  const int ROW_Y0 = S(44), ROW_X = S(12), ROW_W = RW - 2 * ROW_X;
  const int ROW_PITCH = (PH - ROW_Y0 - S(12)) / 8, ROW_H = ROW_PITCH - S(6), PW = big() ? S(76) : S(64);   // 1024: 교시 칸을 넓혀 '45분'을 크게
  s_rowW = ROW_W; s_rowPW = PW;
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
    if (big()) {   // 지금 줄에서만 보이는 큰 남은 시간(위 '3교시' 아래 '45분')
      s_rowRem[r] = label(s_rowP[r], &kr20, NOW_TX, "");
      lv_obj_align(s_rowRem[r], LV_ALIGN_BOTTOM_MID, 0, -1);
      lv_obj_add_flag(s_rowRem[r], LV_OBJ_FLAG_HIDDEN);
    }
    // 과목은 왼쪽 정렬, 교실은 오른쪽 정렬(세로로 줄이 맞게), 꼬리표는 과목 바로 뒤
    s_rowA[r] = label(s_row[r], big() ? &kr20 : &kr16, D_TEXT, "");   // 1024: 과목을 한 단계 크게(3m 에서 읽히게)
    lv_obj_set_width(s_rowA[r], LV_SIZE_CONTENT);
    lv_obj_set_style_max_width(s_rowA[r], S(150), 0);
    lv_label_set_long_mode(s_rowA[r], LV_LABEL_LONG_DOT);
    lv_obj_align(s_rowA[r], LV_ALIGN_LEFT_MID, PW + S(18), 0);
    s_rowB[r] = label(s_row[r], FM(), D_SUB, "");
    lv_obj_set_width(s_rowB[r], S(110)); lv_label_set_long_mode(s_rowB[r], LV_LABEL_LONG_DOT);
    lv_obj_set_style_text_align(s_rowB[r], LV_TEXT_ALIGN_RIGHT, 0);
    lv_obj_align(s_rowB[r], LV_ALIGN_RIGHT_MID, -S(14), 0);
    s_rowTag[r] = label(s_row[r], FM(), 0xffffff, "");               // 보강·지도·시험 꼬리표: 3m 에서 읽혀야 해서 1024 는 한 단계 크게
    lv_obj_set_style_bg_opa(s_rowTag[r], LV_OPA_COVER, 0);
    lv_obj_set_style_bg_color(s_rowTag[r], lv_color_hex(0xc2410c), 0);   // 흰 글자와 명암비 5.2:1
    lv_obj_set_style_radius(s_rowTag[r], RP(6), 0);
    lv_obj_set_style_pad_hor(s_rowTag[r], big() ? 8 : 5, 0);
    if (big()) lv_obj_set_style_pad_ver(s_rowTag[r], 2, 0);
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
  /// ── 설정 보기 ──
  const int VH = s_H - TOP;
  s_viewSet = box(scr, C_BG, 0, 0);
  lv_obj_set_size(s_viewSet, s_W, VH); lv_obj_set_pos(s_viewSet, 0, TOP);
  lv_obj_add_flag(s_viewSet, LV_OBJ_FLAG_HIDDEN);
  const int WBW = (s_W - 3 * M) * 50 / 100, OBW = s_W - 3 * M - WBW, BOXH = VH - 2 * M;   // 반반(오른쪽에 시계 설정 단추가 많다)
  const int BTH = small ? 34 : 46;                                   // 설정 단추 높이(1024 는 손가락 크기)
  lv_obj_t *wbox = box(s_viewSet, C_SURF, C_BORDER, 10);
  lv_obj_set_size(wbox, WBW, BOXH); lv_obj_set_pos(wbox, M, M);
  lv_obj_set_pos(label(wbox, fTitle, C_TEXT, "와이파이"), 12, 10);
  lv_obj_t *bScan = button(wbox, "찾기", small ? 90 : 110, BTH, D_ROW, D_TEXT);   // 주단추: 어두운 바탕 + 호박색 테두리(빨강은 지우기·경고에만)
  lv_obj_set_style_border_color(bScan, lv_color_hex(NOW_TAG), 0);
  lv_obj_align(bScan, LV_ALIGN_TOP_RIGHT, -10, 8); lv_obj_add_event_cb(bScan, onScan, LV_EVENT_CLICKED, nullptr);
  const int PCW = small ? 110 : 140;
  s_pcBtn = button(wbox, "컴퓨터만", PCW, BTH, C_ALT, C_MUTED);   // 와이파이 없는 곳: 켜면 컴퓨터(탭덱)만으로 쓴다
  lv_obj_align(s_pcBtn, LV_ALIGN_TOP_RIGHT, -(10 + (small ? 90 : 110) + 8), 8);
  lv_obj_add_event_cb(s_pcBtn, onPcOnly, LV_EVENT_CLICKED, nullptr);
  segStyle(s_pcBtn, s_pcOnly);
  s_useBtn = button(wbox, "사용량", small ? 80 : 110, BTH, C_ALT, C_MUTED);   // Claude 사용량을 위쪽 막대에 보이기(켜고 끄기)
  lv_obj_align(s_useBtn, LV_ALIGN_TOP_RIGHT, -(10 + (small ? 90 : 110) + 8 + PCW + 8), 8);
  lv_obj_add_event_cb(s_useBtn, onUseBtn, LV_EVENT_CLICKED, nullptr);
  segStyle(s_useBtn, s_useOn);
  renderUse();                                       // 화면 색을 바꿔 다시 그려도 받아 둔 사용량을 바로 보인다
  // 준비 상태 점검표: 제목·[찾기] 아래 넓게(4줄). 넘치면 잘린다(목록 위로 겹치지 않게)
  const int IY = 8 + BTH + 6, LY = IY + (small ? 74 : 82) + 6, FH = small ? 30 : 46;
  s_wifiInfo = label(wbox, FM(), C_MUTED, "");
  lv_obj_set_size(s_wifiInfo, WBW - 24, LY - IY - 4); lv_label_set_long_mode(s_wifiInfo, LV_LABEL_LONG_WRAP);
  lv_obj_set_pos(s_wifiInfo, 12, IY);
  s_wifiList = lv_list_create(wbox);
  lv_obj_clear_flag(s_wifiList, LV_OBJ_FLAG_SCROLL_MOMENTUM | LV_OBJ_FLAG_SCROLL_ELASTIC);   // 밀어도 미끄러지지 않게(딱딱)
  lv_obj_set_size(s_wifiList, WBW - 24, BOXH - LY - FH - 16); lv_obj_set_pos(s_wifiList, 12, LY);
  lv_obj_set_style_text_font(s_wifiList, fBody, 0);
  lv_obj_t *bForget = s_forgetBtn = button(wbox, FORGET_TXT, small ? 190 : 220, FH, C_ALT, C_MUTED);
  lv_obj_align(bForget, LV_ALIGN_BOTTOM_LEFT, 12, -8); lv_obj_add_event_cb(bForget, onForget, LV_EVENT_CLICKED, nullptr);
  s_rebootBtn = button(wbox, REBOOT_TXT, small ? 120 : 150, FH, C_ALT, C_MUTED);   // 3초 안에 두 번 누르면 다시 켠다
  lv_obj_align(s_rebootBtn, LV_ALIGN_BOTTOM_RIGHT, -12, -8); lv_obj_add_event_cb(s_rebootBtn, onReboot, LV_EVENT_CLICKED, nullptr);

  lv_obj_t *obox = box(s_viewSet, C_SURF, C_BORDER, 10);
  lv_obj_set_size(obox, OBW, BOXH); lv_obj_set_pos(obox, 2 * M + WBW, M);
  lv_obj_set_pos(label(obox, fTitle, C_TEXT, "볼 시간표"), 12, 10);
  const int PY = small ? 40 : 46;
  s_ttPick = button(obox, BOARD_DEFAULT_TT "  " LV_SYMBOL_RIGHT, OBW - 24, BTH, C_SURF, C_TEXT);   // 누르면 단추 판
  lv_obj_set_style_border_color(s_ttPick, lv_color_hex(C_BORDER), 0);
  lv_obj_set_pos(s_ttPick, 12, PY);
  lv_obj_add_event_cb(s_ttPick, onPickOpen, LV_EVENT_CLICKED, nullptr);
  lv_obj_t *bSync = button(obox, "지금 받기", OBW - 24, BTH, D_ROW, D_TEXT);
  lv_obj_set_style_border_color(bSync, lv_color_hex(NOW_TAG), 0);
  lv_obj_set_pos(bSync, 12, PY + BTH + (small ? 14 : 8));
  lv_obj_add_event_cb(bSync, [](lv_event_t *) {
    if (s_pcOnly) { s_syncReq = true; setStatus("컴퓨터에 부탁합니다..."); return; }
    if (!s_prefs.getString("ssid", "").length()) { setStatus("먼저 [찾기]에서 와이파이를 고르세요"); return; }
    s_wifiFails = 0; s_lastWifiKind = 0;               // 비밀번호·공유기 실패 횟수도 처음부터
    if (s_failKind == FK_AUTH || s_failKind == FK_NOAP) s_failKind = FK_NONE;   // 사람이 다시 해 보라고 눌렀다 → 잠김을 푼다
    s_syncReq = true; setStatus("곧 연결합니다..."); }, LV_EVENT_CLICKED, nullptr);
  s_status = label(obox, FM(), C_MUTED, "");
  lv_obj_set_width(s_status, OBW - 24); lv_label_set_long_mode(s_status, LV_LABEL_LONG_WRAP);
  lv_obj_set_pos(s_status, 12, PY + 2 * BTH + (small ? 20 : 14));
  // 시계 화면 설정: 고르는 단추(켜진 것은 빨강). 바꾸면 바로 저장되고 시계에 바로 반영된다.
  {
    const int SY = small ? 172 : 192, RH2 = small ? 30 : 44, GAP = small ? 6 : 8, LBW = small ? 66 : 92, BW2 = (OBW - 24 - LBW - 12) / 3;
    lv_obj_set_pos(label(obox, fTitle, C_TEXT, "시계 화면"), 12, SY);
    const int Y1 = SY + (small ? 30 : 34), Y2 = Y1 + RH2 + GAP + (small ? 2 : 0);
    lv_obj_set_pos(label(obox, FM(), C_MUTED, "시간 표시"), 12, Y1 + (RH2 - lv_font_get_line_height(FM())) / 2);
    lv_obj_set_pos(label(obox, FM(), C_MUTED, "시계로 전환"), 12, Y2 + (RH2 - lv_font_get_line_height(FM())) / 2);
    static const char *FMT[2] = {"24시간", "12시간"};
    static const char *AUTO[3] = {"20분 뒤", "5분 뒤", "안 함"};
    for (int i = 0; i < 2; i++) {
      s_fmtBtn[i] = button(obox, FMT[i], BW2, RH2, C_ALT, C_MUTED);
      lv_obj_set_pos(s_fmtBtn[i], 12 + LBW + i * (BW2 + 6), Y1);
      lv_obj_add_event_cb(s_fmtBtn[i], onFmtPick, LV_EVENT_CLICKED, (void *)(intptr_t)i);
    }
    s_nixBtn = button(obox, "닉시", BW2, RH2, C_ALT, C_MUTED);      // 닉시관 느낌 숫자 + 초(누를 때마다 켜짐/꺼짐)
    lv_obj_set_pos(s_nixBtn, 12 + LBW + 2 * (BW2 + 6), Y1);
    lv_obj_add_event_cb(s_nixBtn, onNixBtn, LV_EVENT_CLICKED, nullptr);
    for (int i = 0; i < 3; i++) {
      s_autoBtn[i] = button(obox, AUTO[i], BW2, RH2, C_ALT, C_MUTED);
      lv_obj_set_pos(s_autoBtn[i], 12 + LBW + i * (BW2 + 6), Y2);
      lv_obj_add_event_cb(s_autoBtn[i], onAutoPick, LV_EVENT_CLICKED, (void *)(intptr_t)i);
    }
    refreshClockSettings();
    // 보이기: 켜진 것은 빨강. 끄면 그 자리를 남은 것이 쓴다. (교장 모드에서는 숨긴다 — fillPicker)
    const int Y3 = Y2 + RH2 + GAP + (small ? 2 : 0), Y4 = Y3 + RH2 + GAP;
    s_showLbl = label(obox, FM(), C_MUTED, "보이기");
    lv_obj_set_pos(s_showLbl, 12, Y3 + (RH2 - lv_font_get_line_height(FM())) / 2);
    static const char *SHOW[6] = {"날씨", "미세먼지", "할 일", "급식", "시간표", "D-day"};
    for (int i = 0; i < 6; i++) {
      s_showBtn[i] = button(obox, SHOW[i], BW2, RH2, C_ALT, C_MUTED);
      lv_obj_set_pos(s_showBtn[i], 12 + LBW + (i % 3) * (BW2 + 6), i < 3 ? Y3 : Y4);
      lv_obj_add_event_cb(s_showBtn[i], onShowPick, LV_EVENT_CLICKED, (void *)(intptr_t)i);
    }
    refreshShowButtons();
    // 화면 색: 단추 5개. 단추 바탕·글자·밑줄이 그 테마의 시계 화면 색(견본). 고른 것은 굵은 테두리
    const int Y5 = Y4 + RH2 + GAP, TH = small ? 30 : 36, TLW = small ? 52 : LBW, TG = small ? 4 : 6;
    const int TBW = (OBW - 24 - TLW - (small ? 4 : 12) - 4 * TG) / THEME_N;
    lv_obj_set_pos(label(obox, FM(), C_MUTED, "화면 색"), 12, Y5 + (TH - lv_font_get_line_height(FM())) / 2);
    for (int i = 0; i < THEME_N; i++) {
      const Theme *keep = s_th; s_th = &THEMES[i];            // 이름이 매크로라 잠깐 바꿔 그 테마 색을 읽는다
      const uint32_t tBg = D_BG, tTx = D_TEXT, tTag = NOW_TAG; s_th = keep;
      lv_obj_t *b = s_themeBtn[i] = button(obox, THEMES[i].name, TBW, TH, tBg, tTx);
      lv_obj_set_pos(b, 12 + TLW + (small ? 4 : 12) + i * (TBW + TG), Y5);
      lv_obj_set_style_pad_all(b, 0, 0);
      lv_obj_t *l = lv_obj_get_child(b, 0);
      lv_obj_set_style_text_font(l, &kr14, 0);
      lv_obj_align(l, LV_ALIGN_CENTER, 0, -2);
      lv_obj_t *bar = box(b, tTag, 0, 0);                 // 강조색 밑줄
      lv_obj_set_size(bar, TBW - 16, 4); lv_obj_align(bar, LV_ALIGN_BOTTOM_MID, 0, -3);
      lv_obj_clear_flag(bar, LV_OBJ_FLAG_CLICKABLE);
      lv_obj_add_event_cb(b, onThemePick, LV_EVENT_CLICKED, (void *)(intptr_t)i);
    }
    refreshThemeButtons();
  }
  {   // 버전 줄: 빌드 날짜 · 기기 번호(보드마다 다름) · 화면 크기. 1024 는 지난번 다시 켜진 이유도
    lv_obj_t *ver = label(obox, &kr14, C_LIGHT, "");
    lv_obj_set_width(ver, OBW - 24); lv_label_set_long_mode(ver, LV_LABEL_LONG_WRAP);
    static const char *MON = "JanFebMarAprMayJunJulAugSepOctNovDec";
    const char *dt = __DATE__;   // "Oct 25 2026"
    const char *mp = strstr(MON, String(dt).substring(0, 3).c_str());
    const int mon = mp ? (int)(mp - MON) / 3 + 1 : 0, day = atoi(dt + 4);
    const unsigned id = (unsigned)((ESP.getEfuseMac() >> 32) & 0xFFFF);
    if (big()) lv_label_set_text_fmt(ver, "교실 알림판 v%s · %d/%d 빌드 · 기기 %04X · %dx%d\n지난번 다시 켜짐: %s · 멈춘 횟수 %d", FW_VERSION, mon, day, id, s_W, s_H, s_resetWhy, s_crashN);
    else lv_label_set_text_fmt(ver, "교실 알림판 v%s · %d/%d 빌드 · 기기 %04X · %dx%d", FW_VERSION, mon, day, id, s_W, s_H);
    lv_obj_align(ver, LV_ALIGN_BOTTOM_LEFT, 12, -10);
  }

  applyNixie();                                    // 닉시 시계(설정 [닉시])
  layoutClock();                                     // 시계 화면 자리 잡기(설정 '보이기' 반영)
  buildFinder(scr, TOP);
  buildDeck(scr, TOP);   // 단축키 화면(숨김)
  buildOffice(scr, TOP); // 사무실 화면(숨김)

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
  lv_obj_add_event_cb(s_pwBg, pwBgTap, LV_EVENT_CLICKED, nullptr);
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

// 화면 색을 바꿀 때: 보드를 다시 켜지 않고 화면 물체만 새 색으로 다시 만든다.
// 다시 켜면 시계 칩이 없어 시각을 맞추려고 와이파이로 다시 받게 된다(사용자 지적: "테마는 색만 바꾸면 되는데", 2026-10-26).
// 받은 자료(시간표·날씨·급식·일정)와 와이파이·시각은 그대로 두고, setup 의 그리기 순서를 다시 돈다.
static void rebuildUi() {
  const View v = s_view;
  const uint32_t t0 = millis();
  lock();
  s_th = &THEMES[s_themeIdx];
  if (s_deckHelp) { lv_obj_del(s_deckHelp); s_deckHelp = nullptr; }   // 맨 위 층의 안내 창은 옛 색이라 지운다
  lv_obj_clean(lv_scr_act());
  buildUI();
  s_batPct = -99; s_lastMin = -1;                        // 배터리·시계 글을 다음 바퀴에 다시 쓰게
  s_findGridDirty = true; s_weekDirty = true; s_todayDirty = true; s_ttLayoutDirty = true;
  renderWeather(); renderMeal(); renderAir();
  fillFinderGrid(); renderFinder();
  fillPicker();
  renderTT();
  refreshWifiLabel();
  showView(v);
  refreshStale();
  unlock();
  Serial.printf("theme %d applied (%ums, no restart)\n", s_themeIdx, (unsigned)(millis() - t0));
}

// ── 컴퓨터가 대신 받아 주기 (설정 '컴퓨터만') ──
// 보드 → 컴퓨터: '@get 이름 주소' · 컴퓨터 → 보드: '@fbegin 이름 크기 crc' → '@fdata 이름 번호 base64'(조각마다 답) → '@fend 이름'
// 받지 못하면 '@fnone 이름 코드'. 받은 파일은 와이파이 받기와 같은 자리·같은 읽기로 반영한다.
static String pcUrl(const char *id) {
  if (!strcmp(id, "idx")) return urlUnset() ? "" : String(BASE_URL) + "index.json";
  if (!strcmp(id, "tt")) return (urlUnset() || s_principal || s_pickMissing || !s_ttFile.length()) ? "" : String(BASE_URL) + s_ttFile;
  if (!strcmp(id, "whr")) return urlUnset() ? "" : String(BASE_URL) + "where.json";
  if (!strcmp(id, "wx")) return HAS_WX ? String(WX_URL) : "";
  if (!strcmp(id, "air")) return HAS_WX ? String(AIR_URL) : "";
  if (!strcmp(id, "sch")) return (s_principal && cfgSet(SCHEDULE_URL)) ? String(SCHEDULE_URL) : "";   // 교장실: 학교 일정 사이트
  if (!strcmp(id, "meal")) {
    String d = todayIso(); if (!HAS_MEAL || !d.length()) return "";
    if (s_mealDate == d && (s_mLunch.length() || s_mDinner.length())) return "";   // 오늘 메뉴는 이미 있다
    String ymd = d; ymd.replace("-", ""); return String(MEAL_URL) + ymd;
  }
  return "";
}
static const char *pcDst(const char *id) {
  return !strcmp(id, "idx") ? "/index.json" : !strcmp(id, "tt") ? "/tt.json" : !strcmp(id, "whr") ? "/where.json"
       : !strcmp(id, "wx") ? "/wx.json" : !strcmp(id, "air") ? "/air.json" : "/meal.json";
}
// 다 받은 /pc.tmp 를 검사하고, 맞으면 제자리로 옮겨 읽는다
static bool pcfApply(const char *id) {
  bool ok = false;
  if (!strcmp(id, "tt")) {
    File r = LittleFS.open("/pc.tmp", "r");
    JsonDocument probe(&s_alloc);
    ok = r && !deserializeJson(probe, r);
    if (r) r.close();
    if (ok) { LittleFS.remove("/tt.json"); ok = LittleFS.rename("/pc.tmp", "/tt.json") && loadTTFromFile(); etagForget("et_tt"); }
  } else {
    File r = LittleFS.open("/pc.tmp", "r");
    if (!r) return false;
    String all = r.readString(); r.close();
    if (!strcmp(id, "idx")) { ok = parseIndex(all); s_idxSame = false; }
    else if (!strcmp(id, "whr")) { ok = parseWhere(all); s_whereSame = false; }
    else if (!strcmp(id, "wx")) { ok = parseWeather(all); if (ok && timeValid()) s_wxAt = time(nullptr); }
    else if (!strcmp(id, "air")) { ok = parseAir(all); if (ok && timeValid()) s_airAt = time(nullptr); }
    else if (!strcmp(id, "sch")) { ok = parseSchedule(all); if (ok) { LittleFS.remove("/pc.tmp"); return true; } }   // 꺼낸 일정은 parseSchedule 이 /sched.json 에 둔다
    else if (!strcmp(id, "meal")) {
      const int nl = all.indexOf('\n');
      ok = nl > 0 && parseMeal(all.substring(nl + 1), all.substring(0, nl));
      if (ok) { s_mealOk = true; s_mealCached = false; }
    }
    if (ok) { const char *dst = pcDst(id); LittleFS.remove(dst); ok = LittleFS.rename("/pc.tmp", dst); }
  }
  if (!ok) LittleFS.remove("/pc.tmp");
  return ok;
}
static bool pcfLine(char *buf, uint32_t ms) {
  if (strncmp(buf, "@f", 2) || !(!strncmp(buf, "@fbegin ", 8) || !strncmp(buf, "@fdata ", 7) || !strncmp(buf, "@fend ", 6) || !strncmp(buf, "@fnone ", 7))) return false;
  s_pcLast = ms ? ms : 1; s_usbSeen = true; s_pcActAt = ms;
  const bool mine = s_pcStep >= 0 && s_pcStep < s_pcN;
  char id[8] = "";
  if (!strncmp(buf, "@fbegin ", 8)) {
    unsigned long len = 0; char cs[16] = "";
    if (sscanf(buf + 8, "%7s %lu %15s", id, &len, cs) != 3) return true;
    if (!mine || strcmp(id, s_pcId[s_pcStep]) || len == 0 || len > 400000UL) { Serial.printf("\n@fbegin fail %s\n", id); return true; }
    if (s_pcFile) s_pcFile.close();
    s_pcFile = LittleFS.open("/pc.tmp", "w");
    if (!s_pcFile) { Serial.printf("\n@fbegin fail %s\n", id); return true; }
    if (!strcmp(id, "meal")) { s_pcMealDate = todayIso(); s_pcFile.print(s_pcMealDate + "\n"); }   // 급식 파일은 첫 줄이 날짜
    s_pcLen = 0; s_pcWant = len; s_pcCrc = 0; s_pcWantCrc = strtoul(cs, nullptr, 16); s_pcSeq = -1; s_pcGotBegin = true;
    Serial.printf("\n@fbegin ok %s\n", id);
  } else if (!strncmp(buf, "@fdata ", 7)) {
    int seq = -1, off = 0;
    if (sscanf(buf + 7, "%7s %d %n", id, &seq, &off) < 2 || off <= 0) return true;
    if (!mine || strcmp(id, s_pcId[s_pcStep]) || !s_pcFile) { Serial.printf("\n@fdata err %s %d state\n", id, seq); return true; }
    if (seq == s_pcSeq) { Serial.printf("\n@fdata ok %s %d\n", id, seq); return true; }   // 답이 사라져 다시 온 것
    if (seq != s_pcSeq + 1) { Serial.printf("\n@fdata err %s %d seq\n", id, seq); return true; }
    static uint8_t dec[256]; size_t olen = 0;
    const char *b64 = buf + 7 + off;
    if (mbedtls_base64_decode(dec, sizeof dec, &olen, (const unsigned char *)b64, strlen(b64)) != 0 || s_pcLen + olen > s_pcWant) { Serial.printf("\n@fdata err %s %d b64\n", id, seq); return true; }
    if (s_pcFile.write(dec, olen) != olen) { Serial.printf("\n@fdata err %s %d write\n", id, seq); return true; }
    s_pcCrc = esp_rom_crc32_le(s_pcCrc, dec, olen); s_pcLen += olen; s_pcSeq = seq;
    Serial.printf("\n@fdata ok %s %d\n", id, seq);
  } else if (!strncmp(buf, "@fend ", 6)) {
    sscanf(buf + 6, "%7s", id);
    if (!mine || strcmp(id, s_pcId[s_pcStep]) || !s_pcFile) { Serial.printf("\n@fend bad %s state\n", id); return true; }
    s_pcFile.close();
    if (s_pcLen != s_pcWant || s_pcCrc != s_pcWantCrc) { LittleFS.remove("/pc.tmp"); Serial.printf("\n@fend bad %s %s\n", id, s_pcLen != s_pcWant ? "size" : "crc"); return true; }
    const bool ok = pcfApply(id);
    Serial.printf("pcget %s -> %s (%u bytes)\n", id, ok ? "ok" : "bad", (unsigned)s_pcWant);
    s_pcDone = true; s_pcRes = ok;
    Serial.printf("\n@fend %s %s\n", ok ? "done" : "bad", id);
  } else {   // @fnone 이름 코드
    int code = 0; sscanf(buf + 7, "%7s %d", id, &code);
    if (mine && !strcmp(id, s_pcId[s_pcStep])) { Serial.printf("pcget %s -> none (%d)\n", id, code); s_pcDone = true; s_pcRes = false; }
  }
  return true;
}
// 한 바퀴가 끝났다: 화면에 반영하고 기록을 남긴다
static void pcFinish() {
  bool tt = false, wx = false, meal = false, air = false, whr = false, idx = false, sch = false, any = false; int nGood = 0;
  for (int i = 0; i < s_pcN; i++) {
    const char *id = s_pcId[i];
    if (!s_pcGood[i]) continue;
    any = true; nGood++;
    if (!strcmp(id, "tt")) tt = true; else if (!strcmp(id, "wx")) wx = true; else if (!strcmp(id, "meal")) meal = true;
    else if (!strcmp(id, "air")) air = true; else if (!strcmp(id, "whr")) whr = true; else if (!strcmp(id, "idx")) idx = true;
    else if (!strcmp(id, "sch")) sch = true;
  }
  for (int i = 0; i < s_pcN; i++) {
    const char *id = s_pcId[i];
    const int k = !strcmp(id, "tt") ? OK_TT : !strcmp(id, "wx") ? OK_WX : !strcmp(id, "meal") ? OK_MEAL : !strcmp(id, "air") ? OK_AIR : !strcmp(id, "whr") ? OK_WHR : !strcmp(id, "sch") ? OK_SCH : -1;
    if (k >= 0) okMark(k, s_pcGood[i], "컴퓨터");
  }
  lock();
  if (tt) s_week = -1;
  if (idx) fillPicker();
  if (s_blOff) { if (tt || wx || meal || air || sch) s_renderPending = true; if (whr) s_findGridDirty = true; if (sch && s_pDetail) lv_obj_add_flag(s_pDetail, LV_OBJ_FLAG_HIDDEN); }
  else {
    if (tt) renderTT(); if (wx) renderWeather(); if (meal) renderMeal(); if (air) renderAir(); if (whr) { fillFinderGrid(); renderFinder(); }
    if (s_principal) { if (sch && s_pDetail) lv_obj_add_flag(s_pDetail, LV_OBJ_FLAG_HIDDEN); renderPrincipal(); renderSchedList(); if (s_pTeach && !lv_obj_has_flag(s_pTeach, LV_OBJ_FLAG_HIDDEN)) renderTeach(); }
  }
  unlock();
  const bool ok = any;
  bool miss = false;   // 부탁했는데 못 받은 것이 있으면(급식은 아직 안 올라왔을 수 있어 뺀다) 한 시간을 기다리지 않고 곧 다시
  for (int i = 0; i < s_pcN; i++) if (s_pcAsk[i] && !s_pcGood[i] && strcmp(s_pcId[i], "meal")) miss = true;
  s_pcMissN = miss ? min(s_pcMissN + 1, 5) : 0;
  s_triedOnce = true; s_lastOk = ok; s_lastSync = millis();
  s_failCount = ok ? 0 : s_failCount + 1;
  if (ok) s_failKind = FK_NONE; else s_failKind = FK_NET;
  if (timeValid()) { time_t t = time(nullptr); struct tm tm; localtime_r(&t, &tm); snprintf(s_lastHM, sizeof s_lastHM, "%02d:%02d", tm.tm_hour, tm.tm_min); }
  if (ok) memcpy(s_lastOkHM, s_lastHM, sizeof s_lastOkHM);
  if (ok && timeValid()) { s_lastOkT = time(nullptr); s_prefs.putULong("lastok", (uint32_t)s_lastOkT); }
  Serial.printf("sync: pc %s (%d/%d)\n", ok ? "ok" : "fail", nGood, s_pcN);
  lock(); refreshWifiLabel(); setStatus(ok ? "컴퓨터가 받아 준 자료를 반영했습니다." : "컴퓨터에서 받지 못했습니다. 컴퓨터의 인터넷을 확인하세요."); refreshStale(); unlock();
  s_pcStep = -1;
}
static void pcSyncTick(uint32_t ms) {
  if (!s_pcOnly) { if (s_pcStep >= 0) { if (s_pcFile) s_pcFile.close(); LittleFS.remove("/pc.tmp"); s_pcStep = -1; } return; }
  if (s_pcStep < 0) {
    static const uint8_t RETRY_MIN[5] = {2, 4, 8, 16, 30};
    const uint32_t wait = s_pcMissN ? min(syncWaitMs(), (uint32_t)(RETRY_MIN[s_pcMissN - 1] * 60000UL)) : syncWaitMs();
    const bool want = s_syncReq || !s_triedOnce || ms - s_lastSync > wait;
    if (!want || !s_usbOn || !timeValid() || s_deckUp || ms < 5000) return;
    if (!s_syncReq && s_triedOnce && inClassNow()) return;   // 수업 중에는 쉬는 시간까지 미룬다
    s_syncReq = false;
    s_pcN = 0;
    static const char *ALL[PC_MAX] = {"idx", "tt", "whr", "wx", "meal", "air", "sch"};
    for (int i = 0; i < PC_MAX; i++) s_pcId[s_pcN++] = ALL[i];
    for (int i = 0; i < PC_MAX; i++) s_pcGood[i] = s_pcAsk[i] = false;
    s_pcStep = 0; s_pcAsked = false; s_pcStepAt = ms;
    lock(); setStatus("컴퓨터에 부탁하는 중..."); unlock();
    Serial.println("sync: pc start");
    return;
  }
  if (!s_usbOn) { if (s_pcFile) s_pcFile.close(); LittleFS.remove("/pc.tmp"); pcFinish(); return; }   // 컴퓨터가 사라졌다
  if (s_pcStep >= s_pcN) { pcFinish(); return; }
  const char *id = s_pcId[s_pcStep];
  if (!s_pcAsked) {
    const String url = pcUrl(id);
    if (!url.length()) { s_pcStep++; return; }               // 이 모드에서 받을 것이 아니다
    s_pcAsk[s_pcStep] = true;
    Serial.printf("\n@get %s %s\n", id, url.c_str());
    s_pcAsked = true; s_pcDone = false; s_pcGotBegin = false; s_pcStepAt = s_pcActAt = ms;
    return;
  }
  const bool timeout = s_pcGotBegin ? ms - s_pcActAt > 10000 : ms - s_pcStepAt > 25000;
  const uint32_t cap = s_pcGotBegin ? max(120000UL, 30000UL + 2UL * s_pcWant) : 120000UL;   // 큰 파일(학교 일정 약 150KB)은 1KB 에 2초씩 더 기다린다
  if (s_pcDone || timeout || ms - s_pcStepAt > cap) {
    if (!s_pcDone) { if (s_pcFile) s_pcFile.close(); LittleFS.remove("/pc.tmp"); Serial.printf("pcget %s -> timeout\n", id); }
    s_pcGood[s_pcStep] = s_pcDone && s_pcRes;
    s_pcStep++; s_pcAsked = false;
  }
}

void setup() {
  Serial.setRxBufferSize(2048);   // 아이콘 조각(273자) 받기용. begin 앞에 불러야 먹는다
  Serial.begin(115200);
  Serial.printf("\n교실 알림판 v%s\n", FW_VERSION);
  if (!LittleFS.begin(true)) Serial.println("LittleFS mount failed");
  deckRemoveFiles(true);          // 받다 만 .tmp 지우기
  deckLoad();                     // 컴퓨터에서 꾸민 단축키(없으면 내장 16개). buildUI 앞에
  s_prefs.begin("board", false);
  s_pickName = s_prefs.getString("ttname", BOARD_DEFAULT_TT);           // 설정에서 고른 시간표 이름(없으면 board_config.h 의 처음 값)
  s_h12 = s_prefs.getBool("h12", false);
  s_autoClkMin = s_prefs.getInt("autoclk", 20);
  s_lastOkT = (time_t)s_prefs.getULong("lastok", 0);
  s_pcOnly = s_prefs.getBool("pconly", false);
  s_nixOn = s_prefs.getBool("nixie", true);    // 닉시 시계는 처음부터 켜짐(사용자 지시 2026-11-03)
  s_useOn = s_prefs.getBool("useon", false);   // 처음엔 꺼짐(필요한 보드만 설정에서 켠다)
  s_show = s_prefs.getInt("show", SH_ALL);
  s_themeIdx = constrain(s_prefs.getInt("theme", 0), 0, THEME_N - 1);   // 화면 색(buildUI 전에)
  s_th = &THEMES[s_themeIdx];
  s_ttFileKnown = s_prefs.isKey("ttfile");                               // 지난번 받던 시간표 파일(이름이 바뀌어도 찾는다)
  if (s_ttFileKnown) s_ttFile = s_prefs.getString("ttfile", s_ttFile);
  s_pwOk = s_prefs.getBool("pwok", false);
  {   // 지난번 왜 다시 켜졌나(밤에 다시 켜진 까닭을 설정 화면·기록에서 본다). 스스로 다시 켤 때는 prefs "hr" 에 까닭을 남긴다
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
      default: s_resetWhy = "기타"; break;
    }
    // 멈춤·오류·전압 부족은 횟수를 남긴다(되풀이되는지 설정 화면에서 본다). [다시 켜기]로 켜면 0 으로
    s_crashN = s_prefs.getInt("crashN", 0);
    const bool crash = rr == ESP_RST_PANIC || rr == ESP_RST_TASK_WDT || rr == ESP_RST_INT_WDT || rr == ESP_RST_WDT || rr == ESP_RST_BROWNOUT;
    if (crash) s_prefs.putInt("crashN", ++s_crashN);
    else if (rr == ESP_RST_SW && hr == 2 && s_crashN) { s_crashN = 0; s_prefs.putInt("crashN", 0); }
    Serial.printf("reset reason %d (%s) crash#%d\n", (int)rr, s_resetWhy, s_crashN);
  }

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
    {   // 기록 줄: %·충전 상태가 바뀌었거나 10분마다만(도우미 UART 선과 기록을 어지럽히지 않게)
      static int logPct = -2, logChg = -1; static uint32_t lastLog = 0;
      if (pct != logPct || chg != logChg || ms - lastLog > 600000UL) {
        logPct = pct; logChg = chg; lastLog = ms;
        Serial.printf("battery %dmV off %d -> %d%% (%s)\n", mv, st ? off : 0, pct, chg == 1 ? "charging" : chg == 2 ? "full" : "-");
      }
    }
    static int lastChg = -1;
    if ((pct != s_batPct || chg != lastChg) && s_bat) {
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
    // 설정 화면이 남긴 요청(와이파이 고르기·지우기·다시 켜기)은 받기가 없을 때 여기서 처리한다
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
    if (s_themeRestartAt && millis() - s_themeRestartAt > 300) { s_themeRestartAt = 0; rebuildUi(); }   // 화면 색: 다시 켜지 않는다(사용자 지적 2026-10-26)
    if (s_rebootReq) { Serial.println("restart (button)"); s_prefs.putInt("hr", 2); delay(200); ESP.restart(); }
    bool due = !s_pcOnly && s_prefs.isKey("ssid") && (!s_triedOnce || ms - s_lastSync > syncWaitMs());
    if (ms < 5000) due = false;                                  // 켠 뒤 5초는 기다린다
    // 수업 중에는 쉬는 시간까지 미룬다(켠 직후 첫 받기와 [지금 받기]는 바로)
    static bool deferLogged = false;
    if (due && s_triedOnce && inClassNow()) { if (!deferLogged) { deferLogged = true; Serial.println("sync: defer (class)"); } due = false; }
    if (due) deferLogged = false;
    if (s_deckUp) due = false;                                   // 아이콘 받는 중: 와이파이 받기는 끝난 뒤로(s_syncReq 는 둔다)
    if (!s_pcOnly && !s_deckUp && (s_syncReq || due) && ms >= 5000) { s_syncReq = false; startSync(); }   // '컴퓨터만' 이면 와이파이를 켜지 않는다
    pcSyncTick(ms);                                              // '컴퓨터만': 탭덱이 대신 받아 준다
    static uint32_t useChk = 0;
    if (s_useAt && ms - useChk > 30000) { useChk = ms; if (ms - s_useAt >= USE_STALE_MS) { s_useAt = 0; lock(); renderUse(); unlock(); } }   // 탭덱이 꺼지면 20분 뒤 제목으로(한 번만)
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
      else snprintf(msg, sizeof msg, "와이파이에 연결하지 못했습니다(%s, %d). 잠시 뒤 다시 해 봅니다.", wifiReasonText(r), r);
      finishSync(false, msg);
    }
  } else if (s_sync == SYNC_TIME) {
    bool synced = sntp_get_sync_status() == SNTP_SYNC_STATUS_COMPLETED || (timeValid() && ms - s_syncStart > 8000);
    if (synced || ms - s_syncStart > 15000) {
      okMark(OK_WIFI, true);
      okMark(OK_TIME, timeValid(), "못 맞춤");
      lock(); setStatus("시간표를 받는 중..."); unlock();
      // 시간표 주소를 아직 안 넣었으면(YOUR-SITE-ID) 시간표·선생님 위치는 받지 않는다. 404 로 실패해 몇 분마다
      // 다시 받으면 그때마다 화면 박자를 바꿔 화면이 깜빡였다(2026-10-16). 시간·날씨·급식은 그대로 받는다.
      const bool noUrl = urlUnset();
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
      // 목록(index.json)은 거의 바뀌지 않는다 → 날이 바뀐 뒤 첫 받기 · [볼 시간표] 판을 연 뒤 · 아직 목록이 없을 때만
      const bool wantIdx = !noUrl && (!tdNow.length() || s_idxDay != tdNow || s_idxReq || s_index["items"].isNull());
      if (wantIdx && go(1) && downloadIndex(B)) {
        if (tdNow.length()) s_idxDay = tdNow;
        s_idxReq = false;
        if (!s_idxSame) { lock(); fillPicker(); unlock(); }            // 304 면 단추 판을 다시 채우지 않는다
      }
      s_ttCode = 0;
      const bool wantTT = !noUrl && !s_principal && !s_pickMissing;   // 볼 시간표가 목록에 없으면 옛 파일을 받지 않는다
      const bool wantSch = s_principal && cfgSet(SCHEDULE_URL);
      bool ok = false, same = false, loaded = false, ttGood = false, sch = false, whr = false, wx = false, meal = false, air = false;
      bool skipWx = false, skipAir = false, skipWhr = false;
      // 순서: 모드의 핵심 자료를 먼저(60초 마감에 걸려도 잘리지 않게). 교장: 목록 → 학교 일정 → 선생님 위치 → 날씨 → 미세먼지 → 급식
      //                                                     교사: 목록 → 시간표 → 선생님 위치 → 날씨 → 급식 → 미세먼지
      auto doTT = [&]() {
        ok = wantTT && go(1) && downloadTT(B);
        same = ok && s_ttSame;                                        // 304: 이미 화면에 있는 시간표 그대로
        loaded = ok && !same && loadTTFromFile();
        if (same && !s_ttLoaded) loaded = loadTTFromFile();
        ttGood = loaded || (same && s_ttLoaded);
        mark(OK_TT, wantTT, ttGood, (s_ttCode == 404 || s_ttCode == 403) ? "404 파일 없음" : ok ? "파일 읽기 실패" : "인터넷");
      };
      auto doSch = [&]() { sch = s_principal && go(20000) && downloadSchedule(B); coreLow = lowB; mark(OK_SCH, wantSch, sch, "인터넷"); };
      auto doWhr = [&]() {
        skipWhr = !noUrl && fresh(s_whrAt) && s_where["teachers"].size();
        if (skipWhr) return;
        whr = !noUrl && go(20000) && downloadWhere(B); mark(OK_WHR, !noUrl, whr, "인터넷");
        if (whr && timeValid()) s_whrAt = time(nullptr);
      };
      auto doWx = [&]() {
        skipWx = HAS_WX && s_wxOk && fresh(s_wxAt);
        if (skipWx) return;
        wx = go(1) && downloadWeather(B); mark(OK_WX, HAS_WX, wx, "인터넷");
        if (wx && timeValid()) s_wxAt = time(nullptr);
      };
      auto doAir = [&]() {
        skipAir = HAS_WX && (!isnan(s_pm10) || !isnan(s_pm25)) && fresh(s_airAt);
        if (skipAir) return;
        air = go(1) && downloadAir(B); mark(OK_AIR, HAS_WX, air, "인터넷");
        if (air && timeValid()) s_airAt = time(nullptr);
      };
      auto doMeal = [&]() {
        meal = go(1) && downloadMeal(B);
        if (!(meal && s_mealCached)) mark(OK_MEAL, HAS_MEAL, meal, "인터넷");   // '오늘 이미 받음'은 점검표 시각을 새로 찍지 않는다
        if (meal) s_mealOk = true;
      };
      if (s_principal) { doSch(); doWhr(); doWx(); doAir(); doMeal(); }
      else { doTT(); doWhr(); doWx(); doMeal(); doAir(); }
      esp_task_wdt_reset();
      if (cut) Serial.println("sync: 60s limit, rest skipped");
      if (skipWx || skipAir || skipWhr) Serial.printf("sync: quiet skip%s%s%s\n", skipWx ? " weather" : "", skipAir ? " air" : "", skipWhr ? " where" : "");
      {   // 시간 초과로 모드의 핵심 자료를 못 받았으면 10분 뒤 한 번 더(하루 한 번, s_mealRetry 와 같은 방식)
        static String coreDay;
        const bool coreMiss = s_principal ? (wantSch && !sch) : (wantTT && !ttGood);
        s_coreRetry = (cut || coreLow) && coreMiss && tdNow.length() && coreDay != tdNow;
        if (s_coreRetry) coreDay = tdNow;
      }
      const bool newMeal = meal && !s_mealCached;
      lock();
      if (loaded) s_week = -1;
      if (s_blOff) {                                                  // 화면 불이 꺼져 있으면 그리지 않고 켤 때 한 번에(분 그리기와 함께)
        if (loaded || wx || newMeal || air || sch) s_renderPending = true;
        if (whr && !s_whereSame) s_findGridDirty = true;
        if (sch && s_pDetail) lv_obj_add_flag(s_pDetail, LV_OBJ_FLAG_HIDDEN);
      } else {
        if (loaded) renderTT(); if (wx) renderWeather(); if (newMeal) renderMeal(); if (air) renderAir(); if (whr && !s_whereSame) { fillFinderGrid(); renderFinder(); }
        if (s_principal) { if (sch && s_pDetail) lv_obj_add_flag(s_pDetail, LV_OBJ_FLAG_HIDDEN); renderPrincipal(); renderSchedList(); if (s_pTeach && !lv_obj_has_flag(s_pTeach, LV_OBJ_FLAG_HIDDEN)) renderTeach(); }
      }
      unlock();
      if (s_principal && !noUrl && !sch && cfgSet(SCHEDULE_URL)) s_failKind = (wx || meal || cut || coreLow) ? FK_PARTIAL : FK_NET;
      if (s_principal && !noUrl) finishSync(timeValid() && (sch || !cfgSet(SCHEDULE_URL)), sch ? "시간과 학교 일정을 받았습니다." : cfgSet(SCHEDULE_URL) ? "학교 일정을 받지 못했습니다. 인터넷을 확인하세요." : "학교 일정 주소가 없습니다(SCHEDULE_URL).");
      else if (noUrl) finishSync(timeValid(), timeValid() ? "시간을 맞췄습니다. 시간표 주소를 넣으면 시간표도 받습니다." : "시간을 맞추지 못했습니다. 인터넷을 확인하세요.");
      else if (s_pickMissing) {
        static char pm[200];
        snprintf(pm, sizeof pm, "볼 시간표 '%s'이(가) 목록에 없습니다. 설정에서 다시 고르세요.", s_pickName.c_str());
        s_failKind = FK_PARTIAL;
        finishSync(false, pm);
      } else {
        if (!ttGood) s_failKind = cut ? FK_PARTIAL : (s_ttCode == 404 || s_ttCode == 403) ? FK_NOTFOUND : (wx || meal) ? FK_PARTIAL : FK_NET;
        finishSync(ttGood, ttGood ? (same ? "시간을 맞췄습니다. 시간표는 바뀐 것이 없습니다." : "시간과 시간표를 받았습니다.")
                   : s_failKind == FK_NOTFOUND ? "시간표 파일이 사이트에 없습니다. 볼 시간표를 다시 고르거나 관리자께 알려 주세요(6시간 뒤 다시 받습니다)."
                   : ok ? "시간표 파일을 읽지 못했습니다."
                   : cut ? "받는 시간이 길어 중간에 멈췄습니다. 곧 다시 받습니다." : "시간표를 받지 못했습니다. 인터넷을 확인하세요.");
      }
    }
  }

  // 시계와 '지금' 표시 (1초마다 시계, 1분마다 표). 시각을 알면 시스템 시각의 '초'가 바뀌는 순간에 맞춘다
  // (millis 1000ms 간격은 loop 가 늦을 때마다 밀려 닉시 초가 가끔 건너뛰었다)
  static time_t lastSecT = 0;
  const time_t nowT = timeValid() ? time(nullptr) : 0;
  if (nowT ? nowT != lastSecT : ms - lastTick >= 1000) {
    lastTick = ms; lastSecT = nowT;
    if (timeValid()) {
      time_t t = nowT ? nowT : time(nullptr); struct tm tm; localtime_r(&t, &tm);
      static const char *W[7] = {"일", "월", "화", "수", "목", "금", "토"};
      // 분이 바뀔 때만 그린다. 이 보드(RGB 화면)는 한 번 그릴 때마다 화면 전체를 PSRAM 에 다시 쓰므로
      // 매초 글자를 바꾸면 화면이 흔들린다(2026-09-30 확인). 화면 불이 꺼져 있으면 그리지 않는다(켤 때 한 번에 최신으로).
      if (tm.tm_min != s_lastMin) {
        bool first = lastMin < 0; lastMin = tm.tm_min; s_lastMin = tm.tm_min;
        lock();
        s_offName = ""; s_offToday = isOffDay(&s_offName);   // 2초마다 일정 JSON 을 훑지 않게 1분에 한 번(교장 화면도 이 값을 쓴다)
        if (first) s_week = -1;
        if (!s_blOff) {
          char hm[12]; const char *ampm;
          clockText(tm, hm, sizeof hm, &ampm);
          setTextFmtIf(s_clock, "%s%s%s", ampm, *ampm ? " " : "", hm);
          setTextFmtIf(s_date, "%d월 %d일 (%s)", tm.tm_mon + 1, tm.tm_mday, W[tm.tm_wday]);
          const bool bigChg = setTextIf(s_big, hm);
          setTextIf(s_bigGlow, hm);
          if (s_nixOn) nixSecShow(tm.tm_sec, true);      // 분이 바뀌는 그 그리기에 초도 함께
          const bool apChg = setTextIf(s_bigAmPm, ampm);
          const bool apNew = *ampm && lv_obj_has_flag(s_bigAmPm, LV_OBJ_FLAG_HIDDEN);   // "오후"가 막 보이기 시작
          showIf(s_bigAmPm, *ampm);                      // "오후"는 숫자 왼쪽 아래(자리는 placeClock)
          if ((bigChg && s_nixOn) || (*ampm && (bigChg || apChg || apNew))) placeClock();
          setTextFmtIf(s_bigDate, "%d월 %d일 %s요일", tm.tm_mon + 1, tm.tm_mday, W[tm.tm_wday]);
          if (s_renderPending) {                         // 화면 불이 꺼진 동안 받은 자료
            s_renderPending = false;
            renderWeather(); renderAir();
            if (s_principal) renderSchedList();
          }
          renderTT();
          renderMeal();
          if (s_principal && s_view == V_CLOCK) renderPrincipal();
          if (s_pTeach && !lv_obj_has_flag(s_pTeach, LV_OBJ_FLAG_HIDDEN)) renderTeach();   // 교시가 바뀌면 명단도
          if (s_principal && s_view == V_WEEK && tm.tm_hour == 0 && tm.tm_min == 0) renderSchedList();   // 자정에 '오늘' 바꾸기
          refreshStale();
          if (s_view == V_FIND) renderFinder();
        }
        static int lastDay = -1;
        if (lastDay >= 0 && tm.tm_mday != lastDay) s_syncReq = true;   // 날이 바뀌면 오늘 급식·날씨를 새로 받는다
        lastDay = tm.tm_mday;
        unlock();
      }
      // 닉시 시계의 초: 이것만 매초 바꾼다(작은 글자 두 개라 다시 그리는 곳이 좁다). 시계 화면이 보일 때만.
      // 매초 그리기는 화면 흔들림 때문에 피해 왔다(5장) → 흔들리면 [닉시]를 끄면 초도 멈춘다.
      // 와이파이로 받는 중(느린 박자)에는 멈춘다: 흔들리기 가장 쉬운 때다. 끝나면 다음 초에 바로 맞춰진다
      if (s_nixOn && !s_blOff && !s_lcdSlow && s_sync == SYNC_IDLE &&
          !lv_obj_has_flag(s_viewClock, LV_OBJ_FLAG_HIDDEN)) {
        lock(); nixSecShow(tm.tm_sec, false); unlock();
      }
    }
  }
  // 불이 꺼져 있을 때 터치가 오면 바로 켠다. 그 터치는 단추로 가지 않는다(esp_lv_adapter 가 삼킨다).
  if (s_blOff && g_touchWoke && blReady()) {
    g_touchWoke = false; g_touchSwallow = false; s_blOff = false;
    s_lastMin = -1;                                    // 꺼진 동안 미룬 그리기를 1초 안에 한 번에
    blSet(true);
    lock(); lv_disp_trig_activity(NULL); unlock();
    Serial.println("backlight on (touch)");
  }
  // 밤(22:00~07:00)·주말·휴일에는 2분 동안 터치가 없으면 화면 불을 끈다. 만지면 켜진다(사용자 지시 2026-09-30).
  static uint32_t lastBl = 0;
  // 컴퓨터에 연결해 쓰는 보드(켠 뒤 컴퓨터 도우미 신호를 한 번이라도 받은 보드)는 다르다(사용자 지시 2026-10-25):
  //   컴퓨터가 켜져 있는 동안은 화면을 끄지 않고, 컴퓨터가 꺼지거나 절전에 들어가면(도우미 신호가 끊기고 10초 뒤) 끈다.
  if (ms - lastBl > 2000 && blReady() && (s_usbSeen || timeValid())) {
    lastBl = ms;
    bool off;
    lock();
    const uint32_t idle = lv_disp_get_inactive_time(NULL);
    static uint32_t gone = 0;
    if (s_usbSeen) {
      if (s_usbOn) gone = 0; else if (!gone) gone = ms;
      // 30분 넘게 도우미 신호가 없으면(컴퓨터에서 뽑아 칠판 옆으로 옮김 — 7B 는 배터리로 계속 켜져 있다) 시간 규칙으로 돌아간다.
      // 전에는 한 번 컴퓨터를 본 보드가 수업 중에도 2분만 안 만지면 꺼졌다. '@pc on' 이 다시 오면 deckPoll 이 되살린다.
      if (!s_usbOn && gone && ms - gone > 30UL * 60 * 1000) { s_usbSeen = false; gone = 0; Serial.println("pc helper gone 30min: time rules"); }
    }
    if (s_usbSeen) {
      off = !s_usbOn && ms - gone > 10000 && idle > 2UL * 60 * 1000;   // 컴퓨터가 꺼진 뒤 만지면 2분 동안은 켜 둔다
      if (!off && timeValid()) {   // 컴퓨터가 켜져 있어도 밤 22:00~07:00 에는 1시간 안 만지면 끈다(사용자 결정 2026-10-26)
        time_t t = time(nullptr); struct tm tm; localtime_r(&t, &tm);
        const int m = tm.tm_hour * 60 + tm.tm_min;
        off = (m < 7 * 60 || m >= 22 * 60) && idle > 60UL * 60 * 1000;
      }
    } else if (timeValid()) {
      time_t t = time(nullptr); struct tm tm; localtime_r(&t, &tm);
      const int m = tm.tm_hour * 60 + tm.tm_min;
      bool quiet = m < 7 * 60 || m >= 22 * 60;   // 22:00~07:00(사용자 지시 2026-10-01)
      quiet = quiet || s_offToday;                // 주말·휴일(교장 모드는 학사 일정의 '휴'). 1분마다 계산해 둔 값
      off = quiet && idle > 2UL * 60 * 1000;
    } else off = false;
    unlock();
    if (off != s_blOff) {
      s_blOff = off;
      g_touchSwallow = off;
      if (!off) s_lastMin = -1;                    // 켜질 때 미룬 그리기를 한 번에
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
      s_prefs.putInt("hr", 1);                         // 다음에 켤 때 '자동 점검'으로 보인다
      delay(100); ESP.restart();
    }
  }

  {
    static bool lastUsb = false; static uint32_t lastUsbChk = 0;
    if (s_deckUp || ms - lastUsbChk > 200) {   // 받은 줄은 자주 읽고(아이콘 받는 중에는 매 바퀴), 상태 글은 바뀔 때만
      lastUsbChk = ms;
      deckPoll(ms);
      if (lastUsb != s_usbOn) { lastUsb = s_usbOn; Serial.printf("pc helper %s\n", s_usbOn ? "on" : "off"); lock(); deckStateText(); deckIconsDim(); unlock(); }
      if (s_deckUp && ms - s_deckUpAt > 30000) {          // 30초 동안 도우미 줄이 없다 → 스스로 멈춤
        deckAbortUp();
        Serial.println("deck upload timeout");
        lock();
        if (s_deckState) { lv_label_set_text(s_deckState, LV_SYMBOL_WARNING "  받기를 멈췄습니다 · 탭덱이 다시 보냅니다"); lv_obj_set_style_text_color(s_deckState, lv_color_hex(NOW_TAG), 0); }
        unlock();
        s_deckSentAt = ms ? ms : 1;
      }
      if (s_deckResetReq) { s_deckResetReq = false; deckReset(); }
      if (s_deckResetArmed && ms - s_deckResetArmed > 3000) { s_deckResetArmed = 0; lock(); if (s_deckResetBtn) lv_label_set_text(lv_obj_get_child(s_deckResetBtn, 0), "기본 아이콘"); unlock(); }
      if (s_deckWaitKey >= 0 && ms - s_deckWaitAt > 5000) {   // 보냈는데 5초 안에 도우미 답이 없다 → 성공처럼 남기지 않는다
        const int k = s_deckWaitKey; s_deckWaitKey = -1;
        lock();
        if (s_deckState) { lv_label_set_text_fmt(s_deckState, LV_SYMBOL_WARNING "  '%s' 컴퓨터 답이 없습니다 · 탭덱을 다시 켜 주세요", deckName(k));
                           lv_obj_set_style_text_color(s_deckState, lv_color_hex(NOW_TAG), 0); }
        unlock();
        s_deckSentAt = ms ? ms : 1;
      }
      if (s_deckSentAt && !s_deckUp && ms - s_deckSentAt > 60000) { s_deckSentAt = 0; lock(); deckStateText(); unlock(); }   // '보냈습니다' 글은 1분 뒤 안내로
      if (s_forgetArmed || s_rebootArmed) { lock(); disarmButtons(); unlock(); }                                // '한 번 더' 글은 3초 뒤 되돌린다
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
    if (s_autoClkMin > 0 && idle > lim && !typing && s_view != V_OFF && (s_view != V_CLOCK || overlayOpen())) {   // 사무실은 지켜보는 화면이라 그대로 둔다
      hideOverlays();
      if (s_view != V_CLOCK) showView(V_CLOCK);       // 보던 탭(시간표·단축키)은 showView 가 기억한다 → 시계를 누르면 돌아간다
    }
    unlock();
  }
  esp_task_wdt_reset();
  delay(20);
}
