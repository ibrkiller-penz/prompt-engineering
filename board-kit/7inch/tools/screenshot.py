"""보드 화면 찍기 — UART 로 '@shot' 을 보내 지금 화면을 PNG 로 받는다(7인치·7B).
   python tools/screenshot.py --port COM14 --out shots            # 지금 화면 한 장
   python tools/screenshot.py --port COM14 --out shots --views 2,0,4,3,1
       # 화면을 바꿔 가며 여러 장(2 시계 · 0 시간표 · 4 단축키 · 3 찾기 · 1 설정)
단축키 도우미가 포트를 쥐고 있으면 잠깐 놓게 한다(%TEMP%\\deck_helper.stop). 한 장에 10~30초 걸린다(115200bps).
"""
import argparse, os, sys, time, tempfile
import serial
from PIL import Image

NAMES = {0: "시간표", 1: "설정", 2: "시계", 3: "찾기", 4: "단축키"}
ap = argparse.ArgumentParser()
ap.add_argument("--port", default=os.environ.get("PIO_PORT", ""))
ap.add_argument("--out", default="shots")
ap.add_argument("--views", default="")
ap.add_argument("--wait", type=float, default=2.0, help="화면을 바꾼 뒤 기다릴 초")
a = ap.parse_args()
if not a.port:
    sys.exit("--port COM번호 를 주세요")
os.makedirs(a.out, exist_ok=True)
stop = os.path.join(tempfile.gettempdir(), "deck_helper.stop")
made_stop = not os.path.exists(stop)
if made_stop:
    open(stop, "w").close(); time.sleep(2)

def read_line(sp, deadline):
    buf = b""
    while time.time() < deadline:
        c = sp.read(1)
        if not c:
            continue
        if c == b"\n":
            return buf.decode("utf-8", "replace").strip()
        buf += c
    return None

def shot(sp, path):
    sp.reset_input_buffer()
    sp.write(b"\n@shot\n")
    end = time.time() + 15
    while True:
        line = read_line(sp, end)
        if line is None:
            raise RuntimeError("보드가 답하지 않습니다(@shot)")
        if line.startswith("@shot fail"):
            raise RuntimeError("보드가 화면을 꺼내지 못했습니다")
        if line.startswith("@shot "):
            w, h = map(int, line.split()[1:3]); break
    # 먼저 끝까지 한꺼번에 받아 두고(큰 덩어리로 읽기) 그다음 푼다.
    # 4인치(칩 내장 USB)는 빨라서 한 바이트씩 읽으면 보드 쪽 전송이 기다리다 떨어져 그림이 깨졌다(2026-10-26).
    total = w * h; raw = bytearray(); sp.timeout = 0.3; idle = 0
    while idle < 10:                                   # 3초 동안 새 자료가 없으면 끝
        chunk = sp.read(65536)
        if chunk:
            raw += chunk; idle = 0
            if b"@shot end" in raw[-64:]:
                break
        else:
            idle += 1
    px = bytearray(total * 3); k = 0; i = 0
    while i + 2 < len(raw) and k < total:
        cnt = raw[i]
        if cnt == 0:
            break
        v = raw[i + 1] | (raw[i + 2] << 8); i += 3
        r = (v >> 11) & 0x1F; g = (v >> 5) & 0x3F; b = v & 0x1F
        rgb = bytes(((r << 3) | (r >> 2), (g << 2) | (g >> 4), (b << 3) | (b >> 2)))
        n = min(cnt, total - k)
        px[k * 3:(k + n) * 3] = rgb * n; k += n
    if k < total:
        raise RuntimeError("받다가 끊겼습니다(%d/%d 점)" % (k, total))
    # 이 보드는 화면을 거꾸로 달아 프레임 버퍼가 180도 돌아가 있다(MIRROR_X·Y) → 바로 세워 저장
    Image.frombytes("RGB", (w, h), bytes(px)).rotate(180).save(path)
    return path

try:
    sp = serial.Serial()
    sp.port = a.port; sp.baudrate = 115200; sp.timeout = 0.2
    sp.dtr = False; sp.rts = False      # 열 때 보드가 다시 시작되지 않게
    sp.open()
    time.sleep(0.5)
    views = [int(x) for x in a.views.split(",") if x.strip()] or [None]
    for v in views:
        if v is not None:
            sp.write(("\n@view %d\n" % v).encode()); time.sleep(a.wait)
        name = NAMES.get(v, "화면") if v is not None else "화면"
        path = os.path.join(a.out, "%s_%s.png" % (time.strftime("%H%M%S"), name))
        t0 = time.time()
        print("찍는 중:", name, flush=True)
        print("  저장:", shot(sp, path), "(%.0f초)" % (time.time() - t0), flush=True)
    sp.close()
finally:
    if made_stop and os.path.exists(stop):
        os.remove(stop)
