import { useMemo, useState } from "react";
import { Board, GButton, Say, Stat, rand } from "./kit";
import { PRIMES_SHOWN, eCandidates, isPrime, lockNums, modInverse, numToLetter, smallestFactor, textToNums, unlockNums } from "./rsa.logic";

type Msg = { t: string; tone: "info" | "ok" | "bad" };
const WORDS = ["SUN", "MATH", "STAR", "CODE", "LOVE", "KEY", "MOON", "BOOK"];
const PR = PRIMES_SHOWN.filter(isPrime);

const numsLine = (a: number[]) => a.join(" · ");
const lettersOf = (a: number[]) => a.map(numToLetter).join("");

function newFriend() {
  const p = PR[rand(PR.length)];
  let q = PR[rand(PR.length)];
  while (q === p) q = PR[rand(PR.length)];
  const es = eCandidates((p - 1) * (q - 1), 6);
  return { n: p * q, e: es[rand(es.length)] };
}

export default function RsaGame() {
  const [p, setP] = useState<number | null>(11);
  const [q, setQ] = useState<number | null>(13);
  const [slot, setSlot] = useState<"p" | "q">("p");
  const [e, setE] = useState<number | null>(null);
  const [dGuess, setDGuess] = useState<number | null>(null);
  const [text, setText] = useState("HI");
  const [keyMsg, setKeyMsg] = useState<Msg>({ t: "소수 p 와 q 를 골라 보세요. 소수가 아닌 수는 눌러도 고를 수 없어요.", tone: "info" });
  const [labMsg, setLabMsg] = useState<Msg | null>(null);

  // 퀘스트
  const [friend, setFriend] = useState(newFriend);
  const [qi, setQi] = useState(0);
  const [sendText, setSendText] = useState("");
  const [sent, setSent] = useState(false);
  const [showPlain, setShowPlain] = useState(false);
  const [answer, setAnswer] = useState("");
  const [done2, setDone2] = useState(false);
  const [wins, setWins] = useState(0);
  const [tries, setTries] = useState(0);
  const [qMsg, setQMsg] = useState<Msg>({ t: "친구의 공개 열쇠로 글을 잠가 보내고, 내게 온 암호문을 내 비밀 열쇠로 풀어 봐요.", tone: "info" });

  const n = p && q ? p * q : 0;
  const phi = p && q ? (p - 1) * (q - 1) : 0;
  const eList = useMemo(() => (phi ? eCandidates(phi, 8) : []), [phi]);
  const inv = useMemo(() => (e && phi ? modInverse(e, phi) : null), [e, phi]);
  const d = inv ? inv.d : 0;
  const ready = !!(n && e && d);

  const pick = (v: number) => {
    if (!isPrime(v)) {
      setKeyMsg({ t: `${v}은(는) 소수가 아니에요. ${smallestFactor(v)} × ${v / smallestFactor(v)} 로 쪼개져요.`, tone: "bad" });
      return;
    }
    if (slot === "p") {
      if (v === q) return setKeyMsg({ t: "p 와 q 는 서로 다른 소수여야 해요.", tone: "bad" });
      setP(v);
      setSlot("q");
    } else {
      if (v === p) return setKeyMsg({ t: "p 와 q 는 서로 다른 소수여야 해요.", tone: "bad" });
      setQ(v);
      setSlot("p");
    }
    setE(null);
    setDGuess(null);
    setKeyMsg({ t: `소수 ${v}을(를) 골랐어요. 둘을 다 고르면 공개 지수 e 를 골라 보세요.`, tone: "info" });
    newQuest(false);
  };

  const chooseE = (v: number) => {
    setE(v);
    setDGuess(null);
    const r = modInverse(v, phi);
    setKeyMsg({ t: `e=${v} 를 골랐어요. 확장 유클리드 호제법으로 비밀 지수 d=${r.d} 를 찾았어요! (${v} × ${r.d} 를 φ=${phi} 로 나누면 나머지가 1이에요)`, tone: "ok" });
    newQuest(false);
  };

  function newQuest(count = true) {
    if (count) setQMsg({ t: "새 문제예요. 친구의 열쇠가 바뀌었어요.", tone: "info" });
    setFriend(newFriend());
    setQi((x) => x + 1);
    setSendText("");
    setSent(false);
    setShowPlain(false);
    setAnswer("");
    setDone2(false);
  }

  const nums = textToNums(text);
  const lockedOk = ready && nums && nums.length > 0 ? lockNums(nums, e!, n) : null;
  const dEff = dGuess ?? d;
  const opened = lockedOk ? unlockNums(lockedOk, dEff, n) : null;
  const same = opened && nums ? opened.every((x, i) => x === nums[i]) : false;

  // 퀘스트 계산
  const target = WORDS[qi % WORDS.length];
  const sendNums = textToNums(sendText);
  const friendCipher = sendNums && sendNums.length ? lockNums(sendNums, friend.e, friend.n) : null;
  const recvWord = WORDS[(qi + 3) % WORDS.length];
  const recvCipher = ready ? lockNums(textToNums(recvWord)!, e!, n) : null;
  const recvPlain = ready && recvCipher ? unlockNums(recvCipher, d, n) : null;

  const doSend = () => {
    setTries((t) => t + 1);
    if (!sendNums) return setQMsg({ t: "영어 알파벳만 써 주세요.", tone: "bad" });
    if (sendText.toUpperCase() !== target) return setQMsg({ t: `보낼 글은 ${target} 예요. 글을 맞게 써서 잠가 주세요.`, tone: "bad" });
    setSent(true);
    setQMsg({ t: `잠금 성공! 암호문 ${numsLine(friendCipher!)} 을 친구에게 보냈어요. 이제 내게 온 암호문을 풀어 봐요.`, tone: "ok" });
  };
  const doAnswer = () => {
    setTries((t) => t + 1);
    if (answer.trim().toUpperCase() === recvWord) {
      setDone2(true);
      setWins((w) => w + 1);
      setQMsg({ t: `성공! 암호문을 풀어 ‘${recvWord}’ 를 읽었어요. 공개 열쇠로 잠근 글은 비밀 열쇠를 가진 사람만 열 수 있어요.`, tone: "ok" });
    } else setQMsg({ t: "아니에요. ‘내 비밀 열쇠로 풀기’를 눌러 숫자를 글자로 바꿔 읽어 보세요.", tone: "bad" });
  };

  return (
    <div className="space-y-4">
      <Board className="space-y-3">
        <h3 className="font-extrabold">1. 열쇠 만들기</h3>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setSlot("p")} aria-pressed={slot === "p"} className={`min-h-[44px] rounded-card border px-4 font-bold ${slot === "p" ? "border-accent bg-accent-soft ring-2 ring-accent" : "border-line"}`}>p = {p ?? "?"}</button>
          <button type="button" onClick={() => setSlot("q")} aria-pressed={slot === "q"} className={`min-h-[44px] rounded-card border px-4 font-bold ${slot === "q" ? "border-accent bg-accent-soft ring-2 ring-accent" : "border-line"}`}>q = {q ?? "?"}</button>
          <span className="text-sm text-muted">지금 고르는 것: <strong className="text-ink">{slot}</strong> (아래 수를 누르세요)</span>
        </div>
        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-9 md:grid-cols-12" role="group" aria-label="11부터 47까지의 수. 소수만 고를 수 있어요">
          {PRIMES_SHOWN.map((v) => {
            const pr = isPrime(v);
            const on = v === p || v === q;
            return (
              <button
                key={v}
                type="button"
                onClick={() => pick(v)}
                aria-disabled={!pr}
                aria-label={pr ? `${v} 소수` : `${v} 소수가 아님`}
                className={`min-h-[44px] rounded-card border font-bold tabular-nums ${on ? "border-accent bg-accent text-accent-ink" : pr ? "border-line bg-surface hover:bg-accent-soft" : "cursor-not-allowed border-transparent bg-bg text-muted line-through opacity-50"}`}
              >
                {v}
              </button>
            );
          })}
        </div>
        {n > 0 && (
          <div className="space-y-2 text-sm">
            <p>n = p × q = {p} × {q} = <strong>{n}</strong></p>
            <p>φ = (p−1) × (q−1) = {p! - 1} × {q! - 1} = <strong>{phi}</strong></p>
            <div>
              <p className="mb-1 font-semibold">공개 지수 e 고르기 <span className="font-normal text-muted">(φ와 서로소인 수)</span></p>
              <div className="flex flex-wrap gap-1.5">
                {eList.map((v) => (
                  <button key={v} type="button" onClick={() => chooseE(v)} aria-pressed={e === v} className={`min-h-[44px] min-w-[44px] rounded-card border px-3 font-bold tabular-nums ${e === v ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface hover:bg-accent-soft"}`}>{v}</button>
                ))}
              </div>
            </div>
          </div>
        )}
        {inv && e && (
          <div className="rounded-card bg-bg p-3 text-sm">
            <p className="mb-1 font-bold">비밀 지수 d 찾기 (확장 유클리드 호제법)</p>
            <EuTable e={e} phi={phi} />
            <p className="mt-2">그래서 d = <strong>{d}</strong>. 확인: e × d = {e} × {d} = {e * d} = {Math.floor((e * d) / phi)} × {phi} + <strong>{(e * d) % phi}</strong></p>
            <p className="mt-2 rounded-card bg-surface p-2 text-center font-bold">공개 열쇠 (n, e) = ({n}, {e}) · 비밀 열쇠 (n, d) = ({n}, {d})</p>
          </div>
        )}
        <Say tone={keyMsg.tone}>{keyMsg.t}</Say>
      </Board>

      <Board className="space-y-3">
        <h3 className="font-extrabold">2. 글 잠그고 풀기</h3>
        {!ready ? (
          <p className="text-sm text-muted">먼저 위에서 p, q, e 를 골라 열쇠를 만들어 주세요.</p>
        ) : (
          <>
            <label className="block text-sm font-semibold">
              <span className="mb-1 block">보낼 글 (영어 알파벳, A=1 … Z=26)</span>
              <input value={text} onChange={(ev) => { setText(ev.target.value); setLabMsg(null); }} maxLength={8} className="min-h-[44px] w-full rounded-card border border-line bg-bg px-3 text-base uppercase" aria-label="잠글 글" />
            </label>
            {text && !nums && <Say tone="bad">영어 알파벳만 쓸 수 있어요. (한글·숫자·빈칸은 아직 안 돼요)</Say>}
            {nums && lockedOk && (
              <div className="space-y-2 text-sm">
                <p>글자 → 숫자 m: <strong>{numsLine(nums)}</strong> <span className="text-muted">(모두 n={n} 보다 작아요)</span></p>
                <p>잠그기 c = m<sup>{e}</sup> mod {n}: <strong className="text-accent">{numsLine(lockedOk)}</strong></p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">풀 때 쓰는 d</span>
                  <GButton onClick={() => setDGuess(Math.max(1, dEff - 1))} title="d 하나 줄이기">−</GButton>
                  <input type="number" min={1} value={dEff} onChange={(ev) => setDGuess(Math.max(1, Math.floor(+ev.target.value || 1)))} className="min-h-[44px] w-24 rounded-card border border-line bg-bg px-2 text-center font-bold" aria-label="풀 때 쓰는 비밀 지수 d" />
                  <GButton onClick={() => setDGuess(dEff + 1)} title="d 하나 늘리기">+</GButton>
                  <GButton variant="soft" onClick={() => setDGuess(null)}>진짜 d 로</GButton>
                </div>
                <p>풀기 c<sup>d</sup> mod {n}: <strong>{numsLine(opened!)}</strong> → <strong className={same ? "text-ok" : "text-bad"}>{lettersOf(opened!)}</strong></p>
                <Say tone={same ? "ok" : "bad"}>{same ? "원래 글이 나왔어요! 맞는 비밀 지수로 풀었기 때문이에요." : `엉뚱한 값이 나왔어요. d=${dEff} 는 진짜 비밀 지수(${d})가 아니에요. 비밀 지수를 모르면 풀 수 없어요.`}</Say>
              </div>
            )}
            {labMsg && <Say tone={labMsg.tone}>{labMsg.t}</Say>}
          </>
        )}
      </Board>

      <Board className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-extrabold">3. 퀘스트: 친구와 비밀 편지</h3>
          <div className="flex flex-wrap gap-2"><Stat label="성공" value={wins} tone={wins ? "ok" : "plain"} /><Stat label="확인 횟수" value={tries} /></div>
        </div>
        {!ready ? (
          <p className="text-sm text-muted">1번에서 열쇠를 먼저 만들어 주세요.</p>
        ) : (
          <>
            <div className="rounded-card bg-bg p-3 text-sm">
              <p className="font-bold">① 친구의 공개 열쇠로 잠가 보내기</p>
              <p className="mt-1">친구의 공개 열쇠 (n, e) = (<strong>{friend.n}</strong>, <strong>{friend.e}</strong>) · 보낼 글: <strong>{target}</strong></p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input value={sendText} onChange={(ev) => setSendText(ev.target.value)} maxLength={8} disabled={sent} placeholder={target} className="min-h-[44px] w-40 rounded-card border border-line bg-surface px-3 uppercase" aria-label="친구에게 보낼 글" />
                <GButton variant="primary" onClick={doSend} disabled={sent}>🔒 잠가서 보내기</GButton>
              </div>
              {friendCipher && <p className="mt-2">잠근 암호문: <strong className="text-accent">{numsLine(friendCipher)}</strong></p>}
            </div>
            <div className={`rounded-card bg-bg p-3 text-sm ${sent ? "" : "opacity-50"}`}>
              <p className="font-bold">② 내게 온 암호문 풀기</p>
              <p className="mt-1">친구가 내 공개 열쇠 ({n}, {e}) 로 잠가 보낸 암호문: <strong className="text-accent">{numsLine(recvCipher!)}</strong></p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <GButton onClick={() => setShowPlain(true)} disabled={!sent}>🔑 내 비밀 열쇠로 풀기</GButton>
                {showPlain && sent && <span>풀면 숫자 <strong>{numsLine(recvPlain!)}</strong> → 글자로 바꿔 보세요</span>}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input value={answer} onChange={(ev) => setAnswer(ev.target.value)} maxLength={8} disabled={!sent || done2} placeholder="읽은 글" className="min-h-[44px] w-40 rounded-card border border-line bg-surface px-3 uppercase" aria-label="풀어서 읽은 글" />
                <GButton variant="primary" onClick={doAnswer} disabled={!sent || done2}>답 확인</GButton>
              </div>
            </div>
          </>
        )}
        <Say tone={qMsg.tone}>{qMsg.t}</Say>
        <div className="flex flex-wrap gap-2">
          <GButton onClick={() => newQuest(true)}>새 문제</GButton>
          <GButton onClick={() => { setSendText(""); setSent(false); setShowPlain(false); setAnswer(""); setDone2(false); setQMsg({ t: "다시 해 봐요.", tone: "info" }); }}>다시 하기</GButton>
        </div>
      </Board>

      <p className="rounded-card bg-accent-soft/60 p-3 text-sm">
        💡 여기서는 11~47 같은 작은 소수를 썼어요. <strong>진짜 RSA는 수백 자리 소수</strong>를 써요. 작은 수는 n 을 금방 쪼갤 수 있지만, 아주 큰 수를 쪼개는 일은 컴퓨터로도 매우 오래 걸린다고 알려져 있어요.
      </p>
    </div>
  );
}

function EuTable({ e, phi }: { e: number; phi: number }) {
  const { steps } = modInverse(e, phi);
  let a = phi,
    b = e;
  const rows = steps.map((s) => {
    const row = { a, b, q: s.q, r: s.r, t: s.t };
    a = b;
    b = s.r;
    return row;
  });
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[18rem] border-collapse text-center text-xs">
        <thead>
          <tr className="text-muted"><th className="p-1">나눗셈</th><th className="p-1">몫</th><th className="p-1">나머지</th><th className="p-1">계수 t</th></tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={`border-t border-line ${r.r === 1 ? "bg-accent-soft font-bold" : ""}`}>
              <td className="p-1 tabular-nums">{r.a} = {r.q} × {r.b} + {r.r}</td>
              <td className="p-1 tabular-nums">{r.q}</td>
              <td className="p-1 tabular-nums">{r.r}</td>
              <td className="p-1 tabular-nums">{r.t}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-xs text-muted">나머지가 1인 줄의 계수 t 가 e 의 ‘곱하면 1이 되는 짝’(역원)이에요. 음수면 φ 를 더해서 0 이상으로 만들어요.</p>
    </div>
  );
}
