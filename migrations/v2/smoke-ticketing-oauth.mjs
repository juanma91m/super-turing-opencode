// Full native OAuth on loopback fixtures ONLY. Authorization URL/state/PKCE
// values are never logged. Native dummy credentials live only in the disposable
// fixture database; no operator credentials or auth stores are opened.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { environment, layout, verify } from './staging.mjs';
import { prepareWorkshop } from './workshop-profile.mjs';
import { getApiList } from './api-list.mjs';
import { startServer, until } from './private-server.mjs';
import { dcrLoopbackServer, rovoIdentityServer, rovoDiscoveryServer, ROVO_IDENTITY_SCOPES } from '../../../super-turing-opencode-ticketing/v2/oauth-compat.mjs';

const base = layout(path.join(os.homedir(), '.local/share/opencode-v2-clean'));
let phase = 'setup'; // Only static labels, never authorization values.

async function freePort() {
  const socket = net.createServer();
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  return port;
}

async function run(mode) {
  phase = mode + ': setup';
  const dcr = mode !== 'cimd';
  const identityRequired = mode.startsWith('dcr-identity');
  const identityRequested = mode === 'dcr-identity';
  const discovery = mode === 'dcr-discovery';
  const published = ['fixture.read', ...ROVO_IDENTITY_SCOPES, ...(discovery ? ['fixture.write', 'offline_access'] : [])];
  const scopes = discovery ? published.join(' ') : identityRequested ? 'fixture.read read:account email' : 'fixture.read';
  const root = fs.mkdtempSync('/tmp/opencode/rovo-oauth-');
  let origin, registration, authorization, exchanged = false, fixtureError, httpRequests = 0;
  const as = http.createServer(async (request, response) => {
    httpRequests++;
    try {
      const url = new URL(request.url, origin);
      const json = (status, body, headers = {}) => { response.writeHead(status, { 'Content-Type': 'application/json', ...headers }); response.end(JSON.stringify(body)); };
      if (url.pathname === '/.well-known/oauth-protected-resource/mcp') return json(200, { resource: origin + '/mcp', authorization_servers: [origin], scopes_supported: published, bearer_methods_supported: ['header'] });
      if (url.pathname === '/.well-known/oauth-authorization-server') return json(200, {
        issuer: origin, authorization_endpoint: origin + '/authorize', token_endpoint: origin + '/token', registration_endpoint: origin + '/register',
        response_types_supported: ['code'], grant_types_supported: ['authorization_code', 'refresh_token'], scopes_supported: published,
        token_endpoint_auth_methods_supported: ['none'], code_challenge_methods_supported: ['S256'], client_id_metadata_document_supported: true,
      });
      if (url.pathname === '/register') {
        assert.equal(request.method, 'POST');
        let raw = ''; for await (const chunk of request) raw += chunk;
        registration = JSON.parse(raw);
        assert.equal(registration.token_endpoint_auth_method, 'none');
        return json(201, { ...registration, client_id: 'fixture-native-client', client_id_issued_at: 1 });
      }
      if (url.pathname === '/authorize') {
        authorization = url.searchParams;
        if (authorization.get('client_id')?.startsWith('https://opencode.ai/')) return json(400, { error: 'invalid_request', error_description: 'Fixture rejects metadata-document clients' });
        assert.equal(authorization.get('client_id'), 'fixture-native-client');
        const redirect = authorization.get('redirect_uri');
        assert(registration.redirect_uris.includes(redirect), 'Registered and requested callbacks differ');
        assert.equal(registration.scope, authorization.get('scope'), 'Registration and authorization scopes diverged');
        // A synthetic required-identity rule, not a claim about Atlassian's
        // internals. The only profile delta in the positive mode is scope.
        const requested = new Set(authorization.get('scope').split(' '));
        if (identityRequired && !ROVO_IDENTITY_SCOPES.every(scope => requested.has(scope))) return json(400, { error: 'invalid_request', error_description: 'Fixture requires identity scopes' });
        const callback = new URL(redirect);
        callback.searchParams.set('code', 'fixture-code'); callback.searchParams.set('state', authorization.get('state')); callback.searchParams.set('iss', origin);
        response.writeHead(302, { Location: callback.toString() }); response.end(); return;
      }
      if (url.pathname === '/token') {
        let raw = ''; for await (const chunk of request) raw += chunk;
        const body = new URLSearchParams(raw);
        assert.equal(body.get('grant_type'), 'authorization_code');
        assert.equal(body.get('client_id'), 'fixture-native-client');
        assert.equal(body.get('redirect_uri'), authorization.get('redirect_uri'));
        assert.equal(createHash('sha256').update(body.get('code_verifier')).digest('base64url'), authorization.get('code_challenge'), 'Native PKCE proof mismatch');
        exchanged = true;
        return json(200, { access_token: 'fixture-native-access', refresh_token: 'fixture-native-refresh', token_type: 'Bearer', expires_in: 3600, scope: authorization.get('scope') });
      }
      if (url.pathname === '/mcp') {
        if (request.headers.authorization !== 'Bearer fixture-native-access') return json(401, { error: 'fixture_auth_required' }, { 'WWW-Authenticate': `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp"${discovery ? '' : ', scope="fixture.read"'}` });
        let raw = ''; for await (const chunk of request) raw += chunk;
        if (!raw) { response.writeHead(405); response.end(); return; }
        const message = JSON.parse(raw);
        if (message.id === undefined) { response.writeHead(202); response.end(); return; }
        return json(200, { jsonrpc: '2.0', id: message.id, result: message.method === 'initialize'
          ? { protocolVersion: message.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: 'OAuth fixture', version: '1' } }
          : { tools: [] } });
      }
      json(404, { error: 'fixture_not_found' });
    } catch (error) { fixtureError = error.message; response.writeHead(500); response.end('Fixture failure; body suppressed'); }
  });
  await new Promise(resolve => as.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${as.address().port}`;
  let server;
  try {
    const port = await freePort();
    const p = prepareWorkshop(root, { mock: 'http://127.0.0.1:1234/v1' });
    const document = structuredClone(p.document);
    const native = { type: 'remote', url: origin + '/mcp', codemode: false, oauth: { scope: 'fixture.read' } };
    let selected = dcr ? dcrLoopbackServer(native, port) : native;
    if (identityRequested) selected = rovoIdentityServer(selected);
    if (discovery) selected = rovoDiscoveryServer(selected);
    document.mcp.servers['atlassian-rovo'] = selected;
    document.policies.push({ action: 'mcp.use', resource: 'atlassian-rovo', effect: 'allow' }, { action: 'integration.connect', resource: '*', effect: 'allow' });
    fs.writeFileSync(path.join(p.config, 'opencode/opencode.json'), JSON.stringify(document, null, 2) + '\n');
    const debug = spawnSync(base.binary, ['debug', 'config', '--standalone'], { cwd: p.project, env: environment(p), encoding: 'utf8', timeout: 30000 });
    assert.equal(debug.status, 0, 'OAuth fixture config rejected; body suppressed');
    for (const source of JSON.parse(debug.stdout)) assert(source.path.startsWith(root + path.sep), 'Foreign fixture config source');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(httpRequests, 0, 'Standalone debug config unexpectedly contacted the provider');
    phase = mode + ': native startup';
    server = await startServer(base.binary, p);
    const mcp = await until(async () => (await getApiList(server.request, '/api/mcp')).find(item => item.name === 'atlassian-rovo' && item.integrationID), 'fixture OAuth registration');
    const integration = await until(async () => (await getApiList(server.request, '/api/integration')).find(item => item.id === mcp.integrationID && item.methods.some(method => method.type === 'oauth')), 'fixture OAuth method');
    const methodID = integration.methods.find(method => method.type === 'oauth').id;
    const route = `/api/integration/${encodeURIComponent(mcp.integrationID)}/connect/oauth`;
    phase = mode + ': native OAuth begin';
    const connected = await server.request('POST', route, { methodID });
    assert.equal(connected.status, 200, 'Native OAuth begin failed; body suppressed');
    const attempt = connected.value.data ?? connected.value;
    const url = new URL(attempt.url);
    assert.equal(url.origin, origin, 'Authorization escaped the loopback fixture');
    phase = mode + ': scope selection';
    assert.equal(url.searchParams.get('scope'), scopes);
    assert.equal(url.searchParams.get('resource'), origin + '/mcp');
    assert.equal(url.searchParams.get('audience'), null, 'Do not add unrelated authorization parameters');
    phase = mode + ': prompt selection';
    assert.equal(url.searchParams.get('prompt'), null, 'Native V2 does not add prompt; do not invent authorization parameters');
    phase = mode + ': provider authorization and callback';
    const result = await fetch(url, { redirect: 'manual' });
    if (mode === 'cimd' || mode === 'dcr-identity-missing') {
      assert.equal(result.status, 400);
      if (mode === 'cimd') assert.equal(registration, undefined);
      else assert(registration, 'DCR must complete before the identity-negative control');
      assert.equal(exchanged, false);
      // This attempt belongs only to our fixture, never to the operator's flow.
      await server.request('DELETE', route + '/' + encodeURIComponent(attempt.attemptID));
    } else {
      assert.equal(result.status, 302);
      const callback = new URL(result.headers.get('location'));
      assert.equal(callback.hostname, '127.0.0.1'); assert.equal(Number(callback.port), port);
      const completed = await fetch(callback, { redirect: 'error' });
      assert.equal(completed.status, 200, 'Native loopback callback/token exchange failed');
      const status = await until(async () => {
        if (fixtureError) throw new Error('Local OAuth fixture failed; values suppressed');
        const response = await server.request('GET', route + '/' + encodeURIComponent(attempt.attemptID));
        const value = response.value.data ?? response.value;
        return value.status === 'complete' ? value : undefined;
      }, 'native DCR token storage');
      assert.equal(status.status, 'complete'); assert(exchanged);
    }
    assert(!fixtureError, 'Local OAuth fixture failed; values suppressed');
    console.log(JSON.stringify({ mode, registration: mode === 'cimd' ? 'metadata document selected; rejected by fixture' : 'DCR selected; exact callback registered',
      identityRequested, providerScopeDiscovery: discovery, nativePromptConsent: url.searchParams.get('prompt') === 'consent', nativePkceAndTokenExchange: exchanged, identityRule: identityRequired ? 'synthetic fixture only; not provider proof' : 'not imposed', realAtlassianRequests: 0, realCredentialsUsed: false, authorizationValuesLogged: false }));
  } finally {
    await server?.close(); as.closeAllConnections(); await new Promise(resolve => as.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  }
}

verify(base);
try { await run('cimd'); await run('dcr'); await run('dcr-identity-missing'); await run('dcr-identity'); await run('dcr-discovery'); }
catch { console.error(`Native OAuth fixture failed at ${phase}; authorization values suppressed`); process.exitCode = 1; }
