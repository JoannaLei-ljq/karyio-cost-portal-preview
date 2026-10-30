/* Reference content: searchable service catalog, cost-driver explanations, feature coverage and
   forecast provenance. Costs are always read from the model's line items (month()); this file holds
   descriptions and links only, never a second copy of a formula. */
const KRef=(()=>{
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const lineSum=(r,keys)=>keys.reduce((s,k)=>s+(r.c[k]?r.c[k].val:0),0);
const DPHI=["dDecider","dExec","dPair","dTitle","dLogSave","dLogDraft","dEvidence"];
const PRIVACY_NOTE="Turning de-identification off is a privacy decision, not a cost option. Every opportunity listed keeps the same protection.";

/* ---------- Service & feature catalog (search) ----------
   prices: PR ids · lines: model line keys · as: AS ids · inp: Simulator inputs · node: map component */
const CAT=[
 {id:"cognito",n:"Amazon Cognito",prov:"AWS",p:"Sign-up, sign-in and password recovery for app accounts",feats:["Login"],kw:"login log in sign in signin sign-up signup auth authentication account password mfa user pool identity",prices:["cognito"],lines:["cognito"],inp:["users","growth"],node:"cognito"},
 {id:"ses",n:"Amazon SES (verification & recovery email)",prov:"AWS",p:"Emails with verification codes and password-reset codes",feats:["Login"],kw:"login sign in email verification recovery reset password code invitation",prices:["ses"],lines:["ses"],inp:["users","growth"],node:"cognito",
  note:"The deployment scripts currently use Cognito's built-in email, which is free but capped per day. AWS says that cap is below typical production volume. The model prices the recommended SES setup (2 emails per new user)."},
 {id:"comprehend",n:"Amazon Comprehend Medical · DetectPHI",prov:"AWS",p:"Finds and masks personal health information before text reaches AI providers or long-term memory",feats:["Chat","Memory","Care logs","Care Insights"],kw:"privacy phi pii de-identification deidentification deid redact mask hipaa detectphi scan comprehend medical voice",prices:["dphi","dphi2","dphi3"],lines:DPHI,as:["msgChars","pairChars","ragPairChars","logChars","structChars","typeless","followUps","evRenders"],inp:["comprehendOn","deidOnce"],node:"comprehend"},
 {id:"haiku",n:"Claude Haiku 4.5 (Anthropic)",prov:"Anthropic",p:"Routes each message, writes memory summaries, titles, recall, log extraction and the Care Insights investigator",feats:["Chat","Memory","Care logs","Care Insights"],kw:"ai llm model claude anthropic haiku chat voice route routing router summary memory title recall log extraction insights investigator",prices:["haikuIn","haikuOut"],lines:["route","summary","title","recall","logEx","logSum","insI"],as:["routeIn","routeOut","sumIn","sumOut","titleIn","titleOut","recallIn","recallOut","exIn","exOut","lsIn","lsOut","iIn","iOut"],node:"anthropic"},
 {id:"sonnet",n:"Claude Sonnet 5 (loop route)",prov:"Anthropic",p:"Multi-step reasoning route. Off in the pilot configuration, so not in the forecast",feats:["Chat"],kw:"ai llm claude sonnet loop chat agent",prices:["sonIn","sonOut"],lines:[],node:"anthropic"},
 {id:"mini",n:"OpenAI gpt-4o-mini",prov:"OpenAI",p:"Writes ordinary and support replies and RAG answers; Care Insights judge and critic; RAG failover",feats:["Chat","RAG","Care Insights"],kw:"ai llm openai gpt 4o mini chat voice reply answer rag generation medical insights judge critic failover",prices:["miniIn","miniOut"],lines:["answer","ragGen","ragFail","insJ","insC"],as:["answerIn","answerOut","genIn","genOut","groqFail","jIn","jOut","cIn","cOut"],node:"openai"},
 {id:"groq",n:"Groq · gpt-oss-20b",prov:"Groq",p:"RAG safety screen, question analysis and HyDE search expansion",feats:["RAG"],kw:"ai llm rag medical groq gpt-oss safety emergency screen analysis classify rewrite hyde",prices:["groqIn","groqOut"],lines:["ragGroq"],as:["emIn","emOut","anIn","anOut","hyIn","hyOut","groqFail"],inp:["groqFree"],node:"groq"},
 {id:"voyE",n:"Voyage AI · voyage-3-large embeddings",prov:"Voyage AI",p:"Turns questions, summaries and logs into vectors for search and memory",feats:["RAG","Memory","Care logs"],kw:"ai rag memory embedding embeddings vector search voyage",prices:["voyE"],lines:["sumEmb","ragEmb","logEmb"],as:["sumEmb","ragEmb","logEmb"],node:"voyage"},
 {id:"voyR",n:"Voyage AI · rerank-2.5-lite",prov:"Voyage AI",p:"Re-orders the 30 best guide passages before the RAG answer is written",feats:["RAG"],kw:"ai rag rerank reranking search voyage medical",prices:["voyR"],lines:["ragRr"],as:["rrDocs","chunkTok"],node:"voyage"},
 {id:"fargate",n:"Backend compute · ECS Fargate",prov:"AWS",p:"Runs the Karyio backend API around the clock",feats:["Shared"],kw:"backend server compute hosting infrastructure api container ecs fargate cpu memory task",prices:["fgVcpu","fgGb"],lines:["fargate"],inp:["tasks","vcpu","mem"],node:"backend"},
 {id:"alb",n:"Application Load Balancer",prov:"AWS",p:"The HTTPS entry point the app connects to",feats:["Shared"],kw:"networking https entry load balancer alb infrastructure hosting",prices:["albH","albLcu"],lines:["alb"],as:["lcu"],node:"alb"},
 {id:"ipv4",n:"Public IPv4 addresses",prov:"AWS",p:"Public addresses for the load balancer, backend and RAG host",feats:["Shared"],kw:"networking ip ipv4 address infrastructure hosting",prices:["ipv4"],lines:["ipv4"],inp:["ips"],node:"ipv4"},
 {id:"rds",n:"Database · RDS PostgreSQL",prov:"AWS",p:"Stores accounts, chats, care logs and memory vectors (pgvector), with 7-day backups",feats:["Shared"],kw:"database db postgres postgresql rds storage backup backups pgvector data memory retention",prices:["rdsH","rdsGp3","rdsBk"],lines:["rds","rdsSt","rdsBk"],as:["kbTurn","kbMem","kbLog","startGb","bkFactor"],inp:["rdsAlloc","rdsMax","retain"],node:"rds"},
 {id:"ec2",n:"RAG host · EC2 + disk",prov:"AWS",p:"A dedicated server that runs the medical-guide search service (fixed cost)",feats:["RAG"],kw:"rag hosting host server medical guide knowledge ec2 ebs fixed",prices:["ec2","ebs"],lines:["ec2"],inp:["ragHost"],node:"rag"},
 {id:"s3",n:"S3 · RAG content bundle",prov:"AWS",p:"Stores the medical-guide search bundle the RAG host loads",feats:["RAG"],kw:"rag storage bundle s3 object",prices:["s3"],lines:["s3"],node:"s3"},
 {id:"cw",n:"CloudWatch Logs",prov:"AWS",p:"Application and access logs for troubleshooting",feats:["Shared"],kw:"logs logging monitoring cloudwatch observability retention",prices:["cwIn","cwSt"],lines:["cw"],as:["cwKb","cwIdle"],inp:["logRet"],node:"cw"},
 {id:"ecr",n:"ECR · container images",prov:"AWS",p:"Stores the backend and RAG container images used for deploys",feats:["Shared"],kw:"container images registry ecr deploy docker",prices:["ecr"],lines:["ecr"],node:"ecr"},
 {id:"secret",n:"Secrets Manager",prov:"AWS",p:"Keeps provider keys out of the code",feats:["Shared"],kw:"keys credentials secrets security config",prices:["secret"],lines:["secret"],node:"secrets"},
 {id:"xfer",n:"Data transfer out",prov:"AWS",p:"Data sent from AWS to the app, above the 100 GB monthly free allowance",feats:["Shared"],kw:"network bandwidth egress data transfer",prices:["xfer"],lines:["xfer"],as:["xferKb"],node:"alb"},
 {id:"apple",n:"Apple Developer Program",prov:"Apple",p:"Membership required to distribute the app through TestFlight",feats:["Distribution"],kw:"testflight distribution app store ios apple developer",prices:["apple"],lines:["apple"],inp:["apple"],node:"appledev"},
 {id:"speech",n:"On-device speech (Apple)",prov:"Apple",p:"Speech-to-text and read-aloud run on the iPhone. No paid speech API is used",feats:["Voice"],kw:"voice speech stt tts transcription transcribe read aloud microphone dictation",prices:[],lines:[],node:"speech",fixedText:"$0.00 · runs on the device"}
];
/* Feature entries: cost comes from the model's feature attribution, not from the catalog. */
const FEAT=[
 {id:"f-voice",n:"Voice (feature)",p:"Speaking instead of typing. Each spoken message becomes a chat turn with the same AI, privacy and memory steps. Shown as a slice of Chat & RAG, not extra",kw:"voice speech spoken talk",cost:r=>typeof voiceCost==="function"?voiceCost(r):0,link:"#explorer/feature/voice",inp:["voiceMin","tpm","voiceInChat"]},
 {id:"f-chat",n:"Chat & RAG (feature)",p:"Conversation, medical answers from ALS guides, and memory",kw:"chat rag medical answers memory conversation",cost:r=>KRef.featTotal(r,["Chat","RAG","Memory"]),link:"#explorer/feature/chatrag",inp:["chat","ragPct"]},
 {id:"f-logs",n:"Care Logs & Insights (feature)",p:"Recording care with optional AI help, plus background Care Insights",kw:"care logs log insights symptoms medication",cost:r=>KRef.featTotal(r,["Care logs","Care Insights"]),link:"#explorer/feature/logs",inp:["logs"]},
 {id:"f-login",n:"Sign-in & email (feature)",p:"Accounts, verification and recovery emails",kw:"login sign in auth email account",cost:r=>KRef.featTotal(r,["Login"]),link:"#explorer/feature/login",inp:["users"]},
 {id:"f-dist",n:"App distribution (feature)",p:"Apple Developer Program for TestFlight",kw:"testflight distribution apple",cost:r=>KRef.featTotal(r,["Distribution"]),link:"#explorer/feature/dist",inp:["apple"]}
];
const SYN={db:"database",auth:"login",signin:"login","sign-in":"login",phi:"privacy",hipaa:"privacy",email:"email",llm:"ai",tts:"speech",stt:"speech"};
const featTotal=(r,fs)=>Object.values(r.c).filter(x=>fs.includes(x.feat)).reduce((s,x)=>s+x.val,0);

/* ---------- Overview cost drivers ---------- */
const DRV=[
 {id:"comprehend",t:"Comprehend Medical (privacy scans)",lines:DPHI,kind:"usage",node:"comprehend",q:"privacy",
  what:"An AWS service that finds personal health information (names, dates, places, record numbers) in text so it can be masked.",
  why:"Karyio de-identifies text before it reaches AI providers or is stored as long-term memory.",
  feats:"Chat, memory summaries, care logs and Care Insights.",
  grows:"Billed per 100 characters for every scan, with a minimum of one unit per request. One chat turn is scanned at several steps: before routing, again when the reply is written, and once more when the question and full reply are summarized for memory. More messages and longer replies (RAG answers especially) multiply the units.",
  as:["msgChars","pairChars","ragPairChars","logChars","evRenders"],
  opps:r=>[`Reuse de-identified text instead of scanning the same text again (a message within one turn, or an untyped log draft). This is a code change, and the protection is unchanged. The model's what-if shows ${KRef.fmtD(-KRef.deidOnceSaving(r))}/mo at these settings.`,"Avoid re-scanning text that was already de-identified, such as the question part of the memory summary. Not yet quantified.","Above 1M units a month AWS's lower volume tiers apply automatically; the model already includes them."]},
 {id:"fargate",t:"Backend compute (ECS Fargate)",lines:["fargate"],kind:"fixed",node:"backend",q:"backend",
  what:"The always-on container that runs the Karyio backend API.",why:"Every request from the app (chat, logs, sign-in checks) is handled here.",feats:"All features (shared).",
  grows:"Priced per vCPU-hour and GB-hour for every hour the task runs, whether or not anyone uses the app. It grows only in steps, when another task is added or the task gets bigger. Autoscaling can add a second task under heavy load (≈ the same amount again). That isn't in the forecast band.",
  as:[],inp:["tasks","vcpu","mem"],
  opps:()=>["Graviton (ARM) Fargate costs about 20% less per hour at the same size (AWS official prices). It needs an ARM container build. See Deployment Options, option A2.","Right-size after measuring CPU and memory in the pilot; the deployment plan already calls for this. Not quantified until measured."]},
 {id:"alb",t:"Load balancer",lines:["alb"],kind:"fixed",node:"alb",q:"load balancer",
  what:"The HTTPS entry point between the app and the backend.",why:"It provides the secure public address, health checks and long streaming connections for chat replies.",feats:"All features (shared).",
  grows:"A flat hourly charge plus capacity units, which rise slowly with long streaming connections.",as:["lcu"],
  opps:()=>["No evidence-based saving at pilot scale. It comes with the current managed container setup."]},
 {id:"ipv4",t:"Public IPv4 addresses",lines:["ipv4"],kind:"fixed",node:"ipv4",q:"ipv4",
  what:"AWS charges for each public IPv4 address.",why:"The load balancer, backend and RAG host each use public addresses in the current network layout.",feats:"All features (shared).",
  grows:"Flat: addresses × hourly rate.",as:[],inp:["ips"],
  opps:()=>["Fewer addresses would need a network redesign (private subnets usually need a NAT gateway, which costs more). No saving recommended now."]},
 {id:"raghost",t:"RAG host (dedicated server)",lines:["ec2","s3"],kind:"fixed",node:"rag",q:"rag",
  what:"A small dedicated server running the medical-guide search service, plus its content bundle.",why:"Medical answers are grounded in ALS care guides; search runs on this host.",feats:"Chat & RAG only, so it's attributed there directly.",
  grows:"Fixed hourly cost. Per-question RAG costs (Groq, Voyage, OpenAI) are separate usage lines.",as:[],inp:["ragHost"],
  opps:()=>["An ARM instance of the same size (t4g.small) is about $3/mo cheaper (secondary price source)."]},
 {id:"db",t:"Database (RDS PostgreSQL)",lines:["rds","rdsSt","rdsBk"],kind:"fixed",node:"rds",q:"database",
  what:"The managed PostgreSQL database with vector search.",why:"It stores accounts, conversations, care logs and memory.",feats:"All features (shared).",
  grows:"A fixed instance charge plus allocated storage. Storage grows slowly with turns and logs; backups are free up to the allocated size.",as:["kbTurn","kbMem","kbLog"],inp:["rdsAlloc","retain"],
  opps:()=>["The smallest instance class is already in use. Retention limits slow storage growth (Simulator: Data & retention)."]},
 {id:"haiku",t:"Claude Haiku 4.5",lines:["route","summary","title","recall","logEx","logSum","insI"],kind:"usage",node:"anthropic",q:"haiku",
  what:"Anthropic's small, fast model.",why:"It decides how to handle each message and writes memory summaries, titles, recall and log extraction.",feats:"Chat, memory, care logs, Care Insights.",
  grows:"Per token. Every chat or voice turn has a route decision and a summary, so it scales with turns.",as:["routeIn","sumIn"],
  opps:()=>["Token sizes for the route decision were measured in development runs. Prompt trimming could help, but nothing has been tested."]},
 {id:"mini",t:"OpenAI gpt-4o-mini",lines:["answer","ragGen","ragFail","insJ","insC"],kind:"usage",node:"openai",q:"gpt-4o-mini",
  what:"OpenAI's small model.",why:"It writes replies and RAG answers, and acts as the Care Insights judge and critic.",feats:"Chat & RAG, Care Insights.",
  grows:"Per token. RAG answers are the largest part (long, cited answers).",as:["genIn","genOut"],opps:()=>[]},
 {id:"voyage",t:"Voyage AI (embeddings & rerank)",lines:["sumEmb","ragEmb","ragRr","logEmb"],kind:"usage",node:"voyage",q:"voyage",
  what:"Embedding and re-ranking models.",why:"They make search and memory work.",feats:"Chat & RAG, memory, care logs.",grows:"Per token; very small at pilot scale.",as:["rrDocs"],opps:()=>[]},
 {id:"groq",t:"Groq (RAG pre-processing)",lines:["ragGroq"],kind:"usage",node:"groq",q:"groq",
  what:"Fast hosted open model.",why:"Safety screen and question analysis before medical search.",feats:"RAG.",grows:"Per token, per RAG question.",as:["emIn","anIn"],opps:()=>[]},
 {id:"apple",t:"Apple Developer Program",lines:["apple"],kind:"fixed",node:"appledev",q:"testflight",
  what:"Annual membership.",why:"Required to distribute through TestFlight.",feats:"Distribution.",grows:"Fixed: $99 a year, spread monthly.",as:[],opps:()=>[]},
 {id:"other",t:"Other small items",lines:["cw","ecr","secret","xfer","cognito","ses"],kind:"fixed",node:"cw",q:"logs",
  what:"Logs, container images, a secret, data transfer, sign-in and email.",why:"Operational basics.",feats:"Shared, sign-in.",grows:"Mostly flat; logs and email grow slowly with use.",as:["cwKb"],opps:()=>[]}
];
const FIXED_KEYS=["fargate","alb","ipv4","rds","ec2","secret","rdsSt","rdsBk","cw","ecr","s3","xfer","apple"];

/* ---------- Feature coverage (Phase 1 audit, generalized for the public preview) ---------- */
const COV=[
 ["Voice","On-device speech-to-text and read-aloud (Apple frameworks); spoken turns use the normal chat path","Chat & RAG per-turn services","Per-turn AI, privacy scans and memory for spoken turns (a slice of Chat & RAG). Speech itself: $0.00","None found. No paid speech API is used","High for speech ($0.00); usage assumed","Measure voice minutes and turns per minute in the pilot"],
 ["Chat","Route decision on every turn; replies on the ordinary and support routes; titles; recall. The multi-step loop route is off in the pilot","Claude Haiku 4.5, gpt-4o-mini, Comprehend Medical","Route decision, replies, titles, recall, privacy scans before routing and replying","Rare fallback paths (re-scan of history when no route answers)","Medium: prices official, call paths code-checked, ordinary-route tokens dev-measured","Measure tokens on support and recall routes"],
 ["RAG medical answers","Safety screen, question analysis and HyDE, hybrid search, re-rank of 30 passages, cited answer; OpenAI failover; dedicated host","Groq, Voyage AI, gpt-4o-mini, EC2 + S3","Per-question API usage (variable) and the RAG host (fixed), shown separately","A planned privacy update for RAG questions (pending, shown separately). A conflict-check step exists but is switched off","Medium: answer length from synthetic evaluation","Confirm the privacy update once it reaches the shared code; log tokens per stage"],
 ["Memory","Summary of every turn (question + reply), embedding, privacy scan of the pair; recall","Claude Haiku 4.5, Voyage AI, Comprehend Medical","Summaries, embeddings, recall, the largest privacy-scan step","None found","Medium: the summary cost per turn is dev-measured; text lengths assumed","Measure question and reply lengths"],
 ["Care logs","AI-assisted drafting and extraction, note summaries, memory embedding, privacy scans on save, drafting and follow-ups","Claude Haiku 4.5, Voyage AI, Comprehend Medical","Extraction, summaries, embeddings, privacy scans","AI drafting may make a few more small model calls per log than modeled (type classification, follow-up answers, review). Likely cents at pilot scale","Medium–Low: shares and token sizes assumed","Measure tokens per AI-drafted log before changing the formula"],
 ["Care Insights","Background judge → investigator → critic runs, triggered after new inputs per care area; re-reads log notes","gpt-4o-mini, Claude Haiku 4.5, Comprehend Medical","All three model calls and the note re-scans","Runs per log could exceed the base value when one log touches several care areas (covered by the High case). Weekly reports make no AI call","Medium: trigger from configuration; tokens assumed","Count runs per log in the pilot"],
 ["Sign-in & email","Cognito user pool with email verification and recovery","Cognito, SES rate","Cognito (free below 10,000 monthly users), 2 emails per new user","The deployment currently uses Cognito's built-in email: free, but with a daily cap AWS says is below typical production volume. A readiness item, not a cost gap","High (cost); readiness to confirm","Set up SES for Cognito before external testers join"],
 ["App distribution","TestFlight via the Apple Developer Program","Apple","$99 a year, spread monthly","None","High","—"],
 ["Shared infrastructure","Deployment scripts: one always-on backend task (autoscaling up to 2), load balancer, public addresses, small PostgreSQL with backups, logs, image registry","Fargate, ALB, IPv4, RDS, CloudWatch, ECR, Secrets Manager","Everything that runs around the clock, not split between features","A second backend task under load (≈ +$36/mo, outside the band); live settings not yet confirmed","Medium: 25 of 32 prices official; 4 secondary, 1 team-recorded, 3 assumed","Read-only check of live settings; official rates for RDS, EC2, EBS, S3"]
];

/* ---------- Provenance ---------- */
const EVID=[
 ["official","Official price","Read on the provider's own pricing page or price list.",()=>PR.filter(r=>r[4]==="official").length+" prices"],
 ["secondary","Secondary price","The official page didn't show it; a third-party price page was used.",()=>PR.filter(r=>r[4]==="secondary").length+" prices"],
 ["repo","Team-recorded price","Recorded by the team from AWS on 2026-09-15; not re-checked.",()=>PR.filter(r=>r[4]==="repo").length+" price"],
 ["measured","Dev-measured","Observed in development or evaluation runs (token counts, chunk size). Useful for size, not representative of pilot traffic.",()=>AS.filter(r=>r[7]==="measured").length+" assumptions"],
 ["code","Code-derived","Set in code or configuration: how often a step runs, how many candidates are re-ranked, when Care Insights triggers.",()=>AS.filter(r=>r[7]==="code").length+" assumptions + 7 privacy-scan steps"],
 ["synthetic","Synthetic eval","Measured on synthetic test questions, not real patient traffic.",()=>AS.filter(r=>r[7]==="synthetic").length+" assumptions"],
 ["assumed","Assumed usage","A judgment value. All per-person activity is assumed until the pilot produces data.",()=>AS.filter(r=>r[7]==="assumed").length+" assumptions + every Simulator usage input"],
 ["pending","Not yet verified","Known gaps: a planned privacy update for RAG questions, live AWS settings, and prices not yet confirmed on official pages.",()=>"see Pending and missing"]
];

/* ---------- rendering ---------- */
const DATE_OF=s=>s==="repo"?"2026-09-15":D;
function priceRow(id){const r=PR.find(x=>x[0]===id);if(!r)return "";const u=r[5].startsWith("http")?r[5].split(" ")[0]:null;const chg=P[id]!==r[2];
  return `<tr><td>${esc(r[1])}</td><td class="n">${r[4]==="official"?"$"+r[2]:"—"}</td><td class="n">$${P[id]}${chg?' <span class="mod">edited</span>':""}</td><td class="small">${esc(r[3])}</td><td>${badge(r[4])}</td><td class="small">${u?`<a href="${u}" target="_blank" rel="noopener noreferrer">source ↗</a>`:esc(r[5])}<br>${DATE_OF(r[4])}</td></tr>`;}
function asRow(id){const r=AS.find(x=>x[0]===id);if(!r)return "";return `<li>${esc(r[2])}: <b>${num(A[id],2)}</b> ${esc(r[6])} <span class="small">(low ${num(r[3],2)} · high ${num(r[5],2)})</span> ${badge(r[7])}</li>`;}
function inpRow(k){const o=IN[k];if(!o)return "";return `<li>${esc(o.l)}: <b>${o.type==="chk"?(V[k]?"on":"off"):o.fmt(V[k])}</b> <span class="small">Simulator input</span></li>`;}
function confOf(e){const ps=(e.prices||[]).map(id=>PR.find(r=>r[0]===id)[4]),order=["official","secondary","repo","assumed"];
  const p=ps.length?order[Math.max(...ps.map(s=>order.indexOf(s)))]:null;
  const us=(e.as||[]).map(id=>AS.find(r=>r[0]===id)[7]);const u=us.includes("assumed")?"assumed":us.includes("synthetic")?"synthetic":us.includes("measured")?"measured":us.length?"code":null;
  return `${p?`Price ${badge(p)}`:"No price"} ${u?` · Usage ${badge(u)}`:(e.inp?` · Usage ${badge("assumed")}`:"")}`;}
function matches(e,q){const hay=(e.n+" "+e.p+" "+(e.kw||"")+" "+(e.feats||[]).join(" ")+" "+(e.prov||"")).toLowerCase();
  // word-start match, so "rag" finds RAG but not "storage"
  const has=t=>new RegExp("(^|[^a-z0-9])"+t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).test(hay);
  return q.split(/\s+/).filter(Boolean).every(t=>has(t)||(SYN[t]&&SYN[t].split(" ").some(has)));}
function resultCard(e,r12,r1){
  const c1=e.cost?e.cost(r1):lineSum(r1,e.lines),c12=e.cost?e.cost(r12):lineSum(r12,e.lines);
  const cost=e.fixedText?e.fixedText:(e.lines&&!e.lines.length&&!e.cost)?"Not in the forecast":`<b>${money(c1)}</b>/mo month 1 · ${money(c12)}/mo month 12`;
  const link=e.link||(e.node?`#explorer/map/${e.node}`:null);
  return `<article class="rcard"><div class="rc-top"><div><h3>${esc(e.n)}</h3><p>${esc(e.p)}</p></div><div class="rc-cost">${cost}<div class="small">${KScen()}</div></div></div>
   ${e.note?`<p class="note-box">${esc(e.note)}</p>`:""}
   ${(e.prices||[]).length?`<div class="tbl-wrap"><table class="rc-t"><tr><th>Price item</th><th class="n">Official standard</th><th class="n">Model price</th><th>Unit / billing basis</th><th>Source status</th><th>Source · checked</th></tr>${e.prices.map(priceRow).join("")}</table></div>`:""}
   ${(e.as||[]).length||(e.inp||[]).length?`<details class="sub"><summary>Usage assumptions behind this estimate</summary><ul class="tight">${(e.inp||[]).map(inpRow).join("")}${(e.as||[]).map(asRow).join("")}</ul></details>`:""}
   <div class="rc-foot"><span class="small">Confidence: ${e.prices||e.as?confOf(e):badge("assumed")}</span>${link?`<a class="btn btn-sm" href="${link}">Open in Cost Explorer</a>`:""}</div></article>`;
}
let lastQ=null;
function renderSearch(q){
  const inp=$("rs-q");if(q!=null&&inp.value!==q)inp.value=q;q=(inp.value||"").trim().toLowerCase();
  const chips=["login","voice","RAG","database","privacy","Cognito","hosting","email"];
  $("rs-chips").innerHTML=chips.map(c=>`<button type="button" class="fpick" data-rs="${c}" aria-pressed="${q===c.toLowerCase()}">${c}</button>`).join("");
  if(!q){$("rs-results").innerHTML=`<p class="small">Results show the official price where one was verified, the model's current price, the usage assumptions behind it, and the estimated cost under the active Simulator scenario. Prices were checked on the dates shown; this page does not re-check them live.</p>`;lastQ=q;return;}
  const R=run(V),r1=R[0],r12=R[11];
  const hits=FEAT.filter(e=>matches(e,q)).concat(CAT.filter(e=>matches(e,q)));
  const asHits=AS.filter(r=>(r[1]+" "+r[2]+" "+r[8]).toLowerCase().includes(q)).slice(0,8);
  $("rs-results").innerHTML=(hits.length?`<p class="small">${hits.length} result${hits.length>1?"s":""} for “${esc(q)}”</p>`+hits.map(e=>resultCard(e,r12,r1)).join(""):`<p class="panel">No service or feature matches “${esc(q)}”. Try login, voice, RAG, database, privacy or a provider name.</p>`)+
    (asHits.length?`<details class="sub"><summary>${asHits.length} matching usage assumption${asHits.length>1?"s":""}</summary><ul class="tight">${asHits.map(r=>asRow(r[0])).join("")}</ul><p class="small"><a href="#reference/usage">Edit in Usage assumptions →</a></p></details>`:"");
  lastQ=q;
}
function renderMethod(){
  const N=PR.length;
  $("r-method-body").innerHTML=`<p class="method-stmt"><b>Forecasts are based on modeled usage for a planned operating environment, not historical development spending or production measurements.</b></p>
   <ul class="tight">
    <li><b>Prices</b> are unit rates from providers: ${PR.filter(r=>r[4]==="official").length} of ${N} are official.</li>
    <li><b>Usage</b> is modeled per person (messages, voice minutes, care logs) and multiplied through code-derived call paths.</li>
    <li><b>Development testing isn't a usage sample.</b> Simulator testing has been limited, and medical search hasn't run continuously in a complete deployed environment. Existing AWS bills and spending alerts reflect development work, not pilot users, so they aren't used to project pilot traffic.</li>
    <li><b>No estimated-vs-actual comparison</b> is shown, because reliable pilot billing data doesn't exist yet. The calibration plan below explains how real usage will replace assumptions.</li></ul>
   <h3>Evidence types</h3><div class="tbl-wrap"><table><tr><th>Type</th><th>Meaning</th><th>In this model</th></tr>${EVID.map(([b,l,d,c])=>`<tr><td>${badge(b)}</td><td class="small">${d}</td><td class="small">${c()}</td></tr>`).join("")}</table></div>
   <p class="small">Every estimate links to its sources: search above, or open a cost driver on the Overview.</p>`;
}
function renderCoverage(){
  $("r-coverage-body").innerHTML=`<table class="cov"><tr><th>Feature</th><th>Implementation evidence</th><th>Modeled services</th><th>Included costs</th><th>Potential missing costs</th><th>Confidence</th><th>Follow-up</th></tr>`+
   COV.map(r=>`<tr><td><b>${r[0]}</b></td>${r.slice(1).map((x,i)=>`<td class="small${i===3?" warnc":""}">${x}</td>`).join("")}</tr>`).join("")+`</table>
   <p class="small">Confirmed modeling defects that change the forecast: none. Items in “Potential missing costs” are small or pending; the formulas change only after verification and approval.</p>`;
}
let KScen=()=>"";
function init(scenFn){KScen=scenFn;
  $("rs-q").addEventListener("input",()=>{renderSearch();const q=$("rs-q").value.trim();history.replaceState(null,"","#reference"+(q?"/search/"+encodeURIComponent(q):""));});
  $("rs-chips").addEventListener("click",e=>{const b=e.target.closest("[data-rs]");if(b){$("rs-q").value=b.dataset.rs;renderSearch();history.replaceState(null,"","#reference/search/"+encodeURIComponent(b.dataset.rs));}});
}
return {init,renderSearch,renderMethod,renderCoverage,DRV,FIXED_KEYS,PRIVACY_NOTE,featTotal,lineSum,
  fmtD:d=>moneyD(d),deidOnceSaving:r=>0,COV};
})();
