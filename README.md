# REALIFE 総合管理システム

合同会社REALIFEの総合管理システムです。

## 機能
- 案件管理
- 見積管理
- 発注管理
- 請求管理

## 技術スタック
- Node.js / Express
- Supabase (DB)
- PipeDrive (CRM連携)
- MCP (Model Context Protocol) サーバー

## セットアップ
```bash
npm install
cp .env.example .env
npm start
```

---

## MCP サーバー（Lovable / Claude Desktop 連携）

`mcp_server.js` は [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) に準拠したサーバーです。
Lovable.dev・Claude Desktop・Cursor など MCP 対応の AI ツールからこのシステムのデータを直接操作できます。

### 起動方法
```bash
npm run mcp
```

### 提供ツール一覧

| ツール名 | 説明 |
|---|---|
| `get_dashboard` | ダッシュボード集計データを取得 |
| `get_projects` | 案件一覧を取得（ステータス・件数・オフセットでフィルタ可） |
| `get_project` | 指定案件の詳細を取得 |
| `create_project` | 新しい案件を作成 |
| `update_project` | 既存の案件を更新 |
| `get_estimates` | 見積一覧を取得（案件IDでフィルタ可） |
| `get_estimate_nodes` | 見積の明細行を取得 |
| `create_estimate` | 新しい見積を作成 |
| `get_purchase_orders` | 発注一覧を取得 |
| `get_invoices` | 請求一覧を取得（ステータスでフィルタ可） |
| `get_customers` | 顧客一覧を取得 |
| `get_suppliers` | 仕入先一覧を取得 |
| `pipedrive_sync` | PipeDrive の案件データを Supabase に同期 |

### Claude Desktop への登録例

`claude_desktop_config.json` に以下を追加してください：

```json
{
  "mcpServers": {
    "realife": {
      "command": "node",
      "args": ["/path/to/realife-management-system/mcp_server.js"],
      "env": {
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_KEY": "your_supabase_anon_key",
        "PIPEDRIVE_API_TOKEN": "your_pipedrive_token"
      }
    }
  }
}
```

### 必要な環境変数

| 変数名 | 説明 |
|---|---|
| `SUPABASE_URL` | Supabase プロジェクト URL |
| `SUPABASE_KEY` | Supabase サービスロールキー（書き込み操作を行うため anon キーより推奨）|
| `PIPEDRIVE_API_TOKEN` | PipeDrive API トークン（`pipedrive_sync` ツール使用時のみ必要） |
