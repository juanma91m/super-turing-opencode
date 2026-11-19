import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const broker = fileURLToPath(new URL('../../../scripts/planner_shell.py', import.meta.url));

export function checkPlanner(event, directory, runner = spawnSync, approvedBroker = broker) {
  if (event.tool !== 'shell') return;
  if (!event.agent) throw new Error('Cannot resolve executing shell actor; planner guard fails closed');
  if (!['planner', 'plan'].includes(event.agent)) return;
  const input = event.input ?? {};
  const cwd = path.resolve(directory, input.workdir ?? input.cwd ?? directory);
  const result = runner('python3', [approvedBroker, '--check'], {
    input: JSON.stringify({ command: input.command, cwd, project_root: directory }),
    encoding: 'utf8', timeout: 10000,
  });
  if (result.error || result.status !== 0) throw new Error('Planner shell blocked by canonical broker policy');
}

export async function register(ctx) {
  // The public event identifies the executing turn. Never infer this from the
  // last user message: a queued agent switch may belong to the next turn.
  await ctx.tool.hook('execute.before', event => checkPlanner(event, ctx.location.directory, spawnSync, ctx.options.broker ?? broker));
}
