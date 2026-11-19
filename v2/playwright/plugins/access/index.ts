import { Plugin } from '@opencode/plugin';
import { register } from './access.mjs';
export default Plugin.define({ id: 'opencode-stack.playwright-access', setup: register });
