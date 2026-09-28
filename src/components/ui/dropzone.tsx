import { useId, useRef, useState, type ReactNode } from "react";
import { UploadIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Does `file` match an `accept` list like ".pdf,image/*"? Drops skip the picker's filter, so check here. */
export function accepts(file: File, accept?: string) {
  if (!accept) return true;
  const name = file.name.toLowerCase();
  return accept.split(",").some((raw) => {
    const token = raw.trim().toLowerCase();
    if (token.startsWith(".")) return name.endsWith(token);
    if (token.endsWith("/*")) return file.type.startsWith(token.slice(0, -1));
    return file.type === token;
  });
}

/**
 * Drag-and-drop file target that also opens the picker on click or keyboard.
 * ponytail: native drag events, no react-dropzone; add it if we need folder drops.
 */
export function Dropzone({
  onFiles,
  accept,
  multiple = false,
  disabled = false,
  files,
  label = "Drop files here or click to browse",
  hint,
  className,
  id,
}: {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  /** Chosen files to list under the target, when the caller holds them. */
  files?: readonly File[];
  label?: ReactNode;
  hint?: ReactNode;
  className?: string;
  id?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [rejected, setRejected] = useState(0);
  const hintId = useId();

  function take(list: FileList | null) {
    const all = Array.from(list ?? []);
    const ok = all.filter((f) => accepts(f, accept));
    setRejected(all.length - ok.length);
    const picked = multiple ? ok : ok.slice(0, 1);
    if (picked.length) onFiles(picked);
  }

  return (
    <div
      className={cn("flex flex-col gap-2", className)}
      onDragOver={(e) => {
        // Always prevented, even disabled: otherwise a drop opens the file
        // in the tab instead of doing nothing.
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={(e) => {
        // A leave onto a child (e.g. the button) is not a leave of the zone.
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled) take(e.dataTransfer.files);
      }}
    >
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-describedby={hint ? hintId : undefined}
        onClick={() => input.current?.click()}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-hairline bg-card px-6 py-8 text-center transition-colors",
          "hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:text-muted-foreground disabled:hover:bg-card",
          over && "border-solid border-signal bg-muted",
        )}
      >
        <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <UploadIcon className="size-4" aria-hidden />
        </span>
        <span className="text-sm font-medium">{label}</span>
        {hint && (
          <span id={hintId} className="text-xs text-muted-foreground">
            {hint}
          </span>
        )}
      </button>
      <input
        ref={input}
        type="file"
        className="sr-only"
        tabIndex={-1}
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(e) => {
          take(e.target.files);
          e.target.value = "";
        }}
      />
      {rejected > 0 && (
        <p role="alert" className="text-sm text-destructive">
          {rejected === 1
            ? "One file was skipped because its type is not accepted."
            : `${rejected} files were skipped because their type is not accepted.`}
        </p>
      )}
      {files && files.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
          {files.map((f) => (
            <li key={`${f.name}-${f.size}`} className="truncate">
              {f.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
