"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/account/auth-client";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SocialButtons } from "@/components/SocialButtons";

function SignUpForm() {
  // The same `?redirect=` /sign-in honours, for the same reason: somebody who
  // hits the account wall halfway through the funnel and creates an account
  // instead of signing in must land back where they were, not at the start.
  const redirectTo = useSearchParams().get("redirect") ?? "/dashboard";
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setError(null);
    setPending(true);

    const { error } = await authClient.signUp.email({
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      username: String(formData.get("username") ?? ""),
      password: String(formData.get("password") ?? ""),
      // Where the confirmation link lands. An invitee confirming their address
      // goes back to the invitation rather than to the start.
      callbackURL: redirectTo,
    });

    setPending(false);
    if (error) {
      setError(error.message ?? "Could not create the account");
      return;
    }
    // Full navigation, not `router.push` -- see the same comment on /sign-in.
    window.location.assign(redirectTo);
  }

  return (
    <form action={onSubmit}>
      <FieldGroup className="gap-5">
        <div className="flex flex-col gap-1.5">
          <h1 className="display text-[30px] text-foreground">
            Create an account
          </h1>
          <FieldDescription>
            Four details, and you are in a workspace.
          </FieldDescription>
        </div>

        <Field>
          <FieldLabel htmlFor="name">
            Display name
            <span aria-hidden="true" className="text-destructive">
              *
            </span>
          </FieldLabel>
          <Input
            id="name"
            name="name"
            required
            autoComplete="name"
            placeholder="Enter your display name"
            className="h-12 rounded-lg px-3.5"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="username">
            Username
            <span aria-hidden="true" className="text-destructive">
              *
            </span>
          </FieldLabel>
          <Input
            id="username"
            name="username"
            required
            autoComplete="username"
            placeholder="Enter your username"
            className="h-12 rounded-lg px-3.5"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="email">
            Email
            <span aria-hidden="true" className="text-destructive">
              *
            </span>
          </FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="Enter your email"
            className="h-12 rounded-lg px-3.5"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="password">
            Password
            <span aria-hidden="true" className="text-destructive">
              *
            </span>
          </FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Create a password"
            className="h-12 rounded-lg px-3.5"
          />
          <FieldDescription>At least 8 characters.</FieldDescription>
        </Field>

        <Field>
          {/* See /sign-in: the region is mounted empty on purpose. */}
          <p
            role="alert"
            aria-live="polite"
            className="text-sm text-destructive empty:sr-only"
          >
            {error}
          </p>
          <Button
            type="submit"
            size="touch"
            className="w-full"
            disabled={pending}
          >
            {pending ? "Creating…" : "Sign up"}
          </Button>
        </Field>

        <SocialButtons redirectTo={redirectTo} label="Or sign up with" />

        <FieldDescription className="text-center">
          Already have an account?{" "}
          <Link href={`/sign-in?redirect=${encodeURIComponent(redirectTo)}`}>
            Sign in
          </Link>
        </FieldDescription>
      </FieldGroup>
    </form>
  );
}

// `useSearchParams` client-side renders the tree up to the nearest Suspense
// boundary, so it gets one of its own rather than taking the whole route with
// it. Same shape as /sign-in.
export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}
