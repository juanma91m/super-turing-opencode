/**
 * background-agents
 * Async read-only delegation for OpenCode
 *
 * Principles for v1:
 * - delegate only to read-only agents
 * - persist full results to disk
 * - keep notifications compact
 * - survive compaction
 * - keep Engram for curated semantic memory, not raw async output
 */

import * as crypto from "node:crypto"
import * as fs from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import { type Plugin, type ToolContext, tool } from "@opencode-ai/plugin"
import { createOpencodeClient as createOpencodeClientV2 } from "@opencode-ai/sdk/v2"

type OpencodeClient = any
type Event = any
type Part = any

type PermissionEntry = "ask" | "allow" | "deny" | Record<string, "ask" | "allow" | "deny">

type DelegationStatus = "running" | "complete" | "error" | "cancelled" | "timeout"
type IsolatedDelegationStatus = DelegationStatus | "review_pending" | "accepted" | "discarded" | "applied"
type DelegationMode = "read-only" | "isolated-write"

interface Delegation {
  id: string
  mode: DelegationMode
  sessionID: string
  parentSessionID: string
  parentMessageID: string
  parentAgent: string
  prompt: string
  agent: string
  status: DelegationStatus | IsolatedDelegationStatus
  startedAt: Date
  completedAt?: Date
  title?: string
  description?: string
  result?: string
  error?: string
  worktree?: WorktreeInfo
  artifactsDir?: string
  promptPreview?: string
  worktreeRemovedAt?: Date
  worktreeCleanupNote?: string
}

interface DelegateInput {
  parentSessionID: string
  parentMessageID: string
  parentAgent: string
  prompt: string
  agent: string
}

interface IsolatedDelegateInput extends DelegateInput {
  name?: string
}

interface WorktreeInfo {
  name: string
  branch: string
  directory: string
}

interface DelegationListItem {
  id: string
  status: DelegationStatus | string
  title?: string
  description?: string
  agent?: string
}

const MAX_RUN_TIME_MS = 15 * 60 * 1000
const RECENT_COMPLETED_LIMIT = 10
const MAX_DELEGATION_CALLER_DEPTH = 1

const READ_ONLY_DELEGATION_MATRIX: Record<string, string[]> = {
  "master-dev": ["backend-java-developer", "frontend-web-developer", "reviewer", "code-inspector", "explorer", "ui-web-designer"],
  "frontend-web-developer": ["explorer", "code-inspector"],
  "backend-java-developer": ["explorer", "code-inspector"],
  "ui-web-designer": ["explorer"],
  reviewer: ["code-inspector"],
}

const ISOLATED_WRITE_TARGETS = new Set(["backend-java-developer", "frontend-web-developer", "master-dev"])

const ADJECTIVES = [
  "brisk",
  "calm",
  "clear",
  "bright",
  "steady",
  "keen",
  "plain",
  "swift",
  "solid",
  "sharp",
]

const COLORS = [
  "amber",
  "blue",
  "cyan",
  "green",
  "indigo",
  "orange",
  "purple",
  "silver",
  "teal",
  "violet",
]

const ANIMALS = [
  "badger",
  "falcon",
  "fox",
  "heron",
  "lynx",
  "otter",
  "owl",
  "raven",
  "tiger",
  "wolf",
]

class TimeoutError extends Error {
  readonly name = "TimeoutError" as const
}

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>
  return Promise.race([
    promise.finally(() => clearTimeout(timeoutId)),
    new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new TimeoutError(message)), ms)
    }),
  ])
}

function hashString(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 16)
}

async function getProjectId(projectRoot: string): Promise<string> {
  try {
    const proc = Bun.spawn(["git", "rev-list", "--max-parents=0", "--all"], {
      cwd: projectRoot,
      stdout: "pipe",
      stderr: "pipe",
    })
    const exitCode = await withTimeout(proc.exited, 5000, "git rev-list timed out").catch((err) => {
      if (err instanceof TimeoutError) proc.kill()
      return 1
    })
    if (exitCode === 0) {
      const output = await new Response(proc.stdout).text()
      const roots = output
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .sort()
      if (roots.length > 0) return roots[0].slice(0, 16)
    }
  } catch {
    // fall through
  }
  return hashString(projectRoot)
}

function isPermissionDenied(entry: PermissionEntry | undefined): boolean {
  if (entry === "deny") return true
  if (entry && typeof entry === "object" && entry["*"] === "deny") return true
  return false
}

async function isReadOnlyAgent(client: OpencodeClient, agentName: string): Promise<boolean> {
  const config = await client.config.get()
  const configData = (config?.data ?? {}) as {
    agent?: Record<string, { permission?: Record<string, PermissionEntry> }>
  }

  const permission = configData.agent?.[agentName]?.permission ?? {}
  const editDenied = isPermissionDenied(permission.edit)
  const bashDenied = isPermissionDenied(permission.bash)
  const writeDenied = permission.write === undefined ? true : isPermissionDenied(permission.write)
  return editDenied && bashDenied && writeDenied
}

function generateReadableId(existing: Set<string>): string {
  for (let attempts = 0; attempts < 20; attempts++) {
    const id = `${ADJECTIVES[crypto.randomInt(ADJECTIVES.length)]}-${COLORS[crypto.randomInt(COLORS.length)]}-${ANIMALS[crypto.randomInt(ANIMALS.length)]}`
    if (!existing.has(id)) return id
  }
  return hashString(`${Date.now()}-${Math.random()}`)
}

function firstNonEmptyLine(text: string): string {
  return text
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean) ?? "Delegation result"
}

function summarize(text: string, max: number): string {
  const normalized = text.replace(/\s+/g, " ").trim()
  return normalized.length > max ? `${normalized.slice(0, max).trim()}...` : normalized
}

function deriveMetadata(content: string): { title: string; description: string } {
  const title = summarize(firstNonEmptyLine(content).replace(/^#+\s*/, ""), 60)
  const description = summarize(content, 180)
  return {
    title: title || "Delegation result",
    description: description || "(No description generated)",
  }
}

function hasAllowedDelegation(callerAgent: string | undefined, targetAgent: string): boolean {
  if (!callerAgent) return false
  return READ_ONLY_DELEGATION_MATRIX[callerAgent]?.includes(targetAgent) ?? false
}

function shouldExposeDelegateTool(callerDepth: number): boolean {
  return callerDepth <= MAX_DELEGATION_CALLER_DEPTH
}

async function runGit(args: string[], cwd: string, timeoutMs = 10000): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, GIT_DIR: undefined, GIT_WORK_TREE: undefined },
  })
  const exitCode = await withTimeout(proc.exited, timeoutMs, `git ${args.join(" ")} timed out`).catch((err) => {
    if (err instanceof TimeoutError) proc.kill()
    return 124
  })
  const [stdout, stderr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()])
  return { exitCode, stdout, stderr }
}

function buildDelegationPrompt(input: DelegateInput): string {
  return `## Async Delegation Context

You are running in an isolated background session.
You do NOT inherit the caller's live conversation context beyond this prompt, your system prompt, and any explicit file or memory references included here.

Caller agent: ${input.parentAgent}

Rules:
- Treat the instructions below as the authoritative task context.
- Do not assume hidden goals, prior discussion, or unstated constraints.
- If critical context is missing, say so explicitly and stay within the declared scope.
- Prefer the narrowest reading of the task that still satisfies the stated objective.
- Use explicit file paths, memory references, and constraints from the prompt over guesswork.
- Unless the caller explicitly asks for a longer artifact, prefer concise output: short bullets, short sections, and minimal necessary explanation.
- If the task is broader than the declared output budget, prioritize the most decision-relevant findings first rather than expanding scope.

## Caller-authored task packet

${input.prompt}`
}

function buildIsolatedDelegationPrompt(input: IsolatedDelegateInput, worktree: WorktreeInfo): string {
  return `## Isolated Write Delegation Context

You are running in an isolated OpenCode worktree.
You MAY edit files only inside this worktree directory: ${worktree.directory}

Caller agent: ${input.parentAgent}
Worktree name: ${worktree.name}
Worktree branch: ${worktree.branch}

Rules:
- Do not modify the parent workspace.
- Keep changes minimal and scoped to the caller-authored task packet.
- Do not commit, push, merge, or run destructive git operations.
- If critical context is missing, stop and report what is missing instead of guessing.
- At the end, summarize changed files, validation run, and remaining risks.
- The parent will review the diff manually; there is no auto-merge.

## Caller-authored task packet

${input.prompt}`
}

function createLogger(client: OpencodeClient) {
  const log = (level: "debug" | "info" | "warn" | "error", message: string) =>
    client?.app?.log?.({ body: { service: "background-agents", level, message } }).catch?.(() => {})

  return {
    debug: (message: string) => log("debug", message),
    info: (message: string) => log("info", message),
    warn: (message: string) => log("warn", message),
    error: (message: string) => log("error", message),
  }
}

type Logger = ReturnType<typeof createLogger>

class DelegationManager {
  private readonly client: OpencodeClient
  private readonly worktreeClient: any
  private readonly projectDirectory: string
  private readonly baseDir: string
  private readonly log: Logger
  private readonly delegations = new Map<string, Delegation>()
  private readonly pendingByParent = new Map<string, Set<string>>()

  constructor(client: OpencodeClient, worktreeClient: any, projectDirectory: string, baseDir: string, log: Logger) {
    this.client = client
    this.worktreeClient = worktreeClient
    this.projectDirectory = projectDirectory
    this.baseDir = baseDir
    this.log = log
  }

  async debugLog(message: string): Promise<void> {
    const line = `${new Date().toISOString()}: ${message}\n`
    try {
      await fs.mkdir(this.baseDir, { recursive: true })
      await fs.appendFile(path.join(this.baseDir, "background-agents-debug.log"), line, "utf8")
    } catch {
      // ignore
    }
  }

  findBySession(sessionID: string): Delegation | undefined {
    for (const delegation of this.delegations.values()) {
      if (delegation.sessionID === sessionID) return delegation
    }
    return undefined
  }

  getRunningDelegations(): Delegation[] {
    return Array.from(this.delegations.values()).filter((d) => d.status === "running")
  }

  async getRootSessionID(sessionID: string): Promise<string> {
    let currentID = sessionID
    for (let depth = 0; depth < 10; depth++) {
      try {
        const session = await this.client.session.get({ path: { id: currentID } })
        const parentID = session?.data?.parentID
        if (!parentID) return currentID
        currentID = parentID
      } catch {
        return currentID
      }
    }
    return currentID
  }

  async getDelegationDepth(sessionID: string): Promise<number> {
    let depthCount = 0
    let currentID = sessionID
    for (let depth = 0; depth < 10; depth++) {
      if (this.findBySession(currentID)) depthCount++
      try {
        const session = await this.client.session.get({ path: { id: currentID } })
        const parentID = session?.data?.parentID
        if (!parentID) return depthCount
        currentID = parentID
      } catch {
        return depthCount
      }
    }
    return depthCount
  }

  private async getDelegationsDir(sessionID: string): Promise<string> {
    const rootID = await this.getRootSessionID(sessionID)
    return path.join(this.baseDir, rootID)
  }

  private async ensureDelegationsDir(sessionID: string): Promise<string> {
    const dir = await this.getDelegationsDir(sessionID)
    await fs.mkdir(dir, { recursive: true })
    return dir
  }

  private async ensureArtifactDir(delegation: Delegation): Promise<string> {
    if (delegation.artifactsDir) return delegation.artifactsDir
    const dir = path.join(await this.ensureDelegationsDir(delegation.parentSessionID), delegation.id)
    await fs.mkdir(dir, { recursive: true })
    delegation.artifactsDir = dir
    return dir
  }

  private async getArtifactDirForID(sessionID: string, id: string): Promise<string> {
    return path.join(await this.getDelegationsDir(sessionID), id)
  }

  private async readArtifactText(sessionID: string, id: string, filename: string): Promise<string | undefined> {
    try {
      return await fs.readFile(path.join(await this.getArtifactDirForID(sessionID, id), filename), "utf8")
    } catch {
      return undefined
    }
  }

  private async saveIsolatedMeta(delegation: Delegation): Promise<void> {
    const artifactsDir = await this.ensureArtifactDir(delegation)
    const meta = {
      id: delegation.id,
      mode: delegation.mode,
      agent: delegation.agent,
      parentAgent: delegation.parentAgent,
      parentSessionID: delegation.parentSessionID,
      parentMessageID: delegation.parentMessageID,
      status: delegation.status,
      startedAt: delegation.startedAt.toISOString(),
      completedAt: delegation.completedAt?.toISOString() ?? null,
      worktree: delegation.worktree ?? null,
      artifactsDir,
      promptPreview: delegation.promptPreview || summarize(delegation.prompt, 500),
      title: delegation.title ?? null,
      description: delegation.description ?? null,
      worktreeRemovedAt: delegation.worktreeRemovedAt?.toISOString() ?? null,
      worktreeCleanupNote: delegation.worktreeCleanupNote ?? null,
    }

    await fs.writeFile(path.join(artifactsDir, "meta.json"), JSON.stringify(meta, null, 2), "utf8")
  }

  private async writeIsolatedSummary(delegation: Delegation, content: string): Promise<void> {
    const artifactsDir = await this.ensureArtifactDir(delegation)
    let changedFiles: string[] = []
    try {
      const raw = await fs.readFile(path.join(artifactsDir, "changed-files.json"), "utf8")
      changedFiles = JSON.parse(raw) as string[]
    } catch {
      changedFiles = []
    }

    const cleanupLines = [
      `**Worktree Removed At:** ${delegation.worktreeRemovedAt?.toISOString() || "N/A"}`,
      `**Cleanup Note:** ${delegation.worktreeCleanupNote || "N/A"}`,
    ]

    const summary = `# ${delegation.title || delegation.id}

${delegation.description || summarize(content, 180) || "(No description generated)"}

**ID:** ${delegation.id}
**Mode:** isolated-write
**Agent:** ${delegation.agent}
**Status:** ${delegation.status}
**Started:** ${delegation.startedAt.toISOString()}
**Completed:** ${delegation.completedAt?.toISOString() || "N/A"}
**Worktree:** ${delegation.worktree?.directory || "N/A"}
**Artifacts:** ${artifactsDir}
${cleanupLines.join("\n")}

## Changed Files

${changedFiles.length > 0 ? changedFiles.map((file) => `- ${file}`).join("\n") : "(none detected)"}

## Result

${content}

## Review

Review artifacts before applying anything to the main workspace. This plugin does not auto-merge isolated changes.`

    await fs.writeFile(path.join(await this.ensureDelegationsDir(delegation.parentSessionID), `${delegation.id}.md`), summary, "utf8")
  }

  private async loadPersistedIsolatedDelegation(sessionID: string, id: string): Promise<Delegation | undefined> {
    try {
      const artifactsDir = await this.getArtifactDirForID(sessionID, id)
      const raw = await fs.readFile(path.join(artifactsDir, "meta.json"), "utf8")
      const meta = JSON.parse(raw) as {
        id: string
        mode: DelegationMode
        agent: string
        parentAgent: string
        parentSessionID?: string
        parentMessageID?: string
        status: DelegationStatus | IsolatedDelegationStatus
        startedAt: string
        completedAt?: string | null
        worktree?: WorktreeInfo | null
        artifactsDir?: string | null
        promptPreview?: string | null
        title?: string | null
        description?: string | null
        worktreeRemovedAt?: string | null
        worktreeCleanupNote?: string | null
      }

      return {
        id: meta.id,
        mode: meta.mode,
        sessionID: this.delegations.get(id)?.sessionID || "",
        parentSessionID: meta.parentSessionID || sessionID,
        parentMessageID: meta.parentMessageID || "",
        parentAgent: meta.parentAgent,
        prompt: this.delegations.get(id)?.prompt || meta.promptPreview || "",
        agent: meta.agent,
        status: meta.status,
        startedAt: new Date(meta.startedAt),
        completedAt: meta.completedAt ? new Date(meta.completedAt) : undefined,
        title: meta.title || this.delegations.get(id)?.title,
        description: meta.description || this.delegations.get(id)?.description,
        result: await this.readArtifactText(sessionID, id, "result.md"),
        worktree: meta.worktree || undefined,
        artifactsDir: meta.artifactsDir || artifactsDir,
        promptPreview: meta.promptPreview || undefined,
        worktreeRemovedAt: meta.worktreeRemovedAt ? new Date(meta.worktreeRemovedAt) : undefined,
        worktreeCleanupNote: meta.worktreeCleanupNote || undefined,
      }
    } catch {
      return undefined
    }
  }

  private async resolveIsolatedDelegation(sessionID: string, id: string): Promise<Delegation> {
    const inMemory = this.delegations.get(id)
    if (inMemory?.mode === "isolated-write") return inMemory

    const persisted = await this.loadPersistedIsolatedDelegation(sessionID, id)
    if (persisted?.mode === "isolated-write") return persisted

    throw new Error(`Isolated delegation "${id}" not found.`)
  }

  private async cleanupIsolatedWorktree(delegation: Delegation, reason: string, throwOnFailure = false): Promise<void> {
    if (!delegation.worktree?.directory) return

    try {
      await this.worktreeClient.worktree.remove({
        directory: this.projectDirectory,
        worktreeRemoveInput: { directory: delegation.worktree.directory },
      })
      delegation.worktreeRemovedAt = new Date()
      delegation.worktreeCleanupNote = reason
    } catch (error) {
      delegation.worktreeCleanupNote = `${reason}. Cleanup failed: ${error instanceof Error ? error.message : String(error)}`
      if (throwOnFailure) throw error
      await this.debugLog(`cleanupIsolatedWorktree failed for ${delegation.id}: ${delegation.worktreeCleanupNote}`)
    }
  }

  private async validateTargetAgent(agentName: string): Promise<void> {
    const agentsResult = await this.client.app.agents({})
    const agents = (agentsResult?.data ?? []) as Array<{ name: string; description?: string }>
    const match = agents.find((agent) => agent.name === agentName)
    if (!match) {
      const available = agents.map((agent) => `• ${agent.name}${agent.description ? ` - ${agent.description}` : ""}`).join("\n")
      throw new Error(`Agent "${agentName}" not found.\n\nAvailable agents:\n${available || "(none)"}`)
    }

    const readOnly = await isReadOnlyAgent(this.client, agentName)
    if (!readOnly) {
      throw new Error(
        `Agent "${agentName}" is write-capable. In async v1, delegate only supports read-only agents. Use task for synchronous work, or wait for isolated write-capable async in v2.`,
      )
    }
  }

  private async validateReadOnlyDelegation(input: DelegateInput): Promise<void> {
    await this.validateTargetAgent(input.agent)

    if (!hasAllowedDelegation(input.parentAgent, input.agent)) {
      throw new Error(
        `Agent "${input.parentAgent}" is not allowed to delegate to "${input.agent}". Allowed targets: ${(READ_ONLY_DELEGATION_MATRIX[input.parentAgent] ?? []).join(", ") || "none"}.`,
      )
    }

    const callerDepth = await this.getDelegationDepth(input.parentSessionID)
    if (callerDepth > MAX_DELEGATION_CALLER_DEPTH) {
      throw new Error(
        `Delegation depth exceeded. Caller depth is ${callerDepth}; maximum allowed caller depth is ${MAX_DELEGATION_CALLER_DEPTH}.`,
      )
    }
  }

  private async validateIsolatedWriteDelegation(input: IsolatedDelegateInput): Promise<void> {
    const agentsResult = await this.client.app.agents({})
    const agents = (agentsResult?.data ?? []) as Array<{ name: string; description?: string }>
    const match = agents.find((agent) => agent.name === input.agent)
    if (!match) {
      const available = agents.map((agent) => `• ${agent.name}${agent.description ? ` - ${agent.description}` : ""}`).join("\n")
      throw new Error(`Agent "${input.agent}" not found.\n\nAvailable agents:\n${available || "(none)"}`)
    }

    if (input.parentAgent !== "master-dev") {
      throw new Error(`delegate_isolated is restricted to master-dev. Caller was "${input.parentAgent}".`)
    }

    if (!ISOLATED_WRITE_TARGETS.has(input.agent)) {
      throw new Error(`Agent "${input.agent}" is not allowed for isolated write delegation.`)
    }

    const callerDepth = await this.getDelegationDepth(input.parentSessionID)
    if (callerDepth !== 0) {
      throw new Error("delegate_isolated can only be launched from the root orchestration session.")
    }
  }

  async delegate(input: DelegateInput): Promise<Delegation> {
    await this.validateReadOnlyDelegation(input)
    const callerDepth = await this.getDelegationDepth(input.parentSessionID)

    const id = generateReadableId(new Set(this.delegations.keys()))
    const sessionResult = await this.client.session.create({
      body: {
        title: `Delegation: ${id}`,
        parentID: input.parentSessionID,
      },
    })

    if (!sessionResult?.data?.id) {
      throw new Error("Failed to create delegation session")
    }

    const delegation: Delegation = {
      id,
      mode: "read-only",
      sessionID: sessionResult.data.id,
      parentSessionID: input.parentSessionID,
      parentMessageID: input.parentMessageID,
      parentAgent: input.parentAgent,
      prompt: input.prompt,
      agent: input.agent,
      status: "running",
      startedAt: new Date(),
    }

    this.delegations.set(delegation.id, delegation)
    await this.ensureDelegationsDir(input.parentSessionID)

    if (!this.pendingByParent.has(input.parentSessionID)) {
      this.pendingByParent.set(input.parentSessionID, new Set())
    }
    this.pendingByParent.get(input.parentSessionID)?.add(delegation.id)

    setTimeout(() => {
      const current = this.delegations.get(delegation.id)
      if (current?.status === "running") {
        void this.handleTimeout(delegation.id)
      }
    }, MAX_RUN_TIME_MS + 5000)

    this.client.session
      .prompt({
        path: { id: delegation.sessionID },
        body: {
          agent: input.agent,
          parts: [{ type: "text", text: buildDelegationPrompt(input) }],
          tools: {
            task: false,
            delegate: shouldExposeDelegateTool(callerDepth + 1),
            delegation_read: false,
            delegation_list: false,
            delegation_apply: false,
            delegation_accept: false,
            delegation_discard: false,
            delegate_isolated: false,
            todowrite: false,
          },
        },
      })
      .catch(async (error: Error) => {
        delegation.status = "error"
        delegation.error = error.message
        delegation.completedAt = new Date()
        await this.persistOutput(delegation, `Delegation failed before completion.\n\nError: ${error.message}`)
        await this.notifyParent(delegation)
      })

    void this.monitorDelegationUntilTerminal(delegation.id)

    return delegation
  }

  async delegateIsolated(input: IsolatedDelegateInput): Promise<Delegation> {
    await this.validateIsolatedWriteDelegation(input)

    if (!this.worktreeClient?.worktree?.create) {
      throw new Error("OpenCode worktree API is unavailable; cannot launch isolated write delegation.")
    }

    const id = generateReadableId(new Set(this.delegations.keys()))
    const worktreeName = input.name || `delegate-${id}`
    const worktreeResult = await this.worktreeClient.worktree.create({
      directory: this.projectDirectory,
      worktreeCreateInput: { name: worktreeName },
    })
    const worktree = worktreeResult?.data as WorktreeInfo | undefined
    if (!worktree?.directory) {
      const errorDetails = worktreeResult?.error
        ? JSON.stringify(worktreeResult.error)
        : JSON.stringify(worktreeResult?.data ?? null)
      throw new Error(`Failed to create isolated worktree. Response: ${errorDetails}`)
    }

    const sessionResult = await this.client.session.create({
      query: { directory: worktree.directory },
      body: {
        title: `Isolated delegation: ${id}`,
        parentID: input.parentSessionID,
      },
    })

    if (!sessionResult?.data?.id) {
      throw new Error("Failed to create isolated delegation session")
    }

    const delegation: Delegation = {
      id,
      mode: "isolated-write",
      sessionID: sessionResult.data.id,
      parentSessionID: input.parentSessionID,
      parentMessageID: input.parentMessageID,
      parentAgent: input.parentAgent,
      prompt: input.prompt,
      agent: input.agent,
      status: "running",
      startedAt: new Date(),
      worktree,
    }

    this.delegations.set(delegation.id, delegation)
    await this.ensureArtifactDir(delegation)

    if (!this.pendingByParent.has(input.parentSessionID)) {
      this.pendingByParent.set(input.parentSessionID, new Set())
    }
    this.pendingByParent.get(input.parentSessionID)?.add(delegation.id)

    setTimeout(() => {
      const current = this.delegations.get(delegation.id)
      if (current?.status === "running") {
        void this.handleTimeout(delegation.id)
      }
    }, MAX_RUN_TIME_MS + 5000)

    this.client.session
      .prompt({
        path: { id: delegation.sessionID },
        query: { directory: worktree.directory },
        body: {
          agent: input.agent,
          parts: [{ type: "text", text: buildIsolatedDelegationPrompt(input, worktree) }],
          tools: {
            bash: false,
            task: false,
            delegate: false,
            delegation_read: false,
            delegation_list: false,
            delegation_apply: false,
            delegation_accept: false,
            delegation_discard: false,
            delegate_isolated: false,
            todowrite: false,
          },
        },
      })
      .catch(async (error: Error) => {
        delegation.status = "error"
        delegation.error = error.message
        delegation.completedAt = new Date()
        await this.captureIsolatedArtifacts(delegation, `Isolated delegation failed before completion.\n\nError: ${error.message}`)
        await this.cleanupIsolatedWorktree(delegation, "Automatic cleanup after isolated delegation error")
        await this.saveIsolatedMeta(delegation)
        await this.writeIsolatedSummary(delegation, delegation.result ?? `Isolated delegation failed before completion.\n\nError: ${error.message}`)
        await this.notifyParent(delegation)
      })

    void this.monitorDelegationUntilTerminal(delegation.id)

    return delegation
  }

  private async hasTerminalAssistantMessage(delegation: Delegation): Promise<boolean> {
    const messages = await this.client.session.messages({ path: { id: delegation.sessionID } })
    const items = (messages?.data ?? []) as Array<{ info?: any; parts?: Part[] }>
    const last = items[items.length - 1]
    if (!last || last.info?.role !== "assistant") return false

    const finish = String(last.info?.finish ?? "")
    const completed = Boolean(last.info?.time?.completed)
    const hasRunningTool = (last.parts ?? []).some((part: any) => part?.type === "tool" && part?.state?.status === "running")
    const hasText = (last.parts ?? []).some((part: any) => part?.type === "text" && String(part.text ?? "").trim())

    return !hasRunningTool && (finish === "stop" || (completed && hasText))
  }

  private async monitorDelegationUntilTerminal(delegationId: string): Promise<void> {
    const startedAt = Date.now()
    while (Date.now() - startedAt < MAX_RUN_TIME_MS + 10000) {
      const delegation = this.delegations.get(delegationId)
      if (!delegation || delegation.status !== "running") return

      try {
        const terminal = await this.hasTerminalAssistantMessage(delegation)
        if (terminal) {
          await this.handleSessionIdle(delegation.sessionID)
          return
        }
      } catch (error) {
        await this.debugLog(`monitorDelegationUntilTerminal check failed for ${delegationId}: ${error instanceof Error ? error.message : String(error)}`)
      }

      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }

  async acceptIsolated(sessionID: string, id: string): Promise<Delegation> {
    const delegation = await this.resolveIsolatedDelegation(sessionID, id)

    if (delegation.status === "accepted") {
      return delegation
    }

    if (delegation.status !== "review_pending") {
      throw new Error(`Isolated delegation "${id}" is not awaiting review. Current status: ${delegation.status}.`)
    }

    delegation.status = "accepted"
    delegation.completedAt = delegation.completedAt ?? new Date()
    const content = delegation.result ?? (await this.readArtifactText(sessionID, id, "result.md")) ?? "(No result content available)"
    delegation.result = content

    await this.captureIsolatedArtifacts(delegation, content)
    if (this.delegations.has(id)) this.delegations.set(id, delegation)
    return delegation
  }

  async applyIsolated(sessionID: string, id: string): Promise<Delegation> {
    const delegation = await this.resolveIsolatedDelegation(sessionID, id)

    if (delegation.status === "applied") {
      return delegation
    }

    if (delegation.status !== "accepted") {
      throw new Error(`Isolated delegation "${id}" must be accepted before apply. Current status: ${delegation.status}.`)
    }

    const artifactsDir = delegation.artifactsDir ?? (await this.getArtifactDirForID(sessionID, id))
    const diffPath = path.join(artifactsDir, "diff.patch")
    let diffContent = await this.readArtifactText(sessionID, id, "diff.patch")
    if (!diffContent?.trim()) {
      diffContent = await this.buildPatchFromWorktree(delegation)
      if (!diffContent.trim()) {
        throw new Error(`Cannot apply isolated delegation "${id}": diff artifact is missing/empty and no patch could be rebuilt from the worktree.`)
      }
      await fs.writeFile(diffPath, diffContent, "utf8")
    }

    const statusCheck = await runGit(["status", "--porcelain"], this.projectDirectory)
    if (statusCheck.exitCode !== 0) {
      throw new Error(`Failed to inspect main workspace status before apply.\n\n${statusCheck.stderr || statusCheck.stdout || "Unknown git status failure."}`)
    }

    if ((statusCheck.stdout || "").trim()) {
      throw new Error("Main workspace is not clean. Commit, stash, or discard local changes before using delegation_apply.")
    }

    const checkApply = await runGit(["apply", "--check", diffPath], this.projectDirectory, 30000)
    if (checkApply.exitCode !== 0) {
      throw new Error(`Diff cannot be applied cleanly to the main workspace.\n\n${checkApply.stderr || checkApply.stdout || "git apply --check failed."}`)
    }

    const applyResult = await runGit(["apply", diffPath], this.projectDirectory, 30000)
    if (applyResult.exitCode !== 0) {
      throw new Error(`Failed to apply diff to the main workspace.\n\n${applyResult.stderr || applyResult.stdout || "git apply failed."}`)
    }

    delegation.status = "applied"
    delegation.completedAt = delegation.completedAt ?? new Date()
    const content = delegation.result ?? (await this.readArtifactText(sessionID, id, "result.md")) ?? "(No result content available)"
    delegation.result = content
    await this.cleanupIsolatedWorktree(delegation, "Applied to main workspace")
    await this.saveIsolatedMeta(delegation)
    await this.writeIsolatedSummary(delegation, content)
    if (this.delegations.has(id)) this.delegations.set(id, delegation)
    return delegation
  }

  async discardIsolated(sessionID: string, id: string): Promise<Delegation> {
    const delegation = await this.resolveIsolatedDelegation(sessionID, id)

    if (delegation.status === "discarded") {
      return delegation
    }

    if (delegation.status === "applied") {
      throw new Error(`Isolated delegation "${id}" was already applied and cannot be discarded.`)
    }

    if (delegation.status === "running") {
      throw new Error(`Isolated delegation "${id}" is still running. Wait for completion before discarding.`)
    }

    const content = delegation.result ?? (await this.readArtifactText(sessionID, id, "result.md")) ?? "(No result content available)"
    delegation.result = content
    if (!delegation.worktreeRemovedAt) {
      await this.cleanupIsolatedWorktree(delegation, "Discarded by operator", true)
    } else {
      delegation.worktreeCleanupNote = delegation.worktreeCleanupNote || "Discarded after prior automatic cleanup"
    }
    delegation.status = "discarded"
    delegation.completedAt = delegation.completedAt ?? new Date()

    await this.saveIsolatedMeta(delegation)
    await this.writeIsolatedSummary(delegation, content)
    if (this.delegations.has(id)) this.delegations.set(id, delegation)
    return delegation
  }

  private async waitForCompletion(delegationId: string): Promise<void> {
    const start = Date.now()
    while (Date.now() - start < MAX_RUN_TIME_MS + 10000) {
      const delegation = this.delegations.get(delegationId)
      if (!delegation || delegation.status !== "running") return
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  private async handleTimeout(delegationId: string): Promise<void> {
    const delegation = this.delegations.get(delegationId)
    if (!delegation || delegation.status !== "running") return

    delegation.status = "timeout"
    delegation.completedAt = new Date()
    delegation.error = `Delegation timed out after ${MAX_RUN_TIME_MS / 1000}s`

    try {
      await this.client.session.delete({ path: { id: delegation.sessionID } })
    } catch {
      // ignore
    }

    const result = await this.getResult(delegation)
    if (delegation.mode === "isolated-write") {
      await this.captureIsolatedArtifacts(delegation, `${result}\n\n[TIMEOUT REACHED]`)
      await this.cleanupIsolatedWorktree(delegation, "Automatic cleanup after isolated delegation timeout")
      await this.saveIsolatedMeta(delegation)
      await this.writeIsolatedSummary(delegation, `${result}\n\n[TIMEOUT REACHED]`)
    } else {
      await this.persistOutput(delegation, `${result}\n\n[TIMEOUT REACHED]`)
    }
    await this.notifyParent(delegation)
  }

  async handleSessionIdle(sessionID: string): Promise<void> {
    const delegation = this.findBySession(sessionID)
    if (!delegation || delegation.status !== "running") return

    delegation.completedAt = new Date()
    delegation.result = await this.getResult(delegation)
    const metadata = deriveMetadata(delegation.result)
    delegation.title = metadata.title
    delegation.description = metadata.description

    if (delegation.mode === "isolated-write") {
      delegation.status = "review_pending"
      await this.captureIsolatedArtifacts(delegation, delegation.result)
    } else {
      delegation.status = "complete"
      await this.persistOutput(delegation, delegation.result)
    }
    await this.notifyParent(delegation)
  }

  private async getResult(delegation: Delegation): Promise<string> {
    try {
      const messages = await this.client.session.messages({ path: { id: delegation.sessionID } })
      const items = (messages?.data ?? []) as Array<{ info?: { role?: string }; parts?: Part[] }>
      const assistants = items.filter((item) => item.info?.role === "assistant")
      if (assistants.length === 0) {
        return `Delegation ${delegation.id} completed but produced no assistant response.`
      }

      const last = assistants[assistants.length - 1]
      const text = (last.parts ?? [])
        .filter((part: any) => part?.type === "text")
        .map((part: any) => String(part.text ?? ""))
        .join("\n")
        .trim()

      return text || `Delegation ${delegation.id} completed but produced no text output.`
    } catch (error) {
      return `Delegation ${delegation.id} completed but result retrieval failed: ${error instanceof Error ? error.message : "Unknown error"}`
    }
  }

  private async buildPatchFromWorktree(delegation: Delegation): Promise<string> {
    const worktreeDir = delegation.worktree?.directory
    if (!worktreeDir) return ""

    const status = await runGit(["status", "--short"], worktreeDir)
    const trackedDiff = await runGit(["diff", "--binary"], worktreeDir, 30000)
    let patch = trackedDiff.stdout || ""

    const untrackedFiles = (status.stdout || "")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("?? "))
      .map((line) => line.slice(3).trim())

    for (const file of untrackedFiles) {
      const diff = await runGit(["diff", "--binary", "--no-index", "--", "/dev/null", file], worktreeDir, 30000)
      if (diff.exitCode !== 0 && diff.exitCode !== 1 && !diff.stdout) {
        throw new Error(`Failed to build patch for untracked file "${file}": ${diff.stderr || diff.stdout || "Unknown git diff failure."}`)
      }
      if (!diff.stdout) continue
      if (patch && !patch.endsWith("\n")) patch += "\n"
      patch += diff.stdout
    }

    return patch
  }

  private async captureIsolatedArtifacts(delegation: Delegation, content: string): Promise<void> {
    const artifactsDir = await this.ensureArtifactDir(delegation)
    delegation.result = content
    const worktreeDir = delegation.worktree?.directory
    const status = worktreeDir ? await runGit(["status", "--short"], worktreeDir).catch((error) => ({ exitCode: 1, stdout: "", stderr: String(error) })) : undefined
    const diffText = worktreeDir ? await this.buildPatchFromWorktree(delegation).catch((error) => `STDERR:\n${error instanceof Error ? error.message : String(error)}`) : undefined
    const changedFiles = (status?.stdout ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.replace(/^\S+\s+/, ""))

    await Promise.all([
      fs.writeFile(path.join(artifactsDir, "result.md"), content, "utf8"),
      fs.writeFile(path.join(artifactsDir, "changed-files.json"), JSON.stringify(changedFiles, null, 2), "utf8"),
      fs.writeFile(path.join(artifactsDir, "git-status.txt"), status ? `${status.stdout}${status.stderr ? `\nSTDERR:\n${status.stderr}` : ""}` : "No worktree directory recorded.", "utf8"),
      fs.writeFile(path.join(artifactsDir, "diff.patch"), diffText ?? "No worktree directory recorded.", "utf8"),
      fs.writeFile(path.join(artifactsDir, "worktree.json"), JSON.stringify(delegation.worktree ?? null, null, 2), "utf8"),
    ])
    await this.saveIsolatedMeta(delegation)
    await this.writeIsolatedSummary(delegation, content)
  }

  private async persistOutput(delegation: Delegation, content: string): Promise<void> {
    try {
      const dir = await this.ensureDelegationsDir(delegation.parentSessionID)
      const filePath = path.join(dir, `${delegation.id}.md`)
      const title = delegation.title || delegation.id
      const description = delegation.description || summarize(content, 180) || "(No description generated)"
      const promptPreview = summarize(delegation.prompt, 240)

      const body = `# ${title}

${description}

**ID:** ${delegation.id}
**Agent:** ${delegation.agent}
**Status:** ${delegation.status}
**Started:** ${delegation.startedAt.toISOString()}
**Completed:** ${delegation.completedAt?.toISOString() || "N/A"}
**Prompt Preview:** ${promptPreview}

---

${content}`

      await fs.writeFile(filePath, body, "utf8")
    } catch (error) {
      await this.debugLog(`persistOutput failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private async notifyParent(delegation: Delegation): Promise<void> {
    try {
      const pendingSet = this.pendingByParent.get(delegation.parentSessionID)
      pendingSet?.delete(delegation.id)
      const allComplete = !pendingSet || pendingSet.size === 0
      if (allComplete) {
        this.pendingByParent.delete(delegation.parentSessionID)
      }

      const completionNotification = `[TASK NOTIFICATION]\nID: ${delegation.id}\nStatus: ${delegation.status}\nUse delegation_read("${delegation.id}") to retrieve the full result.`

      await this.client.session.prompt({
        path: { id: delegation.parentSessionID },
        body: {
          noReply: true,
          agent: delegation.parentAgent,
          parts: [{ type: "text", text: completionNotification }],
        },
      })

      if (allComplete) {
        await this.client.session.prompt({
          path: { id: delegation.parentSessionID },
          body: {
            noReply: false,
            agent: delegation.parentAgent,
            parts: [{ type: "text", text: "[TASK NOTIFICATION] All background delegations complete." }],
          },
        })
      }
    } catch (error) {
      await this.debugLog(`notifyParent failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async readOutput(sessionID: string, id: string): Promise<string> {
    const dir = await this.getDelegationsDir(sessionID)
    const filePath = path.join(dir, `${id}.md`)
    try {
      return await fs.readFile(filePath, "utf8")
    } catch {
      // continue
    }

    const delegation = this.delegations.get(id)
    if (delegation?.status === "running") {
      await this.waitForCompletion(id)
      try {
        return await fs.readFile(filePath, "utf8")
      } catch {
        const updated = this.delegations.get(id)
        if (updated && updated.status !== "running") {
          return `Delegation "${id}" ended with status: ${updated.status}. ${updated.error || ""}`
        }
      }
    }

    throw new Error(`Delegation "${id}" not found.\n\nUse delegation_list() to see available delegations.`)
  }

  async listDelegations(sessionID: string): Promise<DelegationListItem[]> {
    const results: DelegationListItem[] = []

    for (const delegation of this.delegations.values()) {
      results.push({
        id: delegation.id,
        status: delegation.status,
        title: delegation.title || "(generating...)",
        description: delegation.description || summarize(delegation.prompt, 120),
        agent: delegation.agent,
      })
    }

    try {
      const dir = await this.getDelegationsDir(sessionID)
      const files = await fs.readdir(dir)
      for (const file of files) {
        if (!file.endsWith(".md")) continue
        const id = file.replace(/\.md$/, "")
        if (results.find((item) => item.id === id)) continue

        const filePath = path.join(dir, file)
        const content = await fs.readFile(filePath, "utf8")
        const titleMatch = content.match(/^# (.+)$/m)
        const descriptionMatch = content.split("\n").find((line, index, lines) => index > 0 && line.trim() && !line.startsWith("**") && lines[index - 1]?.startsWith("# "))
        const agentMatch = content.match(/^\*\*Agent:\*\* (.+)$/m)
        const statusMatch = content.match(/^\*\*Status:\*\* (.+)$/m)

        results.push({
          id,
          status: statusMatch?.[1] ?? "complete",
          title: titleMatch?.[1] ?? id,
          description: descriptionMatch ?? "(loaded from storage)",
          agent: agentMatch?.[1],
        })
      }
    } catch {
      // ignore missing directory
    }

    return results.sort((a, b) => a.id.localeCompare(b.id))
  }

  async getRecentCompletedDelegations(sessionID: string): Promise<DelegationListItem[]> {
    const all = await this.listDelegations(sessionID)
    return all.filter((item) => item.status !== "running").slice(-RECENT_COMPLETED_LIMIT)
  }
}

function formatDelegationContext(
  running: Array<{ id: string; agent?: string; prompt?: string; startedAt?: Date }>,
  completed: DelegationListItem[],
): string {
  const sections: string[] = ["<delegation-context>"]

  if (running.length > 0) {
    sections.push("## Running Delegations", "")
    for (const delegation of running) {
      sections.push(`### \`${delegation.id}\`${delegation.agent ? ` (${delegation.agent})` : ""}`)
      if (delegation.startedAt) sections.push(`**Started:** ${delegation.startedAt.toISOString()}`)
      if (delegation.prompt) sections.push(`**Prompt:** ${summarize(delegation.prompt, 200)}`)
      sections.push("")
    }
    sections.push("> You WILL be notified when delegations complete.")
    sections.push("> Do NOT poll delegation_list(). Continue productive work.", "")
  }

  if (completed.length > 0) {
    sections.push("## Recent Completed Delegations", "")
    for (const delegation of completed) {
      sections.push(`- \`${delegation.id}\` [${delegation.status}]${delegation.title ? ` — ${delegation.title}` : ""}`)
    }
    sections.push("", "> Use delegation_read(id) to retrieve the full result.", "")
  }

  sections.push("## Retrieval")
  sections.push('Use `delegation_read("id")` to access full delegation output.')
  sections.push("</delegation-context>")
  return sections.join("\n")
}

function createDelegate(manager: DelegationManager) {
  return tool({
    description: `Delegate a task to a read-only agent. Returns immediately with a readable ID.

Use this for:
- research and exploration
- review and analysis
- design work that does not edit files
- any task where you want persistent, retrievable output while continuing productive work

Results are persisted to disk and survive compaction. Nested read-only delegation is policy-limited to approved caller/target pairs and one secondary level.`,
    args: {
      prompt: tool.schema.string().describe("Detailed prompt for the delegated read-only agent. Include enough context for an isolated worker: objective, why, scope, constraints, relevant facts, exact paths or memory references, and expected output. Prefer English for consistency."),
      agent: tool.schema.string().describe("Target read-only agent name, for example code-inspector, reviewer, explorer, or ui-web-designer."),
    },
    async execute(args: { prompt: string; agent: string }, toolCtx: ToolContext): Promise<string> {
      if (!toolCtx?.sessionID) return "❌ delegate requires sessionID. This is a system error."
      if (!toolCtx?.messageID) return "❌ delegate requires messageID. This is a system error."

      try {
        const delegation = await manager.delegate({
          parentSessionID: toolCtx.sessionID,
          parentMessageID: toolCtx.messageID,
          parentAgent: toolCtx.agent,
          prompt: args.prompt,
          agent: args.agent,
        })

        const activeCount = manager.getRunningDelegations().filter((d) => d.parentSessionID === toolCtx.sessionID).length
        let response = `Delegation started: ${delegation.id}\nAgent: ${args.agent}`
        if (activeCount > 1) response += `\n\n${activeCount} delegations now active.`
        response += "\nYou WILL be notified when it completes. Do NOT poll."
        return response
      } catch (error) {
        return `❌ Delegation failed:\n\n${error instanceof Error ? error.message : "Unknown error"}`
      }
    },
  })
}

function createDelegateIsolated(manager: DelegationManager) {
  return tool({
    description: `Delegate write-capable implementation work to an isolated OpenCode worktree.

Use this only from master-dev when parallel implementation is worthwhile and the result must be reviewed manually before integration.
It creates a sandbox worktree, runs the target write-capable agent there, and persists result artifacts including git status and diff.patch.
It does NOT commit, merge, apply, or push changes.`,
    args: {
      prompt: tool.schema.string().describe("Detailed implementation prompt. Include objective, why, scope, constraints, exact files or areas, validation expectations, and expected final summary."),
      agent: tool.schema.string().describe("Target write-capable agent. Allowed: backend-java-developer, frontend-web-developer, master-dev."),
      name: tool.schema.string().optional().describe("Optional worktree name. Defaults to delegate-<id>."),
    },
    async execute(args: { prompt: string; agent: string; name?: string }, toolCtx: ToolContext): Promise<string> {
      if (!toolCtx?.sessionID) return "❌ delegate_isolated requires sessionID. This is a system error."
      if (!toolCtx?.messageID) return "❌ delegate_isolated requires messageID. This is a system error."

      try {
        const delegation = await manager.delegateIsolated({
          parentSessionID: toolCtx.sessionID,
          parentMessageID: toolCtx.messageID,
          parentAgent: toolCtx.agent,
          prompt: args.prompt,
          agent: args.agent,
          name: args.name,
        })

        return `Isolated delegation started: ${delegation.id}\nAgent: ${args.agent}\nWorktree: ${delegation.worktree?.directory || "created"}\nYou WILL be notified when it reaches review_pending/error/timeout. No changes will be applied automatically.`
      } catch (error) {
        return `❌ Isolated delegation failed:\n\n${error instanceof Error ? error.message : "Unknown error"}`
      }
    },
  })
}

function createDelegationAccept(manager: DelegationManager) {
  return tool({
    description: `Mark an isolated write delegation as accepted for manual integration later.
Use this after reviewing the persisted diff and artifacts. It keeps the worktree and updates status to accepted.`,
    args: {
      id: tool.schema.string().describe("Delegation ID for an isolated write task."),
    },
    async execute(args: { id: string }, toolCtx: ToolContext): Promise<string> {
      if (!toolCtx?.sessionID) return "❌ delegation_accept requires sessionID. This is a system error."
      if (toolCtx?.agent !== "master-dev") return '❌ delegation_accept is restricted to master-dev.'

      try {
        const delegation = await manager.acceptIsolated(toolCtx.sessionID, args.id)
        return `Delegation accepted: ${delegation.id}\nStatus: ${delegation.status}\nWorktree: ${delegation.worktree?.directory || "N/A"}\nArtifacts: ${delegation.artifactsDir || "stored"}`
      } catch (error) {
        return `❌ delegation_accept failed:\n\n${error instanceof Error ? error.message : "Unknown error"}`
      }
    },
  })
}

function createDelegationDiscard(manager: DelegationManager) {
  return tool({
    description: `Discard an isolated write delegation and remove its worktree.
Artifacts are preserved for audit, but the sandbox worktree is deleted.`,
    args: {
      id: tool.schema.string().describe("Delegation ID for an isolated write task."),
    },
    async execute(args: { id: string }, toolCtx: ToolContext): Promise<string> {
      if (!toolCtx?.sessionID) return "❌ delegation_discard requires sessionID. This is a system error."
      if (toolCtx?.agent !== "master-dev") return '❌ delegation_discard is restricted to master-dev.'

      try {
        const delegation = await manager.discardIsolated(toolCtx.sessionID, args.id)
        return `Delegation discarded: ${delegation.id}\nStatus: ${delegation.status}\nArtifacts: ${delegation.artifactsDir || "stored"}`
      } catch (error) {
        return `❌ delegation_discard failed:\n\n${error instanceof Error ? error.message : "Unknown error"}`
      }
    },
  })
}

function createDelegationApply(manager: DelegationManager) {
  return tool({
    description: `Apply an accepted isolated write delegation to the main workspace.
Use this only after review. It requires a clean main workspace, checks patch applicability first, applies the persisted diff without committing, and then attempts worktree cleanup.`,
    args: {
      id: tool.schema.string().describe("Delegation ID for an accepted isolated write task."),
    },
    async execute(args: { id: string }, toolCtx: ToolContext): Promise<string> {
      if (!toolCtx?.sessionID) return "❌ delegation_apply requires sessionID. This is a system error."
      if (toolCtx?.agent !== "master-dev") return '❌ delegation_apply is restricted to master-dev.'

      try {
        const delegation = await manager.applyIsolated(toolCtx.sessionID, args.id)
        const worktreeRemoved = delegation.worktreeRemovedAt ? "yes" : "no"
        return `Delegation applied: ${delegation.id}\nStatus: ${delegation.status}\nWorktree removed: ${worktreeRemoved}\nWorkspace now contains unstaged changes from the accepted diff.`
      } catch (error) {
        return `❌ delegation_apply failed:\n\n${error instanceof Error ? error.message : "Unknown error"}`
      }
    },
  })
}

function createDelegationRead(manager: DelegationManager) {
  return tool({
    description: `Read the output of a delegation by its ID.
Use this to retrieve full results from delegated tasks, especially after compaction or when a compact notification already arrived.`,
    args: {
      id: tool.schema.string().describe("Delegation ID, for example brisk-blue-falcon."),
    },
    async execute(args: { id: string }, toolCtx: ToolContext): Promise<string> {
      if (!toolCtx?.sessionID) return "❌ delegation_read requires sessionID. This is a system error."
      return manager.readOutput(toolCtx.sessionID, args.id)
    },
  })
}

function createDelegationList(manager: DelegationManager) {
  return tool({
    description: `List delegations for the current session.
Use sparingly. Do NOT use this as a polling loop while waiting for completion notifications.`,
    args: {},
    async execute(_args: Record<string, never>, toolCtx: ToolContext): Promise<string> {
      if (!toolCtx?.sessionID) return "❌ delegation_list requires sessionID. This is a system error."

      const delegations = await manager.listDelegations(toolCtx.sessionID)
      if (delegations.length === 0) return "No delegations found for this session."

      const lines = delegations.map((delegation) => {
        const title = delegation.title ? ` | ${delegation.title}` : ""
        const description = delegation.description ? `\n  → ${delegation.description}` : ""
        return `- **${delegation.id}**${title} [${delegation.status}]${description}`
      })
      return `## Delegations\n\n${lines.join("\n")}`
    },
  })
}

const DELEGATION_RULES = `<task-notification>
<delegation-system>

## Async Background Delegation

You have tools for parallel background work:
- \`delegate(prompt, agent)\` - Launch a background task and get an ID immediately
- \`delegate_isolated(prompt, agent, name?)\` - Launch write-capable work in an isolated worktree for manual review
- \`delegation_read(id)\` - Retrieve the full persisted result
- \`delegation_list()\` - List delegations (use sparingly)
- \`delegation_apply(id)\` - Apply an accepted isolated delegation to the main workspace
- \`delegation_accept(id)\` - Mark an isolated write delegation as accepted after review
- \`delegation_discard(id)\` - Discard an isolated write delegation and remove its worktree

## When to Use delegate vs task

| Tool | Behavior | Use When |
|------|----------|----------|
| \`delegate\` | Async, background, persisted to disk | Read-only work where you can continue productively while it runs |
| \`delegate_isolated\` | Async, isolated OpenCode worktree, persisted diff artifacts | master-dev needs parallel implementation without touching the main workspace |
| \`task\` | Synchronous, blocks until complete | You need the result before continuing, or the work can write/edit/execute with risk |

## Critical Constraints

- \`delegate\` is ONLY for read-only target agents.
- \`delegate\` is restricted by caller/target policy and max nested depth 1.
- Approved nested read-only paths: master-dev -> any specialist/read-only agent; frontend/backend -> explorer or code-inspector; ui-web-designer -> explorer; reviewer -> code-inspector.
- Never use \`delegate\` for write-capable implementation work.
- \`delegate_isolated\` is restricted to master-dev and allowed write-capable targets. It never auto-merges; review artifacts first.
- \`delegation_apply\` is restricted to master-dev, requires an \`accepted\` isolated delegation, and requires a clean main workspace.
- \`delegation_accept\` and \`delegation_discard\` are also restricted to master-dev.
- If a delegation result contains durable knowledge, save a curated summary to Engram with \`mem_save\` instead of storing the raw output there.

## Context Contract (MANDATORY)

When calling \`delegate\`, the prompt you send MUST include enough context for an isolated worker to act correctly.

Include, when relevant:
- Objective: what exactly the delegated agent must do
- Why: why this matters now
- Scope: what is in and out of scope
- Relevant facts/evidence already known
- Exact file paths, directories, or artifacts to inspect
- Relevant Engram references or memory findings if they matter
- Expected output shape (bullets, report, checklist, etc.)
- Output budget (for example: max 5 bullets, max 15 lines, or concise only)

Do NOT assume the delegated agent can infer hidden context from the parent conversation.

## How It Works

1. Call \`delegate(prompt, agent)\`
2. Continue productive work while it runs in the background
3. Receive a compact notification with ID and status only
4. Use \`delegation_read(id)\` when you need the full result

For \`delegate_isolated\`, wait for \`review_pending\`, then inspect the persisted summary, worktree path, changed files, and \`diff.patch\`.
After review:
- use \`delegation_accept(id)\` to keep the reviewed worktree for manual integration later,
- use \`delegation_apply(id)\` only after acceptance, when the main workspace is clean and you want to apply the stored diff without committing,
- use \`delegation_discard(id)\` to remove the worktree and close it out.

On isolated \`error\` or \`timeout\`, the plugin attempts automatic worktree cleanup and preserves artifacts for audit.

## Anti-patterns

- NEVER poll \`delegation_list()\` in a loop while waiting.
- NEVER sit idle waiting for a background task if there is other productive work to do.
- NEVER assume the compact notification contains the full result.
- NEVER send vague prompts like "inspect this" or "continue from before" without explicit context.
- NEVER ask for a long open-ended report when a short decision-support artifact would do.
- NEVER use \`delegate_isolated\` as a way to bypass review, tests, or ownership of final integration.
- NEVER use \`delegation_apply\` on a dirty main workspace.

</delegation-system>
</task-notification>`

interface SystemTransformInput {
  agent?: string
  sessionID?: string
}

export const BackgroundAgents: Plugin = async (ctx) => {
  const { client, directory, serverUrl } = ctx
  const log = createLogger(client as OpencodeClient)
  const worktreeClient = createOpencodeClientV2({
    baseUrl: serverUrl.toString(),
    directory,
  })
  const projectId = await getProjectId(directory)
  const baseDir = path.join(os.homedir(), ".local", "share", "opencode", "delegations", projectId)
  await fs.mkdir(baseDir, { recursive: true })

  const manager = new DelegationManager(client as OpencodeClient, worktreeClient, directory, baseDir, log)

  return {
    tool: {
      delegate: createDelegate(manager),
      delegation_read: createDelegationRead(manager),
      delegation_list: createDelegationList(manager),
      delegation_apply: createDelegationApply(manager),
      delegation_accept: createDelegationAccept(manager),
      delegation_discard: createDelegationDiscard(manager),
      delegate_isolated: createDelegateIsolated(manager),
    },

    "experimental.chat.system.transform": async (_input: SystemTransformInput, output) => {
      const combined = [...output.system, DELEGATION_RULES].join("\n\n---\n\n")
      output.system = [combined]
    },

    "experimental.session.compacting": async (
      input: { sessionID: string },
      output: { context: string[] },
    ) => {
      const rootSessionID = await manager.getRootSessionID(input.sessionID)
      const running = manager
        .getRunningDelegations()
        .filter((delegation) => delegation.parentSessionID === input.sessionID || delegation.parentSessionID === rootSessionID)
        .map((delegation) => ({
          id: delegation.id,
          agent: delegation.agent,
          prompt: delegation.prompt,
          startedAt: delegation.startedAt,
        }))

      const completed = await manager.getRecentCompletedDelegations(input.sessionID)
      if (running.length === 0 && completed.length === 0) return

      output.context.push(formatDelegationContext(running, completed))
    },

    event: async ({ event }: { event: Event }): Promise<void> => {
      if (event.type === "session.idle") {
        const sessionID = event.properties.sessionID
        const delegation = manager.findBySession(sessionID)
        if (delegation) await manager.handleSessionIdle(sessionID)
      }
    },
  }
}

export default BackgroundAgents
