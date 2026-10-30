/* HIVE UX layer. Keeps existing feature/database logic intact and provides a unified home + navigation. */
(function(){'use strict';
var $=function(s){return document.querySelector(s);};
var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});};
var oldAfter=window.HIVE&&HIVE.after;
function svg(d){return '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+d+'</svg>'; }
function themeIcon(t){return svg(t==='dark'?'<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>':'<path d="M20 15a8 8 0 0 1-11-11 8 8 0 1 0 11 11Z"/>');}
function soundIcon(){return svg(window.S&&S.soundEnabled===false?'<path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9 5 6m0-6-5 6"/>':'<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15 9a4 4 0 0 1 0 6M17.5 6.5a7.5 7.5 0 0 1 0 11"/>');}
function playUiSound(kind){
  try{
    var state=window.S;
    if(state&&state.soundEnabled===false)return;
    var AudioCtor=window.AudioContext||window.webkitAudioContext;
    if(!AudioCtor)return;
    var ctx=state&&state.audioCtx;
    if(!ctx){ctx=new AudioCtor();if(state)state.audioCtx=ctx;}
    var notes=kind==='launch'?[{f:523.25,d:0,l:.17},{f:659.25,d:.09,l:.18},{f:783.99,d:.18,l:.25}]:kind==='tap'?[{f:680,d:0,l:.09}]:[{f:587.33,d:0,l:.09},{f:783.99,d:.055,l:.12}];
    function envelope(freq,at,dur,volume,wave,pan,partial){
      var osc=ctx.createOscillator(),gain=ctx.createGain(),st=at;
      osc.type=wave||'sine';osc.frequency.setValueAtTime(freq,st);
      gain.gain.setValueAtTime(.0001,st);
      gain.gain.exponentialRampToValueAtTime(Math.max(.001,volume),st+.022);
      gain.gain.exponentialRampToValueAtTime(.0001,st+dur);
      if(typeof ctx.createStereoPanner==='function'&&typeof pan==='number'){
        var panner=ctx.createStereoPanner();panner.pan.setValueAtTime(pan,st);gain.connect(panner);panner.connect(ctx.destination);
      }else gain.connect(ctx.destination);
      osc.connect(gain);osc.start(st);osc.stop(st+dur+.025);
      if(partial){
        var upper=ctx.createOscillator(),ug=ctx.createGain();upper.type='sine';upper.frequency.setValueAtTime(freq*partial,st);
        ug.gain.setValueAtTime(.0001,st);ug.gain.exponentialRampToValueAtTime(Math.max(.0007,volume*.25),st+.018);ug.gain.exponentialRampToValueAtTime(.0001,st+Math.min(dur,.18));
        upper.connect(ug);ug.connect(ctx.destination);upper.start(st);upper.stop(st+Math.min(dur,.18)+.02);
      }
    }
    function schedule(){
      var base=ctx.currentTime;
      if(kind==='assemble'){
        /* Warm, quiet rising bed while the logo shards travel. */
        var bed=ctx.createOscillator(),bg=ctx.createGain();bed.type='sine';bed.frequency.setValueAtTime(146.83,base);bed.frequency.exponentialRampToValueAtTime(220,base+1.18);
        bg.gain.setValueAtTime(.0001,base);bg.gain.exponentialRampToValueAtTime(.010,base+.18);bg.gain.setValueAtTime(.008,base+.85);bg.gain.exponentialRampToValueAtTime(.0001,base+1.52);bed.connect(bg);bg.connect(ctx.destination);bed.start(base);bed.stop(base+1.56);
        /* A restrained ascending crystal sequence tracks the fragments approaching. */
        var approach=[293.66,369.99,440,493.88,587.33,659.25,739.99];
        approach.forEach(function(f,i){envelope(f,base+.12+i*.115,.19,.008,'sine',-.55+i*.17,2);});
        /* Nine delicate collisions coincide with the nine tiles settling into their grid. */
        var landing=[392,440,493.88,587.33,659.25,739.99,880,987.77,1174.66];
        landing.forEach(function(f,i){envelope(f,base+1.00+i*.035,.21,.0085,'sine',-.7+i*.175,2);});
        /* A clean harmonic signature after the final shard has seated. */
        [{f:587.33,d:1.79,v:.015},{f:739.99,d:1.815,v:.012},{f:880,d:1.84,v:.012},{f:1174.66,d:1.87,v:.007}].forEach(function(n){envelope(n.f,base+n.d,.48,n.v,'sine',0,2);});
        return;
      }
      notes.forEach(function(n){envelope(n.f,base+n.d,n.l,kind==='launch'?.025:.018,kind==='launch'?'sine':'triangle',0,kind==='launch'?null:2);});
    }
    if(ctx.state==='suspended'){ctx.resume().then(schedule).catch(function(){});}else schedule();
  }catch(e){}
}
function toggleSounds(){if(typeof window.toggleSound==='function')window.toggleSound();else{if(!window.S)return;S.soundEnabled=!S.soundEnabled;try{localStorage.setItem('hive_sound_enabled',S.soundEnabled?'1':'0');}catch(e){}if(S.soundEnabled)playUiSound('tap');}document.querySelectorAll('.ux-sound').forEach(function(b){b.innerHTML=soundIcon();b.setAttribute('aria-label',S.soundEnabled?'Turn interface sounds off':'Turn interface sounds on');});}
var BRAND_MARK='<svg class="ux-home-hex" viewBox="0 0 24 24" width="31" height="31" aria-label="HIVE yellow hexagon logo" role="img"><polygon points="12,2 21,7 21,17 12,22 3,17 3,7" fill="#FBC02D"/><circle cx="12" cy="12" r="3" fill="#0b1220"/></svg>';

var I={home:svg('<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),services:svg('<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>'),explore:svg('<path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h6"/><path d="m15 17 2 2 4-4"/>'),lost:svg('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>'),eco:svg('<path d="M20 4C10 4 4 8 4 15a5 5 0 0 0 5 5c7 0 11-6 11-16Z"/><path d="M4 20c3-5 7-8 12-11"/>'),chat:svg('<path d="M4 5h16v12H9l-5 4z"/><path d="M8 9h8M8 13h5"/>'),profile:svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4-7 8-7s7 2.5 8 7"/>'),ai:svg('<path d="M12 3.2 14.3 8l5.2.8-3.8 3.7.9 5.2-4.6-2.5-4.6 2.5.9-5.2-3.8-3.7L9.7 8Z"/><path d="M19 2v4M17 4h4M4 17v4M2 19h4"')};
function goEco(){playUiSound('navigate');try{sessionStorage.setItem('hive_eco_handoff','1');sessionStorage.setItem('hive_eco_return_view','hivehome');}catch(e){}document.documentElement.classList.add('hive-transitioning-out');setTimeout(function(){window.location.href='eco-loading.html';},260);}
function route(key){var map={home:'hivehome',services:'acc',explore:'ann',lost:'home',chat:'chat',profile:'hprofile'};if(key==='eco'){goEco();return;}if(key==='care'){try{playUiSound('navigate');}catch(e){}window.location.href='carebridge.html';return;}if(key==='ai'){if(window.HIVEAI&&typeof HIVEAI.open==='function')HIVEAI.open();return;}if(map[key])nav(map[key],true);}
function navBar(){var cur=(window.S&&S.view)||'hivehome';var active=cur==='hivehome'?'home':(['acc','services'].indexOf(cur)>=0?'services':(['ann','clubs','sdg','gallery','talents','podcast'].indexOf(cur)>=0?'explore':(['home','browse','details','report','stats'].indexOf(cur)>=0?'lost':cur==='chat'?'chat':'profile')));var tabs=[['home','Home'],['services','Services'],['explore','Explore'],['lost','Lost & Found'],['eco','Eco Points'],['chat','Chat']];return '<nav class="nav nav-main ux-nav" aria-label="Main navigation">'+tabs.map(function(t){return '<button type="button" class="navbtn '+(active===t[0]?'active ':'')+(t[0]==='eco'?'eco-tab':'')+'" onclick="HIVEUX.go(\''+t[0]+'\')">'+I[t[0]]+'<span>'+t[1]+(t[0]==='eco'?'<i class="eco-dot"></i>':'')+'</span></button>';}).join('')+'</nav>';}
function userName(){var p=window.S&&S.profile||{};return p.name||p.full_name||(S.user&&S.user.email?S.user.email.split('@')[0]:'there');}
function moduleCard(icon,title,desc,key,cls){return '<button type="button" class="ux-module '+(cls||'')+'" onclick="HIVEUX.go(\''+key+'\')"><span class="ux-arrow">↗</span><span class="ux-module-icon">'+icon+'</span><b>'+title+'</b><p>'+desc+'</p></button>';}
function row(icon,title,desc,key){return '<div class="ux-link-row" role="button" tabindex="0" onclick="HIVEUX.go(\''+key+'\')" onkeydown="if(event.key===\'Enter\')HIVEUX.go(\''+key+'\')"><span class="ux-row-icon">'+icon+'</span><span class="ux-row-copy"><b>'+title+'</b><small>'+desc+'</small></span><span class="ux-chevron">›</span></div>';}
function home(){
  var n=esc(userName());
  var field=document.documentElement.getAttribute('data-field')==='medical'?'Medical':'Education';
  var greet=new Date().getHours()<12?'Good morning':new Date().getHours()<17?'Good afternoon':'Good evening';
  return '<div class="top"><div class="brand">'+BRAND_MARK+'<span>HIVE <small style="font:700 10px var(--font);color:var(--muted);letter-spacing:.05em;margin-left:5px">'+field.toUpperCase()+'</small></span></div>'+ 
    '<div class="ux-top-tools"><button class="ux-theme" type="button" onclick="HIVEUX.toggleTheme()" aria-label="Toggle light and dark mode">'+themeIcon(document.documentElement.getAttribute('data-theme'))+'</button><button class="ux-theme ux-sound" type="button" onclick="HIVEUX.toggleSounds()" aria-label="'+(window.S&&S.soundEnabled===false?'Turn interface sounds on':'Turn interface sounds off')+'">'+soundIcon()+'</button>'+
    '<button class="bell" type="button" onclick="nav(\'notifications\',true)" aria-label="Notifications">'+(window.icon?icon('icBell',18):'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>')+(S.notifications&&S.notifications.length?'<span class="dot"></span>':'')+'</button>'+
    '<button class="ux-theme ux-profile-shortcut" type="button" onclick="nav(\'hprofile\',true)" aria-label="Profile">'+I.profile+'</button></div></div>'+
    '<div class="screen"><main class="ux-dashboard">'+
    '<section class="hcard ux-welcome"><div><div class="ux-eyebrow"><i class="ux-live"></i> YOUR COMMUNITY, CONNECTED</div><h1>'+greet+', '+n+'.<br>Welcome to HIVE.</h1><p>One thoughtful place for campus services, announcements, community conversations and the things that make everyday life easier.</p><div class="ux-cta-row"><button class="ux-cta" onclick="HIVEUX.go(\'services\')">Explore services <span>↗</span></button></div></div>'+
    '<div class="ux-hero-art" aria-hidden="true"><div class="ux-orbit"><div class="ux-orbit-core">H</div><span class="ux-orbit-node n1">✦</span><span class="ux-orbit-node n2">⌂</span><span class="ux-orbit-node n3">↗</span></div></div></section>'+
    '<div class="ux-section-head"><div><h2>Made for your everyday</h2><p>Jump straight into what you need.</p></div></div>'+
    '<section class="ux-module-grid">'+
      moduleCard(I.ai,'HIVE AI','Get help with your HIVE information and campus services.','ai','ai-feature')+
      moduleCard(I.services,'Campus services','Requests, bookings and student essentials.','services')+
      moduleCard(I.explore,'News & community','Announcements, clubs, gallery, talents and SDGs.','explore')+
      moduleCard(I.lost,'Lost & Found','Report an item or help reunite it with its owner.','lost')+
      moduleCard(I.chat,'Community chat','Share updates and connect with your community.','chat')+
      moduleCard(I.eco,'Eco Points','Take part in environmental activities and track your impact.','eco','eco')+
      (field==='Medical'?moduleCard(svg('<path d="M12 21s-7-4.4-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.6-9 9-9 9z"/>'),'Care Bridge','Medical care, appointments and hospital support.','care'):'')+
    '</section><section class="ux-bottom-grid"><div class="hcard ux-panel"><div class="ux-panel-title"><span class="ux-mini-icon">✦</span>Quick actions</div>'+row(I.lost,'Report lost or found','Post an item for the community.','lost')+row(I.services,'Open campus services','Start a request or check your services.','services')+row(I.explore,'Browse announcements','See the latest community updates.','explore')+'</div>'+
    '<div class="hcard ux-panel"><div class="ux-panel-title"><span class="ux-mini-icon">♧</span>A more connected campus</div><p style="font-size:12px;line-height:1.75;color:var(--muted);margin:0">HIVE brings useful campus tools into one calm, organised experience. Choose a feature below and get back to what matters.</p></div></section></main></div>'+navBar();
}
function applyNav(){if(!window.HIVE||!window.HIVE2)return;HIVE.nav=navBar;HIVE2.bar=navBar;HIVE.screens.hivehome=home;}
function themeSet(t){document.documentElement.setAttribute('data-theme',t);try{localStorage.setItem('hive_theme',t);}catch(e){}var meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=t==='dark'?'#141B27':'#DDEEFF';document.querySelectorAll('.ux-theme').forEach(function(b){if(!b.classList.contains('ux-profile-shortcut')&&!b.classList.contains('ux-sound'))b.innerHTML=themeIcon(t);});}
function toggleTheme(){themeSet(document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark');}
function injectTheme(){var top=$('.top');if(!top)return;var tools=top.querySelector('.ux-top-tools');if(tools){if(!tools.querySelector('.ux-theme'))tools.insertAdjacentHTML('afterbegin','<button class="ux-theme" type="button" onclick="HIVEUX.toggleTheme()" aria-label="Toggle light and dark mode">'+themeIcon(document.documentElement.getAttribute('data-theme'))+'</button>');if(!tools.querySelector('.ux-sound'))tools.insertAdjacentHTML('beforeend','<button class="ux-theme ux-sound" type="button" onclick="HIVEUX.toggleSounds()" aria-label="'+(window.S&&S.soundEnabled===false?'Turn interface sounds on':'Turn interface sounds off')+'">'+soundIcon()+'</button>');return;}if(top.querySelector('.ux-theme')){top.insertAdjacentHTML('beforeend','<button class="ux-theme ux-sound" type="button" onclick="HIVEUX.toggleSounds()" aria-label="'+(window.S&&S.soundEnabled===false?'Turn interface sounds on':'Turn interface sounds off')+'">'+soundIcon()+'</button>');return;}var oldBell=top.querySelector('.bell');tools=document.createElement('div');tools.className='ux-top-tools';tools.innerHTML='<button class="ux-theme" type="button" onclick="HIVEUX.toggleTheme()" aria-label="Toggle light and dark mode">'+themeIcon(document.documentElement.getAttribute('data-theme'))+'</button><button class="ux-theme ux-sound" type="button" onclick="HIVEUX.toggleSounds()" aria-label="'+(window.S&&S.soundEnabled===false?'Turn interface sounds on':'Turn interface sounds off')+'">'+soundIcon()+'</button>';if(oldBell){oldBell.parentNode.insertBefore(tools,oldBell);tools.appendChild(oldBell);}else top.appendChild(tools);}
var introTimer=null,introSoundPlayed=false;
/* Nine overlapping grid tiles cover the complete emblem. The 1% overlap prevents gaps
   between independently animated pieces while keeping every source pixel represented. */
var introShardShapes=[
  'polygon(-1% -1%,34% -1%,34% 34%,-1% 34%)',
  'polygon(33% -1%,67% -1%,67% 34%,33% 34%)',
  'polygon(66% -1%,101% -1%,101% 34%,66% 34%)',
  'polygon(-1% 33%,34% 33%,34% 67%,-1% 67%)',
  'polygon(33% 33%,67% 33%,67% 67%,33% 67%)',
  'polygon(66% 33%,101% 33%,101% 67%,66% 67%)',
  'polygon(-1% 66%,34% 66%,34% 101%,-1% 101%)',
  'polygon(33% 66%,67% 66%,67% 101%,33% 101%)',
  'polygon(66% 66%,101% 66%,101% 101%,66% 101%)'
];
var introParticleSpecs=[
  ['1%','18%','128px','52px','0ms'],['1%','49%','134px','-4px','70ms'],['2%','78%','120px','-56px','130ms'],
  ['99%','15%','-128px','57px','45ms'],['99%','47%','-139px','-2px','105ms'],['98%','82%','-122px','-58px','165ms'],
  ['24%','1%','66px','111px','85ms'],['73%','1%','-60px','112px','140ms'],['25%','99%','63px','-111px','120ms'],['77%','99%','-64px','-109px','190ms'],
  ['15%','31%','113px','44px','35ms'],['88%','68%','-110px','-47px','150ms']
];
function introShards(){return introShardShapes.map(function(shape,i){return '<i class="ux-intro-shard ux-shard-'+(i+1)+'" style="clip-path:'+shape+';--shard-delay:'+(i*.035)+'s"><img src="hive_mark.svg" alt="" width="336" height="368"></i>';}).join('');}
function introParticles(){return introParticleSpecs.map(function(p,i){return '<i class="ux-intro-particle ux-particle-'+(i+1)+'" style="left:'+p[0]+';top:'+p[1]+';--particle-dx:'+p[2]+';--particle-dy:'+p[3]+';--particle-delay:'+p[4]+'"></i>';}).join('');}
function dismissIntro(el){if(!el||!el.isConnected)return;el.classList.add('ux-intro-out');setTimeout(function(){if(el.parentNode)el.remove();},520);}
function startIntro(){
  var existing=document.getElementById('hive-intro');
  if(existing)existing.remove();
  clearTimeout(introTimer);introSoundPlayed=false;
  var el=document.createElement('div');el.id='hive-intro';el.classList.add('ux-intro-playing');el.setAttribute('role','status');el.setAttribute('aria-label','HIVE opening animation');
  el.classList.add('hl-screen');
  el.innerHTML='<div class="hl-bg" aria-hidden="true"></div><div class="hl-honey" aria-hidden="true"></div><div class="hl-softglow" aria-hidden="true"></div><i class="hl-particle hl-p1" aria-hidden="true"></i><i class="hl-particle hl-p2" aria-hidden="true"></i><i class="hl-particle hl-p3" aria-hidden="true"></i><i class="hl-particle hl-p4" aria-hidden="true"></i><div class="hl-content"><div class="hl-zone" aria-hidden="true"><div class="hl-halo"></div><div class="hl-halo"></div><img class="hl-logo" src="hive_mark.png" alt="" width="643" height="615"><div class="hl-wordmark">HIVE</div></div><div class="hl-status">Your space is getting ready</div><div class="hl-line" aria-hidden="true"><i></i></div><div class="hl-dots" aria-hidden="true"><i></i><i></i><i></i></div><div class="hl-beam" aria-hidden="true"></div></div>';
  document.body.appendChild(el);
  introTimer=setTimeout(function(){dismissIntro(el);},5200);
}
window.HIVEUIFX={play:playUiSound};
window.HIVEUX={go:route,toggleTheme:toggleTheme,toggleSounds:toggleSounds,themeSet:themeSet,nav:navBar,home:home};
/* v5 theme rollout: establish Bright mode once as the new default, even when an older build saved Dark. After this one-time upgrade, preserve the user's explicit theme choice. */
try{
  var brightDefaultApplied=localStorage.getItem('hive_theme_bright_default_v5');
  if(!brightDefaultApplied){
    localStorage.setItem('hive_theme','light');
    localStorage.setItem('hive_theme_bright_default_v5','1');
    themeSet('light');
  }else{
    var saved=localStorage.getItem('hive_theme');
    themeSet(saved==='dark'?'dark':'light');
  }
}catch(e){themeSet('light');}
applyNav();
var priorAfter=window.HIVE&&HIVE.after; if(window.HIVE)HIVE.after=function(){if(priorAfter)priorAfter();injectTheme();};
var lastRenderedView=null;
var routeOrder=['hivehome','acc','ann','clubs','sdg','gallery','talents','podcast','home','browse','details','report','stats','chat','hprofile','notifications'];
var priorRender=window.render;window.render=function(){
  var nextView=window.S&&S.view||'';var changed=lastRenderedView!==null&&nextView!==lastRenderedView;
  var direction='right';if(changed){var a=routeOrder.indexOf(lastRenderedView),b=routeOrder.indexOf(nextView);direction=(a>=0&&b>=0&&b<a)?'left':(a>=0&&b>=0&&b>a)?'right':(nextView==='hprofile'||nextView==='notifications')?'up':'down';}
  if(priorRender)priorRender();
  if(window.HIVE&&window.HIVE.screens){HIVE.screens.hivehome=home;HIVE.nav=navBar;}
  if(changed){playUiSound('navigate');var sc=document.querySelector('#phone .screen');if(sc){sc.classList.remove('ux-slide-in-left','ux-slide-in-right','ux-slide-in-up','ux-slide-in-down');void sc.offsetWidth;sc.classList.add('ux-slide-in-'+direction);setTimeout(function(){sc.classList.remove('ux-slide-in-'+direction);},520);}}
  lastRenderedView=nextView;injectTheme();
};
document.addEventListener('pointerdown',function(){if(typeof window.unlockAudio==='function')window.unlockAudio();var el=document.getElementById('hive-intro');if(!introSoundPlayed&&el){introSoundPlayed=true;if(!(window.S&&S.soundEnabled===false)){clearTimeout(introTimer);el.classList.remove('ux-intro-playing');void el.offsetWidth;el.classList.add('ux-intro-playing');playUiSound('assemble');introTimer=setTimeout(function(){dismissIntro(el);},4200);}}},{passive:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startIntro,{once:true});else startIntro();
/* Returning from Eco Points is a trusted same-tab hand-off, not a new login. Keep the session and land on Home. */
window.addEventListener('pageshow',function(ev){
  if(!ev.persisted)return;
  try{sessionStorage.removeItem('hive_eco_handoff');sessionStorage.removeItem('hive_eco_return_view');}catch(e){}
  document.documentElement.classList.remove('hive-transitioning-out');
  startIntro();
  Promise.resolve(window.supabase&&supabase.auth.getSession()).then(function(r){
    var user=r&&r.data&&r.data.session&&r.data.session.user;
    if(!user){if(window.doLogout)doLogout();return;}
    if(window.S&&S.user&&S.user.id===user.id){S.user=user;S.view='hivehome';S.history=[];render();}
    else if(window.enterApp)enterApp(user);
  }).catch(function(){});
});
})();
