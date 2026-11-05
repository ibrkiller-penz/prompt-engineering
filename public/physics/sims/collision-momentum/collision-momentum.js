/* =====================================================================
   collision-momentum — 일차원 충돌과 운동량 보존 (2026-10-28, R1 고도화 1차: 에듀테크3)
   공통 틀: ../../shared/sim.js (SimKit) · 명세: docs/04_팀장결정서.md §4-3
   성취기준 [12물리01-03] 작용·반작용, 운동량 보존(고려 사항: 운동량·충격량) · 연계 [12물리01-05]

   1부  CM  — 물리 엔진 (DOM 없음, node 로도 검산 가능: module.exports)
   2부  화면 — SimKit 위에서 그리기·조절·기록

   화면 축척: 트랙 x −2 ~ +2 m, 1 m = 240u (실험 화면 논리 좌표 1250×660, 양끝 여유 → 수레가 잘리지 않음)
   물리 모형
     - 마찰 없음(에어트랙). 반발 계수 e: 튕기기 1 · 중간 0.5 · 달라붙기 0 (심화에서 0~1)
     - 충돌 힘 F(t) = Fmax·sin(πt/τ), 0 ≤ t ≤ τ  (사인 모양으로 단순화한 모형)
       J = μ(1+e)(v₁−v₂), μ = m₁m₂/(m₁+m₂),  Fmax = πJ/(2τ),  평균 힘 = J/τ
     - 충돌 중 속도는 해석해 v₁(t) = v₁ − (J/m₁)(1−cos(πt/τ))/2 (B 는 +),
       위치는 그 해석 적분(사다리꼴 근사보다 정확, 같은 모형)
     - 벽: m₂ = ∞ → v₁′ = −e·v₁, J = m₁(1+e)v₁
     - 분리(반동): 붙어 정지 → 포탄 B 속력 u, J = m₂u, v₁′ = −m₂u/m₁
   자동 슬로 모션: 재생 배율 = min(1, τ/2) → 충돌 τ 가 화면에서 2 초.
     만나기 직전(0.25τ, 화면 약 0.5 초)부터 느려지고, 끝난 뒤 화면 0.5 초 동안 유지 후 1배.
     구현: SimKit 의 고정 간격 dt(화면 시간)마다 물리 시간 dt×배율 만큼 진행하고
           SimKit.time 을 물리 시간으로 맞춘다 → ',' '.' 한 프레임도 슬로 모션 기준.
   ===================================================================== */
(function (root) {
  'use strict';

  /* =================================================================
     1부. 물리 엔진
     ================================================================= */
  var CM = (function () {
    var HW = 0.15;              // 수레 몸통 반폭 (m) → 몸통 0.30 m = 84u
    var BUMP = 0.10;            // 범퍼 길이 (m) = 28u
    var D0 = 2 * (HW + BUMP);   // 두 수레 범퍼가 닿을 때 중심 거리 0.5 m
    var XA0 = -0.9, XB0 = 0.4;  // 처음 위치 (충돌·벽)
    var XW = 1.2;               // 벽 면 위치 (m)
    var G0 = 0.08;              // 분리 모드: 눌린 용수철 길이 (m)
    var L0 = 0.25;              // 용수철 자연 길이 (m)
    var T_PUSH = 0.3;           // 분리 모드: 밀어내기 시작 시각 (s)
    var POST_T = 1.0;           // 충돌 끝나고 더 보여 줄 시간 (s)
    var PRE_MAX = 3.0;          // 만나지 않을 때 최대 시간 (s)
    var T_MAX = 8.0;
    var X_OUT = 2.3;            // 화면 밖 판정 (m)
    var HOLD_DISP = 0.5;        // 슬로 모션 유지 (화면 시간, s)
    var CMAX = 1.6 * BUMP;      // 두 범퍼 합쳐 최대로 눌리는 양(그림용)
    var CMAXW = 0.9 * BUMP;     // 벽: 범퍼 하나
    var TRAVEL = 2.5;           // 부딪치기 전 한 수레가 움직이는 최대 거리 (m)
    var HIT_LIM = 1.6;          // 부딪치는 곳이 이 안에 있게 (m)
    var START_LIM = 1.85;       // 처음 위치 한계 (m)

    /** 실행 계획: 처음 값 → 충격량·나중 속도 (해석해) */
    function plan(p) {
      var mode = p.mode, m1 = +p.m1, m2 = +p.m2, e = +p.e, tau = +p.tau;
      var v1, v2, J = 0, meet, v1f, v2f;
      if (mode === 'separate') {
        v1 = 0; v2 = 0; J = m2 * p.u; meet = true;
        v1f = -J / m1; v2f = J / m2;
      } else if (mode === 'wall') {
        v1 = +p.v1; v2 = 0; meet = v1 > 0;
        J = meet ? m1 * (1 + e) * v1 : 0;
        v1f = v1 - J / m1; v2f = 0;
      } else {
        v1 = +p.v1; v2 = +p.v2; meet = v1 - v2 > 0;
        var mu = m1 * m2 / (m1 + m2);
        J = meet ? mu * (1 + e) * (v1 - v2) : 0;
        v1f = v1 - J / m1; v2f = v2 + J / m2;
      }
      v1f = tidy(v1f); v2f = tidy(v2f); J = tidy(J);
      var pb, pa, kb, ka;
      if (mode === 'wall') {
        pb = m1 * v1; pa = m1 * v1f; kb = 0.5 * m1 * v1 * v1; ka = 0.5 * m1 * v1f * v1f;
      } else {
        pb = m1 * v1 + m2 * v2; pa = m1 * v1f + m2 * v2f;
        kb = 0.5 * m1 * v1 * v1 + 0.5 * m2 * v2 * v2; ka = 0.5 * m1 * v1f * v1f + 0.5 * m2 * v2f * v2f;
      }
      // 계산 오차(1e-15 수준) 때문에 표에서 소수 2자리가 갈리지 않게: 보존되는 양은 같은 값으로 맞춘다
      if (mode !== 'wall' && Math.abs(pa - pb) < 1e-9 * Math.max(1, Math.abs(pb))) pa = pb;
      if (e === 1 && Math.abs(ka - kb) < 1e-9 * Math.max(1, kb)) ka = kb;
      return {
        mode: mode, m1: m1, m2: m2, e: e, tau: tau, u: +p.u, v1: v1, v2: v2, J: J,
        Fmax: Math.PI * J / (2 * tau), Favg: J / tau, meet: meet, v1f: v1f, v2f: v2f,
        pb: pb, pa: pa, kb: kb, ka: ka
      };
    }

    function tidy(v) { return Math.round(v * 1e12) / 1e12; }

    /** 처음 위치. 기본은 A −0.9 · B +0.4 m.
        같은 방향으로 달리며 천천히 따라잡는 충돌(예: v₁ +2, v₂ +1.5)은 기본 위치면 부딪치기 전에
        화면 밖으로 나가므로, 간격을 줄이고 두 수레를 함께 옮겨 트랙 안에서 부딪치게 한다. */
    function startPos(P) {
      var xa = XA0, gap = XB0 - XA0 - D0;              // 범퍼 사이 빈 간격 0.8 m
      if (P.mode !== 'collide' || !P.meet) return { xA: xa, xB: XB0 };
      var close = P.v1 - P.v2, vmax = Math.max(Math.abs(P.v1), Math.abs(P.v2));
      if (vmax * gap / close > TRAVEL) gap = TRAVEL * close / vmax;
      var th = gap / close, D = D0 + gap;
      var hitA = xa + P.v1 * th, hitB = hitA + D0;
      if (hitA < -HIT_LIM) xa += -HIT_LIM - hitA;
      else if (hitB > HIT_LIM) xa += HIT_LIM - hitB;
      xa = Math.max(-START_LIM, Math.min(START_LIM - D, xa));
      return { xA: xa, xB: xa + D };
    }

    function init(p) {
      var P = plan(p), sp = startPos(P);
      var s = {
        P: P, t: 0, phase: 'pre', tc: 0, vA: P.v1, vB: P.v2, xA: sp.xA, xB: sp.xB,
        hitT: null, endT: null, holdDisp: 0, slow: 1, c: 0,
        xAc: 0, xBc: 0, vA0: 0, vB0: 0, end: null
      };
      if (P.mode === 'separate') { s.xA = -(HW + G0 / 2); s.xB = HW + G0 / 2; }
      if (P.mode === 'wall') s.xB = null;
      return s;
    }
    function copyState(s) { var r = {}; for (var k in s) r[k] = s[k]; return r; }

    /** 충돌 시작까지 남은 물리 시간 */
    function timeToHit(s) {
      var P = s.P;
      if (s.phase !== 'pre' || !P.meet) return Infinity;
      if (P.mode === 'separate') return Math.max(0, T_PUSH - s.t);
      if (P.mode === 'wall') return Math.max(0, (XW - HW - BUMP - s.xA) / s.vA);
      return Math.max(0, ((s.xB - s.xA) - D0) / (s.vA - s.vB));
    }
    function free(s, d) {
      s.xA += s.vA * d;
      if (s.xB !== null) s.xB += s.vB * d;
      s.t += d;
    }
    function startHit(s) {
      s.phase = 'hit'; s.tc = 0; s.hitT = s.t;
      s.xAc = s.xA; s.xBc = s.xB; s.vA0 = s.vA; s.vB0 = s.vB;
    }
    /** 충돌 중 위치·속도 (해석해) */
    function hitPos(s) {
      var P = s.P, k = Math.PI / P.tau, tc = s.tc;
      var frac = (1 - Math.cos(k * tc)) / 2;          // 0 → 1
      var S = (tc - Math.sin(k * tc) / k) / 2;         // ∫frac dt
      s.vA = s.vA0 - P.J / P.m1 * frac;
      if (P.mode === 'separate') {
        s.vB = s.vB0 + P.J / P.m2 * frac;
        s.xA = s.xAc + s.vA0 * tc - P.J / P.m1 * S;
        s.xB = s.xBc + s.vB0 * tc + P.J / P.m2 * S;
      } else if (P.mode === 'wall') {
        var cw = s.vA0 * tc - P.J / P.m1 * S;           // 범퍼가 눌린 양
        s.c = CMAXW * Math.tanh(cw / CMAXW);
        s.xA = XW - HW - BUMP + s.c;
      } else {
        s.vB = s.vB0 + P.J / P.m2 * frac;
        var M = P.m1 + P.m2;
        var c = (s.vA0 - s.vB0) * tc - P.J * (1 / P.m1 + 1 / P.m2) * S;  // 두 범퍼가 눌린 양
        s.c = CMAX * Math.tanh(c / CMAX);               // 그림용(질량 중심은 정확히 유지)
        var xcm = (P.m1 * s.xAc + P.m2 * s.xBc) / M + (P.m1 * s.vA0 + P.m2 * s.vB0) / M * tc;
        var D = D0 - s.c;
        s.xA = xcm - P.m2 / M * D;
        s.xB = xcm + P.m1 / M * D;
      }
    }
    /** 물리 시간 h 만큼 진행 (충돌 시작·끝 순간을 정확히 나눔) */
    function advance(s, h) {
      var guard = 0;
      while (h > 1e-15 && guard++ < 8) {
        if (s.phase === 'pre') {
          var th = timeToHit(s);
          if (th <= h) { free(s, th); h -= th; startHit(s); continue; }
          free(s, h); h = 0;
        } else if (s.phase === 'hit') {
          var d = Math.min(h, s.P.tau - s.tc);
          s.tc += d; s.t += d; h -= d; hitPos(s);
          if (s.tc >= s.P.tau - 1e-12) {
            s.tc = s.P.tau; hitPos(s);
            s.phase = 'post'; s.endT = s.t;
            s.vA = s.P.v1f; if (s.P.mode !== 'wall') s.vB = s.P.v2f;
          }
        } else { free(s, h); h = 0; }
      }
    }
    /** 슬로 모션 배율 (dtDisp = 화면 시간 간격) */
    function slowFactor(s, auto, dtDisp) {
      if (!auto) return 1;
      var target = Math.min(1, s.P.tau / 2);
      if (s.phase === 'hit') return target;
      if (s.phase === 'pre') return timeToHit(s) <= 0.25 * s.P.tau + dtDisp ? target : 1;
      return s.holdDisp < HOLD_DISP ? target : 1;
    }
    function out(s) { return Math.abs(s.xA) > X_OUT || (s.xB !== null && Math.abs(s.xB) > X_OUT); }
    /** 한 걸음 (dtDisp = 화면 시간). 끝나면 s.end = 'done'|'nomeet'|'offscreen' */
    function step(s, dtDisp, autoSlow) {
      var f = slowFactor(s, autoSlow, dtDisp);
      s.slow = f;
      advance(s, dtDisp * f);
      if (s.phase === 'post') s.holdDisp += dtDisp;
      var P = s.P;
      if (s.phase === 'post' && (s.t - s.endT >= POST_T || out(s))) s.end = 'done';
      else if (s.phase === 'pre' && !P.meet && (s.t >= PRE_MAX || out(s))) s.end = 'nomeet';
      else if (s.phase === 'pre' && P.meet && out(s)) s.end = 'offscreen';
      else if (s.t >= T_MAX) s.end = 'done';
      return s;
    }
    /** 지금 주고받는 힘 크기 (B 쪽이 받는 힘 = +F, A = −F) */
    function force(s) {
      if (s.phase !== 'hit') return 0;
      return s.P.Fmax * Math.sin(Math.PI * s.tc / s.P.tau);
    }
    /** 힘-시간 곡선 점 (시간 ms, 힘 N), 충돌 시작 = 0. upTo(초)까지만 */
    function curve(P, upTo, n) {
      n = n || 60;
      var fa = [], fb = [], tau = P.tau;
      if (!P.meet) return { fa: fa, fb: fb };
      var lim = upTo === undefined ? 1.2 * tau : upTo;
      function push(t, F) { fa.push([t * 1000, -F]); fb.push([t * 1000, F]); }
      push(-0.2 * tau, 0);
      if (lim < 0) return { fa: fa, fb: fb };
      push(0, 0);
      for (var i = 1; i <= n; i++) {
        var t = tau * i / n;
        if (t > lim) { push(lim, P.Fmax * Math.sin(Math.PI * lim / tau)); return { fa: fa, fb: fb }; }
        push(t, P.Fmax * Math.sin(Math.PI * t / tau));
      }
      push(Math.min(lim, 1.2 * tau), 0);
      return { fa: fa, fb: fb };
    }
    function pNow(s) {
      var P = s.P;
      if (P.mode === 'wall') return P.m1 * s.vA;
      var p = P.m1 * s.vA + P.m2 * s.vB;
      return Math.abs(p - P.pb) < 1e-9 * Math.max(1, Math.abs(P.pb)) ? P.pb : p;   // 보존량: 계산 오차만 지움
    }
    function kNow(s) { var P = s.P; return 0.5 * P.m1 * s.vA * s.vA + (P.mode === 'wall' ? 0 : 0.5 * P.m2 * s.vB * s.vB); }
    function cartH(m) { return 56 + (Math.min(3, Math.max(0.5, m)) - 0.5) / 2.5 * 54; }   // 56~110u (실험 화면 660u)

    return {
      HW: HW, BUMP: BUMP, D0: D0, XA0: XA0, XB0: XB0, XW: XW, G0: G0, L0: L0, T_PUSH: T_PUSH,
      plan: plan, init: init, startPos: startPos, copy: copyState, step: step, advance: advance, timeToHit: timeToHit,
      slowFactor: slowFactor, force: force, curve: curve, pNow: pNow, kNow: kNow, cartH: cartH
    };
  })();

  if (typeof module !== 'undefined' && module.exports) module.exports = CM;
  if (!root || !root.SimKit) return;


  /* =================================================================
     2부. 화면 (SimKit R1)
     실험 화면 1250×660: 위 55% 트랙 장면 · 아래 그래프 판(탭 3개: 운동량 | 힘-시간 | 운동 에너지)
     하단 띠 88u: 계기판 1줄 4개 · 설명은 help/takeaway/think/reveal 로
     ================================================================= */
  var SK = root.SimKit;
  var DT = 1 / 600;                        // 고정 화면 시간 간격 (s)
  var SX = 240, X0 = 625, RAIL0 = 334, RAIL = RAIL0;      // 1 m = 240u, x=0 → 625u, 레일 y
  var RAILB = RAIL0;                       // R7-2: 화면 크기로 정한 레일 y — 예측 띠가 열린 동안만 RAIL 을 그 아래로 내린다(bandShift)
  var TS = 22, CS = 1;                     // R6(B7): 심플이면 캔버스 글자 28u · 수레 높이 1.5배 (물리·좌표 계산은 그대로)
  var K = 1;                               // R5(R4 b): 세로 여유가 있을 때 장면 세로 축척(수레 높이·화살표·글자) — 16:9 는 1
  var LOW = { x: 16, y: 432, w: 1218, h: 218 };   // 아래 그래프 판 (R5: 트랙 설명 아래 · 세로 여유가 있으면 장면을 키우고 남는 만큼 h 가 늘어남)
  var GX = 214;                            // 그래프 그리는 곳 왼쪽 (탭 칸 오른쪽)
  var KIND_E = { elastic: 1, mid: 0.5, stick: 0 };
  var KIND_ORDER = ['elastic', 'stick', 'mid'];
  var KIND_NAME = { elastic: '튕기기', stick: '달라붙기', mid: '중간' };
  var TAU_ORDER = [0.01, 0.05, 0.2];
  var TAU_NAME = { 0.01: '딱딱', 0.05: '보통', 0.2: '푹신' };
  var TABS = [{ id: 'p', label: '운동량' }, { id: 'f', label: '힘-시간' }, { id: 'k', label: '운동 에너지' }];

  var st = null;              // 엔진 상태
  var noMeetWarned = false;
  var drag = null;            // 수레 끌기
  var syncing = false;        // kind ↔ e 동기화 중
  var tab = 'p', seen = { p: true };

  function sx(x) { return X0 + x * SX; }
  function col(n) { return SK.color(n); }
  function fmt(v, d) { return SK.fmt(v, d); }
  function fmtF(v) { return fmt(v, v >= 100 ? 0 : 1); }
  function sgn(v, d) { var t = fmt(v, d); return (v > 0 && Number(Math.abs(v).toFixed(d)) !== 0) ? '+' + t : t; }
  function kindOfE(e) { return e >= 0.995 ? 'elastic' : e <= 0.005 ? 'stick' : 'mid'; }
  function kindLabel(e) {
    var k = kindOfE(e), name = KIND_NAME[k];
    return (k === 'mid' && Math.abs(e - 0.5) > 0.004) ? name + '(e ' + fmt(e, 2) + ')' : name;
  }
  /** R8(A7): 기록 두 개 한 줄 비교 — '충돌 종류 튕기기→달라붙기 : p 4.00→4.00 · E_k 8.00→6.00' (바뀐 값 하나 : 나중 합) */
  var CMP = [
    ['mode', '장면', function (v) { return { collide: '충돌', separate: '분리', wall: '벽' }[v] || v; }],
    ['kind', '충돌 종류', function (v) { return KIND_NAME[v] || v; }],
    ['tau', '범퍼', function (v) { return TAU_NAME[v] || v; }],
    ['m1', '$m_1$', function (v) { return fmt(v, 1); }], ['m2', '$m_2$', function (v) { return fmt(v, 1); }],
    ['v1', '$v_1$', function (v) { return sgn(+v, 1); }], ['v2', '$v_2$', function (v) { return sgn(+v, 1); }],
    ['u', '$u$', function (v) { return fmt(v, 1); }]
  ];
  function compareLine(r1, r2) {
    var a = r1.params || {}, b = r2.params || {}, ch = null;
    for (var i = 0; i < CMP.length && !ch; i++) { var c = CMP[i]; if (a[c[0]] !== undefined && String(a[c[0]]) !== String(b[c[0]])) ch = c; }
    var head = ch ? ch[1] + ' ' + ch[2](a[ch[0]]) + '→' + ch[2](b[ch[0]]) : '같은 조건';
    var va = r1.values || {}, vb = r2.values || {};
    return head + ' : $p$ ' + fmt(va.pa, 2) + '→' + fmt(vb.pa, 2) + ' · $E_k$ ' + fmt(va.ka, 2) + '→' + fmt(vb.ka, 2);
  }
  /** R5(R4 b): 16:9 보다 세로가 긴 화면 — 장면 세로 축척 K = min(1.4, hFull/h)(가로 1 m = 240u 는 그대로라 충돌 위치는 같음).
      레일은 K 만큼 커진 위쪽(수레·화살표 ≈190u)만큼 내리고, 그래프 판은 트랙 설명 아래부터 바닥까지. K = 1 이면 예전 좌표 그대로. */
  function onStageResize(view) {
    view.offsetY = 0;
    layoutScene(view);
    RAIL = RAILB;
  }
  /** R7-3(B4): 실행 전에는 그래프 판이 56u 한 줄('실행하면 그래프가 나와요')이라 남는 세로를 트랙 장면에 준다 —
      장면 세로 축척 K = 화면 크기 축척 KB 의 1.5배(들어가는 만큼). 실행하면(SK.started) 예전 배치(KB, 그래프 판 펼침) 그대로.
      가로 1 m = 240u·충돌 위치·물리 계산은 그대로(세로 그림 크기만). 장면 범위: 레일 위 ≈215u(심플 240u)·아래 ≈95u(심플 70u) × K */
  var PRE_H = 56;
  function layoutScene(view) {
    var KB = view.extra > 0 ? Math.min(1.4, view.hFull / view.h) : 1, VH = view.h + (view.extra || 0);
    if (SK.started) {
      K = KB;
      RAILB = RAIL0 + (K - 1) * 190;
      LOW.y = RAILB + 98 * K;
      LOW.h = VH - 10 - LOW.y;
      return;
    }
    var simple = !!(SK.isSimple && SK.isSimple()), up = simple ? 240 : 215, down = simple ? 70 : 95, top = 60;
    LOW.h = PRE_H; LOW.y = VH - 10 - PRE_H;
    var room = LOW.y - 16 - top;
    K = Math.max(KB, Math.min(KB * 1.5, room / (up + down)));
    RAILB = top + up * K + Math.max(0, (room - (up + down) * K) / 2);
  }

  /* ---------- 1. 뼈대 ---------- */
  SK.init({
    slug: 'collision-momentum',
    title: '일차원 충돌과 운동량 보존',
    subject: '물리학 (일반 선택)',
    unit: '(1) 힘과 에너지',
    standards: ['12물리01-03'],
    today: '같은 질량의 두 수레가 부딪치면 어떻게 될까?',   // R7(B6): 허브 카드 질문과 같은 문장 — 트럭 vs 승용차는 카드 ③·설명 6장
    // R2: 띠 문장 25자 안팎 · 실행은 하단 ▶ 실행 하나 · '기록하기 버튼' 은 위쪽 띠에 있음
    stepTasks: [
      { text: function () {
        if (SK.prediction && SK.prediction.pending) return '아래 ▶ 실행을 눌러 예측을 확인해요';
        // R7 학생점검(D2): 질문이 열려 있지 않은데 '답을 먼저 골라요' 라고 하지 않는다
        if (!(SK.predicting && SK.predicting())) return '[예측하기]를 눌러 질문을 열어요';
        return '먼저 결과를 예측해요 — 보기를 하나 골라요';   // R8(A18): 5종 같은 문장
      } },
      { text: function () {
        if (SK.running) return st && st.slow < 0.999 ? '부딪치는 순간이라 느리게 보여 줘요' : '부딪치는 순간은 저절로 느려져요';
        // R6(B5): 자동 슬로 모션(×1/40)은 멈춘 것처럼 보여 이때 Space·▶ 를 다시 누르면 t ≈ 0.40 s(부딪치는 순간)에서 선다 — 사용자가 멈춘 것(버그 아님)
        if (SK.started && !SK.finished) { syncBadge(); return st && (st.phase === 'hit' || st.slow < 0.999) ? '부딪치는 순간에서 멈췄어요 — ▶ 이어서' : '멈췄어요 — 아래 ▶ 이어서 실행'; }
        if (SK.finished && SK.canRecord()) return '그래프 탭 3개를 보고 위쪽 기록하기 버튼으로 저장해요';
        if (SK.finished) return '값 하나만 바꿔 다시 실행해요';
        return '아래 ▶ 실행을 누르고 지켜봐요';
      } },
      { text: function () {
        if (SK.records.length < 2) return '기록이 2개 있어야 비교해요 (지금 ' + SK.records.length + '개)';
        return null;   // R8(A7): 기록 2개 이상 — 공통 틀이 cfg.compareLine 한 줄 비교를 띄운다
      } },
      { text: '오른쪽 질문에 답하며 정리해요' }
    ],
    // R2: 카드를 누르면 값이 먼저 바뀐다 → 예측 창이 떠 있는 동안 결과 층(그래프 판)을 숨긴다
    onPredictOpen: function () { SK.requestRender(); },
    onPredictClose: function () { SK.requestRender(); },
    formulaDefault: 'momentum',   // R7 학생점검(A3): 카드가 없을 때 [ƒ 식] = 설명 2장
    dt: DT,
    stageFit: true,
    stageH: 660,
    onResize: onStageResize,
    reset: function (p) {
      st = CM.init(p);
      noMeetWarned = false;
      drag = null;
      seen = {}; seen[tab] = true; markBadges(false);
      syncPanel();
    },
    step: function (dt, p) {
      if (st.end) return;
      if (st.t === 0 && !st.P.meet && !noMeetWarned) {
        noMeetWarned = true;
        SK.notice(st.P.mode === 'wall' ? '벽 쪽(+)으로 움직여야 부딪쳐요' : 'A가 B보다 빨라야 부딪쳐요', 'warn', 3000);
      }
      CM.step(st, dt, !!p.autoSlow);
      SK.time = st.t - dt;    // SimKit 이 곧 +dt 하므로 → SimKit.time = 물리 시간
      // finish(msg) 는 띠 문장으로 간다 (25자 안팎)
      if (st.end === 'done') { markBadges(true); SK.finish('끝났어요 — 위쪽 기록하기 버튼으로 저장해요'); }
      else if (st.end === 'nomeet') SK.finish(st.P.mode === 'wall' ? '벽에 닿지 않았어요 — 처음 속도를 +로' : '만나지 않았어요 — A를 B보다 빠르게');
      else if (st.end === 'offscreen') SK.finish('부딪치기 전에 트랙 밖으로 나갔어요');
    },
    render: render,
    capture: capture,
    save: function () { return CM.copy(st); },
    load: function (s) { st = CM.copy(s); },
    // R7-3(B6b): 무대 위 공통 칩은 2개 이하('튕기기 · 실행 전') — 범퍼·용수철은 statusNote(⚙ 설정·실험 고르기 머리 한 줄)
    status: function (p) {
      var s = p.mode === 'separate' ? ['분리(반동)'] : p.mode === 'wall' ? ['벽에 부딪치기', kindLabel(p.e)] : [kindLabel(p.e)];
      // R8(D5): 멈춘 시각은 공통 상태 칩이 이미 보여 준다('॥ 0.42 s') — 여기서는 더하지 않음
      return s;
    },
    compareLine: compareLine,
    statusNote: function (p) {
      if (p.mode === 'separate') return '눌린 용수철이 밀어내요 · 마찰 없는 트랙';
      return '범퍼 ' + TAU_NAME[p.tau] + '(부딪쳐 있는 시간 $Δt$ ' + p.tau + ' s) · 마찰 없는 트랙';
    },
    // R6(B3): 심플 모드 — 12물리01-03 핵심(충돌 전후 운동량 합 보존, 비탄성에서 K 감소). v₂·e·범퍼·장면은 더 보기(패널)
    // R9(§4-3): 단계 — 예전 cfg.simple(m₁·m₂·v₁ + 충돌 종류, p·k·판정)은 이 basic 으로 바뀜(?simple=1 = 초급)
    //   초급 = 질량 두 개 + 충돌 종류, A 처음 속도는 카드가 +2 로 정함(슬라이더 숨김·값 보존), 충돌 장면만,
    //          계기 = '움직임의 양(운동량)' 막대(숫자 없음, 실행 뒤 '후'), 그래프 판 = 두 수레 속도 화살 전/후, 카드 ①②③ 쉬운 말
    //   중급 = R8 그대로(카드 ①~⑥) · 고급 = + 반발 계수·B 처음 속도·범퍼를 패널로, 에너지 손실·충격량·최대 힘 계기, 카드 ⑦(e 0→1)
    levels: {
      basic: {
        task: function (p) { return p.mode === 'collide' ? '질량을 바꿔 부딪쳐 보고 움직임의 양을 비교해요' : '▶ 실행하고 움직임의 양이 그대로인지 봐요'; },
        params: ['m1', 'm2'], situation: ['kind'],
        meters: [{ key: 'pbar', label: '움직임의 양(운동량)', plain: true, node: function () { return pbarNode(); } }],
        presets: [0, 1, 2], predict: 'button'
      },
      mid: { presets: [0, 1, 2, 3, 4, 5] },
      adv: { expose: ['e', 'v2', 'tau'] }
    }
  });
  SK.el.band.style.gridTemplateColumns = 'minmax(0, 1fr)';   // 그래프는 실험 화면 아래 칸이라 띠는 계기판 한 칸(R7 core 배치와 겹치지 않음 — 칸 안 격자는 .cm-band CSS)
  SK.el.band.classList.add('cm-band');
  if (SK.onMode) SK.onMode(function () { syncPanel(); });   // R7: 심플 ↔ 자세히 — 충돌 종류·범퍼 자리 다시 맞춤
  // R9(§1-6): 단계가 바뀌면(처음 한 번 포함) 범퍼·v₂ 자리, 고급 계기 칸, 막대 다시 — 값·기록·재생 위치는 그대로
  if (SK.onLevel) SK.onLevel(function () { syncPanel(); syncAdvMeters(); if (pbar) pbar.key = ''; if (SK.refreshThinks) SK.refreshThinks(); SK.requestRender(); SK.update(); });

  /* ---------- 2. 수치 바꾸기 — 핵심 3개만 (질량 A·B, A 속도 / 분리: 포탄 속력) ---------- */
  SK.addVar('values', { key: 'm1', label: '수레 A 질량', symbol: 'm_1', unit: 'kg', min: 0.5, max: 3, step: 0.5, value: 1, decimals: 1, precision: 2, ticks: [0.5, 1, 2, 3] });
  SK.addVar('values', { key: 'm2', label: '수레 B 질량', symbol: 'm_2', unit: 'kg', min: 0.5, max: 3, step: 0.5, value: 1, decimals: 1, precision: 2, ticks: [0.5, 1, 2, 3] });
  SK.addVar('values', { key: 'v1', label: 'A 처음 속도', symbol: 'v_1', unit: 'm/s', min: -3, max: 3, step: 0.5, value: 2, decimals: 1, precision: 2, ticks: [-3, 0, 3],
    hint: '+ 오른쪽(→) · − 왼쪽(←) · 수레를 끌어도 돼요' });   // R7: 한 줄(패널 = 수치 3개 + 상황 1줄)
  SK.addVar('values', { key: 'u', label: '포탄(B) 나가는 속력', symbol: 'u', unit: 'm/s', min: 0, max: 6, step: 0.5, value: 4, decimals: 1, precision: 2, ticks: [0, 2, 4, 6] });

  /* ---------- 3. 상황 바꾸기 ---------- */
  // R7: 실험 장면(충돌·분리·벽)은 카드 ①~⑤ 가 정해 주므로 ⚙ '더 많은 설정'으로 — 패널 상황 줄은 충돌 종류(벽 장면이면 + 범퍼)
  SK.addChoice('deep', {
    key: 'mode', label: '실험 장면', style: 'cards', apply: 'restart',
    options: [
      { value: 'collide', label: '충돌', sub: '두 수레가 부딪쳐요' },
      { value: 'separate', label: '분리(반동)', sub: '붙은 두 수레가 밀어내요' },
      { value: 'wall', label: '벽', sub: '벽에 부딪쳐요 (에어백)' }
    ],
    value: 'collide',
    onChange: function () { syncPanel(); }
  });
  SK.addChoice('situation', {
    key: 'kind', label: '충돌 종류', apply: 'restart',
    options: [
      { value: 'elastic', label: '튕기기', sub: '탄성 충돌' },
      { value: 'stick', label: '달라붙기', sub: '완전 비탄성' },
      { value: 'mid', label: '중간', sub: '비탄성' }
    ],
    value: 'elastic',
    onChange: function (v) {
      if (syncing) return;
      syncing = true; SK.set('e', KIND_E[v]); syncing = false;
    }
  });
  // R7: 범퍼는 벽 장면(카드 ⑤ 에어백)에서만 패널(수치 칸 맨 아래)에, 다른 장면에서는 ⚙ '더 많은 설정'에(syncPanel 이 노드를 옮김 — 값·키 P 그대로)
  SK.addChoice('deep', {
    key: 'tau', label: '범퍼 (부딪쳐 있는 시간)', apply: 'restart',
    hint: '푹신할수록 두 물체가 맞닿아 있는 시간이 길어요.',
    options: [
      { value: 0.01, label: '딱딱', sub: '0.01 s' },
      { value: 0.05, label: '보통', sub: '0.05 s' },
      { value: 0.2, label: '푹신', sub: '0.2 s' }
    ],
    value: 0.05
  });

  // R7: 충돌 종류는 수치 칸 맨 아래 한 줄로(상황 묶음 머리 한 줄만큼 패널이 짧아져 1280×720 에서 스크롤 없음) — 노드·값·키 E 그대로
  SK.panel('values').appendChild(SK.controls.kind.el);
  Array.prototype.forEach.call(SK.controls.kind.el.querySelectorAll('.seg__opt'), function (b, i) { b.title = ['탄성 충돌 (E)', '완전 비탄성 충돌 (E)', '비탄성 충돌 (E)'][i]; });

  /* ---------- 4. 화면에 표시하기 ---------- */
  SK.addToggle('tools', { key: 'autoSlow', label: '부딪칠 때 자동 슬로 모션', value: true });

  /* ---------- 5. 더 많은 설정 ---------- */
  SK.addVar('deep', { key: 'v2', label: 'B 처음 속도', symbol: 'v_2', unit: 'm/s', min: -3, max: 3, step: 0.5, value: 0, decimals: 1, precision: 2, ticks: [-3, 0, 3],
    hint: '마주 보고 부딪치게 하려면 − 로 바꿔요(실험 ③ 트럭 vs 승용차).' });
  SK.addVar('deep', {
    key: 'e', label: '반발 계수', symbol: 'e', unit: '', min: 0, max: 1, step: 0.1, value: 1, decimals: 1, precision: 2,
    ticks: [0, 0.5, 1], record: false,
    hint: '심화(교육과정 밖): 1 = 튕기기, 0 = 달라붙기.',
    onChange: function (v) {
      if (syncing) return;
      var k = kindOfE(v);
      if (k !== SK.get('kind')) { syncing = true; SK.set('kind', k); syncing = false; }
    }
  });
  SK.addToggle('deep', { key: 'showCM', label: '질량 중심 함께 보기 (심화)', value: false, record: false });

  // R7: 패널에서 숨긴 풀이 글은 칸에 올리면 보이게(title)
  SK.controls.v1.el.title = '+ 는 오른쪽(→), − 는 왼쪽(←)이에요. 실험 화면에서 수레를 끌었다 놓아도 정할 수 있어요.';
  SK.controls.tau.el.title = '푹신할수록 두 물체가 맞닿아 있는 시간이 길어요.';
  // 속도 슬라이더: 가운데 0 굵은 눈금 + ← / →
  ['v1', 'v2'].forEach(function (k) {
    var c = SK.controls[k];
    c.el.classList.add('cm-vel');
    var tk = c.el.querySelectorAll('.var__ticks span');
    // R4: ← → 글자 대신 SVG 아이콘
    if (tk.length === 3) {
      SK.setText(tk[0], '← −3'); tk[1].textContent = '0'; tk[1].className = 'cm-zero';
      tk[2].textContent = '+3 '; var ar = SK.icon('arrow-right', { cls: 'ico--trail' }); if (ar) tk[2].appendChild(ar); else tk[2].textContent = '+3 →';
    }
  });

  /** 장면에 따라 보이는 변수 바꾸기 (패널에 보이는 값 기준) */
  function syncPanel() {
    var m = SK.get('mode');
    function show(k, on) { SK.controls[k].el.style.display = on ? '' : 'none'; }
    show('m2', m !== 'wall');
    show('v1', m !== 'separate');
    show('v2', m === 'collide');
    show('u', m === 'separate');
    SK.controls.kind.enable(m !== 'separate');
    // R7: 분리(반동)에는 충돌 종류가 없어 패널에서 빼고(키 E 는 알림 그대로), 범퍼는 벽 장면이면 패널 상황 줄로
    var simpleNow = !!(SK.isSimple && SK.isSimple());
    show('kind', simpleNow || m !== 'separate');   // 심플 레일에서는 늘 보임(분리면 잠김)
    var tauEl = SK.controls.tau.el, tauHome = m === 'wall' ? SK.panel('values') : SK.panel('deep');
    // R9: 고급에서 패널 '고급 설정'으로 올라간(SK.exposeControl) 범퍼·B 처음 속도는 장면에 따라 옮기지 않는다
    if (tauEl.parentNode !== tauHome && !tauEl.classList.contains('is-exposed')) { if (m === 'wall') tauHome.appendChild(tauEl); else tauHome.insertBefore(tauEl, SK.controls.mode.el.nextSibling); }
    var sitSec = SK.panel('situation').closest('.panel-sec');
    if (sitSec && !sitSec.hidden) sitSec.hidden = true;   // 상황 묶음은 비어 있다(장면 = ⚙, 충돌 종류·벽 범퍼 = 수치 칸 맨 아래)
    SK.controls.m1.el.querySelector('.var__label').firstChild.textContent = m === 'separate' ? '대포(A) 질량' : '수레 A 질량';
    SK.controls.m2.el.querySelector('.var__label').firstChild.textContent = m === 'separate' ? '포탄(B) 질량' : '수레 B 질량';
    function mq(sel) { return meters.el.querySelector(sel) || (meters.moreEl && meters.moreEl.querySelector(sel)); }   // R7: v₁·v₂ 칸은 [수치 더 보기] 안
    var la = mq('[data-key="v1"] .meter__label'), lb = mq('[data-key="v2"] .meter__label');
    if (la && la.firstChild) la.firstChild.textContent = m === 'separate' ? '대포 속도' : 'A 속도';
    if (lb && lb.firstChild) lb.firstChild.textContent = m === 'separate' ? '포탄 속도' : m === 'wall' ? '벽 (고정)' : 'B 속도';
    var lp = mq('[data-key="p"] .meter__label'), lk = mq('[data-key="k"] .meter__label');
    if (lp && lp.lastChild) lp.lastChild.textContent = m === 'wall' ? ' 전→후' : ' 합 전→후';
    if (lk && lk.lastChild) lk.lastChild.textContent = m === 'wall' ? '에너지 전→후' : '에너지 합 전→후';
    // R8(D3): B 처음 속도 v₂ 는 카드 ⑥(마주 오다 부딪치기)을 골랐을 때만 패널(수치 칸)에 — 다른 때는 ⚙ 더 많은 설정
    var v2El = SK.controls.v2.el, on6 = face6 && m === 'collide';
    var v2Home = on6 ? SK.panel('values') : SK.panel('deep');
    if (v2El.parentNode !== v2Home && !v2El.classList.contains('is-exposed')) {
      if (on6) v2Home.insertBefore(v2El, SK.controls.v1.el.nextSibling);
      else v2Home.insertBefore(v2El, SK.controls.e.el);
    }
    SK.requestRender();
  }
  var CARD_FACE = 5;   // 카드 ⑥ 번호(0부터)
  var face6 = false;   // 카드 ⑥ 을 골랐나(값을 만져 카드 표시가 풀려도 v₂ 칸이 손 밑에서 사라지지 않게 — 다른 카드를 고르면 false)

  /* ---------- 6. 하단 띠: 계기판 1줄 4개 (실행 전에는 빈 상태 한 줄) ---------- */
  // R7(B4): 핵심 = 운동량 합·운동 에너지 합(전 → 후) + 판정(심플 측정 칸과 같은 key) · 두 수레 속도는 [수치 더 보기 ▸]
  var meters = SK.meters(null, [
    { key: 'v1', label: 'A 속도', symbol: 'v_1', unit: 'm/s', q: 'velocity', size: 'md' },
    { key: 'v2', label: 'B 속도', symbol: 'v_2', unit: 'm/s', q: 'velocity', size: 'md' },
    { key: 'p', label: '{{운동량}} 합 전→후', unit: 'kg·m/s', size: 'md', core: true },   // R8(D6): 짧은 이름(1024 한 줄)
    { key: 'k', label: '에너지 합 전→후', unit: 'J', q: 'energy-k', size: 'md', core: true },
    { key: 'verdict', label: '판정', unit: '', core: true },
    // R9(§4-3): 고급 전용 — 에너지 손실(띠로 올림)·충격량·최대 힘([수치 더 보기]). 초급·중급에서는 칸째 숨김
    { key: 'loss', label: '에너지 손실', unit: 'J', q: 'energy-k', size: 'md' },
    { key: 'J', label: '충격량 $I$', unit: 'N·s', size: 'md' },
    { key: 'fmax', label: '최대 힘', unit: 'N', q: 'force', size: 'md' }
  ]);
  var ADV_METERS = ['loss', 'J', 'fmax'];
  function advMeterEl(k) { return (meters.moreEl && meters.moreEl.querySelector('[data-key="' + k + '"]')) || meters.el.querySelector('[data-key="' + k + '"]'); }
  /** 고급이면 에너지 손실 칸을 띠(판정 앞)로, 충격량·최대 힘은 [수치 더 보기] 안에 보이게. 아니면 셋 다 숨기고 제자리 */
  function syncAdvMeters() {
    var adv = SK.level && SK.level() === 'adv';
    ADV_METERS.forEach(function (k) { var el = advMeterEl(k); if (el) el.hidden = !adv; });
    // 1100px 이하(1024 가로·820 세로)는 띠에 칸을 더하면 '2.00 → 2.00 kg·m/s' 가 잘린다 → 에너지 손실도 [수치 더 보기] 안(맨 앞)에
    var loss = advMeterEl('loss'), vd = meters.el.querySelector('[data-key="verdict"]'), inBand = adv && window.innerWidth > 1100;
    if (!loss) return;
    if (inBand && loss.parentNode !== meters.el && vd) { meters.el.insertBefore(loss, vd); loss.classList.add('is-core'); }
    else if (!inBand && loss.parentNode === meters.el && meters.moreEl) { meters.moreEl.insertBefore(loss, meters.moreEl.firstChild); loss.classList.remove('is-core'); }
    meters.el.classList.toggle('cm-meters--adv', inBand);
  }
  window.addEventListener('resize', function () { if (SK.level && SK.level() === 'adv') syncAdvMeters(); });
  function updateAdvMeters(P) {
    if (!(SK.level && SK.level() === 'adv')) return;
    var done = st.phase === 'post' && P.meet, lost = P.kb - P.ka;
    meters.update({
      loss: !done ? '부딪친 뒤' : lost >= -0.005 ? fmt(Math.max(0, lost), 2) : '+' + fmt(-lost, 2),
      J: done && P.mode !== 'separate' ? fmt(P.J, 2) : '–',
      fmax: done && P.mode !== 'separate' ? fmtF(P.Fmax) : '–'
    });
  }
  var meterEmpty = SK.empty(SK.el.meters, '속도·운동량(= 질량 × 속도) 값');
  /* R9(§4-3): 초급 측정 칸 '움직임의 양(운동량)' — 두 수레 합을 막대 길이로만(숫자 없음). '후' 줄은 부딪친 뒤에만(실행 전 '실행 후 보여요') */
  var pbar = null;
  function pbarNode() {
    if (pbar) return pbar.el;
    function row(name) {
      var fill = SK.h('span', { class: 'cm-pbar__fill' });
      var track = SK.h('span', { class: 'cm-pbar__track' }, [SK.h('span', { class: 'cm-pbar__zero' }), fill]);
      var note = SK.h('span', { class: 'cm-pbar__note' });
      return { el: SK.h('span', { class: 'cm-pbar__row' }, [SK.h('span', { class: 'cm-pbar__name', text: name }), track, note]), fill: fill, track: track, note: note };
    }
    var a = row('전'), b = row('후');
    pbar = { el: SK.h('span', { class: 'cm-pbar', role: 'img', 'aria-label': '부딪치기 전과 뒤, 두 수레 움직임의 양을 더한 막대' }, [a.el, b.el]), a: a, b: b, key: '' };
    return pbar.el;
  }
  /** pos = 두 값 모두 0 이상이면 왼쪽 끝이 0(막대 전체 폭), 하나라도 − 면 가운데가 0(오른쪽 + · 왼쪽 −) */
  function setPbar(r, v, mx, pos) {
    var w = Math.abs(v) / mx * (pos ? 100 : 50);
    r.fill.style.width = w.toFixed(2) + '%';
    r.fill.style.left = (pos ? 0 : v >= 0 ? 50 : 50 - w).toFixed(2) + '%';
  }
  function updatePbar(P) {
    if (!pbar) return;
    var done = st.phase === 'post' && P.meet, wait = !done || SK.predicting(), same = done && Math.abs(P.pa - P.pb) < 1e-6;
    var key = [P.pb, done ? P.pa : '-', st.phase, st.end || '', wait, P.mode].join('|');
    if (pbar.key === key) return;
    pbar.key = key;
    var mx = Math.max(0.5, Math.abs(P.pb), done ? Math.abs(P.pa) : 0);
    var pos = P.pb >= -1e-9 && (!done || P.pa >= -1e-9);
    pbar.pos = pos; pbar.el.classList.toggle('is-pos', pos);
    setPbar(pbar.a, P.pb, mx, pos);
    pbar.a.note.textContent = Math.abs(P.pb) < 1e-6 ? '없음' : '';
    pbar.b.track.hidden = wait;
    if (wait) {
      pbar.b.note.textContent = st.phase === 'hit' ? '부딪치는 중' : st.end && !P.meet ? '부딪치지 않았어요' : '실행 후 보여요';
      pbar.b.note.className = 'cm-pbar__note is-wait';
    } else {
      setPbar(pbar.b, P.pa, mx, pos);
      pbar.b.note.textContent = P.mode === 'wall' ? '벽 때문에 바뀌어요' : same ? '그대로예요' : '달라졌어요';
      pbar.b.note.className = 'cm-pbar__note' + (same ? ' is-ok' : '');
    }
  }   // R7(B6)
  // R5: 흐린 예시('A 처음 +2 → 부딪친 뒤 0')는 카드 ① 예측의 정답이라 지움 — 빈 상태는 안내 한 줄만

  /* ---------- 7. 기록 표 (비교 단계 큰 판) ---------- */
  /* priority 1 = 작은 표·큰 판(핵심: p 보존?·K 보존?·운동량 합 전→후 — 좁은 화면에서도 O/X 가 먼저 보이게) · 2 = 큰 판 · 3 = '열 더 보기'에서만
     (어느 값을 바꿨는지는 큰 판 위 '바꾼 값: …' 줄이 자동으로 알려 줌) */
  var rule = buildRuleCard();
  SK.recordTable(null, {
    columns: [
      // R7 학생점검(D4): 정리 '오늘 기록' 칩도 이 이름을 쓴다 → '운동량 보존 ○ · 운동 에너지 보존 ○'(O·E_k 평문 대신 말 + ○)
      { key: 'pOK', label: '운동량 보존', unit: '', from: 'value', priority: 1 },
      { key: 'kOK', label: '운동 에너지 보존', unit: '', from: 'value', priority: 1 },
      { key: 'pAB', label: '$p$ 합 전→후', unit: 'kg·m/s', from: 'value', priority: 1, text: function (r) { return fmt(r.values.pb, 2) + ' → ' + fmt(r.values.pa, 2); } },
      { key: 'kAB', label: '$E_k$ 합 전→후', unit: 'J', from: 'value', priority: 2, text: function (r) { return fmt(r.values.kb, 2) + ' → ' + fmt(r.values.ka, 2); } },
      { key: 'kind', label: '충돌 종류', unit: '', from: 'param', priority: 2, text: function (r) { return r.params.mode === 'separate' ? '–' : SK.valueText('kind', r.params.kind); } },
      { key: 'tau', label: '범퍼', unit: '', from: 'param', priority: 2 },
      { key: 'v1f', label: 'v₁′', unit: 'm/s', decimals: 2, from: 'value', priority: 2 },
      { key: 'v2f', label: 'v₂′', unit: 'm/s', decimals: 2, from: 'value', priority: 2 },
      { key: 'J', label: '충격량 $I$', unit: 'N·s', decimals: 2, from: 'value', priority: 2 },
      { key: 'fmax', label: '최대 힘', unit: 'N', decimals: 1, from: 'value', priority: 2 },
      { key: 'mode', label: '장면', unit: '', from: 'param', priority: 3 },
      { key: 'm1', label: 'm₁', unit: 'kg', from: 'param', priority: 3 },
      { key: 'm2', label: 'm₂', unit: 'kg', from: 'param', priority: 3, text: function (r) { return r.params.mode === 'wall' ? '–' : SK.valueText('m2', r.params.m2); } },
      { key: 'v1', label: 'v₁', unit: 'm/s', from: 'param', priority: 3, text: function (r) { return r.params.mode === 'separate' ? '0' : SK.valueText('v1', r.params.v1); } },
      { key: 'v2u', label: 'v₂(u)', unit: 'm/s', from: 'value', priority: 3 },
      { key: 'e', label: 'e', unit: '', decimals: 1, from: 'value', priority: 3 }
    ],
    extra: rule      // 비교 단계: 표 아래 '규칙 확인하기' 카드 (공식 자리 — R2 C3)
  });
  /* 숨겨진 변수는 text 로 '–'·'0' (분리 모드에 숨은 v₁ = 2.0 이 찍혀 '대포가 처음에 움직였다'로 읽히는 것을 막음) */

  function capture(p) {
    if (!st) return null;
    var P = st.P, done = st.phase === 'post';
    var cv = CM.curve(P);
    var v2u = P.mode === 'separate' ? 'u ' + fmt(P.u, 1) : P.mode === 'wall' ? '벽' : fmt(P.v2, 1);
    var pOK = '–', kOK = '–';
    if (done) {
      // 표 칸이 좁아도 O/X 가 먼저 보이게 짧게 (벽 = 바깥 힘이 있어 수레만의 운동량은 바뀜)
      pOK = P.mode === 'wall' ? '× 벽' : Math.abs(P.pa - P.pb) < 1e-6 ? '○' : '×';
      var dk = P.ka - P.kb;
      kOK = dk < -0.005 ? '× 줄어듦' : dk > 0.005 ? '× 늘어남' : '○';
    }
    return {
      series: done ? { fa: cv.fa, fb: cv.fb } : {},
      values: {
        v2u: v2u, tau: P.tau,
        v1f: done ? P.v1f : st.vA, v2f: P.mode === 'wall' ? '–' : (done ? P.v2f : st.vB),
        pb: P.pb, pa: done ? P.pa : CM.pNow(st), kb: P.kb, ka: done ? P.ka : CM.kNow(st),
        pOK: pOK, kOK: kOK,
        J: done ? P.J : 0, fmax: done ? P.Fmax : 0, e: P.mode === 'separate' ? '–' : P.e
      }
    };
  }

  /* 비교 단계: 기록 표 아래 '규칙 확인하기' (충돌 종류별 O/X) — recordTable({extra}) 로 붙임 */
  function buildRuleCard() {
    var card = SK.h('div', { class: 'cm-rule' }, [
      SK.h('p', { class: 'cm-rule__q', text: '충돌 종류가 바뀌면 운동량 합과 운동 에너지 합은 어떻게 될까요?' }),
      SK.h('p', { class: 'cm-rule__hint', text: '튕기기 한 번, 달라붙기 한 번을 기록하면 차이가 잘 보여요.' })
    ]);
    SK.reveal(card,
      '<table class="cm-ox"><thead><tr><th>장면</th><th>운동량 합</th><th>운동 에너지 합</th></tr></thead><tbody>' +
      '<tr><th>튕기기</th><td><b>O</b> 그대로</td><td><b>O</b> 그대로</td></tr>' +
      '<tr><th>중간</th><td><b>O</b> 그대로</td><td><b>X</b> 줄어듦 (열·소리)</td></tr>' +
      '<tr><th>달라붙기</th><td><b>O</b> 그대로</td><td><b>X</b> 가장 많이 줄어듦</td></tr>' +
      '<tr><th>분리(반동)</th><td><b>O</b> 0 그대로</td><td><b>X</b> 늘어남 (용수철 에너지)</td></tr>' +
      '<tr><th>벽 (수레만)</th><td><b>X</b> 벽이 바깥에서 힘을 줌</td><td>튕기면 O, 달라붙으면 X</td></tr>' +
      '</tbody></table>' +
      '<p>운동량 합은 <b>바깥에서 힘이 작용하지 않으면 언제나</b> 그대로예요. 운동 에너지 합은 <b>튕기기(탄성 충돌)</b>에서만 그대로예요.</p>',
      '규칙 확인하기');
    return card;
  }

  /* ---------- 8. 실험 카드 (이름 12자 이내 · changes = 카드 아래 줄 · 예측 answer/why) ----------
     R2: 카드를 누르면 값이 바로 바뀌고(패널 숫자) 예측 창이 뜬다. 선택지는 한 줄 · 판정 문장에 그대로 들어감 */
  SK.setPresets([
    {
      name: '같은 질량끼리 튕기면', tag: '탐구 재현', changes: '1 kg 두 대 · 튕기기', formulaCh: 'momentum',
      change: '충돌 종류: 튕기기', fixed: 'm₁ = m₂ = 1 kg · v₁ = +2, v₂ = 0 m/s · 범퍼 보통',
      values: { mode: 'collide', kind: 'elastic', e: 1, tau: 0.05, m1: 1, m2: 1, v1: 2, v2: 0 },
      predict: { question: '같은 질량의 A(2 m/s)가 멈춘 B와 부딪혀 튕겨요. 어떻게 될까?',
        choices: ['B만 2 m/s로', '둘 다 1 m/s로', 'A가 뒤로 튕김'],   // R6(B4): 14자 이하 → 한 줄 3칸(창이 낮아져 수레·트랙이 보임)
        answer: 1, why: '질량이 같고 튕기면 두 수레가 속도를 서로 바꿔요. 운동량 합(2 kg·m/s)과 운동 에너지 합(2 J)이 둘 다 그대로인 답은 이것뿐이에요. ‘둘 다 1 m/s’는 운동 에너지가 1 J로 줄어드는 달라붙기의 결과예요.' },
      // R9(§4-3): 초급 — 같은 실험, 정답 ①(A 가 멈추고 B 가 2 m/s 로 = 기존 ① 과 같은 결과)
      basic: { name: '같은 질량끼리 튕기기', changes: '같은 수레 두 대 · 튕기기',
        q: '같은 질량의 두 수레가 부딪쳐 튕기면, 굴러가던 A는 어떻게 될까?', choices: ['멈춘다', '뒤로 되튄다', '그대로 간다'], answer: 1,
        why: '질량이 같은 두 수레가 튕기면 A는 멈추고, 멈춰 있던 B가 A의 빠르기 그대로 굴러가요. 두 수레의 움직임의 양을 더한 값은 부딪치기 전과 같아요.' },
      onApply: function () { face6 = false; setTab('p'); setTimeout(syncPanel, 0); }
    },
    {
      // R8(D3): 부제는 바꾼 것 하나만 — '설명 9장 질문 6' 안내(교사용)는 수업 안내 서랍 교사 메모로, 마주 오는 충돌은 카드 ⑥
      name: '달라붙으면', tag: '탐구 재현', changes: '튕기기 → 달라붙기', formulaCh: 'momentum',
      change: '충돌 종류만: 튕기기 → 달라붙기', fixed: 'm₁ = m₂ = 1 kg · v₁ = +2, v₂ = 0 m/s · 범퍼 보통',
      values: { mode: 'collide', kind: 'stick', e: 0, tau: 0.05, m1: 1, m2: 1, v1: 2, v2: 0 },
      predict: { question: '이번엔 두 수레가 부딪쳐 달라붙어요. 부딪친 뒤 운동량의 합은?', choices: ['줄어들어요', '그대로 2 kg·m/s', '늘어나요'],
        info: '끝나면 그래프의 ‘운동 에너지’ 탭도 함께 봐요.',
        answer: 2, why: '두 수레가 주고받는 힘은 크기가 같고 방향이 반대라서, A가 잃은 운동량을 B가 그대로 얻어요. 줄어드는 것은 운동 에너지(2 J → 1 J)예요.' },
      basic: { name: '달라붙기', changes: '튕기기 → 달라붙기',
        q: '이번엔 두 수레가 부딪쳐 달라붙어요. 부딪친 뒤 두 수레의 움직임의 양을 더하면?', choices: ['줄어들어요', '그대로예요', '늘어나요'], answer: 2,
        why: '두 수레는 서로 같은 크기로 밀어요. 그래서 A가 잃은 만큼 B가 얻어 더한 값은 그대로예요. 대신 소리와 열이 나면서 움직임의 에너지는 줄어요.' },
      onApply: function () { face6 = false; setTab('p'); setTimeout(syncPanel, 0); }
    },
    {
      name: '트럭 vs 승용차', tag: '작용·반작용', changes: '3배 무거운 트럭과 정면으로', formulaCh: 'action-reaction',
      change: '트럭 A 3 kg·+2 m/s, 승용차 B 1 kg·−2 m/s', fixed: '튕기기 · 범퍼 보통',
      values: { mode: 'collide', kind: 'elastic', e: 1, tau: 0.05, m1: 3, m2: 1, v1: 2, v2: -2 },
      predict: { question: '3배 무거운 트럭과 승용차가 정면충돌! 누가 더 큰 힘을 받을까?', choices: ['트럭이 더 큰 힘', '승용차가 더 큰 힘', '두 힘의 크기가 같아요'],
        info: '끝나면 그래프의 ‘힘-시간’ 탭에서 두 곡선을 비교해요.',
        answer: 3, why: '서로 미는 두 힘은 질량과 관계없이 크기가 같고 방향만 반대예요(작용·반작용). 그래서 받는 충격량도 같아요. 일반 규칙은 속도 변화 $Δv$ = {{frac:충격량|질량}} — 가벼운 쪽 속도가 크게 바뀌어요. 이 문제는 질량비가 3 : 1이라 승용차의 속도 변화가 3배예요(트럭 −2 m/s, 승용차 +6 m/s).' },
      basic: { name: '트럭과 승용차', changes: '무거운 트럭과 정면으로',
        q: '무거운 트럭과 가벼운 승용차가 정면으로 부딪쳐요. 누가 더 큰 힘을 받을까?', choices: ['트럭', '승용차', '둘 다 같아요'], answer: 3,
        why: '서로 미는 두 힘은 크기가 같고 방향만 반대예요. 그런데 승용차는 가벼워서 빠르기가 훨씬 크게 바뀌어요. 그래서 승용차 쪽이 더 위험해요.' },
      onApply: function () { face6 = false; setTab('f'); setTimeout(syncPanel, 0); }
    },
    {
      name: '대포를 쏘면', tag: '발사체', changes: '멈춘 대포가 포탄을 쏨', formulaCh: 'conserve',
      change: '포탄 나가는 속력 u = 4 m/s', fixed: '대포 A 2 kg · 포탄 B 0.5 kg · 처음엔 둘 다 정지',
      values: { mode: 'separate', tau: 0.05, m1: 2, m2: 0.5, u: 4 },
      predict: { question: '멈춘 대포(2 kg)가 포탄(0.5 kg)을 4 m/s로 쏘면 대포는?', choices: ['가만히 있어요', '뒤로 1 m/s', '뒤로 4 m/s'],
        answer: 2, why: '처음 운동량 합이 0이라 나중에도 0이에요. 포탄이 0.5 × 4 = +2 kg·m/s를 얻으니 대포는 −2 kg·m/s, 질량이 2 kg이라 뒤로 1 m/s예요. 로켓도 같은 원리예요(가스를 뒤로 → 로켓이 앞으로).' },
      onApply: function () { face6 = false; setTab('p'); setTimeout(syncPanel, 0); }
    },
    {
      name: '에어백은 무엇을 줄일까', tag: '교통안전', changes: '벽에 부딪침 · 범퍼 딱딱 → 푹신', formulaCh: 'impulse',
      change: '범퍼: 딱딱 0.01 s → 푹신 0.2 s', fixed: '벽 · 달라붙기 · 수레 1 kg, +2 m/s',
      values: { mode: 'wall', kind: 'stick', e: 0, tau: 0.01, m1: 1, v1: 2 },
      predict: { question: '딱딱한 범퍼를 푹신한 범퍼(에어백)로 바꾸면 무엇이 달라질까?',
        choices: ['운동량 변화가 작아져요', '시간이 길어 힘이 작아져요', '운동량이 사라져요'],
        info: '딱딱 범퍼로 한 번, ‘푹신’ 범퍼로 한 번 기록해 비교해요.',
        answer: 2, why: '멈출 때까지의 운동량 변화(충격량, 힘-시간 그래프의 넓이)는 2 N·s로 같아요. 부딪쳐 있는 시간이 0.01 s → 0.2 s로 20배 길어지니, 평균 힘은 200 N → 10 N으로 1/20이 돼요. 운동량은 사라지지 않고 벽(지구)으로 넘어가요.' },
      onApply: function () { face6 = false; setTab('f'); setTimeout(syncPanel, 0); }
    },
    {
      // R8(D3/G2): 카드 ⑥ — 설명 9장 질문 6(+2 와 −2 가 달라붙으면?)의 [해 보기]가 여는 카드. 값은 그 질문과 같다(v₂ = −2, 달라붙기)
      name: '마주 오다 부딪치기', tag: '탐구 재현', changes: 'A +2, B −2 · 달라붙기', formulaCh: 'momentum',
      change: 'B 처음 속도 0 → −2 m/s (마주 옴)', fixed: 'm₁ = m₂ = 1 kg · v₁ = +2 m/s · 달라붙기 · 범퍼 보통',
      values: { mode: 'collide', kind: 'stick', e: 0, tau: 0.05, m1: 1, m2: 1, v1: 2, v2: -2 },
      predict: { question: '같은 질량의 A(+2 m/s)와 B(−2 m/s)가 마주 오다 부딪쳐요. 붙으면 어디로 갈까? 튕기면?',
        choices: ['붙으면 둘 다 멈춰요', '붙으면 오른쪽(+)으로', '붙으면 왼쪽(−)으로'],
        info: '튕기면 어떻게 될지는 실행 뒤 충돌 종류를 ‘튕기기’로 바꿔 확인해요(E 키). B 처음 속도 $v_2$ 는 패널에 있어요.',
        answer: 1, why: '처음 운동량 합이 1×(+2) + 1×(−2) = 0이라, 붙은 뒤에도 0 — 둘 다 멈춰요. 운동 에너지 4 J는 모두 열·소리로 바뀌어요. 튕기면 두 수레가 속도를 서로 바꿔 A −2, B +2 m/s로 되돌아가요(합은 그대로 0).' },
      onApply: function () { face6 = true; setTab('p'); setTimeout(syncPanel, 0); }
    },
    {
      // R9(§4-3): 고급 카드 ⑦ — 반발 계수 e 를 0(달라붙기)과 1(튕기기) 사이로. e 0.5 · 1 kg 두 대 · +2 → A +0.5, B +1.5 m/s, 손실 0.75 J
      name: '반발 계수 e 바꾸기', tag: '심화', changes: 'e 0 → 0.5 → 1 (중간 충돌)', formulaCh: 'bounce-stick',
      change: '반발 계수 e = 0.5 (튕기기와 달라붙기 사이)', fixed: 'm₁ = m₂ = 1 kg · v₁ = +2, v₂ = 0 m/s · 범퍼 보통',
      values: { mode: 'collide', kind: 'mid', e: 0.5, tau: 0.05, m1: 1, m2: 1, v1: 2, v2: 0 },
      predict: { question: '반발 계수 $e$ = 0.5 로 부딪치면(1 kg 두 대, A +2 m/s) 부딪친 뒤 두 수레의 속도는?',
        choices: ['A 0, B +2 m/s', 'A +0.5, B +1.5 m/s', 'A +1, B +1 m/s'],
        info: '실행 뒤 패널의 반발 계수 $e$ 를 0 과 1 로도 바꿔 에너지 손실을 비교해요.',
        answer: 2, why: '운동량 합 2 kg·m/s 그대로 → $v_1′$ + $v_2′$ = 2, 멀어지는 빠르기 = $e$ × 다가가던 빠르기 → $v_2′$ − $v_1′$ = 0.5 × 2 = 1. 두 식을 풀면 A +0.5, B +1.5 m/s. 운동 에너지는 2 J → 1.25 J 로 0.75 J 가 열·소리로 바뀌어요. $e$ = 1 이면 손실 0, $e$ = 0 이면 손실 1 J(가장 큼).' },
      onApply: function () { face6 = false; setTab('k'); setTimeout(syncPanel, 0); }
    }
  ]);


  /* ---------- 9. 이 실험 전용 키 (도움말 › 단축키 탭에만 적음) ---------- */
  SK.onKey(function (e) {
    if (e.repeat) return false;
    // R8(D3): 카드 ⑥ — 공통 틀의 숫자 키는 1~5 라서 6 은 여기서(심플은 시트에 있는 카드만: ①②③)
    if ((e.code === 'Digit6' || e.code === 'Numpad6') && !e.shiftKey) {
      if (!SK.presetAllowed(CARD_FACE)) SK.notice('6번 카드는 중급부터 나와요', 'info');   // R9: '자세히 모드' → 단계 이름
      else SK.applyPreset(CARD_FACE, { noConfirm: !!(SK.isSimple && SK.isSimple()) });
      return true;
    }
    if (e.code === 'KeyE') {
      if (SK.get('mode') === 'separate') { SK.notice('분리(반동) 장면에는 충돌 종류가 없어요', 'info'); return true; }
      var i = KIND_ORDER.indexOf(SK.get('kind'));
      var k = KIND_ORDER[(i + 1) % KIND_ORDER.length];
      SK.set('kind', k);
      SK.notice('충돌 종류: ' + KIND_NAME[k], 'info', 1500);
      return true;
    }
    if (e.code === 'KeyP') {
      var j = TAU_ORDER.indexOf(SK.get('tau'));
      var t = TAU_ORDER[(j + 1) % TAU_ORDER.length];
      SK.set('tau', t);
      SK.notice('범퍼: ' + TAU_NAME[t] + ' (' + t + ' s)', 'info', 1500);
      return true;
    }
    if (e.code === 'KeyX') {
      SK.set('autoSlow', !SK.get('autoSlow'));
      SK.notice('자동 슬로 모션 ' + (SK.get('autoSlow') ? '켬' : '끔'), 'info', 1500);
      return true;
    }
    return false;
  });

  /* ---------- 10. 실험 화면 위 HTML: 슬로 모션 배지 · 만나지 않음 안내 · 그래프 탭 ---------- */
  var badgeEl = SK.h('div', { class: 'cm-badge', hidden: true });
  var warnEl = SK.h('div', { class: 'cm-warn', hidden: true });
  SK.el.cornerTR.appendChild(badgeEl);
  SK.el.cornerTR.appendChild(warnEl);

  var lowerEl = SK.h('div', { class: 'cm-lower' });
  var tabBox = SK.h('div', { class: 'cm-tabs', role: 'tablist', 'aria-label': '그래프 고르기' });
  var tabBtns = {};
  TABS.forEach(function (t) {
    // R2: '● 보기' 칩 대신 탭 이름 옆 같은 자리에 표시 하나 — 안 본 탭 ●(8u 점) · 본 탭 ✓
    var mark = SK.h('span', { class: 'cm-tab__mark', 'aria-hidden': 'true' });
    var b = SK.h('button', { class: 'cm-tab', type: 'button', role: 'tab', 'aria-selected': 'false' }, [SK.h('span', { class: 'cm-tab__name', text: t.label }), mark]);
    b._mark = mark;
    b.addEventListener('click', function (e) { if (e.detail > 0) b.blur(); setTab(t.id); });
    tabBtns[t.id] = b; tabBox.appendChild(b);
  });
  lowerEl.appendChild(SK.h('span', { class: 'cm-tabs__label', text: '그래프' }));
  lowerEl.appendChild(tabBox);
  SK.el.stage.appendChild(lowerEl);
  var lowerEmpty = SK.empty(lowerEl, '그래프');
  var lowerEmptyS = SK.empty(lowerEl, '그래프');   // R6(B7) 심플
  // R7-3(B4): 실행 전 그래프 판 = 56u 한 줄 '▶ 실행하면 그래프가 나와요'
  [lowerEmpty, lowerEmptyS].forEach(function (e) { e.el.textContent = ''; e.el.appendChild(SK.iconify(SK.h('span', { text: '▶ 실행하면 그래프가 나와요' }))); });
  lowerEmptyS.show(false);
  if (SK.onMode) SK.onMode(function () { SK.requestRender(); SK.update(); });
  function setTab(id) {
    tab = id; seen[id] = true;
    for (var k in tabBtns) tabBtns[k].setAttribute('aria-selected', String(k === id));
    markBadges(badgesOn);
    SK.requestRender();
  }
  /** 실행이 끝나면 탭 이름 옆에: 아직 안 본 탭 ● · 본 탭 ✓ (실행 전·중에는 없음) */
  var badgesOn = false;
  function markBadges(on) {
    badgesOn = !!on;
    for (var k in tabBtns) {
      var m = tabBtns[k]._mark, state = !on ? '' : seen[k] ? 'seen' : 'new';
      if (m.getAttribute('data-state') !== state) {
        m.setAttribute('data-state', state);
        m.textContent = '';
        if (state === 'seen') m.appendChild(SK.icon('check', { size: 'sm' }) || document.createTextNode('✓'));   // R4: ✓ → 아이콘
        tabBtns[k].title = state === 'new' ? '아직 안 본 그래프예요' : state === 'seen' ? '본 그래프예요' : '';
      }
    }
  }
  setTab('p');
  /* R7-2(B6): 식 팝업 기호 → 실험 화면 강조 — 그래프 판의 탭을 그 그래프로 바꾸고 판 테두리를 깜빡인다
       'bar:p' 운동량 막대 · 'stage:force' 힘-시간(충격량 I = 넓이) · 'bar:k' 운동 에너지 막대 */
  function flashLower(id, ms) {
    setTab(id);
    [lowerEl, tabBtns[id]].forEach(function (el) {
      if (!el || el.offsetParent === null) return;
      el.classList.remove('is-flash-long'); void el.offsetWidth; el.classList.add('is-flash-long');
      clearTimeout(el._cmFlash); el._cmFlash = setTimeout(function () { el.classList.remove('is-flash-long'); }, ms || 1500);
    });
  }
  SK.addFlashTarget('bar:p', function (ms) { flashLower('p', ms); });
  SK.addFlashTarget('stage:force', function (ms) { flashLower('f', ms); });
  SK.addFlashTarget('bar:k', function (ms) { flashLower('k', ms); });
  var lowerBox = '';
  function placeLower(view) {
    var s = view.scale, key = [view.ox, view.oy, s, view.offsetY, LOW.y, LOW.h].join(',');
    if (key === lowerBox) return;
    lowerBox = key;
    var at = view.toPx(LOW.x, LOW.y);   // R4: offsetY 반영
    lowerEl.style.left = at.x + 'px';
    lowerEl.style.top = at.y + 'px';
    lowerEl.style.width = (LOW.w * s) + 'px';
    lowerEl.style.height = (LOW.h * s) + 'px';
  }

  /* ---------- 11. 수레 끌기 → 처음 속도 (0.5 m/s 단위) ---------- */
  (function installDrag() {
    var cv = SK.view.canvas;
    function cartAt(pt) {
      if (!st) return null;
      var list = [['A', st.xA, st.P.m1]];
      if (st.xB !== null) list.push(['B', st.xB, st.P.m2]);
      for (var i = 0; i < list.length; i++) {
        var x = sx(list[i][1]), hgt = CM.cartH(list[i][2]) * CS;
        if (pt.x > x - CM.HW * SX - 10 && pt.x < x + CM.HW * SX + 10 && pt.y > RAIL - 18 * K - hgt * K - 20 && pt.y < RAIL + 10 * K) return list[i][0];
      }
      return null;
    }
    cv.addEventListener('pointerdown', function (e) {
      var pt = SK.view.toLogical(e), who = cartAt(pt);
      if (!who) return;
      var mode = SK.params.mode;
      if (mode === 'separate') { SK.notice('분리 장면은 포탄 속력 칸으로 정해요', 'info'); return; }
      if (mode === 'wall' && who === 'B') return;
      if (SK.running) { SK.notice('실행 중에는 끌 수 없어요', 'info'); return; }
      if (SK.started) { SK.reset(); pt = SK.view.toLogical(e); }   // 끝났거나 멈춘 뒤: 처음 위치로 돌리고 바로 끌기
      var x0 = who === 'A' ? st.xA : st.xB;
      drag = { who: who, id: e.pointerId, x: x0, x0: x0, grab: (pt.x - sx(x0)) / SX, samples: [[performance.now(), x0]] };
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
      e.preventDefault();
    });
    cv.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var pt = SK.view.toLogical(e);
      var x = (pt.x - X0) / SX - drag.grab;
      if (drag.who === 'A') x = Math.min(x, (st.xB !== null ? st.xB - CM.D0 : CM.XW - CM.HW - CM.BUMP));
      else x = Math.max(x, st.xA + CM.D0);
      drag.x = Math.max(-1.95, Math.min(1.95, x));
      var now = performance.now();
      drag.samples.push([now, drag.x]);
      while (drag.samples.length > 2 && now - drag.samples[0][0] > 120) drag.samples.shift();
      SK.requestRender();
    });
    function end(e) {
      if (!drag || e.pointerId !== drag.id) return;
      var d = drag; drag = null;
      var a = d.samples[0], b = d.samples[d.samples.length - 1];
      var moved = Math.abs(d.x - d.x0);
      SK.requestRender();
      if (moved < 0.03) return;            // 살짝 누른 것은 무시
      var dt = (b[0] - a[0]) / 1000;
      var v = (dt > 0.008 && performance.now() - b[0] < 150) ? (b[1] - a[1]) / dt : 0;
      v = Math.max(-3, Math.min(3, Math.round(v * 2) / 2));
      if (Object.is(v, -0)) v = 0;
      SK.set(d.who === 'A' ? 'v1' : 'v2', v);
      SK.notice((d.who === 'A' ? '$v_1$' : '$v_2$') + ' = ' + sgn(v, 1) + ' m/s로 정했어요', 'ok', 2500);
    }
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
  })();

  /* ---------- 12. 설명 도우미: 도움말(이렇게 해요 · 개념 · 용어) ----------
     R2 개념 카드 구조: summary(한 줄) → plain(쉬운 말) → example → figure(SVG 글) → [식 보기](formula + symbols) → [왜 그럴까?](why) → live */
  /** R4: SVG 안 물리 기호 — HTML .sym 과 같은 수식 글꼴 이탤릭 */
  function S(ch) { return '<tspan class="sym" style="font-family:var(--font-math);font-style:italic;font-weight:400">' + ch + '</tspan>'; }
  function svgFig(inner, vb) { return '<div class="cm-fig"><svg viewBox="' + vb + '" role="img" aria-hidden="true">' + inner + '</svg></div>'; }
  function sine(x0, w, hgt, base) {
    var s = 'M' + x0 + ' ' + base;
    for (var i = 0; i <= 30; i++) s += ' L' + (x0 + w * i / 30).toFixed(1) + ' ' + (base - hgt * Math.sin(Math.PI * i / 30)).toFixed(1);
    return s;
  }
  var ARW = '<defs><marker id="cmh" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" style="fill:context-stroke"/></marker></defs>';
  function cart(x, y, w, h, fill, label) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="6" style="fill:var(' + fill + ')"/>' +
      '<circle cx="' + (x + w * 0.25) + '" cy="' + (y + h + 6) + '" r="6" style="fill:var(--color-ink)"/><circle cx="' + (x + w * 0.75) + '" cy="' + (y + h + 6) + '" r="6" style="fill:var(--color-ink)"/>' +
      '<text x="' + (x + w / 2) + '" y="' + (y + h / 2 + 6) + '" text-anchor="middle" class="cm-fig__inv">' + label + '</text>';
  }
  function arrowSvg(x1, y1, x2, y2, c) { return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" style="stroke:var(' + c + ');stroke-width:5" marker-end="url(#cmh)"/>'; }
  var FIG_P = svgFig(ARW +
    cart(20, 14, 80, 40, '--color-rec-1', '1 kg') + arrowSvg(108, 34, 190, 34, '--color-q-velocity') +
    '<text x="150" y="22" text-anchor="middle" class="cm-fig__v">+2 m/s</text><text x="220" y="40">' + S('p') + ' = 1 × (+2) = <tspan class="cm-fig__b">+2 kg·m/s</tspan></text>' +
    cart(110, 84, 80, 40, '--color-rec-1', '1 kg') + arrowSvg(102, 104, 24, 104, '--color-q-velocity') +
    '<text x="62" y="92" text-anchor="middle" class="cm-fig__v">−2 m/s</text><text x="220" y="110">' + S('p') + ' = 1 × (−2) = <tspan class="cm-fig__b">−2 kg·m/s</tspan></text>', '0 0 560 140');
  var FIG_J = svgFig(
    '<line x1="40" y1="130" x2="540" y2="130" style="stroke:var(--color-line-strong);stroke-width:2"/><line x1="40" y1="130" x2="40" y2="8" style="stroke:var(--color-line-strong);stroke-width:2"/>' +
    '<text x="30" y="20" text-anchor="end">' + S('F') + '</text><text x="540" y="150" text-anchor="end">시간 ' + S('t') + '</text>' +
    '<path d="' + sine(60, 40, 110, 130) + ' Z" style="fill:var(--color-rec-1);fill-opacity:.35;stroke:var(--color-rec-1);stroke-width:3"/>' +
    '<path d="' + sine(150, 200, 22, 130) + ' Z" style="fill:var(--color-rec-2);fill-opacity:.35;stroke:var(--color-rec-2);stroke-width:3;stroke-dasharray:8 5"/>' +
    '<text x="108" y="28">딱딱: 짧고 큰 힘</text><text x="250" y="96" text-anchor="middle">푹신(에어백): 길고 작은 힘</text>' +
    '<text x="540" y="40" text-anchor="end" class="cm-fig__b">두 넓이(충격량)는 같아요</text>', '0 0 560 156');
  var FIG_CONS = svgFig(
    '<text x="20" y="22" class="cm-fig__b">처음</text><text x="300" y="22" class="cm-fig__b">나중(달라붙음)</text>' +
    '<text x="20" y="52">A</text><rect x="60" y="38" width="160" height="22" style="fill:var(--color-rec-1)"/><text x="226" y="55">2</text>' +
    '<text x="20" y="84">B</text><text x="60" y="84">0</text>' +
    '<text x="20" y="116" class="cm-fig__b">합</text><rect x="60" y="102" width="160" height="22" style="fill:var(--color-ink)"/><text x="226" y="119" class="cm-fig__b">2</text>' +
    '<text x="300" y="52">A</text><rect x="340" y="38" width="80" height="22" style="fill:var(--color-rec-1)"/><text x="426" y="55">1</text>' +
    '<text x="300" y="84">B</text><rect x="340" y="70" width="80" height="22" style="fill:var(--color-rec-2)"/><text x="426" y="87">1</text>' +
    '<text x="300" y="116" class="cm-fig__b">합</text><rect x="340" y="102" width="160" height="22" style="fill:var(--color-ink)"/><text x="506" y="119" class="cm-fig__b">2</text>' +
    '<text x="280" y="150" text-anchor="middle">단위 kg·m/s · A가 잃은 1만큼 B가 얻어요</text>', '0 0 560 160');
  var FIG_AR = svgFig(ARW +
    cart(130, 40, 140, 64, '--color-rec-1', '트럭 3 kg') + cart(276, 64, 70, 40, '--color-rec-2', '1 kg') +
    arrowSvg(240, 26, 140, 26, '--color-q-force') + arrowSvg(310, 26, 410, 26, '--color-q-force') +
    '<text x="130" y="16" class="cm-fig__f">트럭이 받는 힘 ' + S('F') + '</text><text x="420" y="16" text-anchor="end" class="cm-fig__f">승용차가 받는 힘 ' + S('F') + '</text>' +
    '<text x="280" y="138" text-anchor="middle" class="cm-fig__b">크기는 같고 방향만 반대</text>', '0 0 560 146');
  // 운동 에너지: 튕기기(그대로) vs 달라붙기(절반이 열·소리로) — 나중 막대는 테두리 + 점무늬(색약)
  var FIG_K = svgFig(
    '<defs><pattern id="cmdot" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="1.6" style="fill:var(--color-ink)"/></pattern></defs>' +
    '<text x="20" y="22" class="cm-fig__b">튕기기</text>' +
    '<text x="20" y="50">처음</text><rect x="90" y="36" width="240" height="22" style="fill:var(--color-q-energy-k)"/><text x="340" y="53">2 J</text>' +
    '<text x="20" y="80">나중</text><rect x="90" y="66" width="240" height="22" style="fill:var(--color-q-energy-k);stroke:var(--color-ink);stroke-width:2"/><rect x="90" y="66" width="240" height="22" style="fill:url(#cmdot)"/><text x="340" y="83">2 J 그대로</text>' +
    '<text x="20" y="122" class="cm-fig__b">달라붙기</text>' +
    '<text x="20" y="150">처음</text><rect x="90" y="136" width="240" height="22" style="fill:var(--color-q-energy-k)"/><text x="340" y="153">2 J</text>' +
    '<text x="20" y="180">나중</text><rect x="90" y="166" width="120" height="22" style="fill:var(--color-q-energy-k);stroke:var(--color-ink);stroke-width:2"/><rect x="90" y="166" width="120" height="22" style="fill:url(#cmdot)"/>' +
    '<rect x="210" y="166" width="120" height="22" style="fill:none;stroke:var(--color-q-energy-heat);stroke-width:2;stroke-dasharray:6 4"/><text x="340" y="183">1 J + 열·소리 1 J</text>', '0 0 560 196');

  function mistakes(list) {
    return SK.h('ul', { class: 'cm-mis' }, list.map(function (m) {
      // R4: ✗ ✓ 글자 대신 SVG 아이콘 (SK.iconify)
      return SK.h('li', null, [SK.h('p', { class: 'cm-mis__x' }, [SK.iconify(SK.h('b', { text: '✗ 오해 ' })), m[0]]), SK.h('p', { class: 'cm-mis__o' }, [SK.iconify(SK.h('b', { text: '✓ 바르게 ' })), m[1]])]);
    }));
  }
  function liveP(p) {
    if (p.mode === 'separate') return '처음엔 둘 다 정지 → 운동량 합 0 kg·m/s';
    var s = 'A: ' + fmt(p.m1, 1) + ' × (' + sgn(+p.v1, 1) + ') = ' + sgn(p.m1 * p.v1, 2) + ' kg·m/s';
    if (p.mode === 'collide') s += ' · B: ' + fmt(p.m2, 1) + ' × (' + sgn(+p.v2, 1) + ') = ' + sgn(p.m2 * p.v2, 2) + ' kg·m/s';
    return s;
  }
  SK.help({
    how: [
      '아래 [실험 고르기 ▾]에서 실험을 고르면 값이 바뀌고 예측 질문이 나와요. 답을 고르고 예측하기를 눌러요.',
      '아래 ▶ 실행을 눌러요. 부딪치는 순간은 저절로 느려져서(슬로 모션) 힘 화살표 한 쌍이 보여요.',
      '끝나면 실험 화면 아래 그래프 탭(운동량 · 힘-시간 · 운동 에너지)을 차례로 눌러요. 아직 안 본 탭 옆에는 ● 점, 본 탭에는 ✓가 붙어요.',
      '위쪽 띠의 기록하기 버튼으로 저장해요. 그다음 충돌 종류나 질량 하나만 바꿔 다시 실행하고 또 기록해요.',
      '비교 단계 표에서 운동량 합과 운동 에너지 합이 어떻게 달라졌는지 찾고, 표 아래 ‘규칙 확인하기’로 답을 맞혀 봐요.',
      '수레를 마우스(손가락)로 끌었다 놓으면, 놓는 순간의 빠르기가 처음 속도가 돼요.'
    ],
    concepts: [
      { title: '운동량', summary: '운동량 = 질량 × 속도',
        plain: '무거울수록, 빠를수록 운동량이 커요.\n속도처럼 방향이 있어서 이 실험에서는 오른쪽(→)을 +, 왼쪽(←)을 −로 써요.',
        example: '같은 1 kg 수레라도 오른쪽으로 2 m/s면 +2 kg·m/s, 왼쪽으로 2 m/s면 −2 kg·m/s예요. 둘을 더하면 0이에요.',
        figure: FIG_P,
        formula: 'p = m v',
        symbols: [{ s: 'p', meaning: '운동량', unit: 'kg·m/s' }, { s: 'm', meaning: '질량', unit: 'kg' }, { s: 'v', meaning: '속도 (오른쪽 +, 왼쪽 −)', unit: 'm/s' }],
        why: '같은 속도라도 무거운 수레를 멈추기가 더 어렵고, 같은 수레라도 빠를수록 멈추기 어려워요.\n이 ‘멈추기 어려운 정도’를 질량과 속도를 함께 넣어 나타낸 양이 운동량이에요. 방향이 있으므로 더할 때 부호(+, −)를 꼭 넣어요.',
        live: liveP },
      { title: '충격량', summary: '부딪친 힘 × 시간 = 운동량 변화',
        plain: '힘이 얼마나 컸는지와 얼마 동안 작용했는지를 함께 따진 양이에요. 힘-시간 그래프 아래 넓이와 같아요.\n$F$ = $ma$를 시간에 대해 모으면 $FΔt$ = $mΔv$ — 그래서 충격량 = 운동량 변화예요.',
        example: '1 kg 수레(+2 m/s)가 벽에 달라붙어 멈추면 운동량 변화는 0 − 2 = −2 kg·m/s예요. 딱딱 범퍼(0.01 s)든 푹신 범퍼(0.2 s)든 충격량 크기는 2 N·s로 같고, 평균 힘은 200 N과 10 N이에요.',
        figure: FIG_J,
        formula: 'I = F Δt = Δp = m v′ − m v',
        symbols: [{ s: 'I', meaning: '충격량', unit: 'N·s (= kg·m/s)' }, { s: 'F', meaning: '힘 (시간에 따라 바뀌면 평균 힘)', unit: 'N' }, { s: 'Δt', meaning: '힘이 작용한 시간', unit: 's' }, { s: 'Δp', meaning: '운동량 변화 = 나중 운동량 − 처음 운동량', unit: 'kg·m/s' }, { s: 'v, v′', meaning: '부딪치기 전 속도, 부딪친 뒤 속도', unit: 'm/s' }],
        why: '가속도는 $a$ = {{frac:$Δv$|$Δt$}}이므로 $F$ = $ma$ = {{frac:$mΔv$|$Δt$}}예요. 양쪽에 $Δt$를 곱하면 $FΔt$ = $mΔv$가 돼요.\n멈추는 데 필요한 운동량 변화는 처음 운동량으로 정해져 있어요. 시간을 20배로 늘리면 같은 넓이를 만들기 위해 힘이 1/20로 줄어요. 에어백·체육관 매트·야구 글러브가 모두 이 원리예요.',
        live: function (p) { if (!st || !st.P.meet) return '부딪치지 않으면 충격량은 0이에요'; return '평균 힘 $F$ = {{frac:충격량 ' + fmt(st.P.J, 2) + ' N·s|시간 ' + p.tau + ' s}} = ' + fmtF(st.P.Favg) + ' N (최대 힘 ' + fmtF(st.P.Fmax) + ' N)'; } },
      { title: '운동량 보존', summary: '둘이 주고받아도 합은 그대로',
        plain: '두 수레가 부딪칠 때 바깥에서 작용하는 힘(마찰 등)이 없으면, 운동량의 합은 부딪치기 전과 후가 같아요.\n한쪽이 잃은 만큼 다른 쪽이 얻기 때문이에요.',
        example: '1 kg(+2 m/s)가 멈춘 1 kg에 달라붙으면 1×2 + 1×0 = (1+1)×$v\'$이라서 $v\'$ = +1 m/s예요.',
        figure: FIG_CONS,
        formula: 'm₁v₁ + m₂v₂ = m₁v₁′ + m₂v₂′',
        symbols: [{ s: 'm₁, m₂', meaning: 'A, B의 질량', unit: 'kg' }, { s: 'v₁, v₂', meaning: '부딪치기 전 속도', unit: 'm/s' }, { s: 'v₁′, v₂′', meaning: '부딪친 뒤 속도 (′는 ‘나중’이라는 뜻)', unit: 'm/s' }],
        why: '부딪치는 동안 A가 B를 미는 힘과 B가 A를 미는 힘은 크기가 같고 방향이 반대이며, 작용한 시간도 같아요.\n그래서 두 수레가 받은 충격량은 크기가 같고 방향이 반대예요. A가 잃은 운동량을 B가 그대로 얻으니 합이 변하지 않아요.\n벽 장면에서는 벽(지구)이 바깥에서 힘을 주므로 수레만의 운동량은 바뀌어요.',
        live: function () {
          if (!st) return '';
          var P = st.P;
          if (P.mode === 'wall') return '벽 장면: 벽이 바깥에서 힘을 주므로 수레만의 운동량은 ' + sgn(P.pb, 2) + ' → ' + sgn(P.pa, 2) + ' kg·m/s로 바뀌어요';
          return fmt(P.m1, 1) + '×(' + sgn(P.v1, 1) + ') + ' + fmt(P.m2, 1) + '×(' + sgn(P.v2, 1) + ') = ' + fmt(P.m1, 1) + '×(' + sgn(P.v1f, 2) + ') + ' + fmt(P.m2, 1) + '×(' + sgn(P.v2f, 2) + ') → ' + sgn(P.pb, 2) + ' = ' + sgn(P.pa, 2) + ' kg·m/s';
        } },
      { title: '작용·반작용', summary: '내가 민 만큼 나도 밀려요',
        plain: 'A가 B를 미는 힘과 B가 A를 미는 힘은 언제나 크기가 같고 방향이 반대예요.\n질량이 달라도, 한쪽이 멈춰 있어도 마찬가지예요. 두 힘은 서로 다른 물체에 작용해요.',
        example: '트럭(3 kg, +2 m/s)과 승용차(1 kg, −2 m/s)가 튕기면 둘 다 6 N·s의 충격량을 받아요. 속도 변화는 트럭 −2 m/s, 승용차 +6 m/s예요.',
        figure: FIG_AR,
        formula: 'F(A가 받는 힘) = − F(B가 받는 힘)',
        symbols: [{ s: 'F', meaning: '부딪치는 동안 주고받는 힘', unit: 'N' }, { s: '−', meaning: '방향이 반대라는 뜻', unit: '–' }],
        why: '힘은 두 물체가 ‘주고받는’ 것이라 한쪽만 힘을 받는 일은 없어요(뉴턴 운동 제3법칙).\n일반 규칙: 받은 충격량이 같으면 속도 변화 $Δv$ = {{frac:충격량|질량}}이라, 가벼운 쪽이 크게 바뀌어요. 그래서 ‘가벼운 쪽이 더 큰 힘을 받았다’고 착각하기 쉬워요.' },
      { title: '운동 에너지와 충돌 종류', summary: '튕기면 Eₖ 보존, 붙으면 Eₖ 손실',
        plain: '운동 에너지는 움직이는 물체가 가진 에너지예요. 운동량과 달리 방향이 없고 늘 0 이상이에요.\n튕기기(탄성 충돌)에서는 운동 에너지 합이 그대로예요. 달라붙기·중간(비탄성 충돌)에서는 일부가 열·소리·찌그러짐으로 바뀌어 줄어요. 운동량 합은 어느 충돌이든 그대로예요.',
        example: '1 kg(+2 m/s)가 멈춘 1 kg에 달라붙으면 처음 ½×1×2² = 2 J, 나중 ½×2×1² = 1 J — 1 J이 열과 소리로 바뀌어요.',
        figure: FIG_K,
        formula: 'Eₖ = ½ m v²',
        symbols: [{ s: 'Eₖ', meaning: '운동 에너지', unit: 'J' }, { s: 'm', meaning: '질량', unit: 'kg' }, { s: 'v', meaning: '속력 (제곱하므로 방향과 관계없음)', unit: 'm/s' }],
        why: '에너지는 사라지지 않고 다른 형태로 바뀌어요. 범퍼가 찌그러지며 데워지고 소리가 나요.\n운동량은 방향이 있어서 +와 −가 서로 지워질 수 있지만, 운동 에너지는 늘 + 값이라 지워지지 않아요. 그래서 운동량 합은 그대로여도 운동 에너지 합은 줄 수 있어요.\n반대로 분리(반동)에서는 눌린 용수철에 있던 에너지가 운동 에너지로 바뀌어 합이 늘어나요.',
        live: function () {
          if (!st) return ''; var P = st.P;
          // R8(D1): 부딪치는 동안(접촉 중)에는 모자란 몫이 용수철(범퍼)에 저장돼 있어요 — 열·소리는 끝난 뒤에만
          if (st.phase === 'hit') return '지금 충돌 중 · 용수철에 저장 ' + fmt(Math.max(0, springNow()), 2) + ' J';
          return '처음 ' + fmt(P.kb, 2) + ' J → 나중 ' + fmt(P.ka, 2) + ' J' + (P.kb - P.ka > 0.005 ? ' (열·소리로 ' + fmt(P.kb - P.ka, 2) + ' J)' : P.ka - P.kb > 0.005 ? ' (용수철 에너지에서 ' + fmt(P.ka - P.kb, 2) + ' J)' : ' (그대로)');
        } },
      { title: '흔한 오해 바로잡기', summary: '자주 헷갈리는 6가지',
        plain: mistakes([
          ['무거운 트럭이 승용차에 더 큰 힘을 준다.', '두 힘의 크기는 같아요. 승용차가 더 위험한 건 질량이 작아 속도 변화가 크기 때문이에요.'],
          ['멈춰 있던 물체는 힘을 주지 않는다.', '부딪치는 순간 똑같은 크기로 되밀어요. 그래서 움직이던 A도 느려져요.'],
          ['에어백은 충격량(운동량 변화)을 줄인다.', '멈출 때까지의 충격량은 같아요. 부딪쳐 있는 시간을 늘려 힘을 줄여요.'],
          ['운동량이 보존되면 운동 에너지도 보존된다.', '달라붙는 충돌에서는 운동량만 보존되고 운동 에너지는 줄어요. 둘은 서로 다른 양이에요.'],
          ['대포를 쏘면 운동량이 새로 생긴다.', '포탄(+)과 대포(−)의 운동량은 크기가 같고 방향이 반대라서 합은 처음처럼 0이에요.'],
          ['운동량은 빠르기(속력)만 보면 된다.', '방향이 있어요. 오른쪽 +2와 왼쪽 −2를 더하면 0이에요.']
        ]) }
    ],
    terms: {
      '운동량': { def: '질량 × 속도(p = mv). 방향이 있어요. 단위 kg·m/s', short: '질량 × 속도', alias: ['p'] },
      '충격량': { def: '힘 × 작용 시간(I = FΔt) = 운동량의 변화량. 힘-시간 그래프의 넓이. 단위 N·s', short: '힘 × 시간 = 운동량 변화', alias: ['I', 'J'] },
      '운동 에너지': { def: '움직이는 물체의 에너지 Eₖ = ½mv². 방향이 없어요. 단위 J', short: '움직이는 물체의 에너지', alias: ['Eₖ', 'K'] },
      '운동량 보존': { def: '바깥 힘이 없으면 부딪치기 전과 후의 운동량 합이 같다는 법칙', short: '운동량 합이 그대로' },
      '작용·반작용': { def: '두 물체가 서로 주고받는 힘은 크기가 같고 방향이 반대라는 법칙(뉴턴 운동 제3법칙)', short: '주고받는 힘은 크기 같고 방향 반대' },
      '탄성 충돌': { def: '튕기기. 운동량도, 운동 에너지도 그대로인 충돌', short: '튕기기', alias: ['튕기기'] },
      '비탄성 충돌': { def: '달라붙기·중간. 운동량은 그대로지만 운동 에너지 일부가 열·소리로 바뀌는 충돌', short: '달라붙기·중간', alias: ['달라붙기'] },
      '범퍼': { def: '수레 앞의 완충 장치. 딱딱할수록 부딪쳐 있는 시간이 짧고(0.01 s), 푹신할수록 길어요(0.2 s)', short: '부딪치는 시간을 정하는 완충 장치' },
      '슬로 모션': { def: '부딪치는 아주 짧은 순간을 천천히 보여 주는 것. 물리 결과는 그대로예요', short: '천천히 보여 주기' },
      '반동': { def: '정지한 물체가 한 부분을 밀어낼 때 나머지가 반대 방향으로 움직이는 것(대포, 로켓)', short: '밀어낸 반대쪽으로 밀림' },
      '반발 계수': { def: '(심화) {{frac:부딪친 뒤 멀어지는 빠르기|다가가던 빠르기}}. 1이면 튕기기, 0이면 달라붙기', short: '튕기는 정도(0~1)', alias: ['e'] },
      '질량 중심': { def: '(심화) 질량으로 가중 평균한 위치. 바깥 힘이 없으면 충돌 전후로 같은 빠르기로 움직여요', short: '질량으로 평균 낸 위치' }
    },
    keys: [['E', '충돌 종류 바꾸기 (튕기기 → 달라붙기 → 중간)'], ['P', '범퍼 바꾸기 (딱딱 → 보통 → 푹신)'], ['X', '자동 슬로 모션 켜기 / 끄기']]
  });

  /* 실행이 끝나면 패널 맨 위 '이번 실험 결과' 카드 — {line: 한 줄, more: 왜 그럴까? 안} (수치는 이번 실행 값) */
  /** R9(§4-3): 초급 결과 해설 — 기호·부호 합·벡터 없이 '~했어요' */
  function basicTakeaway(P) {
    if (P.mode === 'separate') return { line: '쏘기 전에도 뒤에도 움직임의 양을 더하면 0이에요.', lesson: 'momentum',
      more: '포탄이 앞으로 나간 만큼 대포가 뒤로 밀려요. 포탄이 가벼워서 더 빠르게, 대포는 무거워서 느리게 움직여요.' };
    if (P.mode === 'wall') return { line: '범퍼가 푹신할수록 수레가 받는 힘이 작아요.', lesson: 'momentum',
      more: '수레가 멈추는 것은 같지만, 푹신하면 멈추는 데 시간이 오래 걸려서 한꺼번에 받는 힘이 작아져요. 에어백도 같은 까닭이에요.' };
    var lost = P.kb - P.ka, same = Math.abs(P.m1 - P.m2) < 1e-9;
    var more = '두 수레는 부딪치는 동안 같은 크기로 서로 밀어요. 그래서 A가 잃은 움직임의 양을 B가 그대로 얻어, 더한 값은 부딪치기 전과 같아요.';
    if (lost > 0.005) more += ' 달라붙거나 덜 튕기면 소리와 열이 나면서 움직임의 에너지는 줄어요.';
    else more += ' 잘 튕기면 움직임의 에너지도 거의 그대로 남아요.';
    if (!same) more += ' 질량이 작은 수레일수록 빠르기가 더 크게 바뀌어요.';
    return { line: lost > 0.005 ? '움직임의 양을 더한 값은 그대로, 에너지는 줄었어요.' : '움직임의 양을 더한 값이 그대로예요.', more: more,
      lesson: P.v2 < 0 && !same ? 'momentum' : 'bounce-stick' };
  }
  SK.takeaway(function () {
    if (!st || st.end !== 'done') return null;
    var P = st.P;
    if (SK.level && SK.level() === 'basic') return basicTakeaway(P);
    if (P.mode === 'separate') return {
      line: '운동량 합은 처음 0 → 나중에도 0이에요.', lesson: 'conserve',
      more: '포탄이 앞(+)으로 ' + fmt(P.m2 * P.v2f, 2) + ' kg·m/s를 얻은 만큼 대포가 뒤(−)로 같은 크기를 얻어요. 운동량 크기가 같으니 가벼운 포탄이 더 빨라요(포탄 ' + fmt(P.v2f, 1) + ' m/s, 대포 ' + fmt(Math.abs(P.v1f), 1) + ' m/s). 늘어난 운동 에너지는 눌린 용수철에서 왔어요. 로켓도 같은 원리예요(가스를 뒤로 → 로켓이 앞으로).'
    };
    if (P.mode === 'wall') return {
      line: '충격량 $I$ ' + fmt(P.J, 2) + ' N·s, 최대 힘 ' + fmtF(P.Fmax) + ' N이에요.', lesson: 'impulse',
      more: '수레의 운동량 변화(충격량 $I$)는 범퍼를 바꿔도 ' + fmt(P.J, 2) + ' N·s로 같아요. 범퍼가 ' + TAU_NAME[P.tau] + '($Δt$ ' + P.tau + ' s)일 때 평균 힘 $F$ = {{frac:$I$|$Δt$}} = ' + fmtF(P.Favg) + ' N이고, 그래프 꼭대기의 최대 힘 ' + fmtF(P.Fmax) + ' N은 평균의 약 1.57배(π/2)예요 — 설명의 200 N·10 N은 평균 힘이에요. 부딪쳐 있는 시간이 길수록 힘이 작아져요 — 에어백의 원리예요. 벽은 바깥에서 힘을 주므로 수레만의 운동량은 바뀌어요.'
    };
    var lost = P.kb - P.ka;
    var more = '두 수레가 받은 힘은 매 순간 크기가 같고 방향이 반대예요({{작용·반작용}}). 그래서 A가 잃은 운동량을 B가 그대로 얻어 합이 ' + sgn(P.pb, 2) + ' → ' + sgn(P.pa, 2) + ' kg·m/s로 그대로예요.';
    if (lost > 0.005) more += ' 운동 에너지는 ' + fmt(P.kb, 2) + ' → ' + fmt(P.ka, 2) + ' J — ' + fmt(lost, 2) + ' J이 열과 소리로 바뀌었어요.';
    else more += ' 튕기기라서 운동 에너지 합(' + fmt(P.kb, 2) + ' J)도 그대로예요.';
    if (P.m1 !== P.m2) more += ' 받은 충격량 $I$ 가 같으니 질량이 작은 쪽의 속도가 더 크게 바뀌어요: A ' + sgn(P.v1, 1) + ' → ' + sgn(P.v1f, 1) + ' m/s($Δv$ ' + sgn(P.v1f - P.v1, 1) + '), B ' + sgn(P.v2, 1) + ' → ' + sgn(P.v2f, 1) + ' m/s($Δv$ ' + sgn(P.v2f - P.v2, 1) + '). 나중 속도 $v′$ 와 속도 변화 $Δv$ 는 달라요.';
    return { line: lost > 0.005 ? '운동량 합은 그대로, 운동 에너지는 줄었어요.' : '운동량 합도, 운동 에너지 합도 그대로예요.', more: more,
      lesson: P.m1 !== P.m2 && P.v2 < 0 ? 'action-reaction' : 'bounce-stick' };   // R7(B6): 해설 → 설명 5장(튕김/붙음)·6장(트럭 vs 승용차)
  });

  /* 정리 단계: 질문 카드 (모범 답·해설 포함) — R9: 초급 정리는 설명 층 초급 문항(levels:['basic'])만(이 카드들은 충격량·Δv·부호 합을 써서 중급부터) */
  function notBasic() { return !(SK.level && SK.level() === 'basic'); }
  SK.think({ when: notBasic, id: 'heat', lesson: 'bounce-stick', q: '달라붙는 충돌에서 운동량은 그대로인데, 줄어든 {{운동 에너지}}는 어디로 갔을까?',
    choices: ['그냥 사라졌다', '열·소리·찌그러짐 같은 다른 에너지로 바뀌었다', '운동량으로 바뀌었다'], answer: 2,
    why: '에너지는 사라지지 않고 형태만 바뀌어요. 범퍼가 찌그러지며 데워지고 소리가 나요. 운동량과 에너지는 서로 다른 양이라 하나가 다른 하나로 바뀌지 않아요.' });
  SK.think({ when: notBasic, id: 'still', lesson: 'action-reaction', q: '움직이는 A가 멈춰 있는 B에 부딪칠 때, B가 A에 주는 힘은?',
    choices: ['0이다 (B는 가만히 있었으니까)', 'A가 B에 주는 힘보다 작다', 'A가 B에 주는 힘과 크기가 같다'], answer: 3,
    why: '{{작용·반작용}} — 부딪치는 순간 B도 같은 크기로 A를 되밀어요. 그래서 A가 느려지거나 멈춰요.' });
  SK.think({ when: notBasic, id: 'truck', lesson: 'action-reaction', q: '트럭과 승용차가 부딪칠 때 승용차에 탄 사람이 더 위험한 까닭은?',
    choices: ['승용차가 더 큰 힘을 받아서', '힘은 같지만 승용차는 질량이 작아 속도가 더 크게 바뀌어서', '트럭이 더 단단해서'], answer: 2,
    why: '일반 규칙: 두 차가 받는 충격량은 같고, 속도 변화 $Δv$ = {{frac:충격량|질량}}이라 가벼운 쪽이 크게 바뀌어요. 이 실험은 질량비가 3 : 1이라 승용차 속도 변화가 3배예요.' });
  SK.think({ when: notBasic, id: 'calc', lesson: 'conserve', q: '2 kg 수레가 +3 m/s로 가서 멈춰 있는 1 kg 수레에 달라붙었어요. 함께 몇 m/s로 움직일까?',
    hint: '부딪치기 전 운동량 합 = 부딪친 뒤 운동량 합. 붙은 뒤 질량은 2 + 1 = 3 kg이에요.',
    reveal: '<b>모범 답</b> +2 m/s. 처음 운동량 합은 2 × 3 + 1 × 0 = 6 kg·m/s예요. 붙은 뒤에도 6 kg·m/s이므로 3 × <i class="sym">v′</i> = 6, <i class="sym">v′</i> = +2 m/s예요. (<i class="sym">m<sub>1</sub></i> 2 kg, <i class="sym">v<sub>1</sub></i> +3, 달라붙기로 실행해 확인해 봐요.)' });
  SK.think({ when: notBasic, id: 'airbag', lesson: 'impulse', q: '에어백·체육관 매트·야구 글러브의 공통점은 무엇일까요? ‘충격량’과 ‘시간’을 넣어 말해 봐요.',
    hint: '‘힘-시간’ 탭에서 딱딱 범퍼와 푹신 범퍼 기록을 겹쳐 보세요.',
    reveal: '<b>모범 답</b> 멈출 때까지의 충격량(운동량 변화)은 같게 두고, 부딪쳐 있는 시간을 길게 해서 받는 힘을 줄여요. 평균 힘은 충격량을 시간으로 나눈 값이므로 시간이 길수록 힘이 작아져요.' });
  SK.think({ when: notBasic, id: 'cradle', lesson: 'bounce-stick', q: '같은 질량끼리 튕기면 왜 두 수레의 속도가 서로 바뀔까요? (뉴턴의 요람)',
    reveal: '<b>모범 답</b> 튕기기에서는 운동량 합(<i class="sym">m</i><i class="sym">v<sub>1</sub></i> + <i class="sym">m</i><i class="sym">v<sub>2</sub></i>)과 운동 에너지 합(½<i class="sym">m</i><i class="sym">v<sub>1</sub></i>² + ½<i class="sym">m</i><i class="sym">v<sub>2</sub></i>²)이 둘 다 그대로여야 해요. 질량이 같을 때 두 조건을 함께 만족하는 결과는 ‘속도를 서로 바꾸기’뿐이에요(그대로 지나가는 답은 부딪치지 않은 경우). 뉴턴의 요람에서 한쪽 공 하나를 부딪치면 반대쪽 공 하나만 튀어 나가는 것도 같은 까닭이에요.' });

  /* ---------- 13. 수업 안내 서랍 (교사 모드에서만) ---------- */
  SK.guide({
    rows: [
      { key: 'm1', target: '수레 A 질량 m₁ · 0.5~3.0 kg, 0.5 간격, 기본 1.0', standard: '[12물리01-03] 탐구 활동(역학 수레)', discover: '질량이 달라도 운동량 합은 보존되고, 두 수레가 주고받는 힘은 같다', misconception: '무거운 쪽이 더 큰 힘을 준다' },
      { key: 'm2', target: '수레 B 질량 m₂ · 0.5~3.0 kg, 0.5 간격, 기본 1.0', standard: '[12물리01-03] 탐구 활동(역학 수레)', discover: '가벼운 쪽 속도 변화가 크다(힘은 같아도)', misconception: '가벼운 쪽이 더 큰 힘을 받는다' },
      { key: 'v1', target: 'A 처음 속도 v₁ · −3~+3 m/s, 0.5 간격, 기본 +2.0', standard: '[12물리01-03] 운동량은 방향이 있다', discover: '속도의 부호(방향)가 운동량 합에 들어간다', misconception: '속도는 크기만 있다' },
      { key: 'v2', target: 'B 처음 속도 v₂ (더 많은 설정) · −3~+3 m/s, 기본 0', standard: '[12물리01-03]', discover: '정지한 물체도 같은 크기의 힘을 준다', misconception: '가만히 있는 물체는 힘을 주지 않는다' },
      { key: 'tau', target: '범퍼(충돌 시간 τ) · 딱딱 0.01 / 보통 0.05 / 푹신 0.2 s', standard: '[12물리01-03] 고려 사항 ‘충격량’, 교통수단(에어백)', discover: '힘-시간 그래프 넓이(충격량)는 같고 높이(최대 힘)만 다르다', misconception: '에어백은 운동량을 줄인다' },
      { key: 'kind', target: '충돌 종류 · 튕기기 / 달라붙기 / 중간', standard: '[12물리01-03], 연계 [12물리01-05]', discover: '달라붙어도 운동량 합은 같고 운동 에너지만 준다(열·소리)', misconception: '운동량 보존 = 에너지 보존' },
      { key: 'u', target: '포탄 나가는 속력 u (분리 장면) · 0~6 m/s, 기본 4.0', standard: '[12물리01-03] 발사체(반동)', discover: '운동량 합은 0, 가벼운 쪽이 빠르다', misconception: '반동은 운동량이 새로 생긴 것' },
      { key: 'mode', target: '실험 장면 · 충돌 / 분리(반동) / 벽', standard: '[12물리01-03] 스포츠·교통수단·발사체에 적용', discover: '세 장면 모두 주고받는 힘은 크기 같고 방향 반대', misconception: '—' },
      { key: 'e', target: '반발 계수 e · 질량 중심 (더 많은 설정)', standard: '성취기준 밖 — 심화', discover: '충돌 전후 질량 중심의 속도가 일정하다', misconception: '—' }
    ],
    sections: [
      { title: '수업 흐름 (40분 예)', items: [
        '예측: 처음 화면에 뜨는 실험 ①(같은 질량끼리 튕기면) → 손들기 → 실행. 이어서 ③ 트럭 vs 승용차로 작용·반작용 예측',
        '실행: 슬로 모션으로 힘 화살표 한 쌍을 확인 → [힘-시간] 탭에서 두 곡선이 위아래로 같은 모양인지 확인',
        '비교: ① 실행 → 기록, ② 달라붙으면(충돌 종류만 바꿈) 실행 → 기록. 표의 운동량 보존·운동 에너지 보존 열 → [규칙 확인하기]. 이어서 ⑥ 마주 오다 부딪치기(합 0)',
        '적용: ⑤ 에어백 — 딱딱 기록 → 푹신 기록 → [힘-시간] 탭에서 넓이는 같고 높이만 다름을 확인',
        '정리: 오른쪽 질문 6개(계산 1개, 모범 답·해설 포함). 토론 전에는 교사 서랍에서 ‘답 확인 잠금’을 켤 수 있어요'
      ] },
      { title: '교사 메모', items: [
        '설명 9장 질문 6(+2 와 −2 가 달라붙으면?)의 [해 보기]는 카드 ⑥ 마주 오다 부딪치기로 열려요(v₂ = −2 m/s · 달라붙기). 카드 ②(달라붙으면)는 B 가 멈춰 있는 경우예요.',
        '카드 ⑥ 을 고르면 B 처음 속도 v₂ 칸이 패널에 나와요(다른 카드에서는 ⚙ 더 많은 설정). 숫자 키 6 으로도 골라요.',
        '튕기기 충돌의 부딪치는 동안(접촉 중) 운동 에너지 막대의 빈 몫은 ‘용수철에 저장 E_p’(청보라·점선·지그재그)로 그려 합이 처음과 같아요. ‘열·소리’는 부딪친 뒤에 남은 손실만이에요.'
      ] },
      { title: '모형 안내', items: [
        '마찰 없음(에어트랙). 충돌 힘은 사인 모양으로 단순화한 모형: F(t) = F최대·sin(πt/τ).',
        '충격량 I = 2·F최대·τ/π = 힘-시간 그래프 넓이, 평균 힘 = I/τ (코드 변수는 J).',
        '벽 장면의 벽은 질량이 아주 큰 물체(지구에 붙음)로 보아, 수레 운동량만 바뀐다(벽이 같은 크기의 충격량을 반대로 받음).',
        '분리 장면에서 늘어난 운동 에너지는 눌린 용수철에 저장돼 있던 에너지다.',
        '자동 슬로 모션은 화면 재생만 느리게 하며 물리 결과는 같다.',
        '성취기준 코드는 결정서에서 확인된 [12물리01-03], [12물리01-05]만 썼다.'
      ] }
    ]
  });

  /* 처음 들어오면 카드 ① 예측 질문을 바로 띄운다 (SimKit 첫 reset 뒤) */
  setTimeout(function () {
    // R7: ?view=sim&preset=n(허브·설명)으로 이미 카드를 골랐으면 덮어쓰지 않는다
    if (!SK.started && SK.stepIndex === 0 && !SK.prediction && !(SK.activePreset && SK.activePreset() >= 0)) {
      SK.applyPreset(0);
      // R3: 처음 화면에는 카드 알림(검은 알약)을 띄우지 않는다 — 칩 줄 '카드 ①' 과 겹침
      var z = SK.el.notices; if (z) Array.prototype.slice.call(z.querySelectorAll('.notice')).forEach(function (n) { if (/^(카드|실험) /.test(n.textContent)) n.remove(); });
    }
  }, 120);
  /* R3: 카드를 고른 직후 알림은 1.5초만 (기본 2.5초는 예측 창 위에 오래 남음) */
  if (SK.el.notices && typeof MutationObserver !== 'undefined') {
    new MutationObserver(function () {
      var n = SK.el.notices.querySelector('.notice');
      if (n && !n._cmShort && /^(카드|실험) /.test(n.textContent)) { n._cmShort = true; setTimeout(function () { if (n.parentNode) n.remove(); }, 1500); }
    }).observe(SK.el.notices, { childList: true });
  }

  /* =================================================================
     그리기
     ================================================================= */
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  /** R7 학생점검(A8): 캔버스 글자 하한 = max(18px, N u) — 배율이 작은 화면(1180·820)에서 축 숫자·값('+2.00')·단위가 18px 아래로 내려가지 않게 */
  /* R8(A12): 하한 = tokens.css --fs-canvas-min(18px, ≥1600 26px), 전자칠판(화면 폭 ≥1600)은 ×1.15 — SK.fs 와 같은 규칙을 논리 u 로 */
  var fsTok = { w: -1, min: 18, boost: 1 };
  function fsMin(n) {
    var sc = (SK.view && SK.view.scale) || 1, w = typeof innerWidth === 'number' ? innerWidth : 0;
    if (w !== fsTok.w) {
      fsTok.w = w;
      var v = 18;
      try { v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fs-canvas-min')) || 18; } catch (e) { v = 18; }
      fsTok.min = v; fsTok.boost = w >= 1600 ? 1.15 : 1;
    }
    return Math.max(Math.round((n || 22) * fsTok.boost), Math.ceil(fsTok.min / sc));
  }
  /** R4: 캔버스 글자는 모두 SK.text — 에스코어 드림 400(라벨·눈금)·500(제목·강조), 기호는 $…$ 수식(기울임 + 아래첨자) */
  function tOpt(o) {
    o = o || {};
    return { size: fsMin(o.size || 22), weight: (o.w || 400) >= 500 ? 500 : 400, color: o.color || '--color-ink', align: o.align || 'left',
      baseline: o.base || 'middle', halo: o.halo, haloWidth: o.haloWidth };
  }
  function text(ctx, s, x, y, o) { return SK.text(ctx, s, x, y, tOpt(o)); }
  function textW(ctx, s, o) { return SK.measure(ctx, s, tOpt(o)).w; }
  function zigzag(ctx, x1, x2, y, amp, n) {
    ctx.beginPath(); ctx.moveTo(x1, y);
    var w = x2 - x1;
    for (var i = 1; i < n; i++) ctx.lineTo(x1 + w * i / n, y + (i % 2 ? -amp : amp));
    ctx.lineTo(x2, y); ctx.stroke();
  }
  /** 빗금 (색약 대비: 색 + 무늬) */
  function hatch(ctx, x, y, w, h, color, gap, lw, alpha) {
    if (w <= 0 || h <= 0) return;
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.strokeStyle = col(color); ctx.lineWidth = lw || 2; if (alpha) ctx.globalAlpha = alpha;
    for (var k = -h; k < w + h; k += (gap || 10)) { ctx.beginPath(); ctx.moveTo(x + k, y + h); ctx.lineTo(x + k + h, y); ctx.stroke(); }
    ctx.restore();
  }

  function render(view, p) {
    if (!st) return;
    var ctx = view.ctx, P = st.P;
    var simple = !!(SK.isSimple && SK.isSimple());
    TS = simple ? 28 : 22; CS = simple ? 1.5 : 1;
    layoutScene(view);   // R7-3(B4): 실행 전(그래프 판 한 줄) ↔ 실행 뒤(그래프 판 펼침)
    lowerEl.classList.toggle('cm-lower--pre', !SK.started);
    placeLower(view);
    RAIL = RAILB + bandShift(view);   // R7-2: 예측 띠(무대 위쪽)가 수레 위 속도 글자를 가리지 않게 — 띠가 열린 동안만 장면을 아래로(그래프 판은 이때 숨어 있음)
    drawTrack(ctx, P);
    if (p.showCM && P.mode !== 'wall') drawCM(ctx, P);
    drawCarts(ctx, P);
    if (!SK.predicting()) { if (simple) drawLowerSimple(ctx, P); else drawLower(ctx, p, P); }   // R2: 예측 창이 떠 있는 동안 결과 층(그래프 판) 숨김
    updateHTML(p, P);
  }

  /** R7-2: 예측 띠 아래 끝(논리 단위)보다 수레 위 글자(레일 위 ≈150u, 벽 장면 ≈200u)가 위에 있으면 그만큼 내린다.
      예측 중이 아니거나 띠를 접었으면 0 · 트랙 설명(+100u)이 무대 아래로 나가지 않게 상한 */
  function bandShift(view) {
    if (!SK.predicting || !SK.predicting()) return 0;
    var b = SK.el.slide && SK.el.slide.querySelector('.pop--band:not([hidden])');
    if (!b || b.dataset.folded === '1' || !view.canvas) return 0;
    var cr = view.canvas.getBoundingClientRect(), br = b.getBoundingClientRect();
    if (!br.height) return 0;
    var bottom = (br.bottom - cr.top - view.oy) / view.scale - (view.offsetY || 0);
    var reach = (st && st.P.mode === 'wall' ? 205 : 150) * K * (CS > 1 ? 1.35 : 1);
    var room = (view.h + (view.extra || 0)) - (RAILB + 100 * K);
    return Math.max(0, Math.min(room, bottom + 14 - (RAILB - reach)));
  }

  function drawTrack(ctx, P) {
    ctx.fillStyle = col('--color-paper-sunk');
    rr(ctx, sx(-2) - 10, RAIL, sx(2) - sx(-2) + 20, 12 * K, 4); ctx.fill();
    ctx.strokeStyle = col('--color-line-strong'); ctx.lineWidth = 2; ctx.stroke();
    // R7 학생점검(D6): 트랙은 무대 양끝까지 이어진다 — ±2 m 바깥(눈금 없는 곳)은 옅은 점선 + '트랙 계속 →' (물리값은 그대로, 그림만)
    var vw = (SK.view && SK.view.w) || 1250, ty = RAIL + 6 * K;
    ctx.save();
    ctx.strokeStyle = col('--color-line-strong'); ctx.globalAlpha = 0.45; ctx.lineWidth = 3; ctx.setLineDash([14, 10]);
    ctx.beginPath();
    ctx.moveTo(sx(2) + 10, ty); ctx.lineTo(vw - 4, ty);
    ctx.moveTo(4, ty); ctx.lineTo(sx(-2) - 10, ty);
    ctx.stroke();
    ctx.restore();
    if (TS === 22 && vw - (sx(2) + 10) > 60) {
      // 트랙 설명 줄(왼쪽)과 닿으면 한 줄 아래로
      var tcO = { size: TS * K, w: 400 }, tcW = textW(ctx, '트랙 계속 →', tcO), dW = textW(ctx, '마찰 없는 트랙 · 오른쪽이 + 방향 · 눈금 0.5 m', tcO);
      var tcY = sx(-2) - 10 + dW + 24 > vw - 8 - tcW ? RAIL + 80 * K + fsMin(TS * K) * 1.25 : RAIL + 80 * K;
      text(ctx, '트랙 계속 →', vw - 8, tcY, { size: TS * K, w: 400, color: '--color-ink-muted', align: 'right' });
    }
    for (var i = -4; i <= 4; i++) {
      var x = sx(i / 2), big = i % 2 === 0;
      ctx.fillStyle = col(big ? '--color-line-strong' : '--color-line');
      ctx.fillRect(x - 1, RAIL + 12 * K, 2, (big ? 12 : 7) * K);
      // R5: 숫자는 눈금선 끝(+24)에서 7u 더 띄워 +42 — 선이 숫자에 닿지 않음
      if (big) text(ctx, (i > 0 ? '+' : i < 0 ? '−' : '') + Math.abs(i / 2) + (i === 4 ? ' m' : ''), x, RAIL + (TS + 20) * K, { size: TS * K, w: 400, color: '--color-ink-muted', align: 'center' });
    }
    // 트랙 설명은 눈금 숫자 아래 두 줄 간격(R5: +64 → +80) · 글 속 화살표 글자는 빼고 말로
    if (TS === 22) text(ctx, '마찰 없는 트랙 · 오른쪽이 + 방향 · 눈금 0.5 m', sx(-2) - 10, RAIL + 80 * K, { size: 22 * K, w: 400, color: '--color-ink-muted' });
    if (P.mode === 'wall') {
      var wx = sx(CM.XW), wt = RAIL - 170 * K;
      ctx.fillStyle = col('--color-paper-sunk'); ctx.fillRect(wx, wt, 32, RAIL + 12 * K - wt);
      ctx.strokeStyle = col('--color-line-strong'); ctx.lineWidth = 3; ctx.strokeRect(wx, wt, 32, RAIL + 12 * K - wt);
      hatch(ctx, wx, wt, 32, RAIL + 12 * K - wt, '--color-line-strong', 16);
      text(ctx, '벽', wx + 16, wt - 18 * K, { size: (TS + 2) * K, w: 500, align: 'center' });
    }
  }

  function cartPos(who) {
    if (drag && drag.who === who) return drag.x;
    return who === 'A' ? st.xA : st.xB;
  }

  function drawBumper(ctx, faceX, dir, len, tau) {
    var y = RAIL - 46 * K, x2 = faceX + dir * len;
    var a = Math.min(faceX, x2), w = Math.abs(len);
    ctx.save();
    if (tau <= 0.01) {
      ctx.fillStyle = col('--color-ink-muted'); rr(ctx, a, y - 12 * K, w, 24 * K, 3); ctx.fill();
    } else if (tau <= 0.05) {
      ctx.strokeStyle = col('--color-ink-muted'); ctx.lineWidth = 3;
      zigzag(ctx, faceX, x2 - dir * 6, y, 11 * K, 6);
      ctx.fillStyle = col('--color-ink-muted'); ctx.fillRect(dir > 0 ? x2 - 6 : x2, y - 16 * K, 6, 32 * K);
    } else {
      ctx.fillStyle = col('--color-paper-sunk'); rr(ctx, a, y - 22 * K, w, 44 * K, 12); ctx.fill();
      ctx.strokeStyle = col('--color-line-strong'); ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.restore();
  }

  function drawCart(ctx, x, m, color, name) {
    var hgt = CM.cartH(m) * K * CS, bw = 2 * CM.HW * SX, cx = sx(x);
    var top = RAIL - 18 * K - hgt;
    ctx.fillStyle = col(color);
    rr(ctx, cx - bw / 2, top, bw, hgt, 8); ctx.fill();
    ctx.fillStyle = col('--color-ink');
    [-0.28, 0.28].forEach(function (f) { ctx.beginPath(); ctx.arc(cx + f * bw, RAIL - 9 * K, 9 * K, 0, Math.PI * 2); ctx.fill(); });
    var num = fmt(m, m % 0.5 ? 2 : 1), mt = num + ' kg';
    if (CS > 1) {
      // R8(D7) 심플: 몸통 안에는 이름만(크게), 질량 '1.0 kg' 은 수레 바로 위 한 줄(몸통 72u 에 세 줄로 끊기던 것)
      text(ctx, name, cx, top + hgt / 2, { size: name.length > 1 ? 28 : 34, w: 500, color: '--color-ink-inverse', align: 'center' });
      var my = top - Math.round(fsMin(28) * 0.75);
      text(ctx, mt, cx, my, { size: 28, w: 500, color: '--color-ink', align: 'center' });
      return { cx: cx, top: my - Math.round(fsMin(28) * 0.55), mt: null, color: color };
    }
    text(ctx, name, cx, top + 20 * K, { size: (name.length > 1 ? 22 : 24) * KT(), w: 500, color: '--color-ink-inverse', align: 'center' });
    // R6(B3): 단위 병기 — '1.0 kg'(22u 폭 64.6u)이 몸통 72u 안에 들어가게 여백 8 → 4. 그래도 넘치면(K>1 등) 숫자만
    if (textW(ctx, mt, { size: 22 * KT(), w: 500 }) > bw - 4) mt = num;
    text(ctx, mt, cx, top + 43 * K, { size: 22 * KT(), w: 500, color: '--color-ink-inverse', align: 'center' });
    return { cx: cx, top: top, mt: mt, color: color };
  }
  /** R7-3(B4): 수레 몸통 글자 축척 — 몸통 폭(72u)은 그대로라 K 가 커져도(실행 전 장면 확대) 1.6 까지만 */
  function KT() { return Math.min(K, 1.6); }
  /** R3: 힘 화살표가 수레 글자를 덮으면 글자를 수레색 외곽선과 함께 다시 그린다 ('1.0 kg' 잘림 방지) */
  function relabel(ctx, c) {
    if (!c || !c.mt) return;
    text(ctx, c.mt, c.cx, c.top + 43 * K, { size: 22 * KT(), w: 500, color: '--color-ink-inverse', align: 'center', halo: c.color, haloWidth: 6 });
  }

  function velLabel(cx, top, v) {
    var y = top - 26 * K;
    if (Math.abs(v) < 0.005) return { x: cx, y: y - TS * K, text: '0 m/s (정지)', color: '--color-q-velocity', size: TS * K, dot: true, ay: y };
    var L = Math.max(-200, Math.min(200, v * 34));
    if (cx + L > 1236) L = Math.max(24, 1236 - cx);          // 실험 화면 밖으로 나가지 않게
    if (cx + L < 14) L = Math.min(-24, 14 - cx);
    return { x: Math.max(60 * K, Math.min(1250 - 60 * K, cx + L / 2)), y: y - TS * K, text: sgn(v, 1) + ' m/s', color: '--color-q-velocity', size: TS * K, ax: cx, ay: y, L: L };
  }

  var sprLab = { x: 0, y: 0 };
  function drawCarts(ctx, P) {
    var tau = P.tau, xA = cartPos('A'), xB = cartPos('B');
    var hw = CM.HW * SX;
    var sep = P.mode === 'separate';
    if (sep) {
      var fa = sx(xA) + hw, fb = sx(xB) - hw;
      var len = Math.min(fb - fa, CM.L0 * SX);
      ctx.strokeStyle = col('--color-ink-muted'); ctx.lineWidth = 3;
      zigzag(ctx, fa, fa + len, RAIL - 46 * K, 12 * K, 9);
      if (st.phase === 'pre' && !drag) {   // R8(D4): '눌린 용수철' 지시선 — 수레·바퀴가 위에 그려져 선이 틈과 바닥에서만 보인다
        var gx = (fa + fb) / 2, ly2 = RAIL - 4;
        sprLab = { x: sx(xA) - hw - 16, y: RAIL - 14 * K };
        ctx.save(); ctx.strokeStyle = col('--color-ink-muted'); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(gx, RAIL - 46 * K + 14 * K); ctx.lineTo(gx, ly2); ctx.lineTo(sprLab.x + 6, ly2); ctx.lineTo(sprLab.x + 6, sprLab.y + 6); ctx.stroke();
        ctx.fillStyle = col('--color-ink-muted'); ctx.beginPath(); ctx.arc(gx, RAIL - 32 * K, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    } else {
      var cA = P.mode === 'wall' ? st.c : st.c / 2;
      if (drag || st.phase === 'pre') cA = 0;
      var lenA = (CM.BUMP * SX) - cA * SX;
      drawBumper(ctx, sx(xA) + hw, 1, lenA, tau);
      if (P.mode === 'collide') drawBumper(ctx, sx(xB) - hw, -1, lenA, tau);
    }
    var a = drawCart(ctx, xA, P.m1, '--color-rec-1', sep ? '대포' : 'A');
    var b = P.mode === 'wall' ? null : drawCart(ctx, xB, P.m2, '--color-rec-2', sep ? '포탄' : 'B');
    if (drag) {
      text(ctx, '놓는 순간의 빠르기가 처음 속도가 돼요', sx(drag.x), RAIL - 18 * K - CM.cartH(drag.who === 'A' ? P.m1 : P.m2) * K * CS - 50 * K, { size: TS * K, w: 500, color: '--color-primary', align: 'center' });
      return;
    }
    // 속도 화살표 + 라벨 (라벨은 겹치면 placeLabel 이 비켜 줌)
    if (sep && st.phase === 'pre') {
      // R8(D4): 분리 실행 전 — '0 m/s (정지)' 두 개 대신 가운데 위 한 줄, '눌린 용수철' 은 바닥 쪽 지시선 라벨(수레 이름·질량 위에는 아무것도 없음)
      var midX = (sx(xA) + sx(xB)) / 2, topY = Math.min(a.top, b.top);
      text(ctx, '둘 다 정지 · 0 m/s', midX, topY - 30 * K, { size: TS * K, w: 500, color: '--color-q-velocity', align: 'center' });
      // 라벨은 대포 왼쪽 바퀴 높이(바닥 쪽) — 지시선(수레보다 먼저 그림)은 두 수레 틈으로 내려와 바닥을 따라 왼쪽으로
      text(ctx, '눌린 용수철', sprLab.x, sprLab.y, { size: TS * K, w: 500, color: '--color-ink-muted', align: 'right' });
    } else {
      // R8(D7): 심플은 두 수레 속도 라벨을 같은 높이 한 줄에(질량 글 위)
      var vTopA = a.top, vTopB = b ? b.top : a.top;
      if (CS > 1 && b) vTopA = vTopB = Math.min(a.top, b.top);
      var labs = [velLabel(a.cx, vTopA, st.vA)];
      if (b) labs.push(velLabel(b.cx, vTopB, st.vB));
      labs.forEach(function (l) {
        if (l.dot) { ctx.fillStyle = col('--color-q-velocity'); ctx.beginPath(); ctx.arc(l.ax !== undefined ? l.ax : l.x, l.ay, 6 * K, 0, Math.PI * 2); ctx.fill(); }
        else SK.arrow(ctx, l.ax, l.ay, l.ax + l.L, l.ay, { color: '--color-q-velocity', width: 5 * K });
      });
      SK.placeLabel(ctx, labs.map(function (l) { return { x: l.x, y: l.y, text: l.text, color: l.color, size: l.size, anchor: 'center' }; }));
    }
    // 힘 화살표 한 쌍 (충돌 중)
    var F = CM.force(st);
    if (F > 0.002 * P.Fmax && P.Fmax > 0) {
      var L = 26 + 120 * F / P.Fmax, y = RAIL - 28 * K, cx;
      if (P.mode === 'wall') cx = sx(CM.XW);
      else if (sep) cx = (sx(xA) + hw + sx(xB) - hw) / 2;
      else cx = (sx(xA) + sx(xB)) / 2;
      var fs = fmtF(F) + ' N';
      SK.arrow(ctx, cx - 4, y, cx - 4 - L, y, { color: '--color-q-force', width: 8 * K });
      SK.arrow(ctx, cx + 4, y, cx + 4 + L, y, { color: '--color-q-force', width: 8 * K });
      relabel(ctx, a); relabel(ctx, b);
      var who = P.mode === 'wall' ? '벽이' : sep ? '포탄이' : 'B가';
      // R4: 양끝 ← → 는 SVG 아이콘(arrow-left/right) · 글자는 에스코어 500
      var LO = { size: TS + 2, w: 500, color: '--color-copper-text' }, IC = TS + 2, GAP = 6;
      var lab1 = (sep ? '대포' : 'A') + '가 받는 힘 ' + fs + '   |   ' + who + ' 받는 힘 ' + fs, lab2 = '   크기 같고 방향 반대';
      var w1 = textW(ctx, lab1, LO), w2 = textW(ctx, lab2, LO);
      // R2(C4): 힘 라벨 상자는 장면 위쪽(모서리 칩 아래) — 트랙 설명과 겹치지 않게
      var tw = IC + GAP + w1 + GAP + IC + w2 + 28, lx = Math.max(16, Math.min(1234 - tw, cx - tw / 2));
      var ly = Math.max(84, Math.min(118, SK.stageInset().top + 8));
      if (CS > 1) { var isc = (SK.view && SK.view.scale) || 1; ly = Math.max(8, Math.round(SK.stageInset().top / isc) + 8); }   // R8(D7): 심플 — 힘 배너는 무대 위 가장자리(칩 줄 바로 아래)에 고정
      var bh = TS + 16;
      ctx.fillStyle = col('--color-copper-tint'); rr(ctx, lx, ly, tw, bh, 8); ctx.fill();
      ctx.strokeStyle = col('--color-copper'); ctx.lineWidth = 2; ctx.stroke();
      var tx = lx + 14;
      SK.drawIcon(ctx, 'arrow-left', tx + IC / 2, ly + bh / 2, IC, { color: '--color-copper-text', width: 2.6 }); tx += IC + GAP;
      text(ctx, lab1, tx, ly + bh / 2, LO); tx += w1 + GAP;
      SK.drawIcon(ctx, 'arrow-right', tx + IC / 2, ly + bh / 2, IC, { color: '--color-copper-text', width: 2.6 }); tx += IC;
      text(ctx, lab2, tx, ly + bh / 2, LO);
    }
  }

  function drawCM(ctx, P) {
    var M = P.m1 + P.m2, xcm = (P.m1 * cartPos('A') + P.m2 * cartPos('B')) / M;
    var vcm = (P.m1 * st.vA + P.m2 * st.vB) / M, x = sx(xcm);
    ctx.save();
    ctx.strokeStyle = col('--color-ink'); ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(x, RAIL + 6 * K); ctx.lineTo(x, RAIL - 196 * K); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = col('--color-paper-raised'); ctx.beginPath(); ctx.arc(x, RAIL + 6 * K, 11, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 11, RAIL + 6 * K); ctx.lineTo(x + 11, RAIL + 6 * K); ctx.moveTo(x, RAIL + 6 * K - 11); ctx.lineTo(x, RAIL + 6 * K + 11); ctx.stroke();
    ctx.restore();
    text(ctx, '질량 중심 $v$ = ' + sgn(vcm, 2) + ' m/s (일정)', x, RAIL - 208 * K, { size: TS * K, w: 500, align: 'center' });
  }

  /* ---------- 아래 그래프 판: 탭 하나만 ---------- */
  function drawLower(ctx, p, P) {
    if (!SK.started) return;           // 실행 전: 빈 상태 한 줄(HTML)
    ctx.fillStyle = col('--color-paper'); rr(ctx, LOW.x, LOW.y, LOW.w, LOW.h, 12); ctx.fill();
    ctx.strokeStyle = col('--color-line'); ctx.lineWidth = 1.5; ctx.stroke();
    ctx.strokeStyle = col('--color-line'); ctx.beginPath(); ctx.moveTo(GX - 12, LOW.y + 12); ctx.lineTo(GX - 12, LOW.y + LOW.h - 12); ctx.stroke();
    var b = { x: GX, y: LOW.y, w: LOW.x + LOW.w - GX - 8, h: LOW.h };
    ctx.save();
    if (tab === 'p') drawPBars(ctx, b, P); else if (tab === 'f') drawFT(ctx, b, P); else drawKBars(ctx, b, P);
    ctx.restore();
  }

  /** R6(B7) 심플: 그래프 탭 없이 '운동량 합 전 / 후' 막대 한 쌍만 (글자 28u 이상). 벽 장면은 수레 운동량 전 / 후 */
  /** R9(§4-3): 초급 그래프 판 = 두 수레 속도 화살 '부딪치기 전 → 부딪친 뒤'(숫자 없이 길이·방향만).
      움직임의 양(운동량) 합은 아래 측정 칸 막대가 맡는다. '뒤' 줄은 부딪친 뒤에만 그린다(그 전엔 정답이 새지 않게 말만) */
  function drawLowerSimple(ctx, P) {
    if (!SK.started) return;
    var x = LOW.x, y = LOW.y, w = LOW.w, h = LOW.h;
    ctx.fillStyle = col('--color-paper'); rr(ctx, x, y, w, h, 12); ctx.fill();
    ctx.strokeStyle = col('--color-line'); ctx.lineWidth = 1.5; ctx.stroke();
    var wall = P.mode === 'wall', sep = P.mode === 'separate', hit = st.phase !== 'pre', done = st.phase === 'post';
    text(ctx, '두 수레의 빠르기와 방향', x + 24, y + 30, { size: 30, w: 500 });
    text(ctx, '오른쪽 → · 왼쪽 ←', x + w - 24, y + 30, { size: 26, w: 400, color: '--color-ink-muted', align: 'right' });
    var before = [P.mode === 'separate' ? 0 : P.v1, wall ? null : (sep ? 0 : P.v2)];
    var after = done ? [P.v1f, wall ? null : P.v2f] : null;
    var mx = Math.max(0.5, Math.abs(before[0]), Math.abs(before[1] || 0), after ? Math.abs(after[0]) : 0, after && after[1] !== null ? Math.abs(after[1]) : 0);
    var labW = 210, x0 = x + 24 + labW, x1 = x + w - 60, zx = (x0 + x1) / 2, half = (x1 - x0) / 2 - 20;
    var top = y + 58, rh = (h - 66) / 2;
    ctx.strokeStyle = col('--color-line-strong'); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(zx, top + 4); ctx.lineTo(zx, top + 2 * rh - 4); ctx.stroke();
    var names = [sep ? '대포' : 'A', sep ? '포탄' : 'B'], colors = ['--color-rec-1', '--color-rec-2'];
    // 팀장 R9 결과(학생M): 두 줄 사이 가는 구분선 — '전' 줄의 B 와 '뒤' 줄의 A 가 한 묶음처럼 보이지 않게
    ctx.strokeStyle = col('--color-line'); ctx.lineWidth = 1.5; ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.moveTo(x + 24, top + rh); ctx.lineTo(x + w - 24, top + rh); ctx.stroke(); ctx.setLineDash([]);
    [['부딪치기 전', before], [done ? '부딪친 뒤' : hit ? '부딪치는 중' : '부딪친 뒤', after]].forEach(function (r, i) {
      var cy = top + rh * i + rh / 2;
      text(ctx, sep && i === 0 ? '쏘기 전' : sep && i === 1 ? '쏜 뒤' : r[0], x + 24, cy, { size: 28, w: 500, color: '--color-ink' });
      if (!r[1]) { text(ctx, hit && !done ? '부딪치는 중이에요' : '부딪친 뒤 나와요', zx + 16, cy, { size: 28, w: 400, color: '--color-ink-muted' }); return; }
      r[1].forEach(function (v, k) {
        if (v === null) return;
        var ly = cy + (k === 0 ? -1 : 1) * Math.max(11, Math.min(26, rh * 0.27));
        if (Math.abs(v) < 1e-6) {
          ctx.fillStyle = col(colors[k]); ctx.beginPath(); ctx.arc(zx, ly, 7, 0, Math.PI * 2); ctx.fill();
          // 팀장 R9 결과(학생M): 이름은 화살표 줄과 같이 0 선 왼쪽에, 오른쪽에는 '멈춤(0)' — 어느 수레가 멈췄는지 이름 자리로 바로 보이게
          text(ctx, names[k], zx - 12, ly, { size: 22, w: 500, color: '--color-ink', align: 'right' });
          text(ctx, '멈춤 (0)', zx + 16, ly, { size: 22, w: 400, color: '--color-ink-muted' });
          return;
        }
        var xe = zx + v / mx * half;
        SK.arrow(ctx, zx, ly, xe, ly, { color: colors[k], width: 7, head: 16 });
        text(ctx, names[k], v > 0 ? zx - 12 : zx + 12, ly, { size: 22, w: 500, color: '--color-ink', align: v > 0 ? 'right' : 'left' });
      });
    });
  }

  function niceMax(v, step) { return Math.max(step, Math.ceil(v / step - 1e-9) * step); }

  /* R2: 그래프 글자 22u 이상(제목 26 · 머리 24) · 처음/나중은 색 + 글자 + 무늬로 구분(색약) */
  function drawPBars(ctx, b, P) {
    var tY = Math.max(22, Math.round(fsMin(26) * 0.62) + 4);   // R8(A12): 제목 줄이 판 위 테두리에 닿지 않게(글자 하한만큼)
    var wall = P.mode === 'wall', hit = st.phase !== 'pre', done = st.phase === 'post';
    // R5: 제목 줄 = 제목 · (실행 중) 단위 안내 / (끝) 결론 한 줄 · 오른쪽 끝 빗금 범례
    // R8(D6): 판 폭에 다 안 들어가면 두 줄(제목 · 단위 / 요약) — 범례는 판 오른쪽 아래로
    var TT = '운동량 $p$ = $mv$', tW = textW(ctx, TT, { size: 26, w: 500 });
    var same = done && !wall && Math.abs(P.pa - P.pb) < 1e-6;
    var cT = done && !wall ? (same ? '합은 그대로 ' + fmt(P.pb, 2) + '\u00a0kg·m/s' : '합 ' + fmt(P.pb, 2) + ' → ' + fmt(P.pa, 2) + '\u00a0kg·m/s') : '단위 kg·m/s · 오른쪽 + / 왼쪽 −';
    var cO = done && !wall ? { size: 24, w: 500, color: '--color-ink' } : { size: 22, w: 400, color: '--color-ink-muted' };
    var lgT = '빗금 = 두 수레 합', lgW = wall ? 0 : textW(ctx, lgT, { size: 22 }) + 52;
    var two = tW + 28 + (same ? 30 : 0) + textW(ctx, cT, cO) + (lgW ? lgW + 24 : 0) > b.w;
    var lineH = two ? Math.round(fsMin(24) * 1.3) : 0, lgH = two && !wall ? Math.round(fsMin(22) * 1.3) : 0;
    // 글자 하한으로 커진 만큼 제목 → 소제목 → 첫 행 간격도(배율 0.82 이상·1280 이하는 예전 34·29)
    var gT = Math.max(34, Math.round(fsMin(26) * 1.25)), gS = Math.max(29, Math.round(fsMin(24) * 1.2));
    text(ctx, TT, b.x + 4, b.y + tY, { size: 26, w: 500 });
    var hx = b.x + 4 + tW + 28, hy = b.y + tY;
    if (two) {
      if (!(done && !wall)) { text(ctx, '단위 kg·m/s', hx, hy, { size: 22, w: 400, color: '--color-ink-muted' }); cT = '오른쪽 + / 왼쪽 −'; }
      hx = b.x + 4; hy = b.y + tY + lineH;
    }
    if (same) { SK.drawIcon(ctx, 'check', hx + 11, hy, 22, { color: '--color-ok', width: 3 }); hx += 30; }
    text(ctx, cT, hx, hy, cO);
    if (!wall) {
      var lgY = two ? b.y + b.h - Math.round(lgH / 2) - 4 : b.y + tY, lgX = b.x + b.w - lgW;
      ctx.fillStyle = col('--color-ink'); ctx.fillRect(lgX, lgY - 11, 40, 22);
      hatch(ctx, lgX, lgY - 11, 40, 22, '--color-paper', 12, 1, 0.5);
      text(ctx, lgT, b.x + b.w, lgY, { size: 22, w: 400, color: '--color-ink-muted', align: 'right' });
    }
    var pA0 = P.m1 * P.v1, pB0 = wall ? 0 : P.m2 * P.v2, pA = P.m1 * st.vA, pB = wall ? 0 : P.m2 * st.vB;
    var sep = P.mode === 'separate';
    var nA = sep ? '대포' : 'A', nB = sep ? '포탄' : 'B', nS = sep ? '합(둘)' : '합(두 수레)';
    var cols = [
      { title: '부딪치기 전 (처음)', rows: wall ? [[nA, pA0, '--color-rec-1']] : [[nA, pA0, '--color-rec-1'], [nB, pB0, '--color-rec-2'], [nS, pA0 + pB0, '--color-ink', true]] },
      { title: done ? '부딪친 뒤 (나중)' : hit ? '부딪치는 중 (지금)' : '부딪친 뒤', rows: wall ? [[nA, hit ? pA : null, '--color-rec-1']] : [[nA, hit ? pA : null, '--color-rec-1'], [nB, hit ? pB : null, '--color-rec-2'], [nS, hit ? CM.pNow(st) : null, '--color-ink', true]] }
    ];
    var mx = 0.5;
    [pA0, pB0, pA0 + pB0, P.pa, P.m1 * P.v1f, wall ? 0 : P.m2 * P.v2f, pA, pB].forEach(function (v) { if (isFinite(v)) mx = Math.max(mx, Math.abs(v)); });
    var tick = mx <= 3 ? 1 : mx <= 6 ? 2 : 4;
    mx = niceMax(mx, tick);
    // R3: 제목(26u) ↔ 소제목(24u) 8u · 소제목 ↔ 첫 행 12u · 축 숫자 아래 12u
    var colW = (b.w - 24) / 2, top = b.y + tY + gT + gS + lineH, bot = b.y + b.h - (wall ? 66 : 40) - lgH;
    var rh = (bot - top) / (wall ? 1 : 3);
    cols.forEach(function (c, ci) {
      var cx0 = b.x + ci * (colW + 24), labW = wall ? 64 : 128, x0 = cx0 + labW, x1 = cx0 + colW - 8, zx = (x0 + x1) / 2, half = (x1 - x0) / 2;
      function X(v) { return zx + v / mx * half; }
      text(ctx, c.title, cx0, b.y + tY + gT + lineH, { size: 24, w: 500, color: '--color-ink' });
      // 눈금
      ctx.strokeStyle = col('--color-grid'); ctx.lineWidth = 1;
      [-mx, -mx / 2, mx / 2, mx].forEach(function (t) { ctx.beginPath(); ctx.moveTo(X(t), top - 2); ctx.lineTo(X(t), bot + 2); ctx.stroke(); });
      ctx.strokeStyle = col('--color-line-strong'); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(X(0), top - 4); ctx.lineTo(X(0), bot + 4); ctx.stroke();
      [-mx, 0, mx].forEach(function (t) { text(ctx, (t > 0 ? '+' : t < 0 ? '−' : '') + fmt(Math.abs(t), 0), X(t), bot + 16, { size: 22, w: 400, color: '--color-ink-muted', align: t < 0 ? 'left' : t > 0 ? 'right' : 'center' }); });
      c.rows.forEach(function (r, i) {
        var y = top + rh * i + rh / 2, bh = Math.min(30, rh - 10), sum = !!r[3];
        text(ctx, r[0], cx0, y, { size: sum ? 24 : 22, w: 500, color: sum ? '--color-ink' : r[2] });
        if (r[1] === null) return;
        var xa = X(0), xb = X(r[1]), bx = Math.min(xa, xb), bw = Math.abs(xb - xa);
        ctx.fillStyle = col(r[2]);                                   // R3: 전·후 모두 불투명 (A·B 같은 규칙)
        ctx.fillRect(bx, y - bh / 2, bw, bh);
        if (sum) hatch(ctx, bx, y - bh / 2, bw, bh, '--color-paper', 12, 1, 0.5);                            // 합 = 가는 빗금
        var right = r[1] >= 0, tx = right ? Math.max(xa, xb) + 8 : Math.min(xa, xb) - 8;
        if (right && tx > x1 - 70) { right = false; tx = xa - 8; }
        if (!right && tx < x0 + 70) { right = true; tx = xa + 8; }
        text(ctx, sgn(r[1], 2), tx, y, { size: sum ? 24 : 22, w: 500, color: sum ? '--color-ink' : r[2], align: right ? 'left' : 'right' });
      });
      var empty = c.rows.every(function (r) { return r[1] === null; });
      if (empty) {   // R3: 행마다 말고 영역 가운데 한 번 · 축 선이 글자를 지나지 않게 바탕 깔기
        var ew = textW(ctx, '부딪친 뒤 나와요', { size: 22 }) + 24, ey = (top + bot) / 2;
        ctx.fillStyle = col('--color-paper'); rr(ctx, zx - ew / 2, ey - 18, ew, 36, 8); ctx.fill();
        text(ctx, '부딪친 뒤 나와요', zx, ey, { size: 22, w: 400, color: '--color-ink-muted', align: 'center' });
      }
    });
    if (wall) {
      var dp = hit ? pA - pA0 : null;
      text(ctx, dp === null ? '벽에 부딪치면 수레의 운동량이 바뀌어요 — 바뀐 양 $Δp$가 충격량 $I$예요' : '수레 운동량 변화 $Δp$ = 나중 − 처음 = ' + sgn(dp, 2) + ' kg·m/s = 수레가 받은 충격량 $I$',
        b.x, b.y + b.h - 26, { size: 22, w: 500, color: '--color-ink' });
    }
  }

  /** 점무늬 (나중 막대 — 색약 대비: 색 + 테두리 + 무늬) */
  function dots(ctx, x, y, w, h, color) {
    if (w <= 0 || h <= 0) return;
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = col(color); ctx.globalAlpha = 0.55;
    for (var yy = y + 5; yy < y + h; yy += 9) for (var xx = x + 5 + ((yy - y) % 18 ? 4 : 0); xx < x + w; xx += 9) { ctx.beginPath(); ctx.arc(xx, yy, 1.8, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  /** R8(D1): 부딪치는 동안 용수철(범퍼)에 저장된 탄성 에너지 = (처음 운동 에너지 + 처음 용수철 에너지) − 지금 운동 에너지.
      분리(반동)는 처음 용수철 에너지 = 나중 운동 에너지 합(P.ka) — 물리 계산은 그대로, 표시만 */
  function springE0(P) { return P.mode === 'separate' ? P.ka : 0; }
  function springNow() { if (!st) return 0; var P = st.P; return P.kb + springE0(P) - CM.kNow(st); }
  /** R8(D1): 용수철 몫 무늬 — 청보라 옅은 면 + 지그재그(용수철 모양) + 점선 테두리 (열·소리 = 적갈 빗금과 색·무늬 둘 다 다름) */
  function springFill(ctx, x, y, w, h) {
    if (w <= 0.5 || h <= 0) return;
    var c = col('--color-q-energy-spring') || col('--color-primary');
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.globalAlpha = 0.22; ctx.fillStyle = c; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1;
    ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    var amp = h * 0.28, step = 7;
    ctx.beginPath(); ctx.moveTo(x, y + h / 2);
    for (var i = 1, xx = x + step; xx < x + w + step; i++, xx += step) ctx.lineTo(xx, y + h / 2 + (i % 2 ? -amp : amp));
    ctx.stroke();
    ctx.restore();
    ctx.save(); ctx.setLineDash([3, 3]); ctx.strokeStyle = c; ctx.lineWidth = 2.5; ctx.strokeRect(x, y, w, h); ctx.restore();
  }

  function drawKBars(ctx, b, P) {
    var tY = Math.max(22, Math.round(fsMin(26) * 0.62) + 4);   // R8(A12): 제목 줄이 판 위 테두리에 닿지 않게(글자 하한만큼)
    var hit = st.phase !== 'pre', done = st.phase === 'post', contact = st.phase === 'hit', wall = P.mode === 'wall';
    var sep = P.mode === 'separate';
    text(ctx, '운동 에너지 $K$ = ½$mv^2$', b.x + 4, b.y + tY, { size: 26, w: 500 });
    var kA0 = 0.5 * P.m1 * P.v1 * P.v1, kB0 = wall ? 0 : 0.5 * P.m2 * P.v2 * P.v2;
    var ep0 = springE0(P), E0 = kA0 + kB0 + ep0;
    // R5: 끝났고 줄었으면 제목 줄 오른쪽에 결론 한 줄(계산값) — 아니면 단위 안내
    if (done && P.kb - P.ka > 0.005) text(ctx, '운동 에너지 합 ' + fmt(P.kb, 2) + ' → ' + fmt(P.ka, 2) + ' J 줄어듦', b.x + b.w, b.y + tY, { size: 24, w: 500, color: '--color-q-energy-heat', align: 'right' });
    else text(ctx, '단위 J · 방향 없음(늘 + 값)', b.x + b.w, b.y + tY, { size: 22, w: 400, color: '--color-ink-muted', align: 'right' });
    var kA = 0.5 * P.m1 * st.vA * st.vA, kB = wall ? 0 : 0.5 * P.m2 * st.vB * st.vB;
    var rows = [
      { lab: '처음', a: kA0, b: kB0, sp: ep0, heat: 0, y: b.y + 98, after: false },
      { lab: done ? '나중' : '지금', a: hit ? kA : null, b: kB, sp: 0, heat: 0, y: b.y + 186, after: true }
    ];
    // 막대 오른쪽 두 줄 글('합 …' / 무엇이 어디로) — 먼저 정하고 폭을 재서 막대 길이를 맞춘다(R8 D2: 잘림 없이)
    var SPRING = '--color-q-energy-spring';
    rows.forEach(function (r) {
      if (!r.after) {
        r.l1 = '합 ' + fmt(E0, 2) + ' J';
        if (ep0 > 0.005) { r.l2 = '눌린 용수철 $E_p$ ' + fmt(ep0, 2) + ' J'; r.c2 = SPRING; }
        return;
      }
      if (r.a === null) return;
      var tot = r.a + r.b, gap = E0 - tot;
      if (contact && gap > 0.005) {          // 접촉 중: 모자란 몫 = 용수철에 저장(튕기기·중간·달라붙기·분리 모두) — 열·소리 아님
        r.sp = gap; r.l1 = '합 ' + fmt(E0, 2) + ' J'; r.l2 = '용수철에 저장 $E_p$ ' + fmt(gap, 2) + ' J'; r.c2 = SPRING;
      } else if (done && sep) {
        r.l1 = '합 ' + fmt(tot, 2) + ' J'; r.l2 = '저장된 용수철 에너지가 운동 에너지로'; r.c2 = SPRING;
      } else if (done && gap > 0.005) {      // 부딪친 뒤 남은 손실만 열·소리
        r.heat = gap; r.l1 = '합 ' + fmt(tot, 2) + ' J'; r.l2 = '열·소리 ' + fmt(gap, 2) + ' J'; r.c2 = '--color-q-energy-heat';
      } else if (done) { r.l1 = '합 ' + fmt(tot, 2) + ' J'; r.l2 = '그대로'; r.c2 = '--color-ok'; }
      else r.l1 = '합 ' + fmt(tot, 2) + ' J';
    });
    var noteW = 0;
    rows.forEach(function (r) {
      if (r.l1) noteW = Math.max(noteW, textW(ctx, r.l1, { size: 24, w: 500 }));
      if (r.l2) noteW = Math.max(noteW, textW(ctx, r.l2, { size: 22, w: 500 }));
    });
    var chipW = 76, x0 = b.x + 4 + chipW, x1 = Math.max(x0 + 160, b.x + b.w - noteW - 20), W = x1 - x0;
    var mx = Math.max(0.5, E0, kA + kB);
    function wd(v) { return v / mx * W; }
    var lh = Math.round(fsMin(22) * 0.62);
    rows.forEach(function (r) {
      var bh = 40, yt = r.y - bh / 2;
      // 막대 머리: '처음'/'나중' 글자를 막대 안(진한 칸)에
      ctx.fillStyle = col('--color-ink'); rr(ctx, b.x + 4, yt, chipW, bh, 6); ctx.fill();
      text(ctx, r.lab, b.x + 4 + chipW / 2, r.y, { size: 24, w: 500, color: '--color-ink-inverse', align: 'center' });
      if (r.a === null) { text(ctx, '부딪친 뒤 나와요', x0 + 14, r.y, { size: 22, w: 400, color: '--color-ink-muted' }); return; }
      var x = x0, segs = [];
      ctx.fillStyle = col('--color-q-energy-k'); ctx.fillRect(x, yt, wd(r.a), bh);
      segs.push([x, wd(r.a), sep ? '대포' : 'A']);
      x += wd(r.a);
      if (r.b > 0) {
        ctx.globalAlpha = 0.5; ctx.fillStyle = col('--color-q-energy-k'); ctx.fillRect(x, yt, wd(r.b), bh); ctx.globalAlpha = 1;
        segs.push([x, wd(r.b), sep ? '포탄' : 'B']);
        x += wd(r.b);
      }
      var kEnd = x;
      if (r.after && kEnd > x0) {   // 나중 막대(운동 에너지 몫) = 진한 테두리 + 점무늬
        dots(ctx, x0, yt, kEnd - x0, bh, '--color-ink');
        ctx.strokeStyle = col('--color-ink'); ctx.lineWidth = 2.5; ctx.strokeRect(x0, yt, kEnd - x0, bh);
      }
      if (r.sp > 0.005) { springFill(ctx, x, yt, wd(r.sp), bh); segs.push([x, wd(r.sp), '$E_p$']); x += wd(r.sp); }
      if (r.heat > 0.005) {
        var lw = wd(r.heat);
        ctx.save(); ctx.setLineDash([6, 4]); ctx.strokeStyle = col('--color-q-energy-heat'); ctx.lineWidth = 3; ctx.strokeRect(x, yt, lw, bh); ctx.restore();
        hatch(ctx, x, yt, lw, bh, '--color-q-energy-heat', 10);
        x += lw;
      }
      // 나눔 선 + 이름 (막대 위쪽 가운데)
      segs.forEach(function (sg, i) {
        if (i > 0 && sg[1] > 0) { ctx.fillStyle = col('--color-paper'); ctx.fillRect(sg[0] - 1.5, yt, 3, bh); }
        if (sg[1] >= 34) text(ctx, sg[2], sg[0] + sg[1] / 2, yt - 14, { size: 22, w: 500, color: '--color-ink', align: 'center' });
      });
      var tx = x + 12;
      if (r.l2) {
        text(ctx, r.l1, tx, r.y - lh, { size: 24, w: 500, color: '--color-ink' });
        text(ctx, r.l2, tx, r.y + lh, { size: 22, w: 500, color: r.c2 });
      } else if (r.l1) text(ctx, r.l1, tx, r.y, { size: 24, w: 500, color: '--color-ink' });
    });
  }

  function niceTop(v) {
    if (v <= 0) return 10;
    var s = Math.pow(10, Math.floor(Math.log(v) / Math.LN10));
    if (v / s < 3) s /= 2;
    return Math.max(s, Math.floor(v / s) * s);
  }

  function drawFT(ctx, b, P) {
    var tY = Math.max(22, Math.round(fsMin(26) * 0.62) + 4);   // R8(A12): 제목 줄이 판 위 테두리에 닿지 않게(글자 하한만큼)
    var lb = P.mode === 'wall' ? '벽' : P.mode === 'separate' ? '포탄' : 'B';
    var la = P.mode === 'separate' ? '대포' : 'A';
    text(ctx, '힘-시간 그래프', b.x + 4, b.y + tY, { size: 26, w: 500 });
    // 범례 (그래프 바깥 제목 줄)
    var lx = b.x + b.w;
    var t2 = SK.withJosa(lb, '이/가') + ' 받는 힘', t1 = SK.withJosa(la, '이/가') + ' 받는 힘';
    var w2 = textW(ctx, t2, { size: 22, w: 500 }), w1 = textW(ctx, t1, { size: 22, w: 500 });
    text(ctx, t2, lx, b.y + tY, { size: 22, w: 500, color: '--color-ink', align: 'right' });
    SK.drawPath(ctx, [[lx - w2 - 44, b.y + tY], [lx - w2 - 8, b.y + tY]], SK.recStyle(1));
    text(ctx, t1, lx - w2 - 64, b.y + tY, { size: 22, w: 500, color: '--color-ink', align: 'right' });
    SK.drawPath(ctx, [[lx - w2 - w1 - 108, b.y + tY], [lx - w2 - w1 - 72, b.y + tY]], SK.recStyle(0));

    var lines = [];
    SK.records.forEach(function (r) { if (r.series.fb && r.series.fb.length) lines.push({ s: r.series, st: SK.recStyle(r.slot), tau: r.values.tau, rec: r, J: r.values.J, F: r.values.fmax }); });
    if (SK.ghost && SK.ghost.series.fb && SK.ghost.series.fb.length) lines.push({ s: SK.ghost.series, st: SK.ghostStyle(), tau: SK.ghost.values.tau, ghost: true });
    // 둘째 줄: 이번 실행 숫자 + 기록 요약 (그래프 바깥)
    var info = '';
    if (P.meet && P.J > 0 && st.phase !== 'pre') {
      var k = Math.PI / P.tau, tc = st.phase === 'hit' ? st.tc : P.tau;
      var Jnow = P.J * (1 - Math.cos(k * tc)) / 2;
      info = '넓이 = 충격량 $I$ ' + fmt(Jnow, 2) + ' N·s · 최대 힘 ' + fmtF(P.Fmax) + ' N · 평균 ' + fmtF(P.Favg) + ' N';
    }
    // R7(A8): 글자 하한(18px)으로 커진 만큼 줄 간격·그래프 위아래 여백도 늘린다(배율 0.82 이상이면 예전 값)
    var fq = fsMin(22), L2 = b.y + tY + Math.max(32, Math.round(fq * 1.15));
    var recInfo = lines.filter(function (L) { return !L.ghost; }).slice(-2).map(function (L) { return SK.recLabel(L.rec) + ': 최대 ' + fmtF(L.F) + ' N'; }).join('  ·  ');
    text(ctx, info, b.x + 4, L2, { size: 22, w: 500, color: '--color-copper-text' });
    if (recInfo) {
      var iw = info ? textW(ctx, info, { size: 22, w: 500 }) + 30 : 0;
      if (textW(ctx, recInfo, { size: 22 }) < b.w - iw) text(ctx, recInfo, b.x + b.w, L2, { size: 22, w: 400, color: '--color-ink-muted', align: 'right' });
    }

    var pl = b.x + Math.max(70, Math.round(fq * 2.6)), pr = b.x + b.w - 8, pt = L2 + Math.max(22, Math.round(fq * 0.8)), pb = b.y + b.h - Math.max(52, Math.round(fq * 2.1));
    var tauMax = P.tau, fpk = P.meet ? P.Fmax : 0;
    lines.forEach(function (L) { tauMax = Math.max(tauMax, L.tau || 0); L.s.fb.forEach(function (q) { fpk = Math.max(fpk, Math.abs(q[1])); }); });
    if (fpk <= 0) fpk = 10;
    var t0 = -0.2 * tauMax * 1000, t1 = 1.2 * tauMax * 1000, fm = fpk * 1.12;
    function X(t) { return pl + (t - t0) / (t1 - t0) * (pr - pl); }
    function Y(f) { return (pt + pb) / 2 - f / fm * (pb - pt) / 2; }
    // 모눈 + x 눈금 (겹치면 건너뜀)
    var tstep = tauMax <= 0.01 ? 2 : tauMax <= 0.05 ? 10 : 50, lastX = -1e9;
    for (var t = 0; t <= t1 + 1e-6; t += tstep) {
      ctx.strokeStyle = col('--color-grid'); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(X(t), pt); ctx.lineTo(X(t), pb); ctx.stroke();
      if (X(t) - lastX >= 60 && X(t) < pr - 20) { text(ctx, String(Math.round(t)), X(t), pb + Math.max(15, Math.round(fq * 0.6)), { size: 22, w: 400, color: '--color-ink-muted', align: 'center' }); lastX = X(t); }
    }
    text(ctx, '시간 (ms) · 0 = 부딪친 순간', pr, pb + Math.max(39, Math.round(fq * 1.6)), { size: 22, w: 400, color: '--color-ink-muted', align: 'right' });
    var ft = niceTop(fpk);
    ctx.strokeStyle = col('--color-grid'); ctx.lineWidth = 1;
    [ft, -ft].forEach(function (f) { ctx.beginPath(); ctx.moveTo(pl, Y(f)); ctx.lineTo(pr, Y(f)); ctx.stroke(); });
    ctx.strokeStyle = col('--color-line-strong'); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(pl, Y(0)); ctx.lineTo(pr, Y(0)); ctx.moveTo(pl, pt); ctx.lineTo(pl, pb); ctx.stroke();
    text(ctx, '+' + fmt(ft, 0), pl - 6, Y(ft), { size: 22, w: 400, color: '--color-ink-muted', align: 'right' });
    text(ctx, '0', pl - 6, Y(0), { size: 22, w: 400, color: '--color-ink-muted', align: 'right' });
    text(ctx, '−' + fmt(ft, 0), pl - 6, Y(-ft), { size: 22, w: 400, color: '--color-ink-muted', align: 'right' });
    text(ctx, '$F$ (N)', pl + 8, pt + 10, { size: 22, w: 500, color: '--color-ink-muted' });

    ctx.save(); ctx.beginPath(); ctx.rect(pl, pt - 2, pr - pl, pb - pt + 4); ctx.clip();
    function map(a, c) { return [X(a), Y(c)]; }
    lines.forEach(function (L) { SK.drawPath(ctx, L.s.fa, L.st, map); SK.drawPath(ctx, L.s.fb, L.st, map); });
    if (P.meet && st.phase !== 'pre') {
      var cv = CM.curve(P, st.phase === 'hit' ? st.tc : undefined, 90);
      [[cv.fa, '--color-rec-1', 0], [cv.fb, '--color-rec-2', 1]].forEach(function (z) {
        var pts = z[0]; if (pts.length < 2) return;
        ctx.beginPath(); ctx.moveTo(X(pts[0][0]), Y(0));
        pts.forEach(function (q) { ctx.lineTo(X(q[0]), Y(q[1])); });
        ctx.lineTo(X(pts[pts.length - 1][0]), Y(0)); ctx.closePath();
        ctx.globalAlpha = 0.35; ctx.fillStyle = col(z[1]); ctx.fill(); ctx.globalAlpha = 1;
        SK.drawPath(ctx, pts, SK.recStyle(z[2]), map);
      });
    }
    ctx.restore();
    if (!P.meet || P.J <= 0) text(ctx, P.mode === 'separate' ? '포탄 속력이 0이면 힘도 없어요' : '만나지 않으면 힘도 없어요', (pl + pr) / 2, (pt + pb) / 2 - 24, { size: 22, w: 400, color: '--color-ink-muted', align: 'center' });
    else if (st.phase === 'pre') text(ctx, '부딪치면 여기에 그려져요', (pl + pr) / 2, (pt + pb) / 2 - 24, { size: 22, w: 400, color: '--color-ink-muted', align: 'center' });
  }

  /* ---------- HTML 갱신 (계기판·배지·안내) ---------- */
  /** R3: 계기판 값 한 포맷 — 부딪치기 전 '처음', 부딪친 뒤 '처음 → 지금' · 단위는 끝에 한 번(.meter__unit) · 화살표는 .arrow(작게) */
  /** R6(B5): 멈춘 뒤에는 슬로 모션 배지를 내린다(그리기가 멈춰 지난 상태가 남지 않게) */
  function syncBadge() { if (!SK.running && badgeEl && !badgeEl.hidden) badgeEl.hidden = true; }
  /** R6(B3): 실행 전 계기판 빈 줄 아래에 질량 요약 한 줄 'm₁ = 1.0 kg · m₂ = 1.0 kg' */
  var massEl = null;
  function massLine(p) {
    if (!massEl) {
      massEl = SK.h('span', { class: 'cm-massline' });
      meterEmpty.el.appendChild(massEl);
    }
    var t = p.mode === 'wall' ? '$m_1$ = ' + fmt(p.m1, 1) + ' kg'
      : (p.mode === 'separate' ? '대포 $m_1$ = ' : '$m_1$ = ') + fmt(p.m1, 1) + ' kg · ' + (p.mode === 'separate' ? '포탄 $m_2$ = ' : '$m_2$ = ') + fmt(p.m2, 1) + ' kg';
    if (massEl._t !== t) { massEl._t = t; SK.setText(massEl, t); }
  }
  function pairText(before, now, hit) { return hit ? before + ' → ' + now : before; }
  function decorateArrows() {
    var nums = Array.prototype.slice.call(meters.el.querySelectorAll('.meter__value .num'));
    if (meters.moreEl) nums = nums.concat(Array.prototype.slice.call(meters.moreEl.querySelectorAll('.meter__value .num')));
    nums.forEach(function (el) {
      var pair = !!el.querySelector('.arrow') || el.textContent.indexOf(' → ') >= 0;
      if (el.parentNode) el.parentNode.classList.toggle('cm-pair', pair);   // 두 값이면 글자 한 단계 작게(칸 넘침 방지)
      if (el.querySelector('.arrow') || el.textContent.indexOf(' → ') < 0) return;
      var parts = el.textContent.split(' → ');
      el.textContent = '';
      el.appendChild(document.createTextNode(parts[0]));
      el.appendChild(SK.h('span', { class: 'arrow', 'aria-label': '에서', text: '→' }));
      el.appendChild(document.createTextNode(parts.slice(1).join(' → ')));
    });
  }
  function updateHTML(p, P) {
    var hit = st.phase !== 'pre';
    var simple = !!(SK.isSimple && SK.isSimple());
    meterEmpty.show(!SK.started);
    lowerEmpty.show(!SK.started && !simple);
    lowerEmptyS.show(!SK.started && simple);
    massLine(p);
    var verdict = '부딪친 뒤 나와요';
    if (st.phase === 'post' && P.meet) {
      var dk = P.ka - P.kb;
      // R8(D6): 판정은 칩(면·테두리) 대신 ✓ + 글자 — 보존 ✓, 아니면 ×
      verdict = (P.mode === 'wall' ? '× 운동량 바뀜(벽)' : Math.abs(P.pa - P.pb) < 1e-6 ? '✓ 운동량 같음' : '× 운동량 바뀜') + '\n' +
        (dk < -0.005 ? '× 에너지 줄어듦' : dk > 0.005 ? '× 에너지 늘어남' : '✓ 에너지 그대로');
    } else if (st.end) verdict = '부딪치지 않았어요';
    if (SK.setMeter) SK.setMeter('verdict', verdict);
    updatePbar(P);
    updateAdvMeters(P);
    meters.update({
      v1: hit ? pairText(sgn(st.vA0, 1), sgn(st.vA, 1), true) : sgn(st.vA, 1),
      v2: P.mode === 'wall' ? '0.0' : hit ? pairText(sgn(st.vB0, 1), sgn(st.vB, 1), true) : sgn(st.vB, 1),
      // R8(D1): 접촉 중의 '후' 는 중간값 대신 '충돌 중'(운동 에너지 일부가 용수철에 저장 — 손실이 아님)
      p: fmt(P.pb, 2) + ' → ' + (st.phase === 'hit' ? '충돌 중' : hit ? fmt(CM.pNow(st), 2) : '–'),
      k: fmt(P.kb, 2) + ' → ' + (st.phase === 'hit' ? '충돌 중' : hit ? fmt(CM.kNow(st), 2) : '–')
    });
    decorateArrows();
    // R8(D1): 접촉 중 '후' 가 '충돌 중'(글) 이면 단위(kg·m/s · J)를 숨긴다
    ['p', 'k'].forEach(function (k) { var m = meters.el.querySelector('[data-key="' + k + '"]'); if (m) m.classList.toggle('cm-hitting', st.phase === 'hit'); });
    var slowOn = SK.running && st.slow < 0.999;
    badgeEl.hidden = !slowOn;
    if (slowOn) {
      var tx = '슬로 모션 ×1/' + Math.round(1 / st.slow);
      if (badgeEl.textContent !== tx) badgeEl.textContent = tx;
    }
    var um = SK.get('mode'), w = '';
    if (um === 'collide' && SK.get('v1') <= SK.get('v2')) w = '두 수레가 만나지 않아요 — A 속도를 B 보다 크게';
    else if (um === 'wall' && SK.get('v1') <= 0) w = '수레가 벽에 닿지 않아요 — 처음 속도를 + 로';
    warnEl.hidden = !w;
    if (w && warnEl.textContent !== w) warnEl.textContent = w;
  }
})(typeof window !== 'undefined' ? window : null);
