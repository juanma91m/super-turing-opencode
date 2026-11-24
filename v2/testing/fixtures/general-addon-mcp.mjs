// Owned synthetic stdio MCP. Only tool names / summary-ID presence are logged.
import fs from 'node:fs';
import { createInterface } from 'node:readline';
if (process.env.FIXTURE_STARTUP_LOG) fs.appendFileSync(process.env.FIXTURE_STARTUP_LOG, 'started\n');
const tools = JSON.parse(process.env.FIXTURE_TOOLS).map(name => ({ name, description: 'Synthetic general addon integration fixture', inputSchema: name==='executeRead'
  ? {type:'object',properties:{name:{type:'string',minLength:1,maxLength:512},cloudId:{type:'string'},inputs:{type:'object',additionalProperties:{}},responseFields:{type:'array',items:{type:'string',maxLength:256},maxItems:50},view:{type:'string'}},required:['name'],additionalProperties:false}
  : { type: 'object', properties: {}, additionalProperties: true } }));
for await (const line of createInterface({ input: process.stdin })) {
  const request = JSON.parse(line); if (request.id === undefined) continue;
  let result;
  if (request.method === 'initialize') result = { protocolVersion: request.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: 'General addon fixture', version: '1' } };
  else if (request.method === 'tools/list') result = { tools };
  else if (request.method === 'tools/call') {
    fs.appendFileSync(process.env.FIXTURE_LOG, JSON.stringify({ tool: request.params.name, summarySessionProvided: typeof request.params.arguments?.session_id === 'string' }) + '\n');
    result = { content: [{ type: 'text', text: JSON.stringify({ fixture: true, tool: request.params.name, ok: true, session_id: request.params.arguments?.session_id }) }] };
  } else result = {};
  console.log(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }));
}
