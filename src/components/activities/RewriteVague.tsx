import { useState } from "react";
import { checkPrompt } from "../../lib/check";
import { useStored } from "../../lib/storage";
import { Button, Reveal, TextArea } from "../ui";
import { FeedbackBox, HelperNote } from "./Feedback";

interface Props {
  storeKey: string;
  items: string[];
  example?: string;
  /** "scope"이면 범위 지키기(경계·추가 제안 분리)를 중심으로 점검 */
  focus?: "scope";
}

function feedbackFor(text: string, focus?: "scope") {
  const f = checkPrompt(text);
  const el = (id: string) => f.elements.find((e) => e.id === id)!.found;
  const bonus = (id: string) => f.bonus.find((b) => b.id === id)!.found;

  if (f.privacy.length) return { good: "", next: f.next, privacy: f.privacy };

  if (focus === "scope") {
    const good = el("boundary")
      ? "하지 않을 것을 분명히 말했어요. AI가 범위를 넓히지 않아요."
      : bonus("scope")
        ? "다른 아이디어는 따로 받겠다고 말했어요."
        : el("done")
          ? "필요한 양을 숫자로 정했어요."
          : "AI에게 내 부탁을 한 문장으로 말해 봤어요.";
    const next = !el("boundary")
      ? "이번에는 하지 않을 것(예: 하루 일정은 짜지 말고)을 말해 보세요."
      : !bonus("scope")
        ? "다른 아이디어가 있으면 “맨 아래에 따로” 적어 달라고 덧붙여 보세요."
        : f.vague.length
          ? f.vague[0].tip
          : "범위를 지키는 부탁이 됐어요!";
    return { good, next, privacy: [] };
  }

  const found = f.elements.filter((e) => e.found);
  const good = found.length
    ? `${found.map((e) => `‘${e.label.replace(/^[①②③④]\s*/, "")}’`).join(", ")} 칸이 보여요. 무엇을 고칠지 알 수 있어요.`
    : text.trim().length > 6
      ? "막연한 말 대신 내 말로 바꿔 써 봤어요."
      : "";
  const next = f.vague.length
    ? f.vague[0].tip
    : !el("done")
      ? "몇 장·몇 분·몇 줄처럼 숫자를 넣으면 더 분명해져요."
      : !el("boundary")
        ? "빼 줄 것(하지 않을 것)도 함께 말해 보세요."
        : "무엇을 어떻게 고칠지 분명한 부탁이에요!";
  return { good, next, privacy: [] };
}

export default function RewriteVague({ storeKey, items, example, focus }: Props) {
  const [values, setValues] = useStored<Record<string, string>>(storeKey, {});
  const [shown, setShown] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-5">
      {items.map((it) => {
        const v = values[it] ?? "";
        const fb = shown[it] ? feedbackFor(v, focus) : null;
        return (
          <div key={it}>
            {!it.startsWith("(") && (
              <p className="mb-1">
                <span className="text-sm font-bold text-muted">막연한 부탁</span>{" "}
                <span className="font-semibold">“{it}”</span>
              </p>
            )}
            <TextArea
              label={it.startsWith("(") ? "AI에게 건넬 부탁" : "분명한 부탁으로 바꾸기"}
              value={v}
              onChange={(nv) => {
                setValues({ ...values, [it]: nv });
                setShown({ ...shown, [it]: false });
              }}
            />
            <div className="mt-2">
              <Button variant="soft" onClick={() => setShown({ ...shown, [it]: true })} disabled={!v.trim()}>
                점검해 보기
              </Button>
            </div>
            {fb && <FeedbackBox {...fb} />}
          </div>
        );
      })}
      <HelperNote />
      {example && <Reveal>{example}</Reveal>}
    </div>
  );
}
