/* HIVE Chat & Groups extension. Group data is stored only in Supabase tables supplied by the optional migration. */
(function(){
  'use strict';
  if(!window.HIVE||!window.HIVE.screens)return;
  var originalAfter=window.HIVE.after;
  var C={mode:'community',publicMessages:[],publicReady:false,publicBusy:false,publicError:'',groups:[],memberships:[],groupsReady:false,groupsBusy:false,groupsError:'',selected:null,groupMessages:[],groupMessagesReady:false,groupMessagesBusy:false,groupError:'',modal:false,manage:false,groupMembers:[],membersError:'',sending:false};
  var $=function(id){return document.getElementById(id);};
  var groupMessageRequest=0;
  var groupsPromise=null;
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function userId(){return window.S&&S.user&&S.user.id;}
  function community(){return (S.profile&&S.profile.community_id)||'default';}
  function field(){var f=document.documentElement.getAttribute('data-field');return f==='medical'?'medical':'education';}
  function toastMsg(s){if(typeof toast==='function')toast(s);else if(window.HIVEUX&&HIVEUX.toast)HIVEUX.toast(s);else alert(s);}
  function glyph(){return '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><polygon points="12,2 21,7 21,17 12,22 3,17 3,7" fill="#FBC02D"/><circle cx="12" cy="12" r="3" fill="#0b1220"/></svg>'; }
  function header(title){return '<div class="top"><div class="brand">'+glyph()+'<span>'+esc(title)+'</span></div><button class="bell" onclick="nav(\'notifications\',true)" aria-label="Notifications">'+(window.icon?icon('icBell',18):'♧')+'</button></div>';}
  function nav(){return window.HIVEUX&&HIVEUX.nav?HIVEUX.nav():window.HIVE.nav();}
  function tabs(){return '<div class="chat-mode-tabs" role="tablist" aria-label="Chat type"><button type="button" role="tab" aria-selected="'+(C.mode==='community'?'true':'false')+'" class="chat-mode-tab '+(C.mode==='community'?'active':'')+'" onclick="HIVEGROUPCHAT.mode(\'community\')">Community chat</button><button type="button" role="tab" aria-selected="'+(C.mode==='groups'?'true':'false')+'" class="chat-mode-tab '+(C.mode==='groups'?'active':'')+'" onclick="HIVEGROUPCHAT.mode(\'groups\')">Groups</button></div>';}
  function msgRows(rows,empty){
    if(!rows||!rows.length)return '<div class="group-empty-state"><span class="group-empty-icon">✦</span><b>'+esc(empty)+'</b><p>Messages sent here are stored in the database when the chat service is available.</p></div>';
    return rows.map(function(m){var mine=userId()&&m.user_id===userId(),d=new Date(m.created_at),tm=isNaN(d)?'':d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});return '<div class="msg '+(mine?'me':'')+'">'+(mine?'':'<div class="who">'+esc(m.author||'Member')+'</div>')+'<div class="bub">'+esc(m.body)+'</div><div class="tm">'+esc(tm)+'</div></div>';}).join('');
  }
  function communityBody(){
    var note=C.publicError?'<div class="hnote">'+esc(C.publicError)+'</div>':'';
    return note+'<div class="chatlist group-message-list" id="hgcCommunityMessages">'+(C.publicReady?msgRows(C.publicMessages,'No community messages yet. Start a respectful conversation.'): '<div class="hsub">Loading community chat…</div>')+'</div><div class="chatbar"><input class="input" id="hgcCommunityInput" maxlength="500" placeholder="Message your community" onkeydown="if(event.key===\'Enter\')HIVEGROUPCHAT.sendCommunity()"><button class="btn btn-primary" onclick="HIVEGROUPCHAT.sendCommunity()" '+(C.sending?'disabled':'')+'>Send</button></div>';
  }
  function groupList(){
    var head='<div class="group-list-head"><div><h2>Your groups</h2><p>Join public spaces or create a private group for a smaller conversation.</p></div><button class="btn btn-primary" onclick="HIVEGROUPCHAT.openCreate()">+ Create group</button></div>';
    if(C.groupsError)return head+'<div class="hnote">'+esc(C.groupsError)+'</div><button type="button" class="btn btn-outline" onclick="HIVEGROUPCHAT.retryGroups()">Retry groups</button>';
    if(C.groupsBusy&&!C.groupsReady)return head+'<div class="group-empty-state"><div class="group-spinner"></div><b>Finding your groups</b><p>Checking groups available to your HIVE account. You can create a group while the list loads.</p></div>';
    var rows=C.groups.map(function(g){var joined=C.memberships.some(function(m){return String(m.group_id)===String(g.id);})||String(g.created_by)===String(userId());var isOwner=String(g.created_by)===String(userId());return '<article class="group-card"><div class="group-card-top"><span class="group-icon">'+(g.visibility==='private'?'⌑':'◉')+'</span><span class="group-visibility '+(g.visibility==='private'?'private':'public')+'">'+(g.visibility==='private'?'Private':'Public')+'</span></div><h3>'+esc(g.name)+'</h3><p>'+esc(g.description||'No description added yet.')+'</p><div class="group-card-meta"><span>Created '+esc(new Date(g.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short'}))+'</span>'+(isOwner?'<span>Creator</span>':'')+'</div><div class="group-card-actions">'+(joined?'<button class="btn btn-primary" onclick="HIVEGROUPCHAT.openGroup(\''+esc(g.id)+'\')">Open group</button>':g.visibility==='public'?'<button class="btn btn-primary" onclick="HIVEGROUPCHAT.joinGroup(\''+esc(g.id)+'\')">Join group</button>':'<span class="group-private-note">Private groups need an invite.</span>')+'</div></article>';}).join('');
    return head+(rows||'<div class="group-empty-state"><span class="group-empty-icon">⬡</span><b>No groups are available yet</b><p>Create the first public or private group for your community.</p></div>');
  }
  function groupChatBody(){
    var g=C.selected;if(!g)return groupList();
    var owner=g.created_by===userId();
    var body=!C.groupMessagesReady?'<div class="hsub group-loading-line"><span class="group-spinner"></span>Loading group messages…</div>':msgRows(C.groupMessages,'No messages in this group yet. Start the conversation.');
    var memberTools=owner?'<button class="hbtn" onclick="HIVEGROUPCHAT.manageMembers()">Manage members</button>':'';
    var error=C.groupError?'<div class="hnote">'+esc(C.groupError)+'</div>':'';
    return '<div class="group-open-head"><button class="hbtn" onclick="HIVEGROUPCHAT.backGroups()">← All groups</button><div class="group-open-title"><span class="group-visibility '+(g.visibility==='private'?'private':'public')+'">'+(g.visibility==='private'?'Private':'Public')+'</span><h2>'+esc(g.name)+'</h2><p>'+esc(g.description||'Group conversation')+'</p></div>'+memberTools+'</div><div class="hnote" id="hgcGroupError"'+(C.groupError?'':' style="display:none"')+'>'+error.replace(/^<div class="hnote">|<\/div>$/g,'')+'</div><div class="chatlist group-message-list" id="hgcGroupMessages">'+body+'</div><div class="chatbar"><input class="input" id="hgcGroupInput" maxlength="500" placeholder="Message this group" onkeydown="if(event.key===\'Enter\')HIVEGROUPCHAT.sendGroup()"><button class="btn btn-primary" onclick="HIVEGROUPCHAT.sendGroup()" '+(C.sending?'disabled':'')+'>Send</button></div>'+(C.manage?membersPanel():'');
  }
  function membersPanel(){
    if(!C.selected||C.selected.created_by!==userId())return '';
    return '<section class="group-members-panel"><div class="group-panel-title"><div><b>Group members</b><p>These are database records returned for this group.</p></div><button class="hbtn" onclick="HIVEGROUPCHAT.closeManage()">Close</button></div>'+(C.membersError?'<div class="hnote">'+esc(C.membersError)+'</div>':'')+((C.groupMembers||[]).map(function(m){return '<div class="group-member-row"><span class="group-member-avatar">'+esc((m.name||m.email||'M').charAt(0).toUpperCase())+'</span><div><b>'+esc(m.name||'Name not available')+'</b><small>'+esc(m.email||m.roll_no||'Profile details not available')+'</small></div><span class="group-member-role">'+esc(m.role||'member')+'</span></div>';}).join('')||'<p class="group-empty-small">No members have been returned yet.</p>')+'<div class="group-invite"><label for="hgcInviteEmail">Invite by HIVE username or email</label><div class="group-invite-row"><input class="input" id="hgcInviteEmail" maxlength="180" placeholder="username or email"><button class="btn btn-primary" onclick="HIVEGROUPCHAT.inviteMember()">Invite</button></div><small>Only the group creator can invite members to a private group.</small></div></section>';
  }
  function modal(){if(!C.modal)return '';return '<div class="group-modal-backdrop" onclick="if(event.target===this)HIVEGROUPCHAT.closeCreate()"><section class="group-create-modal" role="dialog" aria-modal="true" aria-labelledby="hgcCreateTitle"><div class="group-modal-kicker">NEW COMMUNITY SPACE</div><h2 id="hgcCreateTitle">Create a group</h2><p>Give your group a clear purpose and choose who can join.</p><label for="hgcName">Group name</label><input class="input" id="hgcName" maxlength="80" placeholder="e.g. Robotics Club Chat"><label for="hgcDescription">Description</label><textarea class="input" id="hgcDescription" rows="3" maxlength="500" placeholder="What will members use this group for?"></textarea><div class="group-visibility-options"><label class="group-visibility-option"><input type="radio" name="hgcVisibility" value="public" checked><span class="group-visibility-swatch">◉</span><span><b>Public group</b><small>People in this HIVE community can discover and join it.</small></span></label><label class="group-visibility-option"><input type="radio" name="hgcVisibility" value="private"><span class="group-visibility-swatch">⌑</span><span><b>Private group</b><small>Visible only to the creator and invited members.</small></span></label></div><div class="group-modal-actions"><button class="btn" onclick="HIVEGROUPCHAT.closeCreate()">Cancel</button><button class="btn btn-primary" onclick="HIVEGROUPCHAT.createGroup()">Create group</button></div><div class="group-modal-note">Group records and messages require the optional group-chat database migration.</div></section></div>';}
  function screen(){
    var title=C.mode==='community'?'Community chat':C.selected?C.selected.name:'Group chat';
    var body=C.mode==='community'?communityBody():groupChatBody();
    return header(title)+'<div class="screen group-chat-screen">'+tabs()+body+modal()+'</div>'+nav();
  }
  function paintMessages(){var el=$('hgcCommunityMessages');if(el){var publicHtml=C.publicReady?msgRows(C.publicMessages,'No community messages yet. Start a respectful conversation.'): '<div class="hsub">Loading community chat…</div>';if(el.innerHTML!==publicHtml){el.innerHTML=publicHtml;el.scrollTop=el.scrollHeight;}}var ge=$('hgcGroupMessages');if(ge){var groupHtml=C.groupMessagesReady?msgRows(C.groupMessages,'No messages in this group yet. Start the conversation.'): '<div class="hsub">Loading group messages…</div>';if(ge.innerHTML!==groupHtml){ge.innerHTML=groupHtml;ge.scrollTop=ge.scrollHeight;}}var err=$('hgcGroupError');if(err){err.textContent=C.groupError||'';err.style.display=C.groupError?'block':'none';}}
  async function loadCommunity(){
    if(!userId()||C.publicBusy)return;
    C.publicBusy=true;
    var hadReady=C.publicReady,previous=C.publicMessages.length?C.publicMessages[C.publicMessages.length-1]:null;
    try{
      var r=await supabase.from('hive_messages').select('*').eq('community_id',community()).eq('field',field()).order('created_at',{ascending:false}).limit(80);
      if(r.error)throw r.error;
      var fresh=(r.data||[]).reverse(),latest=fresh.length?fresh[fresh.length-1]:null;
      if(hadReady&&previous&&latest&&String(previous.id||previous.created_at)!==String(latest.id||latest.created_at)&&latest.user_id!==userId()&&window.HIVEUIFX&&HIVEUIFX.play)HIVEUIFX.play('notification');
      C.publicMessages=fresh;C.publicError='';
    }catch(e){C.publicError='Community chat could not load. Check the existing chat table and its access policies.';C.publicMessages=[];}
    C.publicBusy=false;C.publicReady=true;if(S.view==='chat'&&C.mode==='community')paintMessages();
  }
  async function sendCommunity(){var el=$('hgcCommunityInput'),body=(el&&el.value||'').trim().slice(0,500);if(!body||!userId())return;C.sending=true;var r=await supabase.from('hive_messages').insert({community_id:community(),field:field(),user_id:userId(),author:(S.profile&&S.profile.name)||'Member',body:body});C.sending=false;if(r.error){toastMsg('Message was not sent: '+r.error.message);return;}if(el)el.value='';await loadCommunity();}
  function loadGroups(force){
    if(!userId()){
      C.groupsBusy=false;C.groupsReady=true;C.groupsError='Sign in to load group discussions.';
      return Promise.resolve();
    }
    /* A live request is shared; callers never leave a spinner awaiting a separate render. */
    if(groupsPromise)return groupsPromise;
    if(!force&&C.groupsReady&&!C.groupsError)return Promise.resolve();
    var requestUser=String(userId()),requestCommunity=String(community()),requestField=String(field());
    C.groupsBusy=true;C.groupsError='';
    var requestPromise=Promise.resolve().then(async function(){
      try{
        var m=await supabase.from('hive_chat_group_members').select('group_id,role').eq('user_id',requestUser);
        if(m.error)throw m.error;
        var g=await supabase.from('hive_chat_groups').select('*').eq('community_id',requestCommunity).eq('field',requestField).order('created_at',{ascending:false});
        if(g.error)throw g.error;
        if(String(userId())!==requestUser||String(community())!==requestCommunity||String(field())!==requestField)return;
        C.memberships=m.data||[];C.groups=g.data||[];C.groupsError='';
        if(C.selected){var fresh=C.groups.filter(function(x){return String(x.id)===String(C.selected.id);})[0];if(fresh)C.selected=fresh;}
      }catch(e){
        if(String(userId())===requestUser&&String(community())===requestCommunity&&String(field())===requestField){
          C.groupsError='Group discussions could not load. Check the optional hive_group_chat_optional.sql migration, table access policies, and your connection.';
          C.groups=[];C.memberships=[];
        }
      }
    }).finally(function(){
      if(groupsPromise===requestPromise){
        C.groupsBusy=false;C.groupsReady=true;groupsPromise=null;
        /* One completed render for success, empty results, and errors. Errors are not retried
           from the render hook; the user can choose Retry groups explicitly. */
        if(S.view==='chat'&&C.mode==='groups'&&!C.selected)render();
      }
    });
    groupsPromise=requestPromise;
    return requestPromise;
  }
  async function retryGroups(){C.groupsReady=false;C.groupsError='';await loadGroups(true);if(S.view==='chat'&&C.mode==='groups'&&!C.selected)render();}
  async function openGroup(id){
    var g=C.groups.filter(function(x){return String(x.id)===String(id);})[0];
    if(!g){
      /* A stale list should not require the user to refresh the entire app or click twice. */
      await retryGroups();
      g=C.groups.filter(function(x){return String(x.id)===String(id);})[0];
      if(!g){toastMsg('This group is not available in the current community or field.');return;}
    }
    var member=C.memberships.some(function(m){return String(m.group_id)===String(id);})||String(g.created_by)===String(userId());
    if(!member){
      /* Re-check once in case the membership list was stale when the user clicked. */
      await retryGroups();
      g=C.groups.filter(function(x){return String(x.id)===String(id);})[0]||g;
      member=C.memberships.some(function(m){return String(m.group_id)===String(id);})||String(g.created_by)===String(userId());
    }
    if(!member){toastMsg(g.visibility==='public'?'Join this public group before opening it.':'This private group requires an invitation.');return;}
    groupMessageRequest++;C.groupMessagesBusy=false;C.mode='groups';C.selected=g;C.groupMessages=[];C.groupMessagesReady=false;C.groupError='';C.manage=false;
    if(S.view==='chat')render();
    await loadGroupMessages();
  }
  async function joinGroup(id){
    var g=C.groups.filter(function(x){return String(x.id)===String(id);})[0];if(!g||g.visibility!=='public'||!userId())return;
    var r=await supabase.from('hive_chat_group_members').insert({group_id:g.id,user_id:userId(),role:'member'});
    if(r.error&&r.error.code!=='23505'){toastMsg('Could not join group: '+r.error.message);return;}
    if(!C.memberships.some(function(m){return String(m.group_id)===String(g.id);}))C.memberships.push({group_id:g.id,role:'member'});
    groupMessageRequest++;C.groupMessagesBusy=false;C.selected=g;C.mode='groups';C.groupMessages=[];C.groupMessagesReady=false;C.groupError='';C.manage=false;
    if(S.view==='chat')render();
    await loadGroupMessages();
  }
  async function loadGroupMessages(){
    if(!C.selected||!userId()||C.groupMessagesBusy)return;
    var groupId=C.selected.id,request=++groupMessageRequest,hadReady=C.groupMessagesReady,previous=C.groupMessages.length?C.groupMessages[C.groupMessages.length-1]:null;C.groupMessagesBusy=true;C.groupError='';
    try{
      var r=await supabase.from('hive_group_messages').select('id,group_id,user_id,author,body,created_at').eq('group_id',groupId).order('created_at',{ascending:false}).limit(100);
      if(r.error)throw r.error;
      if(request!==groupMessageRequest||!C.selected||String(C.selected.id)!==String(groupId))return;
      var fresh=(r.data||[]).reverse(),latest=fresh.length?fresh[fresh.length-1]:null;
      if(hadReady&&previous&&latest&&String(previous.id||previous.created_at)!==String(latest.id||latest.created_at)&&latest.user_id!==userId()&&window.HIVEUIFX&&HIVEUIFX.play)HIVEUIFX.play('notification');
      C.groupMessages=fresh;
    }catch(e){
      if(request!==groupMessageRequest||!C.selected||String(C.selected.id)!==String(groupId))return;
      C.groupMessages=[];C.groupError='Group messages could not be loaded. Check that the optional group-chat migration and its access policies are installed.';
    }
    if(request!==groupMessageRequest||!C.selected||String(C.selected.id)!==String(groupId))return;
    C.groupMessagesReady=true;C.groupMessagesBusy=false;paintMessages();
  }
  async function sendGroup(){var el=$('hgcGroupInput'),body=(el&&el.value||'').trim().slice(0,500);if(!body||!userId()||!C.selected)return;C.sending=true;var r=await supabase.from('hive_group_messages').insert({group_id:C.selected.id,user_id:userId(),author:(S.profile&&S.profile.name)||'Member',body:body});C.sending=false;if(r.error){toastMsg('Message was not sent: '+r.error.message);return;}if(el)el.value='';await loadGroupMessages();}
  function mode(v){var next=v==='groups'?'groups':'community';groupMessageRequest++;C.groupMessagesBusy=false;C.selected=null;C.groupMessages=[];C.groupMessagesReady=false;C.groupError='';C.manage=false;C.mode=next;if(C.mode==='groups'){C.groupsReady=false;C.groupsError='';loadGroups(true);}if(window.HIVEUIFX&&HIVEUIFX.play)HIVEUIFX.play('tap');render();if(C.mode==='community')loadCommunity();}
  function openCreate(){C.modal=true;render();}
  function closeCreate(){C.modal=false;render();}
  async function createGroup(){var name=($('hgcName')&&$('hgcName').value||'').trim(),description=($('hgcDescription')&&$('hgcDescription').value||'').trim(),vis=(document.querySelector('input[name="hgcVisibility"]:checked')||{}).value||'public';if(name.length<3){toastMsg('Use a group name with at least 3 characters.');return;}if(!userId())return;var r=await supabase.from('hive_chat_groups').insert({name:name,description:description,visibility:vis,created_by:userId(),community_id:community(),field:field()}).select('*').single();if(r.error){toastMsg('Group not created. Run the optional hive_group_chat_optional.sql migration and check its policies.');return;}groupMessageRequest++;C.groupMessagesBusy=false;C.groupMessages=[];C.groupMessagesReady=false;C.groupError='';C.modal=false;C.mode='groups';C.selected=r.data;C.groupsReady=false;C.groupsError='';await loadGroups();C.selected=C.groups.filter(function(g){return String(g.id)===String(r.data.id);})[0]||r.data;C.groupMessages=[];C.groupMessagesReady=false;C.groupMessagesBusy=false;await loadGroupMessages();render();}
  async function manageMembers(){if(!C.selected||C.selected.created_by!==userId())return;C.manage=true;C.groupMembers=[];C.membersError='';var r=await supabase.from('hive_chat_group_members').select('user_id,role,joined_at').eq('group_id',C.selected.id).order('joined_at',{ascending:true});if(r.error){C.membersError='Could not load group members with the current database permissions.';render();return;}var ids=(r.data||[]).map(function(x){return x.user_id;}).filter(Boolean),roles={};(r.data||[]).forEach(function(x){roles[x.user_id]=x.role;});if(ids.length){var p=await supabase.from('profiles').select('id,name,email,roll_no').in('id',ids);if(p.error)C.membersError='The membership records are available, but profile details are restricted.';else C.groupMembers=(p.data||[]).map(function(x){x.role=roles[x.id]||'member';return x;});}render();}
  async function inviteMember(){if(!C.selected||C.selected.created_by!==userId())return;var raw=($('hgcInviteEmail')&&$('hgcInviteEmail').value||'').trim().toLowerCase();if(!raw){toastMsg('Enter a HIVE username or email.');return;}var r=await supabase.rpc('hive_invite_group_member',{p_group_id:C.selected.id,p_username_or_email:raw});if(r.error){toastMsg('Invite was not added. Check the optional group-chat migration and the username/email.');return;}toastMsg('Member added to the group.');await manageMembers();}
  function closeManage(){C.manage=false;render();}
  function backGroups(){groupMessageRequest++;C.groupMessagesBusy=false;C.selected=null;C.groupMessages=[];C.groupMessagesReady=false;C.groupError='';C.manage=false;loadGroups(true);render();}
  function after(){if(typeof originalAfter==='function')originalAfter();if(!userId())return;if(S.view==='chat'){if(C.mode==='community')loadCommunity();else if(C.selected)loadGroupMessages();else if(!C.groupsReady)loadGroups();}}
  window.HIVE.screens.chat=screen;
  window.HIVE.after=after;
  window.HIVEGROUPCHAT={mode:mode,sendCommunity:sendCommunity,openCreate:openCreate,closeCreate:closeCreate,createGroup:createGroup,openGroup:openGroup,joinGroup:joinGroup,sendGroup:sendGroup,backGroups:backGroups,manageMembers:manageMembers,inviteMember:inviteMember,closeManage:closeManage,retryGroups:retryGroups};
  setInterval(function(){if(!document.hidden&&userId()&&S.view==='chat'){if(C.mode==='community')loadCommunity();else if(C.selected)loadGroupMessages();}},8000);
})();
