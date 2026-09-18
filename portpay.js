import * as api from './firebase-client.js?v=20260918-2';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),fmt=n=>n.toLocaleString('ja-JP');
let user=null,stopWallet,stopHistory,paying=false,pending=null,products=[],enabled=false;
const requestId=new URLSearchParams(location.search).get('checkout');
try{pending=JSON.parse(localStorage.getItem('cp-spark-pending')||'null')}catch{}
function checkoutView(){
 const valid=requestId&&pending&&pending.requestId===requestId&&pending.uid===user?.uid;
 $('#payment-panel').hidden=!valid;$('#pay').disabled=paying||!enabled;$('#cancel-payment').disabled=paying||!!pending?.paymentAttempted;
 if(requestId&&!valid)$('#status').textContent='このアカウントで確認できる支払いがありません。ショップのカートからやり直してください。';
 if(!valid)return;
 const items=pending.items.map(i=>({...i,p:products.find(p=>p.id===i.id)}));
 $('#payment-items').innerHTML=items.map(i=>`<p>${esc(i.p?.name||'商品を確認中…')} × ${i.quantity}</p>`).join('');
 $('#payment-total').textContent=fmt(items.reduce((s,i)=>s+i.expectedPrice*i.quantity,0))+' pt';
}
api.connect({auth(next,admin){user=next;if(stopWallet)stopWallet();if(stopHistory)stopHistory();const member=!!next&&!next.isAnonymous;$('#wallet-area').hidden=!member;$('#signed-out').hidden=member;$('#grant-panel').hidden=!admin;$('#status').textContent='';if(!member)return;$('#account-name').textContent=next.displayName||'CARD PORT メンバー';$('#account-id').value=next.uid;stopWallet=api.watchWallet(next.uid,n=>$('#balance').textContent=fmt(n),error);stopHistory=api.watchOrders(next,false,rows=>{$('#history').innerHTML=rows.filter(o=>o.paymentMethod==='portpay').map(o=>`<div class="history-row"><strong>−${fmt(o.total)} pt</strong><p>${esc(new Date(o.createdAt).toLocaleString('ja-JP'))}</p><code>${esc(o.serial)}</code></div>`).join('')||'<p>まだお支払いはありません。</p>'},error);checkoutView()},products(rows){products=rows;checkoutView()},config(value){enabled=value;checkoutView()},error});
function error(e){$('#status').textContent=e.code?.includes('permission-denied')?'この操作は許可されていません。ログイン状態を確認してください。':e.message||'通信に失敗しました。'}
$('#pay').onclick=async()=>{
 if(paying||!user||user.isAnonymous||!pending||pending.uid!==user.uid)return;
 paying=true;pending.paymentAttempted=true;try{localStorage.setItem('cp-spark-pending',JSON.stringify(pending))}catch{paying=false;error(Error('ブラウザーの保存を許可してください。'));return;}$('#cancel-payment').disabled=true;$('#pay').disabled=true;$('#payment-status').textContent='支払い結果を確認しています…';
 try{const order=await api.placeOrder({requestId:pending.requestId,items:pending.items});$('#receipt-serial').textContent=order.serial;$('#receipt').hidden=false;$('#payment-panel').hidden=true;localStorage.removeItem('cp-spark-pending');localStorage.setItem('cp-spark-cart','{}');pending=null;history.replaceState(null,'','portpay.html');$('#status').textContent='';}
 catch(e){if(['failed-precondition','invalid-argument','permission-denied','not-found'].includes(e.code)){pending.paymentAttempted=false;localStorage.setItem('cp-spark-pending',JSON.stringify(pending));$('#cancel-payment').disabled=false;}$('#payment-status').textContent=(e.message||'通信に失敗しました。')+' 再試行しても同じ注文が二重に引き落とされることはありません。';}
 finally{paying=false;$('#pay').disabled=false;}
};
$('#grant-form').onsubmit=async e=>{e.preventDefault();const form=e.target,button=form.querySelector('button'),d=new FormData(form);button.disabled=true;$('#grant-status').textContent='付与中…';try{await api.grantPoints(d.get('uid'),Number(d.get('amount')));$('#grant-status').textContent='ポイントを付与しました。';form.reset()}catch(e){$('#grant-status').textContent=e.message||'付与できませんでした。'}finally{button.disabled=false}};

$('#cancel-payment').onclick=()=>{if(paying||pending?.paymentAttempted)return;localStorage.removeItem('cp-spark-pending');location.href='./';};
