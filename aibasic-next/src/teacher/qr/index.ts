// 수업 끝 QR 을 만드는 순수 함수(DOM 없음). 외부 API 를 부르지 않고 기기 안에서 바로 만들어요.
// 화면 쪽은 qrSvgPath 결과를 <svg viewBox="0 0 n n"><path d=... /></svg> 로 그리면 돼요.
import { TEACHER_MARK } from "../mark.ts";
import { Ecc, QrCode } from "./qrcodegen.ts";

export { Ecc, QrCode, QrSegment } from "./qrcodegen.ts";

/** 이 모듈이 교사 전용이라는 표식(학생 빌드에 들어가면 누출 검사가 잡아요) */
export const QR_MARK = TEACHER_MARK;

export type EccLevel = "L" | "M" | "Q" | "H";

const ECC: Record<EccLevel, Ecc> = { L: Ecc.LOW, M: Ecc.MEDIUM, Q: Ecc.QUARTILE, H: Ecc.HIGH };

export interface QrMatrix {
  /** 모듈 수(한 변). version*4+17 */
  size: number;
  version: number;
  mask: number;
  /** modules[y][x] = true 면 검은 칸 */
  modules: boolean[][];
}

/** 글자(주소)를 QR 행렬로 만들어요. ecc 기본 M(약 15% 가려져도 읽혀요). 자동으로 더 높은 단계로 올려요 */
export function makeQr(text: string, ecc: EccLevel = "M"): QrMatrix {
  const qr = QrCode.encodeText(text, ECC[ecc]);
  const modules: boolean[][] = [];
  for (let y = 0; y < qr.size; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < qr.size; x++) row.push(qr.getModule(x, y));
    modules.push(row);
  }
  return { size: qr.size, version: qr.version, mask: qr.mask, modules };
}

/**
 * SVG path 의 d 값을 만들어요. 가로로 이어진 검은 칸은 한 사각형으로 합쳐서 길이를 줄여요.
 * border 는 둘레 여백(모듈 수, QR 표준 권장 4). viewBox 는 0 0 (size+2*border) (size+2*border).
 */
export function qrSvgPath(m: QrMatrix, border = 4): string {
  if (border < 0 || border !== Math.floor(border)) throw new RangeError("border 는 0 이상의 정수여야 해요");
  const parts: string[] = [];
  for (let y = 0; y < m.size; y++) {
    let x = 0;
    while (x < m.size) {
      if (!m.modules[y][x]) {
        x++;
        continue;
      }
      let w = 1;
      while (x + w < m.size && m.modules[y][x + w]) w++;
      parts.push("M" + (x + border) + "," + (y + border) + "h" + w + "v1h-" + w + "z");
      x += w;
    }
  }
  return parts.join("");
}

export interface QrSvg {
  /** viewBox 한 변 길이(모듈 수, 여백 포함) */
  n: number;
  viewBox: string;
  d: string;
}

/** 주소 → SVG 그리기 재료(viewBox 와 path d) */
export function qrSvg(text: string, opts: { ecc?: EccLevel; border?: number } = {}): QrSvg {
  const border = opts.border === undefined ? 4 : opts.border;
  const m = makeQr(text, opts.ecc || "M");
  const n = m.size + border * 2;
  return { n, viewBox: "0 0 " + n + " " + n, d: qrSvgPath(m, border) };
}

/** 완성된 SVG 문자열(인쇄·내려받기용). 흰 바탕 + 검은 칸 */
export function qrSvgString(text: string, opts: { ecc?: EccLevel; border?: number; title?: string } = {}): string {
  const s = qrSvg(text, opts);
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' +
    s.viewBox +
    '" shape-rendering="crispEdges" role="img"' +
    (opts.title ? ' aria-label="' + esc(opts.title) + '"' : "") +
    '><rect width="100%" height="100%" fill="#fff"/><path d="' +
    s.d +
    '" fill="#000"/></svg>'
  );
}
