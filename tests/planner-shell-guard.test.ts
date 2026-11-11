import { test, expect } from "bun:test"
import os from "node:os"
import path from "node:path"
import Guard from "../plugins/planner-shell-guard"

const directory = os.tmpdir()
const broker = path.resolve(import.meta.dir, "../scripts/planner_shell.py")
const safe = `python3 ${broker} git status --short`
function context(role?: string) {
  return { directory, worktree: directory, client: { session: { messages: async () => ({
    data: role ? [{ info: { role: "assistant", agent: role }, parts: [] }] : [],
  }) } } } as unknown as Parameters<typeof Guard>[0]
}

test("planner rejects raw shell and permits only validated broker invocation", async () => {
  const hooks = await Guard(context())
  await hooks["chat.params"]!({ sessionID: "s", agent: "planner" } as never, {} as never)
  await expect(hooks["tool.execute.before"]!({ tool: "bash", sessionID: "s", callID: "c" },
    { args: { command: "./gradlew spotlessApply" } })).rejects.toThrow("Planner")
  await hooks["tool.execute.before"]!({ tool: "bash", sessionID: "s", callID: "c" }, { args: { command: safe } })
})

test("agent switch does not leak planner restrictions to implementer", async () => {
  const hooks = await Guard(context())
  await hooks["chat.params"]!({ sessionID: "s", agent: "planner" } as never, {} as never)
  await hooks["chat.params"]!({ sessionID: "s", agent: "master-dev" } as never, {} as never)
  await hooks["tool.execute.before"]!({ tool: "bash", sessionID: "s", callID: "c" }, { args: { command: "npm run format" } })
})

test("cold role lookup uses session identity and unknown identity fails closed", async () => {
  const cold = await Guard(context("planner"))
  await expect(cold["tool.execute.before"]!({ tool: "bash", sessionID: "s", callID: "c" },
    { args: { command: "touch app.py" } })).rejects.toThrow()
  const unknown = await Guard(context())
  await expect(unknown["tool.execute.before"]!({ tool: "bash", sessionID: "s", callID: "c" },
    { args: { command: safe } })).rejects.toThrow("resolve")
})

test("planner cannot choose a peer repository as Bash workdir", async () => {
  const hooks = await Guard(context("planner"))
  await expect(hooks["tool.execute.before"]!({ tool: "bash", sessionID: "s", callID: "c" },
    { args: { command: safe, workdir: "/" } })).rejects.toThrow()
})

test("planner permits bounded local diagnostics but not raw commands or mutation options", async () => {
  const hooks = await Guard(context("planner"))
  const prefix = `python3 ${broker} helper local-inspect`
  for (const command of [`${prefix} df --path /home`, `${prefix} du --path /home --depth 1`, `${prefix} free`]) {
    await hooks["tool.execute.before"]!({ tool: "bash", sessionID: "s", callID: "c" }, { args: { command } })
  }
  for (const command of ["df -h /home", `${prefix} rm --path /tmp`, `${prefix} du --path /home --dereference`,
    `${prefix} df --path /home | sort -h`]) {
    await expect(hooks["tool.execute.before"]!({ tool: "bash", sessionID: "s", callID: "c" },
      { args: { command } })).rejects.toThrow()
  }
})
