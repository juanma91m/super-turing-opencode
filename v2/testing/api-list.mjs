import assert from 'node:assert/strict';

// V2 config.get returns Config.Entry[] directly; location-scoped lists such as
// agent.list return { location, data: [...] }. Do not dump either response body:
// configuration and integration metadata may contain sensitive values.
export async function getApiList(request, route) {
  const response = await request('GET', route);
  assert.equal(response.status, 200, `GET ${route}: unexpected HTTP status (body suppressed)`);
  const items = Array.isArray(response.value) ? response.value : response.value?.data;
  assert(Array.isArray(items), `GET ${route}: expected an array or { data: array } (body suppressed)`);
  return items;
}
