import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Code } from "./kit";

/** 보드 꼭지의 길: 프로용(토큰 적게 — 스크립트가 일하고 AI는 막힐 때만) · 맥스용(자세히 — AI가 한 단계씩) */
export type BoardMode = "pro" | "max";
const KEY = "board-mode";

type Ctx = { mode: BoardMode | null; setMode: (m: BoardMode) => void; openPicker: () => void };
const ModeCtx = createContext<Ctx>({ mode: null, setMode: () => {}, openPicker: () => {} });
export const useBoardMode = () => useContext(ModeCtx);

function readSaved(): BoardMode | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "pro" || v === "max" ? v : null;
  } catch {
    return null;
  }
}

export function BoardModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<BoardMode | null>(readSaved);
  const [picker, setPicker] = useState<boolean>(() => readSaved() === null);
  const setMode = (m: BoardMode) => {
    setModeState(m);
    setPicker(false);
    try {
      localStorage.setItem(KEY, m);
    } catch {
      /* 저장이 막혀 있어도 이번 방문에는 쓴다 */
    }
  };
  return (
    <ModeCtx.Provider value={{ mode, setMode, openPicker: () => setPicker(true) }}>
      {children}
      {picker && <ModePicker onPick={setMode} onClose={() => setPicker(false)} current={mode} />}
    </ModeCtx.Provider>
  );
}

const CARDS: { m: BoardMode; title: string; who: string; how: string[] }[] = [
  {
    m: "pro",
    title: "프로용 · 토큰 적게",
    who: "Claude Pro 처럼 AI 사용량이 넉넉하지 않을 때",
    how: ["키트의 스크립트 한 줄이 설치·자료 올리기·빌드·굽기를 차례로 해요", "AI는 막혔을 때 빨간 줄 몇 개만 붙여 넣어 물어봐요", "짧은 작업지시서(약 1,600자)"],
  },
  {
    m: "max",
    title: "맥스용 · 자세히",
    who: "Claude Max 처럼 사용량이 넉넉하거나, 원리까지 알고 싶을 때",
    how: ["AI가 단계마다 실행하고 결과를 확인해요", "핀·화면 설정·자료 구조까지 같이 봐요", "자세한 작업지시서(약 7,400자)"],
  },
];

function ModePicker({ onPick, onClose, current }: { onPick: (m: BoardMode) => void; onClose: () => void; current: BoardMode | null }) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    first.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="mode-title">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-card border border-line bg-surface p-5 shadow-xl sm:p-7">
        <p className="text-sm font-semibold tracking-widest text-accent">시작하기 전에</p>
        <h2 id="mode-title" className="mt-1 text-2xl font-extrabold tracking-tight">어떤 길로 따라 할까요?</h2>
        <p className="mt-2 text-muted">AI(Claude 등) 사용량에 맞춰 골라 주세요. 고른 길에 맞춰 이 사이트의 안내가 바뀌고, 위쪽에서 언제든 바꿀 수 있어요.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {CARDS.map((c, i) => (
            <button
              key={c.m}
              ref={i === 0 ? first : undefined}
              type="button"
              onClick={() => onPick(c.m)}
              className={`flex h-full flex-col rounded-card border-2 p-4 text-left transition hover:-translate-y-0.5 hover:border-accent hover:shadow-md ${
                current === c.m ? "border-accent bg-accent-soft" : "border-line bg-bg"
              }`}
            >
              <span className="text-lg font-extrabold">{c.title}</span>
              <span className="mt-1 text-sm font-semibold text-accent">{c.who}</span>
              <ul className="mt-3 space-y-1 text-[0.95rem]">
                {c.how.map((h) => (
                  <li key={h} className="flex gap-2">
                    <span aria-hidden className="text-accent">•</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
              <span className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-card bg-accent px-4 font-semibold text-accent-ink">이 길로 보기</span>
            </button>
          ))}
        </div>
        <button type="button" onClick={onClose} className="mt-4 min-h-[44px] text-sm font-semibold text-muted underline hover:text-ink">
          고르지 않고 그냥 둘러볼게요
        </button>
      </div>
    </div>
  );
}

/** 위쪽 막대의 '지금 길' 단추 */
export function ModeSwitch() {
  const { mode, openPicker } = useBoardMode();
  return (
    <button
      type="button"
      onClick={openPicker}
      className="flex min-h-[44px] shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-line bg-bg px-3 text-sm font-semibold hover:border-accent"
      aria-label="따라 할 길 바꾸기"
    >
      {mode === "pro" ? "프로용" : mode === "max" ? "맥스용" : "길 고르기"}
      <span aria-hidden className="text-muted">▾</span>
    </button>
  );
}

/** 프로용 3단계(첫 쪽·PC 준비·처음 굽기에서 함께 쓴다) */
export function ProPath({ compact }: { compact?: boolean }) {
  return (
    <section className="mt-2 max-w-3xl rounded-card border-2 border-accent bg-accent-soft p-4 sm:p-5">
      <p className="font-extrabold">프로용 · 이렇게만 하면 돼요 {compact ? "" : "(7인치·7인치 B)"}</p>
      <ol className="mt-3 space-y-3">
        <li>
          <b>1.</b> <Link to="/board#download" className="font-semibold text-accent underline">키트</Link>를 <code>C:\dev\board-kit</code> 처럼 영문 폴더에 풀고, 보드를{" "}
          <b>‘UART’</b> 단자에 데이터 케이블로 꽂아요.
        </li>
        <li>
          <b>2.</b> PowerShell 에서 한 줄 실행 — 프로그램 확인·샘플 자료·Firebase 올리기(로그인은 직접)·내 값·빌드·굽기를 차례로 물어보며 해요.
          <Code>{`powershell -ExecutionPolicy Bypass -File C:\\dev\\board-kit\\7inch\\tools\\quick_start.ps1`}</Code>
        </li>
        <li>
          <b>3.</b> 보드 화면 <b>[설정] → [찾기]</b> 에서 와이파이를 넣어요. 막히면 빨간 X 줄 몇 개만{" "}
          <Link to="/board/brief" className="font-semibold text-accent underline">프로용 작업지시서</Link>와 함께 AI에게 붙여 넣어요.
        </li>
      </ol>
    </section>
  );
}
