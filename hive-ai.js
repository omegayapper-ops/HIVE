/* HIVE AI — the in-app assistant  (Profile → ✦ HIVE AI)        loads AFTER hive3.js

   What this file does
   1. Adds a "HIVE AI" card to the Profile screen (hive2.js calls HIVEAI.card()).
   2. Opens a separate full-screen chat (view "ai").
   3. Before every answer it reads a fresh, privacy-safe snapshot of the signed-in student's OWN HIVE data:
      attendance, timetable, calendar, news, study material, leave / mess / fee STATUS, clubs, posts,
      podcast, Lost & Found and alerts. It uses EXPLICIT column lists, so passwords, usernames / e-mails, roll numbers,
      payment references (UTR), UPI details, leave reasons / proof and private claim details are never downloaded
      for the AI at all. The snapshot excludes community chat messages entirely.
   4. Sends the chat + snapshot to the "hive-ai" Supabase Edge Function. That function keeps the OpenRouter key
      (NEVER put the key in the app), re-checks the student, rate-limits and scrubs the text a third time.

   Public API:   HIVEAI.card()          HTML of the Profile entry
                 HIVEAI.open(prompt?)   open the chat (and optionally ask something straight away)
                 HIVEAI.context()       Promise<string>: exactly the text the AI is allowed to read
   Setup steps for the admin are in AI_SETUP.md.                                                                     */
(function(){'use strict';

/* ---------- settings ---------- */
var CFG={
  fn:'hive-ai',          /* name of the Supabase Edge Function */
  fnUrl:'',              /* ONLY if the hive-ai function lives in a DIFFERENT Supabase project: its full address, e.g. https://abcd1234.supabase.co/functions/v1/hive-ai */
  timeout:60000,         /* ms to wait for one answer (the server stops trying after about 48 s) */
  maxInput:1500,         /* characters per question (the server enforces the same limit) */
  maxTurns:12,           /* chat turns sent with each question */
  keepMsgs:40,           /* messages kept for this session */
  ttl:90000,             /* how long one data snapshot is reused (ms) */
  ctxMax:45000           /* hard cap on the snapshot size (characters) */
};

/* ---------- tiny helpers ---------- */
var $=function(i){return document.getElementById(i);};
function X(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function ld(k,d){try{var v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}}
function sv(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
function sld(k,d){try{var v=sessionStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}}
function ssv(k,v){try{sessionStorage.setItem(k,JSON.stringify(v));}catch(e){}}
function uid(){return (S.user&&S.user.id)||null;}
function p2(n){return (n<10?'0':'')+n;}
function iso(d){return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());}
function pd(s){var a=String(s).slice(0,10).split('-');return new Date(+a[0],+a[1]-1,+a[2]);}
function dd(s){var t=new Date();t.setHours(0,0,0,0);return Math.round((pd(s)-t)/864e5);}
function rel(s){var n=dd(s);return n===0?'today':n===1?'tomorrow':n===-1?'yesterday':n>1?'in '+n+' days':Math.abs(n)+' days ago';}
function fd(s){return pd(s).toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',year:'numeric'});}
function fdt(v){var d=new Date(v);if(isNaN(d.getTime()))return '';return d.toLocaleDateString('en-IN',{day:'numeric',month:'short'})+', '+d.toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'});}
function ft(t){var a=String(t).split(':'),h=+a[0];return (h%12||12)+':'+a[1]+(h<12?' am':' pm');}
function mins(t){var a=String(t).split(':');return +a[0]*60+ +a[1];}
function tm(t){var d=new Date(t);return isNaN(d.getTime())?'':d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});}
function cut(s,n){s=String(s==null?'':s).replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n-1)+'…':s;}
function firstName(){
  var w=String((S.profile&&S.profile.name)||'').trim().split(/\s+/).filter(function(x){return x.replace(/[^A-Za-zÀ-ɏऀ-ॿ]/g,'').length>2;})[0];
  if(!w)return 'there';
  w=w.replace(/[^\wÀ-ɏऀ-ॿ'-]/g,'');
  return w===w.toUpperCase()?w.charAt(0)+w.slice(1).toLowerCase():w;
}
var COARSE=!!(window.matchMedia&&matchMedia('(pointer:coarse)').matches);

/* ---------- text safety net (keep in sync with scrub() / redactKnown() in supabase/functions/hive-ai/index.ts) ---------- */
function scrubBase(text){
  return String(text==null?'':text)
    .replace(/\beyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{4,}\b/g,'[token removed]')
    .replace(/\b(?:sk|pk|rk|nvapi|sb_secret|sb_publishable)[-_][\w-]{16,}/gi,'[key removed]')
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)*/g,'[email removed]')
    .replace(/\b(password|passcode|passwd|pwd|otp|cvv|pin)\b(\s*(?:is|are|was|=|:|-)\s*)\S+/gi,'$1$2[removed]')
    .replace(/(?:\+\d{1,3}[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b/g,'[number removed]')
    .replace(/\+\d{1,3}[\s-]?\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4}\b/g,'[number removed]')
    .replace(/\b\d(?:[\s-]?\d){11,18}\b/g,'[number removed]')
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g,'[token removed]');
}
/* The student's OWN username, roll number and e-mail can't be spotted by a pattern, so they are removed by value
   (whole words only, at least 4 characters). The server does the same again. */
function reEsc(t){return t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
function own(){
  var out=[],seen={},p=S.profile||{},u=S.user||{};
  function add(v){v=String(v==null?'':v).trim();if(v.length<4)return;var k=v.toLowerCase();if(!seen[k]){seen[k]=1;out.push(v);}}
  [p.email,u.email,p.roll_no].forEach(function(v){add(v);if(v&&String(v).indexOf('@')>0)add(String(v).split('@')[0]);});
  return out;
}
function redactOwn(text){
  var t=String(text);
  own().forEach(function(v){t=t.replace(new RegExp('(^|[^\\w])'+reEsc(v)+'(?=$|[^\\w])','gi'),'$1[removed]');});
  return t;
}
function scrub(text){return redactOwn(scrubBase(text));}

/* =====================================================================================================
   1. THE PRIVACY-SAFE SNAPSHOT
   Only the columns named below are requested. Anything not listed (e-mail, username, roll_no, utr, proof,
   reason, student_reply, author names, photo / media links, claim notes ...) is never read for the AI.
   ===================================================================================================== */
var NA='(not available right now)';

function qry(table,cols,shape){
  try{
    var b=supabase.from(table).select(cols);
    if(shape)b=shape(b);
    var p=Promise.resolve(b).then(function(r){return r&&!r.error&&Array.isArray(r.data)?r.data:null;},function(){return null;});
    var t=new Promise(function(res){setTimeout(function(){res(null);},12000);});
    return Promise.race([p,t]);
  }catch(e){return Promise.resolve(null);}
}

function secAttendance(subs,att){
  if(!subs)return 'ATTENDANCE: '+NA;
  if(!subs.length)return 'ATTENDANCE: no subjects have been added yet.';
  var by={},ups=[],A_=0,T_=0;
  (att||[]).forEach(function(a){by[a.subject_code]=a;if(a.updated_at)ups.push(a.updated_at);});
  var lines=subs.map(function(s){
    var a=by[s.code]||{},at=+a.attended||0,to=+a.total||0,pc=to?at/to*100:null,adv;
    A_+=at;T_+=to;
    if(!to)adv='no classes recorded yet';
    else if(pc<75)adv='BELOW 75% - must attend the next '+Math.max(1,3*to-4*at)+' classes in a row to reach 75%';
    else{var m=Math.floor((4*at-3*to)/3);adv=m>0?'safe - can miss '+m+' more class'+(m===1?'':'es')+' and stay at 75%':'exactly at the 75% limit - do not miss the next class';}
    return '- '+s.code+' ('+s.name+'): attended '+at+' of '+to+' classes'+(to?' = '+pc.toFixed(1)+'%':'')+' - '+adv;
  });
  var last=ups.sort().pop();
  return 'ATTENDANCE (75% is the minimum; these numbers are already calculated - quote them):\nOverall: '+
    (T_?(A_/T_*100).toFixed(1)+'% ('+A_+' of '+T_+' classes)':'no classes recorded yet')+'\n'+lines.join('\n')+
    (last?'\nLast updated by the admin: '+rel(iso(new Date(last)))+'.':'');
}

var DAYS=['Mon','Tue','Wed','Thu','Fri','Sat'];
function secTimetable(tt,subs){
  if(!tt)return 'TIMETABLE: '+NA;
  if(!tt.length)return 'TIMETABLE: no classes have been added yet.';
  var nameOf={};(subs||[]).forEach(function(s){nameOf[s.code]=s.name;});
  var now=new Date(),dow=now.getDay(),nm=now.getHours()*60+now.getMinutes(),marked=false,out=[];
  for(var d=1;d<=6;d++){
    var items=tt.filter(function(x){return +x.dow===d;}).map(function(x){
      var tag='';
      if(d===dow){
        if(nm>=mins(x.start_time)&&nm<mins(x.end_time))tag=' [NOW]';
        else if(nm>=mins(x.end_time))tag=' [done]';
        else if(!marked){tag=' [next]';marked=true;}
      }
      return ft(x.start_time)+'-'+ft(x.end_time)+' '+(nameOf[x.subject_code]||x.subject_code)+(x.room?' ('+x.room+')':'')+tag;
    });
    out.push(DAYS[d-1]+(d===dow?' (TODAY)':'')+': '+(items.join('; ')||'no classes'));
  }
  return 'TIMETABLE (Mon-Sat; '+(dow===0?'today is Sunday, so there are no classes':'today is '+DAYS[dow-1])+'):\n'+out.join('\n');
}

function secCalendar(ev){
  if(!ev)return 'CALENDAR: '+NA;
  var up=ev.filter(function(e){return dd(e.event_date)>=0;}).slice(0,15),
      past=ev.filter(function(e){return dd(e.event_date)<0;}).slice(-3).reverse();
  function row(e){return '- '+fd(e.event_date)+' ('+rel(e.event_date)+') · '+(e.kind||'event')+' · '+cut(e.title,120);}
  return 'CALENDAR:\nUpcoming:\n'+(up.map(row).join('\n')||'- nothing upcoming')+(past.length?'\nRecent:\n'+past.map(row).join('\n'):'');
}

var RK={urgent:0,important:1,normal:2};
function secNews(a){
  if(!a)return 'ANNOUNCEMENTS: '+NA;
  if(!a.length)return 'ANNOUNCEMENTS: none yet.';
  var l=a.slice().sort(function(x,y){
    var px=x.priority in RK?RK[x.priority]:2,py=y.priority in RK?RK[y.priority]:2;
    return px-py||(y.pinned?1:0)-(x.pinned?1:0)||new Date(y.created_at)-new Date(x.created_at);
  }).slice(0,15);
  return 'ANNOUNCEMENTS (most urgent first, then pinned, then newest):\n'+l.map(function(x){
    var p=x.priority&&x.priority!=='normal'?'['+String(x.priority).toUpperCase()+']':'';
    return '- '+p+'['+(x.category||'General')+']'+(x.pinned?'[pinned]':'')+' '+fdt(x.created_at)+' - '+cut(x.title,120)+': '+cut(x.body,350);
  }).join('\n');
}

function secStudy(subs){
  if(!subs)return 'STUDY MATERIAL: '+NA;
  if(!subs.length)return 'STUDY MATERIAL: no subjects have been added yet.';
  return 'STUDY MATERIAL (subjects and syllabus in HIVE):\n'+subs.map(function(s){
    var syl=s.syllabus?String(s.syllabus).split('|').map(function(x){return x.trim();}).filter(Boolean).join('; '):'';
    return '- '+s.code+' · '+s.name+(s.faculty?' (faculty: '+s.faculty+')':'')+
      (s.description?'\n  About: '+cut(s.description,450):'')+(syl?'\n  Syllabus topics: '+cut(syl,600):'');
  }).join('\n');
}

var LK={apply:'Leave application',permission:'Permission request',inform:'Leave information'};
function secLeave(l){
  if(!l)return 'MY LEAVE RECORD: '+NA;
  if(!l.length)return 'MY LEAVE RECORD: none.';
  return 'MY LEAVE RECORD (the reasons and proof are never shared with the AI):\n'+l.slice(0,10).map(function(x){
    return '- '+(LK[x.kind]||'Leave')+' · '+fd(x.from_date)+(x.to_date!==x.from_date?' to '+fd(x.to_date):'')+' · status: '+x.status+
      (x.admin_note?' · admin note: '+cut(x.admin_note,140):'');
  }).join('\n');
}

function secMess(m){
  if(!m)return 'MY MESS BOOKINGS: '+NA;
  if(!m.length)return 'MY MESS BOOKINGS: none.';
  return 'MY MESS BOOKINGS (newest first):\n'+m.slice(0,12).map(function(x){return '- '+x.meal+' · '+fd(x.meal_date)+' ('+rel(x.meal_date)+')';}).join('\n');
}

function secFees(p){
  if(!p)return 'MY FEE PAYMENTS: '+NA;
  if(!p.length)return 'MY FEE PAYMENTS: none started.';
  return 'MY FEE PAYMENTS (status only - initiated = not paid yet, submitted = waiting for the admin to verify, verified = done, rejected = admin could not verify; payment references and UPI details are never shared):\n'+
    p.slice(0,10).map(function(x){return '- '+x.item+' · ₹'+Number(x.amount).toFixed(2)+' · status: '+x.status+' · '+fd(x.created_at);}).join('\n');
}

function secClubs(cl,mem){
  if(!cl)return 'CLUBS: '+NA;
  if(!cl.length)return 'CLUBS: none yet.';
  var mine={};(mem||[]).forEach(function(m){mine[m.club_id]=1;});
  var joined=cl.filter(function(c){return mine[c.id];}).map(function(c){return c.name;});
  return 'CLUBS (I have joined: '+(joined.join(', ')||'none')+'):\n'+
    cl.map(function(c){return '- '+c.name+(mine[c.id]?' [JOINED]':'')+': '+cut(c.description,130);}).join('\n');
}

var PK={problem:'Problem',moment:'Moment',talent:'Talent'};
function secPosts(p){
  if(!p)return 'COMMUNITY POSTS: '+NA;
  var l=p.filter(function(x){return x.status!=='hidden';}).slice(0,12);
  if(!l.length)return 'COMMUNITY POSTS (gallery, talents, problems): none yet.';
  return 'COMMUNITY POSTS (Gallery moments, Talents and reported Problems; author names are hidden):\n'+l.map(function(x){
    return '- ['+(PK[x.kind]||x.kind)+(x.kind==='talent'&&x.category?' · '+x.category:'')+(x.kind==='problem'?' · '+(x.status==='resolved'?'resolved':'reported'):'')+(x.sdg?' · SDG '+x.sdg:'')+'] '+
      cut(x.title,100)+(x.user_id===uid()?' (mine)':'')+' · '+fd(x.created_at)+' - '+cut(x.description,160);
  }).join('\n');
}

function secPodcast(e){
  if(!e)return 'PODCAST: '+NA;
  if(!e.length)return 'PODCAST: no episodes yet.';
  return 'COLLEGE PODCAST (latest episodes):\n'+e.slice(0,5).map(function(x){
    return '- '+cut(x.title,100)+(x.guest?' (guest: '+cut(x.guest,60)+')':'')+' · '+fd(x.published_at)+(x.description?' - '+cut(x.description,160):'');
  }).join('\n');
}

function secLF(it){
  if(!it)return 'LOST & FOUND: '+NA;
  var open=it.filter(function(x){return x.status!=='returned';}),ret=it.length-open.length;
  if(!open.length)return 'LOST & FOUND: no open items'+(ret?' ('+ret+' returned recently)':'')+'.';
  return 'LOST & FOUND (open items; photos and ownership-claim details are never shared):\n'+open.slice(0,20).map(function(x){
    return '- '+String(x.type).toUpperCase()+(x.user_id===uid()?' (mine)':'')+': '+cut(x.name,80)+' · '+x.category+' · '+x.location+' · '+fd(x.created_at)+
      (x.description&&x.description!=='No description provided.'?' - '+cut(x.description,110):'');
  }).join('\n')+(ret?'\n('+ret+' other item'+(ret===1?' was':'s were')+' already returned.)':'');
}

function secAlerts(n){
  if(!n)return 'MY ALERTS: '+NA;
  if(!n.length)return 'MY ALERTS: none.';
  return 'MY LATEST ALERTS (newest first):\n'+n.slice(0,10).map(function(x){return '- '+fdt(x.created_at)+': '+cut(x.message,160);}).join('\n');
}

function secHead(){
  var d=new Date();
  return 'NOW: '+d.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})+', '+
    d.toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'})+' (device time).\nSTUDENT: '+firstName()+' (first name only).';
}

function capSec(s,n){return s.length>n?s.slice(0,n-1)+'…':s;}

async function build(){
  var u=uid();
  var names=['subs','att','tt','cal','ann','leave','meal','pay','clubs','mem','posts','pod','items','alerts'];
  var annCols='title,body,category,priority,pinned,created_at,expires_at';
  var vals=await Promise.all([
    qry('subjects','code,name,description,syllabus,faculty',function(b){return b.order('code');}),
    qry('attendance','subject_code,attended,total,updated_at',function(b){return b.eq('user_id',u);}),
    qry('timetable','dow,start_time,end_time,subject_code,room',function(b){return b.order('dow').order('start_time');}),
    qry('calendar_events','event_date,title,kind',function(b){return b.order('event_date');}),
    qry('hive_announcements',annCols,function(b){return b.order('created_at',{ascending:false}).limit(20);}).then(function(r){
      if(r!==null)return r;
      return qry('hive_announcements','title,body,category,priority,pinned,created_at',function(b){return b.order('created_at',{ascending:false}).limit(20);}).then(function(r2){
        return r2!==null?r2:qry('hive_announcements','title,body,category,pinned,created_at',function(b){return b.order('created_at',{ascending:false}).limit(20);});
      });
    }),
    qry('leave_requests','kind,from_date,to_date,status,admin_note,created_at',function(b){return b.eq('user_id',u).order('created_at',{ascending:false}).limit(10);}),
    qry('meal_bookings','meal,meal_date',function(b){return b.eq('user_id',u).order('meal_date',{ascending:false}).limit(12);}),
    qry('payments','item,amount,status,created_at',function(b){return b.eq('user_id',u).order('created_at',{ascending:false}).limit(10);}),
    qry('clubs','id,name,description',function(b){return b.order('name');}),
    qry('club_members','club_id',function(b){return b.eq('user_id',u);}),
    qry('community_posts','user_id,kind,category,title,description,sdg,status,created_at',function(b){return b.order('created_at',{ascending:false}).limit(15);}),
    qry('podcast_episodes','title,description,guest,published_at',function(b){return b.order('published_at',{ascending:false}).limit(5);}),
    qry('items','user_id,type,name,category,location,status,description,created_at',function(b){return b.order('created_at',{ascending:false}).limit(25);}),
    qry('notifications','message,created_at',function(b){return b.eq('user_id',u).order('created_at',{ascending:false}).limit(10);})
  ]);
  var R={};names.forEach(function(n,i){R[n]=vals[i];});
  if(Array.isArray(R.ann))R.ann=R.ann.filter(function(a){return !a.expires_at||new Date(a.expires_at).getTime()>Date.now();});
  var parts=[secHead(),secAttendance(R.subs,R.att),secTimetable(R.tt,R.subs),secCalendar(R.cal),secNews(R.ann),secStudy(R.subs),
    secLeave(R.leave),secMess(R.meal),secFees(R.pay),secLF(R.items),secClubs(R.clubs,R.mem),secPosts(R.posts),secPodcast(R.pod),secAlerts(R.alerts)];
  var text=parts.map(function(p){return capSec(p,7000);}).join('\n\n');
  return capSec(scrub(text),CFG.ctxMax);
}

/* =====================================================================================================
   2. CHAT STATE + TALKING TO THE EDGE FUNCTION
   ===================================================================================================== */
var A={uid:null,msgs:[],busy:false,stage:'',ctl:null,snap:null,snapAt:0,snapUid:null,snapP:null,draft:'',sheet:null,pending:null,rn:0};

function consent(){return !!ld('hive_ai_ok_'+uid(),false);}
function save(){A.msgs=A.msgs.slice(-CFG.keepMsgs);if(uid())ssv('hive_ai_msgs_'+uid(),A.msgs);}

async function snapshot(force){
  var now=Date.now();
  if(!force&&A.snap&&A.snapUid===uid()&&now-A.snapAt<CFG.ttl)return A.snap;
  if(A.snapP)return A.snapP;
  var who=uid();
  A.snapP=build().then(function(c){A.snap=c;A.snapAt=Date.now();A.snapUid=who;A.snapP=null;return c;},function(e){A.snapP=null;throw e;});
  return A.snapP;
}

function aiErr(code,msg,status,retry){var e=new Error(msg||code);e.code=code;e.status=status||0;e.retry=retry||0;return e;}

async function callAI(history,ctx,ctl){
  var s=await supabase.auth.getSession(),tok=s&&s.data&&s.data.session&&s.data.session.access_token;
  if(!tok)throw aiErr('unauthorized','Please sign in again.',401);
  var timer=setTimeout(function(){ctl.timedOut=true;ctl.abort();},CFG.timeout),r,j=null;
  try{
    r=await fetch(CFG.fnUrl||(String(SUPABASE_URL).replace(/\/+$/,'')+'/functions/v1/'+CFG.fn),{
      method:'POST',signal:ctl.signal,
      headers:CFG.fnUrl?{'Content-Type':'application/json','Authorization':'Bearer '+tok}:{'Content-Type':'application/json','Authorization':'Bearer '+tok,'apikey':SUPABASE_KEY},
      body:JSON.stringify({messages:history,context:ctx})
    });
    try{j=await r.json();}catch(e){}
  }catch(e){
    if(ctl.userStopped)throw e;
    if(ctl.timedOut)throw aiErr('timeout','timeout');
    throw aiErr('network','network');
  }finally{clearTimeout(timer);}
  if(r.ok&&j&&typeof j.reply==='string'&&j.reply.trim())return j;
  var er=j&&j.error;
  if(er&&er.code)throw aiErr(er.code,er.message,r.status,er.retry_after);
  if(r.status===404)throw aiErr('not_deployed','not deployed',404);
  if(r.status===401||r.status===403)throw aiErr('gateway',String((j&&(j.message||j.msg||j.error_description||j.error))||'gateway').slice(0,120),r.status);   /* Supabase itself said no: "Verify JWT" is still on */
  throw aiErr('ai_failed','failed',r.status);
}

/* problems that only the admin (or tomorrow) can fix: a "Try again" button would just waste taps */
var NORETRY={blocked:1,unauthorized:1,ai_daily_limit:1,ai_out_of_credit:1,not_configured:1,not_deployed:1,ai_misconfigured:1,gateway:1,ai_model_unavailable:1,too_large:1,bad_request:1};
var ERR={
  not_configured:'HIVE AI is not switched on yet. Please tell your admin.',
  not_deployed:'HIVE AI is not set up on the server yet. Admin: follow AI_SETUP.md (deploy the hive-ai function).',
  ai_misconfigured:'HIVE AI is not set up correctly yet. Please tell your admin.',
  ai_out_of_credit:'HIVE AI has run out of credit for now. Please tell your admin.',
  ai_busy:'HIVE AI is very busy right now. Please try again in a minute.',
  ai_daily_limit:'HIVE AI has reached its free limit for today. Please try again tomorrow, or ask your admin to add credit.',
  ai_model_unavailable:'HIVE AI’s model is not available right now. Please tell your admin.',
  gateway:'HIVE AI is not set up correctly yet (the server turned the sign-in away). Please tell your admin.',
  ai_failed:'HIVE AI could not answer just now. Please try again.',
  unauthorized:'Your session has expired. Please log in again.',
  blocked:'Your account does not have access to HIVE AI.',
  too_large:'That was too much to send. Start a new chat and try again.',
  bad_request:'That message could not be understood. Please rephrase it.',
  timeout:'HIVE AI took too long to answer. Try again, or ask a shorter question.',
  network:'Can’t reach HIVE AI. Check your connection and try again. (If you are online, the AI service may not be set up yet.)'
};
function niceError(e){
  var c=(e&&e.code)||'';
  if(c==='rate_limited')return ((e.message&&e.message!==c?e.message:'You are sending messages too quickly. Please wait a moment.')+(e.retry&&e.retry<600?' Try again in about '+e.retry+' s.':''));
  if(c==='gateway'&&e.message&&e.message!=='gateway')return ERR.gateway+' [Supabase said: '+e.message+']';
  return ERR[c]||ERR.ai_failed;
}

function history(){
  return A.msgs.filter(function(m){return m.r==='user'||m.r==='assistant';}).slice(-CFG.maxTurns)
    .map(function(m){return {role:m.r,content:m.c};});
}

function ask(text){
  text=String(text||'').replace(/[ \t]+\n/g,'\n').trim().slice(0,CFG.maxInput);
  if(!text||A.busy||!S.user||!consent())return;
  if(!navigator.onLine){toast('You are offline. Reconnect to chat with HIVE AI.');return;}
  var safe=scrub(text);
  if(safe!==text){text=safe;toast('For your safety, anything that looks like a password or personal number is removed before sending.',4200);}
  A.msgs.push({r:'user',c:text,t:Date.now()});
  run();
}

async function run(){
  var ctl=new AbortController(),me=uid();
  A.busy=true;A.stage='data';A.ctl=ctl;save();paint(true);
  try{
    var ctx=await snapshot();
    if(ctl.signal.aborted){var ab=new Error('aborted');ab.name='AbortError';throw ab;}
    A.stage='think';sync();
    var out=await callAI(history(),ctx,ctl);
    if(uid()!==me)return;
    A.msgs.push({r:'assistant',c:out.reply,m:out.model||'',t:Date.now()});
  }catch(e){
    if(uid()!==me)return;
    if(ctl.userStopped)A.msgs.push({r:'note',c:'You stopped this answer.'});
    else A.msgs.push({r:'error',c:niceError(e),retry:!NORETRY[(e&&e.code)||''],t:Date.now()});
  }
  if(uid()===me){A.busy=false;A.ctl=null;A.stage='';save();paint();}
}

function stop(){if(A.ctl){A.ctl.userStopped=true;try{A.ctl.abort();}catch(e){}}}
function retry(){
  if(A.busy)return;
  var last=A.msgs[A.msgs.length-1];
  if(last&&last.r==='error')A.msgs.pop();
  if(A.msgs.length&&A.msgs[A.msgs.length-1].r==='user')run();else paint(true);
}

/* =====================================================================================================
   3. SCREEN
   ===================================================================================================== */
var MARK='<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="12,2 21,7 21,17 12,22 3,17 3,7" fill="#fbbf24"/><circle cx="12" cy="12" r="3" fill="#0b1220"/></svg>';
function svg(p,w){return '<svg viewBox="0 0 24 24" width="'+(w||20)+'" height="'+(w||20)+'" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>';}
var I_SEND=svg('<path d="M12 19V5"/><path d="M5 12l7-7 7 7"/>',20);
var I_STOP='<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="3"/></svg>';
var I_INFO=svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.5h.01"/>',19);
var I_NEW=svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',18);

var SUG=[
  {e:'📊',t:'Attendance',h:'Where you stand',p:'Summarise my attendance. Which subjects are at risk, and how many classes can I miss or must I attend?'},
  {e:'📰',t:'Catch me up',h:'Latest news',p:'Summarise the latest announcements and news. What needs action from me?'},
  {e:'🗓️',t:'This week',h:'Classes and deadlines',p:'What does my day look like today, and which exams, fee deadlines or events are coming up soon?'},
  {e:'📚',t:'Study help',h:'Revise, then quiz me',p:'Pick one of my subjects and give me a short revision summary of its syllabus, then ask me 3 quick quiz questions.'},
  {e:'⚠️',t:'Watch-outs',h:'What not to miss',p:'What should I watch out for this week? Check attendance, deadlines, urgent news, my leave and my fee status.'},
  {e:'🔎',t:'Lost & Found',h:'Anything of mine?',p:'Look at the open Lost & Found items. Is anything possibly mine, or anything I reported that needs action?'}
];

/* --- tiny markdown (bold, italic, code, lists, headings). Escape FIRST, then add our own tags: model output is never trusted. --- */
function inl(t){
  t=X(t);
  t=t.replace(/`([^`\n]+)`/g,'<code>$1</code>');
  t=t.replace(/\*\*([^*\n]+?)\*\*/g,'<b>$1</b>');
  t=t.replace(/(^|[^\w*])\*([^*\s][^*\n]*?)\*(?![\w*])/g,'$1<i>$2</i>');
  return t;
}
function md(src){
  var codes=[],s=String(src==null?'':src).replace(/\r/g,'');
  s=s.replace(/```[^\n`]*\n?([\s\S]*?)```/g,function(_,c){codes.push(c.replace(/\n+$/,''));return '\n\u0001'+(codes.length-1)+'\u0001\n';});
  var out=[],list=null,lines=s.split('\n'),m;
  function close(){if(list){out.push('</'+list+'>');list=null;}}
  for(var i=0;i<lines.length;i++){
    var ln=lines[i];
    if((m=/^\u0001(\d+)\u0001$/.exec(ln.trim()))){close();out.push('<pre class="ai-code"><code>'+X(codes[+m[1]]||'')+'</code></pre>');continue;}
    if((m=/^\s*[-*•]\s+(.*)$/.exec(ln))){if(list!=='ul'){close();out.push('<ul>');list='ul';}out.push('<li>'+inl(m[1])+'</li>');continue;}
    if((m=/^\s*\d{1,2}[.)]\s+(.*)$/.exec(ln))){if(list!=='ol'){close();out.push('<ol>');list='ol';}out.push('<li>'+inl(m[1])+'</li>');continue;}
    close();
    if(!ln.trim())continue;
    if((m=/^#{1,4}\s+(.*)$/.exec(ln))){out.push('<div class="ai-h">'+inl(m[1])+'</div>');continue;}
    out.push('<p>'+inl(ln)+'</p>');
  }
  close();
  return out.join('');
}
function plain(s){return X(s).replace(/\n/g,'<br>');}

function subline(){
  if(A.busy)return A.stage==='data'?'Reading your HIVE data…':'Thinking…';
  return 'Private · reads your HIVE data';
}
function shortModel(m){return String(m||'').split('/').pop();}

function msgHTML(m,i){
  if(m.r==='user')return '<div class="ai-msg user"><div class="ai-bub">'+plain(m.c)+'</div><div class="ai-tm">'+X(tm(m.t))+'</div></div>';
  if(m.r==='assistant')return '<div class="ai-msg assistant"><span class="ai-orb xs">'+MARK+'</span><div class="ai-wrap"><div class="ai-bub">'+md(m.c)+'</div>'+
    '<div class="ai-foot"><button type="button" class="ai-link" onclick="HIVEAI.copy('+i+')">Copy</button><span>'+X(tm(m.t))+(m.m?' · '+X(shortModel(m.m)):'')+'</span></div></div></div>';
  if(m.r==='error')return '<div class="ai-msg error"><span class="ai-ico" aria-hidden="true">⚠️</span><div class="ai-wrap"><div class="ai-bub">'+X(m.c)+'</div>'+
    (m.retry?'<button type="button" class="ai-retry" onclick="HIVEAI.retry()">Try again</button>':'')+'</div></div>';
  return '<div class="ai-note">'+X(m.c)+'</div>';
}
function typingHTML(){
  return '<div class="ai-msg assistant ai-typing" id="aiTyping"><span class="ai-orb xs">'+MARK+'</span><div class="ai-wrap"><div class="ai-bub" aria-label="HIVE AI is typing"><i></i><i></i><i></i></div>'+
    '<div class="ai-foot"><span id="aiStage">'+X(subline())+'</span></div></div></div>';
}
function welcomeHTML(){
  return '<div class="ai-col ai-welcome"><div class="ai-hero"><div class="ai-cluster" aria-hidden="true"><i></i><i></i><i></i></div><h2>Hi '+X(firstName())+' 👋</h2>'+
    '<p>Ask me about your attendance, timetable, news, study materials, clubs or campus services. Community chat messages are not included in my context.</p></div>'+
    '<div class="ai-grid">'+SUG.slice(0,6).map(function(s,i){return '<button type="button" class="ai-sug" style="--i:'+i+'" onclick="HIVEAI.sug('+i+')"><span aria-hidden="true">'+s.e+'</span><b>'+X(s.t)+'</b><small>'+X(s.h)+'</small></button>';}).join('')+'</div>'+
    '<button type="button" class="ai-privacy" onclick="HIVEAI.info()"><span aria-hidden="true">🔒</span><span>I never see your password, username or payment details. <u>How it works</u></span></button></div>';
}
function listHTML(){return '<div class="ai-col" id="aiList">'+A.msgs.map(msgHTML).join('')+(A.busy?typingHTML():'')+'</div>';}

function dockHTML(){
  var ok=consent();
  return '<div class="ai-dock"><div class="ai-dock-in">'+
    '<div class="hpills ai-chips" id="aiChips"'+(A.msgs.length?'':' hidden')+'>'+SUG.map(function(s,i){return '<button type="button" class="hpill" onclick="HIVEAI.sug('+i+')"'+(A.busy||!ok?' disabled':'')+'>'+s.e+' '+X(s.t)+'</button>';}).join('')+'</div>'+
    '<div class="ai-composer"><textarea id="aiIn" rows="1" maxlength="'+CFG.maxInput+'" placeholder="'+(ok?'Ask HIVE AI anything…':'Read the privacy note to start')+'" aria-label="Message HIVE AI"'+(ok?'':' disabled')+'>'+X(A.draft)+'</textarea>'+
    '<button type="button" class="ai-send'+(A.busy?' stop':'')+'" id="aiSend" onclick="HIVEAI.send()" aria-label="'+(A.busy?'Stop':'Send')+'">'+(A.busy?I_STOP:I_SEND)+'</button></div>'+
    '<div class="ai-fine" id="aiFine">AI can make mistakes — check important details.</div></div></div>';
}

function screen(){
  return '<div class="top ai-top"><button type="button" class="back-btn" onclick="HIVEAI.back()" aria-label="Back to profile">←</button>'+
    '<div class="ai-brand"><span class="ai-orb sm">'+MARK+'</span><div><b>HIVE AI</b><small id="aiSub">'+X(subline())+'</small></div></div>'+
    '<div class="ai-tools"><button type="button" class="ai-ib" onclick="HIVEAI.info()" aria-label="What HIVE AI can see">'+I_INFO+'</button>'+
    '<button type="button" class="ai-ib" onclick="HIVEAI.fresh()" aria-label="Start a new chat">'+I_NEW+'</button></div></div>'+
    '<div class="ai-body" id="aiBody" role="log" aria-live="polite" aria-relevant="additions">'+((A.msgs.length||A.busy)?listHTML():welcomeHTML())+'</div>'+dockHTML();
}

/* --- keep the DOM in step with the state without rebuilding the whole screen --- */
function toEnd(){var b=$('aiBody');if(!b)return;b.scrollTop=(A.msgs.length||A.busy)?b.scrollHeight:0;}   /* chat: follow the newest message; welcome: stay at the top */
function sync(){
  var b=$('aiSend'),inp=$('aiIn');
  document.body.classList.toggle('ai-busy',!!A.busy&&S.view==='ai');
  if(b){b.className='ai-send'+(A.busy?' stop':(inp&&inp.value.trim()?' ready':''));b.innerHTML=A.busy?I_STOP:I_SEND;b.setAttribute('aria-label',A.busy?'Stop':'Send');}
  var c=$('aiChips');
  if(c){c.hidden=!A.msgs.length;var bs=c.getElementsByTagName('button');for(var i=0;i<bs.length;i++)bs[i].disabled=A.busy||!consent();}
  var s=$('aiSub');if(s)s.textContent=subline();
  var g=$('aiStage');if(g)g.textContent=subline();
}
function paint(force){
  var body=$('aiBody');if(!body)return;
  var near=body.scrollHeight-body.scrollTop-body.clientHeight<160;
  var list=$('aiList'),ty=$('aiTyping');
  if(!A.msgs.length&&!A.busy){body.innerHTML=welcomeHTML();body.scrollTop=0;A.rn=0;sync();return;}
  if(!list||A.rn>A.msgs.length||body.querySelector('.ai-welcome')){body.innerHTML=listHTML();A.rn=A.msgs.length;list=$('aiList');ty=null;}
  else{
    if(ty){ty.remove();ty=null;}
    for(var i=A.rn;i<A.msgs.length;i++)list.insertAdjacentHTML('beforeend',msgHTML(A.msgs[i],i));
    A.rn=A.msgs.length;
  }
  if(A.busy&&!$('aiTyping'))list.insertAdjacentHTML('beforeend',typingHTML());
  sync();
  if(near||force)toEnd();
}

/* On phones the on-screen keyboard covers the bottom of the page. Follow the visible area while this screen is open. */
function fit(){
  var ph=$('phone'),v=window.visualViewport;if(!ph)return;
  if(S.view!=='ai'||!v||v.height>=window.innerHeight-60){ph.style.height='';ph.style.transform='';document.body.classList.remove('ai-kb');return;}
  document.body.classList.add('ai-kb');
  ph.style.height=v.height+'px';
  ph.style.transform=v.offsetTop?'translateY('+v.offsetTop+'px)':'';
  toEnd();
}
function watchViewport(){
  if(A.vv||!window.visualViewport)return;
  A.vv=true;
  window.visualViewport.addEventListener('resize',fit);
  window.visualViewport.addEventListener('scroll',fit);
}
function grow(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,120)+'px';}
function wire(){
  var el=$('aiIn');if(!el)return;
  function fine(){
    var f=$('aiFine'),n=el.value.length;
    if(f)f.textContent=n>CFG.maxInput-300?n+' / '+CFG.maxInput+' characters':'AI can make mistakes — check important details.';
  }
  function ready(){var b=$('aiSend');if(b)b.classList.toggle('ready',!A.busy&&el.value.trim().length>0);}
  el.addEventListener('input',function(){A.draft=el.value;grow(el);fine();ready();});
  el.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey&&!COARSE&&!e.isComposing){e.preventDefault();send();}});
  el.addEventListener('focus',function(){setTimeout(toEnd,260);});
  grow(el);fine();ready();
}

/* --- privacy sheet (first use + the (i) button) --- */
var CAN=['📊 Attendance','🗓️ Timetable & calendar','📰 News & announcements','📚 Study material','🍽️ Mess & leave status','💳 Fee status','🎯 Clubs, posts & podcast','🔎 Lost & Found'];
var NOT=['🔑 Passwords','👤 Usernames & e-mails','🪪 Roll number','🧾 Payment references & UPI','🔐 Private claim details','💬 Community chat messages'];
function sheetBody(first){
  return '<div class="ai-sheet-body"><div class="ai-grab" aria-hidden="true"></div><h3>'+(first?'Before you start':'Your privacy with HIVE AI')+'</h3>'+
    '<p class="ai-lead">HIVE AI reads selected HIVE information to help explain your own records. Community chat messages are not included.</p>'+
    '<div class="ai-sec">It can read</div><div class="ai-tags">'+CAN.map(function(t){return '<span class="ai-tag ok">'+X(t)+'</span>';}).join('')+'</div>'+
    '<div class="ai-sec">It never sees</div><div class="ai-tags">'+NOT.map(function(t){return '<span class="ai-tag no">'+X(t)+'</span>';}).join('')+'</div>'+
    '<div class="ai-sec">How it works</div><p class="ai-small">When you ask something, HIVE sends your question and a short snapshot of the information above to an AI service run by a third party, which writes the answer. Anything that looks like a password, e-mail or phone number, and your own username and roll number, is removed first. Community chat messages are not included. Please still don’t type private details into the assistant, or anything you wouldn’t want a stranger to read. This conversation is kept only until you log out or close the app.</p>'+
    '<button type="button" class="ai-linkbtn" onclick="HIVEAI.preview()">👁 Show me exactly what HIVE AI can read</button></div>'+
    (first?'<div class="ai-actions"><button type="button" class="ai-ghost" onclick="HIVEAI.decline()">Not now</button><button type="button" class="btn btn-primary" onclick="HIVEAI.agree()">I understand</button></div>'
          :'<div class="ai-actions"><button type="button" class="btn btn-primary" onclick="HIVEAI.closeSheet()">Got it</button></div>');
}
function sheetNew(){
  return '<div class="ai-sheet-body"><div class="ai-grab" aria-hidden="true"></div><h3>Start a new chat?</h3>'+
    '<p class="ai-lead">This clears the current conversation. Nothing in HIVE is changed.</p></div>'+
    '<div class="ai-actions"><button type="button" class="ai-ghost" onclick="HIVEAI.closeSheet()">Keep chatting</button><button type="button" class="btn btn-primary" onclick="HIVEAI.reset()">Start new chat</button></div>';
}
function openSheet(kind){
  closeSheet(true);
  var ph=$('phone');if(!ph)return;
  var d=document.createElement('div');
  d.id='aiSheet';d.className='ai-sheet';d.setAttribute('role','dialog');d.setAttribute('aria-modal','true');d.setAttribute('aria-label',kind==='new'?'Start a new chat':'Your privacy with HIVE AI');
  d.innerHTML='<div class="ai-sheet-in" id="aiSheetIn">'+(kind==='new'?sheetNew():sheetBody(kind==='consent'))+'</div>';
  d.addEventListener('click',function(e){if(e.target===d&&kind!=='consent')closeSheet();});
  ph.appendChild(d);A.sheet=kind;
  var b=d.querySelector('.btn-primary');if(b)b.focus({preventScroll:true});
}
function closeSheet(quiet){var d=$('aiSheet');if(d)d.remove();A.sheet=null;if(!quiet){var i=$('aiIn');if(i&&!COARSE&&!i.disabled)i.focus({preventScroll:true});}}
async function preview(){
  var box=$('aiSheetIn');if(!box)return;
  var first=A.sheet==='consent';
  box.innerHTML='<div class="ai-sheet-body"><div class="ai-grab" aria-hidden="true"></div><h3>What HIVE AI can read</h3><p class="ai-small">Reading your data…</p></div>'+
    '<div class="ai-actions"><button type="button" class="btn btn-primary" onclick="HIVEAI.'+(first?'again':'closeSheet')+'()">'+(first?'Back':'Close')+'</button></div>';
  var txt;
  try{txt=await snapshot(true);}catch(e){txt='(could not load the data right now)';}
  box=$('aiSheetIn');if(!box)return;
  box.innerHTML='<div class="ai-sheet-body"><div class="ai-grab" aria-hidden="true"></div><h3>What HIVE AI can read</h3>'+
    '<p class="ai-small">This is exactly the text sent along with your question ('+txt.length.toLocaleString()+' characters, read just now). Chat authors, passwords, usernames and payment references are not in it.</p>'+
    '<pre class="ai-pre" tabindex="0">'+X(txt)+'</pre></div>'+
    '<div class="ai-actions"><button type="button" class="btn btn-primary" onclick="HIVEAI.'+(first?'again':'closeSheet')+'()">'+(first?'Back':'Got it')+'</button></div>';
}

/* --- public actions --- */
function back(){
  closeSheet(true);
  if(S.history.length&&S.history[S.history.length-1]!=='ai')goBack();else nav('hprofile',true);
}
function open(prompt){
  if(!S.user)return;
  A.pending=prompt?String(prompt):null;
  if(S.view==='ai'){flush();return;}
  nav('ai');
}
function flush(){
  if(!A.pending||A.busy||!consent())return;
  var p=A.pending;A.pending=null;ask(p);
}
function fresh(){
  if(!A.msgs.length&&!A.busy)return;
  openSheet('new');
}
function reset(){
  closeSheet(true);stop();A.msgs=[];A.busy=false;A.stage='';A.rn=0;A.draft='';save();
  render();
}
function send(){
  if(A.busy){stop();return;}
  var el=$('aiIn');if(!el||el.disabled)return;
  var t=el.value;
  if(!String(t).trim())return;
  el.value='';A.draft='';grow(el);
  ask(t);
}
function copyText(t){
  function fb(){var ta=document.createElement('textarea');ta.value=t;ta.style.cssText='position:fixed;opacity:0;top:0';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');toast('Copied');}catch(e){toast('Could not copy');}ta.remove();}
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(function(){toast('Copied');},fb);else fb();
}

function card(){
  if(!S.user)return '';
  return '<div class="hcard ai-entry" role="button" tabindex="0" onclick="HIVEAI.open()" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();HIVEAI.open();}">'+
    '<span class="ai-orb">'+MARK+'</span>'+
    '<div class="ai-entry-t"><div><b>✦ HIVE AI</b><span class="ai-pill">Beta</span></div><div class="hsub">Ask about your attendance, news, study materials, clubs and campus services.</div></div>'+
    '<span class="ai-go" aria-hidden="true">›</span></div>';
}

window.HIVEAI={
  card:card,open:open,context:function(){return snapshot(true);},scrub:scrub,
  back:back,fresh:fresh,reset:reset,send:send,retry:retry,info:function(){openSheet('info');},closeSheet:function(){closeSheet();},
  preview:preview,again:function(){openSheet('consent');},
  sug:function(i){var s=SUG[i];if(s)ask(s.p);},
  copy:function(i){var m=A.msgs[i];if(m)copyText(m.c);},
  agree:function(){sv('hive_ai_ok_'+uid(),true);closeSheet(true);render();},
  decline:function(){closeSheet(true);back();}
};

/* --- hook into the shell (same pattern as hive2.js / hive3.js) --- */
HIVE.screens.ai=screen;
function after(){
  var u=uid();
  document.body.classList.toggle('ai-on',S.view==='ai');
  if(S.view!=='ai'){document.body.classList.remove('ai-busy');document.body.classList.remove('ai-kb');}
  watchViewport();fit();
  if(u!==A.uid){
    A.uid=u;A.msgs=u?sld('hive_ai_msgs_'+u,[]):[];A.busy=false;A.stage='';A.snap=null;A.snapP=null;A.draft='';A.pending=null;A.rn=0;A.sheet=null;
    if(A.ctl){try{A.ctl.abort();}catch(e){}A.ctl=null;}
  }
  if(!u||S.view!=='ai')return;
  A.rn=A.msgs.length;
  wire();toEnd();
  if(!consent()){openSheet('consent');return;}
  snapshot().catch(function(){});                 /* warm up, so the first answer is quicker */
  if(A.pending)flush();
  else if(!COARSE&&!A.busy){var i=$('aiIn');if(i)i.focus({preventScroll:true});}
}
var oa=HIVE.after;
HIVE.after=function(){oa();after();};

var od=window.doLogout;
if(typeof od==='function'){
  window.doLogout=function(){
    try{if(uid())ssv('hive_ai_msgs_'+uid(),[]);}catch(e){}
    A.msgs=[];A.snap=null;A.busy=false;if(A.ctl){try{A.ctl.abort();}catch(e){}}
    return od.apply(this,arguments);
  };
}
document.addEventListener('keydown',function(e){
  var sh=$('aiSheet');if(!sh)return;
  if(e.key==='Escape'){if(A.sheet==='consent')window.HIVEAI.decline();else closeSheet();return;}
  if(e.key!=='Tab')return;                                   /* keep keyboard focus inside the open sheet */
  var f=[].filter.call(sh.querySelectorAll('button,pre[tabindex]'),function(x){return !x.disabled&&x.offsetParent!==null;});
  if(!f.length)return;
  var a=document.activeElement;
  if(!sh.contains(a)||(!e.shiftKey&&a===f[f.length-1])){e.preventDefault();f[0].focus();}
  else if(e.shiftKey&&a===f[0]){e.preventDefault();f[f.length-1].focus();}
});

/* If the app already painted its first screen before this file loaded (slow network), repaint so the AI card appears. */
var ph=$('phone');if(ph&&ph.firstChild&&(!S.user||S.profile))render();
})();
