# 손발전기 학습지를 워드(.docx)와 한글(.hwpx)로 만든다.
# 사용: pip install python-docx python-hwpx  →  python scripts/make-worksheet.py
# 결과: public/handgen/worksheet/학습지_학생용.* , 학습지_교사용(정답).*
from pathlib import Path
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from hwpx import HwpxDocument

OUT = Path(__file__).resolve().parent.parent / "public" / "handgen" / "worksheet"
OUT.mkdir(parents=True, exist_ok=True)
FONT = "맑은 고딕"

TITLE = "「흔들면 빛난다」 손발전기 학습지"
STANDARD = "성취기준  [10통과2-02-05] 발전기에서 운동 에너지가 전기 에너지로 전환되는 과정을 이해한다."
FOOT = "키트 설명서를 참고해 교사가 재구성한 학습 자료"

def content(teacher):
    A = (lambda s: f"  ▶ 정답: {s}") if teacher else (lambda s: "")
    blank = "(            )"
    items = [
        ("h", "1. 용어 빈칸 채우기"),
        ("p", f"코일을 지나는 {blank if not teacher else '(자기장)'}이 변할 때 코일에 전류가 흐르는 현상을 "
              f"{blank if not teacher else '(전자기 유도)'}라고 한다. 이때 흐르는 전류를 "
              f"{blank if not teacher else '(유도 전류)'}라고 한다. 자석이 왕복하므로 전류의 방향이 번갈아 바뀌는 "
              f"{blank if not teacher else '(교류)'}가 만들어진다."),
        ("h", "2. 에너지 전환 쓰기"),
        ("p", "손으로 흔듦  →  " + ("(자석의 운동)" if teacher else blank) + " 에너지  →  "
              + ("(전기)" if teacher else blank) + " 에너지  →  LED의 빛"),
        ("h", "3. 관찰 기록표"),
        ("p", "같은 손발전기를 아래 조건으로 15초씩 흔들고 LED를 관찰하여 기록한다.  (밝기: ◎ 밝음  ○ 보통  △ 희미  × 안 켜짐)"),
        ("t", ["조건", "LED 밝기", "깜빡임 횟수(대략)", "느낀 점"],
              [["자석 가만히 두기", "×" if teacher else "", "0" if teacher else "", ""],
               ["천천히 흔들기", "△" if teacher else "", "", ""],
               ["보통 빠르기", "○" if teacher else "", "", ""],
               ["매우 빠르게", "◎" if teacher else "", "", ""],
               ["LED 방향 바꿔 끼우기 (선택)", "", "", ""]]),
        ("h", "4. 탐구 질문"),
        ("q", "(1) 자석을 코일 속에 가만히 두면 LED가 켜지지 않는 이유를 설명하시오.",
              A("자석이 멈추면 코일을 지나는 자기장이 변하지 않아 유도 전류가 생기지 않는다.")),
        ("q", "(2) 흔드는 속도를 높이면 더 밝아지는 까닭을 '자기장의 변화'라는 말을 써서 쓰시오.",
              A("빠르게 흔들면 자기장이 더 빨리 변해 더 큰 유도 전압이 생긴다.")),
        ("q", "(3) LED가 계속 켜져 있지 않고 깜빡이는 까닭은 무엇인가?",
              A("자석이 왕복해 전류 방향이 바뀌고, LED는 한 방향일 때만 빛나므로.")),
        ("h", "5. 생각 넓히기"),
        ("q", "발전소에서 손 대신 터빈을 돌리는 것은 무엇일까? 조사해서 한 가지 쓰시오.  (예: 증기, 물, 바람)",
              A("증기(화력·원자력), 물(수력), 바람(풍력) 중 하나")),
        ("h", "6. 자기평가"),
        ("p", "☐ 전자기 유도를 한 문장으로 설명할 수 있다     ☐ 에너지 전환 과정을 말할 수 있다     ☐ 손발전기를 혼자 만들었다"),
    ]
    return items

# ---------- DOCX ----------
def shade(cell, color):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd"); shd.set(qn("w:val"), "clear"); shd.set(qn("w:color"), "auto"); shd.set(qn("w:fill"), color)
    tcPr.append(shd)

def set_font(run, size, bold=False, color=None):
    run.font.name = FONT; run._element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
    run.font.size = Pt(size); run.bold = bold
    if color: run.font.color.rgb = RGBColor.from_string(color)

def make_docx(teacher, path):
    d = Document()
    s = d.sections[0]
    s.page_width, s.page_height = Cm(21), Cm(29.7)
    s.left_margin = s.right_margin = Cm(2.2); s.top_margin = Cm(2.0); s.bottom_margin = Cm(1.8)
    st = d.styles["Normal"]; st.font.name = FONT; st.element.rPr.rFonts.set(qn("w:eastAsia"), FONT); st.font.size = Pt(11)
    st.paragraph_format.line_spacing = 1.5

    p = d.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(TITLE + ("  [교사용 정답]" if teacher else "")); set_font(r, 20, True, "1B2A5C")
    p.paragraph_format.space_after = Pt(6)
    t = d.add_table(rows=1, cols=2); t.alignment = WD_TABLE_ALIGNMENT.CENTER; t.style = "Table Grid"
    for c, txt in zip(t.rows[0].cells, ["학년  반  번호 :", "이름 :"]):
        c.text = ""; set_font(c.paragraphs[0].add_run(txt), 11, True); shade(c, "EEF2FB")
        c.paragraphs[0].paragraph_format.space_before = Pt(4); c.paragraphs[0].paragraph_format.space_after = Pt(4)
    p = d.add_paragraph(); r = p.add_run(STANDARD); set_font(r, 10, False, "4A5775")
    p.paragraph_format.space_before = Pt(8); p.paragraph_format.space_after = Pt(4)

    for it in content(teacher):
        k = it[0]
        if k == "h":
            p = d.add_paragraph(); p.paragraph_format.space_before = Pt(16); p.paragraph_format.space_after = Pt(4)
            p.paragraph_format.keep_with_next = True
            set_font(p.add_run(it[1]), 13, True, "1B2A5C")
            pPr = p._p.get_or_add_pPr(); b = OxmlElement("w:pBdr"); bt = OxmlElement("w:bottom")
            for a, v in (("val", "single"), ("sz", "6"), ("space", "1"), ("color", "FFC933")): bt.set(qn("w:" + a), v)
            b.append(bt); pPr.append(b)
        elif k == "p":
            p = d.add_paragraph(); set_font(p.add_run(it[1]), 11)
            p.paragraph_format.space_after = Pt(6)
        elif k == "q":
            p = d.add_paragraph(); set_font(p.add_run(it[1]), 11); p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.keep_with_next = True
            if it[2]:
                a = d.add_paragraph(); set_font(a.add_run(it[2].strip()), 10.5, True, "0A5A30"); a.paragraph_format.space_after = Pt(8)
            else:
                box = d.add_table(rows=1, cols=1); box.style = "Table Grid"
                box.rows[0].height = Cm(2.4); box.rows[0].cells[0].text = ""
                d.add_paragraph().paragraph_format.space_after = Pt(2)
        elif k == "t":
            head, rows = it[1], it[2]
            tb = d.add_table(rows=1 + len(rows), cols=len(head)); tb.style = "Table Grid"; tb.alignment = WD_TABLE_ALIGNMENT.CENTER
            widths = [Cm(5.2), Cm(2.8), Cm(3.6), Cm(4.9)]
            for ci, h in enumerate(head):
                c = tb.rows[0].cells[ci]; c.text = ""; set_font(c.paragraphs[0].add_run(h), 10.5, True)
                c.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER; shade(c, "E3E9F7")
            for ri, row in enumerate(rows, 1):
                tb.rows[ri].height = Cm(1.1)
                for ci, v in enumerate(row):
                    c = tb.rows[ri].cells[ci]; c.text = ""; set_font(c.paragraphs[0].add_run(v), 10.5, bold=(ci == 0))
                    if ci in (1, 2): c.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
            for row in tb.rows:
                for ci, c in enumerate(row.cells): c.width = widths[ci]
            d.add_paragraph().paragraph_format.space_after = Pt(2)
    p = d.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER; p.paragraph_format.space_before = Pt(10)
    set_font(p.add_run(FOOT), 9, False, "6B7690")
    d.save(path)

# ---------- HWPX ----------
def make_hwpx(teacher, path):
    doc = HwpxDocument.new()
    doc.set_page_margins(left=6200, right=6200, top=5600, bottom=5000)
    title_style = doc.ensure_run_style(bold=True, size=20, color="#1B2A5C", font=FONT)
    head_style = doc.ensure_run_style(bold=True, size=13, color="#1B2A5C", font=FONT)
    bold_style = doc.ensure_run_style(bold=True, size=11, font=FONT)
    ans_style = doc.ensure_run_style(bold=True, size=10.5, color="#0A5A30", font=FONT)
    note_style = doc.ensure_run_style(size=10, color="#4A5775", font=FONT)
    body_style = doc.ensure_run_style(size=11, font=FONT)

    doc.paragraphs[0].text = TITLE + ("  [교사용 정답]" if teacher else "")
    doc.paragraphs[0].char_pr_id_ref = title_style
    doc.add_paragraph("")
    tb = doc.add_table(1, 2); tb.set_cell_text(0, 0, "학년   반   번호 :"); tb.set_cell_text(0, 1, "이름 :")
    doc.add_paragraph(STANDARD, char_pr_id_ref=note_style)

    for it in content(teacher):
        k = it[0]
        if k == "h":
            doc.add_paragraph(""); doc.add_paragraph(it[1], char_pr_id_ref=head_style)
        elif k == "p":
            doc.add_paragraph(it[1], char_pr_id_ref=body_style)
        elif k == "q":
            doc.add_paragraph(it[1], char_pr_id_ref=body_style)
            if it[2]:
                doc.add_paragraph(it[2].strip(), char_pr_id_ref=ans_style)
            else:
                box = doc.add_table(1, 1); box.set_cell_text(0, 0, "")
                box.set_column_widths([42000]) if hasattr(box, "set_column_widths") else None
                doc.add_paragraph("")
        elif k == "t":
            head, rows = it[1], it[2]
            t = doc.add_table(1 + len(rows), len(head))
            for ci, h in enumerate(head): t.set_cell_text(0, ci, h)
            for ri, row in enumerate(rows, 1):
                for ci, v in enumerate(row): t.set_cell_text(ri, ci, v)
            doc.add_paragraph("")
    doc.add_paragraph(FOOT, char_pr_id_ref=note_style)
    doc.save_to_path(str(path))

for teacher in (False, True):
    name = "학습지_교사용(정답)" if teacher else "학습지_학생용"
    make_docx(teacher, OUT / f"{name}.docx")
    make_hwpx(teacher, OUT / f"{name}.hwpx")
    print("만듦:", name)
