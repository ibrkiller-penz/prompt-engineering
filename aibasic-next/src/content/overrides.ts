// data/overrides/tone.json 을 읽어 덧씌워요. 파일이 아직 없으면 아무것도 바꾸지 않아요.
import type { ToneFile } from "../shared/contracts.ts";
import { applyTone, chipsFor, haeyoDoc } from "./tone.ts";

const found = import.meta.glob<ToneFile>("../../data/overrides/tone.json", { eager: true, import: "default" });
const keys = Object.keys(found);
export const TONE: ToneFile | null = keys.length ? found[keys[0]] : null;

/**
 * 레슨 id("u1-1") 또는 단원("u1") 문서에 해요체를 덧씌워요.
 * 1) tone.json 의 정확 일치 문장 치환 → 2) 문제(practice·test)의 prompt·choices·hints·solution 문장 끝 규칙 변환.
 * 학생 화면과 칠판이 같은 함수를 거쳐서 같은 문장이 나와요.
 */
export function overlay<T>(doc: T, where: string): T {
  return haeyoDoc(applyTone(doc, where, TONE));
}

/** 이 글자에 붙일 칩("가상의 예" 등). path 는 문서 안 경로(예 "sections.0.blocks.2.text") */
export function chips(where: string, path: string, text: string): string[] {
  return chipsFor(TONE, where, path, text);
}
