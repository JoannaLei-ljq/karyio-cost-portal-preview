/* Architecture Map: cost-relevant components only.
   Implementation status and projected cost are kept apart: status says what is built or confirmed,
   cost comes from the model (model.js) at the current Simulator settings. */
const KMap=(()=>{
// Visible label is short; desc is the precise meaning, shown on demand.
const STATUS = {
  confirmed:{label:"Running", desc:"Confirmed running by the team, or required by something that is confirmed running."},
  built:{label:"Built", desc:"Built and configured, but not yet confirmed running in the deployed environment."},
  unverified:{label:"To confirm", desc:"Set up in the deployment plan; its current deployed state hasn't been confirmed yet."},
  optional:{label:"Optional", desc:"Development or occasional use only. Not on the normal app path."},
  planned:{label:"Planned", desc:"Not built yet, or only partly built."}
};
// Forecast treatment, independent of status.
const FC = {
  inc:{label:"In forecast", desc:"Included in the monthly totals at the current Simulator settings."},
  none:{label:"No direct cost", desc:"Has no charge of its own; it runs on, or is paid through, other items."},
  excl:{label:"Not in forecast", desc:"Could cost something, but is not included in the monthly totals."}
};
const FEATS=["Chat","Voice","Medical RAG","Care Logs","Care Insights","Memory","Sign-in"];
const ALL=FEATS;
const DSK=["dDecider","dExec","dPair","dTitle","dLogSave","dLogDraft","dEvidence"];
// cost: model line-item ids, or a provider name. fc: forecast treatment. a(v,r): plain-language cost assumptions.
const NODES = [
 {id:"ios",g:"app",l:"iOS app",s:"What patients and caregivers use",st:"built",fc:"none",
  d:"The iPhone app people install.",role:"Every feature starts here. It sends messages, voice turns and care logs to the backend and shows the replies.",uses:ALL,
  a:()=>"The app itself has no running cost. Its usage drives the backend, AI and privacy costs. Not on TestFlight yet; production sign-in is being connected."},
 {id:"speech",g:"app",l:"Apple speech & voice",s:"Speech runs on the phone",st:"built",fc:"none",
  d:"Apple's on-device speech-to-text and read-aloud.",role:"Lets people talk instead of type. Speech is turned into text on the phone, then sent like a chat message.",uses:["Voice"],
  a:()=>"No per-minute charge. Each spoken message becomes a chat turn, so voice cost shows up under Chat & RAG. Voice is not in a TestFlight build yet."},
 {id:"alb",g:"infra",l:"Load balancer + HTTPS",s:"Secure front door",st:"confirmed",fc:"inc",cost:["alb"],
  d:"The public HTTPS entry point, with a managed certificate.",role:"Receives every request from the app and passes it to the backend. Chat replies stream back through it.",uses:ALL,
  a:()=>`Hourly charge × 730 h, plus ${A.lcu} average capacity units (assumption). The certificate is free.`},
 {id:"ipv4",g:"infra",l:"Public IPs + traffic",s:"Internet addresses and data out",st:"confirmed",fc:"inc",cost:["ipv4","xfer"],
  d:"Public IPv4 addresses and outbound data transfer.",role:"Makes the service reachable and carries replies to phones.",uses:ALL,
  a:(v,r)=>`${v.ips} addresses × $0.005/hour. Data out is free up to 100 GB a month (≈ ${num(r.xGb,1)} GB projected).`},
 {id:"secrets",g:"infra",l:"Secrets & config",s:"Keys and settings",st:"built",fc:"inc",cost:["secret"],
  d:"Managed storage for API keys and settings.",role:"Keeps provider keys out of the code and hands them to the services at start-up.",uses:ALL,
  a:()=>"1 secret × $0.40 a month."},
 {id:"backend",g:"core",l:"Backend",s:"The brain of the service",st:"confirmed",fc:"inc",cost:["fargate"],
  d:"The main server (Java Spring Boot on AWS Fargate).",role:"Runs chat, care logs, memory, the AI agents and scheduled jobs, and calls every other service.",uses:ALL,
  a:v=>`${v.tasks} task × ${v.vcpu} vCPU × ${v.mem} GB, always on (730 h/month) because scheduled jobs run every minute. Sizing under load is unmeasured.`},
 {id:"rag",g:"core",l:"Medical RAG service",s:"Answers medical questions",st:"unverified",fc:"inc",cost:["ec2"],
  d:"A Python service that answers ALS questions from a curated set of guides.",role:"Finds the relevant guide passages and writes a cited answer.",uses:["Medical RAG"],
  a:v=>v.ragHost?"One small EC2 host (t3.small) + 8 GB disk, always on. Its AI calls are counted under AI & Privacy.":"The Simulator option “RAG runs on its own EC2 host” is off, so no host cost is included."},
 {id:"cognito",g:"core",l:"Sign-in (Cognito)",s:"User accounts",st:"unverified",fc:"inc",cost:["cognito","ses"],
  d:"AWS's login service, plus the email service that sends verification and recovery emails.",role:"Creates accounts and checks who is signed in.",uses:["Sign-in"],
  a:(v,r)=>`Projected for the planned setup, not for what is deployed today. Cognito is free below 10,000 monthly active users (≈ ${num(r.users)} projected), so only emails cost anything: 2 per new user × $0.10 per 1,000. That's why this is tiny.`},
 {id:"anthropic",g:"ai",l:"Anthropic (Claude)",s:"Routing, summaries, log drafting",st:"built",fc:"inc",cost:"Anthropic",
  d:"Claude Haiku 4.5 (Sonnet 5 only on a route that is off in the pilot).",role:"Decides how to handle each chat turn and writes summaries, titles, log extractions and Care Insights investigations.",uses:["Chat","Voice","Medical RAG","Care Logs","Care Insights","Memory"],
  a:(v,r)=>`$1 / $5 per million input / output tokens. ≈ ${num(r.turns)} chat turns and ${num(r.logs)} logs this month. Token sizes are partly measured.`},
 {id:"openai",g:"ai",l:"OpenAI",s:"Writes most replies",st:"built",fc:"inc",cost:"OpenAI",
  d:"gpt-4o-mini.",role:"Writes chat replies, medical answers and Care Insights judge/critic steps. Backup when Groq fails.",uses:["Chat","Voice","Medical RAG","Care Insights"],
  a:()=>`$0.15 / $0.60 per million tokens. Medical answer length comes from a synthetic evaluation.`},
 {id:"groq",g:"ai",l:"Groq",s:"Fast checks on medical questions",st:"built",fc:"inc",cost:"Groq",
  d:"gpt-oss models.",role:"Screens and rewrites each medical question (about 3 calls per question).",uses:["Medical RAG"],
  a:v=>v.groqFree?"The Simulator option “Groq covered by its free quota” is on, so Groq costs $0.":"$0.075 / $0.30 per million tokens; 10% of calls assumed to fail over to OpenAI."},
 {id:"voyage",g:"ai",l:"Voyage AI",s:"Search and memory vectors",st:"built",fc:"inc",cost:"Voyage AI",
  d:"Embeddings and re-ranking.",role:"Turns text into vectors so Karyio can search guides and remember past chats and logs.",uses:["Medical RAG","Memory","Care Logs"],
  a:()=>"$0.18 per million tokens for embeddings, $0.02 for re-ranking. Very small at pilot scale."},
 {id:"comprehend",g:"ai",l:"Comprehend Medical",s:"Removes health identifiers",st:"built",fc:"inc",cost:DSK,
  d:"AWS's medical de-identification service (DetectPHI).",role:"Finds names, dates and other identifiers so they can be removed before text goes to AI providers.",uses:["Chat","Voice","Memory","Care Logs","Care Insights"],
  a:(v,r)=>v.comprehendOn?`≈ ${num(r.dphiU)} units of 100 characters this month at $0.0014 each (official price). The price is verified; how much text gets scanned is an assumption. Usually the largest usage cost.`:"Switched off in the Simulator (what-if), so no cost is included."},
 {id:"rds",g:"data",l:"Database (PostgreSQL)",s:"Users, chats, logs, memory",st:"unverified",fc:"inc",cost:["rds","rdsSt","rdsBk"],
  d:"Amazon RDS PostgreSQL with pgvector.",role:"Stores everything people enter, plus memory vectors and usage records.",uses:ALL,
  a:(v,r)=>`db.t4g.micro instance always on, ${r.alloc} GB allocated storage (database ≈ ${num(r.dbGb,2)} GB; storage is billed by allocation). Backups are free up to the allocated size. Very likely running, because the confirmed backend needs it.`},
 {id:"s3",g:"data",l:"File storage (S3)",s:"Medical guide search index",st:"unverified",fc:"inc",cost:["s3"],
  d:"Amazon S3 bucket.",role:"Holds the ALS guide search bundle that the RAG service loads at start-up.",uses:["Medical RAG"],
  a:()=>"About 16 MB stored, a fraction of a cent a month."},
 {id:"ecr",g:"data",l:"Container images (ECR)",s:"Packaged software",st:"confirmed",fc:"inc",cost:["ecr"],
  d:"Amazon ECR registry.",role:"Stores the packaged backend and RAG software that AWS runs.",uses:ALL,
  a:()=>"About 0.5 GB of images at $0.10 per GB-month."},
 {id:"cw",g:"data",l:"Logs & alarms (CloudWatch)",s:"Operational logs",st:"built",fc:"inc",cost:["cw"],
  d:"Amazon CloudWatch.",role:"Keeps application logs and a deployment health alarm.",uses:ALL,
  a:(v,r)=>`≈ ${num(r.cwGb,2)} GB of logs a month, first 5 GB of ingestion free, ${v.logRet}-day retention.`},
 {id:"appledev",g:"tools",l:"Apple Developer / TestFlight",s:"App distribution",st:"planned",fc:"inc",cost:["apple"],
  d:"Apple Developer Program membership.",role:"Needed to put the app on TestFlight for pilot users.",uses:["App distribution"],
  a:v=>v.apple?"$99 a year, spread monthly. Included even though it's planned, because the pilot needs it.":"Excluded by the Simulator option “Include Apple Developer fee”."},
 {id:"budgets",g:"tools",l:"Budgets & cost checks",s:"Spending alerts",st:"built",fc:"excl",
  d:"AWS Budgets and Cost Explorer.",role:"Emails the team when spending crosses a threshold.",uses:["Cost monitoring"],
  a:()=>"Not in the forecast; expected to be negligible."},
 {id:"gh",g:"tools",l:"CI (GitHub Actions)",s:"Automated tests",st:"built",fc:"excl",
  d:"Continuous integration.",role:"Builds and tests the backend on every change.",uses:["Development"],
  a:()=>"Not in the forecast; expected to stay within free allowances."},
 {id:"eval",g:"tools",l:"Evaluation runs",s:"AI quality tests",st:"optional",fc:"excl",
  d:"Agent and RAG quality test suites.",role:"Checks answer quality and safety before releases.",uses:["Quality testing"],
  a:()=>"Not in the monthly forecast. Each run makes real AI calls; the per-run cost is listed under Reference & Validation → One-time costs."},
 {id:"unstructured",g:"tools",l:"Unstructured",s:"PDF parsing for guide updates",st:"optional",fc:"excl",
  d:"Hosted PDF parsing.",role:"Used only when the ALS guide collection is rebuilt.",uses:["Content updates"],
  a:()=>"Not in the forecast; occasional, per rebuild."},
 {id:"testclients",g:"tools",l:"Internal test clients",s:"Team testing tools",st:"optional",fc:"none",
  d:"Internal tools that call the same backend.",role:"Let the team test without the iPhone app.",uses:["Development"],
  a:()=>"No cost of their own, but their chats cost the same as app chats."}
];
const GROUPS={
 app:{t:"User-facing app",d:"What people hold in their hands"},
 infra:{t:"Cloud entry & infrastructure",d:"How requests reach Karyio safely"},
 core:{t:"Core backend",d:"Where the work happens"},
 ai:{t:"AI & privacy",d:"Paid per use: grows with activity"},
 data:{t:"Data & storage",d:"What Karyio keeps"},
 tools:{t:"Supporting tools",d:"Distribution, testing and monitoring, off the main path"}
};
const EDGES = [
 ["ios","alb"],["ios","cognito"],["testclients","alb"],["alb","backend"],["ipv4","backend"],["backend","cognito"],["backend","rds"],["backend","cw"],["backend","comprehend"],
 ["backend","secrets"],["backend","rag"],["backend","anthropic"],["backend","openai"],["backend","voyage"],
 ["rag","groq"],["rag","openai"],["rag","voyage"],["rag","s3"],["rag","secrets"],["ecr","backend"],["ecr","rag"],
 ["speech","ios"],["appledev","ios"],["unstructured","s3"],["eval","backend"],["gh","ecr"]
];
const FUTURE = [
 {id:"F1",tier:"near",t:"Real iOS login & sign-up",d:"Connect iOS to Cognito: sign-up, email verification, password recovery.",cost:"Cognito active users; verification and recovery emails. Already projected in the forecast for the planned setup.",dep:["cognito","ios","backend"]},
 {id:"F3",tier:"near",t:"Shared workspaces & invitations",d:"Invite codes, roles and membership exist. Inviting a caregiver by email is not built yet.",cost:"Database only today. Email invites would add an email-sending dependency.",dep:["backend","rds"]},
 {id:"F5",tier:"near",t:"Production voice & voice-driven logging",d:"Ship Voice Mode in release builds, voice-to-care-log, accessibility.",cost:"No metered speech provider. Each spoken turn costs the same as a typed chat turn (already modeled through voice minutes).",dep:["speech","ios","backend","anthropic"]},
 {id:"F9",tier:"near",t:"Usage limits & cost controls",d:"Usage is recorded today. Hard caps were approved in principle; values are still open.",cost:"Provider spend limits; a custom metric and alarm; budget actions; in-app rate limiting.",dep:["backend","budgets","cw","anthropic","openai"]},
 {id:"F2",tier:"confirm",t:"Onboarding, consent & account lifecycle",d:"Recorded privacy/terms consent, account deletion and export.",cost:"Mostly database work; a hosted privacy policy page.",dep:["backend","rds","cognito","ios"]},
 {id:"F6",tier:"confirm",t:"Analytics, crash reporting & pilot feedback",d:"No analytics or crash SDK yet. TestFlight has built-in feedback and crash logs.",cost:"Possibly a third-party SDK (to be decided); dashboards and alarms.",dep:["ios","cw","appledev"]},
 {id:"F11",tier:"confirm",t:"Custom domain & DNS",d:"The app uses a free AWS-generated HTTPS address today. A branded domain is optional.",cost:"Domain registration and DNS hosting.",dep:["alb"]},
 {id:"F7",tier:"road",t:"Safety evaluation & ongoing AI quality",d:"Scheduled evaluations and citation checks.",cost:"Eval runs make real AI calls; CI runner time.",dep:["eval","anthropic","openai","gh"]},
 {id:"F8",tier:"road",t:"Data retention, deletion & recovery",d:"Retention and erasure policies and their implementation.",cost:"Longer backups or snapshots; possibly additional managed encryption keys; more de-identification if coverage widens.",dep:["comprehend","rds","cw","secrets"]},
 {id:"F10",tier:"road",t:"Scaling for an external caregiver pilot",d:"Moving beyond internal testers.",cost:"More AI usage; possibly larger or extra backend tasks; database high availability; support time.",dep:["backend","rds","rag","alb"]},
 {id:"F12",tier:"road",t:"Automated RAG build & deploy",d:"Automate the RAG image rebuild and deployment.",cost:"CI runner time; image storage.",dep:["gh","ecr","rag"]}
];
const TIERS={near:["Agreed near-term","Needed for the pilot"],confirm:["Needs a decision","An open question or option"],road:["Longer-term","Needed before a wider rollout"]};
// Feature flows. Step types: always / cond / async / planned / local. cost(r): projected cost of the feature at current settings.
const featSum=(r,fs)=>Object.values(r.c).filter(x=>fs.includes(x.feat)).reduce((s,x)=>s+x.val,0);
const FLOWS = [
 {id:"chat",t:"Chat",sub:"Someone types a message to the assistant",cost:r=>featSum(r,["Chat","Memory"]),costNote:"Chat + memory summaries of each turn.",steps:[
  ["App → load balancer → backend","Message sent; the reply streams back","always","Shared infrastructure"],
  ["Crisis safety check","Checked first, with fixed rules; no AI call","local","Backend"],
  ["Route decision","One Claude call decides how to handle the message","always","Anthropic"],
  ["Remove health identifiers","Comprehend Medical scans the text before it leaves","cond","Comprehend Medical"],
  ["Write the reply","gpt-4o-mini writes the answer on most routes","cond","OpenAI"],
  ["Save the conversation","Stored in the database","always","Shared infrastructure"],
  ["Title a new chat","One small Claude call for a new conversation","async","Anthropic"],
  ["Remember it","Summary, de-identification and an embedding, kept for later","async","Anthropic · Comprehend · Voyage"]]},
 {id:"voice",t:"Voice",sub:"Someone speaks instead of typing",cost:r=>voiceCost(r),costNote:"Part of Chat & RAG, not extra: the share of chat cost triggered by spoken turns.",overlap:true,steps:[
  ["Speech → text on the phone","Apple on-device recognition","local","Apple (on device)"],
  ["Handled like a chat message","Same route, reply and memory steps as Chat (or Medical RAG)","always","See Chat / Medical RAG"],
  ["Reply read aloud","Apple text-to-speech on the phone","local","Apple (on device)"],
  ["In TestFlight builds","Not in a release build yet","planned","iOS release work"]]},
 {id:"rag",t:"Medical RAG",sub:"Someone asks an ALS or medical question",cost:r=>featSum(r,["RAG"]),costNote:"RAG AI calls and its dedicated host. The route decision and memory summary of these turns are counted under Chat.",steps:[
  ["Route decision","The backend picks the medical-question route","always","Anthropic",["shared","Counted under Chat"]],
  ["Backend → RAG service","Internal call to the RAG host","always","RAG host (dedicated)",["fixed","Fixed cost, in this feature"]],
  ["Safety screen","Quick check of the question","always","Groq"],
  ["Understand the question","Classify, rewrite and draft a hypothetical answer: 2 calls","always","Groq (OpenAI if Groq fails)"],
  ["Search the guides","Embed the question, search locally, re-rank 30 passages","always","Voyage"],
  ["Write the cited answer","gpt-4o-mini","always","OpenAI"],
  ["Check citations","Done locally","local","RAG service"]]},
 {id:"logs",t:"Care Logs",sub:"Someone records symptoms, meds or events",cost:r=>featSum(r,["Care logs"]),costNote:"AI help, summaries, memory and de-identification for logs.",steps:[
  ["Save the log","Stored in the database","always","Shared infrastructure"],
  ["AI help (optional)","De-identify, then Claude drafts the fields from a description","cond","Comprehend · Anthropic"],
  ["Summarize notes","Claude summary when notes are present","async","Anthropic"],
  ["Remember it","De-identify and embed for later recall","async","Comprehend · Voyage"],
  ["Wake Care Insights","Counts toward the next insight run","async","See Care Insights"]]},
 {id:"insights",t:"Care Insights",sub:"Background agent that looks for patterns",cost:r=>featSum(r,["Care Insights"]),costNote:"Judge, investigator and critic runs, plus re-scanning log notes.",steps:[
  ["Triggered by new logs","After a few new inputs, an urgent signal or the hourly sweep","async","Backend"],
  ["Judge","gpt-4o-mini decides whether to act","async","OpenAI"],
  ["Investigate","Claude looks into the recent data","async","Anthropic"],
  ["Critic","gpt-4o-mini reviews the result","async","OpenAI"],
  ["Run limits","Per-run ceiling and daily cap","local","Backend"]]},
 {id:"login",t:"Sign-in",sub:"Sign-up, sign-in and recovery",cost:r=>featSum(r,["Login"]),costNote:"Projected for the planned setup: free below 10,000 monthly users, so only emails cost anything.",steps:[
  ["Sign up / sign in","Being connected in the app","planned","Cognito"],
  ["Verification & recovery emails","Sent on sign-up and recovery","planned","Email service"],
  ["Check sign-in on each request","Done locally with cached keys; no per-request charge","always","Backend"],
  ["Create the account","Rows in the database","always","Shared infrastructure"]]},
 {id:"memory",more:true,t:"Memory & recall",sub:"Remembering past chats",cost:r=>featSum(r,["Memory"]),costNote:"Chat summaries and recall. Already included in the Chat figure.",overlap:true,steps:[
  ["Summaries","Chat summaries (see Chat)","async","Anthropic"],
  ["Store vectors","Kept in the database","async","Voyage · Database"],
  ["Recall","A query embedding and about 3 Claude calls per recall turn","cond","Voyage · Anthropic"]]},
 {id:"reports",more:true,t:"Weekly reports",sub:"Scheduled summaries",cost:null,costNote:"No AI call of its own today; content comes from Care Insights.",steps:[
  ["Hourly sweeps","Scheduled database work","async","Shared infrastructure"],
  ["Report content","Comes from Care Insights","cond","See Care Insights"]]},
 {id:"jobs",more:true,t:"Background jobs",sub:"Things that run with no one using the app",cost:null,costNote:"Part of shared infrastructure: they're why the backend stays always on.",steps:[
  ["Housekeeping","Every minute, database only","async","Shared infrastructure"],
  ["Insight and report sweeps","Hourly","async","Backend"],
  ["Keeps the backend always on","The backend can't scale to zero","always","Shared infrastructure"]]}
];
const TY={always:"Every time",cond:"Sometimes",async:"In background",planned:"Planned",local:"No extra cost"};
const stepCost=s=>s[4]?s[4]:s[2]==="local"?["none","No extra cost"]:s[2]==="planned"?["plan","Planned"]:/Shared infrastructure|Backend$|RAG host|^See /.test(s[3])?["shared","Shared / counted elsewhere"]:["use","Usage cost"];
// Inventory: cat, name, desc, provider, status, forecast, cost keys
const INV = [
 ["Compute & hosting","Backend container (ECS Fargate)","Runs the backend 24/7. Cost depends on size and uptime.","AWS","confirmed","inc",["fargate"]],
 ["Compute & hosting","Extra backend tasks","A second task during deploys or busy periods. Included only if you raise “Backend tasks” in the Simulator.","AWS","built","excl"],
 ["Compute & hosting","Always-on background jobs","Why the backend can't sleep. Drives uptime, not a separate bill.","Inside our services","built","none"],
 ["Compute & hosting","RAG host (EC2) and disk","One small server running the RAG service.","AWS","unverified","inc",["ec2"]],
 ["Networking & HTTPS","Load balancer","Public HTTPS entry. Long chat streams add to its usage.","AWS","confirmed","inc",["alb"]],
 ["Networking & HTTPS","HTTPS certificate","Managed certificate; free.","AWS","confirmed","none"],
 ["Networking & HTTPS","Public IP addresses","Billed per address-hour.","AWS","confirmed","inc",["ipv4"]],
 ["Networking & HTTPS","Data transfer out","First 100 GB a month free.","AWS","unverified","inc",["xfer"]],
 ["Database & storage","Database instance (RDS)","The main database server.","AWS","unverified","inc",["rds"]],
 ["Database & storage","Database storage","Billed by allocated size; auto-grows as data accumulates.","AWS","unverified","inc",["rdsSt"]],
 ["Database & storage","Database backups","7-day backups; free up to the allocated size.","AWS","unverified","inc",["rdsBk"]],
 ["Database & storage","S3 bucket (RAG bundle)","Stores the search-index bundle.","AWS","unverified","inc",["s3"]],
 ["Database & storage","Container images (ECR)","Old versions add storage.","AWS","confirmed","inc",["ecr"]],
 ["Identity","Sign-in (Cognito) and emails","Free below 10,000 monthly active users; emails per new user.","AWS","unverified","inc",["cognito","ses"]],
 ["Identity","Secrets & configuration","Managed storage for keys and settings.","AWS","built","inc",["secret"]],
 ["AI models","Claude Haiku 4.5","Routing, log extraction, titles, summaries, investigator.","Anthropic","built","inc","Anthropic"],
 ["AI models","Claude Sonnet 5","Only used by a route that is off in the pilot.","Anthropic","optional","excl"],
 ["AI models","OpenAI gpt-4o-mini","Chat replies, Care Insights judge and critic, RAG answers, Groq fallback.","OpenAI","built","inc","OpenAI"],
 ["AI models","Groq (RAG analysis)","Safety screen, classify/rewrite and HyDE: about 3 calls per question.","Groq","built","inc","Groq"],
 ["AI models","Retries & failover","Groq→OpenAI failover is modeled; other retries are not.","Several","built","inc",["ragFail"]],
 ["Search & embeddings","Voyage embeddings","RAG questions, chat summaries and log memory.","Voyage AI","built","inc",["ragEmb","sumEmb","logEmb"]],
 ["Search & embeddings","Voyage re-ranking","Re-scores RAG search results.","Voyage AI","built","inc",["ragRr"]],
 ["Search & embeddings","Local search (vector + keyword)","Runs inside our own services; no subscription.","Inside our services","built","none"],
 ["Privacy","Comprehend Medical (DetectPHI)","Finds health identifiers before text goes to AI providers. Per 100-character unit.","AWS","built","inc",DSK],
 ["Monitoring & cost control","Logs & alarm (CloudWatch)","Application logs and a deployment health alarm.","AWS","built","inc",["cw"]],
 ["Monitoring & cost control","Budgets & cost checks","Budget email alerts; cost queries. Expected negligible.","AWS","built","excl"],
 ["Monitoring & cost control","In-app usage meter","Records model spend per user. Warns; doesn't block.","Inside our services","built","none"],
 ["Distribution & development","Apple Developer Program","Needed for TestFlight. $99 a year.","Apple","planned","inc",["apple"]],
 ["Distribution & development","Apple on-device speech","No metered provider.","Apple","built","none"],
 ["Distribution & development","CI (GitHub Actions)","Automated tests; expected within free allowances.","GitHub","built","excl"],
 ["Distribution & development","Evaluation runs","Each run makes real AI calls. Per-run cost under One-time costs.","Several","optional","excl"],
 ["Distribution & development","Development & demo AI usage","Local and demo environments use the same AI providers.","Several","optional","excl"],
 ["Distribution & development","Internal test clients","Use the same backend; their chats cost like app chats.","Inside our services","optional","none"],
 ["Content updates (offline)","PDF parsing and re-embedding","Only when the ALS guide collection is rebuilt.","Unstructured · Voyage AI","optional","excl"]
];
FUTURE.forEach(f=>INV.push(["Future features",f.t,f.d+" Possible cost: "+f.cost,"To be decided","planned","excl"]));

let getRun=()=>null, invFilter="all", flowSel="chat";
const open=new Set();
const byId=Object.fromEntries(NODES.map(n=>[n.id,n]));
function costOf(keys,r){if(!keys||!r)return 0;if(typeof keys==="string")return Object.values(r.c).filter(x=>x.prov===keys).reduce((s,x)=>s+x.val,0);return keys.reduce((s,k)=>s+(r.c[k]?r.c[k].val:0),0);}
const pill=st=>`<span class="spill s-${st}" title="${STATUS[st].desc}"><i></i>${STATUS[st].label}</span>`;
function chip(fc,v){
  if(fc==="inc")return `<span class="cchip c-inc">${v<0.01?(v>0?"&lt;$0.01":"$0"):money(v)}<small>/mo</small></span>`;
  return `<span class="cchip c-${fc}">${FC[fc].label}</span>`;
}
function scenLabel(){return (typeof currentPreset!=="undefined"&&currentPreset?PRESETS[currentPreset].t:"Custom settings")+` · ${["Low","Base","High"][BAND]} case · month 1`;}

/* ---------- system map ---------- */
function compHTML(n,r){
  const v=costOf(n.cost,r), on=open.has(n.id);
  const conns=[...new Set(EDGES.filter(e=>e.includes(n.id)).map(e=>e[0]===n.id?e[1]:e[0]))].map(id=>byId[id].l).join(", ");
  const costLine=n.fc==="inc"
    ?`<b>${money(v)} a month</b> at the current settings. <span class="small">Included in the forecast.</span>`
    :`<b>${FC[n.fc].label}.</b> <span class="small">${FC[n.fc].desc}</span>`;
  return `<div class="comp-wrap${on?" open":""}" data-id="${n.id}">
   <button type="button" class="comp" aria-expanded="${on}" data-comp="${n.id}">
    <span class="comp-main"><b>${n.l}</b><span class="comp-sub">${n.s}</span>${pill(n.st)}</span>
    <span class="comp-side">${chip(n.fc,v)}</span><span class="chev" aria-hidden="true">›</span>
   </button>
   <div class="comp-detail"${on?"":" hidden"}>
    <p>${n.d} ${n.role}</p>
    <dl>
     <dt>Projected cost</dt><dd>${costLine}</dd>
     <dt>Why this amount</dt><dd>${n.a(V,r)}</dd>
     <dt>Status</dt><dd>${pill(n.st)} ${STATUS[n.st].desc}</dd>
     <dt>Used by</dt><dd>${n.uses.map(f=>`<span class="tag">${f}</span>`).join(" ")}</dd>
     ${conns?`<dt>Connects to</dt><dd class="small">${conns}</dd>`:""}
    </dl>
   </div></div>`;
}
function groupHTML(g,r){
  const ns=NODES.filter(n=>n.g===g), tot=ns.filter(n=>n.fc==="inc").reduce((s,n)=>s+costOf(n.cost,r),0);
  return `<div class="sgroup g-${g}"><div class="sg-head"><div><h3>${GROUPS[g].t}</h3><p>${GROUPS[g].d}</p></div><span class="sg-tot">${tot?money(tot)+"<small>/mo</small>":"—"}</span></div>
   ${ns.map(n=>compHTML(n,r)).join("")}</div>`;
}
function renderSystem(){
  const R=getRun(), r=R&&R[0];
  $("sys-scen").textContent=scenLabel();
  $("sys-flow").innerHTML=groupHTML("app",r)+`<div class="sarrow" aria-hidden="true"></div>`+groupHTML("infra",r)+`<div class="sarrow" aria-hidden="true"></div>`+groupHTML("core",r)+`<div class="sarrow" aria-hidden="true"></div>`+
    `<div class="sstack">${groupHTML("ai",r)}${groupHTML("data",r)}</div>`;
  const tools=NODES.filter(n=>n.g==="tools");
  $("sys-tools-body").innerHTML=`<p class="expl">${GROUPS.tools.d}. Only the Apple Developer fee is in the forecast.</p>`+tools.map(n=>compHTML(n,r)).join("");
  $("sys-legend").innerHTML=`<div class="leg-grid"><div><b>Status</b> (what's built)<ul>${Object.entries(STATUS).map(([k,s])=>`<li>${pill(k)} ${s.desc}</li>`).join("")}</ul></div>
   <div><b>Cost</b> (what the forecast assumes)<ul>${Object.entries(FC).map(([k,s])=>`<li>${chip(k,k==="inc"?12.5:0)} ${s.desc}</li>`).join("")}</ul></div></div>`;
}
function toggleComp(id){open.has(id)?open.delete(id):open.add(id);
  document.querySelectorAll(`.comp-wrap[data-id="${id}"]`).forEach(w=>{const on=open.has(id);w.classList.toggle("open",on);w.querySelector(".comp").setAttribute("aria-expanded",on);w.querySelector(".comp-detail").hidden=!on;});}
function gotoComp(id){
  showTab("map");if(byId[id].g==="tools")$("sys-tools").open=true;
  if(!open.has(id))toggleComp(id);
  const w=document.querySelector(`.comp-wrap[data-id="${id}"]`);if(w){w.scrollIntoView({behavior:"smooth",block:"center"});w.classList.add("flash");setTimeout(()=>w.classList.remove("flash"),1200);}
}

/* ---------- feature flows ---------- */
function renderFlows(){
  const R=getRun(), r=R&&R[0];
  $("flow-pick").innerHTML=FLOWS.map(f=>`<button type="button" class="fpick${f.more?" more":""}" data-flow="${f.id}" aria-pressed="${f.id===flowSel}">${f.t}</button>`).join("");
  const f=FLOWS.find(x=>x.id===flowSel), c=f.cost&&r?f.cost(r):null;
  $("flow-body").innerHTML=`<div class="flow-head"><div><h3>${f.t}</h3><p>${f.sub}</p></div>
    <div class="flow-cost${f.overlap?" overlap":""}"><span class="small">${f.overlap?"Share of other costs":"Projected cost now"}</span><b>${c===null?"—":money(c)+"<small>/mo</small>"}</b></div></div>
   <p class="small flow-note">${f.costNote} <span class="muted">(${scenLabel()})</span></p>
   <ol class="flow">${f.steps.map(s=>{const [k,l]=stepCost(s);return `<li class="t-${s[2]}"><div class="fs-top"><b>${s[0]}</b><span class="ctag ct-${k}">${l}</span></div><div class="fs-desc">${s[1]}</div><div class="fs-meta"><span class="svc">${s[3]}</span><span class="when">${TY[s[2]]}</span></div></li>`;}).join("")}</ol>
   <p class="small">Shared infrastructure (servers, database, load balancer) runs whether or not a feature is used, so it isn't split into feature costs. See the <a href="#explorer">cost breakdown</a>.</p>`;
}

/* ---------- inventory ---------- */
function renderInv(){
  const R=getRun(), r=R&&R[0];
  const q=($("q").value||"").toLowerCase().trim();
  const match=x=>(invFilter==="all"||(invFilter==="planned"?x[4]==="planned":x[5]===invFilter&&!(invFilter==="excl"&&x[0]==="Future features")))&&(!q||x.slice(0,4).join(" ").toLowerCase().includes(q));
  const counts={all:INV.length,inc:INV.filter(x=>x[5]==="inc").length,none:INV.filter(x=>x[5]==="none").length,excl:INV.filter(x=>x[5]==="excl"&&x[0]!=="Future features").length,planned:INV.filter(x=>x[4]==="planned").length};
  $("inv-filters").innerHTML=[["all","All"],["inc","In forecast"],["none","No direct cost"],["excl","Not in forecast"],["planned","Planned"]].map(([k,l])=>`<button type="button" class="fpick" data-inv="${k}" aria-pressed="${k===invFilter}">${l} <span class="cnt">${counts[k]}</span></button>`).join("");
  const cats=[...new Set(INV.map(x=>x[0]))], rows=INV.filter(match);
  $("count").textContent=`${rows.length} of ${INV.length} items`;
  $("invList").innerHTML=cats.map(cat=>{const list=rows.filter(x=>x[0]===cat);if(!list.length)return "";
    const all=INV.filter(x=>x[0]===cat), tot=all.filter(x=>x[5]==="inc").reduce((s,x)=>s+costOf(x[6],r),0);
    return `<details class="invcat"${q||invFilter!=="all"?" open":""}><summary><span class="ic-t">${cat}</span><span class="ic-m">${list.length} item${list.length>1?"s":""} · ${all.filter(x=>x[5]==="inc").length} in forecast</span><span class="ic-v">${tot?money(tot)+"<small>/mo</small>":"—"}</span></summary>
     <ul>${list.map(x=>`<li><div class="ii-top"><b>${x[1]}</b>${chip(x[5],costOf(x[6],r))}</div><p>${x[2]}</p><div class="ii-meta"><span class="tag">${x[3]}</span>${pill(x[4])}</div></li>`).join("")}</ul></details>`;}).join("")||`<p class="panel">No items match.</p>`;
}

/* ---------- future features ---------- */
function renderFuture(){
  $("future-body").innerHTML=Object.entries(TIERS).map(([k,[t,d]])=>`<h3 class="tier-h">${t} <span class="small">· ${d}</span></h3><div class="future-grid">`+
   FUTURE.filter(f=>f.tier===k).map(f=>`<div class="fcard"><h4>${f.t}</h4><p>${f.d}</p><p><b>Possible cost:</b> ${f.cost}</p><div class="deps"><span class="small">Depends on:</span> ${f.dep.map(d=>`<button type="button" class="tag tag-btn" data-goto="${d}">${byId[d].l}</button>`).join(" ")}</div></div>`).join("")+`</div>`).join("");
}

function showTab(v){
  document.querySelectorAll("#map-tabs button").forEach(x=>x.setAttribute("aria-selected",x.dataset.view===v));
  document.querySelectorAll(".mview").forEach(s=>s.classList.toggle("active",s.id==="mview-"+v));
}
function refresh(){renderSystem();renderFlows();renderInv();}
function initMap(runFn){
  getRun=runFn;renderFuture();
  const page=$("explorer-map");
  page.addEventListener("click",e=>{
    const c=e.target.closest("[data-comp]");if(c){toggleComp(c.dataset.comp);return;}
    const g=e.target.closest("[data-goto]");if(g){gotoComp(g.dataset.goto);return;}
    const f=e.target.closest("[data-flow]");if(f){flowSel=f.dataset.flow;renderFlows();return;}
    const i=e.target.closest("[data-inv]");if(i){invFilter=i.dataset.inv;renderInv();return;}
    const t=e.target.closest("#map-tabs button");if(t)showTab(t.dataset.view);
  });
  $("q").addEventListener("input",renderInv);
}
return {initMap,refresh,STATUS,gotoComp,showTab,byId};
})();
