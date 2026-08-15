import type { Plugin } from "@opencode-ai/plugin"

const ENV_FILE_PATTERN = /(^|[\s'"/\\])\.env($|[.\s'"/\\])/i
const ENV_EXAMPLE_PATTERN = /(^|\/|\\)\.env\.example$/i

function normalizePath(input: string): string {
  return input.replace(/\\/g, "/")
}

function isProtectedEnvPath(input: string): boolean {
  const normalized = normalizePath(input)
  if (ENV_EXAMPLE_PATTERN.test(normalized)) return false
  return ENV_FILE_PATTERN.test(normalized)
}

function containsProtectedEnvReference(input: string): boolean {
  return ENV_FILE_PATTERN.test(normalizePath(input).replace(/\.env\.example/gi, ""))
}

function extractCandidatePaths(args: Record<string, unknown> | undefined): string[] {
  if (!args) return []

  const candidates: string[] = []
  const pushIfString = (value: unknown) => {
    if (typeof value === "string" && value.trim()) candidates.push(value.trim())
  }

  pushIfString(args.filePath)
  pushIfString(args.path)
  pushIfString(args.from)
  pushIfString(args.to)
  pushIfString(args.filename)

  const files = args.files
  if (Array.isArray(files)) {
    for (const file of files) pushIfString(file)
  }

  const patchText = args.patchText
  if (typeof patchText === "string") {
    const matches = patchText.matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm)
    for (const match of matches) pushIfString(match[1])
  }

  return candidates
}

const BLOCKED_TOOLS = new Set(["read", "edit", "write", "patch", "multiedit", "apply_patch"])

const EnvGuardPlugin: Plugin = async () => ({
  "tool.execute.before": async (input, output) => {
    if (input.tool === "bash") {
      const command = (output.args as Record<string, unknown> | undefined)?.command
      if (typeof command !== "string" || !containsProtectedEnvReference(command)) return
      throw new Error(
        `Accessing sensitive .env* files through Bash is blocked by the global stack guard. ` +
          `Use explicit secret-safe workflows instead of exposing raw secrets. ` +
          `Only .env.example is allowed for normal operations.`,
      )
    }

    if (!BLOCKED_TOOLS.has(input.tool)) return

    const paths = extractCandidatePaths(output.args as Record<string, unknown> | undefined)
    const protectedPath = paths.find(isProtectedEnvPath)
    if (!protectedPath) return

    const action = input.tool === "read" ? "Reading" : "Editing"
    throw new Error(
      `${action} sensitive .env* files is blocked by the global stack guard (${protectedPath}). ` +
        `Use explicit secret-safe workflows instead of exposing or patching raw secrets. ` +
        `Only .env.example is allowed for normal reads/edits.`,
    )
  },
})

export default EnvGuardPlugin
