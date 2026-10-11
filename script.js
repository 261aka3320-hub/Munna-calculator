/* ---------- Engine (safe parser, no eval) ---------- */
const state = { deg:true, ans:0, mem:0, shift:false };
const toRad = x => state.deg ? x*Math.PI/180 : x;
const fromRad = x => state.deg ? x*180/Math.PI : x;
function factorial(n){ if(n<0||!Number.isInteger(n)) throw new Error("Math ERROR"); if(n>170) throw new Error("Math ERROR"); let r=1; for(let i=2;i<=n;i++) r*=i; return r; }
const FUNCS = {
  sin:x=>Math.sin(toRad(x)), cos:x=>Math.cos(toRad(x)), tan:x=>Math.tan(toRad(x)),
  asin:x=>fromRad(Math.asin(x)), acos:x=>fromRad(Math.acos(x)), atan:x=>fromRad(Math.atan(x)),
  sinh:Math.sinh, cosh:Math.cosh, tanh:Math.tanh, log:Math.log10, ln:Math.log, exp:Math.exp,
  sqrt:Math.sqrt, cbrt:Math.cbrt, abs:Math.abs, round:Math.round, fact:factorial
};
const CONSTS = { pi:()=>Math.PI, e:()=>Math.E, ans:()=>state.ans };

function tokenize(src){
  const s = src.replace(/×/g,"*").replace(/÷/g,"/").replace(/π/g,"pi").replace(/√/g,"sqrt").replace(/−/g,"-").replace(/\s+/g,"");
  const out=[]; let i=0;
  while(i<s.length){
    const rest=s.slice(i); let m;
    if((m=/^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(rest)) && !/^(\d+\.?\d*|\.\d+)e(?![+-]?\d)/i.test(rest) || (m=/^(\d+\.?\d*|\.\d+)/.exec(rest))){
      out.push({t:"num",v:parseFloat(m[0])}); i+=m[0].length;
    } else if((m=/^[a-z]+/i.exec(rest))){ out.push({t:"id",v:m[0].toLowerCase()}); i+=m[0].length; }
    else if("+-*/^%!()".includes(s[i])){ out.push({t:s[i]}); i++; }
    else throw new Error("Syntax ERROR");
  }
  return out;
}
function evaluate(src){
  const tk=tokenize(src); let p=0;
  const peek=()=>tk[p]&&tk[p].t, next=()=>tk[p++];
  const expect=t=>{ if(peek()!==t) throw new Error("Syntax ERROR"); p++; };
  function expr(){ let v=term(); while(peek()==="+"||peek()==="-") v = next().t==="+" ? v+term() : v-term(); return v; }
  function term(){
    let v=unary();
    for(;;){ const t=peek();
      if(t==="*"){p++; v*=unary();}
      else if(t==="/"){p++; const d=unary(); if(d===0) throw new Error("Math ERROR"); v/=d;}
      else if(t==="num"||t==="id"||t==="(") v*=unary();
      else return v; }
  }
  function unary(){ if(peek()==="-"){p++; return -unary();} if(peek()==="+"){p++; return unary();} return power(); }
  function power(){ const b=postfix(); if(peek()==="^"){p++; return Math.pow(b,unary());} return b; }
  function postfix(){ let v=primary(); while(peek()==="!"||peek()==="%") v = next().t==="!" ? factorial(v) : v/100; return v; }
  function primary(){
    const k=next(); if(!k) throw new Error("Syntax ERROR");
    if(k.t==="num") return k.v;
    if(k.t==="("){ const v=expr(); if(peek()===")") p++; return v; }   // closing bracket optional, like a real Casio
    if(k.t==="id"){
      if(CONSTS[k.v]) return CONSTS[k.v]();
      if(FUNCS[k.v]){ if(peek()==="("){ p++; const v=expr(); if(peek()===")") p++; return FUNCS[k.v](v); } return FUNCS[k.v](power()); }
    }
    throw new Error("Syntax ERROR");
  }
  if(!tk.length) return 0;
  const r=expr(); if(p<tk.length) throw new Error("Syntax ERROR");
  if(!Number.isFinite(r)) throw new Error("Math ERROR");
  return r;
}
function fmt(n){
  if(Object.is(n,-0)) n=0;
  const r=parseFloat(n.toPrecision(10));
  if(Math.abs(r)>=1e10||(r!==0&&Math.abs(r)<1e-9)) return r.toExponential(5).replace(/\.?0+e/,"e").replace("e+","e");
  return String(r);
}

/* ---------- Keypad ---------- */
const $=id=>document.getElementById(id);
const exprEl=$("expr"), resEl=$("result"), pad=$("pad");
const hist=[]; let hIdx=0;

// [label, shiftLabel, action, shiftAction, class]   actions beginning with "=" are commands
const KEYS = [
  ["SHIFT","","=shift","","shift"],["◀","","=left","","nav"],["▲","","=up","","nav"],["▼","","=down","","nav"],["▶","","=right","","nav"],
  ["D⇄R","","=drg","","fnk"],["Ans","","ans","","fnk"],["MR","MC","=mr","=mc","fnk"],["M+","M−","=mp","=mm","fnk"],["x⁻¹","x!","^(-1)","!","fnk"],
  ["x²","√","^2","√(","fnk"],["xʸ","∛","^","cbrt(","fnk"],["log","10ˣ","log(","10^","fnk"],["ln","eˣ","ln(","exp(","fnk"],["(","π","(","π","fnk"],
  ["sin","sin⁻¹","sin(","asin(","fnk"],["cos","cos⁻¹","cos(","acos(","fnk"],["tan","tan⁻¹","tan(","atan(","fnk"],["sinh","|x|","sinh(","abs(","fnk"],[")","e",")","e","fnk"],
  ["7","","7","","num"],["8","","8","","num"],["9","","9","","num"],["DEL","INS","=del","","del"],["AC","OFF","=ac","=ac","del"],
  ["4","","4","","num"],["5","","5","","num"],["6","","6","","num"],["×","","×","","num"],["÷","","÷","","num"],
  ["1","","1","","num"],["2","","2","","num"],["3","","3","","num"],["+","","+","","num"],["−","","-","","num"],
  ["0","","0","","num"],[".","","." ,"","num"],["×10ˣ","","*10^","","num"],["(−)","","-","","num"],["=","","=eq","","eq"],
];
KEYS.forEach(([lab,sh,act,sact,cls])=>{
  const w=document.createElement("div"); w.className="k "+(cls==="nav"?"nav ":"")+cls;
  if(sh){ const s=document.createElement("div"); s.className="sh"; s.textContent=sh; w.appendChild(s); }
  const b=document.createElement("button"); b.textContent=lab; b.dataset.act=act; b.dataset.sact=sact||act;
  b.setAttribute("aria-label", lab); w.appendChild(b); pad.appendChild(w);
  if(act==="=shift") w.id="shiftKey";
});

function insert(t){
  const s=exprEl.selectionStart??exprEl.value.length, e=exprEl.selectionEnd??s, v=exprEl.value;
  exprEl.value=v.slice(0,s)+t+v.slice(e); const pos=s+t.length; exprEl.setSelectionRange(pos,pos); exprEl.focus(); preview();
}
function preview(){
  resEl.className="";
  const v=exprEl.value.trim(); if(!v){ resEl.textContent="0"; return; }
  try{ resEl.textContent=fmt(evaluate(v)); }catch{ resEl.textContent=""; }
}
function commit(){
  const v=exprEl.value.trim(); if(!v) return;
  try{ const r=evaluate(v); state.ans=r; hist.push(v); hIdx=hist.length; resEl.textContent=fmt(r); resEl.className=""; exprEl.select(); }
  catch(err){ resEl.textContent=err.message; resEl.className="err"; }
}
function cur(){ try{ return evaluate(exprEl.value||"0"); }catch{ return null; } }
function recall(d){ if(!hist.length) return; hIdx=Math.max(0,Math.min(hist.length,hIdx+d)); exprEl.value=hist[hIdx]||""; preview(); }
function moveCursor(d){ const p=Math.max(0,exprEl.selectionStart+d); exprEl.focus(); exprEl.setSelectionRange(p,p); }
function indicators(){
  $("iS").classList.toggle("on",state.shift); $("iD").classList.toggle("on",state.deg);
  $("iR").classList.toggle("on",!state.deg); $("iM").classList.toggle("on",state.mem!==0);
  $("shiftKey").classList.toggle("on",state.shift);
}
const CMD = {
  eq:commit,
  ac:()=>{ exprEl.value=""; preview(); exprEl.focus(); },
  del:()=>{ const s=exprEl.selectionStart; if(s>0){ exprEl.value=exprEl.value.slice(0,s-1)+exprEl.value.slice(exprEl.selectionEnd); exprEl.setSelectionRange(s-1,s-1);} exprEl.focus(); preview(); },
  shift:()=>{ state.shift=!state.shift; },
  drg:()=>{ state.deg=!state.deg; preview(); },
  left:()=>moveCursor(-1), right:()=>moveCursor(1), up:()=>recall(-1), down:()=>recall(1),
  mr:()=>insert(fmt(state.mem)), mc:()=>{ state.mem=0; },
  mp:()=>{ const v=cur(); if(v!==null) state.mem+=v; }, mm:()=>{ const v=cur(); if(v!==null) state.mem-=v; },
};
pad.addEventListener("click",e=>{
  const b=e.target.closest("button"); if(!b) return;
  const wasShift = state.shift && b.dataset.act!=="=shift";
  const a = wasShift ? b.dataset.sact : b.dataset.act;
  if(a.startsWith("=")&&a.length>1) CMD[a.slice(1)](); else insert(a);
  if(wasShift) state.shift=false;
  indicators();
});
exprEl.addEventListener("input",preview);
exprEl.addEventListener("keydown",e=>{
  if(e.key==="Enter"){ e.preventDefault(); commit(); }
  else if(e.key==="Escape") CMD.ac();
  else if(e.key==="ArrowUp"){ e.preventDefault(); recall(-1); }
  else if(e.key==="ArrowDown"){ e.preventDefault(); recall(1); }
});
indicators(); preview();

/* ---------- PWA: offline support ---------- */
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
