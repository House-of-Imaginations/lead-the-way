"use client";

import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import { useRef, useState, type FormEvent, type ReactElement } from "react";
import { api } from "@convex/_generated/api";
import {
  HIDDEN_PERMISSIONS,
  PERMISSION_LABELS,
  ROLE_EDITOR_PERMISSIONS,
  isManager,
  type Permission,
} from "@convex/lib/orgs/permissions";
import { useExpectOrgId } from "@/components/app/ExpectOrgId";
import {
  Button,
  Checkbox,
  InlineNotification,
  Menu,
  Modal,
  TextInput,
  useToast,
  type MenuItem,
} from "@/components/ui";
import { errorCode, userMessage } from "@/lib/errors";
import type { Role } from "./MembersTab";

/**
 * R-b: who a save moves across the manager line (W-f). The hidden
 * permissions stay on save (M-e), so they count on both sides. Null when
 * nobody moves: a new role, an empty one, or one that stays on its side.
 */
export function crossing(
  role: Pick<Role, "holders" | "permissions"> | undefined,
  next: readonly Permission[],
): { holders: number; toManager: boolean } | null {
  if (!role || role.holders === 0) return null;
  const kept = role.permissions.filter((p) => HIDDEN_PERMISSIONS.includes(p));
  const before = isManager({ permissions: role.permissions });
  const after = isManager({ permissions: [...next, ...kept] });
  return before === after ? null : { holders: role.holders, toManager: after };
}

export function crossingCopy({
  holders,
  toManager,
}: {
  holders: number;
  toManager: boolean;
}): string {
  const one = holders === 1;
  const who = `The ${holders} ${one ? "person" : "people"} with this role`;
  const move = toManager
    ? one
      ? "becomes a manager and leaves team totals."
      : "become managers and leave team totals."
    : one
      ? "stops being a manager and joins team totals."
      : "stop being managers and join team totals.";
  return `${who} ${move} Changing roles during a sprint can hide the rest of that sprint's team totals.`;
}

/** The dialogs return focus to the header: a row may be gone. */
const focusHeader = (e: Event) => {
  e.preventDefault();
  document.getElementById("roles-heading")?.focus();
};

/**
 * Create role, or Edit role for `role`. A name and M-i's checkboxes; a box
 * this seat doesn't hold is disabled (the server would refuse it), and the
 * launch role's are all disabled (R-a). A save that moves people across the
 * manager line stops once and says so (R-b).
 */
export function RoleModal({
  role,
  open,
  onOpenChange,
  trigger,
}: {
  role?: Role;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: ReactElement;
}) {
  const expectOrgId = useExpectOrgId();
  const create = useMutation(api.orgRoles.create);
  const update = useMutation(api.orgRoles.update);
  const toast = useToast();
  const held = useQuery(api.orgs.myPermissions, open ? {} : "skip");
  const start = () =>
    ROLE_EDITOR_PERMISSIONS.filter((p) => role?.permissions.includes(p));
  const [name, setName] = useState(role?.name ?? "");
  const [ticked, setTicked] = useState<Permission[]>(start);
  const [confirming, setConfirming] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const formId = role ? `edit-role-${role._id}` : "create-role-form";
  const moves = crossing(role, ticked);

  function reset() {
    setName(role?.name ?? "");
    setTicked(start());
    setConfirming(false);
    setNameError(null);
    setError(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!name.trim()) {
      setNameError("Enter a name for the role.");
      return;
    }
    if (moves && !confirming) {
      setConfirming(true);
      return;
    }
    setNameError(null);
    setError(null);
    setPending(true);
    try {
      if (role) {
        await update({
          roleId: role._id,
          name,
          permissions: ticked,
          expectOrgId,
        });
        toast({ title: "Role saved." });
      } else {
        await create({ name, permissions: ticked, expectOrgId });
        toast({ title: "Role created." });
        setName("");
        setTicked([]);
      }
      setConfirming(false);
      onOpenChange(false);
    } catch (e) {
      const message = userMessage(e, "The role wasn't saved. Try again.");
      if (errorCode(e) === "FIELD_REQUIRED") setNameError(message);
      else setError(message);
    } finally {
      setPending(false);
    }
  }

  const toggle = (p: Permission, on: boolean) => {
    setConfirming(false);
    setTicked((now) =>
      ROLE_EDITOR_PERMISSIONS.filter((q) => (q === p ? on : now.includes(q))),
    );
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        onOpenChange(next);
        if (!next) reset();
      }}
      trigger={trigger}
      label="Roles"
      title={role ? "Edit role" : "Create role"}
      formId={formId}
      primaryText={
        confirming ? "Save anyway" : role ? "Save role" : "Create role"
      }
      primaryDisabled={pending}
      secondaryText="Cancel"
      onCloseAutoFocus={trigger ? undefined : focusHeader}
    >
      <form
        id={formId}
        className="flex flex-col gap-06 pt-06"
        noValidate
        onSubmit={(e) => void onSubmit(e)}
      >
        <TextInput
          id={`${formId}-name`}
          label="Role name"
          placeholder="For example, Coordinator"
          // ponytail: the server's MAX_ROLE_NAME (convex/orgRoles.ts).
          maxLength={40}
          value={name}
          error={nameError ?? undefined}
          onChange={(e) => {
            setName(e.currentTarget.value);
            setNameError(null);
            setConfirming(false);
          }}
          className="bg-background"
        />
        <fieldset disabled={role?.launch} className="flex flex-col gap-05">
          <legend className="pb-03 text-heading-04">Permissions</legend>
          {role?.launch && (
            <p className="text-label-01 text-text-secondary">
              Your team joins with this role, so it has no permissions.
            </p>
          )}
          {ROLE_EDITOR_PERMISSIONS.map((p) => {
            const mine = held?.includes(p) ?? false;
            return (
              <Checkbox
                key={p}
                label={PERMISSION_LABELS[p]}
                checked={ticked.includes(p)}
                // Never past this seat's own reach (requireWithin). A role
                // holding one this seat lacks isn't editable (requireReach),
                // so a disabled box is never a ticked one. Disabled, without
                // the reason, while the seat's permissions load.
                disabled={!mine}
                helper={
                  held && !mine ? "Your role doesn't include this." : undefined
                }
                onChange={(e) => toggle(p, e.currentTarget.checked)}
              />
            );
          })}
        </fieldset>
        {confirming && moves && (
          <div role="alert">
            <InlineNotification title="Check before you save.">
              {crossingCopy(moves)}
            </InlineNotification>
          </div>
        )}
        {error && (
          <p role="alert" className="text-label-01 text-support-error">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

function DeleteRole({
  role,
  open,
  onOpenChange,
}: {
  role: Role;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const expectOrgId = useExpectOrgId();
  const remove = useMutation(api.orgRoles.remove);
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onDelete() {
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      await remove({ roleId: role._id, expectOrgId });
      toast({ title: "Role deleted." });
      onOpenChange(false);
    } catch (e) {
      setError(userMessage(e, "The role wasn't deleted. Try again."));
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        onOpenChange(next);
        if (!next) setError(null);
      }}
      label="Roles"
      title={`Delete ${role.name}?`}
      description="Nobody holds this role. Pending invitations into it stop working."
      primaryText="Delete role"
      primaryKind="danger"
      onPrimary={() => void onDelete()}
      primaryDisabled={pending}
      secondaryText="Cancel"
      onCloseAutoFocus={focusHeader}
    >
      {error && (
        <p role="alert" className="text-label-01 text-support-error">
          {error}
        </p>
      )}
    </Modal>
  );
}

/** One role's Manage menu: what the server's flags allow (R-a), else nothing. */
export function ManageRole({ role }: { role: Role }) {
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null);
  // The menu would pull focus back to its trigger, past the dialog's own.
  const toDialog = useRef(false);
  const items: MenuItem[] = [
    ...(role.editable ? [{ label: "Edit role", value: "edit" as const }] : []),
    ...(role.deletable
      ? [{ label: "Delete role", value: "delete" as const }]
      : []),
  ].map(({ label, value }) => ({
    label,
    onSelect: () => {
      toDialog.current = true;
      setDialog(value);
    },
  }));
  if (items.length === 0) return null;
  return (
    <>
      <Menu
        align="end"
        items={items}
        onCloseAutoFocus={(e) => {
          if (toDialog.current) e.preventDefault();
          toDialog.current = false;
        }}
        trigger={
          <Button
            kind="ghost"
            size="sm"
            className="max-md:h-size-control-lg"
            aria-label={`Manage ${role.name}`}
          >
            Manage
          </Button>
        }
      />
      <RoleModal
        key={`${role.name} ${role.permissions.join()}`}
        role={role}
        open={dialog === "edit"}
        onOpenChange={(open) => setDialog(open ? "edit" : null)}
      />
      {role.deletable && (
        <DeleteRole
          role={role}
          open={dialog === "delete"}
          onOpenChange={(open) => setDialog(open ? "delete" : null)}
        />
      )}
    </>
  );
}
