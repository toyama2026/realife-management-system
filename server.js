const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// ルーティング
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", system: "REALIFE Management System", version: "1.0.0" });
});

app.get("/api/projects", (req, res) => {
  res.json({ data: [], message: "プロジェクト一覧" });
});

app.get("/api/estimates", (req, res) => {
  res.json({ data: [], message: "見積一覧" });
});

app.get("/api/orders", (req, res) => {
  res.json({ data: [], message: "発注一覧" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`REALIFE管理システム起動 ポート:${PORT}`);
});
