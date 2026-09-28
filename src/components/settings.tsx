import { useState, type ReactNode, type RefObject } from "react";
import { Trash2 } from "lucide-react";
import { AVATAR_TYPES } from "@convex/lib/account/avatar";
import { initialsFor } from "@/lib/account/avatar";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/**
 * The pieces every settings screen is built from -- the account's three pages
 * and a workspace's -- so they all read as one product.
 *
 * The layout is a stack of rows: what a section is on the left, its controls on
 * the right, a rule between rows. Below `md` the two halves stack. Each form
 * saves on its own, so a failure is reported beside the button that caused it
 * rather than in one region at the top of a long page.
 *
 * No `"use client"`: every importer is already a client page, and the
 * directive would make Next treat these callback props as a server boundary.
 */

/** The top of a settings screen. */
export function SettingsHeading({
  title,
  description,
}: {
  title: ReactNode;
  description: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-hairline pb-6">
      <h1 className="display text-[32px] leading-[1.1] text-foreground">
        {title}
      </h1>
      <p className="text-[15px] leading-snug text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

/** One row: what it is on the left, the controls on the right. */
export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-4 border-b border-hairline pb-8 last:border-b-0 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-10">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        <p className="text-sm leading-snug text-muted-foreground">
          {description}
        </p>
      </div>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  );
}

/** Where a form's last submit left it. */
export type FormStatus =
  | { state: "idle" }
  | { state: "busy" }
  | { state: "done"; message: string }
  | { state: "error"; message: string };

export const IDLE: FormStatus = { state: "idle" };

/** A row whose controls are one form, saved with the button under them. */
export function FormSection({
  title,
  description,
  submitLabel,
  status,
  onSubmit,
  children,
}: {
  title: string;
  description: ReactNode;
  submitLabel: string;
  status: FormStatus;
  onSubmit: (form: HTMLFormElement) => void;
  children: ReactNode;
}) {
  const busy = status.state === "busy";
  return (
    <SettingsSection title={title} description={description}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) onSubmit(e.currentTarget);
        }}
      >
        {children}
        <div className="flex flex-wrap items-center justify-end gap-3">
          {/* Mounted once and rewritten, so what arrives is announced. */}
          <p
            role="status"
            className={cn(
              "mr-auto text-sm",
              status.state === "error"
                ? "text-destructive"
                : "text-muted-foreground",
            )}
          >
            {"message" in status ? status.message : ""}
          </p>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : submitLabel}
          </Button>
        </div>
      </form>
    </SettingsSection>
  );
}

/** One destructive action inside a danger zone: what it does, and its button. */
export function DangerItem({
  title,
  description,
  action,
}: {
  title: string;
  description: ReactNode;
  action: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-hairline p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-sm leading-snug text-muted-foreground">
          {description}
        </p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

/** The button that opens a destructive confirm: outlined, in the warning ink. */
export function DangerButton({
  children,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      variant="outline"
      className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
      {...props}
    >
      <Trash2 />
      {children}
    </Button>
  );
}

/**
 * The confirm in front of every destructive action.
 *
 * THE DIALOG STAYS OPEN WHILE THE ACTION RUNS. Radix closes an AlertDialog on
 * Action click; `preventDefault` stops that, so a failure lands inside the
 * dialog that asked rather than on a page that has already moved on. The action
 * throws to report failure, with a sentence meant for the person reading it.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
}: {
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        setOpen(next);
        setError(null);
      }}
    >
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="flex flex-col gap-2">{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <p
          role="alert"
          className="text-sm leading-snug text-destructive empty:hidden"
        >
          {error ?? ""}
        </p>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy}
            onClick={async (event) => {
              event.preventDefault();
              setBusy(true);
              setError(null);
              try {
                await onConfirm();
                setOpen(false);
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Working…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * A picture with its upload and remove controls: a person's (round) or a
 * workspace's (square -- a workspace is a thing, not a person).
 *
 * THE LABEL IS THE CONTROL. A `<label for>` on a visually-hidden file input is
 * a real, keyboard-operable file picker; a button calling `input.click()` is
 * not. Presentational: the route owns the upload hook and its mutations.
 */
export function PictureField({
  id,
  name,
  imageUrl,
  shape,
  uploading,
  fileInput,
  upload,
  remove,
  error,
}: {
  id: string;
  name: string | null | undefined;
  imageUrl: string | null | undefined;
  shape: "person" | "workspace";
  uploading: boolean;
  fileInput: RefObject<HTMLInputElement | null>;
  upload: (file: File | null) => Promise<void>;
  remove: () => Promise<void>;
  error: string | null;
}) {
  const radius = shape === "person" ? "rounded-full" : "rounded-md";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar className={cn("size-16 border border-hairline", radius)}>
          {imageUrl ? <AvatarImage src={imageUrl} alt="" /> : null}
          <AvatarFallback className={radius} aria-hidden="true">
            {initialsFor(name)}
          </AvatarFallback>
        </Avatar>
        <Button variant="outline" asChild>
          <label
            htmlFor={id}
            aria-disabled={uploading}
            className="cursor-pointer aria-disabled:pointer-events-none aria-disabled:text-muted-foreground"
          >
            {uploading
              ? "Uploading…"
              : imageUrl
                ? "Change picture"
                : "Upload picture"}
          </label>
        </Button>
        <input
          id={id}
          type="file"
          className="sr-only"
          accept={AVATAR_TYPES.join(",")}
          ref={fileInput}
          disabled={uploading}
          onChange={(e) => void upload(e.target.files?.[0] ?? null)}
        />
        {imageUrl ? (
          <ConfirmDialog
            trigger={
              // `type="button"`: this sits inside a profile form, where a
              // bare button would submit it.
              <Button type="button" variant="ghost" disabled={uploading}>
                Remove
              </Button>
            }
            title="Remove the picture?"
            description="Initials show in its place. The picture is deleted, so it would need to be uploaded again."
            confirmLabel="Remove picture"
            onConfirm={remove}
          />
        ) : null}
      </div>
      <p
        role="alert"
        className="text-sm leading-snug text-destructive empty:hidden"
      >
        {error ?? ""}
      </p>
    </div>
  );
}

/**
 * Run one form's save and report its outcome. `run` returns the success
 * sentence, or `{ error }` for a refusal it already has words for; anything
 * it throws is put into words by `describe`.
 */
export async function runSave(
  set: (status: FormStatus) => void,
  run: () => Promise<string | { error: string }>,
  describe: (e: unknown) => string,
) {
  set({ state: "busy" });
  try {
    const result = await run();
    set(
      typeof result === "string"
        ? { state: "done", message: result }
        : { state: "error", message: result.error },
    );
  } catch (e) {
    set({ state: "error", message: describe(e) });
  }
}
