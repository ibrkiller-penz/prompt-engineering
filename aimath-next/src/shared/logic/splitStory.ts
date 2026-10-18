// 이야기(story) 문단을 카드로 나눠요. 문단 1개 = 카드 1장.
// 카드 안에서는 큰따옴표(“…”, "…")로 묶인 말을 말풍선으로, 나머지를 지문으로 나눠요.
// 말한 사람은 앞뒤 지문의 인물 이름으로 찾아요. 못 찾으면 who 가 null 이에요(말풍선은 그대로).
// 따옴표 짝이 안 맞는 등 나누기에 실패하면 원문을 지문 한 덩어리로 그대로 둬요(ok: false).
// 어떤 경우든 segs 의 raw 를 이으면 원래 문단과 글자 하나까지 같아요.

export type StorySeg =
  | { k: "narr"; raw: string; text: string }
  | { k: "say"; raw: string; text: string; who: string | null };

export interface StoryCard {
  /** story 배열에서의 위치 */
  idx: number;
  segs: StorySeg[];
  /** 말풍선 나누기에 성공했는지(실패하면 segs 는 원문 지문 한 개) */
  ok: boolean;
}

export interface SplitStoryOptions {
  /** 인물 이름 목록(긴 이름부터 맞춰 봐요) */
  names?: string[];
  /** 다른 이름 → 대표 이름(예: '선생님' → '유 선생님') */
  aliases?: Record<string, string>;
  /** 이름 없이 '화면·말풍선' 에서 나온 말을 한 사람(기본 '비트'). 빈 글자면 쓰지 않아요 */
  screenSpeaker?: string;
}

export const DEFAULT_NAMES = ["유 선생님", "선생님", "하은", "지후", "도윤", "서하", "비트"];
export const DEFAULT_ALIASES: Record<string, string> = { 선생님: "유 선생님" };

const OPEN_CLOSE: Record<string, string> = { "“": "”", '"': '"' };

/** 따옴표 단위로 자르기. 실패하면 null. */
function cut(p: string): { say: boolean; raw: string }[] | null {
  const out: { say: boolean; raw: string }[] = [];
  let i = 0;
  let start = 0;
  while (i < p.length) {
    const ch = p[i];
    const close = OPEN_CLOSE[ch];
    if (close !== undefined) {
      const j = p.indexOf(close, i + 1);
      if (j < 0) return null;
      if (i > start) out.push({ say: false, raw: p.slice(start, i) });
      out.push({ say: true, raw: p.slice(i, j + 1) });
      i = j + 1;
      start = i;
      continue;
    }
    if (ch === "”") return null; // 여는 따옴표 없이 닫힘
    i++;
  }
  if (start < p.length) out.push({ say: false, raw: p.slice(start) });
  return out;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface NameHit {
  name: string;
  at: number;
}

function makeFinder(names: string[]) {
  const sorted = names.slice().sort((a, b) => b.length - a.length);
  // 앞에 한글·숫자·영문이 붙지 않고, 뒤에 조사·공백·문장부호·끝이 오는 경우만 이름으로 봐요('8비트', '비트맵' 제외).
  const re = new RegExp(
    "(^|[^가-힣0-9A-Za-z])(" + sorted.map(escapeRe).join("|") + ")(?=[이가은는도의와과랑에께한]|\\s|[.,!?…·’'”\"*]|$)",
    "g",
  );
  return (s: string): NameHit[] => {
    const hits: NameHit[] = [];
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) {
      hits.push({ name: m[2], at: m.index + m[1].length });
      if (m[0].length === 0) re.lastIndex++;
    }
    return hits;
  };
}

const CITED_AFTER = /^\s*(?:이)?(?:라는|란\s|라고\s*(?:적|쓰|써|씌|떴|떠|나와|나온|붙|새겨|표시|되어|돼|찍))/;
const SCREEN_RE = /(화면|말풍선|모니터|스피커|알림)/;

function firstSentence(s: string): string {
  const m = s.match(/^[\s\S]*?[.!?](?=\s|$)/);
  return m ? m[0] : s;
}

/** 문장 단위로 마지막 문장(이름이 나올 때까지 거슬러 올라가지 않아요) */
function lastSentence(s: string): string {
  const t = s.replace(/\s+$/, "");
  const cutAt = Math.max(t.lastIndexOf(". ", t.length - 2), t.lastIndexOf("! ", t.length - 2), t.lastIndexOf("? ", t.length - 2));
  return cutAt >= 0 ? t.slice(cutAt + 2) : t;
}

export function splitStoryParagraph(p: string, idx = 0, opts: SplitStoryOptions = {}): StoryCard {
  const names = opts.names || DEFAULT_NAMES;
  const aliases = opts.aliases || DEFAULT_ALIASES;
  const find = makeFinder(names);
  const norm = (n: string | null): string | null => (n == null ? null : aliases[n] || n);
  const fail: StoryCard = { idx, ok: false, segs: [{ k: "narr", raw: p, text: p.trim() }] };

  const parts = cut(p);
  if (!parts) return fail;
  if (!parts.some((x) => x.say)) return { idx, ok: true, segs: [{ k: "narr", raw: p, text: p.trim() }] };

  const screen = opts.screenSpeaker === undefined ? "비트" : opts.screenSpeaker;
  const segs: StorySeg[] = [];
  let prevWho: string | null = null;
  for (let n = 0; n < parts.length; n++) {
    const part = parts[n];
    const prevSeg = segs.length ? segs[segs.length - 1] : null;
    const addNarr = (raw: string) => {
      // 지문끼리는 이어 붙여요(인용된 글이 지문에 섞일 때)
      if (prevSeg && prevSeg.k === "narr") {
        prevSeg.raw += raw;
        prevSeg.text = prevSeg.raw.trim();
      } else segs.push({ k: "narr", raw, text: raw.trim() });
    };
    if (!part.say) {
      addNarr(part.raw);
      continue;
    }
    const beforeRaw = n > 0 && !parts[n - 1].say ? parts[n - 1].raw : null;
    const before = beforeRaw && beforeRaw.trim() ? beforeRaw : null;
    const after = n + 1 < parts.length && !parts[n + 1].say ? parts[n + 1].raw : null;
    const afterFirst = after ? firstSentence(after) : "";

    // 쪽지·화면에 적힌 글을 따온 것(말이 아님)은 지문으로 둬요.
    const cited =
      (after && CITED_AFTER.test(after)) || (before && /(에는|에도|엔|에)\s*$/.test(before) && !find(lastSentence(before)).length);
    if (cited) {
      addNarr(part.raw);
      continue;
    }

    let who: string | null = null;
    // ① 뒤 지문이 '라고/하고/며' 로 이어지면 그 첫 문장 안의 이름
    if (after && /^\s*(라고|하고|라며|하며|며|이라고)/.test(after)) {
      const h = find(afterFirst);
      if (h.length) who = h[0].name;
    }
    // ② 앞 지문의 마지막 문장 → 앞 지문 전체에서 마지막으로 나온 이름
    if (!who && before) {
      const ls = find(lastSentence(before));
      if (ls.length) who = ls[ls.length - 1].name;
      else {
        const all = find(before);
        if (all.length) who = all[all.length - 1].name;
      }
    }
    // ③ 앞 지문이 없을 때(문단 맨 앞이거나 말이 이어질 때) 뒤 지문이 이름으로 시작하면 그 사람
    if (!who && !before && after) {
      const h = find(after);
      if (h.length && after.slice(0, h[0].at).trim() === "") who = h[0].name;
    }
    // ④ 그래도 없고 바로 앞이 말풍선이면 같은 사람이 말을 이어 가요
    const lastSay = segs.length && segs[segs.length - 1].k === "say" ? true : segs.length >= 2 && !segs[segs.length - 1].raw.trim();
    if (!who && !before && lastSay && prevWho) who = prevWho;
    // ⑤ 이름 없이 화면·말풍선에서 나온 말
    if (!who && screen && before && SCREEN_RE.test(lastSentence(before))) who = screen;
    const inner = part.raw.slice(1, -1).trim();
    if (prevSeg && prevSeg.k === "narr" && !prevSeg.raw.trim() && segs.length >= 2) {
      // 말풍선 사이의 빈 칸은 앞 말풍선 raw 에 붙여 둬요(빈 지문을 만들지 않게)
      segs.pop();
      segs[segs.length - 1].raw += prevSeg.raw;
    }
    who = norm(who);
    segs.push({ k: "say", raw: part.raw, text: inner, who });
    prevWho = who;
  }
  return { idx, ok: true, segs };
}

export function splitStory(story: readonly string[], opts: SplitStoryOptions = {}): StoryCard[] {
  return story.map((p, i) => splitStoryParagraph(p, i, opts));
}
