import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { prepareGeneral, generalEnvironment } from '../profile.mjs';
import { terminalEnvironment } from '../launch.mjs';
import { startOwnedServer, until } from '../owned-server.mjs';
import { delegationStatus } from '../plugins/delegation-panel/status.mjs';

test('labels live and terminal states without interpreting idle as success', () => {
  assert.equal(delegationStatus({ permission: true, status: 'running' }), 'Espera permiso');
  assert.equal(delegationStatus({ form: true, status: 'running' }), 'Espera respuesta');
  assert.equal(delegationStatus({ status: 'running', terminal: 'failed' }), 'En ejecución');
  for (const [terminal, status] of Object.entries({ succeeded: 'Terminó', failed: 'Falló', interrupted: 'Interrumpida' })) {
    assert.equal(delegationStatus({ terminal }), status);
  }
  assert.equal(delegationStatus({ status: 'idle' }), 'Sin ejecución activa');
});

const binary = process.env.OPENCODE_TEST_DELEGATION_TUI;
test('installed TUI panel shows children of the current family and navigates without executing a task', { skip: !binary, timeout: 50000 }, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'delegation-tui-'));
  const project = path.join(root, 'repo');
  fs.mkdirSync(project);
  const socket = `delegation-tui-${process.pid}-${path.basename(root)}`;
  let server, terminal;
  const tm = (...args) => spawnSync('tmux', ['-L', socket, ...args], { encoding: 'utf8', env: terminal });
  const grab = () => tm('capture-pane', '-p', '-t', 'delegation').stdout ?? '';
  try {
    assert.equal(spawnSync('git', ['init', '-q', project]).status, 0);
    const profile = prepareGeneral(path.join(root, 'profile'), { project, mock: 'http://127.0.0.1:1/v1' });
    // Observe the public router without inferring route identity from a header:
    // OpenCode displays the parent tab while showing a child in its native view.
    const observer = path.join(root, 'route-observer');
    const routeFile = path.join(root, 'viewed-session');
    fs.mkdirSync(observer);
    fs.writeFileSync(path.join(observer, 'package.json'), JSON.stringify({ type: 'module', exports: { './tui': './tui.ts' } }));
    fs.writeFileSync(path.join(observer, 'tui.ts'), `
import { writeFileSync } from 'node:fs';
import { createEffect } from 'solid-js';
import { Plugin } from '@opencode/plugin/tui';
export default Plugin.define({ id: 'fixture.route-observer', setup(ctx) {
  return ctx.ui.slot({ append: 'app', render: () => {
    createEffect(() => { const route = ctx.ui.router.current(); if (route.type === 'session') writeFileSync(${JSON.stringify(routeFile)}, route.sessionID); });
    return null;
  }});
}});
`);
    const cliFile = path.join(profile.config, 'opencode/cli.json');
    const cli = JSON.parse(fs.readFileSync(cliFile, 'utf8'));
    cli.plugins.push({ package: observer });
    fs.writeFileSync(cliFile, JSON.stringify(cli));
    server = await startOwnedServer(binary, profile, generalEnvironment);
    const create = async (title, parentID) => {
      const made = await server.request('POST', '/api/session', {
        location: { directory: project }, agent: 'master-dev', title, model: { providerID: 'workshop-mock', id: 'mock' }, parentID,
      });
      assert.equal(made.status, 200);
      assert.equal(made.value.data.parentID, parentID);
      return made.value.data.id;
    };
    const parent = await create('Synthetic parent');
    const child = await create('Synthetic child visible', parent);
    await create('Synthetic unrelated hidden', await create('Synthetic other parent'));
    const quote = text => `'${text.replaceAll("'", "'\"'\"'")}'`;
    terminal = { ...terminalEnvironment(profile, server.connection, process.env), SHELL: '/bin/sh', TMUX: '' };
    const command = [binary, '--server', server.connection.url, '--session', parent].map(quote).join(' ');
    assert.equal(tm('-f', '/dev/null', 'new-session', '-d', '-s', 'delegation', '-x', '145', '-y', '40', '-c', project, `${command}; sleep 25`).status, 0);
    await until(() => grab().includes('Synthetic parent'), 'parent session loads', 15000);
    assert.equal(tm('send-keys', '-t', 'delegation', '-l', '/tareas-delegadas').status, 0);
    await until(() => grab().includes('/tareas-delegadas'), 'slash command is visible', 3000);
    assert.equal(tm('send-keys', '-t', 'delegation', 'Enter').status, 0);
    await until(() => grab().includes('Sin ejecución activa') && grab().includes('Synthetic child visible'), 'family panel renders child status', 12000);
    assert(!grab().includes('Synthetic unrelated hidden'));
    assert.equal(tm('send-keys', '-t', 'delegation', '-l', 'o').status, 0);
    await until(() => grab().includes('Ir a tarea delegada'), 'keyboard picker opens', 5000);
    assert.equal(tm('send-keys', '-t', 'delegation', 'Enter').status, 0);
    await until(() => fs.existsSync(routeFile) && fs.readFileSync(routeFile, 'utf8') === child && !grab().includes('Tareas delegadas'), 'native route opens child', 6000);
  } catch (error) {
    console.error(grab().replaceAll(root, '<fixture>'));
    throw error;
  } finally {
    tm('kill-server');
    await server?.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
