// 규칙 기반 부탁 점검. 규칙은 content/prompt/rules/*.json에 있고, 여기서는 적용만 한다.
// 점수 대신 "잘한 점 1개 + 더 해 볼 것 1개"를 돌려준다.
import { rules } from "../content/load";

const re = (p: string) => new RegExp(p, "i");
const any = (text: string, patterns: string[]) => patterns.some((p) => re(p).test(text));

export function findPrivacy(text: string): string[] {
  return rules.privacy.patterns.filter((p) => re(p.regex).test(text)).map((p) => p.label);
}

export function findVague(text: string) {
  return rules.vague.words.filter((w) => {
    const word = w.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // '잘'처럼 다른 낱말 속에 자주 들어가는 짧은 말은 띄어 쓴 경우만 찾는다
    const pattern = (w as { whole?: boolean }).whole ? `(^|\\s)${word}(?=\\s|해|$)` : word;
    return re(pattern).test(text);
  });
}

export function findElements(text: string, extra?: Partial<Record<string, string[]>>) {
  return rules.elements.elements.map((e) => ({ ...e, found: any(text, [...e.patterns, ...(extra?.[e.id] ?? [])]) }));
}

export function findBonus(text: string) {
  return rules.elements.bonus.map((b) => ({ ...b, found: any(text, b.patterns) }));
}

export interface Feedback {
  good: string;
  next: string;
  privacy: string[];
  elements: ReturnType<typeof findElements>;
  vague: ReturnType<typeof findVague>;
  bonus: ReturnType<typeof findBonus>;
  count: number;
}

export function checkPrompt(text: string, extra?: Partial<Record<string, string[]>>): Feedback {
  const privacy = findPrivacy(text);
  const elements = findElements(text, extra);
  const vague = findVague(text);
  const bonus = findBonus(text);
  const count = elements.filter((e) => e.found).length;
  const missing = elements.filter((e) => !e.found);
  const restate = bonus.find((b) => b.id === "restate")!;
  const scope = bonus.find((b) => b.id === "scope")!;

  let good: string;
  const foundBonus = bonus.find((b) => b.found);
  if (foundBonus) good = foundBonus.praise;
  else if (count > 0)
    good = `${elements
      .filter((e) => e.found)
      .map((e) => `‘${e.label}’`)
      .join(", ")} 칸을 담았어요. AI가 짐작해야 할 부분이 줄어요.`;
  else if (text.trim().length > 0) good = "무엇을 만들고 싶은지 AI에게 한 줄로 말해 봤어요. 여기서부터 출발해요!";
  else good = "";

  let next: string;
  if (privacy.length) next = rules.privacy.message;
  else if (missing.length) next = `‘${missing[0].label}’ 칸이 아직 안 보여요. ${missing[0].hint}`;
  else if (vague.length) next = vague[0].tip;
  else if (!restate.found) next = restate.tip;
  else if (!scope.found) next = scope.tip;
  else next = "네 줄이 모두 들어 있어요. 이제 AI가 어떻게 알아들었는지 확인해 봐요.";

  return { good, next, privacy, elements, vague, bonus, count };
}
