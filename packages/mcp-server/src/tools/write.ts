import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CloudMailClient } from '../client.js';
import type { ServerConfig } from '../types.js';
import {
  SendEmailSchema,
  DeleteEmailSchema,
  CreateMailboxSchema,
} from '../types.js';

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

function checkWritable(config: ServerConfig, toolName: string): string | null {
  if (config.mode === 'readonly') {
    return `Write operation rejected: Tool "${toolName}" is disabled because CLOUD_MAIL_MODE is set to "readonly". Set CLOUD_MAIL_MODE=ask (default, user approval required) or CLOUD_MAIL_MODE=full to enable write operations.`;
  }
  return null;
}

export function registerWriteTools(server: McpServer, client: CloudMailClient, config: ServerConfig): void {
  // 6. cloud_mail_send
  server.registerTool(
    'cloud_mail_send',
    {
      description:
        'Send a new email immediately. HIGH RISK: This sends real emails to external recipients. Blocked in readonly mode; requires user confirmation in ask mode.',
      inputSchema: SendEmailSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      const blocked = checkWritable(config, 'cloud_mail_send');
      if (blocked) {
        return jsonResult({ error: blocked, success: false });
      }

      try {
        const result = await client.sendEmail({
          to: args.to,
          subject: args.subject,
          text: args.text,
          html: args.html,
          from: args.from,
          cc: args.cc,
          bcc: args.bcc,
        });

        return jsonResult({
          success: true,
          emailId: result.emailId,
          status: result.status,
          to: result.toEmail,
          subject: result.subject,
          messageId: result.messageId || undefined,
        });
      } catch (err: any) {
        return jsonResult({ error: err?.message || String(err), success: false });
      }
    }
  );

  // 7. cloud_mail_delete
  server.registerTool(
    'cloud_mail_delete',
    {
      description:
        'Soft-delete an email by moving it to the trash folder (reversible via Web UI). DESTRUCTIVE ACTION: Blocked in readonly mode; requires user confirmation in ask mode.',
      inputSchema: DeleteEmailSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
      },
    },
    async (args) => {
      const blocked = checkWritable(config, 'cloud_mail_delete');
      if (blocked) {
        return jsonResult({ error: blocked, success: false });
      }

      try {
        const result = await client.deleteEmail(args.emailId);
        return jsonResult({
          success: true,
          emailId: result.emailId,
          deleted: result.deleted,
          note: 'Email soft-deleted (moved to trash). Reversible in Web Admin.',
        });
      } catch (err: any) {
        return jsonResult({ error: err?.message || String(err), success: false });
      }
    }
  );

  // 8. cloud_mail_create_mailbox
  server.registerTool(
    'cloud_mail_create_mailbox',
    {
      description:
        'Create a new email address / mailbox under your configured Cloud Mail domain. Blocked in readonly mode; requires user confirmation in ask mode.',
      inputSchema: CreateMailboxSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
      },
    },
    async (args) => {
      const blocked = checkWritable(config, 'cloud_mail_create_mailbox');
      if (blocked) {
        return jsonResult({ error: blocked, success: false });
      }

      try {
        await client.createMailbox(args.email, args.password);
        return jsonResult({
          success: true,
          createdEmail: args.email,
          note: 'New mailbox successfully created and ready to receive emails.',
        });
      } catch (err: any) {
        return jsonResult({ error: err?.message || String(err), success: false });
      }
    }
  );
}
