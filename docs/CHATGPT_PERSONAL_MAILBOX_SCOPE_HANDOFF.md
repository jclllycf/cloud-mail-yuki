# ChatGPT YUKI Mail multi-mailbox rollout handoff (2026-10-16)

## Objective
Enable the existing authenticated `admin@jcllyuki.com` ChatGPT Yuki Mail MCP to aggregate mail from three user-authorised personal addresses:
- `admin@jcllyuki.com`
- `yuki@jcllyuki.com`
- `resi@jcllyuki.com`

Automatically discover any NEW mailbox that is added as another account/alias under the administrator's `user_id` in the existing D1 `account` table. The mailbox registry is re-read on every tool call (or securely cached with invalidation), so no new ChatGPT connection is needed for those sub-addresses.

IMPORTANT: Registration-code user accounts and their mail MUST NOT automatically join the ChatGPT personal-mail reading scope, even when they share the same domain. Do not use domain wildcard as access control. New standalone user accounts require an explicit per-address administrative grant before ChatGPT may access their message bodies.

## Scope
Only update `packages/mcp-remote-worker` and its CI workflow in this round.
Keep the main Cloud Mail worker, database schema, user registration, message delivery, web UI, and Telegram Bot operational and unchanged.
The EXISTING Telegram Bot remains the administrator's global moderation/monitoring bot as requested. Separate customer bots and privacy hardening are a future phase; do not silently change bot routing now.

## Confirmed code findings
- Live ChatGPT Yuki Mail MCP returns `admin@jcllyuki.com` and Admin inbox messages.
- `packages/mcp-remote-worker/src/index.ts` currently hard-codes `env.MCP_MAILBOX` in inbox, search, detail, and attachment SQL restrictions.
- `mail-worker/src/entity/account.js` defines `account.account_id`, `account.user_id`, `account.email`, `account.is_del`.
- `mail-worker/src/entity/user.js` defines `user.user_id`, `user.email`, `user.reg_key_id`, `user.is_del`.
- `mail-worker/src/service/email-service.js` supports admin-only `/allEmail/list` separately from user inbox listing.
- Cloudflare CI workflow: `.github/workflows/deploy-yuki-mail-mcp.yml`, deploys branch `feat/yuki-mail-remote-mcp`.
- A DRAFT helper `packages/mcp-remote-worker/src/mailbox-scope.ts` was locally written on 2026-10-16; IT IS NOT WIRED INTO THE MCP PROGRAM AND HAS NOT BEEN DEPLOYED. Review and improve before use.

## Required implementation
1. Keep administrator OAuth sign-in pinned to `MCP_MAILBOX` and preserve `mail.read` / `mail.write` scopes. Do not broaden unauthenticated or ordinary-user access.
2. At each request, verify the administrator's active `user` row. Compute the active `account_id` set for the same `user_id`, plus exact addresses in an explicitly configured personal allowlist (start with YUKI and resi). All account grants are server-controlled, not model-controlled.
3. Enforce `email.account_id IN (authorised_ids)` for list/search, per-message lookup, attachment lookup, and verification code retrieval. This also supports plus-tag recipient addresses whose stored `to_email` differs from the primary `account.email`.
4. Add a read-only `cloud_mail_mailboxes` tool to show current authorised addresses, and an optional `mailbox` argument to list/search/verification-code tools for address-specific queries. No argument should be able to select a non-authorised address.
5. Without a `mailbox` argument, inbox and searches should aggregate mail across all authorised personal accounts, newest first. Maintain pagination and caps.
6. Add `MCP_PERSONAL_MAILBOXES = "yuki@jcllyuki.com,resi@jcllyuki.com"` in the deployed MCP Worker configuration. This is an exact allowlist, NOT a domain wildcard.
7. Add automated tests using synthetic D1 fixtures for: all three mailboxes readable, future admin-owned alias auto-discovered, invitation-code friend's mailbox excluded, deleted/grant-revoked address rejected, detail and attachment IDs of unapproved users rejected, and existing admin account compatibility.
8. Run typecheck and tests BEFORE deployment, then let the existing CI deploy only the MCP Worker. Inspect Actions logs, check public health/OAuth/401 boundaries and authenticated personal mailbox enumeration. Verify live mailbox records before claiming completion.
9. After deployment, verify the ChatGPT connector's tool schema refresh. Run `cloud_mail_mailboxes` and `cloud_mail_list` for each of the three addresses; avoid exposing verification codes in logs or progress reports. If a schema refresh is needed, tell the user exactly what to reconnect.
10. Update the daily email-summary automation ONLY after the connector demonstrably reads the three mailboxes. Do not count the same message twice.

## Release safety
Do not send email, delete mail, create real mailboxes, alter Telegram routing, rotate keys or edit Cloudflare production mail data during this upgrade. Keep the original MCP Worker deployment available for rollback. Do not push secrets to Git or show them in chat.

## Status from this assistant session
Read-only analysis and draft helper creation completed; direct changes to the main MCP entrypoint and GitHub branch were blocked by execution safety checks. No source integration, typecheck, production deployment, or post-deploy tests have been completed in this session.
