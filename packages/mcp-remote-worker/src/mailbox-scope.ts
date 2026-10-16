/**
 * Authorized mailboxes for this administrator's ChatGPT connection.
 *
 * Automatic discovery is restricted to accounts owned by MCP_MAILBOX's user_id.
 * Extra personal mailboxes require explicit deployment-side allowlisting.
 * Registration-code users are not selected merely for sharing a domain.
 */
export interface MailboxScopeEnv {
  DB: D1Database;
  MCP_MAILBOX: string;
  MCP_PERSONAL_MAILBOXES?: string;
}

export interface MailboxScope {
  allMailboxes: string[];
  mailboxes: string[];
  accountIds: number[];
}

type AccountRow = { accountId: number; email: string };
type UserRow = { userId: number };

export async function resolveMailboxScope(
  env: MailboxScopeEnv,
  requestedMailbox?: string,
): Promise<MailboxScope> {
  const administrator = env.MCP_MAILBOX.trim().toLowerCase();
  const owner = await env.DB.prepare(
    "SELECT user_id AS userId FROM user WHERE LOWER(email) = LOWER(?) AND is_del = 0 LIMIT 1",
  ).bind(administrator).first<UserRow>();

  if (!owner || !Number.isInteger(owner.userId)) {
    throw new Error("MCP administrator account not found; refusing mail access");
  }

  const rawExtras = env.MCP_PERSONAL_MAILBOXES !== undefined
    ? env.MCP_PERSONAL_MAILBOXES
    : "yuki@jcllyuki.com,resi@jcllyuki.com";

  const extras = [...new Set(
    rawExtras
      .split(",")
      .map((address) => address.trim().toLowerCase())
      .filter((address) => address && address !== administrator),
  )];

  // Explicitly allowed accounts may belong to another user; no wildcard or
  // same-domain matching is allowed. Reuse the live account table on EVERY call
  // so newly created/deleted administrator sub-addresses update immediately.
  const extraCondition = extras.length
    ? ` OR LOWER(a.email) IN (${extras.map(() => "?").join(",")})`
    : "";
  const statement = `
    SELECT a.account_id AS accountId, a.email
    FROM account a JOIN user u ON u.user_id = a.user_id
    WHERE a.is_del = 0 AND u.is_del = 0
      AND (a.user_id = ?${extraCondition})
    ORDER BY a.account_id ASC
    LIMIT 500
  `;
  const result = await env.DB.prepare(statement)
    .bind(owner.userId, ...extras).all<AccountRow>();
  const rows = result.results || [];

  const allMailboxes = [...new Set(rows.map((row) => row.email.toLowerCase()))];
  if (allMailboxes.length === 0) {
    throw new Error("No authorised mailboxes found");
  }

  const requested = requestedMailbox?.trim().toLowerCase();
  if (requested && !allMailboxes.includes(requested)) {
    throw new Error(`Mailbox '${requestedMailbox}' is not authorised for this connection`);
  }

  const selected = requested
    ? rows.filter((row) => row.email.toLowerCase() === requested)
    : rows;
  const accountIds = [...new Set(selected.map((row) => row.accountId)
    .filter((id) => Number.isInteger(id) && id > 0))];

  if (accountIds.length === 0) {
    throw new Error("No authorised mailboxes found");
  }

  return {
    allMailboxes,
    mailboxes: [...new Set(selected.map((row) => row.email.toLowerCase()))],
    accountIds,
  };
}

export function applyMailboxAccountFilter(
  accountIds: number[],
  conditions: string[],
  values: Array<string | number>,
): void {
  if (accountIds.length === 0) {
    throw new Error("No authorised mailbox accounts");
  }
  conditions.push(`e.account_id IN (${accountIds.map(() => "?").join(",")})`);
  values.push(...accountIds);
}
