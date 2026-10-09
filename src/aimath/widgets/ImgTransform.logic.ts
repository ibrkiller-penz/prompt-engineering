export type Img = number[][];
export interface OpResult {
  img: Img;
  /** 0~255 범위를 벗어나 잘린 칸 수 */
  clipped: number;
}

export function clip(m: number[][]): OpResult {
  let clipped = 0;
  const img = m.map((row) =>
    row.map((v) => {
      const x = Math.round(v);
      if (x < 0) { clipped++; return 0; }
      if (x > 255) { clipped++; return 255; }
      return x;
    }),
  );
  return { img, clipped };
}

export const rows = (m: Img) => m.length;
export const cols = (m: Img) => (m.length ? m[0].length : 0);

export function brightness(m: Img, k: number): OpResult {
  return clip(m.map((r) => r.map((v) => v + k)));
}
/** 대비: 128을 기준으로 a배  → a(x-128)+128 */
export function contrast(m: Img, a: number): OpResult {
  return clip(m.map((r) => r.map((v) => a * (v - 128) + 128)));
}
/** 단순 스칼라배: a·x */
export function scalar(m: Img, a: number): OpResult {
  return clip(m.map((r) => r.map((v) => a * v)));
}
export function invert(m: Img): OpResult {
  return { img: m.map((r) => r.map((v) => 255 - v)), clipped: 0 };
}
export function flipH(m: Img): Img {
  return m.map((r) => [...r].reverse());
}
export function flipV(m: Img): Img {
  return [...m].reverse().map((r) => [...r]);
}
export function transpose(m: Img): Img {
  return Array.from({ length: cols(m) }, (_, j) => m.map((r) => r[j]));
}
/** 시계 방향 90°: 전치 후 좌우 대칭 */
export function rotateCW(m: Img): Img {
  return flipH(transpose(m));
}
/** 반시계 방향 90°: 전치 후 상하 대칭 */
export function rotateCCW(m: Img): Img {
  return flipV(transpose(m));
}

/** 가장자리 복제(edge-clamp) 방식의 3x3 합성곱. 결과 = round(합/div) 후 0~255로 자름 */
export function convolve3(m: Img, kernel: number[][], div = 1): OpResult {
  const R = rows(m);
  const C = cols(m);
  const at = (i: number, j: number) => m[Math.min(R - 1, Math.max(0, i))][Math.min(C - 1, Math.max(0, j))];
  const raw = m.map((row, i) =>
    row.map((_, j) => {
      let s = 0;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) s += kernel[a + 1][b + 1] * at(i + a, j + b);
      return s / div;
    }),
  );
  return clip(raw);
}

export const BLUR_KERNEL = [[1, 1, 1], [1, 1, 1], [1, 1, 1]];
export const SHARPEN_KERNEL = [[0, -1, 0], [-1, 5, -1], [0, -1, 0]];
export const EDGE_KERNEL = [[-1, -1, -1], [-1, 8, -1], [-1, -1, -1]];

export const blur = (m: Img) => convolve3(m, BLUR_KERNEL, 9);
export const sharpen = (m: Img) => convolve3(m, SHARPEN_KERNEL, 1);
export const edge = (m: Img) => convolve3(m, EDGE_KERNEL, 1);

const parse = (rowsStr: string[], map: Record<string, number>): Img => rowsStr.map((r) => [...r].map((ch) => map[ch]));
const BW: Record<string, number> = { ".": 255, "#": 0 };

export const PRESETS: Record<string, { label: string; img: Img }> = {
  smiley: {
    label: "웃는 얼굴",
    img: parse(["......", ".#..#.", "......", "#....#", ".####.", "......"], BW),
  },
  arrow: {
    label: "화살표",
    img: parse(["..##..", ".####.", "######", "..##..", "..##..", "..##.."], BW),
  },
  gradient: {
    label: "그라데이션",
    img: Array.from({ length: 6 }, () => [0, 51, 102, 153, 204, 255]),
  },
  checker: {
    label: "체크무늬",
    img: Array.from({ length: 6 }, (_, i) => Array.from({ length: 6 }, (_, j) => ((i + j) % 2 === 0 ? 255 : 0))),
  },
};

export function cycleValue(v: number): number {
  const steps = [0, 64, 128, 192, 255];
  const i = steps.indexOf(v);
  return i === -1 ? 0 : steps[(i + 1) % steps.length];
}

export function matrixTex(m: Img): string {
  return `\\begin{pmatrix} ${m.map((r) => r.join(" & ")).join(" \\\\ ")} \\end{pmatrix}`;
}
