/* =====================================================================
   물리 시뮬레이터 실험실 — 설명 도식 도우미 SimDiagram (R7 1차, 2026-10-30)
   일반 <script> 로 sim.js 다음·lesson.js 앞에 불러온다(fetch·module 없음, file:// 동작). 전역: window.SimDiagram
   설명 장의 svg: function (D) { return D.svg([ D.axis(…), D.arrow(…), … ], {title, how}); }

   규칙 (docs/개선/R7_1차_계획.md §1-7)
     · viewBox 800×450 고정(16:9, width 100%). 화살표 마커 4종은 svg 마다 <defs> 한 번.
     · 색은 CSS 변수만: var(--sim) 주 대상 · var(--color-ink-muted) 보조선·눈금 · var(--color-warn) 강조·오개념 · var(--sim-tint) 바탕 막
       (렌즈 세 광선만 실험 화면과 같은 기록 색 var(--color-rec-1~3) · 선 모양 var(--dash-rec-1~3))
       새 hex 금지 · 한 도식 4색 이하 · 색만으로 구분하지 않는다(선 모양·라벨 함께).
     · 글자: 라벨 최소 16(viewBox 단위, 기본 22), 굵기 400/500, 숫자 tabular. 수식은 '$v_0$' 표기(기울임 + 아래첨자).
   함수 (모두 SVG 조각 문자열을 돌려준다 — 배열로 D.svg 에 넣는다)
     D.svg(kids, {title, how})                       전체 <svg> (title = 왼쪽 위 그림 제목 20, how = 아래 '읽는 법' 글 — 설명 층이 그림 밑에 보여 줌)
     D.arrow(x1,y1,x2,y2,{kind:'v'|'a'|'f'|'comp'|'sum', label, lx, ly, color})
                                                     v 속도 = 실선 2.5 · a/f 가속도·힘 = 굵은 4 + 큰 머리(주홍) · comp 성분 = 점선 1.5 · sum 합 = 이중선
     D.axis(x,y,w,h,{xl, yl, ticks:[{v:px, t:'10'}], yticks})   원점 (x,y), 오른쪽 w · 위쪽 h
     D.dim(x1,y1,x2,y2,label,{off})                  치수선(양끝 눈금 + 가운데 글)
     D.angle(cx,cy,r,a0,a1,label)                    각도 호(도, 수학 방향 — 위가 +)
     D.ray(pts,{style:1|2|3})                        렌즈 세 광선(실험 화면 ray1~3 과 같은 색·선 모양)
     D.label(x,y,text,{bg, anchor, size, color, weight, italic, sym})   R7-2: bg 기본 true(바탕색 테두리 — 글자가 선 위에서도 읽힘, 끄려면 bg:false)
                                                     sym:'v_0' → data-sym (설명 기호표의 기호 단추를 누르면 그림 속 같은 기호가 1.2초 강조)
     D.frac(x,y,num,den,{size, color, anchor, sym})  R7-2: 도식 라벨용 분수(가로 막대) — '÷'·'/' 대신
     R7-2: D.arrow kind 'a'|'f'(가속도·힘) = 구리색 토큰 var(--color-q-force) 고정 · 화살 라벨은 화살 끝에서 28(머리와 10 더 띄움)
     D.line(x1,y1,x2,y2,{color, w, dash}) · D.path(d,{…, fill}) · D.curve(pts,{…}) · D.dots(pts,{r, color})
     D.ball(x,y,r,{color, label}) · D.box(x,y,w,h,{label, color}) · D.lens(x,y,h) · D.slit(x,y,h,{gap, sep}) · D.screen(x,y,h) · D.planet(x,y,r,{label})
     D.group(kids,{transform, opacity}) · D.C (색 이름표)
   ===================================================================== */
(function (global) {
  'use strict';

  var C = {
    sim: 'var(--sim)', muted: 'var(--color-ink-muted)', warn: 'var(--color-warn)', tint: 'var(--sim-tint)',
    ink: 'var(--color-ink)', paper: 'var(--color-paper-raised)', line: 'var(--color-line-strong)',
    ray1: 'var(--color-rec-1)', ray2: 'var(--color-rec-2)', ray3: 'var(--color-rec-3)',
    force: 'var(--color-q-force)',   // R7-2: 힘·가속도 화살표 = 구리색(실험 화면 계기 '힘' 색과 같음)
    chip: 'var(--color-ink-chip)'    // R7-3(S7): 보조 글자(눈금·축 이름·그림 제목) — muted 보다 진하게(선은 muted 그대로)
  };
  /** 기호 비교용: '$v_{0}$' → 'v_0' (lesson.js 와 같은 규칙) */
  function normSym(s) { return String(s || '').replace(/[$\s{}\\]/g, ''); }
  function col(c, d) { return C[c] || c || C[d || 'sim']; }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function n(v) { return Math.round(v * 10) / 10; }
  function join(kids) { return (Array.isArray(kids) ? kids : [kids]).filter(function (k) { return k !== null && k !== undefined && k !== false; }).join(''); }

  /** '$v_0$ 처음 속력' → <tspan> 런(수식 = 기울임 세리프, _x / _{xy} = 아래첨자, ^2 = 위첨자) */
  function tspans(text) {
    var out = '', parts = String(text).split('$');
    parts.forEach(function (seg, i) {
      if (!seg) return;
      if (i % 2 === 0) { out += '<tspan>' + esc(seg) + '</tspan>'; return; }
      var fn = seg.split(/\\(sin|cos|tan|ln|log)\s*/);   // \cos 같은 함수 이름은 바로 선 글자
      if (fn.length > 1) { fn.forEach(function (f, k) { if (k % 2) out += '<tspan> ' + f + ' </tspan>'; else if (f) out += tspans('$' + f + '$'); }); return; }
      var re = /([_^])(\{[^}]*\}|.)/g, last = 0, m;
      while ((m = re.exec(seg))) {
        if (m.index > last) out += mathRun(seg.slice(last, m.index));
        var s = m[2].charAt(0) === '{' ? m[2].slice(1, -1) : m[2];
        var dy = m[1] === '_' ? '0.3em' : '-0.45em';
        out += '<tspan dy="' + dy + '" style="font-size:0.7em;font-family:var(--font-math);font-style:normal">' + scriptRun(s, m[1] === '_') + '</tspan><tspan dy="' + (m[1] === '_' ? '-0.3em' : '0.45em') + '"></tspan>';
        last = re.lastIndex;
      }
      if (last < seg.length) out += mathRun(seg.slice(last));
    });
    return out;
  }
  /** R7-3(S7): 첨자 글자 — 아래첨자가 변수(x y z t 한 글자)면 그 글자만 기울임, 숫자·이름(k p max esc)은 직립, 한글은 본문 글꼴 (sim.js mathRuns 와 같은 판정) */
  function scriptRun(s, isSub) {
    var letters = s.replace(/[^A-Za-zα-ω]/g, ''), v = isSub && /^[xyzt]$/.test(letters);
    return s.replace(/([가-힣]+)|([A-Za-zα-ω])|([^A-Za-zα-ω가-힣]+)/g, function (all, hg, lt, ot) {
      if (hg) return '<tspan style="font-family:var(--font-sans)">' + esc(hg) + '</tspan>';
      if (lt) return v && lt === letters ? '<tspan style="font-style:italic">' + esc(lt) + '</tspan>' : esc(lt);
      return esc(ot);
    });
  }
  function mathRun(s) {
    // 영문 글자만 기울임, 숫자·기호는 바로
    return s.replace(/([A-Za-zα-ωΔθλ]+)|([^A-Za-zα-ωΔθλ]+)/g, function (all, a, b) {
      return a ? '<tspan style="font-family:var(--font-math);font-style:italic">' + esc(a) + '</tspan>' : '<tspan>' + esc(b) + '</tspan>';
    });
  }

  var MARK = { sim: 'dg-m-sim', warn: 'dg-m-warn', muted: 'dg-m-muted', ink: 'dg-m-ink', force: 'dg-m-force' };
  function defs() {
    function m(id, color, size) {
      return '<marker id="' + id + '" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="' + size + '" markerHeight="' + size + '" orient="auto-start-reverse" markerUnits="strokeWidth">' +
        '<path d="M0 0.8L10 5L0 9.2z" style="fill:' + color + '"/></marker>';
    }
    return '<defs>' + m(MARK.sim, C.sim, 4.2) + m(MARK.warn, C.warn, 3.4) + m(MARK.muted, C.muted, 5.5) + m(MARK.ink, C.ink, 4.2) + m(MARK.force, C.force, 3.4) + '</defs>';
  }

  var D = {};
  D.C = C;
  D.svg = function (kids, o) {
    o = o || {};
    var title = o.title ? '<text x="20" y="34" style="font-size:22px;font-weight:500;fill:' + C.chip + '">' + tspans(o.title) + '</text>' : '';
    return '<svg class="dg" viewBox="0 0 800 450" role="img" aria-label="' + esc((o.title || '') + (o.how ? ' — ' + o.how : '')) + '"' +
      (o.how ? ' data-how="' + esc(o.how) + '"' : '') + ' style="font-size:22px;font-weight:400">' + defs() + title + join(kids) + '</svg>';
  };
  D.group = function (kids, o) { o = o || {}; return '<g' + (o.transform ? ' transform="' + esc(o.transform) + '"' : '') + (o.opacity !== undefined ? ' opacity="' + o.opacity + '"' : '') + '>' + join(kids) + '</g>'; };
  D.line = function (x1, y1, x2, y2, o) {
    o = o || {};
    return '<line x1="' + n(x1) + '" y1="' + n(y1) + '" x2="' + n(x2) + '" y2="' + n(y2) + '" style="stroke:' + col(o.color, 'muted') + ';stroke-width:' + (o.w || 2) + (o.dash ? ';stroke-dasharray:' + o.dash : '') + ';stroke-linecap:round"/>';
  };
  D.path = function (d, o) {
    o = o || {};
    return '<path d="' + esc(d) + '" style="fill:' + (o.fill ? col(o.fill) : 'none') + ';stroke:' + (o.stroke === false ? 'none' : col(o.color, 'sim')) + ';stroke-width:' + (o.w || 2.5) + (o.dash ? ';stroke-dasharray:' + o.dash : '') + ';stroke-linecap:round;stroke-linejoin:round"' + (o.marker ? ' marker-end="url(#' + MARK[o.marker] + ')"' : '') + '/>';
  };
  /** 점 목록을 잇는 부드러운 선(포물선 궤적 등) */
  D.curve = function (pts, o) {
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + n(p[0]) + ' ' + n(p[1]); }).join('');
    return D.path(d, o);
  };
  D.dots = function (pts, o) {
    o = o || {};
    return pts.map(function (p) { return '<circle cx="' + n(p[0]) + '" cy="' + n(p[1]) + '" r="' + (o.r || 6) + '" style="fill:' + col(o.color, 'sim') + (o.hollow ? ';fill:' + C.paper + ';stroke:' + col(o.color, 'sim') + ';stroke-width:2' : '') + '"/>'; }).join('');
  };
  D.label = function (x, y, text, o) {
    o = o || {};
    var size = Math.max(22, o.size || 22);   // R7 학생점검(A8): 글자 하한 — 그림 폭 약 600px 에서 16px 안팎
    var st = 'font-size:' + size + 'px;font-weight:' + (o.weight === 500 ? 500 : 400) + ';fill:' + col(o.color === 'muted' ? 'chip' : o.color, 'ink') +
      (o.italic ? ';font-style:italic;font-family:var(--font-math)' : '') +
      (o.bg !== false ? ';stroke:' + C.paper + ';stroke-width:7;stroke-linejoin:round;paint-order:stroke' : '');
    return '<text x="' + n(x) + '" y="' + n(y) + '" text-anchor="' + (o.anchor || 'start') + '" dominant-baseline="' + (o.baseline || 'middle') + '"' + (o.sym ? ' class="dg-sym" data-sym="' + esc(normSym(o.sym)) + '"' : '') + ' style="' + st + '">' + tspans(text) + '</text>';
  };
  /** 분수 라벨: 가운데 (x, y) = 막대 높이. num·den 은 '$v^2$' 같은 표기 */
  D.frac = function (x, y, num, den, o) {
    o = o || {};
    var size = Math.max(22, o.size || 22), w = Math.max(String(num).replace(/\$/g, '').length, String(den).replace(/\$/g, '').length) * size * 0.62 + 10;
    var cx = o.anchor === 'start' ? x + w / 2 : o.anchor === 'end' ? x - w / 2 : x;
    var lo = { anchor: 'middle', size: size, color: o.color, bg: o.bg };
    return '<g' + (o.sym ? ' class="dg-sym" data-sym="' + esc(normSym(o.sym)) + '"' : '') + '>' +
      D.label(cx, y - size * 0.62, num, lo) +
      '<line x1="' + n(cx - w / 2) + '" y1="' + n(y) + '" x2="' + n(cx + w / 2) + '" y2="' + n(y) + '" style="stroke:' + col(o.color, 'ink') + ';stroke-width:2;stroke-linecap:round"/>' +
      D.label(cx, y + size * 0.66, den, lo) + '</g>';
  };
  D.arrow = function (x1, y1, x2, y2, o) {
    o = o || {};
    var kind = o.kind || 'v', out = '';
    var isF = kind === 'a' || kind === 'f';   // R7-2: 힘·가속도는 색을 바꾸지 않는다(구리색 고정)
    var color = isF ? C.force : o.color ? col(o.color) : kind === 'comp' ? C.muted : kind === 'sum' ? C.ink : C.sim;
    var mk = isF ? MARK.force : o.color ? (o.color === 'warn' ? MARK.warn : o.color === 'muted' ? MARK.muted : o.color === 'ink' ? MARK.ink : MARK.sim) :
      kind === 'comp' ? MARK.muted : kind === 'sum' ? MARK.ink : MARK.sim;
    var w = kind === 'a' || kind === 'f' ? 4 : kind === 'comp' ? 1.8 : kind === 'sum' ? 5 : 2.8;
    var len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 1) return '';
    var dash = kind === 'comp' ? ';stroke-dasharray:7 6' : '';
    out += '<line x1="' + n(x1) + '" y1="' + n(y1) + '" x2="' + n(x2) + '" y2="' + n(y2) + '" style="stroke:' + color + ';stroke-width:' + w + dash + ';stroke-linecap:round" marker-end="url(#' + mk + ')"/>';
    if (kind === 'sum') {   // 이중선: 가운데 바탕색 선
      var k = (len - 14) / len;
      out += '<line x1="' + n(x1) + '" y1="' + n(y1) + '" x2="' + n(x1 + (x2 - x1) * k) + '" y2="' + n(y1 + (y2 - y1) * k) + '" style="stroke:' + C.paper + ';stroke-width:1.6;stroke-linecap:butt"/>';
    }
    if (o.label) {
      var lx = o.lx !== undefined ? o.lx : x2 + (x2 - x1) / len * 28, ly = o.ly !== undefined ? o.ly : y2 + (y2 - y1) / len * 28;   // R7-2: 화살 머리에서 10 더 띄움
      out += D.label(lx, ly, o.label, { bg: true, anchor: o.anchor || (Math.abs(x2 - x1) < 4 ? 'middle' : x2 >= x1 ? 'start' : 'end'), color: kind === 'comp' ? 'muted' : o.labelColor || 'ink', size: o.size, sym: o.sym });
    }
    return out;
  };
  D.axis = function (x, y, w, h, o) {
    o = o || {};
    var out = '<line x1="' + x + '" y1="' + y + '" x2="' + (x + w) + '" y2="' + y + '" style="stroke:' + C.muted + ';stroke-width:2" marker-end="url(#' + MARK.muted + ')"/>' +
      '<line x1="' + x + '" y1="' + y + '" x2="' + x + '" y2="' + (y - h) + '" style="stroke:' + C.muted + ';stroke-width:2" marker-end="url(#' + MARK.muted + ')"/>';
    (o.ticks || []).forEach(function (t) { out += D.line(x + t.v, y - 5, x + t.v, y + 5, { w: 1.5 }) + D.label(x + t.v, y + 22, t.t, { anchor: 'middle', size: 18, color: 'muted' }); });
    (o.yticks || []).forEach(function (t) { out += D.line(x - 5, y - t.v, x + 5, y - t.v, { w: 1.5 }) + D.label(x - 10, y - t.v, t.t, { anchor: 'end', size: 18, color: 'muted' }); });
    if (o.xl) out += D.label(x + w, y + 26, o.xl, { anchor: 'end', size: 20, color: 'muted' });
    if (o.yl) out += D.label(x + 12, y - h + 4, o.yl, { anchor: 'start', size: 20, color: 'muted' });
    return out;
  };
  D.dim = function (x1, y1, x2, y2, label, o) {
    o = o || {};
    var dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, nx = -dy / len * 9, ny = dx / len * 9;
    var off = o.off !== undefined ? o.off : -22;
    var out = D.line(x1, y1, x2, y2, { w: 1.5 }) + D.line(x1 - nx, y1 - ny, x1 + nx, y1 + ny, { w: 1.5 }) + D.line(x2 - nx, y2 - ny, x2 + nx, y2 + ny, { w: 1.5 });
    // 글은 선에 수직인 방향(nx, ny)으로 off 만큼 비켜 놓는다(off < 0 = 가로선 위·세로선 왼쪽). 세로선은 글을 선 옆에 끝 맞춤 — UI팀2 요청
    if (label) {
      var vert = Math.abs(nx) > Math.abs(ny), ux = nx / 9, uy = ny / 9;
      var lx = (x1 + x2) / 2 + ux * off, ly = (y1 + y2) / 2 + uy * off;
      out += D.label(lx, ly, label, { anchor: o.anchor || (vert ? (ux * off < 0 ? 'end' : 'start') : 'middle'), bg: true, size: o.size || 20 });
    }
    return out;
  };
  D.angle = function (cx, cy, r, a0, a1, label, o) {
    o = o || {};
    var rad = Math.PI / 180, x0 = cx + r * Math.cos(a0 * rad), y0 = cy - r * Math.sin(a0 * rad), x1 = cx + r * Math.cos(a1 * rad), y1 = cy - r * Math.sin(a1 * rad);
    var large = Math.abs(a1 - a0) > 180 ? 1 : 0, sweep = a1 > a0 ? 0 : 1;
    var out = '<path d="M' + n(x0) + ' ' + n(y0) + 'A' + r + ' ' + r + ' 0 ' + large + ' ' + sweep + ' ' + n(x1) + ' ' + n(y1) + '" style="fill:none;stroke:' + col(o.color, 'muted') + ';stroke-width:2"/>';
    if (label) { var am = (a0 + a1) / 2 * rad, lr = r + (o.lr || 22); out += D.label(cx + lr * Math.cos(am), cy - lr * Math.sin(am), label, { anchor: 'middle', size: o.size || 22, bg: true }); }
    return out;
  };
  D.ray = function (pts, o) {
    o = o || {};
    var s = o.style || 1;
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + n(p[0]) + ' ' + n(p[1]); }).join('');
    return '<path d="' + d + '" style="fill:none;stroke:var(--color-rec-' + s + ');stroke-width:' + (o.w || 3) + ';stroke-dasharray:var(--dash-rec-' + s + ', none);stroke-linecap:round;stroke-linejoin:round"' + (o.arrow === false ? '' : ' marker-mid="url(#' + MARK.ink + ')"') + '/>';
  };
  D.ball = function (x, y, r, o) {
    o = o || {};
    return '<circle cx="' + n(x) + '" cy="' + n(y) + '" r="' + (r || 12) + '" style="fill:' + col(o.color, 'sim') + (o.hollow ? ';fill:' + C.paper + ';stroke:' + col(o.color, 'sim') + ';stroke-width:2.5' : '') + '"/>' +
      (o.label ? D.label(x + (r || 12) + 8, y, o.label, { bg: true, sym: o.sym }) : '');
  };
  D.box = function (x, y, w, h, o) {
    o = o || {};
    return '<rect x="' + n(x) + '" y="' + n(y) + '" width="' + n(w) + '" height="' + n(h) + '" rx="6" style="fill:' + (o.fill ? col(o.fill) : C.tint) + ';stroke:' + col(o.color, 'sim') + ';stroke-width:2.5"/>' +
      (o.label ? D.label(x + w / 2, y + h / 2, o.label, { anchor: 'middle', weight: 500 }) : '');
  };
  D.lens = function (x, y, h, o) {
    o = o || {};
    var t = Math.max(10, h * 0.12);
    return '<path d="M' + x + ' ' + (y - h / 2) + 'Q' + (x + t) + ' ' + y + ' ' + x + ' ' + (y + h / 2) + 'Q' + (x - t) + ' ' + y + ' ' + x + ' ' + (y - h / 2) + 'z" style="fill:' + C.tint + ';stroke:' + col(o.color, 'sim') + ';stroke-width:2.5"/>';
  };
  D.slit = function (x, y, h, o) {
    o = o || {};
    var gap = o.gap || 10, sep = o.sep || 50, top = y - h / 2, bot = y + h / 2, a = y - sep / 2, b = y + sep / 2;
    var st = 'stroke:' + C.ink + ';stroke-width:6;stroke-linecap:butt';
    return '<line x1="' + x + '" y1="' + top + '" x2="' + x + '" y2="' + (a - gap / 2) + '" style="' + st + '"/>' +
      '<line x1="' + x + '" y1="' + (a + gap / 2) + '" x2="' + x + '" y2="' + (b - gap / 2) + '" style="' + st + '"/>' +
      '<line x1="' + x + '" y1="' + (b + gap / 2) + '" x2="' + x + '" y2="' + bot + '" style="' + st + '"/>';
  };
  D.screen = function (x, y, h, o) {
    o = o || {};
    return '<rect x="' + (x - 4) + '" y="' + (y - h / 2) + '" width="8" height="' + h + '" style="fill:' + C.line + '"/>' + (o.label ? D.label(x, y + h / 2 + 22, o.label, { anchor: 'middle', size: 18, color: 'muted' }) : '');
  };
  D.planet = function (x, y, r, o) {
    o = o || {};
    return '<circle cx="' + n(x) + '" cy="' + n(y) + '" r="' + r + '" style="fill:' + C.tint + ';stroke:' + col(o.color, 'sim') + ';stroke-width:2.5"/>' +
      (o.label ? D.label(x, y, o.label, { anchor: 'middle', weight: 500 }) : '');
  };
  D.ground = function (x, y, w) {
    var out = D.line(x, y, x + w, y, { color: 'ink', w: 2.5 });
    for (var i = x + 6; i < x + w; i += 22) out += D.line(i, y + 2, i - 12, y + 14, { w: 1.5 });
    return out;
  };

  /** R9 복습 그림: 물결(사인 곡선) — (x, y)=왼쪽 끝 가운데선, w 길이, amp 높이, cycles 마루 수 */
  D.wave = function (x, y, w, amp, cycles, o) {
    o = o || {};
    var pts = [], N = Math.max(24, Math.round(cycles * 24)), i;
    for (i = 0; i <= N; i++) { var t = i / N; pts.push([x + w * t, y - amp * Math.sin(2 * Math.PI * cycles * t + (o.phase || 0))]); }
    return D.curve(pts, { color: o.color || 'sim', w: o.w || 3 });
  };
  /** R9 복습 그림: 반원 물결 몇 겹 — 틈 (cx, cy) 에서 오른쪽으로 퍼지는 반원들(r0 + k·gap) */
  D.ripples = function (cx, cy, r0, gap, n, o) {
    o = o || {};
    var out = '';
    for (var k = 0; k < n; k++) { var r = r0 + k * gap; out += D.path('M' + n2(cx) + ' ' + n2(cy - r) + 'A' + r + ' ' + r + ' 0 0 1 ' + n2(cx) + ' ' + n2(cy + r), { color: o.color || 'sim', w: o.w || 2, dash: o.dash }); }
    return out;
  };
  function n2(v) { return Math.round(v * 10) / 10; }
  /** R9 복습 그림: 막대(에너지·움직임의 양) — 아래(y)에서 위로 h 만큼, 폭 w. o.fill = 색 이름, o.frame = 점선 틀 높이 */
  D.bar = function (x, y, w, h, o) {
    o = o || {};
    var out = '';
    if (o.frame) out += '<rect x="' + n2(x - 3) + '" y="' + n2(y - o.frame - 3) + '" width="' + n2(w + 6) + '" height="' + n2(o.frame + 6) + '" rx="4" style="fill:none;stroke:' + C.muted + ';stroke-width:1.5;stroke-dasharray:5 5"/>';
    if (h > 0) out += '<rect x="' + n2(x) + '" y="' + n2(y - h) + '" width="' + n2(w) + '" height="' + n2(h) + '" rx="3" style="fill:' + col(o.fill, 'sim') + '"/>';
    return out;
  };
  global.SimDiagram = D;
})(window);
