import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { setActiveOrgOf } from "../account/ensureProfile";
import { logEvent } from "../events";
import { insertPerson } from "./people";

/**
 * Take a seat through an invitation: the seat, the invitation answered, the
 * workspace opened, and `invite.accepted` logged. `invites.accept` and the
 * script's `team.join` both come through here, each after its own checks, so
 * a real join and a scripted one leave the same rows.
 */
export async function joinByInvite(
  ctx: MutationCtx,
  invite: Doc<"orgInvites">,
  userId: string,
  at: number,
  jobTitle = "",
): Promise<Id<"people">> {
  const person = await insertPerson(
    ctx,
    userId,
    invite.orgId,
    invite.roleId,
    at,
    jobTitle,
  );
  await ctx.db.patch(invite._id, {
    status: "accepted",
    personId: person._id,
    respondedAt: at,
  });
  await setActiveOrgOf(ctx, userId, invite.orgId);
  await logEvent(ctx, {
    orgId: invite.orgId,
    sprintId: invite.sprintId,
    type: "invite.accepted",
    at,
  });
  return person._id;
}
