# 슬라이드 디자인을 더한다. (content/slides/slides.json 의 designs)
# 사용: python scripts/add-designs.py   (이미 있는 id는 건너뛰므로 다시 돌려도 안전하다)
#
# 방법: 검증된 틀(밝은 디자인=classroom-bright, 어두운 디자인=night-navy)을 복제해 색 6개와 이름·분위기만 바꾼다.
#       디자인 글(design·slides)의 COLOR_* 줄, colors, bg/text/accents, 인포그래픽 프롬프트가 함께 바뀐다.
# 색 고르는 법(Coolors·Adobe Color·Color Hunt·Realtime Colors·Khroma 같은 사이트의 방식을 참고)
#   - 분위기별로 묶고(파스텔·빈티지·레트로·어두운 배경·자연·네온 …), 5~6색을 한 세트로 본다
#   - 모든 세트는 명도 대비를 계산해서 통과한 것만 쓴다:
#       본문 글자/배경 7:1 이상, 보조 글자/배경 4.5:1 이상, 강조·포인트/배경 3:1 이상 (WCAG)
import importlib.util
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PATH = ROOT / "content" / "slides" / "slides.json"

# (id, 이름, 분위기, 틀, 대상, 배경, 본문, 보조, 강조1, 강조2, 포인트)
PALETTES = [
    # ---- 밝은 배경 ----
    ("coral-teal", "산호 & 청록", "산뜻한 산호색과 청록, 활기찬 느낌", "light", "중학생", "#FFF8F5", "#1F2D36", "#4A5963", "#C93A52", "#0B7B7D", "#B4530A"),
    ("berry-pop", "베리 팝", "진한 딸기색과 보라, 눈에 띄는 느낌", "light", "고등학생", "#FFF4F8", "#3A1230", "#6B3B5C", "#B0125F", "#6D28D9", "#B93A0B"),
    ("forest-cream", "숲과 크림", "크림색 바탕에 깊은 초록, 차분한 자연", "light", "대학생", "#F6F1E3", "#1F3A2B", "#4B6654", "#2F7D4F", "#7C5A14", "#B3402A"),
    ("navy-gold", "네이비 골드", "단정한 남색과 금빛, 격식 있는 느낌", "light", "교사", "#FAF7F0", "#14213D", "#454F5E", "#1D3A6D", "#8A5F00", "#A9461A"),
    ("slate-mono", "슬레이트 모노", "회청색 한 계열, 군더더기 없는 느낌", "light", "일반 성인", "#F4F6F8", "#1F2933", "#4B5967", "#334E68", "#0F766E", "#B8400F"),
    ("retro-70s", "레트로 70s", "누런 종이에 겨자·청록, 옛날 포스터 느낌", "light", "고등학생", "#F5EAD3", "#3A2A1F", "#665040", "#A85508", "#1F6F6B", "#9E2F23"),
    ("sakura", "벚꽃", "연분홍 바탕에 장미색, 부드러운 느낌", "light", "중학생", "#FFF1F5", "#4A2432", "#74475A", "#BC2F5E", "#6F4FA0", "#A8420B"),
    ("nordic-linen", "북유럽 린넨", "린넨색 바탕에 잿빛 파랑, 조용한 느낌", "light", "일반 성인", "#F2F0EA", "#2B3138", "#555E68", "#3C5F7A", "#6E5E4C", "#A8491B"),
    ("candy-kids", "캔디 키즈", "밝은 분홍·파랑·노랑, 아이들 눈높이", "light", "초등학생", "#FFFDF3", "#2A2750", "#56537F", "#D01A58", "#1766B8", "#A85D00"),
    ("coffee-latte", "커피 라테", "우유색 바탕에 커피빛, 따뜻한 느낌", "light", "대학생", "#F8F0E6", "#3B2A24", "#675046", "#8A5430", "#456A5C", "#AE3326"),
    # ---- 어두운 배경 ----
    ("midnight-purple", "한밤 보라", "깊은 보라 바탕에 형광 하늘·분홍", "dark", "고등학생", "#150F2E", "#F3EEFF", "#BDB3E2", "#A78BFA", "#22D3EE", "#F472B6"),
    ("blueprint", "청사진", "파란 도면 같은 바탕에 하늘색 선", "dark", "대학생", "#0B2A4A", "#EAF4FF", "#A9C4E0", "#5CC8FF", "#FFD166", "#FF9EB1"),
    ("charcoal-lemon", "차콜 레몬", "짙은 회색 바탕에 레몬빛, 선명한 대비", "dark", "대학생", "#1B1B1D", "#F5F5F0", "#B5B5AA", "#FACC15", "#A3E635", "#FB7185"),
    ("emerald-night", "에메랄드 밤", "어두운 숲색 바탕에 에메랄드와 호박색", "dark", "일반 성인", "#06201A", "#E6F7F0", "#9BC7B6", "#34D399", "#FBBF24", "#FB7185"),
    ("wine-burgundy", "와인 버건디", "짙은 포도주색 바탕에 장밋빛, 고급스러운 느낌", "dark", "교사", "#2A0E18", "#FDECEF", "#D8A8B4", "#F29CB4", "#F5C26B", "#FF9E80"),
]


def lum(h: str) -> float:
    h = h.lstrip("#")
    def ch(i):
        v = int(h[i : i + 2], 16) / 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * ch(0) + 0.7152 * ch(2) + 0.0722 * ch(4)


def contrast(a: str, b: str) -> float:
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def check(p) -> list[str]:
    _id, _n, _m, tone, _a, bg, text, sub, a1, a2, pt = p
    bad = []
    rules = [("본문", text, 7.0), ("보조", sub, 4.5), ("강조1", a1, 3.0), ("강조2", a2, 3.0), ("포인트", pt, 3.0)]
    for name, c, need in rules:
        r = contrast(c, bg)
        if r < need:
            bad.append(f"{_id} {name} {c}/{bg} = {r:.2f}:1 (필요 {need}:1)")
    isdark = lum(bg) < 0.2
    if isdark != (tone == "dark"):
        bad.append(f"{_id} 배경 밝기와 틀({tone})이 맞지 않아요")
    return bad


def load_builder():
    """인포그래픽 프롬프트 만드는 함수를 재사용한다"""
    spec = importlib.util.spec_from_file_location("mkinfo", ROOT / "scripts" / "make-infographic-prompts.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.build


def clone(base: dict, p) -> dict:
    did, name, mood, tone, aud, bg, text, sub, a1, a2, pt = p
    d = json.loads(json.dumps(base))
    old = {c["name"]: c["hex"] for c in base["colors"]}
    new = {"BG": bg, "TEXT_MAIN": text, "TEXT_SUB": sub, "ACCENT_1": a1, "ACCENT_2": a2, "POINT": pt}
    for key in ("design", "slides"):
        t = d[key]
        for var, hexv in new.items():
            t, n = re.subn(rf"(- COLOR_{var}: )#[0-9A-Fa-f]{{6}}", rf"\g<1>{hexv}", t)
            if n != 1:
                raise SystemExit(f"{did}.{key}: COLOR_{var} 줄을 찾지 못했어요 ({n})")
        d[key] = t
    d["id"], d["name"], d["mood"], d["tone"], d["audience"] = did, name, mood, tone, aud
    d["bg"], d["text"], d["accents"] = bg, text, [a1, a2, pt]
    d["colors"] = [{"role": c["role"], "name": c["name"], "hex": new[c["name"]]} for c in base["colors"]]
    d["infographic"] = load_builder()(d)
    return d


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    bad = [m for p in PALETTES for m in check(p)]
    for p in PALETTES:
        print(f"{p[0]:16} 본문 {contrast(p[6], p[5]):5.1f}  보조 {contrast(p[7], p[5]):4.1f}  강조 {contrast(p[8], p[5]):4.1f}/{contrast(p[9], p[5]):4.1f}  포인트 {contrast(p[10], p[5]):4.1f}")
    if bad:
        print("\n대비 기준에 못 미쳐요:")
        print("\n".join(" - " + m for m in bad))
        raise SystemExit(1)

    raw = PATH.read_bytes().decode("utf-8")
    nl = "\r\n" if "\r\n" in raw else "\n"
    data = json.loads(raw)
    have = {d["id"] for d in data["designs"]}
    base = {"light": next(d for d in data["designs"] if d["id"] == "classroom-bright"),
            "dark": next(d for d in data["designs"] if d["id"] == "night-navy")}
    chunks = []
    for p in PALETTES:
        if p[0] in have:
            continue
        d = clone(base[p[3]], p)
        text = json.dumps(d, ensure_ascii=False, indent=1)
        text = "\n".join("  " + ln for ln in text.split("\n")).replace("\n", nl)
        chunks.append(text)
    if not chunks:
        print("새로 더할 디자인이 없어요 (이미 모두 있음)")
        return
    marker = f"{nl}  }}{nl} ],{nl} \"audiences\""
    if marker not in raw:
        raise SystemExit("designs 끝 위치를 찾지 못했어요")
    insert = f"{nl}  }}," + nl + ("," + nl).join(chunks) + f"{nl} ],{nl} \"audiences\""
    raw = raw.replace(marker, insert, 1)
    PATH.write_bytes(raw.encode("utf-8"))
    json.loads(PATH.read_bytes().decode("utf-8"))  # 깨졌는지 확인
    print(f"\n더한 디자인: {len(chunks)}종")


if __name__ == "__main__":
    main()
