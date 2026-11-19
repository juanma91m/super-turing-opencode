import { Plugin } from '@opencode/plugin';
import { checkContext7 } from '../../policy.mjs';
export default Plugin.define({ id: 'opencode-stack.context7-access', async setup(ctx) {
  await ctx.tool.hook('execute.before', event => { if (event.tool.startsWith('context7_')) checkContext7(event.tool, event.input); });
} });
