/* DİRİ — ortak kabuk (nav) + auth + davranışlar. Her sayfada güvenli. */
document.documentElement.classList.add('js');
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];

/* ---------- toast (global) ---------- */
let _tT; function toast(m){const t=$('#toast'); if(!t)return; t.textContent=m; t.classList.add('show'); clearTimeout(_tT); _tT=setTimeout(()=>t.classList.remove('show'),2300);}
window.toast=toast;

/* ---------- auth (gerçek backend: /api/auth/*) ---------- */
let _user=null;
function isAuthed(){return !!_user;}
function currentUser(){return _user;}
async function fetchMe(){try{const r=await fetch('/api/auth/me',{credentials:'same-origin'});const d=await r.json();_user=(d&&d.user)?d.user:null;}catch(e){_user=null;}return _user;}
async function apiAuth(path,body){
  const r=await fetch('/api/auth/'+path,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(body)});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d.error||'İşlem başarısız oldu.');
  _user=d.user||null; return _user;
}
async function apiLogout(){try{await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'});}catch(e){} _user=null;}
window.isAuthed=isAuthed; window.currentUser=currentUser;

/* ---------- FİYAT GÖRÜNÜRLÜĞÜ — TEK ANAHTAR ----------
   true  = fiyatlar herkese açık (giriş gerekmez) — rakip gibi
   false = fiyatlar üyelik/giriş arkasında (Herbalife "fiyat gizli" kuralına dönüş)
   Uyarı gelirse tek satır: PRICE_PUBLIC=false → tüm site anında giriş-arkası fiyata döner. */
const PRICE_PUBLIC=true;
window.PRICE_PUBLIC=PRICE_PUBLIC;

/* ---------- nav config (TEK kaynak) ---------- */
const LEAF='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21c5-3.5 8-7 8-11a8 8 0 0 0-16 0c0 4 3 7.5 8 11z"/><path d="M9 11c1.5 1 4.5 1 6 0"/></svg>';
/* Goodsoria amblemi — gerçek logodan vektörlenmiş 3 yapraklı filiz + orta damarlar (evenodd delik), fill=currentColor (koyu/açık zemine uyar) */
const MARK='<svg width="22" height="22" viewBox="5 2 14 14" fill="currentColor" fill-rule="evenodd" aria-hidden="true"><path d="M11.1 9.7 Q6.4 7.8 6 2.9 Q10.4 4.4 11.1 9.7 Z M11.5 9.7 Q11.5 4.6 14.3 2.7 Q15.6 6.4 11.5 9.7 Z M10.1 11 Q14.3 10.1 17.9 13.5 Q13.6 15.1 10.1 11 Z M10.6 9.2 Q8 7.2 6.7 3.5 Q9 6 10.6 9.2 Z M11.9 9.2 Q12 5.1 14 3.3 Q12.7 5.9 11.9 9.2 Z M10.8 11.1 Q14.2 10.8 17 13.2 Q14.2 12.4 10.8 11.1 Z"/></svg>';
const NAV_DISCOVER=[
  {href:'platform.html',page:'home',label:'Ana Sayfa',icon:'<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/>'},
  {href:'magaza.html',page:'magaza',label:'Mağaza',icon:'<path d="M3 9h18l-1.4 11a2 2 0 0 1-2 1.7H6.4a2 2 0 0 1-2-1.7L3 9z"/><path d="M8 9V6a4 4 0 0 1 8 0v3"/>'},
  {href:'bulucu.html',page:'bulucu',label:'Ürün Bulucu',icon:'<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/><path d="M11 8v6M8 11h6"/>'},
  {href:'distributor.html',page:'distributor',label:'Distribütör Ol',pill:'Kazanç',icon:'<path d="M3 17l5-5 4 4 8-8"/><path d="M16 8h4v4"/>'},
  {href:'topluluk.html',page:'topluluk',label:'Topluluk',icon:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/>'}
];
const NAV_ACCOUNT=[
  {href:'panel.html',page:'panel',label:'Panelim',auth:true,icon:'<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'}
];
const LOCKICO='<svg class="lockico" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" style="margin-left:auto;opacity:.6"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const cur=()=>document.body.dataset.page||'';

function navLink(it){
  const active=it.page===cur()?' active':'';
  const lockedNow=it.auth&&!isAuthed();
  let tail='';
  if(it.pill)tail='<span class="pill">'+it.pill+'</span>';
  else if(lockedNow)tail=LOCKICO;
  return `<a class="navlink${active}" href="${it.href}"${it.auth?' data-account':''}>`
    +`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${it.icon}</svg> ${it.label}${tail}</a>`;
}
function footCard(){
  if(isAuthed())
    return `<div class="sb-foot"><div class="sb-card"><span class="t">${LEAF.replace('width="22" height="22"','width="16" height="16"')} Hesabın</span><p>${_user?_user.name:'Üyelik aktif'}${_user&&_user.role&&_user.role!=='customer'?' · '+_user.role:''}</p><button class="btn btn-ghost btn-sm" id="logoutBtn" style="background:oklch(1 0 0/.08);color:#fff;box-shadow:none">Çıkış yap</button></div></div>`;
  return `<div class="sb-foot"><div class="sb-card"><span class="t"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 6v6c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6z"/></svg> Üye ol, kilidi aç</span><p>${unlockCopy()}</p><button class="btn btn-lime btn-sm" data-join>Ücretsiz üye ol</button></div></div>`;
}
function unlockCopy(){return PRICE_PUBLIC?'Kişisel plan, sipariş takibi ve ekip paneli üyelikte açılır.':'Fiyatlar, kişisel plan, sipariş takibi ve ekip paneli üyelikte açılır.';}
function renderSidebar(){
  const el=$('#sidebar')||$('.sidebar'); if(!el)return;
  el.innerHTML=`<a class="sb-brand" href="platform.html"><span class="mark">${MARK}</span><span><span class="nm">Goodsoria</span><br><span class="tag">Herbalife Platformu</span></span></a>`
    +`<div class="sb-sect">Keşfet</div>`+NAV_DISCOVER.map(navLink).join('')
    +`<div class="sb-sect">Hesabım</div>`+NAV_ACCOUNT.map(navLink).join('')
    +footCard();
}
function renderDrawer(){
  const el=$('#drawerPanel')||$('#drawer .panel'); if(!el)return;
  el.innerHTML=`<a class="sb-brand" href="platform.html"><span class="mark">${MARK}</span><span><span class="nm">Goodsoria</span><br><span class="tag">Herbalife Platformu</span></span></a>`
    +NAV_DISCOVER.concat(NAV_ACCOUNT).map(navLink).join('')+footCard();
}
const BOTNAV=[
  {href:'platform.html',page:'home',label:'Ana',icon:'<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/>'},
  {href:'magaza.html',page:'magaza',label:'Mağaza',icon:'<path d="M3 9h18l-1.4 11a2 2 0 0 1-2 1.7H6.4a2 2 0 0 1-2-1.7L3 9z"/><path d="M8 9V6a4 4 0 0 1 8 0v3"/>'},
  {href:'distributor.html',page:'distributor',label:'Kazan',icon:'<path d="M3 17l5-5 4 4 8-8"/><path d="M16 8h4v4"/>'},
  {href:'topluluk.html',page:'topluluk',label:'Topluluk',icon:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>'},
  {href:'panel.html',page:'panel',label:'Panel',auth:true,icon:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 12 0v1"/>'}
];
function renderBotnav(){
  const el=$('#botnav')||$('.botnav'); if(!el)return;
  el.innerHTML=BOTNAV.map(it=>`<a href="${it.href}" class="${it.page===cur()?'active':''}"${it.auth?' data-account':''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${it.icon}</svg>${it.label}</a>`).join('');
}

/* ---------- auth modal (tek sefer enjekte) ---------- */
let _pendingRedirect=null,_gateMode=false;
let _signupMode=false;
function buildAuthModal(){
  if($('#authmodal'))return;
  const d=document.createElement('div');
  d.className='modal';d.id='authmodal';d.setAttribute('role','dialog');d.setAttribute('aria-modal','true');d.hidden=true;
  d.innerHTML=`<div class="scrim" data-authclose></div><div class="panel">
    <div class="lg"><span class="m">${MARK.replace('width="22" height="22"','width="18" height="18"')}</span> Goodsoria Hesabı</div>
    <h3 id="auth-h">Giriş yap</h3>
    <p id="auth-p">Panelim ve sipariş takibin üyelikte açılır.</p>
    <div class="field" id="auth-namef" hidden style="margin-top:1.1rem"><label for="auth-name">Ad Soyad</label><input id="auth-name" type="text" placeholder="Adın soyadın" autocomplete="name"></div>
    <div class="field" id="auth-emailf" style="margin-top:1.1rem"><label for="auth-email">E-posta</label><input id="auth-email" type="email" placeholder="ornek@eposta.com" autocomplete="email"></div>
    <div class="field"><label for="auth-pass">Şifre</label><input id="auth-pass" type="password" placeholder="••••••••" autocomplete="current-password"></div>
    <p id="auth-err" style="color:var(--danger);font-size:.84rem;margin:.1rem 0 0;display:none"></p>
    <div class="acts"><button class="btn btn-primary" id="auth-go">Giriş yap</button><button class="btn btn-ghost" id="auth-cancel" data-authclose>Vazgeç</button></div>
    <p style="margin-top:.9rem;font-size:.84rem;color:var(--muted)"><span id="auth-switch-q">Hesabın yok mu?</span> <a href="#" id="auth-switch" style="color:var(--brand);font-weight:700">Ücretsiz üye ol</a></p>
  </div>`;
  document.body.appendChild(d);
  d.querySelectorAll('[data-authclose]').forEach(b=>b.addEventListener('click',closeAuth));
  $('#auth-go').addEventListener('click',doAuth);
  $('#auth-switch').addEventListener('click',e=>{e.preventDefault();setAuthMode(!_signupMode);});
  ['auth-email','auth-pass','auth-name'].forEach(id=>{const el=$('#'+id);if(el)el.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();doAuth();}});});
  addEventListener('keydown',e=>{if(e.key==='Escape'&&!d.hidden&&!_gateMode)closeAuth();});
}
function setAuthMode(signup){
  _signupMode=!!signup;
  $('#auth-namef').hidden=!_signupMode;
  $('#auth-h').textContent=_signupMode?'Ücretsiz üye ol':(_gateMode?'Bu alan üyelere özel':'Giriş yap');
  $('#auth-go').textContent=_signupMode?'Üye ol':'Giriş yap';
  $('#auth-switch-q').textContent=_signupMode?'Zaten hesabın var mı?':'Hesabın yok mu?';
  $('#auth-switch').textContent=_signupMode?'Giriş yap':'Ücretsiz üye ol';
  const e=$('#auth-err'); if(e)e.style.display='none';
}
function openAuth(opts){
  opts=opts||{};_pendingRedirect=opts.redirect||null;_gateMode=!!opts.gate;
  buildAuthModal();
  $('#auth-p').textContent=_gateMode?'Panelim ve Siparişlerim yalnızca giriş yaptıktan sonra görüntülenir.':'Panelim ve sipariş takibin üyelikte açılır.';
  $('#auth-cancel').textContent=_gateMode?'Ana sayfaya dön':'Vazgeç';
  setAuthMode(!!opts.signup);
  $('#authmodal').hidden=false;document.body.style.overflow='hidden';
  setTimeout(()=>{const f=$(_signupMode?'#auth-name':'#auth-email');if(f)f.focus();},60);
}
function closeAuth(){
  const d=$('#authmodal');if(d)d.hidden=true;document.body.style.overflow='';
  if(_gateMode&&!isAuthed()){location.href='platform.html';}
}
async function doAuth(){
  const err=$('#auth-err'); if(err)err.style.display='none';
  const email=($('#auth-email').value||'').trim(), pass=$('#auth-pass').value||'', nameEl=$('#auth-name'), name=nameEl?(nameEl.value||'').trim():'';
  const go=$('#auth-go'); const _t=go.textContent; go.disabled=true; go.textContent='…';
  try{
    if(_signupMode) await apiAuth('signup',{name,email,password:pass});
    else await apiAuth('login',{email,password:pass});
    const d=$('#authmodal');if(d)d.hidden=true;document.body.style.overflow='';
    if(_pendingRedirect){location.href=_pendingRedirect;return;}
    if(document.body.hasAttribute('data-requires-auth')){location.reload();return;}
    document.body.classList.remove('locked');
    renderSidebar();renderDrawer();renderBotnav();bindShell();
    toast(_signupMode?'Hesabın oluşturuldu ✓':'Giriş yapıldı ✓');
  }catch(ex){
    if(err){err.textContent=ex.message||'İşlem başarısız oldu.';err.style.display='block';}
  }finally{ go.disabled=false; go.textContent=_t; }
}

/* ---------- shell event binding (render sonrası) ---------- */
function bindShell(){
  $$('[data-join]').forEach(el=>{el.onclick=e=>{e.preventDefault();openAuth({signup:/üye\s*ol/i.test(el.textContent||'')});};});
  $$('[data-account]').forEach(el=>{el.onclick=e=>{if(!isAuthed()){e.preventDefault();openAuth({redirect:el.getAttribute('href')});}};});
  const lo=$('#logoutBtn'); if(lo)lo.onclick=async()=>{await apiLogout();if(document.body.hasAttribute('data-requires-auth')){location.href='platform.html';}else{renderSidebar();renderDrawer();renderBotnav();bindShell();toast('Çıkış yapıldı');}};
  if(isAuthed())$$('.topbar [data-join]').forEach(b=>{b.textContent='Hesabım';b.onclick=()=>location.href='panel.html';});
}

/* ---------- page guard ---------- */
function guardPage(){
  if(document.body.hasAttribute('data-requires-auth')&&!isAuthed()){
    document.body.classList.add('locked');
    openAuth({gate:true,redirect:location.pathname.split('/').pop()||'platform.html'});
  }
}

/* ---------- render shell + behaviors (önce gerçek oturumu çek) ---------- */
window.authReady=(async function init(){ await fetchMe(); renderSidebar();renderDrawer();renderBotnav();bindShell();guardPage(); loadFavs(); return _user; })();

/* ---------- SEPET (cart, localStorage) — KAYITSIZ satın alma ---------- */
const CART_KEY='goodsoria_cart';
function getCart(){try{return JSON.parse(localStorage.getItem(CART_KEY)||'[]')}catch(e){return[]}}
function saveCart(c){try{localStorage.setItem(CART_KEY,JSON.stringify(c))}catch(e){}updateCartCount();}
function cartCount(){return getCart().reduce((s,i)=>s+(i.qty||0),0);}
function updateCartCount(){const n=cartCount();$$('.cartcount').forEach(e=>{e.textContent=n;e.style.display=n>0?'':'';});}
function addToCart(item){
  if(!item||!item.name)return;
  const c=getCart(), ex=c.find(x=>x.id===item.id);
  if(ex)ex.qty++; else c.push({id:item.id,name:item.name,price:item.price||0,qty:1});
  saveCart(c); toast('Sepete eklendi ✓');
}
/* "Sepete ekle" butonundan: en yakın ürün kartından isim+fiyat oku */
function cartAddFromBtn(btn){
  const card=btn.closest('.pcard'); if(!card)return;
  const h=card.querySelector('h3'); if(!h)return;
  const name=h.textContent.trim();
  const pe=card.querySelector('.price'); const price=pe?(parseInt(pe.textContent.replace(/[^0-9]/g,''))||0):0;
  addToCart({id:name.toLowerCase(),name:name,price:price});
}
window.addToCart=addToCart; window.getCart=getCart; window.saveCart=saveCart; window.cartCount=cartCount; window.updateCartCount=updateCartCount; window.cartAddFromBtn=cartAddFromBtn;
window.addCart=()=>{}; /* eski API uyumu (no-op) */
$$('.add').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();cartAddFromBtn(b);}));
const _cb=$('#cartBtn'); if(_cb)_cb.addEventListener('click',()=>{location.href='sepet.html';});
updateCartCount();

/* ---------- FAVORİLER (gerçek, /api/favorites — giriş gerekli) ---------- */
let _favs=new Set();
function favKey(btn){const c=btn.closest('.pcard'),h=c&&c.querySelector('h3');return h?h.textContent.trim().toLowerCase():'';}
function paintFav(b,on){b.classList.toggle('on',on);b.style.color=on?'var(--brand)':'';}
function refreshFavButtons(){$$('.fav').forEach(b=>{const k=favKey(b);if(k)paintFav(b,_favs.has(k));});}
async function loadFavs(){if(!isAuthed())return;try{const r=await fetch('/api/favorites',{credentials:'same-origin'});const d=await r.json();_favs=new Set(d.favorites||[]);refreshFavButtons();}catch(e){}}
async function toggleFav(btn){
  if(!isAuthed()){openAuth({});return;}
  const k=favKey(btn);if(!k)return;
  paintFav(btn,!_favs.has(k));
  try{const r=await fetch('/api/favorites/toggle',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({product:k})});const d=await r.json();if(d.favorited)_favs.add(k);else _favs.delete(k);paintFav(btn,!!d.favorited);if(!d.favorited)toast('Favoriden çıkarıldı');else toast('Favorilere eklendi ♥');}catch(e){paintFav(btn,_favs.has(k));}
}
window.toggleFav=toggleFav; window.refreshFavButtons=refreshFavButtons; window.loadFavs=loadFavs; window.favCount=()=>_favs.size; window.getFavs=()=>[..._favs];
$$('.fav').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();e.preventDefault();toggleFav(b);}));

/* search shortcut */
addEventListener('keydown',e=>{if(e.key==='/'&&document.activeElement.tagName!=='INPUT'&&document.activeElement.tagName!=='TEXTAREA'){const q=$('#q'); if(q){e.preventDefault();q.focus();}}});

/* mobile drawer */
const _drawer=$('#drawer'), _mb=$('#menuBtn');
if(_mb&&_drawer)_mb.addEventListener('click',()=>_drawer.setAttribute('open',''));
if(_drawer)_drawer.querySelectorAll('[data-dclose]').forEach(b=>b.addEventListener('click',()=>_drawer.removeAttribute('open')));

/* reveal + progress fills */
const _els=$$('[data-reveal]');
if(matchMedia('(prefers-reduced-motion: no-preference)').matches && 'IntersectionObserver' in window){
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}}),{rootMargin:'0px 0px -8% 0px',threshold:.08});
  _els.forEach(el=>io.observe(el)); setTimeout(()=>_els.forEach(el=>el.classList.add('in')),1500);
}else _els.forEach(el=>el.classList.add('in'));
if('IntersectionObserver' in window){
  const fio=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){const i=e.target;i.style.width=i.dataset.fill+'%';fio.unobserve(i);}}),{threshold:.4});
  $$('[data-fill]').forEach(i=>fio.observe(i));
}else $$('[data-fill]').forEach(i=>i.style.width=i.dataset.fill+'%');

/* entry modal (yalnız ana sayfa) — session başına 1 */
const _modal=$('#entry');
if(_modal && !sessionStorage.getItem('diri_entry_seen')){
  document.body.style.overflow='hidden';
  const close=()=>{_modal.hidden=true;document.body.style.overflow='';sessionStorage.setItem('diri_entry_seen','1');};
  _modal.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',close));
  addEventListener('keydown',e=>{if(e.key==='Escape'&&!_modal.hidden)close();});
}else if(_modal){_modal.hidden=true;}
