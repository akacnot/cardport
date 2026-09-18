const $=s=>document.querySelector(s);
const yen=n=>'¥'+n.toLocaleString('ja-JP');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const PRODUCTS=[];let api,game='ポケモンカード',cart={},orders=[],user=null,adminSignedIn=false,ready=false,ordersEnabled=false,submitting=false,pending=null,stopOrders=null;
try{cart=JSON.parse(localStorage.getItem('cp-spark-cart')||'{}');if(!cart||typeof cart!=='object'||Array.isArray(cart))cart={};for(const id of Object.keys(cart))if(!/^[a-zA-Z0-9_-]{1,80}$/.test(id)||!Number.isInteger(cart[id])||cart[id]<1||cart[id]>99)delete cart[id];pending=JSON.parse(localStorage.getItem('cp-spark-pending')||'null')}catch{cart={};pending=null}
function save(){try{localStorage.setItem('cp-spark-cart',JSON.stringify(cart))}catch{}$('#cart-count').textContent=Object.values(cart).reduce((a,b)=>a+b,0);return true}
function render(){const term=$('#search').value.trim().toLowerCase(),price=$('#price').value,type=document.querySelector('[name=type]:checked').value;let list=PRODUCTS.filter(p=>p.game===game&&p.name.toLowerCase().includes(term)&&(type==='all'||p.type===type)&&(!$('#in-stock').checked||p.stock>0)&&(price==='all'||price==='low'&&p.price<1000||price==='mid'&&p.price>=1000&&p.price<5000||price==='high'&&p.price>=5000));const sort=$('#sort').value;if(sort==='price-asc')list.sort((a,b)=>a.price-b.price);if(sort==='price-desc')list.sort((a,b)=>b.price-a.price);if(sort==='name')list.sort((a,b)=>a.name.localeCompare(b.name,'ja'));$('#results-count').textContent=list.length;$('#products').innerHTML=list.map((p,i)=>`<article class="product"><button class="image-button" data-detail="${esc(p.id)}" aria-label="${esc(p.name)}の詳細">${p.badge?`<span class="badge ${p.badge==='NEW'?'new':''}">${esc(p.badge)}</span>`:''}${productImage(p,i>2)}</button><p class="product-meta">${esc(p.series)} · ${esc(p.rarity)}</p><button class="product-name" data-detail="${esc(p.id)}">${esc(p.name)}</button><div class="price-row"><span class="price">${yen(p.price)}<small>税込</small></span><span class="stock ${p.stock?'':'sold'}">${p.stock?'在庫あり':'SOLD OUT'}</span></div><button class="add" data-add="${esc(p.id)}" ${p.stock?'':'disabled'}>${p.stock?'＋ カートに入れる':'売り切れ'}</button></article>`).join('');$('#empty').hidden=!!list.length;$('#catalog-name').textContent=game;$('#crumb').textContent=game}
function reset(){game='ポケモンカード';$('#search').value='';$('#price').value='all';$('#sort').value='featured';$('#in-stock').checked=false;document.querySelector('[name=type][value=all]').checked=true;document.querySelectorAll('[data-game]').forEach(b=>b.classList.toggle('active',b.dataset.game===game));render()}
let toastTimer;function toast(msg){$('#toast').textContent=msg;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),2500)}
function add(id){if(pending||submitting){toast("送信済み注文の結果を先に確認してください。");return}const p=PRODUCTS.find(p=>p.id===id);if(!p)return;if((cart[id]||0)>=Math.min(p.stock,99)){toast('在庫の上限に達しました');return}const previous=cart[id]||0;cart[id]=previous+1;if(!save()){if(previous)cart[id]=previous;else delete cart[id];$('#cart-count').textContent=Object.values(cart).reduce((a,b)=>a+b,0);return}toast('カートに追加しました');if($('#cart-dialog').open)renderCart()}
function renderCart(){$('#checkout').disabled=!ready||!ordersEnabled||submitting||!Object.keys(cart).length;$('#cart-items').innerHTML=Object.entries(cart).map(([id,q])=>{const p=PRODUCTS.find(p=>p.id===id)||{id,name:'販売終了の商品',price:0,stock:0,image:''};return `<div class="cart-row">${productImage(p)}<div class="cart-row-content"><h3>${esc(p.name)}</h3><p>${yen(p.price)} × ${q}</p><div class="quantity"><button data-minus="${id}" aria-label="${esc(p.name)}を1枚減らす">−</button><span>${q}</span><button data-add="${id}" aria-label="${esc(p.name)}を1枚増やす" ${q>=p.stock?'disabled':''}>＋</button></div></div><button class="remove" data-remove="${id}">削除</button></div>`}).join('')||'<p class="dialog-intro">カートに商品が入っていません。</p>';$('#cart-total').textContent=yen(Object.entries(cart).reduce((s,[id,q])=>s+(PRODUCTS.find(p=>p.id===id)?.price||0)*q,0))}
function detail(id){const p=PRODUCTS.find(p=>p.id===id);$('#detail-dialog').innerHTML=`<button class="close" data-close aria-label="閉じる">×</button><p class="eyebrow">CARD DETAILS</p><div class="detail-image">${productImage(p)}</div><p class="product-meta">${esc(p.series)} · ${esc(p.rarity)}</p><h2>${esc(p.name)}</h2><p class="price">${yen(p.price)}<small>税込</small></p><p class="dialog-intro">在庫：${p.stock} 枚</p><button class="primary full" data-add="${id}" ${p.stock?'':'disabled'}>${p.stock?'カートに入れる':'売り切れ'}</button><p class="sample-note">商品画像・状態は店舗の掲載情報をご確認ください。</p>`;$('#detail-dialog').showModal()}

function safeImage(url){try{const u=new URL(url);return u.protocol==='https:'?u.href:''}catch{return ''}}
function productImage(p,lazy=false){const url=safeImage(p.image);return url?`<img src="${esc(url)}" alt="${esc(p.name)}" ${lazy?'loading="lazy"':''}>`:'<span class="no-image">画像未登録</span>'}
const editor=$('#product-form');
function message(error){const code=String(error?.code||'');if(code.startsWith('auth/'))return 'ログインできませんでした。メールアドレス・パスワード・認証設定を確認してください。';if(code.includes('permission-denied'))return '保存できません。権限・注文受付の設定、最新の価格と在庫を確認してください。';return error?.message||'通信に失敗しました。再試行してください。'}
function connectionError(error){$('#connection-status').textContent=message(error);$('#connection-status').hidden=false;toast(message(error))}
function orderList(){return orders.map(o=>`<article class="order-record"><code class="serial">${esc(o.serial)}</code><p>${esc(new Date(o.createdAt).toLocaleString('ja-JP'))} · ${o.paymentMethod==='portpay'?'PortPay支払済み':'受付済み'}</p><ul>${o.items.map(i=>`<li>${esc(i.name)} × ${i.quantity} <b>${yen(i.price*i.quantity)}</b></li>`).join('')}</ul><strong>合計 ${yen(o.total)}（税込）</strong></article>`).join('')||'<p class="dialog-intro">注文はありません。</p>'}
function resetEditor(){editor.reset();editor.elements.id.value='';editor.elements.version.value='0';$('#editor-title').textContent='カードを追加';$('#editor-error').textContent=''}
function renderAdmin(){
 if(!adminSignedIn)return;
 const term=$('#admin-search').value.trim().normalize('NFKC').toLocaleLowerCase('ja'),type=$('#admin-type').value;
 const list=PRODUCTS.filter(p=>(type==='all'||p.type===type)&&[p.name,p.series,p.rarity,p.game,p.id].some(v=>String(v??'').normalize('NFKC').toLocaleLowerCase('ja').includes(term)));
 $('#admin-product-count').textContent='（'+list.length+' / '+PRODUCTS.length+'件）';
 $('#admin-products').innerHTML=list.map(p=>`<div class="admin-product"><div><strong>${esc(p.name)}</strong><p>${esc(p.game)} · ${p.type==='box'?'パック・BOX':'シングルカード'} · ${yen(p.price)} · 在庫 ${p.stock}</p></div><button class="add" data-edit="${esc(p.id)}">編集</button></div>`).join('')||'<p class="dialog-intro">条件に一致する登録済み商品はありません。</p>';
 $('#admin-orders').innerHTML=orderList();
}
$('#admin-search').oninput=renderAdmin;
$('#admin-type').onchange=renderAdmin;
function openAdmin(){if(!api){toast('Firebaseへの接続を確認してください。');return}if(adminSignedIn){renderAdmin();$('#admin-dialog').showModal()}else{$('#admin-login-error').textContent='';$('#admin-login-dialog').showModal()}}
function startHistory(){if(stopOrders)stopOrders();orders=[];$('#orders-list').innerHTML='<p>読み込み中…</p>';$('#admin-orders').innerHTML='';if(!user){$('#orders-list').innerHTML='<p>この利用者の注文はありません。</p>';return}stopOrders=api.watchOrders(user,adminSignedIn,rows=>{orders=rows;$('#orders-list').innerHTML=orderList();if(adminSignedIn)renderAdmin()},e=>{$('#orders-list').textContent=message(e);$('#admin-orders').textContent=message(e)})}
function showPending(){$('#pending-banner').hidden=!pending;$('#checkout').textContent=pending?'PortPayで注文を確認':'PortPayで支払う'}
function clearPending(){pending=null;try{localStorage.removeItem('cp-spark-pending')}catch{}showPending()}
async function checkout(){
  if(!api||submitting)return;
  if(!user||user.isAnonymous){$('#cart-dialog').close();$('#login-message').textContent='注文するにはログインまたは新規登録してください。';$('#login-dialog').showModal();return;}
  submitting=true;$('#checkout').disabled=true;$('#retry-order').disabled=true;
  try{
    const customer=await api.guest();
    if(pending&&pending.uid!==customer.uid)throw Error('この注文を送信した利用者と異なります。元のアカウントで確認してください。');
    if(!pending){
      if(!ordersEnabled)throw Error('現在、注文受付を停止しています。');
      const items=Object.entries(cart).map(([id,quantity])=>{const p=PRODUCTS.find(p=>p.id===id);if(!p)throw Error('販売終了の商品をカートから削除してください。');return {id,quantity,expectedPrice:p.price}});
      if(items.length===0)throw Error('カートが空です。');
      if(items.length>6)throw Error('1回の注文は6種類までです。');
      const candidate={uid:customer.uid,requestId:crypto.randomUUID(),items};
      try{localStorage.setItem('cp-spark-pending',JSON.stringify(candidate))}catch{throw Error('二重注文を防ぐため、ブラウザーのデータ保存を許可してください。')}
      pending=candidate;showPending();
    }
    location.href='./portpay.html?checkout='+encodeURIComponent(pending.requestId);
  }catch(e){
    // 結果不明の通信エラーではキーを維持し、同じ注文を安全に再照会する。
    if(['invalid-argument','failed-precondition','not-found','permission-denied'].includes(e.code))clearPending();
    toast(message(e));$('#connection-status').textContent=message(e);$('#connection-status').hidden=false;
  }finally{submitting=false;$('#retry-order').disabled=false;renderCart();showPending()}
}
async function doLogin(form,adminOnly){
  const target=adminOnly?$('#admin-login-error'):$('#login-message'),button=form.querySelector('[type=submit],button');if(!api){target.textContent='Firebaseへの接続設定を確認してください。';return}
  if(pending){target.textContent='送信済み注文の結果を先に確認してください。';return}
  button.disabled=true;target.textContent='ログイン中…';
  try{const data=new FormData(form);const signedIn=await api.login(data.get(adminOnly?'username':'email'),data.get('password'));const allowed=await api.isAdmin(signedIn);if(adminOnly&&!allowed){await api.logout();throw Error('このアカウントには管理者権限がありません。')}form.reset();form.closest('dialog').close();toast('ログインしました');if(allowed){adminSignedIn=true;resetEditor();renderAdmin();$('#admin-dialog').showModal()}}
  catch(e){target.textContent=message(e)}finally{button.disabled=false}
}
async function doLogout(){if(pending){toast('送信済み注文の結果を先に確認してください。');return}try{await api.logout();$('#admin-dialog').close();toast('ログアウトしました')}catch(e){toast(message(e))}}
$('#register-open').onclick=()=>{$('#login-dialog').close();$('#register-message').textContent='';$('#register-dialog').showModal()};
$('#register-form').onsubmit=async e=>{e.preventDefault();if(!api)return;const form=e.target,button=form.querySelector('button[type=submit]');button.disabled=true;$('#register-message').textContent='登録中…';try{const d=new FormData(form);await api.register(d.get('name'),d.get('email'),d.get('password'));form.reset();$('#register-dialog').close();toast('登録しました。注文できます。')}catch(error){$('#register-message').textContent=error.code==='auth/email-already-in-use'?'このメールアドレスは登録済みです。ログインしてください。':message(error)}finally{button.disabled=false}};
$('#login-form').onsubmit=e=>{e.preventDefault();doLogin(e.target,false)};
$('#admin-login-form').onsubmit=e=>{e.preventDefault();doLogin(e.target,true)};
$('#admin-logout').onclick=doLogout;$('#account-logout').onclick=doLogout;
$('#admin-open').onclick=openAdmin;$('#admin-from-login').onclick=()=>{$('#login-dialog').close();openAdmin()};
$('#editor-new').onclick=resetEditor;
editor.onsubmit=async e=>{
  e.preventDefault();if(!adminSignedIn)return;const submit=editor.querySelector('[type=submit]');submit.disabled=true;$('#editor-error').textContent='保存中…';
  try{const d=new FormData(editor),id=d.get('id')||crypto.randomUUID();const product={id,version:Number(d.get('version')||0),price:Number(d.get('price')),stock:Number(d.get('stock'))};for(const key of ['name','game','type','series','rarity','image','badge'])product[key]=d.get(key).trim();await api.saveProduct(product);resetEditor();toast('カードを保存しました')}
  catch(e){$('#editor-error').textContent=message(e)}finally{submit.disabled=false}
};
$('#checkout').onclick=checkout;$('#retry-order').onclick=checkout;
$('#orders-open').onclick=()=>{$('#orders-list').innerHTML=orderList();$('#orders-dialog').showModal()};
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-close'))b.closest('dialog').close();
  if(b.dataset.add)add(b.dataset.add);if(b.dataset.detail)detail(b.dataset.detail);
  if(b.dataset.game){game=b.dataset.game;document.querySelectorAll('[data-game]').forEach(el=>el.classList.toggle('active',el===b));render()}
  if(b.dataset.minus||b.dataset.remove){if(pending||submitting){toast('送信済み注文の結果を先に確認してください。');return}const id=b.dataset.minus||b.dataset.remove;if(b.dataset.remove||--cart[id]<=0)delete cart[id];save();renderCart()}
  if(b.dataset.edit&&adminSignedIn){const p=PRODUCTS.find(p=>p.id===b.dataset.edit);if(!p)return;for(const field of ['id','version','name','game','type','price','stock','series','rarity','image','badge'])editor.elements[field].value=p[field]??'';$('#editor-title').textContent='カードを編集';$('#editor-error').textContent='';editor.elements.name.focus()}
});
$('#search-form').onsubmit=e=>{e.preventDefault();render()};$('#search').oninput=render;
document.querySelectorAll('aside input,aside select,#sort').forEach(el=>el.addEventListener('change',render));$('#reset').onclick=reset;$('#empty-reset').onclick=reset;
$('#login-open').onclick=()=>{$('#login-message').textContent='';$('#login-dialog').showModal()};
$('#cart-open').onclick=()=>{renderCart();$('#cart-dialog').showModal()};
document.querySelectorAll('dialog').forEach(d=>{d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close()}});d.addEventListener('close',()=>{d.querySelectorAll('input[type=password]').forEach(i=>i.value='')})});
save();render();showPending();
try{
  const client=await import('./firebase-client.js?v=20260918-2');
  client.connect({
    auth(next,admin){user=next;adminSignedIn=admin;$('#admin-open').textContent=admin?'管理画面':'管理者ログイン';$('#account-logout').hidden=!next||next.isAnonymous;if(!admin&&$('#admin-dialog').open)$('#admin-dialog').close();startHistory()},
    products(rows){PRODUCTS.splice(0,PRODUCTS.length,...rows);ready=true;render();renderCart();renderAdmin();$('#connection-status').textContent=ordersEnabled?'商品・在庫は最新の情報です。':'商品をご覧いただけます。現在、注文受付は停止中です。'},
    config(enabled){ordersEnabled=enabled;renderCart();$('#connection-status').textContent=enabled?'注文にはログインが必要です。PortPayポイントでお支払いできます。':'商品をご覧いただけます。現在、注文受付は停止中です。'},
    error:connectionError
  });
  api=client;
}catch(e){connectionError(e);$('#checkout').disabled=true}

