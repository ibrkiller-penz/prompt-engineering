// 수업 끝 QR 이 정말 학생 주소(aibasics.web.app)를 담는지, 따로 만든 해독기로 다시 읽어서 확인해요.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Lesson } from "../../src/shared/contracts.ts";
import { makeQr, qrSvg } from "../../src/teacher/qr/index.ts";
import { parseStudentLink, studentLink } from "../../src/teacher/logic/pick.logic.ts";
import { buildLessonFlow, homeworkFromOff } from "../../src/teacher/logic/scenes.logic.ts";
import { lessonPeriods } from "../../src/teacher/logic/periods.logic.ts";
import { loadLessons } from "../shared/_content.ts";
import { decodeQr, matrixFromPath } from "./_qrdecode.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const lessons = loadLessons().map((x) => x.lesson as unknown as Lesson);

/** 교사 빌드가 쓰는 학생 주소: .env.teacher 의 VITE_STUDENT_URL, 없으면 site.ts 기본값 */
function teacherBuildStudentUrl(): string {
  const site = read("src/site.ts");
  const def = /STUDENT_URL\s*=\s*trim\(import\.meta\.env\.VITE_STUDENT_URL,\s*"([^"]+)"\)/.exec(site);
  assert.ok(def, "site.ts 에서 STUDENT_URL 기본값을 찾지 못했어요");
  let url = def![1];
  try {
    const env = /^\s*VITE_STUDENT_URL\s*=\s*(\S+)\s*$/m.exec(read(".env.teacher"));
    if (env) url = env[1];
  } catch {
    /* .env.teacher 가 없으면 기본값 */
  }
  return url.replace(/\/+$/, "");
}

test("해독기 자체 확인: 알려진 글자(영숫자·숫자·바이트·한글)를 그대로 읽어요", () => {
  for (const [text, ecc] of [
    ["HELLO WORLD", "Q"],
    ["0123456789012", "M"],
    ["https://aibasics.web.app/#/l/u1-1", "M"],
    ["수업 끝 확인", "H"],
    ["https://aibasics.web.app/#/l/u4-3?hw=q11,q12,q21,q33,q40&ex=q02,q14,q19", "L"],
  ] as const) {
    const m = makeQr(text, ecc);
    const d = decodeQr(m.modules);
    assert.equal(d.text, text);
    assert.equal(d.version, m.version);
    assert.equal(d.mask, m.mask);
  }
});

test("해독기는 망가진 QR 을 그냥 넘기지 않아요(한 칸 뒤집으면 실패)", () => {
  const m = makeQr("https://aibasics.web.app/#/l/u2-1", "M");
  const bad = m.modules.map((r) => r.slice());
  // 데이터 영역(오른쪽 아래) 한 칸
  bad[m.size - 1][m.size - 1] = !bad[m.size - 1][m.size - 1];
  assert.throws(() => decodeQr(bad));
});

test("교사 빌드의 학생 주소는 https://aibasics.web.app 이고, 끝 장면은 그 주소(STUDENT_URL)로 QR 을 만들어요", () => {
  assert.equal(teacherBuildStudentUrl(), "https://aibasics.web.app");
  const end = read("src/teacher/board/End.tsx");
  assert.match(end, /studentLink\(STUDENT_URL,/);
  assert.match(end, /qrSvg\(url,/);
  assert.doesNotMatch(end, /TEACHER_URL/);
});

test("수업 끝 QR(칠판에 그리는 SVG path)을 해독하면 20레슨 모든 차시에서 학생 주소 + 그 레슨 + 고른 문제예요", () => {
  const base = teacherBuildStudentUrl();
  let n = 0;
  for (const L of lessons) {
    for (const minutes of [45, 70]) {
      for (const per of lessonPeriods(L, null, minutes)) {
        const f = buildLessonFlow(L, null, minutes, per.p);
        const exit = f.pick.exit.slice();
        const hw = f.pick.hw.slice();
        for (const id of homeworkFromOff(f.scenes)) if (hw.indexOf(id) < 0 && exit.indexOf(id) < 0) hw.push(id);
        const url = studentLink(base, L.id, { hw, ex: exit });
        // End.tsx 와 같은 설정으로 그려요
        const svg = qrSvg(url, { ecc: "M", border: 4 });
        const got = decodeQr(matrixFromPath(svg.d, svg.n, 4));
        const where = L.id + " " + minutes + "분 " + per.p + "차시";
        assert.equal(got.text, url, where);
        assert.ok(got.text.indexOf("https://aibasics.web.app/#/l/" + L.id) === 0, where + ": " + got.text);
        assert.doesNotMatch(got.text, /aibasict/, where);
        assert.ok(got.version <= 10, where + ": 버전 " + got.version);
        const back = parseStudentLink(got.text);
        assert.ok(back, where);
        assert.equal(back!.lid, L.id);
        assert.deepEqual(back!.ex.slice().sort(), exit.slice().sort(), where + ": 끝 확인");
        assert.deepEqual(back!.hw.slice().sort(), hw.slice().sort(), where + ": 숙제");
        n++;
      }
    }
  }
  assert.ok(n >= 40);
});
