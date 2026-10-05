/**
 * The work project's limits (12). Pure, because `src` imports it through the
 * eslint allowlist: no database code, no imports. The form checks with these
 * before it uploads or saves; `convex/projects.ts` checks again, because the
 * browser can be skipped.
 */
export const SCREENSHOT_TYPES = ["image/png", "image/jpeg"] as const;
export const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
export const PROJECT_LIMITS = { title: 120, text: 2000, headline: 160 } as const;
export const RESULT_TYPES = [
  "Time saved",
  "Quality improvement",
  "Reduced repetitive work",
  "Other",
] as const;

/** Why a file can't be the screenshot, or null. Called on the File in the browser and on the `_storage` row in `setScreenshot`. */
export function screenshotProblem(contentType: string | undefined, size: number) {
  if (!(SCREENSHOT_TYPES as readonly string[]).includes(contentType ?? "")) {
    return { code: "SCREENSHOT_TYPE", message: "Upload a PNG or JPG." } as const;
  }
  if (size > MAX_SCREENSHOT_BYTES) {
    return {
      code: "SCREENSHOT_SIZE",
      message: "Upload a file up to 5 MB.",
    } as const;
  }
  return null;
}
