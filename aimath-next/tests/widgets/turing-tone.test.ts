// 튜링 체험 대답 말투(해요체) 고치기 시험: 화면 문장만 바뀌고 정답·순서는 그대로예요.
import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { LEGACY_WIDGETS } from "./_paths.ts";
import { TURING_TONE, toneLine, toneRound } from "../../src/shared/widgets/turing/tone.ts";

const legacy = () => import(join(LEGACY_WIDGETS, "Turing.logic.ts"));

test("기계 대답의 합쇼체·거친 말이 화면에서 모두 해요체로 바뀌어요", async () => {
  const T = await legacy();
  for (let g = 1; g <= 40; g++) {
    for (const r of T.buildGame(g, 8).map(toneRound)) {
      for (const s of [r.a, r.b, r.tell]) {
        assert.doesNotMatch(s, /(습니다|합니다|입니다|하세요\.)/, s);
        assert.doesNotMatch(s, /열받아/, s);
      }
    }
  }
  assert.equal(toneLine("농담 모드를 실행합니다. 웃음은 건강에 좋습니다. 다른 요청이 있으신가요?"), "농담 모드를 실행해요. 웃음은 건강에 좋아요. 다른 요청이 있으신가요?");
});

test("고친 표는 원본 문장과 정확히 맞아야 해요(원본이 바뀌면 알려 줘요)", async () => {
  const T = await legacy();
  const all = new Set<string>();
  for (let g = 1; g <= 60; g++) for (const r of T.buildGame(g, 8)) [r.a, r.b, r.tell].forEach((s: string) => all.add(s));
  for (const from of Object.keys(TURING_TONE)) assert.ok(all.has(from), "원본에 없는 문장: " + from);
});

test("toneRound 는 정답(machineIs)과 질문 순서를 바꾸지 않아요", async () => {
  const T = await legacy();
  const rs = T.buildGame(3, 8);
  const ts = rs.map(toneRound);
  assert.deepEqual(
    ts.map((r: { machineIs: string }) => r.machineIs),
    rs.map((r: { machineIs: string }) => r.machineIs),
  );
  assert.equal(T.scoreGame(ts, ["A", "B", "A", "B", "A", "B", "A", "B"]), T.scoreGame(rs, ["A", "B", "A", "B", "A", "B", "A", "B"]));
});
