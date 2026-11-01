/* =====================================================================
   orbit-gravity — 인공위성과 탈출 속도 (공통 틀 SimKit 위에서 동작)
   근거: docs/04_팀장결정서.md §4-4 · 공통 틀 설명서 docs/SIMKIT.md
   성취기준: [12역학01-03] [12역학01-04] [12역학01-05] (심화 그림만 [12역학01-06])

   모드 3가지 (첫 화면 모드 카드, 조절 패널 '무엇을 알아볼까요?')
     cannon  뉴턴의 대포  — 수평 발사, a = −GM r̂ / r², RK4 · 시뮬레이션 dt 1 s · 화면 1초 = 2분(120 단계)
     sat     원궤도 위성  — 해석해 v = √(GM/r), T = 2πr/v, 중력 비율 (R/r)². 한 바퀴 = 화면 10초
     kepler  케플러 자료  — 행성 a(AU)·T(년) 표 → T–a 곡선 / T²–a³ 직선

   축척
     대포: 천체 중심 = 화면 (625, 350), 화면 반폭 625u = 천체 반지름 R 의 4배 (1 R = 156.25u)
     위성: 궤도 반지름이 290u 가 되도록 자동(기록이 있으면 기록 궤도까지 모두 담는 축척으로 고정)

   명세와 다르게 정한 점 (보고서에도 적음)
     · 대포는 '공기 없는 높은 산(20 km)' 꼭대기에서 쏜다. 지표(r = R)에서 7.9 km/s로 쏘면
       √(GM/R) = 7.909 km/s 보다 조금 느려 근지점이 지표 30 km 아래로 들어가 '추락'이 된다(검산).
       산 높이 20 km 에서는 원 궤도 속력이 7.897 km/s 라 7.9 km/s 가 거의 원(고도 20~29 km)이 된다.
     · 목성 반지름은 적도 반지름 71,492 km 를 쓴다. 명세의 69,911 km(평균)로는 탈출 속도가 60.2 km/s 라
       명세·교과서의 59.5 km/s 와 맞지 않는다.
     · 대포 시간 배속에 '1초 = 30초 / 10분 / 30분'(표시 도구)을 더했다. 기본은 명세대로 1초 = 2분.
     · (고도화) 대포 '보는 범위' 3가지(Z): 지구 전체(명세 반폭 4R)에서는 4·6 km/s 낙하가 7~15u 로 안 보이고
       10 km/s 타원(원지점 4.06R)이 화면 아래로 잘려서, 산 근처 확대(실제 축척)와 타원까지 전체를 더했다.
     · (고도화) r > 6R 에서 탈출/먼 타원을 바로 판정(에너지 부호). 10.4~11.1 km/s 가 48시간을 기다리던 문제 해결.
     · (R2) 실험 화면 왼쪽 아래 순서 상자 → 패널 수치 칸 아래 순서 칩. 예측 창이 떠 있으면 궤적·기록·속력 값 숨김.
       예측 판정은 질문의 전제(7.9 km/s·3 km/s 등)대로 실행했을 때만(judgeIf). 이름: '발사 속력 v₀', '고도'.
       기록 2개에서 공통 틀이 비교로 넘어가도 순서 칩이 남았으면 실행 단계에 머문다(SK.record 감쌈).
   ===================================================================== */
(function () {
  'use strict';
  var SK = window.SimKit;
  var h = SK.h;

  /* ------------------------------------------------------------------
     0. 상수·자료
     ------------------------------------------------------------------ */
  var G = 6.674e-11;
  var MOUNT = 20000;              // 대포 산 높이 (m)
  var DAY_H = 24;
  var BODY_ORDER = ['earth', 'moon', 'mars', 'jupiter'];
  var BODIES = {
    earth:   { key: 'earth',   name: '지구', M: 5.972e24, R: 6371e3 },
    moon:    { key: 'moon',    name: '달',   M: 7.342e22, R: 1737e3 },
    mars:    { key: 'mars',    name: '화성', M: 6.417e23, R: 3390e3 },
    jupiter: { key: 'jupiter', name: '목성', M: 1.898e27, R: 71492e3 }
  };
  BODY_ORDER.forEach(function (k) {
    var b = BODIES[k];
    b.GM = G * b.M;
    b.vEsc = Math.sqrt(2 * b.GM / b.R) / 1000;    // km/s
    b.vCirc = Math.sqrt(b.GM / b.R) / 1000;       // km/s
    b.g = b.GM / (b.R * b.R);                     // m/s²
  });
  var EARTH = BODIES.earth;
  // 케플러 자료 (AU · 년)
  var PLANETS = [
    { name: '수성', a: 0.387, T: 0.241 },
    { name: '금성', a: 0.723, T: 0.615 },
    { name: '지구', a: 1.000, T: 1.000 },
    { name: '화성', a: 1.524, T: 1.881 },
    { name: '목성', a: 5.203, T: 11.86 },
    { name: '토성', a: 9.537, T: 29.46 }
  ];
  var MODES = {
    cannon: { label: '뉴턴의 대포', today: '얼마나 빨리 쏘면 포탄이 떨어지지 않고 지구를 돌까?', preset: 0 },
    sat:    { label: '원궤도 위성', today: '높이 있는 위성은 더 빨리 돌까, 더 천천히 돌까?', preset: 2 },
    kepler: { label: '케플러 자료', today: '행성의 공전 주기와 거리 사이에는 어떤 규칙이 있을까?', preset: 3 }
  };
  /* 용어 목록: 이 모드 화면에 나오는 것만, 나오는 순서대로 */
  var MODE_TERMS = {
    cannon: ['발사 속력', '궤도', '원 궤도 속력', '탈출 속도', '고도', '시간 배속', 'R'],
    sat: ['고도', '궤도', '원 궤도 속력', '주기', '구심력', '정지궤도', '시간 배속'],
    kepler: ['주기', '궤도', 'AU', '긴반지름']
  };
  /* 단계별 '지금 할 일' (모드마다 다름, 25자 안팎. null = 공통 틀 문장) */
  var TASKS = {
    cannon: [
      '7.9 km/s로 쏘면 어떻게 될지 골라요',
      '쏘고 기록한 뒤 패널 칩에서 다음 속력으로',
      '몇 km/s부터 돌고, 몇부터 탈출할까요?',
      null
    ],
    sat: [
      '위성이 어떻게 돌지 먼저 골라요',
      '한 바퀴 돌리고 기록한 뒤 하나만 바꿔요',
      '고도가 높으면 속력·주기는 어떻게 될까요?',
      null
    ],
    kepler: [
      '먼 행성의 1년이 어떨지 골라요',
      '자료 넣기 버튼으로 표를 채워요',
      '$T^2$ – $a^3$ 그래프로 바꿔 봐요',
      null
    ]
  };

  var SK_DT = 1 / 120;             // SimKit 고정 간격(화면 초) — init 의 dt 와 같게
  var CX = 625, CY = 350;          // 실험 화면 중심
  var CS = 625 / 4;                // 대포: 1 R = 156.25u (화면 반폭 = 4R)
  var SAT_SCREEN_T = 10;           // 위성 한 바퀴 = 화면 10초
  var VIEW_NAME = { near: '산 근처 확대', earth: '지구 전체', far: '타원까지 전체' };
  var NEAR_K = 0.75;               // 산 근처: 1 km = 0.75u (화면 가로 ≈ 1,670 km)
  // R4: 글꼴 상수 없음 — 캔버스 글자는 모두 SK.text / SK.font (에스코어 드림 + 기호 $…$ 수식 표기)

  /* ------------------------------------------------------------------
     1. 작은 도구
     ------------------------------------------------------------------ */
  function col(n) { return SK.color(n); }
  function comma(n, d) {
    var s = SK.fmt(n, d || 0);
    var parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }
  function fmtDur(sec) {
    if (sec < 600) { var mi = Math.floor(sec / 60 + 1e-9), se = Math.floor(sec - mi * 60 + 1e-9); return (mi ? mi + '분 ' : '') + se + '초'; }
    var m = Math.floor(sec / 60 + 1e-9);
    if (m < 60) return m + '분';
    var hh = Math.floor(m / 60), mm = m % 60;
    if (hh >= 48) return SK.fmt(sec / 3600, 0) + '시간';
    return hh + '시간' + (mm ? ' ' + mm + '분' : '');
  }
  function periodText(Tsec) {
    return Tsec < 7200 ? SK.fmt(Tsec / 60, 1) + '분' : SK.fmt(Tsec / 3600, 1) + '시간';
  }
  function pctText(r) { return r < 0.1 ? SK.fmt(r * 100, 1) : SK.fmt(r * 100, 0); }
  function satCalc(altKm) {
    var r = EARTH.R + altKm * 1000;
    var v = Math.sqrt(EARTH.GM / r);
    var T = 2 * Math.PI * r / v;
    return { r: r, rR: r / EARTH.R, v: v / 1000, T: T, Th: T / 3600, g: Math.pow(EARTH.R / r, 2) };
  }
  function thin(pts, max) {
    if (!pts || pts.length <= max) return pts ? pts.slice() : [];
    var out = [], step = (pts.length - 1) / (max - 1);
    for (var i = 0; i < max - 1; i++) out.push(pts[Math.round(i * step)]);
    out.push(pts[pts.length - 1]);
    return out;
  }
  function niceStep(span, n) {
    var raw = span / Math.max(1, n), p = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), f = raw / p;
    return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
  }
  function niceMax(v) { if (!(v > 0)) return 1; var s = niceStep(v, 4); return Math.ceil(v * 1.05 / s) * s; }
  /** R4: 캔버스 글자 한 줄 = SK.text (기호는 $…$, 굵기 400 기본 · 강조 500) */
  function text(ctx, s, x, y, o) {
    o = o || {};
    return SK.text(ctx, s, x, y, { size: o.size || 22, weight: Math.min(500, o.weight || 400), align: o.align || 'left', baseline: o.base || 'middle',
      color: o.color || '--color-ink', halo: o.halo ? '--color-paper-raised' : null, haloWidth: 6, bg: o.bg || false, pad: o.pad });
  }
  /** R4: 실험 화면에서 보이는 세로 범위 (논리 좌표). 16:9 = [0, 700], 태블릿은 위아래로 extra/2 씩 넓어짐 */
  function vTop() { return -((SK.view && SK.view.offsetY) || 0); }
  function vBot() { var v = SK.view; return v ? v.hFull - (v.offsetY || 0) : 700; }
  function roundRect(ctx, x, y, w, hh, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + hh - r); ctx.quadraticCurveTo(x + w, y + hh, x + w - r, y + hh);
    ctx.lineTo(x + r, y + hh); ctx.quadraticCurveTo(x, y + hh, x, y + hh - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function panelBox(ctx, x, y, w, hh) {
    ctx.save();
    roundRect(ctx, x, y, w, hh, 10);
    ctx.fillStyle = col('--color-paper-scrim'); ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = col('--color-line'); ctx.stroke();
    ctx.restore();
  }
  /** 축·모눈. box = {x,y,w,h}, 반환 {mx,my} */
  function axes(ctx, box, xr, yr, o) {
    o = o || {};
    var fs = o.fs || 16;
    function mx(x) { return box.x + (x - xr[0]) / (xr[1] - xr[0]) * box.w; }
    function my(y) { return box.y + box.h - (y - yr[0]) / (yr[1] - yr[0]) * box.h; }
    var xs = niceStep(xr[1] - xr[0], o.nx || Math.max(2, Math.floor(box.w / 90)));
    var ys = niceStep(yr[1] - yr[0], o.ny || Math.max(2, Math.floor(box.h / 40)));
    var dx = Math.max(0, -Math.floor(Math.log(xs) / Math.LN10 + 1e-9)), dy = Math.max(0, -Math.floor(Math.log(ys) / Math.LN10 + 1e-9));
    ctx.save();
    ctx.lineWidth = 1; ctx.setLineDash([]);
    ctx.strokeStyle = col('--color-grid');
    var tick = { size: fs, weight: 400, color: '--color-ink-muted' };   // R4: 눈금 400
    if (!o.noX) for (var x = Math.ceil(xr[0] / xs - 1e-9) * xs; x <= xr[1] + xs * 1e-6; x += xs) {
      ctx.beginPath(); ctx.moveTo(mx(x), box.y); ctx.lineTo(mx(x), box.y + box.h); ctx.stroke();
      SK.text(ctx, comma(x, dx), mx(x), box.y + box.h + 4, { size: fs, weight: 400, color: '--color-ink-muted', align: 'center', baseline: 'top' });
    }
    for (var y = Math.ceil(yr[0] / ys - 1e-9) * ys; y <= yr[1] + ys * 1e-6; y += ys) {
      ctx.beginPath(); ctx.moveTo(box.x, my(y)); ctx.lineTo(box.x + box.w, my(y)); ctx.stroke();
      if (!(o.noY0 && Math.abs(y - yr[0]) < ys * 1e-6)) SK.text(ctx, comma(y, dy), box.x - 6, my(y), { size: tick.size, weight: tick.weight, color: tick.color, align: 'right' });   // R5: 원점 '0' 은 x축 '0.0' 과 겹쳐 숨김
    }
    ctx.strokeStyle = col('--color-line-strong'); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(box.x, box.y); ctx.lineTo(box.x, box.y + box.h); ctx.lineTo(box.x + box.w, box.y + box.h); ctx.stroke();
    if (o.xl) SK.text(ctx, o.xl, box.x + box.w, box.y + box.h - 4, { size: fs, weight: 500, color: '--color-ink', align: 'right', baseline: 'bottom' });
    if (o.yl) SK.text(ctx, o.yl, box.x + 6, box.y + 2, { size: fs, weight: 500, color: '--color-ink', align: 'left', baseline: 'top' });
    ctx.restore();
    return { mx: mx, my: my };
  }
  function dot(ctx, x, y, r, fill, stroke, w) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = col(fill); ctx.fill(); }
    if (stroke) { ctx.lineWidth = w || 2; ctx.strokeStyle = col(stroke); ctx.setLineDash([]); ctx.stroke(); }
  }

  /** 천체 그림 (중심 x,y, 반지름 rad) */
  function drawBody(ctx, key, x, y, rad) {
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2);
    var fills = { earth: '--color-primary-tint', moon: '--color-paper-sunk', mars: '--color-sim-collision-tint', jupiter: '--color-sim-lens-tint' };
    var lines = { earth: '--color-primary', moon: '--color-line-strong', mars: '--color-sim-collision', jupiter: '--color-sim-lens' };
    ctx.fillStyle = col(fills[key]); ctx.fill();
    ctx.clip();
    if (key === 'earth') {
      ctx.fillStyle = col('--color-ok-tint');
      [[-0.35, -0.3, 0.38, 0.22], [0.3, 0.15, 0.3, 0.38], [-0.15, 0.45, 0.25, 0.14], [0.45, -0.5, 0.2, 0.12]].forEach(function (c) {
        ctx.beginPath(); ctx.ellipse(x + c[0] * rad, y + c[1] * rad, c[2] * rad, c[3] * rad, 0.4, 0, Math.PI * 2); ctx.fill();
      });
    } else if (key === 'moon') {
      ctx.strokeStyle = col('--color-line-strong'); ctx.lineWidth = Math.max(1, rad * 0.02);
      [[-0.3, -0.25, 0.16], [0.35, 0.1, 0.22], [-0.1, 0.45, 0.12], [0.2, -0.5, 0.1]].forEach(function (c) {
        ctx.beginPath(); ctx.arc(x + c[0] * rad, y + c[1] * rad, c[2] * rad, 0, Math.PI * 2); ctx.stroke();
      });
    } else if (key === 'mars') {
      ctx.fillStyle = col('--color-copper-tint');
      ctx.beginPath(); ctx.ellipse(x - 0.2 * rad, y + 0.2 * rad, 0.5 * rad, 0.18 * rad, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = col('--color-paper-raised');
      ctx.beginPath(); ctx.ellipse(x, y - 0.92 * rad, 0.3 * rad, 0.12 * rad, 0, 0, Math.PI * 2); ctx.fill();
    } else if (key === 'jupiter') {
      ctx.fillStyle = col('--color-copper-tint');
      [-0.55, -0.2, 0.15, 0.5].forEach(function (b, i) { ctx.fillRect(x - rad, y + b * rad, rad * 2, rad * (i % 2 ? 0.14 : 0.2)); });
      ctx.fillStyle = col('--color-q-energy-heat'); ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.ellipse(x + 0.3 * rad, y + 0.3 * rad, 0.16 * rad, 0.09 * rad, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.lineWidth = 3; ctx.strokeStyle = col(lines[key]); ctx.setLineDash([]); ctx.stroke();
  }
  /** 직각 표시 (속도와 중력이 직각일 때만 작은 ㄱ자. 글자는 붙이지 않는다 — 라벨은 3개 이하) */
  function angleMark(ctx, px, py, a, b) {
    var cos = a[0] * b[0] + a[1] * b[1];
    var deg = Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI;
    if (Math.abs(deg - 90) >= 1.5) return;
    var s = 18;
    ctx.save();
    ctx.strokeStyle = col('--color-ink'); ctx.lineWidth = 2.5; ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(px + a[0] * s, py + a[1] * s);
    ctx.lineTo(px + a[0] * s + b[0] * s, py + a[1] * s + b[1] * s);
    ctx.lineTo(px + b[0] * s, py + b[1] * s);
    ctx.stroke();
    ctx.restore();
  }
  /** 대포 그림 (포구 = (x, y), 오른쪽을 향함). k = 크기 배율 */
  function drawCannon(ctx, x, y, k) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(k, k);
    ctx.fillStyle = col('--color-ink'); ctx.strokeStyle = col('--color-ink'); ctx.lineJoin = 'round';
    roundRect(ctx, -46, -8, 48, 16, 6); ctx.fill();                 // 포신
    ctx.beginPath(); ctx.arc(-46, 0, 9, 0, Math.PI * 2); ctx.fill();  // 뒤 뭉치
    ctx.fillStyle = col('--color-paper-sunk'); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(-30, 10, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();   // 바퀴
    ctx.beginPath(); ctx.arc(-30, 10, 2.5, 0, Math.PI * 2); ctx.fillStyle = col('--color-ink'); ctx.fill();
    ctx.restore();
  }

  /* ------------------------------------------------------------------
     2. 상태
     ------------------------------------------------------------------ */
  var curMode = null;
  var stash = {};                 // 모드별 기록·직전 실행 보관
  var cn = null;                  // 대포 상태
  var sat = null;                 // 위성 상태
  var seq = null;                 // 프리셋 순서 도우미 {key, vals, label(v)}
  var kRows = PLANETS.map(function (p) { return { name: p.name, a: null, T: null }; });
  var meterSets = {}, recOpts = {}, recTable = null, bandView = null, bandTitle = null;
  var deepView = null, deepKey = '';
  var kEl = null, seqEl = null, altNote = null, compareBtn = null;
  var hudEl = null, viewEl = null, kStepEl = null, kDone = false;
  var modeCtl = null, lastSwitchAt = 0, DEFAULT_SEQ = null, preSimpleMode = null;   // R6: 심플 들어가기 전 모드
  function hideResults() { return SK.predicting && SK.predicting(); }   // 예측 창이 떠 있는 동안 결과 층(궤적·기록) 숨김

  /* ------------------------------------------------------------------
     3. 대포: RK4 (dt = 1 s)
     ------------------------------------------------------------------ */
  function cannonReset(p) {
    var b = BODIES[p.body] || EARTH;
    var r0 = b.R + MOUNT;
    cn = {
      b: b, x: 0, y: r0, vx: p.v0 * 1000, vy: 0, t: 0, acc: 0, pa: Math.PI / 2,
      r0: r0, maxR: r0, minR: r0,
      path: [[0, r0 / b.R]], hs: [[0, MOUNT / 1000]], lastH: 0,
      res: null, dist: 0, lx: null, ly: null, vImp: null
    };
  }
  function accel(GM, x, y) { var r2 = x * x + y * y, r = Math.sqrt(r2), k = -GM / (r2 * r); return [k * x, k * y]; }
  function rk4(c, dt) {
    var GM = c.b.GM, x = c.x, y = c.y, vx = c.vx, vy = c.vy;
    var a1 = accel(GM, x, y);
    var x2 = x + vx * dt / 2, y2 = y + vy * dt / 2, vx2 = vx + a1[0] * dt / 2, vy2 = vy + a1[1] * dt / 2;
    var a2 = accel(GM, x2, y2);
    var x3 = x + vx2 * dt / 2, y3 = y + vy2 * dt / 2, vx3 = vx + a2[0] * dt / 2, vy3 = vy + a2[1] * dt / 2;
    var a3 = accel(GM, x3, y3);
    var x4 = x + vx3 * dt, y4 = y + vy3 * dt, vx4 = vx + a3[0] * dt, vy4 = vy + a3[1] * dt;
    var a4 = accel(GM, x4, y4);
    c.x = x + dt / 6 * (vx + 2 * vx2 + 2 * vx3 + vx4);
    c.y = y + dt / 6 * (vy + 2 * vy2 + 2 * vy3 + vy4);
    c.vx = vx + dt / 6 * (a1[0] + 2 * a2[0] + 2 * a3[0] + a4[0]);
    c.vy = vy + dt / 6 * (a1[1] + 2 * a2[1] + 2 * a3[1] + a4[1]);
  }
  function cannonStep(p) {
    var c = cn; if (!c || c.res) return;
    // 화면 1/120 초마다 실제 시간 tscale(분)×60/120 초를 흐르게 한다. RK4 한 단계는 1 s 이하.
    var R = c.b.R, simPer = (p.tscale || 2) * 60 * SK_DT;
    var n = Math.max(1, Math.ceil(simPer - 1e-9)), hdt = simPer / n;
    for (var i = 0; i < n; i++) {
      rk4(c, hdt); c.t += hdt;
      var r = Math.sqrt(c.x * c.x + c.y * c.y);
      if (r > c.maxR) c.maxR = r;
      if (r < c.minR) c.minR = r;
      var an = Math.atan2(c.y, c.x), d = an - c.pa;
      if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
      c.acc += d; c.pa = an;
      // 궤적 기록 (R 단위, 0.003 R ≈ 19 km 마다 — '산 근처 확대'에서도 매끈하게) · 높이-시간 (5 s 마다)
      var lp = c.path[c.path.length - 1], px = c.x / R, py = c.y / R;
      if ((px - lp[0]) * (px - lp[0]) + (py - lp[1]) * (py - lp[1]) > 0.003 * 0.003) c.path.push([px, py]);
      if (c.t - c.lastH >= 5 - 1e-9) { c.hs.push([c.t / 60, (r - R) / 1000]); c.lastH = c.t; }
      var v2 = c.vx * c.vx + c.vy * c.vy;
      if (r < R - 1000) {
        c.res = '추락'; c.dist = R * Math.abs(c.acc) / 1000; c.vImp = Math.sqrt(v2) / 1000;
        var k = R / r; c.lx = c.x * k / R; c.ly = c.y * k / R;
        c.path.push([c.lx, c.ly]); c.hs.push([c.t / 60, 0]);
        SK.finish('땅에 떨어졌어요 — 기록하기 버튼으로 저장해요');
        return;
      }
      if (Math.abs(c.acc) >= 2 * Math.PI) {
        c.res = (c.maxR - c.minR) / c.r0 < 0.02 ? '원 궤도' : '타원 궤도';
        c.dist = 2 * Math.PI * R / 1000;
        c.path.push([c.x / R, c.y / R]); c.hs.push([c.t / 60, (r - R) / 1000]);
        // 타원은 모양만 (결정서: 타원 정량 금지) → 걸린 시간은 원 궤도에서만 알려 준다
        SK.finish(c.res === '원 궤도' ? '한 바퀴 돌았어요 — 기록하기 버튼으로 저장해요' : '타원 궤도예요 — 기록하기 버튼으로 저장해요');
        return;
      }
      // 6R 밖에서 판정: 역학적 에너지가 0 이상이면 탈출, 아니면 언젠가 돌아오는 먼 타원
      if (r > 6 * R) {
        c.res = v2 >= 2 * c.b.GM / r ? '탈출' : '먼 타원';
        c.path.push([c.x / R, c.y / R]); c.hs.push([c.t / 60, (r - R) / 1000]);
        SK.finish(c.res === '탈출' ? '탈출했어요 — 기록하기 버튼으로 저장해요' : '아주 긴 타원이에요 — 기록하기 버튼으로 저장해요');
        return;
      }
      if (c.t >= 72 * 3600) { c.res = '먼 타원'; SK.finish('아주 긴 타원이에요 — 기록하기 버튼으로 저장해요'); return; }
    }
  }

  /* ------------------------------------------------------------------
     4. 모드 바꾸기 (기록·직전 실행은 모드별로 따로 보관)
     ------------------------------------------------------------------ */
  var MODE_KEYS = {
    body: ['cannon'], v0: ['cannon'], tscale: ['cannon'], cview: ['cannon'],
    alt: ['sat'], mass: ['sat'],
    arrows: ['cannon', 'sat'], trail: ['cannon', 'sat'],
    gaxis: ['sat', 'kepler'], kzoom: ['kepler'], kguide: ['kepler']
  };
  var COLS = {
    cannon: [
      { key: 'body', from: 'param', label: '천체', priority: 1 },
      { key: 'v0', from: 'param', label: '발사 속력 v₀', unit: 'km/s', priority: 1 },
      { key: 'res', from: 'value', label: '결과', priority: 1 },
      { key: 'hmax', from: 'value', label: '최고 고도', unit: 'km', decimals: 0, priority: 2 },
      { key: 'dist', from: 'value', label: '날아간 거리', unit: 'km', decimals: 0, priority: 2 },
      { key: 'vImp', from: 'value', label: '떨어질 때 속력', unit: 'km/s', decimals: 2, priority: 3 }
    ],
    sat: [
      { key: 'alt', from: 'param', label: '고도', unit: 'km', priority: 1 },
      { key: 'v', from: 'value', label: '속력', unit: 'km/s', decimals: 2, priority: 1 },
      { key: 'Tstr', from: 'value', label: '주기', unit: '', priority: 1 },
      { key: 'mass', from: 'param', label: '질량', unit: 'kg', priority: 2 },
      { key: 'rR', from: 'value', label: '중심까지 거리 r', unit: 'R', decimals: 2, priority: 2 },
      { key: 'g', from: 'value', label: '중력(지표 대비)', unit: '%', decimals: 0, priority: 3 }
    ],
    kepler: [{ key: 'mode', from: 'param', label: '모드' }]
  };
  /** 단계별 '지금 할 일'. 공통 틀의 상황 문장(실행 중·기록 안내·기록 부족)이 더 알맞을 때는 null 을 돌려 그쪽을 쓴다 */
  function tasksFor(m) {
    return [0, 1, 2, 3].map(function (i) {
      var t = { text: function () {
        if (m !== 'kepler' && i === 1 && (SK.running || SK.finished)) return null;
        if (m !== 'kepler' && i === 2 && SK.records.length < 2) return null;
        return TASKS[m][i];
      } };
      if (m === 'kepler' && i === 1) t.action = { label: '자료 카드 보기', onClick: function () { showDataCard(); } };
      if (m === 'kepler' && i === 2) t.action = { label: '$T^2$ – $a^3$ 그래프로', onClick: function () { SK.set('gaxis', 'sq'); } };
      return t;
    });
  }
  function switchMode(oldM, newM) {
    if (oldM) stash[oldM] = { records: SK.records, ghost: SK.ghost };
    var s = stash[newM] || { records: [], ghost: null };
    SK.records = s.records; SK.ghost = s.ghost;
    curMode = newM;
    if (oldM && oldM !== newM) lastSwitchAt = Date.now();
    // R6(C1): 심플은 대포 모드 전용. 숫자 키(카드 ②~④) 등으로 위성·케플러가 되면 자세히 모드로 넘겨 준다
    if (newM !== 'cannon' && SK.isSimple && SK.isSimple()) setTimeout(function () {
      if (!SK.isSimple() || curMode === 'cannon') return;
      preSimpleMode = null;
      SK.setSimple(false, { save: true });
      SK.notice(MODES[curMode].label + '은(는) 자세히 모드에서 봐요', 'info');
    }, 0);
    if (modeCtl && modeCtl.sync) modeCtl.sync(newM);
    if (seq && seq.mode !== newM) seq = null;
    if (!seq && DEFAULT_SEQ) seq = DEFAULT_SEQ[newM] || null;
    SK.panel('values').parentNode.classList.toggle('og-hide', newM === 'kepler');
    SK.panel('situation').parentNode.classList.toggle('og-hide', newM !== 'cannon');   // 위성·케플러는 고를 상황이 없음(실험 고르기는 패널 맨 위)
    for (var k in MODE_KEYS) {
      var c = SK.controls[k];
      if (c && c.el) c.el.classList.toggle('og-hide', MODE_KEYS[k].indexOf(newM) < 0);
    }
    if (altNote) altNote.classList.toggle('og-hide', newM !== 'sat');
    if (compareBtn) compareBtn.classList.toggle('og-hide', newM !== 'cannon');
    for (var m in meterSets) meterSets[m].el.hidden = m !== newM;
    if (kEl) kEl.hidden = newM !== 'kepler';
    if (hudEl) hudEl.hidden = newM === 'kepler';
    if (viewEl) viewEl.hidden = newM !== 'cannon';
    // 하단 띠: 케플러는 기록 칩 대신 그래프를 넓게
    SK.el.records.hidden = newM === 'kepler';
    SK.el.band.style.gridTemplateColumns = newM === 'kepler' ? 'minmax(0, 4fr) minmax(0, 9fr)' : 'minmax(0, 1fr) minmax(0, 1fr)';
    recOpts.columns = COLS[newM];
    if (recTable) recTable.render();
    // 그래프 축 버튼 글자
    var g = SK.controls.gaxis;
    if (g) {
      var opts = g.el.querySelectorAll('.seg__opt');
      var sym = newM === 'sat' ? 'r' : 'a';
      if (opts[0]) SK.setText(opts[0], '$T$ – $' + sym + '$ (휘어진 선)');
      if (opts[1]) SK.setText(opts[1], '$T^2$ – $' + sym + '^3$ (곧은 선?)');
    }
    // 오늘 알아볼 것 · 지금 할 일
    var today = SK.el.top.querySelector('.sim-today');
    if (today) { today.innerHTML = ''; today.appendChild(h('b', { text: '오늘 알아볼 것' })); today.appendChild(document.createTextNode(MODES[newM].today)); }
    tasksFor(newM).forEach(function (t, i) { SK.setTask(i, t); });
    // 정리 질문: think({when}) 이 이 모드 것만 보이게 한다
    if (SK.refreshThinks) SK.refreshThinks();
    updateSeq(true);
    SK.requestRender();
  }

  /* ------------------------------------------------------------------
     5. SimKit 시작
     ------------------------------------------------------------------ */
  var CFG = {
    slug: 'orbit-gravity',
    title: '인공위성과 탈출 속도',
    subject: '역학과 에너지 (진로 선택)',
    unit: '(1) 시공간과 운동',
    standards: ['12역학01-03', '12역학01-04', '12역학01-05'],
    today: MODES.cannon.today,
    stepTasks: tasksFor('cannon'),
    // R6(C1) 심플 모드: 대포 모드 고정 · 발사 속력 하나 + 천체 칩 · 결과/지금 속력 + 속력 띠(넓은 칸) · 카드 ①·⑤
    simple: {
      task: '발사 속력을 바꿔 쏴요 — 몇 km/s부터 떨어지지 않고 돌까요?',
      params: ['v0'],
      situation: ['body'],
      meters: ['sres', 'sv', { key: 'vband', label: '발사 속력 v₀', unit: '' }],
      presets: [0, 4],
      predict: 'button'
    },
    dt: SK_DT,                      // 화면 1/120 초마다 한 단계 (대포 기본: 1 단계 = 1 s → 화면 1초 = 2분)
    stageFit: true,
    onResize: function (view) { view.offsetY = view.extra / 2; },   // R4: 태블릿 세로 여유는 위아래 반씩 — 중심 천체가 가운데, 궤도가 위아래로 더 보임
    autoPredict: true,
    onPredictOpen: function () { SK.requestRender(); },    // 예측 창이 떠 있는 동안 궤적·기록을 숨긴다(render 에서 hideResults())
    onPredictClose: function () { SK.requestRender(); },

    reset: function (p) {
      if (curMode !== p.mode) switchMode(curMode, p.mode);
      cannonReset(p);
      sat = satCalc(p.alt);
      sat.done = false;
      updateSeq();
    },
    step: function (dt, p) {
      if (curMode === 'cannon') {
        if (p.body === 'jupiter') { SK.pause(); return; }
        cannonStep(p);
      } else if (curMode === 'sat') {
        if (!sat.done && SK.time + dt >= SAT_SCREEN_T - 1e-9) {
          sat.done = true;
          SK.finish('한 바퀴 ' + periodText(sat.T) + ' — 기록하기 버튼으로 저장해요');
        }
      } else {
        SK.pause();
      }
    },
    render: function (view, p) {
      if (curMode === 'cannon') renderCannon(view.ctx, p);
      else if (curMode === 'sat') renderSat(view.ctx, p);
      else if (curMode === 'kepler') renderKepler(view.ctx, p);
      updateMeters(p);
      drawBand();
      drawDeep(p);
      updateHud(p);
      updateSeq();
      if (curMode === 'cannon') lastShownBody = p.body;
    },
    capture: function (p) {
      if (curMode === 'cannon') {
        if (!cn || cn.path.length < 2 || cn.b.key === 'jupiter') return null;
        var last = cn.path[cn.path.length - 1];
        // 타원·탈출은 모양만 (결정서 §4-4: 타원 정량 금지) → 최고 높이는 추락·원 궤도에서만 적는다
        var showH = cn.res === '추락' || cn.res === '원 궤도';
        return {
          series: { path: thin(cn.path, 400), h: thin(cn.hs, 300) },
          values: {
            bk: cn.b.key,
            res: cn.res || '비행 중', hmax: showH ? (cn.maxR - cn.b.R) / 1000 : undefined,
            dist: showH ? cn.dist : undefined, vImp: cn.res === '추락' ? cn.vImp : undefined,
            lx: cn.res === '추락' ? cn.lx : null, ly: cn.res === '추락' ? cn.ly : null,
            ex: last[0], ey: last[1]
          }
        };
      }
      if (curMode === 'sat') {
        var s = satCalc(p.alt);
        return { series: {}, values: { rR: s.rR, v: s.v, Tstr: periodText(s.T), Th: s.Th, g: s.g * 100, mass: p.mass } };
      }
      return null;
    },
    save: function () {
      if (curMode !== 'cannon' || !cn) return {};
      return { x: cn.x, y: cn.y, vx: cn.vx, vy: cn.vy, t: cn.t, acc: cn.acc, pa: cn.pa, maxR: cn.maxR, minR: cn.minR,
        np: cn.path.length, nh: cn.hs.length, lastH: cn.lastH, res: cn.res, dist: cn.dist, lx: cn.lx, ly: cn.ly, vImp: cn.vImp };
    },
    load: function (s) {
      if (curMode === 'sat' && sat) { sat.done = false; return; }
      if (curMode !== 'cannon' || !cn || s.x === undefined) return;
      cn.x = s.x; cn.y = s.y; cn.vx = s.vx; cn.vy = s.vy; cn.t = s.t; cn.acc = s.acc; cn.pa = s.pa;
      cn.maxR = s.maxR; cn.minR = s.minR; cn.path.length = s.np; cn.hs.length = s.nh; cn.lastH = s.lastH || 0;
      cn.res = s.res; cn.dist = s.dist; cn.lx = s.lx; cn.ly = s.ly; cn.vImp = s.vImp;
    },
    status: function (p) {
      var m = p.mode || 'cannon';
      if (m === 'cannon') {
        var b = BODIES[p.body] || EARTH;
        if (p.body === 'jupiter') return ['목성', '속도 범위 밖'];
        return [b.name, '산꼭대기', '수평 발사', '공기 없음'];
      }
      if (m === 'sat') return ['지구', '원 궤도', '고도 ' + comma(p.alt) + ' km'];
      return ['태양계 행성 6개', '단위 AU · 년'];
    },
    onStep: function () { SK.requestRender(); }
  };
  SK.init(CFG);

  /** 화면 1초에 흐르는 실제 시간(초) → 글자. 재생 속도([ ])가 1배가 아니면 함께 적는다 */
  function rateText(sec) {
    var s = sec < 60 ? SK.fmt(sec, 0) + '초' : sec < 3600 ? SK.fmt(sec / 60, sec < 600 ? 1 : 0).replace(/\.0$/, '') + '분' : SK.fmt(sec / 3600, 1) + '시간';
    return s + (SK.speed !== 1 ? ' (재생 ' + SK.speed + '배)' : '');
  }
  function speedText(Tsec) {
    return rateText(Tsec / SAT_SCREEN_T * SK.speed);
  }
  /* 대포 '보는 범위' — 같은 기록을 세 가지 축척으로 본다 */
  function viewOf(p, b) {
    var v = b.key === 'jupiter' ? 'earth' : (p.cview || 'earth');
    if (v === 'near') return { key: v, s: NEAR_K * b.R / 1000, cx: 170, cy: 250 + (b.R + MOUNT) / 1000 * NEAR_K };
    if (v === 'far') return { key: v, s: 110, cx: 600, cy: 215 };   // 10 km/s 타원(원지점 4.06 R)까지 화면 안
    return { key: 'earth', s: CS, cx: 700, cy: 340 };
  }

  /* ------------------------------------------------------------------
     6. 조절 패널 — 수치 바꾸기 (맨 위: 대포 v₀ / 위성 고도·질량)
     ------------------------------------------------------------------ */
  /** 속력·천체에 맞춰 '보는 범위'와 시간 배속을 저절로 맞춘다 (표시만 바뀌고 기록·변인에는 영향 없음) */
  function autoView() {
    var b = BODIES[SK.get('body')] || EARTH, ratio = SK.get('v0') / b.vCirc;
    var v = ratio < 0.9 ? 'near' : ratio < 1.2 ? 'earth' : 'far';
    var ts = v === 'near' ? (b.key === 'earth' ? 0.5 : 2) : v === 'earth' ? 10 : 30;
    if (SK.get('cview') !== v) SK.set('cview', v);
    if (SK.get('tscale') !== ts) SK.set('tscale', ts);
  }
  SK.addVar('values', {
    key: 'v0', label: '{{발사 속력}}', symbol: 'v_0', unit: 'km/s',
    min: 0, max: 12, step: 0.1, value: 6.0, decimals: 1, precision: 2,
    ticks: [{ v: 7.9, label: '지구 돌기' }, { v: 11.2, label: '탈출' }], apply: 'restart',
    hint: '지구에서 7.9 km/s면 지구를 돌고, 11.2 km/s 이상이면 돌아오지 않아요',
    onChange: function () { if (!seq) autoView(); updateSeq(); }
  });
  SK.controls.v0.el.classList.add('og-var-v0');
  SK.addVar('values', {
    key: 'alt', label: '위성 {{고도}}', symbol: 'h', unit: 'km',
    min: 200, max: 36000, step: 100, value: 400, decimals: 0, precision: 0,
    ticks: [{ v: 400, label: 'ISS' }, { v: 20200, label: 'GPS' }, { v: 35786, label: '정지궤도' }], apply: 'restart',
    onChange: function () { updateAltNote(); updateSeq(); }
  });
  SK.controls.alt.el.classList.add('og-var-alt');   // R5: 눈금 이름(ISS·GPS·정지궤도) 4u 아래로
  altNote = h('p', { class: 'og-note' });
  SK.controls.alt.el.appendChild(altNote);
  function updateAltNote() {
    var a = SK.get('alt'), rk = EARTH.R / 1000 + a;
    altNote.textContent = 'r = 지구 반지름 6,371 km + 고도 = ' + comma(rk) + ' km (지구 반지름의 ' + SK.fmt(rk / (EARTH.R / 1000), 2) + '배)';
  }
  updateAltNote();
  SK.addVar('values', {
    key: 'mass', label: '위성 질량', symbol: 'm', unit: 'kg',
    min: 100, max: 10000, step: 100, value: 1000, decimals: 0, precision: 0,
    ticks: [100, 10000], apply: 'restart',
    hint: '고도는 그대로 두고 질량만 바꿔 봐요',
    onChange: function () { updateSeq(); }
  });

  /* ------------------------------------------------------------------
     7. 상황 바꾸기 — 모드(첫 화면 창과 같은 선택: 공통 틀이 한 줄로 접음) · 중심 천체
     ------------------------------------------------------------------ */
  SK.addChoice('situation', {
    key: 'mode', label: '무엇을 알아볼까요?', style: 'cards', apply: 'live', value: 'cannon', record: false,
    options: [
      { value: 'cannon', label: '뉴턴의 대포' },
      { value: 'sat', label: '원궤도 위성' },
      { value: 'kepler', label: '케플러 자료' }
    ],
    onChange: function () { seq = null; SK.reset(); updateSeq(true); }
  });
  SK.controls.mode.el.classList.add('og-modes');

  var bodyCtl = SK.addChoice('situation', {
    key: 'body', label: '중심 천체', style: 'cards', apply: 'restart', value: 'earth',
    options: BODY_ORDER.map(function (k) {
      var b = BODIES[k];
      return { value: k, label: b.name, sub: '탈출 ' + SK.fmt(b.vEsc, 1) + ' km/s' };
    }),
    hint: '목성은 탈출 속도가 커서 이 대포(최대 12 km/s)로는 범위 밖이에요',
    onChange: function (v) {
      if (v === 'jupiter') { SK.notice('목성은 발사 속력 범위 밖이에요', 'warn'); showCompare(); }
      else if (!seq || seq.key !== 'body') autoView();
      updateSeq(true);
    }
  });
  bodyCtl.el.classList.add('og-bodies');
  (function () {   // 목성 카드: 왜 '범위 밖'인지 말풍선
    var bs = bodyCtl.el.querySelectorAll('.seg__opt');
    if (bs[3]) bs[3].title = '탈출 속도(59.5 km/s)가 너무 커요 — 이 대포는 12 km/s까지';
  })();
  (function addBodyIcons() {
    var fills = { earth: ['--color-primary-tint', '--color-primary'], moon: ['--color-paper-sunk', '--color-line-strong'], mars: ['--color-sim-collision-tint', '--color-sim-collision'], jupiter: ['--color-sim-lens-tint', '--color-sim-lens'] };
    var btns = bodyCtl.el.querySelectorAll('.seg__opt');
    BODY_ORDER.forEach(function (k, i) {
      var ns = 'http://www.w3.org/2000/svg';
      var svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('viewBox', '0 0 40 40'); svg.setAttribute('class', 'og-ico'); svg.setAttribute('aria-hidden', 'true');
      var c = document.createElementNS(ns, 'circle');
      c.setAttribute('cx', '20'); c.setAttribute('cy', '20'); c.setAttribute('r', '15');   // 아이콘 크기 통일
      c.setAttribute('style', 'fill:var(' + fills[k][0] + ');stroke:var(' + fills[k][1] + ');stroke-width:3');
      svg.appendChild(c);
      if (btns[i]) btns[i].insertBefore(svg, btns[i].firstChild);
    });
  })();
  compareBtn = h('button', { class: 'og-link', type: 'button', onclick: function (e) { if (e.detail) e.currentTarget.blur(); showCompare(); } }, '천체 비교 표 — 왜 탈출 속도가 다를까? ▸');
  SK.iconify(compareBtn);   // R4: ▸ → 아이콘
  bodyCtl.el.appendChild(compareBtn);

  /* ------------------------------------------------------------------
     8. 화면에 표시하기
     ------------------------------------------------------------------ */
  SK.addToggle('tools', { key: 'arrows', label: '속도·중력 화살표', value: true, apply: 'live', record: false });
  SK.addToggle('tools', { key: 'trail', label: '지나간 길(궤적) 남기기', value: true, apply: 'live', record: false });
  SK.addChoice('tools', {
    key: 'gaxis', label: '그래프 축', apply: 'live', value: 'lin', record: false,
    options: [{ value: 'lin', label: '$T$ – $a$' }, { value: 'sq', label: '$T^2$ – $a^3$' }],
    onChange: function () { kCheck(); }
  });
  SK.addChoice('tools', {
    key: 'kzoom', label: '그래프 보는 범위', apply: 'live', value: 'all', record: false,
    options: [{ value: 'all', label: '행성 6개 전체' }, { value: 'inner', label: '안쪽 4개 확대' }]
  });
  SK.addToggle('tools', { key: 'kguide', label: '기울기 1 보조선 ($T^2$ = $a^3$)', value: true, apply: 'live', record: false });
  SK.addChoice('tools', {
    key: 'cview', label: '보는 범위', apply: 'live', value: 'near', record: false,
    options: [{ value: 'near', label: '산 근처' }, { value: 'earth', label: '지구 전체' }, { value: 'far', label: '타원까지' }]
  });
  SK.controls.cview.el.classList.add('og-always-hide');   // 실험 화면 오른쪽 아래 버튼으로 바꿈
  SK.addChoice('tools', {
    key: 'tscale', label: '{{시간 배속}} — 화면 1초 동안 흐르는 실제 시간', apply: 'live', value: 0.5, record: false,
    options: [{ value: 0.5, label: '30초' }, { value: 2, label: '2분' }, { value: 10, label: '10분' }, { value: 30, label: '30분' }]
  });

  /* 실험 화면 오른쪽 위: 시간 배속·경과·보는 범위 (진한 글자, 창이 뜨면 공통 틀이 숨김) */
  hudEl = h('div', { class: 'og-hud' });
  SK.el.cornerTR.appendChild(hudEl);
  var hudKey = '';
  function updateHud(p) {
    var lines;
    if (curMode === 'cannon' && cn) {
      var V = viewOf(p, cn.b);
      lines = [
        ['b', '{{시간 배속}} 화면 1초 = 실제 ' + rateText((p.tscale || 2) * 60 * SK.speed)],
        ['s', '흐른 시간 ' + fmtDur(cn.t) + (V.key === 'near' ? ' · 화면 가로 약 ' + comma(Math.round(1250 / NEAR_K / 10) * 10) + ' km' : ' · 1 R = ' + cn.b.name + ' 반지름')]
      ];
    } else if (curMode === 'sat' && sat) {
      var s = satCalc(p.alt), f = Math.min(SK.time / SAT_SCREEN_T, 1);
      lines = [
        ['b', '{{시간 배속}} 화면 1초 ≈ 실제 ' + speedText(s.T)],
        ['s', '흐른 시간 ' + fmtDur(f * s.T) + ' / 한 바퀴 ' + (hideResults() ? '?' : periodText(s.T))]
      ];
    } else lines = [];
    var key = JSON.stringify(lines);
    if (key === hudKey) return;
    hudKey = key; hudEl.innerHTML = '';
    lines.forEach(function (l) { hudEl.appendChild(h('p', { class: l[0] === 'b' ? 'og-hud__main' : 'og-hud__sub' }, richTerm(l[1]))); });
  }
  /** '{{용어}}' → 용어 말풍선 */
  function richTerm(t) {
    var out = [], re = /\{\{([^}]+)\}\}/g, last = 0, m;
    while ((m = re.exec(t))) { if (m.index > last) out.push(t.slice(last, m.index)); out.push(SK.term(m[1])); last = re.lastIndex; }
    if (last < t.length) out.push(t.slice(last));
    return out;
  }

  /* 실험 화면 오른쪽 아래: 보는 범위 버튼 (대포) + 화면 밖으로 나가면 '더 넓게 보기' */
  var viewBtns = {}, viewHint = null;
  (function makeViewBtns() {
    var row = h('div', { class: 'og-view__row', role: 'group', 'aria-label': '보는 범위' });
    [['near', '산 근처'], ['earth', '지구 전체'], ['far', '타원까지']].forEach(function (o) {
      var b = h('button', { class: 'og-view__btn', type: 'button', 'aria-pressed': 'false' }, o[1]);
      b.addEventListener('click', function (e) { if (e.detail) b.blur(); SK.set('cview', o[0]); });
      viewBtns[o[0]] = b; row.appendChild(b);
    });
    viewHint = h('button', { class: 'btn btn--primary btn--sm og-view__hint', type: 'button', hidden: true }, '');
    viewHint.addEventListener('click', function (e) { if (e.detail) viewHint.blur(); if (viewHint._to) SK.set('cview', viewHint._to); });
    viewEl = h('div', { class: 'og-view' }, [viewHint, h('div', { class: 'og-view__box' }, [h('span', { class: 'og-view__label', text: '보는 범위' }), row])]);
    SK.el.cornerBR.appendChild(viewEl);
  })();
  function updateViewBtns(cur, off) {
    for (var k in viewBtns) { var on = String(k === cur); if (viewBtns[k].getAttribute('aria-pressed') !== on) viewBtns[k].setAttribute('aria-pressed', on); }
    var to = off ? (cur === 'near' ? 'earth' : cur === 'earth' ? 'far' : null) : null;
    viewHint.hidden = !to; viewHint._to = to;
    var t = to ? '화면 밖으로 나갔어요 — ' + (to === 'earth' ? '지구 전체로 보기' : '타원까지 넓게 보기') + ' ▸' : '';
    SK.setText(viewHint, t);   // R4: ▸ → 아이콘 (같은 글이면 그대로)
  }

  /* ------------------------------------------------------------------
     9. 심화 ▸ (거리–중력 그래프 · 로켓 분사 · 블랙홀)
     ------------------------------------------------------------------ */
  (function addDeep() {
    var deep = SK.panel('deep');
    var cv = h('div', { class: 'og-deep-canvas' });
    deep.appendChild(h('div', { class: 'og-deep-card' }, [
      h('h3', { text: '높이 올라가면 중력이 0이 될까?' }),
      cv,
      h('p', null, ['중력은 거리의 제곱에 반비례해서 ', h('b', { text: '약해질 뿐 0이 되지 않아요' }), '. 위성 안이 둥둥 떠 보이는 것은 위성과 우주인이 ', h('b', { text: '같이 떨어지고' }), ' 있기 때문이에요.'])
    ]));
    deepView = SK.canvas(cv, { w: 520, h: 280, fit: true });
    deepView.onResize = function () { deepKey = ''; drawDeep(SK.params); };

    var ns = 'http://www.w3.org/2000/svg';
    function svg(inner) {
      var s = document.createElementNS(ns, 'svg');
      s.setAttribute('viewBox', '0 0 520 150'); s.setAttribute('class', 'og-deep-svg'); s.setAttribute('aria-hidden', 'true');
      s.innerHTML = inner; return s;
    }
    deep.appendChild(h('div', { class: 'og-deep-card' }, [
      h('h3', { text: '로켓은 어떻게 빨라질까? (정성)' }),
      svg('<rect x="190" y="55" width="150" height="40" rx="12" style="fill:var(--color-paper-sunk);stroke:var(--color-ink);stroke-width:3"/>' +
          '<path d="M340 55 L390 75 L340 95 Z" style="fill:var(--color-sim-orbit)"/>' +
          '<path d="M190 62 L120 50 M190 75 L100 75 M190 88 L120 100" style="stroke:var(--color-q-energy-heat);stroke-width:5;stroke-linecap:round;fill:none"/>' +
          '<path d="M400 75 L480 75" style="stroke:var(--color-q-velocity);stroke-width:6"/><path d="M480 63 L500 75 L480 87 Z" style="fill:var(--color-q-velocity)"/>' +
          '<text x="60" y="130" style="fill:var(--color-ink-muted);font:500 22px var(--font-sans)">가스를 뒤로 밀어냄</text>' +
          '<text x="360" y="130" style="fill:var(--color-ink-muted);font:500 22px var(--font-sans)">로켓은 앞으로</text>'),
      h('p', null, ['로켓이 가스를 뒤로 세게 밀어내면 가스도 로켓을 앞으로 밀어요(', h('b', { text: '운동량 보존' }), '). 이렇게 속력을 높여 원 궤도 속력(7.9 km/s)이나 탈출 속도(11.2 km/s)에 이르러요.'])
    ]));
    var rs = 2 * EARTH.GM / (3e8 * 3e8) * 1000;  // mm
    deep.appendChild(h('div', { class: 'og-deep-card' }, [
      h('h3', { text: '빛도 못 빠져나가면? — 블랙홀' }),
      svg('<circle cx="130" cy="75" r="40" style="fill:var(--color-ink)"/>' +
          '<circle cx="130" cy="75" r="62" style="fill:none;stroke:var(--color-line-strong);stroke-width:2;stroke-dasharray:6 6"/>' +
          '<path d="M20 30 Q130 20 175 62" style="fill:none;stroke:var(--color-sim-lens);stroke-width:4"/>' +
          '<text x="250" y="60" style="fill:var(--color-ink);font:500 22px var(--font-sans)">탈출 속도 = 빛의 속력</text>' +
          '<text x="250" y="95" style="fill:var(--color-ink-muted);font:500 22px var(--font-sans)">R = 2GM / c²</text>'),
      h('p', null, ['탈출 속도 √(2GM/R) 가 빛의 속력보다 커지면 빛도 빠져나오지 못해요. 지구를 블랙홀로 만들려면 반지름을 약 ', h('b', { text: SK.fmt(rs, 0) + ' mm' }), ' 로 줄여야 해요(그림으로만 다뤄요).'])
    ]));
  })();
  function drawDeep(p) {
    if (!deepView) return;
    var key = curMode + '|' + p.alt + '|' + deepView.scale;
    if (key === deepKey) return;
    deepKey = key;
    deepView.clear();
    var ctx = deepView.ctx;
    var ax = axes(ctx, { x: 64, y: 44, w: 436, h: 192 }, [0, 36000], [0, 100], { fs: 22, nx: 3, ny: 2 });
    text(ctx, '세로: 중력 (지표 = 100%)', 8, 16, { size: 22, weight: 500 });
    text(ctx, '가로: 고도 km', 512, 16, { size: 22, weight: 500, align: 'right', color: '--color-ink-muted' });
    ctx.save();
    ctx.beginPath();
    for (var i = 0; i <= 120; i++) {
      var a = 36000 * i / 120, gg = Math.pow(6371 / (6371 + a), 2) * 100;
      if (i === 0) ctx.moveTo(ax.mx(a), ax.my(gg)); else ctx.lineTo(ax.mx(a), ax.my(gg));
    }
    ctx.strokeStyle = col('--color-q-force'); ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
    [[400, 'ISS 89%'], [35786, '정지궤도 2.3%']].forEach(function (m) {
      var gg = Math.pow(6371 / (6371 + m[0]), 2) * 100;
      dot(ctx, ax.mx(m[0]), ax.my(gg), 6, '--color-q-force');
      text(ctx, m[1], ax.mx(m[0]) + (m[0] > 20000 ? -8 : 14), ax.my(gg) + (m[0] > 20000 ? -22 : 14), { size: 22, align: m[0] > 20000 ? 'right' : 'left', halo: true });
    });
    if (curMode === 'sat') {
      var gg2 = Math.pow(6371 / (6371 + p.alt), 2) * 100;
      dot(ctx, ax.mx(p.alt), ax.my(gg2), 8, null, '--color-sim-orbit', 3);
      text(ctx, '지금 ' + pctText(gg2 / 100) + '%', Math.min(ax.mx(p.alt) + 14, 400), Math.min(ax.my(gg2) + 44, 200), { size: 22, color: '--color-sim-orbit-text', halo: true });
    }
  }

  /* ------------------------------------------------------------------
     10. 하단 띠 — 계기판 1줄 · 속력 막대(대포·위성) / T²/a³ 막대(케플러)
     ------------------------------------------------------------------ */
  meterSets.cannon = SK.meters(null, [
    { key: 'v', label: '지금 속력', symbol: 'v', unit: 'km/s', decimals: 2, q: 'velocity', size: 'md' },
    { key: 'alt', label: '고도', unit: 'km', decimals: 0, size: 'md' },
    { key: 'res', label: '결과', unit: '', size: 'md' },
    // R6(C1): 심플 측정 칸 전용 — 결과(추락·궤도·탈출 글자+색) · 지금 속력. 위성 모드의 'v' 와 key 가 겹치지 않게 따로
    { key: 'sres', label: '결과', unit: '', simpleOnly: true },
    { key: 'sv', label: '지금 속력', symbol: 'v', unit: 'km/s', decimals: 2, q: 'velocity', simpleOnly: true }
  ]);
  meterSets.sat = SK.meters(null, [
    { key: 'v', label: '속력', symbol: 'v', unit: 'km/s', decimals: 2, q: 'velocity', size: 'md' },
    { key: 'T', label: '{{주기}}', symbol: 'T', unit: '분', decimals: 1, size: 'md' },
    { key: 'g', label: '지표 $g$ 대비', unit: '%', q: 'force', size: 'md' }   // R5: 1920 에서도 한 줄 (css nowrap)
  ]);
  meterSets.kepler = SK.meters(null, [
    { key: 'ratio', label: '평균 $T^2$/$a^3$', unit: '', decimals: 2 },
    { key: 'n', label: '입력한 행성', unit: '개', decimals: 0 }
  ]);
  for (var mk in meterSets) meterSets[mk].el.hidden = true;
  function setUnit(set, key, u) {
    var el = set.el.querySelector('[data-key="' + key + '"] .meter__unit');
    if (el && el.textContent !== u) el.textContent = u;
  }
  function updateMeters(p) {
    if (curMode === 'cannon' && cn) {
      var r = Math.sqrt(cn.x * cn.x + cn.y * cn.y);
      var landed = cn.res === '추락', jup = p.body === 'jupiter';
      meterSets.cannon.update({
        v: jup ? null : (landed && cn.vImp !== null ? cn.vImp : Math.sqrt(cn.vx * cn.vx + cn.vy * cn.vy) / 1000),
        alt: jup ? null : Math.max(0, landed ? 0 : (r - cn.b.R) / 1000),
        res: jup ? '범위 밖' : resWord(cn.res)
      });
      var sr = jup ? ['범위 밖', 'out', '결과'] : simpleRes(p);
      meterSets.cannon.update({ sres: sr[0], sv: (jup || hideResults()) ? null : (landed && cn.vImp !== null ? cn.vImp : Math.sqrt(cn.vx * cn.vx + cn.vy * cn.vy) / 1000) });
      paintSimpleRes(sr);
    } else if (curMode === 'sat' && sat) {
      var s = satCalc(p.alt);
      var useMin = s.T < 7200;
      var hid = hideResults();
      meterSets.sat.update({ v: hid ? null : s.v, T: hid ? null : (useMin ? s.T / 60 : s.T / 3600), g: hid ? null : pctText(s.g) });
      setUnit(meterSets.sat, 'T', useMin ? '분' : '시간');
    } else if (curMode === 'kepler') {
      var st = kStats();
      meterSets.kepler.update({ ratio: st.n ? st.mean : null, n: st.n });
    }
  }
  /** R6(C1): 심플 측정 칸 '결과' — 쏘기 전에는 발사 속력이 어느 구간인지(속력 띠와 같은 색·글자), 날아가는 중·끝나면 결과.
      돌려줌: [값 글자, 색 이름(fall·orbit·escape·idle·out), 칸 이름] */
  function zoneOf(v0, b) { return v0 < b.vCirc ? 'fall' : v0 < b.vEsc ? 'orbit' : 'escape'; }
  var ZONE_WORD = { fall: '추락', orbit: '궤도', escape: '탈출' };
  function simpleRes(p) {
    if (hideResults()) return ['예측한 뒤에', 'idle', '결과'];
    if (!cn.res) {
      if (SK.started) return ['나는 중', 'idle', '결과'];
      var z = zoneOf(p.v0, cn.b);
      return [ZONE_WORD[z] + ' 구간', z, '이 속력이면'];
    }
    var r = cn.res === '추락' ? 'fall' : cn.res === '탈출' ? 'escape' : 'orbit';
    return [resWord(cn.res), r, '결과'];
  }
  var resCell = null, resSig = '';
  function paintSimpleRes(sr) {
    if (!SK.isSimple()) return;
    if (!resCell || !resCell.isConnected) { resCell = SK.el.slide.querySelector('.simple-meter[data-key="sres"]'); resSig = ''; }
    if (!resCell) return;
    var sig = sr[1] + '|' + sr[2];
    if (sig === resSig) return;
    resSig = sig;
    resCell.setAttribute('data-res', sr[1]);
    var lb = resCell.querySelector('.simple-meter__label');
    if (lb && lb.textContent !== sr[2]) lb.textContent = sr[2];
  }
  /** 결과 세 가지 말 (계기판·기록 표) */
  function resWord(res) {
    if (!res) return SK.started ? '나는 중' : '쏘기 전';
    if (res === '추락') return '추락';
    if (res === '탈출') return '탈출';
    return '궤도 유지';
  }

  var bandLegend = null, bandBox = null, bandHome = null;
  (function makeBandGraph() {
    var area = h('div', { class: 'graph-box__canvas' });
    bandTitle = h('span', { class: 'og-band__title', text: '' });
    bandLegend = h('span', { class: 'og-band__legend', text: '', title: '▼ = 지금 발사 속력 · ● = 기록한 속력' });
    var box = h('div', { class: 'graph-box og-band' }, [h('div', { class: 'graph-box__title og-band__head' }, [bandTitle, bandLegend]), area]);
    SK.el.graph.appendChild(box);
    bandBox = box; bandHome = SK.el.graph;
    bandView = SK.canvas(area, { fit: false, bg: '--color-paper-raised' });
    bandView.onResize = function () { drawBand(); };
  })();
  /** R6(C1): 심플에서는 속력 띠를 측정 줄의 넓은 칸(vband)으로 옮긴다 — 같은 캔버스(노드 이동), 자세히로 돌아오면 제자리 */
  function placeBand() {
    if (!bandBox) return;
    var cell = SK.isSimple() ? SK.el.slide.querySelector('.simple-meter[data-key="vband"]') : null;
    if (cell) { if (bandBox.parentNode !== cell) cell.appendChild(bandBox); }
    else if (bandBox.parentNode !== bandHome) bandHome.appendChild(bandBox);
  }
  function drawBand() {
    if (!bandView) return;
    bandView.clear();
    var ctx = bandView.ctx, W = bandView.w, H = bandView.h;
    if (W < 40 || H < 20) return;
    if (curMode === 'cannon') bandCannon(ctx, W, H);
    else if (curMode === 'sat') bandSat(ctx, W, H);
    else bandKepler(ctx, W, H);
  }
  function setBandTitle(t, legend) {
    SK.setText(bandTitle, t);   // R4: $v_0$ 수식 표기
    legend = legend || '';
    if (bandLegend.dataset.t === legend) return;
    bandLegend.dataset.t = legend; bandLegend.innerHTML = '';
    legend.split(/([▼●▲■◆★]+)/).forEach(function (part) {   // 기록 기호(●▲■◆★)는 작은 글자로 x-height 가운데에, '지금' 표식 ▼ 는 SVG 삼각형(막대의 표식과 같은 모양)
      if (!part) return;
      if (part === '▼') { var sv = h('span', { class: 'og-band__sym og-band__now', 'aria-hidden': 'true' }); sv.innerHTML = '<svg viewBox="0 0 24 24" focusable="false"><path d="M3 5h18L12 20z" fill="currentColor"/></svg>'; bandLegend.appendChild(sv); return; }
      bandLegend.appendChild(/^[▼●▲■◆★]+$/.test(part) ? h('span', { class: 'og-band__sym', 'aria-hidden': 'true', text: part }) : document.createTextNode(part));
    });
  }
  /** 가로 속력 막대. R6(C2) 자세히: 제목 줄 24u(HTML) · 막대 40u(구간 이름 24u, 막대 안 세로 가운데) · 눈금 줄 20u(경계 숫자 22u, 경계 x 에 맞춰 막대 아래).
      R6(C1) 심플: 막대 · 아래 줄 = 경계 숫자 28u(마지막 숫자에 단위) + 범례 '▼ 지금 · ● 기록'(숫자와 안 겹치는 쪽 끝) — 제목 줄 없음 */
  function speedBar(ctx, W, H, o) {
    var simple = SK.isSimple();
    // 심플: 칸 높이(1920 기준 약 88u)에 맞춰 글자·막대를 함께 키운다(세로 태블릿은 칸이 u 보다 커서 k ≈ 1.5)
    var k = simple ? Math.max(1, Math.min(1.3, H / 88)) : 1;
    var x0 = simple ? 4 : 12, x1 = W - (simple ? 4 : 12), NUM = simple ? Math.round(28 * k) : 22, ROW = simple ? 32 * k : 20, GAP = simple ? 4 : 1;
    var by = simple ? 2 : 0;
    var bh = Math.max(20, Math.min(simple ? 56 * k : 40, H - by - GAP - ROW));
    var ry = by + bh + GAP;                                       // 숫자 줄 위 끝
    function X(v) { return x0 + (x1 - x0) * Math.max(0, Math.min(1, v / o.max)); }
    ctx.save();
    var ZS = simple ? Math.round(28 * k) : 24, ZL = { size: ZS, weight: 500 };
    var nx = o.now !== null && o.now !== undefined ? X(o.now) : null;
    (o.zones || []).forEach(function (z) {
      var a = X(z.from), b = X(z.to);
      ctx.fillStyle = col(z.color); ctx.fillRect(a, by, b - a, bh);
      if (!z.label) return;
      var tw = SK.measure(ctx, z.label, ZL).w, cx = (a + b) / 2;
      if (b - a < tw + 12) return;
      // ▼ 지금 선과 겹치면 구간 안의 빈 쪽으로 옮긴다
      if (nx !== null && Math.abs(nx - cx) < tw / 2 + 10) {
        var left = nx - a, right = b - nx;
        if (left >= tw + 20) cx = a + left / 2; else if (right >= tw + 20) cx = nx + right / 2;
      }
      text(ctx, z.label, cx, by + bh / 2 + 1, { size: ZS, weight: 500, align: 'center', color: z.text || '--color-ink' });
    });
    ctx.strokeStyle = col('--color-line-strong'); ctx.lineWidth = 1; ctx.strokeRect(x0, by, x1 - x0, bh);
    var mk = (o.marks || []).slice().sort(function (a, b) { return a.v - b.v; });
    mk = mk.map(function (m, i) { return Object.assign({}, m, { text: m.text + (simple && o.unit && i === mk.length - 1 ? ' ' + o.unit : '') }); });   // 심플: 마지막 숫자에 단위 한 번
    for (var mi = 1; mi < mk.length; mi++) {   // 경계 숫자 둘이 가까우면(달·화성, 좁은 칸) 왼쪽 것은 오른쪽 맞춤, 오른쪽 것은 왼쪽 맞춤
      var need = (SK.measure(ctx, mk[mi - 1].text, { size: NUM, weight: 500 }).w + SK.measure(ctx, mk[mi].text, { size: NUM, weight: 500 }).w) / 2 + 12;
      if (X(mk[mi].v) - X(mk[mi - 1].v) < Math.max(60, need)) { mk[mi - 1] = Object.assign({}, mk[mi - 1], { align: 'right' }); mk[mi] = Object.assign({}, mk[mi], { align: 'left' }); }
    }
    var numBoxes = [];
    mk.forEach(function (m) {
      var mx = X(m.v);
      ctx.beginPath(); ctx.moveTo(mx, by); ctx.lineTo(mx, by + bh + GAP); ctx.strokeStyle = col('--color-ink'); ctx.lineWidth = 2.5; ctx.stroke();
      var al = m.align || 'center', tx = mx;
      if (al === 'left') tx = mx + 4; else if (al === 'right') tx = mx - 4;
      var t = m.text;
      var tw = SK.measure(ctx, t, { size: NUM, weight: 500 }).w;
      var left = al === 'left' ? tx : al === 'right' ? tx - tw : tx - tw / 2;
      if (left < x0) { left = x0; tx = x0; al = 'left'; } else if (left + tw > x1) { left = x1 - tw; tx = x1; al = 'right'; }
      numBoxes.push([left, left + tw]);
      text(ctx, t, tx, ry + ROW / 2, { size: NUM, weight: 500, align: al, base: 'middle', color: '--color-ink' });   // 숫자 줄 세로 가운데
    });
    (o.dots || []).forEach(function (d) {
      text(ctx, d.mark, X(d.v), by + bh / 2 + 1, { size: simple ? Math.round(28 * k) : 22, weight: 500, align: 'center', color: d.color, halo: true });
    });
    if (nx !== null) {
      var tri = simple ? 16 * k : 11, tw2 = simple ? 11 * k : 8;
      ctx.fillStyle = col('--color-sim-orbit');
      ctx.beginPath(); ctx.moveTo(nx, by + tri); ctx.lineTo(nx - tw2, by); ctx.lineTo(nx + tw2, by); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = col('--color-sim-orbit'); ctx.lineWidth = simple ? 4 : 3;
      ctx.beginPath(); ctx.moveTo(nx, by); ctx.lineTo(nx, by + bh); ctx.stroke();
    }
    // 심플: 아래 줄 범례 — 경계 숫자와 겹치지 않는 쪽 끝(오른쪽 먼저)
    if (simple && o.legend) {
      var LS = Math.round(28 * k), lw = legendWidth(ctx, o.legend, LS);
      var free = function (a, b) { return numBoxes.every(function (bx) { return b + 16 < bx[0] || a - 16 > bx[1]; }); };
      var lx = free(x1 - lw, x1) ? x1 - lw : free(x0, x0 + lw) ? x0 : null;
      if (lx !== null) drawLegend(ctx, o.legend, lx, ry + ROW / 2, LS);
    }
    ctx.restore();
  }
  /** 심플 범례 '▼ 지금 · ● 기록' — ▼ 는 막대의 표식과 같은 삼각형(그림), 나머지는 글자 */
  function legendWidth(ctx, parts, size) {
    var w = 0;
    parts.forEach(function (pt) { w += pt === '▼' ? size * 0.75 + 6 : SK.measure(ctx, pt, { size: size, weight: 400 }).w; });
    return w;
  }
  function drawLegend(ctx, parts, x, y, size) {
    parts.forEach(function (pt) {
      if (pt === '▼') {
        var s = size * 0.375;
        ctx.fillStyle = col('--color-sim-orbit');
        ctx.beginPath(); ctx.moveTo(x + s, y + s); ctx.lineTo(x, y - s * 0.7); ctx.lineTo(x + 2 * s, y - s * 0.7); ctx.closePath(); ctx.fill();
        x += size * 0.75 + 6; return;
      }
      text(ctx, pt, x, y, { size: size, weight: 400, align: 'left', color: '--color-ink-chip' });
      x += SK.measure(ctx, pt, { size: size, weight: 400 }).w;
    });
  }
  function recDots(filter, val) {
    var out = [];
    SK.records.forEach(function (r, i) {
      if (filter && !filter(r)) return;
      var st = SK.recStyle(r.slot !== undefined ? r.slot : i);
      out.push({ v: val(r), color: st.color, mark: st.mark || '●' });
    });
    return out;
  }
  function bandCannon(ctx, W, H) {
    var b = BODIES[SK.params.body] || EARTH;
    if (b.key === 'jupiter') { setBandTitle('목성 탈출 속도 59.5 km/s — 범위 밖', ''); return; }
    var hid = hideResults();
    setBandTitle('발사 속력 $v_0$', hid ? '예측한 뒤에 보여요' : '▼ 지금 · ● 기록');   // R6(C2): 짧은 범례(제목 줄 오른쪽), 숫자는 막대 아래
    var vc = +b.vCirc.toFixed(1), ve = +b.vEsc.toFixed(1), MAX = 13;
    speedBar(ctx, W, H, {
      max: MAX,
      zones: hid ? [{ from: 0, to: MAX, color: '--color-paper-sunk', label: '' }] : [
        { from: 0, to: b.vCirc, color: '--color-warn-tint', label: '추락' },
        { from: b.vCirc, to: Math.min(MAX, b.vEsc), color: '--color-ok-tint', label: '궤도' },
        { from: Math.min(MAX, b.vEsc), to: MAX, color: '--color-primary-tint', label: '탈출' }
      ],
      marks: hid ? [] : [{ v: vc, text: SK.fmt(vc, 1) }, { v: ve, text: SK.fmt(ve, 1) }],
      dots: hid ? [] : recDots(function (r) { return (r.values.bk || r.params.body) === b.key; }, function (r) { return r.params.v0; }),
      now: SK.params.v0,
      unit: 'km/s', legend: hid ? null : ['▼', ' 지금 · ● 기록']
    });
  }
  function bandSat(ctx, W, H) {
    var s = satCalc(SK.params.alt), hid = hideResults();
    setBandTitle('위성 속력 $v$', hid ? '예측한 뒤에 보여요' : '▼ 지금 · ● 기록');   // R5: 지금 값은 왼쪽 계기판에 있음
    speedBar(ctx, W, H, {
      max: 8.5,
      zones: [{ from: 0, to: 8.5, color: '--color-paper-sunk', label: '' }],
      marks: hid ? [] : [{ v: 3.07, text: '정지궤도 3.1', align: 'right' }, { v: 3.87, text: 'GPS 3.9', align: 'left' }, { v: 7.67, text: 'ISS 7.7', align: 'right' }],
      dots: hid ? [] : recDots(null, function (r) { return r.values.v; }),
      now: hid ? null : s.v
    });
  }
  function bandKepler(ctx, W, H) {
    setBandTitle('행성마다 $T^2$/$a^3$ — 모두 1(점선)에 가까울까?', '');
    var box = { x: 30, y: 4, w: W - 38, h: H - 30 };
    var n = PLANETS.length, bw = box.w / n;
    var my = function (v) { return box.y + box.h - v / 1.5 * box.h; };
    ctx.strokeStyle = col('--color-line-strong'); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(box.x, box.y + box.h); ctx.lineTo(box.x + box.w, box.y + box.h); ctx.stroke();
    text(ctx, '1', box.x - 6, my(1), { size: 22, align: 'right', color: '--color-ink-muted' });
    kRows.forEach(function (r, i) {
      var x = box.x + bw * i + bw * 0.25, w = bw * 0.5;
      if (r.a && r.T) {
        var q = r.T * r.T / (r.a * r.a * r.a), y = my(Math.min(q, 1.5));
        ctx.fillStyle = col('--color-sim-orbit'); ctx.fillRect(x, y, w, box.y + box.h - y);
      }
      text(ctx, r.name, x + w / 2, H - 11, { size: 22, align: 'center', color: '--color-ink' });
    });
    ctx.save(); ctx.setLineDash([6, 5]); ctx.strokeStyle = col('--color-q-force'); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(box.x, my(1)); ctx.lineTo(box.x + box.w, my(1)); ctx.stroke(); ctx.restore();
  }
  recOpts = { columns: COLS.cannon };
  recTable = SK.recordTable(null, recOpts);
  SK.onRecords(function () { SK.requestRender(); updateSeq(); });

  /* ------------------------------------------------------------------
     11. 실험 화면 그리기 — 대포
     ------------------------------------------------------------------ */
  function edgeArrow(ctx, x, y, label, labels, cx0, cy0) {
    // 화면 밖 점(x, y)을 향하는 가장자리 화살표 (글자는 placeLabel 로). cx0, cy0: 천체 중심(화면)
    var T0 = vTop(), B0 = vBot();   // R4: 태블릿에서 넓어진 위아래까지
    var ccx = Math.min(1150, Math.max(100, cx0)), ccy = Math.min(B0 - 100, Math.max(T0 + 100, cy0));
    var m = 40, dx = x - ccx, dy = y - ccy;
    var tx = dx > 0 ? (1250 - m - ccx) / dx : dx < 0 ? (m - ccx) / dx : Infinity;
    var ty = dy > 0 ? (B0 - m - ccy) / dy : dy < 0 ? (T0 + m - ccy) / dy : Infinity;
    var t = Math.min(Math.abs(tx), Math.abs(ty));
    var ex = ccx + dx * t, ey = ccy + dy * t, len = Math.sqrt(dx * dx + dy * dy);
    SK.arrow(ctx, ex - dx / len * 60, ey - dy / len * 60, ex, ey, { color: '--color-sim-orbit', width: 6 });
    var lx = ex - dx / len * 80, ly = ey - dy / len * 80 + (dy > 0 ? -26 : 26);
    labels.push({ x: Math.min(1230, Math.max(20, lx)), y: Math.min(B0 - 30, Math.max(T0 + 30, ly)), text: label, anchor: lx > 625 ? 'right' : 'left', size: 22 });
  }
  /** 라벨이 화면 밖으로 나가지 않게: 글자 폭을 재서 anchor 와 x 를 고친다 */
  /** R3: '중력' 라벨 — 화살표 끝에서 12u 더 바깥, 화살표 방향 쪽으로 정렬(궤도 선·화살표 위에 얹히지 않게) */
  function forceLabel(x, y, fu, fl) {
    var d = fl + 12, an = fu[0] > 0.35 ? 'left' : fu[0] < -0.35 ? 'right' : 'center';
    var ly = y + fu[1] * d + (an === 'center' ? (fu[1] > 0 ? 14 : -14) : 0);
    return { x: x + fu[0] * d, y: ly, text: '중력', anchor: an, size: 22, color: '--color-copper-text' };
  }
  function keepIn(ctx, l) {
    var w = SK.measure(ctx, l.text, { size: l.size || 22, weight: 500 }).w + 16, a = l.anchor || 'center';
    var left = a === 'left' ? l.x : a === 'right' ? l.x - w : l.x - w / 2;
    if (left < 8) { l.anchor = 'left'; l.x = 8; }
    else if (left + w > 1242) { l.anchor = 'right'; l.x = 1242; }
    l.y = Math.min(vBot() - 16, Math.max(vTop() + 16, l.y));
    return l;
  }
  function renderCannon(ctx, p) {
    var c = cn; if (!c) return;
    var b = c.b, R = b.R, V = viewOf(p, b), hid = hideResults();
    var labels = [];
    function map(x, y) { return [V.cx + x * V.s, V.cy - y * V.s]; }
    // 천체
    drawBody(ctx, b.key, V.cx, V.cy, V.s);
    var top = map(0, 1), peak = map(0, (R + MOUNT) / R);
    var flashB = SK.isFlashing && SK.isFlashing('body');
    if (V.key === 'near') {
      // 실제 축척: 산 높이 20 km = 15u. 땅이 둥글게 휘어 내려가는 것이 보인다
      var gx = 1000, gy = V.cy - Math.sqrt(Math.max(0, V.s * V.s - (gx - V.cx) * (gx - V.cx)));
      if (gy < 640) labels.push({ x: gx, y: Math.max(gy + 40, 60), text: b.name + ' 표면은 둥글게 휘어요', size: 22, color: '--color-ink-muted' });
      ctx.beginPath(); ctx.moveTo(peak[0] - 60, top[1] + 2); ctx.lineTo(peak[0], peak[1]); ctx.lineTo(peak[0] + 54, top[1] + 2); ctx.closePath();
      ctx.fillStyle = col('--color-paper-sunk'); ctx.fill(); ctx.strokeStyle = col('--color-line-strong'); ctx.lineWidth = 2; ctx.stroke();
      drawCannon(ctx, peak[0], peak[1] - 2, 1);
      labels.push({ x: peak[0] - 40, y: peak[1] + 56, text: '대포 (산 높이 20 km)', anchor: 'left', size: 22 });
    } else {
      text(ctx, b.name, V.cx, V.cy + 10, { size: flashB ? 34 : 28, weight: 500, align: 'center', color: flashB ? '--color-sim-orbit-text' : '--color-ink' });
      // 산은 보이도록 크게 그린 그림 (실제 20 km 는 이 축척에서 3u)
      var tp = top[1];
      ctx.beginPath(); ctx.moveTo(V.cx - 44, tp + 8); ctx.lineTo(V.cx, tp - 22); ctx.lineTo(V.cx + 40, tp + 8); ctx.closePath();
      ctx.fillStyle = col('--color-paper-sunk'); ctx.fill(); ctx.strokeStyle = col('--color-line-strong'); ctx.lineWidth = 2; ctx.stroke();
      drawCannon(ctx, V.cx + 2, tp - 22, 0.9);
      labels.push({ x: V.cx - 64, y: tp - 18, text: '대포 (산 위)', anchor: 'right', size: 22 });
    }

    if (b.key === 'jupiter') {
      text(ctx, '목성 탈출 속도 59.5 km/s', V.cx, V.cy + V.s + 40, { size: 26, weight: 500, align: 'center', halo: true });
      text(ctx, '발사 속력 범위(최대 12 km/s) 밖이에요', V.cx, V.cy + V.s + 76, { size: 22, align: 'center', color: '--color-ink-muted', halo: true });
      updateViewBtns(V.key, false);
      SK.placeLabel(ctx, simpleLabels(labels).map(function (l) { return keepIn(ctx, l); }));
      return;
    }
    // 기록·직전 궤적 (색 + 선 모양). 궤적은 천체 반지름 R 단위라 같은 천체 기록만 겹친다. 예측 창이 떠 있으면 숨김
    var other = 0;
    if (!hid) SK.records.forEach(function (r) {
      if ((r.values.bk || r.params.body) !== b.key) { other++; return; }
      var st = SK.recStyle(r.slot);
      SK.drawPath(ctx, r.series.path, st, map);
      if (r.values.lx !== null && r.values.lx !== undefined) {
        var q = map(r.values.lx, r.values.ly);
        ctx.save(); ctx.strokeStyle = st.color; ctx.lineWidth = 3; ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(q[0] - 7, q[1] - 7); ctx.lineTo(q[0] + 7, q[1] + 7); ctx.moveTo(q[0] + 7, q[1] - 7); ctx.lineTo(q[0] - 7, q[1] + 7); ctx.stroke(); ctx.restore();
      }
      // 이름표 자리: 추락은 떨어진 곳, 궤도·탈출은 궤적 중간(끝점이 대포 자리라 겹치므로)
      var sp = r.series.path, e = r.values.lx !== null && r.values.lx !== undefined ? sp[sp.length - 1] : sp[Math.min(sp.length - 1, Math.floor(sp.length * (r.values.res === '탈출' || r.values.res === '먼 타원' ? 0.7 : 0.375)))];
      var eq = map(e[0], e[1]);
      if (eq[0] > 10 && eq[0] < 1240 && eq[1] > vTop() + 10 && eq[1] < vBot() - 10) labels.push({ x: eq[0] + 12, y: eq[1] - 16, text: (st.mark ? st.mark + ' ' : '') + SK.fmt(r.params.v0, 1) + ' km/s', anchor: 'left', size: 22, color: st.color });
    });
    if (!hid && SK.ghost && SK.ghost.series.path && (SK.ghost.values.bk || SK.ghost.params.body) === b.key) SK.drawPath(ctx, SK.ghost.series.path, SK.ghostStyle(), map);
    if (other && !hid) labels.push({ x: 24, y: vBot() - 36, text: '다른 천체 기록 ' + other + '개는 ' + (SK.isSimple() ? '더 보기의 표' : '표') + '에서 비교해요', anchor: 'left', size: 22, color: '--color-ink-muted' });
    // 지금 궤적
    var pts = p.trail ? c.path : c.path.slice(-10);
    var cur = pts.concat([[c.x / R, c.y / R]]);
    if (!hid) SK.drawPath(ctx, cur, { color: col('--color-sim-orbit'), dash: [], width: 4 }, map);
    // 포탄
    var bp = map(c.x / R, c.y / R);
    var off = bp[0] < 0 || bp[0] > 1250 || bp[1] < vTop() || bp[1] > vBot();   // R4: 화면 밖 판정은 보이는 높이 전체(hFull) 기준
    var r = Math.sqrt(c.x * c.x + c.y * c.y);
    if (off) {
      edgeArrow(ctx, bp[0], bp[1], V.key === 'near' ? '포탄 고도 ' + comma((r - R) / 1000) + ' km' : '포탄: 중심에서 ' + SK.fmt(r / R, 1) + ' R', labels, V.cx, V.cy);
    } else {
      if (c.res === '추락') {
        ctx.save(); ctx.strokeStyle = col('--color-warn'); ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(bp[0] - 10, bp[1] - 10); ctx.lineTo(bp[0] + 10, bp[1] + 10); ctx.moveTo(bp[0] + 10, bp[1] - 10); ctx.lineTo(bp[0] - 10, bp[1] + 10); ctx.stroke(); ctx.restore();
        labels.push({ x: bp[0] + 18, y: bp[1] - 22, text: '떨어진 곳 (' + comma(c.dist) + ' km)', anchor: 'left', size: 22 });
      }
      dot(ctx, bp[0], bp[1], 10, '--color-ink');
      if (p.arrows && c.res !== '추락') {
        var v = Math.sqrt(c.vx * c.vx + c.vy * c.vy);
        var vu = [c.vx / (v || 1), -c.vy / (v || 1)];               // 화면 좌표 (y 아래)
        var fu = [-c.x / r, c.y / r];                                // 중심 쪽
        var vl = Math.max(40, v / 1000 * 12), fl = Math.max(40, 80 * Math.pow(R / r, 2));
        if (v > 1) {
          SK.arrow(ctx, bp[0], bp[1], bp[0] + vu[0] * vl, bp[1] + vu[1] * vl, { color: '--color-q-velocity', width: 5 });
          labels.push({ x: bp[0] + vu[0] * (vl + 14), y: bp[1] + vu[1] * (vl + 14) - 4, text: '속도', anchor: vu[0] >= 0 ? 'left' : 'right', size: 22, color: '--color-q-velocity' });
        }
        SK.arrow(ctx, bp[0], bp[1], bp[0] + fu[0] * fl, bp[1] + fu[1] * fl, { color: '--color-q-force', width: 5 });
        labels.push(forceLabel(bp[0], bp[1], fu, fl));
        if (v > 1) angleMark(ctx, bp[0], bp[1], vu, fu);
      }
    }
    updateViewBtns(V.key, off && c.res !== '원 궤도');
    // 천체 이름(가운데 글자)과 라벨이 포개지지 않게
    var nameBox = V.key !== 'near' ? [{ x: V.cx - 60, y: V.cy - 16, w: 120, h: 52 }] : [];
    SK.placeLabel(ctx, simpleLabels(labels).map(function (l) { return keepIn(ctx, l); }), { avoid: nameBox });
  }
  /** R6(D2): 심플에서는 실험 화면 라벨을 28u 이상으로 (자리 계산은 placeLabel·keepIn 이 크기를 읽어 다시 한다) */
  function simpleLabels(labels) {
    if (SK.isSimple()) labels.forEach(function (l) { l.size = Math.max(l.size || 22, 28); });
    return labels;
  }

  /* ------------------------------------------------------------------
     12. 실험 화면 그리기 — 원궤도 위성
     ------------------------------------------------------------------ */
  function satScale(p) {
    var rmax = satCalc(p.alt).rR;
    if (SK.records.length && !hideResults()) {
      SK.records.forEach(function (r) { if (r.values.rR > rmax) rmax = r.values.rR; });
      if (SK.ghost && SK.ghost.values.rR > rmax) rmax = SK.ghost.values.rR;
    }
    return 230 / rmax;   // u / R (궤도 반지름 230u — 오른쪽 우주인·그래프 칸과 안 겹치게)
  }
  function drawSatellite(ctx, x, y, ang, size) {
    ctx.save(); ctx.translate(x, y);
    // R5: 궤도선 위에서도 보이게 — 지름 32u 이상 후광 + 종이색 테두리
    var hr = Math.max(16, size * 1.3);
    ctx.beginPath(); ctx.arc(0, 0, hr, 0, Math.PI * 2);
    ctx.globalAlpha = 0.22; ctx.fillStyle = col('--color-sim-orbit'); ctx.fill();
    ctx.globalAlpha = 0.6; ctx.lineWidth = 2; ctx.strokeStyle = col('--color-sim-orbit'); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.rotate(ang);
    ctx.lineJoin = 'round'; ctx.strokeStyle = col('--color-paper-raised'); ctx.lineWidth = 5;
    ctx.strokeRect(-size * 2.2, -size * 0.35, size * 1.4, size * 0.7); ctx.strokeRect(size * 0.8, -size * 0.35, size * 1.4, size * 0.7);
    ctx.strokeRect(-size * 0.8, -size * 0.6, size * 1.6, size * 1.2);
    ctx.fillStyle = col('--color-primary'); ctx.strokeStyle = col('--color-primary-dark'); ctx.lineWidth = 1.5;
    ctx.fillRect(-size * 2.2, -size * 0.35, size * 1.4, size * 0.7); ctx.strokeRect(-size * 2.2, -size * 0.35, size * 1.4, size * 0.7);
    ctx.fillRect(size * 0.8, -size * 0.35, size * 1.4, size * 0.7); ctx.strokeRect(size * 0.8, -size * 0.35, size * 1.4, size * 0.7);
    ctx.fillStyle = col('--color-sim-orbit'); ctx.fillRect(-size * 0.8, -size * 0.6, size * 1.6, size * 1.2);
    ctx.restore();
  }
  var SAT_COL = { x: 900, w: 334 };   // 오른쪽 칸 (우주인 · 그래프)
  function drawAstronaut(ctx, x, y, w, hh, g, t) {
    panelBox(ctx, x, y, w, hh);
    text(ctx, '위성 안의 우주인', x + 16, y + 24, { size: 22, weight: 500, color: '--color-ink' });
    // 창
    var wh = hh - 120;
    ctx.save();
    roundRect(ctx, x + 16, y + 46, w - 32, wh, 14);
    ctx.fillStyle = col('--color-paper-raised'); ctx.fill(); ctx.strokeStyle = col('--color-line-strong'); ctx.lineWidth = 2; ctx.stroke();
    var bob = Math.sin(t * 2) * 6;
    var ax = x + w / 2, ay = y + 46 + wh / 2 + bob;
    ctx.strokeStyle = col('--color-ink'); ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.translate(ax, ay); ctx.rotate(0.35 + Math.sin(t) * 0.15);
    ctx.beginPath(); ctx.arc(0, -22, 10, 0, Math.PI * 2); ctx.fillStyle = col('--color-paper-sunk'); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(0, 10);
    ctx.moveTo(0, -4); ctx.lineTo(-16, -15); ctx.moveTo(0, -4); ctx.lineTo(16, -13);
    ctx.moveTo(0, 10); ctx.lineTo(-11, 26); ctx.moveTo(0, 10); ctx.lineTo(12, 24); ctx.stroke();
    ctx.restore();
    dot(ctx, x + w * 0.8, y + 66 - bob, 7, '--color-copper');
    text(ctx, '둥둥 = 함께 떨어지는 중', x + w / 2, y + hh - 54, { size: 22, align: 'center', weight: 500, color: '--color-sim-orbit-text' });
    text(ctx, '중력: 지표의 ' + pctText(g) + '%', x + w / 2, y + hh - 22, { size: 22, align: 'center', weight: 500, color: '--color-copper-text' });
  }
  /** 실험 화면 오른쪽 아래: 기록한 위성의 T – r (또는 T² – r³) 그래프 */
  function satGraph(ctx, p, y0, y1) {
    var sq = p.gaxis === 'sq', hid = hideResults();
    var bx = SAT_COL.x, by = y0, bw = SAT_COL.w, bh = y1 - y0;
    panelBox(ctx, bx, by, bw, bh);
    text(ctx, sq ? '$T^2$ – $r^3$ 그래프' : '$T$ – $r$ 그래프', bx + 16, by + 24, { size: 22, weight: 500 });
    function X(rR) { return sq ? rR * rR * rR : rR; }
    function Y(Th) { return sq ? Th * Th : Th; }
    var pts = [];
    if (!hid) SK.records.forEach(function (r) { var st = SK.recStyle(r.slot); pts.push({ x: X(r.values.rR), y: Y(r.values.Th), st: st }); });
    var s = satCalc(p.alt);
    if (!hid) pts.push({ x: X(s.rR), y: Y(s.Th), now: true });
    var xm = 1, ym = 1;
    pts.forEach(function (q) { if (q.x > xm) xm = q.x; if (q.y > ym) ym = q.y; });
    var box = { x: bx + 62, y: by + 50, w: bw - 82, h: bh - 112 };
    var ax = axes(ctx, box, [0, niceMax(xm)], [0, niceMax(ym)], { fs: 22, nx: 2, ny: 2, noY0: true });
    text(ctx, sq ? '가로 $r^3$ · 세로 $T^2$' : '가로 $r$ (R) · 세로 $T$ (시간)', bx + bw / 2, by + bh - 18, { size: 22, align: 'center', color: '--color-ink' });
    if (sq && SK.records.length >= 2 && !hid) {
      var k = 4 * Math.PI * Math.PI * Math.pow(EARTH.R, 3) / (EARTH.GM * 3600 * 3600), xe = niceMax(xm);
      ctx.save(); ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip();
      SK.drawPath(ctx, [[0, 0], [xe, k * xe]], { color: col('--color-line-strong'), dash: [8, 6], width: 2 }, function (a, b) { return [ax.mx(a), ax.my(b)]; });
      ctx.restore();
    }
    if (!SK.records.length || hid) text(ctx, hid ? '예측한 뒤에 보여요' : '기록하면 점이 생겨요', box.x + box.w / 2, box.y + box.h / 2, { size: 22, align: 'center', color: '--color-ink-muted', bg: '--color-paper-raised', pad: [8, 4] });   // R5: 눈금선 위에 종이색 띠
    pts.forEach(function (q) {
      var x = ax.mx(q.x), y = ax.my(q.y);
      if (q.now) { dot(ctx, x, y, 7, null, '--color-sim-orbit', 3); return; }
      text(ctx, q.st.mark || '●', x, y, { size: 22, weight: 500, align: 'center', color: q.st.color, halo: true });
    });
  }
  function renderSat(ctx, p) {
    var s = satCalc(p.alt), S = satScale(p), CX = 480, CY = 370, hid = hideResults();
    var labels = [];
    drawBody(ctx, 'earth', CX, CY, S);
    if (S > 60) text(ctx, '지구', CX, CY, { size: 26, weight: 500, align: 'center', color: '--color-ink' });
    function circ(rR, st, lab) {
      ctx.save(); SK.applyStroke(ctx, st);
      ctx.beginPath(); ctx.arc(CX, CY, rR * S, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      if (lab) labels.push({ x: CX + rR * S * 0.71 + 8, y: CY + rR * S * 0.71 + 10, text: lab, anchor: 'left', size: 22, color: st.color });
    }
    if (!hid) SK.records.forEach(function (r) { var st = SK.recStyle(r.slot); circ(r.values.rR, st, (st.mark ? st.mark + ' ' : '') + '기록 ' + r.n); });
    if (!hid && SK.ghost && SK.ghost.values.rR) circ(SK.ghost.values.rR, SK.ghostStyle());
    var ro = s.rR * S;
    ctx.save(); ctx.strokeStyle = col('--color-line'); ctx.lineWidth = 2; ctx.setLineDash([4, 8]);
    ctx.beginPath(); ctx.arc(CX, CY, ro, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    var f = Math.min(SK.time / SAT_SCREEN_T, 1);
    var th0 = Math.PI / 2, th = th0 + 2 * Math.PI * f;           // 수학 각(반시계)
    if (p.trail && f > 0) {
      ctx.save(); ctx.strokeStyle = col('--color-sim-orbit'); ctx.lineWidth = 4; ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(CX, CY, ro, -th0, -th, true); ctx.stroke(); ctx.restore();
    }
    var x = CX + ro * Math.cos(th), y = CY - ro * Math.sin(th);
    // 고도 표시: 지표에서 궤도까지 왼쪽 수평선
    ctx.save(); ctx.strokeStyle = col('--color-ink-muted'); ctx.lineWidth = 2; ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(CX - S, CY); ctx.lineTo(CX - ro, CY); ctx.stroke(); ctx.restore();
    labels.push({ x: CX - ro - 12, y: CY - 24, text: '고도 ' + comma(p.alt) + ' km', anchor: 'right', size: 22 });
    var size = 10 + 5 * Math.log(p.mass / 100) / Math.LN10;  // 질량이 크면 조금 크게 (주기는 그대로!)
    drawSatellite(ctx, x, y, -th + Math.PI / 2, size);
    if (p.arrows) {
      var vu = [-Math.sin(th), -Math.cos(th)];
      var fu = [-Math.cos(th), Math.sin(th)];
      var vl = s.v * 16, fl = Math.max(36, 110 * s.g);
      SK.arrow(ctx, x, y, x + vu[0] * vl, y + vu[1] * vl, { color: '--color-q-velocity', width: 5 });
      SK.arrow(ctx, x, y, x + fu[0] * fl, y + fu[1] * fl, { color: '--color-q-force', width: 5 });
      // 위성 라벨은 궤도 바깥쪽으로
      var ox = Math.cos(th), oy = -Math.sin(th);
      labels.push({ x: x + vu[0] * (vl + 14) + ox * 10, y: y + vu[1] * (vl + 14) + oy * 10, text: hid ? '속도' : '속도 ' + SK.fmt(s.v, 2) + ' km/s', anchor: vu[0] >= 0.2 ? 'left' : vu[0] <= -0.2 ? 'right' : 'center', size: 22, color: '--color-q-velocity' });
      labels.push(forceLabel(x, y, fu, fl));
      angleMark(ctx, x, y, vu, fu);
    }
    // R4: 오른쪽 칸은 보이는 위 끝에 붙이고(−offsetY), 그래프는 넓어진 아래까지 길게
    var top = Math.max(110, (SK.stageInset ? SK.stageInset().top : 0) + 12) + vTop(), bot = vBot() - 14;
    drawAstronaut(ctx, SAT_COL.x, top, SAT_COL.w, 250, s.g, SK.time * 3);
    satGraph(ctx, p, top + 264, bot);
    SK.placeLabel(ctx, labels.map(function (l) { return keepIn(ctx, l); }), { avoid: [{ x: SAT_COL.x, y: top, w: SAT_COL.w, h: bot - top }] });
  }

  /* ------------------------------------------------------------------
     13. 케플러 자료 — 표(DOM) + 그래프(캔버스)
     ------------------------------------------------------------------ */
  var K_RANGE = { a: [0.1, 40], T: [0.05, 300] };
  function kStats() {
    var n = 0, sum = 0;
    kRows.forEach(function (r) { if (r.a && r.T) { n++; sum += r.T * r.T / (r.a * r.a * r.a); } });
    return { n: n, mean: n ? sum / n : 0 };
  }
  function kFmt(v, d) { return v === null || v === undefined ? '–' : SK.fmt(v, d); }
  (function makeKepler() {
    var tbody = h('tbody');
    kEl = h('div', { class: 'og-kepler', hidden: true }, [
      h('table', { class: 'og-ktable' }, [
        h('thead', null, h('tr', null, [h('th', { text: '행성' }), h('th', { text: 'a (AU)' }), h('th', { text: 'T (년)' }), h('th', { text: 'T²' }), h('th', { text: 'a³' }), h('th', { text: 'T²/a³' })])),
        tbody
      ]),
      h('div', { class: 'og-kbtns' }, [
        h('button', { class: 'btn btn--secondary', type: 'button', onclick: function (e) { if (e.detail) e.currentTarget.blur(); showDataCard(); } }, '자료 카드 보기'),
        h('button', { class: 'btn', type: 'button', onclick: function (e) { if (e.detail) e.currentTarget.blur(); kFill(); } }, '자료 넣기'),
        h('button', { class: 'btn btn--quiet', type: 'button', onclick: function (e) { if (e.detail) e.currentTarget.blur(); kClear(); } }, '표 비우기')
      ]),
      kStepEl = h('ol', { class: 'og-ksteps' }, [
        h('li', { text: '표 채우기 — a: 태양까지 거리(AU), T: 공전 주기(년)' }),
        h('li', { text: 'T – a 그래프: 휘어진 선이에요' }),
        h('li', { text: 'T² – a³ 그래프로 바꾸기: 곧은 선일까?' })
      ])
    ]);
    kEl.style.gridTemplateRows = 'auto auto auto';
    kRows.forEach(function (row, i) {
      function inp(key) {
        var el = h('input', { class: 'og-kin num', type: 'text', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', 'aria-label': row.name + ' ' + (key === 'a' ? '궤도 반지름 a (AU)' : '공전 주기 T (년)') });
        el.addEventListener('input', function () {
          var v = SK.parseNum(el.value);
          var rg = K_RANGE[key];
          if (el.value.trim() === '') { row[key] = null; el.classList.remove('is-invalid'); }
          else if (isNaN(v) || v < rg[0] || v > rg[1]) { el.classList.add('is-invalid'); row[key] = null; }
          else { el.classList.remove('is-invalid'); row[key] = v; }
          kUpdateRow(i); kCheck(); SK.requestRender();
        });
        el.addEventListener('change', function () {
          var v = SK.parseNum(el.value), rg = K_RANGE[key];
          if (el.value.trim() !== '' && (isNaN(v) || v < rg[0] || v > rg[1])) {
            SK.notice(isNaN(v) ? '숫자만 넣어 주세요 (예: 1.524)' : '범위는 ' + rg[0] + ' ~ ' + rg[1] + (key === 'a' ? ' AU' : ' 년') + ' 예요', 'warn');
          }
        });
        el.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); var all = kEl.querySelectorAll('.og-kin'); var idx = Array.prototype.indexOf.call(all, el); if (all[idx + 1]) all[idx + 1].focus(); else el.blur(); }
          else if (e.key === 'Escape') { e.preventDefault(); el.blur(); }
        });
        el.addEventListener('focus', function () { el.select(); });
        row['el' + key] = el;
        return el;
      }
      row.cT2 = h('td', { class: 'num' }); row.ca3 = h('td', { class: 'num' }); row.cq = h('td', { class: 'num og-ratio' });
      tbody.appendChild(h('tr', null, [h('td', { text: row.name }), h('td', null, inp('a')), h('td', null, inp('T')), row.cT2, row.ca3, row.cq]));
      kUpdateRow(i);
    });
    SK.el.stage.appendChild(kEl);
  })();
  function kUpdateRow(i) {
    var r = kRows[i];
    r.cT2.textContent = r.T ? kFmt(r.T * r.T, r.T < 2 ? 3 : 1) : '–';
    r.ca3.textContent = r.a ? kFmt(r.a * r.a * r.a, r.a < 2 ? 3 : 1) : '–';
    r.cq.textContent = r.a && r.T ? kFmt(r.T * r.T / (r.a * r.a * r.a), 2) : '–';
  }
  function kSet(i, a, T) {
    var r = kRows[i]; r.a = a; r.T = T;
    r.ela.value = a === null ? '' : String(a); r.elT.value = T === null ? '' : String(T);
    r.ela.classList.remove('is-invalid'); r.elT.classList.remove('is-invalid');
    kUpdateRow(i);
  }
  function kFill() { PLANETS.forEach(function (p, i) { kSet(i, p.a, p.T); }); kCheck(); SK.requestRender(); SK.notice('자료를 넣었어요 — $T^2$ – $a^3$ 로 바꿔 봐요', 'ok'); }
  function kClear() { PLANETS.forEach(function (p, i) { kSet(i, null, null); }); kDone = false; kCheck(); SK.hideNote(); SK.requestRender(); }
  /** 케플러 3단계 안내: 지금 단계 강조, 표가 다 차고 T² – a³ 이면 결론(정리 문장·예측 판정) */
  function kCheck() {
    if (!kStepEl) return;
    var n = kStats().n, sq = SK.get('gaxis') === 'sq';
    var step = n < 3 ? 0 : (!sq ? 1 : 2);
    var lis = kStepEl.children;
    for (var i = 0; i < lis.length; i++) {
      lis[i].classList.toggle('is-now', i === step);
      lis[i].classList.toggle('is-done', i < step || (i === 2 && sq && n >= 6));
    }
    if (curMode === 'kepler' && n > 0 && SK.stepIndex === 0) SK.goStep(1);
    if (curMode === 'kepler' && sq && n >= 6 && !kDone) { kDone = true; SK.finish('점들이 원점을 지나는 곧은 선 위에 있어요'); }
  }
  function showDataCard() {
    var tb = h('tbody', null, PLANETS.map(function (p) {
      return h('tr', null, [h('td', { text: p.name }), h('td', { class: 'num', text: SK.fmt(p.a, 3) }), h('td', { class: 'num', text: p.T < 10 ? SK.fmt(p.T, 3) : SK.fmt(p.T, 2) })]);
    }));
    SK.dialog({
      title: '행성 관측 자료 카드',
      body: [
        h('table', { class: 'guide-table og-compare' }, [h('thead', null, h('tr', null, [h('th', { text: '행성' }), h('th', { text: '궤도 반지름 a (AU)' }), h('th', { text: '공전 주기 T (년)' })])), tb]),
        h('p', { class: 'og-dialog-note', text: '1 AU = 지구–태양 평균 거리(약 1억 5천만 km), 1년 = 지구의 공전 주기. 표에 직접 옮겨 적거나 자료 넣기 버튼을 눌러요.' })
      ],
      ok: '닫기', cancel: null
    });
  }
  function renderKepler(ctx, p) {
    var sq = p.gaxis === 'sq', inner = p.kzoom === 'inner';
    // R4: 왼쪽 표(HTML)가 위에 붙어 있으니 그래프도 보이는 위 끝 기준, 넓어진 세로는 그래프 높이로
    var T0 = vTop(), ex = SK.view ? SK.view.extra : 0;
    var box = { x: 730, y: 124 + T0, w: 480, h: 480 + ex };
    text(ctx, sq ? '$T^2$ – $a^3$ 그래프' : '$T$ – $a$ 그래프', box.x + box.w, 40 + T0, { size: 30, weight: 500, align: 'right' });
    text(ctx, sq ? '점들이 한 직선 위에 있을까?' : '거리가 멀수록 주기는 어떻게 늘까?', box.x + box.w, 76 + T0, { size: 22, color: '--color-ink-muted', align: 'right' });
    var pts = [];
    kRows.forEach(function (r) { if (r.a && r.T) pts.push({ x: sq ? r.a * r.a * r.a : r.a, y: sq ? r.T * r.T : r.T, name: r.name }); });
    var xm = inner ? (sq ? 4 : 2) : (sq ? 900 : 10), ym = inner ? (sq ? 4 : 2) : (sq ? 900 : 30);
    var ax = axes(ctx, box, [0, xm], [0, ym], { fs: 22, xl: sq ? '$a^3$ (AU³)' : '$a$ (AU)', yl: sq ? '$T^2$ (년²)' : '$T$ (년)', nx: 4, ny: 4 });
    ctx.save(); ctx.beginPath(); ctx.rect(box.x - 2, box.y - 2, box.w + 4, box.h + 4); ctx.clip();
    if (sq && p.kguide) {
      SK.drawPath(ctx, [[0, 0], [Math.max(xm, ym), Math.max(xm, ym)]], { color: col('--color-q-force'), dash: [10, 7], width: 3 }, function (a, b) { return [ax.mx(a), ax.my(b)]; });
    }
    if (!sq && pts.length >= 2) {
      // T–a: 원점에서 시작해 점들을 부드럽게 잇는 곡선
      var sorted = [{ x: 0, y: 0 }].concat(pts.slice().sort(function (a, b) { return a.x - b.x; }));
      ctx.beginPath(); ctx.strokeStyle = col('--color-sim-orbit'); ctx.lineWidth = 3; ctx.setLineDash([]);
      ctx.moveTo(ax.mx(sorted[0].x), ax.my(sorted[0].y));
      for (var i = 0; i < sorted.length - 1; i++) {
        var p0 = sorted[Math.max(0, i - 1)], p1 = sorted[i], p2 = sorted[i + 1], p3 = sorted[Math.min(sorted.length - 1, i + 2)];
        var c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6, c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
        ctx.bezierCurveTo(ax.mx(c1x), ax.my(c1y), ax.mx(c2x), ax.my(c2y), ax.mx(p2.x), ax.my(p2.y));
      }
      ctx.stroke();
    }
    var hidden = 0, names = [];
    pts.forEach(function (q) {
      if (q.x > xm * 1.02 || q.y > ym * 1.02) { hidden++; return; }
      dot(ctx, ax.mx(q.x), ax.my(q.y), 9, '--color-sim-orbit', '--color-paper-raised', 2);
      names.push({ x: ax.mx(q.x) + 14, y: ax.my(q.y) - 18, text: q.name, anchor: 'left', size: 22, leader: true });
    });
    ctx.restore();
    if (names.length) SK.placeLabel(ctx, names);
    if (sq && p.kguide) text(ctx, '기울기 1 ($T^2$ = $a^3$)', box.x + box.w - 8, box.y + 26, { size: 22, align: 'right', color: '--color-copper-text', halo: true });
    if (hidden) text(ctx, '그래프 밖 ' + hidden + '개 — 보는 범위를 전체로', box.x + box.w, box.y + box.h + 50, { size: 22, align: 'right', color: '--color-ink-muted' });
    if (!pts.length) text(ctx, '왼쪽 표에 a와 T를 넣어 보세요', box.x + box.w / 2, box.y + box.h / 2, { size: 24, weight: 500, align: 'center', color: '--color-ink-muted', halo: true });
  }

  /* ------------------------------------------------------------------
     14. 목성·천체 비교 표
     ------------------------------------------------------------------ */
  function showCompare() {
    var cur = SK.get('body');
    var rows = BODY_ORDER.map(function (k) {
      var b = BODIES[k];
      return h('tr', { class: k === cur ? 'is-now' : null }, [
        h('td', { text: b.name }),
        h('td', { class: 'num', text: comma(b.R / 1000) }),
        h('td', { class: 'num', text: SK.fmt(b.M / 5.972e24, b.M < 1e24 ? 3 : 0) }),
        h('td', { class: 'num', text: SK.fmt(b.g, 1) }),
        h('td', { class: 'num', text: SK.fmt(b.vCirc, k === 'mars' ? 2 : 1) }),
        h('td', { class: 'num', text: SK.fmt(b.vEsc, 1) })
      ]);
    });
    SK.dialog({
      title: '천체마다 탈출 속도가 달라요',
      body: [
        h('table', { class: 'guide-table og-compare' }, [
          h('thead', null, h('tr', null, [h('th', { text: '천체' }), h('th', { text: '반지름 (km)' }), h('th', { text: '질량 (지구 = 1)' }), h('th', { text: '지표 중력 (m/s²)' }), h('th', { text: '원 궤도 속력 (km/s)' }), h('th', { text: '탈출 속도 (km/s)' })])),
          h('tbody', null, rows)
        ]),
        h('p', { class: 'og-dialog-note', text: '탈출 속도 = √(2GM/R). 질량이 크고 반지름이 작을수록 커요. 원 궤도 속력의 약 1.41배예요. 이 대포의 발사 속력은 최대 12 km/s라서 목성(59.5 km/s)은 범위 밖이에요. 목성 반지름은 적도 반지름 71,492 km로 계산했어요.' })
      ],
      ok: '닫기', cancel: null
    });
  }

  /* ------------------------------------------------------------------
     15. 실험 카드 5 + 순서 칩(패널 수치 칸 아래 한 줄)
     ------------------------------------------------------------------ */
  // extra: 단계마다 함께 맞추는 '표시'(보는 범위·배속). 기록 대상이 아니라 변인 통제에 영향 없음
  var SEQS = {
    v: { id: 'v', mode: 'cannon', key: 'v0', unit: ' km/s', vals: [4, 6, 7.9, 10, 11.2], label: function (v) { return SK.fmt(v, v % 1 ? 1 : 0); },
      extra: { 4: { cview: 'near', tscale: 0.5 }, 6: { cview: 'near', tscale: 0.5 }, 7.9: { cview: 'earth', tscale: 10 }, 10: { cview: 'far', tscale: 30 }, 11.2: { cview: 'far', tscale: 30 } } },
    m: { id: 'm', mode: 'sat', key: 'mass', unit: ' kg', vals: [100, 1000, 10000], label: function (v) { return comma(v); } },
    h: { id: 'h', mode: 'sat', key: 'alt', unit: '', vals: [400, 20200, 35786], label: function (v) { return v === 400 ? 'ISS' : v === 20200 ? 'GPS' : '정지궤도'; },
      tip: function (v) { return '고도 ' + comma(v) + ' km'; } },
    b: { id: 'b', mode: 'cannon', key: 'body', unit: '', vals: ['moon', 'mars', 'earth'], label: function (v) { return BODIES[v].name; },
      extra: { moon: { cview: 'far', tscale: 10 }, mars: { cview: 'near', tscale: 2 }, earth: { cview: 'near', tscale: 0.5 } } }
  };
  DEFAULT_SEQ = { cannon: SEQS.v, sat: SEQS.h };
  if (!seq && curMode) seq = DEFAULT_SEQ[curMode] || null;
  function applyExtra(s, v) {
    var ex = s && s.extra && s.extra[v];
    if (!ex) return;
    for (var k in ex) if (SK.get(k) !== ex[k]) SK.set(k, ex[k]);
  }
  var lastShownBody = 'earth';
  /** 모드를 바꾸는 카드: 바뀔 때만 '○○ 모드로 바뀌어요' 토스트(E3) */
  function modeGetter(p, m) {
    Object.defineProperty(p, 'mode', { enumerable: true, get: function () { return Date.now() - lastSwitchAt < 120 ? MODES[m].label + ' 모드' : undefined; } });
    return p;
  }
  var R_NOTE = 'r = 지구 중심까지 거리 = 지구 반지름 6,371 km + 고도.';
  /** 예측 판정: 질문의 전제(예: 7.9 km/s)와 다른 값으로 먼저 실행하면 판정을 미루고(예측 유지) 전제대로 실행했을 때 판정한다 */
  function judgeIf(ok, answer) {
    return function (p, values) {
      if (!ok(p, values)) { if (SK.prediction) SK.prediction.pending = true; return null; }
      return typeof answer === 'function' ? answer(p, values) : answer;
    };
  }
  function cannonAnswer(p, values) { var r = values.res; return r === '추락' ? 1 : (r === '탈출' || r === '먼 타원') ? 3 : 2; }
  SK.setPresets([
    modeGetter({
      name: '뉴턴의 대포', tag: '과학사',
      changes: 'v₀ 7.9 km/s', change: '발사 속력 v₀ (4 → 6 → 7.9 → 10 → 11.2 km/s)', fixed: '지구 · 산 높이 20 km · 수평 발사',
      values: { mode: 'cannon', body: 'earth', v0: 7.9, tscale: 10, cview: 'earth', trail: true, arrows: true },
      predict: { question: '공기 없는 산꼭대기(20 km)에서 7.9 km/s로 수평으로 쏘면 포탄은 어떻게 될까?', choices: ['조금 가다 떨어진다', '지구를 한 바퀴 돈다', '우주로 날아간다'],
        judge: judgeIf(function (p) { return p.mode === 'cannon' && p.body === 'earth' && Math.abs(p.v0 - 7.9) < 0.05; }, cannonAnswer),
        why: '포탄은 계속 떨어지지만, 떨어지는 만큼 둥근 땅도 휘어 내려가서 땅에 닿지 않아요. 이 실험은 공기가 없는 약 20 km 높이 산에서 쏴요. 지표에서 7.9 km/s는 거의 원 궤도 속력이에요.' },
      onApply: function () { seq = SEQS.v; updateSeq(true); }
    }, 'cannon'),
    modeGetter({
      name: 'ISS도 낙하 중', tag: '오개념',   // R5: 2줄 안 (예전 이름은 3줄로 '중' 이 잘림)
      changes: '질량만 바꾸기', change: '위성 질량 m (100 → 1,000 → 10,000 kg)', fixed: '고도 400 km (국제우주정거장)',
      values: { mode: 'sat', alt: 400, mass: 100, gaxis: 'lin', trail: true, arrows: true },
      predict: { place: 'top', question: '같은 400 km 높이에서 무거운 위성은 더 빨리 돌까?', choices: ['무거우면 더 빨리', '똑같은 빠르기', '무거우면 더 느리게'],
        judge: judgeIf(function (p) { return p.mode === 'sat'; }, 2),
        why: '무거운 위성은 중력도 크지만, 그만큼 방향을 바꾸기도 어려워요(관성). 둘이 똑같이 커져 상쇄되니 v = √(GM/r)에 위성 질량이 없어요. ' + R_NOTE,
        afterHint: 'ISS 높이에서 질량만 바꿔 봐요' },
      onApply: function () { seq = SEQS.m; updateSeq(true); }
    }, 'sat'),
    modeGetter({
      name: '정지궤도 위성', tag: '대표 문항',
      changes: '고도만 바꾸기', change: '고도 h (ISS 400 → GPS 20,200 → 정지궤도 35,786 km)', fixed: '위성 질량 1,000 kg',
      values: { mode: 'sat', alt: 400, mass: 1000, gaxis: 'lin', trail: true, arrows: true },
      predict: { place: 'top', question: '지구에서 35,786 km 높이의 위성은 국제우주정거장(400 km)보다 빨리 돌까, 천천히 돌까?', choices: ['더 빨리 돈다', '같은 빠르기로 돈다', '더 천천히 돈다'],
        judge: judgeIf(function (p) { return p.mode === 'sat'; }, 3),
        why: R_NOTE + ' 멀수록 중력이 약해서 천천히 돌아도 궤도를 지켜요(v = √(GM/r)). ISS는 r = 6,771 km에서 7.7 km/s, 정지궤도는 r = 42,157 km에서 3.1 km/s예요.',
        afterHint: '고도만 바꿔 세 번 기록해요' },
      onApply: function () { seq = SEQS.h; updateSeq(true); }
    }, 'sat'),
    modeGetter({
      name: '행성 주기 규칙', tag: '탐구 재현',   // R5: 2줄 안 (예전 '행성 자료로 규칙' 은 '규칙' 이 잘림)
      changes: '행성 6개 자료', change: '행성 6개의 거리 a와 공전 주기 T', fixed: '단위 AU · 년',
      values: { mode: 'kepler', gaxis: 'lin', kzoom: 'all', kguide: true },
      predict: { place: 'top', question: '태양에서 멀리 있는 행성일수록 공전 주기(1년의 길이)는 어떻게 될까?', choices: ['거리만큼 길어진다', '거리보다 더 많이 길어진다', '거리와 상관없다'],
        answer: 2, why: 'T² ∝ a³이라서 T는 a보다 더 빨리 커져요. 거리가 4배면 주기는 8배예요.',
        afterHint: '자료 카드를 보고 표를 채워요' },
      onApply: function () { seq = null; kClear(); updateSeq(true); }
    }, 'kepler'),
    modeGetter({
      name: '3 km/s로 쏘면?', tag: '대표 문항',
      changes: '천체: 달', change: '중심 천체 (달 → 화성 → 지구)', fixed: '발사 속력 v₀ 3 km/s',
      values: { mode: 'cannon', body: 'moon', v0: 3, tscale: 10, cview: 'far', trail: true, arrows: true },
      predict: { question: '3 km/s로 쏘면 어느 천체에서 포탄이 탈출할까?', choices: ['달', '화성', '지구', '모두 떨어진다'],
        judge: judgeIf(function (p) { return p.mode === 'cannon' && Math.abs(p.v0 - 3) < 0.05 && p.body !== 'jupiter'; }, 1),
        why: '탈출 속도가 달 2.4, 화성 5.0, 지구 11.2 km/s예요. 3 km/s보다 작은 달에서만 탈출해요. 질량이 작은 천체일수록 탈출하기 쉬워요.',
        afterHint: '달 → 화성 → 지구 순서로 쏴요' },
      onApply: function () { seq = SEQS.b; updateSeq(true); }
    }, 'cannon')
  ]);

  /* 순서 칩: 지금 바꾸는 값의 수치 칸 바로 아래 한 줄 — [4][6][7.9✓][10][11.2]  [다음: 10 km/s ▶] */
  seqEl = h('div', { class: 'og-seq', hidden: true, role: 'group', 'aria-label': '순서대로 바꿔 보기' });
  var seqKey = '';
  function sameRec(r, v) { return r.params[seq.key] === v && (seq.key === 'body' || seq.mode !== 'cannon' || r.params.body === SK.get('body')); }
  function updateSeq(force) {
    if (!seqEl) return;
    if (!seq || seq.mode !== curMode || (seq.mode === 'cannon' && seq.key !== 'body' && SK.get('body') === 'jupiter')) { if (!seqEl.hidden) seqEl.hidden = true; seqKey = ''; return; }
    var now = SK.get(seq.key), idx = -1;
    seq.vals.forEach(function (v, i) { if (v === now) idx = i; });
    var recd = SK.records.some(function (r) { return sameRec(r, now); });
    var key = [seq.id, now, SK.running, SK.finished, SK.records.length, recd, SK.get('body')].join('|');
    if (!force && key === seqKey && seqEl.parentNode) return;
    seqKey = key;
    var host = SK.controls[seq.key] && SK.controls[seq.key].el;
    if (host && seqEl.parentNode !== host) host.appendChild(seqEl);
    seqEl.hidden = false; seqEl.innerHTML = '';
    var row = h('div', { class: 'og-seq__row' });
    var all = true;
    seq.vals.forEach(function (v, i) {
      var done = SK.records.some(function (r) { return sameRec(r, v); });
      if (!done) all = false;
      var b = h('button', { class: 'og-seq__chip' + (i === idx ? ' is-now' : '') + (done ? ' is-done' : ''), type: 'button', 'aria-pressed': String(i === idx),
        title: (seq.tip ? seq.tip(v) + ' · ' : '') + (done ? '기록했어요' : '아직 기록 안 함') }, (done ? '✓ ' : '') + seq.label(v));
      SK.iconify(b);   // R4: ✓ → 아이콘
      b.addEventListener('click', function (e) { if (e.detail) b.blur(); goSeq(v); });
      row.appendChild(b);
    });
    var next = idx < seq.vals.length - 1 ? seq.vals[idx + 1] : null;
    if (idx < 0) next = seq.vals[0];
    if (next !== null) {
      var why = SK.running ? '실행이 끝난 뒤에 넘어가요' : (SK.finished && !recd && idx >= 0 ? '먼저 위 기록하기를 눌러요' : '');
      var nb = h('button', { class: 'btn btn--secondary btn--sm og-seq__next' + (why ? ' is-blocked' : ''), type: 'button', 'aria-disabled': why ? 'true' : 'false',
        title: why || ('다음 값으로 바꿔요 — ' + (seq.tip ? seq.tip(next) : seq.label(next) + seq.unit)) }, '다음: ' + seq.label(next) + seq.unit + ' ▶');
      SK.iconify(nb);
      nb.addEventListener('click', function (e) { if (e.detail) nb.blur(); if (why) { SK.notice(why, 'info'); return; } goSeq(next); });
      row.appendChild(nb);
    } else if (all) row.appendChild(SK.iconify(h('span', { class: 'og-seq__done', text: '모두 기록했어요 ✓' })));
    // R6(C3): 칩 줄 단위를 한 번 — 칩 바로 뒤('4 6 7.9 10 11.2 km/s')
    if (seq.unit && seq.unit.trim()) {
      var unitEl = h('span', { class: 'og-seq__unit', text: seq.unit.trim() });
      var firstNext = row.querySelector('.og-seq__next, .og-seq__done');
      if (firstNext) row.insertBefore(unitEl, firstNext); else row.appendChild(unitEl);
    }
    seqEl.appendChild(SK.iconify(h('p', { class: 'og-seq__title', text: '순서대로 바꿔 쏘기 · ✓ = 기록함' }), { all: true }));
    seqEl.appendChild(row);
  }
  function goSeq(v) {
    if (!seq || SK.running) { if (SK.running) SK.notice('실행이 끝나거나 ⏸ 멈춘 뒤에 바꿔요', 'info'); return; }
    SK.set(seq.key, v, { silent: true });
    applyExtra(seq, v);
    if (seq.key === 'alt') updateAltNote();
    SK.reset();
    updateSeq(true);
  }
  updateSeq(true);

  /* ------------------------------------------------------------------
     16. 설명 도우미 — 도움말(이렇게 해요·개념·용어) · 결과 해설 · 정리 질문
     ------------------------------------------------------------------ */
  var SVG_CANNON = '<svg viewBox="0 0 520 260" xmlns="http://www.w3.org/2000/svg">' +
    '<circle cx="260" cy="320" r="190" style="fill:var(--color-primary-tint);stroke:var(--color-primary);stroke-width:3"/>' +
    '<circle cx="260" cy="320" r="206" style="fill:none;stroke:var(--color-sim-orbit);stroke-width:4"/>' +
    '<path d="M246 132 L260 114 L274 132 Z" style="fill:var(--color-paper-sunk);stroke:var(--color-line-strong);stroke-width:2"/>' +
    '<path d="M262 114 Q320 112 344 150" style="fill:none;stroke:var(--color-warn);stroke-width:4"/>' +
    '<path d="M262 114 Q380 106 410 196" style="fill:none;stroke:var(--color-warn);stroke-width:4;stroke-dasharray:10 6"/>' +
    '<path d="M262 114 Q400 84 512 76" style="fill:none;stroke:var(--color-primary);stroke-width:4;stroke-dasharray:3 6"/>' +
    '<text x="300" y="250" style="fill:var(--color-ink);font:500 22px var(--font-sans)">느리면 떨어짐</text>' +
    '<text x="12" y="104" style="fill:var(--color-sim-orbit);font:500 22px var(--font-sans)">7.9 km/s: 한 바퀴</text>' +
    '<text x="508" y="44" text-anchor="end" style="fill:var(--color-primary);font:500 22px var(--font-sans)">11.2 km/s 이상: 탈출</text>' +
    '</svg>';
  var SVG_GRAV = '<svg viewBox="0 0 520 200" xmlns="http://www.w3.org/2000/svg">' +
    '<circle cx="80" cy="100" r="46" style="fill:var(--color-primary-tint);stroke:var(--color-primary);stroke-width:3"/>' +
    '<text x="80" y="108" text-anchor="middle" style="fill:var(--color-ink);font:500 22px var(--font-sans)">지구</text>' +
    '<path d="M80 168 H480" style="stroke:var(--color-line-strong);stroke-width:2"/>' +
    '<text x="80" y="194" text-anchor="middle" style="fill:var(--color-ink-muted);font:500 22px var(--font-sans)">0</text>' +
    '<circle cx="180" cy="100" r="10" style="fill:var(--color-ink)"/><path d="M168 100 H132" style="stroke:var(--color-q-force);stroke-width:8"/>' +
    '<text x="180" y="194" text-anchor="middle" style="fill:var(--color-ink-muted);font:italic 400 24px var(--font-math)">r</text><text x="180" y="66" text-anchor="middle" style="fill:var(--color-copper-text);font:italic 400 24px var(--font-math)">F</text>' +
    '<circle cx="280" cy="100" r="10" style="fill:var(--color-ink)"/><path d="M268 100 H256" style="stroke:var(--color-q-force);stroke-width:8"/>' +
    '<text x="280" y="194" text-anchor="middle" style="fill:var(--color-ink-muted);font:italic 400 24px var(--font-math)">2r</text><text x="280" y="66" text-anchor="middle" style="fill:var(--color-copper-text);font:italic 400 24px var(--font-math)">F/4</text>' +
    '<circle cx="380" cy="100" r="10" style="fill:var(--color-ink)"/><path d="M368 100 H362" style="stroke:var(--color-q-force);stroke-width:8"/>' +
    '<text x="380" y="194" text-anchor="middle" style="fill:var(--color-ink-muted);font:italic 400 24px var(--font-math)">3r</text><text x="380" y="66" text-anchor="middle" style="fill:var(--color-copper-text);font:italic 400 24px var(--font-math)">F/9</text>' +
    '</svg>';
  var SVG_RADIUS = '<svg viewBox="0 0 520 200" xmlns="http://www.w3.org/2000/svg">' +
    '<circle cx="130" cy="110" r="70" style="fill:var(--color-primary-tint);stroke:var(--color-primary);stroke-width:3"/>' +
    '<circle cx="130" cy="110" r="100" style="fill:none;stroke:var(--color-sim-orbit);stroke-width:3;stroke-dasharray:6 6"/>' +
    '<path d="M130 110 L200 110" style="stroke:var(--color-ink);stroke-width:3"/><path d="M200 110 L230 110" style="stroke:var(--color-copper);stroke-width:5"/>' +
    '<circle cx="230" cy="110" r="8" style="fill:var(--color-sim-orbit)"/>' +
    '<text x="250" y="70" style="fill:var(--color-ink);font:500 22px var(--font-sans)">r = 지구 반지름 + 고도</text>' +
    '<text x="250" y="110" style="fill:var(--color-ink-muted);font:500 22px var(--font-sans)">검은 선: 지구 반지름 6,371 km</text>' +
    '<text x="250" y="148" style="fill:var(--color-copper-text);font:500 22px var(--font-sans)">주황 선: 고도 h</text>' +
    '</svg>';

  SK.help({
    inlineTerms: true,
    how: [
      '처음 창에서 실험을 하나 골라요. 패널 맨 위 실험 고르기 버튼으로 언제든 바꿀 수 있어요.',
      '실험 카드를 누르면 값이 바로 바뀌고 예측 질문이 나와요. 답을 고르고 예측하기를 눌러요.',
      '아래 ▶ 실행을 눌러 포탄을 쏘거나(뉴턴의 대포) 위성을 한 바퀴 돌려요(원궤도 위성).',
      '끝나면 위 띠의 기록하기 버튼으로 결과를 저장해요.',
      '패널 수치 칸 아래 순서 칩에서 다음 ▶을 눌러 값 하나만 바꾸고, 다시 실행하고 기록해요.',
      '포탄이 화면 밖으로 나가면 실험 화면 오른쪽 아래 보는 범위를 넓혀요.',
      '비교 단계에서 기록 표를 보고, 정리 단계에서 질문에 답해요.'
    ],
    concepts: [
      { title: '위성은 계속 떨어지고 있어요 — 뉴턴의 대포',
        summary: '빨리 쏠수록 멀리 떨어지다가, 지구에서 7.9 km/s면 땅에 닿지 않고 돌아요.',
        plain: '산꼭대기에서 옆으로 쏜 포탄은 중력 때문에 아래로 휘며 떨어져요.\n빨리 쏠수록 더 멀리 가서 떨어져요.\n아주 빠르면 포탄이 떨어지는 만큼 둥근 땅도 휘어 내려가서, 땅에 닿지 않고 계속 돌아요. 이것이 {{궤도}}예요.\n이 실험은 공기가 없는 약 20 km 높이 산에서 쏴요. 지표에서 7.9 km/s는 거의 원 궤도 속력이에요.',
        example: '4 km/s → 수백 km 날아가 떨어짐 · 7.9 km/s → 원을 그리며 한 바퀴 · 10 km/s → 길쭉한 타원 · 11.2 km/s 이상 → 돌아오지 않음',
        figure: SVG_CANNON,
        why: '중력은 늘 지구 중심을 향해요. 원 궤도에서는 중력이 속도와 직각이라 빠르기는 그대로이고 방향만 바뀌어요.\n그래서 위성은 "안 떨어지는" 것이 아니라 "계속 떨어지면서 옆으로 비껴 가는" 거예요.\n흔한 오해: "빨리 쏘면 중력을 덜 받는다" → 아니에요. 중력은 속력과 상관없이 똑같이 작용해요. 빠르면 떨어지는 동안 옆으로 더 멀리 갈 뿐이에요.' },
      { title: '원 궤도 속력 — 높을수록 느려요',
        summary: '원 궤도 속력 v = √(GM/r). 높이 있는 위성일수록 느리게 돌고, 위성 질량과는 상관없어요.',
        plain: 'r = 지구 중심까지 거리 = 지구 반지름 6,371 km + 고도\n중력이 원운동에 필요한 힘({{구심력}}) 역할을 해요.\nr이 클수록 중력이 약해서, 느리게 돌아도 궤도를 지킬 수 있어요.',
        example: 'ISS(고도 400 km, r = 6,771 km) 7.7 km/s · 정지궤도(고도 35,786 km, r = 42,157 km) 3.1 km/s',
        figure: SVG_RADIUS,
        formula: 'v = √(GM / r)',
        symbols: [
          { s: 'v', meaning: '원 궤도를 도는 위성의 속력', unit: 'm/s' },
          { s: 'G', meaning: '중력 상수 6.67×10⁻¹¹', unit: 'N·m²/kg²' },
          { s: 'M', meaning: '지구의 질량 5.97×10²⁴ kg', unit: 'kg' },
          { s: 'r', meaning: '지구 중심에서 위성까지 거리 (지구 반지름 + 고도)', unit: 'm' }
        ],
        why: '중력 = 구심력이라서 GMm/r² = mv²/r 이에요.\n양쪽에 있는 위성 질량 m이 지워져 v² = GM/r, 곧 v = √(GM/r)이 돼요.\nm이 지워지는 까닭: 무거운 위성은 중력도 m배 크지만, 움직임을 바꾸기도 m배 어려워서(관성) 둘이 상쇄돼요.\n흔한 오해: "높이 있는 위성이 더 빨라야 떨어지지 않는다" → 반대예요. 높으면 중력이 약해서 느려도 돼요.',
        live: function (p) {
          if ((p.mode || curMode) === 'sat') { var s = satCalc(p.alt); return '지금: r = 6,371 + ' + comma(p.alt) + ' = ' + comma(6371 + p.alt) + ' km → v = ' + SK.fmt(s.v, 2) + ' km/s'; }
          var b = BODIES[p.body] || EARTH; return '지금: ' + b.name + ' 표면 바로 위 → v = √(GM/R) = ' + SK.fmt(b.vCirc, 2) + ' km/s';
        } },
      { title: '주기 — 한 바퀴 도는 데 걸리는 시간',
        summary: '높은 위성은 돌 길도 길고 속력도 느려서, 주기가 훨씬 길어요.',
        plain: '{{주기}}는 한 바퀴 도는 데 걸리는 시간이에요.\n한 바퀴 길이(원둘레 2πr)를 속력 v로 나누면 돼요.',
        example: 'ISS 약 92분 · GPS 위성(고도 20,200 km) 약 12시간 · 정지궤도 약 23.9시간(하루)',
        formula: 'T = 2πr / v',
        symbols: [
          { s: 'T', meaning: '주기 (한 바퀴 시간)', unit: 's' },
          { s: 'r', meaning: '지구 중심에서 위성까지 거리', unit: 'm' },
          { s: 'v', meaning: '위성의 속력', unit: 'm/s' }
        ],
        why: 'v = √(GM/r)를 T = 2πr/v에 넣으면 T² = (4π²/GM) r³이에요.\n그래서 r이 4배가 되면 T는 8배가 돼요(케플러 제3법칙과 같은 식).',
        live: function (p) { var s = satCalc(p.alt); return '고도 ' + comma(p.alt) + ' km → T = ' + periodText(s.T); } },
      { title: '탈출 속도 — 돌아오지 않는 속력',
        summary: '지구에서 11.2 km/s 이상으로 쏘면 돌아오지 않아요. 원 궤도 속력의 약 1.41배예요.',
        plain: '빨리 쏠수록 더 멀리 갔다가 돌아와요.\n{{탈출 속도}} 이상이면 중력이 속력을 줄이긴 해도 0까지 줄이지 못해서 영영 돌아오지 않아요.\n질량이 크고 반지름이 작은 천체일수록 탈출 속도가 커요.',
        example: '지구 11.2 · 달 2.4 · 화성 5.0 · 목성 59.5 km/s',
        formula: 'v = √(2GM / R)',
        symbols: [
          { s: 'v', meaning: '탈출 속도', unit: 'm/s' },
          { s: 'G', meaning: '중력 상수 6.67×10⁻¹¹', unit: 'N·m²/kg²' },
          { s: 'M', meaning: '출발하는 천체의 질량', unit: 'kg' },
          { s: 'R', meaning: '천체 중심에서 출발점까지 거리 (지표면이면 천체 반지름)', unit: 'm' }
        ],
        why: '처음 운동 에너지 ½mv²가 중력을 이기고 아주 멀리 가는 데 드는 에너지 GMm/R과 같으면 돼요.\n½mv² = GMm/R → v = √(2GM/R) (여기서도 m이 지워져요).\n원 궤도 속력 √(GM/R)과 비교하면 √2 ≈ 1.41배예요.\n흔한 오해: 탈출 속도는 로켓이 계속 내야 하는 속력이 아니라, 엔진 없이 한 번 쏠 때 필요한 처음 속력이에요.',
        live: function (p) { var b = BODIES[p.body] || EARTH; return '지금: ' + b.name + ' 탈출 속도 ' + SK.fmt(b.vEsc, 1) + ' km/s · 원 궤도 속력 ' + SK.fmt(b.vCirc, 1) + ' km/s'; } },
      { title: '중력은 거리의 제곱에 반비례해요',
        summary: '멀어지면 중력은 약해질 뿐, 0이 되지는 않아요.',
        plain: '지구 중심에서 거리가 2배면 중력은 1/4, 3배면 1/9로 줄어요.\n국제우주정거장(ISS, 고도 400 km)에서도 중력은 지표의 약 89%예요.',
        example: '우주인이 둥둥 떠 보이는 것은 중력이 없어서가 아니라, 우주정거장과 함께 떨어지고 있어서예요.',
        figure: SVG_GRAV,
        formula: 'F = GMm / r²',
        symbols: [
          { s: 'F', meaning: '위성이 받는 중력의 크기', unit: 'N' },
          { s: 'G', meaning: '중력 상수 6.67×10⁻¹¹', unit: 'N·m²/kg²' },
          { s: 'M', meaning: '지구의 질량', unit: 'kg' },
          { s: 'm', meaning: '위성의 질량', unit: 'kg' },
          { s: 'r', meaning: '지구 중심에서 위성까지 거리', unit: 'm' }
        ],
        why: '우주정거장과 우주인이 똑같은 가속도로 함께 떨어지니, 바닥이 우주인을 받쳐 주지 않아요. 그래서 몸무게를 느끼지 못해요(무중량).\n흔한 오해: "우주는 무중력이라 위성이 떠 있다" → 중력은 어디에나 있어요. 달이 지구를 도는 것도 지구 중력 때문이에요.',
        live: function (p) { var s = satCalc(p.alt); return '고도 ' + comma(p.alt) + ' km: r = 지구 반지름의 ' + SK.fmt(s.rR, 2) + '배 → 중력은 지표의 ' + pctText(s.g) + '%'; } },
      { title: '케플러 제3법칙 — T² ∝ a³',
        summary: '태양에서 먼 행성일수록 1년이 훨씬 길어요. 거리 4배면 주기는 8배예요.',
        plain: 'a는 궤도 반지름(타원이면 {{긴반지름}}), T는 공전 주기예요.\n태양계 행성은 a를 {{AU}}, T를 년으로 쓰면 T²/a³이 거의 1로 같아요.',
        example: '목성 a = 5.2 AU → a³ ≈ 141 → T = √141 ≈ 11.9년',
        formula: 'T² = k a³',
        symbols: [
          { s: 'T', meaning: '공전 주기', unit: '년' },
          { s: 'a', meaning: '궤도 긴반지름 (태양까지 평균 거리)', unit: 'AU' },
          { s: 'k', meaning: '비례 상수 (태양계, AU·년 단위로 약 1)', unit: '년²/AU³' }
        ],
        why: '원 궤도라면 T² = (4π²/GM) r³이에요. 비례 상수는 가운데 천체(태양)의 질량 M으로만 정해져요.\n그래서 같은 태양을 도는 천체는 모두 같은 값을 가져요. 지구를 도는 위성들은 지구 질량으로 정해지는 다른 값을 가져요.',
        live: function () { var st = kStats(); return st.n ? '표에 넣은 ' + st.n + '개 행성의 T²/a³ 평균 = ' + SK.fmt(st.mean, 2) : '표에 행성 자료를 넣으면 평균이 나와요'; } }
    ],
    terms: {
      '발사 속력': { def: '포탄을 쏘는 처음 빠르기 v₀ (km/s). 1 km/s는 1초에 1,000 m를 가는 빠르기예요.', short: '쏘는 처음 빠르기' },
      '궤도': { def: '위성이나 행성이 다른 천체 둘레를 도는 길. 원 궤도와 타원 궤도가 있어요.', short: '천체 둘레를 도는 길' },
      '원 궤도 속력': { def: '같은 고도를 지키며 원을 그리며 도는 속력. 지구 표면 근처에서 7.9 km/s예요.', short: '원을 그리며 도는 속력' },
      '탈출 속도': { def: '이 속력 이상으로 쏘면 천체의 중력을 이기고 돌아오지 않아요. 지구 11.2 km/s.', short: '돌아오지 않는 최소 속력' },
      '고도': { def: '땅(지표)에서 잰 높이 h. 높이와 같은 말이에요. 지구 중심까지 거리 r = 지구 반지름 + 고도.', short: '땅에서 잰 높이', alias: ['높이'] },
      '시간 배속': { def: '화면 1초 동안 실제로 흐르는 시간. 위성은 실제로 오래 걸려서 빨리 감아 보여 줘요.', short: '화면 1초에 흐르는 실제 시간' },
      'R': { def: '중심 천체의 반지름. 1 R = 반지름 1개 길이(지구는 약 6,400 km).', short: '천체 반지름' },
      '주기': { def: '한 바퀴 도는 데 걸리는 시간 T.', short: '한 바퀴 시간' },
      '구심력': { def: '원운동을 하게 만드는, 원의 중심 쪽을 향하는 힘. 위성에서는 중력이 이 역할을 해요.', short: '원의 중심 쪽 힘' },
      '정지궤도': { def: '주기가 지구 자전과 같은(약 하루) 원 궤도. 적도 위 고도 약 35,786 km에서 늘 같은 곳 위에 떠 있어요.', short: '하루에 한 바퀴 도는 궤도' },
      'AU': { def: '천문단위. 지구와 태양 사이 평균 거리, 약 1억 5천만 km.', short: '지구–태양 거리' },
      '긴반지름': { def: '타원의 가장 긴 지름의 절반. 원이면 반지름과 같아요.', short: '긴 지름의 절반' }
    },
    keys: [['V', '속도·중력 화살표 켜고 끄기'], ['O', '궤적 남기기 켜고 끄기'], ['N', '중심 천체 바꾸기 (대포)'], ['G', '그래프 축 바꾸기'], ['Z', '보는 범위 바꾸기']]
  });
  /* 용어 탭: 지금 모드 화면에 나오는 용어만, 나오는 순서대로 (공통 틀은 넣은 순서 그대로 다 보여 주므로 여기서 거른다) */
  (function () {
    var baseToggle = SK.toggleHelp;
    function filterTerms() {
      var dl = document.querySelector('.drawer--help .term-list');
      if (!dl) return;
      var want = MODE_TERMS[curMode] || [], items = {};
      var dts = dl.querySelectorAll('dt');
      for (var i = 0; i < dts.length; i++) items[dts[i].textContent] = [dts[i], dts[i].nextElementSibling];
      Object.keys(items).forEach(function (k) { var on = want.indexOf(k) >= 0; items[k][0].hidden = !on; if (items[k][1]) items[k][1].hidden = !on; });
      want.forEach(function (k) { if (items[k]) { dl.appendChild(items[k][0]); if (items[k][1]) dl.appendChild(items[k][1]); } });
    }
    SK.toggleHelp = function (on, tab) { baseToggle(on, tab); filterTerms(); };
  })();

  /** 실행이 끝나면 패널 맨 위 '이번 실험 결과': 한 줄(새 정보) + 왜 그럴까?(전문). 판정 문장과 겹치지 않게 */
  SK.takeaway(function (p) {
    if (curMode === 'kepler') {
      var st = kStats();
      return { line: 'T²/a³ 평균 ' + SK.fmt(st.mean, 2) + ' — 여섯 행성이 거의 같아요', more: '케플러 제3법칙 T² ∝ a³이에요. 같은 태양의 중력이 모든 행성을 끌어당기기 때문에 비례 상수가 같아요(AU·년 단위로 약 1).' };
    }
    if (curMode === 'sat') {
      var s = satCalc(p.alt), line = '고도 ' + comma(p.alt) + ' km: 속력 ' + SK.fmt(s.v, 2) + ' km/s, 주기 ' + periodText(s.T);
      if (Math.abs(p.alt - 400) < 1) return { line: line, more: 'ISS도 계속 떨어지고 있지만, 옆으로 ' + SK.fmt(s.v, 1) + ' km/s로 달려서 땅이 같이 휘어 멀어져요. 중력은 지표의 ' + pctText(s.g) + '% — 무중력이 아니라 함께 떨어지는 상태예요. 위성 질량을 바꿔도 속력·주기는 그대로예요.' };
      if (Math.abs(p.alt - 35786) < 1) return { line: line, more: '주기가 지구 자전(약 하루)과 같아서 늘 같은 곳 위에 떠 있어요(정지궤도). 높을수록 중력이 약해 느리게 돌고, 돌 길도 길어져 주기가 길어요.' };
      return { line: line, more: 'r = 지구 반지름 6,371 km + 고도 = ' + comma(6371 + p.alt) + ' km. 높을수록 중력이 약해 느리게 돌고, 돌 길도 길어져 주기가 길어요.' };
    }
    if (!cn || !cn.res) return null;
    var b = cn.b, v0 = SK.fmt(p.v0, 1) + ' km/s', vc = SK.fmt(b.vCirc, 1) + ' km/s', ve = SK.fmt(b.vEsc, 1) + ' km/s';
    var where = b.key === 'earth' ? '' : ' (' + b.name + ')';
    if (cn.res === '추락') return { line: '발사 속력 ' + v0 + ' — 원 궤도 속력 ' + vc + '보다 느려요' + where,
      more: '떨어지는 만큼 땅이 충분히 휘어 내려가지 못해 땅에 닿았어요. ' + comma(cn.dist) + ' km 날아갔고, 떨어질 때 속력은 ' + SK.fmt(cn.vImp, 2) + ' km/s — 떨어지는 동안 중력이 끌어당겨 처음보다 빨라져요.' };
    if (cn.res === '원 궤도') return { line: '발사 속력 ' + v0 + ', 탈출 속도는 ' + ve + where,
      more: '포탄은 계속 떨어지지만 그만큼 둥근 땅도 휘어 내려가 고도가 그대로예요. 한 바퀴에 약 ' + fmtDur(cn.t) + ' — 이것이 인공위성이에요.' };
    if (cn.res === '타원 궤도') return { line: '발사 속력 ' + v0 + ' — 원 궤도 속력보다 빠르고 탈출 속도(' + ve + ')보다 느려요',
      more: '멀리 올라갔다가 다시 돌아오는 타원 궤도예요. 쏜 곳이 궤도에서 가장 낮은 곳이 돼요.' };
    if (cn.res === '탈출') return { line: '발사 속력 ' + v0 + ' — 탈출 속도 ' + ve + ' 이상이에요' + where,
      more: '중력이 속력을 줄이지만 0까지 줄이지 못해 돌아오지 않아요. 탈출 속도는 원 궤도 속력의 √2 ≈ 1.41배예요.' };
    return { line: '발사 속력 ' + v0 + ' — 탈출 속도 ' + ve + '보다 조금 느려요', more: '아주 멀리 갔다가 언젠가 돌아오는 긴 타원이에요. 조금만 더 빠르면 탈출해요.' };
  });

  /* 정리 질문 (모드별: when) — 보기형은 답을 누르면 이유가 바로, 서술형은 힌트 → 모범 답 */
  function inMode() { var ms = Array.prototype.slice.call(arguments); return function (p) { return ms.indexOf((p && p.mode) || curMode) >= 0; }; }
  SK.think({ id: 'g-zero', when: inMode('cannon', 'sat'), q: '로켓이 아주 높이 올라가면 지구 중력이 0이 될까?', choices: ['0이 된다', '약해지지만 0은 아니다', '오히려 세진다'], answer: 2,
    why: '중력은 거리의 제곱에 반비례(F = GMm/r²)해서 줄어들 뿐 0이 되지 않아요. ISS 높이에서도 지표의 89%, 정지궤도에서도 2.3%가 남아 있어요. "우주는 무중력"은 흔한 오해예요.' });
  SK.think({ id: 'c-fall', when: inMode('cannon'), q: '7.9 km/s로 쏜 포탄이 땅에 떨어지지 않는 까닭은?', choices: ['그 높이에서는 중력이 사라져서', '떨어지는 만큼 땅이 둥글게 휘어 멀어져서', '너무 빨라서 중력을 안 받아서'], answer: 2,
    why: '포탄은 계속 중력을 받아 떨어지고 있어요. 다만 옆으로 아주 빨라서, 떨어지는 만큼 땅도 둥글게 휘어 내려가 고도가 그대로예요. 중력은 속력과 상관없이 작용해요.' });
  SK.think({ id: 'c-mars', when: inMode('cannon'), q: '화성의 탈출 속도(5.0 km/s)가 지구(11.2 km/s)보다 작은 까닭을 v = √(2GM/R)로 설명해 봐요.',
    hint: 'M(질량)과 R(반지름)이 지구의 몇 배인지 천체 비교 표에서 찾아봐요.',
    reveal: '<b>모범 답</b> 화성은 질량 M이 지구의 약 0.11배, 반지름 R은 약 0.53배예요. M/R이 지구의 약 0.2배라서 탈출 속도는 √0.2 ≈ 0.45배, 약 5 km/s예요.<br><b>해설</b> 반지름이 작아지면 탈출 속도가 커지지만, 질량이 훨씬 더 많이 작아서 결과적으로 작아져요.' });
  SK.think({ id: 's-mass', when: inMode('sat'), q: '같은 높이에서 10,000 kg 위성과 100 kg 위성이 돌면?', choices: ['무거운 쪽이 빨리 돈다', '같은 빠르기로 돈다', '가벼운 쪽이 빨리 돈다'], answer: 2,
    why: 'GMm/r² = mv²/r에서 위성 질량 m이 지워져 v = √(GM/r)이에요. 무거우면 중력도 크지만 그만큼 움직임을 바꾸기도 어려워(관성) 상쇄돼요.' });
  SK.think({ id: 's-float', when: inMode('sat'), q: '국제우주정거장 안의 우주인이 둥둥 떠 있는 까닭은?', choices: ['우주에는 중력이 없어서', '우주정거장과 우주인이 함께 떨어지고 있어서', '공기가 없어서'], answer: 2,
    why: '그 높이에서도 중력은 지표의 89%예요. 우주정거장과 우주인이 똑같이 떨어지니 바닥이 우주인을 받치지 않아 떠 보여요. 줄이 끊긴 엘리베이터 안에서 함께 떨어질 때와 같아요.' });
  SK.think({ id: 's-geo', when: inMode('sat'), q: '정지궤도 위성은 왜 모두 같은 높이(약 35,786 km)에 있을까?',
    hint: '늘 같은 곳 위에 있으려면 주기가 얼마여야 할까요? 주기가 정해지면 r은?',
    reveal: '<b>모범 답</b> 늘 같은 곳 위에 있으려면 지구 자전과 같은 주기(약 23.9시간)로 돌아야 해요. T² ∝ r³이라 주기가 정해지면 거리 r도 하나로 정해져요 → 지구 중심에서 약 42,200 km(지구 반지름의 6.6배), 고도 약 35,800 km.<br><b>해설</b> 위성 질량은 주기에 영향을 주지 않으니, 큰 위성이든 작은 위성이든 높이가 같아요.' });
  SK.think({ id: 'k-mean', when: inMode('kepler'), q: '모든 행성에서 T²/a³이 1로 같다는 것은 무엇을 뜻할까?',
    hint: 'T² = (4π²/GM) a³에서 M은 누구의 질량일까요?',
    reveal: '<b>모범 답</b> 모든 행성이 같은 태양 하나의 중력으로 돈다는 뜻이에요. 비례 상수 4π²/GM은 태양 질량 M으로만 정해져서, 태양을 도는 천체라면 행성이든 소행성이든 같은 값(AU·년 단위로 1)이에요.' });
  SK.think({ id: 'k-four', when: inMode('kepler'), q: '태양에서 4 AU 떨어져 도는 소행성의 공전 주기는?', choices: ['4년', '8년', '16년', '64년'], answer: 2,
    why: 'T² = a³ = 4³ = 64 → T = √64 = 8년. 거리가 4배여도 주기는 4배가 아니라 8배예요.' });

  /* ------------------------------------------------------------------
     17. 실행·기록 가로채기 (케플러·목성) · 전용 키
     ------------------------------------------------------------------ */
  var basePlay = SK.play, baseRecord = SK.record;
  SK.play = function () {
    if (curMode === 'kepler') { SK.notice('표에 숫자를 넣으면 그래프가 그려져요', 'info'); return; }
    if (curMode === 'cannon' && SK.params.body === 'jupiter') { SK.notice('목성은 발사 속력 범위 밖이에요', 'warn'); return; }
    basePlay();
  };
  SK.record = function () {
    if (curMode === 'kepler') { SK.notice('케플러 자료는 표 자체가 기록이에요', 'info'); return; }
    if (curMode === 'cannon' && SK.params.body === 'jupiter') { SK.notice('목성은 기록할 결과가 없어요', 'info'); return; }
    var wasRun = SK.stepIndex === 1;
    baseRecord();
    // 공통 틀은 기록이 2개가 되면 비교 단계로 넘어간다. 순서 칩이 아직 남았으면 실행 단계에 머물러
    // 패널의 [다음 ▶]을 계속 보이게 한다(비교는 띠의 '비교하러 가기 ▸'로)
    if (wasRun && SK.stepIndex === 2 && seq && seq.mode === curMode && seq.vals.some(function (v) { return !SK.records.some(function (r) { return sameRec(r, v); }); })) SK.goStep(1);
  };
  SK.onKey(function (e) {
    if (e.repeat) return false;
    switch (e.code) {
      case 'KeyV': if (curMode === 'kepler') return false; SK.set('arrows', !SK.get('arrows')); SK.notice('속도·중력 화살표 ' + (SK.get('arrows') ? '켬' : '끔'), 'info', 1200); return true;
      case 'KeyO': if (curMode === 'kepler') return false; SK.set('trail', !SK.get('trail')); SK.notice('궤적 남기기 ' + (SK.get('trail') ? '켬' : '끔'), 'info', 1200); return true;
      case 'KeyN':
        if (curMode !== 'cannon') { SK.notice('중심 천체는 뉴턴의 대포에서 바꿔요', 'info', 1500); return true; }
        var i = BODY_ORDER.indexOf(SK.get('body'));
        SK.set('body', BODY_ORDER[(i + 1) % BODY_ORDER.length]);
        return true;
      case 'KeyG':
        if (curMode === 'cannon') return false;
        SK.set('gaxis', SK.get('gaxis') === 'sq' ? 'lin' : 'sq');
        return true;
      case 'KeyZ':
        if (curMode === 'kepler') { SK.set('kzoom', SK.get('kzoom') === 'all' ? 'inner' : 'all'); return true; }
        if (curMode !== 'cannon') return false;
        var vs = ['near', 'earth', 'far'], vi = vs.indexOf(SK.get('cview'));
        SK.set('cview', vs[(vi + 1) % vs.length]);
        SK.notice('보는 범위: ' + VIEW_NAME[SK.get('cview')], 'info', 1200);
        return true;
    }
    return false;
  });

  /* ------------------------------------------------------------------
     18. 수업 안내 서랍 (요구 D 대응표 — 결정서 §4-4 와 같은 내용)
     ------------------------------------------------------------------ */
  SK.guide({
    rows: [
      { target: '발사 속력 v₀ (대포) · 0~12 km/s, 한 번에 0.1, 기본 6.0 · 다시 실행', standard: '[12역학01-03] 힘 방향과 운동 방향, [12역학01-05] 탈출', discover: '7.9 km/s면 원 궤도, 그 사이는 타원, 11.2 km/s를 넘으면 탈출', misconception: '위성은 떨어지지 않는다' },
      { target: '고도 h (위성) · 200~36,000 km, 한 번에 100, 기본 400 (r = 6,371 km + 고도 병기) · 다시 실행', standard: '[12역학01-04] 원운동 정량', discover: '높을수록 느리게 돌고 주기가 길다, T² ∝ r³', misconception: '높이 있을수록 빨리 돈다' },
      { target: '위성 질량 m · 100~10,000 kg, 한 번에 100, 기본 1,000 · 다시 실행', standard: '변인 통제', discover: '속력·주기 그대로', misconception: '무거우면 빨리 돌아야 한다' },
      { target: '중심 천체 (상황) · 지구 / 달 / 화성 / 목성(비교 표만) · 다시 실행', standard: '[12역학01-05]', discover: '질량·반지름이 다르면 탈출 속도가 다르다', misconception: '높이 올라가면 중력이 없어진다' },
      { target: '행성 자료 입력 (케플러) · a(AU), T(년) 6행 · 바로 반영', standard: '탐구 활동: 행성 관측 데이터로 케플러 법칙 확인하기', discover: 'T²–a³가 직선(기울기 1)', misconception: '—' },
      { target: '실험 고르기 · 뉴턴의 대포 / 원궤도 위성 / 케플러 자료', standard: '[12역학01-03·05] / [12역학01-04] / 탐구 활동', discover: '한 차시에 실험 하나', misconception: '—' },
      { target: '속도·중력 화살표', standard: '[12역학01-03]', discover: '중력은 늘 중심을 향하고, 원 궤도에서는 속도와 직각', misconception: '위성에는 힘이 작용하지 않는다(우주는 무중력)' },
      { target: '궤적 남기기 · 이전 발사 궤적 색 + 선 모양 + 기호', standard: '[12역학01-03]', discover: '속력을 올릴수록 더 멀리 떨어지다가 결국 돈다', misconception: '위성은 떨어지지 않는다' },
      { target: '그래프 축 T–a / T²–a³', standard: '[12역학01-04] · 탐구 활동', discover: 'T–a는 곡선, T²–a³는 원점을 지나는 직선', misconception: '—' },
      { target: '보는 범위 (대포) · 산 근처 / 지구 전체 / 타원까지 · 표시만 바뀜', standard: '[12역학01-03]', discover: '산 근처: 4·6 km/s는 떨어지고 7.9 km/s는 땅이 휘는 만큼 떨어져 고도가 그대로 / 타원까지: 10 km/s 타원 전체 모양', misconception: '빨리 쏘면 떨어지지 않고 곧게 날아간다' },
      { target: '시간 배속 (대포) · 1초 = 30초 / 2분 / 10분 / 30분 · 바로 반영', standard: '수업 운영', discover: '짧은 낙하는 30초, 한 바퀴는 10분, 타원은 30분이 알맞아요(순서 칩이 저절로 맞춤)', misconception: '—' }
    ],
    sections: [
      { title: '학생이 발견할 것', items: [
        '① 위성은 계속 떨어지고 있다 (중력 = 구심력, 속도와 직각)',
        '② 높을수록 느리고 주기가 길다, T² ∝ r³',
        '③ 궤도 속력·주기는 위성 질량과 무관하다',
        '④ 지구에서 7.9 km/s면 돈다, 11.2 km/s를 넘으면 돌아오지 않는다',
        '⑤ 탈출 속도는 천체마다 다르다 (지구 11.2 · 달 2.4 · 화성 5.0 · 목성 59.5 km/s)',
        '⑥ ISS 높이(400 km)에서도 중력은 지표의 89%다'
      ] },
      { title: '수업 단계', items: [
        '예측: 실험을 고르면 첫 카드의 예측 질문이 저절로 떠요 (교사 모드에서 끌 수 있어요)',
        '실행: 대포는 패널 순서 칩으로 4 → 11.2 km/s 차례로 / 위성은 고도·질량을 하나씩 바꿔 기록',
        '비교: 기록 표에서 고도가 높을수록 속력은 작고 주기는 길다, 케플러는 T²–a³ 직선',
        '정리: "높이 올라가면 중력이 0?"(심화 거리–중력 그래프), "정지궤도는 왜 같은 높이?"'
      ] },
      { title: '모델·축척 (확인용)', items: [
        '대포: a = −GM r̂/r², RK4, 한 단계 1 s 이하, 화면 1초 = 2분(기본, 30초~30분 선택). 보는 범위: 산 근처(1 km = 0.75u, 실제 축척) / 지구 전체(화면 반폭 4R) / 타원까지(1 R = 110u, 10 km/s 타원 전체).',
        '같은 기록을 세 범위로 다시 볼 수 있어요. 궤적은 천체 반지름 단위라, 다른 천체 기록은 그림에 겹치지 않고 표로만 비교해요.',
        '대포는 공기 없는 산꼭대기(높이 20 km)에서 수평 발사. 지표(r = R)에서 7.9 km/s로 쏘면 원 궤도 속력 7.91 km/s보다 조금 느려 땅속으로 들어가므로, 20 km 높이에서 쏘게 했어요(원 궤도 속력 7.90 km/s).',
        '추락: r < R − 1 km · 궤도: 한 바퀴(2π) · r > 6R 에서 v² ≥ 2GM/r 이면 탈출, 아니면 \'먼 타원\'(10.4~11.1 km/s). 타원은 모양만 보여 주고 최고 고도·주기는 표시하지 않아요.',
        '위성: 해석해 v = √(GM/r), T = 2πr/v, 중력 비율 (R/r)². 한 바퀴 = 화면 10초(ISS 1초 ≈ 9분, 정지궤도 1초 ≈ 2.4시간).',
        '상수: G = 6.674×10⁻¹¹, 지구 5.972×10²⁴ kg · 6,371 km, 달 7.342×10²² kg · 1,737 km, 화성 6.417×10²³ kg · 3,390 km, 목성 1.898×10²⁷ kg · 71,492 km(적도).',
        '기록·직전 실행은 실험(모드)마다 따로 보관돼요(바꿨다 돌아오면 다시 보여요).'
      ] }
    ]
  });

  /* ------------------------------------------------------------------
     19. 첫 화면 실험 고르기 → 그 실험의 첫 카드 적용 → 예측 창(공통 autoPredict)
     ------------------------------------------------------------------ */
  modeCtl = SK.chooseMode({
    title: '무엇을 알아볼까요?', place: 'top',   // R5: 대포·지구가 아래쪽이라 창은 위
    default: 'cannon', urlKey: 'mode', key: 'mode',
    modes: [
      { value: 'cannon', label: '뉴턴의 대포', desc: '대포를 점점 세게 쏘아 궤도 찾기' },
      { value: 'sat', label: '원궤도 위성', desc: '위성을 원 궤도에 올려 보기' },
      { value: 'kepler', label: '케플러 자료', desc: '케플러 법칙 표로 익히기 (행성 자료)' }
    ],
    onPick: function (v) {
      var changed = SK.get('mode') !== v;
      if (changed) SK.set('mode', v);
      // 실험이 바뀌면 그 실험의 첫 카드를 적용(값이 바로 바뀜) → 공통 틀이 예측 창을 띄운다.
      // 같은 실험이면 공통 틀의 autoPredict(지금 카드 → 첫 카드)에 맡긴다.
      if (changed && CFG.autoPredict && !SK.records.length && MODES[v].preset !== undefined) SK.applyPreset(MODES[v].preset);
    }
  });

  /* ------------------------------------------------------------------
     20. R6 심플 모드 — 대포 모드 고정(위성·케플러는 자세히 전용). 들어갈 때 모드를 기억했다가 자세히로 돌아오면 되돌린다.
         속력 띠는 측정 줄의 넓은 칸으로 옮긴다(placeBand). 같은 값·기록 그대로(노드 이동)
     ------------------------------------------------------------------ */
  function onSimple(on) {
    if (on) {
      var m = SK.get('mode');
      if (m !== 'cannon') { preSimpleMode = m; SK.set('mode', 'cannon'); }
    } else if (preSimpleMode) {
      var pm = preSimpleMode; preSimpleMode = null;
      if (SK.get('mode') === 'cannon') SK.set('mode', pm);
    }
    resCell = null;
    // 더 보기 시트: 레일로 옮긴 값(발사 속력·천체)만 있던 '수치 바꾸기'·'상황 바꾸기' 묶음은 빈 머리만 남으므로 숨김
    [SK.panel('values'), SK.panel('situation')].forEach(function (pn) { if (pn && pn.parentNode) pn.parentNode.classList.toggle('og-simple-empty', !!on); });
    placeBand(); drawBand();
    if (curMode === 'cannon' && cn) updateMeters(SK.params);
    SK.requestRender();
  }
  SK.onMode(onSimple);
  setTimeout(function () { if (SK.isSimple()) onSimple(true); }, 0);   // 처음부터 심플(?simple=1·저장값)이면 — 공통 틀의 enterSimple·chooseMode 뒤
})();
