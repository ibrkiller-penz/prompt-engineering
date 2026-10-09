"""보드 시리얼 기록(로그)을 잠깐만 읽는다.

  python tools/serial_log.py --port COM7 [초=20] [--grep 단어,단어]

- 읽기만 한다. 보드를 다시 시작시키지 않는다(RTS/DTR 를 건드리지 않는다).
  ※ 4인치 보드는 USB 로 강제 리셋을 걸면 부저가 계속 울린 적이 있다. 그래서 --reset 옵션을 일부러 뺐다.
- 정해진 시간(기본 20초)만 읽고 끝난다. 무한 대기하지 않는다.
- COM 번호는 PC 마다 다르다. 장치 관리자 > 포트(COM & LPT)에서 확인하세요.
- 굽는 중이거나 다른 프로그램이 그 포트를 쓰고 있으면 열리지 않는다.
"""
import argparse
import sys
import time

import serial  # pip install pyserial

ap = argparse.ArgumentParser()
ap.add_argument("secs", nargs="?", type=float, default=20)
ap.add_argument("--port", required=True, help="예: COM7")
ap.add_argument("--grep", default="", help="쉼표로 나눈 단어가 들어 있는 줄만 보여 준다")
a = ap.parse_args()
sys.stdout.reconfigure(encoding="utf-8")

s = serial.Serial()
s.port, s.baudrate, s.timeout = a.port, 115200, 0.2
s.dtr = s.rts = False  # 열 때 EN/BOOT 를 건드리지 않는다
s.open()
buf, t = b"", time.time()
while time.time() - t < a.secs:
    buf += s.read(4096)
s.close()

lines = buf.decode("utf-8", "replace").splitlines()
keys = [k for k in a.grep.split(",") if k]
if keys:
    lines = [l for l in lines if any(k in l for k in keys)]
print("\n".join(lines) if lines else "(기록 없음)")
