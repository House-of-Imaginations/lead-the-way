"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "convex-helpers/react/cache";
import { api } from "@convex/_generated/api";
import { ChevronsUpDown, LogOut, Settings } from "lucide-react";
import { authClient } from "@/lib/account/auth-client";
import { badgeLabel, initialsFor } from "@/lib/account/avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Who this browser is signed in as, and everything you can do about it. The
 * block shipped this with a hard-coded `user` prop; it reads the real account
 * instead, carrying over what `kit/AccountBadge` had learned:
 *
 * READ THROUGH CONVEX, NEVER `authClient.useSession()`.
 * `_components/ConvexClientProvider.tsx` documents that upstream collapses
 * `useSession().data` to `never`, and this branch already carries one assertion
 * for it.
 *
 * `profiles.me` is the renamed, product-owned name and WINS over the Better
 * Auth record, which is what a brand-new account has before it finishes setup.
 */
export function NavUser() {
  const { isMobile } = useSidebar();
  const router = useRouter();
  const user = useQuery(api.auth.getCurrentUser, {});
  const profile = useQuery(api.profiles.me, {});

  // Undefined is "still asking". A row drawn before the answer arrives would
  // flash the signed-out state at somebody who is signed in, on every page
  // load -- so the space is held at the row's own height and left empty.
  if (user === undefined) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <Skeleton className="h-12 w-full" />
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  // No account: the honest control is a way to get one, not a badge with
  // nothing behind it. Deliberately still shown to a guest -- somebody who
  // followed an invitation link has no account, and the rail says so rather
  // than pretending the door is not there.
  if (user === null) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <Link href="/sign-in">
              <LogOut className="rotate-180" />
              <span>Sign in</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  const name = profile?.displayName ?? user.name ?? user.email ?? null;
  const avatarUrl = profile?.avatarUrl ?? null;
  const email = user.email ?? "";

  async function signOut() {
    await authClient.signOut();
    router.push("/");
  }

  // Drawn twice -- on the trigger and at the top of the open menu -- so the
  // menu still says whose account it is when it opens over the trigger.
  const identity = (
    <>
      <Avatar className="size-8 rounded-md">
        {/* `alt=""` because the button's own label names the account;
            an alt would be the second announcement of the same thing. */}
        {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
        {/* `aria-hidden` for the same reason: a reader announcing "bee
            see" says nothing the label did not. */}
        <AvatarFallback className="rounded-md" aria-hidden="true">
          {initialsFor(name)}
        </AvatarFallback>
      </Avatar>
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">{name}</span>
        <span className="truncate text-xs text-muted-foreground">{email}</span>
      </div>
    </>
  );

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              aria-label={badgeLabel(name)}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              {identity}
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5">
                {identity}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                {/* Deleting the account lives on this page's "Leaving"
                    section, behind its own confirm -- not one mis-tap deep
                    in a menu. */}
                <Link href="/settings">
                  <Settings />
                  Settings
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void signOut()}>
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
