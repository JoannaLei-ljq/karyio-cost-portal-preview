/* Deployment Options: compares hosting approaches for the external TestFlight pilot.
   Usage-based costs (AI APIs, Comprehend Medical, Cognito/SES, Apple) come from the model and are kept in
   every option. Only the hosting lines are swapped. Provider prices below were read 2026-10-29. */
const KDeploy=(()=>{
const $=id=>document.getElementById(id);
const HOST_KEYS=["fargate","alb","ipv4","rds","ec2","secret","rdsSt","rdsBk","cw","ecr","s3","xfer"];
const CHECKED="2026-10-29";
// Fargate ARM (Graviton), us-east-1, official per-second rates × 3,600
const FG_ARM_VCPU=0.0000089944*3600, FG_ARM_GB=0.0000009889*3600, T4G_SMALL=0.0168;
const SRC=[
 ["AWS Fargate pricing (x86 and ARM, us-east-1)","https://aws.amazon.com/fargate/pricing/","official","A, A2"],
 ["EC2 t4g.small on-demand, us-east-1 ($0.0168/h)","https://calculator.holori.com/aws/ec2/t4g.small/us-east-1","secondary","A2"],
 ["Render pricing (workspaces, services, Postgres, bandwidth)","https://render.com/pricing.md","official","B"],
 ["Render Postgres extensions (pgvector)","https://render.com/docs/postgresql-extensions","official","B"],
 ["DigitalOcean Droplet pricing and backups","https://www.digitalocean.com/pricing/droplets","official","C"],
 ["DigitalOcean support plans (Standard $99/mo)","https://www.digitalocean.com/pricing/support","official","C"],
 ["DigitalOcean HIPAA covered products & BAA","https://www.digitalocean.com/trust/hipaa-at-do","official","C"],
 ["AWS HIPAA-eligible services (updated 2026-10-15)","https://aws.amazon.com/compliance/hipaa-eligible-services-reference/","official","All"],
 ["Amazon Lightsail pricing","https://aws.amazon.com/lightsail/pricing/","official","Checked"],
 ["Hetzner Cloud Regular Performance (US locations)","https://www.hetzner.com/cloud/regular-performance/","official","Checked"],
 ["Cognito email settings (built-in email cap vs SES)","https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-email.html","official","All"]
];
/* host(r,v) → {lo, hi, parts:[[label, $]]}; every value traceable to SRC or to the model */
const OPT=[
 {id:"aws",t:"A · AWS as planned",tag:"Current plan",color:"--c1",
  sum:"ECS Fargate backend, RDS PostgreSQL, EC2 RAG host, load balancer and CloudWatch, all in one AWS account. This is what the deployment scripts build today.",
  host:(r)=>{const parts=[["Backend compute",r.c.fargate.val],["Load balancer",r.c.alb.val],["Public IPv4",r.c.ipv4.val],["Database + storage + backups",(r.c.rds.val+r.c.rdsSt.val+r.c.rdsBk.val)],["RAG host + bundle",(r.c.ec2?r.c.ec2.val:0)+r.c.s3.val],["Logs, images, secret, transfer",r.c.cw.val+r.c.ecr.val+r.c.secret.val+r.c.xfer.val]];const t=parts.reduce((s,p)=>s+p[1],0);return {lo:t,hi:t,parts};},
  conf:"Model (25 of 32 prices official)"},
 {id:"aws2",t:"A2 · AWS, tuned",tag:"Same architecture",color:"--c3",
  sum:"Same AWS setup, with the backend on Graviton (ARM) Fargate and the RAG host on an ARM instance of the same size. Needs ARM container builds; nothing else moves.",
  host:(r,v)=>{const fg=v.tasks*(v.vcpu*FG_ARM_VCPU+v.mem*FG_ARM_GB)*730, ec2=v.ragHost?T4G_SMALL*730+8*P.ebs:0;
    const rest=HOST_KEYS.filter(k=>k!=="fargate"&&k!=="ec2").reduce((s,k)=>s+(r.c[k]?r.c[k].val:0),0);
    const parts=[["Backend compute (ARM)",fg],["RAG host (t4g.small)",ec2],["Everything else as in A",rest]];const t=fg+ec2+rest;return {lo:t,hi:t,parts};},
  conf:"Fargate ARM official; t4g.small secondary"},
 {id:"hybrid",t:"B · Hybrid cloud (Render)",tag:"Managed platform",color:"--c4",
  sum:"Backend and RAG as Render services, Render Postgres (pgvector supported). Cognito, SES and Comprehend Medical stay on AWS and are called across providers.",
  host:(r,v)=>{const ws=25, be=25*v.tasks, rag=v.ragHost?25:0, pg=19, st=Math.max(0,r.alloc-1)*0.30, bw=Math.max(0,r.xGb-25)*0.15;
    const base=ws+be+rag+pg+st+bw, baa=499-ws+0.2*(be+rag+pg);
    return {lo:base,hi:base+baa,parts:[["Pro workspace",ws],["Backend service 1 CPU / 2 GB",be],["RAG private service 1 CPU / 2 GB",rag],["Postgres 0.5 CPU / 1 GB",pg],[`Storage ${Math.max(0,r.alloc-1)} GB × $0.30`,st],["Bandwidth over 25 GB",bw]],
      hiNote:`Upper end: the Scale workspace ($499/mo) with its 20% compute premium, which Render requires for a BAA.`};},
  conf:"Official Render prices"},
 {id:"vps",t:"C · Low-cost VPS (DigitalOcean)",tag:"Self-managed",color:"--c2",
  sum:"Two Droplets: one runs the backend and a self-managed PostgreSQL with pgvector, one runs RAG. The team handles TLS, patching, database backups and monitoring. Cognito, SES and Comprehend Medical stay on AWS.",
  host:(r,v)=>{const app=24, rag=v.ragHost?12:0, bkW=0.2*(app+rag), bkD=0.3*(app+rag);
    return {lo:app+rag+bkW,hi:app+rag+bkD+99,parts:[["Droplet 4 GB / 2 vCPU (backend + database)",app],["Droplet 2 GB / 1 vCPU (RAG)",rag],["Weekly backups (20%)",bkW]],
      hiNote:"Upper end: daily backups (30%) plus Standard support ($99/mo), in case the BAA requires a paid support plan (not confirmed on DigitalOcean's HIPAA page)."};},
  conf:"Official DigitalOcean prices; BAA terms unresolved"}
];
const ROWS=[
 ["Monthly cost basis","Mostly fixed hosting + usage","Mostly fixed hosting + usage","Flat plan fees + usage","Flat server fees + usage"],
 ["One-time migration effort","None: deploy scripts exist and were rehearsed in a test account","Low: ARM image builds, re-test","Medium: new service definitions, database migration, cross-provider AWS credentials","Medium–High: server setup, TLS, database install and backup jobs, monitoring, cross-provider AWS credentials"],
 ["Ongoing operations","Low: managed compute and database","Low","Low–Medium: managed platform, two vendors","High: OS patching, database backups and restores, uptime monitoring by the team"],
 ["Reliability","Managed services; single-AZ database with 7-day backups","Same as A","Managed services; single region","Depends on the team; one server holds backend and database"],
 ["Scaling","Autoscaling to a 2nd task already configured","Same as A","Plan upgrades in fixed steps","Manual resize; downtime likely"],
 ["Privacy agreements (BAA)","AWS services used are on AWS's HIPAA-eligible list","Same as A","Only on the Scale workspace ($499/mo) or Enterprise","BAA via sales, Droplets/Volumes/Backups only; Managed Databases and App Platform not covered"],
 ["External TestFlight readiness","Ready once deployed to the organization account","Ready after an ARM rebuild and re-test","Needs a full new deploy and test","Needs a full new deploy, hardening and test"],
 ["Cognito sign-in","Native","Native","Works (public token issuer); no change","Works (public token issuer); no change"],
 ["Comprehend Medical (DetectPHI)","Native IAM role","Native IAM role","Works with AWS access keys or IAM Roles Anywhere; key rotation needed","Same as B"],
 ["RAG runtime (≈2 GB RAM, outbound AI calls)","EC2 t3.small","EC2 t4g.small (ARM build)","1 CPU / 2 GB private service","2 GB Droplet"],
 ["Main limitation","Highest fixed hosting line","Small saving; ARM builds to maintain","No saving at pilot scale; BAA very expensive","Saving shifts work and risk onto a small team"]
];
let DPM=0;
function render(){
  const R=run(V), r=R[DPM];
  const usage=r.total-HOST_KEYS.reduce((s,k)=>s+(r.c[k]?r.c[k].val:0),0);
  $("dp-scen").textContent=(typeof scenLabel==="function"?scenLabel():"")+` · month ${DPM+1}`;
  const res=OPT.map(o=>({o,h:o.host(r,V)}));
  const aws=res[0].h.lo, cm=r.cat["De-identification"]||0;
  const cheapest=res.slice(1).reduce((m,x)=>Math.min(m,x.h.lo),Infinity);
  $("dp-key").innerHTML=`<b>Hosting is ${money(aws)} of the ${money(r.total)} month (${Math.round(100*aws/r.total)}%).</b> The cheapest alternative saves at most ${money(aws-cheapest)}/mo, before the extra operations work. Usage costs (${money(usage)}) are the same everywhere; Comprehend Medical alone is ${money(cm)}. As usage grows, scan volume matters more than where Karyio is hosted.`;
  $("dp-cards").innerHTML=res.map(({o,h})=>{const tLo=h.lo+usage,tHi=h.hi+usage;
    return `<details class="dp-card" data-opt="${o.id}" style="--oc:var(${o.color})"><summary><span class="dp-tag">${o.tag}</span><h3>${o.t}</h3>
      <div class="dp-total">${money(tLo)}${tHi-tLo>0.5?` – ${money(tHi)}`:""}<small>/mo</small></div>
      <div class="small">Hosting ${money(h.lo)}${h.hi-h.lo>0.5?`–${money(h.hi)}`:""} + usage ${money(usage)}${o.id!=="aws"?` · ${moneyD(h.lo-aws)} hosting vs A`:""}</div>
      <p>${o.sum}</p><span class="small dp-more">Cost details ›</span></summary>
      <div class="dp-body"><ul class="kv">${h.parts.map(([l,v])=>`<li><span>${l}</span><b>${money(v)}</b></li>`).join("")}<li><span>Usage-based (same in all options)</span><b>${money(usage)}</b></li></ul>
      ${h.hiNote?`<p class="small">${h.hiNote}</p>`:""}<p class="small">Source: ${o.conf}.</p></div></details>`;}).join("")+
    `<div class="dp-card ref"><span class="dp-tag">Reference only</span><h3>Developer Mac</h3><p class="small">Useful for development and demos. Not suitable for external testers: the Mac has to stay on, awake and reachable, with no failover, and testers' data would sit on a personal machine. Not priced.</p></div>`;
  const C=OPT.map(o=>cssv(o.color));
  legend("dp-lg",[["Hosting (lower end)",cssv("--c5")],["Usage-based (same in all)",cssv("--c6")]]);
  stacked("dp-chart",res.map(x=>x.o.t.split(" · ")[0]+" "+x.o.t.split(" · ")[1].split(" (")[0]),[{name:"Hosting",color:cssv("--c5"),values:res.map(x=>x.h.lo)},{name:"Usage-based",color:cssv("--c6"),values:res.map(()=>usage)}],{totals:true,h:260});
  $("dp-matrix").innerHTML=`<table class="dp-t"><tr><th></th>${OPT.map(o=>`<th>${o.t}</th>`).join("")}</tr>
   <tr><td><b>Estimated monthly total</b></td>${res.map(({h})=>`<td class="n"><b>${money(h.lo+usage)}${h.hi-h.lo>0.5?` – ${money(h.hi+usage)}`:""}</b></td>`).join("")}</tr>
   <tr><td>Fixed hosting</td>${res.map(({h})=>`<td class="n">${money(h.lo)}${h.hi-h.lo>0.5?` – ${money(h.hi)}`:""}</td>`).join("")}</tr>
   <tr><td>Variable (usage-based)</td>${res.map(()=>`<td class="n">${money(usage)}</td>`).join("")}</tr>
   ${ROWS.map(rw=>`<tr><td>${rw[0]}</td>${rw.slice(1).map(x=>`<td class="small">${x}</td>`).join("")}</tr>`).join("")}
   <tr><td>Source &amp; confidence</td>${OPT.map(o=>`<td class="small">${o.conf}</td>`).join("")}</tr></table>`;
  $("dp-rec").innerHTML=`<h2>Recommendation for the external TestFlight pilot</h2>
   <ol class="tight"><li><b>Stay on AWS (option A) for the pilot.</b> It's the only option with a scripted deployment that has already been rehearsed, and it keeps every service that handles health data with one provider whose services are on its HIPAA-eligible list.</li>
   <li><b>Apply the A2 tuning after the first measurements</b> (ARM builds, then right-size CPU and memory). That saves about ${money(aws-res[1].h.lo)}/mo with no architecture change.</li>
   <li><b>Don't move hosting to save money at pilot scale.</b> Hybrid (B) costs about the same, and much more if a BAA is needed. A VPS (C) saves about ${money(aws-res[3].h.lo)}/mo, but the team takes on the database, backups, patching and uptime.</li>
   <li><b>Look at privacy-scan volume instead.</b> Reusing each turn's de-identified text (code change, same protection) is the evidence-based lever that grows with usage. See the Overview.</li>
   <li><b>Before external testers join:</b> set up SES email for Cognito, and confirm data agreements with every AI provider. That applies to every option.</li></ol>
   <p class="small">Cheaper isn't automatically better. These figures cover hosting cost only; staff time for migration and operations isn't priced.</p>`;
  $("dp-compliance").innerHTML=`<ul class="tight">
   <li><b>AWS:</b> Fargate, ECS, RDS, EC2, Cognito, Comprehend Medical, SES, CloudWatch, S3, ECR, load balancing and Secrets Manager are on AWS's HIPAA-eligible services list (updated 2026-10-15). <b>Lightsail is not.</b></li>
   <li><b>Render:</b> a BAA is offered only on the Scale ($499/mo + 20% compute premium) or Enterprise workspace.</li>
   <li><b>DigitalOcean:</b> a BAA is requested through sales. Covered products include Droplets, Volumes, Backups, Spaces and Load Balancers, but not Managed Databases or App Platform.</li>
   <li><b>Unresolved for every option:</b> whether Karyio must sign BAAs at all (depends on its role under HIPAA), and the agreements with AI providers. OpenAI and Anthropic publish API BAA programs with zero-data-retention conditions; Voyage AI and Groq terms are not verified.</li></ul>
   <p class="small">Nothing on this page is legal or compliance advice. Confirm with the providers and counsel.</p>`;
  $("dp-cross").innerHTML=`<ul class="tight">
   <li><b>Cognito</b> keeps working from any host: the backend checks sign-in tokens against Cognito's public issuer address.</li>
   <li><b>Comprehend Medical and SES</b> need AWS credentials on the non-AWS host (access keys or IAM Roles Anywhere), stored as secrets and rotated.</li>
   <li><b>Network:</b> every privacy scan becomes a cross-provider HTTPS call. That adds a little latency, and AWS data transfer is still billed past the free allowance.</li>
   <li><b>Database:</b> PostgreSQL with pgvector is required (memory search). Render Postgres supports it; on a VPS the team installs and backs it up.</li>
   <li><b>RAG:</b> needs about 2 GB of memory for its search indexes and outbound access to Groq, Voyage AI and OpenAI.</li></ul>`;
  $("dp-other").innerHTML=`<ul class="tight">
   <li><b>Amazon Lightsail</b>: 4 GB + 2 GB instances, $24 + $12 a month (IPv4 included). Cheap and in the same AWS account, but <b>not on AWS's HIPAA-eligible list</b>.</li>
   <li><b>Hetzner Cloud, US locations</b>: CPX21 (4 GB) €32.49 + CPX11 (2 GB) €17.99 a month excl. VAT. Not cheaper than DigitalOcean in US regions, and no BAA offering was found. EU locations are cheaper but put data outside the US.</li>
   <li><b>DigitalOcean Managed PostgreSQL</b> from $15.15/mo: easier than self-managing, but not a HIPAA-covered product.</li></ul>`;
  $("dp-sources").innerHTML=`<table><tr><th>Source</th><th>Status</th><th>Used for</th><th>Checked</th></tr>${SRC.map(s=>`<tr><td class="small"><a href="${s[1]}" target="_blank" rel="noopener noreferrer">${s[0]}</a></td><td>${badge(s[2])}</td><td class="small">${s[3]}</td><td class="small">${CHECKED}</td></tr>`).join("")}</table>
   <p class="small">EUR prices aren't converted, to avoid an invented exchange rate. Prices change; check the sources before deciding.</p>`;
}
function init(){document.querySelectorAll("#dpMonth button").forEach(b=>b.onclick=()=>{DPM=+b.dataset.m;document.querySelectorAll("#dpMonth button").forEach(x=>x.setAttribute("aria-pressed",x===b));render();});}
return {render,init,HOST_KEYS,OPT};
})();
