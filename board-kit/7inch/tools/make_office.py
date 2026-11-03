# -*- coding: utf-8 -*-
"""사무실 화면(Claude 작업 = 직원) 그림 만들기. 재료: tools/office_art/ (Pixel Agents, MIT — 출처.md)

결과
  firmware/src/office_art.c   office_bg(바닥·벽·가구, 336x176 RGB565) · office_desk(책상+모니터+컵, 투명도)
                              · office_chr0~5(직원 앞모습 7칸 112x32, 투명도). 보드가 켤 때 3배(800 보드는 2배)로 늘린다

자리(작은 그림 기준 점, main.cpp 의 OFF_* 와 같아야 한다)
  책상 6개: x 16·80·144, y 56·127 / 직원 = (x+16, y-22) / 책상 그림 = (x, y-23) / 이름표 = 가운데 x+24, 위 y+26
  정수기 2대: 가운데 x 286·318, 물통 y 128~143(안쪽 129~142, 너비 10), 몸통 146~163, 이름 165~
  쉼터 3곳: (244,62) (292,62) (236,100)
  펫(직접 그림, 사용자 지시 2026-11-03): office_pet0~5 = 종류마다 16x16 칸, 줄 = 단계(0 알 · 1 아기 · 2 어린이 · 3 어른),
                                    칸 = 동작(0 서기 · 1 걷기 · 2 잠 · 3 기쁨 · 4 먹기) → 80x64. 펫은 쉼터 바닥을 돌아다닌다
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


# ── 펫 6종(이름·색·머리 장식). 그림은 모두 여기서 점으로 그린다(남의 그림을 쓰지 않는다) ──
PETS = [  # (이름, 몸 색, 배 색, 장식)
    ('말랑이', (110, 200, 120), (190, 236, 180), 'drop'),
    ('냥냥이', (236, 150, 70), (252, 216, 170), 'cat'),
    ('토실이', (244, 170, 196), (255, 232, 238), 'bunny'),
    ('뿔뿔이', (150, 110, 210), (210, 190, 240), 'horn'),
    ('새싹이', (196, 150, 100), (236, 210, 170), 'leaf'),
    ('별빛이', (240, 210, 80), (255, 244, 190), 'star'),
    ('부캉이', (74, 144, 216), (244, 248, 252), 'shark'),   # 사용자 그림(파란 상어, 2026-11-03)을 보고 점으로 다시 그림
]
PET_R = {1: (4, 3), 2: (5, 4), 3: (7, 5)}   # 단계별 몸 반지름(가로, 세로)


def _dark(c, k=.45):
    return tuple(int(v * k) for v in c)


def pet_cell(kind, stage, frame):
    """16x16 한 칸. 바닥(아래 줄 y=15) 가운데 x=8 에 선다"""
    name, body, belly, deco = PETS[kind]
    im = Image.new('RGBA', (16, 16))
    d = ImageDraw.Draw(im)
    line = _dark(body, .35)
    if stage == 0:   # 알: 흰 알에 그 종류 색 점무늬. 걷기 = 살짝 기울기, 기쁨 = 들썩, 잠 = 그대로
        lift = 1 if frame == 3 else 0
        tilt = 1 if frame == 1 else 0
        x0, y0 = 4 + tilt, 4 - lift
        d.ellipse([x0, y0, x0 + 7, y0 + 10], fill=(248, 244, 232), outline=(120, 110, 96))
        d.point([(x0 + 2, y0 + 4), (x0 + 3, y0 + 4), (x0 + 5, y0 + 7), (x0 + 4, y0 + 2), (x0 + 2, y0 + 8)], fill=body)
        d.point([(x0 + 2, y0 + 2)], fill=(255, 255, 255))
        d.line([(5, 15), (10, 15)], fill=(40, 46, 58, 120))
        return im
    rx, ry = PET_R[stage]
    dy = {0: 0, 1: 1, 2: 1, 3: -2, 4: 0}[frame]          # 걷기·잠 = 1 낮게(눌림), 기쁨 = 2 뛰어오름
    sq = 1 if frame == 1 else 0                           # 걷기: 옆으로 1 퍼짐
    cx, by = 8, 14 + dy                                   # 몸 바닥
    top = by - 2 * ry + (1 if frame == 2 else 0)
    d.line([(cx - rx + 1, 15), (cx + rx - 1, 15)], fill=(40, 46, 58, 110))   # 그림자
    # 머리 장식(몸 뒤)
    if deco == 'cat':
        for sx in (-1, 1):
            ex = cx + sx * (rx - 2)
            d.polygon([(ex - 2, top + 2), (ex + 2, top + 2), (ex + sx, top - 2)], fill=body, outline=line)
    elif deco == 'bunny':
        for sx in (-1, 1):
            ex = cx + sx * max(1, rx - 3)
            h = 3 + stage
            d.ellipse([ex - 1, top - h, ex + 1, top + 2], fill=body, outline=line)
            d.line([(ex, top - h + 2), (ex, top)], fill=belly)
    elif deco == 'horn':
        for sx in (-1, 1):
            ex = cx + sx * (rx - 2)
            d.line([(ex, top + 1), (ex + sx, top - 1 - (stage > 2))], fill=(250, 240, 220))
        if stage >= 2:   # 작은 날개
            for sx in (-1, 1):
                wx = cx + sx * (rx + 1)
                d.polygon([(wx, by - ry), (wx + sx * 2, by - ry - 3), (wx + sx * 2, by - ry + 1)], fill=belly, outline=line)
    elif deco == 'leaf':
        d.line([(cx, top), (cx, top - 2)], fill=(70, 140, 60))
        d.ellipse([cx, top - 4, cx + 3, top - 2], fill=(110, 200, 90))
        if stage >= 2: d.ellipse([cx - 3, top - 3, cx, top - 1], fill=(90, 180, 80))
    elif deco == 'star':
        d.line([(cx, top), (cx, top - 2)], fill=line)
        d.point([(cx, top - 4), (cx - 1, top - 3), (cx + 1, top - 3), (cx, top - 3), (cx, top - 2)], fill=(255, 250, 200))
    if deco == 'shark':   # 부캉이: 머리 위 뾰족한 지느러미(몸 뒤)
        fh = 2 + stage
        d.polygon([(cx - 3, top + 3), (cx + 2, top + 3), (cx, top - fh)], fill=body, outline=line)
        d.line([(cx - 1, top + 1), (cx, top - fh + 2)], fill=(120, 180, 240))
    # 몸
    d.ellipse([cx - rx - sq, top, cx + rx + sq - 1, by], fill=body, outline=line)
    if deco == 'drop':   # 말랑이: 머리 끝이 뾰족
        d.polygon([(cx - 2, top + 1), (cx + 1, top + 1), (cx, top - 2)], fill=body)
        d.point([(cx, top - 2)], fill=line)
    bw = max(1, rx - 2)
    if deco == 'shark': bw = rx - 1                                                  # 부캉이: 흰 배가 넓다
    d.ellipse([cx - bw - sq, by - ry, cx + bw + sq - 1, by - 1], fill=belly)          # 배
    d.point([(cx - rx + 1, top + 2)], fill=tuple(min(255, v + 60) for v in body))     # 빛
    if deco == 'cat' and stage >= 2:   # 꼬리
        d.line([(cx + rx, by - 2), (cx + rx + 2, by - 4)], fill=line)
    # 얼굴
    ey = top + ry - (0 if stage > 1 else 1)
    ex = max(1, rx - 2)
    eye = (30, 30, 40)
    if frame == 2:      # 잠: 감은 눈
        d.line([(cx - ex - 1, ey), (cx - ex, ey)], fill=eye); d.line([(cx + ex - 1, ey), (cx + ex, ey)], fill=eye)
    elif frame == 3:    # 기쁨: ^ ^
        for x in (cx - ex, cx + ex - 1):
            d.point([(x - 1, ey + 1), (x, ey), (x + 1, ey + 1)], fill=eye)
    else:
        for x in (cx - ex, cx + ex - 1):
            d.line([(x, ey), (x, ey + (1 if stage > 1 else 0))], fill=eye)
            if stage > 1: d.point([(x, ey)], fill=(255, 255, 255))
    my = ey + (2 if stage > 1 else 2)
    if deco == 'shark' and frame != 2:   # 부캉이: 이빨 보이는 큰 빨간 입(기쁨·먹기는 더 크게)
        w = 1 + (stage > 1) + (frame in (3, 4))
        h = 1 + (stage > 2) + (frame == 4)
        d.rectangle([cx - w - 1, my, cx + w, my + h], fill=(140, 30, 60))
        for x in range(cx - w - 1, cx + w + 1, 2): d.point([(x, my)], fill=(255, 255, 255))
        if h >= 2: d.line([(cx - w, my + h), (cx + w - 1, my + h)], fill=(250, 130, 150))
    elif frame == 4:      # 먹기: 벌린 입
        d.rectangle([cx - 1, my, cx, my + 1], fill=(120, 40, 50))
    elif frame != 2:
        d.point([(cx - 1, my), (cx, my)], fill=_dark(body, .25))
    if frame == 3 or stage >= 2:   # 볼
        d.point([(cx - rx + 1, ey + 2), (cx + rx - 2, ey + 2)], fill=(250, 130, 140))
    return im


def pet_sheet(kind):
    sh = Image.new('RGBA', (80, 64))
    for st in range(4):
        for fr in range(5):
            sh.alpha_composite(pet_cell(kind, st, fr), (fr * 16, st * 16))
    return sh


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
    for k in range(len(PETS)):
        parts.append(c_array('office_pet%d' % k, pet_sheet(k), True))
    with open(OUT_C, 'w', encoding='utf-8', newline='\n') as f:
        f.write(''.join(parts))
    print('wrote', os.path.normpath(OUT_C), os.path.getsize(OUT_C) // 1024, 'KB')


if __name__ == '__main__':
    if '--pets' in sys.argv:   # 펫 그림만 크게 미리 보기(sim/shots/사무실/펫.png)
        out = Image.new('RGBA', (90 * len(PETS) - 10, 64), (60, 90, 130, 255))
        for k in range(len(PETS)): out.alpha_composite(pet_sheet(k), (k * 90, 0))
        out = out.resize((out.width * 4, out.height * 4), Image.NEAREST)
        dst = os.path.join(HERE, 'sim', 'shots', '사무실', '펫.png'); out.save(dst); print(dst)
    else:
        write_c()
