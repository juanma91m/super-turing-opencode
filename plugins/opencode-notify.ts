import type { Plugin } from "@opencode-ai/plugin"
import type { Event } from "@opencode-ai/sdk"
import { homedir, platform } from "node:os"
import { join } from "node:path"
import { readFile } from "node:fs/promises"

type NotifyEventKind = "idle" | "question"

const COMPLETION_QUIET_PERIOD_MS = 10000
const MAX_PARENT_CHAIN_DEPTH = 12

interface NotifyConfig {
  quietHours: {
    enabled: boolean
    start: string
    end: string
  }
  sounds: {
    idle?: string
    question?: string
  }
}

const DEFAULT_CONFIG: NotifyConfig = {
  quietHours: {
    enabled: false,
    start: "22:00",
    end: "08:00",
  },
  sounds: {
    idle: "Glass",
    question: "Submarine",
  },
}

const CONFIG_PATH = join(homedir(), ".config", "opencode", "notify.json")
const DEDUPE_WINDOW_MS = 1500

function stripJsonComments(text: string): string {
  return text
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
}

async function loadConfig(): Promise<NotifyConfig> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf8")
    const parsed = JSON.parse(stripJsonComments(raw)) as Partial<NotifyConfig>
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      quietHours: {
        ...DEFAULT_CONFIG.quietHours,
        ...(parsed.quietHours ?? {}),
      },
      sounds: {
        ...DEFAULT_CONFIG.sounds,
        ...(parsed.sounds ?? {}),
      },
    }
  } catch {
    return DEFAULT_CONFIG
  }
}

function toMinutes(value: string): number | null {
  const match = value.match(/^(\d{2}):(\d{2})$/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null
  return hours * 60 + minutes
}

function isQuietHours(config: NotifyConfig): boolean {
  if (!config.quietHours.enabled) return false
  const start = toMinutes(config.quietHours.start)
  const end = toMinutes(config.quietHours.end)
  if (start === null || end === null) return false

  const now = new Date()
  const current = now.getHours() * 60 + now.getMinutes()
  if (start > end) return current >= start || current < end
  return current >= start && current < end
}

async function runOsascript(script: string): Promise<string | null> {
  if (platform() !== "darwin") return null
  try {
    const proc = Bun.spawn(["osascript", "-e", script], { stdout: "pipe", stderr: "pipe" })
    return (await new Response(proc.stdout).text()).trim() || null
  } catch {
    return null
  }
}

function detectTerminalProcess(): string | null {
  const termProgram = (process.env.TERM_PROGRAM ?? "").toLowerCase()
  if (termProgram.includes("vscode")) return "Code"
  if (termProgram.includes("apple_terminal")) return "Terminal"
  if (termProgram.includes("iterm")) return "iTerm2"
  if (termProgram.includes("wezterm")) return "WezTerm"
  if (termProgram.includes("ghostty")) return "Ghostty"
  if (termProgram.includes("warp")) return "Warp"
  if (process.env.KITTY_WINDOW_ID) return "kitty"
  if (process.env.GHOSTTY_RESOURCES_DIR) return "Ghostty"
  if (process.env.TMUX) return "tmux"
  return null
}

async function isTerminalFocused(_kind: NotifyEventKind): Promise<boolean> {
  const terminalProcess = detectTerminalProcess()
  if (!terminalProcess || platform() !== "darwin") return false
  const frontmost = await runOsascript(
    'tell application "System Events" to get name of first application process whose frontmost is true',
  )
  return !!frontmost && frontmost.toLowerCase() === terminalProcess.toLowerCase()
}

async function sendNotification(kind: NotifyEventKind, title: string, message: string, sound?: string): Promise<void> {
  if (platform() === "darwin") {
    const escapedTitle = title.replace(/"/g, '\\"')
    const escapedMessage = message.replace(/"/g, '\\"')
    const soundPart = sound ? ` sound name \"${sound.replace(/"/g, '\\"')}\"` : ""
    await runOsascript(`display notification \"${escapedMessage}\" with title \"${escapedTitle}\"${soundPart}`)
    return
  }

  if (platform() === "linux") {
    try {
      const args = sound ? [title, message, "-h", `string:sound-name:${sound}`] : [title, message]
      Bun.spawn(["notify-send", ...args], { stdout: "ignore", stderr: "ignore" })
    } catch {
      // best effort
    }
    return
  }

  if (platform() === "win32") {
    try {
      const escapedTitle = title.replace(/'/g, "''")
      const escapedMessage = message.replace(/'/g, "''")
      const script = `Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('${escapedMessage}','${escapedTitle}') | Out-Null`
      Bun.spawn(["powershell", "-NoProfile", "-Command", script], { stdout: "ignore", stderr: "ignore" })
    } catch {
      // best effort
    }
  }
}

async function isParentSession(client: Parameters<Plugin>[0]["client"], sessionID: string): Promise<boolean> {
  try {
    const session = await client.session.get({ path: { id: sessionID } })
    return !session.data?.parentID
  } catch {
    return true
  }
}

function shouldSendDeduped(map: Map<string, number>, key: string): boolean {
  const now = Date.now()
  for (const [existingKey, timestamp] of map) {
    if (now - timestamp >= DEDUPE_WINDOW_MS) map.delete(existingKey)
  }
  const previous = map.get(key)
  if (previous && now - previous < DEDUPE_WINDOW_MS) return false
  map.set(key, now)
  return true
}

function getSessionID(properties: Record<string, unknown> | undefined): string | null {
  const direct = properties?.sessionID
  if (typeof direct === "string" && direct.trim()) return direct.trim()
  const info = properties?.info as Record<string, unknown> | undefined
  const nested = info?.sessionID
  if (typeof nested === "string" && nested.trim()) return nested.trim()
  return null
}

async function getRootSessionID(client: Parameters<Plugin>[0]["client"], sessionID: string): Promise<string> {
  let currentID = sessionID
  for (let depth = 0; depth < MAX_PARENT_CHAIN_DEPTH; depth += 1) {
    try {
      const session = await client.session.get({ path: { id: currentID } })
      const parentID = session.data?.parentID
      if (!parentID) return currentID
      currentID = parentID
    } catch {
      return currentID
    }
  }
  return currentID
}

async function getSessionTitle(client: Parameters<Plugin>[0]["client"], sessionID: string): Promise<string> {
  try {
    const session = await client.session.get({ path: { id: sessionID } })
    const title = session.data?.title?.trim()
    if (title) return title
  } catch {
    // ignore
  }
  return sessionID.slice(0, 8)
}

const NotifyPlugin: Plugin = async ({ client }) => {
  const readyNotifications = new Map<string, number>()
  const questionNotifications = new Map<string, number>()
  const completionArmedSessions = new Set<string>()
  const waitingForUserReplySessions = new Set<string>()
  const activityVersionByRootSession = new Map<string, number>()
  const completionTimers = new Map<string, ReturnType<typeof setTimeout>>()

  function clearCompletionTimer(rootSessionID: string): void {
    const timer = completionTimers.get(rootSessionID)
    if (!timer) return
    clearTimeout(timer)
    completionTimers.delete(rootSessionID)
  }

  function bumpActivity(rootSessionID: string): number {
    clearCompletionTimer(rootSessionID)
    const next = (activityVersionByRootSession.get(rootSessionID) ?? 0) + 1
    activityVersionByRootSession.set(rootSessionID, next)
    return next
  }

  async function maybeNotify(kind: NotifyEventKind, sessionID: string, title: string, message: string, dedupe: Map<string, number>, key: string) {
    const config = await loadConfig()
    if (isQuietHours(config)) return
    if (!(await isParentSession(client, sessionID))) return
    if (!shouldSendDeduped(dedupe, key)) return
    if (await isTerminalFocused(kind)) return
    await sendNotification(kind, title, message, config.sounds[kind])
  }

  async function maybeNotifyCompletion(rootSessionID: string, scheduledVersion: number): Promise<void> {
    if ((activityVersionByRootSession.get(rootSessionID) ?? 0) !== scheduledVersion) return
    if (!completionArmedSessions.has(rootSessionID)) return
    if (waitingForUserReplySessions.has(rootSessionID)) return

    completionArmedSessions.delete(rootSessionID)
    const sessionTitle = await getSessionTitle(client, rootSessionID)
    await maybeNotify(
      "idle",
      rootSessionID,
      `OpenCode: ${sessionTitle}`,
      "La tarea finalizó y ya podés enviar un nuevo prompt.",
      readyNotifications,
      `idle:${rootSessionID}`,
    )
  }

  function scheduleCompletionNotification(rootSessionID: string): void {
    clearCompletionTimer(rootSessionID)
    const scheduledVersion = activityVersionByRootSession.get(rootSessionID) ?? 0
    const timer = setTimeout(() => {
      void maybeNotifyCompletion(rootSessionID, scheduledVersion)
    }, COMPLETION_QUIET_PERIOD_MS)
    completionTimers.set(rootSessionID, timer)
  }

  return {
    "tool.execute.before": async (input) => {
      if (input.tool !== "question") return
      const rootSessionID = await getRootSessionID(client, input.sessionID)
      bumpActivity(rootSessionID)
      waitingForUserReplySessions.add(rootSessionID)
      completionArmedSessions.delete(rootSessionID)
      const sessionTitle = await getSessionTitle(client, rootSessionID)
      await maybeNotify(
        "question",
        rootSessionID,
        `OpenCode: ${sessionTitle}`,
        "El agente hizo una pregunta y está esperando tu respuesta.",
        questionNotifications,
        `question:${rootSessionID}:${input.callID}`,
      )
    },
    event: async ({ event }: { event: Event }) => {
      const runtimeEvent = event as { type: string; properties?: Record<string, unknown> }
      const sessionID = getSessionID(runtimeEvent.properties)
      if (!sessionID) return
      const rootSessionID = await getRootSessionID(client, sessionID)

      switch (runtimeEvent.type) {
        case "message.updated": {
          bumpActivity(rootSessionID)
          const info = runtimeEvent.properties?.info as Record<string, unknown> | undefined
          if ((info?.role as string | undefined) === "user") {
            completionArmedSessions.add(rootSessionID)
            waitingForUserReplySessions.delete(rootSessionID)
          }
          break
        }
        case "session.idle": {
          if (sessionID !== rootSessionID) break
          if (!completionArmedSessions.has(rootSessionID)) break
          if (waitingForUserReplySessions.has(rootSessionID)) break
          scheduleCompletionNotification(rootSessionID)
          break
        }
        case "question.asked": {
          bumpActivity(rootSessionID)
          waitingForUserReplySessions.add(rootSessionID)
          completionArmedSessions.delete(rootSessionID)
          const requestId = typeof runtimeEvent.properties?.requestID === "string" ? runtimeEvent.properties.requestID : "event"
          const sessionTitle = await getSessionTitle(client, rootSessionID)
          await maybeNotify(
            "question",
            rootSessionID,
            `OpenCode: ${sessionTitle}`,
            "El agente hizo una pregunta y está esperando tu respuesta.",
            questionNotifications,
            `question:${rootSessionID}:${requestId}`,
          )
          break
        }
        case "session.deleted": {
          clearCompletionTimer(rootSessionID)
          completionArmedSessions.delete(rootSessionID)
          waitingForUserReplySessions.delete(rootSessionID)
          activityVersionByRootSession.delete(rootSessionID)
          break
        }
        default: {
          bumpActivity(rootSessionID)
          break
        }
      }
    },
  }
}

export default NotifyPlugin
