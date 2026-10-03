# Security Policy & Architecture

## Security Philosophy

Cloud Mail Agent is designed with a defense-in-depth approach for AI-integrated email workflows. Because LLM agents can misinterpret instructions or hallucinate destructive parameters, security boundaries are enforced **deterministically at the MCP and API levels**, rather than relying solely on model prompt adherence.

---

## 1. Single Token Scope & Key Rotation

- **Single Credential**: Authentication uses the standard Cloud Mail Public Token (`Authorization: <token>`). No secondary API keys, long-lived master passwords, or multi-tenant database records are introduced.
- **Atomic Rotation**: Re-invoking `POST /api/public/genToken` rotates the token stored in Cloudflare KV (`PUBLIC_KEY`). The previous token is instantly invalidated across all workers and MCP servers.
- **Zero Local Persistence**: The MCP server reads `CLOUD_MAIL_TOKEN` strictly from process environment variables and does not write it to disk or cache.

---

## 2. Mode Separation (`readonly` vs `ask` vs `full`)

The MCP server enforces runtime operation modes via the `CLOUD_MAIL_MODE` environment variable:

| Mode | READ Tools | WRITE Tools | Host Approval Required |
| :--- | :--- | :--- | :--- |
| `readonly` | Allowed | **Blocked Locally** (Zero API calls) | N/A (Server hard rejects) |
| `ask` **(Default & Recommended)** | **Auto Allowed** | **Enabled with Host Approval** | **Yes** (User prompts via Codex / Client) |
| `full` | Allowed | **Direct Execution** | Optional / Client-configured |

### Tool Risk Classification & Semantic Annotations
MCP protocol annotations are provided to guide client approval prompts:

- **READ Tools** (`cloud_mail_list`, `cloud_mail_search`, `cloud_mail_get`, `cloud_mail_get_verification_code`, `cloud_mail_get_attachment`):
  `readOnlyHint: true` — completely safe, auto-executed by hosts.
- **`cloud_mail_send`**:
  `readOnlyHint: false`, `destructiveHint: true`, `openWorldHint: true` — high-risk operation with irreversible external communication side effects.
- **`cloud_mail_delete`**:
  `readOnlyHint: false`, `destructiveHint: true` — soft-delete action moving email to Trash.
- **`cloud_mail_create_mailbox`**:
  `readOnlyHint: false`, `destructiveHint: false` — creates a new address under your domain.

---

## 3. Data Protection & Soft-Delete Only

- **No Permanent Delete**: `cloud_mail_delete` only marks the email record with `isDel = 1` (moving it to the Trash box). Permanent deletion and physical R2 asset cleanup remain strictly confined to the Cloud Mail Web Admin UI.
- **Compact Projection**: The public API projects stripped metadata (`compact=true`) for search and listing endpoints. Sensitive email bodies and large HTML attachments are never exposed in bulk listings, limiting LLM context leakage.

---

## 4. Zero Secret Logging

- MCP server error handlers sanitize headers and request payloads to prevent `CLOUD_MAIL_TOKEN` from appearing in stdout, stderr, or MCP client logs.
- Environment variables should be supplied via client configuration (e.g. `~/.codex/config.toml` or OS secrets manager) and never checked into source control.

---

## 5. Reporting a Security Vulnerability

If you discover a security vulnerability within Cloud Mail Agent or its MCP server, please open an issue in this repository or contact the maintainer directly. Fixes will be reviewed and deployed promptly.
