/* 온라인 과학 체험관 공통 스크립트
   - 수학 놀이터(mathplay)와 같은 구성: 허브(프로필·등급·미션·배지·층별 타일) → 체험 창(시작 화면 → 체험)
   - 체험 파일(exp/*.html)은 window.EXP 를 정의하고 Sci.initExp() 를 부른다. 체험 내용 코드는 Exp.stageEl 안에 그린다.
   - 기록은 이 기기 브라우저(localStorage)에만 저장한다. 서버로 보내지 않는다. */
(function(){
"use strict";
var BASE=location.pathname.replace(/\/(exp|gallery)\/[^\/]*$/,"/").replace(/\/index\.html$/,"/");
if(!/\/$/.test(BASE))BASE+="/";
var IN_MODAL=/[?&]modal=1/.test(location.search);
var present=/[?&]present=1/.test(location.search);

/* ───── 층: 갤러리 7개를 4개 층으로 묶음 ───── */
var FLOORS=[
 {id:1,label:"1층",name:"보고 듣는 마당",emoji:"🎈",desc:"눈과 귀로 먼저 만나요",zone:"#e8552f",soft:"#fdeae4",grad:["#ff9a5a","#ff5e7e"],scene:"play"},
 {id:2,label:"2층",name:"힘과 만들기 연구소",emoji:"🚀",desc:"움직이고 만들며 원리를 찾아요",zone:"#2563eb",soft:"#e3ecfd",grad:["#4fc3ff","#6a5cff"],scene:"lab"},
 {id:3,label:"3층",name:"몸과 생명 박물관",emoji:"🧬",desc:"사람과 생물을 관찰해요",zone:"#0d9488",soft:"#dcf3f0",grad:["#34d399","#3b82f6"],scene:"life"},
 {id:4,label:"4층",name:"지구·우주 관찰대",emoji:"🔭",desc:"하늘과 땅을 살펴봐요",zone:"#7c3aed",soft:"#efe7fd",grad:["#b78cff","#5b6cff"],scene:"space"}
];
var FLOOR_OF={see:1,hear:1,move:2,make:2,us:3,life:3,look:4};
var GNAME={see:"보기",hear:"듣기",move:"움직임",us:"우리",life:"생명",look:"관찰",make:"손으로 생각하기"};

/* 썸네일 그림: 주인공(e) + 친구(e2) */
var ART={
 A1:["📏","✨"],A2:["🎨","🌈"],A3:["👁️","💫"],A4:["🔲","🤔"],A5:["🔦","🟥"],A6:["🛞","💨"],A7:["👀","❓"],A8:["🪞","🔦"],
 B1:["🎵","🔊"],B2:["🌊","🎶"],B3:["🎤","📈"],B4:["🚑","💨"],B5:["🎷","🎵"],B6:["🔇","〰️"],
 C1:["⏱️","🪀"],C2:["🌕","🏀"],C3:["🚗","💥"],C4:["⛸️","🌀"],C5:["⚽","🌀"],C6:["🌊","💧"],C7:["🦋","🌀"],C8:["🎢","😆"],C9:["📦","🛝"],
 D1:["⚡","👆"],D2:["🔤","🎨"],D3:["🔍","🏀"],D4:["🧠","🔢"],D5:["✏️","🪞"],D6:["👓","⚫"],
 E1:["🦊","🐰"],E2:["🌱","☀️"],E3:["🫛","🌿"],E4:["💓","🏃"],E5:["🐛","🐦"],
 F1:["🕛","☀️"],F2:["🌗","🌍"],F3:["🪨","📈"],F4:["🌏","☀️"],F5:["🌑","☀️"],F6:["🌊","🌙"],F7:["⭐","🔭"],F8:["🪐","☀️"],F9:["🌅","🕰️"],
 G1:["⚖️","🐘"],G2:["🌉","🚚"],G3:["🏗️","💪"],G4:["💡","🔋"],G5:["⚙️","🔄"]
};
var PALETTE=[["#7dd3fc","#0ea5e9"],["#6ee7b7","#10b981"],["#fde047","#f59e0b"],["#c4b5fd","#7c3aed"],["#fdba74","#f97316"],["#f9a8d4","#ec4899"],["#93c5fd","#3b82f6"],["#fca5a5","#ef4444"],["#5eead4","#14b8a6"],["#d8b4fe","#a855f7"]];

var RANKS=[
 {at:0,icon:"🐣",name:"새싹 탐험가"},
 {at:5,icon:"🔍",name:"꼬마 관찰자"},
 {at:15,icon:"🧪",name:"실험 조수"},
 {at:30,icon:"🔬",name:"호기심 연구원"},
 {at:55,icon:"🚀",name:"과학 탐험대장"},
 {at:90,icon:"🏆",name:"과학 마스터"}
];
var AVATARS=["🐣","🐰","🐻","🐼","🐯","🦊","🐨","🐸","🐧","🐙","🦖","🐳"];

/* ───── 기록(이 기기에만) ───── */
var KEY="penedu:science:save";
function blank(){return {v:1,done:{},plays:{},recent:[],days:[],name:"",avatar:"🐣",today:{date:"",done:[]}}}
function load(){try{var r=localStorage.getItem(KEY);if(r){var o=JSON.parse(r);var b=blank();for(var k in o)b[k]=o[k];return b}}catch(e){}return blank()}
function store(s){try{localStorage.setItem(KEY,JSON.stringify(s))}catch(e){}}
function dayKey(d){d=d||new Date();return d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2)}
function markDay(s){var k=dayKey();if(s.days.indexOf(k)<0)s.days=s.days.concat([k]).slice(-120)}
function recordPlay(id){var s=load();s.plays[id]=(s.plays[id]||0)+1;s.recent=[id].concat((s.recent||[]).filter(function(x){return x!==id})).slice(0,8);markDay(s);store(s)}
function recordDone(id){var s=load(),k=dayKey();if(s.today.date!==k)s.today={date:k,done:[]};if(s.today.done.indexOf(id)<0)s.today.done=s.today.done.concat([id]);s.done[id]=(s.done[id]||0)+1;markDay(s);store(s)}
/* 성공 횟수 → 별 0~3개 (1번 ★, 3번 ★★, 5번 ★★★) */
function starsOf(n){n=n||0;return n>=5?3:n>=3?2:n>=1?1:0}
function totalStars(s){var t=0;for(var k in s.done)t+=starsOf(s.done[k]);return t}
function streakOf(s){var n=0,d=new Date();if(s.days.indexOf(dayKey(d))<0)d.setDate(d.getDate()-1);while(s.days.indexOf(dayKey(d))>=0){n++;d.setDate(d.getDate()-1)}return n}
function rankOf(t){var i=0;RANKS.forEach(function(r,k){if(t>=r.at)i=k});var nx=RANKS[i+1];return {icon:RANKS[i].icon,name:RANKS[i].name,next:nx,pct:nx?Math.round((t-RANKS[i].at)*100/(nx.at-RANKS[i].at)):100}}
function badgesOf(list,s){
  var byF=function(f){return list.filter(function(e){return FLOOR_OF[e.gallery]===f}).map(function(e){return e.id})};
  var has=function(ids){return ids.length>0&&ids.every(function(id){return starsOf(s.done[id])>=1})};
  var played=Object.keys(s.plays).length,tot=totalStars(s);
  return [
   {icon:"⭐",name:"첫 별",how:"아무 체험에서 별 1개",ok:tot>=1},
   {icon:"🧭",name:"탐험가",how:"체험 3가지 해 보기",ok:played>=3},
   {icon:"🗺️",name:"모험가",how:"체험 10가지 해 보기",ok:played>=10},
   {icon:"🌟",name:"별 수집가",how:"별 20개 모으기",ok:tot>=20},
   {icon:"🎈",name:"1층 정복",how:"1층 체험마다 별 1개 이상",ok:has(byF(1))},
   {icon:"🚀",name:"2층 정복",how:"2층 체험마다 별 1개 이상",ok:has(byF(2))},
   {icon:"🧬",name:"3층 정복",how:"3층 체험마다 별 1개 이상",ok:has(byF(3))},
   {icon:"🔭",name:"4층 정복",how:"4층 체험마다 별 1개 이상",ok:has(byF(4))},
   {icon:"🔥",name:"3일 연속",how:"3일 연속 탐험하기",ok:streakOf(s)>=3},
   {icon:"🏆",name:"과학관 완주",how:"모든 체험에서 별 받기",ok:has(list.map(function(e){return e.id}))}
  ];
}

function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function loadData(){return fetch(BASE+"data/experiences.json").then(function(r){return r.json()})}
function floorOf(e){return FLOORS[FLOOR_OF[e.gallery]-1]}
function stars3(n,light){return '<span class="stars3'+(light?' light':'')+'" aria-label="별 '+n+'개"><b>'+"★".repeat(n)+'</b><i>'+"★".repeat(3-n)+'</i></span>'}

/* ───── 썸네일: 층마다 다른 배경 장면 + 반짝이 + 큰 주인공 + 작은 친구 ───── */
var thumbSeq=0;
function thumb(e,idx,big,bob){
  var a=ART[e.id]||["🔬",""],c=PALETTE[idx%PALETTE.length],f=floorOf(e),gid="th"+(++thumbSeq);
  var scene={
   play:'<ellipse cx="18" cy="104" rx="46" ry="26" fill="#fff" opacity=".22"/><ellipse cx="86" cy="108" rx="44" ry="28" fill="#fff" opacity=".18"/><g fill="#fff" opacity=".55"><ellipse cx="22" cy="18" rx="11" ry="5"/><ellipse cx="29" cy="15" rx="7" ry="5"/></g>',
   lab:'<g stroke="#fff" opacity=".22" fill="none"><path d="M20 0V100M40 0V100M60 0V100M80 0V100M0 20H100M0 40H100M0 60H100M0 80H100" stroke-width=".8"/><ellipse cx="50" cy="52" rx="44" ry="16" stroke-width="2" transform="rotate(-18 50 52)"/></g>',
   life:'<g fill="#fff" opacity=".22"><circle cx="16" cy="86" r="14"/><circle cx="88" cy="20" r="10"/><circle cx="84" cy="90" r="7"/><circle cx="10" cy="56" r="4"/></g><path d="M8 30Q20 8 34 20Q22 36 8 30Z" fill="#fff" opacity=".35"/>',
   space:'<g fill="#fff" opacity=".8"><circle cx="14" cy="14" r="1.4"/><circle cx="34" cy="8" r="1"/><circle cx="90" cy="40" r="1.2"/><circle cx="12" cy="70" r="1"/><circle cx="60" cy="92" r="1.3"/></g><circle cx="80" cy="82" r="10" fill="#fff" opacity=".22"/><ellipse cx="80" cy="82" rx="22" ry="6" fill="none" stroke="#fff" stroke-width="2" opacity=".35"/>'
  }[f.scene];
  var spark=[[80,16,4],[12,44,2.6],[70,82,2.4]].map(function(p){var x=p[0],y=p[1],r=p[2];return '<path d="M'+x+' '+(y-r*2)+'Q'+x+' '+y+' '+(x+r*2)+' '+y+'Q'+x+' '+y+' '+x+' '+(y+r*2)+'Q'+x+' '+y+' '+(x-r*2)+' '+y+'Q'+x+' '+y+' '+x+' '+(y-r*2)+'Z" fill="#fff" opacity=".85"/>'}).join("");
  return '<div class="thumb'+(big?" lg":"")+'" aria-hidden="true"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><defs><radialGradient id="'+gid+'" cx="30%" cy="22%" r="90%"><stop offset="0" stop-color="'+c[0]+'"/><stop offset="1" stop-color="'+c[1]+'"/></radialGradient></defs><rect width="100" height="100" fill="url(#'+gid+')"/>'+scene+spark+'<circle cx="50" cy="50" r="27" fill="#fff" opacity=".25"/></svg>'+
    '<span class="th-e'+(bob?" gz-bob":"")+'">'+a[0]+'</span>'+(a[1]?'<span class="th-e2">'+a[1]+'</span>':"")+'</div>';
}

/* ───── 허브 ───── */
var DATA=null,IDX={};
function todayPick(list){var d=new Date();var n=d.getFullYear()*372+d.getMonth()*31+d.getDate();return list[n%list.length]}
function tile(e,s,todayId){
  var fresh=!s.plays[e.id];
  var tag=e.id===todayId?'<span class="t-tag today">⭐ 오늘</span>':fresh?'<span class="t-tag new">NEW</span>':"";
  return '<button type="button" class="tile" data-open="'+e.id+'" aria-label="'+esc(e.title)+'">'+
    '<div class="tile-art">'+thumb(e,IDX[e.id])+'</div>'+tag+
    '<div class="tile-body"><h3>'+esc(e.title)+'</h3><p>'+esc(e.question)+'</p></div></button>';
}
function homeHTML(d,s,f){
  var list=d.experiences,today=todayPick(list),tot=totalStars(s),rk=rankOf(tot),st=streakOf(s);
  var missionDone=s.today.date===dayKey()&&s.today.done.indexOf(today.id)>=0;
  var bs=badgesOf(list,s),bOk=bs.filter(function(b){return b.ok}).length;
  var recent=(s.recent||[]).map(function(id){return list.filter(function(e){return e.id===id})[0]}).filter(Boolean).slice(0,6);
  var floors=f?FLOORS.filter(function(x){return x.id===f}):FLOORS;
  var h='';
  h+='<div class="hub-top"><a class="back" href="https://penedu.web.app/"><span>←</span> 살빠진 임선생과 함께하는 교육자료</a>'+
     '<button type="button" class="me" data-act="profile" aria-label="내 프로필 열기"><span class="av">'+esc(s.avatar||"🐣")+'</span><span class="nm">'+esc(s.name||"이름 정하기")+'</span><span class="st">⭐ '+tot+'</span></button></div>';
  h+='<header class="hub-head"><div class="hh-l"><span class="hh-ic" aria-hidden="true">🔬</span><div><h1>과학 체험관</h1><p>먼저 예측하고, 만져 보고, 이유를 찾아요!</p></div></div>'+
     '<button type="button" class="hh-rand" data-act="random">🎲 아무 체험이나!</button></header>';
  h+='<section class="hub-stats" aria-label="내 탐험 현황">'+
     '<button type="button" class="sc" data-act="profile"><p class="k">내 등급</p><p class="v">'+rk.icon+' '+rk.name+'</p><div class="bar"><i style="width:'+rk.pct+'%"></i></div><p class="s">'+(rk.next?'다음 '+rk.next.icon+'까지 ⭐ '+(rk.next.at-tot):"최고 등급!")+'</p></button>'+
     '<div class="sc"><p class="k">연속 탐험</p><p class="v big fire">🔥 '+st+'일</p><p class="s">'+(st?"내일도 와서 이어 가요!":"오늘 하나 해 볼까요?")+'</p></div>'+
     '<button type="button" class="sc mission'+(missionDone?" done":"")+'" data-open="'+today.id+'"><p class="k">🎯 오늘의 미션</p><p class="v">‘'+esc(today.title)+'’에서 별 받기</p><p class="s go">'+(missionDone?"✅ 미션 완료!":"▶ 지금 하러 가기")+'</p></button>'+
     '<button type="button" class="sc" data-act="profile"><p class="k">모은 배지</p><p class="v big badge">🏅 '+bOk+'/'+bs.length+'</p><p class="s">눌러서 배지 보기</p></button></section>';
  if(recent.length){
    h+='<section class="hub-sec"><h2 class="sec-t">🕹️ 최근에 한 체험</h2><ul class="recent">'+recent.map(function(e){return '<li><button type="button" class="rc" data-open="'+e.id+'">'+thumb(e,IDX[e.id])+'<span>'+esc(e.title)+'</span></button></li>'}).join("")+'</ul></section>';
  }
  h+='<nav class="chips" id="games" aria-label="층 고르기"><button type="button" data-floor="0" aria-pressed="'+(!f)+'" class="chip-f'+(!f?" on-all":"")+'">🏠 전체 '+list.length+'</button>'+
     FLOORS.map(function(x){var on=f===x.id;return '<button type="button" data-floor="'+x.id+'" aria-pressed="'+on+'" class="chip-f" style="'+(on?'background:linear-gradient(90deg,'+x.grad[0]+','+x.grad[1]+');color:#fff':'')+'">'+x.emoji+' '+x.label+' '+x.name+'</button>'}).join("")+'</nav>';
  floors.forEach(function(fl){
    var items=list.filter(function(e){return FLOOR_OF[e.gallery]===fl.id});
    var got=items.reduce(function(a,e){return a+starsOf(s.done[e.id])},0),all=items.length*3;
    h+='<section class="floor-sec"><div class="fs-head"><span class="fs-ic" style="background:linear-gradient(135deg,'+fl.grad[0]+','+fl.grad[1]+')" aria-hidden="true">'+fl.emoji+'</span>'+
       '<div class="fs-t"><h2>'+fl.label+' '+fl.name+'</h2><p>'+fl.desc+'</p></div>'+
       '<div class="fs-p"><p>⭐ '+got+' / '+all+'</p><div class="bar"><i style="width:'+(all?got*100/all:0)+'%;background:linear-gradient(90deg,'+fl.grad[0]+','+fl.grad[1]+')"></i></div></div></div>'+
       '<ul class="tiles">'+items.map(function(e){return '<li>'+tile(e,s,today.id)+'</li>'}).join("")+'</ul></section>';
  });
  h+='<details class="hub-more"><summary>🔬 이 체험관은 어떤 곳인가요?</summary><p>예측 → 조작 → 관찰 → 이유 확인 순서로 진행하는 웹 과학 체험이에요. 체험마다 별을 모으고, 다섯 번 해내면 별 세 개가 돼요. 기록은 이 기기의 브라우저에만 저장되고 어디로도 보내지 않아요.</p><p>Exploratorium에서 영감을 받았지만 관련 없는 독립 사이트예요. 체험 내용과 그림은 모두 새로 만들었어요. 수업 화면용으로 크게 보려면 주소 뒤에 <code>?present=1</code>을 붙여요.</p></details>';
  return h;
}
function initHome(){
  var app=document.getElementById("app");
  loadData().then(function(d){
    DATA=d;d.experiences.forEach(function(e,i){IDX[e.id]=i});
    var f=parseInt((location.search.match(/[?&]f=(\d)/)||[])[1]||"0",10)||0;
    function render(){app.innerHTML=homeHTML(d,load(),f)}
    render();
    app.addEventListener("click",function(ev){
      var t=ev.target.closest("[data-open],[data-act],[data-floor]");if(!t)return;
      if(t.dataset.open)return openGame(t.dataset.open);
      if(t.dataset.floor!=null){f=+t.dataset.floor;var u=new URL(location.href);if(f)u.searchParams.set("f",f);else u.searchParams.delete("f");history.replaceState(null,"",u);render();var g=document.getElementById("games");if(g)g.scrollIntoView({behavior:"smooth",block:"start"});return}
      if(t.dataset.act==="random"){var L=d.experiences;openGame(L[Math.floor(Math.random()*L.length)].id);return}
      if(t.dataset.act==="profile")openProfile(render);
    });
    window.addEventListener("message",function(m){
      if(m.origin!==location.origin||!m.data)return;
      if(m.data.sciDone){gameChanged=true;refreshGameHead()}
      if(m.data.sciRandom){var L=d.experiences.filter(function(e){return e.id!==curGame});openGame(L[Math.floor(Math.random()*L.length)].id)}
      if(m.data.sciClose)closeGame();
    });
    HOME_RENDER=render;
    var g0=(location.search.match(/[?&]g=([A-Z]\d+)/)||[])[1];
    if(g0&&IDX[g0]!=null)openGame(g0);
  });
}
var HOME_RENDER=null,curGame=null,gameChanged=false;

/* ───── 체험 창 (화면 가득, 위 막대: 썸네일·제목·별·층 / ❓ 🎲 ✕) ───── */
function gameHeadHTML(e,s,showBack){
  var f=floorOf(e),n=starsOf(s.done[e.id]);
  return '<header class="g-head" style="background:linear-gradient(90deg,'+f.grad[0]+','+f.grad[1]+')">'+
    '<span class="g-th">'+thumb(e,IDX[e.id])+'</span>'+
    '<div class="g-tx"><h2>'+esc(e.title)+'</h2><p>'+stars3(n,true)+' '+f.emoji+' '+f.label+' '+f.name+'</p></div>'+
    '<button type="button" class="g-ic" data-g="help" aria-label="하는 방법 보기">❓</button>'+
    '<button type="button" class="g-ic hide-sm" data-g="random" aria-label="다른 체험 아무거나">🎲</button>'+
    (showBack?'<a class="g-ic g-x" href="'+BASE+'" aria-label="체험관으로 돌아가기">✕</a>':'<button type="button" class="g-ic g-x" data-g="close" aria-label="체험 끄기">✕</button>')+
  '</header>';
}
function ensureModal(){
  var m=document.getElementById("gModal");if(m)return m;
  m=document.createElement("div");m.id="gModal";m.className="g-modal";m.hidden=true;
  m.setAttribute("role","dialog");m.setAttribute("aria-modal","true");
  m.innerHTML='<div class="g-box"><div id="gHead"></div><iframe id="gFrame" title="체험 화면"></iframe></div>';
  document.body.appendChild(m);
  m.addEventListener("click",function(ev){
    var b=ev.target.closest("[data-g]");
    if(!b){if(ev.target===m)closeGame();return}
    var fr=document.getElementById("gFrame");
    if(b.dataset.g==="close")closeGame();
    else if(b.dataset.g==="help"&&fr.contentWindow)fr.contentWindow.postMessage({sci:"help"},location.origin);
    else if(b.dataset.g==="random"){var L=DATA.experiences.filter(function(e){return e.id!==curGame});openGame(L[Math.floor(Math.random()*L.length)].id)}
  });
  document.addEventListener("keydown",function(ev){if(!m.hidden&&ev.key==="Escape")closeGame()});
  return m;
}
function refreshGameHead(){
  if(!curGame)return;var e=DATA.experiences[IDX[curGame]];
  document.getElementById("gHead").innerHTML=gameHeadHTML(e,load(),false);
}
function openGame(id){
  if(!DATA||IDX[id]==null)return;
  var m=ensureModal(),e=DATA.experiences[IDX[id]];curGame=id;
  refreshGameHead();
  document.getElementById("gFrame").src=BASE+"exp/"+id+".html?modal=1"+(present?"&present=1":"");
  m.hidden=false;document.body.style.overflow="hidden";
  var u=new URL(location.href);u.searchParams.set("g",id);history.replaceState(null,"",u);
  setTimeout(function(){var x=m.querySelector(".g-x");if(x)x.focus()},50);
}
function closeGame(){
  var m=document.getElementById("gModal");if(!m||m.hidden)return;
  m.hidden=true;document.getElementById("gFrame").src="about:blank";document.body.style.overflow="";
  var u=new URL(location.href);u.searchParams.delete("g");history.replaceState(null,"",u);
  curGame=null;if(gameChanged&&HOME_RENDER){gameChanged=false;HOME_RENDER()}
}

/* ───── 내 프로필: 캐릭터·이름·등급·배지 ───── */
function openProfile(after){
  var s=load(),list=DATA.experiences,tot=totalStars(s),rk=rankOf(tot),bs=badgesOf(list,s);
  var p=document.createElement("div");p.className="pf-wrap";p.setAttribute("role","dialog");p.setAttribute("aria-modal","true");p.setAttribute("aria-label","내 프로필");
  p.innerHTML='<div class="pf gz-pop"><div class="pf-h"><h2>내 프로필</h2><button type="button" class="g-ic g-x" data-p="close" aria-label="닫기">✕</button></div>'+
   '<div class="pf-card"><span class="pf-av">'+esc(s.avatar)+'</span><label class="pf-nm"><span>내 이름(별명)</span><input id="pfName" maxlength="8" value="'+esc(s.name)+'" placeholder="별명을 써요"></label></div>'+
   '<p class="pf-t">캐릭터 고르기</p><div class="pf-avs">'+AVATARS.map(function(a){return '<button type="button" data-av="'+a+'" aria-pressed="'+(s.avatar===a)+'">'+a+'</button>'}).join("")+'</div>'+
   '<div class="pf-card col"><p class="pf-t m0">'+rk.icon+' '+rk.name+(rk.next?' → '+rk.next.icon+' '+rk.next.name:' · 최고 등급!')+'</p><div class="bar big"><i style="width:'+rk.pct+'%"></i></div><p class="pf-s">'+(rk.next?'별 '+(rk.next.at-tot)+'개 더 모으면 등급이 올라가요!':'모든 등급을 다 올랐어요!')+'</p></div>'+
   '<p class="pf-t">🏅 배지 '+bs.filter(function(b){return b.ok}).length+'/'+bs.length+'</p><ul class="pf-bs">'+bs.map(function(b){return '<li class="'+(b.ok?"ok":"")+'"><span>'+b.icon+'</span><p class="n">'+b.name+'</p><p class="h">'+(b.ok?"받았어요!":b.how)+'</p></li>'}).join("")+'</ul>'+
   '<p class="pf-s">기록은 이 기기의 브라우저에만 저장돼요. 다른 기기나 선생님에게 보내지 않아요.</p><button type="button" class="pf-reset" data-p="reset">기록 지우기</button></div>';
  document.body.appendChild(p);document.body.style.overflow="hidden";
  function close(){var nm=p.querySelector("#pfName").value.trim();var x=load();x.name=nm;store(x);p.remove();document.body.style.overflow="";after()}
  p.addEventListener("click",function(ev){
    if(ev.target===p)return close();
    var b=ev.target.closest("[data-p],[data-av]");if(!b)return;
    if(b.dataset.av){var x=load();x.avatar=b.dataset.av;store(x);p.querySelector(".pf-av").textContent=b.dataset.av;p.querySelectorAll("[data-av]").forEach(function(y){y.setAttribute("aria-pressed",y===b)});return}
    if(b.dataset.p==="close")close();
    if(b.dataset.p==="reset"&&confirm("별과 배지 기록을 모두 지울까요?")){var o=load(),n=blank();n.name=o.name;n.avatar=o.avatar;store(n);p.remove();document.body.style.overflow="";after()}
  });
  p.addEventListener("keydown",function(ev){if(ev.key==="Escape")close()});
  p.querySelector(".g-x").focus();
}

/* 예전 갤러리 주소는 허브의 층으로 보낸다 */
function initGallery(){var f=(location.search.match(/[?&]f=(\d)/)||[])[1];location.replace(BASE+(f?"?f="+f:""))}

/* ───── 체험 효과: 별 알림 + 색종이 ───── */
function toast(msg){var t=document.createElement("div");t.className="g-toast gz-pop";t.setAttribute("aria-live","polite");t.textContent=msg;document.body.appendChild(t);setTimeout(function(){t.remove()},1700)}
function confetti(){
  if(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  var c=document.createElement("canvas");c.style.cssText="position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:80";
  var W=innerWidth,H=innerHeight,dpr=Math.min(2,devicePixelRatio||1);c.width=W*dpr;c.height=H*dpr;document.body.appendChild(c);
  var x=c.getContext("2d");x.scale(dpr,dpr);var cols=["#f43f5e","#f59e0b","#10b981","#3b82f6","#8b5cf6","#eab308"];
  var ps=[];for(var i=0;i<70;i++)ps.push({x:W/2+(Math.random()-.5)*W*.3,y:H*.45,vx:(Math.random()-.5)*9,vy:-Math.random()*11-3,r:Math.random()*6+3,c:cols[i%6],a:Math.random()*6});
  var t0=performance.now();
  (function loop(now){var t=(now-t0)/1000;x.clearRect(0,0,W,H);ps.forEach(function(p){p.vy+=.35;p.x+=p.vx;p.y+=p.vy;p.a+=.2;x.save();x.globalAlpha=Math.max(0,1-t/1.4);x.translate(p.x,p.y);x.rotate(p.a);x.fillStyle=p.c;x.fillRect(-p.r/2,-p.r/4,p.r,p.r/2);x.restore()});if(t<1.4)requestAnimationFrame(loop);else c.remove()})(t0);
}

/* ───── 체험 페이지: 시작 화면(예측 고르기) → 체험 ───── */
window.Exp={
  stageEl:null,revealed:false,choice:null,touched:false,counted:false,
  onReveal:function(fn){Exp._l.push(fn)},_l:[],
  /* 별은 '예측 선택 + 직접 조작 + 확인'을 모두 해야 한 번 기록된다 */
  reveal:function(){
    if(!Exp.counted&&Exp.choice!=null&&Exp.touched){
      Exp.counted=true;recordDone(EXP.id);toast("+⭐ 잘했어요!");confetti();
      if(IN_MODAL&&window.parent!==window)window.parent.postMessage({sciDone:EXP.id},location.origin);
      else{var h=document.querySelector(".g-head .stars3");if(h)h.outerHTML=stars3(starsOf(load().done[EXP.id]),true)}
    }
    if(Exp.revealed)return;Exp.revealed=true;
    var P=EXP.predict,res=document.getElementById("predRes");
    if(Exp.choice!=null&&res){
      var ok=P.answer==null||Exp.choice===P.answer;
      res.className="say "+(ok?"ok":"bad")+" gz-pop";res.innerHTML='<span class="face">'+(ok?"🥳":"😮")+'</span><span>'+esc(P.feedback[Exp.choice])+'</span>';res.hidden=false;
      fitOneScreen();
    }
    Exp._l.forEach(function(f){f()});
  }
};
/* 창 안에서 한 화면을 넘으면 전체를 비율만큼 줄여 맞춤(72%보다 작아지면 그대로 두고 스크롤) */
function fitOneScreen(){
  var play=document.getElementById("playView");if(!play||play.hidden)return;
  document.body.style.zoom="1";document.documentElement.classList.remove("fit-ok");
  var sh=document.documentElement.scrollHeight,ih=innerHeight;
  var MIN=innerWidth>=900?0.6:0.7;
  if(sh>ih+2){var z=ih/sh;if(z>=MIN){document.body.style.zoom=String(z);var sh2=document.documentElement.scrollHeight;if(sh2>ih+2)document.body.style.zoom=String(z*ih/sh2);document.documentElement.classList.add("fit-ok")}}
}
function initExp(){
  var id=EXP.id;
  document.body.classList.add("gamezone");
  if(IN_MODAL)document.body.classList.add("in-modal");
  if(present)document.body.classList.add("present");
  loadData().then(function(d){
    DATA=d;d.experiences.forEach(function(e,i){IDX[e.id]=i});
    var me=d.experiences[IDX[id]],fl=floorOf(me),s=load(),P=EXP.predict;
    /* 체험 그림이 읽는 색 변수: 층 색으로 맞춤 */
    var R=document.documentElement.style;R.setProperty("--zone",fl.zone);R.setProperty("--brand",fl.zone);R.setProperty("--soft",fl.soft);
    document.title=me.title+" · 과학 체험관";
    var how=EXP.steps.slice(0,2).join(" ");
    var app=document.getElementById("app");
    app.innerHTML=(IN_MODAL?"":gameHeadHTML(me,s,true))+
     '<div class="g-body" style="--g1:'+fl.grad[0]+';--g2:'+fl.grad[1]+'">'+
      /* 시작 화면 */
      '<section class="start" id="startView" aria-labelledby="stT">'+
        '<div class="st-th gz-pop">'+thumb(me,IDX[id],true,true)+'</div>'+
        '<h3 id="stT">'+esc(me.title)+'</h3><p class="st-b">'+esc(me.question)+'</p>'+
        '<p class="st-how"><b>어떻게 해요? </b>'+esc(how)+'</p>'+
        '<button type="button" class="st-go" id="goBtn">▶ 체험 시작!</button>'+
        '<button type="button" class="st-alt" id="randBtn">🎲 다른 체험 할래요</button>'+
      '</section>'+
      /* 체험 화면 */
      '<section class="play" id="playView" hidden>'+
        '<div class="help" id="help" hidden></div>'+
        '<div class="play-top">'+
          '<div class="pred-card gz-pop" id="predCard"><p class="pc-t">🤔 먼저 예측해 보세요</p><p class="pc-q">'+esc(P.q)+'</p>'+
            '<div class="st-opts" role="group" aria-label="예측 고르기">'+P.options.map(function(o,i){return '<button type="button" data-i="'+i+'"><span class="n">'+"ABCD"[i]+'</span><span>'+esc(o)+'</span></button>'}).join("")+'</div>'+
            '<p class="st-note">그림을 보고 골라요. 예측은 저장되지 않고, 맞고 틀림보다 이유를 생각하는 게 중요해요.</p></div>'+
          '<p class="say info" id="myPred" hidden></p><div id="predRes" hidden></div></div>'+
        '<div class="board stage locked" id="stage" aria-label="체험 영역"><div class="stage-body" id="stageBody"></div><p class="lock-tip" aria-hidden="true">예측을 먼저 골라요</p></div>'+
        '<div class="play-bot"><button type="button" class="kb soft" id="helpBtn">❓ 어떻게 해요 · 왜 그럴까?</button><span class="done-chip" id="doneChip"'+(starsOf(s.done[id])?"":" hidden")+'>'+stars3(starsOf(s.done[id]))+'</span></div>'+
      '</section>'+
     '</div>';
    if(IN_MODAL){app.parentNode.classList.add("in-modal-wrap")}
    /* 도움말(어떻게 해요 · 관찰 질문 · 왜 그럴까 · 더 해보기) */
    var help=document.getElementById("help");
    help.innerHTML='<p class="hp-t">❓ 어떻게 해요?</p><ol>'+EXP.steps.map(function(x){return "<li>"+esc(x)+"</li>"}).join("")+'</ol>'+
      '<p class="hp-t">👀 관찰 질문</p><ul>'+EXP.observe.map(function(x){return "<li>"+esc(x)+"</li>"}).join("")+'</ul>'+
      '<p class="hp-t">💡 알고 보니…</p><div class="seg" role="group" aria-label="설명 수준"><button type="button" data-lv="easy" aria-pressed="true">쉬운 설명</button><button type="button" data-lv="detail" aria-pressed="false">자세한 설명</button></div><div id="whyBody" class="why"></div>'+
      '<p class="hp-t">🧪 더 해보기</p><ul>'+EXP.more.map(function(x){return "<li>"+esc(x)+"</li>"}).join("")+'</ul>'+
      '<div class="hp-notes" id="hpNotes"></div>'+
      '<p class="hp-foot">Exploratorium에서 영감을 받았으나 관련 없는 독립 사이트예요. 기록은 이 기기에만 저장돼요.</p>'+
      '<button type="button" class="kb primary" id="helpOk">알겠어요!</button>';
    function showWhy(l){document.getElementById("whyBody").innerHTML=EXP.why[l].map(function(p){return "<p>"+p+"</p>"}).join("");help.querySelectorAll("[data-lv]").forEach(function(b){b.setAttribute("aria-pressed",b.dataset.lv===l)})}
    help.querySelectorAll("[data-lv]").forEach(function(b){b.addEventListener("click",function(){showWhy(b.dataset.lv)})});showWhy("easy");
    function toggleHelp(force){
      var startV=document.getElementById("startView");
      if(!startV.hidden){ /* 시작 화면에서는 '어떻게 해요' 상자를 강조 */
        var h=startV.querySelector(".st-how");h.classList.remove("gz-pop");void h.offsetWidth;h.classList.add("gz-pop");return}
      help.hidden=force!=null?!force:!help.hidden;if(!help.hidden){help.scrollIntoView({block:"start"});document.body.style.zoom="1";document.documentElement.classList.remove("fit-ok")}else fitOneScreen()}
    document.getElementById("helpBtn").addEventListener("click",function(){toggleHelp()});
    document.getElementById("helpOk").addEventListener("click",function(){toggleHelp(false)});
    window.addEventListener("message",function(m){if(m.origin===location.origin&&m.data&&m.data.sci==="help")toggleHelp()});
    app.addEventListener("click",function(ev){var b=ev.target.closest("[data-g]");if(!b)return;if(b.dataset.g==="help")toggleHelp();if(b.dataset.g==="random")goRandom()});
    function goRandom(){
      if(IN_MODAL)window.parent.postMessage({sciRandom:true},location.origin);
      else{var L=d.experiences.filter(function(e){return e.id!==id});location.href=BASE+"exp/"+L[Math.floor(Math.random()*L.length)].id+".html"}
    }
    document.getElementById("randBtn").addEventListener("click",goRandom);
    /* 시작 → 체험 화면(그림은 보이되 잠금) → 예측을 고르면 잠금 해제 */
    var go=document.getElementById("goBtn");
    go.addEventListener("click",function(){
      recordPlay(id);
      document.getElementById("startView").hidden=true;
      document.getElementById("playView").hidden=false;
      Exp.stageEl=document.getElementById("stageBody");
      var stage=document.getElementById("stage");
      /* 체험 영역을 실제로 만졌는지 기록(확인·다시 하기 같은 버튼만 누른 경우는 별 제외) */
      ["pointerdown","keydown","input","change"].forEach(function(t){stage.addEventListener(t,function(e){if(stage.classList.contains("locked"))return;if(e.target.closest&&e.target.closest("button"))return;Exp.touched=true},true)});
      EXP.init(Exp.stageEl);
      /* 잠긴 동안에는 키보드로도 조작되지 않게 */
      stage.setAttribute("inert","");
      /* 그림 아래의 고정 설명 문장·안내 카드는 도움말로 옮겨 화면을 줄임(결과 메시지·id 있는 글은 그대로) */
      var fixed=[].slice.call(Exp.stageEl.querySelectorAll("p.note:not([id]):not([aria-live]), :scope > .tip"));
      fixed.forEach(function(n){document.getElementById("hpNotes").appendChild(n)});
      var opts=[].slice.call(document.querySelectorAll("#predCard .st-opts button"));
      opts.forEach(function(b){b.addEventListener("click",function(){
        Exp.choice=+b.dataset.i;
        document.getElementById("predCard").hidden=true;
        var mp=document.getElementById("myPred");mp.hidden=false;
        mp.innerHTML='<span class="face">🙂</span><span><b>내 예측:</b> '+esc(P.options[Exp.choice])+' — 직접 해 보고 확인해요!</span><button type="button" class="re" id="rePick">바꾸기</button>';
        document.getElementById("rePick").addEventListener("click",function(){if(Exp.revealed)return;mp.hidden=true;document.getElementById("predCard").hidden=false;stage.classList.add("locked");stage.setAttribute("inert","");fitOneScreen()});
        stage.classList.remove("locked");stage.removeAttribute("inert");
        if(EXP.start)EXP.start();
        fitOneScreen();
      })});
      fitOneScreen();window.addEventListener("resize",fitOneScreen);
      setTimeout(fitOneScreen,350);setTimeout(fitOneScreen,1200);
      window.scrollTo(0,0);
    });
  });
}

window.Sci={initHome:initHome,initGallery:initGallery,initExp:initExp,esc:esc,FLOORS:FLOORS,
  /* 캔버스를 부모 너비에 맞춰 선명하게. 세로가 화면을 너무 차지하지 않도록 높이 상한을 둔다 */
  fit:function(cv,ratio){var pw=cv.parentNode.clientWidth,capH=innerHeight*(innerWidth<900?0.34:0.5),capW=Math.max(200,capH/ratio),w=Math.min(pw,capW),dpr=Math.min(2,window.devicePixelRatio||1);cv.style.width=w+"px";cv.width=Math.round(w*dpr);cv.height=Math.round(w*ratio*dpr);cv.style.height=(w*ratio)+"px";var c=cv.getContext("2d");c.setTransform(dpr,0,0,dpr,0,0);return {c:c,w:w,h:w*ratio}}};
})();
