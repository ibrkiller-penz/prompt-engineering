"""단축키 아이콘 모음 만들기 — 사람들이 많이 쓰는 프로그램·기능 아이콘을 지금 보드와 같은 '다크 사각'(72x72)으로 그린다.
   python make_icon_library.py                 # ../icons/모음/<키>.png·.bin + 목록.json
   python make_icon_library.py --css <tabler-icons-outline.css>   # Tabler 이름표(tabler_map.json)를 처음 만들 때만
회사 로고를 그대로 베끼지 않으려고, 프로그램은 '그 회사 색의 짧은 글자 타일'(Ps·W·X…), 기능은 Tabler 기호(MIT)로 그린다.
.bin 형식: 72x72, 픽셀당 [RGB565 아래][위][알파] = 15552바이트(설계_단축키꾸미기.md 4장, 보드가 그대로 쓴다).
"""
import json, os, re, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "icons", "모음")
TABLER = os.path.join(HERE, "tabler-icons-outline.ttf")
MAPF = os.path.join(HERE, "tabler_map.json")
FONT_TXT = os.path.join(HERE, "..", "..", "..", "board-kit", "7inch", "firmware", "fonts", "src", "Pretendard-SemiBold.otf")
if not os.path.exists(FONT_TXT):
    FONT_TXT = os.path.join(HERE, "..", "..", "..", "7inch", "firmware", "fonts", "src", "Pretendard-SemiBold.otf")

if "--css" in sys.argv:
    css = open(sys.argv[sys.argv.index("--css") + 1], encoding="utf-8").read()
    pat = re.compile(r"\.ti-([a-z0-9-]+):before\s*\{\s*content:\s*\"\\([0-9a-f]+)\"")
    json.dump({a: int(b, 16) for a, b in pat.findall(css)}, open(MAPF, "w"))
    print("map saved"); sys.exit()
TMAP = json.load(open(MAPF))

SIZE, K = 72, 4
N = SIZE * K
G = int(N * 0.80)
FILL = (30, 34, 44)
GLOW, BWX = True, 1.0          # 테마마다 바뀐다(아래 THEMES)

def hx(s):
    s = s.lstrip("#"); return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))

def lum(c):
    return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255

def darken(c, target=0.33):                       # 밝은 바탕에서 읽히도록 어둡게(밝기 target 아래로)
    while lum(c) > target:
        c = tuple(int(v * 0.88) for v in c)
    return c

def mix(a, b, t):
    return tuple(int(x + (y - x) * t) for x, y in zip(a, b))

def tile(ring, glyph):
    rad = int(N * 0.24); bw = int(max(K * 2, int(N * 0.045)) * BWX)
    t = Image.new("RGBA", (N, N), (0, 0, 0, 0)); d = ImageDraw.Draw(t)
    d.rounded_rectangle((0, 0, N - 1, N - 1), radius=rad, fill=ring + (255,))
    d.rounded_rectangle((bw, bw, N - 1 - bw, N - 1 - bw), radius=rad - bw, fill=FILL + (255,))
    if GLOW:                                       # 테두리 안쪽에 은은한 빛
        glow = Image.new("RGBA", (N, N), (0, 0, 0, 0))
        ImageDraw.Draw(glow).rounded_rectangle((bw, bw, N - 1 - bw, N - 1 - bw), radius=rad - bw, outline=ring + (90,), width=bw * 2)
        glow = glow.filter(ImageFilter.GaussianBlur(bw * 1.2))
        m = Image.new("L", (N, N), 0); ImageDraw.Draw(m).rounded_rectangle((bw, bw, N - 1 - bw, N - 1 - bw), radius=rad - bw, fill=255)
        glow.putalpha(Image.composite(glow.getchannel("A"), Image.new("L", (N, N), 0), m))
        t.alpha_composite(glow)
    t.alpha_composite(glyph, ((N - G) // 2, (N - G) // 2))
    return t.resize((SIZE, SIZE), Image.LANCZOS)

def glowing(shape, color):
    out = Image.new("RGBA", shape.size, (0, 0, 0, 0))
    if GLOW:
        halo = Image.new("RGBA", shape.size, color + (0,)); halo.putalpha(shape.filter(ImageFilter.GaussianBlur(G * 0.05)).point(lambda v: int(v * 0.6)))
        out.alpha_composite(halo)
    s = Image.new("RGBA", shape.size, color + (0,)); s.putalpha(shape); out.alpha_composite(s)
    return out

def shape_text(txt, font_path, ratio):
    m = Image.new("L", (G, G), 0); d = ImageDraw.Draw(m)
    size = int(G * ratio)
    while True:                                    # 넓으면 줄인다
        f = ImageFont.truetype(font_path, size)
        l, t, r, b = d.textbbox((0, 0), txt, font=f)
        if r - l <= G * 0.86 or size < 20: break
        size = int(size * 0.92)
    d.text(((G - (r - l)) / 2 - l, (G - (b - t)) / 2 - t), txt, font=f, fill=255)
    return m

def glyph_of(spec):
    kind, val = spec.split(":", 1)
    if kind == "ti":
        return shape_text(chr(TMAP[val]), TABLER, 0.66)
    n = len(val)
    return shape_text(val, FONT_TXT, 0.62 if n <= 1 else 0.50 if n == 2 else 0.36 if n <= 4 else 0.28)

# (키, 이름(보드에 나올 글), 묶음, 그림, 테두리색, 그림색, 추천 동작 종류, 추천 대상)
L = []
def A(*a): L.append(a)
# ── 마이크로소프트·윈도 ──
A("word", "워드", "마이크로소프트", "txt:W", "#2b6cd4", "#6fa8ff", "app", "winword")
A("excel", "엑셀", "마이크로소프트", "txt:X", "#1d8f50", "#4fd18a", "app", "excel")
A("powerpoint", "PPT", "마이크로소프트", "txt:P", "#d24726", "#ff8a65", "app", "powerpnt")
A("outlook", "아웃룩", "마이크로소프트", "txt:O", "#1a73c8", "#64b0ff", "app", "outlook")
A("onenote", "원노트", "마이크로소프트", "txt:N", "#7b3fbf", "#c18bff", "app", "onenote")
A("teams", "팀즈", "마이크로소프트", "txt:T", "#5b5fc7", "#a4a7ff", "app", "ms-teams:")
A("onedrive", "원드라이브", "마이크로소프트", "ti:cloud", "#1a73c8", "#64b0ff", "app", "onedrive")
A("edge", "엣지", "마이크로소프트", "ti:brand-edge", "#0f8f8f", "#4fd8c9", "app", "msedge")
A("copilot", "코파일럿", "마이크로소프트", "ti:sparkles", "#4f8cf0", "#9cc3ff", "url", "https://copilot.microsoft.com")
A("explorer2", "탐색기", "윈도", "ti:folder", "#e0a52a", "#ffd166", "app", "explorer.exe")
A("calc", "계산기", "윈도", "ti:calculator", "#8a94a6", "#cfd6e2", "app", "calc")
A("notepad", "메모장", "윈도", "ti:notes", "#8a94a6", "#cfd6e2", "app", "notepad")
A("paint", "그림판", "윈도", "ti:brush", "#e07a3a", "#ffb07a", "app", "mspaint")
A("snip", "캡처 도구", "윈도", "ti:scissors", "#c94bd1", "#f3a1f8", "keys", "#{S}")
A("settings", "설정", "윈도", "ti:settings", "#8a94a6", "#cfd6e2", "app", "ms-settings:")
A("taskmgr", "작업 관리자", "윈도", "ti:activity", "#3fb68b", "#7ef0c2", "keys", "^+{ESC}")
A("cmd2", "CMD", "윈도", "txt:C:\\", "#9aa3b2", "#e6e9ef", "app", "cmd.exe")
A("pwsh", "파워셸", "윈도", "ti:terminal-2", "#2f6fd6", "#7fb0ff", "app", "powershell.exe")
A("terminal", "터미널", "윈도", "ti:terminal", "#6b7280", "#d1d5db", "app", "wt.exe")
A("trash", "휴지통", "윈도", "ti:trash", "#8a94a6", "#cfd6e2", "app", "shell:RecycleBinFolder")
A("controlpanel", "제어판", "윈도", "ti:adjustments", "#8a94a6", "#cfd6e2", "app", "control")
A("downloads", "다운로드", "윈도", "ti:download", "#3b82f6", "#93c5fd", "app", "shell:Downloads")
A("documents", "문서", "윈도", "ti:file-text", "#3b82f6", "#93c5fd", "app", "shell:Personal")
A("pictures", "사진", "윈도", "ti:photo", "#10b981", "#6ee7b7", "app", "shell:My Pictures")
A("printer", "프린터", "윈도", "ti:printer", "#8a94a6", "#cfd6e2", "app", "control printers")
# ── 어도비 ──
A("photoshop", "포토샵", "어도비", "txt:Ps", "#31a8ff", "#7cc8ff", "app", "photoshop")
A("illustrator", "일러", "어도비", "txt:Ai", "#ff9a00", "#ffc366", "app", "illustrator")
A("premiere", "프리미어", "어도비", "txt:Pr", "#9999ff", "#c9c9ff", "app", "premiere")
A("aftereffects", "애프터", "어도비", "txt:Ae", "#9999ff", "#d3b3ff", "app", "afterfx")
A("acrobat", "PDF", "어도비", "txt:PDF", "#e0242b", "#ff6b6b", "app", "acrobat")
A("indesign", "인디자인", "어도비", "txt:Id", "#ff3366", "#ff8aa8", "app", "indesign")
A("lightroom", "라이트룸", "어도비", "txt:Lr", "#31a8ff", "#9dd6ff", "app", "lightroom")
A("adobeexpress", "익스프레스", "어도비", "txt:Ex", "#ff4f4f", "#ff9a9a", "url", "https://new.express.adobe.com")
# ── 구글 ──
A("chrome", "크롬", "구글", "ti:brand-chrome", "#3b82f6", "#ffd166", "app", "chrome")
A("gmail", "지메일", "구글", "ti:mail", "#ea4335", "#ff8a80", "url", "https://mail.google.com")
A("gdrive", "드라이브", "구글", "ti:brand-google-drive", "#1fa463", "#ffd04b", "url", "https://drive.google.com")
A("gdocs", "구글 문서", "구글", "ti:file-text", "#4285f4", "#9cc0ff", "url", "https://docs.google.com")
A("gsheets", "구글 시트", "구글", "ti:table", "#0f9d58", "#6be3a3", "url", "https://sheets.google.com")
A("gslides", "구글 슬라이드", "구글", "ti:presentation", "#f4b400", "#ffd966", "url", "https://slides.google.com")
A("gclassroom", "클래스룸", "구글", "ti:school", "#0f9d58", "#ffd04b", "url", "https://classroom.google.com")
A("gmeet", "구글 미트", "구글", "ti:video", "#00897b", "#64d8cb", "url", "https://meet.google.com")
A("gcalendar", "캘린더", "구글", "ti:calendar", "#4285f4", "#9cc0ff", "url", "https://calendar.google.com")
A("gmaps", "지도", "구글", "ti:map-pin", "#ea4335", "#ff8a80", "url", "https://maps.google.com")
A("youtube2", "유튜브", "구글", "ti:brand-youtube", "#ff0000", "#ff6b6b", "url", "https://www.youtube.com")
A("ytmusic", "유튜브 뮤직", "구글", "ti:music", "#ff0000", "#ff8a8a", "url", "https://music.youtube.com")
A("gemini2", "제미나이", "구글", "ti:sparkles", "#7c6cf6", "#a9b8ff", "url", "https://gemini.google.com")
A("gtranslate", "번역", "구글", "ti:language", "#4285f4", "#9cc0ff", "url", "https://translate.google.com")
# ── 인공지능 ──
A("chatgpt", "GPT", "인공지능", "txt:GPT", "#10a37f", "#3cd2a0", "url", "https://chatgpt.com")
A("claude2", "Claude", "인공지능", "ti:asterisk", "#d97757", "#f4a385", "app", "claude:")
A("perplexity", "퍼플렉시티", "인공지능", "ti:search", "#20808d", "#6fd3df", "url", "https://www.perplexity.ai")
A("wrtn", "뤼튼", "인공지능", "txt:뤼튼", "#7b5cff", "#b7a4ff", "url", "https://wrtn.ai")
A("notebooklm", "노트북LM", "인공지능", "ti:notebook", "#5f6368", "#c7cbd1", "url", "https://notebooklm.google.com")
# ── 한컴·국내 ──
A("hwp2", "한글", "한컴·국내", "txt:한", "#1aa3e8", "#7fd3ff", "app", "hwp")
A("hcell", "한셀", "한컴·국내", "txt:셀", "#1d8f50", "#4fd18a", "app", "hcell")
A("hshow", "한쇼", "한컴·국내", "txt:쇼", "#e5672e", "#ffa274", "app", "hshow")
A("naver2", "네이버", "한컴·국내", "txt:N", "#03c75a", "#5ff59e", "url", "https://www.naver.com")
A("whale", "웨일", "한컴·국내", "ti:world", "#3e6cff", "#93acff", "app", "whale")
A("kakao2", "카카오톡", "한컴·국내", "txt:TALK", "#f7d000", "#ffe866", "app", "kakaotalk:")
A("coolmsg2", "쿨메신저", "한컴·국내", "ti:message-circle", "#2f9bf0", "#86c8ff", "app", "CoolMessenger")
A("bandizip", "반디집", "한컴·국내", "ti:file-zip", "#f2a33a", "#ffd08a", "app", "bandizip")
A("alzip", "알집", "한컴·국내", "ti:file-zip", "#2f80ed", "#8bbaff", "app", "alzip")
A("gom", "곰플레이어", "한컴·국내", "ti:player-play", "#e04f5f", "#ff9aa5", "app", "gom")
A("potplayer", "팟플레이어", "한컴·국내", "ti:player-play", "#f2c94c", "#ffe08a", "app", "potplayer")
A("bandicam", "반디캠", "한컴·국내", "ti:video", "#e53935", "#ff8a80", "app", "bdcam")
A("obs", "OBS", "한컴·국내", "ti:broadcast", "#5b5b5b", "#d4d4d4", "app", "obs64")
# ── 학교·교육 ──
A("neis2", "나이스", "학교·교육", "txt:NEIS", "#2584eb", "#5aaaff", "url", "https://www.neis.go.kr")
A("eduportal", "업무포털", "학교·교육", "ti:building", "#2563eb", "#93c5fd", "url", "https://www.eduptl.kr")
A("edufine", "에듀파인", "학교·교육", "txt:K", "#0f766e", "#5eead4", "url", "https://klef.go.kr")
A("ehaksup", "e학습터", "학교·교육", "txt:e", "#16a34a", "#86efac", "url", "https://cls.edunet.net")
A("ebs", "EBS", "학교·교육", "txt:EBS", "#0ea5e9", "#7dd3fc", "url", "https://www.ebs.co.kr")
A("classting", "클래스팅", "학교·교육", "ti:message-chatbot", "#16b8a6", "#7ff0e2", "url", "https://www.classting.com")
A("hiclass", "하이클래스", "학교·교육", "txt:Hi", "#f59e0b", "#fcd34d", "url", "https://www.hiclass.net")
A("padlet", "패들렛", "학교·교육", "ti:layout-board", "#e5508f", "#ff9ec5", "url", "https://padlet.com")
A("thinkerbell", "띵커벨", "학교·교육", "ti:bell", "#f59e0b", "#fcd34d", "url", "https://www.tkbell.co.kr")
A("canva", "캔바", "학교·교육", "txt:C", "#00c4cc", "#7ff3f6", "url", "https://www.canva.com")
A("miricanvas", "미리캔버스", "학교·교육", "ti:palette", "#4f46e5", "#a5b4fc", "url", "https://www.miricanvas.com")
A("dtextbook", "디지털교과서", "학교·교육", "ti:book", "#2563eb", "#93c5fd", "url", "https://webdt.edunet.net")
A("zoom", "줌", "학교·교육", "ti:video", "#2d8cff", "#8cc0ff", "app", "zoommtg:")
A("notion", "노션", "학교·교육", "txt:N", "#d4d4d4", "#ffffff", "url", "https://www.notion.so")
A("school", "학교 누리집", "학교·교육", "ti:school", "#d97706", "#fcd34d", "url", "https://")
A("timer", "타이머", "학교·교육", "ti:alarm", "#ef4444", "#fca5a5", "url", "https://www.google.com/search?q=timer")
A("attendance", "출석", "학교·교육", "ti:checklist", "#10b981", "#6ee7b7", "url", "https://")
# ── 수업·발표 단축키 ──
A("pptstart", "발표 시작", "수업·발표", "ti:presentation", "#d24726", "#ff8a65", "keys", "{F5}")
A("pptnext", "다음 장", "수업·발표", "ti:chevron-right", "#d24726", "#ff8a65", "keys", "{RIGHT}")
A("pptprev", "이전 장", "수업·발표", "ti:chevron-left", "#d24726", "#ff8a65", "keys", "{LEFT}")
A("blackscreen", "화면 검게", "수업·발표", "ti:device-desktop-off", "#4b5563", "#d1d5db", "keys", "b")
A("fullscreen", "전체 화면", "수업·발표", "ti:maximize", "#3b82f6", "#93c5fd", "keys", "{F11}")
A("zoomin", "크게 보기", "수업·발표", "ti:zoom-in", "#3b82f6", "#93c5fd", "keys", "^{ADD}")
A("zoomout", "작게 보기", "수업·발표", "ti:zoom-out", "#3b82f6", "#93c5fd", "keys", "^{SUBTRACT}")
A("micoff", "마이크 끄기", "수업·발표", "ti:microphone-off", "#e5484d", "#ff8a8a", "keys", "%a")
A("camoff", "카메라 끄기", "수업·발표", "ti:video-off", "#e5484d", "#ff8a8a", "keys", "%v")
A("sharescreen", "화면 공유", "수업·발표", "ti:screen-share", "#10b981", "#6ee7b7", "keys", "%s")
# ── 컴퓨터 조작 ──
A("volup", "소리 크게", "컴퓨터 조작", "ti:volume", "#3b82f6", "#93c5fd", "builtin", "volup")
A("voldown", "소리 작게", "컴퓨터 조작", "ti:volume-2", "#3b82f6", "#93c5fd", "builtin", "voldown")
A("mute", "소리 끄기", "컴퓨터 조작", "ti:volume-off", "#6b7280", "#d1d5db", "builtin", "mute")
A("playpause", "재생/멈춤", "컴퓨터 조작", "ti:player-pause", "#10b981", "#6ee7b7", "builtin", "playpause")
A("nexttrack", "다음 곡", "컴퓨터 조작", "ti:player-skip-forward", "#10b981", "#6ee7b7", "builtin", "next")
A("screenshot", "화면 캡처", "컴퓨터 조작", "ti:camera", "#94a3b8", "#e2e8f0", "keys", "#+s")
A("lock", "화면 잠금", "컴퓨터 조작", "ti:lock", "#f59e0b", "#fcd34d", "builtin", "lock")
A("desktop2", "바탕화면", "컴퓨터 조작", "ti:device-desktop", "#a78bfa", "#ddd6fe", "builtin", "desktop")
A("closewin", "창 닫기", "컴퓨터 조작", "ti:x", "#e5484d", "#ff8a8a", "builtin", "altf4")
A("minimize", "창 내리기", "컴퓨터 조작", "ti:arrow-bar-to-down", "#6b7280", "#d1d5db", "keys", "#{DOWN}")
A("switchwin", "창 바꾸기", "컴퓨터 조작", "ti:switch-horizontal", "#6b7280", "#d1d5db", "keys", "%{TAB}")
A("copy", "복사", "컴퓨터 조작", "ti:copy", "#64748b", "#e2e8f0", "keys", "^c")
A("paste", "붙여넣기", "컴퓨터 조작", "ti:clipboard", "#64748b", "#e2e8f0", "keys", "^v")
A("undo", "되돌리기", "컴퓨터 조작", "ti:arrow-back-up", "#64748b", "#e2e8f0", "keys", "^z")
A("refresh", "새로 고침", "컴퓨터 조작", "ti:refresh", "#64748b", "#e2e8f0", "keys", "{F5}")
A("save", "저장", "컴퓨터 조작", "ti:device-floppy", "#3b82f6", "#93c5fd", "keys", "^s")
A("print", "인쇄", "컴퓨터 조작", "ti:printer", "#64748b", "#e2e8f0", "keys", "^p")
A("emoji", "이모지", "컴퓨터 조작", "ti:mood-smile", "#f59e0b", "#fcd34d", "keys", "#.")
exec(open(os.path.join(HERE, "icons_more.py"), encoding="utf-8").read())   # 윈도 도구모음·스트림덱 기본(따로 적어 둠)
# ── 자주 쓰는 모양(직접 고를 때) ──
for k, nm, g, c1, c2 in [("star", "별", "ti:star", "#f59e0b", "#fcd34d"), ("heart", "하트", "ti:heart", "#ef4444", "#fca5a5"),
                        ("bulb", "아이디어", "ti:bulb", "#eab308", "#fde047"), ("home", "홈", "ti:home", "#3b82f6", "#93c5fd"),
                        ("mail2", "메일", "ti:mail", "#3b82f6", "#93c5fd"), ("web", "웹", "ti:world", "#0ea5e9", "#7dd3fc"),
                        ("music2", "음악", "ti:music", "#ec4899", "#f9a8d4"), ("movie", "동영상", "ti:movie", "#8b5cf6", "#c4b5fd"),
                        ("clock2", "시계", "ti:clock", "#64748b", "#e2e8f0"), ("question", "도움말", "ti:help", "#14b8a6", "#5eead4"),
                        ("chat", "대화", "ti:messages", "#22c55e", "#86efac"), ("users", "사람들", "ti:users", "#6366f1", "#a5b4fc"),
                        ("flag", "깃발", "ti:flag", "#ef4444", "#fca5a5"), ("rocket", "로켓", "ti:rocket", "#f97316", "#fdba74")]:
    A(k, nm, "모양", g, c1, c2, "", "")

def tobin(im):
    out = bytearray()
    for y in range(SIZE):
        for x in range(SIZE):
            r, g, b, a = im.getpixel((x, y))
            v = ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3)
            out += bytes((v & 0xFF, v >> 8, a))
    return bytes(out)

# 보드의 색 테마 5가지(main.cpp THEMES 의 어두운 칸 색)에 맞춘 판. 맨 위(모음/)는 지금의 기본 다크.
# (폴더, 칸 바탕, 바탕 화면색, 빛, 테두리 굵기, 색 바꾸기)
THEMES = [("", (30, 34, 44), (24, 26, 32), True, 1.0, None),
          ("테마/1_따뜻함", hx("2b231e"), hx("1c1714"), False, 0.8, "warm"),
          ("테마/2_남색밤", hx("16213a"), hx("0e1626"), True, 1.0, None),
          ("테마/3_밝은종이", hx("fffcf5"), hx("f3ede1"), False, 1.0, "paper"),
          ("테마/4_고대비", (0, 0, 0), (0, 0, 0), False, 1.6, "contrast"),
          ("테마/5_숲초록", hx("15241f"), hx("0f1a17"), False, 0.6, "forest")]
idx, miss = [], []
for key, label, group, spec, ring, gcol, kind, target in L:
    if spec.startswith("ti:") and spec[3:] not in TMAP:
        miss.append(spec); continue
    idx.append({"key": key, "name": label, "group": group, "kind": kind, "target": target, "_s": (spec, ring, gcol)})
fs = ImageFont.truetype(FONT_TXT, 12)
for folder, FILL, bg, GLOW, BWX, mode in THEMES:
    out = os.path.join(OUT, folder); os.makedirs(out, exist_ok=True)
    for e in idx:
        spec, ring, gcol = e["_s"]; r, g = hx(ring), hx(gcol)
        F0 = FILL
        if mode == "paper":                         # 밝은 바탕: 테두리는 그 색, 그림은 같은 색을 진하게(탁해지지 않게 테두리색에서)
            r, g = darken(r, 0.60), darken(r, 0.40)
        elif mode == "warm":                        # 따뜻함: 그 색을 살짝 머금은 칸 + 따뜻한 빛 도는 그림
            r = mix(r, (251, 146, 60), 0.18); FILL = mix(F0, r, 0.22); g = mix(g, (255, 240, 220), 0.30)
        elif mode == "forest":                      # 숲초록: 얇은 테두리, 옅은 색 칸, 파스텔 그림
            FILL = mix(F0, r, 0.14); r = mix(r, (74, 222, 128), 0.20); g = mix(g, (240, 247, 243), 0.40)
        elif mode == "contrast":                    # 검은 바탕: 밝은 색 하나로 굵게
            r = g
        im = tile(r, glowing(glyph_of(spec), g)); FILL = F0
        im.save(os.path.join(out, e["key"] + ".png"))
        if folder == "":                            # 보드용 .bin 은 기본판만(테마판은 도우미가 PNG 에서 바로 만든다)
            open(os.path.join(out, e["key"] + ".bin"), "wb").write(tobin(im))
    cols = 12; rows = (len(idx) + cols - 1) // cols   # 테마별 미리보기 한 장
    sheet = Image.new("RGBA", (cols * 96, rows * 100), bg + (255,)); d = ImageDraw.Draw(sheet)
    tc = (40, 34, 28) if mode == "paper" else (220, 220, 220)
    for i, e in enumerate(idx):
        x, y = (i % cols) * 96, (i // cols) * 100
        sheet.alpha_composite(Image.open(os.path.join(out, e["key"] + ".png")), (x + 12, y + 6))
        w = d.textlength(e["name"], font=fs); d.text((x + 48 - w / 2, y + 82), e["name"], font=fs, fill=tc)
    sheet.save(os.path.join(HERE, "미리보기_%s.png" % (folder.split("/")[-1] or "기본")))
for e in idx: del e["_s"]
json.dump(idx, open(os.path.join(OUT, "목록.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
# 테마 비교 한 장(같은 아이콘 14개를 테마별 한 줄씩)
pick = ["word", "excel", "hwp2", "photoshop", "chrome", "youtube2", "chatgpt", "neis2", "explorer2", "calc", "volup", "lock", "shutdown", "sd_timer"]
cmp_ = Image.new("RGBA", (130 + len(pick) * 84, len(THEMES) * 90), (50, 50, 50, 255)); d = ImageDraw.Draw(cmp_)
fb = ImageFont.truetype(FONT_TXT, 15)
for row, (folder, FILL, bg, GLOW, BWX, mode) in enumerate(THEMES):
    y = row * 90
    d.rectangle((0, y, cmp_.width, y + 89), fill=bg + (255,))
    d.text((12, y + 34), folder.split("/")[-1] or "기본", font=fb, fill=(40, 34, 28) if mode == "paper" else (230, 230, 230))
    for i, k in enumerate(pick):
        if os.path.exists(os.path.join(OUT, folder, k + ".png")):
            cmp_.alpha_composite(Image.open(os.path.join(OUT, folder, k + ".png")), (130 + i * 84, y + 9))
cmp_.save(os.path.join(HERE, "미리보기_테마비교.png"))
print("made", len(idx), "x", len(THEMES), "missing", miss)
