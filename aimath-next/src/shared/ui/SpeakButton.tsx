// 읽어 주기 단추. 브라우저가 지원하지 않거나, 읽기 설정에서 '읽어 주기'를 끄면 보이지 않아요(force 면 설정과 상관없이).
import { useSpeak } from "../speak/index.ts";
import { usePrefs } from "../prefs/index.ts";
import { Icon } from "../icons/index.ts";

export function SpeakButton({ text, force, label }: { text: string; force?: boolean; label?: string }) {
  const sp = useSpeak();
  const [prefs] = usePrefs();
  if (!sp.supported || (!force && !prefs.speak)) return null;
  return (
    <button type="button" className="btn btn-ghost ui-speak" aria-pressed={sp.speaking} onClick={() => sp.toggle(text)}>
      <Icon name="speak" />
      <span>{sp.speaking ? "멈추기" : label || "읽어 주기"}</span>
    </button>
  );
}
