import { Plugin } from "@opencode/plugin"
import { register } from "./guard.mjs"

export default Plugin.define({
  id: "opencode-stack.env-guard",
  setup: register,
})
