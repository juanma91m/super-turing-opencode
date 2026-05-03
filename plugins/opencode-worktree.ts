import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import { homedir, platform } from "node:os"
import { basename, dirname, join, resolve } from "node:path"
import { createHash } from "node:crypto"
import { access, copyFile, mkdir, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises"

interface WorktreeConfig {
  worktreePath?: string
  sync: {
    copyFiles: string[]
    symlinkDirs: string[]
  }
  hooks: {
    postCreate: string[]
    preDelete: string[]
  }
  terminal?: string
}

interface WorktreeRecord {
  branch: string
  baseBranch: string
  ticket?: string
  parentBranch: string
  path: string
  createdAt: string
}

const DEFAULT_CONFIG: WorktreeConfig = {
  sync: { copyFiles: [], symlinkDirs: [] },
  hooks: { postCreate: [], preDelete: [] },
}

const BRANCH_PATTERN = /^[A-Za-z0-9._/-]+$/
const HASH_LENGTH = 12

function stripJsonComments(text: string): string {
  return text
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
}

function expandHome(input: string): string {
  if (input === "~") return homedir()
  if (input.startsWith("~/")) return join(homedir(), input.slice(2))
  return input
}

function isSafeRelativePath(input: string): boolean {
  if (!input.trim()) return false
  if (input.includes("..")) return false
  if (input.startsWith("/")) return false
  return true
}

function validateBranchName(branch: string): string | null {
  if (!branch.trim()) return "La rama no puede estar vacía."
  if (branch.startsWith("-") || branch.startsWith("/") || branch.endsWith("/")) {
    return "La rama tiene un formato inválido."
  }
  if (branch.includes("..") || branch.includes("@{") || branch.endsWith(".lock")) {
    return "La rama contiene patrones inválidos para git."
  }
  if (!BRANCH_PATTERN.test(branch)) {
    return "La rama contiene caracteres no permitidos."
  }
  return null
}

async function runGit(args: string[], cwd: string): Promise<{ ok: true; stdout: string } | { ok: false; error: string }> {
  try {
    const proc = Bun.spawn(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" })
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
    if (exitCode !== 0) return { ok: false, error: stderr.trim() || `git ${args[0]} failed` }
    return { ok: true, stdout: stdout.trim() }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

function projectIdFor(root: string): string {
  return createHash("sha256").update(root).digest("hex").slice(0, HASH_LENGTH)
}

function registryDir(repoRoot: string): string {
  return join(homedir(), ".local", "share", "opencode", "worktrees", projectIdFor(repoRoot))
}

function registryPath(repoRoot: string): string {
  return join(registryDir(repoRoot), "registry.json")
}

async function loadRegistry(repoRoot: string): Promise<WorktreeRecord[]> {
  try {
    const raw = await readFile(registryPath(repoRoot), "utf8")
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as WorktreeRecord[]) : []
  } catch {
    return []
  }
}

async function saveRegistry(repoRoot: string, records: WorktreeRecord[]): Promise<void> {
  const dir = registryDir(repoRoot)
  await mkdir(dir, { recursive: true })
  await writeFile(registryPath(repoRoot), JSON.stringify(records, null, 2) + "\n", "utf8")
}

async function loadConfig(repoRoot: string): Promise<WorktreeConfig> {
  const configPath = join(repoRoot, ".opencode", "worktree.jsonc")
  try {
    const raw = await readFile(configPath, "utf8")
    const parsed = JSON.parse(stripJsonComments(raw)) as Partial<WorktreeConfig>
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      sync: {
        ...DEFAULT_CONFIG.sync,
        ...(parsed.sync ?? {}),
      },
      hooks: {
        ...DEFAULT_CONFIG.hooks,
        ...(parsed.hooks ?? {}),
      },
      worktreePath: parsed.worktreePath ? expandHome(parsed.worktreePath) : undefined,
    }
  } catch {
    const defaultPath = join(repoRoot, ".opencode", "worktree.jsonc")
    const template = `{
  "$schema": "https://opencode.ai/worktree.schema.json",
  "sync": {
    "copyFiles": [],
    "symlinkDirs": []
  },
  "hooks": {
    "postCreate": [],
    "preDelete": []
  }
}
`
    await mkdir(dirname(defaultPath), { recursive: true }).catch(() => {})
    await writeFile(defaultPath, template, "utf8").catch(() => {})
    return DEFAULT_CONFIG
  }
}

async function currentBranch(repoRoot: string): Promise<string | null> {
  const result = await runGit(["rev-parse", "--abbrev-ref", "HEAD"], repoRoot)
  return result.ok ? result.stdout : null
}

async function isClean(repoRoot: string): Promise<boolean> {
  const result = await runGit(["status", "--porcelain"], repoRoot)
  return result.ok ? result.stdout.trim().length === 0 : false
}

async function hasUpstream(repoRoot: string): Promise<boolean> {
  const result = await runGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], repoRoot)
  return result.ok
}

async function maybeFastForwardPull(repoRoot: string): Promise<{ ok: boolean; message?: string }> {
  if (!(await hasUpstream(repoRoot))) return { ok: true, message: "Rama sin upstream; se omite pull." }
  const fetchResult = await runGit(["fetch", "--all", "--prune"], repoRoot)
  if (!fetchResult.ok) return { ok: false, message: fetchResult.error }
  const pullResult = await runGit(["pull", "--ff-only"], repoRoot)
  if (!pullResult.ok) return { ok: false, message: pullResult.error }
  return { ok: true }
}

async function copyFiles(repoRoot: string, worktreePath: string, files: string[]): Promise<string[]> {
  const copied: string[] = []
  for (const relative of files) {
    if (!isSafeRelativePath(relative)) continue
    const source = join(repoRoot, relative)
    if (!(await pathExists(source))) continue
    const target = join(worktreePath, relative)
    await mkdir(dirname(target), { recursive: true })
    await copyFile(source, target)
    copied.push(relative)
  }
  return copied
}

async function symlinkDirs(repoRoot: string, worktreePath: string, dirs: string[]): Promise<string[]> {
  const linked: string[] = []
  for (const relative of dirs) {
    if (!isSafeRelativePath(relative)) continue
    const source = join(repoRoot, relative)
    let sourceStat
    try {
      sourceStat = await stat(source)
    } catch {
      continue
    }
    if (!sourceStat.isDirectory()) continue
    const target = join(worktreePath, relative)
    await mkdir(dirname(target), { recursive: true })
    await rm(target, { recursive: true, force: true })
    await symlink(source, target, "dir")
    linked.push(relative)
  }
  return linked
}

async function runHooks(cwd: string, commands: string[]): Promise<string[]> {
  const ran: string[] = []
  for (const command of commands) {
    const proc = Bun.spawn(["bash", "-lc", command], { cwd, stdout: "pipe", stderr: "pipe" })
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
    if (exitCode !== 0) {
      throw new Error(`Hook failed: ${command}\n${stderr.trim() || stdout.trim()}`)
    }
    ran.push(command)
  }
  return ran
}

async function spawnTerminal(worktreePath: string, branch: string, terminalOverride?: string): Promise<{ opened: boolean; detail: string }> {
  const shellCommand = `cd ${JSON.stringify(worktreePath)} && opencode`

  if (process.env.TMUX && Bun.which("tmux")) {
    const proc = Bun.spawn(["tmux", "new-window", "-n", `oc:${branch}`, `bash -lc ${JSON.stringify(shellCommand)}`], {
      stdout: "ignore",
      stderr: "ignore",
    })
    const exitCode = await proc.exited
    if (exitCode === 0) return { opened: true, detail: "tmux new-window" }
  }

  if (platform() === "darwin") {
    try {
      const script = `tell application "Terminal" to do script ${JSON.stringify(shellCommand)}`
      const proc = Bun.spawn(["osascript", "-e", script], { stdout: "ignore", stderr: "ignore" })
      const exitCode = await proc.exited
      if (exitCode === 0) return { opened: true, detail: "Terminal.app" }
    } catch {
      // best effort
    }
  }

  const candidates = terminalOverride
    ? [terminalOverride]
    : ["x-terminal-emulator", "gnome-terminal", "konsole", "xfce4-terminal", "kitty", "wezterm", "alacritty"]

  for (const terminal of candidates) {
    if (!Bun.which(terminal)) continue
    let argv: string[] | null = null
    switch (terminal) {
      case "gnome-terminal":
        argv = [terminal, "--", "bash", "-lc", shellCommand]
        break
      case "konsole":
        argv = [terminal, "-e", "bash", "-lc", shellCommand]
        break
      case "xfce4-terminal":
        argv = [terminal, "--command", `bash -lc ${JSON.stringify(shellCommand)}`]
        break
      case "kitty":
      case "wezterm":
      case "alacritty":
      case "x-terminal-emulator":
      default:
        argv = [terminal, "-e", "bash", "-lc", shellCommand]
        break
    }

    try {
      const proc = Bun.spawn(argv, { stdout: "ignore", stderr: "ignore" })
      const exitCode = await proc.exited
      if (exitCode === 0) return { opened: true, detail: terminal }
    } catch {
      // try next terminal
    }
  }

  return { opened: false, detail: `Abrí manualmente: cd ${worktreePath} && opencode` }
}

function tailRecord(records: WorktreeRecord[], branch: string): WorktreeRecord | undefined {
  return records.find((record) => record.branch === branch)
}

const WorktreePlugin: Plugin = async ({ directory }) => {
  return {
    tool: {
      worktree_create: tool({
        description:
          "Create a git branch + worktree pair for parallel ticket work. Optionally fast-forward the current parent branch first and open a new terminal with OpenCode inside the worktree.",
        args: {
          ticket: tool.schema.string().optional().describe("Optional ticket identifier (for example HIGYRUS-45645)."),
          branch: tool.schema.string().describe("New branch name for the worktree."),
          baseBranch: tool.schema.string().optional().describe("Parent branch to branch from. Defaults to the current branch."),
          pullBase: tool.schema.boolean().optional().describe("If true, fetch + pull --ff-only before creating the worktree when branching from the current branch."),
          openTerminal: tool.schema.boolean().optional().describe("If true, try to open a new terminal with OpenCode inside the worktree."),
        },
        async execute(args) {
          const repoRootResult = await runGit(["rev-parse", "--show-toplevel"], directory)
          if (!repoRootResult.ok) return `❌ No pude detectar el repo git actual: ${repoRootResult.error}`
          const repoRoot = repoRootResult.stdout

          const branchError = validateBranchName(args.branch)
          if (branchError) return `❌ ${branchError}`

          const parentBranch = await currentBranch(repoRoot)
          if (!parentBranch) return "❌ No pude detectar la branch actual."
          const baseBranch = args.baseBranch?.trim() || parentBranch
          const baseBranchError = validateBranchName(baseBranch)
          if (baseBranchError) return `❌ ${baseBranchError}`

          if (!(await isClean(repoRoot))) {
            return "❌ El árbol de trabajo no está limpio. Cerrá o guardá los cambios antes de crear un worktree por ticket."
          }

          if ((args.pullBase ?? true) && baseBranch === parentBranch) {
            const pullResult = await maybeFastForwardPull(repoRoot)
            if (!pullResult.ok) {
              return `❌ No pude fast-forwardear la branch base (${baseBranch}): ${pullResult.message}`
            }
          }

          const config = await loadConfig(repoRoot)
          const basePath = config.worktreePath ?? join(homedir(), ".local", "share", "opencode", "worktree", projectIdFor(repoRoot))
          const worktreePath = join(basePath, args.branch)
          if (await pathExists(worktreePath)) return `❌ Ya existe un worktree en ${worktreePath}`

          const createArgs = baseBranch === parentBranch && !args.baseBranch
            ? ["worktree", "add", "-b", args.branch, worktreePath, "HEAD"]
            : ["worktree", "add", "-b", args.branch, worktreePath, baseBranch]
          const createResult = await runGit(createArgs, repoRoot)
          if (!createResult.ok) return `❌ No pude crear el worktree: ${createResult.error}`

          const copied = await copyFiles(repoRoot, worktreePath, config.sync.copyFiles)
          const linked = await symlinkDirs(repoRoot, worktreePath, config.sync.symlinkDirs)

          let hooksRun: string[] = []
          try {
            hooksRun = await runHooks(worktreePath, config.hooks.postCreate)
          } catch (error) {
            return `❌ El worktree se creó pero falló un hook postCreate: ${error instanceof Error ? error.message : String(error)}`
          }

          const records = await loadRegistry(repoRoot)
          records.push({
            branch: args.branch,
            baseBranch,
            parentBranch,
            ticket: args.ticket?.trim() || undefined,
            path: worktreePath,
            createdAt: new Date().toISOString(),
          })
          await saveRegistry(repoRoot, records)

          const terminalResult = args.openTerminal === false ? { opened: false, detail: "Terminal launch skipped" } : await spawnTerminal(worktreePath, args.branch, config.terminal)

          const summary = [
            `✅ Worktree creado para ${args.ticket?.trim() || args.branch}.`,
            `- Branch padre: ${parentBranch}`,
            `- Base usada: ${baseBranch}`,
            `- Nueva branch: ${args.branch}`,
            `- Path: ${worktreePath}`,
          ]
          if (copied.length > 0) summary.push(`- copyFiles: ${copied.join(", ")}`)
          if (linked.length > 0) summary.push(`- symlinkDirs: ${linked.join(", ")}`)
          if (hooksRun.length > 0) summary.push(`- postCreate: ${hooksRun.join(" | ")}`)
          summary.push(terminalResult.opened ? `- Terminal: abierta vía ${terminalResult.detail}` : `- Terminal: ${terminalResult.detail}`)
          return summary.join("\n")
        },
      }),

      worktree_list: tool({
        description: "List registered worktrees for the current repository.",
        args: {},
        async execute() {
          const repoRootResult = await runGit(["rev-parse", "--show-toplevel"], directory)
          if (!repoRootResult.ok) return `❌ No pude detectar el repo git actual: ${repoRootResult.error}`
          const repoRoot = repoRootResult.stdout
          await runGit(["worktree", "prune", "--expire", "now"], repoRoot)
          const records = await loadRegistry(repoRoot)
          if (records.length === 0) return "No hay worktrees registrados para este repo."
          return records
            .map((record, index) => {
              const ticket = record.ticket ? ` [${record.ticket}]` : ""
              return `${index + 1}. ${record.branch}${ticket}\n   base=${record.baseBranch} parent=${record.parentBranch}\n   path=${record.path}`
            })
            .join("\n\n")
        },
      }),

      worktree_delete: tool({
        description:
          "Delete a previously created worktree. By default it refuses to delete dirty worktrees unless snapshotChanges=true or force=true.",
        args: {
          branch: tool.schema.string().optional().describe("Branch/worktree to delete. Defaults to the current branch if it is a registered worktree."),
          reason: tool.schema.string().optional().describe("Human-readable reason for cleanup or snapshot commit."),
          snapshotChanges: tool.schema.boolean().optional().describe("If true, commit uncommitted changes before deleting the worktree."),
          force: tool.schema.boolean().optional().describe("If true, skip the dirty-tree safety check and remove anyway."),
        },
        async execute(args) {
          const repoRootResult = await runGit(["rev-parse", "--show-toplevel"], directory)
          if (!repoRootResult.ok) return `❌ No pude detectar el repo git actual: ${repoRootResult.error}`
          const repoRoot = repoRootResult.stdout
          const records = await loadRegistry(repoRoot)
          if (records.length === 0) return "No hay worktrees registrados para este repo."

          const current = await currentBranch(directory)
          const targetBranch = args.branch?.trim() || current || ""
          if (!targetBranch) return "❌ No pude determinar qué worktree borrar."

          const record = tailRecord(records, targetBranch)
          if (!record) return `❌ No encontré un worktree registrado para ${targetBranch}.`

          const config = await loadConfig(repoRoot)
          try {
            await runHooks(record.path, config.hooks.preDelete)
          } catch (error) {
            return `❌ Falló un hook preDelete: ${error instanceof Error ? error.message : String(error)}`
          }

          const dirtyResult = await runGit(["status", "--porcelain"], record.path)
          const isDirty = dirtyResult.ok && dirtyResult.stdout.trim().length > 0
          if (isDirty && !args.snapshotChanges && !args.force) {
            return `❌ El worktree ${record.branch} tiene cambios sin commitear. Reintentá con snapshotChanges=true o limpiá el worktree manualmente.`
          }

          if (isDirty && args.snapshotChanges) {
            const addResult = await runGit(["add", "-A"], record.path)
            if (!addResult.ok) return `❌ No pude stagear cambios: ${addResult.error}`
            const message = `chore(worktree): snapshot before cleanup${args.reason ? ` - ${args.reason}` : ""}`
            const commitResult = await runGit(["commit", "-m", message, "--allow-empty"], record.path)
            if (!commitResult.ok) return `❌ No pude crear snapshot commit: ${commitResult.error}`
          }

          const removeResult = await runGit(["worktree", "remove", ...(args.force ? ["--force"] : []), record.path], repoRoot)
          if (!removeResult.ok) return `❌ No pude remover el worktree: ${removeResult.error}`

          const pruneResult = await runGit(["worktree", "prune", "--expire", "now"], repoRoot)
          if (!pruneResult.ok) {
            return `⚠️ El worktree fue removido pero no pude limpiar metadata stale con git worktree prune: ${pruneResult.error}`
          }

          await rm(record.path, { recursive: true, force: true }).catch(() => {})
          await saveRegistry(repoRoot, records.filter((item) => item.branch !== record.branch))

          return [
            `✅ Worktree eliminado: ${record.branch}`,
            `- Path: ${record.path}`,
            `- La branch git se conserva. Borrala manualmente si ya no la necesitás.`,
          ].join("\n")
        },
      }),
    },
  }
}

export default WorktreePlugin
