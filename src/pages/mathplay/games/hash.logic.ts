// 해시 실험실의 계산 부분(순수 함수). SHA-256 을 직접 구현해 두어 어느 환경에서나 같은 값이 나와요.
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

/** 글(UTF-8)의 SHA-256 을 64자리 16진수로 */
export function sha256Sync(text: string): string {
  const data = new TextEncoder().encode(text);
  const bitLen = data.length * 8;
  const total = (((data.length + 9 + 63) >> 6) << 6) >>> 0;
  const buf = new Uint8Array(total);
  buf.set(data);
  buf[data.length] = 0x80;
  const dv = new DataView(buf.buffer);
  dv.setUint32(total - 8, Math.floor(bitLen / 2 ** 32));
  dv.setUint32(total - 4, bitLen >>> 0);
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] += a;
    h[1] += b;
    h[2] += c;
    h[3] += d;
    h[4] += e;
    h[5] += f;
    h[6] += g;
    h[7] += hh;
  }
  return Array.from(h, (x) => x.toString(16).padStart(8, "0")).join("");
}

/** 브라우저의 crypto.subtle 이 있으면 그걸 쓰고(비동기), 없으면 직접 구현으로 */
export async function sha256Hex(text: string): Promise<string> {
  try {
    const s = typeof crypto !== "undefined" ? crypto.subtle : undefined;
    if (s) {
      const buf = await s.digest("SHA-256", new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
    }
  } catch {
    /* 아래 직접 구현으로 */
  }
  return sha256Sync(text);
}

const POP = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];
/** 두 16진수 문자열에서 서로 다른 비트 수 */
export function bitDiff(a: string, b: string): number {
  let n = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) n += POP[parseInt(a[i], 16) ^ parseInt(b[i], 16)];
  return n;
}

/** 4글자씩 자른 조각 */
export const chunks4 = (hex: string) => hex.match(/.{1,4}/g) ?? [];

// ───── 블록 체인 ─────
export type Block = { content: string; prev: string; nonce: number };
export const GENESIS = "0".repeat(64);
export const blockHash = (i: number, b: Block) => sha256Sync(`${i + 1}|${b.content}|${b.prev}|${b.nonce}`);
export const meets = (hash: string, zeros: number) => hash.startsWith("0".repeat(zeros));

/** 조건을 만족하는 nonce 를 0부터 찾는다. 찾은 nonce 와 시도 횟수 */
export function mine(i: number, content: string, prev: string, zeros: number, limit = 400000): { nonce: number; tries: number } {
  for (let n = 0; n < limit; n++) {
    if (meets(blockHash(i, { content, prev, nonce: n }), zeros)) return { nonce: n, tries: n + 1 };
  }
  return { nonce: 0, tries: limit };
}

/** 블록 상태: ok / hash(조건 불만족) / link(앞 블록 해시와 안 맞음) */
export function chainStatus(chain: Block[], zeros: number): ("ok" | "hash" | "link")[] {
  return chain.map((b, i) => {
    const expectPrev = i === 0 ? GENESIS : blockHash(i - 1, chain[i - 1]);
    if (b.prev !== expectPrev) return "link";
    if (!meets(blockHash(i, b), zeros)) return "hash";
    return "ok";
  });
}

export function mineChain(contents: string[], zeros: number): Block[] {
  const out: Block[] = [];
  contents.forEach((content, i) => {
    const prev = i === 0 ? GENESIS : blockHash(i - 1, out[i - 1]);
    out.push({ content, prev, nonce: mine(i, content, prev, zeros).nonce });
  });
  return out;
}

/** 레벨 1~10: 블록 수·앞자리 0 개수·'모두 다시 채굴' 단추 허용·고칠 블록 범위(앞쪽일수록 다시 채굴할 블록이 많아요) */
export function hashLevel(lv: number) {
  const L = Math.max(1, Math.min(10, lv));
  const blocks = L <= 2 ? 4 : L <= 5 ? 5 : 6;
  const zeros = L <= 4 ? 1 : 2;
  const allButton = L <= 3;
  // 고칠 블록(0부터): 낮은 레벨은 뒤쪽, 높은 레벨은 앞쪽
  const lo = L <= 3 ? blocks - 2 : L <= 6 ? 1 : 0;
  const hi = L <= 3 ? blocks - 2 : L <= 6 ? blocks - 3 : 1;
  return { blocks, zeros, allButton, lo, hi };
}
