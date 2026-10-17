// 시간이 넘칠 때 '줄이기' 안내와 꺼진 장면 다시 켜기(오늘 수업·수업 흐름·준비 한 장 공용).
// 기본은 모든 장면을 켜 두고(자동으로 끄지 않아요), 교사가 '줄이기'를 누르면 제안된 장면만 꺼요.
import type { Scene } from "../../shared/contracts.ts";
import { sceneRoot, suggestCuts, type BuiltScene } from "../logic/index.ts";
import { toggleScene, type FlowState } from "../store/logic.ts";
import type { LessonPlanView } from "../shell/plan.ts";
import { overMin } from "./timebar.ts";

export const KIND_NAME: Record<Scene["kind"], string> = {
  question: "핵심 질문",
  story: "이야기",
  prereq: "먼저 알고 가요",
  concept: "개념",
  example: "예제",
  widget: "체험",
  problem: "칠판 문제",
  aiStory: "AI 이야기",
  summary: "정리",
  qr: "수업 끝(QR)",
};

const r05 = (x: number) => Math.round(x * 2) / 2;

export interface CutInfo {
  /** 넘친 분(overMin 기준: 0.5분 이하는 0) */
  over: number;
  /** '줄이기'를 누르면 끌 장면(뿌리 id 하나에 한 장면) */
  scenes: BuiltScene[];
  /** 줄인 뒤 예상 분 합 */
  after: number;
  /** 줄여도 남는 넘침 */
  left: number;
  /** 줄이면 숙제로 가는 문제 수 */
  toHw: number;
}

/** 넘침과 줄이기 제안. 교사가 직접 켠 장면은 제안에서 빼요 */
export function cutInfo(view: LessonPlanView, minutes: number, flowSt: FlowState | null | undefined): CutInfo {
  const over = overMin(view.total, minutes);
  if (over === 0) return { over: 0, scenes: [], after: view.total, left: 0, toHw: 0 };
  const sug = flowSt ? suggestCuts(view.scenes, minutes) : view.flow.suggest;
  const pinned = flowSt ? flowSt.on.map(sceneRoot) : [];
  const roots: string[] = [];
  const scenes: BuiltScene[] = [];
  for (const id of sug.dropped) {
    const root = sceneRoot(id);
    if (roots.indexOf(root) >= 0 || pinned.indexOf(root) >= 0) continue;
    const sc = view.scenes.filter((s) => s.on && sceneRoot(s.id) === root)[0];
    if (!sc || sc.required) continue;
    roots.push(root);
    scenes.push(sc);
  }
  return { over, scenes, after: sug.total, left: r05(sug.over), toHw: scenes.filter((s) => s.kind === "problem").length };
}

/** 처음 제안(교사가 고치기 전)에서 켜져 있던 장면(뿌리 id 기준) */
function baseOn(view: LessonPlanView): Record<string, boolean> {
  const base: Record<string, boolean> = {};
  for (const s of view.flow.scenes) {
    base[s.id] = s.on;
    const root = sceneRoot(s.id);
    if (base[root] === undefined) base[root] = s.on;
  }
  return base;
}

/** 장면 여러 개를 한꺼번에 켜거나 꺼요("이어서" 조각은 뿌리 id 로 함께) */
export function setScenes(cur: FlowState | null, view: LessonPlanView, list: readonly Scene[], on: boolean): FlowState | null {
  const base = baseOn(view);
  let next: FlowState | null = cur;
  const done: string[] = [];
  for (const sc of list) {
    const root = sceneRoot(sc.id);
    if (done.indexOf(root) >= 0) continue;
    done.push(root);
    next = toggleScene(next, root, on, { required: sc.required, defaultOn: base[root] });
  }
  return next;
}

/** 꺼진 장면(뿌리 id 하나에 한 줄, 화면 차례) */
export function offScenes(view: LessonPlanView): BuiltScene[] {
  const out: BuiltScene[] = [];
  const seen: string[] = [];
  for (const s of view.scenes) {
    if (s.on) continue;
    const root = sceneRoot(s.id);
    if (seen.indexOf(root) >= 0) continue;
    seen.push(root);
    out.push(s);
  }
  return out;
}

/** 장면 한 줄 이름: "체험 · 거리 재기" */
export function sceneName(sc: Scene): string {
  const t = sc.title ? String(sc.title).replace(/\s+/g, " ").trim() : "";
  const k = KIND_NAME[sc.kind];
  // 제목이 이미 종류 이름으로 시작하면(예: "예제 2 · …", "이야기 한 장면") 겹쳐 쓰지 않아요
  if (!t) return k;
  if (t.indexOf(k) === 0 || t.indexOf(k.replace(/\(.*\)/, "")) === 0) return t;
  return k + " · " + t;
}
