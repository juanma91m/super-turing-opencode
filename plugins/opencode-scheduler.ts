import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import { homedir } from "node:os"
import { basename, join, resolve } from "node:path"
import { createHash } from "node:crypto"
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises"

interface SchedulerJob {
  scopeId: string
  slug: string
  name: string
  schedule: string
  prompt: string
  workdir: string
  timeoutSeconds: number
  attachUrl?: string
  invocation: {
    command: string
    args: string[]
  }
  createdAt: string
  updatedAt: string
  lastRunAt?: string
  lastRunStatus?: "running" | "success" | "failed" | "timeout"
  lastRunExitCode?: number
  lastRunError?: string
  lastRunSource?: "scheduled" | "manual"
}

const OPENCODE_CONFIG_DIR = join(homedir(), ".config", "opencode")
const SCHEDULER_ROOT = join(OPENCODE_CONFIG_DIR, "scheduler")
const SCOPES_DIR = join(SCHEDULER_ROOT, "scopes")
const LOGS_ROOT = join(OPENCODE_CONFIG_DIR, "logs", "scheduler")
const SUPERVISOR_PATH = join(SCHEDULER_ROOT, "supervisor.py")
const CRON_MARKER = "opencode-scheduler"

const SUPERVISOR_SCRIPT = `#!/usr/bin/env python3
import json
import os
import signal
import subprocess
import sys
import time
from pathlib import Path


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=2) + "\\n", encoding="utf-8")
    tmp.replace(path)


def append_jsonl(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(data) + "\\n")


def pid_alive(pid: int) -> bool:
    if not pid:
        return False
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def iso_now():
    return time.strftime("%Y-%m-%dT%H:%M:%S%z", time.localtime())


def main():
    if len(sys.argv) < 3:
        raise SystemExit("usage: supervisor.py <job.json> <scheduled|manual>")

    job_path = Path(sys.argv[1]).resolve()
    run_source = sys.argv[2]
    job = load_json(job_path)

    scope_id = job["scopeId"]
    slug = job["slug"]
    workdir = Path(job["workdir"]).resolve()
    timeout_seconds = int(job.get("timeoutSeconds") or 0)

    locks_dir = Path("${SCHEDULER_ROOT}") / "scopes" / scope_id / "locks"
    runs_dir = Path("${SCHEDULER_ROOT}") / "scopes" / scope_id / "runs"
    logs_dir = Path("${LOGS_ROOT}") / scope_id
    lock_path = locks_dir / f"{slug}.json"
    run_path = runs_dir / f"{slug}.jsonl"
    log_path = logs_dir / f"{slug}.log"

    locks_dir.mkdir(parents=True, exist_ok=True)
    runs_dir.mkdir(parents=True, exist_ok=True)
    logs_dir.mkdir(parents=True, exist_ok=True)

    if lock_path.exists():
        try:
            lock_data = load_json(lock_path)
            if pid_alive(int(lock_data.get("pid") or 0)):
                return 0
        except Exception:
            pass
        try:
            lock_path.unlink()
        except Exception:
            pass

    lock_data = {"pid": os.getpid(), "startedAt": iso_now()}
    save_json(lock_path, lock_data)

    started_at = iso_now()
    started_ts = time.time()
    job["lastRunAt"] = started_at
    job["lastRunStatus"] = "running"
    job["lastRunSource"] = run_source
    job.pop("lastRunExitCode", None)
    job.pop("lastRunError", None)
    job["updatedAt"] = started_at
    save_json(job_path, job)

    env = os.environ.copy()
    try:
        existing = json.loads(env.get("OPENCODE_PERMISSION", "{}"))
    except Exception:
        existing = {}
    if not isinstance(existing, dict):
        existing = {}
    existing["question"] = "deny"
    env["OPENCODE_PERMISSION"] = json.dumps(existing)
    env["OPENCODE_SCHEDULER_RUN_SOURCE"] = run_source

    command = job["invocation"]["command"]
    args = job["invocation"]["args"]

    exit_code = 1
    final_status = "failed"
    final_error = None

    with log_path.open("a", encoding="utf-8") as log_fh:
        log_fh.write(f"\\n=== Scheduled run started {started_at} source={run_source} ===\\n")
        log_fh.flush()

        try:
            proc = subprocess.Popen(
                [command, *args],
                cwd=str(workdir),
                stdout=log_fh,
                stderr=subprocess.STDOUT,
                env=env,
                start_new_session=True,
            )
            try:
                exit_code = proc.wait(timeout=timeout_seconds if timeout_seconds > 0 else None)
                final_status = "success" if exit_code == 0 else "failed"
                if exit_code != 0:
                    final_error = f"exit code {exit_code}"
            except subprocess.TimeoutExpired:
                final_status = "timeout"
                final_error = "timeout"
                exit_code = 124
                try:
                    os.killpg(proc.pid, signal.SIGTERM)
                    time.sleep(5)
                    if proc.poll() is None:
                        os.killpg(proc.pid, signal.SIGKILL)
                except Exception:
                    pass
        except Exception as exc:
            final_status = "failed"
            final_error = str(exc)
            exit_code = 1

        finished_at = iso_now()
        duration_ms = int((time.time() - started_ts) * 1000)
        log_fh.write(f"\\n=== Finished {finished_at} status={final_status} exitCode={exit_code} durationMs={duration_ms} ===\\n")
        log_fh.flush()

    job["lastRunStatus"] = final_status
    job["lastRunExitCode"] = exit_code
    job["lastRunError"] = final_error
    job["updatedAt"] = iso_now()
    save_json(job_path, job)

    append_jsonl(run_path, {
        "startedAt": started_at,
        "finishedAt": iso_now(),
        "status": final_status,
        "exitCode": exit_code,
        "error": final_error,
        "source": run_source,
        "logPath": str(log_path),
    })

    try:
        lock_path.unlink()
    except Exception:
        pass

    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
`

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}

function hashPath(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 12)
}

function deriveScopeId(workdir: string): string {
  const normalized = resolve(workdir)
  return `${slugify(basename(normalized) || "workspace")}-${hashPath(normalized)}`
}

function validateCronExpression(cron: string): string | null {
  const fields = cron.trim().split(/\s+/)
  if (fields.length !== 5) return "El cron debe tener exactamente 5 campos."
  const validField = /^[-*/,0-9A-Za-z]+$/
  if (!fields.every((field) => validField.test(field))) {
    return "El cron contiene caracteres inválidos."
  }
  return null
}

function scopeDir(scopeId: string): string {
  return join(SCOPES_DIR, scopeId)
}

function scopeJobsDir(scopeId: string): string {
  return join(scopeDir(scopeId), "jobs")
}

function scopeRunsDir(scopeId: string): string {
  return join(scopeDir(scopeId), "runs")
}

function scopeLocksDir(scopeId: string): string {
  return join(scopeDir(scopeId), "locks")
}

function scopeLogsDir(scopeId: string): string {
  return join(LOGS_ROOT, scopeId)
}

function jobFilePath(scopeId: string, slug: string): string {
  return join(scopeJobsDir(scopeId), `${slug}.json`)
}

function jobLogPath(scopeId: string, slug: string): string {
  return join(scopeLogsDir(scopeId), `${slug}.log`)
}

async function ensureSchedulerDirs(scopeId: string): Promise<void> {
  await mkdir(scopeJobsDir(scopeId), { recursive: true })
  await mkdir(scopeRunsDir(scopeId), { recursive: true })
  await mkdir(scopeLocksDir(scopeId), { recursive: true })
  await mkdir(scopeLogsDir(scopeId), { recursive: true })
  await mkdir(SCHEDULER_ROOT, { recursive: true })
  await writeFile(SUPERVISOR_PATH, SUPERVISOR_SCRIPT, "utf8")
}

async function readJob(scopeId: string, slug: string): Promise<SchedulerJob | null> {
  try {
    const raw = await readFile(jobFilePath(scopeId, slug), "utf8")
    return JSON.parse(raw) as SchedulerJob
  } catch {
    return null
  }
}

async function writeJob(job: SchedulerJob): Promise<void> {
  await ensureSchedulerDirs(job.scopeId)
  await writeFile(jobFilePath(job.scopeId, job.slug), JSON.stringify(job, null, 2) + "\n", "utf8")
}

async function listScopeJobs(scopeId: string): Promise<SchedulerJob[]> {
  try {
    const files = await readdir(scopeJobsDir(scopeId))
    const jobs = await Promise.all(
      files.filter((file) => file.endsWith(".json")).map(async (file) => {
        const raw = await readFile(join(scopeJobsDir(scopeId), file), "utf8")
        return JSON.parse(raw) as SchedulerJob
      }),
    )
    return jobs.sort((a, b) => a.name.localeCompare(b.name))
  } catch {
    return []
  }
}

async function listAllJobs(): Promise<SchedulerJob[]> {
  try {
    const scopes = await readdir(SCOPES_DIR)
    const jobs = await Promise.all(scopes.map((scopeId) => listScopeJobs(scopeId)))
    return jobs.flat().sort((a, b) => a.name.localeCompare(b.name))
  } catch {
    return []
  }
}

async function readCrontab(): Promise<string[]> {
  try {
    const proc = Bun.spawn(["crontab", "-l"], { stdout: "pipe", stderr: "pipe" })
    const [stdout, exitCode] = await Promise.all([new Response(proc.stdout).text(), proc.exited])
    if (exitCode !== 0) return []
    return stdout.split("\n").filter(Boolean)
  } catch {
    return []
  }
}

async function writeCrontab(lines: string[]): Promise<{ ok: boolean; error?: string }> {
  try {
    await mkdir(SCHEDULER_ROOT, { recursive: true })
    const tempPath = join(SCHEDULER_ROOT, `crontab-${Date.now()}.tmp`)
    await writeFile(tempPath, lines.join("\n") + "\n", "utf8")
    const proc = Bun.spawnSync(["crontab", tempPath], {
      stdout: "pipe",
      stderr: "pipe",
    })
    const stderr = proc.stderr?.toString() || ""
    const exitCode = proc.exitCode
    await rm(tempPath, { force: true }).catch(() => {})
    if (exitCode !== 0) return { ok: false, error: stderr.trim() || "crontab failed" }
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

function buildCrontabLine(job: SchedulerJob): string {
  const marker = `# ${CRON_MARKER}:${job.scopeId}:${job.slug}`
  const command = `python3 ${JSON.stringify(SUPERVISOR_PATH)} ${JSON.stringify(jobFilePath(job.scopeId, job.slug))} scheduled`
  return `${job.schedule} cd ${JSON.stringify(job.workdir)} && ${command} ${marker}`
}

async function installCronJob(job: SchedulerJob): Promise<{ ok: boolean; error?: string }> {
  const existing = await readCrontab()
  const filtered = existing.filter((line) => !line.includes(`${CRON_MARKER}:${job.scopeId}:${job.slug}`))
  filtered.push(buildCrontabLine(job))
  return writeCrontab(filtered)
}

async function removeCronJob(scopeId: string, slug: string): Promise<{ ok: boolean; error?: string }> {
  const existing = await readCrontab()
  const filtered = existing.filter((line) => !line.includes(`${CRON_MARKER}:${scopeId}:${slug}`))
  return writeCrontab(filtered)
}

function tailLines(text: string, count: number): string {
  const lines = text.split("\n")
  return lines.slice(Math.max(0, lines.length - count)).join("\n")
}

function buildInvocation(prompt: string, workdir: string, attachUrl?: string): { command: string; args: string[] } {
  const binary = Bun.which("opencode") || "opencode"
  const args = ["run"]
  if (attachUrl) args.push("--attach", attachUrl)
  args.push("--", prompt)
  return { command: binary, args }
}

async function spawnSupervisor(job: SchedulerJob, source: "manual" | "scheduled"): Promise<void> {
  const proc = Bun.spawn(["python3", SUPERVISOR_PATH, jobFilePath(job.scopeId, job.slug), source], {
    cwd: job.workdir,
    stdout: "ignore",
    stderr: "ignore",
    detached: true,
  })
  proc.unref?.()
}

const SchedulerPlugin: Plugin = async ({ directory }) => ({
  tool: {
    schedule_job: tool({
      description: "Create or update a recurring scheduled OpenCode job for the current or specified project scope.",
      args: {
        name: tool.schema.string().describe("Human-readable job name."),
        schedule: tool.schema.string().describe("Cron schedule expression with 5 fields."),
        prompt: tool.schema.string().describe("Prompt that scheduled runs should execute."),
        workdir: tool.schema.string().optional().describe("Working directory for the job. Defaults to the current repo/directory."),
        timeoutSeconds: tool.schema.number().optional().describe("Optional hard timeout in seconds. Use 0 or omit to disable."),
        attachUrl: tool.schema.string().optional().describe("Optional OpenCode attach URL for runs against a live backend."),
      },
      async execute(args) {
        const cronError = validateCronExpression(args.schedule)
        if (cronError) return `❌ ${cronError}`

        const workdir = resolve(args.workdir?.trim() || directory)
        const slug = slugify(args.name)
        if (!slug) return "❌ No pude derivar un slug válido para el job."

        const scopeId = deriveScopeId(workdir)
        const now = new Date().toISOString()
        const existing = await readJob(scopeId, slug)
        const job: SchedulerJob = {
          scopeId,
          slug,
          name: args.name,
          schedule: args.schedule,
          prompt: args.prompt,
          workdir,
          timeoutSeconds: Math.max(0, Math.trunc(args.timeoutSeconds ?? 0)),
          attachUrl: args.attachUrl?.trim() || undefined,
          invocation: buildInvocation(args.prompt, workdir, args.attachUrl?.trim() || undefined),
          createdAt: existing?.createdAt || now,
          updatedAt: now,
          lastRunAt: existing?.lastRunAt,
          lastRunStatus: existing?.lastRunStatus,
          lastRunExitCode: existing?.lastRunExitCode,
          lastRunError: existing?.lastRunError,
          lastRunSource: existing?.lastRunSource,
        }

        await writeJob(job)
        const installResult = await installCronJob(job)
        if (!installResult.ok) return `❌ No pude instalar el cron job: ${installResult.error}`

        return [
          `✅ Job programado: ${job.name}`,
          `- Cron: ${job.schedule}`,
          `- Scope: ${job.scopeId}`,
          `- Workdir: ${job.workdir}`,
          `- Timeout: ${job.timeoutSeconds || 0}s`,
          `- Logs: ${jobLogPath(job.scopeId, job.slug)}`,
        ].join("\n")
      },
    }),

    list_jobs: tool({
      description: "List scheduled jobs for the current scope or across all scopes.",
      args: {
        allScopes: tool.schema.boolean().optional().describe("Include jobs from all scopes instead of only the current one."),
      },
      async execute(args) {
        const jobs = args.allScopes ? await listAllJobs() : await listScopeJobs(deriveScopeId(directory))
        if (jobs.length === 0) return "No hay jobs programados en este scope."
        return jobs
          .map((job) => `- ${job.name} (${job.slug})\n  cron=${job.schedule}\n  scope=${job.scopeId}\n  lastRun=${job.lastRunAt || "never"} status=${job.lastRunStatus || "unknown"}`)
          .join("\n\n")
      },
    }),

    get_job: tool({
      description: "Show full metadata for a scheduled job in the current scope or across all scopes.",
      args: {
        slug: tool.schema.string().describe("Job slug (usually derived from the name)."),
        allScopes: tool.schema.boolean().optional().describe("Search across all scopes if true."),
      },
      async execute(args) {
        const jobs = args.allScopes ? await listAllJobs() : await listScopeJobs(deriveScopeId(directory))
        const job = jobs.find((candidate) => candidate.slug === args.slug)
        if (!job) return `❌ No encontré un job con slug ${args.slug}.`
        return JSON.stringify(job, null, 2)
      },
    }),

    run_job: tool({
      description: "Run a scheduled job immediately in fire-and-forget mode, reusing the same supervisor, logs and lock semantics.",
      args: {
        slug: tool.schema.string().describe("Job slug to execute now."),
        allScopes: tool.schema.boolean().optional().describe("Search across all scopes if true."),
      },
      async execute(args) {
        const jobs = args.allScopes ? await listAllJobs() : await listScopeJobs(deriveScopeId(directory))
        const job = jobs.find((candidate) => candidate.slug === args.slug)
        if (!job) return `❌ No encontré un job con slug ${args.slug}.`
        await ensureSchedulerDirs(job.scopeId)
        await spawnSupervisor(job, "manual")
        return `✅ Job lanzado en background: ${job.name}\n- Logs: ${jobLogPath(job.scopeId, job.slug)}`
      },
    }),

    job_logs: tool({
      description: "Show recent log lines for a scheduled job.",
      args: {
        slug: tool.schema.string().describe("Job slug."),
        lines: tool.schema.number().optional().describe("How many trailing log lines to show."),
        allScopes: tool.schema.boolean().optional().describe("Search across all scopes if true."),
      },
      async execute(args) {
        const jobs = args.allScopes ? await listAllJobs() : await listScopeJobs(deriveScopeId(directory))
        const job = jobs.find((candidate) => candidate.slug === args.slug)
        if (!job) return `❌ No encontré un job con slug ${args.slug}.`
        try {
          const raw = await readFile(jobLogPath(job.scopeId, job.slug), "utf8")
          return tailLines(raw, Math.max(10, Math.trunc(args.lines ?? 80)))
        } catch {
          return `No hay logs todavía para ${job.name}.`
        }
      },
    }),

    delete_job: tool({
      description: "Delete a scheduled job and uninstall its cron entry. Optionally remove logs and history too.",
      args: {
        slug: tool.schema.string().describe("Job slug to delete."),
        allScopes: tool.schema.boolean().optional().describe("Search across all scopes if true."),
        includeHistory: tool.schema.boolean().optional().describe("Also remove logs, locks and run history."),
      },
      async execute(args) {
        const jobs = args.allScopes ? await listAllJobs() : await listScopeJobs(deriveScopeId(directory))
        const job = jobs.find((candidate) => candidate.slug === args.slug)
        if (!job) return `❌ No encontré un job con slug ${args.slug}.`

        const cronResult = await removeCronJob(job.scopeId, job.slug)
        if (!cronResult.ok) return `❌ No pude quitar el cron job: ${cronResult.error}`

        await rm(jobFilePath(job.scopeId, job.slug), { force: true })
        if (args.includeHistory) {
          await rm(jobLogPath(job.scopeId, job.slug), { force: true }).catch(() => {})
          await rm(join(scopeRunsDir(job.scopeId), `${job.slug}.jsonl`), { force: true }).catch(() => {})
          await rm(join(scopeLocksDir(job.scopeId), `${job.slug}.json`), { force: true }).catch(() => {})
        }

        return `✅ Job eliminado: ${job.name}`
      },
    }),
  },
})

export default SchedulerPlugin
