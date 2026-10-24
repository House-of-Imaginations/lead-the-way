"use client";

import { Close } from "@carbon/icons-react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { noteFor, splitNoteLine } from "@/content/prototypeNotes";
import { setPrototypeNotes, usePrototypeNotes } from "@/lib/prototypeNotes";

/** R12: the current route's research note, floating at the right edge, not modal. */
export function PrototypeNotesPanel() {
  const on = usePrototypeNotes();
  const note = noteFor(usePathname());
  if (!on || !note) return null;
  return (
    <aside
      aria-label="Prototype notes"
      className="fixed inset-y-0 right-0 z-40 flex w-[360px] max-w-full flex-col gap-05 overflow-y-auto bg-layer-01 p-05 shadow-float"
    >
      <div className="flex items-start justify-between gap-05">
        <div>
          <p className="text-label-01 text-text-secondary">Prototype notes</p>
          <h2 className="text-heading-04">{note.screen}</h2>
        </div>
        <Button
          kind="ghost"
          size="sm"
          icon={Close}
          onClick={() => setPrototypeNotes(false)}
        >
          Hide notes
        </Button>
      </div>
      <dl className="flex flex-col gap-05 text-body-02">
        {note.lines.map((line) => {
          const { label, text } = splitNoteLine(line);
          return (
            <div key={line} className="flex flex-col gap-02">
              {label && <dt className="font-semibold">{label}</dt>}
              <dd>{text}</dd>
            </div>
          );
        })}
      </dl>
    </aside>
  );
}
