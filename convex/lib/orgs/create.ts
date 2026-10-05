import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { setActiveOrgOf } from "../account/ensureProfile";
import { throwUserError } from "../errors";
import { MIN_THRESHOLD } from "../privacy";
import { assertCanCreate } from "./membership";
import { insertPerson, isDemoAccount } from "./people";
import type { Permission } from "./permissions";
import {
  MAX_SLUG_LENGTH,
  cleanOrgName,
  slugIsAvailableShape,
  slugify,
} from "./slug";

export const MAX_ORG_NAME = 60;

/**
 * The one starter role besides the owner. Employee holds nothing: everything
 * an employee does is their own rows, which need a seat and no permission.
 * An ordinary custom row, renamed or deleted like any other.
 */
const DEFAULT_ROLES: readonly { name: string; permissions: Permission[] }[] = [
  { name: "Employee", permissions: [] },
];

async function slugTaken(ctx: MutationCtx, slug: string) {
  const clash = await ctx.db
    .query("orgs")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
  return clash !== null;
}

/**
 * `base`, else `base-2` to `base-50`, else `base-` and 6 random characters. For names the person didn't choose
 * ("Bec's workspace"), where a clash shouldn't stop sign-up.
 * ponytail: 50 probes then 3 random tries (36^6 slugs each); a real counter if one name ever crowds that.
 */
async function freeSlug(ctx: MutationCtx, base: string): Promise<string> {
  if (!(await slugTaken(ctx, base))) return base;
  for (let n = 2; n <= 50; n++) {
    const slug = `${base.slice(0, MAX_SLUG_LENGTH - 3).replace(/-+$/, "")}-${n}`;
    if (!(await slugTaken(ctx, slug))) return slug;
  }
  for (let i = 0; i < 3; i++) {
    const rand = Math.random().toString(36).slice(2, 8).padEnd(6, "0");
    const slug = `${base.slice(0, MAX_SLUG_LENGTH - 7).replace(/-+$/, "")}-${rand}`;
    if (!(await slugTaken(ctx, slug))) return slug;
  }
  throwUserError("SLUG_TAKEN", "A workspace with that name already exists.");
}

/**
 * Make a workspace and become its owner, in one transaction: the org, the
 * owner role, the seat, the starter roles and the team (unsaved, so the
 * manager's home is `/setup/team`). Opens it for this account. All of it
 * commits together or not at all, so an org never exists without its owner.
 *
 * THE UNIQUENESS CHECK IS NOT A RACE. The `by_slug` reads are in this
 * transaction's read set, so a second creation of the same slug conflicts,
 * retries and sees the row that won.
 */
export async function createWorkspace(
  ctx: MutationCtx,
  userId: string,
  name: string,
  { suffix = false }: { suffix?: boolean } = {},
): Promise<{ orgId: Id<"orgs">; slug: string }> {
  // Every tester shares the demo accounts, and a reset clears only the demo
  // workspace, so a demo persona's workspace would be anybody's and forever.
  if (await isDemoAccount(ctx, userId)) {
    throwUserError(
      "DEMO_ACCOUNT_CREATE",
      "Demo accounts can't make a workspace. If you were invited, open your invitation link.",
    );
  }
  const trimmed = cleanOrgName(name);
  if (!trimmed)
    throwUserError("ORG_NAME_REQUIRED", "A workspace needs a name.");
  if (trimmed.length > MAX_ORG_NAME) {
    throwUserError(
      "ORG_NAME_REQUIRED",
      `A workspace name can be at most ${MAX_ORG_NAME} characters.`,
    );
  }
  const base = slugify(trimmed);
  if (!slugIsAvailableShape(base)) {
    throwUserError(
      "SLUG_TAKEN",
      "That name cannot be used as a web address. Try another.",
    );
  }
  let slug = base;
  if (suffix) slug = await freeSlug(ctx, base);
  else if (await slugTaken(ctx, base)) {
    throwUserError("SLUG_TAKEN", "A workspace with that name already exists.");
  }
  // Creating is the other door into a workspace, and holds the same ceiling
  // accepting an invitation does.
  await assertCanCreate(ctx, userId);

  const now = Date.now();
  const orgId = await ctx.db.insert("orgs", {
    name: trimmed,
    slug,
    privacyThreshold: MIN_THRESHOLD,
    isDemo: false,
    createdAt: now,
  });
  const ownerRoleId = await ctx.db.insert("orgRoles", {
    orgId,
    kind: "owner",
    name: "Manager",
    createdAt: now,
  });
  await insertPerson(ctx, userId, orgId, ownerRoleId, now);
  await setActiveOrgOf(ctx, userId, orgId);
  // Seeded, because an invitation grants a role and the owner role cannot be
  // invited into: without it a new owner had nothing to invite anybody as.
  for (const role of DEFAULT_ROLES) {
    await ctx.db.insert("orgRoles", {
      orgId,
      kind: "custom",
      name: role.name,
      permissions: [...role.permissions],
      createdAt: now,
    });
  }
  // One team per workspace (spec 4.2). 03 fills it in and sets `savedAt`.
  await ctx.db.insert("teams", {
    orgId,
    name: "Your team",
    challenges: [],
    createdAt: now,
  });
  return { orgId, slug };
}
