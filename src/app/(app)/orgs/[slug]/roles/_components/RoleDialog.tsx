import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Permission } from "@convex/lib/orgs/permissions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  PERMISSION_DESCRIPTIONS,
  PERMISSION_LABELS,
  PERMISSION_ORDER,
} from "./permissionLabels";

/**
 * Creating or editing one role, in a dialog: a name and a checkbox per
 * permission.
 *
 * PRESENTATIONAL: it holds the draft and nothing else. `onSave` belongs to the
 * route and resolves to an error sentence, or null once it has saved -- which
 * is when the dialog closes, so a refusal is read inside the form that caused
 * it.
 *
 * A permission the caller does not hold is shown but disabled: offering it
 * would be a control whose only outcome is the server's escalation refusal.
 * One the role already has stays clearable, since narrowing never escalates.
 *
 * No `"use client"`, for the reason `src/components/settings.tsx` gives: its
 * importer is a client page, and the directive would treat `onSave` as a
 * server boundary.
 */
export function RoleDialog({
  trigger,
  title,
  submitLabel,
  initialName = "",
  initialPermissions = [],
  reach,
  onSave,
}: {
  trigger: ReactNode;
  title: string;
  submitLabel: string;
  initialName?: string;
  initialPermissions?: readonly Permission[];
  reach: readonly Permission[];
  onSave: (name: string, permissions: Permission[]) => Promise<string | null>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [held, setHeld] = useState<readonly Permission[]>(initialPermissions);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<Permission>>(new Set());

  function toggle(permission: Permission) {
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(permission)) next.add(permission);
      return next;
    });
  }

  function reset(next: boolean) {
    if (busy) return;
    // Every opening starts from the stored role, not from an abandoned draft.
    if (next) {
      setName(initialName);
      setHeld(initialPermissions);
      setError(null);
    }
    setOpen(next);
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto border-0">
        <form
          className="flex flex-col gap-5"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            setError(null);
            const failure = await onSave(name.trim(), [...held]);
            setBusy(false);
            if (failure) setError(failure);
            else setOpen(false);
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Everyone with this role gets exactly these permissions.
            </DialogDescription>
          </DialogHeader>

          <Field>
            <FieldLabel htmlFor="role-name">Role name</FieldLabel>
            <Input
              id="role-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={40}
              placeholder="For example, Team lead"
              disabled={busy}
            />
          </Field>

          <FieldSet>
            <FieldLegend variant="label">Permissions</FieldLegend>
            {PERMISSION_ORDER.map((permission) => {
              const checked = held.includes(permission);
              const offerable = reach.includes(permission) || checked;
              const id = `permission-${permission.replace(":", "-")}`;
              return (
                <Field key={permission} orientation="horizontal">
                  <Checkbox
                    id={id}
                    checked={checked}
                    disabled={busy || !offerable}
                    onCheckedChange={(next) =>
                      setHeld((current) =>
                        next === true
                          ? [...current, permission]
                          : current.filter((p) => p !== permission),
                      )
                    }
                  />
                  <FieldContent>
                    <FieldLabel htmlFor={id}>
                      {PERMISSION_LABELS[permission]}
                    </FieldLabel>
                    {!offerable && (
                      <FieldDescription>
                        Your own role does not have this, so you cannot give it.
                      </FieldDescription>
                    )}
                    {/* ponytail: grid-rows 0fr/1fr animates height without measuring it */}
                    <div
                      id={`${id}-about`}
                      inert={!expanded.has(permission)}
                      className={cn(
                        "grid transition-[grid-template-rows] duration-200 motion-reduce:transition-none",
                        expanded.has(permission)
                          ? "grid-rows-[1fr]"
                          : "grid-rows-[0fr]",
                      )}
                    >
                      <FieldDescription className="overflow-hidden">
                        {PERMISSION_DESCRIPTIONS[permission]}
                      </FieldDescription>
                    </div>
                  </FieldContent>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6 shrink-0 text-muted-foreground"
                    aria-expanded={expanded.has(permission)}
                    aria-controls={`${id}-about`}
                    aria-label={`About ${PERMISSION_LABELS[permission]}`}
                    onClick={() => toggle(permission)}
                  >
                    <ChevronDown
                      className={cn(
                        "transition-transform motion-reduce:transition-none",
                        expanded.has(permission) && "rotate-180",
                      )}
                    />
                  </Button>
                </Field>
              );
            })}
          </FieldSet>

          <p
            role="alert"
            className="text-sm leading-snug text-destructive empty:hidden"
          >
            {error ?? ""}
          </p>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={busy}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy ? "Saving…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
