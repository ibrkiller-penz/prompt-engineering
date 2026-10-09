export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

/** 모표준편차 (n으로 나눔) */
export function sd(xs: number[]): number {
  if (xs.length === 0) return 0;
  const m = mean(xs);
  let s = 0;
  for (const x of xs) s += (x - m) * (x - m);
  return Math.sqrt(s / xs.length);
}

/**
 * 시나리오: 시험 점수(0~100) 모집단. 두 집단이 섞여 있다.
 * 집단 H(공부 많이 함, 40%): 평균 약 80, 집단 L(나머지, 60%): 평균 약 55.
 * 진짜 평균 = 0.4*80 + 0.6*55 = 65.
 */
export const TRUE_MEAN = 65;
export const BINS = 10;

function gauss(rnd: () => number): number {
  const u = Math.max(rnd(), 1e-12);
  const v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function clampScore(x: number): number {
  return Math.min(100, Math.max(0, Math.round(x)));
}

/** biased=true 이면 집단 H(점수 높은 쪽)에서만 모은다 (예: 학원 앞 설문). */
export function sample(n: number, seed: number, biased: boolean): number[] {
  const rnd = mulberry32(seed);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const inH = biased ? true : rnd() < 0.4;
    const x = inH ? 80 + 8 * gauss(rnd) : 55 + 12 * gauss(rnd);
    out.push(clampScore(x));
  }
  return out;
}

/** 앞에서 k개까지의 누적 평균 (k=1..n). points개 이하로 솎아서 반환 */
export function runningMeans(xs: number[], maxPoints = 200): { k: number; m: number }[] {
  const out: { k: number; m: number }[] = [];
  let s = 0;
  const step = Math.max(1, Math.floor(xs.length / maxPoints));
  for (let i = 0; i < xs.length; i++) {
    s += xs[i];
    if ((i + 1) % step === 0 || i === xs.length - 1 || i < 30) out.push({ k: i + 1, m: s / (i + 1) });
  }
  return out;
}

export function histogram(xs: number[], bins = BINS): number[] {
  const h = new Array(bins).fill(0);
  for (const x of xs) h[Math.min(bins - 1, Math.floor((x / 100) * bins))]++;
  return h;
}

export function interpret(n: number, m: number, biased: boolean): string {
  const err = Math.abs(m - TRUE_MEAN);
  if (biased && n >= 100) return "그래도 편향된 표집이면 틀린 곳으로 수렴해요. 데이터가 아무리 많아도, 한쪽에서만 모으면 진짜 평균에 가까워지지 않아요.";
  if (biased) return "한쪽 집단에서만 모았어요. n을 키워 보세요. 평균이 안정되긴 하지만 진짜 평균과는 계속 차이가 나요.";
  if (n < 30) return "표본이 작으면 평균이 들쭉날쭉해요. 다시 뽑을 때마다 값이 많이 달라질 거예요.";
  if (err < 1.5) return "표본이 커질수록 평균이 안정돼요. 지금은 진짜 평균에 아주 가까워요.";
  return "표본이 커질수록 평균이 안정돼요. 아직은 조금 차이가 있지만, n을 더 키우면 줄어들어요.";
}
