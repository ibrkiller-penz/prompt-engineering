// 휴대폰·칠판에서 직접 눌러 본 미션 길이 계산으로도 맞는지, 그리고 그때 고친 부분이 되돌아가지 않았는지 지켜요.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LEGACY_WIDGETS, NEW_WIDGETS } from "./_paths.ts";
import { runJudge } from "../../src/shared/widgets/mission.types.ts";
import { mission as knnMission } from "../../src/shared/widgets/knn/mission.ts";
import { mission as regMission } from "../../src/shared/widgets/regression/mission.ts";
import { mission as gradMission } from "../../src/shared/widgets/gradient/mission.ts";
import { mission as vecMission } from "../../src/shared/widgets/vecops/mission.ts";
import { mission as cosMission } from "../../src/shared/widgets/cosine/mission.ts";
import { stepValue } from "../../src/shared/widgets/stepper.logic.ts";

const legacy = (name: string) => import(join(LEGACY_WIDGETS, name + ".logic.ts"));
const src = (rel: string) => readFileSync(join(NEW_WIDGETS, rel), "utf8");

test("k-NN '예시 자리'(5, 5.5)는 k=1 과 k=5 의 답이 갈려서 미션 힌트가 돼요", async () => {
  const K = await legacy("Knn");
  const at = { x: 5, y: 5.5 };
  const w1 = K.classify(K.PRESET_POINTS, at, 1, "euclid", K.CLASS_NAMES.length).winner;
  const w5 = K.classify(K.PRESET_POINTS, at, 5, "euclid", K.CLASS_NAMES.length).winner;
  assert.ok(runJudge(knnMission, "kFlip", { k: 3, winner: w5, winnerK1: w1, winnerK5: w5 }));
  assert.match(src("knn/index.tsx"), /setQ\(\{ x: 5, y: 5\.5 \}\)/);
});

test("회귀: 스테퍼만으로(기울기 +8칸, 절편 −15칸) 미션 closeFit 에 닿아요", async () => {
  const R = await legacy("Regression");
  const pts = R.PRESETS.positive;
  let a = 0.5;
  let b = 2;
  for (let i = 0; i < 8; i++) a = stepValue(a, 1, 0.05, -3, 3);
  for (let i = 0; i < 15; i++) b = stepValue(b, -1, 0.1, -5, 12);
  const st = R.computeStats(pts);
  assert.ok(runJudge(regMission, "closeFit", { n: pts.length, mine: true, mySse: R.sseFor(pts, a, b), bestSse: st.sse }));
});

test("경사하강법: 학습률을 0.5 로 올리면 기본 함수에서 한 걸음에 도착해요(미션 fast)", async () => {
  const G = await legacy("Gradient");
  const f = G.FUNCTIONS[0];
  const ws = [f.defaultStart, G.stepOnce(f, f.defaultStart, 0.5).wNew];
  const status = G.classify(f, ws);
  assert.ok(runJudge(gradMission, "fast", { status, steps: 1, eta: 0.5 }));
});

test("벡터 거리 5, 코사인 0 미션은 스테퍼 몇 번으로 만들 수 있어요", async () => {
  const V = await legacy("VecOps");
  const d = V.describe("dist", [3, 2], [3, -3], 1);
  assert.ok(runJudge(vecMission, "dist5", { op: "dist", vector: d.vector, scalar: d.scalar }));
  const C = await legacy("Cosine");
  assert.ok(runJudge(cosMission, "orthogonal", { mode: "vec", cos: C.cosine([3, 4], [4, -3]).cos }));
});

test("칠판에서 줄어든 무대(scale) 안의 그림 폭은 배치 폭(clientWidth)으로 재요", () => {
  assert.match(src("Plot.tsx"), /el\.clientWidth \|\| el\.getBoundingClientRect\(\)\.width/);
});

test("KaTeX svg(벡터 화살표·근호)는 공용 base.css 전역 규칙이 지켜요(도구 안 국소 규칙은 없애요)", () => {
  const css = src("widgets.css");
  assert.doesNotMatch(css, /\.wg-host \.katex svg/);
  const base = readFileSync(join(NEW_WIDGETS, "..", "..", "styles", "base.css"), "utf8");
  assert.match(base, /\.katex svg \{\s*max-width: none;\s*overflow: hidden;/);
  assert.match(src("kit.tsx"), /import "katex\/dist\/katex\.min\.css"/);
});
