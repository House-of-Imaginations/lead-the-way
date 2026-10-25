"use client";

import { ArrowRight } from "@carbon/icons-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { flushSync } from "react-dom";
import {
  Button,
  InlineNotification,
  PasswordInput,
  TextInput,
} from "@/components/ui";
import type { Provider } from "@convex/lib/auth/providers";
import { authClient } from "@/lib/account/auth-client";
import { AuthAlternatives } from "./AuthAlternatives";
import { DemoAccountPicker, type DemoCast } from "./DemoAccountPicker";

// R10: one message, under the password, whatever was wrong.
const NEUTRAL = "Check your email and password and try again.";

export function LogInForm({
  providers,
  next,
  reset,
  cast,
  career = false,
}: {
  providers: Provider[];
  next: string | null;
  reset: boolean;
  /** `demo.loginCast`: empty with DEMO_MODE off, and then no picker. */
  cast: DemoCast;
  /** L and DB (`/login?track=career`): personal email, a way into the map. */
  career?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  // Task 9: one Log in button. A chosen demo person wins; typing an email clears the choice.
  const [demo, setDemo] = useState("");
  const [demoError, setDemoError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const emailRef = useRef<HTMLInputElement>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // R10 and 02b: the same answer whether or not the account exists.
  function forgot() {
    const address = emailRef.current?.value.trim() ?? "";
    if (!address) {
      setEmailError(
        career ? "Enter your email first." : "Enter your work email first.",
      );
      emailRef.current?.focus();
      return;
    }
    setEmailError(null);
    startTransition(async () => {
      await authClient.requestPasswordReset({
        email: address,
        redirectTo: "/reset-password",
      });
      setSent(true);
    });
  }

  function submit(form: FormData) {
    setError(null);
    setDemoError(null);
    if (demo) {
      startTransition(async () => {
        // The server adds the password (`/api/demo/login`); it never comes here.
        const res = await fetch("/api/demo/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: demo }),
        }).catch(() => null);
        if (!res?.ok) {
          setDemoError("We couldn't log in as that person. Try again.");
          return;
        }
        window.location.assign(next ?? "/home");
      });
      return;
    }
    const email = String(form.get("email")).trim();
    const password = String(form.get("password"));
    startTransition(async () => {
      const { error } = await authClient.signIn.email({ email, password });
      if (error) {
        // Flush so the description is on the field before focus reads it.
        flushSync(() => setError(NEUTRAL));
        document.getElementById("login-password")?.focus();
        return;
      }
      window.location.assign(next ?? "/home");
    });
  }

  return (
    <>
      <form
        noValidate
        className="flex flex-col gap-06"
        onSubmit={(e) => {
          e.preventDefault();
          submit(new FormData(e.currentTarget));
        }}
      >
        {sent && (
          <InlineNotification kind="success" title="Check your email.">
            If an account exists for that address, we sent a reset link.
          </InlineNotification>
        )}
        {reset && !sent && (
          <InlineNotification kind="success" title="Password saved.">
            Log in with your new password.
          </InlineNotification>
        )}
        {cast.length > 0 && (
          <>
            <DemoAccountPicker
              cast={cast}
              value={demo}
              onChange={setDemo}
              error={demoError ?? undefined}
            />
            <div className="flex items-center gap-05 text-label-01 text-text-secondary">
              <span className="h-px flex-1 bg-border-subtle" />
              Or
              <span className="h-px flex-1 bg-border-subtle" />
            </div>
          </>
        )}
        <TextInput
          id="login-email"
          name="email"
          type="email"
          label={career ? "Email" : "Work email"}
          autoComplete="email"
          ref={emailRef}
          error={emailError ?? undefined}
          onChange={() => setDemo("")}
        />
        <PasswordInput
          id="login-password"
          name="password"
          label="Password"
          autoComplete="current-password"
          labelAction={
            <button
              type="button"
              className="text-label-01 text-link underline hover:text-link-hover"
              onClick={forgot}
              disabled={pending}
            >
              {career ? "Forgot password?" : "Forgot your password?"}
            </button>
          }
          error={error ?? undefined}
        />
        <Button
          type="submit"
          icon={ArrowRight}
          className="w-full"
          disabled={pending}
        >
          Log in
        </Button>
      </form>
      <AuthAlternatives
        providers={providers}
        ssoLabel={career ? "Continue with IBMid" : "Log in with single sign-on"}
        emailId="login-email"
        next={next}
      />
      {career ? (
        <p className="text-center text-body-02">
          New here?{" "}
          <Link
            href="/careers/map/new"
            className="text-link underline hover:text-link-hover"
          >
            Start my Pivot Map
          </Link>
        </p>
      ) : (
        <p className="text-center text-body-02">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="text-link underline hover:text-link-hover"
          >
            Sign up
          </Link>
        </p>
      )}
    </>
  );
}
