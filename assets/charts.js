/* Inline-SVG chart helpers. */
const NS="http://www.w3.org/2000/svg";
const cssv=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
let tip;
function showTip(e,t){tip=tip||document.getElementById("tip");tip.textContent=t;tip.style.display="block";
  const x=Math.min(e.clientX+12,window.innerWidth-270);tip.style.left=x+"px";tip.style.top=(e.clientY+12)+"px";}
function hideTip(){(tip||document.getElementById("tip")).style.display="none";}
// Display only: exactly zero → $0.00, positive below one cent → <$0.01, negatives keep their sign.
function money(x){if(!x)return "$0.00";const s=x<0?"−":"",a=Math.abs(x);if(a<0.01)return s+"<$0.01";if(a<100)return s+"$"+a.toFixed(2);return s+"$"+Math.round(a).toLocaleString();}
function money0(x){if(!x)return "$0.00";if(Math.abs(x)<1)return money(x);return (x<0?"−":"")+"$"+Math.round(Math.abs(x)).toLocaleString();}
// Signed change, for what-if and sensitivity deltas
function moneyD(d){if(!d)return "$0.00";return (d>0?"+":"")+money(d);}
function num(x,d=0){return x.toLocaleString(undefined,{maximumFractionDigits:d});}
function niceMax(v){if(v<=0)return 1;const p=Math.pow(10,Math.floor(Math.log10(v)));const f=v/p;return (f<=1?1:f<=2?2:f<=5?5:10)*p;}
function svg(w,h){const s=document.createElementNS(NS,"svg");s.setAttribute("viewBox",`0 0 ${w} ${h}`);return s;}
function el(t,a,p){const e=document.createElementNS(NS,t);for(const k in a)e.setAttribute(k,a[k]);p.appendChild(e);return e;}
function axisY(s,x0,y0,y1,max,w,fmt){const g=el("g",{class:"axis"},s);for(let i=0;i<=4;i++){const y=y0-(y0-y1)*i/4;el("line",{x1:x0,x2:w-10,y1:y,y2:y,"stroke-dasharray":i?"2 3":""},g);const t=el("text",{x:x0-6,y:y+4,"text-anchor":"end"},g);t.textContent=(fmt||money)(max*i/4);}}
function legend(id,items){document.getElementById(id).innerHTML=items.map(([n,c])=>`<span><i style="background:${c}"></i>${n}</span>`).join("");}
function stacked(id,labels,series,opts={}){
  const W=opts.w||760,Hh=opts.h||300,L=64,B=Hh-28,T=14;const s=svg(W,Hh);
  const totals=labels.map((_,i)=>series.reduce((a,se)=>a+se.values[i],0));const max=niceMax(Math.max(...totals,opts.min||0));
  axisY(s,L,B,T,max,W,opts.fmt);const bw=(W-L-14)/labels.length;
  labels.forEach((lb,i)=>{let y=B;series.forEach(se=>{const hh=(B-T)*se.values[i]/max;if(hh>0){const r=el("rect",{x:L+i*bw+bw*0.18,y:y-hh,width:bw*0.64,height:hh,fill:se.color,rx:2},s);r.addEventListener("mousemove",e=>showTip(e,`${lb} · ${se.name}: ${(opts.fmt||money)(se.values[i])}`));r.addEventListener("mouseleave",hideTip);}y-=hh;});
    const t=el("text",{x:L+i*bw+bw/2,y:Hh-10,"text-anchor":"middle",class:"axis"},s);t.setAttribute("fill",cssv("--muted"));t.setAttribute("font-size","11");t.textContent=lb;
    if(opts.totals){const tt=el("text",{x:L+i*bw+bw/2,y:B-(B-T)*totals[i]/max-4,"text-anchor":"middle","font-size":"10.5"},s);tt.setAttribute("fill",cssv("--ink"));tt.textContent=(opts.fmt||money)(totals[i]);}});
  const c=document.getElementById(id);c.innerHTML="";c.appendChild(s);
}
function lines(id,xs,series,opts={}){
  const W=opts.w||760,Hh=opts.h||300,L=64,B=Hh-28,T=14;const s=svg(W,Hh);
  const max=niceMax(Math.max(...series.flatMap(se=>se.values),...(opts.band?opts.band.hi:[]),opts.min||0));axisY(s,L,B,T,max,W,opts.fmt);
  const X=i=>L+(W-L-20)*(xs.length>1?i/(xs.length-1):0.5);
  if(opts.band){const Y=v=>B-(B-T)*Math.min(v,max)/max;
    const d=opts.band.hi.map((v,i)=>`${i?"L":"M"}${X(i)},${Y(v)}`).join(" ")+" "+opts.band.lo.map((v,i)=>[i,v]).reverse().map(([i,v])=>`L${X(i)},${Y(v)}`).join(" ")+" Z";
    el("path",{d,fill:opts.band.color,"fill-opacity":0.13,stroke:"none"},s);}
  xs.forEach((x,i)=>{if(xs.length<=13||i%2===0){const t=el("text",{x:X(i),y:Hh-10,"text-anchor":"middle","font-size":"11"},s);t.setAttribute("fill",cssv("--muted"));t.textContent=opts.xfmt?opts.xfmt(x):x;}});
  series.forEach(se=>{const d=se.values.map((v,i)=>`${i?"L":"M"}${X(i)},${B-(B-T)*Math.min(v,max)/max}`).join(" ");
    el("path",{d,fill:"none",stroke:se.color,"stroke-width":se.w||2.4,"stroke-dasharray":se.dash||""},s);
    if(!se.noDots)se.values.forEach((v,i)=>{const c=el("circle",{cx:X(i),cy:B-(B-T)*Math.min(v,max)/max,r:3.5,fill:se.color},s);c.addEventListener("mousemove",e=>showTip(e,`${opts.xfmt?opts.xfmt(xs[i]):xs[i]} · ${se.name}: ${(opts.fmt||money)(v)}`));c.addEventListener("mouseleave",hideTip);});});
  const c=document.getElementById(id);c.innerHTML="";c.appendChild(s);
}
function hbars(id,items,opts={}){
  items=items.filter(x=>x.value>0).sort((a,b)=>b.value-a.value);const W=opts.w||520,row=26,L=opts.l||170,Hh=Math.max(40,items.length*row+10);const s=svg(W,Hh);
  const max=Math.max(...items.map(x=>x.value),1e-9);
  items.forEach((x,i)=>{const y=6+i*row;const t=el("text",{x:L-8,y:y+15,"text-anchor":"end","font-size":"12"},s);t.setAttribute("fill",cssv("--ink"));t.textContent=x.label;
    const w=(W-L-80)*x.value/max;const r=el("rect",{x:L,y:y+3,width:Math.max(1,w),height:16,rx:3,fill:x.color||cssv("--c1")},s);
    r.addEventListener("mousemove",e=>showTip(e,`${x.label}: ${money(x.value)}`));r.addEventListener("mouseleave",hideTip);
    const v=el("text",{x:L+w+6,y:y+15,"font-size":"11.5"},s);v.setAttribute("fill",cssv("--muted"));v.textContent=money(x.value)+(opts.pct?` · ${Math.round(100*x.value/opts.pct)}%`:"");});
  const c=document.getElementById(id);c.innerHTML="";if(!items.length){c.innerHTML='<p class="small">Nothing in this view at the current settings.</p>';return;}c.appendChild(s);
}
function tornado(id,items,base){
  items=items.slice().sort((a,b)=>Math.abs(b.hi-b.lo)-Math.abs(a.hi-a.lo));
  const W=760,row=32,L=270,R=80,Hh=items.length*row+30;const s=svg(W,Hh);
  const mn=Math.min(base,...items.map(x=>Math.min(x.lo,x.hi))),mx=Math.max(base,...items.map(x=>Math.max(x.lo,x.hi)));
  const pad=(mx-mn)*0.04||1,X=v=>L+(W-L-R)*(v-mn+pad)/(mx-mn+2*pad);
  items.forEach((x,i)=>{const y=6+i*row;
    const t=el("text",{x:L-10,y:y+17,"text-anchor":"end","font-size":"12"},s);t.setAttribute("fill",cssv("--ink"));t.textContent=x.label;
    [["lo",cssv("--c3"),"Low"],["hi",cssv("--c2"),"High"]].forEach(([k,col,nm])=>{const a=Math.min(X(x[k]),X(base)),w=Math.abs(X(x[k])-X(base));
      const r=el("rect",{x:a,y:y+4,width:Math.max(1,w),height:18,rx:3,fill:col},s);
      r.addEventListener("mousemove",e=>showTip(e,`${x.label} · ${nm}: ${money(x[k])} (${x[k]>=base?"+":"−"}${money(Math.abs(x[k]-base))} vs base)`));r.addEventListener("mouseleave",hideTip);});
    const lo=Math.min(x.lo,x.hi),hi=Math.max(x.lo,x.hi);
    const a=el("text",{x:X(lo)-5,y:y+17,"text-anchor":"end","font-size":"11"},s);a.setAttribute("fill",cssv("--muted"));a.textContent=money(lo);
    const b=el("text",{x:X(hi)+5,y:y+17,"font-size":"11"},s);b.setAttribute("fill",cssv("--muted"));b.textContent=money(hi);});
  el("line",{x1:X(base),x2:X(base),y1:2,y2:Hh-22,stroke:cssv("--ink"),"stroke-dasharray":"3 3"},s);
  const bt=el("text",{x:X(base),y:Hh-6,"text-anchor":"middle","font-size":"11.5"},s);bt.setAttribute("fill",cssv("--ink"));bt.textContent="Base "+money(base);
  const c=document.getElementById(id);c.innerHTML="";c.appendChild(s);
}
