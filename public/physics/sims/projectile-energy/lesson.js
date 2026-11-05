/* =====================================================================
   포물선 운동과 역학적 에너지 — 교과 설명 데이터 (R7 2차, 2026-10-30)
   원고: docs/교과설명/projectile-energy.md (설명 9장 · 심플 1·2·3·6·9 · 정리 = 모달 전용 wrap)
   형식: docs/SIMKIT.md §0R7-2-4 (terms · symbols[].target · now · try · items.id/try/result · quiz answerIdx)
   불러오는 순서: shared/sim.js → shared/diagram.js → shared/lesson.js → pe-physics.js → sim.js → 이 파일
   그림: SimDiagram(D) + 이 파일의 arr() — 실험 화면과 같은 색·화살표 문법
     속도 = 실선(--color-q-velocity) · 성분 = 같은 색 점선 · 가속도 g = 굵은 실선(--color-q-force) · 공·궤적 = --sim · 에너지 = --color-q-energy-k/p
   수치는 pe-physics.js(g = 9.8 m/s²)로 확인: R(20 m/s, 45°) = 40.8 m, 30°·60° = 35.3 m, h 40 m: 30° 70.2 · 45° 65.7 · 60° 51.3 m,
     h 10 m: 40° 49.8 > 45° 49.1 m, 카드 ② 합 246 J, 달 61.7 m, g = 10 · h 20 · v₀ 10 · 0° → 20.0 m
   장 상한(원고 §0): 본문 ≤ 3문장 · 식 ≤ 2 · 그림 1 · 생활 예·유도는 '더 보기'
   R7-3(2026-10-31): 그림 라벨 §0-B(sym·bg·위치) · 4·5장 condition 참고 칩 · 인라인 ÷ → {{frac:}} · 교사 메모 1~7장(§8-2) · more.teacherOpen 삭제(무시됨)
   ===================================================================== */
(function () {
  'use strict';
  var SK = window.SimKit;
  if (!SK || !SK.lesson) return;
  var PH = window.PEPhys;

  var VC = 'var(--color-q-velocity)', AC = 'var(--color-q-force)';
  var KC = 'var(--color-q-energy-k)', PC = 'var(--color-q-energy-p)';
  function r1(v) { return Math.round(v * 10) / 10; }
  function f(v, d) { return (+v).toFixed(d === undefined ? 1 : d); }
  function gOf(p) { return PH ? PH.gOf(p) : 9.8; }
  function gTxt(p) { return String(+gOf(p).toFixed(2)); }
  var RAD = Math.PI / 180;

  /** 화살표 머리(실험 화면 색) + 위치 에너지 빗금 — 그림마다 한 번 */
  function defs() {
    function mk(id, color, size) {
      return '<marker id="' + id + '" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="' + size + '" markerHeight="' + size + '" orient="auto-start-reverse" markerUnits="strokeWidth">' +
        '<path d="M0 0.8L10 5L0 9.2z" style="fill:' + color + '"/></marker>';
    }
    return '<defs>' + mk('pe-lm-v', VC, 4) + mk('pe-lm-c', VC, 5.5) + mk('pe-lm-a', AC, 3.2) +
      '<pattern id="pe-lp-hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
      '<rect width="10" height="10" style="fill:var(--color-paper-raised)"/><line x1="2" y1="0" x2="2" y2="10" style="stroke:' + PC + ';stroke-width:5"/></pattern></defs>';
  }
  /** 화살표: kind 'v' 속도(실선) · 'comp' 성분(점선) · 'a' 가속도 g(굵은 구리색). 라벨은 화살 끝에서 바깥으로 gap(기본 22 = 머리 + 10) 띄우고 바탕(bg) */
  function arr(D, x1, y1, x2, y2, o) {
    o = o || {};
    var k = o.kind || 'v', c = k === 'a' ? AC : VC;
    var w = k === 'a' ? 5 : k === 'comp' ? 2.2 : 3.2;
    var len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 1) return '';
    var s = '<line x1="' + r1(x1) + '" y1="' + r1(y1) + '" x2="' + r1(x2) + '" y2="' + r1(y2) + '" style="stroke:' + c + ';stroke-width:' + w +
      (k === 'comp' ? ';stroke-dasharray:8 6' : '') + ';stroke-linecap:round" marker-end="url(#' + (k === 'a' ? 'pe-lm-a' : k === 'comp' ? 'pe-lm-c' : 'pe-lm-v') + ')"/>';
    if (o.label) {
      var gap = o.gap || 22;
      var lx = o.lx !== undefined ? o.lx : x2 + (x2 - x1) / len * gap, ly = o.ly !== undefined ? o.ly : y2 + (y2 - y1) / len * gap;
      s += D.label(lx, ly, o.label, { bg: true, anchor: o.anchor || (x2 >= x1 ? 'start' : 'end'), color: k === 'a' ? AC : k === 'comp' ? VC : 'ink', size: o.size, sym: o.sym });
    }
    return s;
  }
  /** 같은 높이로 돌아오는 포물선 점 목록: 발사 (x0,y0), 사거리 R(px), 각도 deg */
  function para(x0, y0, R, deg, n) {
    var t = Math.tan(deg * RAD), pts = [];
    n = n || 48;
    for (var i = 0; i <= n; i++) { var x = R * i / n; pts.push([x0 + x, y0 - x * t + x * x * t / R]); }
    return pts;
  }
  /** 높이 h(m) 에서 던진 궤적(공기 저항 없음) — 땅(y0 px)·축척 sc(px/m) · 착지까지 */
  function traj(x0, y0, sc, v, deg, h, g) {
    var vx = v * Math.cos(deg * RAD), vy = v * Math.sin(deg * RAD);
    var T = (vy + Math.sqrt(vy * vy + 2 * g * h)) / g, pts = [];
    for (var i = 0; i <= 48; i++) { var t = T * i / 48; pts.push([x0 + vx * t * sc, y0 - (h + vy * t - 0.5 * g * t * t) * sc]); }
    return { pts: pts, R: vx * T };
  }
  function rect(x, y, w, h, fill, stroke, rx) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + (rx || 0) + '" style="fill:' + fill + ';stroke:' + (stroke || 'none') + ';stroke-width:2"/>';
  }

  SK.lesson({
    slug: 'projectile-energy',
    title: '던진 공은 어떻게 움직일까?',   // R7-3(팀장): 5종 같은 물음 꼴(머리줄 제목)
    standards: [
      // 코드는 docs/01 확인분만 (12물리01-02 는 쓰지 않음) — 1장에서 접힘 칩 '성취기준 3 ▸'
      { code: '12역학01-02', subj: '역학과 에너지', text: '포물선 운동의 정량적 설명 · 역학적 에너지' },
      { code: '12물리01-04', subj: '물리학', text: '일과 운동 에너지 · 역학적 에너지 보존' },
      { code: '12물리01-05', subj: '물리학', text: '연계 · 열로 바뀌어도 에너지 총량 보존 (7장)' }
    ],
    // R9: data.simple 은 장마다 levels 로 대체(초급 = goal · two-motions · energy · check, 앞에 복습 3장)
    /* 용어·기호 사전 (원고 §1) — 설명·식 팝업·해설·정리가 이 한 벌만 쓴다. where = 실험 화면 대응(누르면 강조) */
    terms: [
      { term: '처음 속력', sym: '$v_0$', unit: 'm/s', mean: '손을 떠나는 순간의 속력', where: 'v0' },
      { term: '던지는 각도', sym: '$θ$', unit: '°', mean: '수평선과 이루는 각', where: 'theta' },
      { term: '던지는 높이', sym: '$h$', unit: 'm', mean: '땅에서 손까지 높이', where: 'h' },
      { term: '중력 가속도', sym: '$g$', unit: 'm/s²', mean: '지구 9.8, 달 1.62', where: 'planet' },
      { term: '수평 속도', sym: '$v_x$', unit: 'm/s', mean: '옆으로 가는 빠르기(일정)', where: 'meter:vx' },
      { term: '수직 속도', sym: '$v_y$', unit: 'm/s', mean: '위(+)·아래(−)로 가는 빠르기', where: 'meter:vy' },
      { term: '수평 거리', sym: '$x$', unit: 'm', mean: '던진 곳에서 옆으로 간 거리', where: 'meter:x' },
      { term: '사거리', sym: '$R$', unit: 'm', mean: '땅에 닿을 때의 수평 거리', where: 'record:R' },
      { term: '비행 시간', sym: '$T$', unit: 's', mean: '던진 뒤 땅에 닿을 때까지', where: 'record:T' },
      { term: '최고 높이', sym: '$H$', unit: 'm', mean: '땅에서 잰 가장 높은 곳', where: 'record:H' },
      { term: '질량', sym: '$m$', unit: 'kg', mean: '공의 질량', where: 'm' },
      { term: '운동 에너지', sym: '$E_k$', unit: 'J', mean: '½$mv$² — 빠를수록 큼', where: 'bar:Ek' },
      { term: '위치 에너지', sym: '$E_p$', unit: 'J', mean: '$mgh$ (땅 기준) — 높을수록 큼', where: 'bar:Ep' },
      { term: '역학적 에너지', sym: '$E$', unit: 'J', mean: '$E$ = $E_k$ + $E_p$', where: 'bar:E' }
    ],
    chapters: [

      /* ── R9 중학교에서 배운 것 (복습 1~3) — 원고 docs/교과설명/projectile-energy_중학교.md · 성취기준 코드 없음 ── */
      {
        id: 'mid-school-1', type: 'review', no: 1, of: 3, title: '속력과 낙하',
        source: '중학교 과학 「힘과 운동」·「운동과 에너지」 계열 단원',
        body: [
          '속력은 "얼마나 빨리 가나"예요. **속력 = 거리 ÷ 시간** 이라서, 1초에 10 m 가면 10 m/s 예요.',
          '지구는 모든 물체를 아래로 끌어당겨요. 이 힘이 **중력**이에요. 가만히 놓은 공은 점점 빨라지며 떨어져요.',
          '공기를 무시하면 무거운 공도 가벼운 공도 같이 떨어져요.'
        ],
        terms: ['속력', '중력', '낙하', '질량'],
        bridge: '중학교에서는 떨어지는 공이 점점 빨라지는 것까지 배웠어요. 이제 옆으로도 가는 공을 \'옆으로 가는 운동\'과 \'아래로 떨어지는 운동\'으로 나눠 봐요.',
        selfcheck: { q: '높은 곳에서 가만히 놓은 쇠공과 나무공(공기는 무시)이에요. 먼저 땅에 닿는 것은?', choices: ['쇠공', '나무공', '동시에 닿아요'], answerIdx: 2, why: '무게와 관계없이 같이 떨어져요.' },
        teacherNote: ['성취기준 코드 미확인 — 단원명만 표기(학년·단원명 확인 필요 — 학생 화면에는 표시하지 않음). 점점 빨라지는 낙하를 중학교에서 정성적으로만 다루는지는 (확인 필요).'],
        svg: function (D) {
          var k = [], ys = [92, 120, 176, 260];
          k.push(D.line(56, 66, 56, 306, { color: 'muted', w: 2 }));
          ys.forEach(function (y) { k.push(D.line(48, y, 64, y, { w: 2 })); k.push(D.ball(116, y, 12)); });
          k.push(D.arrow(190, 100, 190, 290, { color: 'muted' }));
          k.push(D.label(210, 196, '점점 빨라져요', { anchor: 'start' }));
          k.push(D.label(116, 330, '0.5초마다 한 장', { anchor: 'middle', size: 20, color: 'muted' }));
          k.push(D.ball(470, 110, 26, { hollow: true })); k.push(D.ball(620, 110, 14, { hollow: true }));
          k.push(D.line(470, 150, 470, 330, { color: 'muted', w: 1.5, dash: '5 6' })); k.push(D.line(620, 134, 620, 346, { color: 'muted', w: 1.5, dash: '5 6' }));
          k.push(D.ball(470, 364, 26)); k.push(D.ball(620, 376, 14));
          k.push(D.ground(400, 392, 340));
          k.push(D.label(470, 70, '큰 공', { anchor: 'middle', size: 20 })); k.push(D.label(620, 70, '작은 공', { anchor: 'middle', size: 20 }));
          k.push(D.label(545, 236, '같이 도착', { anchor: 'middle', weight: 500 }));
          return D.svg(k, { title: '떨어지는 공', how: '왼쪽: 공 사이 간격이 넓어져요 = 점점 빨라져요 · 오른쪽: 큰 공과 작은 공이 같이 떨어져요(공기 무시)' });
        }
      },
      {
        id: 'mid-school-2', type: 'review', no: 2, of: 3, title: '높이와 에너지',
        source: '중학교 과학 「운동과 에너지」 계열 단원',
        body: [
          '높은 곳의 물체는 떨어지면서 무언가를 움직일 수 있어요. 이 능력이 **위치 에너지**예요(높을수록 커요). 움직이는 물체의 에너지는 **운동 에너지**예요(빠를수록 커요).',
          '공이 떨어지면 높이가 줄고 속력이 늘어서, 위치 에너지가 운동 에너지로 바뀌어요.',
          '공기 저항을 무시하면 둘을 더한 값(**역학적 에너지**)은 그대로예요.'
        ],
        terms: ['위치 에너지', '운동 에너지', '에너지 전환', '에너지 보존'],
        bridge: '중학교에서는 높이와 속력이 서로 바뀐다는 것까지 배웠어요. 이제 두 에너지를 더한 값이 숫자로 정말 일정한지 확인해요.',
        selfcheck: { q: '공이 떨어지는 동안 위치 에너지와 운동 에너지는 어떻게 될까요?', choices: ['둘 다 늘어요', '위치 에너지는 줄고 운동 에너지는 늘어요', '둘 다 줄어요'], answerIdx: 1, why: '높이가 줄어 위치 에너지는 줄고, 속력이 늘어 운동 에너지가 늘어요.' },
        teacherNote: ['성취기준 코드 미확인 — 단원명만 표기. 식 mgh·½mv² 은 중학교에서 정성 표현까지만이므로 이 장에서는 쓰지 않는다.'],
        svg: function (D) {
          var k = [], xs = [140, 400, 660], ys = [120, 232, 344], ep = [135, 75, 15], ek = [15, 75, 135], names = ['높은 곳', '중간', '땅 가까이'];
          var KC2 = 'var(--color-q-energy-k)', PC2 = 'var(--color-q-energy-p)';
          k.push(D.ground(40, 400, 740));
          xs.forEach(function (x, i) {
            k.push(D.ball(x, ys[i], 16));
            k.push(D.bar(x + 80, 400, 50, 0, { frame: 150 }));
            k.push(D.bar(x + 80, 400, 50, ek[i], { fill: KC2 }));
            k.push(D.bar(x + 80, 400 - ek[i], 50, ep[i], { fill: PC2 }));
            k.push(D.label(x + 40, 428, names[i], { anchor: 'middle', size: 20, bg: false }));
          });
          k.push(D.bar(300, 66, 18, 18, { fill: PC2 })); k.push(D.label(326, 57, '위치 에너지', { size: 20, bg: false }));
          k.push(D.bar(506, 66, 18, 18, { fill: KC2 })); k.push(D.label(532, 57, '운동 에너지', { size: 20, bg: false }));
          return D.svg(k, { title: '떨어지는 공의 에너지', how: '두 막대를 쌓은 높이는 점선 틀에 늘 꼭 맞아요 — 하나가 줄면 다른 하나가 그만큼 늘어요' });
        }
      },
      {
        id: 'mid-school-3', type: 'review', no: 3, of: 3, title: '두 방향이 같이 있을 때',
        source: '중학교 과학 「힘과 운동」 계열 단원 — 이 장의 \'두 방향\' 은 중학교에서 배우지 않았을 수 있어요',
        body: [
          '중학교에서는 한 방향으로 가는 운동을 주로 다뤘어요. 공을 옆으로 던지면 두 가지가 한꺼번에 일어나요.',
          '옆으로 가는 빠르기는 (공기를 무시하면) 그대로이고, 아래로 떨어지는 빠르기는 점점 늘어요.',
          '그냥 놓은 공은 "옆으로는 0, 아래로는 늘어남"일 뿐이에요.'
        ],
        terms: ['수평(옆)', '수직(위아래)'],
        bridge: '중학교에서는 떨어지는 공의 높이·속력이 에너지로 바뀌는 것까지 배웠어요. 이제 옆으로 가는 운동과 아래로 떨어지는 운동을 따로 나눠 봐요.',
        selfcheck: { q: '같은 높이에서 한 공은 옆으로 던지고 한 공은 그냥 놓았어요(공기 무시). 땅에 닿는 순서는?', choices: ['던진 공이 먼저', '놓은 공이 먼저', '동시에'], answerIdx: 2, why: '아래로 떨어지는 운동은 옆으로 던져도 같아서 동시에 닿아요.' },
        teacherNote: ['성취기준 코드 미확인. 두 운동이 따로라는 생각은 고등 내용이라 \'본 것\' 으로만 소개한다. 맞히면 [이미 알아요] 로 건너뛰게 안내.'],
        svg: function (D) {
          var k = [], N = 5, i, x, y;
          for (i = 0; i < N; i++) {
            y = 98 + 17 * i * i;   // 팀장 R9 결과(학생M·교사P): 그림 제목(y 34)과 치수 글이 겹치지 않게 줄을 아래로
            k.push(D.line(116, y, 116 + 112 * i - 14, y, { color: 'muted', w: 1.5, dash: '4 6' }));
            if (i) k.push(D.ball(116, y, 11, { hollow: true }));
            k.push(D.ball(116 + 112 * i, y, 11));
          }
          k.push(D.ground(60, 410, 700));
          k.push(D.dim(116, 76, 228, 76, '옆으로: 같은 간격', { off: -16, size: 20 }));
          k.push(D.dim(690, 98 + 17 * 9, 690, 98 + 17 * 16, '아래로: 점점 커져요', { off: 16, size: 20, anchor: 'end' }));
          k.push(D.label(140, 396, '떨어뜨린 공(빈 점)', { anchor: 'start', size: 20, color: 'muted' }));
          return D.svg(k, { title: '던진 공과 놓은 공', how: '같은 순간 두 공은 늘 같은 높이(점선) · 옆 간격은 같고 아래 간격만 커져요' });
        }
      },
      /* ── 1장 ── */
      {
        id: 'goal', type: 'goal', title: '던진 공은 어떻게 움직일까?', levels: ['basic', 'mid', 'adv'],
        question: { basic: '공을 비스듬히 던지면 날아가는 동안 속력과 에너지는 어떻게 바뀔까?', mid: '공을 비스듬히 던지면 날아가는 동안 속도와 에너지는 어떻게 바뀔까?' },
        body: { basic: [
          '손을 떠난 공에는 지구가 끌어당기는 힘(중력)만 작용해요. 공기 저항은 일단 무시해요.',
          '공이 얼마나 멀리 날아가는지는 처음 속력과 던지는 각도로 정해져요.',
          '날아가는 동안 높이와 속력이 서로 바뀌는데, 둘을 더한 에너지는 어떻게 되는지도 봐요.'
        ], mid: [
          '손을 떠난 공에는 중력만 작용해요(공기 저항은 일단 무시). 이때 공의 길이 왜 포물선인지 식으로 말해 봐요.',
          '얼마나 멀리·오래 가는지는 $v_0$, $θ$, $h$ 로 정해져요.',
          '날아가는 동안 $E_k$ 와 $E_p$ 는 서로 바뀌지만, 합 $E$ 는 어떻게 되는지도 알아봐요.'
        ] },
        goals: { basic: ['옆으로 가는 운동과 아래로 떨어지는 운동 나누어 보기', '높이와 속력(에너지)이 서로 바뀌는 것 보기'], mid: ['수평과 수직을 따로 생각하기', '최고점에서도 가속도는 $g$', '$E$ 가 일정해지는 조건'] },
        teacherNote: '1분. 질문을 읽고 손들기로 학생 예상을 받는다. 그 예상이 실험의 예측과 이어진다. 초급에서는 split-v·range·symmetry·g-air·misc 를 건너뜁니다(식·각도 분해가 중심이라 고등 단계).',
        svg: function (D) {
          var B = SK.level && SK.level() === 'basic';   // R9: 초급은 기호 대신 말
          var pts = para(100, 380, 600, Math.atan(230 * 2 / 300) / RAD);   // 최고점 (400, 150)
          var ux = 0.546, uy = -0.838;   // 발사점 접선 방향(기울기 230·2/300)
          // R7-3(A1, 원고 §0-B): v₀ 라벨은 화살 끝 왼쪽 위 14(궤적은 접선 오른쪽 아래라 이쪽이 빈 곳), '최고점'은 꼭대기 왼쪽 위
          return D.svg([defs(),
            D.line(60, 380, 740, 380, { color: 'muted', w: 2 }),
            D.curve(pts, { color: 'sim', w: 2.5, dash: '10 8' }),
            rect(220, 40, 360, 52, 'var(--sim-tint)', 'var(--sim)', 26),
            D.label(400, 66, B ? '속력과 에너지는 어떻게 바뀔까?' : '속도와 에너지는 어떻게 바뀔까?', { anchor: 'middle', size: 22, weight: 500, bg: false }),
            D.ball(100, 380, 11),
            arr(D, 100, 380, 100 + ux * 70, 380 + uy * 70, { label: B ? '처음 속력' : '$v_0$', sym: B ? null : '$v_0$', lx: 100 + ux * 70 - 14, ly: 380 + uy * 70 - 14, anchor: 'end' }),
            D.ball(400, 150, 11),
            D.label(370, 118, '최고점', { anchor: 'end' }),
            arr(D, 400, 150, 460, 150, { label: B ? '옆으로' : '$v_x$', sym: B ? null : '$v_x$', lx: 430, ly: 126, anchor: 'middle' }),
            arr(D, 400, 166, 400, 206, { kind: 'a', label: B ? '중력' : '$g$', sym: B ? null : '$g$', lx: 414, ly: 198, anchor: 'start' }),
            D.ball(700, 380, 11, { hollow: true })
          ], { how: B ? '점선 = 공이 지나가는 길 · 가는 화살표 = 빠르기 · 굵은 화살표 = 중력' : '점선 = 공이 지나가는 길 · 가는 화살표 = 속도 · 굵은 화살표 = 중력 가속도 $g$' });
        }
      },

      /* ── 2장 ── */
      {
        id: 'two-motions', type: 'concept', title: '한 번에 두 가지 운동', levels: ['basic', 'mid', 'adv'],
        body: { basic: [
          '공을 옆으로 던지면 두 가지 일이 한꺼번에 일어나요. 옆으로 가는 빠르기는 그대로이고, 아래로 떨어지는 빠르기는 점점 늘어요.',
          '두 움직임은 서로 영향을 주지 않아요. 그래서 옆으로 던져도 떨어지는 시간은 그냥 떨어뜨릴 때와 같아요.'
        ], mid: [
          '수평으로는 힘이 없어 {{수평 속도}} $v_x$ 가 일정해요(**등속도 운동**). 수직으로는 중력 때문에 가속도 $g$ 가 일정한 **등가속도 운동**이에요.',
          '두 운동은 서로 영향을 주지 않아서, 옆으로 던져도 떨어지는 시간은 그냥 떨어뜨릴 때와 같아요.'
        ] },
        eq: { basic: [{ tex: '옆으로는 같은 빠르기 · 아래로는 점점 빨라져요', caption: '공기를 무시할 때' }], mid: [
          { tex: '$x = v_x t$', caption: '수평: $v_x$ 일정' },
          { tex: '$y = h + v_{y0} t − ½ g t^2$', caption: '수직: 위를 + 로' }
        ] },
        symbols: [
          { sym: '$h$', target: 'h' },
          { sym: '$g$', target: 'planet' },
          { sym: '$x$', target: 'meter:x' }
        ],
        now: function (p, v, st) {
          var vx = p.v0 * Math.cos(p.theta * RAD), g = gOf(p);
          var s = '$v_x$ = ' + f(vx) + ' m/s, $h$ = ' + p.h + ' m, $g$ = ' + gTxt(p) + ' m/s²';
          if (st && st.finished && +p.theta === 0 && p.air === 'off' && p.h > 0) s += ' → 떨어지는 시간 √({{frac:2$h$|$g$}}) ≈ ' + f(Math.sqrt(2 * p.h / g), 2) + ' s';
          return s;
        },
        try: { label: '실험 ① 옆으로 던지기', preset: 0 },
        more: { title: '기호', body: ['$x$ 수평 거리(m) · $y$ 높이(m) · $t$ 시간(s) · $g$ {{중력 가속도}}(m/s²) · $v_{y0}$ 처음 수직 속도(m/s) · $h$ 던지는 높이(m)'] },
        life: ['책상 모서리에서 구슬을 굴려 떨어뜨릴 때와 가만히 떨어뜨릴 때, 바닥에 닿는 소리가 거의 같이 들려요.', '물대포 호스의 물줄기가 휘어지는 모양.'],
        teacherNote: '결론: "속도를 키워도 떨어지는 시간은 그대로". 실험 ① 해설 끝 [해 보기]로 $v_0$ 20 m/s 후속(비행 시간 2.02 s 그대로, 수평 거리 20.2 → 40.4 m). ⚙ 바닥·벽 그림자로 수평·수직을 따로 보게 한다.',
        svg: function (D) {
          var B = SK.level && SK.level() === 'basic';
          var k = [], i, y, x;
          k.push(defs());
          k.push(rect(20, 121, 46, 269, 'var(--sim-tint)', 'var(--color-ink-muted)'));
          k.push(D.line(20, 390, 780, 390, { color: 'ink', w: 2.5 }));
          // 같은 높이 가는 점선 (3번째·6번째 찍힘)
          [3, 6].forEach(function (j) { var yy = 110 + 5 * j * j; k.push(D.line(90, yy, 80 + 80 * j - 12, yy, { color: 'muted', w: 1.5, dash: '4 6' })); });
          k.push(D.label(330, 272, '같은 높이', { anchor: 'middle', size: 20, color: 'muted' }));   // R7-3(A1): 점선 위 18 (선에 걸치지 않게)
          for (i = 0; i <= 7; i++) {
            y = 110 + 5 * i * i; x = 80 + 80 * i;   // 0.1 s 마다: 수평 같은 간격, 수직 1:3:5:7… 로 벌어짐
            if (i > 1) k.push(D.ball(80, y, 9, { color: 'muted', hollow: true }));   // 0.1 s 째는 5 px 아래라 던진 공 첫 점과 겹쳐 생략
            k.push(D.ball(x, y, 10));
            k.push(D.dots([[x, 405]], { r: 4 }));                       // 바닥 그림자
            k.push(D.dots([[766, y]], { r: 4, color: 'muted' }));         // 벽 그림자
          }
          k.push(D.line(766, 100, 766, 380, { color: 'muted', w: 1.5, dash: '2 6' }));
          k.push(D.label(180, 90, '옆으로 던진 공'));
          k.push(D.label(96, 330, '떨어뜨린 공', { color: 'muted' }));
          k.push(arr(D, 400, 206, 400, 252, { kind: 'a', label: B ? '중력' : '$g$', sym: B ? null : '$g$', lx: 414, ly: 244, anchor: 'start' }));
          k.push(D.label(752, 140, '벽 그림자: 점점 벌어짐', { anchor: 'end', size: 20 }));
          // R7-3(A1): 눈금점(405, r 4) 아래 12 이상 · 괄호 없이 '같은 간격 → 식'
          k.push(D.label(400, 433, B ? '바닥 그림자: 같은 간격' : '바닥 그림자: 같은 간격 → $x$ = $v_x t$', { anchor: 'middle', size: 20, sym: B ? null : '$x$' }));
          return D.svg(k, { title: '0.1 s 마다 찍은 두 공', how: '찬 점 = 옆으로 던진 공 · 빈 점 = 떨어뜨린 공 — 같은 순간 높이가 같아요' });
        }
      },

      /* ── 3장 ── */
      {
        id: 'split-v', type: 'formula', title: '속도를 둘로 나누기',
        body: [
          '$v_x$ 는 내내 같고, $v_y$ 는 1초마다 $g$ 씩 줄다가 0이 된 뒤 아래로 커져요.',
          '{{최고점}}에서 $v_y$ = 0 이지만 $v_x$ 가 남고, 가속도는 그때도 아래로 $g$ 예요.'
        ],
        eq: [
          { tex: '$v_x = v_0 \\cos θ$', caption: '일정' },
          { tex: '$v_y = v_0 \\sin θ − g t$', caption: '최고점에서 $v_y$ = 0' }
        ],
        symbols: [
          { sym: '$v_0$', target: 'v0' },
          { sym: '$θ$', target: 'theta' },
          { sym: '$v_x$', target: 'meter:vx' },
          { sym: '$v_y$', target: 'meter:vy' }
        ],
        now: function (p) {
          return '$v_0$ = ' + p.v0 + ' m/s, $θ$ = ' + p.theta + '° → $v_x$ = ' + f(p.v0 * Math.cos(p.theta * RAD)) + ' m/s, 처음 $v_y$ = ' + f(p.v0 * Math.sin(p.theta * RAD)) + ' m/s';
        },
        try: { label: '실험 ⑤ 최고점 보기', preset: 4 },
        more: { title: '더 알아보기 — 성분 · 최고점 시간 · 속력', body: ['던지는 각이 $θ$ 이면 처음 속도의 수평 성분은 $v_0 \\cos θ$, 수직 성분은 $v_0 \\sin θ$ 예요.', '최고점에 닿는 시간: $v_y$ = 0 이 되는 때, $t$ = {{frac:$v_0 \\sin θ$|$g$}}.', '그 순간의 속력: $v$ = √($v_x^2$ + $v_y^2$). 같은 높이로 돌아오면 처음과 같은 속력이에요.'] },
        life: ['농구 슛에서 공이 림 위에서 가장 느리게 보이는 것은 $v_y$ = 0 이기 때문이고, 속도가 0은 아니에요.', '스마트폰 슬로모션으로 던진 공을 찍어 프레임마다 위치를 읽어 봐요(동영상 분석).'],
        teacherNote: '최고점 질문: \"속도가 0일까? 가속도가 0일까?\" 손들기 뒤 실험 ⑤(속도·가속도 화살표를 켠 채 열림). 최고점에서 $v_x$ ≈ 14.1 m/s 화살표는 남고 가속도 화살표는 아래 $g$.',
        svg: function (D) {
          var pts = para(120, 370, 560, 45);   // 45° → 최고점 (400, 230)
          var c = 100 / Math.SQRT2;            // v₀ 화살표 100 → 성분 70.7
          return D.svg([defs(),
            D.line(60, 370, 770, 370, { color: 'muted', w: 2 }),
            D.curve(pts, { color: 'sim', w: 2.5, dash: '10 8' }),
            // 발사점: v₀ 와 두 성분 (직각삼각형)
            D.line(120 + c, 370, 120 + c, 370 - c, { color: 'muted', w: 1.5, dash: '3 5' }),
            D.line(120, 370 - c, 120 + c, 370 - c, { color: 'muted', w: 1.5, dash: '3 5' }),
            arr(D, 120, 370, 120 + c, 370, { kind: 'comp', label: '$v_x$', sym: '$v_x$', lx: 120 + c / 2, ly: 396, anchor: 'middle' }),
            arr(D, 120, 370, 120, 370 - c, { kind: 'comp', label: '$v_y$', sym: '$v_y$', lx: 106, ly: 370 - c / 2, anchor: 'end' }),
            D.angle(120, 370, 44, 0, 45, '$θ$', { lr: 18, size: 20 }),
            D.ball(120, 370, 10),
            arr(D, 120, 370, 120 + c, 370 - c, { label: '$v_0$', sym: '$v_0$', lx: 120 + c - 14, ly: 370 - c - 20, anchor: 'end' }),   // R7-3(A1): 화살 왼쪽 위(궤적과 떨어지게)
            // 최고점
            D.ball(400, 230, 10),
            D.label(400, 164, '$v_y$ = 0, $v_x$ 그대로', { anchor: 'middle', sym: '$v_y$' }),
            arr(D, 400, 230, 400 + c, 230, { kind: 'comp', label: '$v_x$', sym: '$v_x$', lx: 436, ly: 208, anchor: 'middle' }),   // 화살 위 — 궤적(오른쪽 끝)과 떨어지게
            arr(D, 400, 246, 400, 292, { kind: 'a', label: '$g$', sym: '$g$', lx: 414, ly: 282, anchor: 'start' }),
            // 착지점 (같은 높이 → 처음과 같은 속력)
            D.ball(680, 370, 10),
            arr(D, 680, 370, 680 + c, 370, { kind: 'comp' }),
            arr(D, 680, 370, 680 + c, 370 + c * 0.85, {}),
            D.label(662, 424, '처음과 같은 속력 (같은 높이)', { anchor: 'end', size: 20 })
          ], { title: '처음 속도 나누기 (45°)', how: '실선 = 속도 · 점선 = 성분 $v_x$, $v_y$ · 굵은 화살표 = $g$ · 화살표 길이 = 속도 크기' });
        }
      },

      /* ── 4장 ── */
      {
        id: 'range', type: 'formula', title: '얼마나 멀리, 얼마나 오래',
        body: [
          '{{사거리}} $R$ = $v_x$ × $T$. $θ$ 가 크면 오래 날지만 옆으로 느려서 45°에서 가장 멀리 가요.'
        ],
        condition: '$h$ = 0, 공기 없음',   // R7-3(A4, 원고 §8-2): 식이 성립하는 조건은 참고 칩 한 줄(h > 0 은 5장, 공기는 7장)
        eq: [
          { tex: '$T$ =', frac: ['$2 v_0$ sin $θ$', '$g$'], caption: '비행 시간' },
          { tex: '$R$ =', frac: ['$v_0^2$ sin 2$θ$', '$g$'], caption: '사거리' }
        ],
        symbols: [
          { sym: '$v_0$', target: 'v0' },
          { sym: '$θ$', target: 'theta' },
          { sym: '$g$', target: 'planet' },
          { sym: '$R$', target: 'record:R' },
          { sym: '$T$', target: 'record:T' }
        ],
        now: function (p, v, st) {
          var s = '$v_0$ = ' + p.v0 + ' m/s, $θ$ = ' + p.theta + '°, $g$ = ' + gTxt(p) + ' m/s²';
          if (p.h > 0) return s + ' — 지금은 $h$ = ' + p.h + ' m 라 이 식이 그대로 맞지 않아요';
          if (p.air !== 'off') return s + ' — 공기 저항이 있어 식보다 짧아요';
          s += ' → $R$ = {{frac:' + p.v0 + '² × sin ' + (2 * p.theta) + '°|' + gTxt(p) + '}}';
          // 정답 누출 방지: 실행이 끝나기 전에는 R 값을 빼고 대입까지만
          if (st && st.finished) s += ' ≈ ' + f(p.v0 * p.v0 * Math.sin(2 * p.theta * RAD) / gOf(p)) + ' m';
          return s;
        },
        try: { label: '45°로 $R$ 재 보기', preset: 2, set: { theta: 45 }, predict: false },
        more: { title: '더 알아보기 — 최고 높이 · 계산 예', body: [
          '땅에서 던져 같은 높이로 돌아오면 올라가는 시간과 내려오는 시간이 같아요. 그래서 $T$ 는 최고점까지 걸리는 시간의 2배예요.',
          '최고 높이: $H$ = {{frac:($v_0 \\sin θ$)²|2$g$}} (땅에서 던질 때).',
          '예: $v_0$ = 20 m/s, $θ$ = 45°, $g$ = 9.8 m/s² → $T$ ≈ 2.89 s, $H$ ≈ 10.2 m, $R$ ≈ 40.8 m.',
          '유도: $R$ = $v_x$ × $T$ = ($v_0 \\cos θ$) × {{frac:2$v_0 \\sin θ$|$g$}} = {{frac:$v_0^2$ sin 2$θ$|$g$}} (2 sin$θ$ cos$θ$ = sin 2$θ$).'
        ] },
        life: ['물총을 쏠 때 각도를 바꿔 가며 가장 멀리 가는 각도를 찾아봐요.'],
        teacherNote: '식 암기 금지 — "$R$ 이 $θ$ 에 따라 어떻게 달라질까?"만 묻는다. 식은 $h$ = 0, 공기 없음에서만 맞는다(참고 칩). 30°·60° 대칭은 다음 장.',
        svg: function (D) {
          var S = 640 / (400 / 9.8);   // 45° 사거리 40.8 m = 640 px → 1 m ≈ 15.7 px
          var R30 = 400 * Math.sin(Math.PI / 3) / 9.8 * S;   // 35.3 m
          var k = [defs(), D.line(40, 380, 780, 380, { color: 'muted', w: 2 })];
          k.push(D.group([D.curve(para(60, 380, R30, 30), { color: 'sim', w: 2.5, dash: '10 8' })], { opacity: 0.7 }));
          k.push(D.group([D.curve(para(60, 380, R30, 60), { color: 'sim', w: 2.5, dash: '16 6 3 6' })], { opacity: 0.7 }));
          k.push(D.curve(para(60, 380, 640, 45), { color: 'sim', w: 3.5 }));
          k.push(D.ball(60, 380, 9));
          k.push(D.dots([[60 + R30, 380]], { r: 7 }));
          k.push(D.dots([[700, 380]], { r: 8 }));
          k.push(D.label(60 + R30 - 4, 404, r1(R30 / S) + ' m', { anchor: 'end', size: 20 }));
          k.push(D.label(676, 404, '$R$ = ' + r1(640 / S) + ' m', { anchor: 'start', size: 20, weight: 500, sym: '$R$' }));
          // 축척 10 m
          k.push(D.line(60, 432, 60 + 10 * S, 432, { color: 'muted', w: 2 }));
          k.push(D.line(60, 425, 60, 439, { color: 'muted', w: 2 }), D.line(60 + 10 * S, 425, 60 + 10 * S, 439, { color: 'muted', w: 2 }));
          k.push(D.label(60 + 10 * S + 12, 432, '10 m', { size: 18, color: 'muted' }));
          // 범례 (선 모양으로 구분)
          k.push(rect(536, 50, 244, 132, 'var(--color-paper-raised)', 'var(--color-line-strong)', 10));
          k.push(D.group([D.line(552, 80, 608, 80, { color: 'sim', w: 2.5, dash: '10 8' })], { opacity: 0.7 }), D.label(620, 80, '30° — 35.3 m', { size: 20, bg: false }));
          k.push(D.line(552, 116, 608, 116, { color: 'sim', w: 3.5 }), D.label(620, 116, '45° — 최대', { size: 20, weight: 500, bg: false }));
          k.push(D.group([D.line(552, 152, 608, 152, { color: 'sim', w: 2.5, dash: '16 6 3 6' })], { opacity: 0.7 }), D.label(620, 152, '60° — 35.3 m', { size: 20, bg: false }));
          return D.svg(k, { title: '같은 속력 20 m/s, 각도만 다르게', how: '선 모양으로 각도를 구분해요 · 땅에서($h$ = 0) 던질 때 · $g$ = 9.8 m/s²' });
        }
      },

      /* ── 5장 (R7-2 신설) ── */
      {
        id: 'symmetry', type: 'formula', title: '30°와 60°, 그리고 45°의 조건',
        body: [
          '합이 90°인 두 각(30°와 60°)은 sin2$θ$ 가 같아 사거리가 같아요.',
          '절벽 위($h$ > 0)에서는 이 대칭이 깨지고, 가장 멀리 가는 각도도 45°보다 작아요.'
        ],
        eq: [
          { tex: '$R(θ) = R(90° − θ)$', caption: '합이 90°인 두 각' }
        ],
        condition: '$h$ = 0 일 때만',   // R7-3(A4, 원고 §8-2)
        symbols: [
          { sym: '$θ$', target: 'theta' },
          { sym: '$h$', target: 'h' }
        ],
        now: function (p) {
          var a = +p.theta, b = 90 - a;
          return '$θ$ = ' + a + '° ↔ 짝 각도 ' + b + '°, $h$ = ' + p.h + ' m' + (p.h > 0 ? ' — 높이가 있어 두 거리가 달라요' : '');
        },
        try: { label: '실험 ③ 30° 기록 → 60°로 다시', preset: 2, set: { theta: 30 } },
        more: { title: '더 알아보기 — 절벽 위에서', body: [
          '$v_0$ = 20 m/s, $h$ = 0: 30°와 60° 모두 $R$ ≈ 35.3 m, 45°는 40.8 m.',
          '$v_0$ = 20 m/s, $h$ = 40 m: 30° → 70.2 m, 45° → 65.7 m, 60° → 51.3 m. 30°가 가장 멀리 가요.',
          '$h$ > 0 이면 내려오는 동안 더 날 수 있어서, 옆으로 빠른 낮은 각도가 유리해요.'
        ] },
        teacherNote: '핵심: 45°가 항상 최대는 아님. 목표는 "45°가 항상 최대"에서 벗어나기. $h$ = 40 m 의 최적 각도(약 30°)·$h$ = 10 m 의 최적 각도(약 40°, 49.8 m > 45° 49.1 m)는 확인 질문·흔한 오해 카드로 확인.',
        svg: function (D) {
          var k = [defs()];
          // 위: 땅에서 (h = 0), 1 m = 8 px
          var a = traj(70, 180, 8, 20, 30, 0, 9.8), b = traj(70, 180, 8, 20, 60, 0, 9.8);
          k.push(D.line(40, 180, 470, 180, { color: 'muted', w: 2 }));
          k.push(D.curve(a.pts, { color: 'sim', w: 2.5, dash: '10 8' }));
          k.push(D.curve(b.pts, { color: 'sim', w: 2.5, dash: '16 6 3 6' }));
          k.push(D.ball(70, 180, 8));
          k.push(D.dots([[70 + a.R * 8, 180]], { r: 7 }));
          k.push(D.label(70 + a.R * 8, 206, '같은 거리 35.3 m', { anchor: 'middle', size: 20 }));   // R7-3(A1): 지면선 아래 26 — 궤적·선에 걸치지 않게
          k.push(D.label(500, 70, '땅에서 ($h$ = 0)', { size: 22, weight: 500, sym: '$h$' }));
          k.push(D.label(500, 108, '30°와 60° → 같은 곳', { size: 20 }));
          // 아래: 절벽 위 (h = 40 m), 1 m = 3.4 px
          var sc = 3.4, G = 432, x0 = 100, c = traj(x0, G, sc, 20, 30, 40, 9.8), e = traj(x0, G, sc, 20, 60, 40, 9.8);
          k.push(rect(40, G - 40 * sc, x0 - 40, 40 * sc, 'var(--sim-tint)', 'var(--color-ink-muted)'));
          k.push(D.line(40, G, 470, G, { color: 'muted', w: 2 }));
          k.push(D.curve(c.pts, { color: 'sim', w: 2.5, dash: '10 8' }));
          k.push(D.curve(e.pts, { color: 'sim', w: 2.5, dash: '16 6 3 6' }));
          k.push(D.ball(x0, G - 40 * sc, 8));
          k.push(D.dots([[x0 + c.R * sc, G], [x0 + e.R * sc, G]], { r: 6 }));
          k.push(D.label(x0 + c.R * sc + 10, G - 18, '30° ' + r1(c.R) + ' m', { size: 20, weight: 500 }));
          // R7-3(A1, §0-B): '60° 51.3 m' 는 60° 궤적 왼쪽으로 12 이상 띄우고 착지점까지 지시선
          var e60 = x0 + e.R * sc;
          k.push(D.line(e60 - 16, G - 12, e60 - 4, G - 3, { color: 'muted', w: 1.5 }));
          k.push(D.label(e60 - 20, G - 20, '60° ' + r1(e.R) + ' m', { size: 20, anchor: 'end' }));
          k.push(D.label(500, 300, '절벽 위 ($h$ = 40 m)', { size: 22, weight: 500, sym: '$h$' }));
          k.push(D.label(500, 338, '$h$ 가 있으면 달라요', { size: 20, sym: '$h$' }));
          k.push(D.label(500, 372, '45°는 65.7 m', { size: 20, color: 'muted' }));
          return D.svg(k, { title: '같은 속력 20 m/s · 30°와 60°', how: '점선 = 30° · 일점쇄선 = 60° · 위와 아래는 축척이 달라요' });
        }
      },

      /* ── 6장 ── */
      {
        id: 'energy', type: 'formula', title: '에너지는 어디로 가나', levels: ['basic', 'mid', 'adv'],
        body: { basic: [
          '높은 곳에 있는 공은 **위치 에너지**가 커요(높을수록 커요). 빠르게 움직이는 공은 **운동 에너지**가 커요(빠를수록 커요).',
          '공이 날아가는 동안 위치 에너지와 운동 에너지가 서로 바뀌어요. 공기 저항을 무시하면 둘을 더한 에너지는 그대로예요.',
          '가장 높은 곳에서도 운동 에너지는 0이 아니에요. 옆으로 가는 빠르기가 남아 있기 때문이에요.'
        ], mid: [
          '실험 ②는 $v_0$ = 10 m/s 예요(실험 ①은 20 m/s).',
          '$E_k$ 는 빠를수록, $E_p$ 는 높을수록 커요.',
          '중력만 일을 하면 $E_k$ 와 $E_p$ 가 서로 바뀌고 합 $E$ 는 일정해요.',
          '최고점에서도 $E_k$ 는 0이 아니에요($v_x$ 가 남음).'
        ] },
        eq: { basic: [{ tex: '위치 에너지 + 운동 에너지 = 일정', caption: '공기 저항이 없을 때' }], mid: [
          { tex: '$E_k = ½ m v^2$ ,  $E_p = m g h$', caption: '높이 기준은 땅' },
          { tex: '$E = E_k + E_p$ = 일정', caption: '공기 저항이 없을 때' }
        ] },
        symbols: [
          { sym: '$E_k$', target: 'bar:Ek' },
          { sym: '$E_p$', target: 'bar:Ep' },
          { sym: '$E$', target: 'bar:E' },
          { sym: '$m$', target: 'm' },
          { sym: '$h$', target: 'h' }
        ],
        now: function (p) {
          var m = PH ? PH.mOf(p) : p.m, g = gOf(p), K = 0.5 * m * p.v0 * p.v0, U = m * g * p.h;
          var d = K + U >= 100 ? 0 : 1;
          return '$m$ = ' + (+m.toFixed(4)) + ' kg, $v_0$ = ' + p.v0 + ' m/s, $h$ = ' + p.h + ' m → 처음 $E_k$ = ' + f(K, d) + ' J, $E_p$ = ' + f(U, d) + ' J, $E$ = ' + f(K + U, d) + ' J';
        },
        try: { label: '실험 ② 에너지 막대 보기', preset: 1 },
        more: { title: '더 알아보기 — 실험 ② 값으로 계산', body: [
          '{{운동 에너지}} $E_k$ = ½$mv$², {{위치 에너지}} $E_p$ = $mgh$. 최고점에서 $E_p$ 가 가장 크고 $E_k$ 는 가장 작아요.',
          '$m$ = 1 kg, $v_0$ = 10 m/s, $θ$ = 30°, $h$ = 20 m, $g$ = 9.8 m/s² → 처음 $E_k$ = 50 J, $E_p$ = 196 J, $E$ = 246 J.',
          '최고점(약 21.3 m)에서 $E_k$ ≈ 37.5 J, $E_p$ ≈ 208.5 J, 합 246 J. 착지 직전 $E_k$ = 246 J(속력 약 22.2 m/s).',
          '질량을 3 kg 으로(⚙ $m$) 바꾸면 궤적은 같고 에너지만 3배(738 J).'
        ] },
        life: ['롤러코스터가 첫 언덕을 지난 뒤 속력이 바뀌는 모습(마찰이 작을 때).'],
        teacherNote: '$E$ 일정 → 질량을 3배로 하면 궤적은 같고 에너지만 3배(더 보기 · 흔한 오해 1). 실험 화면 에너지 막대의 값은 막대 제목 옆 $m$ 기준(기본 1.0 kg). 막대 이름 = 운동 에너지 $E_k$ / 위치 에너지 $E_p$ / 역학적 에너지 $E$.',
        svg: function (D) {
          var B = SK.level && SK.level() === 'basic';
          var top = 140, base = 380, S = (base - top) / 246;
          var cols = [
            { x: 170, K: 50, U: 196, name: '발사 (20 m 절벽 위)' },
            { x: 400, K: 37.5, U: 208.5, name: '최고점 (약 21.3 m)' },
            { x: 630, K: 246, U: 0, name: '착지 직전' }
          ];
          var k = [defs(), D.line(80, top, 780, top, { color: 'muted', w: 2, dash: '6 6' }), D.label(780, top - 22, B ? '두 에너지를 더한 합은 같아요' : '합 $E$ = 246 J 같음', { anchor: 'end', size: 20, weight: 500, sym: B ? null : '$E$' })];
          cols.forEach(function (c) {
            var hk = c.K * S, hu = c.U * S;
            k.push(rect(c.x - 40, base - hk, 80, hk, KC, 'var(--color-ink)'));
            if (hu > 0) k.push(rect(c.x - 40, base - hk - hu, 80, hu, 'url(#pe-lp-hatch)', 'var(--color-ink)'));
            k.push(D.label(c.x + 52, base - hk / 2, B ? '운동' : '$E_k$ ' + c.K + ' J', { size: 20, sym: B ? null : '$E_k$' }));
            if (hu > 0) k.push(D.label(c.x + 52, base - hk - hu / 2, B ? '위치' : '$E_p$ ' + c.U + ' J', { size: 20, sym: B ? null : '$E_p$' }));
            k.push(D.label(c.x, 408, c.name, { anchor: 'middle', size: 20, bg: false }));
          });
          k.push(D.line(80, base, 780, base, { color: 'ink', w: 2 }));
          return D.svg(k, B ? { title: '실험 ② — 20 m 절벽에서 던진 공', how: '진한 칸 = 운동 에너지 · 빗금 칸 = 위치 에너지 · 꼭대기가 같은 점선 위 — 합이 같아요' } : { title: '실험 ② — $v_0$ 10 m/s · 30° · 20 m 절벽 · $m$ 1 kg', how: '진한 칸 = $E_k$ · 빗금 칸 = $E_p$ · 꼭대기가 같은 점선 위 — 합 $E$ 가 같아요\n처음 $E_k$ = ½·1·10² = 50 J' });
        }
      },

      /* ── 7장 ── */
      {
        id: 'g-air', type: 'concept', title: '중력이 달라지면, 공기가 있으면',
        body: [
          '$g$ 가 작을수록 멀리·오래 날아요(달에서는 약 6배).',
          '공기 저항이 있으면 $E$ 가 줄지만, 줄어든 만큼 열이 되어 **총에너지는 보존**돼요.',
          '"$E$ 일정"은 중력만 일을 할 때의 식이에요.'
        ],
        eq: [
          { tex: '$R$ ∝', frac: ['1', '$g$'], caption: '$v_0$, $θ$ 가 같을 때' },
          { tex: '$E$ + 열 = 일정', caption: '공기 저항이 있을 때' }
        ],
        symbols: [
          { sym: '$g$', name: '어디에서 던질까?', target: 'planet' },
          { sym: '$g$', name: '지구의 $g$ 값 (⚙ 설정에서 바꿔요)', target: 'gEarth' }
        ],
        now: function (p, v, st) {
          var s = '$g$ = ' + gTxt(p) + ' m/s² (' + (PH ? PH.PLANETS[p.planet].name : p.planet) + ')';
          if (st && st.finished && p.planet !== 'earth' && PH) s += ' → 지구보다 $R$ 이 약 ' + f(PH.rangeFor(p, {}) / PH.rangeFor(p, { planet: 'earth', air: 'off' })) + '배';
          return s;
        },
        try: { label: '실험 ④ 달에서 던지기', preset: 3 },
        more: { title: '더 알아보기 — 실험 ④ 값 · 공기 저항', body: [
          '달의 $g$ 는 지구의 약 1/6 이라, 같은 던지기로 약 6배 멀리 가요($R$ ∝ {{frac:1|$g$}}).',
          '$v_0$ = 10 m/s, 45° → 지구 $R$ ≈ 10.2 m, 달($g$ = 1.62 m/s²) $R$ ≈ 61.7 m 로 약 6배. 달에서 $T$ ≈ 8.7 s.',
          '줄어든 역학적 에너지 = 공기 저항이 한 일의 크기. 총에너지 = $E$ + 열 = 일정 [12물리01-05, 정성].'
        ] },
        life: ['아폴로 우주인이 달에서 골프공을 멀리 보낸 장면.', '탁구공은 지구에서 이상 궤적보다 짧게 날아가요.'],
        teacherNote: ['공기 저항과 최적 각도는 심화(필수 아님). 공기 저항(없음/쇠공/탁구공)은 ⚙ 설정 › 더 많은 설정에 있다.',
          '발문: 공기 저항이 있으면 최적 각도는 45°보다 큰가 작은가? → 공기 저항이 있으면 최적 각도는 45°보다 작다(탁구공 20 m/s: 약 35°). 35° 10.4 m, 40° 10.3 m, 45° 10.0 m, 50° 9.5 m.'],
        svg: function (D) {
          var Rm = 635, Re = Rm * 1.62 / 9.8;   // 달 61.7 m : 지구 10.2 m (g 에 반비례, 약 6배)
          var k = [defs(), D.line(40, 380, 780, 380, { color: 'muted', w: 2 })];
          k.push(D.curve(para(60, 380, Rm, 45), { color: 'sim', w: 3 }));
          k.push(D.curve(para(60, 380, Re, 45, 24), { color: 'muted', w: 3 }));
          k.push(D.ball(60, 380, 9));
          k.push(D.label(378, 196, '달 $g$ = 1.62 m/s²', { anchor: 'middle', sym: '$g$' }));
          k.push(D.label(60 + Re + 14, 344, '지구 $g$ = 9.8 m/s²', { size: 20, color: 'muted', sym: '$g$' }));
          k.push(D.dim(60 + Re, 410, 60 + Rm, 410, '약 6배', { off: 0 }));
          k.push(D.label(60 + Re, 436, '10.2 m', { anchor: 'middle', size: 18, color: 'muted' }));
          k.push(D.label(60 + Rm, 436, '61.7 m', { anchor: 'middle', size: 18 }));
          // 작은 상자: 공기가 있으면
          k.push(rect(520, 44, 260, 156, 'var(--color-paper-raised)', 'var(--color-line-strong)', 10));
          k.push(D.label(536, 70, '공기가 있으면', { size: 20, weight: 500, bg: false }));
          k.push(D.curve(para(545, 150, 220, 45, 24), { color: 'muted', w: 2, dash: '6 6' }));        // 공기 없음
          k.push(D.path('M545 150 C590 95, 640 100, 672 150', { color: 'sim', w: 2.5 }));          // 공기 있음: 더 낮고 짧게
          k.push(D.label(650, 182, '$E$ 일부 → 열', { anchor: 'middle', size: 18, bg: false }));
          return D.svg(k, { title: '같은 공, $v_0$ 10 m/s · 45° (공기 없음)', how: '큰 그림: 진한 선 = 달, 회갈색 = 지구\n오른쪽 상자: 점선 = 공기 없음, 실선 = 공기 있음' });
        }
      },

      /* ── R9 고급 전용 ── */
      {
        id: 'derive-range', type: 'formula', levels: ['adv'], title: '사거리 식, 직접 유도해 봐요',
        body: [
          '$h$ = 0 에서 던져 같은 높이로 돌아올 때, 위아래 속도 $v_y$ 가 처음 값에서 반대로 바뀌는 데 걸리는 시간이 $T$ 예요. 그동안 옆으로 $v_x$ 로 가니 $R$ = $v_x T$.',
          '속도를 나누고(①) → $T$ 를 구하고(②) → 곱해서(③) 정리하면 한 줄이 나와요. 마지막에 2 sin$θ$ cos$θ$ = sin 2$θ$ 를 써요.'
        ],
        eq: [
          { tex: '$v_x$ = $v_0 \\cos θ$ ,  $v_y$ = $v_0 \\sin θ$', caption: '① 속도 나누기' },
          { tex: '$T$ =', frac: ['$2 v_0$ sin $θ$', '$g$'], caption: '② $y$ = 0 이 되는 시간' },
          { tex: '$R$ = $v_x T$ =', frac: ['$v_0^2$ sin 2$θ$', '$g$'], caption: '③ 곱하고 정리' }
        ],
        symbols: [{ sym: '$v_0$', target: 'v0' }, { sym: '$θ$', target: 'theta' }, { sym: '$g$', target: 'planet' }, { sym: '$R$', target: 'record:R' }, { sym: '$T$', target: 'record:T' }],
        condition: '$h$ = 0, 공기 없음',
        try: { label: '45°로 $R$ 재 보기', preset: 2, set: { theta: 45 }, predict: false },
        teacherNote: '고급 전용. 2 sin θ cos θ = sin 2θ 를 학생이 직접 쓰게 한다. 식이 맞는 조건($h$ = 0, 공기 없음)을 반드시 되묻는다 — 다음 장 \'한계\'로 이어진다.'
      },
      {
        id: 'limits', type: 'concept', levels: ['adv'], title: '이 식은 언제까지 맞을까?',
        body: [
          '$R$ = {{frac:$v_0^2$ sin 2$θ$|$g$}} 는 **공기 저항이 없고 $h$ = 0** 일 때만 맞아요.',
          '$h$ > 0 이면 착지까지 시간이 늘어서 가장 멀리 가는 각이 45°보다 작아져요. 예: $h$ = 40 m, $v_0$ = 20 m/s 에서 30° 70.2 m > 45° 65.7 m.',
          '공기 저항이 있으면 에너지가 줄어 식보다 짧아지고 최적 각도도 45° 보다 작아져요.'
        ],
        condition: '식이 성립하는 조건 — 높이 0, 공기 저항 없음',
        try: { label: '$h$ = 40 m 에서 30°와 45° 비교', preset: 5 },
        teacherNote: '고급 전용. 실험 ⑥(높이 40 m)으로 30° 70.2 m 와 45° 65.7 m 를 직접 확인시킨다. 값이 다르게 나오면 공기 저항 설정을 확인한다.'
      },

      /* ── 8장 ── 오해 → 내 생각 → [해 보기] → 결과 */
      {
        id: 'misc', type: 'misconception', title: '흔한 오해 4가지',
        items: [
          { id: 'heavy', claim: '"무거운 공이 더 빨리 떨어져요."',
            why: '공기 저항이 없으면 질량과 상관없이 같은 시간에 떨어져요. 질량은 중력과 관성에 똑같이 들어가 상쇄돼요. 깃털이 늦는 건 공기 저항 때문이에요.',
            try: { preset: 2, set: { m: 3 }, predict: false },
            result: '3 kg 도 1 kg 과 같은 길로 같은 $T$ 에 떨어져요. $E$ 만 3배(200 J → 600 J)예요.', chapter: 'energy' },
          { id: 'top-zero', claim: '"최고점에서는 속도도 힘도 0이에요."',
            why: '$v_y$ 만 0이에요. $v_x$ 는 그대로고, 중력은 늘 작용해서 가속도는 아래로 $g$ 예요.',
            try: { preset: 4 },
            result: '최고점에서 $v_y$ = 0 이지만 $v_x$ ≈ 14.1 m/s 가 남고, 가속도 화살표는 아래로 $g$ 그대로예요.', chapter: 'split-v' },
          { id: 'steep', claim: '"각도가 클수록 멀리 가요."',
            why: '45°를 넘으면 오래 날지만 옆으로 느려져서 오히려 짧아져요($h$ = 0 일 때).',
            try: { preset: 2, set: { theta: 60 }, predict: false },
            result: '60°는 35.3 m 로 30°와 같고, 45°(40.8 m)보다 짧아요.', chapter: 'range' },
          { id: 'always45', claim: '"45°로 던지면 언제나 가장 멀리 가요."',
            why: '45°가 가장 먼 것은 $h$ = 0 이고 공기 저항이 없을 때뿐이에요. 높은 곳에서 던지면 낮은 각도가 더 멀리 가요.',
            try: { preset: 2, set: { h: 40 }, predict: false },
            result: '$h$ = 40 m 에서는 30° 70.2 m > 45° 65.7 m > 60° 51.3 m 예요.', chapter: 'symmetry' }
        ]
      },

      /* ── 9장 ── */
      {
        id: 'check', type: 'check', levels: ['basic', 'mid', 'adv'], title: '시뮬레이터에서 확인할 질문',
        body: ['질문을 고르고 **해 보기** 를 누르면 그 실험이 바로 열려요. 먼저 예측하고 ▶ 실행으로 확인해요.'],
        questions: [
          { q: { basic: '절벽에서 옆으로 던진 공과 그냥 놓은 공, 누가 먼저 땅에 닿을까?', mid: '20 m 절벽에서 옆으로 던진 공과 떨어뜨린 공, 누가 먼저 땅에 닿을까?' }, levels: ['basic', 'mid', 'adv'], preset: 0, chapter: 'two-motions' },
          { q: { basic: '세게 던지면 더 멀리 갈까? 에너지 막대는 어떻게 될까?', mid: '날아가는 동안 $E_k$ + $E_p$ 의 합 $E$ 는?' }, preset: 1, set: { energy: true }, chapter: 'energy' },
          { q: '같은 속력 20 m/s 로 30°와 60°면 누가 더 멀리? (30°를 기록한 뒤 $θ$ 만 60°로)', simple: false, preset: 2, set: { theta: 30 }, chapter: 'symmetry' },
          { q: '$h$ = 10 m 에서 45°로 던진 뒤 $θ$ 만 40°로 바꾸면 어느 쪽이 멀리 갈까?', cardName: '높이 10 m · 45°→40°', simple: false, preset: 2, set: { h: 10, theta: 45 }, predict: false, chapter: 'symmetry' },
          { q: { basic: '공이 가장 높은 곳에 오면 어떻게 될까?', mid: '최고점에서 속도와 가속도는?' }, preset: 4, set: { showV: true, showA: true, topStop: true }, chapter: 'split-v' },
          { q: '$h$ = 40 m, $v_0$ = 20 m/s 에서 30°와 45° 중 어느 쪽이 멀리 갈까?', levels: ['adv'], preset: 5, chapter: 'limits' }
        ],
        teacherNote: ['초급 질문은 ①②⑤ 세 장면만(각도 비교 ③·④ 는 중급부터). 고급은 ⑥ 으로 마무리.', '발문: 각도를 바꿔도 착지 속력이 같을까? 같은 $v_0$·$h$ 면 √($v_0^2$ + 2$gh$) 로 같다.', '④ 답: $h$ = 10 m, 20 m/s → 40° 49.8 m > 45° 49.1 m. 달은 7장 [해 보기](실험 ④).']
      },

      /* ── 정리 (설명 순서에서 빠짐 — 정리 모달 전용) ── */
      {
        id: 'wrap', type: 'wrap', title: '실험 뒤 정리',
        summary: ['포물선 운동은 **"수평 등속 + 수직 등가속"** 이고, 중력만 일을 하면 $E_k + E_p$ = $E$ 는 일정해요.', '자기 점검: "나는 ___ 를 이제 설명할 수 있어요 / 아직 헷갈려요."'],
        quiz: [
          /* ── R9 초급 3문항 (levels:['basic']) — 중급 3문항은 R8 그대로 ── */
          { kind: 'concept', levels: ['basic'], q: '높은 절벽에서 공을 옆으로 던지는 것과 그냥 떨어뜨리는 것. 땅에 닿는 시간은?',
            choices: ['던진 공이 늦게 닿아요', '던진 공이 빨리 닿아요', '같아요'], answerIdx: 2,
            why: '아래로 떨어지는 운동은 옆으로 던져도 같아요. 세게 던지면 멀리 가기만 해요.', chapter: 'two-motions', try: { preset: 0 } },
          { kind: 'compare', levels: ['basic'], q: '공이 위로 올라가는 동안 속력은 어떻게 될까?',
            choices: ['점점 줄어요', '점점 늘어요', '그대로예요'], answerIdx: 0,
            why: '올라가면서 운동 에너지가 위치 에너지로 바뀌어 느려져요(공기 무시).', chapter: 'energy', try: { preset: 1 } },
          { kind: 'misconception', levels: ['basic'], q: '"공이 가장 높은 곳에 오면 완전히 멈춘다." 이 말은?',
            choices: ['맞아요', '위아래로는 멈추지만 옆으로는 계속 가요', '곧바로 아래로만 떨어져요'], answerIdx: 1,
            why: '비스듬히 던진 공은 가장 높은 곳에서 위아래 움직임만 0이고, 옆으로 가는 빠르기는 그대로예요.', chapter: 'energy', try: { preset: 4 } },
          { kind: 'concept', q: '수평으로 던진 공이 땅에 닿을 때까지 걸리는 시간 $T$ 는 무엇으로 정해질까?',
            choices: ['처음 속력 $v_0$', '던지는 높이 $h$ 와 중력 가속도 $g$', '공의 질량 $m$'], answerIdx: 1,
            why: '$T$ = √({{frac:2$h$|$g$}}) 에 $v_0$ 와 $m$ 이 없어요. 세게 던지면 $x$ 만 커져요.', chapter: 'two-motions',
            try: { preset: 0, set: { v0: 20 } } },
          { kind: 'calc', q: '$g$ = 10 m/s² 로 계산해요. $h$ = 20 m, $θ$ = 0°, $v_0$ = 10 m/s 로 던진 공은 몇 m 앞에 떨어질까?',
            choices: ['10 m', '40 m', '20 m'], answerIdx: 2,
            why: '$T$ = √({{frac:2 × 20|10}}) = 2 s, $x$ = $v_x T$ = 10 × 2 = 20 m.', chapter: 'two-motions',
            try: { preset: 0, set: { gEarth: 10, h: 20, v0: 10, theta: 0 } } },
          { kind: 'misconception', q: '"최고점에서는 공이 멈춘 순간이라 속도도 0, 가속도도 0이다." 옳은 판단은?',
            choices: ['틀렸다. $v_y$ 만 0 이고 $v_x$ 가 남아 있으며 가속도는 $g$ 다.', '맞다. 속도와 가속도가 모두 0이다.', '틀렸다. 속도는 그대로이고 가속도만 0이다.'], answerIdx: 0,
            why: '$v_y$ 만 0, $v_x$ 는 그대로, 중력이 계속 작용해 가속도는 아래로 $g$ 예요.', chapter: 'split-v',
            try: { preset: 4 } }
        ],
        more: [
          { levels: ['adv'], q: '(서술) $h$ = 40 m, $v_0$ = 20 m/s, $g$ = 9.8 m/s². 30°와 45° 중 어느 쪽이 더 멀리 가는지 계산하고, 45°가 최대가 아닌 이유를 쓰시오.',
            answer: '30° 70.2 m > 45° 65.7 m', why: '높이가 있으면 착지까지 시간이 늘어서, 옆 속도가 큰 낮은 각이 유리해요.', chapter: 'limits' },
          { q: '(공기 저항) 공기 저항이 없을 때와 있을 때 역학적 에너지 $E$ 는 어떻게 될까?',
            answer: '공기 없음: 역학적 에너지 일정 / 공기 있음: 줄어들고 줄어든 만큼 열로, 총에너지는 일정',
            why: '공기 저항이 있으면 $E$ 가 줄지만 사라진 것이 아니라 열로 바뀌어, $E$ + 열 은 일정해요.', chapter: 'g-air' },
          { q: '(최적 각도) 공기 저항이 있으면 가장 멀리 가는 각도는 45°보다 클까, 작을까?',
            answer: '작다 (탁구공 $v_0$ = 20 m/s: 약 35°)', why: '공기 저항이 날아가는 내내 속도를 줄여, 오래 나는 큰 각도가 더 손해를 봐요.', chapter: 'g-air' },
          { q: '($h$ > 0) $h$ = 40 m 에서 가장 멀리 가는 각도는 45°일까?',
            answer: '아니다, 45°보다 작다 (30° 70.2 m > 45° 65.7 m)', why: '높은 곳에서는 내려오는 동안 더 날 수 있어서 옆으로 빠른 낮은 각도가 유리해요.', chapter: 'symmetry' }
        ]
      }
    ],
    links: { energy: 'energy', range: 'range', symmetry: 'symmetry', 'split-v': 'split-v', 'two-motions': 'two-motions', 'g-air': 'g-air' }
  });
})();
