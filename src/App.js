import { useState, useEffect } from "react";

const CATEGORIES = [
  { id: "food", label: "🍔 Alimentação", color: "#f97316" },
  { id: "transport", label: "🚌 Transporte", color: "#3b82f6" },
  { id: "housing", label: "🏠 Moradia", color: "#8b5cf6" },
  { id: "health", label: "💊 Saúde", color: "#10b981" },
  { id: "leisure", label: "🎮 Lazer", color: "#ec4899" },
  { id: "education", label: "📚 Educação", color: "#f59e0b" },
  { id: "clothing", label: "👕 Vestuário", color: "#6366f1" },
  { id: "other", label: "📦 Outros", color: "#64748b" },
];

const getCatById = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[7];

const MONTHS_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function getMonthKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatBRL(n) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function App() {
  const [expenses, setExpenses] = useState(() => {
    try { return JSON.parse(localStorage.getItem("cynfinance_gastos") || "[]"); } catch { return []; }
  });
  const [budgets, setBudgets] = useState(() => {
    try { return JSON.parse(localStorage.getItem("cynfinance_budgets") || "{}"); } catch { return {}; }
  });
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const [form, setForm] = useState({ desc: "", amount: "", category: "food", date: new Date().toISOString().slice(0, 10) });
  const [view, setView] = useState("list");
  const [analysis, setAnalysis] = useState("");
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(getMonthKey(new Date()));
  const [toast, setToast] = useState("");

  useEffect(() => { localStorage.setItem("cynfinance_gastos", JSON.stringify(expenses)); }, [expenses]);
  useEffect(() => { localStorage.setItem("cynfinance_budgets", JSON.stringify(budgets)); }, [budgets]);

  const currentBudget = budgets[selectedMonth] ?? null;

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const saveBudget = () => {
    const val = parseFloat(budgetInput);
    if (isNaN(val) || val <= 0) { showToast("Digite um valor válido!"); return; }
    setBudgets((b) => ({ ...b, [selectedMonth]: val }));
    setEditingBudget(false);
    setBudgetInput("");
    showToast("Orçamento salvo! ✓");
  };

  const addExpense = () => {
    if (!form.desc.trim() || !form.amount || isNaN(parseFloat(form.amount))) {
      showToast("Preencha descrição e valor!");
      return;
    }
    setExpenses((prev) => [{ id: Date.now(), desc: form.desc.trim(), amount: parseFloat(form.amount), category: form.category, date: form.date }, ...prev]);
    setForm((f) => ({ ...f, desc: "", amount: "" }));
    showToast("Gasto adicionado! ✓");
  };

  const removeExpense = (id) => setExpenses((prev) => prev.filter((e) => e.id !== id));

  const monthExpenses = expenses.filter((e) => getMonthKey(e.date) === selectedMonth);
  const total = monthExpenses.reduce((s, e) => s + e.amount, 0);

  const byCategory = CATEGORIES.map((cat) => {
    const items = monthExpenses.filter((e) => e.category === cat.id);
    return { ...cat, total: items.reduce((s, e) => s + e.amount, 0), count: items.length };
  }).filter((c) => c.total > 0).sort((a, b) => b.total - a.total);

  const availableMonths = [...new Set(expenses.map((e) => getMonthKey(e.date)))].sort().reverse();
  if (!availableMonths.includes(selectedMonth)) availableMonths.unshift(selectedMonth);

  const monthLabel = (mk) => {
    const [y, m] = mk.split("-");
    return `${MONTHS_PT[parseInt(m) - 1]} ${y}`;
  };

  const runAnalysis = async () => {
    if (monthExpenses.length === 0) { showToast("Sem gastos neste mês para analisar."); return; }
    setView("analysis");
    setLoadingAnalysis(true);
    setAnalysis("");

    const [year, month] = selectedMonth.split("-");
    const monthName = MONTHS_PT[parseInt(month) - 1];
    const balance = currentBudget !== null ? currentBudget - total : null;
    const summary = byCategory.map((c) => `- ${c.label}: ${formatBRL(c.total)} (${c.count} lançamentos)`).join("\n");

    const prompt = `Você é um consultor financeiro pessoal amigável do app CynFinance. Analise os gastos de ${monthName}/${year}:

ORÇAMENTO DO MÊS: ${currentBudget !== null ? formatBRL(currentBudget) : "Não informado"}
TOTAL GASTO: ${formatBRL(total)}
SALDO RESTANTE: ${balance !== null ? formatBRL(balance) : "N/A"}${balance !== null && balance < 0 ? " ⚠️ ORÇAMENTO ESTOURADO" : ""}

GASTOS POR CATEGORIA:
${summary}

LANÇAMENTOS DETALHADOS:
${monthExpenses.map((e) => `- ${e.date} | ${getCatById(e.category).label}: ${e.desc} — ${formatBRL(e.amount)}`).join("\n")}

Faça uma análise completa em português do Brasil com:
1. 📊 Resumo geral do mês
2. 🔍 O que mais chamou atenção (pontos de atenção nos gastos)
3. 💡 3 dicas práticas e personalizadas para economizar no próximo mês
4. ⭐ Um ponto positivo que o usuário deve manter

Seja direto, use emojis, e fale de forma pessoal e motivadora. Máximo 400 palavras.`;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await response.json();
      setAnalysis(data.content?.map((b) => b.text || "").join("") || "Erro ao gerar análise.");
    } catch {
      setAnalysis("❌ Não foi possível conectar à IA. Tente novamente.");
    } finally {
      setLoadingAnalysis(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f13", color: "#f1f0ee", fontFamily: "'DM Sans', sans-serif", padding: "0 0 80px 0" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet" />

      <div style={{ background: "linear-gradient(135deg, #1a1a24 0%, #12121a 100%)", borderBottom: "1px solid #2a2a3a", padding: "20px 20px 0", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: 3, color: "#6b6b8a", textTransform: "uppercase", marginBottom: 2 }}>Controle Financeiro</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700, color: "#f1f0ee" }}>
                Cyn<span style={{ color: "#a78bfa" }}>Finance</span>
              </div>
            </div>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
              style={{ background: "#1e1e2e", border: "1px solid #2a2a3a", color: "#f1f0ee", padding: "6px 10px", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>
              {availableMonths.map((mk) => <option key={mk} value={mk}>{monthLabel(mk)}</option>)}
            </select>
          </div>

          {(() => {
            const balance = currentBudget !== null ? currentBudget - total : null;
            const pct = currentBudget ? Math.min((total / currentBudget) * 100, 100) : 0;
            const overBudget = balance !== null && balance < 0;
            return (
              <div style={{ background: overBudget ? "linear-gradient(135deg, #7f1d1d, #991b1b)" : "linear-gradient(135deg, #7c3aed, #4f46e5)", borderRadius: "14px 14px 0 0", padding: "16px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, opacity: 0.75, marginBottom: 2 }}>Total gasto</div>
                    <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "'Playfair Display', serif" }}>{formatBRL(total)}</div>
                    <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>{monthExpenses.length} lançamento{monthExpenses.length !== 1 ? "s" : ""}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, opacity: 0.75, marginBottom: 2 }}>Orçamento</div>
                    {editingBudget ? (
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input autoFocus type="number" placeholder="0,00" value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveBudget()}
                          style={{ width: 90, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", borderRadius: 6, padding: "4px 8px", fontSize: 14, textAlign: "right" }} />
                        <button onClick={saveBudget} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 13 }}>✓</button>
                        <button onClick={() => setEditingBudget(false)} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 13 }}>✕</button>
                      </div>
                    ) : (
                      <div onClick={() => { setEditingBudget(true); setBudgetInput(currentBudget ?? ""); }} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                        <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Playfair Display', serif" }}>{currentBudget !== null ? formatBRL(currentBudget) : "—"}</div>
                        <span style={{ fontSize: 12, opacity: 0.6 }}>✏️</span>
                      </div>
                    )}
                    {balance !== null && (
                      <div style={{ marginTop: 4, fontSize: 12, background: "rgba(255,255,255,0.15)", borderRadius: 12, padding: "2px 8px", display: "inline-block", fontWeight: 600 }}>
                        {overBudget ? "⚠️ " : "✅ "}Saldo: {formatBRL(balance)}
                      </div>
                    )}
                  </div>
                </div>
                {currentBudget !== null ? (
                  <div>
                    <div style={{ height: 6, background: "rgba(255,255,255,0.2)", borderRadius: 6 }}>
                      <div style={{ height: 6, borderRadius: 6, background: overBudget ? "#fca5a5" : "rgba(255,255,255,0.8)", width: `${pct}%`, transition: "width 0.4s ease" }} />
                    </div>
                    <div style={{ fontSize: 10, opacity: 0.65, marginTop: 4, textAlign: "right" }}>{pct.toFixed(0)}% do orçamento usado</div>
                  </div>
                ) : !editingBudget && (
                  <div onClick={() => setEditingBudget(true)} style={{ fontSize: 12, opacity: 0.7, cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted" }}>
                    + Definir orçamento do mês
                  </div>
                )}
              </div>
            );
          })()}

          <div style={{ display: "flex" }}>
            {[{ id: "list", label: "📋 Lançamentos" }, { id: "analysis", label: "🤖 Análise IA" }].map((tab) => (
              <button key={tab.id} onClick={() => tab.id === "analysis" ? runAnalysis() : setView("list")}
                style={{ flex: 1, padding: "12px 0", border: "none", cursor: "pointer", background: view === tab.id ? "#0f0f13" : "transparent", color: view === tab.id ? "#a78bfa" : "#6b6b8a", fontWeight: view === tab.id ? 600 : 400, fontSize: 13, borderBottom: view === tab.id ? "2px solid #7c3aed" : "2px solid transparent", transition: "all 0.2s" }}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 16px" }}>
        {view === "list" && (
          <>
            <div style={{ background: "#1a1a24", borderRadius: 14, padding: 16, margin: "16px 0 12px", border: "1px solid #2a2a3a" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#a78bfa", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>+ Novo Gasto</div>
              <input placeholder="Descrição (ex: Almoço no restaurante)" value={form.desc} onChange={(e) => setForm((f) => ({ ...f, desc: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && addExpense()}
                style={{ width: "100%", background: "#12121a", border: "1px solid #2a2a3a", color: "#f1f0ee", borderRadius: 8, padding: "10px 12px", fontSize: 14, marginBottom: 10, boxSizing: "border-box" }} />
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <input placeholder="R$ 0,00" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} type="number" onKeyDown={(e) => e.key === "Enter" && addExpense()}
                  style={{ flex: 1, background: "#12121a", border: "1px solid #2a2a3a", color: "#f1f0ee", borderRadius: 8, padding: "10px 12px", fontSize: 14 }} />
                <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  style={{ flex: 1, background: "#12121a", border: "1px solid #2a2a3a", color: "#f1f0ee", borderRadius: 8, padding: "10px 12px", fontSize: 13, colorScheme: "dark" }} />
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                {CATEGORIES.map((cat) => (
                  <button key={cat.id} onClick={() => setForm((f) => ({ ...f, category: cat.id }))}
                    style={{ padding: "5px 10px", borderRadius: 20, fontSize: 12, cursor: "pointer", border: form.category === cat.id ? `2px solid ${cat.color}` : "2px solid transparent", background: form.category === cat.id ? `${cat.color}22` : "#12121a", color: form.category === cat.id ? cat.color : "#6b6b8a", fontWeight: form.category === cat.id ? 600 : 400, transition: "all 0.15s" }}>
                    {cat.label}
                  </button>
                ))}
              </div>
              <button onClick={addExpense} style={{ width: "100%", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", color: "#fff", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
                Adicionar Gasto
              </button>
            </div>

            {byCategory.length > 0 && (
              <div style={{ background: "#1a1a24", borderRadius: 14, padding: 16, marginBottom: 12, border: "1px solid #2a2a3a" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#6b6b8a", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>Por Categoria</div>
                {byCategory.map((cat) => (
                  <div key={cat.id} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13 }}>
                      <span>{cat.label}</span>
                      <span style={{ color: cat.color, fontWeight: 600 }}>{formatBRL(cat.total)}</span>
                    </div>
                    <div style={{ height: 4, background: "#12121a", borderRadius: 4 }}>
                      <div style={{ height: 4, borderRadius: 4, background: cat.color, width: `${(cat.total / total) * 100}%`, transition: "width 0.4s ease" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {monthExpenses.length === 0 ? (
              <div style={{ textAlign: "center", color: "#6b6b8a", padding: "40px 0", fontSize: 15 }}>
                Nenhum gasto em {monthLabel(selectedMonth)}.<br /><span style={{ fontSize: 30 }}>💸</span>
              </div>
            ) : monthExpenses.map((e) => {
              const cat = getCatById(e.category);
              return (
                <div key={e.id} style={{ background: "#1a1a24", borderRadius: 12, padding: "12px 14px", marginBottom: 8, border: "1px solid #2a2a3a", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: `${cat.color}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                    {cat.label.split(" ")[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.desc}</div>
                    <div style={{ fontSize: 12, color: "#6b6b8a" }}>{new Date(e.date + "T12:00:00").toLocaleDateString("pt-BR")}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, color: cat.color, fontSize: 15 }}>{formatBRL(e.amount)}</div>
                    <button onClick={() => removeExpense(e.id)} style={{ background: "none", border: "none", color: "#3a3a4a", cursor: "pointer", fontSize: 13, marginTop: 2 }}>✕</button>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {view === "analysis" && (
          <div style={{ paddingTop: 16 }}>
            {loadingAnalysis ? (
              <div style={{ textAlign: "center", padding: "60px 0" }}>
                <div style={{ fontSize: 40, marginBottom: 16, animation: "spin 1.5s linear infinite" }}>⟳</div>
                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                <div style={{ color: "#a78bfa", fontSize: 15, fontWeight: 500 }}>Analisando seus gastos...</div>
                <div style={{ color: "#6b6b8a", fontSize: 13, marginTop: 6 }}>A IA está preparando sua análise</div>
              </div>
            ) : analysis ? (
              <div style={{ background: "#1a1a24", borderRadius: 14, padding: 20, border: "1px solid #2a2a3a" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #7c3aed, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🤖</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Análise de {monthLabel(selectedMonth)}</div>
                    <div style={{ fontSize: 12, color: "#6b6b8a" }}>Gerada por CynFinance IA</div>
                  </div>
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.7, color: "#d4d4e8", whiteSpace: "pre-wrap" }}>{analysis}</div>
                <button onClick={runAnalysis} style={{ marginTop: 16, background: "#12121a", border: "1px solid #2a2a3a", color: "#a78bfa", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer", fontWeight: 500 }}>
                  🔄 Gerar novamente
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#7c3aed", color: "#fff", borderRadius: 20, padding: "10px 20px", fontSize: 14, fontWeight: 500, boxShadow: "0 4px 20px rgba(124,58,237,0.4)", zIndex: 999, animation: "fadeIn 0.2s ease" }}>
          <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateX(-50%) translateY(10px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }`}</style>
          {toast}
        </div>
      )}
    </div>
  );
}
