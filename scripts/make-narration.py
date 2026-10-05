# 영상 멘트를 mp3로 만든다 (무료 신경망 음성 edge-tts, API 키 필요 없음).
# 사용: pip install edge-tts mutagen  →  python scripts/make-narration.py
# 결과: public/handgen/audio/a1.mp3 … b5.mp3 와 durations.json (사이트가 장면 길이를 맞출 때 참고)
# 문장을 고치려면 아래 LINES만 고치고 다시 실행한다. (사이트 안의 say 문장도 같이 고칠 것)
import asyncio, json
from pathlib import Path
import edge_tts
from mutagen.mp3 import MP3

VOICE = "ko-KR-SunHiNeural"   # 여성. 남성은 ko-KR-InJoonNeural
RATE = "-6%"                  # 조금 천천히
OUT = Path(__file__).resolve().parent.parent / "public" / "handgen" / "audio"
OUT.mkdir(parents=True, exist_ok=True)

LINES = {
 # 영상 A: 조립 과정 (문장 하나 = 동작 하나)
 "a01": "먼저, 투명관에 고정링을 끼워요. 링은 두 개가 필요해요.",
 "a02": "두 링 사이는 십이에서 십삼 밀리미터쯤 띄워 주세요.",
 "a03": "이제 자석을 관 속으로 쏙 밀어 넣어요.",
 "a04": "마지막으로, 양쪽 끝에 마개를 꼭 닫아요.",
 "a05": "다음은 에나멜선을 감을 차례예요. 두 링 사이를 빈틈없이 촘촘하게 감아요.",
 "a06": "선의 양쪽 끝은 백 밀리미터쯤 남겨 두세요.",
 "a07": "남긴 선 끝의 코팅은 사포로 문질러 벗겨요. 구릿빛이 보이면 됐어요.",
 "a08": "이제 링을 양쪽으로 살짝 벌려 주세요.",
 "a09": "엘이디 다리를 벌려서, 안쪽에서 바깥쪽으로 끼워요.",
 "a10": "링을 다시 가운데로 모아요.",
 "a11": "에나멜선 두 끝을 엘이디 다리에 단단히 감아서 고정해요.",
 "a12": "완성! 어두운 곳에서 힘차게 흔들어 보세요.",
 # 영상 B: 왜 빛이 날까
 "b01": "자석이 가만히 있으면, 코일에는 아무 일도 일어나지 않아요.",
 "b02": "자석 둘레에는 눈에 보이지 않는 자기장이 있어요. 점선이 자기장이에요.",
 "b03": "자석이 코일 쪽으로 움직이면, 코일을 지나는 자기장이 변해요.",
 "b04": "자기장이 변하는 동안, 코일에 전류가 흘러요. 이것이 전자기 유도예요.",
 "b05": "자석이 멈추면 전류도 멈춰요. 변화가 있어야 전류가 생겨요.",
 "b06": "이번엔 자석을 왔다 갔다 움직여 볼게요.",
 "b07": "그러면 전류의 방향이 번갈아 바뀌어요. 엘이디는 한 방향일 때만 켜지니까, 깜빡이는 거예요.",
 "b08": "더 빨리 흔들면 자기장이 더 빨리 변해서, 전류가 커지고 더 밝아져요.",
 "b09": "정리해 볼까요? 손의 운동 에너지가 전기 에너지가 되고, 다시 빛 에너지로 바뀐 거예요.",
 "b10": "여러분도 직접 흔들어서, 빛을 만들어 보세요!",
}

async def main():
    dur = {}
    for k, text in LINES.items():
        f = OUT / f"{k}.mp3"
        await edge_tts.Communicate(text, VOICE, rate=RATE).save(str(f))
        dur[k] = round(MP3(str(f)).info.length, 1)
        print(k, dur[k], "초")
    (OUT / "durations.json").write_text(json.dumps(dur, ensure_ascii=False, indent=1), encoding="utf-8")

asyncio.run(main())
