/* HIVE v3 layer — loads after hive2.js. Adds Clubs, SDGs, Gallery, Talents, Podcast under the News tab + animated welcome tour. */
(function(){'use strict';
var $=function(i){return document.getElementById(i);};
function ld(k,d){try{var v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}}
function sv(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
function br(s){return esc(s).replace(/\n/g,'<br>');}
function dt(t){return new Date(t).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});}
function expiresAt(t){return new Date(t).toLocaleString('en-IN',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});}
function lum(h){var n=parseInt(h.slice(1),16);return (0.299*(n>>16)+0.587*((n>>8)&255)+0.114*(n&255))/255;}
function https(u){return typeof u==='string'&&/^https:\/\/\S+$/i.test(u)?u:'';}

var SDG=[
['No Poverty','#FCE7EB','End poverty in all its forms, everywhere — through decent jobs, social protection and fair access to resources.','Back a campus drive that supports families in need.'],
['Zero Hunger','#FFF1D6','End hunger, improve nutrition and promote sustainable farming so everyone has enough to eat.','Cut food waste in the mess and share surplus food.'],
['Good Health and Well-being','#E6F4E4','Healthy lives and well-being for people of all ages, including mental health and access to care.','Join a health camp and check in on your friends.'],
['Quality Education','#FBE6E8','Inclusive and equitable education, with lifelong learning opportunities for everyone.','Tutor a junior or share your notes.'],
['Gender Equality','#FFE9E2','Equal rights and opportunities for women and girls, and an end to discrimination and violence.','Speak up against bias and support inclusive events.'],
['Clean Water and Sanitation','#DFF5FC','Safe drinking water and proper sanitation for all, with water managed sustainably.','Report leaking taps and avoid wasting water.'],
['Affordable and Clean Energy','#FFF5D6','Reliable, affordable and modern energy for everyone, with a bigger share from renewable sources.','Switch off lights and fans when you leave a room.'],
['Decent Work and Economic Growth','#F6E5EF','Lasting, inclusive economic growth and safe, fairly paid work for all.','Build skills and internships that lead to good work.'],
['Industry, Innovation and Infrastructure','#FFEBDD','Resilient infrastructure, inclusive industry and more innovation.','Turn a campus problem into a project.'],
['Reduced Inequalities','#F9E3EF','Reduce inequality within and between countries and include everyone, whatever their background.','Make clubs and events welcoming to all.'],
['Sustainable Cities and Communities','#FFF0DC','Cities and communities that are inclusive, safe, resilient and sustainable.','Share transport and keep the campus clean.'],
['Responsible Consumption and Production','#F5EBD7','Do more with less: cut waste and use resources responsibly.','Reuse, recycle and avoid single-use plastic.'],
['Climate Action','#E4F2E5','Take urgent action to combat climate change and its impacts.','Plant trees and shrink your carbon footprint.'],
['Life Below Water','#E0F2FC','Conserve and sustainably use oceans, seas and marine resources.','Keep plastic out of drains and water bodies.'],
['Life on Land','#EAF5DF','Protect forests, restore land and halt the loss of biodiversity.','Join tree plantation and protect campus wildlife.'],
['Peace, Justice and Strong Institutions','#E1EDF8','Peaceful, inclusive societies with access to justice and accountable institutions.','Resolve conflicts respectfully and know your rights.'],
['Partnerships for the Goals','#E5E9F8','Strengthen global partnerships and share knowledge, technology and resources.','Collaborate across clubs, departments and colleges.']];
var TAL=['Singing','Dancing','Music','Art & Design','Writing & Poetry','Photography','Tech & Projects','Sports','Comedy','Other'];
var SEC=[['news','News'],['clubs','Clubs'],['sdg','SDGs'],['gallery','Gallery'],['talents','Talents'],['podcast','Podcast']];
function secIcon(id){var p={news:'<path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"',clubs:'<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3.5 19c.5-3.2 2.4-5 5.5-5s5 1.8 5.5 5M15 14.5c2.8-.1 4.6 1.4 5.2 4.5"',sdg:'<circle cx="12" cy="12" r="9"/><path d="M3.5 12h17M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"',gallery:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4 17 5-5 4 4 3-3 4 4"',talents:'<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"',podcast:'<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"'}[id]||'<circle cx="12" cy="12" r="8"/>';return '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>';}

var H={uid:null,sec:'news',ok:false,err:false,clubs:[],mem:[],cnt:{},cnews:[],posts:[],eps:[],co:null,sdg:null,gf:'all',tf:'all',po:null,compose:null,f:{},blob:null,prev:null,sending:false};
var T={open:false,i:0,dir:1};

/* ---------- data ---------- */
async function loadC(){
  var u=S.user&&S.user.id;if(!u)return;
  try{
    var r=await Promise.all([
      supabase.from('clubs').select('*').order('name'),
      supabase.from('club_members').select('club_id').eq('user_id',u),
      supabase.rpc('club_counts'),
      supabase.from('community_posts').select('*').order('created_at',{ascending:false}).limit(80),
      supabase.from('podcast_episodes').select('*').order('published_at',{ascending:false}).limit(30)]);
    H.err=r.some(function(x){return x.error;});
    H.clubs=r[0].data||[];H.mem=(r[1].data||[]).map(function(x){return x.club_id;});H.cnt={};
    (r[2].data||[]).forEach(function(x){H.cnt[x.club_id]=Number(x.n);});H.posts=r[3].data||[];H.eps=r[4].data||[];
    if(H.clubs.length){var n=await supabase.from('hive_announcements').select('*').in('category',H.clubs.map(function(c){return c.name;})).order('created_at',{ascending:false}).limit(40);H.cnews=(n.data||[]).filter(function(a){return !a.expires_at||new Date(a.expires_at).getTime()>Date.now();});}
  }catch(e){H.err=true;}
  H.ok=true;redraw();
}
function redraw(){var a=document.activeElement;if(S.view==='ann'&&H.sec!=='news'&&!H.compose&&!(a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName)))render();}
function msg(e){var m=(e&&e.message)||String(e);
  if(/community_posts|club|podcast|schema cache|does not exist/i.test(m))return 'Not set up yet — ask the admin to run hive3.sql.';
  if(/row-level security|not allowed|unauthorized/i.test(m))return 'You are not allowed to do that.';
  if(/bucket not found/i.test(m))return 'Photo storage is not set up — ask the admin to run setup_photos.sql.';
  return 'Could not complete: '+m;}

/* ---------- section bar ---------- */
function pills(){
  var tabs=SEC.map(function(s){return '<button type="button" role="tab" aria-label="'+s[1]+'" aria-selected="'+(H.sec===s[0])+'" class="hpill hive-explore-tab'+(H.sec===s[0]?' on':'')+'" onclick="HIVE3.sec(\''+s[0]+'\')"><span class="hive-tab-icon">'+secIcon(s[0])+'</span><span class="hive-tab-label">'+s[1]+'</span></button>';}).join('');
  var ai='<button type="button" role="tab" aria-label="Open HIVE AI" aria-selected="false" data-hive-ai-toggle class="hpill hive-ai-toggle" onclick="HIVEAI.open()"><span class="hive-tab-icon"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="4"/><path d="M9 2.5V5M15 2.5V5M9 19v2.5M15 19v2.5M2.5 9H5M2.5 15H5M19 9h2.5M19 15h2.5M9 10h.01M15 10h.01M9 14h6"/></svg></span><span class="hive-tab-label hive-ai-label">HIVE AI</span></button>';
  return '<div class="hpills secbar" role="tablist" aria-label="Explore categories">'+tabs+ai+'</div>';
}
function note(){return H.err?'<div class="hnote">Some community data could not load. Check your connection, or ask the admin to run <b>hive3.sql</b>.</div>':'';}
function empty(t){return '<div class="hsub" style="padding:18px 4px">'+(H.ok?t:'Loading…')+'</div>';}

/* ---------- clubs ---------- */
function vClubs(){
  return '<div class="hh1">Clubs</div><div class="hsub" style="margin-bottom:12px">Join the clubs you love. Club news appears here and in News.</div>'+note()+
  (H.clubs.map(function(c){var m=H.mem.indexOf(c.id)>=0,o=H.co===c.id,nw=H.cnews.filter(function(a){return a.category===c.name;});
    return '<div class="hcard club'+(m?' joined':'')+'"><div class="hhead" data-i="'+c.id+'" onclick="HIVE3.club(+this.dataset.i)"><span class="hico">'+esc(c.emoji)+'</span><div style="flex:1"><b>'+esc(c.name)+'</b><div class="hsub">'+(H.cnt[c.id]||0)+' member'+((H.cnt[c.id]||0)===1?'':'s')+(nw.length?' · '+nw.length+' news':'')+'</div></div><span class="hsub">'+(o?'▲':'▼')+'</span></div>'+
    (o?'<div class="hsub body" style="margin:8px 0">'+br(c.description)+'</div>'+(nw.length?'<div class="label">Club news</div>'+nw.slice(0,5).map(function(a){return '<div class="hrow col"><b>'+esc(a.title)+'</b><div class="hsub">'+dt(a.created_at)+'</div>'+(a.expires_at?'<div class="hsub expiry-label">Available until '+esc(expiresAt(a.expires_at))+'</div>':'')+'<div class="hsub body">'+br(a.body)+'</div></div>';}).join(''):'<div class="hsub">No club news yet.</div>'):'')+
    '<button class="btn '+(m?'':'btn-primary')+'" style="margin-top:10px" data-i="'+c.id+'" data-j="'+(m?1:0)+'" onclick="HIVE3.join(+this.dataset.i,this.dataset.j==\'1\')">'+(m?'✓ Joined — tap to leave':'Join club')+'</button></div>';}).join('')||empty('No clubs yet.'));
}
async function join(id,leave){
  var x=leave?await supabase.from('club_members').delete().eq('club_id',id).eq('user_id',S.user.id):await supabase.from('club_members').insert({club_id:id,user_id:S.user.id});
  if(x.error&&x.error.code!=='23505'){toast(msg(x.error));return;}
  if(leave){H.mem=H.mem.filter(function(k){return k!==id;});H.cnt[id]=Math.max(0,(H.cnt[id]||1)-1);toast('You left the club');}
  else{if(H.mem.indexOf(id)<0){H.mem.push(id);H.cnt[id]=(H.cnt[id]||0)+1;}toast('Welcome to the club 🎉');}
  render();
}

/* ---------- SDGs ---------- */
function vSdg(){
  var g=H.sdg;
  if(!g)return '<div class="hh1">Sustainable Development Goals</div><div class="hsub" style="margin-bottom:12px">In 2015 all United Nations member states adopted 17 goals as a shared plan for people and the planet by 2030. Tap a goal to see what it means and what you can do on campus.</div>'+
    '<div class="sdggrid">'+SDG.map(function(s,i){var dk=lum(s[1])>0.62;return '<button class="sdgtile" style="background:'+s[1]+';color:'+(dk?'#10131a':'#fff')+';--i:'+i+'" data-n="'+(i+1)+'" onclick="HIVE3.goal(+this.dataset.n)" aria-label="Goal '+(i+1)+': '+esc(s[0])+'"><b>'+(i+1)+'</b><span>'+esc(s[0])+'</span></button>';}).join('')+'</div>';
  var s=SDG[g-1],rel=H.posts.filter(function(p){return p.sdg===g;}),dk=lum(s[1])>0.62;
  return '<button class="hpill" onclick="HIVE3.goal(null)">← All goals</button><div class="sdghead" style="background:'+s[1]+';color:'+(dk?'#10131a':'#fff')+'"><b>Goal '+g+'</b><h2>'+esc(s[0])+'</h2></div><div class="hcard"><div class="hsub body">'+esc(s[2])+'</div><div class="label">What you can do on campus</div><div class="body">'+esc(s[3])+'</div></div>'+
    '<button class="btn btn-primary" style="margin:6px 0 12px" onclick="HIVE3.compose(\'moment\','+g+')">📸 Post about this goal</button><div class="hh2">Campus posts for this goal</div>'+
    (rel.map(function(p){return '<div class="hrow col"><div class="hmeta"><b>'+esc(p.title)+'</b><span class="tag k-'+p.kind+'">'+KL[p.kind]+'</span></div><div class="hsub">'+esc(p.author_name)+' · '+dt(p.created_at)+'</div></div>';}).join('')||empty('No posts for this goal yet — be the first.'));
}

/* ---------- gallery + talents ---------- */
var KL={problem:'Problem',moment:'Moment',talent:'Talent'};
function card(p){
  var mine=S.user&&p.user_id===S.user.id,open=H.po===p.id,img=safePhotoUrl(p.photo_url),lk=https(p.link),sd=p.sdg?SDG[p.sdg-1]:null;
  return '<article class="hcard post">'+(img?'<img class="pimg" loading="lazy" decoding="async" src="'+esc(img)+'" alt="'+esc(p.title)+'">':'')+
  '<div class="hmeta" style="margin-top:8px"><span class="tag k-'+p.kind+'">'+KL[p.kind]+'</span>'+(p.kind==='talent'&&p.category?'<span class="tag">'+esc(p.category)+'</span>':'')+(sd?'<span class="tag" style="background:'+sd[1]+';color:'+(lum(sd[1])>0.62?'#10131a':'#fff')+'">SDG '+p.sdg+'</span>':'')+
  (p.kind==='problem'?'<span class="tag st-'+(p.status==='resolved'?'approved':'pending')+'">'+(p.status==='resolved'?'Resolved':'Reported')+'</span>':'')+(p.status==='hidden'?'<span class="tag st-denied">Hidden by admin</span>':'')+'</div>'+
  '<b class="ptitle">'+esc(p.title)+'</b><div class="hsub">'+esc(p.author_name)+' · '+dt(p.created_at)+'</div>'+
  '<div class="hsub body'+(open?'':' clamp')+'">'+br(p.description)+'</div>'+(p.description.length>150?'<button class="hbtn" data-i="'+p.id+'" onclick="HIVE3.more(+this.dataset.i)">'+(open?'Show less':'Read more')+'</button> ':'')+
  (lk?'<a class="hbtn" href="'+esc(lk)+'" target="_blank" rel="noopener noreferrer">'+(p.kind==='talent'?'▶ Watch / listen':'Open link')+' ↗</a> ':'')+
  (p.admin_note?'<div class="anote">Admin: '+br(p.admin_note)+'</div>':'')+
  (mine?'<button class="hbtn" style="color:var(--lost)" data-i="'+p.id+'" onclick="HIVE3.del(+this.dataset.i)">Delete</button>':'')+'</article>';
}
function prevHTML(){return H.prev?'<img class="pimg" src="'+H.prev+'" alt="Selected photo preview"><button class="hbtn" onclick="HIVE3.nophoto()">Remove photo</button>':'';}
function composer(){
  var k=H.compose,f=H.f,L={moment:'Share a moment',problem:'Report a problem',talent:'Showcase your talent'}[k];
  return '<div class="hcard composer"><b>'+L+'</b>'+
  '<div class="label">Title</div><input class="input" maxlength="120" value="'+esc(f.title||'')+'" oninput="HIVE3.f(\'title\',this.value)" placeholder="'+(k==='problem'?'e.g. Broken tap near Block B':k==='talent'?'e.g. My original song':'e.g. Sunrise from the library roof')+'">'+
  (k==='talent'?'<div class="label">Category</div><select class="input" onchange="HIVE3.f(\'cat\',this.value)">'+TAL.map(function(c){return '<option'+((f.cat||'Other')===c?' selected':'')+'>'+esc(c)+'</option>';}).join('')+'</select>':
   '<div class="label">Related SDG (optional)</div><select class="input" onchange="HIVE3.f(\'sdg\',this.value)"><option value="">None</option>'+SDG.map(function(s,i){return '<option value="'+(i+1)+'"'+(String(f.sdg)===String(i+1)?' selected':'')+'>'+(i+1)+' · '+esc(s[0])+'</option>';}).join('')+'</select>')+
  '<div class="label">Detailed description</div><textarea class="input" rows="5" maxlength="2000" oninput="HIVE3.f(\'desc\',this.value)" placeholder="'+(k==='problem'?'What is the problem, where is it, since when, and who is affected?':'Tell the story — what, where, when and why it matters.')+'">'+esc(f.desc||'')+'</textarea>'+
  (k==='talent'?'<div class="label">Video / audio link (optional, https)</div><input class="input" maxlength="300" value="'+esc(f.link||'')+'" oninput="HIVE3.f(\'link\',this.value)" placeholder="https://…">':'')+
  '<div class="label">Photo'+(k==='moment'?' (required)':' (optional)')+'</div><input type="file" id="cpFile" accept="image/*" hidden onchange="HIVE3.pick(this)"><button class="hbtn" onclick="document.getElementById(\'cpFile\').click()">📷 Choose photo</button><div id="cpPrev">'+prevHTML()+'</div>'+
  '<div class="two" style="margin-top:14px"><button class="btn" onclick="HIVE3.cancel()">Cancel</button><button class="btn btn-primary" id="cpSend" onclick="HIVE3.send()">Post</button></div></div>';
}
function vGallery(){
  var L=H.posts.filter(function(p){return p.kind!=='talent'&&(H.gf==='all'||p.kind===H.gf);});
  return '<div class="hh1">Gallery</div><div class="hsub" style="margin-bottom:10px">Share campus moments, or report a problem with photos and a detailed description.</div>'+note()+
  (H.compose&&H.compose!=='talent'?composer():'<div class="two"><button class="btn btn-primary" onclick="HIVE3.compose(\'moment\')">📸 Share a moment</button><button class="btn" onclick="HIVE3.compose(\'problem\')">⚠️ Report a problem</button></div>')+
  '<div class="hpills">'+[['all','All'],['moment','Moments'],['problem','Problems']].map(function(x){return '<button class="hpill'+(H.gf===x[0]?' on':'')+'" onclick="HIVE3.gf(\''+x[0]+'\')">'+x[1]+'</button>';}).join('')+'</div>'+
  (L.map(card).join('')||empty('Nothing here yet — post the first one.'));
}
function vTalents(){
  var L=H.posts.filter(function(p){return p.kind==='talent'&&(H.tf==='all'||p.category===H.tf);});
  return '<div class="hh1">Talents</div><div class="hsub" style="margin-bottom:10px">Singers, dancers, artists, coders, writers — show the campus what you can do.</div>'+note()+
  (H.compose==='talent'?composer():'<button class="btn btn-primary" onclick="HIVE3.compose(\'talent\')">🌟 Showcase my talent</button>')+
  '<div class="hpills">'+['all'].concat(TAL).map(function(c){return '<button class="hpill'+(H.tf===c?' on':'')+'" data-c="'+esc(c)+'" onclick="HIVE3.tf(this.dataset.c)">'+(c==='all'?'All':esc(c))+'</button>';}).join('')+'</div>'+
  (L.map(card).join('')||empty('No talents showcased yet.'));
}

/* ---------- podcast ---------- */
function vPodcast(){
  return '<div class="hh1">College Podcast</div><div class="hsub" style="margin-bottom:12px">Conversations, stories and ideas from our campus.</div>'+note()+
  (H.eps.map(function(e,i){var u=https(e.media_url),au=/\.(mp3|m4a|aac|wav|ogg|oga)(\?|#|$)/i.test(u);
    return '<div class="hcard ep'+(i===0?' latest':'')+'">'+(i===0?'<span class="tag now">Latest episode</span>':'')+'<b class="ptitle">🎙️ '+esc(e.title)+'</b><div class="hsub">'+dt(e.published_at)+(e.guest?' · with '+esc(e.guest):'')+'</div>'+(e.description?'<div class="hsub body">'+br(e.description)+'</div>':'')+
    (u?(au?'<audio controls preload="none" src="'+esc(u)+'" style="width:100%;margin-top:10px"></audio>':'<a class="btn btn-primary" style="display:block;text-align:center;text-decoration:none;margin-top:10px" href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">▶ Listen ↗</a>'):'')+'</div>';}).join('')||empty('No episodes yet — the first one is coming soon.'));
}

/* ---------- screen ---------- */
var base=HIVE.screens.ann,TT={clubs:'Clubs',sdg:'SDGs',gallery:'Gallery',talents:'Talents',podcast:'Podcast'},V={clubs:vClubs,sdg:vSdg,gallery:vGallery,talents:vTalents,podcast:vPodcast};
HIVE.screens.ann=function(){
  if(H.sec==='news'||!V[H.sec])return base();
  return HIVE2.top(TT[H.sec])+pills()+'<div class="screen newsscreen">'+V[H.sec]()+'</div>'+HIVE2.bar();
};

/* ---------- actions ---------- */
function clearForm(){if(H.prev)try{URL.revokeObjectURL(H.prev);}catch(e){}H.prev=null;H.blob=null;H.f={};H.compose=null;}
async function send(){
  if(H.sending)return;
  var k=H.compose,f=H.f,t=(f.title||'').trim(),d=(f.desc||'').trim(),l=(f.link||'').trim();
  if(t.length<3){toast('Add a title (at least 3 characters)');return;}
  if(d.length<10){toast('Add a detailed description (at least 10 characters)');return;}
  if(k==='moment'&&!H.blob){toast('Add a photo for your moment');return;}
  if(l&&!https(l)){toast('Links must start with https://');return;}
  if(!navigator.onLine){toast('You are offline — reconnect to post');return;}
  H.sending=true;var b=$('cpSend');if(b){b.disabled=true;b.textContent='Posting…';}
  var bucket=window.PHOTO_BUCKET||'item-photos',up=null;
  try{
    if(H.blob){var path=S.user.id+'/c'+Date.now()+'_'+Math.random().toString(36).slice(2,8)+'.jpg';
      var r=await supabase.storage.from(bucket).upload(path,H.blob,{contentType:'image/jpeg',cacheControl:'31536000',upsert:false});if(r.error)throw r.error;
      up={path:path,url:supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl};}
    var x=await supabase.from('community_posts').insert({user_id:S.user.id,kind:k,title:t,description:d,category:k==='talent'?(f.cat||'Other'):null,sdg:f.sdg?+f.sdg:null,link:l||null,photo_url:up?up.url:null,photo_path:up?up.path:null});
    if(x.error)throw x.error;
    clearForm();H.sending=false;toast('Posted ✓');await loadC();render();
  }catch(e){
    if(up)try{await supabase.storage.from(bucket).remove([up.path]);}catch(_){}
    H.sending=false;toast(msg(e));if(b){b.disabled=false;b.textContent='Post';}
  }
}
async function del(id){
  var p=H.posts.filter(function(x){return x.id===id;})[0];if(!p||!confirm('Delete this post? This cannot be undone.'))return;
  var x=await supabase.from('community_posts').delete().eq('id',id).eq('user_id',S.user.id);if(x.error){toast(msg(x.error));return;}
  if(p.photo_path)try{await supabase.storage.from(window.PHOTO_BUCKET||'item-photos').remove([p.photo_path]);}catch(e){}
  H.posts=H.posts.filter(function(q){return q.id!==id;});toast('Deleted');render();
}
window.HIVE3={pills:pills,
  sec:function(k){if(H.sec===k)return;clearForm();H.sec=k;H.sdg=null;H.po=null;render();},
  club:function(i){H.co=H.co===i?null:i;render();},join:join,
  goal:function(n){H.sdg=n;render();},
  compose:function(k,sdg){clearForm();H.compose=k;H.f=sdg?{sdg:String(sdg)}:{};if(k==='talent')H.sec='talents';else H.sec='gallery';H.sdg=null;render();},
  f:function(n,v){H.f[n]=v;},
  cancel:function(){clearForm();render();},
  pick:async function(inp){var file=inp.files&&inp.files[0];if(!file)return;
    try{var bl=await compressImage(file);if(H.prev)try{URL.revokeObjectURL(H.prev);}catch(e){}H.blob=bl;H.prev=URL.createObjectURL(bl);var p=$('cpPrev');if(p)p.innerHTML=prevHTML();}catch(e){toast((e&&e.message)||'Could not read that photo');}
    inp.value='';},
  nophoto:function(){if(H.prev)try{URL.revokeObjectURL(H.prev);}catch(e){}H.prev=null;H.blob=null;var p=$('cpPrev');if(p)p.innerHTML='';},
  send:send,del:del,more:function(i){H.po=H.po===i?null:i;render();},
  gf:function(v){H.gf=v;render();},tf:function(v){H.tf=v;render();},
  tour:function(){openTour(true);},tn:tn,tourEnd:tourEnd};

/* ---------- animated welcome tour ---------- */
function tiles(a){return '<div class="tgrid">'+a.map(function(x,j){return '<div class="ttile" style="--i:'+j+'"><span aria-hidden="true">'+x[0]+'</span><b>'+x[1]+'</b><small>'+x[2]+'</small></div>';}).join('')+'</div>';}
var TS=[
 function(){var n=((S.profile&&S.profile.name)||'').split(' ')[0];return '<img class="tlogo" src="hive_mark.png" width="643" height="615" alt="HIVE emblem"><h2>Welcome'+(n?', '+esc(n):'')+'!</h2><p>Your college community, all in one secure place. Take a quick tour of what HIVE can do for you.</p>';},
 function(){return '<div class="thex" aria-hidden="true"><i></i><i></i><i></i></div><h2>What is HIVE?</h2><p>HIVE brings everyday campus life together: your attendance, leave, mess, fees and study material; news, clubs and the college podcast; a gallery and talent stage for students; chat; and Lost &amp; Found — all connected to your college admin, who manages the app for you.</p>';},
 function(){return '<h2>Everyday services</h2>'+tiles([['📊','Attendance','Subject-wise % with how many classes to attend or skip'],['🗓️','Timetable & calendar','Today’s classes and upcoming dates'],['🗒️','Leave','Apply, ask permission or inform the admin'],['🍽️','Mess','Book meals in one tap, with a log'],['💳','Fees','Pay by UPI, verified by admin'],['📚','Study','Your 6 subjects with syllabus']]);},
 function(){return '<h2>Campus community</h2>'+tiles([['📰','News','New and important updates appear in Notifications'],['🎯','Clubs','Singing, dancing, debating, robotics, AI and more'],['🌍','SDG goals','The UN’s 17 goals and what you can do'],['🖼️','Gallery','Share moments or report problems with photos'],['🌟','Talents','Showcase what you can do'],['🎙️','Podcast','Listen to the college podcast']]);},
 function(){return '<h2>Chat &amp; Lost &amp; Found</h2>'+tiles([['💬','Community chat','Talk to your campus in real time'],['🔎','Lost &amp; Found','Report or find items — the last tab'],['🔔','Notifications','Leave, payment and post updates']]);},
 function(){return '<h2>HIVE AI</h2>'+tiles([['✨','Ask in plain words','Ask HIVE AI anything about your campus life'],['📊','Attendance','See at-risk subjects and how many classes to attend or skip'],['📰','News catch-up','Summaries of announcements and what needs your action'],['🗓️','This week','Classes, exams, fee deadlines and events coming up'],['📚','Study help','Revise a subject, then take a quick quiz'],['🔒','Private','Reads only your own HIVE data — never passwords or chat messages']])+'<p style="margin:14px 0 0;font-size:13px">Find it on your Home screen or in your Profile.</p>';},
 function(){return '<h2>Eco Points</h2>'+tiles([['🌿','Eco activities','Plant a tree, pick up trash, recycle or save water'],['📷','Upload proof','Add a photo or video with the date and place'],['🛡️','Get verified','A verifier approves or rejects your proof'],['🏆','Earn &amp; level up','Collect points and badges, from Eco Starter to Eco Leader'],['📈','Leaderboard','See the top eco students in your college'],['📜','Certificates','Download digital eco certificates for your activities']])+'<p style="margin:14px 0 0;font-size:13px">Find it in the Eco Points tab or on your Home screen.</p>';},
 function(){return '<div class="tshield" aria-hidden="true">🔒</div><h2>Safe &amp; secure</h2><p>Your account is created by the admin, and you choose your own password. Passwords are stored encrypted, and your attendance, leave and payments are visible only to you and the admin.</p><p><b>You are all set — enjoy HIVE!</b></p>';}
];
function tourHTML(){
  var i=T.i,last=i===TS.length-1;
  return '<div class="tour-in" role="dialog" aria-modal="true" aria-label="Welcome to HIVE"><button class="tskip" onclick="HIVE3.tourEnd()">'+(last?'Close':'Skip')+'</button><div class="tslide '+(T.dir<0?'back':'')+'" aria-live="polite">'+TS[i]()+'</div>'+
  '<div class="tdots" aria-hidden="true">'+TS.map(function(_,j){return '<i class="'+(j===i?'on':'')+'"></i>';}).join('')+'</div><div class="tnav">'+(i>0?'<button class="btn" onclick="HIVE3.tn(-1)">Back</button>':'<span></span>')+'<button class="btn btn-primary" id="tNext" onclick="HIVE3.tn(1)">'+(last?'Get started':'Next')+'</button></div></div>';
}
function paint(){var t=$('tour');if(!t)return;t.innerHTML=tourHTML();var n=$('tNext');if(n)n.focus({preventScroll:true});}
function openTour(){
  if($('tour'))return;T.open=true;T.i=0;T.dir=1;var d=document.createElement('div');d.id='tour';d.className='tour';document.body.appendChild(d);paint();
  var x0=null;d.addEventListener('touchstart',function(e){x0=e.touches[0].clientX;},{passive:true});
  d.addEventListener('touchend',function(e){if(x0===null)return;var dx=e.changedTouches[0].clientX-x0;x0=null;if(Math.abs(dx)>60)tn(dx<0?1:-1);},{passive:true});
}
function tn(d){if(!T.open)return;var n=T.i+d;if(n>=TS.length){tourEnd();return;}if(n<0)return;T.dir=d;T.i=n;paint();}
function tourEnd(){T.open=false;var t=$('tour');if(t)t.remove();if(S.user)sv('hive_tour_'+S.user.id,true);}
document.addEventListener('keydown',function(e){if(!T.open)return;if(e.key==='ArrowRight')tn(1);else if(e.key==='ArrowLeft')tn(-1);else if(e.key==='Escape')tourEnd();});

/* ---------- hook into the shell ---------- */
var oa=HIVE.after;
HIVE.after=function(){
  oa();
  if(!S.user){if(H.uid){H.uid=null;H.sec='news';clearForm();}if(T.open){T.open=false;var t=$('tour');if(t)t.remove();}return;}
  if(H.uid!==S.user.id){H.uid=S.user.id;H.ok=false;H.sec='news';loadC();}
  /* The tour is intentionally not shown automatically; users can open it from Profile when they are ready. */
};
/* If the app already painted its first screen before these scripts finished loading (slow network), repaint so every override applies. */
var ph=$('phone');if(ph&&ph.firstChild&&(!S.user||S.profile))render();
setInterval(function(){if(S.user&&!document.hidden&&S.view==='ann'&&H.sec!=='news'&&!H.compose)loadC();},60000);
})();
