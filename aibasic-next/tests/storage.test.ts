import test from "node:test";
import assert from "node:assert/strict";
import { createStore, memoryStorage, type StorageLike } from "../src/shared/storage/store.ts";
import { S_PREFIX, STUDENT_KEYS, T_PREFIX, TEACHER_KEYS, studentKeyList, teacherKeyList } from "../src/shared/storage/keys.ts";
import { backupFileName, makeBackup, parseBackup, serializeBackup } from "../src/shared/storage/backup.ts";
import { DEFAULT_PREFS, type StudentData, type TeacherData } from "../src/shared/contracts.ts";

const sStore = (st: StorageLike | null) => createStore<StudentData>(S_PREFIX, studentKeyList, () => st);
const tStore = (st: StorageLike | null) => createStore<TeacherData>(T_PREFIX, teacherKeyList, () => st);

test("접두사: 학생 aibn:s1:, 교사 aibn:t1:", () => {
  assert.equal(S_PREFIX, "aibn:s1:");
  assert.equal(T_PREFIX, "aibn:t1:");
  for (const k of studentKeyList) assert.ok(STUDENT_KEYS[k].desc.length > 5, k);
  for (const k of teacherKeyList) assert.ok(TEACHER_KEYS[k].desc.length > 5, k);
  assert.ok(teacherKeyList.indexOf("log") >= 0, "교사 log 키 등록");
});

test("읽기·쓰기·고치기·지우기", () => {
  const mem = memoryStorage();
  const s = sStore(mem);
  assert.deepEqual(s.read("q", {}), {});
  const rec = { first: true, wrong: 0, hints: 0 as const, sol: false, ok: true, lastWrong: null, t0: 1, t1: 1 };
  assert.equal(s.write("q", { "u1-1-q01": rec }), true);
  assert.equal(mem.getItem("aibn:s1:q"), JSON.stringify({ "u1-1-q01": rec }));
  s.update("read", {}, (cur) => ({ ...cur, "u1-1": [0, 1] }));
  assert.deepEqual(s.read("read", {}), { "u1-1": [0, 1] });
  s.remove("read");
  assert.deepEqual(s.read("read", {}), {});
});

test("깨진 JSON·null 은 기본값", () => {
  const mem = memoryStorage({ "aibn:s1:prefs": "{깨짐", "aibn:s1:last": "null" });
  const s = sStore(mem);
  assert.deepEqual(s.read("prefs", DEFAULT_PREFS), DEFAULT_PREFS);
  assert.equal(s.read("last", null), null);
});

test("저장소가 없거나 오류를 던져도 죽지 않아요", () => {
  const none = sStore(null);
  assert.deepEqual(none.read("q", {}), {});
  assert.equal(none.write("q", {}), false);
  assert.equal(none.available(), false);
  none.clear();
  assert.deepEqual(none.dump(), {});

  const angry: StorageLike = {
    getItem() {
      throw new Error("SecurityError");
    },
    setItem() {
      throw new Error("QuotaExceededError");
    },
    removeItem() {
      throw new Error("x");
    },
    key() {
      throw new Error("x");
    },
    get length(): number {
      throw new Error("x");
    },
  };
  const s = sStore(angry);
  assert.deepEqual(s.read("q", {}), {});
  assert.equal(s.write("q", {}), false);
  s.remove("q");
  s.clear();
  assert.equal(s.available(), false);
  assert.equal(s.restore({ q: {} }), 0);

  const thrower = createStore<StudentData>(S_PREFIX, studentKeyList, () => {
    throw new Error("접근 금지");
  });
  assert.deepEqual(thrower.read("q", {}), {});
  assert.equal(thrower.write("q", {}), false);
});

test("clear 는 자기 접두사만 지워요(옛 /aimath·교사 기록은 그대로)", () => {
  const mem = memoryStorage({ "aibn:s1:q": "{}", "aibn:s1:read": "{}", "aibn:t1:prefs": "{}", "penedu:aimath:q": "{}" });
  sStore(mem).clear();
  assert.deepEqual(Array.from(mem.map.keys()).sort(), ["aibn:t1:prefs", "penedu:aimath:q"]);
});

test("dump 는 알려진 키만, restore 도 알려진 키만", () => {
  const mem = memoryStorage({ "aibn:s1:q": '{"a":1}', "aibn:s1:zzz": "1", "aibn:s1:read": "{깨짐" });
  const s = sStore(mem);
  assert.deepEqual(s.dump(), { q: { a: 1 } });
  const mem2 = memoryStorage();
  const n = sStore(mem2).restore({ q: { b: 2 }, evil: 1, __proto__x: 2 });
  assert.equal(n, 1);
  assert.deepEqual(Array.from(mem2.map.keys()), ["aibn:s1:q"]);
});

test("기록 파일 왕복(학생)", () => {
  const now = new Date(2026, 9, 16, 9, 30);
  const text = serializeBackup("student", { q: { x: 1 }, prefs: DEFAULT_PREFS, junk: 3 }, now);
  const b = JSON.parse(text);
  assert.equal(b.app, "aibasic-next");
  assert.equal(b.site, "student");
  assert.equal(b.v, 1);
  assert.equal(b.data.junk, undefined);
  const r = parseBackup(text, "student");
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.data, { q: { x: 1 }, prefs: DEFAULT_PREFS });
  assert.equal(backupFileName("student", now), "인공지능기초-학습기록-2026-10-16.json");
  assert.equal(backupFileName("teacher", now), "인공지능기초-교사설정-2026-10-16.json");
});

test("기록 파일: 사이트가 다르거나 모양이 틀리면 거절(이유는 해요체)", () => {
  const t = serializeBackup("teacher", { prefs: DEFAULT_PREFS });
  const r1 = parseBackup(t, "student");
  assert.equal(r1.ok, false);
  if (!r1.ok) assert.match(r1.reason, /요\.$/);
  for (const bad of ["", "{", "[]", '{"app":"other","v":1}', '{"app":"aibasic-next","v":2,"site":"student","data":{}}', '{"app":"aibasic-next","v":1,"site":"student"}']) {
    const r = parseBackup(bad, "student");
    assert.equal(r.ok, false, bad);
  }
  const big = "x".repeat(2 * 1024 * 1024 + 1);
  assert.equal(parseBackup(big, "student").ok, false);
});

test("기록 파일: 모르는 키는 건너뛰고 알려 줘요, __proto__ 로 오염되지 않아요", () => {
  const text = '{"app":"aibasic-next","v":1,"site":"student","savedAt":"x","data":{"q":{},"__proto__":{"polluted":1},"other":1}}';
  const r = parseBackup(text, "student");
  assert.ok(r.ok);
  if (r.ok) {
    assert.deepEqual(Object.keys(r.data), ["q"]);
    assert.ok(r.skipped.indexOf("other") >= 0);
  }
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
});

test("교사 저장소는 학생 키를 받지 않아요", () => {
  const mem = memoryStorage();
  const t = tStore(mem);
  assert.equal(t.restore({ q: {}, prefs: DEFAULT_PREFS }), 1);
  assert.deepEqual(Array.from(mem.map.keys()), ["aibn:t1:prefs"]);
  const b = makeBackup("teacher", { q: {}, duration: 50 });
  assert.deepEqual(b.data, { duration: 50 });
});
