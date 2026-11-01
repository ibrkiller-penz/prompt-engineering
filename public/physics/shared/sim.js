/* =====================================================================
   물리 시뮬레이터 실험실 — SimKit (공통 틀 스크립트, R2 2026-10-28)
   일반 <script> 로 불러온다(ES module·fetch·CDN 금지, file:// 동작). 전역: window.SimKit
   설명서: docs/SIMKIT.md (R2 바뀐 점 §0)   ·   최소 예제: shared/TEMPLATE.html
   근거: docs/개선/R2_계획.md §2·§3 (A~G) · 이전 R1_계획.md
   R2 새 API: josa(w,'으로/로') · withJosa · say(text) · predicting() · onPredict(fn) · cfg.autoPredict/onPredictOpen/onPredictClose
             resetDefaults() · deleteRecord(i) · recordTable({extra}) · recordExtra(el) · recLabel/recMark/recTag · stageInset()
             think({id, when, hintFold}) · think.remove(id) · refreshThinks() · help({inlineTerms, concepts:[{summary, plain, figure,
             formula, symbols, example, why, live}], terms:{용어:{def, short, alias}}}) · takeaway → {line, more} · preset.changes · preset.mode
             predict({figure, afterHint, numeric:{max: 함수, example, overText}})

   ── 불러오기 (sims/<slug>/index.html) ─────────────────────────────────
     <link rel="stylesheet" href="../../shared/fonts.css">   tokens.css · base.css · shell.css
     <div id="sim-root"></div>
     <script src="../../shared/sim.js"></script>
     <script src="sim.js"></script>

   ── 1. 시작: SimKit.init(cfg) ───────────────────────────────────────
     cfg = {
       slug, title, subject, unit, standards:['12역학01-02'], today:'오늘 알아볼 것 문장',
       stepTasks: [{text, action:{label, onClick}} ×4],   // 단계별 '지금 할 일' (없으면 공통 문장)
       onStep(i, name),                 // 단계 이름은 '예측·실행·비교·정리' 고정 (steps 옵션은 R1 에서 없앰)
       hubHref, dt, stageFit, reset(p), step(dt,p), render(view,p), capture(p), save(), load(s),
       status(p) -> ['지구','공기 저항 없음','g 9.8'] (배열 권장, 문자열이면 ' · ' 로 나눔)
       predictOnPreset: true, confirmPresetWithRecords: true, onTeacher(on)
     }
     만들어지는 칸: SimKit.el.{root, slide, top, task, note, stage, panel(=패널 스크롤 칸), panelBox, recBig,
                    thinkBoard, band, meters, graph, records(=기록 칩), bar, presets, cornerTL/TR/BL/BR, status}

   ── 2. 값 두 벌: SimKit.ui(패널) / SimKit.params(지금 실행) ─────────────
     apply:'live' ⚡ 바로 반영   ·   apply:'restart' ↻ 바꾸면 처음부터 다시(실행 중이면 다음 실행부터)

   ── 3~4. 수치·상황 ──────────────────────────────────────────────────
     addVar(where, {key,label:'질량 {{질량}}',symbol,unit,min,max,step,value,decimals,precision,apply,ticks,record,teacher,hint,onChange})
     addChoice / addToggle / setPresets([{name(12자 이내), tag, change, fixed, values, predict:{question,choices,answer,why,numeric,judge}, onApply}])
     chooseMode({title, modes:[{value,label,desc}], default, urlKey:'mode', key, onPick})

   ── 5. 비교 ─────────────────────────────────────────────────────────
     record() · clearRecords() · recordTable(where, {columns:[{key,label,unit,decimals,from,priority:1|2,text,changed}]})
     graph(where, {..., empty:'높이 그래프'}) · onRecords(fn) · recStyle(i) · ghostStyle() · drawPath(...)

   ── 6. 설명 도우미 (R1 신규) ─────────────────────────────────────────
     help({how:[], concepts:[{title,formula,plain,live(p)}], terms:{용어:풀이}, keys:[['V','화살표 켜고 끄기']]})
     term('초점거리') → <abbr class="term">  · 라벨 안 {{초점거리}}
     takeaway(text|fn(p)) · reveal(el, answerHtml) · think({q, hint, choices, answer, why, reveal}) · empty(el, text)
     flash(key) / isFlashing(key) · placeLabel(ctx, [{x,y,text,anchor}])

   ── 7. 흐름 ─────────────────────────────────────────────────────────
     play/pause/toggle/reset/finish(msg)/stepFrame(±1)/setSpeed(x) · goStep(i)/nextStep/prevStep
     predict(o) → Promise<{choice(1~), index(0~), number}|null> · notice(text, type, ms, {label,onClick})
     confirm/dialog · guide(o)(교사 모드 전용 서랍) · setStatus · update · requestRender · onKey · isTeacher

   ── 공통 키 (e.code) — 화면에는 숨기고 ? 도움말 '단축키' 탭에만 적는다 ──────
     Space 실행/멈춤 · ←/→ 단계 · 1~5 실험 카드 · S 기록하기 · R 기본값으로 되돌리기 · C 기록 모두 지우기
     , . 한 장면 뒤로/앞으로 · [ ] 속도 · F 전체 화면 · T 조작판 접기 · ? 도움말 · H 3초 길게 = 교사 모드 · Esc 닫기(두 번 = 허브)
   ===================================================================== */
(function (global) {
  'use strict';

  var SK = {};
  var SPEEDS = [0.1, 0.25, 0.5, 1, 2];
  var SPEED_WORDS = { 0.1: '아주 느리게', 0.25: '느리게', 0.5: '조금 느리게', 1: '보통', 2: '빠르게' };
  var MAX_RECORDS = 5;
  var STEPS = ['예측', '실행', '비교', '정리'];
  var CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨'];
  var SECTION_TITLES = { values: '수치 바꾸기', situation: '상황 바꾸기', tools: '화면에 표시하기', deep: '더 많은 설정' };
  var SECTION_ORDER = ['values', 'situation', 'tools'];
  // 프리셋 꼬리표 → 학생에게 보이는 말 (키는 시뮬레이터가 쓰던 것 그대로)
  var TAG_WORDS = {
    '탐구 재현': '교과서 탐구', '대표 문항': '교과서 문제', '오개념': '흔한 오해 확인',
    '과학사': '과학사', '생활 속': '생활 속', '교통안전': '교통안전',
    '작용·반작용': '작용·반작용', '발사체': '발사체', '기묘함': '기묘함'
  };

  /* ------------------------------------------------------------------
     0. 작은 도구
     ------------------------------------------------------------------ */
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        var v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'style') el.style.cssText = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    if (kids !== undefined && kids !== null) {
      (Array.isArray(kids) ? kids : [kids]).forEach(function (c) {
        if (c === null || c === undefined || c === false) return;
        el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
      });
    }
    return el;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function decimalsOf(step) {
    var s = String(step);
    if (s.indexOf('e-') >= 0) return parseInt(s.split('e-')[1], 10) || 0;
    var i = s.indexOf('.');
    return i < 0 ? 0 : s.length - i - 1;
  }
  function roundTo(v, d) { var p = Math.pow(10, d); return Math.round(v * p) / p; }
  /** 숫자 → 글자. 음수는 '−'(U+2212). decimals 자리 고정. */
  function fmt(v, decimals) {
    if (v === null || v === undefined || isNaN(v)) return '–';
    var d = decimals === undefined ? 2 : decimals;
    var s = Math.abs(v).toFixed(d);
    if (Number(s) === 0) return s;
    return (v < 0 ? '−' : '') + s;
  }
  function fmtFlex(v, minD, maxD) {
    var s = fmt(v, maxD);
    if (maxD > minD && s.indexOf('.') >= 0) {
      var cut = s.length;
      while (cut > 0 && s.charAt(cut - 1) === '0' && (cut - s.indexOf('.') - 1) > minD) cut--;
      s = s.slice(0, cut);
      if (s.charAt(s.length - 1) === '.') s = s.slice(0, -1);
    }
    return s;
  }
  function parseNum(str) {
    if (typeof str === 'number') return str;
    var s = String(str).trim().replace(/[−–—]/g, '-').replace(/\s/g, '').replace(/,/g, '.');
    if (s === '' || s === '-' || s === '.') return NaN;
    if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return NaN;
    return parseFloat(s);
  }
  function copy(o) { var r = {}; for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) r[k] = o[k]; return r; }
  function cssVar(name, el) { return getComputedStyle(el || document.documentElement).getPropertyValue(name).trim(); }
  function msVar(name, fallback) {
    var v = cssVar(name); if (!v) return fallback;
    var n = parseFloat(v); return isNaN(n) ? fallback : (v.indexOf('ms') >= 0 ? n : n * 1000);
  }
  function blurOnMouse(e) { if (e && e.detail > 0 && e.currentTarget && e.currentTarget.blur) e.currentTarget.blur(); }
  /**
   * R2(B4): 조사 고르기. 두 가지로 부른다.
   *   josa('그래프', '이', '가') → '가'          (예전 방식: 받침 있으면 a, 없으면 b)
   *   josa('달', '으로/로') → '로'  josa('렌즈', '을/를') → '를'  josa('7.9 km/s', '으로/로') → '로'
   * 숫자·영문 끝 글자는 읽는 소리로 판단(1 일·3 삼·m 엠·l 엘 …). '으로/로' 는 ㄹ 받침이면 '로'.
   */
  var DIGIT_JONG = { '0': 21, '1': 8, '2': 0, '3': 16, '4': 0, '5': 0, '6': 1, '7': 8, '8': 8, '9': 0 };
  var LATIN_JONG = { l: 8, m: 16, n: 4, r: 8 };
  function jongOf(word) {
    var s = String(word === undefined || word === null ? '' : word).replace(/[\s)\]}'"’”»>.,·]+$/, '');
    var ch = s.charAt(s.length - 1), c = s.charCodeAt(s.length - 1);
    if (c >= 0xAC00 && c <= 0xD7A3) return (c - 0xAC00) % 28;
    if (DIGIT_JONG[ch] !== undefined) return DIGIT_JONG[ch];
    var low = ch.toLowerCase();
    if (LATIN_JONG[low] !== undefined) return LATIN_JONG[low];
    return 0;
  }
  function josa(word, a, b) {
    if (b === undefined && typeof a === 'string' && a.indexOf('/') > 0) { var ab = a.split('/'); a = ab[0]; b = ab[1]; }
    var j = jongOf(word);
    if (a === '으로' && j === 8) return b;
    return j ? a : b;
  }
  /** 낱말 + 조사: withJosa('달', '으로/로') → '달로' */
  function withJosa(word, pair) { return String(word) + josa(word, pair); }
  /** '질량 {{질량}}' 처럼 {{용어}} 를 용어 말풍선으로 바꾼 노드 배열 */
  function rich(text) {
    if (text === null || text === undefined) return [];
    if (typeof text !== 'string') return [text];
    var out = [], re = /\{\{(.+?)\}\}/g, last = 0, m;
    function pushText(t) { mathNodes(t).forEach(function (n) { out.push(n); }); }   // R4: $v_0$ → <i class="sym">v<sub>0</sub></i>
    while ((m = re.exec(text))) {
      if (m.index > last) pushText(text.slice(last, m.index));
      var fr = /^frac:([^|]*)\|(.*)$/.exec(m[1]);
      if (fr) out.push(fracEl(fr[1], fr[2]));   // R5: {{frac:λL|d}} → 가로선 분수
      else termNodes(m[1]).forEach(function (n) { out.push(n); });
      last = re.lastIndex;
    }
    if (last < text.length) pushText(text.slice(last));
    return out;
  }
  function plain(text) {
    if (typeof text !== 'string') return '';
    text = text.replace(/\{\{frac:([^|}]*)\|(.+?)\}\}/g, function (m0, a, b) { return (a.length > 1 ? '(' + a + ')' : a) + '/' + (b.length > 1 ? '(' + b + ')' : b); });
    return plainMath(text.replace(/\{\{(.+?)\}\}/g, '$1'));
  }
  /** R5: HTML 분수 — <span class="frac"><span class="frac__n">분자</span><span class="frac__d">분모</span></span> ($…$ 수식 표기 가능) */
  function fracEl(num, den) {
    var n = h('span', { class: 'frac__n' }), d = h('span', { class: 'frac__d' });
    mathNodes(String(num)).forEach(function (x) { n.appendChild(typeof x === 'string' ? document.createTextNode(x) : x); });
    mathNodes(String(den)).forEach(function (x) { d.appendChild(typeof x === 'string' ? document.createTextNode(x) : x); });
    return h('span', { class: 'frac', role: 'math', 'aria-label': plainMath(String(num)) + ' 나누기 ' + plainMath(String(den)) }, [n, d]);
  }
  function stripNo(label) { return String(label || '').replace(/^\s*(?:[①-⑨]|\d+[.)]?)\s*/, ''); }

  /** R3: 단위 붙이기 한 곳 — 영문 단위는 한 칸 띄우고('20 m/s'), °·% 는 붙인다('45°', '100%') */
  function withUnit(v, unit) {
    var t = v === null || v === undefined ? '' : String(v);
    if (!unit) return t;
    return t + (unit === '°' || unit === '%' || unit === '℃' ? '' : ' ') + unit;
  }
  /** R3: 번호 원 — 원문자(①) 글리프 대신 <span class="circ">1</span>. 숫자·원문자 모두 받음 */
  var CIRC_RE = /^[①-⑳]/;
  function circ(n) {
    var t = String(n === null || n === undefined ? '' : n).trim();
    if (CIRC_RE.test(t)) t = String(t.charCodeAt(0) - 0x2460 + 1);
    return h('span', { class: 'circ', text: t });
  }
  /** '① 이름' 같은 글에서 앞 원문자를 떼어 [circ, ' 이름'] 으로 — 원문자 없으면 그대로 */
  function circText(text) {
    var t = String(text || '');
    var m = t.match(/^\s*([①-⑳])\s*/);
    return m ? [circ(m[1]), ' ' + t.slice(m[0].length)] : [t];
  }
  SK.h = h; SK.fmt = fmt; SK.clamp = clamp; SK.parseNum = parseNum; SK.josa = josa; SK.withJosa = withJosa;
  SK.withUnit = withUnit; SK.circ = circ; SK.circText = circText;
  SK.fmtFlex = fmtFlex;
  /** R2(C1): 기록 이름 = 모양 기호 + 이름 ('● 기록 1', '▲ 기록 2') — 표·그래프 범례·나란히 보기 공통 */
  var MARKS = ['●', '▲', '■', '◆', '★'];
  SK.recMark = function (slot) { return MARKS[(slot || 0) % MARKS.length]; };
  SK.recLabel = function (rec) { var s = typeof rec === 'number' ? rec : rec.slot; var n = typeof rec === 'number' ? rec + 1 : rec.n; return MARKS[s % MARKS.length] + ' 기록 ' + n; };

  var colorCache = {};
  SK.color = function (name) {
    if (name.slice(0, 2) !== '--') return name;
    if (!colorCache[name]) colorCache[name] = cssVar(name, document.body || document.documentElement) || '#000';
    return colorCache[name];
  };
  /**
   * n u → CSS px (지금 창 크기 기준). R5: 무대 안 .u-probe(폭 1000u) 를 재서 tokens.css 의 --u 를 그대로 읽는다
   * — 세로 태블릿은 --u = 폭/1290 이라 '무대 폭/1920' 이 틀린다. 16:9 에서는 SK.px(1920) === 무대 폭. 창 크기가 바뀌면 다시 잰다.
   */
  var uCache = 0;
  function measureU() {
    var pr = SK.el && SK.el.uProbe;
    var w = pr ? pr.getBoundingClientRect().width : 0;
    if (w > 0) return w / 1000;
    var s = (SK.el && SK.el.slide) || document.querySelector('.slide');
    var sw = s ? s.getBoundingClientRect().width : 0;
    return (sw > 0 ? sw : Math.min(window.innerWidth, window.innerHeight * 16 / 9)) / 1920;
  }
  window.addEventListener('resize', function () { uCache = 0; });
  SK.px = function (n) {
    if (!uCache) { uCache = measureU(); if (!(SK.el && SK.el.uProbe)) { var u0 = uCache; uCache = 0; return n * u0; } }
    return n * uCache;
  };

  /* ------------------------------------------------------------------
     0-R4. 글꼴 · 캔버스 글자(수식 표기) · 아이콘
     ------------------------------------------------------------------ */
  var FONT_FALLBACK_SANS = '"S-Core Dream", "Malgun Gothic", "Apple SD Gothic Neo", system-ui, sans-serif';
  var FONT_FALLBACK_MATH = '"Times New Roman", "Cambria", "Batang", "AppleMyungjo", serif';
  var fontCache = { sans: '', math: '' };
  /** --font-sans / --font-math 를 한 번만 읽어 둔다(매 프레임 getComputedStyle 금지) */
  function fontFamily(kind) {
    if (!fontCache[kind]) {
      var v = cssVar(kind === 'sans' ? '--font-sans' : '--font-math');
      if (!v) return kind === 'sans' ? FONT_FALLBACK_SANS : FONT_FALLBACK_MATH;   // CSS 가 아직 안 붙었으면 캐시하지 않음
      fontCache[kind] = v;
    }
    return fontCache[kind];
  }
  var MATH_SCALE = 1.1;    // 이탤릭 세리프는 에스코어보다 작아 보여 1.1배 (HTML .sym 의 1.1em 과 같음)
  var SCRIPT_SCALE = 0.7;  // 첨자 크기
  var SUB_DY = 0.22, SUP_DY = -0.45;   // 첨자 기준선 이동 (글자 크기 비율)
  /**
   * R4: 캔버스 글꼴 문자열. weight 300|400|500 (500 넘으면 500), size = 논리 단위 px.
   * kind: 'sans'(기본, 에스코어) | 'math'(세리프 정체) | 'math-italic'(세리프 이탤릭 — 물리 기호)
   */
  SK.font = function (weight, size, kind) {
    var w = +weight || 400; if (w > 500) w = 500; if (w < 300) w = 300;
    var s = (+size || 22) + 'px ';
    if (kind === 'math') return '400 ' + s + fontFamily('math');
    if (kind === 'math-italic') return 'italic 400 ' + s + fontFamily('math');
    return w + ' ' + s + fontFamily('sans');
  };

  var LATIN_RE = /[A-Za-z]/, GREEK_LOWER_RE = /[α-ωϑϕϵϖ]/, HANGUL_RE = /[가-힣ㄱ-ㅎㅏ-ㅣ]/;
  /** $…$ 안쪽 → 런 배열 [{t, kind:'mi'(이탤릭)|'mu'(정체)|'sans', script:0|'sub'|'sup'}] */
  function mathRuns(src) {
    var runs = [], i = 0;
    function kindOf(c, multi) {
      if (HANGUL_RE.test(c)) return 'sans';
      if ((LATIN_RE.test(c) || GREEK_LOWER_RE.test(c)) && !multi) return 'mi';
      return 'mu';
    }
    function push(t, kind, script) {
      var last = runs[runs.length - 1];
      if (last && last.kind === kind && last.script === script) last.t += t;
      else runs.push({ t: t, kind: kind, script: script });
    }
    function group() {
      if (src.charAt(i) === '{') {
        var d = 1, j = i + 1;
        while (j < src.length && d) { if (src.charAt(j) === '{') d++; else if (src.charAt(j) === '}') d--; j++; }
        var g = src.slice(i + 1, d ? j : j - 1); i = j; return g;
      }
      var ch = src.charAt(i); i++; return ch;
    }
    while (i < src.length) {
      var c = src.charAt(i);
      if (c === '_' || c === '^') {
        i++;
        var g = group(), sc = c === '_' ? 'sub' : 'sup';
        var multi = g.replace(/[^A-Za-zα-ω]/g, '').length > 1;    // 여러 글자 첨자(esc·max)는 정체
        for (var k = 0; k < g.length; k++) { var ch = g.charAt(k) === "'" ? '′' : g.charAt(k); if (ch !== '{' && ch !== '}') push(ch, kindOf(ch, multi), sc); }
        continue;
      }
      if (c === '{' || c === '}') { i++; continue; }
      if (c === "'") { push('′', 'mu', 0); i++; continue; }
      push(c, kindOf(c, false), 0); i++;
    }
    return runs;
  }
  /** 문장 전체 → 런 배열. $ 밖은 'sans'. $ 가 홀수 개면 마지막 $ 는 글자 그대로 */
  function textRuns(str) {
    var parts = normMath(String(str === null || str === undefined ? '' : str)).split('$');
    if (parts.length % 2 === 0) { var tail = parts.pop(); parts[parts.length - 1] += '$' + tail; }
    var runs = [];
    for (var p = 0; p < parts.length; p++) {
      if (p % 2 === 0) { if (parts[p]) runs.push({ t: parts[p], kind: 'sans', script: 0 }); }
      else runs.push.apply(runs, mathRuns(parts[p]));
    }
    return runs;
  }
  function hasMath(str) { return typeof str === 'string' && /\$[^$]+\$/.test(str); }
  /** R4 마무리: 유니코드 아래첨자(v₀ m₁ vₓ vᵧ v₁′)를 $v_0$ 표기로 — $…$ 밖에서만. 예전 문자열(카드 아래 줄·표 머리·용어 뜻)도 같은 모양으로 그려진다 */
  var USUB = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9', 'ₓ': 'x', 'ᵧ': 'y' };
  var USUB_RE = /([A-Za-zα-ω])([₀-₉ₓᵧ]+)(′?)/g;
  function normMath(text) {
    if (typeof text !== 'string' || !/[₀-₉ₓᵧ]/.test(text)) return text;
    var parts = text.split('$');
    for (var p = 0; p < parts.length; p += 2) {
      parts[p] = parts[p].replace(USUB_RE, function (m, a, sub, pr) {
        var t = ''; for (var k = 0; k < sub.length; k++) t += USUB[sub.charAt(k)];
        return '$' + a + '_' + (t.length > 1 ? '{' + t + '}' : t) + (pr ? "'" : '') + '$';
      });
    }
    return parts.join('$');
  }
  SK.normMath = normMath;
  /** HTML: '$v_0$' 안쪽 → <i class="sym">v<sub>0</sub></i> */
  function mathEl(src) {
    var el = h('i', { class: 'sym' });
    mathRuns(src).forEach(function (r) {
      var up = r.kind !== 'mi';
      if (r.script) el.appendChild(h(r.script, up ? { class: 'up' } : null, r.t));
      else if (!up) el.appendChild(document.createTextNode(r.t));
      else el.appendChild(h('span', { class: 'up' }, r.t));
    });
    return el;
  }
  /** 문자열의 $…$ 를 수식 요소로 바꾼 노드 배열 */
  function mathNodes(text) {
    text = normMath(text);
    if (!hasMath(text)) return [text];
    var parts = text.split('$'), out = [];
    if (parts.length % 2 === 0) { var tail = parts.pop(); parts[parts.length - 1] += '$' + tail; }
    for (var p = 0; p < parts.length; p++) {
      if (p % 2 === 0) { if (parts[p]) out.push(parts[p]); }
      else out.push(mathEl(parts[p]));
    }
    return out;
  }
  var SUB_DIGITS = '₀₁₂₃₄₅₆₇₈₉';
  /** 글자만 쓰는 곳(aria·title·표 머리)용: '$v_0$' → 'v₀', '$v_{esc}$' → 'v_esc' */
  function plainMath(text) {
    if (!hasMath(text)) return text;
    return text.replace(/\$([^$]*)\$/g, function (m, g) {
      return g.replace(/_\{?([0-9])\}?/g, function (mm, d) { return SUB_DIGITS.charAt(+d); })
        .replace(/\^\{?2\}?/g, '²').replace(/\^\{?3\}?/g, '³').replace(/[{}]/g, '').replace(/'/g, '′');
    });
  }
  /** 기호 칸(symbol)용: 'v_0'·'$v_0$'·'v₀' 모두 받아 HTML 노드 / 글자로 */
  function symNodes(sym) { sym = normMath(sym); return hasMath(sym) ? mathNodes(sym) : /[_^]/.test(sym) ? [mathEl(sym)] : [sym]; }
  function symPlain(sym) { return !sym ? '' : hasMath(sym) ? plainMath(sym) : /[_^]/.test(sym) ? plainMath('$' + sym + '$') : sym; }
  /** 기호를 $…$ 마크업 문자열로 ('v_0'·'v₀'·'$v_0$' → '$v_0$', 'h' → 'h') — 표 머리처럼 문자열을 이어 붙인 뒤 rich() 로 그리는 곳용 */
  function symMarkup(sym) { if (!sym) return ''; sym = normMath(String(sym)); return hasMath(sym) ? sym : /[_^]/.test(sym) ? '$' + sym + '$' : sym; }
  SK.mathNodes = mathNodes;
  SK.plainMath = plainMath;

  /** 런마다 글꼴·폭·첨자 이동 계산 → {runs, w} */
  function layoutRuns(ctx, str, o) {
    var size = o.size || 22, weight = o.weight || 400;
    var sansBase = o.font || SK.font(weight, size);
    var runs = textRuns(str), x = 0, prev = null, out = [];
    for (var i = 0; i < runs.length; i++) {
      var r = runs[i], sz = r.script ? size * SCRIPT_SCALE : size, font;
      if (r.kind === 'sans') font = r.script ? SK.font(weight, sz) : sansBase;
      else font = SK.font(400, sz * MATH_SCALE, r.kind === 'mi' ? 'math-italic' : 'math');
      // 이탤릭 다음 정체(첨자 아님) 사이 0.06em 보정, 정체 다음 이탤릭은 0.03em
      if (prev && !r.script) {
        if (prev.kind === 'mi' && r.kind !== 'mi') x += size * 0.06;
        else if (prev.kind !== 'mi' && r.kind === 'mi' && !/\s$/.test(prev.t)) x += size * 0.03;
      }
      if (prev && prev.script && !r.script) x += size * 0.04;
      ctx.font = font;
      var w = ctx.measureText(r.t).width;
      out.push({ t: r.t, font: font, x: x, dy: r.script === 'sub' ? size * SUB_DY : r.script === 'sup' ? size * SUP_DY : 0 });
      x += w; prev = r;
    }
    return { runs: out, w: x };
  }
  var baseShiftCache = {};
  /** textBaseline(middle·top·bottom…) 의 y → 알파벳 기준선 y 로 옮기는 양 (같은 글꼴·크기로 측정, 캐시) */
  function baseShift(ctx, font, baseline) {
    if (!baseline || baseline === 'alphabetic') return 0;
    var key = font + '|' + baseline;
    if (baseShiftCache[key] === undefined) {
      ctx.save(); ctx.font = font;
      ctx.textBaseline = baseline; var a = ctx.measureText('H').actualBoundingBoxAscent;
      ctx.textBaseline = 'alphabetic'; var b = ctx.measureText('H').actualBoundingBoxAscent;
      ctx.restore();
      if (!isFinite(a) || !isFinite(b)) return 0;
      baseShiftCache[key] = b - a;
    }
    return baseShiftCache[key];
  }
  function labelBox(ctx, x, y, w, hgt, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + hgt, r); ctx.arcTo(x + w, y + hgt, x, y + hgt, r);
    ctx.arcTo(x, y + hgt, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fill();
  }
  /**
   * R4: 캔버스 글자 한 줄. str 의 $…$ 는 수식(기울임 세리프 + 아래첨자), 밖은 에스코어.
   * o = {size:22, weight:400|500, color:'--color-ink'(없으면 지금 fillStyle), align:'left'|'center'|'right',
   *      baseline:'middle'(기본)|'alphabetic'|'top'|'bottom', bg:false|true|'--색', pad:[6,2], radius:4,
   *      halo:'--색'(글자 둘레 테), haloWidth:4, tabular:false, font:'원래 ctx.font 문자열(에스코어 부분 대체)'}
   * 반환: 그린 폭(논리 단위). bg 를 그리면 view.lastBox = {x,y,w,h} 도 남긴다(SK.text.lastBox).
   */
  SK.text = function (ctx, str, x, y, o) {
    o = o || {};
    if (str === null || str === undefined || str === '') return 0;
    str = String(str);
    var size = o.size || 22, align = o.align || 'left', baseline = o.baseline || 'middle';
    ctx.save();
    var color = o.color ? SK.color(o.color) : ctx.fillStyle;
    var lay;
    if (o.tabular) lay = tabularLayout(ctx, str, o);
    else lay = layoutRuns(ctx, str, o);
    var x0 = align === 'center' ? x - lay.w / 2 : align === 'right' || align === 'end' ? x - lay.w : x;
    var sansBase = o.font || SK.font(o.weight || 400, size);
    var yA = y + baseShift(ctx, sansBase, baseline);
    if (o.bg) {
      var pad = o.pad || [6, 2], hgt = size * 1.2 + pad[1] * 2;
      var cy = yA - size * 0.36;   // 글자 눈높이 가운데
      var bx = { x: x0 - pad[0], y: cy - hgt / 2, w: lay.w + pad[0] * 2, h: hgt };
      labelBox(ctx, bx.x, bx.y, bx.w, bx.h, o.radius !== undefined ? o.radius : 4, SK.color(o.bg === true ? '--color-paper-label' : o.bg) || 'rgba(251,248,239,0.85)');
      SK.text.lastBox = bx;
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    for (var i = 0; i < lay.runs.length; i++) {
      var r = lay.runs[i];
      ctx.font = r.font;
      if (o.halo) {
        ctx.lineJoin = 'round'; ctx.lineWidth = o.haloWidth || 4; ctx.strokeStyle = SK.color(o.halo); ctx.setLineDash([]);
        ctx.strokeText(r.t, x0 + r.x, yA + r.dy);
      }
      ctx.fillStyle = color;
      ctx.fillText(r.t, x0 + r.x, yA + r.dy);
    }
    ctx.restore();
    return lay.w;
  };
  /** 숫자 고정 폭: '0' 폭 칸에 숫자 한 글자씩 (대체 글꼴일 때도 자릿수가 흔들리지 않게) */
  function tabularLayout(ctx, str, o) {
    var size = o.size || 22, font = o.font || SK.font(o.weight || 400, size);
    ctx.font = font;
    var cell = ctx.measureText('0').width, x = 0, runs = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charAt(i), w = ctx.measureText(c).width;
      if (/[0-9]/.test(c)) { runs.push({ t: c, font: font, x: x + (cell - w) / 2, dy: 0 }); x += cell; }
      else { runs.push({ t: c, font: font, x: x, dy: 0 }); x += w; }
    }
    return { runs: runs, w: x };
  }
  /** R4: 한 줄 크기 {w, h} (논리 단위). o 는 SK.text 와 같음 */
  SK.measure = function (ctx, str, o) {
    o = o || {};
    ctx.save();
    var lay = o.tabular ? tabularLayout(ctx, String(str), o) : layoutRuns(ctx, String(str === null || str === undefined ? '' : str), o);
    ctx.restore();
    return { w: lay.w, h: (o.size || 22) * 1.2 };
  };
  /** R4: 기호 하나 — SK.sym(ctx, 'v_0', x, y, o) = SK.text(ctx, '$v_0$', x, y, o) */
  SK.sym = function (ctx, sym, x, y, o) { return SK.text(ctx, '$' + sym + '$', x, y, o); };
  /** R4: 숫자 — 기본은 SK.text 와 같고, o.tabular:true 면 '0' 폭 칸 고정 */
  SK.num = function (ctx, str, x, y, o) { return SK.text(ctx, typeof str === 'number' ? fmt(str, (o && o.decimals) || 0) : str, x, y, o); };

  /** R4: 글꼴이 준비되면 풀리는 Promise (에스코어 300/400/500 + 수식 이탤릭). 1.5초 안에 안 되면 그냥 풀림 */
  SK.fontsReady = (function () {
    var fonts = document.fonts;
    if (!fonts || !fonts.load) return Promise.resolve();
    var list = ['300', '400', '500'].map(function (w) { return fonts.load(w + ' 24px "S-Core Dream"', '가A1'); });
    list.push(fonts.load('italic 400 24px ' + FONT_FALLBACK_MATH, 'vλ'));
    var all = Promise.all(list).then(function () {}, function () {});
    var late = new Promise(function (res) { setTimeout(res, 1500); });
    return Promise.race([all, late]);
  })();
  var redrawHooks = [];
  /** R4: 실험 화면·그래프를 한 번 다시 그린다(글꼴이 늦게 도착했을 때 등) */
  SK.redraw = function () {
    baseShiftCache = {};
    dirty = true;
    for (var i = 0; i < redrawHooks.length; i++) { try { redrawHooks[i](); } catch (e) { console.error(e); } }
  };
  if (document.fonts && 'onloadingdone' in document.fonts) {
    document.fonts.addEventListener('loadingdone', function () { if (initialized) SK.redraw(); });
  }

  /* --- 아이콘 (shared/icons.js = window.SimIcons) --- */
  // icons.js 를 안 불러온 예전 페이지: sim.js 바로 뒤에 끼워 넣는다(파서가 읽는 중일 때만, file:// 동작)
  (function ensureIcons() {
    if (global.SimIcons) return;
    var me = document.currentScript, src = me && me.src ? me.src.replace(/sim\.js(\?.*)?$/, 'icons.js') : '';
    if (!src || src === me.src) return;
    if (document.readyState === 'loading' && !me.async && !me.defer) document.write('<script src="' + src + '"><\/script>');
    else { var s = document.createElement('script'); s.src = src; document.head.appendChild(s); }
  })();
  /**
   * R4: 아이콘 SVG 요소. name = play pause replay reset step-back step-fwd chev-right chev-down chev-up
   *   arrow-left arrow-down arrow-up arrow-ne close check bolt help expand more warn (shared/icons.js)
   * o = {size:'sm'|'md'|'lg', cls, label} — label 이 있으면 읽어 주는 이름, 없으면 aria-hidden. 아이콘이 없으면 null
   */
  SK.icon = function (name, o) { return global.SimIcons ? global.SimIcons.el(name, o) : null; };
  SK.iconHTML = function (name, o) { return global.SimIcons ? global.SimIcons.html(name, o) : ''; };
  /** 캔버스용 path 글자열(24×24) — new Path2D(SK.iconPath('help')). SK.drawIcon 이 그려 준다 */
  SK.iconPath = function (name) { return global.SimIcons ? global.SimIcons.path(name) : ''; };
  /** R4: 캔버스에 아이콘 (x,y = 가운데, size = 논리 단위 한 변, color 토큰) */
  SK.drawIcon = function (ctx, name, x, y, size, o) {
    o = o || {};
    var d = SK.iconPath(name); if (!d || typeof Path2D === 'undefined') return;
    var s = (size || 24) / 24, col = SK.color(o.color || '--color-ink');
    ctx.save();
    ctx.translate(x - 12 * s, y - 12 * s); ctx.scale(s, s);
    var p = new Path2D(d);
    ctx.lineWidth = o.width || 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash([]);
    ctx.strokeStyle = col; ctx.stroke(p);
    if (global.SimIcons.FILLED[name]) { ctx.fillStyle = col; ctx.fill(p); }
    ctx.restore();
  };
  /** 아이콘 또는 (없으면) 원래 글자 */
  function ico(name, glyph, o) { return SK.icon(name, o) || (glyph || ''); }
  var ICONIFY_SKIP = { SVG: 1, svg: 1, KBD: 1, INPUT: 1, TEXTAREA: 1, SCRIPT: 1, STYLE: 1, CODE: 1 };
  function iconSkip(n, root) {
    for (var p = n.parentNode; p && p !== root; p = p.parentNode) {
      if (ICONIFY_SKIP[p.nodeName] || (p.classList && (p.classList.contains('btn__key') || p.classList.contains('sym') || p.classList.contains('no-ico')))) return true;
    }
    return false;
  }
  function iconAt(node, idx, name, where) {
    var t = node.nodeValue, after = node.splitText(idx);
    after.nodeValue = after.nodeValue.slice(1);
    var svg = SK.icon(name, { cls: 'ico--' + where });
    node.parentNode.insertBefore(svg, after);
    if (!t.slice(0, idx)) node.parentNode.removeChild(node);
    if (!after.nodeValue) after.parentNode.removeChild(after);
  }
  /**
   * R4: 요소 안 텍스트의 맨 앞/맨 뒤 글자 기호(▶ ⏸ ↻ ↺ ◀ ▸ ▾ ▴ ← ↓ ↑ ↗ ✕ ✓ ⚡ ? ⤢ ⋯)만 SVG 아이콘으로.
   * 가운데('10 → 20', '속도 ×2')는 그대로. '?' 는 '? 도움말'·'측정 방법 ?' 처럼 띄어 쓴 것만.
   * o.all:true 면 문장 가운데 기호도(→ × ? 제외) — 띠 문장 '아래 ▶ 실행을 눌러요' 용. 반환: el
   */
  SK.iconify = function (el, o) {
    if (!el || !global.SimIcons) return el;
    var G = global.SimIcons.GLYPHS, all = !!(o && o.all), nodes = [];
    if (el.nodeType === 3) { nodes.push(el); el = el.parentNode; }
    else {
      var w = document.createTreeWalker(el, 4, null), n;
      while ((n = w.nextNode())) if (!iconSkip(n, el)) nodes.push(n);
    }
    nodes.forEach(function (node) {
      var t = node.nodeValue; if (!t || !node.parentNode) return;
      // 맨 뒤
      var m = /(^|\s)(\S)\s*$/.exec(t);
      if (m && G[m[2]] && (m[2] !== '?' || m[1] || t.trim() === '?')) iconAt(node, m.index + m[1].length, G[m[2]], 'trail');
      if (!node.parentNode) return;
      t = node.nodeValue;
      var a = /^\s*(\S)(\s|$)?/.exec(t);
      if (a && G[a[1]] && (a[1] !== '?' || a[2] !== undefined)) { iconAt(node, t.indexOf(a[1]), G[a[1]], 'lead'); if (!node.parentNode) return; }
      if (all && node.parentNode) {
        t = node.nodeValue;
        for (var i = t.length - 1; i >= 0; i--) { var c = t.charAt(i); if (c !== '?' && G[c]) iconAt(node, i, G[c], 'mid'); if (!node.parentNode) break; }
      }
    });
    return el;
  };
  /** 글자 바꾸기 + 아이콘 (같은 글이면 건드리지 않음 — textContent 비교 대신) */
  function setText(el, text, o) {
    if (!el) return;
    text = text === null || text === undefined ? '' : String(text);
    if (el._raw === text && el.firstChild) return;
    el._raw = text;
    el.textContent = '';
    var parts = text.indexOf('{{frac:') >= 0 ? text.split(/(\{\{frac:[^}]*\}\})/) : [text];   // R5: 분수 표기도
    parts.forEach(function (pt) {
      var nodes = /^\{\{frac:/.test(pt) ? rich(pt) : mathNodes(pt);
      nodes.forEach(function (n) { el.appendChild(typeof n === 'string' ? document.createTextNode(n) : n); });
    });
    SK.iconify(el, o);
  }
  SK.setText = setText;

  /* ------------------------------------------------------------------
     1. 상태
     ------------------------------------------------------------------ */
  SK.ui = {}; SK.params = {}; SK.defs = {}; SK.controls = {};
  SK.records = []; SK.ghost = null; SK.prediction = null;
  SK.time = 0; SK.running = false; SK.started = false; SK.finished = false; SK.speed = 1;
  SK.stepIndex = 0; SK.stepName = ''; SK.el = {}; SK.view = null;
  SK.STEPS = STEPS.slice();

  var cfg = {};
  var legacySteps = null;     // 예전 cfg.steps (이름 별칭으로만 사용)
  var stepTasks = [];
  var pending = {};
  var presets = [];
  var activePreset = -1;
  var statusOverride = null;
  var dirty = true;
  var runId = 0, recordedRunId = -1;
  var history = [];
  var keyHandlers = [];
  var recordListeners = [];
  var modal = null;           // {type:'dialog'|'predict'|'mode', onKey(e), shake?}
  var lastEsc = 0;
  var noticeLast = {};
  var initialized = false;
  var sideMode = 'panel', sideUser = null;
  var mainTable = null;       // recordTable(null) 옵션
  var smallTables = [];
  var thinks = [];
  var helpCfg = null, termDict = {}, helpScrim = null;
  var takeawayCfg = null;
  var flashes = {};
  var todaySeen = false;
  var taskAlertUntil = 0;
  var noteState = { verdict: null, takeaway: null };
  var vsSel = [-1, -1];
  var openPop = null;
  var bandMsg = { text: '', until: 0 };   // R2(A1): 28자 넘는 토스트·finish(msg) → 띠 문장으로 잠깐
  var lastPredictOpts = null;             // R2(A4): 띠 [예측하기] 로 다시 열 예측
  var noteCollapsed = false;
  var showAllCols = false;                // R2(C1): 기록 표 '열 더 보기'
  var termSeen = {};                      // R2(D2): {{용어}} 첫 등장 괄호 풀이
  var warned = {};
  function warnOnce(key, msg) { if (!warned[key]) { warned[key] = true; console.warn(msg); } }
  // R6 심플 모드 (docs/SIMKIT.md §0R6) — html.is-simple 하나로 전환, 같은 DOM·같은 상태(노드 이동)
  var MODE_KEY = 'physsim.mode', SIMPLE_TOAST_KEY = 'physsim.simpleToastShown';
  var simpleCfg = null, simpleOn = false, simpleMoved = [], modeListeners = [];
  var simpleEls = {}, simpleMeterCells = {}, meterRegistry = {}, predictGate = false, openSheet = null;
  var resetArmUntil = 0, resetArmTimer = 0;

  /* ------------------------------------------------------------------
     2. init — 화면 뼈대
     ------------------------------------------------------------------ */
  SK.init = function (c) {
    if (initialized) { console.warn('SimKit.init 은 한 번만 부르세요.'); return SK; }
    initialized = true;
    cfg = c || {};
    cfg.dt = cfg.dt || 1 / 240;
    cfg.hubHref = cfg.hubHref || '../../index.html';
    if (cfg.predictOnPreset === undefined) cfg.predictOnPreset = true;
    // R2(A4): 모드·카드가 정해지면 예측 창을 자동으로. 예전 predictOnPreset:false 는 끄기로 읽는다
    if (cfg.autoPredict === undefined) cfg.autoPredict = cfg.predictOnPreset !== false;
    if (cfg.confirmPresetWithRecords === undefined) cfg.confirmPresetWithRecords = true;
    if (cfg.steps) {
      console.warn('SimKit(R1): steps 옵션은 없어졌어요. 단계 이름은 예측·실행·비교·정리로 고정입니다. 예전 이름은 data-step-only·onStep 호환용 별칭으로만 씁니다.');
      legacySteps = cfg.steps.slice(0, 4);
    }
    stepTasks = cfg.stepTasks || [];
    // R6: 심플 모드 — cfg.simple 이 있을 때만. 쿼리 ?simple=1|0 → 저장값 physsim.mode → 기본 자세히
    simpleCfg = cfg.simple && typeof cfg.simple === 'object' ? cfg.simple : null;
    simpleOn = !!simpleCfg && readModePref();
    document.documentElement.classList.toggle('is-simple', simpleOn);
    document.documentElement.classList.toggle('has-simple', !!simpleCfg);

    ensureViewport();
    if (cfg.slug) document.body.setAttribute('data-sim', cfg.slug);
    if (cfg.title && !document.title) document.title = cfg.title + ' — 물리 시뮬레이터 실험실';
    buildSkeleton();
    colorCache = {};
    if (/[?&]teacher=1\b/.test(location.search)) setTeacher(true, true);

    SK.view = SK.canvas(SK.el.stage, { w: 1250, h: cfg.stageH || 700, fit: cfg.stageFit !== false, grow: cfg.stageGrow !== false, className: 'stage-canvas' });
    // R4: cfg.onResize(view) — 무대 크기가 바뀔 때마다(태블릿 세로 여유 view.extra) view.offsetY 를 정한다
    if (cfg.onResize) { SK.view.onResize = cfg.onResize; SK.view.resize(); }
    installKeys();
    installCursorHide();
    installNoZoom();
    installTermTips();
    installBandShim();
    SK.goStep(0, true);

    setTimeout(function () {
      SK.params = copy(SK.ui);
      doReset(false);
      tidyPanel();
      renderRecords();
      if (simpleOn) { enterSimple(); simpleFirstToast(); }   // R6: 컨트롤이 다 만들어진 뒤 노드 이동
      // R4: 캔버스 글자가 대체 글꼴로 한 번 그려졌다 바뀌지 않게 — 글꼴 준비 뒤 첫 프레임 (최대 1.5초 기다림)
      var started = false;
      function start() { if (started) return; started = true; SK.redraw(); requestAnimationFrame(frame); }
      SK.fontsReady.then(start, start);
      setTimeout(start, 1600);
    }, 0);
    return SK;
  };

  function ensureViewport() {
    var m = document.querySelector('meta[name="viewport"]');
    var want = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
    if (!m) { m = h('meta', { name: 'viewport' }); document.head.appendChild(m); }
    m.setAttribute('content', want);
  }

  function btn(label, cls, onClick, extra) {
    var a = { class: 'btn ' + (cls || ''), type: 'button' };
    if (extra) for (var k in extra) a[k] = extra[k];
    var b = h('button', a, label);
    SK.iconify(b);   // R4: 맨 앞/뒤 글자 기호(▶ ▸ ▾ ✕ ? ⤢ …) → SVG 아이콘
    if (onClick) b.addEventListener('click', function (e) { blurOnMouse(e); onClick(e); });
    return b;
  }
  SK.btn = btn;
  function keyHint(k) { return h('span', { class: 'btn__key', text: k }); }

  /** R5: 켬/끔 줄 버튼(.check) — 수업 안내 서랍·수업 정보 팝업 공통. get/set 은 값 함수, 반환 버튼(._sync() 로 다시 표시) */
  function checkRow(text, get, set) {
    var b = h('button', { class: 'check', type: 'button' }, [h('span', { class: 'check__box' }), h('span', { class: 'check__text', text: text }), h('span', { class: 'check__state' })]);
    function show() { b.setAttribute('aria-pressed', String(!!get())); b.lastChild.textContent = get() ? '켬' : '끔'; }
    b.addEventListener('click', function (e) { blurOnMouse(e); set(!get()); show(); syncChecks(); });
    b._sync = show; checkRows.push(b);
    show();
    return b;
  }
  var checkRows = [];
  function syncChecks() { checkRows.forEach(function (b) { b._sync(); }); }
  function setAutoPredict(v) {
    cfg.autoPredict = !!v; cfg.predictOnPreset = !!v;
    try { localStorage.setItem('sk.autoPredict', v ? '1' : '0'); } catch (e) { /* 저장 안 돼도 이번에는 적용 */ }
  }
  function autoPredictToggle() { return checkRow('카드 바꿀 때 예측 창 자동으로 띄우기', function () { return cfg.autoPredict; }, setAutoPredict); }
  /** 교사 모드가 켜질 때만 저장된 선택을 읽는다(학생 화면은 sim 기본값) */
  function loadAutoPredict() {
    var v = null;
    try { v = localStorage.getItem('sk.autoPredict'); } catch (e) { v = null; }
    if (v === '0' || v === '1') { cfg.autoPredict = v === '1'; cfg.predictOnPreset = cfg.autoPredict; }
    syncChecks();
  }

  function buildSkeleton() {
    var root = document.getElementById(cfg.rootId || 'sim-root');
    if (!root) { root = h('div', { id: 'sim-root' }); document.body.appendChild(root); }
    root.className = 'app';
    var slide = h('div', { class: 'slide sim' });

    /* ── 제목 줄: [← 허브] 제목 ……… [수업 정보 · 교사용 ▾][? 도움말][⤢ 전체 화면] (G1 같은 윤곽선) ── */
    var infoBtn = btn('수업 정보 · 교사용 ▾', 'btn--outline', function () { toggleInfo(); }, { 'aria-expanded': 'false' });
    var today = h('p', { class: 'sim-today' }, [h('b', { text: '오늘 알아볼 것' }), cfg.today || '']);
    var dl = h('dl');
    function row(t, v) { if (v) { dl.appendChild(h('dt', { text: t })); var dd = h('dd', { text: v }); dl.appendChild(dd); return dd; } return null; }
    row('과목', cfg.subject); row('단원', cfg.unit);
    var stdCodes = (cfg.standards || []).map(function (s) { return s.charAt(0) === '[' ? s : '[' + s + ']'; });
    var stdDd = row('성취기준', stdCodes.join(' '));
    if (stdDd) { stdDd.setAttribute('tabindex', '-1'); stdDd.classList.add('info-pop__std'); }
    var teacherRow = h('div', { class: 'info-pop__teacher' }, [
      btn('교사 모드 켜기 / 끄기', 'btn--outline btn--sm', function () { closePop(); SK.toggleTeacher(); }),
      h('span', { class: 'var__hint', text: '교사 모드: 손들기 수·수업 안내·숨김값이 보여요' }),
      // R5: 교사 시연 중 카드를 바꿀 때마다 예측 창이 뜨지 않게 (= cfg.autoPredict, 교사 모드에서 localStorage 'sk.autoPredict')
      h('div', { class: 'teacher-only info-pop__auto' }, autoPredictToggle())
    ]);
    var infoPop = h('div', { class: 'info-pop', hidden: true, role: 'dialog', 'aria-label': '수업 정보' }, [cfg.today ? today : null, dl, teacherRow]);
    var teacherInfo = h('div', { class: 'sim-top__teacher teacher-only', 'aria-label': '수업 정보(교사 모드)' });
    if (cfg.subject) teacherInfo.appendChild(h('span', { class: 'chip chip--sim', text: cfg.subject }));
    // R5: 성취기준은 첫 코드 + '외 N개'(누르면 수업 정보 팝업의 성취기준 줄로) — 칩이 잘려 '[12역학0' 이 되지 않게
    // R6(S8): 두 칩 → 한 칩 '[12역학01-02] 외 1' (외 칩이 혼자 둘째 줄로 가던 것)
    if (stdCodes.length === 1) teacherInfo.appendChild(h('span', { class: 'chip chip--outline num', title: stdCodes.join(' '), text: stdCodes[0] }));
    if (stdCodes.length > 1) {
      var stdMore = h('button', { class: 'chip chip--outline num sim-top__std-more', type: 'button', title: '성취기준 모두 보기: ' + stdCodes.join(' '), 'aria-label': '성취기준 ' + stdCodes[0] + ' 외 ' + (stdCodes.length - 1) + '개 — 모두 보기' }, stdCodes[0] + ' 외 ' + (stdCodes.length - 1));
      stdMore.addEventListener('click', function (e) {
        blurOnMouse(e);
        if (SK.el.infoPop.hidden) toggleInfo();
        if (stdDd) setTimeout(function () { try { stdDd.focus({ preventScroll: true }); } catch (err) { stdDd.focus(); } stdDd.classList.add('is-flash'); setTimeout(function () { stdDd.classList.remove('is-flash'); }, 1200); }, 0);
      });
      teacherInfo.appendChild(stdMore);
    }
    var guideBtn = btn('수업 안내(교사)', 'btn--outline teacher-only', function () { SK.toggleGuide(); });
    guideBtn.hidden = true;
    var helpBtn = btn('? 도움말', 'btn--outline', function () { SK.toggleHelp(); }, { 'aria-label': '도움말' });
    var fsBtn = btn('⤢ 전체 화면', 'btn--outline', function () { SK.toggleFullscreen(); }, { 'aria-label': '전체 화면' });
    // R5: 세로 태블릿에서는 오른쪽 위 버튼을 아이콘만 — 수업 정보는 (i) 아이콘(가로에서는 숨김)
    infoBtn.classList.add('sim-top__info');
    infoBtn.setAttribute('aria-label', '수업 정보 · 교사용');
    var infoIco = SK.icon('info', { cls: 'ico--lead ico--portrait' });
    if (infoIco) infoBtn.insertBefore(infoIco, infoBtn.firstChild);
    // R6(S2): [심플 | 자세히] 분절 — 두 모드에서 같은 자리(도구 줄 맨 앞). cfg.simple 이 없으면 숨김
    var modeSeg = h('div', { class: 'mode-seg', role: 'group', 'aria-label': '화면 모드 (키 M)', hidden: !simpleCfg });
    [['심플', true], ['자세히', false]].forEach(function (m) {
      var b = h('button', { class: 'mode-seg__opt', type: 'button', 'data-simple': m[1] ? '1' : '0', 'aria-pressed': String(simpleOn === m[1]), title: m[0] + ' 모드로 (키 M)' }, m[0]);
      b.addEventListener('click', function (e) { blurOnMouse(e); SK.setSimple(m[1], { save: true }); });
      modeSeg.appendChild(b);
    });
    var top = h('header', { class: 'sim-top' }, [
      h('a', { class: 'sim-top__hub', href: cfg.hubHref, title: '처음 화면(실험 고르기)으로' }, [ico('arrow-left', '←'), '허브']),
      h('h1', { class: 'sim-title', text: cfg.title || '제목', title: cfg.title || null }),
      teacherInfo,
      h('span', { class: 'sim-top__spacer' }),
      h('div', { class: 'sim-top__tools' }, [modeSeg, guideBtn, infoBtn, helpBtn, fsBtn, infoPop])
    ]);

    /* ── 지금 할 일 띠: 단계 | 문장 [주 행동(실행 아님)] [○○하러 가기 ▸] ── */
    var stepList = h('ol', { class: 'task-steps', 'aria-label': '수업 단계' });
    STEPS.forEach(function (name, i) {
      var b = h('button', { class: 'task-step', type: 'button', 'data-i': i, title: (i + 1) + '단계 ' + withJosa(name, '으로/로') + ' 가기' }, [
        h('span', { class: 'task-step__num', 'aria-hidden': 'true', text: String(i + 1) }),
        h('span', { class: 'task-step__name', text: name })
      ]);
      b.addEventListener('click', function (e) { blurOnMouse(e); SK.goStep(i); });
      stepList.appendChild(h('li', null, b));
    });
    var taskSub = h('p', { class: 'task-now__sub', hidden: true });
    var taskText = h('p', { class: 'task-now__text', 'aria-live': 'polite' });
    var taskWords = h('div', { class: 'task-now__words' }, [taskSub, taskText]);
    var taskAct = h('button', { class: 'btn btn--primary task-now__act', type: 'button' });
    taskAct.addEventListener('click', function (e) { blurOnMouse(e); if (taskAct._fn) taskAct._fn(); });
    var taskNext = btn('다음 단계 ▸', 'btn--quiet task-now__next', function () { SK.nextStep(); });
    var task = h('section', { class: 'sim-task', 'aria-label': '지금 할 일' }, [stepList, h('div', { class: 'task-now' }, [taskWords, taskAct, taskNext])]);

    /* ── R2(A2): 예전 실험 화면 위 해설(.sim-note)은 없앰. 예전 코드가 SimKit.el.note 를 읽어도
          아무 일이 없도록 늘 숨은 빈 칸을 남긴다(자리 피하기 코드가 0 을 얻음) ── */
    var legacyNote = h('section', { class: 'sim-note-legacy', hidden: true, 'aria-hidden': 'true' });

    /* ── 실험 화면 ── */
    var stage = h('main', { class: 'sim-stage', 'aria-label': '실험 화면' });
    var cTL = h('div', { class: 'stage-corner stage-corner--tl' });
    var cTR = h('div', { class: 'stage-corner stage-corner--tr' });
    var cBL = h('div', { class: 'stage-corner stage-corner--bl' });
    var cBR = h('div', { class: 'stage-corner stage-corner--br' });
    var status = h('div', { class: 'stage-status', 'aria-live': 'polite', 'aria-label': '지금 상태' });
    cTL.appendChild(status);
    stage.appendChild(cTL); stage.appendChild(cTR); stage.appendChild(cBL); stage.appendChild(cBR);
    /* R2(A1): 토스트 자리 = 실험 화면 안 위 가운데 한 줄 */
    var notices = h('div', { class: 'notice-zone', 'aria-live': 'assertive' });
    stage.appendChild(notices);

    /* ── 조절 패널: 해설 카드(실행 뒤) → 수치 → 상황 → 표시 → 더 많은 설정 ── */
    var toRecBtn = btn('기록 표 보기 ▸', 'btn--quiet btn--sm side-switch', function () { setSide(sideMode === 'panel' && SK.stepIndex === 3 && visibleThinks() ? 'think' : 'records', true); });
    toRecBtn.hidden = true;
    var legend = h('div', { class: 'panel-legend' }, [
      /* R3: ⚡·↻ 둘 다 같은 칩, 가운데 '·' 대신 간격 */
      h('span', { class: 'panel-legend__words' }, [
        h('span', { class: 'apply-ico apply-ico--live', 'aria-hidden': 'true' }, ico('bolt', '⚡')), h('span', { text: '값을 바꾸면 바로 반영' })
      ]),
      h('span', { class: 'panel-legend__words' }, [
        h('span', { class: 'apply-ico apply-ico--restart', 'aria-hidden': 'true' }, ico('replay', '↻')), h('span', { text: '바꾸면 처음부터 다시 실행' })
      ]),
      toRecBtn
    ]);
    /* R3: 범례 첫 방문 말풍선(legendTip)은 삭제 — 범례 줄과 같은 말 */
    var modeLine = h('div', { class: 'panel-mode', hidden: true });
    var panelHead = h('div', { class: 'panel-head' }, [modeLine, legend]);
    var noteEl = buildPanelNote();
    // R5: 해설 카드는 스크롤 상자 맨 위에 — 카드 안 스크롤과 패널 스크롤이 겹치던 것(두 겹 스크롤) 없앰
    var scroll = h('div', { class: 'sim-panel__scroll' }, [noteEl.root]);
    var secs = {};
    SECTION_ORDER.forEach(function (name) {
      var body = h('div', { class: 'panel-sec__body' });
      var rb = btn('기본값으로 ↺', 'btn--quiet btn--sm', function () { resetSection(body); }, { title: '이 묶음의 값을 기본값으로 되돌려요' });
      rb.hidden = true;
      var sec = h('section', { class: 'panel-sec', 'data-sec': name }, [h('h2', { class: 'panel-sec__title' }, [SECTION_TITLES[name], rb]), body]);
      sec._reset = rb;
      scroll.appendChild(sec); secs[name] = body;
    });
    var deepBody = h('div', { class: 'panel-sec__body' });
    var deep = h('details', { class: 'panel-sec panel-deep', 'data-sec': 'deep' }, [
      h('summary', { class: 'panel-sec__title', text: SECTION_TITLES.deep }), deepBody
    ]);
    scroll.appendChild(deep); secs.deep = deepBody;
    var foot = h('div', { class: 'panel-foot' });
    scroll.appendChild(foot);
    /* R2(A5): '아래에 더 있어요 ↓' = 누르면 다음 묶음 머리까지 */
    var more = SK.iconify(h('button', { class: 'panel-more', type: 'button', hidden: true }, '아래에 더 있어요 ↓'));
    more.addEventListener('click', function (e) { blurOnMouse(e); scrollToNextSection(); });
    scroll.addEventListener('scroll', checkMore, { passive: true });
    var panelBox = h('aside', { class: 'sim-panel', 'aria-label': '조절 패널' }, [panelHead, scroll, more]);

    /* ── 기록 표 큰 판 · 정리 질문 판 (패널 자리) ── */
    var recNeed = h('div');
    var recTitle = h('span', { text: '표' });
    var recChanged = h('p', { class: 'rec-changed', hidden: true });
    var recMoreCols = btn('열 더 보기 ▾', 'btn--outline btn--sm', function () { showAllCols = !showAllCols; renderRecords(); });
    recMoreCols.hidden = true;
    var recScroll = h('div', { class: 'rec-box__scroll scroll-shadow' });
    var recSlide = SK.iconify(h('p', { class: 'rec-slide', hidden: true, text: '← 옆으로 밀어 보기' }));
    recScroll.addEventListener('scroll', function () { checkRecScroll(); }, { passive: true });
    // R5: '표 크게 보기' — 실험 화면 자리 전체에 모든 열을 큰 글자로 (발표용)
    var recFullBtn = btn([ico('expand', '', { cls: 'ico--lead' }), '표 크게 보기'], 'btn--outline btn--sm rec-full-btn', function () { SK.showRecordsFull(true); }, { title: '모든 열을 큰 글자로 (Esc 로 닫기)' });
    var recBox = h('div', { class: 'rec-box' }, [h('div', { class: 'rec-box__head' }, [recTitle, recMoreCols, recFullBtn, h('span', { class: 'rec-box__end' })]), recChanged, recScroll, recSlide]);
    var recExtra = h('div', { class: 'rec-extra' });
    var recVs = h('div');
    var recBigBody = h('div', { class: 'side-body' }, [recNeed, recBox, h('p', { class: 'var__hint', text: '굵은 글씨 = 앞 기록과 달라진 값 · 한 번에 한 가지만 바꿔야 무엇 때문인지 알 수 있어요' }), recExtra, recVs]);
    var recCount = h('span', { class: 'chip chip--primary num' });
    var recNoteChip = noteChip();
    var recBig = h('aside', { class: 'rec-big', hidden: true, 'aria-label': '기록 비교' }, [
      h('div', { class: 'side-head' }, [h('h2', { text: '기록 비교' }), recCount, recNoteChip.btn, btn('설정 보기 ▸', 'btn--quiet btn--sm', function () { setSide('panel', true); })]),
      recNoteChip.pop, recBigBody
    ]);
    var thinkList = h('div', { class: 'side-body' });
    var thinkNoteChip = noteChip();
    var thinkBoard = h('aside', { class: 'think-board', hidden: true, 'aria-label': '정리 질문' }, [
      h('div', { class: 'side-head' }, [h('h2', { text: '정리해 봐요' }), thinkNoteChip.btn, btn('설정 보기 ▸', 'btn--quiet btn--sm', function () { setSide('panel', true); })]),
      thinkNoteChip.pop, thinkList
    ]);

    /* ── 하단 띠 + 기록 칩 ('저장한 실험 1/5 (최대 5) · 표 보기') ── */
    var meters = h('div', { class: 'band-cell band-cell--meters' });
    var graph = h('div', { class: 'band-cell band-cell--graph' });
    var band = h('section', { class: 'sim-band', 'aria-label': '측정값·그래프' }, [meters, graph]);
    var chipCount = h('span', { class: 'rec-chip__count' });
    var chipBtn = btn('표 보기', 'btn--outline', function () { setSide(sideMode === 'records' ? 'panel' : 'records', true); });
    var recChip = h('div', { class: 'rec-chip', 'aria-label': '저장한 실험' }, [chipCount, h('div', { class: 'rec-chip__row' }, [h('span', { class: 'rec-chip__max', text: '(최대 5)' }), chipBtn])]);

    /* ── 하단 막대: 실험 카드 | [▶ 실행] [한 장면 뒤로][한 장면 앞으로][속도] [기본값으로 되돌리기][그 밖의 기능 ▾] ── */
    var presetsBox = h('div', { class: 'sim-bar__presets', role: 'group', 'aria-label': '실험 카드' });
    var btnRun = h('button', { class: 'btn btn--primary btn--run', type: 'button' });
    btnRun.addEventListener('click', function (e) { blurOnMouse(e); SK.toggle(); });
    var btnBack = btn([ico('step-back', '◀', { cls: 'ico--lead' }), '한 장면 뒤로', keyHint(',')], '', function () { SK.stepFrame(-1); }, { title: '실행 장면을 되감아 봐요' });
    var btnFwd = btn(['한 장면 앞으로', ico('step-fwd', '▶', { cls: 'ico--trail' }), keyHint('.')], '', function () { SK.stepFrame(1); }, { title: '실행 장면을 조금씩 넘겨 봐요' });
    var speedMenu = h('div', { class: 'pop-menu', hidden: true, role: 'menu', 'aria-label': '재생 속도' });
    SPEEDS.forEach(function (s) {
      var it = h('button', { type: 'button', role: 'menuitemradio', 'data-s': s }, '×' + s + ' ' + SPEED_WORDS[s]);
      it.addEventListener('click', function () { SK.setSpeed(s); closePop(); });
      speedMenu.appendChild(it);
    });
    var btnSpeed = btn('', 'num', function () { togglePop(speedMenu); }, { 'aria-haspopup': 'menu', title: '재생 속도' });
    // R2(B1): 하단 [기록하기] 는 없앰(기록 = 상단 띠). 예전 코드가 SimKit.el.btnRec 를 만져도 깨지지 않게 숨은 버튼을 남긴다
    var btnRec = btn('기록하기', 'btn--secondary', function () { SK.record(); });
    btnRec.hidden = true;
    // R6(S15): 두 번 눌러 되돌리기 — 첫 누름은 '한 번 더 누르면 되돌려요'(3초)
    var btnReset = btn([h('span', { class: 'reset-txt', text: '기본값으로 되돌리기' }), keyHint('R')], 'bar-reset', function () { resetTwoStep(); }, { title: '바꾼 값을 기본값으로 되돌리고 실험을 처음 상태로 (기록은 그대로) — 두 번 눌러요' });
    var moreMenu = h('div', { class: 'pop-menu', hidden: true, role: 'menu', 'aria-label': '그 밖의 기능' });
    var btnMore = btn('그 밖의 기능 ▾', '', function () { buildMoreMenu(); togglePop(moreMenu); }, { 'aria-haspopup': 'menu' });
    var grid = h('div', { class: 'bar-grid' }, [
      btnBack, btnFwd, h('div', { class: 'pop-wrap' }, [btnSpeed, speedMenu]),
      btnReset, h('div', { class: 'pop-wrap' }, [btnMore, moreMenu])
    ]);
    var bar = h('footer', { class: 'sim-bar', 'aria-label': '실행 조절' }, [presetsBox, h('div', { class: 'sim-bar__ctl' }, [btnRun, grid, btnRec])]);

    var uProbe = h('i', { class: 'u-probe', 'aria-hidden': 'true' });
    // R6: 단원색 띠(머리줄 위, 두 모드) + 심플 모드 칸(빈 칸 — 내용은 enterSimple 이 채운다. html.is-simple 가 아니면 display:none)
    var colorbar = h('i', { class: 'sim-colorbar', 'aria-hidden': 'true' });
    var simple = buildSimpleShell();
    [colorbar, top, task, stage, legacyNote, panelBox, recBig, thinkBoard, band, recChip, bar].concat(simple, [uProbe]).forEach(function (n) { slide.appendChild(n); });
    root.innerHTML = '';
    root.appendChild(slide);
    // R5: 폭 600 이하(휴대전화)만 보이는 안내 띠(shell.css). ✕ 로 닫으면 이 세션 동안 숨김
    var warnOff = false;
    try { warnOff = sessionStorage.getItem('sk.narrowWarnOff') === '1'; } catch (e) { warnOff = false; }
    if (!document.querySelector('.narrow-warn') && !warnOff) {
      var warnClose = btn('✕', 'btn--quiet narrow-warn__close', function () {
        warnBox.hidden = true;
        try { sessionStorage.setItem('sk.narrowWarnOff', '1'); } catch (e) { /* 저장 안 돼도 닫힘 */ }
      }, { 'aria-label': '안내 닫기', title: '닫기' });
      var warnBox = h('div', { class: 'narrow-warn', role: 'note' }, [
        h('b', { text: '화면이 좁아요' }), h('span', { text: '가로로 돌리면 더 크게 볼 수 있어요' }), warnClose
      ]);
      document.body.appendChild(warnBox);
    }

    SK.el = {
      root: root, slide: slide, uProbe: uProbe, top: top, task: task, note: legacyNote, noteBody: noteEl.body, panelNote: noteEl.root, status: status,
      steps: stepList, taskText: taskText, taskSub: taskSub, taskWords: taskWords, taskAct: taskAct, taskNext: taskNext,
      stage: stage, panel: scroll, panelBox: panelBox, panelHead: panelHead, panelMore: more, modeLine: modeLine, toRecBtn: toRecBtn,
      sections: secs, panelFoot: foot, recBig: recBig, recBigBody: recBigBody, recCount: recCount,
      recNeed: recNeed, recBox: recBox, recTitle: recTitle, recScroll: recScroll, recVs: recVs, recExtra: recExtra,
      recChanged: recChanged, recMoreCols: recMoreCols, recSlide: recSlide, recFullBtn: recFullBtn,
      thinkBoard: thinkBoard, thinkList: thinkList, noteChips: [recNoteChip, thinkNoteChip],
      band: band, meters: meters, graph: graph, records: recChip, recChipCount: chipCount, recChipBtn: chipBtn,
      bar: bar, presets: presetsBox, notices: notices,
      cornerTL: cTL, cornerTR: cTR, cornerBL: cBL, cornerBR: cBR,
      btnRun: btnRun, btnBack: btnBack, btnFwd: btnFwd, btnSpeed: btnSpeed, btnRec: btnRec, btnReset: btnReset, btnMore: btnMore,
      speedMenu: speedMenu, moreMenu: moreMenu, infoBtn: infoBtn, infoPop: infoPop, helpBtn: helpBtn, guideBtn: guideBtn,
      modeSeg: modeSeg, colorbar: colorbar, simple: simpleEls
    };
    noteEls = noteEl;
    updateTransport();
    try { localStorage.removeItem('simkit:legend-seen'); } catch (e) { /* R3: 예전 말풍선 저장 키 정리 */ }
  }

  SK.panel = function (name) {
    if (!SK.el.sections) throw new Error('SimKit.init 을 먼저 부르세요.');
    return SK.el.sections[name] || SK.el.sections.values;
  };
  function resolveWhere(where) {
    if (!where) return SK.panel('values');
    if (typeof where === 'string') return SK.panel(where);
    return where;
  }

  /* 패널 정리: 칸마다 '기본값으로 ↺' 는 값 위젯이 있을 때만 */
  function tidyPanel() {
    var secs = SK.el.panel.querySelectorAll('.panel-sec[data-sec]');
    for (var i = 0; i < secs.length; i++) {
      var s = secs[i];
      if (s._reset) s._reset.hidden = !s.querySelector('[data-key]');
    }
    checkMore();
  }
  function resetSection(body) {
    var els = body.querySelectorAll('[data-key]');
    for (var i = 0; i < els.length; i++) {
      var k = els[i].getAttribute('data-key'), c = SK.controls[k];
      if (c && c.def && c.def.initial !== undefined && c.get() !== c.def.initial) c.set(c.def.initial);
    }
    SK.notice('이 묶음을 기본값으로 되돌렸어요', 'info');
  }
  function checkMore() {
    var s = SK.el.panel; if (!s) return;
    // R3: 스크롤 끝 padding(64u)만 남았으면 '더 있음' 아님
    var pad = parseFloat(getComputedStyle(s).paddingBottom) || 0;
    var hasMore = s.scrollHeight - s.scrollTop - s.clientHeight - pad > 6;
    if (SK.el.panelMore.hidden === hasMore) SK.el.panelMore.hidden = !hasMore;
    s.classList.toggle('has-more', hasMore);
  }
  /** R2(A5): '아래에 더 있어요 ↓' → 다음 묶음 머리까지 부드럽게 */
  function scrollToNextSection() {
    var s = SK.el.panel, heads = s.querySelectorAll('.panel-sec');
    var cur = s.scrollTop + 8, target = null;
    for (var i = 0; i < heads.length; i++) {
      if (heads[i].offsetParent === null) continue;
      // R3(팀장): 스크롤 상자가 position:relative 라 offsetTop 은 이미 상자 기준 — 머리가 딱 위에 붙어 앞 묶음 머리가 비치지 않는다
      var y = heads[i].offsetTop - (heads[i].offsetParent === s ? 0 : s.offsetTop);
      if (y > cur + 4) { target = y; break; }
    }
    if (target === null || target > s.scrollTop + s.clientHeight * 1.2) target = s.scrollTop + s.clientHeight * 0.7;
    s.scrollTo({ top: target, behavior: 'smooth' });
  }

  /**
   * R2(B2): [기본값으로 되돌리기] — 기록되는 값(수치·상황)을 처음 값으로, 실험을 처음 상태로.
   * 기록·모드 선택·화면 표시 도구는 그대로. 실행만 처음으로 돌리려면 SimKit.reset() (예전과 같음).
   */
  SK.resetDefaults = function (quiet) {
    if (modal) { if (modal.shake) modal.shake(); return; }
    doReset(true);
    var changed = 0;
    for (var k in SK.controls) {
      var c = SK.controls[k], d = c.def;
      if (!d || !d.record || d.initial === undefined) continue;
      if (modeApi && modeApi.key === k) continue;
      if (c.get() !== d.initial) { c.set(d.initial, { source: 'reset' }); changed++; }
    }
    markPreset(-1);
    doReset(false);
    if (!quiet) SK.notice(changed ? '기본값으로 되돌렸어요' : '이미 기본값이에요', 'info');
  };
  /** R6(S15): 기록되는 값 가운데 기본값과 다른 것의 수 (모드 선택 제외) */
  function defaultsChanged(skip) {
    var n = 0;
    for (var k in SK.controls) {
      var c = SK.controls[k], d = c.def;
      if (!d || !d.record || d.initial === undefined) continue;
      if (modeApi && modeApi.key === k) continue;
      if (skip && skip[k]) continue;
      if (c.get() !== d.initial) n++;
    }
    return n;
  }
  /** R6(S15): [기본값으로 되돌리기]·R 키 — 첫 누름은 '한 번 더 누르면 되돌려요'(3초), 두 번째에 실행. 바꾼 값이 없으면 바로 */
  function resetButtons() { return [SK.el.btnReset, simpleEls.resetBtn].filter(Boolean); }
  function disarmReset() {
    resetArmUntil = 0; clearTimeout(resetArmTimer);
    resetButtons().forEach(function (b) {
      b.classList.remove('is-confirm');
      var t = b.querySelector('.reset-txt'); if (t && t._orig) t.textContent = t._orig;
      b.style.minWidth = '';
    });
  }
  function resetTwoStep(src) {
    if (modal) { if (modal.shake) modal.shake(); return; }
    if (!defaultsChanged() || Date.now() < resetArmUntil) { disarmReset(); SK.resetDefaults(); return; }
    resetArmUntil = Date.now() + 3000;
    resetButtons().forEach(function (b) {
      var t = b.querySelector('.reset-txt'); if (!t) return;
      if (!t._orig) t._orig = t.textContent;
      if (b.offsetWidth) b.style.minWidth = b.offsetWidth + 'px';   // 자리·폭 고정 (R22)
      b.classList.add('is-confirm');
      t.textContent = '한 번 더 누르면 되돌려요';
    });
    if (src === 'key') SK.notice('R 을 한 번 더 누르면 되돌려요', 'info', 3000);
    clearTimeout(resetArmTimer); resetArmTimer = setTimeout(disarmReset, 3000);
  }

  /* ------------------------------------------------------------------
     2-R6. 심플 모드 — html.is-simple 하나로 전환. 컨트롤 노드는 옮기기만(값·핸들러 그대로), 되돌릴 때 원래 자리로.
       cfg.simple = {task, params:[key ≤3], situation:[key], meters:[key|{key,label,unit,decimals}], presets:[i|name],
                     predict:'button'|'off'|{예측 옵션}, extras:[{key,label}]}
     ------------------------------------------------------------------ */
  function readModePref() {
    var q = null, v = null;
    try { q = new URLSearchParams(location.search).get('simple'); } catch (e) { q = null; }
    if (q === '1' || q === '0') { saveModePref(q === '1'); return q === '1'; }   // 쿼리가 저장값보다 먼저, 읽은 뒤 저장
    try { v = localStorage.getItem(MODE_KEY); } catch (e) { v = null; }
    return v === 'simple';
  }
  function saveModePref(on) { try { localStorage.setItem(MODE_KEY, on ? 'simple' : 'full'); } catch (e) { /* 저장 안 돼도 이번에는 적용 */ } }
  /** 주소에 ?simple= 이 있으면 바꾼 모드로 고쳐 둔다(새로 고침해도 같은 모드) */
  function syncModeQuery(on) {
    try {
      var sp = new URLSearchParams(location.search);
      if (!sp.has('simple')) return;
      sp.set('simple', on ? '1' : '0');
      history.replaceState(history.state, '', location.pathname + '?' + sp.toString() + location.hash);
    } catch (e) { /* file:// 등에서 안 되면 그대로 */ }
  }
  SK.isSimple = function () { return simpleOn; };
  SK.onMode = function (fn) { if (typeof fn === 'function') modeListeners.push(fn); };
  /** SK.setSimple(on, {save:true}) — cfg.simple 이 없으면 늘 자세히. save:false 면 저장·주소를 건드리지 않는다 */
  SK.setSimple = function (on, o) {
    o = o || {};
    on = !!on && !!simpleCfg;
    if (o.save !== false && simpleCfg) { saveModePref(on); syncModeQuery(on); }
    if (on === simpleOn) return;
    simpleOn = on;
    closeSheets(); closePop(); disarmReset();
    if (on && modal && modal.type === 'mode' && modal.close) modal.close();   // 심플에서는 모드 창 대신 상황 단추
    var html = document.documentElement;
    if (on) { SK.el.slide.classList.remove('is-collapsed'); enterSimple(); html.classList.add('is-simple'); }
    else { leaveSimple(); html.classList.remove('is-simple'); }
    syncModeSeg();
    var sl = SK.el.slide;
    sl.classList.remove('is-mode-anim'); void sl.offsetWidth; sl.classList.add('is-mode-anim');   // 120ms 투명도만 (줄이기면 0)
    setTimeout(function () { sl.classList.remove('is-mode-anim'); }, 260);
    if (SK.view) SK.view.resize();
    dirty = true;
    updateTransport(); if (SK.el.status) SK.el.status._sig = null; SK.update();
    setTimeout(checkMore, 0);
    if (on) simpleFirstToast();
    modeListeners.forEach(function (fn) { try { fn(on); } catch (e) { console.error(e); } });
  };
  function syncModeSeg() {
    var bs = SK.el.modeSeg ? SK.el.modeSeg.querySelectorAll('.mode-seg__opt') : [];
    for (var i = 0; i < bs.length; i++) bs[i].setAttribute('aria-pressed', String((bs[i].getAttribute('data-simple') === '1') === simpleOn));
  }
  function simpleFirstToast() {
    var seen = false;
    try { seen = localStorage.getItem(SIMPLE_TOAST_KEY) === '1'; } catch (e) { seen = false; }
    if (seen) return;
    try { localStorage.setItem(SIMPLE_TOAST_KEY, '1'); } catch (e) { /* 이번 한 번만 */ }
    setTimeout(function () { SK.notice('자세히 모드는 오른쪽 위에서 바꿔요', 'info', 4000); }, 300);
  }

  /** 심플 칸 뼈대(빈 칸). buildSkeleton 이 무대에 붙인다. html.is-simple 가 아니면 CSS 가 숨긴다 */
  function buildSimpleShell() {
    var E = simpleEls;
    E.taskText = h('p', { class: 'simple-task__text', 'aria-live': 'polite' });
    E.predict = btn('예측 ▸', 'btn--outline simple-task__predict', function () { simplePredict(); }, { title: '결과를 먼저 예측해 봐요' });
    E.task = h('section', { class: 'simple-task simple-only', 'aria-label': '지금 할 일' }, [E.taskText, E.predict]);
    E.rail = h('section', { class: 'simple-rail simple-only', 'aria-label': '바꿀 값' });
    E.meters = h('section', { class: 'simple-meters simple-only', 'aria-label': '측정값' });

    /* 아래 막대: [▶ 실행][↺ 다시][속도] …… [실험 ▾][⋯ 더 보기] */
    E.run = h('button', { class: 'btn btn--primary simple-run', type: 'button' });
    E.run.addEventListener('click', function (e) { blurOnMouse(e); SK.toggle(); });
    E.again = btn('↺ 다시', 'btn--outline simple-again', function () { SK.reset(); }, { title: '실험을 처음 상태로 (값은 그대로)' });
    E.speedMenu = h('div', { class: 'pop-menu simple-speed-menu', hidden: true, role: 'menu', 'aria-label': '재생 속도' });
    SPEEDS.forEach(function (s) {
      var it = h('button', { type: 'button', role: 'menuitemradio', 'data-s': s }, '×' + s + ' ' + SPEED_WORDS[s]);
      it.addEventListener('click', function () { SK.setSpeed(s); closePop(); });
      E.speedMenu.appendChild(it);
    });
    E.speed = btn('', 'btn--outline num simple-speed', function () { togglePop(E.speedMenu); }, { 'aria-haspopup': 'menu', title: '재생 속도' });
    E.presetsBtn = btn('실험 ▾', 'btn--outline simple-presets-btn', function () { toggleSheet('presets'); }, { 'aria-haspopup': 'dialog', 'aria-expanded': 'false', title: '실험 카드 고르기' });
    E.moreDot = h('span', { class: 'simple-more-dot', hidden: true, title: '더 보기 안에서 바꾼 값이 있어요' });
    E.moreBtn = btn('⋯ 더 보기', 'btn--outline simple-more-btn', function () { toggleSheet('more'); }, { 'aria-haspopup': 'dialog', 'aria-expanded': 'false', title: '다른 설정·기록 표·해설·정리 질문' });
    E.moreBtn.appendChild(E.moreDot);
    E.bar = h('footer', { class: 'simple-bar simple-only', 'aria-label': '실행' }, [
      E.run, E.again, h('div', { class: 'pop-wrap simple-speed-wrap' }, [E.speed, E.speedMenu]),
      h('span', { class: 'simple-bar__gap' }), E.presetsBtn, E.moreBtn
    ]);

    /* 더 보기 시트: 위 = 원래 조절 패널·기록 판·정리 판(옮겨 옴, 안쪽 스크롤 한 겹) · 아래 = 도구 줄(누르는 것은 아래쪽에) */
    E.scrim = h('div', { class: 'sheet-scrim simple-only', hidden: true });
    E.scrim.addEventListener('pointerdown', function (e) { e.preventDefault(); closeSheets(); });
    function sheetHead(title) {
      return h('div', { class: 'sheet__head' }, [h('h2', { class: 'sheet__title', text: title }),
        btn('✕', 'btn--quiet sheet__close', function () { closeSheets(); }, { 'aria-label': '닫기', title: '닫기 (Esc)' })]);
    }
    E.moreBody = h('div', { class: 'sheet__body' });
    E.steps = h('div', { class: 'sheet__steps', role: 'group', 'aria-label': '수업 단계' });
    STEPS.forEach(function (name, i) {
      var b = h('button', { class: 'sheet__step', type: 'button', 'data-i': i }, [h('span', { class: 'sheet__step-num', text: String(i + 1) }), name]);
      b.addEventListener('click', function (e) { blurOnMouse(e); SK.goStep(i); });
      E.steps.appendChild(b);
    });
    E.backBtn = btn('◀ 뒤로', 'btn--outline', function () { SK.stepFrame(-1); }, { title: '한 장면 뒤로 (,)', 'aria-label': '한 장면 뒤로' });
    E.fwdBtn = btn('앞으로 ▶', 'btn--outline', function () { SK.stepFrame(1); }, { title: '한 장면 앞으로 (.)', 'aria-label': '한 장면 앞으로' });
    E.recBtn = btn('기록하기', 'btn--outline sheet__rec', function () { SK.record(); syncSheetTools(); });
    E.resetBtn = btn([h('span', { class: 'reset-txt', text: '기본값으로' }), ico('reset', '↺', { cls: 'ico--trail' })], 'btn--outline sheet__reset', function () { resetTwoStep(); }, { title: '기본값으로 되돌리기 — 두 번 눌러요', 'aria-label': '기본값으로 되돌리기' });
    E.extras = h('div', { class: 'sheet__extras' });
    E.guideBtn = btn('수업 안내(교사)', 'btn--outline teacher-only', function () { closeSheets(); SK.toggleGuide(true); });
    E.infoBtn = btn('수업 정보', 'btn--outline teacher-only', function () { closeSheets(); toggleInfo(); });
    E.toFull = btn('자세히 모드로 ▸', 'btn--secondary sheet__full', function () { SK.setSimple(false, { save: true }); });
    E.more = h('section', { class: 'sheet sheet--more simple-only', hidden: true, role: 'dialog', 'aria-label': '더 보기' }, [
      sheetHead('더 보기'), E.moreBody,
      h('div', { class: 'sheet__tools' }, [
        E.steps,
        h('div', { class: 'sheet__row' }, [E.backBtn, E.fwdBtn, E.recBtn, E.resetBtn]),
        h('div', { class: 'sheet__row' }, [E.extras, E.guideBtn, E.infoBtn, h('span', { class: 'sheet__gap' }), E.toFull])
      ])
    ]);
    E.presetGrid = h('div', { class: 'sheet__cards' });
    E.presetsSheet = h('section', { class: 'sheet sheet--presets simple-only', hidden: true, role: 'dialog', 'aria-label': '실험 고르기' }, [sheetHead('실험 고르기'), E.presetGrid]);
    return [E.task, E.rail, E.meters, E.bar, E.scrim, E.more, E.presetsSheet];
  }

  function toggleSheet(name, o) { if (openSheet === name) closeSheets(); else showSheet(name, o); }
  function showSheet(name, o) {
    var E = simpleEls; if (!E.more || !simpleOn) return;
    closeSheets(); closePop();
    var el = name === 'presets' ? E.presetsSheet : E.more;
    if (name === 'presets') renderPresetSheet(); else syncSheetTools();
    el.hidden = false; E.scrim.hidden = false; openSheet = name;
    (name === 'presets' ? E.presetsBtn : E.moreBtn).setAttribute('aria-expanded', 'true');
    if (name === 'more') {
      if (o && o.note) { setSide('panel', true); if (SK.el.panel) SK.el.panel.scrollTop = 0; }
      setTimeout(checkMore, 0);
    }
  }
  function closeSheets() {
    var E = simpleEls; if (!E.more) return;
    E.more.hidden = true; E.presetsSheet.hidden = true; E.scrim.hidden = true;
    E.moreBtn.setAttribute('aria-expanded', 'false'); E.presetsBtn.setAttribute('aria-expanded', 'false');
    openSheet = null;
  }
  SK.openSheet = function (name) { showSheet(name === 'presets' ? 'presets' : 'more'); };
  SK.closeSheet = closeSheets;

  /** 심플 시트 아래 도구 줄 상태 (단계·기록·되감기·추가 토글·교사 단추) */
  function syncSheetTools() {
    var E = simpleEls; if (!E.steps) return;
    var bs = E.steps.querySelectorAll('.sheet__step');
    for (var i = 0; i < bs.length; i++) { if (i === SK.stepIndex) bs[i].setAttribute('aria-current', 'step'); else bs[i].removeAttribute('aria-current'); }
    E.recBtn.hidden = !cfg.capture;
    E.recBtn.disabled = !SK.canRecord();
    setText(E.recBtn, '기록하기 ' + SK.records.length + '/' + MAX_RECORDS);
    E.backBtn.disabled = !(cfg.save && cfg.load);
    E.guideBtn.hidden = !drawerEl;
    E.extras.innerHTML = '';
    ((simpleCfg && simpleCfg.extras) || []).forEach(function (x) {
      var c = SK.controls[x.key]; if (!c) return;
      var b = h('button', { class: 'check sheet__extra', type: 'button', 'aria-pressed': String(!!c.get()) }, [
        h('span', { class: 'check__box', 'aria-hidden': 'true' }), h('span', { class: 'check__text' }, rich(x.label || plain(c.def.label)))
      ]);
      b.addEventListener('click', function (e) { blurOnMouse(e); c.set(!c.get(), { source: 'ui' }); b.setAttribute('aria-pressed', String(!!c.get())); });
      E.extras.appendChild(b);
    });
    E.extras.hidden = !E.extras.children.length;
  }

  function simplePresetList() {
    var want = simpleCfg && simpleCfg.presets, out = [];
    if (!want) { for (var i = 0; i < presets.length; i++) out.push(i); return out; }
    want.forEach(function (w) {
      var idx = typeof w === 'number' ? w : -1;
      if (typeof w === 'string') for (var j = 0; j < presets.length; j++) if (presets[j].name === w) idx = j;
      if (idx >= 0 && presets[idx] && out.indexOf(idx) < 0) out.push(idx);
    });
    return out;
  }
  function renderPresetSheet() {
    var g = simpleEls.presetGrid; if (!g) return;
    g.innerHTML = '';
    simplePresetList().forEach(function (i) {
      var p = presets[i], ch = changesText(p);
      var b = h('button', { class: 'sheet__card', type: 'button', 'aria-pressed': String(activePreset === i), 'aria-label': (i + 1) + '번 실험: ' + p.name }, [
        h('span', { class: 'sheet__card-name' }, [h('span', { class: 'sheet__card-key' }, circ(i + 1)), h('span', { text: p.name })]),
        ch ? h('span', { class: 'sheet__card-ch' }, rich(ch)) : null
      ]);
      b.addEventListener('click', function (e) { blurOnMouse(e); closeSheets(); SK.applyPreset(i, { noConfirm: true }); });
      g.appendChild(b);
    });
  }

  /** 들어가기: 상황·변수 노드 → 레일, 패널·기록 판·정리 판 → 더 보기 시트, 측정 칸 만들기 */
  function enterSimple() {
    var sc = simpleCfg || {}, E = simpleEls;
    if (simpleMoved.length) leaveSimple();
    function move(node, into, cls) {
      if (!node || !node.parentNode) return;
      simpleMoved.push({ node: node, parent: node.parentNode, next: node.nextSibling, cls: cls || null });
      if (cls) node.classList.add('simple-item', cls);
      into.appendChild(node);
    }
    var params = (sc.params || []).slice(0, 3);
    if (sc.params && sc.params.length > 3) warnOnce('simple-params', 'SimKit(R6): simple.params 는 3개까지 — 앞 3개만 씁니다.');
    (sc.situation || []).slice(0, 1).forEach(function (k) {
      var c = SK.controls[k];
      if (c && c.el) move(c.el, E.rail, 'simple-item--situation'); else warnOnce('simple:' + k, 'SimKit(R6): simple.situation 에 없는 key — ' + k);
    });
    params.forEach(function (k) {
      var c = SK.controls[k];
      if (c && c.el) move(c.el, E.rail, 'simple-item--param'); else warnOnce('simple:' + k, 'SimKit(R6): simple.params 에 없는 key — ' + k);
    });
    move(SK.el.panelBox, E.moreBody); move(SK.el.recBig, E.moreBody); move(SK.el.thinkBoard, E.moreBody);
    buildSimpleMeters();
    E.presetsBtn.hidden = !simplePresetList().length;
    countRail();
    updateSimpleTask();
  }
  function leaveSimple() {
    for (var i = simpleMoved.length - 1; i >= 0; i--) {
      var m = simpleMoved[i];
      if (m.cls) m.node.classList.remove('simple-item', m.cls);
      if (m.next && m.next.parentNode === m.parent) m.parent.insertBefore(m.node, m.next); else m.parent.appendChild(m.node);
    }
    simpleMoved = [];
  }
  /** 레일에 보이는 칸 수 → --sn (세로·4:3 배치가 무대 높이를 계산) */
  function countRail() {
    var r = simpleEls.rail; if (!r || !SK.el.slide) return;
    var n = 0, teacher = SK.isTeacher();
    for (var i = 0; i < r.children.length; i++) {
      var c = r.children[i];
      if (c.hidden || c.style.display === 'none' || (c.classList.contains('teacher-only') && !teacher)) continue;
      if (c.classList.contains('is-folded') && !c.classList.contains('is-mode-ctl')) continue;
      n++;
    }
    if (SK.el.slide._sn !== n) { SK.el.slide._sn = n; SK.el.slide.style.setProperty('--sn', String(Math.max(1, n))); r.classList.toggle('is-dense', n >= 4); }
  }

  /* 측정 칸: SK.meters 의 같은 key 값을 그대로 받는다(meterRegistry). 값이 없으면 '–' */
  function buildSimpleMeters() {
    var box = simpleEls.meters; if (!box) return;
    box.innerHTML = ''; simpleMeterCells = {};
    var list = ((simpleCfg && simpleCfg.meters) || []).slice(0, 3);
    list.forEach(function (m) {
      var key = typeof m === 'string' ? m : m && m.key; if (!key) return;
      var reg = meterRegistry[key];
      if (!reg && typeof m === 'object') reg = registerMeter(m, null);
      if (!reg) { warnOnce('simple-meter:' + key, 'SimKit(R6): simple.meters 에 없는 측정 key — ' + key + ' (SK.meters 에 simpleOnly:true 로 넣거나 {key,label,unit} 로 적어요)'); return; }
      var it = reg.it, lab = rich(it.label || '');
      if (it.symbol) { lab.push(' '); if (/[_^$]/.test(it.symbol)) lab.push.apply(lab, symNodes(it.symbol)); else lab.push(h('i', { text: it.symbol })); }
      var val = h('span', { class: 'num', text: reg.last === null ? '–' : reg.last });
      var vbox = h('span', { class: 'simple-meter__value' + (reg.isText ? ' is-text' : '') }, [val, h('span', { class: 'simple-meter__unit', text: it.unit || '' })]);
      var cell = h('div', { class: 'simple-meter' + (it.hidden ? ' is-hidden-value' : ''), 'data-key': key, 'data-q': it.q || null }, [h('span', { class: 'simple-meter__label' }, lab), vbox]);
      box.appendChild(cell);
      simpleMeterCells[key] = { el: val, box: vbox };
    });
    box.hidden = !box.children.length;
    if (SK.el.slide) SK.el.slide.classList.toggle('has-simple-meters', !box.hidden);
  }
  /** 계기판 칸 등록(일반·심플 공통). set(v) 는 일반 칸과 같은 key 의 심플 칸을 함께 쓴다 */
  function registerMeter(it, el) {
    var reg = { key: it.key, it: it, el: el, dec: it.decimals !== undefined ? it.decimals : 1, last: null, isText: false };
    reg.set = function (v) {
      var t = typeof v === 'number' ? fmt(v, reg.dec) : (v === null || v === undefined ? '–' : String(v));
      if (t === reg.last) return;
      reg.last = t;
      // R3: 값 자리에 숫자 없는 글('쏘기 전'·'부딪친 뒤')이면 작은 글자(.is-text)로, 단위는 숨김
      reg.isText = typeof v === 'string' && !/[0-9]/.test(v) && v !== '–' && v !== '-';
      if (reg.el) { reg.el.textContent = t; var box = reg.el.parentNode; if (box) box.classList.toggle('is-text', reg.isText); }
      var sc = simpleMeterCells[reg.key];
      if (sc) { sc.el.textContent = t; sc.box.classList.toggle('is-text', reg.isText); }
    };
    meterRegistry[it.key] = reg;
    return reg;
  }
  /** R6: 계기판 key 하나에 값 쓰기(일반·심플 칸 함께). 심플 전용 측정(simpleOnly)도 이것으로 */
  SK.setMeter = function (key, v) { var r = meterRegistry[key]; if (r) r.set(v); };

  /** 안내줄 [예측 ▸] — 지금 카드의 예측 → sim 이 준 simple.predict 객체 → 마지막(미뤄 둔) 예측 */
  function simplePredictOpts() {
    var sc = simpleCfg || {};
    if (sc.predict === 'off') return null;
    if (activePreset >= 0 && presets[activePreset] && presets[activePreset].predict) return { preset: activePreset };
    if (sc.predict && typeof sc.predict === 'object') return sc.predict;
    return lastPredictOpts;
  }
  function simplePredict() {
    var o = simplePredictOpts(); if (!o) return;
    closeSheets();
    predictGate = true;
    try { if (o.preset !== undefined && o.question === undefined) openPresetPredict(o.preset); else SK.predict(o); }
    finally { predictGate = false; }
  }
  function updateSimpleTask() {
    var E = simpleEls; if (!E.taskText || !simpleOn) return;
    var sc = simpleCfg || {}, text;
    if (SK.prediction && SK.prediction.pending && !SK.finished) text = '▶ 실행으로 내 예측을 확인해요';
    else { try { text = typeof sc.task === 'function' ? sc.task(SK.params) : sc.task; } catch (e) { text = ''; } }
    setText(E.taskText, text || '값을 바꾸고 ▶ 실행을 눌러요', { all: true });
    E.predict.hidden = !simplePredictOpts() || !!(SK.prediction && SK.prediction.pending) || SK.running || SK.predicting();
  }
  /** 숨은(레일 밖) 기록 값 중 기본값이 아닌 것이 있으면 '⋯ 더 보기 ●' */
  function updateMoreDot() {
    var E = simpleEls; if (!E.moreDot) return;
    var skip = {};
    simpleMoved.forEach(function (m) { var k = m.node.getAttribute && m.node.getAttribute('data-key'); if (k) skip[k] = true; });
    var on = defaultsChanged(skip) > 0;
    if (E.moreDot.hidden === on) {
      E.moreDot.hidden = !on;
      E.moreBtn.setAttribute('aria-label', on ? '더 보기 — 안에서 바꾼 값이 있어요' : '더 보기');
    }
  }

  /* 띠 칸 호환: 예전 3칸(계기판|그래프|기록) 지정은 앞 2칸만 쓴다 */
  function splitTracks(s) {
    var out = [], depth = 0, cur = '';
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (ch === '(') depth++; else if (ch === ')') depth--;
      if (ch === ' ' && depth === 0) { if (cur) out.push(cur); cur = ''; } else cur += ch;
    }
    if (cur) out.push(cur);
    return out;
  }
  function installBandShim() {
    if (typeof MutationObserver === 'undefined') return;
    var band = SK.el.band, busy = false;
    function fix() {
      if (busy) return;
      var t = band.style.gridTemplateColumns; if (!t) return;
      var tr = splitTracks(t.trim());
      if (tr.length >= 3) { busy = true; band.style.gridTemplateColumns = tr.slice(0, 2).join(' '); busy = false; }
    }
    new MutationObserver(fix).observe(band, { attributes: true, attributeFilter: ['style'] });
  }

  /* ------------------------------------------------------------------
     3. 단계 · 지금 할 일 · 오른쪽 칸
     ------------------------------------------------------------------ */
  function stepAliases(i) { var a = [STEPS[i]]; if (legacySteps && legacySteps[i] && legacySteps[i] !== STEPS[i]) a.push(legacySteps[i]); return a; }
  /** A1: data-step-only 값 해석 — 전체 일치 → '|' ',' 나눔 → 공백 나눔(예전 "비교 정리") */
  function stepOnlyMatch(attr, i) {
    var names = stepAliases(i), a = String(attr || '').trim();
    if (names.indexOf(a) >= 0) return true;
    var parts = /[|,]/.test(a) ? a.split(/\s*[|,]\s*/) : a.split(/\s+/);
    for (var k = 0; k < parts.length; k++) if (names.indexOf(parts[k]) >= 0) return true;
    return false;
  }
  SK.goStep = function (i, silent) {
    if (i < 0 || i >= STEPS.length) return;
    if (SK.stepIndex === 0 && i !== 0 && !silent) todaySeen = true;
    // R2(A2): 비교·정리에서 예측·실행으로 돌아오면 이전 실행의 해설은 지운다(다시 실행 전까지 빈 상태)
    if (SK.stepIndex >= 2 && i <= 1) hideNote(true);
    if (i !== SK.stepIndex) bandMsg = { text: '', until: 0 };
    SK.stepIndex = i; SK.stepName = STEPS[i];
    var items = SK.el.steps.querySelectorAll('.task-step');
    for (var k = 0; k < items.length; k++) {
      var it = items[k], num = it.querySelector('.task-step__num');
      if (k === i) it.setAttribute('aria-current', 'step'); else it.removeAttribute('aria-current');
      it.classList.toggle('is-done', k < i);
      if (k < i) { if (!num.querySelector('.ico')) { num.textContent = ''; num.appendChild(SK.icon('check') || document.createTextNode('✓')); } }   // R4: ✓ → 아이콘
      else num.textContent = String(k + 1);
      it.title = k < i ? STEPS[k] + ' — 완료' : (k + 1) + '단계 ' + withJosa(STEPS[k], '으로/로') + ' 가기';
    }
    refreshThinks();
    if (openSheet === 'more') syncSheetTools();
    document.documentElement.setAttribute('data-step', STEPS[i]);
    var only = document.querySelectorAll('[data-step-only]');
    for (var j = 0; j < only.length; j++) only[j].hidden = !stepOnlyMatch(only[j].getAttribute('data-step-only'), i);
    sideUser = null;
    setSide(autoSide(), false);
    updateTask();
    if (!silent && cfg.onStep) cfg.onStep(i, legacySteps && legacySteps[i] ? legacySteps[i] : STEPS[i], STEPS[i]);
    dirty = true;
  };
  SK.nextStep = function () { if (SK.stepIndex < STEPS.length - 1) SK.goStep(SK.stepIndex + 1); };
  SK.prevStep = function () { if (SK.stepIndex > 0) SK.goStep(SK.stepIndex - 1); };

  function autoSide() {
    if (SK.stepIndex === 2 && cfg.capture && !SK.el.records.hidden) return 'records';
    if (SK.stepIndex === 3 && visibleThinks()) return 'think';
    return 'panel';
  }
  function setSide(mode, byUser) {
    if (byUser) sideUser = mode;
    refreshThinks();
    sideMode = mode;
    SK.el.panelBox.hidden = mode !== 'panel';
    SK.el.recBig.hidden = mode !== 'records';
    SK.el.thinkBoard.hidden = mode !== 'think';
    SK.el.recChipBtn.textContent = mode === 'records' ? '표 닫기' : '표 보기';
    var tb = SK.el.toRecBtn;
    if (SK.stepIndex === 3 && visibleThinks()) { tb.hidden = false; setText(tb, '정리 질문 보기 ▸'); }
    else if (SK.stepIndex === 2 && cfg.capture) { tb.hidden = false; setText(tb, '기록 표 보기 ▸'); }
    else tb.hidden = true;
    if (mode === 'records') renderRecords();
    if (mode === 'panel') setTimeout(checkMore, 0);
  }
  SK.showSide = function (mode) { setSide(mode || 'panel', true); };

  /* R2(B1): 띠 문장 기본값 (25자 안팎). 실행이 다음 행동이면 띠 버튼은 숨기고 '아래 ▶ 실행을 눌러요' */
  var DEFAULT_TASK_TEXT = [
    '실험 카드를 고르고 결과를 먼저 예측해요',
    '아래 ▶ 실행을 눌러요',
    '값 하나만 바꿔 실행하고 기록끼리 비교해요',
    '오른쪽 질문으로 오늘 실험을 정리해요'
  ];
  function firstPredictPreset() {
    if (activePreset >= 0 && presets[activePreset] && presets[activePreset].predict) return activePreset;
    for (var i = 0; i < presets.length; i++) if (presets[i].predict) return i;
    return -1;
  }
  /** R2(A4): 띠 [예측하기] — 지금 카드의 예측 → 마지막 예측 → 첫 예측 카드 */
  function reopenPredict() {
    if (activePreset >= 0 && presets[activePreset] && presets[activePreset].predict) { openPresetPredict(activePreset); return; }
    if (lastPredictOpts) { SK.predict(lastPredictOpts); return; }
    var pi = firstPredictPreset();
    if (pi >= 0) SK.applyPreset(pi, { forcePredict: true });
  }
  function canReopenPredict() { return !!lastPredictOpts || firstPredictPreset() >= 0; }
  /** 띠에 '기록하기'를 띄울 수 있나 — 실행 중·일시정지 중에는 아니다(끝난 뒤에만) */
  function bandCanRecord() { return SK.canRecord() && SK.finished && !SK.running; }
  /** 단계별 기본 행동 — 실행이 아닌 행동만 (실행은 하단 ▶ 실행 하나) */
  function defaultAction(i) {
    if (i === 0) {
      if (SK.prediction && SK.prediction.pending) return null;
      if (canReopenPredict()) return { label: '예측하기', onClick: reopenPredict };
      return null;
    }
    if (SK.running || (SK.started && !SK.finished)) return null;
    if (bandCanRecord()) return { label: '기록하기', onClick: function () { SK.record(); } };
    if (i === 1 && SK.finished && recordedRunId === runId) return { label: '비교하러 가기 ▸', onClick: function () { SK.goStep(2); }, next: true };
    if (i === 2 && SK.records.length >= 2) return { label: '정리하러 가기 ▸', onClick: function () { SK.goStep(3); }, next: true };
    if (i === 3) return helpCfg && helpCfg.concepts && helpCfg.concepts.length ? { label: '개념 다시 보기', onClick: function () { SK.toggleHelp(true, 'concepts'); } } : null;
    return null;
  }
  function dynamicText(i) {
    if (i === 0 && SK.prediction && SK.prediction.pending) return '아래 ▶ 실행을 눌러 예측을 확인해요';
    if (i === 1) {
      if (SK.running) return '지켜보는 중이에요';
      if (SK.started && !SK.finished) return '멈췄어요 — 아래 ▶ 이어서 실행';
      if (SK.finished && recordedRunId !== runId && cfg.capture) return '기록하기 버튼으로 결과를 저장해요';
      if (SK.finished && recordedRunId === runId) return '저장했어요. 값 하나만 바꿔 다시 실행해요';
      if (SK.finished) return '아래 ↻ 다시 실행으로 또 해 봐요';
    }
    if (i === 3 && !visibleThinks()) return '알게 된 것을 한두 문장으로 정리해요';
    if (i === 2 && cfg.capture && SK.records.length < 2) return '기록이 2개 있어야 비교해요 (지금 ' + SK.records.length + '개)';
    return DEFAULT_TASK_TEXT[i];
  }
  var NEXT_WORDS = ['실행하러 가기 ▸', '비교하러 가기 ▸', '정리하러 가기 ▸'];
  function updateTask() {
    if (!SK.el.taskText) return;
    var i = SK.stepIndex, t = stepTasks[i] || {};
    var text = typeof t.text === 'function' ? t.text(SK.params) : t.text;
    if (!text) text = dynamicText(i);
    var now = Date.now();
    var alert = now < taskAlertUntil;
    if (alert) text = '먼저 예측하기 버튼을 누르거나 예측 없이 실행해요';
    else if (now < bandMsg.until && bandMsg.text) text = bandMsg.text;
    setText(SK.el.taskText, text, { all: true });   // R4: 문장 속 ▶·↻ 도 아이콘, $v_0$ 수식
    SK.el.taskText.classList.toggle('is-alert', alert);
    SK.el.taskText.classList.toggle('is-msg', !alert && now < bandMsg.until);
    var todayEl = SK.el.top.querySelector('.sim-today');   // 시뮬레이터가 이 글을 바꾸면(모드별 문장) 그대로 따라감
    var today = todayEl && todayEl.lastChild && todayEl.lastChild.nodeType === 3 ? todayEl.lastChild.textContent : (cfg.today || '');
    if (todayEl && todayEl.childNodes.length > 2) today = todayEl.textContent.replace(/^오늘 알아볼 것\s*/, '');
    var showSub = i === 0 && !todaySeen && !!today;
    SK.el.taskSub.hidden = !showSub;
    SK.el.taskWords.classList.toggle('has-sub', showSub);
    if (showSub) setText(SK.el.taskSub, '오늘 알아볼 것 — ' + today);
    var act = t.action === null ? null : (t.action || defaultAction(i));
    // 시뮬레이터가 준 행동이 '실행'이면(▶·실행하기) 띠에는 띄우지 않는다 — 실행은 하단 하나 (R2 원칙 7)
    if (act && /^(▶|⏸|↻)|실행하기|이어서 실행|다시 실행/.test(act.label || '')) act = null;
    // 실행 중·일시정지 중에는 '기록하기'로 바뀌지 않는다
    if (act && /기록하기/.test(act.label || '') && !bandCanRecord() && (SK.running || (SK.started && !SK.finished))) act = null;
    var b = SK.el.taskAct;
    if (act) {
      b.hidden = false;
      setText(b, act.label);
      b._fn = act.onClick;
    } else { b.hidden = true; b._fn = null; }
    // '다음 단계 ▸' 대신 단계 이름이 든 '○○하러 가기 ▸' 하나만
    var nx = SK.el.taskNext;
    var actGoesNext = act && (act.next || /하러 가기/.test(act.label || ''));
    nx.hidden = i >= STEPS.length - 1 || !!actGoesNext;
    if (!nx.hidden) setText(nx, NEXT_WORDS[i]);
    if (simpleOn) updateSimpleTask();
  }
  /** R2(A1): 띠 문장 자리에 잠깐 보여 줄 말 (긴 토스트·finish(msg) 가 여기로 온다) */
  SK.say = function (text, ms) {
    bandMsg = { text: String(text || ''), until: Date.now() + (ms || 5000) };
    updateTask();
  };
  SK.setTask = function (i, task) { stepTasks[i] = task; updateTask(); };

  /* ------------------------------------------------------------------
     4. 값 바꾸기 공통 (⚡ 바로 반영 / ↻ 처음부터 다시)
     ------------------------------------------------------------------ */
  function applyIcon(apply) {
    return apply === 'live'
      ? h('span', { class: 'apply-ico apply-ico--live', title: '값을 바꾸면 바로 반영돼요', 'aria-label': '값을 바꾸면 바로 반영' }, ico('bolt', '⚡'))
      : h('span', { class: 'apply-ico apply-ico--restart', title: '바꾸면 처음부터 다시 실행돼요 (실행 중이면 다음 실행부터)', 'aria-label': '바꾸면 처음부터 다시 실행' }, ico('replay', '↻'));
  }
  function registerDef(def, kind, where) {
    if (!def.key) throw new Error('SimKit: key 가 없습니다.');
    if (SK.defs[def.key]) console.warn('SimKit: key 가 겹칩니다 — ' + def.key);
    def.kind = kind;
    def.apply = def.apply || (kind === 'toggle' ? 'live' : 'restart');
    if (def.record === undefined) def.record = where !== 'tools';
    SK.defs[def.key] = def;
  }
  function valueChanged(key, value, opts) {
    opts = opts || {};
    var def = SK.defs[key];
    SK.ui[key] = value;
    if (opts.silent) { dirty = true; return; }
    if (def.record && activePreset >= 0) markPreset(-1);
    if (def.apply === 'live') {
      SK.params[key] = value; delete pending[key];
    } else if (!SK.started) {
      SK.params[key] = value; delete pending[key];
      doReset(false);
    } else if (SK.params[key] !== value) {
      pending[key] = true;
      // R2: 그림 위 토스트에는 버튼을 달지 않는다 — 상태 칩 '↻ 바꾼 값은 다음 실행부터' 와 하단 ↻ 다시 실행으로 충분
      if (opts.source !== 'reset') SK.notice('바꾼 값은 다음 실행부터 적용돼요', 'restart');
    } else {
      delete pending[key];
    }
    markPendingUI();
    SK.flash(key);
    if (def.onChange) def.onChange(value, { key: key, source: opts.source || 'ui', params: SK.params });
    dirty = true;
    SK.update();
  }
  function markPendingUI() {
    for (var k in SK.controls) {
      var el = SK.controls[k].el;
      if (el) el.classList.toggle('is-pending', !!pending[k]);
    }
  }
  SK.get = function (key) { return SK.ui[key]; };
  SK.set = function (key, value, opts) {
    var c = SK.controls[key];
    if (!c) { console.warn('SimKit.set: 없는 key — ' + key); return; }
    c.set(value, opts);
  };
  SK.hasPending = function () { for (var k in pending) return true; return false; };

  /** A15: 값이 바뀐 변수를 실험 화면에서 깜빡이게 — render 안에서 SimKit.isFlashing(key) 로 묻는다 */
  SK.flash = function (key, ms) {
    flashes[key] = Date.now() + (ms || 900);
    var c = SK.controls[key];
    if (c && c.el) { c.el.classList.remove('is-flash'); void c.el.offsetWidth; c.el.classList.add('is-flash'); }
    dirty = true;
  };
  SK.isFlashing = function (key) { return !!flashes[key] && Date.now() < flashes[key]; };
  /** 0~1 깜빡임 세기 (부드럽게 켜졌다 꺼짐) */
  SK.flashLevel = function (key) {
    if (!SK.isFlashing(key)) return 0;
    var left = (flashes[key] - Date.now()) / 900;
    return Math.max(0, Math.sin(left * Math.PI * 3)) * left;
  };

  /* ------------------------------------------------------------------
     5. 수치 바꾸기: 라벨+입력 줄 / − 슬라이더 + 줄 (요구 A)
     ------------------------------------------------------------------ */
  /** 눈금: 숫자 배열은 3개(처음·가운데·끝)로 줄이고, R2(G3) [{v, label}] 은 준 그대로 쓴다 */
  function reduceTicks(t) {
    if (!t || !t.length) return [];
    var objs = typeof t[0] === 'object';
    var list = objs ? t : (t.length <= 3 ? t : [t[0], t[Math.floor((t.length - 1) / 2)], t[t.length - 1]]);
    return list.map(function (x) { return typeof x === 'object' ? { v: x.v, label: x.label } : { v: x, label: null }; });
  }
  SK.addVar = function (where, def) {
    var whereName = typeof where === 'string' ? where : '';
    registerDef(def, 'var', whereName);
    var min = def.min, max = def.max, step = def.step || 1;
    var dec = def.decimals !== undefined ? def.decimals : decimalsOf(step);
    var prec = def.precision !== undefined ? def.precision : dec + 1;
    var value = def.value !== undefined ? def.value : min;
    var unitTxt = def.unit || '';
    var aria = plain(def.label) + (def.symbol ? ' ' + symPlain(def.symbol) : '');

    var range = h('input', { class: 'range', type: 'range', min: min, max: max, step: step, 'aria-label': aria + (unitTxt ? ' (' + unitTxt + ')' : '') });
    var input = h('input', { class: 'var__input num', type: 'text', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', 'aria-label': aria + ' 숫자 입력' });
    var err = h('p', { class: 'var__err', role: 'alert', hidden: true });
    var bubble = h('span', { class: 'var__bubble', 'aria-hidden': 'true' });
    // R2(A5): 머리줄 아래 한 줄 '0.5~3 kg · 버튼 한 번에 0.5'
    var rangeTxt = h('span', { class: 'var__range', title: '넣을 수 있는 범위' });
    var ticks = null, tickEls = [];
    var tickList = reduceTicks(def.ticks);
    if (tickList.length) {
      ticks = h('div', { class: 'var__ticks', 'aria-hidden': 'true' });
      tickList.forEach(function (t) {
        var s = h('span', { text: t.label !== null && t.label !== undefined ? String(t.label) : fmtFlex(t.v, 0, dec) });
        s._f = (t.v - min) / (max - min);
        s.style.left = (s._f * 100) + '%';
        if (s._f < 0.12) s.classList.add('is-start'); else if (s._f > 0.88) s.classList.add('is-end');   // R3: 양끝 글자가 트랙 밖으로 안 나가게
        if (s.textContent.length > 5) s.classList.add('is-long');   // R6: 심플 레일에서는 숨김
        ticks.appendChild(s); tickEls.push(s);
      });
    }
    var stepNum = fmtFlex(step, 0, Math.max(dec, decimalsOf(step)));
    var stepTxt = '±' + stepNum;
    var minus = h('button', { class: 'btn btn--icon var__step', type: 'button', 'aria-label': plain(def.label) + ' ' + stepNum + ' 줄이기', title: '한 번에 ' + stepNum + ' 줄여요' }, '−');
    var plus = h('button', { class: 'btn btn--icon var__step', type: 'button', 'aria-label': plain(def.label) + ' ' + stepNum + ' 늘리기', title: '한 번에 ' + stepNum + ' 늘려요' }, '+');
    var track = h('div', { class: 'var__track' + (ticks ? ' has-ticks' : '') }, [range, bubble, ticks]);
    var labelKids = rich(def.label);
    if (def.symbol) labelKids.push(h('span', { class: 'var__sym' }, symNodes(def.symbol)));   // R4: 'v_0'·'$v_0$' 도 받음
    var stepInfo = h('span', { class: 'var__stepinfo', text: '버튼 한 번에 ' + stepNum });
    var el = h('div', { class: 'var' + (def.teacher ? ' teacher-only' : ''), 'data-key': def.key }, [
      h('div', { class: 'var__head' }, [
        h('label', { class: 'var__label' }, labelKids),
        applyIcon(def.apply),
        h('span', { class: 'var__field' }, [input, h('span', { class: 'var__unit' + (unitTxt === '°' ? ' var__unit--deg' : ''), text: unitTxt })])
      ]),
      h('p', { class: 'var__meta' }, [rangeTxt, h('span', { class: 'var__meta-dot', 'aria-hidden': 'true', text: '·' }), stepInfo]),
      h('div', { class: 'var__row' }, [minus, track, plus]),
      err
    ]);
    if (def.hint) el.appendChild(h('p', { class: 'var__hint' }, rich(def.hint)));
    resolveWhere(where).appendChild(el);
    def.initial = value;

    function showRange() { rangeTxt.textContent = withUnit(fmtFlex(min, 0, prec) + '~' + fmtFlex(max, 0, prec), unitTxt); }
    function showErr(text) { err.textContent = text; var wi = SK.icon('warn', { cls: 'ico--lead' }); if (wi) err.insertBefore(wi, err.firstChild); err.hidden = false; input.classList.add('is-invalid'); setTimeout(checkMore, 0); }
    function clearErr() { if (!err.hidden) { err.hidden = true; input.classList.remove('is-invalid'); } }
    function show(v) {
      var s = fmtFlex(v, dec, prec);
      if (document.activeElement !== input) input.value = s.replace('−', '-');
      range.value = v;
      var f = (v - min) / (max - min);
      range.style.setProperty('--fill', (f * 100) + '%');
      bubble.textContent = withUnit(s, unitTxt);
      bubble.style.left = 'calc(' + f + ' * (100% - var(--space-thumb)) + var(--space-thumb) / 2)';
    }
    function set(v, opts) {
      opts = opts || {};
      v = roundTo(clamp(Number(v), min, max), prec);
      value = v; show(v);
      if (opts.source && opts.source !== 'input') clearErr();
      valueChanged(def.key, v, opts);
    }
    range.addEventListener('input', function () { set(parseFloat(range.value), { source: 'slider' }); });
    function startDrag() { el.classList.add('is-dragging'); }
    function endDrag() { el.classList.remove('is-dragging'); }
    range.addEventListener('pointerdown', startDrag);
    range.addEventListener('pointerup', endDrag);
    range.addEventListener('pointercancel', endDrag);
    range.addEventListener('blur', endDrag);
    range.addEventListener('change', endDrag);

    function commit() {
      var raw = input.value, v = parseNum(raw);
      if (isNaN(v)) { showErr('숫자만 넣어 주세요 (예: ' + fmtFlex(value, dec, prec) + ')'); input.value = fmtFlex(value, dec, prec).replace('−', '-'); return; }
      if (v < min || v > max) {
        var near = clamp(v, min, max);
        var vt = fmtFlex(v, 0, prec), nt = fmtFlex(near, 0, prec);
        showErr(vt + josa(vt, '은/는') + ' 넣을 수 없어요. 범위가 ' + withUnit(fmtFlex(min, 0, prec) + '~' + fmtFlex(max, 0, prec), unitTxt) + '라서 가장 가까운 ' + withJosa(nt, '으로/로') + ' 맞췄어요.');
        v = near;
      } else clearErr();
      if (roundTo(v, prec) !== value) set(v, { source: 'input' });
      input.value = fmtFlex(value, dec, prec).replace('−', '-');
    }
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); commit(); input.blur(); }
      else if (e.key === 'Escape') { e.preventDefault(); input.value = fmtFlex(value, dec, prec).replace('−', '-'); input.blur(); e.stopPropagation(); }
    });
    input.addEventListener('change', commit);
    input.addEventListener('focus', function () { input.select(); });

    function nudge(dir) { set(roundTo(value + dir * step, prec), { source: 'button' }); }
    function holdable(b, dir) {
      var t1 = 0, t2 = 0;
      function stop() { clearTimeout(t1); clearInterval(t2); }
      b.addEventListener('pointerdown', function (e) {
        e.preventDefault(); nudge(dir); stop();
        t1 = setTimeout(function () { t2 = setInterval(function () { nudge(dir); }, 80); }, 450);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { b.addEventListener(ev, stop); });
      b.addEventListener('click', function (e) { if (e.detail === 0) nudge(dir); });
    }
    holdable(minus, -1); holdable(plus, 1);

    var api = {
      key: def.key, el: el, def: def, range: range, input: input,
      get: function () { return value; },
      set: set,
      setRange: function (a, b) {
        min = a; max = b; range.min = a; range.max = b; showRange();
        for (var i = 0; i < tickEls.length; i++) tickEls[i].hidden = true;   // 범위가 바뀌면 옛 눈금은 숨김
        if (value < a || value > b) set(clamp(value, a, b), { source: 'range' }); else show(value);
      },
      enable: function (on) { el.classList.toggle('is-disabled', on === false); range.disabled = input.disabled = minus.disabled = plus.disabled = on === false; }
    };
    SK.controls[def.key] = api;
    value = roundTo(clamp(value, min, max), prec);
    def.initial = value;
    SK.ui[def.key] = value;
    if (!(def.key in SK.params)) SK.params[def.key] = value;
    showRange(); show(value);
    return api;
  };

  /* ------------------------------------------------------------------
     6. 상황 바꾸기: 세그먼트·카드 / 체크 토글 (요구 B)
     ------------------------------------------------------------------ */
  SK.addChoice = function (where, def) {
    var whereName = typeof where === 'string' ? where : '';
    registerDef(def, 'choice', whereName);
    var value = def.value !== undefined ? def.value : def.options[0].value;
    var seg = h('div', { class: 'seg' + (def.style === 'cards' ? ' seg--cards' : ''), role: 'group', 'aria-label': plain(def.label) });
    var btns = def.options.map(function (o) {
      var kids = rich(o.label);
      if (o.sub) kids.push(h('span', { class: 'btn__sub', text: o.sub }));
      var b = h('button', { class: 'seg__opt', type: 'button', title: o.title || null }, kids);
      b.addEventListener('click', function (e) { blurOnMouse(e); set(o.value, { source: 'ui' }); });
      seg.appendChild(b);
      return b;
    });
    var el = h('div', { class: 'ctl' + (def.teacher ? ' teacher-only' : ''), 'data-key': def.key }, [
      h('div', { class: 'ctl__label' }, rich(def.label).concat([applyIcon(def.apply)])), seg
    ]);
    if (def.hint) el.appendChild(h('p', { class: 'var__hint' }, rich(def.hint)));
    resolveWhere(where).appendChild(el);
    function show(v) { def.options.forEach(function (o, i) { btns[i].setAttribute('aria-pressed', String(o.value === v)); }); }
    function set(v, opts) {
      var ok = def.options.some(function (o) { return o.value === v; });
      if (!ok) { console.warn('SimKit: ' + def.key + ' 에 없는 값 ' + v); return; }
      value = v; show(v); valueChanged(def.key, v, opts);
      if (modeApi && modeApi.key === def.key) modeApi.sync(v);
    }
    var api = {
      key: def.key, el: el, def: def, get: function () { return value; }, set: set,
      enableOption: function (v, on) { def.options.forEach(function (o, i) { if (o.value === v) btns[i].disabled = on === false; }); },
      enable: function (on) { el.classList.toggle('is-disabled', on === false); btns.forEach(function (b) { b.disabled = on === false; }); }
    };
    SK.controls[def.key] = api;
    def.initial = value;
    SK.ui[def.key] = value;
    if (!(def.key in SK.params)) SK.params[def.key] = value;
    show(value);
    return api;
  };

  SK.addToggle = function (where, def) {
    var whereName = typeof where === 'string' ? where : '';
    registerDef(def, 'toggle', whereName);
    var value = !!def.value;
    var stateEl = h('span', { class: 'check__state' });
    var b = h('button', { class: 'check', type: 'button' }, [
      h('span', { class: 'check__box', 'aria-hidden': 'true' }),
      h('span', { class: 'check__text' }, rich(def.label)),
      def.apply === 'restart' ? applyIcon('restart') : null,
      stateEl
    ]);
    b.addEventListener('click', function (e) { blurOnMouse(e); set(!value, { source: 'ui' }); });
    var el = h('div', { class: 'ctl' + (def.teacher ? ' teacher-only' : ''), 'data-key': def.key }, b);
    if (def.hint) el.appendChild(h('p', { class: 'var__hint' }, rich(def.hint)));
    resolveWhere(where).appendChild(el);
    function show(v) { b.setAttribute('aria-pressed', String(v)); setText(stateEl, v ? (def.onText || '켬') : (def.offText || '끔')); }   // R4: onText 의 ✓ 도 아이콘
    function set(v, opts) { value = !!v; show(value); valueChanged(def.key, value, opts); }
    var api = {
      key: def.key, el: el, def: def, get: function () { return value; }, set: set,
      enable: function (on) { el.classList.toggle('is-disabled', on === false); b.disabled = on === false; }
    };
    SK.controls[def.key] = api;
    def.initial = value;
    SK.ui[def.key] = value;
    if (!(def.key in SK.params)) SK.params[def.key] = value;
    show(value);
    return api;
  };

  SK.valueText = function (key, v) {
    var d = SK.defs[key];
    if (v === undefined) v = SK.params[key];
    if (!d) return typeof v === 'number' ? fmtFlex(v, 0, 3) : String(v);
    if (d.kind === 'toggle') return v ? (d.onText || '켬') : (d.offText || '끔');
    if (d.kind === 'choice') {
      for (var i = 0; i < d.options.length; i++) if (d.options[i].value === v) return plain(d.options[i].label);
      return String(v);
    }
    var dec = d.decimals !== undefined ? d.decimals : decimalsOf(d.step || 1);
    var prec = d.precision !== undefined ? d.precision : dec + 1;
    return fmtFlex(v, dec, prec);
  };

  /* ------------------------------------------------------------------
     7. 실험 카드 (프리셋) — 예측 먼저, 답을 고른 뒤 값 적용
     ------------------------------------------------------------------ */
  var presetInfoEl = null;
  SK.tagText = function (tag) { return TAG_WORDS[tag] || tag || ''; };
  /** 카드 아래 줄: R2(E1) preset.changes('v₀ 10 → 20') → 없으면 예전 change */
  function changesText(p) { return p.changes || p.change || ''; }
  SK.setPresets = function (list) {
    presets = (list || []).slice(0, 5);
    if (list && list.length > 5) console.warn('SimKit: 실험 카드는 5개까지입니다.');
    var box = SK.el.presets; box.innerHTML = '';
    presets.forEach(function (p, i) {
      if (p.name && p.name.length > 12) console.warn('SimKit(R1): 실험 카드 이름은 12자 이내로 — "' + p.name + '"');
      if (!p.changes && p.change) warnOnce('changes', 'SimKit(R2): preset.changes(카드 아래 줄, 예: "v₀ 10 → 20") 를 써 주세요. 지금은 change 를 대신 씁니다.');
      var ch = changesText(p);
      var tip = h('span', { class: 'preset-tip', role: 'tooltip' }, [
        h('b', null, [circ(i + 1), ' ' + p.name]),
        p.tag ? h('span', { class: 'preset-tip__tag', text: SK.tagText(p.tag) }) : null,
        p.change ? h('span', null, [h('b', { text: '바꾸는 값: ' })].concat(rich(p.change))) : null,   // R4: $m_1$·m₁ 수식 표기
        p.fixed ? h('span', null, [h('b', { text: '그대로 두는 값: ' })].concat(rich(p.fixed))) : null,
        p.predict && cfg.autoPredict ? h('span', { text: '누르면 값이 바로 바뀌고 예측 질문이 나와요.' }) : null
      ]);
      var b = h('button', { class: 'preset-card', type: 'button', 'aria-pressed': 'false', 'aria-label': (i + 1) + '번 실험 카드: ' + p.name + (ch ? ' — ' + plain(ch) : '') + (p.tag ? ' (' + SK.tagText(p.tag) + ')' : '') }, [
        h('span', { class: 'preset-card__name' }, [h('span', { class: 'preset-card__key' }, circ(i + 1)), h('span', { class: 'preset-card__title', text: p.name })]),
        h('span', { class: 'preset-card__changes' }, [
          p.tag ? h('span', { class: 'preset-card__dot', 'data-tag': p.tag, title: SK.tagText(p.tag), 'aria-hidden': 'true' }) : null,
          h('span', { class: 'preset-card__ch' }, rich(ch))   // R4: 카드 아래 줄 'm₁ 3 · v₂ −2' 도 이탤릭 세리프+아래첨자
        ]),
        SK.iconify(h('span', { class: 'preset-card__picked', 'aria-hidden': 'true', text: '✓ 고름' })),
        tip
      ]);
      b.addEventListener('click', function (e) { blurOnMouse(e); SK.applyPreset(i); });
      box.appendChild(b);
    });
    updateTask();
  };
  function markPreset(i) {
    activePreset = i;
    var bs = SK.el.presets.querySelectorAll('.preset-card');
    for (var k = 0; k < bs.length; k++) bs[k].setAttribute('aria-pressed', String(k === i));
    if (presetInfoEl) { presetInfoEl.remove(); presetInfoEl = null; }
    if (i >= 0) {
      // R2 원칙 6: 실험 화면에는 모서리 칩 한 줄만 ('카드 ① 이름'), 자세한 값은 말풍선
      var p = presets[i];
      presetInfoEl = h('div', { class: 'preset-info', title: [p.change ? '바꾸는 값: ' + plain(p.change) : '', p.fixed ? '그대로: ' + plain(p.fixed) : ''].filter(Boolean).join('\n') || null }, [
        h('b', null, ['카드 ', circ(i + 1)]), h('span', { class: 'preset-info__name', text: p.name })
      ]);
      SK.el.cornerTL.appendChild(presetInfoEl);
    }
  }
  function setPresetValues(p, i) {
    SK.pause();
    var vals = p.values || {};
    for (var k in vals) {
      if (!Object.prototype.hasOwnProperty.call(vals, k)) continue;
      if (SK.controls[k]) SK.controls[k].set(vals[k], { silent: true });
      else console.warn('SimKit 실험 카드: 없는 key — ' + k);
    }
    pending = {}; markPendingUI();
    doReset(true);
    markPreset(i);
    if (p.onApply) p.onApply(SK.params);
    SK.update();
  }
  /** R2(E3): '카드 ①: v₀ 10 m/s · 각도 0°' (28자 안쪽으로), 모드가 바뀌면 '… 모드로 바뀌어요' */
  function presetToast(p, i) {
    var head = '카드 ' + CIRCLED[i];
    if (p.mode) return head + ': ' + withJosa(p.mode, '으로/로') + ' 바뀌어요';
    var ch = changesText(p);   // 시뮬레이터가 쓴 '바꾸는 값' 요약이 짧으면 그것을 먼저
    if (ch && (head + ': ' + ch).length <= 28) return head + ': ' + ch;
    var parts = [], vals = p.values || {};
    for (var k in vals) {
      if (!Object.prototype.hasOwnProperty.call(vals, k) || !SK.defs[k] || !SK.defs[k].record) continue;
      var d = SK.defs[k], name = symPlain(d.symbol) || plain(d.label);
      parts.push(name + ' ' + withUnit(SK.valueText(k, vals[k]), d.unit));
    }
    var s = head + ': ' + parts.slice(0, 2).join(' · ');
    if (!parts.length || s.length > 28) s = head + ' ' + p.name;
    if (s.length > 28) s = head + ' 준비했어요';
    return s;
  }
  function openPresetPredict(i) {
    var p = presets[i]; if (!p || !p.predict) return;
    var q = copy(p.predict); q.tag = q.tag || p.tag; q.preset = i;
    SK.predict(q);
  }
  /** 카드 누르기: 값 바로 적용(패널 숫자가 바뀜) → 토스트 → (autoPredict) 예측 창 */
  SK.applyPreset = function (i, o) {
    o = o || {};
    var p = presets[i]; if (!p) return;
    function go() {
      setPresetValues(p, i);
      SK.notice(presetToast(p, i), 'info');
      // R6: 심플 모드는 autoPredict 와 무관하게 자동으로 띄우지 않는다(예측은 안내줄 [예측 ▸])
      if (p.predict && ((cfg.autoPredict && !simpleOn) || o.forcePredict)) setTimeout(function () { if (activePreset === i) openPresetPredict(i); }, 0);
      updateTask();
    }
    // R5: 바뀌는 값이 2개 이상이고 기록이 있을 때만 묻는다(값 하나만 바뀌면 '한 가지만 바꾸기' 그대로)
    var vals = p.values || {}, changedCount = 0;
    // 팀장 R5: 기록에 안 남는 값(record:false, 예: 렌즈 screenX)은 세지 않는다 — 렌즈 카드 ③ 같은 '한 가지만 바꾸기' 카드가 묻지 않게
    // R6(S12): def.confirm === false(기록은 남기되 확인창 판정에서는 빼는 값, 예: 렌즈 물체 종류 type)도 세지 않는다
    for (var k in vals) if (Object.prototype.hasOwnProperty.call(vals, k) && SK.ui[k] !== vals[k] && !(SK.defs[k] && (SK.defs[k].record === false || SK.defs[k].confirm === false))) changedCount++;
    // R6: o.noConfirm(심플 '실험' 시트 — 기록 표가 숨어 있음) · 심플 모드에서는 묻지 않는다
    if (!o.noConfirm && !simpleOn && cfg.confirmPresetWithRecords && SK.records.length && activePreset !== i && changedCount >= 2) {
      SK.confirm({
        title: '실험 카드를 바꿀까요?',
        body: '기록 ' + SK.records.length + '개는 그대로 남아요 · 값 ' + changedCount + '개가 바뀌어요',
        ok: '이 카드로 바꾸기', cancel: '취소'
      }).then(function (yes) { if (yes) go(); });
    } else go();
  };

  /* ------------------------------------------------------------------
     8. 실행 흐름 · 고정 시간 간격 루프
     ------------------------------------------------------------------ */
  function captureGhost() {
    if (!SK.started || !cfg.capture) return;
    var data = cfg.capture(SK.params);
    if (data) {
      SK.ghost = { params: copy(SK.params), series: data.series || {}, values: data.values || {} };
      fireRecords();
    }
  }
  function doReset(keepGhostCapture) {
    if (keepGhostCapture) captureGhost();
    SK.params = copy(SK.ui);
    pending = {}; markPendingUI();
    SK.time = 0; SK.running = false; SK.started = false; SK.finished = false;
    history = []; acc = 0;
    runId++;
    hideNote(true);
    if (cfg.reset) cfg.reset(SK.params);
    dirty = true;
    updateTransport(); SK.update();
  }
  SK.reset = function () { doReset(true); };
  SK.play = function () {
    if (modal) { if (modal.shake) modal.shake(); return; }
    if (SK.finished) doReset(true);
    SK.running = true; lastTs = null;
    if (SK.stepIndex === 0) SK.goStep(1);
    if (SK.prediction && SK.prediction.pending && SK.prediction.runId === undefined) SK.prediction.runId = runId;
    updateTransport(); SK.update();
  };
  SK.pause = function () { SK.running = false; updateTransport(); SK.update(); };
  SK.toggle = function () { if (SK.running) SK.pause(); else SK.play(); };
  /** 시뮬레이터가 실행이 끝났을 때 부른다 */
  SK.finish = function (msg) {
    SK.running = false; SK.finished = true; dirty = true;
    updateTransport();
    var v = judgePrediction();
    showNote(v, true);
    // R6: 심플 모드는 해설 카드가 시트 안 — 끝나면 토스트 [해설 보기 ▸] 로 시트를 해설 위치로 연다
    if (simpleOn && hasNote()) setTimeout(function () { SK.notice('실험이 끝났어요', 'ok', 6000, { label: '해설 보기 ▸', onClick: function () { showSheet('more', { note: true }); } }); }, 0);
    // R2(A1): '끝났어요…' 자동 토스트 없음 — 끝 안내는 띠 문장으로 (띠가 '기록하기 버튼으로 …' 을 말함)
    if (msg) SK.say(msg.replace(/\[기록하기\]\s*(으로|로)/g, '기록하기 버튼으로').replace(/\[([^\]]+)\]/g, '$1'), 6000);
    SK.update();
  };
  SK.setSpeed = function (s) { SK.speed = s; updateTransport(); dirty = true; SK.update(); };
  function cycleSpeed(dir) {
    var i = SPEEDS.indexOf(SK.speed); if (i < 0) i = SPEEDS.indexOf(1);
    i = clamp(i + dir, 0, SPEEDS.length - 1);
    SK.setSpeed(SPEEDS[i]);
    SK.notice('속도 ×' + SPEEDS[i] + ' (' + SPEED_WORDS[SPEEDS[i]] + ')', 'info', 1200);
  }
  function updateTransport() {
    if (!SK.el.btnRun) return;
    var b = SK.el.btnRun; b.innerHTML = '';
    // R2(B1): 실행 전 '▶ 실행'(주 색) · 실행 중 '⏸ 멈추기' · 멈춤 '▶ 이어서 실행' · 끝난 뒤 '↻ 다시 실행'(윤곽선)
    var label = SK.running ? '⏸ 멈추기' : (SK.finished ? '↻ 다시 실행' : (SK.started ? '▶ 이어서 실행' : '▶ 실행'));
    var tn = document.createTextNode(label);
    b.appendChild(tn);
    b.appendChild(keyHint('Space'));
    SK.iconify(tn);   // R4: ▶ ⏸ ↻ → 아이콘
    b.setAttribute('aria-label', label.replace(/^[^가-힣]+/, ''));
    b.classList.toggle('btn--primary', !SK.finished);
    b.classList.toggle('btn--secondary', SK.finished);
    b.classList.toggle('is-long', SK.started && !SK.finished && !SK.running);
    setText(SK.el.btnSpeed, '속도 ×' + SK.speed + ' ▾');
    var E = simpleEls;
    if (E.run) {   // R6: 심플 막대 [▶ 실행] — 같은 자리·같은 폭으로 ⏸ 멈추기 / ↻ 다시 실행
      var sl = SK.running ? '⏸ 멈추기' : (SK.finished ? '↻ 다시 실행' : (SK.started ? '▶ 이어서' : '▶ 실행'));
      E.run.innerHTML = ''; var st = document.createTextNode(sl); E.run.appendChild(st); SK.iconify(st);
      E.run.setAttribute('aria-label', sl.replace(/^[^가-힣]+/, '') + ' (Space)');
      E.run.classList.toggle('btn--primary', !SK.finished);
      E.run.classList.toggle('btn--secondary', SK.finished);
      setText(E.speed, '속도 ×' + SK.speed + ' ▾');
      var sit = E.speedMenu.querySelectorAll('button');
      for (var si = 0; si < sit.length; si++) sit[si].setAttribute('aria-checked', String(+sit[si].getAttribute('data-s') === SK.speed));
    }
    var items = SK.el.speedMenu.querySelectorAll('button');
    for (var i = 0; i < items.length; i++) items[i].setAttribute('aria-checked', String(+items[i].getAttribute('data-s') === SK.speed));
    var canBack = !!(cfg.save && cfg.load);
    SK.el.btnBack.disabled = !canBack;
    SK.el.btnBack.title = canBack ? '실행 장면을 되감아 봐요' : '이 실험은 되감기를 지원하지 않아요';
    renderNeed();
    updateTask();
  }

  SK.stepFrame = function (dir) {
    if (modal) return;
    if (SK.running) SK.pause();
    if (dir > 0) {
      if (SK.finished) return;
      pushHistory();
      var n = Math.max(1, Math.round((1 / 60) / cfg.dt));
      for (var i = 0; i < n && !SK.finished; i++) physStep();
      dirty = true;
    } else {
      if (!(cfg.save && cfg.load)) { SK.notice('이 실험은 되감기를 지원하지 않아요', 'info'); return; }
      var hst = history.pop();
      if (!hst) { SK.notice('더 뒤로 갈 수 없어요', 'info'); return; }
      cfg.load(hst.s); SK.time = hst.t; SK.finished = false;
      SK.started = SK.time > 0;
      dirty = true;
    }
    updateTransport(); SK.update();
  };
  function pushHistory() {
    if (!(cfg.save && cfg.load)) return;
    history.push({ t: SK.time, s: cfg.save() });
    if (history.length > 1800) history.shift();
  }
  function physStep() {
    if (cfg.step) cfg.step(cfg.dt, SK.params);
    SK.time += cfg.dt;
    if (!SK.started) { SK.started = true; updateTransport(); }
  }

  var acc = 0, lastTs = null, frameN = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    if (lastTs === null) lastTs = ts;
    var real = Math.min((ts - lastTs) / 1000, 0.1);
    lastTs = ts;
    if (SK.running) {
      pushHistory();
      acc += real * SK.speed;
      var n = 0;
      while (acc >= cfg.dt && n < 4000) {
        physStep(); acc -= cfg.dt; n++;
        if (!SK.running) { acc = 0; break; }
      }
      dirty = true;
      if (Math.floor(SK.time * 4) !== Math.floor((SK.time - real * SK.speed) * 4)) SK.update();
    }
    var now = Date.now();
    for (var fk in flashes) { if (now < flashes[fk] + 50) dirty = true; else delete flashes[fk]; }
    if (dirty) {
      dirty = false;
      if (SK.view) SK.view.clear();
      if (cfg.render) cfg.render(SK.view, SK.params);
      for (var i = 0; i < frameHooks.length; i++) frameHooks[i]();
    }
    if ((++frameN % 20) === 0) {
      checkMore();
      if (taskAlertUntil && now > taskAlertUntil) { taskAlertUntil = 0; updateTask(); }
      if (bandMsg.until && now > bandMsg.until) { bandMsg = { text: '', until: 0 }; updateTask(); }
    }
  }
  var frameHooks = [];
  SK.onFrame = function (fn) { frameHooks.push(fn); };
  SK.requestRender = function () { dirty = true; };

  /* ------------------------------------------------------------------
     9. 상태 칩 (실험 화면 왼쪽 위)
     ------------------------------------------------------------------ */
  SK.setStatus = function (text) { statusOverride = text; SK.update(); };
  SK.update = function () {
    var el = SK.el.status; if (!el) return;
    var main = statusOverride !== null ? statusOverride : (cfg.status ? cfg.status(SK.params) : '');
    if (main && !Array.isArray(main)) warnOnce('status', 'SimKit(R2): status() 는 배열로 돌려주세요 — 예: [\'지구\', \'공기 저항 없음\']. 지금은 \' · \' 로 나눠 씁니다.');
    var parts = Array.isArray(main) ? main : (main ? String(main).split(/\s+·\s+/) : []);
    var t = ' · t = ' + fmt(SK.time, 2) + ' s';
    var run = SK.running ? ['▶ 실행 중' + t, 'is-run'] : SK.finished ? ['✓ 끝' + t, 'is-done'] : SK.started ? ['⏸ 멈춤' + t, ''] : ['실행 전 · t = 0.00 s', ''];
    var sig = parts.join('|') + '#' + run[0] + '#' + SK.speed + '#' + SK.hasPending();
    if (el._sig !== sig) {
      el._sig = sig; el.innerHTML = '';
      parts.forEach(function (p) { if (p !== '' && p !== null && p !== undefined) el.appendChild(h('span', { class: 'chip' }, rich(String(p)))); });
      el.appendChild(SK.iconify(h('span', { class: 'chip num is-time ' + run[1], text: run[0] + (SK.speed !== 1 ? ' · 속도 ×' + SK.speed : '') })));
      if (SK.hasPending()) el.appendChild(SK.iconify(h('span', { class: 'chip is-pend', text: '↻ 바꾼 값은 다음 실행부터' })));
    }
    if (simpleOn) { countRail(); updateMoreDot(); }
    updateTask();
  };

  /* ------------------------------------------------------------------
     10. 기록 · 직전 실행 · 지우기 · 기록 표 큰 판 · 나란히 보기
     ------------------------------------------------------------------ */
  function recordKeys() {
    var ks = [];
    for (var k in SK.defs) if (SK.defs[k].record) ks.push(k);
    return ks;
  }
  SK.canRecord = function () { return !!cfg.capture && SK.started && !SK.running && recordedRunId !== runId && SK.records.length < MAX_RECORDS; };
  SK.record = function () {
    if (!cfg.capture) { SK.notice('이 실험은 기록을 쓰지 않아요', 'info'); return; }
    if (!SK.started) { SK.notice('먼저 ▶ 실행해 보세요', 'info'); return; }
    if (SK.running && !SK.finished) { SK.notice('실행이 끝난 뒤에 기록해요', 'warn'); return; }
    if (recordedRunId === runId) { SK.notice('이 실행은 이미 기록했어요', 'info'); return; }
    if (SK.records.length >= MAX_RECORDS) {
      SK.notice('최대 5개예요 — 하나를 지워 주세요', 'warn');
      SK.say('기록 표의 ✕ 로 하나를 지우거나 그 밖의 기능에서 모두 지워요', 6000);
      setSide('records', true);
      return;
    }
    var data = cfg.capture(SK.params);
    if (!data) { SK.notice('아직 기록할 결과가 없어요', 'info'); return; }
    var snap = {}, keys = recordKeys();
    keys.forEach(function (k) { snap[k] = SK.params[k]; });
    var prev = SK.records[SK.records.length - 1];
    var changed = [];
    if (prev) keys.forEach(function (k) { if (prev.params[k] !== snap[k]) changed.push(k); });
    var rec = {
      n: SK.records.length + 1, slot: SK.records.length,
      params: snap, values: data.values || {}, series: data.series || {},
      changed: changed, preset: activePreset >= 0 ? presets[activePreset].name : null,
      prediction: SK.prediction, time: SK.time, finished: SK.finished, runId: runId
    };
    SK.records.push(rec);
    recordedRunId = runId;
    bandMsg = { text: '', until: 0 };
    fireRecords();
    if (changed.length >= 2) SK.notice('기록 ' + rec.n + ' 저장 — 두 가지 이상 바꿨어요', 'warn');
    else if (SK.records.length === 1) SK.notice('기록 1 저장 — 값 하나만 바꿔 또 해요', 'ok');
    else SK.notice('기록 ' + rec.n + ' 저장 (' + SK.records.length + '/' + MAX_RECORDS + ')', 'ok');
    if (SK.stepIndex === 1 && SK.records.length >= 2) SK.goStep(2);
    SK.update();
  };
  /** R2(C4): 기록 하나 지우기 (번호·색·모양은 순서대로 다시 매김) */
  SK.deleteRecord = function (i, quiet) {
    var r = SK.records[i]; if (!r) return;
    function del() {
      SK.records.splice(i, 1);
      SK.records.forEach(function (x, k) { x.n = k + 1; x.slot = k; });
      if (r.runId === runId) recordedRunId = -1;
      vsSel = [-1, -1];
      fireRecords(); SK.update();
      SK.notice('기록을 하나 지웠어요', 'info');
    }
    if (quiet) { del(); return; }
    SK.confirm({ title: SK.recLabel(r) + josa('기록 ' + r.n, '을/를') + ' 지울까요?', body: '지우면 되돌릴 수 없어요. 뒤 기록의 번호가 하나씩 당겨져요.', ok: '지우기', cancel: '그대로 두기', danger: true })
      .then(function (yes) { if (yes) del(); });
  };
  SK.clearRecords = function () {
    if (!SK.records.length && !SK.ghost) { SK.notice('지울 기록이 없어요', 'info'); return; }
    SK.confirm({
      title: '기록을 모두 지울까요?',
      body: '저장한 실험 ' + SK.records.length + '개와 직전 실행이 지워져요. 되돌릴 수 없어요.',
      ok: '모두 지우기', cancel: '그대로 두기', danger: true
    }).then(function (yes) {
      if (!yes) return;
      SK.records = []; SK.ghost = null; recordedRunId = -1;
      fireRecords(); SK.update();
      SK.notice('기록을 모두 지웠어요', 'info');
    });
  };
  SK.onRecords = function (fn) { recordListeners.push(fn); };
  function fireRecords() {
    dirty = true;
    renderRecords();
    recordListeners.forEach(function (fn) { fn(SK.records, SK.ghost); });
  }

  SK.recStyle = function (i) {
    var n = (i % MAX_RECORDS) + 1;
    var dash = cssVar('--dash-rec-' + n);
    return {
      color: SK.color('--color-rec-' + n),
      dash: (!dash || dash === 'none') ? [] : dash.split(/[\s,]+/).map(Number),
      width: parseFloat(cssVar('--width-rec-' + n)) || 4,
      mark: MARKS[i % MARKS.length]
    };
  };
  SK.ghostStyle = function () { return { color: SK.color('--color-q-ghost'), dash: [], width: 4, mark: '○' }; };
  SK.applyStroke = function (ctx, st) {
    ctx.strokeStyle = st.color; ctx.lineWidth = st.width || 3;
    ctx.setLineDash(st.dash || []);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  };
  SK.drawPath = function (ctx, pts, st, map) {
    if (!pts || pts.length < 2) return;
    ctx.save(); SK.applyStroke(ctx, st);
    ctx.beginPath();
    for (var i = 0; i < pts.length; i++) {
      var p = map ? map(pts[i][0], pts[i][1]) : pts[i];
      if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
    }
    ctx.stroke(); ctx.restore();
  };
  function swatchSVG(st) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 36 12'); svg.setAttribute('aria-hidden', 'true');
    var ln = document.createElementNS(ns, 'line');
    ln.setAttribute('x1', '2'); ln.setAttribute('y1', '6'); ln.setAttribute('x2', '34'); ln.setAttribute('y2', '6');
    ln.setAttribute('stroke', st.color); ln.setAttribute('stroke-width', String(Math.max(1.5, st.width * 0.75)));
    ln.setAttribute('stroke-linecap', 'round');
    if (st.dash && st.dash.length) ln.setAttribute('stroke-dasharray', st.dash.map(function (d) { return d * 0.6; }).join(' '));
    svg.appendChild(ln);
    return svg;
  }
  SK.swatch = swatchSVG;
  /** R2(C1): 기록 이름표 = 선 견본 + 모양 기호(색) + '기록 n' — 표·나란히 보기 공통 */
  function recTag(r, ghost) {
    var st = ghost ? SK.ghostStyle() : SK.recStyle(r.slot);
    return h('span', { class: 'rec-swatch' }, [
      swatchSVG(st),
      h('span', { class: 'rec-mark', style: 'color:' + st.color, 'aria-hidden': 'true', text: st.mark }),
      ghost ? h('span', { title: '직전 실행 — 아직 저장하지 않았어요' }, '직전(저장 전)') : '기록 ' + r.n
    ]);
  }
  SK.recTag = function (r) { return recTag(r, false); };

  /* 표 그리기 공통 — R2(C1): priority 1~3. 작은 표 = 1, 큰 판 = 2 이하(열 더 보기 → 전부) */
  var hiddenCols = 0;
  function tableCols(opts, small) {
    var cols = opts && opts.columns ? opts.columns : recordKeys().map(function (k) { return { key: k, from: 'param' }; });
    if (small === 'full') return cols;   // R5: 표 크게 보기 = 모든 열
    var lim = small ? 1 : (showAllCols ? 9 : 2);
    var out = cols.filter(function (c) { return (c.priority || 1) <= lim; });
    if (!small) hiddenCols = cols.length - out.length;
    return out;
  }
  function colParts(c) {
    var d = SK.defs[c.key] || {};
    var lab = c.label || (d.label ? plain(d.label) + (d.symbol ? ' ' + symMarkup(d.symbol) : '') : c.key);   // R4: 기호는 $v_0$ 표기로 (rich 로 그림)
    var unit = c.unit !== undefined ? c.unit : (d.unit || '');
    return { name: lab, unit: unit };
  }
  function colLabel(c) { var p = colParts(c); return p.name + (p.unit ? ' (' + p.unit + ')' : ''); }
  function colValue(c, src) { return c.from === 'value' ? src.values[c.key] : src.params[c.key]; }
  function cellText(c, src, prev) {
    var v = colValue(c, src);
    if (typeof c.text === 'function') return c.text(src, prev);
    if (c.from === 'value') return (typeof v === 'number') ? fmt(v, c.decimals !== undefined ? c.decimals : 2) : (v === undefined || v === null ? '–' : String(v));
    return c.decimals !== undefined && typeof v === 'number' ? fmt(v, c.decimals) : SK.valueText(c.key, v);
  }
  function isChanged(c, src, prev, v) {
    if (!prev) return false;
    if (typeof c.changed === 'function') return !!c.changed(src, prev);
    if (c.from === 'value') return c.changed === true && prev.values[c.key] !== v;
    return prev.params[c.key] !== v;
  }
  function buildTable(opts, small) {
    var cols = tableCols(opts, small);
    if (!SK.records.length && !SK.ghost) return null;
    // 머리글 2줄: 이름 / 단위
    var headCells = [h('th', { scope: 'col' }, [h('span', { class: 'th-name', text: '기록' })])].concat(cols.map(function (c) {
      var p = colParts(c);
      return h('th', { scope: 'col', class: c.from === 'value' ? 'is-result' : null }, [h('span', { class: 'th-name' }, rich(p.name)), h('span', { class: 'th-unit', text: p.unit ? '(' + p.unit + ')' : ' ' })]);
    }));
    var head = h('tr', null, headCells);
    function cells(src, prev) {
      return cols.map(function (c) {
        var v = colValue(c, src), ch = isChanged(c, src, prev, v);
        return h('td', { class: ch ? 'is-changed' : (c.from === 'value' ? 'is-result' : null), title: ch ? '앞 기록과 달라진 값' : null }, cellText(c, src, prev));
      });
    }
    var rows = [];
    if (SK.ghost && (!small || SK.records.length < 3)) {
      var gr = [h('td', null, recTag(null, true))].concat(cells(SK.ghost, null));
      rows.push(h('tr', { class: 'is-ghost' }, gr));
    }
    SK.records.forEach(function (r, i) {
      var prev = i > 0 ? SK.records[i - 1] : null;
      var first = h('td', null, recTag(r, false));
      if (r.changed.length >= 2) first.appendChild(h('span', { class: 'chip chip--warn rec-warn', text: r.changed.length + '개 바뀜' }));
      if (!small || small === 'full') first.insertBefore(btn('✕', 'btn--quiet rec-del', function () { SK.deleteRecord(i); }, { 'aria-label': '기록 ' + r.n + ' 지우기', title: '이 기록 지우기' }), first.firstChild);
      var tds = [first].concat(cells(r, prev));
      rows.push(h('tr', { 'data-slot': r.slot }, tds));
    });
    return h('table', { class: 'rec-table' }, [h('thead', null, head), h('tbody', null, rows)]);
  }
  /** '바꾼 값: v₀ 10 → 20' — 마지막 기록과 그 앞 기록에서 달라진 수치·상황 */
  function changedLine() {
    var n = SK.records.length; if (n < 2) return '';
    var A = SK.records[n - 2], B = SK.records[n - 1], out = [];
    recordKeys().forEach(function (k) {
      if (A.params[k] === B.params[k]) return;
      var d = SK.defs[k] || {}, name = symPlain(d.symbol) || plain(d.label) || k;
      out.push(name + ' ' + withUnit(SK.valueText(k, A.params[k]) + ' → ' + SK.valueText(k, B.params[k]), d.unit));
    });
    return out.length ? '바꾼 값(기록 ' + A.n + ' → ' + B.n + '): ' + out.join(' · ') : '기록 ' + A.n + '과 ' + B.n + '은 값이 같아요';
  }
  function buildVs(opts) {
    var n = SK.records.length;
    if (n < 2) return null;
    if (vsSel[0] < 0 || vsSel[0] >= n || vsSel[1] < 0 || vsSel[1] >= n || vsSel[0] === vsSel[1]) vsSel = [n - 2, n - 1];
    var cols = tableCols(opts, false);
    var wrap = h('section', { class: 'vs', 'aria-label': '두 기록 나란히 보기' });
    wrap.appendChild(h('h3', { class: 'vs__title', text: '두 기록 나란히 보기' }));
    // R2(C2): '비교할 기록 A [1][2] · B [1][2]' 한 줄
    var line = h('div', { class: 'vs__pick' }, [h('span', { class: 'vs__lead', text: '비교할 기록' })]);
    ['A', 'B'].forEach(function (nm, side) {
      var grp = h('span', { class: 'vs__grp', role: 'group', 'aria-label': '기록 ' + nm }, [h('b', { class: 'vs__ab', text: nm })]);
      SK.records.forEach(function (r, i) {
        var st = SK.recStyle(r.slot);
        var b = btn([h('span', { class: 'rec-mark', style: 'color:' + st.color, 'aria-hidden': 'true', text: st.mark }), String(r.n)], 'num vs__btn', function () {
          vsSel[side] = i;
          if (vsSel[0] === vsSel[1]) vsSel[1 - side] = i === 0 ? 1 : 0;
          renderRecords();
        }, { 'aria-pressed': String(vsSel[side] === i), 'aria-label': nm + ' 로 기록 ' + r.n + ' 고르기' });
        grp.appendChild(b);
      });
      if (side === 1) line.appendChild(h('span', { class: 'vs__sep', 'aria-hidden': 'true', text: '·' }));
      line.appendChild(grp);
    });
    wrap.appendChild(line);
    wrap.appendChild(h('p', { class: 'var__hint', text: '두 기록을 고르면 아래 표가 바뀌어요' }));
    var A = SK.records[vsSel[0]], B = SK.records[vsSel[1]];
    var rows = cols.map(function (c) {
      var va = colValue(c, A), vb = colValue(c, B), diff;
      if (typeof va === 'number' && typeof vb === 'number' && typeof c.text !== 'function') {
        var d = vb - va, dd = c.decimals !== undefined ? c.decimals : (SK.defs[c.key] && c.from !== 'value' ? decimalsOf(SK.defs[c.key].step || 1) : 2);
        if (Math.abs(d) < Math.pow(10, -dd) / 2) diff = h('span', { class: 'vs-same', text: '같음' });
        else diff = h('span', { class: d > 0 ? 'vs-up' : 'vs-down', text: (d > 0 ? '▲ ' : '▼ ') + fmt(Math.abs(d), dd) });
      } else {
        var ta = cellText(c, A, null), tb = cellText(c, B, null);
        diff = ta === tb ? h('span', { class: 'vs-same', text: '같음' }) : h('span', { class: 'vs-up', text: '다름' });
      }
      return h('tr', null, [h('td', null, rich(colLabel(c))), h('td', { text: cellText(c, A, null) }), h('td', { text: cellText(c, B, null) }), h('td', null, diff)]);
    });
    function headOf(nm, r) {
      var st = SK.recStyle(r.slot);
      return h('th', { class: 'vs-th', style: 'box-shadow: inset 0 calc(-4 * var(--u)) 0 ' + st.color }, [nm + ' ', h('span', { class: 'rec-mark', style: 'color:' + st.color, text: st.mark }), ' 기록 ' + r.n]);
    }
    wrap.appendChild(h('table', { class: 'vs-table' }, [
      h('thead', null, h('tr', null, [h('th', { text: '항목' }), headOf('A', A), headOf('B', B), h('th', { text: '차이 (B − A)' })])),
      h('tbody', null, rows)
    ]));
    wrap.appendChild(h('p', { class: 'var__hint', text: '▲ B 가 더 커요 · ▼ B 가 더 작아요 · 같음 = 그대로' }));
    return wrap;
  }
  function renderNeed() {
    var need = SK.el.recNeed; if (!need) return;
    var n = SK.records.length, key = n + '|' + SK.canRecord() + '|' + SK.finished;
    if (need._k === key) return;
    need._k = key; need.innerHTML = '';
    if (n < 2) {
      var canRec = SK.canRecord() && SK.finished;
      // R3: 빈 상태는 안내 한 상자만 (표 상자·'저장한 실험 0/5' 소제목은 숨김)
      need.appendChild(h('div', { class: 'rec-need' + (n === 0 ? ' is-empty' : '') }, [
        SK.iconify(h('p', { text: n === 0 ? '아직 저장한 실험이 없어요 — ▶ 실행한 뒤 기록하기를 누르면 여기에 쌓여요.' : '기록이 2개 있어야 비교할 수 있어요 (지금 1개). 값 하나를 바꾸고 ▶ 실행한 뒤 기록하기 버튼으로 저장해요.' }), { all: true }),
        canRec ? btn('지금 결과 기록하기', 'btn--secondary', function () { SK.record(); }) : null
      ]));
    }
  }
  function checkRecScroll() {
    var sc = SK.el.recScroll; if (!sc) return;
    var over = sc.scrollWidth > sc.clientWidth + 4;
    var atEnd = sc.scrollLeft + sc.clientWidth >= sc.scrollWidth - 4;
    sc.classList.toggle('has-overflow', over && !atEnd);
    SK.el.recSlide.hidden = !over || atEnd;
  }
  /** R5: 표 크게 보기 오버레이 (.rec-full, 무대 자식 — 실험 화면 + 하단 띠 자리, 세로에서는 전폭) */
  var recFullEl = null, recFullBody = null;
  SK.showRecordsFull = function (on) {
    if (on === undefined) on = !recFullEl;
    if (!on) { if (recFullEl) { recFullEl.remove(); recFullEl = null; recFullBody = null; } return; }
    if (recFullEl) return;
    closePop();
    recFullBody = h('div', { class: 'rec-full__body' });
    var closeBtn = btn(['닫기', keyHint('Esc')], 'btn--outline rec-full__close', function () { SK.showRecordsFull(false); });
    recFullEl = h('section', { class: 'rec-full', role: 'dialog', 'aria-label': '기록 표 크게 보기', tabindex: '-1' }, [
      h('div', { class: 'rec-full__head' }, [h('h2', { class: 'rec-full__title', text: '기록 표' }), h('span', { class: 'rec-full__count num' }), h('span', { class: 'rec-full__hint', text: '굵은 글씨 = 앞 기록과 달라진 값' }), closeBtn]),
      recFullBody
    ]);
    SK.el.slide.appendChild(recFullEl);
    renderRecordsFull();
    setTimeout(function () { try { recFullEl.focus({ preventScroll: true }); } catch (e) { /* 무시 */ } }, 0);
  };
  function renderRecordsFull() {
    if (!recFullEl) return;
    recFullEl.querySelector('.rec-full__count').textContent = '저장 ' + SK.records.length + '/' + MAX_RECORDS;
    recFullBody.innerHTML = '';
    var t = buildTable(mainTable || {}, 'full');
    recFullBody.appendChild(t || SK.iconify(h('p', { class: 'rec-empty', text: '아직 저장한 실험이 없어요. ▶ 실행한 뒤 기록하기 버튼을 누르면 여기에 쌓여요.' }), { all: true }));
  }
  function renderRecords(o) {
    if (o && o.full) { SK.showRecordsFull(true); return; }
    if (!SK.el.recChipCount) return;
    var n = SK.records.length;
    SK.el.recChipCount.innerHTML = '';
    SK.el.recChipCount.appendChild(document.createTextNode('저장한 실험 '));
    SK.el.recChipCount.appendChild(h('b', { text: n + '/' + MAX_RECORDS }));
    SK.el.recCount.textContent = '저장 ' + n + '/' + MAX_RECORDS;
    if (!cfg.capture) SK.el.records.hidden = true;
    smallTables.forEach(function (t) { t.render(); });
    // 큰 판의 표는 늘 다시 그린다(숨어 있어도) — 시뮬레이터가 rt.el 안 표를 꾸미는 경우 호환
    setText(SK.el.recTitle, '저장한 실험 ' + n + '/' + MAX_RECORDS + (n >= MAX_RECORDS ? ' — 가득 찼어요(✕ 로 하나 지우기)' : ''), { all: true });
    if (SK.el.recBox) SK.el.recBox.hidden = n === 0;   // R3: 빈 상태 = 안내 한 상자
    renderNeed();
    var cl = changedLine();
    SK.el.recChanged.hidden = !cl; SK.el.recChanged.textContent = cl;
    var sc = SK.el.recScroll; sc.innerHTML = '';
    var t = buildTable(mainTable || {}, false);
    sc.appendChild(t || SK.iconify(h('p', { class: 'rec-empty', text: '아직 저장한 실험이 없어요. ▶ 실행한 뒤 기록하기 버튼을 누르면 여기에 쌓여요.' }), { all: true }));
    SK.el.recMoreCols.hidden = !t || (!hiddenCols && !showAllCols);
    setText(SK.el.recMoreCols, showAllCols ? '열 줄이기 ▴' : '열 더 보기 (' + hiddenCols + ') ▾');
    var vs = SK.el.recVs; vs.innerHTML = '';
    var v = buildVs(mainTable || {});
    if (v) vs.appendChild(v);
    if (SK.el.recFullBtn) SK.el.recFullBtn.hidden = !t;
    renderRecordsFull();
    setTimeout(checkRecScroll, 0);
  }

  /**
   * 기록 표. where 를 비우면(null) 기록 표 큰 판(비교 단계 · [표 보기])에 들어간다.
   *   R2(C3): opts.extra = 요소 → 큰 판의 표 아래(나란히 보기 위) 공식 자리에 붙인다.
   * where 에 요소·패널 이름을 주면 그 자리에 작은 표(priority 1 열만)를 그린다.
   */
  SK.recordTable = function (where, opts) {
    opts = opts || {};
    if (!where || where === SK.el.records) {
      mainTable = opts;
      if (opts.extra) SK.el.recExtra.appendChild(opts.extra);
      var api = { el: SK.el.recBox, extra: SK.el.recExtra, render: function () { renderRecords(); } };
      renderRecords();
      return api;
    }
    var host = resolveWhere(where);
    var title = h('span');
    var bigBtn = btn('크게 보기', 'btn--sm btn--quiet', function () { setSide('records', true); });
    var scroll = h('div', { class: 'rec-box__scroll scroll-shadow' });
    var box = h('div', { class: 'rec-box' }, [h('div', { class: 'rec-box__head' }, [title, bigBtn]), scroll]);
    host.appendChild(box);
    if (!mainTable) mainTable = opts;
    function render() {
      title.textContent = '저장한 실험 ' + SK.records.length + '/' + MAX_RECORDS;
      scroll.innerHTML = '';
      var t = buildTable(opts, true);
      scroll.appendChild(t || SK.iconify(h('p', { class: 'rec-empty', text: '▶ 실행한 뒤 기록하기 버튼을 누르면 여기에 쌓여요.' }), { all: true }));
    }
    var obj = { el: box, render: render };
    smallTables.push(obj);
    render();
    return obj;
  };
  /** R2(C3): 기록 큰 판의 시뮬레이터 전용 자리 (표 아래, 나란히 보기 위) */
  SK.recordExtra = function (el) { if (el) SK.el.recExtra.appendChild(el); return SK.el.recExtra; };

  /* ------------------------------------------------------------------
     11. 안내 토스트 · 확인 창 · 예측 카드 · 결과 해설 · 모드 · 안내 서랍
     ------------------------------------------------------------------ */
  /**
   * R2(B4): 예전 문장 다듬기 — '[기록하기]로' → '기록하기 버튼으로', 남은 [ ] 는 벗기고,
   * '(으)로'·'(을)를'·'(이)가'·'은(는)' 같은 양쪽 표기는 앞 낱말에 맞는 조사 하나로.
   */
  function tidyMsg(s) {
    s = String(s === undefined || s === null ? '' : s);
    s = s.replace(/\[기록하기\]\s*(?:\(으\))?(?:으로|로)/g, '기록하기 버튼으로');
    s = s.replace(/\[([^\]]{1,24})\]/g, '$1');
    s = s.replace(/(\S+?)\s?\(으\)로/g, function (m, w) { return w + josa(w, '으로/로'); });
    s = s.replace(/(\S+?)(?:\(을\)를|을\(를\))/g, function (m, w) { return w + josa(w, '을/를'); });
    s = s.replace(/(\S+?)(?:\(이\)가|이\(가\))/g, function (m, w) { return w + josa(w, '이/가'); });
    s = s.replace(/(\S+?)(?:\(은\)는|은\(는\))/g, function (m, w) { return w + josa(w, '은/는'); });
    s = s.replace(/(\S+?)(?:\(과\)와|과\(와\))/g, function (m, w) { return w + josa(w, '과/와'); });
    return s;
  }
  SK.tidy = tidyMsg;

  /**
   * R2(A1) 토스트: 실험 화면 안 위 가운데 한 줄, 한 번에 1개(새 것이 오면 바로 바꿈), 2.5초.
   * 28자를 넘으면 콘솔 경고 후 띠 문장(SimKit.say)으로 보낸다. action = {label, onClick} 이면 작은 버튼.
   */
  var NOTICE_MAX = 28, noticeTimer = 0;
  /** 토스트는 위 가운데 한 줄. 왼쪽·오른쪽 위 모서리 칩과 가로로 겹치면 그 칩 바로 아래로 내린다 */
  function placeNoticeZone() {
    var zone = SK.el.notices, st = SK.el.stage; if (!zone || !st) return;
    zone.style.top = '';
    var zr = zone.getBoundingClientRect(), top = 0;
    [SK.el.cornerTL, SK.el.cornerTR].forEach(function (c) {
      if (!c || !c.offsetHeight) return;
      var kids = c.children;
      for (var i = 0; i < kids.length; i++) {
        var r = kids[i].getBoundingClientRect();
        if (!r.width || !r.height) continue;
        if (r.left < zr.right && r.right > zr.left && r.top < zr.bottom && r.bottom > zr.top) top = Math.max(top, r.bottom - st.getBoundingClientRect().top);
      }
    });
    if (top) zone.style.top = (top + SK.px(6)) + 'px';
  }
  SK.notice = function (text, type, ms, action) {
    var zone = SK.el.notices; if (!zone) return;
    var flat = tidyMsg(text).replace(/\s+/g, ' ').trim();
    if (!flat) return;
    if (plainMath(flat).length > NOTICE_MAX) {
      console.warn('SimKit(R2): 토스트는 ' + NOTICE_MAX + '자 이내로 — 띠 문장으로 보냄 (' + flat.length + '자): ' + flat);
      SK.say(flat, Math.max(ms || 0, 5000));
      return;
    }
    var now = Date.now();
    if (noticeLast[flat] && now - noticeLast[flat] < 1200 && zone.firstChild) return;
    noticeLast[flat] = now;
    var kind = type && type !== 'info' ? type : 'info';
    // R3(팀장): 글 속 원문자('카드 ①')도 .circ 배지로
    var bodyKids = [];
    flat.split(/([①-⑳])/).forEach(function (s) { if (CIRC_RE.test(s)) bodyKids.push(circ(s)); else bodyKids.push.apply(bodyKids, mathNodes(s)); });
    var body = SK.iconify(h('span', null, bodyKids), { all: true });   // R4: 글 속 ▶·↻ 아이콘 · $v_0$ 수식
    var kids = [kind === 'ok' ? h('span', { class: 'notice__mark', 'aria-hidden': 'true' }, ico('check', '✓')) : kind === 'warn' ? h('span', { class: 'notice__mark', 'aria-hidden': 'true', text: '!' }) : null, body];
    var n = h('div', { class: 'notice notice--' + kind, role: 'status' }, kids);
    if (action) {
      var ab = SK.iconify(h('button', { class: 'notice__act', type: 'button' }, action.label));
      ab.addEventListener('click', function (e) { blurOnMouse(e); n.remove(); action.onClick(); });
      n.appendChild(ab);
    }
    zone.innerHTML = '';
    zone.appendChild(n);
    placeNoticeZone();
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n); }, ms || (action ? 4500 : msVar('--dur-notice', 2500)));
  };

  SK.dialog = function (o) {
    return new Promise(function (resolve) {
      var prevFocus = document.activeElement;
      var okBtn = h('button', { class: 'btn ' + (o.danger ? 'btn--danger' : 'btn--primary'), type: 'button' }, [o.ok || '확인', keyHint('Enter')]);
      var cancelBtn = o.cancel === null ? null : h('button', { class: 'btn', type: 'button' }, [o.cancel || '취소', keyHint('Esc')]);
      var body = typeof o.body === 'string' ? h('p', { class: 'dialog__body', text: o.body }) : h('div', { class: 'dialog__body' }, o.body || null);
      var dlg = h('div', { class: 'dialog' + (o.small || typeof o.body === 'string' ? ' dialog--sm' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title || '' }, [
        o.title ? h('h2', { class: 'dialog__title', text: o.title }) : null, body,
        h('div', { class: 'dialog__foot' }, [cancelBtn, okBtn])
      ]);
      var layer = h('div', { class: 'dialog-layer' }, dlg);
      SK.el.slide.appendChild(layer);
      var outer = modal;
      if (SK.running) SK.pause();
      function close(v) {
        layer.remove(); modal = outer;
        if (prevFocus && prevFocus.focus) try { prevFocus.focus({ preventScroll: true }); } catch (e) { /* 무시 */ }
        resolve(v);
      }
      okBtn.addEventListener('click', function () { close(true); });
      if (cancelBtn) cancelBtn.addEventListener('click', function () { close(false); });
      layer.addEventListener('pointerdown', function (e) { if (e.target === layer) close(false); });
      modal = {
        type: 'dialog', onKey: function (e) {
          if (e.code === 'Escape') { close(false); return true; }
          if (e.code === 'Enter' || e.code === 'NumpadEnter') { close(true); return true; }
          if (e.code === 'Tab') return false;
          return true;
        }
      };
      okBtn.focus({ preventScroll: true });
    });
  };
  SK.confirm = function (o) { return SK.dialog(o); };

  function predText(p) {
    if (!p) return '';
    if (p.number !== undefined && p.number !== null) return withUnit(fmtFlex(p.number, 0, 3), p.unit);
    return plain(p.answer || '');
  }
  function niceExample(mn, mx) {
    if (typeof mn !== 'number' || typeof mx !== 'number' || !isFinite(mn) || !isFinite(mx)) return '';
    var mid = (mn + mx) / 2, st = niceStep(Math.max(1e-9, mx - mn), 4);
    return fmtFlex(Math.round(mid / st) * st, 0, 3);
  }
  /**
   * R5: '그림 보기' 버튼 — 누르고 있는 동안(또는 V 키를 누르는 동안) 층에 .is-peek → 창이 거의 투명, 어둡기 0.
   * getLayer() 는 지금 층. 반환 {btn, on, off}. 떼면(pointerup·pointercancel·V keyup·창 닫힘) 돌아온다.
   */
  var peekOff = null;
  function peekButton(getLayer) {
    var b = btn([ico('eye', '', { cls: 'ico--lead' }), '그림 보기', keyHint('V')], 'btn--outline predict__peek', null, { title: '누르고 있는 동안 창을 비켜 그림을 봐요 (키 V)', 'aria-label': '그림 보기 (누르고 있는 동안)' });
    function set(on) { var l = getLayer(); if (l) l.classList.toggle('is-peek', on); peekOff = on ? off : null; }
    function on() { set(true); }
    function off() { set(false); }
    b.addEventListener('pointerdown', function (e) {
      e.preventDefault(); on();
      try { b.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
      var up = function () { off(); window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', up, true); };
      window.addEventListener('pointerup', up, true); window.addEventListener('pointercancel', up, true);
    });
    b.addEventListener('pointerleave', function (e) { if (!b.hasPointerCapture || !b.hasPointerCapture(e.pointerId)) off(); });
    b.addEventListener('click', function (e) { e.preventDefault(); });
    return { btn: b, on: on, off: off };
  }
  document.addEventListener('keyup', function (e) { if (e.code === 'KeyV' && peekOff) peekOff(); });
  window.addEventListener('blur', function () { if (peekOff) peekOff(); });

  var predictListeners = [];
  /** R2(A4): 예측 창이 떠 있나 — 이 동안 시뮬은 결과 층(무늬·상·궤적)을 숨긴다 */
  SK.predicting = function () { return !!(modal && modal.type === 'predict'); };
  /** R5: 모드 고르기 창이 떠 있나 (예전 SK.el.stage.querySelector('.mode-layer') 대신) */
  SK.choosingMode = function () { return !!(modal && modal.type === 'mode'); };
  SK.onPredict = function (fn) { predictListeners.push(fn); };
  function firePredict(open, o) {
    if (open) closeSheets();
    SK.el.slide.classList.toggle('is-predicting', open);
    dirty = true;
    try { if (open && cfg.onPredictOpen) cfg.onPredictOpen(o); if (!open && cfg.onPredictClose) cfg.onPredictClose(o); } catch (e) { console.error(e); }
    predictListeners.forEach(function (fn) { try { fn(open, o); } catch (e) { console.error(e); } });
  }
  /**
   * 예측 창 (R2 A3). 실험 화면 아래쪽 카드 — 위쪽 장면·눈금은 그대로 보인다.
   * o = {question, choices, info, figure(SVG 글), answer(1~), why, judge(p, values)→번호, tag, handCount,
   *      numeric:{label:'얼마나 멀리 갈까?', unit, min, max(수 또는 함수), example, key, actual(p), decimals, tolerance, overText},
   *      afterHint:'예측 뒤 토스트 문구',
   *      place:'bottom'(기본)|'top' — R5 창 자리(실험 화면 아래쪽/위쪽). numeric.showRange:false 범위 글 숨김, numeric.example:null → '숫자만'}
   * R5: 창 높이 상한 42%(보기 3개 이상·그림 있으면 58%), 층 오른쪽 위(창이 top 이면 아래) [그림 보기] — 누르는 동안·V 키 누르는 동안 창이 비킴.
   * → Promise<{choice(1~), index(0~), number}|null>. 고르면 SimKit.prediction 에 저장, 실행이 끝나면(finish) 판정이 패널 맨 위에 뜬다.
   */
  SK.predict = function (o) {
    o = o || {};
    // R6: 심플 모드에서는 저절로 뜨는 예측 창(첫 화면·카드·모드 뒤)을 미뤄 두고 안내줄 [예측 ▸] 로만 연다. o.simple:true 면 바로 연다
    if (simpleOn && !predictGate && !o.simple) {
      lastPredictOpts = o; updateTask();
      return Promise.resolve(null);
    }
    return new Promise(function (resolve) {
      if (modal && modal.type === 'predict') modal.close(null);
      if (modal && modal.type === 'mode' && modal.close) modal.close();   // R3: 모드 창 위에 예측 창이 겹치지 않게
      lastPredictOpts = o;
      if (SK.stepIndex !== 0) SK.goStep(0);
      SK.pause();
      var layer, card, choices = o.choices || [], sel = null;
      var counts = choices.map(function () {
        return h('input', { class: 'predict__count', type: 'number', inputmode: 'numeric', min: '0', max: '99', step: '1', placeholder: '손', 'aria-label': '손든 학생 수', title: '손든 학생 수' });
      });
      function readCounts() {
        var r = [], any = false;
        counts.forEach(function (inp) { var n = parseInt(inp.value, 10); if (isNaN(n)) n = null; else any = true; r.push(n); });
        return any ? r : null;
      }
      function store(idx, num) {
        SK.prediction = {
          question: o.question, answer: idx !== null ? choices[idx] : null, index: idx, choice: idx !== null ? idx + 1 : null,
          choices: choices.slice(), number: num, unit: o.numeric ? o.numeric.unit : '', counts: readCounts(),
          key: o.answer, why: o.why, judge: o.judge, numeric: o.numeric, pending: true, preset: o.preset
        };
      }
      var closed = false;
      function close(idx, num, runNow) {
        if (closed) return; closed = true;
        if (layer) layer.remove(); modal = null; peek.off();
        SK.el.slide.classList.remove('is-modal');
        firePredict(false, o);
        if (idx === null && (num === null || num === undefined)) {
          resolve(null);
          if (runNow) { o._runNow = true; SK.play(); }
          updateTask();
          return;
        }
        store(idx, num);
        SK.notice(o.afterHint || '예측했어요 — ▶ 실행으로 확인해요', 'info');
        resolve({ choice: idx !== null ? idx + 1 : null, index: idx, number: num === undefined ? null : num });
        updateTask();
      }
      var okBtn = btn('예측하기', 'btn--primary predict__ok', function () { submit(); });
      var btns = choices.map(function (c, i) {
        var b = h('button', { class: 'btn btn--secondary predict__opt', type: 'button', 'aria-pressed': 'false' }, [h('span', { class: 'predict__no' }, circ(i + 1)), h('span', { class: 'predict__txt' }, rich(c)), keyHint(String(i + 1))]);
        b.addEventListener('click', function (e) { blurOnMouse(e); choose(i); });
        b.addEventListener('dblclick', function () { choose(i); submit(); });
        return h('div', { class: 'predict__choice' }, [b, counts[i]]);
      });
      var HINT_AFTER = o.numeric && !choices.length ? '적은 다음 ▶ 실행으로 확인해요' : '고른 다음 ▶ 실행으로 확인해요';
      var hintEl = h('span', { class: 'predict__hint' });
      function showHint(t) { hintEl.innerHTML = ''; hintEl.textContent = t; SK.iconify(hintEl, { all: true }); }
      showHint(choices.length ? '보기를 고르면 눌러져요' : HINT_AFTER);   // R5: 고르기 전에는 '예측하기' 가 왜 안 눌리는지
      function choose(i) {
        sel = i;
        btns.forEach(function (w, j) { w.firstChild.setAttribute('aria-pressed', String(j === i)); });
        okBtn.disabled = false;
        showHint(HINT_AFTER);
      }
      counts.forEach(function (inp) {
        inp.addEventListener('keydown', function (e) {
          if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); var i = counts.indexOf(inp); if (i + 1 < counts.length) counts[i + 1].focus(); else inp.blur(); }
          if (e.code === 'Escape') { e.preventDefault(); inp.blur(); }
          e.stopPropagation();
        });
      });
      var numBox = null, numIn = null, nmMin, nmMax;
      if (o.numeric) {
        var nm = o.numeric;
        nmMin = typeof nm.min === 'function' ? nm.min(SK.params) : nm.min;
        nmMax = typeof nm.max === 'function' ? nm.max(SK.params) : nm.max;
        // R5: example:null → placeholder '숫자만'(정답을 암시하는 예시값 없음) · showRange:false → 범위 글 생략
        var ex = nm.example === null ? null : nm.example !== undefined ? fmtFlex(nm.example, 0, 3) : niceExample(nmMin, nmMax);
        numIn = h('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-label': plain(nm.label || '예측 값') + ' 입력', placeholder: ex === null ? '숫자만' : ex !== '' ? '예: ' + ex : '' });
        var rangeTxt = nm.showRange !== false && typeof nmMin === 'number' && typeof nmMax === 'number' ? withUnit(fmtFlex(nmMin, 0, 2) + '~' + fmtFlex(nmMax, 0, 2), nm.unit) + ' 사이' : '';
        numBox = h('div', { class: 'predict__num' }, [
          h('label', { class: 'predict__numlabel' }, rich(nm.label || '내 예측')),
          h('span', { class: 'predict__field' }, [numIn, h('span', { class: 'predict__unit', text: nm.unit || '' })]),
          rangeTxt ? h('span', { class: 'predict__range', text: rangeTxt }) : null
        ]);
        numIn.addEventListener('keydown', function (e) {
          e.stopPropagation();
          if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); submit(); }
          if (e.code === 'Escape') { e.preventDefault(); if (numIn.value.trim()) { numIn.value = ''; okBtn.disabled = sel === null; } else close(null, null); }
        });
        numIn.addEventListener('input', function () { okBtn.disabled = !numIn.value.trim() && sel === null; });
      }
      function submit() {
        if (numIn && numIn.value.trim()) {
          var v = parseNum(numIn.value);
          if (isNaN(v)) { SK.notice('숫자로 적어 주세요', 'warn'); numIn.focus(); return; }
          if (typeof nmMax === 'number' && v > nmMax) setTimeout(function () { SK.notice(o.numeric.overText || '아주 크게 봤군요 — 확인해 봐요', 'info'); }, 0);
          else if (typeof nmMin === 'number' && v < nmMin) setTimeout(function () { SK.notice('아주 작게 봤군요 — 확인해 봐요', 'info'); }, 0);
          close(null, v);
          return;
        }
        if (sel !== null) { close(sel, null); return; }
        if (modal && modal.shake) modal.shake();
      }
      okBtn.disabled = true;
      var handBtn = choices.length && o.handCount !== false ? h('button', { class: 'btn btn--sm btn--outline teacher-only', type: 'button', title: '선택지마다 손든 학생 수를 적어요', 'aria-pressed': 'false' }, '✋ 손들기 수') : null;
      if (handBtn) handBtn.addEventListener('click', function (e) {
        blurOnMouse(e);
        var on = card.classList.toggle('predict--count');
        handBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
        if (on) counts[0].focus();
      });
      var fig = null;
      if (o.figure) { fig = h('div', { class: 'predict__figure', 'aria-hidden': 'true' }); fig.innerHTML = o.figure; }
      var skip = h('button', { class: 'btn btn--outline predict__skip', type: 'button' }, '예측 없이 바로 실행');   // R6(S14): 밑줄 글 → 윤곽선 단추
      var spaceT = 0;
      function spaceHint() {
        clearTimeout(spaceT);
        showHint('보기를 고르거나 [예측 없이 바로 실행]을 눌러요'); hintEl.classList.add('is-alert');
        spaceT = setTimeout(function () { hintEl.classList.remove('is-alert'); showHint(sel !== null || (numIn && numIn.value.trim()) ? HINT_AFTER : (choices.length ? '보기를 고르면 눌러져요' : HINT_AFTER)); }, 3000);
      }
      skip.addEventListener('click', function (e) { blurOnMouse(e); close(null, null, true); });
      var peek = peekButton(function () { return layer; });
      // R6(S7): 보기 3개가 모두 14자 이하(그림 없음)면 한 줄 3칸 — 창 높이를 줄인다
      var isShort = !fig && choices.length === 3 && choices.every(function (c) { return plain(c).length <= 14; });
      card = h('div', { class: 'predict' + (fig ? ' has-figure' : '') + (choices.length > 2 ? ' is-many' : '') + (isShort ? ' is-short' : '') + (o.place === 'top' ? ' predict--top' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': '예측' }, [
        h('div', { class: 'predict__top' }, [h('span', { class: 'predict__label', text: '먼저 예측해 보세요' }), o.tag ? h('span', { class: 'chip chip--sim', text: SK.tagText(o.tag) }) : null, handBtn]),
        btn('✕', 'btn--quiet predict__close', function () { close(null, null); }, { 'aria-label': '예측 창 닫기', title: '닫기 (띠의 예측하기 버튼으로 다시 열 수 있어요)' }),
        h('p', { class: 'predict__q' }, rich(o.question || '')),
        o.info ? h('p', { class: 'predict__info' }, rich(o.info)) : null,
        fig || btns.length ? h('div', { class: 'predict__mid' }, [fig, btns.length ? h('div', { class: 'predict__choices' }, btns) : null]) : null,
        numBox,
        h('div', { class: 'predict__foot' }, [hintEl, skip, okBtn])
      ]);
      layer = h('div', { class: 'predict-layer' + (o.place === 'top' ? ' is-top' : '') }, [card, peek.btn]);
      SK.el.slide.appendChild(layer);   // R5: 실험 화면이 아니라 무대에 — 세로 배치에서는 패널 자리로 간다(base.css §35)
      SK.el.slide.classList.add('is-modal');   // R3: 모서리 칩·캔버스 위 버튼·카드 말풍선 숨김
      modal = {
        type: 'predict', close: function (v) { close(v, null); },
        shake: function () {
          card.classList.remove('is-shake'); void card.offsetWidth; card.classList.add('is-shake');
          taskAlertUntil = Date.now() + 3000; updateTask();
        },
        onKey: function (e) {
          if (e.code === 'Escape') { close(null, null); return true; }
          if (e.code === 'KeyV') { peek.on(); return true; }   // R5: V 누르는 동안 그림 보기
          var m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
          if (m && +m[1] <= choices.length) { choose(+m[1] - 1); return true; }
          if (e.code === 'Enter' || e.code === 'NumpadEnter') {
            var t = document.activeElement;
            if (t && (t === skip || (t.tagName === 'BUTTON' && t !== okBtn && !t.classList.contains('predict__opt')))) return false;
            submit(); return true;
          }
          if (e.code === 'Space') { modal.shake(); spaceHint(); return true; }   // R6(S14): 무엇을 눌러야 하는지 창 안에 한 줄
          if (e.code === 'KeyF') return false;
          if (e.code === 'Tab') return false;
          return true;
        }
      };
      firePredict(true, o);
      updateTask();
      if (numIn && !choices.length) setTimeout(function () { numIn.focus(); }, 50);
    });
  };

  /** 실행이 끝났을 때 예측 판정 → {kind, mine, right, numeric, why} (R2: 번호가 아니라 선택지 글자) */
  function judgePrediction() {
    var p = SK.prediction;
    if (!p || !p.pending) return null;
    p.pending = false;
    var values = {};
    try { var cap = cfg.capture ? cfg.capture(SK.params) : null; values = (cap && cap.values) || {}; } catch (e) { /* 무시 */ }
    if (p.number !== null && p.number !== undefined && p.numeric) {
      var nm = p.numeric, actual = typeof nm.actual === 'function' ? nm.actual(SK.params, values) : values[nm.key];
      if (typeof actual !== 'number') return null;
      var d = Math.abs(actual - p.number), dd = nm.decimals !== undefined ? nm.decimals : 1;
      var close = nm.tolerance !== undefined ? d <= nm.tolerance : d <= Math.max(Math.abs(actual) * 0.1, Math.pow(10, -dd));
      p.result = { actual: actual, diff: d, hit: close };
      return { kind: close ? 'hit' : 'miss', numeric: { pred: fmtFlex(p.number, 0, dd), actual: fmt(actual, dd), diff: fmt(d, dd), unit: nm.unit || '' }, why: p.why };
    }
    var right = null;
    if (typeof p.judge === 'function') { try { right = p.judge(SK.params, values); } catch (e) { right = null; } }
    else if (p.key) right = p.key;
    if (!right || !p.choice) return null;
    var hit = right === p.choice;
    p.result = { right: right, hit: hit };
    var list = p.choices || [];
    return { kind: hit ? 'hit' : 'miss', mine: plain(list[p.choice - 1] || p.answer || ''), right: plain(list[right - 1] || CIRCLED[right - 1]), why: p.why };
  }

  /* ── R2(A2) 결과 해설 카드: 패널 맨 위(.panel-note), 실행이 끝난 뒤에만 ── */
  var noteEls = null;
  function buildPanelNote() {
    var body = h('div', { class: 'panel-note__body' });
    var tog = btn('접기 ▴', 'btn--quiet panel-note__fold', function () { noteCollapsed = !noteCollapsed; renderNote(); }, { 'aria-expanded': 'true' });
    var root = h('section', { class: 'panel-note', hidden: true, 'aria-live': 'polite', 'aria-label': '실험 결과 해설' }, [
      h('div', { class: 'panel-note__head' }, [h('span', { class: 'panel-note__title', text: '이번 실험 결과' }), tog]), body
    ]);
    return { root: root, body: body, tog: tog };
  }
  function noteChip() {
    var pop = h('div', { class: 'note-pop', hidden: true, role: 'region', 'aria-label': '실험 결과 해설' });
    var b = btn('해설 보기 ▾', 'btn--outline btn--sm note-chip', function () {
      pop.hidden = !pop.hidden;
      setText(b, pop.hidden ? '해설 보기 ▾' : '해설 닫기 ▴');
      if (!pop.hidden) { pop.innerHTML = ''; noteContent().forEach(function (n) { pop.appendChild(n); }); }
    });
    b.hidden = true;
    return { btn: b, pop: pop };
  }
  function hasNote() { return !!(noteState.verdict || noteState.takeaway); }
  function normTake(t) {
    if (!t) return null;
    if (typeof t === 'string') return { line: t, more: '' };
    if (typeof t === 'object' && (t.line || t.more)) return { line: t.line || '', more: t.more || '' };
    return null;
  }
  /** 해설 내용(카드·팝오버 공통): 1행 판정 → 2행 한 줄 → [왜 그럴까? ▾] */
  function noteContent() {
    var out = [], v = noteState.verdict, t = noteState.takeaway;
    if (v) {
      if (v.numeric) {
        var u = withUnit('', v.numeric.unit);
        out.push(h('div', { class: 'note-verdict note-verdict--num verdict--' + v.kind }, [
          SK.iconify(h('span', { class: 'verdict__mark', text: v.kind === 'hit' ? '✓ 가까워요' : '△ 차이 있어요' })),
          h('div', { class: 'note-nums' }, [
            h('span', { class: 'note-num' }, [h('small', { text: '예측' }), h('b', { class: 'num', text: v.numeric.pred + u })]),
            h('span', { class: 'note-num is-actual' }, [h('small', { text: '실제' }), h('b', { class: 'num', text: v.numeric.actual + u })]),
            h('span', { class: 'note-num' }, [h('small', { text: '차이' }), h('b', { class: 'num', text: v.numeric.diff + u })])
          ])
        ]));
      } else if (v.mine !== undefined) {
        out.push(h('p', { class: 'note-verdict verdict--' + v.kind }, [
          SK.iconify(h('span', { class: 'verdict__mark', text: v.kind === 'hit' ? '✓' : '✗' })),
          h('span', null, ['내 예측: ', h('b', { text: v.mine }), ' → ',
            v.kind === 'hit' ? h('b', { class: 'verdict__res', text: '맞았어요' }) : h('span', null, ['아니에요. 실제는 ', h('b', { class: 'verdict__res', text: v.right })])])
        ]));
      } else if (v.text !== undefined) {
        out.push(h('p', { class: 'note-verdict verdict--' + (v.kind || 'info') }, [
          SK.iconify(h('span', { class: 'verdict__mark', text: v.kind === 'hit' ? '✓' : v.kind === 'miss' ? '✗' : 'ⓘ' })), h('span', null, rich(v.text))
        ]));
      }
    }
    if (t && t.line) out.push(h('p', { class: 'note-line' }, rich(t.line)));
    var whyKids = [];
    if (v && v.why) whyKids.push(h('p', null, rich(v.why)));
    if (t && t.more) whyKids.push(h('p', null, rich(t.more)));
    if (whyKids.length) {
      var why = h('details', { class: 'note-why' }, [h('summary', { text: '왜 그럴까?' }), h('div', { class: 'note-why__body' }, whyKids)]);
      why.addEventListener('toggle', function () { setTimeout(checkMore, 0); });   // R5: 펼치면 패널 길이가 바뀜
      out.push(why);
    }
    return out;
  }
  function renderNote() {
    if (!noteEls) return;
    var on = hasNote(), wasOn = !noteEls.root.hidden;
    noteEls.root.hidden = !on;
    noteEls.body.innerHTML = '';
    if (on) noteContent().forEach(function (n) { noteEls.body.appendChild(n); });
    noteEls.root.classList.toggle('is-folded', noteCollapsed);
    noteEls.body.hidden = noteCollapsed;
    setText(noteEls.tog, noteCollapsed ? '펼치기 ▾' : '접기 ▴');
    noteEls.tog.setAttribute('aria-expanded', String(!noteCollapsed));
    (SK.el.noteChips || []).forEach(function (c) {
      c.btn.hidden = !on;
      if (!on) { c.pop.hidden = true; setText(c.btn, '해설 보기 ▾'); }
      else if (!c.pop.hidden) { c.pop.innerHTML = ''; noteContent().forEach(function (n) { c.pop.appendChild(n); }); }
    });
    // R5: 새 해설이 뜨면 패널을 맨 위로(카드가 스크롤 상자 안에 있으므로)
    if (on && !wasOn && SK.el.panel) SK.el.panel.scrollTop = 0;
    setTimeout(checkMore, 0);
  }
  function showNote(verdict, fromFinish) {
    if (verdict) noteState.verdict = verdict;
    if (fromFinish) {
      noteCollapsed = false;
      if (takeawayCfg) {
        var t = typeof takeawayCfg === 'function' ? takeawayCfg(SK.params) : takeawayCfg;
        noteState.takeaway = normTake(t);
      }
    }
    renderNote();
  }
  function hideNote() {
    noteState = { verdict: null, takeaway: null };
    renderNote();
  }
  /** 실행이 끝나면 패널 맨 위 카드에 '한 줄 요약'. 함수면 끝날 때 params 로 부른다.
      돌려주는 값: 문자열(한 줄) 또는 R2 {line:'한 줄', more:'왜 그럴까? 안에 넣을 전문'} · null 이면 지움 */
  SK.takeaway = function (text) {
    takeawayCfg = text || null;
    if (SK.finished) { noteState.takeaway = normTake(typeof text === 'function' ? text(SK.params) : text); renderNote(); }
  };
  SK.verdict = function (kind, text) { showNote({ kind: kind || 'info', text: text }, false); };
  SK.hideNote = function () { hideNote(); };

  /** R2(G2): 모드 고르기 창 — 기본 선택 없음, 카드를 누르면 바로 시작. 실험 화면 아래쪽 카드(예측 창과 같은 자리) */
  var modeApi = null, modeSeen = {};
  SK.chooseMode = function (o) {
    var modes = (o.modes || []).map(function (m) { return { value: m.value, label: stripNo(m.label), desc: m.desc || '' }; });
    if (!modes.length) return null;
    var urlKey = o.urlKey || 'mode';
    var storeKey = 'simkit:mode:' + (cfg.slug || location.pathname) + ':' + urlKey;
    var ctlKey = o.key || null;
    if (!ctlKey) {   // 패널에 같은 선택지(값이 똑같은 addChoice)가 있으면 찾아서 접는다
      for (var k in SK.controls) {
        var d = SK.controls[k].def;
        if (d && d.kind === 'choice' && d.options.length === modes.length && d.options.every(function (op, i) { return op.value === modes[i].value; })) { ctlKey = k; break; }
      }
    }
    var def0 = o.default !== undefined ? o.default : (ctlKey && SK.controls[ctlKey] ? SK.controls[ctlKey].get() : modes[0].value);
    var current = def0, layer = null;
    function labelOf(v) { for (var i = 0; i < modes.length; i++) if (modes[i].value === v) return modes[i].label; return String(v); }
    function remember(v) { try { sessionStorage.setItem(storeKey, String(v)); } catch (e) { /* 저장 안 돼도 동작 */ } }
    function showLine() {
      var ml = SK.el.modeLine; ml.innerHTML = ''; ml.hidden = false;
      ml.appendChild(h('span', { class: 'panel-mode__now' }, ['지금: ', h('b', { text: labelOf(current) })]));
      ml.appendChild(btn('실험 고르기', 'btn--outline btn--sm', function () { open(); }, { title: '다른 실험(모드)으로 바꿔요' }));
      if (ctlKey && SK.controls[ctlKey]) SK.controls[ctlKey].el.classList.add('is-folded', 'is-mode-ctl');   // R6: 심플 레일에서는 다시 펼침
    }
    function autoPredictAfterMode() {
      if (!cfg.autoPredict || simpleOn) return;
      setTimeout(function () {
        if (modal || SK.records.length || SK.started) return;
        if (SK.prediction && SK.prediction.pending) return;
        if (activePreset >= 0 && presets[activePreset] && presets[activePreset].predict) { openPresetPredict(activePreset); return; }
        var pi = firstPredictPreset();
        if (pi >= 0) SK.applyPreset(pi);
      }, 150);
    }
    function pick(v, quiet, noAuto) {
      current = v; remember(v); showLine();
      if (o.onPick) o.onPick(v, modes.map(function (m) { return m.value; }).indexOf(v));
      if (!o.onPick && ctlKey && SK.controls[ctlKey] && SK.controls[ctlKey].get() !== v) SK.controls[ctlKey].set(v);
      dirty = true;
      if (!quiet) SK.notice(withJosa(labelOf(v), '으로/로') + ' 시작해요', 'info');
      if (!noAuto) autoPredictAfterMode();
    }
    var peek = peekButton(function () { return layer; }), marker = null;
    function closeLayer() {
      if (layer) { layer.remove(); layer = null; }
      if (marker) { marker.remove(); marker = null; }
      peek.off(); modal = null; SK.el.slide.classList.remove('is-modal');
    }
    function open() {
      if (layer) return;
      if (modal && modal.type === 'predict') modal.close(null);
      SK.pause();
      var opts = modes.map(function (m, i) {
        var b = h('button', { class: 'mode-opt', type: 'button', 'aria-pressed': 'false' }, [
          h('span', { class: 'mode-opt__no' }, circ(i + 1)),
          h('span', { class: 'mode-opt__label', text: m.label }),
          m.desc ? h('span', { class: 'mode-opt__desc', text: m.desc }) : null,
          m.value === current && modeSeen[storeKey + ':picked'] ? h('span', { class: 'mode-opt__now', text: '지금 하는 것' }) : null
        ]);
        b.addEventListener('click', function (e) { blurOnMouse(e); start(i); });
        return b;
      });
      function start(i) { modeSeen[storeKey + ':picked'] = true; closeLayer(); pick(modes[i].value); }
      var card = h('div', { class: 'mode-card' + (o.place === 'top' ? ' predict--top' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title || '무엇을 알아볼까요?' }, [
        btn('✕', 'btn--quiet mode-card__close', function () { closeLayer(); pick(current, true, true); }, { 'aria-label': '닫고 지금 것으로 하기', title: '닫기 (지금 것으로 해요)' }),
        h('p', { class: 'mode-card__q', text: o.title || '무엇을 알아볼까요?' }),
        h('p', { class: 'mode-card__sub', text: '하나를 누르면 바로 시작해요. 나중에 조절 패널 위 실험 고르기 버튼으로 바꿀 수 있어요.' }),
        h('div', { class: 'mode-opts', style: 'grid-template-columns:repeat(' + (modes.length === 4 ? 2 : Math.min(modes.length, 3)) + ',minmax(0,1fr))' }, opts)   // R6(S7): 4개면 2열
      ]);
      layer = h('div', { class: 'mode-layer' + (o.place === 'top' ? ' is-top' : '') }, [card, peek.btn]);
      SK.el.slide.appendChild(layer);   // R5: 무대에 (세로에서는 패널 자리)
      // 예전 코드 호환: SK.el.stage.querySelector('.mode-layer') 로 '모드 창이 떠 있나' 를 보던 sim 용 표시(보이지 않음). 새 코드는 SK.choosingMode()
      marker = h('i', { class: 'mode-layer mode-layer--marker', 'aria-hidden': 'true', style: 'display:none' });
      SK.el.stage.appendChild(marker);
      SK.el.slide.classList.add('is-modal');
      modal = {
        type: 'mode', close: function () { closeLayer(); pick(current, true, true); }, onKey: function (e) {
          var m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
          if (m && +m[1] <= modes.length) { start(+m[1] - 1); return true; }
          if (e.code === 'Escape') { closeLayer(); pick(current, true, true); return true; }
          if (e.code === 'KeyV') { peek.on(); return true; }
          if (e.code === 'KeyF') return false;
          if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') return !(document.activeElement && document.activeElement.classList.contains('mode-opt')) || false;
          return e.code !== 'Tab';
        }
      };
      card.setAttribute('tabindex', '-1');   // 기본 선택 없음 — 보기에 포커스 링이 먼저 생기지 않게 카드에 포커스
      setTimeout(function () { try { card.focus({ preventScroll: true }); } catch (e) { /* 무시 */ } }, 30);
    }
    // URL ?mode=값 → 창 없이 / 이번 세션에 이미 골랐으면 → 창 없이 그 값
    var fromUrl = null, stored = null;
    try { fromUrl = new URLSearchParams(location.search).get(urlKey); } catch (e) { fromUrl = null; }
    try { stored = sessionStorage.getItem(storeKey); } catch (e) { stored = null; }
    function valid(v) { for (var i = 0; i < modes.length; i++) if (String(modes[i].value) === String(v)) return modes[i].value; return null; }
    var pre = valid(fromUrl);
    if (pre === null) pre = valid(stored);
    if (valid(stored) !== null && o.default === undefined) current = valid(stored);
    if (modeSeen[storeKey]) pre = null;          // 같은 페이지에서 다시 부르면(예: '입구 바꾸기') 창을 연다
    modeSeen[storeKey] = true;
    setTimeout(function () {
      if (pre !== null) { modeSeen[storeKey + ':picked'] = true; pick(pre, true); }
      else if (simpleOn) pick(current, true, true);   // R6: 심플에서는 모드 창을 띄우지 않는다(지금 값으로, 바꾸기는 상황 단추)
      else open();
    }, 0);
    modeApi = { key: ctlKey, open: open, get: function () { return current; }, sync: function (v) { if (v !== current) { current = v; remember(v); showLine(); } } };
    return modeApi;
  };

  /** A13: '수업 안내(교사)' 서랍 — 교사 모드에서만 */
  var drawerEl = null;
  SK.guide = function (o) {
    o = o || {};
    var body = h('div', { class: 'drawer__body' });
    function gtext(tag, cls, text) { return SK.iconify(h(tag, cls ? { class: cls } : null, rich(text)), { all: true }); }   // R4: 수식 $v_0$ + 글 속 ↻ ⚡ 아이콘
    if (o.rows && o.rows.length) {
      body.appendChild(h('h3', { text: '변수·상황과 성취기준' }));
      o.rows.forEach(function (r) {
        body.appendChild(h('div', { class: 'guide-card' }, [
          gtext('p', 'guide-card__t', r.target || ''),
          h('dl', null, [
            h('dt', { text: '성취기준·탐구' }), gtext('dd', null, r.standard || '—'),
            h('dt', { text: '학생이 발견할 것' }), gtext('dd', null, r.discover || '—'),
            h('dt', { text: '깨는 오개념' }), gtext('dd', null, r.misconception || '—')
          ])
        ]));
      });
    }
    (o.sections || []).forEach(function (s) {
      body.appendChild(h('h3', { text: s.title }));
      body.appendChild(h('ul', { style: 'display:grid;gap:var(--space-2);padding-left:var(--space-5);list-style:disc' }, (s.items || []).map(function (t) { return gtext('li', null, t); })));
    });
    var toggleRow = checkRow;
    var html = document.documentElement;
    body.appendChild(h('h3', { text: '교사 설정' }));
    body.appendChild(toggleRow('모드·실험 카드를 고르면 예측 창 자동으로 띄우기', function () { return cfg.autoPredict; }, setAutoPredict));
    body.appendChild(toggleRow('학생 화면의 [답 확인하기] 잠그기 (토론 전)', function () { return html.classList.contains('reveal-locked'); }, function (v) { html.classList.toggle('reveal-locked', v); }));
    body.appendChild(toggleRow('버튼에 단축키 글자 보이기', function () { return html.classList.contains('show-keys'); }, function (v) { html.classList.toggle('show-keys', v); }));
    body.appendChild(btn('모든 [답 확인하기] 펼치기', 'btn--secondary', function () {
      var ds = document.querySelectorAll('details.reveal'); for (var i = 0; i < ds.length; i++) ds[i].open = true;
    }));
    if (o.keys) { body.appendChild(h('h3', { text: '이 실험 전용 키' })); body.appendChild(h('p', { text: o.keys })); }
    if (o.keys) { guideKeys = o.keys; if (helpEl) { helpEl.remove(); helpEl = null; if (helpScrim) { helpScrim.remove(); helpScrim = null; } } }
    var closeBtn = btn(['닫기', keyHint('Esc')], '', function () { SK.toggleGuide(false); });
    drawerEl = h('aside', { class: 'drawer teacher-only', hidden: true, 'aria-label': '수업 안내(교사)' }, [
      h('div', { class: 'drawer__head' }, [h('h2', { text: '수업 안내(교사)' }), closeBtn]), body
    ]);
    SK.el.slide.appendChild(drawerEl);
    SK.el.guideBtn.hidden = false;
  };
  var guideKeys = '';
  SK.toggleGuide = function (on) {
    if (!drawerEl) return;
    if (!SK.isTeacher()) { drawerEl.hidden = true; return; }
    drawerEl.hidden = on === undefined ? !drawerEl.hidden : !on;
    if (!drawerEl.hidden) SK.toggleHelp(false);
  };

  /** A12: 도움말 서랍 (이렇게 해요 / 개념 / 용어 / 단축키) — R2(D1~D3) */
  var helpEl = null, helpTabs = {}, helpPanes = {}, helpLive = [];
  var termAlias = {}, termShort = {}, termAliasList = {};
  var DEFAULT_HOW = [
    '아래 실험 카드 하나를 누르면 값이 바뀌고 예측 질문이 나와요. 답을 먼저 골라요.',
    '아래 ▶ 실행을 누르고 결과를 지켜봐요. 끝나면 위 띠의 기록하기 버튼으로 저장해요.',
    '오른쪽 수치 바꾸기에서 한 가지만 바꾸고 다시 실행해 기록해요.',
    '비교 단계에서 기록 표를 보고 무엇이 달라졌는지 찾아요.'
  ];
  /** terms: { 용어: '풀이' } 또는 { 용어: {def:'풀이', short:'괄호 풀이', alias:['같은 말']} } — 넣은 순서 그대로 */
  function addTerms(terms) {
    if (!terms) return;
    for (var k in terms) {
      if (!Object.prototype.hasOwnProperty.call(terms, k)) continue;
      var t = terms[k];
      if (t && typeof t === 'object') {
        termDict[k] = t.def || t.text || '';
        if (t.short) termShort[k] = t.short;
        termAliasList[k] = (t.alias || []).slice();
        (t.alias || []).forEach(function (a) { termAlias[a] = k; });
      } else termDict[k] = String(t);
    }
  }
  function canonTerm(name) { return termAlias[name] || name; }
  function shortOf(name) {
    if (termShort[name]) return termShort[name];
    var d = termDict[name]; if (!d) return '';
    var first = String(d).split(/[.。]|\s—\s/)[0].trim();
    return first.length <= 24 ? first : '';
  }
  SK.help = function (o) {
    helpCfg = o || {};
    addTerms(helpCfg.terms);
    if (helpEl) { helpEl.remove(); helpEl = null; if (helpScrim) { helpScrim.remove(); helpScrim = null; } }
    updateTask();
  };
  function concept(c) {
    var live = c.live ? h('p', { class: 'concept__live' }) : null;
    if (live) helpLive.push({ el: live, fn: c.live });
    var fig = null;
    if (c.figure) { fig = h('div', { class: 'concept__figure', 'aria-hidden': 'true' }); fig.innerHTML = c.figure; }
    var sym = null;
    if (c.symbols && c.symbols.length) {
      sym = h('table', { class: 'concept__symbols' }, [
        h('thead', null, h('tr', null, [h('th', { text: '기호' }), h('th', { text: '뜻' }), h('th', { text: '단위' })])),
        h('tbody', null, c.symbols.map(function (s) { return h('tr', null, [h('td', { class: 'concept__sym' }, rich(s.s)), h('td', null, rich(s.meaning || '')), h('td', { text: s.unit || '–' })]); }))
      ]);
    }
    var isNew = !!(c.summary || c.symbols || c.why || c.figure || c.example);
    function lines(v) { return typeof v === 'string' ? v.split('\n').map(function (ln) { return h('p', null, rich(ln)); }) : [v]; }   // 요소를 주면 그대로
    var plainEl = c.plain ? SK.iconify(h('div', { class: 'concept__plain' }, lines(c.plain)), { all: true }) : null;   // R4: 문장 속 ✗ ✓ ↓ 도 아이콘
    var formulaBox = c.formula ? SK.iconify(h('p', { class: 'concept__formula' }, rich(c.formula)), { all: true }) : null;   // R4: 식도 수식 표기
    var kids = [
      h('h3', { class: 'concept__title' }, rich(c.title || '')),
      c.summary ? h('p', { class: 'concept__summary' }, rich(c.summary)) : null,
      plainEl,
      c.example ? h('p', { class: 'concept__example' }, [h('b', { text: '예) ' })].concat(rich(c.example))) : null,
      fig
    ];
    if (isNew) {
      if (formulaBox || sym) kids.push(h('details', { class: 'concept__more' }, [h('summary', { text: '식 보기' }), h('div', { class: 'concept__more-body' }, [formulaBox, sym])]));
      if (c.why) kids.push(h('details', { class: 'concept__more' }, [h('summary', { text: '왜 그럴까?' }), h('div', { class: 'concept__more-body' }, lines(c.why))]));
    } else if (formulaBox) kids.splice(1, 0, formulaBox);   // 예전 구조 {title, formula, plain, live}: 식을 제목 바로 아래
    kids.push(live);
    return h('div', { class: 'concept' }, kids);
  }
  function buildHelp() {
    var o = helpCfg || {};
    var tabsBox = h('div', { class: 'help-tabs', role: 'tablist' });
    var paneBox = h('div', { class: 'drawer__body' });
    helpTabs = {}; helpPanes = {}; helpLive = [];
    function addTab(id, name, content) {
      var t = h('button', { class: 'help-tab', type: 'button', role: 'tab', 'aria-selected': 'false', 'data-tab': id }, name);
      t.addEventListener('click', function (e) { blurOnMouse(e); showTab(id); });
      tabsBox.appendChild(t);
      var p = h('div', { role: 'tabpanel', class: 'help-pane', hidden: true, 'data-tab': id }, content);
      paneBox.appendChild(p);
      helpTabs[id] = t; helpPanes[id] = p;
    }
    addTab('how', '이렇게 해요', h('ol', { class: 'help-how' }, (o.how && o.how.length ? o.how : DEFAULT_HOW).map(function (s, i) {
      return h('li', { class: 'help-step' }, [h('span', { class: 'help-step__num', 'aria-hidden': 'true', text: String(i + 1) }), SK.iconify(h('div', { class: 'help-step__body' }, rich(tidyMsg(s))), { all: true })]);   // R4: 문장 속 ▶·↻ 아이콘
    })));
    if (o.concepts && o.concepts.length) addTab('concepts', '개념', o.concepts.map(concept));
    var names = Object.keys(termDict);
    if (names.length) {
      var dl = h('dl', { class: 'term-list' });
      names.forEach(function (n) {
        dl.appendChild(h('dt', { text: n }));
        var al = termAliasList[n] && termAliasList[n].length ? h('span', { class: 'term-list__alias' }, rich(' (같은 말: ' + termAliasList[n].join(', ') + ')')) : null;
        dl.appendChild(h('dd', null, rich(termDict[n]).concat([al])));   // R4: 용어 뜻의 v₀·$v_x$ 도 수식 표기
      });
      addTab('terms', '용어', dl);
    }
    var keys = [
      ['Space', '실행 / 멈추기'], ['← →', '단계 바꾸기 (예측·실행·비교·정리)'], ['1 ~ 5', '실험 카드 고르기'],
      ['S', '기록하기'], ['R', '기본값으로 되돌리기'], ['C', '기록 모두 지우기'], [', .', '한 장면 뒤로 / 앞으로'],
      ['[ ]', '속도 느리게 / 빠르게'], ['F', '전체 화면'], ['T', '조작판 접기 / 펴기'], ['?', '이 도움말'],
      ['Esc', '창 닫기 (두 번 누르면 허브로)'], ['H (3초 누르기)', '교사 모드 켜기 / 끄기']
    ].concat(o.keys || []);
    var kl = h('dl', { class: 'key-list' });
    keys.forEach(function (k) { kl.appendChild(h('dt', null, h('kbd', { text: k[0] }))); kl.appendChild(h('dd', { text: k[1] })); });
    var extra = guideKeys ? h('p', { class: 'var__hint', text: '이 실험 전용: ' + guideKeys }) : null;
    addTab('keys', '단축키', [kl, extra, h('p', { class: 'var__hint', text: '키보드가 없어도 화면의 버튼으로 모두 할 수 있어요.' })]);
    var closeBtn = btn(['닫기', keyHint('Esc')], 'btn--outline btn--sm', function () { SK.toggleHelp(false); });
    // R3: 제목 '도움말' + 작은 부제(실험 이름) — 긴 제목이 고아 줄로 꺾이지 않게
    helpEl = h('aside', { class: 'drawer drawer--help', hidden: true, 'aria-label': '도움말' }, [
      h('div', { class: 'drawer__head' }, [h('h2', null, ['도움말', cfg.title ? h('small', { text: cfg.title }) : null]), closeBtn]), tabsBox, paneBox
    ]);
    // R3: 서랍 뒤 스크림 — 누르면 닫힘
    helpScrim = h('div', { class: 'drawer-scrim', hidden: true, 'aria-hidden': 'true' });
    helpScrim.addEventListener('click', function () { SK.toggleHelp(false); });
    SK.el.slide.appendChild(helpScrim);
    SK.el.slide.appendChild(helpEl);
    showTab('how');
  }
  function showTab(id) {
    if (!helpTabs[id]) id = 'how';
    for (var k in helpTabs) { helpTabs[k].setAttribute('aria-selected', String(k === id)); helpPanes[k].hidden = k !== id; }
    refreshLive();
  }
  function refreshLive() {
    helpLive.forEach(function (l) { try { setText(l.el, l.fn(SK.params) || ''); } catch (e) { l.el.textContent = ''; } });   // R4: '지금 값으로: $v_x$ = …' 수식 표기
  }
  SK.toggleHelp = function (on, tab) {
    if (!helpEl) buildHelp();
    var show = on === undefined ? helpEl.hidden : !!on;
    helpEl.hidden = !show;
    if (helpScrim) helpScrim.hidden = !show;
    if (show) { if (tab) showTab(tab); else refreshLive(); if (drawerEl) drawerEl.hidden = true; }
  };

  /** A12: 용어 말풍선. SimKit.term('초점거리') → <abbr class="term"> (풀이는 help({terms}) 또는 두 번째 인자)
      R2(D3): 같은 말(alias)은 같은 풀이로 */
  SK.term = function (name, explain) {
    var canon = canonTerm(name);
    if (explain) termDict[canon] = explain;
    var a = h('abbr', { class: 'term', tabindex: '0', 'data-term': canon, text: name });
    return a;
  };
  /** R2(D2): help({inlineTerms:true}) 이면 {{용어}} 첫 등장 뒤에 '(짧은 풀이)' 를 붙인다 */
  function termNodes(name) {
    var canon = canonTerm(name), out = [SK.term(name)];
    if (helpCfg && helpCfg.inlineTerms && !termSeen[canon] && termDict[canon]) {
      var s = shortOf(canon);
      if (s) { termSeen[canon] = true; out.push(h('span', { class: 'term-inline', text: '(' + s + ')' })); }
    }
    return out;
  }
  var tipEl = null;
  function installTermTips() {
    tipEl = h('div', { class: 'term-tip', hidden: true, role: 'tooltip' });
    document.body.appendChild(tipEl);
    function show(t) {
      var name = t.getAttribute('data-term'), txt = termDict[name];
      if (!txt) return;
      tipEl.innerHTML = ''; tipEl.appendChild(h('b', { text: name })); rich(txt).forEach(function (nd) { tipEl.appendChild(typeof nd === 'string' ? document.createTextNode(nd) : nd); });   // R4: 용어 뜻의 v₀ 도 수식 표기
      tipEl.hidden = false;
      var r = t.getBoundingClientRect(), tw = tipEl.offsetWidth, th = tipEl.offsetHeight;
      var x = clamp(r.left + r.width / 2 - tw / 2, 8, window.innerWidth - tw - 8);
      var y = r.top - th - 8; if (y < 8) y = r.bottom + 8;
      tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px';
    }
    function hide() { tipEl.hidden = true; }
    document.addEventListener('pointerover', function (e) { var t = e.target.closest && e.target.closest('.term'); if (t) show(t); });
    document.addEventListener('pointerout', function (e) { var t = e.target.closest && e.target.closest('.term'); if (t) hide(); });
    document.addEventListener('focusin', function (e) { var t = e.target.closest && e.target.closest('.term'); if (t) show(t); });
    document.addEventListener('focusout', function (e) { if (e.target.closest && e.target.closest('.term')) hide(); });
    document.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('.term');
      if (t) { e.preventDefault(); e.stopPropagation(); if (tipEl.hidden) show(t); else hide(); }
    }, true);
  }

  /** A12: 접어 두는 답. SimKit.reveal(container, '정답 글(HTML)') → <details class="reveal"> */
  SK.reveal = function (container, answerHtml, label) {
    var body = h('div', { class: 'reveal__body' });
    if (typeof answerHtml === 'string') body.innerHTML = answerHtml; else if (answerHtml) body.appendChild(answerHtml);
    var d = h('details', { class: 'reveal' }, [h('summary', { text: label || '답 확인하기' }), body]);
    d.addEventListener('toggle', function () {
      var html = document.documentElement;
      if (d.open && html.classList.contains('reveal-locked') && !html.classList.contains('is-teacher')) { d.open = false; SK.notice('선생님이 열어 줄 때까지 기다려요', 'info'); }
    });
    if (container) resolveWhere(container).appendChild(d);
    return d;
  };

  /**
   * 정리 질문 카드 (정리 단계에 오른쪽 칸에 뜬다).
   * o = {id, q, hint, hintFold, choices, answer(1~), why, reveal, where, when: () => 보일지}
   * 선택지를 누르면 바로 맞힘/틀림 + 이유(R2 D4: 이유를 바로). 계산형(보기 없음)의 hint 는 '힌트 보기 ▸' 로 접힘.
   * 반환: 카드 요소. 지우기: SimKit.think.remove(id 또는 요소)
   */
  SK.think = function (o) {
    o = o || {};
    var fb = h('div', { class: 'think-card__fb', hidden: true, 'aria-live': 'polite' });
    var choices = null;
    if (o.choices && o.choices.length) {
      var bs = [];
      choices = h('div', { class: 'think-card__choices' }, o.choices.map(function (c, i) {
        var b = btn([h('span', { class: 'think-card__mark' }, circ(i + 1)), h('span', { class: 'think-card__txt' }, rich(c))], 'think-card__opt', function () {
          bs.forEach(function (x) { x.classList.remove('is-right', 'is-wrong'); x.setAttribute('aria-pressed', 'false'); });
          b.setAttribute('aria-pressed', 'true');
          fb.hidden = false; fb.innerHTML = '';
          if (!o.answer) { fb.appendChild(h('p', { text: '고른 답: ' + plain(c) + ' — 친구와 이유를 이야기해 봐요.' })); if (o.why) fb.appendChild(h('p', { class: 'think-card__why' }, rich(o.why))); return; }
          var hit = i + 1 === o.answer;
          b.classList.add(hit ? 'is-right' : 'is-wrong');
          if (!hit) bs[o.answer - 1].classList.add('is-right');
          fb.className = 'think-card__fb ' + (hit ? 'is-hit' : 'is-miss');
          fb.appendChild(SK.iconify(h('p', { class: 'think-card__res' }, hit ? '✓ 맞았어요' : ['✗ 아니에요. 답은 ', h('b', { text: plain(o.choices[o.answer - 1]) })])));
          if (o.why) fb.appendChild(h('p', { class: 'think-card__why' }, [h('b', { text: '이유 ' })].concat(rich(o.why))));
        });
        bs.push(b);
        return b;
      }));
    }
    var hintEl = null;
    if (o.hint) {
      var fold = o.hintFold !== undefined ? o.hintFold : !(o.choices && o.choices.length);
      hintEl = fold
        ? h('details', { class: 'think-card__hintbox' }, [h('summary', { text: '힌트 보기' }), h('p', { class: 'think-card__hint' }, rich(o.hint))])
        : h('p', { class: 'think-card__hint' }, rich(o.hint));
    }
    var noEl = h('span', { class: 'think-card__no', text: '질문' });
    var card = h('div', { class: 'think-card', 'data-think': o.id || null }, [
      noEl,
      h('p', { class: 'think-card__q' }, rich(o.q || '')),
      hintEl, choices, fb
    ]);
    card._think = { id: o.id || null, when: typeof o.when === 'function' ? o.when : null, no: noEl };
    if (o.reveal) SK.reveal(card, o.reveal);
    (o.where ? resolveWhere(o.where) : SK.el.thinkList).appendChild(card);
    if (!o.where) thinks.push(card);
    refreshThinks();
    if (SK.stepIndex === 3 && !sideUser) setSide(autoSide(), false);
    return card;
  };
  SK.think.remove = function (idOrEl) {
    for (var i = thinks.length - 1; i >= 0; i--) {
      var c = thinks[i];
      if (c === idOrEl || (c._think && c._think.id === idOrEl)) { c.remove(); thinks.splice(i, 1); }
    }
    refreshThinks();
    if (SK.stepIndex === 3 && !sideUser) setSide(autoSide(), false);
  };
  /** R2(D4): when() 으로 모드별 숨김 + 보이는 것만 '질문 1·2·3' 번호 */
  function refreshThinks() {
    var n = 0;
    thinks.forEach(function (c) {
      var m = c._think || {}, show = true;
      if (m.when) { try { show = !!m.when(SK.params); } catch (e) { show = true; } }
      c.hidden = !show;
      if (show) { n++; if (m.no) m.no.textContent = '질문 ' + n; }
    });
    return n;
  }
  function visibleThinks() { var n = 0; thinks.forEach(function (c) { if (!c.hidden) n++; }); return n; }
  SK.refreshThinks = function () { refreshThinks(); if (SK.stepIndex === 3 && !sideUser) setSide(autoSide(), false); };

  /** 빈 상태 한 줄: '▶ 실행하면 여기에 ○○이 나와요' → {el, show(bool)} */
  SK.empty = function (container, what) {
    var host = resolveWhere(container);
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    var el = h('p', { class: 'empty' }, SK.iconify(h('span', { text: '▶ 실행하면 여기에 ' + what + josa(what, '이', '가') + ' 나와요' })));   // R4: .empty 는 grid — 아이콘+글을 한 줄(span)로
    host.appendChild(el);
    return { el: el, show: function (on) { el.hidden = !on; } };
  };

  /**
   * A18: 캔버스 라벨 겹침 피하기. items = [{x, y, text, anchor:'left'|'center'|'right', color, font, bg:false}]
   * 겹치면 위/아래로 8u 씩 밀고, 종이색 반투명 칩(--color-paper-label, 모서리 4u, 패딩 2u 6u)을 깔아 그린다. 반환: 그려진 상자 목록
   * 항목 옵션(R3): leaderColor('--색 토큰' — 보조선 색, 기본 line-strong), radius(모서리, 기본 4)
   * R4: text 에 $v_0$ 수식 표기 가능(SK.text 규칙). 굵기 기본 500(weight 로 바꿈), 글꼴은 에스코어.
   */
  SK.placeLabel = function (ctx, items, opts) {
    opts = opts || {};
    var placed = (opts.avoid || []).slice(), out = [];
    var padX = 6, padY = 2;   // R3 규칙 12: 패딩 2u 6u · 모서리 4u · 바탕 --color-paper-label
    (items || []).forEach(function (it) {
      if (!it || !it.text) return;
      ctx.save();
      var size = it.size || opts.size || 22;
      var to = { size: size, weight: it.weight || opts.weight || 500, font: it.font || opts.font || null };
      var w = SK.measure(ctx, it.text, to).w + padX * 2, hgt = size * 1.2 + padY * 2;
      var a = it.anchor || 'center';
      var x0 = a === 'left' ? it.x : a === 'right' ? it.x - w : it.x - w / 2;
      var y0 = it.y - hgt / 2, dy = 0, tries = 0;
      function hit(y) {
        for (var i = 0; i < placed.length; i++) { var p = placed[i]; if (x0 < p.x + p.w && x0 + w > p.x && y < p.y + p.h && y + hgt > p.y) return true; }
        return false;
      }
      while (hit(y0 + dy) && tries < 24) { tries++; dy = (tries % 2 ? -1 : 1) * Math.ceil(tries / 2) * 8; }
      var box = { x: x0, y: y0 + dy, w: w, h: hgt };
      placed.push(box); out.push(box);
      if (Math.abs(dy) > 12 && it.leader !== false) {
        ctx.strokeStyle = it.leaderColor ? SK.color(it.leaderColor) : SK.color('--color-line-strong'); ctx.lineWidth = 1; ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(it.x, it.y); ctx.lineTo(it.x, dy < 0 ? box.y + box.h : box.y); ctx.stroke();
      }
      if (it.bg !== false) {
        ctx.fillStyle = SK.color('--color-paper-label') || 'rgba(251,248,239,0.85)';
        var r = it.radius !== undefined ? it.radius : (opts.radius !== undefined ? opts.radius : 4); ctx.beginPath();
        ctx.moveTo(box.x + r, box.y); ctx.arcTo(box.x + w, box.y, box.x + w, box.y + hgt, r); ctx.arcTo(box.x + w, box.y + hgt, box.x, box.y + hgt, r);
        ctx.arcTo(box.x, box.y + hgt, box.x, box.y, r); ctx.arcTo(box.x, box.y, box.x + w, box.y, r); ctx.closePath(); ctx.fill();
      }
      to.color = it.color || '--color-ink'; to.baseline = 'middle';
      SK.text(ctx, it.text, box.x + padX, box.y + hgt / 2, to);
      ctx.restore();
    });
    return out;
  };

  /* ------------------------------------------------------------------
     12. 그리기: HiDPI 캔버스 · 화살표 · 계기판 · 그래프
     ------------------------------------------------------------------ */
  SK.canvas = function (container, o) {
    o = o || {};
    var cv = h('canvas', { class: o.className || null });
    if (!o.className) cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    container.insertBefore(cv, container.firstChild);
    var ctx = cv.getContext('2d');
    var view = {
      canvas: cv, ctx: ctx, w: o.w || 1250, h: o.h || 700, fit: o.fit !== false, grow: o.grow !== false,
      scale: 1, ox: 0, oy: 0, dpr: 1, onResize: null,
      // R4: 세로 여유 — hFull = 캔버스 논리 높이 전체, extra = hFull − h (16:9 = 0), offsetY = sim 이 onResize 에서 정하는 아래로 밀기
      hFull: o.h || 700, wFull: o.w || 1250, extra: 0, offsetY: 0,
      bg: o.bg === undefined ? '--color-paper-raised' : o.bg
    };
    function resize() {
      var r = container.getBoundingClientRect();
      var cw = Math.max(1, r.width), ch = Math.max(1, r.height);
      var dpr = Math.min(window.devicePixelRatio || 1, 3);
      cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
      view.dpr = dpr;
      view.offsetY = 0;
      if (view.fit) {
        // 축척은 예전 그대로(min). R4: 위에 붙이고(oy 0) 남는 세로는 extra 로 — grow:false 면 예전처럼 가운데
        var s = Math.min(cw / view.w, ch / view.h);
        view.scale = s; view.ox = (cw - view.w * s) / 2;
        view.wFull = cw / s; view.hFull = ch / s;
        if (view.grow) { view.oy = 0; view.extra = Math.max(0, view.hFull - view.h); }
        else { view.oy = (ch - view.h * s) / 2; view.extra = 0; }
      } else {
        var u = SK.px(1) || 1;
        view.scale = u; view.ox = 0; view.oy = 0; view.w = cw / u; view.h = ch / u;
        view.wFull = view.w; view.hFull = view.h; view.extra = 0;
      }
      dirty = true;
      setTf();
      if (view.onResize) view.onResize(view);
      setTf();   // onResize 가 offsetY 를 정했으면 반영
    }
    function setTf() {
      var s = view.scale, d = view.dpr;
      ctx.setTransform(d * s, 0, 0, d * s, d * view.ox, d * (view.oy + (view.offsetY || 0) * s));
    }
    view.resize = resize;
    view.clear = function () {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (view.bg) { ctx.fillStyle = SK.color(view.bg); ctx.fillRect(0, 0, cv.width, cv.height); }
      else ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.restore();
      setTf();   // R4: offsetY 만큼 아래로 (논리 단위)
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    };
    view.toLogical = function (e) {
      var r = cv.getBoundingClientRect();
      return { x: (e.clientX - r.left - view.ox) / view.scale, y: (e.clientY - r.top - view.oy) / view.scale - (view.offsetY || 0) };
    };
    /** R4: 논리 좌표 → 캔버스 상자 기준 CSS px (무대 위 HTML 조각 배치용) */
    view.toPx = function (x, y) { return { x: view.ox + x * view.scale, y: view.oy + (y + (view.offsetY || 0)) * view.scale }; };
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe(container);
    else window.addEventListener('resize', resize);
    resize();
    return view;
  };

  SK.arrow = function (ctx, x1, y1, x2, y2, o) {
    o = o || {};
    var dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.5) return;
    var w = o.width || 5, head = Math.min(o.head || w * 3.6, len * 0.6);
    var ux = dx / len, uy = dy / len;
    var col = SK.color(o.color || '--color-q-velocity');
    ctx.save();
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.setLineDash(o.dash || []);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - ux * head * 0.8, y2 - uy * head * 0.8); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - ux * head - uy * head * 0.55, y2 - uy * head + ux * head * 0.55);
    ctx.lineTo(x2 - ux * head + uy * head * 0.55, y2 - uy * head - ux * head * 0.55);
    ctx.closePath(); ctx.fill();
    if (o.label) {   // R4: SK.text — '$v_x$' 수식 표기 가능, 굵기 500
      SK.text(ctx, o.label, x2 + ux * 10 + 6, y2 + uy * 10, { size: o.fontSize || 24, weight: o.labelWeight || 500, color: o.labelColor || o.color || '--color-ink', baseline: 'middle', bg: o.labelBg || false, halo: o.labelHalo || null });
    }
    ctx.restore();
  };

  /**
   * R5: 치수선 — 양끝 채운 삼각 화살촉 + 가운데 라벨. 글자 화살표(←→)·'(그림은 줄임)' 대신.
   * SK.dim(ctx, x1, y1, x2, y2, {label:'$d$ = 0.25 mm', size:22, head:10, lw:2, color:'--color-ink-muted',
   *        bg:true, gap:6, side:'auto'|'above'|'below'|'left'|'right', ends:0(끝 눈금 반길이), labelColor, weight})
   * 라벨 기본 자리: 가로에 가까운 선은 위, 세로에 가까운 선은 오른쪽. 반환: 라벨 상자 {x,y,w,h} 또는 null
   */
  SK.dim = function (ctx, x1, y1, x2, y2, o) {
    o = o || {};
    var dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.5) return null;
    var ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    var head = Math.min(o.head || 10, len / 2.2), lw = o.lw || 2, col = SK.color(o.color || '--color-ink-muted');
    ctx.save();
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'butt'; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(x1 + ux * head * 0.9, y1 + uy * head * 0.9); ctx.lineTo(x2 - ux * head * 0.9, y2 - uy * head * 0.9); ctx.stroke();
    function tri(px, py, sx, sy) {   // (px,py) 끝점, (sx,sy) 바깥 방향
      ctx.beginPath(); ctx.moveTo(px, py);
      ctx.lineTo(px - sx * head + nx * head * 0.45, py - sy * head + ny * head * 0.45);
      ctx.lineTo(px - sx * head - nx * head * 0.45, py - sy * head - ny * head * 0.45);
      ctx.closePath(); ctx.fill();
    }
    tri(x1, y1, -ux, -uy); tri(x2, y2, ux, uy);
    if (o.ends) {
      ctx.lineWidth = Math.max(1, lw * 0.75); ctx.beginPath();
      ctx.moveTo(x1 - nx * o.ends, y1 - ny * o.ends); ctx.lineTo(x1 + nx * o.ends, y1 + ny * o.ends);
      ctx.moveTo(x2 - nx * o.ends, y2 - ny * o.ends); ctx.lineTo(x2 + nx * o.ends, y2 + ny * o.ends);
      ctx.stroke();
    }
    var box = null;
    if (o.label) {
      var size = o.size || 22, gap = o.gap !== undefined ? o.gap : 6, mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      var side = o.side || 'auto';
      if (side === 'auto') side = Math.abs(dx) >= Math.abs(dy) ? 'above' : 'right';
      var to = { size: size, weight: o.weight || 500, color: o.labelColor || o.color || '--color-ink-muted', baseline: 'middle', bg: o.bg === false ? false : (o.bg || true) };
      var tx = mx, ty = my, al = 'center';
      if (side === 'above') ty = my - gap - size * 0.6;
      else if (side === 'below') ty = my + gap + size * 0.6;
      else if (side === 'right') { tx = mx + gap + 6; al = 'left'; }
      else if (side === 'left') { tx = mx - gap - 6; al = 'right'; }
      to.align = al;
      SK.text.lastBox = null;
      SK.text(ctx, o.label, tx, ty, to);
      box = SK.text.lastBox || null;
    }
    ctx.restore();
    return box;
  };

  /**
   * R5: 가로선 분수 — 'λL ÷ d' 대신. 분자·분모는 SK.text($…$ 가능), 크기 0.85배, 가로선 굵기 lw(기본 2).
   * SK.frac(ctx, '$\\lambda L$', '$d$', x, y, {size:22, align:'left'|'center'|'right', color, weight, lw, pad:4})
   * y = 가로선 높이(글줄 가운데). 반환: 전체 폭(다음 글자를 이어 그릴 때 x += 폭)
   */
  SK.frac = function (ctx, num, den, x, y, o) {
    o = o || {};
    var size = (o.size || 22) * 0.85, pad = o.pad !== undefined ? o.pad : 4;
    var to = { size: size, weight: o.weight || 500, color: o.color || '--color-ink', baseline: 'middle', align: 'center' };
    var wn = SK.measure(ctx, num, to).w, wd = SK.measure(ctx, den, to).w;
    var w = Math.max(wn, wd) + pad * 2;
    var x0 = o.align === 'center' ? x - w / 2 : (o.align === 'right' || o.align === 'end') ? x - w : x;
    var cx = x0 + w / 2, gap = size * 0.62;
    ctx.save();
    SK.text(ctx, num, cx, y - gap, to);
    SK.text(ctx, den, cx, y + gap, to);
    ctx.strokeStyle = SK.color(o.color || '--color-ink'); ctx.lineWidth = o.lw || 2; ctx.lineCap = 'butt'; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(x0 + 1, y); ctx.lineTo(x0 + w - 1, y); ctx.stroke();
    ctx.restore();
    return w;
  };

  /**
   * R5: 개발용 감사 — 콘솔에서 SimKit.audit.smallText() (기본 22) 를 부르면 다음 두 프레임 동안 캔버스에 그린 글자 중
   * 크기(논리 단위)가 기준 미만인 것을 자리(파일:줄)별로 console.table 로 보여 준다. 반환 Promise<목록>.
   * SK.text 는 본 크기로 판정(수식 아래·위첨자 0.7배는 안 잡힘), ctx.fillText 를 직접 쓴 곳은 ctx.font 의 px 로 판정.
   */
  var auditOn = null;
  function auditWhere() {
    var st = String((new Error()).stack || '').split('\n');
    for (var i = 1; i < st.length; i++) {
      var ln = st[i];
      if (/shared[\/\\]sim\.js/.test(ln) || /^Error/.test(ln)) continue;
      var m = /((?:sims|shared)[\/\\][^\s)]*)/.exec(ln);
      return m ? m[1] : ln.trim();
    }
    return '(shared/sim.js)';
  }
  function auditNote(size, text) {
    if (!auditOn || !(size < auditOn.min)) return;
    var where = auditWhere(), k = where + '|' + size;
    if (!auditOn.rows[k]) auditOn.rows[k] = { where: where, size: Math.round(size * 10) / 10, text: String(text).slice(0, 28), count: 0 };
    auditOn.rows[k].count++;
  }
  SK.audit = {
    smallText: function (min) {
      if (auditOn) return Promise.resolve([]);
      var proto = global.CanvasRenderingContext2D && global.CanvasRenderingContext2D.prototype;
      if (!proto) return Promise.resolve([]);
      auditOn = { min: min || 22, rows: {}, depth: 0 };
      var origFill = proto.fillText, origText = SK.text;
      SK.text = function (ctx, str, x, y, o) {
        auditNote((o && o.size) || 22, str);
        auditOn.depth++;
        try { return origText.apply(this, arguments); } finally { auditOn.depth--; }
      };
      for (var k in origText) if (Object.prototype.hasOwnProperty.call(origText, k)) SK.text[k] = origText[k];
      proto.fillText = function (t) {
        if (auditOn && !auditOn.depth) { var m = /(\d+(?:\.\d+)?)px/.exec(this.font || ''); if (m) auditNote(+m[1], t); }
        return origFill.apply(this, arguments);
      };
      dirty = true; SK.redraw();
      return new Promise(function (res) {
        requestAnimationFrame(function () { requestAnimationFrame(function () {
          proto.fillText = origFill; SK.text = origText;
          var list = []; for (var key in auditOn.rows) list.push(auditOn.rows[key]);
          auditOn = null;
          list.sort(function (a, b) { return a.size - b.size; });
          if (console.table) console.table(list); else console.log(list);
          res(list);
        }); });
      });
    }
  };

  /** 계기판. items: [{key,label('{{용어}}' 가능),symbol,unit,decimals,q,hidden,size}] */
  SK.meters = function (where, items) {
    var host = resolveWhere(where || SK.el.meters);
    var wrap = h('div', { class: 'meters' });
    var cells = {};
    items.forEach(function (it) {
      var val = h('span', { class: 'num', text: '–' });
      var lab = rich(it.label || '');
      if (it.symbol) { lab.push(' '); if (/[_^$]/.test(it.symbol)) lab.push.apply(lab, symNodes(it.symbol)); else lab.push(h('i', { text: it.symbol })); }   // R4: 'v_y'·'$v_y$' 도
      var card = h('div', { class: 'meter' + (it.hidden ? ' is-hidden-value' : ''), 'data-q': it.q || null, 'data-key': it.key }, [
        h('span', { class: 'meter__label' }, lab),
        h('span', { class: 'meter__value' + (it.size === 'md' ? ' meter__value--md' : '') }, [val, h('span', { class: 'meter__unit', 'data-unit': it.unit || null, text: it.unit || '' })])
      ]);
      // R6: simpleOnly:true 는 일반 계기판에 그리지 않고 심플 측정 칸에서만 보인다(값은 같은 set 으로)
      if (!it.simpleOnly) wrap.appendChild(card);
      cells[it.key] = registerMeter(it, val);
    });
    host.appendChild(wrap);
    var api = {
      el: wrap,
      set: function (key, v) {
        var c = cells[key]; if (!c) return;
        c.set(v);   // R6: 같은 key 의 심플 측정 칸도 함께
      },
      update: function (obj) { for (var k in obj) api.set(k, obj[k]); }
    };
    return api;
  };

  function niceStep(span, n) {
    var raw = span / Math.max(1, n), p = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), f = raw / p;
    return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
  }
  /**
   * 실시간 선 그래프. o = {title, x, y, series, ghost, records, empty:'높이 그래프'}
   * 그릴 선이 하나도 없으면 '▶ 실행하면 여기에 ○○이 나와요' 한 줄을 보인다.
   */
  SK.graph = function (where, o) {
    o = o || {};
    var host = resolveWhere(where || SK.el.graph);
    var series = o.series || [{ key: 'y', label: o.y && o.y.label, color: '--color-primary' }];
    var legend = h('span', { class: 'graph-box__legend' });
    if (series.length > 1) series.forEach(function (s) {
      legend.appendChild(h('span', null, [swatchSVG({ color: SK.color(s.color || '--color-primary'), dash: s.dash || [], width: 4 })].concat(rich(s.label || s.key))));
    });
    var area = h('div', { class: 'graph-box__canvas' });
    var what = o.empty || (o.title ? o.title + ' 그래프' : '그래프');
    var emptyEl = h('p', { class: 'empty' }, SK.iconify(h('span', { text: '▶ 실행하면 여기에 ' + what + josa(what, '이', '가') + ' 나와요' })));
    var axisTxt = h('span', { class: 'graph-box__axes' });
    var box = h('div', { class: 'graph-box' }, [h('div', { class: 'graph-box__title' }, [o.title || '', axisTxt, legend]), area]);
    function axisName(a) { return a && a.label ? a.label + (a.unit ? '(' + a.unit + ')' : '') : ''; }
    function showAxes() { setText(axisTxt, view.h < 100 && (X.label || Y.label) ? '세로 ' + axisName(Y) + ' · 가로 ' + axisName(X) : ''); }
    area.appendChild(emptyEl);
    host.appendChild(box);
    var view = SK.canvas(area, { fit: false, bg: '--color-paper-raised' });
    var current = {};
    var X = o.x || {}, Y = o.y || {};

    function eachLine(fn) {
      if (o.records !== false) SK.records.forEach(function (r) {
        series.forEach(function (s) { if (r.series[s.key]) fn(r.series[s.key], SK.recStyle(r.slot), s); });
      });
      if (o.ghost !== false && SK.ghost) series.forEach(function (s) { if (SK.ghost.series[s.key]) fn(SK.ghost.series[s.key], SK.ghostStyle(), s); });
      series.forEach(function (s) {
        if (current[s.key]) fn(current[s.key], { color: SK.color(s.color || '--color-primary'), dash: s.dash || [], width: 4 }, s);
      });
    }
    function range(axis, idx) {
      var lo = axis.min, hi = axis.max;
      if (lo === undefined || lo === 'auto' || hi === undefined || hi === 'auto') {
        var a = Infinity, b = -Infinity;
        eachLine(function (pts) { for (var i = 0; i < pts.length; i++) { var v = pts[i][idx]; if (v < a) a = v; if (v > b) b = v; } });
        if (!isFinite(a)) { a = 0; b = 1; }
        if (lo === undefined || lo === 'auto') lo = Math.min(a, 0);
        if (hi === undefined || hi === 'auto') hi = b;
        if (hi - lo < 1e-9) hi = lo + 1;
        var st = niceStep(hi - lo, 4);
        if (axis.min === undefined || axis.min === 'auto') lo = Math.floor(lo / st) * st;
        if (axis.max === undefined || axis.max === 'auto') hi = Math.ceil(hi / st) * st;
      }
      return [lo, hi];
    }
    function draw(cur) {
      if (cur !== undefined) current = Array.isArray(cur) ? (function () { var m = {}; m[series[0].key] = cur; return m; })() : (cur || {});
      var any = false;
      eachLine(function (pts) { if (pts && pts.length > 1) any = true; });
      emptyEl.hidden = any || o.empty === false;
      var ctx = view.ctx, W = view.w, H = view.h;
      view.clear();
      var small = H < 100;   // 하단 띠(88u) 안 작은 그래프: 축 이름은 제목 줄로, 여백 줄임
      var fs = 22, padL = small ? 52 : 70, padB = small ? 26 : 34, padT = small ? 4 : 8, padR = 12;   // R2: 캔버스 글자 22u 이상
      var xr = range(X, 0), yr = range(Y, 1);
      var pw = W - padL - padR, ph = H - padT - padB;
      if (pw < 10 || ph < 10) return;
      function mx(x) { return padL + (x - xr[0]) / (xr[1] - xr[0]) * pw; }
      function my(y) { return padT + ph - (y - yr[0]) / (yr[1] - yr[0]) * ph; }
      ctx.font = SK.font(400, fs);   // R4: 눈금 숫자 에스코어 400
      ctx.lineWidth = 1; ctx.setLineDash([]);
      var xs = niceStep(xr[1] - xr[0], Math.max(2, Math.floor(pw / 110)));
      var ys = niceStep(yr[1] - yr[0], Math.max(1, Math.floor(ph / 34)));
      ctx.strokeStyle = SK.color('--color-grid'); ctx.fillStyle = SK.color('--color-ink-muted');
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      var dx = Math.max(0, -Math.floor(Math.log(xs) / Math.LN10)), dy = Math.max(0, -Math.floor(Math.log(ys) / Math.LN10));
      for (var x = Math.ceil(xr[0] / xs) * xs; x <= xr[1] + xs * 1e-6; x += xs) {
        ctx.beginPath(); ctx.moveTo(mx(x), padT); ctx.lineTo(mx(x), padT + ph); ctx.stroke();
        ctx.fillText(fmt(x, dx), mx(x), padT + ph + 4);
      }
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      var lastLab = null;
      for (var y = yr[1] - ((yr[1] % ys) + ys) % ys; y >= yr[0] - ys * 1e-6; y -= ys) {   // 위에서부터: 글자끼리 겹치면 건너뜀
        ctx.beginPath(); ctx.moveTo(padL, my(y)); ctx.lineTo(padL + pw, my(y)); ctx.stroke();
        if (lastLab === null || Math.abs(my(y) - lastLab) >= fs + 2) { ctx.fillText(fmt(y, dy), padL - 6, my(y)); lastLab = my(y); }
      }
      ctx.strokeStyle = SK.color('--color-line-strong'); ctx.lineWidth = 2;
      var y0 = (yr[0] <= 0 && yr[1] >= 0) ? my(0) : padT + ph;
      ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + ph); ctx.moveTo(padL, y0); ctx.lineTo(padL + pw, y0); ctx.stroke();
      if (!small) {   // R4: 축 이름 SK.text (500, $…$ 수식 가능)
        var axo = { size: fs, weight: 500, color: '--color-ink' };
        if (X.label) SK.text(ctx, X.label + (X.unit ? ' (' + X.unit + ')' : ''), padL + pw, padT + ph - 4, { size: fs, weight: 500, color: '--color-ink', align: 'right', baseline: 'bottom' });
        ctx.save(); ctx.translate(14, padT + ph / 2); ctx.rotate(-Math.PI / 2);
        axo.align = 'center'; axo.baseline = 'middle';
        if (Y.label) SK.text(ctx, Y.label + (Y.unit ? ' (' + Y.unit + ')' : ''), 0, 0, axo);
        ctx.restore();
      }
      ctx.save(); ctx.beginPath(); ctx.rect(padL, padT - 2, pw + 2, ph + 4); ctx.clip();
      eachLine(function (pts, st) { SK.drawPath(ctx, pts, { color: st.color, dash: st.dash, width: Math.max(2, st.width * 0.7) }, function (a, b) { return [mx(a), my(b)]; }); });
      ctx.restore();
    }
    view.onResize = function () { showAxes(); draw(); };
    SK.onRecords(function () { draw(); });
    redrawHooks.push(function () { draw(); });   // R4: 글꼴이 늦게 오면 다시
    draw({});
    showAxes();
    return { el: box, view: view, draw: draw, setAxis: function (ax, v) { if (ax === 'x') X = v; else Y = v; showAxes(); draw(); } };
  };

  /* ------------------------------------------------------------------
     13. 펼침 메뉴 · 수업 정보 · 키 · 교사 모드 · 커서 · 확대 금지 · 전체 화면
     ------------------------------------------------------------------ */
  function togglePop(menu) {
    if (openPop === menu) { closePop(); return; }
    closePop();
    menu.hidden = false; openPop = menu;
  }
  function closePop() {
    if (openPop) { openPop.hidden = true; openPop = null; }
    if (SK.el.infoPop && !SK.el.infoPop.hidden) { SK.el.infoPop.hidden = true; SK.el.infoBtn.setAttribute('aria-expanded', 'false'); }
  }
  function toggleInfo() {
    var p = SK.el.infoPop, was = !p.hidden;
    closePop();
    if (!was) { p.hidden = false; SK.el.infoBtn.setAttribute('aria-expanded', 'true'); }
  }
  function buildMoreMenu() {
    var m = SK.el.moreMenu; m.innerHTML = '';
    function item(label, fn, cls) {
      var b = h('button', { type: 'button', role: 'menuitem', class: cls || null }, label);
      b.addEventListener('click', function () { closePop(); fn(); });
      m.appendChild(b);
    }
    // R2(B2): 기록 모두 지우기 · 전체 화면 · 도움말 · 교사 모드 (+ 조작판 접기)
    // R3: 지우는 항목은 맨 아래 구분선 밑으로
    item('전체 화면 켜기 / 끄기', function () { SK.toggleFullscreen(); });
    item('도움말 열기', function () { SK.toggleHelp(true); });
    item(SK.isTeacher() ? '교사 모드 끄기' : '교사 모드 켜기', function () { SK.toggleTeacher(); });
    item(SK.el.slide.classList.contains('is-collapsed') ? '조작판 다시 펴기' : '조작판 접기 (실험 화면 크게)', function () { SK.toggleCollapse(); });
    m.appendChild(h('hr'));
    item('기록 모두 지우기…', function () { SK.clearRecords(); }, 'is-danger');
  }
  document.addEventListener('pointerdown', function (e) {
    if (!openPop && (!SK.el.infoPop || SK.el.infoPop.hidden)) return;
    var t = e.target;
    if (t.closest && (t.closest('.pop-wrap') || t.closest('.sim-top__tools'))) return;
    closePop();
  }, true);

  SK.onKey = function (fn) { keyHandlers.push(fn); };

  function isTyping(t) {
    if (!t || !t.tagName) return false;
    if (t.isContentEditable) return true;
    var tag = t.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (tag === 'INPUT') {
      var ty = (t.type || 'text').toLowerCase();
      return ['range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'color'].indexOf(ty) < 0;
    }
    return false;
  }
  SK.toggleFullscreen = function () {
    var d = document, el = d.documentElement;
    var fs = d.fullscreenElement || d.webkitFullscreenElement;
    try {
      if (!fs) { (el.requestFullscreen || el.webkitRequestFullscreen).call(el); }
      else { (d.exitFullscreen || d.webkitExitFullscreen).call(d); }
    } catch (e) { SK.notice('이 브라우저는 전체 화면을 지원하지 않아요', 'info'); }
  };
  /** A13: 교사 모드 — URL ?teacher=1 또는 H 를 3초 동안 누르기 */
  function setTeacher(on, quiet) {
    var html = document.documentElement;
    if (on) loadAutoPredict();
    html.classList.toggle('is-teacher', on);
    html.classList.toggle('teacher', on);          // 예전 이름 호환 (convex-lens.css 의 html.teacher)
    if (!on && drawerEl) drawerEl.hidden = true;
    if (!quiet) SK.notice(on ? '교사 모드를 켰어요' : '교사 모드를 껐어요', 'info');
    dirty = true;
    if (cfg.onTeacher) cfg.onTeacher(on);
    if (SK.update && SK.el.status) { SK.el.status._sig = null; SK.update(); }
  }
  SK.toggleTeacher = function () { setTeacher(!SK.isTeacher()); };
  SK.setTeacher = function (on) { setTeacher(!!on); };
  SK.isTeacher = function () { return document.documentElement.classList.contains('is-teacher'); };
  SK.toggleCollapse = function () {
    if (simpleOn) { SK.notice('심플 모드는 이미 실험 화면이 커요', 'info'); return; }   // R6
    var on = SK.el.slide.classList.toggle('is-collapsed');
    SK.notice(on ? '조작판을 접었어요 — T 키로 다시 펴요' : '조작판을 폈어요', 'info');
    if (on) SK.say('조작판을 접었어요. 그 밖의 기능 메뉴나 T 키로 다시 펴요', 5000);
    dirty = true;
  };

  var hDown = 0, hDone = false;
  function installKeys() {
    document.addEventListener('keyup', function (e) { if (e.code === 'KeyH') { hDown = 0; hDone = false; } });
    document.addEventListener('keydown', function (e) {
      var code = e.code;
      if (code === 'KeyH' && !isTyping(e.target) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        var now = Date.now();
        if (!e.repeat || !hDown) { hDown = now; hDone = false; }
        else if (!hDone && now - hDown >= 3000) { hDone = true; SK.toggleTeacher(); }
        e.preventDefault();
        return;
      }
      if (modal) {
        if (modal.onKey(e)) { e.preventDefault(); return; }
        if (code === 'KeyF' && !isTyping(e.target)) { e.preventDefault(); SK.toggleFullscreen(); }
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var t = e.target;
      if (isTyping(t)) return;
      for (var i = 0; i < keyHandlers.length; i++) { if (keyHandlers[i](e) === true) { e.preventDefault(); return; } }
      var isRange = t && t.tagName === 'INPUT' && t.type === 'range';
      if (isRange && /^(Arrow|Page|Home|End)/.test(code)) return;
      var isBtn = t && (t.tagName === 'BUTTON' || t.tagName === 'SUMMARY' || t.tagName === 'A');
      if (isBtn && (code === 'Space' || code === 'Enter' || code === 'NumpadEnter')) return;
      if (e.key === '?' || (code === 'Slash' && e.shiftKey)) { e.preventDefault(); SK.toggleHelp(); return; }

      var m = /^(?:Digit|Numpad)([1-9])$/.exec(code);
      if (m) {
        var n = +m[1];
        if (n <= 5 && !e.repeat) {
          e.preventDefault();
          // R6(팀장): 심플에서는 '실험 ▾' 시트에 있는 카드만 숫자 키로 고른다(시트에 없는 카드는 자세히 모드에서)
          if (simpleOn && presets[n - 1] && simplePresetList().indexOf(n - 1) < 0) SK.notice(n + '번 카드는 자세히 모드에서 골라요', 'info');
          else if (presets[n - 1]) SK.applyPreset(n - 1, { noConfirm: simpleOn });
          else SK.notice(n + '번 실험 카드는 없어요', 'info');
        }
        return;
      }
      var handled = true;
      switch (code) {
        case 'KeyF': if (!e.repeat) SK.toggleFullscreen(); break;
        case 'ArrowRight': case 'PageDown': SK.nextStep(); break;
        case 'ArrowLeft': case 'PageUp': SK.prevStep(); break;
        case 'Space': if (!e.repeat) SK.toggle(); break;
        case 'KeyR': if (!e.repeat) resetTwoStep('key'); break;   // R6(S15): 두 번 눌러 되돌리기
        case 'KeyM': if (!simpleCfg) { handled = false; break; } if (!e.repeat) SK.setSimple(!simpleOn, { save: true }); break;   // R6: 심플 ↔ 자세히
        case 'KeyS': if (!e.repeat) SK.record(); break;
        case 'KeyC': if (!e.repeat) SK.clearRecords(); break;
        case 'Comma': SK.stepFrame(-1); break;
        case 'Period': SK.stepFrame(1); break;
        case 'BracketLeft': cycleSpeed(-1); break;
        case 'BracketRight': cycleSpeed(1); break;
        case 'KeyT': if (!e.repeat) SK.toggleCollapse(); break;
        case 'Escape': handleEsc(); break;
        default: handled = false;
      }
      if (handled) e.preventDefault();
    });
  }
  function handleEsc() {
    if (openPop || (SK.el.infoPop && !SK.el.infoPop.hidden)) { closePop(); return; }
    if (openSheet) { closeSheets(); return; }   // R6: 열린 시트 먼저
    if (recFullEl) { SK.showRecordsFull(false); return; }
    if (helpEl && !helpEl.hidden) { SK.toggleHelp(false); return; }
    if (drawerEl && !drawerEl.hidden) { SK.toggleGuide(false); return; }
    if (tipEl && !tipEl.hidden) { tipEl.hidden = true; return; }
    if (document.activeElement && document.activeElement !== document.body) { document.activeElement.blur(); }
    var now = Date.now();
    if (now - lastEsc < 1500) { location.href = cfg.hubHref; return; }
    lastEsc = now;
    SK.notice('Esc 를 한 번 더 누르면 허브로 가요', 'info', 1500);
  }

  function installCursorHide() {
    var html = document.documentElement, timer = 0;
    var wait = msVar('--dur-cursor-hide', 3000);
    function show() {
      html.classList.remove('cursor-hidden');
      clearTimeout(timer);
      timer = setTimeout(function () { html.classList.add('cursor-hidden'); }, wait);
    }
    document.addEventListener('mousemove', show, { passive: true });
    document.addEventListener('pointerdown', show, { passive: true });
    document.addEventListener('keydown', function (e) { if (!isTyping(e.target)) html.classList.add('cursor-hidden'); });
    show();
  }
  function installNoZoom() {
    document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
    document.addEventListener('wheel', function (e) { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
    document.addEventListener('touchmove', function (e) { if (e.touches && e.touches.length > 1) e.preventDefault(); }, { passive: false });
  }

  /**
   * R2(G6): 실험 화면의 모서리 칩(상태 칩·카드 칩·보기 범위 버튼)이 위·아래에서 차지하는 높이.
   * 반환 {top, bottom} 은 캔버스 논리 단위(view 좌표). 라벨·궤적을 이 띠 밖으로 두면 칩과 겹치지 않는다.
   */
  SK.stageInset = function () {
    var st = SK.el.stage; if (!st) return { top: 0, bottom: 0 };
    var sr = st.getBoundingClientRect(), top = 0, bottom = 0;
    [SK.el.cornerTL, SK.el.cornerTR].forEach(function (c) {
      if (!c || !c.offsetHeight) return;
      var r = c.getBoundingClientRect(); top = Math.max(top, r.bottom - sr.top);
    });
    [SK.el.cornerBL, SK.el.cornerBR].forEach(function (c) {
      if (!c || !c.offsetHeight) return;
      var r = c.getBoundingClientRect(); bottom = Math.max(bottom, sr.bottom - r.top);
    });
    var s = (SK.view && SK.view.scale) || 1, oy = (SK.view && SK.view.oy) || 0;
    var res = { top: Math.max(0, (top - oy) / s), bottom: Math.max(0, (bottom - oy) / s), px: { top: top, bottom: bottom } };
    // R4: offsetY 를 반영한 그리기 좌표 — 칩에 안 가리는 y 범위 [yTop, yBottom]
    var v = SK.view, off = (v && v.offsetY) || 0, hFull = (v && v.hFull) || (sr.height / s);
    res.yTop = res.top - off;
    res.yBottom = (sr.height - bottom - oy) / s - off;
    if (!isFinite(res.yBottom)) res.yBottom = hFull - off;
    return res;
  };
  /** R4: 실험 화면 캔버스의 세로 여유(논리 단위). 16:9 화면 = 0, 1180×820 ≈ 254(660 기준 sim) */
  SK.stageExtra = function () { return (SK.view && SK.view.extra) || 0; };

  global.SimKit = SK;
})(window);
