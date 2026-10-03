import type { ServerConfig, CompactEmail, EmailDetail } from './types.js';

export class CloudMailClient {
  private apiUrl: string;
  private token: string;

  constructor(config: ServerConfig) {
    this.apiUrl = config.apiUrl;
    this.token = config.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.apiUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const headers: Record<string, string> = {
      Authorization: this.token,
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
      });
    } catch (err: any) {
      throw new Error(`Failed to connect to Cloud Mail at ${url}: ${err?.message || err}`);
    }

    if (response.status === 401) {
      throw new Error('Authentication failed (401): Invalid or rotated CLOUD_MAIL_TOKEN.');
    }

    let json: any;
    try {
      json = await response.json();
    } catch {
      const text = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: Non-JSON response from Cloud Mail: ${text.slice(0, 200)}`);
    }

    if (!response.ok || (json.code !== undefined && json.code !== 200 && json.code !== 0)) {
      const errorMsg = json.msg || json.message || `HTTP ${response.status}`;
      throw new Error(`Cloud Mail API error: ${errorMsg}`);
    }

    return (json.data !== undefined ? json.data : json) as T;
  }

  async listEmails(params: {
    compact?: boolean;
    box?: string;
    page?: number;
    size?: number;
    unreadOnly?: boolean;
    toEmail?: string;
    query?: string;
    since?: string;
    before?: string;
    emailId?: number;
  }): Promise<CompactEmail[]> {
    const body: Record<string, any> = {
      compact: params.compact ?? true,
      num: params.page ?? 1,
      size: params.size ?? 20,
    };

    if (params.toEmail) body.toEmail = params.toEmail;
    if (params.query) body.query = params.query;
    if (params.since) body.since = params.since;
    if (params.before) body.before = params.before;
    if (params.emailId) body.emailId = params.emailId;

    if (params.box === 'trash') {
      body.isDel = 1;
    } else {
      body.isDel = 0;
      if (params.box === 'sent') {
        body.type = 1;
      } else if (params.box === 'inbox') {
        body.type = 0;
      }
    }

    const data = await this.request<CompactEmail[]>('/public/emailList', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return Array.isArray(data) ? data : [];
  }

  async getEmailDetail(emailId: number): Promise<EmailDetail> {
    return this.request<EmailDetail>(`/public/email/${emailId}`, {
      method: 'GET',
    });
  }

  async sendEmail(params: {
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
    from?: string;
    cc?: string | string[];
    bcc?: string | string[];
  }): Promise<{ emailId: number; status: string; messageId?: string; toEmail: string; subject: string }> {
    return this.request<{ emailId: number; status: string; messageId?: string; toEmail: string; subject: string }>(
      '/public/send',
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    );
  }

  async deleteEmail(emailId: number): Promise<{ emailId: number; deleted: boolean; isDel: number }> {
    return this.request<{ emailId: number; deleted: boolean; isDel: number }>(`/public/email/${emailId}`, {
      method: 'DELETE',
    });
  }

  async createMailbox(email: string, password?: string): Promise<{ success: boolean }> {
    await this.request<void>('/public/addUser', {
      method: 'POST',
      body: JSON.stringify({
        list: [
          {
            email,
            password: password || undefined,
          },
        ],
      }),
    });
    return { success: true };
  }

  async fetchAttachmentText(url: string, maxLength: number = 8000): Promise<string> {
    const fullUrl = url.startsWith('http') ? url : `${this.apiUrl.replace(/\/api$/, '')}${url.startsWith('/') ? '' : '/'}${url}`;
    const res = await fetch(fullUrl, {
      headers: {
        Authorization: this.token,
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch attachment from ${fullUrl} (HTTP ${res.status})`);
    }

    const text = await res.text();
    return text.slice(0, maxLength);
  }
}
