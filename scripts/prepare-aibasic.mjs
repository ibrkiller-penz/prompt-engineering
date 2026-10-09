// 배포 준비: /aibasic 복원 + 패치 적용 + HappyMpX.zip 받기. `npm run build` 앞에서 자동으로 돈다(prebuild).
// 이미 있는 파일은 건너뛰고, 이미 적용된 패치는 건너뛴다. 여러 번 돌려도 안전하다.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const AIBASIC = "public/aibasic";
// [패치 이름, 적용되면 생기는 표식이 든 파일, 표식] — 표식이 이미 있으면(배포본에 들어 있으면) 건너뛴다. 적용 순서대로.
const PATCHES = [
  ["aibasic-mobile", "index.html", 'property="og:title"'],
  ["aibasic-lockhint", "app.js", "lockSec"],
  ["aibasic-termgrid", "app.js", "'--tgc'"],
  ["aibasic-circle", "app.js", "okCircle"],
  ["aibasic-ogimage", "index.html", "og:image:width"],
];
const HAPPY = "public/happy/HappyMpX.zip";
const HAPPY_URL = "https://github.com/ibrkiller-penz/happymp3/releases/download/files-2026-10-08/HappyMpX.zip";

const git = (...args) => spawnSync("git", args, { encoding: "utf8" });

// 1) /aibasic 복원
if (!fs.existsSync(`${AIBASIC}/index.html`)) {
  console.log("[prepare] /aibasic 이 없어 배포본에서 내려받습니다…");
  const r = spawnSync(process.execPath, ["scripts/fetch-aibasic.mjs"], { stdio: "inherit" });
  if (r.status !== 0 || !fs.existsSync(`${AIBASIC}/index.html`)) {
    console.error("[prepare] /aibasic 을 받지 못했습니다. 이대로 배포하면 /aibasic 이 사이트에서 빠집니다.");
    process.exit(1);
  }
}

// 2) 패치 적용(이미 적용됐으면 건너뜀)
// 윈도우에서 받거나 적용하면 줄바꿈이 CRLF 가 되어 패치가 안 맞으므로, 패치 대상 파일은 먼저 LF 로 통일한다.
for (const f of ["index.html", "style.css", "app.js"]) {
  const path = `${AIBASIC}/${f}`;
  const txt = fs.readFileSync(path, "utf8");
  if (txt.includes("\r\n")) fs.writeFileSync(path, txt.replace(/\r\n/g, "\n"));
}
// 적용한 패치는 public/aibasic/.applied 에 적어 둔다(뒤 패치가 같은 줄을 고치면 앞 패치를 되돌려 확인할 수 없기 때문).
// 점(.)으로 시작하는 파일은 firebase.json 의 ignore 로 배포에서 빠진다.
const MARK = `${AIBASIC}/.applied`;
const applied = new Set(fs.existsSync(MARK) ? fs.readFileSync(MARK, "utf8").split("\n").filter(Boolean) : []);
const mark = (name) => { applied.add(name); fs.writeFileSync(MARK, [...applied].join("\n") + "\n"); };
for (const [name, target, signature] of PATCHES) {
  // 윈도우의 git 이 패치 파일을 CRLF 로 저장해 두면 적용이 안 되므로, LF 로 바꾼 임시 파일로 적용한다.
  const file = path.join(os.tmpdir(), `${name}.lf.patch`);
  fs.writeFileSync(file, fs.readFileSync(`scripts/${name}.patch`, "utf8").replace(/\r\n/g, "\n"));
  const opts = [`--directory=${AIBASIC}`, file];
  if (applied.has(name)) {
    console.log(`[prepare] ${name}: 이미 적용됨`);
  } else if (fs.readFileSync(`${AIBASIC}/${target}`, "utf8").includes(signature)) {
    mark(name); // 배포본에 이미 들어 있는 경우
    console.log(`[prepare] ${name}: 이미 들어 있음`);
  } else if (git("apply", "--check", ...opts).status === 0) {
    const r = git("apply", ...opts);
    if (r.status !== 0) { console.error(`[prepare] ${name} 적용 실패\n${r.stderr}`); process.exit(1); }
    mark(name);
    console.log(`[prepare] ${name}: 적용했습니다`);
  } else {
    console.error(`[prepare] ${name}: 적용할 수 없습니다(파일이 예상과 다름). public/aibasic 을 지우고 다시 실행해 보세요.`);
    process.exit(1);
  }
}

// 3) HappyMpX.zip (git 에 없는 큰 파일)
if (!fs.existsSync(HAPPY)) {
  console.log("[prepare] HappyMpX.zip 을 받습니다(약 55MB)…");
  try {
    const res = await fetch(HAPPY_URL);
    if (!res.ok) throw new Error(String(res.status));
    fs.mkdirSync("public/happy", { recursive: true });
    fs.writeFileSync(HAPPY, Buffer.from(await res.arrayBuffer()));
  } catch (e) {
    console.error(`[prepare] HappyMpX.zip 을 받지 못했습니다(${e.message}). 이대로 배포하면 사이트에서 빠집니다.`);
    process.exit(1);
  }
}
console.log("[prepare] 준비 완료");
