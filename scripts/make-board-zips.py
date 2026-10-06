"""board-kit/{7inch,4inch} + board-kit/common 을 board-kit 와 같은 모양(common 과 보드 폴더가 나란히)으로 내려받기용 zip 에 담는다.
   python scripts/make-board-zips.py
결과: public/board/penedu-board-<보드>-starter.zip, content/board/kits.json (크기·날짜, 화면에 표시)
"""
import json, os, sys, zipfile, datetime
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KIT = os.path.join(ROOT, "board-kit")
OUT = os.path.join(ROOT, "public", "board")
SKIP_DIRS = {".pio", "node_modules", "managed_components", "__pycache__", ".dummy", ".vscode", ".firebase", "out"}
SKIP_FILES = {"build.log", "build.done", "CMakeLists.txt", "Thumbs.db", ".DS_Store"}
SKIP_PREFIX = ("sdkconfig.",)
os.makedirs(OUT, exist_ok=True)
meta = {}
for board in ("7inch", "4inch"):
    name = f"penedu-board-{board}-starter.zip"
    path = os.path.join(OUT, name)
    seen = {}
    for sub in ("common", board):  # board-kit 와 같은 모양: <zip>/common/..., <zip>/<보드>/...
        src = os.path.join(KIT, sub)
        for d, dirs, files in os.walk(src):
            dirs[:] = [x for x in dirs if x not in SKIP_DIRS]
            for f in files:
                if f in SKIP_FILES or f.startswith(SKIP_PREFIX) or f.endswith((".log", ".pyc")):
                    continue
                full = os.path.join(d, f)
                seen[sub + "/" + os.path.relpath(full, src).replace(os.sep, "/")] = full
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for rel in sorted(seen):
            zi = zipfile.ZipInfo(f"penedu-board-{board}/{rel}", date_time=(2026, 10, 6, 0, 0, 0))
            zi.compress_type = zipfile.ZIP_DEFLATED
            zi.external_attr = 0o644 << 16
            with open(seen[rel], "rb") as fh:
                z.writestr(zi, fh.read())
    meta[board] = {"file": name, "bytes": os.path.getsize(path), "date": datetime.date.today().isoformat(), "files": len(seen)}
    print(name, meta[board]["bytes"], "bytes,", len(seen), "files")
with open(os.path.join(ROOT, "content", "board", "kits.json"), "w", encoding="utf-8") as fh:
    json.dump(meta, fh, ensure_ascii=False, indent=2)
