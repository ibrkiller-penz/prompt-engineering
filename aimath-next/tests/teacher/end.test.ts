// 수업 끝 화면과 칠판 머리 계산(순수 로직): clip 구두점, 숙제 줄 수, QR 쿼리는 hw/ex 만, 구간·장면 번호, 공개 자리표시 단서.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Lesson, Scene } from "../../src/shared/contracts.ts";
import { circled, clip, cueOf, hwPreview, segmentInfo } from "../../src/teacher/board/board.logic.ts";
import { studentLink } from "../../src/teacher/logic/pick.logic.ts";
import { buildLessonFlow, homeworkFromOff } from "../../src/teacher/logic/scenes.logic.ts";
import { lessonPeriods } from "../../src/teacher/logic/periods.logic.ts";
import { loadLessons } from "../shared/_content.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const lessons = loadLessons().map((x) => x.lesson as unknown as Lesson);

test("clip: 짧으면 그대로, 길면 끝 구두점을 지우고 '…'을 붙여요", () => {
  assert.equal(clip("짧은 글이에요.", 40), "짧은 글이에요.");
  assert.equal(clip("줄\n바꿈", 40), "줄 바꿈");
  // 자른 끝이 쉼표·마침표면 지워요
  const a = clip("확률은, 어떤 일이 일어날 가능성을 0과 1 사이의 수로 나타낸 것이에요.", 5);
  assert.ok(!/[.,!?;:·]…$/.test(a), a);
  assert.ok(/…$/.test(a), a);
  assert.equal(clip("가나다라마바사, 아자차카타파하 그리고 더 긴 글이 이어져요", 8), "가나다라마바사…");
  assert.equal(clip("첫째 문장이에요. 둘째 문장도 길게 이어져요", 10), "첫째 문장이에요…");
  // '…'가 두 번 붙지 않아요
  assert.ok(!/……$/.test(clip("이어지는 말… 그리고 더 많은 이야기가 있어요", 8)));
  // 수식 가운데서 자르지 않아요($ 짝이 맞아요)
  for (const n of [6, 10, 14, 18, 22]) {
    const c = clip("넓이는 $\\frac{1}{2}ab$ 이고 둘레는 $a+b+c$ 예요. 그다음 이야기", n);
    assert.equal((c.match(/\$/g) || []).length % 2, 0, c);
    assert.ok(/…$/.test(c), c);
  }
  // 굵게 표시 짝도 맞아요
  const b = clip("**벡터**는 크기와 **방향을 함께** 가진 양이에요", 16);
  assert.equal((b.match(/\*\*/g) || []).length % 2, 0, b);
});

test("clip: 20레슨 문제 본문 미리보기는 모두 짝이 맞고 끝이 구두점+…가 아니에요", () => {
  let n = 0;
  for (const L of lessons)
    for (const q of L.practice)
      for (const k of [34, 40, 60]) {
        const c = clip(q.prompt, k);
        assert.equal((c.match(/\$/g) || []).length % 2, 0, q.id + ": " + c);
        assert.ok(!/[.,!?;:·][…]$/.test(c), q.id + ": " + c);
        assert.ok(c.length <= k + 1, q.id + ": " + c.length);
        n++;
      }
  assert.ok(n > 100);
});

test("숙제 미리보기: 앞 3줄만, 나머지는 '+n문제'", () => {
  assert.deepEqual(hwPreview([], 3), { shown: [], more: 0 });
  assert.deepEqual(hwPreview(["a", "b"], 3), { shown: ["a", "b"], more: 0 });
  assert.deepEqual(hwPreview(["a", "b", "c"], 3), { shown: ["a", "b", "c"], more: 0 });
  assert.deepEqual(hwPreview(["a", "b", "c", "d", "e", "f", "g"], 3), { shown: ["a", "b", "c"], more: 4 });
  // 20레슨 모든 차시에서 보이는 줄은 3줄 이하
  for (const L of lessons)
    for (const per of lessonPeriods(L, null, 45)) {
      const f = buildLessonFlow(L, null, 45, per.p);
      const hw = f.pick.hw.slice();
      for (const id of homeworkFromOff(f.scenes)) if (hw.indexOf(id) < 0) hw.push(id);
      const p = hwPreview(hw, 3);
      assert.ok(p.shown.length <= 3, L.id);
      assert.equal(p.shown.length + p.more, hw.length, L.id);
    }
});

test("End.tsx: 숙제는 hwPreview(…, 3), 정리·숙제는 clip, 수업 마치기는 장면 안 단추가 아니에요", () => {
  const src = read("src/teacher/board/End.tsx");
  assert.match(src, /hwPreview\(hw, 3\)/);
  assert.match(src, /clip\(q\.prompt,/);
  assert.doesNotMatch(src, /<button/, "수업 마치기는 아래 고정 막대의 주 단추가 맡아요");
  assert.doesNotMatch(src, /\{short\}|word-break/, "긴 주소(쿼리)를 화면 글자로 보여 주지 않아요");
});

test("QR 주소의 쿼리는 hw·ex 둘뿐이에요(반·이름·시간 없음)", () => {
  for (const L of lessons)
    for (const minutes of [45, 50, 70])
      for (const per of lessonPeriods(L, null, minutes)) {
        const f = buildLessonFlow(L, null, minutes, per.p);
        const url = studentLink("https://aimaths.web.app", L.id, { hw: f.pick.hw, ex: f.pick.exit });
        const m = /^https:\/\/aimaths\.web\.app\/#\/l\/(u\d+-\d+)(?:\?(.*))?$/.exec(url);
        assert.ok(m, url);
        assert.equal(m![1], L.id);
        if (m![2])
          for (const kv of m![2].split("&")) {
            const key = kv.split("=")[0];
            assert.ok(key === "hw" || key === "ex", L.id + ": 쿼리 " + key);
            assert.match(kv.split("=")[1] || "", /^[A-Za-z0-9_,-]+$/, L.id + ": " + kv);
          }
      }
});

const sc = (stage: Scene["stage"], on = true, section?: number): Scene =>
  ({ id: stage + Math.random(), stage, kind: stage === "end" ? "qr" : "concept", blocks: [], reveal: 0, required: false, on, estMin: 1, section }) as Scene;

test("머리 표시: 구간 이름 n/m · 장면 a/b, 꺼진 장면 수", () => {
  const scenes = [sc("open"), sc("open", false), sc("concept", true, 0), sc("tool", true, 0), sc("practice", true, 0), sc("concept", true, 1), sc("practice", true), sc("practice", false), sc("wrap"), sc("end")];
  const first = segmentInfo(scenes, 0);
  assert.deepEqual([first.label, first.n, first.m, first.a, first.b, first.off], ["도입", 1, 6, 1, 8, 2]);
  const s3 = segmentInfo(scenes, 3);
  assert.deepEqual([s3.label, s3.n, s3.a], ["개념①", 2, 3]);
  const s4 = segmentInfo(scenes, 4); // 소제목 확인 문제는 그 소제목 구간
  assert.deepEqual([s4.label, s4.n, s4.a], ["개념①", 2, 4]);
  const s5 = segmentInfo(scenes, 5);
  assert.deepEqual([s5.label, s5.n], ["개념②", 3]);
  const s6 = segmentInfo(scenes, 6);
  assert.deepEqual([s6.label, s6.n], ["문제", 4]);
  const last = segmentInfo(scenes, 9);
  assert.deepEqual([last.label, last.n, last.a, last.b], ["수업 끝", 6, 8, 8]);
  // 꺼진 장면 위치면 앞 켜진 장면 기준
  assert.equal(segmentInfo(scenes, 1).a, 1);
});

test("머리 표시: 20레슨 실제 장면에서도 a ≤ b, n ≤ m", () => {
  for (const L of lessons)
    for (const per of lessonPeriods(L, null, 45)) {
      const f = buildLessonFlow(L, null, 45, per.p);
      for (let s = 0; s < f.scenes.length; s++) {
        if (!f.scenes[s].on) continue;
        const g = segmentInfo(f.scenes, s);
        assert.ok(g.a >= 1 && g.a <= g.b && g.n >= 1 && g.n <= g.m && g.label, L.id + " " + s);
      }
    }
});

test("공개 자리표시: 번호는 ①②…, 단서는 종류와 첫 낱말(수식·굵게 표시는 걷어내요)", () => {
  assert.equal(circled(1), "①");
  assert.equal(circled(2), "②");
  assert.equal(circled(20), "⑳");
  assert.equal(circled(21), "(21)");
  assert.deepEqual(cueOf({ t: "p", text: "**확률**은 어떤 일이 일어날 가능성이에요." }), { kind: "글", word: "확률은" });
  assert.deepEqual(cueOf({ t: "math", tex: "a+b" }), { kind: "수식", word: "" });
  assert.equal(cueOf({ t: "table", head: ["점수", "학생 수"], rows: [] }).kind, "표");
  assert.equal(cueOf({ t: "p", text: "$x$ 가 커지면" }).word, "", "수식으로 시작하면 단서 낱말 없이 종류만");
  assert.equal(cueOf({ t: "callout", kind: "warn", text: "조심해요, 이것은" }).word, "조심해요");
  for (const L of lessons) for (const sec of L.sections) for (const b of sec.blocks) assert.ok(cueOf(b as { t: string }).word.length <= 10);
});
