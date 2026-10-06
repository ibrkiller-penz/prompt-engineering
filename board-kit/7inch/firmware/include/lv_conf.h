/* LVGL 8.3 설정 — 필요한 것만 적고 나머지는 lv_conf_internal.h 기본값을 쓴다. */
#ifndef LV_CONF_H
#define LV_CONF_H
#include <stdint.h>

#define LV_COLOR_DEPTH 16
#define LV_COLOR_16_SWAP 0

/* 메모리는 표준 malloc(Arduino-ESP32 는 큰 덩어리를 PSRAM 에 준다) */
#define LV_MEM_CUSTOM 1
#define LV_MEM_CUSTOM_INCLUDE <stdlib.h>
#define LV_MEM_CUSTOM_ALLOC malloc
#define LV_MEM_CUSTOM_FREE free
#define LV_MEM_CUSTOM_REALLOC realloc

/* 틱은 어댑터(esp_timer)가 lv_tick_inc 로 준다 */
#define LV_TICK_CUSTOM 0
#define LV_DISP_DEF_REFR_PERIOD 20
#define LV_INDEV_DEF_READ_PERIOD 20

#define LV_USE_LOG 0
#define LV_USE_ASSERT_NULL 1
#define LV_USE_ASSERT_MALLOC 1
#define LV_USE_PERF_MONITOR 0

/* 영문·숫자 글꼴. 한글은 fonts/ 의 변환 글꼴을 쓴다 */
#define LV_FONT_MONTSERRAT_14 1
#define LV_FONT_MONTSERRAT_16 1
#define LV_FONT_MONTSERRAT_20 1
#define LV_FONT_MONTSERRAT_24 1
#define LV_FONT_MONTSERRAT_28 1
#define LV_FONT_DEFAULT &lv_font_montserrat_16
#define LV_USE_FONT_COMPRESSED 1

#define LV_USE_DEMO_WIDGETS 0
#define LV_BUILD_EXAMPLES 0

#endif
