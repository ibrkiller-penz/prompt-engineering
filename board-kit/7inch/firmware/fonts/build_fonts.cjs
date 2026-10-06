// 한글 글꼴 만들기: Pretendard SemiBold(OFL) → LVGL C 글꼴 (firmware/src/fonts/kr*.c)
// 글자: ASCII + KS X 1001 한글 2,350자 + 화면에 쓰는 기호.  node fonts/build_fonts.cjs  (먼저 fonts 폴더에서 npm install)
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const here = __dirname, out = path.join(here, '..', 'src', 'fonts');
fs.mkdirSync(out, { recursive: true });
// lv_font_conv 가 머리 주석에 내 PC 의 글꼴 경로(사용자 이름이 들어 있다)를 적는다 → 공개해도 안전하게 지운다
const scrub = t => t.replace(/^ \* Opts: .*$/m, ' * Opts: (생성 방법은 fonts/build_fonts.cjs 참고)');
const hangul = fs.readFileSync(path.join(here, 'src', 'hangul2350.txt'), 'utf8');
const ranges = '0x20-0x7E,0xB0,0xB7,0x2192,0x25B6,0x25C0,0x25CF'; // ° · → ▶ ◀ ●
for (const size of [14, 16, 20, 28]) {
  const file = path.join(out, `kr${size}.c`);
  // 셸을 거치지 않는다(경로의 빈칸·한글이 잘린다). 먼저 이 폴더에서 npm install 할 것.
  execFileSync(process.execPath, [require.resolve('lv_font_conv/lv_font_conv.js', { paths: [here] }),
    '--font', path.join(here, 'src', 'Pretendard-SemiBold.otf'), '-r', ranges, '--symbols', hangul,
    '--size', String(size), '--bpp', '4', '--format', 'lvgl', '--lv-include', 'lvgl.h',
    '-o', file], { stdio: 'inherit' }); // 글꼴 이름은 파일 이름(kr16)을 따른다
  // 한글 글꼴에 없는 LVGL 기호(와이파이·화살표 등)는 같은 크기의 Montserrat 에서 빌린다(lv_conf.h 에서 켜 둔다)
  const src = fs.readFileSync(file, 'utf8').replace(/\.dsc = &font_dsc(\s*)\/\*/, `.dsc = &font_dsc,$1.fallback = &lv_font_montserrat_${size},$1/*`);
  if (!src.includes('.fallback')) throw new Error('fallback 을 못 넣었습니다: ' + file);
  fs.writeFileSync(file, scrub(src));
  console.log(`kr${size}.c ${(fs.statSync(file).size / 1024 / 1024).toFixed(1)}MB`);
}
// 큰 숫자: 시계(140px, 숫자와 ':'), 날씨 온도(44px, 숫자와 '-', '°')
for (const [name, size, symbols] of [['num140', 140, '0123456789:'], ['num44', 44, '0123456789-°']]) {
  const file = path.join(out, `${name}.c`);
  execFileSync(process.execPath, [require.resolve('lv_font_conv/lv_font_conv.js', { paths: [here] }),
    '--font', path.join(here, 'src', 'Pretendard-SemiBold.otf'), '--symbols', symbols,
    '--size', String(size), '--bpp', '4', '--format', 'lvgl', '--lv-include', 'lvgl.h', '-o', file], { stdio: 'inherit' });
  fs.writeFileSync(file, scrub(fs.readFileSync(file, 'utf8')));
  console.log(`${name}.c ${(fs.statSync(file).size / 1024).toFixed(0)}KB`);
}
