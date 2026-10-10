// 로지스틱 사상: 순수 계산 (배정밀도)
export const NMAX = 80; // 화면에 그리는 해 수
export const THRESH = 0.5;
export const EPS_LIST = [0.1, 0.01, 0.001, 0.0001];

export const logistic = (r: number, x: number) => r * x * (1 - x);

/** x_0 부터 n 해까지 (길이 n+1) */
export function orbit(r: number, x0: number, n: number): number[] {
  const out = [x0];
  for (let i = 0; i < n; i++) out.push(logistic(r, out[i]));
  return out;
}

/** 두 궤도의 차이 |x_n − y_n| 이 처음으로 thr 를 넘는 해. 없으면 null */
export function firstDivergence(r: number, x0: number, eps: number, thr = THRESH, maxN = NMAX): number | null {
  let a = x0, b = x0 + eps;
  if (Math.abs(a - b) > thr) return 0;
  for (let n = 1; n <= maxN; n++) {
    a = logistic(r, a);
    b = logistic(r, b);
    if (Math.abs(a - b) > thr) return n;
  }
  return null;
}

export type Predict = { r: number; x0: number; eps: number; answer: number | null };

/** 예측 문제: 반드시 8~70해 사이에 갈라지는 설정 */
export function makePredict(rnd: () => number): Predict {
  for (let k = 0; k < 1000; k++) {
    const r = Math.round((3.7 + 0.3 * rnd()) * 100) / 100;
    const x0 = Math.round((0.1 + 0.8 * rnd()) * 100) / 100;
    const eps = EPS_LIST[1 + Math.floor(rnd() * 3)];
    const answer = firstDivergence(r, x0, eps);
    if (answer !== null && answer >= 8 && answer <= 70) return { r, x0, eps, answer };
  }
  return { r: 3.9, x0: 0.2, eps: 0.001, answer: firstDivergence(3.9, 0.2, 0.001) };
}

/** 예측 점수: 정확히 10, ±2 이내 6, ±5 이내 3 */
export function predictScore(guess: number, answer: number): number {
  const d = Math.abs(guess - answer);
  return d === 0 ? 10 : d <= 2 ? 6 : d <= 5 ? 3 : 0;
}

/** '갈라지지 않게' 퀘스트: 마지막 20해(61~80해) 내내 두 궤도의 차이가 0.05 이하로 붙어 있다 */
export const SYNC_FROM = 61;
export const SYNC_TOL = 0.05;
export const QB = { x0: 0.3, eps: 0.01, levels: [3.0, 3.3] };
export function synced(r: number, x0 = QB.x0, eps = QB.eps): boolean {
  let a = x0, b = x0 + eps;
  for (let n = 1; n <= NMAX; n++) {
    a = logistic(r, a);
    b = logistic(r, b);
    if (n >= SYNC_FROM && Math.abs(a - b) > SYNC_TOL) return false;
  }
  return true;
}

/** 레벨(1~10)별 예측 허용 오차(해): 1·2→±5, 3·4→±4, 5·6→±3, 7·8→±2, 9·10→±1 */
export const predictTol = (level: number) => Math.max(1, 5 - Math.floor((Math.max(1, Math.min(10, level)) - 1) / 2));
export const predictOk = (guess: number, answer: number, level: number) => Math.abs(guess - answer) <= predictTol(level);
