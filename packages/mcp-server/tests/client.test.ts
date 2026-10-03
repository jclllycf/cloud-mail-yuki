import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CloudMailClient } from '../src/client.js';

describe('CloudMailClient', () => {
  const config = {
    apiUrl: 'https://mail.example.com/api',
    token: 'test-public-token',
    mode: 'full' as const,
  };

  let client: CloudMailClient;

  beforeEach(() => {
    client = new CloudMailClient(config);
    vi.restoreAllMocks();
  });

  it('normalizes 401 unauthorized to clear error message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 401,
      ok: false,
      json: async () => ({ code: 401, msg: 'Token expired' }),
    }));

    await expect(client.listEmails({})).rejects.toThrow(/Authentication failed \(401\)/);
  });

  it('normalizes business API errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ code: 500, msg: 'Database connection failed' }),
    }));

    await expect(client.listEmails({})).rejects.toThrow(/Cloud Mail API error: Database connection failed/);
  });

  it('sends compact emailList request with authorization header', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        code: 200,
        data: [
          {
            emailId: 101,
            sendEmail: 'alice@example.com',
            sendName: 'Alice',
            subject: 'Hello',
            createTime: '2026-10-03 12:00:00',
            hasAttachment: 0,
            attCount: 0,
            code: '123456',
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const list = await client.listEmails({ compact: true, box: 'inbox', size: 10 });
    expect(list).toHaveLength(1);
    expect(list[0].emailId).toBe(101);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://mail.example.com/api/public/emailList',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'test-public-token',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          compact: true,
          num: 1,
          size: 10,
          isDel: 0,
          type: 0,
        }),
      })
    );
  });

  it('gets email detail via GET /public/email/:emailId', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        code: 200,
        data: {
          emailId: 42,
          subject: 'Welcome',
          text: 'Welcome to Cloud Mail',
          content: '<p>Welcome to Cloud Mail</p>',
          attachments: [],
        },
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const detail = await client.getEmailDetail(42);
    expect(detail.emailId).toBe(42);
    expect(detail.text).toBe('Welcome to Cloud Mail');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://mail.example.com/api/public/email/42',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'test-public-token',
        }),
      })
    );
  });

  it('sends email via POST /public/send', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        code: 200,
        data: {
          emailId: 99,
          status: 'sent',
          messageId: 'cf-msg-99',
          toEmail: 'bob@example.com',
          subject: 'Hi Bob',
        },
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const res = await client.sendEmail({
      to: 'bob@example.com',
      subject: 'Hi Bob',
      text: 'Hello there!',
    });

    expect(res.emailId).toBe(99);
    expect(res.status).toBe('sent');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://mail.example.com/api/public/send',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          to: 'bob@example.com',
          subject: 'Hi Bob',
          text: 'Hello there!',
        }),
      })
    );
  });

  it('soft deletes email via DELETE /public/email/:emailId', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        code: 200,
        data: { emailId: 42, deleted: true, isDel: 1 },
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const res = await client.deleteEmail(42);
    expect(res.deleted).toBe(true);
    expect(res.emailId).toBe(42);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://mail.example.com/api/public/email/42',
      expect.objectContaining({
        method: 'DELETE',
      })
    );
  });

  it('creates mailbox via POST /public/addUser', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ code: 200, data: null }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const res = await client.createMailbox('bot@mail.example.com', 'Pass123!');
    expect(res.success).toBe(true);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://mail.example.com/api/public/addUser',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          list: [
            {
              email: 'bot@mail.example.com',
              password: 'Pass123!',
            },
          ],
        }),
      })
    );
  });
});
