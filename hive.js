/* HIVE shell — Services, Announcements, Chat and the Profile hub. (The AI assistant lives in hive-ai.js.)
   Lost & Found (app.js) is the 4th tab. Loaded BEFORE app.js; uses its globals (S, supabase, nav, render, toast, topbar, icon, fmtDate) lazily. */
(function(){
'use strict';
function X(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function ld(k,d){try{var v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}}
function sv(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
function $(id){return document.getElementById(id);}

var DEMO={ /* prototype data — replace with real tables later */
 attendance:[['Data Structures',88],['Operating Systems',72],['DBMS',91],['Maths III',68],['Computer Networks',80]],
 calendar:[['Oct 21','Mid-semester exams begin'],['Oct 28','Fee payment deadline'],['Nov 02','Tech Fest'],['Nov 14','Diwali break begins']],
 timetable:[['9:00','Data Structures','CSE 204'],['10:00','DBMS','CSE 204'],['11:30','Networks Lab','Lab 2'],['2:00','Maths III','Block C-12']],
 leave:[['Dr. Rao','Operating Systems','Today – Oct 18','Classes cancelled'],['Prof. Mehta','Maths III','Oct 19','Substitute: Prof. Iyer']],
 materials:[['Data Structures','Unit 3 – Trees (notes)'],['DBMS','Normalisation worksheet'],['Maths III','Previous year papers'],['Networks','Lab manual v2']]
};
var SEED=[
 {id:'s1',category:'Exams',pinned:true,title:'Mid-semester exam schedule released',body:'Exams begin Oct 21. Hall tickets are available from the exam cell. Carry your ID card.',created_at:'2026-10-14T09:00:00Z'},
 {id:'s2',category:'Fees',pinned:false,title:'Fee payment deadline',body:'Last date to pay semester fees without fine is Oct 28.',created_at:'2026-10-12T09:00:00Z'},
 {id:'s3',category:'Events',pinned:false,title:'Tech Fest registrations open',body:'Register at the Admin Block desk before Oct 30. Teams of up to 4.',created_at:'2026-10-10T09:00:00Z'}
];
var SVC=[
 {k:'leave',t:'Apply for leave',i:'🗓️',d:'Send a leave request',f:[['from','From','date'],['to','To','date'],['reason','Reason','text']]},
 {k:'meal',t:'Book a meal',i:'🍽️',d:'Canteen or mess booking',f:[['meal','Meal','select:Breakfast,Lunch,Snacks,Dinner'],['date','Date','date']]},
 {k:'fees',t:'Pay fees',i:'💳',d:'Prototype: no payment gateway yet',f:[['item','Fee','select:Tuition,Hostel,Exam,Library fine'],['amount','Amount (₹)','number']]},
 {k:'mat',t:'Study materials',i:'📚',d:'Notes and papers'}
];
var PT=[['attendance','Attendance'],['calendar','Calendar'],['timetable','Timetable'],['leave','Faculty leave']];

var H={pt:'attendance',annCat:'All',ann:[],annOk:true,annState:0,annT:0,msgs:[],chatOk:true,chatLoaded:false,chatSig:null,svc:null,reqs:[],lv:null,uid:undefined};

function uk(n){return n+':'+H.uid;}
function com(){return (S.profile&&S.profile.community_id)||'default';}
function nm(){return (S.profile&&S.profile.name)||'Student';}
function sync(){
  var id=S.user?S.user.id:null; if(id===H.uid)return; H.uid=id;
  H.annState=0;H.annT=0;H.ann=[];H.msgs=[];H.chatLoaded=false;H.chatSig=null;H.svc=null;H.lv=null;
  H.reqs=id?ld(uk('hive_reqs'),[]):[];
  /* the old on-device (Ollama) AI saved chats here; the new HIVE AI never uses these, so tidy them away */
  try{if(id){['hive_ai_msgs','hive_ai_watch','hive_ai_active'].forEach(function(k){localStorage.removeItem(uk(k));});}localStorage.removeItem('hive_ai_host');localStorage.removeItem('hive_ai_model');}catch(e){}
}

/* ---------- shared UI ---------- */
var MARK='<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><polygon points="12,2 21,7 21,17 12,22 3,17 3,7" fill="#fbbf24"/><circle cx="12" cy="12" r="3" fill="#0b1220"/></svg>';
function top(title){return '<div class="top"><div class="brand">'+MARK+'<span>'+X(title)+'</span></div><div class="bell" onclick="nav(\'notifications\')">'+icon('icBell',18)+(S.notifications.length?'<span class="dot"></span>':'')+'</div></div>';}
function ico(p){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>';}
var T5=[['acc','acc','Services',ico('<rect x="2" y="7" width="20" height="10" rx="5"/><circle cx="16" cy="12" r="2.5"/>')],
 ['ann','ann','News',ico('<path d="M3 10v4h4l8 5V5L7 10z"/><path d="M19 9a4 4 0 0 1 0 6"/>')],
 ['chat','chat','Chat',ico('<path d="M4 5h16v11H9l-5 4z"/>')],
 ['lf','home','Lost &amp; Found',ico('<circle cx="10" cy="10" r="6"/><path d="M15 15l6 6"/>')],
 ['prof','hprofile','Profile',ico('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-5 5-7 8-7s7 2 8 7"/>')]];
var TAB={acc:'acc',ann:'ann',chat:'chat',home:'lf',browse:'lf',details:'lf',report:'lf',notifications:'lf',stats:'lf',hprofile:'prof',profile:'prof',ai:'prof'};
function bar(){
  var cur=TAB[S.view]||'prof';
  return '<div class="nav nav-main">'+T5.map(function(t){
    return '<button class="navbtn'+(cur===t[0]?' active':'')+'" onclick="nav(\''+t[1]+'\',true);unlockAudio()">'+t[3]+'<span>'+t[2]+'</span></button>';
  }).join('')+'</div>';
}
function md(s){return X(s).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/\n/g,'<br>');}
function dt(v){try{return fmtDate(v);}catch(e){return '';}}

/* ---------- SERVICES (Accessibility) ---------- */
function fieldHTML(k,f){
  var id='sv_'+k+'_'+f[0],t=f[2];
  if(t.indexOf('select:')===0)return '<div class="label">'+f[1]+'</div><select class="input" id="'+id+'">'+t.slice(7).split(',').map(function(o){return '<option>'+X(o)+'</option>';}).join('')+'</select>';
  return '<div class="label">'+f[1]+'</div><input class="input" id="'+id+'" type="'+(t==='text'?'text':t)+'"'+(t==='number'?' min="1" step="1"':'')+(t==='text'?' maxlength="200"':'')+'>';
}
function sServices(){
  var cards=SVC.map(function(s){
    var open=H.svc===s.k, body='';
    if(open&&s.k==='mat')body='<div class="hbody">'+DEMO.materials.map(function(m,i){return '<div class="hrow"><div><b>'+X(m[1])+'</b><div class="hsub">'+X(m[0])+'</div></div><button class="hbtn" onclick="HIVE.openMat('+i+')">Open</button></div>';}).join('')+'</div>';
    else if(open)body='<div class="hbody">'+s.f.map(function(f){return fieldHTML(s.k,f);}).join('')+'<button class="btn btn-primary" style="margin-top:14px" onclick="HIVE.submit(\''+s.k+'\')">Submit</button></div>';
    return '<div class="hcard svc'+(open?' open':'')+'"><div class="hhead" onclick="HIVE.toggleSvc(\''+s.k+'\')"><span class="hico">'+s.i+'</span><div style="flex:1"><b>'+s.t+'</b><div class="hsub">'+s.d+'</div></div><span class="sw'+(open?' on':'')+'"><i></i></span></div>'+body+'</div>';
  }).join('');
  var reqs=H.reqs.slice(0,8).map(function(r){return '<div class="hrow"><div><b>'+X(r.t)+'</b><div class="hsub">'+X(r.s)+'</div></div><span class="tag">'+X(r.st)+'</span></div>';}).join('')||'<div class="hsub">No requests yet.</div>';
  return top('Services')+'<div class="screen"><div class="hh1">Campus services</div><div class="hsub" style="margin-bottom:14px">Tap a service to switch it on.</div>'+cards+'<div class="hh2">My requests</div><div class="hcard">'+reqs+'</div><div class="hsub fine">Prototype: requests are stored on this device only.</div></div>'+bar();
}

/* ---------- ANNOUNCEMENTS ---------- */
function sAnn(){
  var cats=['All'];H.ann.forEach(function(a){if(cats.indexOf(a.category)<0)cats.push(a.category);});
  if(cats.indexOf(H.annCat)<0)H.annCat='All';
  var chips='<div class="hpills">'+cats.map(function(c){return '<button class="hpill'+(c===H.annCat?' on':'')+'" onclick="HIVE.setCat(this.dataset.c)" data-c="'+X(c)+'">'+X(c)+'</button>';}).join('')+'</div>';
  var now=Date.now();var active=H.ann.filter(function(a){return !a.expires_at||new Date(a.expires_at).getTime()>now;});
  var list=active.filter(function(a){return H.annCat==='All'||a.category===H.annCat;}).map(function(a){
    return '<div class="hcard"><div class="hmeta">'+(a.pinned?'📌 ':'')+'<span class="tag">'+X(a.category)+'</span><span>'+X(dt(a.created_at))+'</span></div><b>'+X(a.title)+'</b>'+(a.expires_at?'<div class="hsub expiry-label">Available until '+X(new Date(a.expires_at).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}))+'</div>':'')+'<div class="hsub body">'+md(a.body)+'</div></div>';
  }).join('')||'<div class="hsub">'+(H.annState===1?'Loading…':'No announcements yet.')+'</div>';
  var admin=(S.profile&&S.profile.is_admin===true&&H.annOk)?'<details class="hcard"><summary><b>Post an announcement</b></summary><div class="hbody"><div class="label">Title</div><input class="input" id="aTitle" maxlength="120"><div class="label">Message</div><textarea class="input" id="aBody" rows="3" maxlength="2000"></textarea><div class="label">Category</div><select class="input" id="aCat"><option>General</option><option>Exams</option><option>Fees</option><option>Events</option></select><div class="label">Expiry date &amp; time (optional)</div><input class="input" id="aExpiry" type="datetime-local"><div class="hsub field-hint">Expired announcements are hidden automatically. Leave blank for no expiry.</div><button class="btn btn-primary" style="margin-top:12px" onclick="HIVE.post()">Post</button></div></details>':'';
  var note=H.annOk?'':'<div class="hnote">Showing sample announcements. Run hive.sql in Supabase to enable live posts.</div>';
  return top('Announcements')+'<div class="screen"><div class="hh1">What\'s new</div>'+note+chips+list+admin+'</div>'+bar();
}

/* ---------- CHAT ---------- */
function chatHTML(){
  if(!H.chatLoaded&&H.chatOk)return '<div class="hsub" style="text-align:center">Loading…</div>';
  if(!H.msgs.length)return '<div class="hsub" style="text-align:center">No messages yet. Say hello 👋</div>';
  return H.msgs.map(function(m){
    var mine=S.user&&m.user_id===S.user.id,t=new Date(m.created_at);
    var time=isNaN(t)?'':t.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    return '<div class="msg'+(mine?' me':'')+'">'+(mine?'':'<div class="who">'+X(m.author)+'</div>')+'<div class="bub">'+X(m.body)+'</div><div class="tm">'+time+'</div></div>';
  }).join('');
}
function paintChat(){var el=$('chatList');if(el){el.innerHTML=chatHTML();el.scrollTop=el.scrollHeight;}}
function sChat(){
  var note=H.chatOk?'':'<div class="hnote">Chat service not set up, so messages stay on this device. Run hive.sql in Supabase.</div>';
  return top('Community chat')+note+'<div class="chatlist" id="chatList">'+chatHTML()+'</div><div class="chatbar"><input class="input" id="chatIn" maxlength="500" placeholder="Message your community" onkeydown="if(event.key===\'Enter\')HIVE.send()"><button class="btn btn-primary" onclick="HIVE.send()">Send</button></div>'+bar();
}
async function loadMsgs(){
  try{
    var r=await supabase.from('hive_messages').select('*').eq('community_id',com()).order('created_at',{ascending:false}).limit(60);
    if(r.error)throw r.error;
    var m=(r.data||[]).reverse(),sig=m.length?m[m.length-1].id:0;
    var wasLoaded=H.chatLoaded;H.chatOk=true;H.chatLoaded=true;
    if(!wasLoaded||sig!==H.chatSig||m.length!==H.msgs.length){H.msgs=m;H.chatSig=sig;paintChat();}
  }catch(e){var was=H.chatOk;H.chatOk=false;H.chatLoaded=true;if(was&&S.view==='chat')render();}
}
async function send(){
  var inp=$('chatIn');if(!inp||!S.user)return;
  var t=(inp.value||'').trim().slice(0,500);if(!t)return;inp.value='';
  if(H.chatOk){
    var r=await supabase.from('hive_messages').insert({community_id:com(),user_id:S.user.id,author:nm(),body:t});
    if(!r.error){await loadMsgs();return;}
    H.chatOk=false;
  }
  H.msgs.push({id:'l'+Date.now(),user_id:S.user.id,author:nm(),body:t,created_at:new Date().toISOString()});
  if(S.view==='chat')render();
}

/* ---------- ANNOUNCEMENT DATA ---------- */
async function loadAnn(){
  H.annState=1;H.annT=Date.now();
  try{
    var r=await supabase.from('hive_announcements').select('*').eq('community_id',com()).order('pinned',{ascending:false}).order('created_at',{ascending:false}).limit(50);
    if(r.error)throw r.error;H.ann=(r.data||[]).filter(function(a){return !a.expires_at||new Date(a.expires_at).getTime()>Date.now();});H.annOk=true;
  }catch(e){H.ann=SEED;H.annOk=false;}
  H.annState=2;
  if(S.view==='ann')render();
}
async function post(){
  var t=($('aTitle').value||'').trim(),b=($('aBody').value||'').trim(),ex=($('aExpiry')&&$('aExpiry').value)||'';
  if(!t||!b){toast('Add a title and a message');return;}
  var payload={community_id:com(),title:t,body:b,category:$('aCat').value,author:nm()};
  if(ex){var expDate=new Date(ex);if(!Number.isFinite(expDate.getTime())||expDate.getTime()<=Date.now()){toast('Choose an expiry time in the future');return;}payload.expires_at=expDate.toISOString();}
  var r=await supabase.from('hive_announcements').insert(payload);
  if(r.error&&payload.expires_at&&/expires_at|schema cache|column/i.test(r.error.message||'')){toast('Run the optional announcement-expiry SQL migration first.');return;}
  if(r.error){toast('Could not post (admins only)');return;}
  toast('Posted');loadAnn();
}

/* ---------- PROFILE HUB ---------- */
function sProfile(){
  var name=nm(),pills=PT.map(function(p){return '<button class="hpill'+(p[0]===H.pt?' on':'')+'" onclick="HIVE.setPt(\''+p[0]+'\')">'+p[1]+'</button>';}).join('')+'<button class="hpill" onclick="nav(\'profile\')">⚙ Account</button>';
  var body='';
  if(H.pt==='attendance'){
    var avg=Math.round(DEMO.attendance.reduce(function(a,x){return a+x[1];},0)/DEMO.attendance.length);
    body='<div class="hcard"><div class="hmeta"><b>Overall</b><span>'+avg+'%</span></div>'+DEMO.attendance.map(function(a){
      return '<div class="att"><div class="hmeta"><span>'+X(a[0])+'</span><span class="'+(a[1]<75?'warn':'')+'">'+a[1]+'%'+(a[1]<75?' ⚠':'')+'</span></div><div class="bar"><i class="'+(a[1]<75?'low':'')+'" style="width:'+a[1]+'%"></i></div></div>';
    }).join('')+'</div>';
  }else if(H.pt==='calendar'){
    body='<div class="hcard">'+DEMO.calendar.map(function(c){return '<div class="hrow"><b class="when">'+X(c[0])+'</b><span style="flex:1">'+X(c[1])+'</span></div>';}).join('')+'</div>';
  }else if(H.pt==='timetable'){
    body='<div class="hcard"><div class="hsub" style="margin-bottom:6px">Today\'s periods</div>'+DEMO.timetable.map(function(c){return '<div class="hrow"><b class="when">'+X(c[0])+'</b><div style="flex:1"><b>'+X(c[1])+'</b><div class="hsub">'+X(c[2])+'</div></div></div>';}).join('')+'</div>';
  }else{
    body='<div class="hcard">'+DEMO.leave.map(function(c){return '<div class="hrow"><div style="flex:1"><b>'+X(c[0])+' · '+X(c[1])+'</b><div class="hsub">'+X(c[2])+'</div></div><span class="tag">'+X(c[3])+'</span></div>';}).join('')+'</div>';
  }
  return top('Profile')+'<div class="screen"><div class="hprof"><div class="avatar">'+X(name.charAt(0).toUpperCase())+'</div><div><div class="hh1" style="margin:0">'+X(name)+'</div><div class="hsub">'+X((S.profile&&S.profile.role)||'student')+' · '+X(com())+'</div></div></div><div class="hpills">'+pills+'</div>'+body+'<div class="hsub fine">Prototype data. Real attendance and timetable will connect to the college system.</div></div>'+bar();
}

/* ---------- actions & hooks ---------- */
window.HIVE={
  screens:{acc:sServices,ann:sAnn,chat:sChat,hprofile:sProfile},
  nav:bar,
  after:function(){
    sync();var v=S.view;
    if(S.user&&v!==H.lv){if(v==='ann'||H.annState===0)loadAnn();if(v==='chat'){H.chatOk=true;loadMsgs();}}
    H.lv=v;
  },
  toggleSvc:function(k){H.svc=(H.svc===k?null:k);render();},
  setCat:function(c){H.annCat=c;render();},
  setPt:function(p){H.pt=p;render();},
  openMat:function(i){toast('Demo file: '+DEMO.materials[i][1]);},
  submit:function(k){
    var s=SVC.filter(function(x){return x.k===k;})[0],vals={};
    for(var i=0;i<s.f.length;i++){var v=($('sv_'+k+'_'+s.f[i][0])||{}).value;v=(v||'').trim();if(!v){toast('Please fill in '+s.f[i][1]);return;}vals[s.f[i][0]]=v;}
    if(k==='leave'&&vals.to<vals.from){toast('"To" date is before "From" date');return;}
    if(k==='fees'&&!(Number(vals.amount)>0)){toast('Enter a valid amount');return;}
    var sum=s.f.map(function(f){return vals[f[0]];}).join(' · ');
    H.reqs.unshift({t:s.t,s:sum,st:'Submitted',at:Date.now()});H.reqs=H.reqs.slice(0,30);sv(uk('hive_reqs'),H.reqs);
    H.svc=null;toast(s.t+': submitted');render();
  },
  post:post,send:send
};
setInterval(function(){if(S.user&&S.view==='chat'&&H.chatOk&&!document.hidden)loadMsgs();},3000);
})();
