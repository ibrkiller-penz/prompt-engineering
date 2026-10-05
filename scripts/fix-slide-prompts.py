# 슬라이드 프롬프트(content/slides/slides.json)의 공통 오류를 고친다. (한 번 돌리면 되고, 다시 돌려도 안전하다)
# 사용: python scripts/fix-slide-prompts.py
#
# 대상: 이 프로젝트에서 만든 16개 디자인 (uniquelfie 선생님 원본인 부산교육청·부산교육대학은 건드리지 않는다)
# 고치는 것
#  1. 흰 배경 디자인인데 'NO WHITE SLIDES'라고 한 모순       → 'No other background colors.'
#  2. 정의되지 않은 변수 COLOR_ACCENT                         → COLOR_ACCENT_1
#  3. 밝은·파스텔·종이·칠판 디자인에도 'Neon Strokes / glow'   → 밝은 디자인은 얇은 강조선, 칠판은 분필 느낌 (어두운 네온 디자인은 그대로)
#  4. '내용이 짧으면 늘려서 20장을 채워라'(소스에 없는 내용을 지어낼 위험) → 늘리지 않기
#  5. 대본 1~20장과 따로 '표지 1장 + 2~19장 균등 분배 + 마무리'를 요구해 어긋남 → 대본 한 장 = 슬라이드 한 장, 제목·화면 텍스트 사용
import json
import re
from pathlib import Path

PATH = Path(__file__).resolve().parent.parent / "content" / "slides" / "slides.json"
SKIP = {"busan-office", "busan-univ"}
DARK_NEON = {"night-navy", "solar-star-v2", "cyber-titanium-v2", "ocean-deep"}
CHALK = {"chalkboard-v2"}

STYLE_OLD = "Style: High-End Intelligence, Minimalist Precision, 1pt Neon Strokes."
GLOW_OLD = "with subtle glow"


def fix(text: str, did: str) -> str:
    t = text
    t = t.replace("NO WHITE SLIDES.", "No other background colors.")
    t = t.replace(
        "Override any white-background default templates.",
        "Override any default template background with COLOR_BG.",
    )
    t = t.replace("COLOR_ACCENT gradient line", "COLOR_ACCENT_1 gradient line")
    if did in CHALK:
        t = t.replace(STYLE_OLD, "Style: Classroom chalkboard feel, Minimalist Precision, thin 1pt chalk-like strokes.")
        t = t.replace(GLOW_OLD, "in a clean chalk-like look")
    elif did not in DARK_NEON:
        t = t.replace(STYLE_OLD, "Style: Clean Minimalist Precision, thin 1pt accent strokes, soft flat shapes.")
        t = t.replace(GLOW_OLD, "with crisp contrast")
    t = t.replace(
        "Rule 02: If the content is short, expand each point with detailed explanations to fill 20 slides.",
        "Rule 02: Never add content that is not in the source; if a segment is short, keep it short.",
    )
    t = t.replace(
        "2. QUANTITY_CHECK: You must output exactly 20 slides. If you have less, expand the content details.",
        "2. QUANTITY_CHECK: Aim for exactly 20 slides, one per script slide. Never invent content to reach 20.",
    )
    t = t.replace(
        "5. NO_COMPRESSION: Do not combine topics. Give each sub-topic its own slide to meet the 20-count requirement.",
        "5. NO_COMPRESSION: Do not combine script slides; keep one slide per script slide.",
    )
    mapping = re.compile(
        r"( +)- Slide 1: Professional Cover\.\n +- Slides 2-19: Detailed content breakdown \(distribute source data evenly across these 18 slides\)\.\n +- Slide 20: Closing slide with a summary/thank you\."
    )
    t = mapping.sub(
        lambda m: (
            f"{m.group(1)}- One slide per script slide: slide N of the deck = slide N of the source script (슬라이드 번호 N).\n"
            f"{m.group(1)}- Use the script's 제목 as the slide title and its 화면 텍스트 lines as the on-slide text.\n"
            f"{m.group(1)}- Style slide 1 as the cover and the last slide as the closing slide."
        ),
        t,
    )
    return t


def main() -> None:
    raw = PATH.read_bytes().decode("utf-8")
    data = json.loads(raw)
    changed = 0
    for d in data["designs"]:
        if d["id"] in SKIP:
            continue
        for key in ("slides", "design"):
            old = d[key]
            new = fix(old, d["id"])
            if new == old:
                continue
            old_raw = json.dumps(old, ensure_ascii=False)
            if old_raw not in raw:
                raise SystemExit(f"{d['id']}.{key}를 원문에서 찾지 못했어요")
            raw = raw.replace(old_raw, json.dumps(new, ensure_ascii=False), 1)
            changed += 1
    PATH.write_bytes(raw.encode("utf-8"))
    print(f"고친 글: {changed}개 (디자인 {len(data['designs']) - len(SKIP)}종 x 슬라이드·디자인)")


if __name__ == "__main__":
    main()
