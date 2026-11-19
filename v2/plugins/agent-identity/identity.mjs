import assert from 'node:assert/strict';
import { nativeMessages } from '../../native-history.mjs';

function project(message, index) {
  return { index, type: message.type,
    ...(message.type === 'assistant' ? { agent: message.agent ?? 'unknown-agent' } : {}),
    ...(['assistant', 'compaction'].includes(message.type) ? {
      model: { providerID: message.model?.providerID ?? 'unknown-provider', id: message.model?.id ?? 'unknown-model', ...(message.model?.variant ? { variant: message.model.variant } : {}) },
    } : {}),
  };
}
export function attribution(messages) {
  return {
    scope: 'model-visible-context', completeHistory: false,
    messages: messages.map((message, index) => project(message, index + 1)),
  };
}

export async function storedAttribution(sessionID, messages, signal, pageSize = 100) {
  assert(Number.isSafeInteger(pageSize) && pageSize >= 1 && pageSize <= 100, 'Native history page size invalid');
  const projected = [], ids = new Set(), cursors = new Set(); let cursor;
  do {
    signal?.throwIfAborted();
    const page = await messages.list({ sessionID, limit: pageSize, ...(cursor ? { cursor } : { order: 'asc' }) }, signal);
    assert(Array.isArray(page?.data) && page.cursor && (page.cursor.next == null || typeof page.cursor.next === 'string'), 'Native history pagination unavailable; no partial attribution');
    for (const message of page.data) {
      assert(typeof message.id === 'string' && !ids.has(message.id) && typeof message.type === 'string', 'Duplicate/invalid native history row; no partial attribution');
      ids.add(message.id); projected.push(project(message, projected.length + 1));
    }
    cursor = page.cursor.next;
    if (cursor) { assert(!cursors.has(cursor), 'Native history cursor repeated; no partial attribution'); cursors.add(cursor); }
  } while (cursor);
  signal?.throwIfAborted();
  return { scope: 'stored-session-history', completeHistory: true, messages: projected,
    coverage: 'All enumerated stored rows of this session, not an atomic snapshot, related sessions, deleted or external work. Not a V1 history migration guarantee.' };
}

export async function register(ctx, messages = nativeMessages()) {
  assert(ctx.options?.history === undefined || ctx.options.history === 'stored', 'Unknown attribution history mode');
  const stored = ctx.options?.history === 'stored';
  await ctx.session.hook('context', event => {
    event.system.push({ type: 'text', text: `You are currently operating as the "${event.agent}" agent.` });
  });
  await ctx.tool.transform(editor => editor.add({
    name: 'agent_attribution',
    description: stored ? 'Return per-message agent/model metadata from all stored pages of the current session, including before compaction. No message bodies, other sessions, deleted work or V1 migration guarantee.' : 'Return agent/model metadata for the current model-visible session context. Not a complete history audit; excludes message bodies.',
    input: { type: 'object', properties: {}, additionalProperties: false }, options: { codemode: false },
    async execute(_input, context) {
      await ctx.permission.assert({ sessionID: context.sessionID, agent: context.agent, action: 'agent_attribution', resources: ['*'], save: ['*'], source: { type: 'tool', messageID: context.messageID, id: context.id } });
      const result = stored ? await storedAttribution(context.sessionID, messages, context.signal, ctx.options.pageSize)
        : attribution(await ctx.session.context({ sessionID: context.sessionID }));
      return { content: JSON.stringify(result) };
    },
  }));
}
