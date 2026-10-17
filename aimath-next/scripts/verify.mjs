#!/usr/bin/env node
// 배포 전 전체 검사. 차례:
//   tsc → node --test → check-content → build:s / build:t → check-es → check-css → check-leak / check-imports → check-contrast → smoke
// 모든 단계를 돌리고(빌드가 실패하면 빌드 결과를 보는 단계는 건너뛰어요) 하나라도 실패하면 1로 끝나요.
// 사용: node scripts/verify.mjs [--no-smoke] [--stop]   (--stop: 처음 실패에서 멈춤)
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const NO_SMOKE = args.indexOf("--no-smoke") >= 0;
const STOP = args.indexOf("--stop") >= 0;

/** 상위 node_modules/.bin 의 실행 파일(없으면 PATH 에 맡겨요) */
function bin(name) {
  for (const d of [path.join(ROOT, "node_modules", ".bin"), path.join(ROOT, "..", "node_modules", ".bin")]) {
    const f = path.join(d, name);
    if (fs.existsSync(f)) return f;
  }
  return name;
}

const node = process.execPath;
const steps = [
  { name: "tsc", cmd: bin("tsc"), args: ["-p", "tsconfig.json"] },
  { name: "node --test", cmd: node, args: ["--test", "tests/**/*.test.ts"] },
  { name: "check-content", cmd: node, args: ["scripts/check-content.mjs"] },
  { name: "build:s", cmd: bin("vite"), args: ["build", "--mode", "student", "--logLevel", "warn"], build: true },
  { name: "build:t", cmd: bin("vite"), args: ["build", "--mode", "teacher", "--logLevel", "warn"], build: true },
  { name: "check-es", cmd: node, args: ["scripts/check-es.mjs"], needsBuild: true },
  { name: "check-css", cmd: node, args: ["scripts/check-css.mjs"], needsBuild: true },
  { name: "check-leak", cmd: node, args: ["scripts/check-leak.mjs"], needsBuild: true },
  { name: "check-imports", cmd: node, args: ["scripts/check-imports.mjs"] },
  { name: "check-contrast", cmd: node, args: ["scripts/check-contrast.mjs"] },
  { name: "smoke", cmd: node, args: ["scripts/shots.mjs", "--smoke"], needsBuild: true, skip: NO_SMOKE },
];

const results = [];
let buildOk = true;
let stopped = false;
for (const s of steps) {
  if (stopped) {
    results.push({ name: s.name, status: "멈춤", ms: 0 });
    continue;
  }
  if (s.skip) {
    results.push({ name: s.name, status: "건너뜀", ms: 0 });
    continue;
  }
  if (s.needsBuild && !buildOk) {
    results.push({ name: s.name, status: "건너뜀(빌드 실패)", ms: 0, fail: true });
    continue;
  }
  if (!fs.existsSync(s.cmd) && s.cmd !== node && s.cmd.indexOf("/") >= 0) {
    console.error(`✗ ${s.name}: 실행 파일이 없어요 ${s.cmd}`);
  }
  console.log(`\n▶ ${s.name}`);
  const t0 = Date.now();
  const r = spawnSync(s.cmd, s.args, { cwd: ROOT, stdio: "inherit", env: { ...process.env, FORCE_COLOR: "0" } });
  const ms = Date.now() - t0;
  const ok = r.status === 0 && !r.error;
  if (r.error) console.error(`  ${s.name}: 실행하지 못했어요 — ${r.error.message}`);
  results.push({ name: s.name, status: ok ? "통과" : "실패", ms, fail: !ok });
  if (!ok && s.build) buildOk = false;
  if (!ok && STOP) stopped = true;
}

console.log("\n─── verify 결과 ───");
for (const r of results) console.log(`${r.fail ? "✗" : r.status === "통과" ? "✓" : "·"} ${r.name.padEnd(15)} ${r.status}${r.ms ? `  (${(r.ms / 1000).toFixed(1)}초)` : ""}`);
const failed = results.filter((r) => r.fail || r.status === "멈춤");
if (failed.length) {
  console.error(`\nverify: 실패 ${failed.length}단계 — ${failed.map((r) => r.name).join(", ")}. 배포하지 마세요.`);
  process.exit(1);
}
console.log("\nverify: 모두 통과했어요. 배포해도 좋아요(README 의 배포 명령).");
