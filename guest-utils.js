export function guestName(value){
 const name=String(value||'').normalize('NFKC').trim().replace(/\s+/g,' ');
 if(!name||name.length>50||/[@\u0000-\u001f\u007f]/.test(name))throw Error('名前は1〜50文字で入力してください。@や制御文字は使えません。');
 return name;
}
export async function sha256(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('')}
export async function guestEmail(name){return (await sha256('cardport-guest-v1:'+guestName(name).toLowerCase()))+'@guest.cardport.invalid'}
export function guestCode(value){const code=String(value||'').trim().toUpperCase();if(!/^CPG-[A-F0-9]{32}$/.test(code))throw Error('ゲスト作成用コードを確認してください。');return code}
