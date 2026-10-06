"""보드 시리얼 기록을 잠깐 읽는다(개발용).

  python tools/serial_log.py [초=20] [--port COM번호] [--reset] [--grep 단어,단어]

COM 번호는 --port 로 주거나 환경변수 PIO_PORT 에 넣어 둔다. 둘 다 없으면 USB 시리얼 칩을 찾아 쓴다.

--reset 이면 RTS 로 보드를 한 번 다시 켠다. 무한 대기하지 않는다(작업 규칙).
"""
import argparse
import os
import sys
import time

import serial
import serial.tools.list_ports


def find_port():
    """PIO_PORT 환경변수 → USB 시리얼 칩(CH343/CH340/CP210x/FTDI/Espressif) 순서로 찾는다. 포트를 열지는 않는다."""
    if os.environ.get("PIO_PORT"):
        return os.environ["PIO_PORT"]
    for p in serial.tools.list_ports.comports():
        if p.vid in (0x1A86, 0x303A, 0x10C4, 0x0403):
            return p.device
    sys.exit("보드의 COM 포트를 못 찾았습니다. --port COM번호 로 알려 주세요.")

ap = argparse.ArgumentParser()
ap.add_argument("secs", nargs="?", type=float, default=20)
ap.add_argument("--port", default="")
ap.add_argument("--reset", action="store_true")
ap.add_argument("--grep", default="")
a = ap.parse_args()
sys.stdout.reconfigure(encoding="utf-8")

s = serial.Serial()
s.port, s.baudrate, s.timeout = a.port or find_port(), 115200, 0.2
s.dtr = s.rts = False  # 열 때 EN/BOOT 를 건드리지 않는다
s.open()
if a.reset:
    s.rts = True
    time.sleep(0.1)
    s.rts = False
buf, t = b"", time.time()
while time.time() - t < a.secs:
    buf += s.read(4096)
s.close()

lines = buf.decode("utf-8", "replace").splitlines()
keys = [k for k in a.grep.split(",") if k]
if keys:
    lines = [l for l in lines if any(k in l for k in keys)]
print("\n".join(lines) if lines else "(기록 없음)")
