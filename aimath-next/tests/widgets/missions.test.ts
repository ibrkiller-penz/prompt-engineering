// 미션 판정 함수 틀 시험(순수). 옛 계산 결과를 넣어 판정이 말이 되는지도 봐요.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NEXT_DIR } from "./_paths.ts";
import { WIDGET_IDS, isWidgetId } from "../../src/shared/widgets/ids.ts";
import { MISSIONS, hasJudge, judgeMission } from "../../src/shared/widgets/missions.ts";
import { TRUE_MEAN } from "../../src/shared/widgets/bigdata/mission.ts";

import * as BigData from "../../../src/aimath/widgets/BigData.logic.ts";
import * as Gradient from "../../../src/aimath/widgets/Gradient.logic.ts";
import * as Knn from "../../../src/aimath/widgets/Knn.logic.ts";
import * as Bayes from "../../../src/aimath/widgets/Bayes.logic.ts";
import * as Tfidf from "../../../src/aimath/widgets/Tfidf.logic.ts";
import * as VecOps from "../../../src/aimath/widgets/VecOps.logic.ts";
import * as Truth from "../../../src/aimath/widgets/Truth.logic.ts";
import * as Turing from "../../../src/aimath/widgets/Turing.logic.ts";
import * as ImgTransform from "../../../src/aimath/widgets/ImgTransform.logic.ts";

test("17종 모두 미션 묶음이 있고 기본 판정 이름이 실제로 있어요", () => {
  assert.deepEqual(Object.keys(MISSIONS).sort(), WIDGET_IDS.slice().sort());
  for (const id of WIDGET_IDS) {
    const set = MISSIONS[id];
    assert.ok(Object.keys(set.judges).length >= 1, id);
    assert.ok(hasJudge(id, set.def), id + " 의 기본 판정 " + set.def);
  }
  assert.equal(isWidgetId("knn"), true);
  assert.equal(isWidgetId("nope"), false);
});

test("모르는 이름은 기본 판정으로, 판정 중 오류는 false 로", () => {
  assert.equal(judgeMission("bow", "없는이름", { vocab: 3, inter: 2, union: 3 }), true);
  assert.equal(judgeMission("bow", undefined, { vocab: 3, inter: 0, union: 3 }), false);
  assert.equal(judgeMission("truth", "allCorrect", null), false);
  assert.equal(hasJudge("bow", "toString"), false);
});

test("bigdata: 고르게 많이 모으면 stable, 한쪽만 모으면 biasTrap", () => {
  assert.equal(TRUE_MEAN, BigData.TRUE_MEAN);
  const fair = BigData.mean(BigData.sample(10000, 1, false));
  const biased = BigData.mean(BigData.sample(10000, 1, true));
  assert.equal(judgeMission("bigdata", "stable", { n: 10000, biased: false, mean: fair }), true);
  assert.equal(judgeMission("bigdata", "stable", { n: 20, biased: false, mean: fair }), false);
  assert.equal(judgeMission("bigdata", "biasTrap", { n: 10000, biased: true, mean: biased }), true);
});

test("gradient: 옛 classify 결과로 converge·diverge 판정", () => {
  const fn = Gradient.FUNCTIONS[0];
  const good = Gradient.runSteps(fn, 0, 0.3, 30);
  assert.equal(judgeMission("gradient", "converge", { status: Gradient.classify(fn, good), steps: 30, eta: 0.3 }), true);
  const bad = Gradient.runSteps(fn, 0, 1.2, 10);
  assert.equal(judgeMission("gradient", "diverge", { status: Gradient.classify(fn, bad), steps: 10, eta: 1.2 }), true);
  assert.equal(judgeMission("gradient", "converge", { status: "start", steps: 0, eta: 0.1 }), false);
});

test("knn: k=1 과 k=5 의 답이 달라지는 자리가 실제로 있어요", () => {
  let found = false;
  for (let x = 0; x <= 10 && !found; x += 0.5)
    for (let y = 0; y <= 10 && !found; y += 0.5) {
      const q = { x, y };
      const w1 = Knn.classify(Knn.PRESET_POINTS, q, 1, "euclid", 3).winner;
      const w5 = Knn.classify(Knn.PRESET_POINTS, q, 5, "euclid", 3).winner;
      if (judgeMission("knn", "kFlip", { k: 1, winner: w1, winnerK1: w1, winnerK5: w5 })) found = true;
    }
  assert.ok(found, "0.5 간격 격자에 미션을 해낼 자리가 있어요");
});

test("bayes: 질병 검사 기본값이 곧 baseRate 미션", () => {
  const post = Bayes.posterior(0.01, 0.9, 0.09);
  const chain = Bayes.updateChain(0.01, 0.9, 0.09, 5);
  assert.equal(judgeMission("bayes", "baseRate", { prior: 0.01, hit: 0.9, fa: 0.09, post, chainLast: chain[0], repeats: 0 }), true);
  const n = chain.findIndex((p) => p >= 0.9);
  assert.ok(n >= 1, "B 가 몇 번 더 나오면 90% 를 넘어요");
  assert.equal(judgeMission("bayes", "update90", { prior: 0.01, hit: 0.9, fa: 0.09, post, chainLast: chain[n], repeats: n }), true);
});

test("tfidf: 모든 문서에 있는 '오늘'은 idf 0 → everywhere", () => {
  const docs = ["오늘 급식은 맛있는 카레 였다", "오늘 수업은 재미있는 수학 이었다", "오늘 급식은 카레 카레 카레 대신 돈가스 였다"].map(Tfidf.tokenize);
  const df = Tfidf.df(docs, "오늘");
  assert.equal(Tfidf.idf(docs.length, df), 0);
  assert.equal(judgeMission("tfidf", "everywhere", { N: 3, word: "오늘", df, topInAll: false }), true);
  assert.equal(judgeMission("tfidf", "everywhere", { N: 3, word: "카레", df: Tfidf.df(docs, "카레"), topInAll: true }), false);
});

test("vecops: (3,4) 와 (0,0) 사이 거리 5 → dist5, 크기 5 → norm5", () => {
  const d = VecOps.describe("dist", [3, 4], [0, 0], 1);
  assert.equal(judgeMission("vecops", "dist5", { op: "dist", vector: d.vector, scalar: d.scalar }), true);
  const n = VecOps.describe("norm", [3, -4], [0, 0], 1);
  assert.equal(judgeMission("vecops", "norm5", { op: "norm", vector: n.vector, scalar: n.scalar }), true);
  const s = VecOps.describe("add", [2, -1], [-2, 1], 1);
  assert.equal(judgeMission("vecops", "sumZero", { op: "add", vector: s.vector, scalar: s.scalar }), true);
});

test("truth: 정답을 모두 넣고 채점하면 allCorrect", () => {
  const ans = Truth.practiceAnswers(0);
  assert.equal(judgeMission("truth", "allCorrect", { graded: Truth.gradeCells(0, ans), checked: true }), true);
  assert.equal(judgeMission("truth", "allCorrect", { graded: Truth.gradeCells(0, ans), checked: false }), false);
  assert.equal(judgeMission("truth", "allCorrect", { graded: Truth.gradeCells(0, [null, null, null, null]), checked: true }), false);
});

test("turing: 끝까지 고르면 finish, 기계를 다 맞히면 score6", () => {
  const rounds = Turing.buildGame(1, 8);
  const picks = rounds.map((r) => r.machineIs);
  const score = Turing.scoreGame(rounds, picks);
  assert.equal(score, 8);
  assert.equal(judgeMission("turing", "score6", { answered: 8, total: 8, score }), true);
  assert.equal(judgeMission("turing", "finish", { answered: 7, total: 8, score: 7 }), false);
});

test("imgtransform: 좌우 대칭 두 번이면 처음으로 → backToStart", () => {
  const img = ImgTransform.PRESETS.smiley.img;
  const twice = ImgTransform.flipH(ImgTransform.flipH(img));
  const same = JSON.stringify(twice) === JSON.stringify(img);
  assert.equal(judgeMission("imgtransform", "backToStart", { ops: ["flipH", "flipH"], same }), true);
  assert.equal(judgeMission("imgtransform", "backToStart", { ops: ["flipH"], same: false }), false);
});

test("나머지 도구도 참·거짓 예를 하나씩", () => {
  assert.equal(judgeMission("cosine", "orthogonal", { mode: "vec", cos: 0 }), true);
  assert.equal(judgeMission("cosine", "orthogonal", { mode: "text", cos: 0 }), false);
  assert.equal(judgeMission("sentiment", "neutral", { matches: 2, total: 0, verdict: "중립", trickySeen: false }), true);
  assert.equal(judgeMission("pixels", "yellow", { cells: [[255, 255, 0]], gray: false }), true);
  assert.equal(judgeMission("pixels", "yellow", { cells: [[255, 255, 1]], gray: false }), false);
  assert.equal(judgeMission("regression", "closeFit", { n: 5, mine: true, mySse: 1.05, bestSse: 1 }), true);
  assert.equal(judgeMission("regression", "closeFit", { n: 5, mine: false, mySse: 1, bestSse: 1 }), false);
  assert.equal(judgeMission("rulevslearn", "learnBeats", { ruleAcc: 0.7, modelAcc: 0.9, epoch: 1 }), true);
  assert.equal(judgeMission("rulevslearn", "learnBeats", { ruleAcc: 0.7, modelAcc: 0.9, epoch: 0 }), false);
  assert.equal(judgeMission("flow", "blank", { preset: "sum", done: false, blankOk: true }), true);
  assert.equal(judgeMission("tangent", "close", { h: 0.01, avg: 2.01, slope: 2, showTan: true }), true);
  assert.equal(judgeMission("tangent", "close", { h: 0.1, avg: 2.1, slope: 2, showTan: true }), false);
});

test("data/widget-guides.json 이 있으면 미션 judge 이름이 모두 실제로 있어요", () => {
  const p = join(NEXT_DIR, "data", "widget-guides.json");
  if (!existsSync(p)) return; // 안내 데이터는 다른 담당이 써요. 생기면 자동으로 검사해요
  const raw = JSON.parse(readFileSync(p, "utf8"));
  const guides: Record<string, { mission?: { judge: string } }> = raw && raw.guides ? raw.guides : raw;
  for (const id of Object.keys(guides)) {
    if (!isWidgetId(id)) continue;
    const m = guides[id] && guides[id].mission;
    if (m) assert.ok(hasJudge(id, m.judge), `${id} 의 judge '${m.judge}' 가 ${id}/mission.ts 에 있어요`);
  }
});
