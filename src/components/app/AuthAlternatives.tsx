"use client";

import { Enterprise, Login } from "@carbon/icons-react";
import { useRef, useState } from "react";
import { Button, Modal } from "@/components/ui";
import type { Provider } from "@convex/lib/auth/providers";
import { authClient } from "@/lib/account/auth-client";
import { withParams } from "@/lib/url";

const NAMES: Record<Provider, string> = {
  google: "Google",
  github: "GitHub",
  discord: "Discord",
};

type AuthAlternativesProps = {
  /** From `authMethods.enabled`: only providers with both env halves set (R9). */
  providers: Provider[];
  ssoLabel: "Sign up with single sign-on" | "Log in with single sign-on";
  /** "Use email" in the SSO dialog focuses this field. */
  emailId: string;
  next: string | null;
};

export function AuthAlternatives({
  providers,
  ssoLabel,
  emailId,
  next,
}: AuthAlternativesProps) {
  const [open, setOpen] = useState(false);
  const useEmail = useRef(false);
  return (
    <>
      <div className="flex items-center gap-05 text-label-01 text-text-secondary">
        <span className="h-px flex-1 bg-border-subtle" />
        Or continue with
        <span className="h-px flex-1 bg-border-subtle" />
      </div>
      <div className="flex flex-col gap-03">
        {providers.map((provider) => (
          <Button
            key={provider}
            kind="sso"
            icon={Login}
            className="w-full"
            onClick={() =>
              void authClient.signIn.social({
                provider,
                callbackURL: next ?? "/home",
                // R8, Ruling 19: a first OAuth sign-in accepts the terms, then
                // gets a workspace, or goes back to the join link it came from.
                newUserCallbackURL: next
                  ? withParams("/setup/start", "", { next })
                  : "/setup/start",
                // ponytail: a failed OAuth round trip lands back on log in without a message.
                errorCallbackURL: "/login",
              })
            }
          >
            Continue with {NAMES[provider]}
          </Button>
        ))}
        {/* R9: single sign-on is always the simulated dialog (spec 7.1). */}
        <Modal
          trigger={
            <Button kind="sso" icon={Enterprise} className="w-full">
              {ssoLabel}
            </Button>
          }
          open={open}
          onOpenChange={setOpen}
          label="Single sign-on"
          title="Single sign-on isn't set up"
          description="Single sign-on is not set up for this demo workspace. Use your work email and password instead."
          primaryText="Use email"
          onPrimary={() => {
            useEmail.current = true;
            setOpen(false);
          }}
          onCloseAutoFocus={(e) => {
            if (!useEmail.current) return;
            useEmail.current = false;
            e.preventDefault();
            document.getElementById(emailId)?.focus();
          }}
        />
      </div>
    </>
  );
}
