import { useStored } from "../../lib/storage";
import { findPrivacy } from "../../lib/check";
import { CopyButton, Reveal, TextArea } from "../ui";
import { PrivacyWarning } from "./Feedback";

export interface Field {
  key: string;
  label: string;
  placeholder?: string;
  example?: string;
}

interface Props {
  storeKey: string;
  fields: Field[];
  template?: string;
  templateLabel?: string;
  checklist?: string[];
  situation?: string;
  example?: string;
  rows?: number;
}

type State = { values: Record<string, string>; checks: boolean[] };

/** {key} 자리에 칸 내용을 넣는다. 자리 값이 모두 비어 있는 줄은 뺀다. */
export function fillTemplate(template: string, values: Record<string, string>) {
  return template
    .split("\n")
    .filter((line) => {
      const keys = [...line.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      return keys.length === 0 || keys.some((k) => (values[k] ?? "").trim());
    })
    .map((line) => line.replace(/\{(\w+)\}/g, (_, k) => (values[k] ?? "").trim()))
    .join("\n")
    .trim();
}

/** 이름 붙은 칸 채우기 (선택 기록 다섯 줄 · 재시작 여섯 줄 · 마무리 다섯 질문 · AI 사용 밝히기) */
export default function FormFields({ storeKey, fields, template, templateLabel, checklist, situation, example, rows = 2 }: Props) {
  const [s, setS] = useStored<State>(storeKey, { values: {}, checks: [] });
  const values = s.values ?? {};
  const filled = Object.values(values).some((v) => v.trim());
  const text = template && filled ? fillTemplate(template, values) : "";
  const privacy = findPrivacy(Object.values(values).join(" "));

  return (
    <div>
      {situation && (
        <div className="mb-4 rounded-card border border-line bg-bg p-4">
          <p className="mb-1 text-sm font-bold text-accent">상황</p>
          <p>{situation}</p>
        </div>
      )}
      {checklist && checklist.length > 0 && (
        <ul className="mb-4 space-y-1">
          {checklist.map((c, i) => (
            <li key={i}>
              <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  className="h-6 w-6 shrink-0 accent-[var(--accent)]"
                  checked={!!s.checks?.[i]}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setS((p) => {
                      const checks = [...(p.checks ?? [])];
                      checks[i] = on;
                      return { ...p, checks };
                    });
                  }}
                />
                <span>{c}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-3">
        {fields.map((f) => (
          <div key={f.key}>
            <TextArea
              label={f.label}
              placeholder={f.placeholder}
              value={values[f.key] ?? ""}
              rows={rows}
              onChange={(v) => setS((p) => ({ ...p, values: { ...(p.values ?? {}), [f.key]: v } }))}
            />
            {f.example && <Reveal>{f.example}</Reveal>}
          </div>
        ))}
      </div>
      {privacy.length > 0 && (
        <div className="mt-3">
          <PrivacyWarning labels={privacy} />
        </div>
      )}
      {template && (
        <div className="mt-4 rounded-card bg-accent-soft p-4">
          <p className="text-sm font-bold text-accent">{templateLabel ?? "완성된 문장"}</p>
          <p className="mt-1 whitespace-pre-line">{text || "칸을 채우면 여기에 문장이 만들어져요."}</p>
          {text && (
            <div className="mt-3">
              <CopyButton text={text} label="복사하기" />
            </div>
          )}
        </div>
      )}
      {example && <Reveal>{example}</Reveal>}
    </div>
  );
}
