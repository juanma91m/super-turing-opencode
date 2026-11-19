import { Plugin } from "@opencode/plugin"
import { register } from "./guard.mjs"
export default Plugin.define({ id: "opencode-stack.workshop-boundary", setup: register })
