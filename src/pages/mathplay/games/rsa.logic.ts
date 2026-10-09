// RSA 체험의 계산 부분(순수 함수). 작은 수만 쓰므로 일반 정수로 안전해요.
export function isPrime(n: number): boolean {
  if (!Number.isInteger(n) || n < 2) return false;
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
  return true;
}
/** 합성수의 가장 작은 약수(소수면 0) */
export function smallestFactor(n: number): number {
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return i;
  return 0;
}
export function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}
export type EuStep = { q: number; r: number; t: number };
/** 확장 유클리드 호제법(표 보여 주기용). e 의 mod m 역원 d 를 구한다. 역원이 없으면 d=0 */
export function modInverse(e: number, m: number): { d: number; steps: EuStep[]; g: number } {
  let r0 = m,
    r1 = e % m,
    t0 = 0,
    t1 = 1;
  const steps: EuStep[] = [];
  while (r1 !== 0) {
    const q = Math.floor(r0 / r1);
    const r2 = r0 - q * r1;
    const t2 = t0 - q * t1;
    steps.push({ q, r: r2, t: t2 });
    r0 = r1;
    r1 = r2;
    t0 = t1;
    t1 = t2;
  }
  // r0 = gcd, t0 = e 의 계수
  if (r0 !== 1) return { d: 0, steps, g: r0 };
  return { d: ((t0 % m) + m) % m, steps, g: r0 };
}
/** base^exp mod mod (제곱을 거듭하는 방법). BigInt 라 큰 수도 안전 */
export function modPow(base: number, exp: number, mod: number): number {
  let r = 1n,
    b = BigInt(base) % BigInt(mod),
    e = BigInt(exp);
  const M = BigInt(mod);
  while (e > 0n) {
    if (e & 1n) r = (r * b) % M;
    b = (b * b) % M;
    e >>= 1n;
  }
  return Number(r);
}
export const PRIMES_SHOWN = Array.from({ length: 37 }, (_, i) => 11 + i); // 11..47
/** φ 와 서로소인 공개 지수 후보(작은 순서, 1<e<φ, d≠e) */
export function eCandidates(phi: number, count = 8): number[] {
  const out: number[] = [];
  for (let e = 3; e < phi && out.length < count; e++) {
    if (gcd(e, phi) !== 1) continue;
    const { d } = modInverse(e, phi);
    if (d === e) continue;
    out.push(e);
  }
  return out;
}
/** A=1 … Z=26. 영어 알파벳(대소문자)만 허용. 그 밖의 글자가 있으면 null */
export function textToNums(s: string): number[] | null {
  const up = s.toUpperCase();
  const out: number[] = [];
  for (const ch of up) {
    const c = ch.charCodeAt(0);
    if (c < 65 || c > 90) return null;
    out.push(c - 64);
  }
  return out;
}
export const numToLetter = (n: number) => (n >= 1 && n <= 26 ? String.fromCharCode(64 + n) : "?");
export const lockNums = (m: number[], e: number, n: number) => m.map((x) => modPow(x, e, n));
export const unlockNums = (c: number[], d: number, n: number) => c.map((x) => modPow(x, d, n));

/** 레벨 1~10: 낱말 길이·숫자만 보여 주기(글자로 직접 바꾸기)·낯선 열쇠(n 을 소인수분해해서 내 열쇠로 다시 만들기) */
export function rsaLevel(lv: number) {
  const L = Math.max(1, Math.min(10, lv));
  return { len: L <= 3 ? 3 : L <= 6 ? 4 : 5, numbersOnly: L >= 4, stranger: L >= 7 };
}
export const WORDS_BY_LEN: Record<number, string[]> = {
  3: ["SUN", "KEY", "CAT", "DOG", "SKY", "MAP"],
  4: ["MATH", "STAR", "CODE", "MOON", "BOOK", "LOVE"],
  5: ["PRIME", "LIGHT", "SMILE", "HAPPY", "OCEAN", "MUSIC"],
};
