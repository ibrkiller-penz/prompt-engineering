import { useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { LEVELS, availableLessons, levelMeta } from "../content/load";
import type { Level } from "../content/types";
import manifest from "./pdf-manifest.json";

// 사회 학습실(social-study)과 같은 「PDF로 저장하기」 창:
// ① 골라서 인쇄용 화면 열기  ② 미리 만든 PDF 바로 받기
const files = manifest as Record<string, { kb: number }>;
export const pdfUrl = (name: string) => `/pdf/prompt/${name}`;
export const lessonPdf = (level: Level, n: number) => `${level}-${String(n).padStart(2, "0")}.pdf`;
export const hasPdf = (name: string) => name in files;

const chip = (on: boolean) =>
  `inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${
    on ? "border-accent bg-accent-soft font-bold text-accent" : "border-line bg-bg text-ink"
  }`;

function Download({ name, title, desc }: { name: string; title: string; desc: string }) {
  if (!hasPdf(name)) return null;
  const meta = levelMeta(name.split("-")[0] as Level);
  return (
    <a
      href={pdfUrl(name)}
      download={`다시묻는AI교실_${meta.short}_${title.replace(/\s/g, "")}.pdf`}
      className="block rounded-lg border border-line bg-bg px-2.5 py-2 text-xs text-muted hover:border-accent"
    >
      <b className="block text-[13px] text-ink">{title}</b>
      {desc} · {files[name].kb}KB
    </a>
  );
}

export default function PdfDialog({ level: initLevel, lesson, onClose }: { level?: Level; lesson?: number; onClose: () => void }) {
  const nav = useNavigate();
  const firstReady = LEVELS.find((l) => availableLessons(l.id).length)?.id ?? "middle";
  const [level, setLevel] = useState<Level>(initLevel ?? firstReady);
  const ready = availableLessons(level);
  const [sel, setSel] = useState<number[]>(lesson ? [lesson] : ready);
  const [main, setMain] = useState<"lesson" | "sheet" | "none">("lesson");
  const [ans, setAns] = useState(false);

  const changeLevel = (l: Level) => {
    setLevel(l);
    setSel(availableLessons(l));
  };
  const toggle = (n: number) => setSel((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n].sort((a, b) => a - b)));

  const open = () => {
    const p = [main !== "none" ? main : "", ans ? "ans" : ""].filter(Boolean);
    if (!sel.length || !p.length) {
      alert("차시와 내용을 하나 이상 고르세요.");
      return;
    }
    const l = sel.length === ready.length ? "all" : sel.join(",");
    onClose();
    nav(`/prompt/print?level=${level}&l=${l}&p=${p.join(",")}`);
  };

  return createPortal(
    <div
      className="no-print fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="PDF로 저장하기"
    >
      <div className="max-h-[88vh] w-full max-w-[600px] overflow-auto rounded-t-2xl bg-surface p-5 pb-[calc(20px+env(safe-area-inset-bottom))] sm:rounded-2xl">
        <h3 className="text-lg font-bold">활동지 PDF 받기</h3>
        <p className="text-[13px] text-muted">
          내용을 고르면 A4 인쇄용 화면이 열려요. 인쇄 창에서 <b>「PDF로 저장」</b>을 고르세요. 아래에서 미리 만든 PDF를 바로 받을
          수도 있어요.
        </p>

        <div className="mb-1 mt-4 text-sm font-bold">학교급</div>
        <div className="flex flex-wrap gap-1.5">
          {LEVELS.map((l) => (
            <label key={l.id} className={chip(level === l.id)}>
              <input type="radio" checked={level === l.id} onChange={() => changeLevel(l.id)} className="accent-[var(--accent)]" />
              {l.name}
            </label>
          ))}
        </div>

        <div className="mb-1 mt-4 flex items-center gap-2 text-sm font-bold">
          차시
          {ready.length > 0 && (
            <button
              type="button"
              className="min-h-0 text-xs font-semibold text-accent underline"
              onClick={() => setSel(sel.length === ready.length ? [] : ready)}
            >
              {sel.length === ready.length ? "모두 풀기" : "모두 고르기"}
            </button>
          )}
        </div>
        {ready.length === 0 ? (
          <p className="text-sm text-muted">이 학교급은 아직 준비 중이에요.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {ready.map((n) => (
              <label key={n} className={chip(sel.includes(n))}>
                <input type="checkbox" checked={sel.includes(n)} onChange={() => toggle(n)} className="accent-[var(--accent)]" />
                {n}차시
              </label>
            ))}
          </div>
        )}

        <div className="mb-1 mt-4 text-sm font-bold">내용</div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["lesson", "차시 전체 (읽기 자료 + 활동)"],
              ["sheet", "활동지만"],
              ["none", "넣지 않음"],
            ] as const
          ).map(([v, t]) => (
            <label key={v} className={chip(main === v)}>
              <input type="radio" checked={main === v} onChange={() => setMain(v)} className="accent-[var(--accent)]" />
              {t}
            </label>
          ))}
        </div>
        <div className="mb-1 mt-3 text-sm font-bold">예시 답</div>
        <div className="flex flex-wrap gap-1.5">
          <label className={chip(ans)}>
            <input type="checkbox" checked={ans} onChange={() => setAns(!ans)} className="accent-[var(--accent)]" />
            예시 답(교사용)을 맨 뒤에 넣기
          </label>
        </div>

        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-line bg-bg py-3 font-bold">
            닫기
          </button>
          <button onClick={open} disabled={!ready.length} className="flex-1 rounded-xl bg-accent py-3 font-bold text-accent-ink disabled:opacity-40">
            인쇄용 화면 열기
          </button>
        </div>

        {ready.some((n) => hasPdf(lessonPdf(level, n))) && (
          <>
            <div className="mb-1 mt-6 text-sm font-bold">미리 만든 PDF 바로 받기 — {levelMeta(level).name}</div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              <Download name={`${level}-all.pdf`} title="전체 활동지" desc="열린 차시 모두" />
              <Download name={`${level}-answers.pdf`} title="예시 답 모음" desc="교사용" />
              {ready.map((n) => (
                <Download key={n} name={lessonPdf(level, n)} title={`${n}차시 활동지`} desc={levelMeta(level).lessons[n - 1]?.title ?? ""} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
