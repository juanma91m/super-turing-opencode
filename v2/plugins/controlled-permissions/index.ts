import { Plugin } from "@opencode/plugin"
import { register } from "./policy.mjs"
export default Plugin.define({ id: "opencode-stack.controlled-permissions", setup: register })
