/* HIVE interaction improvements. UI-only aggregation; existing Supabase tables and policies remain the source of truth. */
(function(){
  'use strict';
  var $ = function(sel, root){ return (root || document).querySelector(sel); };
  var esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var U = {items:[], loaded:false, loading:false, lastFetch:0, uid:null, filter:'all', unread:0};

  function svg(paths, size){
    return '<svg viewBox="0 0 24 24" width="'+(size||21)+'" height="'+(size||21)+'" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+paths+'</svg>';
  }
  var AI_ICON = '<svg class="hive-ai-header-svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="5.2" y="5.3" width="13.6" height="13.4" rx="4"/><path d="M9 2.8v2.5M15 2.8v2.5M9 18.7v2.5M15 18.7v2.5M2.8 9h2.4M2.8 15h2.4M18.8 9h2.4M18.8 15h2.4M9 10h.01M15 10h.01M9 14h6"/><path d="M18.5 2.5 19.3 4.7 21.5 5.5 19.3 6.3 18.5 8.5 17.7 6.3 15.5 5.5 17.7 4.7Z" stroke-width="1.25"/></svg>';
  function themeIcon(theme){
    return theme === 'dark'
      ? svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42')
      : svg('<path d="M20.5 15.3A8.5 8.5 0 0 1 8.7 3.5 8.5 8.5 0 1 0 20.5 15.3Z"/>');
  }
  function openAI(){ if(window.HIVEAI && typeof HIVEAI.open === 'function') HIVEAI.open(); }
  function markSeen(){
    var id=window.S&&S.user&&S.user.id;if(!id)return;
    try{localStorage.setItem('hive_notifications_seen_'+id,String(Date.now()));}catch(e){}
    U.unread=0;syncBellBadges();
  }
  function openNotifications(){
    markSeen();
    if(typeof window.nav==='function') window.nav('notifications',true);
  }
  function syncBellBadges(){
    var show=U.unread>0 && !(window.S&&S.view==='notifications');
    document.querySelectorAll('#phone .bell').forEach(function(bell){
      var dot=bell.querySelector('.dot');
      if(show&&!dot){dot=document.createElement('span');dot.className='dot';bell.appendChild(dot);}
      if(!show&&dot)dot.remove();
      bell.setAttribute('role','button');bell.setAttribute('tabindex','0');bell.setAttribute('aria-label',show?'Notifications — unread updates':'Notifications');
      bell.setAttribute('title','Notifications');
      bell.setAttribute('onclick','HIVEUX.openNotifications()');
      if(!bell.dataset.hiveKeys){
        bell.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();openNotifications();}});
        bell.dataset.hiveKeys='1';
      }
    });
  }
  function ensureHeaderControls(){
    var top=$('#phone .top');if(!top)return;
    var explore=!!(window.S&&S.view==='ann');
    var tools=$('.ux-top-tools',top);
    if(!tools){tools=document.createElement('div');tools.className='ux-top-tools';top.appendChild(tools);}
    var theme=tools.querySelector('.ux-theme:not(.ux-profile-shortcut)');
    if(!theme){
      theme=top.querySelector('.ux-theme:not(.ux-profile-shortcut)');
      if(theme)tools.appendChild(theme);
      else{
        theme=document.createElement('button');theme.type='button';theme.className='ux-theme';theme.setAttribute('aria-label','Toggle bright and dark mode');
        theme.innerHTML=themeIcon(document.documentElement.getAttribute('data-theme'));
        theme.addEventListener('click',function(){if(window.HIVEUX&&HIVEUX.toggleTheme)HIVEUX.toggleTheme();});
        tools.appendChild(theme);
      }
    }
    var bell=top.querySelector('.bell');if(bell&&!tools.contains(bell))tools.appendChild(bell);
    var profile=top.querySelector('.ux-profile-shortcut');if(profile&&!tools.contains(profile))tools.appendChild(profile);
    var ai=tools.querySelector('.ux-ai-launch');
    if(explore){if(ai)ai.remove();}
    else if(!ai){
      ai=document.createElement('button');ai.type='button';ai.className='ux-ai-launch';ai.innerHTML=AI_ICON;
      ai.setAttribute('aria-label','Open HIVE AI assistant');ai.setAttribute('title','HIVE AI');ai.addEventListener('click',openAI);
      tools.insertBefore(ai,theme||tools.firstChild);
    }else{ai.innerHTML=AI_ICON;tools.insertBefore(ai,theme||tools.firstChild);}
    if(!explore && window.S && S.user){
      var aiCard=$('.ai-entry',top);if(aiCard)aiCard.remove();
    }
  }
  function removeNewsPopup(){var d=document.getElementById('newsOv');if(d)d.remove();}
  function applyAuthPattern(){
    var u=window.S&&S.user;
    document.body.classList.toggle('hive-authenticated',!!u&&(!S.view||S.view!=='login'));
  }
  function readLS(key,fallback){try{var x=localStorage.getItem(key);return x===null?fallback:JSON.parse(x);}catch(e){return fallback;}}
  function writeLS(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch(e){}}
  function timestamp(value){var x=value?Date.parse(value):0;return Number.isFinite(x)?x:0;}
  function fmtTime(ts){if(!ts)return 'Just now';try{return new Date(ts).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'});}catch(e){return 'Recent update';}}
  function localDay(d){var x=d||new Date();return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');}
  function addDaysIso(days){var d=new Date();d.setDate(d.getDate()+days);return localDay(d);}
  function shortDate(v){if(!v)return 'Date not set';var d=new Date(String(v).slice(0,10)+'T00:00:00');if(Number.isNaN(d.getTime()))return String(v);return d.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:d.getFullYear()!==new Date().getFullYear()?'numeric':undefined});}
  function statusLabel(v){var s=String(v||'pending').replace(/[_-]+/g,' ').trim();return s.replace(/\b\w/g,function(c){return c.toUpperCase();});}
  function safeQuery(q){try{return Promise.resolve(q).then(function(r){return !r||r.error?[]:(Array.isArray(r.data)?r.data:[]);},function(){return [];});}catch(e){return Promise.resolve([]);}}
  function makeItem(o){
    var ts=typeof o.ts==='number'?o.ts:timestamp(o.ts);
    return {id:String(o.id||('item-'+ts+'-'+Math.random().toString(36).slice(2,6))),group:o.group||'system',icon:o.icon||'system',kicker:o.kicker||'Update',title:o.title||'HIVE update',message:o.message||'',ts:ts,time:fmtTime(ts),status:o.status||'',badge:o.badge!==false};
  }
  function iconFor(kind){
    var paths={
      news:'<path d="M4 4h16v16H4zM8 8h4v4H8zM15 8h2M15 12h2M8 16h9"/>',
      service:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4V2M16 4V2M7 10h10M7 14h6"/>',
      meal:'<path d="M4 3v7a3 3 0 0 0 6 0V3M7 3v18M17 3v18M17 3c-4 4-4 9 0 10"/>',
      payment:'<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
      schedule:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 14h3M8 17h2"/>',
      community:'<path d="M4 5h16v12H9l-5 3z"/><path d="M8 9h8M8 13h5"/>',
      lost:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
      system:'<path d="M12 3 14.2 8.8 20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2Z"/><path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9Z"/>'
    };
    return svg(paths[kind]||paths.system,22);
  }
  function appendLocalStatusAlerts(leaveRows,paymentRows,uid){
    var snapKey='hive_notify_status_snapshot_'+uid, eventKey='hive_notify_status_events_'+uid;
    var previous=readLS(snapKey,null), next={}, events=readLS(eventKey,[]);if(!Array.isArray(events))events=[];
    (leaveRows||[]).forEach(function(r){next['leave:'+r.id]={status:String(r.status||'pending'),type:'leave',id:r.id};});
    (paymentRows||[]).forEach(function(r){next['payment:'+r.id]={status:String(r.status||'initiated'),type:'payment',id:r.id};});
    if(previous&&typeof previous==='object'){
      Object.keys(next).forEach(function(key){
        var before=previous[key],after=next[key];
        if(!before||before.status===after.status)return;
        var isPayment=after.type==='payment';
        events.unshift(makeItem({id:'status-'+key+'-'+after.status,group:'services',icon:isPayment?'payment':'service',kicker:isPayment?'Payment status':'Service status',title:isPayment?'Payment status updated':'Leave request updated',message:isPayment?'Your payment for '+((paymentRows.find(function(x){return String(x.id)===String(after.id)} )||{}).item||'your request')+' changed from '+statusLabel(before.status)+' to '+statusLabel(after.status)+'.':'Your leave request status changed from '+statusLabel(before.status)+' to '+statusLabel(after.status)+'.',ts:Date.now(),status:statusLabel(after.status),badge:true}));
      });
    }
    // Keep a compact local event journal so status transitions can be shown even if the app was closed between checks.
    events=events.filter(function(e){return e&&e.ts&&Date.now()-e.ts<90*86400000;});
    var unique={};events=events.filter(function(e){var k=String(e.id);if(unique[k])return false;unique[k]=1;return true;}).slice(0,40);
    writeLS(snapKey,next);writeLS(eventKey,events);return events;
  }
  async function activeAnnouncements(){
    try{var r=await supabase.from('hive_announcements').select('id,title,body,category,priority,created_at,expires_at').order('created_at',{ascending:false}).limit(30);if(!r.error)return (r.data||[]).filter(function(a){return !a.expires_at||new Date(a.expires_at).getTime()>Date.now();});}catch(e){}
    try{var old=await supabase.from('hive_announcements').select('id,title,body,category,priority,created_at').order('created_at',{ascending:false}).limit(30);return old.error?[]:(old.data||[]);}catch(e){return [];}
  }
  async function loadFeed(force){
    var uid=window.S&&S.user&&S.user.id;
    if(!uid||!window.supabase)return;
    if(U.uid!==uid){U.uid=uid;U.items=[];U.loaded=false;U.lastFetch=0;}
    if(U.loading||(!force&&U.loaded&&Date.now()-U.lastFetch<35000))return;
    U.loading=true;U.lastFetch=Date.now();
    try{
      var today=localDay(),future=addDaysIso(21),past=addDaysIso(-14);
      var queries=await Promise.all([
        safeQuery(supabase.from('notifications').select('id,type,message,created_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(40)),
        activeAnnouncements(),
        safeQuery(supabase.from('meal_bookings').select('id,meal,meal_date,created_at').eq('user_id',uid).gte('meal_date',past).lte('meal_date',future).order('meal_date',{ascending:true}).limit(30)),
        safeQuery(supabase.from('leave_requests').select('id,kind,from_date,to_date,status,admin_note,student_reply,created_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(30)),
        safeQuery(supabase.from('payments').select('id,item,amount,status,created_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(30)),
        safeQuery(supabase.from('calendar_events').select('id,event_date,title,kind').gte('event_date',today).lte('event_date',future).order('event_date',{ascending:true}).limit(20)),
        safeQuery(supabase.from('community_posts').select('id,kind,title,description,created_at').order('created_at',{ascending:false}).limit(12)),
        safeQuery(supabase.from('items').select('id,name,type,status,created_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(12))
      ]);
      var rows={notifications:queries[0],announcements:queries[1],meals:queries[2],leaves:queries[3],payments:queries[4],events:queries[5],posts:queries[6],items:queries[7]};
      var feed=[];
      rows.notifications.forEach(function(r){feed.push(makeItem({id:'db-notif-'+r.id,group:'system',icon:r.type==='returned'||r.type==='found'||r.type==='match'?'lost':'system',kicker:'HIVE notification',title:statusLabel(r.type||'Update'),message:r.message,ts:r.created_at}));});
      rows.announcements.forEach(function(r){feed.push(makeItem({id:'announcement-'+r.id,group:'news',icon:'news',kicker:(r.priority==='urgent'?'Important news':(r.category||'Announcement')),title:r.title,message:r.body||'A new announcement has been published.',ts:r.created_at,status:r.priority&&r.priority!=='normal'?statusLabel(r.priority):''}));});
      rows.meals.forEach(function(r){var isPast=String(r.meal_date)<today;feed.push(makeItem({id:'meal-'+r.id,group:'services',icon:'meal',kicker:'Mess booking',title:(r.meal||'Meal')+' booking',message:(isPast?'Booking record: ':'Your ')+(r.meal||'Meal')+' is booked for '+shortDate(r.meal_date)+'.',ts:r.created_at||r.meal_date,status:'Booked'}));});
      rows.leaves.forEach(function(r){var status=statusLabel(r.status||'pending');feed.push(makeItem({id:'leave-'+r.id,group:'services',icon:'service',kicker:'Leave & service requests',title:'Leave request · '+status,message:'Dates: '+shortDate(r.from_date)+' – '+shortDate(r.to_date)+(r.admin_note?' · Admin note: '+r.admin_note:''),ts:r.created_at,status:status}));});
      rows.payments.forEach(function(r){var status=statusLabel(r.status||'initiated');feed.push(makeItem({id:'payment-'+r.id,group:'services',icon:'payment',kicker:'Fees & payments',title:'Payment · '+status,message:(r.item||'Payment request')+' · ₹'+Number(r.amount||0).toLocaleString('en-IN',{maximumFractionDigits:2})+' · Current status: '+status+'.',ts:r.created_at,status:status}));});
      rows.events.forEach(function(r){feed.push(makeItem({id:'event-'+r.id,group:'schedule',icon:'schedule',kicker:statusLabel(r.kind||'Campus event'),title:r.title,message:'Upcoming on '+shortDate(r.event_date)+'.',ts:String(r.event_date)+'T00:00:00',badge:false}));});
      rows.posts.forEach(function(r){feed.push(makeItem({id:'post-'+r.id,group:'community',icon:'community',kicker:'Community '+statusLabel(r.kind||'post'),title:r.title||'New community post',message:r.description||'A new post has been shared with your community.',ts:r.created_at}));});
      rows.items.forEach(function(r){feed.push(makeItem({id:'lostfound-'+r.id,group:'community',icon:'lost',kicker:'Lost & Found',title:statusLabel(r.type||'item')+' item · '+(r.name||'Item'),message:'Current status: '+statusLabel(r.status||'open')+'.',ts:r.created_at,status:statusLabel(r.status||'open')}));});
      var localEvents=appendLocalStatusAlerts(rows.leaves,rows.payments,uid);localEvents.forEach(function(e){feed.push(e);});
      var seenValue=null;try{var z=localStorage.getItem('hive_notifications_seen_'+uid);seenValue=z===null?null:Number(z);}catch(e){}
      // Sort newest first. Upcoming calendar dates remain in the feed but do not produce an unread dot by themselves.
      var dedupe={};U.items=feed.filter(function(it){if(dedupe[it.id])return false;dedupe[it.id]=1;return true;}).sort(function(a,b){return (b.ts||0)-(a.ts||0);});
      U.unread=U.items.filter(function(it){return it.badge&&(!Number.isFinite(seenValue)||seenValue===null||it.ts>seenValue);}).length;
      U.loaded=true;U.lastFetch=Date.now();
      if(window.S&&S.view==='notifications'){markSeen();}
      syncBellBadges();
      if(window.S&&S.view==='notifications'){
        // Refresh the visible notification list when new records/status updates arrive.
        if(!U.rendering){U.rendering=true;setTimeout(function(){U.rendering=false;if(window.S&&S.view==='notifications'&&typeof window.render==='function')window.render();},0);}
      }
    }catch(e){U.loaded=true;U.lastFetch=Date.now();syncBellBadges();}
    finally{U.loading=false;}
  }
  function filterNotifications(filter){U.filter=filter||'all';if(typeof window.render==='function')window.render();}
  function markNotificationsSeen(){markSeen();if(typeof window.render==='function'&&window.S&&S.view==='notifications')window.render();}
  function renderNotifications(){
    var filters=[['all','All updates'],['news','News'],['services','Services'],['schedule','Schedule'],['community','Community'],['system','Alerts']];
    var visible=U.items.filter(function(item){return U.filter==='all'||item.group===U.filter;});
    var content='';
    if(!U.loaded&&U.loading)content='<div class="hive-notif-loading">Gathering your latest HIVE updates…</div>';
    else if(!visible.length)content='<div class="hive-feed-empty">'+iconFor('system')+'<b>No updates in this view</b><p>When announcements, bookings or service updates arrive, they will appear here.</p></div>';
    else content=visible.map(function(item){
      var seen=null;try{var raw=localStorage.getItem('hive_notifications_seen_'+(S.user&&S.user.id));seen=raw===null?null:Number(raw);}catch(e){}
      var unread=item.badge&&(seen===null||!Number.isFinite(seen)||item.ts>seen);
      return '<article class="hive-feed-item'+(unread?' unread':'')+'"><div class="hive-feed-icon">'+iconFor(item.icon)+'</div><div class="hive-feed-copy"><div class="hive-feed-kicker">'+esc(item.kicker)+(unread?'<span class="hive-feed-status">New</span>':'')+'</div><h3>'+esc(item.title)+'</h3><p>'+esc(item.message)+'</p>'+(item.status?'<span class="hive-feed-status">'+esc(item.status)+'</span>':'')+'</div><time class="hive-feed-time" datetime="'+esc(item.ts?new Date(item.ts).toISOString():'')+'">'+esc(item.time)+'</time></article>';
    }).join('');
    var filterHtml=filters.map(function(f){return '<button type="button" class="hive-notif-filter'+(U.filter===f[0]?' active':'')+'" onclick="HIVEUX.filterNotifications(\''+f[0]+'\')">'+f[1]+'</button>';}).join('');
    return (window.HIVE2&&HIVE2.top?HIVE2.top('Notifications'):'<div class="top"><div class="brand">Notifications</div></div>')+
      '<div class="screen hive-notifications"><div class="hive-notifications-head"><div><h1>Notifications</h1><p>News, announcements, mess bookings, leave requests, fee updates and community activity in one place.</p></div><button type="button" class="hive-mark-read" onclick="HIVEUX.markNotificationsSeen()">Mark all as read</button></div><div class="hive-notif-filters" role="group" aria-label="Filter notifications">'+filterHtml+'</div><div class="hive-feed-list">'+content+'</div><div class="ux-disclaimer">Your HIVE activity is stored in the database and may be reviewed by authorised administrators.</div></div>'+(window.HIVEUX&&HIVEUX.nav?HIVEUX.nav():'');
  }
  function enhanceHome(){
    if(!window.HIVEUX||typeof HIVEUX.home!=='function'||HIVEUX.home.__teamEnhanced)return;
    var baseHome=HIVEUX.home;
    var decorated=function(){
      var html=baseHome();
      html=html.replace('<img src="hive_logo.png" alt="HIVE" style="width:31px;height:29px;object-fit:contain"/>','<img class="ux-brand-mark" src="hive_mark.png" alt="" width="30" height="30"/>');
      html=html.replace(/<button[^>]*class="ux-cta secondary"[^>]*>[\s\S]*?Find an item[\s\S]*?<\/button>/,'');
      html=html.replace('</main></div>','<footer class="ux-disclaimer"><b>Privacy &amp; data notice</b><br>Your activity and submissions are stored in HIVE’s database and may be reviewed by authorised administrators.</footer></main></div>');
      return html;
    };
    decorated.__teamEnhanced=true;HIVEUX.home=decorated;
    if(window.HIVE&&HIVE.screens)HIVE.screens.hivehome=decorated;
  }
  function ensureNotificationsScreen(){if(window.HIVE&&HIVE.screens)HIVE.screens.notifications=renderNotifications;}
  function cleanTourOverlay(){
    // Defensive cleanup if a stale cached script rendered either interruption.
    removeNewsPopup();
    if(window.S&&S.user){var tour=document.getElementById('tour');if(tour)tour.remove();}
  }
  function after(){
    applyAuthPattern();ensureHeaderControls();cleanTourOverlay();syncBellBadges();
    if(window.S&&S.user){loadFeed(false);}
  }
  // Patch the already loaded HIVE UX/router once, preserving all original route and theme behaviour.
  enhanceHome();ensureNotificationsScreen();
  if(window.HIVEUX){
    HIVEUX.openAI=openAI;HIVEUX.openNotifications=openNotifications;HIVEUX.filterNotifications=filterNotifications;HIVEUX.markNotificationsSeen=markNotificationsSeen;
  }
  // HIVE AI is part of the shared HIVE3 section bar, so its label and placement stay consistent across Explorer views.
  // The prior HIVE.after chain still refreshes original services, chat and authentication state first.
  if(window.HIVE){
    var priorAfter=HIVE.after;
    HIVE.after=function(){if(typeof priorAfter==='function')priorAfter();after();};
  }
  // The existing rendering wrapper has already been installed by hive-ux.js. Ensure the first render also gets enhancements.
  try{if(window.S&&S.user&&S.profile&&typeof window.render==='function')render();}catch(e){}
  document.addEventListener('visibilitychange',function(){if(!document.hidden&&window.S&&S.user)loadFeed(true);});
  window.addEventListener('focus',function(){if(window.S&&S.user)loadFeed(true);});
  window.setInterval(function(){if(!document.hidden&&window.S&&S.user)loadFeed(false);},35000);
})();
