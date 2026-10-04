import { useMemo, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { isLevel, labScenarios, levelMeta } from "../../content/load";
import type { LabScenario, Level, SentenceTag } from "../../content/types";
import { checkPrompt, findPrivacy } from "../../lib/check";
import { save, useStored } from "../../lib/storage";
import LabFinish from "./LabFinish";
import { Bubble, Button, Card, Label, TextArea } from "../../components/ui";
import { FeedbackBox, HelperNote, PrivacyWarning } from "../../components/activities/Feedback";

const STEPS = ["부탁 쓰기", "점검", "첫 결과물", "되말하기", "바로잡기"];

const TAGS: { id: SentenceTag; label: string; cls: string }[] = [
  { id: "ok", label: "맞음", cls: "border-ok bg-ok-soft text-ok" },
  { id: "wrong", label: "틀림", cls: "border-bad bg-bad-soft text-bad" },
  { id: "extra", label: "덧붙임", cls: "border-warn bg-warn-soft text-warn" },
  { id: "check", label: "확인 필요", cls: "border-accent bg-accent-soft text-accent" },
];

interface LabState {
  step: number;
  prompt: string;
  response?: string;
  tags: Record<number, SentenceTag>;
  tagsChecked: boolean;
  restateMarks: Record<number, boolean>;
  restateChecked: boolean;
  correction: string;
  correctionChecked: boolean;
}

const EMPTY: LabState = {
  step: 0,
  prompt: "",
  tags: {},
  tagsChecked: false,
  restateMarks: {},
  restateChecked: false,
  correction: "",
  correctionChecked: false,
};

export default function LabPage() {
  const { level } = useParams();
  const [search] = useSearchParams();
  const [chosen, setChosen] = useState<string | null>(null);
  if (!isLevel(level)) return <Navigate to="/prompt" replace />;
  const meta = levelMeta(level);
  const scenarios = labScenarios(level);
  const tryText = search.get("try") ?? "";

  const scenario = scenarios.find((s) => s.id === chosen) ?? (scenarios.length === 1 ? scenarios[0] : undefined);

  return (
    <div>
      <p className="font-semibold text-accent">{meta.name} · 프롬프트 실험실</p>
      <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">부탁하고, 확인하고, 바로잡아 봐요</h1>
      <p className="mt-2 max-w-2xl text-muted">
        실제 AI가 아니라 미리 써 둔 응답으로 움직이는 연습장이에요. AI 계정이 없어도 돼요. 쓴 내용은 어디로도 보내지
        않아요.
      </p>

      {scenarios.length === 0 ? (
        <Card className="mt-6">
          <p>{meta.name} 실험실 시나리오는 지금 준비하고 있어요.</p>
          <Link to="/prompt/middle/lab" className="mt-3 inline-block font-semibold text-accent underline">
            중학교 실험실 먼저 해 보기
          </Link>
        </Card>
      ) : !scenario ? (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {scenarios.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setChosen(s.id)}
                className="block w-full rounded-card border border-line bg-surface p-5 text-left hover:border-accent"
              >
                <span className="text-lg font-bold">{s.title}</span>
                <span className="mt-1 block text-muted">{s.summary}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <>
          {scenarios.length > 1 && (
            <button
              type="button"
              onClick={() => setChosen(null)}
              className="mt-4 text-sm font-semibold text-accent underline underline-offset-4"
            >
              ← 다른 상황 고르기
            </button>
          )}
          <Lab key={scenario.id} scenario={scenario} level={level} tryText={tryText} />
        </>
      )}
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="mt-6 flex flex-wrap gap-2" aria-label="실험 단계">
      {STEPS.map((s, i) => (
        <li
          key={s}
          aria-current={i === step ? "step" : undefined}
          className={`rounded-full px-3 py-1 text-sm font-semibold ${
            i === step ? "bg-accent text-accent-ink" : i < step ? "bg-accent-soft text-accent" : "bg-line/60 text-muted"
          }`}
        >
          {i + 1}. {s}
        </li>
      ))}
    </ol>
  );
}

function Lab({ scenario, level, tryText }: { scenario: LabScenario; level: string; tryText: string }) {
  const [s, setS] = useStored<LabState>(`lab:${level}:${scenario.id}`, EMPTY);
  const up = (patch: Partial<LabState> | ((prev: LabState) => Partial<LabState>)) =>
    setS((prev) => ({ ...prev, ...(typeof patch === "function" ? patch(prev) : patch) }));
  const fb = useMemo(() => checkPrompt(s.prompt), [s.prompt]);
  const reset = () => {
    setS(EMPTY);
    save(`lab:${level}:${scenario.id}:finish`, undefined);
  };
  const livePrivacy = findPrivacy(s.prompt);

  const responseId =
    s.response ?? scenario.pick.find((p) => fb.count >= p.min)?.response ?? scenario.pick[scenario.pick.length - 1].response;
  const response = scenario.responses[responseId];
  const corrected = scenario.responses[scenario.corrected];

  const send = () => up({ step: 2, response: responseId, tags: {}, tagsChecked: false });

  return (
    <div>
      <Stepper step={s.step} />

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          {/* 1. 부탁 쓰기 */}
          <Card>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Label>상황</Label>
              <h2 className="text-xl font-bold">{scenario.title}</h2>
            </div>
            <p>{scenario.situation}</p>
            <div className="mt-4">
              <TextArea
                label="AI에게 건넬 부탁"
                value={s.prompt}
                rows={5}
                placeholder={`예) ${scenario.starter}`}
                onChange={(v) => up({ prompt: v, step: Math.min(s.step, 1), response: undefined })}
              />
            </div>
            {livePrivacy.length > 0 && (
              <div className="mt-2">
                <PrivacyWarning labels={livePrivacy} />
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {!s.prompt && (
                <Button variant="ghost" onClick={() => up({ prompt: scenario.starter })}>
                  {scenario.starterLabel ?? "한 줄로 시작하기"}
                </Button>
              )}
              {tryText && !s.prompt.includes(tryText) && (
                <Button variant="ghost" onClick={() => up({ prompt: (s.prompt ? s.prompt.trimEnd() + " " : "") + tryText })}>
                  오늘의 한 문장 넣기
                </Button>
              )}
              <Button onClick={() => up({ step: 1 })} disabled={!s.prompt.trim() || livePrivacy.length > 0}>
                점검하기
              </Button>
            </div>
          </Card>

          {/* 2. 즉시 점검 */}
          {s.step >= 1 && (
            <Card>
              <div className="mb-3 flex items-center gap-2">
                <Label>점검</Label>
                <h2 className="text-xl font-bold">내 부탁에 네 줄이 들어 있나요?</h2>
              </div>
              <ul className="flex flex-wrap gap-2">
                {fb.elements.map((e) => (
                  <li key={e.id}>
                    {e.found ? (
                      <span className="inline-flex min-h-[44px] items-center rounded-full bg-ok-soft px-3 text-sm font-semibold text-ok">
                        ✓ {e.label}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => up({ prompt: s.prompt.trimEnd() + e.insert, step: 0, response: undefined })}
                        className="inline-flex min-h-[44px] items-center rounded-full border-2 border-dashed border-warn px-3 text-sm font-semibold text-warn hover:bg-warn-soft"
                        title={e.hint}
                      >
                        + {e.label} 보충하기
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {fb.vague.length > 0 && (
                <p className="mt-3 text-sm">
                  막연한 말:{" "}
                  {fb.vague.map((v) => (
                    <mark key={v.word} className="mr-1 rounded bg-warn-soft px-1 text-warn">
                      {v.word}
                    </mark>
                  ))}
                </p>
              )}
              <FeedbackBox good={fb.good} next={fb.next} privacy={fb.privacy} />
              <div className="mt-3">
                <HelperNote />
              </div>
              {s.step === 1 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="ghost" onClick={() => up({ step: 0 })}>
                    부탁 고치기
                  </Button>
                  <Button onClick={send} disabled={fb.privacy.length > 0}>
                    이대로 AI에게 보내기 →
                  </Button>
                </div>
              )}
            </Card>
          )}

          {/* 3. 첫 결과물 */}
          {s.step >= 2 && response && (
            <Card>
              <div className="mb-3 flex items-center gap-2">
                <Label>첫 결과물</Label>
                <h2 className="text-xl font-bold">원한 것과 다른 곳 찾기</h2>
              </div>
              <div className="space-y-3 rounded-card bg-bg p-4">
                <Bubble speaker="나" text={s.prompt} />
                <Bubble speaker="AI" text="발표 자료를 만들었어요!" />
              </div>
              <p className="mt-4 text-sm text-muted">
                문장마다 <b>맞음 / 틀림 / 덧붙임 / 확인 필요</b> 중 하나를 골라요. 오른쪽 ‘나만 아는 조건’과 비교해 보세요.
              </p>
              <ul className="mt-3 space-y-3">
                {response.sentences.map((sen, i) => {
                  const pick = s.tags[i];
                  const right = s.tagsChecked && pick === sen.tag;
                  return (
                    <li
                      key={i}
                      className={`rounded-card border-2 p-3 ${
                        s.tagsChecked ? (right ? "border-ok" : "border-warn") : "border-line"
                      }`}
                    >
                      <p className="font-semibold">{sen.text}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label={`${sen.text} 표시`}>
                        {TAGS.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            role="radio"
                            aria-checked={pick === t.id}
                            onClick={() => up((p) => ({ tags: { ...p.tags, [i]: t.id }, tagsChecked: false }))}
                            className={`rounded-full border-2 px-3 py-1 text-sm font-semibold ${
                              pick === t.id ? t.cls : "border-line bg-surface text-muted hover:border-accent"
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                      {s.tagsChecked && (
                        <p className={`mt-2 text-sm ${right ? "text-ok" : "text-warn"}`}>
                          {right ? "✓ " : `예시: ${TAGS.find((t) => t.id === sen.tag)?.label} — `}
                          {sen.why}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="soft"
                  onClick={() => up({ tagsChecked: true })}
                  disabled={Object.keys(s.tags).length < response.sentences.length}
                >
                  예시와 비교하기
                </Button>
                {s.step === 2 && (
                  <Button onClick={() => up({ step: 3 })}>“어떻게 이해했는지 먼저 말해 줘” 요청하기 →</Button>
                )}
              </div>
              {s.tagsChecked && (
                <p className="mt-3 text-sm text-muted">
                  고칠 곳을 찾은 건 실패가 아니라, 서로 다르게 이해한 부분을 드디어 발견했다는 증거예요.
                </p>
              )}
            </Card>
          )}

          {/* 4. 되말하기 */}
          {s.step >= 3 && response && (
            <Card>
              <div className="mb-3 flex items-center gap-2">
                <Label>되말하기</Label>
                <h2 className="text-xl font-bold">AI는 이렇게 이해했대요</h2>
              </div>
              <div className="space-y-3 rounded-card bg-bg p-4">
                <Bubble speaker="나" text="만들기 전에, 내가 원하는 것을 네가 어떻게 이해했는지 먼저 말해 줘." />
                <Bubble speaker="AI" text={response.restate.text} />
              </div>
              <p className="mt-4 text-sm text-muted">AI가 이해한 조각마다 맞는지, 어긋났는지 골라요.</p>
              <ul className="mt-2 space-y-2">
                {response.restate.parts.map((p, i) => {
                  const mark = s.restateMarks[i];
                  const right = s.restateChecked && mark === p.correct;
                  return (
                    <li key={i} className="flex flex-wrap items-center gap-2 rounded-card border border-line p-2">
                      <span className="min-w-0 flex-1 font-semibold">“{p.text}”</span>
                      {[
                        { v: true, label: "맞아" },
                        { v: false, label: "어긋났어" },
                      ].map((o) => (
                        <button
                          key={o.label}
                          type="button"
                          aria-pressed={mark === o.v}
                          onClick={() => up((p) => ({ restateMarks: { ...p.restateMarks, [i]: o.v }, restateChecked: false }))}
                          className={`rounded-full border-2 px-3 py-1 text-sm font-semibold ${
                            mark === o.v
                              ? o.v
                                ? "border-ok bg-ok-soft text-ok"
                                : "border-bad bg-bad-soft text-bad"
                              : "border-line bg-surface text-muted"
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                      {s.restateChecked && (
                        <span className={`basis-full text-sm ${right ? "text-ok" : "text-warn"}`}>
                          {right ? "✓ " : "다시 볼까요? "}
                          {p.correct ? "나만 아는 조건과 맞아요." : `고칠 말 예: ${p.fix}`}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
              <div className="mt-3">
                <Button
                  variant="soft"
                  onClick={() => up({ restateChecked: true })}
                  disabled={Object.keys(s.restateMarks).length < response.restate.parts.length}
                >
                  확인하기
                </Button>
              </div>

              <div className="mt-5">
                <TextArea
                  label="바로잡는 말 쓰기 — 맞는 부분과 어긋난 부분을 알려 줘요"
                  value={s.correction}
                  rows={4}
                  placeholder="예) 아니야. ○○ 앞에서 하는 ○분 발표야. …"
                  onChange={(v) => up({ correction: v, correctionChecked: false })}
                />
                {findPrivacy(s.correction).length > 0 && (
                  <div className="mt-2">
                    <PrivacyWarning labels={findPrivacy(s.correction)} />
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button variant="soft" onClick={() => up({ correctionChecked: true })} disabled={!s.correction.trim()}>
                    점검해 보기
                  </Button>
                </div>
                {s.correctionChecked && <CorrectionFeedback scenario={scenario} prompt={s.prompt} correction={s.correction} />}
              </div>
              {s.step === 3 && (
                <div className="mt-4">
                  <Button
                    onClick={() => up({ step: 4 })}
                    disabled={!s.correction.trim() || findPrivacy(s.correction).length > 0}
                  >
                    바로잡은 말 보내기 →
                  </Button>
                </div>
              )}
            </Card>
          )}

          {/* 5. 바로잡은 결과물 */}
          {s.step >= 4 && corrected && (
            <Card>
              <div className="mb-3 flex items-center gap-2">
                <Label>바로잡기</Label>
                <h2 className="text-xl font-bold">바로잡은 결과물</h2>
              </div>
              <div className="space-y-3 rounded-card bg-bg p-4">
                <Bubble speaker="나" text={s.correction} />
                <Bubble speaker="AI" text="말씀하신 대로 다시 만들었어요." />
              </div>
              <ul className="mt-4 space-y-2">
                {corrected.sentences.map((sen, i) => {
                  const t = TAGS.find((x) => x.id === sen.tag)!;
                  return (
                    <li key={i} className="rounded-card border border-line p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border-2 px-2 text-xs font-bold ${t.cls}`}>{t.label}</span>
                        <span className="font-semibold">{sen.text}</span>
                      </div>
                      <p className="mt-1 text-sm text-muted">{sen.why}</p>
                    </li>
                  );
                })}
              </ul>
              {!scenario.verify && (
                <div className="mt-4 rounded-card bg-accent-soft p-4">
                  <p className="font-bold text-accent">한 바퀴 돌았어요!</p>
                  <p className="mt-1">
                    부탁 → 첫 결과물 점검 → 되말하기 → 바로잡기까지 해 봤어요. ‘확인 필요’ 표시가 남아 있죠? 숫자와 출처는
                    AI에게 맡기지 않고 내가 믿을 만한 자료로 직접 확인해요.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="ghost" onClick={reset}>
                      처음부터 다시 해 보기
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}
          {s.step >= 4 && corrected && scenario.verify && (
            <LabFinish
              scenario={scenario}
              level={level as Level}
              prompt={s.prompt}
              correction={s.correction}
              onReset={reset}
            />
          )}
        </div>

        {/* 나만 아는 조건 */}
        <aside className="order-first lg:order-none lg:sticky lg:top-32 lg:self-start">
          <div className="rounded-card border-2 border-dashed border-accent bg-surface p-4">
            <p className="font-bold text-accent">🔒 나만 아는 조건</p>
            <p className="mt-1 text-xs text-muted">선생님 안내문에 있던 조건이에요. AI는 이걸 몰라요.</p>
            <ul className="mt-3 space-y-1.5 text-[0.95rem]">
              {scenario.hidden.map((h) => (
                <li key={h}>• {h}</li>
              ))}
            </ul>
          </div>
          {s.step > 0 && (
            <Button variant="ghost" className="mt-3 w-full" onClick={reset}>
              처음부터 다시
            </Button>
          )}
        </aside>
      </div>
    </div>
  );
}

function CorrectionFeedback({ scenario, prompt, correction }: { scenario: LabScenario; prompt: string; correction: string }) {
  const all = prompt + " " + correction;
  const results = scenario.correctionChecks.map((c) => ({
    ...c,
    found: c.patterns.some((p) => new RegExp(p, "i").test(all)),
  }));
  const done = results.filter((r) => r.found);
  const missing = results.filter((r) => !r.found);
  const good = done.length
    ? `알려 준 조건: ${done.map((r) => r.label).join(", ")}. 분명하게 전했어요.`
    : "AI의 이해에 대답하며 대화를 이어 갔어요.";
  const next = missing.length
    ? `‘${missing[0].label}’도 알려 주면 AI가 짐작하지 않아도 돼요.`
    : "나만 아는 조건을 모두 전했어요. 이제 바로잡은 말을 보내 봐요.";
  return (
    <div>
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {results.map((r) => (
          <li
            key={r.label}
            className={`rounded-full px-3 py-1 text-sm font-semibold ${r.found ? "bg-ok-soft text-ok" : "bg-line/60 text-muted"}`}
          >
            {r.found ? "✓" : "○"} {r.label}
          </li>
        ))}
      </ul>
      <FeedbackBox good={good} next={next} />
      <p className="mt-2 text-xs text-muted">처음 부탁에 이미 쓴 조건도 함께 셌어요. 이 점검은 도우미일 뿐, 판단은 내가 해요.</p>
    </div>
  );
}
