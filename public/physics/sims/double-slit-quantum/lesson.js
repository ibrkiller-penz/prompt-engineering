/* =====================================================================
   이중 슬릿: 빛에서 전자 하나까지 — 교과 설명 데이터 (R7 1차 B1 → R7 2차 B1·B2, UI팀2)
   원고: docs/교과설명/double-slit-quantum.md (기획B 2차) · 형식: docs/SIMKIT.md §0R7-2-4·§0R7-6
   2차: 설명 11장(4장 식 / 5장 계산 분할) + 정리(wrap, 정리 모달 전용) · terms · symbols[].target(갈래별 객체)
        · now(기록 전에는 Δy 값 없음) · 오해 3장 try/result · quiz 3(answerIdx) · check 탭 빛/전자
   그림은 인라인 SVG(SimDiagram, viewBox 800×450) — 색은 실험 화면과 같은 토큰:
     광원 상자 --color-ink-muted · 슬릿판 --color-line-strong · 스크린 --color-canvas-dark · 전자 점 --sim-tint
   해 보기: 이 실험은 '빛(physics) / 전자 하나씩(quantum)' 두 갈래라 실험 카드 목록이 갈래마다 다르다.
     질문의 mode('physics'|'quantum') + card(그 갈래의 카드 0~4)를 double-slit-quantum.js 가 받아
     먼저 갈래를 바꾼 뒤 공통 SK.lessonTry 로 넘긴다(preset 은 비워 둔다 — 다른 갈래 카드 이름이 칩에 잘못 뜨지 않게).
   ===================================================================== */
(function () {
  'use strict';
  var SK = window.SimKit;
  if (!SK || !SK.lesson) return;

  var SLIT = 'var(--color-line-strong)', SCR = 'var(--color-canvas-dark)', BOX = 'var(--color-ink-muted)', LIGHT = 'var(--color-paper-raised)';
  var BEAM = 'var(--color-warn)', DOTC = 'var(--sim-tint)';

  /* ── 그림 조각 (문자열) ── */
  function rect(x, y, w, h, fill, o) {
    o = o || {};
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + (o.rx === undefined ? 4 : o.rx) + '" style="fill:' + fill +
      (o.stroke ? ';stroke:' + o.stroke + ';stroke-width:' + (o.sw || 2) : '') + (o.op !== undefined ? ';opacity:' + o.op : '') + '"/>';
  }
  /** 광원(레이저·전자총) 상자 — 실험 화면처럼 회갈색 상자 + 앞 구멍 */
  function source(D, x, y, kind) {
    var out = rect(x, y - 30, 90, 60, BOX, { rx: 8 }) + rect(x + 86, y - 7, 10, 14, LIGHT, { rx: 1 });
    if (kind === 'electron') for (var i = 0; i < 4; i++) out += D.line(x + 18 + i * 12, y - 14, x + 24 + i * 12, y + 14, { color: 'tint', w: 3 });
    else out += '<circle cx="' + (x + 26) + '" cy="' + y + '" r="9" style="fill:' + BEAM + '"/>';
    return out;
  }
  /** 슬릿판(세로) — 틈 두 개(가운데 y ± sep/2) */
  function plate(x, y, h, sep, gap, o) {
    o = o || {};
    var top = y - h / 2, bot = y + h / 2, a = y - sep / 2, b = y + sep / 2, w = 12, out = '';
    out += rect(x - w / 2, top, w, a - gap / 2 - top, SLIT, { rx: 2 });
    if (o.one) out += rect(x - w / 2, a + gap / 2, w, bot - a - gap / 2, SLIT, { rx: 2 });
    else out += rect(x - w / 2, a + gap / 2, w, b - a - gap, SLIT, { rx: 2 }) + rect(x - w / 2, b + gap / 2, w, bot - b - gap / 2, SLIT, { rx: 2 });
    return out;
  }
  /** 스크린(옆에서 본 세로 띠) + 밝은 줄(가로 막대). bars = [[y, 굵기], …] */
  function screenSide(x, y, w, h, bars, color) {
    var out = rect(x, y - h / 2, w, h, SCR, { rx: 6 });
    (bars || []).forEach(function (b) { out += rect(x + 3, b[0] - b[1] / 2, w - 6, b[1], color || LIGHT, { rx: 2 }); });
    return out;
  }
  /** 사인파 경로 (cx0~cx1, 가운데 cy, 진폭 A, 파장 lam, 위상 ph[rad]) */
  function sine(x0, x1, cy, A, lam, ph) {
    var d = '';
    for (var x = x0; x <= x1; x += 4) {
      var y = cy - A * Math.sin(2 * Math.PI * (x - x0) / lam + (ph || 0));
      d += (x === x0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1);
    }
    return d;
  }
  /** 같은 씨앗이면 같은 점 (그림이 넘길 때마다 바뀌지 않게) */
  function rng(seed) {
    var s = seed >>> 0;
    return function () { s = (s + 0x6D2B79F5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  /** 이중 슬릿 무늬를 따르는 점 n 개 (정면에서 본 스크린: x 방향 줄무늬) */
  function fringeDots(x, y, w, h, n, seed, r) {
    var rand = rng(seed), out = '', P = h / 8.4, made = 0, guard = 0;
    while (made < n && guard < n * 60) {
      guard++;
      // R7 학생점검(C1): 줄무늬는 가로 띠(1장 그림·실험 확대창과 같은 방향) — 밝기는 위아래(u) 위치로 정해진다
      var u = rand() * h - h / 2, v = rand();
      var I = Math.pow(Math.cos(Math.PI * u / P), 2) * Math.exp(-Math.pow(u / (h * 0.42), 2));
      if (v > I) continue;
      var px = x + 6 + rand() * (w - 12);
      out += '<circle cx="' + px.toFixed(1) + '" cy="' + (y + h / 2 + u).toFixed(1) + '" r="' + r + '" style="fill:' + DOTC + '"/>';
      made++;
    }
    return out;
  }
  /** 세로 치수선 — 글은 선 왼쪽(또는 오른쪽)에 (D.dim 글자는 세로선에서 선 위에 놓여서 따로 쓴다) */
  function vdim(D, x, y1, y2, label, right, sym) {
    return D.dim(x, y1, x, y2, '') + D.label(right ? x + 14 : x - 14, (y1 + y2) / 2, label, { anchor: right ? 'start' : 'end', size: 22, bg: true, sym: sym });
  }
  /** 퍼지는 물결(반원 점선) */
  function ripples(D, x, y, rs) {
    return rs.map(function (r) { return D.path('M' + x + ' ' + (y - r) + 'A' + r + ' ' + r + ' 0 0 1 ' + x + ' ' + (y + r), { color: 'muted', w: 1.5, dash: '5 6' }); }).join('');
  }

  /** 줄 간격 이론값(mm): Δy = λL/d — λ nm · L m · d mm → (λ×10⁻⁹ × L) ÷ (d×10⁻³) m = λL/d × 10⁻³ mm */
  function dyMM(p) { return p.lam * p.L / p.d / 1000; }
  /** 가속 전압 V(볼트) → 전자의 물질파 파장(pm): λ = h / √(2meV) */
  function pmOfV(V) { return 6.62607e-34 / Math.sqrt(2 * 9.10938e-31 * 1.602177e-19 * V) * 1e12; }
  function f(x, n) { return SK.fmt ? SK.fmt(x, n) : Number(x).toFixed(n); }
  /** 이론 Δy 잠금: 기록 전이거나 교사가 '답 확인'을 잠갔으면(학생 화면) 값을 보이지 않는다 */
  function theoryLocked(st) {
    if (!st || !st.records) return true;
    var html = document.documentElement;
    return html.classList.contains('reveal-locked') && !html.classList.contains('is-teacher');
  }
  var LAM = { physics: 'lam', quantum: 'V' }, DD = { physics: 'd', quantum: 'dR' }, LL = { physics: 'L', quantum: 'LR' };

  SK.lesson({
    slug: 'double-slit-quantum',
    title: '빛과 전자는 두 틈을 지나 무엇을 만들까?',
    standards: [
      { code: '12물리03-01', subj: '물리학', text: '빛의 중첩·간섭으로 파동성 설명' },
      { code: '12전자03-01', subj: '전자기와 양자', text: '이중 슬릿으로 입자-파동 이중성(정성)' },
      { code: '12물리03-03', subj: '물리학', text: '연계: 이중성의 기술 활용' }
    ],
    // R9: data.simple 은 장마다 levels 로 대체(초급 = goal · wave-words · dy-see · check, 앞에 복습 3장 · 고급 전용 derive·limits)
    /* R7-2: 용어·기호 사전 — 결과 해설·정리 문항·식 팝업이 같은 말을 쓴다 (where = 실험 화면에서 강조할 곳) */
    terms: [
      { term: '슬릿', mean: '빛이나 전자가 지나가는 아주 좁은 틈. 이중 슬릿 = 틈 두 개' },
      { term: '간섭 무늬', mean: '두 파동이 겹쳐 생긴 밝은 줄과 어두운 줄 — 파동이라는 증거', where: 'stage:dy' },
      { term: '경로차', mean: '두 슬릿에서 스크린의 한 점까지 가는 거리의 차. 파장의 정수배면 밝은 줄' },
      { term: '무늬 간격', sym: '$Δy$', unit: 'mm', mean: '이웃한 밝은 줄 사이 간격 — $Δy$ = {{frac:$λL$|$d$}}', where: 'stage:dy' },
      { term: '파장', sym: '$λ$', unit: 'nm', mean: '마루에서 다음 마루까지 거리 (1 nm = 10⁻⁹ m)', where: LAM },
      { term: '슬릿 간격', sym: '$d$', unit: 'mm', mean: '두 슬릿 사이 간격 (전자 실험은 모형 눈금)', where: DD },
      { term: '스크린 거리', sym: '$L$', unit: 'm', mean: '슬릿판에서 스크린까지 거리 (전자 실험은 모형 눈금)', where: LL },
      { term: '광자', mean: '빛의 에너지 알갱이. 하나의 에너지 $E$ = $hf$' },
      { term: '물질파', mean: '움직이는 입자가 가지는 파동 — 파장 $λ$ = {{frac:$h$|$p$}} (드브로이 파장)', where: 'stage:lam' },
      { term: '가속 전압', sym: '$V$', unit: 'V', mean: '전자를 빠르게 하는 전압. 클수록 운동량 $p$ 가 커져 파장이 짧아요', where: 'V' },
      { term: '측정기', mean: '전자가 어느 슬릿을 지났는지 기록하는 장치', where: 'det' },
      { term: '모형 눈금', mean: '전자 실험의 $d$·$L$·줄 간격은 화면에 보이게 키운 눈금 — 실제 간격은 훨씬 좁아요' }
    ],
    chapters: [

      /* ── R9 중학교에서 배운 것 (복습 1~3) — 원고 docs/교과설명/double-slit-quantum_중학교.md · 성취기준 코드 없음 ──
         3장의 '물결 겹침' 은 중학교에서 정식으로 배우지 않았을 수 있어 '물결에서 본 것' 으로 쓴다(정직성) */
      { id: 'mid-school-1', type: 'review', no: 1, of: 3, title: '파동은 무엇을 옮길까?',
        source: '중학교 과학 「빛과 파동」 계열 단원',
        body: [
          '물 위에 나뭇잎을 띄우고 물결을 만들면, 잎은 제자리에서 위아래로만 움직여요. 물결 모양은 멀리 퍼져 가는데도요. 그래서 파동은 물질이 이사 가는 것이 아니라 **흔들림**이 옮겨 가는 것이에요.',
          '가장 높은 곳이 **마루**, 가장 낮은 곳이 **골**이에요. 마루에서 다음 마루까지 거리가 **파장**(물결 한 칸의 길이), 가만히 있을 때 높이에서 마루까지가 **진폭**이에요.',
          '1초에 몇 번 흔들리는지가 **진동수**(Hz), 한 번 흔들리는 데 걸리는 시간이 **주기**예요. 주기 = 1 ÷ 진동수.'
        ],
        terms: ['마루', '골', '파장', '진폭', '진동수', '주기'],
        bridge: '이 단원에서는 \'파장\'이라는 말만 기억하면 돼요. 파장이 길고 짧음이 줄무늬 간격을 바꿔요.',
        selfcheck: { q: '파동이 지나갈 때 물 위의 나뭇잎은 어떻게 움직일까요?', choices: ['제자리에서 위아래로 움직여요', '파동을 따라 멀리 가요', '가만히 있어요'], answerIdx: 0, why: '흔들림만 전해지고 물은 이동하지 않아요.' },
        teacherNote: ['성취기준 코드 미확인 — 단원명만 표기(학년·단원명 확인 필요 — 학생 화면에는 표시하지 않음). \'파동의 속력 = 진동수 × 파장\' 은 중학교 범위가 불확실해 쓰지 않았다.'],
        svg: function (D) {
          var k = [], x0 = 70, w = 660, lam = w / 3, cx1 = x0 + lam / 4, cx2 = cx1 + lam, y = 210, A = 44;
          k.push(D.line(x0, y, x0 + w, y, { color: 'muted', w: 1.5, dash: '6 6' }));
          k.push(D.wave(x0, y, w, A, 3, { color: 'sim', w: 3.5, phase: 0 }));
          k.push(D.dots([[cx1, y - A], [cx2, y - A]], { r: 7, color: 'warn' }));
          k.push(D.dim(cx1, y - A - 34, cx2, y - A - 34, '파장', { off: -22 }));
          k.push(D.dim(cx1 - 30, y, cx1 - 30, y - A, '', {})); k.push(D.label(cx1 - 42, y - A / 2, '진폭', { anchor: 'end', size: 20 }));
          k.push(D.ball(560, y + 120, 11, { color: 'warn' })); k.push(D.arrow(560, y + 104, 560, y + 62, { color: 'muted' })); k.push(D.arrow(560, y + 136, 560, y + 178, { color: 'muted' }));
          k.push(D.label(580, y + 120, '나뭇잎: 위아래로만', { anchor: 'start', size: 20 }));
          return D.svg(k, { title: '물결(파동)의 모양', how: '물결은 옆으로 퍼져 가지만 나뭇잎은 제자리에서 위아래로만 움직여요' });
        } },
      { id: 'mid-school-2', type: 'review', no: 2, of: 3, title: '빛도 파동이에요, 색마다 파장이 달라요',
        source: '중학교 과학 「빛과 파동」 계열 단원 — 직진·반사·굴절·프리즘',
        body: [
          '빛은 곧게 나아가고(직진), 거울에서 튕기고(반사), 물이나 유리에서 꺾여요(굴절). 햇빛이 프리즘을 지나면 빨주노초파남보로 갈라져요. 색마다 꺾이는 정도가 달라서예요.',
          '색의 차이는 **파장**(물결 한 칸의 길이, 복습 1)의 차이예요. 빨간빛은 파장이 길어서 약 650 nm, 파란빛은 짧아서 약 450 nm 예요.',
          '1 nm 는 10억 분의 1 m 예요. 빨간빛의 파장 650 nm 는 머리카락 굵기(약 0.07 mm)의 100분의 1쯤 — 아주 짧아요.'
        ],
        terms: ['직진', '반사', '굴절', '색(파장)', 'nm'],
        bridge: '중학교에서는 빛 하나가 꺾이는 것까지 배웠어요. 이제 빛 두 줄기가 한곳에서 만나면 어떻게 되는지를 더해요.',
        selfcheck: { q: '빨간빛과 파란빛 중 파장이 더 긴 빛은?', choices: ['빨간빛', '파란빛', '같아요'], answerIdx: 0, why: '빨강 약 650 nm, 파랑 약 450 nm 예요.' },
        teacherNote: ['성취기준 코드 미확인 — 단원명만 표기. 빛을 파동이라 부르는 표현의 중학교 사용 범위는 (확인 필요). 수정(교사P): 0.07 mm ÷ 650 nm ≈ 108 이므로 100분의 1 은 650 nm 파장에 대한 비율이다(1 nm 는 머리카락의 약 7만분의 1). 본문을 그렇게 고쳤다.'],
        svg: function (D) {
          var k = [], cols = ['#C0392B', '#D9822B', '#C9A227', '#2E8B57', '#2F6DB5', '#5B5F97'];
          // 팀장 R9 결과(교사P): 빛은 프리즘 밑변 쪽(아래)으로 꺾인다 — 왼쪽 면(x 210)에서 들어가 오른쪽 면(x 298)에서 나와 아래로 퍼짐, 빨강이 가장 덜 꺾임
          k.push(D.path('M250 70 L330 230 L170 230 Z', { color: 'ink', w: 2.5, fill: 'tint' }));
          k.push(D.line(60, 150, 210, 150, { color: 'ink', w: 5 }));
          k.push(D.line(210, 150, 298, 166, { color: 'ink', w: 3 }));
          cols.forEach(function (c, i) { k.push('<line x1="298" y1="166" x2="720" y2="' + (186 + i * 22) + '" style="stroke:' + c + ';stroke-width:4;stroke-linecap:round"/>'); });
          k.push(D.label(60, 120, '햇빛', { anchor: 'start', size: 20 })); k.push(D.label(250, 258, '프리즘', { anchor: 'middle', size: 20 }));
          k.push(D.bar(110, 380, 580, 22, { fill: '#2E8B57' }));
          k.push(D.wave(120, 330, 150, 16, 1.5, { color: '#5B5F97', w: 3 })); k.push(D.wave(540, 330, 150, 16, 4.5, { color: '#C0392B', w: 3 }));
          k.push(D.label(110, 410, '400 nm 보라', { anchor: 'start', size: 20, bg: false })); k.push(D.label(690, 410, '700 nm 빨강', { anchor: 'end', size: 20, bg: false })); k.push(D.label(400, 410, '550 초록', { anchor: 'middle', size: 20, bg: false }));
          return D.svg(k, { title: '프리즘과 파장', how: '빛은 색마다 파장이 달라요 — 파장이 길수록 빨강 쪽' });
        } },
      { id: 'mid-school-3', type: 'review', no: 3, of: 3, title: '물결에서 본 것: 틈을 지나 퍼지고, 두 물결이 만나면',
        source: '물결의 퍼짐(회절)·겹침은 중학교에서 정식으로 배우지 않았을 수 있어요 — \'물결 놀이에서 본 것\' 으로 소개해요',
        body: [
          '물결이 좁은 틈을 지나면 틈 뒤에서 동그랗게 퍼져 나가요. 틈이 좁을수록 더 동그랗게 퍼져요.',
          '틈이 두 개면 두 곳에서 동그란 물결이 나와요. 두 물결이 만나는 곳에서는 어떤 곳은 크게 출렁이고, 어떤 곳은 거의 잔잔해요.',
          '크게 출렁이는 곳은 마루와 마루(또는 골과 골)가 만난 곳, 잔잔한 곳은 마루와 골이 만난 곳이에요.'
        ],
        terms: ['퍼짐', '겹침'],
        bridge: '중학교에서는 파동 하나를 봤어요. 이제 두 파동이 만나면 더해진다는 것을 더해요. 빛도 두 틈을 지나면 이렇게 겹쳐서 밝은 줄과 어두운 줄을 만들어요.',
        selfcheck: { q: '두 물결이 만나 잔잔해진 곳에서는 어떤 모양이 만난 걸까요?', choices: ['마루와 골', '마루와 마루', '골과 골'], answerIdx: 0, why: '올라가려는 것과 내려가려는 것이 서로 지워요.' },
        teacherNote: ['성취기준 코드 미확인. 두 물결의 겹침은 중학교 정식 내용이 아닐 수 있다 — \'본 것\' 으로 라벨(정직성). 맞히면 건너뛰기 안내.'],
        svg: function (D) {
          var k = [];
          k.push(D.slit(200, 235, 330, { gap: 22, sep: 90 }));
          k.push(D.ripples(206, 190, 22, 28, 5, { color: 'sim', w: 2 })); k.push(D.ripples(206, 280, 22, 28, 5, { color: 'sim', w: 2 }));   // 팀장 R9 결과(학생M): 제목 줄(y 34)과 겹치지 않는 크기
          k.push(D.line(350, 90, 350, 380, { color: 'muted', w: 1.2, dash: '4 6' }));
          [[350, 235], [350, 176], [350, 294]].forEach(function (c) { k.push(D.dots([c], { r: 9, color: 'warn' })); });
          [[350, 205], [350, 265]].forEach(function (c) { k.push(D.dots([c], { r: 9, color: 'ink', hollow: true })); });
          k.push(D.dots([[520, 160]], { r: 9, color: 'warn' })); k.push(D.label(540, 160, '크게 출렁', { anchor: 'start', size: 22 }));
          k.push(D.dots([[520, 210]], { r: 9, color: 'ink', hollow: true })); k.push(D.label(540, 210, '거의 잔잔', { anchor: 'start', size: 22 }));
          k.push(D.label(540, 258, '마루+마루 → 크게', { anchor: 'start', size: 20, color: 'muted' })); k.push(D.label(540, 288, '마루+골 → 잔잔', { anchor: 'start', size: 20, color: 'muted' }));
          k.push(D.label(190, 428, '틈 두 개(위에서 본 수조)', { anchor: 'middle', size: 20, color: 'muted' }));   // 팀장 R9 결과: 틈 막대 끝(y 400) 아래
          return D.svg(k, { title: '두 틈에서 퍼지는 물결', how: '반원 = 퍼져 가는 물결 · 두 물결이 만나는 곳이 크게 출렁이거나(●) 잔잔해요(○)' });
        } },
      /* 1장 */
      { id: 'goal', type: 'goal', title: '빛과 전자는 두 틈을 지나 무엇을 만들까?', levels: ['basic', 'mid', 'adv'],
        question: { basic: '빛이 두 틈을 지나면 스크린에 무엇이 생길까?', mid: '전자를 한 개씩 보내도 무늬가 생길까?' },
        body: { basic: [
          '빛이 두 개의 좁은 틈을 지나면 스크린에 밝은 줄과 어두운 줄이 번갈아 생겨요. 이것이 **줄무늬**(간섭 무늬)예요.',
          '이 장면으로 빛이 파동임을 확인하고, 색(파장)이나 틈 사이 거리를 바꾸면 밝은 줄 사이가 어떻게 달라지는지 알아봐요.'
        ], mid: [
          '빛이 두 개의 좁은 틈({{슬릿}})을 지나면 스크린에 밝은 줄과 어두운 줄이 번갈아 생겨요. 이것이 **간섭 무늬**예요.',
          '이 장면으로 빛이 파동임을 확인하고, 무늬 간격이 무엇에 달려 있는지 알아봐요. 마지막에는 전자와 {{광자}}를 한 개씩 보내도 무늬가 생기는지 확인해요.'
        ] },
        goals: { basic: ['줄무늬가 왜 생길까', '색과 틈을 바꾸면 줄 사이가 어떻게 변할까'], mid: ['간섭 무늬가 생기는 까닭', '무늬 간격 $Δy$ 는 $λ$·$L$ 에 비례, $d$ 에 반비례', '하나씩 보낸 전자·광자가 만드는 무늬'] },
        svg: function (D) {
          var B = SK.level && SK.level() === 'basic';
          var bars = [[225, 22], [185, 14], [265, 14], [145, 8], [305, 8]];
          return D.svg([
            source(D, 50, 225, 'light'),
            D.line(146, 225, 372, 225, { color: BEAM, w: 4 }),
            plate(380, 225, 270, 50, 12),
            ripples(D, 386, 200, [40, 85, 130]), ripples(D, 386, 250, [40, 85, 130]),
            screenSide(668, 225, 34, 300, bars),
            D.label(95, 285, '레이저', { anchor: 'middle', weight: 500 }),
            D.label(380, 384, B ? '두 개의 틈' : '이중 슬릿', { anchor: 'middle', weight: 500 }),
            D.label(685, 400, '스크린', { anchor: 'middle', weight: 500 }),
            D.label(714, 225, '밝은 줄', { size: 18, color: 'muted' }),
            D.label(685, 54, '옆에서 본 모습', { anchor: 'middle', size: 18, color: 'muted', bg: true })   // R7-3(B1): 6장 '정면' 그림과 이어 읽기
          ], { title: '레이저 — 이중 슬릿 — 스크린', how: '밝은 막대 = 빛이 모여 밝은 줄 · 가운데 줄이 가장 밝아요' });
        },
        teacherNote: '설명 10분 + 실험 20분 + 정리 10분 흐름. 레이저를 눈에 직접 비추지 않기를 한 줄 환기해요.\n초급에서는 path-diff·dy·dy-calc·photon·matter-wave·which-way·life·misc 를 건너뜁니다(식·위상 차·물질파가 고등 단계). 대신 dy-see 장이 \'표 한 개\'로 규칙만 보여 줘요.' },

      /* 2장 */
      { id: 'wave-words', type: 'concept', title: '두 파동이 만나면?', levels: ['basic', 'mid', 'adv'],
        body: { basic: [
          '파동에서 마루와 마루가 만나면 더 커지고(밝아져요), 마루와 골이 만나면 지워져요(어두워져요).',
          '빛도 두 갈래가 스크린에서 만나면 이렇게 더해져요. 마루끼리 만나는 곳은 밝은 줄, 마루와 골이 만나는 곳은 어두운 줄이에요.'
        ], mid: [
          '{{파장}} $λ$ 는 마루에서 다음 마루까지 거리예요. 빨간빛은 약 650 nm, 파란빛은 약 450 nm 예요. (1 nm = 10⁻⁹ m)',
          '두 파동이 만나면 더해져요(**중첩**). 마루끼리 만나 더 커지는 것이 **보강 간섭**, 마루와 골이 만나 지워지는 것이 **상쇄 간섭**이에요.',
          '두 파동의 마루·골이 어긋난 정도를 **위상 차**라고 해요. 두 파동의 경로차가 파장 $λ$ 의 정수배(1배, 2배, 3배 …)이면 마루끼리 만나 보강돼요.'
        ] },
        svg: function (D) {
          var B = SK.level && SK.level() === 'basic';
          var x0 = 170, x1 = 770, lam = 200;
          return D.svg([
            D.label(30, 120, B ? '밝아져요' : '보강', { weight: 500, size: 24 }), D.label(30, 148, '마루 + 마루', { size: 18, color: 'muted' }),
            D.path(sine(x0, x1, 130, 34, lam, 0), { color: 'muted', w: 1.5, dash: '7 6' }),
            D.path(sine(x0, x1, 130, 68, lam, 0), { color: 'sim', w: 4 }),
            D.dim(220, 46, 420, 46, ''), D.label(320, 28, B ? '파장' : '$λ$', { anchor: 'middle', size: 22, sym: B ? null : 'λ' }),
            D.label(30, 320, B ? '어두워져요' : '상쇄', { weight: 500, size: 24 }), D.label(30, 348, '마루 + 골', { size: 18, color: 'muted' }),
            D.path(sine(x0, x1, 330, 34, lam, 0), { color: 'muted', w: 1.5 }),
            D.path(sine(x0, x1, 330, 34, lam, Math.PI), { color: 'muted', w: 1.5, dash: '7 6' }),
            D.line(x0, 330, x1, 330, { color: 'sim', w: 4 }),
            D.label(770, 214, B ? '합치면 2배 커져요' : '합친 파동: 진폭 2배', { anchor: 'end', size: 18, color: 'sim', bg: true }),
            D.label(770, 400, B ? '합치면 지워져요' : '합친 파동: 평평(지워짐)', { anchor: 'end', size: 18, color: 'sim', bg: true })
          ], { title: '두 파동이 만날 때', how: '가는 선 = 만나는 두 파동 · 굵은 선 = 더한 결과' });
        },
        life: ['소음 제거 이어폰은 소리와 반대 위상의 소리를 내어 상쇄시켜요.', '수조에서 두 물결이 겹치면 크게 출렁이는 곳과 잔잔한 곳이 생겨요.'] },

      /* 3장 */
      { id: 'path-diff', type: 'diagram', title: '경로차: 밝은 줄과 어두운 줄',
        body: [
          '좁은 두 틈을 지난 파동은 틈을 새 출발점으로 삼아 둥글게 퍼져 나가요(**회절**). 두 틈에서 스크린의 한 점까지 가는 거리의 차가 **{{경로차}}** $δ$ 예요.',
          '$δ$ 가 파장의 정수배(0배, 1배, 2배 …)면 밝은 줄(보강)이에요. $δ$ 가 반 파장의 홀수배(½배, 1½배 …)면 어두운 줄(상쇄)이에요.'
        ],
        eq: [{ tex: '$δ$ = $mλ$', caption: '밝은 줄 ($m$ = 0, 1, 2 …) · 어두운 줄은 $δ$ = ($m$ + {{frac:1|2}})$λ$' }],
        symbols: [
          { sym: '$δ$', name: '경로차', unit: 'm' },
          { sym: '$λ$', name: '파장', unit: 'm', target: LAM }
        ],
        more: { title: '더 알아보기 — 두 틈이 새 파동의 출발점', body: ['좁은 틈을 지난 파동은 틈을 새 출발점으로 삼아 둥글게 퍼져 나가요({{회절}}). 그래서 두 틈에서 나온 파동이 스크린에서 겹칠 수 있어요.'] },
        svg: function (D) {
          var sx = 190, s1 = 195, s2 = 255, scx = 560, O = 225, P = 110;
          return D.svg([
            plate(sx, 225, 300, 60, 12),
            ripples(D, sx + 6, s1, [45, 95]), ripples(D, sx + 6, s2, [45, 95]),
            rect(scx - 6, 70, 12, 310, SCR, { rx: 3 }),
            D.line(sx + 6, s1, scx - 6, O, { color: 'muted', w: 1.5, dash: '6 6' }),
            D.line(sx + 6, s2, scx - 6, O, { color: 'muted', w: 1.5, dash: '6 6' }),
            D.line(sx + 6, s1, scx - 6, P, { color: 'sim', w: 3 }),
            D.line(sx + 6, s2, scx - 6, P, { color: 'sim', w: 3 }),
            D.dots([[scx, O], [scx, P]], { r: 7, color: 'warn' }),
            vdim(D, sx - 30, s1, s2, '$d$', false, 'd'),
            /* R7-3(B1): S₁·S₂ 는 틈에서 위·아래로 26 바깥 + 배경 칩(파면 점선과 안 겹침) · 'O'(숫자 0 과 헷갈림) → '가운데 줄 m = 0' */
            D.label(sx + 14, s1 - 26, '$S_1$', { size: 22, bg: true }), D.label(sx + 14, s2 + 26, '$S_2$', { size: 22, bg: true }),
            D.label(scx + 18, P, '$P_1$  $m$ = 1', { weight: 500 }), D.label(scx + 18, P + 28, '경로차 $λ$ · 첫 밝은 줄', { size: 18, color: 'muted', sym: 'λ' }),
            D.label(scx + 18, O, '가운데 줄 $m$ = 0', { weight: 500 }), D.label(scx + 18, O + 28, '경로차 0', { size: 18, color: 'muted' }),
            D.label(400, 418, '경로차 $δ$ = 두 길의 길이 차', { anchor: 'middle', size: 20, color: 'muted', sym: 'δ' })
          ], { title: '두 틈에서 스크린의 한 점까지', how: '굵은 선 두 개 = $S_1$·$S_2$ 에서 $P_1$ 까지 가는 길 · 아래 길이 조금 더 길어요' });
        },
        life: ['비누막의 무지갯빛은 얇은 막 앞뒤에서 반사한 빛이 간섭해서 생겨요.'],
        teacherNote: '"가운데는 왜 늘 밝을까?" → 두 길의 길이가 같아 경로차가 0이기 때문이에요.' },

      /* ── R9 초급 신설: 식 없이 규칙만 (표 한 개) ── */
      { id: 'dy-see', type: 'concept', levels: ['basic'], title: '줄 사이는 무엇에 따라 달라질까?',
        body: [
          '색(파장)이나 틈 사이 거리를 바꾸면 밝은 줄 사이가 달라져요. 아래 표처럼 색이 짧을수록(파랑 쪽), 두 틈이 멀수록 줄이 촘촘해져요.',
          '직접 실험으로 바꿔 보고, 표와 같은지 확인해요.'
        ],
        eq: { basic: [{ tex: '색이 짧을수록 · 틈이 멀수록 → 줄이 촘촘해요' }], mid: [] },
        table: { head: ['바꾼 것', '밝은 줄 사이'], rows: [['색을 빨강 → 파랑 (파장이 짧아져요)', '좁아져요 (촘촘)'], ['두 틈 사이를 넓히면', '좁아져요 (촘촘)'], ['틈을 하나만 열면', '줄무늬가 사라지고 넓은 띠 하나']] },
        try: { label: '실험 ② 빨강을 파랑으로 바꿔 보기', mode: 'physics', card: 1 },
        teacherNote: '초급 전용(식 없음). 규칙 표 3줄 = 카드 ②③④. 첫 기록에는 비교 대상이 없으니 색이나 틈을 바꿔 한 번 더 하게 한다.',
        svg: function (D) {
          var k = [];
          [['빨강', 150, 40], ['파랑', 300, 24]].forEach(function (r, i) {
            k.push(D.label(40, r[1], r[0], { anchor: 'start', weight: 500 }));
            for (var j = -3; j <= 3; j++) k.push(D.bar(300 + j * r[2] * 3.4 - 6, r[1] + 20, 12, 40, { fill: i ? '#2F6DB5' : '#C0392B' }));
            k.push(D.label(560, r[1], i ? '촘촘' : '넓어요', { anchor: 'start', size: 22, color: 'muted' }));
          });
          k.push(D.label(400, 390, '밝은 줄이 나란히 — 사이가 달라져요', { anchor: 'middle', size: 22, bg: false }));
          return D.svg(k, { title: '색에 따라 달라지는 밝은 줄 사이', how: '파장이 짧은 파랑은 밝은 줄 사이가 더 좁아요(그림은 모양만)' });
        } },

      /* 4장 */
      { id: 'dy', type: 'formula', title: '무늬 간격은 무엇에 달려 있을까?',
        body: [
          '파장이 길수록, 스크린이 멀수록 넓어지고, 슬릿 간격이 넓을수록 촘촘해져요.'
        ],
        eq: [{ tex: '$Δy$ =', frac: ['$λL$', '$d$'], caption: '이웃한 밝은 줄 사이 간격 · $λ$·$L$ 에 비례, $d$ 에 반비례' }],
        condition: '각 $θ$ 가 작을 때 쓰는 간단한 식(근사식) ($d$ ≪ $L$, 무늬가 가운데 가까이)',
        try: { label: '실험 ② 빨강을 파랑으로 바꿔 간격 비교', mode: 'physics', card: 1 },
        symbols: [
          { sym: '$Δy$', name: '무늬 간격', unit: 'm (화면 mm)', target: 'stage:dy' },
          { sym: '$λ$', name: '파장', unit: 'm (화면 nm)', target: LAM },
          { sym: '$L$', name: '스크린 거리', unit: 'm', target: LL },
          { sym: '$d$', name: '슬릿 간격', unit: 'm (화면 mm)', target: DD }
        ],
        /* 식 팝업 '지금 값' — 기록 전에는 대입까지만(정답 누출 금지), 기록 뒤에 값 */
        now: function (p, v, st) {
          if (p.entry === 'quantum' || p.send === 'electron' || p.send === 'marble') {
            return '전자: $d$ ' + p.dR + '·$L$ ' + p.LR + ' 눈금(모형) · $V$ ' + p.V + ' V → $λ$ ≈ ' + f(pmOfV(p.V), 1) + ' pm';
          }
          var s = '$Δy$ = {{frac:$λL$|$d$}} 에 ' + p.lam + ' nm · ' + f(p.L, 1) + ' m · ' + f(p.d, 2) + ' mm 를 넣으면';
          if (p.slit && p.slit !== 'both') return s + ' … (지금은 슬릿이 하나라 줄무늬가 없어요)';
          return theoryLocked(st) ? s + ' … (직접 재고 기록한 뒤에 보여요)' : s + ' ' + f(dyMM(p), 1) + ' mm';
        },
        more: { title: '더 알아보기 — 경로차에서'+' $Δy$ '+'식까지 (교육과정 밖)',
          body: [
            '스크린 위 높이 $y$ 인 점에서 두 틈까지 경로차는 약 $d$ sin $θ$ 예요. 밝은 줄 조건은 $d$ sin $θ$ = $mλ$.',
            '$θ$ 가 작으면 sin $θ$ ≈ tan $θ$ = {{frac:$y$|$L$}} 이므로 $y_m$ = {{frac:$mλL$|$d$}}, 이웃한 줄 간격은 $Δy$ = {{frac:$λL$|$d$}} 예요.',
            '생각해 볼 질문 — $d$ 를 0.10 → 0.50 mm 로 바꿔도 이 근사가 잘 맞을까? (시뮬레이터 범위에서는 $θ$ 가 아주 작아 잘 맞아요.)'
          ] },
        svg: function (D) {
          var sx = 150, scx = 600, c = 225, bars = [];
          for (var k = -2; k <= 2; k++) bars.push([c + k * 62, k === 0 ? 16 : 12]);
          return D.svg([
            plate(sx, c, 300, 40, 10),
            D.line(sx + 6, c - 20, scx, c - 124, { color: 'muted', w: 1, dash: '4 6' }), D.line(sx + 6, c + 20, scx, c + 124, { color: 'muted', w: 1, dash: '4 6' }),
            D.line(sx + 6, c - 20, scx, c, { color: 'muted', w: 1, dash: '4 6' }), D.line(sx + 6, c + 20, scx, c, { color: 'muted', w: 1, dash: '4 6' }),
            screenSide(scx, c, 30, 320, bars),
            vdim(D, sx - 30, c - 20, c + 20, '$d$', false, 'd'),
            D.dim(sx, 408, scx, 408, ''), D.label((sx + scx) / 2, 386, '$L$', { anchor: 'middle', size: 22, sym: 'L' }),
            vdim(D, scx + 52, c, c + 62, '$Δy$', true, 'Δy'),
            /* R7-3(B1): 제목 한 줄 + 판 라벨은 제목 아래 24 여백(y 76), 판·스크린 옆에 */
            D.label(scx + 40, 76, '스크린', { size: 18, color: 'muted' }),
            D.label(sx + 14, 76, '이중 슬릿', { size: 18, color: 'muted' })
          ], { title: '세 길이 $d$ · $L$ · $Δy$', how: '축척 그림이 아니에요 — 실제로는 $d$ 가 $L$ 보다 훨씬 작아요' });
        },
        life: ['무늬 간격을 재면 레이저의 파장을 구할 수 있어요: $λ$ = {{frac:$Δy$·$d$|$L$}}'],
        teacherNote: '근사 조건은 한 줄만 짚고, 유도는 \'더 보기\'로 넘겨요. 계산 예는 다음 장(5장)에 있어요.' },

      /* 5장 (2차 신설: 4장 계산 예를 나눔) */
      { id: 'dy-calc', type: 'concept', title: '단위를 맞춰 넣어요',
        body: [
          '먼저 단위를 m 로 바꿔요. 650 nm = 6.5×10⁻⁷ m, 0.25 mm = 2.5×10⁻⁴ m 예요.',
          '이 값과 $L$ = 2.0 m 를 넣으면 $Δy$ = {{frac:6.5×10⁻⁷ × 2.0|2.5×10⁻⁴}} = 5.2×10⁻³ m = **5.2 mm** 예요.',
          '시뮬레이터 기본값이라, 실험 화면 오른쪽의 **확대 보기**(스크린 무늬를 크게 키워 눈금으로 간격을 재는 창)에서 직접 잰 값과 맞춰 볼 수 있어요.'
        ],
        table: { head: ['바꾼 값', '$Δy$', '실험'],
          rows: [
            ['기본 ($λ$ 650 nm · $d$ 0.25 mm · $L$ 2.0 m)', '5.2 mm', '①'],
            ['$λ$ 650 → 450 nm', '약 3.6 mm', '②'],
            ['$d$ 0.25 → 0.50 mm', '2.6 mm', '③'],
            ['$L$ 2.0 → 3.0 m', '7.8 mm', '④']
          ] },
        try: { label: '실험 ① 기본값으로 직접 재 보기', mode: 'physics', card: 0 },
        teacherNote: '실험 화면의 식 팝업은 학생이 재고 기록하기 전에는 계산 결과를 보이지 않아요(대입까지만).' },

      /* 6장 */
      { id: 'photon', type: 'formula', title: '약한 빛을 한 개씩 보내면?',
        body: [
          '아주 약한 빛은 **{{광자}}**(빛의 에너지 알갱이)로 하나씩 도착해요. 어디에 찍힐지는 미리 알 수 없어요.',
          '수천 개가 쌓이면 레이저 빛과 같은 줄무늬가 드러나요. 한 개는 입자처럼 도착하고, 쌓이면 파동의 무늬가 돼요.'
        ],
        eq: [{ tex: '$E$ = $hf$', caption: '광자 하나의 에너지 ($h$ 플랑크 상수 6.63×10⁻³⁴ J·s, $f$ 진동수)' }],
        try: { label: '실험 ② 광자 하나씩 보내 보기', mode: 'quantum', card: 1 },
        svg: function (D) {
          var out = [], xs = [40, 300, 560], ns = [10, 200, 2000], nm = ['10개', '200개', '2,000개'], rr = [5, 3, 1.6];
          xs.forEach(function (x, i) {
            out.push(rect(x, 70, 200, 290, SCR, { rx: 8 }));
            out.push(fringeDots(x, 70, 200, 290, ns[i], 7 + i * 31, rr[i]));
            out.push(D.label(x + 100, 388, nm[i], { anchor: 'middle', weight: 500 }));
          });
          out.push(D.label(400, 428, '점 하나는 어디 찍힐지 몰라도, 쌓인 모양은 늘 같아요', { anchor: 'middle', size: 18, color: 'muted' }));
          return D.svg(out, { title: '정면에서 본 스크린 — 광자를 하나씩 보낼 때', how: '왼쪽부터 쌓인 점 10개 · 200개 · 2,000개 · 가로 띠는 1장 그림(옆에서 본 모습)의 밝은 막대와 같은 무늬예요' });
        },
        life: ['어두운 곳에서 찍은 디지털 사진은 거칠다가(광자가 적음) 노출을 길게 하면 선명해져요.'],
        teacherNote: '"점이 어디 찍힐지 정하는 규칙은?" → 확률로만 말할 수 있어요. 광전 효과는 \'빛이 알갱이로 에너지를 준다는 증거\' 한 줄만.' },

      /* 7장 */
      { id: 'matter-wave', type: 'formula', title: '전자도 두 틈에서 간섭할까?',
        body: [
          '전자도 하나씩 쌓이면 줄무늬가 생겨요. 움직이는 입자도 **물질파**(입자가 가지는 파동)의 파장을 가져요. 그 파장은 **운동량** $p$(질량×속도)가 클수록 짧아요. 전압 $V$ 를 4배로 하면 파장이 ½ 이 돼요.'
        ],
        eq: [{ tex: '$λ$ =', frac: ['$h$', '$p$'], caption: '물질파 파장 · 가속한 전자는 $p$ = √(2·$m$·$e$·$V$) — $m$ 전자 질량, $e$ 기본 전하' }],
        symbols: [
          { sym: '$λ$', name: '물질파 파장', unit: 'pm', target: 'stage:lam' },
          { sym: '$V$', name: '가속 전압', unit: 'V', target: 'V' }
        ],
        condition: '화면의 줄 간격은 키운 모형 눈금이에요. 실제는 훨씬 좁아요.',
        more: { title: '더 알아보기 — 식의 기호', body: ['$h$ 플랑크 상수 6.63×10⁻³⁴ J·s · $m$ 전자 질량 9.11×10⁻³¹ kg · $e$ 기본 전하 1.60×10⁻¹⁹ C. $V$ = 1000 V 이면 $λ$ ≈ 38.8 pm (1 pm = 10⁻¹² m) 예요.'] },
        now: function (p) { return '$V$ = ' + p.V + ' V → $λ$ = {{frac:$h$|√(2·$m$·$e$·$V$)}} ≈ ' + f(pmOfV(p.V), 1) + ' pm (1 pm = 10⁻¹² m)'; },
        svg: function (D) {
          var bars = [[150, 10], [180, 10], [210, 12], [240, 12], [270, 10], [300, 10]];
          return D.svg([
            source(D, 40, 225, 'electron'),
            D.label(85, 285, '전자총', { anchor: 'middle', weight: 500 }), D.label(85, 312, '전압 $V$', { anchor: 'middle', size: 18, color: 'muted', sym: 'V' }),
            D.line(136, 225, 330, 225, { color: 'sim', w: 2, dash: '3 8' }),
            plate(340, 225, 230, 34, 10),
            screenSide(560, 225, 30, 230, bars, DOTC),
            D.label(575, 95, '스크린', { anchor: 'middle', size: 18, color: 'muted' }),
            D.label(40, 370, '$V$ 1000 V', { size: 20 }), rect(170, 358, 320, 24, 'var(--sim)', { rx: 3 }), D.label(500, 370, '$λ$ ≈ 38.8 pm', { size: 20, sym: 'λ' }),
            D.label(40, 410, '$V$ 4000 V', { size: 20 }), rect(170, 398, 160, 24, 'var(--sim)', { rx: 3 }), D.label(340, 410, '$λ$ ≈ 19.4 pm (½)', { size: 20 })
          ], { title: '전자를 쏘아도 줄무늬', how: '막대 길이 = 파장 · 전압 4배 → 파장 ½ ($V$ 1000 V 이면 $λ$ ≈ 38.8 pm)' });
        },
        life: ['전자 현미경은 파장이 아주 짧은 전자의 파동성으로 빛 현미경보다 작은 것을 봐요. (연계 [12물리03-03])'],
        teacherNote: '야구공의 물질파는 너무 짧아 관측할 수 없어요 → 일상에서 파동성이 안 보이는 이유(실험 ③ 작은 구슬과 연결).' },

      /* 8장 */
      { id: 'which-way', type: 'concept', title: '측정기를 켜면 무늬는?',
        body: [
          '어느 슬릿을 지났는지 알아내는 {{측정기}}를 켜면 줄무늬가 사라지고 넓은 띠가 돼요.',
          '사람이 지켜봐서가 아니에요. **어느 길인지 정보가 장치에 남으면** 두 길이 겹칠 수 없어요.',
          '무늬는 점이 닿을 확률의 모양이에요(확률 파동: 어디에 닿을지의 가능성이 파동처럼 퍼진 것). 두 길의 가능성이 열려 있을 때만 간섭이 생겨요.'
        ],
        try: { label: '실험 ④ 측정기를 켜고 보내 보기', mode: 'quantum', card: 3 },
        svg: function (D) {
          var x0 = 300, x1 = 770, cx = 535, P = 48, W = 180;
          function curve(cy, H, inter) {
            var d = '';
            for (var x = x0; x <= x1; x += 3) {
              var u = x - cx, env = Math.exp(-Math.pow(u / W, 2));
              var v = inter ? Math.pow(Math.cos(Math.PI * u / P), 2) * env : 0.5 * env;
              d += (x === x0 ? 'M' : 'L') + x + ' ' + (cy - H * v).toFixed(1);
            }
            return D.path(d, { color: 'sim', w: 3 });
          }
          return D.svg([
            D.label(30, 70, '측정기 끔', { weight: 500 }), plate(190, 150, 110, 34, 9),
            D.line(x0, 190, x1, 190, { color: 'muted', w: 1.5 }), curve(190, 130, true),
            D.label(30, 280, '측정기 켬', { weight: 500 }), plate(190, 360, 110, 34, 9),
            /* R7-3(B1): '기록 장치' 라벨은 상자 안(상자를 키움) — 슬릿판·상자 테두리와 안 겹침 */
            rect(204, 318, 92, 36, 'var(--color-copper-tint)', { rx: 4, stroke: 'var(--color-copper)', sw: 2 }), D.label(250, 336, '기록 장치', { anchor: 'middle', size: 18 }),
            D.line(x0, 410, x1, 410, { color: 'muted', w: 1.5 }), curve(410, 130, false),
            D.label(x1, 432, '스크린 위 위치', { anchor: 'end', size: 18, color: 'muted' }),
            D.label(x1, 52, '점이 닿을 확률', { anchor: 'end', size: 18, color: 'muted' })
          ], { title: '측정기에 따라 달라지는 무늬', how: '위 = 봉우리 여러 개(줄무늬) · 아래 = 넓은 봉우리 하나(줄무늬 없음)' });
        },
        life: ['어느 길인지 정보가 남으면 간섭이 사라지는 성질은 양자 기술의 바탕이에요. (연계 [12전자03-02])'],
        teacherNote: '시간이 부족하면 건너뛰고 실험 ④ 측정기를 켜면?에서 직접 보여 줘도 돼요.' },

      /* ── R9 고급 전용 ── */
      { id: 'derive', type: 'formula', levels: ['adv'], title: '무늬 간격 식을 직접 유도해요',
        body: [
          '두 틈에서 스크린 위 높이 $y$ 인 점까지 경로차는 $δ$ = $d$ sin $θ$ 예요. 밝은 줄 조건 $δ$ = $mλ$ 에서 $d$ sin $θ$ = $mλ$.',
          '$θ$ 가 아주 작으면 sin $θ$ ≈ tan $θ$ = {{frac:$y$|$L$}}. 그래서 $y_m$ = {{frac:$mλL$|$d$}}, 이웃한 줄 사이는 $Δy$ = {{frac:$λL$|$d$}} 예요.'
        ],
        eq: [
          { tex: '$δ$ = $d$ sin $θ$ = $mλ$', caption: '① 경로차 = 파장의 정수배' },
          { tex: '$y_m$ =', frac: ['$mλL$', '$d$'], caption: '② $y$ = $L$ tan $θ$ ≈ $L$ sin $θ$' },
          { tex: '$Δy$ =', frac: ['$λL$', '$d$'], caption: '③ $y_{m+1}$ − $y_m$' }
        ],
        symbols: [{ sym: '$λ$', name: '파장', unit: 'm', target: LAM }, { sym: '$L$', name: '스크린 거리', unit: 'm', target: LL }, { sym: '$d$', name: '슬릿 간격', unit: 'm', target: DD }],
        condition: '$d$ ≪ $L$ · 줄이 가운데 가까이($θ$ 작음)',
        try: { label: '실험 ① 로 $Δy$ 재 보기', mode: 'physics', card: 0 },
        teacherNote: '고급 전용. 줄 11개의 양 끝 거리를 재면 간격은 10칸임을 짚는다(예: 49.5 mm → 4.95 mm). 이론값과 측정값의 차이는 줄 가운데를 고르는 눈 오차.' },
      { id: 'limits', type: 'concept', levels: ['adv'], title: '식이 맞는 범위와 한계',
        body: [
          '$Δy$ = {{frac:$λL$|$d$}} 는 $d$ ≪ $L$ 이고 $y$ ≪ $L$ 일 때 쓰는 근사식이에요. $L$ = 2.0 m, $y$ = 26 mm 면 tan $θ$ 와 sin $θ$ 의 차는 약 0.01 % 미만이라 충분히 정확해요.',
          '슬릿 한 개의 폭 $a$ 는 줄 사이가 아니라 바깥쪽 줄의 **밝기 윤곽**(회절 띠)을 정해요. $d$ = 0.25 mm, $a$ = 0.05 mm 이면 5, 10, … 번째 밝은 줄이 사라져요.',
          '전자 실험의 $d$·$L$·줄 사이는 화면에 보이게 키운 **모형 눈금**이에요. 실제 값이 아니에요.'
        ],
        condition: '$d$ ≪ $L$ · 모형 눈금은 화면용',
        teacherNote: '고급 전용. ⚙ 더 많은 설정의 슬릿 폭 $a$ 를 0.05 → 0.10 mm 로 바꿔 바깥쪽 줄이 빨리 어두워지는 것을 보여 준다.' },

      /* 9장 */
      { id: 'life', type: 'life', title: '우리 둘레의 간섭과 이중성',
        body: [
          'CD·DVD 표면의 무지갯빛은 촘촘한 홈에서 나온 빛이 간섭해, 파장마다 보강되는 방향이 달라서 생겨요.',
          '비누막이나 물 위 기름막의 색도 간섭 때문이에요.',
          '전자 현미경은 파장이 짧은 전자의 파동성으로 아주 작은 구조를 봐요.'
        ],
        svg: function (D) {
          var out = [];
          [30, 290, 550].forEach(function (x) { out.push(rect(x, 60, 220, 290, 'var(--color-paper-raised)', { rx: 12, stroke: 'var(--color-line-strong)', sw: 1.5 })); });
          // CD
          out.push('<circle cx="140" cy="190" r="80" style="fill:var(--color-paper-sunk);stroke:var(--color-ink-muted);stroke-width:2"/><circle cx="140" cy="190" r="14" style="fill:var(--color-paper-raised);stroke:var(--color-ink-muted);stroke-width:2"/>');
          ['var(--color-rec-1)', 'var(--color-rec-2)', 'var(--color-rec-3)'].forEach(function (c, i) {
            var r = 36 + i * 14;
            out.push('<path d="M' + (140 + r * Math.cos(-2.4)).toFixed(1) + ' ' + (190 + r * Math.sin(-2.4)).toFixed(1) + 'A' + r + ' ' + r + ' 0 0 1 ' + (140 + r * Math.cos(-1.2)).toFixed(1) + ' ' + (190 + r * Math.sin(-1.2)).toFixed(1) + '" style="fill:none;stroke:' + c + ';stroke-width:6;stroke-linecap:round"/>');
          });
          out.push(D.label(140, 310, 'CD 무지갯빛', { anchor: 'middle', weight: 500 }));
          // 전자 현미경
          out.push(rect(370, 90, 60, 150, 'var(--color-paper-sunk)', { rx: 6, stroke: 'var(--color-ink-muted)', sw: 2 }));
          [130, 170, 210].forEach(function (y) { out.push('<ellipse cx="400" cy="' + y + '" rx="40" ry="8" style="fill:var(--sim-tint);stroke:var(--sim);stroke-width:2"/>'); });
          out.push(D.line(400, 96, 400, 254, { color: 'sim', w: 2, dash: '3 6' }));
          out.push(rect(360, 256, 80, 12, 'var(--color-ink-muted)', { rx: 2 }));
          out.push(D.label(400, 310, '전자 현미경', { anchor: 'middle', weight: 500 }));
          // 비누막
          out.push(rect(620, 90, 80, 170, 'var(--color-paper-sunk)', { rx: 10, stroke: 'var(--color-ink-muted)', sw: 2 }));
          ['var(--color-rec-3)', 'var(--sim-tint)', 'var(--color-rec-1)', 'var(--color-rec-2)'].forEach(function (c, i) { out.push(rect(624, 110 + i * 36, 72, 18, c, { rx: 3, op: 0.75 })); });
          out.push(D.label(660, 310, '비누막의 색', { anchor: 'middle', weight: 500 }));
          return D.svg(out, { title: '간섭과 이중성을 쓰는 곳', how: '왼쪽부터 CD 표면 · 전자 현미경 · 비누막' });
        },
        teacherNote: '[12물리03-03] 은 연계로만, 깊게 들어가지 않아요. 시간이 부족하면 건너뛰어요.' },

      /* 10장 — 오해 카드: 내 생각 → [해 보기] → 실행이 끝나면 '깨졌어요 ✓ + result' */
      { id: 'misc', type: 'misconception', title: '흔한 오해',
        items: [
          { id: 'two-lines', claim: '"전자는 입자니까 스크린에 슬릿 모양대로 두 줄만 생긴다."',
            why: '전자 하나는 늘 점 하나로 도착해요. 어디에 닿을지는 확률로만 말할 수 있고, 그 **확률의 모양**이 두 길의 간섭으로 정해져요. 그래서 쌓이면 여러 줄의 무늬가 돼요.', chapter: 'matter-wave',
            try: { mode: 'quantum', card: 0 },
            result: '전자도 쌓이니 두 줄이 아니라 여러 줄의 간섭 무늬가 생겼어요.' },
          { id: 'wide-d', claim: '"슬릿 간격 $d$ 를 넓히면 무늬 간격도 넓어진다."',
            why: '$Δy$ = {{frac:$λL$|$d$}} 에서 $d$ 는 분모예요. $d$ 가 두 배면 무늬 간격은 ½ 로 촘촘해져요.', chapter: 'dy',
            try: { mode: 'physics', card: 2 },
            result: '$d$ 0.25 → 0.50 mm 로 넓히니 무늬 간격이 5.2 → 2.6 mm 로 좁아졌어요.' },
          { id: 'look', claim: '"어느 슬릿을 지났는지 봐도 무늬는 그대로다."',
            why: '어느 길인지 정보가 장치에 남으면 두 길이 겹칠 수 없어 간섭이 사라져요. 사람이 봐서가 아니라 정보가 남아서예요.', chapter: 'which-way',
            try: { mode: 'quantum', card: 3, set: { det: true } },
            result: '측정기를 켜니 줄무늬가 사라지고 넓은 띠가 됐어요.' }
        ],
        teacherNote: '보조 오개념: "빛은 파동이라서 입자성은 없다"(→ 6장, 실험 ② 광자 하나씩) · "측정기를 켜면 사람이 봐서 사라진다"(→ 정보가 남아서) · "슬릿 하나만 열면 줄 수가 반"(→ 넓은 띠 하나, 빛 실험 ⑤) · "무늬 간격은 슬릿 하나의 폭이 정한다"(→ 간격은 $d$, 폭 $a$ 는 바깥 윤곽 — ⚙ 더 많은 설정의 슬릿 폭).' },

      /* 11장 — 빛 탭 / 전자 탭 (탭당 5개, 라벨 '실험 ①') */
      { id: 'check', type: 'check', levels: ['basic', 'mid', 'adv'], title: '시뮬레이터에서 확인할 질문',
        tabs: [
          { id: 'light', label: '빛으로 해 보기', mode: { key: 'entry', value: 'physics' } },
          { id: 'electron', label: '전자로 해 보기', levels: ['mid', 'adv'], mode: { key: 'entry', value: 'quantum' } }   // R9: 초급은 '다른 갈래 보기 ▸' 로 접음
        ],
        questions: [
          { tab: 'light', q: { basic: '빨간 빛이 두 틈을 지나면 스크린에 무엇이 생길까?', mid: '빛이 두 틈을 지나면 어떤 무늬가 생기고, 줄 간격은 얼마일까?' }, mode: 'physics', card: 0, cardName: { basic: '빨간 빛 보기', mid: '밝은 줄 간격 재기' }, chapter: 'dy-calc' },
          { tab: 'light', q: { basic: '빨간 빛 대신 파란 빛을 비추면 밝은 줄 사이는?', mid: '빨강을 파랑으로 바꾸면 간격은 어떻게 될까?' }, mode: 'physics', card: 1, cardName: '빨강과 파랑', chapter: 'dy' },
          { tab: 'light', q: { basic: '두 틈 사이를 더 넓히면 밝은 줄 사이는?', mid: '슬릿 간격을 두 배로 하면?' }, mode: 'physics', card: 2, cardName: { basic: '두 틈 사이 넓히기', mid: '슬릿 간격 2배' }, chapter: 'dy' },
          { tab: 'light', q: '스크린을 더 멀리 두면?', levels: ['mid', 'adv'], mode: 'physics', card: 3, cardName: '스크린을 멀리', chapter: 'dy' },
          { tab: 'light', q: { basic: '틈을 하나만 열면 줄무늬는 어떻게 될까?', mid: '슬릿을 하나만 열면 줄무늬가 반이 될까?' }, mode: 'physics', card: 4, cardName: '슬릿 하나만?', chapter: 'path-diff' },
          { tab: 'light', q: '$λ$ 550 nm, $d$ 0.20 mm, $L$ 1.8 m 일 때 $Δy$ 를 먼저 계산하고 실험 값과 비교해 보세요.', levels: ['adv'], mode: 'physics', card: 0, cardName: '밝은 줄 간격 · 계산과 비교', set: { lam: 550, d: 0.2, L: 1.8 }, predict: false, chapter: 'derive' },
          { tab: 'electron', q: { basic: '전자를 한 개씩 보내면 처음 점은? 쌓이면?', mid: '전자를 한 개씩 보내면 처음 점은? 쌓이면?' }, mode: 'quantum', card: 0, cardName: '전자 하나씩', chapter: 'matter-wave' },
          { tab: 'electron', q: '광자를 하나씩 보내도 같을까?', levels: ['mid', 'adv'], mode: 'quantum', card: 1, cardName: '광자 하나씩', chapter: 'photon' },
          { tab: 'electron', q: '아주 작은 구슬을 보내면?', levels: ['mid', 'adv'], mode: 'quantum', card: 2, cardName: '작은 구슬이면?', chapter: 'matter-wave' },
          { tab: 'electron', q: '어느 슬릿인지 알아내는 측정기를 켜면?', levels: ['mid', 'adv'], mode: 'quantum', card: 3, cardName: '측정기를 켜면?', chapter: 'which-way' },
          { tab: 'electron', q: '가속 전압 $V$ 를 4배(4000 V)로 하면 무늬 간격은?', levels: ['mid', 'adv'], mode: 'quantum', card: 0, cardName: '전자 하나씩 · 4000 V', set: { V: 4000 }, predict: false, chapter: 'matter-wave' }
        ],
        teacherNote: '초급 질문은 빛 갈래 ①②③④(전자는 "다른 갈래 보기 ▸" 로 접음). 고급은 이론값 계산 → 측정 비교 질문을 더한다.\n전자 실험 ⑤ 슬릿 하나만?은 [실험 고르기 ▾]에서 바로 고를 수 있어요(빛 ⑤ 와 같은 결론).' },

      /* 정리 — 설명 순서에서 빠지고 정리 모달(형성평가 3문항 + 교사 [정답 공개])에서만 */
      { id: 'wrap', type: 'wrap', title: '실험 뒤 정리',
        summary: [
          '무늬 간격 $Δy$ 는 $λ$·$L$ 에 비례하고 $d$ 에 반비례해요.',
          '전자·광자는 하나씩 와도 쌓이면 무늬가 돼요.',
          '어느 길인지 정보가 남으면 무늬가 사라져요.'
        ],
        quiz: [
          /* ── R9 초급 3문항 (levels:['basic']) — 중급 문항은 R8 그대로 ── */
          { kind: 'concept', levels: ['basic'], q: '빛이 두 틈을 지나면 스크린에 밝은 줄과 어두운 줄이 번갈아 생기는 까닭은?',
            choices: ['두 틈에서 온 빛이 만나 더해지거나 지워져서', '틈이 빛을 색깔별로 나눠서', '스크린이 빛을 흡수해서'], answerIdx: 0,
            why: '마루와 마루가 만나면 밝아지고 마루와 골이 만나면 지워져요.', chapter: 'wave-words', try: { mode: 'physics', card: 0 } },
          { kind: 'compare', levels: ['basic'], q: '빨간빛 대신 파란빛으로 바꾸면 밝은 줄 사이는?',
            choices: ['좁아져요', '넓어져요', '같아요'], answerIdx: 0,
            why: '파란빛은 파장이 짧아요(약 450 nm < 650 nm).', chapter: 'dy-see', try: { mode: 'physics', card: 1 } },
          { kind: 'misconception', levels: ['basic'], q: '"두 틈 사이를 넓히면 밝은 줄 사이도 넓어진다." 이 말은?',
            choices: ['아니에요, 오히려 좁아져요', '맞아요', '알 수 없어요'], answerIdx: 0,
            why: '틈이 멀어질수록 줄이 촘촘해져요.', chapter: 'dy-see', try: { mode: 'physics', card: 2 } },
          { kind: 'concept', q: '$λ$·$L$ 은 그대로 두고 슬릿 간격 $d$ 를 0.25 mm 에서 0.50 mm 로 두 배로 하면 무늬 간격 $Δy$ 는?',
            choices: ['반(½)이 된다', '두 배가 된다', '그대로다'], answerIdx: 0,
            why: '$Δy$ = {{frac:$λL$|$d$}} 에서 $d$ 가 분모라 두 배면 ½ 이에요. 5.2 → 2.6 mm.', chapter: 'dy',
            try: { mode: 'physics', card: 2 } },
          { kind: 'calc', q: '초록빛 $λ$ 500 nm, $d$ 0.20 mm, $L$ 1.6 m 일 때 무늬 간격 $Δy$ 는?',
            choices: ['2.0 mm', '4.0 mm', '6.4 mm'], answerIdx: 1,
            why: '$Δy$ = {{frac:500×10⁻⁹ × 1.6|0.20×10⁻³}} = 4.0×10⁻³ m = 4.0 mm 예요.', chapter: 'dy-calc',
            try: { mode: 'physics', card: 0, set: { lam: 500, d: 0.2, L: 1.6 } } },
          { kind: 'misconception', q: '"전자 한 개가 둘로 쪼개져 두 슬릿을 동시에 지나서 무늬가 생긴다." 이 말은?',
            choices: ['맞다', '알 수 없다', '아니다'], answerIdx: 2,
            why: '전자는 한 개로, 점 하나로 도착해요. 닿을 확률의 모양이 두 길의 간섭으로 정해지고, 점이 쌓이면 무늬가 돼요. 측정기로 어느 길인지 알면 무늬가 사라져요.', chapter: 'which-way',
            try: { mode: 'quantum', card: 0 } },
          /* 빛 갈래 문항(학생 점검 E7) — 빛으로 실험 중이면 위의 전자 오개념 대신 나온다 */
          { kind: 'misconception', mode: 'physics', q: '"레이저 빛을 더 밝게 하면 무늬 간격 $Δy$ 도 넓어진다." 맞을까?',
            choices: ['맞다. 밝을수록 넓어진다', '아니다. 밝기는 줄을 더 밝게 할 뿐 간격은 그대로다', '아니다. 밝을수록 좁아진다'], answerIdx: 1,
            why: '$Δy$ = {{frac:$λL$|$d$}} 에는 빛의 세기가 없어요. 밝기를 바꿔도 줄이 더 밝거나 어두워질 뿐 간격은 같아요.', chapter: 'dy',
            try: { mode: 'physics', card: 0 } },
          /* 전자 갈래 문항(학생 점검 E7) — 전자로 실험 중이면 위의 빛 문항 대신 나온다 */
          { kind: 'concept', mode: 'quantum', q: '전자를 하나씩 보내면 전자 한 개는 스크린에 어떻게 찍힐까?',
            choices: ['넓게 퍼진 무늬로 한 번에 찍힌다', '점 하나로 찍히고, 많이 쌓이면 간섭무늬가 된다', '늘 두 슬릿 바로 뒤 두 곳에만 찍힌다'], answerIdx: 1,
            why: '전자 하나는 점 하나로 도착해요. 어디에 찍힐지는 확률로 정해지고, 많이 모이면 밝고 어두운 줄무늬가 드러나요.', chapter: 'matter-wave',
            try: { mode: 'quantum', card: 0 } },
          { kind: 'calc', mode: 'quantum', q: '전자의 운동량 $p$ 가 두 배가 되면 물질파 파장 $λ$ = {{frac:$h$|$p$}} 는?',
            choices: ['두 배가 된다', '절반이 된다', '그대로다'], answerIdx: 1,
            why: '$λ$ = {{frac:$h$|$p$}} 에서 $p$ 가 분모라 두 배면 절반이에요. 파장이 짧아지면 무늬 간격도 좁아져요.', chapter: 'matter-wave',
            try: { mode: 'quantum', card: 0 } }
        ],
        more: [
          { levels: ['adv'], q: '(계산) $λ$ 550 nm, $d$ 0.20 mm, $L$ 1.8 m 일 때 $Δy$ 는?', answer: '약 4.95 mm', why: '$Δy$ = {{frac:550×10⁻⁹ × 1.8|0.20×10⁻³}} = 4.95×10⁻³ m.', chapter: 'derive' },
          { levels: ['adv'], q: '(측정) 밝은 줄 11개의 양 끝 거리를 쟀더니 49.5 mm 예요. 줄 사이는?', answer: '4.95 mm (간격은 10칸)', why: '칸 수는 줄 수보다 1 적어요. 49.5 ÷ 10 = 4.95 mm.', chapter: 'derive' },
          { levels: ['adv'], q: '(근사) $L$ = 2.0 m, $y$ = 26 mm 에서 tan $θ$ ≈ sin $θ$ 근사의 오차는?', answer: '약 0.01 % 미만 — 충분히 정확', why: '$θ$ ≈ 0.013 rad, 상대 오차 ≈ {{frac:$θ^2$|2}} ≈ 8×10⁻⁵.', chapter: 'limits' },
          { q: '$d$ = 0.30 mm, $λ$ 600 nm, $L$ 2.5 m 이면 $Δy$ 는? 이때도 근사 $d$ ≪ $L$ 이 잘 맞을까?', answer: '5.0 mm — $d$ 가 $L$ 보다 약 8천 배 작아 잘 맞아요.',
            why: '$Δy$ = {{frac:600×10⁻⁹ × 2.5|0.30×10⁻³}} = 5.0×10⁻³ m. 줄이 가운데 가까이 있어 $θ$ 가 아주 작아요.', chapter: 'dy' },
          { q: '전자의 가속 전압 $V$ 를 4배로 하면 물질파 파장은?', answer: '½ 배',
            why: '$p$ = √(2·$m$·$e$·$V$) 라 $V$ 4배면 $p$ 2배, $λ$ = {{frac:$h$|$p$}} 는 ½ 배예요.', chapter: 'matter-wave' }
        ] }
    ],
    links: { 'path-diff': 'path-diff', dy: 'dy', 'dy-calc': 'dy-calc', photon: 'photon', 'matter-wave': 'matter-wave', 'which-way': 'which-way', misc: 'misc' }
  });
})();
