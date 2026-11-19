import { Plugin } from "@opencode/plugin"
import { register } from "./guard.mjs"

export default Plugin.define({ id: "opencode-stack.v2-pilot-boundary", setup: register })
