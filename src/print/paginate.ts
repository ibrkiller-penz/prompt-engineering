// A4 쪽 맞추기: 블록을 쪽 단위로 배치하고, 남는 공간은 쓰기 칸을 늘려 채운다.
// - 어떤 블록도 두 쪽에 걸치지 않게 쪽 나눔(.pbreak)을 직접 넣는다.
// - 제목류는 다음 블록과 같은 쪽에 둔다.
// - 여는 이야기는 그림·글자 크기를 조절해 첫 쪽 한 장에 꼭 맞춘다.
const PX_PER_MM = 96 / 25.4;
/** @page 여백(위 13mm, 아래 14mm)을 뺀 A4 본문 높이 — 측정 오차를 위해 3mm 여유 */
const PAGE_H = (297 - 13 - 14 - 3) * PX_PER_MM;

/** 통째로 한 쪽에 있어야 하는 것 (쪼개지 않음) */
const NO_SPLIT = (el: Element) =>
  el.matches("table, tr, .box, .goals, .field, .today, .word, .sit, .passage, .match, .lines, .ans, p, li, img, .namebox-t") ||
  // 활동·프로젝트 단계·이야기 장면은 한 쪽에 들어가면 통째로 옮긴다
  (el.matches(".act, .step, .scene") && outer(el) <= PAGE_H);

const isHeading = (el: Element) =>
  /^H[1-6]$/.test(el.tagName) || el.matches(".ah, .cap, .fl, .doc-title, .kick, .st-title");

function outer(el: Element) {
  const cs = getComputedStyle(el);
  return el.getBoundingClientRect().height + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom);
}

/** 한 쪽보다 큰 블록은 자식 단위로 쪼갠다 (한 단계씩) */
function units(el: Element): Element[] {
  const out: Element[] = [];
  for (const c of Array.from(el.children)) {
    if (c.classList.contains("story") || c.classList.contains("pbreak") || c.classList.contains("vspace")) continue;
    // 이야기가 있으면 머리(제목·이름 칸)는 이야기 쪽에 있으므로 수업 쪽 계산에서 뺀다
    if (c.classList.contains("doc-title") && el.querySelector(":scope > .story")) continue;
    if (outer(c) > PAGE_H && c.children.length > 1) out.push(...units(c));
    else out.push(c);
  }
  return out;
}

/** 제목은 다음 블록과 묶는다 */
function groups(list: Element[]) {
  const gs: Element[][] = [];
  let pending: Element[] = [];
  for (const el of list) {
    pending.push(el);
    if (!isHeading(el)) {
      gs.push(pending);
      pending = [];
    }
  }
  if (pending.length) gs.push(pending);
  return gs;
}

/** 쪽에 놓인 블록들이 실제로 차지하는 높이 */
function span(page: Element[][]) {
  const first = page[0][0];
  const lastG = page[page.length - 1];
  const last = lastG[lastG.length - 1];
  const top = first.getBoundingClientRect().top - parseFloat(getComputedStyle(first).marginTop);
  const bottom = last.getBoundingClientRect().bottom + parseFloat(getComputedStyle(last).marginBottom);
  return bottom - top;
}

/**
 * 쪽의 남는 높이를 채운다: ① 쓰기 줄 더하기 ② 표 칸 키우기 ③ 블록 사이 간격.
 * 한 단계씩 늘리고 다시 재서, 넘치면 되돌린다 (어떤 경우에도 쪽을 넘지 않게).
 */
function fill(page: Element[][], limit: number, justify: boolean) {
  const els = page.flat();
  const fits = () => span(page) <= limit;
  if (!fits()) return;
  // ① 쓰기 줄: 뒤쪽 칸(생각 노트 등)부터 돌아가며 한 줄씩
  const boxes = els.flatMap((e) => [...(e.matches(".lines") ? [e] : []), ...Array.from(e.querySelectorAll(".lines"))]);
  for (let k = 0, stuck = 0; boxes.length && stuck < boxes.length; k++) {
    const box = boxes[boxes.length - 1 - (k % boxes.length)];
    const ln = document.createElement("div");
    ln.className = "ln";
    box.appendChild(ln);
    if (!fits()) {
      ln.remove();
      stuck++;
    } else stuck = 0;
  }
  // ② 표의 빈 칸: 줄마다 3mm씩 돌아가며
  const rows = Array.from(new Set(els.flatMap((e) => Array.from(e.querySelectorAll<HTMLElement>("td.w, td.w2")).map((c) => c.parentElement!))));
  const grown = new Map<Element, number>();
  for (let k = 0, stuck = 0; rows.length && stuck < rows.length; k++) {
    const r = rows[k % rows.length];
    if ((grown.get(r) ?? 0) >= 30 * PX_PER_MM) {
      stuck++;
      continue;
    }
    const cells = Array.from(r.querySelectorAll<HTMLElement>("td.w, td.w2"));
    const before = cells.map((c) => c.style.height);
    const step = 3 * PX_PER_MM;
    cells.forEach((c) => (c.style.height = `${c.getBoundingClientRect().height + step}px`));
    if (!fits()) {
      cells.forEach((c, i) => (c.style.height = before[i]));
      stuck++;
    } else {
      grown.set(r, (grown.get(r) ?? 0) + step);
      stuck = 0;
    }
  }
  // ③ 블록 사이 간격 (마지막 쪽은 하지 않음)
  if (justify && page.length > 1) {
    const spacers = page.slice(1).map((g) => {
      const sp = document.createElement("div");
      sp.className = "vspace";
      g[0].parentElement!.insertBefore(sp, g[0]);
      return sp;
    });
    let lo = 0;
    let hi = 30 * PX_PER_MM;
    const set = (h: number) => spacers.forEach((sp) => (sp.style.height = `${h}px`));
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      set(mid);
      if (fits()) lo = mid;
      else hi = mid;
    }
    set(lo);
  }
}

function fitStory(doc: HTMLElement) {
  const story = doc.querySelector<HTMLElement>(".story");
  if (!story) return;
  const title = doc.querySelector<HTMLElement>(".doc-title");
  const avail = PAGE_H - (title ? outer(title) : 0);
  const img = story.querySelector<HTMLElement>("img");
  const ps = Array.from(story.querySelectorAll<HTMLElement>("p"));
  let imgMm = 82;
  const elementary = doc.closest("[data-level='elementary']") !== null;
  const minFont = elementary ? 12 : 9.5;
  const maxFont = elementary ? 14 : 12.5;
  let font = elementary ? 13 : 11;
  let lh = 1.75;
  const apply = () => {
    if (img) img.style.maxHeight = img.style.height = `${imgMm}mm`;
    ps.forEach((p) => {
      p.style.fontSize = `${font}pt`;
      p.style.lineHeight = String(lh);
    });
  };
  apply();
  for (let i = 0; i < 60; i++) {
    const h = outer(story);
    if (Math.abs(avail - h) < 4 * PX_PER_MM) break;
    if (h > avail) {
      if (imgMm > 55) imgMm -= 4;
      else if (lh > 1.55) lh -= 0.05;
      else if (font > minFont) font -= 0.25;
      else break;
    } else {
      if (imgMm < 105) imgMm += 4;
      else if (lh < 1.95) lh += 0.05;
      else if (font < maxFont) font += 0.25;
      else break;
    }
    apply();
  }
  // 마지막으로 넘치면 한 단계 되돌린다
  if (outer(story) > avail && imgMm > 50) {
    imgMm -= 4;
    apply();
  }
}

export function paginate(root: HTMLElement) {
  root.querySelectorAll(".pbreak, .vspace").forEach((b) => b.remove());
  for (const doc of Array.from(root.querySelectorAll<HTMLElement>("section.doc"))) {
    fitStory(doc);
    const queue = groups(units(doc));
    let page: Element[][] = [];
    let used = 0;
    const pages: { groups: Element[][]; used: number }[] = [];
    const breakBefore = (el: Element) => {
      const br = document.createElement("div");
      br.className = "pbreak";
      el.parentElement!.insertBefore(br, el);
    };
    while (queue.length) {
      const g = queue.shift()!;
      const h = g.reduce((acc, e) => acc + outer(e), 0);
      if (used > 0 && used + h > PAGE_H) {
        const left = PAGE_H - used;
        const last = g[g.length - 1];
        // 남는 공간이 크고 블록을 나눌 수 있으면, 자식 단위로 쪼개서 들어가는 만큼 이 쪽에 넣는다
        const splittable = left > 35 * PX_PER_MM && last.children.length > 1 && !NO_SPLIT(last);
        if (splittable) {
          const inner = groups(Array.from(last.children));
          inner[0] = [...g.slice(0, -1), ...inner[0]];
          queue.unshift(...inner);
          continue;
        }
        pages.push({ groups: page, used });
        page = [];
        used = 0;
        breakBefore(g[0]);
      }
      page.push(g);
      used += h;
    }
    if (page.length) pages.push({ groups: page, used });
    // 마지막 쪽은 너무 늘리지 않는다 (생각 노트 정도만)
    pages.forEach((p, i) => fill(p.groups, PAGE_H, i !== pages.length - 1));
  }
}
