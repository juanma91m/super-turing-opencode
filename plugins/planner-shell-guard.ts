import type { Plugin } from "@opencode-ai/plugin"
import { spawnSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

// One policy implementation, also invoked by the Claude planner hook.
const guard = fileURLToPath(new URL("../scripts/planner_shell.py", import.meta.url))

const PlannerShellGuard: Plugin = async ({ client, directory, worktree }) => {
  const roles = new Map<string, string>()
  const root = worktree === "/" ? directory : worktree
  return {
    // Bind to the executing provider turn, not an arriving user steer.
    // A queued agent switch must not relabel tools from the previous turn.
    "chat.params": async (input) => { roles.set(input.sessionID, input.agent) },
    "tool.execute.before": async (input, output) => {
      if (input.tool !== "bash") return
      let role = roles.get(input.sessionID)
      if (!role) {
        const response = await client.session.messages({ path: { id: input.sessionID } })
        const messages = response.data ?? []
        const latest = [...messages].reverse().find((message) =>
          message.parts.some((part) => part.type === "tool" && part.callID === input.callID))
          ?? [...messages].reverse().find((message) => message.info.role === "assistant" && message.info.agent)
          ?? [...messages].reverse().find((message) => message.info.agent)
        role = latest?.info.agent
        if (role) roles.set(input.sessionID, role)
      }
      if (!role) throw new Error("Cannot resolve Bash caller; planner guard fails closed")
      if (role !== "planner" && role !== "plan") return
      const args = output.args as { command?: string; workdir?: string }
      const cwd = args.workdir ? path.resolve(directory, args.workdir) : directory
      const checked = spawnSync("python3", [guard, "--check"], {
        input: JSON.stringify({ command: args.command, cwd, project_root: root }),
        encoding: "utf8", timeout: 10000,
      })
      if (checked.error || checked.status !== 0) {
        throw new Error(checked.error ? "Planner shell guard unavailable; blocked" : checked.stderr.trim())
      }
    },
    event: async ({ event }) => {
      if (event.type === "session.deleted") roles.delete(event.properties.info.id)
    },
  }
}

export default PlannerShellGuard
