// Catalog/permission fixture only; never opens a browser or network.
import fs from 'node:fs';
import { createInterface } from 'node:readline';
import { WIRE_TOOLS } from '../../../v2/playwright/config.mjs';

const tools = [...WIRE_TOOLS, 'unreviewed_tool'].map(name => ({ name, description: 'Synthetic browser permission probe',
  inputSchema: { type: 'object', properties: { mode: { type: 'string' }, url: { type: 'string' }, filename: { type: 'string' }, paths: { type: 'array', items: { type: 'string' } } } } }));
for await (const line of createInterface({ input: process.stdin })) {
  const request = JSON.parse(line); if (request.id === undefined) continue;
  let result;
  if (request.method === 'initialize') result = { protocolVersion: request.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: 'Playwright fixture', version: '1' } };
  else if (request.method === 'tools/list') result = { tools };
  else if (request.method === 'tools/call') {
    if (['browser_run_code_unsafe', 'unreviewed_tool'].includes(request.params.name)) throw new Error('Unsafe forwarding into browser fixture');
    fs.appendFileSync(process.env.FIXTURE_LOG, JSON.stringify({ tool: request.params.name }) + '\n');
    result = { content: [{ type: 'text', text: 'FIXTURE_PLAYWRIGHT_OK' }] };
  } else result = {};
  console.log(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }));
}
