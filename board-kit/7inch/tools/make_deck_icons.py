"""단추판(단축키) 아이콘 만들기 — 사용자가 고른 '4 다크 프리미엄' 아이콘 표(16개)에서 가운데 그림만 떼어
   둥근 사각형(어두운 바탕 + 색 테두리)으로 새로 그린다(2026-10-25 사용자: "새로 사각으로 그려").
   표에 없는 것(나이스·제미나이·GPT)은 같은 모양으로 직접 그린다(글자·별 모양, 상표 그림은 쓰지 않는다).
   python tools/make_deck_icons.py <아이콘 표 그림> [크기=72]
그림은 1662x870, 4번째 줄 큰 아이콘(지름 약 84px)을 쓴다. 결과: firmware/src/deck_icons.c (RGB565 + 투명도, LV_IMG_CF_TRUE_COLOR_ALPHA)
"""
import sys, os, math
from PIL import Image, ImageDraw, ImageFilter, ImageFont

SRC = sys.argv[1]
SIZE = int(sys.argv[2]) if len(sys.argv) > 2 else 72
HERE = os.path.dirname(os.path.abspath(__file__))
OUT_C = os.path.join(HERE, "..", "firmware", "src", "deck_icons.c")
PREVIEW = os.path.join(HERE, "deck_icons_preview.png")
FONT = os.path.join(HERE, "..", "firmware", "fonts", "src", "Pretendard-SemiBold.otf")
SHEET = ["explorer", "claude", "terminal", "cmd", "powershell", "web", "naver", "youtube",
         "coolmsg", "kakao", "office", "excel", "ppt", "word", "hwp", "desktop"]   # 표의 칸 차례
# 보드에 넣는 차례(2026-10-25: 웹→나이스, 오피스·터미널 빼고 제미나이·GPT)
ORDER = ["explorer", "claude", "gemini", "gpt", "cmd", "powershell", "neis", "naver",
         "youtube", "coolmsg", "kakao", "excel", "ppt", "word", "hwp", "desktop"]
X0, DX, Y = 232, 92, 588          # 첫 칸 가운데, 칸 간격, 4번째 줄 가운데
K = 4                             # 4배로 그린 뒤 줄여 테두리를 매끈하게
N = SIZE * K
G = int(N * 0.80)                 # 사각형 안에서 그림이 차지하는 크기

im = Image.open(SRC).convert("RGB")
bg = im.getpixel((180, 560))      # 줄 사이 바탕색

def far(p, q, t=40):
    return sum(abs(a - b) for a, b in zip(p, q)) > t

def lum(p):
    return 0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2]

def tile(ring, fill, glyph):
    """둥근 사각형: 어두운 바탕 + 색 테두리(4번 컨셉) + 은은한 안쪽 빛, 가운데에 glyph(G×G RGBA)"""
    rad = int(N * 0.24)
    bw = max(K * 2, int(N * 0.045))
    t = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    dr = ImageDraw.Draw(t)
    dr.rounded_rectangle((0, 0, N - 1, N - 1), radius=rad, fill=ring + (255,))
    dr.rounded_rectangle((bw, bw, N - 1 - bw, N - 1 - bw), radius=rad - bw, fill=fill + (255,))
    glow = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    ImageDraw.Draw(glow).rounded_rectangle((bw, bw, N - 1 - bw, N - 1 - bw), radius=rad - bw, outline=ring + (90,), width=bw * 2)
    glow = glow.filter(ImageFilter.GaussianBlur(bw * 1.2))
    mask_in = Image.new("L", (N, N), 0)
    ImageDraw.Draw(mask_in).rounded_rectangle((bw, bw, N - 1 - bw, N - 1 - bw), radius=rad - bw, fill=255)
    glow.putalpha(Image.composite(glow.getchannel("A"), Image.new("L", (N, N), 0), mask_in))
    t.alpha_composite(glow)
    t.alpha_composite(glyph, ((N - G) // 2, (N - G) // 2))
    return t.resize((SIZE, SIZE), Image.LANCZOS)

def glowing(shape_l, color):
    """흰 모양(L) → 색칠 + 뒤에 같은 색 번짐(4번 컨셉의 빛나는 그림)"""
    out = Image.new("RGBA", shape_l.size, (0, 0, 0, 0))
    halo = Image.new("RGBA", shape_l.size, color + (0,))
    halo.putalpha(shape_l.filter(ImageFilter.GaussianBlur(G * 0.05)).point(lambda v: int(v * 0.7)))
    out.alpha_composite(halo)
    solid = Image.new("RGBA", shape_l.size, color + (0,))
    solid.putalpha(shape_l)
    out.alpha_composite(solid)
    return out

def text_shape(txt, size_ratio):
    m = Image.new("L", (G, G), 0)
    f = ImageFont.truetype(FONT, int(G * size_ratio))
    d = ImageDraw.Draw(m)
    l, t, r, b = d.textbbox((0, 0), txt, font=f)
    d.text(((G - (r - l)) / 2 - l, (G - (b - t)) / 2 - t), txt, font=f, fill=255)
    return m

# ── 표에서 떼어 온 아이콘 ──
icons, fills = {}, []
for i, name in enumerate(SHEET):
    cx = X0 + i * DX
    crop = im.crop((cx - 48, Y - 48, cx + 48, Y + 48))
    w, h = crop.size
    pts = [(x, y) for x in range(w) for y in range(h) if far(crop.getpixel((x, y)), bg)]
    l = min(p[0] for p in pts); r = max(p[0] for p in pts); t = min(p[1] for p in pts); b = max(p[1] for p in pts)
    d = max(r - l, b - t) + 1
    ox, oy = (l + r) / 2, (t + b) / 2
    ring = max((crop.getpixel((int(ox), int(oy - d / 2 + k))) for k in range(1, 5)), key=lambda p: max(p) - min(p) + lum(p) * 0.2)
    fill = min((crop.getpixel((int(ox + 0.40 * d * math.cos(a)), int(oy + 0.40 * d * math.sin(a)))) for a in [k * math.pi / 8 for k in range(16)]), key=lum)
    fills.append(fill)
    inner_r = 0.41 * d
    S = int(round(inner_r * 2))
    glyph = crop.crop((int(ox - inner_r), int(oy - inner_r), int(ox - inner_r) + S, int(oy - inner_r) + S)).convert("RGBA").resize((G, G), Image.LANCZOS)
    gm = Image.new("L", (G, G), 0)
    ImageDraw.Draw(gm).ellipse((0, 0, G - 1, G - 1), fill=255)
    glyph.putalpha(gm.filter(ImageFilter.GaussianBlur(G * 0.03)))
    icons[name] = tile(ring, fill, glyph)

# ── 직접 그리는 아이콘(같은 바탕색) ──
FILL = tuple(sorted(fills, key=lum)[len(fills) // 2])      # 표 아이콘들의 가운데 바탕색
# 나이스: 파란 테두리 + 'NEIS'
icons["neis"] = tile((37, 132, 235), FILL, glowing(text_shape("NEIS", 0.40), (90, 170, 255)))
# 제미나이: 보라빛 파랑 테두리 + 네 갈래 별(반짝임)
star = Image.new("L", (G, G), 0)
cx = cy = G / 2; R = G * 0.42; r = G * 0.10
pts = []
for k in range(8):
    a = -math.pi / 2 + k * math.pi / 4
    rr = R if k % 2 == 0 else r
    pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
ImageDraw.Draw(star).polygon(pts, fill=255)
star = star.filter(ImageFilter.GaussianBlur(G * 0.012))
icons["gemini"] = tile((124, 108, 246), FILL, glowing(star, (140, 170, 255)))
# GPT: 초록 테두리 + 'GPT'
icons["gpt"] = tile((16, 163, 127), FILL, glowing(text_shape("GPT", 0.46), (60, 210, 160)))

sheet = Image.new("RGBA", (SIZE * 16 + 15 * 8, SIZE), (28, 23, 20, 255))
for i, name in enumerate(ORDER):
    sheet.alpha_composite(icons[name], (i * (SIZE + 8), 0))
sheet.save(PREVIEW)

with open(OUT_C, "w", encoding="utf-8", newline="\n") as f:
    f.write("// 단추판(단축키) 아이콘(자동 생성: tools/make_deck_icons.py) — RGB565(작은 끝) + 투명도, 둥근 사각형\n")
    f.write('#include "lvgl.h"\n\n')
    for name in ORDER:
        ic = icons[name]
        data = []
        for y in range(SIZE):
            for x in range(SIZE):
                r_, g_, b_, a_ = ic.getpixel((x, y))
                v = ((r_ >> 3) << 11) | ((g_ >> 2) << 5) | (b_ >> 3)
                data += [v & 0xFF, v >> 8, a_]
        f.write(f"static const uint8_t deck_{name}_map[] = {{\n")
        for k in range(0, len(data), 24):
            f.write("  " + ",".join(str(x) for x in data[k:k + 24]) + ",\n")
        f.write("};\n")
        f.write(f"const lv_img_dsc_t deck_{name} = {{ .header = {{ .cf = LV_IMG_CF_TRUE_COLOR_ALPHA, .always_zero = 0, .reserved = 0, .w = {SIZE}, .h = {SIZE} }},"
                f" .data_size = {len(data)}, .data = deck_{name}_map }};\n\n")
print("ok")
