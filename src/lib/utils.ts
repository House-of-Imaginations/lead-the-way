import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * The class-list joiner every component under `src/components/ui` calls.
 *
 * Two jobs, and the second is the one that matters here. `clsx` flattens
 * conditionals and arrays into a string; `twMerge` then resolves Tailwind
 * conflicts by LAST-WINS rather than by cascade order, so a caller's
 * `className="h-11"` beats a component's built-in `h-8` instead of the two
 * both landing in the class list and stylesheet order deciding.
 *
 * That is what makes a shadcn component overridable at the call site at all,
 * and this project leans on it: `DESIGN.md` puts controls at 32px but requires
 * 44px on anything a technician taps, so the touch variants are expressed as
 * overrides rather than as forks of each component.
 *
 * It does NOT know about this repo's own classes. `.label`, `.data`, `.display`
 * and `.charged` are plain rules in `globals.css`, not Tailwind utilities, so
 * `twMerge` passes them through untouched and never treats two of them as a
 * conflicting pair. Do not rename them into a Tailwind-shaped prefix.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
