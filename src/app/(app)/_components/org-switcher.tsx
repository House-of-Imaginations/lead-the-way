"use client";

import Link from "next/link";
import { useSelectedLayoutSegments } from "next/navigation";
import { useQuery } from "convex-helpers/react/cache";
import { api } from "@convex/_generated/api";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { initialsFor } from "@/lib/account/avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Which workspace you are looking at, and the way to another one. Was a roundel
 * in the old header band; in a sidebar it can afford the workspace's real name.
 *
 * IT ASKS WHO IS HERE BEFORE IT ASKS ANYTHING ELSE. `api.orgs.mine` is an
 * `authenticatedQuery`, so for a guest it THROWS rather than returning an empty
 * list, and `convex-helpers/react/cache` re-throws that during render. With no
 * `error.tsx` anywhere under `src/app` that is a blank screen. The `"skip"`
 * below is the whole guard -- a guarded `if` after the hook would still have
 * issued the query.
 *
 * IT RENDERS NOTHING FOR SOMEBODY IN NO WORKSPACES, rather than offering a
 * "New workspace" entry to everybody. A control that exists only to announce
 * you have nothing is wrong on the two routes the product actually starts on;
 * the gate on `/` already sends a new account to create its first.
 */
export function OrgSwitcher() {
  const user = useQuery(api.auth.getCurrentUser, {});
  const orgs = useQuery(api.orgs.mine, user ? {} : "skip");

  // The active slug comes from the URL rather than from state, so the rail is
  // correct on a hard load of a deep link and there is no second source of
  // truth for "which workspace" to drift.
  const segments = useSelectedLayoutSegments();
  const activeSlug = segments[0] === "orgs" ? segments[1] : undefined;

  if (user === null) return null;

  if (user === undefined || orgs === undefined) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <Skeleton className="h-8 w-full" />
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }
  if (orgs.length === 0) return null;

  const active = orgs.find((org) => org.slug === activeSlug) ?? orgs[0];

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              aria-label={`Workspace: ${active.name}`}
              className="data-[state=open]:bg-sidebar-accent"
            >
              <WorkspaceAvatar name={active.name} imageUrl={active.imageUrl} />
              {/* Both hidden rather than clipped in the icon rail, for the
                  reason the wordmark is: anything left in flow keeps its width
                  and pushes the avatar off-centre. */}
              <span className="truncate group-data-[collapsible=icon]:hidden">
                {active.name}
              </span>
              <ChevronsUpDown className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
            align="start"
          >
            <DropdownMenuLabel className="text-muted-foreground">
              Workspaces
            </DropdownMenuLabel>
            {orgs.map((org) => (
              <DropdownMenuItem key={org._id} asChild>
                <Link href={`/orgs/${org.slug}`}>
                  <WorkspaceAvatar name={org.name} imageUrl={org.imageUrl} />
                  <span className="truncate">{org.name}</span>
                  {org._id === active._id ? (
                    <Check className="ml-auto" aria-label="Current" />
                  ) : null}
                </Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/orgs/new">
                <Plus />
                New workspace
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

/**
 * A workspace at nav size. SQUARE with a 6px radius, where a person's roundel
 * is a circle -- the same shape-carries-meaning argument the Glyph Rule makes,
 * applied to identity: at 20px in a dropdown, shape is readable and a small
 * picture is not.
 */
function WorkspaceAvatar({
  name,
  imageUrl,
}: {
  name: string;
  imageUrl: string | null;
}) {
  return (
    /* 16px in the icon rail, matching the `[&>svg]:size-4` the nav glyphs get,
       because a 20px square beside 16px icons is the one thing that makes a
       rail of six items look crooked. */
    <Avatar className="size-5 rounded-sm group-data-[collapsible=icon]:size-4">
      {/* `alt=""` because the name is right beside it in the same control. */}
      {imageUrl ? <AvatarImage src={imageUrl} alt="" /> : null}
      <AvatarFallback
        className="label rounded-sm bg-institution text-[9px] text-on-institution group-data-[collapsible=icon]:text-[7px]"
        aria-hidden="true"
      >
        {initialsFor(name)}
      </AvatarFallback>
    </Avatar>
  );
}
