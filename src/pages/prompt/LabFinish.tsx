import { getLesson } from "../../content/load";
import type { LabScenario, Level } from "../../content/types";
import { findPrivacy } from "../../lib/check";
import { useStored } from "../../lib/storage";
import { Button, Card, CopyButton, Label, Reveal, TextArea } from "../../components/ui";
import { PrivacyWarning } from "../../components/activities/Feedback";

// 실험실 6~10단계: 검증 → 판단(추가 제안) → 선택 기록 → 마무리 → 나의 기록 내보내기

const SUB = ["검증", "판단", "선택 기록", "마무리", "나의 기록"];

const CHOICE = [
  { key: "chosen", label: "① 고른 것" },
  { key: "why", label: "② 고른 이유" },
  { key: "dropped", label: "③ 뺀 후보" },
  { key: "unsure", label: "④ 확실하지 않은 점" },
  { key: "revisit", label: "⑤ 다시 볼 조건" },
] as const;

const CLOSE = [
  { key: "problem", label: "① 처음 문제는 무엇이었나?" },
  { key: "done", label: "② 완료 조건을 채웠나?" },
  { key: "enough", label: "③ 이번 단계에 충분한가?" },
  { key: "gap", label: "④ 남은 차이·아쉬움·위험은?" },
  { key: "reopen", label: "⑤ 어떤 조건이면 다시 열까?" },
] as const;

interface FinishState {
  step: number;
  verify: Record<number, { where: string; result: string }>;
  extra: string;
  extraWhy: string;
  choice: Record<string, string>;
  close: Record<string, string>;
}

const EMPTY: FinishState = { step: 0, verify: {}, extra: "", extraWhy: "", choice: {}, close: {} };

function todayOf(level: Level, n: number, fallback: string) {
  const b = getLesson(level, n)?.blocks.find((x) => x.type === "todaySentence");
  return b && b.type === "todaySentence" ? b.text : fallback;
}

export default function LabFinish({
  scenario,
  level,
  prompt,
  correction,
  onReset,
}: {
  scenario: LabScenario;
  level: Level;
  prompt: string;
  correction: string;
  onReset: () => void;
}) {
  const [f, setF] = useStored<FinishState>(`lab:${level}:${scenario.id}:finish`, EMPTY);
  const up = (patch: Partial<FinishState> | ((p: FinishState) => Partial<FinishState>)) =>
    setF((p) => ({ ...p, ...(typeof patch === "function" ? patch(p) : patch) }));
  const facts = scenario.verify?.facts ?? [];
  const extra = scenario.extras?.options.find((o) => o.id === f.extra);
  const privacy = findPrivacy([f.extraWhy, ...Object.values(f.choice), ...Object.values(f.close)].join(" "));

  const verifyLines = facts.map((x, i) => `- ${x.text} → ${f.verify[i]?.result || "아직 확인 안 함"}${f.verify[i]?.where ? ` (${f.verify[i].where})` : ""}`);
  const restart = [
    todayOf(level, 11, "지난번에 정한 건 이거야. 지금도 맞는지 먼저 확인해 줘."),
    `① 현재 목표: ${f.close.problem?.trim() || scenario.summary}`,
    `② 끝낸 것: 네 줄로 부탁하고 되말하기로 바로잡은 결과물을 받음. 검증: ${facts.map((x, i) => `${x.text.slice(0, 20)}…(${f.verify[i]?.result || "미확인"})`).join(", ")}`,
    f.choice.chosen || f.choice.why ? `③ 확정한 선택과 이유: ${f.choice.chosen ?? ""} — ${f.choice.why ?? ""}` : "",
    f.close.gap ? `④ 남은 차이와 위험: ${f.close.gap}` : "",
    f.choice.unsure ? `⑤ 아직 정하지 않은 것: ${f.choice.unsure}` : "",
    f.close.reopen || f.choice.revisit ? `⑥ 다음 시작점: ${f.close.reopen || f.choice.revisit}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const record = [
    `[${scenario.title}] 나의 실험 기록`,
    "",
    `■ 처음 부탁\n${prompt}`,
    `■ 바로잡은 말\n${correction}`,
    facts.length ? `■ 검증\n${verifyLines.join("\n")}` : "",
    scenario.extras ? `■ 추가 제안 판단: ${extra?.label ?? "-"}${f.extraWhy ? ` — ${f.extraWhy}` : ""}` : "",
    `■ 선택 기록\n${CHOICE.map((c) => `${c.label}: ${f.choice[c.key] ?? ""}`).join("\n")}`,
    `■ 마무리 다섯 질문\n${CLOSE.map((c) => `${c.label} ${f.close[c.key] ?? ""}`).join("\n")}`,
    `■ 재시작 여섯 줄 (새 대화에 붙여 넣기)\n${restart}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return (
    <div className="space-y-5">
      <ol className="flex flex-wrap gap-2" aria-label="마무리 단계">
        {SUB.map((s, i) => (
          <li
            key={s}
            aria-current={i === f.step ? "step" : undefined}
            className={`rounded-full px-3 py-1 text-sm font-semibold ${
              i === f.step ? "bg-accent text-accent-ink" : i < f.step ? "bg-accent-soft text-accent" : "bg-line/60 text-muted"
            }`}
          >
            {i + 6}. {s}
          </li>
        ))}
      </ol>

      {/* 6. 검증 */}
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <Label>검증</Label>
          <h2 className="text-xl font-bold">사실은 내가 직접 확인해요</h2>
        </div>
        {scenario.verify?.intro && <p className="mb-3">{scenario.verify.intro}</p>}
        <ul className="space-y-3">
          {facts.map((x, i) => {
            const v = f.verify[i] ?? { where: "", result: "" };
            const set = (patch: Partial<typeof v>) => up((p) => ({ verify: { ...p.verify, [i]: { ...(p.verify[i] ?? { where: "", result: "" }), ...patch } } }));
            return (
              <li key={i} className="rounded-card border border-line p-3">
                <p className="font-semibold">{x.text}</p>
                <input
                  value={v.where}
                  onChange={(e) => set({ where: e.target.value })}
                  placeholder="어디서 확인할까요?"
                  aria-label="어디서 확인할까요?"
                  className="mt-2 min-h-[44px] w-full rounded-card border border-line px-3 outline-none focus:border-accent"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {["맞음", "틀림", "확인 못 함"].map((r) => (
                    <button
                      key={r}
                      type="button"
                      aria-pressed={v.result === r}
                      onClick={() => set({ result: v.result === r ? "" : r })}
                      className={`rounded-full border-2 px-3 py-1 text-sm font-semibold ${
                        v.result === r ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <Reveal label="확인할 곳 예시 보기">{x.where}</Reveal>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-sm text-muted">
          실험실이라 실제로 찾아보지 못했다면 ‘확인 못 함’을 골라요. 확인 못 한 정보는 그대로 쓰지 않고 “확인 필요”라고 표시해요.
        </p>
        {f.step === 0 && (
          <Button className="mt-3" onClick={() => up({ step: 1 })}>
            다음: 추가 제안 판단하기 →
          </Button>
        )}
      </Card>

      {/* 7. 판단 */}
      {f.step >= 1 && scenario.extras && (
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Label>판단</Label>
            <h2 className="text-xl font-bold">추가 제안, 받을까요?</h2>
          </div>
          <p className="rounded-card bg-bg p-3">
            <b>AI의 추가 제안</b> · {scenario.extras.proposal}
          </p>
          <div className="mt-3 space-y-2" role="radiogroup" aria-label="추가 제안 판단">
            {scenario.extras.options.map((o) => (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={f.extra === o.id}
                onClick={() => up({ extra: o.id })}
                className={`block w-full rounded-card border-2 p-3 text-left ${
                  f.extra === o.id ? "border-accent bg-accent-soft" : "border-line bg-surface"
                }`}
              >
                <span className="font-bold">{o.label}</span>
                <span className="block text-sm text-muted">{o.effect}</span>
              </button>
            ))}
          </div>
          <div className="mt-3">
            <TextArea label="이렇게 정한 까닭" value={f.extraWhy} onChange={(v) => up({ extraWhy: v })} />
          </div>
          <p className="mt-2 text-sm text-muted">AI는 가능성을 펼쳐 주고, 무엇을 할지는 내가 골라요. 끝낼지도 처음 목표를 기준으로 내가 정해요.</p>
          {f.step === 1 && (
            <Button className="mt-3" onClick={() => up({ step: 2 })} disabled={!f.extra}>
              다음: 선택 기록 쓰기 →
            </Button>
          )}
        </Card>
      )}

      {/* 8. 선택 기록 */}
      {f.step >= 2 && (
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Label>선택 기록</Label>
            <h2 className="text-xl font-bold">다섯 줄로 남겨요</h2>
          </div>
          <div className="space-y-3">
            {CHOICE.map((c) => (
              <div key={c.key}>
                <TextArea label={c.label} value={f.choice[c.key] ?? ""} onChange={(v) => up((p) => ({ choice: { ...p.choice, [c.key]: v } }))} />
                {scenario.choiceExample?.[c.key] && <Reveal>{scenario.choiceExample[c.key]}</Reveal>}
              </div>
            ))}
          </div>
          {f.step === 2 && (
            <Button className="mt-3" onClick={() => up({ step: 3 })}>
              다음: 마무리 다섯 질문 →
            </Button>
          )}
        </Card>
      )}

      {/* 9. 마무리 */}
      {f.step >= 3 && (
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Label>마무리</Label>
            <h2 className="text-xl font-bold">완벽하지 않아도 이번 단계를 닫아요</h2>
          </div>
          <div className="space-y-3">
            {CLOSE.map((c) => (
              <div key={c.key}>
                <TextArea label={c.label} value={f.close[c.key] ?? ""} onChange={(v) => up((p) => ({ close: { ...p.close, [c.key]: v } }))} />
                {scenario.closeExample?.[c.key] && <Reveal>{scenario.closeExample[c.key]}</Reveal>}
              </div>
            ))}
          </div>
          {f.step === 3 && (
            <Button className="mt-3" onClick={() => up({ step: 4 })}>
              나의 기록 보기 →
            </Button>
          )}
        </Card>
      )}

      {privacy.length > 0 && <PrivacyWarning labels={privacy} />}

      {/* 10. 나의 기록 */}
      {f.step >= 4 && (
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Label>나의 기록</Label>
            <h2 className="text-xl font-bold">한 장으로 모았어요</h2>
          </div>
          <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap rounded-card bg-bg p-4 font-sans text-[0.95rem] leading-relaxed">{record}</pre>
          <div className="no-print mt-3 flex flex-wrap gap-2">
            <CopyButton text={record} label="전체 기록 복사" />
            <CopyButton text={restart} label="재시작 여섯 줄만 복사" />
            <Button variant="ghost" onClick={() => window.print()}>
              🖨 인쇄
            </Button>
            <Button variant="ghost" onClick={onReset}>
              처음부터 다시
            </Button>
          </div>
          <p className="mt-3 text-sm text-muted">
            ‘재시작 여섯 줄’은 다음에 새 대화를 시작할 때 맨 앞에 붙여 넣는 기록(관계의 기억)이에요. 이 기록은 이 기기에만 있어요.
          </p>
        </Card>
      )}
    </div>
  );
}
