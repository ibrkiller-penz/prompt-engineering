/* =====================================================================
   물리 시뮬레이터 실험실 — 공통 SVG 아이콘 세트 (R4, 2026-10-28)
   일반 <script> 로 sim.js 앞에 불러온다(fetch·module 없음, file:// 동작). 전역: window.SimIcons
     <script src="../../shared/icons.js"></script>
     <script src="../../shared/sim.js"></script>
   허브처럼 SimKit 없이도 쓴다: SimIcons.html('chev-right') → '<svg class="ico" …>…</svg>'
   SimKit 안에서는 SK.icon(name, {size, cls, label}) · SK.iconHTML · SK.iconPath · SK.iconify(el)

   모양 규칙: 24×24 viewBox, 선 2(round cap/join), 채움 없음, 색 = currentColor.
             play·pause·step·bolt 처럼 꽉 찬 모양은 그 path 에만 fill="currentColor".
   글자 기호 ↔ 아이콘 (SimIcons.GLYPHS): ▶ play · ⏸ pause · ↻ replay · ↺ reset · ◀ step-back · ▸ chev-right
     ▾ chev-down · ▴ chev-up · ← arrow-left · ↓ arrow-down · ↑ arrow-up · ↗ arrow-ne · ✕ ✗ close · ✓ check
     ⚡ bolt · ? help · ⤢ expand · ⋯ more   (→ · × · ● ▲ ■ ◆ ★ · ½ ² ° 는 글자 그대로 둔다)
   R5 추가(글자 기호 대응 없음): tri-left · tri-right(채운 삼각, 캔버스 손잡이 SK.drawIcon/SK.iconPath) · lock · eye(그림 보기)
   ===================================================================== */
(function (global) {
  'use strict';

  var F = ' fill="currentColor"';                 // 꽉 찬 부분
  var DOT = function (cx, cy) { return '<circle cx="' + cx + '" cy="' + cy + '" r="1.25"' + F + ' stroke="none"/>'; };

  /** 이름 → SVG 안쪽 마크업 (24×24) */
  var ICONS = {
    'play':        '<path d="M7.5 5.2v13.6L19 12z"' + F + '/>',
    'pause':       '<rect x="6" y="5" width="4" height="14" rx="1"' + F + ' stroke="none"/><rect x="14" y="5" width="4" height="14" rx="1"' + F + ' stroke="none"/>',
    'replay':      '<path d="M20 12a8 8 0 1 1-2.34-5.66L20 8.5"/><path d="M20 4v4.5h-4.5"/>',
    'reset':       '<path d="M4 12a8 8 0 1 0 2.34-5.66L4 8.5"/><path d="M4 4v4.5h4.5"/>',
    'step-back':   '<path d="M18.5 5.5v13L9.5 12z"' + F + '/><path d="M5.5 5.5v13"/>',
    'step-fwd':    '<path d="M5.5 5.5v13l9-6.5z"' + F + '/><path d="M18.5 5.5v13"/>',
    'chev-right':  '<path d="M9.5 6l6 6-6 6"/>',
    'chev-left':   '<path d="M14.5 6l-6 6 6 6"/>',
    'chev-down':   '<path d="M6 9.5l6 6 6-6"/>',
    'chev-up':     '<path d="M6 14.5l6-6 6 6"/>',
    'arrow-left':  '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
    'arrow-down':  '<path d="M12 5v14M6 13l6 6 6-6"/>',
    'arrow-up':    '<path d="M12 19V5M6 11l6-6 6 6"/>',
    'arrow-ne':    '<path d="M7 17L17 7M9 7h8v8"/>',
    'close':       '<path d="M6 6l12 12M18 6L6 18"/>',
    'check':       '<path d="M4.5 12.5l5 5L19.5 7"/>',
    'bolt':        '<path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z"' + F + '/>',
    'help':        '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.35c-.6.25-1 .8-1 1.45v.5"/>' + DOT(12, 17),
    'expand':      '<path d="M14 4h6v6M10 20H4v-6M20 4l-6.5 6.5M4 20l6.5-6.5"/>',
    'more':        DOT(5.5, 12) + DOT(12, 12) + DOT(18.5, 12),
    'warn':        '<path d="M12 3.8L2.8 19.5h18.4z"/><path d="M12 10v4.2"/>' + DOT(12, 16.9),
    'info':        '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/>' + DOT(12, 7.8),
    /* R5 */
    'tri-left':    '<path d="M15.5 6.5v11L7 12z"' + F + '/>',
    'tri-right':   '<path d="M8.5 6.5v11L17 12z"' + F + '/>',
    'lock':        '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    'eye':         '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>'
  };

  /** 캔버스용: Path2D 에 넣을 d 문자열 (선 아이콘만 — 원·채움은 path 로 근사) */
  var PATHS = {
    'play': 'M7.5 5.2v13.6L19 12z',
    'pause': 'M6 5h4v14H6zM14 5h4v14h-4z',
    'replay': 'M20 12a8 8 0 1 1-2.34-5.66L20 8.5M20 4v4.5h-4.5',
    'reset': 'M4 12a8 8 0 1 0 2.34-5.66L4 8.5M4 4v4.5h4.5',
    'step-back': 'M18.5 5.5v13L9.5 12zM5.5 5.5v13',
    'step-fwd': 'M5.5 5.5v13l9-6.5zM18.5 5.5v13',
    'chev-right': 'M9.5 6l6 6-6 6', 'chev-left': 'M14.5 6l-6 6 6 6',
    'chev-down': 'M6 9.5l6 6 6-6', 'chev-up': 'M6 14.5l6-6 6 6',
    'arrow-left': 'M19 12H5M11 6l-6 6 6 6', 'arrow-right': 'M5 12h14M13 6l6 6-6 6',
    'arrow-down': 'M12 5v14M6 13l6 6 6-6', 'arrow-up': 'M12 19V5M6 11l6-6 6 6', 'arrow-ne': 'M7 17L17 7M9 7h8v8',
    'close': 'M6 6l12 12M18 6L6 18', 'check': 'M4.5 12.5l5 5L19.5 7',
    'bolt': 'M13 2.5L5 13.5h6l-1 8 8-11h-6z',
    'help': 'M21 12a9 9 0 1 1-18 0a9 9 0 1 1 18 0M9.6 9.4a2.5 2.5 0 1 1 3.4 2.35c-.6.25-1 .8-1 1.45v.5M12 17v.01',
    'expand': 'M14 4h6v6M10 20H4v-6M20 4l-6.5 6.5M4 20l6.5-6.5',
    'more': 'M5.5 12h.01M12 12h.01M18.5 12h.01',
    'warn': 'M12 3.8L2.8 19.5h18.4zM12 10v4.2M12 16.9v.01',
    'info': 'M21 12a9 9 0 1 1-18 0a9 9 0 1 1 18 0M12 11v5.5M12 7.8v.01',
    'tri-left': 'M15.5 6.5v11L7 12z', 'tri-right': 'M8.5 6.5v11L17 12z',
    'lock': 'M7 10.5h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2zM8 10.5V7.5a4 4 0 0 1 8 0v3',
    'eye': 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM15 12a3 3 0 1 1-6 0a3 3 0 1 1 6 0'
  };
  /** 캔버스에서 채워야 하는 아이콘 */
  var FILLED = { 'play': true, 'pause': true, 'bolt': true, 'tri-left': true, 'tri-right': true };

  /** 글자 기호 → 아이콘 이름 (SK.iconify 가 텍스트 맨 앞/맨 뒤에서만 바꾼다) */
  var GLYPHS = {
    '▶': 'play', '►': 'play', '⏸': 'pause', '↻': 'replay', '⟳': 'replay', '↺': 'reset', '◀': 'step-back',
    '▸': 'chev-right', '▾': 'chev-down', '▴': 'chev-up',
    '←': 'arrow-left', '↓': 'arrow-down', '↑': 'arrow-up', '↗': 'arrow-ne',
    '✕': 'close', '✗': 'close', '✓': 'check', '✔': 'check', '⚡': 'bolt', '?': 'help', '⤢': 'expand', '⋯': 'more'
  };

  var SIZES = { sm: 'ico--sm', md: 'ico--md', lg: 'ico--lg' };
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /** 아이콘 SVG 문자열. o = {size:'sm'|'md'|'lg', cls, label} — label 이 있으면 role="img"+<title>, 없으면 aria-hidden */
  function html(name, o) {
    o = o || {};
    var inner = ICONS[name];
    if (!inner) return '';
    var cls = 'ico ico-' + name + (o.size && SIZES[o.size] ? ' ' + SIZES[o.size] : '') + (o.cls ? ' ' + o.cls : '');
    var a = o.label ? ' role="img" aria-label="' + esc(o.label) + '"' : ' aria-hidden="true"';
    return '<svg class="' + cls + '" viewBox="0 0 24 24" focusable="false"' + a + '>' + (o.label ? '<title>' + esc(o.label) + '</title>' : '') + inner + '</svg>';
  }
  /** 아이콘 SVG 요소 (DOM) */
  function el(name, o) {
    if (!ICONS[name]) return null;
    var box = document.createElement('div');
    box.innerHTML = html(name, o);
    return box.firstChild;
  }

  global.SimIcons = {
    ICONS: ICONS, PATHS: PATHS, FILLED: FILLED, GLYPHS: GLYPHS,
    names: function () { return Object.keys(ICONS); },
    has: function (name) { return !!ICONS[name]; },
    html: html, el: el,
    path: function (name) { return PATHS[name] || ''; }
  };
})(window);
