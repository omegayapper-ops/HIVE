/* HIVE field admin — one engine, two panels (admin-education.html / admin-medical.html).
   Signs in with an ADMIN ACCOUNT (profiles.is_admin + profiles.admin_fields) and reads/writes only rows of its own field;
   the database (row-level security) enforces that, this file only draws the screens. Run hive_unified.sql first. */
(function(){'use strict';
var db=window.supabase.createClient('https://uhesiuyjbiwpwlulmaqw.supabase.co','sb_publishable_T7oa-3syn79PiHlf63EKVg_KhNz5lMg');
var F=document.documentElement.getAttribute('data-field')==='medical'?'medical':'education',LBL=F==='medical'?'Medical':'Education';
var $=function(i){return document.getElementById(i);};
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function toast(m){var o=document.querySelector('.toast');if(o)o.remove();var d=document.createElement('div');d.className='toast';d.textContent=m;document.body.appendChild(d);setTimeout(function(){if(d.parentNode)d.remove();},3400);}
var MARK='<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><polygon points="12,2 21,7 21,17 12,22 3,17 3,7" fill="#FBC02D"/><circle cx="12" cy="12" r="3" fill="#0b1220"/></svg>';
var A={me:null,tab:'users',rows:[],names:{},edit:null,msg:'',subs:[],sub:null,stu:[],att:{},expirySupported:false,clubCounts:{},clubMembers:[],clubMembersClub:null,clubMembersError:''};
var T=[
 {k:'users',ic:'👥',t:'People'},
 {k:'attendance',ic:'✅',t:'Attendance'},
 {k:'hive_announcements',ic:'📰',t:'News',cols:[['title','Title','text'],['body','Message','area'],['category','Category','text'],['priority','Priority',['normal','important','urgent']],['pinned','Pinned','bool'],['expires_at','Expiry date & time (optional)','datetime-local']],list:['title','priority','category','expires_at'],ord:['created_at',0],def:{author:'Admin',category:'General',priority:'normal'}},
 {k:'subjects',ic:'📚',t:'Subjects',pk:'code',cols:[['code','Code','text'],['name','Name','text'],['faculty','Faculty','text'],['description','Description','area'],['syllabus','Syllabus (topics separated by |)','area']],list:['code','name','faculty'],ord:['code',1]},
 {k:'timetable',ic:'🗓️',t:'Timetable',cols:[['dow','Day (1=Mon … 6=Sat)','num'],['start_time','Starts','time'],['end_time','Ends','time'],['subject_code','Subject code','text'],['room','Room','text']],list:['dow','start_time','end_time','subject_code','room'],ord:['dow',1]},
 {k:'calendar_events',ic:'📅',t:'Calendar',cols:[['event_date','Date','date'],['title','Title','text'],['kind','Type',['event','exam','fee','holiday','academic']]],list:['event_date','title','kind'],ord:['event_date',1]},
 {k:'leave_requests',ic:'🏖️',t:'Leave',noAdd:1,noDel:1,cols:[['status','Status',['pending','approved','denied','questioned','informed']],['admin_note','Note to student','area']],list:['kind','from_date','to_date','reason','status','admin_note'],ord:['created_at',0]},
 {k:'payments',ic:'💳',t:'Payments',noAdd:1,noDel:1,cols:[['status','Status',['initiated','pending','approved','rejected']]],list:['item','amount','status','utr'],ord:['created_at',0]},
 {k:'meal_bookings',ic:'🍽️',t:'Meals',ro:1,list:['meal','meal_date'],ord:['meal_date',0]},
 {k:'clubs',ic:'🎯',t:'Clubs',cols:[['name','Name','text'],['emoji','Emoji','text'],['description','Description','area']],list:['name','description'],ord:['name',1],def:{emoji:'🎯'}},
 {k:'podcast_episodes',ic:'🎙️',t:'Podcast',cols:[['title','Title','text'],['guest','Guest','text'],['description','Description','area'],['media_url','Audio / video link (https)','text']],list:['title','guest'],ord:['published_at',0]},
 {k:'community_posts',ic:'🖼️',t:'Posts',noAdd:1,cols:[['status','Status',['open','resolved','hidden']],['admin_note','Admin note','area']],list:['kind','title','author_name','status'],ord:['created_at',0]},
 {k:'items',ic:'🧭',t:'Lost & Found',noAdd:1,cols:[['status','Status',['open','returned']]],list:['type','name','category','location','status'],ord:['created_at',0]}
];
function cur(){return T.filter(function(x){return x.k===A.tab;})[0];}
function un(p){return String(p.email||'').replace('@hive.local','');}
function fmt(k,v){if(v==null||v==='')return '—';if(typeof v==='boolean')return v?'Yes':'No';v=String(v);if(/_time$/.test(k))v=v.slice(0,5);if(k==='expires_at'){var d=new Date(v);if(!isNaN(d.getTime()))v=d.toLocaleString('en-IN',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});}return v.length>140?v.slice(0,139)+'…':v;}
function top(){return '<div class="top admin-top"><div class="brand">'+MARK+'<span>HIVE Admin · '+LBL+'</span></div><div class="admin-nav"><a class="hbtn" href="admin.html">Admin hub</a><a class="hbtn" href="admin-education.html">Education</a><a class="hbtn" href="admin-medical.html">Medical</a><a class="hbtn" href="ops.html">Legacy tools</a><button class="hbtn" onclick="ADM.out()">Sign out</button></div></div>'}

/* ---------- sign-in ---------- */
function login(msg){
  $('phone').innerHTML='<div class="login-hero"><div class="login-hero-inner"><div class="hv-logo login-brand-assembly" role="img" aria-label="HIVE — your community, truly intelligent"><img class="login-brand-mark" src="hive_mark.svg" width="336" height="368" alt="" decoding="async"><div class="login-brand-wordmark">HIVE</div><div class="login-brand-tagline">YOUR COMMUNITY, TRULY INTELLIGENT</div></div><div class="login-form-card">'+(msg?'<div class="login-msg">'+esc(msg)+'</div>':'')+
  '<div class="fchip"><span>'+(F==='medical'?'🩺':'🎓')+'</span><b>'+LBL+' admin panel</b><button type="button" onclick="location.href=\'admin.html\'">Change</button></div>'+
  '<div class="login-field"><label>Admin username</label><input id="aUser" autocomplete="username" autocapitalize="off" placeholder="username"></div>'+
  '<div class="login-field"><label>Password</label><input type="password" id="aPass" autocomplete="current-password" placeholder="Password" onkeydown="if(event.key===\'Enter\')ADM.signin()"></div>'+
  '<button class="login-btn" id="aBtn" onclick="ADM.signin()">Sign in</button></div></div></div>';
}
async function signin(){
  var u=($('aUser').value||'').trim().toLowerCase(),p=$('aPass').value||'';
  if(!u||!p){toast('Enter username and password');return;}
  if(u.indexOf('@')<0)u+='@hive.local';
  var b=$('aBtn');if(b){b.disabled=true;b.textContent='Signing in…';}
  var r=await db.auth.signInWithPassword({email:u,password:p});
  if(r.error){login(r.error.message);return;}
  await enter(r.data.user);
}
async function enter(user){
  var r=await db.from('profiles').select('*').eq('id',user.id).maybeSingle(),p=r.data;
  var af=p&&Array.isArray(p.admin_fields)&&p.admin_fields.length?p.admin_fields:['education'];
  if(!p||p.is_admin!==true||af.indexOf(F)<0){await db.auth.signOut();login('This account is not an administrator of the '+LBL+' field.');return;}
  A.me=p;A.tab='users';load();
}
async function out(){await db.auth.signOut();A.me=null;login();}

/* ---------- loading ---------- */
async function names(){
  var ids=[];A.rows.forEach(function(r){if(r.user_id&&ids.indexOf(r.user_id)<0)ids.push(r.user_id);});
  if(!ids.length)return;
  var r=await db.from('profiles').select('id,name').in('id',ids);
  (r.data||[]).forEach(function(p){A.names[p.id]=p.name;});
}
async function people(){
  var r=await db.from('profiles').select('id,name,email,roll_no,role,is_admin,fields').contains('fields',[F]).order('name').limit(300);
  if(r.error)throw r.error;return r.data||[];
}
async function load(){
  var t=cur();A.msg='';
  try{
    if(t.k==='users'){A.rows=await people();}
    else if(t.k==='attendance'){
      var s=await db.from('subjects').select('code,name').eq('field',F).order('code');if(s.error)throw s.error;
      A.subs=s.data||[];if(!A.sub||!A.subs.some(function(x){return x.code===A.sub;}))A.sub=A.subs.length?A.subs[0].code:null;
      A.stu=(await people()).filter(function(p){return !p.is_admin;});A.att={};
      if(A.sub){var a=await db.from('attendance').select('user_id,attended,total').eq('subject_code',A.sub);if(a.error)throw a.error;(a.data||[]).forEach(function(x){A.att[x.user_id]=x;});}
    }else{
      var r=await db.from(t.k).select('*').eq('field',F).order(t.ord[0],{ascending:!!t.ord[1]}).limit(300);
      if(r.error)throw r.error;A.rows=r.data||[];await names();
      if(t.k==='hive_announcements'){var ex=await db.from('hive_announcements').select('expires_at').limit(1);A.expirySupported=!ex.error;}
      if(t.k==='clubs'){A.clubCounts={};var cc=await db.rpc('club_counts');if(!cc.error)(cc.data||[]).forEach(function(x){A.clubCounts[x.club_id]=Number(x.n)||0;});}
    }
  }catch(e){A.rows=[];A.msg=(e&&e.message)||String(e);}
  paint();
}

/* ---------- screens ---------- */
function paint(){
  var t=cur(),pills='<div class="hpills">'+T.map(function(x){return '<button class="hpill'+(x.k===A.tab?' on':'')+'" onclick="ADM.tab(\''+x.k+'\')">'+x.ic+' '+x.t+'</button>';}).join('')+'</div>';
  var body=t.k==='users'?vPeople():t.k==='attendance'?vAtt():vGen(t);
  $('phone').innerHTML=top()+'<div class="screen"><div class="adm"><div class="hh1">'+t.ic+' '+t.t+' <span class="hsub">· '+LBL+'</span></div>'+pills+(A.msg?'<div class="hnote">'+esc(A.msg)+'</div>':'')+body+'</div></div>';
}
function vPeople(){
  return '<div class="hcard"><b>Give an existing account access to '+LBL+'</b><div class="hsub">Enter their username. They will then be able to choose '+LBL+' when signing in.</div><div class="hrow" style="border:0"><input class="input" id="gUser" placeholder="username" autocapitalize="off" style="flex:1;margin:0"><button class="hbtn" onclick="ADM.grant()">Add</button></div></div>'+
  '<div class="hsub" style="margin:10px 0">'+A.rows.length+' account'+(A.rows.length===1?'':'s')+' in '+LBL+'. Creating new accounts and blocking are done in the legacy admin tool.</div>'+
  (A.rows.map(function(p,i){return '<div class="hrow"><div style="flex:1"><b>'+esc(p.name||'—')+'</b>'+(p.is_admin?' <span class="tag">admin</span>':'')+'<div class="hsub">'+esc(un(p))+(p.roll_no?' · '+esc(p.roll_no):'')+' · '+esc((p.fields||[]).join(', '))+'</div></div>'+(p.id!==A.me.id?'<button class="hbtn" onclick="ADM.rm('+i+')">Remove from '+LBL+'</button>':'')+'</div>';}).join('')||'<div class="hsub">No accounts yet.</div>');
}
function vAtt(){
  if(!A.subs.length)return '<div class="hsub">Add subjects first (Subjects tab).</div>';
  return '<div class="label">Subject</div><select class="input" onchange="ADM.attSub(this.value)">'+A.subs.map(function(s){return '<option value="'+esc(s.code)+'"'+(s.code===A.sub?' selected':'')+'>'+esc(s.code)+' · '+esc(s.name)+'</option>';}).join('')+'</select>'+
  '<div class="hsub" style="margin:10px 0">Classes attended and total classes held so far. Leave both empty to skip a student.</div>'+
  (A.stu.map(function(p,i){var a=A.att[p.id]||{};return '<div class="attrow"><div><b>'+esc(p.name||'—')+'</b><div class="hsub">'+esc(p.roll_no||un(p))+'</div></div><input class="input" type="number" min="0" id="aa'+i+'" placeholder="attended" value="'+(a.attended==null?'':a.attended)+'"><input class="input" type="number" min="0" id="at'+i+'" placeholder="total" value="'+(a.total==null?'':a.total)+'"></div>';}).join('')||'<div class="hsub">No students in '+LBL+' yet.</div>')+
  (A.stu.length?'<button class="btn btn-primary" style="margin-top:14px" onclick="ADM.attSave()">Save attendance</button>':'');
}
function toLocalInput(v){if(!v)return '';var d=new Date(v);if(isNaN(d.getTime()))return '';d=new Date(d.getTime()-d.getTimezoneOffset()*60000);return d.toISOString().slice(0,16);}
function fld(c,v){
  var id='f_'+c[0],ty=c[2];
  if(ty==='bool')return '<label class="hrow" style="border:0"><input type="checkbox" id="'+id+'"'+(v?' checked':'')+'> '+esc(c[1])+'</label>';
  var h='<div class="label">'+esc(c[1])+'</div>';
  if(Array.isArray(ty)){var o=ty.slice();if(v&&o.indexOf(v)<0)o.unshift(v);return h+'<select class="input" id="'+id+'">'+o.map(function(x){return '<option'+(x===v?' selected':'')+'>'+esc(x)+'</option>';}).join('')+'</select>';}
  if(ty==='area')return h+'<textarea class="input" rows="3" id="'+id+'">'+esc(v)+'</textarea>';
  var val=ty==='datetime-local'?toLocalInput(v):ty==='time'&&v?String(v).slice(0,5):v;return h+'<input class="input" id="'+id+'" type="'+(ty==='num'?'number':ty)+'" value="'+esc(val)+'">';
}
function vGen(t){
  var h='';
  if(!t.noAdd&&!t.ro)h+='<button class="btn btn-primary" onclick="ADM.add()">+ Add</button>';
  if(t.k==='hive_announcements'&&!A.expirySupported)h+='<div class="hnote field-hint">Expiry controls need the optional hive_announcement_expiry_optional.sql migration. No database changes have been run.</div>';
  if(t.k==='clubs')h+='<div class="hcard clubs-admin-overview"><b>Club membership overview</b><p class="hsub">Counts and member names come from existing membership records only. No sample members are shown.</p></div>';
  if(A.edit){var row=A.edit.row||{};h+='<div class="hcard" style="margin-top:12px"><b>'+(A.edit.i==null?'Add':'Edit')+'</b>'+t.cols.map(function(c){return fld(c,row[c[0]]);}).join('')+'<div class="two" style="margin-top:14px"><button class="btn" onclick="ADM.cancel()">Cancel</button><button class="btn btn-primary" onclick="ADM.save()">Save</button></div></div>';}
  h+=A.rows.map(function(r,i){
    return '<div class="hcard"><div class="hmeta">'+(r.user_id?'<b>'+esc(A.names[r.user_id]||'Student')+'</b>':'<span></span>')+'</div>'+
    t.list.map(function(k){return '<div class="hsub"><b>'+esc(k.replace(/_/g,' '))+':</b> '+esc(fmt(k,r[k]))+'</div>';}).join('')+
    (t.k==='clubs'?'<div class="hsub club-count"><b>'+(A.clubCounts&&Object.prototype.hasOwnProperty.call(A.clubCounts,r.id)?A.clubCounts[r.id]:'—')+'</b> registered member(s)</div><button class="hbtn" onclick="ADM.clubMembers('+i+')">View members</button>'+(A.clubMembersClub===r.id?clubMembersView():''):'')+
    ((t.ro)?'':'<div style="margin-top:8px;display:flex;gap:8px"><button class="hbtn" onclick="ADM.edit('+i+')">Edit</button>'+(t.noDel?'':'<button class="hbtn" style="color:var(--lost)" onclick="ADM.del('+i+')">Delete</button>')+'</div>')+'</div>';}).join('')||'<div class="hsub" style="padding:14px 2px">Nothing here yet.</div>';
  return h;
}

/* ---------- actions ---------- */
async function done(r,ok){if(r.error){toast(r.error.message);return false;}toast(ok||'Saved');return true;}
async function save(){
  var t=cur(),e=A.edit,row={},pk=t.pk||'id';
  t.cols.forEach(function(c){var el=$('f_'+c[0]),v=c[2]==='bool'?el.checked:el.value.trim();
    if(c[2]==='num')v=v===''?null:Number(v);else if((c[2]==='date'||c[2]==='time'||c[2]==='datetime-local')&&v==='')v=null;
    if(c[0]==='expires_at'&&v){if(!A.expirySupported){row[c[0]]=undefined;return;}var dx=new Date(v);v=isNaN(dx.getTime())?null:dx.toISOString();}
    row[c[0]]=v;});
  Object.keys(row).forEach(function(k){if(row[k]===undefined)delete row[k];});
  if(t.k==='hive_announcements'&&$('f_expires_at')&&$('f_expires_at').value&&!A.expirySupported){toast('Run the optional hive_announcement_expiry_optional.sql migration before saving an expiry date.');return;}
  if(t.k==='hive_announcements'&&row.expires_at&&new Date(row.expires_at).getTime()<=Date.now()){toast('Expiry must be in the future');return;}
  var r=e.i==null?await db.from(t.k).insert(Object.assign({field:F},t.def||{},row)):await db.from(t.k).update(row).eq(pk,A.rows[e.i][pk]);
  if(await done(r)){A.edit=null;load();}
}
async function del(i){
  var t=cur(),pk=t.pk||'id';if(!confirm('Delete this entry permanently?'))return;
  if(await done(await db.from(t.k).delete().eq(pk,A.rows[i][pk]),'Deleted'))load();
}
async function prof(action,user,email){
  var r=await db.rpc('adm_profile',{p_field:F,p_action:action,p_user:user||null,p_email:email||null});
  if(await done(r,action==='grant'?'Access added':'Access removed'))load();
}
async function attSave(){
  var rows=[],bad=0,now=new Date().toISOString();
  A.stu.forEach(function(p,i){var a=$('aa'+i).value,t=$('at'+i).value;if(a===''&&t==='')return;a=+a;t=+t;if(!(t>=a)||a<0)bad++;else rows.push({user_id:p.id,subject_code:A.sub,attended:a,total:t,updated_at:now});});
  if(bad){toast(bad+' row(s) invalid: total must be at least attended');return;}
  if(!rows.length){toast('Nothing to save');return;}
  if(await done(await db.from('attendance').upsert(rows,{onConflict:'user_id,subject_code'}),'Attendance saved'))load();
}

function clubMembersView(){
  if(A.clubMembersError)return '<div class="hnote">'+esc(A.clubMembersError)+'</div>';
  if(!A.clubMembersClub)return '';
  return '<div class="club-admin-members"><b>Registered members</b>'+((A.clubMembers||[]).map(function(m){return '<div class="hrow"><div><b>'+esc(m.name||'Name not available')+'</b><div class="hsub">'+esc(m.roll_no||m.email||'Profile details restricted')+'</div></div></div>';}).join('')||'<div class="hsub">No member records were returned for this club.</div>')+'</div>';
}
async function clubMembers(i){
  var c=A.rows[i];if(!c)return;A.clubMembersClub=c.id;A.clubMembers=[];A.clubMembersError='Loading registered members…';paint();
  var m=await db.from('club_members').select('user_id').eq('club_id',c.id);
  if(m.error){A.clubMembersError='Member records could not be read with this account’s current permissions. No names have been fabricated.';paint();return;}
  var ids=(m.data||[]).map(function(x){return x.user_id;}).filter(Boolean);
  if(!ids.length){A.clubMembersError='';A.clubMembers=[];paint();return;}
  var p=await db.from('profiles').select('id,name,email,roll_no').in('id',ids);
  if(p.error){A.clubMembersError='Membership count is available, but profile details are restricted by database permissions.';paint();return;}
  var by={};(p.data||[]).forEach(function(x){by[x.id]=x;});A.clubMembers=ids.map(function(id){return by[id];}).filter(Boolean);A.clubMembersError='';paint();
}
window.ADM={signin:signin,out:out,
  tab:function(k){A.tab=k;A.edit=null;load();},
  add:function(){A.edit={i:null,row:Object.assign({},cur().def)};paint();},
  edit:function(i){A.edit={i:i,row:A.rows[i]};paint();},
  cancel:function(){A.edit=null;paint();},save:save,del:del,attSave:attSave,
  attSub:function(c){A.sub=c;load();},clubMembers:clubMembers,
  grant:function(){var u=($('gUser').value||'').trim().toLowerCase();if(!u){toast('Enter a username');return;}prof('grant',null,u.indexOf('@')<0?u+'@hive.local':u);},
  rm:function(i){var p=A.rows[i];if(confirm('Remove '+(p.name||'this account')+' from '+LBL+'? Their other fields are not affected.'))prof('remove',p.id,null);}
};
(async function(){try{var s=await db.auth.getSession();if(s.data&&s.data.session){await enter(s.data.session.user);return;}}catch(e){}login();})();
})();
