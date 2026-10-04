import type { Line } from "../../content/types";
import { useStored } from "../../lib/storage";
import { Bubble, Reveal, TextArea } from "../ui";

interface Props {
  storeKey: string;
  fields?: string[];
  rows?: number;
  example?: string;
  examples?: string[];
  dialogue?: Line[];
  table?: { rowsLabel: string; rows: string[]; cols: string[] };
}

/** 자유 쓰기. 칸 목록 또는 표(행×열) 형태. 입력은 이 기기에만 저장된다. */
export default function FreeWrite({ storeKey, fields = [], rows = 2, example, examples, dialogue, table }: Props) {
  const [values, setValues] = useStored<Record<string, string>>(storeKey, {});
  const set = (k: string, v: string) => setValues((prev) => ({ ...prev, [k]: v }));

  return (
    <div>
      {dialogue && (
        <div className="mb-4 space-y-3 rounded-card bg-bg p-4">
          {dialogue.map((l, i) => (
            <Bubble key={i} speaker={l.speaker} text={l.text} />
          ))}
        </div>
      )}

      {table && (
        <div className="space-y-4">
          {table.rows.map((r) => (
            <fieldset key={r} className="rounded-card border border-line p-3">
              <legend className="px-1 font-bold">
                {table.rowsLabel}: {r}
              </legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {table.cols.map((c) => (
                  <TextArea key={c} label={c} value={values[`${r}|${c}`] ?? ""} onChange={(v) => set(`${r}|${c}`, v)} rows={1} />
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      )}
      {fields.length > 0 && (
        <div className={`space-y-3 ${table ? "mt-4" : ""}`}>
          {fields.map((f, i) => (
            <div key={f}>
              <TextArea label={f} value={values[f] ?? ""} onChange={(v) => set(f, v)} rows={rows} />
              {examples?.[i] && <Reveal>{examples[i]}</Reveal>}
            </div>
          ))}
        </div>
      )}

      {example && <Reveal>{example}</Reveal>}
    </div>
  );
}
