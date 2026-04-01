const express = require("express");
const router = express.Router();
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const PD_TOKEN = process.env.PIPEDRIVE_API_TOKEN;
const PD_BASE = "https://api.pipedrive.com/v1";

async function pdGet(path) {
  const r = await fetch(`${PD_BASE}${path}?api_token=${PD_TOKEN}`);
  return r.json();
}

async function pdPost(path, body) {
  const r = await fetch(`${PD_BASE}${path}?api_token=${PD_TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return r.json();
}

async function pdPatch(path, body) {
  const r = await fetch(`${PD_BASE}${path}?api_token=${PD_TOKEN}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return r.json();
}

// PipeDrive案件一覧取得
router.get("/deals", async (req, res) => {
  try {
    const data = await pdGet("/deals");
    res.json({ data: data.data || [] });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// PipeDrive → Supabase 同期
router.post("/sync", async (req, res) => {
  try {
    const deals = await pdGet("/deals?limit=100&status=all_not_deleted");
    const rows = (deals.data || []).map(d => ({
      name: d.title,
      customer_name: d.person_name || d.org_name || "",
      pipedrive_deal_id: String(d.id),
      status: d.status === "won" ? "complete" : d.status === "lost" ? "lost" : "active",
      estimate_total: d.value || 0,
      notes: d.notes_count > 0 ? `PipeDrive同期: ${d.id}` : null,
    }));

    let synced = 0;
    for (const row of rows) {
      const { error } = await supabase
        .from("projects")
        .upsert(row, { onConflict: "pipedrive_deal_id", ignoreDuplicates: false });
      if (!error) synced++;
    }

    res.json({ synced, total: rows.length });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Supabase案件 → PipeDrive新規案件作成
router.post("/push/:project_id", async (req, res) => {
  try {
    const { data: project } = await supabase
      .from("projects").select("*").eq("id", req.params.project_id).single();
    if (!project) return res.status(404).json({ error: "案件が見つかりません" });

    const deal = await pdPost("/deals", {
      title: project.name,
      value: project.estimate_total || 0,
      currency: "JPY",
      status: "open",
    });

    if (deal.success) {
      await supabase.from("projects").update({ pipedrive_deal_id: String(deal.data.id) }).eq("id", project.id);
      res.json({ pipedrive_id: deal.data.id });
    } else {
      res.status(400).json({ error: deal.error });
    }
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
