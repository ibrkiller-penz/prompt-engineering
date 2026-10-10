// ai-study-math 사이트용 배포 준비: 허브(3개 목록)를 루트 index.html 로 두고, 원래 앱은 app.html 로 옮긴다.
// /mathplay·/aimath 등 앱 경로는 firebase.ai-study.json 의 rewrite 로 app.html 을 쓴다. /aibasic 은 정적 파일이다.
import fs from "node:fs";

const DIST = "dist";
fs.renameSync(`${DIST}/index.html`, `${DIST}/app.html`);
fs.copyFileSync("scripts/ai-study/hub.html", `${DIST}/index.html`);
console.log("[ai-study] index.html = 허브, app.html = 앱");
