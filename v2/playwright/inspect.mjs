import assert from 'node:assert/strict';
import { PLAYWRIGHT_ROLES, PLAYWRIGHT_TOOLS } from './config.mjs';

const matches = (pattern, value) => new RegExp('^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*').replaceAll('?', '.') + '$').test(value);
const effect = (rules, action) => rules.findLast(rule => rule.resource === '*' && matches(rule.action, action))?.effect;

export async function inspectPlaywright(get, roles) {
  const agents = await get('/api/agent');
  for (const role of roles) {
    const agent = agents.find(item => item.id === role); assert(agent, 'Browser actor missing');
    for (const tool of PLAYWRIGHT_TOOLS) assert.equal(effect(agent.permissions, tool), PLAYWRIGHT_ROLES.includes(role) ? 'allow' : 'deny', role + ' Playwright permission');
    assert.equal(effect(agent.permissions, 'playwright_browser_run_code_unsafe'), 'deny', 'Unsafe host execution must stay denied');
    assert.equal(effect(agent.permissions, 'playwright_unreviewed_tool'), 'deny', 'Unknown browser tools must stay denied');
  }
  assert((await get('/api/skill')).some(item => item.id === 'playwright-ui-opencode'), 'Missing browser workflow skill');
  const mcp = await get('/api/mcp');
  assert(!mcp.some(item => item.name === 'stitch'), 'Stitch is excluded from this composition');
  const browser = mcp.find(item => item.name === 'playwright'); assert(browser, 'Playwright not registered');
  return { playwrightStatus: browser.status?.status, playwrightActors: PLAYWRIGHT_ROLES.length, playwrightTools: PLAYWRIGHT_TOOLS.length, unsafeBrowserCodeEnabled: false,
    personalProfileReused: false, actualBrowserToolCalls: 0 };
}
