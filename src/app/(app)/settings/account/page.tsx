"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { LogOut } from "lucide-react";
import { HELP } from "@/lib/help";
import { authClient } from "@/lib/account/auth-client";
import { userMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import {
  ConfirmDialog,
  DangerButton,
  DangerItem,
  SettingsHeading,
  SettingsSection,
} from "@/components/settings";

/** Ending a session, and ending the account. */
export default function AccountSettingsPage() {
  const router = useRouter();
  const deleteAccount = useMutation(api.account.deleteAccount);

  /**
   * `authClient.signOut()` ends the auth session, and that is all this browser
   * holds today. Anything else stored per person on the device later is cleared
   * HERE, BEFORE the network call: a browser holding nothing is a milder
   * failure than a shared laptop handing the next person the last one's state.
   */
  async function signOut() {
    await authClient.signOut();
    router.push("/");
  }

  return (
    <>
      <SettingsHeading
        title="Account"
        description="Sign out of this device, or delete your account."
      />

      <SettingsSection title="Sign out" description={HELP.signout.body[0]}>
        <div>
          <Button variant="outline" onClick={() => void signOut()}>
            <LogOut />
            Sign out
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Danger zone"
        description="Deleting your account signs you out everywhere."
      >
        <DangerItem
          title="Delete account"
          description={HELP.deletion.body[1]}
          action={
            <ConfirmDialog
              trigger={<DangerButton>Delete account</DangerButton>}
              title="Delete your account?"
              description={HELP.deletion.body.map((line) => (
                <p key={line}>{line}</p>
              ))}
              cancelLabel="Keep account"
              confirmLabel="Delete account"
              onConfirm={async () => {
                try {
                  await deleteAccount({});
                } catch (e) {
                  throw new Error(
                    userMessage(
                      e,
                      "Could not delete the account. Please try again.",
                    ),
                  );
                }
                await authClient.signOut();
                router.push("/");
              }}
            />
          }
        />
      </SettingsSection>
    </>
  );
}
