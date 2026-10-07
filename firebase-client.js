import {guestName,guestEmail,guestCode,sha256} from './guest-utils.js?v=20261007-1';
import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {getAuth,onAuthStateChanged,createUserWithEmailAndPassword,EmailAuthProvider,linkWithCredential,updateProfile,signInWithEmailAndPassword,signOut} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {getFirestore,collection,collectionGroup,query,orderBy,limit,onSnapshot,getDoc,setDoc,doc,runTransaction,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import {firebaseConfig} from './firebase-config.js';
import {validateCart,priceItems,matchesOrder,problem} from './order-utils.js';
let auth,db;
const unpack=o=>({...o,createdAt:o.createdAt?.toMillis?.()??Date.now()});
export function connect(callbacks){
  if(Object.values(firebaseConfig).some(v=>!v||v.includes('YOUR_')))throw Error('Firebaseの接続設定が未入力です。導入説明書に沿って firebase-config.js を設定してください。');
  const app=initializeApp(firebaseConfig);auth=getAuth(app);db=getFirestore(app);let generation=0;
  onAuthStateChanged(auth,async user=>{const current=++generation;try{const admin=!!user&&!user.isAnonymous&&(await getDoc(doc(db,'admins',user.uid))).exists();if(current===generation)callbacks.auth(user,admin)}catch(e){callbacks.error(e);if(current===generation)callbacks.auth(user,false)}});
  onSnapshot(query(collection(db,'products'),orderBy('name'),limit(500)),s=>callbacks.products(s.docs.map(d=>({...d.data(),id:d.id}))),callbacks.error);
  onSnapshot(doc(db,'config','store'),s=>callbacks.config(!s.exists()||s.data().ordersEnabled===true),callbacks.error);
}
export async function guest(){await auth.authStateReady();if(!auth.currentUser||auth.currentUser.isAnonymous)throw problem('auth/login-required','注文するにはログインしてください。');if(auth.currentUser.email?.endsWith('@guest.cardport.invalid')&&!(await getDoc(doc(db,'guestMembers',auth.currentUser.uid))).exists())throw problem('failed-precondition','ゲスト登録が未完了です。新規登録から同じ名前・パスワードとコードで登録を完了してください。');return auth.currentUser}
export async function register(name,email,password){
 name=name.trim();email=email.trim();if(email.toLowerCase().endsWith('@guest.cardport.invalid'))throw Error('ゲスト会員の登録画面を使用してください。');if(!name||name.length>50)throw Error('名前は1〜50文字で入力してください。');
 await auth.authStateReady();
 const result=auth.currentUser?.isAnonymous?await linkWithCredential(auth.currentUser,EmailAuthProvider.credential(email,password)):await createUserWithEmailAndPassword(auth,email,password);
 try{await updateProfile(result.user,{displayName:name})}catch{throw Error('アカウントは作成されましたが名前を保存できませんでした。ログインして再設定してください。')}
 return result.user;
}
export async function login(identity,password){const email=identity.includes('@')?identity.trim():await guestEmail(identity);return (await signInWithEmailAndPassword(auth,email,password)).user}
export async function logout(){await signOut(auth)}
export async function isAdmin(user){return (await getDoc(doc(db,'admins',user.uid))).exists()}
export async function saveProduct(data){
  const ref=doc(db,'products',data.id);
  return runTransaction(db,async tx=>{const prior=await tx.get(ref);if((prior.exists()?prior.data().version:0)!==data.version)throw problem('aborted','別の画面で更新されました。編集を開き直してください。');if(prior.exists()&&prior.data().archived)throw problem('failed-precondition','削除済みの商品です。');const next={...(prior.exists()?prior.data():{}),...data,version:data.version+1,updatedAt:serverTimestamp()};tx.set(ref,next);return next});
}
export async function placeOrder(data){
  validateCart(data);const user=await guest();const ref=doc(db,'customers',user.uid,'orders',data.requestId);
  await runTransaction(db,async tx=>{
    const prior=await tx.get(ref);
    if(prior.exists()){if(!matchesOrder(prior.data(),data.items))throw problem('already-exists','同じ受付キーで異なる注文は送信できません。');return}
    const walletRef=doc(db,'wallets',user.uid);const wallet=await tx.get(walletRef);
    const snapshots=await Promise.all(data.items.map(i=>tx.get(doc(db,'products',i.id))));
    const items=priceItems(data.items,snapshots.filter(s=>s.exists()).map(s=>({...s.data(),id:s.id})));
    const total=items.reduce((sum,i)=>sum+i.price*i.quantity,0);if(!wallet.exists()||wallet.data().balance<total)throw problem('failed-precondition','PortPayのポイントが不足しています。管理者に付与を依頼してください。');
    tx.update(walletRef,{balance:wallet.data().balance-total,lastOrderId:data.requestId,updatedAt:serverTimestamp()});
    tx.set(ref,{customerName:(user.displayName||'').trim().slice(0,50),paymentMethod:'portpay',serial:'CP-'+user.uid+'-'+data.requestId,uid:user.uid,createdAt:serverTimestamp(),status:'received',items,productIds:items.map(i=>i.id),total:items.reduce((sum,i)=>sum+i.price*i.quantity,0)});
    for(const item of items){const p=snapshots.find(s=>s.id===item.id).data();tx.update(doc(db,'products',item.id),{stock:p.stock-item.quantity,version:p.version+1,lastStockOrder:user.uid+'/'+data.requestId,updatedAt:serverTimestamp()})}
  });
  return unpack((await getDoc(ref)).data());
}
export function watchOrders(user,admin,next,error){
  const source=admin?collectionGroup(db,'orders'):collection(db,'customers',user.uid,'orders');
  return onSnapshot(query(source,orderBy('createdAt','desc'),limit(100)),s=>next(s.docs.map(d=>unpack(d.data()))),error);
}

export function watchWallet(uid,next,error){return onSnapshot(doc(db,'wallets',uid),s=>next(s.exists()?s.data().balance:0),error)}
export async function grantPoints(uid,amount){
 uid=uid.trim();if(!/^[a-zA-Z0-9_-]{1,128}$/.test(uid)||!Number.isInteger(amount)||amount<1||amount>1000000)throw Error('利用者IDと1〜1,000,000の整数ポイントを入力してください。');
 const ref=doc(db,'wallets',uid);await runTransaction(db,async tx=>{const old=await tx.get(ref);const balance=(old.exists()?old.data().balance:0)+amount;if(balance>100000000)throw Error('残高の上限を超えています。');tx.set(ref,{balance,lastOrderId:old.exists()?old.data().lastOrderId:'',updatedAt:serverTimestamp()})});
}

export async function archiveProduct(id,version){
 const ref=doc(db,'products',id);await runTransaction(db,async tx=>{const old=await tx.get(ref);if(!old.exists()||old.data().archived)return;if(old.data().version!==version)throw problem('aborted','商品が更新されています。一覧から削除をやり直してください。');tx.update(ref,{archived:true,version:version+1,updatedAt:serverTimestamp()})});
}

export async function registerGuest(name,code,password){
 name=guestName(name);code=guestCode(code);if(password.length<8)throw Error('パスワードは8文字以上で設定してください。');
 const inviteId=await sha256(code);let invite;
 try{invite=await getDoc(doc(db,'guestInvites',inviteId))}catch(e){if(e.code==='permission-denied')throw Error('ゲスト作成用コードが違うか、無効になっています。');throw e}
 if(!invite.exists()||invite.data().enabled!==true)throw Error('ゲスト作成用コードが違うか、無効になっています。');
 await auth.authStateReady();const email=await guestEmail(name);let result;
 try{result=auth.currentUser?.isAnonymous?await linkWithCredential(auth.currentUser,EmailAuthProvider.credential(email,password)):await createUserWithEmailAndPassword(auth,email,password)}
 catch(e){if(e.code!=='auth/email-already-in-use'&&e.code!=='auth/credential-already-in-use')throw e;try{result=await signInWithEmailAndPassword(auth,email,password)}catch{throw Error('この名前は使用中です。別の名前を選ぶか、登録済みのパスワードでログインしてください。')}}
 const ref=doc(db,'guestMembers',result.user.uid),old=await getDoc(ref);
 if(!old.exists()){await updateProfile(result.user,{displayName:name});await setDoc(ref,{name,email,inviteId,createdAt:serverTimestamp()})}
 else if(!result.user.displayName){await updateProfile(result.user,{displayName:old.data().name})}
 return result.user;
}
export async function getGuestSignupCode(){
 await auth.authStateReady();if(!auth.currentUser||!(await isAdmin(auth.currentUser)))throw Error('管理者のみ確認できます。');
 const ref=doc(db,'config','guestSignup');const bytes=crypto.getRandomValues(new Uint8Array(16));const code='CPG-'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('').toUpperCase(),codeHash=await sha256(code);
 return runTransaction(db,async tx=>{const old=await tx.get(ref);if(old.exists())return old.data().code;tx.set(doc(db,'guestInvites',codeHash),{enabled:true,createdAt:serverTimestamp()});tx.set(ref,{code,codeHash,updatedAt:serverTimestamp()});return code});
}
