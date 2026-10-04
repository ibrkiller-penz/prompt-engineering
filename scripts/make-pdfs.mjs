// 미리 만든 활동지 PDF 생성 (사회 학습실 social-study 의 make-pdfs.mjs 와 같은 방식)
//   npm run pdfs
// = 빌드 → vite preview(4175) → 인쇄용 화면(/prompt/print)을 Edge/Chrome으로 열어 PDF 저장
//   → public/pdf/prompt/{level}-{NN}.pdf, {level}-all.pdf, {level}-answers.pdf
//   → src/print/pdf-manifest.json (파일 목록·크기) 갱신 후 다시 빌드
import { spawn, execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(ROOT, "public", "pdf", "prompt");
const PORT = 4175;
const BASE = `http://localhost:${PORT}`;
const BROWSERS = [
  process.env.BROWSER,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);
const exe = BROWSERS.find((p) => existsSync(p));
if (!exe) throw new Error("Edge/Chrome 을 찾지 못했어요. BROWSER 환경변수로 경로를 알려 주세요.");

// 콘텐츠 폴더에서 학교급별 열린 차시 찾기
const levels = {};
for (const lv of ["elementary", "middle", "high"]) {
  const dir = join(ROOT, "content", "prompt", lv);
  if (!existsSync(dir)) continue;
  const ns = readdirSync(dir)
    .map((f) => f.match(/^lesson-(\d+)\.json$/)?.[1])
    .filter(Boolean)
    .map(Number)
    .sort((a, b) => a - b);
  if (ns.length) levels[lv] = ns;
}

mkdirSync(OUT, { recursive: true });
execSync("npx vite build", { cwd: ROOT, stdio: "inherit" });
const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { cwd: ROOT, shell: true });
await new Promise((r) => setTimeout(r, 2500));

const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage();
const make = async (query, file) => {
  await page.goto(`${BASE}/prompt/print?${query}`, { waitUntil: "networkidle" });
  await page.waitForSelector("body[data-paged='1']", { timeout: 30000 });
  await page.pdf({ path: join(OUT, file), preferCSSPageSize: true, printBackground: true });
  console.log("made", file);
};

try {
  for (const [lv, ns] of Object.entries(levels)) {
    for (const n of ns) await make(`level=${lv}&l=${n}&p=lesson`, `${lv}-${String(n).padStart(2, "0")}.pdf`);
    await make(`level=${lv}&l=all&p=lesson`, `${lv}-all.pdf`);
    await make(`level=${lv}&l=all&p=ans`, `${lv}-answers.pdf`);
  }
} finally {
  await browser.close();
  server.kill();
  // shell:true 로 띄운 preview 서버는 kill() 로 안 꺼질 때가 있어 포트로 찾아 끈다 (Windows)
  if (process.platform === "win32") {
    try {
      const pid = execSync(`netstat -ano | findstr :${PORT} | findstr LISTENING`, { encoding: "utf8" })
        .trim()
        .split(/\s+/)
        .pop();
      if (pid) execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
    } catch {
      /* 이미 꺼짐 */
    }
  }
}

const manifest = {};
for (const f of readdirSync(OUT).filter((f) => f.endsWith(".pdf")).sort())
  manifest[f] = { kb: Math.round(statSync(join(OUT, f)).size / 1024) };
const mPath = join(ROOT, "src", "print", "pdf-manifest.json");
const before = existsSync(mPath) ? readFileSync(mPath, "utf8") : "";
writeFileSync(mPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`manifest: ${Object.keys(manifest).length} files`);
if (before !== readFileSync(mPath, "utf8")) execSync("npx vite build", { cwd: ROOT, stdio: "inherit" });
process.exit(0);
