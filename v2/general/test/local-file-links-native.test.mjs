import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { prepareGeneral, generalEnvironment } from '../profile.mjs';
import { terminalEnvironment } from '../launch.mjs';
import { startOwnedServer, until } from '../owned-server.mjs';

const binary = process.env.OPENCODE_TEST_LOCAL_FILE_TUI;

test('native TUI opens an outside PDF and a legacy review link with their desktop defaults', { skip: !binary, timeout: 55000 }, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'local-file-tui-'));
  const project = path.join(root, 'fixture repo');
  const report = path.join(project, 'tmp/VB-1/code-review/code-review-1.md');
  const document = path.join(root, 'documento fuera del repo.pdf');
  const answer = `Informe guardado:\n\n\`\`\`opencode-review-report\n${report}\n\`\`\`\n\n` +
    `Archivo de salida:\n\n\`\`\`opencode-local-file\n${document}\n\`\`\`\n\n` +
    `No es un enlace local válido:\n\n\`\`\`opencode-local-file\n./relative.pdf\n\`\`\`\n`;
  const body = 'VERIFIED REPORT BODY 41E7';
  const homeConfig = path.join(root, 'desktop-config'), homeData = path.join(root, 'desktop-data');
  const mdMarker = path.join(root, 'opened-md'), pdfMarker = path.join(root, 'opened-pdf'), script = path.join(root, 'record-open.sh');
  const mock = http.createServer(async (request, response) => {
    for await (const _ of request) { /* Fixture provider discards the prompt. */ }
    response.writeHead(200, { 'content-type': 'text/event-stream' });
    const emit = (delta, finish_reason = null) => response.write('data: ' + JSON.stringify({
      id: 'review-fixture', object: 'chat.completion.chunk', created: 1, model: 'mock', choices: [{ index: 0, delta, finish_reason }],
    }) + '\n\n');
    emit({ role: 'assistant', content: answer });
    emit({}, 'stop');
    response.end('data: [DONE]\n\n');
  });
  let server, terminal;
  const socket = `review-tui-${process.pid}-${path.basename(root)}`;
  const tm = (...args) => spawnSync('tmux', ['-L', socket, ...args], { encoding: 'utf8', env: terminal });
  const grab = () => tm('capture-pane', '-p', '-t', 'review').stdout ?? '';
  try {
    fs.mkdirSync(path.dirname(report), { recursive: true });
    assert.equal(spawnSync('git', ['init', '-q', project]).status, 0);
    fs.writeFileSync(report, `# Fixture\n\n${body}\n`, { mode: 0o600 });
    fs.writeFileSync(document, '%PDF-1.7\n');
    fs.mkdirSync(homeConfig);
    fs.mkdirSync(path.join(homeData, 'applications'), { recursive: true });
    fs.writeFileSync(script, '#!/bin/sh\nprintf "%s\\n" "$1" > "$2"\n');
    for (const [kind, mime, marker] of [['md', 'text/markdown', mdMarker], ['pdf', 'application/pdf', pdfMarker]]) {
      fs.writeFileSync(path.join(homeData, 'applications', `local-file-${kind}-fixture.desktop`), [
        '[Desktop Entry]', 'Type=Application', `Name=Fixture ${kind} Handler`,
        `Exec=/bin/sh "${script}" %f "${marker}"`, `MimeType=${mime};`, 'NoDisplay=true', '',
      ].join('\n'));
    }
    fs.writeFileSync(path.join(homeConfig, 'mimeapps.list'), '[Default Applications]\ntext/markdown=local-file-md-fixture.desktop;\napplication/pdf=local-file-pdf-fixture.desktop;\n');
    await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve));
    const profile = prepareGeneral(path.join(root, 'profile'), { project, mock: `http://127.0.0.1:${mock.address().port}/v1` });
    server = await startOwnedServer(binary, profile, generalEnvironment);
    const made = await server.request('POST', '/api/session', {
      location: { directory: project }, agent: 'master-dev', title: 'Review UI fixture', model: { providerID: 'workshop-mock', id: 'mock' },
    });
    assert.equal(made.status, 200);
    const id = made.value.data.id;
    assert.equal((await server.request('POST', `/api/session/${id}/prompt`, { text: 'Simulate one finished report.' })).status, 200);
    await until(async () => {
      const r = await server.request('GET', `/api/session/${id}/context`);
      return r.value.data.at(-1)?.type === 'idle' && JSON.stringify(r.value.data).includes('opencode-local-file');
    }, 'mock assistant reply', 15000);
    const quote = text => `'${text.replaceAll("'", "'\"'\"'")}'`;
    terminal = { ...terminalEnvironment(profile, server.connection, {
      XDG_CONFIG_HOME: homeConfig, XDG_DATA_HOME: homeData,
    }), SHELL: '/bin/sh', TMUX: '' };
    const command = [binary, '--server', server.connection.url, '--session', id].map(quote).join(' ');
    assert.equal(tm('-f', '/dev/null', 'new-session', '-d', '-s', 'review', '-x', '155', '-y', '43', '-c', project, `${command}; sleep 25`).status, 0);
    await until(() => ['Abrir informe', 'Abrir archivo', './relative.pdf'].every(text => grab().includes(text)), 'local links rendered', 18000);
    assert.equal(grab().split('Abrir archivo').length - 1, 1, 'Relative target must not become a link');
    assert(!fs.existsSync(mdMarker) && !fs.existsSync(pdfMarker), 'Rendering does not open files');
    for (const [label, marker, target] of [['Abrir archivo', pdfMarker, document], ['Abrir informe', mdMarker, report]]) {
      const rows = grab().split('\n');
      const row = rows.findIndex(line => line.includes(label)), col = rows[row].indexOf(label) + 2;
      const event = (n, suffix) => `\x1b[<${n};${col};${row + 1}${suffix}`;
      assert.equal(tm('send-keys', '-t', 'review', '-l', event(0, 'M') + event(0, 'm')).status, 0);
      await until(() => fs.existsSync(marker) && fs.readFileSync(marker, 'utf8') === target + '\n', 'correct desktop handler receives exact absolute path', 6000);
    }
    assert(!grab().includes(body), 'Report is not displayed in a TUI viewer');
  } catch (error) {
    // Only the isolated, synthetic transcript is captured here.
    console.error(grab().replaceAll(root, '<fixture>'));
    throw error;
  } finally {
    tm('kill-server');
    await server?.close();
    mock.closeAllConnections();
    if (mock.listening) await new Promise(resolve => mock.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  }
});
