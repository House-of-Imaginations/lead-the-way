"use client";

import { useQuery } from "convex-helpers/react/cache";
import { api } from "@convex/_generated/api";
import {
  HIDDEN_PERMISSIONS,
  PERMISSION_LABELS,
} from "@convex/lib/orgs/permissions";
import { useShell, useWorkspaceSwitched } from "@/components/app/AppShell";
import { useExpectOrgId } from "@/components/app/ExpectOrgId";
import { Tag } from "@/components/ui";
import type { Role } from "./MembersTab";

/** A role's permissions as M-i's words, the hidden ones left out (M-e). */
function labelsOf(role: Role): string[] {
  return role.permissions
    .filter((p) => !HIDDEN_PERMISSIONS.includes(p))
    .map((p) => PERMISSION_LABELS[p]);
}

/**
 * 18's Roles (spec 7.2): each role, its permissions as tags, and how many
 * people hold it (a count, never who). Guarded as Members is (R-g, C2).
 */
export function RolesTab({ initial }: { initial: Role[] }) {
  const switched = useWorkspaceSwitched();
  const expectOrgId = useExpectOrgId();
  const own = (rows: Role[] | undefined) =>
    rows?.every((r) => r.orgId === expectOrgId) ? rows : undefined;
  const allowed =
    useShell().workspaceSettings.tabs.includes("roles") && !switched;
  const roles =
    own(useQuery(api.orgRoles.list, allowed ? {} : "skip")) ??
    own(initial) ??
    [];
  return (
    <section aria-labelledby="roles-heading" className="flex flex-col gap-05">
      <div className="flex flex-wrap items-center justify-between gap-05">
        <h2 id="roles-heading" tabIndex={-1} className="text-heading-03">
          {`${roles.length} ${roles.length === 1 ? "role" : "roles"}`}
        </h2>
      </div>
      {/* Only a table scrolls sideways, inside its own container. */}
      <div
        role="region"
        aria-label="Roles"
        tabIndex={0}
        className="relative overflow-x-auto"
      >
        <table className="ltw-table">
          <thead>
            <tr>
              <th scope="col">Role</th>
              <th scope="col">Permissions</th>
              <th scope="col">People</th>
              <th scope="col">
                <span className="sr-only">Manage</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => {
              const labels = labelsOf(role);
              return (
                <tr key={role._id}>
                  <td>
                    <div className="flex flex-col gap-02">
                      <span>{role.name}</span>
                      {role.launch && (
                        <span className="text-label-01 text-text-secondary">
                          Your team joins with this role.
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    {role.isOwner ? (
                      <Tag>Every permission</Tag>
                    ) : labels.length > 0 ? (
                      <div className="flex flex-wrap gap-03">
                        {labels.map((label) => (
                          <Tag key={label}>{label}</Tag>
                        ))}
                      </div>
                    ) : (
                      <span className="text-text-secondary">
                        No permissions
                      </span>
                    )}
                  </td>
                  <td className="tabular-nums">{role.holders}</td>
                  <td className="text-right" />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
