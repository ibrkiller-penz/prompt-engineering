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
CHARS = '0123456789:-'   # '-' 는 따로 cmap(45)
WK, GAPK, COLK, MARGINK = .58, .14, .22, .25   # 숫자 폭·간격·':' 폭·빛 여백 (숫자 높이에 대한 비율)
# (이름, 숫자 높이): 7B(1024x600) 시 100 · 초 70 / 800x480 시 80 · 초 56
SIZES = [('nix100', 100), ('nix70', 70), ('nix80', 80), ('nix56', 56)]


def arc(cx, cy, rx, ry, a0, a1, n=40):
    return [(cx + rx * math.cos(math.radians(a0 + (a1 - a0) * i / n)),
             cy + ry * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]


def bez(p0, p1, p2, p3, n=24):
    """3차 베지어 곡선 점들(p0 포함)"""
    out = []
    for i in range(n + 1):
        t = i / n; u = 1 - t
        out.append((u**3*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t**3*p3[0],
                    u**3*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t**3*p3[1]))
    return out


def oval(cx, cy, rx, ry, a0, a1, n=80, e=2.5):
    """옆이 조금 곧은 달걀꼴(초타원). e=2 면 보통 타원, 클수록 옆이 곧다"""
    pts = []
    for i in range(n + 1):
        a = math.radians(a0 + (a1 - a0) * i / n); c, s = math.cos(a), math.sin(a)
        pts.append((cx + rx * math.copysign(abs(c) ** (2 / e), c),
                    cy + ry * math.copysign(abs(s) ** (2 / e), s)))
    return pts


def strokes(ch):   # 상자: 가로 0~1, 세로 0(위)~1(아래). IN-14 모양을 따랐다(2026-11-01 다듬음)
    if ch == '0': return [oval(.5, .5, .43, .5, 0, 360, 96)]                 # 옆이 곧은 좁은 달걀꼴
    if ch == '1': return [[(.30, .13), (.54, 0), (.54, 1)]]                 # 곧은 기둥 + 짧은 깃발, 칸 가운데
    if ch == '2':                                                           # 둥근 머리 → 오목하게 휘는 목 → 바닥
        head = arc(.5, .27, .43, .27, 180, 360, 40)[:-6]
        return [head + bez(head[-1], (.98, .42), (.30, .66), (.05, 1))[1:] + [(.97, 1)]]
    if ch == '3': return [[(.07, 0), (.93, 0), (.40, .39)] + arc(.5, .68, .46, .32, -103, 150, 44)[1:]]
    if ch == '4': return [[(.70, 1), (.70, 0), (.03, .69), (.97, .69)]]
    if ch == '5': return [[(.90, 0), (.17, 0), (.12, .43)] + arc(.5, .68, .46, .32, -128, 150, 44)[3:]]
    if ch == '6': return [bez((.80, 0), (.42, .10), (.06, .40), (.05, .70), 20) + arc(.5, .70, .45, .30, 180, 540, 72)[1:]]
    if ch == '7': return [[(.03, 0), (.97, 0)] + bez((.97, 0), (.72, .32), (.48, .62), (.40, 1), 18)[1:]]
    if ch == '8': return [arc(.5, .225, .36, .225, 90, 450, 60), arc(.5, .725, .47, .275, -90, 270, 72)]
    if ch == '9': return [[(1 - x, 1 - y) for x, y in s] for s in strokes('6')]   # IN-14 처럼 6을 뒤집은 모양
    if ch == '-': return [[(.18, .55), (.82, .55)]]                          # 시간을 받기 전 "--:--"
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


def layers(ch, H):   # 미리보기 '① 주황 닉시'를 다듬은 값: 심지 조금 굵게(56px 에서 3.4px) + 심지 둘레 주황 띠
    core, adv, m = mask(ch, H, H * .06)
    wide = mask(ch, H, H * .12)[0].filter(ImageFilter.GaussianBlur(H * .085))
    sheath = mask(ch, H, H * .10)[0].filter(ImageFilter.GaussianBlur(H * .022))
    glow = Image.new('L', wide.size)
    gw, gs = wide.load(), sheath.load(); out = glow.load()
    for y in range(glow.height):
        for x in range(glow.width):
            a, b = gw[x, y] / 255 * .90, gs[x, y] / 255 * .95
            out[x, y] = round(255 * (1 - (1 - a) * (1 - b)))           # 두 빛을 겹친 진하기
    return glow, core, adv, m


BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
def nib_dither(v, x, y):
    """0..255 → 0..15. 빛은 4x4 떨림(바이어)으로 16단계 등고선 무늬를 없앤다"""
    if v < 26: return (v + 8) // 17                 # 아주 흐린 곳은 떨림 없이(먼 데 점 반짝임 방지)
    t = (BAYER4[y & 3][x & 3] + .5) / 16
    return max(1, min(15, int(v / 17 + t)))


def write_font(name, H, which):
    bitmap, dsc = [], []
    m = round(H * MARGINK); L = H + 2 * m
    for ch in CHARS:
        glow, core, adv, _ = layers(ch, H)
        img = glow if which == 'g' else core
        bb = img.point(lambda v: 255 if v >= 9 else 0).getbbox()        # 4bpp 로 0이 되는 곳은 잘라 낸다
        x0, y0, x1, y1 = bb
        px = img.crop(bb).load(); bw, bh = x1 - x0, y1 - y0
        nib = [(nib_dither(px[x, y], x, y) if which == 'g' else min(15, (px[x, y] + 8) // 17))
               for y in range(bh) for x in range(bw)]
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
              '     .unicode_list = NULL, .glyph_id_ofs_list = NULL, .list_length = 0, .type = LV_FONT_FMT_TXT_CMAP_FORMAT0_TINY},',
              '    {.range_start = 45, .range_length = 1, .glyph_id_start = 12,',   # '-'
              '     .unicode_list = NULL, .glyph_id_ofs_list = NULL, .list_length = 0, .type = LV_FONT_FMT_TXT_CMAP_FORMAT0_TINY}',
              '};', '',
              'static lv_font_fmt_txt_glyph_cache_t cache;',
              'static const lv_font_fmt_txt_dsc_t font_dsc = {',
              '    .glyph_bitmap = glyph_bitmap, .glyph_dsc = glyph_dsc, .cmaps = cmaps, .kern_dsc = NULL,',
              '    .kern_scale = 0, .cmap_num = 2, .bpp = 4, .kern_classes = 0, .bitmap_format = 0, .cache = &cache',
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
