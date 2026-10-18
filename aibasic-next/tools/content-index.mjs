// 콘텐츠 색인기. content/aibasic(원본)를 읽기만 하고 고치지 않아요.
// - vite 플러그인: virtual:content-index(작은 색인, 모든 화면), virtual:content-terms(사전, 사전 화면에서만)
// - 검사·생성 스크립트(scripts/*.mjs)와 시험(tests/*.test.ts)도 buildContentIndex 를 그대로 써요.
// 결과 모양은 src/shared/contracts.ts 의 ContentIndex · TermEntry 와 같아요.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
/** 원본 콘텐츠 폴더(저장소 뿌리의 content/aibasic). 시험용으로 AIBASIC_CONTENT_DIR 로 바꿀 수 있어요 */
export const CONTENT_DIR = process.env.AIBASIC_CONTENT_DIR ? path.resolve(process.env.AIBASIC_CONTENT_DIR) : path.resolve(here, "../../content/aibasic");

/** 기본 문제: group 에 '실력'·'도전'이 없는 것(인공지능 기초는 모든 문제가 기본 문제예요) */
export const isBasicGroup = (/** @type {string} */ g) => !/실력|도전/.test(g);
/** 계단 확인(원본 steps[i].check 에서 온 문제) */
export const isCheckGroup = (/** @type {string} */ g) => /^계단 확인/.test(g);
/** group 의 첫 마디 */
export const groupHead = (/** @type {string} */ g) => g.split(" · ")[0].trim();

const CHO = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
/** 초성 문자열: 한글 음절은 초성으로, 그 밖은 소문자로, 띄어쓰기는 뺌 */
export function choseong(/** @type {string} */ s) {
  let out = "";
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    if (c >= 0xac00 && c <= 0xd7a3) out += CHO[Math.floor((c - 0xac00) / 588)];
    else if (!/\s/.test(ch)) out += ch.toLowerCase();
  }
  return out;
}

/**
 * 화면 번호 표기. 원본 id(origId, 예 "2-1-3")가 있으면 단원 번호를 뺀 나머지를 써서 "Ⅱ-1-3"(활동은 "Ⅱ-A"),
 * 없으면 단원 안 순서 번호 "Ⅱ-3" 이에요.
 */
export const screenCode = (/** @type {string} */ roman, /** @type {number} */ n, /** @type {string | undefined} */ origId) =>
  roman + "-" + (origId && /^\d+-/.test(origId) ? origId.split("-").slice(1).join("-") : n);

function readJson(/** @type {string} */ file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/**
 * content/aibasic 를 읽어 색인·사전·파일 목록을 만들어요. 구조가 어긋나면(파일 없음, id 중복) 오류를 던져요.
 * @param {string} [dir]
 * @returns {{ index: import("../src/shared/contracts.ts").ContentIndex, terms: import("../src/shared/contracts.ts").TermEntry[], files: string[], lessons: Record<string, any>, unitDocs: Record<number, any> }}
 */
export function buildContentIndex(dir = CONTENT_DIR) {
  const files = [];
  const unitsFile = path.join(dir, "units.json");
  files.push(unitsFile);
  /** @type {any[]} */
  const unitsMeta = readJson(unitsFile);

  // 레슨 파일: uN/lesson-<id>.json 을 모두 읽어 id 로 찾아요(파일 이름과 화면 순서는 달라요)
  /** @type {Record<string, any>} */
  const lessons = {};
  /** @type {Record<string, string>} */
  const fileOf = {};
  /** @type {Record<number, any>} */
  const unitDocs = {};
  for (const u of unitsMeta) {
    const udir = path.join(dir, u.slug);
    if (!fs.existsSync(udir)) throw new Error(`단원 폴더가 없어요: ${u.slug}`);
    for (const f of fs.readdirSync(udir).sort()) {
      const full = path.join(udir, f);
      if (/^lesson-[0-9A-Za-z_]+\.json$/.test(f)) {
        const l = readJson(full);
        if (lessons[l.id]) throw new Error(`레슨 id 가 겹쳐요: ${l.id}`);
        lessons[l.id] = l;
        fileOf[l.id] = `${u.slug}/${f}`;
        files.push(full);
      } else if (f === "unit.json") {
        unitDocs[u.id] = readJson(full);
        files.push(full);
      }
    }
    if (!unitDocs[u.id]) throw new Error(`unit.json 이 없어요: ${u.slug}`);
  }

  const order = [];
  const seenQ = new Set();
  const addQ = (/** @type {string} */ id, /** @type {string} */ where) => {
    if (seenQ.has(id)) throw new Error(`문제 id 가 겹쳐요: ${id} (${where})`);
    seenQ.add(id);
  };
  /** @type {Record<string, any>} */
  const lessonIdx = {};
  const units = [];
  const widgetsUsed = [];
  let practiceTotal = 0;
  let testTotal = 0;

  for (const u of unitsMeta) {
    const lessonIds = [];
    u.lessons.forEach((/** @type {any} */ m, /** @type {number} */ i) => {
      const l = lessons[m.id];
      if (!l) throw new Error(`units.json 에 있는 레슨 파일이 없어요: ${m.id}`);
      if (l.unit !== u.id) throw new Error(`레슨 ${m.id} 의 unit(${l.unit})이 단원 ${u.id} 과 달라요`);
      lessonIds.push(m.id);
      order.push(m.id);
      /** @type {Record<string, number>} */
      const byGroup = {};
      /** @type {Record<string, number>} */
      const byType = {};
      const qids = [];
      const basicIds = [];
      const checkIds = [];
      for (const q of l.practice) {
        addQ(q.id, m.id);
        qids.push(q.id);
        if (isBasicGroup(q.group)) basicIds.push(q.id);
        if (isCheckGroup(q.group)) checkIds.push(q.id);
        const h = groupHead(q.group);
        byGroup[h] = (byGroup[h] || 0) + 1;
        byType[q.type] = (byType[q.type] || 0) + 1;
      }
      practiceTotal += qids.length;
      const widgetIds = [];
      const sections = l.sections.map((/** @type {any} */ s) => {
        const widgets = [];
        let examples = 0;
        let terms = 0;
        for (const b of s.blocks) {
          if (b.t === "widget") {
            widgets.push(b.id);
            if (widgetIds.indexOf(b.id) < 0) widgetIds.push(b.id);
            if (widgetsUsed.indexOf(b.id) < 0) widgetsUsed.push(b.id);
          } else if (b.t === "example") examples++;
          else if (b.t === "term") terms++;
        }
        return { heading: s.heading, blocks: s.blocks.length, widgets, examples, terms };
      });
      lessonIdx[m.id] = {
        id: m.id,
        unit: u.id,
        n: i + 1,
        code: screenCode(u.roman, i + 1, l.origId),
        title: l.title,
        short: m.short,
        chapter: m.chapter || l.chapter || "",
        subtitle: l.subtitle,
        minutes: l.minutes,
        file: fileOf[m.id],
        question: l.question,
        sections,
        goals: (l.goals || []).length,
        prereq: l.prereq && l.prereq.items ? l.prereq.items.length : 0,
        story: (l.story || []).length,
        summary: (l.summary || []).length,
        aiStory: l.aiStory ? l.aiStory.title : "",
        project: l.project ? l.project.title : "",
        qids,
        basicIds,
        checkIds,
        byGroup,
        byType,
        widgetIds,
        terms: (l.terms || []).length,
        prev: null,
        next: null,
      };
    });
    const doc = unitDocs[u.id];
    const testIds = [];
    for (const q of doc.test) {
      addQ(q.id, u.slug);
      testIds.push(q.id);
    }
    testTotal += testIds.length;
    units.push({
      id: u.id,
      slug: u.slug,
      roman: u.roman,
      title: u.title,
      short: u.short,
      desc: u.desc || "",
      icon: u.icon,
      color: u.color,
      soft: u.soft,
      file: `${u.slug}/unit.json`,
      lessonIds,
      testIds,
      stories: (doc.stories || []).length,
    });
  }

  // units.json 에 없는 레슨 파일이 있으면 알려요
  for (const id of Object.keys(lessons)) if (!lessonIdx[id]) throw new Error(`units.json 에 없는 레슨 파일이 있어요: ${fileOf[id]} (${id})`);

  order.forEach((id, i) => {
    lessonIdx[id].prev = i > 0 ? order[i - 1] : null;
    lessonIdx[id].next = i < order.length - 1 ? order[i + 1] : null;
  });

  // 사전: 레슨 화면 순서대로, 용어 카드 → 개념 속 term 블록. 같은 용어는 먼저 나온 것
  const terms = [];
  const seenT = new Set();
  for (const id of order) {
    const l = lessons[id];
    const push = (/** @type {string} */ term, /** @type {string} */ def) => {
      const key = String(term || "").trim();
      if (!key || seenT.has(key)) return;
      seenT.add(key);
      terms.push({ term: key, def, lid: id, unit: l.unit, cho: choseong(key) });
    };
    (l.terms || []).forEach((/** @type {any} */ t) => push(t.term, t.def));
    l.sections.forEach((/** @type {any} */ s) => s.blocks.forEach((/** @type {any} */ b) => b.t === "term" && push(b.term, b.def)));
  }
  terms.sort((a, b) => a.term.localeCompare(b.term, "ko"));

  const index = {
    v: /** @type {1} */ (1),
    units,
    lessons: lessonIdx,
    order,
    widgets: widgetsUsed,
    totals: { lessons: order.length, practice: practiceTotal, test: testTotal },
  };
  return { index: /** @type {any} */ (index), terms, files, lessons, unitDocs };
}

const V_INDEX = "virtual:content-index";
const V_TERMS = "virtual:content-terms";

/**
 * vite 플러그인: 빌드·개발 서버에서 색인 가상 모듈을 만들어요. 원본 파일이 바뀌면 다시 만들어요.
 * @param {string} [dir]
 * @returns {import("vite").Plugin}
 */
export function contentIndexPlugin(dir = CONTENT_DIR) {
  /** @type {ReturnType<typeof buildContentIndex> | null} */
  let cache = null;
  const get = () => (cache = cache || buildContentIndex(dir));
  return {
    name: "aibn-content-index",
    resolveId(id) {
      if (id === V_INDEX || id === V_TERMS) return "\0" + id;
      return null;
    },
    load(id) {
      if (id !== "\0" + V_INDEX && id !== "\0" + V_TERMS) return null;
      const built = get();
      for (const f of built.files) this.addWatchFile(f);
      const data = id === "\0" + V_INDEX ? built.index : built.terms;
      return `export default JSON.parse(${JSON.stringify(JSON.stringify(data))});`;
    },
    watchChange(id) {
      if (id.indexOf(dir) === 0) cache = null;
    },
    handleHotUpdate(ctx) {
      if (ctx.file.indexOf(dir) === 0) {
        cache = null;
        for (const v of [V_INDEX, V_TERMS]) {
          const mod = ctx.server.moduleGraph.getModuleById("\0" + v);
          if (mod) ctx.server.moduleGraph.invalidateModule(mod);
        }
      }
    },
  };
}
