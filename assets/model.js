/* Karyio cost model — the single calculation used by every page of the portal.
   Model dated 2026-10-28. The formulas in month() match the internal simulator;
   only notes and sources were generalized for the public preview. */

/* ===================== PRICES ===================== */
const D="2026-10-28";
const PR = [
 // id, label, value, unit, status, source
 ["fgVcpu","Fargate vCPU (x86, us-east-1)",0.0404784,"$/vCPU-hour","official","https://aws.amazon.com/fargate/pricing/"],
 ["fgGb","Fargate memory",0.004446,"$/GB-hour","official","https://aws.amazon.com/fargate/pricing/"],
 ["albH","Application Load Balancer",0.0225,"$/hour","official","https://aws.amazon.com/elasticloadbalancing/pricing/"],
 ["albLcu","ALB capacity unit (LCU)",0.008,"$/LCU-hour","official","https://aws.amazon.com/elasticloadbalancing/pricing/"],
 ["ipv4","Public IPv4 address",0.005,"$/address-hour","official","https://aws.amazon.com/vpc/pricing/"],
 ["rdsH","RDS PostgreSQL db.t4g.micro (single-AZ)",0.016,"$/hour","secondary","https://www.bytebase.com/dbcost/rds/instance/db.t4g.micro/"],
 ["rdsGp3","RDS gp3 storage",0.115,"$/GB-month","repo","Recorded by the team from AWS on 2026-09-15; not re-checked"],
 ["rdsBk","RDS backup storage beyond allocated size",0.095,"$/GB-month","assumed","https://aws.amazon.com/rds/postgresql/pricing/ (rate not shown)"],
 ["ec2","EC2 t3.small (RAG host)",0.0208,"$/hour","secondary","https://calculator.holori.com/aws/ec2/t3.small/us-east-1"],
 ["ebs","EBS gp3 (RAG disk)",0.08,"$/GB-month","secondary","https://aws.amazon.com/ebs/pricing/ (example; region not stated)"],
 ["ecr","ECR image storage",0.10,"$/GB-month","official","https://aws.amazon.com/ecr/pricing/"],
 ["s3","S3 Standard (RAG bundle)",0.023,"$/GB-month","assumed","https://aws.amazon.com/s3/pricing/ (rate not shown)"],
 ["secret","Secrets Manager",0.40,"$/secret-month","official","https://aws.amazon.com/secrets-manager/pricing/"],
 ["cwIn","CloudWatch Logs ingestion (after 5 GB free)",0.50,"$/GB","official","https://aws.amazon.com/cloudwatch/pricing/"],
 ["cwSt","CloudWatch Logs storage",0.03,"$/GB-month","secondary","https://aws.amazon.com/cloudwatch/pricing/ (example rate)"],
 ["cognito","Cognito Essentials above 10,000 MAU",0.015,"$/MAU","official","https://aws.amazon.com/cognito/pricing/"],
 ["ses","SES email (verification/recovery)",0.10,"$/1,000 emails","official","https://aws.amazon.com/ses/pricing/"],
 ["xfer","Data transfer out above 100 GB free",0.09,"$/GB","assumed","https://aws.amazon.com/s3/pricing/ (100 GB free confirmed; rate not shown)"],
 ["dphi","Comprehend Medical DetectPHI, first 1M units a month",0.0014,"$/unit (1 unit = 100 chars, minimum 1 per request)","official","https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/comprehendmedical/current/us-east-1/index.json (price list published 2026-09-11; unit and minimum: aws.amazon.com/comprehend/medical/pricing/)"],
 ["dphi2","DetectPHI, units 1M–2M a month",0.0005,"$/unit","official","https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/comprehendmedical/current/us-east-1/index.json"],
 ["dphi3","DetectPHI, above 2M units a month",0.00025,"$/unit","official","https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/comprehendmedical/current/us-east-1/index.json"],
 ["haikuIn","Claude Haiku 4.5 input",1.00,"$/M tokens","official","https://platform.claude.com/docs/en/about-claude/pricing"],
 ["haikuOut","Claude Haiku 4.5 output",5.00,"$/M tokens","official","https://platform.claude.com/docs/en/about-claude/pricing"],
 ["sonIn","Claude Sonnet 5 input (loop route, off in pilot)",2.00,"$/M tokens","official","https://platform.claude.com/docs/en/about-claude/pricing"],
 ["sonOut","Claude Sonnet 5 output",10.00,"$/M tokens","official","https://platform.claude.com/docs/en/about-claude/pricing"],
 ["miniIn","OpenAI gpt-4o-mini input",0.15,"$/M tokens","official","https://developers.openai.com/api/docs/pricing"],
 ["miniOut","OpenAI gpt-4o-mini output",0.60,"$/M tokens","official","https://developers.openai.com/api/docs/pricing"],
 ["voyE","Voyage voyage-3-large embeddings",0.18,"$/M tokens","official","https://docs.voyageai.com/docs/pricing"],
 ["voyR","Voyage rerank-2.5-lite",0.02,"$/M tokens","official","https://docs.voyageai.com/docs/pricing"],
 ["groqIn","Groq gpt-oss-20b input",0.075,"$/M tokens","official","https://console.groq.com/docs/models"],
 ["groqOut","Groq gpt-oss-20b output",0.30,"$/M tokens","official","https://console.groq.com/docs/models"],
 ["apple","Apple Developer Program",99,"$/year","official","https://developer.apple.com/programs/"]
];
const P={}; PR.forEach(r=>P[r[0]]=r[2]);
const PG=P; // global prices; month() can be handed a varied copy for sensitivity runs
const P0={...P}; // defaults, for share links and "modified" detection

/* ===================== ASSUMPTIONS (low, base, high) ===================== */
const AS = [
 // id, group, label, low, base, high, unit, basis, note
 ["routeIn","Chat","Route decision input tokens (Haiku)",1500,1924,2600,"tokens","measured","Team eval run, Aug 2026: 1,924 in / 52 out"],
 ["routeOut","Chat","Route decision output tokens",40,52,120,"tokens","measured",""],
 ["answerIn","Chat","Route answer input tokens (gpt-4o-mini)",1000,1458,2500,"tokens","measured","Ordinary route measured; other routes unmeasured"],
 ["answerOut","Chat","Route answer output tokens",40,61,300,"tokens","measured",""],
 ["directive","Chat","Share of turns that skip the route decision",0,0.05,0.15,"share","assumed","Shortcut commands and crisis replies. Log shortcuts still go through the route decision"],
 ["sumShare","Chat","Share of turns that produce a chat summary",0.5,1,1,"share","code","Per-turn summaries, with filtering"],
 ["sumIn","Chat","Chat summary input tokens (Haiku)",600,1000,1800,"tokens","measured","Total cost per turn measured (~1,241 µ$); in/out split assumed"],
 ["sumOut","Chat","Chat summary output tokens",30,48,150,"tokens","assumed",""],
 ["sumEmb","Chat","Summary embedding tokens (Voyage)",50,100,250,"tokens","assumed",""],
 ["sessions","Chat","New chat sessions per active user per day (titles)",0.5,1,2,"per day","assumed","One Haiku title per new session"],
 ["titleIn","Chat","Title input tokens",40,60,150,"tokens","measured","Derived from measured ~113 µ$ per title"],
 ["titleOut","Chat","Title output tokens",5,10,20,"tokens","measured",""],
 ["recallPct","Chat","Share of turns using recall",0,0.02,0.1,"share","assumed",""],
 ["recallCalls","Chat","Haiku calls per recall turn",3,3,3,"calls","measured","Measured: three Haiku calls"],
 ["recallIn","Chat","Recall call input tokens",800,1500,3000,"tokens","assumed",""],
 ["recallOut","Chat","Recall call output tokens",80,150,400,"tokens","assumed",""],
 ["emIn","RAG","Emergency screen input tokens (Groq)",400,600,1000,"tokens","assumed",""],
 ["emOut","RAG","Emergency screen output tokens (incl. reasoning)",30,100,300,"tokens","assumed",""],
 ["anIn","RAG","Analysis (classify/rewrite) input tokens",500,700,1200,"tokens","assumed",""],
 ["anOut","RAG","Analysis output tokens",100,250,600,"tokens","assumed",""],
 ["hyIn","RAG","HyDE input tokens",300,400,700,"tokens","assumed",""],
 ["hyOut","RAG","HyDE output tokens",150,300,600,"tokens","assumed",""],
 ["ragEmb","RAG","Query + HyDE embedding tokens (Voyage)",100,300,500,"tokens","assumed",""],
 ["rrDocs","RAG","Rerank candidates per question",30,30,30,"docs","code","Set in RAG configuration"],
 ["chunkTok","RAG","Average chunk size",180,220,300,"tokens","measured","Content bundle mean 885 chars ≈ 220 tokens"],
 ["genIn","RAG","Answer input tokens (gpt-4o-mini)",2500,3400,5000,"tokens","assumed","8 chunks (~1,760) + prompt + question"],
 ["genOut","RAG","Answer output tokens",250,340,500,"tokens","synthetic","Synthetic eval, not production: answer mean 1,365 chars ≈ 340 tokens, p90 ≈ 2,000 chars ≈ 500 tokens (≈4 chars/token). Output cap 2,600 tokens"],
 ["groqFail","RAG","Share of Groq calls re-run on OpenAI",0,0.1,0.5,"share","assumed","Failover on any Groq error"],
 ["aiPct","Logs","Share of logs entered with AI help",0.1,0.3,0.6,"share","assumed","Description parsing or AI drafts from chat"],
 ["exIn","Logs","AI extraction input tokens (Haiku)",500,800,1500,"tokens","assumed",""],
 ["exOut","Logs","AI extraction output tokens",80,150,300,"tokens","assumed",""],
 ["notesPct","Logs","Share of logs with notes (get a summary)",0.2,0.5,0.8,"share","assumed","Logs without notes skip the summary call"],
 ["lsIn","Logs","Log summary input tokens (Haiku)",300,600,1200,"tokens","assumed",""],
 ["lsOut","Logs","Log summary output tokens",40,80,200,"tokens","assumed",""],
 ["logEmb","Logs","Log memory embedding tokens",80,150,300,"tokens","assumed",""],
 ["runsPerLog","Insights","Care Insights runs per log",0.15,0.33,0.6,"runs","code","Runs after every 3 new inputs (configuration)"],
 ["jIn","Insights","Judge input tokens (gpt-4o-mini)",1000,2000,4000,"tokens","assumed",""],
 ["jOut","Insights","Judge output tokens",75,150,300,"tokens","assumed",""],
 ["iIn","Insights","Investigator input tokens (Haiku)",1500,3000,6000,"tokens","assumed",""],
 ["iOut","Insights","Investigator output tokens",200,400,800,"tokens","assumed",""],
 ["cIn","Insights","Critic input tokens (gpt-4o-mini)",1200,2500,5000,"tokens","assumed",""],
 ["cOut","Insights","Critic output tokens",100,200,400,"tokens","assumed",""],
 ["msgChars","De-identification","User message length (typed or spoken)",80,200,600,"characters","assumed","1 unit = 100 chars, minimum 1 unit per request (official)"],
 ["pairChars","De-identification","Summary pair length, ordinary/support turn (question + reply)",250,500,1200,"characters","assumed","Measured ordinary reply ≈ 61 tokens ≈ 250 chars; support replies are capped at 900–1,200 chars"],
 ["ragPairChars","De-identification","Summary pair length, RAG turn (question + reply)",1100,1550,2200,"characters","synthetic","Synthetic eval, not production: answer mean 1,365 chars + question ≈ 1,550; high uses answer p90 ≈ 2,000 chars. Technical replies are capped at 4,000 chars"],
 ["logChars","De-identification","Log note / description length",150,400,1000,"characters","assumed",""],
 ["structChars","De-identification","Structured log text scanned when a log has no notes",60,150,300,"characters","assumed",""],
 ["typeless","De-identification","AI-drafted logs with no type named (one more scan)",0,0.5,1,"share","assumed",""],
 ["followUps","De-identification","Follow-up replies per AI-drafted log",0,1,3,"replies","assumed","Each follow-up reply is scanned"],
 ["evRenders","De-identification","Care Insights runs that re-read each log's notes",1,1.5,3,"runs","assumed","Log notes are scanned again on every run"],
 ["kbTurn","Storage","Database KB per chat turn (messages, trace, ledger)",5,12,30,"KB","assumed","Incl. indexes; agent-run traces unmeasured"],
 ["kbMem","Storage","Database KB per memory entry (1024-d vector + text)",6,9,14,"KB","code","1024-dimension vector = 4 KB raw"],
 ["kbLog","Storage","Database KB per care log",1.5,3,6,"KB","assumed","Incl. revision history"],
 ["startGb","Storage","Starting database size",0.1,0.2,0.5,"GB","assumed","Local seeded volume was 70.5 MB"],
 ["bkFactor","Storage","Backup size as a multiple of database size (7 days)",1,1.2,1.6,"×","assumed",""],
 ["cwKb","Storage","Log KB per chat turn",2,5,15,"KB","assumed",""],
 ["cwIdle","Storage","Background log volume per month",0.3,1,3,"GB","assumed","Health checks, scheduled jobs"],
 ["xferKb","Storage","Data sent to the app per turn",10,30,80,"KB","assumed","Streaming replies, screens"],
 ["lcu","Infrastructure","Average ALB capacity units",0.2,0.3,1,"LCU","assumed","Rises with long streaming connections"]
];
const AS0=AS.map(r=>[r[3],r[4],r[5]]); // defaults
const A={}; let BAND=1; // 0 low,1 base,2 high
function setBand(b){BAND=b;AS.forEach(r=>A[r[0]]=r[3+b]);}
setBand(1);

/* ===================== INPUTS ===================== */
const IN = {
 users:{g:"Users & growth",l:"Active users (month 1)",min:1,max:2000,step:1,v:10,fmt:v=>v},
 growth:{g:"Users & growth",l:"User growth per month",min:0,max:50,step:1,v:0,fmt:v=>v+"%"},
 daily:{g:"Users & growth",l:"Users active on a given day",min:5,max:100,step:5,v:60,fmt:v=>v+"%"},
 chat:{g:"Daily activity (per active user)",l:"Typed chat messages",min:0,max:40,step:1,v:6,fmt:v=>v},
 voiceMin:{g:"Daily activity (per active user)",l:"Voice minutes",min:0,max:30,step:0.5,v:2,fmt:v=>v+" min"},
 tpm:{g:"Daily activity (per active user)",l:"Conversation turns per voice minute",min:0.5,max:6,step:0.5,v:2,fmt:v=>v},
 logs:{g:"Daily activity (per active user)",l:"Care logs",min:0,max:15,step:0.5,v:2,fmt:v=>v},
 ragPct:{g:"Daily activity (per active user)",l:"Chat turns that need RAG (medical lookup)",min:0,max:100,step:5,v:25,fmt:v=>v+"%"},
 voiceInChat:{g:"Daily activity (per active user)",l:"Typed count already includes voice turns",type:"chk",v:false},
 tasks:{g:"Infrastructure",l:"Backend tasks (always on)",min:1,max:4,step:1,v:1,fmt:v=>v},
 vcpu:{g:"Infrastructure",l:"Backend vCPU per task",min:0.25,max:2,step:0.25,v:1,fmt:v=>v},
 mem:{g:"Infrastructure",l:"Backend memory per task (GB)",min:0.5,max:8,step:0.5,v:2,fmt:v=>v},
 ips:{g:"Infrastructure",l:"Public IPv4 addresses",min:1,max:8,step:1,v:4,fmt:v=>v,hint:"Load balancer, backend and RAG host addresses"},
 ragHost:{g:"Infrastructure",l:"RAG runs on its own EC2 host",type:"chk",v:true},
 rdsAlloc:{g:"Data & retention",l:"RDS allocated storage (GB)",min:20,max:200,step:5,v:20,fmt:v=>v},
 rdsMax:{g:"Data & retention",l:"RDS auto-grow ceiling (GB)",min:20,max:500,step:10,v:40,fmt:v=>v},
 retain:{g:"Data & retention",l:"Keep chat history & traces for (months; 0 = forever)",min:0,max:24,step:1,v:0,fmt:v=>v?v+" mo":"forever"},
 logRet:{g:"Data & retention",l:"CloudWatch log retention (days)",min:7,max:365,step:1,v:30,fmt:v=>v+" d"},
 groqFree:{g:"Provider options",l:"Groq usage covered by its free quota",type:"chk",v:false},
 comprehendOn:{g:"Provider options",l:"Comprehend Medical de-identification on",type:"chk",v:true,hint:"What-if only. Turning it off is a privacy decision, not a cost decision"},
 deidOnce:{g:"Provider options",l:"What-if: scan each user message only once",type:"chk",v:false,hint:"Not how the code works today. The route decision and the route answer each scan the same message."},
 apple:{g:"Provider options",l:"Include Apple Developer fee (spread monthly)",type:"chk",v:true}
};
const PRESETS={
 small:{t:"Small pilot",v:{users:10,growth:0,daily:60,chat:6,voiceMin:2,tpm:2,logs:2,ragPct:25,tasks:1}},
 growing:{t:"Growing pilot",v:{users:50,growth:15,daily:50,chat:8,voiceMin:3,tpm:2,logs:2,ragPct:25,tasks:1}},
 larger:{t:"Larger usage",v:{users:500,growth:10,daily:40,chat:8,voiceMin:4,tpm:2,logs:2,ragPct:25,tasks:2}}
};
const V={}; Object.entries(IN).forEach(([k,o])=>V[k]=o.v);
const V0={...V};

/* ===================== MODEL ===================== */
const H=730, DAYS=30.4;
const tok=(n,inP,outP,i,o)=>n*(i*inP+o*outP)/1e6;
const units=(chars)=>Math.max(1,Math.ceil(chars/100));
// DetectPHI is tiered by monthly units (official price list)
const dphiCost=(U,P)=>Math.min(U,1e6)*P.dphi+Math.min(Math.max(U-1e6,0),1e6)*P.dphi2+Math.max(U-2e6,0)*P.dphi3;
function month(v,a,m,pp){
  const P=pp||PG;
  const users=v.users*Math.pow(1+v.growth/100,m), dau=users*v.daily/100;
  const voiceTurnsPU=v.voiceMin*v.tpm;
  const typedPU=v.voiceInChat?Math.max(0,v.chat-voiceTurnsPU):v.chat;
  const typed=dau*typedPU*DAYS, voice=dau*voiceTurnsPU*DAYS, turns=typed+voice;
  const rag=turns*v.ragPct/100, recall=Math.min(turns-rag,turns*a.recallPct), ordinary=Math.max(0,turns-rag-recall);
  const sessions=dau*a.sessions*DAYS, logs=dau*v.logs*DAYS;
  const groqIn=v.groqFree?0:P.groqIn, groqOut=v.groqFree?0:P.groqOut;
  const c={}; // per line item: {cat, prov, model, feat, perTurn(bool), val}
  const add=(id,cat,prov,model,feat,val,turnBased)=>{c[id]={cat,prov,model,feat,val,turnBased};};
  // ---- Infrastructure (fixed)
  add("fargate","Infrastructure","AWS","ECS Fargate","Shared",v.tasks*(v.vcpu*P.fgVcpu+v.mem*P.fgGb)*H);
  add("alb","Infrastructure","AWS","Load balancer","Shared",(P.albH+a.lcu*P.albLcu)*H);
  add("ipv4","Infrastructure","AWS","Public IPv4","Shared",v.ips*P.ipv4*H);
  add("rds","Infrastructure","AWS","RDS instance","Shared",P.rdsH*H);
  if(v.ragHost) add("ec2","Infrastructure","AWS","EC2 RAG host","RAG",P.ec2*H+8*P.ebs);
  add("secret","Infrastructure","AWS","Secrets Manager","Shared",P.secret);
  // ---- AI
  const routed=turns*(1-a.directive);
  add("route","AI models","Anthropic","Claude Haiku 4.5","Chat",tok(routed,P.haikuIn,P.haikuOut,a.routeIn,a.routeOut),true);
  add("answer","AI models","OpenAI","gpt-4o-mini","Chat",tok(ordinary,P.miniIn,P.miniOut,a.answerIn,a.answerOut),true);
  add("summary","AI models","Anthropic","Claude Haiku 4.5","Memory",tok(turns*a.sumShare,P.haikuIn,P.haikuOut,a.sumIn,a.sumOut),true);
  add("sumEmb","AI models","Voyage AI","voyage-3-large","Memory",turns*a.sumShare*a.sumEmb*P.voyE/1e6,true);
  add("title","AI models","Anthropic","Claude Haiku 4.5","Chat",tok(sessions,P.haikuIn,P.haikuOut,a.titleIn,a.titleOut));
  add("recall","AI models","Anthropic","Claude Haiku 4.5","Memory",tok(recall*a.recallCalls,P.haikuIn,P.haikuOut,a.recallIn,a.recallOut)+recall*50*P.voyE/1e6,true);
  const gIn=(a.emIn+a.anIn+a.hyIn), gOut=(a.emOut+a.anOut+a.hyOut);
  add("ragGroq","AI models","Groq","gpt-oss-20b","RAG",tok(rag,groqIn,groqOut,gIn,gOut),true);
  add("ragFail","AI models","OpenAI","gpt-4o-mini","RAG",tok(rag*a.groqFail,P.miniIn,P.miniOut,gIn,gOut),true);
  add("ragEmb","AI models","Voyage AI","voyage-3-large","RAG",rag*a.ragEmb*P.voyE/1e6,true);
  add("ragRr","AI models","Voyage AI","rerank-2.5-lite","RAG",rag*a.rrDocs*(a.chunkTok+30)*P.voyR/1e6,true);
  add("ragGen","AI models","OpenAI","gpt-4o-mini","RAG",tok(rag,P.miniIn,P.miniOut,a.genIn,a.genOut),true);
  add("logEx","AI models","Anthropic","Claude Haiku 4.5","Care logs",tok(logs*a.aiPct,P.haikuIn,P.haikuOut,a.exIn,a.exOut));
  add("logSum","AI models","Anthropic","Claude Haiku 4.5","Care logs",tok(logs*a.notesPct,P.haikuIn,P.haikuOut,a.lsIn,a.lsOut));
  add("logEmb","AI models","Voyage AI","voyage-3-large","Care logs",logs*a.logEmb*P.voyE/1e6);
  const runs=logs*a.runsPerLog;
  add("insJ","AI models","OpenAI","gpt-4o-mini","Care Insights",tok(runs,P.miniIn,P.miniOut,a.jIn,a.jOut));
  add("insI","AI models","Anthropic","Claude Haiku 4.5","Care Insights",tok(runs,P.haikuIn,P.haikuOut,a.iIn,a.iOut));
  add("insC","AI models","OpenAI","gpt-4o-mini","Care Insights",tok(runs,P.miniIn,P.miniOut,a.cIn,a.cOut));
  // ---- De-identification (Comprehend Medical): no cache; one DetectPHI call per scan
  // Units per call site (see DSITES); the tiered rate is applied to the month's total units.
  let dphiU=0; const dphiS={};
  if(v.comprehendOn){
    const mu=units(a.msgChars), once=v.deidOnce;
    dphiS.dDecider=routed*mu;                                   // every routed turn, incl. log shortcuts
    dphiS.dExec=once?0:(ordinary+recall)*mu;                    // same message again; not on RAG turns
    dphiS.dPair=a.sumShare*((turns-rag)*units(a.pairChars)+rag*units(a.ragPairChars));
    dphiS.dTitle=sessions*mu;
    dphiS.dLogSave=logs*(a.notesPct*units(a.logChars)+(1-a.notesPct)*units(a.structChars));
    dphiS.dLogDraft=logs*a.aiPct*((1+(once?0:a.typeless))*units(a.logChars)+a.followUps*mu);
    dphiS.dEvidence=logs*a.notesPct*a.evRenders*units(a.logChars);
    dphiU=Object.values(dphiS).reduce((s,x)=>s+x,0);
    const rate=dphiU?dphiCost(dphiU,P)/dphiU:0;
    Object.entries(dphiS).forEach(([k,u])=>add(k,"De-identification","AWS","Comprehend Medical",DSITES[k].feat,u*rate,DSITES[k].turn));
  }
  // ---- Storage & logs
  const months=m+1, keep=v.retain?Math.min(months,v.retain):months;
  const turnsCum=cumTurns(v,a,m,keep), logsCum=cumLogs(v,a,m);
  const dbGb=a.startGb+(turnsCum*(a.kbTurn+a.sumShare*a.kbMem)+logsCum*(a.kbLog+a.kbMem))/1048576;
  let alloc=v.rdsAlloc; if(dbGb>alloc*0.9) alloc=Math.min(v.rdsMax,Math.ceil(dbGb/0.9));
  const over=dbGb>v.rdsMax*0.9;
  add("rdsSt","Storage & logs","AWS","RDS storage","Shared",alloc*P.rdsGp3);
  const bkGb=dbGb*a.bkFactor; add("rdsBk","Storage & logs","AWS","RDS backups","Shared",Math.max(0,bkGb-alloc)*P.rdsBk);
  const cwGb=a.cwIdle+turns*a.cwKb/1048576;
  add("cw","Storage & logs","AWS","CloudWatch Logs","Shared",Math.max(0,cwGb-5)*P.cwIn+cwGb*(v.logRet/30)*P.cwSt);
  add("ecr","Storage & logs","AWS","ECR images","Shared",0.5*P.ecr);
  add("s3","Storage & logs","AWS","S3 bundle","RAG",0.02*P.s3);
  // ---- Other services
  add("cognito","Other services","AWS","Cognito","Login",Math.max(0,users-10000)*P.cognito);
  const newUsers=m===0?users:users-v.users*Math.pow(1+v.growth/100,m-1);
  add("ses","Other services","AWS","SES email","Login",newUsers*2/1000*P.ses);
  const xGb=turns*a.xferKb/1048576; add("xfer","Other services","AWS","Data transfer out","Shared",Math.max(0,xGb-100)*P.xfer);
  if(v.apple) add("apple","Other services","Apple","Developer Program","Distribution",P.apple/12);
  let total=0; const cat={}; Object.values(c).forEach(x=>{total+=x.val;cat[x.cat]=(cat[x.cat]||0)+x.val;});
  return {m,users,dau,typed,voice,turns,rag,recall,ordinary,logs,runs,sessions,c,cat,total,dbGb,alloc,over,bkGb,cwGb,xGb,dphiU,dphiS};
}
const DSITES={
 dDecider:{feat:"Chat",turn:true,n:"Route decision",text:"User message",when:"Every routed turn, including log shortcuts. Skipped only for some shortcut commands and crisis replies."},
 dExec:{feat:"Chat",turn:true,n:"Route answer scans again",text:"The same user message",when:"Ordinary (simple turns too), support and recall turns. Not technical/RAG turns."},
 dPair:{feat:"Memory",turn:true,n:"Memory summary of the turn",text:"User message + full reply",when:"After each turn. Skipped when the pair is under 40 chars. Long RAG replies make this the largest item."},
 dTitle:{feat:"Chat",turn:false,n:"Chat title",text:"First user message",when:"First turn of each new chat"},
 dLogSave:{feat:"Care logs",turn:false,n:"Log memory entry",text:"Notes, or structured fields if there are no notes",when:"Every saved or edited log"},
 dLogDraft:{feat:"Care logs",turn:false,n:"AI log drafting",text:"Log description; each follow-up reply",when:"AI-assisted logs"},
 dEvidence:{feat:"Care Insights",turn:false,n:"Care Insights evidence",text:"Log notes, scanned again",when:"Every reflection run, for each log in its batch"}
};
function turnsPU(v){const vt=v.voiceMin*v.tpm;return (v.voiceInChat?Math.max(0,v.chat-vt):v.chat)+vt;}
function cumTurns(v,a,m,keep){let s=0;for(let k=m-keep+1;k<=m;k++){const u=v.users*Math.pow(1+v.growth/100,k);s+=u*v.daily/100*turnsPU(v)*DAYS;}return s;}
function cumLogs(v,a,m){let s=0;for(let k=0;k<=m;k++){const u=v.users*Math.pow(1+v.growth/100,k);s+=u*v.daily/100*v.logs*DAYS;}return s;}
function run(v){const out=[];for(let m=0;m<12;m++)out.push(month(v,A,m));return out;}

/* ===================== SENSITIVITY ===================== */
const SENS={fL:0.5,fH:1.5,pL:0.9,pH:1.3};
const FACTORS=[["freq","Usage frequency"],["tok","AI token counts"],["phi","DetectPHI text volume"],["mix","Usage mix & triggers"],["store","Storage & infra sizing"],["price","Unverified prices"]];
const grpOf=r=>(r[6]==="tokens"||r[6]==="docs")?"tok":r[1]==="De-identification"?"phi":(r[1]==="Storage"||r[1]==="Infrastructure")?"store":"mix";
function scen(lv,vOver,vBase){ // lv: factor -> 0 low / 1 base / 2 high
  const a={};AS.forEach(r=>a[r[0]]=r[3+(lv[grpOf(r)]??1)]);
  const v={...(vBase||V),...(vOver||{})},fm=[SENS.fL,1,SENS.fH][lv.freq??1];v.chat*=fm;v.voiceMin*=fm;v.logs*=fm;
  const p={...P},pm=[SENS.pL,1,SENS.pH][lv.price??1];PR.forEach(r=>{if(r[4]!=="official")p[r[0]]=P[r[0]]*pm;});
  const out=[];for(let m=0;m<12;m++)out.push(month(v,a,m,p));return out;
}
const allAt=b=>Object.fromEntries(FACTORS.map(([k])=>[k,b]));

/* Pending, not in totals: upper-bound estimate for a planned privacy-processing update on RAG
   questions. Shown separately until the implementation is verified. */
function pendingTechDphi(r,a){a=a||A;const u=r.rag*units(a.msgChars);return {units:u,cost:u*P.dphi};}

if(typeof module!=="undefined")module.exports={PR,P,AS,A,IN,PRESETS,V,month,run,scen,allAt,setBand,SENS,FACTORS,pendingTechDphi,DSITES};
