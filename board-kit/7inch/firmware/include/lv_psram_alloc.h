// LVGL 메모리를 PSRAM 에서 받는다(2026-10-18).
// 화면 물체가 늘어나 작은 조각(64바이트 이하)이 내부 RAM 을 채우자 와이파이가 ESP_ERR_NO_MEM 으로 켜지지 못했다.
// PSRAM 이 없거나 모자라면 보통 malloc 으로 받는다.
#pragma once
#include <stdlib.h>
#include "esp_heap_caps.h"

static inline void *lv_psram_malloc(size_t n) {
  void *p = heap_caps_malloc(n, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
  return p ? p : malloc(n);
}
static inline void *lv_psram_realloc(void *p, size_t n) {
  void *q = heap_caps_realloc(p, n, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
  return (q || n == 0) ? q : realloc(p, n);
}
