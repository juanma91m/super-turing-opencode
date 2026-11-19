// Public HTTP-only stored history, called inside the native server. No SQL,
// internal service import, arbitrary endpoint, raw logging or credential file.
// The pin bundles plugin imports separately. Share an opaque fixed-GET closure
// in host RAM, not module cache identity or a globally exposed auth descriptor.
import assert from 'node:assert/strict';
import fs from 'node:fs';
let connection;
const SERVICE = Symbol.for('opencode-stack.owned-stored-history.v1');

function ownedConnection(env) {
  if (connection) return connection;
  assert(env.OPENCODE_STACK_TRANSPORT_FD === '3', 'Owned launcher transport required; no history fallback');
  let receipt;
  try { const bytes = fs.readFileSync(3); assert(bytes.length <= 1024); receipt = JSON.parse(bytes.toString('utf8')); }
  catch { throw new Error('Owned in-memory transport unavailable; values suppressed'); }
  finally { try { fs.closeSync(3); } catch {} }
  assert(Object.keys(receipt).sort().join(',') === 'password,pid,url,version' && receipt.version === 1 && receipt.pid === process.pid, 'Foreign native host refused');
  const url = new URL(receipt.url);
  assert(url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.port && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash, 'Owned loopback endpoint shape required');
  assert(typeof receipt.password === 'string' && receipt.password.length >= 16, 'Owned in-memory native authentication required');
  connection = { url: url.href, authorization: 'Basic ' + Buffer.from('opencode:' + receipt.password).toString('base64') };
  return connection;
}

export function nativeMessages(env = process.env) {
  async function read(host, input, single, signal) {
    assert(/^ses_[A-Za-z0-9]+$/.test(input.sessionID) && (!single || /^msg_[A-Za-z0-9]+$/.test(input.messageID)), 'Native message identity required');
    const url = new URL(host.url);
    url.pathname = '/api/session/' + input.sessionID + '/message' + (single ? '/' + input.messageID : '');
    if (!single) for (const key of ['type', 'limit', 'order', 'cursor']) if (input[key] !== undefined) url.searchParams.set(key, String(input[key]));
    try {
      const response = await fetch(url, { method: 'GET', redirect: 'error', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000), headers: { Authorization: host.authorization } });
      assert(response.ok && response.body, 'Native history HTTP read failed');
      let size = 0; const chunks = [];
      for await (const chunk of response.body) { size += chunk.length; assert(size <= 8 * 1024 * 1024, 'Native page too large; narrow scope'); chunks.push(chunk); }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch { throw new Error('Native stored history unavailable/cancelled/oversized; raw values suppressed'); }
  }
  async function request(input, single, signal) {
    if (!globalThis[SERVICE]) {
      const host = ownedConnection(env);
      Object.defineProperty(globalThis, SERVICE, { value: (input, single, signal) => read(host, input, single, signal) });
    }
    return globalThis[SERVICE](input, single, signal);
  }
  return { get: (input, signal) => request(input, true, signal), list: (input, signal) => request(input, false, signal) };
}
