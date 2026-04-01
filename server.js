const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// ヘルスチェック
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", system: "REALIFE Management System", version: "1.0.0" });
});

// ---- 案件 (projects) ----
app.get("/api/projects", async (req, res) => {
  const { status, limit = 50, offset = 0 } = req.query;
  let q = supabase.from("projects").select("*").order("created_at", { ascending: false }).range(Number(offset), Number(offset) + Number(limit) - 1);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data });
});

app.get("/api/projects/:id", async (req, res) => {
  const { data, error } = await supabase.from("projects").select("*").eq("id", req.params.id).single();
  if (error) return res.status(404).json({ error: error.message });
  res.json({ data });
});

app.post("/api/projects", async (req, res) => {
  const { data, error } = await supabase.from("projects").insert(req.body).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ data });
});

app.patch("/api/projects/:id", async (req, res) => {
  const { data, error } = await supabase.from("projects").update(req.body).eq("id", req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ data });
});

// ---- 見積 (estimates) ----
app.get("/api/estimates", async (req, res) => {
  const { project_id } = req.query;
  let q = supabase.from("estimates").select("*, projects(name, customer_name)").order("created_at", { ascending: false });
  if (project_id) q = q.eq("project_id", project_id);
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data });
});

app.get("/api/estimates/:id/nodes", async (req, res) => {
  const { data, error } = await supabase.from("estimate_nodes").select("*").eq("estimate_id", req.params.id).order("sort_order");
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data });
});

app.post("/api/estimates", async (req, res) => {
  const { data, error } = await supabase.from("estimates").insert(req.body).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ data });
});

// ---- 発注 (purchase_orders) ----
app.get("/api/purchase-orders", async (req, res) => {
  const { data, error } = await supabase.from("purchase_orders").select("*, suppliers(name), estimates(estimate_no)").order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data });
});

app.post("/api/purchase-orders", async (req, res) => {
  const { data, error } = await supabase.from("purchase_orders").insert(req.body).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ data });
});

// ---- 請求 (invoices) ----
app.get("/api/invoices", async (req, res) => {
  const { status } = req.query;
  let q = supabase.from("invoices").select("*").order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data });
});

// ---- 顧客 (customers) ----
app.get("/api/customers", async (req, res) => {
  const { data, error } = await supabase.from("customers").select("*").order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data });
});

// ---- 仕入先 (suppliers) ----
app.get("/api/suppliers", async (req, res) => {
  const { data, error } = await supabase.from("suppliers").select("*").order("name");
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data });
});

// ---- ダッシュボード集計 ----
app.get("/api/dashboard", async (req, res) => {
  const [projects, estimates, invoices, orders] = await Promise.all([
    supabase.from("projects").select("id, status, estimate_total, gross_profit, gross_margin"),
    supabase.from("estimates").select("id, status"),
    supabase.from("invoices").select("id, status, total_amount"),
    supabase.from("purchase_orders").select("id, status"),
  ]);

  const activeProjects = (projects.data || []).filter(p => p.status === "active");
  const monthSales = (projects.data || []).reduce((s, p) => s + Number(p.estimate_total || 0), 0);
  const draftEstimates = (estimates.data || []).filter(e => e.status === "draft").length;
  const unpaidInvoices = (invoices.data || []).filter(i => ["発行済", "入金確認中"].includes(i.status));
  const unpaidAmount = unpaidInvoices.reduce((s, i) => s + Number(i.total_amount || 0), 0);
  const avgMargin = activeProjects.length
    ? (activeProjects.reduce((s, p) => s + Number(p.gross_margin || 0), 0) / activeProjects.length).toFixed(1)
    : 0;

  res.json({
    active_projects: activeProjects.length,
    month_sales: monthSales,
    draft_estimates: draftEstimates,
    unpaid_invoices: unpaidInvoices.length,
    unpaid_amount: unpaidAmount,
    avg_gross_margin: avgMargin,
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`REALIFE管理システム起動 ポート:${PORT}`);
});
