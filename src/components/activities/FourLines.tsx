import { useStored } from "../../lib/storage";
import { findPrivacy } from "../../lib/check";
import { CopyButton, Reveal, TextArea } from "../ui";
import { PrivacyWarning } from "./Feedback";

export type FourKey = "problem" | "criteria" | "boundary" | "done";
export type FourValues = Record<FourKey, string> & { topic?: string };

interface Props {
  storeKey: string;
  example?: Record<FourKey, string>;
  boundaryLabel?: string;
  /** 학교급별 칸 이름 (예: 초등 '네 칸') */
  labels?: Partial<Record<FourKey, string>>;
  /** "고른 일" 칸을 보여 줄지 */
  topic?: boolean;
  topicLabel?: string;
  /** 네 줄로 부탁 문장을 조립해 보여 줄지 */
  assemble?: boolean;
  closing?: string;
}

export const FOUR: { key: FourKey; label: string; q: string }[] = [
  { key: "problem", label: "① 문제", q: "지금 해결하려는 문제는 무엇인가?" },
  { key: "criteria", label: "② 기준", q: "가장 중요하게 지킬 기준은?" },
  { key: "boundary", label: "③ 경계", q: "이번에는 하지 않을 것은?" },
  { key: "done", label: "④ 완료 조건", q: "언제 “다 됐다”고 볼까?" },
];

export function assembleFour(v: FourValues, closing?: string) {
  const parts: string[] = [];
  if (v.problem.trim()) parts.push(`내가 하려는 일은 ${v.problem.trim()}이야.`);
  if (v.criteria.trim()) parts.push(`가장 중요한 기준은 ${v.criteria.trim()}.`);
  if (v.boundary.trim()) parts.push(`이번에는 ${v.boundary.trim()}은(는) 하지 않을 거야.`);
  if (v.done.trim()) parts.push(`${v.done.trim()}이면 끝이야.`);
  if (closing && parts.length) parts.push(closing);
  return parts.join(" ");
}

/** 작업 전 네 줄(네 칸) 쓰기 → 요청 문장 자동 조립 */
export default function FourLines({ storeKey, example, boundaryLabel, labels, topic, topicLabel, assemble, closing }: Props) {
  const [v, setV] = useStored<FourValues>(storeKey, { problem: "", criteria: "", boundary: "", done: "", topic: "" });
  const sentence = assemble ? assembleFour(v, closing) : "";
  const [draft, setDraft] = useStored<string>(storeKey + ":draft", "");
  const privacy = findPrivacy(Object.values(v).join(" ") + " " + draft);

  return (
    <div>
      {topic && (
        <div className="mb-3">
          <TextArea label={topicLabel ?? "고른 일"} value={v.topic ?? ""} onChange={(t) => setV({ ...v, topic: t })} rows={1} />
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {FOUR.map((f) => (
          <div key={f.key} className="rounded-card border border-line p-3">
            <TextArea
              label={labels?.[f.key] ?? (f.key === "boundary" && boundaryLabel ? `③ ${boundaryLabel}` : f.label)}
              placeholder={f.q}
              value={v[f.key]}
              onChange={(t) => setV({ ...v, [f.key]: t })}
            />
            {example && (
              <Reveal>
                {example[f.key]}
              </Reveal>
            )}
          </div>
        ))}
      </div>
      {privacy.length > 0 && (
        <div className="mt-3">
          <PrivacyWarning labels={privacy} />
        </div>
      )}
      {assemble && (
        <div className="mt-4 rounded-card bg-accent-soft p-4">
          <p className="text-sm font-bold text-accent">네 줄로 만든 부탁 문장</p>
          <p className="mt-1 min-h-[1.7em]">{sentence || "네 칸을 채우면 여기에 부탁 문장이 만들어져요."}</p>
          {sentence && (
            <>
              <div className="mt-3">
                <TextArea
                  label="내 말로 다듬어 완성하기"
                  value={draft || sentence}
                  onChange={setDraft}
                  rows={4}
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <CopyButton text={draft || sentence} label="부탁 문장 복사" />
                {draft && draft !== sentence && (
                  <button type="button" onClick={() => setDraft("")} className="text-sm font-semibold text-accent underline">
                    네 줄로 다시 만들기
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
