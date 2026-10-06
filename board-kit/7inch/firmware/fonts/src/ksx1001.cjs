// KS X 1001 한글 2,350자 (EUC-KR 0xB0A1~0xC8FE)
const dec = new TextDecoder('euc-kr'); let s = '';
for (let hi = 0xB0; hi <= 0xC8; hi++) for (let lo = 0xA1; lo <= 0xFE; lo++) { const c = dec.decode(new Uint8Array([hi, lo])); if (/[가-힣]/.test(c)) s += c; }
require('fs').writeFileSync(process.argv[2], s, 'utf8'); console.log('hangul', s.length);
