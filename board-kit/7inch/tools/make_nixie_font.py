"""닉시관 느낌 시계 숫자 글꼴 만들기 → firmware/src/fonts/nix*.c (LVGL 8, 4bpp)

숫자 모양은 여기서 직접 그린 한 획 숫자(IN-14 닉시관 흉내)라 다른 글꼴의 저작권이 없다.
한 숫자를 두 글꼴로 나눈다: 빛(주황, 흐리게 번짐)과 심지(밝은 호박색, 가는 선).
보드에서는 같은 글을 쓴 글자 두 개를 겹쳐 그린다(빛이 아래).
모든 숫자의 폭이 같아서(고정폭) 시간이 바뀌어도 시계가 좌우로 움직이지 않는다.
글자 상자에 빛 여백(MARGIN)이 들어 있다 → 보드에서는 글자 좌우에 같은 여백(pad)을 준다.

  python tools/make_nixie_font.py
"""
import math, os
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), '..', 'firmware', 'src', 'fonts')
CHARS = '0123456789:'
WK, GAPK, COLK, MARGINK = .58, .14, .22, .25   # 숫자 폭·간격·':' 폭·빛 여백 (숫자 높이에 대한 비율)
# (이름, 숫자 높이): 7B(1024x600) 시 100 · 초 70 / 800x480 시 80 · 초 56
SIZES = [('nix100', 100), ('nix70', 70), ('nix80', 80), ('nix56', 56)]


def arc(cx, cy, rx, ry, a0, a1, n=40):
    return [(cx + rx * math.cos(math.radians(a0 + (a1 - a0) * i / n)),
             cy + ry * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]


def strokes(ch):   # 상자: 가로 0~1, 세로 0(위)~1(아래)
    if ch == '0': return [arc(.5, .5, .48, .5, 0, 360, 80)]
    if ch == '1': return [[(.28, .2), (.58, 0), (.58, 1)]]
    if ch == '2': return [arc(.5, .26, .44, .26, 180, 360) + [(.94, .3), (.05, 1), (.97, 1)]]
    if ch == '3': return [[(.06, 0), (.94, 0), (.42, .38)] + arc(.5, .67, .46, .33, -100, 150)[1:]]
    if ch == '4': return [[(.72, 1), (.72, 0), (.02, .7), (.98, .7)]]
    if ch == '5': return [[(.92, 0), (.18, 0), (.1, .44)] + arc(.5, .67, .46, .33, -135, 150)[3:]]
    if ch == '6': return [arc(1.15, .7, 1.1, .7, -125, -180, 30) + arc(.5, .7, .45, .3, 180, 540, 70)]
    if ch == '7': return [[(.03, 0), (.97, 0), (.38, 1)]]
    if ch == '8': return [arc(.5, .23, .38, .23, 90, 450, 60), arc(.5, .72, .47, .28, -90, 270, 70)]
    if ch == '9': return [[(1 - x, 1 - y) for x, y in s] for s in strokes('6')]
    return []


def mask(ch, H, stroke, S=4):
    """빛 여백을 포함한 칸(advance + 2*여백 × 높이 + 2*여백)에 숫자를 그린 흑백 그림"""
    m = round(H * MARGINK); gap = round(H * GAPK)
    adv = (round(H * COLK) if ch == ':' else round(H * WK)) + gap
    w, h = adv + 2 * m, H + 2 * m
    img = Image.new('L', (w * S, h * S), 0); d = ImageDraw.Draw(img)
    x0, y0 = m + gap / 2, m
    if ch == ':':
        r = stroke * 1.1; cx = x0 + H * COLK / 2
        for yy in (.32, .78):
            cy = y0 + H * yy
            d.ellipse([(cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S], fill=255)
    else:
        W = H * WK
        for s in strokes(ch):
            pts = [((x0 + px * W) * S, (y0 + py * H) * S) for px, py in s]
            d.line(pts, fill=255, width=round(stroke * S), joint='curve')
            for p in (pts[0], pts[-1]):
                r = stroke * S / 2
                d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=255)
    return img.resize((w, h), Image.LANCZOS), adv, m


def layers(ch, H):   # 미리보기의 '① 주황 닉시'와 같은 값
    core, adv, m = mask(ch, H, H * .055)
    wide = mask(ch, H, H * .11)[0].filter(ImageFilter.GaussianBlur(H * .09))
    near = core.filter(ImageFilter.GaussianBlur(H * .025))
    glow = Image.new('L', wide.size)
    gw, gn = wide.load(), near.load(); out = glow.load()
    for y in range(glow.height):
        for x in range(glow.width):
            a, b = gw[x, y] / 255 * .85, gn[x, y] / 255
            out[x, y] = round(255 * (1 - (1 - a) * (1 - b)))           # 두 빛을 겹친 진하기
    return glow, core, adv, m


def write_font(name, H, which):
    bitmap, dsc = [], []
    m = round(H * MARGINK); L = H + 2 * m
    for ch in CHARS:
        glow, core, adv, _ = layers(ch, H)
        img = glow if which == 'g' else core
        bb = img.point(lambda v: 255 if v >= 9 else 0).getbbox()        # 4bpp 로 0이 되는 곳은 잘라 낸다
        x0, y0, x1, y1 = bb
        px = img.crop(bb).load(); bw, bh = x1 - x0, y1 - y0
        nib = [min(15, (px[x, y] + 8) // 17) for y in range(bh) for x in range(bw)]
        if len(nib) % 2: nib.append(0)
        start = len(bitmap)
        bitmap += [(nib[i] << 4) | nib[i + 1] for i in range(0, len(nib), 2)]
        # 그리는 자리: 줄 위 + (L - base_line) - box_h - ofs_y = 줄 위 + y0,  base_line = m
        dsc.append((start, adv * 16, bw, bh, x0 - m, H + m - bh - y0))
    G = name + which
    lines = [f'/* {G}: 닉시관 느낌 시계 숫자({"빛" if which == "g" else "심지"}), 숫자 높이 {H}px, 4bpp.',
             ' * tools/make_nixie_font.py 로 만든다(손으로 고치지 말 것). */',
             '#include "lvgl.h"', '',
             'static LV_ATTRIBUTE_LARGE_CONST const uint8_t glyph_bitmap[] = {']
    for i in range(0, len(bitmap), 24):
        lines.append('    ' + ', '.join(f'0x{b:x}' for b in bitmap[i:i + 24]) + ',')
    lines += ['};', '', 'static const lv_font_fmt_txt_glyph_dsc_t glyph_dsc[] = {',
              '    {.bitmap_index = 0, .adv_w = 0, .box_w = 0, .box_h = 0, .ofs_x = 0, .ofs_y = 0},']
    for ch, (bi, aw, bw, bh, ox, oy) in zip(CHARS, dsc):
        lines.append(f'    {{.bitmap_index = {bi}, .adv_w = {aw}, .box_w = {bw}, .box_h = {bh}, .ofs_x = {ox}, .ofs_y = {oy}}}, /* "{ch}" */')
    lines += ['};', '',
              'static const lv_font_fmt_txt_cmap_t cmaps[] = {',
              '    {.range_start = 48, .range_length = 11, .glyph_id_start = 1,',
              '     .unicode_list = NULL, .glyph_id_ofs_list = NULL, .list_length = 0, .type = LV_FONT_FMT_TXT_CMAP_FORMAT0_TINY}',
              '};', '',
              'static lv_font_fmt_txt_glyph_cache_t cache;',
              'static const lv_font_fmt_txt_dsc_t font_dsc = {',
              '    .glyph_bitmap = glyph_bitmap, .glyph_dsc = glyph_dsc, .cmaps = cmaps, .kern_dsc = NULL,',
              '    .kern_scale = 0, .cmap_num = 1, .bpp = 4, .kern_classes = 0, .bitmap_format = 0, .cache = &cache',
              '};', '',
              f'const lv_font_t {G} = {{',
              '    .get_glyph_dsc = lv_font_get_glyph_dsc_fmt_txt, .get_glyph_bitmap = lv_font_get_bitmap_fmt_txt,',
              f'    .line_height = {L}, .base_line = {m}, .subpx = LV_FONT_SUBPX_NONE,',
              '    .underline_position = 0, .underline_thickness = 0, .dsc = &font_dsc',
              '};', '']
    path = os.path.join(OUT, G + '.c')
    with open(path, 'w', encoding='utf-8', newline='\n') as f: f.write('\n'.join(lines))
    print(f'{G}.c  {len(bitmap) // 1024}KB  줄 높이 {L}  여백 {m}')


if __name__ == '__main__':
    for name, H in SIZES:
        write_font(name, H, 'g'); write_font(name, H, 'c')
