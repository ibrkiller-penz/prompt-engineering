# 인포그래픽 프롬프트(content/slides/slides.json 의 designs[].infographic)를 다시 만든다.
# 사용: python scripts/make-infographic-prompts.py
#
# 왜 이렇게 쓰나 (외국 사례·노트북LM 분석 기준)
#  - 노트북LM 인포그래픽은 사용자가 쓴 글에서 '디자인 지시(스타일·레이아웃·색)'만 자연어로 뽑아 쓰고,
#    내용은 소스 원문을 그대로 옮긴다. 그래서 FUNCTION_CALL 같은 코드 형식은 쓰지 않는다.
#  - 글자가 많을수록 글자가 깨진다 → 글을 최소로, 한 줄 8단어 안팎, 강조는 3개 이하.
#  - 색은 코드(#RRGGBB)만 쓰면 잘 해석되지 않는다 → 색 이름 + 코드를 함께 쓴다. 'white/black' 대신 light/dark 계열 낱말.
#  - 슬라이드 수·슬라이드 유형(Type A~D) 같은 슬라이드 용어는 쓰지 않는다.
#  - 소스는 [Infographic Master Blueprint] 대본: 구역 제목·화면 텍스트·강조 숫자를 그대로 쓰라고 직접 지시한다.
import colorsys
import json
import re
from pathlib import Path

PATH = Path(__file__).resolve().parent.parent / "content" / "slides" / "slides.json"

ROLE = {
    "배경": "background",
    "제목·본문 글자": "titles and body text",
    "본문 글자": "body text",
    "보조 글자": "secondary text",
    "강조·밑줄·체크": "accents, underlines and check marks",
    "글머리 아이콘": "bullet icons",
    "강조 1": "primary accent",
    "강조 2": "secondary accent",
    "주 강조": "main accent",
    "포인트": "highlight color for key numbers",
    "포인트·큰 숫자": "highlight color for big numbers",
}


def color_name(hexv: str) -> str:
    """#RRGGBB → 'deep blue' 같은 쉬운 영어 이름 (white/black 낱말은 피한다)"""
    h = hexv.lstrip("#")
    r, g, b = (int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))
    hh, ll, ss = colorsys.rgb_to_hls(r, g, b)
    deg = hh * 360
    if max(r, g, b) - min(r, g, b) < 0.06:  # 거의 무채색(회색·흰색·검정 계열)
        if ll < 0.15: return "charcoal"
        if ll < 0.35: return "dark gray"
        if ll < 0.65: return "medium gray"
        if ll < 0.9: return "light gray"
        return "clean light"
    chroma = max(r, g, b) - min(r, g, b)
    if chroma < 0.14 and ll < 0.88:  # 채도가 낮은 어두운~중간 색은 회색 계열로 부른다 (글자색이 파랑·주황으로 오해되지 않게)
        shade = "dark" if ll < 0.35 else "medium" if ll < 0.65 else "light"
        return f"{'warm' if (deg < 70 or deg >= 330) else 'cool'} {shade} gray"
    if deg < 15 or deg >= 345: base = "red"
    elif deg < 40: base = "orange"
    elif deg < 55: base = "golden yellow"
    elif deg < 70: base = "yellow"
    elif deg < 165: base = "green"
    elif deg < 195: base = "teal"
    elif deg < 250: base = "blue"
    elif deg < 280: base = "indigo"
    elif deg < 310: base = "purple"
    else: base = "pink"
    if base == "orange" and ll < 0.42: base = "rust brown"
    if ll < 0.22: tone = "very dark"
    elif ll < 0.38: tone = "deep"
    elif ll < 0.62: tone = "vivid" if ss > 0.7 else ""
    elif ll < 0.82: tone = "soft"
    else: tone = "pale"
    return f"{tone} {base}".strip()


def is_dark(hexv: str) -> bool:
    h = hexv.lstrip("#")
    r, g, b = (int(h[i : i + 2], 16) for i in (0, 2, 4))
    return (0.299 * r + 0.587 * g + 0.114 * b) < 110


def build(d: dict) -> str:
    bg = d["bg"]
    dark = is_dark(bg)
    palette = []
    for c in d["colors"]:
        role = ROLE.get(c["role"], c["role"])
        palette.append(f"  - {role}: {color_name(c['hex'])} ({c['hex']})")
    # 부산 디자인처럼 원문에 Graphics 줄이 있으면 그대로 살린다
    gr = re.search(r"^Graphics:\s*(.+)$", d["design"], re.M)
    motif = re.sub(r"\s+", " ", gr.group(1)).strip().replace(" ,", ",") if gr else ""
    extra = f"- Graphic motifs: {motif}\n" if motif else ""
    surface = "dark" if dark else "light"
    return f"""Create ONE infographic from the selected source (an [Infographic Master Blueprint] script).

## Content
- Use only information that is in the source. Copy each section's title and its "On-Screen Text" lines exactly as written. Do not add facts or change any numbers.
- Make one block per blueprint section (3 to 4 blocks). In each block, draw the icon or chart described in its "Visualization Suggestion", and show its "Highlighted Data/Keyword" in the largest type of that block.
- If the source is not a blueprint, choose the 3 to 4 most important ideas yourself, using only facts from the source.
- Write all text in Korean, the same language as the source.
- Target Audience: {d['audience']}

## Reading flow
- Top: one bold title with a one-line subtitle.
- Middle: the section blocks in a clear top-to-bottom path, grouped by theme, with generous white space.
- Bottom: one short takeaway line.
- Viewers should notice the title and the biggest number first, then the supporting points.

## Visual style: {d['name']} ({d['mood']})
- Overall look: a clean, modern, well-organized infographic on a {surface} background, with rounded cards, thin lines, and one consistent flat icon style.
- Palette:
{chr(10).join(palette)}
{extra}- Keep strong contrast between text and background so every letter stays readable.

## Text rules (important)
- Keep text minimal: short labels and phrases, about 8 words per line at most, no long sentences.
- Large, clean, easy-to-read Korean letters. No overlapping and no tiny text.
- Emphasize at most 3 elements; keep everything else calm.
"""


def main() -> None:
    raw = PATH.read_bytes().decode("utf-8")
    data = json.loads(raw)
    changed = 0
    for d in data["designs"]:
        old = d["infographic"]
        new = build(d)
        old_raw = json.dumps(old, ensure_ascii=False)
        new_raw = json.dumps(new, ensure_ascii=False)
        # 파일 전체를 다시 저장하지 않고 해당 문자열만 바꿔서 변경 범위를 작게 유지한다
        if old_raw not in raw:
            raise SystemExit(f"원문에서 {d['id']}의 infographic 문자열을 찾지 못했어요")
        if old_raw != new_raw:
            raw = raw.replace(old_raw, new_raw, 1)
            changed += 1
    PATH.write_bytes(raw.encode("utf-8"))
    print(f"다시 만든 디자인: {changed}개")


if __name__ == "__main__":
    main()
