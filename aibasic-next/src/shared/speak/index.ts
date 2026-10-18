// 읽어 주기(speechSynthesis, 한국어 ko-KR). 브라우저가 지원하지 않으면 getSpeaker() 가 null 이고, 화면은 단추를 숨겨요.
// 서버로 아무것도 보내지 않아요(브라우저 안의 음성 엔진만 써요).
import { useEffect, useState } from "react";
import { speechText } from "./text.ts";

export { speechText, texToWords } from "./text.ts";

export interface Speaker {
  /** 콘텐츠 글자를 읽어요(앞에 읽던 것은 멈춰요). 끝나면 onEnd */
  speak(text: string, onEnd?: () => void): void;
  stop(): void;
  speaking(): boolean;
}

type SynthWin = Window & { speechSynthesis?: SpeechSynthesis; SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance };

function synth(): { s: SpeechSynthesis; U: typeof SpeechSynthesisUtterance } | null {
  try {
    if (typeof window === "undefined") return null;
    const w = window as SynthWin;
    if (!w.speechSynthesis || !w.SpeechSynthesisUtterance) return null;
    return { s: w.speechSynthesis, U: w.SpeechSynthesisUtterance };
  } catch {
    return null;
  }
}

/** 이 브라우저에서 읽어 주기를 쓸 수 있는지 */
export function speechSupported(): boolean {
  return !!synth();
}

function koVoice(s: SpeechSynthesis): SpeechSynthesisVoice | null {
  try {
    const vs = s.getVoices() || [];
    for (const v of vs) if (/^ko(-|_|$)/i.test(v.lang)) return v;
  } catch {
    /* 무시 */
  }
  return null;
}

let speaker: Speaker | null | undefined;

/** 읽어 주기 도구. 지원하지 않으면 null */
export function getSpeaker(): Speaker | null {
  if (speaker !== undefined) return speaker;
  const sy = synth();
  if (!sy) {
    speaker = null;
    return null;
  }
  let busy = false;
  speaker = {
    speak(text, onEnd) {
      try {
        sy.s.cancel();
        const u = new sy.U(speechText(text));
        u.lang = "ko-KR";
        u.rate = 1;
        const v = koVoice(sy.s);
        if (v) u.voice = v;
        busy = true;
        u.onend = () => {
          busy = false;
          if (onEnd) onEnd();
        };
        u.onerror = () => {
          busy = false;
          if (onEnd) onEnd();
        };
        sy.s.speak(u);
      } catch {
        busy = false;
        if (onEnd) onEnd();
      }
    },
    stop() {
      try {
        sy.s.cancel();
      } catch {
        /* 무시 */
      }
      busy = false;
    },
    speaking() {
      return busy;
    },
  };
  return speaker;
}

/** 화면에서 쓰는 훅: [지원 여부, 지금 읽는 중, 읽기/멈추기 토글] */
export function useSpeak(): { supported: boolean; speaking: boolean; toggle: (text: string) => void; stop: () => void } {
  const sp = getSpeaker();
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    return () => {
      if (sp && speaking) sp.stop();
    };
  }, [sp, speaking]);
  return {
    supported: !!sp,
    speaking,
    toggle(text: string) {
      if (!sp) return;
      if (speaking) {
        sp.stop();
        setSpeaking(false);
        return;
      }
      setSpeaking(true);
      sp.speak(text, () => setSpeaking(false));
    },
    stop() {
      if (sp) sp.stop();
      setSpeaking(false);
    },
  };
}
