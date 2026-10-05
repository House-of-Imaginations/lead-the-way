"use client";

import { Upload } from "@carbon/icons-react";
import { useState } from "react";
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
  const note = error ? (
    <span id={`${id}-error`} className="ltw-err">
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
        <Button kind="ghost" size="sm" disabled={busy} onClick={onRemove}>
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
        data-over={over || undefined}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const file = e.dataTransfer.files[0];
          if (file && !busy) onFile(file);
        }}
      >
        <input
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
        <span>{label}</span>
      </label>
      {note}
    </div>
  );
}
