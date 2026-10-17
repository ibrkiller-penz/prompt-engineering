// 그리기 시험(브라우저): 20레슨의 모든 블록 종류를 휴대폰(375, 글자 1·3단계)과 칠판(1920)에서 실제 부품으로 그려 봐요.
//   - 블록마다: KaTeX 오류 0 · 빈 그림 0 · 블록 상자 밖으로 삐져나감 0
//   - 칠판: 블록 하나가 장면 높이(852px)를 넘지 않아요(넘으면 장면을 나눠도 못 담아요)
//   - 블록 종류 9가지(p · math · table · term · callout · list · example · dialog · widget)가 모두 나와요
// 인쇄 미리 보기(print 미디어)도 재요: 학습지 · 정답지가 어두운 · 칠판 테마에서도 흑백이고 A4 폭을 넘지 않아요.
// playwright(전역 설치)가 없으면 건너뛰어요. 실행: node --test tests/shared/blocks-render.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadPlaywright, runBlocks } from "./render/run-blocks.mjs";
import { runPrint } from "./render/run-print.mjs";

interface BlockResult {
  lid: string;
  path: string;
  t: string;
  h: number;
  over: number;
  culprit: string;
  katexErr: number;
  empty: boolean;
}

const TYPES = ["p", "math", "table", "term", "callout", "list", "example", "dialog", "widget"];
const BOARD_H = 852;
const hasPw = !!loadPlaywright();

test("블록 그리기: 휴대폰 · 칠판에서 넘침 · 수식 오류 · 빈 그림이 없어요", { skip: hasPw ? false : "playwright 없음", timeout: 600000 }, async () => {
  const r = (await runBlocks([
    { surface: "phone", fs: 1 },
    { surface: "phone", fs: 3 },
    { surface: "board", fs: 1 },
  ])) as { results: Record<string, BlockResult[]>; errors: string[] };
  assert.deepEqual(r.errors, [], "페이지 오류");
  const lessons = new Set<string>();
  for (const name of Object.keys(r.results)) {
    const list = r.results[name];
    assert.ok(list.length > 1000, name + ": 블록 수가 너무 적어요 " + list.length);
    for (const x of list) lessons.add(x.lid);
    const seen = new Set(list.map((x) => x.t));
    for (const t of TYPES) assert.ok(seen.has(t), name + ": 블록 종류 " + t + " 가 안 그려졌어요");
    const bad = list.filter((x) => x.over > 1 || x.katexErr > 0 || x.empty).map((x) => `${x.lid} ${x.path} ${x.t} over=${x.over} ${x.culprit} katex=${x.katexErr}${x.empty ? " 빈그림" : ""}`);
    assert.deepEqual(bad, [], name + "\n" + bad.slice(0, 15).join("\n"));
    if (name.indexOf("board") === 0) {
      const tall = list.filter((x) => x.h > BOARD_H).map((x) => `${x.lid} ${x.path} ${x.t} h=${x.h}`);
      assert.deepEqual(tall, [], name + " 장면보다 큰 블록\n" + tall.join("\n"));
    }
  }
  assert.equal(lessons.size, 20, "20레슨 모두");
});

interface PrintResult {
  name: string;
  coloredN: number;
  colored: string[];
  over: string[];
  katexErr: number;
  qs: number;
  visibleButtons: number;
}

test("인쇄 미리 보기: 학습지 · 정답지가 흑백이고 A4 폭 안에 들어가요", { skip: hasPw ? false : "playwright 없음", timeout: 600000 }, async () => {
  const cases: { lid: string; set: string; key?: boolean; theme: string }[] = [];
  for (const lid of ["u1-3", "u2-3", "u3-3", "u4-4", "u5-1"]) {
    cases.push({ lid, set: "board", theme: "dark" });
    cases.push({ lid, set: "hw", key: true, theme: "chalk" });
  }
  const r = (await runPrint(cases)) as { results: PrintResult[]; errors: string[] };
  assert.deepEqual(r.errors, [], "페이지 오류");
  for (const x of r.results) {
    assert.ok(x.qs > 0, x.name + ": 문제가 없어요");
    assert.equal(x.coloredN, 0, x.name + ": 색이 남았어요\n" + x.colored.join("\n"));
    assert.deepEqual(x.over, [], x.name + ": 종이 밖으로 넘쳐요");
    assert.equal(x.katexErr, 0, x.name + ": KaTeX 오류");
    assert.equal(x.visibleButtons, 0, x.name + ": 인쇄에 단추가 보여요");
  }
});
