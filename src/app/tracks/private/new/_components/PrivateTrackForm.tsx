"use client";

import { ArrowRight } from "@carbon/icons-react";
import { useMutation } from "convex/react";
import { useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import { Button, Checkbox, TextInput } from "@/components/ui";
import { userMessage } from "@/lib/errors";

/**
 * MS3's form. Convex refuses a work address (X3) and says how to fix it; the
 * message shows on the field. ponytail: no draft token yet, the draft cookie
 * is P13a's; pass it to `startPrivate` once that lands.
 */
export function PrivateTrackForm() {
  const startPrivate = useMutation(api.careers.tracks.startPrivate);
  const [email, setEmail] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!agreed || pending) return;
    setError(null);
    setPending(true);
    try {
      await startPrivate({ contactEmail: email });
      // A full load: the shell gains the second track, and /home shows both.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load, above
      window.location.assign("/home");
    } catch (e) {
      setError(userMessage(e, "The track wasn't started. Try again."));
      setPending(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-06"
      noValidate
      onSubmit={(e) => void onSubmit(e)}
    >
      <TextInput
        id="track-email"
        label="Email for this track"
        helper="A personal email keeps reminders out of your work inbox."
        error={error ?? undefined}
        type="email"
        autoComplete="email"
        placeholder="name@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <div className="bg-layer-01 p-05">
        <Checkbox
          label="Keep this track private from my workspace."
          helper="You can delete it any time from Privacy by track."
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
        />
      </div>
      <div className="flex flex-col gap-03">
        <Button
          type="submit"
          icon={ArrowRight}
          disabled={!agreed || pending}
          aria-describedby={agreed ? undefined : "track-reason"}
          className="w-full"
        >
          Start my map
        </Button>
        {!agreed && (
          <p
            id="track-reason"
            className="text-center text-label-01 text-text-secondary"
          >
            Tick the box above to continue.
          </p>
        )}
      </div>
    </form>
  );
}
