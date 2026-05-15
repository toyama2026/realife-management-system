#!/usr/bin/env node
/**
 * REALIFE 総合管理システム – MCP Server
 *
 * Model Context Protocol (MCP) サーバー。
 * Lovable / Claude Desktop など MCP 対応 AI ツールから
 * プロジェクト・見積・請求などのデータを読み書きできます。
 *
 * 起動方法:
 *   node mcp_server.js
 */

const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { createClient } = require("@supabase/supabase-js");
const { z } = require("zod");
require("dotenv").config();

let _supabase;
function getSupabase() {
  if (!_supabase) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
      throw new Error("SUPABASE_URL および SUPABASE_KEY 環境変数が必要です");
    }
    _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  }
  return _supabase;
}

const server = new McpServer({
  name: "realife-management-system",
  version: "1.1.0",
});

// ---- ダッシュボード集計 ----
server.tool(
  "get_dashboard",
  "ダッシュボードの集計データを取得します（進行中案件数、累計売上、未処理見積数、未入金件数、平均粗利率）",
  {},
  async () => {
    const [projects, estimates, invoices] = await Promise.all([
      getSupabase().from("projects").select("id, status, estimate_total, gross_profit, gross_margin"),
      getSupabase().from("estimates").select("id, status"),
      getSupabase().from("invoices").select("id, status, total_amount"),
    ]);
    const activeProjects = (projects.data || []).filter(p => p.status === "active");
    const monthSales = (projects.data || []).reduce((s, p) => s + Number(p.estimate_total || 0), 0);
    const draftEstimates = (estimates.data || []).filter(e => e.status === "draft").length;
    const unpaidInvoices = (invoices.data || []).filter(i => ["発行済", "入金確認中"].includes(i.status));
    const unpaidAmount = unpaidInvoices.reduce((s, i) => s + Number(i.total_amount || 0), 0);
    const avgMargin = activeProjects.length
      ? (activeProjects.reduce((s, p) => s + Number(p.gross_margin || 0), 0) / activeProjects.length).toFixed(1)
      : 0;
    const result = {
      active_projects: activeProjects.length,
      month_sales: monthSales,
      draft_estimates: draftEstimates,
      unpaid_invoices: unpaidInvoices.length,
      unpaid_amount: unpaidAmount,
      avg_gross_margin: avgMargin,
      total_projects: (projects.data || []).length,
    };
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ---- 案件 (projects) ----
server.tool(
  "get_projects",
  "案件一覧を取得します",
  {
    status: z.string().optional().describe("ステータスフィルタ (active / complete / lost)"),
    limit: z.number().int().min(1).max(200).optional().describe("取得件数上限（デフォルト50）"),
    offset: z.number().int().min(0).optional().describe("取得開始位置"),
  },
  async ({ status, limit = 50, offset = 0 }) => {
    let q = getSupabase().from("projects").select("*").order("created_at", { ascending: false }).range(offset, offset + limit - 1);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "get_project",
  "指定した案件の詳細を取得します",
  { id: z.string().describe("案件ID") },
  async ({ id }) => {
    const { data, error } = await getSupabase().from("projects").select("*").eq("id", id).single();
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "create_project",
  "新しい案件を作成します",
  {
    name: z.string().describe("案件名"),
    customer_name: z.string().optional().describe("顧客名"),
    business_type: z.string().optional().describe("業態"),
    assigned_sales: z.string().optional().describe("担当営業"),
    estimate_total: z.number().optional().describe("見積金額"),
    gross_profit: z.number().optional().describe("粗利"),
    gross_margin: z.number().optional().describe("粗利率（%）"),
    construction_start: z.string().optional().describe("着工日 (YYYY-MM-DD)"),
    status: z.string().optional().describe("ステータス (active / complete / lost)"),
    notes: z.string().optional().describe("メモ"),
  },
  async (fields) => {
    const { data, error } = await getSupabase().from("projects").insert(fields).select().single();
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "update_project",
  "既存の案件を更新します",
  {
    id: z.string().describe("案件ID"),
    name: z.string().optional().describe("案件名"),
    customer_name: z.string().optional().describe("顧客名"),
    business_type: z.string().optional().describe("業態"),
    assigned_sales: z.string().optional().describe("担当営業"),
    estimate_total: z.number().optional().describe("見積金額"),
    gross_profit: z.number().optional().describe("粗利"),
    gross_margin: z.number().optional().describe("粗利率（%）"),
    construction_start: z.string().optional().describe("着工日 (YYYY-MM-DD)"),
    status: z.string().optional().describe("ステータス (active / complete / lost)"),
    notes: z.string().optional().describe("メモ"),
  },
  async ({ id, ...fields }) => {
    const { data, error } = await getSupabase().from("projects").update(fields).eq("id", id).select().single();
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// ---- 見積 (estimates) ----
server.tool(
  "get_estimates",
  "見積一覧を取得します",
  {
    project_id: z.string().optional().describe("案件IDでフィルタ"),
  },
  async ({ project_id }) => {
    let q = getSupabase().from("estimates").select("*, projects(name, customer_name)").order("created_at", { ascending: false });
    if (project_id) q = q.eq("project_id", project_id);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "get_estimate_nodes",
  "見積の明細行（ノード）を取得します",
  { estimate_id: z.string().describe("見積ID") },
  async ({ estimate_id }) => {
    const { data, error } = await getSupabase().from("estimate_nodes").select("*").eq("estimate_id", estimate_id).order("sort_order");
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "create_estimate",
  "新しい見積を作成します",
  {
    project_id: z.string().describe("案件ID"),
    estimate_no: z.string().optional().describe("見積番号"),
    total: z.number().optional().describe("合計金額"),
    gross_profit: z.number().optional().describe("粗利"),
    gross_margin: z.number().optional().describe("粗利率（%）"),
    status: z.string().optional().describe("ステータス (draft / sent / approved)"),
    notes: z.string().optional().describe("メモ"),
  },
  async (fields) => {
    const { data, error } = await getSupabase().from("estimates").insert(fields).select().single();
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// ---- 発注 (purchase_orders) ----
server.tool(
  "get_purchase_orders",
  "発注一覧を取得します",
  {},
  async () => {
    const { data, error } = await getSupabase().from("purchase_orders").select("*, suppliers(name), estimates(estimate_no)").order("created_at", { ascending: false });
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// ---- 請求 (invoices) ----
server.tool(
  "get_invoices",
  "請求一覧を取得します",
  {
    status: z.string().optional().describe("ステータスフィルタ"),
  },
  async ({ status }) => {
    let q = getSupabase().from("invoices").select("*").order("created_at", { ascending: false });
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// ---- 顧客 (customers) ----
server.tool(
  "get_customers",
  "顧客一覧を取得します",
  {},
  async () => {
    const { data, error } = await getSupabase().from("customers").select("*").order("created_at", { ascending: false });
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// ---- 仕入先 (suppliers) ----
server.tool(
  "get_suppliers",
  "仕入先一覧を取得します",
  {},
  async () => {
    const { data, error } = await getSupabase().from("suppliers").select("*").order("name");
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// ---- PipeDrive連携 ----
const PD_BASE = "https://api.pipedrive.com/v1";

server.tool(
  "pipedrive_sync",
  "PipeDriveの案件データをSupabaseに同期します",
  {},
  async () => {
    const pdToken = process.env.PIPEDRIVE_API_TOKEN;
    if (!pdToken) {
      return { content: [{ type: "text", text: "Error: PIPEDRIVE_API_TOKEN が設定されていません" }], isError: true };
    }
    try {
      const r = await fetch(`${PD_BASE}/deals?limit=100&status=all_not_deleted&api_token=${pdToken}`);
      const deals = await r.json();
      const rows = (deals.data || []).map(d => ({
        name: d.title,
        customer_name: d.person_name || d.org_name || "",
        pipedrive_deal_id: String(d.id),
        status: d.status === "won" ? "complete" : d.status === "lost" ? "lost" : "active",
        estimate_total: d.value || 0,
        notes: d.notes_count > 0 ? `PipeDrive同期: ${d.id}` : null,
      }));
      const { error } = await getSupabase()
        .from("projects")
        .upsert(rows, { onConflict: "pipedrive_deal_id", ignoreDuplicates: false });
      const synced = error ? 0 : rows.length;
      return { content: [{ type: "text", text: JSON.stringify({ synced, total: rows.length, error: error?.message }) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// ---- 起動 ----
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(err => {
  process.stderr.write(`MCP server error: ${err.message}\n`);
  process.exit(1);
});
