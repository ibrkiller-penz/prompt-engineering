// 씨앗(seed)이 같으면 늘 같은 순서를 주는 섞기. 보기 순서·문제 순서·번호 뽑기에 써요.

/** 글자를 32비트 씨앗으로(xmur3) */
export function hashSeed(seed: string | number): number {
  const s = String(seed);
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** 0 이상 1 미만의 수를 차례로 내는 함수(mulberry32) */
export function seededRandom(seed: string | number): () => number {
  let a = hashSeed(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 0..n-1 을 씨앗에 따라 섞은 순서(피셔-예이츠) */
export function seededOrder(n: number, seed: string | number): number[] {
  const len = Math.max(0, Math.floor(n));
  const a: number[] = [];
  for (let i = 0; i < len; i++) a.push(i);
  const rnd = seededRandom(seed);
  for (let i = len - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

/** 배열을 씨앗에 따라 섞은 새 배열(원본은 그대로) */
export function seededShuffle<T>(arr: readonly T[], seed: string | number): T[] {
  return seededOrder(arr.length, seed).map((i) => arr[i]);
}
