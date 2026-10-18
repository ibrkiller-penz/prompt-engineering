import { test } from "node:test";
import assert from "node:assert/strict";
import { makeQr, qrSvg, qrSvgPath, qrSvgString } from "../../src/teacher/qr/index.ts";
import { Ecc, QrCode, QrSegment } from "../../src/teacher/qr/qrcodegen.ts";
import { studentLink } from "../../src/teacher/logic/pick.logic.ts";

// 원본 Nayuki qrcodegen(typescript-javascript/qrcodegen.ts)으로 만든 기준 결과
const HELLO_Q = [
  "111111101100001111111",
  "100000101001001000001",
  "101110101001101011101",
  "101110101000001011101",
  "101110101010001011101",
  "100000100010001000001",
  "111111101010101111111",
  "000000001000000000000",
  "011010110000101011111",
  "010000001111000010001",
  "001101110110001011000",
  "011011010011010101110",
  "100010101011101110101",
  "000000001101001000101",
  "111111101010000101100",
  "100000100101101101000",
  "101110101010001111111",
  "101110100101010100010",
  "101110101001011101001",
  "100000101011110001011",
  "111111100001011100001",
];

function fingerprint(m: { size: number; modules: boolean[][] }): number {
  let h = 0;
  for (let y = 0; y < m.size; y++) for (let x = 0; x < m.size; x++) if (m.modules[y][x]) h = (h * 31 + y * m.size + x) >>> 0;
  return h;
}

test("qrcodegen: 원본과 같은 행렬(HELLO WORLD, Q)", () => {
  const m = makeQr("HELLO WORLD", "Q");
  assert.equal(m.size, 21);
  assert.equal(m.version, 1);
  assert.equal(m.mask, 0);
  assert.deepEqual(
    m.modules.map((r) => r.map((d) => (d ? "1" : "0")).join("")),
    HELLO_Q,
  );
});

test("qrcodegen: 원본과 같은 행렬(학생 주소, M)", () => {
  const m = makeQr("https://aibasics.web.app/#/l/u1-1?hw=q06,q07&ex=q02", "M");
  assert.equal(m.size, 33);
  assert.equal(m.version, 4);
  assert.equal(m.mask, 3);
  assert.equal(fingerprint(m), 3338480478);
});

test("qrcodegen: 행렬 크기 = 버전×4 + 17, 찾기 무늬 세 귀퉁이", () => {
  for (const len of [1, 10, 50, 120, 300, 1000]) {
    const qr = QrCode.encodeText("a".repeat(len), Ecc.MEDIUM);
    assert.equal(qr.size, qr.version * 4 + 17);
    // 세 귀퉁이 찾기 무늬의 가운데는 검은 칸
    assert.ok(qr.getModule(3, 3) && qr.getModule(qr.size - 4, 3) && qr.getModule(3, qr.size - 4));
    assert.equal(qr.getModule(-1, 0), false);
  }
  assert.ok(QrSegment.isAlphanumeric("HELLO WORLD"));
  assert.throws(() => QrCode.encodeText("x".repeat(4000), Ecc.HIGH));
});

test("qrSvgPath: 검은 칸 수가 행렬과 같고, 여백만큼 밀려요", () => {
  const m = makeQr("https://aibasics.web.app/#/l/u3-2?ex=q01,q02,q03", "M");
  let dark = 0;
  for (const row of m.modules) for (const d of row) if (d) dark++;
  const d = qrSvgPath(m, 4);
  let fromPath = 0;
  const re = /M(\d+),(\d+)h(\d+)v1h-(\d+)z/g;
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(d))) {
    const x = +mm[1] - 4;
    const y = +mm[2] - 4;
    const w = +mm[3];
    assert.equal(w, +mm[4]);
    for (let k = 0; k < w; k++) assert.ok(m.modules[y][x + k], "path 의 칸이 검은 칸이 아니에요");
    fromPath += w;
  }
  assert.equal(fromPath, dark);
  assert.equal(d.replace(re, ""), "", "path 에 다른 명령이 없어요");
  const s = qrSvg("https://aibasics.web.app/#/l/u3-2", { border: 2 });
  assert.equal(s.n, makeQr("https://aibasics.web.app/#/l/u3-2").size + 4);
  assert.equal(s.viewBox, "0 0 " + s.n + " " + s.n);
  assert.match(qrSvgString("a", { title: '수업 "끝"' }), /^<svg [^>]*aria-label="수업 &quot;끝&quot;"/);
  assert.throws(() => qrSvgPath(m, -1));
});

test("수업 끝 QR: 숙제 5 + 끝 확인 3 주소도 칠판에서 읽기 쉬운 크기(버전 6 이하)", () => {
  const url = studentLink("https://aibasics.web.app", "u4-3", {
    hw: ["u4-3-q11", "u4-3-q12", "u4-3-q21", "u4-3-q33", "u4-3-q40"],
    ex: ["u4-3-q02", "u4-3-q14", "u4-3-q19"],
  });
  const m = makeQr(url, "M");
  assert.ok(m.version <= 6, "버전 " + m.version);
});
