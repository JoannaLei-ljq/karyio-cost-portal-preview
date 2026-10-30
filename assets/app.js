/* Karyio Cost Planning portal: routing, shared state and the six pages.
   Every number comes from model.js; no page keeps its own copy of a formula. */

const CATS=["Infrastructure","AI models","De-identification","Storage & logs","Other services"];
const CATC=()=>({"Infrastructure":cssv("--c1"),"AI models":cssv("--c2"),"De-identification":cssv("--c6"),"Storage & logs":cssv("--c3"),"Other services":cssv("--c5")});
const PROVC=()=>({"Anthropic":cssv("--c2"),"OpenAI":cssv("--c3"),"Voyage AI":cssv("--c4"),"Groq":cssv("--c7"),"AWS":cssv("--c6"),"Apple":cssv("--c5")});
const FEATC=()=>({"Chat":cssv("--c1"),"RAG":cssv("--c2"),"Memory":cssv("--c4"),"Care logs":cssv("--c3"),"Care Insights":cssv("--c7"),"Shared":cssv("--c5"),"Login":cssv("--c6"),"Distribution":cssv("--c5")});
const FEATL={"Shared":"Shared infrastructure","Login":"Login & email","Distribution":"App distribution"};
const MON=Array.from({length:12},(_,i)=>"M"+(i+1));
const $=id=>document.getElementById(id);
const badge=s=>`<span class="badge b-${s}">${{official:"Official",secondary:"Secondary",repo:"Team-recorded",assumed:"Assumed",measured:"Measured",synthetic:"Synthetic eval",code:"From code",pending:"Pending",missing:"Missing"}[s]}</span>`;
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
  const url=location.origin+location.pathname+"#"+PAGE+"?cfg="+encodeState();
  try{await navigator.clipboard.writeText(url);toast("Scenario link copied. It restores these settings.");}
  catch(e){window.prompt("Copy this link to share the current scenario:",url);}
}

/* ===================== ROUTING ===================== */
const PAGES=["overview","simulator","breakdown","architecture","assumptions","validation"];
function route(){
  const [pg,q]=location.hash.slice(1).split("?");
  if(q&&q.startsWith("cfg=")){if(applyState(q.slice(4))){syncInputs();markPreset(currentPreset);syncBand();buildPrices();buildAssume();buildSensCtl();toast("Scenario restored from link");}
    history.replaceState(null,"","#"+(PAGES.includes(pg)?pg:"overview"));}
  PAGE=PAGES.includes(pg)?pg:"overview";
  document.querySelectorAll(".page").forEach(s=>s.classList.toggle("active",s.id==="page-"+PAGE));
  document.querySelectorAll("nav.main a").forEach(a=>{if(a.dataset.page===PAGE)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current");});
  refresh();window.scrollTo(0,0);
}
function refresh(){
  const m=modifiedParts();
  $("estbar").innerHTML="Planning estimates built from public prices and assumed usage. Not AWS bills, quotes or production measurements."+(m.any?` <span class="mod">· Prices or assumptions edited in this browser (Reset restores defaults).</span>`:"");
  ({overview:renderOverview,simulator:render,breakdown:renderBreakdown,architecture:()=>KMap.drawMap(),assumptions:()=>{},validation:renderValidation})[PAGE]();
}

/* ===================== 1. OVERVIEW ===================== */
function renderOverview(){
  const a=aBase(), C=CATC();
  const S={};Object.entries(PRESETS).forEach(([k,p])=>{const v={...V0,...p.v};S[k]={t:p.t,v,R:runWith(v,a),lo:scen(allAt(0),null,v),hi:scen(allAt(2),null,v)};});
  const sm=S.small, gr=S.growing, lg=S.larger;
  const fixed=sm.R[0].cat["Infrastructure"]||0;
  $("ov-kpis").innerHTML=[
   ["big",money0(sm.R[0].total)+"/mo","Small pilot, base case","10 users, no growth"],
   ["",money0(sm.lo[0].total)+" – "+money0(sm.hi[0].total),"Small pilot, Low – High","Outer limits: every uncertain input low or high together"],
   ["",money0(gr.R[0].total)+" → "+money0(gr.R[11].total),"Growing pilot, month 1 → 12","50 users, +15% a month"],
   ["",money0(sum12(gr.R)),"Growing pilot, 12-month total","Base case; Low – High "+money0(sum12(gr.lo))+" – "+money0(sum12(gr.hi))],
   ["",Math.round(100*fixed/sm.R[0].total)+"%","Fixed infrastructure share, Small pilot",money0(fixed)+"/mo runs whether or not anyone uses the app"]]
   .map(([c,v,l,s])=>`<div class="kpi ${c}"><div class="v">${v}</div><div class="l">${l}</div><div class="s">${s}</div></div>`).join("");
  legend("ov-lg-trend",[["Growing pilot",cssv("--c2")],["Small pilot",cssv("--c1")],["Growing Low–High",cssv("--c2")+"55"]]);
  lines("ov-trend",MON,[{name:"Growing pilot",color:cssv("--c2"),values:gr.R.map(r=>r.total),w:3},{name:"Small pilot",color:cssv("--c1"),values:sm.R.map(r=>r.total)}],
    {band:{lo:gr.lo.map(r=>r.total),hi:gr.hi.map(r=>r.total),color:cssv("--c2")}});
  legend("ov-lg-mix",CATS.map(c=>[c,C[c]]));
  const cols=[["Small M1",sm.R[0]],["Growing M1",gr.R[0]],["Growing M12",gr.R[11]]];
  stacked("ov-mix",cols.map(x=>x[0]),CATS.map(c=>({name:c,color:C[c],values:cols.map(x=>x[1].cat[c]||0)})),{totals:true});
  const g12=gr.R[11], items={};
  Object.entries(g12.c).forEach(([k,x])=>{const lab=x.cat==="De-identification"?"Comprehend Medical (all steps)":x.model+(x.feat!=="Shared"?" · "+x.feat:"");items[lab]=items[lab]||{label:lab,value:0,color:x.cat==="De-identification"?cssv("--c6"):(x.prov==="AWS"?cssv("--c1"):PROVC()[x.prov])};items[lab].value+=x.val;});
  hbars("ov-drivers",Object.values(items).sort((a,b)=>b.value-a.value).slice(0,8),{l:210,pct:g12.total});
  const unver=PR.filter(r=>r[4]!=="official");
  const unverAmt=Object.entries(sm.R[0].c).filter(([k])=>["rds","ec2","rdsSt","rdsBk","s3","cw","xfer"].includes(k)).reduce((s,[,x])=>s+x.val,0);
  const fgOne=(V0.vcpu*P.fgVcpu+V0.mem*P.fgGb)*730, pend=pendingTechDphi(sm.R[0],a);
  $("ov-uncertain").innerHTML=`<ul class="tight">
   <li>${badge("assumed")} <b>Usage per person</b> (messages, voice minutes, care logs, daily-active share). There's no pilot data yet, and every usage cost scales with it.</li>
   <li>${badge("assumed")} <b>How much text de-identification scans.</b> Comprehend Medical is the largest usage cost. Its price is verified; text lengths are assumed, and RAG lengths come from ${badge("synthetic")} tests.</li>
   <li>${badge("assumed")} <b>Infrastructure sizing under load.</b> Never measured. A second backend task would add about ${money0(fgOne)}/mo.</li>
   <li>${badge("secondary")} <b>${unver.length} prices not yet confirmed on AWS's official pages</b> (RDS, EC2, EBS, S3 and others), about ${money0(unverAmt)}/mo of the Small pilot.</li>
   <li>${badge("pending")} <b>A planned de-identification change</b> may add about ${money(pend.cost)}/mo to the Small pilot. Not in the totals until its implementation is verified.</li></ul>`;
  const m=modifiedParts();
  $("ov-note").innerHTML=`Overview figures use each preset with base-case assumptions, independent of the Simulator sliders.${m.any?" <span class=\"mod\">Prices or assumptions were edited on Assumptions &amp; Pricing, so these figures differ from the published defaults.</span>":""} Larger-usage preset (500 users): ${money0(lg.R[0].total)} → ${money0(lg.R[11].total)} a month; its infrastructure sizing is unmeasured.`;
}

/* ===================== 2. SIMULATOR ===================== */
function buildInputs(){
  const groups={};Object.entries(IN).forEach(([k,o])=>(groups[o.g]=groups[o.g]||[]).push([k,o]));
  $("inputs").innerHTML=Object.entries(groups).map(([g,list],gi)=>`<details class="grp" ${gi<3?"open":""}><summary>${g}</summary>`+list.map(([k,o])=>o.type==="chk"
    ?`<div class="ctl chk"><label><input type="checkbox" id="in-${k}" ${V[k]?"checked":""}>&nbsp;${o.l}</label>${o.hint?`<div class="hint">${o.hint}</div>`:""}</div>`
    :`<div class="ctl"><label for="in-${k}"><span>${o.l}</span><b id="o-${k}">${o.fmt(V[k])}</b></label><input type="range" id="in-${k}" min="${o.min}" max="${o.max}" step="${o.step}" value="${V[k]}">${o.hint?`<div class="hint">${o.hint}</div>`:""}</div>`).join("")+`</details>`).join("")+
    `<p class="small" style="margin:8px 0 0">Token sizes, row sizes and other uncertain values are in <a href="#assumptions">Assumptions &amp; Pricing</a>.</p>`;
  Object.entries(IN).forEach(([k,o])=>{const e=$("in-"+k);e.addEventListener("input",()=>{V[k]=o.type==="chk"?e.checked:+e.value;if(o.fmt)$("o-"+k).textContent=o.fmt(V[k]);markPreset(null);render();});});
}
function syncInputs(){Object.entries(IN).forEach(([k,o])=>{const e=$("in-"+k);if(o.type==="chk")e.checked=V[k];else{e.value=V[k];$("o-"+k).textContent=o.fmt(V[k]);}});}
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
   <tr><td>Speech recognition &amp; read-aloud</td><td class="n">$0 (on-device)</td></tr>
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
let BDM=0;
function renderBreakdown(){
  const R=run(V), r=R[BDM], items=Object.entries(r.c), T=r.total;
  const sumIf=f=>items.filter(([k,x])=>f(k,x)).reduce((s,[,x])=>s+x.val,0);
  $("bd-scen").textContent=(currentPreset?PRESETS[currentPreset].t:"Custom settings")+` · ${["Low","Base","High"][BAND]} case · ${num(r.users)} users`;
  const pd=pendingTechDphi(r), ai=r.cat["AI models"]||0, de=r.cat["De-identification"]||0;
  const provAI={};items.filter(([,x])=>x.cat==="AI models").forEach(([,x])=>provAI[x.prov]=(provAI[x.prov]||0)+x.val);
  const storeKeys=["rdsSt","rdsBk","cw","ecr","s3"];
  const pc=x=>T?Math.round(100*x/T)+"% of total":"";
  const cards=[
   ["Voice",cssv("--c4"),voiceCost(r),`${Math.round(100*voiceShare(r))}% of turns are spoken. Speech runs on the phone at no charge, so voice cost is the AI, de-identification and memory work of those turns. It's already inside Chat, RAG and Memory below, not on top of them.`],
   ["Chat & RAG",cssv("--c1"),sumIf((k,x)=>["Chat","RAG","Memory"].includes(x.feat)),`Chat ${money(sumIf((k,x)=>x.feat==="Chat"))}, RAG ${money(sumIf((k,x)=>x.feat==="RAG"))} (incl. its EC2 host), memory ${money(sumIf((k,x)=>x.feat==="Memory"))}. ${num(r.turns)} turns, ${num(r.rag)} of them RAG.`],
   ["Care Logs & Insights",cssv("--c3"),sumIf((k,x)=>x.feat==="Care logs"||x.feat==="Care Insights"),`${num(r.logs)} logs and ${num(r.runs)} background Care Insights runs. Includes their AI calls and de-identification.`],
   ["AI providers",cssv("--c2"),ai,Object.entries(provAI).sort((a,b)=>b[1]-a[1]).map(([p,v])=>`${p} ${money(v)}`).join(", ")+". "+pc(ai)],
   ["Comprehend Medical",cssv("--c6"),de,`${num(r.dphiU)} DetectPHI units (100 characters each). ${pc(de)}. <span class="badge b-pending">Pending</span> up to +${money(pd.cost)} from a planned privacy-processing update (not included).`],
   ["AWS infrastructure",cssv("--c1"),r.cat["Infrastructure"]||0,`Backend compute, load balancer, public IPs, database instance, RAG host, secrets. Mostly fixed: it doesn't change with use. ${pc(r.cat["Infrastructure"]||0)}`],
   ["Database, storage & data growth",cssv("--c3"),storeKeys.reduce((s,k)=>s+(r.c[k]?r.c[k].val:0),0),`Database ≈ ${num(r.dbGb,2)} GB on ${r.alloc} GB allocated (billed by allocation), backups, logs, images, RAG bundle.`]];
  $("bd-cards").innerHTML=cards.map(([t,c,v,d])=>`<div class="fc" style="border-top-color:${c}"><h3>${t}</h3><div class="v">${money(v)}<span class="small"> / month</span></div><p>${d}</p></div>`).join("");
  const FC=FEATC(), byF={};items.forEach(([,x])=>byF[x.feat]=(byF[x.feat]||0)+x.val);
  hbars("bd-feat",Object.entries(byF).map(([k,v])=>({label:FEATL[k]||k,value:v,color:FC[k]})),{l:170,pct:T});
  const PC=PROVC(), byP={};items.forEach(([,x])=>byP[x.prov]=(byP[x.prov]||0)+x.val);
  hbars("bd-prov",Object.entries(byP).map(([k,v])=>({label:k,value:v,color:PC[k]})),{l:120,pct:T});
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
$("resetBtn").onclick=resetAll;
document.querySelectorAll("#bdMonth button").forEach(b=>b.onclick=()=>{BDM=+b.dataset.m;document.querySelectorAll("#bdMonth button").forEach(x=>x.setAttribute("aria-pressed",x===b));renderBreakdown();});
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change",refresh);
window.addEventListener("hashchange",route);
buildTop();buildInputs();buildPrices();buildAssume();buildSensCtl();buildMethod();
KMap.initMap(()=>run(V));
route();
