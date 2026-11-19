import { Plugin } from "@opencode/plugin"
import { register } from "./identity.mjs"
export default Plugin.define({ id: "opencode-stack.agent-identity", setup: register })
