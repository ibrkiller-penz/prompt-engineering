import { Link, Navigate, useParams } from "react-router-dom";
import { availableLessons, getLesson, getStory, getTeacherGuide, isLevel, levelMeta } from "../../content/load";
import type { Level, Table } from "../../content/types";
import { AI_SERVICES, useSettings } from "../../lib/settings";
import { Card, Label, Rich } from "../../components/ui";
import { collectAnswers } from "../../print/PrintBlocks";

function TableView({ table }: { table: Table }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-[0.95rem]">
        {table.headers.some(Boolean) && (
          <thead>
            <tr>
              {table.headers.map((h, i) => (
                <th key={i} className="border-b-2 border-accent bg-accent-soft/60 px-3 py-2 text-left font-bold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {table.rows.map((r, i) => (
            <tr key={i} className="align-top">
              {r.map((c, j) => (
                <td key={j} className="border-b border-line px-3 py-2">
                  <Rich text={c} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TeacherNav({ level }: { level: Level }) {
  return (
    <div className="no-print mb-5 flex flex-wrap items-center gap-2 rounded-card bg-ink px-4 py-2 text-sm text-white">
      <span className="font-bold">👩‍🏫 교사용</span>
      <span className="opacity-70">학생 화면에는 보이지 않는 메뉴예요.</span>
      <Link to={`/prompt/${level}`} className="ml-auto underline underline-offset-2">
        학생 화면으로
      </Link>
    </div>
  );
}

function SettingsCard({ level }: { level: Level }) {
  const [s, setS] = useSettings();
  const elementary = level === "elementary";
  return (
    <Card>
      <h2 className="text-lg font-bold">실제 AI로 해 보기 (실험실)</h2>
      <p className="mt-1 text-muted">
        켜면 중·고 실험실에 “내 부탁 복사하고 AI 열기” 버튼이 나타나요. 기본은 꺼짐이고, 초등은 켜도 나타나지 않아요. 이 설정은 지금 쓰는 기기에만
        저장돼요(교사용 전자칠판·PC에서 켜 두세요).
      </p>
      <label className="mt-3 flex min-h-[44px] cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          className="h-6 w-6 accent-[var(--accent)]"
          checked={s.realAi}
          onChange={(e) => {
            const on = e.target.checked;
            setS((p) => ({ ...p, realAi: on }));
          }}
        />
        <span className="font-semibold">실제 AI로 해 보기 버튼 보이기</span>
      </label>
      {s.realAi && (
        <div className="mt-2 space-y-2">
          <p className="text-sm font-bold">열 AI 도구</p>
          <div className="flex flex-wrap gap-2">
            {AI_SERVICES.map((a) => (
              <label
                key={a.id}
                className={`inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-full border px-3 text-sm ${
                  s.service === a.id ? "border-accent bg-accent-soft font-bold text-accent" : "border-line"
                }`}
              >
                <input type="radio" checked={s.service === a.id} onChange={() => setS((p) => ({ ...p, service: a.id }))} />
                {a.label}
              </label>
            ))}
          </div>
          {s.service === "custom" && (
            <input
              value={s.customUrl}
              onChange={(e) => {
                const v = e.target.value;
                setS((p) => ({ ...p, customUrl: v }));
              }}
              placeholder="https://"
              aria-label="AI 도구 주소"
              className="min-h-[44px] w-full rounded-card border border-line px-3 outline-none focus:border-accent"
            />
          )}
          <p className="rounded-card bg-warn-soft p-3 text-sm text-warn">
            학생이 쓰기 전에 확인하세요: 서비스 이용 연령과 보호자 동의, 학교·교육청 지침, 개인정보 입력 금지.
          </p>
        </div>
      )}
      {elementary && <p className="mt-3 text-sm text-muted">초등은 교재 원칙에 따라 실제 AI를 쓰지 않아요(교사 시연·AI 역할 놀이).</p>}
    </Card>
  );
}

/** /prompt/:level/teacher — 지도 원칙·평가 계획·차시별 지도안 목록·설정 */
export function TeacherHome() {
  const { level } = useParams();
  if (!isLevel(level)) return <Navigate to="/prompt" replace />;
  const meta = levelMeta(level);
  const guide = getTeacherGuide(level);
  const ready = availableLessons(level);
  return (
    <div className="space-y-5">
      <TeacherNav level={level} />
      <div>
        <p className="font-semibold text-accent">{meta.name} · 교사용</p>
        <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">수업 안내</h1>
        <p className="mt-2 text-muted">교사용 지도서의 지도 원칙과 평가 계획, 차시별 수업 흐름·발문·예시 답·지도 팁을 화면으로 봐요.</p>
      </div>

      <Card>
        <h2 className="text-lg font-bold">차시별 지도안</h2>
        <ol className="mt-3 grid gap-2 sm:grid-cols-2">
          {meta.lessons.map((l) => (
            <li key={l.n}>
              {ready.includes(l.n) ? (
                <Link
                  to={`/prompt/${level}/teacher/${l.n}`}
                  className="flex min-h-[44px] items-center gap-3 rounded-card border border-line px-3 py-2 hover:border-accent"
                >
                  <span className="font-bold text-accent">{l.n}</span>
                  <span>{l.title}</span>
                </Link>
              ) : (
                <span className="flex min-h-[44px] items-center gap-3 rounded-card border border-dashed border-line px-3 py-2 opacity-60">
                  <span className="font-bold">{l.n}</span>
                  {l.title}
                </span>
              )}
            </li>
          ))}
        </ol>
      </Card>

      <SettingsCard level={level} />

      {guide ? (
        guide.sections.map((s, i) => (
          <Card key={i}>
            <h2 className="text-lg font-bold">{s.title}</h2>
            <div className="mt-2 space-y-2">
              {s.body?.map((p, k) => (
                <p key={k}>
                  <Rich text={p} />
                </p>
              ))}
            </div>
            {s.list && (
              <ul className="mt-2 space-y-1.5">
                {s.list.map((x, k) => (
                  <li key={k}>
                    <Rich text={x} />
                  </li>
                ))}
              </ul>
            )}
            {s.table && <TableView table={s.table} />}
          </Card>
        ))
      ) : (
        <Card>
          <p className="text-muted">지도 원칙·평가 계획을 준비하고 있어요.</p>
        </Card>
      )}
      {guide && <p className="text-xs text-muted">출처: {guide.source}</p>}
    </div>
  );
}

/** /prompt/:level/teacher/:n — 차시 지도안 */
export function TeacherLesson() {
  const { level, n } = useParams();
  const num = Number(n);
  if (!isLevel(level)) return <Navigate to="/prompt" replace />;
  const lesson = getLesson(level, num);
  if (!lesson) return <Navigate to={`/prompt/${level}/teacher`} replace />;
  const t = lesson.teacher ?? {};
  const story = getStory(num);
  const answers = collectAnswers(lesson);
  const total = t.flow?.reduce((a, f) => a + (f.min || 0), 0) ?? 0;
  const ready = availableLessons(level);
  const prev = ready[ready.indexOf(num) - 1];
  const next = ready[ready.indexOf(num) + 1];

  return (
    <div className="space-y-5">
      <TeacherNav level={level} />
      <div>
        <Link to={`/prompt/${level}/teacher`} className="text-sm text-muted underline underline-offset-2">
          {levelMeta(level).name} 수업 안내
        </Link>
        <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">
          {num}차시 · {lesson.title}
        </h1>
        <p className="mt-1 text-muted">
          {lesson.minutes}분 · {lesson.source}
        </p>
        <div className="no-print mt-3 flex flex-wrap gap-2">
          <Link to={`/prompt/${level}/lesson/${num}`} className="btn inline-flex items-center rounded-card bg-accent px-4 font-semibold text-accent-ink">
            학생 화면 열기
          </Link>
          <Link
            to={`/prompt/${level}/lesson/${num}?class=1`}
            className="btn inline-flex items-center rounded-card border border-line bg-surface px-4 font-semibold"
          >
            📺 수업 모드로 열기
          </Link>
          <button type="button" onClick={() => window.print()} className="inline-flex min-h-[44px] items-center rounded-card border border-line bg-surface px-4 font-semibold">
            🖨 지도안 인쇄
          </button>
        </div>
      </div>

      <Card>
        {t.goal && (
          <p>
            <Label>학습 목표</Label> <span className="ml-1">{t.goal}</span>
          </p>
        )}
        {t.prep && (
          <p className="mt-2">
            <Label tone="muted">준비물</Label> <span className="ml-1">{t.prep}</span>
          </p>
        )}
        {story && (
          <p className="mt-2 text-sm text-muted">
            여는 이야기: 「{story.levels[level].title}」 — 수업 처음 3~5분, 함께 읽거나 교사가 들려주세요.
          </p>
        )}
      </Card>

      {t.flow && t.flow.length > 0 && (
        <Card>
          <h2 className="text-lg font-bold">수업 흐름 ({total || lesson.minutes}분)</h2>
          <TableView
            table={{
              headers: ["단계", "시간", "활동", ...(t.flow.some((f) => f.note) ? ["지도 유의점"] : [])],
              rows: t.flow.map((f) => [f.step, `${f.min}분`, f.activity, ...(t.flow!.some((x) => x.note) ? [f.note ?? ""] : [])]),
            }}
          />
        </Card>
      )}

      {t.questions && t.questions.length > 0 && (
        <Card>
          <h2 className="text-lg font-bold">핵심 발문</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {t.questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </Card>
      )}

      {answers.length > 0 && (
        <Card>
          <h2 className="text-lg font-bold">활동 예시 답</h2>
          <ul className="mt-2 space-y-1.5">
            {answers.map((a, i) => (
              <li key={i} className="rounded-card bg-bg px-3 py-2">
                <Rich text={a} />
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-muted">학생의 답이 달라도 이유가 분명하면 인정해 주세요.</p>
        </Card>
      )}

      {t.tip && (
        <section className="rounded-card border-l-8 border-accent bg-accent-soft p-5">
          <p className="font-bold text-accent">지도 팁</p>
          <p className="mt-1">
            <Rich text={t.tip} />
          </p>
        </section>
      )}

      {t.background && (
        <Card>
          <h2 className="text-lg font-bold">교사를 위한 배경 지식</h2>
          <p className="mt-2">
            <Rich text={t.background} />
          </p>
        </Card>
      )}

      {t.extension && t.extension.length > 0 && (
        <Card>
          <h2 className="text-lg font-bold">확장 활동 아이디어</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {t.extension.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </Card>
      )}

      {t.faq && t.faq.length > 0 && (
        <Card>
          <h2 className="text-lg font-bold">학생들이 자주 하는 질문</h2>
          <dl className="mt-2 space-y-3">
            {t.faq.map((f, i) => (
              <div key={i}>
                <dt className="font-semibold">Q. {f.q}</dt>
                <dd className="text-muted">A. {f.a}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      <nav className="no-print grid grid-cols-2 gap-3">
        {prev ? (
          <Link to={`/prompt/${level}/teacher/${prev}`} className="rounded-card border border-line bg-surface p-3 hover:border-accent">
            ← {prev}차시 지도안
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link to={`/prompt/${level}/teacher/${next}`} className="rounded-card border border-line bg-surface p-3 text-right hover:border-accent">
            {next}차시 지도안 →
          </Link>
        )}
      </nav>
    </div>
  );
}
