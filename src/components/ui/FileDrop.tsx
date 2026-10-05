"use client";

import { Upload } from "@carbon/icons-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "./Button";

export type FileDropProps = {
  id: string;
  /** The zone's words, which also name the file input. */
  label: string;
  helper: string;
  /** MIME types the picker offers. The caller checks the file again: a drop or a script skips the picker. */
  accept: readonly string[];
  onFile: (file: File) => void;
  error?: string | null;
  busy?: boolean;
  /** The file already chosen, shown in place of the zone with a Remove button. */
  current?: { url: string; alt: string } | null;
  onRemove?: () => void;
};

/** A dashed drop zone over a visually hidden file input: drag, click, or Tab then Space. */
export function FileDrop({
  id,
  label,
  helper,
  accept,
  onFile,
  error,
  busy,
  current,
  onRemove,
}: FileDropProps) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const removeRef = useRef<HTMLButtonElement>(null);
  const had = useRef(Boolean(current));
  const refocus = useRef(false);
  const has = Boolean(current);
  // The focused control unmounts when the zone swaps, so hand focus to its successor once it can take it.
  useEffect(() => {
    if (has !== had.current) {
      had.current = has;
      refocus.current = true;
    }
    const next = has ? removeRef.current : inputRef.current;
    if (refocus.current && next && !next.disabled) {
      refocus.current = false;
      next.focus();
    }
  }, [has, busy]);
  const note = error ? (
    <span id={`${id}-error`} role="alert" className="ltw-err">
      {error}
    </span>
  ) : (
    <span id={`${id}-helper`} className="ltw-help">
      {helper}
    </span>
  );

  if (current) {
    return (
      <div className="flex flex-col items-start gap-03">
        {/* eslint-disable-next-line @next/next/no-img-element -- a signed storage URL, not a static asset */}
        <img
          src={current.url}
          alt={current.alt}
          className="max-h-[200px] w-auto border border-border-subtle"
        />
        <Button
          ref={removeRef}
          kind="ghost"
          size="sm"
          className="ltw-fd-remove"
          disabled={busy}
          onClick={onRemove}
        >
          Remove file
        </Button>
        {note}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-02">
      <label
        className="ltw-fd"
        data-over={(over && !busy) || undefined}
        aria-busy={busy || undefined}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={(e) => {
          // Crossing onto the icon or the text also fires dragleave on the label.
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setOver(false);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const file = e.dataTransfer.files[0];
          if (file && !busy) onFile(file);
        }}
      >
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept.join(",")}
          disabled={busy}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : `${id}-helper`}
          onChange={(e) => {
            const file = e.target.files?.[0];
            // Cleared, so choosing the same file again still fires.
            e.target.value = "";
            if (file) onFile(file);
          }}
        />
        <Upload className="ltw-i" aria-hidden="true" />
        <span>{busy ? "Uploading" : label}</span>
      </label>
      {note}
    </div>
  );
}
