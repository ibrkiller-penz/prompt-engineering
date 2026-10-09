import { useEffect, useRef, useState } from "react";
import { Board, GButton, Say, Stat, cheer, rand, stageClear, useStage } from "./kit";
import { GENESIS, bitDiff, blockHash, chainStatus, chunks4, hashLevel, mine, mineChain, sha256Hex } from "./hash.logic";

const hue = (chunk: string) => (parseInt(chunk, 16) / 65536) * 360;

/** 해시를 4글자씩 색 블록으로 */
function Strip({ hex, other, small }: { hex: string; other?: string; small?: boolean }) {
  const cs = chunks4(hex);
  const oc = other ? chunks4(other) : [];
  return (
    <div className="grid grid-cols-8 gap-1" aria-hidden="true">
      {cs.map((c, i) => {
        const diff = other !== undefined && oc[i] !== c;
        return (
          <span
            key={i}
            className={`flex items-center justify-center rounded font-mono ${small ? "h-5 text-[0.55rem]" : "h-8 text-[0.7rem]"} text-white ${diff ? "outline outline-2 outline-offset-1 outline-[var(--ink)]" : ""}`}
            style={{ background: `hsl(${hue(c)} 60% 42%)` }}
          >
            {small ? "" : c}
          </span>
        );
      })}
    </div>
  );
}

const SWAP = "abcdefghijklmnopqrstuvwxyz0123456789가나다라마바사아자차";
const ORIGINAL = ["영희가 철수에게 1000원", "철수가 민수에게 300원", "민수가 지아에게 500원", "지아가 영희에게 200원"];

function Lab() {
  const [text, setText] = useState("hello");
  const [cur, setCur] = useState("");
  const [prev, setPrev] = useState("");
  const [changes, setChanges] = useState(0);
  const [msg, setMsg] = useState<{ t: string; tone: "info" | "ok" | "bad" }>({ t: "글을 바꿔 보세요. ‘글자 하나 바꾸기’를 누르면 한 글자만 바뀐 두 지문을 비교해 줘요.", tone: "info" });
  const last = useRef("");

  useEffect(() => {
    let live = true;
    sha256Hex(text).then((h) => {
      if (!live) return;
      setPrev(last.current);
      last.current = h;
      setCur(h);
    });
    return () => {
      live = false;
    };
  }, [text]);

  const oneChar = () => {
    const chars = Array.from(text || "hello");
    const i = rand(chars.length);
    let n = chars[i];
    while (n === chars[i]) n = Array.from(SWAP)[rand(SWAP.length)];
    chars[i] = n;
    setText(chars.join(""));
    setChanges((c) => c + 1);
  };

  // 한 글자 바꾸기 직후에만 결과 말풍선을 갱신
  useEffect(() => {
    if (prev && cur && prev !== cur) {
      const b = bitDiff(prev, cur);
      setMsg({ t: `바뀐 비트 ${b} / 256 (${Math.round((b / 256) * 100)}%). 글이 거의 같아도 지문은 절반쯤 달라져요!`, tone: b > 80 ? "ok" : "info" });
    }
  }, [prev, cur]);

  const bits = prev && cur ? bitDiff(prev, cur) : 0;
  return (
    <Board className="space-y-3">
      <h3 className="font-extrabold">1. 글의 지문(해시) 만들기</h3>
      <label className="block text-sm font-semibold">
        <span className="mb-1 block">글을 써 보세요</span>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={60} className="min-h-[44px] w-full rounded-card border border-line bg-bg px-3 text-base" aria-label="해시를 만들 글" />
      </label>
      <div>
        <p className="mb-1 text-xs text-muted">SHA-256 해시 (256비트 = 16진수 64글자)</p>
        <p className="break-all rounded-card bg-bg p-2 font-mono text-xs" aria-label="해시 값">{cur || "…"}</p>
        {cur && (
          <div className="mt-2">
            <p className="mb-1 text-xs text-muted">4글자씩 색 블록으로 본 지문</p>
            <Strip hex={cur} />
          </div>
        )}
      </div>
      {prev && cur && prev !== cur && (
        <div className="rounded-card border border-line p-2">
          <p className="mb-1 text-xs text-muted">바로 앞 지문(위)과 지금 지문(아래) · 테두리가 있는 블록이 달라진 곳</p>
          <Strip hex={prev} small />
          <div className="mt-1"><Strip hex={cur} other={prev} small /></div>
          <div className="mt-2">
            <div className="h-3 overflow-hidden rounded-full bg-bg" role="img" aria-label={`바뀐 비트 ${bits} / 256`}>
              <div className="h-full bg-accent" style={{ width: `${(bits / 256) * 100}%` }} />
            </div>
            <p className="mt-1 text-sm">바뀐 비트 <strong>{bits}</strong> / 256 = <strong>{((bits / 256) * 100).toFixed(1)}%</strong></p>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <GButton variant="primary" onClick={oneChar}>🔀 글자 하나 바꾸기</GButton>
        <GButton onClick={() => { setText("hello"); }}>처음 글로</GButton>
        <Stat label="바꿔 본 횟수" value={changes} />
      </div>
      <Say tone={msg.tone}>{msg.t}</Say>
    </Board>
  );
}

const ORIGINAL6 = [...ORIGINAL, "영희가 민수에게 700원", "철수가 지아에게 100원"];

function Chain() {
  const stage = useStage();
  const cfg = hashLevel(stage);
  const { zeros } = cfg;
  const base = ORIGINAL6.slice(0, cfg.blocks);
  const pickTarget = () => cfg.lo + rand(cfg.hi - cfg.lo + 1);
  const [round, setRound] = useState(1);
  const [target, setTarget] = useState(pickTarget);
  const [chain, setChain] = useState(() => mineChain(base, zeros));
  const [mined, setMined] = useState(0);
  const [won, setWon] = useState(false);
  const [msg, setMsg] = useState<{ t: string; tone: "info" | "ok" | "bad" }>(() => ({
    t: `라운드 1: ${target + 1}번 블록 내용을 고친 뒤, 체인을 다시 모두 이어 보세요(‘다시 채굴’).`,
    tone: "info",
  }));
  const status = chainStatus(chain, zeros);
  const firstBad = status.findIndex((s) => s !== "ok");
  const valid = firstBad < 0;

  useEffect(() => {
    if (!won) return;
    const id = window.setTimeout(() => {
      if (round >= 3) stageClear();
      else {
        const tg = pickTarget();
        setRound(round + 1);
        setTarget(tg);
        setChain(mineChain(base, zeros));
        setWon(false);
        setMsg({ t: `라운드 ${round + 1}: 이번엔 ${tg + 1}번 블록을 고치고 체인을 다시 이어 보세요.`, tone: "info" });
      }
    }, round >= 3 ? 1200 : 1800);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won]);

  const check = (next: typeof chain, extra: string) => {
    const st = chainStatus(next, zeros);
    if (st.every((s) => s === "ok")) {
      if (next[target].content !== base[target] && !won) {
        setWon(true);
        cheer();
        setMsg({ t: round >= 3 ? "레벨 클리어! 고친 블록 뒤를 줄줄이 다시 채굴해야 해서 옛 기록을 몰래 고치기는 힘들어요." : `성공! ${target + 1}번 블록을 고치고도 체인을 다시 이었어요. 곧 다음 라운드!`, tone: "ok" });
      } else setMsg({ t: `${extra} 체인이 모두 이어졌어요. 퀘스트는 ${target + 1}번 블록 내용을 고치는 거예요.`, tone: "ok" });
    } else setMsg({ t: `${extra} 아직 끊긴 블록이 있어요.`, tone: "info" });
  };

  const edit = (i: number, content: string) => {
    if (won) return;
    const next = chain.map((b, k) => (k === i ? { ...b, content } : b));
    setChain(next);
    const st = chainStatus(next, zeros);
    const fb = st.findIndex((s) => s !== "ok");
    setMsg(fb < 0 ? { t: "내용이 같아서 체인이 그대로 이어져 있어요.", tone: "info" } : { t: `${i + 1}번 블록을 고치자 ${fb + 1}번 블록부터 끊겼어요! 해시가 달라져서 뒤 블록이 가리키는 값과 안 맞아요.`, tone: "bad" });
  };

  const remine = (i: number) => {
    if (won) return;
    const prev = i === 0 ? GENESIS : blockHash(i - 1, chain[i - 1]);
    const r = mine(i, chain[i].content, prev, zeros);
    const next = chain.map((b, k) => (k === i ? { ...b, prev, nonce: r.nonce } : b));
    setChain(next);
    setMined((m) => m + r.tries);
    check(next, `${i + 1}번 블록 채굴! nonce=${r.nonce} (${r.tries}번 시도).`);
  };

  const remineAll = () => {
    if (won) return;
    const next = mineChain(chain.map((b) => b.content), zeros);
    setChain(next);
    check(next, "모든 블록을 다시 채굴했어요.");
  };

  const reset = () => {
    setChain(mineChain(base, zeros));
    setWon(false);
    setMsg({ t: `처음 체인으로 되돌렸어요. ${target + 1}번 블록을 고쳐 보세요.`, tone: "info" });
  };

  return (
    <Board className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-extrabold">2. 블록 체인 이어 보기</h3>
        <span className="font-game rounded-full bg-accent px-4 py-1 text-lg text-white">레벨 {stage} · 라운드 {round}/3</span>
      </div>
      <p className="text-sm text-muted">각 블록은 ‘앞 블록의 해시’를 품고 있어요. 해시가 <strong>{"0".repeat(zeros)}</strong>로 시작하면 유효해요. 맞는 숫자(nonce)를 찾는 일이 ‘채굴’이에요. 레벨이 오를수록 블록이 늘고, 앞자리 0이 늘어나고, 앞쪽 블록을 고쳐야 해요.</p>
      <div className="flex flex-wrap items-center gap-2">
        <Stat label="고칠 블록" value={`${target + 1}번`} tone="bad" />
        <Stat label="규칙" value={`0 ${zeros}개`} />
        <Stat label="채굴 시도" value={mined} />
      </div>
      <ol className="grid gap-3 md:grid-cols-2">
        {chain.map((b, i) => {
          const h = blockHash(i, b);
          const bad = firstBad >= 0 && i >= firstBad;
          const st = status[i];
          return (
            <li key={i} className={`rounded-card border-2 p-3 text-sm ${bad ? "border-bad bg-bad-soft/40" : i === target ? "border-accent bg-surface" : "border-line bg-surface"}`}>
              <div className="mb-2 flex items-center justify-between">
                <strong>블록 {i + 1}{i === target ? " 🎯" : ""}</strong>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${st === "ok" ? (bad ? "bg-bad-soft text-bad" : "bg-ok-soft text-ok") : "bg-bad-soft text-bad"}`}>
                  {st === "ok" ? (bad ? "⚠ 앞이 끊겨 있어요" : "✔ 이어짐") : st === "link" ? "✖ 끊김: 앞 해시가 달라요" : "✖ 끊김: 해시 조건 불만족"}
                </span>
              </div>
              <label className="block">
                <span className="text-xs text-muted">내용 (고쳐 보세요)</span>
                <input value={b.content} maxLength={40} onChange={(e) => edit(i, e.target.value)} className="mt-0.5 min-h-[44px] w-full rounded-card border border-line bg-bg px-2" aria-label={`블록 ${i + 1} 내용`} />
              </label>
              <p className="mt-2 text-xs text-muted">앞 블록 해시</p>
              <p className={`break-all font-mono text-[0.7rem] ${st === "link" ? "text-bad" : ""}`}>{b.prev === GENESIS ? "0000…0000 (처음)" : b.prev.slice(0, 20) + "…"}</p>
              <p className="mt-1 text-xs text-muted">nonce <strong className="text-ink">{b.nonce}</strong> · 내 해시</p>
              <p className="break-all font-mono text-[0.7rem]"><span className={h.startsWith("0".repeat(zeros)) ? "font-extrabold text-ok" : "font-extrabold text-bad"}>{h.slice(0, zeros)}</span>{h.slice(zeros, 20)}…</p>
              <div className="mt-1"><Strip hex={h} small /></div>
              <GButton variant={st === "ok" && !bad ? "ghost" : "primary"} className="mt-2 w-full" onClick={() => remine(i)}>⛏ 다시 채굴</GButton>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap gap-2">
        {cfg.allButton && <GButton onClick={remineAll}>모두 다시 채굴</GButton>}
        <GButton onClick={reset}>다시 하기</GButton>
      </div>
      <Say tone={msg.tone}>{valid && msg.tone === "bad" ? "체인이 이어졌어요." : msg.t}</Say>
    </Board>
  );
}

export default function HashGame() {
  return (
    <div className="space-y-4">
      <Lab />
      <Chain />
    </div>
  );
}
