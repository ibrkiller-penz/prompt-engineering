import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { BOARD_NAME, COURSE_NAME, HUB_NAME, SECTIONS } from "./src/site";

const ORIGIN = "https://penedu.web.app";

// 꼭지별 이름(카카오톡·문자 등 링크 미리보기에 나온다). 미리보기는 자바스크립트를 실행하지 않고
// HTML 만 읽으므로, 빌드할 때 꼭지마다 meta 가 다른 index.html 을 /꼭지/index.html 로 따로 만든다.
const PAGE_NAMES: Record<string, string> = {
  "/setup": "AI 맞춤 설정",
  "/prompt": COURSE_NAME,
  "/slides": "노트북LM 슬라이드 프롬프트",
  "/board": BOARD_NAME,
  "/aimath": "인공지능 수학",
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function sectionMeta(): Plugin {
  let outDir = "dist";
  return {
    name: "section-meta",
    apply: "build",
    configResolved(c) {
      outDir = path.resolve(c.root, c.build.outDir);
    },
    closeBundle() {
      const base = fs.readFileSync(path.join(outDir, "index.html"), "utf8");
      const tags = (name: string, desc: string, url: string) =>
        [
          `<meta property="og:type" content="website" />`,
          `<meta property="og:site_name" content="${esc(HUB_NAME)}" />`,
          `<meta property="og:title" content="${esc(name)}" />`,
          `<meta property="og:description" content="${esc(desc)}" />`,
          `<meta property="og:url" content="${url}" />`,
          `<meta property="og:image" content="${ORIGIN}/icon-512.png" />`,
          `<meta name="twitter:card" content="summary" />`,
        ].join("\n    ");
      const make = (name: string, desc: string, url: string, title: string) =>
        base
          .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
          .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(desc)}" />`)
          .replace("</head>", `  ${tags(name, desc, url)}\n  </head>`);

      // 허브(첫 화면)
      const hubDesc = "살빠진 임선생과 함께하는 교육자료";
      fs.writeFileSync(path.join(outDir, "index.html"), make(HUB_NAME, hubDesc, `${ORIGIN}/`, HUB_NAME));

      for (const [p, name] of Object.entries(PAGE_NAMES)) {
        const desc = SECTIONS.find((s) => s.path === p)?.desc ?? hubDesc;
        const dir = path.join(outDir, p);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "index.html"), make(name, desc, `${ORIGIN}${p}`, `${name} · ${HUB_NAME}`));
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), sectionMeta()],
});
