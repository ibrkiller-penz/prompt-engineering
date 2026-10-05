# 손발전기 학습지를 워드(.docx)와 한글(.hwpx)로 만든다. (학생용 / 교사용 정답)
# 사용: pip install python-docx python-hwpx  →  python scripts/make-worksheet.py
# 결과: public/handgen/worksheet/학습지_학생용.*, 학습지_교사용(정답).*
#
# 디자인 규칙 (A4, 좌우 여백 20mm → 본문 폭 170mm)
#  - 맨 위 남색 제목 띠 → 정보 칸(학년·반·번호·이름, 높이 13mm) → 학습 목표 상자
#  - 구역 머리글: 남색 번호 칸 + 연한 파랑 제목 칸
#  - 표는 연한 회색 선, 머리 칸은 남색, 첫 열은 연회색, 쓰는 칸은 충분히 높게
# 문항을 고치려면 아래 DATA만 고치면 두 파일이 모두 바뀐다.
from pathlib import Path
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ROW_HEIGHT_RULE, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from hwpx import HwpxDocument

OUT = Path(__file__).resolve().parent.parent / "public" / "handgen" / "worksheet"
OUT.mkdir(parents=True, exist_ok=True)

FONT = "맑은 고딕"
NAVY, YELLOW, TINT, LINE, GRAY, GREEN = "1B2A5C", "FFD34D", "EEF2FB", "AEB8D0", "F5F7FB", "0A5A30"

# ---------------------------------------------------------------- 내용
TITLE = "「흔들면 빛난다」 손발전기 학습지"
SUBTITLE = "손발전기를 만들고, 불이 켜지는 까닭을 알아봐요"
GOAL = "손발전기에서 운동 에너지가 전기 에너지로 바뀌는 과정을 설명할 수 있다."
STANDARD = "성취기준 [10통과2-02-05] 발전기에서 운동 에너지가 전기 에너지로 전환되는 과정을 이해한다."
FOOT = "키트 설명서를 참고해 교사가 재구성한 학습 자료"

def DATA(teacher):
    return {
        "blanks": [
            ("코일을 지나는", "자기장", "이 변할 때 코일에 전류가 흐르는 현상을"),
            ("", "전자기 유도", "라고 한다. 이때 흐르는 전류를"),
            ("", "유도 전류", "라고 한다. 자석이 왔다 갔다 하면 방향이 번갈아 바뀌는 전류를"),
            ("", "교류", "라고 한다."),
        ],
        "energy": ["손으로 흔듦", "자석의 운동", "전기", "LED의 빛"],
        "legend": "밝기 기호:  ◎ 밝음   ○ 보통   △ 희미   × 안 켜짐",
        "table_head": ["조건 (15초씩 흔들기)", "LED 밝기", "깜빡임 횟수\n(대략)", "느낀 점"],
        "table_rows": [
            ["자석을 가만히 두기", "×", "0", ""],
            ["천천히 흔들기", "△", "", ""],
            ["보통 빠르기로 흔들기", "○", "", ""],
            ["매우 빠르게 흔들기", "◎", "", ""],
            ["LED 방향을 바꿔 끼우기 (선택)", "", "", ""],
        ],
        "questions": [
            ("자석을 코일 속에 가만히 두면 LED가 켜지지 않는 이유를 설명하시오.",
             "자석이 멈추면 코일을 지나는 자기장이 변하지 않아 유도 전류가 생기지 않는다."),
            ("흔드는 속도를 높이면 더 밝아지는 까닭을 '자기장의 변화'라는 말을 써서 쓰시오.",
             "빠르게 흔들면 자기장이 더 빨리 변해 더 큰 유도 전압이 생긴다."),
            ("LED가 계속 켜져 있지 않고 깜빡이는 까닭은 무엇인가?",
             "자석이 왕복해 전류 방향이 바뀌고, LED는 한 방향일 때만 빛나므로."),
        ],
        "think": ("발전소에서는 손 대신 무엇이 터빈을 돌릴까? 조사해서 한 가지 쓰시오. (예: 증기, 물, 바람)",
                  "증기(화력·원자력), 물(수력), 바람(풍력) 중 하나"),
        "self": ["전자기 유도를 한 문장으로\n설명할 수 있다", "에너지 전환 과정을\n말할 수 있다", "손발전기를\n혼자 만들었다"],
    }

# ================================================================ DOCX
W = 17.0  # 본문 폭(cm)

def shade(cell, color):
    tcPr = cell._tc.get_or_add_tcPr()
    for old in tcPr.findall(qn("w:shd")): tcPr.remove(old)
    shd = OxmlElement("w:shd"); shd.set(qn("w:val"), "clear"); shd.set(qn("w:color"), "auto"); shd.set(qn("w:fill"), color)
    tcPr.append(shd)

def tbl_borders(t, color=LINE, sz=6, none=False):
    tblPr = t._tbl.tblPr
    for old in tblPr.findall(qn("w:tblBorders")): tblPr.remove(old)
    b = OxmlElement("w:tblBorders")
    for e in ("top", "left", "bottom", "right", "insideH", "insideV"):
        x = OxmlElement("w:" + e)
        x.set(qn("w:val"), "nil" if none else "single"); x.set(qn("w:sz"), str(sz)); x.set(qn("w:space"), "0"); x.set(qn("w:color"), color)
        b.append(x)
    tblPr.append(b)

def cell_edge(cell, edge, color, sz):
    tcPr = cell._tc.get_or_add_tcPr()
    b = tcPr.find(qn("w:tcBorders"))
    if b is None:
        b = OxmlElement("w:tcBorders"); tcPr.append(b)
    x = OxmlElement("w:" + edge)
    x.set(qn("w:val"), "single"); x.set(qn("w:sz"), str(sz)); x.set(qn("w:space"), "0"); x.set(qn("w:color"), color)
    b.append(x)

def make_table(doc, rows, widths):
    t = doc.add_table(rows=rows, cols=len(widths))
    t.autofit = False; t.alignment = WD_TABLE_ALIGNMENT.CENTER
    lay = OxmlElement("w:tblLayout"); lay.set(qn("w:type"), "fixed"); t._tbl.tblPr.append(lay)
    for i, gc in enumerate(t._tbl.tblGrid.findall(qn("w:gridCol"))): gc.set(qn("w:w"), str(int(widths[i] * 567)))
    for r in t.rows:
        for i, c in enumerate(r.cells): c.width = Cm(widths[i])
        trPr = r._tr.get_or_add_trPr(); cs = OxmlElement("w:cantSplit"); trPr.append(cs)
    return t

def row_h(row, cm, exact=True):
    row.height = Cm(cm)
    row.height_rule = WD_ROW_HEIGHT_RULE.EXACTLY if exact else WD_ROW_HEIGHT_RULE.AT_LEAST

def put(cell, text, size=11, bold=False, color="222222", align="center", valign="center", after=0):
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER if valign == "center" else WD_CELL_VERTICAL_ALIGNMENT.TOP
    lines = text.split("\n")
    for k, line in enumerate(lines):
        p = cell.paragraphs[0] if k == 0 else cell.add_paragraph()
        p.alignment = {"center": WD_ALIGN_PARAGRAPH.CENTER, "left": WD_ALIGN_PARAGRAPH.LEFT}[align]
        p.paragraph_format.space_before = Pt(0); p.paragraph_format.space_after = Pt(after)
        p.paragraph_format.line_spacing = 1.25
        r = p.add_run(line); font(r, size, bold, color)

def font(r, size, bold=False, color="222222", underline=False):
    r.font.name = FONT; r._element.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), FONT)
    r.font.size = Pt(size); r.bold = bold; r.underline = underline
    r.font.color.rgb = RGBColor.from_string(color)

def gap(doc, pt=8):
    p = doc.add_paragraph(); p.paragraph_format.space_before = Pt(0); p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = Pt(pt)
    r = p.add_run(""); r.font.size = Pt(2)

def heading(doc, n, text):
    t = make_table(doc, 1, [1.0, W - 1.0]); tbl_borders(t, none=True); row_h(t.rows[0], 1.0)
    a, b = t.rows[0].cells
    shade(a, NAVY); shade(b, TINT)
    put(a, str(n), 14, True, "FFFFFF"); put(b, text, 13, True, NAVY, align="left")
    b.paragraphs[0].paragraph_format.left_indent = Cm(0.3)
    gap(doc, 8)

def make_docx(teacher, path):
    d = DATA(teacher)
    doc = Document()
    s = doc.sections[0]
    s.page_width, s.page_height = Cm(21), Cm(29.7)
    s.left_margin = s.right_margin = Cm(2.0); s.top_margin = Cm(1.7); s.bottom_margin = Cm(1.6)
    st = doc.styles["Normal"]; st.font.name = FONT; st.element.rPr.rFonts.set(qn("w:eastAsia"), FONT); st.font.size = Pt(11)

    # 1) 제목 띠
    t = make_table(doc, 1, [W]); tbl_borders(t, none=True); row_h(t.rows[0], 2.0)
    c = t.rows[0].cells[0]; shade(c, NAVY); cell_edge(c, "bottom", YELLOW, 36)
    c.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    p = c.paragraphs[0]; p.alignment = WD_ALIGN_PARAGRAPH.CENTER; p.paragraph_format.space_after = Pt(2)
    font(p.add_run(TITLE), 21, True, "FFFFFF")
    p2 = c.add_paragraph(); p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    font(p2.add_run(SUBTITLE + ("   |   교사용 정답" if teacher else "")), 10.5, False, YELLOW)
    gap(doc, 10)

    # 2) 정보 칸 (크게)
    wid = [1.5, 2.4, 1.2, 2.2, 1.6, 2.4, 1.5, 4.2]
    t = make_table(doc, 1, wid); tbl_borders(t, "8C98B8", 8); row_h(t.rows[0], 1.3)
    for i, c in enumerate(t.rows[0].cells):
        if i % 2 == 0:
            shade(c, TINT); put(c, ["학년", "반", "번호", "이름"][i // 2], 11.5, True, NAVY)
    gap(doc, 10)

    # 3) 학습 목표
    t = make_table(doc, 1, [W]); tbl_borders(t, "D9DFEC", 6); row_h(t.rows[0], 1.5, exact=False)
    c = t.rows[0].cells[0]; shade(c, GRAY); cell_edge(c, "left", YELLOW, 48)
    c.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    p = c.paragraphs[0]; p.paragraph_format.left_indent = Cm(0.3); p.paragraph_format.space_after = Pt(2)
    font(p.add_run("🎯 오늘의 목표  "), 10.5, True, NAVY); font(p.add_run(GOAL), 10.5, False, "222222")
    p = c.add_paragraph(); p.paragraph_format.left_indent = Cm(0.3); p.paragraph_format.space_after = Pt(0)
    font(p.add_run(STANDARD), 9, False, "5B6784")
    gap(doc, 10)

    # 4) 용어 빈칸
    heading(doc, 1, "용어 빈칸 채우기")
    p = doc.add_paragraph(); p.paragraph_format.line_spacing = 1.8; p.paragraph_format.left_indent = Cm(0.2)
    p.paragraph_format.space_after = Pt(0)
    for pre, ans, post in d["blanks"]:
        if pre: font(p.add_run(pre + " "), 11.5)
        if teacher: font(p.add_run(" " + ans + " "), 11.5, True, GREEN, True)
        else: font(p.add_run(" " * 16), 11.5, False, "222222", True)
        font(p.add_run(" " + post + " "), 11.5)
    gap(doc, 10)

    # 5) 에너지 전환
    heading(doc, 2, "에너지가 어떻게 바뀔까?")
    ew = [3.3, 0.9, 3.8, 0.9, 3.8, 0.9, 3.4]
    t = make_table(doc, 1, ew); tbl_borders(t, none=True); row_h(t.rows[0], 1.7)
    cells = t.rows[0].cells
    fills = [("손으로 흔듦", "FFF1BF", d["energy"][0]), None, "mid1", None, "mid2", None, ("LED의 빛", "FFF1BF", d["energy"][3])]
    for i, c in enumerate(cells):
        if i % 2 == 1:
            put(c, "→", 18, True, NAVY)
        elif i in (0, 6):
            shade(c, "FFF1BF"); [cell_edge(c, e, "E0B93A", 8) for e in ("top", "left", "bottom", "right")]
            put(c, "손으로\n흔듦" if i == 0 else "LED의\n빛", 11.5, True, "5A4500")
        else:
            [cell_edge(c, e, "8C98B8", 8) for e in ("top", "left", "bottom", "right")]
            if teacher: put(c, d["energy"][1 if i == 2 else 2] + "\n에너지", 11.5, True, GREEN)
            else: put(c, "(      )\n에너지", 11.5, False, "888888")
    gap(doc, 10)

    # 6) 관찰 기록표
    heading(doc, 3, "관찰 기록표")
    p = doc.add_paragraph(); p.paragraph_format.space_after = Pt(4); font(p.add_run(d["legend"]), 10, False, "5B6784")
    cw = [5.4, 2.6, 3.0, 6.0]
    t = make_table(doc, 1 + len(d["table_rows"]), cw); tbl_borders(t, LINE, 6)
    row_h(t.rows[0], 1.15)
    for i, h in enumerate(d["table_head"]):
        c = t.rows[0].cells[i]; shade(c, NAVY); put(c, h, 10.5, True, "FFFFFF")
    for r, row in enumerate(d["table_rows"], 1):
        row_h(t.rows[r], 1.2)
        for i, v in enumerate(row):
            c = t.rows[r].cells[i]
            if i == 0:
                shade(c, GRAY); put(c, v, 10.5, True, NAVY, align="left"); c.paragraphs[0].paragraph_format.left_indent = Cm(0.2)
            elif teacher and v:
                put(c, v, 14, True, GREEN)
    gap(doc, 4)
    if teacher:
        p = doc.add_paragraph(); font(p.add_run("예상: 가만히 두면 ×, 빠를수록 밝고 깜빡임이 많아진다."), 10, True, GREEN)

    # 7) 탐구 질문 (새 쪽)
    pb = doc.add_paragraph(); pb.paragraph_format.page_break_before = True
    pb.paragraph_format.space_before = Pt(0); pb.paragraph_format.space_after = Pt(0); pb.paragraph_format.line_spacing = Pt(2)
    heading(doc, 4, "탐구 질문")
    def qbox(i, q, ans, h):
        p = doc.add_paragraph(); p.paragraph_format.space_after = Pt(4); p.paragraph_format.keep_with_next = True
        font(p.add_run(f"({i}) "), 11.5, True, NAVY); font(p.add_run(q), 11.5)
        t = make_table(doc, 1, [W]); tbl_borders(t, LINE, 8); row_h(t.rows[0], h, exact=not teacher)
        c = t.rows[0].cells[0]
        if teacher:
            put(c, "정답  " + ans, 10.5, True, GREEN, align="left", valign="top"); shade(c, "EAF6EF")
        c.paragraphs[0].paragraph_format.left_indent = Cm(0.2)
        gap(doc, 12)
    for i, (q, a) in enumerate(d["questions"], 1): qbox(i, q, a, 3.1)

    heading(doc, 5, "생각 넓히기")
    qbox("1", d["think"][0], d["think"][1], 2.6)

    # 8) 자기평가
    heading(doc, 6, "자기평가")
    t = make_table(doc, 1, [W / 3] * 3); tbl_borders(t, LINE, 6); row_h(t.rows[0], 1.7)
    for c, txt in zip(t.rows[0].cells, d["self"]):
        put(c, "☐  " + txt, 10.5, False, "222222")

    # 바닥글
    f = s.footer.paragraphs[0]; f.alignment = WD_ALIGN_PARAGRAPH.CENTER; font(f.add_run(FOOT), 9, False, "6B7690")
    doc.save(path)

# ================================================================ HWPX
MM = 7200 / 25.4          # 1mm = 약 283.5 한글 단위
HW = int(170 * MM)        # 본문 폭

def make_hwpx(teacher, path):
    d = DATA(teacher)
    doc = HwpxDocument.new()
    doc.set_page_setup(paper_size="A4", margin_left_mm=20, margin_right_mm=20, margin_top_mm=17, margin_bottom_mm=16)
    S = doc.styles.ensure_run
    st_title = S(bold=True, size=21, color="#FFFFFF", font=FONT)
    st_sub = S(size=10.5, color="#FFD34D", font=FONT)
    st_lab = S(bold=True, size=11.5, color="#1B2A5C", font=FONT)
    st_num = S(bold=True, size=14, color="#FFFFFF", font=FONT)
    st_head = S(bold=True, size=13, color="#1B2A5C", font=FONT)
    st_body = S(size=11.5, font=FONT)
    st_small = S(size=9, color="#5B6784", font=FONT)
    st_gap = S(size=4, font=FONT)
    st_ans = S(bold=True, size=11, color="#0A5A30", font=FONT)
    st_th = S(bold=True, size=10.5, color="#FFFFFF", font=FONT)
    st_cell = S(size=10.5, font=FONT)
    st_cellb = S(bold=True, size=10.5, color="#1B2A5C", font=FONT)

    def table(rows, weights, h_mm, fill=None, line="#AEB8D0"):
        t = doc.add_table(rows, len(weights), width=HW, height=int(h_mm * rows * MM))
        t.set_column_widths(weights)
        for r in range(rows):
            for c in range(len(weights)):
                t.set_cell_borders(r, c, color=line)
        return t

    def put(t, r, c, text, style, fill=None):
        t.set_cell_text(r, c, text)
        cell = t.cell(r, c)
        for p in cell.paragraphs: p.char_pr_id_ref = style
        if fill: t.set_cell_shading(r, c, fill)

    def gap(n=1):
        for _ in range(n): doc.add_paragraph("", char_pr_id_ref=st_gap)

    def heading(n, text):
        t = table(1, [1, 16], 9, line="#FFFFFF")
        put(t, 0, 0, str(n), st_num, "#1B2A5C"); put(t, 0, 1, "  " + text, st_head, "#EEF2FB")
        gap()

    # 제목 띠
    t = table(1, [1], 19, line="#1B2A5C")
    put(t, 0, 0, TITLE + ("   [교사용 정답]" if teacher else ""), st_title, "#1B2A5C")
    p = t.cell(0, 0).add_paragraph(SUBTITLE); p.char_pr_id_ref = st_sub
    gap()
    # 정보 칸
    t = table(1, [1.5, 2.4, 1.2, 2.2, 1.6, 2.4, 1.5, 4.2], 12, line="#8C98B8")
    for i, lab in enumerate(["학년", "반", "번호", "이름"]): put(t, 0, i * 2, lab, st_lab, "#EEF2FB")
    gap()
    # 목표
    t = table(1, [1], 13, line="#D9DFEC")
    put(t, 0, 0, "오늘의 목표  " + GOAL, st_body, "#F5F7FB")
    p = t.cell(0, 0).add_paragraph(STANDARD); p.char_pr_id_ref = st_small
    gap()

    heading(1, "용어 빈칸 채우기")
    for pre, ans, post in d["blanks"]:
        pass
    sent = ""
    for pre, ans, post in d["blanks"]:
        sent += (pre + " " if pre else "") + ("(" + ans + ")" if teacher else "(                )") + " " + post + " "
    doc.add_paragraph(sent.strip(), char_pr_id_ref=st_ans if teacher else st_body)
    gap()

    heading(2, "에너지가 어떻게 바뀔까?")
    t = table(1, [3.3, 0.9, 3.8, 0.9, 3.8, 0.9, 3.4], 16, line="#8C98B8")
    put(t, 0, 0, "손으로 흔듦", st_cellb, "#FFF1BF"); put(t, 0, 1, "→", st_head)
    put(t, 0, 2, (d["energy"][1] + " 에너지") if teacher else "(      ) 에너지", st_ans if teacher else st_cell)
    put(t, 0, 3, "→", st_head)
    put(t, 0, 4, (d["energy"][2] + " 에너지") if teacher else "(      ) 에너지", st_ans if teacher else st_cell)
    put(t, 0, 5, "→", st_head); put(t, 0, 6, "LED의 빛", st_cellb, "#FFF1BF")
    gap()

    heading(3, "관찰 기록표")
    doc.add_paragraph(d["legend"], char_pr_id_ref=st_small)
    n = 1 + len(d["table_rows"])
    t = table(n, [5.4, 2.6, 3.0, 6.0], 9.5)
    for i, h in enumerate(d["table_head"]): put(t, 0, i, h.replace("\n", " "), st_th, "#1B2A5C")
    for r, row in enumerate(d["table_rows"], 1):
        for i, v in enumerate(row):
            if i == 0: put(t, r, i, v, st_cellb, "#F5F7FB")
            elif teacher and v: put(t, r, i, v, st_ans)
    gap()
    if teacher: doc.add_paragraph("예상: 가만히 두면 ×, 빠를수록 밝고 깜빡임이 많아진다.", char_pr_id_ref=st_ans)

    doc.add_paragraph("", char_pr_id_ref=st_small, pageBreak="1")
    heading(4, "탐구 질문")
    def qbox(i, q, ans, h):
        doc.add_paragraph(f"({i}) {q}", char_pr_id_ref=st_body)
        t = table(1, [1], h, line="#AEB8D0")
        if teacher: put(t, 0, 0, "정답  " + ans, st_ans, "#EAF6EF")
        gap()
    for i, (q, a) in enumerate(d["questions"], 1): qbox(i, q, a, 28)
    heading(5, "생각 넓히기")
    qbox(1, d["think"][0], d["think"][1], 22)
    heading(6, "자기평가")
    t = table(1, [1, 1, 1], 16, line="#AEB8D0")
    for i, txt in enumerate(d["self"]): put(t, 0, i, "☐  " + txt.replace("\n", " "), st_cell)
    gap()
    doc.add_paragraph(FOOT, char_pr_id_ref=st_small)
    doc.save_to_path(str(path))

for teacher in (False, True):
    name = "학습지_교사용(정답)" if teacher else "학습지_학생용"
    make_docx(teacher, OUT / f"{name}.docx")
    make_hwpx(teacher, OUT / f"{name}.hwpx")
    print("만듦:", name)
