import { z } from 'zod';

export type CloudMailMode = 'readonly' | 'ask' | 'full';

export interface ServerConfig {
  apiUrl: string;
  token: string;
  mode: CloudMailMode;
}

export interface CompactEmail {
  emailId: number;
  sendEmail: string;
  sendName: string;
  toEmail: string;
  toName: string;
  subject: string;
  createTime: string;
  type: number;
  isDel: number;
  unread: number;
  code: string;
  hasAttachment: boolean | number;
  attCount: number;
}

export interface AttachmentMetadata {
  attId: number;
  filename: string;
  mimeType: string;
  size: number;
  key: string;
  disposition: string;
  contentId: string;
  url: string;
}

export interface EmailDetail {
  emailId: number;
  sendEmail: string;
  sendName: string;
  toEmail: string;
  toName: string;
  subject: string;
  createTime: string;
  type: number;
  status: number;
  unread: number;
  isDel: number;
  code: string;
  messageId: string;
  inReplyTo: string;
  relation: string;
  text: string;
  content: string;
  attachments: AttachmentMetadata[];
}

export interface VerificationCodeResult {
  emailId: number;
  code: string;
  from: string;
  to: string;
  subject: string;
  receivedAt: string;
  source: 'd1_ai_code' | 'regex_fallback';
}

export const ListEmailsSchema = z.object({
  box: z.enum(['inbox', 'sent', 'trash', 'drafts']).default('inbox').describe('Mailbox folder to list'),
  page: z.number().int().min(1).default(1).describe('Page number, 1-indexed'),
  pageSize: z.number().int().min(1).max(50).default(20).describe('Number of emails per page (max 50)'),
  unreadOnly: z.boolean().default(false).describe('Filter only unread emails'),
  toEmail: z.string().optional().describe('Filter by specific recipient address'),
});

export const SearchEmailsSchema = z.object({
  query: z.string().optional().describe('Substring search across subject, sender, and text'),
  from: z.string().optional().describe('Sender email filter'),
  to: z.string().optional().describe('Recipient email filter'),
  subject: z.string().optional().describe('Subject substring filter'),
  since: z.string().optional().describe('Filter emails on or after this ISO date/time (e.g. "2026-10-01")'),
  before: z.string().optional().describe('Filter emails on or before this ISO date/time (e.g. "2026-10-31")'),
  limit: z.number().int().min(1).max(50).default(10).describe('Max results to return (default 10)'),
});

export const GetEmailSchema = z.object({
  emailId: z.number().int().positive().describe('Unique ID of the email to retrieve'),
  includeHtml: z.boolean().default(false).describe('Whether to include raw HTML body. Default false to preserve LLM context; plain text is always provided.'),
});

export const GetVerificationCodeSchema = z.object({
  serviceName: z.string().optional().describe('Optional name of the sending service to look for, e.g. "GitHub", "Google", "OpenAI"'),
  from: z.string().optional().describe('Optional sender email address'),
  toEmail: z.string().optional().describe('Optional recipient email address'),
  maxAgeMinutes: z.number().int().min(1).max(1440).default(15).describe('Max age of the email in minutes (default 15)'),
});

export const GetAttachmentSchema = z.object({
  emailId: z.number().int().positive().describe('ID of the email containing the attachment'),
  attId: z.number().int().positive().describe('ID of the attachment record'),
  maxTextLength: z.number().int().min(100).max(50000).default(8000).describe('Max characters to preview for text-like attachments (default 8000)'),
});

export const SendEmailSchema = z.object({
  to: z.union([z.string(), z.array(z.string())]).describe('Recipient email address or array of recipient addresses'),
  subject: z.string().min(1).describe('Email subject line'),
  text: z.string().optional().describe('Plain text body content (recommended)'),
  html: z.string().optional().describe('HTML body content (at least one of text or html is required)'),
  from: z.string().optional().describe('Sender email address (must belong to your configured domain; defaults to admin)'),
  cc: z.union([z.string(), z.array(z.string())]).optional().describe('CC recipient(s)'),
  bcc: z.union([z.string(), z.array(z.string())]).optional().describe('BCC recipient(s)'),
});

export const DeleteEmailSchema = z.object({
  emailId: z.number().int().positive().describe('Email ID to soft delete (moves email to trash)'),
});

export const CreateMailboxSchema = z.object({
  email: z.string().describe('New email address to create (domain must match your configured Cloud Mail domain)'),
  password: z.string().optional().describe('Optional initial password. A strong random password will be generated if omitted.'),
});
