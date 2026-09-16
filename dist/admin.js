// ローカルデモ専用。本番ではサーバー側認証・権限チェックに置き換えてください。
const DEMO_ADMIN = { username: 'admin', password: 'CardPort2026!' };
let adminSignedIn = false;
const editor = $('#product-form');
function openAdmin(){
  if(adminSignedIn){renderAdmin();$('#admin-dialog').showModal();return}
  $('#admin-login-error').textContent='';$('#admin-login-dialog').showModal();
}
$('#admin-open').onclick=openAdmin;
$('#admin-from-login').onclick=()=>{$('#login-dialog').close();openAdmin()};
$('#admin-login-form').onsubmit=e=>{
  e.preventDefault();const data=new FormData(e.target);
  if(data.get('username')!==DEMO_ADMIN.username||data.get('password')!==DEMO_ADMIN.password){$('#admin-login-error').textContent='管理者IDまたはパスワードが違います。';return}
  adminSignedIn=true;e.target.reset();$('#admin-login-dialog').close();$('#admin-open').textContent='管理画面';resetEditor();openAdmin();
};
$('#admin-logout').onclick=()=>{adminSignedIn=false;$('#admin-dialog').close();$('#admin-open').textContent='管理者ログイン';editor.reset();toast('ログアウトしました')};
function resetEditor(){editor.reset();editor.elements.id.value='';$('#editor-title').textContent='カードを追加';$('#editor-error').textContent=''}
$('#editor-new').onclick=resetEditor;
function renderAdmin(){
  if(!adminSignedIn)return;
  $('#admin-product-count').textContent=`（${PRODUCTS.length}件）`;
  $('#admin-products').innerHTML=PRODUCTS.map(p=>`<div class="admin-product"><div><strong>${esc(p.name)}</strong><p>${esc(p.game)} · ${yen(p.price)} · 在庫 ${p.stock}</p></div><button class="add" data-edit="${esc(p.id)}">編集</button></div>`).join('');
  $('#admin-orders').innerHTML=orderList();
}
function orderList(){return [...orders].reverse().map(o=>`<article class="order-record"><code class="serial">${esc(o.serial)}</code><p>${esc(new Date(o.createdAt).toLocaleString('ja-JP'))} · デモ受付</p><ul>${o.items.map(item=>`<li>${esc(item.name)} × ${item.quantity} <b>${yen(item.price*item.quantity)}</b></li>`).join('')}</ul><strong>合計 ${yen(o.total)}（税込）</strong></article>`).join('')||'<p class="dialog-intro">まだ注文はありません。</p>'}
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-edit]');if(!b||!adminSignedIn)return;
  const p=PRODUCTS.find(p=>p.id===b.dataset.edit);if(!p)return;
  for(const field of ['id','name','game','type','price','stock','series','rarity','image','badge'])editor.elements[field].value=p[field]??'';
  $('#editor-title').textContent='カードを編集';$('#editor-error').textContent='';editor.elements.name.focus();
});
editor.onsubmit=e=>{
  e.preventDefault();if(!adminSignedIn)return;
  const d=new FormData(editor),price=Number(d.get('price')),stock=Number(d.get('stock')),name=d.get('name').trim(),image=d.get('image').trim();
  if(!name||!Number.isSafeInteger(price)||price<0||price>100000000||!Number.isSafeInteger(stock)||stock<0||stock>1000000){$('#editor-error').textContent='カード名・価格・在庫数を確認してください。';return}
  if(image&&!safeImage(image)){$('#editor-error').textContent='画像URLは https:// で始まるアドレスを入力してください。';return}
  const existingId=d.get('id');
  if(existingId&&!PRODUCTS.some(p=>p.id===existingId)){$('#editor-error').textContent='編集対象が見つかりません。';return}
  const product={id:existingId||'card-'+crypto.randomUUID(),name,price,stock,image,game:d.get('game'),type:d.get('type'),series:d.get('series').trim(),rarity:d.get('rarity').trim(),badge:d.get('badge')};
  const next=existingId?PRODUCTS.map(p=>p.id===existingId?product:p):[...PRODUCTS,product];
  const nextCart={...cart};if(nextCart[product.id]){nextCart[product.id]=Math.min(nextCart[product.id],stock);if(!nextCart[product.id])delete nextCart[product.id]}
  if(!writeState(next,orders,nextCart)){$('#editor-error').textContent='保存できませんでした。画面下部の案内を確認してください。';return}
  PRODUCTS.splice(0,PRODUCTS.length,...next);cart=nextCart;$('#cart-count').textContent=Object.values(cart).reduce((a,b)=>a+b,0);render();renderAdmin();resetEditor();toast(existingId?'カードを更新しました':'カードを追加しました');
};
$('#checkout').onclick=()=>{
  if(!Object.keys(cart).length)return;
  const items=[];
  for(const [id,quantity] of Object.entries(cart)){
    const p=PRODUCTS.find(p=>p.id===id);
    if(!p||!Number.isSafeInteger(quantity)||quantity<1||quantity>p.stock){toast('在庫が変更されました。カートを確認してください。');renderCart();return}
    items.push({id,name:p.name,price:p.price,quantity});
  }
  const now=new Date();let serial;
  do{serial='CP-'+now.toISOString().slice(0,10).replaceAll('-','')+'-'+crypto.randomUUID().replaceAll('-','').toUpperCase()}while(orders.some(o=>o.serial===serial));
  const order={serial,createdAt:now.toISOString(),items,total:items.reduce((sum,i)=>sum+i.price*i.quantity,0)};
  const nextProducts=PRODUCTS.map(p=>({...p,stock:p.stock-(cart[p.id]||0)}));
  // 商品在庫・注文・カートを一つの保存値で更新。保存失敗時には注文を確定しない。
  if(!writeState(nextProducts,[...orders,order],{}))return;
  PRODUCTS.splice(0,PRODUCTS.length,...nextProducts);orders.push(order);cart={};$('#cart-count').textContent='0';$('#checkout').disabled=true;render();
  $('#cart-dialog').close();$('#order-serial').textContent=serial;
  $('#order-summary').innerHTML=`<ul>${items.map(i=>`<li>${esc(i.name)} × ${i.quantity}</li>`).join('')}</ul><p class="cart-total">合計（税込） <b>${yen(order.total)}</b></p>`;
  $('#order-dialog').showModal();
};
$('#orders-open').onclick=()=>{$('#orders-list').innerHTML=orderList();$('#orders-dialog').showModal()};
$('#admin-login-dialog').addEventListener('close',()=>$('#admin-login-form').reset());
