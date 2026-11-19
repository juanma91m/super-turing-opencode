// Deterministic MCP stdio fixture. No remote calls; never logs query bodies.
import fs from 'node:fs';
import { createInterface } from 'node:readline';

const tools = [
  { name: 'resolve-library-id', description: 'Synthetic library resolver', inputSchema: { type: 'object', properties: { libraryName: { type: 'string' }, query: { type: 'string' } }, required: ['libraryName', 'query'] } },
  { name: 'query-docs', description: 'Synthetic documentation query', inputSchema: { type: 'object', properties: { libraryId: { type: 'string' }, query: { type: 'string' }, language: { type: 'string' } }, required: ['libraryId', 'query'] } },
  { name: 'unapproved-operation', description: 'Must not be exposed or invoked', inputSchema: { type: 'object', properties: {} } },
];
for await (const line of createInterface({ input: process.stdin })) {
  const request = JSON.parse(line);
  if (request.id === undefined) continue;
  let result;
  if (request.method === 'initialize') result = { protocolVersion: request.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: 'Context7 fixture', version: '1.0.0' } };
  else if (request.method === 'tools/list') result = { tools };
  else if (request.method === 'tools/call') {
    fs.appendFileSync(process.env.CONTEXT7_FIXTURE_LOG, JSON.stringify({ tool: request.params.name, sessionMetadataPresent: Boolean(request.params._meta?.['ai.opencode/sessionID']) }) + '\n');
    result = { content: [{ type: 'text', text: request.params.name === 'resolve-library-id' ? 'Context7-compatible library ID: /fixture/react' : 'FIXTURE_DOCS: useEffect cleanup returns an unsubscribe function. Synthetic, not a live documentation claim.' }] };
  } else result = {};
  console.log(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }));
}
