import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CloudMailClient } from '../client.js';
import {
  ListEmailsSchema,
  SearchEmailsSchema,
  GetEmailSchema,
  GetVerificationCodeSchema,
  GetAttachmentSchema,
} from '../types.js';
import { extractVerificationCode } from '../utils/regex.js';

function jsonResult(data: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

export function registerReadTools(server: McpServer, client: CloudMailClient): void {
  // 1. cloud_mail_list
  server.registerTool(
    'cloud_mail_list',
    {
      description:
        'List emails in a mailbox folder (inbox, sent, trash, drafts). Returns COMPACT metadata only (no HTML or full text) to keep LLM context clean. Call cloud_mail_get to read the full body of a specific email.',
      inputSchema: ListEmailsSchema.shape,
      annotations: {
        readOnlyHint: true,
      },
    },
    async (args) => {
      try {
        const emails = await client.listEmails({
          compact: true,
          box: args.box,
          page: args.page,
          size: args.pageSize,
          unreadOnly: args.unreadOnly,
          toEmail: args.toEmail,
        });

        const compactList = emails.map((e) => ({
          emailId: e.emailId,
          from: e.sendName ? `${e.sendName} <${e.sendEmail}>` : e.sendEmail,
          to: e.toName ? `${e.toName} <${e.toEmail}>` : e.toEmail,
          subject: e.subject || '(No Subject)',
          receivedAt: e.createTime,
          unread: Boolean(e.unread),
          hasAttachment: Boolean(e.hasAttachment || e.attCount > 0),
          attCount: Number(e.attCount || 0),
          verificationCode: e.code || undefined,
        }));

        return jsonResult({
          box: args.box,
          page: args.page,
          count: compactList.length,
          emails: compactList,
        });
      } catch (err: any) {
        return jsonResult({ error: err?.message || String(err) });
      }
    }
  );

  // 2. cloud_mail_search
  server.registerTool(
    'cloud_mail_search',
    {
      description:
        'Search emails across sender, recipient, subject, text, and date ranges. By default returns up to 10 compact results without email bodies to preserve LLM context. Call cloud_mail_get to view the full content of an email.',
      inputSchema: SearchEmailsSchema.shape,
      annotations: {
        readOnlyHint: true,
      },
    },
    async (args) => {
      try {
        const emails = await client.listEmails({
          compact: true,
          query: args.query,
          toEmail: args.to,
          size: args.limit || 10,
          since: args.since,
          before: args.before,
        });

        let filtered = emails;
        if (args.from) {
          const fromFilter = args.from.toLowerCase();
          filtered = filtered.filter(
            (e) => e.sendEmail?.toLowerCase().includes(fromFilter) || e.sendName?.toLowerCase().includes(fromFilter)
          );
        }
        if (args.subject) {
          const subFilter = args.subject.toLowerCase();
          filtered = filtered.filter((e) => e.subject?.toLowerCase().includes(subFilter));
        }

        const compactList = filtered.slice(0, args.limit || 10).map((e) => ({
          emailId: e.emailId,
          from: e.sendName ? `${e.sendName} <${e.sendEmail}>` : e.sendEmail,
          to: e.toName ? `${e.toName} <${e.toEmail}>` : e.toEmail,
          subject: e.subject || '(No Subject)',
          receivedAt: e.createTime,
          unread: Boolean(e.unread),
          hasAttachment: Boolean(e.hasAttachment || e.attCount > 0),
          verificationCode: e.code || undefined,
        }));

        return jsonResult({
          count: compactList.length,
          query: args.query,
          emails: compactList,
        });
      } catch (err: any) {
        return jsonResult({ error: err?.message || String(err) });
      }
    }
  );

  // 3. cloud_mail_get
  server.registerTool(
    'cloud_mail_get',
    {
      description:
        'Retrieve full details and body content of a specific email by emailId. Always returns clean plain text. HTML content is omitted by default unless includeHtml=true is requested.',
      inputSchema: GetEmailSchema.shape,
      annotations: {
        readOnlyHint: true,
      },
    },
    async (args) => {
      try {
        const detail = await client.getEmailDetail(args.emailId);
        if (!detail) {
          return jsonResult({ error: `Email with ID ${args.emailId} not found` });
        }

        const responsePayload: Record<string, any> = {
          emailId: detail.emailId,
          from: detail.sendName ? `${detail.sendName} <${detail.sendEmail}>` : detail.sendEmail,
          to: detail.toName ? `${detail.toName} <${detail.toEmail}>` : detail.toEmail,
          subject: detail.subject || '(No Subject)',
          receivedAt: detail.createTime,
          unread: Boolean(detail.unread),
          verificationCode: detail.code || undefined,
          messageId: detail.messageId || undefined,
          inReplyTo: detail.inReplyTo || undefined,
          text: detail.text || '',
          attachments: (detail.attachments || []).map((a) => ({
            attId: a.attId,
            filename: a.filename,
            mimeType: a.mimeType,
            sizeBytes: a.size,
            downloadUrl: a.url,
          })),
        };

        if (args.includeHtml && detail.content) {
          responsePayload.html = detail.content;
        }

        return jsonResult(responsePayload);
      } catch (err: any) {
        return jsonResult({ error: err?.message || String(err) });
      }
    }
  );

  // 4. cloud_mail_get_verification_code
  server.registerTool(
    'cloud_mail_get_verification_code',
    {
      description:
        'Fast and token-efficient tool to retrieve the latest verification code received in the inbox. Prioritizes the pre-extracted database code column (from Cloudflare Workers AI ingestion) with lightweight regex fallback on email text.',
      inputSchema: GetVerificationCodeSchema.shape,
      annotations: {
        readOnlyHint: true,
      },
    },
    async (args) => {
      try {
        const candidates = await client.listEmails({
          compact: true,
          box: 'inbox',
          size: 15,
          toEmail: args.toEmail,
        });

        const now = Date.now();
        const maxAgeMs = (args.maxAgeMinutes || 15) * 60 * 1000;

        const filtered = candidates.filter((e) => {
          if (!e.createTime) return true;
          const emailTime = new Date(e.createTime).getTime();
          if (isNaN(emailTime)) return true;
          return now - emailTime <= maxAgeMs;
        });

        // Search matching emails by serviceName or from
        const matchService = (e: any) => {
          if (args.serviceName) {
            const s = args.serviceName.toLowerCase();
            const hit =
              e.sendEmail?.toLowerCase().includes(s) ||
              e.sendName?.toLowerCase().includes(s) ||
              e.subject?.toLowerCase().includes(s);
            if (!hit) return false;
          }
          if (args.from) {
            const f = args.from.toLowerCase();
            if (!e.sendEmail?.toLowerCase().includes(f)) return false;
          }
          return true;
        };

        const targetEmails = filtered.filter(matchService);

        // 1. First pass: Check if pre-extracted code exists in D1
        for (const e of targetEmails) {
          if (e.code && e.code.trim()) {
            return jsonResult({
              found: true,
              emailId: e.emailId,
              code: e.code.trim(),
              from: e.sendName ? `${e.sendName} <${e.sendEmail}>` : e.sendEmail,
              to: e.toEmail,
              subject: e.subject,
              receivedAt: e.createTime,
              source: 'd1_ai_code',
            });
          }
        }

        // 2. Second pass: Fallback to regex extraction on latest email detail text
        for (const e of targetEmails.slice(0, 3)) {
          const detail = await client.getEmailDetail(e.emailId);
          if (detail?.text || detail?.subject) {
            const extracted = extractVerificationCode(detail.text || '', detail.subject || '');
            if (extracted) {
              return jsonResult({
                found: true,
                emailId: e.emailId,
                code: extracted,
                from: detail.sendName ? `${detail.sendName} <${detail.sendEmail}>` : detail.sendEmail,
                to: detail.toEmail,
                subject: detail.subject,
                receivedAt: detail.createTime,
                source: 'regex_fallback',
              });
            }
          }
        }

        return jsonResult({
          found: false,
          message: 'No verification code found in recent matching emails.',
          checkedEmailCount: targetEmails.length,
        });
      } catch (err: any) {
        return jsonResult({ error: err?.message || String(err) });
      }
    }
  );

  // 5. cloud_mail_get_attachment
  server.registerTool(
    'cloud_mail_get_attachment',
    {
      description:
        'Retrieve attachment metadata or preview text content. For text-like files (txt, json, csv, log, md), returns preview text up to maxTextLength. For binary files (pdf, zip, images), returns metadata and download URL without polluting context with binary data.',
      inputSchema: GetAttachmentSchema.shape,
      annotations: {
        readOnlyHint: true,
      },
    },
    async (args) => {
      try {
        const detail = await client.getEmailDetail(args.emailId);
        if (!detail) {
          return jsonResult({ error: `Email ID ${args.emailId} not found` });
        }

        const att = (detail.attachments || []).find((a) => a.attId === args.attId);
        if (!att) {
          return jsonResult({
            error: `Attachment ID ${args.attId} not found on email ${args.emailId}`,
            availableAttachments: (detail.attachments || []).map((a) => ({ attId: a.attId, filename: a.filename })),
          });
        }

        const isTextLike =
          /^text\/|application\/(json|xml|csv|javascript)/i.test(att.mimeType || '') ||
          /\.(txt|json|csv|log|md|xml|js|ts)$/i.test(att.filename || '');

        if (!isTextLike) {
          return jsonResult({
            attId: att.attId,
            filename: att.filename,
            mimeType: att.mimeType,
            sizeBytes: att.size,
            isText: false,
            downloadUrl: att.url,
            note: 'Binary attachment not rendered inline to preserve model context. Use downloadUrl to access.',
          });
        }

        const previewText = await client.fetchAttachmentText(att.url, args.maxTextLength || 8000);
        return jsonResult({
          attId: att.attId,
          filename: att.filename,
          mimeType: att.mimeType,
          sizeBytes: att.size,
          isText: true,
          previewContent: previewText,
          downloadUrl: att.url,
        });
      } catch (err: any) {
        return jsonResult({ error: err?.message || String(err) });
      }
    }
  );
}
