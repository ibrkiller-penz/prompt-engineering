export type Rgb = [number, number, number];
export type Grid = Rgb[]; // n*n, 행 우선

export const WHITE: Rgb = [255, 255, 255];

export function clamp255(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(255, Math.max(0, Math.round(v)));
}

export function makeGrid(n: number, fill: Rgb = WHITE): Grid {
  return Array.from({ length: n * n }, () => [fill[0], fill[1], fill[2]] as Rgb);
}

/** 크기를 바꾸되 겹치는 칸은 유지, 새 칸은 흰색 */
export function resizeGrid(g: Grid, from: number, to: number): Grid {
  const out = makeGrid(to);
  for (let r = 0; r < Math.min(from, to); r++)
    for (let c = 0; c < Math.min(from, to); c++) out[r * to + c] = [...g[r * from + c]] as Rgb;
  return out;
}

export function setChannel(g: Grid, idx: number, ch: 0 | 1 | 2, v: number): Grid {
  return g.map((p, i) => {
    if (i !== idx) return p;
    const q: Rgb = [p[0], p[1], p[2]];
    q[ch] = clamp255(v);
    return q;
  });
}

export function setGray(g: Grid, idx: number, v: number): Grid {
  const x = clamp255(v);
  return g.map((p, i) => (i === idx ? ([x, x, x] as Rgb) : p));
}

/** 밝기(휘도) 환산: 0.299R+0.587G+0.114B 반올림 */
export function toGray(p: Rgb): number {
  return clamp255(0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]);
}

export function grayAll(g: Grid): Grid {
  return g.map((p) => {
    const x = toGray(p);
    return [x, x, x] as Rgb;
  });
}

export function countNumbers(n: number, gray: boolean): number {
  return n * n * (gray ? 1 : 3);
}

export function channelMatrix(g: Grid, n: number, ch: 0 | 1 | 2): number[][] {
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => g[r * n + c][ch]));
}

export function matrixTex(m: number[][], name?: string): string {
  const body = m.map((row) => row.join(" & ")).join(" \\\\ ");
  const mat = `\\begin{pmatrix} ${body} \\end{pmatrix}`;
  return name ? `${name} = ${mat}` : mat;
}

/** 재현 가능한 난수(mulberry32) */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomGrid(n: number, gray: boolean, rand: () => number): Grid {
  return Array.from({ length: n * n }, () => {
    if (gray) {
      const x = Math.floor(rand() * 256);
      return [x, x, x] as Rgb;
    }
    return [Math.floor(rand() * 256), Math.floor(rand() * 256), Math.floor(rand() * 256)] as Rgb;
  });
}

const HEARTS: Record<number, string[]> = {
  3: ["X.X", "XXX", ".X."],
  4: [".XX.", "XXXX", "XXXX", ".XX."],
  5: [".X.X.", "XXXXX", "XXXXX", ".XXX.", "..X.."],
};

export function heartGrid(n: number): Grid {
  const pat = HEARTS[n] ?? HEARTS[5];
  return Array.from({ length: n * n }, (_, i) => {
    const r = Math.floor(i / n);
    const c = i % n;
    return (pat[r][c] === "X" ? [225, 40, 70] : [255, 255, 255]) as Rgb;
  });
}

export function rgbCss(p: Rgb): string {
  return `rgb(${p[0]}, ${p[1]}, ${p[2]})`;
}
