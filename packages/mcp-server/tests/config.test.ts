import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('throws error when CLOUD_MAIL_TOKEN is missing', () => {
    delete process.env.CLOUD_MAIL_TOKEN;
    expect(() => loadConfig()).toThrow(/Missing CLOUD_MAIL_TOKEN/);
  });

  it('loads valid configuration and defaults to ask mode', () => {
    process.env.CLOUD_MAIL_TOKEN = 'test-token-123';
    process.env.CLOUD_MAIL_API_URL = 'https://mail.jcllyuki.com';
    delete process.env.CLOUD_MAIL_MODE;

    const config = loadConfig();
    expect(config.token).toBe('test-token-123');
    expect(config.apiUrl).toBe('https://mail.jcllyuki.com/api');
    expect(config.mode).toBe('ask');
  });

  it('parses readonly mode correctly', () => {
    process.env.CLOUD_MAIL_TOKEN = 'test-token-123';
    process.env.CLOUD_MAIL_MODE = 'readonly';

    const config = loadConfig();
    expect(config.mode).toBe('readonly');
  });

  it('parses ask mode correctly', () => {
    process.env.CLOUD_MAIL_TOKEN = 'test-token-123';
    process.env.CLOUD_MAIL_MODE = 'ask';

    const config = loadConfig();
    expect(config.mode).toBe('ask');
  });

  it('parses full mode correctly', () => {
    process.env.CLOUD_MAIL_TOKEN = 'test-token-123';
    process.env.CLOUD_MAIL_MODE = 'full';

    const config = loadConfig();
    expect(config.mode).toBe('full');
  });

  it('normalizes API URL with trailing slashes and existing /api', () => {
    process.env.CLOUD_MAIL_TOKEN = 'test-token-123';
    process.env.CLOUD_MAIL_API_URL = 'https://mail.jcllyuki.com/api///';

    const config = loadConfig();
    expect(config.apiUrl).toBe('https://mail.jcllyuki.com/api');
  });
});
