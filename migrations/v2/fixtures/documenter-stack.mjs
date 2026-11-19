// Shared synthetic prior stack for document-tool integration tests. No real MCP
// backends unless a caller explicitly supplies the isolated browser runtime.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { knowledgeExtension } from '../../../../super-turing-opencode-knowledge/v2/composition.mjs';
import { ENGRAM_TOOLS } from '../../../../super-turing-opencode-knowledge/v2/engram-config.mjs';
import { ticketingExtension } from '../../../../super-turing-opencode-ticketing/v2/composition.mjs';
import { ROVO_TOOLS } from '../../../../super-turing-opencode-ticketing/v2/config.mjs';
import { codegraphExtension } from '../../../../super-turing-opencode-codegraph/v2/composition.mjs';
import { playwrightExtension } from '../../../v2/playwright/composition.mjs';
import { documentReaderExtension } from '../../../../super-turing-opencode-documents/v2/reader/composition.mjs';

const fixture = name => fileURLToPath(new URL('./' + name, import.meta.url));

export function fixtureStack(root, mock, realBrowser) {
  const mcp = (names, file) => ({ type: 'local', command: [process.execPath, fixture('ticketing-mcp.mjs')], environment: { FIXTURE_TOOLS: JSON.stringify(names), FIXTURE_LOG: path.join(root, file) }, codemode: false });
  const knowledge = knowledgeExtension({ runtimeHome: root + '/runtime-home', runtimeConfig: root + '/runtime-home/.config/opencode',
    server: mcp(ENGRAM_TOOLS.map(name => name.slice('engram_'.length)), 'engram-calls.jsonl'), permissions: ENGRAM_TOOLS.map(action => ({ action, resource: '*', effect: 'allow' })) });
  const ticketing = ticketingExtension({ server: mcp(ROVO_TOOLS.map(name => name.slice('atlassian-rovo_'.length)), 'rovo-calls.jsonl') });
  const graph = codegraphExtension({ binding: { runtime_home: root + '/runtime-home', runtime_bin: '/fixture/codegraph' }, server: { type: 'local', command: [process.execPath, fixture('codegraph-mcp.mjs')], environment: { FIXTURE_ROOT: path.join(root, 'home/project'), FIXTURE_LOG: path.join(root, 'graph-calls.jsonl') }, codemode: false } });
  const browser = playwrightExtension(realBrowser ? { runtime: realBrowser } : { runtime: { home: root + '/runtime-home', cli: '/fixture/cli.js', browser: '/fixture/chrome', version: '0.0.85' },
    server: { type: 'local', command: [process.execPath, fixture('playwright-mcp.mjs')], environment: { FIXTURE_LOG: path.join(root, 'browser-calls.jsonl') }, codemode: false } });
  const reader = documentReaderExtension();
  const extend = context => reader({ ...context, ...browser({ ...context, ...graph({ ...context, ...ticketing({ ...context, ...knowledge(context) }) }) }) });
  return { mock, context7: true, mcpFixture: { type: 'local', command: [process.execPath, fixture('context7-mcp.mjs')], environment: { CONTEXT7_FIXTURE_LOG: path.join(root, 'context7-calls.jsonl') }, codemode: false }, extend };
}
