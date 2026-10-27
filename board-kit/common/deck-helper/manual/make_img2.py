# -*- coding: utf-8 -*-
"""설명서 2부(자세한 설명서) 그림 56장을 만든다 → manual/img2/NN_이름.png

    python make_img2.py            # 모두 만들기
    python make_img2.py 11 27 52   # 몇 장만 다시 만들기

- [자름] 그림: exe/preview(·manual/img·library_src) 원본에서 잘라 빨간 테두리·파란 번호·말풍선을 더한다.
  원본은 고치지 않는다. 좌표는 기획_자세한편.md 표를 따르고, 원본 좌표 그대로 적는다.
- [그림] 그림: 윈도 창·인터넷 창·메뉴·순서도를 단순한 도형과 글로 그린다(진짜 화면을 찍지 않는다).
- 결과 너비는 1600 안팎(작은 창은 2배까지 키움). 표시 크기는 결과 그림 기준으로 같게 한다.
"""
import os, sys, math
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)                       # deck-helper
PRE = os.path.join(ROOT, 'exe', 'preview')
IMG = os.path.join(HERE, 'img')
LIB = os.path.join(ROOT, 'library_src')
OUT = os.path.join(HERE, 'img2')
F5 = os.path.join(ROOT, 'exe', 'fonts', 'SCDream5.otf')
F4 = os.path.join(ROOT, 'exe', 'fonts', 'SCDream4.otf')
F6 = F5

RED = (229, 72, 77)        # #e5484d
BLUE = (59, 111, 224)      # #3b6fe0
GREEN = (31, 157, 85)      # #1f9d55
INK = (34, 38, 46)
GRAY = (110, 116, 128)
LINE = (190, 196, 206)
PAPER = (255, 255, 255)
SOFT = (244, 246, 250)
DARK = (26, 30, 39)        # 어두운 메뉴(#1a1e27, 1부와 같게)
DARK2 = (40, 45, 57)
DTEXT = (226, 230, 238)
DDIM = (130, 138, 152)

TARGET_W = 1600

SYM = 'C:/Windows/Fonts/seguisym.ttf'      # 에스코어 드림에 없는 기호(✓ ⟳ ▸ ▾ ⋯ —)만 이 글꼴로
_cmap = {}


def _has(fnt, ch):
    p = fnt.path
    if p not in _cmap:
        from fontTools.ttLib import TTFont
        _cmap[p] = set(TTFont(p).getBestCmap().keys())
    return ord(ch) in _cmap[p] or ch == ' '


def _runs(s, fnt):
    out = []
    for ch in s:
        use = fnt if _has(fnt, ch) or not os.path.exists(SYM) else font(fnt.size, SYM)
        if out and out[-1][1] is use:
            out[-1][0] += ch
        else:
            out.append([ch, use])
    return out


class SDraw(ImageDraw.ImageDraw):
    """빠진 글자는 기호 글꼴로 바꿔 그리는 그리기 도구"""
    def textlength(self, s, font=None, **k):
        return sum(ImageDraw.ImageDraw.textlength(self, r, font=f) for r, f in _runs(s, font))

    def text(self, xy, s, fill=None, font=None, **k):
        x, y = xy
        base = y + font.getmetrics()[0]
        for r, f in _runs(s, font):
            ImageDraw.ImageDraw.text(self, (x, base), r, fill=fill, font=f, anchor='ls')
            x += ImageDraw.ImageDraw.textlength(self, r, font=f)


def Draw(im):
    return SDraw(im)

_fc = {}


def font(size, path=F5):
    k = (path, size)
    if k not in _fc:
        _fc[k] = ImageFont.truetype(path, size)
    return _fc[k]


def tw(d, s, f):
    b = d.textbbox((0, 0), s, font=f)
    return b[2] - b[0], b[3] - b[1]


def text_c(d, cx, cy, s, f, fill):
    """가운데 맞춤 글(여러 줄 가능)"""
    lines = s.split('\n')
    h1 = f.size * 1.32
    y = cy - h1 * len(lines) / 2
    for ln in lines:
        w = d.textlength(ln, font=f)
        d.text((cx - w / 2, y + h1 * 0.08), ln, font=f, fill=fill)
        y += h1


def text_l(d, x, y, s, f, fill, lh=1.38):
    for ln in s.split('\n'):
        d.text((x, y), ln, font=f, fill=fill)
        y += f.size * lh
    return y


def wrap(d, s, f, width):
    """글을 width 안에 들어가게 줄 바꾼다(한글은 낱자 단위로도 자름)"""
    out = []
    for para in s.split('\n'):
        cur = ''
        for word in para.split(' '):
            t = (cur + ' ' + word) if cur else word
            if d.textlength(t, font=f) <= width:
                cur = t
                continue
            if cur:
                out.append(cur)
            cur = word
            while d.textlength(cur, font=f) > width:      # 너무 긴 낱말
                i = len(cur)
                while i > 1 and d.textlength(cur[:i], font=f) > width:
                    i -= 1
                out.append(cur[:i]); cur = cur[i:]
        out.append(cur)
    return '\n'.join(out)


def rrect(d, box, r, fill=None, outline=None, width=1):
    d.rounded_rectangle([int(v) for v in box], radius=r, fill=fill, outline=outline, width=width)


# ───────────────────────── 표시(테두리·번호·말풍선·화살표) ─────────────────────────
def badge(d, cx, cy, n, dia=46):
    r = dia / 2
    d.ellipse([cx - r - 3, cy - r - 3, cx + r + 3, cy + r + 3], fill=PAPER)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=BLUE)
    text_c(d, cx, cy, str(n), font(int(dia * 0.62)), PAPER)


def ring(d, box, color=RED, width=5, pad=8, dash=False):
    x0, y0, x1, y1 = box
    b = (x0 - pad, y0 - pad, x1 + pad, y1 + pad)
    if not dash:
        rrect(d, b, 12, outline=color, width=width)
    else:
        dashed_rect(d, b, color, width)
    return b


def dashed_rect(d, b, color, width, seg=14, gap=9):
    x0, y0, x1, y1 = b
    for (ax, ay, bx, by) in [(x0, y0, x1, y0), (x1, y0, x1, y1), (x1, y1, x0, y1), (x0, y1, x0, y0)]:
        L = math.hypot(bx - ax, by - ay); n = 0.0
        while n < L:
            e = min(n + seg, L)
            d.line([ax + (bx - ax) * n / L, ay + (by - ay) * n / L, ax + (bx - ax) * e / L, ay + (by - ay) * e / L], fill=color, width=width)
            n += seg + gap


def dashed_line(d, p, q, color, width=3, seg=12, gap=9):
    (ax, ay), (bx, by) = p, q
    L = math.hypot(bx - ax, by - ay); n = 0.0
    while n < L:
        e = min(n + seg, L)
        d.line([ax + (bx - ax) * n / L, ay + (by - ay) * n / L, ax + (bx - ax) * e / L, ay + (by - ay) * e / L], fill=color, width=width)
        n += seg + gap


def arrow(d, p, q, color=RED, width=6, head=22):
    (ax, ay), (bx, by) = p, q
    ang = math.atan2(by - ay, bx - ax)
    ex, ey = bx - math.cos(ang) * head * 0.8, by - math.sin(ang) * head * 0.8
    d.line([ax, ay, ex, ey], fill=color, width=width)
    pts = [(bx, by),
           (bx - head * math.cos(ang) + head * 0.55 * math.sin(ang), by - head * math.sin(ang) - head * 0.55 * math.cos(ang)),
           (bx - head * math.cos(ang) - head * 0.55 * math.sin(ang), by - head * math.sin(ang) + head * 0.55 * math.cos(ang))]
    d.polygon(pts, fill=color)


def bubble(d, img_size, anchor_box, s, side='auto', fsize=30, avoid=()):
    """짚은 곳 옆 말풍선(흰 바탕·빨간 테두리·꼬리). anchor_box = 테두리 상자"""
    f = font(fsize)
    W, H = img_size
    lines = s.split('\n')
    w = max(d.textlength(l, font=f) for l in lines) + 30
    h = fsize * 1.32 * len(lines) + 20
    x0, y0, x1, y1 = anchor_box
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    gap = 22
    cands = {
        'r': (x1 + gap, cy - h / 2),
        'l': (x0 - gap - w, cy - h / 2),
        'b': (cx - w / 2, y1 + gap),
        't': (cx - w / 2, y0 - gap - h),
        'br': (x1 - w * 0.3, y1 + gap),
        'bl': (x0 - w * 0.7, y1 + gap),
        'tr': (x1 - w * 0.3, y0 - gap - h),
    }
    order = [side] if side != 'auto' else ['r', 'b', 'l', 't', 'br', 'bl', 'tr']

    def fits(bx, by):
        if bx < 4 or by < 4 or bx + w > W - 4 or by + h > H - 4:
            return False
        for a in avoid:
            if not (bx + w < a[0] or bx > a[2] or by + h < a[1] or by > a[3]):
                return False
        return True
    pos = None
    for k in order:
        if fits(*cands[k]):
            pos = (k, cands[k]); break
    if pos is None:
        k = order[0]; bx, by = cands[k]
        bx = min(max(4, bx), W - w - 4); by = min(max(4, by), H - h - 4)
        pos = (k, (bx, by))
    k, (bx, by) = pos
    # 꼬리
    if k in ('r',):
        tail = [(bx + 2, by + h / 2 - 11), (bx + 2, by + h / 2 + 11), (bx - 16, by + h / 2)]
    elif k in ('l',):
        tail = [(bx + w - 2, by + h / 2 - 11), (bx + w - 2, by + h / 2 + 11), (bx + w + 16, by + h / 2)]
    elif k in ('b', 'br', 'bl'):
        tx = min(max(bx + 24, cx), bx + w - 24)
        tail = [(tx - 11, by + 2), (tx + 11, by + 2), (tx, by - 16)]
    else:
        tx = min(max(bx + 24, cx), bx + w - 24)
        tail = [(tx - 11, by + h - 2), (tx + 11, by + h - 2), (tx, by + h + 16)]
    d.polygon(tail, fill=RED)
    rrect(d, (bx, by, bx + w, by + h), 12, fill=PAPER, outline=RED, width=3)
    yy = by + 10
    for l in lines:
        d.text((bx + 15, yy + fsize * 0.06), l, font=f, fill=INK)
        yy += fsize * 1.32
    return (bx - 16, by - 16, bx + w + 16, by + h + 16)


def mark(d, img_size, box, n=None, say=None, side='auto', dash=False, color=RED, avoid=(), pad=8):
    """box(결과 좌표)에 테두리 + 번호(왼쪽 위 바깥) + 말풍선"""
    b = ring(d, box, color=color, pad=pad, dash=dash, width=5 if not dash else 4)
    W, H = img_size
    placed = []
    if say:
        placed.append(bubble(d, img_size, b, say, side=side, avoid=avoid))
    if n is not None:
        cx = max(27, b[0] - 4); cy = max(27, b[1] - 4)
        cx = min(cx, W - 27); cy = min(cy, H - 27)
        badge(d, cx, cy, n)
    return b, placed


# ───────────────────────── 자르기 그림 ─────────────────────────
def load(path):
    return Image.open(path).convert('RGB')


def pre(name):
    for f in os.listdir(PRE):
        if f.startswith(name):
            return load(os.path.join(PRE, f))
    raise FileNotFoundError(name)


def crop_fig(src, box, marks=(), scale=None, caption=None, pad=0, padcol=PAPER, dim=False, extra=None, extra_pre=None):
    """src 그림에서 box=(l,t,r,b)를 잘라 scale배로 키운 뒤 marks를 그린다.
    marks: dict(box=(l,t,r,b) 원본좌표, n=번호, say=말풍선, side=, dash=)
    pad: 둘레 여백(말풍선 자리). caption: 아래 회색 글."""
    l, t, r, b = box
    im = src.crop(box)
    w, h = im.size
    if scale is None:
        scale = min(2.0, TARGET_W / w)
        scale = max(scale, 1.0)
    if abs(scale - 1) > 1e-3:
        im = im.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    pl, pt, pr, pb = (pad, pad, pad, pad) if isinstance(pad, int) else pad
    W = im.width + pl + pr
    H = im.height + pt + pb
    cap_h = 0
    if caption:
        cap_h = 70 * (caption.count('\n') + 1)
    can = Image.new('RGB', (W, H + cap_h), padcol)
    can.paste(im, (pl, pt))
    d = Draw(can)
    if pl or pt or pr or pb:
        d.rectangle([pl - 1, pt - 1, pl + im.width, pt + im.height], outline=LINE, width=2)

    def tr(bx):
        return ((bx[0] - l) * scale + pl, (bx[1] - t) * scale + pt, (bx[2] - l) * scale + pl, (bx[3] - t) * scale + pt)
    if dim and marks:
        ov = Image.new('L', can.size, 0)
        od = Draw(ov)
        od.rectangle([pl, pt, pl + im.width, pt + im.height], fill=115)
        for m in marks:
            x0, y0, x1, y1 = tr(m['box'])
            od.rounded_rectangle([x0 - 8, y0 - 8, x1 + 8, y1 + 8], radius=12, fill=0)
        can.paste(Image.new('RGB', can.size, (0, 0, 0)), (0, 0), ov)
        d = Draw(can)
    if extra_pre:
        extra_pre(d, tr, can)
    rings = [tr(m['box']) for m in marks]
    placed = []
    # 테두리 먼저, 말풍선은 다른 테두리를 피해서
    for m in marks:
        bb = tr(m['box'])
        _, p = mark(d, (W, H), bb, n=m.get('n'), say=m.get('say'), side=m.get('side', 'auto'),
                    dash=m.get('dash', False), color=m.get('color', RED),
                    avoid=[(x0 - 10, y0 - 10, x1 + 10, y1 + 10) for (x0, y0, x1, y1) in rings if (x0, y0, x1, y1) != bb] + placed)
        placed += p
    if extra:
        extra(d, tr, can)
    if caption:
        f = font(32, F4)
        text_c(d, W / 2, H + cap_h / 2, caption, f, GRAY)
    return can


# ───────────────────────── 그리기 도구(윈도 흉내) ─────────────────────────
def canvas(w, h, bg=PAPER):
    im = Image.new('RGB', (w, h), bg)
    return im, Draw(im)


def caption_under(d, cx, y, s, size=30):
    """cx = 글 가운데 x"""
    text_c(d, cx, y, s, font(size, F4), GRAY)


def win_frame(d, box, title='', dark=False, title_h=56):
    x0, y0, x1, y1 = box
    bg = DARK if dark else PAPER
    rrect(d, (x0 + 6, y0 + 8, x1 + 6, y1 + 8), 14, fill=(225, 228, 234))     # 그림자
    rrect(d, box, 14, fill=bg, outline=(150, 156, 168) if not dark else (70, 76, 90), width=2)
    tb = DARK2 if dark else (238, 240, 244)
    d.rounded_rectangle([x0 + 2, y0 + 2, x1 - 2, y0 + title_h], radius=12, fill=tb)
    d.rectangle([x0 + 2, y0 + title_h - 14, x1 - 2, y0 + title_h], fill=tb)
    d.line([x0 + 2, y0 + title_h, x1 - 2, y0 + title_h], fill=(200, 204, 212) if not dark else (60, 66, 80), width=2)
    if title:
        d.text((x0 + 24, y0 + title_h / 2 - 17), title, font=font(30), fill=INK if not dark else DTEXT)
    # 오른쪽 위 _ □ ×
    cx = x1 - 40
    c = (90, 96, 108) if not dark else DDIM
    d.line([cx - 10, y0 + title_h / 2 - 10, cx + 10, y0 + title_h / 2 + 10], fill=c, width=3)
    d.line([cx - 10, y0 + title_h / 2 + 10, cx + 10, y0 + title_h / 2 - 10], fill=c, width=3)
    cx -= 64
    d.rectangle([cx - 9, y0 + title_h / 2 - 9, cx + 9, y0 + title_h / 2 + 9], outline=c, width=3)
    cx -= 64
    d.line([cx - 10, y0 + title_h / 2, cx + 10, y0 + title_h / 2], fill=c, width=3)
    return y0 + title_h


def button(d, box, s, primary=False, size=30, dark=False):
    if primary:
        rrect(d, box, 10, fill=BLUE)
        col = PAPER
    elif dark:
        rrect(d, box, 10, fill=DARK2, outline=(70, 76, 90), width=2)
        col = DTEXT
    else:
        rrect(d, box, 10, fill=(240, 242, 246), outline=(170, 176, 188), width=2)
        col = INK
    text_c(d, (box[0] + box[2]) / 2, (box[1] + box[3]) / 2, s, font(size), col)


def gray_bar(d, x, y, w, h=18, col=(214, 218, 226)):
    rrect(d, (x, y, x + w, y + h), h // 2, fill=col)


def dark_menu(d, x, y, rows, w=None, size=30, row_h=62):
    """rows: 문자열 또는 ('글', '오른쪽글', 흐림여부) / '-' = 구분선. 각 줄 상자 목록을 돌려준다."""
    f = font(size)
    if w is None:
        w = 0
        for r in rows:
            if r == '-':
                continue
            if isinstance(r, tuple):
                w = max(w, d.textlength(r[0], font=f) + (d.textlength(r[1], font=f) + 60 if r[1] else 0))
            else:
                w = max(w, d.textlength(r, font=f))
        w = int(w + 110)
    h = sum(18 if r == '-' else row_h for r in rows) + 20
    rrect(d, (x + 6, y + 8, x + w + 6, y + h + 8), 12, fill=(200, 204, 212))
    rrect(d, (x, y, x + w, y + h), 12, fill=DARK, outline=(70, 76, 90), width=2)
    yy = y + 10
    boxes = []
    for r in rows:
        if r == '-':
            d.line([x + 20, yy + 9, x + w - 20, yy + 9], fill=(70, 76, 90), width=2)
            yy += 18
            boxes.append(None)
            continue
        if isinstance(r, tuple):
            s, right, dim = (list(r) + [None, False])[:3]
        else:
            s, right, dim = r, None, False
        col = DDIM if dim else DTEXT
        d.text((x + 50, yy + row_h / 2 - size * 0.62), s, font=f, fill=col)
        if right:
            rw = d.textlength(right, font=font(size - 4))
            d.text((x + w - 30 - rw, yy + row_h / 2 - size * 0.55), right, font=font(size - 4), fill=DDIM)
        boxes.append((x + 8, yy + 4, x + w - 8, yy + row_h - 4))
        yy += row_h
    return (x, y, x + w, y + h), boxes


def tray_icon(d, cx, cy, color, size=40, pause=False):
    s = size / 32.0
    x0, y0 = cx - 16 * s, cy - 16 * s
    rrect(d, (x0 + 2 * s, y0 + 5 * s, x0 + 30 * s, y0 + 27 * s), int(4 * s), fill=color)
    if pause:
        d.rectangle([x0 + 11 * s, y0 + 10 * s, x0 + 15 * s, y0 + 22 * s], fill=PAPER)
        d.rectangle([x0 + 18 * s, y0 + 10 * s, x0 + 22 * s, y0 + 22 * s], fill=PAPER)
    else:
        for yy in range(2):
            for xx in range(3):
                d.rectangle([x0 + (7 + xx * 7) * s, y0 + (10 + yy * 7) * s, x0 + (12 + xx * 7) * s, y0 + (15 + yy * 7) * s], fill=PAPER)


def msgbox(W, H, title, body, buttons, primary=0, icon='?'):
    """윈도 물음 창 흉내. 단추 상자 목록을 돌려준다"""
    im, d = canvas(W, H)
    x0, y0, x1, y1 = 40, 30, W - 46, H - 40
    top = win_frame(d, (x0, y0, x1, y1), title)
    # 물음표 원
    ix, iy = x0 + 80, top + 90
    d.ellipse([ix - 34, iy - 34, ix + 34, iy + 34], fill=BLUE)
    text_c(d, ix, iy, icon, font(44), PAPER)
    fy = top + 50
    text_l(d, x0 + 150, fy, body, font(30, F4), INK, lh=1.5)
    # 아래 단추 띠
    bh = 110
    d.rectangle([x0 + 2, y1 - bh, x1 - 2, y1 - 12], fill=(243, 244, 247))
    d.rounded_rectangle([x0 + 2, y1 - 24, x1 - 2, y1 - 2], radius=12, fill=(243, 244, 247))
    bw, gap = 170, 22
    bx = x1 - 30 - len(buttons) * bw - (len(buttons) - 1) * gap
    boxes = []
    for i, s in enumerate(buttons):
        b = (bx, y1 - bh + 26, bx + bw, y1 - bh + 84)
        button(d, b, s, primary=(i == primary and False))
        if i == primary:
            rrect(d, b, 10, outline=BLUE, width=3)
        boxes.append(b)
        bx += bw + gap
    return im, d, boxes


def save(im, name):
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, name)
    im.save(p, optimize=True)
    print('%-28s %dx%d' % (name, im.width, im.height))


# ═════════════════════════ 그림들 ═════════════════════════
def m(box, n=None, say=None, side='auto', dash=False):
    return dict(box=box, n=n, say=say, side=side, dash=dash)


def f00():
    save(crop_fig(pre('09_'), (0, 0, 1240, 720), scale=1600 / 1240), '00_과정편표지.png')


def f01():
    im, d = canvas(1500, 480)
    cols = [(60, '보드'), (540, '데이터 케이블'), (1020, '윈도 컴퓨터')]
    for x, name in cols:
        rrect(d, (x, 40, x + 420, 380), 22, fill=SOFT, outline=LINE, width=2)
        text_c(d, x + 210, 430, name, font(36), INK)
    # 보드
    x = 60
    rrect(d, (x + 40, 100, x + 380, 320), 18, fill=DARK, outline=(80, 86, 100), width=4)
    for r in range(2):
        for c in range(8):
            cx = x + 70 + c * 40; cy = 150 + r * 80
            rrect(d, (cx - 15, cy - 15, cx + 15, cy + 15), 6, fill=(60, 66, 82), outline=(110, 140, 220), width=2)
            d.rectangle([cx - 12, cy + 24, cx + 12, cy + 28], fill=(110, 116, 130))
    # 케이블
    x = 540
    d.line([(x + 95, 210), (x + 150, 210)], fill=(60, 64, 72), width=10)
    pts = []
    for i in range(0, 41):
        tt = i / 40
        pts.append((x + 150 + tt * 120, 210 + math.sin(tt * math.pi * 2) * 50))
    d.line(pts, fill=(60, 64, 72), width=10, joint='curve')
    d.line([(x + 270, 210), (x + 325, 210)], fill=(60, 64, 72), width=10)
    rrect(d, (x + 40, 190, x + 100, 230), 8, fill=(150, 156, 168))
    d.rectangle([x + 20, 200, x + 42, 220], fill=(200, 204, 212))
    rrect(d, (x + 320, 192, x + 380, 228), 8, fill=(150, 156, 168))
    rrect(d, (x + 378, 202, x + 398, 218), 4, fill=(200, 204, 212))
    text_c(d, x + 210, 320, '자료를 주고받는 선', font(28, F4), GRAY)
    # 컴퓨터
    x = 1020
    rrect(d, (x + 60, 90, x + 360, 280), 12, fill=(60, 66, 82))
    rrect(d, (x + 74, 104, x + 346, 266), 6, fill=(190, 214, 245))
    d.polygon([(x + 190, 280), (x + 230, 280), (x + 245, 320), (x + 175, 320)], fill=(120, 126, 138))
    rrect(d, (x + 140, 318, x + 280, 334), 6, fill=(120, 126, 138))
    save(im, '01_준비물.png')


def f02():
    im, d = canvas(1500, 640)
    # 7인치 옆면
    rrect(d, (60, 60, 720, 520), 20, fill=SOFT, outline=LINE, width=2)
    text_c(d, 390, 100, '7인치 보드(옆면)', font(34), INK)
    rrect(d, (110, 200, 670, 300), 16, fill=DARK, outline=(80, 86, 100), width=3)
    ports = [(240, 'USB'), (480, 'UART')]
    for cx, lab in ports:
        rrect(d, (cx - 50, 228, cx + 50, 272), 12, fill=(150, 156, 168), outline=(220, 224, 230), width=3)
        rrect(d, (cx - 30, 242, cx + 30, 258), 6, fill=(60, 64, 72))
        text_c(d, cx, 330, lab, font(34), INK)
    b = (480 - 66, 214, 480 + 66, 360)
    _, _ = mark(d, im.size, b, n=1)
    text_c(d, 390, 440, '‘UART’ 글자가 적힌 단자에\n꽂아요', font(32), RED)
    # 4인치 옆면
    rrect(d, (780, 60, 1440, 520), 20, fill=SOFT, outline=LINE, width=2)
    text_c(d, 1110, 100, '4인치 보드(옆면)', font(34), INK)
    rrect(d, (880, 200, 1340, 300), 16, fill=DARK, outline=(80, 86, 100), width=3)
    cx = 1110
    rrect(d, (cx - 50, 228, cx + 50, 272), 22, fill=(150, 156, 168), outline=(220, 224, 230), width=3)
    rrect(d, (cx - 30, 242, cx + 30, 258), 8, fill=(60, 64, 72))
    text_c(d, cx, 330, 'USB-C', font(34), INK)
    mark(d, im.size, (cx - 66, 214, cx + 66, 360), n=2)
    text_c(d, 1110, 440, 'USB-C 단자에 꽂아요', font(32), RED)
    caption_under(d, 750, 590, '단자 위치는 보드마다 조금 달라요. 보드에 적힌 글자를 보세요.')
    save(im, '02_단자위치.png')


def browser(d, box, url='', active_url=False):
    x0, y0, x1, y1 = box
    rrect(d, (x0 + 6, y0 + 8, x1 + 6, y1 + 8), 14, fill=(225, 228, 234))
    rrect(d, box, 14, fill=PAPER, outline=(150, 156, 168), width=2)
    d.rounded_rectangle([x0 + 2, y0 + 2, x1 - 2, y0 + 120], radius=12, fill=(236, 238, 242))
    d.line([x0 + 2, y0 + 120, x1 - 2, y0 + 120], fill=(200, 204, 212), width=2)
    # 탭
    rrect(d, (x0 + 20, y0 + 12, x0 + 330, y0 + 56), 10, fill=PAPER)
    gray_bar(d, x0 + 44, y0 + 27, 180, 14)
    # 앞뒤 단추
    for i, ch in enumerate(['←', '→', '⟳']):
        text_c(d, x0 + 44 + i * 52, y0 + 88, ch, font(30), GRAY)
    ab = (x0 + 190, y0 + 66, x1 - 120, y0 + 110)
    rrect(d, ab, 22, fill=PAPER, outline=(BLUE if active_url else (200, 204, 212)), width=3 if active_url else 2)
    if url:
        d.text((ab[0] + 26, ab[1] + 6), url, font=font(30, F4), fill=INK)
    text_c(d, x1 - 60, y0 + 88, '⋯', font(30), GRAY)
    return ab, y0 + 120


def keycap(d, box, s, size=30, hot=False):
    rrect(d, (box[0], box[1] + 6, box[2], box[3] + 6), 10, fill=(170, 176, 188))
    rrect(d, box, 10, fill=PAPER, outline=(150, 156, 168), width=2)
    text_c(d, (box[0] + box[2]) / 2, (box[1] + box[3]) / 2, s, font(size), INK)


def f03():
    im, d = canvas(1500, 520)
    ab, top = browser(d, (40, 30, 1180, 480), url='penedu.web.app/deck', active_url=True)
    for i in range(4):
        gray_bar(d, 120, top + 70 + i * 50, [700, 560, 640, 400][i], 20, (232, 235, 240))
    mark(d, im.size, ab, n=1, say='여기를 누르고\n이 글자를 그대로 쳐요', side='b')
    kb = (1260, 200, 1440, 290)
    keycap(d, kb, 'Enter', 36)
    mark(d, im.size, kb, n=2)
    arrow(d, (1185, 245), (1250, 245))
    text_c(d, 1350, 350, '마지막에 Enter', font(30), INK)
    save(im, '03_주소입력.png')


def f04():
    im, d = canvas(1600, 640)
    ab, top = browser(d, (30, 30, 1570, 560), url='penedu.web.app/deck')
    # 본문 가운데 큰 단추
    gray_bar(d, 160, top + 60, 520, 26, (226, 230, 236))
    gray_bar(d, 160, top + 110, 420, 18, (232, 235, 240))
    btn = (160, top + 170, 520, top + 260)
    button(d, btn, '도우미 받기', primary=True, size=38)
    mark(d, im.size, btn, n=1, say='누르면 받기 시작', side='b')
    # 받은 파일 목록
    px0, py0, px1 = 900, top + 6, 1540
    rrect(d, (px0 + 6, py0 + 8, px1 + 6, py0 + 378), 14, fill=(215, 218, 226))
    rrect(d, (px0, py0, px1, py0 + 370), 14, fill=PAPER, outline=(150, 156, 168), width=2)
    d.text((px0 + 24, py0 + 18), '다운로드', font=font(30), fill=INK)
    d.line([px0 + 2, py0 + 70, px1 - 2, py0 + 70], fill=(220, 224, 230), width=2)
    rrect(d, (px0 + 24, py0 + 92, px0 + 74, py0 + 142), 8, fill=(255, 214, 120), outline=(200, 150, 40), width=2)
    d.text((px0 + 92, py0 + 92), '받은 압축 파일', font=font(30), fill=INK)
    d.text((px0 + 92, py0 + 132), '흔하지 않은 파일이라는 경고', font=font(24, F4), fill=(190, 90, 40))
    dots = (px1 - 86, py0 + 94, px1 - 30, py0 + 140)
    text_c(d, (dots[0] + dots[2]) / 2, (dots[1] + dots[3]) / 2, '⋯', font(40), INK)
    mark(d, im.size, dots, n=2, pad=6)
    # 작은 메뉴
    mb, rows = None, None
    mx, my = px1 - 300, py0 + 212
    rrect(d, (mx + 5, my + 7, mx + 265, my + 137), 10, fill=(215, 218, 226))
    rrect(d, (mx, my, mx + 260, my + 130), 10, fill=PAPER, outline=(150, 156, 168), width=2)
    d.text((mx + 30, my + 16), '유지', font=font(32), fill=INK)
    gray_bar(d, mx + 30, my + 88, 150, 18)
    mark(d, im.size, (mx + 14, my + 10, mx + 246, my + 64), n=3, say='경고가 보일 때만', side='l')
    caption_under(d, 800, 605, '브라우저에 따라 모양과 글자가 조금 달라요.')
    save(im, '04_받기유지.png')


def folder_icon(d, x, y, s=1.0):
    d.polygon([(x, y + 8 * s), (x + 18 * s, y + 8 * s), (x + 24 * s, y), (x + 50 * s, y), (x + 50 * s, y + 40 * s), (x, y + 40 * s)], fill=(250, 200, 80))


def zip_icon(d, x, y, w=70, h=80):
    rrect(d, (x, y, x + w, y + h), 8, fill=(255, 214, 120), outline=(200, 150, 40), width=3)
    for i in range(5):
        d.rectangle([x + w / 2 - 6, y + 6 + i * 14, x + w / 2 + 6, y + 13 + i * 14], fill=(120, 90, 30))


def exe_icon(d, x, y, w=70, h=80):
    rrect(d, (x, y, x + w, y + h), 8, fill=(236, 240, 248), outline=(150, 156, 168), width=3)
    tray_icon(d, x + w / 2, y + h / 2, (130, 130, 130), size=46)


def f05():
    im, d = canvas(1600, 640)
    # 왼쪽 탐색기
    x0, y0, x1, y1 = 30, 30, 820, 580
    top = win_frame(d, (x0, y0, x1, y1), '다운로드')
    d.rectangle([x0 + 2, top + 2, x0 + 250, y1 - 14], fill=(246, 247, 250))
    rows = ['바탕 화면', '다운로드', '문서', '사진']
    for i, s in enumerate(rows):
        yy = top + 30 + i * 70
        folder_icon(d, x0 + 26, yy + 6, 0.7)
        d.text((x0 + 76, yy), s, font=font(30), fill=INK)
    mark(d, im.size, (x0 + 16, top + 30 + 70 - 8, x0 + 236, top + 30 + 70 + 44), n=1)
    zip_icon(d, x0 + 300, top + 40)
    d.text((x0 + 390, top + 60), '받은 압축 파일', font=font(32), fill=INK)
    mark(d, im.size, (x0 + 290, top + 30, x0 + 640, top + 130), n=2, say='두 번 눌러요', side='b')
    # 화살표
    arrow(d, (835, 300), (905, 300))
    # 오른쪽 압축 안
    x0, y0, x1, y1 = 920, 30, 1570, 580
    top = win_frame(d, (x0, y0, x1, y1), '받은 압축 파일')
    exe_icon(d, x0 + 40, top + 40)
    d.text((x0 + 130, top + 62), '교실알림판_도우미.exe', font=font(32), fill=INK)
    mark(d, im.size, (x0 + 30, top + 30, x0 + 560, top + 130), n=3, say='이것을 두 번 눌러요', side='b')
    caption_under(d, 800, 610, '압축을 풀지 않아도 돼요. 파일 이름은 조금 다를 수 있어요.', 28)
    save(im, '05_압축열기.png')


def f06():
    im, d = canvas(1600, 640)
    BL = (0, 103, 184)

    def panel(x, show_btn):
        rrect(d, (x, 30, x + 700, 560), 6, fill=BL)
        d.text((x + 50, 80), 'Windows의 PC 보호', font=font(44), fill=PAPER)
        for i, w in enumerate([560, 600, 420]):
            gray_bar(d, x + 50, 170 + i * 46, w, 18, (90, 150, 210))
        return x
    panel(30, False)
    lx, ly = 80, 330
    d.text((lx, ly), '추가 정보', font=font(32), fill=PAPER)
    d.line([lx, ly + 44, lx + d.textlength('추가 정보', font=font(32)), ly + 44], fill=PAPER, width=2)
    mark(d, im.size, (lx - 6, ly - 6, lx + 150, ly + 50), n=1, say='먼저 여기를 눌러요', side='b')
    arrow(d, (745, 300), (845, 300))
    x = 870
    panel(x, True)
    for i, w in enumerate([300, 260]):
        gray_bar(d, x + 50, 320 + i * 40, w, 16, (90, 150, 210))
    b1 = (x + 220, 460, x + 440, 530)
    b2 = (x + 460, 460, x + 680, 530)
    rrect(d, b1, 4, fill=BL, outline=PAPER, width=3)
    text_c(d, (b1[0] + b1[2]) / 2, 495, '실행', font(32), PAPER)
    rrect(d, b2, 4, fill=(220, 225, 232))
    text_c(d, (b2[0] + b2[2]) / 2, 495, '실행 안 함', font(32), INK)
    mark(d, im.size, b1, n=2, say='그다음 [실행]', side='t')
    caption_under(d, 800, 600, '처음 한 번만 나와요. 화면 글자는 윈도 판에 따라 조금 다를 수 있어요.', 28)
    save(im, '06_PC보호.png')


def taskbar(d, W, y, h=80):
    d.rectangle([0, y, W, y + h], fill=(238, 240, 244))
    d.line([0, y, W, y], fill=(200, 204, 212), width=2)


def f07():
    W, H = 1500, 760
    im, d = canvas(W, H, (214, 226, 240))
    ty = H - 90
    taskbar(d, W, ty, 90)
    # 오른쪽: ^  (알림판)  소리·와이파이  시계
    cy = ty + 45
    up = (W - 520, ty + 14, W - 460, ty + 76)
    text_c(d, (up[0] + up[2]) / 2, cy + 4, '^', font(44), INK)
    for i in range(3):
        gray_bar(d, W - 420 + i * 50, cy - 12, 26, 24, (170, 176, 188))
    d.text((W - 230, cy - 34), '오전 9:00', font=font(28, F4), fill=INK)
    d.text((W - 236, cy + 2), '2026-10-27', font=font(24, F4), fill=GRAY)
    # 펼친 숨은 아이콘 상자
    px0, py0, px1, py1 = up[0] - 90, ty - 200, up[2] + 90, ty - 30
    rrect(d, (px0 + 5, py0 + 7, px1 + 5, py1 + 7), 14, fill=(180, 190, 205))
    rrect(d, (px0, py0, px1, py1), 14, fill=(248, 249, 251), outline=(170, 176, 188), width=2)
    icons = [(px0 + 50, py0 + 50), (px0 + 120, py0 + 50), (px0 + 190, py0 + 50),
             (px0 + 50, py0 + 120), (px0 + 120, py0 + 120)]
    for i, (ix, iy) in enumerate(icons):
        if i == 4:
            tray_icon(d, ix, iy, (130, 130, 130), size=48)
            ib = (ix - 26, iy - 26, ix + 26, iy + 26)
        else:
            rrect(d, (ix - 18, iy - 18, ix + 18, iy + 18), 8, fill=(200, 205, 214))
    mark(d, im.size, up, n=1, say='숨은 아이콘 보기', side='l', pad=6)
    mark(d, im.size, ib, n=2, say='회색 도우미 아이콘', side='l', pad=8)
    # 풍선 알림(오른쪽 위)
    bx0, by0, bx1, by1 = 40, 40, 760, 260
    rrect(d, (bx0 + 6, by0 + 8, bx1 + 6, by1 + 8), 14, fill=(180, 190, 205))
    rrect(d, (bx0, by0, bx1, by1), 14, fill=(250, 251, 253), outline=(170, 176, 188), width=2)
    tray_icon(d, bx0 + 50, by0 + 52, (130, 130, 130), size=44)
    d.text((bx0 + 90, by0 + 32), '교실 알림판 도우미', font=font(30), fill=INK)
    text_l(d, bx0 + 40, by0 + 100, '설치했어요. 컴퓨터를 켤 때 저절로 켜져요.\n아이콘을 오른쪽 클릭하면 메뉴가 나와요.', font(28, F4), INK, lh=1.5)
    text_c(d, (bx0 + bx1) / 2, by1 + 40, '처음 깔면 화면 오른쪽 아래에 이런 알림이 잠깐 떠요', font(26, F4), GRAY)
    save(im, '07_알림영역아이콘.png')


def f08():
    im, d = canvas(1400, 440)
    items = [((130, 130, 130), False, '찾는 중', '보드를 찾고 있어요'),
             ((34, 160, 90), False, '연결됨', '보드와 이어졌어요'),
             ((220, 150, 30), True, '잠깐 멈춤', '메뉴에서 멈춘 상태')]
    for i, (c, p, name, sub) in enumerate(items):
        cx = 233 + i * 467
        rrect(d, (cx - 190, 40, cx + 190, 330), 22, fill=SOFT, outline=LINE, width=2)
        tray_icon(d, cx, 140, c, size=130, pause=p)
        text_c(d, cx, 250, name, font(38), INK)
        text_c(d, cx, 298, sub, font(26, F4), GRAY)
        if i == 1:
            mark(d, im.size, (cx - 190, 40, cx + 190, 330), n=1, pad=6)
    text_c(d, 700, 395, '초록이 되면 성공이에요', font(34), GREEN)
    # 위 글 앞 기호 바꾸기(번호 원과 같은 모양)
    save(im, '08_아이콘색.png')


def f09():
    im, d = canvas(1500, 760)
    rows = [('연결됨: 7인치(…)', None, True), '단축키 꾸미기…', '-', '예전 보드만 쓰는 프로그램 목록', '기록 보기',
            '잠깐 멈추기(보드 굽기 전에)', '컴퓨터를 켤 때 저절로 켜기', '-', '끝내기']
    mb, boxes = dark_menu(d, 60, 40, rows, size=32, row_h=70)
    # 체크 표시(저절로 켜기는 보통 켜져 있음)
    b = boxes[6]
    d.text((b[0] + 12, b[1] + 12), '✓', font=font(30), fill=DTEXT)
    sides = []
    mark(d, im.size, boxes[1], n=1, say='창 열기(두 번 클릭과 같아요)', side='r')
    mark(d, im.size, boxes[4], n=2, say='문제가 생겼을 때 봐요(과정 13)', side='r')
    mark(d, im.size, boxes[5], n=3, say='평소엔 꺼 둬요', side='r')
    text_l(d, boxes[0][2] + 40, boxes[0][1] + 8, '맨 위 회색 줄 = 지금 상태', font(28, F4), GRAY)
    caption_under(d, 750, 720, '도우미 아이콘을 오른쪽 클릭하면 나오는 메뉴예요. 괄호 안 글자는 컴퓨터마다 달라요.', 28)
    save(im, '09_도우미메뉴.png')


def f10():
    src = load(os.path.join(IMG, 'board.png'))
    save(crop_fig(src, (0, 405, 992, 465), scale=1.6, pad=(20, 20, 20, 120),
                  marks=[m((310, 425, 680, 452), 1, '이 글이 보이면 연결 성공', 'b'),
                         m((918, 418, 978, 458), 2, '새로 고침', 'b')]), '10_보드연결글.png')


def f11():
    src = pre('01_')
    marks = [m((0, 0, 1240, 52), 1, '① 위 띠', 'b'), m((55, 133, 887, 405), 2, '② 보드 모양(16칸)', 'b'),
             m((940, 52, 1240, 665), 3, '③ 동작 목록', 'l'), m((0, 457, 940, 665), 4, '④ 칸 설정', 't'),
             m((0, 665, 1240, 720), 5, '⑤ 맨 아래 줄', 't')]
    # 큰 상자는 안쪽으로 줄여 겹치지 않게
    marks[0]['box'] = (6, 6, 1234, 46); marks[2]['box'] = (946, 58, 1234, 659)
    marks[3]['box'] = (6, 463, 934, 659); marks[4]['box'] = (6, 671, 1234, 714)
    for mm in marks:
        mm['say'] = None; mm['n'] = None
    im = crop_fig(src, (0, 0, 1240, 720), marks=marks, scale=1600 / 1240)
    d = Draw(im)
    s = 1600 / 1240

    # 이름표(번호 + 이름, 구역 안쪽 빈 곳)
    def tag(x, y, n, t):
        f = font(34)
        w = d.textlength(t, font=f) + 30
        rrect(d, (x + 30, y, x + 30 + w + 24, y + 54), 12, fill=RED)
        d.text((x + 70, y + 8), t, font=f, fill=PAPER)
        badge(d, x + 26, y + 27, n, 50)
    tag(230 * s, 4 * s, 1, '위 띠')
    tag(60 * s, 410 * s - 4, 2, '보드 모양(16칸)')
    tag(1035 * s, 58 * s + 4, 3, '동작 목록')
    tag(450 * s, 466 * s, 4, '칸 설정')
    tag(380 * s, 670 * s, 5, '맨 아래 줄')
    save(im, '11_창다섯구역.png')


def f12():
    save(crop_fig(pre('15_'), (400, 255, 840, 465), scale=2, pad=(20, 20, 20, 110),
                  marks=[m((719, 408, 814, 438), 1, '다음 설명', 'b'), m((430, 408, 510, 438), 2, '그만 보기', 'b')]),
         '12_둘러보기안내.png')


def f13():
    save(crop_fig(pre('01_'), (0, 140, 940, 660), scale=1600 / 940,
                  marks=[m((76, 153, 166, 265), 1, '1번 칸을 눌러요', 'r'),
                         m((150, 470, 420, 495), 2, '고른 칸 자리', 'r'),
                         m((765, 473, 923, 504), 3, '이 컴퓨터에서 해 보기', 't')]), '13_칸고르고눌러보기.png')


def f14():
    save(crop_fig(pre('01_'), (0, 665, 1240, 720), scale=1600 / 1240, pad=(20, 20, 20, 120),
                  marks=[m((10, 680, 300, 705), 1, '연결 상태 글', 'b'),
                         m((901, 674, 996, 710), 2, '닫기', 'bl'),
                         m((1005, 673, 1224, 711), 3, '보내기는 과정 11에서', 'b')]), '14_연결글과닫기.png')


def f15():
    im, d, bx = msgbox(1300, 470, '단축키 꾸미기', '저장하지 않은 변경이 있어요. 저장할까요?', ['예', '아니요', '취소'])
    mark(d, im.size, bx[1], n=1, say='연습이었으면 [아니요]', side='t')
    save(im, '15_저장물음.png')


def f16():
    save(crop_fig(pre('18_'), (12, 172, 360, 444), scale=2, pad=(20, 20, 620, 20),
                  marks=[m((30, 240, 300, 265), 1, '해 보면 저절로 ✓', 'r'),
                         m((290, 190, 335, 212), 2, '목록 닫기', 'r')]), '16_연습과제.png')


def f17():
    im, d = canvas(1300, 560)
    rows = [('눌러 보기(이 컴퓨터에서)', 'Enter'), '-', ('복사', 'Ctrl+C'), ('붙여넣기', 'Ctrl+V'), ('비우기', 'Delete'), '-',
            ('아이콘 바꾸기', '▸')]
    mb, boxes = dark_menu(d, 60, 40, rows, size=32, row_h=72)
    mark(d, im.size, boxes[4], n=1, say='칸을 비워요', side='r')
    caption_under(d, 650, 520, '칸을 오른쪽 클릭하면 나오는 메뉴예요.', 30)
    save(im, '17_칸메뉴.png')


def f18():
    save(crop_fig(pre('05_'), (0, 140, 940, 660), scale=1600 / 940,
                  marks=[m((775, 273, 868, 385), 1, '비운 16번 칸', 'b'),
                         m((215, 590, 600, 610), 2, '빈 칸 도움말', 'r')]), '18_빈칸모습.png')


def f19():
    save(crop_fig(pre('04_'), (940, 52, 1240, 330), scale=2, pad=(20, 20, 560, 20),
                  caption='‘소리’를 친 예예요. ‘한글’도 똑같이 쳐요.',
                  marks=[m((957, 97, 1224, 128), 1, '여기를 누르고 글자를 쳐요', 'r')]), '19_찾기칸.png')


def f20():
    def ex(d, tr, can):
        a = tr((957, 180, 1224, 200)); b = tr((777, 275, 866, 365))
        arrow(d, (a[0] + 20, (a[1] + a[3]) / 2 + 10), ((b[0] + b[2]) / 2 + 10, (b[1] + b[3]) / 2 - 5), width=7, head=28)
    save(crop_fig(pre('05_'), (560, 140, 1240, 420), scale=2, extra=ex,
                  caption='목록의 줄을 누른 채 끌어서 칸 위에서 놓아요',
                  marks=[m((957, 180, 1224, 200), 1, None), m((777, 275, 866, 365), 2, None)]), '20_끌어놓기.png')


def f21():
    save(crop_fig(pre('02_'), (0, 460, 940, 660), scale=1600 / 940,
                  caption='카카오톡 칸의 예예요. 한글 칸도 같은 모양이에요.',
                  marks=[m((217, 505, 457, 535), 1, '이름', 'r'), m((219, 547, 318, 574), 2),
                         m((217, 585, 560, 616), 3), m((765, 473, 923, 504), 4)]), '21_칸설정읽기.png')


def f22():
    save(crop_fig(pre('07_'), (140, 540, 760, 645), scale=2, pad=(20, 20, 20, 20),
                  caption='제미나이 칸의 예예요. 주소만 나이스로 바꿔요.',
                  marks=[m((320, 547, 406, 574), 1), m((217, 585, 664, 616), 2), m((672, 585, 752, 616), 3)]),
         '22_사이트열기고르기.png')


def f23():
    save(crop_fig(pre('07_'), (140, 498, 660, 540), scale=2.4, pad=(20, 20, 20, 110),
                  caption='이름이 길면 이렇게 알려 줘요. 한글 6자 안쪽으로.',
                  marks=[m((217, 505, 457, 535), 1, '주황 테두리', 'b'), m((466, 510, 630, 530), 2, '경고 글', 'b')]),
         '23_이름경고.png')


def f24():
    save(crop_fig(pre('14_'), (0, 0, 520, 230), scale=2, pad=(20, 110, 520, 20),
                  marks=[m((231, 42, 306, 74), 1, '엣지를 눌러요', 't'),
                         m((20, 92, 330, 110), 2, '보통은 안 켜도 돼요', 'r'),
                         m((305, 181, 401, 215), 3, '확인', 'l')], extra_pre=_edge_on), '24_브라우저고르기.png')


def f25():
    im, d = canvas(1300, 820)
    # 아이콘 상자
    rrect(d, (60, 40, 300, 280), 18, fill=DARK, outline=(70, 76, 90), width=2)
    rrect(d, (110, 90, 250, 230), 22, fill=(30, 40, 60), outline=(70, 140, 240), width=5)
    text_c(d, 180, 160, '나', font(60), (120, 180, 255))
    db = (60, 300, 300, 360)
    rrect(d, db, 10, fill=DARK2, outline=(70, 76, 90), width=2)
    text_c(d, 180, 330, '아이콘 바꾸기 ▾', font(28), DTEXT)
    rows = [('자동(프로그램에서)', None, True), '글자', '사이트 아이콘 받기', '그림 파일…', ('기본 그림', '▸'), '모음에서 고르기…']
    mb, boxes = dark_menu(d, 60, 372, rows, size=30, row_h=62)
    mark(d, im.size, boxes[2], n=1, say='인터넷에서 받아요', side='r')
    mark(d, im.size, boxes[5], n=2, say='모음 205개에서 골라요', side='r')
    text_c(d, 900, 120, '하는 일에 맞지 않는 줄은\n흐리게 보여요', font(32, F4), GRAY)
    save(im, '25_아이콘메뉴.png')


def f26():
    save(crop_fig(pre('10_'), (140, 465, 760, 645), scale=2, pad=(20, 20, 20, 20),
                  marks=[m((409, 547, 508, 574), 1, '단축키 누르기', 't'),
                         m((640, 585, 752, 616), 2, '눌러서 넣기', 'b')]), '26_단축키고르기.png')


def f27():
    save(crop_fig(pre('12_'), (0, 0, 480, 250), scale=2, pad=(20, 20, 640, 100),
                  marks=[m((20, 146, 372, 168), 1, '먼저 여기에 체크', 'r'),
                         m((20, 52, 460, 116), 2, '누른 키가 보여요', 'r'),
                         m((265, 200, 361, 232), 3, '확인', 'b'),
                         m((20, 200, 116, 232), None, '잘못 누르면 [다시]', 'b', dash=True)]), '27_눌러넣기창.png')


def f28():
    im, d = canvas(1500, 600)
    K = 100; G = 12
    x0, y0 = 60, 60
    rrect(d, (30, 30, 1470, 470), 24, fill=(232, 235, 240), outline=LINE, width=2)
    row2 = ['A', 'S', 'D', 'F', 'G', 'H', 'J']
    row3 = ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
    # 가운데 줄
    xx = x0 + 170
    keycap(d, (x0, y0, x0 + 158, y0 + K), '', 26)
    sbox = None
    for k in row2:
        b = (xx, y0, xx + K, y0 + K); keycap(d, b, k, 36)
        if k == 'S':
            sbox = b
        xx += K + G
    # 아랫줄
    y = y0 + K + G + 6
    shb = (x0, y, x0 + 220, y + K); keycap(d, shb, 'Shift', 34)
    xx = x0 + 232
    for k in row3:
        keycap(d, (xx, y, xx + K, y + K), k, 36); xx += K + G
    # 맨 아랫줄
    y = y + K + G + 6
    cb = (x0, y, x0 + 140, y + K); keycap(d, cb, 'Ctrl', 32)
    wb = (x0 + 152, y, x0 + 272, y + K); keycap(d, wb, 'Win', 32)
    ab = (x0 + 284, y, x0 + 404, y + K); keycap(d, ab, 'Alt', 32)
    keycap(d, (x0 + 416, y, x0 + 1000, y + K), '', 30)
    mark(d, im.size, shb, n=1)
    mark(d, im.size, sbox, n=2)
    ring(d, wb, color=GRAY, width=4, pad=8, dash=True)
    text_c(d, 1280, 230, 'Shift를 누른 채\nS를 눌러요', font(38), INK)
    text_c(d, 750, 530, 'Win 키는 누르지 않아요. 창의 체크 칸이 대신해요.', font(30, F4), GRAY)
    save(im, '28_키보드.png')


def f29():
    save(crop_fig(pre('10_'), (210, 580, 760, 645), scale=2.4, pad=(20, 20, 20, 20),
                  marks=[m((217, 585, 632, 616), 1), m((217, 622, 560, 642), 2)]), '29_누를키글.png')


def f30():
    save(crop_fig(pre('10_'), (170, 148, 272, 266), scale=2.2, pad=(20, 20, 20, 20),
                  caption='보드에 보일 모습'), '30_보드칸화면캡처.png')


def f31():
    save(crop_fig(pre('09_'), (140, 465, 760, 645), scale=2, pad=(20, 20, 20, 20),
                  marks=[m((676, 547, 751, 574), 1, '여러 동작', 't'),
                         m((217, 585, 416, 616), 2, '차례를 고치는 창', 'r')]), '31_여러동작고르기.png')


def f32():
    save(crop_fig(pre('11_'), (0, 0, 720, 260), scale=2,
                  marks=[m((20, 44, 540, 250), 1), m((553, 44, 700, 78), 2), m((553, 86, 700, 162), 3),
                         m((553, 170, 700, 204), 4), m((553, 216, 700, 250), 5)]), '32_차례창위.png')


def f33():
    save(crop_fig(pre('11_'), (0, 260, 720, 520), scale=2,
                  marks=[m((22, 293, 700, 323), 1), m((20, 335, 460, 367), 2), m((331, 423, 398, 450), 3),
                         m((505, 471, 600, 504), 4)]), '33_차례창아래.png')


def f34():
    im, d = canvas(1600, 420)
    y = 170
    # 단추 누름
    rrect(d, (30, y - 70, 230, y + 70), 20, fill=DARK, outline=(110, 140, 220), width=4)
    text_c(d, 130, y - 10, '수', font(54), (120, 180, 255))
    text_c(d, 130, y + 105, '보드 단추\n한 번', font(28), INK)
    boxes = [(330, '파워포인트\n열림'), (790, '나이스 열림\n(엣지)'), (1250, '소리 꺼짐')]
    arrow(d, (240, y), (320, y), color=BLUE, width=6)
    for i, (x, t) in enumerate(boxes):
        rrect(d, (x, y - 70, x + 300, y + 70), 18, fill=(232, 240, 255), outline=BLUE, width=3)
        text_c(d, x + 150, y, t, font(32), INK)
        badge(d, x + 6, y - 66, i + 1, 42)
        if i < 2:
            dashed_line(d, (x + 310, y), (x + 440, y), GRAY, 5)
            arrow(d, (x + 430, y), (x + 452, y), color=GRAY, width=5, head=20)
            text_c(d, x + 380, y - 40, ['2초', '1초'][i], font(34), INK)
            text_c(d, x + 380, y + 42, '기다리기', font(24, F4), GRAY)
    text_c(d, 800, 370, '칸 한 번 누르기 = 세 가지 일을 차례대로', font(34), INK)
    save(im, '34_시간줄.png')


def f35():
    save(crop_fig(pre('09_'), (140, 575, 760, 645), scale=2.4, pad=(20, 20, 20, 20),
                  marks=[m((217, 622, 740, 642), 1)]), '35_차례요약.png')


def f36():
    save(crop_fig(pre('02_'), (8, 465, 146, 652), scale=2.5, pad=(20, 20, 560, 20),
                  marks=[m((16, 473, 136, 592), 1, '지금 아이콘', 'r'), m((17, 601, 136, 628), 2, '아이콘 바꾸기', 'r'),
                         m((35, 632, 120, 648), 3, '지금 어떤 방식인지', 'r')]), '36_아이콘상자.png')


def f37():
    body = '이 그림을 3번 칸 아이콘으로 넣을까요?\n\n[예] 틀에 넣기 — 기호만 있는 그림\n[아니요] 그대로 — 테두리까지 다 그린 완성 그림'
    im, d, bx = msgbox(1400, 560, '단축키 꾸미기', body, ['예', '아니요', '취소'])
    mark(d, im.size, bx[0], n=1, say='기호만 있는 그림', side='l')
    mark(d, im.size, bx[1], n=2, say='완성 그림', side='b' if False else 't')
    save(im, '37_그림넣기물음.png')


def book(d, cx, cy, s, col):
    # 단순한 펼친 책
    d.polygon([(cx - 60 * s, cy - 40 * s), (cx, cy - 25 * s), (cx, cy + 50 * s), (cx - 60 * s, cy + 35 * s)], outline=col, width=int(8 * s))
    d.polygon([(cx + 60 * s, cy - 40 * s), (cx, cy - 25 * s), (cx, cy + 50 * s), (cx + 60 * s, cy + 35 * s)], outline=col, width=int(8 * s))


def checker(d, box, sq=20):
    x0, y0, x1, y1 = box
    for yy in range(int(y0), int(y1), sq):
        for xx in range(int(x0), int(x1), sq):
            c = (235, 237, 241) if ((xx - x0) // sq + (yy - y0) // sq) % 2 == 0 else PAPER
            d.rectangle([xx, yy, min(xx + sq, x1), min(yy + sq, y1)], fill=c)


def f38():
    im, d = canvas(1600, 720)
    b0 = (60, 200, 360, 500)
    checker(d, b0); d.rectangle(b0, outline=LINE, width=2)
    book(d, 210, 350, 1.6, (40, 90, 200))
    text_c(d, 210, 560, '내 그림\n(기호만, 바탕 투명)', font(28), INK)
    # [예] 위
    arrow(d, (380, 300), (640, 190), color=RED)
    text_c(d, 480, 200, '[예]', font(34), RED)
    b1 = (660, 30, 960, 330)
    rrect(d, b1, 20, fill=SOFT)
    rrect(d, (690, 60, 930, 300), 40, fill=(24, 30, 44), outline=(70, 140, 240), width=8)
    book(d, 810, 180, 1.2, (120, 180, 255))
    text_l(d, 1010, 130, '틀에 넣기\n어두운 둥근 틀 안에 들어가요', font(32), INK)
    # [아니요] 아래
    arrow(d, (380, 400), (640, 530), color=RED)
    text_c(d, 470, 520, '[아니요]', font(34), RED)
    b2 = (660, 390, 960, 690)
    checker(d, b2); d.rectangle(b2, outline=LINE, width=2)
    book(d, 810, 540, 1.6, (40, 90, 200))
    text_l(d, 1010, 490, '그대로\n그린 그대로 들어가요', font(32), INK)
    save(im, '38_틀에넣기비교.png')


def f39():
    src = load(os.path.join(LIB, '미리보기_기본.png'))
    save(crop_fig(src, (0, 0, 1152, 600), scale=1.3, caption='모음 205개 가운데 일부'), '39_모음미리보기.png')


def f40():
    save(crop_fig(pre('01_'), (650, 0, 1240, 52), scale=2.6, pad=(20, 20, 20, 140),
                  marks=[m((763, 10, 912, 42), 1, '한 번에 채우기', 'b'),
                         m((921, 10, 1120, 42), 2, '아이콘 모양', 'b'),
                         m((1135, 10, 1230, 42), 3, '더보기', 'b')]), '40_위띠.png')


def f41():
    im, d = canvas(1500, 470)
    rows = ['이 컴퓨터에 깔린 프로그램으로', '-', '수업용 (한글·PPT·발표 넘기기·타이머·소리)',
            '업무용 (나이스·업무포털·메신저·문서·AI)', '발표·원격수업용 (슬라이드·마이크·카메라·화면 공유)']
    mb, boxes = dark_menu(d, 60, 40, rows, size=32, row_h=74)
    mark(d, im.size, boxes[2], n=1)
    caption_under(d, 750, 430, '위 띠의 [한 번에 채우기 ▾]를 누르면 나오는 메뉴예요.', 30)
    save(im, '41_채우기메뉴.png')


def f42():
    body = '16칸을 아래처럼 바꿀까요? (지금 칸은 지워져요. 저장을 눌러야 보드로 가요)'
    im, d, bx = msgbox(1600, 500, '한 번에 채우기', body, ['예', '아니요'])
    text_l(d, 190, 210, '한글 · PPT · 발표 시작 · 이전 장 · 다음 장 · 화면 검게 · 전체 화면 · …', font(28, F4), GRAY)
    mark(d, im.size, bx[0], n=1, say='읽어 보고 [예]', side='l')
    save(im, '42_채우기물음.png')


def f43():
    src = load(os.path.join(LIB, '미리보기_테마비교.png'))
    im = src.crop((120, 0, 1306, 180))
    s = 1.2
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    lw = 230
    can = Image.new('RGB', (im.width + lw, im.height), PAPER)
    can.paste(im, (lw, 0))
    d = Draw(can)
    for i, t in enumerate(['기본(다크)', '따뜻함']):
        cy = (45 + i * 90) * s
        text_c(d, lw / 2, cy, t, font(34), INK)
    d.line([lw, 90 * s, can.width, 90 * s], fill=PAPER, width=3)
    save(can, '43_테마전후.png')


def f44():
    src = pre('07_')
    a = crop_fig(src, (0, 0, 300, 52), scale=2.4, pad=(20, 20, 20, 110),
                 marks=[m((140, 14, 212, 38), 1, '저장 안 함', 'b')])
    b = crop_fig(src, (890, 665, 1240, 720), scale=2.4, pad=(20, 20, 20, 110),
                 marks=[m((1030, 680, 1052, 700), 2, '단추 앞 점', 'b')])
    can = Image.new('RGB', (a.width + 40 + b.width, max(a.height, b.height)), PAPER)
    can.paste(a, (0, 0)); can.paste(b, (a.width + 40, 0))
    save(can, '44_저장안함표시.png')


def f45():
    save(crop_fig(pre('07_'), (270, 148, 770, 270), scale=2.6, pad=(20, 150, 20, 20),
                  marks=[m((348, 157, 362, 171), 1, '주황: 이름이 길어요', 't'),
                         m((548, 157, 562, 171), 2, '빨강: 보드에\n없는 글자(★)', 't'),
                         m((748, 157, 762, 171), 3, '빨강: 이름이\n비었어요', 't')]), '45_이름점.png')


def f46():
    save(crop_fig(pre('02_'), (0, 665, 1240, 720), scale=1600 / 1240, pad=(20, 20, 20, 120),
                  marks=[m((1005, 673, 1224, 711), 1, '저장하고 보내기', 'bl'),
                         m((10, 680, 300, 705), 2, '여기 글이 바뀌어요', 'b')]), '46_보내기단추.png')


def f47():
    im, d = canvas(1600, 640)
    pc = ['저장했어요.\n보드에 보내요', '아이콘 보내는 중\n3/16', '보드에 보냈어요', '연결됨 ·\n보드와 같음']
    bd = [None, '아이콘 받는 중\n3/16', None, '✓ 새 단축키를\n받았습니다']
    text_l(d, 30, 40, '컴퓨터(꾸미기 창 맨 아래 글)', font(32), INK)
    text_l(d, 30, 350, '보드(화면 아래 줄)', font(32), INK)
    xs = [30, 420, 810, 1200]
    for i, x in enumerate(xs):
        rrect(d, (x, 100, x + 360, 240), 16, fill=(232, 240, 255), outline=BLUE, width=3)
        text_c(d, x + 180, 170, pc[i], font(30), INK)
        if i < 3:
            arrow(d, (x + 364, 170), (x + 416, 170), color=BLUE, width=5, head=18)
        if bd[i]:
            dashed_line(d, (x + 180, 248), (x + 180, 400), GRAY, 3)
            rrect(d, (x, 410, x + 360, 550), 16, fill=DARK, outline=(34, 160, 90), width=3)
            text_c(d, x + 180, 480, bd[i], font(30), (110, 220, 150))
    arrow(d, (784, 480), (1196, 480), color=GRAY, width=5, head=18)
    caption_under(d, 800, 600, '세로 점선 = 같은 때. 7인치는 다 바꾸면 1분쯤 걸려요.', 28)
    save(im, '47_보내기글순서.png')


def f48():
    im, d = canvas(1600, 330)
    band = (20, 30, 1580, 200)
    BG = (34, 32, 26)
    rrect(d, band, 18, fill=BG)
    kb = (60, 70, 330, 160)
    rrect(d, kb, 12, fill=(52, 50, 42), outline=(80, 78, 70), width=2)
    text_c(d, 195, 115, '기본 아이콘', font(30), (230, 230, 225))
    msg = '✓ 새 단축키를 받았습니다'
    text_c(d, 800, 115, msg, font(38), (60, 210, 130))
    w = d.textlength(msg, font=font(38))
    rb = (1430, 70, 1540, 160)
    rrect(d, rb, 12, fill=(52, 50, 42), outline=(80, 78, 70), width=2)
    text_c(d, 1485, 115, '⟳', font(46), (230, 230, 225))
    mark(d, im.size, (800 - w / 2 - 10, 85, 800 + w / 2 + 10, 145), n=1)
    caption_under(d, 800, 270, '보드 화면 아래 줄을 단순하게 그린 그림이에요.', 28)
    save(im, '48_보드받음.png')


def f49():
    im, d = canvas(1300, 600)
    db = (60, 40, 260, 100)
    rrect(d, db, 10, fill=DARK2, outline=(70, 76, 90), width=2)
    text_c(d, 160, 70, '더보기 ▾', font(30), DTEXT)
    rows = ['내보내기…', '가져오기…', '-', '기본값으로 되돌리기…', '-', '글꼴 안내']
    mb, boxes = dark_menu(d, 60, 112, rows, size=32, row_h=72, w=460)
    mark(d, im.size, boxes[0], n=1, say='16칸을 파일 하나로 저장', side='r')
    mark(d, im.size, boxes[1], n=2, say='받은 파일을 불러오기', side='r')
    save(im, '49_더보기메뉴.png')


def f50():
    im, d = canvas(1500, 760)
    x0, y0, x1, y1 = 30, 30, 1460, 700
    top = win_frame(d, (x0, y0, x1, y1), '단축키 설정 내보내기')
    d.rectangle([x0 + 2, top + 2, x0 + 330, y1 - 160], fill=(246, 247, 250))
    rows = ['바탕 화면', '다운로드', '문서', '사진']
    for i, s in enumerate(rows):
        yy = top + 30 + i * 70
        folder_icon(d, x0 + 26, yy + 6, 0.7)
        d.text((x0 + 76, yy), s, font=font(30), fill=INK)
    for i in range(3):
        gray_bar(d, x0 + 400, top + 120 + i * 60, [420, 360, 300][i], 22, (232, 235, 240))
    mark(d, im.size, (x0 + 16, top + 22, x0 + 300, top + 74), n=1, say='바탕 화면을 골라요', side='r')
    fy = y1 - 140
    d.text((x0 + 40, fy + 12), '파일 이름:', font=font(30), fill=INK)
    fb = (x0 + 230, fy, x1 - 40, fy + 56)
    rrect(d, fb, 8, fill=PAPER, outline=(170, 176, 188), width=2)
    d.text((fb[0] + 16, fb[1] + 10), '알림판_단축키_1027.zip', font=font(30, F4), fill=INK)
    mark(d, im.size, (fb[0], fb[1], fb[0] + 420, fb[3]), n=2, say='그대로 둬요(뒤 숫자 = 오늘 날짜)', side='r')
    sb = (x1 - 420, y1 - 70, x1 - 230, y1 - 16)
    cb = (x1 - 210, y1 - 70, x1 - 30, y1 - 16)
    button(d, sb, '저장', primary=True)
    button(d, cb, '취소')
    mark(d, im.size, sb, n=3, say='누르면 끝', side='l')
    caption_under(d, 750, 735, '가져오기 창도 같은 모양이에요(제목만 “단축키 설정 가져오기”, 단추는 [열기]).', 26)
    save(im, '50_저장창.png')


def f51():
    im, d = canvas(1640, 420)
    steps = ['내 꾸미기 창', '파일 하나\n(압축 파일)', '옆 반 컴퓨터', '옆 반\n꾸미기 창', '옆 반 보드']
    labels = ['내보내기', '메신저·메일', '가져오기', '저장하고\n보내기']
    bw, gap = 200, 150
    x = 20
    for i, s in enumerate(steps):
        col = (232, 240, 255) if i != 1 else (255, 244, 220)
        rrect(d, (x, 120, x + bw, 280), 18, fill=col, outline=BLUE if i != 1 else (200, 150, 40), width=3)
        text_c(d, x + bw / 2, 200, s, font(30), INK)
        if i < 4:
            arrow(d, (x + bw + 6, 200), (x + bw + gap - 6, 200), color=RED, width=5, head=20)
            text_c(d, x + bw + gap / 2, 120 if '\n' not in labels[i] else 105, labels[i], font(24), RED)
        x += bw + gap
    text_c(d, 820, 360, '압축 파일은 풀지 않고 그대로 주고받아요', font(30, F4), GRAY)
    save(im, '51_나누기흐름.png')


# ───────── 순서도 ─────────
def flow(name, title, nodes, end, W=1500):
    """nodes: ('q', 물음, 옆 답('예'/'아니요'), 옆 할 일) 또는 ('a', 할 일). 아래로 가는 답은 옆 답의 반대."""
    tmp = Image.new('RGB', (10, 10)); td = Draw(tmp)
    fq = font(36); fa = font(34, F4)
    cx = 410; QW = 760
    SX = 900; SW = W - SX - 20
    items = []
    y = 120
    for nd in nodes:
        if nd[0] == 'q':
            t = wrap(td, nd[1], fq, QW - 280)
            lines = t.count('\n') + 1
            h = max(170, 90 + lines * 54)
            side_t = wrap(td, nd[3], fa, SW - 50)
            sh = 44 + (side_t.count('\n') + 1) * 48
            items.append(('q', y, h, t, nd[2], side_t, sh))
            y += max(h, sh) + 90
        else:
            t = wrap(td, nd[1], fq, QW - 130)
            h = 56 + (t.count('\n') + 1) * 50
            items.append(('a', y, h, t))
            y += h + 90
    et = wrap(td, end, fq, QW - 130)
    eh = 56 + (et.count('\n') + 1) * 50
    H = y + eh + 60
    im, d = canvas(W, H)
    text_l(d, 30, 30, title, font(40), INK)
    # 범례
    lx = W - 560
    d.line([lx, 56, lx + 50, 56], fill=GREEN, width=6); d.text((lx + 60, 38), '예', font=font(28), fill=GREEN)
    d.line([lx + 140, 56, lx + 190, 56], fill=RED, width=6); d.text((lx + 200, 38), '아니요', font=font(28), fill=RED)
    for it in items:
        if it[0] == 'q':
            _, yy, h, t, side, side_t, sh = it
            my = yy + h / 2
            pts = [(cx, yy), (cx + QW / 2, my), (cx, yy + h), (cx - QW / 2, my)]
            d.polygon(pts, fill=(255, 248, 225), outline=(200, 150, 40))
            d.line(pts + [pts[0]], fill=(200, 150, 40), width=3)
            text_c(d, cx, my, t, fq, INK)
            scol = GREEN if side == '예' else RED
            dcol = RED if side == '예' else GREEN
            sy = my - sh / 2
            arrow(d, (cx + QW / 2, my), (SX - 4, my), color=scol, width=5, head=20)
            d.text((cx + QW / 2 + 22, my - 44), side, font=font(26), fill=scol)
            rrect(d, (SX, sy, SX + SW, sy + sh), 18, fill=SOFT, outline=scol, width=3)
            text_l(d, SX + 25, sy + 20, side_t, fa, INK, lh=1.42)
            nxt_y = yy + max(h, sh) + 90
            arrow(d, (cx, yy + h), (cx, nxt_y - 4), color=dcol, width=5, head=20)
            d.text((cx + 16, yy + h + 18), '아니요' if side == '예' else '예', font=font(28), fill=dcol)
            # 다음 노드 시작은 가운데 맞춤이므로 위치 보정
        else:
            _, yy, h, t = it
            rrect(d, (cx - QW / 2 + 30, yy, cx + QW / 2 - 30, yy + h), 22, fill=(232, 240, 255), outline=BLUE, width=3)
            text_c(d, cx, yy + h / 2, t, fq, INK)
            arrow(d, (cx, yy + h), (cx, yy + h + 86), color=GRAY, width=5, head=20)
    rrect(d, (cx - QW / 2 + 30, y, cx + QW / 2 - 30, y + eh), 22, fill=(234, 247, 239), outline=GREEN, width=3)
    text_c(d, cx, y + eh / 2, et, fq, INK)
    save(im, name)


def f52():
    flow('52_순서도_연결.png', '아이콘이 회색에서 안 바뀌어요', [
        ('q', '작업 표시줄에 도우미 아이콘이 있나요? (^ 안도 봐요)', '아니요',
         '시작 메뉴에서 ‘교실알림판 도우미’를 눌러요. 그래도 없으면 백신이 막았을 수 있어요. 정보 담당 선생님께 부탁해요.'),
        ('q', '아이콘이 주황인가요?', '예', '메뉴의 [잠깐 멈추기(보드 굽기 전에)]를 한 번 눌러 꺼요.'),
        ('q', '7인치를 ‘UART’ 단자에 꽂았나요?', '아니요', '‘UART’ 글자가 적힌 단자에 다시 꽂아요. (4인치는 USB-C 단자)'),
        ('q', '데이터 케이블인가요? (그 선으로 휴대폰을 꽂으면 컴퓨터에서 휴대폰 사진이 보여요)', '아니요', '데이터 케이블로 바꿔요.'),
        ('a', '컴퓨터의 다른 USB 구멍에 꽂아 봐요.'),
        ('q', '기록에 ‘포트 열어 봄’ 줄이 있나요?', '아니요',
         '컴퓨터가 보드를 못 봐요. 드라이버(장치를 쓰게 해 주는 작은 프로그램)가 필요할 수 있어요. 정보 담당 선생님께 부탁해요.'),
        ('q', '기록에 ‘알림판 아님(답 없음, …)’ 줄이 있나요?', '예',
         '1분 기다려요. 그래도 안 되면 보드 프로그램이 예전 것이에요. 정보 담당 선생님께 새로 구워 달라고 부탁해요.'),
    ], '그래도 안 되면 [기록 보기]의 마지막 몇 줄을 정보 담당 선생님께 보여 주세요.')


def f53():
    flow('53_순서도_단추.png', '보드 단추를 눌러도 안 열려요', [
        ('q', '보드 단추가 모두 흐리게 보이나요?', '예', '도우미가 꺼져 있어요. 시작 메뉴에서 ‘교실알림판 도우미’를 눌러 켜요.'),
        ('q', '보드 아래 줄에 ‘컴퓨터와 연결됨’이 보이나요?', '아니요', '‘아이콘이 회색에서 안 바뀌어요’ 순서도를 따라가요.'),
        ('q', '꾸미기 창에서 그 칸의 [▶ 눌러 보기]가 되나요?', '아니요', '대상(무엇을 열지)을 고쳐요. (과정 5·6)'),
        ('q', '단축키 칸인가요?', '예', '키를 받을 창을 먼저 눌러 맨 앞에 둬요. Win이 들어간 단축키는 ‘Win 키도 함께’에 체크해요.'),
        ('q', '여러 동작 칸인가요?', '예', '‘다음 동작까지 기다리기’를 1~2초 늘려요.'),
    ], '그래도 안 되면 [기록 보기]에서 ‘열기 실패’ 줄을 찾아봐요.')


def f54():
    W = 1500
    tmp = Image.new('RGB', (10, 10)); td = Draw(tmp)
    im, d = canvas(W, 1180)
    text_l(d, 30, 30, '보드에 새 아이콘이 안 가요', font(40), INK)
    lx = W - 560
    d.line([lx, 56, lx + 50, 56], fill=GREEN, width=6); d.text((lx + 60, 38), '예', font=font(28), fill=GREEN)
    d.line([lx + 140, 56, lx + 190, 56], fill=RED, width=6); d.text((lx + 200, 38), '아니요', font=font(28), fill=RED)
    cx, QW = 400, 640
    yy, h = 120, 150
    my = yy + h / 2
    pts = [(cx, yy), (cx + QW / 2, my), (cx, yy + h), (cx - QW / 2, my)]
    d.polygon(pts, fill=(255, 248, 225)); d.line(pts + [pts[0]], fill=(200, 150, 40), width=3)
    text_c(d, cx, my, '[저장하고 보드에 보내기]를\n눌렀나요?', font(30), INK)
    arrow(d, (cx + QW / 2, my), (796, my), color=RED, width=5, head=20)
    d.text((cx + QW / 2 + 20, my - 46), '아니요', font=font(28), fill=RED)
    rrect(d, (800, my - 50, 1470, my + 50), 18, fill=SOFT, outline=RED, width=3)
    text_l(d, 825, my - 22, '눌러요(Ctrl+S도 돼요).', font(28, F4), INK)
    arrow(d, (cx, yy + h), (cx, 360), color=GREEN, width=5, head=20)
    d.text((cx + 16, yy + h + 18), '예', font=font(28), fill=GREEN)
    ab = (cx - 290, 364, cx + 290, 450)
    rrect(d, ab, 22, fill=(232, 240, 255), outline=BLUE, width=3)
    text_c(d, cx, 407, '맨 아래 글이 무엇인가요?', font(30), INK)
    rows = [('저장했어요. 보드를 꽂으면 저절로 보내요.', '보드를 꽂아요. 꽂으면 저절로 가요.'),
            ('보드가 날씨·시간표를 받는 중이라 기다려요', '기다려요. 끝나면 저절로 보내요.'),
            ('보내지 못해 멈췄어요 · [저장하고 보드에 보내기]를 다시 눌러 주세요', '선을 다시 꽂고 단추를 다시 눌러요.'),
            ('이 보드는 아이콘 받기를 못 해요(…)', '보드 프로그램을 새로 구워야 해요. 정보 담당 선생님께 부탁해요. 단추로 열기는 돼요.'),
            ('보드가 연결되지 않았어요', '과정 3(보드 꽂고 연결 확인)으로 가요.')]
    y = 520
    d.line([90, 450, 90, y + 4 * 128 + 50], fill=GRAY, width=5)
    for i, (a, b) in enumerate(rows):
        arrow(d, (90, y + 50), (126, y + 50), color=GRAY, width=5, head=16)
        rrect(d, (130, y, 760, y + 100), 14, fill=(244, 245, 248), outline=LINE, width=2)
        ta = wrap(td, a, font(26), 590)
        text_l(d, 150, y + 50 - (ta.count('\n') + 1) * 18, ta, font(26), INK, lh=1.35)
        arrow(d, (766, y + 50), (826, y + 50), color=BLUE, width=5, head=16)
        rrect(d, (830, y, 1470, y + 100), 14, fill=SOFT, outline=BLUE, width=2)
        tb = wrap(td, b, font(26, F4), 600)
        text_l(d, 850, y + 50 - (tb.count('\n') + 1) * 18, tb, font(26, F4), INK, lh=1.35)
        y += 128
    text_l(d, 130, 485, '보이는 글', font(26), GRAY)
    text_l(d, 830, 485, '할 일', font(26), GRAY)
    save(im.crop((0, 0, W, y + 20)), '54_순서도_보내기.png')


def f55():
    im, d = canvas(1500, 610)
    x0, y0, x1, y1 = 30, 30, 1460, 520
    top = win_frame(d, (x0, y0, x1, y1), '기록 - 메모장')
    lines = ['10-27 08:40:12 포트 열어 봄: …',
             '10-27 08:40:13 알림판 확인: … (7인치)',
             '10-27 08:52:30 열기: 3',
             '10-27 08:55:04 열기 실패: 16 (…)']
    f = font(32, F4)
    y = top + 30
    boxes = []
    for s in lines:
        d.text((x0 + 40, y), s, font=f, fill=INK)
        boxes.append((x0 + 34, y - 6, x0 + 46 + d.textlength(s, font=f), y + 44))
        y += 70
    mark(d, im.size, boxes[-1], n=1, say='맨 아래 줄을 봐요', side='r')
    caption_under(d, 750, 570, '…로 가린 자리는 컴퓨터마다 달라요. Ctrl+End를 누르면 맨 아래로 가요.', 26)
    save(im, '55_기록보기.png')


def _edge_on(d, tr, can):
    """24: 크롬 대신 엣지를 고른 모습으로(단계와 같게)"""
    f = font(26)
    x0, y0, x1, y1 = tr((153, 44, 230, 75))
    rrect(d, (x0, y0, x1, y1), 10, fill=(35, 40, 53))
    text_c(d, (x0 + x1) / 2, (y0 + y1) / 2, '크롬', f, (226, 230, 238))
    x0, y0, x1, y1 = tr((231, 44, 306, 75))
    rrect(d, (x0, y0, x1, y1), 10, fill=(35, 40, 53))
    rrect(d, (x0 + 2, y0, x1 - 2, y1), 10, fill=(90, 140, 255))
    text_c(d, (x0 + x1) / 2, (y0 + y1) / 2, '엣지', f, PAPER)


def f56():
    """보드 첫 화면 위 띠: 7인치는 위 띠의 [단축키], 4인치는 옆으로 밀기"""
    src = load(os.path.join(os.path.dirname(os.path.dirname(ROOT)), '7inch', 'tools', 'sim', 'shots', '7B_위원회2차', '224714_시간표.png'))
    top = src.crop((0, 0, 1024, 64)).resize((1536, 96), Image.LANCZOS)
    W, H = 1600, 720
    im, d = canvas(W, H)
    text_l(d, 32, 24, '7인치: 화면 맨 위 띠에서 [단축키]를 눌러요', font(38), INK)
    ox, oy = 32, 100
    im.paste(top, (ox, oy))
    d = Draw(im)
    # 선생님 이름·받은 시각 가리기(개인정보)
    rrect(d, (ox + 88, oy + 12, ox + 330, oy + 84), 8, fill=(36, 33, 30))
    d.text((ox + 104, oy + 30), '선생님 이름', font=font(30, F4), fill=(150, 146, 140))
    rrect(d, (ox + 1150, oy + 20, ox + 1340, oy + 78), 8, fill=(36, 33, 30))
    d.rectangle([ox - 1, oy - 1, ox + 1536, oy + 96], outline=LINE, width=2)
    tab = (ox + 640, oy + 14, ox + 790, oy + 82)
    mark(d, im.size, tab, n=1, say='단축키', side='b', pad=6)
    # 4인치
    y2 = 360
    d.line([32, y2 - 30, W - 32, y2 - 30], fill=LINE, width=2)
    text_l(d, 32, y2, '4인치: 화면을 손가락으로 옆으로 밀어 넘겨요', font(38), INK)
    text_l(d, 32, y2 + 70, '시계 → 오늘 시간표 → 주간 시간표 → 단축키\n네 번째 장이 단축키예요.\n화면 아래 작은 점이 지금 몇 번째 장인지 알려 줘요.', font(32, F4), GRAY, lh=1.55)
    bx0, by0 = 1160, y2 - 6
    rrect(d, (bx0, by0, bx0 + 320, by0 + 320), 22, fill=DARK, outline=(70, 76, 90), width=3)
    for i in range(6):
        cx = bx0 + 105 + i * 22
        d.ellipse([cx - 6, by0 + 288, cx + 6, by0 + 300], fill=(230, 230, 230) if i == 3 else (100, 104, 116))
    arrow(d, (bx0 + 260, by0 + 140), (bx0 + 60, by0 + 140), color=RED, width=8, head=30)
    d.ellipse([bx0 + 235, by0 + 115, bx0 + 285, by0 + 165], outline=RED, width=5)
    text_c(d, bx0 + 160, by0 + 220, '옆으로 밀기', font(30), DTEXT)
    save(im, '56_보드첫화면.png')


def f57():
    """보낸 뒤 풍선 알림"""
    W, H = 1500, 380
    im, d = canvas(W, H, (214, 226, 240))
    ty = H - 80
    taskbar(d, W, ty, 80)
    tray_icon(d, W - 300, ty + 40, GREEN, size=40)
    d.text((W - 230, ty + 22), '오전 9:30', font=font(28, F4), fill=INK)
    bx0, by0, bx1, by1 = W - 820, 40, W - 40, 240
    rrect(d, (bx0 + 6, by0 + 8, bx1 + 6, by1 + 8), 14, fill=(180, 190, 205))
    rrect(d, (bx0, by0, bx1, by1), 14, fill=(250, 251, 253), outline=(170, 176, 188), width=2)
    tray_icon(d, bx0 + 50, by0 + 52, GREEN, size=44)
    d.text((bx0 + 90, by0 + 32), '교실 알림판 도우미', font=font(30), fill=INK)
    text_l(d, bx0 + 40, by0 + 110, '7인치 알림판에 새 단축키를 보냈어요', font(34, F4), INK)
    mark(d, im.size, (bx0, by0, bx1, by1), n=1, say='몇 초 뒤 사라져요', side='l', pad=6)
    save(im, '57_보냄풍선.png')


ALL = [f00, f01, f02, f03, f04, f05, f06, f07, f08, f09, f10, f11, f12, f13, f14, f15, f16, f17, f18, f19,
       f20, f21, f22, f23, f24, f25, f26, f27, f28, f29, f30, f31, f32, f33, f34, f35, f36, f37, f38, f39,
       f40, f41, f42, f43, f44, f45, f46, f47, f48, f49, f50, f51, f52, f53, f54, f55, f56, f57]

if __name__ == '__main__':
    want = set(int(a) for a in sys.argv[1:])
    for i, fn in enumerate(ALL):
        if not want or i in want:
            fn()
