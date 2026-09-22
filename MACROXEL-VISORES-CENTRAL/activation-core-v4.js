/* MACROXEL Activation Core v4.0.0
   Identidad por instalación, perfil único por dispositivo y activación unificada.
   El modelo del equipo NUNCA se usa como identificador. */
(function(){
'use strict';
if(window.mxActivationCoreV4)return;

const VERSION='4.0.0';
const DEVICE_KEY='mx_macroxel_device_id_v4';
const OLD_RANDOM_DEVICE_KEY='mx_macroxel_unified_device_id_v2';
const PROFILE_KEY='mx_macroxel_activation_profile_v4';
const PROFILE_LOCK_KEY='mx_macroxel_activation_profile_locked_v4';
const ALIASES_KEY='mx_macroxel_device_aliases_v4';
const RESET_SEEN_KEY='mx_macroxel_activation_reset_seen_v4';
const CHANNEL='mx_macroxel_activation_v4';
const V4_RE=/^MACROXEL-DISPOSITIVO-V4-[A-F0-9]{32}$/i;
const V2_RE=/^MACROXEL-DISPOSITIVO-V2-[A-F0-9]{32}$/i;
const V1_RE=/^MACROXEL-DISPOSITIVO-[A-F0-9]{16}$/i;
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FIELD_IDS={
 fullName:['mxVaName','actName','activationName','viewerName','licenseName','scn_actName','ann_actName'],
 phone:['mxVaPhone','actPhone','activationPhone','viewerPhone','licensePhone','scn_actPhone','ann_actPhone'],
 email:['mxVaEmail','actEmail','activationEmail','viewerEmail','licenseEmail','scn_actEmail','ann_actEmail']
};
const DEVICE_VALUE_KEYS=[
 'mx_macroxel_unified_device_id_v2','mx_visor_device_id_v1','mx_service_orders_device_v1','mx_fv_device_v1',
 'mx_sc_device_v1','mx_caducidades_device_v1','mx_admin_device_v1','mx_admin_ecosistema_device_v1'
];
const PROFILE_CACHE_HINTS=['activation_profile','viewer_license_cache','visor_license_cache','visor_activation','service_orders_license','fv_license','caducidades_license','farmacia_ajusco_license','censo_hospitalario_license'];
const txt=v=>String(v==null?'':v).trim();
const safeJson=v=>{try{return JSON.parse(v||'null')}catch(_e){return null}};
const nowIso=()=>new Date().toISOString();
const keyOf=v=>txt(v).replace(/[.#$\[\]\/]/g,'_');
const cleanDb=v=>txt(v).replace(/\.json\/?$/i,'').replace(/\/+$/,'');
const cleanBranch=v=>txt(v).replace(/[.#$\[\]\/]/g,'_').toUpperCase();

function randomHex(bytes=16){
 try{const a=new Uint8Array(bytes);crypto.getRandomValues(a);return Array.from(a,b=>b.toString(16).padStart(2,'0')).join('').toUpperCase()}catch(_e){}
 let s='';for(let i=0;i<bytes*2;i++)s+=Math.floor(Math.random()*16).toString(16);return s.toUpperCase();
}
function isSafeRandomId(v){v=txt(v);return V4_RE.test(v)||V2_RE.test(v)||UUID_RE.test(v)}
function deviceId(){
 let id='';
 try{id=txt(localStorage.getItem(DEVICE_KEY))}catch(_e){}
 if(isSafeRandomId(id))return id;
 let old='';try{old=txt(localStorage.getItem(OLD_RANDOM_DEVICE_KEY))}catch(_e){}
 if(V2_RE.test(old))id=old;else id='MACROXEL-DISPOSITIVO-V4-'+randomHex(16);
 try{localStorage.setItem(DEVICE_KEY,id);if(!V2_RE.test(old))localStorage.setItem(OLD_RANDOM_DEVICE_KEY,id)}catch(_e){}
 return id;
}
function addAlias(set,v){v=txt(v);if(isSafeRandomId(v)&&v!==deviceId())set.add(v)}
function discoverAliases(){
 const set=new Set();
 const current=deviceId();
 try{
   const saved=safeJson(localStorage.getItem(ALIASES_KEY));
   if(Array.isArray(saved))for(const v of saved)addAlias(set,v);
   for(const base of DEVICE_VALUE_KEYS){
     const direct=txt(localStorage.getItem(base));addAlias(set,direct);
   }
   for(let i=0;i<localStorage.length;i++){
     const k=txt(localStorage.key(i));if(!k)continue;
     const lk=k.toLowerCase();
     if(/(?:device_id|device_v1|unified_device_id|admin_ecosistema_device)/.test(lk))addAlias(set,localStorage.getItem(k));
     if(!PROFILE_CACHE_HINTS.some(h=>lk.includes(h)))continue;
     const raw=localStorage.getItem(k);if(!raw||raw.length>250000)continue;
     const o=safeJson(raw);if(!o||Array.isArray(o)||typeof o!=='object')continue;
     for(const name of ['deviceId','deviceKey','_mxDeviceId','canonicalDeviceId','installationId','migratedFromDeviceId'])addAlias(set,o[name]);
     if(Array.isArray(o.legacyDeviceIds))for(const v of o.legacyDeviceIds)addAlias(set,v);
   }
 }catch(_e){}
 const out=[...set].filter(v=>!V1_RE.test(v));
 try{localStorage.setItem(ALIASES_KEY,JSON.stringify(out))}catch(_e){}
 return out;
}
function allDeviceIds(){return[deviceId(),...discoverAliases()]}

function cleanPerson(v={}){
 const fullName=txt(v.fullName||v.name||v.nombre||v.nombreCompleto).replace(/\s+/g,' ');
 const phone=txt(v.phone||v.telefono||v.mobile||v.celular).replace(/\s+/g,' ');
 const email=txt(v.email||v.correo||v.mail).toLowerCase().replace(/\s+/g,'');
 return{fullName,phone,email};
}
function normalizedPerson(v={}){const p=cleanPerson(v);return{fullName:p.fullName.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9 ]+/g,' ').replace(/\s+/g,' ').trim(),phone:p.phone.replace(/\D/g,'').slice(-10),email:p.email}}
function samePerson(a,b){const x=normalizedPerson(a),y=normalizedPerson(b);return !!x.fullName&&!!y.fullName&&x.fullName===y.fullName&&x.phone===y.phone&&x.email===y.email}
function validPerson(v){const p=cleanPerson(v);return p.fullName.split(/\s+/).filter(Boolean).length>=2&&p.phone.replace(/\D/g,'').length>=7&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)}
function profile(){try{const p=cleanPerson(safeJson(localStorage.getItem(PROFILE_KEY))||{});return validPerson(p)?p:null}catch(_e){return null}}
function locked(){try{return localStorage.getItem(PROFILE_LOCK_KEY)==='1'&&!!profile()}catch(_e){return false}}
function scopeName(){
 try{const m=document.querySelector('meta[name="mx-storage-isolation"]')?.content||'';const p=m.split(':').pop();if(p&&p!==m)return p.toLowerCase().replace(/[^a-z0-9_-]/g,'_')}catch(_e){}
 const path=(location.pathname||'').split('/').filter(Boolean);return txt(path[path.length-2]||'viewer').toLowerCase().replace(/[^a-z0-9_-]/g,'_');
}
function legacyProfileKey(){return`mx_${scopeName()}__macroxel_activation_profile_v1__v139`}
function mirrorLegacyProfile(p){
 if(!p)return;
 const payload={...p,deviceId:deviceId(),_mxDeviceId:deviceId(),locked:true,updatedAt:nowIso()};
 try{localStorage.setItem(legacyProfileKey(),JSON.stringify(payload))}catch(_e){}
 const scope=scopeName();
 try{localStorage.setItem(`mx_${scope}__fv_name_v1__v139`,p.fullName);localStorage.setItem(`mx_${scope}__fv_phone_v1__v139`,p.phone);localStorage.setItem(`mx_${scope}__fv_email_v1__v139`,p.email)}catch(_e){}
}
function broadcast(type,payload={}){try{const ch=new BroadcastChannel(CHANNEL);ch.postMessage({type,...payload,at:Date.now()});ch.close()}catch(_e){}}
function saveProfile(value,{force=false}={}){
 const p=cleanPerson(value);if(!validPerson(p))throw new Error('Captura nombre completo, teléfono y correo válidos.');
 const current=profile();
 if(current&&!samePerson(current,p)&&!force)throw new Error('Este dispositivo ya está asociado a otro usuario. Los datos sólo pueden restablecerse desde Central.');
 const final=current&&!force?current:p;
 try{localStorage.setItem(PROFILE_KEY,JSON.stringify({...final,deviceId:deviceId(),updatedAt:nowIso()}));localStorage.setItem(PROFILE_LOCK_KEY,'1')}catch(_e){}
 mirrorLegacyProfile(final);applyProfileToFields();broadcast('profile',{profile:final});
 return final;
}
function clearProfile(reason='central-reset'){
 try{localStorage.removeItem(PROFILE_KEY);localStorage.removeItem(PROFILE_LOCK_KEY)}catch(_e){}
 const hints=['activation_profile','identity_cache','identity_last_sync','viewer_license_cache','visor_license_cache','visor_activation','service_orders_license_cache','fv_license_cache','caducidades_license','censo_hospitalario_license_cache'];
 try{for(let i=localStorage.length-1;i>=0;i--){const k=txt(localStorage.key(i)),lk=k.toLowerCase();if(hints.some(h=>lk.includes(h)))localStorage.removeItem(k)}}catch(_e){}
 unlockAndClearFields();broadcast('profile-reset',{reason});window.dispatchEvent(new CustomEvent('mx-activation-profile-reset',{detail:{reason}}));
}
function importMatchingLegacyProfile(){
 if(profile())return profile();
 const ids=new Set(allDeviceIds().map(v=>keyOf(v).toUpperCase()));
 let best=null,bestTs=0;
 try{
  for(let i=0;i<localStorage.length;i++){
   const k=txt(localStorage.key(i)),lk=k.toLowerCase();if(!PROFILE_CACHE_HINTS.some(h=>lk.includes(h)))continue;
   const raw=localStorage.getItem(k);if(!raw||raw.length>250000)continue;const o=safeJson(raw);if(!o||Array.isArray(o)||typeof o!=='object')continue;
   const did=keyOf(o.deviceId||o._mxDeviceId||o.deviceKey||o.canonicalDeviceId||'').toUpperCase();if(!did||!ids.has(did))continue;
   const p=cleanPerson(o);if(!validPerson(p))continue;const t=Math.max(Date.parse(o.updatedAt||0)||0,Date.parse(o._mxCachedAt||0)||0,Date.parse(o.lastRequestAt||0)||0);if(!best||t>=bestTs){best=p;bestTs=t}
  }
 }catch(_e){}
 if(best){try{return saveProfile(best)}catch(_e){}}
 return null;
}
function activationFieldKind(el){
 if(!el||el.tagName!=='INPUT')return'';const id=txt(el.id).toLowerCase();
 for(const[k,ids]of Object.entries(FIELD_IDS))if(ids.some(x=>x.toLowerCase()===id))return k;
 if(id.includes('actname')||id.includes('activationname')||id.includes('vaname'))return'fullName';
 if(id.includes('actphone')||id.includes('activationphone')||id.includes('vaphone'))return'phone';
 if(id.includes('actemail')||id.includes('activationemail')||id.includes('vaemail'))return'email';
 const gate=el.closest?.('#mxViewerActivationGate,#activationGate,#mxVaGate,#loginGate,.mx-va-card,.gate-card');
 if(!gate)return'';const ac=txt(el.autocomplete).toLowerCase();if(ac==='name')return'fullName';if(ac==='tel')return'phone';if(ac==='email')return'email';return'';
}
function eachActivationField(fn){document.querySelectorAll('input').forEach(el=>{const kind=activationFieldKind(el);if(kind)fn(el,kind)})}
function removeChangeUserControls(){document.querySelectorAll('.mx-reidentify-v137,.mx-reidentify-profile-v137,[data-mx-change-user]').forEach(e=>e.remove())}
function applyProfileToFields(){
 const p=profile();removeChangeUserControls();if(!p)return;
 eachActivationField((el,kind)=>{const v=p[kind]||'';if(el.value!==v)el.value=v;el.readOnly=true;el.disabled=false;el.dataset.mxProfileLocked='1';el.setAttribute('aria-readonly','true');el.title='Datos asociados a este dispositivo. Sólo Central puede restablecerlos.'});
 mirrorLegacyProfile(p);
}
function unlockAndClearFields(){eachActivationField((el)=>{el.readOnly=false;el.disabled=false;delete el.dataset.mxProfileLocked;el.removeAttribute('aria-readonly');el.removeAttribute('title');el.value=''})}
function isLockedField(el){return locked()&&!!activationFieldKind(el)}
function guardEvent(e){if(!isLockedField(e.target))return;if(['beforeinput','paste','drop'].includes(e.type))e.preventDefault();if(e.type==='keydown'){const k=e.key;if(k==='Backspace'||k==='Delete'||(k.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey))e.preventDefault()}if(e.type==='input'){e.preventDefault();applyProfileToFields()}}
['beforeinput','paste','drop','keydown','input'].forEach(t=>document.addEventListener(t,guardEvent,true));

function norm(v){return txt(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[\s_-]+/g,'_')}
function code(v){const n=norm(v);if(n.includes('FARMACIA')&&n.includes('AJUSCO'))return'FARMACIA_AJUSCO_MEDIO';if(n.includes('SURTIDO')&&n.includes('COLECTIVO'))return'TRANSFERENCIAS';if(n.includes('TRANSFER'))return'TRANSFERENCIAS';if(n.includes('EXISTENCIA'))return'EXISTENCIAS';if(n.includes('FARMACOVIGILANCIA'))return'FARMACOVIGILANCIA';if(n.includes('CENSO')&&n.includes('HOSPITAL'))return'CENSO_HOSPITALARIO';if(n.includes('COLECTIVO'))return'COLECTIVOS';if(n.includes('RECETA'))return'RECETAS';if(n.includes('CADUC')||n.includes('ANALISIS')||n.includes('ANALITICA'))return'TRANSFERENCIAS';if(n.includes('ADMINISTRADOR')&&n.includes('ECOSISTEMA'))return'ADMINISTRADOR_ECOSISTEMA';if(n.includes('ADMINISTRADOR'))return'ADMINISTRADOR';return n||'VISOR'}
function label(v){const c=code(v);return{FARMACIA_AJUSCO_MEDIO:'Farmacia Ajusco Medio',TRANSFERENCIAS:'Transferencias',EXISTENCIAS:'Existencias',COLECTIVOS:'Colectivos',FARMACOVIGILANCIA:'Farmacovigilancia',RECETAS:'Recetas',CENSO_HOSPITALARIO:'Censo hospitalario',ADMINISTRADOR:'Administrador',ADMINISTRADOR_ECOSISTEMA:'Administrador del Ecosistema'}[c]||txt(v)||'Visor'}
function baseState(r){if(!r||typeof r!=='object')return'missing';const s=norm(r.status||r.estado);if(/PEND|ESPERA/.test(s))return'pending';if(r.active===false||/SUSPEND|REVOK|CANCEL|INACTIV|DESACTIV|DELET|ELIMIN/.test(s))return'suspended';const exp=Date.parse(r.expiresAt||r.vence||r.expiry||'');if(r.active===true||/ACTIVE|ACTIVA|ACTIVO|VIGENTE/.test(s))return Number.isFinite(exp)&&Date.now()>exp?'expired':'active';if(/VENC|EXPIR|CADUC/.test(s))return'expired';return'pending'}
function applications(r){const out={};if(r?.applications&&typeof r.applications==='object')for(const[k,v]of Object.entries(r.applications)){if(!v)continue;const c=code(v.appCode||k);out[c]={...v,appCode:c,appName:label(v.appName||c)}}const c=code(r?.appCode||r?.appName||r?.application||'');if(c&&c!=='VISOR'&&!out[c]&&r)out[c]={appCode:c,appName:label(r.appName||c),status:r.status,active:r.active,requestedAt:r.requestedAt,lastRequestAt:r.lastRequestAt,lastSeenAt:r.lastSeenAt,version:r.version};return out}
function appState(r,app){const c=code(app),a=applications(r)[c];if(!a)return'missing';const s=norm(a.status||a.estado);if(a.manualValidationRequired===true||a.autoLinkBlocked===true)return'pending';if(a.active===true||/ACTIVE|ACTIVA|ACTIVO|VIGENTE/.test(s))return'active';if(/SUSPEND|REVOK|CANCEL|INACTIV|DESACTIV/.test(s))return'suspended';return'pending'}
function prepareRequest(prev,opts={}){
 const old=prev&&typeof prev==='object'?prev:{};const input=cleanPerson(opts.person||{});const p=saveProfile(input);if(Object.keys(old).length){const op=cleanPerson(old);if(validPerson(op)&&!samePerson(op,p))throw new Error('El registro remoto pertenece a otro usuario. Elimina/restablece el dispositivo desde Central antes de reutilizarlo.')}
 const now=nowIso(),c=code(opts.appCode||opts.appName),name=label(opts.appName||c),apps=applications(old),current=apps[c]||{},already=appState(old,c)==='active',base=baseState(old),aliases=discoverAliases();
 apps[c]={...current,appCode:c,appName:name,version:txt(opts.version||current.version),status:already?'active':'pending',active:already===true,requestedAt:current.requestedAt||now,lastRequestAt:already?(current.lastRequestAt||now):now,lastSeenAt:now,requestType:already?'validated':(base==='active'?'additional_application':'activation')};
 return{...old,...p,name:p.fullName,nombre:p.fullName,telefono:p.phone,correo:p.email,deviceId:deviceId(),deviceKey:keyOf(deviceId()),canonicalDeviceId:deviceId(),installationId:deviceId(),legacyDeviceIds:aliases,profileLocked:true,branch:cleanBranch(opts.branch||old.branch||old.sucursal),unitName:txt(opts.unitName||old.unitName||old.unidad||window.mxViewerUnitName?.()||''),unidad:txt(opts.unitName||old.unitName||old.unidad||window.mxViewerUnitName?.()||''),applications:apps,appCode:c,appName:name,app:name,application:name,version:txt(opts.version||old.version),status:base==='active'?'active':'pending',active:base==='active',requestedAt:old.requestedAt||now,lastRequestAt:now,lastSeenAt:now,updatedAt:now,pendingAppCode:already?'':c,pendingAppName:already?'':name,requestType:base==='active'?'additional_application':'activation',userAgent:navigator.userAgent||'',platform:navigator.platform||''};
}
function touchPatch(rec,app,version){const now=nowIso(),c=code(app),apps=applications(rec),a={...(apps[c]||{})};apps[c]={...a,appCode:c,appName:label(a.appName||c),version:txt(version||a.version),lastSeenAt:now};return{lastSeenAt:now,updatedAt:now,canonicalDeviceId:deviceId(),installationId:deviceId(),legacyDeviceIds:discoverAliases(),profileLocked:true,applications:apps}}
function mergeApps(a,b){const out={...applications({applications:a})};for(const[k,v]of Object.entries(applications({applications:b})))if(v){const prev=out[k],pt=Date.parse(prev?.updatedAt||prev?.lastRequestAt||0)||0,nt=Date.parse(v.updatedAt||v.lastRequestAt||0)||0;if(!prev||nt>=pt)out[k]=v}return out}
function mergeRecords(a,b){if(!a)return b;if(!b)return a;const at=Math.max(Date.parse(a.updatedAt||0)||0,Date.parse(a.lastRequestAt||0)||0),bt=Math.max(Date.parse(b.updatedAt||0)||0,Date.parse(b.lastRequestAt||0)||0),win=bt>=at?{...a,...b}:{...b,...a};win.applications=mergeApps(a.applications,b.applications);const exps=[a.expiresAt,b.expiresAt].map(v=>Date.parse(v||0)||0).filter(Boolean);if(exps.length)win.expiresAt=new Date(Math.max(...exps)).toISOString();return win}
const adoptionDone=new Set();
async function adoptLegacy(current,opts={}){
 let merged=current&&typeof current==='object'?{...current}:null;const app=code(opts.appCode||opts.appName),token=app+'|'+keyOf(deviceId());
 if(merged){const rp=cleanPerson(merged);if(validPerson(rp)&&!profile())try{saveProfile(rp)}catch(_e){};merged.canonicalDeviceId=deviceId();merged.installationId=deviceId();merged.legacyDeviceIds=[...new Set([...(merged.legacyDeviceIds||[]),...discoverAliases()])];if(appState(merged,app)!=='missing'||adoptionDone.has(token))return merged}
 if(adoptionDone.has(token))return merged;adoptionDone.add(token);
 if(typeof opts.read!=='function')return merged;
 const aliases=discoverAliases();if(!aliases.length)return merged;
 const found=await Promise.all(aliases.map(id=>Promise.resolve().then(()=>opts.read(id)).then(r=>({id,r})).catch(()=>({id,r:null}))));
 const shared=profile();let changed=false;
 for(const {id,r} of found){if(!r||typeof r!=='object')continue;const rp=cleanPerson(r);if(shared&&validPerson(rp)&&!samePerson(shared,rp))continue;if(!shared&&validPerson(rp))try{saveProfile(rp)}catch(_e){};merged=mergeRecords(merged,{...r,migratedFromDeviceId:id});changed=true}
 if(!merged)return null;
 merged={...merged,deviceId:deviceId(),deviceKey:keyOf(deviceId()),canonicalDeviceId:deviceId(),installationId:deviceId(),legacyDeviceIds:[...new Set([...(merged.legacyDeviceIds||[]),...aliases])],profileLocked:!!profile(),updatedAt:nowIso()};const p=profile();if(p)Object.assign(merged,p,{name:p.fullName,nombre:p.fullName,telefono:p.phone,correo:p.email});
 if(changed&&typeof opts.write==='function')try{await opts.write(merged)}catch(_e){}
 return merged;
}
function legacyIds(){return discoverAliases()}

function cfg(){try{const c=window.mxViewerGetCfg?.()||{};return{db:cleanDb(c.db||c.firebaseUrl||c.currentUrl||c.url),branch:cleanBranch(c.branch||c.unitId)}}catch(_e){return{db:'',branch:''}}}
let resetBusy=false,lastResetCheck=0;
function readSeen(){try{return safeJson(localStorage.getItem(RESET_SEEN_KEY))||{}}catch(_e){return{}}}
function writeSeen(o){try{localStorage.setItem(RESET_SEEN_KEY,JSON.stringify(o||{}))}catch(_e){}}
async function fetchJson(url,timeout=3200){const c=new AbortController(),tm=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{cache:'no-store',signal:c.signal});if(!r.ok)return null;return await r.json().catch(()=>null)}catch(_e){return null}finally{clearTimeout(tm)}}
async function checkCentralReset(force=false){
 const now=Date.now();if(resetBusy||(!force&&now-lastResetCheck<15000)||navigator.onLine===false)return;lastResetCheck=now;const c=cfg();if(!c.db||!c.branch)return;resetBusy=true;
 try{const ids=allDeviceIds().slice(0,12),seen=readSeen();const rows=await Promise.all(ids.map(async id=>{const path=`viewer_activation_resets/${encodeURIComponent(c.branch)}/${encodeURIComponent(keyOf(id))}.json?ts=${Date.now()}`;return{id,reset:await fetchJson(c.db+'/'+path)}}));let newest=null;for(const x of rows){const r=x.reset;if(!r?.token||seen[keyOf(x.id)]===txt(r.token))continue;const t=Date.parse(r.deletedAt||r.updatedAt||0)||0;if(!newest||t>newest.t)newest={...x,t}}if(!newest)return;for(const x of rows)if(x.reset?.token)seen[keyOf(x.id)]=txt(x.reset.token);writeSeen(seen);if(newest.reset.clearProfile!==false){clearProfile('central-reset');try{window.__mxViewerLicensed=false;window.__licensed=false}catch(_e){};window.dispatchEvent(new CustomEvent('mx-viewer-activation-reset',{detail:{reason:'central-reset',deviceId:deviceId(),at:nowIso()}}));setTimeout(()=>{const g=document.querySelector('#activationGate,#mxViewerActivationGate,#mxVaGate,#loginGate');if(g){g.hidden=false;g.style.removeProperty('display');g.classList.remove('hide','hidden','mx-hidden')}},50)}
 }finally{resetBusy=false}
}

function boot(){
 deviceId();discoverAliases();importMatchingLegacyProfile();applyProfileToFields();removeChangeUserControls();
 const mo=new MutationObserver(()=>{if(locked())applyProfileToFields();else removeChangeUserControls()});try{mo.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['readonly','disabled']})}catch(_e){}
 window.addEventListener('storage',e=>{if([PROFILE_KEY,PROFILE_LOCK_KEY,DEVICE_KEY,ALIASES_KEY].includes(e.key)){applyProfileToFields()}});
 try{const ch=new BroadcastChannel(CHANNEL);ch.onmessage=()=>applyProfileToFields()}catch(_e){}
 setTimeout(()=>checkCentralReset(false),1200);setInterval(()=>checkCentralReset(false),20000);window.addEventListener('focus',()=>checkCentralReset(true));window.addEventListener('online',()=>checkCentralReset(true));window.addEventListener('mx-viewer-config-changed',()=>setTimeout(()=>checkCentralReset(true),200));
}

window.mxDeviceIdentityV2={version:4,deviceId,keyOf,isV2:v=>V2_RE.test(txt(v)),isV4:v=>V4_RE.test(txt(v)),legacyPreserved:()=>false,legacyDeviceId:()=>'',installInstance:()=>deviceId()};
window.mxUnifiedActivation={version:VERSION,txt,norm,code,label,deviceId,keyOf,baseState,applications,appState,cleanPerson,samePerson,prepareRequest,touchPatch,legacyIds,adoptLegacy};
window.mxActivationCoreV4={version:VERSION,deviceId,aliases:discoverAliases,allDeviceIds,profile,locked,saveProfile,clearProfile,applyProfileToFields,checkCentralReset};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
