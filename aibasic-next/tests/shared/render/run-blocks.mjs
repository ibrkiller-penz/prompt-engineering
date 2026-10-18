// 블록 그리기 검사 실행기: vite 개발 서버(교사 모드 설정 그대로 + 시험 화면 한 장) + playwright 크로미움.
//   node tests/shared/render/run-blocks.mjs            → 표로 요약(사람이 볼 때)
//   import { runBlocks } from "./run-blocks.mjs"        → 시험에서 결과 배열을 받아요
// playwright 는 설치하지 않고 전역 경로(/opt/node-tools/node_modules)에서 찾아요. 없으면 null 을 돌려줘요.
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, "..", "..", "..");
const require = createRequire(import.meta.url);

export function loadPlaywright() {
  const tries = ["playwright", "/opt/node-tools/node_modules/playwright"];
  try {
    tries.push(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"));
  } catch {
    /* npm 이 없어도 괜찮아요 */
  }
  for (const t of tries) {
    try {
      return require(t);
    } catch {
      /* 다음 후보 */
    }
  }
  return null;
}

export function chromiumPath() {
  const p = "/opt/pw-browsers/chromium";
  if (!existsSync(p)) return undefined;
  // 폴더면 그 안의 실행 파일을 찾아요
  for (const c of ["", "/chrome", "/chrome-linux/chrome"]) {
    const f = p + c;
    try {
      if (existsSync(f) && !require("node:fs").statSync(f).isDirectory()) return f;
    } catch {
      /* 다음 */
    }
  }
  return undefined;
}

const HARNESS = "/__blocks.html";

function harnessPlugin() {
  return {
    name: "aibn-blocks-harness",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || req.url.split("?")[0] !== HARNESS) return next();
        const raw =
          '<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>블록 검사</title></head>' +
          '<body><div id="root"></div><script type="module" src="/tests/shared/render/blocks-harness.tsx"></script></body></html>';
        const html = await server.transformIndexHtml(req.url, raw);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(html);
      });
    },
  };
}

/** 개발 서버를 띄워요(끝나면 close) */
export async function startServer() {
  const { createServer } = await import("vite");
  const server = await createServer({
    configFile: path.join(appRoot, "vite.config.ts"),
    root: appRoot,
    mode: "teacher",
    logLevel: "error",
    server: { port: 0, host: "127.0.0.1", strictPort: false, hmr: false },
    plugins: [harnessPlugin()],
    optimizeDeps: { noDiscovery: false },
  });
  await server.listen();
  const addr = server.httpServer && server.httpServer.address();
  const port = addr && typeof addr === "object" ? addr.port : 0;
  return { server, base: "http://127.0.0.1:" + port };
}

/**
 * cases: [{ surface: "phone"|"board", fs?: 0..3, theme?: string, only?: "u1-1" }]
 * 돌려줌: { [이름]: BlockResult[] } 또는 playwright 가 없으면 null
 */
export async function runBlocks(cases) {
  const pw = loadPlaywright();
  if (!pw) return null;
  const { server, base } = await startServer();
  const browser = await pw.chromium.launch({ executablePath: chromiumPath() });
  const out = {};
  const errors = [];
  try {
    for (const c of cases) {
      const name = c.surface + "-fs" + (c.fs == null ? 1 : c.fs) + (c.theme ? "-" + c.theme : "");
      const vw = c.surface === "board" ? 1920 : 375;
      const page = await browser.newPage({ viewport: { width: vw, height: c.surface === "board" ? 1080 : 812 }, deviceScaleFactor: 1 });
      page.on("pageerror", (e) => errors.push(name + ": " + e.message));
      const qs = "?surface=" + c.surface + "&fs=" + (c.fs == null ? 1 : c.fs) + (c.theme ? "&theme=" + c.theme : "") + (c.only ? "&only=" + c.only : "");
      await page.goto(base + HARNESS + qs, { waitUntil: "load", timeout: 120000 });
      await page.waitForFunction(() => Array.isArray(window.__BLOCKS__), null, { timeout: 120000 });
      out[name] = await page.evaluate(() => window.__BLOCKS__);
      if (c.shot) await page.screenshot({ path: c.shot, fullPage: true });
      await page.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }
  return { results: out, errors };
}

// 직접 실행하면 요약을 찍어요
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const only = process.argv[2];
  const r = await runBlocks([
    { surface: "phone", fs: 1, only },
    { surface: "phone", fs: 3, only },
    { surface: "board", fs: 1, only },
  ]);
  if (!r) {
    console.log("playwright 를 찾지 못해 건너뛰어요.");
    process.exit(0);
  }
  for (const [name, list] of Object.entries(r.results)) {
    const bad = list.filter((x) => x.over > 1 || x.katexErr || x.empty);
    const tall = list.filter((x) => name.startsWith("board") && x.h > 852);
    const scr = list.filter((x) => x.scrolls);
    const types = {};
    for (const x of list) types[x.t] = (types[x.t] || 0) + 1;
    console.log(`\n[${name}] 블록 ${list.length}개 ${JSON.stringify(types)} · 문제 ${bad.length} · 스크롤 ${scr.length} · 무대보다 큼 ${tall.length}`);
    for (const x of bad) console.log("  넘침/오류", x.lid, x.path, x.t, "over=" + x.over, x.culprit, x.katexErr ? "katex=" + x.katexErr : "", x.empty ? "빈 그림" : "");
    for (const x of scr) console.log("  스크롤", x.lid, x.path, x.t, "w=" + x.w);
    for (const x of tall) console.log("  높이", x.lid, x.path, x.t, "h=" + x.h);
  }
  if (r.errors.length) console.log("\n페이지 오류:\n" + r.errors.join("\n"));
}
