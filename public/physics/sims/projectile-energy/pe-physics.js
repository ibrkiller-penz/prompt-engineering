/* =====================================================================
   포물선 운동과 역학적 에너지 — 물리 계산 (화면과 분리, node 로 검산 가능)
   일반 <script> 로 불러오면 window.PEPhys, node 에서는 require() 로 쓴다.

   단위: m, s, m/s, kg, J.  y 는 지면 기준 높이(위가 +).
   - 공기 저항 끔: 해석해만 쓴다(수치 적분 없음 → K+U 가 출렁이지 않음).
       x = v₀cosθ·t,  y = h + v₀sinθ·t − ½gt²,  vₓ = v₀cosθ,  v_y = v₀sinθ − gt
       T = (v₀sinθ + √(v₀²sin²θ + 2gh)) / g,  R = v₀cosθ·T,  H = h + v₀²sin²θ/(2g),  v착지 = √(v₀² + 2gh)
   - 공기 저항 켬: F = −k|v|v,  k = ½ρC_dA (ρ 1.2 kg/m³, C_d 0.47).  RK4, dt = 1/240 s.
       땅에 닿는 순간·최고점은 그 걸음 안에서 비율로 나눠 다시 적분해 맞춘다.
   ===================================================================== */
(function (root) {
  'use strict';

  var DT = 1 / 240;
  var RHO_AIR = 1.2;   // 지구 공기 밀도 (kg/m³)
  var CD = 0.47;       // 공의 항력 계수

  var PLANETS = {
    earth: { name: '지구', g: 9.8, rho: 1.2 },
    moon:  { name: '달',   g: 1.62, rho: 0 },     // 공기 없음
    mars:  { name: '화성', g: 3.71, rho: 0.020 }  // 대기가 매우 옅음
  };
  var BALLS = {
    steel:    { name: '쇠공',   m: 0.50,   r: 0.025 },
    pingpong: { name: '탁구공', m: 0.0027, r: 0.020 }
  };

  function kBall(b) { return 0.5 * RHO_AIR * CD * Math.PI * b.r * b.r; }
  function gOf(p) { return p.planet === 'earth' ? p.gEarth : PLANETS[p.planet].g; }
  function hOf(p) { return p.pad === 'ground' ? 0 : p.h; }
  function mOf(p) { return p.air === 'off' ? p.m : BALLS[p.air].m; }
  /** 공기 저항 계수 k (kg/m). 끔이거나 공기가 없으면 0 */
  function kOf(p) {
    if (p.air === 'off') return 0;
    var rho = PLANETS[p.planet].rho;
    if (!rho) return 0;
    var k = p.kCustom ? p.k4 * 1e-4 : kBall(BALLS[p.air]);
    return k * rho / RHO_AIR;
  }

  function accel(vx, vy, g, km) {
    var v = Math.sqrt(vx * vx + vy * vy);
    return [-km * v * vx, -g - km * v * vy];
  }
  /** RK4 한 걸음. 가속도가 속도에만 달려 있으므로 위치는 속도의 가중 평균으로 */
  function rk4(s, dt, g, km) {
    var a1 = accel(s.vx, s.vy, g, km);
    var v2x = s.vx + a1[0] * dt / 2, v2y = s.vy + a1[1] * dt / 2;
    var a2 = accel(v2x, v2y, g, km);
    var v3x = s.vx + a2[0] * dt / 2, v3y = s.vy + a2[1] * dt / 2;
    var a3 = accel(v3x, v3y, g, km);
    var v4x = s.vx + a3[0] * dt, v4y = s.vy + a3[1] * dt;
    var a4 = accel(v4x, v4y, g, km);
    return {
      x: s.x + dt / 6 * (s.vx + 2 * v2x + 2 * v3x + v4x),
      y: s.y + dt / 6 * (s.vy + 2 * v2y + 2 * v3y + v4y),
      vx: s.vx + dt / 6 * (a1[0] + 2 * a2[0] + 2 * a3[0] + a4[0]),
      vy: s.vy + dt / 6 * (a1[1] + 2 * a2[1] + 2 * a3[1] + a4[1])
    };
  }

  function analyticAt(run, t) {
    return {
      x: run.vx0 * t,
      y: run.h + run.vy0 * t - 0.5 * run.g * t * t,
      vx: run.vx0,
      vy: run.vy0 - run.g * t
    };
  }

  /** 지금 값(params) → 한 번의 실행 설정 + 결과(해석해 또는 미리 적분) */
  function buildRun(p) {
    var g = gOf(p), h = hOf(p), m = mOf(p), k = kOf(p);
    var th = p.theta * Math.PI / 180;
    var vx0 = p.theta >= 90 ? 0 : p.v0 * Math.cos(th);
    var vy0 = p.theta <= 0 ? 0 : p.v0 * Math.sin(th);
    var run = {
      g: g, h: h, m: m, k: k, km: k / m, v0: p.v0, theta: p.theta, vx0: vx0, vy0: vy0,
      analytic: k === 0,
      E0: 0.5 * m * p.v0 * p.v0 + m * g * h
    };
    if (run.analytic) {
      run.T = (vy0 + Math.sqrt(vy0 * vy0 + 2 * g * h)) / g;
      run.R = vx0 * run.T;
      run.H = h + vy0 * vy0 / (2 * g);
      run.vL = Math.sqrt(p.v0 * p.v0 + 2 * g * h);
      run.tTop = vy0 > 0 ? vy0 / g : -1;
      run.E1 = run.E0;
    } else {
      var st = newState(run), guard = 0;
      while (!st.landed && guard++ < 240 * 600) advance(st, run, DT, false);
      run.T = st.tLand; run.R = st.x; run.H = st.maxY;
      run.vL = Math.sqrt(st.vx * st.vx + st.vy * st.vy);
      run.tTop = st.tTopSeen;
      run.E1 = energy(run, st).E;
    }
    return run;
  }

  /** 실행 상태. 비교 공(c)은 같은 높이·같은 연직 속도로 출발하고 수평으로는 움직이지 않는다 */
  function newState(run) {
    return {
      t: 0, n: 0,
      x: 0, y: run.h, vx: run.vx0, vy: run.vy0,
      yc: run.h, vyc: run.vy0,
      landed: false, cLanded: false, tLand: null, cLand: null,
      maxY: run.h, topDone: false, tTopSeen: -1,
      flashIdx: 1,
      trail: [[0, run.h]],
      flash: [[0, 0, run.h, run.h, run.vx0, run.vy0]],   // [t, x, y, y비교공, vₓ, v_y] — 0.1 s 마다 (섬광 점 분석용)
      result: null
    };
  }

  /**
   * dt 만큼 진행. topStop 이면 최고점에서 정확히 멈춘다.
   * 반환: { top: 이번 걸음에서 최고점에 멈췄는지 }
   */
  function advance(st, run, dt, topStop) {
    var ev = { top: false };
    var tOld = st.t, mainWasLanded = st.landed;
    if (run.analytic) {
      var tc = tOld + dt;
      if (topStop && !st.topDone && run.tTop > 0 && tOld < run.tTop && tc >= run.tTop) {
        tc = run.tTop; st.topDone = true; ev.top = true;
      }
      if (tc >= run.T) {
        tc = run.T; ev.top = false;
        st.landed = st.cLanded = true; st.tLand = st.cLand = run.T;
      }
      var a = analyticAt(run, tc);
      st.x = a.x; st.y = st.landed ? 0 : a.y; st.vx = a.vx; st.vy = ev.top ? 0 : a.vy;
      st.yc = st.y; st.vyc = st.vy;
      st.t = tc;
      if (run.tTop > 0 && st.t >= run.tTop) st.tTopSeen = run.tTop;
      while (st.flashIdx * 0.1 <= st.t + 1e-9) {
        var tf = st.flashIdx * 0.1, b = analyticAt(run, tf);
        st.flash.push([tf, b.x, b.y, b.y, b.vx, b.vy]);
        st.flashIdx++;
      }
    } else {
      var used = dt;
      if (!st.landed) {
        var s = { x: st.x, y: st.y, vx: st.vx, vy: st.vy };
        var s2 = rk4(s, dt, run.g, run.km);
        if (st.tTopSeen < 0 && s.vy > 0 && s2.vy <= 0) {
          var ft = s.vy / (s.vy - s2.vy);
          st.tTopSeen = tOld + dt * ft;
          if (topStop && !st.topDone) {
            used = dt * ft; s2 = rk4(s, used, run.g, run.km); s2.vy = 0;
            st.topDone = true; ev.top = true;
          }
        }
        if (s2.y < 0) {
          var fl = s.y / (s.y - s2.y);
          used = dt * fl; s2 = rk4(s, used, run.g, run.km); s2.y = 0;
          st.landed = true; st.tLand = tOld + used; ev.top = false;
        }
        st.x = s2.x; st.y = s2.y; st.vx = s2.vx; st.vy = s2.vy;
      }
      if (!st.cLanded) {
        var c = { x: 0, y: st.yc, vx: 0, vy: st.vyc };
        var c2 = rk4(c, used, run.g, run.km);
        if (c2.y < 0) {
          var fc = c.y / (c.y - c2.y);
          c2 = rk4(c, used * fc, run.g, run.km); c2.y = 0;
          st.cLanded = true; st.cLand = tOld + used * fc;
        }
        st.yc = c2.y; st.vyc = c2.vy;
      }
      st.t = tOld + used;
      if (st.t >= st.flashIdx * 0.1 - 1e-9) {
        st.flash.push([st.t, st.x, st.y, st.yc, st.vx, st.vy]);
        st.flashIdx++;
      }
    }
    if (st.y > st.maxY) st.maxY = st.y;
    st.n++;
    if (!mainWasLanded && (st.n % 4 === 0 || st.landed || ev.top)) st.trail.push([st.x, st.y]);
    return ev;
  }

  function energy(run, st) {
    var K = 0.5 * run.m * (st.vx * st.vx + st.vy * st.vy);
    var U = run.m * run.g * st.y;
    return { K: K, U: U, E: K + U, heat: run.E0 - (K + U) };
  }

  /** 같은 조건에서 일부 값만 바꿨을 때의 수평 거리 (예측 판정용) */
  function rangeFor(p, over) {
    var q = {};
    for (var k in p) if (Object.prototype.hasOwnProperty.call(p, k)) q[k] = p[k];
    for (var j in over) if (Object.prototype.hasOwnProperty.call(over, j)) q[j] = over[j];
    return buildRun(q).R;
  }

  /** 공을 당긴 거리(u) → v₀(1 m/s 눈금), θ(5° 눈금). 10u = 1 m/s. 당긴 반대쪽으로 날아간다 */
  function pullValues(dx, dyUp) {
    var len = Math.sqrt(dx * dx + dyUp * dyUp);
    var v = Math.round(len / 10);
    if (v > 30) v = 30; if (v < 0) v = 0;
    var deg = Math.atan2(dyUp, dx) * 180 / Math.PI;
    if (deg < -90) deg = 180;        // 오른쪽 아래로 당김 → 왼쪽 위 → 90° 로
    var th = Math.round(deg / 5) * 5;
    if (th < 0) th = 0; if (th > 90) th = 90;
    return { v0: v, theta: th, len: len };
  }

  var api = {
    DT: DT, RHO_AIR: RHO_AIR, CD: CD, PLANETS: PLANETS, BALLS: BALLS,
    kBall: kBall, gOf: gOf, hOf: hOf, mOf: mOf, kOf: kOf, accel: accel, rk4: rk4,
    analyticAt: analyticAt, buildRun: buildRun, newState: newState, advance: advance,
    energy: energy, rangeFor: rangeFor, pullValues: pullValues
  };
  root.PEPhys = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
