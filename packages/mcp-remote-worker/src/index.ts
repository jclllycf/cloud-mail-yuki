import { createMcpHandler } from "agents/mcp/server";
import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  ISSUER,
  MAIL_READ_SCOPE,
  MAIL_WRITE_SCOPE,
  authenticateMcpRequest,
  handleOAuthRequest,
  oauthUnauthorized,
  toolSecurity,
} from "./oauth";

interface Env {
  DB: D1Database;
  R2: R2Bucket;
  AUTH_KV: KVNamespace;
  OAUTH_SIGNING_SECRET: string;
  MCP_MAILBOX: string;
  MAIL_API_URL: string;
}

type EmailRow = {
  emailId: number;
  sendEmail: string | null;
  sendName: string | null;
  toEmail: string | null;
  toName: string | null;
  subject: string | null;
  createTime: string | null;
  type: number;
  isDel: number;
  unread: number;
  code: string | null;
  text?: string | null;
  content?: string | null;
  messageId?: string | null;
  inReplyTo?: string | null;
  relation?: string | null;
  status?: number;
  attCount?: number;
};

type AttachmentRow = {
  attId: number;
  filename: string | null;
  mimeType: string | null;
  size: number | null;
  key: string;
  disposition: string | null;
  contentId: string | null;
};

const ListEmailsSchema = {
  box: z.enum(["inbox", "sent", "trash", "drafts"]).default("inbox"),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(20),
  unreadOnly: z.boolean().default(false),
};

const SearchEmailsSchema = {
  query: z.string().min(1).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  subject: z.string().optional(),
  since: z.string().optional(),
  before: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(10),
};

const GetEmailSchema = {
  emailId: z.number().int().positive(),
  includeHtml: z.boolean().default(false),
};

const GetVerificationCodeSchema = {
  serviceName: z.string().optional(),
  from: z.string().optional(),
  maxAgeMinutes: z.number().int().min(1).max(1440).default(15),
};

const GetAttachmentSchema = {
  emailId: z.number().int().positive(),
  attId: z.number().int().positive(),
  maxTextLength: z.number().int().min(100).max(20000).default(8000),
};

const SendEmailSchema = {
  to: z.string().email().describe("Single recipient email address."),
  subject: z.string().min(1).max(240),
  text: z.string().max(100000).optional(),
  html: z.string().max(250000).optional(),
  cc: z.string().email().optional(),
  bcc: z.string().email().optional(),
  confirm: z.boolean().describe("Must be true only after the user explicitly approves sending this exact email."),
};

const DeleteEmailSchema = {
  emailId: z.number().int().positive(),
  confirm: z.boolean().describe("Must be true only after the user explicitly approves moving this email to trash."),
};

const CreateMailboxSchema = {
  email: z.string().email(),
  password: z.string().min(8).max(128).optional(),
  confirm: z.boolean().describe("Must be true only after the user explicitly approves creating this mailbox."),
};

function jsonResult(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

function authToolConfig<T extends Record<string, unknown>>(
  config: T,
  scopes: string[] = [MAIL_READ_SCOPE],
): T {
  const meta = (config as { _meta?: Record<string, unknown> })._meta || {};
  return {
    ...config,
    securitySchemes: toolSecurity(scopes),
    _meta: {
      ...meta,
      securitySchemes: toolSecurity(scopes),
    },
  } as T;
}

function displayAddress(name?: string | null, email?: string | null) {
  if (!email) return "";
  return name ? `${name} <${email}>` : email;
}

function compactEmail(row: EmailRow) {
  return {
    emailId: row.emailId,
    from: displayAddress(row.sendName, row.sendEmail),
    to: displayAddress(row.toName, row.toEmail),
    subject: row.subject || "(No Subject)",
    receivedAt: row.createTime,
    unread: row.unread === 0,
    hasAttachment: Number(row.attCount || 0) > 0,
    attCount: Number(row.attCount || 0),
    verificationCode: row.code || undefined,
  };
}

function addBoxFilter(box: string, conditions: string[]) {
  if (box === "trash") {
    conditions.push("e.is_del = 1");
    return;
  }

  conditions.push("e.is_del = 0");
  if (box === "inbox") {
    conditions.push("e.type = 0");
  } else if (box === "sent") {
    conditions.push("e.type = 1");
    conditions.push("e.status <> 6");
  } else if (box === "drafts") {
    conditions.push("e.type = 1");
    conditions.push("e.status = 6");
  }
}

function addMailboxFilter(
  box: string,
  mailbox: string,
  conditions: string[],
  values: Array<string | number>,
) {
  if (box === "inbox") {
    conditions.push("LOWER(e.to_email) = LOWER(?)");
    values.push(mailbox);
    return;
  }

  if (box === "sent" || box === "drafts") {
    conditions.push("LOWER(e.send_email) = LOWER(?)");
    values.push(mailbox);
    return;
  }

  conditions.push("(LOWER(e.to_email) = LOWER(?) OR LOWER(e.send_email) = LOWER(?))");
  values.push(mailbox, mailbox);
}

async function listEmails(
  env: Env,
  params: {
    box: string;
    page: number;
    pageSize: number;
    unreadOnly: boolean;
  },
) {
  const conditions: string[] = [];
  const values: Array<string | number> = [];
  addBoxFilter(params.box, conditions);
  addMailboxFilter(params.box, env.MCP_MAILBOX, conditions, values);

  if (params.unreadOnly) {
    conditions.push("e.unread = 0");
  }

  values.push(params.pageSize, (params.page - 1) * params.pageSize);

  const sql = `
    SELECT
      e.email_id AS emailId,
      e.send_email AS sendEmail,
      e.name AS sendName,
      e.to_email AS toEmail,
      e.to_name AS toName,
      e.subject AS subject,
      e.create_time AS createTime,
      e.type AS type,
      e.is_del AS isDel,
      e.unread AS unread,
      e.code AS code,
      (SELECT COUNT(*) FROM attachments a WHERE a.email_id = e.email_id) AS attCount
    FROM email e
    WHERE ${conditions.join(" AND ")}
    ORDER BY e.email_id DESC
    LIMIT ? OFFSET ?
  `;

  const result = await env.DB.prepare(sql).bind(...values).all<EmailRow>();
  return result.results || [];
}

async function searchEmails(
  env: Env,
  params: {
    query?: string;
    from?: string;
    to?: string;
    subject?: string;
    since?: string;
    before?: string;
    limit: number;
  },
) {
  const conditions = [
    "e.is_del = 0",
    "(LOWER(e.to_email) = LOWER(?) OR LOWER(e.send_email) = LOWER(?))",
  ];
  const values: Array<string | number> = [env.MCP_MAILBOX, env.MCP_MAILBOX];

  if (params.query) {
    const like = `%${params.query}%`;
    conditions.push("(e.subject LIKE ? COLLATE NOCASE OR e.send_email LIKE ? COLLATE NOCASE OR e.name LIKE ? COLLATE NOCASE OR e.text LIKE ? COLLATE NOCASE)");
    values.push(like, like, like, like);
  }
  if (params.from) {
    const like = `%${params.from}%`;
    conditions.push("(e.send_email LIKE ? COLLATE NOCASE OR e.name LIKE ? COLLATE NOCASE)");
    values.push(like, like);
  }
  if (params.to) {
    conditions.push("e.to_email LIKE ? COLLATE NOCASE");
    values.push(`%${params.to}%`);
  }
  if (params.subject) {
    conditions.push("e.subject LIKE ? COLLATE NOCASE");
    values.push(`%${params.subject}%`);
  }
  if (params.since) {
    conditions.push("e.create_time >= ?");
    values.push(params.since);
  }
  if (params.before) {
    conditions.push("e.create_time <= ?");
    values.push(params.before);
  }

  values.push(params.limit);

  const sql = `
    SELECT
      e.email_id AS emailId,
      e.send_email AS sendEmail,
      e.name AS sendName,
      e.to_email AS toEmail,
      e.to_name AS toName,
      e.subject AS subject,
      e.create_time AS createTime,
      e.type AS type,
      e.is_del AS isDel,
      e.unread AS unread,
      e.code AS code,
      (SELECT COUNT(*) FROM attachments a WHERE a.email_id = e.email_id) AS attCount
    FROM email e
    WHERE ${conditions.join(" AND ")}
    ORDER BY e.email_id DESC
    LIMIT ?
  `;

  const result = await env.DB.prepare(sql).bind(...values).all<EmailRow>();
  return result.results || [];
}

async function getEmail(env: Env, emailId: number) {
  const row = await env.DB.prepare(`
    SELECT
      e.email_id AS emailId,
      e.send_email AS sendEmail,
      e.name AS sendName,
      e.to_email AS toEmail,
      e.to_name AS toName,
      e.subject AS subject,
      e.create_time AS createTime,
      e.type AS type,
      e.status AS status,
      e.is_del AS isDel,
      e.unread AS unread,
      e.code AS code,
      e.text AS text,
      e.content AS content,
      e.message_id AS messageId,
      e.in_reply_to AS inReplyTo,
      e.relation AS relation
    FROM email e
    WHERE e.email_id = ?
      AND (LOWER(e.to_email) = LOWER(?) OR LOWER(e.send_email) = LOWER(?))
    LIMIT 1
  `).bind(emailId, env.MCP_MAILBOX, env.MCP_MAILBOX).first<EmailRow>();

  if (!row) return null;

  const attachments = await env.DB.prepare(`
    SELECT
      a.att_id AS attId,
      a.filename,
      a.mime_type AS mimeType,
      a.size,
      a.key,
      a.disposition,
      a.content_id AS contentId
    FROM attachments a
    INNER JOIN email e ON e.email_id = a.email_id
    WHERE a.email_id = ?
      AND (LOWER(e.to_email) = LOWER(?) OR LOWER(e.send_email) = LOWER(?))
    ORDER BY a.att_id ASC
  `).bind(emailId, env.MCP_MAILBOX, env.MCP_MAILBOX).all<AttachmentRow>();

  return {
    ...row,
    attachments: attachments.results || [],
  };
}

function extractVerificationCode(text: string, subject = "") {
  const source = `${subject}\n${text}`;
  const contextual = source.match(/(?:verification|verify|code|验证码|校验码|otp)[^0-9]{0,30}([0-9]{4,8})/i);
  if (contextual?.[1]) return contextual[1];
  const fallback = source.match(/\b([0-9]{4,8})\b/);
  return fallback?.[1] || null;
}

const PUBLIC_TOKEN_KEY = "public_key:";

async function publicApiRequest<T>(
  env: Env,
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await env.AUTH_KV.get(PUBLIC_TOKEN_KEY);
  if (!token) {
    throw new Error("Yuki Mail public API token is not configured. Generate one in the Yuki Mail admin interface before using write actions.");
  }

  const response = await fetch(
    env.MAIL_API_URL.replace(/\/$/, "") + (endpoint.startsWith("/") ? endpoint : "/" + endpoint),
    {
      ...options,
      headers: {
        Authorization: token,
        "content-type": "application/json",
        ...(options.headers || {}),
      },
    },
  );

  let payload: any;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Yuki Mail API returned a non-JSON response (HTTP " + response.status + ").");
  }

  if (!response.ok || (payload.code !== undefined && payload.code !== 0 && payload.code !== 200)) {
    throw new Error(payload.msg || payload.message || ("Yuki Mail API request failed with HTTP " + response.status));
  }

  return (payload.data !== undefined ? payload.data : payload) as T;
}

function mailboxDomain(mailbox: string) {
  return mailbox.split("@").pop()?.toLowerCase() || "";
}

function createServer(env: Env, agentMode = false) {
  const server = new McpServer({
    name: agentMode ? "yuki-mail-agent" : "yuki-mail-readonly",
    version: "0.3.0",
  });

  server.registerTool(
    "cloud_mail_profile",
    authToolConfig({
      title: "Get Yuki Mail account",
      description: "Return the profile represented by the authenticated Yuki Mail connection.",
      inputSchema: {},
      outputSchema: {
        id: z.string().min(1),
        name: z.string(),
        email: z.string().email(),
        nickname: z.string(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: { "openai/profile": true },
    }),
    async () => {
      const profile = {
        id: "prf_7b3c6f2a9d41",
        name: "YUKI",
        email: env.MCP_MAILBOX,
        nickname: "Yuki Mail",
      };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(profile) }],
        structuredContent: profile,
        isError: false,
      };
    },
  );

  server.registerTool(
    "cloud_mail_list",
    authToolConfig({
      description: "List Yuki Mail messages with compact metadata. Read-only. Use cloud_mail_get for full content.",
      inputSchema: ListEmailsSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
    }),
    async (args) => {
      const emails = await listEmails(env, args);
      return jsonResult({
        account: env.MCP_MAILBOX,
        box: args.box,
        page: args.page,
        count: emails.length,
        emails: emails.map(compactEmail),
      });
    },
  );

  server.registerTool(
    "cloud_mail_search",
    authToolConfig({
      description: "Search Yuki Mail by sender, recipient, subject, body text, and date range. Read-only.",
      inputSchema: SearchEmailsSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
    }),
    async (args) => {
      const emails = await searchEmails(env, args);
      return jsonResult({
        account: env.MCP_MAILBOX,
        count: emails.length,
        emails: emails.map(compactEmail),
      });
    },
  );

  server.registerTool(
    "cloud_mail_get",
    authToolConfig({
      description: "Read one Yuki Mail message, including plain-text body and attachment metadata. HTML is opt-in.",
      inputSchema: GetEmailSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
    }),
    async (args) => {
      const detail = await getEmail(env, args.emailId);
      if (!detail) return jsonResult({ error: `Email ${args.emailId} not found in ${env.MCP_MAILBOX}` });

      const payload: Record<string, unknown> = {
        account: env.MCP_MAILBOX,
        emailId: detail.emailId,
        from: displayAddress(detail.sendName, detail.sendEmail),
        to: displayAddress(detail.toName, detail.toEmail),
        subject: detail.subject || "(No Subject)",
        receivedAt: detail.createTime,
        unread: detail.unread === 0,
        verificationCode: detail.code || undefined,
        messageId: detail.messageId || undefined,
        inReplyTo: detail.inReplyTo || undefined,
        text: detail.text || "",
        attachments: detail.attachments.map((att) => ({
          attId: att.attId,
          filename: att.filename || "",
          mimeType: att.mimeType || "application/octet-stream",
          sizeBytes: att.size || 0,
          downloadUrl: `${env.MAIL_API_URL}/oss/${att.key.split("/").map(encodeURIComponent).join("/")}`,
        })),
      };

      if (args.includeHtml) payload.html = detail.content || "";
      return jsonResult(payload);
    },
  );

  server.registerTool(
    "cloud_mail_get_verification_code",
    authToolConfig({
      description: "Find the newest recent verification code in Yuki Mail. Read-only and token-efficient.",
      inputSchema: GetVerificationCodeSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
    }),
    async (args) => {
      const rows = await listEmails(env, {
        box: "inbox",
        page: 1,
        pageSize: 20,
        unreadOnly: false,
      });

      const cutoff = Date.now() - args.maxAgeMinutes * 60_000;
      const filtered = rows.filter((row) => {
        if (row.createTime) {
          const t = new Date(row.createTime.replace(" ", "T") + "Z").getTime();
          if (!Number.isNaN(t) && t < cutoff) return false;
        }
        const haystack = `${row.sendEmail || ""} ${row.sendName || ""} ${row.subject || ""}`.toLowerCase();
        if (args.serviceName && !haystack.includes(args.serviceName.toLowerCase())) return false;
        if (args.from && !(row.sendEmail || "").toLowerCase().includes(args.from.toLowerCase())) return false;
        return true;
      });

      for (const row of filtered) {
        if (row.code?.trim()) {
          return jsonResult({
            found: true,
            account: env.MCP_MAILBOX,
            emailId: row.emailId,
            code: row.code.trim(),
            from: displayAddress(row.sendName, row.sendEmail),
            subject: row.subject,
            receivedAt: row.createTime,
            source: "d1_ai_code",
          });
        }
      }

      for (const row of filtered.slice(0, 3)) {
        const detail = await getEmail(env, row.emailId);
        if (!detail) continue;
        const code = extractVerificationCode(detail.text || "", detail.subject || "");
        if (code) {
          return jsonResult({
            found: true,
            account: env.MCP_MAILBOX,
            emailId: row.emailId,
            code,
            from: displayAddress(row.sendName, row.sendEmail),
            subject: row.subject,
            receivedAt: row.createTime,
            source: "regex_fallback",
          });
        }
      }

      return jsonResult({
        found: false,
        account: env.MCP_MAILBOX,
        checkedEmailCount: filtered.length,
      });
    },
  );

  server.registerTool(
    "cloud_mail_get_attachment",
    authToolConfig({
      description: "Preview text-like attachments or return metadata and a download URL for binary attachments. Read-only.",
      inputSchema: GetAttachmentSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
    }),
    async (args) => {
      const att = await env.DB.prepare(`
        SELECT
          a.att_id AS attId,
          a.filename,
          a.mime_type AS mimeType,
          a.size,
          a.key,
          a.disposition,
          a.content_id AS contentId
        FROM attachments a
        INNER JOIN email e ON e.email_id = a.email_id
        WHERE a.email_id = ?
          AND a.att_id = ?
          AND (LOWER(e.to_email) = LOWER(?) OR LOWER(e.send_email) = LOWER(?))
        LIMIT 1
      `).bind(args.emailId, args.attId, env.MCP_MAILBOX, env.MCP_MAILBOX).first<AttachmentRow>();

      if (!att) return jsonResult({ error: "Attachment not found" });

      const mime = att.mimeType || "application/octet-stream";
      const filename = att.filename || "";
      const isTextLike =
        /^text\//i.test(mime) ||
        /^application\/(json|xml|csv|javascript)/i.test(mime) ||
        /\.(txt|json|csv|log|md|xml|js|ts)$/i.test(filename);

      const downloadUrl = `${env.MAIL_API_URL}/oss/${att.key.split("/").map(encodeURIComponent).join("/")}`;

      if (!isTextLike) {
        return jsonResult({
          account: env.MCP_MAILBOX,
          emailId: args.emailId,
          attId: att.attId,
          filename,
          mimeType: mime,
          sizeBytes: att.size || 0,
          previewAvailable: false,
          downloadUrl,
        });
      }

      const object = await env.R2.get(att.key);
      if (!object) return jsonResult({ error: "Attachment object is missing from R2" });
      const preview = (await object.text()).slice(0, args.maxTextLength);

      return jsonResult({
        account: env.MCP_MAILBOX,
        emailId: args.emailId,
        attId: att.attId,
        filename,
        mimeType: mime,
        sizeBytes: att.size || 0,
        previewAvailable: true,
        preview,
        truncated: (att.size || 0) > args.maxTextLength,
        downloadUrl,
      });
    },
  );

  if (agentMode) {
    const writeScopes = [MAIL_READ_SCOPE, MAIL_WRITE_SCOPE];

    server.registerTool(
      "cloud_mail_send",
      authToolConfig({
        title: "Send Yuki Mail email",
        description: "Send a real email from the authenticated Yuki Mail mailbox. This is irreversible once delivered and must only be used after the user explicitly approves the exact recipients, subject, and body.",
        inputSchema: SendEmailSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          openWorldHint: true,
          idempotentHint: false,
        },
      }, writeScopes),
      async (args) => {
        if (args.confirm !== true) {
          return jsonResult({ success: false, error: "Explicit confirmation is required before sending." });
        }
        if (!args.text && !args.html) {
          return jsonResult({ success: false, error: "Email body is required (text or html)." });
        }

        try {
          const result = await publicApiRequest<{
            emailId?: number;
            status?: string;
            messageId?: string;
            toEmail?: string;
            subject?: string;
          }>(env, "/public/send", {
            method: "POST",
            body: JSON.stringify({
              from: env.MCP_MAILBOX,
              to: args.to,
              subject: args.subject,
              text: args.text,
              html: args.html,
              cc: args.cc,
              bcc: args.bcc,
            }),
          });

          return jsonResult({
            success: true,
            account: env.MCP_MAILBOX,
            emailId: result.emailId,
            status: result.status || "sent",
            to: result.toEmail || args.to,
            subject: result.subject || args.subject,
            messageId: result.messageId || undefined,
          });
        } catch (error) {
          return jsonResult({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
    );

    server.registerTool(
      "cloud_mail_delete",
      authToolConfig({
        title: "Move Yuki Mail email to trash",
        description: "Soft-delete one email by moving it to trash. Only emails belonging to the authenticated Yuki Mail mailbox can be changed. Requires explicit user approval.",
        inputSchema: DeleteEmailSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          openWorldHint: false,
          idempotentHint: true,
        },
      }, writeScopes),
      async (args) => {
        if (args.confirm !== true) {
          return jsonResult({ success: false, error: "Explicit confirmation is required before moving email to trash." });
        }
        const existing = await getEmail(env, args.emailId);
        if (!existing) {
          return jsonResult({ success: false, error: "Email not found in the authenticated Yuki Mail mailbox." });
        }

        try {
          const result = await publicApiRequest<{
            emailId?: number;
            deleted?: boolean;
            isDel?: number;
          }>(env, "/public/email/" + args.emailId, {
            method: "DELETE",
          });

          return jsonResult({
            success: true,
            account: env.MCP_MAILBOX,
            emailId: result.emailId || args.emailId,
            deleted: result.deleted !== false,
            note: "Email moved to trash. It can be restored from the Yuki Mail web interface.",
          });
        } catch (error) {
          return jsonResult({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
    );

    server.registerTool(
      "cloud_mail_create_mailbox",
      authToolConfig({
        title: "Create Yuki Mail mailbox",
        description: "Create a new mailbox under the same domain as the authenticated Yuki Mail account. Requires explicit user approval. If a password is provided it is used as the initial login password.",
        inputSchema: CreateMailboxSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          openWorldHint: false,
          idempotentHint: false,
        },
      }, writeScopes),
      async (args) => {
        if (args.confirm !== true) {
          return jsonResult({ success: false, error: "Explicit confirmation is required before creating a mailbox." });
        }
        if (mailboxDomain(args.email) !== mailboxDomain(env.MCP_MAILBOX)) {
          return jsonResult({
            success: false,
            error: "New mailboxes are restricted to the authenticated Yuki Mail domain.",
          });
        }

        try {
          await publicApiRequest<unknown>(env, "/public/addUser", {
            method: "POST",
            body: JSON.stringify({
              list: [{
                email: args.email,
                password: args.password || undefined,
              }],
            }),
          });

          return jsonResult({
            success: true,
            createdEmail: args.email,
            note: args.password
              ? "Mailbox created with the supplied initial password."
              : "Mailbox created. No password was returned; set/reset one in the Yuki Mail admin interface if interactive login is needed.",
          });
        } catch (error) {
          return jsonResult({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
    );
  }

  return server;
}

function corsPreflight() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
      "access-control-allow-headers": "authorization, content-type, mcp-session-id, mcp-protocol-version",
      "access-control-max-age": "86400",
    },
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return corsPreflight();
    }

    const oauthResponse = await handleOAuthRequest(request, env);
    if (oauthResponse) return oauthResponse;

    if (url.pathname === "/_diag-8f31c9/oauth-deps") {
      const started = Date.now();
      const kvStarted = Date.now();
      await env.AUTH_KV.get("mcp:diag:probe");
      const kvMs = Date.now() - kvStarted;

      const d1Started = Date.now();
      const row = await env.DB.prepare(`
        SELECT status, is_del AS isDel
        FROM user
        WHERE LOWER(email) = LOWER(?)
        LIMIT 1
      `).bind(env.MCP_MAILBOX).first<{ status: number; isDel: number }>();
      const d1Ms = Date.now() - d1Started;
      const lastAuthStage = await env.AUTH_KV.get("mcp:diag:last-auth-stage");
      const lastTokenStage = await env.AUTH_KV.get("mcp:diag:last-token-stage");
      const lastMcpStage = await env.AUTH_KV.get("mcp:diag:last-mcp-stage");

      return Response.json({
        ok: true,
        kvMs,
        d1Ms,
        totalMs: Date.now() - started,
        userFound: Boolean(row),
        userActive: Boolean(row && row.status === 0 && row.isDel === 0),
        signingSecretConfigured: Boolean(env.OAUTH_SIGNING_SECRET),
        lastAuthStage: lastAuthStage || null,
        lastTokenStage: lastTokenStage || null,
        lastMcpStage: lastMcpStage || null,
      }, { headers: { "cache-control": "no-store" } });
    }

    if (url.pathname === "/health") {
      return Response.json({
        ok: true,
        service: "yuki-mail-remote-mcp",
        version: "0.3.0",
        endpoints: {
          readonly: ISSUER + "/mcp",
          agent: ISSUER + "/agent/mcp",
        },
        mailbox: env.MCP_MAILBOX,
        oauth: "oauth2.1-pkce",
      }, {
        headers: { "cache-control": "no-store" },
      });
    }

    if (url.pathname === "/") {
      return Response.json({
        service: "Yuki Mail Remote MCP",
        endpoints: {
          readonly: ISSUER + "/mcp",
          agent: ISSUER + "/agent/mcp",
        },
        authentication: "OAuth 2.1 + PKCE",
      }, {
        headers: { "cache-control": "no-store" },
      });
    }

    const agentMode = url.pathname === "/agent/mcp";
    const readOnlyMode = url.pathname === "/mcp";
    if (!agentMode && !readOnlyMode) {
      return new Response("Not Found", { status: 404 });
    }

    if (!env.OAUTH_SIGNING_SECRET || !env.MCP_MAILBOX || !env.MAIL_API_URL) {
      return Response.json({ error: "Remote MCP is not fully configured" }, {
        status: 503,
        headers: { "cache-control": "no-store" },
      });
    }

    const requiredScopes = agentMode
      ? [MAIL_READ_SCOPE, MAIL_WRITE_SCOPE]
      : [MAIL_READ_SCOPE];

    if (agentMode) {
      const accept = request.headers.get("accept") || "";
      const contentType = request.headers.get("content-type") || "";
      const authorization = request.headers.get("authorization") || "";
      await env.AUTH_KV.put(
        "mcp:diag:last-mcp-stage",
        "request:" + request.method +
          ":auth=" + (authorization.toLowerCase().startsWith("bearer ") ? "bearer" : "none") +
          ":accept=" + accept.slice(0, 60) +
          ":content-type=" + contentType.slice(0, 60),
        { expirationTtl: 600 },
      );
    }

    if (!(await authenticateMcpRequest(request, env, requiredScopes))) {
      return oauthUnauthorized(
        "invalid_token",
        agentMode
          ? "Yuki Mail Agent requires read and write authorization"
          : "Yuki Mail read authorization is required",
        requiredScopes,
      );
    }

    if (agentMode) {
      await env.AUTH_KV.put("mcp:diag:last-mcp-stage", "auth-ok", { expirationTtl: 600 });
    }

    try {
      const handler = createMcpHandler(() => createServer(env, agentMode));
      if (agentMode) {
        await env.AUTH_KV.put("mcp:diag:last-mcp-stage", "handler-start", { expirationTtl: 600 });
      }
      const response = await handler(request, env, ctx);
      if (agentMode) {
        await env.AUTH_KV.put(
          "mcp:diag:last-mcp-stage",
          "handler-response:" + response.status,
          { expirationTtl: 600 },
        );
      }
      response.headers.set("cache-control", "no-store");
      return response;
    } catch (error) {
      if (agentMode) {
        const message = error instanceof Error ? error.message : String(error);
        await env.AUTH_KV.put(
          "mcp:diag:last-mcp-stage",
          "handler-error:" + message.slice(0, 180),
          { expirationTtl: 600 },
        );
      }
      throw error;
    }
  },
} satisfies ExportedHandler<Env>;
