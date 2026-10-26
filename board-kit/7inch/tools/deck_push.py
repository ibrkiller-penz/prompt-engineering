"""단축키 칸 보내기 시험 도구(개발용) — 도우미 없이 보드의 받기 기능을 시험한다(설계_단축키꾸미기.md 2~4장, 9장).

  python tools/deck_push.py COM5 --ls                  # @deckls 만
  python tools/deck_push.py COM5 --png 3 그림.png      # PNG 하나를 다크 사각으로 만들어 칸 3 에 보내고 이름 "시험"
  python tools/deck_push.py COM5 --cfg deck.json       # deck.json 전체(아이콘은 같은 폴더 icons/cell_N.bin)
  python tools/deck_push.py COM5 --reset

줄마다 보낸 것 / 받은 것 / 걸린 시간을 찍는다. 도우미가 포트를 쥐고 있으면 멈춤 파일을 만들어 잠깐 놓게 한다.
"""
import argparse, base64, json, os, sys, time, zlib

import serial

sys.stdout.reconfigure(encoding="utf-8")
ap = argparse.ArgumentParser()
ap.add_argument("port")
g = ap.add_mutually_exclusive_group(required=True)
g.add_argument("--ls", action="store_true")
g.add_argument("--png", nargs=2, metavar=("칸", "그림"))
g.add_argument("--cfg")
g.add_argument("--reset", action="store_true")
ap.add_argument("--name", default="시험")
ap.add_argument("--quiet", action="store_true", help="조각 줄은 찍지 않음")
a = ap.parse_args()

KEYS = ["explorer", "claude", "gemini", "gpt", "cmd", "powershell", "neis", "naver",
        "youtube", "coolmsg", "kakao", "excel", "ppt", "close", "hwp", "desktop"]
NAMES = ["탐색기", "Claude", "제미나이", "GPT", "CMD", "파워셸", "나이스", "네이버",
         "유튜브", "쿨메신저", "카카오톡", "엑셀", "PPT", "창닫기", "한글", "바탕화면"]


def crc(b):
    return "%08x" % (zlib.crc32(b) & 0xFFFFFFFF)


def q(s):
    """C# 도우미와 같은 JSON 글자: " \\ 만 바꾸고 0x00~0x1F 는 \\uXXXX"""
    o = ['"']
    for ch in s:
        if ch == '"': o.append('\\"')
        elif ch == '\\': o.append('\\\\')
        elif ord(ch) < 0x20: o.append("\\u%04x" % ord(ch))
        else: o.append(ch)
    return "".join(o) + '"'


def cfg_bytes(names, ics):
    return ('{"v":1,"n":[' + ",".join(q(n) for n in names) + '],"ic":[' + ",".join(q(i) for i in ics) + "]}").encode("utf-8")


def tile_bin(path):
    """그림 → 72x72 다크 사각 → RGB565(작은 끝)+알파 15552바이트"""
    from PIL import Image, ImageDraw
    N, K = 288, 72
    im = Image.open(path).convert("RGBA")
    px = [p for p in im.resize((64, 64)).getdata() if p[3] > 128]
    ring = (90, 140, 255)
    if px:
        px.sort(key=lambda p: -(max(p[:3]) - min(p[:3])) * 255 // max(1, max(p[:3])))
        top = px[:max(1, len(px) // 5)]
        ring = tuple(sum(p[i] for p in top) // len(top) for i in range(3))
    t = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(t)
    d.rounded_rectangle((0, 0, N - 1, N - 1), radius=69, fill=ring + (255,))
    d.rounded_rectangle((13, 13, N - 14, N - 14), radius=56, fill=(30, 34, 44, 255))
    s = min(230 / im.width, 230 / im.height)
    gl = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.LANCZOS)
    t.alpha_composite(gl, ((N - gl.width) // 2, (N - gl.height) // 2))
    t = t.resize((K, K), Image.LANCZOS)
    out = bytearray()
    for r, g_, b, al in t.getdata():
        v = ((r >> 3) << 11) | ((g_ >> 2) << 5) | (b >> 3)
        out += bytes((v & 0xFF, v >> 8, al))
    return bytes(out)


# 도우미가 쥔 포트를 잠깐 놓게
stop = os.path.join(os.environ.get("TEMP", "."), "deck_helper.stop")
made = not os.path.exists(stop)
if made:
    open(stop, "w").close()
    time.sleep(1.5)
sp = serial.Serial()
sp.port, sp.baudrate, sp.timeout = a.port, 115200, 0.02
sp.dtr = False; sp.rts = False   # 열 때 보드가 다시 켜지지 않게
buf = b""
t0 = time.time()


def log(tag, s):
    print("%7.2f %s %s" % (time.time() - t0, tag, s))


def readline(until):
    global buf
    while time.time() < until:
        k = buf.find(b"\n")
        if k >= 0:
            line, buf = buf[:k].decode("utf-8", "replace").strip(), buf[k + 1:]
            if line.startswith("@deck"):
                return line
            if line:
                log("  ..", line)
            continue
        buf += sp.read(512)
    return None


def ask(line, timeout, tries, ok):
    for _ in range(tries):
        quiet = a.quiet and line.startswith("@deckdata")
        if not quiet:
            log(">>", line if len(line) < 80 else line[:80] + "…")
        sp.write((line + "\n").encode())
        until = time.time() + timeout
        while True:
            r = readline(until)
            if r is None:
                log("!!", "답 없음(%.0f초)" % timeout)
                break
            if ok(r):
                if not quiet:
                    log("<<", r)
                return r
            log("  ?", r)
    return None


def hd(l, *toks):   # 앞 토막이 꼭 같은가(칸 1 과 15 를 헷갈리지 않게)
    return l.split()[:len(toks)] == list(toks)


def send_item(i, data):
    c = crc(data)
    for _ in range(3):
        r = ask("@deckitem %s %d %s" % (i, len(data), c), 3, 3, lambda l: hd(l, "@deckitem", "ok", str(i)) or hd(l, "@deckitem", "fail", str(i)))
        if not r or "fail" in r:
            return False
        for seq in range((len(data) + 191) // 192):
            b64 = base64.b64encode(data[seq * 192:(seq + 1) * 192]).decode()
            okl, errl = "@deckdata ok %s %d" % (i, seq), "@deckdata err %s %d" % (i, seq)
            for _t in range(4):
                r = ask("@deckdata %s %d %s" % (i, seq, b64), 2, 1, lambda l: l == okl or hd(l, "@deckdata", "err", str(i), str(seq)))
                if r == okl:
                    break
            else:
                return False
        r = ask("@deckitem end %s" % i, 5, 1, lambda l: hd(l, "@deckitem", "done", str(i)) or hd(l, "@deckitem", "bad", str(i)))
        if r and "done" in r:
            return True
        if not r:
            return False
    return False


def push(items, cfg):
    h = crc(cfg)
    r = ask("@deckls", 3, 3, lambda l: l.startswith("@deckls "))
    if not r:
        return False
    for _ in range(20):
        r = ask("@deckbegin %s %d" % (h, len(items)), 3, 3, lambda l: l in ("@deckbegin ok", "@deckbusy") or l.startswith("@deckbegin fail"))
        if r == "@deckbegin ok":
            break
        if r != "@deckbusy":
            return False
        log("..", "보드가 받기 중 — 15초 뒤 다시")
        time.sleep(15)
    else:
        return False
    for i, d in items:
        sp.write(b"@pc on\n")
        if not send_item(str(i), d):
            return False
    if not send_item("c", cfg):
        return False
    r = ask("@deckend", 10, 1, lambda l: l.startswith("@deckend "))
    return bool(r and r.startswith("@deckend ok " + h))


try:
    sp.open()
    time.sleep(0.2)
    sp.write(b"@pc on\n")
    readline(time.time() + 0.5)
    if a.ls:
        ok = bool(ask("@deckls", 3, 3, lambda l: l.startswith("@deckls ")))
    elif a.reset:
        ok = bool(ask("@deckreset", 5, 2, lambda l: l == "@deckreset ok"))
    elif a.png:
        cell = int(a.png[0])
        data = tile_bin(a.png[1])
        names, ics = list(NAMES), [""] * 16
        names[cell], ics[cell] = a.name, crc(data)
        ok = push([(cell, data)], cfg_bytes(names, ics))
    else:
        dj = json.load(open(a.cfg, encoding="utf-8"))
        base = os.path.join(os.path.dirname(os.path.abspath(a.cfg)), "icons")
        names, ics, items = [], [], []
        for i, c in enumerate(dj["cells"]):
            names.append("" if c.get("kind") == "none" else c.get("name", ""))
            ic = c.get("icon", {})
            if ic.get("mode") == "builtin":
                ics.append("builtin:" + ic["src"] if ic.get("src") else "")
            else:
                d = open(os.path.join(base, "cell_%d.bin" % i), "rb").read()
                ics.append(crc(d)); items.append((i, d))
        ok = push(items, cfg_bytes(names, ics))   # 시험 도구라 바뀐 것만 고르지 않고 전부 보낸다
    if not ok:
        sp.write(b"@deckabort\n")
    log("==", "성공" if ok else "실패")
finally:
    sp.close()
    if made:
        try: os.remove(stop)
        except OSError: pass
