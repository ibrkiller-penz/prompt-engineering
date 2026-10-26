"""board-kit/{7inch,4inch} + board-kit/common 을 board-kit 와 같은 모양(common 과 보드 폴더가 나란히)으로 내려받기용 zip 에 담는다.
   python scripts/make-board-zips.py
결과: public/board/penedu-board-<보드>-starter.zip, content/board/kits.json (크기·날짜, 화면에 표시)
"""
import json, os, sys, zipfile, datetime, subprocess
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KIT = os.path.join(ROOT, "board-kit")
OUT = os.path.join(ROOT, "public", "board")
SKIP_DIRS = {".pio", "node_modules", "managed_components", "__pycache__", ".dummy", ".vscode", ".firebase", "out"}
SKIP_FILES = {"build.log", "build.done", "CMakeLists.txt", "Thumbs.db", ".DS_Store"}
SKIP_PREFIX = ("sdkconfig.",)
SKIP_REL = ("tools/sim/",)   # 화면 시뮬레이터: 실제 학교 일정 예시가 들어 있어 키트에서 뺀다
os.makedirs(OUT, exist_ok=True)
meta = {}
for board in ("7inch", "4inch"):
    name = f"penedu-board-{board}-starter.zip"
    path = os.path.join(OUT, name)
    seen = {}
    for sub in ("common", board):  # board-kit 와 같은 모양: <zip>/common/..., <zip>/<보드>/...
        src = os.path.join(KIT, sub)
        # git 에 올라간 파일만 담는다(board_config.local.h·backup·빌드 찌꺼기 같은 git 제외 파일이 섞이지 않게, 2026-10-20)
        tracked = subprocess.run(["git", "-c", "core.quotepath=off", "ls-files", "-z", "."], cwd=src, capture_output=True, check=True).stdout.decode("utf-8").split("\0")
        for rel in filter(None, tracked):
            parts = rel.split("/")
            if any(p in SKIP_DIRS for p in parts[:-1]) or rel.startswith(SKIP_REL):
                continue
            f = parts[-1]
            if f in SKIP_FILES or f.startswith(SKIP_PREFIX) or f.endswith((".log", ".pyc")):
                continue
            seen[sub + "/" + rel] = os.path.join(src, rel)
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for rel in sorted(seen):
            zi = zipfile.ZipInfo(f"penedu-board-{board}/{rel}", date_time=(2026, 10, 6, 0, 0, 0))
            zi.compress_type = zipfile.ZIP_DEFLATED
            zi.external_attr = 0o644 << 16
            with open(seen[rel], "rb") as fh:
                z.writestr(zi, fh.read())
    meta[board] = {"file": name, "bytes": os.path.getsize(path), "date": datetime.date.today().isoformat(), "files": len(seen)}
    print(name, meta[board]["bytes"], "bytes,", len(seen), "files")
# 단축키 도우미 단독 꾸러미(7인치·4인치 공통): 키트 없이 다른 컴퓨터에 설치.bat 만 눌러 깔기(2026-10-26)
helpers = [os.path.join(KIT, b, "tools", "deck_helper.ps1") for b in ("7inch", "4inch")]
hb = [open(h, "rb").read() for h in helpers]
if hb[0] != hb[1]:
    sys.exit("7inch/tools/deck_helper.ps1 과 4inch/tools/deck_helper.ps1 이 다르다 — 한쪽을 고쳤으면 다른 쪽에도 똑같이 복사할 것")
name = "penedu-board-deck-helper.zip"
path = os.path.join(OUT, name)
pkg = {"deck_helper.ps1": helpers[0]}
hd = os.path.join(KIT, "common", "deck-helper")
for f in sorted(os.listdir(hd)):
    if os.path.isfile(os.path.join(hd, f)):   # exe/ (소스·아이콘·만들기 스크립트)는 키트에만, 꾸러미에는 만든 exe 만
        pkg[f] = os.path.join(hd, f)
with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for rel in sorted(pkg):
        zi = zipfile.ZipInfo(f"penedu-board-deck-helper/{rel}", date_time=(2026, 10, 6, 0, 0, 0))
        zi.compress_type = zipfile.ZIP_DEFLATED
        zi.external_attr = 0o644 << 16
        with open(pkg[rel], "rb") as fh:
            z.writestr(zi, fh.read())
meta["helper"] = {"file": name, "bytes": os.path.getsize(path), "date": datetime.date.today().isoformat(), "files": len(pkg)}
print(name, meta["helper"]["bytes"], "bytes,", len(pkg), "files")
# penedu.web.app/deck 에서 받는 것: exe 하나만 든 압축. Firebase 무료(Spark) 요금제는 .exe 파일을 올리지 못하게 막는다(2026-10-26).
# 압축 안의 exe 는 풀지 않고 더블클릭해도 된다(처음 켤 때 %LOCALAPPDATA%\PeneduBoard 로 자기를 복사한다).
exe_name = "penedu-deck-helper-exe.zip"
with zipfile.ZipFile(os.path.join(OUT, exe_name), "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    zi = zipfile.ZipInfo("교실알림판_도우미.exe", date_time=(2026, 10, 6, 0, 0, 0))
    zi.compress_type = zipfile.ZIP_DEFLATED
    zi.external_attr = 0o644 << 16
    with open(os.path.join(hd, "교실알림판_도우미.exe"), "rb") as fh:
        z.writestr(zi, fh.read())
meta["helperExe"] = {"file": exe_name, "bytes": os.path.getsize(os.path.join(OUT, exe_name)), "date": datetime.date.today().isoformat()}
print(exe_name, meta["helperExe"]["bytes"], "bytes")
with open(os.path.join(ROOT, "content", "board", "kits.json"), "w", encoding="utf-8") as fh:
    json.dump(meta, fh, ensure_ascii=False, indent=2)
