import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generalAddons } from '../../../v2/general/addons.mjs';
import { ENGRAM_TOOLS } from '../../../../super-turing-opencode-knowledge/v2/engram-config.mjs';
import { ROVO_TOOLS } from '../../../../super-turing-opencode-ticketing/v2/config.mjs';
import { PLAYWRIGHT_TOOLS } from '../../../v2/playwright/config.mjs';
import { selectDocumenter } from '../../../../super-turing-opencode-documents/v2/documenter/preflight.mjs';

export function nativeAddonFixture(root, { browserRuntime } = {}) {
  const runtimeHome = path.join(root, 'runtime-home'), runtimeConfig = path.join(root, 'runtime-config');
  const scripts = path.join(runtimeConfig, 'scripts'); fs.mkdirSync(scripts, { recursive: true }); fs.mkdirSync(runtimeHome);
  // Deliberately no old helper wrappers: general helpers must not dispatch to
  // runtimeConfig/scripts/knowledge_search.sh and recurse after the cutover.
  fs.writeFileSync(path.join(scripts, 'knowledge_env.local.sh'), 'export OPENCODE_KNOWLEDGE_EMBEDDING_MODEL=fixture-model\n');
  fs.writeFileSync(path.join(scripts, 'knowledge_env.sh'), 'SCRIPT_DIR=' + JSON.stringify(scripts) + '\nsource "$SCRIPT_DIR/knowledge_env.local.sh"\nknowledge_require_python(){ command -v python3; }\nknowledge_script_py(){ printf "%s\\n" "$SCRIPT_DIR/fake-qdrant.py"; }\nknowledge_lock_file(){ printf "%s\\n" "$HOME/locks/qdrant.lock"; }\nknowledge_embedding_backend(){ printf "ollama\\n"; }\nknowledge_embedding_model(){ printf "must-not-replace-local-override\\n"; }\nknowledge_ollama_base_url(){ printf "http://127.0.0.1:1\\n"; }\n');
  fs.writeFileSync(path.join(scripts, 'fake-qdrant.py'), 'import os,json,sys\nprint(json.dumps({"fixture":True,"operation":sys.argv[1],"home":os.environ.get("HOME"),"model":os.environ.get("OPENCODE_KNOWLEDGE_EMBEDDING_MODEL"),"hostSecretPresent":"OPENCODE_PASSWORD" in os.environ}))\n');
  const mcp = (names, log) => ({ type: 'local', command: [process.execPath, fileURLToPath(new URL('./general-addon-mcp.mjs', import.meta.url))], environment: { FIXTURE_TOOLS: JSON.stringify(names), FIXTURE_LOG: path.join(root, log) }, codemode: false });
  return { runtimeHome, runtimeConfig, contributions: generalAddons({
    context7: mcp(['resolve-library-id', 'query-docs'], 'context7-calls.jsonl'),
    knowledge: { runtimeHome, runtimeConfig, server: mcp(ENGRAM_TOOLS.map(name => name.slice('engram_'.length)), 'engram-calls.jsonl'), permissions: ENGRAM_TOOLS.map(action => ({ action, resource: '*', effect: 'allow' })) },
    ticketing: { server: mcp([...ROVO_TOOLS.map(name => name.slice('atlassian-rovo_'.length)), 'executeRead', 'createConfluenceContent', 'updateConfluenceContent'], 'rovo-calls.jsonl') },
    codegraph: { binding: { runtime_home: runtimeHome, runtime_bin: '/fixture/codegraph' }, server: mcp(['codegraph_explore', 'init'], 'graph-calls.jsonl') },
    playwright: browserRuntime ? { runtime: browserRuntime } : { runtime: { home: runtimeHome, version: '0.0.85', cli: '/fixture/browser.js', browser: '/fixture/chrome' }, server: mcp([...PLAYWRIGHT_TOOLS.map(name => name.slice('playwright_'.length)), 'browser_run_code_unsafe'], 'browser-calls.jsonl') },
    documents: { binding: selectDocumenter(os.homedir(), path.join(os.homedir(), '.config/opencode')) },
  }) };
}
