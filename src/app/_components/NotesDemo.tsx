"use client";

import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import { api } from "@convex/_generated/api";
import { userMessage } from "@/lib/errors";
import { Input, Button, ErrorText } from "@/components/ui";

/**
 * The example feature, wired to `convex/notes.ts`: one query, one mutation, one
 * action. Delete this component and that file together.
 *
 * WHAT IT DEMONSTRATES, because each of these is a house rule:
 *
 *  - `useQuery` is a SUBSCRIPTION, not a fetch. The list re-renders when the
 *    mutation commits; nothing here refetches, and there is no cache to
 *    invalidate. `undefined` means the first answer has not landed yet, and is
 *    a different state from an empty array.
 *  - `useMutation` is optimistic-capable and transactional server-side. It is
 *    awaited only to catch the failure, never to "refresh" anything.
 *  - `useAction` for the call that reaches the network. It is the one that can
 *    be slow and the one that can half-fail, so it is the only one with a busy
 *    state around it.
 *  - Every failure is rendered, in a region that was mounted before it had
 *    anything to say. `userMessage` turns a `ConvexError` into the sentence the
 *    backend wrote; it never shows a raw error to a person.
 */
export function NotesDemo() {
  const notes = useQuery(api.notes.list, {});
  const add = useMutation(api.notes.add);
  const summarize = useAction(api.notes.summarize);

  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    try {
      await add({ text: value });
      setText("");
    } catch (e) {
      setError(userMessage(e, "Could not save that note."));
    } finally {
      setBusy(false);
    }
  }

  async function runAction() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const summary = await summarize({
        prompt: (notes ?? []).map((n) => n.text).join("; "),
      });
      // An empty string is the documented "the provider was not available"
      // answer, not a failure to report -- see `convex/notes.ts`.
      if (!summary)
        setError(
          "No summary came back. Is OPENAI_API_KEY set on the deployment?",
        );
    } catch (e) {
      setError(userMessage(e, "Could not summarise those notes."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex w-full flex-col gap-4">
      <h2 className="label text-[11px] text-signal">Example: notes</h2>

      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
        <Input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Write a note"
          aria-label="Note text"
        />
        <Button
          type="submit"
          disabled={busy || text.trim() === ""}
          className="sm:w-[140px]"
        >
          Add
        </Button>
      </form>

      <ErrorText>{error}</ErrorText>

      {notes === undefined ? (
        // Held, not collapsed: a list that appears out of nowhere moves
        // everything under it the moment the subscription lands.
        <p className="text-[13px] text-muted-foreground">Loading…</p>
      ) : notes.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">
          Nothing yet. The list updates live as you add.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notes.map((note) => (
            <li
              key={note._id}
              className="rounded-[5px] border border-hairline bg-card px-3 py-2 text-[15px] text-foreground"
            >
              {note.text}
            </li>
          ))}
        </ul>
      )}

      <Button
        variant="secondary"
        onClick={runAction}
        disabled={busy || !notes?.length}
      >
        Summarise with the example action
      </Button>
    </section>
  );
}
