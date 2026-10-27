"""사용설명서.html → ../탭덱_사용설명서.pdf (Edge 로 인쇄) + 쪽 그림(확인용, preview/).
   python make_manual_pdf.py

   쪽 번호: 차례와 본문의 <a class="pg" href="#아이디">0</a> 는 PDF 를 한 번 뽑아 본 뒤
   그 아이디가 실제로 놓인 쪽 번호로 바꾸고 다시 뽑는다(번호가 바뀌지 않을 때까지, 최대 3번).
"""
import os, re, subprocess, sys, pathlib
HERE = pathlib.Path(__file__).resolve().parent
src = HERE / "사용설명서.html"
out = HERE.parent / "탭덱_사용설명서.pdf"
edge = next((p for p in [r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe", r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"] if os.path.exists(p)), None)
if not edge:
    sys.exit("Edge 를 찾지 못했어요")
tmp = HERE / "_edge_profile"


def print_pdf():
    subprocess.run([edge, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", f"--user-data-dir={tmp}",
                    "--allow-file-access-from-files", f"--print-to-pdf={out}", src.as_uri()], check=True, timeout=120)


try:
    import fitz
except ImportError:
    fitz = None

for _ in range(3):
    print_pdf()
    if fitz is None:
        break
    doc = fitz.open(out)
    pages = {}
    for page in doc:
        for ln in page.get_links():
            if ln.get("nameddest") and ln.get("page", -1) >= 0:
                pages[ln["nameddest"]] = ln["page"] + 1
    doc.close()
    html = src.read_text(encoding="utf-8")
    new = re.sub(r'(<a class="pg[^"]*" href="#([\w-]+)">)(\d+)(</a>)',
                 lambda m: m.group(1) + str(pages.get(m.group(2), m.group(3))) + m.group(4), html)
    missing = sorted(set(re.findall(r'<a class="pg[^"]*" href="#([\w-]+)">', html)) - set(pages))
    if missing:
        print("쪽을 못 찾은 아이디:", missing)
    if new == html:
        break
    src.write_text(new, encoding="utf-8")

print("PDF:", out, out.stat().st_size, "bytes")
if fitz:
    doc = fitz.open(out)
    pv = HERE / "preview"; pv.mkdir(exist_ok=True)
    for f in pv.glob("p*.png"):
        f.unlink()
    for i, page in enumerate(doc):
        page.get_pixmap(dpi=60).save(pv / f"p{i + 1:02d}.png")
    print("쪽 수:", len(doc))
