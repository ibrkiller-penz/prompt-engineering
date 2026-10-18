// 숫자 키패드에 보일 기호 키를 '정답 유형' 기준으로 걸러요(지문에 분수가 나온다는 이유만으로는 '/' 를 보이지 않아요).
import type { Question } from "../contracts.ts";
import { isFractionValue, padSymbolsFor } from "../contracts.ts";

/** 정답이 분수로 적어야 하는 값인지(정수·소수 9자리 이하 유한소수는 아님. 무리수 √ 정답은 의도대로 소수 키와 √ 키로 적어요) */
export function isFractionAnswer(q: Question): boolean {
  if (q.type !== "number") return false;
  return isFractionValue(q.answer);
}

/** padSymbolsFor 결과에서 분수 키('/')를 정답이 분수일 때만 남겨요 */
export function padKeysForQuestion(q: Question): string[] {
  const keys = padSymbolsFor(q);
  return isFractionAnswer(q) ? keys : keys.filter((k) => k !== "/");
}
