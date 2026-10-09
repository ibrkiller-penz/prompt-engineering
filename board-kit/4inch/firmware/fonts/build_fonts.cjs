// 한글 글꼴 만들기: Pretendard SemiBold(OFL) → LVGL C 글꼴 (firmware/src/fonts/*.c)
// 16_교실-출석단말 의 같은 스크립트에서 크기만 바꿨다. 글자: ASCII + KS X 1001 한글 2,350자 + 화면에 쓰는 기호.
//   cd firmware/fonts && npm install && node build_fonts.cjs
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const here = __dirname, out = path.join(here, '..', 'src', 'fonts');
fs.mkdirSync(out, { recursive: true });
const conv = require.resolve('lv_font_conv/lv_font_conv.js', { paths: [here] });
const hangul = fs.readFileSync(path.join(here, 'src', 'hangul2350.txt'), 'utf8');
const ranges = '0x20-0x7E,0xB0,0xB7,0x2192,0x25B6,0x25C0,0x25CF'; // ° · → ▶ ◀ ●
for (const size of [14, 16, 20]) {
  const file = path.join(out, `kr${size}.c`);
  // 셸을 거치지 않는다(경로의 빈칸·한글이 잘린다)
  execFileSync(process.execPath, [conv, '--font', path.join(here, 'src', 'Pretendard-SemiBold.otf'), '-r', ranges, '--symbols', hangul,
    '--size', String(size), '--bpp', '4', '--format', 'lvgl', '--lv-include', 'lvgl.h', '-o', file], { stdio: 'inherit' });
  // 한글 글꼴에 없는 LVGL 기호(와이파이·화살표 등)는 같은 크기의 Montserrat 에서 빌린다(lv_conf.h 에서 켜 둔다)
  const src = fs.readFileSync(file, 'utf8').replace(/\.dsc = &font_dsc(\s*)\/\*/, `.dsc = &font_dsc,$1.fallback = &lv_font_montserrat_${size},$1/*`);
  if (!src.includes('.fallback')) throw new Error('fallback 을 못 넣었습니다: ' + file);
  fs.writeFileSync(file, src);
  console.log(`kr${size}.c ${(fs.statSync(file).size / 1024 / 1024).toFixed(1)}MB`);
}
// 큰 숫자: 시계(120px, 숫자와 ':'), 날씨 온도(44px, 숫자와 '-', '°')
for (const [name, size, symbols] of [['num120', 120, '0123456789:'], ['num44', 44, '0123456789-°']]) {
  const file = path.join(out, `${name}.c`);
  execFileSync(process.execPath, [conv, '--font', path.join(here, 'src', 'Pretendard-SemiBold.otf'), '--symbols', symbols,
    '--size', String(size), '--bpp', '4', '--format', 'lvgl', '--lv-include', 'lvgl.h', '-o', file], { stdio: 'inherit' });
  console.log(`${name}.c ${(fs.statSync(file).size / 1024).toFixed(0)}KB`);
}
