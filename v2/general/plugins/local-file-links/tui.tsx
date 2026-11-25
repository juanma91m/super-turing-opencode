import { Plugin } from '@opencode/plugin/tui';
import { BoxRenderable, TextRenderable, TextAttributes } from '@opentui/core';
import { linkTarget, openLocalFile } from './links.mjs';

export default Plugin.define({
  id: 'opencode-stack.local-file-links',
  setup(ctx) {
    // Other clients retain the copyable Markdown code block.
    if (process.platform !== 'linux' || !ctx.markdown?.registerCodeBlockRenderer) return;
    const install = (language, label) => ctx.markdown.registerCodeBlockRenderer(language, (token, render) => {
      const file = linkTarget(token.text);
      if (!token.closed || !file) return render.defaultRender();
      const box = new BoxRenderable(ctx.renderer, { flexDirection: 'column' });
      box.add(new TextRenderable(ctx.renderer, {
        content: label,
        fg: ctx.theme.text.link ?? ctx.theme.text.base,
        attributes: TextAttributes.UNDERLINE,
        alignSelf: 'flex-start',
        async onMouseUp(event) {
          if (event.button !== 0) return;
          try {
            await openLocalFile(file);
          } catch {
            ctx.ui.toast.show({ variant: 'error', message: 'No se pudo abrir el archivo local en la aplicación predeterminada. Podés copiar la ruta.' });
          }
        },
      }));
      box.add(new TextRenderable(ctx.renderer, { content: file, fg: ctx.theme.text.muted, wrapMode: 'char' }));
      return box;
    });
    const removeFile = install('opencode-local-file', 'Abrir archivo');
    const removeReport = install('opencode-review-report', 'Abrir informe'); // Existing transcripts.
    return () => { removeReport(); removeFile(); };
  },
});
