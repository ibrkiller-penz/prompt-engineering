// 시험 전용 QR 해독기(버전 1~10, 오류 없는 행렬). 만드는 쪽(qrcodegen)의 표·함수를 쓰지 않고
// 표준(ISO/IEC 18004) 규칙만으로 따로 읽어서, 칠판에 그린 QR 이 정말 그 주소를 담는지 확인해요.
//   형식 정보(BCH) → 기능 무늬 자리 → 지그재그로 코드워드 읽기(마스크 풀기) → 블록 나누기
//   → 리드-솔로몬 신드롬이 0인지 확인 → 비트열(숫자·영숫자·바이트 모드) 해석(UTF-8)

export interface Decoded {
  text: string;
  version: number;
  ecc: "L" | "M" | "Q" | "H";
  mask: number;
}

// 표준 표(버전 1~10): 블록당 오류 정정 코드워드 수와 블록 수
const ECC_PER_BLOCK: Record<string, number[]> = {
  L: [7, 10, 15, 20, 26, 18, 20, 24, 30, 18],
  M: [10, 16, 26, 18, 24, 16, 18, 22, 22, 26],
  Q: [13, 22, 18, 26, 18, 24, 18, 22, 20, 24],
  H: [17, 28, 22, 16, 22, 28, 26, 26, 24, 28],
};
const NUM_BLOCKS: Record<string, number[]> = {
  L: [1, 1, 1, 1, 1, 2, 2, 2, 2, 4],
  M: [1, 1, 1, 2, 2, 4, 4, 4, 5, 5],
  Q: [1, 1, 2, 2, 4, 4, 6, 6, 8, 8],
  H: [1, 1, 2, 4, 4, 4, 5, 6, 8, 8],
};
// 형식 정보 2비트 → 오류 정정 단계
const ECC_BITS: ("L" | "M" | "Q" | "H")[] = ["M", "L", "H", "Q"];

function bchFormat(data5: number): number {
  let rem = data5;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data5 << 10) | rem) ^ 0x5412;
}

function alignPositions(ver: number): number[] {
  if (ver === 1) return [];
  const num = Math.floor(ver / 7) + 2;
  const size = ver * 4 + 17;
  const step = Math.ceil((ver * 4 + 4) / (num * 2 - 2)) * 2;
  const out = [6];
  for (let pos = size - 7; out.length < num; pos -= step) out.splice(1, 0, pos);
  return out;
}

/** 기능 무늬(찾기·구분선·타이밍·정렬·형식·버전·검은 칸) 자리 */
function functionMask(ver: number): boolean[][] {
  const size = ver * 4 + 17;
  const f: boolean[][] = [];
  for (let y = 0; y < size; y++) f.push(new Array(size).fill(false));
  const rect = (x0: number, y0: number, w: number, h: number) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (x >= 0 && y >= 0 && x < size && y < size) f[y][x] = true;
  };
  rect(0, 0, 9, 9);
  rect(size - 8, 0, 8, 9);
  rect(0, size - 8, 9, 8);
  rect(6, 0, 1, size);
  rect(0, 6, size, 1);
  const al = alignPositions(ver);
  for (const ay of al)
    for (const ax of al) {
      if ((ax === 6 && ay === 6) || (ax === 6 && ay === al[al.length - 1]) || (ax === al[al.length - 1] && ay === 6)) continue;
      rect(ax - 2, ay - 2, 5, 5);
    }
  if (ver >= 7) {
    rect(size - 11, 0, 3, 6);
    rect(0, size - 11, 6, 3);
  }
  return f;
}

const MASKS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

/* GF(256), 다항식 0x11D */
const EXP: number[] = [];
const LOG: number[] = new Array(256).fill(0);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP.push(x);
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
})();
const gmul = (a: number, b: number) => (a && b ? EXP[(LOG[a] + LOG[b]) % 255] : 0);

/** 블록(데이터+정정)의 신드롬이 모두 0인지(α^0 … α^(n-1) 뿌리) */
function syndromesZero(block: number[], eccLen: number): boolean {
  for (let i = 0; i < eccLen; i++) {
    const a = EXP[i];
    let s = 0;
    for (const c of block) s = gmul(s, a) ^ c;
    if (s !== 0) return false;
  }
  return true;
}

/** modules[y][x] = 검은 칸 */
export function decodeQr(modules: boolean[][]): Decoded {
  const size = modules.length;
  const ver = (size - 17) / 4;
  if (!(ver >= 1 && ver <= 10 && ver === Math.floor(ver))) throw new Error("버전 1~10 만 읽어요: 크기 " + size);
  const get = (x: number, y: number) => !!modules[y][x];

  // 1) 형식 정보(왼쪽 위 사본)
  let fmt = 0;
  for (let i = 0; i <= 5; i++) fmt = (fmt << 1) | (get(8, i) ? 1 : 0);
  fmt = (fmt << 1) | (get(8, 7) ? 1 : 0);
  fmt = (fmt << 1) | (get(8, 8) ? 1 : 0);
  fmt = (fmt << 1) | (get(7, 8) ? 1 : 0);
  for (let i = 5; i >= 0; i--) fmt = (fmt << 1) | (get(i, 8) ? 1 : 0);
  // 비트 순서: 위 읽기는 bit14 가 (8,0)… 이 아니라 표준 배치의 반대이므로 두 순서를 모두 맞춰 봐요
  const rev = (v: number) => {
    let r = 0;
    for (let i = 0; i < 15; i++) r = (r << 1) | ((v >>> i) & 1);
    return r;
  };
  let best = -1;
  let bestD = 99;
  for (let d = 0; d < 32; d++) {
    const code = bchFormat(d);
    for (const cand of [fmt, rev(fmt)]) {
      let x = code ^ cand;
      let n = 0;
      while (x) {
        n += x & 1;
        x >>>= 1;
      }
      if (n < bestD) {
        bestD = n;
        best = d;
      }
    }
  }
  if (bestD !== 0) throw new Error("형식 정보가 깨졌어요(거리 " + bestD + ")");
  const ecc = ECC_BITS[best >>> 3];
  const mask = best & 7;

  // 2) 코드워드 읽기
  const fn = functionMask(ver);
  const bits: number[] = [];
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      const y = upward ? size - 1 - vert : vert;
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        if (fn[y][x]) continue;
        bits.push((get(x, y) !== MASKS[mask](x, y)) ? 1 : 0);
      }
    }
    upward = !upward;
  }
  const total = Math.floor(bits.length / 8);
  const cw: number[] = [];
  for (let i = 0; i < total; i++) {
    let b = 0;
    for (let k = 0; k < 8; k++) b = (b << 1) | bits[i * 8 + k];
    cw.push(b);
  }

  // 3) 블록 나누기(짧은 블록이 앞, 긴 블록은 데이터가 하나 더) + 신드롬 확인
  const nb = NUM_BLOCKS[ecc][ver - 1];
  const el = ECC_PER_BLOCK[ecc][ver - 1];
  const shortLen = Math.floor(total / nb);
  const numShort = nb - (total % nb);
  const dataLens: number[] = [];
  for (let i = 0; i < nb; i++) dataLens.push((i < numShort ? shortLen : shortLen + 1) - el);
  const blocks: number[][] = [];
  for (let i = 0; i < nb; i++) blocks.push([]);
  let k = 0;
  const maxData = Math.max(...dataLens);
  for (let i = 0; i < maxData; i++) for (let b = 0; b < nb; b++) if (i < dataLens[b]) blocks[b].push(cw[k++]);
  for (let i = 0; i < el; i++) for (let b = 0; b < nb; b++) blocks[b].push(cw[k++]);
  const data: number[] = [];
  blocks.forEach((bl, b) => {
    if (!syndromesZero(bl, el)) throw new Error("리드-솔로몬 확인에 실패했어요(블록 " + b + ")");
    for (let i = 0; i < dataLens[b]; i++) data.push(bl[i]);
  });

  // 4) 비트열 해석
  let pos = 0;
  const read = (n: number) => {
    let v = 0;
    for (let i = 0; i < n; i++) {
      const byte = data[(pos >> 3)] || 0;
      v = (v << 1) | ((byte >> (7 - (pos & 7))) & 1);
      pos++;
    }
    return v;
  };
  const bytes: number[] = [];
  let text = "";
  const flush = () => {
    if (bytes.length) text += new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes));
    bytes.length = 0;
  };
  const ALNUM = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
  while (pos + 4 <= data.length * 8) {
    const mode = read(4);
    if (mode === 0) break;
    if (mode === 4) {
      const n = read(ver <= 9 ? 8 : 16);
      for (let i = 0; i < n; i++) bytes.push(read(8));
    } else if (mode === 2) {
      flush();
      let n = read(ver <= 9 ? 9 : 11);
      for (; n >= 2; n -= 2) {
        const v = read(11);
        text += ALNUM[Math.floor(v / 45)] + ALNUM[v % 45];
      }
      if (n === 1) text += ALNUM[read(6)];
    } else if (mode === 1) {
      flush();
      let n = read(ver <= 9 ? 10 : 12);
      for (; n >= 3; n -= 3) text += String(read(10)).padStart(3, "0");
      if (n === 2) text += String(read(7)).padStart(2, "0");
      else if (n === 1) text += String(read(4));
    } else throw new Error("모르는 모드 " + mode);
  }
  flush();
  return { text, version: ver, ecc, mask };
}

/** qrSvgPath 의 d 값(M x,y h w v1 h-w z …)을 다시 행렬로 그려요(여백 border 를 빼고) */
export function matrixFromPath(d: string, n: number, border: number): boolean[][] {
  const size = n - border * 2;
  const m: boolean[][] = [];
  for (let y = 0; y < size; y++) m.push(new Array(size).fill(false));
  const re = /M(\d+),(\d+)h(\d+)v1h-(\d+)z/g;
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(d))) {
    const x = +mm[1] - border;
    const y = +mm[2] - border;
    for (let k = 0; k < +mm[3]; k++) m[y][x + k] = true;
  }
  return m;
}
