import type { Plugin } from "@opencode-ai/plugin"

const AUTO_ALLOW_PERMISSIONS = new Set([
  "bash",
  "edit",
  "write",
  "apply_patch",
  "external_directory",
  "glob",
  "grep",
  "list",
  "lsp",
  "read",
  "skill",
  "todowrite",
  "webfetch",
])

const SENSITIVE_REFERENCES = [
  /(^|[\s'"/\\])\.env(?:$|[.\s'"/\\])/i,
  /(^|[\s'"/\\])\.ssh(?:$|[/\\])/i,
  /(^|[\s'"/\\])\.gnupg(?:$|[/\\])/i,
  /(^|[\s'"/\\])\.aws[/\\](?:credentials|config)(?:$|\s|['"])/i,
  /(^|[\s'"/\\])\.config[/\\]gh[/\\]hosts\.yml(?:$|\s|['"])/i,
  /stitch-api-key/i,
  /(^|[\s'"/\\])(?:id_rsa|id_ed25519)(?:$|[.\s'"/\\])/i,
  /(^|[\s'"/\\])etc[/\\](?:shadow|sudoers)(?:$|\s|['"])/i,
]

const RISKY_BASH = [
  /(^|[\s;&|()])(?:sudo|doas|pkexec)(?:\s|$)/i,
  /(^|[\s;&|()])(?:rm|rmdir|shred)(?:\s|$)/i,
  /\bgit\s+(?:reset|clean|rebase)\b/i,
  /\bgit\s+checkout\s+--(?:\s|$)/i,
  /\bgit\s+restore\b/i,
  /\bgit\s+branch\s+(?:-D|-d|--delete)\b/i,
  /\bgit\s+push\b[^\n]*(?:--force(?:-with-lease)?|-f)(?:\s|$)/i,
  /\bgit\s+commit\b[^\n]*--amend\b/i,
  /\bgit\s+tag\s+(?:-d|--delete)\b/i,
  /\bgh\s+repo\s+(?:delete|rename|archive|transfer)\b/i,
  /\bgh\s+api\b[^\n]*(?:-X|--method)\s*(?:DELETE|PATCH|PUT)\b/i,
  /\b(?:chmod|chown|chgrp|setfacl)(?:\s|$)/i,
  /(^|[\s;&|()])(?:kill|killall|pkill)(?:\s|$)/i,
  /(^|[\s;&|()])(?:shutdown|reboot|poweroff|halt)(?:\s|$)/i,
  /\bsystemctl\s+(?:stop|disable|mask|restart)\b/i,
  /\b(?:dd|fdisk|parted|mkfs(?:\.\w+)?|wipefs)(?:\s|$)/i,
  /\bdocker\s+(?:system|volume|image|container)\s+(?:prune|rm)\b/i,
  /\bdocker\s+compose\s+down\b[^\n]*(?:-v|--volumes)\b/i,
  /\b(?:kubectl\s+delete|helm\s+uninstall)\b/i,
  /\b(?:terraform|tofu)\s+(?:apply|destroy)\b/i,
  /\b(?:dropdb|mysqladmin\s+drop)\b/i,
  /\b(?:psql|mysql|mongosh|redis-cli)\b/i,
  /\b(?:alembic\s+upgrade|liquibase\s+update|flyway\s+migrate|prisma\s+migrate\s+deploy)\b/i,
  /\b(?:npm\s+publish|pnpm\s+publish|yarn\s+npm\s+publish|mvn\s+deploy|gradle\s+publish|docker\s+push)\b/i,
  /(?:curl|wget)\b[^\n|]*(?:\||\|&)\s*(?:bash|sh|zsh)\b/i,
]

function containsSensitiveReference(value: string): boolean {
  const withoutExamples = value.replace(/\.env\.example/gi, "")
  return SENSITIVE_REFERENCES.some((pattern) => pattern.test(withoutExamples))
}

type PermissionAskInput = {
  type?: string
  pattern?: string | readonly string[]
  permission?: string
  patterns?: readonly string[]
}

function normalizePermissionInput(input: PermissionAskInput): { permission: string; patterns: readonly string[] } {
  const pattern = input.patterns ?? input.pattern ?? []
  return {
    permission: input.permission ?? input.type ?? "",
    patterns: typeof pattern === "string" ? [pattern] : pattern,
  }
}

export function permissionNeedsApproval(permission: string, patterns: readonly string[]): boolean {
  if (!AUTO_ALLOW_PERMISSIONS.has(permission)) return true
  if (patterns.some(containsSensitiveReference)) return true
  if (permission !== "bash") return false
  return patterns.some((command) => RISKY_BASH.some((pattern) => pattern.test(command)))
}

const PermissionAutopilotPlugin: Plugin = async () => ({
  "permission.ask": async (input, output) => {
    const normalized = normalizePermissionInput(input as PermissionAskInput)
    if (permissionNeedsApproval(normalized.permission, normalized.patterns)) return
    output.status = "allow"
  },
})

export default PermissionAutopilotPlugin
