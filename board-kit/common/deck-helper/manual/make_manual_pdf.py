"""사용설명서.html → ../사용설명서.pdf (Edge 로 인쇄) + 쪽 그림(확인용, preview/).
   python make_manual_pdf.py
"""
import os, subprocess, sys, pathlib
HERE = pathlib.Path(__file__).resolve().parent
src = HERE / "사용설명서.html"
out = HERE.parent / "단축키도우미_사용설명서.pdf"
edge = next((p for p in [r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe", r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"] if os.path.exists(p)), None)
if not edge:
    sys.exit("Edge 를 찾지 못했어요")
tmp = HERE / "_edge_profile"
subprocess.run([edge, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", f"--user-data-dir={tmp}",
                "--allow-file-access-from-files", f"--print-to-pdf={out}", src.as_uri()], check=True, timeout=120)
print("PDF:", out, out.stat().st_size, "bytes")
try:
    import fitz
    doc = fitz.open(out)
    pv = HERE / "preview"; pv.mkdir(exist_ok=True)
    for i, page in enumerate(doc):
        page.get_pixmap(dpi=60).save(pv / f"p{i + 1:02d}.png")
    print("쪽 수:", len(doc))
except ImportError:
    pass
