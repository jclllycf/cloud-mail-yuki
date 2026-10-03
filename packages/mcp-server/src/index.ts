#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { CloudMailClient } from './client.js';
import { registerReadTools } from './tools/read.js';
import { registerWriteTools } from './tools/write.js';

async function main() {
  const config = loadConfig();
  const client = new CloudMailClient(config);

  const server = new McpServer({
    name: 'cloud-mail-mcp',
    version: '1.0.0',
  });

  // Register read tools (always active)
  registerReadTools(server, client);

  // Register guarded write tools (governed by CLOUD_MAIL_MODE)
  registerWriteTools(server, client, config);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`[cloud-mail-mcp] Server running on stdio (mode: ${config.mode})`);
}

main().catch((err) => {
  console.error('[cloud-mail-mcp] Startup error:', err);
  process.exit(1);
});
