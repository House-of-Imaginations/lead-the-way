import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // `src` may import only pure modules from `convex/lib`. A module that also
    // holds database helpers pulls server code, and whatever it imports, into
    // the client bundle. `import type` is erased, so types pass.
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@convex/lib/**",
                "!@convex/lib/agreementLimits",
                "!@convex/lib/careers",
                "@convex/lib/careers/*",
                "!@convex/lib/careers/catalog",
                "!@convex/lib/demo",
                "@convex/lib/demo/*",
                "!@convex/lib/demo/careerSchedule",
                "!@convex/lib/demo/schedule",
                "!@convex/lib/initials",
                "!@convex/lib/inviteRules",
                "!@convex/lib/orgs",
                "@convex/lib/orgs/*",
                "!@convex/lib/orgs/permissions",
                "!@convex/lib/pathwayModules",
                "!@convex/lib/profileFields",
                "!@convex/lib/projectLimits",
                "!@convex/lib/setupOptions",
                "!@convex/lib/setupSteps",
                "!@convex/lib/sprintTime",
              ],
              allowTypeImports: true,
              message:
                "src imports only pure convex/lib modules (constants and pure functions, no database helpers). Move the value into a pure module and add it to this allowlist, or use `import type`.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Design reference bundle, not app code.
    "docs/**",
  ]),
]);

export default eslintConfig;
