// 놀이 기록(별·등급·연속 출석·배지). 그 기기의 브라우저(localStorage)에만 저장한다.
import { useEffect, useState } from "react";

export type Save = {
  v: 1;
  wins: Record<string, number>; // 게임별 성공 횟수(cheer 가 불린 횟수)
  plays: Record<string, number>; // 게임별 시작 횟수
  recent: string[]; // 최근에 한 게임(앞이 최신)
  days: string[]; // 놀았던 날(YYYY-MM-DD)
  today: { date: string; wins: string[] }; // 오늘 성공한 게임
  avatar: string;
  name: string;
};

const KEY = "penedu:mathplay:save";
const EVT = "gz:save";
const blank = (): Save => ({ v: 1, wins: {}, plays: {}, recent: [], days: [], today: { date: "", wins: [] }, avatar: "🐣", name: "" });

export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function load(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...blank(), ...JSON.parse(raw) };
  } catch {
    /* 저장소를 못 쓰면 빈 기록 */
  }
  return blank();
}

function write(s: Save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* 무시 */
  }
  window.dispatchEvent(new Event(EVT));
}

export function update(fn: (s: Save) => Save) {
  write(fn(load()));
}

/** 기록을 읽고, 다른 곳에서 바뀌면 다시 그린다 */
export function useSave(): Save {
  const [s, setS] = useState<Save>(load);
  useEffect(() => {
    const h = () => setS(load());
    window.addEventListener(EVT, h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener(EVT, h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return s;
}

const markDay = (s: Save) => {
  const d = dayKey();
  return s.days.includes(d) ? s.days : [...s.days, d].slice(-60);
};

export function recordPlay(id: string) {
  update((s) => ({ ...s, plays: { ...s.plays, [id]: (s.plays[id] ?? 0) + 1 }, recent: [id, ...s.recent.filter((x) => x !== id)].slice(0, 8), days: markDay(s) }));
}

export function recordWin(id: string) {
  update((s) => {
    const d = dayKey();
    const today = s.today.date === d ? s.today : { date: d, wins: [] };
    return { ...s, wins: { ...s.wins, [id]: (s.wins[id] ?? 0) + 1 }, today: { date: d, wins: today.wins.includes(id) ? today.wins : [...today.wins, id] }, days: markDay(s) };
  });
}

/** 성공 횟수 → 별 0~3개 (1번 ★, 3번 ★★, 5번 ★★★) */
export const starsOf = (wins = 0) => (wins >= 5 ? 3 : wins >= 3 ? 2 : wins >= 1 ? 1 : 0);
export const totalStars = (s: Save) => Object.values(s.wins).reduce((a, w) => a + starsOf(w), 0);

/** 오늘까지 며칠 연속으로 놀았는지 */
export function streak(s: Save) {
  let n = 0;
  const d = new Date();
  if (!s.days.includes(dayKey(d))) d.setDate(d.getDate() - 1); // 오늘 아직 안 놀았으면 어제부터 센다
  while (s.days.includes(dayKey(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export const RANKS = [
  { at: 0, icon: "🐣", name: "새싹 탐험가" },
  { at: 5, icon: "🐥", name: "꼬마 수학자" },
  { at: 15, icon: "🦊", name: "재치 여우" },
  { at: 30, icon: "🦉", name: "지혜 부엉이" },
  { at: 50, icon: "🦄", name: "반짝 유니콘" },
  { at: 75, icon: "🐉", name: "수학 마스터" },
];
export function rankOf(stars: number) {
  let i = 0;
  RANKS.forEach((r, k) => {
    if (stars >= r.at) i = k;
  });
  const next = RANKS[i + 1];
  return { ...RANKS[i], next, pct: next ? Math.round(((stars - RANKS[i].at) / (next.at - RANKS[i].at)) * 100) : 100 };
}

export const AVATARS = ["🐣", "🐰", "🐻", "🐼", "🐯", "🦊", "🐨", "🐸", "🐧", "🐙", "🦖", "🐳"];
