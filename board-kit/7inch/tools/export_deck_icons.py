"""기본 그림 16개 뽑기 — firmware/src/deck_icons.c 의 아이콘을 도우미용 PNG·BIN 으로 꺼낸다.
   python tools/export_deck_icons.py
결과: common/deck-helper/icons/기본/<키>.png (72x72 RGBA) 와 <키>.bin (RGB565 작은 끝 + 알파, 15552바이트)
"""
import os, re, zlib
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "firmware", "src", "deck_icons.c")
OUT = os.path.normpath(os.path.join(HERE, "..", "..", "common", "deck-helper", "icons", "기본"))
ORDER = ["explorer", "claude", "gemini", "gpt", "cmd", "powershell", "neis", "naver",
         "youtube", "coolmsg", "kakao", "excel", "ppt", "close", "hwp", "desktop"]
S = 72

text = open(SRC, encoding="utf-8").read()
os.makedirs(OUT, exist_ok=True)
for key in ORDER:
    m = re.search(r"deck_%s_map\[\]\s*=\s*\{(.*?)\};" % key, text, re.S)
    data = bytes(int(v) for v in re.findall(r"\d+", m.group(1)))
    assert len(data) == S * S * 3, (key, len(data))
    with open(os.path.join(OUT, key + ".bin"), "wb") as f:
        f.write(data)
    im = Image.new("RGBA", (S, S))
    px = []
    for i in range(S * S):
        v = data[i * 3] | (data[i * 3 + 1] << 8)
        r5, g6, b5 = v >> 11, (v >> 5) & 63, v & 31
        px.append(((r5 << 3) | (r5 >> 2), (g6 << 2) | (g6 >> 4), (b5 << 3) | (b5 >> 2), data[i * 3 + 2]))
    im.putdata(px)
    im.save(os.path.join(OUT, key + ".png"))
    print(key, "%08x" % (zlib.crc32(data) & 0xFFFFFFFF))
print("ok", OUT)
