"""날씨 그림 → LVGL 이미지(C 배열).

시계 화면(어두운 바탕)에 맞춘 그림 7가지를 Pillow 로 그린다. 4배로 그린 뒤 줄여 가장자리를 매끈하게 한다.
출력: firmware/src/wx_icons.c, firmware/include/wx_icons.h, tools/out/wx_icons_preview.png

  python tools/make_weather_icons.py

형식: LV_IMG_CF_TRUE_COLOR_ALPHA, LV_COLOR_DEPTH 16 → 한 점 = RGB565(작은 끝) 2바이트 + 알파 1바이트.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SS = 4                       # 4배로 그린다
SIZES = {"L": 52}            # 시계 모드 날씨 카드(오늘|내일 반쪽씩). 64 → 52 (2026-10-06, 미리보기 F)

SUN = (253, 184, 19)
SUN_CORE = (255, 214, 102)
CLOUD = (241, 245, 249)
CLOUD_SHADE = (203, 213, 225)
CLOUD_DARK = (148, 163, 184)
RAIN = (96, 165, 250)
SNOW = (224, 242, 254)
BOLT = (250, 204, 21)
FOG = (148, 163, 184)


def canvas(n):
    return Image.new("RGBA", (n * SS, n * SS), (0, 0, 0, 0))


def sun(d, cx, cy, r):
    import math
    for i in range(8):
        a = math.pi / 4 * i
        x1, y1 = cx + math.cos(a) * r * 1.35, cy + math.sin(a) * r * 1.35
        x2, y2 = cx + math.cos(a) * r * 1.75, cy + math.sin(a) * r * 1.75
        d.line([(x1, y1), (x2, y2)], fill=SUN, width=int(r * 0.22))
        for (x, y) in ((x1, y1), (x2, y2)):
            w = r * 0.11
            d.ellipse([x - w, y - w, x + w, y + w], fill=SUN)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=SUN)
    d.ellipse([cx - r * 0.72, cy - r * 0.78, cx + r * 0.62, cy + r * 0.56], fill=SUN_CORE)


def cloud(img, cx, cy, w, color=CLOUD, shade=CLOUD_SHADE):
    """둥근 구름. (cx, cy)는 바닥 가운데 조금 위, w 는 너비."""
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    h = w * 0.34
    base = [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2]
    d.rounded_rectangle(base, radius=h / 2, fill=shade)
    for (ox, oy, rr) in ((-0.22, -0.18, 0.22), (0.08, -0.34, 0.30), (0.30, -0.12, 0.19)):
        x, y, r = cx + ox * w, cy + oy * w, rr * w
        d.ellipse([x - r, y - r, x + r, y + r], fill=shade)
    # 위쪽을 밝게(아래는 그늘)
    d2 = ImageDraw.Draw(layer)
    off = w * 0.035
    d2.rounded_rectangle([base[0], base[1] - off, base[2], base[3] - off], radius=h / 2, fill=color)
    for (ox, oy, rr) in ((-0.22, -0.18, 0.22), (0.08, -0.34, 0.30), (0.30, -0.12, 0.19)):
        x, y, r = cx + ox * w, cy + oy * w - off, rr * w
        d2.ellipse([x - r, y - r, x + r, y + r], fill=color)
    img.alpha_composite(layer)


def drop(d, x, y, s, color=RAIN):
    d.polygon([(x, y - s), (x - s * 0.55, y + s * 0.25), (x + s * 0.55, y + s * 0.25)], fill=color)
    d.ellipse([x - s * 0.55, y - s * 0.2, x + s * 0.55, y + s * 0.9], fill=color)


def flake(d, x, y, s):
    import math
    for i in range(3):
        a = math.pi / 3 * i
        dx, dy = math.cos(a) * s, math.sin(a) * s
        d.line([(x - dx, y - dy), (x + dx, y + dy)], fill=SNOW, width=int(s * 0.32))
    d.ellipse([x - s * 0.22, y - s * 0.22, x + s * 0.22, y + s * 0.22], fill=SNOW)


def draw(kind, n):
    img = canvas(n)
    W = n * SS
    d = ImageDraw.Draw(img)
    if kind == "sun":
        sun(d, W / 2, W / 2, W * 0.24)
    elif kind == "partly":
        sun(d, W * 0.62, W * 0.36, W * 0.17)
        cloud(img, W * 0.44, W * 0.68, W * 0.72)
    elif kind == "cloud":
        cloud(img, W * 0.52, W * 0.62, W * 0.86, CLOUD_SHADE, CLOUD_DARK)
        cloud(img, W * 0.46, W * 0.70, W * 0.70)
    elif kind == "rain":
        cloud(img, W * 0.5, W * 0.56, W * 0.76, CLOUD_SHADE, CLOUD_DARK)
        d = ImageDraw.Draw(img)
        for i, x in enumerate((0.32, 0.52, 0.72)):
            drop(d, W * x, W * (0.79 + (0.06 if i == 1 else 0)), W * 0.07)
    elif kind == "snow":
        cloud(img, W * 0.5, W * 0.56, W * 0.76)
        d = ImageDraw.Draw(img)
        for i, x in enumerate((0.32, 0.52, 0.72)):
            flake(d, W * x, W * (0.83 + (0.05 if i == 1 else 0)), W * 0.065)
    elif kind == "thunder":
        cloud(img, W * 0.5, W * 0.54, W * 0.78, CLOUD_DARK, (100, 116, 139))
        d = ImageDraw.Draw(img)
        b = [(0.54, 0.58), (0.40, 0.79), (0.50, 0.79), (0.43, 0.97), (0.64, 0.72), (0.54, 0.72), (0.61, 0.58)]
        d.polygon([(W * x, W * y) for x, y in b], fill=BOLT)
    elif kind == "fog":
        cloud(img, W * 0.5, W * 0.52, W * 0.74, CLOUD_SHADE, CLOUD_DARK)
        d = ImageDraw.Draw(img)
        for i, y in enumerate((0.72, 0.83, 0.94)):
            x0 = 0.16 + (0.08 if i == 1 else 0)
            d.rounded_rectangle([W * x0, W * (y - 0.035), W * (0.84 - (0.1 if i == 2 else 0)), W * (y + 0.035)],
                                radius=W * 0.035, fill=FOG)
    small = img.resize((n, n), Image.LANCZOS)
    return small


def to_c(name, im):
    px = im.load()
    out = bytearray()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            c = ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3)
            out += bytes((c & 0xFF, c >> 8, a))
    rows = [", ".join(f"0x{v:02x}" for v in out[i:i + 24]) for i in range(0, len(out), 24)]
    body = ",\n  ".join(rows)
    return (f"static const uint8_t {name}_map[] = {{\n  {body}\n}};\n"
            f"const lv_img_dsc_t {name} = {{\n"
            f"  .header = {{ .cf = LV_IMG_CF_TRUE_COLOR_ALPHA, .always_zero = 0, .reserved = 0, .w = {im.width}, .h = {im.height} }},\n"
            f"  .data_size = {len(out)},\n  .data = {name}_map,\n}};\n\n")


KINDS = ["sun", "partly", "cloud", "rain", "snow", "thunder", "fog"]


def main():
    c = ["/* 날씨 그림 — tools/make_weather_icons.py 가 만든다. 고치지 말 것. */\n#include <lvgl.h>\n\n"]
    h = ["#pragma once\n#include <lvgl.h>\n/* 날씨 그림 (L 52px). tools/make_weather_icons.py 가 만든다. */\n"]
    sheet = Image.new("RGBA", (len(KINDS) * 100, 180), (11, 17, 32, 255))
    for i, k in enumerate(KINDS):
        for tag, n in SIZES.items():
            im = draw(k, n)
            name = f"wx_{k}_{tag}"
            c.append(to_c(name, im))
            h.append(f"LV_IMG_DECLARE({name});\n")
            sheet.alpha_composite(im, (i * 100 + (100 - n) // 2, 6 if tag == "L" else 110))
            if tag == "L":
                (ROOT / "tools/out").mkdir(exist_ok=True)
                im.save(ROOT / f"tools/out/{name}.png")
    (ROOT / "firmware/src/wx_icons.c").write_text("".join(c), encoding="utf-8")
    (ROOT / "firmware/include/wx_icons.h").write_text("".join(h), encoding="utf-8")
    out = ROOT / "tools/out"
    out.mkdir(exist_ok=True)
    sheet.convert("RGB").save(out / "wx_icons_preview.png")
    print("icons:", len(KINDS) * len(SIZES), "→ firmware/src/wx_icons.c, preview tools/out/wx_icons_preview.png")


if __name__ == "__main__":
    main()
