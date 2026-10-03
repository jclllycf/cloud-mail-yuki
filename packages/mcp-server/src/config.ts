import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ServerConfig, CloudMailMode } from './types.js';

function loadDotEnv(): void {
  const envPaths = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '..', '.env'),
    resolve(process.cwd(), '..', '..', '.env'),
  ];

  for (const envPath of envPaths) {
    if (!existsSync(envPath)) continue;
    try {
      const content = readFileSync(envPath, 'utf8');
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (!match) continue;
        const key = match[1];
        let val = match[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (process.env[key] === undefined) {
          process.env[key] = val;
        }
      }
    } catch {
      // Ignore env file reading errors
    }
  }
}

export function loadConfig(): ServerConfig {
  loadDotEnv();

  const rawUrl = process.env.CLOUD_MAIL_API_URL?.trim() || 'https://mail.jcllyuki.com';
  let apiUrl = rawUrl.replace(/\/+$/, '');
  if (!apiUrl.endsWith('/api')) {
    apiUrl = `${apiUrl}/api`;
  }

  const token = process.env.CLOUD_MAIL_TOKEN?.trim();
  if (!token) {
    throw new Error(
      'Missing CLOUD_MAIL_TOKEN environment variable. Please set CLOUD_MAIL_TOKEN with your Public Token generated from /api/public/genToken.'
    );
  }

  const rawMode = process.env.CLOUD_MAIL_MODE?.trim().toLowerCase();
  let mode: CloudMailMode = 'ask';
  if (rawMode === 'readonly') {
    mode = 'readonly';
  } else if (rawMode === 'full') {
    mode = 'full';
  } else {
    mode = 'ask';
  }

  return {
    apiUrl,
    token,
    mode,
  };
}
