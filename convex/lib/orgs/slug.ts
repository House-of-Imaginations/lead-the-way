/**
 * Turning a workspace's name into the thing that goes in a URL.
 *
 * Pure, and separate from the mutation that uses it: this is the half that can
 * be wrong quietly.
 * A slug that normalises differently on the read than on the write lets `Acme`
 * and `acme` both land, and the uniqueness check that looked correct never
 * fired.
 */

/** Room for a readable handle, and a cap so a URL cannot be a paragraph. */
export const MAX_SLUG_LENGTH = 48;

/**
 * Names that would shadow a real route.
 *
 * `/orgs/new` is a screen, so an org that slugged to `new` would be
 * unreachable, and every link to the create page would open it instead. The
 * list is the route segments that live under `/orgs/`, plus the handful of
 * words a router is likely to grow.
 */
const RESERVED = new Set([
  "new",
  "api",
  "settings",
  "join",
  "admin",
  "orgs",
  "calder-lane", // the seeded demo workspace
]);

/**
 * One spelling per name, decided before both the uniqueness read and the write.
 *
 * NFKC first, so two Unicode spellings of the same visible string cannot become
 * two different orgs -- that is a homograph waiting to be somebody's phishing
 * link, not merely an inconsistency.
 */
/**
 * A workspace name, fit to put in a header a mail client will parse.
 *
 * CONTROL CHARACTERS ARE STRIPPED, NOT TRIMMED, and the reason is not
 * tidiness. The name goes into an email Subject line in
 * `convex/lib/email/messages.ts`, and a subject cannot be HTML-escaped the way
 * the body can. Anyone can create a workspace, so a name carrying `\r\n` is a
 * one-tap attempt at header injection into mail this product sends from its own
 * domain. Resend very likely refuses it -- but that is the provider's
 * guarantee, and this is the product's.
 */
export function cleanOrgName(name: string): string {
  return name.replace(/[\u0000-\u001F\u007F]/g, " ").trim();
}

export function slugify(name: string): string {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");
}

/** Is this slug usable at all, before asking whether it is taken? */
export function slugIsAvailableShape(slug: string): boolean {
  return slug.length > 0 && !RESERVED.has(slug);
}
