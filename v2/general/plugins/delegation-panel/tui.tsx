import { Plugin } from '@opencode/plugin/tui';
import { For, Show, createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { delegationStatus } from './status.mjs';

const name = 'opencode-stack.delegation-panel';
const label = (text: string) => text.replace(/[\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/gu, ' ').slice(0, 160);

export default Plugin.define({
  id: name,
  setup(ctx) {
    if (!ctx.ui.panel || typeof ctx.data.session.family !== 'function') return;
    const session = ctx.data.session;
    function Panel({ panel }: { panel: { sessionID: string; close: () => void } }) {
      const [terminal, setTerminal] = createSignal<Record<string, string>>({});
      const ids = createMemo(() => session.family(panel.sessionID)
        .filter(id => Boolean(session.get(id)?.parentID)));
      const syncRequested = new Set<string>();
      createEffect(() => {
        for (const id of ids()) {
          if (syncRequested.has(id)) continue;
          syncRequested.add(id);
          const location = session.get(id)?.location;
          // One read per visible child. Further changes arrive in the native cache/events.
          void session.permission.sync(id).catch(() => {});
          if (location && session.form) void session.form.sync(id, location).catch(() => {});
        }
      });
      for (const state of ['succeeded', 'failed', 'interrupted', 'started'] as const) {
        const stop = ctx.data.on(`session.execution.${state}`, event => {
          const id = event.data.sessionID;
          if (ids().includes(id)) setTerminal(previous => ({ ...previous, [id]: state }));
        });
        onCleanup(stop);
      }
      const rows = createMemo(() => ids().map(id => ({
        id,
        title: label(session.get(id)?.title || id),
        status: delegationStatus({
          status: session.status(id), terminal: terminal()[id],
          permission: Boolean(session.permission.list(id)?.length),
          form: Boolean(session.form?.list(id)?.length),
        }),
      })));
      const open = (id: string) => {
        if (!ids().includes(id)) return;
        panel.close();
        ctx.ui.router.navigate({ type: 'session', sessionID: id });
      };
      ctx.keymap.layer(() => ({
        commands: [{
          id: `${name}.navigate`, bind: 'o',
          run: async () => {
            if (!rows().length) return;
            const id = await ctx.ui.dialog.select({
              title: 'Ir a tarea delegada',
              options: rows().map(row => ({ title: row.title, description: row.status, value: row.id })),
            });
            if (typeof id === 'string') open(id);
          },
        }],
      }));
      return (
        <box flexDirection="column" flexGrow={1} minHeight={0} paddingX={1}>
          <text fg={ctx.theme.text.base}>Tareas delegadas</text>
          <text fg={ctx.theme.text.muted}>Clic u «o» para ir a una sesión · sólo lectura</text>
          <Show when={rows().length > 0} fallback={<text fg={ctx.theme.text.muted}>Esta familia no tiene sesiones hijas.</text>}>
            <scrollbox flexGrow={1} minHeight={0}>
              <For each={rows()}>{row =>
                <box flexDirection="column" onMouseUp={event => { if (event.button === 0) open(row.id); }}>
                  <text fg={ctx.theme.text.link ?? ctx.theme.text.base} wrapMode="word">{row.title}</text>
                  <text fg={ctx.theme.text.muted}>{row.status}</text>
                </box>
              }</For>
            </scrollbox>
          </Show>
        </box>
      );
    }
    const dispose = ctx.ui.slot({
      append: 'session.panel',
      render: panel => <Show when={panel.name === name}><Panel panel={panel} /></Show>,
    });
    ctx.keymap.layer(() => ({
      mode: 'global',
      commands: [{
        id: name, title: 'Tareas delegadas', group: 'Sesión', palette: true,
        slash: { name: 'tareas-delegadas', aliases: ['bg-tasks'] },
        enabled: () => ctx.ui.router.current().type === 'session',
        run: () => { ctx.ui.panel.open(name); },
      }],
    }));
    return dispose;
  },
});
