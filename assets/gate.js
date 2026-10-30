/* Lightweight team password screen. NOT security: the site and its files stay publicly readable.
   It only keeps casual visitors on a friendly entry screen. See README.md → "Password gate".
   GATE_HASH = SHA-256 hex of GATE_SALT + password. To change the password:
     printf '%s' 'karyio-portal-v1:NEW-PASSWORD' | shasum -a 256   → paste the hex below. */
const KGate=(()=>{
const GATE_SALT="karyio-portal-v1:";
const GATE_HASH="7aa978ce6c5016662ef03dc59b0e056a0f1917f8f07f5e6c677e805fe48c4984";
const KEY="karyio-gate";
const waiting=[];
let unlocked=false;
async function sha256(t){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(t));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");}
function remembered(){try{return sessionStorage.getItem(KEY)===GATE_HASH;}catch(e){return false;}}
function unlock(){unlocked=true;document.body.classList.remove("locked");$g("gate").hidden=true;waiting.splice(0).forEach(f=>f());}
const $g=id=>document.getElementById(id);
function init(){
  if(remembered()){unlock();return;}
  $g("gate").hidden=false;
  const form=$g("gate-form"),inp=$g("gate-pw"),err=$g("gate-err");
  setTimeout(()=>inp.focus(),50);
  form.addEventListener("submit",async e=>{
    e.preventDefault();err.textContent="";
    if(!window.crypto||!crypto.subtle){err.textContent="This browser can't open the portal here. Try the https:// link.";return;}
    const h=await sha256(GATE_SALT+inp.value);
    if(h===GATE_HASH){try{sessionStorage.setItem(KEY,GATE_HASH);}catch(x){}unlock();}
    else{err.textContent="That password didn't match. Please try again.";inp.value="";inp.focus();form.classList.remove("shake");void form.offsetWidth;form.classList.add("shake");}
  });
  $g("gate-show").addEventListener("change",e=>{inp.type=e.target.checked?"text":"password";});
}
init();
return {onUnlock:f=>{unlocked?f():waiting.push(f);}};
})();
