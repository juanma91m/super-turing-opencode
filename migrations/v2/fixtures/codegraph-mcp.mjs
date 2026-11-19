// Synthetic catalog/query boundary only: no graph engine, init or index writes.
import fs from 'node:fs';
import { createInterface } from 'node:readline';

const tools = ['codegraph_explore', 'codegraph_search', 'codegraph_init'].map(name => ({
  name, description: 'Synthetic CodeGraph boundary probe', inputSchema: { type: 'object',
    properties: { query: { type: 'string' }, projectPath: { type: 'string' } }, required: ['query'], additionalProperties: false },
}));
for await (const line of createInterface({ input: process.stdin })) {
  const request = JSON.parse(line);
  if (request.id === undefined) continue;
  let result;
  if (request.method === 'initialize') result = { protocolVersion: request.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: 'CodeGraph fixture', version: '1' } };
  else if (request.method === 'tools/list') result = { tools };
  else if (request.method === 'tools/call') {
    if (request.params.name !== 'codegraph_explore' || request.params.arguments?.projectPath !== process.env.FIXTURE_ROOT) throw new Error('Unexpected forwarding into fixture');
    fs.appendFileSync(process.env.FIXTURE_LOG, JSON.stringify({ tool: request.params.name }) + '\n');
    result = { content: [{ type: 'text', text: 'FIXTURE_CODEGRAPH_READ: synthetic caller -> callee; no real index opened' }] };
  } else result = {};
  console.log(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }));
}
