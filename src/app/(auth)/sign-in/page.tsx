"use client";

import { Suspense, useId, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { authClient, useLastLoginMethod } from "@/lib/account/auth-client";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LastUsedTag, SocialButtons } from "@/components/SocialButtons";

function SignInForm() {
  const redirectTo = useSearchParams().get("redirect") ?? "/dashboard";
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const lastMethod = useLastLoginMethod();
  const lastUsedId = useId();

  async function signInWith(
    identifier: string,
    password: string,
  ): Promise<string | null> {
    // One field, two endpoints: an "@" means it is an email, otherwise a username.
    const { error } = identifier.includes("@")
      ? await authClient.signIn.email({ email: identifier, password })
      : await authClient.signIn.username({ username: identifier, password });

    if (error) return error.message ?? "Could not sign in";
    // A full navigation, not `router.push`: the Better Auth session atom
    // (`useConvexAuth` via `ConvexBetterAuthProvider`) lags this resolving by
    // a tick, so a client-side push landed on the destination while it still
    // read signed-out -- briefly showing the 401 screen or, for `/orgs/new`,
    // crashing on an authenticated-only query. `window.location.assign` forces
    // a fresh document load, so the root layout re-derives `initialToken` from
    // the now-set session cookie before anything renders.
    window.location.assign(redirectTo);
    return null;
  }

  async function run(identifier: string, password: string) {
    setError(null);
    setPending(true);
    setError(await signInWith(identifier, password));
    setPending(false);
  }

  async function onSubmit(formData: FormData) {
    const identifier = String(formData.get("identifier") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    await run(identifier, password);
  }

  return (
    // No account roundel: a "Sign in" control beside a sign-in form is the
    // same offer twice.
    <form action={onSubmit}>
      <FieldGroup className="gap-5">
        <div className="mb-2 flex flex-col gap-3">
          <h1 className="text-3xl leading-[1.1] font-semibold tracking-[-0.02em] text-foreground">
            Welcome back
          </h1>
          <FieldDescription>
            Sign in to your Lead the Way account.
          </FieldDescription>
        </div>

        <Field>
          <FieldLabel htmlFor="identifier">Username or email</FieldLabel>
          <Input
            id="identifier"
            name="identifier"
            required
            autoComplete="username"
            placeholder="Enter your username or email"
            className="h-11 px-3"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="Enter your password"
            className="h-11 px-3"
          />
        </Field>

        <Field>
          {/* Mounted whether or not there is anything to say. A live region
              created at the moment its text arrives announces nothing, and `empty:sr-only`
              takes it out of flow while it is empty without taking it out of
              the accessibility tree, which `hidden` would. */}
          <p
            role="alert"
            aria-live="polite"
            className="text-sm text-destructive empty:sr-only"
          >
            {error}
          </p>
          <div className="relative flex flex-col">
            {lastMethod === "email" && <LastUsedTag id={lastUsedId} />}
            <Button
              type="submit"
              size="touch"
              className="w-full"
              disabled={pending}
              aria-describedby={lastMethod === "email" ? lastUsedId : undefined}
            >
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </div>
        </Field>

        <SocialButtons redirectTo={redirectTo} label="Or sign in with" />

        <FieldDescription className="text-center">
          New to Lead the Way?{" "}
          <Link
            href={`/sign-up?redirect=${encodeURIComponent(redirectTo)}`}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </FieldDescription>
      </FieldGroup>
    </form>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
