/* Karyio Cost Planning portal: routing, shared state, Overview, Simulator and Cost Explorer.
   Deployment Options live in deploy.js, the reference catalog and coverage in reference.js.
   Every number comes from model.js; no page keeps its own copy of a formula. */

const CATS=["Infrastructure","AI models","De-identification","Storage & logs","Other services"];
const CATC=()=>({"Infrastructure":cssv("--c1"),"AI models":cssv("--c2"),"De-identification":cssv("--c6"),"Storage & logs":cssv("--c3"),"Other services":cssv("--c5")});
const PROVC=()=>({"Anthropic":cssv("--c2"),"OpenAI":cssv("--c3"),"Voyage AI":cssv("--c4"),"Groq":cssv("--c7"),"AWS":cssv("--c6"),"Apple":cssv("--c5")});
const FEATC=()=>({"Chat":cssv("--c1"),"RAG":cssv("--c2"),"Memory":cssv("--c4"),"Care logs":cssv("--c3"),"Care Insights":cssv("--c7"),"Shared":cssv("--c5"),"Login":cssv("--c6"),"Distribution":cssv("--c5")});
const FEATL={"Shared":"Shared infrastructure","Login":"Login & email","Distribution":"App distribution"};
const MON=Array.from({length:12},(_,i)=>"M"+(i+1));
const $=id=>document.getElementById(id);
const badge=s=>`<span class="badge b-${s}">${{official:"Official price",secondary:"Secondary price",repo:"Team-recorded",assumed:"Assumed",measured:"Dev-measured",synthetic:"Synthetic eval",code:"Code-derived",pending:"Not yet verified",missing:"Missing"}[s]}</span>`;
const aBase=()=>Object.fromEntries(AS.map(r=>[r[0],r[4]]));
const runWith=(v,a)=>{const out=[];for(let m=0;m<12;m++)out.push(month(v,a,m));return out;};
const sum12=R=>R.reduce((s,r)=>s+r.total,0);
let PAGE="overview", currentPreset="small";

/* ===================== STATE: modified? share links ===================== */
function modifiedParts(){
  const p=PR.some(r=>P[r[0]]!==r[2]), a=AS.some((r,i)=>r[3]!==AS0[i][0]||r[4]!==AS0[i][1]||r[5]!==AS0[i][2]);
  const s=SENS.fL!==0.5||SENS.fH!==1.5||SENS.pL!==0.9||SENS.pH!==1.3;
  return {p,a,s,any:p||a||s};
}
function encodeState(){
  const o={};
  const v={};Object.keys(IN).forEach(k=>{if(V[k]!==V0[k])v[k]=V[k];});if(Object.keys(v).length)o.v=v;
  if(BAND!==1)o.b=BAND;
  const p={};PR.forEach(r=>{if(P[r[0]]!==r[2])p[r[0]]=P[r[0]];});if(Object.keys(p).length)o.p=p;
  const a={};AS.forEach((r,i)=>{if(r[3]!==AS0[i][0]||r[4]!==AS0[i][1]||r[5]!==AS0[i][2])a[r[0]]=[r[3],r[4],r[5]];});if(Object.keys(a).length)o.a=a;
  const s={};["fL","fH","pL","pH"].forEach(k=>{if(SENS[k]!=={fL:0.5,fH:1.5,pL:0.9,pH:1.3}[k])s[k]=SENS[k];});if(Object.keys(s).length)o.s=s;
  return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
function applyState(str){
  let o;try{o=JSON.parse(decodeURIComponent(escape(atob(str.replace(/-/g,"+").replace(/_/g,"/")))));}catch(e){return false;}
  if(!o||typeof o!=="object")return false;
  const isNum=x=>typeof x==="number"&&isFinite(x);
  if(o.v)Object.entries(o.v).forEach(([k,x])=>{const d=IN[k];if(!d)return;if(d.type==="chk"){if(typeof x==="boolean")V[k]=x;}else if(isNum(x))V[k]=Math.min(d.max,Math.max(d.min,x));});
  if(o.p)Object.entries(o.p).forEach(([k,x])=>{if(k in P&&isNum(x)&&x>=0)P[k]=x;});
  if(o.a)Object.entries(o.a).forEach(([k,x])=>{const r=AS.find(r=>r[0]===k);if(r&&Array.isArray(x)&&x.length===3&&x.every(isNum)){r[3]=x[0];r[4]=x[1];r[5]=x[2];}});
  if(o.s)Object.entries(o.s).forEach(([k,x])=>{if(k in SENS&&isNum(x))SENS[k]=x;});
  setBand([0,1,2].includes(o.b)?o.b:1);
  currentPreset=Object.entries(PRESETS).find(([,p])=>Object.entries(p.v).every(([k,x])=>V[k]===x))?.[0]||null;
  return true;
}
function resetAll(){
  Object.assign(V,V0);PR.forEach(r=>P[r[0]]=r[2]);AS.forEach((r,i)=>{r[3]=AS0[i][0];r[4]=AS0[i][1];r[5]=AS0[i][2];});
  Object.assign(SENS,{fL:0.5,fH:1.5,pL:0.9,pH:1.3});setBand(1);currentPreset="small";
  syncInputs();markPreset("small");syncBand();buildPrices();buildAssume();buildSensCtl();refresh();toast("Restored all defaults");
}
function toast(t){const e=$("toast");e.textContent=t;e.style.display="block";clearTimeout(toast.h);toast.h=setTimeout(()=>e.style.display="none",2200);}
async function share(){
  const url=location.origin+location.pathname+"#"+(lastPath||PAGE)+"?cfg="+encodeState();
  try{await navigator.clipboard.writeText(url);toast("Scenario link copied. It restores these settings.");}
  catch(e){window.prompt("Copy this link to share the current scenario:",url);}
}

/* ===================== ROUTING =====================
   #page[/sub[/arg]][?cfg=…]  e.g. #explorer/map/comprehend, #explorer/feature/voice, #reference/search/login.
   v0.2 page names still work and redirect to their new home. */
const PAGES=["overview","simulator","explorer","deploy","reference"];
const ALIAS={breakdown:"explorer",architecture:"explorer/map",assumptions:"reference/method-calc",validation:"reference/valid"};
const REF_ANCHOR={method:"r-method",coverage:"r-coverage","method-calc":"j-method",prices:"j-prices",usage:"j-usage",onetime:"j-onetime",valid:"r-valid",uncertainty:"j-unc",work:"j-work",calibration:"j-cal",sources:"j-src",log:"j-log",search:"r-search"};
let SUB="", ARG="", lastPath="";
function route(){
  let [path,q]=location.hash.slice(1).split("?");
  const first=(path||"").split("/")[0];
  if(ALIAS[first])path=ALIAS[first]+path.slice(first.length);
  if(q&&q.startsWith("cfg=")){if(applyState(q.slice(4))){syncInputs();markPreset(currentPreset);syncBand();buildPrices();buildAssume();buildSensCtl();toast("Scenario restored from link");}}
  const parts=(path||"").split("/");
  PAGE=PAGES.includes(parts[0])?parts[0]:"overview";SUB=parts[1]||"";ARG=decodeURIComponent(parts.slice(2).join("/")||"");
  const canon="#"+[PAGE,SUB,parts.slice(2).join("/")].filter(Boolean).join("/");
  if(q||location.hash!==canon)history.replaceState(null,"",canon);
  const pageChanged=PAGE!==lastPath.split("/")[0];lastPath=canon.slice(1);
  document.querySelectorAll(".page").forEach(s=>s.classList.toggle("active",s.id==="page-"+PAGE));
  document.querySelectorAll("nav.main a").forEach(a=>{if(a.dataset.page===PAGE)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current");});
  refresh();
  // deep-link targets, after render
  if(PAGE==="explorer"&&SUB==="map"&&ARG&&KMap.byId[ARG])setTimeout(()=>KMap.gotoComp(ARG),30);
  else if(PAGE==="explorer"&&SUB==="feature"&&ARG)setTimeout(()=>{const d=document.querySelector(`details.acc[data-acc="${ARG}"]`);if(d){d.open=true;bdOpen.add(ARG);d.scrollIntoView({behavior:"smooth",block:"start"});}},30);
  else if(PAGE==="reference"&&SUB&&REF_ANCHOR[SUB])setTimeout(()=>{const t=$(REF_ANCHOR[SUB]);if(t)t.scrollIntoView({block:"start"});if(SUB==="search")$("rs-q").focus({preventScroll:true});},30);
  else if(PAGE==="deploy"&&SUB)setTimeout(()=>{const c=document.querySelector(`.dp-card[data-opt="${SUB}"]`);if(c){c.open=true;c.scrollIntoView({block:"start"});}},30);
  else if(pageChanged)window.scrollTo(0,0);
}
function renderExplorer(){
  const sub=SUB==="map"?"map":"breakdown";
  document.querySelectorAll(".subnav a").forEach(a=>a.setAttribute("aria-selected",a.dataset.sub===sub));
  $("ex-breakdown").classList.toggle("active",sub==="breakdown");$("explorer-map").classList.toggle("active",sub==="map");
  if(sub==="map")KMap.refresh();else renderBreakdown();
}
function renderReference(){
  renderValidation();KRef.renderSearch(SUB==="search"?ARG:null);
}
function scenLabel(){return (currentPreset?PRESETS[currentPreset].t:"Custom settings")+" · "+["Low","Base","High"][BAND]+" case";}
function refresh(){
  const m=modifiedParts();
  $("estbar").innerHTML="Planning estimates built from public prices and assumed usage. Not AWS bills, quotes or production measurements."+(m.any?` <span class="mod">· Prices or assumptions edited in this browser (Reset restores defaults).</span>`:"");
  ({overview:renderOverview,simulator:render,explorer:renderExplorer,deploy:()=>KDeploy.render(),reference:renderReference})[PAGE]();
}

/* ===================== 1. OVERVIEW ===================== */
let OVM=0;
const ovOpen=new Set();
KRef.deidOnceSaving=r=>V.comprehendOn&&!V.deidOnce?r.total-month({...V,deidOnce:true},A,r.m).total:0;
function renderOverview(){
  // Follows the Simulator's settings (the active scenario); the trend chart compares the presets.
  const R=run(V), r=R[OVM], m1=R[0], m12=R[11];
  const lo=scen(allAt(0)), hi=scen(allAt(2));
  const fixed=KRef.lineSum(r,KRef.FIXED_KEYS), usage=r.total-fixed;
  const pre=currentPreset?PRESETS[currentPreset].t:"Custom settings";
  $("ov-hero").innerHTML=`<div class="hero-main"><span class="small">Projected monthly cost · month ${OVM+1}</span>
     <div class="hero-v" id="ov-total">${money(r.total)}<small>/mo</small></div>
     <div class="hero-scen"><span class="chip">${pre}</span><span class="chip">${num(r.users)} users</span><span class="chip">${["Low","Base","High"][BAND]} assumptions</span><a href="#simulator">Change →</a></div></div>
   <div class="hero-kpis" id="ov-kpis">
     <div><span class="small">Low – High range, month ${OVM+1}</span><b class="v">${money(lo[OVM].total)} – ${money(hi[OVM].total)}</b><span class="small">Every uncertain input low or high together</span></div>
     <div><span class="small">Month 1 → month 12</span><b class="v">${money(m1.total)} → ${money(m12.total)}</b><span class="small">${V.growth?`+${V.growth}% users a month`:"No user growth"}</span></div>
     <div><span class="small">12-month total</span><b class="v">${money(sum12(R))}</b><span class="small">Low – High ${money(sum12(lo))} – ${money(sum12(hi))}</span></div>
   </div>`;
  // drivers
  const T=r.total, D=KRef.DRV.map(d=>({d,v:KRef.lineSum(r,d.lines)})).filter(x=>x.v>0).sort((a,b)=>b.v-a.v);
  const asLink=id=>{const x=AS.find(a=>a[0]===id);return x?`<li>${x[2]}: <b>${num(A[id],2)}</b> ${x[6]} ${badge(x[7])}</li>`:"";};
  const inLink=k=>`<li>${IN[k].l}: <b>${IN[k].type==="chk"?(V[k]?"on":"off"):IN[k].fmt(V[k])}</b> <span class="small">Simulator input</span></li>`;
  $("ov-drivers").innerHTML=`<div class="drivers">`+D.map(({d,v},i)=>{const opps=d.opps(r);
    return `<details class="drv-i${i>=6?" more":""}" data-drv="${d.id}"${ovOpen.has(d.id)?" open":""}><summary>
      <span class="drv-t"><b>${d.t}</b><span class="kchip k-${d.kind}">${d.kind==="fixed"?"Fixed":"Usage-based"}</span></span>
      <span class="drv-v"><b>${money(v)}</b><span class="small">${T?Math.round(100*v/T):0}%</span></span>
      <span class="drv-bar"><i style="width:${Math.max(1,100*v/D[0].v)}%" class="k-${d.kind}"></i></span></summary>
      <div class="drv-body"><dl>
        <dt>What it is</dt><dd>${d.what}</dd><dt>Why Karyio needs it</dt><dd>${d.why}</dd><dt>Used by</dt><dd>${d.feats}</dd>
        <dt>Why the cost ${d.kind==="fixed"?"stays flat":"grows"}</dt><dd>${d.grows}</dd>
        ${(d.as||[]).length||(d.inp||[]).length?`<dt>Assumptions behind it</dt><dd><ul class="tight">${(d.inp||[]).map(inLink).join("")}${(d.as||[]).map(asLink).join("")}</ul></dd>`:""}
        ${opps.length?`<dt>Optimization opportunities</dt><dd><ul class="tight">${opps.map(o=>`<li>${o}</li>`).join("")}</ul>${d.id==="comprehend"?`<p class="small">${KRef.PRIVACY_NOTE}</p>`:""}</dd>`:""}
      </dl><div class="drv-links"><a class="btn btn-sm" href="#explorer/map/${d.node}">Open in Cost Explorer</a><a class="btn btn-sm" href="#reference/search/${encodeURIComponent(d.q)}">View pricing source</a></div></div></details>`;}).join("")+`</div>`+
    (D.length>6?`<button type="button" class="btn btn-sm" id="drvMore" aria-expanded="false">Show all ${D.length} drivers</button>`:"");
  document.querySelectorAll("#ov-drivers details").forEach(d=>d.addEventListener("toggle",()=>{d.open?ovOpen.add(d.dataset.drv):ovOpen.delete(d.dataset.drv);}));
  const mb=$("drvMore");if(mb)mb.onclick=()=>{const on=mb.getAttribute("aria-expanded")!=="true";$("ov-drivers").classList.toggle("all",on);mb.setAttribute("aria-expanded",on);mb.textContent=on?"Show fewer":`Show all ${D.length} drivers`;};
  // fixed vs usage
  $("ov-split").innerHTML=`<div class="stackbar" role="img" aria-label="Fixed ${money(fixed)}, usage-based ${money(usage)}"><span style="flex:${fixed};background:${cssv("--c5")}"></span><span style="flex:${usage};background:${cssv("--c6")}"></span></div>
   <div class="split-l"><div><i style="background:${cssv("--c5")}"></i><span><b>${money(fixed)}</b> fixed (${Math.round(100*fixed/T)}%)<span class="small">Servers, database, network, storage, Apple fee</span></span></div>
   <div><i style="background:${cssv("--c6")}"></i><span><b>${money(usage)}</b> usage-based (${Math.round(100*usage/T)}%)<span class="small">AI models, privacy scans, sign-in email</span></span></div></div>`;
  const a=aBase(), S={};Object.entries(PRESETS).forEach(([k,p])=>{const v={...V0,...p.v};S[k]={R:runWith(v,a),lo:scen(allAt(0),null,v),hi:scen(allAt(2),null,v)};});
  legend("ov-lg-trend",[["Growing pilot",cssv("--c2")],["Small pilot",cssv("--c1")],["Growing Low–High",cssv("--c2")+"55"]]);
  lines("ov-trend",MON,[{name:"Growing pilot",color:cssv("--c2"),values:S.growing.R.map(r=>r.total),w:3},{name:"Small pilot",color:cssv("--c1"),values:S.small.R.map(r=>r.total)}],
    {band:{lo:S.growing.lo.map(r=>r.total),hi:S.growing.hi.map(r=>r.total),color:cssv("--c2")},h:240});
  // risks: swings computed live, one factor at a time
  const base=scen(allAt(1))[OVM].total, sw=k=>scen({...allAt(1),[k]:2})[OVM].total-scen({...allAt(1),[k]:0})[OVM].total;
  const fgOne=(V.vcpu*P.fgVcpu+V.mem*P.fgGb)*730, pend=pendingTechDphi(r);
  const unverAmt=Object.entries(r.c).filter(([k])=>["rds","ec2","rdsSt","rdsBk","s3","cw","xfer"].includes(k)).reduce((s,[,x])=>s+x.val,0);
  const risks=[
   [sw("freq"),`${badge("assumed")} <b>Usage per person</b> (messages, voice minutes, care logs). No pilot data yet; low to high moves this month by ${money(sw("freq"))}.`,"#reference/uncertainty"],
   [sw("phi"),`${badge("assumed")} <b>Text scanned for privacy.</b> The DetectPHI price is official; message, reply and log lengths aren't. Swing ${money(sw("phi"))}.`,"#reference/search/privacy"],
   [sw("tok"),`${badge("measured")} <b>AI token sizes.</b> Partly dev-measured, partly assumed. Swing ${money(sw("tok"))}.`,"#reference/usage"],
   [fgOne,`${badge("code")} <b>A second backend task under load.</b> Autoscaling allows it; it would add up to ${money(fgOne)}/mo and isn't in the range.`,"#explorer/map/backend"],
   [pend.cost,`${badge("pending")} <b>Planned privacy update for RAG questions</b> may add up to ${money(pend.cost)}/mo. Not in the totals until verified.`,"#explorer/feature/chatrag"],
   [unverAmt*0.3,`${badge("secondary")} <b>${PR.filter(x=>x[4]!=="official").length} prices not yet official</b> (RDS, EC2, EBS, S3…), ${money(unverAmt)}/mo of this month.`,"#reference/prices"]
  ].sort((x,y)=>y[0]-x[0]);
  $("ov-risks").innerHTML=`<ul class="risk">${risks.map(([,t,h])=>`<li>${t} <a href="${h}">Details</a></li>`).join("")}<li>${badge("pending")} <b>Sign-in email limit.</b> The built-in Cognito email is capped per day; set up SES before external testers join. Readiness, not cost. <a href="#reference/search/email">Details</a></li></ul>
   <p class="small">Base this month ${money(base)}. Swings move one kind of uncertainty from low to high.</p>`;
  // opportunities: evidence-based only
  const dSave=KRef.deidOnceSaving(r), aws2=KDeploy.OPT[1].host(r,V).lo, awsH=KDeploy.OPT[0].host(r,V).lo;
  $("ov-opps").innerHTML=`<ul class="opp">
   <li><b>Scan each message once per turn</b> <span class="kchip k-usage">${dSave?moneyD(-dSave)+"/mo":"n/a"}</span><span class="small">Today the same text is de-identified more than once: a message at the route decision and again when the reply is written, and an AI log draft with no type named. Reusing the first result needs a code change and keeps the same protection (the model's existing what-if). ${badge("code")}</span></li>
   <li><b>ARM (Graviton) builds on AWS</b> <span class="kchip k-fixed">${moneyD(aws2-awsH)}/mo</span><span class="small">Same architecture, about 20% lower compute rates (official) and an ARM RAG host (secondary price). <a href="#deploy/aws2">Option A2</a></span></li>
   <li><b>Right-size after measuring</b> <span class="kchip">not quantified</span><span class="small">CPU and memory under real load haven't been measured; the deployment plan already calls for it.</span></li>
   <li><b>Moving hosting off AWS</b> <span class="kchip">at most ≈ ${money(awsH-KDeploy.OPT[3].host(r,V).lo)}/mo</span><span class="small">Shifts database, backups and patching to the team, and the privacy-agreement paths are less clear. <a href="#deploy">Compare options</a></span></li></ul>
   <p class="small">${KRef.PRIVACY_NOTE}</p>`;
  const m=modifiedParts();
  $("ov-note").innerHTML=`Figures follow the Cost Simulator's settings (${scenLabel()}). The trend chart always compares the presets at base assumptions.${m.any?` <span class="mod">Prices or assumptions were edited in Reference &amp; Validation, so these figures differ from the published defaults.</span>`:""}`;
}

/* ===================== 2. SIMULATOR ===================== */
// Units shown beside the number boxes (display only; the model's inputs are unchanged)
const UNIT={users:"users",growth:"% / month",daily:"%",chat:"per day",voiceMin:"min / day",tpm:"turns / min",logs:"per day",ragPct:"%",tasks:"tasks",vcpu:"vCPU",mem:"GB",ips:"addresses",rdsAlloc:"GB",rdsMax:"GB",retain:"months (0 = forever)",logRet:"days"};
function buildInputs(){
  const groups={};Object.entries(IN).forEach(([k,o])=>(groups[o.g]=groups[o.g]||[]).push([k,o]));
  const intOnly=o=>Number.isInteger(o.step)&&Number.isInteger(o.min);
  $("inputs").innerHTML=Object.entries(groups).map(([g,list],gi)=>`<details class="grp" ${gi<(matchMedia("(max-width:960px)").matches?1:3)?"open":""}><summary>${g}</summary>`+list.map(([k,o])=>o.type==="chk"
    ?`<div class="ctl chk"><label><input type="checkbox" id="in-${k}" ${V[k]?"checked":""}>&nbsp;${o.l}</label>${o.hint?`<div class="hint">${o.hint}</div>`:""}</div>`
    :`<div class="ctl"><label for="n-${k}">${o.l}</label>
      <div class="ctl-row"><input type="range" id="in-${k}" min="${o.min}" max="${o.max}" step="${o.step}" value="${V[k]}" aria-label="${o.l} slider">
      <span class="numbox"><input type="number" id="n-${k}" inputmode="${intOnly(o)?"numeric":"decimal"}" min="${o.min}" max="${o.max}" step="any" value="${V[k]}" aria-describedby="e-${k}"><span class="unit">${UNIT[k]||""}</span></span></div>
      <div class="ctl-err" id="e-${k}" aria-live="polite"></div>${o.hint?`<div class="hint">${o.hint}</div>`:""}</div>`).join("")+`</details>`).join("")+
    `<p class="small" style="margin:8px 0 0">Token sizes, row sizes and other uncertain values are in <a href="#reference/usage">Reference &amp; Validation</a>.</p>`;
  Object.entries(IN).forEach(([k,o])=>{const e=$("in-"+k);
    if(o.type==="chk"){e.addEventListener("input",()=>{V[k]=e.checked;markPreset(null);render();});return;}
    const n=$("n-"+k), err=$("e-"+k), ctl=n.closest(".ctl");
    const setErr=t=>{err.textContent=t;ctl.classList.toggle("bad",!!t);};
    e.addEventListener("input",()=>{V[k]=+e.value;n.value=V[k];setErr("");markPreset(null);render();});
    // Typing: accept only valid values; never overwrite the box while the user is typing
    n.addEventListener("input",()=>{const t=n.value.trim(),x=Number(t);
      if(t===""||!isFinite(x)){setErr("Enter a number");return;}
      if(x<o.min||x>o.max){setErr(`Between ${o.min} and ${o.max} ${UNIT[k]||""}`.trim());return;}
      if(intOnly(o)&&!Number.isInteger(x)){setErr("Whole numbers only");return;}
      setErr("");V[k]=x;e.value=x;markPreset(null);render();});
    n.addEventListener("change",()=>{if(ctl.classList.contains("bad")){n.value=V[k];setErr("");}});
  });
}
function syncInputs(){Object.entries(IN).forEach(([k,o])=>{const e=$("in-"+k);if(o.type==="chk")e.checked=V[k];else{e.value=V[k];const n=$("n-"+k);if(!(document.activeElement===n&&Number(n.value)===V[k]))n.value=V[k];$("e-"+k).textContent="";n.closest(".ctl").classList.remove("bad");}});}
function markPreset(id){currentPreset=id;document.querySelectorAll("#presetSeg button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.p===id));}
function syncBand(){document.querySelectorAll("[data-band-seg] button").forEach(x=>x.setAttribute("aria-pressed",+x.dataset.b===BAND));}
function buildTop(){
  const ps=$("presetSeg");ps.innerHTML=Object.entries(PRESETS).map(([k,p])=>`<button type="button" data-p="${k}" aria-pressed="${k==="small"}">${p.t}</button>`).join("");
  ps.querySelectorAll("button").forEach(b=>b.onclick=()=>{Object.assign(V,PRESETS[b.dataset.p].v);syncInputs();markPreset(b.dataset.p);render();});
  document.querySelectorAll("[data-band-seg]").forEach(bs=>{bs.innerHTML=["Low","Base","High"].map((t,i)=>`<button type="button" data-b="${i}" aria-pressed="${i===1}">${t}</button>`).join("");
    bs.querySelectorAll("button").forEach(b=>b.onclick=()=>{setBand(+b.dataset.b);syncBand();buildAssume();refresh();});});
  const tabs=[["v-total","Total forecast"],["v-voice","Voice"],["v-ai","AI breakdown"],["v-logs","Care logs & memory"],["v-data","Data growth"],["v-scen","Scenarios"],["v-sens","Sensitivity & Comprehend"]];
  const T=$("tabs");T.innerHTML=tabs.map(([id,t],i)=>`<button role="tab" type="button" data-v="${id}" aria-selected="${i===0}">${t}</button>`).join("");
  T.querySelectorAll("button").forEach(b=>b.onclick=()=>openTab(b.dataset.v));
}
function openTab(id){document.querySelectorAll("#tabs button").forEach(b=>b.setAttribute("aria-selected",b.dataset.v===id));document.querySelectorAll(".view").forEach(s=>s.classList.toggle("active",s.id===id));render();}
function buildSensCtl(){
  const f=(k,l)=>`<label>${l} <input type="number" step="0.05" min="0" data-s="${k}" value="${SENS[k]}"></label>`;
  $("sens-ctl").innerHTML=`<span><b>Usage frequency</b> ×</span>${f("fL","low")}${f("fH","high")}<span style="margin-left:10px"><b>Unverified prices</b> ×</span>${f("pL","low")}${f("pH","high")}`;
  document.querySelectorAll("#sens-ctl input").forEach(i=>i.addEventListener("input",()=>{SENS[i.dataset.s]=+i.value||0;render();}));
}
const voiceShare=r=>r.turns?r.voice/r.turns:0;
const voiceCost=r=>Object.values(r.c).filter(x=>x.turnBased).reduce((s,x)=>s+x.val,0)*voiceShare(r);
function render(){
  const R=run(V), m1=R[0], m12=R[11];
  const tot12=sum12(R);
  const usage=x=>(x.cat["AI models"]||0)+(x.cat["De-identification"]||0);
  $("kpis").innerHTML=[
   [money(m1.total),"Month 1 total"],[money(m12.total),"Month 12 total"],[money(tot12),"12-month total"],
   [money(m1.dau>0?m1.total/Math.max(1,m1.users):0),"Per user, month 1"],
   [Math.round(100*usage(m1)/m1.total)+"%","Usage-based share, month 1"],[num(m1.turns)+" turns","Chat + voice turns, month 1"]]
   .map(([v,l])=>`<div class="kpi"><div class="v">${v}</div><div class="l">${l}</div></div>`).join("");
  const flags=[];
  if(V.comprehendOn&&(m1.cat["De-identification"]||0)>(m1.cat["AI models"]||0))flags.push("De-identification (Comprehend Medical) costs more than all AI models at these settings. Its price is verified from AWS's official price list. What's still uncertain is how much text gets scanned. See Sensitivity & Comprehend.");
  if(m12.dphiU>1e6)flags.push(`DetectPHI passes 1M units in a month (${num(m12.dphiU)} in month 12), so the cheaper volume tiers apply.`);
  const cross=R.find(r=>r.over);if(cross)flags.push(`Database estimate passes 90% of the ${V.rdsMax} GB auto-grow ceiling in month ${cross.m+1}.`);
  if(V.voiceInChat)flags.push("Voice turns are treated as part of the typed message count (not added on top).");
  if(V.comprehendOn){const pd=pendingTechDphi(m1);flags.push(`Not included: a planned privacy-processing update for RAG questions may add up to about ${money(pd.cost)} of de-identification in month 1. Pending implementation verification.`);}
  flags.push(`Showing the <b>${["low","base","high"][BAND]}</b> case for uncertain assumptions. These are estimates, not quotes.`);
  $("flags").innerHTML=flags.join("<br>");
  const C=CATC();
  legend("lg-total",CATS.map(c=>[c,C[c]]));
  stacked("ch-total",MON,CATS.map(c=>({name:c,color:C[c],values:R.map(r=>r.cat[c]||0)})),{totals:true});
  const rows=Object.keys(m1.c).concat(Object.keys(m12.c).filter(k=>!m1.c[k])).filter((k,i,a)=>a.indexOf(k)===i);
  const byCat=CATS.map(cat=>{const ks=rows.filter(k=>(m1.c[k]||m12.c[k]).cat===cat);return `<tr><th colspan="3" style="color:${C[cat]}">${cat}</th></tr>`+ks.map(k=>{const x=m1.c[k]||m12.c[k];return `<tr><td>${x.model}${x.feat!=="Shared"?` <span class="small">· ${x.feat}</span>`:""}</td><td class="n">${money(m1.c[k]?m1.c[k].val:0)}</td><td class="n">${money(m12.c[k]?m12.c[k].val:0)}</td></tr>`;}).join("");}).join("");
  $("tb-total").innerHTML=`<table><tr><th>Line item</th><th class="n">Month 1</th><th class="n">Month 12</th></tr>${byCat}<tr><th>Total</th><th class="n">${money(m1.total)}</th><th class="n">${money(m12.total)}</th></tr></table>`;
  // voice
  const xs=[0,1,2,3,4,5,6,8,10,12,15], tpmSet=[1,2,3], vc=[cssv("--c1"),cssv("--c2"),cssv("--c3")];
  legend("lg-voice",tpmSet.map((t,i)=>[`${t} turns per voice minute${t===V.tpm?" (current)":""}`,vc[i]]));
  lines("ch-voice",xs,tpmSet.map((t,i)=>({name:`${t} turns/min`,color:vc[i],dash:t===V.tpm?"":"5 4",values:xs.map(x=>voiceCost(month({...V,voiceMin:x,tpm:t},A,0)))})),{xfmt:x=>x+" min/day"});
  const vbd={};Object.values(m1.c).filter(x=>x.turnBased).forEach(x=>{const k=x.cat==="De-identification"?"De-identification":x.prov+" · "+x.model;vbd[k]=(vbd[k]||0)+x.val*voiceShare(m1);});
  hbars("ch-voice-bd",Object.entries(vbd).map(([k,v])=>({label:k,value:v,color:k==="De-identification"?cssv("--c6"):PROVC()[k.split(" · ")[0]]})));
  $("tb-voice").innerHTML=`<table>
   <tr><td>Voice turns per month</td><td class="n">${num(m1.voice)}</td></tr>
   <tr><td>Share of all turns</td><td class="n">${Math.round(100*voiceShare(m1))}%</td></tr>
   <tr><td>Speech recognition &amp; read-aloud</td><td class="n">$0.00 (on-device)</td></tr>
   <tr><td>Cost attributable to voice</td><td class="n">${money(voiceCost(m1))}</td></tr>
   <tr><td>Per voice minute</td><td class="n">${money(m1.voice?voiceCost(m1)/(m1.dau*V.voiceMin*DAYS||1):0)}</td></tr></table>
   <p class="small">Voice in a TestFlight build is planned. Shared infrastructure isn't attributed to voice.</p>`;
  // AI
  const aiItems=Object.values(m1.c).filter(x=>x.cat==="AI models"||x.cat==="De-identification");
  const agg=(f)=>{const o={};aiItems.forEach(x=>{const k=f(x);o[k]=(o[k]||0)+x.val;});return o;};
  const PC=PROVC();
  hbars("ch-ai-prov",Object.entries(agg(x=>x.prov)).map(([k,v])=>({label:k==="AWS"?"AWS Comprehend Medical":k,value:v,color:PC[k]})));
  hbars("ch-ai-model",Object.entries(agg(x=>x.model)).map(([k,v])=>({label:k,value:v,color:PC[aiItems.find(x=>x.model===k).prov]})));
  const FC=FEATC();
  hbars("ch-ai-feat",Object.entries(agg(x=>x.feat)).map(([k,v])=>({label:k,value:v,color:FC[k]})));
  $("tb-ai").innerHTML=`<table><tr><th>Feature</th><th>Provider · model</th><th>What triggers it</th><th class="n">Month 1</th></tr>`+
   Object.entries(m1.c).filter(([k,x])=>x.cat==="AI models"||x.cat==="De-identification").map(([k,x])=>`<tr><td>${x.feat}</td><td>${x.prov} · ${x.model}</td><td class="small">${WHY[k]||""}</td><td class="n">${money(x.val)}</td></tr>`).join("")+`</table>`;
  // logs & memory
  const LM=[["Log entry (AI extraction)",["logEx"],cssv("--c3")],["Log summaries",["logSum"],cssv("--c1")],["Memory embeddings",["logEmb","sumEmb"],cssv("--c4")],["Chat summaries",["summary"],cssv("--c2")],["Care Insights runs",["insJ","insI","insC"],cssv("--c7")],["De-identification of logs",["dLogSave","dLogDraft","dEvidence"],cssv("--c6")]];
  legend("lg-logs",LM.map(x=>[x[0],x[2]]));
  stacked("ch-logs",MON,LM.map(([n,ks,c])=>({name:n,color:c,values:R.map(r=>ks.reduce((s,k)=>s+(r.c[k]?r.c[k].val:0),0))})),{totals:true});
  $("tb-logs").innerHTML=`<table><tr><th></th><th class="n">Month 1</th><th class="n">Month 12</th></tr>
   <tr><td>Care logs saved</td><td class="n">${num(m1.logs)}</td><td class="n">${num(m12.logs)}</td></tr>
   <tr><td>Care Insights runs (background)</td><td class="n">${num(m1.runs)}</td><td class="n">${num(m12.runs)}</td></tr>
   <tr><td>Weekly reports</td><td class="n" colspan="2">no AI call of their own today</td></tr></table>`;
  // data
  legend("lg-data",[["Database size (estimate)",cssv("--c1")],["Allocated RDS storage",cssv("--c3")],["Auto-grow ceiling",cssv("--bad")],["Backups (7 days)",cssv("--c4")],["CloudWatch logs / month",cssv("--c2")]]);
  lines("ch-data",MON,[
   {name:"Database",color:cssv("--c1"),values:R.map(r=>r.dbGb)},
   {name:"Allocated",color:cssv("--c3"),values:R.map(r=>r.alloc),dash:"6 4",noDots:true},
   {name:"Ceiling",color:cssv("--bad"),values:R.map(()=>V.rdsMax),dash:"2 4",noDots:true,w:1.6},
   {name:"Backups",color:cssv("--c4"),values:R.map(r=>r.bkGb)},
   {name:"Logs/month",color:cssv("--c2"),values:R.map(r=>r.cwGb)}],{fmt:x=>num(x,x<10?1:0)+" GB",min:Math.min(V.rdsMax,Math.max(...R.map(r=>r.dbGb))*1.2+1)});
  $("tb-data").innerHTML=`<table><tr><th></th><th class="n">Month 1</th><th class="n">Month 6</th><th class="n">Month 12</th></tr>
   ${[["Database size",r=>num(r.dbGb,2)+" GB"],["Allocated storage (billed)",r=>r.alloc+" GB"],["Backup size",r=>num(r.bkGb,2)+" GB"],["Logs ingested",r=>num(r.cwGb,2)+" GB"],["Data sent to the app",r=>num(r.xGb,2)+" GB"],["Storage & logs cost",r=>money(r.cat["Storage & logs"]||0)]].map(([l,f])=>`<tr><td>${l}</td><td class="n">${f(R[0])}</td><td class="n">${f(R[5])}</td><td class="n">${f(R[11])}</td></tr>`).join("")}</table>
   <p class="small">RDS bills allocated storage, not used storage, so the 20 GB minimum dominates early. Backups are free up to the allocated size. ${V.retain?`Chat history and traces older than ${V.retain} months are dropped.`:"Nothing is deleted (keep forever)."}</p>`;
  // scenarios
  const SC=Object.entries(PRESETS).map(([k,p])=>({t:p.t,r:run({...V,...p.v})}));
  legend("lg-scen",CATS.map(c=>[c,C[c]]));
  stacked("ch-scen",SC.flatMap(s=>[s.t+" M1",s.t+" M12"]),CATS.map(c=>({name:c,color:C[c],values:SC.flatMap(s=>[s.r[0].cat[c]||0,s.r[11].cat[c]||0])})),{totals:true});
  $("tb-scen").innerHTML=`<table><tr><th>Scenario</th><th class="n">Users M1 → M12</th><th class="n">Turns M1</th><th class="n">Month 1</th><th class="n">Month 12</th><th class="n">12-month total</th><th class="n">Per user M12</th></tr>`+
   SC.map(s=>`<tr><td>${s.t}</td><td class="n">${num(s.r[0].users)} → ${num(s.r[11].users)}</td><td class="n">${num(s.r[0].turns)}</td><td class="n">${money(s.r[0].total)}</td><td class="n">${money(s.r[11].total)}</td><td class="n">${money(sum12(s.r))}</td><td class="n">${money(s.r[11].total/s.r[11].users)}</td></tr>`).join("")+`</table>
   <p class="small">Presets change users, growth and activity (and backend tasks for "Larger usage"). Prices and the uncertainty band are shared. Infrastructure sizing for larger usage is unmeasured.</p>`;
  if($("v-sens").classList.contains("active"))renderSens(R);
}
function renderSens(R){
  const lo=scen(allAt(0)),ba=scen(allAt(1)),hi=scen(allAt(2));
  const cmOf=r=>r.cat["De-identification"]||0;
  legend("lg-sens",[["High (all uncertain inputs high)",cssv("--c2")],["Base",cssv("--c1")],["Low (all low)",cssv("--c3")],["Base without Comprehend Medical",cssv("--c6")]]);
  lines("ch-sens",MON,[
   {name:"High",color:cssv("--c2"),values:hi.map(r=>r.total)},
   {name:"Base",color:cssv("--c1"),values:ba.map(r=>r.total),w:3},
   {name:"Low",color:cssv("--c3"),values:lo.map(r=>r.total)},
   {name:"Base without Comprehend",color:cssv("--c6"),values:ba.map(r=>r.total-cmOf(r)),dash:"5 4"}],{band:{lo:lo.map(r=>r.total),hi:hi.map(r=>r.total),color:cssv("--c1")}});
  $("tb-sens").innerHTML=`<table><tr><th></th><th class="n">Month 1</th><th class="n">Month 6</th><th class="n">Month 12</th><th class="n">12-month total</th><th class="n">Comprehend, month 12</th><th class="n">Comprehend share, M12</th></tr>`+
   [["Low",lo],["Base",ba],["High",hi]].map(([n,x])=>`<tr><td>${n}</td><td class="n">${money(x[0].total)}</td><td class="n">${money(x[5].total)}</td><td class="n">${money(x[11].total)}</td><td class="n">${money(sum12(x))}</td><td class="n">${money(cmOf(x[11]))}</td><td class="n">${x[11].total?Math.round(100*cmOf(x[11])/x[11].total):0}%</td></tr>`).join("")+`</table>`;
  legend("lg-tornado",[["Low value",cssv("--c3")],["High value",cssv("--c2")]]);
  tornado("ch-tornado",FACTORS.map(([k,l])=>({label:l,lo:scen({...allAt(1),[k]:0})[11].total,hi:scen({...allAt(1),[k]:2})[11].total})),ba[11].total);
  const modes=[["As coded",{comprehendOn:true,deidOnce:false}],["What-if: one scan per message",{comprehendOn:true,deidOnce:true}],["Off (what-if)",{comprehendOn:false}]];
  const sets=[["Current settings",{}]].concat(Object.values(PRESETS).map(p=>[p.t,p.v]));
  const runA=(o)=>runWith({...V,...o},A);
  $("tb-cm").innerHTML=`<table><tr><th>Scenario</th><th class="n">Comprehend M1</th><th class="n">Share of M1</th><th class="n">Comprehend M12</th><th class="n">Share of M12</th><th class="n">Per chat turn</th><th class="n">Total M12 as coded</th><th class="n">Total M12, one scan per message</th><th class="n">Total M12, off</th></tr>`+
   sets.map(([n,o])=>{const rs=modes.map(([,mo])=>runA({...o,...mo}));const c=rs[0];const turnCm=Object.values(c[0].c).filter(x=>x.cat==="De-identification"&&x.turnBased).reduce((s,x)=>s+x.val,0);
     return `<tr><td>${n}</td><td class="n">${money(cmOf(c[0]))}</td><td class="n">${Math.round(100*cmOf(c[0])/c[0].total)}%</td><td class="n">${money(cmOf(c[11]))}</td><td class="n">${Math.round(100*cmOf(c[11])/c[11].total)}%</td><td class="n">${c[0].turns?"$"+(turnCm/c[0].turns).toFixed(4):"—"}</td><td class="n">${money(c[11].total)}</td><td class="n">${money(rs[1][11].total)}</td><td class="n">${money(rs[2][11].total)}</td></tr>`;}).join("")+`</table>
   <p class="small">“Per chat turn” is the average DetectPHI cost of one turn, across ordinary, support, recall and RAG turns. An ordinary turn is cheaper than a RAG turn because RAG replies are longer and the whole reply is scanned for the memory summary. ${V.comprehendOn?"":"Comprehend is switched off in the sidebar; the table still shows all three settings."}</p>`;
  const m1=R[0],tot=m1.dphiU||0;
  $("tb-cmsites").innerHTML=V.comprehendOn?`<table><tr><th>Step</th><th>Text scanned</th><th>When it runs</th><th class="n">Units, M1</th><th class="n">Share</th><th class="n">Cost, M1</th></tr>`+
   Object.entries(DSITES).map(([k,d])=>{const u=m1.dphiS[k]||0;return `<tr><td>${d.n}</td><td class="small">${d.text}</td><td class="small">${d.when}</td><td class="n">${num(u)}</td><td class="n">${tot?Math.round(100*u/tot):0}%</td><td class="n">${money(m1.c[k]?m1.c[k].val:0)}</td></tr>`;}).join("")+
   `<tr><th colspan="3">Total</th><th class="n">${num(tot)}</th><th></th><th class="n">${money(cmOf(m1))}</th></tr></table>`:`<p class="small">Comprehend Medical is switched off in the sidebar.</p>`;
  const pd=pendingTechDphi(m1);
  $("cm-notes").innerHTML=`<p class="small" style="margin-top:8px"><span class="badge b-pending">Pending</span> <b>Not in the totals:</b> a planned privacy-processing update for RAG questions may add up to about ${num(pd.units)} DetectPHI units (${money(pd.cost)}) in month 1 at these settings. The model will be updated once the final implementation is verified.<br>
   <b>Not modelled, rare or off in the pilot:</b> fallback paths used only when no route answers, and features that are switched off in the pilot configuration.<br>
   <b>Billing notes:</b> empty text makes no AWS call. Whether failed requests are billed isn't stated on the pricing page. AWS's first-month free tier (85,000 units) is not applied.</p>`;
}
const WHY={route:"Every chat or voice turn, except shortcuts and crisis replies",answer:"Ordinary/support turns (not RAG, not recall)",summary:"After each turn (per-turn memory summary)",sumEmb:"Embedding each chat summary",title:"First message of a new chat",recall:"Recall turns",ragGroq:"3 calls per RAG question (safety screen, analysis, HyDE)",ragFail:"Groq errors re-run on OpenAI",ragEmb:"Embedding each RAG question",ragRr:"Re-ranking 30 candidates",ragGen:"Writing each RAG answer",logEx:"Logs entered by description or AI draft",logSum:"Logs with notes",logEmb:"Memory embedding per log",insJ:"Care Insights run: judge",insI:"Care Insights run: investigator",insC:"Care Insights run: critic",dDecider:"PHI scan before the route decision",dExec:"PHI scan of the same message again when the route answers",dPair:"PHI scan of question + reply for the memory summary",dTitle:"PHI scan for chat titles",dLogSave:"PHI scan of each saved log (notes or structured fields)",dLogDraft:"PHI scans while AI drafts a log",dEvidence:"PHI scan of log notes in each Care Insights run"};

/* ===================== 3. BREAKDOWN ===================== */
// Features are groups of the model's own `feat` attribution. Shared infrastructure is never allocated to features.
let BDM=0;
const bdOpen=new Set();
const users2=v=>({users:Math.min(IN.users.max,v.users*2)});
const BDF=[
 {id:"chatrag",t:"Chat & RAG",short:"Conversation, medical answers and memory",feats:["Chat","RAG","Memory"],color:"--c1",
  what:"The assistant conversation: everyday chat, medical questions answered from ALS guides (RAG), and memory so Karyio remembers context. Spoken (voice) turns are included.",
  subs:{"Chat":"Routing each message, writing replies, chat titles, privacy scans","RAG":"Medical questions: safety checks, guide search, cited answers, plus the dedicated RAG host","Memory":"Summary of each turn (with a privacy scan of question + reply) and recall"},
  unit:r=>r.turns?[r.turns,"per chat turn"]:null,
  drivers:[["Twice as many typed messages",v=>({chat:v.chat*2})],["Twice as many voice minutes",v=>({voiceMin:v.voiceMin*2})],["RAG share +10 points",v=>({ragPct:Math.min(100,v.ragPct+10)})],["Twice as many users",users2]],
  overlap:"Includes the cost of spoken turns. The Voice view is a slice of this figure, not an extra cost. The route decision and memory summary of RAG turns are counted under Chat and Memory.",
  cov:{inc:"Route decision, replies, titles, recall, memory summaries and embeddings, RAG safety screen, analysis, search, re-ranking and answers, OpenAI failover, privacy scans at each step, and the RAG host.",exc:"The multi-step loop route (off in the pilot), a RAG conflict-check step (switched off in configuration), and rare fallback paths.",unv:"Token sizes beyond the ordinary route; Groq failover rate; the planned privacy update for RAG questions (pending, shown separately).",conf:"Medium. Prices are official and call paths are code-checked; usage is assumed."}},
 {id:"logs",t:"Care Logs & Insights",short:"Recording care, and background insights",feats:["Care logs","Care Insights"],color:"--c3",
  what:"Recording symptoms, medications and events, with optional AI help, plus the background Care Insights agent that looks for patterns in recent logs.",
  subs:{"Care logs":"AI drafting, summaries of notes, memory embeddings and privacy scans","Care Insights":"Judge, investigator and critic runs; re-scans log notes"},
  unit:r=>r.logs?[r.logs,"per care log"]:null,
  drivers:[["Twice as many care logs",v=>({logs:v.logs*2})],["Twice as many users",users2]],
  overlap:"No overlap: log memory and log privacy scans are counted only here, not under Chat & RAG.",
  cov:{inc:"AI drafting and extraction, note summaries, memory embeddings, Care Insights judge, investigator and critic, and privacy scans on save, drafting, follow-ups and insight runs.",exc:"Weekly reports (no AI call today) and an insight-synthesis step that isn't enabled in the pilot.",unv:"AI drafting may make a few more small model calls per log than modeled (type classification, follow-up answers, review). Care Insights triggers per care area, so runs per log could be higher than base (covered by the High case).",conf:"Medium–Low. Shares and token sizes are assumed."}},
 {id:"login",t:"Sign-in & email",short:"Accounts and verification emails",feats:["Login"],color:"--c6",
  what:"Account sign-up, sign-in and password recovery (Cognito), plus verification and recovery emails.",
  note:"Projected for the planned setup; login integration is in progress. Cognito is free below 10,000 monthly active users, so at pilot scale only emails cost anything: 2 per new user at $0.10 per 1,000.",
  drivers:[["Twice as many users",users2]],overlap:"No overlap.",
  cov:{inc:"Cognito (free below 10,000 monthly active users) and 2 emails per new user at the SES rate.",exc:"SMS and email MFA messages, and a custom sender domain.",unv:"The deployment scripts currently use Cognito's built-in email: free, but capped per day at a level AWS says is below typical production volume. Set up SES before external testers join. This is a readiness item; the cost impact is under $0.01.",conf:"High for cost."}},
 {id:"dist",t:"App distribution",short:"Apple Developer Program",feats:["Distribution"],color:"--c5",
  what:"Apple Developer Program membership, needed to distribute the app through TestFlight.",
  note:"$99 a year spread monthly. Fixed: it doesn't change with usage. Turn it off with “Include Apple Developer fee” in the Simulator.",
  drivers:[],overlap:"No overlap."}
];
const lineName=(k,x)=>x.cat==="De-identification"?`Privacy scan: ${DSITES[k].n}`:`${x.model}${WHY[k]?` <span class="small">· ${WHY[k]}</span>`:""}`;
const featCost=(r,fs)=>Object.values(r.c).filter(x=>fs.includes(x.feat)).reduce((s,x)=>s+x.val,0);
const ragFixed=r=>(r.c.ec2?r.c.ec2.val:0)+(r.c.s3?r.c.s3.val:0);
function driverRows(list,costFn,base){
  if(!list.length)return `<p class="small">Doesn't change with usage.</p>`;
  return `<ul class="drv">${list.map(([l,o])=>{const c=costFn(month({...V,...o(V)},A,BDM)),d=c-base;
    return `<li><span>${l}</span><b class="${d>=0.01?"up":""}">${moneyD(d)}<small>/mo</small>${base>=0.01&&Math.abs(d)>=0.01?` <span class="small">(${d>0?"+":"−"}${Math.round(100*Math.abs(d)/base)}%)</span>`:""}</b></li>`;}).join("")}</ul>`;
}
function featDetail(f,r,sharedNames){
  const items=Object.entries(r.c).filter(([,x])=>f.feats.includes(x.feat)), tot=items.reduce((s,[,x])=>s+x.val,0);
  const bySvc={};items.forEach(([,x])=>{const k=x.cat==="De-identification"?"AWS · Comprehend Medical (privacy scans)":`${x.prov} · ${x.model}`;bySvc[k]=(bySvc[k]||0)+x.val;});
  const u=f.unit&&f.unit(r);
  return `<p>${f.what}</p>${f.note?`<p class="note-box">${f.note}</p>`:""}
   ${f.subs?`<h4>What's inside</h4><ul class="kv">${Object.entries(f.subs).map(([k,d])=>k==="RAG"
     ?`<li><span><b>Medical RAG · per question</b><span class="small">Safety checks, guide search, re-ranking and cited answers. Variable: grows with RAG questions</span></span><b>${money(featCost(r,["RAG"])-ragFixed(r))}</b></li><li><span><b>Medical RAG · hosting</b><span class="small">The dedicated RAG host and its search bundle. Fixed: runs whether or not anyone asks</span></span><b>${money(ragFixed(r))}</b></li>`
     :`<li><span><b>${k}</b><span class="small">${d}</span></span><b>${money(featCost(r,[k]))}</b></li>`).join("")}</ul>`:""}
   ${f.cov?`<h4>Coverage</h4><div class="cov-grid"><div><b>Included</b><p class="small">${f.cov.inc}</p></div><div><b>Excluded from forecast</b><p class="small">${f.cov.exc}</p></div><div><b>Not yet verified</b><p class="small">${f.cov.unv}</p></div><div><b>Confidence</b><p class="small">${f.cov.conf}</p></div></div><p class="small"><a href="#reference/coverage">Full coverage matrix →</a></p>`:""}
   <h4>Services it pays for directly</h4><ul class="kv">${Object.entries(bySvc).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<li><span>${k}</span><b>${money(v)}</b></li>`).join("")}</ul>
   ${u?`<p class="small">≈ $${(tot/u[0]).toFixed(4)} ${u[1]} (${num(u[0])} this month).</p>`:""}
   <h4>Shared services it relies on</h4><p class="small">${sharedNames}. These are counted once under Shared infrastructure, not here.</p>
   <h4>Overlap with other figures</h4><p class="small">${f.overlap}</p>
   ${f.id==="chatrag"&&V.comprehendOn?`<p class="small"><span class="badge b-pending">Pending</span> A planned privacy-processing update for RAG questions may add up to ${money(pendingTechDphi(r).cost)} a month. Not included until its implementation is verified.</p>`:""}
   <h4>How it responds to the Simulator inputs</h4>${driverRows(f.drivers,m=>featCost(m,f.feats),tot)}
   <details class="sub"><summary>${items.length} line item${items.length===1?"":"s"}</summary><table>${items.sort((a,b)=>b[1].val-a[1].val).map(([k,x])=>`<tr><td>${lineName(k,x)}</td><td class="n">${money(x.val)}</td></tr>`).join("")}</table></details>`;
}
function voiceDetail(r,vc){
  const vs=voiceShare(r), parts={};
  Object.values(r.c).filter(x=>x.turnBased).forEach(x=>{const k=x.cat==="De-identification"?"Privacy scans (Comprehend Medical)":x.prov+" · "+x.model;parts[k]=(parts[k]||0)+x.val*vs;});
  return `<p>Speaking instead of typing. Speech-to-text and read-aloud run on the iPhone at no charge. Voice costs money only because each spoken message becomes a chat turn, with the same AI, privacy and memory steps.</p>
   <p class="note-box"><b>Not added to the total.</b> This is the share of Chat &amp; RAG triggered by spoken turns (${Math.round(100*vs)}% of turns this month), calculated by the model as voice turns ÷ all turns × per-turn costs. It's already inside the Chat &amp; RAG figure.</p>
   <h4>Where the voice share goes</h4><ul class="kv">${Object.entries(parts).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<li><span>${k}</span><b>${money(v)}</b></li>`).join("")}</ul>
   <p class="small">${num(r.voice)} voice turns this month; speech recognition and read-aloud cost $0.00.</p>
   <h4>Coverage</h4><p class="small">Code check: speech-to-text and read-aloud use Apple's on-device frameworks, and spoken turns go through the same chat path as typed ones. No paid speech API is used, so nothing is missing and nothing is double-counted. Not yet verified: voice minutes, turns per minute, and whether voice sessions create extra chat titles.</p>
   <h4>How it responds to the Simulator inputs</h4>${driverRows([["Twice as many voice minutes",v=>({voiceMin:v.voiceMin*2})],["One more turn per voice minute",v=>({tpm:Math.min(6,v.tpm+1)})],["Twice as many users",users2]],m=>voiceCost(m),vc)}
   <p class="small">Voice isn't in a TestFlight build yet; these figures assume the planned release.</p>`;
}
function renderBreakdown(){
  const R=run(V), r=R[BDM], T=r.total, items=Object.entries(r.c);
  $("bd-scen").textContent=(currentPreset?PRESETS[currentPreset].t:"Custom settings")+` · ${["Low","Base","High"][BAND]} case · ${num(r.users)} users`;
  const sharedItems=items.filter(([,x])=>x.feat==="Shared"), shared=sharedItems.reduce((s,[,x])=>s+x.val,0);
  const known=new Set(["Shared",...BDF.flatMap(f=>f.feats)]), other=items.filter(([,x])=>!known.has(x.feat)).reduce((s,[,x])=>s+x.val,0);
  const fv=BDF.map(f=>({f,v:featCost(r,f.feats)})), featTot=fv.reduce((s,x)=>s+x.v,0);
  const byP={};items.forEach(([,x])=>byP[x.prov]=(byP[x.prov]||0)+x.val);const provTot=Object.values(byP).reduce((s,x)=>s+x,0);
  const ok=x=>Math.abs(x-T)<0.005?`<span class="okc">✓ matches</span>`:`<span class="badc">✗ off by ${money(Math.abs(x-T))}</span>`;
  const segs=fv.map(({f,v})=>[f.t,v,cssv(f.color)]).concat([["Shared infrastructure",shared,cssv("--c5")+"99"]]);
  $("bd-total").innerHTML=`<div class="bt-top"><div><span class="small">Total, month ${BDM+1}</span><div class="bt-v">${money(T)}<small>/mo</small></div></div>
    <p class="small bt-expl">Feature costs + shared infrastructure = total. The provider view is the same money grouped differently. Voice is a slice of Chat &amp; RAG.</p></div>
   <div class="stackbar" role="img" aria-label="Total split into features and shared infrastructure">${segs.filter(s=>s[1]>0).map(([n,v,c])=>`<span style="flex:${v};background:${c}" title="${n}: ${money(v)}"></span>`).join("")}</div>
   <div class="legend">${segs.map(([n,v,c])=>`<span><i style="background:${c}"></i>${n} ${money(v)}</span>`).join("")}</div>
   <p class="small recon">Features ${money(featTot)} + shared ${money(shared)}${other?` + other ${money(other)}`:""} = ${money(featTot+shared+other)} ${ok(featTot+shared+other)} · Provider view ${money(provTot)} ${ok(provTot)}</p>`;
  const sharedNames=sharedItems.map(([,x])=>x.model).join(", ");
  const acc=(id,cls,dot,title,short,v,pct,body)=>`<details class="acc ${cls}" data-acc="${id}"${bdOpen.has(id)?" open":""}><summary>
    <span class="acc-dot" style="background:${dot}"></span><span class="acc-t"><b>${title}</b><span class="small">${short}</span></span>
    <span class="acc-v"><b>${money(v)}</b><span class="small">${pct}</span></span><span class="chev" aria-hidden="true">›</span>
    <span class="acc-bar"><i style="width:${Math.max(0.5,Math.min(100,100*v/(T||1)))}%;background:${dot}"></i></span></summary><div class="acc-body">${body}</div></details>`;
  const vc=voiceCost(r);
  $("bd-features").innerHTML=fv.map(({f,v})=>acc(f.id,"",cssv(f.color),f.t,f.short,v,`${T?Math.round(100*v/T):0}% of total`,featDetail(f,r,sharedNames))).join("")+
    acc("voice","overlap",cssv("--c4"),"Voice <span class=\"ovl\">part of Chat &amp; RAG</span>","Spoken turns. A slice, not extra",vc,`${featCost(r,["Chat","RAG","Memory"])?Math.round(100*vc/featCost(r,["Chat","RAG","Memory"])):0}% of Chat &amp; RAG`,voiceDetail(r,vc));
  $("bd-features").querySelectorAll("details.acc").forEach(d=>d.addEventListener("toggle",()=>{d.open?bdOpen.add(d.dataset.acc):bdOpen.delete(d.dataset.acc);}));
  $("bd-shared").innerHTML=`<div class="bt-top"><div><span class="small">Shared infrastructure</span><div class="bt-v sm">${money(shared)}<small>/mo</small></div></div><p class="small bt-expl">${T?Math.round(100*shared/T):0}% of the total. Mostly fixed: it stays about the same whether 10 or 100 people use the app, until the servers need to grow.</p></div>
   <ul class="kv">${sharedItems.sort((a,b)=>b[1].val-a[1].val).map(([,x])=>`<li><span>${x.model} <span class="small">· ${x.cat}</span></span><b>${money(x.val)}</b></li>`).join("")}</ul>
   <p class="small">Dedicated parts are attributed directly instead: the RAG host and its search bundle are counted in Chat &amp; RAG, because only RAG uses them.</p>`;
  const PC=PROVC();
  hbars("bd-prov",Object.entries(byP).map(([k,v])=>({label:k,value:v,color:PC[k]})),{l:110,pct:T,w:480});
  $("bd-prov-note").innerHTML=`<p class="small">AWS ${money(byP.AWS||0)} includes infrastructure, storage and Comprehend Medical privacy scans. Sum ${money(provTot)} ${ok(provTot)}</p>`;
  const C=CATC();
  $("bd-table").innerHTML=`<table><tr><th>Line item</th><th>Type</th><th>Billed by</th><th>Attributed to</th><th class="n">Month ${BDM+1}</th><th class="n">Share</th></tr>`+
   items.sort((a,b)=>CATS.indexOf(a[1].cat)-CATS.indexOf(b[1].cat)||b[1].val-a[1].val).map(([k,x])=>`<tr><td>${x.model}${x.cat==="De-identification"?` <span class="small">· ${DSITES[k].n}</span>`:""}</td><td><span class="st-dot" style="background:${C[x.cat]}"></span>${x.cat}</td><td>${x.prov}</td><td>${FEATL[x.feat]||x.feat}</td><td class="n">${money(x.val)}</td><td class="n">${T?(100*x.val/T).toFixed(1):0}%</td></tr>`).join("")+
   `<tr><th colspan="4">Total</th><th class="n">${money(T)}</th><th class="n">100%</th></tr></table>`;
}

/* ===================== 5. ASSUMPTIONS ===================== */
function buildPrices(){
  $("tb-prices").innerHTML=`<table><tr><th>Item</th><th>Price</th><th>Unit</th><th>Status</th><th>Source</th></tr>`+
   PR.map(r=>`<tr><td>${r[1]}</td><td><input type="number" step="any" min="0" data-p="${r[0]}" value="${P[r[0]]}" class="${P[r[0]]!==r[2]?"chg":""}" aria-label="${r[1]} price"></td><td class="small">${r[3]}</td><td>${badge(r[4])}</td><td class="small">${srcLink(r[5])}</td></tr>`).join("")+`</table>`;
  document.querySelectorAll("#tb-prices input").forEach(i=>i.addEventListener("input",()=>{const r=PR.find(x=>x[0]===i.dataset.p);P[i.dataset.p]=+i.value||0;i.classList.toggle("chg",P[r[0]]!==r[2]);refresh();}));
}
function srcLink(s){return s.startsWith("http")?`<a href="${s.split(" ")[0]}" target="_blank" rel="noopener noreferrer">${s.split(" ")[0].replace(/^https:\/\//,"").replace(/\/$/,"")}</a>${s.includes(" ")?" "+s.slice(s.indexOf(" ")+1):""}`:s;}
function buildAssume(){
  $("tb-assume").innerHTML=`<table><tr><th>Group</th><th>Assumption</th><th>Low</th><th>Base</th><th>High</th><th>Unit</th><th>Basis</th><th>Note</th></tr>`+
   AS.map((r,i)=>`<tr><td class="small">${r[1]}</td><td>${r[2]}</td>${[3,4,5].map(j=>`<td><input type="number" step="any" data-i="${i}" data-j="${j}" value="${r[j]}" class="${j-3===BAND?"act":""} ${r[j]!==AS0[i][j-3]?"chg":""}" aria-label="${r[2]} ${["low","base","high"][j-3]}"></td>`).join("")}<td class="small">${r[6]}</td><td>${badge(r[7])}</td><td class="small">${r[8]}</td></tr>`).join("")+`</table>`;
  document.querySelectorAll("#tb-assume input").forEach(inp=>inp.addEventListener("input",()=>{const i=+inp.dataset.i,j=+inp.dataset.j,r=AS[i];r[j]=+inp.value||0;A[r[0]]=r[3+BAND];inp.classList.toggle("chg",r[j]!==AS0[i][j-3]);refresh();}));
  $("tb-onetime").innerHTML=`<table><tr><th>Item</th><th>Type</th><th>Cost</th><th>Note</th></tr>
   <tr><td>Apple Developer Program</td><td>Annual</td><td class="n">$99 / year</td><td class="small">Spread monthly in the totals when the option is on. ${badge("official")}</td></tr>
   <tr><td>Custom domain &amp; DNS</td><td>Optional</td><td class="n">—</td><td class="small">Not priced; the app uses a free AWS HTTPS address today.</td></tr>
   <tr><td>Evaluation runs (AI quality tests)</td><td>Optional, per run</td><td class="n">≈ ${money(evalRunCost())} per 75-turn suite</td><td class="small">Uses the same per-turn AI rates as the model. Not in monthly totals.</td></tr>
   <tr><td>Initial deploy, iOS login, monitoring setup</td><td>One-time (engineering time)</td><td class="n">hours, not $</td><td class="small">Staff time isn't priced here.</td></tr>
   <tr><td>Analytics / crash reporting tool</td><td>Future, to be decided</td><td class="n">—</td><td class="small">No tool chosen. TestFlight feedback is free.</td></tr>
   <tr><td>Email invitations for caregivers</td><td>Future</td><td class="n">tiny</td><td class="small">Same SES rate as verification emails, once built.</td></tr></table>`;
}
function evalRunCost(){const v={...V,users:1,growth:0,daily:100,chat:75/DAYS,voiceMin:0,logs:0,ragPct:V.ragPct,voiceInChat:false};const r=month(v,A,0);return Object.values(r.c).filter(x=>x.cat==="AI models"||x.cat==="De-identification").reduce((s,x)=>s+(x.feat==="Chat"||x.feat==="RAG"||x.feat==="Memory"?x.val:0),0);}
function buildMethod(){
  const M=[
   ["Backend compute (Fargate)","tasks × (vCPU × rate + GB × rate) × 730 h","official","Task size from deployment config; adequacy under load unmeasured"],
   ["Load balancer","(hourly + LCU × LCU rate) × 730 h","official","LCU average assumed"],
   ["Public IPv4","addresses × rate × 730 h","official","Address count assumed"],
   ["Database instance (RDS)","rate × 730 h","secondary","Instance class from deployment config"],
   ["RAG host (EC2 + disk)","rate × 730 h + 8 GB × EBS rate","secondary","Host size from deployment config"],
   ["Database storage","allocated GB × rate (grows with turns × KB + logs × KB)","repo","Row sizes assumed"],
   ["Database backups","max(0, DB size × backup factor − allocated) × rate","assumed","7-day retention from config"],
   ["CloudWatch Logs","max(0, GB − 5) × ingest + GB × storage","official","Log volume assumed"],
   ["Chat AI","routed turns × tokens × price (route decision, answer, summary, title, recall)","official","Measured for the ordinary route; other routes assumed"],
   ["RAG AI","RAG turns × (3 Groq calls + embedding + rerank 30 chunks + gpt-4o-mini answer)","official","Token sizes assumed; answer length from synthetic eval"],
   ["Care-log AI","logs × (AI-assisted share × extraction + notes share × summary + embedding)","official","Shares and token sizes assumed"],
   ["Care Insights","logs × runs per log × (judge + investigator + critic)","official","Runs per log from code"],
   ["De-identification","tiered price × Σ over 7 steps (calls × ⌈chars ÷ 100⌉, min 1)","official","Calls per step code-audited; text lengths assumed or synthetic"],
   ["Login and email","Cognito above 10,000 MAU; SES per 1,000 emails","official","$0 at pilot scale"],
   ["Data transfer out","max(0, GB − 100) × rate","assumed","KB per turn assumed"],
   ["Apple Developer Program","$99 ÷ 12","official","—"]];
  $("as-method").innerHTML=`<table><tr><th>Cost</th><th>Monthly formula</th><th>Price status</th><th>Usage inputs</th></tr>`+M.map(r=>`<tr><td>${r[0]}</td><td class="small"><code>${r[1]}</code></td><td>${badge(r[2])}</td><td class="small">${r[3]}</td></tr>`).join("")+`</table>`;
}

/* ===================== 6. VALIDATION ===================== */
function renderValidation(){
  const cnt=(arr,i,s)=>arr.filter(r=>r[i]===s).length;
  $("va-ev").innerHTML=[
   [`${cnt(PR,4,"official")} of ${PR.length}`,"Prices officially verified",badge("official")+" provider page or price list, 2026-10-28"],
   [`${PR.length-cnt(PR,4,"official")}`,"Prices not yet official",`${cnt(PR,4,"secondary")} secondary, ${cnt(PR,4,"repo")} team-recorded, ${cnt(PR,4,"assumed")} assumed`],
   [`${cnt(AS,7,"code")} + 7 steps`,"Code-audited behavior",badge("code")+" configuration values and the 7 de-identification steps"],
   [`${cnt(AS,7,"measured")}`,"Measured from eval runs",badge("measured")+" team eval runs and content data"],
   [`${cnt(AS,7,"synthetic")}`,"Synthetic-eval measurements",badge("synthetic")+" synthetic questions, not real traffic"],
   [`${cnt(AS,7,"assumed")} of ${AS.length}`,"Usage values still assumed",badge("assumed")+" judgment values until the pilot"]]
   .map(([v,l,s])=>`<div class="kpi"><div class="v">${v}</div><div class="l">${l}</div><div class="s">${s}</div></div>`).join("");
  $("va-done").innerHTML=`<ul class="tight">
   <li>${badge("official")} <b>Comprehend Medical DetectPHI pricing</b> checked against AWS's price list (published 2026-09-11): $0.0014 per 100-character unit to 1M units a month, then $0.0005 and $0.00025. Minimum 1 unit per request.</li>
   <li>${badge("code")} <b>De-identification call paths audited:</b> 7 steps, each with its own text, no cache. They drive the per-step unit counts in the Simulator.</li>
   <li>${badge("synthetic")} <b>RAG answer length</b> from a synthetic evaluation (105 questions × 3 runs): mean ≈ 1,365 characters, p90 ≈ 2,000. RAG output tokens set to 250 / 340 / 500 and question-plus-reply scan length to 1,100 / 1,550 / 2,200. Not real patient traffic.</li>
   <li>${badge("measured")} <b>Route decision, ordinary answer, summary and title tokens</b> measured from team eval runs (Aug 2026).</li>
   <li>${badge("official")} <b>AI provider prices</b> (Anthropic, OpenAI, Voyage, Groq) and most AWS prices read on official pages on 2026-10-28.</li></ul>`;
  const pd=pendingTechDphi(runWith({...V0,...PRESETS.small.v},aBase())[0],aBase());
  $("va-pending").innerHTML=`<ul class="tight">
   <li>${badge("pending")} <b>AWS configuration verification.</b> Task count, CPU/memory, public IPv4 count, database storage and log retention come from deployment scripts. Live settings are still to be confirmed (read-only).</li>
   <li>${badge("pending")} <b>Official AWS rates</b> for RDS instance, RDS storage and backups, EC2, EBS and S3 in us-east-1 (currently secondary, team-recorded or assumed).</li>
   <li>${badge("pending")} <b>Planned privacy-processing update for RAG questions.</b> May add up to ≈ ${money(pd.cost)}/mo of de-identification for the Small pilot. It isn't in the totals; the formula changes only after the final implementation is confirmed.</li>
   <li>${badge("missing")} <b>Real usage per person</b>: messages, voice minutes, care logs, daily-active share, route mix. Needs pilot data.</li>
   <li>${badge("missing")} <b>Real message and reply lengths</b> and a per-step DetectPHI call counter.</li>
   <li>${badge("missing")} <b>Token counts</b> for RAG stages, Care Insights and log extraction; Groq→OpenAI failover rate.</li>
   <li>${badge("missing")} <b>Voice usage counters</b> (sessions, seconds, turns; no audio).</li>
   <li>${badge("missing")} <b>CPU and memory under load</b>, and database growth per turn.</li></ul>`;
  const vS={...V0,...PRESETS.small.v}, base=scen(allAt(1),null,vS)[0].total;
  const settle={freq:"Pilot usage aggregates per user",tok:"Token logging per call and stage",phi:"Text-length percentiles; DetectPHI call counter",mix:"Turn counts by route",store:"Database size queries; load-balancer metrics",price:"Official AWS price list lookup"};
  const U=FACTORS.map(([k,l])=>({k,l,lo:scen({...allAt(1),[k]:0},null,vS)[0].total,hi:scen({...allAt(1),[k]:2},null,vS)[0].total})).sort((a,b)=>(b.hi-b.lo)-(a.hi-a.lo));
  $("va-unc").innerHTML=`<table><tr><th>Rank</th><th>Uncertain input</th><th class="n">Low</th><th class="n">High</th><th class="n">Swing</th><th>What settles it</th></tr>`+
   U.map((u,i)=>`<tr><td>${i+1}</td><td>${u.l}</td><td class="n">${money(u.lo)}</td><td class="n">${money(u.hi)}</td><td class="n">${money(u.hi-u.lo)}</td><td class="small">${settle[u.k]}</td></tr>`).join("")+
   `<tr><td></td><td class="small" colspan="5">Base ${money(base)}/month. Not in any band: infrastructure step changes (a second backend task), retry spikes, free tiers ending, planned features.</td></tr></table>`;
  const AWS="AWS / infrastructure lead", ENG="Backend · RAG · iOS lead", PM="Product / pilot lead";
  const TASKS=[
   ["AWS","Confirm deployed settings against model inputs (read-only): tasks, CPU/memory, public IPs, database storage, log retention",AWS,"Not started","Before pilot"],
   ["AWS","Look up official us-east-1 rates for RDS, RDS storage and backups, EC2, EBS and S3",AWS,"Not started","Before pilot"],
   ["AWS","List available CloudWatch metrics (compute CPU/memory, database storage, load-balancer usage, log volume)",AWS,"Not started","Before pilot"],
   ["AWS","Propose alerts on DetectPHI units and the monthly budget",AWS,"Not started","Before pilot"],
   ["Backend","Confirm the final behavior of the planned RAG privacy-processing update, then update the model if it adds usage",ENG,"Pending verification","Before pilot"],
   ["Backend","Aggregate-only measurement queries: turns by route, text-length percentiles, logs, Care Insights runs, tokens",ENG,"Not started","Before pilot"],
   ["Backend","Per-step DetectPHI counter (calls, characters, units; numbers only)",ENG,"Design needed","Pilot"],
   ["RAG","Log token counts per stage and model; count failover events",ENG,"Not started","Pilot"],
   ["iOS / Voice","Aggregate voice counters (sessions, seconds, turns; no audio or transcript)",ENG,"Not started","Pilot"],
   ["Product","Expected usage per persona; approve the aggregate-only measurement policy; schedule calibration checkpoints",PM,"Not started","Before pilot"]];
  $("va-tasks").innerHTML=`<table><tr><th>Area</th><th>Task</th><th>Owner</th><th>Status</th><th>When</th></tr>`+
   TASKS.map(t=>`<tr><td>${t[0]}</td><td>${t[1]}</td><td><span class="owner">${t[2]}</span></td><td class="small">${t[3]}</td><td class="small">${t[4]}</td></tr>`).join("")+`</table><p class="small">Status as of 2026-10-29.</p>`;
  const src={};PR.forEach(r=>{const u=r[5].startsWith("http")?r[5].split(" ")[0]:r[5];(src[u]=src[u]||{s:r[4],items:[],raw:r[5]}).items.push(r[1]);});
  $("va-sources").innerHTML=`<table><tr><th>Source</th><th>Status</th><th>Used for</th><th>Checked</th></tr>`+
   Object.entries(src).map(([u,o])=>`<tr><td class="small">${srcLink(o.raw)}</td><td>${badge(o.s)}</td><td class="small">${o.items.join("; ")}</td><td class="small">${o.s==="repo"?"2026-09-15":D}</td></tr>`).join("")+`</table>`;
}

/* ===================== INIT ===================== */
$("themeBtn").onclick=()=>{const r=document.documentElement;const dark=r.dataset.theme?r.dataset.theme==="dark":matchMedia("(prefers-color-scheme: dark)").matches;r.dataset.theme=dark?"light":"dark";refresh();};
$("shareBtn").onclick=share;
document.addEventListener("click",e=>{const b=e.target.closest("[data-to]");if(b){const t=$(b.dataset.to);if(t)t.scrollIntoView({behavior:"smooth",block:"start"});}});
$("resetBtn").onclick=resetAll;
document.querySelectorAll("#bdMonth button").forEach(b=>b.onclick=()=>{BDM=+b.dataset.m;document.querySelectorAll("#bdMonth button").forEach(x=>x.setAttribute("aria-pressed",x===b));renderBreakdown();});
document.querySelectorAll("#ovMonth button").forEach(b=>b.onclick=()=>{OVM=+b.dataset.m;document.querySelectorAll("#ovMonth button").forEach(x=>x.setAttribute("aria-pressed",x===b));renderOverview();});
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change",refresh);
buildTop();buildInputs();buildPrices();buildAssume();buildSensCtl();buildMethod();
KMap.initMap(()=>run(V));
KDeploy.init();KRef.init(scenLabel);KRef.renderMethod();KRef.renderCoverage();
KGate.onUnlock(()=>{window.addEventListener("hashchange",route);route();});
