// Legacy fixture/workshop interface: default environment and inline test config
// preserved. General production code does not depend on the migration harness.
import { environment } from './staging.mjs';
import { startOwnedServer } from '../../v2/general/owned-server.mjs';
export { until } from '../../v2/general/owned-server.mjs';
export function startServer(binary, paths, extraConfig, options = {}) {
  return startOwnedServer(binary, paths, p => ({ ...(options.environment ?? environment)(p), ...(extraConfig ? { OPENCODE_CONFIG_CONTENT: JSON.stringify(extraConfig) } : {}) }));
}
