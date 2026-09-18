export function validateCart(data){
  if(!data||typeof data.requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(data.requestId)||!Array.isArray(data.items)||!data.items.length||data.items.length>6)throw problem('invalid-argument','1回の注文は1〜6種類までです。');
  const ids=new Set();for(const i of data.items){if(!i||typeof i.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(i.id)||ids.has(i.id)||!Number.isSafeInteger(i.quantity)||i.quantity<1||i.quantity>99||!Number.isSafeInteger(i.expectedPrice)||i.expectedPrice<0)throw problem('invalid-argument','商品または数量を確認してください。');ids.add(i.id)}
}
export function priceItems(items,products){return items.map(i=>{const p=products.find(p=>p.id===i.id);if(!p||p.stock<i.quantity||p.price!==i.expectedPrice)throw problem('failed-precondition','価格・在庫が変わりました。カートを確認してください。');return {id:i.id,name:p.name,quantity:i.quantity,price:p.price}})}
export function matchesOrder(order,items){return order.items.length===items.length&&order.items.every(i=>items.some(j=>j.id===i.id&&j.quantity===i.quantity&&j.expectedPrice===i.price))}
export function problem(code,message){return Object.assign(new Error(message),{code})}
