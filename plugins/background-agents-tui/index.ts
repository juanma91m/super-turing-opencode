import * as crypto from "node:crypto"
import * as fs from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import { createElement } from "@opentui/solid"
import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui"

type ToastVariant = "info" | "success" | "warning" | "error"
type DelegationStatus =
  | "pending"
  | "running"
  | "complete"
  | "error"
  | "cancelled"
  | "timeout"
  | "review_pending"
  | "accepted"
  | "discarded"
  | "applied"

interface PersistedDelegationMeta {
  id: string
  mode: "read-only" | "isolated-write"
  sessionID?: string | null
  agent: string
  status: DelegationStatus | string
  queuedAt?: string | null
  startedAt?: string | null
  completedAt?: string | null
  error?: string | null
  title?: string | null
  description?: string | null
}

interface DelegationRecord {
  id: string
  status: string
  mode: string
  sessionID?: string
  agent: string
  title?: string
  description?: string
  error?: string
  queuedAt?: string
  startedAt?: string
  completedAt?: string
  updatedAt?: string
}

interface Snapshot {
  projectId?: string
  items: DelegationRecord[]
  counts: {
    pending: number
    running: number
    complete: number
    error: number
    review_pending: number
  }
}

const POLL_INTERVAL_MS = 2500
const TOASTABLE_STATUSES = new Set(["complete", "error", "review_pending", "timeout", "cancelled"])

function hashString(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 16)
}

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

function summarize(text: string | undefined, max = 120): string | undefined {
  if (!text) return undefined
  const normalized = text.replace(/\s+/g, " ").trim()
  if (!normalized) return undefined
  return normalized.length > max ? `${normalized.slice(0, max).trim()}...` : normalized
}

function formatStatusLabel(status: string): string {
  return status.replace(/_/g, " ")
}

function getStatusPresentation(status: string): { icon: string; label: string; variant: ToastVariant } {
  const label = formatStatusLabel(status)
  switch (status) {
    case "pending":
      return { icon: "🟡", label, variant: "info" }
    case "running":
      return { icon: "🔵", label, variant: "info" }
    case "complete":
      return { icon: "🟢", label, variant: "success" }
    case "review_pending":
      return { icon: "🟣", label, variant: "success" }
    case "accepted":
      return { icon: "✅", label, variant: "success" }
    case "applied":
      return { icon: "🟢", label, variant: "success" }
    case "timeout":
      return { icon: "🟠", label, variant: "warning" }
    case "cancelled":
    case "discarded":
      return { icon: "⚪", label, variant: "warning" }
    case "error":
    default:
      return { icon: "🔴", label, variant: "error" }
  }
}

function buildFooter(snapshot: Snapshot): string {
  const parts = [
    `BG`,
    `p:${snapshot.counts.pending}`,
    `r:${snapshot.counts.running}`,
    `c:${snapshot.counts.complete}`,
    `e:${snapshot.counts.error}`,
  ]
  if (snapshot.counts.review_pending > 0) parts.push(`review:${snapshot.counts.review_pending}`)
  parts.push(`/bg-tasks`)
  return parts.join(" · ")
}

function renderFooter(snapshot: Snapshot) {
  return createElement(
    "box",
    {
      paddingLeft: 1,
      paddingRight: 1,
    },
    createElement("text", {}, buildFooter(snapshot)),
  )
}

function renderSidebarSummary(snapshot: Snapshot) {
  return createElement(
    "box",
    {
      border: true,
      paddingTop: 1,
      paddingBottom: 1,
      paddingLeft: 2,
      paddingRight: 2,
      flexDirection: "column",
      gap: 1,
    },
    createElement("text", {}, "Background tasks"),
    createElement("text", {}, `pending ${snapshot.counts.pending} · running ${snapshot.counts.running}`),
    createElement("text", {}, `complete ${snapshot.counts.complete} · error ${snapshot.counts.error}`),
    snapshot.counts.review_pending > 0 ? createElement("text", {}, `review ${snapshot.counts.review_pending}`) : null,
    createElement("text", {}, "/bg-tasks"),
  )
}

function sortKey(item: DelegationRecord): string {
  return item.completedAt || item.startedAt || item.queuedAt || item.updatedAt || item.id
}

async function readProjectSnapshot(projectDirectory: string): Promise<Snapshot> {
  const projectId = await getProjectId(projectDirectory)
  const baseDir = path.join(os.homedir(), ".local", "share", "opencode", "delegations", projectId)
  const counts = { pending: 0, running: 0, complete: 0, error: 0, review_pending: 0 }
  const items: DelegationRecord[] = []

  try {
    const sessionDirs = await fs.readdir(baseDir, { withFileTypes: true })
    for (const sessionDir of sessionDirs) {
      if (!sessionDir.isDirectory()) continue
      const sessionPath = path.join(baseDir, sessionDir.name)
      const delegationDirs = await fs.readdir(sessionPath, { withFileTypes: true }).catch(() => [])
      for (const delegationDir of delegationDirs) {
        if (!delegationDir.isDirectory()) continue
        const metaPath = path.join(sessionPath, delegationDir.name, "meta.json")
        try {
          const raw = await fs.readFile(metaPath, "utf8")
          const meta = JSON.parse(raw) as PersistedDelegationMeta
          const record: DelegationRecord = {
            id: meta.id,
            status: meta.status,
            mode: meta.mode,
            sessionID: meta.sessionID ?? undefined,
            agent: meta.agent,
            title: meta.title ?? undefined,
            description: meta.description ?? undefined,
            error: meta.error ?? undefined,
            queuedAt: meta.queuedAt ?? undefined,
            startedAt: meta.startedAt ?? undefined,
            completedAt: meta.completedAt ?? undefined,
            updatedAt: meta.completedAt ?? meta.startedAt ?? meta.queuedAt ?? undefined,
          }
          items.push(record)

          if (record.status === "pending") counts.pending += 1
          else if (record.status === "running") counts.running += 1
          else if (record.status === "review_pending") counts.review_pending += 1
          else if (record.status === "error" || record.status === "timeout") counts.error += 1
          else if (["complete", "accepted", "applied", "discarded", "cancelled"].includes(record.status)) counts.complete += 1
        } catch {
          // ignore malformed or transient files
        }
      }
    }
  } catch {
    // ignore missing delegation dir
  }

  items.sort((a, b) => sortKey(b).localeCompare(sortKey(a)))
  return { projectId, items, counts }
}

const BackgroundAgentsTui: TuiPlugin = async (api) => {
  let snapshot: Snapshot = { items: [], counts: { pending: 0, running: 0, complete: 0, error: 0, review_pending: 0 } }
  let lastStatuses = new Map<string, string>()
  let initializedProjectId: string | undefined

  const currentDirectory = () => api.state.path.directory || api.state.path.worktree || process.cwd()

  const showStatusToast = (item: DelegationRecord) => {
    const presentation = getStatusPresentation(item.status)
    const title = item.status === "review_pending" ? "Background task ready for review" : `Background task ${presentation.label}`
    const detail = summarize(item.title || item.error || item.description)
    api.ui.toast({
      title,
      message: detail ? `${item.id} · ${detail}` : `${item.id} · ${item.agent}`,
      variant: presentation.variant,
      duration: presentation.variant === "error" ? 7000 : 5000,
    })
  }

  const refreshSnapshot = async () => {
    const next = await readProjectSnapshot(currentDirectory())
    const nextStatuses = new Map<string, string>()
    for (const item of next.items) nextStatuses.set(item.id, item.status)

    if (initializedProjectId && initializedProjectId === next.projectId) {
      for (const item of next.items) {
        const previousStatus = lastStatuses.get(item.id)
        if (previousStatus && previousStatus !== item.status && TOASTABLE_STATUSES.has(item.status)) {
          showStatusToast(item)
        }
      }
    }

    snapshot = next
    initializedProjectId = next.projectId
    lastStatuses = nextStatuses
    api.renderer.requestRender()
  }

  const openFallbackAlert = (item: DelegationRecord) => {
    api.ui.dialog.replace(() =>
      api.ui.DialogAlert({
        title: "No live child session",
        message: `Use delegation_read("${item.id}") from the current session to inspect the persisted result.`,
      }),
    )
  }

  const handleItemSelect = (item: DelegationRecord) => {
    if (!item.sessionID) {
      openFallbackAlert(item)
      return
    }
    api.ui.dialog.clear()
    api.route.navigate("session", { sessionID: item.sessionID })
  }

  const openTasksDialog = () => {
    const options = snapshot.items.length
      ? snapshot.items.map((item) => {
          const presentation = getStatusPresentation(item.status)
          const summary = summarize(item.description || item.error) || "No description available"
          return {
            title: `${presentation.icon} ${item.id}${item.title ? ` — ${item.title}` : ""}`,
            value: item,
            description: `${presentation.label} · ${item.agent} · ${item.mode}`,
            footer: item.sessionID ? `Open child session ${item.sessionID}` : `Use delegation_read("${item.id}") for persisted output`,
            onSelect: () => handleItemSelect(item),
            category: item.status,
          }
        })
      : [
          {
            title: "No background tasks found",
            value: undefined,
            description: "Launch a delegation first and reopen /bg-tasks.",
            disabled: true,
          },
        ]

    api.ui.dialog.replace(() =>
      api.ui.DialogSelect({
        title: "Background tasks",
        placeholder: "Select a task to open its child session",
        options,
        onSelect: (option) => {
          if (!option.value) return
          handleItemSelect(option.value as DelegationRecord)
        },
      }),
    )
  }

  const unregisterCommands = api.command.register(() => [
    {
      title: "Background tasks",
      value: "bg-tasks",
      description: "Show async/background delegations for this project",
      category: "Async",
      slash: { name: "bg-tasks", aliases: ["bgtasks"] },
      suggested: snapshot.counts.running > 0 || snapshot.counts.pending > 0,
      onSelect: openTasksDialog,
    },
  ])

  const unregisterSlots = api.slots.register({
    order: 1000,
    id: "background-agents-tui-footer",
    slots: {
      sidebar_content: () => renderSidebarSummary(snapshot),
      sidebar_footer: () => renderFooter(snapshot),
    },
  })

  await refreshSnapshot()
  const interval = setInterval(() => {
    void refreshSnapshot()
  }, POLL_INTERVAL_MS)

  api.lifecycle.onDispose(() => {
    clearInterval(interval)
    unregisterCommands()
    unregisterSlots()
  })
}

export const id: TuiPluginModule["id"] = "background-agents-tui"
export const tui: TuiPluginModule["tui"] = BackgroundAgentsTui
export { BackgroundAgentsTui }
export default { id, tui } satisfies TuiPluginModule
