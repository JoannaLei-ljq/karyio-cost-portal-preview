/* Architecture Map: cost-relevant components only. */
const KMap=(()=>{
const STATUS = {
  confirmed:{label:"Confirmed running", desc:"Checked by the team, or the confirmed service can't run without it"},
  built:{label:"Built, runtime unverified", desc:"Built; not yet checked whether it's on or in use"},
  unverified:{label:"Configured, state unknown", desc:"Set up to exist. Current state not confirmed"},
  optional:{label:"Optional / dev only", desc:"Not on the normal app path"},
  planned:{label:"Planned / future", desc:"Not built yet"}
};
const PTYPE = {aws:"AWS", ext:"External provider", apple:"Apple", self:"Inside our own services", dev:"Development / tooling"};
const C1=20,C2=232,C3=444,C4=656,C5=900, W=170, H=48;
// cost: line-item ids (or a provider name) in the cost model that this component drives
const NODES = [
 {id:"ios",x:C1,y:150,l:"iOS app",s:"client",st:"built",pt:"apple",d:"The app patients and caregivers install. Not on TestFlight yet; production sign-in is being connected.",cost:[]},
 {id:"testclients",x:C1,y:280,l:"Internal test clients",s:"dev tools",st:"optional",pt:"dev",d:"Internal testing tools that call the same backend. Development only, but any use triggers the same backend and AI costs as the app.",cost:[]},
 {id:"cognito",x:C2,y:40,l:"Cognito sign-in",s:"user accounts",st:"unverified",pt:"aws",d:"Login service, billed by monthly active users above the free tier. Verification and recovery emails are sent through an email service.",cost:["cognito","ses"]},
 {id:"alb",x:C2,y:150,l:"Load balancer + HTTPS",s:"ALB, certificate",st:"confirmed",pt:"aws",d:"Public HTTPS entry point with a managed certificate. Chat replies stream through it, so long connections count toward its usage.",cost:["alb"]},
 {id:"ipv4",x:C2,y:250,l:"Public IPs + traffic",s:"networking",st:"confirmed",pt:"aws",d:"Public IPv4 addresses (billed hourly) and outbound data transfer.",cost:["ipv4","xfer"]},
 {id:"budgets",x:C2,y:440,l:"Budgets / Cost Explorer",s:"cost alerts",st:"built",pt:"aws",d:"Budget email alerts and cost checks. No meaningful direct cost.",cost:[]},
 {id:"backend",x:C3,y:150,l:"Backend",s:"ECS Fargate",st:"confirmed",pt:"aws",d:"Java Spring Boot service. Runs chat, care logs, memory, the AI agents and background jobs. Confirmed running. It stays always on because scheduled jobs run every minute and hourly.",cost:["fargate"]},
 {id:"rag",x:C3,y:300,l:"RAG service",s:"EC2 + disk",st:"unverified",pt:"aws",d:"Python service that answers medical questions from a curated set of ALS guides. Runs on one small EC2 host.",cost:["ec2"]},
 {id:"rds",x:C4,y:40,l:"PostgreSQL + pgvector",s:"RDS",st:"unverified",pt:"aws",d:"The main database: users, logs, chats and memory vectors, with storage that can auto-grow and 7-day backups. Very likely running, because the confirmed backend needs it.",cost:["rds","rdsSt","rdsBk"]},
 {id:"cw",x:C4,y:120,l:"CloudWatch",s:"logs + alarms",st:"built",pt:"aws",d:"Application logs (30-day retention) and a deployment health alarm.",cost:["cw"]},
 {id:"comprehend",x:C4,y:200,l:"Comprehend Medical",s:"PHI detection",st:"built",pt:"aws",d:"AWS service that finds health identifiers so they can be removed before text goes to AI providers. Charged per 100-character unit; currently the largest usage-based cost.",cost:["dDecider","dExec","dPair","dTitle","dLogSave","dLogDraft","dEvidence"]},
 {id:"s3",x:C4,y:300,l:"S3 bucket",s:"RAG search bundle",st:"unverified",pt:"aws",d:"Stores the RAG search-index bundle (about 16 MB) that the RAG host loads at startup.",cost:["s3"]},
 {id:"ecr",x:C4,y:370,l:"ECR registry",s:"container images",st:"confirmed",pt:"aws",d:"Stores backend and RAG container images. Old image versions count as storage.",cost:["ecr"]},
 {id:"secrets",x:C4,y:440,l:"Secrets & config",s:"keys & settings",st:"built",pt:"aws",d:"Managed storage for API keys and settings.",cost:["secret"]},
 {id:"anthropic",x:C5,y:40,l:"Anthropic (Claude)",s:"Haiku 4.5 (+ Sonnet 5)",st:"built",pt:"ext",d:"Routes every chat turn and writes log extractions, titles, summaries and investigator steps. Sonnet is used only by a route that is off in the pilot.",cost:"Anthropic"},
 {id:"openai",x:C5,y:120,l:"OpenAI",s:"gpt-4o-mini",st:"built",pt:"ext",d:"Writes chat answers for most routes, Care Insights judge/critic steps, and RAG answers. Also the backup when Groq fails.",cost:"OpenAI"},
 {id:"voyage",x:C5,y:200,l:"Voyage AI",s:"embeddings + rerank",st:"built",pt:"ext",d:"Turns text into vectors (RAG questions and memory) and re-ranks RAG search results.",cost:"Voyage AI"},
 {id:"groq",x:C5,y:300,l:"Groq",s:"gpt-oss models",st:"built",pt:"ext",d:"Runs the RAG safety screen, question analysis and HyDE (about 3 calls per question). Falls back to OpenAI on errors.",cost:"Groq"},
 {id:"appledev",x:C1,y:548,l:"Apple Dev / TestFlight",s:"distribution",st:"planned",pt:"apple",d:"Needed to distribute the app on TestFlight. $99 per year.",cost:["apple"]},
 {id:"speech",x:C2,y:548,l:"Apple speech + voice",s:"on-device",st:"built",pt:"apple",d:"On-device speech-to-text and text-to-speech; no per-minute charge. Each spoken message still becomes a chat turn, which is where voice cost comes from. Voice is not yet in a TestFlight build.",cost:[]},
 {id:"gh",x:C3,y:548,l:"CI (GitHub Actions)",s:"build & test",st:"built",pt:"dev",d:"Automated backend tests. Within free allowances at current volume.",cost:[]},
 {id:"unstructured",x:C4,y:548,l:"Unstructured",s:"PDF parsing (offline)",st:"optional",pt:"ext",d:"Hosted PDF parsing, used only when the RAG content bundle is rebuilt.",cost:[]},
 {id:"eval",x:C5,y:548,l:"Evaluation runs",s:"AI quality tests",st:"optional",pt:"dev",d:"Agent and RAG quality tests. Each run makes real AI calls (see one-time costs in Assumptions & Pricing).",cost:[]}
];
const EDGES = [
 ["ios","alb"],["ios","cognito","planned"],["testclients","alb","dev"],
 ["alb","backend"],["ipv4","backend"],["backend","cognito"],["backend","rds"],["backend","cw"],["backend","comprehend"],
 ["backend","secrets"],["backend","rag"],["backend","anthropic"],["backend","openai"],["backend","voyage"],
 ["rag","groq"],["rag","openai"],["rag","voyage"],["rag","s3"],["rag","secrets"],["ecr","backend"],["ecr","rag"],
 ["speech","ios"],["appledev","ios","planned"],["unstructured","s3","dev"],["eval","backend","dev"],["gh","ecr","dev"]
];
const FUTURE = [
 {id:"F1",tier:"near",t:"Real iOS login & sign-up",d:"Connect iOS to Cognito: sign-up, email verification, password recovery.",cost:"Cognito active users; verification and recovery emails.",dep:["cognito","ios","backend"]},
 {id:"F2",tier:"confirm",t:"Onboarding, consent & account lifecycle",d:"Recorded privacy/terms consent, account deletion and export.",cost:"Mostly database work; a hosted privacy policy page.",dep:["backend","rds","cognito","ios"]},
 {id:"F3",tier:"near",t:"Shared workspaces & invitations",d:"Invite codes, roles and membership exist. Inviting a caregiver by email is not built yet.",cost:"Database only today. Email invites would add an email-sending dependency.",dep:["backend","rds"]},
 {id:"F5",tier:"near",t:"Production voice & voice-driven logging",d:"Ship Voice Mode in release builds, voice-to-care-log, accessibility.",cost:"No metered speech provider. Each spoken turn costs the same as a typed chat turn.",dep:["speech","ios","backend","anthropic"]},
 {id:"F6",tier:"confirm",t:"Analytics, crash reporting & pilot feedback",d:"No analytics or crash SDK yet. TestFlight has built-in feedback and crash logs.",cost:"Possibly a third-party SDK (to be decided); dashboards and alarms.",dep:["ios","cw","appledev"]},
 {id:"F7",tier:"road",t:"Safety evaluation & ongoing AI quality",d:"Scheduled evaluations and citation checks.",cost:"Eval runs make real AI calls; CI runner time.",dep:["eval","anthropic","openai","gh"]},
 {id:"F8",tier:"road",t:"Data retention, deletion & recovery",d:"Retention and erasure policies and their implementation.",cost:"Longer backups or snapshots; possibly additional managed encryption keys; more de-identification if coverage widens.",dep:["comprehend","rds","cw","secrets"]},
 {id:"F9",tier:"near",t:"Usage limits & cost controls",d:"Usage is recorded today. Hard caps were approved in principle; values are still open.",cost:"Provider spend limits; a custom metric and alarm; budget actions; in-app rate limiting.",dep:["backend","budgets","cw","anthropic","openai"]},
 {id:"F10",tier:"road",t:"Scaling for an external caregiver pilot",d:"Moving beyond internal testers.",cost:"More AI usage; possibly larger or extra backend tasks; database high availability; support time.",dep:["backend","rds","rag","alb"]},
 {id:"F11",tier:"confirm",t:"Custom domain & DNS",d:"The app uses a free AWS-generated HTTPS address today. A branded domain is optional.",cost:"Domain registration and DNS hosting.",dep:["alb"]},
 {id:"F12",tier:"road",t:"Automated RAG build & deploy",d:"Automate the RAG image rebuild and deployment.",cost:"CI runner time; image storage.",dep:["gh","ecr","rag"]}
];
const SHARED = ["Load balancer + HTTPS","Backend (always on)","Public IPs","PostgreSQL (RDS)","CloudWatch logs","Secrets & config","Container images","RAG host (shared by RAG features)"];
const FLOWS = [
 {id:"chat",t:"Chat (ordinary turn)",sub:"Typed message to the assistant",steps:[
  ["iOS → Load balancer → Backend","Message sent; reply streams back","always","AWS (shared)"],
  ["Crisis safety check","Deterministic check before anything else; no AI call","local","Backend"],
  ["Route decision","One Claude Haiku call picks the route (skipped for some shortcuts and crisis replies)","always","Anthropic"],
  ["De-identification","Comprehend Medical scans text on routes that send personal context out","cond","AWS Comprehend Medical"],
  ["Route answer","gpt-4o-mini writes the reply on most routes","cond","OpenAI"],
  ["Save messages + usage record","Stored in PostgreSQL","always","RDS (shared)"],
  ["Chat title","Claude call when a new chat needs a title","async","Anthropic"],
  ["Chat summary → memory","Summary, de-identification and an embedding, stored for recall","async","Anthropic · Comprehend · Voyage"]]},
 {id:"rag",t:"RAG question",sub:"Medical / ALS-guide question",steps:[
  ["Route decision","Backend picks the technical route","always","Anthropic"],
  ["Backend → RAG service","Internal service call","always","AWS EC2 (shared)"],
  ["Safety screen","Fast check of the question","always","Groq (OpenAI if Groq fails)"],
  ["Analysis + HyDE","Classify/rewrite and a hypothetical answer: 2 calls","always","Groq (OpenAI if Groq fails)"],
  ["Embed the question","One embedding request","always","Voyage"],
  ["Local search","Vector + keyword search over the bundle; no outside call","local","RAG service"],
  ["Rerank","Re-score about 30 candidates","always","Voyage"],
  ["Write the answer","gpt-4o-mini","always","OpenAI"],
  ["Citation check","Local verification of citations","local","RAG service"],
  ["Retries / failover","Extra attempts when a provider errors or rate-limits","cond","Groq · OpenAI · Voyage"]]},
 {id:"voice",t:"Voice",sub:"Speak instead of type",steps:[
  ["Speech → text on the phone","Apple on-device recognition; no metered provider","local","Apple"],
  ["Same as a Chat turn","Each spoken message costs the same as a typed one (and a RAG question if it routes there)","always","See Chat / RAG"],
  ["Reply read aloud","Apple text-to-speech on the phone","local","Apple"],
  ["Available in TestFlight builds","Not in a release build yet","planned","iOS release work"]]},
 {id:"logs",t:"Care Logs",sub:"Manual, AI-assisted, or from chat",steps:[
  ["Save a log","Stored in PostgreSQL (manual form)","always","RDS (shared)"],
  ["AI-assisted: parse a description","De-identify, then Claude extracts fields (draft only)","cond","Comprehend · Anthropic"],
  ["From chat","The log-type classifier and draft extraction run","cond","Anthropic"],
  ["Log summary","Claude summary only when notes are present","async","Anthropic"],
  ["Memory embedding","De-identify and embed for later recall","async","Comprehend · Voyage"],
  ["Wake the reflection agent","Counts toward Care Insights triggers","async","See Care Insights"]]},
 {id:"memory",t:"Memory & recall",sub:"Remembering past chats and logs",steps:[
  ["Summaries","Chat and log summaries (see Chat and Care Logs)","async","Anthropic"],
  ["Embeddings stored","Vectors stored in pgvector; database storage grows","async","Voyage · RDS"],
  ["Recall","Query embedding plus about 3 Claude calls per recall turn","cond","Voyage · Anthropic"],
  ["Memory search for context","Vector search inside the database","local","RDS (shared)"]]},
 {id:"insights",t:"Care Insights",sub:"Background reflection agent",steps:[
  ["Triggered by new logs","Runs after a threshold of new inputs, urgent signals, or an hourly sweep","async","Backend"],
  ["Judge","gpt-4o-mini decides whether to act","async","OpenAI"],
  ["Investigator","Claude Haiku looks into the data","async","Anthropic"],
  ["Critic","gpt-4o-mini reviews the result","async","OpenAI"],
  ["Run limits","Per-run ceiling and daily cap limit how much it does","local","Backend"]]},
 {id:"reports",t:"Weekly Reports",sub:"Scheduled summaries",steps:[
  ["Hourly sweeps","Scheduled database work","async","Backend · RDS"],
  ["Report content","Comes from the reflection agent; no AI call of its own today","cond","See Care Insights"]]},
 {id:"login",t:"Login & accounts",sub:"Sign-up, sign-in, recovery",steps:[
  ["Sign-up / sign-in in iOS","Being connected","planned","Cognito"],
  ["Verification and recovery emails","Sent on sign-up and recovery","planned","Cognito / email service"],
  ["Token check on each request","Checked locally with cached keys; no per-request charge expected","always","Backend"],
  ["Register user / workspace","Rows in PostgreSQL","always","RDS (shared)"]]},
 {id:"jobs",t:"Background jobs",sub:"Things that run without a user",steps:[
  ["Housekeeping","Every minute, database only","async","Backend · RDS"],
  ["Reflection and report sweeps","Hourly; can start Care Insights runs","async","Backend"],
  ["Keeps the backend always on","These jobs are why the backend can't scale to zero","always","AWS compute (shared)"]]}
];
const INV = [
 ["Compute & hosting","Backend container (ECS Fargate)","Runs the backend 24/7. Cost depends on size and uptime.","AWS","confirmed"],
 ["Compute & hosting","Extra tasks (scaling and deploy overlap)","A second task may run during deploys or busy periods.","AWS","built"],
 ["Compute & hosting","Always-on background jobs","Scheduled jobs mean the backend can't sleep. Drives uptime, not a separate bill.","Inside our services","built"],
 ["Compute & hosting","RAG host (EC2) and disk (EBS)","One small server running the RAG service.","AWS","unverified"],
 ["Networking & HTTPS","Load balancer (ALB)","Public HTTPS entry. Long chat streams add to its usage.","AWS","confirmed"],
 ["Networking & HTTPS","HTTPS certificate","Managed certificate; no charge.","AWS","confirmed"],
 ["Networking & HTTPS","Public IP addresses","Billed per address-hour.","AWS","confirmed"],
 ["Networking & HTTPS","Data transfer","Traffic to the internet; first 100 GB a month free.","AWS","unverified"],
 ["Database & storage","PostgreSQL instance (RDS)","The main database server.","AWS","unverified"],
 ["Database & storage","Database storage","Billed by allocated size; auto-grows as logs, chats and memory accumulate.","AWS","unverified"],
 ["Database & storage","Database backups","7-day automatic backups; free up to the allocated size.","AWS","unverified"],
 ["Database & storage","S3 bucket for the RAG bundle","Stores the search-index bundle.","AWS","unverified"],
 ["Database & storage","Container image registry (ECR)","Stores images; old versions add storage.","AWS","confirmed"],
 ["Identity","Cognito user pool","Login service; billed by monthly active users above the free tier.","AWS","unverified"],
 ["Identity","Secrets & configuration","Managed storage for keys and settings.","AWS","built"],
 ["AI models","Claude Haiku 4.5","Routing, log extraction, titles, summaries, investigator.","Anthropic","built"],
 ["AI models","Claude Sonnet 5","Only used by a route that is off in the pilot.","Anthropic","optional"],
 ["AI models","OpenAI gpt-4o-mini","Chat answers, Care Insights judge and critic, RAG answers, Groq fallback.","OpenAI","built"],
 ["AI models","Groq (RAG analysis)","Safety screen, classify/rewrite and HyDE: about 3 calls per question.","Groq","built"],
 ["AI models","Retries & failover overhead","Extra paid attempts when a provider errors or rate-limits.","Several","built"],
 ["Retrieval & embeddings","Voyage embeddings","RAG questions and backend memory.","Voyage AI","built"],
 ["Retrieval & embeddings","Voyage rerank","Re-scores RAG search results.","Voyage AI","built"],
 ["Retrieval & embeddings","Local search (vector + keyword, pgvector)","Runs inside our own services; no vector-database subscription.","Inside our services","built"],
 ["Privacy","Comprehend Medical (DetectPHI)","Finds health identifiers before text goes to AI providers. Charged per 100-character unit.","AWS","built"],
 ["Monitoring & cost control","CloudWatch logs and alarm","Application logs (30 days) and a deployment health alarm.","AWS","built"],
 ["Monitoring & cost control","Budgets & cost checks","Budget email alerts; cost queries.","AWS","built"],
 ["Monitoring & cost control","In-app usage meter","Records model spend per user. Warns; doesn't block.","Inside our services","built"],
 ["Distribution & development","Apple Developer Program / TestFlight","Needed to distribute through TestFlight.","Apple","planned"],
 ["Distribution & development","Apple on-device speech & voice","No metered provider.","Apple","built"],
 ["Distribution & development","CI (GitHub Actions)","Automated tests.","GitHub","built"],
 ["Distribution & development","Evaluation runs","Quality tests; each run makes real AI calls.","Several","optional"],
 ["Distribution & development","Development & demo AI usage","Local and demo environments use the same AI providers.","Several","optional"],
 ["Content pipeline (offline)","PDF parsing and corpus re-embedding","Only when the ALS guide bundle is rebuilt.","Unstructured · Voyage AI","optional"]
];
FUTURE.forEach(f=>INV.push(["Planned / future",f.t,f.d+" Possible cost sources: "+f.cost,"To be decided","planned"]));

let map, getRun=()=>null;
function mel(tag,attrs,parent){const e=document.createElementNS(NS,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);(parent||map).appendChild(e);return e;}
const GROUPS=[
 {x:6,y:126,w:198,h:262,f:"--g-client",b:"--g-client-b",l:"Clients"},
 {x:218,y:14,w:640,h:492,f:"--g-aws",b:"--g-aws-b",l:"AWS"},
 {x:884,y:14,w:206,h:350,f:"--g-ext",b:"--g-ext-b",l:"External AI providers"},
 {x:6,y:522,w:1084,h:94,f:"--g-dev",b:"--g-dev-b",l:"Apple, development & content tools"}
];
const statusVar={confirmed:"--s-confirmed",built:"--s-built",unverified:"--s-unverified",optional:"--s-optional",planned:"--s-planned"};
const nodeEls={}, edgeEls=[];
function nodeCost(n){const R=getRun();if(!R)return null;const m1=R[0];
  if(typeof n.cost==="string")return Object.values(m1.c).filter(x=>x.prov===n.cost).reduce((s,x)=>s+x.val,0);
  return n.cost.reduce((s,k)=>s+(m1.c[k]?m1.c[k].val:0),0);}
function drawMap(){
  map.innerHTML="";edgeEls.length=0;
  GROUPS.forEach(g=>{mel("rect",{x:g.x,y:g.y,width:g.w,height:g.h,class:"grp",fill:cssv(g.f),stroke:cssv(g.b)});const t=mel("text",{x:g.x+10,y:g.y+16,class:"grp-label"});t.textContent=g.l;});
  const byId=Object.fromEntries(NODES.map(n=>[n.id,n]));
  EDGES.forEach(([a,b,k])=>{
    const A=byId[a],B=byId[b];let x1,y1,x2,y2;
    if(Math.abs(A.x-B.x)<5){x1=A.x+W/2;x2=B.x+W/2;y1=A.y+(B.y>A.y?H:0);y2=B.y+(B.y>A.y?0:H);}
    else if(A.y>=520||B.y>=520){x1=A.x+W/2;y1=A.y+(B.y<A.y?0:H);x2=B.x+W/2;y2=B.y+(B.y<A.y?H:0);}
    else {const ltr=B.x>A.x;x1=A.x+(ltr?W:0);x2=B.x+(ltr?0:W);y1=A.y+H/2;y2=B.y+H/2;}
    const mx=(x1+x2)/2,my=(y1+y2)/2;
    const d=(Math.abs(A.x-B.x)<5||A.y>=520||B.y>=520)?`M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`:`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
    const p=mel("path",{d,class:"edge"+(k?" "+k:"")});p.dataset.a=a;p.dataset.b=b;edgeEls.push(p);
  });
  NODES.forEach(n=>{
    const g=mel("g",{class:"node",tabindex:"0",role:"button","aria-label":n.l+", "+STATUS[n.st].label});
    const r=mel("rect",{x:n.x,y:n.y,width:W,height:H,class:"box",stroke:cssv(statusVar[n.st])},g);
    if(n.st==="planned")r.setAttribute("stroke-dasharray","6 4");
    if(n.st==="optional")r.setAttribute("stroke-dasharray","2 3");
    mel("circle",{cx:n.x+W-11,cy:n.y+11,r:4.5,fill:cssv(statusVar[n.st])},g);
    const t1=mel("text",{x:n.x+10,y:n.y+20},g);t1.textContent=n.l;
    const c=nodeCost(n);
    const t2=mel("text",{x:n.x+10,y:n.y+37,class:"small"},g);t2.textContent=n.s+(c?` · ${money(c)}/mo`:"");
    g.addEventListener("click",()=>selectNode(n.id));
    g.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();selectNode(n.id);}});
    nodeEls[n.id]=g;
  });
}
function clearHL(){Object.values(nodeEls).forEach(g=>g.classList.remove("dim","hl"));edgeEls.forEach(e=>e.classList.remove("dim","hl"));document.querySelectorAll(".fcard").forEach(c=>c.classList.remove("on"));}
function highlight(ids){
  clearHL();const set=new Set(ids);
  Object.entries(nodeEls).forEach(([id,g])=>{g.classList.add(set.has(id)?"hl":"dim");});
  edgeEls.forEach(e=>{const on=set.has(e.dataset.a)&&set.has(e.dataset.b);e.classList.add(on?"hl":"dim");});
}
function selectNode(id){
  const n=NODES.find(x=>x.id===id);
  const nb=new Set([id]);EDGES.forEach(([a,b])=>{if(a===id)nb.add(b);if(b===id)nb.add(a);});
  highlight([...nb]);nodeEls[id].classList.remove("dim");
  const conns=[...nb].filter(x=>x!==id).map(x=>NODES.find(z=>z.id===x).l).join(", ");
  const c=nodeCost(n);
  const costLine=c===null?"":(typeof n.cost==="string"||n.cost.length)
    ?`<p><b>Monthly cost in the current Simulator settings (month 1):</b> ${money(c)}</p>`
    :`<p class="note-box"><b>Direct cost:</b> none in the monthly model.</p>`;
  document.getElementById("detail").innerHTML=`<h3>${n.l}</h3>
   <div class="meta"><span class="pill st-${n.st}">${STATUS[n.st].label}</span><span class="pill">${PTYPE[n.pt]}</span></div>
   <p>${n.d}</p>${costLine}<p class="note-box"><b>Connects to:</b> ${conns||"—"}</p>
   <p><button class="btn btn-sm" id="clr" type="button">Clear highlight</button></p>`;
  document.getElementById("clr").onclick=()=>{clearHL();};
}
function mapLegend(){
  document.getElementById("map-legend").innerHTML=Object.entries(STATUS).map(([k,v])=>`<span class="k" title="${v.desc}"><span class="sw" style="border-color:var(${statusVar[k]});${k==="planned"?"border-style:dashed;":k==="optional"?"border-style:dotted;":""}"></span>${v.label}</span>`).join("")+
  `<span class="k"><span class="sw" style="background:var(--g-aws);border-color:var(--g-aws-b)"></span>AWS</span><span class="k"><span class="sw" style="background:var(--g-ext);border-color:var(--g-ext-b)"></span>External provider</span><span class="k"><span class="sw" style="background:var(--g-dev);border-color:var(--g-dev-b)"></span>Apple / dev tools</span><span class="k">- - - planned or dev link</span>`;
}
function futureCards(){
  const G=document.getElementById("futureGrid");const tl={near:"Agreed near-term",road:"Longer-term roadmap",confirm:"Needs confirmation"};
  G.innerHTML=FUTURE.map(f=>`<button type="button" class="fcard" data-id="${f.id}"><span class="tier ${f.tier}">${tl[f.tier]}</span><h4>${f.t}</h4><p>${f.d}</p><p><b>Possible cost sources:</b> ${f.cost}</p></button>`).join("");
  G.querySelectorAll(".fcard").forEach(c=>c.addEventListener("click",()=>{const f=FUTURE.find(x=>x.id===c.dataset.id);highlight(f.dep);c.classList.add("on");
    document.getElementById("detail").innerHTML=`<h3>${f.t}</h3><div class="meta"><span class="pill st-planned">${tl[f.tier]}</span></div><p>${f.d}</p><p><b>Possible cost sources:</b> ${f.cost}</p><p class="note-box"><b>Depends on (highlighted):</b> ${f.dep.map(d=>NODES.find(n=>n.id===d).l).join(", ")}</p>`;
    map.scrollIntoView({behavior:"smooth",block:"nearest"});}));
}
const tyLabel={always:"Always",cond:"Conditional",async:"Async",planned:"Planned",local:"Local"};
function flows(){
  const L=document.getElementById("flist");
  L.innerHTML=FLOWS.map(f=>`<button type="button" data-id="${f.id}" aria-pressed="false">${f.t}<small>${f.sub}</small></button>`).join("");
  L.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>showFlow(b.dataset.id)));
  document.getElementById("sharedChips").innerHTML=SHARED.map(s=>`<span class="pill">${s}</span>`).join("");
  showFlow("chat");
}
function showFlow(id){
  const f=FLOWS.find(x=>x.id===id);
  document.querySelectorAll("#flist button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.id===id));
  const counts={};f.steps.forEach(s=>counts[s[2]]=(counts[s[2]]||0)+1);
  document.getElementById("flowHead").innerHTML=`<h3 style="margin:0">${f.t}</h3><p class="note-box" style="margin:4px 0">${f.sub}. ${Object.entries(counts).map(([k,v])=>`${v} ${tyLabel[k].toLowerCase()}`).join(" · ")}</p>`;
  document.getElementById("flowSteps").innerHTML=f.steps.map(s=>`<li class="t-${s[2]}"><div class="steprow"><b>${s[0]}</b><span class="ty ${s[2]}">${tyLabel[s[2]]}</span><span class="prov">${s[3]}</span></div><div class="note">${s[1]}</div></li>`).join("");
}
function opt(sel,label,vals){sel.innerHTML=`<option value="">${label}</option>`+vals.map(([v,t])=>`<option value="${v}">${t}</option>`).join("");}
function inventory(){
  const cats=[...new Set(INV.map(r=>r[0]))];
  opt(document.getElementById("fCat"),"All categories",cats.map(c=>[c,c]));
  opt(document.getElementById("fStatus"),"All statuses",Object.entries(STATUS).map(([k,v])=>[k,v.label]));
  ["q","fCat","fStatus"].forEach(id=>document.getElementById(id).addEventListener("input",renderInv));
  renderInv();
}
function renderInv(){
  const q=document.getElementById("q").value.toLowerCase().trim();
  const fc=document.getElementById("fCat").value,fs=document.getElementById("fStatus").value;
  const rows=INV.filter(r=>(!fc||r[0]===fc)&&(!fs||r[4]===fs)&&(!q||r.join(" ").toLowerCase().includes(q)));
  const by={};rows.forEach(r=>(by[r[0]]=by[r[0]]||[]).push(r));
  document.getElementById("count").textContent=`${rows.length} of ${INV.length} items shown`;
  document.getElementById("invList").innerHTML=Object.entries(by).map(([cat,list])=>`<h3 class="inv-cat">${cat} <span class="count">(${list.length})</span></h3>`+list.map(r=>
    `<div class="inv-item${r[4]==="planned"?" future":""}"><h4>${r[1]}</h4><p>${r[2]}</p><div class="inv-meta"><span class="pill">${r[3]}</span><span class="pill st-${r[4]}">${STATUS[r[4]].label}</span></div></div>`).join("")).join("")||`<p class="panel">No items match.</p>`;
}
function initMap(runFn){
  getRun=runFn;map=document.getElementById("map");
  mapLegend();drawMap();futureCards();flows();inventory();
  document.querySelectorAll("#map-tabs button").forEach(b=>b.addEventListener("click",()=>{
    document.querySelectorAll("#map-tabs button").forEach(x=>x.setAttribute("aria-selected",x===b));
    document.querySelectorAll(".mview").forEach(s=>s.classList.toggle("active",s.id==="mview-"+b.dataset.view));
  }));
}
return {initMap,drawMap};
})();
