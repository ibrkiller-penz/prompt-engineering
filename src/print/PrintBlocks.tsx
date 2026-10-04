// 종이 활동지용 정적 렌더러. 화면용 컴포넌트와 같은 JSON props를 받아 빈칸·표·선으로 그린다.
import type { ReactNode } from "react";
import type { Block, Lesson, Line } from "../content/types";
import { DEFAULT_FIELDS } from "../components/activities/registry";
import { FOUR } from "../components/activities/FourLines";

const KO = "ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type P = Record<string, any>;

function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i, arr) => (
        <span key={i}>
          {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) => (part.startsWith("**") ? <b key={j}>{part.slice(2, -2)}</b> : part))}
          {i < arr.length - 1 && <br />}
        </span>
      ))}
    </>
  );
}

const Lines = ({ n = 2 }: { n?: number }) => (
  <>
    {Array.from({ length: Math.max(1, n) }, (_, i) => (
      <div key={i} className="ln" />
    ))}
  </>
);

const Say = ({ l }: { l: Line }) =>
  l.speaker ? (
    <p className="say">
      <b>{l.speaker}</b>
      <Rich text={l.text} />
    </p>
  ) : (
    <p>
      <Rich text={l.text} />
    </p>
  );

const Table = ({ headers, rows }: { headers: string[]; rows: string[][] }) => (
  <table>
    {headers.some(Boolean) && (
      <thead>
        <tr>
          {headers.map((h, i) => (
            <th key={i}>{h}</th>
          ))}
        </tr>
      </thead>
    )}
    <tbody>
      {rows.map((r, i) => (
        <tr key={i}>
          {r.map((c, j) => (
            <td key={j}>
              <Rich text={c} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);

/** 낱말 잇기 뜻 순서 — 화면(MatchPairs)과 같은 섞기 */
function shuffled<T>(arr: T[]): T[] {
  const out = [...arr];
  let seed = 7;
  for (let i = out.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    const j = seed % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const box = "☐";

/** 활동 한 개를 종이용으로 */
export function PrintActivity({ name, p }: { name: string; p: P }): ReactNode {
  switch (name) {
    case "FreeWrite":
      return (
        <>
          {p.dialogue?.map((l: Line, i: number) => <Say key={i} l={l} />)}
          {p.table && (
            <table>
              <thead>
                <tr>
                  <th>{p.table.rowsLabel}</th>
                  {p.table.cols.map((c: string) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {p.table.rows.map((r: string) => (
                  <tr key={r}>
                    <td>{r}</td>
                    {p.table.cols.map((c: string) => (
                      <td key={c} className="w" />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {(p.fields ?? []).map((f: string) => (
              <div key={f} className="field">
                <div className="fl">{f}</div>
                <Lines n={p.rows ?? 2} />
              </div>
            ))}
        </>
      );
    case "MatchPairs": {
      const defs: string[] = shuffled<string>((p.pairs ?? []).map((x: P) => String(x.def)));
      return (
        <div className="match">
          <div>
            {(p.pairs ?? []).map((x: P) => (
              <div key={x.term}>
                {x.term} ( &nbsp;&nbsp;&nbsp; )
              </div>
            ))}
          </div>
          <div>
            {defs.map((d, i) => (
              <div key={d}>
                {KO[i]}. {d}
              </div>
            ))}
          </div>
        </div>
      );
    }
    case "CompareTable":
      return (
        <table>
          <thead>
            <tr>
              <th>{p.leftLabel}</th>
              <th>{p.rightLabel}</th>
              <th>○ / ×</th>
              <th>이유</th>
            </tr>
          </thead>
          <tbody>
            {(p.rows ?? []).map((r: P, i: number) => (
              <tr key={i}>
                <td>{r.want}</td>
                <td>{r.got}</td>
                <td className="c w" />
                <td className="w" style={{ width: "34%" }} />
              </tr>
            ))}
          </tbody>
        </table>
      );
    case "Classify":
    case "SortExtras":
    case "MisVsDiff":
    case "ReasonTags":
      return (
        <table>
          <thead>
            <tr>
              <th>내용</th>
              {(p.categories ?? []).map((c: P) => (
                <th key={c.id} className="c">
                  {c.label}
                </th>
              ))}
              {p.withReason && <th>이유</th>}
            </tr>
          </thead>
          <tbody>
            {(p.items ?? []).map((it: P, i: number) => (
              <tr key={i}>
                <td>{it.text}</td>
                {(p.categories ?? []).map((c: P) => (
                  <td key={c.id} className="c">
                    {box}
                  </td>
                ))}
                {p.withReason && <td className="w" style={{ width: "30%" }} />}
              </tr>
            ))}
          </tbody>
        </table>
      );
    case "RewriteVague":
      return (
        <>
          {(p.items ?? []).map((it: string) => (
            <div key={it} className="field">
              {!it.startsWith("(") && <div className="fl">“{it}” →</div>}
              <Lines n={2} />
            </div>
          ))}
        </>
      );
    case "RestateCheck":
      return (
        <>
          <table>
            <thead>
              <tr>
                <th>대답</th>
                <th className="c">되말하기예요</th>
                <th className="c">이해한 것이 안 보여요</th>
              </tr>
            </thead>
            <tbody>
              {(p.items ?? []).map((it: P, i: number) => (
                <tr key={i}>
                  <td>“{it.text}”</td>
                  <td className="c">{box}</td>
                  <td className="c">{box}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {p.meanings && (
            <div className="field">
              <div className="fl">{p.meanings.question}</div>
              <div className="opts">
                {p.meanings.options.map((o: string) => (
                  <span key={o}>
                    <span className="ck">{box}</span> {o}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      );
    case "FourLines":
      return (
        <>
          {p.topic && (
            <div className="field">
              <div className="fl">{p.topicLabel ?? "고른 일"}</div>
              <Lines n={1} />
            </div>
          )}
          <table>
            <tbody>
              {FOUR.map((f) => (
                <tr key={f.key}>
                  <th style={{ width: "26%" }}>
                    {p.labels?.[f.key] ?? (f.key === "boundary" && p.boundaryLabel ? `③ ${p.boundaryLabel}` : f.label)}
                    <div style={{ fontWeight: 400, fontSize: "8.5pt", color: "#666" }}>{f.q}</div>
                  </th>
                  <td className="w2" />
                </tr>
              ))}
            </tbody>
          </table>
          {p.assemble && (
            <div className="field">
              <div className="fl">AI에게 건넬 부탁 문장</div>
              <Lines n={4} />
            </div>
          )}
        </>
      );
    case "MarkPassage":
      return (
        <>
          <div className="passage">{(p.chunks ?? []).map((c: P) => c.text).join("")}</div>
          <table>
            <thead>
              <tr>
                <th>검증이 필요한 내용</th>
                <th>어디서 확인할까요?</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: Math.max(3, (p.chunks ?? []).filter((c: P) => c.verify).length) }, (_, i) => (
                <tr key={i}>
                  <td className="w" />
                  <td className="w" />
                </tr>
              ))}
            </tbody>
          </table>
        </>
      );
    case "VerifyTable": {
      const cols = p.cols ?? ["확인할 사실", "어디서 확인할까요?", "결과"];
      const results = p.results ?? ["맞음", "틀림", "확인 못 함"];
      const rows: string[] = p.rows ?? [];
      return (
        <table>
          <thead>
            <tr>
              {cols.map((c: string) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: Math.max(p.count ?? 3, rows.length) }, (_, i) => (
              <tr key={i}>
                <td className="w">{rows[i] ?? ""}</td>
                <td className="w" />
                <td style={{ fontSize: "8.5pt", whiteSpace: "nowrap" }}>{results.map((r: string) => `${box} ${r}`).join("  ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    case "FormFields":
    case "ChoiceRecord":
    case "RestartSix":
    case "CloseFive":
    case "HonestyChecklist": {
      const fields = p.fields ?? DEFAULT_FIELDS[name] ?? [];
      return (
        <>
          {p.situation && <div className="sit">{p.situation}</div>}
          {p.checklist?.map((c: string) => (
            <p key={c}>
              <span className="ck">{box}</span> {c}
            </p>
          ))}
          <table>
            <tbody>
              {fields.map((f: P) => (
                <tr key={f.key}>
                  <th style={{ width: "30%" }}>{f.label}</th>
                  <td className="w2" />
                </tr>
              ))}
            </tbody>
          </table>
        </>
      );
    }
    case "ProjectSteps":
      return (
        <>
          {(p.steps ?? []).map((st: P, i: number) => (
            <div key={i} className="step">
              <h3>{st.title}</h3>
              {st.desc && <p className="ins">{st.desc}</p>}
              {st.component && <PrintActivity name={st.component} p={st.props ?? {}} />}
            </div>
          ))}
          {p.rubric && (
            <>
              <h3>{p.rubric.title ?? "자기·친구 평가"}</h3>
              <table>
                <thead>
                  <tr>
                    <th>평가 내용</th>
                    {(p.rubric.who ?? ["나", "친구"]).map((w: string) => (
                      <th key={w} className="c">
                        {w}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {p.rubric.criteria.map((c: string) => (
                    <tr key={c}>
                      <td>{c}</td>
                      {(p.rubric.who ?? ["나", "친구"]).map((w: string) => (
                        <td key={w} className="c" style={{ fontSize: "8.5pt" }}>
                          {p.rubric.scale.join(" · ")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      );
    default:
      return <Lines n={4} />;
  }
}

/** 차시 블록 하나를 종이용으로. mode=sheet 이면 활동 관련 블록만 */
export function PrintBlock({ b, mode }: { b: Block; mode: "lesson" | "sheet" }): ReactNode {
  const readOnly = ["think", "story", "explain", "words", "analogy", "remember", "promise", "roleplay"];
  if (mode === "sheet" && readOnly.includes(b.type) && b.type !== "think") return null;
  switch (b.type) {
    case "think":
      return (
        <div className="box">
          <span className="cap">생각 열기</span>
          <ul>
            {b.questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      );
    case "story":
      return (
        <>
          <h2>
            <span className="tag">이야기</span>
            {b.title}
          </h2>
          {b.intro && <p className="ins">{b.intro}</p>}
          {b.scenes.map((s, i) => (
            <div key={i} className="scene">
              {s.title && <p className="st">{s.title}</p>}
              {s.lines.map((l, k) => (
                <Say key={k} l={l} />
              ))}
              {s.words?.map((w) => (
                <div key={w.term} className="word">
                  <b>낱말 · {w.term}</b>
                  {w.def}
                  {w.example && ` 예) ${w.example}`}
                </div>
              ))}
            </div>
          ))}
        </>
      );
    case "explain":
      return (
        <>
          <h2>
            <span className="tag">알아보기</span>
            {b.title}
          </h2>
          {b.body?.map((t, i) => (
            <p key={i}>
              <Rich text={t} />
            </p>
          ))}
          {b.steps && (
            <ol>
              {b.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          )}
          {b.table && <Table headers={b.table.headers} rows={b.table.rows} />}
          {b.dialogue?.map((l, i) => <Say key={i} l={l} />)}
          {b.after?.map((t, i) => (
            <p key={i}>
              <Rich text={t} />
            </p>
          ))}
        </>
      );
    case "words":
      return (
        <>
          {b.words.map((w) => (
            <div key={w.term} className="word">
              <b>{w.term}</b>
              {w.def}
              {w.example && ` 예) ${w.example}`}
            </div>
          ))}
        </>
      );
    case "analogy":
      return (
        <div className="box dash">
          <span className="cap">생활 속 비유 · {b.title}</span>
          {b.body.map((t, i) => (
            <p key={i}>
              <Rich text={t} />
            </p>
          ))}
        </div>
      );
    case "remember":
      return (
        <div className="box rem">
          <span className="cap">꼭 기억해요</span>
          {b.items.map((t) => (
            <p key={t}>• {t}</p>
          ))}
        </div>
      );
    case "promise":
      return (
        <div className="box">
          <span className="cap">{b.title}</span>
          <ol>
            {b.items.map((it) => (
              <li key={it.title}>
                <b>{it.title}</b> {it.body}
              </li>
            ))}
          </ol>
          {b.note && <p className="ins">{b.note}</p>}
        </div>
      );
    case "roleplay":
      return (
        <div className="box dash">
          <span className="cap">AI 역할 놀이 · {b.title}</span>
          {b.body?.map((t, i) => (
            <p key={i}>
              <Rich text={t} />
            </p>
          ))}
          {b.steps && (
            <ol>
              {b.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          )}
        </div>
      );
    case "activity":
      return (
        <div className="act">
          <div className="ah">
            <span className="tag">{b.n === "연습" ? "연습" : `활동 ${b.n}`}</span>
            {b.title}
          </div>
          {b.instruction && <p className="ins">{b.instruction}</p>}
          {b.situation && <div className="sit">{b.situation}</div>}
          <PrintActivity name={b.component} p={b.props ?? {}} />
        </div>
      );
    case "selfcheck":
      return (
        <div className="box">
          <span className="cap">스스로 점검해요</span>
          {b.items.map((t) => (
            <p key={t}>
              <span className="ck">{box}</span> {t}
            </p>
          ))}
        </div>
      );
    case "todaySentence":
      return (
        <div className="today">
          <div className="cap">오늘의 한 문장 — AI에게 이렇게 말해 보세요</div>
          <p>“{b.text}”</p>
        </div>
      );
    case "note":
      return (
        <div className="field">
          <div className="fl">✎ 나의 생각 노트 — {b.prompt}</div>
          <Lines n={4} />
        </div>
      );
    default:
      return null;
  }
}

/** 예시 답 모으기: 교사용 지도서 답이 있으면 그것을, 없으면 활동 props에서 */
export function collectAnswers(lesson: Lesson): string[] {
  if (lesson.teacher?.answers?.length) return lesson.teacher.answers;
  const out: string[] = [];
  const walk = (label: string, name: string, p: P) => {
    const add = (s: string) => out.push(`${label}: ${s}`);
    if (name === "MatchPairs") add((p.pairs ?? []).map((x: P) => `${x.term}-${x.def}`).join(", "));
    if (name === "CompareTable") add((p.rows ?? []).map((r: P) => `${r.want} ${r.answer === "o" ? "○" : "×"}(${r.reason})`).join(" / "));
    if (["Classify", "SortExtras", "MisVsDiff", "ReasonTags"].includes(name)) {
      const lab = (id: string) => (p.categories ?? []).find((c: P) => c.id === id)?.label ?? id;
      const items = (p.items ?? []).filter((it: P) => it.answer);
      if (items.length)
        add(items.map((it: P) => `${it.text} → ${[it.answer].flat().map(lab).join("·")}`).join(" / "));
    }
    if (name === "MarkPassage") add((p.chunks ?? []).filter((c: P) => c.verify).map((c: P) => `“${c.text.trim()}”${c.where ? ` (${c.where})` : ""}`).join(" / "));
    if (name === "FourLines" && p.example) add(FOUR.map((f) => `${f.label} ${p.example[f.key]}`).join(" / "));
    if (Array.isArray(p.examples)) p.examples.forEach((e: string, i: number) => e && add(`${p.fields?.[i] ?? ""} ${e}`.trim()));
    if (Array.isArray(p.fields)) p.fields.forEach((f: P) => f?.example && add(`${f.label} ${f.example}`));
    if (p.example && typeof p.example === "string") add(p.example);
    if (name === "ProjectSteps") (p.steps ?? []).forEach((st: P) => st.component && walk(`${label} ${st.title}`, st.component, st.props ?? {}));
  };
  lesson.blocks.forEach((b) => {
    if (b.type === "activity") walk(b.n === "연습" ? "연습" : `활동 ${b.n}`, b.component, b.props ?? {});
  });
  return out;
}
