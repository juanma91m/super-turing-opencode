// Synthetic stdio server used by Ticketing integration tests only. Logs tool
// names, never arguments, and has no network or remote mutation implementation.
import fs from 'node:fs';
import { createInterface } from 'node:readline';

const tools = JSON.parse(process.env.FIXTURE_TOOLS).map(name => ({
  name, description: 'Synthetic Ticketing boundary probe',
  inputSchema: { type: 'object', properties: {
    cloudId: { type: 'string' }, issueIdOrKey: { type: 'string' }, query: { type: 'string' },
    id: { type: 'string' }, fields: { type: 'array', items: { type: 'string' } },
  }, additionalProperties: false },
}));
for await (const line of createInterface({ input: process.stdin })) {
  const request = JSON.parse(line);
  if (request.id === undefined) continue;
  let result;
  if (request.method === 'initialize') result = { protocolVersion: request.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: 'Ticketing fixture', version: '1' } };
  else if (request.method === 'tools/list') result = { tools };
  else if (request.method === 'tools/call') {
    fs.appendFileSync(process.env.FIXTURE_LOG, JSON.stringify({ tool: request.params.name }) + '\n');
    result = { content: [{ type: 'text', text: 'FIXTURE_ROVO_READ ' + request.params.name }] };
  } else result = {};
  console.log(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }));
}
