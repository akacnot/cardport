import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signInAnonymously,signInWithEmailAndPassword,signOut} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {getFirestore,collection,collectionGroup,query,orderBy,limit,onSnapshot,getDoc,doc,runTransaction,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
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
export async function guest(){await auth.authStateReady();return auth.currentUser||(await signInAnonymously(auth)).user}
export async function login(email,password){return (await signInWithEmailAndPassword(auth,email,password)).user}
export async function logout(){await signOut(auth)}
export async function isAdmin(user){return (await getDoc(doc(db,'admins',user.uid))).exists()}
export async function saveProduct(data){
  const ref=doc(db,'products',data.id);
  return runTransaction(db,async tx=>{const prior=await tx.get(ref);if((prior.exists()?prior.data().version:0)!==data.version)throw problem('aborted','別の画面で更新されました。編集を開き直してください。');const next={...data,version:data.version+1,updatedAt:serverTimestamp()};tx.set(ref,next);return next});
}
export async function placeOrder(data){
  validateCart(data);const user=await guest();const ref=doc(db,'customers',user.uid,'orders',data.requestId);
  await runTransaction(db,async tx=>{
    const prior=await tx.get(ref);
    if(prior.exists()){if(!matchesOrder(prior.data(),data.items))throw problem('already-exists','同じ受付キーで異なる注文は送信できません。');return}
    const snapshots=await Promise.all(data.items.map(i=>tx.get(doc(db,'products',i.id))));
    const items=priceItems(data.items,snapshots.filter(s=>s.exists()).map(s=>({...s.data(),id:s.id})));
    tx.set(ref,{serial:'CP-'+user.uid+'-'+data.requestId,uid:user.uid,createdAt:serverTimestamp(),status:'received',items,productIds:items.map(i=>i.id),total:items.reduce((sum,i)=>sum+i.price*i.quantity,0)});
    // 個人用：在庫は管理画面で手動更新。注文による自動減算は行いません。
  });
  return unpack((await getDoc(ref)).data());
}
export function watchOrders(user,admin,next,error){
  const source=admin?collectionGroup(db,'orders'):collection(db,'customers',user.uid,'orders');
  return onSnapshot(query(source,orderBy('createdAt','desc'),limit(100)),s=>next(s.docs.map(d=>unpack(d.data()))),error);
}
