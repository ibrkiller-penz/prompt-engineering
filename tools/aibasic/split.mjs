// public/aibasic/lessons.js → tools/aibasic/data/{lessons/<id>.json, qbank/<id>.json} 로 나눠요(한 번만 쓰는 도구).
// 사용: node tools/aibasic/split.mjs
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const src = fs.readFileSync(path.join(root, "public/aibasic/lessons.js"), "utf8");
const ctx = {};
vm.createContext(ctx);
vm.runInContext(src.replace("var LESSONS", "this.LESSONS").replace("var QBANK", "this.QBANK"), ctx);
const out = path.join(root, "tools/aibasic/data");
fs.mkdirSync(path.join(out, "lessons"), { recursive: true });
fs.mkdirSync(path.join(out, "qbank"), { recursive: true });
for (const L of ctx.LESSONS) fs.writeFileSync(path.join(out, "lessons", L.id + ".json"), JSON.stringify(L, null, 2) + "\n");
for (const [id, q] of Object.entries(ctx.QBANK)) fs.writeFileSync(path.join(out, "qbank", id + ".json"), JSON.stringify(q, null, 2) + "\n");
console.log("split:", ctx.LESSONS.length, "레슨,", Object.keys(ctx.QBANK).length, "문제은행");
