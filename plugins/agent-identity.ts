import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"

type SessionMessage = {
  info: {
    role?: string
    sessionID?: string
    agent?: string
    providerID?: string
    modelID?: string
    variant?: string
  }
}

function formatModel(info: SessionMessage["info"]): string {
  const provider = info.providerID ?? "unknown-provider"
  const model = info.modelID ?? "unknown-model"
  const base = `${provider}/${model}`
  return info.variant ? `${base} (${info.variant})` : base
}

const AgentIdentityPlugin: Plugin = async ({ client }) => {
  const agentBySession = new Map<string, string>()

  return {
    "experimental.chat.messages.transform": async (_input, output) => {
      const messages = output.messages as Array<SessionMessage>
      const lastUserMsg = [...messages].reverse().find((m) => m.info.role === "user")
      if (!lastUserMsg?.info.sessionID || !lastUserMsg.info.agent) return
      agentBySession.set(lastUserMsg.info.sessionID, lastUserMsg.info.agent)
    },

    "experimental.chat.system.transform": async (input, output) => {
      if (!input.sessionID) return
      const agent = agentBySession.get(input.sessionID)
      if (!agent) return
      output.system.push(`You are currently operating as the "${agent}" agent.`)
      agentBySession.delete(input.sessionID)
    },

    tool: {
      agent_attribution: tool({
        description:
          "Get per-message attribution for the current session, including which agent produced each assistant response and which model was used.",
        args: {},
        async execute(_args, context) {
          const response = await client.session.messages({
            path: { id: context.sessionID },
          })
          const messages = (response.data ?? []) as Array<SessionMessage>
          if (messages.length === 0) return ""

          return messages
            .map((message, index) => {
              const line = `${index + 1}. ${message.info.role ?? "unknown"}`
              if (message.info.role !== "assistant") return line
              return `${line} (${message.info.agent ?? "unknown-agent"}) [${formatModel(message.info)}]`
            })
            .join("\n")
        },
      }),
    },
  }
}

export default AgentIdentityPlugin
