# Cloud Mail MCP Server — Setup & Integration Guide

Turn your Cloud Mail instance into an **MCP-native email infrastructure** for AI coding agents such as **OpenAI Codex**, **Claude Code / Claude Desktop**, **Antigravity**, **Cursor**, and **Windsurf**.

---

## 🚀 Overview

The Cloud Mail MCP Server connects your AI assistants directly to your private Cloud Mail instance via the open standard **Model Context Protocol (stdio transport)**.

### Key Capabilities
- **Two-Stage Compact Retrieval**: `cloud_mail_list` and `cloud_mail_search` return compact metadata, stripping full HTML/body content to save token context. Full body is retrieved on demand via `cloud_mail_get`.
- **Instant Verification Codes**: Dedicated `cloud_mail_get_verification_code` tool fetches codes in under 100 tokens with D1 Workers AI pre-extraction and deterministic regex fallback.
- **Safety Boundary**: Dual mode (`CLOUD_MAIL_MODE=readonly | full`, default: `readonly`). High-risk mutating operations (`send`, `delete`, `create_mailbox`) are deterministically blocked in `readonly` mode.
- **Zero Token Bloat**: Reuses Cloud Mail's original single Public Token (`/api/public/genToken`) with automatic rotation. No OAuth or complex RBAC needed.

---

## 🛠️ MCP Tools Reference (v1: 8 Tools)

### 📖 Read Tools (Always Active, `readOnlyHint = true`)
| Tool Name | Parameters | Description |
| :--- | :--- | :--- |
| `cloud_mail_list` | `box` (`inbox` \| `sent` \| `trash` \| `drafts`), `page`, `pageSize`, `unreadOnly`, `toEmail` | List emails with compact metadata (no HTML/full text). |
| `cloud_mail_search` | `query`, `from`, `to`, `subject`, `since`, `before`, `limit` (max 50, default 10) | Multi-criteria search returning compact results. |
| `cloud_mail_get` | `emailId`, `includeHtml` (default: `false`) | Read full body text and attachment list of a single email. |
| `cloud_mail_get_verification_code` | `serviceName` (e.g. `GitHub`), `from`, `toEmail`, `maxAgeMinutes` (default: 15) | Retrieve recent 4-8 digit verification code with zero extra LLM calls. |
| `cloud_mail_get_attachment` | `emailId`, `attId`, `maxTextLength` (default: 8000) | Preview text files (`.txt`, `.json`, `.csv`, `.log`, `.md`) or return URL for binary files. |

### ✏️ Guarded Write Tools (`CLOUD_MAIL_MODE=full` Required)
| Tool Name | Parameters | Description & Safety Guard |
| :--- | :--- | :--- |
| `cloud_mail_send` | `to`, `subject`, `text`, `html?`, `from?`, `cc?`, `bcc?` | Send real email via Cloudflare Email or Resend. Blocked in `readonly` mode. |
| `cloud_mail_delete` | `emailId` | **Soft-delete** email (moves to trash). Marked `destructiveHint=true`. Blocked in `readonly` mode. |
| `cloud_mail_create_mailbox` | `email`, `password?` | Dynamically create an isolated address under your domain for agent tasks. Blocked in `readonly` mode. |

---

## ⚙️ Configuration & Environment Variables

| Variable | Required | Default | Description |
| :--- | :---: | :---: | :--- |
| `CLOUD_MAIL_API_URL` | No | `https://mail.jcllyuki.com` | Base URL of your Cloud Mail deployment. |
| `CLOUD_MAIL_TOKEN` | **Yes** | — | Public API Token generated from `/api/public/genToken`. |
| `CLOUD_MAIL_MODE` | No | `readonly` | `readonly` (safe, read-only) or `full` (allows send, delete, create). |

### Obtaining Your Token
Call `/api/public/genToken` with your Cloud Mail admin credentials:
```bash
curl -X POST "https://mail.jcllyuki.com/api/public/genToken" \
  -H "Content-Type: application/json" \
  -d '{"email": "your-admin@example.com", "password": "your-password"}'
```
Response:
```json
{
  "code": 200,
  "data": {
    "token": "49b28a1c-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  }
}
```

---

## 💻 Client Configuration

### 1. OpenAI Codex (`~/.codex/config.toml`)
Append the following to your Codex configuration file:

```toml
[mcp_servers.cloud_mail]
command = "node"
args = ["D:\\Users\\JCLXJ\\Documents\\AI Project\\cloud\\cloud-mail-yuki\\packages\\mcp-server\\dist\\index.js"]
startup_timeout_sec = 30

[mcp_servers.cloud_mail.env]
CLOUD_MAIL_API_URL = "https://mail.jcllyuki.com"
CLOUD_MAIL_TOKEN = "<your-token-here>"
CLOUD_MAIL_MODE = "readonly"
```

### 2. Claude Desktop (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "cloud-mail": {
      "command": "node",
      "args": [
        "D:\\Users\\JCLXJ\\Documents\\AI Project\\cloud\\cloud-mail-yuki\\packages\\mcp-server\\dist\\index.js"
      ],
      "env": {
        "CLOUD_MAIL_API_URL": "https://mail.jcllyuki.com",
        "CLOUD_MAIL_TOKEN": "<your-token-here>",
        "CLOUD_MAIL_MODE": "readonly"
      }
    }
  }
}
```

### 3. Antigravity / Cursor / Windsurf
In your MCP settings UI, add a new stdio server:
- **Name**: `cloud-mail`
- **Command**: `node`
- **Arguments**: `D:\Users\JCLXJ\Documents\AI Project\cloud\cloud-mail-yuki\packages\mcp-server\dist\index.js`
- **Environment Variables**:
  - `CLOUD_MAIL_API_URL`: `https://mail.jcllyuki.com`
  - `CLOUD_MAIL_TOKEN`: `<your-token-here>`
  - `CLOUD_MAIL_MODE`: `readonly` (or `full`)

---

## 🧪 Real Natural Language Testing Examples

Once configured, your agent can naturally handle your email without visiting the web interface:

1. **Check recent emails:**
   > "List the 5 most recent emails in my inbox."
   *(Agent calls `cloud_mail_list(box="inbox", pageSize=5)`)*

2. **Search GitHub notifications:**
   > "Search for emails from GitHub in the last 7 days."
   *(Agent calls `cloud_mail_search(from="github.com", since="2026-09-26")`)*

3. **Read email details:**
   > "Read the content of email ID 42."
   *(Agent calls `cloud_mail_get(emailId=42)`)*

4. **Retrieve verification code:**
   > "Find the latest verification code from OpenAI."
   *(Agent calls `cloud_mail_get_verification_code(serviceName="OpenAI")`)*

5. **Send email (requires `CLOUD_MAIL_MODE=full`):**
   > "Send an email to partner@example.com with the subject 'Project Update'."
   *(In readonly mode, the agent receives an immediate refusal. In full mode, host confirmation is triggered).*
