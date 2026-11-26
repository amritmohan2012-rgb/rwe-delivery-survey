(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=n=>Number(n||0).toLocaleString('en-IN');
const pct=(a,b)=>b?(Math.round(a*1000/b)/10).toFixed(1).replace(/\.0$/,'')+'%':'0%';
const ls={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};

/* ---------- RWE list and villages (loaded from rwe-data.json) ---------- */
const CT=['NC','A','B','C1','C2'];
const CN=['Not categorised','A','B','C1','C2'];
const PRI=[1,2,3,4,0];
let DIST=[],MATS=[],STATES=[],PROFS=[],ROS=[],NAMES={},PM=new Map(),VILL=[],VBYD=[],READY=false;
const rkey=(d,id)=>d+':'+id;
const vkey=(d,v)=>d+'|'+String(v||'').trim().toLowerCase().replace(/\s+/g,' ');
const matName=i=>i>=0&&MATS[i]?MATS[i].n:'Not mapped to a MAT';
const nameOf=(d,id)=>{const n=NAMES[rkey(d,id)];return n?n[0]:''};
const vilOf=(d,id)=>{const n=NAMES[rkey(d,id)];return n?{v:n[1]||'',b:n[2]||''}:{v:'',b:''}};
const profLabel=r=>{const m=PM.get(r[0]+':'+r[1])||0;return PROFS.filter((_,i)=>(m>>i)&1).join(' + ')};
function prepare(D){
  DIST=D.dist;MATS=D.mats;STATES=D.states;PROFS=D.profs;NAMES=D.names;
  PM=new Map(D.roster.map(r=>[r[0]+':'+r[1],r[4]|0]));
  ROS=D.roster.slice().sort((a,b)=>PRI.indexOf(a[2])-PRI.indexOf(b[2])||a[0]-b[0]||a[1]-b[1]);
  const vm=new Map();
  for(const k in NAMES){const n=NAMES[k];if(!n[1])continue;const d=+k.split(':')[0];const key=vkey(d,n[1]);let x=vm.get(key);
    if(!x){x={d,v:n[1].trim(),b:(n[2]||'').trim(),n:0,key};vm.set(key,x)}x.n++}
  VILL=[...vm.values()].sort((a,b)=>a.d-b.d||a.v.localeCompare(b.v));
  VBYD=DIST.map((_,i)=>VILL.filter(v=>v.d===i));
  READY=true;
}

/* ---------- survey definition ---------- */
const O=(v,en,hi)=>({v,en,hi});
const OTHER=(en,hi)=>({v:'other',en,hi,other:true});
const MEESHO_ROLE=a=>['current','past'].includes(a.S_meesho);
const QS=[
 {id:'S_meesho',kind:'single',req:true,en:'Are you a Meesho reseller?',hi:'क्या आप Meesho पर रीसेलर हैं?',opts:[
  O('current','Yes, I sell on Meesho now','हाँ, मैं अभी Meesho पर बेचती हूँ'),
  O('past','Yes, but I have stopped','हाँ, पहले बेचती थी, अब बंद कर दिया'),
  O('no_sale','I signed up but never made a sale','रजिस्टर किया था, पर कभी बिक्री नहीं हुई'),
  O('heard','I know of Meesho but have never tried it','Meesho के बारे में पता है, पर कभी इस्तेमाल नहीं किया'),
  O('unaware','I have not heard of Meesho','Meesho के बारे में नहीं सुना')]},
 {id:'S_duration',kind:'single',en:'How long have you been selling (or did you sell) on Meesho?',hi:'आप Meesho पर कितने समय से बेच रही हैं (या बेचती थीं)?',show:MEESHO_ROLE,opts:[
  O('lt3','Under 3 months','3 महीने से कम'),O('3to6','3 to 6 months','3 से 6 महीने'),O('6to12','6 to 12 months','6 से 12 महीने'),O('gt12','More than a year','1 साल से ज़्यादा')]},
 {id:'S_orders',kind:'single',en:'Roughly how many orders did you get in the last month?',hi:'पिछले महीने लगभग कितने ऑर्डर मिले?',show:MEESHO_ROLE,opts:[
  O('0','None','कोई नहीं'),O('1to5','1 to 5','1 से 5'),O('6to20','6 to 20','6 से 20'),O('gt20','More than 20','20 से ज़्यादा')]},
 {id:'S_earn',kind:'single',en:'About how much did you earn from Meesho last month?',hi:'पिछले महीने Meesho से लगभग कितनी कमाई हुई?',show:MEESHO_ROLE,opts:[
  O('none','Nothing','कुछ नहीं'),O('lt500','Under ₹500','₹500 से कम'),O('500to2000','₹500 to ₹2,000','₹500 से ₹2,000'),O('2000to5000','₹2,000 to ₹5,000','₹2,000 से ₹5,000'),O('gt5000','More than ₹5,000','₹5,000 से ज़्यादा'),O('nosay','Prefers not to say','बताना नहीं चाहतीं')]},
 {id:'S_rating',kind:'single',numeric:true,en:'Overall, how has selling on Meesho gone for you?',hi:'कुल मिलाकर Meesho पर बेचने का आपका अनुभव कैसा रहा?',show:MEESHO_ROLE,opts:[
  O('1','1 – Very poor','1 – बहुत खराब'),O('2','2 – Poor','2 – खराब'),O('3','3 – Okay','3 – ठीक-ठाक'),O('4','4 – Good','4 – अच्छा'),O('5','5 – Very good','5 – बहुत अच्छा')]},
 {id:'S_problems',kind:'multi',en:'What problems have you faced? (select all that apply)',hi:'आपको क्या-क्या दिक्कतें आईं? (जितनी लागू हों चुनें)',show:MEESHO_ROLE,opts:[
  O('returns','Returns or cancelled orders','रिटर्न या कैंसिल हुए ऑर्डर'),
  O('delivery','Parcels late or not reaching the village','पार्सल देर से आना या गाँव तक न पहुँचना'),
  O('payment','Delayed or unclear payments','पेमेंट में देरी या अस्पष्टता'),
  O('cash','Customers prefer cash and do not trust online','ग्राहक नकद पसंद करते हैं, ऑनलाइन पर भरोसा नहीं'),
  O('quality','Product quality or mismatch complaints','प्रोडक्ट की क्वालिटी या फ़र्क की शिकायत'),
  O('app','App is hard to use','ऐप इस्तेमाल करना मुश्किल'),
  O('demand','Low demand in my village','गाँव में माँग कम'),
  O('none','No problems','कोई दिक्कत नहीं'),OTHER('Other','कुछ और')]},
 {id:'S_continue',kind:'single',en:'Do you plan to keep selling on Meesho over the next 6 months?',hi:'क्या आप अगले 6 महीने Meesho पर बेचना जारी रखेंगी?',show:a=>a.S_meesho==='current',opts:[
  O('yes','Yes','हाँ'),O('unsure','Not sure','पक्का नहीं'),O('no','No','नहीं')]},
 {id:'S_stopwhy',kind:'text',en:'What was the main reason you stopped?',hi:'बंद करने का मुख्य कारण क्या था?',show:a=>a.S_meesho==='past'},

 {id:'H_online',kind:'single',req:true,en:'In the last 6 months, have you ordered anything online on a phone app?',hi:'पिछले 6 महीनों में क्या आपने फ़ोन ऐप से कुछ ऑनलाइन मँगवाया?',opts:[O('yes','Yes','हाँ'),O('no','No','नहीं')]},
 {id:'H_platforms',kind:'multi',en:'Which apps or sources did you use? (select all that apply)',hi:'किन ऐप या ज़रिए से मँगवाया? (जितने लागू हों चुनें)',show:a=>a.H_online==='yes',opts:[
  O('meesho','Meesho','Meesho'),O('flipkart','Flipkart or Shopsy','Flipkart या Shopsy'),O('amazon','Amazon','Amazon'),
  O('saheli','Through a Saheli or local reseller','गाँव की सहेली या रीसेलर के ज़रिए'),OTHER('Other','कुछ और')]},
 {id:'H_reseller',kind:'single',en:'Have you ever bought from a Meesho reseller in your village?',hi:'क्या आपने कभी अपने गाँव की किसी Meesho रीसेलर से खरीदा है?',opts:[O('yes','Yes','हाँ'),O('no','No','नहीं')]},

 {id:'D_delivery',kind:'multi',req:true,en:'Where do you get parcels or goods delivered today, if at all? (select all that apply)',hi:'आज आपके पार्सल या सामान कैसे पहुँचते हैं, अगर पहुँचते हैं? (जितने लागू हों चुनें)',opts:[
  O('none','Nothing reaches my home; I have to go and collect it','घर तक कुछ नहीं आता, खुद लेने जाना पड़ता है'),
  O('courier','A courier or delivery person brings it to my home','कूरियर या डिलीवरी वाला घर तक देता है'),
  O('shop','I collect it from a local shop or kirana','पास की दुकान या किराना से लेना पड़ता है'),
  O('town','I collect it from the block or town','ब्लॉक या शहर से लेना पड़ता है'),
  O('post','India Post','इंडिया पोस्ट (डाकिया)'),
  O('saheli','A Saheli or another woman in the village delivers it','गाँव की सहेली या कोई और महिला पहुँचाती है'),
  OTHER('Other','कुछ और')]},
 {id:'D_unaided',kind:'text',hint:'Ask without naming any service. Write down what she says. Leave blank if none.',en:'Which services do you know of that bring goods to villages?',hi:'गाँवों तक सामान पहुँचाने वाली कौन-सी सेवाएँ आप जानती/जानते हैं?'},
 {id:'D_elastic',kind:'single',req:true,en:'Have you heard of ElasticRun?',hi:'क्या आपने ElasticRun के बारे में सुना है?',opts:[O('no','Have not heard of it','नहीं सुना'),O('heard','Have heard of it','सुना है'),O('used','Have used its service','इसकी सेवा इस्तेमाल की है')]},
 {id:'D_blitz',kind:'single',req:true,en:'Have you heard of Blitz?',hi:'क्या आपने Blitz के बारे में सुना है?',opts:[O('no','Have not heard of it','नहीं सुना'),O('heard','Have heard of it','सुना है'),O('used','Have used its service','इसकी सेवा इस्तेमाल की है')]},
 {id:'H_interest',kind:'single',en:'If a woman from your village delivered orders to your door, would you use it?',hi:'अगर गाँव की कोई महिला आपके दरवाज़े तक सामान पहुँचाए, तो क्या आप इसका इस्तेमाल करेंगे/करेंगी?',opts:[O('yes','Yes','हाँ'),O('maybe','Maybe','शायद'),O('no','No','नहीं')]}
];
const QM={};QS.forEach(q=>QM[q.id]=q);
const GROUPS={
  rwe:[['Meesho selling',['S_meesho','S_duration','S_orders','S_earn','S_rating','S_problems','S_continue','S_stopwhy']],['Deliveries and awareness',['D_delivery','D_unaided','D_elastic','D_blitz']]],
  hh:[['Online ordering',['H_online','H_platforms','H_reseller']],['Deliveries, awareness and interest',['D_delivery','D_unaided','D_elastic','D_blitz','H_interest']]]
};
const KINDS={rwe:'RWE (Saheli)',hh:'Household'};
const OUT=[['done','Spoke: survey completed'],['partial','Spoke: call back later'],['noans','No answer'],['off','Switched off / not reachable'],['wrong','Wrong or invalid number'],['declined','Declined to answer']];
const OUTN=Object.fromEntries(OUT);
const STL={none:'Not called',done:'Surveyed',partial:'Call back',noans:'No answer',off:'Unreachable',wrong:'Wrong number',declined:'Declined'};
const STC={none:'',done:'ok',partial:'cb',noans:'bad',off:'bad',wrong:'bad',declined:'bad'};
const pill=s=>`<span class="pill ${STC[s]}">${STL[s]}</span>`;
const fmtDT=iso=>{if(!iso)return '';const d=new Date(iso);if(isNaN(d))return '';return d.toLocaleString('en-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit',hour12:true,timeZone:'Asia/Kolkata'})};
const hasAns=(q,a)=>{const v=a[q.id];return q.kind==='multi'?Array.isArray(v)&&v.length>0:(v!=null&&String(v).trim()!=='')};
const visQ=(q,a)=>!q.show||q.show(a);
function ansText(q,a){
  const v=a[q.id];if(q.kind==='text')return v;
  const lab=x=>{const o=q.opts.find(o=>o.v===x);return o?o.en:x};
  if(q.kind==='single')return lab(v);
  return v.map(x=>x==='other'&&a[q.id+'_other']?'Other: '+a[q.id+'_other']:lab(x)).join(', ');
}

/* ---------- state ---------- */
const ROLE=window.ROLE==='admin'?'admin':'form';
const ALLOWED=ROLE==='admin'?['tracker','results']:['form'];
let fdb=null,fauth=null,FV=null;
const S={tab:ALLOWED[0],mode:'rwe',caller:ls.get('rwe-caller')||'',team:(()=>{try{return JSON.parse(ls.get('dds-team'))||[]}catch(e){return []}})(),calls:[],gotCalls:false,conn:'connecting',user:'',err:'',sel:null,draft:null,
  q:{state:'',dist:'',mat:'',cat:'',shop:'',st:'todo',s:'',n:40},
  F:{state:'',dist:'',type:'',by:'',o:'',s:''},tpage:0,
  R:{state:'',dist:'',type:'rwe',by:''}};
let RS=new Map(),HVm=new Map();const STAT=new Map();const hk=k=>k.replace(/[\/.~*\[\]%\s]+/g,'_');
let toastH=0;
function toast(m,ms=2600){const t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(toastH);toastH=setTimeout(()=>t.hidden=true,ms)}

/* team lead view: build per-RWE and per-village status from the full call log */
function rebuildFromCalls(){
  const sorted=S.calls.slice().sort((a,b)=>a.t<b.t?-1:a.t>b.t?1:0);
  RS=new Map();HVm=new Map();
  for(const c of sorted){
    if(c.kind==='rwe'){const k=rkey(c.d,c.id);const x=RS.get(k)||{st:'',n:0,sv:0,t:0};x.n++;x.st=c.o;if(c.o==='done')x.sv=1;x.t=c.t;RS.set(k,x)}
    else{const k=hk(vkey(c.d,c.vil));const x=HVm.get(k)||{calls:0,done:0};x.calls++;if(c.o==='done')x.done++;HVm.set(k,x)}
  }
}
/* caller view: status comes from small status documents (no answers), one per district plus one for households */
function rebuildFromStatus(){
  RS=new Map();HVm=new Map();
  for(const [key,o] of STAT){
    if(key==='hh'){for(const k in o){const x=o[k]||{};HVm.set(k,{calls:+x.n||0,done:+x.dn||0})}}
    else{const d=+key.slice(1);for(const id in o){const x=o[id]||{};RS.set(rkey(d,id),{st:x.st||'',n:+x.n||0,sv:x.sv?1:0,t:x.t||0})}}
  }
}
function statusOf(k){
  const x=RS.get(k);if(!x||!(x.n||x.st))return 'none';
  return x.sv?'done':(x.st||'none');
}

/* ---------- geo filters ---------- */
function distIdxs(state){return DIST.map((d,i)=>i).filter(i=>state===''||DIST[i].s===+state)}
function opts(sel,items,val){sel.innerHTML=items.map(([v,l])=>`<option value="${esc(v)}">${esc(l)}</option>`).join('');sel.value=val}
function fillGeo(F,ids){
  const st=$(ids.state),di=$(ids.dist);
  opts(st,[['','All states'],...STATES.map((s,i)=>[String(i),s])],F.state);
  const dl=distIdxs(F.state);
  if(F.dist!==''&&!dl.includes(+F.dist))F.dist='';
  opts(di,[['','All districts'],...dl.map(i=>[String(i),DIST[i].n])],F.dist);
  if(ids.mat){
    const ma=$(ids.mat);
    const ml=MATS.map((m,i)=>i).filter(i=>(F.dist!==''?MATS[i].d===+F.dist:dl.includes(MATS[i].d)));
    if(F.mat!==''&&!ml.includes(+F.mat))F.mat='';
    opts(ma,[['','All MATs'],...ml.map(i=>[String(i),MATS[i].n])],F.mat);
  }
}
function profOk(r,f){if(!f)return true;const m=PM.get(r[0]+':'+r[1])||0;return f==='_none'?m===0:((m>>(+f))&1)===1}
const shopOpts=()=>[['','All profiles'],...PROFS.map((n,i)=>[String(i),n]),['_none','No profile in the RWE sheet']];
function inScope(r,F){
  if(F.state!==''&&DIST[r[0]].s!==+F.state)return false;
  if(F.dist!==''&&r[0]!==+F.dist)return false;
  if(F.mat!==''&&r[3]!==+F.mat)return false;
  if(F.cat!==''&&r[2]!==+F.cat)return false;
  return true;
}

/* ---------- connection and role ---------- */
function importBar(){
  const el=$('#importbar');let h='';
  const q=' quiet';
  if(S.conn==='setup')h='<div class="banner"><b>Not connected yet.</b> Open config.js, paste your Firebase web app config, then reload.</div>';
  else if(ROLE==='admin'){
    if(S.conn==='signin')h='<div class="banner'+q+'"><b>Team lead sign-in.</b> Sign in with your Google account to see the tracker and results. <button class="btn pri sm" id="ib-sign">Sign in with Google</button></div>';
    else if(S.conn==='denied')h='<div class="banner"><b>This Google account is not allowed to see the data.</b> Sign in with an account on the team lead list. <button class="btn sm" id="ib-sign">Sign in with another account</button></div>';
    else if(S.conn==='live')h='<div class="banner'+q+'"><b>Live.</b> '+num(S.calls.length)+' calls so far. This page updates as callers save. '+(S.user?'Signed in as '+esc(S.user)+'.':'')+' <button class="btn sm" id="ib-out">Sign out</button></div>';
    else if(S.conn==='error')h='<div class="banner"><b>Could not connect.</b> Check the internet connection and reload. '+esc(S.err)+'</div>';
    else h='<div class="banner'+q+'">Connecting…</div>';
  }else{
    if(S.conn==='live')h='<div class="banner'+q+'"><b>Connected.</b> Every call you save goes straight to the team lead\'s dashboard.'+(navigator.onLine?'':' You are offline: calls will upload when the connection returns.')+'</div>';
    else if(S.conn==='error')h='<div class="banner"><b>Could not connect.</b> Check the internet connection and reload. '+esc(S.err)+'</div>';
    else h='<div class="banner'+q+'">Connecting…</div>';
  }
  el.innerHTML=h;
  const sg=$('#ib-sign');if(sg)sg.onclick=()=>{const p=new firebase.auth.GoogleAuthProvider();p.setCustomParameters({prompt:'select_account'});fauth.signInWithPopup(p).catch(()=>toast('Sign-in did not finish'))};
  const so=$('#ib-out');if(so)so.onclick=()=>fauth.signOut();
}
function applyRole(){
  $$('#tabs button[data-t]').forEach(b=>b.hidden=ALLOWED.indexOf(b.dataset.t)<0);
  const w=$('.who');if(w&&ROLE==='admin')w.hidden=true;
  $('.mast p').textContent=ROLE==='admin'?'Live tracker and results from the call centre':'Call centre form for the Meesho and doorstep delivery survey';
}

/* ---------- caller selector ---------- */
function renderWho(){
  const sel=$('#who');
  const names=[...new Set([...S.team,...S.calls.map(c=>c.by).filter(Boolean),...(S.caller?[S.caller]:[])])].sort((a,b)=>a.localeCompare(b));
  sel.innerHTML=`<option value="">Select your name</option>`+names.map(n=>`<option>${esc(n)}</option>`).join('')+`<option value="__new">+ Add my name…</option>`;
  sel.value=S.caller||'';
}
$('#who').addEventListener('change',e=>{
  const v=e.target.value;
  if(v==='__new'){
    $('#banner').innerHTML=`<div class="banner"><label class="fld" style="max-width:340px">Your name<input id="newname" autocomplete="off" maxlength="40"></label> <button class="btn pri sm" id="addname">Add</button> <button class="btn sm" id="cancelname">Cancel</button></div>`;
    $('#newname').focus();
    const done=()=>{
      const n=$('#newname').value.trim().replace(/\s+/g,' ');
      $('#banner').innerHTML='';
      if(n){S.caller=n;ls.set('rwe-caller',n);if(!S.team.some(x=>x.toLowerCase()===n.toLowerCase())){S.team.push(n);ls.set('dds-team',JSON.stringify(S.team))}}
      renderWho();if(S.tab==='form')renderSheet(true);
    };
    $('#addname').onclick=done;$('#cancelname').onclick=()=>{$('#banner').innerHTML='';renderWho()};
    $('#newname').addEventListener('keydown',ev=>{if(ev.key==='Enter')done()});
    return;
  }
  S.caller=v;ls.set('rwe-caller',v);if(S.tab==='form')renderSheet(true);
});

/* ---------- tabs ---------- */
function setTab(t){
  if(!['form','tracker','results'].includes(t))t='form';
  if(ALLOWED.indexOf(t)<0)t=ALLOWED[0];
  S.tab=t;
  $$('#tabs button[data-t]').forEach(b=>b.setAttribute('aria-selected',b.dataset.t===t?'true':'false'));
  ['form','tracker','results'].forEach(x=>$('#v-'+x).classList.toggle('on',x===t));
  if(location.hash.slice(1)!==t)history.replaceState(null,'','#'+t);
  render();
}
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('button[data-t]');if(b)setTab(b.dataset.t)});
window.addEventListener('hashchange',()=>{const t=location.hash.slice(1);if(t&&t!==S.tab)setTab(t)});
function render(fromData){
  if(!READY){
    $('#q-list').innerHTML=`<div class="empty" style="margin:12px">Loading the RWE list…</div>`;
    return;
  }
  if(S.tab==='form'){if(!fromData)qfInit();renderQueue();if(!fromData)renderSheet()}
  else if(S.tab==='tracker')renderTracker(!fromData);
  else renderResults(!fromData);
}

/* ======================================================================
   CALL FORM
   ====================================================================== */
function qfInit(){
  const Q=S.q,rwe=S.mode==='rwe';
  fillGeo(Q,{state:'#q-state',dist:'#q-dist',mat:'#q-mat'});
  opts($('#q-cat'),[['','All categories'],...PRI.map(c=>[String(c),c?('Category '+CT[c]):'Not categorised'])],Q.cat);
  opts($('#q-shop'),shopOpts(),Q.shop);
  if(rwe)opts($('#q-st'),[['todo','Still to call'],['cb','Call back due'],['bad','Unreachable'],['done','Surveyed'],['all','Everyone']],Q.st);
  else opts($('#q-st'),[['all','All villages'],['none','No household survey yet'],['done','Has household surveys']],Q.st);
  $$('.qf [data-for=rwe]').forEach(x=>x.hidden=!rwe);
  $('#q-slab').textContent=rwe?'Find by RWE ID or name':'Find a village';
  $('#q-s').placeholder=rwe?'e.g. 2019022':'e.g. Mundpuri';
  $('#q-s').value=Q.s;
  $$('#mode button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.m===S.mode)));
}
['q-state','q-dist','q-mat','q-cat','q-st','q-shop'].forEach(id=>$('#'+id).addEventListener('change',e=>{
  const k={'q-state':'state','q-dist':'dist','q-mat':'mat','q-cat':'cat','q-st':'st','q-shop':'shop'}[id];
  S.q[k]=e.target.value;S.q.n=40;
  if(k==='state'){S.q.dist='';S.q.mat=''}if(k==='dist')S.q.mat='';
  qfInit();renderQueue();
}));
$('#q-s').addEventListener('input',e=>{S.q.s=e.target.value.trim();S.q.n=40;renderQueue()});
$('#mode').addEventListener('click',e=>{
  const b=e.target.closest('button[data-m]');if(!b||b.dataset.m===S.mode)return;
  S.mode=b.dataset.m;S.sel=null;S.draft=null;S.q.n=40;S.q.s='';
  S.q.st=S.mode==='rwe'?'todo':'all';
  qfInit();renderQueue();renderSheet(true);
});

function queueRows(){
  const Q=S.q,s=Q.s.toLowerCase(),out=[];
  if(S.mode==='rwe'){
    for(const r of ROS){
      if(!inScope(r,Q))continue;
      const k=rkey(r[0],r[1]),st=statusOf(k);
      if(Q.st==='todo'&&!(st==='none'||st==='partial'||st==='noans'))continue;
      if(Q.st==='cb'&&st!=='partial')continue;
      if(Q.st==='bad'&&!(st==='noans'||st==='off'||st==='wrong'||st==='declined'))continue;
      if(Q.st==='done'&&st!=='done')continue;
      if(!profOk(r,Q.shop))continue;
      if(s){const nm=nameOf(r[0],r[1]).toLowerCase();if(!(String(r[1]).includes(s)||nm.includes(s)))continue}
      out.push([r,k,st]);
    }
  }else{
    for(const v of VILL){
      if(Q.state!==''&&DIST[v.d].s!==+Q.state)continue;
      if(Q.dist!==''&&v.d!==+Q.dist)continue;
      const h=HVm.get(hk(v.key))||{calls:0,done:0};
      if(Q.st==='none'&&h.done)continue;
      if(Q.st==='done'&&!h.done)continue;
      if(s&&!(v.v.toLowerCase().includes(s)||v.b.toLowerCase().includes(s)))continue;
      out.push([v,v.key,h]);
    }
  }
  return out;
}
function renderQueue(){
  if(!READY)return;
  const rows=queueRows(),Q=S.q,shown=rows.slice(0,Q.n),rwe=S.mode==='rwe';
  $('#q-meta').textContent=rwe?`${num(rows.length)} RWEs match. Highest category first (A, B, C1, C2, then not categorised).`
    :`${num(rows.length)} villages match. Pick a village, then call a household there.`;
  const list=$('#q-list');
  if(!rows.length){list.innerHTML=`<div class="empty" style="margin:12px">${rwe?'No RWEs match these filters.':'No villages match these filters.'}</div>`;return}
  if(rwe){
    list.innerHTML=shown.map(([r,k,st])=>{
      const nm=nameOf(r[0],r[1])||('RWE '+r[1]);const v=vilOf(r[0],r[1]).v;const at=(RS.get(k)||{}).n||0;
      const pf=profLabel(r);
      return `<button class="qi" data-k="${k}" ${S.sel===k?'aria-current="true"':''}><span class="ctag c${r[2]}">${CT[r[2]]}</span><span class="n">${esc(nm)}</span><span class="st">${pill(st)}${at?`<div class="s" style="text-align:right">${at} ${at===1?'call':'calls'}</div>`:''}</span><span class="s">ID ${r[1]} · ${esc(v||DIST[r[0]].n)}${pf?' · '+esc(pf):''}</span></button>`;
    }).join('');
  }else{
    list.innerHTML=shown.map(([v,k,h])=>
      `<button class="qi" data-k="${esc(k)}" ${S.sel===k?'aria-current="true"':''}><span class="ctag c0">${h.done}</span><span class="n">${esc(v.v)}</span><span class="st">${h.done?`<span class="pill ok">${h.done} surveyed</span>`:pill('none')}</span><span class="s">${esc(v.b?v.b+' · ':'')}${esc(DIST[v.d].n)} · ${v.n} RWEs on the list</span></button>`).join('');
  }
  if(rows.length>shown.length)list.insertAdjacentHTML('beforeend',`<div class="qmore"><button class="btn sm" id="q-more">Show 40 more</button></div>`);
  const mb=$('#q-more');if(mb)mb.onclick=()=>{Q.n+=40;renderQueue()};
}
$('#q-list').addEventListener('click',e=>{const b=e.target.closest('.qi');if(!b)return;select(b.dataset.k)});
function select(k){
  S.sel=k;
  if(S.mode==='rwe'){
    const [d,id]=k.split(':').map(Number);
    const r=ROS.find(x=>x[0]===d&&x[1]===id);if(!r)return;
    S.draft=newDraft('rwe',r,null);
  }else{
    const v=VILL.find(x=>x.key===k);if(!v)return;
    S.draft=newDraft('hh',null,v);
  }
  renderQueue();renderSheet(true);
  const sh=$('#sheet');if(window.innerWidth<900)sh.scrollIntoView({block:'start',behavior:'smooth'});
}
function newDraft(kind,r,v){
  if(kind==='rwe'){const vl=vilOf(r[0],r[1]);return {kind,d:r[0],id:r[1],c:r[2],m:r[3],nm:nameOf(r[0],r[1]),ph:'',vil:vl.v,blk:vl.b,o:'',cons:false,a:{},rem:'',cb:''}}
  return {kind,d:v.d,id:0,c:0,m:-1,nm:'',ph:'',vil:v.v,blk:v.b,o:'',cons:false,a:{},rem:'',cb:''};
}

function qHtml(q,dr){
  const on=(v)=>q.kind==='multi'?(dr.a[q.id]||[]).includes(v):dr.a[q.id]===v;
  let h=`<div class="qb" data-q="${q.id}" ${visQ(q,dr.a)?'':'hidden'}><div class="qq">${esc(q.en)}<small>${esc(q.hi)}</small>${q.hint?`<small class="cue">${esc(q.hint)}</small>`:''}</div>`;
  if(q.kind==='text')h+=`<textarea data-t="${q.id}" rows="2" maxlength="300">${esc(dr.a[q.id]||'')}</textarea>`;
  else{
    h+=`<div class="chips" data-q="${q.id}">`+q.opts.map(o=>`<button type="button" class="chip" data-o="${o.v}" aria-pressed="${on(o.v)}"><span>${esc(o.en)}</span><small>${esc(o.hi)}</small></button>`).join('')+`</div>`;
    if(q.opts.some(o=>o.other))h+=`<input type="text" data-ot="${q.id}" maxlength="80" placeholder="Please specify" value="${esc(dr.a[q.id+'_other']||'')}" ${(dr.a[q.id]||[]).includes('other')?'':'hidden'}>`;
  }
  return h+'</div>';
}
function renderSheet(force){
  const el=$('#sheet');
  if(!S.sel||!S.draft){
    el.innerHTML=`<div class="empty"><b>${S.mode==='rwe'?'Pick an RWE from the list to start a call.':'Pick a village from the list to start a household call.'}</b><br>Choose your name at the top right first, so every call is recorded against you.${S.mode==='rwe'?' RWEs in category A come first.':''}</div>`;
    el.dataset.k='';return;
  }
  if(!force&&el.dataset.k===S.sel)return;
  el.dataset.k=S.sel;
  const dr=S.draft,rwe=dr.kind==='rwe',full=dr.o==='done'||dr.o==='partial';
  const k=rwe?rkey(dr.d,dr.id):vkey(dr.d,dr.vil);
  const hv=HVm.get(hk(k))||{calls:0,done:0};
  const st=rwe?statusOf(k):(hv.done?'done':'none');
  const rs=rwe?(RS.get(k)||{n:0}):{n:0};
  const head=rwe
   ?`<div><h2>${esc(dr.nm||('RWE '+dr.id))}</h2><div class="meta">RWE ID ${dr.id} · ${esc(DIST[dr.d].n)}, ${esc(STATES[DIST[dr.d].s])} · MAT: ${esc(matName(dr.m))}${dr.vil?' · '+esc(dr.vil):''}</div></div>
      <div><span class="ctag c${dr.c}" style="grid-row:auto">${dr.c?'Category '+CT[dr.c]:'Not categorised'}</span> ${pill(st)}</div>`
   :`<div><h2>${esc(dr.vil)}</h2><div class="meta">Household call · ${esc(dr.blk?dr.blk+' · ':'')}${esc(DIST[dr.d].n)}, ${esc(STATES[DIST[dr.d].s])}</div></div>
      <div><span class="ctag c0" style="grid-row:auto">HH</span> <span class="pill ${hv.done?'ok':''}">${hv.done} household ${hv.done===1?'survey':'surveys'} saved</span></div>`;
  const groups=GROUPS[dr.kind].map(([title,ids],gi)=>`<div class="sec"><h3>${gi+2}. ${esc(title)}</h3>${ids.map(id=>qHtml(QM[id],dr)).join('')}</div>`).join('');
  el.innerHTML=`
  <div class="sheet">
    <div class="sh">${head}</div>
    <div class="sb">
      ${rs.n?`<div class="note" style="margin:0">Called ${rs.n} ${rs.n===1?'time':'times'} so far. Last outcome: ${esc(STL[st]||st)}.${st==='done'?' A survey is already saved; saving again adds another record.':''}</div>`:''}
      <details class="script"><summary>Opening script and consent / शुरुआती स्क्रिप्ट</summary><div>
        <p>Namaste, I am calling from Frontier Markets. We are running a short survey (about 5 minutes) on online shopping and delivery in villages. Your answers are used only for our study and you can stop at any time. May I continue?</p>
        <p class="hi">नमस्ते, मैं फ्रंटियर मार्केट्स से बोल रही/रहा हूँ। हम गाँवों में ऑनलाइन खरीदारी और डिलीवरी पर एक छोटा सर्वे कर रहे हैं (लगभग 5 मिनट)। आपके जवाब सिर्फ़ हमारे अध्ययन के लिए इस्तेमाल होंगे और आप कभी भी रोक सकते हैं। क्या मैं आगे बढ़ूँ?</p>
      </div></details>
      <div class="sec"><h3>1. How did the call go?</h3>
        <div class="seg" id="f-out" role="group" aria-label="Call outcome">${OUT.map(([v,l])=>`<button type="button" data-v="${v}" aria-pressed="${dr.o===v}">${esc(l)}</button>`).join('')}</div>
      </div>
      <div class="row2">
        <label class="fld">${rwe?'RWE name':'Respondent name (optional)'}<input id="f-nm" value="${esc(dr.nm)}" maxlength="60" autocomplete="off" placeholder="${rwe?'Name as the RWE says it':'Name as she or he says it'}"></label>
        <label class="fld">Phone number dialled (optional)<input id="f-ph" value="${esc(dr.ph)}" inputmode="tel" maxlength="20" autocomplete="off"></label>
        <label class="fld">Village<input id="f-vil" value="${esc(dr.vil)}" maxlength="60" autocomplete="off" list="vl" placeholder="Start typing the village"${rwe?'':' readonly'}></label>
      </div>
      <datalist id="vl">${(VBYD[dr.d]||[]).map(v=>`<option value="${esc(v.v)}">${esc(v.b)}</option>`).join('')}</datalist>
      <div id="f-more" ${full?'':'hidden'}>
        <div class="sb" style="padding:0">
          <label class="agree" for="f-cons"><input type="checkbox" id="f-cons" ${dr.cons?'checked':''}><span>${rwe?'She agreed':'The respondent agreed'} to take the survey<small>उत्तरदाता सर्वे के लिए सहमत हैं</small></span></label>
          ${groups}
        </div>
      </div>
      <div class="row2" id="f-cbrow" ${dr.o==='partial'?'':'hidden'}>
        <label class="fld">Call back on<input id="f-cb" type="datetime-local" value="${esc(dr.cb)}"></label>
      </div>
      <label class="fld">Remarks (optional)<textarea id="f-rem" maxlength="500" placeholder="Anything useful for the field team">${esc(dr.rem)}</textarea></label>
      <div id="f-err"></div>
      <div class="actions">
        <button type="button" class="btn pri" id="f-save">Save call</button>
        <button type="button" class="btn" id="f-next">${rwe?'Save and open next RWE':'Save and call another household'}</button>
        <span class="note" style="margin:0">${S.caller?'Recorded as '+esc(S.caller):'Choose your name at the top right before saving.'}</span>
      </div>
    </div>
  </div>`;
}
function syncQ(){
  const dr=S.draft;if(!dr)return;
  $$('#sheet .qb').forEach(n=>{const q=QM[n.dataset.q];n.hidden=!visQ(q,dr.a)});
}
$('#sheet').addEventListener('click',e=>{
  const dr=S.draft;if(!dr)return;
  const ob=e.target.closest('#f-out button');
  if(ob){dr.o=ob.dataset.v;$$('#f-out button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===dr.o)));
    const full=dr.o==='done'||dr.o==='partial';$('#f-more').hidden=!full;$('#f-cbrow').hidden=dr.o!=='partial';return}
  const chip=e.target.closest('.chip');
  if(chip){
    const box=chip.closest('.chips'),q=QM[box.dataset.q],v=chip.dataset.o;
    if(q.kind==='single'){dr.a[q.id]=dr.a[q.id]===v?'':v}
    else{const set=new Set(dr.a[q.id]||[]);set.has(v)?set.delete(v):set.add(v);dr.a[q.id]=[...set]}
    $$('.chip',box).forEach(c=>c.setAttribute('aria-pressed',String(q.kind==='single'?dr.a[q.id]===c.dataset.o:(dr.a[q.id]||[]).includes(c.dataset.o))));
    const oi=box.parentElement.querySelector('[data-ot]');if(oi)oi.hidden=!(dr.a[q.id]||[]).includes('other');
    syncQ();return;
  }
  if(e.target.closest('#f-save')){save(false);return}
  if(e.target.closest('#f-next')){save(true);return}
});
$('#sheet').addEventListener('input',e=>{
  const dr=S.draft;if(!dr)return;const t=e.target;
  if(t.id==='f-nm')dr.nm=t.value;else if(t.id==='f-ph')dr.ph=t.value;else if(t.id==='f-rem')dr.rem=t.value;else if(t.id==='f-cb')dr.cb=t.value;
  else if(t.id==='f-vil'){dr.vil=t.value;const m=(VBYD[dr.d]||[]).find(v=>v.key===vkey(dr.d,t.value));if(m)dr.blk=m.b}
  else if(t.dataset&&t.dataset.t)dr.a[t.dataset.t]=t.value;
  else if(t.dataset&&t.dataset.ot)dr.a[t.dataset.ot+'_other']=t.value;
});
$('#sheet').addEventListener('change',e=>{const dr=S.draft;if(dr&&e.target.id==='f-cons')dr.cons=e.target.checked});

function collect(dr){
  const out={};
  QS.filter(q=>GROUPS[dr.kind].some(g=>g[1].includes(q.id))&&visQ(q,dr.a)).forEach(q=>{
    if(!hasAns(q,dr.a))return;
    const v=dr.a[q.id];out[q.id]=q.kind==='text'?String(v).trim():v;
    if(q.kind==='multi'&&v.includes('other')&&(dr.a[q.id+'_other']||'').trim())out[q.id+'_other']=dr.a[q.id+'_other'].trim();
  });
  return out;
}
function validate(dr){
  const e=[];
  if(!S.caller)e.push('Choose your name at the top right.');
  if(!dr.o)e.push('Choose how the call went.');
  const survey=dr.o==='done'||dr.o==='partial';
  if(survey){
    if(!dr.cons)e.push('Tick the box once the respondent agrees to the survey.');
    if(!dr.vil.trim())e.push('Enter the village.');
  }
  if(dr.o==='partial'&&!dr.cb)e.push('Set when to call back.');
  if(dr.o==='done'){
    QS.filter(q=>GROUPS[dr.kind].some(g=>g[1].includes(q.id))&&q.req&&visQ(q,dr.a)&&!hasAns(q,dr.a)).forEach(q=>e.push('Answer: '+q.en));
  }
  return e;
}
function showErrs(errs){
  $('#f-err').innerHTML=errs.length?`<div class="errs"><b>Not saved yet</b><ul>${errs.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:'';
}
let saving=false;
async function save(next){
  const dr=S.draft;if(!dr||saving)return;
  if(!fdb||S.conn!=='live'){showErrs(['Not connected yet. Wait for the "Connected" note at the top, then save again.']);return}
  const errs=validate(dr);showErrs(errs);
  if(errs.length){const x=$('#f-err');if(x)x.scrollIntoView({block:'center',behavior:'smooth'});return}
  saving=true;$$('#f-save,#f-next').forEach(b=>b.disabled=true);
  const survey=dr.o==='done'||dr.o==='partial';
  const doc={kind:dr.kind,d:dr.d,id:dr.id,c:dr.c,m:dr.m,vil:dr.vil.trim(),blk:dr.blk||'',nm:dr.nm.trim(),ph:dr.ph.trim(),
    by:S.caller,byId:(fauth.currentUser&&fauth.currentUser.uid)||null,t:new Date().toISOString(),o:dr.o,cb:dr.o==='partial'?dr.cb:'',rem:dr.rem.trim(),cons:survey,a:survey?collect(dr):{}};
  const rowsBefore=S.mode==='rwe'?queueRows():[];
  const idx=rowsBefore.findIndex(x=>x[1]===S.sel);
  const nextKey=idx>=0&&rowsBefore[idx+1]?rowsBefore[idx+1][1]:null;
  try{
    const b=fdb.batch();
    b.set(fdb.collection('dds_calls').doc(),doc);
    if(dr.kind==='rwe'){
      const patch={st:dr.o,t:Date.now(),n:FV.increment(1)};if(dr.o==='done')patch.sv=1;
      b.set(fdb.collection('dds_status').doc('d'+dr.d),{s:{[dr.id]:patch}},{merge:true});
    }else{
      b.set(fdb.collection('dds_status').doc('hh'),{s:{[hk(vkey(dr.d,dr.vil))]:{n:FV.increment(1),dn:FV.increment(dr.o==='done'?1:0)}}},{merge:true});
    }
    const res=await Promise.race([b.commit().then(()=>'ok'),new Promise(r=>setTimeout(()=>r('queued'),12000))]);
    if(!S.team.some(x=>x.toLowerCase()===S.caller.toLowerCase())){S.team.push(S.caller);ls.set('dds-team',JSON.stringify(S.team))}
    toast(res==='ok'?'Call saved':'Saved on this device. It uploads when the connection returns; do not enter it again.',res==='ok'?2600:5000);
    if(S.mode==='rwe'){
      if(next&&nextKey)select(nextKey);
      else if(next){S.sel=null;S.draft=null;renderQueue();renderSheet(true)}
      else{S.draft=newDraft('rwe',ROS.find(x=>rkey(x[0],x[1])===S.sel),null);renderQueue();renderSheet(true)}
    }else{
      const v=VILL.find(x=>x.key===S.sel);S.draft=newDraft('hh',null,v);renderQueue();renderSheet(true);
    }
    window.scrollTo({top:0,behavior:'smooth'});
  }catch(e){
    showErrs(['Could not save the call ('+((e&&(e.code||e.message))||'unknown error')+'). Check the connection and press Save again.']);
  }finally{saving=false;$$('#f-save,#f-next').forEach(b=>b.disabled=false)}
}

/* ======================================================================
   SHARED DASHBOARD HELPERS
   ====================================================================== */
const bar=(v,max,cls)=>`<div class="bar ${cls||''}"><i style="width:${max?Math.max(1,Math.round(v*100/max)):0}%"></i></div>`;
const barPct=(n,d)=>`<div class="bar"><i style="width:${d?Math.max(n?1:0,Math.round(n*100/d)):0}%"></i><span>${pct(n,d)}</span></div>`;
function callerOpts(){return [...new Set(S.calls.map(c=>c.by).filter(Boolean))].sort((a,b)=>a.localeCompare(b))}
function fltHtml(id,F,fields){
  const box=$(id);
  const dl=distIdxs(F.state);if(F.dist!==''&&!dl.includes(+F.dist))F.dist='';
  const sel=(k,label,items)=>`<label class="ctl"><span>${label}</span><select data-f="${k}">${items.map(([v,l])=>`<option value="${esc(v)}" ${String(F[k])===String(v)?'selected':''}>${esc(l)}</option>`).join('')}</select></label>`;
  let h=sel('state','State',[['','All states'],...STATES.map((s,i)=>[String(i),s])])+sel('dist','District',[['','All districts'],...dl.map(i=>[String(i),DIST[i].n])]);
  if(fields.includes('type'))h+=sel('type','Respondents',[...(fields.includes('all')?[['','RWEs and households']]:[]),['rwe','RWEs (Sahelis)'],['hh','Households']]);
  if(fields.includes('o'))h+=sel('o','Outcome',[['','All outcomes'],...OUT]);
  h+=sel('by','Caller',[['','All callers'],...callerOpts().map(c=>[c,c])]);
  if(fields.includes('s'))h+=`<label class="ctl"><span>Find</span><input data-f="s" type="search" value="${esc(F.s)}" placeholder="ID, name or village" autocomplete="off"></label>`;
  if(fields.includes('csv')&&ROLE==='admin')h+=`<button class="btn" type="button" id="csv">Download CSV</button>`;
  box.innerHTML=h;
}
function scopeCalls(F){
  return S.calls.filter(c=>(F.state===''||DIST[c.d].s===+F.state)&&(F.dist===''||c.d===+F.dist)&&(!F.type||c.kind===F.type)&&(!F.by||c.by===F.by)&&(!F.o||c.o===F.o));
}

/* ======================================================================
   CALL TRACKER
   ====================================================================== */
function trackerRows(){
  const F=S.F,s=F.s.toLowerCase();
  return scopeCalls(F).filter(c=>!s||String(c.id).includes(s)||(c.nm||'').toLowerCase().includes(s)||(c.vil||'').toLowerCase().includes(s))
    .sort((a,b)=>a.t<b.t?1:a.t>b.t?-1:0);
}
function renderTracker(rebuildFlt){
  const F=S.F;
  if(rebuildFlt){fltHtml('#t-flt',F,['type','all','o','s','csv'])}
  const rows=trackerRows();
  const done=rows.filter(c=>c.o==='done').length;
  $('#t-head').innerHTML=S.gotCalls?`<b>${num(rows.length)}</b> calls match, of which <b>${num(done)}</b> are completed surveys.`:'Loading calls…';
  const PAGE=50;if(S.tpage*PAGE>=rows.length)S.tpage=0;
  const slice=rows.slice(S.tpage*PAGE,S.tpage*PAGE+PAGE);
  const body=$('#t-body');
  if(!rows.length){body.innerHTML=`<div class="empty">${S.calls.length?'No calls match these filters.':'No calls logged yet. They appear here as soon as a caller saves one.'}</div>`;return}
  body.innerHTML=`<div class="scroll"><table><thead><tr><th class="l">When</th><th class="l">Caller</th><th class="l">Respondent</th><th class="l">Name</th><th class="l">Village</th><th class="l">District</th><th class="l">Outcome</th><th class="l">Remarks</th></tr></thead><tbody>${
    slice.map(c=>`<tr><td class="l">${esc(fmtDT(c.t))}</td><td class="l">${esc(c.by)}</td><td class="l">${c.kind==='rwe'?'RWE '+c.id:'Household'}</td><td class="l">${esc(c.nm)}</td><td class="l">${esc(c.vil)}</td><td class="l">${esc(DIST[c.d].n)}</td><td class="l">${pill(c.o)}${c.o==='partial'&&c.cb?` <span class="tag">${esc(fmtDT(c.cb))}</span>`:''}</td><td class="l wrap">${esc(c.rem)}</td></tr>`).join('')}</tbody></table></div>
    <div class="pg"><span>${S.tpage*PAGE+1}–${S.tpage*PAGE+slice.length} of ${num(rows.length)}</span><button class="btn sm" id="pg-p" ${S.tpage?'':'disabled'}>Previous</button><button class="btn sm" id="pg-n" ${(S.tpage+1)*PAGE<rows.length?'':'disabled'}>Next</button></div>`;
  $('#pg-p').onclick=()=>{S.tpage--;renderTracker()};$('#pg-n').onclick=()=>{S.tpage++;renderTracker()};
}
$('#t-flt').addEventListener('change',e=>{const k=e.target.dataset.f;if(!k)return;S.F[k]=e.target.value;if(k==='state')S.F.dist='';S.tpage=0;renderTracker(true)});
$('#t-flt').addEventListener('input',e=>{if(e.target.dataset.f==='s'){S.F.s=e.target.value.trim();S.tpage=0;renderTracker(false)}});
$('#t-flt').addEventListener('click',e=>{if(e.target.id==='csv')exportCsv()});
function csvCell(s){
  s=s==null?'':String(s);
  if(/^[=@]/.test(s)||(/^[+-]/.test(s)&&!/^[+-]?[\d\s().-]+$/.test(s)))s="'"+s;
  return /[",\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
}
async function exportCsv(){
  const base=['response_id','date_time','caller','respondent','rwe_id','name','phone','state','district','block','village','mat','rwe_category','outcome','callback_on','remarks','consent'];
  const lines=[base.concat(QS.map(q=>q.id)).map(csvCell).join(',')];
  trackerRows().slice().reverse().forEach(c=>{
    const a=c.a||{};
    const row=[c.cid,c.t,c.by,KINDS[c.kind],c.kind==='rwe'?c.id:'',c.nm,c.ph,STATES[DIST[c.d].s],DIST[c.d].n,c.blk,c.vil,c.kind==='rwe'?matName(c.m):'',c.kind==='rwe'?CN[c.c]:'',OUTN[c.o]||c.o,c.cb,c.rem,c.cons?'yes':'no'];
    QS.forEach(q=>row.push(hasAns(q,a)?String(ansText(q,a)).replace(/, /g,' | '):''));
    lines.push(row.map(csvCell).join(','));
  });
  try{
    const u=URL.createObjectURL(new Blob(['\uFEFF'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=u;a.download='rwe-delivery-survey-'+new Date().toISOString().slice(0,10)+'.csv';
    document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(u);a.remove()},600);toast('File saved to your downloads folder');
  }catch(e){toast('Could not save the file')}
}

/* ======================================================================
   SURVEY RESULTS
   ====================================================================== */
function qBlock(q,rows){
  const ans=rows.map(c=>c.a||{}).filter(a=>hasAns(q,a));
  const unaided=q.id==='D_unaided';
  const base=unaided?rows.length:ans.length;
  let h=`<div class="blk"><h3>${esc(q.en)}</h3><p class="note">n = ${num(base)}${unaided?' (everyone surveyed; a blank answer means none named)':''}</p>`;
  if(!base)return h+`<div class="empty">No answers yet.</div></div>`;
  if(q.kind==='text'){
    if(unaided){
      const named=re=>ans.filter(a=>re.test(a[q.id])).length;
      h+=`<div class="scroll"><table><thead><tr><th class="l">Named without prompting</th><th>Responses</th><th class="l">Share</th></tr></thead><tbody>`+
        [['ElasticRun',/elastic/i],['Blitz',/blitz/i]].map(([l,re])=>{const n=named(re);return `<tr><td class="l">${l}</td><td>${num(n)}</td><td class="l">${barPct(n,base)}</td></tr>`}).join('')+`</tbody></table></div>`;
    }
    if(ans.length)h+=`<details style="margin-top:8px"><summary class="note" style="cursor:pointer">Verbatim answers (${ans.length})</summary><ul class="verb">${ans.slice(-15).reverse().map(a=>`<li>${esc(a[q.id])}</li>`).join('')}</ul></details>`;
    return h+'</div>';
  }
  const items=q.opts.map(o=>({l:o.en,n:ans.filter(a=>q.kind==='single'?a[q.id]===o.v:(a[q.id]||[]).includes(o.v)).length}));
  h+=`<div class="scroll"><table><thead><tr><th class="l">Answer</th><th>Responses</th><th class="l">Share</th></tr></thead><tbody>${items.map(i=>`<tr><td class="l">${esc(i.l)}</td><td>${num(i.n)}</td><td class="l">${barPct(i.n,base)}</td></tr>`).join('')}</tbody></table></div>`;
  if(q.numeric){const nums=ans.map(a=>Number(a[q.id])).filter(x=>!isNaN(x));if(nums.length)h+=`<p class="note" style="margin-top:6px">Average ${(nums.reduce((s,x)=>s+x,0)/nums.length).toFixed(1)} out of 5</p>`}
  return h+'</div>';
}
function renderResults(rebuildFlt){
  const F=S.R;
  if(rebuildFlt)fltHtml('#r-flt',F,['type']);
  const body=$('#r-body');
  if(!S.gotCalls){body.innerHTML=`<div class="empty">Loading calls…</div>`;return}
  const calls=scopeCalls(Object.assign({},F,{type:''}));
  const mine=calls.filter(c=>c.kind===F.type);
  const done=mine.filter(c=>c.o==='done');
  const spoke=mine.filter(c=>c.o==='done'||c.o==='partial');
  const rweScope=ROS.filter(r=>(F.state===''||DIST[r[0]].s===+F.state)&&(F.dist===''||r[0]===+F.dist));
  const surveyedRwe=new Set(done.filter(c=>c.kind==='rwe').map(c=>rkey(c.d,c.id)));
  const villages=new Set(done.map(c=>vkey(c.d,c.vil)).filter(k=>!k.endsWith('|')));
  const typeLabel=F.type==='rwe'?'RWEs':'households';
  $('#r-head').innerHTML=mine.length?`<b>${num(done.length)}</b> completed ${typeLabel} surveys from <b>${num(mine.length)}</b> calls, across <b>${num(villages.size)}</b> ${villages.size===1?'village':'villages'}.`:`No ${typeLabel} calls logged for this selection yet.`;
  let h=`<div class="kpis">
    <div class="kpi"><div class="l">Calls logged</div><div class="v">${num(mine.length)}</div><div class="s">${num(calls.length-mine.length)} more to the other group</div></div>
    <div class="kpi"><div class="l">Surveys completed</div><div class="v">${num(done.length)}</div><div class="s">${pct(done.length,mine.length)} of calls</div></div>
    <div class="kpi"><div class="l">Spoke to</div><div class="v">${pct(spoke.length,mine.length)}</div><div class="s">${num(spoke.length)} calls reached someone</div></div>
    ${F.type==='rwe'?`<div class="kpi"><div class="l">RWEs surveyed</div><div class="v">${num(surveyedRwe.size)}</div><div class="s">of ${num(rweScope.length)} on the list (${pct(surveyedRwe.size,rweScope.length)})</div></div>`:''}
    <div class="kpi"><div class="l">Villages covered</div><div class="v">${num(villages.size)}</div><div class="s">with at least one survey</div></div>
  </div>`;
  if(done.length&&done.length<30)h+=`<p class="note">Fewer than 30 completed surveys so far, so treat the figures below as indicative.</p>`;

  // by district
  const dIdx=distIdxs(F.state).filter(i=>F.dist===''||i===+F.dist);
  const drows=dIdx.map(i=>{
    const rw=ROS.filter(r=>r[0]===i).length;
    const cs=calls.filter(c=>c.d===i);
    const rd=new Set(cs.filter(c=>c.kind==='rwe'&&c.o==='done').map(c=>rkey(c.d,c.id))).size;
    return {n:DIST[i].n,rw,calls:cs.length,rd,hd:cs.filter(c=>c.kind==='hh'&&c.o==='done').length};
  }).filter(r=>r.calls||r.rw);
  const maxRw=Math.max(1,...drows.map(r=>r.rw));
  h+=`<div class="blk"><h3>Coverage by district</h3><p class="note">RWEs on the call list, calls made, and surveys completed.</p><div class="scroll"><table><thead><tr><th class="l">District</th><th>RWEs on list</th><th>Calls</th><th>RWEs surveyed</th><th class="l">Share of list</th><th>Household surveys</th></tr></thead><tbody>${
    drows.map(r=>`<tr><td class="l">${esc(r.n)}</td><td>${num(r.rw)}</td><td>${num(r.calls)}</td><td>${num(r.rd)}</td><td class="l">${barPct(r.rd,r.rw)}</td><td>${num(r.hd)}</td></tr>`).join('')}</tbody></table></div></div>`;

  // findings
  const qids=GROUPS[F.type].flatMap(g=>g[1]);
  h+=`<div class="head" style="margin-top:6px"><h2 style="font-size:17px">Findings: ${F.type==='rwe'?'RWEs (Sahelis)':'Households'}</h2><p class="note">Shares are of those who answered each question.</p></div><div class="grid2">${qids.map(id=>qBlock(QM[id],done)).join('')}</div>`;

  // by caller
  const cm=new Map();
  calls.forEach(c=>{const k=c.by||'Unknown';const e=cm.get(k)||{n:0,s:0,d:0};e.n++;if(c.o==='done'||c.o==='partial')e.s++;if(c.o==='done')e.d++;cm.set(k,e)});
  const crows=[...cm].sort((a,b)=>b[1].n-a[1].n),maxN=Math.max(1,...crows.map(x=>x[1].n));
  h+=`<div class="blk"><h3>Calls by caller</h3><div class="scroll"><table><thead><tr><th class="l">Caller</th><th>Calls</th><th>Spoke to</th><th>Surveys completed</th><th class="l">Share of calls</th></tr></thead><tbody>${
    crows.map(([k,e])=>`<tr><td class="l">${esc(k)}</td><td>${num(e.n)}</td><td>${num(e.s)}</td><td>${num(e.d)}</td><td class="l">${bar(e.n,maxN,'b')}</td></tr>`).join('')||'<tr><td class="l" colspan="5">No calls yet</td></tr>'}</tbody></table></div></div>`;
  body.innerHTML=h;
}
$('#r-flt').addEventListener('change',e=>{const k=e.target.dataset.f;if(!k)return;S.R[k]=e.target.value;if(k==='state')S.R.dist='';renderResults(true)});

/* ---------- start ---------- */
function schedule(){if(schedule.t)return;schedule.t=setTimeout(()=>{schedule.t=0;renderWho();importBar();render(true)},60)}
function sched2(){ROLE==='admin'?rebuildFromCalls():rebuildFromStatus();schedule()}
function startStatus(){
  if(ROLE!=='form'||!fdb||!READY||S.conn!=='live'||startStatus.on)return;startStatus.on=true;
  const onErr=e=>{S.conn='error';S.err=e.message||'';importBar()};
  DIST.forEach((_,d)=>fdb.collection('dds_status').doc('d'+d).onSnapshot(s=>{STAT.set('d'+d,(s.exists&&s.data().s)||{});sched2()},onErr));
  fdb.collection('dds_status').doc('hh').onSnapshot(s=>{STAT.set('hh',(s.exists&&s.data().s)||{});sched2()},onErr);
}
function startCalls(){
  if(startCalls.on)return;startCalls.on=true;
  fdb.collection('dds_calls').onSnapshot(snap=>{
    S.calls=snap.docs.map(d=>Object.assign({cid:d.id},d.data()));S.gotCalls=true;S.conn='live';S.err='';sched2();
  },e=>{startCalls.on=false;S.conn=e.code==='permission-denied'?'denied':'error';S.err=e.message||'';importBar();schedule()});
}
async function init(){
  applyRole();renderWho();importBar();
  setTab(location.hash.slice(1)||ALLOWED[0]);
  fetch('rwe-data.json').then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}).then(d=>{prepare(d);render();startStatus()})
    .catch(e=>{$('#q-list').innerHTML='<div class="empty" style="margin:12px">The RWE list could not be loaded ('+esc(e.message||e)+'). Reload the page.</div>'});
  const cfg=window.FIREBASE_CONFIG;
  if(!cfg||/PASTE/.test(JSON.stringify(cfg))||typeof firebase==='undefined'){S.conn=(!cfg||/PASTE/.test(JSON.stringify(cfg)))?'setup':'error';if(S.conn==='error')S.err='The Firebase library did not load.';importBar();return}
  try{
    firebase.initializeApp(cfg);fauth=firebase.auth();fdb=firebase.firestore();FV=firebase.firestore.FieldValue;
    fdb.enablePersistence({synchronizeTabs:true}).catch(()=>{});
    window.addEventListener('online',importBar);window.addEventListener('offline',importBar);
    if(ROLE==='admin'){
      fauth.onAuthStateChanged(u=>{
        if(!u||u.isAnonymous){S.conn='signin';S.user='';importBar();return}
        S.user=u.email||'';S.conn='connecting';importBar();startCalls();
      });
    }else{
      await fauth.signInAnonymously();S.conn='live';importBar();startStatus();
    }
  }catch(e){S.conn='error';S.err=e.message||'';importBar()}
}
init();
})();
