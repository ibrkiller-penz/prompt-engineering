import test from "node:test";
import assert from "node:assert/strict";
import { absoluteUrl, fillPath, formatHash, idList, intParam, matchPath, matchTable, normalizePath, parseHash } from "../src/shared/router/match.ts";
import { STUDENT_ROUTES, TEACHER_ROUTES } from "../src/shared/contracts.ts";

test("parseHash: 빈 해시와 뿌리는 모두 '/'", () => {
  for (const h of ["", "#", "#/", "#//"]) assert.deepEqual(parseHash(h), { path: "/", query: {} });
});

test("parseHash: 경로·쿼리 나누기, 끝 '/' 떼기, 한글 풀기", () => {
  const loc = parseHash("#/l/u1-1/s/c2/3/?hw=u1-1-q06,u1-1-q11&ex=u1-1-q03&t=%ED%95%9C%EA%B8%80");
  assert.equal(loc.path, "/l/u1-1/s/c2/3");
  assert.deepEqual(loc.query, { hw: "u1-1-q06,u1-1-q11", ex: "u1-1-q03", t: "한글" });
});

test("parseHash: 깨진 인코딩·위험한 키도 죽지 않아요", () => {
  const loc = parseHash("#/dict?q=%E0%A4%A&__proto__=1&constructor=2");
  assert.equal(loc.query.q, "%E0%A4%A");
  assert.equal(Object.prototype.hasOwnProperty.call(loc.query, "__proto__"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(loc.query, "constructor"), false);
});

test("formatHash: 빈 값은 빼고 쉼표는 그대로", () => {
  assert.equal(formatHash("/board/u2-1", { p: 1, s: 0, x: "", y: undefined }), "#/board/u2-1?p=1&s=0");
  assert.equal(formatHash("/l/u1-1", { hw: "a,b" }), "#/l/u1-1?hw=a,b");
  assert.equal(formatHash("/"), "#/");
});

test("formatHash ↔ parseHash 왕복", () => {
  const h = formatHash("/l/u3-2/q/more", { hw: "u3-2-q01,u3-2-q09", s: 3 });
  assert.deepEqual(parseHash(h), { path: "/l/u3-2/q/more", query: { hw: "u3-2-q01,u3-2-q09", s: "3" } });
});

test("normalizePath", () => {
  assert.equal(normalizePath("//a///b/"), "/a/b");
  assert.equal(normalizePath(""), "/");
});

test("matchPath: 매개변수와 길이", () => {
  assert.deepEqual(matchPath("/l/:lid/s/:step/:card", "/l/u1-1/s/c2/3"), { lid: "u1-1", step: "c2", card: "3" });
  assert.equal(matchPath("/l/:lid", "/l/u1-1/q"), null);
  assert.equal(matchPath("/l/:lid/q", "/l/u1-1/x"), null);
  assert.deepEqual(matchPath("/", "/"), {});
});

test("matchTable: 학생 경로 표", () => {
  const cases: [string, string, Record<string, string>][] = [
    ["/", "home", {}],
    ["/u/3", "unit", { n: "3" }],
    ["/l/u2-4", "lesson", { lid: "u2-4" }],
    ["/l/u2-4/s/story/1", "card", { lid: "u2-4", step: "story", card: "1" }],
    ["/l/u2-4/q", "quiz", { lid: "u2-4" }],
    ["/l/u2-4/q/more", "quizMore", { lid: "u2-4" }],
    ["/note", "note", {}],
    ["/review", "review", {}],
    ["/dict", "dict", {}],
    ["/me", "me", {}],
    ["/privacy", "privacy", {}],
    ["/card", "answerCard", {}],
  ];
  for (const [p, name, params] of cases) {
    const m = matchTable(STUDENT_ROUTES, p);
    assert.ok(m, p);
    assert.equal(m.name, name, p);
    assert.deepEqual(m.params, params, p);
  }
  assert.equal(matchTable(STUDENT_ROUTES, "/board/u1-1"), null, "학생 표에는 칠판 경로가 없어요");
});

test("matchTable: 교사 경로 표", () => {
  const cases: [string, string][] = [
    ["/", "today"],
    ["/find", "find"],
    ["/flow/u1-1", "flow"],
    ["/pick/u1-1", "pick"],
    ["/prep/u1-1", "prep"],
    ["/print/u1-1", "print"],
    ["/progress", "progress"],
    ["/results", "results"],
    ["/unit/2/test", "unitTest"],
    ["/privacy", "privacy"],
    ["/board/u1-1", "board"],
    ["/board/u1-1/q/u1-1-q06", "boardQ"],
    ["/board/u1-1/tool/turing", "boardTool"],
    ["/board/u1-1/end", "boardEnd"],
  ];
  for (const [p, name] of cases) {
    const m = matchTable(TEACHER_ROUTES, p);
    assert.ok(m, p);
    assert.equal(m.name, name, p);
  }
});

test("fillPath: 채우기와 빠진 값", () => {
  assert.equal(fillPath(STUDENT_ROUTES.card, { lid: "u1-1", step: "c1", card: 2 }), "/l/u1-1/s/c1/2");
  assert.equal(fillPath(TEACHER_ROUTES.boardQ, { lid: "u1-1", qid: "u1-1-q06" }), "/board/u1-1/q/u1-1-q06");
  assert.throws(() => fillPath(STUDENT_ROUTES.lesson, {}));
});

test("idList: 문제 id 모양만, 중복 없이, 최대 개수", () => {
  assert.deepEqual(idList("u1-1-q06, u1-1-q11,,u1-1-q06"), ["u1-1-q06", "u1-1-q11"]);
  assert.deepEqual(idList("<script>,a b,u1-1-q01"), ["u1-1-q01"]);
  assert.deepEqual(idList(undefined), []);
  const many = Array.from({ length: 50 }, (_, i) => "q" + i).join(",");
  assert.equal(idList(many).length, 30);
  assert.equal(idList(many, 5).length, 5);
});

test("intParam", () => {
  assert.equal(intParam("3", 1), 3);
  assert.equal(intParam("x", 1), 1);
  assert.equal(intParam("-1", 0, 0, 10), 0);
  assert.equal(intParam(undefined, 2), 2);
});

test("absoluteUrl: 수업 끝 QR 주소는 학생 주소로", () => {
  assert.equal(absoluteUrl("https://aibasics.web.app/", "/l/u1-1", { hw: "u1-1-q06,u1-1-q11", ex: "u1-1-q03" }), "https://aibasics.web.app/#/l/u1-1?hw=u1-1-q06,u1-1-q11&ex=u1-1-q03");
});
