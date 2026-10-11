"use client";

import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import {
  useReducer,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
} from "react";
import { api } from "@convex/_generated/api";
import {
  HIDDEN_PERMISSIONS,
  MAX_ROLE_NAME,
  PERMISSION_LABELS,
  ROLE_EDITOR_PERMISSIONS,
  isManager,
  type Permission,
} from "@convex/lib/orgs/permissions";
import { useWorkspaceSwitched } from "@/components/app/AppShell";
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

/** What the role dialog holds between presses. */
export type RoleForm = {
  name: string;
  ticked: Permission[];
  confirming: boolean;
};

export type RoleFormAction =
  | { type: "name"; name: string }
  | { type: "tick"; permission: Permission; on: boolean }
  | { type: "confirm" }
  | { type: "reset"; form: RoleForm };

export const startForm = (role?: Pick<Role, "name" | "permissions">) => ({
  name: role?.name ?? "",
  ticked: ROLE_EDITOR_PERMISSIONS.filter((p) => role?.permissions.includes(p)),
  confirming: false,
});

/**
 * Every change to the dialog. A change to the name or the ticks drops a
 * shown confirm: it counted the old set, and "Save anyway" would send another.
 */
export function roleForm(form: RoleForm, action: RoleFormAction): RoleForm {
  switch (action.type) {
    case "name":
      return { ...form, name: action.name, confirming: false };
    case "tick":
      return {
        ...form,
        confirming: false,
        ticked: ROLE_EDITOR_PERMISSIONS.filter((p) =>
          p === action.permission ? action.on : form.ticked.includes(p),
        ),
      };
    case "confirm":
      return { ...form, confirming: true };
    case "reset":
      return action.form;
  }
}

/**
 * What a press of the primary does (R-b). The server has no confirm flag, so
 * this is the only stop before a save moves people across the manager line.
 */
export function submitStep(
  role: Pick<Role, "holders" | "permissions"> | undefined,
  form: RoleForm,
):
  | { kind: "blank" }
  | { kind: "confirm"; moves: NonNullable<ReturnType<typeof crossing>> }
  | { kind: "save" } {
  if (!form.name.trim()) return { kind: "blank" };
  const moves = crossing(role, form.ticked);
  if (moves && !form.confirming) return { kind: "confirm", moves };
  return { kind: "save" };
}

/**
 * One checkbox. Never past this seat's own reach (requireWithin); a role
 * holding one this seat lacks isn't editable (requireReach), so on edit a
 * disabled box is never a ticked one. The launch role's are all disabled
 * (R-a), with its own reason above them. No reason while `held` loads.
 */
export function boxState(
  p: Permission,
  held: readonly Permission[] | undefined,
  launch: boolean,
): { disabled: boolean; helper?: string } {
  const mine = held?.includes(p) ?? false;
  return {
    disabled: launch || !mine,
    helper:
      held && !mine && !launch ? "Your role doesn't include this." : undefined,
  };
}

/**
 * Create role, or Edit role for `role`. A name and M-i's checkboxes
 * (`boxState`). A save that moves people across the manager line stops once
 * and says so (R-b, `submitStep`).
 */
export function RoleModal({
  role,
  open,
  onOpenChange,
  trigger,
  onCloseAutoFocus,
}: {
  role?: Role;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: ReactElement;
  onCloseAutoFocus?: (e: Event) => void;
}) {
  const expectOrgId = useExpectOrgId();
  const create = useMutation(api.orgRoles.create);
  const update = useMutation(api.orgRoles.update);
  const toast = useToast();
  // After a switch this would read the other workspace's permissions.
  const switched = useWorkspaceSwitched();
  const held = useQuery(
    api.orgs.myPermissions,
    open && !switched ? {} : "skip",
  );
  const [form, dispatch] = useReducer(roleForm, role, startForm);
  const [nameError, setNameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const formId = role ? `edit-role-${role._id}` : "create-role-form";
  const moves = crossing(role, form.ticked);
  // Holders can drop to none while the confirm is up: then it has nothing to say.
  const confirmingNow = form.confirming && moves !== null;

  function reset() {
    dispatch({ type: "reset", form: startForm(role) });
    setNameError(null);
    setError(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const step = submitStep(role, form);
    if (step.kind === "blank") {
      setNameError("Enter a name for the role.");
      return;
    }
    if (step.kind === "confirm") {
      dispatch({ type: "confirm" });
      return;
    }
    setNameError(null);
    setError(null);
    setPending(true);
    try {
      if (role) {
        await update({
          roleId: role._id,
          name: form.name,
          permissions: form.ticked,
          expectOrgId,
        });
        toast({ title: "Role saved." });
      } else {
        // Sent as ticked: the server refuses anything this seat doesn't hold.
        await create({
          name: form.name,
          permissions: form.ticked,
          expectOrgId,
        });
        toast({ title: "Role created." });
      }
      reset();
      onOpenChange(false);
    } catch (e) {
      const message = userMessage(e, "The role wasn't saved. Try again.");
      // Only the name's own refusals go under it; the role limit doesn't.
      if (errorCode(e) === "FIELD_REQUIRED" && /name/i.test(message))
        setNameError(message);
      else setError(message);
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
        if (!next) reset();
      }}
      trigger={trigger}
      label="Roles"
      title={role ? "Edit role" : "Create role"}
      formId={formId}
      primaryText={
        confirmingNow ? "Save anyway" : role ? "Save role" : "Create role"
      }
      primaryDisabled={pending}
      secondaryText="Cancel"
      onCloseAutoFocus={onCloseAutoFocus}
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
          maxLength={MAX_ROLE_NAME}
          value={form.name}
          error={nameError ?? undefined}
          onChange={(e) => {
            dispatch({ type: "name", name: e.currentTarget.value });
            setNameError(null);
          }}
          className="bg-background"
        />
        <fieldset className="flex flex-col gap-05">
          <legend className="pb-03 text-heading-04">Permissions</legend>
          {role?.launch && (
            <p className="text-label-01 text-text-secondary">
              Your team joins with this role, so it has no permissions.
            </p>
          )}
          {ROLE_EDITOR_PERMISSIONS.map((p) => (
            <Checkbox
              key={p}
              label={PERMISSION_LABELS[p]}
              checked={form.ticked.includes(p)}
              {...boxState(p, held, role?.launch ?? false)}
              onChange={(e) =>
                dispatch({
                  type: "tick",
                  permission: p,
                  on: e.currentTarget.checked,
                })
              }
            />
          ))}
          {role && !role.launch && (
            <p className="text-label-01 text-text-secondary">
              Adding a permission withdraws pending invitations into this role.
            </p>
          )}
        </fieldset>
        {confirmingNow && moves && (
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
  onCloseAutoFocus,
}: {
  role: Role;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (e: Event) => void;
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
      onCloseAutoFocus={onCloseAutoFocus}
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
  // Each opening starts the edit dialog afresh from the role as it is now; a
  // save doesn't remount it while open.
  const [opened, setOpened] = useState(0);
  // The menu would pull focus back to its trigger, past the dialog's own.
  const toDialog = useRef(false);
  // Cancel or Escape goes back to this row's Manage button; a deleted row
  // has none, so focus falls back to the heading.
  const manageRef = useRef<HTMLButtonElement>(null);
  const backToRow = (e: Event) => {
    e.preventDefault();
    if (manageRef.current?.isConnected) manageRef.current.focus();
    else document.getElementById("roles-heading")?.focus();
  };
  const items: MenuItem[] = [
    ...(role.editable ? [{ label: "Edit role", value: "edit" as const }] : []),
    ...(role.deletable
      ? [{ label: "Delete role", value: "delete" as const }]
      : []),
  ].map(({ label, value }) => ({
    label,
    onSelect: () => {
      toDialog.current = true;
      if (value === "edit") setOpened((n) => n + 1);
      setDialog(value);
    },
  }));
  // An open dialog stays up when the row's flags change under it; the
  // server's refusal shows in its error line (M-7).
  if (items.length === 0 && dialog === null) return null;
  return (
    <>
      {items.length > 0 && (
        <Menu
          align="end"
          items={items}
          onCloseAutoFocus={(e) => {
            if (toDialog.current) e.preventDefault();
            toDialog.current = false;
          }}
          trigger={
            <Button
              ref={manageRef}
              kind="ghost"
              size="sm"
              className="max-md:h-size-control-lg"
              aria-label={`Manage ${role.name}`}
            >
              Manage
            </Button>
          }
        />
      )}
      <RoleModal
        key={opened}
        role={role}
        open={dialog === "edit"}
        onOpenChange={(open) => setDialog(open ? "edit" : null)}
        onCloseAutoFocus={backToRow}
      />
      {(role.deletable || dialog === "delete") && (
        <DeleteRole
          role={role}
          open={dialog === "delete"}
          onOpenChange={(open) => setDialog(open ? "delete" : null)}
          onCloseAutoFocus={backToRow}
        />
      )}
    </>
  );
}
