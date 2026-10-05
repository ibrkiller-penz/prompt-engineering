// 파이썬이 만든 인포그래픽 프롬프트와 화면(TS)이 만드는 글이 글자 하나까지 같은지 확인한다
import fs from "node:fs";
import { buildInfographic, makeCustomDesign, colorName, contrast } from "../src/pages/designTools.ts";

const data = JSON.parse(fs.readFileSync(new URL("../content/slides/slides.json", import.meta.url), "utf8"));
let bad = 0;
for (const d of data.designs) {
  const ts = buildInfographic(d);
  if (ts !== d.infographic) {
    bad++;
    let i = 0;
    while (i < ts.length && ts[i] === d.infographic[i]) i++;
    console.log("차이:", d.id, "위치", i, JSON.stringify(ts.slice(i - 20, i + 40)), "↔", JSON.stringify(d.infographic.slice(i - 20, i + 40)));
  }
}
console.log(`인포그래픽 일치: ${data.designs.length - bad}/${data.designs.length}`);

// 내 색 만들기: 기존 디자인 색을 그대로 넣으면 같은 글이 나와야 한다
const light = data.designs.find((x) => x.id === "classroom-bright");
const dark = data.designs.find((x) => x.id === "night-navy");
let badC = 0;
for (const d of data.designs.slice(2)) {
  const c = Object.fromEntries(d.colors.map((x) => [x.name, x.hex]));
  const pal = { bg: c.BG, text: c.TEXT_MAIN, sub: c.TEXT_SUB, a1: c.ACCENT_1, a2: c.ACCENT_2, point: c.POINT };
  const m = makeCustomDesign(light, dark, pal);
  const same = (k) => m[k] === d[k];
  // 어두운/밝은 틀과 같은 종류인 디자인만 slides/design 이 같다 (칠판·파스텔은 스타일 줄이 다름)
  const styleSame = m.slides.replace(/- Style:.*\n/, "").replace(/Type C \(Data\):.*\n/, "") === d.slides.replace(/- Style:.*\n/, "").replace(/Type C \(Data\):.*\n/, "");
  if (!styleSame) { badC++; console.log("내 색 차이:", d.id); }
}
console.log(`내 색(slides) 일치: ${data.designs.length - 2 - badC}/${data.designs.length - 2}`);
console.log(colorName("#4B5563"), colorName("#B7AFA3"), contrast("#1F2937", "#FFFFFF").toFixed(1));
process.exit(bad || badC ? 1 : 0);
