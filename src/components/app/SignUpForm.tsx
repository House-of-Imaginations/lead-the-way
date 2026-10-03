"use client";

import { ArrowRight } from "@carbon/icons-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { flushSync } from "react-dom";
import { Button, Checkbox, PasswordInput, TextInput } from "@/components/ui";
import type { Provider } from "@convex/lib/auth/providers";
import { authClient } from "@/lib/account/auth-client";
import { startAccount } from "@/lib/account/start";
import { withParams } from "@/lib/url";
import { AuthAlternatives } from "./AuthAlternatives";

const DEMO_REFUSAL =
  "Demo accounts are made by the seed. Use the persona switch.";

type Errors = Partial<Record<"name" | "email" | "password" | "form", string>>;

/** Better Auth's sign-up refusals, as a fix the person can make. */
function signUpErrors(error: {
  code?: string;
  status: number;
  message?: string;
}): Errors {
  switch (error.code) {
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return { email: "An account already uses this email. Log in instead." };
    case "INVALID_EMAIL":
      return { email: "Enter an email address like name@company.com." };
    case "PASSWORD_TOO_SHORT":
      return { password: "Use at least 12 characters." };
    case "PASSWORD_TOO_LONG":
      return { password: "Use 128 characters or fewer." };
  }
  // The demo address refusal in convex/auth.ts is the only 403 with its own sentence.
  return {
    form:
      error.status === 403 && error.message === DEMO_REFUSAL
        ? DEMO_REFUSAL
        : "We couldn't create your account. Try again.",
  };
}

/** Focus the first invalid field so its description is read. False if none. */
function focusFirst(errors: Errors) {
  const first = (["name", "email", "password"] as const).find((k) => errors[k]);
  if (first) document.getElementById(`signup-${first}`)?.focus();
  return first !== undefined;
}

export function SignUpForm({
  providers,
  invite,
  email,
}: {
  providers: Provider[];
  /** The join link's token (`/signup?invite=`): sign-up goes back to it (Ruling 19). */
  invite?: string;
  /** The invitation's pinned address, shown locked (Ruling 2). */
  email?: string;
}) {
  const next = invite ? `/join/${encodeURIComponent(invite)}` : null;
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [pending, startTransition] = useTransition();
  // signUp worked but startAccount failed: retry must not sign up twice,
  // unless the email changed.
  const signedUpAs = useRef<string | null>(null);

  function submit(form: FormData) {
    const name = String(form.get("name")).trim();
    const email = String(form.get("email")).trim();
    const password = String(form.get("password"));
    const found: Errors = {};
    if (!name) found.name = "Enter your full name.";
    if (!email) found.email = "Enter your work email.";
    if (password.length < 12) found.password = "Use at least 12 characters.";
    flushSync(() => setErrors(found));
    if (focusFirst(found)) return;

    startTransition(async () => {
      if (signedUpAs.current !== email) {
        const { error } = await authClient.signUp.email({
          name,
          email,
          password,
        });
        if (error) {
          const found = signUpErrors(error);
          flushSync(() => setErrors(found));
          focusFirst(found);
          return;
        }
        signedUpAs.current = email;
      }
      const started = await startAccount(true, invite);
      if ("error" in started) {
        setErrors({ form: started.error });
        return;
      }
      // A full load: the next layout mounts Convex with the new session.
      window.location.assign(started.next);
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
        <TextInput
          id="signup-name"
          name="name"
          label="Full name"
          autoComplete="name"
          error={errors.name}
        />
        <TextInput
          id="signup-email"
          name="email"
          type="email"
          label="Work email"
          autoComplete="email"
          readOnly={email !== undefined}
          defaultValue={email}
          helper={
            email
              ? "Your invitation is for this address."
              : "Use your work address so your team can find you."
          }
          error={errors.email}
        />
        <PasswordInput
          id="signup-password"
          name="password"
          label="Password"
          autoComplete="new-password"
          helper="At least 12 characters. A short phrase works well."
          error={errors.password}
        />
        {/* Ruling 9: plain text; no terms or privacy page exists to link to. */}
        <Checkbox
          label="I agree to the terms of use and privacy notice."
          checked={agreed}
          onChange={(e) => setAgreed(e.currentTarget.checked)}
        />
        <div className="flex flex-col gap-05">
          <Button
            type="submit"
            icon={ArrowRight}
            className="w-full"
            disabled={!agreed || pending}
          >
            Create account
          </Button>
          {errors.form && (
            <p role="alert" className="text-label-01 text-support-error">
              {errors.form}
            </p>
          )}
        </div>
      </form>
      <AuthAlternatives
        providers={providers}
        ssoLabel="Sign up with single sign-on"
        emailId="signup-email"
        next={next}
      />
      <p className="text-center text-body-02">
        Already have an account?{" "}
        <Link
          href={next ? withParams("/login", "", { next }) : "/login"}
          className="text-link underline hover:text-link-hover"
        >
          Log in
        </Link>
      </p>
    </>
  );
}
