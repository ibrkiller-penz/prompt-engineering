/* 온라인 과학 체험관 공통: 층·진행 기록(기기 저장), 허브·갤러리, 체험 템플릿 */
(function(){
"use strict";
var BASE=location.pathname.replace(/\/(exp|gallery)\/[^\/]*$/,"/").replace(/\/index\.html$/,"/").replace(/\/?$/,function(m){return m||"/"});
if(!/\/$/.test(BASE))BASE+="/";
var present=/[?&]present=1/.test(location.search);
if(present)document.addEventListener("DOMContentLoaded",function(){document.body.classList.add("present")});

/* ---- 층: 갤러리 7개를 4개 층으로 묶음 ---- */
var FLOORS=[
 {id:1,name:"보고 듣는 마당",emoji:"🎈",desc:"눈과 귀로 먼저 만나요",grad:["#ff9a5a","#ff5e7e"]},
 {id:2,name:"힘과 만들기 연구소",emoji:"🚀",desc:"움직이고 만들며 원리를 찾아요",grad:["#4fc3ff","#6a5cff"]},
 {id:3,name:"몸과 생명 박물관",emoji:"🧬",desc:"사람과 생물을 관찰해요",grad:["#34d399","#3b82f6"]},
 {id:4,name:"지구·우주 관찰대",emoji:"🔭",desc:"하늘과 땅을 살펴봐요",grad:["#b78cff","#ff6fb5"]}
];
var FLOOR_OF={see:1,hear:1,move:2,make:2,us:3,life:3,look:4};
var GNAME={see:"보기",hear:"듣기",move:"움직임",us:"우리",life:"생명",look:"관찰",make:"손으로 생각하기"};
var BADGES=[
 {id:"b1",name:"첫 발걸음",emoji:"👣",on:function(n){return n>=1}},
 {id:"b5",name:"탐험가 5",emoji:"🧭",on:function(n){return n>=5}},
 {id:"b15",name:"탐험가 15",emoji:"🗺️",on:function(n){return n>=15}},
 {id:"ball",name:"과학자 전부",emoji:"🏆",on:function(n,t){return n>=t}},
 {id:"f1",name:"1층 완주",emoji:"🎈",floor:1},
 {id:"f2",name:"2층 완주",emoji:"🚀",floor:2},
 {id:"f3",name:"3층 완주",emoji:"🧬",floor:3},
 {id:"f4",name:"4층 완주",emoji:"🔭",floor:4}
];

/* ---- 진행 기록: 이 기기 브라우저(localStorage)에만 저장. 서버로 보내지 않음 ---- */
var KEY="penedu:science:save";
function blank(){return {v:1,done:{},plays:{},days:[],name:"",today:{date:"",done:[]}}}
function load(){try{var r=localStorage.getItem(KEY);if(r)return Object.assign(blank(),JSON.parse(r))}catch(e){}return blank()}
function store(s){try{localStorage.setItem(KEY,JSON.stringify(s))}catch(e){}}
function dayKey(d){d=d||new Date();return d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2)}
function markDay(s){var k=dayKey();if(s.days.indexOf(k)<0)s.days=s.days.concat([k]).slice(-120)}
function recordPlay(id){var s=load();s.plays[id]=(s.plays[id]||0)+1;markDay(s);store(s)}
function recordDone(id){var s=load(),k=dayKey();if(s.today.date!==k)s.today={date:k,done:[]};if(s.today.done.indexOf(id)<0)s.today.done=s.today.done.concat([id]);s.done[id]=(s.done[id]||0)+1;markDay(s);store(s)}
function setName(n){var s=load();s.name=String(n||"").slice(0,10);store(s)}
function isDone(s,id){return !!s.done[id]}
function streakOf(days){var n=0,d=new Date(),k;
 while(true){k=dayKey(d);if(days.indexOf(k)>=0){n++;d.setDate(d.getDate()-1)}else if(n===0&&k===dayKey()){d.setDate(d.getDate()-1)}else break}
 return n}
function floorStats(list,s,fid){var all=list.filter(function(e){return FLOOR_OF[e.gallery]===fid});return {total:all.length,done:all.filter(function(e){return isDone(s,e.id)}).length}}
function badgeStates(list,s){var n=list.filter(function(e){return isDone(s,e.id)}).length,t=list.length;
 return BADGES.map(function(b){var on=b.floor?floorStats(list,s,b.floor).done===floorStats(list,s,b.floor).total&&floorStats(list,s,b.floor).total>0:b.on(n,t);return {b:b,on:on}})}


/* ---- 체험 창: 허브·갤러리에서 누르면 화면 가득 창으로 열림 (mathplay 방식) ---- */
var modalList=[],modalIndex=-1,modalChanged=false;
function ensureModal(){
  if(document.getElementById("expModal"))return document.getElementById("expModal");
  var m=document.createElement("div");m.id="expModal";m.className="exp-modal";m.hidden=true;
  m.innerHTML='<div class="em-box" role="dialog" aria-modal="true" aria-label="체험">'+
    '<header class="em-head"><span class="em-thumb" id="emThumb" aria-hidden="true"></span>'+
    '<div class="em-txt"><h2 class="em-title" id="emTitle"></h2><p class="em-sub" id="emSub"></p></div>'+
    '<div class="em-btns"><button type="button" class="em-ic" data-act="help" aria-label="설명 보기">❓</button>'+
    '<button type="button" class="em-ic" data-act="prev" aria-label="이전 체험">‹</button>'+
    '<button type="button" class="em-ic" data-act="next" aria-label="다음 체험">›</button>'+
    '<button type="button" class="em-ic em-close" data-act="close" aria-label="닫기">✕</button></div></header>'+
    '<iframe class="em-frame" id="emFrame" title="체험 화면"></iframe></div>';
  document.body.appendChild(m);
  m.addEventListener("click",function(e){
    var b=e.target.closest("[data-act]");if(!b)return;
    var act=b.dataset.act;
    if(act==="close")closeExp();
    else if(act==="help"){var f=document.getElementById("emFrame");var ob=f.contentDocument&&f.contentDocument.getElementById("openInfo");if(ob)ob.click()}
    else if(act==="prev"&&modalIndex>0)showModal(modalIndex-1);
    else if(act==="next"&&modalIndex<modalList.length-1)showModal(modalIndex+1);
  });
  m.addEventListener("click",function(e){if(e.target===m)closeExp()});
  document.addEventListener("keydown",function(e){
    if(m.hidden)return;
    if(e.key==="Escape")closeExp();
    if(e.key==="ArrowLeft"&&modalIndex>0)showModal(modalIndex-1);
    if(e.key==="ArrowRight"&&modalIndex<modalList.length-1)showModal(modalIndex+1);
  });
  return m;
}
function showModal(i){
  var m=ensureModal(),it=modalList[i];if(!it)return;
  modalIndex=i;
  m.querySelector("#emTitle").textContent=it.id+". "+it.title;
  m.querySelector("#emSub").textContent=it.floor+" · "+it.gname;
  m.querySelector("#emThumb").textContent=it.icon;
  m.querySelector(".em-head").style.background="linear-gradient(90deg,"+it.grad[0]+","+it.grad[1]+")";
  m.querySelector("[data-act=prev]").disabled=i<=0;
  m.querySelector("[data-act=next]").disabled=i>=modalList.length-1;
  m.querySelector("#emFrame").src=it.href+(/\?/.test(it.href)?"&":"?")+"modal=1";
  m.hidden=false;document.body.style.overflow="hidden";
}
function openExp(href,id){
  var idx=modalList.findIndex(function(x){return x.id===id});
  if(idx<0){location.href=href;return}
  showModal(idx);
}
function closeExp(){
  var m=document.getElementById("expModal");if(!m||m.hidden)return;
  m.hidden=true;m.querySelector("#emFrame").src="about:blank";document.body.style.overflow="";
  if(modalChanged)location.reload();
}
function setModalList(d,pick){
  modalList=d.experiences.filter(pick).map(function(e){var f=FLOORS[FLOOR_OF[e.gallery]-1];return {id:e.id,title:e.title,href:BASE+"exp/"+e.id+".html"+(present?"?present=1":""),grad:f.grad,floor:f.emoji+" "+f.name,gname:GNAME[e.gallery],icon:ICON[e.id]||f.emoji}});
  if(!setModalList.bound){
    setModalList.bound=true;
    document.addEventListener("click",function(e){
      var a=e.target.closest&&e.target.closest("a.exp-open");if(!a||e.metaKey||e.ctrlKey||e.shiftKey)return;
      e.preventDefault();openExp(a.getAttribute("href"),a.dataset.id);
    });
    window.addEventListener("message",function(e){if(e.data&&e.data.sciDone)modalChanged=true});
  }
}

function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function load2(){return fetch(BASE+"data/experiences.json").then(function(r){return r.json()})}
function stars(n){return "★★★".slice(0,n)+"☆☆☆".slice(0,3-n)}
var ICON={A1:"📏",A2:"🎨",A3:"👁️",A4:"⬜",A5:"🟥",A6:"🛞",A7:"👀",A8:"🪞",B1:"🎵",B2:"🌊",B3:"🎤",B4:"🚑",B5:"🎷",B6:"🔇",C1:"⏱️",C2:"🌕",C3:"💥",C4:"🤸",C5:"⚽",C6:"〰️",C7:"🌀",C8:"🎢",C9:"📦",D1:"⚡",D2:"🔤",D3:"🔍",D4:"🧠",D5:"✏️",D6:"👓",E1:"🦊",E2:"🌱",E3:"🌿",E4:"💓",E5:"🐛",F1:"🕛",F2:"🌗",F3:"🪨",F4:"🌏",F5:"🌑",G1:"⚖️",G2:"🌉",G3:"🏗️",G4:"💡",G5:"⚙️"};

function tile(e,s){
  var done=isDone(s,e.id),fresh=!s.plays[e.id],href=BASE+"exp/"+e.id+".html"+(present?"?present=1":"");
  var g=FLOORS[FLOOR_OF[e.gallery]-1],c=g.grad;
  return '<a class="tile exp-open'+(done?" is-done":"")+'" data-id="'+e.id+'" href="'+href+'" style="--c1:'+c[0]+';--c2:'+c[1]+'">'+
    '<div class="tile-art" aria-hidden="true"><span>'+(ICON[e.id]||g.emoji)+'</span></div>'+
    '<div class="tile-body"><div class="tile-top">'+(done?'<span class="tag ok">✔ 완료</span>':fresh?'<span class="tag new">NEW</span>':'<span class="tag">'+e.minutes+'분</span>')+'<span class="lv" title="난이도">'+stars(e.level)+'</span></div>'+
    '<h3>'+esc(e.id)+'. '+esc(e.title)+'</h3><p>'+esc(e.question)+'</p>'+
    (e.needsMic?'<span class="chip">🎤 마이크</span>':"")+'</div></a>';
}

/* ---- 허브: 건물(4개 층) ---- */
function initHome(){
  load2().then(function(d){
    var list=d.experiences,s=load(),done=list.filter(function(e){return isDone(s,e.id)}).length,total=list.length;
    document.getElementById("stat-stars").textContent=done+" / "+total;
    document.getElementById("stat-streak").textContent=streakOf(s.days)+"일";
    var bs=badgeStates(list,s);
    document.getElementById("stat-badges").textContent=bs.filter(function(x){return x.on}).length+" / "+BADGES.length;
    var name=document.getElementById("name-in");name.value=s.name;
    document.getElementById("greet").textContent=s.name?s.name+"님의 탐험":"나만의 탐험 이름을 정해요";
    name.addEventListener("change",function(){setName(name.value);initHome2()});
    /* 오늘의 미션: 아직 안 한 체험 중 날짜마다 다른 것 */
    var todo=list.filter(function(e){return !isDone(s,e.id)});
    var seed=Math.floor(Date.now()/86400000);
    var pick=todo.length?todo[seed%todo.length]:null;
    var m=document.getElementById("mission");
    m.innerHTML=pick?'<span class="mission-l">🎯 오늘의 미션</span><strong>'+esc(pick.title)+'</strong><a class="btn primary" href="'+BASE+"exp/"+pick.id+'.html">지금 해 보기 →</a>':'<span class="mission-l">🎉</span><strong>모든 체험을 마쳤어요!</strong>';
    /* 아무 체험이나 */
    var r=document.getElementById("random");
    setModalList(d,function(){return true});
    r.addEventListener("click",function(){var pool=todo.length?todo:list;var p=pool[Math.floor(Math.random()*pool.length)];openExp(BASE+"exp/"+p.id+".html",p.id)});
    /* 층 */
    document.getElementById("floors").innerHTML=FLOORS.map(function(f){
      var fs=floorStats(list,s,f.id),pct=fs.total?Math.round(fs.done*100/fs.total):0;
      return '<a class="floor" href="'+BASE+"gallery/?f="+f.id+'" style="--c1:'+f.grad[0]+';--c2:'+f.grad[1]+'">'+
        '<div class="floor-emoji" aria-hidden="true">'+f.emoji+'</div>'+
        '<div class="floor-txt"><span class="floor-no">'+f.id+'층</span><h2>'+esc(f.name)+'</h2><p>'+esc(f.desc)+'</p>'+
        '<div class="bar" role="progressbar" aria-valuenow="'+pct+'" aria-valuemin="0" aria-valuemax="100" aria-label="'+esc(f.name)+' 진행"><i style="width:'+pct+'%"></i></div>'+
        '<span class="floor-count">⭐ '+fs.done+' / '+fs.total+'</span></div></a>';
    }).join("");
    /* 배지 */
    document.getElementById("badges").innerHTML=bs.map(function(x){return '<span class="badge'+(x.on?" on":"")+'" title="'+esc(x.b.name)+'"><b aria-hidden="true">'+x.b.emoji+'</b>'+esc(x.b.name)+(x.on?"":" 🔒")+'</span>'}).join("");
  });
}
function initHome2(){ /* 이름 바꾸면 인사말만 갱신 */
  var s=load();document.getElementById("greet").textContent=s.name?s.name+"님의 탐험":"나만의 탐험 이름을 정해요";
}

/* ---- 갤러리(층별, 검색·필터) ---- */
function initGallery(){
  var fid=parseInt((location.search.match(/[?&]f=(\d)/)||[])[1]||"0",10);
  var gid=(location.search.match(/[?&]g=(\w+)/)||[])[1]||"";
  load2().then(function(d){
    var s=load(),fl=FLOORS[fid-1];
    var title=fl?fl.emoji+" "+fl.name:gid?GNAME[gid]+" 갤러리":"모든 체험";
    document.getElementById("gtitle").textContent=title;
    document.title=title+" · 온라인 과학 체험관";
    if(fl){var fs=floorStats(d.experiences,s,fid);document.getElementById("gsub").textContent=fl.desc+" · ⭐ "+fs.done+" / "+fs.total}
    var topics={};d.experiences.forEach(function(e){e.topics.forEach(function(t){topics[t]=1})});
    var sel=document.getElementById("ftopic");
    Object.keys(topics).forEach(function(t){sel.insertAdjacentHTML("beforeend","<option>"+esc(t)+"</option>")});
    var list=document.getElementById("list"),q=document.getElementById("fq"),lv=document.getElementById("flevel"),mic=document.getElementById("fmic"),shown=document.getElementById("fshown");
    function render(){
      var r=d.experiences.filter(function(e){
        if(fid&&FLOOR_OF[e.gallery]!==fid)return false;
        if(gid&&e.gallery!==gid)return false;
        if(sel.value&&e.topics.indexOf(sel.value)<0)return false;
        if(lv.value&&e.level!==+lv.value)return false;
        if(mic.value==="no"&&e.needsMic)return false;
        if(q.value&&(e.title+e.question).indexOf(q.value.trim())<0)return false;
        return true});
      list.innerHTML=r.map(function(e){return tile(e,s)}).join("")||'<p class="note">조건에 맞는 체험이 없어요.</p>';
      shown.textContent=r.length+"개";
    }
    [sel,lv,mic].forEach(function(el){el.addEventListener("change",render)});q.addEventListener("input",render);render();
    setModalList(d,function(e){return fid?FLOOR_OF[e.gallery]===fid:true});
  });
}

/* ---- 체험 템플릿 ---- */
/* 체험 파일이 window.EXP 를 정의하고 common.js 가 틀을 만든다. 체험 쪽은 Exp.stageEl 안에 그린다. */
var listeners=[];
window.Exp={
  stageEl:null,revealed:false,choice:null,
  onReveal:function(fn){listeners.push(fn)},
  touched:false,counted:false,
  /* 별은 '예측 선택 + 직접 조작 + 확인'을 모두 해야 한 번 기록된다 */
  reveal:function(){
    if(!Exp.counted&&Exp.choice!=null&&Exp.touched){
      recordDone(EXP.id);Exp.counted=true;
      var d=document.getElementById("doneChip");if(d)d.hidden=false;
      if(window.parent&&window.parent!==window)window.parent.postMessage({sciDone:EXP.id},location.origin);
    }
    if(Exp.revealed)return;Exp.revealed=true;
    var P=EXP.predict,res=document.getElementById("predRes");
    if(Exp.choice!=null&&res){var ok=Exp.choice===P.answer;res.textContent=(ok?"✅ ":"🤔 ")+P.feedback[Exp.choice]}
    listeners.forEach(function(f){f()});
  }
};
function initExp(){
  var id=EXP.id;
  if(/[?&]modal=1/.test(location.search))document.body.classList.add("in-modal");
  load2().then(function(d){
    var list=d.experiences,done=list.filter(function(e){return e.status==="done"}),
        me=list.filter(function(e){return e.id===id})[0],g=d.galleries.filter(function(x){return x.id===me.gallery})[0],
        idx=done.indexOf(me),prev=done[idx-1],next=done[idx+1],fid=FLOOR_OF[me.gallery],fl=FLOORS[fid-1],s=load();
    document.title=me.title+" · 온라인 과학 체험관";
    recordPlay(id);
    var P=EXP.predict;
    var root=document.getElementById("app");
    var tabsHtml=[["try","① 해보기"],["obs","② 관찰 질문"],["why","③ 왜 그럴까?"],["more","④ 더 해보기"]].map(function(t,i){return '<button role="tab" id="t-'+t[0]+'" aria-controls="p-'+t[0]+'" aria-selected="'+(i===0)+'" tabindex="'+(i===0?0:-1)+'">'+t[1]+"</button>"}).join("");
    root.innerHTML=
      '<header class="top"><a class="home" href="'+BASE+'">🔬 과학관</a><span class="crumb"><a href="'+BASE+"gallery/?f="+fid+'">'+esc(fl.emoji+" "+fl.name)+'</a></span><span class="done-chip" id="doneChip" hidden>✔ 완료</span>'+
        (prev?'<a class="nav" href="'+prev.id+'.html'+(present?"?present=1":"")+'" aria-label="이전 체험">‹</a>':'')+(next?'<a class="nav" href="'+next.id+'.html'+(present?"?present=1":"")+'" aria-label="다음 체험">›</a>':'')+'</header>'+
      '<h1 class="exp-title">'+esc(me.id)+'. '+esc(me.title)+'</h1>'+
      '<div class="exp-grid">'+
        '<section class="predict" aria-labelledby="ph"><h2 id="ph">🤔 먼저 예측해 보세요</h2><p class="q">'+esc(P.q)+'</p><div class="opts" role="group" aria-label="예측 선택">'+
          P.options.map(function(o,i){return '<button type="button" data-i="'+i+'" aria-pressed="false">'+esc(o)+"</button>"}).join("")+
        '</div><div class="res" id="predRes" aria-live="polite"></div></section>'+
        '<section class="stage locked" id="stage" aria-label="체험 영역"><div class="stage-body" id="stageBody"></div></section>'+
      '</div>'+
      '<div class="bottom-row"><button type="button" class="primary" id="openInfo" aria-haspopup="dialog">📖 설명·관찰 질문 보기</button><span class="note">'+esc(me.question)+'</span></div>'+
      '<dialog id="info" aria-labelledby="infoTitle"><div class="info-head"><h2 id="infoTitle">'+esc(me.title)+'</h2><button type="button" id="closeInfo" aria-label="닫기">✕</button></div>'+
        '<div class="tabs" role="tablist" aria-label="체험 안내">'+tabsHtml+'</div>'+
        '<div class="panel" role="tabpanel" id="p-try" aria-labelledby="t-try"><ol>'+EXP.steps.map(function(s2){return "<li>"+esc(s2)+"</li>"}).join("")+"</ol></div>"+
        '<div class="panel" role="tabpanel" id="p-obs" aria-labelledby="t-obs" hidden><ul>'+EXP.observe.map(function(s2){return "<li>"+esc(s2)+"</li>"}).join("")+"</ul></div>"+
        '<div class="panel" role="tabpanel" id="p-why" aria-labelledby="t-why" hidden><div class="seg" role="group" aria-label="설명 수준"><button type="button" data-lv="easy" aria-pressed="true">쉬운 설명</button><button type="button" data-lv="detail" aria-pressed="false">자세한 설명</button></div><div id="whyBody"></div></div>'+
        '<div class="panel" role="tabpanel" id="p-more" aria-labelledby="t-more" hidden><ul>'+EXP.more.map(function(s2){return "<li>"+esc(s2)+"</li>"}).join("")+"</ul></div>"+
        '<p class="foot-note">진행 기록은 이 기기 브라우저에만 저장되고, 어디로도 보내지 않아요. Exploratorium에서 영감을 받았으나 관련 없는 독립 사이트입니다.</p></dialog>';
    if(isDone(s,id))document.getElementById("doneChip").hidden=false;
    Exp.stageEl=document.getElementById("stageBody");
    /* 체험 영역을 실제로 만졌는지 기록(버튼만 누른 경우는 별 제외) */
    ["pointerdown","keydown","input","change"].forEach(function(t){document.getElementById("stage").addEventListener(t,function(e){
      if(e.target.closest&&e.target.closest("button"))return; /* 확인·다시 하기 같은 버튼은 조작이 아님 */
      Exp.touched=true},true)});
    /* 예측 */
    var pb=root.querySelectorAll(".opts button");
    pb.forEach(function(b){b.addEventListener("click",function(){
      if(Exp.choice!=null&&Exp.revealed)return;
      Exp.choice=+b.dataset.i;pb.forEach(function(x){x.setAttribute("aria-pressed",x===b)});root.querySelector(".predict").classList.add("answered");if(typeof fitOneScreen==="function")fitOneScreen();
      document.getElementById("stage").classList.remove("locked");
      if(EXP.start)EXP.start();
    })});
    /* 설명 창 */
    var info=document.getElementById("info");
    document.getElementById("openInfo").addEventListener("click",function(){if(info.showModal)info.showModal();else info.setAttribute("open","")});
    document.getElementById("closeInfo").addEventListener("click",function(){info.close?info.close():info.removeAttribute("open")});
    info.addEventListener("click",function(e){if(e.target===info)info.close()});
    /* 탭 */
    var tabs=[].slice.call(info.querySelectorAll('[role=tab]'));
    function sel(t){tabs.forEach(function(x){var on=x===t;x.setAttribute("aria-selected",on);x.tabIndex=on?0:-1;document.getElementById(x.getAttribute("aria-controls")).hidden=!on});t.focus()}
    tabs.forEach(function(t,i){t.addEventListener("click",function(){sel(t)});t.addEventListener("keydown",function(e){
      var k=e.key==="ArrowRight"?1:e.key==="ArrowLeft"?-1:0;if(k){e.preventDefault();sel(tabs[(i+k+tabs.length)%tabs.length])}})});
    /* 설명 수준 */
    var why=document.getElementById("whyBody");
    function showWhy(l){why.innerHTML=EXP.why[l].map(function(p){return "<p>"+p+"</p>"}).join("");
      info.querySelectorAll("[data-lv]").forEach(function(b){b.setAttribute("aria-pressed",b.dataset.lv===l)})}
    info.querySelectorAll("[data-lv]").forEach(function(b){b.addEventListener("click",function(){showWhy(b.dataset.lv)})});
    showWhy("easy");
    EXP.init(Exp.stageEl);
    /* 창 안에서 한 화면을 넘으면 전체를 비율만큼 줄여 한 화면에 맞춤 (너무 작아지면 그대로 두고 스크롤) */
    function fitOneScreen(){
      if(!document.body.classList.contains("in-modal"))return;
      document.body.style.zoom="1";
      var sh=document.documentElement.scrollHeight,ih=innerHeight;
      if(sh>ih+2){var z=ih/sh;document.body.style.zoom=z>=0.72?String(z):"1"}
    }
    fitOneScreen();
    window.addEventListener("resize",fitOneScreen);
    /* 그림 아래의 고정 설명 문장은 설명 창으로 옮겨 화면을 줄임 (결과 메시지·id 있는 글은 그대로) */
    var fixedNotes=[].slice.call(Exp.stageEl.querySelectorAll("p.note:not([id]):not([aria-live]), :scope > .tip"));
    if(fixedNotes.length){var box=document.createElement("div");box.className="stage-notes";fixedNotes.forEach(function(n){box.appendChild(n)});info.insertBefore(box,info.querySelector(".foot-note"))}
    /* 휴대폰: 첫 조작 줄과 주요 실행 버튼만 보이고, 나머지 설정은 '설정 더 보기'로 접음 (노드를 옮길 뿐이라 기능은 그대로) */
    if(innerWidth<900){
      var blocks=[].slice.call(Exp.stageEl.querySelectorAll(":scope > .controls"));
      var rest=blocks.slice(1).filter(function(b){return !b.querySelector("button.primary")&&!/확인|놓기|출발|던지|흘리기|시작|생성|보기|만들|계산/.test(b.textContent)});
      if(rest.length>=1){
        var det=document.createElement("details");det.className="more-controls";
        det.innerHTML='<summary>⚙️ 설정 더 보기</summary>';
        rest.forEach(function(b){det.appendChild(b)});
        var anchor=Exp.stageEl.querySelector(":scope > .controls");
        Exp.stageEl.insertBefore(det,anchor?anchor.nextSibling:null);
      }
    }
    /* 그림 아래의 고정 설명 문장은 설명 창으로 옮겨 화면을 줄임 (결과 메시지·id 있는 글은 그대로) */
    var fixedNotes=[].slice.call(Exp.stageEl.querySelectorAll("p.note:not([id]):not([aria-live])"));
    if(fixedNotes.length){var box=document.createElement("div");box.className="stage-notes";fixedNotes.forEach(function(n){box.appendChild(n)});info.insertBefore(box,info.querySelector(".foot-note"))}
  });
}
window.Sci={initHome:initHome,initGallery:initGallery,initExp:initExp,esc:esc,FLOORS:FLOORS,
  /* 캔버스를 CSS 너비에 맞춰 선명하게 */
  fit:function(cv,ratio){var pw=cv.parentNode.clientWidth,capH=innerHeight*(innerWidth<900?0.30:0.55),capW=Math.max(200,capH/ratio),w=Math.min(pw,capW),dpr=window.devicePixelRatio||1;cv.style.width=w+"px";cv.width=Math.round(w*dpr);cv.height=Math.round(w*ratio*dpr);cv.style.height=(w*ratio)+"px";var c=cv.getContext("2d");c.setTransform(dpr,0,0,dpr,0,0);return {c:c,w:w,h:w*ratio}}};
})();
