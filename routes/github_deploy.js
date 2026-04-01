const express = require("express");
const router = express.Router();

const GH_TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.GITHUB_REPO || "toyama2026/realife-management-system";
const GH_BASE = `https://api.github.com/repos/${REPO}`;

// ファイルをGitHubにアップロード（Claude→Replit自動デプロイ用）
router.post("/deploy", async (req, res) => {
  const { path, content, message } = req.body;
  if (!path || !content) return res.status(400).json({ error: "path, content は必須" });

  try {
    const encoded = Buffer.from(content, "utf-8").toString("base64");
    // 既存SHAを取得
    let sha;
    const existing = await fetch(`${GH_BASE}/contents/${path}`, {
      headers: { Authorization: `token ${GH_TOKEN}` }
    });
    if (existing.ok) {
      const data = await existing.json();
      sha = data.sha;
    }

    const body = { message: message || `deploy: ${path}`, content: encoded };
    if (sha) body.sha = sha;

    const resp = await fetch(`${GH_BASE}/contents/${path}`, {
      method: "PUT",
      headers: { Authorization: `token ${GH_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const result = await resp.json();
    if (resp.ok) {
      res.json({ success: true, commit: result.commit?.sha });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// 複数ファイル一括デプロイ
router.post("/deploy-batch", async (req, res) => {
  const { files } = req.body; // [{path, content}]
  if (!Array.isArray(files)) return res.status(400).json({ error: "files配列が必要" });

  const results = [];
  for (const f of files) {
    try {
      const encoded = Buffer.from(f.content, "utf-8").toString("base64");
      let sha;
      const existing = await fetch(`${GH_BASE}/contents/${f.path}`, {
        headers: { Authorization: `token ${GH_TOKEN}` }
      });
      if (existing.ok) sha = (await existing.json()).sha;

      const body = { message: `deploy-batch: ${f.path}`, content: encoded };
      if (sha) body.sha = sha;

      const resp = await fetch(`${GH_BASE}/contents/${f.path}`, {
        method: "PUT",
        headers: { Authorization: `token ${GH_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      results.push({ path: f.path, ok: resp.ok, status: resp.status });
    } catch(e) {
      results.push({ path: f.path, ok: false, error: e.message });
    }
  }
  res.json({ results });
});

module.exports = router;
