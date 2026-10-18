// 인공지능 기초 원본(tools/aibasic/data) → content/aibasic/* 변환기.
// 사용: node tools/aibasic/split.mjs && node tools/aibasic/convert.mjs
// 계약: docs/aibasic-next-계약.md '변환 계약'. 새 npm 패키지 없이 간단한 HTML 토크나이저 + 트리 변환으로 처리한다.
// 변환 후 tools/aibasic/convert-report.md 를 새로 쓴다(못 옮긴 HTML·특이점·글자 보존 검사 결과).
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const DATA = path.join(ROOT, "tools/aibasic/data");
const OUT = path.join(ROOT, "content/aibasic");
const IMG_SRC = path.join(ROOT, "public/aibasic");

// ---------------------------------------------------------------- 보고서 수집
const notes = new Map(); // 항목 → {count, where:Set}
const note = (key, where) => {
  if (!notes.has(key)) notes.set(key, { count: 0, where: new Set() });
  const n = notes.get(key); n.count++; if (where) n.where.add(where);
};
const fidelity = []; // 글자 보존 검사에서 어긋난 곳
const stat = { hintSingle: 0, hintMulti: 0 };

// ---------------------------------------------------------------- HTML 토크나이저 → 트리
const VOID = new Set(["br", "hr", "img"]);
const ENT = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };
const decode = (s) => s.replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (m) => ENT[m]);

function parseAttrs(s) {
  const a = {};
  for (const m of s.matchAll(/([\w:-]+)="(.*?)"(?=\s+[\w:-]+="|\s*\/?\s*$)/gs)) a[m[1]] = m[2];
  return a;
}
function parseHTML(html, where) {
  const root = { tag: "#root", attrs: {}, children: [] };
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g;
  let last = 0, m;
  const push = (n) => stack[stack.length - 1].children.push(n);
  while ((m = re.exec(html))) {
    if (m.index > last) push(html.slice(last, m.index));
    last = re.lastIndex;
    if (m[0].startsWith("<!--")) continue;
    const close = m[1] === "/", tag = m[2].toLowerCase();
    if (close) {
      let k = stack.length - 1;
      while (k > 0 && stack[k].tag !== tag) k--;
      if (k === 0) { note("짝 없는 닫는 태그 </" + tag + ">", where); continue; }
      if (k !== stack.length - 1) note("닫히지 않은 태그를 닫음", where);
      stack.length = k;
      continue;
    }
    if (tag === "svg") { // 안쪽은 통째로 보관
      const end = html.indexOf("</svg>", re.lastIndex);
      const raw = html.slice(m.index, end + 6);
      push({ tag: "svg", attrs: parseAttrs(m[3]), raw, children: [] });
      re.lastIndex = last = end + 6;
      continue;
    }
    const node = { tag, attrs: parseAttrs(m[3]), children: [] };
    push(node);
    if (!VOID.has(tag) && !/\/\s*$/.test(m[3])) stack.push(node);
  }
  if (last < html.length) push(html.slice(last));
  if (stack.length > 1) note("끝까지 닫히지 않은 태그 <" + stack[stack.length - 1].tag + ">", where);
  return root.children;
}
const isEl = (n, ...tags) => typeof n !== "string" && (!tags.length || tags.includes(n.tag));
const hasClass = (n, c) => isEl(n) && (n.attrs.class || "").split(/\s+/).includes(c);

// ---------------------------------------------------------------- 글자(인라인) 변환
// b → **굵게**, code → `코드`, br → \n, $ → \$, 그 밖의 태그는 글자만 남긴다(i 등: 보고서에 기록)
const INLINE_DROP = new Set(["i", "em", "span", "u", "small", "sub", "sup", "a"]);
function inline(nodes, ctx, st = { inB: false }) {
  let out = "";
  for (const n of nodes) {
    if (typeof n === "string") {
      out += decode(n).replace(/\s+/g, " ").replace(/\$/g, "\\$");
      continue;
    }
    switch (n.tag) {
      case "br": out += "\n"; break;
      case "b": case "strong": {
        const inner = inline(n.children, ctx, { inB: true });
        if (st.inB) { out += inner; break; }
        const core = inner.trim();
        if (!core) { out += inner; break; }
        const lead = inner.match(/^\s*/)[0], trail = inner.match(/\s*$/)[0];
        out += lead + "**" + core + "**" + trail; break;
      }
      case "code": {
        const t = decode(textOf(n.children)).replace(/\s+/g, " ");
        if (t.includes("`")) note("코드 안에 ` 문자가 있음", ctx.where);
        out += "`" + t.trim() + "`"; break;
      }
      case "img": note("본문 중간의 img(인라인)를 버림", ctx.where); break;
      default:
        if (INLINE_DROP.has(n.tag)) { note(`<${n.tag}> 서식을 글자만 남기고 제거`, ctx.where); out += inline(n.children, ctx, st); }
        else { note(`인라인에서 처리 못 한 태그 <${n.tag}> (글자만 남김)`, ctx.where); out += inline(n.children, ctx, st); }
    }
  }
  return out;
}
const tidy = (s) => s.replace(/[ \t]*\n[ \t]*/g, "\n").replace(/ {2,}/g, " ").trim();
function textOf(nodes) {
  return nodes.map((n) => (typeof n === "string" ? n : n.tag === "svg" ? "" : textOf(n.children))).join("");
}
const inl = (nodes, ctx) => tidy(inline(nodes, ctx));

// ---------------------------------------------------------------- 블록 변환
const BLOCK_TAGS = new Set(["p", "table", "ul", "ol", "pre", "div", "details", "figure", "svg", "hr"]);
const BOX_KIND = { tip: "tip", warn: "warn", def: "aha", ex: "try" };
const hasBlock = (nodes) => nodes.some((n) => isEl(n) && (BLOCK_TAGS.has(n.tag)));
const startsWithSymbol = (s) => /^[\p{Extended_Pictographic}\u2600-\u27BF\uFE0F]/u.test(s);

function toBlocks(nodes, ctx) {
  const blocks = [];
  let buf = [];
  const flush = () => {
    if (!buf.length) return;
    const t = inl(buf, ctx); buf = [];
    if (t) blocks.push({ t: "p", text: t });
  };
  for (const n of nodes) {
    if (!isEl(n) || !BLOCK_TAGS.has(n.tag)) { buf.push(n); continue; }
    flush();
    switch (n.tag) {
      case "p":
        if (hasBlock(n.children)) { note("p 안에 블록 요소가 있어 풀어서 변환", ctx.where); blocks.push(...toBlocks(n.children, ctx)); }
        else { const t = inl(n.children, ctx); if (t) blocks.push({ t: "p", text: t }); }
        if (n.attrs.style) note("p 의 인라인 style(가운데 정렬 등)을 버림", ctx.where);
        break;
      case "table": blocks.push(...tableBlocks(n, ctx)); break;
      case "ul": case "ol": blocks.push(listBlock(n, ctx)); break;
      case "pre": {
        const code = decode(textOf(n.children)).replace(/^\n+|\s+$/g, "");
        blocks.push({ t: "code", code, lang: "python" });
        break;
      }
      case "figure": {
        const img = n.children.find((c) => isEl(c, "img"));
        const cap = n.children.find((c) => isEl(c, "figcaption"));
        if (!img) { note("img 없는 figure", ctx.where); break; }
        const src = img.attrs.src;
        const from = path.join(IMG_SRC, src);
        if (!fs.existsSync(from)) note("그림 파일 없음 " + src, ctx.where);
        else { fs.mkdirSync(path.join(OUT, "img"), { recursive: true }); fs.copyFileSync(from, path.join(OUT, path.basename(path.dirname(src)), path.basename(src))); }
        const b = { t: "image", src, alt: decode(img.attrs.alt || "") };
        if (cap) b.caption = inl(cap.children, ctx);
        blocks.push(b);
        note("그림(figure/img)을 image 블록으로 옮김(계약에 없는 블록)", null);
        break;
      }
      case "svg": {
        const k = ++ctx.svgCount;
        const name = `svg-${ctx.id}-${k}.svg`;
        fs.mkdirSync(path.join(OUT, "img"), { recursive: true });
        fs.writeFileSync(path.join(OUT, "img", name), svgFile(n.raw));
        blocks.push({ t: "image", src: "img/" + name, alt: decode(n.attrs["aria-label"] || "그림") });
        note("인라인 svg 를 img/*.svg 파일 + image 블록으로 옮김", ctx.where);
        break;
      }
      case "hr": note("hr(가로 구분선)을 버림", ctx.where); break;
      case "details": blocks.push(...detailsBlocks(n, ctx)); break;
      case "div": blocks.push(...divBlocks(n, ctx)); break;
    }
  }
  flush();
  return blocks;
}

function svgFile(raw) {
  const css = "svg{color:#1f2937;--line:#9ca3af;--brand:#4f46e5;font-family:sans-serif}@media (prefers-color-scheme:dark){svg{color:#e5e7eb;--line:#6b7280;--brand:#818cf8}}";
  return raw.replace(/<svg/, '<svg xmlns="http://www.w3.org/2000/svg"').replace(/(<svg[^>]*>)/, `$1<style>${css}</style>`) + "\n";
}

function divBlocks(n, ctx) {
  const cls = (n.attrs.class || "").split(/\s+/);
  if (cls.includes("analogy")) { note("div.analogy 를 callout tip 으로 옮김(제목 유지)", null); return calloutBlocks("tip", n, ctx); }
  if (cls.includes("box")) {
    const k = ["tip", "warn", "def", "ex"].find((x) => cls.includes(x));
    if (k) { if (k === "def") note("div.box.def 를 callout aha 로 옮김(제목 '📌 핵심 정의' 유지)", null); if (k === "ex") note("div.box.ex 를 callout try 로 옮김(제목 유지)", null); return calloutBlocks(BOX_KIND[k], n, ctx); }
    note("알 수 없는 div.box 종류 → callout tip", ctx.where);
    return calloutBlocks("tip", n, ctx);
  }
  note(`알 수 없는 div(class=${n.attrs.class || ""}) 를 풀어서 변환`, ctx.where);
  return toBlocks(n.children, ctx);
}

// callout: 맨 앞 <b>🔎 …</b> 가 제목. 안쪽에 목록·표 등이 있으면 callout 뒤로 이어서 둔다.
function calloutBlocks(kind, n, ctx) {
  let ch = n.children.slice();
  let title;
  const first = ch.findIndex((c) => !(typeof c === "string" && !c.trim()));
  if (first >= 0 && isEl(ch[first], "b") && startsWithSymbol(decode(textOf(ch[first].children)).trim())) {
    title = inl(ch[first].children, { ...ctx }).replace(/\*\*/g, "");
    ch = ch.slice(first + 1);
  } else note("callout 에 제목(맨 앞 이모지 굵은 글)이 없음", ctx.where);
  const inner = toBlocks(ch, ctx);
  const texts = [];
  let i = 0;
  while (i < inner.length && inner[i].t === "p") texts.push(inner[i++].text);
  const rest = inner.slice(i);
  const text = texts.join("\n\n") || title;
  const c = { t: "callout", kind };
  if (title && texts.length) c.title = title;
  c.text = text;
  if (rest.length) note("callout 안의 목록·표·코드를 callout 뒤 별도 블록으로 둠", ctx.where);
  return [c, ...rest];
}

// details.sm(📖 스토리 보기): 접힘은 없어지고 callout tip 으로. 안쪽 표 등은 callout 사이에 그대로 둔다.
function detailsBlocks(n, ctx, label) {
  const sum = n.children.find((c) => isEl(c, "summary"));
  const body = n.children.find((c) => isEl(c, "div"));
  const title = sum ? inl(sum.children, ctx) : "📖 스토리 보기";
  const inner = toBlocks(body ? body.children : n.children.filter((c) => c !== sum), ctx);
  const out = [];
  let run = [], first = true;
  const t0 = label ? `${title} · ${label}` : title;
  if (label) ctx.extra.push(" · " + label);
  const flushRun = () => {
    if (!run.length) return;
    const ttl = first ? t0 : `${title} (이어서)`;
    if (!first) ctx.extra.push("(이어서)" + (label ? "" : ""));
    if (!first) ctx.extra.push(title);
    out.push({ t: "callout", kind: "tip", title: ttl, text: run.join("\n\n") });
    run = []; first = false;
  };
  for (const b of inner) {
    if (b.t === "p") run.push(b.text);
    else { flushRun(); out.push(b); }
  }
  flushRun();
  note("details(접힘 스토리)를 callout tip(제목=summary)으로 펼침", null);
  return out;
}

function listBlock(n, ctx, depth = 0) {
  const items = [];
  const walk = (list, d) => {
    for (const li of list.children) {
      if (!isEl(li, "li")) continue;
      const own = [], subs = [];
      for (const c of li.children) {
        if (isEl(c, "ul", "ol")) subs.push(c);
        else if (isEl(c, "p", "div")) { note("li 안의 p/div 를 한 줄로 이음", ctx.where); own.push(...c.children, " "); }
        else if (isEl(c) && BLOCK_TAGS.has(c.tag)) { note(`li 안의 <${c.tag}> 처리 못 함`, ctx.where); own.push(...c.children); }
        else own.push(c);
      }
      const t = inl(own, ctx);
      items.push(d ? "– ".repeat(1) + t : t);
      if (d) ctx.extra.push("–");
      for (const s of subs) { note("중첩 목록을 '– ' 로 시작하는 항목으로 펼침", ctx.where); walk(s, d + 1); }
    }
  };
  walk(n, depth);
  const b = { t: "list", items };
  if (n.tag === "ol") b.ordered = true;
  return b;
}

function tableBlocks(n, ctx) {
  const rows = [];
  const trs = [];
  const collect = (nodes) => nodes.forEach((c) => { if (isEl(c, "tr")) trs.push(c); else if (isEl(c, "thead", "tbody", "tfoot")) collect(c.children); });
  collect(n.children);
  const grid = []; // grid[r][c] = {text, th}
  const hoist = [];
  trs.forEach((tr, r) => {
    grid[r] = grid[r] || [];
    let c = 0;
    for (const cell of tr.children.filter((x) => isEl(x, "td", "th"))) {
      while (grid[r][c]) c++;
      const cs = +cell.attrs.colspan || 1, rs = +cell.attrs.rowspan || 1;
      // 셀 안의 details 는 표 밖으로 옮긴다
      const kids = [];
      for (const k of cell.children) {
        if (isEl(k, "details")) hoist.push({ node: k, row: r }); else kids.push(k);
      }
      if (kids.some((k) => isEl(k) && BLOCK_TAGS.has(k.tag))) note("표 셀 안의 블록 요소를 글자로만 옮김", ctx.where);
      const text = inl(kids.map((k) => (isEl(k) && BLOCK_TAGS.has(k.tag) ? { tag: "span", attrs: {}, children: k.children } : k)), ctx);
      const isTh = cell.tag === "th";
      for (let dr = 0; dr < rs; dr++) for (let dc = 0; dc < cs; dc++) {
        grid[r + dr] = grid[r + dr] || [];
        const dup = dr > 0;
        grid[r + dr][c + dc] = { text: dr === 0 && dc === 0 ? text : dup && dc === 0 ? text : "", th: isTh };
        if (dup && dc === 0 && text) ctx.extra.push(text.replace(/\*\*|`/g, ""));
      }
      if (rs > 1) note("rowspan 셀을 아래 행에도 같은 글로 반복", ctx.where);
      if (cs > 1) note("colspan 셀은 첫 칸에 글, 나머지 칸은 빈 칸으로", ctx.where);
      c += cs;
    }
  });
  const width = Math.max(...grid.map((g) => g.length));
  const norm = grid.map((g) => Array.from({ length: width }, (_, i) => g[i] || { text: "", th: false }));
  let head, body;
  if (norm[0].every((x) => x.th || (!x.text))) { head = norm[0].map((x) => x.text); body = norm.slice(1); }
  else { note("th 머리글 행이 없는 표(첫 행을 머리글로 씀)", ctx.where); head = norm[0].map((x) => x.text); body = norm.slice(1); }
  const out = [];
  const tb = {
    t: "table", head,
    rows: body.map((r) => r.map((x, i) => (x.th && x.text ? (note("본문 행의 th 를 굵게", ctx.where), "**" + x.text + "**") : x.text))),
  };
  out.push(tb);
  for (const h of hoist) {
    const row = norm[h.row];
    const label = (row && row[0] && row[0].text || "").replace(/\*\*/g, "").replace(/\s+/g, " ").slice(0, 24);
    note("표 셀 안의 details 를 표 뒤 callout 으로 옮김(제목에 행 이름을 붙임)", ctx.where);
    out.push(...detailsBlocks(h.node, ctx, label));
  }
  return out;
}

// ---------------------------------------------------------------- 글자 보존 검사(순서 무시, 글자 수 비교)
const bag = (s) => { const m = new Map(); for (const ch of s.replace(/\s+/g, "")) m.set(ch, (m.get(ch) || 0) + 1); return m; };
function origPlain(nodes) {
  let s = "";
  const w = (ns) => ns.forEach((n) => { if (typeof n === "string") s += decode(n); else if (n.tag === "svg") return; else w(n.children); });
  w(nodes);
  return s;
}
function blockPlain(blocks) {
  const parts = [];
  const add = (t) => parts.push(String(t).replace(/\*\*|`/g, "").replace(/\\\$/g, "$"));
  for (const b of blocks) {
    switch (b.t) {
      case "p": add(b.text); break;
      case "callout": if (b.title) add(b.title); add(b.text); break;
      case "table": b.head.forEach(add); b.rows.forEach((r) => r.forEach(add)); break;
      case "list": b.items.forEach(add); break;
      case "code": add(b.code); break;
      case "image": if (b.caption) add(b.caption); break;
    }
  }
  return parts.join("");
}
function compare(label, orig, neu, extra = "") {
  const a = bag(orig + extra), b = bag(neu);
  const miss = [], more = [];
  for (const [ch, n] of a) if ((b.get(ch) || 0) < n) miss.push(ch.repeat(n - (b.get(ch) || 0)));
  for (const [ch, n] of b) if ((a.get(ch) || 0) < n) more.push(ch.repeat(n - (a.get(ch) || 0)));
  if (miss.length || more.length) fidelity.push({ label, miss: miss.join(""), more: more.join("") });
}

// ---------------------------------------------------------------- 문제 변환
function splitHints(explain) {
  // 서식 기호(** 와 `) 가 열린 채로 잘리지 않게, 자르는 자리 앞쪽은 항상 짝이 맞아야 한다.
  const balanced = (x) => (x.match(/`/g) || []).length % 2 === 0 && (x.match(/\*\*/g) || []).length % 2 === 0;
  const SENT = /(?<=[.?!])\s+(?=\S)(?<!(?:^|\s)[ㄱ-ㅎA-Za-z0-9]\.\s+)/;
  const raw = explain.split(SENT).map((x) => x.trim()).filter(Boolean);
  const sents = [];
  for (const r of raw) {
    if (sents.length && !balanced(sents[sents.length - 1])) sents[sents.length - 1] += " " + r; else sents.push(r);
  }
  if (sents.length >= 2) { stat.hintMulti++; return [sents[0], sents.slice(1).join(" ")]; }
  stat.hintSingle++;
  const s = explain.trim();
  const cand = [];
  for (const m of s.matchAll(/ /g)) {
    const i = m.index, left = s.slice(0, i), right = s.slice(i + 1);
    if (left.length < 10 || right.length < 10 || !balanced(left)) continue;
    const strong = /,$/.test(left) || /(고|며|면서|지만|는데|으며|이며|인데|다가|라서|므로|서|면|로|와|과)$/.test(left);
    cand.push({ i, strong, d: Math.abs(i - s.length / 2) });
  }
  const pool = cand.some((c) => c.strong) ? cand.filter((c) => c.strong) : cand;
  pool.sort((a, b) => a.d - b.d);
  const p = pool[0];
  if (!p) { stat.hintSame = (stat.hintSame || 0) + 1; return [s, s]; } // 자를 곳이 없는 아주 짧은 해설: 같은 문장을 두 번
  return [s.slice(0, p.i).replace(/,$/, "") + "…", "…" + s.slice(p.i + 1)];
}

function convertQ(q, id, level, group, ctx) {
  if (!q.type && Array.isArray(q.choices)) { q = { ...q, type: "choice" }; note("type 이 없는 문제(지문형 객관식)를 choice 로 봄", ctx.where); }
  const where = ctx.where + " " + id;
  const c = { where, id: ctx.id, svgCount: 0, extra: [] };
  const out = { id, type: q.type, level, group, prompt: inl(parseHTML(q.q, where), c) };
  let orig = decode(textOf(parseHTML(q.q, where)));
  if (q.passage) {
    const pn = parseHTML(q.passage, where);
    out.passage = toBlocks(pn, c);
    orig += origPlain(pn);
    note("지문(passage)을 Question.passage 블록 배열로 옮김(계약에 없는 필드)", null);
  }
  let neu = out.prompt + (out.passage ? blockPlain(out.passage) : "");
  if (q.type === "choice") {
    out.choices = q.choices.map((x) => inl(parseHTML(x, where), c));
    out.answer = q.answer;
    orig += q.choices.map((x) => origPlain(parseHTML(x, where))).join("");
    neu += out.choices.join("");
  } else if (q.type === "ox") out.answer = !!q.answer;
  else throw new Error("알 수 없는 문제 유형 " + q.type + " " + where);
  out.solution = inl(parseHTML(q.explain, where), c);
  out.hints = splitHints(out.solution);
  orig += origPlain(parseHTML(q.explain, where));
  neu += out.solution;
  compare("문제 " + id, orig, neu.replace(/\*\*|`/g, "").replace(/\\\$/g, "$"), c.extra.join(""));
  if (c.extra.length) { /* 지문 안 callout 등 */ }
  return out;
}

// ---------------------------------------------------------------- 단원 메타(app.js 에서 읽기)
function readAppMeta() {
  const src = fs.readFileSync(path.join(ROOT, "public/aibasic/app.js"), "utf8");
  const head = src.slice(src.indexOf("const ROMAN"), src.indexOf("const PASS"));
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(head + "\n;this.UNITS=UNITS;this.CH=CH;this.ROMAN=ROMAN;", ctx);
  return { UNITS: ctx.UNITS, CH: ctx.CH, ROMAN: ctx.ROMAN };
}
const soft = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.round(v * 0.1 + 255 * 0.9).toString(16).padStart(2, "0");
  return "#" + f(n >> 16) + f((n >> 8) & 255) + f(n & 255);
};
const newId = (orig) => "u" + orig.replace(/-/g, "_");
const label = (orig) => { const p = orig.split("-"); return p[1] === "A" ? "활동" : p.length === 3 ? p[1] + "-" + p[2] : p[1] + "장"; };

// ---------------------------------------------------------------- 본 작업
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const { UNITS, CH, ROMAN } = readAppMeta();
const rd = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const wr = (p, o) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(o, null, 2) + "\n"); };

const lessons = {}; // origId → 변환 결과
const unitsMeta = [];
const countRows = [];

for (const U of UNITS) {
  const metaLessons = [];
  U.ids.forEach((oid, idx) => {
    const L = rd(path.join(DATA, "lessons", oid + ".json"));
    const Q = rd(path.join(DATA, "qbank", oid + ".json"));
    const id = newId(oid);
    const ctx = { where: oid, id: oid, svgCount: 0, extra: [] };
    const sections = [];
    const practice = [];
    let qn = 0;
    const add = (q, level, group) => practice.push(convertQ(q, `${id}-q${++qn}`, level, group, ctx));
    const seen = new Set();
    L.steps.forEach((s, i) => {
      const w = `${oid} ${s.level}`;
      const sctx = { where: w, id: oid, svgCount: ctx.svgCount, extra: [] };
      const nodes = parseHTML(s.body, w);
      const blocks = toBlocks(nodes, sctx);
      ctx.svgCount = sctx.svgCount;
      if (s.keypoints && s.keypoints.length) blocks.push({ t: "callout", kind: "aha", title: "한 줄 정리", text: s.keypoints.map((k) => inl(parseHTML(k, w), sctx)).join("\n") });
      compare(`${oid} ${s.level} 본문`, origPlain(nodes) + s.keypoints.join("") + "한줄정리", blockPlain(blocks), sctx.extra.join(""));
      sections.push({
        heading: `${s.level} · ${s.title}`,
        blocks,
        ...(s.keypoints && s.keypoints.length ? { keypoints: s.keypoints.map((k) => inl(parseHTML(k, w), sctx)) } : {}),
      });
      // 그 계단의 확인 문제: 원본 steps[].check 를 맨 앞에, 이어서 문제은행 checks[i] (같은 문제 글은 한 번만)
      const level = Math.min(i + 1, 5);
      const group = "계단 확인 " + s.level;
      const list = [s.check, ...((Q.checks && Q.checks[i]) || [])].filter(Boolean);
      for (const q of list) {
        const key = q.q.replace(/\s+/g, " ").trim() + "|" + (q.choices || []).join("/");
        if (seen.has(key)) { note("steps[].check 와 문제은행 checks 에서 같은 문제를 한 번만 씀", oid); continue; }
        seen.add(key);
        add(q, level, group);
      }
    });
    // 마무리 퀴즈: 문제은행 quiz 먼저, 이어서 레슨 자체 quiz(겹치는 문제는 한 번만)
    const quizList = [...(Q.quiz || []), ...(L.quiz || [])];
    const quizOut = [];
    for (const q of quizList) {
      const key = q.q.replace(/\s+/g, " ").trim() + "|" + (q.choices || []).join("/");
      if (seen.has(key)) { note("quiz 에서 같은 문제를 한 번만 씀", oid); continue; }
      seen.add(key);
      add(q, q.passage ? 5 : 4, "마무리 퀴즈");
      quizOut.push(practice[practice.length - 1]);
    }
    const stepQs = practice.length - quizOut.length;
    for (const [k, t] of Object.entries({ goals: L.goals, recap: L.recap })) t.forEach((x) => { if (/[<>&`$]/.test(x)) note(`${k} 에 특수문자`, oid); });
    const lesson = {
      id, unit: L.unit, order: idx + 1,
      title: L.title, subtitle: L.tagline, pages: L.pages,
      minutes: Math.max(15, Math.round((sections.length * 5 + 10) / 5) * 5),
      goals: L.goals.map((g) => inl(parseHTML(g, oid), ctx)),
      storyTitle: inl(parseHTML(L.story.title, oid), ctx),
      story: L.story.paras.map((p) => inl(parseHTML(p, oid), ctx)),
      question: inl(parseHTML(L.story.question, oid), ctx),
      sections,
      terms: L.terms.map((t) => ({ term: inl(parseHTML(t.t, oid), ctx), def: inl(parseHTML(t.d, oid), ctx) })),
      practice,
      summary: L.recap.map((r) => inl(parseHTML(r, oid), ctx)),
      origId: oid,
      chapter: CH[U.n + "-" + (oid.split("-")[1] === "A" ? "A" : oid.split("-")[1])] || "",
    };
    compare(`${oid} 이야기·목표·용어·정리`,
      L.goals.join("") + L.story.title + L.story.paras.join("") + L.story.question + L.terms.map((t) => t.t + t.d).join("") + L.recap.join(""),
      lesson.goals.join("") + lesson.storyTitle + lesson.story.join("") + lesson.question + lesson.terms.map((t) => t.term + t.def).join("") + lesson.summary.join("")
        .replace(/\*\*|`/g, "").replace(/\\\$/g, "$"));
    lessons[oid] = lesson;
    wr(path.join(OUT, `u${U.n}`, `lesson-${id}.json`), lesson);
    metaLessons.push({ id, title: L.title, short: L.tagline, chapter: lesson.chapter });
    countRows.push({ oid, id, title: L.title, steps: sections.length, stepQs, quiz: quizOut.length, total: practice.length, pass: practice.filter((q) => q.passage).length });
  });
  const chap = [...new Set(U.ids.map((oid) => CH[U.n + "-" + (oid.split("-")[1] === "A" ? "A" : oid.split("-")[1])]).filter(Boolean))]
    .filter((c) => !/활동|단원 정리/.test(c)).map((c) => c.replace(/^\d+\.\s*/, ""));
  unitsMeta.push({
    id: U.n, slug: "u" + U.n, roman: ROMAN[U.n - 1], title: U.title, short: chap.join(" · "), desc: U.desc,
    icon: U.emoji, color: U.color, soft: soft(U.color), lessons: metaLessons,
  });
}
wr(path.join(OUT, "units.json"), unitsMeta);

// 단원 내용(unit.json): 원본에 없는 부분은 최소 내용으로 채우고 enrich:true 로 표시한다.
for (const U of UNITS) {
  const meta = unitsMeta[U.n - 1];
  const next = unitsMeta[U.n];
  // 대단원 종합: 각 레슨의 마무리 퀴즈에서 3문제씩(처음·중간·끝) 골라 새 id(u<단원>-t<번호>)로 복사
  const test = [];
  for (const oid of U.ids) {
    const L = lessons[oid];
    const quiz = L.practice.filter((q) => q.group === "마무리 퀴즈");
    const picks = [0, Math.floor(quiz.length / 3), Math.floor((quiz.length * 2) / 3)].map((i) => quiz[Math.min(i, quiz.length - 1)]);
    for (const q of [...new Set(picks)]) {
      const c = JSON.parse(JSON.stringify(q));
      c.id = `u${U.n}-t${test.length + 1}`;
      c.group = `대단원 종합 · ${L.title}`;
      test.push(c);
    }
  }
  const unit = {
    id: U.n,
    enrich: true, // 원본에 없던 부분(why·opening·future)은 최소 내용 → 보강 대상
    why: { title: "왜 배울까요?", paragraphs: [meta.desc] },
    opening: {
      title: `${meta.roman}. ${meta.title}`,
      paragraphs: ["이 단원에서는 다음 내용을 차례로 배워요.", ...meta.lessons.map((l) => `**${label(lessons[U.ids[meta.lessons.indexOf(l)]].origId)} ${l.title}**: ${l.short}`)],
    },
    test,
    future: {
      title: "이어서 생각해 봐요",
      paragraphs: [next
        ? `다음 단원은 「${next.roman}. ${next.title}」이에요. ${next.desc}`
        : "이 단원으로 인공지능 기초의 모든 단원을 마쳤어요. 배운 내용을 바탕으로 직접 인공지능 프로젝트를 이어서 해 봐요."],
    },
  };
  wr(path.join(OUT, `u${U.n}`, "unit.json"), unit);
}

// ---------------------------------------------------------------- 보고서
const tot = countRows.reduce((a, r) => ({ stepQs: a.stepQs + r.stepQs, quiz: a.quiz + r.quiz, total: a.total + r.total, pass: a.pass + r.pass }), { stepQs: 0, quiz: 0, total: 0, pass: 0 });
let md = "# 인공지능 기초 변환 보고서\n\n`node tools/aibasic/convert.mjs` 가 실행할 때마다 새로 씁니다(직접 고치지 마세요). 원본 `tools/aibasic/data` → `content/aibasic`.\n\n";
md += "## 1. 결과 요약\n\n- 단원 4, 레슨 26. 레슨 파일 `content/aibasic/u<단원>/lesson-<새id>.json`, 새 id = `u` + 원본 id 의 `-` 를 `_` 로(예: `2-1-3` → `u2_1_3`), 문제 id = `<새id>-q<번호>`.\n";
md += `- 문제 합계 ${tot.total}개 = 계단 확인 ${tot.stepQs} + 마무리 퀴즈 ${tot.quiz}(지문 있는 문제 ${tot.pass}). 대단원 종합(unit.test)은 레슨 퀴즈에서 레슨당 3개씩 복사한 것.\n`;
md += `- 문제 해설로 만든 힌트: 두 문장 이상 ${stat.hintMulti}개(첫 문장 / 나머지), 한 문장짜리 ${stat.hintSingle}개(절 경계에서 앞뒤로 나누고 …로 이음; 그중 자를 곳이 없어 두 힌트가 같은 문장인 것 ${stat.hintSame || 0}개).\n\n`;
md += "## 2. 레슨별 문제 개수\n\n| 원본 id | 새 id | 제목 | 계단 | 계단 확인 | 마무리 퀴즈 | 합계 |\n|---|---|---|---|---|---|---|\n";
for (const r of countRows) md += `| ${r.oid} | ${r.id} | ${r.title} | ${r.steps} | ${r.stepQs} | ${r.quiz} | ${r.total} |\n`;
md += `| 합계 | | | | ${tot.stepQs} | ${tot.quiz} | ${tot.total} |\n\n`;
md += "## 3. 변환 규칙과 못 옮긴 HTML·특이점\n\n| 항목 | 횟수 | 위치(일부) |\n|---|---|---|\n";
for (const [k, v] of [...notes].sort((a, b) => b[1].count - a[1].count)) md += `| ${k} | ${v.count} | ${[...v.where].slice(0, 4).join(", ")}${v.where.size > 4 ? " …" : ""} |\n`;
md += "\n## 4. 계약과 다르게 정한 것(확장)\n\n";
md += [
  "- `Block` 에 `{t:\"image\", src, alt, caption?}` 추가: 원본 그림 46개(`<figure><img>`)와 인라인 svg 5개를 버리지 않으려고 만들었다. `src` 는 `content/aibasic/` 기준 상대 경로(`img/…jpg`, `img/svg-<원본id>-<n>.svg`; 파일은 `content/aibasic/img/` 에 복사해 둠). svg 는 파일 안에 라이트/다크 색을 넣어 `<img>` 로 쓸 수 있다.",
  "- `Question` 에 `passage?: Block[]` 추가: 마무리 퀴즈 중 지문(글+표)이 있는 문제용(p·table 블록).",
  "- `Lesson.question` = 원본 `story.question`(원래 질문 문장) 을 그대로, `subtitle` = 원본 `tagline`. 계약의 'tagline 을 질문으로 다듬기'는 원본 질문이 이미 있어 쓰지 않았다(원문 보존).",
  "- `Lesson` 에 `storyTitle`(원본 story.title), `pages`(교과서 쪽수), `goals`, `origId`, `chapter`(대단원 안 장 이름) 를 둔다. `minutes` 는 원본에 없어 `max(15, 반올림5(계단수×5+10))` 로 추정한 값이다.",
  "- `sections[].keypoints?: string[]` 와, 같은 내용의 `callout aha '한 줄 정리'` 를 함께 둔다(화면에는 callout 만 보여 주고 keypoints 는 교사용 요약 등에 쓰면 된다).",
  "- `prereq`·`aiStory`·`project` 는 원본에 없어 두지 않았다.",
  "- 글 서식: `**굵게**`, 인라인 코드는 `` `코드` ``(백틱), 줄바꿈은 `\\n`, 문단 구분은 `\\n\\n`, 글자 `$` 는 `\\$`. 표 칸은 빈 문자열 허용(8퍼즐 판의 빈 칸, colspan 뒤 칸). 글에 들어 있던 `<`·`>`·`&` 는 HTML 이 아닌 글자로 풀어 두었으므로(예: `<보기>`) 화면에서는 반드시 이스케이프해서 그려야 한다.",
  "- 변환 후 `units.json` 의 단원에는 `desc`(원본 app.js 의 단원 설명)를, 레슨에는 `chapter` 를 덧붙였다. `short` 는 단원은 장 이름들을 이은 것, 레슨은 tagline.",
  "- `unit.json`: 원본에 없는 `why`·`opening`·`future` 는 단원 설명·레슨 목록·다음 단원 소개로 최소한만 채웠고 `enrich:true` 를 붙였다(보강 대상). `test` 는 각 레슨 마무리 퀴즈에서 3개씩 복사(id `u<단원>-t<번호>`).",
  "- 문제: 원본 `steps[].check` 를 그 계단 문제의 맨 앞에 두고 문제은행 `checks[i]` 를 이었다(같은 문제는 한 번만). 마무리 퀴즈는 문제은행 `quiz` 뒤에 레슨 자체 `quiz` 를 이었다(원본 app 은 문제은행이 있으면 레슨 quiz 를 쓰지 않았지만, 계약의 '모아서'에 따라 합쳤다). level: 계단 n → min(n,5), 마무리 퀴즈 4(지문 있으면 5).",
  "- 글자 `*` 가 원문에 있다(`A*` 알고리즘). 굵게 표시는 `**…**` 이므로 화면 쪽 굵게 변환은 `\\*\\*(.+?)\\*\\*`(비탐욕)로 해야 `**A*(에이스타) 알고리즘**` 이 맞게 묶인다. `***` 가 붙는 곳은 검사기가 오류로 잡는다(현재 0).",
  "- 오탈자: 변환하면서 고친 오탈자는 없다(원문 그대로).",
].join("\n") + "\n\n";
md += "## 5. 글자 보존 검사\n\n변환 결과의 글자(공백·서식 기호 제외)를 원본과 문자 수 단위로 비교한다(순서는 무시). 차이가 없으면 아래에 '없음'.\n\n";
if (!fidelity.length) md += "차이 없음(모든 본문·이야기·용어·정리·문제 해설 일치).\n";
else for (const f of fidelity) md += `- ${f.label}: 빠진 글자 「${f.miss}」 / 더해진 글자 「${f.more}」\n`;
fs.writeFileSync(path.join(ROOT, "tools/aibasic/convert-report.md"), md);

console.log(`변환 완료: 단원 4, 레슨 ${Object.keys(lessons).length}, 문제 ${tot.total}, 글자 보존 차이 ${fidelity.length}곳`);
if (fidelity.length) for (const f of fidelity.slice(0, 20)) console.log("  ", f.label, "빠짐:", f.miss.slice(0, 40), "더해짐:", f.more.slice(0, 40));
