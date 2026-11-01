# -*- coding: utf-8 -*-
"""사무실 화면(Claude 작업 = 직원) 그림 만들기. 재료: tools/office_art/ (Pixel Agents, MIT — 출처.md)

결과
  firmware/src/office_art.c   office_bg(바닥·벽·가구, 336x176 RGB565) · office_desk(책상+모니터+컵, 투명도)
                              · office_chr0~5(직원 앞모습 7칸 112x32, 투명도). 보드가 켤 때 3배(800 보드는 2배)로 늘린다

자리(작은 그림 기준 점, main.cpp 의 OFF_* 와 같아야 한다)
  책상 6개: x 16·80·144, y 56·127 / 직원 = (x+16, y-22) / 책상 그림 = (x, y-23) / 이름표 = 가운데 x+24, 위 y+26
  정수기 2대: 가운데 x 286·318, 물통 y 128~143(안쪽 129~142, 너비 10), 몸통 146~163, 이름 165~
  쉼터 3곳: (244,62) (292,62) (236,100)
"""
import os, sys
from PIL import Image, ImageDraw, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.join(HERE, 'office_art')
OUT_C = os.path.join(HERE, '..', 'firmware', 'src', 'office_art.c')
COLS, ROWS = 21, 11
W, H = COLS * 16, ROWS * 16
DX = [16, 80, 144]
DY = [56, 127]
LOUNGE = [(244, 62), (292, 62), (236, 100)]
COOLER_X, COOLER_Y = [286, 318], 128   # 정수기 2대(5시간 · 주간 사용량) 가운데 x, 물통 위 y — main.cpp 의 OFF_CX·OFF_CY 와 같게


def load(n):
    return Image.open(os.path.join(ART, n + '.png')).convert('RGBA')


def tint(img, rgb):
    g = ImageOps.grayscale(img.convert('RGB'))
    t = ImageOps.colorize(g, black=tuple(int(c * .35) for c in rgb), white=tuple(min(255, int(c * 1.15)) for c in rgb))
    return t.convert('RGBA')


def put(layer, img, x, y):
    layer.alpha_composite(img, (int(x), int(y)))


def background():
    bg = Image.new('RGBA', (W, H))
    wood = tint(load('floor_1'), (176, 124, 82))
    blue = tint(load('floor_4'), (70, 110, 160))
    for r in range(2, ROWS):
        for c in range(COLS):
            put(bg, blue if c >= 14 else wood, c * 16, r * 16)
    d = ImageDraw.Draw(bg)
    d.rectangle([0, 0, W, 31], fill=(214, 204, 186))      # 벽
    d.rectangle([0, 0, W, 3], fill=(70, 58, 72))
    d.rectangle([0, 29, W, 31], fill=(150, 130, 112))
    d.rectangle([13 * 16 + 14, 32, 14 * 16 + 1, H], fill=(120, 96, 80))   # 일터·쉼터 사이 칸막이
    put(bg, load('WHITEBOARD'), 2 * 16, 0)
    put(bg, load('CLOCK'), 6 * 16, 0)
    put(bg, load('LARGE_PAINTING'), 8 * 16 + 8, 0)
    put(bg, load('DOUBLE_BOOKSHELF'), 11 * 16, 16)
    put(bg, load('SMALL_PAINTING'), 16 * 16, 0)
    put(bg, load('SMALL_PAINTING_2'), 18 * 16, 0)
    put(bg, load('HANGING_PLANT'), 14 * 16 + 8, 0)
    put(bg, load('LARGE_PLANT'), 19 * 16, 18)
    put(bg, load('PLANT'), 0, 8 * 16)
    put(bg, load('CACTUS'), 13 * 16 - 4, 8 * 16 + 4)
    put(bg, load('BIN'), 4 * 16, 9 * 16 + 8)
    put(bg, load('SOFA_FRONT'), 15 * 16, 4 * 16)
    put(bg, load('SOFA_FRONT'), 17 * 16 + 8, 4 * 16)
    put(bg, load('COFFEE_TABLE'), 16 * 16 + 4, 6 * 16)
    put(bg, load('COFFEE'), 17 * 16, 6 * 16 + 4)
    put(bg, load('PLANT_2'), 14 * 16 + 2, 8 * 16)
    chair = load('WOODEN_CHAIR_FRONT')
    for y in DY:
        for x in DX:
            put(bg, chair, x + 16, y - 26)
    for cx in COOLER_X:
        cooler(d, cx)
    return bg


def cooler(d, cx):
    """정수기 하나(직접 그림). 물통 안(물이 차는 칸)은 비워 두고 보드가 사용량만큼 물을 그린다"""
    line, glass = (52, 60, 74), (206, 226, 238)
    x0, x1 = cx - 6, cx + 5                                   # 물통 12칸
    d.rectangle([x0, COOLER_Y, x1, COOLER_Y + 15], fill=line)  # 물통 테두리
    d.rectangle([x0 + 1, COOLER_Y + 1, x1 - 1, COOLER_Y + 14], fill=glass)
    d.rectangle([cx - 2, COOLER_Y + 16, cx + 1, COOLER_Y + 17], fill=(70, 120, 190))   # 목(파란 마개)
    b0, b1, by = cx - 8, cx + 7, COOLER_Y + 18               # 몸통 16칸 x 18줄
    d.rectangle([b0, by, b1, by + 17], fill=line)
    d.rectangle([b0 + 1, by + 1, b1 - 1, by + 16], fill=(232, 234, 238))
    d.rectangle([b0 + 1, by + 1, b1 - 1, by + 1], fill=(250, 250, 252))
    d.rectangle([cx - 4, by + 3, cx - 3, by + 4], fill=(60, 130, 220))    # 찬물 꼭지
    d.rectangle([cx + 2, by + 3, cx + 3, by + 4], fill=(220, 70, 70))     # 더운물 꼭지
    d.rectangle([b0 + 1, by + 17, b1 - 1, by + 17], fill=(40, 46, 58))
    d.rectangle([b0 + 1, by + 18, b1 - 1, by + 18], fill=(40, 62, 96))   # 바닥 그림자


def desk():
    im = Image.new('RGBA', (48, 50))       # (x, y-27) 에 놓는다
    put(im, load('DESK_FRONT'), 0, 18)
    put(im, load('PC_BACK'), 2, 0)
    put(im, load('COFFEE'), 33, 14)
    return im


def chars():
    return [load('char_%d' % i).crop((0, 0, 112, 32)) for i in range(6)]


def c_array(name, im, alpha):
    px = im.load()
    w, h = im.size
    out = []
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if alpha and a == 0:
                r = g = b = 0
            v = ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3)
            out += [v & 0xFF, v >> 8] + ([a] if alpha else [])
    lines = [','.join(str(v) for v in out[i:i + 48]) for i in range(0, len(out), 48)]
    cf = 'LV_IMG_CF_TRUE_COLOR_ALPHA' if alpha else 'LV_IMG_CF_TRUE_COLOR'
    return ('static const uint8_t %s_map[] = {\n%s\n};\n'
            'const lv_img_dsc_t %s = { .header = { .cf = %s, .always_zero = 0, .reserved = 0, .w = %d, .h = %d }, '
            '.data_size = %d, .data = %s_map };\n\n') % (
        name, ',\n'.join(lines), name, cf, w, h, len(out), name)


def write_c():
    parts = ['// 사무실 화면 그림(자동 생성: tools/make_office.py) — Pixel Agents(MIT) 그림, 출처는 tools/office_art/출처.md\n'
             '// RGB565(작은 끝), 투명도 있는 것은 점마다 3바이트. 보드가 켤 때 늘려서 쓴다\n#include "lvgl.h"\n\n']
    parts.append(c_array('office_bg', background(), False))
    parts.append(c_array('office_desk', desk(), True))
    for i, im in enumerate(chars()):
        parts.append(c_array('office_chr%d' % i, im, True))
    with open(OUT_C, 'w', encoding='utf-8', newline='\n') as f:
        f.write(''.join(parts))
    print('wrote', os.path.normpath(OUT_C), os.path.getsize(OUT_C) // 1024, 'KB')


if __name__ == '__main__':
    write_c()
