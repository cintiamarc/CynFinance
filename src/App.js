import { useState, useEffect } from "react";

// ── CURRENCIES ──────────────────────────────────────────────────────────────
const CURRENCIES = [
  { code: "BRL", symbol: "R$", locale: "pt-BR" },
  { code: "EUR", symbol: "€",  locale: "de-DE" },
  { code: "USD", symbol: "$",  locale: "en-US" },
];

// ── CATEGORIES ───────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: "food",      label: "🍔 Alimentação", color: "#f97316" },
  { id: "transport", label: "🚌 Transporte",  color: "#3b82f6" },
  { id: "housing",   label: "🏠 Moradia",     color: "#8b5cf6" },
  { id: "health",    label: "💊 Saúde",       color: "#10b981" },
  { id: "leisure",   label: "🎮 Lazer",       color: "#ec4899" },
  { id: "education", label: "📚 Educação",    color: "#f59e0b" },
  { id: "clothing",  label: "👕 Vestuário",   color: "#6366f1" },
  { id: "other",     label: "📦 Outros",      color: "#64748b" },
];

const MONTHS_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

// ── PAYMENT SOURCES ──────────────────────────────────────────────────────────
const SOURCES = [
  { id: "account", label: "🏦 Conta",     color: "#10b981" },
  { id: "card1",   label: "💳 Cartão 1",  color: "#3b82f6" },
  { id: "card2",   label: "💳 Cartão 2",  color: "#a855f7" },
];

// ── HELPERS ──────────────────────────────────────────────────────────────────
const getCatById  = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[7];
const getSrcById  = (id) => SOURCES.find((s) => s.id === id) || SOURCES[0];

function getMonthKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}

function formatMoney(n, currency) {
  return n.toLocaleString(currency.locale, { style: "currency", currency: currency.code });
}

const DEFAULT_FINANCES = {
  accountBalance: 0,
  savingsBalance: 0,
  card1Limit: 0,
  card1Spent: 0,
  card2Limit: 0,
  card2Spent: 0,
  card1Name: "Cartão 1",
  card2Name: "Cartão 2",
  accountName: "Conta Corrente",
};

// ── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const load = (key, def) => { try { return JSON.parse(localStorage.getItem(key) ?? "null") ?? def; } catch { return def; } };

  const [expenses,   setExpenses]   = useState(() => load("cf_expenses", []));
  const [budgets,    setBudgets]    = useState(() => load("cf_budgets", {}));
  const [finances,   setFinances]   = useState(() => load("cf_finances", DEFAULT_FINANCES));
  const [currencyIdx,setCurrencyIdx]= useState(() => load("cf_currency", 0));
  const [selectedMonth, setSelectedMonth] = useState(getMonthKey(new Date()));
  const [view, setView]             = useState("dashboard"); // dashboard | list | analysis | settings
  const [form, setForm]             = useState({ desc:"", amount:"", category:"food", source:"account", date: new Date().toISOString().slice(0,10) });
  const [analysis, setAnalysis]     = useState("");
  const [loadingAI, setLoadingAI]   = useState(false);
  const [toast, setToast]           = useState("");
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput,   setBudgetInput]   = useState("");

  const currency = CURRENCIES[currencyIdx];
  const fmt = (n) => formatMoney(n, currency);

  useEffect(() => { localStorage.setItem("cf_expenses",  JSON.stringify(expenses));   }, [expenses]);
  useEffect(() => { localStorage.setItem("cf_budgets",   JSON.stringify(budgets));    }, [budgets]);
  useEffect(() => { localStorage.setItem("cf_finances",  JSON.stringify(finances));   }, [finances]);
  useEffect(() => { localStorage.setItem("cf_currency",  JSON.stringify(currencyIdx));}, [currencyIdx]);

  const showToast = (msg) => { setToast(msg); setTimeout(()=>setToast(""),2500); };

  const monthExpenses = expenses.filter(e => getMonthKey(e.date) === selectedMonth);
  const total = monthExpenses.reduce((s,e) => s+e.amount, 0);
  const currentBudget = budgets[selectedMonth] ?? null;
  const balance = currentBudget !== null ? currentBudget - total : null;
  const overBudget = balance !== null && balance < 0;

  const byCategory = CATEGORIES.map(cat => {
    const items = monthExpenses.filter(e => e.category === cat.id);
    return { ...cat, total: items.reduce((s,e)=>s+e.amount,0), count: items.length };
  }).filter(c=>c.total>0).sort((a,b)=>b.total-a.total);

  const bySource = SOURCES.map(src => {
    const items = monthExpenses.filter(e => e.source === src.id);
    return { ...src, total: items.reduce((s,e)=>s+e.amount,0), count: items.length };
  }).filter(s=>s.total>0);

  const availableMonths = [...new Set(expenses.map(e=>getMonthKey(e.date)))].sort().reverse();
  if (!availableMonths.includes(selectedMonth)) availableMonths.unshift(selectedMonth);

  const monthLabel = (mk) => { const [y,m]=mk.split("-"); return `${MONTHS_PT[parseInt(m)-1]} ${y}`; };

  const addExpense = () => {
    if (!form.desc.trim() || !form.amount || isNaN(parseFloat(form.amount))) { showToast("Preencha descrição e valor!"); return; }
    const amt = parseFloat(form.amount);
    setExpenses(prev => [{ id:Date.now(), desc:form.desc.trim(), amount:amt, category:form.category, source:form.source, date:form.date }, ...prev]);
    // update card spent
    if (form.source === "card1") setFinances(f => ({ ...f, card1Spent: (f.card1Spent||0)+amt }));
    if (form.source === "card2") setFinances(f => ({ ...f, card2Spent: (f.card2Spent||0)+amt }));
    if (form.source === "account") setFinances(f => ({ ...f, accountBalance: (f.accountBalance||0)-amt }));
    setForm(f=>({...f, desc:"", amount:""}));
    showToast("Gasto adicionado! ✓");
  };

  const removeExpense = (id) => {
    const exp = expenses.find(e=>e.id===id);
    if (exp) {
      if (exp.source==="card1") setFinances(f=>({...f, card1Spent: Math.max(0,(f.card1Spent||0)-exp.amount)}));
      if (exp.source==="card2") setFinances(f=>({...f, card2Spent: Math.max(0,(f.card2Spent||0)-exp.amount)}));
      if (exp.source==="account") setFinances(f=>({...f, accountBalance:(f.accountBalance||0)+exp.amount}));
    }
    setExpenses(prev=>prev.filter(e=>e.id!==id));
  };

  const saveBudget = () => {
    const val = parseFloat(budgetInput);
    if (isNaN(val)||val<=0) { showToast("Digite um valor válido!"); return; }
    setBudgets(b=>({...b,[selectedMonth]:val}));
    setEditingBudget(false); setBudgetInput(""); showToast("Orçamento salvo! ✓");
  };

  const runAnalysis = async () => {
    if (monthExpenses.length===0) { showToast("Sem gastos neste mês para analisar."); return; }
    setView("analysis"); setLoadingAI(true); setAnalysis("");
    const [year,month] = selectedMonth.split("-");
    const monthName = MONTHS_PT[parseInt(month)-1];
    const bal = currentBudget!==null ? currentBudget-total : null;
    const catSummary = byCategory.map(c=>`- ${c.label}: ${fmt(c.total)} (${c.count} lançamentos)`).join("\n");
    const srcSummary = bySource.map(s=>`- ${s.label}: ${fmt(s.total)}`).join("\n");
    const prompt = `Você é consultor financeiro do app CynFinance. Analise ${monthName}/${year}:

MOEDA: ${currency.code}
ORÇAMENTO: ${currentBudget!==null?fmt(currentBudget):"Não definido"}
TOTAL GASTO: ${fmt(total)}
SALDO ORÇAMENTO: ${bal!==null?fmt(bal):"N/A"}${bal!==null&&bal<0?" ⚠️ ESTOURADO":""}

CONTA CORRENTE (${finances.accountName}): ${fmt(finances.accountBalance)}
POUPANÇA: ${fmt(finances.savingsBalance)}
${finances.card1Name}: fatura ${fmt(finances.card1Spent)} / limite ${fmt(finances.card1Limit)}
${finances.card2Name}: fatura ${fmt(finances.card2Spent)} / limite ${fmt(finances.card2Limit)}

GASTOS POR CATEGORIA:
${catSummary}

GASTOS POR FONTE DE PAGAMENTO:
${srcSummary}

LANÇAMENTOS:
${monthExpenses.map(e=>`- ${e.date} | ${getCatById(e.category).label} | ${getSrcById(e.source).label}: ${e.desc} — ${fmt(e.amount)}`).join("\n")}

Analise em português com:
1. 📊 Resumo geral
2. 💳 Uso dos cartões e conta (riscos, oportunidades)
3. 🐷 Comentário sobre a poupança em relação aos gastos
4. 💡 3 dicas personalizadas
5. ⭐ Um ponto positivo

Use emojis, seja direto e motivador. Máximo 450 palavras.`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000, messages:[{role:"user",content:prompt}] })
      });
      const data = await res.json();
      setAnalysis(data.content?.map(b=>b.text||"").join("")||"Erro ao gerar análise.");
    } catch { setAnalysis("❌ Não foi possível conectar à IA."); }
    finally { setLoadingAI(false); }
  };

  // ── STYLES ────────────────────────────────────────────────────────────────
  const card = { background:"#1a1a24", borderRadius:14, padding:16, marginBottom:12, border:"1px solid #2a2a3a" };
  const input = { background:"#12121a", border:"1px solid #2a2a3a", color:"#f1f0ee", borderRadius:8, padding:"10px 12px", fontSize:14, width:"100%", boxSizing:"border-box" };

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh", background:"#0f0f13", color:"#f1f0ee", fontFamily:"'DM Sans',sans-serif", paddingBottom:80 }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet"/>
      <style>{`
        select option { background:#1a1a24; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance:none; }
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateX(-50%) translateY(10px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ background:"linear-gradient(135deg,#1a1a24,#12121a)", borderBottom:"1px solid #2a2a3a", padding:"16px 16px 0", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ maxWidth:480, margin:"0 auto" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:700 }}>
              Cyn<span style={{ color:"#a78bfa" }}>Finance</span>
            </div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              {/* Currency picker */}
              <div style={{ display:"flex", gap:4 }}>
                {CURRENCIES.map((c,i)=>(
                  <button key={c.code} onClick={()=>setCurrencyIdx(i)} style={{ padding:"4px 8px", borderRadius:6, fontSize:12, cursor:"pointer", border:"none", background: currencyIdx===i?"#7c3aed":"#1e1e2e", color: currencyIdx===i?"#fff":"#6b6b8a", fontWeight:600 }}>{c.symbol}</button>
                ))}
              </div>
              <select value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)}
                style={{ background:"#1e1e2e", border:"1px solid #2a2a3a", color:"#f1f0ee", padding:"5px 8px", borderRadius:8, fontSize:12, cursor:"pointer" }}>
                {availableMonths.map(mk=><option key={mk} value={mk}>{monthLabel(mk)}</option>)}
              </select>
            </div>
          </div>

          {/* Budget bar */}
          <div style={{ background: overBudget?"linear-gradient(135deg,#7f1d1d,#991b1b)":"linear-gradient(135deg,#7c3aed,#4f46e5)", borderRadius:"12px 12px 0 0", padding:"14px 16px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
              <div>
                <div style={{ fontSize:10, opacity:.7, marginBottom:2 }}>Total gasto</div>
                <div style={{ fontSize:24, fontWeight:700, fontFamily:"'Playfair Display',serif" }}>{fmt(total)}</div>
                <div style={{ fontSize:11, opacity:.6 }}>{monthExpenses.length} lançamento{monthExpenses.length!==1?"s":""}</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:10, opacity:.7, marginBottom:2 }}>Orçamento</div>
                {editingBudget ? (
                  <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                    <input autoFocus type="number" value={budgetInput} onChange={e=>setBudgetInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveBudget()}
                      style={{ width:80, background:"rgba(255,255,255,.15)", border:"1px solid rgba(255,255,255,.3)", color:"#fff", borderRadius:6, padding:"3px 6px", fontSize:13, textAlign:"right" }}/>
                    <button onClick={saveBudget} style={{ background:"rgba(255,255,255,.2)", border:"none", color:"#fff", borderRadius:6, padding:"3px 8px", cursor:"pointer" }}>✓</button>
                    <button onClick={()=>setEditingBudget(false)} style={{ background:"transparent", border:"none", color:"rgba(255,255,255,.6)", cursor:"pointer" }}>✕</button>
                  </div>
                ) : (
                  <div onClick={()=>{setEditingBudget(true);setBudgetInput(currentBudget??"");}} style={{ cursor:"pointer", display:"flex", alignItems:"center", gap:4, justifyContent:"flex-end" }}>
                    <div style={{ fontSize:16, fontWeight:700, fontFamily:"'Playfair Display',serif" }}>{currentBudget!==null?fmt(currentBudget):"—"}</div>
                    <span style={{ fontSize:11, opacity:.6 }}>✏️</span>
                  </div>
                )}
                {balance!==null&&<div style={{ marginTop:4, fontSize:11, background:"rgba(255,255,255,.15)", borderRadius:10, padding:"2px 8px", fontWeight:600 }}>{overBudget?"⚠️ ":"✅ "}Saldo: {fmt(balance)}</div>}
              </div>
            </div>
            {currentBudget!==null ? (
              <div>
                <div style={{ height:5, background:"rgba(255,255,255,.2)", borderRadius:4 }}>
                  <div style={{ height:5, borderRadius:4, background:overBudget?"#fca5a5":"rgba(255,255,255,.8)", width:`${Math.min((total/currentBudget)*100,100)}%`, transition:"width .4s" }}/>
                </div>
                <div style={{ fontSize:10, opacity:.6, marginTop:3, textAlign:"right" }}>{Math.min((total/currentBudget)*100,100).toFixed(0)}% usado</div>
              </div>
            ) : !editingBudget&&(
              <div onClick={()=>setEditingBudget(true)} style={{ fontSize:11, opacity:.7, cursor:"pointer", textDecoration:"underline dotted" }}>+ Definir orçamento</div>
            )}
          </div>

          {/* Tabs */}
          <div style={{ display:"flex" }}>
            {[
              {id:"dashboard", label:"🏠 Início"},
              {id:"list",      label:"📋 Gastos"},
              {id:"analysis",  label:"🤖 IA"},
              {id:"settings",  label:"⚙️ Contas"},
            ].map(tab=>(
              <button key={tab.id} onClick={()=>tab.id==="analysis"?runAnalysis():setView(tab.id)}
                style={{ flex:1, padding:"10px 0", border:"none", cursor:"pointer", background:view===tab.id?"#0f0f13":"transparent", color:view===tab.id?"#a78bfa":"#6b6b8a", fontWeight:view===tab.id?600:400, fontSize:11, borderBottom:view===tab.id?"2px solid #7c3aed":"2px solid transparent", transition:"all .2s" }}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ maxWidth:480, margin:"0 auto", padding:"0 16px" }}>

        {/* ── DASHBOARD ── */}
        {view==="dashboard"&&(
          <div style={{ paddingTop:16 }}>
            {/* Account cards */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
              <div style={{ ...card, marginBottom:0, background:"linear-gradient(135deg,#065f46,#047857)" }}>
                <div style={{ fontSize:10, opacity:.7, marginBottom:4 }}>🏦 {finances.accountName}</div>
                <div style={{ fontSize:20, fontWeight:700, fontFamily:"'Playfair Display',serif" }}>{fmt(finances.accountBalance)}</div>
                <div style={{ fontSize:10, opacity:.6, marginTop:2 }}>Saldo disponível</div>
              </div>
              <div style={{ ...card, marginBottom:0, background:"linear-gradient(135deg,#1e3a5f,#1d4ed8)" }}>
                <div style={{ fontSize:10, opacity:.7, marginBottom:4 }}>🐷 Poupança</div>
                <div style={{ fontSize:20, fontWeight:700, fontFamily:"'Playfair Display',serif" }}>{fmt(finances.savingsBalance)}</div>
                <div style={{ fontSize:10, opacity:.6, marginTop:2 }}>Guardado</div>
              </div>
            </div>

            {/* Cards */}
            {[
              { name:finances.card1Name, spent:finances.card1Spent, limit:finances.card1Limit, color:"#3b82f6" },
              { name:finances.card2Name, spent:finances.card2Spent, limit:finances.card2Limit, color:"#a855f7" },
            ].map((c,i)=>{
              const avail = (c.limit||0)-(c.spent||0);
              const pct = c.limit>0?Math.min((c.spent/c.limit)*100,100):0;
              const over = avail<0;
              return (
                <div key={i} style={{ ...card }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                    <div>
                      <div style={{ fontSize:10, opacity:.7, marginBottom:2 }}>💳 {c.name}</div>
                      <div style={{ fontSize:18, fontWeight:700, color:over?"#f87171":c.color }}>{fmt(c.spent)}</div>
                      <div style={{ fontSize:11, color:"#6b6b8a" }}>fatura atual</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:10, opacity:.7, marginBottom:2 }}>Disponível</div>
                      <div style={{ fontSize:18, fontWeight:700, color:over?"#f87171":"#10b981" }}>{fmt(Math.max(avail,0))}</div>
                      <div style={{ fontSize:11, color:"#6b6b8a" }}>de {fmt(c.limit)}</div>
                    </div>
                  </div>
                  <div style={{ height:4, background:"#12121a", borderRadius:4 }}>
                    <div style={{ height:4, borderRadius:4, background:over?"#f87171":c.color, width:`${pct}%`, transition:"width .4s" }}/>
                  </div>
                  <div style={{ fontSize:10, color:"#6b6b8a", marginTop:3, textAlign:"right" }}>{pct.toFixed(0)}% do limite usado</div>
                </div>
              );
            })}

            {/* Category summary */}
            {byCategory.length>0&&(
              <div style={{ ...card }}>
                <div style={{ fontSize:12, fontWeight:600, color:"#6b6b8a", marginBottom:12, textTransform:"uppercase", letterSpacing:1 }}>Por Categoria</div>
                {byCategory.map(cat=>(
                  <div key={cat.id} style={{ marginBottom:10 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4, fontSize:13 }}>
                      <span>{cat.label}</span>
                      <span style={{ color:cat.color, fontWeight:600 }}>{fmt(cat.total)}</span>
                    </div>
                    <div style={{ height:4, background:"#12121a", borderRadius:4 }}>
                      <div style={{ height:4, borderRadius:4, background:cat.color, width:`${(cat.total/total)*100}%`, transition:"width .4s" }}/>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Source summary */}
            {bySource.length>0&&(
              <div style={{ ...card }}>
                <div style={{ fontSize:12, fontWeight:600, color:"#6b6b8a", marginBottom:12, textTransform:"uppercase", letterSpacing:1 }}>Por Forma de Pagamento</div>
                {bySource.map(src=>(
                  <div key={src.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8, padding:"8px 10px", background:"#12121a", borderRadius:8 }}>
                    <span style={{ fontSize:13 }}>{src.label}</span>
                    <span style={{ color:src.color, fontWeight:700, fontSize:14 }}>{fmt(src.total)}</span>
                  </div>
                ))}
              </div>
            )}

            {monthExpenses.length===0&&(
              <div style={{ textAlign:"center", color:"#6b6b8a", padding:"40px 0" }}>
                Nenhum gasto em {monthLabel(selectedMonth)}.<br/><span style={{ fontSize:30 }}>💸</span>
              </div>
            )}
          </div>
        )}

        {/* ── ADD EXPENSE (list view) ── */}
        {view==="list"&&(
          <>
            <div style={{ ...card, marginTop:16 }}>
              <div style={{ fontSize:12, fontWeight:600, color:"#a78bfa", marginBottom:12, textTransform:"uppercase", letterSpacing:1 }}>+ Novo Gasto</div>
              <input placeholder="Descrição" value={form.desc} onChange={e=>setForm(f=>({...f,desc:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addExpense()} style={{ ...input, marginBottom:10 }}/>
              <div style={{ display:"flex", gap:8, marginBottom:10 }}>
                <input placeholder={`${currency.symbol} 0`} value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} type="number" style={{ ...input, flex:1 }}/>
                <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={{ ...input, flex:1, fontSize:13, colorScheme:"dark" }}/>
              </div>

              {/* Category */}
              <div style={{ fontSize:11, color:"#6b6b8a", marginBottom:6, textTransform:"uppercase", letterSpacing:1 }}>Categoria</div>
              <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:12 }}>
                {CATEGORIES.map(cat=>(
                  <button key={cat.id} onClick={()=>setForm(f=>({...f,category:cat.id}))}
                    style={{ padding:"4px 9px", borderRadius:16, fontSize:11, cursor:"pointer", border:form.category===cat.id?`2px solid ${cat.color}`:"2px solid transparent", background:form.category===cat.id?`${cat.color}22`:"#12121a", color:form.category===cat.id?cat.color:"#6b6b8a", fontWeight:form.category===cat.id?600:400, transition:"all .15s" }}>
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Source */}
              <div style={{ fontSize:11, color:"#6b6b8a", marginBottom:6, textTransform:"uppercase", letterSpacing:1 }}>Pago com</div>
              <div style={{ display:"flex", gap:8, marginBottom:14 }}>
                {SOURCES.map(src=>(
                  <button key={src.id} onClick={()=>setForm(f=>({...f,source:src.id}))}
                    style={{ flex:1, padding:"8px 0", borderRadius:10, fontSize:12, cursor:"pointer", border:form.source===src.id?`2px solid ${src.color}`:"2px solid transparent", background:form.source===src.id?`${src.color}22`:"#12121a", color:form.source===src.id?src.color:"#6b6b8a", fontWeight:form.source===src.id?600:400, transition:"all .15s" }}>
                    {src.label}
                  </button>
                ))}
              </div>

              <button onClick={addExpense} style={{ width:"100%", background:"linear-gradient(135deg,#7c3aed,#4f46e5)", color:"#fff", border:"none", borderRadius:10, padding:"12px 0", fontSize:15, fontWeight:600, cursor:"pointer" }}>
                Adicionar Gasto
              </button>
            </div>

            {/* Expense list */}
            {monthExpenses.length===0?(
              <div style={{ textAlign:"center", color:"#6b6b8a", padding:"30px 0" }}>Nenhum gasto este mês.<br/><span style={{ fontSize:28 }}>💸</span></div>
            ):monthExpenses.map(e=>{
              const cat=getCatById(e.category); const src=getSrcById(e.source);
              return (
                <div key={e.id} style={{ ...card, display:"flex", alignItems:"center", gap:10, padding:"12px 14px" }}>
                  <div style={{ width:36, height:36, borderRadius:10, background:`${cat.color}22`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>{cat.label.split(" ")[0]}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:500, fontSize:13, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{e.desc}</div>
                    <div style={{ fontSize:11, color:"#6b6b8a", marginTop:2 }}>
                      {new Date(e.date+"T12:00:00").toLocaleDateString("pt-BR")} · <span style={{ color:src.color }}>{src.label}</span>
                    </div>
                  </div>
                  <div style={{ textAlign:"right", flexShrink:0 }}>
                    <div style={{ fontWeight:700, color:cat.color, fontSize:14 }}>{fmt(e.amount)}</div>
                    <button onClick={()=>removeExpense(e.id)} style={{ background:"none", border:"none", color:"#3a3a4a", cursor:"pointer", fontSize:12 }}>✕</button>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* ── ANALYSIS ── */}
        {view==="analysis"&&(
          <div style={{ paddingTop:16 }}>
            {loadingAI?(
              <div style={{ textAlign:"center", padding:"60px 0" }}>
                <div style={{ fontSize:40, marginBottom:16, display:"inline-block", animation:"spin 1.5s linear infinite" }}>⟳</div>
                <div style={{ color:"#a78bfa", fontSize:15, fontWeight:500 }}>Analisando suas finanças...</div>
                <div style={{ color:"#6b6b8a", fontSize:13, marginTop:6 }}>A IA está preparando sua análise</div>
              </div>
            ):analysis?(
              <div style={{ ...card }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
                  <div style={{ width:36, height:36, borderRadius:10, background:"linear-gradient(135deg,#7c3aed,#4f46e5)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>🤖</div>
                  <div>
                    <div style={{ fontWeight:600, fontSize:14 }}>Análise de {monthLabel(selectedMonth)}</div>
                    <div style={{ fontSize:12, color:"#6b6b8a" }}>Gerada por CynFinance IA</div>
                  </div>
                </div>
                <div style={{ fontSize:14, lineHeight:1.7, color:"#d4d4e8", whiteSpace:"pre-wrap" }}>{analysis}</div>
                <button onClick={runAnalysis} style={{ marginTop:16, background:"#12121a", border:"1px solid #2a2a3a", color:"#a78bfa", borderRadius:8, padding:"8px 16px", fontSize:13, cursor:"pointer", fontWeight:500 }}>
                  🔄 Gerar novamente
                </button>
              </div>
            ):null}
          </div>
        )}

        {/* ── SETTINGS ── */}
        {view==="settings"&&(
          <div style={{ paddingTop:16 }}>
            <div style={{ ...card }}>
              <div style={{ fontSize:12, fontWeight:600, color:"#a78bfa", marginBottom:14, textTransform:"uppercase", letterSpacing:1 }}>⚙️ Configurar Contas</div>

              {/* Account */}
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, color:"#10b981", fontWeight:600, marginBottom:8 }}>🏦 Conta Corrente</div>
                <input placeholder="Nome da conta" value={finances.accountName} onChange={e=>setFinances(f=>({...f,accountName:e.target.value}))} style={{ ...input, marginBottom:8 }}/>
                <input placeholder={`Saldo atual (${currency.symbol})`} type="number" value={finances.accountBalance||""} onChange={e=>setFinances(f=>({...f,accountBalance:parseFloat(e.target.value)||0}))} style={{ ...input }}/>
              </div>

              {/* Savings */}
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, color:"#f59e0b", fontWeight:600, marginBottom:8 }}>🐷 Poupança</div>
                <input placeholder={`Saldo da poupança (${currency.symbol})`} type="number" value={finances.savingsBalance||""} onChange={e=>setFinances(f=>({...f,savingsBalance:parseFloat(e.target.value)||0}))} style={{ ...input }}/>
              </div>

              {/* Card 1 */}
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, color:"#3b82f6", fontWeight:600, marginBottom:8 }}>💳 Cartão 1</div>
                <input placeholder="Nome do cartão" value={finances.card1Name} onChange={e=>setFinances(f=>({...f,card1Name:e.target.value}))} style={{ ...input, marginBottom:8 }}/>
                <div style={{ display:"flex", gap:8 }}>
                  <input placeholder={`Limite (${currency.symbol})`} type="number" value={finances.card1Limit||""} onChange={e=>setFinances(f=>({...f,card1Limit:parseFloat(e.target.value)||0}))} style={{ ...input, flex:1 }}/>
                  <input placeholder={`Fatura atual (${currency.symbol})`} type="number" value={finances.card1Spent||""} onChange={e=>setFinances(f=>({...f,card1Spent:parseFloat(e.target.value)||0}))} style={{ ...input, flex:1 }}/>
                </div>
              </div>

              {/* Card 2 */}
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, color:"#a855f7", fontWeight:600, marginBottom:8 }}>💳 Cartão 2</div>
                <input placeholder="Nome do cartão" value={finances.card2Name} onChange={e=>setFinances(f=>({...f,card2Name:e.target.value}))} style={{ ...input, marginBottom:8 }}/>
                <div style={{ display:"flex", gap:8 }}>
                  <input placeholder={`Limite (${currency.symbol})`} type="number" value={finances.card2Limit||""} onChange={e=>setFinances(f=>({...f,card2Limit:parseFloat(e.target.value)||0}))} style={{ ...input, flex:1 }}/>
                  <input placeholder={`Fatura atual (${currency.symbol})`} type="number" value={finances.card2Spent||""} onChange={e=>setFinances(f=>({...f,card2Spent:parseFloat(e.target.value)||0}))} style={{ ...input, flex:1 }}/>
                </div>
              </div>

              <button onClick={()=>{showToast("Configurações salvas! ✓"); setView("dashboard");}} style={{ width:"100%", background:"linear-gradient(135deg,#7c3aed,#4f46e5)", color:"#fff", border:"none", borderRadius:10, padding:"12px 0", fontSize:15, fontWeight:600, cursor:"pointer" }}>
                Salvar e Voltar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast&&(
        <div style={{ position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)", background:"#7c3aed", color:"#fff", borderRadius:20, padding:"10px 20px", fontSize:14, fontWeight:500, boxShadow:"0 4px 20px rgba(124,58,237,.4)", zIndex:999, animation:"fadeUp .2s ease" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
