import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CloudMailClient } from '../src/client.js';
import { registerReadTools } from '../src/tools/read.js';
import { registerWriteTools } from '../src/tools/write.js';
import type { ServerConfig } from '../src/types.js';

describe('MCP Tools Suite', () => {
  let server: McpServer;
  let mockClient: CloudMailClient;

  function createRegisteredServer(mode: 'readonly' | 'full') {
    const s = new McpServer({ name: 'test', version: '1.0' });
    const config: ServerConfig = {
      apiUrl: 'https://mail.example.com/api',
      token: 'mock-token',
      mode,
    };
    mockClient = {
      listEmails: vi.fn(),
      getEmailDetail: vi.fn(),
      sendEmail: vi.fn(),
      deleteEmail: vi.fn(),
      createMailbox: vi.fn(),
      fetchAttachmentText: vi.fn(),
    } as unknown as CloudMailClient;

    registerReadTools(s, mockClient);
    registerWriteTools(s, mockClient, config);
    return s;
  }

  // Helper to execute tool registered on McpServer
  async function callTool(s: McpServer, name: string, args: Record<string, any>) {
    const registered = (s as any)._registeredTools[name];
    if (!registered) throw new Error(`Tool ${name} not found`);
    return registered.handler(args);
  }

  describe('READ Tools', () => {
    beforeEach(() => {
      server = createRegisteredServer('readonly');
    });

    it('cloud_mail_list returns compact metadata without body', async () => {
      vi.mocked(mockClient.listEmails).mockResolvedValue([
        {
          emailId: 1,
          sendEmail: 'alice@example.com',
          sendName: 'Alice',
          toEmail: 'me@jcllyuki.com',
          toName: 'Me',
          subject: 'Test Subject',
          createTime: '2026-10-03 10:00:00',
          type: 0,
          isDel: 0,
          unread: 1,
          code: '123456',
          hasAttachment: 1,
          attCount: 1,
        },
      ]);

      const res = await callTool(server, 'cloud_mail_list', { box: 'inbox', page: 1, pageSize: 20 });
      const parsed = JSON.parse(res.content[0].text);

      expect(parsed.count).toBe(1);
      expect(parsed.emails[0].emailId).toBe(1);
      expect(parsed.emails[0].subject).toBe('Test Subject');
      expect(parsed.emails[0].verificationCode).toBe('123456');
      expect(parsed.emails[0].hasAttachment).toBe(true);
      // Ensure body was not returned
      expect(parsed.emails[0].text).toBeUndefined();
      expect(parsed.emails[0].content).toBeUndefined();
    });

    it('cloud_mail_search returns compact search results', async () => {
      vi.mocked(mockClient.listEmails).mockResolvedValue([
        {
          emailId: 2,
          sendEmail: 'service@github.com',
          sendName: 'GitHub',
          toEmail: 'me@jcllyuki.com',
          toName: 'Me',
          subject: 'Security Alert',
          createTime: '2026-10-03 11:00:00',
          type: 0,
          isDel: 0,
          unread: 0,
          code: '',
          hasAttachment: 0,
          attCount: 0,
        },
      ]);

      const res = await callTool(server, 'cloud_mail_search', { query: 'Security', limit: 5 });
      const parsed = JSON.parse(res.content[0].text);

      expect(parsed.count).toBe(1);
      expect(parsed.emails[0].emailId).toBe(2);
      expect(parsed.emails[0].from).toBe('GitHub <service@github.com>');
      expect(parsed.emails[0].text).toBeUndefined();
    });

    it('cloud_mail_get returns text and omits html by default', async () => {
      vi.mocked(mockClient.getEmailDetail).mockResolvedValue({
        emailId: 10,
        sendEmail: 'alice@example.com',
        sendName: 'Alice',
        toEmail: 'me@jcllyuki.com',
        toName: 'Me',
        subject: 'Full Email',
        createTime: '2026-10-03 12:00:00',
        type: 0,
        status: 0,
        unread: 0,
        isDel: 0,
        code: '',
        messageId: '<msg-10@example.com>',
        inReplyTo: '',
        relation: '',
        text: 'This is the plain text body.',
        content: '<div><h1>This is HTML</h1></div>',
        attachments: [],
      });

      const resDefault = await callTool(server, 'cloud_mail_get', { emailId: 10, includeHtml: false });
      const parsedDefault = JSON.parse(resDefault.content[0].text);
      expect(parsedDefault.emailId).toBe(10);
      expect(parsedDefault.text).toBe('This is the plain text body.');
      expect(parsedDefault.html).toBeUndefined();

      const resWithHtml = await callTool(server, 'cloud_mail_get', { emailId: 10, includeHtml: true });
      const parsedWithHtml = JSON.parse(resWithHtml.content[0].text);
      expect(parsedWithHtml.html).toBe('<div><h1>This is HTML</h1></div>');
    });

    it('cloud_mail_get_verification_code prioritizes D1 code', async () => {
      vi.mocked(mockClient.listEmails).mockResolvedValue([
        {
          emailId: 25,
          sendEmail: 'support@github.com',
          sendName: 'GitHub',
          toEmail: 'me@jcllyuki.com',
          toName: 'Me',
          subject: 'Your GitHub verification code',
          createTime: new Date().toISOString(),
          type: 0,
          isDel: 0,
          unread: 1,
          code: '829401', // Pre-extracted by Workers AI in D1
          hasAttachment: 0,
          attCount: 0,
        },
      ]);

      const res = await callTool(server, 'cloud_mail_get_verification_code', { serviceName: 'GitHub' });
      const parsed = JSON.parse(res.content[0].text);

      expect(parsed.found).toBe(true);
      expect(parsed.code).toBe('829401');
      expect(parsed.source).toBe('d1_ai_code');
      // Should not need to call getEmailDetail if code is already present
      expect(mockClient.getEmailDetail).not.toHaveBeenCalled();
    });

    it('cloud_mail_get_verification_code falls back to regex when D1 code is empty', async () => {
      vi.mocked(mockClient.listEmails).mockResolvedValue([
        {
          emailId: 30,
          sendEmail: 'noreply@openai.com',
          sendName: 'OpenAI',
          toEmail: 'me@jcllyuki.com',
          toName: 'Me',
          subject: 'Your OpenAI code',
          createTime: new Date().toISOString(),
          type: 0,
          isDel: 0,
          unread: 1,
          code: '', // Empty in D1
          hasAttachment: 0,
          attCount: 0,
        },
      ]);

      vi.mocked(mockClient.getEmailDetail).mockResolvedValue({
        emailId: 30,
        sendEmail: 'noreply@openai.com',
        sendName: 'OpenAI',
        toEmail: 'me@jcllyuki.com',
        toName: 'Me',
        subject: 'Your OpenAI code',
        createTime: new Date().toISOString(),
        type: 0,
        status: 0,
        unread: 1,
        isDel: 0,
        code: '',
        messageId: '',
        inReplyTo: '',
        relation: '',
        text: 'Your verification code is: 593812. It will expire in 10 minutes.',
        content: '<p>Your verification code is: 593812.</p>',
        attachments: [],
      });

      const res = await callTool(server, 'cloud_mail_get_verification_code', { serviceName: 'OpenAI' });
      const parsed = JSON.parse(res.content[0].text);

      expect(parsed.found).toBe(true);
      expect(parsed.code).toBe('593812');
      expect(parsed.source).toBe('regex_fallback');
    });

    it('cloud_mail_get_attachment returns preview for text files and link for binary', async () => {
      vi.mocked(mockClient.getEmailDetail).mockResolvedValue({
        emailId: 50,
        sendEmail: 'sender@example.com',
        sendName: 'Sender',
        toEmail: 'me@jcllyuki.com',
        toName: 'Me',
        subject: 'Attachments',
        createTime: '2026-10-03 12:00:00',
        type: 0,
        status: 0,
        unread: 0,
        isDel: 0,
        code: '',
        messageId: '',
        inReplyTo: '',
        relation: '',
        text: 'See attached',
        content: '',
        attachments: [
          {
            attId: 1,
            filename: 'data.csv',
            mimeType: 'text/csv',
            size: 120,
            key: 'attachments/data.csv',
            disposition: 'attachment',
            contentId: '',
            url: 'https://mail.example.com/oss/attachments/data.csv',
          },
          {
            attId: 2,
            filename: 'report.pdf',
            mimeType: 'application/pdf',
            size: 50000,
            key: 'attachments/report.pdf',
            disposition: 'attachment',
            contentId: '',
            url: 'https://mail.example.com/oss/attachments/report.pdf',
          },
        ],
      });

      vi.mocked(mockClient.fetchAttachmentText).mockResolvedValue('col1,col2\nval1,val2');

      // Test text attachment
      const resText = await callTool(server, 'cloud_mail_get_attachment', { emailId: 50, attId: 1 });
      const parsedText = JSON.parse(resText.content[0].text);
      expect(parsedText.isText).toBe(true);
      expect(parsedText.previewContent).toBe('col1,col2\nval1,val2');

      // Test binary attachment
      const resBin = await callTool(server, 'cloud_mail_get_attachment', { emailId: 50, attId: 2 });
      const parsedBin = JSON.parse(resBin.content[0].text);
      expect(parsedBin.isText).toBe(false);
      expect(parsedBin.previewContent).toBeUndefined();
      expect(parsedBin.downloadUrl).toBe('https://mail.example.com/oss/attachments/report.pdf');
    });
  });

  describe('WRITE Tools & Safety Guard', () => {
    it('in readonly mode, rejects send, delete, and create_mailbox deterministically', async () => {
      const readonlyServer = createRegisteredServer('readonly');

      const sendRes = await callTool(readonlyServer, 'cloud_mail_send', {
        to: 'user@example.com',
        subject: 'Hello',
        text: 'Test',
      });
      const parsedSend = JSON.parse(sendRes.content[0].text);
      expect(parsedSend.success).toBe(false);
      expect(parsedSend.error).toMatch(/Write operation rejected/);
      expect(mockClient.sendEmail).not.toHaveBeenCalled();

      const delRes = await callTool(readonlyServer, 'cloud_mail_delete', { emailId: 99 });
      const parsedDel = JSON.parse(delRes.content[0].text);
      expect(parsedDel.success).toBe(false);
      expect(parsedDel.error).toMatch(/Write operation rejected/);
      expect(mockClient.deleteEmail).not.toHaveBeenCalled();

      const createRes = await callTool(readonlyServer, 'cloud_mail_create_mailbox', {
        email: 'test@jcllyuki.com',
      });
      const parsedCreate = JSON.parse(createRes.content[0].text);
      expect(parsedCreate.success).toBe(false);
      expect(parsedCreate.error).toMatch(/Write operation rejected/);
      expect(mockClient.createMailbox).not.toHaveBeenCalled();
    });

    it('in full mode, dispatches send, delete, and create_mailbox successfully', async () => {
      const fullServer = createRegisteredServer('full');

      // 1. sendEmail
      vi.mocked(mockClient.sendEmail).mockResolvedValue({
        emailId: 101,
        status: 'sent',
        toEmail: 'user@example.com',
        subject: 'Hello',
      });
      const sendRes = await callTool(fullServer, 'cloud_mail_send', {
        to: 'user@example.com',
        subject: 'Hello',
        text: 'Test',
      });
      const parsedSend = JSON.parse(sendRes.content[0].text);
      expect(parsedSend.success).toBe(true);
      expect(parsedSend.emailId).toBe(101);
      expect(mockClient.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'user@example.com', subject: 'Hello' })
      );

      // 2. deleteEmail (soft delete)
      vi.mocked(mockClient.deleteEmail).mockResolvedValue({
        emailId: 88,
        deleted: true,
        isDel: 1,
      });
      const delRes = await callTool(fullServer, 'cloud_mail_delete', { emailId: 88 });
      const parsedDel = JSON.parse(delRes.content[0].text);
      expect(parsedDel.success).toBe(true);
      expect(parsedDel.emailId).toBe(88);
      expect(mockClient.deleteEmail).toHaveBeenCalledWith(88);

      // 3. createMailbox
      vi.mocked(mockClient.createMailbox).mockResolvedValue({ success: true });
      const createRes = await callTool(fullServer, 'cloud_mail_create_mailbox', {
        email: 'agent-bot@jcllyuki.com',
      });
      const parsedCreate = JSON.parse(createRes.content[0].text);
      expect(parsedCreate.success).toBe(true);
      expect(parsedCreate.createdEmail).toBe('agent-bot@jcllyuki.com');
      expect(mockClient.createMailbox).toHaveBeenCalledWith('agent-bot@jcllyuki.com', undefined);
    });
  });
});
