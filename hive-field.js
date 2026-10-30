/* HIVE fields — pick a field BEFORE signing in. Loads AFTER hive-ai.js.
   ONE database, ONE app, two workspaces. profiles.fields lists the fields an account may open; every shared table has a
   `field` column and this file scopes every read/write to the field you are in (the database enforces it too). */
(function(){'use strict';
var FIELDS={
  education:{label:'Education',emoji:'🎓',sub:'Attendance, news, clubs, services and Lost & Found for campus life.',cls:''},
  medical:{label:'Medical',emoji:'🩺',sub:'The same features for medical colleges, with their own subjects, postings, news and clubs.',cls:' med'}
};
var F={chosen:null,last:null};
try{F.last=localStorage.getItem('hive_field');}catch(e){}
function fOf(){return (S.profile&&FIELDS[S.profile.field]?S.profile.field:'education');}
/* every field this account may open: profiles.fields (array), else the single legacy profiles.field, else education */
function allowed(){var p=S.profile||{},a=Array.isArray(p.fields)&&p.fields.length?p.fields:[p.field||'education'];return a.filter(function(k){return FIELDS[k];});}
function resolve(){var al=allowed(),pf=fOf();return al.indexOf(F.last)>=0?F.last:(al.indexOf(pf)>=0?pf:al[0]);}
function cur(){return F.chosen||resolve();}
function store(k){F.last=k;try{localStorage.setItem('hive_field',k);}catch(e){}}

window.HIVEFIELD={
  FIELDS:FIELDS,allowed:allowed,current:cur,
  pick:function(k){if(!FIELDS[k])return;F.chosen=k;S.authMsg='';store(k);render();setTimeout(function(){var u=document.getElementById('lgEmail');if(u)u.focus();},60);},
  back:function(){F.chosen=null;S.authMsg='';render();},
  /* switching reloads the app so every screen starts clean in the other field */
  switchTo:function(k){if(!FIELDS[k]||allowed().indexOf(k)<0||!S.user)return;store(k);location.reload();}
};

/* ---- scope all shared data to the current field (reads add field=…, inserts stamp field) ---- */
var SC=['subjects','timetable','calendar_events','hive_announcements','hive_messages','clubs','community_posts','podcast_episodes','items','leave_requests','meal_bookings','payments'];
var rawFrom=supabase.from.bind(supabase);
supabase.from=function(t){
  var q=rawFrom(t);if(SC.indexOf(t)<0)return q;
  var sel=q.select.bind(q),ins=q.insert.bind(q);
  q.select=function(){return sel.apply(null,arguments).eq('field',cur());};
  q.insert=function(r,o){var f=cur(),add=function(x){return x&&typeof x==='object'&&x.field==null?Object.assign({field:f},x):x;};return ins(Array.isArray(r)?r.map(add):add(r),o);};
  return q;
};

function picker(){
  return '<div class="login-hero"><div class="login-hero-inner"><div class="hv-logo login-brand-assembly" role="img" aria-label="HIVE — your community, truly intelligent"><img class="login-brand-mark" src="hive_mark.svg" width="336" height="368" alt="" decoding="async"><div class="login-brand-wordmark">HIVE</div><div class="login-brand-tagline">YOUR COMMUNITY, TRULY INTELLIGENT</div></div>'+
  '<div class="login-form-card fpick">'+(S.authMsg?'<div class="login-msg">'+esc(S.authMsg)+'</div>':'')+
  '<h2>Choose your field</h2><div class="hsub">Pick where you belong, then sign in with your username and password.</div>'+
  Object.keys(FIELDS).map(function(k){var f=FIELDS[k];
    return '<button type="button" class="fcard'+f.cls+'" onclick="HIVEFIELD.pick(\''+k+'\')"><span class="fe">'+f.emoji+'</span><span><b>'+f.label+'</b><small>'+f.sub+'</small></span>'+(F.last===k?'<span class="last">Last used</span>':'')+'</button>';}).join('')+
  '<div class="login-footer-note">🔒 Accounts are issued by your administrator.<br><a class="adminlink" href="admin.html">Admin panels →</a></div></div></div></div>';
}

var baseLogin=window.screenLogin;
window.screenLogin=function(){
  if(!F.chosen)return picker();
  var f=FIELDS[F.chosen],html=baseLogin?baseLogin():'';
  var chip='<div class="fchip"><span>'+f.emoji+'</span><b>'+f.label+' sign-in</b><button type="button" onclick="HIVEFIELD.back()">Change field</button></div>';
  var m='<div class="login-field"><label>Username';
  return html.indexOf(m)>=0?html.replace(m,chip+m):html;
};

var baseOut=window.doLogout;
window.doLogout=function(){F.chosen=null;document.documentElement.removeAttribute('data-field');return baseOut.apply(this,arguments);};

/* Profile → Account tab: a "Switch to …" row for every other field this account can open */
var bp=HIVE.screens.hprofile;
if(bp)HIVE.screens.hprofile=function(){
  var h=bp(),k='<div class="prow" onclick="doLogout()"',c=cur();
  var rows=allowed().filter(function(x){return x!==c;}).map(function(x){return '<div class="prow" onclick="HIVEFIELD.switchTo(\''+x+'\')">'+FIELDS[x].emoji+' Switch to '+FIELDS[x].label+' <span>›</span></div>';}).join('');
  return rows&&h.indexOf(k)>=0?h.replace(k,rows+k):h;
};

/* after every render: enforce field access and theme the app for the current field */
var oa=HIVE.after;
HIVE.after=function(){
  if(S.user&&S.profile){
    var al=allowed();
    if(F.chosen&&al.indexOf(F.chosen)<0){
      var ok=al.map(function(k){return FIELDS[k].label;}).join(' or ');
      S.authMsg='This account does not have access to the '+FIELDS[F.chosen].label+' field. Choose '+ok+' to sign in.';
      doLogout();return;
    }
    if(!F.chosen)F.chosen=resolve();
    document.documentElement.setAttribute('data-field',F.chosen);
  }
  oa();
};
})();
