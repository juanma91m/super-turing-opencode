import type { Config, Plugin } from "@opencode-ai/plugin"

type PermissionAction = "ask" | "allow" | "deny"
type BashPermission = PermissionAction | Record<string, PermissionAction>

const RISKY_BASH_PATTERNS = [
  "sudo *",
  "doas *",
  "pkexec *",
  "rm *",
  "rmdir *",
  "shred *",
  "git reset *",
  "git clean *",
  "git rebase *",
  "git checkout -- *",
  "git restore *",
  "git branch -D *",
  "git branch -d *",
  "git branch --delete *",
  "git push *--force*",
  "git push * -f*",
  "git commit *--amend*",
  "git tag -d *",
  "git tag --delete *",
  "gh repo delete *",
  "gh repo rename *",
  "gh repo archive *",
  "gh repo transfer *",
  "gh api * -X DELETE*",
  "gh api * --method DELETE*",
  "gh api * -X PATCH*",
  "gh api * --method PATCH*",
  "gh api * -X PUT*",
  "gh api * --method PUT*",
  "chmod *",
  "chown *",
  "chgrp *",
  "setfacl *",
  "kill *",
  "killall *",
  "pkill *",
  "shutdown *",
  "reboot *",
  "poweroff *",
  "halt *",
  "systemctl stop *",
  "systemctl disable *",
  "systemctl mask *",
  "systemctl restart *",
  "dd *",
  "fdisk *",
  "parted *",
  "mkfs*",
  "wipefs *",
  "docker system prune *",
  "docker system rm *",
  "docker volume prune *",
  "docker volume rm *",
  "docker image prune *",
  "docker image rm *",
  "docker container prune *",
  "docker container rm *",
  "docker compose down *-v*",
  "docker compose down *--volumes*",
  "kubectl delete *",
  "helm uninstall *",
  "terraform apply *",
  "terraform destroy *",
  "tofu apply *",
  "tofu destroy *",
  "dropdb *",
  "mysqladmin drop *",
  "psql *",
  "mysql *",
  "mongosh *",
  "redis-cli *",
  "alembic upgrade *",
  "liquibase update *",
  "flyway migrate *",
  "prisma migrate deploy *",
  "npm publish *",
  "pnpm publish *",
  "yarn npm publish *",
  "mvn deploy *",
  "gradle publish *",
  "docker push *",
  "bash -c *",
  "sh -c *",
  "zsh -c *",
  "eval *",
] as const

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

export function controlledBashPermission(current?: BashPermission): BashPermission {
  if (current === "deny") return current
  if (typeof current === "object" && current["*"] === "deny") return current

  const existing = typeof current === "object" ? Object.entries(current).filter(([pattern]) => pattern !== "*") : []
  return Object.fromEntries([
    ["*", "allow"],
    ...existing.filter(([, action]) => action !== "deny"),
    ...RISKY_BASH_PATTERNS.map((pattern) => [pattern, "ask"] as const),
    ...existing.filter(([, action]) => action === "deny"),
  ])
}

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
  config: async (config) => applyControlledBashProfile(config),
  "permission.ask": async (input, output) => {
    const normalized = normalizePermissionInput(input as PermissionAskInput)
    if (permissionNeedsApproval(normalized.permission, normalized.patterns)) return
    output.status = "allow"
  },
})

export default PermissionAutopilotPlugin
