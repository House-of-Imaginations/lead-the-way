import type { Metadata } from "next";
import { api } from "@convex/_generated/api";
import { ConvexClientProvider } from "@/app/_components/ConvexClientProvider";
import { fetchAuthQuery, getToken } from "@/lib/account/auth-server";
import { currentHour, getProfile, openOrHome } from "@/lib/account/queries";
import { errorCode } from "@/lib/errors";
import { initialsOf } from "@/lib/initials";
import { JoinInvalid, JoinView } from "../_components/JoinView";

export const metadata: Metadata = { title: "Invitation · Lead the Way" };

/**
 * 09 (Ruling 18), public: the proxy lets /join through. Signed in, it reads
 * `invites.preview` and shows what the link will do; signed out, or with a
 * cookie Convex no longer accepts, `invites.publicPreview`.
 */
export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const [{ token }, authToken] = await Promise.all([params, getToken()]);
  const hour = currentHour();
  const [preview, profile] = authToken
    ? await Promise.all([
        openOrHome(() =>
          fetchAuthQuery(api.invites.preview, { token, hour }),
        ).catch((error: unknown) => {
          if (errorCode(error) === "NOT_SIGNED_IN") return undefined;
          throw error;
        }),
        getProfile(),
      ])
    : [undefined, null];

  if (preview !== undefined) {
    const name = profile?.displayName ?? "";
    const you = name ? { name, initials: initialsOf(name) } : null;
    return (
      <ConvexClientProvider initialToken={authToken}>
        {preview ? (
          <JoinView
            token={token}
            orgName={preview.orgName}
            invitedBy={preview.invitedBy}
            join={preview.join}
            state={preview.acceptState}
            you={you}
          />
        ) : (
          <JoinInvalid you={you} />
        )}
      </ConvexClientProvider>
    );
  }

  const invite = await openOrHome(() =>
    fetchAuthQuery(api.invites.publicPreview, { token, hour }),
  );
  if (!invite) return <JoinInvalid you={null} />;
  return (
    <ConvexClientProvider>
      <JoinView
        token={token}
        orgName={invite.orgName}
        invitedBy={invite.invitedBy}
        join={invite.join}
        state="SIGNED_OUT"
        you={null}
      />
    </ConvexClientProvider>
  );
}
