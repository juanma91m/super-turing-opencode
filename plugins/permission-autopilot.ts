import type { Config, Plugin } from "@opencode-ai/plugin"
import { controlledBashPermission, permissionNeedsApproval } from "../lib/permission-policy.ts"

// Keep the V1 public exports and semantics while sharing policy with V2.
export { controlledBashPermission, permissionNeedsApproval }

function applyControlledBashProfile(config: Config): void {
  config.permission ??= {}
  config.permission.bash = controlledBashPermission(config.permission.bash)
  for (const agent of Object.values(config.agent ?? {})) {
    if (!agent?.permission || typeof agent.permission !== "object") continue
    if (agent.permission.bash === undefined) continue
    agent.permission.bash = controlledBashPermission(agent.permission.bash)
  }
}

const PermissionAutopilotPlugin: Plugin = async () => ({
  config: async config => applyControlledBashProfile(config),
  "permission.ask": async (input, output) => {
    const pattern = input as { type?: string; permission?: string; pattern?: string | readonly string[]; patterns?: readonly string[] }
    const values = pattern.patterns ?? pattern.pattern ?? []
    if (permissionNeedsApproval(pattern.permission ?? pattern.type ?? "", typeof values === "string" ? [values] : values)) return
    output.status = "allow"
  },
})

export default PermissionAutopilotPlugin
