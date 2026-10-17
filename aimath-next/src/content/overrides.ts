// data/overrides/tone.json 을 읽어 덧씌워요. 파일이 아직 없으면 아무것도 바꾸지 않아요.
import type { ToneFile } from "../shared/contracts.ts";
import { applyTone, chipsFor } from "./tone.ts";

const found = import.meta.glob<ToneFile>("../../data/overrides/tone.json", { eager: true, import: "default" });
const keys = Object.keys(found);
export const TONE: ToneFile | null = keys.length ? found[keys[0]] : null;

/** 레슨 id("u1-1") 또는 단원("u1") 문서에 해요체 치환을 적용해요 */
export function overlay<T>(doc: T, where: string): T {
  return applyTone(doc, where, TONE);
}

/** 이 글자에 붙일 칩("가상의 예" 등). path 는 문서 안 경로(예 "sections.0.blocks.2.text") */
export function chips(where: string, path: string, text: string): string[] {
  return chipsFor(TONE, where, path, text);
}
