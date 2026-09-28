"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth, useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import { api } from "@convex/_generated/api";
import { userMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PageBody } from "@/app/(app)/_components/page-body";
import { Hint } from "@/components/kit/Hint";

/**
 * Create a workspace. The destination of the gate on `/`, and of the switcher's
 * last entry.
 *
 * One field, because one field is all the backend needs: the web address is
 * derived from the name rather than asked for. A slug field would be a second
 * thing to get wrong, in a format most people have never had to think about,
 * for a string they will never type again.
 *
 * THE ROUTE IS `/orgs/new`, WHICH IS WHY `new` IS A RESERVED SLUG. Without the
 * denylist in `convex/lib/orgs/slug.ts` a workspace called "New" would own this
 * URL and nobody could ever reach this screen again.
 */
export default function NewOrgPage() {
  const router = useRouter();
  // Signed out, this page never renders past the `(app)` layout's auth gate --
  // the "skip" is defense in depth against that gate settling a tick late,
  // not the normal path.
  const { isAuthenticated } = useConvexAuth();
  const orgs = useQuery(api.orgs.mine, isAuthenticated ? {} : "skip");
  const create = useMutation(api.orgs.create);
  const isFirst = orgs?.length === 0;

  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) return;

    setBusy(true);
    setError(null);
    try {
      await create({ name: trimmed });
      // `replace`, not `push`: this screen has done its job and going back to
      // it would offer to create the same workspace a second time. The new
      // org is already active because `create` sets it.
      router.replace("/dashboard?created=1");
    } catch (e) {
      setError(userMessage(e, "Could not create that workspace."));
      setBusy(false);
    }
    // Deliberately no `finally`: on success the route is changing, and
    // re-enabling the button during that would let a second submit through.
  }

  return (
    <PageBody>
      <form
        onSubmit={submit}
        className="flex w-full max-w-md flex-col gap-6 rounded-md border border-hairline bg-card p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <h1 className="display text-2xl text-foreground">
              {isFirst ? "Create your workspace" : "Name your workspace"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isFirst
                ? "Name the manufacturer or dealer group you work for."
                : "You can invite people once it exists, and change the name whenever you like."}
            </p>
          </div>
          <Hint topic="organization" />
        </div>

        <Field className="gap-2">
          <FieldLabel htmlFor="org-name">Workspace name</FieldLabel>
          <Input
            id="org-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Motors"
            autoFocus
            maxLength={60}
            disabled={busy}
          />
          {/* Always mounted, so a refusal is announced rather than appearing. */}
          <p role="alert" className="text-sm text-destructive empty:hidden">
            {error ?? ""}
          </p>
        </Field>

        <div className="flex justify-end">
          <Button type="submit" disabled={busy || !name.trim()}>
            {busy ? "Creating…" : "Create workspace"}
          </Button>
        </div>
      </form>
    </PageBody>
  );
}
