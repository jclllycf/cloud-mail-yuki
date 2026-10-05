# Yuki Mail Remote MCP

Read-only remote MCP gateway for connecting `admin@jcllyuki.com` to ChatGPT without requiring the user's PC to stay online.

## Endpoint

- MCP: `https://mcp.jcllyuki.com/mcp`
- Health: `https://mcp.jcllyuki.com/health`
- OAuth protected-resource metadata: `https://mcp.jcllyuki.com/.well-known/oauth-protected-resource`
- OAuth authorization-server metadata: `https://mcp.jcllyuki.com/.well-known/oauth-authorization-server`

## V1 capabilities

The remote connection intentionally exposes read-only tools only:

- `cloud_mail_profile`
- `cloud_mail_list`
- `cloud_mail_search`
- `cloud_mail_get`
- `cloud_mail_get_verification_code`
- `cloud_mail_get_attachment`

All database reads are scoped server-side to `MCP_MAILBOX`. A model cannot select another mailbox through tool arguments.

## Authentication

The worker implements an OAuth 2.1 authorization-code flow with PKCE S256 for ChatGPT:

- authorization is performed on a Yuki Mail–branded page
- credentials are verified against the existing Yuki Mail `/api/login` endpoint
- the password is never stored by the MCP worker
- authorization codes are short-lived and replay-protected through KV
- access tokens are short-lived HMAC-signed tokens
- refresh tokens expire after 30 days
- the OAuth signing key is stored as a Cloudflare Worker secret
- the ChatGPT CIMD client and callback are allow-listed

V1 requests the single scope `mail.read`. Sending, deleting, and mailbox creation are deliberately absent.

## Cloudflare bindings

The worker reuses the existing Yuki Mail infrastructure through dedicated bindings:

- `DB`: the existing Cloudflare D1 database
- `R2`: the existing attachment bucket
- `AUTH_KV`: the existing KV namespace, with MCP-specific key prefixes
- `OAUTH_SIGNING_SECRET`: Worker secret
- `MCP_MAILBOX`: `admin@jcllyuki.com`
- `MAIL_API_URL`: `https://mail.jcllyuki.com`

The MCP worker is a separate Cloudflare Worker and custom domain. It does not replace or proxy the Yuki Mail website.

## Local checks

```powershell
node node_modules/typescript/bin/tsc --noEmit
```

For local development, copy `.dev.vars.example` to `.dev.vars` and provide a disposable OAuth signing secret. Local Wrangler bindings still need safe development resources; do not point local destructive experiments at production.

## Deployment

Deployment is isolated in:

`.github/workflows/deploy-yuki-mail-mcp.yml`

It uses the repository's existing Cloudflare deployment credentials and resource IDs, renders a temporary Wrangler configuration in CI, deploys `yuki-mail-mcp`, derives a domain-separated OAuth signing secret from the existing protected deployment secret, and smoke-tests the public OAuth metadata plus the unauthenticated 401 boundary.

## ChatGPT connection

After a successful deployment:

1. Enable ChatGPT Developer mode.
2. Open Plugins and add a new MCP connection.
3. Use `https://mcp.jcllyuki.com/mcp`.
4. Complete the Yuki Mail OAuth sign-in in the browser.
5. Verify the profile identifies `admin@jcllyuki.com`.
6. Test recent-mail listing and message retrieval before using the connection in recurring tasks.

The daily summary automation should use this read-only connection. Write-capable Agent tools remain a separate V2 concern so recurring background summaries cannot send or delete mail.
