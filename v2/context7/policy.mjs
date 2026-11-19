export const CONTEXT7_URL = 'https://mcp.context7.com/mcp';
export const CONTEXT7_TOOLS = ['context7_resolve-library-id', 'context7_query-docs'];
export function context7Server() {
  return { type: 'remote', url: CONTEXT7_URL, oauth: false, codemode: false, timeout: { startup: 30000, catalog: 30000, execution: 60000 } };
}
export function checkContext7(name, input) {
  if (!CONTEXT7_TOOLS.includes(name)) throw new Error('Context7: unapproved tool');
  if (typeof input?.query !== 'string' || !input.query.trim() || input.query.length > 1500) throw new Error('Context7: public documentation query required (max 1500 characters)');
  if (Object.values(input).some(value => typeof value === 'string' && /<\/?private\b/i.test(value))) throw new Error('Context7: private-marked content must not be sent');
  if (name.endsWith('resolve-library-id')) {
    if (typeof input.libraryName !== 'string' || !input.libraryName.trim() || input.libraryName.length > 200) throw new Error('Context7: library name required');
  } else if (typeof input.libraryId !== 'string' || !/^\/[A-Za-z0-9._/-]+$/.test(input.libraryId)) throw new Error('Context7: resolve a valid library ID first');
}
