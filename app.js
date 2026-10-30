/* ==========================================================
   LOST & FOUND — Full screen app  (Home page matches PDF)
   Updated: access_granted support, cleaner demo, SW-safe
   v4.0: visual identification, found-item snapshots and secure ownership verification
   ========================================================== */

var SUPABASE_URL = 'https://uhesiuyjbiwpwlulmaqw.supabase.co';
var SUPABASE_KEY = 'sb_publishable_T7oa-3syn79PiHlf63EKVg_KhNz5lMg';
var HIVE_AUTH_STORAGE_KEY = 'sb-uhesiuyjbiwpwlulmaqw-auth-token';
var HIVE_ECO_HANDOFF = false;
try { HIVE_ECO_HANDOFF = sessionStorage.getItem('hive_eco_handoff') === '1'; } catch (e) {}
/* A fresh entry asks for credentials. A same-tab return from Eco Points keeps the existing session. */
try {
  localStorage.removeItem(HIVE_AUTH_STORAGE_KEY); /* clear the legacy persistent token from older builds */
  if (!HIVE_ECO_HANDOFF) sessionStorage.removeItem(HIVE_AUTH_STORAGE_KEY);
  /* Consume the one-time hand-off immediately; the constant above keeps this load trusted. */
  sessionStorage.removeItem('hive_eco_handoff');
  sessionStorage.removeItem('hive_eco_return_view');
} catch (e) {}
var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    storage: window.sessionStorage,
    storageKey: HIVE_AUTH_STORAGE_KEY,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

var CATS = [
  {n:'Electronics', c:'#2563eb', i:'🎧'},
  {n:'Books',       c:'#7c3aed', i:'📓'},
  {n:'Bags',        c:'#f59e0b', i:'🎒'},
  {n:'ID Cards',    c:'#0891b2', i:'🪪'},
  {n:'Others',      c:'#64748b', i:'🧴'}
];
var LOCS = ['Library','CSE Block','Block C','Canteen','Admin Block','Auditorium','Hostel','Ground','Parking','Other'];

var S = {
  user: null, profile: null, view: 'login',
  history: [], authTab: 'login',
  filter: 'all', search: '', activeId: null,
  reportType: 'lost', items: [], notifications: [],
  loading: false, soundEnabled: true, audioCtx: null, notificationBaselineSet: false, lastNotificationCount: 0,
  authMsg: '', signingUp: false,
  settings: { open: true, approval: false },
  editingProfile: false,
  photo: null,   /* {blob, url} — photo chosen on the report screen */
  draft: null,    /* report form values kept while switching Lost/Found tab */
  claims: []      /* secure owner/finder claim requests; optional until SQL is installed */
};
try { var savedHiveSound = localStorage.getItem('hive_sound_enabled'); if (savedHiveSound === '0') S.soundEnabled = false; else if (savedHiveSound === '1') S.soundEnabled = true; } catch (e) {}

/* ---------- HELPERS ---------- */
function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}
function catIcon(cat){
  for(var i=0;i<CATS.length;i++){ if(CATS[i].n === cat) return CATS[i].i; }
  return CATS[CATS.length-1].i;
}
function icon(id, sz){
  sz = sz || 20;
  return '<svg style="width:'+sz+'px;height:'+sz+'px" aria-hidden="true"><use href="#'+id+'"/></svg>';
}
function toast(msg, ms){
  var old = document.querySelector('.toast');
  if(old) old.remove();
  var d = document.createElement('div');
  d.className = 'toast';
  d.textContent = msg;
  document.body.appendChild(d);
  setTimeout(function(){ if(d.parentNode) d.remove(); }, ms || 2400);
}
function unlockAudio(){
  try{var AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;if(!S.audioCtx)S.audioCtx=new AC();if(S.audioCtx.state==='suspended')S.audioCtx.resume().catch(function(){});}catch(e){}
}
function playNotificationSound(){
  if(!S.soundEnabled)return;
  try{unlockAudio();if(!S.audioCtx)return;var now=S.audioCtx.currentTime,o=S.audioCtx.createOscillator(),g=S.audioCtx.createGain();o.type='sine';o.frequency.setValueAtTime(880,now);o.frequency.exponentialRampToValueAtTime(1320,now+.12);g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(.065,now+.025);g.gain.exponentialRampToValueAtTime(.0001,now+.28);o.connect(g);g.connect(S.audioCtx.destination);o.start(now);o.stop(now+.3);}catch(e){}
}
function enterFullscreen(){
  try{unlockAudio();if(document.fullscreenElement)return;var el=document.documentElement,fn=el.requestFullscreen||el.webkitRequestFullscreen||el.msRequestFullscreen;if(fn)Promise.resolve(fn.call(el)).catch(function(){});}catch(e){}
}
function fmtDate(v){
  if(!v) return 'Just now';
  var dt = new Date(v);
  if(isNaN(dt.getTime())) return v;
  try{
    return dt.toLocaleString('en-IN', {day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'});
  }catch(e){ return v; }
}
function logo(size){
  return '<svg viewBox="0 0 200 240" style="width:'+size+'px;height:'+(size*1.2)+'px;flex-shrink:0"><use href="#lfLogo"/></svg>';
}

function findItem(id){
  for(var i=0;i<S.items.length;i++){ if(S.items[i].id === id) return S.items[i]; }
  return null;
}
function safePhotoUrl(u){ return (typeof u === 'string' && /^https:\/\//i.test(u)) ? u : ''; }
function thumbHTML(it){
  if(it.photo){
    return '<div class="home-item-icon has-photo"><img src="' + esc(it.photo) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'"></div>';
  }
  return '<div class="home-item-icon">' + catIcon(it.category) + '</div>';
}


/* ---------- VISUAL MATCH + CLAIMS (additive v4.0) ---------- */
function matchScore(a,b){
  if(!a || !b || a.type === b.type) return 0;
  var score=0;
  if((a.category||'').toLowerCase()===(b.category||'').toLowerCase()) score+=35;
  var an=(a.name||'').toLowerCase(), bn=(b.name||'').toLowerCase();
  if(an && bn && (an===bn || an.indexOf(bn)>=0 || bn.indexOf(an)>=0)) score+=35;
  if((a.location||'').toLowerCase()===(b.location||'').toLowerCase()) score+=20;
  var ad=(a.desc||'').toLowerCase(), bd=(b.desc||'').toLowerCase();
  var aw=ad.split(/[^a-z0-9]+/).filter(function(x){return x.length>3;});
  var bw=bd.split(/[^a-z0-9]+/).filter(function(x){return x.length>3;});
  var common=0; aw.forEach(function(w){if(bw.indexOf(w)>=0)common++;});
  score+=Math.min(10,common*2);
  return Math.min(100,score);
}
function possibleMatches(it){
  if(!it) return [];
  return S.items.filter(function(x){
    return x.id!==it.id && x.type!==it.type && x.status!=='returned';
  }).map(function(x){return {item:x,score:matchScore(it,x)};})
   .filter(function(x){return x.score>=35;})
   .sort(function(a,b){return b.score-a.score;}).slice(0,4);
}
function claimForItem(itemId){
  return S.claims.filter(function(c){return String(c.item_id)===String(itemId);});
}
async function loadClaims(){
  if(!S.user){S.claims=[];return;}
  try{
    var r=await supabase.from('item_claims').select('*').order('created_at',{ascending:false}).limit(100);
    S.claims=r.error?[]:(r.data||[]);
  }catch(e){S.claims=[];}
}
async function submitClaim(itemId){
  if(!S.user){toast('Please sign in first');return;}
  var note=prompt('For verification, mention one private identifying detail about the item (not shown publicly).');
  if(note===null)return;
  note=note.trim();
  if(!note){toast('Please provide an identifying detail');return;}
  try{
    var r=await supabase.rpc('submit_item_claim',{p_item_id:itemId,p_note:note});
    if(r.error) throw r.error;
    await loadClaims();
    await loadNotifications();
    toast('Claim submitted securely ✓');
    render();
  }catch(e){
    toast('Could not submit claim: '+(e.message||e),5000);
  }
}
async function reviewClaim(claimId,decision){
  try{
    var r=await supabase.rpc('review_item_claim',{p_claim_id:claimId,p_decision:decision});
    if(r.error) throw r.error;
    await loadClaims(); await loadNotifications();
    toast(decision==='approved'?'Claim approved ✓':'Claim rejected');
    render();
  }catch(e){toast('Could not update claim: '+(e.message||e),5000);}
}
function claimCard(c){
  var status=(c.status||'pending').toUpperCase();
  return '<div class="claim-card"><div class="claim-head"><b>Claim request</b><span class="claim-status '+esc(c.status||'pending')+'">'+esc(status)+'</span></div>'+
    '<div class="sub">Private verification detail received securely.</div>'+
    (((c.status||'pending')==='pending' && S.user && c.owner_id===S.user.id) ?
      '<div class="claim-actions"><button class="btn btn-primary" onclick="reviewClaim('+c.id+',\'approved\')">Approve</button><button class="btn btn-outline" onclick="reviewClaim('+c.id+',\'rejected\')">Reject</button></div>' : '')+
    '</div>';
}
function matchCards(it){
  var ms=possibleMatches(it);
  if(!ms.length)return '';
  return '<div class="match-section"><div class="label">Possible matches</div><div class="sub">These are suggestions based on item details, category and location. The photo is the final visual reference for the user.</div>'+
    ms.map(function(m){
      var x=m.item;
      return '<div class="match-card" onclick="openItem('+x.id+')">'+
        '<div class="match-photo">'+(x.photo?'<img src="'+esc(x.photo)+'" alt="">':catIcon(x.category))+'</div>'+
        '<div class="match-copy"><b>'+esc(x.name)+'</b><span>'+esc(x.category)+' • '+esc(x.location)+'</span><strong>'+m.score+'% detail match</strong></div>'+
      '</div>';
    }).join('')+'</div>';
}

/* ---------- NAV ---------- */
function nav(v, replace){
  if(!replace && S.view !== v){
    S.history.push(S.view);
    if(S.history.length > 20) S.history.shift();
  }
  S.view = v;
  render();
}
function goBack(){
  if(S.history.length){ S.view = S.history.pop(); }
  else { S.view = 'home'; }
  render();
}
function setAuthTab(t){
  S.authTab = t; S.authMsg = ''; render();
  if(t === 'signup'){
    var o = S.settings.open, a = S.settings.approval;
    loadSettings().then(function(){
      if(S.view === 'login' && (o !== S.settings.open || a !== S.settings.approval)) render();
    });
  }
}
function onSearch(v){
  S.search = v;
  var el = document.getElementById('listArea');
  if(el) el.innerHTML = listHTML();
}
function canGoBack(){ return S.history.length > 0 && S.view !== 'login'; }
function openReport(type){
  S.reportType = type || 'lost';
  clearPhoto(); S.draft = null;
  if(S.view !== 'report') S.history.push(S.view);
  S.view = 'report'; render();
}
function setReportType(t){ saveDraft(); S.reportType = t; render(); }
function setFilter(f){ S.filter = f; render(); }
function openItem(id){
  S.activeId = id;
  if(S.view !== 'details') S.history.push(S.view);
  S.view = 'details'; render();
}

/* ---------- ADMIN CONTROLS (block / approval / access / sign-up switch) ---------- */
var MSG_BLOCKED   = '🚫 Your account has been blocked by the admin. Please contact your college administrator.';
var MSG_PENDING   = '⏳ Your account is waiting for admin approval. Please try again later.';
var MSG_NO_ACCESS = '🔒 Your access to the app has been revoked by the admin. Please contact your college administrator.';

async function loadSettings(){
  try {
    var r = await supabase.from('app_settings').select('*').eq('id', 1).maybeSingle();
    if(r.data){
      S.settings = {
        open: r.data.signups_open !== false,
        approval: !!r.data.require_approval
      };
    }
  } catch(e){}
  return S.settings;
}

async function gateAccess(){
  var p = S.profile;
  if(!S.user || !p) return true;
  var msg = '';
  if(p.access_granted === false)   msg = MSG_NO_ACCESS;
  else if(p.is_blocked)            msg = MSG_BLOCKED;
  else if(p.is_approved === false) msg = MSG_PENDING;

  if(!msg) return true;

  S.authMsg = msg;
  S.user = null; S.profile = null; S.items = []; S.notifications = [];
  S.history = []; S.view = 'login';
  try { await supabase.auth.signOut(); } catch(e){}
  render();
  toast(msg);
  return false;
}

async function checkStillAllowed(){
  if(!S.user || !S.profile) return;
  try {
    var r = await supabase.from('profiles').select('*').eq('id', S.user.id).maybeSingle();
    if(r.data){
      S.profile.is_blocked     = r.data.is_blocked;
      S.profile.is_approved    = r.data.is_approved;
      S.profile.access_granted = r.data.access_granted;
      await gateAccess();
    }
  } catch(e){}
}

async function enterApp(user){
  if(!S.user||S.user.id!==user.id){S.notificationBaselineSet=false;S.lastNotificationFingerprint='';}
  S.user = user;
  await refreshAll();
  if(!(await gateAccess())) return;
  S.history = []; S.view = 'hivehome';
  render();
}

/* ---------- AUTH ---------- */
async function doSignup(){
  unlockAudio(); enterFullscreen();
  var name  = (document.getElementById('lgName')  || {}).value || '';
  var email = (document.getElementById('lgEmail') || {}).value || '';
  var pass  = (document.getElementById('lgPass')  || {}).value || '';
  name = name.trim(); email = email.trim();

  if(!name || !email || !pass){ toast('Please fill all fields'); return; }
  if(pass.length < 6){ toast('Password must be at least 6 characters'); return; }

  await loadSettings();
  if(!S.settings.open){ render(); toast('New registrations are closed by the admin'); return; }

  var btn = document.getElementById('authBtn');
  if(btn){ btn.disabled = true; btn.textContent = 'Creating account...'; }

  var newUser = null;
  S.signingUp = true;
  try {
    var res = await supabase.auth.signUp({
      email: email, password: pass,
      options: { data: { name: name } }
    });
    if(res.error) throw res.error;
    if(res.data && res.data.user){
      await supabase.from('profiles').upsert({
        id: res.data.user.id, name: name, email: email,
        role: 'student', is_admin: false, is_blocked: false
      });
    }
    var loginRes = await supabase.auth.signInWithPassword({ email: email, password: pass });
    if(loginRes.error) throw loginRes.error;
    newUser = loginRes.data.user;
    toast('Account created!');
  } catch(err){
    toast('Signup failed: ' + (err.message || err));
    if(btn){ btn.disabled = false; btn.textContent = 'Create Account'; }
  }
  S.signingUp = false;
  if(newUser) await enterApp(newUser);
}

async function forgotPassword(){
  var current=((document.getElementById('lgEmail')||{}).value||'').trim();
  var email=current || prompt('Enter your college email to receive the password reset link:');
  if(email===null)return;
  email=email.trim();
  if(!email){toast('Please enter your email');return;}
  try{
    var r=await supabase.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+window.location.pathname});
    if(r.error)throw r.error;
    toast('Password reset link sent. Check your email.',4500);
  }catch(e){toast('Could not send reset link: '+(e.message||e),5000);}
}

async function doLogin(){
  unlockAudio(); enterFullscreen();
  var email = (document.getElementById('lgEmail') || {}).value || '';
  var pass  = (document.getElementById('lgPass')  || {}).value || '';
  email = email.trim();
  S.authMsg = '';
  if(!email || !pass){ toast('Please enter email and password'); return; }

  var btn = document.getElementById('authBtn');
  if(btn){ btn.disabled = true; btn.textContent = 'Logging in...'; }

  try {
    var res = await supabase.auth.signInWithPassword({ email: email, password: pass });
    if(res.error) throw res.error;
    toast('Welcome back!');
  } catch(err){
    var m = err.message || '';
    if(/banned/i.test(m)){ S.authMsg = MSG_BLOCKED; render(); return; }
    toast('Login failed: ' + m);
    if(btn){ btn.disabled = false; btn.textContent = 'Sign in'; }
  }
}

async function doLogout(){
  clearPhoto(); S.draft = null;
  await supabase.auth.signOut();
  S.user = null; S.profile = null; S.items = []; S.notifications = [];
  S.notificationBaselineSet=false;S.lastNotificationFingerprint='';
  S.history = []; S.view = 'login';
  render();
}

/* ---------- DATA ---------- */
async function loadProfile(){
  if(!S.user) return;
  var res = await supabase.from('profiles').select('*').eq('id', S.user.id).maybeSingle();
  if(res.data) S.profile = res.data;
  else S.profile = {
    name: S.user.email.split('@')[0],
    email: S.user.email,
    role: 'student',
    is_admin: false,
    is_blocked: false,
    is_approved: true,
    access_granted: true
  };
}
async function loadItems(){
  var res = await supabase.from('items').select('*').order('created_at', {ascending:false});
  if(res.error){ console.error(res.error); S.items = []; return; }
  S.items = (res.data || []).map(function(r){
    return {
      id: r.id, name: r.name, type: r.type, category: r.category,
      location: r.location, date: fmtDate(r.created_at), status: r.status,
      mine: S.user && r.user_id === S.user.id,
      desc: r.description || 'No description provided.',
      photo: safePhotoUrl(r.photo_url),
      user_id: r.user_id
    };
  });
}
async function loadNotifications(){
  if(!S.user){ S.notifications = []; return; }
  var res = await supabase.from('notifications').select('*')
    .eq('user_id', S.user.id).order('created_at', {ascending:false}).limit(30);
  if(res.data){
    var latestRow = res.data[0] || null;
    var latestKey = latestRow ? String(latestRow.id || latestRow.created_at || latestRow.message || '') : '';
    if(S.notificationBaselineSet && latestKey && latestKey !== (S.lastNotificationFingerprint || '')) playNotificationSound();
    if(latestKey) S.lastNotificationFingerprint = latestKey;
    S.notificationBaselineSet = true;
    S.lastNotificationCount = res.data.length;
    S.notifications = res.data.map(function(r){
      return {k: r.type, t: r.message, time: fmtDate(r.created_at)};
    });
  }
}
async function refreshAll(){
  await loadProfile();
  await loadItems();
  await loadNotifications();
  await loadClaims();
}

/* ---------- PHOTO (snap a picture of the item) ---------- */
var PHOTO_BUCKET = 'item-photos';
var PHOTO_MAX_EDGE = 1280;      /* longest side after compression, in px */
var PHOTO_QUALITY = 0.82;       /* JPEG quality */

function clearPhoto(){
  if(S.photo && S.photo.url){ try{ URL.revokeObjectURL(S.photo.url); }catch(e){} }
  S.photo = null;
}
function imgFromFile(file){
  return new Promise(function(resolve, reject){
    var u = URL.createObjectURL(file), im = new Image();
    im.onload  = function(){ URL.revokeObjectURL(u); resolve(im); };
    im.onerror = function(){ URL.revokeObjectURL(u); reject(new Error('Could not read that image')); };
    im.src = u;
  });
}
function loadBitmap(file){
  if(window.createImageBitmap){
    return createImageBitmap(file, {imageOrientation:'from-image'}).catch(function(){ return imgFromFile(file); });
  }
  return imgFromFile(file);
}
/* Resize + re-encode as JPEG. Re-encoding also strips EXIF data (GPS location, device info). */
async function compressImage(file){
  var src = await loadBitmap(file);
  var w = src.naturalWidth || src.width, h = src.naturalHeight || src.height;
  if(!w || !h) throw new Error('Could not read that image');
  var k = Math.min(1, PHOTO_MAX_EDGE / Math.max(w, h));
  var cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
  var cv = document.createElement('canvas');
  cv.width = cw; cv.height = ch;
  var ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(src, 0, 0, cw, ch);
  try{ if(src.close) src.close(); }catch(e){}
  return new Promise(function(resolve, reject){
    cv.toBlob(function(b){ b ? resolve(b) : reject(new Error('Could not process the photo')); }, 'image/jpeg', PHOTO_QUALITY);
  });
}
function pickPhoto(mode){
  var el = document.getElementById(mode === 'cam' ? 'photoCam' : 'photoGal');
  if(el) el.click();
}
function removePhoto(){
  clearPhoto();
  var a = document.getElementById('photoArea');
  if(a) a.innerHTML = photoAreaHTML();
}
async function onPhotoPicked(input){
  var f = input.files && input.files[0];
  if(!f) return;
  if(f.type && f.type.indexOf('image/') !== 0){ input.value = ''; toast('Please choose an image file'); return; }
  var a = document.getElementById('photoArea');
  if(a) a.innerHTML = '<div class="photo-loading"><div class="spinner"></div><span>Preparing photo…</span></div>';
  try{
    var blob = await compressImage(f);
    clearPhoto();
    S.photo = { blob: blob, url: URL.createObjectURL(blob) };
  }catch(e){
    toast((e && e.message) || 'Could not use that photo', 5000);
  }
  try{ input.value = ''; }catch(e){}   /* reset so the same photo can be picked again */
  a = document.getElementById('photoArea');
  if(a) a.innerHTML = photoAreaHTML();
}
function photoAreaHTML(){
  if(S.photo){
    var kb = Math.max(1, Math.round(S.photo.blob.size / 1024));
    return '<div class="photo-preview">' +
      '<img src="' + S.photo.url + '" alt="Photo of the item">' +
      '<div class="photo-actions">' +
        '<button type="button" class="photo-chip" onclick="pickPhoto(\'cam\')">🔄 Retake</button>' +
        '<button type="button" class="photo-chip" onclick="pickPhoto(\'gal\')">🖼️ Change</button>' +
        '<button type="button" class="photo-chip danger" onclick="removePhoto()">✕ Remove</button>' +
      '</div>' +
      '<div class="photo-size">Ready to upload · ' + kb + ' KB</div>' +
    '</div>';
  }
  var found = S.reportType === 'found';
  return '<div class="photo-drop">' +
    '<div class="photo-drop-ico">📸</div>' +
    '<div class="photo-drop-title">' + (found ? 'Snap the item you found' : 'Add a photo of the item') + '</div>' +
    '<div class="photo-drop-hint">' + (found
        ? 'A clear photo helps the real owner recognise it instantly. For ID cards, cover the ID number and any personal details.'
        : 'If you have an old photo of it, add it — it makes matching much easier.') + '</div>' +
    '<div class="photo-btns">' +
      '<button type="button" class="btn btn-primary photo-btn" onclick="pickPhoto(\'cam\')">📷 Take Photo</button>' +
      '<button type="button" class="btn btn-outline photo-btn" onclick="pickPhoto(\'gal\')">🖼️ Gallery</button>' +
    '</div>' +
  '</div>';
}
async function uploadPhoto(){
  if(!S.photo) return null;
  var path = S.user.id + '/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.jpg';
  var up = await supabase.storage.from(PHOTO_BUCKET).upload(path, S.photo.blob, {
    contentType: 'image/jpeg', cacheControl: '31536000', upsert: false
  });
  if(up.error) throw up.error;
  var pub = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return { path: path, url: pub.data.publicUrl };
}
function friendlyError(err){
  var m = (err && err.message) ? err.message : String(err);
  if(/bucket not found|photo_url|photo_path|schema cache/i.test(m))
    return 'Photo storage is not set up yet. Admin: run setup_photos.sql in Supabase.';
  if(/row-level security|not allowed|unauthorized/i.test(m) && /storage|object|bucket/i.test(m))
    return 'Photo upload was not allowed. Please log in again.';
  return m;
}

/* ---------- SUBMIT REPORT ---------- */
function saveDraft(){
  function v(id){ var el = document.getElementById(id); return el ? el.value : ''; }
  if(!document.getElementById('rName')) return;
  S.draft = { name: v('rName'), cat: v('rCat'), desc: v('rDesc'), loc: v('rLoc') };
}
async function submitReport(){
  var name = (document.getElementById('rName') || {}).value || '';
  name = name.trim();
  if(!name){ toast('Please enter an item name'); return; }
  var cat  = document.getElementById('rCat').value;
  var desc = (document.getElementById('rDesc').value || '').trim();
  var loc  = document.getElementById('rLoc').value;
  var btn  = document.getElementById('submitBtn');
  if(btn){ btn.disabled = true; btn.textContent = 'Submitting...'; }
  var uploaded = null;
  try {
    if(S.photo){
      if(btn) btn.textContent = 'Uploading photo...';
      uploaded = await uploadPhoto();
      if(btn) btn.textContent = 'Submitting...';
    }
    var row = {
      user_id: S.user.id, name: name, type: S.reportType,
      category: cat, location: loc, description: desc, status: 'open'
    };
    if(uploaded){ row.photo_url = uploaded.url; row.photo_path = uploaded.path; }

    var insert = await supabase.from('items').insert(row).select().single();
    if(insert.error) throw insert.error;

    await supabase.from('notifications').insert({
      user_id: S.user.id, type: 'report',
      message: 'You reported: ' + name + ' (' + S.reportType + ') at ' + loc + (uploaded ? ' 📸' : '')
    });

    clearPhoto(); S.draft = null;
    await refreshAll();
    S.activeId = insert.data.id;
    S.history.push('home'); S.view = 'details';
    toast(uploaded ? 'Posted with photo 📸' : 'Reported successfully!');
    render();
  } catch(err){
    /* don't leave an orphan photo behind if the post itself failed */
    if(uploaded){ try{ supabase.storage.from(PHOTO_BUCKET).remove([uploaded.path]); }catch(e){} }
    toast('Failed: ' + friendlyError(err), 6000);
    if(btn){ btn.disabled = false; btn.textContent = 'Submit'; }
  }
}

async function markReturned(id){
  var res = await supabase.from('items').update({status:'returned'}).eq('id', id);
  if(res.error){ toast('Failed to update'); return; }
  await supabase.from('notifications').insert({
    user_id: S.user.id, type: 'returned', message: 'Item marked as returned!'
  });
  await refreshAll();
  toast('Marked as returned 🎉');
  render();
}

/* ---------- TOPBAR / NAV ---------- */
function topbar(showBell, showBack){
  var left;
  if(showBack && canGoBack()){
    left = '<div class="back-btn" onclick="goBack()">←</div>';
  } else {
    left = '<div class="brand">' + logo(22) + '<span>Lost &amp; Found</span></div>';
  }
  return '<div class="top">' + left +
    (showBell ? '<div class="bell" onclick="nav(\'notifications\')">' + icon('icBell',18) +
      (S.notifications.length ? '<span class="dot"></span>' : '') + '</div>' : '') +
  '</div>';
}
function bottomNav(){
  if(window.HIVE) return HIVE.nav();
  var n=S.view;
  function btn(v,ic,lbl){return '<button class="navbtn'+(n===v?' active':'')+'" onclick="nav(\''+v+'\', true); unlockAudio()">'+icon(ic,22)+'<span>'+lbl+'</span></button>';}
  return '<div class="nav nav-main">'+btn('profile','icUser','Profile')+btn('home','icHome','Home')+btn('stats','icDash','Stats')+'</div>';
}

/* ==========================================================
   LOGIN SCREEN
   ========================================================== */
function screenLogin(){
  var isLogin = S.authTab === 'login';
  return '<div class="login-hero"><div class="login-hero-inner">' +
    '<div class="login-logo">' + logo(88) + '</div>' +
    '<h1 class="login-title">Lost &amp; Found</h1>' +
    '<p class="login-subtitle">College App</p>' +
    '<p class="login-quote">Every item has a story.</p>' +
    '<div class="login-form-card">' +
      (S.authMsg ? '<div class="login-msg">' + esc(S.authMsg) + '</div>' : '') +
      '<div class="login-tabs">' +
        '<div class="login-tab ' + (isLogin ? 'active' : '') + '" onclick="setAuthTab(\'login\')">Login</div>' +
        '<div class="login-tab ' + (!isLogin ? 'active' : '') + '" onclick="setAuthTab(\'signup\')">Sign Up</div>' +
      '</div>' +
      (isLogin ? '' :
        (!S.settings.open ? '<div class="login-msg">🔒 New registrations are currently closed by the admin.</div>' :
         (S.settings.approval ? '<div class="login-msg info">⏳ New accounts need admin approval before you can log in.</div>' : '')) +
        '<div class="login-field"><label>Full Name</label>' +
        '<input id="lgName" placeholder="Your name"></div>') +
      '<div class="login-field"><label>College Email</label>' +
        '<input type="email" id="lgEmail" placeholder="name@college.edu"></div>' +
      '<div class="login-field"><label>Password</label>' +
        '<div class="password-wrap"><input type="password" id="lgPass" placeholder="Enter password"><button type="button" class="password-eye" onclick="togglePasswordVisibility(\'lgPass\',this)" aria-label="Show password"><svg class="eye-open" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg><svg class="eye-closed" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.9 10.9 0 0 1 12 19c-7 0-11-7-11-7a19.8 19.8 0 0 1 5.06-5.94M9.9 4.24A10.9 10.9 0 0 1 12 4c7 0 11 7 11 7a19.8 19.8 0 0 1-3.17 4.19M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg></button></div>' +
      '<button class="login-btn" id="authBtn"' +
        (!isLogin && !S.settings.open ? ' disabled' : '') +
        ' onclick="' + (isLogin ? 'doLogin()' : 'doSignup()') + '">' +
        (isLogin ? 'Sign in' : 'Create Account') + '</button>' +
      (isLogin ? '<div class="forgot-link" onclick="forgotPassword()">Forgot password?</div>' : '') +
      '<div class="login-footer-note">Real accounts · Data saved to cloud ☁️</div>' +
    '</div>' +
  '</div></div>';
}

/* ==========================================================
   HOME SCREEN
   ========================================================== */
function screenHome(){
  var name = (S.profile && S.profile.name) || 'Student';

  var demoItems = [
    {id:'demo1', name:'Water Bottle', type:'found', category:'Others',      location:'Library'},
    {id:'demo2', name:'ID Card',      type:'lost',  category:'ID Cards',    location:'C Block'},
    {id:'demo3', name:'Earphones',    type:'found', category:'Electronics', location:'Hostel'}
  ];

  var displayItems = S.items.slice(0, 3);
  var usingDemo = displayItems.length === 0;
  if(usingDemo) displayItems = demoItems;

  var itemsHTML = displayItems.map(function(it){
    var tag = it.type === 'found'
      ? '<span class="tag found">Found</span>'
      : '<span class="tag lost">Lost</span>';
    var clickAttr = usingDemo ? '' : 'onclick="openItem(' + it.id + ')"';
    return '<div class="home-item" ' + clickAttr + '>' +
      thumbHTML(it) +
      '<div class="home-item-info">' +
        '<h4>' + esc(it.name) + '</h4>' +
        '<p>' + (it.type === 'found' ? 'Found in ' : 'Lost near ') + esc(it.location) + '</p>' +
      '</div>' + tag +
    '</div>';
  }).join('');

  return topbar(true, false) +
  '<div class="screen">' +

    '<div class="home-greeting">' +
      '<div class="eyebrow">Good to see you</div>' +
      '<h1>What are we finding today?</h1>' +
      '<p>Hello, ' + esc(name) + ' 👋</p>' +
    '</div>' +

    '<div class="home-search">' +
      '<input placeholder="Search for an item..." oninput="onSearch(this.value)" value="' + esc(S.search) + '">' +
    '</div>' +

    '<div class="home-filters">' +
      ['all','lost','found','returned'].map(function(f){
        var lbl = f === 'all' ? 'All' : (f === 'lost' ? 'Lost' : (f === 'found' ? 'Found' : 'Returned'));
        return '<button class="filter-pill' + (S.filter === f ? ' active' : '') +
          '" onclick="setFilter(\'' + f + '\')">' + lbl + '</button>';
      }).join('') +
    '</div>' +

    '<div class="home-actions">' +
      '<div class="action-card" onclick="openReport(\'lost\')">' +
        '<div class="action-icon lost">➕</div>' +
        '<h3>Report Lost Item</h3>' +
        '<p>Add details, location, time, image</p>' +
      '</div>' +
      '<div class="action-card" onclick="openReport(\'found\')">' +
        '<div class="action-icon found">✅</div>' +
        '<h3>Post Found Item</h3>' +
        '<p>Snap a photo and add location</p>' +
      '</div>' +
    '</div>' +

    '<div class="quick-link" style="margin-top:14px" onclick="nav(\'browse\')"><span>🧭 Explore all campus items</span><b>→</b></div>' +

    '<div class="section-header">' +
      '<h2>Recent Items</h2>' +
      '<a onclick="nav(\'browse\')">View all →</a>' +
    '</div>' +
    '<div class="home-items" id="listArea">' + itemsHTML + '</div>' +

    '<div class="recovery-card">' +
      '<h3>How Recovery Works</h3>' +
      '<p class="recovery-quote">Every item has a story.</p>' +
      '<div class="recovery-step"><div class="recovery-step-num">1</div><div class="recovery-step-text">Student loses an item</div></div>' +
      '<div class="recovery-step"><div class="recovery-step-num">2</div><div class="recovery-step-text">Reports it on app</div></div>' +
      '<div class="recovery-step"><div class="recovery-step-num">3</div><div class="recovery-step-text">Found item is posted</div></div>' +
      '<div class="recovery-step"><div class="recovery-step-num">4</div><div class="recovery-step-text">System identifies possible match</div></div>' +
      '<div class="recovery-step"><div class="recovery-step-num">5</div><div class="recovery-step-text">Owner verification (secure &amp; safe)</div></div>' +
      '<div class="recovery-step"><div class="recovery-step-num">6</div><div class="recovery-step-text">Item returned back to owner</div></div>' +
    '</div>' +

  '</div>' + bottomNav();
}

/* ==========================================================
   BROWSE / MY POSTS
   ========================================================== */
function listHTML(){
  var f = S.filter, q = (S.search || '').toLowerCase();
  var list = S.items.filter(function(i){
    var okF;
    if(f === 'all') okF = true;
    else if(f === 'returned') okF = (i.status === 'returned');
    else okF = (i.type === f && i.status !== 'returned');
    var okQ = !q || i.name.toLowerCase().indexOf(q) >= 0 ||
      i.location.toLowerCase().indexOf(q) >= 0 ||
      i.category.toLowerCase().indexOf(q) >= 0;
    return okF && okQ;
  });
  if(!list.length) return '<div class="sub" style="text-align:center;margin-top:34px">No items match your search.</div>';
  return list.map(function(it){
    var tag = it.type === 'found' ? '<span class="tag found">Found</span>' : '<span class="tag lost">Lost</span>';
    return '<div class="home-item" onclick="openItem(' + it.id + ')">' +
      thumbHTML(it) +
      '<div class="home-item-info"><h4>' + esc(it.name) + '</h4>' +
      '<p>📍 ' + esc(it.location) + ' • ' + esc(it.date) + '</p></div>' + tag + '</div>';
  }).join('');
}
function screenBrowse(){
  var pills = [['all','All'], ['lost','Lost'], ['found','Found'], ['returned','Returned']];
  return topbar(true, true) + '<div class="screen">' +
    '<div class="h1">My Posts</div>' +
    '<div class="sub">All items reported on campus.</div>' +
    '<input class="input" placeholder="Search items..." value="' + esc(S.search) + '" oninput="onSearch(this.value)">' +
    '<div class="pillrow">' +
      pills.map(function(p){
        return '<button class="pill' + (S.filter === p[0] ? ' active' : '') +
          '" onclick="setFilter(\'' + p[0] + '\')">' + p[1] + '</button>';
      }).join('') +
    '</div>' +
    '<div id="listArea">' + listHTML() + '</div>' +
  '</div>' + bottomNav();
}

/* ---------- PHOTO LIGHTBOX ---------- */
function openLightbox(id){
  var it = findItem(id);
  if(!it || !it.photo) return;
  closeLightbox();
  var d = document.createElement('div');
  d.className = 'lightbox'; d.id = 'lightbox';
  var im = document.createElement('img');
  im.src = it.photo; im.alt = it.name;
  var x = document.createElement('div');
  x.className = 'lightbox-x'; x.textContent = '✕';
  d.appendChild(im); d.appendChild(x);
  d.onclick = closeLightbox;
  document.body.appendChild(d);
}
function closeLightbox(){
  var d = document.getElementById('lightbox');
  if(d) d.remove();
}
document.addEventListener('keydown', function(e){ if(e.key === 'Escape') closeLightbox(); });

/* ---------- DETAILS ---------- */
function screenDetails(){
  var it = findItem(S.activeId);
  if(!it) return screenBrowse();
  var tag = it.type === 'found' ? '<span class="tag found">Found</span>' : '<span class="tag lost">Lost</span>';
  var claims=claimForItem(it.id);
  var mineClaim=claims.some(function(c){return c.claimant_id===S.user.id;});
  var actionRow = (it.status === 'returned' || !it.mine)
    ? ''
    : '<button class="btn btn-gold" style="margin-top:10px" onclick="markReturned(' + it.id + ')">Mark as Returned</button>';
  var hero = it.photo
    ? '<div class="item-photo" onclick="openLightbox(' + it.id + ')"><img src="' + esc(it.photo) + '" alt="' + esc(it.name) + '"><span class="item-photo-hint">🔍 Tap to enlarge</span></div>'
    : '<div class="card" style="text-align:center;font-size:64px;background:rgba(37,99,235,.1);padding:30px">' + catIcon(it.category) + '</div>';
  var claimAction='';
  if(!it.mine && it.type==='found' && it.status!=='returned'){
    claimAction=mineClaim
      ? '<div class="claim-notice">⏳ Your ownership claim is already submitted.</div>'
      : '<button class="btn btn-primary" style="margin-top:14px" onclick="submitClaim('+it.id+')">🔐 I believe this is my item</button>';
  }
  var ownerClaims=it.mine && it.type==='found' && claims.length
    ? '<div class="claims-section"><div class="label">Ownership verification</div>'+claims.map(claimCard).join('')+'</div>' : '';
  var privacy='<div class="privacy-note">🔒 Contact details are not displayed publicly. Ownership is verified before a return is confirmed.</div>';
  return topbar(false, true) + '<div class="screen">' +
    hero +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;gap:10px"><div class="h1" style="margin:0">' + esc(it.name) + '</div>' + tag + '</div>' +
    '<div class="imeta" style="margin:8px 0 14px;font-size:13px">📍 ' + esc(it.location) + ' &nbsp;•&nbsp; 🕒 ' + esc(it.date) + '</div>' +
    '<div class="label">Description</div><div class="sub" style="color:var(--text)">' + esc(it.desc) + '</div>' +
    (it.type==='found' ? '<div class="photo-purpose">📸 <b>Found-item snapshot</b><span>Use this photo to visually compare the item you lost.</span></div>' :
      '<div class="photo-purpose">🖼️ <b>Owner reference photo</b><span>This photo helps the finder recognise the real owner’s item.</span></div>') +
    claimAction + ownerClaims + matchCards(it) + privacy +
    actionRow +
  '</div>';
}

/* ---------- REPORT ---------- */
function screenReport(){
  var t = S.reportType || 'lost';
  var d = S.draft || {};
  var catOpts = CATS.map(function(c){
    return '<option value="' + esc(c.n) + '"' + (d.cat === c.n ? ' selected' : '') + '>' + esc(c.n) + '</option>';
  }).join('');
  var locOpts = LOCS.map(function(l){
    return '<option value="' + esc(l) + '"' + (d.loc === l ? ' selected' : '') + '>' + esc(l) + '</option>';
  }).join('');
  return topbar(false, true) + '<div class="screen">' +
    '<div class="h1">Report an Item</div>' +
    '<div class="tabs">' +
      '<div class="tab ' + (t === 'lost' ? 'active' : '') + '" onclick="setReportType(\'lost\')">Lost</div>' +
      '<div class="tab ' + (t === 'found' ? 'active' : '') + '" onclick="setReportType(\'found\')">Found</div>' +
    '</div>' +
    '<span class="label">' + (t === 'found' ? 'Found-item snapshot (recommended)' : 'Owner reference photo (optional)') + '</span>' +
    '<input type="file" id="photoCam" accept="image/*" capture="environment" hidden onchange="onPhotoPicked(this)">' +
    '<input type="file" id="photoGal" accept="image/*" hidden onchange="onPhotoPicked(this)">' +
    '<div id="photoArea">' + photoAreaHTML() + '</div>' +
    '<span class="label">Item Name *</span>' +
    '<input class="input" id="rName" placeholder="e.g. Water Bottle" value="' + esc(d.name || '') + '">' +
    '<span class="label">Category *</span>' +
    '<select id="rCat">' + catOpts + '</select>' +
    '<span class="label">Description *</span>' +
    '<textarea id="rDesc" placeholder="Colour, brand, distinctive features...">' + esc(d.desc || '') + '</textarea>' +
    '<span class="label">Location *</span>' +
    '<select id="rLoc">' + locOpts + '</select>' +
    '<button class="btn btn-primary" id="submitBtn" style="margin-top:20px" onclick="submitReport()">Submit</button>' +
  '</div>';
}

/* ---------- NOTIFICATIONS ---------- */
function screenNotifications(){
  var emap = {found:'✅', match:'🔔', report:'📢', returned:'🎉'};
  var body = S.notifications.length
    ? S.notifications.map(function(n){
        return '<div class="notif">' +
          '<div class="ico" style="background:#dbe6ff">' + (emap[n.k] || '🔔') + '</div>' +
          '<div style="flex:1"><div class="ntext">' + esc(n.t) + '</div>' +
          '<div class="ntime">' + esc(n.time) + '</div></div></div>';
      }).join('')
    : '<div class="sub" style="text-align:center;margin-top:40px">No notifications yet.</div>';
  return topbar(false, true) + '<div class="screen">' +
    '<div class="h1">Notifications</div>' +
    '<div class="sub">Updates on your reports and matches.</div>' + body +
  '</div>' + bottomNav();
}

/* ---------- STATS ---------- */
function screenStats(){
  var total=S.items.length,lost=S.items.filter(function(i){return i.type==='lost'&&i.status!=='returned';}).length,found=S.items.filter(function(i){return i.type==='found'&&i.status!=='returned';}).length,returned=S.items.filter(function(i){return i.status==='returned';}).length,open=total-returned,mine=S.items.filter(function(i){return i.mine;}).length;
  return topbar(true,true)+'<div class="screen"><div class="h1">Campus Stats</div><div class="sub">A live summary of lost &amp; found activity.</div><div class="stats-grid">'+
    '<div class="stat"><b>'+total+'</b><span>Total Items</span></div><div class="stat"><b>'+open+'</b><span>Open</span></div><div class="stat"><b>'+returned+'</b><span>Returned</span></div><div class="stat"><b>'+lost+'</b><span>Lost</span></div><div class="stat"><b>'+found+'</b><span>Found</span></div><div class="stat"><b>'+mine+'</b><span>My Reports</span></div></div>'+
    '<div class="card" style="margin-top:16px"><div class="label" style="margin-top:0">Activity</div><div class="prow"><span>Notifications</span><b>'+S.notifications.length+'</b></div><div class="prow"><span>Items returned</span><b>'+returned+'</b></div><div class="prow"><span>Open reports</span><b>'+open+'</b></div></div></div>'+bottomNav();
}

/* ---------- PROFILE / SETTINGS ---------- */
async function saveProfile(){
  var input=document.getElementById('profileNameInput');
  var name=((input||{}).value||'').trim();
  if(!name){toast('Please enter your name');return;}
  if(!S.user){return;}
  var res=await supabase.from('profiles').update({name:name}).eq('id',S.user.id);
  if(res.error){toast('Could not update profile: '+res.error.message);return;}
  if(S.profile) S.profile.name=name;
  S.editingProfile=false;
  toast('Profile updated ✓');
  render();
}
function toggleSound(){
  S.soundEnabled=!S.soundEnabled;
  try{localStorage.setItem('hive_sound_enabled',S.soundEnabled?'1':'0');}catch(e){}
  if(S.soundEnabled){unlockAudio();if(window.HIVEUIFX&&HIVEUIFX.play)HIVEUIFX.play('tap');}
  toast(S.soundEnabled?'Interface and notification sounds ON 🔔':'Interface and notification sounds OFF');
  render();
}

function togglePasswordVisibility(id, btn){
  var el=document.getElementById(id); if(!el)return;
  var show=el.type==='password'; el.type=show?'text':'password';
  if(btn){btn.classList.toggle('on',show);btn.setAttribute('aria-label',show?'Hide password':'Show password');}
}

/* ---------- PROFILE ---------- */
function screenProfile(){
  var initial  = ((S.profile && S.profile.name) || 'S').charAt(0).toUpperCase();
  var name     = (S.profile && S.profile.name) || 'Student';
  var email    = (S.profile && S.profile.email) || (S.user && S.user.email) || '';
  var mine     = S.items.filter(function(i){ return i.mine; }).length;
  var returned = S.items.filter(function(i){ return i.status === 'returned'; }).length;
  var adminRow = (S.profile && S.profile.is_admin === true) ? '<div class="prow" onclick="window.location.href=\'admin.html\'">🛡️ Admin Panel <span>›</span></div>' : '';
  var editBlock = S.editingProfile ?
    '<div class="card" style="text-align:left;margin-top:16px">' +
      '<div class="label" style="margin-top:0">Display name</div>' +
      '<input class="input" id="profileNameInput" value="'+esc(name)+'" maxlength="80">' +
      '<div style="display:flex;gap:10px;margin-top:10px"><button class="btn btn-primary" onclick="saveProfile()">Save</button><button class="btn" onclick="S.editingProfile=false;render()">Cancel</button></div>' +
    '</div>' : '';
  return topbar(false, true) + '<div class="screen" style="text-align:center">' +
    '<div style="height:16px"></div>' +
    '<div class="avatar">' + initial + '</div>' +
    '<div class="h1" style="margin:0">' + esc(name) + '</div>' +
    '<div class="sub">' + esc(email) + '</div>' +
    '<div class="stat3">' +
      '<div class="stat"><b>' + mine + '</b><span>My reports</span></div>' +
      '<div class="stat"><b>' + returned + '</b><span>Returned</span></div>' +
      '<div class="stat"><b>' + S.notifications.length + '</b><span>Alerts</span></div>' +
    '</div>' + editBlock +
    '<div style="text-align:left;margin-top:12px">' +
      '<div class="prow" onclick="S.editingProfile=true;render()">✏️ Edit Profile <span>›</span></div>' +
      '<div class="prow" onclick="setFilter(\'all\');nav(\'browse\')">📋 My Reported Items <span>›</span></div>' +
      '<div class="prow" onclick="nav(\'notifications\')">🔔 Notifications <span>' + S.notifications.length + '</span></div>' +
      '<div class="prow" onclick="nav(\'browse\')">🧭 Explore All Items <span>›</span></div>' +
      '<div class="prow" onclick="toggleSound()">' + (S.soundEnabled?'🔊':'🔇') + ' Notification Sound <span>' + (S.soundEnabled?'ON':'OFF') + '</span></div>' +
      adminRow +
      '<div class="prow" onclick="doLogout()" style="color:var(--lost)">🚪 Logout <span>›</span></div>' +
    '</div>' +
    '<div class="sub" style="margin-top:28px;font-size:12px">Lost &amp; Found · v4.0<br>A. VEDA SATHVIK</div>' +
  '</div>' + bottomNav();
}

/* ---------- RENDER ---------- */
function render(){
  var map = {
    login: screenLogin,
    home: screenHome,
    browse: screenBrowse,
    details: screenDetails,
    report: screenReport,
    notifications: screenNotifications,
    stats: screenStats,
    profile: screenProfile
  };
  if(window.HIVE){ for(var hk in HIVE.screens){ map[hk] = HIVE.screens[hk]; } }
  var fn = map[S.view] || screenHome;
  var el = document.getElementById('phone');
  el.innerHTML = fn();
  if(window.HIVE) HIVE.after();
}

document.addEventListener('pointerdown',function(){unlockAudio();},{passive:true});

/* ---------- BOOT ---------- */
(async function boot(){
  try {
    var session = await supabase.auth.getSession();
    await loadSettings();
    if(session.data && session.data.session){
      S.user = session.data.session.user;
      await refreshAll();
      if(await gateAccess()) S.view = 'hivehome';
    }
  } catch(e){}

  supabase.auth.onAuthStateChange(async function(event, sess){
    if(event === 'SIGNED_IN' && sess){
      if(S.signingUp) return;
      /* supabase-js re-fires SIGNED_IN every time the page becomes visible again
         (e.g. coming back from the camera / gallery). That is NOT a new login -
         don't jump to Home and wipe the report form. */
      if(S.user && S.user.id === sess.user.id){ S.user = sess.user; return; }
      await enterApp(sess.user);
    } else if(event === 'SIGNED_OUT'){
      S.user = null; S.profile = null;
      S.notificationBaselineSet=false;S.lastNotificationFingerprint='';
      S.history = []; S.view = 'login';
      render();
    }
  });

  render();

  setInterval(function(){if(S.user)loadNotifications().then(function(){if(S.view==='notifications')render();});},7000);

  /* kick out a user the moment the admin blocks/revokes them */
  setInterval(checkStillAllowed, 20000);
  document.addEventListener('visibilitychange', function(){
    if(!document.hidden) checkStillAllowed();
  });

  /* landscape lock when allowed */
  try {
    if(screen.orientation && screen.orientation.lock){
      screen.orientation.lock('portrait').catch(function(){});
    }
  } catch(e){}
})();