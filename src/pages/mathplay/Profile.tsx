import { useEffect, useState } from "react";
import { GAMES } from "./games/registry";
import { AVATARS, rankOf, starsOf, streak, totalStars, update, useSave, type Save } from "./progress";

type Badge = { icon: string; name: string; how: string; ok: (s: Save) => boolean };
const has = (s: Save, ids: string[]) => ids.every((id) => starsOf(s.wins[id]) >= 1);
const byFloor = (f: string) => GAMES.filter((g) => g.floor === f && g.level === "elem").map((g) => g.id);

export const BADGES: Badge[] = [
  { icon: "⭐", name: "첫 별", how: "아무 게임에서 별 1개", ok: (s) => totalStars(s) >= 1 },
  { icon: "🧭", name: "탐험가", how: "게임 3가지 해 보기", ok: (s) => Object.keys(s.plays).length >= 3 },
  { icon: "🗺️", name: "모험가", how: "게임 10가지 해 보기", ok: (s) => Object.keys(s.plays).length >= 10 },
  { icon: "🌟", name: "별 수집가", how: "별 20개 모으기", ok: (s) => totalStars(s) >= 20 },
  { icon: "🎈", name: "놀이 마당 정복", how: "1층 게임마다 별 1개 이상", ok: (s) => has(s, byFloor("play")) },
  { icon: "🚀", name: "미래 연구소 정복", how: "2층 게임마다 별 1개 이상", ok: (s) => has(s, byFloor("future")) },
  { icon: "🏛️", name: "박물관 정복", how: "3층 게임마다 별 1개 이상", ok: (s) => has(s, byFloor("classic")) },
  { icon: "🧩", name: "퍼즐 왕", how: "퍼즐 3가지 모두 별 받기", ok: (s) => has(s, ["calendar", "tetromino", "colorsquare"]) },
  { icon: "🔥", name: "3일 연속", how: "3일 연속 놀기", ok: (s) => streak(s) >= 3 },
  { icon: "🔟", name: "레벨 10", how: "아무 게임이나 레벨 10까지 깨기", ok: (s) => Object.values(s.levels ?? {}).some((n) => n >= 10) },
  { icon: "🎓", name: "도전자", how: "중·고 도전 게임에서 별 받기", ok: (s) => GAMES.some((g) => g.level === "upper" && starsOf(s.wins[g.id]) >= 1) },
];

/** 내 프로필: 캐릭터·이름·등급·배지. 기록은 이 기기에만 저장된다. */
export default function Profile({ onClose }: { onClose: () => void }) {
  const s = useSave();
  const [name, setName] = useState(s.name);
  const total = totalStars(s);
  const r = rankOf(total);
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="내 프로필" onClick={onClose}>
      <div className="gz-pop max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-[#fff8ef] p-5 shadow-2xl sm:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-game text-3xl text-[#2b2340]">내 프로필</h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="flex h-12 w-12 items-center justify-center rounded-full bg-[#ff4d6d] text-2xl font-black text-white shadow-[0_3px_0_0_rgba(0,0,0,0.25)]">
            ✕
          </button>
        </div>

        <div className="mt-4 flex items-center gap-4 rounded-3xl bg-white p-4 shadow-[0_4px_0_0_rgba(0,0,0,0.06)]">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#ffd166] to-[#ff8a5b] text-5xl shadow-[0_4px_0_0_rgba(0,0,0,0.12)]">{s.avatar}</span>
          <div className="min-w-0 flex-1">
            <label className="block">
              <span className="text-xs font-semibold text-[#6b6280]">내 이름(별명)</span>
              <input
                value={name}
                maxLength={8}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => update((x) => ({ ...x, name: name.trim() }))}
                placeholder="별명을 써요"
                className="font-game mt-1 min-h-[44px] w-full rounded-2xl border-2 border-[#ece4ff] bg-[#fffaf3] px-3 text-xl outline-none focus:border-[#7b61ff]"
              />
            </label>
            <p className="mt-2 text-sm font-semibold text-[#6b6280]">
              {r.icon} {r.name} · ⭐ {total}
            </p>
          </div>
        </div>

        <p className="font-game mt-5 text-lg text-[#2b2340]">캐릭터 고르기</p>
        <div className="mt-2 grid grid-cols-6 gap-2">
          {AVATARS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => update((x) => ({ ...x, avatar: a }))}
              aria-pressed={s.avatar === a}
              className={`flex aspect-square items-center justify-center rounded-2xl text-3xl shadow-[0_3px_0_0_rgba(0,0,0,0.08)] transition active:translate-y-[2px] ${s.avatar === a ? "bg-[#7b61ff] ring-4 ring-[#c4b5fd]" : "bg-white"}`}
            >
              {a}
            </button>
          ))}
        </div>

        <div className="mt-5 rounded-3xl bg-white p-4 shadow-[0_4px_0_0_rgba(0,0,0,0.06)]">
          <p className="font-game text-lg text-[#2b2340]">
            {r.icon} {r.name}
            {r.next ? ` → ${r.next.icon} ${r.next.name}` : " · 최고 등급!"}
          </p>
          <div className="mt-2 h-4 overflow-hidden rounded-full bg-[#f1ecff]">
            <div className="h-full rounded-full bg-gradient-to-r from-[#ffd166] to-[#ff5e7e]" style={{ width: `${r.pct}%` }} />
          </div>
          <p className="mt-1 text-sm text-[#6b6280]">{r.next ? `별 ${r.next.at - total}개 더 모으면 등급이 올라가요!` : "모든 등급을 다 올랐어요!"}</p>
        </div>

        <p className="font-game mt-5 text-lg text-[#2b2340]">🏅 배지 {BADGES.filter((b) => b.ok(s)).length}/{BADGES.length}</p>
        <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {BADGES.map((b) => {
            const ok = b.ok(s);
            return (
              <li key={b.name} className={`rounded-2xl p-3 text-center shadow-[0_3px_0_0_rgba(0,0,0,0.06)] ${ok ? "bg-gradient-to-br from-[#fff1b8] to-[#ffd6e7]" : "bg-white opacity-60 grayscale"}`}>
                <span className="text-3xl">{b.icon}</span>
                <p className="font-game mt-1 text-[#2b2340]">{b.name}</p>
                <p className="text-xs text-[#6b6280]">{ok ? "받았어요!" : b.how}</p>
              </li>
            );
          })}
        </ul>

        <p className="mt-5 text-xs text-[#6b6280]">기록은 이 기기의 브라우저에만 저장돼요. 다른 기기나 선생님에게 보내지 않아요.</p>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("별과 배지 기록을 모두 지울까요?")) {
              update(() => ({ v: 1, wins: {}, plays: {}, levels: {}, recent: [], days: [], today: { date: "", wins: [] }, avatar: s.avatar, name: s.name }));
            }
          }}
          className="mt-2 min-h-[44px] text-sm font-semibold text-[#6b6280] underline underline-offset-4"
        >
          기록 지우기
        </button>
      </div>
    </div>
  );
}
