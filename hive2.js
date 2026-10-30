/* HIVE v2 layer — loads after hive.js + app.js. Real data (Supabase), admin-controlled attendance/leave/mess/payments,
   priority news, forced first-login password change, Lost & Found connectivity fixes. */
(function(){'use strict';
var $=function(i){return document.getElementById(i);};
function ld(k,d){try{var v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}}
function sv(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
function p2(n){return (n<10?'0':'')+n;}
function iso(d){return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());}
function pd(s){var a=String(s).slice(0,10).split('-');return new Date(+a[0],+a[1]-1,+a[2]);}
function dd(s){var t=new Date();t.setHours(0,0,0,0);return Math.round((pd(s)-t)/864e5);}
function rel(s){var n=dd(s);return n===0?'Today':n===1?'Tomorrow':n===-1?'Yesterday':n>1?'In '+n+' days':Math.abs(n)+' days ago';}
function fd(s){return pd(s).toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'});}
function ft(t){var a=t.split(':'),h=+a[0];return (h%12||12)+':'+a[1]+(h<12?' am':' pm');}
function mins(t){var a=t.split(':');return +a[0]*60+ +a[1];}
function mid(){return S.user&&S.user.id;}
function br(s){return esc(s).replace(/\n/g,'<br>');}
var MARK='<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><polygon points="12,2 21,7 21,17 12,22 3,17 3,7" fill="#fbbf24"/><circle cx="12" cy="12" r="3" fill="#0b1220"/></svg>';
window.logo=function(s){return MARK.replace('width="24" height="24"','width="'+s+'" height="'+s+'"');};
var EYE='<svg class="eye-open" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg><svg class="eye-closed" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.9 10.9 0 0 1 12 19c-7 0-11-7-11-7a19.8 19.8 0 0 1 5.06-5.94M9.9 4.24A10.9 10.9 0 0 1 12 4c7 0 11 7 11 7a19.8 19.8 0 0 1-3.17 4.19M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
function pw(id,enter){return '<div class="password-wrap"><input type="password" id="'+id+'" autocomplete="'+(enter?'current-password':'new-password')+'" placeholder="Password"'+(enter?' onkeydown="if(event.key===\'Enter\')HIVE2.login()"':'')+'><button type="button" class="password-eye" onclick="togglePasswordVisibility(\''+id+'\',this)" aria-label="Show password">'+EYE+'</button></div>';}
function ico(p){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>';}

window.HIVE2={login:async function(){var e=$('lgEmail'),raw='';if(e){raw=e.value.trim().toLowerCase();e.value=raw;if(e.value&&e.value.indexOf('@')<0)e.value+='@hive.local';}
  /* Medical field: Care Bridge accounts (p.saikiran, dr.ananya, n.divya …) are not HIVE/Supabase-Auth accounts. If HIVE says "invalid login credentials" for a plain username, continue on the Care Bridge sign-in. */
  var med=!!(window.HIVEFIELD&&HIVEFIELD.current()==='medical'),bad=false,au=supabase.auth,had=Object.prototype.hasOwnProperty.call(au,'signInWithPassword'),orig=au.signInWithPassword;
  if(med&&raw&&raw.indexOf('@')<0){au.signInWithPassword=async function(){var r=await orig.apply(au,arguments);if(r&&r.error&&/invalid login credentials/i.test(r.error.message||''))bad=true;return r;};}
  try{await doLogin();}finally{if(had)au.signInWithPassword=orig;else delete au.signInWithPassword;}
  if(bad&&!S.user){if(e)e.value=raw;toast('Not a HIVE account - opening Care Bridge sign-in…',2500);setTimeout(function(){location.href='carebridge.html?u='+encodeURIComponent(raw);},900);}
},demoLogin:function(){var e=$('lgEmail'),p=$('lgPass');if(!e||!p)return;e.value='demo';p.value='HiveDemo2026!';window.HIVE2.login();}};
var G={uid:null,ok:false,err:false,annErr:false,sub:[],att:[],tt:[],cal:[],lv:[],ml:[],pay:[],cfg:null,ann:[],svc:null,pt:'att',day:null,open:null,po:null};

/* ---------- data ---------- */
async function load(){
  var u=mid();if(!u)return;
  try{
    var r=await Promise.all([
      supabase.from('subjects').select('*').order('code'),
      supabase.from('attendance').select('*').eq('user_id',u),
      supabase.from('timetable').select('*').order('start_time'),
      supabase.from('calendar_events').select('*').order('event_date'),
      supabase.from('leave_requests').select('*').order('created_at',{ascending:false}),
      supabase.from('meal_bookings').select('*').order('meal_date',{ascending:false}).limit(60),
      supabase.from('payments').select('*').order('created_at',{ascending:false}).limit(30),
      supabase.from('payment_config').select('*').eq('id',1).maybeSingle(),
      supabase.from('hive_announcements').select('*').order('created_at',{ascending:false}).limit(50)]);
    G.err=r.slice(0,8).some(function(x){return x.error;});G.annErr=!!r[8].error;
    G.sub=r[0].data||[];G.att=r[1].data||[];G.tt=r[2].data||[];G.cal=r[3].data||[];G.lv=r[4].data||[];G.ml=r[5].data||[];G.pay=r[6].data||[];G.cfg=r[7].data||null;G.ann=r[8].data||[];
  }catch(e){G.err=true;}
  G.ok=true;
  var a=document.activeElement;
  if(['acc','ann','hprofile'].indexOf(S.view)>=0&&!(a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName)))render();else overlay();
}
async function refreshAnn(){
  if(!S.user||document.hidden)return;
  try{var r=await supabase.from('hive_announcements').select('*').order('created_at',{ascending:false}).limit(50);
    if(r.error)return;var sig=function(l){return l.map(function(x){return x.id+x.priority+x.title+(x.expires_at||'');}).join();};
    var active=(r.data||[]).filter(function(x){return !x.expires_at||new Date(x.expires_at).getTime()>Date.now();});if(sig(active)!==sig(G.ann)){G.ann=active;var ae=document.activeElement;if(S.view==='ann'&&!(ae&&/INPUT|TEXTAREA|SELECT/.test(ae.tagName)))render();else overlay();}}catch(e){}
}
function top(t){return '<div class="top"><div class="brand">'+MARK+'<span>'+esc(t)+'</span></div><div class="bell" onclick="nav(\'notifications\')">'+icon('icBell',18)+(S.notifications.length?'<span class="dot"></span>':'')+'</div></div>';}
function note(){return G.err?'<div class="hnote">Some data could not load. Check your connection, or ask the admin to run <b>hive2.sql</b>.</div>':'';}
function tag(s){return '<span class="tag st-'+esc(s)+'">'+esc(s)+'</span>';}

/* ---------- navigation ---------- */
var T=[['acc','acc','Services',ico('<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>')],
 ['ann','ann','News',ico('<path d="M3 10v4h4l8 5V5L7 10z"/><path d="M19 9a4 4 0 0 1 0 6"/>')],
 ['chat','chat','Chat',ico('<path d="M4 5h16v11H9l-5 4z"/>')],
 ['prof','hprofile','Profile',ico('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-5 5-7 8-7s7 2 8 7"/>')],
 ['lf','home','Lost & Found',ico('<circle cx="10" cy="10" r="6"/><path d="M15 15l6 6"/>')]];
var TAB={acc:'acc',ann:'ann',chat:'chat',hprofile:'prof',chpw:'prof',notifications:'prof',profile:'prof'};
function bar(){if(window.HIVEUX&&window.HIVEUX.nav)return window.HIVEUX.nav();var c=TAB[S.view]||'lf';
  return '<div class="nav nav-main">'+T.map(function(t){return '<button class="navbtn'+(t[0]==='lf'?' lfbtn':'')+(c===t[0]?' active':'')+'" onclick="nav(\''+t[1]+'\',true);unlockAudio()">'+t[3]+'<span>'+t[2]+'</span></button>';}).join('')+'</div>';}

/* ---------- login + forced password change ---------- */
window.screenLogin=function(){
  return '<div class="login-hero"><div class="login-hero-inner"><div class="hv-logo login-brand-assembly" role="img" aria-label="HIVE — your community, truly intelligent"><img class="login-brand-mark" src="hive_mark.svg" width="336" height="368" alt="" decoding="async"><div class="login-brand-wordmark">HIVE</div><div class="login-brand-tagline">YOUR COMMUNITY, TRULY INTELLIGENT</div></div>'+
  '<div class="login-form-card">'+(S.authMsg?'<div class="login-msg">'+esc(S.authMsg)+'</div>':'')+
  '<div class="login-field"><label>Username</label><input id="lgEmail" autocomplete="username" autocapitalize="off" placeholder="Username given by your admin" onkeydown="if(event.key===\'Enter\')document.getElementById(\'lgPass\').focus()"></div>'+
  '<div class="login-field"><label>Password</label>'+pw('lgPass',true)+'</div>'+
  '<button class="login-btn" id="authBtn" onclick="HIVE2.login()">Sign in</button>'+
  '<div class="demo-login-divider"><span>or explore HIVE</span></div>'+
  '<button type="button" class="demo-login-btn" onclick="HIVE2.demoLogin()">'+
    '<span class="demo-login-icon" aria-hidden="true">▶</span><span><b>Demo login</b><small>Explore with a sample student account</small></span><span class="demo-login-arrow" aria-hidden="true">↗</span>'+
  '</button>'+
  '<div class="login-footer-note">🔒 Accounts and passwords are issued by your college admin.<br><a class="adminlink" href="ops.html">Admin panel →</a></div></div></div></div>';
};
function sChpw(){
  var f=S.profile&&S.profile.must_change_password;
  return '<div class="top">'+(f?'<div class="brand">'+MARK+'<span>HIVE</span></div>':'<div class="back-btn" onclick="nav(\'hprofile\',true)">←</div><div class="brand">'+MARK+'<span>Password</span></div>')+'<div style="width:40px"></div></div>'+
  '<div class="screen"><div class="hh1">'+(f?'Set your own password':'Change password')+'</div><div class="hsub" style="margin-bottom:14px">'+(f?'Your admin gave you a temporary password. Choose a new one to continue.':'Choose a new password for your account.')+'</div>'+
  '<div class="login-field"><label>New password</label>'+pw('cpNew')+'</div><div class="login-field"><label>Confirm password</label>'+pw('cpConf')+'</div>'+
  '<div class="hsub" id="cpMsg" style="margin-top:8px">At least 8 characters, with a letter and a number.</div>'+
  '<button class="btn btn-primary" style="margin-top:16px" onclick="HIVE2.chpw()">Save password</button>'+(f?'<button class="btn" style="margin-top:10px" onclick="doLogout()">Log out</button>':'')+'</div>';
}
async function chpw(){
  function m(t){var e=$('cpMsg');if(e){e.textContent=t;e.className='hsub bad';}}
  var a=$('cpNew').value,b=$('cpConf').value;
  if(a.length<8||!/[A-Za-z]/.test(a)||!/\d/.test(a)){m('Use at least 8 characters with a letter and a number.');return;}
  if(a!==b){m('The two passwords do not match.');return;}
  var r=await supabase.auth.updateUser({password:a});if(r.error){m(r.error.message);return;}
  var u=await supabase.from('profiles').update({must_change_password:false}).eq('id',mid());
  if(u.error){m('Password saved, but the account could not be updated: '+u.error.message);return;}
  S.profile.must_change_password=false;toast('Password updated ✓');nav('ann',true);
}

/* ---------- services ---------- */
var SV=[['leave','🗓️','Leave','Apply, request permission or inform'],['meal','🍽️','Mess booking','Book a meal — instantly logged'],['fees','💳','Pay fees','UPI payment, verified by admin'],['study','📚','Study','Your 6 subjects, syllabus and info']];
var LK={apply:'Leave application',permission:'Permission request',inform:'Leave information'};
function bLeave(){
  var t=iso(new Date());
  var list=G.lv.slice(0,10).map(function(l){
    return '<div class="hrow col"><div class="hmeta"><b>'+LK[l.kind]+'</b>'+tag(l.status)+'</div><div class="hsub">'+fd(l.from_date)+(l.to_date!==l.from_date?' – '+fd(l.to_date):'')+' · '+br(l.reason)+'</div>'+
    (l.proof?'<div class="hsub">Proof: '+esc(l.proof)+'</div>':'')+(l.admin_note?'<div class="anote">Admin: '+br(l.admin_note)+'</div>':'')+
    (l.status==='questioned'?'<div class="hrow" style="border:0;padding:6px 0 0"><input class="input" style="margin:0;flex:1" id="lr'+l.id+'" maxlength="500" placeholder="Your reply to the admin"><button class="hbtn" onclick="HIVE2.reply('+Number(l.id)+')">Send</button></div>':(l.student_reply?'<div class="hsub">Your reply: '+br(l.student_reply)+'</div>':''))+'</div>';}).join('')||'<div class="hsub">No leave records yet.</div>';
  return '<div class="hbody"><div class="label">What do you need?</div><select class="input" id="lvKind"><option value="apply">Apply for leave</option><option value="permission">Request permission</option><option value="inform">Inform about a leave (already taken / planned)</option></select>'+
  '<div class="two"><div><div class="label">From</div><input class="input" type="date" id="lvFrom" value="'+t+'"></div><div><div class="label">To</div><input class="input" type="date" id="lvTo" value="'+t+'"></div></div>'+
  '<div class="label">Reason</div><textarea class="input" id="lvReason" rows="2" maxlength="500"></textarea><div class="label">Proof (link or note, optional)</div><input class="input" id="lvProof" maxlength="300" placeholder="e.g. medical certificate link">'+
  '<button class="btn btn-primary" style="margin-top:14px" onclick="HIVE2.leave()">Submit</button><div class="hh2">My leave record</div>'+list+'</div>';
}
function bMeal(){
  var t=iso(new Date());
  var list=G.ml.slice(0,12).map(function(m){return '<div class="hrow"><div style="flex:1"><b>'+esc(m.meal)+'</b><div class="hsub">'+fd(m.meal_date)+' · '+rel(m.meal_date)+'</div></div>'+(dd(m.meal_date)>0?'<button class="hbtn" onclick="HIVE2.unmeal('+Number(m.id)+')">Cancel</button>':'<span class="tag">Logged</span>')+'</div>';}).join('')||'<div class="hsub">No bookings yet.</div>';
  return '<div class="hbody"><div class="two"><div><div class="label">Meal</div><select class="input" id="mlMeal"><option>Breakfast</option><option>Lunch</option><option>Snacks</option><option>Dinner</option></select></div><div><div class="label">Date</div><input class="input" type="date" id="mlDate" value="'+t+'" min="'+t+'"></div></div>'+
  '<button class="btn btn-primary" style="margin-top:14px" onclick="HIVE2.meal()">Book now</button><div class="hh2">Booking log</div>'+list+'</div>';
}
function upi(p){var c=G.cfg;return 'upi://pay?pa='+encodeURIComponent(c.upi_id)+'&pn='+encodeURIComponent(c.payee_name||'College')+'&am='+Number(p.amount).toFixed(2)+'&cu=INR&tn='+encodeURIComponent(p.item+' #'+p.id)+'&tr=HIVE'+p.id;}
function bFees(){
  var on=G.cfg&&G.cfg.upi_id;
  var list=G.pay.slice(0,10).map(function(p){
    var panel=(G.po===p.id&&on)?'<div class="payp"><div class="hsub">Pay <b>₹'+Number(p.amount).toFixed(2)+'</b> to <b>'+esc(G.cfg.upi_id)+'</b>'+(G.cfg.payee_name?' ('+esc(G.cfg.payee_name)+')':'')+'</div><a class="btn btn-primary" style="margin:10px 0;text-align:center;text-decoration:none" href="'+esc(upi(p))+'">Open UPI app</a><div class="hsub">After paying, enter the reference (UTR) shown in your UPI app.</div><div class="hrow" style="border:0;padding:6px 0 0"><input class="input" style="margin:0;flex:1" id="ut'+p.id+'" maxlength="30" placeholder="UTR / reference"><button class="hbtn" onclick="HIVE2.utr('+Number(p.id)+')">Send</button></div></div>':'';
    return '<div class="hrow col"><div class="hmeta"><b>'+esc(p.item)+' · ₹'+Number(p.amount).toFixed(2)+'</b>'+tag(p.status)+'</div><div class="hsub">'+fd(p.created_at)+(p.utr?' · Ref '+esc(p.utr):'')+'</div>'+((p.status==='initiated'||p.status==='rejected')&&on?'<button class="hbtn" style="margin-top:6px" onclick="HIVE2.payOpen('+Number(p.id)+')">'+(G.po===p.id?'Hide':'Pay now')+'</button>':'')+panel+'</div>';}).join('')||'<div class="hsub">No payments yet.</div>';
  return '<div class="hbody">'+(on?'':'<div class="hnote" style="margin:0 0 10px">Payments are not enabled yet. The admin must add a UPI ID.</div>')+
  '<div class="two"><div><div class="label">Fee</div><select class="input" id="pyItem"><option>Tuition</option><option>Hostel</option><option>Exam</option><option>Library fine</option><option>Other</option></select></div><div><div class="label">Amount (₹)</div><input class="input" type="number" id="pyAmt" min="1" step="0.01"></div></div>'+
  '<button class="btn btn-primary" style="margin-top:14px" onclick="HIVE2.pay()"'+(on?'':' disabled')+'>Continue to pay</button><div class="hh2">My payments</div>'+list+'</div>';
}
function bStudy(){
  return '<div class="hbody">'+(G.sub.map(function(s){var o=G.open===s.code;
    return '<div class="hrow col"><div class="hhead" data-c="'+esc(s.code)+'" onclick="HIVE2.sub(this.dataset.c)"><span class="code">'+esc(s.code)+'</span><b style="flex:1">'+esc(s.name)+'</b><span class="hsub">'+(o?'▲':'▼')+'</span></div>'+
    (o?'<div class="hsub body">'+br(s.description||'')+'</div>'+(s.syllabus?'<div class="label">Syllabus</div><ul class="syl">'+s.syllabus.split('|').map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul>':'')+(s.faculty?'<div class="hsub">Faculty: '+esc(s.faculty)+'</div>':''):'')+'</div>';}).join('')||'<div class="hsub">No subjects loaded.</div>')+'</div>';
}
function sServices(){
  var B={leave:bLeave,meal:bMeal,fees:bFees,study:bStudy};
  return top('Services')+'<div class="screen"><div class="hh1">Campus services</div><div class="hsub" style="margin-bottom:14px">Everything here is saved to the server and visible to your admin.</div>'+note()+
  SV.map(function(s){var o=G.svc===s[0];return '<div class="hcard svc'+(o?' open':'')+'"><div class="hhead" data-k="'+s[0]+'" onclick="HIVE2.svc(this.dataset.k)"><span class="hico">'+s[1]+'</span><div style="flex:1"><b>'+s[2]+'</b><div class="hsub">'+s[3]+'</div></div><span class="sw'+(o?' on':'')+'"><i></i></span></div>'+(o?B[s[0]]():'')+'</div>';}).join('')+'</div>'+bar();
}

/* ---------- news ---------- */
var RK={urgent:0,important:1,normal:2};
function rk(a){return a.priority in RK?RK[a.priority]:2;}
function sorted(){var now=Date.now();return G.ann.filter(function(a){return !a.expires_at||new Date(a.expires_at).getTime()>now;}).slice().sort(function(a,b){return rk(a)-rk(b)||(b.pinned?1:0)-(a.pinned?1:0)||new Date(b.created_at)-new Date(a.created_at);});}
function when(a){var d=new Date(a.created_at);return rel(iso(d))+' · '+d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}
function sAnn(){
  var l=sorted(),urg=l.filter(function(a){return a.priority==='urgent';});
  var tick=urg.length?'<div class="ticker"><span>'+urg.map(function(a){return '● '+esc(a.title);}).join('   ')+'</span></div>':'';
  var first=true,cards=l.map(function(a){var p=a.priority in RK?a.priority:'normal';
    var expiry=a.expires_at?'<div class="hsub expiry-label">Available until '+esc(new Date(a.expires_at).toLocaleString('en-IN',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}))+'</div>':'';
    if(p==='normal')return '<div class="hcard"><div class="hmeta"><span class="tag">'+esc(a.category)+'</span><span>'+when(a)+'</span></div><b>'+esc(a.title)+'</b>'+expiry+'<div class="hsub body">'+br(a.body)+'</div></div>';
    var hero=first;first=false;
    return '<article class="news '+p+(hero?' hero':'')+'"><div class="nl">'+(p==='urgent'?'<i class="live"></i>URGENT':'IMPORTANT')+' · '+esc(a.category)+'</div><h2>'+esc(a.title)+'</h2>'+expiry+'<p>'+br(a.body)+'</p><div class="nt">'+(a.pinned?'Pinned · ':'')+when(a)+'</div></article>';}).join('')||'<div class="hsub">'+(G.ok?'No announcements yet.':'Loading…')+'</div>';
  return top('News')+(window.HIVE3?HIVE3.pills():'')+'<div class="screen newsscreen">'+tick+(G.annErr?'<div class="hnote">Announcements could not load. Check your connection.</div>':'')+cards+'</div>'+bar();
}
function overlay(){
  /* Urgent news must never interrupt a signed-in user with a full-screen modal. */
  var existing=$('newsOv');if(existing)existing.remove();
}
function ack(id){var k='hive_ack_'+mid(),a=ld(k,[]);a.push(id);sv(k,a);var o=$('newsOv');if(o)o.remove();overlay();}

/* ---------- profile ---------- */
function sProf(){
  var p=S.profile||{},name=p.name||'Student',PT=[['att','Attendance'],['cal','Calendar'],['tt','Timetable'],['acct','Account']];
  var b='';
  if(G.pt==='att'){
    var rows=G.sub.map(function(s){var a=G.att.filter(function(x){return x.subject_code===s.code;})[0]||{attended:0,total:0};return {s:s,a:+a.attended,t:+a.total,u:a.updated_at};});
    var A=rows.reduce(function(x,r){return x+r.a;},0),Tt=rows.reduce(function(x,r){return x+r.t;},0),up=rows.map(function(r){return r.u;}).filter(Boolean).sort().pop();
    b='<div class="hcard"><div class="hmeta"><b>Overall</b><span class="'+(Tt&&A/Tt<.75?'warn':'')+'">'+(Tt?(A/Tt*100).toFixed(1)+'%':'—')+'</span></div>'+rows.map(function(r){
      var pc=r.t?r.a/r.t*100:null,adv=!r.t?'No classes recorded yet':pc<75?'Attend the next '+Math.max(1,3*r.t-4*r.a)+' classes to reach 75%':(Math.floor((4*r.a-3*r.t)/3)>0?'You can miss '+Math.floor((4*r.a-3*r.t)/3)+' more and stay at 75%':'Right at the 75% limit');
      return '<div class="att"><div class="hmeta"><span><b>'+esc(r.s.code)+'</b> · '+esc(r.s.name)+'</span><span class="'+(pc!==null&&pc<75?'warn':'')+'">'+(pc===null?'—':pc.toFixed(1)+'%')+'</span></div><div class="bar"><i class="'+(pc!==null&&pc<75?'low':'')+'" style="width:'+(pc||0)+'%"></i></div><div class="hsub">'+r.a+' of '+r.t+' classes · '+adv+'</div></div>';}).join('')+'</div>'+(up?'<div class="hsub fine">Updated by admin '+rel(iso(new Date(up))).toLowerCase()+'</div>':'');
  }else if(G.pt==='cal'){
    var up2=G.cal.filter(function(e){return dd(e.event_date)>=0;}),pa=G.cal.filter(function(e){return dd(e.event_date)<0;}).slice(-3).reverse(),EM={exam:'📝',fee:'💳',holiday:'🌴',academic:'🎓',event:'📌'};
    var row=function(e,dim){return '<div class="hrow'+(dim?' dim':'')+'"><span class="hico">'+(EM[e.kind]||'📌')+'</span><div style="flex:1"><b>'+esc(e.title)+'</b><div class="hsub">'+fd(e.event_date)+'</div></div><span class="tag">'+rel(e.event_date)+'</span></div>';};
    b='<div class="hcard">'+(up2.map(function(e){return row(e);}).join('')||'<div class="hsub">No upcoming events.</div>')+'</div>'+(pa.length?'<div class="hsub">Recently</div><div class="hcard">'+pa.map(function(e){return row(e,1);}).join('')+'</div>':'');
  }else if(G.pt==='tt'){
    var now=new Date(),tdy=now.getDay()||1,day=G.day||(tdy===0?1:tdy),nm=now.getHours()*60+now.getMinutes(),nx=false,N=['Mon','Tue','Wed','Thu','Fri','Sat'];
    var ps=G.tt.filter(function(x){return x.dow===day;});
    b='<div class="hpills">'+N.map(function(n,i){return '<button class="hpill'+(day===i+1?' on':'')+'" onclick="HIVE2.day('+(i+1)+')">'+n+(tdy===i+1?' •':'')+'</button>';}).join('')+'</div><div class="hcard">'+(ps.map(function(x){
      var s=G.sub.filter(function(q){return q.code===x.subject_code;})[0],st='';
      if(day===tdy){if(nm>=mins(x.start_time)&&nm<mins(x.end_time))st='<span class="tag now">Now</span>';else if(!nx&&mins(x.start_time)>nm){nx=true;st='<span class="tag">Next</span>';}}
      return '<div class="hrow"><b class="when">'+ft(x.start_time)+'</b><div style="flex:1"><b>'+esc(s?s.name:x.subject_code)+'</b><div class="hsub">until '+ft(x.end_time)+(x.room?' · '+esc(x.room):'')+'</div></div>'+st+'</div>';}).join('')||'<div class="hsub">No classes.</div>')+'</div>';
  }else{
    b='<div class="hcard"><div class="hsub">Username</div><b>'+esc(String(p.email||(S.user&&S.user.email)||'').replace('@hive.local',''))+'</b>'+(p.roll_no?'<div class="hsub" style="margin-top:8px">Roll number</div><b>'+esc(p.roll_no)+'</b>':'')+'</div>'+
    (window.HIVE3?'<div class="prow" onclick="HIVE3.tour()">✨ App tour <span>›</span></div>':'')+'<div class="prow" onclick="nav(\'chpw\')">🔑 Change password <span>›</span></div><div class="prow" onclick="nav(\'notifications\')">🔔 Notifications <span>'+S.notifications.length+'</span></div><div class="prow" onclick="doLogout()" style="color:var(--lost)">🚪 Log out <span>›</span></div>';
  }
  return top('Profile')+'<div class="screen"><div class="hprof"><div class="avatar">'+esc(name.charAt(0).toUpperCase())+'</div><div><div class="hh1" style="margin:0">'+esc(name)+'</div><div class="hsub">'+esc(p.role||'student')+(p.roll_no?' · '+esc(p.roll_no):'')+'</div></div></div>'+note()+
  (window.HIVEAI?HIVEAI.card():'')+'<div class="hpills">'+PT.map(function(x){return '<button class="hpill'+(G.pt===x[0]?' on':'')+'" onclick="HIVE2.pt(\''+x[0]+'\')">'+x[1]+'</button>';}).join('')+'</div>'+b+'</div>'+bar();
}

/* ---------- actions ---------- */
async function ins(table,row,ok){var x=await supabase.from(table).insert(row);if(x.error){toast(x.error.code==='23505'?'Already booked':'Could not save: '+x.error.message);return false;}toast(ok);await load();render();return true;}
Object.assign(window.HIVE2,{top:top,bar:bar,chpw:chpw,ack:ack,
  svc:function(k){G.svc=G.svc===k?null:k;render();},sub:function(c){G.open=G.open===c?null:c;render();},
  pt:function(p){G.pt=p;render();},day:function(d){G.day=d;render();},payOpen:function(id){G.po=G.po===id?null:id;render();},
  leave:function(){var k=$('lvKind').value,f=$('lvFrom').value,t=$('lvTo').value,r=$('lvReason').value.trim(),pr=$('lvProof').value.trim();
    if(!f||!t||r.length<3){toast('Add dates and a reason');return;}if(t<f){toast('"To" is before "From"');return;}
    ins('leave_requests',{user_id:mid(),kind:k,from_date:f,to_date:t,reason:r,proof:pr||null,status:k==='inform'?'informed':'pending'},k==='inform'?'Recorded':'Sent to admin');},
  reply:async function(id){var v=($('lr'+id).value||'').trim();if(!v){toast('Write a reply');return;}var x=await supabase.rpc('reply_leave',{p_id:id,p_text:v});if(x.error){toast('Could not send');return;}toast('Reply sent');await load();render();},
  meal:function(){var d=$('mlDate').value;if(!d||d<iso(new Date())){toast('Pick today or a later date');return;}ins('meal_bookings',{user_id:mid(),meal:$('mlMeal').value,meal_date:d},$('mlMeal').value+' booked for '+fd(d));},
  unmeal:async function(id){var x=await supabase.from('meal_bookings').delete().eq('id',id);if(x.error){toast('Could not cancel');return;}toast('Cancelled');await load();render();},
  pay:async function(){var am=parseFloat($('pyAmt').value);if(!(am>0)){toast('Enter a valid amount');return;}
    var x=await supabase.from('payments').insert({user_id:mid(),item:$('pyItem').value,amount:am}).select().single();
    if(x.error){toast('Could not start payment: '+x.error.message);return;}G.po=x.data.id;await load();render();},
  utr:async function(id){var x=await supabase.rpc('submit_payment_ref',{p_id:id,p_utr:($('ut'+id).value||'').trim()});if(x.error){toast('Enter the 8–30 character reference (UTR)');return;}toast('Sent to admin for verification');G.po=null;await load();render();}
});

/* ---------- hook into the shell ---------- */
HIVE.screens.acc=sServices;HIVE.screens.ann=sAnn;HIVE.screens.hprofile=sProf;HIVE.screens.chpw=sChpw;delete HIVE.screens.ai;HIVE.nav=bar;
var oa=HIVE.after;
HIVE.after=function(){
  oa();var f=$('hiveFab');if(f)f.remove();
  if(!S.user){G.uid=null;return;}
  if(G.uid!==mid()){G.uid=mid();G.ok=false;load();}
  if(S.profile&&S.profile.must_change_password&&S.view!=='chpw'){S.view='chpw';render();return;}
  var v=S.view;if((v==='home'||v==='browse')&&Date.now()-NET.t>20000){NET.t=Date.now();loadItems().then(function(){if(S.view===v)render();});}
  overlay();
};
setInterval(refreshAnn,30000);

/* ---------- Lost & Found connectivity ---------- */
var NET={ok:true,t:0};
function setNet(ok){
  if(ok===NET.ok)return;NET.ok=ok;var b=$('netbar');
  if(!ok){if(!b){b=document.createElement('div');b.id='netbar';b.setAttribute('role','status');document.body.appendChild(b);}b.textContent='⚠ Can’t reach the server — showing saved items. Reconnecting…';}
  else{if(b)b.remove();toast('Back online ✓');}
}
function mapItems(rows){return (rows||[]).map(function(r){return {id:r.id,name:r.name,type:r.type,category:r.category,location:r.location,date:fmtDate(r.created_at),status:r.status,mine:S.user&&r.user_id===S.user.id,desc:r.description||'No description provided.',photo:safePhotoUrl(r.photo_url),user_id:r.user_id};});}
window.loadItems=async function(){
  try{
    var res=await Promise.race([supabase.from('items').select('*').order('created_at',{ascending:false}),new Promise(function(_,rej){setTimeout(function(){rej(new Error('timeout'));},10000);})]);
    if(res.error)throw res.error;
    S.items=mapItems(res.data);sv('hive_items_cache',res.data.slice(0,150));setNet(true);
  }catch(e){var c=ld('hive_items_cache',null);if(c&&!S.items.length)S.items=mapItems(c);setNet(false);}
};
var sr=window.submitReport;
window.submitReport=function(){if(!navigator.onLine){toast('You are offline. Reconnect to submit your report.');return;}return sr.apply(this,arguments);};
window.addEventListener('offline',function(){setNet(false);});
window.addEventListener('online',function(){loadItems().then(function(){if(['home','browse','details'].indexOf(S.view)>=0)render();});});
setInterval(function(){if(S.user&&!document.hidden&&!NET.ok)loadItems().then(function(){if(NET.ok&&['home','browse'].indexOf(S.view)>=0)render();});},15000);
})();
