import { Link } from "react-router-dom";
import { useStored } from "../../lib/storage";
import { renderActivity } from "./registry";

interface Step {
  title: string;
  desc?: string;
  component?: string;
  props?: Record<string, unknown>;
}

interface Props {
  storeKey: string;
  steps: Step[];
  rubric?: { title?: string; criteria: string[]; scale: string[]; who?: string[] };
  print?: boolean;
}

/** 13차시 종합 프로젝트: 단계별 활동 + 자기·친구 평가 + 인쇄 */
export default function ProjectSteps({ storeKey, steps, rubric, print }: Props) {
  const [level, lesson] = storeKey.split(":");
  const who = rubric?.who ?? ["나", "친구"];
  const [scores, setScores] = useStored<Record<string, string>>(storeKey + ":rubric", {});

  return (
    <div className="space-y-6">
      {print && (
        <div className="no-print flex flex-wrap gap-2">
          <Link
            to={`/prompt/print?level=${level}&l=${lesson}&p=sheet`}
            className="btn inline-flex items-center rounded-card bg-accent-soft px-4 font-semibold text-accent"
          >
            🖨 워크시트 인쇄 / PDF로 저장
          </Link>
        </div>
      )}
      <ol className="space-y-6">
        {steps.map((st, i) => (
          <li key={i} className="rounded-card border-l-4 border-accent bg-bg p-4">
            <p className="text-lg font-bold">{st.title}</p>
            {st.desc && <p className="mt-1 text-muted">{st.desc}</p>}
            {st.component && <div className="mt-3">{renderActivity(st.component, st.props, `${storeKey}:s${i}`)}</div>}
          </li>
        ))}
      </ol>

      {rubric && (
        <section>
          <p className="text-lg font-bold">{rubric.title ?? "자기·친구 평가"}</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-[0.95rem]">
              <thead>
                <tr>
                  <th className="border-b-2 border-accent px-2 py-2 text-left">평가 내용</th>
                  {who.map((w) => (
                    <th key={w} className="border-b-2 border-accent px-2 py-2 text-left">
                      {w}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rubric.criteria.map((c, ci) => (
                  <tr key={ci} className="align-top">
                    <td className="border-b border-line px-2 py-2">{c}</td>
                    {who.map((w) => {
                      const k = `${ci}|${w}`;
                      return (
                        <td key={w} className="border-b border-line px-2 py-2">
                          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={`${c} — ${w}`}>
                            {rubric.scale.map((sc) => (
                              <button
                                key={sc}
                                type="button"
                                role="radio"
                                aria-checked={scores[k] === sc}
                                onClick={() => setScores((p) => ({ ...p, [k]: sc }))}
                                className={`rounded-full border-2 px-2.5 text-sm font-semibold ${
                                  scores[k] === sc ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface"
                                }`}
                              >
                                {sc}
                              </button>
                            ))}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-sm text-muted">점수를 매기는 것이 아니라, 과정을 돌아보는 표예요.</p>
        </section>
      )}
    </div>
  );
}
