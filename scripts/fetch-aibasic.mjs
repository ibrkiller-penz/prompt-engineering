// /aibasic 원본은 이제 저장소의 public/aibasic 에 있다(2026-10-11). 이 스크립트는 그 폴더가 없을 때 현재 배포본(ai-study-math)에서 다시 받는 비상용이다.
// 사용: node scripts/fetch-aibasic.mjs   (이미 있는 파일은 건너뜀. 다시 받으려면 --force)
import fs from "node:fs";
import path from "node:path";

const BASE = "https://ai-study-math.web.app/aibasic/";
const OUT = path.resolve("public/aibasic");
const force = process.argv.includes("--force");

async function get(rel) {
  const dest = path.join(OUT, rel);
  if (!force && fs.existsSync(dest)) return fs.readFileSync(dest);
  const r = await fetch(BASE + rel);
  if (!r.ok) throw new Error(`${rel}: ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  return buf;
}

const files = ["index.html", "style.css", "app.js", "fonts/S-CoreDream-4Regular.woff", "fonts/S-CoreDream-5Medium.woff", "fonts/S-CoreDream-6Bold.woff"];
for (const f of files) await get(f);
const lessons = (await get("lessons.js")).toString("utf8");
const imgs = [...new Set([...lessons.matchAll(/img\/[A-Za-z0-9_.\-]+\.(?:jpg|jpeg|png|svg|webp|gif)/g)].map((m) => m[0]))];
let n = 0, bad = [];
const queue = [...imgs];
await Promise.all(Array.from({ length: 8 }, async () => {
  for (let f; (f = queue.shift()); ) {
    try { await get(f); n++; } catch (e) { bad.push(String(e.message)); }
  }
}));
console.log(`public/aibasic: 기본 파일 ${files.length + 1}개, 이미지 ${n}/${imgs.length}개`);
if (bad.length) console.log("못 받은 것:", bad.join(", "));
