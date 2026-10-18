// 옛 *.logic.ts 17개를 모두 불러와 새 체험 도구와 연결되는지 확인해요(옛 파일은 고치지 않아요).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { LEGACY_WIDGETS, NEW_WIDGETS } from "./_paths.ts";
import { WIDGET_IDS } from "../../src/shared/widgets/ids.ts";

import * as Bayes from "../../../src/aimath/widgets/Bayes.logic.ts";
import * as BigData from "../../../src/aimath/widgets/BigData.logic.ts";
import * as Bow from "../../../src/aimath/widgets/Bow.logic.ts";
import * as Cosine from "../../../src/aimath/widgets/Cosine.logic.ts";
import * as Flow from "../../../src/aimath/widgets/Flow.logic.ts";
import * as Gradient from "../../../src/aimath/widgets/Gradient.logic.ts";
import * as ImgTransform from "../../../src/aimath/widgets/ImgTransform.logic.ts";
import * as Knn from "../../../src/aimath/widgets/Knn.logic.ts";
import * as Pixels from "../../../src/aimath/widgets/Pixels.logic.ts";
import * as Regression from "../../../src/aimath/widgets/Regression.logic.ts";
import * as RuleVsLearn from "../../../src/aimath/widgets/RuleVsLearn.logic.ts";
import * as Sentiment from "../../../src/aimath/widgets/Sentiment.logic.ts";
import * as Tangent from "../../../src/aimath/widgets/Tangent.logic.ts";
import * as Tfidf from "../../../src/aimath/widgets/Tfidf.logic.ts";
import * as Truth from "../../../src/aimath/widgets/Truth.logic.ts";
import * as Turing from "../../../src/aimath/widgets/Turing.logic.ts";
import * as VecOps from "../../../src/aimath/widgets/VecOps.logic.ts";

/** 새 id → 옛 파일 이름 */
const FILE: Record<string, string> = {
  turing: "Turing", rulevslearn: "RuleVsLearn", bigdata: "BigData", bow: "Bow", tfidf: "Tfidf", cosine: "Cosine",
  sentiment: "Sentiment", pixels: "Pixels", imgtransform: "ImgTransform", knn: "Knn", bayes: "Bayes",
  regression: "Regression", gradient: "Gradient", truth: "Truth", flow: "Flow", vecops: "VecOps", tangent: "Tangent",
};
const MODS: Record<string, Record<string, unknown>> = {
  Bayes, BigData, Bow, Cosine, Flow, Gradient, ImgTransform, Knn, Pixels, Regression, RuleVsLearn, Sentiment, Tangent, Tfidf, Truth, Turing, VecOps,
};

test("체험 도구 id 17개가 옛 types.ts 의 WidgetId 와 같아요", () => {
  const src = readFileSync(join(LEGACY_WIDGETS, "..", "types.ts"), "utf8");
  const m = src.match(/export type WidgetId =([\s\S]*?);/);
  assert.ok(m, "WidgetId 정의를 찾았어요");
  const ids = (m[1].match(/"([a-z]+)"/g) || []).map((s) => s.slice(1, -1));
  assert.deepEqual(ids.slice().sort(), WIDGET_IDS.slice().sort());
  assert.equal(WIDGET_IDS.length, 17);
});

test("옛 widgets/index.ts 등록과도 같아요", () => {
  const src = readFileSync(join(LEGACY_WIDGETS, "index.ts"), "utf8");
  const keys = (src.match(/^\s+([a-z]+): lazy/gm) || []).map((s) => s.trim().split(":")[0]);
  assert.deepEqual(keys.slice().sort(), WIDGET_IDS.slice().sort());
});

test("옛 *.logic.ts 17개를 모두 불러와요(import 없이 순수 로직)", () => {
  const files = readdirSync(LEGACY_WIDGETS).filter((f) => /\.logic\.ts$/.test(f));
  assert.equal(files.length, 17);
  for (const id of WIDGET_IDS) {
    const name = FILE[id];
    assert.ok(name, id + " 의 옛 파일 이름");
    assert.ok(files.indexOf(name + ".logic.ts") >= 0, name + ".logic.ts 가 있어요");
    const mod = MODS[name];
    assert.ok(mod && Object.keys(mod).length > 0, name + " 에서 내보낸 것이 있어요");
    const src = readFileSync(join(LEGACY_WIDGETS, name + ".logic.ts"), "utf8");
    assert.doesNotMatch(src, /^\s*import\s/m, name + ".logic.ts 는 다른 파일을 import 하지 않아요");
  }
});

test("새 도구 폴더마다 index.tsx 와 mission.ts 가 있고, 옛 로직은 @legacy 로만 가져와요", () => {
  for (const id of WIDGET_IDS) {
    const dir = join(NEW_WIDGETS, id);
    assert.ok(existsSync(join(dir, "index.tsx")), id + "/index.tsx");
    assert.ok(existsSync(join(dir, "mission.ts")), id + "/mission.ts");
    const src = readFileSync(join(dir, "index.tsx"), "utf8");
    assert.match(src, new RegExp('from "@legacy/widgets/' + FILE[id] + '\\.logic"'), id + " 는 옛 계산을 그대로 써요");
    const imports = src.match(/from "([^"]+)"/g) || [];
    for (const im of imports) {
      const spec = im.slice(6, -1);
      if (spec.indexOf("@legacy/") === 0) assert.match(spec, /^@legacy\/widgets\/[A-Za-z]+\.logic$/, id + ": @legacy 는 *.logic 만");
      assert.doesNotMatch(spec, /teacher|student/, id + ": 학생·교사 폴더를 가져오지 않아요");
    }
    const mission = readFileSync(join(dir, "mission.ts"), "utf8");
    assert.doesNotMatch(mission, /from "(react|@legacy)/, id + "/mission.ts 는 순수해요");
  }
});

test("옛 계산 몇 가지가 수학적으로 맞아요", () => {
  // 베이즈: 질병 1%, 민감도 90%, 위양성 9% → 약 9.2%
  const post = Bayes.posterior(0.01, 0.9, 0.09) as number;
  assert.ok(Math.abs(post - 0.0092 / (0.0092 - 0.0002 + 0.0891 + 0.0001)) < 0.01);
  assert.ok(Math.abs(post - 0.009 / (0.009 + 0.0891)) < 1e-12);
  const c = Bayes.splitCounts(0.2, 0.8, 0.1, 1000);
  assert.equal(c.ab + c.anb + c.nab + c.nanb, 1000);
  // 코사인: (3,4)·(4,3) = 24, |a||b| = 25
  assert.ok(Math.abs((Cosine.cosine([3, 4], [4, 3]).cos as number) - 0.96) < 1e-12);
  assert.equal(Cosine.cosine([1, 0], [0, 1]).cos, 0);
  // 회귀: 완전한 직선 y = 2x + 1
  const st = Regression.computeStats([{ x: 0, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 5 }]);
  assert.ok(Math.abs((st.a as number) - 2) < 1e-12 && Math.abs((st.b as number) - 1) < 1e-12);
  // 벡터: |(3,4)| = 5
  assert.equal(VecOps.norm([3, 4]), 5);
  // 순서도: 1+…+5 = 15
  assert.equal(Flow.checkBlank(5, "le").ok, true);
  assert.equal(Flow.checkBlank(5, "lt").ok, false);
  // 접선: x² 의 a=1 에서 기울기 2
  assert.equal(Tangent.tangentLine(Tangent.FUNCTIONS[0], 1).m, 2);
  // 진리표: 4줄
  assert.equal(Truth.truthRows().length, 4);
  // 큰 표본(고르게)은 진짜 평균 근처
  assert.ok(Math.abs(BigData.mean(BigData.sample(10000, 1, false)) - BigData.TRUE_MEAN) < 1.5);
});
