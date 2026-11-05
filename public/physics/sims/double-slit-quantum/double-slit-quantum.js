/* =====================================================================
   이중 슬릿: 빛에서 전자 하나까지 (double-slit-quantum) — R2 고도화 2차 2026-10-28
   공통 틀 SimKit(../../shared/sim.js, docs/SIMKIT.md §0 R2) 위에서 동작. 일반 <script>, file:// 동작.
   명세: docs/04_팀장결정서.md §4-2 · 고도화: docs/개선/R1_계획.md D1~D10, R2_계획.md §4-2

   [물리 모델]  y = 스크린 위 위치(mm, 위쪽 +), 모든 계산은 SI 를 mm 로 환산
     두 슬릿:   I(y) = cos²(π d y / λL) · sinc²(π a y / λL)        (a = 슬릿 폭 0.05 mm, '더 많은 설정'에서만 변경)
     한 슬릿:   I(y) = sinc²(π a (y − y_s) / λL),  y_s = ±d/2
     측정기 켬: I(y) = ½[sinc²(…(y − d/2)) + sinc²(…(y + d/2))]    (간섭항 없음, 확률을 더함)
     구슬:      한 슬릿을 무작위로 골라 곧게 지남. 발사기(슬릿 앞 S = 0.1 m)에서 퍼져 나간 구슬의
                그림자 중심 y_s·(S+L)/S + 가우스 흩어짐 σ = 0.6 mm → 두 띠
     무늬 간격: Δy = λL/d   (650 nm, 0.25 mm, 2.0 m → 5.2 mm / 450 nm → 3.6 mm)
     점 뽑기:   [−30, 30] mm 를 0.05 mm 칸 1200 개로 나눈 누적 분포표의 역함수 표본
     드브로이:  λ = h / √(2 m_e e V)  (1000 V → 38.8 pm). 화면 무늬는 모형: λ_모형 = 650 nm × √(1000 V / V),
                d = 0.05 mm × d(눈금), L = 0.4 m × L(눈금) 를 같은 식에 넣음 → 1000 V·5·5 에서 5.2 눈금 (R8 C3: 길이 단위 '칸' → '눈금' — 화면용 모형 단위. 측정의 n 은 '간격 수')

   [화면 축척]  실험 화면 논리 좌표 1250×660 (stageH 660)
     스크린 세로 480u = 실제 ±30 mm → 8 u/mm · 확대창 400×400u = 가운데 ±15 mm (R2)
     슬릿판~스크린 거리 그림, 슬릿 간격 그림, 파면의 파장은 모형(축척 아님)
   ===================================================================== */
(function (global) {
  'use strict';

  /* ==================================================================
     1. 물리 (순수 함수 — node 검산용으로 global.DSQPhys 에 내보냄)
     ================================================================== */
  var Y_MIN = -30, Y_MAX = 30;      // 스크린 범위 (mm)
  var CDF_STEP = 0.05;              // 누적 분포표 칸 (mm)
  var NB = Math.round((Y_MAX - Y_MIN) / CDF_STEP);  // 1200
  var HIST_W = 0.5;                 // 히스토그램 칸 (mm)
  var NH = Math.round((Y_MAX - Y_MIN) / HIST_W);    // 120
  var S_SRC = 0.1;                  // 구슬 발사기 ~ 슬릿 (m)
  var MARBLE_SIGMA = 0.6;           // 구슬 흩어짐 (mm)
  var H_PLANCK = 6.62607015e-34, M_E = 9.1093837015e-31, Q_E = 1.602176634e-19;

  function sinc(x) { return Math.abs(x) < 1e-12 ? 1 : Math.sin(x) / x; }

  /** g = {kind:'wave'|'photon'|'electron'|'marble', lamNm, dMm, Lm, aMm, slit:'both'|'top'|'bottom', det} */
  function intensity(g, y) {
    if (g.kind === 'marble') {
      var M = (S_SRC + g.Lm) / S_SRC, c = g.dMm / 2 * M, s2 = 2 * MARBLE_SIGMA * MARBLE_SIGMA;
      var gt = Math.exp(-(y - c) * (y - c) / s2), gb = Math.exp(-(y + c) * (y + c) / s2);
      if (g.slit === 'top') return gt;
      if (g.slit === 'bottom') return gb;
      return 0.5 * (gt + gb);
    }
    var lamMm = g.lamNm * 1e-6, Lmm = g.Lm * 1e3;
    var k = Math.PI / (lamMm * Lmm);
    function env(yy) { var s = sinc(k * g.aMm * yy); return s * s; }
    if (g.slit === 'top') return env(y - g.dMm / 2);
    if (g.slit === 'bottom') return env(y + g.dMm / 2);
    if (g.det && g.kind !== 'wave') return 0.5 * (env(y - g.dMm / 2) + env(y + g.dMm / 2));
    var c2 = Math.cos(k * g.dMm * y);
    return c2 * c2 * env(y);
  }
  /** 이론 무늬 간격 Δy = λL/d (mm) */
  function fringe(g) { return g.lamNm * 1e-6 * g.Lm * 1e3 / g.dMm; }
  /** 구슬 두 띠 사이 거리 (mm) */
  function marbleGap(g) { return g.dMm * (S_SRC + g.Lm) / S_SRC; }
  function deBroglieNm(V) { return H_PLANCK / Math.sqrt(2 * M_E * Q_E * V) * 1e9; }

  function buildDist(g) {
    var pdf = new Float64Array(NB), cdf = new Float64Array(NB + 1), imax = 0;
    for (var i = 0; i < NB; i++) {
      var v = intensity(g, Y_MIN + (i + 0.5) * CDF_STEP);
      pdf[i] = v; cdf[i + 1] = cdf[i] + v; if (v > imax) imax = v;
    }
    return { pdf: pdf, cdf: cdf, total: cdf[NB], imax: imax };
  }
  /** 역함수 표본: 칸을 이분 탐색으로 찾고 칸 안에서는 선형 */
  function sampleDist(dist, rnd) {
    var u = rnd() * dist.total, lo = 0, hi = NB - 1;
    while (lo < hi) { var mid = (lo + hi) >> 1; if (dist.cdf[mid + 1] <= u) lo = mid + 1; else hi = mid; }
    var p = dist.pdf[lo], f = p > 0 ? (u - dist.cdf[lo]) / p : 0.5;
    return Y_MIN + (lo + Math.min(Math.max(f, 0), 1)) * CDF_STEP;
  }
  /** 표본 성분: 간섭이면 하나(어느 슬릿인지 정해지지 않음), 측정기·구슬이면 슬릿별 둘 */
  function buildComps(g) {
    var split = g.slit === 'both' && (g.kind === 'marble' || (g.det && g.kind !== 'wave'));
    if (!split) return [{ slit: g.slit === 'both' ? null : g.slit, dist: buildDist(g) }];
    var gt = copy(g), gb = copy(g); gt.slit = 'top'; gb.slit = 'bottom';
    return [{ slit: 'top', dist: buildDist(gt) }, { slit: 'bottom', dist: buildDist(gb) }];
  }
  function sampleComps(comps, rnd) {
    var c = comps.length === 1 ? comps[0] : comps[rnd() < 0.5 ? 0 : 1];
    return { y: sampleDist(c.dist, rnd), slit: c.slit };
  }
  function copy(o) { var r = {}; for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) r[k] = o[k]; return r; }

  /** 파장 → 화면 색 (Bruton 근사, 0~255) */
  function lamRGB(nm) {
    var r, g, b;
    if (nm < 440) { r = (440 - nm) / 60; g = 0; b = 1; }
    else if (nm < 490) { r = 0; g = (nm - 440) / 50; b = 1; }
    else if (nm < 510) { r = 0; g = 1; b = (510 - nm) / 20; }
    else if (nm < 580) { r = (nm - 510) / 70; g = 1; b = 0; }
    else if (nm < 645) { r = 1; g = (645 - nm) / 65; b = 0; }
    else { r = 1; g = 0; b = 0; }
    var f = nm < 420 ? 0.3 + 0.7 * (nm - 380) / 40 : nm > 700 ? 0.3 + 0.7 * (780 - nm) / 80 : 1;
    function c(x) { x = Math.max(0, Math.min(1, x)); return Math.round(255 * Math.pow(x * f, 0.8)); }
    return [c(r), c(g), c(b)];
  }

  var Phys = {
    Y_MIN: Y_MIN, Y_MAX: Y_MAX, CDF_STEP: CDF_STEP, NB: NB, HIST_W: HIST_W, NH: NH, S_SRC: S_SRC, MARBLE_SIGMA: MARBLE_SIGMA,
    sinc: sinc, intensity: intensity, fringe: fringe, marbleGap: marbleGap, deBroglieNm: deBroglieNm,
    buildDist: buildDist, sampleDist: sampleDist, buildComps: buildComps, sampleComps: sampleComps, lamRGB: lamRGB
  };
  global.DSQPhys = Phys;
  if (typeof global.SimKit === 'undefined' || typeof document === 'undefined') return;   // node 검산

  /* ==================================================================
     2. 화면 상수 (논리 좌표 u, 실험 화면 1250×660)
     ------------------------------------------------------------------
     R2: 왼쪽 위(상태 칩, 높이 약 93u)는 비우고, 확대창은 오른쪽 400×400u.
     장치 그림은 x 20~800, 확대창·측정 칸은 x 830~1230. 캔버스 글자는 모두 22u 이상.
     ================================================================== */
  var SK = global.SimKit;
  /* R4: 16:9 보다 세로가 긴 화면(view.extra = E > 0)에서는 스크린·확대창을 E 만큼 길게(layoutFor).
     16:9(E = 0)에서는 아래 값 그대로 — 스크린 480u(8 u/mm) · 확대창 400×400u. 물리 범위(±30 mm·±15 mm)는 그대로. */
  var SCR_X = 640, SCR_W = 56, SCR_TOP = 100, SCR_H = 480, PX_MM = 8, Y0 = SCR_TOP + SCR_H / 2;   // 스크린 ±30 mm
  var SCR_BOT = SCR_TOP + SCR_H, LAY_E = 0;
  var GH_X = 704, GH_W = 22;                       // 직전 실행 무늬 띠
  var RUL_X = 734;                                 // mm 눈금자
  var ZX = 830, ZY = 100, ZW = 400, ZH = 400, Z_RANGE = 15, ZPX = ZH / (2 * Z_RANGE);  // 확대창 (가운데 ±15 mm)
  var ZX0 = ZX;
  var PROF_W = 100;                                // 스크린 왼쪽 밝기 곡선 폭
  var SRC_R = 130;                                 // 광원 오른쪽 끝 x
  var DS = 2;                                      // 오프스크린 해상도 배율
  var T_FLY1 = 0.25, T_FLY2 = 0.25;                // 날아가는 시간(광원→슬릿, 슬릿→스크린)
  var DOT_CAP = 50000;
  var WAVE_END = 1.5;                              // 빛: 켜고 1.5 s 뒤 '끝' (판정·해설)
  var GOAL = 3000;                                 // 하나씩: 3,000개 쌓이면 '끝'
  var V_REF = 1000;                                // 전자 모형: 1000 V 일 때 화면 무늬 = 빛 650 nm 와 같은 크기
  var SNAP_MM = 1.5;                               // 밝은 줄 중심으로 끌어당기는 거리
  var FS = 22;                                     // 캔버스 글자 최소 (u) — 글꼴은 SK.text/SK.font (R4)
  var KIND_LABEL = { wave: '빛(레이저)', photon: '광자 하나씩', electron: '전자 하나씩', marble: '작은 구슬' };
  var SLIT_LABEL = { both: '둘 다 열기', top: '위쪽만 열기', bottom: '아래쪽만 열기' };
  var RATE_LEVELS = [1, 20, 1000];
  var DIST_KEYS = { lam: 1, d: 1, L: 1, V: 1, dR: 1, LR: 1, a: 1, slit: 1, det: 1 };
  var COUNT_WORD = ['', '한', '두', '세', '네', '다섯'];

  /* ---- 상태 ---- */
  var entrance = 'physics';  // 'physics' 빛으로 줄무늬 재기 / 'quantum' 하나씩 보내기
  var cur = null;            // 지금 분포를 만든 값 {p, g, comps, imax, Z}
  /* 히스토그램: 0.1 mm 고운 칸에 쌓고, 그릴 때 무늬 간격에 맞춰 묶는다(칸 ≤ Δy/4). */
  var HF_W = 0.1, NHF = Math.round((Y_MAX - Y_MIN) / HF_W);   // 600
  var count = 0, sinceFade = 0, histF = new Float64Array(NHF), hview = null;
  function fringeMode(g) { return g.kind !== 'marble' && g.slit === 'both' && !(g.det && g.kind !== 'wave'); }
  function histK() {
    if (!cur || !fringeMode(cur.g)) return 5;
    return Math.max(1, Math.min(5, Math.floor(fringe(cur.g) / HF_W / 4)));
  }
  function histView() {
    var k = histK();
    if (hview && hview.k === k && hview.count === count) return hview;
    var n = NHF / k, h = new Float64Array(n);
    for (var i = 0; i < NHF; i++) h[Math.floor(i / k)] += histF[i];
    hview = { k: k, w: HF_W * k, n: n, h: h, count: count };
    return hview;
  }
  var emitAcc = 0, flyers = [], lastDot = null, flash = { top: -9, bottom: -9 };
  var hadRun = false;
  var SIMPLE = false;         // R6(B2): 심플 모드면 캔버스 글자 28u · 측정 칸·안내 숨김 (render 처음에 SK.isSimple() 로 맞춤)
  var simpleSeen = false;     // R6(B2): 심플에서 빛 무늬는 처음 ▶ 실행한 뒤부터 보인다(그 전엔 '▶ 실행하면 줄무늬가 나와요')
  /* 측정: a·b = 두 점(mm), n = 간격 수, geo = 잰 조건(바뀌면 지움), guide = 손가락 안내 상자 */
  var meas = { a: null, b: null, n: 1, drag: false, fresh: false, y0: 0, guide: true, geo: null, snapA: false, snapB: false };
  var quietClear = false;     // 모드를 바꿀 때는 '다른 조건' 안내 없이 지움
  var ghostRef = null, ghostDots = null, ghostPat = null, ghostPatRef = null;
  var burst = false, burstTimer = 0;
  var theoryOpen = false;     // 띠의 이론값 '답 확인하기'를 열었나
  var presetHint = '';        // 실험 카드가 정한 '실행 전' 띠 문장 (25자 안팎)
  var dotsCv, dotsCtx, zoomCv, zoomCtx, patCv, zpatCv;
  var ui = {};               // DOM 참조

  /* 전자 모드: 가속 전압 V → 드브로이 파장. 화면 무늬는 같은 식(Δy = λL/d)에 '모형 단위'로 넣는다 */
  function lamModelNm(V) { return 650 * Math.sqrt(V_REF / V); }
  function pmOf(V) { return deBroglieNm(V) * 1000; }
  function geomOf(p) {
    var el = p.send === 'electron';
    return {
      kind: p.send,
      lamNm: el ? lamModelNm(p.V) : p.lam,
      dMm: el ? 0.05 * p.dR : p.d,
      Lm: el ? 0.4 * p.LR : p.L,
      aMm: p.a, slit: p.slit, det: !!p.det
    };
  }
  function geoKey(g) { return [g.kind, g.lamNm, g.dMm, g.Lm, g.aMm, g.slit, g.det].join('|'); }
  function isQuantum(k) { return k === 'photon' || k === 'electron'; }
  function unitY(p) { return p.send === 'electron' ? '눈금' : 'mm'; }   // R8(C3): 모형 길이 단위 = '눈금'('칸'은 쓰지 않음 — 한 낱말 한 뜻)

  function makeCanvas(w, h) { var c = document.createElement('canvas'); c.width = Math.round(w * DS); c.height = Math.round(h * DS); return c; }
  function rgbStr(c, a) { return a === undefined ? 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')' : 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function lighten(c, t) { return [Math.round(c[0] + (255 - c[0]) * t), Math.round(c[1] + (255 - c[1]) * t), Math.round(c[2] + (255 - c[2]) * t)]; }
  function darken(c, t) { return [Math.round(c[0] * t), Math.round(c[1] * t), Math.round(c[2] * t)]; }
  function curveColor(p) {
    if (p.send === 'electron') return SK.color('--color-sim-slit');
    if (p.send === 'marble') return SK.color('--color-copper');
    return rgbStr(darken(lamRGB(p.lam), 0.72));
  }
  function dotColor(p) {
    if (p.send === 'electron') return SK.color('--color-sim-slit-tint');
    if (p.send === 'marble') return SK.color('--color-copper-tint');
    return rgbStr(lighten(lamRGB(p.lam), 0.35));
  }
  function waveColor(p, a) {
    if (p.send === 'electron') return SK.color('--color-sim-slit');
    return rgbStr(lamRGB(p.lam), a);
  }
  function yToScr(y) { return Y0 - y * PX_MM; }
  function yToZoom(y) { return ZY + ZH / 2 - y * ZPX; }
  function zoomToY(py) { return (ZY + ZH / 2 - py) / ZPX; }
  function slitX(g) { var Lv = Math.max(0.5, Math.min(3.0, g.Lm)); return SCR_X - (50 + 130 * Lv); }
  function slitSep(g) { return 60 + (Math.max(0.1, Math.min(0.5, g.dMm)) - 0.1) / 0.4 * 140; }
  function slitOpenH(g) { return 4 + g.aMm * 160; }
  function waveLen(g) { return 26 * Math.min(2.2, g.lamNm / 650); }
  function fmtN(n) { return Math.round(n).toLocaleString('ko-KR'); }

  /* ==================================================================
     3. 분포·점 쌓기
     ================================================================== */
  function rebuild(p) {
    var g = geomOf(p);
    var comps = (g.kind === 'wave') ? null : buildComps(g);
    var dist = buildDist(g);
    cur = { p: copy(p), g: g, comps: comps, dist: dist, imax: dist.imax || 1, Z: dist.total * CDF_STEP };
    buildPattern();
  }
  function clearDots() {
    count = 0; sinceFade = 0; histF = new Float64Array(NHF); hview = null; emitAcc = 0; flyers = []; lastDot = null;
    dotsCtx.setTransform(1, 0, 0, 1, 0, 0); dotsCtx.clearRect(0, 0, dotsCv.width, dotsCv.height);
    zoomCtx.setTransform(1, 0, 0, 1, 0, 0); zoomCtx.clearRect(0, 0, zoomCv.width, zoomCv.height);
  }
  function buildPattern() {
    var col = lamRGB(cur.p.send === 'electron' ? 650 : cur.p.lam);
    function paint(cv, rows, toY) {
      var c = cv.getContext('2d'), img = c.createImageData(1, rows);
      for (var j = 0; j < rows; j++) {
        var f = intensity(cur.g, toY(j + 0.5)) / cur.imax, o = j * 4;
        img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = Math.round(255 * Math.min(1, f));
      }
      c.putImageData(img, 0, 0);
    }
    paint(patCv, SCR_H, function (j) { return Y_MAX - j / PX_MM; });
    paint(zpatCv, ZH, function (j) { return Z_RANGE - j / ZPX; });
  }
  function deposit(y) {
    count++; sinceFade++;
    var hb = Math.floor((y - Y_MIN) / HF_W); if (hb >= 0 && hb < NHF) histF[hb]++;
    var col = dotColor(cur.p);
    dotsCtx.fillStyle = col; zoomCtx.fillStyle = col;
    drawDot(y);
    if (sinceFade >= DOT_CAP) fadeDots();
    lastDot = { y: y, t: SK.time };
  }
  function drawDot(y) {
    var x = 5 + Math.random() * (SCR_W - 10), yy = (Y_MAX - y) * PX_MM;
    dotsCtx.beginPath(); dotsCtx.arc(x * DS, yy * DS, 2.6 * DS, 0, 6.2832); dotsCtx.fill();
    if (Math.abs(y) < Z_RANGE) {
      var zx = 5 + Math.random() * (ZW - 10), zy = (Z_RANGE - y) * ZPX;
      zoomCtx.beginPath(); zoomCtx.arc(zx * DS, zy * DS, 2.4 * DS, 0, 6.2832); zoomCtx.fill();
    }
  }
  function fadeDots() {
    sinceFade = 0;
    [dotsCtx, zoomCtx].forEach(function (c) {
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = 'destination-out'; c.globalAlpha = 0.6;
      c.fillStyle = SK.color('--color-ink'); c.fillRect(0, 0, c.canvas.width, c.canvas.height);
      c.restore();
    });
  }
  function emitOne(p, rate) {
    var s = sampleComps(cur.comps, Math.random);
    if (rate <= 60) {
      if (flyers.length < 200) flyers.push({ t0: SK.time, y: s.y, slit: s.slit, dep: true });
      else deposit(s.y);
    } else {
      deposit(s.y);
      if (flyers.length < 12 && Math.random() < 30 / rate) flyers.push({ t0: SK.time, y: s.y, slit: s.slit, dep: false });
    }
  }
  function skipMany(n) {
    if (!cur || cur.p.send === 'wave') { SK.notice('한꺼번에 보내기는 하나씩 보낼 때 써요', 'info'); return; }
    if (SK.predicting()) return;
    if (!SK.started) SK.stepFrame(1);
    if (SK.stepName === '예측') SK.goStep(1);
    for (var i = 0; i < n; i++) deposit(sampleComps(cur.comps, Math.random).y);
    hadRun = true;
    if (SK.started && !SK.finished && count >= GOAL) SK.finish();
    else SK.notice('1만 개 보냄 · 모두 ' + fmtN(count) + '개', 'ok', 2000);
    SK.requestRender();
  }
  function hasData() { return cur && ((cur.p.send === 'wave' && hadRun) || count >= 30); }

  /* 값이 바뀌면 SimKit 의 '새 실행'으로 넘긴다(SK.reset) — 바꾸기 전 무늬는 직전 실행으로 남김 */
  var suppressCapture = false;
  function onDistChange() {
    var oldP = cur ? copy(cur.p) : null, keep = !burst && hasData();
    var wasRunning = SK.running;
    burst = true; clearTimeout(burstTimer);
    burstTimer = setTimeout(function () { burst = false; }, 700);
    suppressCapture = !keep;
    SK.reset();
    suppressCapture = false;
    if (keep && SK.ghost && oldP) { SK.ghost.params = oldP; ghostPatRef = null; }
    if (wasRunning) SK.play();
    SK.requestRender();
  }
  function snapshotGhostDots() {
    ghostRef = SK.ghost;
    if (count > 0 && cur.p.send !== 'wave') {
      ghostDots = makeCanvas(SCR_W, SCR_H);
      ghostDots.getContext('2d').drawImage(dotsCv, 0, 0);
    } else ghostDots = null;
  }

  /* ==================================================================
     4. 측정 (확대창) — ① 시작점 누르기 → ② 끝점 누르기 → ③ 간격 수 n 맞추기
        · 밝은 줄 중심 ±1.5 mm 안이면 중심으로 끌림(스냅)
        · 두 점 사이 간격 수를 세어 n 을 제안(토스트)
        · ↻ 다시 실행해도 측정 선은 남고, λ·d·L 이 바뀌면 안내 후 지움
     ================================================================== */
  function clearMeasure() { meas.a = null; meas.b = null; meas.drag = false; meas.geo = null; meas.snapA = meas.snapB = false; }
  function measuredGap() {
    if (meas.a === null || meas.b === null || Math.abs(meas.a - meas.b) < 0.05) return null;
    return Math.abs(meas.a - meas.b) / meas.n;
  }
  function measStage() { return meas.a === null ? 1 : meas.b === null || measuredGap() === null ? 2 : 3; }
  function canSnap() { return cur && fringeMode(cur.g) && patternVisible(cur.p) && !resultsHidden(); }
  /** 밝은 줄 중심(y = mΔy)으로 끌어당기기 → {y, snap} */
  function snapY(y) {
    if (!canSnap()) return { y: y, snap: false };
    var dy = fringe(cur.g), c = Math.round(y / dy) * dy;
    if (Math.abs(c) <= Z_RANGE && Math.abs(y - c) <= Math.min(SNAP_MM, 0.45 * dy)) return { y: c, snap: true };
    return { y: y, snap: false };
  }
  var N_MAX = 5;
  var MY = ZY + ZH;   // 확대창 아래 측정 칸 시작 y (500 + E)
  /* R8(C1): 측정 단추(− n + · 지우기 · 측정 방법)는 캔버스 그림이 아니라 캔버스 위 HTML 단추(Tab·Enter·화면 읽기).
     BTN 은 그 단추들이 놓일 자리(논리 u) — placeMeasDom 이 화면 px 로 옮긴다. 손가락 크기: −/+ 는 화면 44px 이상 */
  var BTN = {
    minus: { x: ZX + 154, y: MY + 50, w: 56, h: 52 },
    num: { x: ZX + 214, y: MY + 50, w: 64, h: 52 },
    plus: { x: ZX + 282, y: MY + 50, w: 56, h: 52 },
    clear: { x: ZX + ZW - 84, y: MY + 50, w: 84, h: 52 },
    how: { x: ZX + ZW - 150, y: ZY - 52, w: 150, h: 44, round: false }
  };
  /* R7 학생점검(A8)·R8(C1·C5): 글자 하한으로 캔버스 글자가 커지거나(배율 < 0.82) 단추가 44px 이 되려면 확대창 아래 측정 칸을 키우고 확대창을 줄인다.
     ML = 측정 칸 줄 위치(MY 기준 오프셋). narrow = 이름 '간격 수 n' 이 단추 줄에 안 들어가 한 줄 위(지우기와 같은 줄)로 */
  var ML = { r1: 24, by: 50, bh: 52, r3: 134, two: false, h: 160, narrow: false, lr: 50 }, LAY_K = 1, LAY_SIMPLE = false, mctx = null;
  function measureW(str, size, w) {
    if (!mctx) mctx = document.createElement('canvas').getContext('2d');
    return SK.measure(mctx, str, { size: size, weight: w || 400 }).w;
  }
  function measLayout() {
    var f = fsMin(FS), k = f / 22, sc = (SK.view && SK.view.scale) || 1;
    var bh = Math.max(52, Math.ceil(46 / sc)), bw = bh, iw = Math.max(64, Math.ceil(40 / sc)), gap = 8;
    var cw = Math.max(84, bh, Math.round(measureW('지우기', f, 500) + 24));
    var labW = Math.round(measureW('간격 수 $n$', f) + 18);
    var narrow = labW + bw + gap + iw + gap + bw + gap * 2 + cw > ZW;
    var r1 = Math.round(24 * k), lr = Math.round(46 * k), by = narrow ? lr + bh + gap : Math.round(50 * k);
    var r3 = by + bh + Math.max(32, Math.round(0.8 * f));
    // 마지막 줄 '간격 1개 = Δy  5.20 mm' 이 한 줄에 안 들어가면 값을 다음 줄로
    var two = measureW('간격 1개 = $Δy$', f) + measureW('00.00 mm', fsMin(28), 500) + 16 > ZW;
    var h = Math.max(160, (two ? r3 + Math.round(1.1 * f) : r3) + Math.round(0.6 * f));
    // R8(C9): 심플 식 칸 — 결과 줄('= 5.2 mm', 36u) 아래 여백 24u
    if (SIMPLE) h = Math.max(180, Math.round(148 * k + 0.6 * f + 24));
    ML = { r1: r1, by: by, bh: bh, r3: r3, two: two, h: h, k: k, narrow: narrow, lr: lr };
    BTN.minus.w = BTN.plus.w = bw; BTN.num.w = iw; BTN.clear.w = cw;
    BTN.minus.h = BTN.plus.h = BTN.num.h = BTN.clear.h = bh;
    BTN.minus.x = narrow ? ZX : ZX + labW;
    BTN.num.x = BTN.minus.x + bw + gap; BTN.plus.x = BTN.num.x + iw + gap;
    BTN.clear.x = ZX + ZW - cw;
    // '측정 방법 ?' 알약: 글자 폭에 맞춰 넓힌다(오른쪽 끝 맞춤). R8(C5): 제목 '확대 보기 ±15 mm' 와 겹치면 '?' 원으로
    var hs = fsMin(FS), hh = Math.max(44, Math.ceil(36 / sc));
    var hw = Math.max(150, Math.round(measureW('측정 방법', hs, 500) + hs * 1.1 + 6 + 28));
    // 제목 '확대 보기 ±15 mm' + 알약 → 안 되면 '확대 ±15 mm' + 알약 → 그래도 안 되면 '확대 보기 ±15 mm' + '?' 원
    BTN.how.short = false; BTN.how.round = false;
    if (measureW(zoomTitle(true), hs, 500) + 16 + hw > ZW) {
      if (measureW(zoomTitle(false), hs, 500) + 16 + hw <= ZW) BTN.how.short = true;
      else { BTN.how.round = true; hw = hh; BTN.how.short = measureW(zoomTitle(true), hs, 500) + 16 + hw > ZW; }
    }
    BTN.how.w = hw; BTN.how.h = hh; BTN.how.x = ZX + ZW - hw; BTN.how.y = ZY - hh - 6;
  }
  /** 확대창 제목 — 단추와 닿으면 짧게(R7 A8) */
  var zoomUnit = 'mm';
  function zoomTitle(full) { return (full ? '확대 보기 ±' : '확대 ±') + Z_RANGE + ' ' + zoomUnit; }
  /** R4: 세로 여유 E(논리 u) 만큼 스크린·확대창을 늘린다. 16:9 는 E = 0 → R3 와 같은 좌표 */
  function layoutFor(E) {
    E = Math.max(0, Math.round(E || 0));
    var sc = (SK.view && SK.view.scale) || 1, simple = !!(SK.isSimple && SK.isSimple()), fk = fsKey();
    if (E === LAY_E && sc === LAY_K && simple === LAY_SIMPLE && fk === LAY_FK && dotsCv) return false;
    LAY_E = E; LAY_K = sc; LAY_SIMPLE = simple; LAY_FK = fk;
    var fs0 = FS, sm0 = SIMPLE; FS = simple ? 28 : 22; SIMPLE = simple; measLayout(); FS = fs0; SIMPLE = sm0;
    // R8(A12): 스크린 아래 '이중 슬릿·스크린' 이름 + L 치수선(보조 글자 20px 이상)이 무대(아래 80u) 안에 들어가게 — 모자라면 스크린을 그만큼 짧게(그림 축척만)
    var lf = (function () { var f0 = FS; FS = simple ? 28 : 22; var a = fsMin(FS); FS = f0; return a; })();
    var lsz = Math.max(lf, Math.ceil(20 / sc));
    LBL_Y = Math.max(54, Math.round(10 + lf * 1.1 + 8 + lsz * 0.62));   // 팀장 R8 결과: 이름 줄(10 + 글자 높이)이 내려간 만큼
    var below = LBL_Y + Math.round(lsz * 0.62) + 4;
    SCR_H = 480 + E - Math.max(0, below - 80); PX_MM = SCR_H / (Y_MAX - Y_MIN); Y0 = SCR_TOP + SCR_H / 2; SCR_BOT = SCR_TOP + SCR_H;
    ZH = 400 + E - (ML.h - 160); ZPX = ZH / (2 * Z_RANGE);
    MY = ZY + ZH;
    BTN.minus.y = BTN.plus.y = BTN.num.y = MY + ML.by;
    BTN.clear.y = ML.narrow ? MY + ML.lr : MY + ML.by;
    measDomKey = '';
    return true;
  }
  var LAY_FK = '', LBL_Y = 54;
  /** 화면 크기가 바뀌면 오프스크린(점·무늬)을 새 크기로 만들고 쌓인 점을 히스토그램에서 다시 찍는다 */
  function makeOffscreens() {
    dotsCv = makeCanvas(SCR_W, SCR_H); dotsCtx = dotsCv.getContext('2d');
    zoomCv = makeCanvas(ZW, ZH); zoomCtx = zoomCv.getContext('2d');
    patCv = document.createElement('canvas'); patCv.width = 1; patCv.height = SCR_H;
    zpatCv = document.createElement('canvas'); zpatCv.width = 1; zpatCv.height = ZH;
    ghostPatRef = null;
    if (!cur) return;
    buildPattern();
    if (!count) return;
    var col = dotColor(cur.p), keep = Math.min(1, DOT_CAP / count);
    dotsCtx.fillStyle = col; zoomCtx.fillStyle = col;
    for (var i = 0; i < NHF; i++) {
      for (var k = 0; k < histF[i]; k++) if (keep >= 1 || Math.random() < keep) drawDot(Y_MIN + (i + Math.random()) * HF_W);
    }
  }
  function onStageResize(view) {
    view.offsetY = 0;      // 늘어난 높이는 스크린·확대창이 차지(광축 Y0 가 가운데로 따라 내려감)
    if (layoutFor(view.extra) && dotsCv) makeOffscreens();
  }
  function inRect(pt, r) { return pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h; }
  function setN(n, quiet) {
    var nv = Math.max(1, Math.min(N_MAX, n));
    if (nv === meas.n) { syncNum(); return; }
    meas.n = nv;
    if (!quiet && SK.say) SK.say('', 1);   // R7(C2): 'n = k 로 맞췄어요' 띠 알림이 바뀐 n 과 어긋나지 않게 바로 걷는다
    syncNum();
    SK.requestRender(); SK.update();
    if (!quiet) checkRatio();
  }
  /** R7 학생점검(C2): 잰 간격 ÷ 이론값 비가 1.8배 이상·1/1.8 이하이면 간격 수 n 이 안 맞은 것 → 1(너무 큼)·-1(너무 작음)·0 */
  function ratioOff() {
    var mg = measuredGap();
    if (mg === null || !cur || !fringeMode(cur.g) || !patternVisible(cur.p)) return 0;
    var r = mg / fringe(cur.g);
    return r >= 1.8 ? 1 : r <= 1 / 1.8 ? -1 : 0;
  }
  /** 이론값과 1.8배 이상 차이면 간격 수를 다시 보라고 알려 준다 (− + 를 눌렀을 때만).
      R7 학생점검(C2): 실행 단계에서는 띠 문장(taskRun)이 같은 말을 하므로 토스트를 띄우지 않는다(중복 금지) */
  function checkRatio() {
    if (!canSnap() || SK.stepIndex === 1) return;
    var off = ratioOff();
    if (off > 0) SK.notice('간격 여러 개를 쟀어요 — 간격 수 $n$ 을 맞춰요', 'warn');
    else if (off < 0) SK.notice('$n$ 이 너무 커요 — 밝은 줄 사이 간격 수를 다시 세어 봐요', 'warn');
  }
  /** 두 점을 다 찍었을 때: 사이의 간격 수 k 를 셀 수 있으면 바로 n = k (R7 학생점검 C2 — 확인창 없이 토스트) */
  var suggesting = false;   // (예전 확인창 상태 — 지금은 늘 false. 띠 문장 판정에만 남김)
  function finishMeasure() {
    meas.geo = cur ? geoKey(cur.g) : null;
    if (measuredGap() === null || !canSnap()) { SK.update(); return; }
    var k = Math.round(Math.abs(meas.a - meas.b) / fringe(cur.g));
    if (k < 1) { SK.notice('서로 다른 밝은 줄 두 곳을 골라요', 'warn'); return; }
    if (k > N_MAX) { SK.notice('간격이 너무 많아요. 간격 5개 안쪽을 재요', 'warn'); SK.update(); return; }
    if (k === meas.n) { SK.update(); return; }
    meas.n = k; syncNum();
    SK.notice('간격 ' + k + '개를 쟀어요 → $n$ = ' + k + SK.josa(String(k), '으로/로') + ' 맞췄어요(− +로 바꿀 수 있어요)', 'ok');
    SK.requestRender(); SK.update();
  }
  /** A 또는 B 찍기 (누르기·Enter 공통) — A·B 가 다 있거나 A 가 없으면 새 A, A 만 있으면 B */
  function placePoint(y, snap) {
    if (meas.a !== null && meas.b === null) { meas.b = y; meas.snapB = snap; meas.fresh = false; return 'B'; }
    meas.a = y; meas.snapA = snap; meas.b = null; meas.snapB = false; meas.fresh = true;
    return 'A';
  }
  function installPointer() {
    var cv = SK.view.canvas, active = null;
    function inZoom(pt) { return pt.x >= ZX && pt.x <= ZX + ZW && pt.y >= ZY && pt.y <= ZY + ZH; }
    cv.addEventListener('pointerdown', function (e) {
      var pt = SK.view.toLogical(e);
      meas.guide = false;                       // 손가락 안내는 첫 누름에 사라진다 (다시: '측정 방법 ?')
      if (SK.predicting()) { SK.requestRender(); return; }
      if (inZoom(pt) && !SIMPLE) {   // R6(B2): 심플은 확대창에서 재지 않는다(값은 측정 칸 Δy)
        var s = snapY(Math.max(-Z_RANGE, Math.min(Z_RANGE, zoomToY(pt.y))));
        if (placePoint(s.y, s.snap) === 'A') meas.y0 = pt.y;
        meas.drag = true; active = e.pointerId;
        try { cv.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
        SK.requestRender(); SK.update(); e.preventDefault(); return;
      }
      // 슬릿을 직접 눌러 막기·열기
      if (cur) {
        var g = cur.g, sx = slitX(g), sep = slitSep(g);
        if (Math.abs(pt.x - sx) < 36) {
          var which = Math.abs(pt.y - (Y0 - sep / 2)) < 36 ? 'top' : Math.abs(pt.y - (Y0 + sep / 2)) < 36 ? 'bottom' : null;
          if (which) {
            var sl = SK.get('slit');
            var nv = sl === 'both' ? (which === 'top' ? 'bottom' : 'top') : (sl === which ? 'both' : sl);
            if (nv !== sl) SK.set('slit', nv);
          }
        }
      }
      SK.requestRender();
    });
    cv.addEventListener('pointermove', function (e) {
      var pt = SK.view.toLogical(e);
      cv.style.cursor = inZoom(pt) && !SIMPLE ? 'crosshair' : '';
      if (!meas.drag || e.pointerId !== active) return;
      var s = snapY(Math.max(-Z_RANGE, Math.min(Z_RANGE, zoomToY(pt.y))));
      if (meas.fresh) { if (Math.abs(pt.y - meas.y0) > 8) { meas.b = s.y; meas.snapB = s.snap; } }
      else { meas.b = s.y; meas.snapB = s.snap; }
      SK.requestRender();
    });
    function up(e) {
      if (e.pointerId !== active) return;
      meas.drag = false; active = null;
      if (meas.a !== null && meas.b !== null) finishMeasure();
      SK.requestRender(); SK.update();
    }
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
  }

  /* ---- R8(C1): 키보드 측정 — 확대창 위 투명 칸(tabindex 0 · role application) + 캔버스 밖 단추 ----
     ↑/↓(←/→) = 밝은 줄 후보(이론 극대 위치 mΔy, 줄무늬가 없으면 1 눈금씩) 옮기기 · Enter/Space = A·B 찍기 · Delete = 지우기 */
  var kb = { on: false, y: 0 };
  var measDomKey = '';
  function keyCandidates() {
    var list = [], i;
    if (canSnap()) {
      var dy = fringe(cur.g), m = Math.floor(Z_RANGE / dy);
      for (i = -m; i <= m; i++) list.push({ y: i * dy, snap: true });
    } else for (i = -Z_RANGE; i <= Z_RANGE; i++) list.push({ y: i, snap: false });
    return list;
  }
  function nearestIdx(list, y) {
    var bi = 0, bd = Infinity;
    list.forEach(function (c, i) { var d = Math.abs(c.y - y); if (d < bd) { bd = d; bi = i; } });
    return bi;
  }
  function keyLabel() {
    var u = cur ? unitY(cur.p) : 'mm', where = (kb.y > 0.05 ? '+' : '') + SK.fmt(kb.y, 1) + ' ' + u;
    var next = meas.a !== null && meas.b === null ? 'B(다른 밝은 줄)' : 'A(밝은 줄 하나)';
    return '확대 보기 측정 — 후보 ' + where + '. 위·아래 화살표로 옮기고 Enter 로 ' + next + ' 를 찍어요';
  }
  function buildMeasDom() {
    function mk(tag, attrs, kids) { var el = SK.h(tag, attrs, kids); el.style.position = 'absolute'; return el; }
    ui.zoomKey = mk('div', { class: 'dsq-zoomkey', tabindex: '0', role: 'application', 'aria-label': '확대 보기 측정' });
    ui.zoomKey.addEventListener('focus', function () {
      kb.on = true; meas.guide = false;
      var list = keyCandidates(), base = meas.a !== null && meas.b === null ? meas.a : 0, i = nearestIdx(list, base);
      if (meas.a !== null && meas.b === null && list.length > 1) i = Math.min(list.length - 1, i + 1);   // B 는 A 바로 위 후보부터
      kb.y = list[i] ? list[i].y : 0;
      ui.zoomKey.setAttribute('aria-label', keyLabel());
      SK.requestRender();
    });
    ui.zoomKey.addEventListener('blur', function () { kb.on = false; SK.requestRender(); });
    ui.zoomKey.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey || SIMPLE || SK.predicting()) return;
      var c = e.code, list, i;
      if (c === 'ArrowUp' || c === 'ArrowRight' || c === 'ArrowDown' || c === 'ArrowLeft') {
        list = keyCandidates(); i = nearestIdx(list, kb.y);
        i = Math.max(0, Math.min(list.length - 1, i + (c === 'ArrowUp' || c === 'ArrowRight' ? 1 : -1)));
        kb.y = list[i].y;
      } else if (c === 'Home') kb.y = 0;
      else if (c === 'Enter' || c === 'NumpadEnter' || c === 'Space') {
        if (e.repeat) { e.preventDefault(); e.stopPropagation(); return; }
        list = keyCandidates(); i = nearestIdx(list, kb.y);
        var who = placePoint(list[i].y, list[i].snap);
        meas.drag = false;
        if (who === 'B') finishMeasure();
        else if (list.length > 1) kb.y = list[Math.min(list.length - 1, i + 1)].y;   // 다음 후보로(B 를 바로 고를 수 있게)
        SK.update();
      } else if (c === 'Delete' || c === 'Backspace') { clearMeasure(); SK.update(); }
      else return;   // 그 밖의 키(Esc·숫자·Tab …)는 공통 틀로
      e.preventDefault(); e.stopPropagation();
      ui.zoomKey.setAttribute('aria-label', keyLabel());
      SK.requestRender();
    });
    function btn(cls, label, kids, onClick) {
      var b = mk('button', { class: 'btn btn--secondary dsq-mbtn ' + cls, type: 'button', 'aria-label': label, title: label }, kids);
      b.addEventListener('click', function (e) { if (e.detail > 0) b.blur(); if (cls !== 'dsq-mbtn--how') meas.guide = false; onClick(); SK.requestRender(); SK.update(); });
      return b;
    }
    ui.mMinus = btn('dsq-mbtn--pm', '간격 수 n 줄이기', [SK.h('span', { 'aria-hidden': 'true', text: '−' })], function () { setN(meas.n - 1); });
    ui.mPlus = btn('dsq-mbtn--pm', '간격 수 n 늘리기', [SK.h('span', { 'aria-hidden': 'true', text: '+' })], function () { setN(meas.n + 1); });
    ui.mClear = btn('dsq-mbtn--clear', '측정 지우기', ['지우기'], function () { clearMeasure(); });
    ui.mHow = btn('dsq-mbtn--how', '측정 방법', [SK.h('span', { class: 'dsq-mbtn__t', text: '측정 방법' }), SK.icon('help') || '?'], function () { meas.guide = !meas.guide; });
    ui.mNum = mk('input', { class: 'dsq-mnum num', type: 'number', min: '1', max: String(N_MAX), step: '1', value: '1', inputmode: 'numeric', 'aria-label': '사이 간격 수 n (1~5)' });
    ui.mNum.addEventListener('change', function () { var v = parseInt(ui.mNum.value, 10); if (isFinite(v)) setN(v); else syncNum(); });
    ui.mNum.addEventListener('input', function () { var v = parseInt(ui.mNum.value, 10); if (isFinite(v) && v >= 1 && v <= N_MAX) setN(v); });
    ui.mNum.addEventListener('keydown', function (e) {
      if (e.code === 'Enter' || e.code === 'NumpadEnter') { var v = parseInt(ui.mNum.value, 10); if (isFinite(v)) setN(v); else syncNum(); e.preventDefault(); }
    });
    [ui.zoomKey, ui.mHow, ui.mMinus, ui.mNum, ui.mPlus, ui.mClear].forEach(function (el) { el.hidden = true; SK.el.stage.appendChild(el); });
  }
  function syncNum() { if (ui.mNum && document.activeElement !== ui.mNum && ui.mNum.value !== String(meas.n)) ui.mNum.value = String(meas.n); }
  /** 측정 단추를 캔버스 좌표(BTN) 자리에 놓고 보이기·숨기기 (render 마다, 바뀐 것만) */
  function placeMeasDom(view, p, hide) {
    if (!ui.zoomKey) return;
    var off = SIMPLE || hide || howHidden();
    var guide = !off && meas.guide && patternVisible(p) && fringeMode(cur.g);
    var key = [off, guide, view.ox, view.oy, view.scale, view.offsetY, MY, ZH, BTN.how.w, BTN.how.round, BTN.minus.x, BTN.clear.y].join('|');
    ui.mMinus.disabled = meas.n <= 1; ui.mPlus.disabled = meas.n >= N_MAX; ui.mClear.disabled = meas.a === null;
    syncNum();
    if (ui.mHow.getAttribute('aria-pressed') !== String(!!meas.guide)) ui.mHow.setAttribute('aria-pressed', String(!!meas.guide));
    if (key === measDomKey) return;
    measDomKey = key;
    function put(el, r, show) {
      el.hidden = !show; if (!show) return;
      var at = view.toPx(r.x, r.y), s = view.scale;
      el.style.left = at.x + 'px'; el.style.top = at.y + 'px';
      el.style.width = Math.round(r.w * s) + 'px'; el.style.height = Math.round(r.h * s) + 'px';
    }
    var fpx = Math.round(fsMin(FS) * view.scale) + 'px';
    [ui.mHow, ui.mMinus, ui.mPlus, ui.mClear, ui.mNum].forEach(function (el) { el.style.fontSize = fpx; });
    ui.mHow.classList.toggle('is-round', !!BTN.how.round);
    put(ui.zoomKey, { x: ZX, y: ZY, w: ZW, h: ZH }, !off);
    put(ui.mHow, BTN.how, !off);
    put(ui.mMinus, BTN.minus, !off && !guide);
    put(ui.mNum, BTN.num, !off && !guide);
    put(ui.mPlus, BTN.plus, !off && !guide);
    put(ui.mClear, BTN.clear, !off && !guide);
  }

  /* ==================================================================
     5. 기록용 결과
     ================================================================== */
  function theoryText(p, g) {
    if (p.send === 'marble') return '줄무늬 없음';
    if (!fringeMode(g)) return '줄무늬 없음';
    return SK.fmt(fringe(g), 1) + ' ' + unitY(p);
  }
  function lamText(p) {
    if (p.send === 'marble') return '—';
    if (p.send === 'electron') return SK.fmt(pmOf(p.V), 1) + ' pm';
    return p.lam + ' nm';
  }
  function captureFrom(p) {
    var g = geomOf(p), pts = [], imax = 0, i, y;
    var vals = [];
    for (i = 0; i <= 600; i++) { y = Y_MIN + i * 0.1; var v = intensity(g, y); vals.push(v); if (v > imax) imax = v; }
    for (i = 0; i <= 600; i++) pts.push([Y_MIN + i * 0.1, vals[i] / (imax || 1)]);
    var el = p.send === 'electron', mg = measuredGap();
    return {
      series: { I: pts },
      values: {
        lamT: lamText(p),
        dT: el ? p.dR + ' 눈금' : SK.fmt(p.d, 2) + ' mm',
        LT: el ? p.LR + ' 눈금' : SK.fmt(p.L, 1) + ' m',
        count: p.send === 'wave' ? '—' : count,
        meas: mg === null ? '안 잼' : SK.fmt(mg, 2) + ' ' + unitY(p),
        theo: theoryText(p, g),
        measN: mg,
        theoN: fringeMode(g) ? fringe(g) : null
      }
    };
  }

  /* ==================================================================
     6. 그리기
     ================================================================== */
  /** R4: 캔버스 글자는 모두 SK.text — 에스코어 드림 400(라벨)·500(강조), 기호는 $…$ 수식(기울임 + 아래첨자) */
  /** R7 학생점검(A8): 캔버스 글자 하한 = max(18px, N u) — 작은 화면(배율 < 0.82)에서는 u 를 키워 화면 18px 을 지킨다 */
  /* R8(A12): 하한은 tokens.css --fs-canvas-min(18px, ≥1600 은 26px)을 읽고, 전자칠판(화면 폭 ≥1600)에서는 글자를 ×1.15.
     (SK.fs 헬퍼와 같은 규칙: max(base·배율, 하한) — 이 sim 은 논리 u 로 계산하므로 같은 식을 u 로 둔다) */
  var fsTok = { w: -1, min: 18, boost: 1 };
  function fsKey() {
    var w = (typeof innerWidth === 'number') ? innerWidth : 0;
    if (w !== fsTok.w) {
      fsTok.w = w;
      var v = 18;
      try { v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fs-canvas-min')) || 18; } catch (e) { v = 18; }
      fsTok.min = v; fsTok.boost = w >= 1600 ? 1.15 : 1;
    }
    return fsTok.min + '|' + fsTok.boost + '|' + zoomUnit;
  }
  function fsMin(n) {
    var sc = (SK.view && SK.view.scale) || 1;
    fsKey();
    return Math.max(Math.round((n || FS) * fsTok.boost), FS, Math.ceil(fsTok.min / sc));
  }
  function txt(ctx, s, x, y, o) {
    o = o || {};
    if (o.raw) ctx.fillStyle = o.raw;
    return SK.text(ctx, s, x, y, {
      size: fsMin(o.size), weight: (o.w || 400) >= 500 ? 500 : 400,
      color: o.raw ? null : (o.color || '--color-ink'), align: o.align || 'left', baseline: o.base || 'middle',
      halo: o.halo, haloWidth: o.haloWidth
    });
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function canvasBtn(ctx, r, label, o) {
    o = o || {};
    ctx.fillStyle = SK.color(o.fill || '--color-paper-raised'); ctx.strokeStyle = SK.color(o.off ? '--color-line' : '--color-line-strong'); ctx.lineWidth = o.lw || 3;
    roundRect(ctx, r.x, r.y, r.w, r.h, o.radius || 8); ctx.fill(); ctx.stroke();
    var col = o.off ? '--color-ink-muted' : (o.color || '--color-ink'), cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    if (o.glyph) {       // R4: − + 는 글꼴 대신 선으로 (글꼴마다 굵기·높이가 달라서)
      var a = (o.size || FS) * 0.32;
      ctx.strokeStyle = SK.color(col); ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx - a, cy); ctx.lineTo(cx + a, cy);
      if (o.glyph === 'plus') { ctx.moveTo(cx, cy - a); ctx.lineTo(cx, cy + a); }
      ctx.stroke(); ctx.lineCap = 'butt';
      return;
    }
    var size = fsMin(o.size || FS);   // R7(A8): 그리는 글자(txt 하한)와 같은 크기로 재야 아이콘이 글자와 안 겹친다
    if (o.icon) {        // R4: 글 + SVG 아이콘 (가운데 맞춤, 간격 6u)
      var isz = Math.round(size * 1.1), tw = SK.measure(ctx, label, { size: size, weight: 500 }).w, gap = 6, x0 = cx - (tw + gap + isz) / 2;
      txt(ctx, label, x0, cy, { size: size, w: 500, color: col });
      SK.drawIcon(ctx, o.icon, x0 + tw + gap + isz / 2, cy, isz, { color: col, width: 2.4 });
      return;
    }
    txt(ctx, label, cx, cy, { align: 'center', size: size, w: 500, color: col });
  }
  /** R3: 캔버스 검은 면 — 순검정 대신 따뜻한 짙은 갈색 · 둥근 8u · 얇은 테두리 */
  var DARK_EDGE = 'rgba(60, 50, 40, 0.25)';
  function darkFace(ctx, x, y, w, h, r) {
    ctx.fillStyle = SK.color('--color-canvas-dark'); roundRect(ctx, x, y, w, h, r === undefined ? 8 : r); ctx.fill();
  }
  function darkEdge(ctx, x, y, w, h, r) {
    ctx.strokeStyle = DARK_EDGE; ctx.lineWidth = 1; roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r === undefined ? 8 : r); ctx.stroke();
  }
  /** R3: 캔버스 번호 원 — HTML .circ 와 같은 모양(원문자 글리프 대신) */
  function circNo(ctx, n, cx, cy, o) {
    o = o || {};
    var r = o.r || Math.max(15, Math.round(fsMin(o.size || 22) * 0.68));      // R5: 글자 22u(하한)가 들어가게 13 → 15 · R7(A8) 글자 하한만큼
    ctx.strokeStyle = SK.color(o.color || '--color-ink'); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.2832); ctx.stroke();
    SK.text(ctx, String(n), cx, cy, { size: fsMin(o.size || 22), weight: 500, align: 'center', color: o.color || '--color-ink' });
  }

  function drawSource(ctx, p) {
    var k = p.send, x = 20, w = SRC_R - 20, h = 92, y = Y0 - h / 2;
    ctx.fillStyle = SK.color('--color-ink-muted');
    roundRect(ctx, x, y, w, h, 10); ctx.fill();
    ctx.fillStyle = SK.color('--color-paper-raised');
    if (k === 'wave' || k === 'photon') {
      ctx.fillRect(x + w - 10, Y0 - 10, 14, 20);
      ctx.fillStyle = rgbStr(lamRGB(p.lam)); ctx.beginPath(); ctx.arc(x + 30, Y0, 12, 0, 6.2832); ctx.fill();
    } else if (k === 'electron') {
      ctx.strokeStyle = SK.color('--color-sim-slit-tint'); ctx.lineWidth = 3;
      ctx.beginPath(); for (var i = 0; i < 4; i++) { ctx.moveTo(x + 18 + i * 10, Y0 - 14); ctx.lineTo(x + 23 + i * 10, Y0 + 14); } ctx.stroke();
      ctx.fillRect(x + w - 10, Y0 - 6, 14, 12);
    } else {
      ctx.beginPath(); ctx.moveTo(x + 14, y + 14); ctx.lineTo(x + 60, y + 14); ctx.lineTo(x + 44, Y0); ctx.lineTo(x + 30, Y0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = SK.color('--color-copper-tint');
      for (var j = 0; j < 3; j++) { ctx.beginPath(); ctx.arc(x + 26 + j * 12, y + 24, 5, 0, 6.2832); ctx.fill(); }
      ctx.fillStyle = SK.color('--color-paper-raised'); ctx.fillRect(x + w - 10, Y0 - 8, 14, 16);
    }
    var name = { wave: '레이저', photon: '약한 빛', electron: '전자총', marble: '구슬 발사기' }[k];
    var nf = fsMin(FS), ny = y + h + 10 + Math.round(nf * 0.6);   // 팀장 R8 결과: 글자 하한으로 커진 이름이 상자 아랫면에 겹치지 않게(글자 높이만큼 아래)
    txt(ctx, name, x + w / 2, ny, { align: 'center', w: 500 });
    if (isQuantum(k) || k === 'marble') txt(ctx, '하나씩', x + w / 2, ny + 6 + Math.round(nf * 1.1), { align: 'center', w: 400, color: '--color-ink-muted' });
  }

  function drawSlitPlate(ctx, p, g) {
    var sx = slitX(g), sep = slitSep(g), oh = slitOpenH(g), w = 14;
    var ys = { top: Y0 - sep / 2, bottom: Y0 + sep / 2 };
    ctx.fillStyle = SK.color('--color-line-strong');
    ctx.fillRect(sx - w / 2, SCR_TOP, w, ys.top - oh / 2 - SCR_TOP);
    ctx.fillRect(sx - w / 2, ys.top + oh / 2, w, ys.bottom - oh / 2 - (ys.top + oh / 2));
    ctx.fillRect(sx - w / 2, ys.bottom + oh / 2, w, SCR_BOT - (ys.bottom + oh / 2));
    // 값이 바뀐 변수는 그림에서 잠깐 강조 (d: 두 슬릿 사이, L: 거리 화살표)
    if (SK.isFlashing('d') || SK.isFlashing('dR')) {
      SK.arrow(ctx, sx - 26, Y0, sx - 26, ys.top + 2, { color: '--color-copper', width: 3, head: 10 });
      SK.arrow(ctx, sx - 26, Y0, sx - 26, ys.bottom - 2, { color: '--color-copper', width: 3, head: 10 });
    }
    ['top', 'bottom'].forEach(function (s) {
      var blocked = p.slit !== 'both' && p.slit !== s;
      if (blocked) {
        ctx.fillStyle = SK.color('--color-copper');
        roundRect(ctx, sx - 14, ys[s] - oh / 2 - 12, 28, oh + 24, 4); ctx.fill();
        txt(ctx, '막음', sx - 22, ys[s], { align: 'right', w: 500, color: '--color-copper-text' });
      }
    });
    txt(ctx, '이중 슬릿', sx, SCR_BOT + 10 + Math.round(fsMin(FS) * 0.6), { align: 'center', w: 500 });   // 팀장 R8 결과: 바닥선에 붙지 않게
    if (p.det && p.send !== 'wave') {
      ['top', 'bottom'].forEach(function (s) {
        if (p.slit !== 'both' && p.slit !== s) return;
        var on = SK.time - flash[s] < 0.18;
        ctx.fillStyle = SK.color(on ? '--color-copper' : '--color-copper-tint');
        ctx.strokeStyle = SK.color('--color-copper'); ctx.lineWidth = 3;
        roundRect(ctx, sx + 12, ys[s] - (s === 'top' ? 44 : -16), 40, 28, 5); ctx.fill(); ctx.stroke();
      });
      txt(ctx, '측정기', sx + 58, ys.top - 30, { w: 500, color: '--color-copper-text' });
    }
    // 거리 L
    var yL = SCR_BOT + LBL_Y, flashL = SK.isFlashing('L') || SK.isFlashing('LR');
    var lc = flashL ? '--color-ok' : '--color-line-strong';
    // R5: 양끝 채운 화살촉 치수선(SK.dim) · 라벨은 선 가운데(종이 바탕)
    var Ltxt = p.send === 'electron' ? '$L$ = ' + p.LR + ' 눈금' : '$L$ = ' + SK.fmt(p.L, 1) + ' m (그림은 줄임)';
    var lsc = (SK.view && SK.view.scale) || 1;   // R8(A12): 치수선 글자도 하한(보조 글자 '(그림은 줄임)' 은 화면 20px 이상)
    // R9(§4-2): 초급은 L 을 2.0 m 로 두고(값 보존) 치수선·'L = 2.0 m (그림은 줄임)' 을 그리지 않는다
    if (!SIMPLE) SK.dim(ctx, sx + 4, yL, SCR_X - 4, yL, { label: Ltxt, size: Math.max(fsMin(FS), Math.ceil(20 / lsc)), side: 'center', weight: 400, lw: flashL ? 4 : 2, head: 12, ends: 10,
      color: lc, labelColor: flashL ? '--color-ok' : '--color-ink-muted', bg: '--color-paper-raised' });
    return { sx: sx, ys: ys };
  }

  function drawWaves(ctx, p, g, geo, hide) {
    var k = p.send; if (k === 'marble' || !SK.params.showWave) return;
    var lv = waveLen(g), ph = (SK.time * 1.2) % 1, strong = k === 'wave';
    ctx.save();
    ctx.globalAlpha = strong ? 0.6 : 0.3;
    ctx.strokeStyle = waveColor(p); ctx.lineWidth = strong ? 3 : 2;
    var half = slitSep(g) / 2 + 40;
    ctx.beginPath();
    for (var x = geo.sx - 8 - ((1 - ph) * lv) % lv; x > SRC_R + 4; x -= lv) { ctx.moveTo(x, Y0 - half); ctx.lineTo(x, Y0 + half); }
    ctx.stroke();
    if (hide) { ctx.restore(); return; }       // 예측 중: 슬릿 뒤 물결(간섭 모양)은 숨김
    ctx.beginPath(); ctx.rect(geo.sx + 8, SCR_TOP, SCR_X - geo.sx - 8, SCR_H); ctx.clip();
    var rmax = Math.sqrt(Math.pow(SCR_X - geo.sx, 2) + Math.pow(SCR_H, 2));
    ['top', 'bottom'].forEach(function (s) {
      if (p.slit !== 'both' && p.slit !== s) return;
      ctx.beginPath();
      for (var r = ph * lv; r < rmax; r += lv) { if (r < 2) continue; ctx.moveTo(geo.sx + r, geo.ys[s]); ctx.arc(geo.sx, geo.ys[s], r, 0, Math.PI / 2); ctx.moveTo(geo.sx, geo.ys[s] - r); ctx.arc(geo.sx, geo.ys[s], r, -Math.PI / 2, 0); }
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawFlyers(ctx, p, g, geo) {
    var col = dotColor(p), dark = curveColor(p);
    var dist = SCR_X - geo.sx;
    flyers.forEach(function (f) {
      var age = SK.time - f.t0, x, y;
      if (age < T_FLY1) {
        var u = age / T_FLY1;
        var ty = f.slit ? geo.ys[f.slit] : Y0;
        x = SRC_R + (geo.sx - SRC_R) * u; y = Y0 + (ty - Y0) * u;
        if (isQuantum(p.send) && !f.slit) {
          ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(x, y, 14, 0, 6.2832); ctx.fill(); ctx.restore();
        }
        ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(x, y, 5, 0, 6.2832); ctx.fill();
      } else if (age < T_FLY1 + T_FLY2) {
        var v = (age - T_FLY1) / T_FLY2;
        if (f.slit) {
          var sy = geo.ys[f.slit], ey = yToScr(f.y);
          x = geo.sx + dist * v; y = sy + (ey - sy) * v;
          ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(x, y, p.send === 'marble' ? 7 : 5, 0, 6.2832); ctx.fill();
        } else {
          ctx.save(); ctx.globalAlpha = 0.45 * (1 - v * 0.6); ctx.strokeStyle = dark; ctx.lineWidth = 3;
          ['top', 'bottom'].forEach(function (s) {
            if (p.slit !== 'both' && p.slit !== s) return;
            ctx.beginPath(); ctx.arc(geo.sx, geo.ys[s], Math.max(1, dist * v), -1.2, 1.2); ctx.stroke();
          });
          ctx.restore();
        }
      }
    });
    if (lastDot && SK.time - lastDot.t < 0.35 && SK.params.rate <= 60) {
      ctx.strokeStyle = col; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(SCR_X + SCR_W / 2, yToScr(lastDot.y), 14, 0, 6.2832); ctx.stroke();
    }
  }

  /** 예측 중 스크린·확대창 자리에 '?' (결과 층 숨김) */
  function drawHidden(ctx, x, y, w, h, msg) {
    darkFace(ctx, x, y, w, h);
    darkEdge(ctx, x, y, w, h);
    if (SIMPLE) {   // R6(B2): 심플은 '?' 대신 할 일 글(확대창) · 좁은 스크린 띠는 빈 칸
      if (w < 200) return;
      (msg || ['▶ 실행하면', '줄무늬가 나와요']).forEach(function (t, i, a) {
        txt(ctx, t, x + w / 2, y + h / 2 + (i - (a.length - 1) / 2) * 44, { align: 'center', size: 32, w: 500, color: '--color-ink-inverse' });
      });
      return;
    }
    SK.drawIcon(ctx, 'help', x + w / 2, y + h / 2, Math.min(72, w * 0.8), { color: '--color-ink-inverse', width: 2.4 });
  }
  /** R6(B2): 심플에서 아직 볼 것이 없을 때(빛: 처음 실행 전 · 하나씩: 점 0개) 확대창·스크린을 글로 가린다 */
  function simpleVeil(p) {
    if (!SIMPLE) return null;
    if (p.send === 'wave') return simpleSeen ? null : ['▶ 실행하면', '줄무늬가 나와요'];
    return count > 0 ? null : ['▶ 실행하면', '점이 쌓여요'];
  }
  function drawScreen(ctx, p, hide) {
    if (hide || simpleVeil(p)) drawHidden(ctx, SCR_X, SCR_TOP, SCR_W, SCR_H);
    else {
      darkFace(ctx, SCR_X, SCR_TOP, SCR_W, SCR_H);
      ctx.save(); roundRect(ctx, SCR_X, SCR_TOP, SCR_W, SCR_H, 8); ctx.clip();
      if (p.send === 'wave') ctx.drawImage(patCv, SCR_X, SCR_TOP, SCR_W, SCR_H);
      else if (SK.params.showDots) ctx.drawImage(dotsCv, SCR_X, SCR_TOP, SCR_W, SCR_H);
      ctx.restore();
      darkEdge(ctx, SCR_X, SCR_TOP, SCR_W, SCR_H);
    }
    txt(ctx, '스크린', SCR_X + SCR_W / 2, SCR_BOT + 10 + Math.round(fsMin(FS) * 0.6), { align: 'center', w: 500 });
    // 직전 실행 무늬 띠
    darkFace(ctx, GH_X, SCR_TOP, GH_W, SCR_H, 6);
    darkEdge(ctx, GH_X, SCR_TOP, GH_W, SCR_H, 6);
    if (SK.ghost && !hide) {
      ctx.save(); roundRect(ctx, GH_X, SCR_TOP, GH_W, SCR_H, 6); ctx.clip(); ctx.globalAlpha = 0.45;
      if (SK.ghost === ghostRef && ghostDots) ctx.drawImage(ghostDots, GH_X, SCR_TOP, GH_W, SCR_H);
      else {
        if (ghostPatRef !== SK.ghost) { ghostPat = buildGhostPat(SK.ghost); ghostPatRef = SK.ghost; }
        if (ghostPat) ctx.drawImage(ghostPat, GH_X, SCR_TOP, GH_W, SCR_H);
      }
      ctx.restore();
    }
    txt(ctx, '지난 실행', GH_X + GH_W / 2, SCR_TOP - 8 - Math.round(fsMin(FS) * 0.5),   // R7-3(B2): '직전' → '지난 실행'(지난번 실행의 무늬) · R8(C6): 스크린 막대 바로 위 단독
      { align: 'center', w: 400, color: '--color-ink-muted' });
    // R8(C6): 전자 모드 모형 단위 안내는 무대 왼쪽 위 칩 줄(상태 칩 아래)에 — '지난 실행' 과 한 문장처럼 붙지 않게
    if (p.send === 'electron' && !SIMPLE) drawModelChip(ctx);
  }
  function drawModelChip(ctx) {
    // 오른쪽 끝은 '지난 실행' 글자 앞까지 — 넘치면 짧은 문구로(작은 화면에서 글자 하한 때문에 칩이 길어짐)
    var f = fsMin(FS), h = Math.round(f * 1.6), maxW = GH_X + GH_W / 2 - measureW('지난 실행', f) / 2 - 16 - 16;
    var t = ['모형 단위(눈금) · 실제 간격은 훨씬 좁아요', '모형 단위(눈금) · 실제는 훨씬 좁아요', '모형 단위(눈금)'].filter(function (c, i, a) { return i === a.length - 1 || measureW(c, f, 500) + 28 <= maxW; })[0];
    var w = measureW(t, f, 500) + 28;
    var y = 60;
    try { var ins = SK.stageInset(); y = Math.max(8, Math.round((ins.yTop !== undefined ? ins.yTop : ins.top) || 0) + 6); } catch (e) { y = 60; }
    var x = 16;   // 상태 칩 바로 아래 왼쪽(레이저·슬릿판 위 빈 곳) — '지난 실행'(스크린 위)과는 떨어져 있다
    ctx.fillStyle = SK.color('--color-paper-raised'); roundRect(ctx, x, y, w, h, h / 2); ctx.fill();
    ctx.strokeStyle = SK.color('--color-sim-slit'); ctx.lineWidth = 1.5; roundRect(ctx, x, y, w, h, h / 2); ctx.stroke();
    txt(ctx, t, x + 14, y + h / 2, { w: 500, color: '--color-sim-slit-text' });
  }
  function buildGhostPat(gh) {
    var pts = gh.series && gh.series.I; if (!pts) return null;
    var gp = gh.params || {};
    var col = gp.send === 'electron' ? SK.color('--color-sim-slit-tint') : gp.send === 'marble' ? SK.color('--color-copper-tint') : rgbStr(lamRGB(gp.lam || 650));
    var cv = document.createElement('canvas'); cv.width = 1; cv.height = SCR_H;
    var c = cv.getContext('2d');
    c.fillStyle = col;
    for (var j = 0; j < SCR_H; j++) {
      var y = Y_MAX - (j + 0.5) / PX_MM, idx = Math.round((y - Y_MIN) / 0.1), f = pts[Math.max(0, Math.min(pts.length - 1, idx))][1];
      c.globalAlpha = Math.max(0, Math.min(1, f)); c.fillRect(0, j, 1, 1);
    }
    return cv;
  }

  function drawRuler(ctx, p) {
    ctx.strokeStyle = SK.color('--color-ink'); ctx.fillStyle = SK.color('--color-ink');
    for (var mm = Y_MIN; mm <= Y_MAX; mm++) {
      var y = yToScr(mm), big = mm % 5 === 0;
      ctx.lineWidth = big ? 2.5 : 1;
      ctx.beginPath(); ctx.moveTo(RUL_X, y); ctx.lineTo(RUL_X + (big ? 14 : 6), y); ctx.stroke();
    }
    for (var m2 = -20; m2 <= 20; m2 += 10) txt(ctx, m2 === 0 ? '0' : SK.fmt(m2, 0), RUL_X + 17, yToScr(m2), { w: 400 });
    txt(ctx, unitY(p), RUL_X + 17, SCR_BOT + 10 + Math.round(fsMin(FS) * 0.6), { w: 500, color: '--color-ink-muted' });   // 팀장 R8 결과: 눈금 숫자 열에 맞춰 '스크린' 과 띄움('스크린 mm' 로 읽히던 것)
  }

  /** 스크린 왼쪽 밝기 곡선 (이론·쌓인 개수 막대·직전·기록) */
  function drawProfile(ctx, p) {
    // R8(C2): 하나씩(전자·광자) 보내기에서는 점이 300개 쌓이거나 끝나거나 기록한 뒤에만 이론 곡선(점 몇 개로 답을 미리 보지 않게) — 교사 모드는 늘
    var showT = SK.params.showTheory && (!isQuantum(p.send) || count >= 300 || SK.finished || recordedThisRun() || (SK.isTeacher && SK.isTeacher()));
    var showH = SK.params.showHist && p.send !== 'wave' && count > 0;
    var showO = SK.params.overlay && (SK.ghost || SK.records.length);
    if (!showT && !showH && !showO) return;
    var x0 = SCR_X - 4;
    ctx.fillStyle = SK.color('--color-paper-scrim');
    ctx.fillRect(x0 - PROF_W - 6, SCR_TOP, PROF_W + 6, SCR_H);
    function mapF(y, f) { return [x0 - f * PROF_W, yToScr(y)]; }
    if (showH) {
      var hv = histView(), sc = cur.Z / (count * hv.w * cur.imax);
      ctx.save(); ctx.globalAlpha = 0.4; ctx.fillStyle = curveColor(p);
      for (var b = 0; b < hv.n; b++) {
        if (!hv.h[b]) continue;
        var f = Math.min(1.15, hv.h[b] * sc);
        ctx.fillRect(x0 - f * PROF_W, yToScr(Y_MIN + (b + 1) * hv.w), f * PROF_W, Math.max(0.5, hv.w * PX_MM - 0.5));
      }
      ctx.restore();
    }
    if (showO) {
      SK.records.forEach(function (r) { if (r.series.I) SK.drawPath(ctx, r.series.I, SK.recStyle(r.slot), mapF); });
      if (SK.ghost && SK.ghost.series.I) SK.drawPath(ctx, SK.ghost.series.I, SK.ghostStyle(), mapF);
    }
    if (showT) {
      ctx.save(); ctx.strokeStyle = curveColor(p); ctx.lineWidth = 3; ctx.beginPath();
      for (var j = 0; j <= SCR_H; j++) {
        var y = Y_MAX - j / PX_MM, v = intensity(cur.g, y) / cur.imax;
        if (j === 0) ctx.moveTo(x0 - v * PROF_W, SCR_TOP + j); else ctx.lineTo(x0 - v * PROF_W, SCR_TOP + j);
      }
      ctx.stroke(); ctx.restore();
    }
  }

  function patternVisible(p) { return p.send === 'wave' || count >= 200; }

  function drawZoom(ctx, p, hide) {
    var u = unitY(p);
    // 머리: 이름 + '측정 방법 ?' 칩
    // R7(A8): 글자가 커져 '측정 방법' 알약과 닿으면 제목을 '확대 ±15 mm' 로 줄인다
    // R8(C5): '측정 방법' 은 HTML 단추(placeMeasDom) — 제목과 겹치면 measLayout 이 '?' 원으로 줄인다. 그래도 넘치면 제목을 짧게
    var zt = zoomTitle(!(BTN.how.short && !SIMPLE));
    txt(ctx, zt, ZX, BTN.how.y + BTN.how.h / 2, { w: 500, color: '--color-sim-slit-text' });
    var veil = simpleVeil(p);
    if (hide || veil) { drawHidden(ctx, ZX, ZY, ZW, ZH, veil); if (SIMPLE) drawSimpleFormula(ctx, p); else drawMeasureRows(ctx, p, true); return; }
    darkFace(ctx, ZX, ZY, ZW, ZH);
    ctx.save(); roundRect(ctx, ZX, ZY, ZW, ZH, 8); ctx.clip();
    if (p.send === 'wave') ctx.drawImage(zpatCv, ZX, ZY, ZW, ZH);
    else if (SK.params.showDots) ctx.drawImage(zoomCv, ZX, ZY, ZW, ZH);
    ctx.strokeStyle = SK.color('--color-paper-raised');
    for (var mm = -Z_RANGE; mm <= Z_RANGE; mm++) {
      var y = yToZoom(mm), big = mm % 5 === 0;
      ctx.lineWidth = big ? 3 : 1.5;
      ctx.beginPath(); ctx.moveTo(ZX, y); ctx.lineTo(ZX + (big ? 24 : 12), y); ctx.stroke();
      if (big && Math.abs(mm) < Z_RANGE) {
        // R3: 검은 칩 대신 밝은 글자 + 짙은 외곽선 (무늬 위에서도 읽힘)
        var tl = mm === 0 ? '0' : SK.fmt(mm, 0);
        txt(ctx, tl, ZX + 30, y, { w: 500, color: '--color-paper', halo: '--color-ink', haloWidth: 3 });
      }
    }
    function line(yv, lab, snap) {
      var py = yToZoom(yv);
      ctx.strokeStyle = SK.color('--color-focus-on-dark'); ctx.lineWidth = snap ? 4 : 3; ctx.setLineDash(snap ? [] : [10, 6]);
      ctx.beginPath(); ctx.moveTo(ZX + 70, py); ctx.lineTo(ZX + ZW, py); ctx.stroke(); ctx.setLineDash([]);
      txt(ctx, lab, ZX + ZW - 12, py - 16, { align: 'right', w: 500, color: '--color-focus-on-dark' });
    }
    if (meas.a !== null && !SIMPLE) line(meas.a, 'A', meas.snapA);
    if (meas.b !== null && !SIMPLE) {
      line(meas.b, 'B', meas.snapB);
      var xa = ZX + ZW - 70;
      if (Math.abs(meas.a - meas.b) * ZPX > 26) SK.arrow(ctx, xa, yToZoom(meas.a), xa, yToZoom(meas.b), { color: '--color-focus-on-dark', width: 3, head: 12 });
    }
    // R8(C1): 키보드 후보 줄 — 확대창에 포커스가 있을 때만(굵은 띠 + '다음에 찍을 이름 · Enter')
    if (kb.on && !SIMPLE) {
      var ky = yToZoom(kb.y), nx = meas.a !== null && meas.b === null ? 'B' : 'A';
      ctx.save(); ctx.globalAlpha = 0.28; ctx.fillStyle = SK.color('--color-focus-on-dark'); ctx.fillRect(ZX, ky - 9, ZW, 18); ctx.restore();
      ctx.strokeStyle = SK.color('--color-focus-on-dark'); ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(ZX + 70, ky); ctx.lineTo(ZX + ZW, ky); ctx.stroke(); ctx.setLineDash([]);
      txt(ctx, nx + ' · Enter', ZX + 70, ky - 18, { w: 500, color: '--color-paper', halo: '--color-ink', haloWidth: 3 });
    }
    ctx.restore();
    ctx.strokeStyle = SK.color('--color-sim-slit'); ctx.lineWidth = 4;
    roundRect(ctx, ZX, ZY, ZW, ZH, 8); ctx.stroke();
    // 스크린 위 확대 범위 표시
    ctx.strokeStyle = SK.color('--color-sim-slit'); ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
    ctx.strokeRect(SCR_X - 3, yToScr(Z_RANGE), SCR_W + 6, 2 * Z_RANGE * PX_MM); ctx.setLineDash([]);
    if (SIMPLE) { drawSimpleFormula(ctx, p); return; }   // R6(B2): 심플은 측정 3단계·안내 대신 값 넣은 식 한 줄
    drawMeasureRows(ctx, p, false);
    drawGuide(ctx, p);
  }
  /** R6(B1·B2) 심플: 확대창 아래(측정 칸 자리)에 이론 무늬 간격 — 식 · 값 넣은 식 · 답 (28u 이상) */
  function drawSimpleFormula(ctx, p) {
    if (SK.level && SK.level() === 'basic') return;   // R9(§4-2): 초급은 식·계산 줄('650 nm × 2.0 m / 0.25 mm = ?')을 그리지 않는다 — 말 계기 '밝은 줄 사이'로
    var g = cur.g, k = ML.k || 1, y = MY + Math.round(30 * k);   // R7(A8): 글자 하한만큼 줄 간격도 k 배
    // R8: 화면이 작아(예측 띠가 무대를 줄일 때) 눈금자 숫자('−20')가 넓어지면 식을 그만큼 오른쪽으로 — 겹침 방지
    var ZX = Math.max(ZX0, RUL_X + 17 + Math.ceil(measureW('−20', fsMin(FS))) + 12);
    if (p.send === 'marble') { txt(ctx, '구슬: 줄무늬 없음', ZX, y, { w: 500 }); txt(ctx, '그림자 띠 두 개', ZX, y + 44 * k, { color: '--color-ink-muted' }); return; }
    if (!fringeMode(g)) { txt(ctx, '줄무늬 없음', ZX, y, { w: 500 }); txt(ctx, p.slit !== 'both' ? '슬릿이 하나라서' : '어느 슬릿인지 알면', ZX, y + 44 * k, { color: '--color-ink-muted' }); return; }
    // R7-3(팀장): ÷ 글자 대신 가로선 분수(SK.frac) — 설명 층 {{frac:}} 와 같은 모양. 줄 간격 60u(분수 높이)
    var C = '--color-sim-slit-text', fq = fsMin(FS), fo = { size: fq, weight: 500 };
    txt(ctx, '$Δy$ =', ZX, y, { w: 500, color: C });
    SK.frac(ctx, '$λL$', '$d$', ZX + SK.measure(ctx, '$Δy$ = ', fo).w, y, { size: fq, weight: 500, color: C });
    if (p.send === 'electron') txt(ctx, '모형: ' + fmtN(p.V) + ' V · $d$ ' + p.dR + ' 눈금 · $L$ ' + p.LR + ' 눈금', ZX, y + 60 * k, { color: '--color-ink' });
    else SK.frac(ctx, p.lam + ' nm × ' + SK.fmt(p.L, 1) + ' m', SK.fmt(p.d, 2) + ' mm', ZX, y + 60 * k, { size: fq, weight: 400, color: '--color-ink' });
    // R8(C7): 심플은 ▶ 실행 전까지 답(= 5.2 mm)을 잠근다(계기 dy 도 같이) · R8(C9): 결과 줄 36u 500, 아래 여백은 measLayout(ML.h)
    if (simpleLocked(p)) txt(ctx, '= ?  실행 뒤 보여요', ZX, y + 118 * k, { w: 500, size: 30, color: '--color-ink-muted' });
    else txt(ctx, '= ' + SK.fmt(fringe(g), 1) + ' ' + unitY(p), ZX, y + 118 * k, { w: 500, size: 36, color: C });
  }
  /** 측정 방법 안내 (처음 한 번 · '측정 방법 ?' 으로 다시) — R5: 확대창을 가리지 않게 확대창 **아래**(측정 칸 자리)에.
      캔버스 그림이라 누르면 그대로 아래로 전달되고(pointerdown 에서 접힘 → 측정·버튼 처리) 첫 누름에 사라진다 */
  function drawGuide(ctx, p) {
    if (!(meas.guide && patternVisible(p) && fringeMode(cur.g)) || howHidden()) return;
    // R8(C5): 문장이 상자 폭보다 길면 낱말 단위로 두 줄 — 상자 높이는 줄 수만큼(아래 끝 고정, 넘치면 위로 자람)
    var f = fsMin(FS), cr = Math.max(15, Math.round(fsMin(22) * 0.68)), tx = 42 + cr * 2, avail = ZW - tx - 10, lh = Math.round(f * 1.25);
    var items = ['밝은 줄 가운데를 눌러요', '다른 밝은 줄을 눌러요', '사이 간격 수 $n$ 을 맞춰요'].map(function (t) {
      if (measureW(t, f, 500) <= avail) return [t];
      var w = t.split(' '), a = '', out = [];
      w.forEach(function (x) { var c = a ? a + ' ' + x : x; if (a && measureW(c, f, 500) > avail) { out.push(a); a = x; } else a = c; });
      if (a) out.push(a);
      return out;
    });
    var lines = items.reduce(function (n, it) { return n + it.length; }, 0), pad = 12, gapI = Math.round(f * 0.45);
    var need = lines * lh + (items.length - 1) * gapI + pad * 2;
    var bx = ZX, bw = ZW, bh = Math.max(ML.h - 8, need), by = MY + ML.h - 2 - bh;
    ctx.fillStyle = SK.color('--color-paper-raised');
    roundRect(ctx, bx, by, bw, bh, 10); ctx.fill();
    ctx.strokeStyle = SK.color('--color-sim-slit'); ctx.lineWidth = 3; roundRect(ctx, bx, by, bw, bh, 10); ctx.stroke();
    var bob = Math.sin(performance.now() / 260) * 4;
    var y = by + pad + Math.max(0, (bh - need) / 2);
    SK.drawIcon(ctx, 'arrow-up', bx + 20, y + lh / 2 - bob, 26, { color: '--color-ink', width: 2.6 });   // 위 확대창을 가리킴
    items.forEach(function (ls, k) {
      circNo(ctx, k + 1, bx + 36 + cr, y + lh / 2);
      ls.forEach(function (t, j) { txt(ctx, t, bx + tx, y + lh / 2 + j * lh, { w: 500 }); });
      y += ls.length * lh + gapI;
    });
    SK.requestRender();
  }
  /** 확대창 아래 측정 칸: 잰 길이 A~B → 간격 수 n [−][n][+] → 간격 1개 = Δy (R8 C3 용어) */
  function drawMeasureRows(ctx, p, hide) {
    // R3: 예측·모드 창이 떠 있으면 창 옆으로 '+'·'지우기' 조각이 비치지 않게 측정 칸을 그리지 않는다
    if (hide || howHidden()) return;
    var u = unitY(p), dist = !hide && meas.a !== null && meas.b !== null && Math.abs(meas.a - meas.b) >= 0.05 ? Math.abs(meas.a - meas.b) : null;
    // R3: 세 줄 모두 왼쪽 이름(ink-muted 600 22u) · 오른쪽 끝 값 — 같은 y 에 한 줄씩
    var LAB = { w: 400, color: '--color-ink-muted' };
    txt(ctx, '잰 길이 A~B', ZX, MY + ML.r1, LAB);
    txt(ctx, dist === null ? (meas.a === null || hide ? '–' : 'B 를 눌러요') : SK.fmt(dist, 1) + ' ' + u,
      ZX + ZW, MY + ML.r1, dist === null ? { align: 'right', w: 400, color: '--color-ink-muted' } : { align: 'right', size: 26, w: 500, color: '--color-ink' });
    // R8(C1·C3): − n + · 지우기 는 HTML 단추(placeMeasDom). 이름은 '간격 수 n' — 좁으면 한 줄 위(지우기와 같은 줄)
    txt(ctx, '간격 수 $n$', ZX, ML.narrow ? MY + ML.lr + ML.bh / 2 : BTN.minus.y + BTN.minus.h / 2, LAB);
    var mg = hide ? null : measuredGap();
    txt(ctx, '간격 1개 = $Δy$', ZX, MY + ML.r3, LAB);
    var vy = ML.two ? MY + ML.r3 + Math.round(1.1 * fsMin(FS)) : MY + ML.r3;   // R7(A8): 한 줄에 안 들어가면 값은 다음 줄 오른쪽
    txt(ctx, mg === null ? '아직 안 잼' : SK.fmt(mg, 2) + ' ' + u, ZX + ZW, vy,
      mg === null ? { align: 'right', w: 400, color: '--color-ink-muted' } : { align: 'right', size: ML.two ? 28 : 32, w: 500, color: '--color-sim-slit-text' });
  }

  /** 예측 창·모드 고르기 창이 떠 있는 동안은 결과 층(무늬·점·곡선·직전 띠)을 숨긴다 (R2 A4) */
  function resultsHidden() { return SK.predicting() || SK.choosingMode(); }
  /** R4: 예측·모드·확인 창이 떠 있나 (캔버스 버튼·측정 칸을 그리지도 누르지도 않음) */
  function howHidden() { return resultsHidden() || !!(SK.el.slide && SK.el.slide.classList.contains('is-modal')); }
  function render(view, p) {
    var ctx = view.ctx;
    if (!cur) return;
    SIMPLE = !!(SK.isSimple && SK.isSimple());
    FS = SIMPLE ? 28 : 22;   // R6(B2): 심플 캔버스 글자 28u
    zoomUnit = unitY(p);     // R8(C5): 제목 폭(단위 mm·눈금)으로 '측정 방법' 알약 ↔ '?' 원을 정한다
    if (layoutFor(view.extra) && dotsCv) makeOffscreens();   // R7(A8): 배율·심플이 바뀌면 측정 칸 높이를 다시
    var g = cur.g, hide = resultsHidden();
    var geo = drawSlitPlate(ctx, p, g);
    drawWaves(ctx, p, g, geo, hide);
    drawSource(ctx, p);
    if (p.send !== 'wave' && !hide) drawFlyers(ctx, p, g, geo);
    drawScreen(ctx, p, hide);
    if (!hide && !simpleVeil(p)) drawProfile(ctx, p);
    drawRuler(ctx, p);
    drawZoom(ctx, p, hide);
    placeMeasDom(view, p, hide);
    updateBand(p);
    updateSimpleMeters(p);
  }
  /** R8(C7): 심플 — 이번 실행을 시작하기 전에는 무늬 간격(계기 dy·식 답)을 잠근다 */
  function simpleLocked(p) { return SIMPLE && !SK.started && !(p.send === 'wave' && hadRun); }
  /** R6(B1): 심플 측정 칸 — 이론 Δy = λL/d(심플은 측정 3단계를 숨기므로 자물쇠 없이) · 쌓인 점 N(하나씩 보낼 때만) */
  function updateSimpleMeters(p) {
    if (!SK.setMeter || !cur) return;
    var g = cur.g;
    var locked = simpleLocked(p);
    SK.setMeter('dy', locked ? '실행 뒤' : p.send === 'marble' || !fringeMode(g) ? '줄무늬 없음' : fringe(g));   // R8(C7·A11): 잠금 문구 짧게
    SK.setMeter('count', p.send === 'wave' ? '—' : fmtN(count));
    if (!SIMPLE || !SK.el.slide) return;
    var dc = SK.el.slide.querySelector('.simple-meter[data-key="dy"]');
    if (dc && dc.classList.contains('is-locked') !== locked) { dc.classList.toggle('is-locked', locked); if (locked) dc.setAttribute('data-reason', '실행 뒤'); else dc.removeAttribute('data-reason'); }
    var cu = SK.el.slide.querySelector('.simple-meter[data-key="dy"] .simple-meter__unit');
    if (cu && cu.textContent !== unitY(p)) cu.textContent = unitY(p);
    var cc = SK.el.slide.querySelector('.simple-meter[data-key="count"]');
    if (cc && cc.hidden !== (p.send === 'wave')) cc.hidden = p.send === 'wave';
    updateBandWord(p);
  }
  /* R9(§4-2·0-2 #13): 초급 말 계기 '밝은 줄 사이' — 숫자 없이 지난 실행(직전 무늬)과 비교한 말.
     실행 전·예측 중은 답이 새지 않게 비움('실행 뒤 보여요'). bandPrev = 직전 실행의 무늬 간격(줄무늬가 없었으면 'none') */
  var bandPrev = null;
  function bandNode() { if (!ui.bandEl) ui.bandEl = SK.h('span', { class: 'dsq-band is-wait', 'aria-live': 'polite', text: '실행 뒤 보여요' }); return ui.bandEl; }
  function bandWord(p) {
    if (resultsHidden() || !cur) return null;
    if (!(SK.started || (p.send === 'wave' && hadRun))) return null;
    if (p.send === 'electron' || p.send === 'photon') return count < 200 ? '점이 쌓이는 중이에요' : fringeMode(cur.g) ? '점이 줄무늬로 모였어요' : '줄무늬 없이 넓게 쌓였어요';
    if (p.send === 'marble') return '띠 두 개가 생겼어요';
    if (!fringeMode(cur.g)) return '줄무늬가 없어요 — 넓은 띠 하나';
    if (bandPrev === null) return '처음 기록이에요 — 색이나 틈을 바꿔 한 번 더 해 봐요';
    if (bandPrev === 'none') return '줄무늬가 다시 생겼어요';
    var now = fringe(cur.g), r = now / bandPrev;
    return r > 1.02 ? '지난번보다 넓어졌어요' : r < 0.98 ? '지난번보다 좁아졌어요' : '지난번과 같아요';
  }
  function updateBandWord(p) {
    if (!ui.bandEl) return;
    var w = bandWord(p), t = w || '실행 뒤 보여요';
    if (ui.bandEl.textContent !== t) ui.bandEl.textContent = t;
    ui.bandEl.classList.toggle('is-wait', !w);
  }

  /* ==================================================================
     7. 하단 띠: 왼쪽 = 측정 3단계(빛) 또는 계기판(하나씩) | 오른쪽 = 식 칸
     ================================================================== */
  var lastM = {};
  function setText(el, key, s) { if (lastM[key] !== s) { SK.setText(el, s); lastM[key] = s; } }   // R4: ✓ 아이콘 · $n$ 수식
  function dot(cls) { return SK.h('span', { class: 'dsq-dot dsq-dot--' + cls, 'aria-hidden': 'true' }); }
  function updateSteps(p) {
    var st = measStage(), u = unitY(p), mg = measuredGap();
    var vals = [
      meas.a === null ? '확대창에서' : '✓ ' + SK.fmt(meas.a, 1),   // R7 학생점검(팀장): 1180 에서 '확대 보기에서' 가 '…' 로 잘림
      meas.b === null ? (st === 2 ? '다른 줄을' : '아직 없음') : '✓ ' + SK.fmt(meas.b, 1),
      mg === null ? '$n$ = ' + meas.n + ' 맞추기' : SK.fmt(mg, 2) + ' ' + u
    ];
    ui.stepCells.forEach(function (c, i) {
      var state = i + 1 < st ? 'done' : i + 1 === st ? 'now' : 'next';
      if (i === 2 && mg !== null) state = 'done';
      if (c._state !== state) { c.className = 'dsq-step is-' + state; c._state = state; }
      setText(c._val, 'sv' + i, state === 'next' ? '아직 없음' : vals[i]);   // R3: 빈 상태는 '–' 대신 글로
    });
  }
  function updateBand(p) {
    if (!ui.m1) return;
    var mg = measuredGap(), u = unitY(p), wave = p.send === 'wave';
    var phys = entrance === 'physics';
    if (ui.stepsBox.hidden === phys) { ui.stepsBox.hidden = !phys; ui.metersBox.hidden = phys; }
    if (phys) updateSteps(p);
    else {
      setText(ui.m1l, 'm1l', '쌓인 점'); setText(ui.m1, 'm1', wave ? '—' : fmtN(count) + '개');
      setText(ui.m3l, 'm3l', '내가 잰 간격'); setText(ui.m3, 'm3', mg === null ? '아직 안 잼' : SK.fmt(mg, 2) + ' ' + u);
      ui.m3.classList.toggle('is-empty', mg === null);
    }
    // 식 칸
    var g = cur.g, key = [p.send, p.lam, p.d, p.L, p.V, p.dR, p.LR, p.slit, p.det, SK.records.length, theoryOpen, entrance, mg, meas.n].join('|');
    if (ui.eqKey === key) return;
    ui.eqKey = key;
    var l1 = ui.eq1, l2 = ui.eq2;
    l1.innerHTML = ''; l2.innerHTML = ''; ui.eqF.innerHTML = '';
    fillEq(l1, l2, p, g, u);
    // R3: 식(첫 b)은 윗줄 왼쪽 · 값 칩은 아랫줄 · 이론 Δy 는 윗줄 오른쪽
    if (l1.firstChild) ui.eqF.appendChild(l1.firstChild);
    // R7-2: 빛 — 값 칩 3개는 아랫줄 전체 폭(이론 Δy | 잠금·값 한 줄 + 칩 한 줄) — 1280·820 에서 칩이 두 줄로 접혀 잘리던 것
    ui.eqF.parentNode.classList.toggle('dsq-eq--wide', p.send === 'wave');
    // R7 학생점검(C3): 전자 — 윗줄 '🔒 이론 Δy · 기록 뒤 보여요' · 아랫줄 '전압으로 정해지는 파장 λ = h/p  38.8 pm'
    ui.eqF.parentNode.classList.toggle('dsq-eq--e', p.send === 'electron');
  }
  function fillEq(l1, l2, p, g, u) {
    function add(el, kids) { kids.forEach(function (k) { el.appendChild(typeof k === 'string' ? document.createTextNode(k) : k); }); }
    function val(cls, s) { return SK.h('span', { class: 'dsq-val' }, [dot(cls), s]); }
    function richB(t) { var b = SK.h('b'); SK.setText(b, t); return b; }   // R5: {{frac:}} 가로선 분수
    if (p.send === 'marble') {
      add(l1, [SK.h('b', { text: '구슬: 간섭 없음' }), SK.h('span', { class: 'dsq-muted', text: '그림자 띠 두 개' })]);
      add(l2, ['두 띠 사이 ≈ ', SK.h('b', { class: 'dsq-nowrap', text: SK.fmt(marbleGap(g), 1) + ' mm' })]);
      return;
    }
    if (p.send === 'electron') {
      // R8(C4): λ 는 전압으로 정해지는 입력값 — 잠금 상자 밖 별도 칸 '입력: 전압 1000 V → λ 38.8 pm'(.dsq-eq__in)
      add(l1, [richB('입력: 전압 ' + fmtN(p.V) + ' V → $λ$'), val('lam', SK.fmt(pmOf(p.V), 1) + ' pm'), SK.h('span', { class: 'dsq-muted dsq-nowrap dsq-pmnote', text: 'pm = 10⁻¹² m' })]);
    } else {
      // R7(B5): 띠에는 기호만 — 식 $Δy$ = λL/d 와 단위 환산은 설명 4장(값 칩은 그대로)
      add(l1, [richB('이론 $Δy$'), val('lam', p.lam + ' nm'), val('L', SK.fmt(p.L, 1) + ' m'), val('d', SK.fmt(p.d, 2) + ' mm')]);
    }
    if (!fringeMode(g)) {
      add(l2, [SK.h('span', { class: 'dsq-muted', text: p.slit !== 'both' ? '슬릿이 하나라 → 줄무늬 없음' : '어느 슬릿인지 알면 → 줄무늬 없음' })]);
      return;
    }
    if (!SK.records.length) {
      // R5: 뜻이 분명하게 — 잠금 아이콘 + '먼저 직접 재기'
      l2.innerHTML = '';
      var lk = SK.h('span', { class: 'dsq-muted dsq-lockline', title: '이론 Δy 는 한 번 기록하면 보여요 (먼저 직접 재 보세요)' });
      var ic = SK.icon('lock'); if (ic) lk.appendChild(ic);
      // R7 학생점검(C3): 무엇이 잠겼는지 남긴다 — '🔒 이론 Δy · 기록 뒤 보여요'(빛·전자 같은 문구, 두 덩이는 각각 줄바꿈 안 함)
      // R7 학생점검(디자인C): 빛 갈래는 머리에 '이론 Δy' 가 이미 있어 잠금 줄에는 '기록 뒤 보여요' 만 (전자는 머리가 λ 줄이라 이름을 붙인다)
      // R8(C4): 전자 잠금 제목 '이론 Δy · 기록 뒤 보여요'(λ 는 위 입력 칸 — 잠금 상자 안에 숫자를 두지 않는다)
      if (p.send === 'electron') lk.appendChild(SK.h('span', { class: 'dsq-lockline__what' }, SK.mathNodes('이론 $Δy$')));
      lk.appendChild(SK.h('span', { class: 'dsq-lockline__when', text: p.send === 'electron' ? '· 기록 뒤 보여요' : '기록 뒤 보여요' }));
      l2.appendChild(lk);
    } else if (!theoryOpen) {
      var b = SK.h('button', { class: 'btn btn--sm btn--secondary dsq-reveal', type: 'button' }, '답 확인하기');
      b.addEventListener('click', function (e) {
        if (e.detail > 0) b.blur();
        var html = document.documentElement;
        if (html.classList.contains('reveal-locked') && !html.classList.contains('is-teacher')) { SK.notice('선생님이 열어 줄 때까지 기다려요', 'info'); return; }
        theoryOpen = true; ui.eqKey = null; updateBand(SK.params); if (ui.recTable) ui.recTable.render();
      });
      l2.appendChild(b);
    } else if (SK.level && SK.level() === 'adv') {
      // R9(§4-2): 고급 — 이론 · 측정 · 오차 % 한 줄(잠금 규칙 R8 C7 은 중급과 같음: 기록 → 답 확인하기 뒤)
      var tha = fringe(g), mga = measuredGap();
      add(l2, [SK.h('span', { class: 'dsq-muted', text: '이론 ' }), SK.h('b', { class: 'dsq-nowrap', text: SK.fmt(tha, 2) + ' ' + u })]);
      if (mga !== null) add(l2, [SK.h('span', { class: 'dsq-muted dsq-nowrap', text: ' · 측정 ' }), SK.h('b', { class: 'dsq-nowrap', text: SK.fmt(mga, 2) + ' ' + u }),
        SK.h('span', { class: 'dsq-muted dsq-nowrap', text: ' · 오차 ' }), SK.h('b', { class: 'dsq-nowrap dsq-err', text: SK.fmt(Math.abs(mga - tha) / tha * 100, 1) + '%' })]);
      else add(l2, [SK.h('span', { class: 'dsq-muted dsq-nowrap', text: ' · 측정은 확대 보기에서' })]);
    } else {
      var th = fringe(g), mgv = measuredGap();
      add(l2, ['= ', SK.h('b', { class: 'dsq-nowrap', text: SK.fmt(th, 1) + ' ' + u })]);
      if (mgv !== null) add(l2, [SK.h('span', { class: 'dsq-muted dsq-nowrap', text: '· 내 값과 차이 ' + Math.round(Math.abs(mgv - th) / th * 100) + '%' })]);
    }
  }

  /* ==================================================================
     8. SimKit 연결 — 띠 문장은 25자 안팎
     ================================================================== */
  function recordedThisRun() { return SK.started && !SK.canRecord() && SK.records.length > 0; }
  function taskRun() {
    var p = SK.params;
    if (entrance === 'physics') {
      if (!SK.started) return presetHint || '아래 ▶ 실행으로 빛을 켜요';
      if (cur && !fringeMode(cur.g)) return recordedThisRun() ? '막힌 슬릿을 눌러 다시 열어 봐요' : '줄무늬가 있는지 보고 기록해요';
      if (meas.a === null) return '밝은 줄 두 곳을 골라 간격을 재요';
      if (meas.b === null) return '끝점이 될 밝은 줄을 눌러요';
      if (SK.running) return '빛이 다 켜질 때까지 기다려요';
      if (recordedThisRun()) return '저장했어요. $λ$만 바꿔 다시 재요';
      var off = suggesting ? 1 : ratioOff();   // R7 학생점검(C2): n 이 안 맞으면 기록 권유 금지
      if (off > 0) return '간격 여러 개를 쟀어요 — 간격 수 $n$ 을 맞춰요';
      if (off < 0) return '$n$ 이 너무 커요 — 사이 간격 수를 다시 세어요';
      return '간격 1개 ' + SK.fmt(measuredGap(), 2) + ' ' + unitY(p) + ' — 기록해요';
    }
    if (!SK.started) return presetHint || '아래 ▶ 실행으로 하나씩 보내요';
    if (SK.running && count < 200) return '처음엔 아무 데나 찍히는 것 같죠?';
    if (SK.running) return '점이 어디에 몰리는지 봐요';
    if (recordedThisRun()) return '측정기나 보내는 것 하나만 바꿔요';
    return null;   // 공통 문장('기록하기 버튼으로 결과를 저장해요' 등)
  }
  function taskCompare() {
    // R8(A7): 기록 2개 이상이면 공통 틀이 cfg.compareLine 한 줄 비교를 띄운다(여기서는 null)
    return null;
  }
  /** R8(A18): 예측 단계 상태줄 — 5종 같은 문장 */
  function taskPredict() {
    if (SK.prediction && SK.prediction.pending) return '아래 ▶ 실행을 눌러 예측을 확인해요';
    if (SK.predicting && SK.predicting()) return '먼저 결과를 예측해요 — 보기를 하나 골라요';
    return null;
  }
  /** R8(A7): 기록 두 개 한 줄 비교 — 'd 0.25→0.50 mm : Δy 5.2→2.6 mm' (바뀐 값 하나 : 무늬 간격) */
  var CMP_KEYS = [
    ['lam', '$λ$', function (v) { return v; }, 'nm'], ['d', '$d$', function (v) { return SK.fmt(v, 2); }, 'mm'], ['L', '$L$', function (v) { return SK.fmt(v, 1); }, 'm'],
    ['V', '$V$', function (v) { return fmtN(v); }, 'V'], ['dR', '$d$', function (v) { return v; }, '눈금'], ['LR', '$L$', function (v) { return v; }, '눈금'],
    ['send', '보낸 것', function (v) { return KIND_LABEL[v] || v; }, ''], ['det', '측정기', function (v) { return v ? '켬' : '끔'; }, ''], ['slit', '슬릿', function (v) { return SLIT_LABEL[v] || v; }, '']
  ];
  function compareLine(r1, r2) {
    var a = r1.params || {}, b = r2.params || {}, ch = null;
    for (var i = 0; i < CMP_KEYS.length && !ch; i++) { var c = CMP_KEYS[i]; if (a[c[0]] !== undefined && a[c[0]] !== b[c[0]]) ch = c; }
    var head = ch ? ch[1] + ' ' + ch[2](a[ch[0]]) + '→' + ch[2](b[ch[0]]) + (ch[3] ? ' ' + ch[3] : '') : '같은 조건';
    var va = r1.values || {}, vb = r2.values || {}, u = b.send === 'electron' ? '눈금' : 'mm';
    function dy(v) { return typeof v.measN === 'number' ? v.measN : theoryOpen && typeof v.theoN === 'number' ? v.theoN : null; }
    var ya = dy(va), yb = dy(vb);
    if (va.theo === '줄무늬 없음' || vb.theo === '줄무늬 없음') return head + ' : 줄무늬 ' + (va.theo === '줄무늬 없음' ? '없음' : '있음') + '→' + (vb.theo === '줄무늬 없음' ? '없음' : '있음');
    if (ya === null || yb === null) return head + ' : $Δy$ 는 확대 보기에서 재어 기록해요';
    return head + ' : $Δy$ ' + SK.fmt(ya, 1) + '→' + SK.fmt(yb, 1) + ' ' + u;
  }
  /* 비교 체크리스트 판정 */
  function checkPhysics() {
    var recs = SK.records.filter(function (r) { return r.params.send === 'wave' || r.params.send === 'photon'; });
    var onlyLam = false, prop = false;
    if (recs.length >= 2) {
      var r0 = recs[0].params, lams = {};
      onlyLam = recs.every(function (r) { lams[r.params.lam] = 1; return r.params.d === r0.d && r.params.L === r0.L && r.params.slit === 'both'; }) && Object.keys(lams).length >= 2;
      var ks = recs.filter(function (r) { return typeof r.values.measN === 'number'; }).map(function (r) { return r.values.measN / r.params.lam; });
      if (onlyLam && ks.length >= 2) {
        var mn = Math.min.apply(null, ks), mx = Math.max.apply(null, ks);
        prop = (mx - mn) / mx < 0.12;
      }
    }
    return { onlyLam: onlyLam, prop: prop };
  }
  function checkQuantum() {
    var off = false, on = false;
    SK.records.forEach(function (r) {
      if (r.params.send === 'electron' || r.params.send === 'photon') { if (r.params.det) on = true; else off = true; }
      if (r.params.send === 'marble') on = true;
    });
    return { off: off, on: on };
  }

  SK.init({
    slug: 'double-slit-quantum',
    title: '이중 슬릿: 빛에서 전자 하나까지',
    subject: '물리학 · 전자기와 양자',
    unit: '빛과 물질 / 양자와 미시세계',
    standards: ['12물리03-01', '12전자03-01'],
    today: '파장을 바꾸면 무늬 간격은 어떻게 될까?',
    stepTasks: [
      { text: taskPredict },
      { text: taskRun },
      { text: taskCompare },
      {}
    ],
    dt: 1 / 240,
    stageFit: true,
    stageH: 660,
    onResize: onStageResize,
    onStep: function () { refreshChecklist(); },
    onPredictOpen: function () { SK.requestRender(); },
    onPredictClose: function () { SK.requestRender(); },
    reset: function (p) {
      if (hadRun && cur && cur.p.send === 'wave') bandPrev = fringeMode(cur.g) ? fringe(cur.g) : 'none';   // R9: 초급 말 계기의 '지난번'
      if (hadRun && !suppressCapture) snapshotGhostDots();
      hadRun = false;
      rebuild(p); clearDots();
      // 측정 선은 같은 조건이면 남기고(↻ 다시 실행), λ·d·L 등이 바뀌면 알리고 지운다
      if (meas.a !== null && meas.geo !== null && meas.geo !== geoKey(cur.g)) {
        var had = measuredGap() !== null;
        clearMeasure();
        if (had && !quietClear) SK.notice('이전 측정은 다른 조건이라 지웠어요', 'info');
      } else if (meas.a !== null && meas.geo === null) clearMeasure();
      updatePanel();
    },
    step: function (dt, p) {
      hadRun = true; simpleSeen = true;
      if (!cur) return;
      if (p.send === 'wave') {
        if (SK.time >= WAVE_END && !SK.finished) SK.finish();
        return;
      }
      emitAcc += p.rate * dt;
      while (emitAcc >= 1) { emitAcc -= 1; emitOne(p, p.rate); }
      for (var i = flyers.length - 1; i >= 0; i--) {
        var f = flyers[i], age = SK.time - f.t0;
        if (f.slit && age >= T_FLY1 && !f.passed) { f.passed = true; if (p.det) flash[f.slit] = SK.time; }
        if (age >= T_FLY1 + T_FLY2) { if (f.dep) deposit(f.y); flyers.splice(i, 1); }
      }
      if (count >= GOAL && SK.running && !SK.finished) SK.finish();
    },
    render: render,
    capture: function () { if (!cur || suppressCapture) return null; return captureFrom(cur.p); },
    // R7-3(B2): 무대 위 공통 칩은 2개('빛(레이저) · 650 nm · 실행 전' / '전자 · 1000 V · 실행 전') — d·L 은 슬라이더에 있고,
    //   d·L·슬릿·측정기 조건은 statusNote(⚙ 설정 '지금 조건'·실험 고르기 머리 한 줄)
    status: function (p) {
      var s = [KIND_LABEL[p.send]];
      if (p.send === 'electron') s.push(fmtN(p.V) + ' V');
      else if (p.send !== 'marble') s.push(p.lam + ' nm');
      return s;
    },
    statusNote: function (p) {
      var s = p.send === 'electron'
        ? ['$d$ ' + p.dR + ' 눈금', '$L$ ' + p.LR + ' 눈금(모형)']
        : ['$d$ ' + SK.fmt(p.d, 2) + ' mm', '$L$ ' + SK.fmt(p.L, 1) + ' m'];
      if (p.slit !== 'both') s.push(p.slit === 'top' ? '위 슬릿만' : '아래 슬릿만');
      if (entrance === 'quantum' && p.send !== 'wave') s.push('측정기 ' + (p.det ? '켬' : '끔'));
      return s.join(' · ');
    },
    autoPredict: true,
    formulaDefault: 'dy',   // R7 학생점검(A3): 카드가 없을 때 ƒ 식 = 설명 4장
    compareLine: compareLine,
    confirmPresetWithRecords: true,
    // R7(B2): 첫 진입 '무엇을 해 볼까요?' 창(SK.chooseMode) 대신 [실험 ▾] 시트 맨 위 모드 단추 — key 는 갈래 선택지 'entry'
    //   ('send' 로 두면 보낼 것만 바뀌고 실험 카드·기록 표·도움말 갈래가 안 바뀐다). 누르면 그 갈래 카드 ①
    presetModes: [
      { key: 'entry', value: 'physics', label: '빛으로 줄무늬 재기', desc: '파장·슬릿 간격과 무늬 간격', preset: 0 },
      { key: 'entry', value: 'quantum', label: '전자 하나씩 보내기', desc: '점이 쌓여 무늬가 되는지', preset: 0 }
    ],
    // R6(B1): 심플 모드 — 12물리03-01(λ·d 와 무늬 간격) · 12전자03-01(하나씩 쌓이면 무늬). L·V·빠르기·슬릿·측정기는 더 보기(패널).
    // 모드에 따라 숨는 키(빛 λ·d / 전자 dR)는 공통 틀이 레일에서 저절로 뺀다. 'entry' = 모드 창과 같은 값(빛/전자) 큰 두 단추
    // R9(§4-2): 단계 — 예전 cfg.simple(λ·d·dR + 갈래 칩, 줄무늬 간격·쌓인 점)은 이 basic 으로 바뀜(?simple=1 = 초급)
    //   초급 = 빛 갈래만(전자는 실험 고르기 '다른 갈래 보기 ▸'), 색·틈 두 값, 말 계기 '밝은 줄 사이'(넓어졌어요/좁아졌어요), 식·계산 줄 숨김, 카드 ①②③⑤ 쉬운 말
    //   중급 = R8 그대로(카드 ①~⑤) · 고급 = + 슬릿 폭·빠르기·전자 d·L 을 패널로, 카드 ⑥(전압 4배)·⑦(슬릿 폭 2배), 이론·측정·오차 칸
    levels: {
      basic: {
        task: function () { return entrance === 'physics' ? '빛의 색과 두 틈 사이를 바꿔 줄무늬를 봐요' : '전자를 하나씩 보내 점이 어디에 쌓이는지 봐요'; },
        params: ['lam', 'd'], situation: [],
        meters: [{ key: 'band', label: '밝은 줄 사이', plain: true, node: function () { return bandNode(); } }],
        presets: [0, 1, 2, 4], predict: 'button', modes: ['physics']
      },
      mid: { presets: [0, 1, 2, 3, 4] },
      adv: { expose: ['a', 'rate', 'dR', 'LR'] }
    }
  });
  if (SK.onMode) SK.onMode(function () { ui.eqKey = null; SK.requestRender(); });

  layoutFor(SK.view.extra);
  makeOffscreens();

  /* ---- 수치 바꾸기 (핵심 3개: λ 또는 V · d · L) — 긴 설명 대신 단위 칩 ---- */
  SK.addVar('values', { key: 'lam', label: '빛의 {{파장}}', symbol: 'λ', unit: 'nm', min: 400, max: 700, step: 10, value: 650, decimals: 0, precision: 0, ticks: [{ v: 400, label: '보라 400' }, { v: 550, label: '초록 550' }, { v: 700, label: '빨강 700' }], apply: 'live',
    hint: 'nm = 10⁻⁹ m' });
  SK.controls.lam.el.classList.add('dsq-rainbow');
  SK.addVar('values', { key: 'V', label: '전자 가속 전압', symbol: 'V', unit: 'V', min: 100, max: 5000, step: 100, value: 1000, decimals: 0, precision: 0, ticks: [100, 2500, 5000], apply: 'live',
    hint: '$λ$ = 38.8 pm' });
  SK.addVar('values', { key: 'd', label: '{{슬릿}} 간격', symbol: 'd', unit: 'mm', min: 0.10, max: 0.50, step: 0.05, value: 0.25, decimals: 2, precision: 3, ticks: [0.1, 0.25, 0.5], apply: 'live',
    hint: 'mm = 10⁻³ m' });
  SK.addVar('deep', { key: 'dR', label: '{{슬릿}} 간격', symbol: 'd', unit: '눈금', min: 2, max: 10, step: 1, value: 5, decimals: 0, precision: 0, ticks: [2, 5, 10], apply: 'live',
    hint: '눈금 = 화면용 모형 단위(실제 길이 아님)' });
  SK.addVar('values', { key: 'L', label: '스크린 거리', symbol: 'L', unit: 'm', min: 0.5, max: 3.0, step: 0.1, value: 2.0, decimals: 1, precision: 2, ticks: [0.5, 2, 3], apply: 'live',
    hint: '그림은 줄여서 그림' });
  SK.addVar('deep', { key: 'LR', label: '스크린 거리', symbol: 'L', unit: '눈금', min: 2, max: 7, step: 1, value: 5, decimals: 0, precision: 0, ticks: [2, 5, 7], apply: 'live',
    hint: '눈금 = 화면용 모형 단위(실제 길이 아님)' });
  // 입력칸 이름 앞 색 점: 띠의 식(Δy = λL/d)과 같은 색 · 머리줄 '버튼 한 번에 10 nm' · 설명은 단위 칩
  var LABEL_SUB = { lam: '빛깔을 정함', d: '두 틈 사이', dR: '두 틈 사이', L: '슬릿에서', LR: '슬릿에서' };   // R7 학생점검(디자인A): '(슬릿 → 스크린)' 은 두 줄로 꺾여 다른 행과 안 맞음 → 짧게(그림 치수선에 같은 말)
  [['lam', 'lam'], ['V', 'lam'], ['d', 'd'], ['dR', 'd'], ['L', 'L'], ['LR', 'L']].forEach(function (a) {
    var el = SK.controls[a[0]].el, lab = el.querySelector('.var__label');
    if (lab) {
      lab.insertBefore(dot(a[1]), lab.firstChild);
      if (LABEL_SUB[a[0]]) lab.appendChild(SK.h('span', { class: 'dsq-labsub', text: '(' + LABEL_SUB[a[0]] + ')' }));
    }
    var si = el.querySelector('.var__stepinfo'), un = SK.defs[a[0]].unit;
    if (si && un && !/\s\S+$/.test(si.textContent.replace(/^버튼 한 번에 /, ''))) si.textContent += ' ' + un;
    var hint = el.querySelector('.var__hint'); if (hint) hint.classList.add('dsq-unitchip');
  });
  ui.vHint = SK.controls.V.el.querySelector('.var__hint');
  ui.lamHint = SK.controls.lam.el.querySelector('.var__hint');
  function updateVHint() {
    if (!ui.vHint) return;
    SK.setText(ui.vHint, '드브로이 파장 $λ$ = ' + SK.fmt(pmOf(SK.get('V')), 1) + ' pm · pm = 10⁻¹² m');
  }

  // 보내는 빠르기: 3단 버튼 + 한꺼번에 보내기 (하나씩 보낼 때만)
  ui.speedBox = SK.h('div', { class: 'dsq-speedwrap' });
  ui.speedBox.appendChild(SK.h('p', { class: 'dsq-speed-label', text: '보내는 빠르기' }));
  var sp = SK.h('div', { class: 'dsq-speed', role: 'group', 'aria-label': '보내는 빠르기' });
  ui.speedBtns = [['느리게', 1], ['보통', 20], ['빨리 감기', 1000]].map(function (o, i) {
    var b = SK.h('button', { class: 'btn btn--secondary', type: 'button', title: '1초에 ' + fmtN(o[1]) + '개씩 보내요' }, [o[0], SK.h('span', { class: 'btn__sub', text: '1초에 ' + fmtN(o[1]) + '개' })]);
    b.addEventListener('click', function (e) { if (e.detail > 0) b.blur(); setRateLevel(i); });
    sp.appendChild(b);
    return b;
  });
  ui.speedBox.appendChild(sp);
  // R7: '1만 개 한꺼번에' 는 빠르기 단추 줄 네 번째 칸(패널 높이 — '아래에 더 있어요' 없이)
  ui.skipBtn = SK.h('button', { class: 'btn btn--secondary dsq-skip', type: 'button', title: '기다리지 않고 1만 개를 바로 쌓아요 (K)', 'aria-label': '1만 개 한꺼번에 보내기' }, ['1만 개', SK.h('span', { class: 'btn__sub', text: '한꺼번에' })]);
  ui.skipBtn.addEventListener('click', function (e) { if (e.detail > 0) ui.skipBtn.blur(); skipMany(10000); });
  sp.appendChild(ui.skipBtn);
  SK.panel('values').appendChild(ui.speedBox);

  /* ---- 상황 바꾸기 ---- */
  // R6(B1): 모드(빛으로 재기 / 전자 하나씩) 선택지 — chooseMode 가 같은 값의 이 선택지를 찾아 접어 두고(자세히),
  // 심플 레일에서는 큰 두 단추로 펼친다. 기록·확인창·기본값 되돌리기에서는 빠진다(record:false · confirm:false)
  SK.addChoice('situation', {
    key: 'entry', label: '무엇을 볼까?', apply: 'live', record: false, confirm: false,
    options: [{ value: 'physics', label: '빛' }, { value: 'quantum', label: '전자 하나씩' }], value: 'physics',
    onChange: function (v) { if (v !== entrance) pickEntrance(v); }
  });
  SK.controls.entry.el.classList.add('is-folded', 'is-mode-ctl');
  SK.defs.entry.initial = undefined;   // 묶음 [기본값으로]가 모드를 '빛'으로 되돌리지 않게   // 자세히 패널에서는 처음부터 접힘(모드 줄 '실험 고르기'로 바꿈)
  SK.addChoice('situation', {
    key: 'send', label: '무엇을 보낼까?', style: 'cards', apply: 'restart',
    options: [
      { value: 'wave', label: '빛(레이저)', sub: '연속된 빛' },
      { value: 'photon', label: '광자 하나씩', sub: '아주 약한 빛' },
      { value: 'electron', label: '전자 하나씩', sub: '전자총' },
      { value: 'marble', label: '작은 구슬', sub: '비교용 알갱이' }
    ], value: 'wave',
    onChange: function () { updatePanel(); }
  });
  SK.controls.send.el.classList.add('dsq-cards2');
  ui.sendNote = SK.h('p', { class: 'var__hint dsq-sendnote' });
  SK.controls.send.el.appendChild(ui.sendNote);
  // R7: 열린 슬릿은 ⚙ '더 많은 설정'으로(실험 화면의 슬릿을 눌러도 막고 열린다 · 카드 ⑤ 값 그대로) — 패널 = 수치 3개 + 상황 1줄
  SK.addChoice('deep', {
    key: 'slit', label: '열린 {{슬릿}}', apply: 'live',
    options: [{ value: 'both', label: '둘 다 열기' }, { value: 'top', label: '위쪽만 열기' }, { value: 'bottom', label: '아래쪽만 열기' }],
    value: 'both'
  });
  SK.controls.slit.el.appendChild(SK.h('p', { class: 'var__hint', text: '실험 화면의 슬릿을 직접 눌러도 막고 열 수 있어요' }));
  SK.addToggle('situation', { key: 'det', label: '어느 슬릿인지 알아내는 {{측정기}}', value: false, apply: 'live', record: true });
  SK.controls.det.el.classList.add('dsq-bigswitch');
  ui.detNote = SK.h('p', { class: 'dsq-sub', text: '' });
  SK.controls.det.el.appendChild(ui.detNote);

  /* ---- 화면에 표시하기 ---- */
  var grid = SK.h('div', { class: 'dsq-grid2' });
  SK.panel('tools').appendChild(grid);
  SK.addToggle(grid, { key: 'showDots', label: '찍힌 점', value: true });
  SK.addToggle(grid, { key: 'showHist', label: '쌓인 개수 막대', value: true });
  // R8(C2): 하나씩 보내기에서는 점이 쌓인 뒤(300개·끝·기록)에만 그린다 — 켜 두어도 처음엔 안 보이는 까닭
  SK.addToggle(grid, { key: 'showTheory', label: '{{이론 곡선}}', value: true, hint: '전자 모드에서는 점이 쌓인 뒤 보여요' });
  SK.controls.showTheory.el.classList.add('dsq-theorynote-ctl');
  SK.addToggle(grid, { key: 'showWave', label: '물결(파면)', value: true });
  ['showDots', 'showHist', 'showTheory', 'showWave'].forEach(function (k) { SK.defs[k].record = false; });
  SK.addToggle('tools', { key: 'overlay', label: '이전 무늬 곡선 겹쳐 보기', value: true });
  SK.defs.overlay.record = false;

  /* ---- 더 많은 설정 ---- */
  SK.addVar('deep', { key: 'a', label: '슬릿 폭', symbol: 'a', unit: 'mm', min: 0.02, max: 0.10, step: 0.01, value: 0.05, decimals: 2, precision: 3, ticks: [0.02, 0.05, 0.1], apply: 'live',
    hint: '슬릿 하나의 너비. 넓을수록 바깥쪽 줄이 빨리 어두워져요(회절).' });
  SK.addVar('deep', { key: 'rate', label: '보내는 빠르기 (직접 입력)', unit: '개/s', min: 1, max: 1000, step: 1, value: 20, decimals: 0, precision: 0, ticks: [1, 500, 1000], apply: 'live', record: false, onChange: function () { updatePanel(); } });

  /* ---- 하단 띠: 측정 3단계(빛) / 계기판(하나씩) | 식 칸 ---- */
  SK.el.band.style.gridTemplateColumns = 'minmax(0, 4.6fr) minmax(0, 5.4fr)';
  function meterCell(n) {
    var l = SK.h('span', { class: 'dsq-label' }), v = SK.h('b', { class: 'dsq-mval num' });
    ui['m' + n + 'l'] = l; ui['m' + n] = v;
    return SK.h('div', { class: 'dsq-meter' }, [l, SK.h('span', { class: 'dsq-mrow' }, [v])]);
  }
  // R7(B4): 핵심 2칸 — 쌓인 점 N · 내가 잰 간격(기록 뒤 이론값). 보내는 빠르기는 패널 단추(눌린 모양)가 보여 줘서 띠에서 뺌
  ui.metersBox = SK.h('div', { class: 'dsq-meters dsq-meters--core' }, [meterCell(1), meterCell(3)]);
  // R8(C1·C3): 단계 칸 = 단추(Tab 순서) '① 밝은 줄 하나 ② 다른 밝은 줄 ③ 사이 간격 수 n' — ①② 는 확대 보기(키보드 측정)로, ③ 은 n 입력칸으로 포커스
  ui.stepCells = ['밝은 줄 하나', '다른 밝은 줄', '사이 간격 수 $n$'].map(
    function (t, i) {
    var v = SK.h('b', { class: 'dsq-step__val num' });
    var nt = SK.h('span', { class: 'dsq-step__txt' }); SK.setText(nt, t);
    var nm = SK.h('span', { class: 'dsq-step__name' }, [SK.circ(i + 1), nt]);
    var c = SK.h('button', { class: 'dsq-step is-next', type: 'button' }, [nm, v]);
    c._val = v; c._name = nt;
    c.title = ['① 밝은 줄 하나 — 확대 보기에서 밝은 줄 가운데 (↑↓ 로 고르고 Enter)', '② 다른 밝은 줄 — 확대 보기에서 다른 밝은 줄 (↑↓ · Enter)', '③ 사이 간격 수 n — 두 밝은 줄 사이 간격 수'][i];
    c.addEventListener('click', function (e) {
      if (e.detail > 0) c.blur();
      if (SK.predicting() || SIMPLE) return;
      if (SK.stepName === '예측' && SK.started) SK.goStep(1);
      meas.guide = false;
      if (i === 2) { if (ui.mNum && !ui.mNum.hidden) { ui.mNum.focus(); try { ui.mNum.select(); } catch (er) { /* 무시 */ } } }
      else {
        if (i === 1 && meas.a === null) SK.notice('먼저 ① 밝은 줄 하나를 골라요', 'info');
        if (i === 0 && meas.a !== null && meas.b !== null) clearMeasure();
        if (ui.zoomKey && !ui.zoomKey.hidden) ui.zoomKey.focus();
      }
      SK.requestRender(); SK.update();
    });
    return c;
  });
  ui.stepsHead = SK.h('p', { class: 'dsq-steps__t' });
  SK.setText(ui.stepsHead, '무늬 간격 $Δy$ 재기');
  ui.stepsBox = SK.h('div', { class: 'dsq-steps', role: 'group', 'aria-label': '무늬 간격 재기 3단계' }, [
    ui.stepsHead, ui.stepCells[0], SK.h('span', { class: 'dsq-step__arrow', 'aria-hidden': 'true', text: '→' }),
    ui.stepCells[1], SK.h('span', { class: 'dsq-step__arrow', 'aria-hidden': 'true', text: '→' }), ui.stepCells[2]
  ]);
  ui.metersBox.hidden = true;
  SK.el.meters.appendChild(ui.stepsBox);
  SK.el.meters.appendChild(ui.metersBox);
  ui.eqF = SK.h('p', { class: 'dsq-eq__f' }); ui.eq1 = SK.h('p', { class: 'dsq-eq__l1' }); ui.eq2 = SK.h('p', { class: 'dsq-eq__l2' });
  SK.el.graph.appendChild(SK.h('div', { class: 'dsq-eq' }, [ui.eqF, ui.eq2, ui.eq1]));

  /* ---- 기록 표 (비교 단계 큰 판) + 비교 체크리스트(extra) ---- */
  ui.check = SK.h('div', { class: 'dsq-check', 'aria-live': 'polite' });
  var COL = {
    lamT: { key: 'lamT', label: 'λ', from: 'value', changed: true },
    meas: { key: 'meas', label: '잰 Δy', from: 'value' },
    mt: { key: 'mt', label: '잰 Δy (이론)', from: 'value',
      text: function (rec) {
        var v = rec.values || {};
        if (v.theo === '줄무늬 없음') return '줄무늬 없음';
        var th = typeof v.theoN === 'number' ? SK.fmt(v.theoN, 1) : '–';
        return (v.meas || '–') + ' (' + (theoryOpen ? th : '?') + ')';
      } },
    theo: { key: 'theo', label: '이론 Δy', from: 'value',
      text: function (rec) { return theoryOpen || !rec.values || rec.values.theo === '줄무늬 없음' ? (rec.values ? rec.values.theo : '–') : '답 확인 전'; } },
    dT: { key: 'dT', label: 'd 슬릿 간격', from: 'value', changed: true },
    LT: { key: 'LT', label: 'L 스크린 거리', from: 'value', changed: true },
    send: { key: 'send', label: '보낸 것', from: 'param', changed: true, text: function (rec) { return KIND_LABEL[rec.params.send] || '–'; } },
    det: { key: 'det', label: '측정기', from: 'param', changed: true, text: function (rec) { return rec.params.send === 'wave' ? '–' : rec.params.det ? '켬' : '끔'; } },
    slit: { key: 'slit', label: '열린 슬릿', from: 'param', changed: true, text: function (rec) { return SLIT_LABEL[rec.params.slit] || '–'; } },
    count: { key: 'count', label: '쌓인 점', decimals: 0, from: 'value' }
  };
  /** 모드마다 기록 표 열 우선순위: 1 = 작은 표·큰 판, 2 = 큰 판, 3 = 열 더 보기 */
  var COL_ORDER = {
    physics: [['lamT', 1], ['mt', 1], ['dT', 3], ['LT', 3], ['slit', 3], ['meas', 3], ['theo', 3], ['send', 3], ['count', 3]],
    quantum: [['send', 1], ['det', 1], ['slit', 3], ['count', 3], ['lamT', 3], ['dT', 3], ['LT', 3], ['meas', 3], ['theo', 3]]
  };
  function setRecordColumns(v) {
    ui.recTable = SK.recordTable(null, {
      columns: COL_ORDER[v].map(function (a) { var c = copy(COL[a[0]]); c.priority = a[1]; return c; }),
      extra: ui.check
    });
  }
  setRecordColumns('physics');
  function refreshChecklist() {
    if (!ui.check) return;
    var n = SK.records.length, rows;
    if (entrance === 'physics') {
      var c = checkPhysics();
      rows = [[n >= 3, '기록 3개 이상 (지금 ' + n + '개)'], [c.onlyLam, '$λ$ 만 바꿨어요 ($d$·$L$ 은 그대로)'], [c.prop, '$Δy$ 가 $λ$ 에 비례해요 — 내가 잰 {{frac:$Δy$|$λ$}} 가 거의 같아요']];
    } else {
      var q = checkQuantum();
      rows = [[q.off, '측정기를 끄고 전자(또는 광자)를 기록했어요'], [q.on, '측정기를 켜거나 구슬로 바꿔 기록했어요'], [false, '두 무늬가 어떻게 다른지 한 문장으로 말해 봐요']];
    }
    ui.check.innerHTML = '';
    ui.check.appendChild(SK.h('p', { class: 'dsq-check__t' }, ['비교 체크리스트', SK.h('span', { class: 'dsq-check__tip', text: '빠진 것은 값을 바꿔 실행한 뒤 기록하기 버튼으로 한 번 더 저장해요' })]));
    rows.forEach(function (r) {
      ui.check.appendChild(SK.h('p', { class: 'dsq-check__row' + (r[0] ? ' is-ok' : '') },
        [SK.h('span', { class: 'dsq-check__box' }, r[0] ? SK.icon('check', { size: 'sm' }) : null), SK.h('span', null, SK.mathNodes(r[1]))]));
    });
  }
  SK.onRecords(function () { refreshChecklist(); ui.eqKey = null; SK.requestRender(); });

  /* ---- R7-2(B6): 식 팝업 기호 → 실험 화면 강조. 이 실험의 하단 띠는 공통 계기(.meter)가 아니라 dsq 칸이라
          'stage:dy'(재기 3단계·내가 잰 간격·이론 줄) · 'stage:lam'(λ 줄) · 'stage:count'(쌓인 점)를 직접 등록 ---- */
  function flashEls(list, ms) {
    var any = false;
    list.forEach(function (el) {
      if (!el || el.offsetParent === null || !el.getClientRects().length) return;
      any = true;
      el.classList.remove('is-flash-long'); void el.offsetWidth; el.classList.add('is-flash-long');
      clearTimeout(el._dsqFlash); el._dsqFlash = setTimeout(function () { el.classList.remove('is-flash-long'); }, ms || 1500);
    });
    if (!any) SK.notice('그 값은 아래 띠에 나와요', 'info', 2400);
  }
  function simpleMeter(k) { return SK.el.slide.querySelector('.simple-meter[data-key="' + k + '"]'); }
  function eqBoxEl() { return SK.el.graph.querySelector('.dsq-eq'); }
  SK.addFlashTarget('stage:dy', function (ms) { flashEls([ui.stepsBox.hidden ? ui.m3 && ui.m3.closest('.dsq-meter') : ui.stepsBox, eqBoxEl(), simpleMeter('dy')], ms); });
  SK.addFlashTarget('stage:lam', function (ms) { flashEls([eqBoxEl(), SK.get('send') === 'electron' && SK.controls.V ? SK.controls.V.el : null], ms); });
  SK.addFlashTarget('stage:count', function (ms) { flashEls([ui.m1 && ui.m1.closest('.dsq-meter'), simpleMeter('count')], ms); });

  /* ---- 패널 보이기·끄기 ---- */
  function show(key, on) { var c = SK.controls[key]; if (c) c.el.style.display = on ? '' : 'none'; }
  function updatePanel() {
    var send = SK.get('send'), el = send === 'electron', wave = send === 'wave', marble = send === 'marble', q = entrance === 'quantum';
    show('lam', !el); show('d', !el); show('L', !el);
    show('V', el); show('dR', el); show('LR', el);
    show('a', !el);
    SK.controls.a.enable(!marble);
    SK.controls.lam.enable(!marble);
    SK.controls.lam.el.title = marble ? '구슬 실험에서는 파장을 쓰지 않아요' : '';
    if (ui.lamHint) ui.lamHint.textContent = marble ? '구슬에는 파장이 없어요 (잠김)' : 'nm = 10⁻⁹ m';
    show('send', q); show('det', q);
    // R7: 빛 갈래에서는 '상황 바꾸기'에 보일 것이 없다(갈래 선택지는 접힘·슬릿은 ⚙) → 묶음째 숨겨 패널 = 수치 3개
    var sitSec = SK.panel('situation').closest('.panel-sec');
    if (sitSec && sitSec.hidden === q) sitSec.hidden = !q;
    var opts = SK.controls.send.el.querySelectorAll('.seg__opt');
    if (opts[0]) opts[0].style.display = q ? 'none' : '';
    SK.controls.det.enable(!wave);
    ui.detNote.textContent = SK.controls.det.el.title = wave ? '빛(레이저)에서는 쓰지 않아요. 하나씩 보낼 때 켜 보세요.'
      : marble ? '구슬은 측정기를 켜도 꺼도 두 띠 그대로예요.'
      : '켜면 지난 슬릿 쪽 측정기가 깜빡여요. 사람이 보는지와 상관없이, 어느 길로 갔는지 정보가 남으면 줄무늬가 사라져요.';
    ui.detNote.classList.add('dsq-detnote');
    ui.sendNote.textContent = marble ? '구슬은 한 슬릿을 곧게 지나 그림자 띠 두 개가 생겨요. 간섭 무늬는 없어요.'
      : el ? '화면에 보이게 키운 모형이에요. 실제 전자 실험의 슬릿 간격은 1 μm 보다 작아요.'
      : send === 'photon' ? '아주 약한 빛이라 광자가 한 번에 하나씩 도착해요.' : '';
    ui.sendNote.hidden = !ui.sendNote.textContent;
    ui.speedBox.style.display = wave || !q ? 'none' : '';
    var vp = SK.panel('values');   // 하나씩 보내기에서는 '보내는 빠르기'가 주 조작이라 수치 칸 맨 위로
    if (q && vp.firstChild !== ui.speedBox) vp.insertBefore(ui.speedBox, vp.firstChild);
    if (!q && vp.lastChild !== ui.speedBox) vp.appendChild(ui.speedBox);
    show('rate', q);
    SK.controls.rate.enable(!wave);
    ui.speedBtns.forEach(function (b, i) { b.disabled = wave; b.setAttribute('aria-pressed', String(!wave && SK.get('rate') === RATE_LEVELS[i])); });
    ui.skipBtn.disabled = wave;
    show('showDots', !wave); show('showHist', !wave);
    SK.controls.showWave.enable(!marble);
    updateVHint();
    var stops = [];
    for (var nm = 400; nm <= 700; nm += 25) stops.push(rgbStr(lamRGB(nm)) + ' ' + ((nm - 400) / 3).toFixed(1) + '%');
    SK.controls.lam.el.style.setProperty('--dsq-spectrum', 'linear-gradient(to right, ' + stops.join(', ') + ')');
  }
  function setRateLevel(i) {
    if (SK.get('send') === 'wave') { SK.notice('빛(레이저)에서는 빠르기를 쓰지 않아요', 'info'); return; }
    SK.set('rate', RATE_LEVELS[i]);
    SK.notice(['느리게', '보통', '빨리 감기'][i] + ': 1초에 ' + fmtN(RATE_LEVELS[i]) + '개', 'info', 1500);
  }
  Object.keys(DIST_KEYS).forEach(function (k) {
    var d = SK.defs[k]; if (!d) return;
    var prev = d.onChange;
    d.onChange = function (v, info) { if (prev) prev(v, info); onDistChange(); };
  });

  /* ---- 기록: 빛은 무늬가 늘 보이므로 실행 전에도 기록할 수 있게, 재지 않았으면 한 번 묻기 ---- */
  var origRecord = SK.record;
  SK.record = function () {
    if (SK.running) { origRecord(); return; }
    function go() {
      if (!SK.started && SK.params.send === 'wave') SK.stepFrame(1);
      if (SK.stepName === '예측' && SK.started) SK.goStep(1);
      origRecord();
      burst = false;
    }
    var can = SK.canRecord() || (!SK.started && SK.params.send === 'wave');
    if (can && entrance === 'physics' && cur && fringeMode(cur.g) && measuredGap() === null && patternVisible(SK.params)) {
      // 버튼 순서 [지금 재러 가기][재지 않고 기록하기] — Esc·바깥 누르기는 '재러 가기'(안전한 쪽)
      SK.confirm({
        title: '간격을 아직 안 쟀어요',
        body: '확대 보기에서 밝은 줄 사이를 재고 기록하면 이론값과 비교할 수 있어요.',
        ok: '재지 않고 기록하기', cancel: '지금 재러 가기'
      }).then(function (yes) {
        if (yes) { go(); return; }
        meas.guide = true; clearMeasure();
        if (SK.stepName === '예측') SK.goStep(1);
        SK.notice('확대 보기의 밝은 줄을 골라요 (눌러도, Tab → ↑↓ · Enter 로도 돼요)', 'info');
        SK.requestRender(); SK.update();
      });
      return;
    }
    // R7 학생점검(C2): 간격 수 n 이 안 맞은 채(이론값과 1.8배 넘게 차이) 기록하려 하면 한 번 묻는다
    if (can && entrance === 'physics' && ratioOff()) {
      SK.confirm({
        title: '간격 수 n 이 맞나요?',
        body: '잰 간격이 밝은 줄 간격 1개와 많이 달라요. A~B 사이 간격 수를 세어 − + 로 n 을 맞춘 뒤 기록하면 이론값과 비교하기 좋아요.',
        ok: '그대로 기록하기', cancel: 'n 다시 맞추기'
      }).then(function (yes) { if (yes) go(); else { SK.requestRender(); SK.update(); } });
      return;
    }
    go();
  };

  /* ==================================================================
     9. 그림(SVG) · 실험 카드 · 정리 질문 · 도움말 (모드마다)
     ================================================================== */
  var RED = rgbStr(lamRGB(650)), INK = 'var(--color-ink)', MUT = 'var(--color-ink-muted)', SL = 'var(--color-sim-slit)', PAPER = 'var(--color-paper-raised)';
  function svg(vb, body) { return '<svg viewBox="' + vb + '" xmlns="http://www.w3.org/2000/svg" role="img" style="font-family:inherit">' + body + '</svg>'; }
  function T(x, y, s, o) {
    o = o || {};
    return '<text x="' + x + '" y="' + y + '" text-anchor="' + (o.a || 'middle') + '" style="font-size:' + (o.size || 22) + 'px;font-weight:' + (o.w || 500) + ';fill:' + (o.fill || INK) + '">' + s + '</text>';
  }
  /** R4: SVG 안 물리 기호 — HTML .sym 과 같은 수식 글꼴 이탤릭 */
  function S(ch) { return '<tspan class="sym" style="font-family:var(--font-math);font-style:italic;font-weight:400">' + ch + '</tspan>'; }
  /** 예측 그림: 광원 → 틈 두 개(슬릿) → 스크린(?) */
  function predictFigure(kind) {
    var src = kind === 'electron' ? '전자총' : kind === 'marble' ? '구슬' : '레이저';
    var beam = kind === 'wave'
      ? '<line x1="56" y1="86" x2="146" y2="86" style="stroke:' + RED + ';stroke-width:5"/>'
      : [70, 92, 114, 136].map(function (x) { return '<circle cx="' + x + '" cy="86" r="5" style="fill:' + (kind === 'marble' ? 'var(--color-copper)' : kind === 'electron' ? SL : RED) + '"/>'; }).join('');
    var rays = kind === 'wave' ? [[74, 30], [74, 140], [98, 60], [98, 112]].map(function (r) {
      return '<line x1="158" y1="' + r[0] + '" x2="262" y2="' + r[1] + '" style="stroke:' + RED + ';stroke-width:2;opacity:.45"/>';
    }).join('') : '';
    return svg('0 0 300 180',
      '<rect x="6" y="70" width="50" height="32" rx="6" style="fill:' + MUT + '"/>' + T(31, 128, src) + beam + rays +
      '<rect x="150" y="24" width="8" height="46" style="fill:' + INK + '"/><rect x="150" y="80" width="8" height="12" style="fill:' + INK + '"/><rect x="150" y="102" width="8" height="46" style="fill:' + INK + '"/>' +
      T(154, 18, '틈 두 개', { size: 20 }) + T(154, 172, '(슬릿)', { size: 20, w: 400, fill: MUT }) +
      '<rect x="262" y="24" width="18" height="124" rx="3" style="fill:' + INK + '"/>' + T(271, 98, '?', { size: 30, w: 400, fill: PAPER }) +
      T(262, 172, '스크린', { size: 20, a: 'middle' }));
  }
  /** 개념 그림 1: 두 슬릿에서 퍼진 물결과 스크린의 밝고 어두운 줄 */
  function figInterference() {
    var arcs = '';
    [70, 120].forEach(function (cy) {
      for (var r = 28; r <= 260; r += 28) arcs += '<path d="M ' + (40 + r * Math.cos(-1.1)) + ' ' + (cy + r * Math.sin(-1.1)) + ' A ' + r + ' ' + r + ' 0 0 1 ' + (40 + r * Math.cos(1.1)) + ' ' + (cy + r * Math.sin(1.1)) + '" style="fill:none;stroke:' + RED + ';stroke-width:2;opacity:.5"/>';
    });
    var bands = '';
    for (var j = 0; j < 9; j++) {
      var y = 10 + j * 19, bright = j % 2 === 0;
      bands += '<rect x="330" y="' + y + '" width="22" height="19" style="fill:' + (bright ? RED : INK) + '"/>';
    }
    return svg('0 0 460 200',
      '<rect x="34" y="0" width="10" height="62" style="fill:' + INK + '"/><rect x="34" y="78" width="10" height="34" style="fill:' + INK + '"/><rect x="34" y="128" width="10" height="72" style="fill:' + INK + '"/>' +
      '<clipPath id="dsqc1"><rect x="44" y="0" width="282" height="200"/></clipPath><g clip-path="url(#dsqc1)">' + arcs + '</g>' + bands +
      T(406, 30, '밝은 줄', { size: 20, fill: 'var(--color-ink)' }) + T(406, 52, '= 보강', { size: 20, w: 400, fill: MUT }) +
      T(406, 125, '어두운 줄', { size: 20 }) + T(406, 147, '= 상쇄', { size: 20, w: 400, fill: MUT }));
  }
  /** 개념 그림 2: d sinθ = 경로차, y 와 L */
  function figGeometry() {
    return svg('0 0 460 220',
      '<rect x="40" y="10" width="8" height="70" style="fill:' + INK + '"/><rect x="40" y="92" width="8" height="26" style="fill:' + INK + '"/><rect x="40" y="130" width="8" height="70" style="fill:' + INK + '"/>' +
      '<rect x="400" y="10" width="10" height="190" style="fill:' + INK + '"/>' +
      '<line x1="48" y1="105" x2="400" y2="105" style="stroke:' + MUT + ';stroke-width:2;stroke-dasharray:6 5"/>' +
      '<line x1="48" y1="86" x2="400" y2="34" style="stroke:' + RED + ';stroke-width:3"/><line x1="48" y1="124" x2="400" y2="34" style="stroke:' + RED + ';stroke-width:3"/>' +
      '<line x1="48" y1="86" x2="58" y2="122" style="stroke:' + SL + ';stroke-width:3"/>' +
      T(100, 148, S('d') + ' sin' + S('θ') + ' = 경로차', { size: 20, a: 'start', fill: SL }) +
      '<line x1="26" y1="86" x2="26" y2="124" style="stroke:var(--color-copper);stroke-width:3"/>' + T(14, 112, S('d'), { size: 24, fill: 'var(--color-copper)' }) +
      '<line x1="420" y1="34" x2="420" y2="105" style="stroke:' + INK + ';stroke-width:2"/>' + T(440, 76, S('y'), { size: 24 }) +
      '<path d="M 110 105 A 62 62 0 0 0 107 96" style="fill:none;stroke:' + INK + ';stroke-width:2"/>' + T(126, 100, S('θ'), { size: 22 }) +
      '<line x1="48" y1="212" x2="400" y2="212" style="stroke:var(--color-ok);stroke-width:2"/>' + T(224, 206, S('L') + ' (슬릿 → 스크린)', { size: 20, fill: 'var(--color-ok)' }) +
      T(330, 26, S('m') + '번째 밝은 줄', { size: 20, a: 'end' }));
  }
  /** 개념 그림 3: 점이 10개 → 200개 → 3,000개 쌓이며 줄무늬가 드러남 (고정된 난수로 매번 같은 그림) */
  function figDots() {
    var seed = 7; function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    var g = { kind: 'electron', lamNm: 650, dMm: 0.25, Lm: 2.0, aMm: 0.05, slit: 'both', det: false };
    var dist = buildDist(g), out = '';
    [[10, 0], [200, 1], [2000, 2]].forEach(function (a) {
      var x0 = 14 + a[1] * 150;
      out += '<rect x="' + x0 + '" y="6" width="120" height="170" rx="6" style="fill:' + INK + '"/>';
      for (var i = 0; i < a[0]; i++) {
        var y = sampleDist(dist, rnd);
        if (Math.abs(y) > 14) continue;
        out += '<circle cx="' + (x0 + 8 + rnd() * 104).toFixed(1) + '" cy="' + (91 - y * 5.8).toFixed(1) + '" r="' + (a[0] > 500 ? 1.4 : 2.6) + '" style="fill:var(--color-sim-slit-tint)"/>';
      }
      out += T(x0 + 60, 200, ['10개', '200개', '2,000개'][a[1]], { size: 20 });
    });
    return svg('0 0 460 210', out);
  }
  /** 개념 그림 4: 측정기 끔(줄무늬) · 켬(넓은 띠) 밝기 곡선 */
  function figDetector() {
    function path(det, x0) {
      var g = { kind: 'electron', lamNm: 650, dMm: 0.25, Lm: 2.0, aMm: 0.05, slit: 'both', det: det }, d = '', mx = 0, vals = [], i;
      for (i = 0; i <= 160; i++) { var v = intensity(g, -16 + i * 0.2); vals.push(v); if (v > mx) mx = v; }
      for (i = 0; i <= 160; i++) d += (i ? ' L ' : 'M ') + (x0 + vals[i] / mx * 150).toFixed(1) + ' ' + (10 + i).toFixed(1);
      return '<line x1="' + x0 + '" y1="10" x2="' + x0 + '" y2="170" style="stroke:' + INK + ';stroke-width:2"/><path d="' + d + '" style="fill:none;stroke:' + SL + ';stroke-width:3"/>';
    }
    return svg('0 0 460 210', path(false, 20) + path(true, 250) + T(95, 198, '측정기 끔: 줄무늬', { size: 20 }) + T(325, 198, '측정기 켬: 넓은 띠', { size: 20 }));
  }

  var BASE = { lam: 650, d: 0.25, L: 2.0, V: 1000, dR: 5, LR: 5, a: 0.05, slit: 'both', det: false };
  function withBase(o) { var r = copy(BASE); for (var k in o) r[k] = o[k]; return r; }
  var SLIT_INFO = '슬릿 = 빛이 지나가는 아주 좁은 틈';
  /* R9(§4-2): 고급 카드 ⑥⑦ — 번호는 두 갈래 공통(⑥ 전자 전압 4배 · ⑦ 슬릿 폭 2배). 다른 갈래의 카드를 고르면 그 갈래로 옮겨 같은 번호 카드를 연다(다리 카드) */
  var ADV6 = { name: '전압 4배', tag: '탐구 재현', changes: '전자 가속 전압 1000 → 4000 V', fixed: '전자 · d 5 · L 5 눈금 · 측정기 끔',
    values: withBase({ send: 'electron', rate: 1000, V: 4000 }),
    predict: { question: '전자의 가속 전압을 1000 V 에서 4000 V 로 4배 높이면 무늬 간격은?', choices: ['2배로 넓어진다', '½로 좁아진다', '¼로 좁아진다'],
      info: '실험 ①(1000 V)을 먼저 기록해 두면 두 무늬를 나란히 비교할 수 있어요.',
      answer: 2, why: '$λ$ = {{frac:$h$|√(2$meV$)}} 라서 $V$ 4배 → $λ$ ½(38.8 → 19.4 pm) → 무늬 간격도 ½이에요. ¼을 골랐다면 제곱근을 빠뜨렸는지 확인해요.' },
    onApply: function () { presetHint = '▶ 실행 후 1000 V 무늬와 간격을 비교해요'; } };
  var ADV7 = { name: '슬릿 폭 2배', tag: '심화', changes: '슬릿 폭 0.05 → 0.10 mm', fixed: 'λ 650 nm · d 0.25 mm · L 2.0 m',
    values: withBase({ send: 'wave', a: 0.10 }),
    predict: { question: '슬릿 하나의 폭 $a$ 를 0.05 → 0.10 mm 로 두 배 넓히면 스크린 무늬는?', choices: ['줄 간격이 넓어진다', '바깥쪽 줄이 더 빨리 어두워진다', '줄무늬가 사라진다'],
      answer: 2, why: '줄 간격 $Δy$ = {{frac:$λL$|$d$}} 에는 $a$ 가 없어 그대로예요. 한 틈에서 퍼지는(회절) 밝은 띠의 폭이 $a$ 에 반비례해 좁아지므로, 줄무늬를 감싸는 밝기가 바깥쪽에서 더 빨리 어두워져요.' },
    onApply: function () { presetHint = '▶ 실행 후 바깥쪽 줄의 밝기를 봐요'; } };
  function bridgeCard(card, mode, idx) {
    return { name: card.name, tag: card.tag, changes: card.changes, fixed: card.fixed, values: {},
      onApply: function () {
        setTimeout(function () { if (entrance !== mode) pickEntrance(mode); SK.applyPreset(idx, { noConfirm: true }); }, 0);
      } };
  }
  var ADV6_BRIDGE = bridgeCard(ADV6, 'quantum', 5), ADV7_BRIDGE = bridgeCard(ADV7, 'physics', 6);
  var PRESETS = {
    physics: [
      { name: '밝은 줄 간격 재기', tag: '탐구 재현', changes: '빨간 빛 650 nm 그대로', fixed: 'λ 650 nm · d 0.25 mm · L 2.0 m',
        values: withBase({ send: 'wave' }),
        predict: { question: '빨간 레이저 빛이 두 {{슬릿}}을 지나면 스크린에 어떤 무늬가 생길까?', info: SLIT_INFO, figure: predictFigure('wave'),
          choices: ['밝은 점 하나', '밝은 줄 두 개', '밝고 어두운 줄 여러 개'],
          answer: 3, why: '두 틈에서 나온 빛이 겹쳐요. 보강(같은 방향이 겹쳐 더 밝아짐)된 곳은 밝은 줄, 상쇄(반대 방향이 겹쳐 지워짐)된 곳은 어두운 줄이 돼요.' },
        // R9(§4-2, 기획B §4): 초급 — 재기 없이 관찰만, 같은 정답(③)
        basic: { name: '빨간 빛 보기', changes: '빨간 빛 그대로', q: '빨간 빛이 두 틈을 지나면 스크린에 무엇이 생길까?',
          choices: ['밝은 점 하나', '밝은 줄 두 개', '밝고 어두운 줄이 번갈아'], answer: 3,
          why: '두 틈에서 나온 빛이 스크린에서 다시 만나요. 서로 힘을 보태는 곳은 밝은 줄, 서로 지우는 곳은 어두운 줄이 되어 번갈아 생겨요.' },
        onApply: function () { presetHint = '▶ 실행으로 빛을 켜고 간격을 재요'; } },
      { name: '빨강과 파랑', tag: '대표 문항', changes: '빨강 650 nm → 파랑 450 nm', fixed: 'd 0.25 mm · L 2.0 m',
        values: withBase({ send: 'wave', lam: 450 }),
        predict: { question: '빨강(650 nm) 대신 파랑(450 nm) 빛을 비추면 무늬 간격은?', choices: ['넓어진다', '좁아진다', '그대로다'],
          info: '실험 ①에서 빨강을 재고 기록해 두면 두 무늬를 나란히 비교할 수 있어요.',
          answer: 2, why: '$Δy$ = {{frac:$λL$|$d$}} 에서 $λ$ 가 약 0.7배라 간격도 5.2 → 약 3.6 mm 로 좁아져요.' },
        basic: { name: '빨강을 파랑으로', changes: '빨간 빛 → 파란 빛', q: '빨간 빛 대신 파란 빛을 비추면 밝은 줄 사이가?', choices: ['넓어진다', '좁아진다', '그대로'], answer: 2,
          why: '파란 빛은 빨간 빛보다 파장이 짧아요. 그래서 밝은 줄 사이가 더 좁아져요.' },
        onApply: function () { presetHint = '▶ 실행 후 파란 무늬 간격을 재요'; } },
      { name: '슬릿 간격 2배', tag: '탐구 재현', changes: '슬릿 간격 0.25 → 0.50 mm', fixed: 'λ 650 nm · L 2.0 m',
        values: withBase({ send: 'wave', d: 0.5 }),
        predict: { question: '두 슬릿 사이를 두 배(0.50 mm)로 넓히면 무늬 간격은?', choices: ['두 배로 넓어진다', '반으로 좁아진다', '그대로다'],
          answer: 2, why: '$d$ 는 식의 분모라서 두 배가 되면 $Δy$ 는 ½배 — 5.2 → 2.6 mm 예요.' },
        basic: { name: '두 틈을 넓히면', changes: '두 틈 사이를 두 배로', q: '두 틈 사이를 더 넓히면 밝은 줄 사이가?', choices: ['넓어진다', '좁아진다', '그대로'], answer: 2,
          why: '두 틈이 멀어질수록 밝은 줄이 더 촘촘하게 생겨요. 그래서 밝은 줄 사이가 좁아져요.' },
        onApply: function () { presetHint = '▶ 실행 후 촘촘한 줄을 간격 여러 개로 재요'; } },
      { name: '스크린을 멀리', tag: '탐구 재현', changes: '스크린 거리 2.0 → 3.0 m', fixed: 'λ 650 nm · d 0.25 mm',
        values: withBase({ send: 'wave', L: 3.0 }),
        predict: { question: '스크린을 2.0 m 에서 3.0 m 로 멀리 두면 무늬 간격은?', choices: ['1.5배로 넓어진다', '좁아진다', '그대로다'],
          answer: 1, why: '$Δy$ 는 $L$ 에 비례해요. $L$ 이 1.5배라 5.2 → 7.8 mm 가 돼요.' },
        onApply: function () { presetHint = '▶ 실행 후 넓어진 줄 사이를 재요'; } },
      { name: '슬릿 하나만?', tag: '오개념', changes: '위쪽 슬릿만 열기', fixed: 'λ 650 nm · d 0.25 mm · L 2.0 m',
        values: withBase({ send: 'wave', slit: 'top' }),
        predict: { question: '슬릿을 하나만 열면 줄무늬가 사라질까? 스크린 무늬는?', choices: ['밝은 줄 수가 반으로 준다', '넓은 밝은 띠 하나', '그대로다'],
          answer: 2, why: '겹칠 빛이 없어 간섭이 생기지 않아요. 한 틈에서 퍼진(회절) 넓은 띠 하나만 보여요.' },
        basic: { name: '틈 하나만 열면', changes: '위쪽 틈만 열기', q: '틈을 하나만 열면 줄무늬가?', choices: ['그대로', '사라지고 넓은 띠 하나', '어두워지기만'], answer: 2,
          why: '만나서 겹칠 다른 빛이 없어요. 그래서 줄무늬가 사라지고 한 틈에서 퍼진 넓은 띠 하나만 보여요.' },
        onApply: function () { presetHint = '▶ 실행 후 줄무늬가 있는지 봐요'; } },
      ADV6_BRIDGE,
      ADV7
    ],
    quantum: [
      { name: '전자 하나씩', tag: '탐구 재현', changes: '전자를 1초에 1개씩', fixed: '1000 V · d 5 · L 5 눈금 · 측정기 끔',
        values: withBase({ send: 'electron', rate: 1 }),
        predict: { question: '전자를 한 개씩 보내 수천 개를 쌓으면 스크린에 무엇이 생길까?', info: SLIT_INFO, figure: predictFigure('electron'),
          choices: ['슬릿 뒤에 두 줄', '여러 줄무늬', '무늬 없이 고르게'],
          answer: 2, why: '전자 하나는 점 하나로 찍히지만, 어디에 찍힐지는 두 길이 간섭한 확률로 정해져요. 그래서 쌓이면 줄무늬가 돼요.' },
        onApply: function () { presetHint = '▶ 실행해 처음 10개를 지켜봐요'; } },
      { name: '광자 하나씩', tag: '탐구 재현', changes: '전자 대신 광자(아주 약한 빛)', fixed: 'λ 650 nm · d 0.25 mm · L 2.0 m',
        values: withBase({ send: 'photon', rate: 20 }),
        predict: { question: '아주 약한 빛을 광자 한 개씩 보내면 스크린에는?', choices: ['흩어진 점이 쌓여 줄무늬', '처음부터 줄무늬', '띠 두 개'],
          answer: 1, why: '광자 하나는 한 점으로 도착(입자)하지만, 쌓이면 레이저와 같은 간섭 무늬(파동)가 돼요.' },
        onApply: function () { presetHint = '▶ 실행해 점이 쌓이는 걸 봐요'; } },
      { name: '작은 구슬이면?', tag: '오개념', changes: '전자 대신 작은 구슬', fixed: 'd 0.25 mm · L 2.0 m · 슬릿 둘',
        values: withBase({ send: 'marble', rate: 1000 }),
        predict: { question: '아주 작은 구슬을 하나씩 보내면 스크린에 무엇이 생길까?', choices: ['띠 두 개', '여러 줄의 줄무늬', '아무 무늬 없음'],
          answer: 1, why: '구슬은 한 슬릿을 곧게 지나 그림자 띠 두 개만 만들어요. 간섭은 없어요.' },
        onApply: function () { presetHint = '▶ 실행해 구슬이 쌓인 모양을 봐요'; } },
      { name: '측정기를 켜면?', tag: '기묘함', changes: '측정기 끄기 → 켜기', fixed: '전자 · 1000개/s · 슬릿 둘',
        values: withBase({ send: 'electron', rate: 1000, det: true }),
        predict: { question: '어느 슬릿을 지났는지 알아내는 {{측정기}}를 켜고 전자를 보내면?', choices: ['줄무늬가 그대로 남는다', '줄무늬가 사라진다', '아무것도 안 생긴다'],
          info: '실험 ①(측정기 끔)을 먼저 기록해 두면 두 무늬를 비교할 수 있어요.',
          answer: 2, why: '어느 슬릿을 지났는지 정보가 남으면 두 길이 겹칠 수 없어 간섭이 사라져요. 사람이 봐서가 아니라 정보가 남아서예요.' },
        onApply: function () { presetHint = '▶ 실행 후 측정기 끔과 비교해요'; } },
      { name: '슬릿 하나만?', tag: '오개념', changes: '위쪽 슬릿만 열기', fixed: '전자 · 1000개/s',
        values: withBase({ send: 'electron', rate: 1000, slit: 'top' }),
        predict: { question: '전자도 슬릿을 하나만 열면 줄무늬가 사라질까?', choices: ['줄무늬가 그대로', '넓은 띠 하나', '점이 안 찍힌다'],
          answer: 2, why: '길이 하나뿐이면 간섭할 상대가 없어 넓은 띠 하나만 생겨요. 전자도 빛과 똑같아요.' },
        onApply: function () { presetHint = '▶ 실행 후 슬릿을 다시 열어 봐요'; } },
      ADV6,
      ADV7_BRIDGE
    ]
  };
  // R5: 예측 창은 위쪽(place:'top') — 레이저·슬릿은 왼쪽 가운데, 무늬·확대창은 오른쪽이라 위는 상태 칩뿐
  // R7 학생점검(A3): ƒ 식 탭이 여는 설명 장 — 빛 갈래 = 4장 'dy', 하나씩 갈래 = 7장 'matter-wave'
  ['physics', 'quantum'].forEach(function (k) { PRESETS[k].forEach(function (c) { if (c.predict) c.predict.place = 'top'; c.formulaCh = k === 'physics' ? 'dy' : 'matter-wave'; }); });

  /** R9(§4-2, 기획B §5): 초급 결과 해설 — 기호 없이 '~했어요', 크다·작다·같다·넓다·좁다만 */
  function basicTakeaway(p) {
    if (p.send === 'marble') return { line: '구슬은 띠 두 개만 생겼어요', lesson: 'wave-words',
      more: '구슬은 한 틈만 곧게 지나가서 서로 겹치지 않아요. 그래서 줄무늬 없이 틈 뒤에 띠 두 개만 생겨요.' };
    if (p.slit !== 'both') return { line: '틈이 하나면 넓은 띠 하나만 생겨요', lesson: 'wave-words',
      more: '만나서 겹칠 다른 빛이 없어 줄무늬가 생기지 않아요. 한 틈에서 퍼진 넓은 띠 하나만 남아요. 그림의 막힌 틈을 눌러 다시 열고 비교해 봐요.' };
    if (p.det && p.send !== 'wave') return { line: '어느 틈으로 갔는지 알게 되자 줄무늬가 사라졌어요', lesson: 'wave-words',
      more: '어느 틈을 지났는지 기록이 남으면 두 길이 겹칠 수 없어요. 그래서 줄무늬 없이 넓게 쌓여요.' };
    if (p.send === 'wave') {
      var w = bandWord(p), cmp = w && /^지난번/.test(w) ? ' 이번에는 밝은 줄 사이가 ' + w + '.' : '';
      return { line: '밝은 줄과 어두운 줄이 번갈아 생겼어요', lesson: 'wave-words',
        more: '두 틈에서 나온 빛이 스크린에서 다시 만나요. 서로 힘을 보태는 곳은 밝아지고, 서로 지우는 곳은 어두워져요. 빛의 색이 빨강 쪽일수록(파장이 길수록), 두 틈 사이가 좁을수록 밝은 줄 사이가 넓어요.' + cmp };
    }
    return { line: '하나씩 보내도 쌓이면 줄무늬가 돼요', lesson: 'wave-words',
      more: '점 하나가 어디에 찍힐지는 알 수 없지만, 많이 쌓이면 늘 같은 줄무늬가 돼요. 빛처럼 두 길이 겹쳐서 생기는 무늬예요.' };
  }
  SK.takeaway(function (p) {
    if (SK.level && SK.level() === 'basic') return basicTakeaway(p);
    var u = unitY(p);
    if (p.send === 'marble') return { line: '구슬은 그림자 자리에 띠 두 개만 생겼어요', lesson: 'matter-wave',
      more: '구슬은 알갱이처럼 한 슬릿만 곧게 지나가요. 두 길이 겹치지 않으니 간섭이 없고, 각 슬릿 뒤 그림자 띠 두 개가 생겨요. 전자·광자의 줄무늬와 비교해 보세요.' };
    if (p.slit !== 'both') return { line: '슬릿 하나면 넓은 띠 하나만 생겨요', lesson: 'misc',
      more: '간섭은 두 길에서 온 물결이 겹쳐야 생겨요. 길이 하나뿐이면 한 틈에서 퍼진(회절) 넓은 띠만 남아요. 막힌 슬릿을 눌러 다시 열고 비교해 보세요.' };
    if (p.det && p.send !== 'wave') return { line: '어느 길인지 알게 되자 줄무늬가 사라졌어요', lesson: 'which-way',
      more: '측정기가 지나간 슬릿을 기록하면 두 길이 겹칠 수 없어 간섭이 사라져요. 사람이 보는지와는 상관없어요. 이 화면에서는 슬릿 간격이 좁아 두 띠가 겹쳐 하나로 보여요 — 핵심은 줄무늬가 사라진다는 것이에요.' };
    if (p.send === 'wave') return { line: '밝은 줄(보강)과 어두운 줄(상쇄)이 번갈아 생겼어요', lesson: 'path-diff',
      more: '두 틈에서 나온 빛이 스크린의 한 점까지 가는 길이의 차(경로차)가 파장의 정수배면 보강(같은 방향이 겹쳐 더 밝아짐), 반 파장의 홀수배면 상쇄(반대 방향이 겹쳐 지워짐)예요. 이웃한 밝은 줄 사이는 $Δy$ = {{frac:$λL$|$d$}} 로 계산해요. 확대 보기에서 재어 비교해 보세요.' };
    var who = p.send === 'electron' ? '전자' : '광자';
    return { line: who + '를 하나씩 보내도 쌓이면 줄무늬가 돼요', lesson: p.send === 'electron' ? 'matter-wave' : 'photon',
      more: '점 하나가 어디에 찍힐지는 예측할 수 없지만, 수천 개가 쌓이면 늘 같은 줄무늬가 돼요. 줄무늬는 점이 닿을 확률의 모양이에요 — ' + who + '는 입자로 도착하고, 어디에 도착할지는 파동처럼 간섭해서 정해져요. (줄 간격 단위: ' + u + ')' };
  });

  var THINKS = [
    { id: 'p-narrow', mode: 'physics', lesson: 'dy', q: '무늬 간격 $Δy$ 를 좁게 만들려면 어떻게 해야 할까?', choices: ['파장을 더 길게', '슬릿 간격을 더 넓게', '스크린을 더 멀리'], answer: 2,
      why: '$Δy$ = {{frac:$λL$|$d$}} 에서 $d$ 는 분모라 키우면 $Δy$ 가 작아져요. 파장을 길게 하거나 스크린을 멀리하면 오히려 넓어져요.' },
    { id: 'p-calc', mode: 'physics', lesson: 'dy', q: '초록 빛($λ$ 500 nm), 슬릿 간격 $d$ 0.20 mm, 스크린 거리 $L$ 1.6 m 이면 무늬 간격 $Δy$ 는?', choices: ['2.0 mm', '4.0 mm', '6.4 mm'], answer: 2,
      hint: '$Δy$ = {{frac:$λ$ × $L$|$d$}} (모두 m 로 바꿔 넣어요)', hintFold: true,
      why: '$Δy$ = {{frac:500×10⁻⁹ m × 1.6 m|0.20×10⁻³ m}} = 4.0×10⁻³ m = 4.0 mm. 패널에 값을 직접 넣어 재 보며 확인해 봐요.' },
    { id: 'p-half', mode: 'physics', lesson: 'dy', q: '5.2 mm 였던 무늬에서 스크린 거리만 2.0 m → 1.0 m 로 줄이면 간격은 몇 mm 가 될까? 이유도 써 봐요.',
      hint: '$Δy$ 는 $L$ 에 비례해요',
      reveal: '<b>모범 답: 2.6 mm</b><br>무늬 간격 Δy 는 L 에 비례하므로 L 이 ½배면 Δy 도 ½배예요.<br>같은 2.6 mm 는 슬릿 간격을 0.25 → 0.50 mm 로 두 배 넓혀도 나와요(d 는 분모라 두 배면 ½배).' },
    { id: 'p-two', mode: 'physics', lesson: 'path-diff', q: '친구가 "밝은 줄은 슬릿 수만큼, 그러니까 2개 생겨"라고 했어요. 맞을까?',
      reveal: '<b>아니에요.</b><br>밝은 줄은 두 빛의 경로차가 0, λ, 2λ … 인 곳(보강)마다 생겨서 여러 개예요.<br>줄이 2개뿐인 건 구슬처럼 간섭하지 않는 알갱이를 보낼 때예요.' },
    { id: 'q-first', mode: 'quantum', lesson: 'photon', q: '전자를 한 개씩 보내면 처음 몇 개의 점은 어떻게 찍힐까?', choices: ['처음부터 줄무늬 모양으로', '아무 데나 흩어진 것처럼', '두 슬릿 바로 뒤 두 곳에만'], answer: 2,
      why: '점 하나가 어디에 닿을지는 예측할 수 없어 처음엔 흩어져 보여요. 수천 개가 쌓이면 확률이 큰 곳(밝은 줄)에 몰려 늘 같은 줄무늬가 드러나요.' },
    { id: 'q-volt', mode: 'quantum', lesson: 'matter-wave', q: '가속 전압 $V$ 를 4배로 높이면 무늬 간격은?', choices: ['2배로 넓어진다', '½로 좁아진다', '¼로 좁아진다'], answer: 2,
      hint: '$p$ = √(2$meV$), $λ$ = {{frac:$h$|$p$}}', hintFold: true,
      why: '$V$ 4배 → $p$ 2배(√4 = 2) → $λ$ = {{frac:$h$|$p$}} 는 ½ → 무늬 간격도 ½이에요. ¼을 골랐다면 제곱근을 빠뜨렸는지 확인해요.' },
    { id: 'q-which', mode: 'quantum', lesson: 'which-way', q: '전자 하나는 어느 슬릿을 지났을까? 측정기를 켰을 때와 껐을 때의 무늬를 근거로 이야기해 봐요.',
      reveal: '<b>생각해 볼 점</b><br>측정기를 끄면 줄무늬가 생기므로, 전자는 두 길의 가능성을 함께 지닌 파동처럼 행동해요.<br>어느 슬릿인지 알아내면 줄무늬가 사라져요 — "어느 쪽"이 정해지면 간섭이 없어지는 것이 양자 세계의 특징이에요.' },
    { id: 'q-human', mode: 'quantum', lesson: 'which-way', q: '"측정기를 켜면 사람이 지켜봐서 무늬가 사라진다"는 말은 맞을까?',
      reveal: '<b>아니에요.</b><br>사람이 보는 것과는 관계없어요. 어느 슬릿을 지났는지 정보가 장치에 남기만 하면(아무도 안 봐도) 두 경로가 겹칠 수 없어 간섭이 사라져요.' }
  ];
  THINKS.forEach(function (t) {
    var m = t.mode, o = copy(t); delete o.mode;
    o.when = function () { return entrance === m && !(SK.level && SK.level() === 'basic'); };   // R9: 초급 정리는 설명 층 초급 문항(levels:['basic'])만 — 이 카드들은 Δy·경로차를 써서 중급부터
    SK.think(o);
  });

  var TERMS = {
    '파장': '물결의 마루에서 다음 마루까지 거리(λ). 빛은 파장에 따라 색이 달라요 — 빨강 약 700 nm, 보라 약 400 nm.',
    '슬릿': '빛이나 전자가 지나가는 아주 좁은 틈. 이중 슬릿 = 틈 두 개.',
    '간섭': '두 물결이 만나 겹치는 것. 마루끼리 만나면 더 밝아지고(보강), 마루와 골이 만나면 어두워져요(상쇄).',
    '보강 간섭': '같은 방향이 겹쳐 더 밝아지는 것. 경로차가 0, λ, 2λ … 인 곳 → 밝은 줄.',
    '상쇄 간섭': '반대 방향이 겹쳐 지워지는 것. 경로차가 ½λ, 1½λ … 인 곳 → 어두운 줄.',
    '경로차': '두 슬릿에서 스크린의 한 점까지 가는 거리의 차이.',
    '회절': '좁은 틈을 지난 물결이 뒤로 넓게 퍼지는 현상.',
    'Δy': '이웃한 밝은 줄(또는 어두운 줄) 사이의 거리 = 무늬 간격. "델타 와이"라고 읽어요.',
    '확대 보기': '스크린 가운데 ±15 mm 를 크게 보여 주는 창. 여기서 밝은 줄 사이를 재요(누르거나, Tab 으로 들어가 ↑↓ · Enter).',
    '간격 수 n': '잰 두 밝은 줄 사이에 있는 간격 수. 밝은 줄 6개 사이를 쟀다면 n = 5.',
    '광자': '빛의 알갱이. 아주 약한 빛은 광자가 하나씩 도착해 점으로 찍혀요.',
    '드브로이 파장': '움직이는 입자도 가진 파장 $λ$ = {{frac:$h$|$p$}} ($h$: 플랑크 상수, $p$: 운동량). 빠를수록 짧아요.',
    '측정기': '전자가 어느 슬릿을 지났는지 알아내는 장치. 정보가 남으면 간섭이 사라져요.',
    '이론 곡선': '스크린 왼쪽의 굵은 곡선. 식으로 계산한 밝기(또는 점이 찍힐 확률)예요.',
    '지난 실행': '값을 바꾸기 바로 전(지난번 실행)의 무늬. 스크린 오른쪽 좁은 띠에 흐리게 남아요(저장은 안 됨).',
    '눈금(모형)': '전자 모드의 길이 단위. 실제 길이가 아니라 줄무늬 모양을 보기 위해 화면에 맞게 키운 모형 단위예요.'
  };
  var HELP = {
    physics: {
      how: ['아래 [실험 고르기 ▾]에서 실험을 고르면 값이 바뀌고 예측 질문이 나와요. 답을 골라 예측하기를 눌러요.',
        '아래 ▶ 실행을 누르면 빛이 켜지고 스크린에 밝고 어두운 줄이 생겨요.',
        '오른쪽 {{확대 보기}}에서 밝은 줄 가운데를 한 번, 다른 밝은 줄을 한 번 눌러요. 가까이 누르면 줄 가운데로 저절로 맞춰져요. 키보드로는 Tab 으로 확대 보기에 들어가 ↑↓ 로 밝은 줄을 고르고 Enter 를 눌러요.',
        '두 점 사이 간격 수를 세어 {{간격 수 n}}을 맞추면 간격 1개 $Δy$ 가 나와요. 간격 여러 개를 재고 나누면 더 정확해요.',
        '기록하기 버튼으로 저장하고, 파장 $λ$ 하나만 바꿔 다시 재고 기록해요.',
        '비교 단계 표에서 $λ$ 와 $Δy$ 의 관계를 찾아요. 기록한 뒤에는 아래 식 상자의 답 확인하기로 이론값을 볼 수 있어요.']
    },
    quantum: {
      how: ['아래 [실험 고르기 ▾]에서 실험을 고르면 값이 바뀌고 예측 질문이 나와요. 답을 골라 예측하기를 눌러요.',
        '아래 ▶ 실행을 누르면 하나씩 날아가 스크린에 점으로 찍혀요. 처음 몇 개를 지켜봐요.',
        '오른쪽 패널의 보내는 빠르기(느리게·보통·빨리 감기)나 1만 개 한꺼번에 보내기로 점을 많이 쌓아요.',
        '무늬가 보이면 기록하기 버튼으로 저장해요.',
        '{{측정기}}를 켜거나 구슬로 바꿔 다시 쌓고 기록해 두 무늬를 비교해요.']
    }
  };
  var C_INTER = { title: '간섭 — 줄무늬가 생기는 까닭',
    summary: '두 틈에서 나온 물결이 만나 밝은 곳과 어두운 곳이 생겨요',
    plain: '빛은 물결(파동)이에요. 두 슬릿을 지난 빛은 각각 둥글게 퍼져 스크린에서 다시 만나요.\n마루와 마루가 만나면 보강(같은 방향이 겹쳐 더 밝아짐) → 밝은 줄\n마루와 골이 만나면 상쇄(반대 방향이 겹쳐 지워짐) → 어두운 줄',
    example: '연못에 돌 두 개를 동시에 던지면 물결이 겹쳐 크게 출렁이는 곳과 잔잔한 곳이 번갈아 생겨요.',
    figure: figInterference(),
    formula: '경로차 = mλ → 밝은 줄 · 경로차 = (m + ½)λ → 어두운 줄',
    symbols: [{ s: '경로차', meaning: '두 슬릿에서 스크린의 한 점까지 거리의 차', unit: 'm' }, { s: 'λ', meaning: '빛의 파장', unit: 'm (1 nm = 10⁻⁹ m)' }, { s: 'm', meaning: '정수 0, 1, 2 … (가운데 밝은 줄이 0)', unit: '없음' }],
    why: '스크린 한가운데는 두 슬릿까지 거리가 같아(경로차 0) 마루와 마루가 함께 도착해 밝아요.\n조금 옆으로 가면 한쪽 길이 반 파장 더 길어져 마루와 골이 만나 어두워요.\n더 가면 한 파장 차이가 되어 다시 밝아져요. 그래서 밝고 어두운 줄이 번갈아 생겨요.' };
  var C_SPACING = { title: '무늬 간격 $Δy$ = {{frac:$λL$|$d$}}',
    summary: '파장이 길수록·슬릿 간격이 좁을수록 줄 간격이 넓어요',
    plain: '이웃한 밝은 줄 사이 거리 $Δy$ 는 세 값으로 정해져요.\n파장 $λ$ 가 길수록(빨강 쪽) → 넓어요\n스크린 거리 $L$ 이 멀수록 → 넓어요\n슬릿 간격 $d$ 가 넓을수록 → 좁아요',
    example: '650 nm, $L$ 2.0 m, $d$ 0.25 mm → $Δy$ = {{frac:650×10⁻⁹ × 2.0|0.25×10⁻³}} = 5.2×10⁻³ m = 5.2 mm',
    figure: figGeometry(),
    formula: '$Δy$ = {{frac:$λL$|$d$}}',
    symbols: [
      { s: 'Δy', meaning: '이웃한 밝은 줄 사이 거리(무늬 간격)', unit: 'm (화면은 mm)' },
      { s: 'λ', meaning: '빛의 파장', unit: 'm (1 nm = 10⁻⁹ m)' },
      { s: 'L', meaning: '슬릿에서 스크린까지 거리', unit: 'm' },
      { s: 'd', meaning: '두 슬릿 가운데 사이 거리', unit: 'm (1 mm = 10⁻³ m)' },
      { s: 'm', meaning: '밝은 줄 번호 (가운데 0, 1, 2 …)', unit: '없음' }],
    why: '① $m$번째 밝은 줄에서 두 빛의 경로차는 $d$ sin $θ$ 이고, 밝으려면 $d$ sin $θ$ = $mλ$ 여야 해요.\n② 스크린이 아주 멀어($L$ ≫ $y$) 각 $θ$ 가 작으면 sin $θ$ ≈ tan $θ$ = {{frac:$y$|$L$}} 이에요.\n③ 두 식을 합치면 $y$ = {{frac:$mλL$|$d$}} → 이웃한 줄($m$ 과 $m$ + 1) 사이는 $Δy$ = {{frac:$λL$|$d$}}.\n그래서 $Δy$ 는 $λ$·$L$ 에 비례하고 $d$ 에 반비례해요.',
    live: function (p) {
      if (p.send === 'electron') return '(모형) 무늬 간격 = ' + SK.fmt(fringe(geomOf(p)), 1) + ' 눈금';
      if (p.send === 'marble') return '구슬은 간섭하지 않아 줄무늬가 없어요.';
      return '{{frac:' + p.lam + '×10⁻⁹ m × ' + SK.fmt(p.L, 1) + ' m|' + SK.fmt(p.d, 2) + '×10⁻³ m}} = ' + SK.fmt(fringe(geomOf(p)), 1) + ' mm';
    } };
  var C_ELECTRON = { title: '전자도 파동처럼 — 드브로이 파장',
    summary: '전자도 파동처럼 줄무늬를 만들어요',
    plain: '전자를 한 개씩 보내면 스크린에 점 하나씩 찍혀요(입자처럼 도착).\n점 하나가 어디에 찍힐지는 예측할 수 없지만, 수천 개가 쌓이면 늘 같은 줄무늬가 돼요.\n→ 줄무늬는 점이 닿을 확률의 모양이에요. 확률이 큰 곳이 밝은 줄이에요.',
    example: '1000 V 로 가속한 전자의 파장은 약 38.8 pm(0.0388 nm) — 빛(약 500 nm)의 1만분의 1쯤이에요.',
    figure: figDots(),
    formula: '$λ$ = {{frac:$h$|$p$}} = {{frac:$h$|√(2$meV$)}}',
    symbols: [
      { s: 'λ', meaning: '드브로이 파장', unit: 'm (1 pm = 10⁻¹² m)' },
      { s: 'h', meaning: '플랑크 상수 6.63×10⁻³⁴', unit: 'J·s' },
      { s: 'p', meaning: '운동량 (질량 × 속력)', unit: 'kg·m/s' },
      { s: 'm', meaning: '전자의 질량 9.11×10⁻³¹', unit: 'kg' },
      { s: 'e', meaning: '전자의 전하량 1.60×10⁻¹⁹', unit: 'C' },
      { s: 'V', meaning: '가속 전압', unit: 'V' }],
    why: '전압 $V$ 로 가속한 전자의 운동 에너지는 $eV$ = {{frac:$p^2$|2$m$}} 이라서 $p$ = √(2$meV$) 예요.\nV 4배 → $p$ 2배 → $λ$ = {{frac:$h$|$p$}} 는 ½ → 무늬 간격도 ½.\n실제 전자 파장은 너무 짧아, 이 화면은 줄무늬가 보이도록 키운 모형 단위(눈금)로 그렸어요. 식과 비례 관계는 똑같아요.',
    live: function (p) { return fmtN(p.V) + ' V → λ = ' + SK.fmt(pmOf(p.V), 1) + ' pm'; } };
  var C_DETECT = { title: '측정기 — 어느 길인지 알면',
    summary: '어느 틈인지 알면 줄무늬가 사라져요',
    plain: '측정기를 켜면 전자가 어느 슬릿을 지났는지 기록이 남아요.\n그러면 두 길이 겹칠 수 없어 간섭이 사라지고, 각 슬릿을 지난 전자가 만든 넓은 띠 두 개가 더해져요.\n사람이 보는지와는 상관없어요. 어느 길인지 정보가 남는 것이 중요해요.',
    example: '측정기 끔 → 줄무늬 · 측정기 켬 → 줄무늬 없는 넓은 띠',
    figure: figDetector(),
    why: '이 화면에서는 슬릿 간격이 좁아 두 띠가 겹쳐 하나로 보여요.\n핵심은 띠가 몇 개인지가 아니라 줄무늬가 사라진다는 것이에요.\n구슬은 처음부터 한 슬릿만 지나므로 측정기와 상관없이 늘 띠 두 개예요.' };
  var C_MYTH = { title: '흔한 오해 바로잡기',
    summary: '헷갈리기 쉬운 네 가지를 짚어 봐요',
    plain: '✗ "밝은 줄은 슬릿 수만큼 2개" → ✓ 간섭으로 여러 개가 생겨요.\n✗ "색은 무늬와 관계없다" → ✓ 파장(색)이 길수록 간격이 넓어요.\n✗ "전자를 하나씩 보내면 간섭이 없다" → ✓ 하나씩 보내도 쌓이면 줄무늬가 돼요.\n✗ "사람이 봐서 무늬가 사라진다" → ✓ 어느 길인지 정보가 남으면 사라져요.' };
  function applyHelp(v) {
    SK.help({ how: HELP[v].how,
      concepts: v === 'quantum' ? [C_ELECTRON, C_DETECT, C_INTER, C_SPACING, C_MYTH] : [C_INTER, C_SPACING, C_ELECTRON, C_DETECT, C_MYTH],
      terms: TERMS,
      keys: (v === 'quantum' ? [['K', '1만 개 한꺼번에 보내기'], ['D', '측정기 켜고 끄기'], ['W', '물결(파면) 보기'], ['Shift + 1·2·3', '보내는 빠르기 느리게·보통·빨리 감기']] : [['W', '물결(파면) 보기']])
        // R8(C1): 키보드 측정 — Tab 으로 확대 보기에 들어가서
        .concat([['Tab → 확대 보기', '측정 시작 (밝은 줄 후보 줄이 나와요)'], ['↑ ↓', '밝은 줄 후보 옮기기'], ['Enter', 'A(밝은 줄 하나) → B(다른 밝은 줄) 찍기'], ['Delete', '측정 지우기']]) });
  }

  /* ---- 모드 (두 갈래): 허브가 ?mode=physics|quantum 으로 넘김 ---- */
  var todayEl = SK.el.top.querySelector('.sim-today');
  function applyEntranceUI(v) {
    entrance = v;
    if (todayEl && todayEl.lastChild) todayEl.lastChild.textContent = v === 'physics' ? '파장을 바꾸면 무늬 간격은 어떻게 될까?' : '전자를 하나씩 보내도 줄무늬가 생길까?';
    SK.setPresets(PRESETS[v]);
    // R7(B5): 빛 = 왼쪽 '무늬 간격 Δy 재기 ①②③' 을 넓게(식은 설명 4장) · 하나씩 = 예전 비율(오른쪽 λ = h/p 식 칸)
    SK.el.band.style.gridTemplateColumns = v === 'physics' ? 'minmax(0, 6.6fr) minmax(0, 3.4fr)' : 'minmax(0, 4.6fr) minmax(0, 5.4fr)';
    setRecordColumns(v);
    SK.refreshThinks();
    applyHelp(v);
    presetHint = '';
    meas.guide = true;
    updatePanel(); refreshChecklist();
    ui.eqKey = null;
  }
  var MODE_STORE = 'simkit:mode:double-slit-quantum:mode';   // (R2 chooseMode 와 같은 저장 이름 — 세션 안에서 갈래 기억)
  function pickEntrance(v, boot) {
    try { sessionStorage.setItem(MODE_STORE, v); } catch (e) { /* 저장 안 돼도 동작 */ }
    if (SK.get('entry') !== v) SK.set('entry', v, { silent: true });   // R6: 모드 창에서 고른 값을 심플 두 단추에도
    // R6: '보낼 것'의 기본값을 모드에 맞춤 — 하나씩 보내기에서 [기본값으로]가 숨은 '빛(레이저)'로 돌리거나 '더 보기 ●'가 늘 켜지지 않게
    if (SK.defs.send) SK.defs.send.initial = v === 'physics' ? 'wave' : 'electron';
    applyEntranceUI(v);
    if (v === 'physics') SK.set('send', 'wave', { silent: true });
    else { SK.set('send', 'electron', { silent: true }); SK.set('rate', 20, { silent: true }); }
    SK.set('det', false, { silent: true });
    if (boot) return;   // 첫 진입: SimKit 이 곧 처음 상태를 만든다
    quietClear = true; clearMeasure(); SK.reset(); quietClear = false;
  }

  /* ---- R7: 설명 '해 보기' — 질문의 갈래(mode)·카드(card)를 먼저 맞춘 뒤 공통 SK.lessonTry 로 ---- */
  var baseLessonTry = SK.lessonTry;
  if (baseLessonTry) {
    SK.lessonTry = function (q) {
      q = q || {};
      if (q.mode !== 'physics' && q.mode !== 'quantum') return baseLessonTry(q);
      if (q.mode !== entrance) pickEntrance(q.mode);
      var o = {};
      for (var k in q) if (Object.prototype.hasOwnProperty.call(q, k)) o[k] = q[k];
      if (typeof q.card === 'number') o.preset = q.card;
      return baseLessonTry(o);
    };
  }

  /* ---- 전용 키 (화면에는 쓰지 않고 도움말 › 단축키에만) ---- */
  SK.onKey(function (e) {
    if (e.shiftKey && /^Digit[123]$/.test(e.code)) { if (!e.repeat && entrance === 'quantum') setRateLevel(+e.code.slice(5) - 1); return true; }
    if (e.shiftKey) return false;
    if (e.repeat && /^Key[DKW]$/.test(e.code)) return true;
    if (e.code === 'KeyD') {   // R6: 측정기(detector) 키 M → D — M 은 공통 틀의 심플 ↔ 자세히
      if (entrance !== 'quantum') return false;
      if (SK.get('send') === 'wave') SK.notice('측정기는 하나씩 보낼 때 써요', 'info');
      else SK.set('det', !SK.get('det'));
      return true;
    }
    if (e.code === 'KeyK') { if (entrance !== 'quantum') return false; skipMany(10000); return true; }
    if (e.code === 'KeyW') { SK.set('showWave', !SK.get('showWave')); return true; }
    return false;
  });

  /* ---- 수업 안내 (교사 모드) ---- */
  SK.guide({
    rows: [
      { key: 'lam', target: '빛의 파장 λ — 400~700 nm, 기본 650 · 바로 반영', standard: '[12물리03-01] 간섭 · 탐구: 이중 슬릿에 의한 빛의 간섭', discover: 'λ↑ → Δy↑ (비례)', misconception: '색(파장)은 무늬와 관계없다' },
      { key: 'd', target: '슬릿 간격 d — 0.10~0.50 mm, 기본 0.25 · 바로 반영', standard: '[12물리03-01]', discover: 'd↑ → Δy↓ (반비례)', misconception: '밝은 줄은 슬릿 수만큼' },
      { key: 'L', target: '스크린 거리 L — 0.5~3.0 m, 기본 2.0 · 바로 반영', standard: '[12물리03-01]', discover: 'L↑ → Δy↑ (비례)', misconception: '—' },
      { key: 'V', target: '전자 가속 전압 V — 100~5000 V (λ = h/√(2meV) 표시) · 바로 반영', standard: '[12전자03-01] 드브로이 파장(정성)', discover: 'V↑ → λ↓ → 무늬 간격↓ (V 4배 → λ ½)', misconception: '전자는 작은 공일 뿐이다' },
      { key: 'send', target: '보내는 것 — 광자 / 전자 / 구슬 (하나씩 보내기 모드)', standard: '[12전자03-01] 이중성, 구슬은 비교용', discover: '구슬은 두 띠, 광자·전자는 쌓이면 줄무늬', misconception: '하나씩 보내면 간섭 없음' },
      { key: 'slit', target: '열린 슬릿 — 둘 / 위만 / 아래만 (화면의 슬릿을 눌러도 됨)', standard: '[12물리03-01] 간섭 조건', discover: '하나만 열면 넓은 띠 하나', misconception: '슬릿 하나면 줄 하나' },
      { key: 'det', target: '측정기 — 켬 / 끔 (하나씩 보내기 모드)', standard: '[12전자03-01], 연계 [12전자03-02]', discover: '어느 길인지 정보가 남으면 무늬 소멸', misconception: '사람이 봐서 사라진다' }
    ],
    sections: [
      { title: '수업 흐름', items: [
        '① 예측: 모드를 고르면 첫 실험 값이 바로 적용되고 예측 띠가 떠요. 예측 띠가 떠 있는 동안 스크린 무늬는 ? 로 가려져요.',
        '② 실행: 빛을 켜고 확대 보기에서 밝은 줄 두 곳을 눌러 재요. ±1.5 mm 안이면 줄 가운데로 맞춰지고, 사이 간격 수를 세어 n 을 제안해요. 키보드만으로도 잴 수 있어요(Tab → 확대 보기 → ↑↓ · Enter). 하나씩 보내기는 3,000개가 쌓이면 끝나요.',
        '③ 비교: 기록 3개 이상(빛: λ 만 바꿈), 큰 판의 체크리스트로 비례 관계 확인. 이론값은 기록 뒤 식 상자의 답 확인하기로 공개.',
        '④ 정리: 모드마다 질문 4개(선택형 2 + 서술형 2, 서술형은 답 확인하기). 교사 서랍에서 답 확인 잠금 가능.'
      ] },
      { title: '모형과 축척', items: [
        '스크린은 실제 ±30 mm 를 세로 480u 로, 확대 보기는 가운데 ±15 mm 를 400u 로 보여 줘요. 무늬 위치·간격 숫자는 실제 값으로 계산해요.',
        '슬릿판~스크린 거리 그림, 슬릿 간격 그림, 파면의 파장은 눈에 보이게 키운 모형이에요(축척 아님).',
        '전자 모드: λ 는 h/√(2meV) 로 실제 값을 보여 주고, 화면 무늬는 1000 V 일 때 빛 650 nm 와 같은 크기가 되도록 키웠어요(d·L 은 모형 단위 ‘눈금’).',
        '구슬: 발사기~슬릿 0.1 m 에서 퍼져 나온 구슬이 곧게 지나 생기는 그림자(두 띠 사이 = d × (0.1 + L) ÷ 0.1).',
        '측정기 문구는 "정보가 남으면"으로 씀("사람이 보면" 표현 쓰지 않음). 측정기를 켜면 두 슬릿 각각의 회절 띠가 더해진 넓은 띠가 돼요(슬릿 간격이 좁아 겹쳐 하나로 보임).'
      ] },
      { title: '확인할 것', items: ['교과서 쪽수·활동 이름 (확인 필요)', '[12전자03-02] 는 연계(정성)로만 다룸'] }
    ]
  });

  /* ---- R9(§4-2·§1-6): 단계 — 초급 이름·눈금 글자(색 이름·좁게↔넓게), 실험 고르기 '다른 갈래 보기 ▸', 고급 이론·측정 칸 ----
     값(λ·d·L·V…)·기록·측정 선은 그대로 두고 글자·노드만 바꾼다. 전자 갈래인 채 초급으로 내리면 공통 틀이 '이 갈래는 중급부터 나와요'(갈래 유지) */
  var LV_TICKS = { lam: ['보라', '초록', '빨강'], d: ['좁게', '', '넓게'] };
  var LV_LABEL = { lam: '빛의 색', d: '두 틈 사이' };
  function prepLevelLabels() {
    ['lam', 'd'].forEach(function (k) {
      var lab = SK.controls[k].el.querySelector('.var__label');
      if (!lab || lab._lv) return;
      var mid = SK.h('span', { class: 'dsq-lab-mid' });
      Array.prototype.slice.call(lab.childNodes).forEach(function (n) { if (!(n.classList && n.classList.contains('dsq-dot'))) mid.appendChild(n); });
      lab.appendChild(mid);
      lab.appendChild(SK.h('span', { class: 'dsq-lab-basic', text: LV_LABEL[k] }));
      lab._lv = true;
    });
  }
  function levelTicks(basic) {
    Object.keys(LV_TICKS).forEach(function (k) {
      var sp = SK.controls[k].el.querySelectorAll('.var__ticks > span');
      Array.prototype.forEach.call(sp, function (t, i) {
        if (t._lvOrig === undefined) { t._lvOrig = t.textContent; t._lvLong = t.classList.contains('is-long'); }
        var want = basic ? (LV_TICKS[k][i] || '') : t._lvOrig;
        if (t.textContent !== want) t.textContent = want;
        t.classList.toggle('is-long', basic ? false : t._lvLong);
      });
    });
  }
  // 초급 실험 고르기 시트 맨 아래 접힘 — 전자 갈래는 막지 않고 눈에 덜 띄게(0-2 #12)
  ui.otherBranch = SK.h('details', { class: 'dsq-otherbranch', hidden: true }, [
    SK.h('summary', { class: 'dsq-otherbranch__sum', text: '다른 갈래 보기' }),
    SK.h('p', { class: 'dsq-otherbranch__note', text: '전자를 하나씩 보내는 실험은 중급에서 배워요. 미리 볼 수 있어요.' })
  ]);
  ui.otherBtn = SK.h('button', { class: 'btn btn--secondary btn--sm dsq-otherbranch__btn', type: 'button' }, '전자 하나씩 보내기');
  ui.otherBtn.addEventListener('click', function (e) {
    if (e.detail > 0) ui.otherBtn.blur();
    if (SK.pop && SK.pop.close) SK.pop.close();
    var pc = SK.predicting && SK.predicting() && document.querySelector('.pop--band .predict__close');   // 빛 카드 ① 예측 띠가 떠 있으면 닫고
    if (pc) pc.click();
    if (entrance !== 'quantum') pickEntrance('quantum');
    SK.applyPreset(0, { noConfirm: true });
  });
  ui.otherBranch.appendChild(ui.otherBtn);
  if (SK.el.presets && SK.el.presets.parentNode) SK.el.presets.parentNode.appendChild(ui.otherBranch);
  if (SK.onLevel) SK.onLevel(function (lv) {
    var basic = lv === 'basic';
    prepLevelLabels(); levelTicks(basic);
    ui.otherBranch.hidden = !basic;
    if (!basic) ui.otherBranch.open = false;
    ui.eqKey = null; lastM = {};
    updatePanel(); refreshChecklist(); SK.refreshThinks();
    SK.requestRender(); SK.update();
  });

  installPointer();
  buildMeasDom();
  applyEntranceUI('physics');
  // R7(B2): 첫 창 없이 시작 — ?mode=physics|quantum(허브·주소) → 이번 세션에 고른 갈래 → 빛. 갈래는 [실험 ▾] 시트 맨 위 단추·설명 확인 장 단추로 바꾼다
  (function bootEntrance() {
    var v = null;
    try { v = new URLSearchParams(location.search).get('mode'); } catch (e) { v = null; }
    if (v !== 'physics' && v !== 'quantum') { try { v = sessionStorage.getItem(MODE_STORE); } catch (e) { v = null; } }
    if (v === 'quantum') pickEntrance('quantum', true);
  })();
})(typeof window !== 'undefined' ? window : globalThis);
