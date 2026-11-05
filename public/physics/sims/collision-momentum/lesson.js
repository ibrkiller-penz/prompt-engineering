/* =====================================================================
   일차원 충돌과 운동량 보존 — 교과 설명 데이터 (R7 1차 B3 → R7 2차 B4, UI팀2)
   원고: docs/교과설명/collision-momentum.md (기획A 2차) · 형식: docs/SIMKIT.md §0R7-2-4·§0R7-6
   2차: 설명 9장(sign-sum 신설) + 정리(wrap, 정리 모달 전용) · terms(충격량 = I) · symbols[].target · now(입력값 대입만)
        · 오해 3장 try/result · quiz 3(answerIdx) · 새 카드 없이 실험 ② + set({v2:-2} 은 ⚙ 더 많은 설정 값)
   그림은 인라인 SVG(SimDiagram, viewBox 800×450). 수레 색은 실험 화면과 같은 토큰:
     수레 A(대포·트럭) = --color-rec-1 · 수레 B(포탄·승용차) = --color-rec-2 · 운동 에너지 = --color-q-energy-k
   부호 약속: 오른쪽(→) = + · 왼쪽(←) = −
   ===================================================================== */
(function () {
  'use strict';
  var SK = window.SimKit;
  if (!SK || !SK.lesson) return;

  /* R7-3(B5) 그림 색 약속(원고 §0-B): 수레 A = 잉크 테두리 + 종이색 면 · 수레 B = 잉크 테두리 + 단원 식별색 옅은 면(구리 금지 — 힘 화살표 색)
       속도 = 청록 실선 화살표(--color-q-velocity) · 힘 = 구리 굵은 화살표(D.arrow kind 'f') · 운동 에너지 = 에너지 토큰
       운동량(·속도 변화) 막대 = + 는 청록 채움, − 는 청록 테두리 + 빗금 · 막대 옆 글자에 부호를 반드시(색·무늬만으로 구분 안 함) */
  var FA = 'var(--color-paper-raised)', FB = 'var(--sim-tint)', EK = 'var(--color-q-energy-k)', INK = 'var(--color-ink)', VEL = 'var(--color-q-velocity)';
  var CA = 'A', CB = 'B';

  function rect(x, y, w, h, fill, o) {
    o = o || {};
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + (o.rx === undefined ? 4 : o.rx) + '" style="fill:' + fill +
      (o.stroke ? ';stroke:' + o.stroke + ';stroke-width:' + (o.sw || 2) : '') + (o.dash ? ';stroke-dasharray:' + o.dash : '') + (o.op !== undefined ? ';opacity:' + o.op : '') + '"/>';
  }
  /** 수레: 왼쪽 x · 바닥(바퀴 아래) y · 폭 w · 높이 h · 누구('A'|'B' → 면 색) · 이름 */
  function cart(D, x, y, w, h, who, name) {
    var top = y - h - 12;
    return rect(x, top, w, h, who === 'B' ? FB : FA, { rx: 8, stroke: INK, sw: 2.5 }) +
      '<circle cx="' + (x + w * 0.25) + '" cy="' + (y - 6) + '" r="6" style="fill:' + INK + '"/><circle cx="' + (x + w * 0.75) + '" cy="' + (y - 6) + '" r="6" style="fill:' + INK + '"/>' +
      (name ? '<text x="' + (x + w / 2) + '" y="' + (top + h / 2) + '" text-anchor="middle" dominant-baseline="middle" style="font-size:26px;font-weight:500;fill:' + INK + '">' + name + '</text>' : '');
  }
  function track(D, x1, x2, y) { return D.line(x1, y, x2, y, { color: 'muted', w: 3 }); }
  /** 빗금 무늬(− 막대) — 장마다 id 를 달리 준다 */
  function hatchDefs(id) {
    return '<defs><pattern id="' + id + '" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
      '<rect width="9" height="9" style="fill:var(--color-paper-raised)"/><line x1="0" y1="0" x2="0" y2="9" style="stroke:' + VEL + ';stroke-width:3.5"/></pattern></defs>';
  }
  /** 운동량·속도 변화 막대 — x0 에서 len(+ 오른쪽 = 청록 채움, − 왼쪽 = 청록 테두리 + 빗금), 두께 22 */
  function bar(x0, y, len, hid) {
    var x = Math.min(x0, x0 + len), w = Math.abs(len);
    return len >= 0 ? rect(x, y - 11, w, 22, VEL, { rx: 3 }) : rect(x, y - 11, w, 22, 'url(#' + hid + ')', { rx: 3, stroke: VEL, sw: 2.5 });
  }
  /** 속도 화살표(가로, 청록 실선) — x1 → x2, 라벨은 화살 끝 바깥 12 (o.lx·o.anchor 로 옮김) */
  function vArrow(D, x1, x2, y, label, o) {
    o = o || {};
    var dir = x2 >= x1 ? 1 : -1;
    var out = '<line x1="' + x1 + '" y1="' + y + '" x2="' + (x2 - dir * 12) + '" y2="' + y + '" style="stroke:' + VEL + ';stroke-width:3;stroke-linecap:round"/>' +
      '<path d="M' + x2 + ' ' + y + 'L' + (x2 - dir * 16) + ' ' + (y - 8) + 'L' + (x2 - dir * 16) + ' ' + (y + 8) + 'z" style="fill:' + VEL + '"/>';
    if (label) out += D.label(o.lx !== undefined ? o.lx : x2 + dir * 12, y, label, { anchor: o.anchor || (dir > 0 ? 'start' : 'end'), size: o.size || 20, weight: 500, bg: true, sym: o.sym });
    return out;
  }
  /** 범례 한 줄(막대 무늬) */
  function legend(D, x, y, hid) {
    return rect(x, y - 9, 30, 18, VEL, { rx: 2 }) + D.label(x + 38, y, '채움 = +', { size: 18, bg: false }) +
      rect(x + 130, y - 9, 30, 18, 'url(#' + hid + ')', { rx: 2, stroke: VEL, sw: 2 }) + D.label(x + 168, y, '빗금 = −', { size: 18, bg: false });
  }

  function f(x, n) { return SK.fmt ? SK.fmt(x, n) : Number(x).toFixed(n); }
  /** 부호 붙인 수: +2 · −2 · 0 */
  function sg(x) { var r = Math.round(x * 100) / 100; return (r > 0 ? '+' : r < 0 ? '−' : '') + f(Math.abs(r), Math.abs(r) % 1 ? 1 : 0); }
  /** 'x-opposite' 해 보기: 같은 질량 +2 와 −2 가 달라붙기 (새 카드 없이 실험 ② + set — v2 는 ⚙ 더 많은 설정 값) */
  var OPPOSITE = { preset: 5, set: { m1: 1, m2: 1, v1: 2, v2: -2, kind: 'stick' }, predict: false };   // 팀장 R8 결과(D3): 카드 ⑥ 「마주 오다 부딪치기」가 생겨 preset 5 (값은 카드와 같음)

  SK.lesson({
    slug: 'collision-momentum',
    title: '부딪치면 무엇이 그대로일까?',
    standards: [{ code: '12물리01-03', subj: '물리학', text: '작용·반작용과 운동량 보존을 여러 상황에 적용 (탐구: 일차원 충돌에서 운동량 보존 확인)' }],
    // R9: data.simple 은 장마다 levels 로 대체(초급 = goal · momentum · bounce-stick · check, 앞에 복습 3장)
    /* R7-2: 용어·기호 사전 — 설명·식 팝업·결과 해설·정리 문항이 같은 말·같은 기호를 쓴다 (where = 실험 화면에서 강조할 곳) */
    terms: [
      { term: '운동량', sym: '$p$', unit: 'kg·m/s', mean: '질량 × 속도, $p$ = $mv$. 방향이 있어 오른쪽 +, 왼쪽 −', where: 'meter:p' },
      { term: '충격량', sym: '$I$', unit: 'N·s', mean: '힘 × 작용 시간, $I$ = $FΔt$ = 운동량 변화 $Δp$. 힘-시간 그래프의 넓이', where: 'stage:force' },
      { term: '운동 에너지', sym: '$E_k$', unit: 'J', mean: '½$mv^2$ — 방향이 없고 늘 0 이상', where: 'meter:k' },
      { term: '반발 계수', sym: '$e$', mean: '(심화) 튕기는 정도 — 1 이면 튕기기, 0 이면 달라붙기', where: 'e' },
      { term: '튕기기', mean: '탄성 충돌 — 운동량의 합과 운동 에너지의 합이 그대로예요', where: 'kind' },
      { term: '달라붙기', mean: '완전 비탄성 충돌 — 운동량의 합은 그대로이고, 운동 에너지의 합은 줄어요', where: 'kind' },
      { term: '운동량 보존', mean: '바깥 힘이 없으면 충돌 전후 운동량의 합(부호 포함)이 같아요', where: 'meter:p' },
      { term: '작용·반작용', mean: '두 물체가 서로 주는 힘은 크기가 같고 방향이 반대', where: 'stage:force' }
    ],
    chapters: [

      /* ── R9 중학교에서 배운 것 (복습 1~3) — 원고 docs/교과설명/collision-momentum_중학교.md · 성취기준 코드 없음 ──
         운동량·충격량은 중학교에 없는 고등 새 양 — 복습 3 에서 '움직임의 양'으로만 도입한다 */
      { id: 'mid-school-1', type: 'review', no: 1, of: 3, title: '속력과 관성',
        source: '중학교 과학 「힘과 운동」·「운동과 에너지」 계열 단원',
        body: [
          '속력은 **거리 ÷ 시간** 이에요. 멈춘 물체는 계속 멈춰 있으려 하고, 움직이는 물체는 힘이 없으면 같은 속력으로 계속 가려 해요. 이 성질이 **관성**이에요.',
          '무거울수록 속도를 바꾸기 어려워요. 같은 힘으로 밀어도 무거운 상자는 조금, 가벼운 상자는 많이 움직여요.'
        ],
        terms: ['관성', '질량', '속력'],
        bridge: '중학교에서는 무거울수록 움직임을 바꾸기 어렵다는 것까지 배웠어요. 이제 \'질량과 속도를 함께\' 재는 새 양을 더해요.',
        selfcheck: { q: '마찰이 없는 얼음 위에서 굴러가는 수레에 힘을 더 주지 않으면 어떻게 될까요?', choices: ['점점 느려져요', '같은 속력으로 계속 가요', '점점 빨라져요'], answerIdx: 1, why: '힘이 없으면 움직이던 물체는 그 속력 그대로 가요(관성).' },
        teacherNote: ['성취기준 코드 미확인 — 단원명만 표기(학년·단원명 확인 필요 — 학생 화면에는 표시하지 않음). 관성을 중학교에서 어느 학년에 다루는지는 (확인 필요).'],
        svg: function (D) {
          var k = [];
          k.push(track(D, 50, 750, 190), track(D, 50, 750, 350));
          k.push(cart(D, 100, 190, 160, 70, CA, '큰 상자'));
          k.push(D.arrow(40, 150, 98, 150, { kind: 'f' }));
          k.push(vArrow(D, 270, 320, 150, '조금 움직여요', { size: 20 }));
          k.push(cart(D, 100, 350, 120, 40, CB, '작은 상자'));
          k.push(D.arrow(40, 320, 98, 320, { kind: 'f' }));
          k.push(vArrow(D, 230, 430, 320, '많이 움직여요', { size: 20 }));
          k.push(D.label(560, 90, '같은 힘, 다른 변화', { anchor: 'middle', weight: 500 }));
          return D.svg(k, { title: '얼음 위 상자 밀기', how: '굵은 화살표 = 미는 힘(길이 같음) · 가는 화살표 = 움직인 정도 — 무거울수록 조금 움직여요' });
        } },
      { id: 'mid-school-2', type: 'review', no: 2, of: 3, title: '작용과 반작용',
        source: '중학교 과학 「힘과 운동」 계열 단원',
        body: [
          '내가 벽을 밀면 벽도 나를 같은 크기로 반대 방향으로 밀어요(**작용·반작용**). 두 물체가 부딪칠 때도 서로 주는 힘은 크기가 같고 방향은 반대예요.',
          '그런데 가벼운 쪽의 속도가 더 많이 바뀌어요. 같은 힘을 받아도 가벼우면 많이 움직이니까요.'
        ],
        terms: ['작용', '반작용', '힘의 크기·방향'],
        bridge: '중학교에서는 서로 미는 두 힘이 크기가 같다는 것까지 배웠어요. 이제 부딪친 뒤 \'움직임의 양\'이 어떻게 되는지 새 양으로 재 봐요.',
        selfcheck: { q: '무거운 쪽과 가벼운 쪽이 서로 밀었어요. 속도가 더 많이 바뀌는 쪽은?', choices: ['무거운 쪽', '가벼운 쪽', '똑같이 바뀌어요'], answerIdx: 1, why: '미는 힘은 같지만, 가벼울수록 속도가 더 많이 바뀌어요.' },
        teacherNote: ['성취기준 코드 미확인. 힘의 크기를 직접 묻는 질문은 일부러 뺐다 — 중급 오해 카드(트럭·승용차)에서 학생이 직접 발견하게 한다.'],
        svg: function (D) {
          var k = [];
          k.push(D.ball(300, 190, 34, { color: 'muted' })); k.push(D.ball(500, 206, 20));
          k.push(D.label(300, 190, '어른', { anchor: 'middle', size: 22, bg: false, color: 'paper' })); k.push(D.label(500, 150, '아이', { anchor: 'middle', size: 22 }));
          k.push(D.arrow(380, 110, 340, 110, { kind: 'f' })); k.push(D.arrow(420, 110, 460, 110, { kind: 'f' }));
          k.push(D.label(400, 76, '서로 미는 힘: 같은 크기', { anchor: 'middle', weight: 500 }));
          k.push(D.line(60, 262, 740, 262, { color: 'muted', w: 1.5, dash: '5 6' }));
          k.push(D.ball(240, 340, 34, { color: 'muted' })); k.push(D.ball(640, 356, 20));
          k.push(vArrow(D, 200, 140, 340, '조금', { size: 20, lx: 130 })); k.push(vArrow(D, 680, 770, 356, '많이', { size: 20, lx: 700 }));
          k.push(D.label(400, 410, '밀고 난 뒤: 가벼운 쪽이 더 빨라요', { anchor: 'middle', size: 22 }));
          return D.svg(k, { title: '스케이트 위에서 서로 밀기', how: '굵은 화살표 = 힘(길이 같음) · 가는 화살표 = 속도 — 가벼운 아이가 더 멀리 가요' });
        } },
      { id: 'mid-school-3', type: 'review', no: 3, of: 3, title: '에너지 전환과 \'움직임의 양\'',
        source: '중학교 과학 「운동과 에너지」 계열 단원 — \'움직임의 양\'(운동량)은 고등학교에서 처음 나와요',
        body: [
          '움직이는 물체는 운동 에너지가 있어요. 부딪쳐 찌그러지거나 소리·열이 나면 일부가 다른 에너지로 바뀌어요.',
          '이제 "빠르기만이 아니라 무게도 함께 본 **움직임의 양**"을 정해요. 무거운 수레가 느리게 가는 것과 가벼운 수레가 빠르게 가는 것은 둘 다 \'움직임이 꽤 있다\'고 할 수 있어요.',
          '이 양을 **운동량**이라 불러요. 고등학교에서 식으로 써요.'
        ],
        terms: ['운동 에너지', '에너지 전환', '움직임의 양(운동량)'],
        bridge: '중학교에서는 질량·속력·에너지를 따로 배웠어요. 이제 질량과 속도를 곱한 \'운동량\'을 더해요.',
        selfcheck: { q: '같은 속력으로 달리는 승용차와 트럭을 같은 힘으로 멈추려면 더 오래 걸리는 쪽은?', choices: ['승용차', '트럭', '똑같아요'], answerIdx: 1, why: '무거울수록 움직임의 양이 커서 멈추는 데 더 오래 걸려요.' },
        teacherNote: ['성취기준 코드 미확인. 운동량 이름은 이 장에서 한 번 소개하고, 초급의 계기·해설은 \'움직임의 양(운동량)\' 으로 쓴다. 맞히면 건너뛰기 안내.'],
        svg: function (D) {
          var k = [], VB = 'var(--color-q-velocity)';
          k.push(D.label(190, 80, '무거운 수레 × 느림', { anchor: 'middle', weight: 500, size: 22 }));
          k.push(D.label(610, 80, '가벼운 수레 × 빠름', { anchor: 'middle', weight: 500, size: 22 }));
          k.push(track(D, 60, 330, 190), track(D, 470, 740, 190));
          k.push(cart(D, 100, 190, 150, 70, CA, '무거움')); k.push(vArrow(D, 260, 300, 150, '', {}));
          k.push(cart(D, 520, 190, 70, 34, CB, '')); k.push(vArrow(D, 600, 720, 150, '', {}));
          k.push(D.line(400, 100, 400, 400, { color: 'muted', w: 1.5, dash: '4 6' }));
          k.push(D.bar(160, 360, 60, 110, { fill: VB })); k.push(D.bar(580, 360, 60, 110, { fill: VB }));
          k.push(D.label(190, 385, '움직임의 양', { anchor: 'middle', size: 20, bg: false })); k.push(D.label(610, 385, '움직임의 양', { anchor: 'middle', size: 20, bg: false }));
          k.push(D.label(400, 430, '두 막대가 같은 높이 — 움직임의 양이 같아요', { anchor: 'middle', size: 20, weight: 500, bg: false }));
          return D.svg(k, { title: '무게와 빠르기를 함께 본 양', how: '화살표 길이 = 속도 · 막대 높이 = 움직임의 양 — 무거워서 느린 것과 가벼워서 빠른 것이 같을 수 있어요' });
        } },
      /* 1장 */
      { id: 'goal', type: 'goal', title: '부딪치면 무엇이 그대로일까?', levels: ['basic', 'mid', 'adv'],
        question: '부딪치기 전과 뒤에 안 변하는 것은?',
        body: { basic: [
          '같은 무게의 수레가 부딪치면 어떻게 될까요? 속도는 크게 바뀌어도 **그대로인 것**을 찾으면 충돌을 예측할 수 있어요.',
          '여기서는 수레의 속도 화살표와 "움직임의 양"을 비교해 봐요.'
        ], mid: [
          '같은 질량의 수레가 부딪치면 어떻게 될까요? 부딪치기 전과 뒤에 변하지 않는 것은 무엇일까요?',
          '속도는 크게 바뀌어도 **그대로인 것**을 찾으면 충돌을 예측할 수 있어요. 그대로인 것({{운동량}})과 그대로가 아닌 것({{운동 에너지}})을 구분하고, 에어백이 힘을 줄이는 이유도 살펴봐요.'
        ] },
        goals: { basic: ['부딪친 뒤 속도 화살표가 어떻게 바뀌는지 보기', '움직임의 양(운동량)이 그대로임을 보기'], mid: ['$p$ = $mv$ 와 부호(방향) 쓰기', '충돌 전후 운동량의 합이 같음을 확인하기', '운동 에너지는 튕기느냐에 따라 달라짐을 알기'] },
        svg: function (D) {
          var B = SK.level && SK.level() === 'basic';
          return D.svg([
            /* R7 학생점검(디자인C): 그림 글자가 본문보다 작아 보임(1180 에서 약 14px) → 26·24 */
            D.label(30, 80, '부딪치기 전', { weight: 500, size: 26 }),
            track(D, 120, 760, 160), cart(D, 180, 160, 100, 50, CA, 'A'), cart(D, 480, 160, 100, 50, CB, 'B'),
            vArrow(D, 230, 310, 82, B ? '2 m/s' : '+2 m/s', { size: 24 }), D.label(530, 82, '0 (정지)', { anchor: 'middle', size: 24 }),
            D.label(400, 235, '그대로인 것은?', { anchor: 'middle', weight: 500, size: 26, color: 'sim', bg: true }),
            D.label(30, 270, '부딪친 뒤', { weight: 500, size: 26 }),
            track(D, 120, 760, 360), cart(D, 330, 360, 100, 50, CA, 'A'), cart(D, 520, 360, 100, 50, CB, 'B'),
            D.label(380, 282, '0 (정지)', { anchor: 'middle', size: 24 }), vArrow(D, 570, 650, 282, B ? '2 m/s' : '+2 m/s', { size: 24 })
          ], { title: '마찰 없는 트랙 위 두 수레', how: B ? '청록 화살표 = 속도 · 위 = 부딪치기 전, 아래 = 부딪친 뒤 · 같은 무게 1 kg' : '청록 화살표 = 속도 · 위 = 부딪치기 전, 아래 = 부딪친 뒤 · 같은 질량 1 kg, 오른쪽이 +' });
        },
        teacherNote: '1분. 학생이 "속도가 바뀌었다"는 점을 먼저 말하게 한 뒤 "그대로인 것"으로 넘겨요. 탐구: 일차원 충돌에서 운동량 보존 확인하기.\n초급에서는 impulse·conserve·sign-sum·action-reaction·misc 를 건너뜁니다(복습 2·3 이 작용·반작용과 \'움직임의 양\'을 맡아요).' },

      /* 2장 */
      { id: 'momentum', type: 'formula', title: { basic: '움직임의 양(운동량)', mid: '운동량: 움직임의 양' }, levels: ['basic', 'mid', 'adv'],
        body: { basic: [
          '무겁고 빠를수록 멈추기 어려워요. 그 정도를 **움직임의 양**(운동량)이라고 해요. 무게와 빠르기를 곱해서 정해요.',
          '부딪치면 움직임의 양이 한 수레에서 다른 수레로 옮겨 가요. 둘을 합친 양은 그대로예요.'
        ], mid: [
          '무겁고 빠를수록 멈추기 어려워요. 그 정도가 **{{운동량}}** $p$ 이고, 질량과 속도의 곱이에요.',
          '방향은 부호로: 오른쪽 +, 왼쪽 −.'
        ] },
        eq: { basic: [{ tex: '움직임의 양 = 무게 × 빠르기', caption: '운동량이라고도 불러요' }], mid: [{ tex: '$p$ = $mv$', caption: '운동량 = 질량 × 속도 (kg·m/s)' }] },
        symbols: [
          { sym: '$p$', name: '운동량 (방향 있음)', unit: 'kg·m/s', target: 'meter:p' },
          { sym: '$m$', name: '질량 (수레 A $m_1$ · B $m_2$)', unit: 'kg', target: 'm1' },
          { sym: '$v$', name: '속도 (오른쪽 +, 왼쪽 −)', unit: 'm/s', target: 'v1' }
        ],
        now: function (p) {
          if (p.mode === 'separate') return '처음에는 대포·포탄이 둘 다 정지 → $p$ = 0';
          var p1 = p.m1 * p.v1;
          if (p.mode === 'wall') return '$p$ = $m_1v_1$ = ' + f(p.m1, 1) + ' × (' + sg(p.v1) + ') = ' + sg(p1) + ' kg·m/s';
          return '$p_1$ = ' + f(p.m1, 1) + ' × (' + sg(p.v1) + ') = ' + sg(p1) + ' · $p_2$ = ' + f(p.m2, 1) + ' × (' + sg(p.v2) + ') = ' + sg(p.m2 * p.v2) + ' kg·m/s';
        },
        svg: function (D) {
          if (SK.level && SK.level() === 'basic') {   // R9: 초급 — 부호·기호 없이 두 수레의 '움직임의 양' 막대만
            var VB = 'var(--color-q-velocity)';
            return D.svg([
              track(D, 40, 440, 160), cart(D, 70, 160, 70, 34, CA, '1 kg'), vArrow(D, 150, 250, 126, '2 m/s', { size: 20 }),
              track(D, 40, 440, 330), cart(D, 70, 330, 150, 60, CA, '3 kg'), vArrow(D, 230, 330, 286, '2 m/s', { size: 20 }),
              D.bar(520, 190, 60, 60, { fill: VB }), D.bar(520, 360, 60, 180, { fill: VB }),
              D.label(600, 160, '움직임의 양: 보통', { size: 20, bg: false }), D.label(600, 300, '움직임의 양: 3배', { size: 20, weight: 500, bg: false })
            ], { title: '속도가 같으면 무거울수록 커요', how: '막대 높이 = 움직임의 양 · 같은 속도 2 m/s 라도 3배 무거우면 3배예요' });
          }
          /* R7-3(B5): 막대 1 kg·m/s = 36 — '+6' 글자가 그림 안(2차는 viewBox 밖 35) · 막대 무늬 + 부호 글자 + 범례 */
          var ax = 470, k = 36, rows = [[120, 1, 2, '+2', CA], [230, 3, 2, '+6', CA], [340, 1, -2, '−2', CB]], out = [hatchDefs('cmH2')];
          out.push(D.line(ax, 70, ax, 380, { color: 'ink', w: 3 }));
          out.push(D.label(ax - 12, 78, '− 왼쪽', { anchor: 'end', size: 18, color: 'muted' }), D.label(ax + 12, 78, '+ 오른쪽', { size: 18, color: 'muted' }));
          rows.forEach(function (r) {
            var w = 50 + 20 * r[1];
            out.push(cart(D, 40, r[0] + 26, w, 34, r[4], r[1] + ' kg'));
            out.push(vArrow(D, r[2] > 0 ? 190 : 290, r[2] > 0 ? 190 + 50 * r[2] : 290 + 50 * r[2], r[0] - 8, ''));
            out.push(D.label(240, r[0] + 22, (r[2] > 0 ? '+' : '−') + Math.abs(r[2]) + ' m/s', { anchor: 'middle', size: 18, color: 'muted' }));
            out.push(bar(ax, r[0], r[1] * r[2] * k, 'cmH2'));
            out.push(D.label(r[2] > 0 ? ax + r[1] * r[2] * k + 12 : ax + r[1] * r[2] * k - 12, r[0], '$p$ = ' + r[3], { anchor: r[2] > 0 ? 'start' : 'end', weight: 500, sym: 'p' }));
          });
          out.push(legend(D, 470, 418, 'cmH2'));
          return D.svg(out, { title: '운동량 막대', how: '청록 화살표 = 속도 · 막대 길이 = 운동량 크기, 막대 방향과 부호 = 방향(+ 오른쪽, − 왼쪽)' });
        },
        life: ['느린 대형 트럭과 빠른 야구공은 둘 다 멈추기 어려워요.', '같은 속력이어도 달리는 트럭이 자전거보다 멈추기 어려워요.'],
        teacherNote: '부호 약속을 칠판에 한 번 적어요. 이후 충격량·합·속도 변화가 모두 같은 부호 약속을 써요.' },

      /* 3장 */
      { id: 'impulse', type: 'formula', title: '충격량과 힘',
        body: [
          '$Δt$ 는 힘이 작용한 짧은 시간, $I$ 는 충격량(= 힘 × 시간)이에요. 그래서 $I$ = $FΔt$ = $Δp$ 예요.',
          '손을 뒤로 빼며 공을 받으면 덜 아파요. 멈추는 $Δp$ 는 같고 시간 $Δt$ 가 길어서예요.',
          '$Δt$ 가 길수록 평균 힘이 작아요(에어백).'
        ],
        eq: [{ tex: '$I$ = $FΔt$ = $Δp$', caption: '{{충격량}} = 운동량 변화 (N·s) · 평균 힘 $F$ = {{frac:$Δp$|$Δt$}}' }],
        symbols: [
          { sym: '$I$', name: '충격량 (힘-시간 그래프의 넓이)', unit: 'N·s', target: 'stage:force' },
          { sym: '$Δt$', name: '힘이 작용한 시간 (범퍼)', unit: 's', target: 'tau' },
          { sym: '$F$', name: '평균 힘', unit: 'N', target: 'stage:force' }
        ],
        now: function (p) {
          if (p.mode !== 'wall') return '실험 ⑤ 에어백(벽 장면)에서 $Δt$ 를 바꿔 봐요 · 지금 범퍼 $Δt$ = ' + p.tau + ' s';
          return '멈출 때 $Δp$ = 0 − ' + f(p.m1, 1) + ' × (' + sg(p.v1) + ') → |$Δp$| = ' + f(Math.abs(p.m1 * p.v1), 1) + ' N·s · $Δt$ = ' + p.tau + ' s';
        },
        try: { label: '실험 ⑤ 딱딱한 범퍼 → 푹신한 범퍼', preset: 4, set: { tau: 0.01 } },
        more: { title: '더 알아보기 — 그래프 곡선의 꼭대기', body: ['힘이 반 사인 곡선 모양이면 꼭대기(최대 힘)는 평균 힘 × π/2 예요.'] },
        svg: function (D) {
          /* R7-3(B5): 곡선 = 반 사인(실험의 힘 펄스와 같은 모양) — 꼭대기(최대 힘) = 평균 × π/2.
             3차 베지어 M ox,360 C ox+0.3b,360−1.333h ox+0.7b,360−1.333h ox+b,360 의 꼭대기 = h.
             딱딱: 폭 40 · 꼭대기 240(314 N) · 평균 152.8(200 N) / 푹신: 폭 280 · 꼭대기 34.3(15.7 N) · 평균 21.8(10 N) — 넓이 (2/π)·꼭대기·폭 ≈ 6,112 로 같음 */
          function pulse(ox, b, hgt) {
            var c = (360 - 1.333 * hgt).toFixed(1);
            return '<path d="M' + ox + ' 360C' + (ox + 0.3 * b) + ' ' + c + ' ' + (ox + 0.7 * b) + ' ' + c + ' ' + (ox + b) + ' 360z" style="fill:var(--sim-tint);stroke:var(--sim);stroke-width:3;stroke-linejoin:round"/>';
          }
          function avg(x1, x2, hgt) { return D.line(x1, 360 - hgt, x2, 360 - hgt, { color: 'ink', w: 2, dash: '6 5' }); }
          return D.svg([
            D.label(60, 70, '딱딱한 범퍼', { weight: 500 }),
            D.axis(60, 360, 300, 270, { xl: '시간 $t$', yl: '힘 $F$' }), pulse(80, 40, 240), avg(72, 140, 152.8),
            D.label(130, 120, '최대 314 N', { size: 18 }), D.label(148, 207, '평균 200 N', { size: 18 }),
            D.label(100, 386, '$Δt$ 0.01 s', { anchor: 'middle', size: 18, color: 'muted', sym: 'Δt' }),
            D.label(440, 70, '푹신한 범퍼', { weight: 500 }),
            D.axis(440, 360, 320, 270, { xl: '시간 $t$', yl: '힘 $F$' }), pulse(450, 280, 34.3), avg(450, 730, 21.8),
            D.label(590, 296, '최대 15.7 N · 평균 10 N', { anchor: 'middle', size: 18 }), D.label(590, 386, '$Δt$ 0.2 s', { anchor: 'middle', size: 18, color: 'muted' }),
            D.label(400, 428, '색칠한 넓이가 같아요 = 충격량 $I$ 2 N·s', { anchor: 'middle', weight: 500, color: 'sim', sym: 'I' })
          ], { title: '힘-시간 그래프 (넓이 = 충격량 $I$)', how: '점선 = 평균 힘 · 1 kg 수레가 2 m/s 로 벽에서 멈출 때, 넓이가 같으면 시간이 길수록 힘이 작아요' });
        },
        more: { title: '더 알아보기 — 평균 힘과 최대 힘 (실험 ⑤)',
          body: ['1 kg 수레가 2 m/s 로 벽에서 멈추면 |$Δp$| = 2 N·s 예요. 평균 힘은 딱딱(0.01 s) 200 N, 푹신(0.2 s) 10 N 이에요.',
            '실험의 힘-시간 곡선 꼭대기는 **최대 힘**이라 314 N, 15.7 N 으로 나와요(평균의 약 1.57배 = π/2). 두 경우의 비는 똑같이 20 : 1 이에요.'] },
        life: ['에어백·안전띠·범퍼는 부딪치는 시간을 늘려 힘을 줄여요. (연계 [12물리01-02] 교통안전)', '낙법은 구르면서 시간을 늘리고, 야구 글러브는 뒤로 빼며 받아요.'],
        teacherNote: '에어백: $Δp$ 는 같게 두고 $Δt$ 를 길게 해 평균 힘을 줄여요. 벽에서 수레의 운동량이 변해도 보존이 깨진 것은 아님을 다음 장에서 짚어요(벽·지구가 반대로 같은 충격량을 받음).' },

      /* 4장 */
      { id: 'conserve', type: 'formula', title: '바깥 힘이 없으면 합은 일정',
        body: [
          '두 물체가 서로 주는 힘은 크기가 같고 방향이 반대라, A 가 잃은 $p$ 를 B 가 얻어 **합은 그대로**예요.',
          '로켓도 대포와 같은 원리예요 — 가스를 뒤로 뿜으면 로켓은 앞으로 가요(질량×속도가 서로 반대).'
        ],
        eq: [{ tex: '$m_1v_1$ + $m_2v_2$ = $m_1v_1′$ + $m_2v_2′$', caption: '충돌 전 운동량 합 = 충돌 후 운동량 합' }],
        symbols: [
          { sym: '$m_1v_1$ + $m_2v_2$', name: '운동량 합 (부호 포함)', unit: 'kg·m/s', target: 'meter:p' },
          { sym: '$v_1′$, $v_2′$', name: '충돌 후 속도', unit: 'm/s', target: 'meter:v1' }
        ],
        condition: '알짜 외력 없음, 일직선 위의 운동',
        try: { label: '실험 ④ 멈춘 대포가 포탄을 쏘면', preset: 3 },
        now: function (p) {
          if (p.mode === 'separate') return '처음 합 = 0 (둘 다 정지) — 나중 합은 실행해서 확인해요';
          if (p.mode === 'wall') return '벽 장면은 벽이 바깥에서 힘을 줘요 — 수레만의 $p$ 는 바뀌어요';
          return '전 합 = ' + f(p.m1, 1) + ' × (' + sg(p.v1) + ') + ' + f(p.m2, 1) + ' × (' + sg(p.v2) + ') = ' + sg(p.m1 * p.v1 + p.m2 * p.v2) + ' kg·m/s';
        },
        svg: function (D) {
          var k = 40, x0 = 200;
          return D.svg([
            hatchDefs('cmH4'),
            D.label(30, 80, '충돌', { weight: 500 }), legend(D, 520, 80, 'cmH4'),
            D.label(120, 120, '전', { anchor: 'end' }), bar(x0, 120, 2 * k, 'cmH4'), D.label(x0 + 2 * k + 12, 120, 'A +2', { size: 20, weight: 500 }),
            D.label(390, 120, 'B 0', { size: 20, color: 'muted' }), D.label(560, 120, '합 = +2', { weight: 500, color: 'sim' }),
            D.label(120, 175, '후', { anchor: 'end' }), D.label(x0 - 12, 175, 'A 0', { anchor: 'end', size: 20, color: 'muted' }), bar(x0, 175, 2 * k, 'cmH4'), D.label(x0 + 2 * k + 12, 175, 'B +2', { size: 20, weight: 500 }),
            D.label(560, 175, '합 = +2', { weight: 500, color: 'sim' }),
            D.line(30, 230, 770, 230, { color: 'muted', w: 1, dash: '4 6' }),
            D.label(30, 270, '분리 (대포)', { weight: 500 }),
            D.label(400, 300, '처음: 둘 다 정지 → 합 0', { anchor: 'middle', size: 18, color: 'muted' }),
            D.line(400, 320, 400, 400, { color: 'ink', w: 3 }),
            bar(400, 360, -2 * k, 'cmH4'), bar(400, 360, 2 * k, 'cmH4'),
            D.label(306, 360, '대포 −2', { anchor: 'end', weight: 500 }), D.label(494, 360, '포탄 +2', { weight: 500 }),
            D.label(620, 360, '합 = 0', { weight: 500, color: 'sim' }),
            D.label(600, 295, '로켓도 같은 원리', { anchor: 'middle', size: 18, color: 'muted' }),
            D.arrow(560, 322, 520, 322, { color: 'muted', w: 3 }), D.label(512, 322, '가스', { anchor: 'end', size: 18, color: 'muted' }),
            D.arrow(630, 322, 690, 322, { color: 'sim', w: 3 }), D.label(698, 322, '로켓', { size: 18, color: 'sim' })
          ], { title: '운동량 막대로 본 보존 (1칸 = 1 kg·m/s)', how: '막대가 옮겨 가도 합의 길이는 그대로 · 분리는 −2 와 +2 가 합쳐 0' });
        },
        more: { title: '더 알아보기 — 대포를 쏘면 (실험 ④)', body: ['붙어 있다가 밀어내도 같아요. 처음 합 0 → 포탄(0.5 kg)이 +4 m/s 로 +2 kg·m/s 를 가지면 대포(2 kg)는 −2 kg·m/s, 곧 뒤로 1 m/s 예요.'] },
        life: ['총을 쏘면 총이 뒤로 밀리는 반동', '보트에서 뛰어내리면 보트가 뒤로 가요.', '로켓은 가스를 뒤로 뿜어 앞으로 가요.'],
        teacherNote: '"보존"은 "계의 합이 일정"이라는 뜻이지 각 물체의 $p$ 가 같다는 뜻이 아니에요. 벽 충돌: 수레만 보면 운동량이 바뀌지만 벽(지구)이 반대 방향으로 같은 운동량을 받아요.' },

      /* 5장 (2차 신설) */
      { id: 'sign-sum', type: 'formula', title: '반대 방향이면 합은?',
        body: [
          '+2 와 −2 의 합은 4가 아니라 **0** 이에요(부호까지 더해요).',
          '그래서 달라붙으면 멈춰요. 운동량이 사라진 게 아니라 처음부터 합이 0 이에요.'
        ],
        eq: [{ tex: '$p$ = $p_1$ + $p_2$', caption: '(+2) + (−2) = 0 kg·m/s' }],
        symbols: [
          { sym: '$p_1$', name: 'A 의 운동량 $m_1v_1$', unit: 'kg·m/s', target: 'v1' },
          { sym: '$p_2$', name: 'B 의 운동량 $m_2v_2$ (왼쪽이면 −)', unit: 'kg·m/s', target: 'v2' }
        ],
        now: function (p) {
          if (p.mode !== 'collide') return '충돌 장면에서 $v_1$·$v_2$ 의 부호를 바꿔 봐요';
          var a = p.m1 * p.v1, b = p.m2 * p.v2;
          return '$p$ = (' + sg(a) + ') + (' + sg(b) + ') = ' + sg(a + b) + ' kg·m/s';
        },
        try: { label: '+2 와 −2 가 달라붙으면? ($v_2$ = −2 m/s)', preset: OPPOSITE.preset, set: OPPOSITE.set, predict: false },
        svg: function (D) {
          /* R7-3(B5): 제목 짧게 + 요소 y +24(제목과 '부딪치기 전' 사이 여백) · ✗/✓ 옆에 '틀림/맞음' 글자 */
          return D.svg([
            hatchDefs('cmH5'),
            D.label(30, 80, '부딪치기 전', { weight: 500 }),
            track(D, 60, 740, 168), cart(D, 170, 168, 100, 50, CA, 'A'), cart(D, 530, 168, 100, 50, CB, 'B'),
            /* 속도 글자는 화살 꼬리 쪽에(머리 쪽이면 가운데에서 두 글자가 겹침) */
            vArrow(D, 240, 320, 84, '+2 m/s', { lx: 228, anchor: 'end' }), vArrow(D, 560, 480, 84, '−2 m/s', { lx: 572, anchor: 'start' }),
            D.line(400, 194, 400, 270, { color: 'ink', w: 3 }),
            bar(400, 212, 80, 'cmH5'), D.label(492, 212, '$p_1$ = +2', { weight: 500, sym: 'p_1' }),
            bar(400, 252, -80, 'cmH5'), D.label(308, 252, '$p_2$ = −2', { anchor: 'end', weight: 500, sym: 'p_2' }),
            D.label(400, 292, '합 $p$ = (+2) + (−2) = 0', { anchor: 'middle', weight: 500, color: 'sim', sym: 'p' }),
            D.label(400, 326, '크기만 더해 4 → ✗ 틀림 · 부호까지 더해 0 → ✓ 맞음', { anchor: 'middle', size: 18 }),
            D.label(30, 362, '달라붙은 뒤', { weight: 500 }),
            track(D, 60, 740, 436), cart(D, 300, 436, 100, 50, CA, 'A'), cart(D, 400, 436, 100, 50, CB, 'B'),
            D.label(530, 404, "$v′$ = 0 (멈춤)", { weight: 500 })
          ], { title: '크기가 아니라 부호까지 더해요', how: '1 kg 수레 둘 · 청록 화살표 = 속도 · 막대 채움 = +, 빗금 = − (1 kg·m/s = 40)' });
        },
        teacherNote: '운동 에너지: 같은 장면의 합은 ½×1×2² + ½×1×2² = 4 J — 달라붙어 멈추면 4 J 이 전부 열·소리로, 튕기면 속도를 맞바꿔 4 J 그대로. 이 장의 질문: "멈추면 운동량이 사라졌나?" → 아니다, 처음 합이 0 이었다(보존). $v_2$ 는 ⚙ › 더 많은 설정에 있어 [해 보기] 가 채워 줘요.' },

      /* 6장 */
      { id: 'bounce-stick', type: 'formula', title: '튕기기와 달라붙기', levels: ['basic', 'mid', 'adv'],
        body: { basic: [
          '같은 무게의 수레 A 가 멈춰 있는 B 에 부딪쳐요.',
          '**튕기면** A 는 멈추고 B 가 같은 속도로 가요(속도를 맞바꿔요). **달라붙으면** 둘이 함께 절반 속도로 가요.',
          '움직임의 양은 두 경우 모두 그대로예요.'
        ], mid: [
          '같은 질량 A(+2 m/s)가 정지한 B 에 **튕기면** 속도를 맞바꾸고, **달라붙으면** 함께 +1 m/s 로 가요.',
          '운동량 합은 둘 다 그대로, $E_k$ 는 붙으면 2 J → 1 J 로 줄어요(열·소리로).'
        ] },
        eq: { basic: [], mid: [{ tex: '$E_k$ = ½$mv^2$', caption: '운동 에너지 (J) — 방향이 없어요' }] },
        symbols: [
          { sym: '$E_k$', name: '운동 에너지 합 (전 → 후)', unit: 'J', target: 'meter:k' },
          { sym: '$e$', name: '반발 계수(심화) = 부딪친 뒤 멀어지는 빠르기 ÷ 다가오던 빠르기 (튕기기 1 · 달라붙기 0)', unit: '', target: 'kind' }
        ],
        svg: function (D) {
          if (SK.level && SK.level() === 'basic') {   // R9: 초급 — 수레 그림으로 '무엇이 어떻게 되나'만
            return D.svg([
              D.label(30, 70, '튕기면', { weight: 500 }), track(D, 120, 760, 130),
              cart(D, 140, 130, 90, 44, CA, 'A'), cart(D, 380, 130, 90, 44, CB, 'B'), vArrow(D, 190, 270, 70, '2 m/s', { size: 20 }),
              track(D, 120, 760, 230), cart(D, 280, 230, 90, 44, CA, 'A'), cart(D, 520, 230, 90, 44, CB, 'B'), D.label(325, 160, '멈춰요', { anchor: 'middle', size: 20 }), vArrow(D, 570, 660, 170, '2 m/s', { size: 20 }),
              D.label(30, 290, '달라붙으면', { weight: 500 }), track(D, 120, 760, 350),
              cart(D, 140, 350, 90, 44, CA, 'A'), cart(D, 380, 350, 90, 44, CB, 'B'), vArrow(D, 190, 270, 296, '2 m/s', { size: 20 }),
              track(D, 120, 760, 430), cart(D, 400, 430, 180, 44, CA, 'A+B'), vArrow(D, 500, 540, 376, '1 m/s', { size: 20, lx: 548 })
            ], { title: '같은 무게 수레의 충돌', how: '튕기면 속도를 맞바꾸고, 달라붙으면 함께 절반 속도로 가요 — 움직임의 양은 그대로' });
          }
          var base = 360, k = 110;
          function ebar(x, j, label) { return rect(x, base - j * k, 70, j * k, EK, { rx: 3 }) + D.label(x + 35, base - j * k - 18, label, { anchor: 'middle', size: 20, weight: 500 }); }
          return D.svg([
            D.label(170, 70, '튕기기', { anchor: 'middle', weight: 500 }),
            ebar(90, 2, '2 J'), ebar(180, 2, '2 J'),
            D.label(125, 386, '전', { anchor: 'middle', size: 18, color: 'muted' }), D.label(215, 386, '후', { anchor: 'middle', size: 18, color: 'muted' }),
            D.label(170, 420, '운동량 2 → 2 · $E_k$ 그대로 ○', { anchor: 'middle', size: 18, sym: 'E_k' }),
            D.line(400, 60, 400, 420, { color: 'muted', w: 1, dash: '4 6' }),
            D.label(590, 70, '달라붙기', { anchor: 'middle', weight: 500 }),
            ebar(500, 2, '2 J'), ebar(590, 1, '1 J'),
            rect(590, base - 2 * k, 70, k, 'none', { stroke: 'var(--color-ink-muted)', sw: 2, dash: '6 5', rx: 3 }),
            D.label(672, base - 1.62 * k, '열·소리', { size: 18, color: 'muted' }), D.label(672, base - 1.38 * k, '1 J', { size: 18, color: 'muted' }),
            D.label(535, 386, '전', { anchor: 'middle', size: 18, color: 'muted' }), D.label(625, 386, '후', { anchor: 'middle', size: 18, color: 'muted' }),
            D.label(590, 420, '운동량 2 → 2 · $E_k$ 줄어듦 ✕', { anchor: 'middle', size: 18 })
          ], { title: '운동 에너지 $E_k$ 합 막대 (같은 질량 1 kg, A +2 m/s)', how: '두 경우 모두 운동량 합은 2 kg·m/s 그대로 · 달라붙으면 $E_k$ 절반이 열·소리로' });
        },
        more: { title: '더 알아보기 — 중간 충돌 (반발 계수, 심화)', body: ['반발 계수 $e$ = 0.5 이면 A +0.5, B +1.5 m/s, $E_k$ 2 J → 1.25 J 이에요. 운동량 합은 이때도 2 kg·m/s 그대로예요. (⚙ › 더 많은 설정의 반발 계수)'] },
        life: ['당구공 두 개의 충돌은 거의 튕기기, 찰흙 덩어리가 붙는 충돌은 달라붙기예요.', '자동차 범퍼가 찌그러지며 에너지를 흡수해요.'],
        teacherNote: '실험 ①과 ②를 이어서 해요. ② 뒤에는 그래프 탭을 "운동 에너지"로 바꿔 봐요. 총에너지는 보존(연계 [12물리01-05]).' },

      /* 7장 */
      { id: 'action-reaction', type: 'formula', title: '서로 미는 두 힘',
        body: [
          '트럭과 승용차가 서로 미는 힘은 크기가 같아요({{작용·반작용}}). 그래서 $Δp$ 의 크기도 같아요.',
          '실험 ③(트럭 3 kg·+2, 승용차 1 kg·−2 m/s 튕기기): 나중 속도 트럭 0, 승용차 +4 → $Δv$ 는 −2, +6 m/s.'
        ],
        eq: [{ tex: '$Δv$ =', frac: ['$Δp$', '$m$'], caption: '같은 $Δp$ 면 가벼운 쪽 속도가 크게 바뀌어요' }],
        symbols: [
          { sym: '$Δp$', name: '운동량 변화 (크기 같음)', unit: 'kg·m/s', target: 'stage:force' },
          { sym: '$Δv$', name: '속도 변화 = 나중 속도 − 처음 속도', unit: 'm/s', target: 'meter:v2' }
        ],
        svg: function (D) {
          return D.svg([
            hatchDefs('cmH7'),
            track(D, 60, 740, 210),
            cart(D, 230, 210, 170, 96, CA, '트럭 A'), cart(D, 400, 210, 100, 60, CB, 'B'),
            D.arrow(400, 82, 290, 82, { kind: 'f', label: '$F$', ly: 82 }), D.arrow(400, 82, 510, 82, { kind: 'f', label: '$F$', ly: 82 }),
            D.label(400, 58, '같은 크기, 반대 방향', { anchor: 'middle', weight: 500, color: 'warn' }),
            D.label(450, 236, '승용차', { anchor: 'middle', size: 18, color: 'muted' }),
            D.label(400, 276, '속도 변화는 가벼운 쪽이 커요', { anchor: 'middle', weight: 500 }),
            D.line(400, 300, 400, 410, { color: 'ink', w: 3 }),
            D.label(120, 330, '트럭 $Δv$', { size: 20, sym: 'Δv' }), bar(400, 330, -40, 'cmH7'), D.label(348, 330, '−2 m/s', { anchor: 'end', weight: 500 }),
            D.label(120, 385, '승용차 $Δv$', { size: 20 }), bar(400, 385, 120, 'cmH7'), D.label(532, 385, '+6 m/s', { weight: 500 }),
            legend(D, 540, 430, 'cmH7')
          ], { title: '부딪치는 순간의 두 힘', how: '굵은 화살표 = 서로에게 주는 힘(길이 같음) · 아래 막대 = 속도 변화(나중 속도와 달라요: 승용차 −2 → +4)' });
        },
        life: ['스케이트보드 위에서 벽을 밀면 내가 뒤로 가요.', '가벼운 아이와 무거운 어른이 서로 밀면 힘은 같고, 가벼운 쪽이 더 빨리 밀려나요.'],
        teacherNote: '"더 큰 힘"과 "더 큰 영향($Δv$)"을 구분하게 해요. 나중 속도 $v_2′$ = +4 와 속도 변화 $Δv$ = +6 도 구분해요. 실험 ③의 힘-시간 탭에서 두 곡선이 겹쳐요.' },

      /* ── R9 고급 전용 ── */
      { id: 'restitution', type: 'formula', levels: ['adv'], title: '반발 계수 $e$ 로 보존식 풀기',
        body: [
          '$e$ = (부딪친 뒤 멀어지는 빠르기) ÷ (다가오던 빠르기). 튕기기는 $e$ = 1, 달라붙기는 $e$ = 0, 그 사이는 $E_k$ 가 조금 줄어요.',
          '식 두 개로 두 모르는 값($v_1′$, $v_2′$)을 풀어요. 예: $e$ = 0.5, $m_1$ = $m_2$ = 1 kg, $v_1$ = +2, $v_2$ = 0 → $v_1′$ = 0.5, $v_2′$ = 1.5 m/s, $E_k$ 2 J → 1.25 J.'
        ],
        eq: [
          { tex: '$m_1v_1 + m_2v_2 = m_1v_1′ + m_2v_2′$', caption: '① 운동량 보존' },
          { tex: '$v_2′ − v_1′ = e(v_1 − v_2)$', caption: '② 반발 계수' },
          { tex: '$v_2′$ =', frac: ['$(1 + e) m_1 v_1$', '$m_1 + m_2$'], caption: '$v_2$ = 0 일 때' }
        ],
        symbols: [{ sym: '$e$', name: '반발 계수 (0 ~ 1)', target: 'e' }, { sym: '$v_1′$', name: '부딪친 뒤 A 의 속도', target: 'meter:v2' }],
        try: { label: '$e$ = 0.5 로 해 보기', preset: 0, set: { e: 0.5 }, predict: false },
        teacherNote: '고급 전용. 손으로 두 식을 풀게 한 뒤 실험 값(0.5, 1.5 m/s)과 맞춘다. $E_k$ 손실 0.75 J 은 소리·열.' },
      { id: 'limits', type: 'concept', levels: ['adv'], title: '운동량 보존은 바깥 힘이 없을 때만',
        body: [
          '두 수레의 운동량 합이 그대로인 것은 **바깥에서 미는 힘이 없을 때**예요.',
          '마찰이 있거나 벽이 막아 주면 수레끼리의 합은 변해요. 벽·지구까지 합쳐서 봐야 보존이에요(실험 ⑤ 벽).',
          '충돌 시간이 아주 짧아서 바깥 힘의 영향을 무시할 수 있을 때 근사로 써요.'
        ],
        condition: '바깥 힘이 없거나, 충돌 시간이 아주 짧을 때',
        teacherNote: '고급 전용. 실험 ⑤(벽)에서 수레 운동량이 사라진 듯 보이는 장면을 "벽·지구 포함"으로 되묻는다.' },

      /* 8장 — 오해 카드: 내 생각 → [해 보기] → 실행이 끝나면 '깨졌어요 ✓ + result' */
      { id: 'misc', type: 'misconception', title: '흔한 오해',
        items: [
          { id: 'stop-gone', claim: '"부딪쳐 멈추면 운동량이 사라진 거예요."',
            why: '+2 와 −2 처럼 처음 합이 0 이면 나중 합도 0 이라 멈춰요. 사라진 게 아니라 처음부터 합이 0 이었어요.', chapter: 'sign-sum',
            try: OPPOSITE, result: '운동량 합 0 → 0 으로 멈췄어요. 운동 에너지 4 J 은 전부 열·소리로 바뀌었어요.' },
          { id: 'truck-force', claim: '"무거운 트럭이 승용차에 더 큰 힘을 줘요."',
            why: '부딪치는 두 힘은 늘 크기가 같고 방향만 반대예요. 질량에 따라 다른 것은 속도 변화 $Δv$ 예요.', chapter: 'action-reaction',
            try: { preset: 2 }, result: '힘-시간 그래프의 두 곡선이 겹쳤어요. 속도 변화만 달라요(트럭 −2, 승용차 +6 m/s).' },
          { id: 'size-sum', claim: '"운동량의 합은 크기를 더한 값이에요(+2 와 −2 면 4)."',
            why: '운동량은 방향이 있어 부호까지 더해요. (+2) + (−2) = 0 이에요.', chapter: 'sign-sum',
            try: OPPOSITE, result: '부호까지 더한 합 0 이 그대로라 붙은 수레가 멈췄어요.' }
        ],
        teacherNote: '보조 오개념: "붙으면 멈춰요"(→ 실험 ②, 합 2 그대로라 1 m/s) · "운동량이 보존되면 운동 에너지도 보존"(→ 실험 ② 운동 에너지 탭) · "벽에 부딪쳐 멈추면 운동량이 사라져요"(→ 실험 ⑤, 벽·지구로 넘어감) · "에어백은 충격량을 줄인다"(→ 시간을 늘려 힘을 줄임).' },

      /* 9장 */
      { id: 'check', type: 'check', levels: ['basic', 'mid', 'adv'], title: '시뮬레이터에서 확인할 질문',
        questions: [
          { q: { basic: '같은 무게의 수레 A 가 멈춘 B 에 부딪혀 튕기면 A 는 어떻게 될까?', mid: '같은 질량의 A(+2 m/s)가 멈춘 B 와 부딪혀 튕기면?' }, preset: 0, chapter: 'bounce-stick' },
          { q: { basic: '이번엔 달라붙으면 합쳐진 수레의 속도는?', mid: '이번엔 달라붙으면?' }, preset: 1, chapter: 'bounce-stick' },
          { q: { basic: '3배 무거운 트럭과 승용차가 부딪치면 서로 주는 힘은?', mid: '3배 무거운 트럭과 승용차가 정면충돌하면 누가 더 큰 힘을 받을까?' }, preset: 2, chapter: 'action-reaction' },
          { q: '멈춘 대포가 포탄을 쏘면 대포는?', levels: ['mid', 'adv'], preset: 3, chapter: 'conserve' },
          { q: '딱딱한 범퍼로 한 번 기록한 뒤, 푹신한 범퍼(0.2 s)로 바꿔 또 해 보세요. 충돌 시간이 길어지면 힘은 어떻게 될까요?', levels: ['mid', 'adv'], preset: 4, set: { tau: 0.01 }, chapter: 'impulse' },
          { q: '+2 m/s 와 −2 m/s 로 마주 오던 두 수레가 달라붙으면?', levels: ['mid', 'adv'], cardName: '마주 오다 부딪치기', preset: OPPOSITE.preset, set: OPPOSITE.set, predict: false, chapter: 'sign-sum' },
          { q: '$e$ 를 0 에서 1 로 바꿔 가며 부딪치면 부딪친 뒤 속도와 $E_k$ 는 어떻게 바뀔까?', levels: ['adv'], preset: 6, chapter: 'restitution' }
        ],
        teacherNote: '초급 질문은 ①②③ 세 장면만. 고급은 ⑦ 로 반발 계수를 0→1 로 바꿔 보게 한다.\n질문 1 이 끝나면 "튕기는 대신 붙으면 에너지 1 J 는 어디로?" → 질문 2. 질문 6 은 카드 ⑥ 「마주 오다 부딪치기」로 열려요(붙으면 멈추고, 튕기면 속도를 맞바꿔요).' },

      /* 정리 — 설명 순서에서 빠지고 정리 모달(형성평가 3문항 + 교사 [정답 공개])에서만 */
      { id: 'wrap', type: 'wrap', title: '실험 뒤 정리',
        summary: ['바깥 힘이 없으면 충돌 전후 운동량의 합(부호 포함)은 일정하고, 운동 에너지의 합은 튕기는 충돌에서만 일정해요. 부딪친 두 물체가 서로 주는 힘은 항상 크기가 같아요.'],
        quiz: [
          /* ── R9 초급 3문항 (levels:['basic']) — 중급 3문항은 R8 그대로 ── */
          { kind: 'concept', levels: ['basic'], q: '같은 질량의 수레 A 가 멈춘 수레 B 에 부딪혀 튕겼어요. 부딪친 뒤 A 는?',
            choices: ['같은 속도로 계속 가요', '멈추고 B 가 가요', '되튀어요'], answerIdx: 1,
            why: '같은 질량이면 속도를 맞바꿔요(움직임의 양이 B 로 옮겨 가요).', chapter: 'bounce-stick', try: { preset: 0 } },
          { kind: 'compare', levels: ['basic'], q: '같은 수레 둘이 부딪쳐 달라붙으면 합쳐진 수레의 속도는 처음 A 의 속도의 몇 배일까?',
            choices: ['같아요', '절반이에요', '두 배예요'], answerIdx: 1,
            why: '움직임의 양은 그대로인데 무게가 두 배가 되어 속도가 절반이에요.', chapter: 'bounce-stick', try: { preset: 1 } },
          { kind: 'misconception', levels: ['basic'], q: '트럭이 승용차에 부딪칠 때 서로 주는 힘은?',
            choices: ['트럭이 더 커요', '승용차가 더 커요', '같아요'], answerIdx: 2,
            why: '작용·반작용이라 같아요. 가벼운 승용차의 속도가 더 많이 바뀌어요.', chapter: 'momentum', try: { preset: 2 } },
          { kind: 'concept', q: '질량 2 kg 수레가 오른쪽으로 3 m/s 로 가요. 오른쪽을 + 로 할 때 운동량 $p$ 는?',
            choices: ['+6 kg·m/s', '−6 kg·m/s', '+1.5 kg·m/s'], answerIdx: 0,
            why: '$p$ = $mv$ = 2 × (+3) = +6 kg·m/s. 오른쪽이라 부호가 + 예요.', chapter: 'momentum',
            try: { preset: 0, set: { m1: 2, v1: 3 }, predict: false } },
          { kind: 'calc', q: '1 kg 수레 A(+2 m/s)가 정지한 1 kg 수레 B 와 부딪쳐 달라붙었어요. 합쳐진 수레의 속도와 운동 에너지 $E_k$ 의 변화는?',
            choices: ['2 m/s, $E_k$ 2 J 그대로', '1 m/s, $E_k$ 2 J → 1 J', '1 m/s, $E_k$ 2 J 그대로'], answerIdx: 1,
            why: '운동량 합 2 = (1 + 1)$v′$ 에서 $v′$ = 1 m/s. $E_k$ = ½ × 2 × 1² = 1 J — 줄어든 1 J 은 소리·열로 바뀌어요.', chapter: 'bounce-stick',
            try: { preset: 1 } },
          { kind: 'misconception', q: '"무거운 트럭이 가벼운 승용차를 더 큰 힘으로 민다." 옳은 판단은?',
            choices: ['맞다 — 질량이 큰 쪽이 더 큰 힘을 준다', '틀리다 — 승용차가 더 큰 힘을 준다', '틀리다 — 두 힘의 크기는 같고, 다른 것은 속도 변화다'], answerIdx: 2,
            why: '작용·반작용으로 두 힘은 크기가 같아요. 가벼운 승용차의 속도 변화 $Δv$ 가 더 커요(트럭 −2, 승용차 +6 m/s).', chapter: 'action-reaction',
            try: { preset: 2 } }
        ],
        more: [
          { levels: ['adv'], q: '(계산) $e$ = 0.5, $m_1$ = $m_2$ = 1 kg, $v_1$ = +2, $v_2$ = 0 m/s 일 때 부딪친 뒤 속도 $v_1′$, $v_2′$ 는?', answer: '$v_1′$ = 0.5, $v_2′$ = 1.5 m/s ($E_k$ 2 J → 1.25 J)',
            why: '$v_2′$ = {{frac:(1 + 0.5) × 2|2}} = 1.5, $v_1′$ = $v_2′$ − 0.5 × 2 = 0.5. $E_k$ 손실 0.75 J.', chapter: 'restitution' },
          { q: '(심화) 같은 충돌에서 푹신한 범퍼가 평균 힘을 작게 하는 이유는?', answer: '충격량은 같고 시간이 길어져서',
            why: '충격량 $I$ (= 운동량 변화)는 같고 $Δt$ 가 길어지므로 $F$ = {{frac:$Δp$|$Δt$}} 가 작아요.', chapter: 'impulse' },
          { q: '+2 와 −2 가 달라붙어 멈추면 운동량은 어디로 갔을까?', answer: '사라지지 않았다 — 처음 합이 0',
            why: '처음 합이 (+2) + (−2) = 0 이라 나중 합도 0 이에요. 운동 에너지 4 J 은 열·소리로 바뀌었어요.', chapter: 'sign-sum' }
        ] }
    ],
    links: { momentum: 'momentum', impulse: 'impulse', conserve: 'conserve', 'sign-sum': 'sign-sum', 'bounce-stick': 'bounce-stick', 'action-reaction': 'action-reaction' }
  });
})();
