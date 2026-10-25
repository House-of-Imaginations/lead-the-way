"use client";

import { ArrowRight } from "@carbon/icons-react";
import { useState, type FormEvent } from "react";
import { Button, Checkbox, TextInput } from "@/components/ui";
import { startPrivateTrack } from "@/lib/careers/actions";

/**
 * MS3's form. The server action claims any Pivot Map draft from its cookie;
 * Convex refuses a work address (X3) and says how to fix it, on the field.
 * Either way the track lands on /home, as a career sign-up does: a claimed
 * map has no view of its own until P13b.
 */
export function PrivateTrackForm() {
  const [email, setEmail] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!agreed || pending) return;
    setError(null);
    setPending(true);
    const result = await startPrivateTrack(email);
    if (result) {
      setError(result.error);
      setPending(false);
      return;
    }
    // A full load: the shell gains the second track, and /home shows both.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load, above
    window.location.assign("/home");
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
