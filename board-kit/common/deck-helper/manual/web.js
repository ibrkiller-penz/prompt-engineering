// 화면으로 볼 때만: 왼쪽 차례(지금 읽는 곳 표시), '자세한 설명서' 단계를 누르면 했어요 표시(이 컴퓨터에 기억),
// 오른쪽 아래 [다음 할 단계로] 단추. PDF 를 뽑는 Edge(헤드리스)에서는 아무것도 하지 않는다.
(function () {
  if (/Headless/i.test(navigator.userAgent)) return;
  var html = document.documentElement;
  html.classList.add("web");
  var KEY = "tapdeck-manual-done";
  var done = {};
  try { done = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { done = {}; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(done)); } catch (e) {} }

  // ── 차례 ──
  var nav = document.createElement("nav");
  nav.id = "toc";
  nav.setAttribute("aria-label", "차례");
  nav.innerHTML = '<div class="toc-h">탭덱 사용 설명서<small>누르면 그곳으로 가요</small></div>' +
    '<div class="tabs"><button type="button" data-go="q1">간단 설명서</button><button type="button" data-go="p1">자세한 설명서</button></div>';
  var ul = document.createElement("ul");
  nav.appendChild(ul);
  var links = [], lastPart = "";
  Array.prototype.forEach.call(document.querySelectorAll("section[id]"), function (s) {
    var h = s.querySelector("h2");
    if (!h) return;
    var part = s.id.charAt(0);
    if (part !== lastPart) {
      var p = document.createElement("li");
      p.className = "part";
      p.textContent = part === "q" ? "간단 설명서" : "자세한 설명서 · 따라 하기";
      ul.appendChild(p);
      lastPart = part;
    }
    var li = document.createElement("li");
    var a = document.createElement("a");
    a.href = "#" + s.id;
    a.textContent = h.textContent.replace(/\s+/g, " ").trim();
    li.appendChild(a);
    ul.appendChild(li);
    links.push({ sec: s, a: a });
  });
  var reset = document.createElement("button");
  reset.type = "button";
  reset.className = "reset";
  reset.textContent = "‘했어요’ 표시 모두 지우기";
  nav.appendChild(reset);
  document.body.insertBefore(nav, document.body.firstChild);
  nav.addEventListener("click", function (e) {
    var go = e.target.getAttribute && e.target.getAttribute("data-go");
    if (go) { var t = document.getElementById(go); if (t) t.scrollIntoView(); }
    if (e.target.tagName === "A" || go) document.body.classList.remove("toc-open");
  });
  var tb = document.createElement("button");
  tb.id = "toc-btn";
  tb.type = "button";
  tb.textContent = "☰ 차례";
  tb.onclick = function () { document.body.classList.toggle("toc-open"); };
  document.body.appendChild(tb);

  function markActive() {
    var cur = null;
    links.forEach(function (l) { if (l.sec.getBoundingClientRect().top < 140) cur = l; });
    links.forEach(function (l) { l.a.classList.toggle("on", l === cur); });
  }
  window.addEventListener("scroll", markActive, { passive: true });

  // ── 따라 하기: 자세한 설명서의 단계 ──
  var bars = [], all = [];
  Array.prototype.forEach.call(document.querySelectorAll('section[id^="p"]'), function (sec) {
    var lis = sec.querySelectorAll("ol.steps > li");
    if (!lis.length) return;
    var bar = document.createElement("div");
    bar.className = "prog";
    var h = sec.querySelector("h2");
    if (h && h.parentNode) h.parentNode.insertBefore(bar, h.nextSibling);
    Array.prototype.forEach.call(lis, function (li, i) {
      var k = sec.id + "-" + i;
      all.push(li);
      if (done[k]) li.classList.add("done");
      li.title = "해 봤으면 눌러서 표시해요";
      li.addEventListener("click", function (e) {
        if (e.target.closest && e.target.closest("a")) return;
        li.classList.toggle("done");
        done[k] = li.classList.contains("done");
        save();
        update();
      });
    });
    bars.push({ el: bar, lis: lis, sec: sec });
  });

  var next = document.createElement("button");
  next.id = "next-step";
  next.type = "button";
  document.body.appendChild(next);
  next.onclick = function () {
    var li = null;
    for (var i = 0; i < all.length; i++) if (!all[i].classList.contains("done")) { li = all[i]; break; }
    if (!li) return;
    li.scrollIntoView({ behavior: "smooth", block: "center" });
    li.classList.add("flash");
    setTimeout(function () { li.classList.remove("flash"); }, 1800);
  };

  function update() {
    var total = 0, n = 0;
    bars.forEach(function (b) {
      var k = 0;
      Array.prototype.forEach.call(b.lis, function (li) { if (li.classList.contains("done")) k++; });
      total += b.lis.length; n += k;
      var full = k === b.lis.length;
      b.el.innerHTML = '<span>따라 한 단계 <b>' + k + "</b> / " + b.lis.length + '</span><span class="bar"><i style="width:' +
        Math.round(100 * k / b.lis.length) + '%"></i></span>' + (full ? "<em>✓ 다 했어요!</em>" : '<span class="hint">단계를 누르면 표시돼요</span>');
      links.forEach(function (l) {
        if (l.sec === b.sec) {
          var c = l.a.querySelector(".chk");
          if (full && !c) { c = document.createElement("span"); c.className = "chk"; c.textContent = "✓"; l.a.appendChild(c); }
          if (!full && c) l.a.removeChild(c);
        }
      });
    });
    next.hidden = !all.length;
    next.textContent = n >= total ? "✓ 모두 따라 했어요" : "다음 할 단계로 ↓  (" + n + "/" + total + ")";
  }
  reset.onclick = function () {
    done = {};
    save();
    all.forEach(function (li) { li.classList.remove("done"); });
    update();
  };
  update();
  markActive();
})();
