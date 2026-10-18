// tools/aibasic/data → public/aibasic/lessons.js. 순서는 레슨 id 의 숫자 순서(1-1-1 … 4-A)예요.
// 사용: node tools/aibasic/build.mjs
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const dir = path.join(root, "tools/aibasic/data");
const key = (id) => id.split("-").map((p) => (/^\d+$/.test(p) ? p.padStart(3, "0") : "z" + p)).join("-");
const read = (d) => fs.readdirSync(path.join(dir, d)).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(path.join(dir, d, f), "utf8")));
const lessons = read("lessons").sort((a, b) => (key(a.id) < key(b.id) ? -1 : 1));
const qbank = {};
fs.readdirSync(path.join(dir, "qbank")).sort((a, b) => (key(a) < key(b) ? -1 : 1)).forEach((f) => {
  if (f.endsWith(".json")) qbank[f.replace(/\.json$/, "")] = JSON.parse(fs.readFileSync(path.join(dir, "qbank", f), "utf8"));
});
let js = "/* 자동 생성: node tools/aibasic/build.mjs (원본: tools/aibasic/data) */\nvar LESSONS = [];\nvar QBANK = " + JSON.stringify(qbank) + ";\n";
for (const L of lessons) js += "\n/* " + L.id + " */\nLESSONS.push(" + JSON.stringify(L) + ");\n";
fs.writeFileSync(path.join(root, "public/aibasic/lessons.js"), js);
console.log("build:", lessons.length, "레슨 → public/aibasic/lessons.js");
