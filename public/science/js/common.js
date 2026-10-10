/* 온라인 과학 체험관 공통: 데이터 로드, 체험 페이지 템플릿 */
(function(){
"use strict";
var BASE=location.pathname.replace(/\/(exp|gallery)\/[^\/]*$/,"/").replace(/\/index\.html$/,"/").replace(/\/?$/,function(m){return m||"/"});
if(!/\/$/.test(BASE))BASE+="/";
var GICON={see:"👁️",hear:"🔊",move:"🎢",us:"🧠",life:"🌱",look:"🔭",make:"🛠️"};
var GDESC={see:"빛·색·착시",hear:"소리와 파동",move:"힘과 운동",us:"인지와 인간 현상",life:"살아있는 시스템",look:"지구·우주·야외 관찰",make:"만들고 시험하기"};
var present=/[?&]present=1/.test(location.search);
if(present)document.addEventListener("DOMContentLoaded",function(){document.body.classList.add("present")});

function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function load(){return fetch(BASE+"data/experiences.json").then(function(r){return r.json()})}
function stars(n){return "★★★".slice(0,n)+"☆☆☆".slice(0,3-n)}
function expCard(e){
  var tag=e.status==="done"?"a":"div";
  var href=e.status==="done"?' href="'+BASE+"exp/"+e.id+".html"+(present?"?present=1":"")+'"':"";
  return "<"+tag+' class="card'+(e.status==="done"?"":" planned")+'"'+href+"><h3>"+esc(e.id)+". "+esc(e.title)+"</h3><p>"+esc(e.question)+'</p><div class="chips"><span class="chip">⏱ '+e.minutes+"분</span><span class=\"chip\" title=\"난이도\">"+stars(e.level)+"</span>"+(e.needsMic?'<span class="chip">🎤 마이크</span>':"")+(e.status==="done"?"":'<span class="chip">준비 중</span>')+"</div></"+tag+">";
}

/* ---- 메인 ---- */
function initHome(){
  load().then(function(d){
    var box=document.getElementById("galleries");
    box.innerHTML=d.galleries.map(function(g){
      var all=d.experiences.filter(function(e){return e.gallery===g.id}),done=all.filter(function(e){return e.status==="done"}).length;
      return '<a class="card" href="'+BASE+"gallery/?g="+g.id+'"><div class="ico" aria-hidden="true">'+GICON[g.id]+"</div><h2>"+esc(g.name)+" 갤러리</h2><p>"+GDESC[g.id]+'</p><div class="chips"><span class="chip">체험 '+done+" / "+all.length+"</span></div></a>";
    }).join("");
  });
}

/* ---- 갤러리(검색·필터 포함) ---- */
function initGallery(){
  var gid=(location.search.match(/[?&]g=(\w+)/)||[])[1]||"all";
  load().then(function(d){
    var g=d.galleries.filter(function(x){return x.id===gid})[0];
    document.getElementById("gtitle").textContent=g?g.name+" 갤러리":"모든 체험";
    document.title=(g?g.name+" 갤러리":"모든 체험")+" · 온라인 과학 체험관";
    var topics={};d.experiences.forEach(function(e){e.topics.forEach(function(t){topics[t]=1})});
    var sel=document.getElementById("ftopic");
    Object.keys(topics).forEach(function(t){sel.insertAdjacentHTML("beforeend","<option>"+esc(t)+"</option>")});
    var list=document.getElementById("list"),q=document.getElementById("fq"),lv=document.getElementById("flevel"),mic=document.getElementById("fmic"),shown=document.getElementById("fshown");
    function render(){
      var r=d.experiences.filter(function(e){
        if(g&&e.gallery!==gid)return false;
        if(sel.value&&e.topics.indexOf(sel.value)<0)return false;
        if(lv.value&&e.level!==+lv.value)return false;
        if(mic.value==="no"&&e.needsMic)return false;
        if(q.value&&(e.title+e.question).indexOf(q.value.trim())<0)return false;
        return true});
      list.innerHTML=r.map(expCard).join("")||'<p class="note">조건에 맞는 체험이 없어요.</p>';
      shown.textContent=r.length+"개";
    }
    [sel,lv,mic].forEach(function(el){el.addEventListener("change",render)});q.addEventListener("input",render);render();
  });
}

/* ---- 체험 템플릿 ---- */
/* 체험 파일이 window.EXP 를 정의하고 common.js 가 틀을 만든다. 체험 쪽은 Exp.stageEl 안에 그린다. */
var listeners=[];
window.Exp={
  stageEl:null,revealed:false,choice:null,
  onReveal:function(fn){listeners.push(fn)},
  reveal:function(){
    if(Exp.revealed)return;Exp.revealed=true;
    var P=EXP.predict,res=document.getElementById("predRes");
    if(Exp.choice!=null&&res){var ok=Exp.choice===P.answer;res.textContent=(ok?"✅ ":"🤔 ")+P.feedback[Exp.choice]}
    listeners.forEach(function(f){f()});
  }
};
function initExp(){
  var id=EXP.id;
  load().then(function(d){
    var list=d.experiences,done=list.filter(function(e){return e.status==="done"}),
        me=list.filter(function(e){return e.id===id})[0],g=d.galleries.filter(function(x){return x.id===me.gallery})[0],
        idx=done.indexOf(me),prev=done[idx-1],next=done[idx+1];
    document.title=me.title+" · 온라인 과학 체험관";
    var P=EXP.predict;
    var root=document.getElementById("app");
    root.innerHTML=
      '<header class="top"><a class="home" href="'+BASE+'">🔬 온라인 과학 체험관</a><span class="crumb">› <a href="'+BASE+"gallery/?g="+g.id+'">'+esc(g.name)+' 갤러리</a></span></header>'+
      "<h1>"+esc(me.id)+". "+esc(me.title)+"</h1>"+
      '<p class="exp-q">'+esc(me.question)+"</p>"+
      '<section class="predict" aria-labelledby="ph"><h2 id="ph">먼저 예측해 보세요</h2><p>'+esc(P.q)+'</p><div class="opts" role="group" aria-label="예측 선택">'+
        P.options.map(function(o,i){return '<button type="button" data-i="'+i+'" aria-pressed="false">'+esc(o)+"</button>"}).join("")+
      '</div><p class="note">예측은 저장되지 않아요. 맞고 틀림은 중요하지 않아요.</p><div class="res" id="predRes" aria-live="polite"></div></section>'+
      '<section class="stage locked" id="stage" aria-label="체험 영역"><div class="stage-body" id="stageBody"></div></section>'+
      '<div class="tabs" role="tablist" aria-label="체험 안내">'+
        [["try","① 해보기"],["obs","② 관찰 질문"],["why","③ 왜 그럴까?"],["more","④ 더 해보기"]].map(function(t,i){return '<button role="tab" id="t-'+t[0]+'" aria-controls="p-'+t[0]+'" aria-selected="'+(i===0)+'" tabindex="'+(i===0?0:-1)+'">'+t[1]+"</button>"}).join("")+"</div>"+
      '<div class="panel" role="tabpanel" id="p-try" aria-labelledby="t-try"><ol>'+EXP.steps.map(function(s){return "<li>"+esc(s)+"</li>"}).join("")+"</ol></div>"+
      '<div class="panel" role="tabpanel" id="p-obs" aria-labelledby="t-obs" hidden><ul>'+EXP.observe.map(function(s){return "<li>"+esc(s)+"</li>"}).join("")+"</ul></div>"+
      '<div class="panel" role="tabpanel" id="p-why" aria-labelledby="t-why" hidden><div class="seg" role="group" aria-label="설명 수준"><button type="button" data-lv="easy" aria-pressed="true">쉬운 설명</button><button type="button" data-lv="detail" aria-pressed="false">자세한 설명</button></div><div id="whyBody"></div></div>'+
      '<div class="panel" role="tabpanel" id="p-more" aria-labelledby="t-more" hidden><ul>'+EXP.more.map(function(s){return "<li>"+esc(s)+"</li>"}).join("")+"</ul></div>"+
      '<nav class="pager" aria-label="체험 이동">'+(prev?'<a class="btn" href="'+prev.id+'.html'+(present?"?present=1":"")+'">← '+esc(prev.title)+"</a>":"<span></span>")+(next?'<a class="btn primary" href="'+next.id+'.html'+(present?"?present=1":"")+'">'+esc(next.title)+" →</a>":'<a class="btn" href="'+BASE+"gallery/?g="+g.id+'">갤러리로</a>')+"</nav>"+
      '<footer class="foot">Exploratorium에서 영감을 받았으나 관련 없는 독립 사이트입니다. 이 페이지는 외부로 데이터를 보내거나 저장하지 않습니다.</footer>';
    Exp.stageEl=document.getElementById("stageBody");
    /* 예측 */
    var pb=root.querySelectorAll(".opts button");
    pb.forEach(function(b){b.addEventListener("click",function(){
      if(Exp.choice!=null&&Exp.revealed)return;
      Exp.choice=+b.dataset.i;pb.forEach(function(x){x.setAttribute("aria-pressed",x===b)});
      document.getElementById("stage").classList.remove("locked");
      if(EXP.start)EXP.start();
    })});
    /* 탭 */
    var tabs=[].slice.call(root.querySelectorAll('[role=tab]'));
    function sel(t){tabs.forEach(function(x){var on=x===t;x.setAttribute("aria-selected",on);x.tabIndex=on?0:-1;document.getElementById(x.getAttribute("aria-controls")).hidden=!on});t.focus()}
    tabs.forEach(function(t,i){t.addEventListener("click",function(){sel(t)});t.addEventListener("keydown",function(e){
      var k=e.key==="ArrowRight"?1:e.key==="ArrowLeft"?-1:0;if(k){e.preventDefault();sel(tabs[(i+k+tabs.length)%tabs.length])}})});
    /* 설명 수준 */
    var why=document.getElementById("whyBody");
    function showWhy(l){why.innerHTML=EXP.why[l].map(function(p){return "<p>"+p+"</p>"}).join("");
      root.querySelectorAll("[data-lv]").forEach(function(b){b.setAttribute("aria-pressed",b.dataset.lv===l)})}
    root.querySelectorAll("[data-lv]").forEach(function(b){b.addEventListener("click",function(){showWhy(b.dataset.lv)})});
    showWhy("easy");
    EXP.init(Exp.stageEl);
  });
}
window.Sci={initHome:initHome,initGallery:initGallery,initExp:initExp,esc:esc,
  /* 캔버스를 CSS 너비에 맞춰 선명하게 */
  fit:function(cv,ratio){var w=cv.parentNode.clientWidth-0,dpr=window.devicePixelRatio||1;cv.style.width="100%";cv.width=Math.round(w*dpr);cv.height=Math.round(w*ratio*dpr);cv.style.height=(w*ratio)+"px";var c=cv.getContext("2d");c.setTransform(dpr,0,0,dpr,0,0);return {c:c,w:w,h:w*ratio}}};
})();
