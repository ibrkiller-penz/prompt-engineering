"""보드를 여러 번 다시 켜며 와이파이 연결에 걸리는 시간을 잰다(개발용).

  python tools/reboot_test.py [횟수=5] [COM번호]

COM 번호는 두 번째 인자 또는 환경변수 PIO_PORT 로 준다(없으면 USB 시리얼 칩을 찾는다).

매번 RTS 로 다시 켜고 'sync: ok' 또는 'sync: fail' 이 나올 때까지(최대 90초) 기다린다.
"""
import os
import sys
import time

import serial
import serial.tools.list_ports

sys.stdout.reconfigure(encoding="utf-8")
n = int(sys.argv[1]) if len(sys.argv) > 1 else 5
port = sys.argv[2] if len(sys.argv) > 2 else os.environ.get("PIO_PORT", "")
if not port:
    for p in serial.tools.list_ports.comports():
        if p.vid in (0x1A86, 0x303A, 0x10C4, 0x0403):
            port = p.device
            break
if not port:
    sys.exit("보드의 COM 포트를 못 찾았습니다. 두 번째 인자로 COM 번호를 주세요.")
results = []
for i in range(1, n + 1):
    s = serial.Serial()
    s.port, s.baudrate, s.timeout = port, 115200, 0.2
    s.dtr = s.rts = False
    s.open()
    s.rts = True; time.sleep(0.1); s.rts = False
    t0 = time.time(); buf = b""; res = "timeout"; retry = False
    while time.time() - t0 < 90:
        buf += s.read(4096)
        txt = buf.decode("utf-8", "replace")
        if "sync: retry" in txt:
            retry = True
        if "sync: ok" in txt:
            res = "ok"; break
        if "sync: fail" in txt:
            res = "fail " + txt[txt.rfind("sync: fail"):].splitlines()[0]; break
    s.close()
    dt = time.time() - t0
    results.append((res, dt, retry))
    print(f"{i}: {res}  {dt:.1f}s{'  (다시 붙어 봄)' if retry else ''}", flush=True)
    time.sleep(3)
ok = sum(1 for r in results if r[0] == "ok")
print(f"성공 {ok}/{n}")
