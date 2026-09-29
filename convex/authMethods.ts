import { literals } from "convex-helpers/validators";
import { v } from "convex/values";
import { PROVIDERS, providerCredentials } from "./lib/auth/providers";
import { publicQuery } from "./lib/customFunctions";

/** Which social sign-in buttons to show. Signed out on purpose: the log-in page asks. */
export const enabled = publicQuery({
  args: {},
  returns: v.array(literals(...PROVIDERS)),
  handler: async () => {
    const on = providerCredentials();
    return PROVIDERS.filter((provider) => provider in on);
  },
});
