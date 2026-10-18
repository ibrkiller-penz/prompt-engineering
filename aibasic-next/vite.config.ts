// 인공지능 기초 고도화판 — 한 코드에서 두 사이트를 빌드해요.
//   vite build --mode student → dist-s (학생용 https://aibasics.web.app)
//   vite build --mode teacher → dist-t (교사용 https://aibasict.web.app)
// @site 별칭이 src/student 또는 src/teacher 를 가리켜서, 학생 빌드의 의존 그래프에는 교사 코드가 아예 들어가지 않아요.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { CONTENT_DIR, contentIndexPlugin } from "./tools/content-index.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

type Site = "student" | "teacher";

/** 배포(firebase.json)와 미리보기에서 함께 쓰는 보안 헤더. 바꿀 때는 firebase.json 도 같이 바꿔요 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'", // React 의 style 속성(칠판 배율 등)
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join("; ");

export function securityHeaders(site: Site): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Security-Policy": CSP,
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=(), fullscreen=(self)",
    "X-Content-Type-Options": "nosniff",
  };
  if (site === "teacher") h["X-Robots-Tag"] = "noindex, nofollow";
  return h;
}

const META: Record<Site, { title: string; desc: string; theme: string; robots: string }> = {
  student: {
    title: "인공지능 기초",
    desc: "고등학교 인공지능 기초를 휴대폰으로 혼자서도 공부해요. 카드 한 장씩, 이야기와 문제로 쉽게.",
    theme: "#1f3a6b",
    robots: "index, follow",
  },
  teacher: {
    title: "인공지능 기초 · 교사용",
    desc: "전자칠판으로 인공지능 기초 수업을 '다음' 한 번에 진행해요.",
    theme: "#8e2a26",
    robots: "noindex, nofollow",
  },
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** index.html 하나를 모드별로 채워요(제목·설명·robots·viewport·html 속성) */
function siteHtml(site: Site): Plugin {
  const m = META[site];
  return {
    name: "aibn-site-html",
    transformIndexHtml(html) {
      return html
        .replace(/__SITE__/g, site)
        .replace(/__SURFACE__/g, site === "teacher" ? "prep" : "phone")
        .replace(/__TITLE__/g, esc(m.title))
        .replace(/__DESC__/g, esc(m.desc))
        .replace(/__THEME_COLOR__/g, m.theme)
        .replace(/__ICON__/g, site === "teacher" ? "favicon-t.svg" : "favicon-s.svg")
        .replace(/__ROBOTS__/g, m.robots);
    },
  };
}

/** 콘텐츠 그림(content/aibasic/img)을 개발 서버와 빌드 결과(c/img/)에 함께 내보내요. 따로 복사하지 않아요 */
function contentImages(): Plugin {
  const dir = path.join(CONTENT_DIR, "img");
  const files = () => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.(jpg|jpeg|png|webp|svg)$/.test(f)) : []);
  const type = (n: string) => (n.endsWith(".svg") ? "image/svg+xml" : n.endsWith(".png") ? "image/png" : n.endsWith(".webp") ? "image/webp" : "image/jpeg");
  return {
    name: "aibn-content-images",
    configureServer(server) {
      server.middlewares.use("/c/img", (req, res, next) => {
        const name = decodeURIComponent((req.url || "").split("?")[0].replace(/^\//, ""));
        if (files().indexOf(name) < 0) return next();
        res.setHeader("Content-Type", type(name));
        res.end(fs.readFileSync(path.join(dir, name)));
      });
    },
    generateBundle() {
      for (const f of files()) this.emitFile({ type: "asset", fileName: "c/img/" + f, source: fs.readFileSync(path.join(dir, f)) });
    },
  };
}

export default defineConfig(({ mode, command }) => {
  let site: Site;
  if (mode === "student" || mode === "teacher") site = mode;
  else {
    if (command === "build") throw new Error(`빌드할 때는 --mode student 또는 --mode teacher 를 꼭 붙여요(지금: ${mode}).`);
    site = "student";
  }
  const outDir = site === "teacher" ? "dist-t" : "dist-s";

  return {
    root: here,
    base: "/",
    publicDir: "public",
    plugins: [react(), contentIndexPlugin(CONTENT_DIR), siteHtml(site), contentImages()],
    define: {
      __SITE__: JSON.stringify(site),
    },
    resolve: {
      alias: [
        { find: /^@site\//, replacement: path.resolve(here, "src", site) + "/" },
        { find: /^@shared\//, replacement: path.resolve(here, "src/shared") + "/" },
        { find: /^@data\//, replacement: path.resolve(here, "data") + "/" },
        { find: /^@content\//, replacement: CONTENT_DIR + "/" },
      ],
    },
    server: {
      fs: { allow: [repoRoot] },
    },
    preview: {
      headers: securityHeaders(site),
    },
    build: {
      outDir,
      emptyOutDir: true,
      target: "chrome80",
      cssTarget: "chrome80",
      sourcemap: false,
      chunkSizeWarningLimit: 900,
      reportCompressedSize: false,
    },
  };
});
