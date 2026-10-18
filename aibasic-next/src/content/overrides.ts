// data/overrides/tone.json 을 읽어 덧씌워요. 파일이 아직 없으면 아무것도 바꾸지 않아요.
import type { ToneFile } from "../shared/contracts.ts";
import { applyTone, chipsFor } from "./tone.ts";

const found = import.meta.glob<ToneFile>("../../data/overrides/tone.json", { eager: true, import: "default" });
const keys = Object.keys(found);
export const TONE: ToneFile | null = keys.length ? found[keys[0]] : null;

/**
 * 레슨 id("u2_1_3") 또는 단원("u2") 문서에 tone.json 의 정확 일치 문장 치환을 덧씌워요.
 * 인공지능 기초는 원본이 이미 해요체이고 시험 문제 말투(~한다)는 원문 그대로 보여 주는 것이 약속이라서
 * 문장 끝 규칙 변환(haeyoDoc)은 쓰지 않아요(규칙 코드는 tone.ts 에 남아 있어요). 학생 화면과 칠판이 같은 함수를 거쳐요.
 */
export function overlay<T>(doc: T, where: string): T {
  return applyTone(doc, where, TONE);
}

/** 이 글자에 붙일 칩("가상의 예" 등). path 는 문서 안 경로(예 "sections.0.blocks.2.text") */
export function chips(where: string, path: string, text: string): string[] {
  return chipsFor(TONE, where, path, text);
}
