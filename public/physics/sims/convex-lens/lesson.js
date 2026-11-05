/* =====================================================================
   볼록렌즈로 상 만들기 (convex-lens) — 교과 설명 데이터 (R7 2차, UI팀3)
   원고: docs/교과설명/convex-lens.md (기획B 2차, 11장 + 정리 모달) · 형식: docs/SIMKIT.md §0R7-2
   불러오는 순서: shared/sim.js → diagram.js → lesson.js(공통) → sim.js → 이 파일
   그림: viewBox 800×450. 광축 = 가로 점선, 렌즈 = D.lens, 세 광선 = D.ray(style 1·2·3) — 실험 화면 광선 ①②③ 과 같은
         기록 색·선 모양 토큰(--color-rec-1~3 · --dash-rec-1~3). 실상 = 실선 화살표, 허상 = 점선 화살표. 색은 CSS 변수만.
   교육과정: [12물리03-02] 결상 공식은 다루지 않음 → 본문은 정성(세 광선·위치 구간·배율 = 거리 비).
            1/s + 1/s′ = 1/f · m = −s′/s 는 8장 '더 보기'(교사 펼침)와 식 팝업 '더 알아보기'에만. 화면·본문에 s′ 기호 없음('상 거리').
   R7 2차: 6장 그림 / 7장 표(4열) 분할 · terms · symbols[].target · now · 오해 4개 try/result · quiz 3(answerIdx)
   ===================================================================== */
(function () {
  'use strict';
  /** 세로 화살표(물체·상). up = 위쪽이 + (SVG y 는 아래가 +). dashed = 허상 */
  function arrowV(D, x, yAxis, hgt, o) {
    o = o || {};
    var tip = yAxis - hgt, dir = hgt >= 0 ? 1 : -1, col = o.color || 'var(--color-ink)', w = o.w || 4;
    return '<line x1="' + x + '" y1="' + yAxis + '" x2="' + x + '" y2="' + (tip + dir * 10) + '" style="stroke:' + col + ';stroke-width:' + w + (o.dashed ? ';stroke-dasharray:7 5' : '') + '"/>' +
      '<path d="M' + (x - 9) + ' ' + (tip + dir * 14) + ' L' + x + ' ' + tip + ' L' + (x + 9) + ' ' + (tip + dir * 14) + (o.dashed ? '' : ' Z') + '" style="' + (o.dashed ? 'fill:none;stroke:' + col + ';stroke-width:2.5' : 'fill:' + col) + '"/>';
  }
  function axis(D, x0, x1, y) { return D.line(x0, y, x1, y, { color: 'muted', w: 1.5, dash: '10 6' }); }
  function fdot(D, x, y, t, below) { return D.dots([[x, y]], { r: 5, color: 'sim' }) + (t ? D.label(x, y + (below ? 24 : -22), t, { anchor: 'middle', size: 20, color: 'sim', weight: 500 }) : ''); }
  var IMG = 'var(--sim)';
  /** R7-3(C5): 광선 + 구간마다 광선 색 작은 V(진행 방향) — 렌즈 위 검은 화살촉 대신 */
  function rayV(D, pts, style, skip) {
    var out = D.ray(pts, { style: style, arrow: false }), c = 'var(--color-rec-' + style + ')';
    for (var i = 1; i < pts.length; i++) {
      if (skip && skip.indexOf(i) >= 0) continue;
      var ax = pts[i - 1][0], ay = pts[i - 1][1], bx = pts[i][0], by = pts[i][1], L = Math.hypot(bx - ax, by - ay);
      if (L < 60) continue;
      var ux = (bx - ax) / L, uy = (by - ay) / L, mx = ax + (bx - ax) * 0.5, my = ay + (by - ay) * 0.5;
      out += '<path d="M' + (mx - ux * 8 - uy * 6).toFixed(1) + ' ' + (my - uy * 8 + ux * 6).toFixed(1) + ' L' + mx.toFixed(1) + ' ' + my.toFixed(1) + ' L' + (mx - ux * 8 + uy * 6).toFixed(1) + ' ' + (my - uy * 8 - ux * 6).toFixed(1) + '" style="fill:none;stroke:' + c + ';stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round"/>';
    }
    return out;
  }
  /** 광선 번호 배지 ①②③ (광선 색 테두리 원 + 숫자) */
  function rayNo(D, x, y, n) {
    return '<g><circle cx="' + x + '" cy="' + y + '" r="13" style="fill:var(--color-paper-raised);stroke:var(--color-rec-' + n + ');stroke-width:2.5"/>' +
      D.label(x, y + 1, String(n), { anchor: 'middle', size: 18, weight: 500, color: 'var(--color-rec-' + n + ')', bg: false }) + '</g>';
  }
  /** 바탕 칩이 있는 라벨(그림 위 선과 겹쳐도 읽히게) — 폭은 글자 수로 어림 */
  function chipLabel(D, x, y, text, o) {
    o = o || {};
    var size = o.size || 18, w = 0;
    String(text).replace(/\$/g, '').split('').forEach(function (ch) { w += /[가-힣]/.test(ch) ? size * 0.98 : size * 0.56; });
    w += 16;
    var x0 = o.anchor === 'middle' ? x - w / 2 : o.anchor === 'end' ? x - w : x - 8;
    return '<rect x="' + x0.toFixed(1) + '" y="' + (y - size * 0.75).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + (size * 1.5).toFixed(1) + '" rx="' + (size * 0.75).toFixed(1) + '" style="fill:var(--color-paper-raised);stroke:var(--color-line);stroke-width:1.2"/>' +
      D.label(x, y, text, { anchor: o.anchor, size: size, color: o.color, weight: o.weight, bg: false });
  }
  /* R7-3(C5·C6b): 7장 위치 5칸 — 표 행 [해 보기] 와 그림 띠가 같은 순서·같은 값 */
  var POS = [
    { name: '2F 밖', s: 30, res: ['0.5배', '거꾸로'], h: 1, real: true, tryQ: { preset: null, set: base({}), predict: false } },
    { name: '2F', s: 20, res: ['1배', '거꾸로'], h: 1, real: true, tryQ: { preset: 1 } },
    { name: 'F ~ 2F', s: 15, res: ['2배', '거꾸로'], h: 1, real: true, tryQ: { preset: 2 } },
    { name: 'F', s: 10, res: ['상 없음', ''], h: 0, tryQ: { preset: null, set: base({ s: 10 }), predict: false } },
    { name: 'F 안', s: 5, res: ['2배 바로', '(허상)'], h: 1, tryQ: { preset: 3 } }
  ];
  var selPos = -1;   // 7장에서 고른 행(그림 칸 강조) — 이번 탭 동안만
  function posBand(D) {
    var y = 250, L = 744, x0 = 34, cw = 132, kids = [];
    kids.push(D.line(20, y, 780, y, { color: 'muted', w: 1.5, dash: '10 6' }), D.lens(L, y, 150), D.label(L, y + 100, '렌즈', { anchor: 'middle', size: 18, color: 'sim', weight: 500 }));
    POS.forEach(function (c, i) {
      var cx = x0 + cw * i + cw / 2;
      kids.push('<rect x="' + (x0 + cw * i + 3) + '" y="72" width="' + (cw - 6) + '" height="330" rx="10" style="fill:' + (i === selPos ? 'var(--sim-tint)' : 'var(--color-paper-raised)') + ';stroke:' + (i === selPos ? 'var(--sim)' : 'var(--color-line)') + ';stroke-width:' + (i === selPos ? 2.5 : 1.2) + '"/>');
      kids.push(D.label(cx, 100, c.name, { anchor: 'middle', size: 22, weight: 500, color: 'sim', bg: false }));
      kids.push(D.label(cx, 134, '$s$ = ' + c.s + ' cm', { anchor: 'middle', size: 18, color: 'muted', bg: false }));
      if (c.name === 'F' || c.name === '2F') kids.push(D.dots([[cx, y]], { r: 6, color: 'sim' }));
      kids.push(arrowV(D, cx - (c.name === 'F' || c.name === '2F' ? 0 : 0), y, 46, { w: 3.5 }));
      kids.push(D.label(cx, 318, c.res[0], { anchor: 'middle', size: 20, weight: 500, bg: false }));
      if (c.res[1]) kids.push(D.label(cx, 346, c.res[1], { anchor: 'middle', size: 18, color: 'muted', bg: false }));
    });
    kids.push(D.arrow(120, 428, 560, 428, { kind: 'v', color: 'muted' }), D.label(580, 428, '물체를 렌즈 쪽으로', { size: 18, color: 'muted' }));
    return D.svg(kids, { title: '물체 위치 지도 ($f$ = 10 cm, 물체는 렌즈 왼쪽)', how: '칸 = 물체 위치(멀리 → 가까이) · 아래 글 = 상의 크기와 방향 · F 를 지나면 거꾸로 선 실상이 바로 선 허상으로 바뀌어요' });
  }
  /** 기본 상태(sim.js BASE + 화살표 s 30 · 스크린 15) — 카드 없이 값만 적용하는 해 보기용 */
  function base(extra) {
    var o = { type: 'arrow', s: 30, screenX: 15, h: 4, f: 10, hideF: false, blocker: 'none', screen: true, fan: false, ray1: true, ray2: true, ray3: true }, k;
    for (k in extra) o[k] = extra[k];
    return o;
  }
  /** 물체 위치 세 구간 그림(6장 그림 · 7장 표 옆에 같은 그림) */
  function posSvg(D) {
    var L = 400, f = 50, kids = [], B = window.SimKit && SimKit.level && SimKit.level() === 'basic';
    var strips = B ? [
      { y: 112, s: 150, name: '멀리 (30 cm)', res: '작고 거꾸로 — 스크린에 맺혀요' },
      { y: 250, s: 100, name: '가운데 (20 cm)', res: '같은 크기, 거꾸로 — 스크린에 맺혀요' },
      { y: 388, s: 25, name: '아주 가까이 (5 cm)', res: '크고 바로 — 스크린에 안 맺혀요' }
    ] : [
      /* R7 학생점검(디자인C): 4칸이 viewBox 450 아래로 잘리던 것 — 칸을 12 위로, 광선은 축 아래 48 까지만, 구분선은 칸 사이 가운데(이름 글자 위 18) */
      { y: 88, s: 150, name: '2F 밖', res: '작은 실상 (물체 30 cm 예: 0.5배)' },
      { y: 188, s: 100, name: '2F', res: '2F — 같은 크기 실상 (1배)' },
      { y: 288, s: 75, name: 'F ~ 2F', res: '큰 실상 (2배)' },
      { y: 388, s: 25, name: 'F 안', res: '큰 허상 (2배)' }
    ];
    if (B) kids.push(D.line(20, 180, 780, 180, { color: 'line', w: 1.2 }), D.line(20, 318, 780, 318, { color: 'line', w: 1.2 }));
    else kids.push(D.line(20, 140, 780, 140, { color: 'line', w: 1.2 }), D.line(20, 240, 780, 240, { color: 'line', w: 1.2 }), D.line(20, 340, 780, 340, { color: 'line', w: 1.2 }));
    strips.forEach(function (st) {
      var y = st.y, ox = L - st.s, h = 26, sp = st.s * f / (st.s - f), m = sp / st.s, ix = L + sp, ih = -h * m;
      kids.push(axis(D, 60, 740, y), D.lens(L, y, 80), fdot(D, L - f, y), fdot(D, L + f, y));
      if (!B) kids.push(fdot(D, L - 2 * f, y), fdot(D, L + 2 * f, y));
      var s1 = h / f, x1 = Math.min(620, L + (h + 48) / s1);
      kids.push(D.ray([[ox, y - h], [L, y - h], [x1, y - h + (x1 - L) * s1]], { style: 1, arrow: false }));
      var s3 = h / st.s, x3 = Math.min(620, L + 48 / s3);
      kids.push(D.ray([[ox, y - h], [L, y], [x3, y + (x3 - L) * s3]], { style: 3, arrow: false }));
      if (sp < 0) kids.push(D.line(L, y - h, ix, y - ih, { color: 'muted', w: 1.8, dash: '5 5' }), D.line(L, y, ix, y - ih, { color: 'muted', w: 1.8, dash: '5 5' }));
      kids.push(arrowV(D, ox, y, h, { w: 3.5 }), arrowV(D, ix, y, ih, { color: IMG, dashed: sp < 0, w: 3.5 }));
      kids.push(D.label(24, y - 30, st.name, { weight: 500, size: 22 }), D.label(24, y + 36, st.res, { size: 22, color: 'sim' }));
    });
    if (B) return D.svg(kids, { title: '물체 위치 세 곳 (점: 렌즈 양쪽 초점)', how: '실선 화살표 = 스크린에 맺히는 상(거꾸로) · 점선 화살표 = 스크린에 안 맺히는 상(바로) — 물체를 가까이 할수록 상이 커져요' });
    return D.svg(kids, { title: '물체 위치 네 곳 (점: 렌즈 양쪽 F·2F)', how: '실선 화살표 = 실상(거꾸로) · 점선 화살표 = 허상(바로) — 물체가 F 쪽으로 다가올수록 상이 멀어지고 커져요. 2F 밖은 항상 1배보다 작아요' });
  }
  /** '지금 값' — 상 거리(표시용 계산, 실험 계산은 sim.js Phys). 예측 중·f 숨김이면 답을 말하지 않는다 */
  function hush() { return !!(window.SimKit && SimKit.predicting && SimKit.predicting()); }
  function fHidden(p) { return p.hideF && !(window.SimKit && SimKit.isTeacher && SimKit.isTeacher()); }
  function r1(v) { return String(Math.round(v * 10) / 10); }

  SimKit.lesson({
    slug: 'convex-lens',
    title: '볼록렌즈는 어떻게 상을 만들까?',
    standards: [
      { code: '12물리03-02', subj: '물리학', text: '굴절과 볼록렌즈의 상 맺힘' },
      { code: '12전자02-02', subj: '전자기와 양자', text: '(연계) 렌즈를 쓰는 광학 기기' }
    ],
    // R9: data.simple 은 장마다 levels 로 대체(초급 = goal · three-rays · by-position · check, 앞에 복습 3장 · refraction 은 복습 1·2 로 이관)
    terms: [
      { term: '굴절', sym: '', unit: '', mean: '빛이 다른 물질로 들어갈 때 방향이 꺾이는 현상' },
      { term: '광축', sym: '', unit: '', mean: '렌즈 한가운데를 수직으로 지나는 기준선' },
      { term: '초점', sym: 'F', unit: '(자리)', mean: '광축과 나란히 들어온 빛이 모이는 점 — 렌즈 양쪽에 하나씩' },
      { term: '초점거리', sym: '$f$', unit: 'cm', mean: '렌즈 가운데에서 초점까지의 거리(길이)', where: 'f' },
      { term: '물체 거리', sym: '$s$', unit: 'cm', mean: '렌즈 가운데에서 물체까지의 거리', where: 's' },
      { term: '상 거리', sym: '', unit: 'cm', mean: '렌즈 가운데에서 상까지의 거리', where: 'meter:si' },
      { term: '실상', sym: '', unit: '', mean: '빛이 실제로 모여 생긴 상 — 스크린에 맺히고 거꾸로 서요' },
      { term: '허상', sym: '', unit: '', mean: '퍼지는 빛을 거꾸로 연장한 선이 만나는 곳에 보이는 상 — 스크린에 안 맺히고 바로 서요' },
      { term: '배율', sym: '', unit: '배', mean: '{{frac:상 크기|물체 크기}} = {{frac:상 거리|물체 거리}}', where: 'meter:m' }
    ],
    chapters: [

      /* ── R9 중학교에서 배운 것 (복습 1~3) — 원고 docs/교과설명/convex-lens_중학교.md · 성취기준 코드 없음 · 기존 refraction·terms 내용을 옮겨 다듬음 ── */
      { id: 'mid-school-1', type: 'review', no: 1, of: 3, title: '빛은 곧게 가다가 꺾여요',
        source: '중학교 과학 「빛과 파동」 계열 단원 — 직진·반사·굴절',
        body: [
          '빛은 곧게 나아가요(**직진**). 거울에 닿으면 튕겨 나오고(**반사**), 공기에서 물이나 유리로 들어가면 꺾여요(**굴절**).',
          '물이 담긴 컵에 꽂은 빨대가 꺾여 보이는 것도 굴절 때문이에요.',
          '공기에서 유리로 들어갈 때는 경계에 세운 수직선 쪽으로 꺾이고, 나올 때는 반대쪽으로 꺾여요.'
        ],
        terms: ['직진', '반사', '굴절', '수직선'],
        bridge: '빛이 꺾이는 것까지 배웠어요. 이제 볼록렌즈가 이 굴절 때문에 빛을 한곳에 모으고, 그 점이 어디인지 찾는 법을 더해요.',
        selfcheck: { q: '공기에서 유리로 비스듬히 들어간 빛은 어떻게 꺾일까요?', choices: ['수직선 쪽으로 꺾여요', '수직선에서 멀어지게 꺾여요', '꺾이지 않아요'], answerIdx: 0, why: '유리로 들어가면 수직선 쪽으로 꺾여요. (왜 그런지는 고등학교에서 배워요.)' },
        teacherNote: ['성취기준 코드 미확인 — 단원명만 표기(학년·단원명 확인 필요 — 학생 화면에는 표시하지 않음). 굴절의 까닭(빛의 속력 변화)은 중학교 범위 밖이라 쓰지 않았다.'],
        svg: function (D) {
          var k = [];
          k.push('<rect x="320" y="150" width="160" height="190" style="fill:var(--sim-tint);stroke:var(--color-line-strong);stroke-width:2"/>');
          k.push(D.line(230, 215, 410, 215, { color: 'muted', w: 1.5, dash: '6 5' }), D.line(390, 273, 570, 273, { color: 'muted', w: 1.5, dash: '6 5' }));
          k.push(D.ray([[110, 100], [320, 215], [480, 273], [690, 398]], { style: 1 }));
          k.push(D.label(160, 330, '공기', { anchor: 'middle', color: 'muted' })); k.push(D.label(400, 320, '유리', { anchor: 'middle', color: 'sim', weight: 500 })); k.push(D.label(640, 160, '공기', { anchor: 'middle', color: 'muted' }));
          k.push(D.label(300, 195, '수직선', { anchor: 'end', size: 20, color: 'muted' })); k.push(D.label(500, 253, '수직선', { anchor: 'start', size: 20, color: 'muted' }));
          return D.svg(k, { title: '빛이 유리 블록을 지나요', how: '들어갈 때는 수직선 쪽으로, 나올 때는 반대쪽으로 꺾여요 (점선 = 경계에 세운 수직선)' });
        } },
      { id: 'mid-school-2', type: 'review', no: 2, of: 3, title: '볼록렌즈는 빛을 모아요',
        source: '중학교 과학 「빛과 파동」 계열 단원 — 볼록렌즈',
        body: [
          '볼록렌즈는 가운데가 두껍고 가장자리가 얇은 유리예요. 렌즈에 나란히 들어온 빛은 굴절해서 한 점에 모여요. 그 점이 **초점**이에요.',
          '렌즈 가운데에서 초점까지의 거리가 **초점거리**예요. 렌즈가 둥글고 볼록할수록 초점거리가 짧아요(빛을 세게 꺾어요).',
          '렌즈 한가운데를 지나는 기준선이 **광축**이에요.'
        ],
        terms: ['볼록렌즈', '초점', '초점거리', '광축'],
        bridge: '모이는 점이 있다는 것까지 배웠어요. 이제 물체에서 나온 빛이 렌즈를 지나 상이 어디에 생기는지를 선 세 개로 그려 찾아요.',
        selfcheck: { q: '돋보기로 햇빛을 종이에 모았더니 한 점이 가장 밝았어요. 그 점은?', choices: ['초점', '광축', '렌즈 가장자리'], answerIdx: 0, why: '나란한 햇빛이 모이는 점이 초점이에요. 렌즈와 종이 사이 거리가 초점거리예요.' },
        teacherNote: ['성취기준 코드 미확인 — 단원명만 표기. F·2F 표기는 이 장에서 쓰지 않는다(중급 3장에서 소개).'],
        svg: function (D) {
          var y = 225, F = 560, k = [axis(D, 40, 760, y), D.lens(400, y, 260)];
          [-70, 0, 70].forEach(function (d) {
            k.push(D.line(60, y + d, 400, y + d, { color: 'sim', w: 3 }));
            k.push(D.line(400, y + d, F + 70, y + d + (F + 70 - 400) * (-d) / (F - 400), { color: 'sim', w: 3 }));
          });
          k.push(D.dots([[F, y]], { r: 8, color: 'warn' })); k.push(D.label(F, y - 28, '초점', { anchor: 'middle', weight: 500 }));
          k.push(D.dim(400, y + 56, F, y + 56, '초점거리', { off: 26 }));
          k.push(D.label(70, y - 100, '나란한 빛 →', { size: 20, color: 'muted' })); k.push(D.label(760, y - 18, '광축', { anchor: 'end', size: 20, color: 'muted' }));
          return D.svg(k, { title: '나란한 빛이 렌즈를 지나 모여요', how: '렌즈 가운데에서 초점까지의 길이가 초점거리예요' });
        } },
      { id: 'mid-school-3', type: 'review', no: 3, of: 3, title: '물체 거리에 따라 상이 달라져요',
        source: '중학교 과학 「빛과 파동」 계열 단원 — \'상\' 의 크기·방향까지',
        body: [
          '물체가 렌즈에서 멀리 있으면 스크린에 거꾸로 선 작은 상이 맺혀요.',
          '물체를 렌즈 쪽으로 가까이 하면 상이 커지고, 스크린은 더 멀리 가야 해요.',
          '물체가 아주 가까워(앞 장의 초점보다 렌즈에 더 가까이) 돋보기처럼 들여다보면 바로 선 큰 상이 보여요. 이 상은 스크린에 맺히지 않아요.'
        ],
        terms: ['상', '거꾸로·바로', '커진·작아진', '스크린에 맺힌다'],
        bridge: '중학교에서는 상이 커지는지 작아지는지까지 배웠어요. 이제 상이 정확히 어디에, 몇 배로 생기는지를 선 세 개로 그려 찾아요.',
        selfcheck: { q: '물체를 렌즈 쪽으로 가까이(초점 밖에서) 옮기면 스크린의 상은?', choices: ['커져요', '작아져요', '같아요'], answerIdx: 0, why: '가까이 갈수록 상은 커지고, 스크린은 더 멀어요.' },
        teacherNote: ['성취기준 코드 미확인. 실상·허상 이라는 이름의 중학교 사용 여부는 (확인 필요) — 이 장은 \'스크린에 맺힌다/안 맺힌다\' 로만 쓰고 중급에서 처음 소개한다.'],
        svg: function (D) {
          var k = [], P = [
            { x0: 20, s: 120, h: 50, ih: -18, ix: 190, t1: '멀리', t2: '작고 거꾸로', screen: true },   // 팀장 R9 결과(교사P): '작다' 가 한눈에 — 물체 50 · 상 18
            { x0: 280, s: 90, h: 36, ih: -58, ix: 215, t1: '가까이', t2: '커지고 거꾸로', screen: true },
            { x0: 540, s: 40, h: 30, ih: 62, ix: -50, t1: '아주 가까이', t2: '크고 바로(스크린 X)', screen: false }
          ], y = 220;
          P.forEach(function (c) {
            var L = c.x0 + 120;
            k.push('<rect x="' + (c.x0 + 2) + '" y="64" width="236" height="350" rx="10" style="fill:var(--color-paper-raised);stroke:var(--color-line);stroke-width:1.2"/>');
            k.push(D.line(c.x0 + 8, y, c.x0 + 232, y, { color: 'muted', w: 1.2, dash: '8 5' }), D.lens(L, y, 130));
            k.push(arrowV(D, L - c.s * 0.8, y, c.h, { w: 3.5 }));
            if (c.screen) { k.push('<rect x="' + (L + c.ix - 130 - 3) + '" y="' + (y - 60) + '" width="6" height="120" style="fill:var(--color-line-strong)"/>'); k.push(arrowV(D, L + c.ix - 130, y, c.ih, { color: IMG, w: 3.5 })); }
            else k.push(arrowV(D, L - 60, y, c.ih, { color: IMG, dashed: true, w: 3 }));
            k.push(D.label(c.x0 + 120, 352, c.t1, { anchor: 'middle', size: 22, weight: 500, bg: false }));
            k.push(D.label(c.x0 + 120, 384, c.t2, { anchor: 'middle', size: 20, color: 'muted', bg: false }));
          });
          return D.svg(k, { title: '물체를 렌즈에 가까이 가져오면', how: '검은 화살표 = 물체 · 색 화살표 = 상 — 가까이 갈수록 커지고, 아주 가까우면 스크린 대신 들여다봐요' });
        } },
      /* 1장 */
      { id: 'goal', type: 'goal', title: '볼록렌즈는 어떻게 상을 만들까?', levels: ['basic', 'mid', 'adv'],
        question: '렌즈를 반쯤 가리면 상도 반쪽만 생길까?',
        body: { basic: [
          '돋보기, 카메라, 프로젝터, 우리 눈 속에는 모두 볼록렌즈가 있어요. 볼록렌즈는 빛을 꺾어 한곳에 모아 렌즈 너머에 **상**(보이는 모습)을 만들어요.',
          '빛이 지나가는 길(광선)을 그려 상이 어디에, 어떤 모양으로 생기는지 알아내요.',
          '물체를 가까이 하거나 멀리 할 때 상이 어떻게 달라지는지도 확인해요.'
        ], mid: [
          '돋보기, 카메라, 프로젝터, 우리 눈 속에는 모두 볼록렌즈가 있어요. 볼록렌즈는 빛을 꺾어 한곳에 모아 **상**을 만들어요.',
          '빛의 길(광선)을 그려 상의 위치와 모양을 알아내요.',   // R7 학생점검(디자인C): '(세 광선은 4장에서)' 는 그림 설명에 같은 말이 있어 뺌
          '물체를 가까이 하거나 멀리 할 때 상이 어떻게 달라지는지도 확인해요.'
        ] },
        goals: ['굴절과 초점', '세 광선으로 상 찾기', '물체 위치에 따라 달라지는 상'],
        svg: function (D) {
          var B = window.SimKit && SimKit.level && SimKit.level() === 'basic';   // R9: 초급은 F·2F 기호 없이 '초점' 말
          var y = 225, L = 400, f = 100, ox = 170, oh = 90, ty = y - oh;
          var ix = L + 230 * f / 130, ih = oh * (ix - L) / 230;   // 물체 거리 230 → 상 거리 177, 약 0.77배
          // R7-3(C5): 렌즈 위 검은 화살촉 → 광선 색 작은 V · 광선 번호 ①②③ 은 광선 중간(물체 → 렌즈 구간)
          var r1 = [[ox, ty], [L, ty], [660, ty + (660 - L) * oh / f]], r2 = [[ox, ty], [L, y + ih], [660, y + ih]], r3 = [[ox, ty], [L, y], [660, y + (660 - L) * oh / (L - ox)]];
          return D.svg([
            axis(D, 40, 760, y), D.lens(L, y, 300),
            B ? '' : fdot(D, L - 2 * f, y, '2F', true), fdot(D, L - f, y, B ? '초점' : 'F', false), fdot(D, L + f, y, B ? '초점' : 'F', false), B ? '' : fdot(D, L + 2 * f, y, '2F', false),   // R7 학생점검: 오른쪽 2F 는 축 위(아래는 상 끝·'상' 글자 자리)
            rayV(D, r1, 1), rayV(D, r2, 2), rayV(D, r3, 3),
            rayNo(D, 290, ty - 22, 1), rayNo(D, 355, ty + (355 - ox) * (y + ih - ty) / (L - ox) + 28, 2), rayNo(D, 330, ty + (330 - ox) * (y - ty) / (L - ox) - 24, 3),   // ② 는 F 와 렌즈 사이 광선 아래(F·2F 글자와 떨어지게)
            arrowV(D, ox, y, oh), arrowV(D, ix, y, -ih, { color: IMG }),
            D.label(ox, ty - 22, '물체', { anchor: 'middle', weight: 500 }), D.label(L, 405, '렌즈', { anchor: 'middle', weight: 500, color: 'sim' }),
            D.label(ix - 12, y + ih + 30, '상', { anchor: 'end', weight: 500, color: 'sim' }),   // 상 끝(아래) 왼쪽 — 2F 점에 붙어 보이지 않게
            D.label(760, y - 18, '광축', { anchor: 'end', size: 18, color: 'muted' })
          ], B ? { title: '물체 — 렌즈 — 상', how: '물체 꼭대기에서 나온 빛이 렌즈를 지나 상의 꼭대기 한 점에 다시 모여요' } : { title: '물체 — 렌즈 — 상 (세 광선 ①②③)', how: '물체 꼭대기에서 나온 세 광선이 렌즈를 지나 상의 꼭대기 한 점에 다시 모여요 — 4장에서 이 세 광선을 그려요' });
        },
        teacherNote: '설명 10분 + 실험 20분 + 정리 10분. 오늘의 질문은 실험 ⑤ 와 이어지므로 정답을 말하지 않고 남겨 둬요.\n초급에서는 terms·real-virtual·by-position-table·magnify·life·misc 를 건너뜁니다(F·2F·실상·허상·배율은 고등 용어).' },

      /* 2장 */
      { id: 'refraction', type: 'concept', levels: [], title: '굴절과 볼록렌즈의 모양',   // R9: 복습 1·2 로 이관(보관용)
        body: [
          '빛은 공기에서 유리로 들어갈 때 방향이 꺾여요. 이것이 **굴절**이에요.',
          '볼록렌즈는 가운데가 가장자리보다 두꺼워요. 나란히 들어온 빛은 가장자리를 지날수록 더 많이 꺾여 안쪽으로 모여요.',
          '그래서 볼록렌즈는 빛을 모으는 렌즈예요. 빛이 모이는 점이 **초점**이에요.'
        ],
        life: ['물이 담긴 둥근 어항이나 물방울이 글자를 크게 보이게 해요.'],
        svg: function (D) {
          var y = 280, F = 560, kids = [axis(D, 40, 760, y), D.lens(400, y, 300)];
          [-120, -60, 0, 60, 120].forEach(function (d) {
            var ex = 660, ey = y + (ex - 400) * (-d) / (F - 400) + d;
            kids.push(D.line(60, y + d, 400, y + d, { color: 'sim', w: Math.abs(d) > 90 ? 3.5 : 2.5 }));
            kids.push(D.line(400, y + d, ex, ey, { color: 'sim', w: Math.abs(d) > 90 ? 3.5 : 2.5 }));
          });
          kids.push(fdot(D, F, y, 'F', true), D.label(70, y - 145, '나란한 빛 →', { size: 20, color: 'muted' }));
          // 확대 창: 유리 경계에서 꺾임 (법선 점선)
          var cx = 690, cy = 100, r = 62;
          kids.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" style="fill:var(--color-paper-raised);stroke:var(--color-line-strong);stroke-width:2"/>',
            '<path d="M' + cx + ' ' + (cy - r) + ' A' + r + ' ' + r + ' 0 0 1 ' + cx + ' ' + (cy + r) + ' Z" style="fill:var(--sim-tint)"/>',
            D.line(cx, cy - r, cx, cy + r, { color: 'ink', w: 2 }), D.line(cx - 56, cy, cx + 56, cy, { color: 'muted', w: 1.5, dash: '5 4' }),
            D.line(cx - 50, cy - 38, cx, cy, { color: 'sim', w: 3 }), D.line(cx, cy, cx + 54, cy + 24, { color: 'sim', w: 3 }),
            D.label(cx - 22, cy + 34, '공기', { anchor: 'middle', size: 17, color: 'muted' }), D.label(cx + 26, cy - 30, '유리', { anchor: 'middle', size: 17, color: 'muted' }),
            D.label(cx - r - 8, cy - 46, '경계 확대', { anchor: 'end', size: 17, color: 'muted' }));
          return D.svg(kids, { title: '나란한 빛이 렌즈를 지나 모여요', how: '가장자리를 지난 빛(굵은 선)일수록 많이 꺾여 모두 초점 F 로 모여요 · 오른쪽 위 = 경계에서 꺾이는 모습 확대' });
        },
        teacherNote: '굴절 법칙(스넬)의 정량식은 쓰지 않아요. 정성만.' },

      /* 3장 */
      { id: 'terms', type: 'concept', title: '용어 정리: F와 2F',
        body: [
          '중학교에서 배운 **초점**과 **초점거리**에 이름표를 붙여요. 초점은 대문자 **F**, 초점거리는 소문자 **$f$** 로 써요. 광축은 렌즈 한가운데를 지나는 기준선이에요.',
          '렌즈 가운데에서 $f$ 의 두 배 거리인 자리가 **2F** 예요. 렌즈 양쪽에 F 와 2F 가 하나씩 있어요.'
        ],
        try: { label: '실험 ① — $f$ 를 숨기고 먼 풍경 상으로 찾기', preset: 0 },
        life: ['돋보기를 햇빛에 비추면 종이 위 한 점이 밝고 뜨거워져요. 그 점이 초점, 렌즈에서 그 점까지가 $f$ 예요.'],
        svg: function (D) {
          var y = 230, L = 400, f = 90;
          return D.svg([
            axis(D, 40, 760, y), D.lens(L, y, 300),
            D.line(60, y - 100, L, y - 100, { color: 'sim', w: 2.5 }), D.line(L, y - 100, L + f, y, { color: 'sim', w: 2.5 }),
            D.line(60, y - 55, L, y - 55, { color: 'sim', w: 2.5 }), D.line(L, y - 55, L + f, y, { color: 'sim', w: 2.5 }),
            fdot(D, L - 2 * f, y, '2F', true), fdot(D, L - f, y, 'F', false), fdot(D, L + f, y, 'F', false), fdot(D, L + 2 * f, y, '2F', true),
            D.dim(L, y + 70, L + f, y + 70, '$f$', { off: 22 }), D.dim(L, y + 120, L + 2 * f, y + 120, '2$f$', { off: 22 }),
            D.line(L, y + 40, L, y + 135, { w: 1.2, dash: '4 4' }),
            D.label(40, y - 18, '광축', { size: 20, color: 'muted' })
          ], { title: '광축 · 초점 F · 초점거리 $f$ · 2F', how: 'F · 2F 는 자리(점), $f$ 와 2$f$ 는 길이(cm)' });
        },
        teacherNote: '소문자 $f$(초점거리, 길이)와 대문자 F(초점, 자리)를 구분해요.' },

      /* 4장 */
      { id: 'three-rays', type: 'diagram', title: { basic: '빛이 지나가는 길 그리기', mid: '세 광선 그리기 (작도)' }, levels: ['basic', 'mid', 'adv'],
        body: { basic: [
          '물체 한 점에서 나온 빛은 렌즈를 지나 다시 한 점에 모여요. 그 점이 상이에요.',
          '빛 두 줄만 그려도 상을 찾을 수 있어요. ①은 광축과 나란히 들어와 초점으로 가는 빛, ③은 렌즈 한가운데를 곧게 지나는 빛이에요.'
        ], mid: [
          '물체 한 점의 세 광선이 다시 만나는 점이 상이에요. **두 광선만 그어도** 되고 셋째는 확인용이에요.'
        ] },
        eq: { basic: [{ tex: '두 빛이 만나는 점 = 상' }], mid: [{ tex: '광선 ① ② ③ 이 만나는 점 = 상' }] },
        symbols: [
          { sym: '①', name: '나란히 → 초점으로', unit: '', target: 'stage:ray1' },
          { sym: '②', name: '초점 지나 → 나란히', unit: '', target: 'stage:ray2' },
          { sym: '③', name: '중심으로 → 곧게', unit: '', target: 'stage:ray3' },
          { sym: '$f$', name: '초점거리 (F 의 자리)', unit: 'cm', target: 'f' }
        ],
        condition: '얇은 렌즈 · 광축 가까이 지나는 광선만 그린 근사예요',
        try: { label: 'Q · W · E 로 광선 끄고 켜기', preset: null, set: base({}), predict: false },
        svg: function (D) {
          var B = window.SimKit && SimKit.level && SimKit.level() === 'basic';   // R9: 초급 = 광선 ①③ 만, F·2F 기호 없이
          var y = 225, L = 400, f = 80, ox = 160, oh = 80, tx = ox, ty = y - oh;
          return D.svg([
            axis(D, 40, 760, y), D.lens(L, y, 280),
            B ? '' : fdot(D, L - 2 * f, y, '2F', true), fdot(D, L - f, y, B ? '초점' : 'F', true), fdot(D, L + f, y, B ? '초점' : 'F', false), B ? '' : fdot(D, L + 2 * f, y, '2F', true),
            rayV(D, [[tx, ty], [L, ty], [620, ty + (620 - L) * 1]], 1), B ? '' : rayV(D, [[tx, ty], [L, ty + (L - tx) * 0.5], [620, ty + (L - tx) * 0.5]], 2),
            rayV(D, [[tx, ty], [L, y], [620, y + (620 - L) / 3]], 3),
            arrowV(D, ox, y, oh), arrowV(D, 520, y, -40, { color: IMG }),
            '<circle cx="520" cy="265" r="7" style="fill:none;stroke:var(--color-ink);stroke-width:2.5"/>',
            D.label(ox, ty - 20, '물체', { anchor: 'middle', weight: 500 }),
            D.label(532, 200, '상', { weight: 500, color: 'sim' }),   // R7-3(C5): 상 화살표 위(광축 위 빈 곳)
            D.line(40, 360, 90, 360, { color: 'var(--color-rec-1)', w: 3 }), D.label(100, 360, '① 광축과 나란히 → 초점으로', { size: 19 }),
            B ? '' : '<line x1="40" y1="392" x2="90" y2="392" style="stroke:var(--color-rec-2);stroke-width:3;stroke-dasharray:var(--dash-rec-2)"/>', B ? '' : D.label(100, 392, '② 초점을 지나 → 나란히', { size: 19 }),
            '<line x1="40" y1="424" x2="90" y2="424" style="stroke:var(--color-rec-3);stroke-width:3;stroke-dasharray:var(--dash-rec-3)"/>', D.label(100, 424, '③ 렌즈 중심으로 → 곧게', { size: 19 })
          ], B ? { title: '빛 두 줄로 상 찾기 (①③)', how: '① 실선 · ③ 일점쇄선 · 두 빛이 만나는 점(작은 원)이 상의 꼭대기' } : { title: '세 광선으로 상 찾기 (실험 화면 광선 ①②③ 과 같은 색·선 모양)', how: '① 실선 · ② 점선 · ③ 일점쇄선 · 세 광선이 만나는 점(작은 원)이 상의 꼭대기 — 실험 화면에서 Q·W·E 로 하나씩 꺼 봐요' });
        },
        teacherNote: '발문 "광선 ③ 이 꺾이지 않는 이유는?" → 렌즈 한가운데는 양면이 거의 평행이라 얇은 판처럼 방향이 거의 안 바뀌어요(근사).' },

      /* 5장 */
      { id: 'real-virtual', type: 'diagram', title: '실상과 허상',
        body: [
          '빛이 실제로 한 점에 모여 만든 상이 **실상**이에요. 스크린에 비치고, 볼록렌즈가 만든 실상은 위아래·좌우가 뒤집혀 있어요.',
          '**허상**은 빛이 모이지 않고 퍼질 때 생겨요. 퍼지는 빛을 거꾸로 연장한 선이 만나는 곳에 상이 있는 것처럼 보여요. 스크린에는 맺히지 않고, 렌즈 너머로 들여다봐야 보이며 바로 서 있어요.',
          '물체가 초점보다 바깥에 있으면 실상, 초점 안쪽에 있으면 허상이 생겨요.'
        ],
        try: { label: '실험 ④ 돋보기 — 스크린 놓기(I)로 안 맺힘 확인', preset: 3 },
        life: ['실상: 프로젝터 화면, 카메라 센서와 눈 속 망막에 맺힌 상.', '허상: 돋보기로 보는 큰 글자.'],
        svg: function (D) {
          var a = 135, b = 345, L = 400, f = 60;
          return D.svg([
            D.label(20, 70, '실상', { weight: 500, size: 24 }), D.label(20, 280, '허상', { weight: 500, size: 24 }),
            D.line(20, 240, 780, 240, { color: 'line', w: 1.5 }),
            axis(D, 60, 760, a), D.lens(L, a, 140), fdot(D, L + f, a), fdot(D, L - f, a),
            D.ray([[250, a - 45], [L, a - 45], [560, a - 45 + 160 * 0.75]], { style: 1, arrow: false }),
            D.ray([[250, a - 45], [L, a], [560, a + 48]], { style: 3, arrow: false }),
            arrowV(D, 250, a, 45), arrowV(D, 500, a, -30, { color: IMG }),
            '<rect x="496" y="' + (a - 70) + '" width="8" height="140" style="fill:var(--color-line-strong);opacity:0.55"/>',
            chipLabel(D, 520, a - 55, '스크린에 맺힘 (거꾸로)', { size: 18, color: 'sim' }),
            axis(D, 60, 760, b), D.lens(L, b, 140), fdot(D, L + f, b), fdot(D, L - f, b),
            D.ray([[370, b - 30], [L, b - 30], [560, b - 30 + 160 * 0.5]], { style: 1, arrow: false }),
            D.ray([[370, b - 30], [L, b], [445, b + 45]], { style: 3, arrow: false }),
            D.line(L, b - 30, 340, b - 60, { color: 'muted', w: 2, dash: '5 5' }), D.line(L, b, 340, b - 60, { color: 'muted', w: 2, dash: '5 5' }),
            arrowV(D, 370, b, 30), arrowV(D, 340, b, 60, { color: IMG, dashed: true }),
            D.label(330, b - 78, '허상 (바로 섬·큼)', { anchor: 'end', size: 18, color: 'sim', bg: true }),
            '<path d="M660 ' + (b + 2) + ' q-16 -13 -32 0 q16 13 32 0z" style="fill:var(--color-paper-raised);stroke:var(--color-ink);stroke-width:2.5"/><circle cx="645" cy="' + (b + 2) + '" r="5" style="fill:var(--color-ink)"/>',
            chipLabel(D, 650, b - 30, '여기서 들여다봐요', { anchor: 'middle', size: 18 }),
            chipLabel(D, 600, b + 80, '빛이 안 모여요: 스크린에 안 맺힘', { anchor: 'middle', size: 18, color: 'muted' })
          ], { title: '실상과 허상', how: '위: 빛이 실제로 모임(실선) → 스크린에 맺힘 · 아래: 빛이 퍼짐 → 연장한 점선이 만나는 곳에 허상(점선 화살표)' });
        } },

      /* 6장 */
      { id: 'by-position', type: 'diagram', title: '물체 위치에 따라 달라지는 상', levels: ['basic', 'mid', 'adv'],
        body: { basic: [
          '물체를 렌즈 쪽으로 가까이 가져올수록 상은 렌즈에서 멀어지고 커져요. 멀리 두면 상은 작아져요.',
          '렌즈에서 20 cm 자리에 두면 같은 크기의 거꾸로 선 상이 맺혀요.',
          '아주 가까이(초점 안쪽) 두면 스크린에는 안 맺히고, 렌즈 너머로 들여다보면 바로 선 큰 상이 보여요.'
        ], mid: [
          '물체를 렌즈에 가까이 가져올수록 상은 렌즈에서 멀어지고 커져요. 멀리 두면 상은 초점 쪽으로 다가오며 작아져요.',
          '초점(F)과 2F 를 경계로 위치를 나누어 살펴봐요. 2F 에 두면 반대쪽 2F 에 같은 크기(1배)의 거꾸로 선 실상이 생겨요. 2F 밖은 항상 1배보다 작아요.',
          '초점에 둔 물체의 빛은 렌즈를 지나 나란히 나가서 상이 생기지 않아요.'
        ] },
        try: { label: { basic: '실험 ① — 물체를 렌즈에서 20 cm 에', mid: '실험 ② — 물체를 2F 에' }, preset: 1 },
        life: ['카메라·눈: 멀리(2F 밖) 있는 물체의 작은 실상.', '프로젝터: 슬라이드를 F 바로 바깥(F~2F)에 두어 크게 확대.', '돋보기: F 안쪽에 대어 큰 허상.'],
        svg: posSvg,
        teacherNote: '칠판에서는 이 그림 → 다음 장 표 순서로 넘겨요. 실험 ②③④ 를 차례로 눌러 표를 채워 봐요.' },

      /* 7장 — R7-3(C5·C6b): 그림 = 위치 5칸 띠(6장 세 구간 그림과 역할 분리) · 표 행마다 [해 보기] (행 전체 누름) */
      { id: 'by-position-table', type: 'concept', title: '위치별 상 한눈에 보기',
        condition: '$f$ = 10 cm 일 때의 예 · 행을 누르면 그 위치로 실험해요',
        table: {
          head: ['물체 위치', '물체 거리 $s$', '상 거리', '상의 모습', '중학교 말로'],
          rows: [
            ['2F 보다 멀리', '30 cm', '15 cm', '거꾸로 선 실상 · 0.5배 (30 cm 예)', '작아진 · 거꾸로'],
            ['2F', '20 cm', '20 cm', '거꾸로 선 실상 · 1배', '같은 크기 · 거꾸로'],
            ['F ~ 2F', '15 cm', '30 cm', '거꾸로 선 실상 · 2배', '커진 · 거꾸로'],
            ['초점 F', '10 cm', '없음', '상이 생기지 않음', '상이 안 생겨요'],
            ['F 안쪽', '5 cm', '앞쪽 10 cm', '바로 선 허상 · 2배', '커진 · 바로 (스크린에 안 맺힘)']
          ] },
        svg: posBand,
        teacherNote: '이 표가 오늘의 요약이에요. 수치는 시뮬레이터 값과 같아요(식이 아니라 작도·실험으로 확인). 진행: 행을 위에서 아래로 짚으며 [해 보기]로 물체를 렌즈 쪽으로 밀면 상이 멀어지고 커져요 → F 에서 상이 사라져요 → F 안에서 바로 선 허상으로 바뀌어요. 발문: "어느 줄에서 거꾸로 선 상이 바로 선 상으로 바뀌나요?"(F 를 지날 때)' },

      /* 8장 */
      { id: 'magnify', type: 'formula', title: '배율: 상은 물체의 몇 배일까?',
        body: [
          '**배율**은 상 크기가 물체 크기의 몇 배인지예요. 광선 ③ 이 닮은 삼각형을 만들어서 상 거리와 물체 거리의 비와 같아요({{frac:30 cm|15 cm}} = 2배).'
        ],
        eq: [{ tex: '배율 =', frac: ['상 크기', '물체 크기'] }, { tex: '=', frac: ['상 거리', '물체 거리'] }],   // R7-3(C6b): 쌓은 분수(한글 낱말은 본문 글꼴 .frac__txt)
        symbols: [
          { sym: '$s$', name: '물체 거리', unit: 'cm', target: 's' },
          { sym: '상 거리', name: '렌즈 가운데부터 상까지', unit: 'cm', target: 'meter:si' },
          { sym: '배율', name: '상이 물체의 몇 배인지', unit: '배', target: 'meter:m' }
        ],
        now: function (p) {
          if (fHidden(p)) return '초점거리를 숨긴 실험이에요 — 정리에서 확인해요';
          if (hush()) return '물체 거리 $s$ = ' + p.s + ' cm → ▶ 실행하면 상 거리를 확인해요';
          if (p.s === p.f) return '물체가 초점에 있어요 → 상이 생기지 않아요';
          var si = p.s * p.f / (p.s - p.f), m = Math.abs(si) / p.s;
          if (si < 0) return '초점 안쪽 → 바로 선 허상(앞쪽 ' + r1(-si) + ' cm) · 배율 = {{frac:' + r1(-si) + '|' + p.s + '}} = ' + r1(m) + '배';
          return '배율 = {{frac:상 거리|물체 거리}} = {{frac:' + r1(si) + '|' + p.s + '}} = ' + r1(m) + '배 · 거꾸로';
        },
        life: ['실험 ③ 프로젝터 크게: {{frac:상 거리 30 cm|물체 거리 15 cm}} = 2배. 물체 거리 $s$ 를 바꿔 배율 계기를 읽어 봐요.', '스마트폰 카메라로 가까이 찍을 때 상이 커지는 것.'],
        more: { title: '더 알아보기 — 결상 공식과 부호 (교육과정 밖 심화)',
          body: ['물체 거리 $s$, 상 거리 $s′$, 초점거리 $f$ 사이에는 {{frac:1|$s$}} + {{frac:1|$s′$}} = {{frac:1|$f$}} 가 성립해요. 배율을 $m$ = −{{frac:$s′$|$s$}} 로 쓰면 음수일 때 거꾸로 선 상이에요.',
            '예: $f$ = 10, $s$ = 30 → $s′$ = 15, $m$ = −0.5 · $s$ = 5 → $s′$ = −10(렌즈 앞쪽 허상), $m$ = +2.'],
          eq: [{ tex: '$m$ = −', frac: ['$s′$', '$s$'] }] },
        svg: function (D) {
          // R7-3(C5): 본문 예와 같은 2배 — 물체 거리 130 : 상 거리 260, 물체 높이 50 : 상 높이 100
          var y = 200, L = 400, ox = L - 130, ix = L + 260, oh = 50, ih = 100;
          return D.svg([
            '<path d="M' + ox + ' ' + y + ' L' + ox + ' ' + (y - oh) + ' L' + L + ' ' + y + ' Z" style="fill:var(--sim-tint);stroke:none"/>',
            '<path d="M' + L + ' ' + y + ' L' + ix + ' ' + y + ' L' + ix + ' ' + (y + ih) + ' Z" style="fill:var(--color-warn-tint);stroke:none"/>',
            axis(D, 40, 760, y), D.lens(L, y, 260),
            D.ray([[ox, y - oh], [L, y], [ix, y + ih]], { style: 3, arrow: false }),
            arrowV(D, ox, y, oh), arrowV(D, ix, y, -ih, { color: IMG }),
            D.dim(ox, y + 40, L, y + 40, '', {}), D.label(L - 36, y + 66, '물체 거리 15 cm', { anchor: 'end', size: 20 }), D.dim(L, y - 40, ix, y - 40, '상 거리 30 cm (2배)', { off: -22, size: 19 }),
            D.dim(ox - 26, y, ox - 26, y - oh, '', {}), D.label(ox - 40, y - oh / 2, '물체 크기', { anchor: 'end', size: 19 }),
            D.dim(ix + 26, y, ix + 26, y + ih, '', {}), D.label(ix + 40, y + ih / 2, '상 크기', { anchor: 'start', size: 19 }),
            D.label(L, 380, '광선 ③ (렌즈 중심을 곧게)', { anchor: 'middle', size: 19, color: 'muted' })
          ], { title: '닮은 삼각형 두 개', how: '색이 연한 두 삼각형은 닮은꼴(모양이 같고 크기만 달라요) · 상 거리가 물체 거리의 2배면 상 크기도 물체 크기의 2배예요' });
        },
        teacherNote: '화면 배율은 크기 비(양수)예요. 뒤집힘은 \'거꾸로\' 로 따로 말하고, 부호($m$ < 0)는 더 보기에서만.' },

      /* ── R9 고급 전용 ── */
      { id: 'lens-formula', type: 'formula', levels: ['adv'], title: '렌즈 공식을 직접 유도해요',
        body: [
          '광선 ③(중심을 곧게)으로 배율 $m$ = {{frac:$s′$|$s$}}, 광선 ①(나란히 → 초점)으로 $m$ = {{frac:$s′ − f$|$f$}} 를 얻어요. 두 식을 같게 놓고 정리하면 렌즈 공식이 나와요.',
          '예: $f$ = 20, $s$ = 50 이면 $s′$ = 33.3 cm, $m$ = 0.67 — 실험 ⑥ 으로 확인해요.'
        ],
        eq: [
          { tex: '$m$ =', frac: ['$s′$', '$s$'], caption: '① 광선 ③ — 닮은 삼각형' },
          { tex: '$m$ =', frac: ['$s′ − f$', '$f$'], caption: '② 광선 ① — 닮은 삼각형' },
          { tex: '$s′$ =', frac: ['$s f$', '$s − f$'], caption: '③ 정리 → 렌즈 공식 {{frac:1|$s$}} + {{frac:1|$s′$}} = {{frac:1|$f$}}' }
        ],
        symbols: [{ sym: '$s$', name: '물체 거리', unit: 'cm', target: 's' }, { sym: '$f$', name: '초점거리', unit: 'cm', target: 'f' }, { sym: '$s′$', name: '상 거리', unit: 'cm', target: 'meter:si' }, { sym: '$m$', name: '배율', unit: '배', target: 'meter:m' }],
        condition: '얇은 렌즈 · 광축 가까이',
        try: { label: '$f$ = 20, $s$ = 50 으로 공식 확인', preset: 5 },
        teacherNote: '고급 전용. 두 닮은 삼각형에서 나온 두 식을 같게 놓는 대수를 학생이 직접 쓰게 한다. 실험 ⑥ 의 계기(공식 일치 ✓)로 마무리.' },
      { id: 'limits', type: 'concept', levels: ['adv'], title: '공식은 언제까지 맞을까?',
        body: [
          '식은 **얇은 렌즈**이고 빛이 **광축 가까이**를 지날 때만 맞는 근사예요(실제 렌즈는 수차 때문에 상이 조금 흐려져요).',
          '$s$ = $f$ 이면 $s′$ 가 한없이 커져요 — 빛이 나란히 나가서 상이 생기지 않아요.',
          '부호 약속: 초점 안쪽($s$ < $f$)이면 $s′$ < 0 → 렌즈 앞쪽의 허상이고 $m$ > 0 (바로 선 상)이에요.'
        ],
        condition: '얇은 렌즈 · 광축 가까이 · 단색광',
        try: { label: '$s$ = $f$ 경계에서 상이 생기는지', preset: 6 },
        teacherNote: '고급 전용. 실험 ⑦(s = f)에서 상이 사라지는 것을 \'평행광\' 으로 말하게 한다. 수차는 한 줄만.' },

      /* 9장 */
      { id: 'life', type: 'life', title: '생활 속 볼록렌즈',
        body: [
          '**돋보기**: 물체를 초점 안쪽에 두고 들여다보면 바로 선 큰 허상이 보여요.',
          '**카메라와 눈**: 먼 풍경(2F 밖)의 작고 거꾸로 선 실상을 센서·망막에 맺어요. 눈은 수정체 두께를 조절해 초점을 맞추고, 뇌가 다시 바로 세워 인식해요.',
          '**프로젝터**: 슬라이드를 렌즈의 F 바로 바깥에 두면 멀리 있는 스크린에 크게 확대된 실상이 생겨요.',
          '**반도체 공정(포토리소그래피)**: 큰 회로 그림(마스크)을 2F 보다 멀리 두어 웨이퍼 위에 작게 줄여 새겨요.'
        ],
        svg: function (D) {
          var cards = [
            { t: '돋보기', s: 0.6, kind: '바로 선 큰 허상' },
            { t: '카메라 · 눈', s: 3, kind: '작은 실상' },
            { t: '프로젝터', s: 1.4, kind: '큰 실상' },
            { t: '반도체 공정', s: 2.6, kind: '줄인(축소) 실상' }
          ], kids = [];
          cards.forEach(function (c, i) {
            var x0 = 20 + i * 192, w = 180, cy = 230, L = x0 + 112, f = 26;
            kids.push('<rect x="' + x0 + '" y="70" width="' + w + '" height="330" rx="12" style="fill:var(--color-paper-raised);stroke:var(--color-line-strong);stroke-width:1.5"/>');
            kids.push(D.label(x0 + w / 2, 104, c.t, { anchor: 'middle', weight: 500 }));
            kids.push(D.line(x0 + 10, cy, x0 + w - 10, cy, { color: 'muted', w: 1.2, dash: '6 4' }), D.lens(L, cy, 110));
            kids.push(D.dots([[L - f, cy], [L - 2 * f, cy], [L + f, cy]], { r: 3.5, color: 'sim' }));
            kids.push(arrowV(D, Math.max(x0 + 14, L - c.s * f), cy, 28, { w: 3 }));
            kids.push(D.label(L - f + 10, cy + 26, 'F', { anchor: 'middle', size: 22, color: 'sim' }), D.label(L - 2 * f - 8, cy + 26, '2F', { anchor: 'middle', size: 22, color: 'sim' }));
            kids.push(D.label(x0 + w / 2, 352, c.kind, { anchor: 'middle', size: 18, color: 'sim' }));
          });
          return D.svg(kids, { title: '물체를 어디에 두나 (F·2F 기준)', how: '돋보기는 F 안, 프로젝터는 F~2F, 카메라·눈과 반도체 공정은 2F 밖' });
        },
        teacherNote: '시간이 부족하면 건너뛰고 7장 표의 생활 예로 대신해요. 반도체 공정은 [12물리03-02] 의 소개 소재이고 [12전자02-02] 와 이어져요(정성).' },

      /* 10장 */
      { id: 'misc', type: 'misconception', title: '흔한 오해 4가지',
        items: [
          { id: 'half-lens', claim: '"렌즈 반쪽을 가리면 상도 반쪽만 생겨요."', chapter: 'three-rays',
            why: '한 점의 빛은 렌즈 어디를 지나도 같은 점에 모여요. 남은 절반으로도 상 전체가 생겨요.',
            try: { preset: 4 }, result: '상 전체가 생기고 밝기만 줄어요.' },
          { id: 'no-screen', claim: '"스크린을 치우면 상도 사라져요."', chapter: 'real-virtual',
            why: '실상은 빛이 실제로 모이는 자리에 생겨요. 스크린은 그 빛을 받아 보이게 할 뿐이에요.',
            try: { preset: null, set: base({ screen: false }), predict: false }, result: '스크린이 없어도 광선은 15 cm 자리에서 만나요.' },
          { id: 'at-focus', claim: '"물체를 초점에 두면 상이 가장 커요."', chapter: 'by-position',
            why: '초점에서 나온 빛은 렌즈를 지나 나란히 나가 만나지 않아요. 가장 큰 상은 초점 바로 바깥에서.',
            try: { preset: null, set: base({ s: 10 }), predict: false }, result: '$s$ = $f$ = 10 cm — 상이 생기지 않아요.' },
          { id: 'virtual-fake', claim: '"허상은 가짜라서 볼 수 없어요."', chapter: 'real-virtual',
            why: '돋보기 속 큰 글자가 허상이에요. 눈으로 보이고, 스크린에만 맺히지 않아요.',
            try: { preset: 3 }, result: '돋보기 창에 바로 선 큰 상이 보여요.' }
        ] },

      /* 11장 */
      { id: 'check', type: 'check', levels: ['basic', 'mid', 'adv'], title: '시뮬레이터에서 확인할 질문',
        questions: [
          { q: '먼 풍경의 상은 렌즈에서 얼마나 떨어진 곳에 생길까? 초점거리 $f$ 를 어떻게 알아낼까?', levels: ['mid', 'adv'], preset: 0, chapter: 'terms' },
          { q: { basic: '물체를 렌즈에서 20 cm(초점거리 10 cm 의 두 배)에 두면 상의 크기는?', mid: '물체를 2F 에 두면 상은 어디에, 어떤 크기로?' }, preset: 1, chapter: 'by-position' },
          { q: '물체가 2F 보다 멀면(기본 상태) 상은?', levels: ['mid'], cardName: '기본 상태 · 물체 30 cm', preset: null, set: base({}), predict: false, chapter: 'by-position-table' },
          { q: { basic: '슬라이드를 렌즈 쪽으로 가까이 옮기면 화면의 상은?', mid: '프로젝터 화면을 크게 하려면 슬라이드를 어디로?' }, preset: 2, chapter: 'magnify' },
          { q: { basic: '물체를 초점 안쪽 아주 가까이에 두고 렌즈 너머로 보면?', mid: '물체를 초점 안쪽에 두고 들여다보면?' }, preset: 3, chapter: 'real-virtual' },
          { q: '물체를 초점 바로 위에 두면 상은?', levels: ['mid'], cardName: '물체 10 cm (초점 위)', preset: null, set: base({ s: 10 }), predict: false, chapter: 'by-position-table' },
          { q: '렌즈 위쪽 절반을 가리면 상은 어떻게 될까?', preset: 4, chapter: 'misc' },
          { q: '$f$ = 20 cm, $s$ = 50 cm 이면 상 거리와 배율은? 먼저 공식으로 구해 보세요.', levels: ['adv'], preset: 5, chapter: 'lens-formula' },
          { q: '물체를 $f$ 에 가깝게 보내면 상 거리는 어떻게 될까?', levels: ['adv'], preset: 6, chapter: 'limits' }
        ],
        teacherNote: '초급 질문은 ①~④ 네 장면(20 cm · 가까이 · 아주 가까이 · 렌즈 가리기). 고급은 ⑥⑦ 카드(공식 확인 · s = f 경계)를 더하고, 표 확인 질문 둘(기본 상태 · 초점 위)은 ⑥⑦ 이 같은 내용이라 중급에만 둔다(고급 7개 = 4열 2줄, 1280 에서 넘치지 않게).\n한 질문에 해 보기 하나. 4장은 기본 상태에서 Q·W·E 로 광선을 하나씩 꺼 보고, 5장은 실험 ④ + 스크린 놓기(I) 로 확인해요. 실험 ① 은 $f$ 를 숨기므로 정리 단계에서 답을 공개해요.' },

      /* 정리 모달 전용 (설명 순서에서는 빠진다) */
      { id: 'wrap', type: 'wrap', title: '실험 뒤 정리',
        summary: ['물체를 렌즈 쪽으로 옮기면 상은 멀어지고 커져요. 2F 에 두면 같은 크기, 초점 안쪽은 스크린에 안 맺히는 바로 선 허상이에요. 렌즈를 가려도 상은 그대로이고 어두워질 뿐이에요.',
          '자기 평가: 잘 이해했어요 / 조금 헷갈려요 / 다시 보고 싶어요 — 다시 보고 싶으면 문항의 설명 장으로 돌아가요.'],
        quiz: [
          /* ── R9 초급 3문항 (levels:['basic']) — 중급 문항은 R8 그대로 ── */
          { kind: 'concept', levels: ['basic'], q: '물체를 렌즈에서 아주 멀리 두었을 때 스크린에 맺히는 상은?',
            choices: ['거꾸로 선 작은 상', '바로 선 큰 상', '상이 안 생겨요'], answerIdx: 0,
            why: '멀리 있는 물체의 빛은 초점 가까이에 모여 작고 거꾸로 선 상이 돼요.', chapter: 'by-position', try: { preset: null, set: base({}), predict: false } },
          { kind: 'compare', levels: ['basic'], q: '물체를 렌즈 쪽으로 가까이(초점 밖에서) 옮기면 스크린의 상 크기는?',
            choices: ['커져요', '작아져요', '그대로예요'], answerIdx: 0,
            why: '가까워질수록 상이 커지고 스크린은 멀어져요.', chapter: 'by-position', try: { preset: 2 } },
          { kind: 'misconception', levels: ['basic'], q: '"렌즈 위쪽 절반을 가리면 상의 위쪽 절반이 사라진다." 이 말은?',
            choices: ['맞아요', '아니에요, 상 전체가 어두워져요', '알 수 없어요'], answerIdx: 1,
            why: '남은 렌즈를 지난 빛이 같은 점에 모여요.', chapter: 'three-rays', try: { preset: 4 } },
          { kind: 'concept', q: '$f$ = 10 cm 인 볼록렌즈 앞 20 cm(2F)에 물체를 두었어요. 상은 어디에, 어떤 크기로 생길까?',
            choices: ['렌즈 뒤 10 cm, 물체보다 작게', '렌즈 뒤 20 cm, 물체와 같은 크기', '렌즈 뒤 40 cm, 물체보다 크게'], answerIdx: 1,
            why: '2F 에 둔 물체의 빛은 반대쪽 2F(20 cm)에 모여요. 물체 거리와 상 거리가 같아 배율 1배, 거꾸로 선 실상이에요.', chapter: 'by-position', try: { preset: 1 } },
          { kind: 'calc', q: '$f$ = 10 cm 렌즈에서 물체 거리 12 cm 의 물체가 렌즈 뒤 60 cm 에 상을 만들어요. 배율은?',
            choices: ['0.2배', '5배', '48배'], answerIdx: 1,
            why: '배율 = {{frac:상 거리|물체 거리}} = {{frac:60|12}} = 5배. 초점 바로 바깥이라 거꾸로 선 큰 실상이에요.', chapter: 'magnify', try: { preset: null, set: base({ s: 12, screenX: 60 }), predict: false } },
          { kind: 'misconception', q: '"렌즈 위쪽 절반을 종이로 가리면 상의 위쪽 절반이 사라진다." 맞을까?',
            choices: ['맞다. 위쪽 절반이 사라진다', '아니다. 상 전체가 생기고 어두워진다', '아니다. 상이 아예 사라진다'], answerIdx: 1,
            why: '남은 절반을 지난 빛도 같은 점에 모여 상 전체가 생겨요. 줄어드는 것은 밝기뿐이에요.', chapter: 'misc', try: { preset: 4 } }
        ],
        more: [
          { levels: ['adv'], q: '$f$ = 10 cm, $s$ = 15 cm 일 때 상 거리와 배율은?', answer: '$s′$ = 30 cm, $m$ = 2배 (거꾸로)', why: '{{frac:1|$s′$}} = {{frac:1|10}} − {{frac:1|15}} = {{frac:1|30}} → $s′$ = 30 cm, $m$ = 30 ÷ 15 = 2.', chapter: 'lens-formula' },
          { levels: ['adv'], q: '$f$ = 10 cm, $s$ = 5 cm 의 상은?', answer: '$s′$ = −10 cm (렌즈 앞쪽 허상), $m$ = +2', why: '{{frac:1|$s′$}} = {{frac:1|10}} − {{frac:1|5}} = −{{frac:1|10}} → $s′$ = −10 cm.', chapter: 'limits' },
          { levels: ['adv'], q: '작도로 구한 상 위치와 렌즈 공식 값이 다르면 공식이 틀린 것일까?', answer: '아니다 — 작도의 눈금·선 오차', why: '얇은 렌즈·광축 가까이 근사에서 두 방법은 같은 결과를 줘요.', chapter: 'limits' },
          { q: '물체를 초점 안쪽에 두었는데 스크린에 상이 안 보여요. 고장일까?', answer: '아니다 — 허상이라서', why: '허상은 빛이 모이지 않아 스크린에 맺히지 않아요. 렌즈 너머로 들여다보면 보여요.', chapter: 'real-virtual' },
          { q: '$f$ 를 20 cm 로 바꾸고 물체를 2F 에 두면 상 거리는?', answer: '40 cm, 같은 크기', why: '2F = 2$f$ = 40 cm 자리에 둔 물체는 반대쪽 40 cm 에 1배 실상을 만들어요.', chapter: 'by-position' }
        ] }
    ],
    links: { terms: 'terms', 'three-rays': 'three-rays', 'real-virtual': 'real-virtual', 'by-position': 'by-position', magnify: 'magnify', misc: 'misc' }
  });

  /* R7-3(C6b): 7장 표 행마다 [해 보기] — 공통 표(tableBox)에 행 동작이 없어 이 sim 에서만 붙인다(shared 요청: table.rows[].try).
     표가 그려질 때(설명 층 다시 그리기) 첫 칸을 단추로 바꾸고 행 전체를 누를 수 있게. 고른 행은 강조, 그림 칸도 같은 번호 강조 */
  function decorateTable(tb) {
    if (!tb || tb.getAttribute('data-rowtry')) return;
    var head = tb.querySelector('thead th');
    if (!head || head.textContent.replace(/\s/g, '') !== '물체위치') return;
    tb.setAttribute('data-rowtry', '1');
    [].forEach.call(tb.querySelectorAll('tbody tr'), function (tr, i) {
      var c = POS[i]; if (!c) return;
      var th = tr.querySelector('th'); if (!th) return;
      var txt = th.textContent;
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'cl-rowtry';
      b.setAttribute('aria-label', '해 보기: 물체를 ' + txt + '(' + c.s + ' cm)에 두기');
      b.appendChild(document.createTextNode(txt));
      var ic = SimKit.icon && SimKit.icon('chev-right', { cls: 'ico--trail' }); if (ic) b.appendChild(ic);
      th.textContent = ''; th.appendChild(b);
      tr.classList.add('cl-row'); tr.classList.toggle('is-sel', i === selPos);
      if (i === selPos) tr.setAttribute('aria-current', 'true');
      function go() {
        selPos = i;
        var q = {}, k; for (k in c.tryQ) q[k] = c.tryQ[k];
        q.chapter = 'by-position-table';
        SimKit.lessonTry(q);
      }
      b.addEventListener('click', function (e) { e.stopPropagation(); go(); });
      tr.addEventListener('click', go);
    });
  }
  function watchTable() {
    var root = document.querySelector('section.lesson');
    if (!root) return false;
    new MutationObserver(function () { if (!root.hidden) decorateTable(root.querySelector('.lesson__table:not([data-rowtry])')); }).observe(root, { childList: true, subtree: true });
    decorateTable(root.querySelector('.lesson__table'));
    return true;
  }
  if (!watchTable()) {   // 설명 층이 아직 없으면 body 에 붙을 때까지 기다린다
    var wb = new MutationObserver(function () { if (watchTable()) wb.disconnect(); });
    wb.observe(document.body || document.documentElement, { childList: true });
  }
})();
