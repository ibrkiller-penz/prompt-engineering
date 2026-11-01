/* =====================================================================
   포물선 운동과 역학적 에너지 (projectile-energy) — 화면·조작 (R2 고도화 2차)
   공통 틀 SimKit(../../shared/sim.js) + 물리 계산 PEPhys(pe-physics.js) 위에서 동작.
   근거: docs/04_팀장결정서.md §4-1, docs/개선/R2_계획.md §1-2 P1~P8·§4-1, docs/SIMKIT.md §0 (R2)
   ===================================================================== */
(function () {
  'use strict';

  var SK = window.SimKit, PH = window.PEPhys;
  if (!SK || !PH) { document.body.textContent = '공통 틀(shared/sim.js) 또는 pe-physics.js 를 불러오지 못했어요.'; return; }
  var h = SK.h, fmt = SK.fmt;
  var DT = PH.DT;

  /* 실험 화면 배치 (논리 좌표 1250×700, stageFit 으로 660 높이에 맞춰 줄어듦) */
  var L = { AX: 64, X0: 150, GY: 636, RIGHT: 1225, TOP: 150 };   // TOP: 최소값. 실제로는 SK.stageInset().top(상태 칩·범례) 아래로
  var VS = 5;          // 속도 화살표: 1 m/s = 5u
  var ACC_LEN = 72;    // 가속도 화살표 길이(일정)
  var BALL_R = 18;     // R5: 공 지름 36u (14→18, 섬광 점 8u 는 그대로)

  var run = null, st = null;
  var autoBox = { x: 44, y: 12 }, fixedBox = null;
  var map = { S: 10 };
  var drag = null;
  var holdUntil = 0;
  var curPreset = -1;
  var pick = -1;       // 눌러서 고른 섬광 점 번호 (동영상 분석처럼 그 순간 값 보기)

  // R4: 캔버스 글꼴은 SK.font(400|500, 크기) · 글자는 SK.text(수식 $v_0$) — 예전 fontSans/fontNum/FS/FN 상수는 지움
  /** 글 속 $…$ 를 수식 노드로 바꾸고 글자 기호(▶ ↻ ⚡ ✓ ✗ ↓ ↑)를 아이콘으로 (공통이 rich 를 안 거치는 곳용) */
  function mathify(root) {
    if (!root) return root;
    var w = document.createTreeWalker(root, 4, null), n, list = [];
    while ((n = w.nextNode())) if (n.nodeValue.indexOf('$') >= 0) list.push(n);
    list.forEach(function (t) {
      var parts = SK.mathNodes(t.nodeValue), par = t.parentNode;
      parts.forEach(function (p) { par.insertBefore(typeof p === 'string' ? document.createTextNode(p) : p, t); });
      par.removeChild(t);
    });
    return SK.iconify(root, { all: true });
  }
  /** 개념 카드 본문(여러 줄): 줄마다 <p> + 수식 + 아이콘 (✗ … → ✓ … · 운동 에너지 ↓) */
  function richLines(str) {
    return h('div', null, str.split('\n').map(function (ln) { return mathify(h('p', null, ln)); }));
  }

  function gText(g) { return (Math.round(g * 100) / 100).toString(); }
  function mText(p) {
    if (p.air === 'off') return SK.valueText('m', p.m);
    return p.air === 'steel' ? '0.50' : '0.0027';
  }
  function eDec(E0) { return E0 < 10 ? 2 : 1; }
  function gNow(p) { return PH.gOf(p || SK.params); }

  /* ------------------------------------------------------------------
     눈금: '눈금 자동 맞춤' 켬 = 지금 궤적 + 저장한 기록이 모두 보이게(같은 눈금으로 비교)
                          끔 = 지금 눈금 그대로 고정
     ------------------------------------------------------------------ */
  function boxFor(R, H) { return { x: Math.max((R || 0) * 1.1, 10), y: Math.max((H || 0) * 1.1, 5) }; }
  function currentBox() {
    if (!SK.params.autoScale) { if (!fixedBox) fixedBox = autoBox; return fixedBox; }
    fixedBox = null;
    var b = { x: autoBox.x, y: autoBox.y };
    SK.records.forEach(function (r) {
      var v = r.values || {};
      var rb = boxFor(v.R, v.H);
      if (rb.x > b.x) b.x = rb.x;
      if (rb.y > b.y) b.y = rb.y;
    });
    return b;
  }

  /* ------------------------------------------------------------------
     1. 화면 뼈대 · 지금 할 일
     ------------------------------------------------------------------ */
  function predPending() { return !!(SK.prediction && SK.prediction.pending); }
  var TODAY = '비스듬히 던진 공은 어디에 떨어질까? 날아가는 동안 에너지는 어떻게 될까?';
  // R2: 띠 문장은 25자 안팎 한 줄. 실행·기록 버튼 안내는 공통 틀 문장(아래 ▶ 실행 / 기록하기 버튼)을 쓴다
  var CFG = {
    slug: 'projectile-energy',
    title: '포물선 운동과 역학적 에너지',
    subject: '역학과 에너지 (진로 선택)',
    unit: '(1) 시공간과 운동',
    standards: ['12역학01-02', '12물리01-04'],
    // today 는 띠에 두 줄로 뜨지 않게 '수업 정보' 팝오버에만 넣는다(아래 putToday)
    stepTasks: [
      { text: function () { return predPending() ? '' : '먼저 사거리를 예측해요'; } },
      { text: function () { return SK.started ? '' : '아래 ▶ 실행으로 공을 던져요'; } },
      { text: function () {
          return SK.records.length >= 2
            ? '두 기록에서 달라진 값을 찾아요'
            : '값 하나만 바꿔 실행하고 기록해요 (' + SK.records.length + '/2)';
        } },
      { text: '오른쪽 질문에 답하며 정리해요' }
    ],
    dt: DT,
    stageFit: true,
    // R4: 16:9 보다 세로가 긴 화면 — 바닥(GY 636)을 아래에 붙이고 하늘을 위로 (y = −extra 까지 그린다)
    onResize: function (view) { view.offsetY = view.extra; },
    reset: onReset,
    step: physStep,
    render: onRender,
    capture: onCapture,
    save: onSave,
    load: onLoad,
    status: onStatus,
    autoPredict: true,
    onPredictOpen: function () { SK.requestRender(); },    // 예측 창이 떠 있는 동안 궤적·기록(결과 층)을 숨긴다
    onPredictClose: function () { SK.requestRender(); },
    // R6(A1): 심플 모드 — 12역학01-02 핵심(v₀·θ, 수평 거리, v_x 그대로·v_y 부호). h·g·m 은 더 보기 시트(패널)에.
    // 실험 카드: '45° 가장 멀리' 카드는 따로 없어 가장 가까운 둘 — ② 30°와 60°(같은 사거리), ⑤ 최고점에서 속도는?(v₀ 20 · 45°)
    simple: {
      task: '속력과 각도를 바꿔 공이 어디까지 가는지 봐요',
      params: ['v0', 'theta'], situation: ['planet'], meters: ['x', 'vx', 'vy'],
      presets: [2, 4], predict: 'button',
      extras: [{ key: 'energy', label: '에너지 막대' }]
    }
  };
  SK.init(CFG);
  SK.el.band.style.gridTemplateColumns = 'minmax(0, 6fr) minmax(0, 3fr)';
  // R6(A2): 모드를 바꾸면 범례·캔버스 글자를 다시 (물리 상태는 그대로)
  if (SK.onMode) SK.onMode(function () { legendKey = ''; if (run) updateLegend(SK.params); SK.requestRender(); });
  (function putToday() {
    var pop = SK.el.top.querySelector('.info-pop');
    if (pop) pop.insertBefore(h('p', { class: 'pe-today' }, [h('b', { text: '오늘 알아볼 것' }), TODAY]), pop.firstChild);
  })();

  /* ------------------------------------------------------------------
     2. 조절 패널 — 수치(v₀·θ·h + 어디에서 던질까) → 상황 → 화면에 표시하기 → 더 많은 설정
     ------------------------------------------------------------------ */
  SK.addVar('values', {
    key: 'v0', label: '처음 속력', symbol: 'v_0', unit: 'm/s',
    min: 0, max: 30, step: 1, value: 20, decimals: 0, precision: 1, apply: 'restart'   // 눈금 글자 줄은 빼서 v₀·θ·h 가 1280 한 화면에
  });
  SK.addVar('values', {
    key: 'theta', label: '던지는 각도', symbol: 'θ', unit: '°',
    min: 0, max: 90, step: 5, value: 45, decimals: 0, precision: 1,
    ticks: [{ v: 0, label: '0° 옆으로' }, { v: 45, label: '45°' }, { v: 90, label: '90° 위로' }], apply: 'restart'
  });
  SK.addVar('values', {
    key: 'h', label: '던지는 높이', symbol: 'h', unit: 'm',
    min: 0, max: 45, step: 5, value: 0, decimals: 0, precision: 1, apply: 'restart'
  });
  // 상황 바꾸기 (요구 B) — '어디에서 던질까?' 를 상황 묶음 맨 위로 (수치 칸 v₀·θ·h 가 1280 에서 한 화면에)
  SK.addChoice('situation', {
    key: 'planet', label: '어디에서 던질까?', style: 'cards', apply: 'restart',
    options: [
      { value: 'earth', label: '지구', sub: 'g = 9.8 m/s²' },
      { value: 'moon', label: '달', sub: 'g = 1.62 m/s²' },
      { value: 'mars', label: '화성', sub: 'g = 3.71 m/s²' }
    ],
    value: 'earth',
    hint: '{{중력 가속도}} g 가 작은 곳일수록 천천히 떨어져요.',
    onChange: function (v) {
      if (v === 'moon' && SK.get('air') !== 'off') SK.notice('달에는 공기가 없어 공기 저항도 없어요', 'info', 4000);
      syncUI();
    }
  });
  SK.addChoice('situation', {
    key: 'gEarth', label: '지구의 g 값 (m/s²)', apply: 'restart',
    options: [{ value: 9.8, label: '9.8', sub: '실제 값' }, { value: 10, label: '10', sub: '계산 쉽게' }],
    value: 9.8, onChange: syncUI
  });
  SK.addToggle('situation', {
    key: 'cmp', label: '옆에 떨어뜨린 공(회색) 함께 보기', value: false, apply: 'live', record: false,
    hint: '같은 높이에서 옆으로 움직이지 않는 공이에요. 두 공의 높이를 비교해 봐요.'
  });

  // 화면에 표시하기 (바로 반영)
  SK.addToggle('tools', { key: 'flash', label: '섬광 사진 (0.1 s 마다 찍은 공)', value: true });
  SK.addToggle('tools', { key: 'showV', label: '속도 화살표', value: true });
  SK.addToggle('tools', { key: 'showA', label: '가속도 화살표', value: false });
  SK.addToggle('tools', { key: 'shadow', label: '바닥·벽에 비친 그림자', value: false, hint: '그림자는 수평 운동과 수직 운동을 따로 보여 줘요.' });
  SK.addToggle('tools', { key: 'energy', label: '에너지 막대', value: true });
  SK.addToggle('tools', { key: 'topStop', label: '최고점에서 화면 잠깐 멈추기', value: false, hint: '화면만 멈춰요. 공은 최고점에서도 옆으로 움직이고 있어요.' });
  SK.addToggle('tools', { key: 'autoScale', label: '눈금 자동 맞춤', value: true, hint: '켜면 지금 궤적과 저장한 기록이 모두 보이게 눈금을 맞춰요. 끄면 지금 눈금 그대로예요.' });

  // 더 많은 설정 (성취기준 밖·심화)
  SK.addChoice('deep', {
    key: 'air', label: '{{공기 저항}}', apply: 'restart',
    options: [
      { value: 'off', label: '없음', sub: '이상적 조건' },
      { value: 'steel', label: '쇠공', sub: '0.50 kg' },
      { value: 'pingpong', label: '탁구공', sub: '0.0027 kg' }
    ],
    value: 'off', onChange: syncUI,
    hint: '교과서 문제는 보통 공기 저항이 없다고 봐요.'
  });
  SK.addVar('deep', {
    key: 'm', label: '공의 질량', symbol: 'm', unit: 'kg',
    min: 0.1, max: 5, step: 0.1, value: 1, decimals: 1, precision: 2, ticks: [0.1, 1, 5], apply: 'restart',
    hint: '공기 저항이 없으면 궤적은 그대로, 에너지 값만 질량에 비례해요.'
  });
  var mHint = h('p', { class: 'pe-hint', text: '' });
  SK.controls.m.el.appendChild(mHint);
  SK.addToggle('deep', { key: 'kCustom', label: '공기 저항 계수 직접 넣기', value: false, apply: 'restart', record: true, onChange: syncUI });
  SK.addVar('deep', {
    key: 'k4', label: '공기 저항 계수', symbol: 'k', unit: '×10⁻⁴ kg/m',
    min: 0.5, max: 50, step: 0.5, value: 5.5, decimals: 1, precision: 2, ticks: [0.5, 5.5, 50], apply: 'restart',
    hint: '쇠공 5.5, 탁구공 3.5 ($k$ = ½$ρC_dA$). 공기 저항을 켰을 때만 쓰여요.'
  });
  var formulaBox = h('div', { class: 'pe-formula', 'aria-live': 'polite' });
  SK.panel('deep').appendChild(h('div', { class: 'pe-formula-wrap' }, [h('p', { class: 'pe-formula__title', text: '식으로 계산해 보기 — 지금 값을 넣으면' }), formulaBox]));

  /* ------------------------------------------------------------------
     3. 실험 화면 오른쪽 위: 눈금 · 범례 (짧은 라벨만)
     ------------------------------------------------------------------ */
  var legend = h('div', { class: 'pe-legend', 'aria-label': '화살표 범례' });
  var legendKey = '';
  SK.el.cornerTR.appendChild(legend);   // '모눈 1칸 = 2 m' 은 캔버스 축 옆에 직접 그린다

  function legendSVG(kind) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 56 20'); svg.setAttribute('aria-hidden', 'true');
    function el(tag, attrs) { var e = document.createElementNS(ns, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); svg.appendChild(e); return e; }
    if (kind === 'v' || kind === 'vc' || kind === 'a') {
      var col = kind === 'a' ? 'var(--color-q-force)' : 'var(--color-q-velocity)';
      el('line', { x1: '3', y1: '10', x2: '42', y2: '10', style: 'stroke:' + col + ';stroke-width:4;stroke-linecap:round' + (kind === 'vc' ? ';stroke-dasharray:7 5' : '') });
      el('path', { d: 'M54 10 L40 3 L40 17 Z', style: 'fill:' + col });
    } else if (kind === 'cmp') {
      el('circle', { cx: '28', cy: '10', r: '8', style: 'fill:var(--color-line-strong);stroke:var(--color-ink-muted);stroke-width:2' });
    } else if (kind === 'flash') {
      el('circle', { cx: '10', cy: '10', r: '5', style: 'fill:var(--color-sim-projectile)' });
      el('circle', { cx: '28', cy: '10', r: '5', style: 'fill:var(--color-sim-projectile)' });
      el('circle', { cx: '46', cy: '10', r: '5', style: 'fill:var(--color-sim-projectile)' });
    }
    return svg;
  }
  function updateLegend(p) {
    if (SK.predicting()) { legend.hidden = true; legendKey = ''; return; }
    var simple = SK.isSimple && SK.isSimple();
    var key = [p.showV, p.showA, p.cmp, p.flash, run && run.analytic, run && run.theta > 0, simple].join(',');
    if (key === legendKey) return;
    legendKey = key;
    legend.innerHTML = '';
    function row(kind, text) { legend.appendChild(h('span', { class: 'pe-legend__row' }, [legendSVG(kind), text])); }
    if (p.showV) { row('v', '속도'); row('vc', '수평·수직 속도'); }
    if (p.showA) row('a', run && !run.analytic ? '가속도' : '가속도 (= g, 아래로)');
    if (p.flash && !simple) row('flash', '0.1 s 마다 찍은 공');   // R6(A2): 심플은 섬광 범례 숨김(점은 그대로)
    if (p.cmp) row('cmp', run && run.theta > 0 ? '옆으로 안 가는 공' : '떨어뜨린 공');
    legend.hidden = !legend.children.length;
  }

  /* ------------------------------------------------------------------
     4. 하단 띠: 계기판 1줄 4개 | 에너지 막대
     ------------------------------------------------------------------ */
  var meters = SK.meters(null, [
    { key: 't', label: '시간', symbol: 't', unit: 's', decimals: 2 },
    { key: 'x', label: '수평 거리', symbol: 'x', unit: 'm', decimals: 1 },
    { key: 'vx', label: '{{수평 속도}}', symbol: 'v_x', unit: 'm/s', decimals: 1, q: 'velocity' },
    { key: 'vy', label: '{{수직 속도}}', symbol: 'v_y', unit: 'm/s', decimals: 1, q: 'velocity' }
  ]);
  meters.el.classList.add('pe-meters');
  // R4: 기호는 공통 수식 표기(symbol 'v_y' → v<sub>y</sub>). R3: '음수면 아래' 는 라벨 줄 끝에 (값 줄은 숫자·단위만)
  var vyLab = meters.el.querySelector('[data-key="vy"] .meter__label');
  if (vyLab) vyLab.appendChild(h('span', { class: 'pe-meter-note', text: '(위+ 아래−)', title: '위로 가면 +, 아래로 가면 −' }));   // R6: caption 24u 에서 1920 끝 ')' 잘림 → 띄어쓰기·가운뎃점 줄임

  var energyBox = h('div', { class: 'pe-energy', 'aria-label': '에너지 막대' });
  SK.el.graph.appendChild(energyBox);
  var ev = SK.canvas(energyBox, { fit: false, bg: '--color-paper-raised' });
  ev.onResize = function () { if (run) drawEnergy(SK.params); };

  // R2(C1): 1 = 작은 표·큰 판, 2 = 큰 판, 3 = '열 더 보기' 에서만.
  // 1280 에서 큰 판에 보이는 데이터 열은 3~4개뿐이라, 결과(수평 거리)가 잘리지 않게 v₀·θ·수평 거리·비행 시간만 앞에 둔다.
  // 높이·g 처럼 바꾼 값은 표 위 '바꾼 값(기록 1 → 2)' 줄에 자동으로 나온다
  SK.recordTable(null, {
    columns: [
      { key: 'v0', from: 'param', priority: 1 },
      { key: 'theta', from: 'param', priority: 1 },
      { key: 'R', label: '수평 거리', unit: 'm', decimals: 1, from: 'value', priority: 1 },
      { key: 'T', label: '비행 시간', unit: 's', decimals: 2, from: 'value', priority: 2 },
      { key: 'h', from: 'param', priority: 3 },
      { key: 'gtxt', label: 'g', unit: 'm/s²', from: 'value', priority: 3, changed: function (r) { return r.changed.indexOf('planet') >= 0 || r.changed.indexOf('gEarth') >= 0; } },
      { key: 'vL', label: '착지 속력', unit: 'm/s', decimals: 1, from: 'value', priority: 3 },
      { key: 'H', label: '최고 높이', unit: 'm', decimals: 1, from: 'value', priority: 3 },
      { key: 'E0t', label: '처음 에너지', unit: 'J', from: 'value', priority: 3 },
      { key: 'E1t', label: '착지 에너지', unit: 'J', from: 'value', priority: 3 },
      { key: 'mtxt', label: '질량 m', unit: 'kg', from: 'value', priority: 3, changed: function (r) { return r.changed.indexOf('m') >= 0 || r.changed.indexOf('air') >= 0; } },
      { key: 'air', from: 'param', priority: 3 }
    ]
  });
  SK.onRecords(function () { SK.update(); SK.requestRender(); });

  /* ------------------------------------------------------------------
     5. 예측 — 첫 진입: 사거리 숫자 예측 / 실험 카드 5장 (교과서 탐구·문제·흔한 오해)
     ------------------------------------------------------------------ */
  /** 지금 g·v₀·h 에서 각도를 바꿔 가며 얻을 수 있는 가장 먼 거리 (예측 상한·중립 눈금용) */
  var maxCache = { key: '', R: 0, H: 0 };
  function maxReach(p) {
    var key = [p.planet, p.gEarth, p.air, p.kCustom, p.k4, p.h, p.v0, p.m].join('|');
    if (maxCache && maxCache.key === key) return maxCache;
    var bestR = 0, step = PH.kOf(p) === 0 ? 5 : 10;
    for (var th = 0; th <= 90; th += step) bestR = Math.max(bestR, PH.rangeFor(p, { theta: th }));
    var g = PH.gOf(p);
    maxCache = { key: key, R: bestR, H: p.h + p.v0 * p.v0 / (2 * g) };
    return maxCache;
  }
  function condText(u) {
    var parts = ['$v_0$ ' + u.v0 + ' m/s', '각도 ' + u.theta + '°', u.h > 0 ? '높이 ' + u.h + ' m 에서' : '땅에서'];
    if (u.planet !== 'earth') parts.push(PH.PLANETS[u.planet].name);
    if (u.air !== 'off') parts.push(PH.BALLS[u.air].name + '(공기 저항)');
    return parts.join(' · ');
  }
  // 처음 들어왔을 때 띄우는 숫자 예측. 띠 '예측하기' 가 같은 객체로 다시 열므로 문장은 getter(그때 값으로)
  var RANGE_PREDICT = {
    // R5: 창 높이 상한(16:9 268u) 안에 — 조건은 질문 줄 괄호로, '바닥 눈금(m)을 보고 어림해요' 는 입력칸 이름으로 (info 줄 없앰)
    get question() { return '공은 어디쯤 떨어질까요? (' + condText(SK.ui) + ')'; },
    numeric: {
      label: '바닥 눈금(m)을 보고 어림해요', unit: 'm', min: 0, key: 'R', decimals: 1,
      // R5: 범위 글·예시값은 숨기고(정답 40.8 → '예: 40'·'0~65 m' 가 답을 알려 줌), 상한은 200 m 고정.
      // 달·화성처럼 최대 사거리가 200 m 를 넘을 때만 그만큼 올린다(overText 가 맞는 말이 되게)
      example: null, showRange: false,
      max: function (p) { return Math.max(200, Math.ceil(maxReach(p).R * 1.5 / 5) * 5); },
      overText: '가장 멀리 가는 각도보다도 커요 — 확인해 봐요'
    },
    get why() { return '수평 거리 = 수평 속도 × 비행 시간이에요. 땅에서 던지면 45°일 때 가장 멀리 가요.'; },
    place: 'top'   // R5: 하늘(위)에 띄워 x축 눈금·발사점이 보이게
  };
  function openRangePredict() {
    curPreset = -1;
    SK.predict(RANGE_PREDICT).then(function () { SK.update(); });
  }

  var TOOLS_OFF = { flash: false, showV: false, showA: false, shadow: false, energy: true, topStop: false, cmp: false };
  function vals(o) { var r = {}; var k; for (k in TOOLS_OFF) r[k] = TOOLS_OFF[k]; for (k in o) r[k] = o[k]; r.kCustom = false; return r; }
  // R2(E1): changes = 카드 아래 한 줄(이 카드가 맞추는 값), change = 말풍선 한 줄(전체 값). 꼬리표(tag)는 쓰지 않음
  var PRESETS = [
    {
      name: '수평으로 던지기',
      changes: 'h 20 m · 0°', change: 'v₀ 10 m/s · 각도 0° · 높이 20 m · 떨어뜨린 공 함께',
      values: vals({ planet: 'earth', air: 'off', h: 20, v0: 10, theta: 0, m: 1, cmp: true, flash: true, shadow: true }),
      predict: {
        place: 'bottom',   // R5: 20 m 절벽(발사점)이 위쪽이라 창은 아래에
        question: '20 m 절벽에서 옆으로 10 m/s 로 던진 공과 그냥 떨어뜨린 공(회색), 무엇이 먼저 땅에 닿을까요?',
        choices: ['던진 공이 먼저', '떨어뜨린 공이 먼저', '동시에'], answer: 3,
        why: '옆으로 던져도 아래로 떨어지는 운동은 그냥 떨어뜨린 공과 똑같아요. 떨어지는 시간은 높이와 g 로만 정해져요(수평으로 던졌을 때 수직 운동은 떨어뜨린 공과 같아요).',
        judge: function () {
          if (!st || st.cLand === null) return 3;
          var d = st.tLand - st.cLand;
          return Math.abs(d) < 0.005 ? 3 : (d < 0 ? 1 : 2);
        }
      }
    },
    {
      name: '나는 동안 에너지',
      changes: 'h 20 m · 30°', change: 'v₀ 10 m/s · 각도 30° · 높이 20 m · 질량 1 kg',
      values: vals({ planet: 'earth', air: 'off', h: 20, v0: 10, theta: 30, m: 1, flash: true, energy: true }),
      predict: {
        place: 'bottom',   // R5: 20 m 절벽(발사점)이 위쪽이라 창은 아래에
        question: '날아가는 동안 운동 에너지 + 위치 에너지의 합(역학적 에너지)은 어떻게 될까요?',
        choices: ['점점 줄어든다', '점점 늘어난다', '내내 같다'], answer: 3,
        afterHint: '예측했어요 — 아래 에너지 막대를 지켜봐요',   // R5: info 줄 → 예측 뒤 토스트 (창 높이 상한)
        why: '공기 저항이 없으면 일을 하는 힘은 중력뿐이에요. 높이가 낮아진 만큼 위치 에너지가 운동 에너지로 바뀔 뿐, 합은 그대로예요.',
        judge: function () {
          if (!st || !st.result) return 3;
          var d = st.result.E1 - run.E0;
          return Math.abs(d) <= 0.001 * run.E0 + 1e-9 ? 3 : (d < 0 ? 1 : 2);
        }
      }
    },
    {
      name: '30°와 60°',
      changes: '각도 30° → 60°', change: 'v₀ 20 m/s · 땅에서 · 각도 30° (다음엔 60°로 바꿔 기록)',
      values: vals({ planet: 'earth', air: 'off', h: 0, v0: 20, theta: 30, m: 1, flash: true }),
      predict: {
        place: 'top',
        question: '같은 속력 20 m/s 로 30°와 60°로 던지면 어느 쪽이 더 멀리 갈까요?',
        choices: ['30°', '60°', '같다'], answer: 3,
        why: '30°는 옆으로 빠르지만 일찍 떨어지고, 60°는 오래 날지만 옆으로 느려요. 수평 속도 × 비행 시간이 같아져요. 더해서 90°인 두 각도는 사거리가 같아요.',
        judge: function (p) {
          var r30 = PH.rangeFor(p, { theta: 30 }), r60 = PH.rangeFor(p, { theta: 60 }), d = r30 - r60;
          return Math.abs(d) < 0.05 ? 3 : (d > 0 ? 1 : 2);
        }
      }
    },
    {
      name: '달에서 던지기',
      changes: 'g: 지구 → 달', change: '달 (g = 1.62 m/s²) · v₀ 10 m/s · 각도 45° · 땅에서',
      values: vals({ planet: 'moon', air: 'off', h: 0, v0: 10, theta: 45, m: 1, flash: true }),
      predict: {
        place: 'top',
        // R5: info 줄을 질문에 합침 (창 높이 상한)
        question: '지구⁠(g = 9.8 m/s²)에서 약 10 m 가는 공을 그대로 달⁠(g = 1.62 m/s²)에서 던지면 몇 배 멀리 갈까요?',   //  ·⁠: 괄호 안에서 줄이 꺾이지 않게
        choices: ['약 2배', '약 6배', '같다'], answer: 2,
        why: '사거리는 g 에 반비례해요($R$ = $v_0$² sin2$θ$ ÷ $g$). 달의 g 는 지구의 약 1/6 이라 약 6배 멀리 가요.',
        judge: function (p) {
          var re = PH.rangeFor(p, { planet: 'earth' }), ratio = (st && st.result ? st.result.R : PH.rangeFor(p, {})) / re;
          var opts = [2, 6, 1], best = 0;
          for (var i = 1; i < 3; i++) if (Math.abs(ratio - opts[i]) < Math.abs(ratio - opts[best])) best = i;
          return best + 1;
        }
      }
    },
    {
      name: '최고점에서 속도는?',
      changes: '최고점 화면정지',   // R5: '최고점에서 멈춤' 은 '최고점에서 공이 멈춘다' 오개념 — 화면만 멈춤 (카드 폭 1024 에서도 한 줄)
      change: '최고점에서 화면이 잠깐 멈춰요 — 공은 계속 움직여요 (v₀ 20 m/s · 45° · 화살표 보기)',
      values: vals({ planet: 'earth', air: 'off', h: 0, v0: 20, theta: 45, m: 1, topStop: true, showV: true, showA: true }),
      predict: {
        place: 'top',
        question: '가장 높은 곳(최고점)에서 공의 속도와 가속도는 어떨까요?',
        choices: ['속도 0, 가속도 0', '속도 0, 가속도 g', '속도 0 아님, 가속도 g'], answer: 3,
        why: '최고점에서는 수직 속도만 0 이에요. 수평 속도 $v_x$ 는 그대로 남아 있고, 중력 때문에 가속도는 내내 g(아래 방향)예요.'
      }
    }
  ];
  SK.setPresets(PRESETS.map(function (pr, i) {
    return {
      name: pr.name, changes: pr.changes, change: pr.change, values: pr.values, predict: pr.predict,
      onApply: function () {
        curPreset = i; fixedBox = null;
        if (!SK.get('autoScale')) SK.set('autoScale', true);
        SK.update(); SK.requestRender();
      }
    };
  }));

  /* ------------------------------------------------------------------
     6. 설명 콘텐츠 — 도움말(이렇게 해요·개념·용어) · 결과 해설 · 정리 질문
     ------------------------------------------------------------------ */
  /* 개념 카드 그림 (SVG 글, 색은 토큰) */
  var FIG_FLASH =
    '<svg viewBox="0 0 520 230" xmlns="http://www.w3.org/2000/svg" font-size="20" style="font-family:var(--font-sans)">' +
    '<line x1="40" y1="200" x2="500" y2="200" style="stroke:var(--color-line-strong);stroke-width:3"/>' +
    '<line x1="40" y1="20" x2="40" y2="200" style="stroke:var(--color-line-strong);stroke-width:3"/>' +
    (function () {
      var s = '', i, x, y;
      for (i = 0; i <= 6; i++) {
        x = 60 + i * 70; y = 30 + 4.4 * i * i;
        s += '<line x1="' + x + '" y1="205" x2="' + x + '" y2="215" style="stroke:var(--color-ink-muted);stroke-width:2"/>';
        s += '<circle cx="' + x + '" cy="' + y + '" r="9" style="fill:var(--color-sim-projectile)"/>';
        s += '<circle cx="40" cy="' + y + '" r="6" style="fill:none;stroke:var(--color-ink-muted);stroke-width:2"/>';
      }
      return s;
    })() +
    '<text x="275" y="228" text-anchor="middle" style="fill:var(--color-ink)">옆으로: 같은 간격 (빠르기 그대로)</text>' +
    '<path d="M82 132 V160 M74 152 L82 160 L90 152" style="fill:none;stroke:var(--color-ink);stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round"/>' +
    '<text x="98" y="160" style="fill:var(--color-ink)">위아래: 간격이 점점 벌어짐</text>' +
    '</svg>';
  var FIG_ANGLE =
    '<svg viewBox="0 0 520 220" xmlns="http://www.w3.org/2000/svg" font-size="20" style="font-family:var(--font-sans)">' +
    '<line x1="20" y1="190" x2="510" y2="190" style="stroke:var(--color-line-strong);stroke-width:3"/>' +
    '<path d="M40 190 Q 220 -10 400 190" style="fill:none;stroke:var(--color-ink-muted);stroke-width:3;stroke-dasharray:8 6"/>' +
    '<path d="M40 190 Q 245 60 450 190" style="fill:none;stroke:var(--color-sim-projectile);stroke-width:4"/>' +
    '<path d="M40 190 Q 220 120 400 190" style="fill:none;stroke:var(--color-ink);stroke-width:3"/>' +
    '<text x="215" y="30" text-anchor="middle" style="fill:var(--color-ink-muted)">60° (높이, 오래)</text>' +
    '<text x="300" y="98" style="fill:var(--color-sim-projectile)">45° 가장 멀리</text>' +
    '<text x="190" y="176" text-anchor="middle" style="fill:var(--color-ink)">30° (낮게, 빨리)</text>' +
    '<text x="400" y="214" text-anchor="middle" style="fill:var(--color-ink)">30° ·60° 같은 곳</text>' +
    '</svg>';
  var FIG_ENERGY =
    '<svg viewBox="0 0 520 210" xmlns="http://www.w3.org/2000/svg" font-size="20" style="font-family:var(--font-sans)">' +
    (function () {
      var s = '', cols = [['위로 던질 때', 0.7], ['최고점', 0.3], ['땅에 닿을 때', 1]], i, x, k;
      for (i = 0; i < 3; i++) {
        x = 30 + i * 165; k = cols[i][1];
        s += '<rect x="' + x + '" y="40" width="140" height="34" style="fill:var(--color-paper-sunk);stroke:var(--color-ink);stroke-width:2"/>';
        s += '<rect x="' + x + '" y="40" width="' + (140 * k) + '" height="34" style="fill:var(--color-q-energy-k)"/>';
        s += '<rect x="' + (x + 140 * k) + '" y="40" width="' + (140 * (1 - k)) + '" height="34" style="fill:var(--color-q-energy-p)"/>';
        s += '<text x="' + (x + 70) + '" y="28" text-anchor="middle" style="fill:var(--color-ink)">' + cols[i][0] + '</text>';
      }
      return s;
    })() +
    '<rect x="30" y="110" width="20" height="20" style="fill:var(--color-q-energy-k)"/><text x="58" y="127" style="fill:var(--color-ink)">운동 에너지 (빠를수록 큼)</text>' +
    '<rect x="30" y="146" width="20" height="20" style="fill:var(--color-q-energy-p)"/><text x="58" y="163" style="fill:var(--color-ink)">위치 에너지 (높을수록 큼)</text>' +
    '<text x="30" y="200" style="fill:var(--color-ink)">막대 전체 길이(합)는 세 장면 모두 같아요</text>' +
    '</svg>';

  SK.help({
    how: [
      '처음에 뜨는 예측 창에 공이 몇 m 앞에 떨어질지 적어요. 아래 실험 카드를 눌러도 값이 바뀌고 예측 질문이 나와요.',
      '아래 ▶ 실행을 눌러요. 공, 계기판의 수평 속도·수직 속도, 에너지 막대를 지켜봐요.',
      '끝나면 위 띠의 기록하기 버튼으로 저장해요. 오른쪽 수치 칸에서 처음 속력이나 각도 하나만 바꿔 다시 실행하고 또 기록해요.',
      '비교 단계 표에서 두 기록을 나란히 놓고 무엇이 달라졌는지 찾아요. 정리 단계 질문에 답하면 바로 정답과 이유가 나와요.',
      '실행 전에 공을 뒤로 끌어당겼다 놓으면 처음 속력과 각도가 정해져요. 섬광 점(0.1 s 마다 찍은 공)을 누르면 그 순간의 값이 보여요.'
    ],
    concepts: [
      {
        title: '① 수평 방향 — 등속 운동',
        summary: '옆으로 가는 빠르기는 끝까지 같아요',
        plain: '공을 던진 뒤에는 옆으로 밀거나 당기는 힘이 없어요.\n그래서 수평 속도 $v_x$ 는 날아가는 내내 처음 값 그대로예요.\n섬광 사진의 점들이 옆으로는 똑같은 간격으로 찍히는 까닭이에요.',
        example: '$v_x$ = 10 m/s 이면 1 s 에 10 m, 2 s 에 20 m, 3 s 에 30 m 를 옆으로 가요.',
        figure: FIG_FLASH,
        formula: 'vₓ = v₀ cosθ (일정)   ·   x = vₓ × t',
        symbols: [
          { s: 'vₓ', meaning: '{{수평 속도}} — 옆으로 가는 빠르기', unit: 'm/s' },
          { s: 'v₀', meaning: '처음 속력 — 던지는 순간의 빠르기', unit: 'm/s' },
          { s: 'θ', meaning: '던지는 각도 — 바닥에서 잰 각', unit: '°' },
          { s: 'x', meaning: '던진 곳에서 옆으로 간 거리', unit: 'm' },
          { s: 't', meaning: '던진 뒤 지난 시간', unit: 's' }
        ],
        why: '던진 뒤 공에 작용하는 힘은 중력 하나이고, 중력은 똑바로 아래를 향해요.\n옆 방향으로는 힘이 0 이라서, 관성(뉴턴 운동 제1법칙)대로 수평 속도가 바뀌지 않아요.\n공기 저항이 있으면 뒤로 미는 힘이 생겨 $v_x$ 가 조금씩 줄어요.',
        live: function (p) {
          var r = run || PH.buildRun(p);
          return '지금 값으로: vₓ = ' + fmt(r.v0, 0) + ' × cos' + p.theta + '° = ' + fmt(r.vx0, 1) + ' m/s → ' + fmt(r.T, 2) + ' s 동안 ' + fmt(r.vx0 * r.T, 1) + ' m' + (r.analytic ? '' : ' (공기 저항이 있으면 식보다 짧아요)');
        }
      },
      {
        title: '② 수직 방향 — 등가속도 운동',
        summary: '위아래는 떨어뜨린 공과 같아요',
        plain: '위아래로는 중력 때문에 1 s 마다 속도가 g 만큼(지구 9.8 m/s) 바뀌어요.\n올라갈 때는 점점 느려지고, 최고점에서 수직 속도가 0, 내려올 때는 점점 빨라져요.\n그래서 같은 높이에서 옆으로 던진 공과 그냥 떨어뜨린 공은 동시에 땅에 닿아요.',
        example: '지구에서 20 m 높이: 옆으로 던지든 그냥 떨어뜨리든 약 2.02 s 뒤에 땅에 닿아요.',
        formula: 'vᵧ = v₀ sinθ − g t   ·   y = h + v₀ sinθ · t − ½ g t²',
        symbols: [
          { s: 'vᵧ', meaning: '{{수직 속도}} — 위로 가면 +, 아래로 가면 −', unit: 'm/s' },
          { s: 'y', meaning: '땅에서 잰 공의 높이', unit: 'm' },
          { s: 'h', meaning: '던지는 높이(절벽 높이)', unit: 'm' },
          { s: 'g', meaning: '{{중력 가속도}} — 1 s 마다 빨라지는 정도', unit: 'm/s²' },
          { s: 't', meaning: '던진 뒤 지난 시간', unit: 's' }
        ],
        why: '중력은 아래로만 작용하고, 그 크기는 공이 옆으로 얼마나 빠른지와 상관없어요.\n그래서 수직 운동은 수평 운동과 따로 일어나요(운동의 독립성).\n수평(0°)으로 던지면 처음 수직 속도가 0 이라, 떨어지는 시간은 $t$ = √(2$h$ ÷ $g$) 로 높이와 g 만으로 정해져요.\n(수평으로 던졌을 때 수직 운동은 떨어뜨린 공과 같아요)',
        live: function (p) {
          var r = run || PH.buildRun(p);
          if (r.h > 0 && r.vy0 === 0) return '지금 값으로: 높이 ' + fmt(r.h, 0) + ' m 에서 수평으로 던지면 t = √(2 × ' + fmt(r.h, 0) + ' ÷ ' + gText(r.g) + ') = ' + fmt(Math.sqrt(2 * r.h / r.g), 2) + ' s';
          return '지금 값으로: 처음 vᵧ = ' + fmt(r.vy0, 1) + ' m/s, 최고점까지 ' + (r.vy0 > 0 ? fmt(r.vy0 / r.g, 2) : '0.00') + ' s, 최고 높이 ' + fmt(r.H, 1) + ' m';
        }
      },
      {
        title: '③ 역학적 에너지 보존',
        summary: '높이 에너지 + 운동 에너지 = 늘 같은 값',
        plain: richLines('공이 올라가면 느려지고(운동 에너지 ↓) 높아져요(위치 에너지 ↑).\n내려올 때는 반대로 바뀌어요.\n공기 저항이 없으면 둘을 더한 값(역학적 에너지)은 처음부터 끝까지 같아요.'),
        example: '1 kg 공을 20 m 높이에서 10 m/s 로 던지면: 운동 50 J + 위치 196 J = 246 J. 땅에 닿을 때는 위치 0 J, 운동 246 J (g = 9.8 m/s²).',
        figure: FIG_ENERGY,
        formula: '½ m v² + m g h = 일정',
        symbols: [
          { s: '½ m v²', meaning: '{{운동 에너지}}', unit: 'J' },
          { s: 'm g h', meaning: '{{위치 에너지}} (땅을 높이 0 으로)', unit: 'J' },
          { s: 'm', meaning: '공의 질량', unit: 'kg' },
          { s: 'v', meaning: '그 순간의 속력', unit: 'm/s' },
          { s: 'h', meaning: '그 순간의 높이', unit: 'm' },
          { s: 'J', meaning: '줄, 에너지 단위 (1 J = 1 kg·m²/s²)', unit: '–' }
        ],
        why: '중력이 공에 한 일만큼 운동 에너지가 바뀌고, 위치 에너지는 그만큼 반대로 바뀌어요.\n중력 말고 일을 하는 힘(공기 저항 등)이 없으면 합은 그대로예요.\n그래서 같은 높이에서 같은 속력으로 던지면 각도가 달라도 착지 속력이 같아요: $v$ = √($v_0$² + 2$gh$).',
        live: function (p) {
          var r = run || PH.buildRun(p), d = eDec(r.E0);
          return '지금 값으로: 처음 운동 ' + fmt(0.5 * r.m * r.v0 * r.v0, d) + ' J + 위치 ' + fmt(r.m * r.g * r.h, d) + ' J = ' + fmt(r.E0, d) + ' J → 착지 속력 √(v₀² + 2gh) = ' + fmt(Math.sqrt(r.v0 * r.v0 + 2 * r.g * r.h), 1) + ' m/s';
        }
      },
      {
        title: '④ 사거리와 던지는 각도',
        summary: '45°에서 가장 멀리, 짝 각도는 같은 거리',
        plain: '각도가 작으면 옆으로 빠르지만 금방 떨어져요.\n각도가 크면 오래 날지만 옆으로 느려요.\n그 사이 45°에서 가장 멀리 가요. 30°와 60°처럼 더해서 90°인 두 각도는 같은 거리를 가요(땅에서 던질 때).',
        example: '지구(g = 9.8 m/s²)에서 20 m/s 로 던지면 30°·60°는 35.3 m, 45°는 40.8 m 가요.',
        figure: FIG_ANGLE,
        formula: 'R = v₀² sin2θ ÷ g   (땅에서 던질 때, 공기 저항 없음)',
        symbols: [
          { s: 'R', meaning: '{{사거리}} — 던진 곳부터 떨어진 곳까지', unit: 'm' },
          { s: 'v₀', meaning: '처음 속력', unit: 'm/s' },
          { s: 'θ', meaning: '던지는 각도', unit: '°' },
          { s: 'g', meaning: '{{중력 가속도}}', unit: 'm/s²' }
        ],
        why: '사거리 = 수평 속도 × 비행 시간 = ($v_0$ cos$θ$) × (2$v_0$ sin$θ$ ÷ $g$) = $v_0$² × 2 sin$θ$ cos$θ$ ÷ $g$ = $v_0$² sin2$θ$ ÷ $g$ 예요.\nsin2$θ$ 는 2$θ$ = 90°, 곧 $θ$ = 45°일 때 가장 커요(값 1).\nsin(2×30°) = sin60°와 sin(2×60°) = sin120°가 같아서 짝 각도는 같은 거리를 가요.\n높은 곳에서 던지거나 공기 저항이 있으면 가장 멀리 가는 각도는 45°보다 작아져요.',
        live: function (p) {
          var g = gNow(p);
          return '지금 값으로 (g = ' + gText(g) + ' m/s², v₀ = ' + p.v0 + ' m/s, 땅에서): 30°·60° → ' + fmt(p.v0 * p.v0 * Math.sin(Math.PI / 3) / g, 1) + ' m, 45° → ' + fmt(p.v0 * p.v0 / g, 1) + ' m';
        }
      },
      {
        title: '⑤ 흔한 오해 바로잡기',
        summary: '최고점에서도 가속도는 g',
        plain: richLines('✗ 최고점에서 공이 멈춘다 → ✓ 수직 속도만 0, 수평 속도는 그대로예요.\n✗ 최고점에서는 가속도도 0 이다 → ✓ 가속도는 내내 g, 아래 방향이에요.\n✗ 세게(빠르게) 수평으로 던질수록 늦게 떨어진다 → ✓ 떨어지는 시간은 높이와 g 로만 정해져요.\n✗ 무거운 공이 더 빨리 떨어진다 → ✓ 공기 저항이 없으면 질량과 상관없어요.\n✗ 날아가는 공을 앞으로 미는 힘이 있다 → ✓ 던진 뒤에는 중력(아래)만 작용해요.'),
        example: '20 m/s · 45°로 던지면 최고점에서도 공은 옆으로 14.1 m/s 로 움직이고 있어요.',
        formula: 'a = F ÷ m = mg ÷ m = g   (아래 방향, 내내 같음)',
        symbols: [
          { s: 'a', meaning: '가속도 — 1 s 마다 속도가 바뀌는 양', unit: 'm/s²' },
          { s: 'F', meaning: '공에 작용하는 힘(여기서는 중력 mg)', unit: 'N' },
          { s: 'm', meaning: '공의 질량', unit: 'kg' }
        ],
        why: '던진 손을 떠난 뒤 공에 작용하는 힘은 중력 하나예요(공기 저항 무시).\n힘이 늘 같으니 가속도도 늘 g 로 같아요. 올라갈 때도, 최고점에서도, 내려올 때도 아래로 g 예요.\n속도가 0 인 것과 가속도가 0 인 것은 다른 말이에요. 최고점에서 수직 속도는 0 이지만 1 s 뒤에는 아래로 g 만큼 빨라져 있어요.'
      }
    ],
    // 화면에 나오는 순서대로 (상태 칩 → 계기판 → 실험 화면 → 기록 표 → 에너지 → 더 많은 설정)
    terms: {
      '중력 가속도': { def: '1 s 마다 떨어지는 속도가 얼마나 빨라지는지(m/s²). 기호 g. 지구 9.8, 달 1.62, 화성 3.71.', short: '1초마다 빨라지는 정도', alias: ['g'] },
      '수평 속도': { def: '옆으로 가는 빠르기 vₓ (m/s). 공기 저항이 없으면 날아가는 내내 같아요.', alias: ['vₓ'] },
      '수직 속도': { def: '위아래로 가는 빠르기 vᵧ (m/s). 위로 가면 +, 아래로 가면 − 로 적어요. 최고점에서 0 이에요.', alias: ['vᵧ'] },
      '성분': '화살표 하나를 수평(옆)과 수직(위아래) 두 방향으로 나눈 것. 속도 v 를 vₓ 와 vᵧ 로 나눠 따로 봐요.',
      '포물선': '비스듬히 던진 공이 그리는 곡선. 옆으로는 일정하게, 위아래로는 점점 빨라지며 움직여서 생겨요.',
      '최고점': '공이 가장 높이 올라간 곳. 수직 속도가 0 이 되는 순간이에요(수평 속도는 그대로).',
      '사거리': '던진 곳에서 땅에 떨어진 곳까지의 수평 거리(m). 표의 \'수평 거리\'와 같아요.',
      '비행 시간': '던진 순간부터 땅에 닿을 때까지 걸린 시간(s).',
      '역학적 에너지': '운동 에너지와 위치 에너지를 더한 것(J). 공기 저항이 없으면 일정해요.',
      '운동 에너지': '움직이는 물체가 가진 에너지 ½mv² (J). 빠를수록, 무거울수록 커요.',
      '위치 에너지': '높은 곳에 있어서 가진 에너지 mgh (J). 땅(높이 0)을 기준으로 재요.',
      '공기 저항': '공이 공기를 밀고 지나갈 때 받는, 움직임을 방해하는 힘. 가볍고 큰 공(탁구공)일수록 크게 영향을 받아요.',
      '연직': '실에 추를 매달았을 때 실의 방향, 곧 똑바로 위아래 방향. 수직과 같은 뜻으로 써요.'
    },
    keys: [['G', '지구 g 9.8 ↔ 10 m/s²'], ['L', '눈금 자동 맞춤 켜기/끄기'], ['B', '떨어뜨린 공 함께 보기'], ['A', '속도·가속도 화살표 켜기/끄기']]
  });

  // 결과 해설: 패널 맨 위 카드 — 한 줄(line) → '왜 그럴까?' 안 전문(more)
  SK.takeaway(function (p) { return takeawayText(p); });
  function takeawayText(p) {
    if (!st || !st.result || !(st.tLand > 1e-9)) return null;
    var r = st.result, d = eDec(run.E0);
    if (!run.analytic) {
      return {
        line: '공기 저항 때문에 역학적 에너지가 줄었어요.',
        more: fmt(run.E0, d) + ' J → ' + fmt(r.E1, d) + ' J. 줄어든 ' + fmt(run.E0 - r.E1, d) + ' J 는 공이 공기와 부딪히며 열(내부 에너지)로 바뀌었어요. 그래서 수평 거리도 식으로 구한 값보다 짧아요.'
      };
    }
    if (p.cmp && st.cLand !== null && run.vy0 === 0) {
      return {
        line: '던진 공과 떨어뜨린 공이 동시에 닿았어요.',
        more: '두 공 모두 ' + fmt(st.tLand, 2) + ' s 에 땅에 닿았어요. 옆으로 빠르게 던져도 아래로 떨어지는 운동은 같아요. 떨어지는 시간 $t$ = √(2$h$ ÷ $g$) 에는 $v_0$ 가 없어요.'
      };
    }
    if (curPreset === 1) {
      return {
        line: '역학적 에너지는 내내 ' + fmt(run.E0, d) + ' J 로 같았어요.',
        more: '높이가 낮아진 만큼 위치 에너지가 운동 에너지로 바뀌어 착지 속력은 ' + fmt(r.vL, 1) + ' m/s 예요. $v$ = √($v_0$² + 2$gh$) 라서 각도를 바꿔도 착지 속력은 같아요 — 각도만 바꿔 기록해 확인해 봐요.'
      };
    }
    if (p.planet !== 'earth') {
      var re = PH.rangeFor(p, { planet: 'earth' });
      return {
        line: PH.PLANETS[p.planet].name + '에서는 지구보다 약 ' + fmt(r.R / re, 1) + '배 멀리 갔어요.',
        more: PH.PLANETS[p.planet].name + ' ' + fmt(r.R, 1) + ' m, 지구 ' + fmt(re, 1) + ' m (회색 점선). g 가 작으면 천천히 떨어져서 비행 시간이 길어지고, 수평 속도는 같으니 그만큼 더 멀리 가요.'
      };
    }
    if (curPreset === 4 || p.topStop) {
      return {
        line: '최고점에서도 공은 옆으로 움직였어요.',
        more: '최고점의 수평 속도는 ' + fmt(run.vx0, 1) + ' m/s 그대로였어요. 멈춘 게 아니라 수직 속도만 0 이 된 거예요. 가속도는 그때도 아래로 g 예요.'
      };
    }
    if (run.h === 0 && run.theta > 0 && run.theta < 90 && run.theta !== 45) {
      return {
        line: (90 - run.theta) + '°로 던져도 같은 거리를 가요.',
        more: '각도 ' + run.theta + '° → ' + fmt(r.R, 1) + ' m. 더해서 90°인 두 각도는 sin2$θ$ 가 같아서 사거리가 같아요. 가장 멀리 가는 각도는 45°예요(땅에서, 공기 저항 없음).'
      };
    }
    return {
      line: '수평 거리 = 수평 속도 × 비행 시간이에요.',
      more: '옆으로는 ' + fmt(run.vx0, 1) + ' m/s 그대로 ' + fmt(r.T, 2) + ' s 동안 날아가 ' + fmt(r.R, 1) + ' m 앞에 떨어졌어요(' + fmt(run.vx0, 1) + ' × ' + fmt(r.T, 2) + ' = ' + fmt(run.vx0 * r.T, 1) + ').'
    };
  }

  // 정리 질문 (정리 단계 오른쪽 판). 정답 수치는 지금 g 로 계산해 '답 확인하기' 안에 넣는다
  var think1 = SK.think({
    id: 'time',
    q: '수평으로 던진 공이 땅에 닿을 때까지 걸리는 시간을 정하는 것은?',
    choices: ['던지는 높이 $h$', '처음 속력 $v_0$', '공의 질량 $m$'], answer: 1,
    why: '떨어지는 시간 $t$ = √(2$h$ ÷ $g$) 에는 $v_0$ 도 $m$ 도 없어요. 세게 던지면 더 멀리 갈 뿐, 떨어지는 시간은 같아요.',
    reveal: ' '
  });
  SK.think({
    id: 'pair',
    q: '공기 저항이 없을 때, 땅에서 같은 속력으로 30°와 60°로 던지면?',
    choices: ['30°가 더 멀리', '60°가 더 멀리', '같은 거리'], answer: 3,
    why: 'sin(2×30°) = sin(2×60°) 라서 사거리가 같아요. 60°는 더 높이, 더 오래 날지만 옆으로 느려요.'
  });
  SK.think({
    id: 'top',
    q: '최고점에서 공의 속도는?',
    choices: ['0 이에요', '수평 속도 $v_x$ 만 남아요', '처음 속력과 같아요'], answer: 2,
    why: '최고점에서는 수직 속도 $v_y$ 만 0 이에요. 수평 속도는 처음부터 끝까지 $v_0$ cos$θ$ 그대로예요. 가속도는 그때도 아래로 g 예요.'
  });
  SK.think({
    id: 'energy',
    q: '공기 저항이 없을 때 날아가는 동안 역학적 에너지(운동 + 위치)는?',
    choices: ['점점 줄어요', '점점 늘어요', '일정해요'], answer: 3,
    why: '중력만 일을 하면 위치 에너지가 준 만큼 운동 에너지가 늘어요. 그래서 합은 일정해요(역학적 에너지 보존).'
  });
  SK.think({
    id: 'calc',
    q: '지구(g = 10 m/s²)에서 20 m 높이 절벽 위에서 공을 수평으로 10 m/s 로 던졌어요. 몇 m 앞에 떨어질까요?',
    hint: '먼저 떨어지는 시간 $t$ = √(2$h$ ÷ $g$) 를 구하고, 수평 거리 = 수평 속도 × t 로 계산해요.',
    reveal: '20 m 예요. t = √(2 × 20 ÷ 10) = √4 = 2 s, 수평 거리 = 10 m/s × 2 s = 20 m. 실험 카드 ① 에서 지구의 g 를 10 m/s² 으로 바꿔 실행하면 확인할 수 있어요.'
  });
  SK.think({
    id: 'air',
    q: '더 생각하기: 공기 저항이 있으면 가장 멀리 가는 각도는 45°보다 클까, 작을까?',
    hint: '더 많은 설정 › 공기 저항 › 탁구공을 고르고 35°·40°·45°를 차례로 기록해 비교해 봐요.',
    reveal: '작아져요. 탁구공(20 m/s, g = 9.8 m/s²)은 35°쯤에서 가장 멀리(약 10.4 m) 가고, 45°는 10.0 m 예요. 공기 저항이 날아가는 내내 속도를 줄이니, 오래 나는 큰 각도가 더 손해를 봐요. 무거운 쇠공은 영향이 작아 거의 45° 그대로예요.'
  });
  var think1Body = think1 && think1.querySelector('.reveal__body');
  if (run) setTimeout(function () { updateThinkAnswer(run.g); }, 0);
  function updateThinkAnswer(g) {
    if (!think1Body) return;
    function t(hh) { return fmt(Math.sqrt(2 * hh / g), 2); }
    think1Body.textContent = '정답 ① 던지는 높이 h (와 g). 지금 g = ' + gText(g) + ' m/s² 이면 5 m → ' + t(5) + ' s, 20 m → ' + t(20) + ' s, 45 m → ' + t(45) + ' s. 높이가 4배가 되면 시간은 2배예요(√4 = 2).';
  }

  /* ------------------------------------------------------------------
     7. 수업 안내(교사) — 교사 모드에서만, 카드형
     ------------------------------------------------------------------ */
  SK.guide({
    rows: [
      { target: '처음 속력 $v_0$ — 0~30 m/s, 1 단위, 기본 20 (↻)', standard: '[12역학01-02] 정량 설명', discover: '수평 던지기에서 $v_0$ 를 바꿔도 비행 시간은 같고 수평 거리만 $v_0$ 에 비례', misconception: '세게 던지면 늦게 떨어진다' },
      { target: '던지는 각도 $θ$ — 0~90°, 5° 단위, 기본 45 (↻)', standard: '[12역학01-02]', discover: '30°와 60°는 같은 거리, 45° 최대(지면 발사)', misconception: '각도가 클수록 멀리 간다' },
      { target: '던지는 높이 h — 0~45 m, 5 단위, 기본 0 (↻)', standard: '탐구 활동(포물선 운동 동영상 분석), 수평 던지기 대표 문항', discover: '낙하 시간 = √(2h/g). 높이 4배 → 시간 2배', misconception: '—' },
      { target: '어디에서 던질까 — $g$ (m/s²): 지구 9.8/10 · 달 1.62 · 화성 3.71 (↻)', standard: '[12역학01-02] g 가 식에 들어가는 방식', discover: 'g 가 작으면 비행 시간·거리·높이가 커진다(사거리 ∝ 1/g)', misconception: '—' },
      { target: '떨어뜨린 공 함께 보기 (⚡)', standard: '대표 문항(수평 던지기 vs 자유 낙하)', discover: '두 공의 높이가 항상 같다', misconception: '던진 공이 늦게 떨어진다' },
      { target: '더 많은 설정: 공기 저항 · 질량 (↻)', standard: '\'이상적 조건\'의 뜻, 변인 통제, 심화 발문', discover: '공기 저항이 있으면 가벼운 공이 덜 날아가고 최적 각도가 45°보다 작다. 저항이 없으면 질량은 궤적과 무관', misconception: '무거운 공이 빨리 떨어진다' }
    ],
    sections: [
      { title: '성취기준', items: ['[12역학01-02] 뉴턴 운동 법칙으로 포물선 운동을 정량적으로 설명하고 역학적 에너지를 구한다.', '연계 [12물리01-04] 역학적 에너지 보존.', '탐구 활동: 포물선 운동을 하는 물체의 동영상을 분석하여 역학적 에너지 보존 확인하기. (교과서 활동 이름·쪽수는 확인 필요)'] },
      { title: '수업 흐름', items: ['① 예측: 처음 들어오면 사거리 숫자 예측 창이 떠요(입력칸에 예시값·범위는 보이지 않아요). 실험 카드를 누르면 값이 바로 바뀌고 카드별 예측 질문이 떠요. 예측 창이 떠 있는 동안 궤적·기록은 숨겨요.', '② 실행: 끝나면 오른쪽 패널 맨 위에 예측 판정(예측·실제·차이)과 결과 해설 한 줄이 떠요. 해설 전문은 왜 그럴까? 안에 있어요.', '③ 비교: 한 가지만 바꿔 3~5번 기록해요(띠의 기록하기 버튼). 오른쪽 기록 표에서 두 기록을 나란히 비교해요. 눈금 자동 맞춤은 같은 $v_0$·h 면 각도를 바꿔도 눈금이 그대로라 궤적을 바로 견줄 수 있어요.', '④ 정리: 보기 3개 질문 4개(바로 판정) + 계산 1개(힌트 접힘) + 더 생각하기 1개. 답 확인하기 잠금은 교사 설정에서.'] },
      { title: '발문', items: ['각도를 바꿔도 착지 속력이 같을까? (카드 ②, 모둠 활동) → 같은 $v_0$·h 면 √($v_0$² + 2gh) 로 같아요.', '공기 저항을 켜면 가장 멀리 가는 각도는 45°보다 클까 작을까? → 탁구공 20 m/s 에서 약 35°.', '최고점에서 공은 멈출까? → 수평 속도는 그대로, 가속도는 g 아래.'] },
      { title: '조작 메모', items: ['섬광 점(0.1 s 간격)을 누르면 그 순간의 t·x·y·속도와 운동·위치 에너지가 떠요. 동영상 분석 활동처럼 점 몇 개를 골라 합이 같은지 표에 적게 해요. 빈 곳을 누르면 닫혀요.', '실행 전 공을 끌어당겼다 놓으면 $v_0$·θ 가 들어가요(당긴 길이 10u = 1 m/s). 놓아도 실행하지 않아요.', '공기 저항 없음은 해석해(식)로 계산해서 에너지 합이 출렁이지 않아요. 저항 있음은 RK4 (dt = 1/240 s).', '공기 저항을 켜면 질량은 공 종류로 정해져요(쇠공 0.50 kg, 탁구공 0.0027 kg). 달에는 공기가 없어 저항 0, 화성은 공기 밀도 0.020 kg/m³.', '떨어뜨린 공은 같은 높이·같은 연직 속도로 출발하고 옆으로만 움직이지 않는 공이에요. $θ$ = 0°이면 그냥 떨어뜨린 공.'] }
    ],
    keys: 'G 지구 g 9.8/10 m/s² · L 눈금 자동 맞춤 · B 떨어뜨린 공 · A 속도·가속도 화살표'
  });
  // R4: 공통 수업 안내 서랍은 글자(text)로 넣으므로 $v_0$ 수식 · (↻)(⚡) 아이콘을 여기서 바꾼다
  mathify(SK.el.slide && SK.el.slide.querySelector('aside.drawer.teacher-only'));

  /* ------------------------------------------------------------------
     8. 전용 키 (공통 키와 겹치지 않음, 화면에는 쓰지 않음)
     ------------------------------------------------------------------ */
  SK.onKey(function (e) {
    if (e.repeat) return false;
    switch (e.code) {
      case 'KeyG':
        if (SK.get('planet') !== 'earth') { SK.notice('9.8 / 10 바꾸기는 지구에서만 써요', 'info'); return true; }
        SK.set('gEarth', SK.get('gEarth') === 10 ? 9.8 : 10);
        SK.notice('지구 g = ' + gText(SK.get('gEarth')) + ' m/s²', 'info');
        return true;
      case 'KeyL':
        SK.set('autoScale', !SK.get('autoScale'));
        SK.notice(SK.get('autoScale') ? '눈금 자동 맞춤 켬' : '눈금 자동 맞춤 끔 — 지금 눈금 그대로', 'info');
        return true;
      case 'KeyB': SK.set('cmp', !SK.get('cmp')); return true;
      case 'KeyA':
        var on = !(SK.get('showV') || SK.get('showA'));
        SK.set('showV', on); SK.set('showA', on);
        return true;
    }
    return false;
  });

  /* ------------------------------------------------------------------
     9. 공을 당겨서 v₀·θ 넣기 (pointer events: 마우스·펜·터치)
     ------------------------------------------------------------------ */
  var cv = SK.view.canvas;
  function startPx() { return { x: L.X0, y: L.GY - (run ? run.h : 0) * map.S }; }
  cv.addEventListener('pointerdown', function (e) {
    if (!run || SK.predicting()) return;
    var q = SK.view.toLogical(e), b = startPx();
    var nearBall = Math.hypot(q.x - b.x, q.y - b.y) <= 52;
    if (!nearBall || SK.started) {
      var hit = SK.params.flash ? flashAt(q) : -1;
      if (hit >= 0 || pick >= 0) { pick = hit; SK.requestRender(); return; }
      if (!nearBall) return;
      if (!SK.finished) { SK.notice('실행이 끝난 뒤에 당길 수 있어요', 'info'); return; }
      SK.reset();   // 끝난 뒤 던진 자리를 누르면 실행만 처음으로 → 바로 당기기
      b = startPx();
    }
    drag = { x: q.x, y: q.y, v: null };
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
    e.preventDefault();
    SK.requestRender();
  });
  cv.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var q = SK.view.toLogical(e), b = startPx();
    drag.x = q.x; drag.y = q.y;
    drag.v = PH.pullValues(b.x - q.x, q.y - b.y);
    SK.requestRender();
  });
  function flashAt(q) {
    var best = -1, bd = 30, S = map.S;
    for (var i = 0; i < st.flash.length; i++) {
      var f = st.flash[i];
      var d = Math.hypot(L.X0 + f[1] * S - q.x, L.GY - f[2] * S - q.y);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  function endDrag(apply) {
    if (!drag) return;
    var v = drag.v; drag = null;
    if (apply && v && v.len >= 12) {
      SK.set('theta', v.theta); SK.set('v0', v.v0);
      SK.notice('$v_0$ ' + v.v0 + ' m/s · ' + v.theta + '° — ▶ 실행해요', 'info');
    }
    SK.requestRender();
  }
  cv.addEventListener('pointerup', function () { endDrag(true); });
  cv.addEventListener('pointercancel', function () { endDrag(false); });

  /* ------------------------------------------------------------------
     10. 상태 연결
     ------------------------------------------------------------------ */
  function syncUI() {
    var u = SK.ui;
    var airOn = u.air !== 'off';
    SK.controls.m.enable(!airOn);
    mHint.textContent = airOn ? PH.BALLS[u.air].name + '을 골라서 질량은 ' + (u.air === 'steel' ? '0.50' : '0.0027') + ' kg 으로 정해져요' : '';
    mHint.hidden = !airOn;
    SK.controls.gEarth.el.hidden = u.planet !== 'earth';
    SK.controls.k4.enable(!!u.kCustom);
    var earthSub = SK.controls.planet.el.querySelector('.seg__opt .btn__sub');
    if (earthSub) earthSub.textContent = 'g = ' + gText(u.gEarth) + ' m/s²';
  }

  function onReset(p) {
    run = PH.buildRun(p);
    st = PH.newState(run);
    // 중립 눈금: 이 v₀·h·g 로 어느 각도로 던져도 들어가는 크기 → 눈금이 답(떨어지는 곳)을 미리 알려 주지 않고,
    // 각도만 바꿔 비교할 때 눈금이 그대로라 궤적을 바로 견줄 수 있다
    var mr = maxReach(p);
    autoBox = boxFor(Math.max(mr.R, run.R), Math.max(mr.H, run.H));
    holdUntil = 0; pick = -1;
    updateFormula(p);
    updateThinkAnswer(run.g);
    syncUI();
  }

  function physStep(dt, p) {
    if (!st || SK.finished) return;
    if (st.hold && performance.now() < holdUntil) { SK.time = st.t - dt; return; }   // 최고점 정지 직후 같은 프레임의 남은 걸음 무시
    st.hold = false;
    if (st.landed && (st.cLanded || !p.cmp)) { finishRun(p); return; }
    var e = PH.advance(st, run, dt, !!p.topStop);
    SK.time = st.t - dt;   // 공통 틀이 곧 dt 를 더함 → SK.time = st.t
    if (e.top) {
      st.hold = true; holdUntil = performance.now() + 30;
      SK.pause();
      SK.notice('최고점: 화면만 멈춤 — 공은 계속 움직여요', 'ok', 4500);   // R5: 공이 멈춘다는 오개념 방지 (28자 이내)
      SK.say('최고점이에요. 아래 ▶ 이어서 실행', 6000);
      return;
    }
    if (st.landed && (st.cLanded || !p.cmp)) finishRun(p);
  }

  function finishRun(p) {
    if (SK.finished) return;
    // R3: 상태 칩·'시간 t' 계기판·띠 문장이 모두 같은 st.tLand. SK.finish 가 칩을 바로 그리므로 그때는 tLand,
    // 그 뒤 공통 틀이 dt 를 한 번 더하므로 끝나면 tLand - DT 로 되돌린다
    SK.time = st.tLand;
    var E = PH.energy(run, st);
    st.result = {
      T: st.tLand, R: st.x, H: run.analytic ? run.H : st.maxY,
      vL: Math.sqrt(st.vx * st.vx + st.vy * st.vy), E0: run.E0, E1: E.E
    };
    // 끝 안내는 띠 문장(6초) — 그다음 공통 문장 '기록하기 버튼으로 결과를 저장해요'
    var msg = st.tLand < 1e-9
      ? (run.v0 > 0 ? '땅에서 0°면 바로 닿아요. 각도를 키워요' : '공이 그대로예요. 속력이나 높이를 키워요')
      : '착지! ' + fmt(st.tLand, 2) + ' s 동안 ' + fmt(st.x, 1) + ' m 날았어요';
    SK.finish(msg);
    SK.time = st.tLand - DT;
  }

  function thin(pts, max) {
    if (pts.length <= max) return pts.slice();
    var out = [], step = (pts.length - 1) / (max - 1);
    for (var i = 0; i < max - 1; i++) out.push(pts[Math.round(i * step)]);
    out.push(pts[pts.length - 1]);
    return out;
  }
  function onCapture(p) {
    if (!st || !SK.started) return null;
    var r = st.result || {};
    var fl = st.flash.map(function (f) { return [f[1], f[2]]; });
    if (fl.length > 200) { var k = Math.ceil(fl.length / 200), o = []; for (var i = 0; i < fl.length; i += k) o.push(fl[i]); fl = o; }
    return {
      series: { path: thin(st.trail, 300), flash: fl },
      values: {
        T: r.T, R: r.R, H: r.H !== undefined ? r.H : (run.analytic && st.topDone ? run.H : undefined),
        vL: r.vL, E0: run.E0, E1: r.E1, gtxt: gText(run.g), mtxt: mText(p),
        E0t: fmt(run.E0, eDec(run.E0)), E1t: r.E1 === undefined ? undefined : fmt(r.E1, eDec(run.E0))
      }
    };
  }
  function onSave() {
    return {
      t: st.t, n: st.n, x: st.x, y: st.y, vx: st.vx, vy: st.vy, yc: st.yc, vyc: st.vyc,
      landed: st.landed, cLanded: st.cLanded, tLand: st.tLand, cLand: st.cLand, maxY: st.maxY,
      topDone: st.topDone, tTopSeen: st.tTopSeen, flashIdx: st.flashIdx,
      trailN: st.trail.length, flashN: st.flash.length, result: st.result
    };
  }
  function onLoad(s) {
    for (var k in s) if (k !== 'trailN' && k !== 'flashN') st[k] = s[k];
    st.trail.length = s.trailN; st.flash.length = s.flashN; st.hold = false;
    if (pick >= st.flash.length) pick = -1;
  }

  function onStatus(p) {
    if (!p || !p.planet) return [];
    var g = PH.gOf(p);
    var out = [PH.PLANETS[p.planet].name + ' · {{중력 가속도}} $g$ = ' + gText(g) + ' m/s²'];   // R4 마무리: 칩 안 g 도 수식 표기
    out.push(p.air === 'off' ? '공기 저항 없음' : '공기 저항: ' + PH.BALLS[p.air].name + (PH.kOf(p) === 0 ? ' (공기 없음)' : ''));
    if (!p.autoScale) out.push('눈금 고정');
    return out;
  }

  /* 식으로 계산해 보기 (말 → 식 → 지금 값) */
  function updateFormula(p) {
    var r = run, g = gText(r.g), vs = fmt(r.vy0, 1), vc = fmt(r.vx0, 2), hh = fmt(r.h, 0);
    var A = PH.buildRun({ planet: p.planet, gEarth: p.gEarth, air: 'off', h: p.h, v0: p.v0, theta: p.theta, m: p.m, kCustom: false, k4: p.k4 });
    var items = [
      ['비행 시간 — 땅에 닿을 때까지', '$T$ = ($v_0$ sin$θ$ + √(($v_0$ sin$θ$)² + 2$gh$)) ÷ $g$', '= (' + vs + ' + √(' + vs + '² + 2×' + g + '×' + hh + ')) ÷ ' + g + ' = ' + fmt(A.T, 2) + ' s'],
      ['수평 거리 — 옆으로는 같은 빠르기', '$R$ = $v_0$ cos$θ$ × $T$', '= ' + vc + ' × ' + fmt(A.T, 2) + ' = ' + fmt(A.R, 1) + ' m'],
      ['최고 높이 — 수직 속도가 0 이 될 때', '$H$ = $h$ + ($v_0$ sin$θ$)² ÷ 2$g$', '= ' + hh + ' + ' + vs + '² ÷ (2×' + g + ') = ' + fmt(A.H, 1) + ' m'],
      ['착지 속력 — 역학적 에너지 보존', '$v$ = √($v_0$² + 2$gh$)', '= √(' + fmt(r.v0, 0) + '² + 2×' + g + '×' + hh + ') = ' + fmt(A.vL, 1) + ' m/s']
    ];
    formulaBox.innerHTML = '';
    items.forEach(function (it) {
      formulaBox.appendChild(h('div', { class: 'pe-formula__item' }, [h('b', { text: it[0] }), h('code', null, SK.mathNodes(it[1])), h('code', { text: it[2] })]));
    });
    if (!r.analytic) {
      formulaBox.appendChild(h('p', { class: 'pe-hint', text: '지금은 공기 저항이 있어서 실제 값이 식과 달라요: T ' + fmt(r.T, 2) + ' s, R ' + fmt(r.R, 1) + ' m, 착지 ' + fmt(r.vL, 1) + ' m/s. (k = ' + fmt(r.k * 1e4, 1) + '×10⁻⁴ kg/m)' }));
    }
  }

  /* ------------------------------------------------------------------
     11. 그리기
     ------------------------------------------------------------------ */
  function niceCell(S) {
    var c = [0.5, 1, 2, 5, 10, 20, 50, 100, 200];
    for (var i = 0; i < c.length; i++) if (c[i] * S >= 46) return c[i];
    return 200;
  }
  function numTxt(v) { return (Math.round(v * 10) / 10).toString(); }

  function onRender(view, p) {
    if (!run) return;
    var ctx = view.ctx, W = view.w, H = view.h;
    var B = currentBox();
    // R4: 세로 여유 EX(16:9 = 0). 바닥을 아래에 붙였으므로(offsetY = extra) 그리기 맨 위는 y = −EX
    var EX = view.offsetY || 0, YMIN = -EX;
    // 위쪽 상태 칩·범례 아래로만 (해설은 패널로 옮겨져 화면 위에 없음 — 예전 궤적 하강 코드는 지움)
    // TOPY = 16:9 와 같은 값(축척 S 를 정함 → 모눈 1칸 그대로). TOPD = 칩 아래 실제 그리기 위쪽 = TOPY − EX
    var TOPY = Math.max(L.TOP, Math.min(Math.ceil((SK.stageInset().top + 24) / 20) * 20, 260));
    var TOPD = TOPY - EX;
    var SIMPLE = SK.isSimple && SK.isSimple(), TS = SIMPLE ? 28 : 22;   // R6(A2): 심플 = 축·눈금·기록 글자 28u (좌표 계산은 그대로)
    var pred = SK.predicting();   // 예측 창이 떠 있는 동안: 결과 층(궤적·섬광·기록·지구 비교선) 숨김, 방향 화살표·앞 30% 점선만
    var S = Math.min((L.RIGHT - L.X0) / B.x, (L.GY - TOPY) / B.y);
    map.S = S;
    function sx(x) { return L.X0 + x * S; }
    function sy(y) { return L.GY - y * S; }
    function mp(x, y) { return [sx(x), sy(y)]; }
    var cell = niceCell(S);
    // 눈금 숫자 간격(모눈 칸 수). 심플: 숫자는 5 m 의 배수에만 (모눈 간격은 그대로). 5 m 배수가 두 개도 안 들어가면 보통 규칙
    function tickEvery(minPx) {
      var k = Math.max(1, Math.ceil(minPx / (cell * S)));
      if (!SIMPLE || cell >= 5 || Math.max(B.x, B.y) < 10) return k;
      while (Math.abs(k * cell / 5 - Math.round(k * cell / 5)) > 1e-6) k++;
      return k;
    }
    var C = {
      grid: SK.color('--color-grid'), line: SK.color('--color-line-strong'), ink: SK.color('--color-ink'),
      muted: SK.color('--color-ink-muted'), sunk: SK.color('--color-paper-sunk'), raised: SK.color('--color-paper-raised'),
      sim: SK.color('--color-sim-projectile'), scrim: SK.color('--color-paper-scrim')
    };

    // 모눈
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
    ctx.beginPath();
    for (var gx = 0; sx(gx) <= W; gx += cell) { ctx.moveTo(sx(gx), YMIN); ctx.lineTo(sx(gx), L.GY); }   // R4: 넓어진 하늘(y = −EX)까지
    for (var gy = 0; sy(gy) >= YMIN; gy += cell) { ctx.moveTo(L.AX, sy(gy)); ctx.lineTo(W, sy(gy)); }
    ctx.stroke();
    // 지면
    ctx.fillStyle = C.sunk; ctx.fillRect(0, L.GY, W, H - L.GY);
    ctx.strokeStyle = C.line; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, L.GY); ctx.lineTo(W, L.GY); ctx.stroke();
    // 절벽(발사대)
    if (run.h > 0) {
      var cy = sy(run.h);
      ctx.fillStyle = C.sunk; ctx.fillRect(L.AX + 4, cy, L.X0 - L.AX - 4, L.GY - cy);
      ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.strokeRect(L.AX + 4, cy, L.X0 - L.AX - 4, L.GY - cy);
      ctx.strokeStyle = C.ink; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(L.AX + 4, cy); ctx.lineTo(L.X0, cy); ctx.stroke();
    } else {
      ctx.fillStyle = C.line; ctx.fillRect(L.X0 - 24, L.GY - 6, 48, 6);
    }
    // 왼쪽 벽 자 (y축)
    ctx.strokeStyle = C.line; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(L.AX, L.GY); ctx.lineTo(L.AX, YMIN); ctx.stroke();
    ctx.font = SK.font(400, TS); ctx.fillStyle = C.muted;   // 눈금 숫자 400
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    var ky = tickEvery(SIMPLE ? 44 : 32), yTickW = 0;
    for (var iy = 1; sy(iy * cell) >= TOPD - 30; iy++) {
      if (iy % ky) continue;
      var yy = sy(iy * cell);
      ctx.fillRect(L.AX - 8, yy - 1, 8, 2);
      ctx.fillText(numTxt(iy * cell), L.AX - 12, yy);
      yTickW = Math.max(yTickW, ctx.measureText(numTxt(iy * cell)).width);
    }
    // x 눈금 (지면 아래) — 오른쪽 끝은 축 이름 자리
    // R6(A3): 축 이름을 8u 올려(GY+40 → +32) 1920 에서 글자 아래가 캔버스 밖으로 잘리지 않게. 심플(28u)은 눈금 숫자와 같은 줄
    // 심플: 같은 줄에 긴 이름을 두면 떨어진 공(사거리 ≈ 오른쪽 끝의 1/1.1)이 가려서 짧게 — 이름은 아래 측정 칸 '수평 거리 x'
    var XT = SIMPLE ? '$x$ (m)' : '수평 거리 $x$ (m)', xTitleY = SIMPLE ? L.GY + 8 : L.GY + 32;
    var xTitleL = W - 12 - SK.measure(ctx, XT, { size: TS, weight: 500 }).w;
    ctx.font = SK.font(400, TS);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    var kx = tickEvery(SIMPLE ? 110 : 70);
    for (var ix = 0; sx(ix * cell) <= W - 110; ix++) {
      if (ix % kx) continue;
      var xx = sx(ix * cell), xl = numTxt(ix * cell), xw = ctx.measureText(xl).width;
      if (xx + xw / 2 > xTitleL - 16 && (SIMPLE || L.GY + 12 + TS > xTitleY)) break;   // 축 이름과 겹치는 눈금 숫자는 빼기
      ctx.fillRect(xx - 1, L.GY, 2, 8);
      ctx.fillText(xl, xx, SIMPLE ? L.GY + 10 : L.GY + 12);
    }
    // 축 이름: 그래프 바깥 가장자리 (x: 오른쪽 아래 끝, y: 왼쪽 위 끝)
    // R3: 지면 띠 안 글자 위계는 하나 (muted). R4: 축 이름 500 · 기호는 수식 표기. y축 제목은 눈금 숫자 왼쪽 바깥
    var AXO = { size: TS, weight: 500, color: '--color-ink-muted', baseline: 'top' };
    SK.text(ctx, XT, W - 12, xTitleY, { size: TS, weight: 500, color: '--color-ink-muted', baseline: 'top', align: 'right' });
    // R4: 캔버스 왼쪽 여백(ox)이 없는 태블릿에서 제목이 잘리지 않게 글자 높이(26)만큼은 안쪽으로 (16:9 는 여백이 있어 그대로)
    var yTitleRight = L.AX - 12 - yTickW - 14, yTitleMin = TS + 4 - view.ox / (view.scale || 1);
    if (yTitleMin > yTitleRight) {
      // R4 마무리: 여백이 없는 태블릿(ox 0)에서는 세로 제목이 눈금 숫자와 겹치므로 y축 위 끝에 가로로 (16:9 는 여백이 있어 아래 세로 제목 그대로)
      SK.text(ctx, '높이 $y$ (m)', L.AX + 10, TOPD + 6, { size: TS, weight: 500, color: '--color-ink-muted', baseline: 'top', align: 'left' });
    } else {
      ctx.save(); ctx.translate(Math.max(12, yTitleRight), (TOPD + L.GY) / 2); ctx.rotate(-Math.PI / 2);
      SK.text(ctx, '높이 $y$ (m)', 0, 0, { size: TS, weight: 500, color: '--color-ink-muted', baseline: 'bottom', align: 'center' }); ctx.restore();
    }
    // 눈금 크기: x 축 왼쪽 아래
    // 심플: 눈금 숫자 줄과 겹치므로 빼기(숫자만으로 읽음)
    if (!SIMPLE) SK.text(ctx, '모눈 1칸 = ' + numTxt(cell) + ' m', 8, L.GY + 32, AXO);

    // 달·화성: 같은 조건으로 지구에서 던졌다면 (회색 점선)
    if (p.planet !== 'earth' && run.analytic && !pred) {
      var gE = p.gEarth, vx0 = run.vx0, vy0 = run.vy0, TE = (vy0 + Math.sqrt(vy0 * vy0 + 2 * gE * run.h)) / gE;
      var ep = [];
      for (var k = 0; k <= 40; k++) { var tk = TE * k / 40; ep.push([vx0 * tk, Math.max(0, run.h + vy0 * tk - 0.5 * gE * tk * tk)]); }
      SK.drawPath(ctx, ep, { color: C.muted, dash: [6, 6], width: 2.5 }, mp);
      var eEnd = ep[ep.length - 1];
      SK.placeLabel(ctx, [{ x: Math.min(sx(eEnd[0]) + 8, W - 150), y: L.GY - 24, text: '지구에서라면', anchor: 'left', color: '--color-ink-muted', size: TS }]);
    }

    // 기록·직전 실행 궤적 (색 + 선 모양) + 섬광 점
    var recLabels = [];
    function drawRun(series, style, lab) {
      if (!series || !series.path) return;
      SK.drawPath(ctx, series.path, style, mp);
      if (series.flash && p.flash) {
        ctx.fillStyle = style.color;
        for (var i = 0; i < series.flash.length; i++) {
          var f = series.flash[i];
          ctx.beginPath(); ctx.arc(sx(f[0]), sy(f[1]), 5, 0, Math.PI * 2); ctx.fill();
        }
      }
      if (lab) {
        var e = series.path[series.path.length - 1];
        recLabels.push({ x: Math.min(sx(e[0]), W - 110), y: Math.max(sy(e[1]) - 24, TOPD), text: lab, color: style.color, size: TS });
      }
    }
    if (!pred) {
      SK.records.forEach(function (r) { drawRun(r.series, SK.recStyle(r.slot), SK.recLabel(r)); });
      if (SK.ghost) drawRun(SK.ghost.series, SK.ghostStyle(), null);
      if (recLabels.length) SK.placeLabel(ctx, recLabels);
      // 지금 실행
      SK.drawPath(ctx, st.trail.concat([[st.x, st.y]]), { color: C.sim, dash: [], width: 4 }, mp);
    }
    if (p.flash && !pred) {
      for (var fi = 0; fi < st.flash.length; fi++) {
        var f = st.flash[fi];
        if (p.cmp) {   // 같은 시각의 두 공을 잇는 가는 가로선
          ctx.strokeStyle = C.muted; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
          ctx.beginPath(); ctx.moveTo(L.X0, sy(f[3])); ctx.lineTo(sx(f[1]), sy(f[2])); ctx.stroke(); ctx.setLineDash([]);
          ctx.strokeStyle = C.muted; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(L.X0, sy(f[3]), 7, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.fillStyle = C.sim; ctx.globalAlpha = 0.6;
        ctx.beginPath(); ctx.arc(sx(f[1]), sy(f[2]), 8, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    var bx = sx(st.x), by = sy(st.y);
    // 실행 전: 출발 방향 미리보기(앞부분만 점선 — 떨어지는 곳은 숨김) + 빈 상태 안내
    if (!SK.started && !drag && run.v0 > 0) {
      var Tp = Math.min(run.T * 0.3, run.tTop > 0 ? run.tTop * 0.7 : run.T * 0.3), pv = [];
      for (var j = 0; j <= 16; j++) {
        var tj = Tp * j / 16;
        pv.push([run.vx0 * tj, run.h + run.vy0 * tj - 0.5 * run.g * tj * tj]);
      }
      if (Tp > 0) SK.drawPath(ctx, pv, { color: C.sim, dash: [3, 7], width: 3 }, mp);
    }
    if (!SK.started && !drag && !pred) {
      // R4: '▶' 글자 → 공통 play 아이콘 (글 · 아이콘 · 글을 가운데 맞춤)
      var ecx = (L.X0 + L.RIGHT) / 2 + 60, ecy = Math.max(300, TOPY + 60);
      var eo = { size: 30, weight: 500, color: '--color-ink' }, eA = '아래 ', eB = ' 실행을 눌러 던져 보세요', eI = 28;
      var ewA = SK.measure(ctx, eA, eo).w, ewB = SK.measure(ctx, eB, eo).w, ex0 = ecx - (ewA + eI + ewB) / 2;
      SK.text(ctx, eA, ex0, ecy, eo);
      SK.drawIcon(ctx, 'play', ex0 + ewA + eI / 2, ecy, eI, { color: '--color-ink' });
      SK.text(ctx, eB, ex0 + ewA + eI, ecy, eo);
      SK.text(ctx, '공을 뒤로 끌어당겨 속력과 각도를 정할 수도 있어요', ecx, Math.max(344, TOPY + 104), { size: 24, weight: 400, color: '--color-ink-muted', align: 'center' });
    }
    // 그림자 (바닥: 수평 운동, 왼쪽 벽: 수직 운동)
    if (p.shadow) {
      ctx.strokeStyle = C.muted; ctx.lineWidth = 1.5; ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, L.GY); ctx.moveTo(bx, by); ctx.lineTo(L.AX, by); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = C.sim;
      ctx.beginPath(); ctx.arc(bx, L.GY, 9, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(L.AX, by, 9, 0, Math.PI * 2); ctx.fill();
    }
    // 떨어뜨린 공 (회색)
    if (p.cmp) {
      var cyy = sy(st.yc);
      ctx.fillStyle = C.line; ctx.strokeStyle = C.muted; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(L.X0, cyy, BALL_R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (p.flash || p.shadow) {
        ctx.strokeStyle = C.muted; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(L.X0, cyy); ctx.lineTo(bx, by); ctx.stroke();
      }
    }
    // 공
    ctx.fillStyle = C.sim; ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(bx, by, BALL_R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // 화살표 (라벨은 겹치지 않게 placeLabel)
    var moving = !st.landed && SK.started, labs = [];
    if (p.showV && moving) {
      var tx = bx + st.vx * VS, ty = by - st.vy * VS;
      SK.arrow(ctx, bx, by, tx, by, { color: '--color-q-velocity', width: 3, dash: [8, 6] });
      SK.arrow(ctx, bx, by, bx, ty, { color: '--color-q-velocity', width: 3, dash: [8, 6] });
      SK.arrow(ctx, bx, by, tx, ty, { color: '--color-q-velocity', width: 5 });
      // R3: 이름표는 화살 끝에서 12u 바깥 (자취·화살과 겹치지 않게)
      var vl = Math.hypot(tx - bx, ty - by) || 1, ux = (tx - bx) / vl, uy = (ty - by) / vl, LH = VLAB_H / 2;
      if (Math.abs(st.vx) > 1) labs.push({ x: tx + 12, y: by, text: '수평 속도', anchor: 'left', color: '--color-q-velocity', size: 22 });
      if (Math.abs(st.vy) > 1) labs.push({ x: bx - 8, y: ty + (st.vy > 0 ? -(12 + LH) : 12 + LH), ax: bx, ay: ty, text: '수직 속도', anchor: 'right', color: '--color-q-velocity', size: 22 });
      labs.push({ x: tx + 12 * ux, y: ty + 12 * uy + uy * LH, ax: tx, ay: ty, text: '속도 $v$', anchor: ux < -0.3 ? 'right' : 'left', color: '--color-q-velocity', size: 22 });
    } else if (p.showV && !SK.started && run.v0 > 0) {
      // 실행 전: 던지는 방향 화살표
      var th0 = run.theta * Math.PI / 180, ln0 = Math.max(40, run.v0 * VS);
      SK.arrow(ctx, bx, by, bx + Math.cos(th0) * ln0, by - Math.sin(th0) * ln0, { color: '--color-q-velocity', width: 5 });
      labs.push({ x: bx + Math.cos(th0) * ln0 + 10, y: by - Math.sin(th0) * ln0, text: '$v_0$ ' + run.v0 + ' m/s · ' + run.theta + '°', anchor: 'left', color: '--color-q-velocity', size: 22 });
    }
    if (p.showA && moving) {
      if (run.analytic) {
        SK.arrow(ctx, bx, by, bx, by + ACC_LEN, { color: '--color-q-force', width: 5 });
        labs.push({ x: bx - 12, y: by + ACC_LEN, text: '가속도 $g$', anchor: 'right', color: '--color-q-force', size: 22 });
      } else {
        var a = PH.accel(st.vx, st.vy, run.g, run.km), am = Math.hypot(a[0], a[1]);
        if (am > 0) {
          var axe = bx + a[0] / am * ACC_LEN * am / run.g, aye = by - a[1] / am * ACC_LEN * am / run.g;
          SK.arrow(ctx, bx, by, axe, aye, { color: '--color-q-force', width: 5 });
          labs.push({ x: axe - 12, y: aye, text: '가속도', anchor: 'right', color: '--color-q-force', size: 22 });
        }
      }
    }
    if (labs.length) vecLabels(ctx, labs, [{ x: bx - BALL_R, y: by - BALL_R, w: BALL_R * 2, h: BALL_R * 2 }]);

    // 최고점에서 멈췄을 때: 짧은 라벨
    if (st.hold || (st.topDone && SK.started && !SK.running && !SK.finished && Math.abs(st.vy) < 1e-6)) {
      label(ctx, [
        '최고점 — 화면만 잠깐 멈춤',
        '수평 속도 ' + fmt(st.vx, 1) + ' m/s (그대로)',
        '수직 속도 ' + fmt(Math.abs(st.vy) < 0.05 ? 0 : st.vy, 1) + ' m/s'
      ], bx, by + 60, W, C, 'side');
    }

    // 눈금 고정에서 화면 밖: 가장자리 화살표 + 좌표
    if (bx > W - 6 || by < YMIN + 6) {   // R4: 화면 위 끝 = y −EX (hFull 기준)
      var ex = Math.min(bx, W - 30), ey = Math.max(by, YMIN + 30);
      var dx = bx - ex, dy = by - ey, dl = Math.hypot(dx, dy) || 1;
      SK.arrow(ctx, ex - dx / dl * 40, ey - dy / dl * 40, ex, ey, { color: '--color-ink', width: 4 });
      SK.text(ctx, '화면 밖 (' + numTxt(st.x) + ', ' + numTxt(st.y) + ') m', W - 12, ey + 16, { size: TS, weight: 500, color: '--color-ink', align: 'right', baseline: 'top' });
    }

    // 당기기 미리 보기
    if (drag && drag.v) {
      var b0 = startPx();
      ctx.strokeStyle = C.muted; ctx.lineWidth = 3; ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.moveTo(b0.x, b0.y); ctx.lineTo(drag.x, drag.y); ctx.stroke(); ctx.setLineDash([]);
      var th = drag.v.theta * Math.PI / 180, len = drag.v.v0 * VS * 2;
      SK.arrow(ctx, b0.x, b0.y, b0.x + Math.cos(th) * len, b0.y - Math.sin(th) * len, { color: '--color-q-velocity', width: 6 });
      label(ctx, ['처음 속력 ' + drag.v.v0 + ' m/s · 각도 ' + drag.v.theta + '°'], drag.x, drag.y - 40, W, C);
    } else if (!SK.started && !drag) {
      ctx.strokeStyle = C.sim; ctx.lineWidth = 2; ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.arc(L.X0, sy(run.h), BALL_R + 12, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }

    // 고른 섬광 점: 그 순간 값 (운동 + 위치 = 합)
    if (pick >= 0 && st.flash[pick] && !pred) {
      var pf = st.flash[pick], px = sx(pf[1]), py = sy(pf[2]);
      var pv2 = pf[4] * pf[4] + pf[5] * pf[5], pK = 0.5 * run.m * pv2, pU = run.m * run.g * Math.max(0, pf[2]);
      var pd = eDec(run.E0);
      ctx.strokeStyle = C.ink; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(px, py, 13, 0, Math.PI * 2); ctx.stroke();
      label(ctx, [
        '$t$ = ' + fmt(pf[0], 2) + ' s   $x$ = ' + fmt(pf[1], 1) + ' m   $y$ = ' + fmt(pf[2], 1) + ' m',
        '수평 ' + fmt(pf[4], 1) + ' · 수직 ' + fmt(pf[5], 1) + ' · 속력 ' + fmt(Math.sqrt(pv2), 1) + ' m/s',
        '운동 ' + fmt(pK, pd) + ' J + 위치 ' + fmt(pU, pd) + ' J = ' + fmt(pK + pU, pd) + ' J'
      ], px, py - 22, W, C);
    }

    updateLegend(p);
    meters.update({ t: st.landed && st.tLand !== null ? st.tLand : st.t, x: st.x, vx: st.vx, vy: st.vy });
    drawEnergy(p);
  }

  /**
   * R3: 화살표 이름표 — 공통 placeLabel 과 같은 겹침 피하기에, 배경은 --color-paper-label 둥근 4u 상자,
   * 밀려난 이름표의 보조선은 그 화살과 같은 색 1px (회색 굵은 선이 자취와 겹쳐 보이던 것)
   */
  var VLAB_H = 22 * 1.2 + 6;
  function vecLabels(ctx, items, avoid) {
    var placed = (avoid || []).slice(), padX = 6, hgt = VLAB_H;
    var bg = SK.color('--color-paper-label') || 'rgba(251,248,239,0.85)';
    items.forEach(function (it) {
      ctx.save();
      var to = { size: it.size || 22, weight: 500 };   // R4: 에스코어 500 + 기호는 수식($v$)
      var w = SK.measure(ctx, it.text, to).w + padX * 2;
      var x0 = it.anchor === 'right' ? it.x - w : it.anchor === 'center' ? it.x - w / 2 : it.x;
      var y0 = it.y - hgt / 2, dy = 0, tries = 0;
      function hit(y) {
        for (var i = 0; i < placed.length; i++) { var q = placed[i]; if (x0 < q.x + q.w && x0 + w > q.x && y < q.y + q.h && y + hgt > q.y) return true; }
        return false;
      }
      while (hit(y0 + dy) && tries < 24) { tries++; dy = (tries % 2 ? -1 : 1) * Math.ceil(tries / 2) * 8; }
      var box = { x: x0, y: y0 + dy, w: w, h: hgt };
      placed.push(box);
      var col = SK.color(it.color || '--color-ink');
      if (Math.abs(dy) > 12) {   // 보조선: 화살 끝(ax, ay)에서 상자 가장자리까지
        var lx = it.ax !== undefined ? it.ax : it.x, ly = it.ay !== undefined ? it.ay : it.y;
        ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(Math.max(box.x, Math.min(lx, box.x + w)), ly < box.y ? box.y : box.y + hgt); ctx.stroke();
      }
      ctx.fillStyle = bg;
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(box.x, box.y, w, hgt, 4); ctx.fill(); } else ctx.fillRect(box.x, box.y, w, hgt);
      ctx.fillStyle = col;
      SK.text(ctx, it.text, box.x + padX, box.y + hgt / 2, to);
      ctx.restore();
    });
  }

  /** 실험 화면 위 작은 말풍선 (최고점·섬광 점·당기기) */
  function label(ctx, lines, x, y, W, C, side) {
    var to = { size: 22, weight: 500, baseline: 'top' };   // R4: SK.text (수식 $t$ $x$ $y$)
    var w = 0;
    lines.forEach(function (t) { w = Math.max(w, SK.measure(ctx, t, to).w); });
    var pw = w + 28, ph = lines.length * 30 + 16, yMin = 8 - ((SK.view && SK.view.offsetY) || 0);   // R4: 넓어진 하늘 위 끝
    var lx = Math.max(8, Math.min(x - pw / 2, W - pw - 8)), ly = Math.max(yMin, y - ph);
    if (side) {   // 공 왼쪽에 두고, 자리가 없으면 오른쪽
      lx = x - BALL_R - 40 - pw;
      if (lx < L.AX + 8) lx = Math.min(x + BALL_R + 40, W - pw - 8);
    }
    ctx.fillStyle = C.scrim; ctx.strokeStyle = C.line; ctx.lineWidth = 1.5;
    roundRect(ctx, lx, ly, pw, ph, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.ink;
    lines.forEach(function (t, i) { SK.text(ctx, t, lx + 14, ly + 10 + i * 30, to); });
  }
  function roundRect(ctx, x, y, w, hh, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + hh - r); ctx.quadraticCurveTo(x + w, y + hh, x + w - r, y + hh);
    ctx.lineTo(x + r, y + hh); ctx.quadraticCurveTo(x, y + hh, x, y + hh - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }

  /** 에너지 막대 (가로 한 줄): [운동 | 위치 | 열] 이어 붙인 막대 + 처음 에너지 눈금 + 아래 글자 */
  function drawEnergy(p) {
    var ctx = ev.ctx, W = ev.w, H = ev.h;
    ev.clear();
    if (W < 60 || H < 40) return;
    var ink = SK.color('--color-ink'), muted = SK.color('--color-ink-muted');
    var d = eDec(run.E0);
    var E = PH.energy(run, st);
    var K = Math.max(0, E.K), U = Math.max(0, E.U), heat = Math.max(0, E.heat);
    // R4: 제목·합 500, 안내 400 (SK.text, baseline top)
    SK.text(ctx, '역학적 에너지', 12, 4, { size: 22, weight: 500, color: '--color-ink', baseline: 'top' });
    if (!p.energy) {
      SK.text(ctx, '화면에 표시하기에서 켜요', 12, 34, { size: 22, weight: 400, color: '--color-ink-muted', baseline: 'top' });
      return;
    }
    SK.text(ctx, '합 ' + fmt(K + U, d) + ' J' + (run.analytic ? '' : ' (처음 ' + fmt(run.E0, d) + ')'), W - 12, 4, { size: 22, weight: 500, color: '--color-ink', baseline: 'top', align: 'right' });
    var x0 = 12, x1 = W - 12, bw = x1 - x0, top = 31, bh = Math.max(12, Math.min(24, H - top - 29));
    var max = run.E0 > 0 ? run.E0 : 1;
    ctx.fillStyle = SK.color('--color-paper-sunk'); ctx.fillRect(x0, top, bw, bh);
    var wk = K / max * bw, wu = U / max * bw, wh = Math.min(heat / max * bw, bw - wk - wu);
    ctx.fillStyle = SK.color('--color-q-energy-k'); ctx.fillRect(x0, top, wk, bh);
    ctx.fillStyle = SK.color('--color-q-energy-p'); ctx.fillRect(x0 + wk, top, wu, bh);
    if (!run.analytic && wh > 0) {
      ctx.save(); ctx.beginPath(); ctx.rect(x0 + wk + wu, top, wh, bh); ctx.clip();
      ctx.strokeStyle = SK.color('--color-q-energy-heat'); ctx.lineWidth = 2;
      for (var hx = x0 + wk + wu - bh; hx < x0 + wk + wu + wh; hx += 8) { ctx.beginPath(); ctx.moveTo(hx, top + bh); ctx.lineTo(hx + bh, top); ctx.stroke(); }
      ctx.restore();
    }
    ctx.strokeStyle = ink; ctx.lineWidth = 2; ctx.strokeRect(x0 + 1, top, wk + wu - 1, bh);
    ctx.strokeStyle = muted; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(x1, top - 4); ctx.lineTo(x1, top + bh + 4); ctx.stroke(); ctx.setLineDash([]);
    // 아래 글자: ■ 운동 50.0 J  ■ 위치 150.0 J  (■ 열)
    var ty = top + bh + 4, tx = x0;
    function item(col, txtCol, text, hatch) {
      ctx.fillStyle = SK.color(col);
      if (hatch) { ctx.strokeStyle = SK.color(col); ctx.lineWidth = 2; ctx.strokeRect(tx + 1, ty + 4, 12, 12); }
      else ctx.fillRect(tx, ty + 3, 14, 14);
      tx += 20 + SK.text(ctx, text, tx + 20, ty, { size: 22, weight: 500, color: txtCol, baseline: 'top' }) + 22;
    }
    if (ty + 22 <= H + 2) {
      item('--color-q-energy-k', '--color-q-energy-k', '운동 ' + fmt(K, d) + ' J');
      item('--color-q-energy-p', '--color-q-energy-p-text', '위치 ' + fmt(U, d) + ' J');
      if (!run.analytic) item('--color-q-energy-heat', '--color-q-energy-heat', '열 ' + fmt(heat, d) + ' J', true);
    }
  }

  // 처음 들어왔을 때: 사거리 숫자 예측을 먼저 (예측 단계)
  // 실험 카드·모드를 고르지 않은 첫 화면은 공통 autoPredict 가 띄울 것이 없으므로, 사거리 숫자 예측을 한 번 띄운다.
  // 다시 열기는 띠의 공통 '예측하기'(마지막 예측 = RANGE_PREDICT, 문장은 그때 값)로. 교사가 자동 예측을 끄면 띄우지 않음
  setTimeout(function () { if (CFG.autoPredict && SK.stepIndex === 0 && !SK.prediction && !SK.predicting()) openRangePredict(); }, 350);
})();
