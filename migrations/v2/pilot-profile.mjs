import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { layout, noSymlinks, prepare } from './staging.mjs';

export const AGENT = 'v2-pilot';
export const MODEL = 'gpt-6.1-sol';
const guard = fileURLToPath(new URL('./pilot-guard/', import.meta.url));
const envGuard = fileURLToPath(new URL('../../v2/plugins/env-guard/', import.meta.url));

export function pilotConfig(p, sha256, mock) {
  const provider = mock ? 'pilot-mock' : 'openai';
  const model = mock ? 'mock' : MODEL;
  if (mock) {
    const url = new URL(mock);
    assert(url.hostname === '127.0.0.1' && url.protocol === 'http:' && !url.username && !url.password);
  }
  const readRules = [
    { action: '*', resource: '*', effect: 'deny' },
    { action: 'read', resource: 'fixture-readme.txt', effect: 'allow' },
    { action: 'read', resource: path.join(p.project, 'fixture-readme.txt'), effect: 'allow' },
  ];
  return {
    $schema: 'https://opencode.ai/config.json',
    model: `${provider}/${model}`, default_agent: AGENT,
    update: 'disable', snapshots: false, warming: false, compaction: { auto: false },
    mcp: { servers: {} }, skills: [], permissions: readRules,
    agents: {
      build: { disabled: true }, plan: { disabled: true }, general: { disabled: true }, explore: { disabled: true },
      [AGENT]: {
        description: 'Primera prueba V2: chat y lectura de un único archivo sintético', mode: 'primary',
        model: `${provider}/${model}${mock ? '' : '#high'}`, permissions: readRules,
        system: 'Sos el piloto inicial de OpenCode V2. Respondé en español. Podés conversar y usar read exclusivamente para fixture-readme.txt. No hay shell, ediciones, delegación, MCP, skills ni acceso a repos reales. No inventes resultados de herramientas. No solicites ni reproduzcas credenciales.',
      },
    },
    policies: [
      { action: 'provider.use', resource: '*', effect: 'deny' },
      { action: 'provider.use', resource: provider, effect: 'allow' },
      { action: 'integration.connect', resource: '*', effect: 'deny' },
      ...(!mock ? [{ action: 'integration.connect', resource: 'openai', effect: 'allow' }] : []),
      { action: 'mcp.use', resource: '*', effect: 'deny' },
      { action: 'skill.use', resource: '*', effect: 'deny' },
      { action: 'websearch.use', resource: '*', effect: 'deny' },
      { action: 'tool.use', resource: '*', effect: 'deny' },
      { action: 'tool.use', resource: 'read:fixture-readme.txt', effect: 'allow' },
      { action: 'tool.use', resource: `read:${path.join(p.project, 'fixture-readme.txt')}`, effect: 'allow' },
    ],
    plugins: [envGuard, { package: guard, options: { project: p.project, sha256, provider, model } }],
    ...(mock ? { providers: {
      [provider]: { package: '@opencode/ai/providers/openai-compatible', settings: { baseURL: mock, apiKey: 'synthetic-not-a-credential' },
        models: { mock: { modelID: 'mock', name: 'Mock', capabilities: { tools: true, input: ['text'], output: ['text'] }, limit: { context: 32768, output: 4096 } } } },
    } } : {}),
  };
}

function ownedFile(file, content) {
  noSymlinks(file);
  const text = typeof content === 'string' ? content : JSON.stringify(content, null, 2) + '\n';
  if (fs.existsSync(file)) assert.equal(fs.readFileSync(file, 'utf8'), text, `Pilot asset changed; refusing overwrite: ${path.basename(file)}`);
  else fs.writeFileSync(file, text, { flag: 'wx', mode: 0o600 });
}

export function preparePilot(root, mock) {
  const p = layout(root);
  noSymlinks(root);
  const alreadyOwned = fs.existsSync(p.marker);
  prepare(p);
  const fixture = path.join(p.project, 'fixture-readme.txt');
  noSymlinks(fixture);
  if (!fs.existsSync(fixture)) {
    assert(!alreadyOwned, 'Existing pilot fixture missing; refusing regeneration');
    fs.writeFileSync(fixture, `Archivo sintético para la primera prueba de V2.\nread_probe=READ_OK_${randomUUID()}\n`, { flag: 'wx', mode: 0o400 });
  }
  const sha256 = createHash('sha256').update(fs.readFileSync(fixture)).digest('hex');
  const configFile = path.join(p.config, 'opencode/opencode.json');
  const cliFile = path.join(p.config, 'opencode/cli.json');
  const config = pilotConfig(p, sha256, mock);
  if (!alreadyOwned) {
    // Only replace the seed written by prepare() during this fresh creation.
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
    fs.writeFileSync(cliFile, JSON.stringify({ $schema: 'https://opencode.ai/v2/cli.json', attention: { notifications: false, sound: false }, session: { permissions: 'prompt' }, prompt: { editor: false } }, null, 2) + '\n', { mode: 0o600 });
  } else ownedFile(configFile, config);
  noSymlinks(cliFile);
  const cli = JSON.parse(fs.readFileSync(cliFile, 'utf8'));
  assert.equal(cli.session?.permissions, 'prompt', 'Pilot refuses automatic permission acceptance');
  assert(!cli.plugins?.length, 'Pilot refuses additional terminal plugins');
  ownedFile(path.join(root, 'fixture.sha256'), sha256 + '\n');
  return { ...p, fixture, document: config };
}
