"use client";

import { useConvexAuth, useMutation } from "convex/react";
import type { OptimisticLocalStore } from "convex/browser";
import { useQuery } from "convex-helpers/react/cache";
import { api } from "@convex/_generated/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { PageBody } from "@/app/(app)/_components/page-body";
import { useMinute } from "@/hooks/useMinute";
import { userMessage } from "@/lib/errors";
import {
  InboxEmpty,
  InboxList,
  InboxSkeleton,
  type InboxRow,
} from "./_components/inbox-list";

/**
 * Every notification the signed-in person was sent, newest first.
 *
 * The writes are optimistic, so a tap reads and a cross clears under the
 * finger; the subscription's own answer replaces the guess. "Clear all" is
 * immediate and offers Undo in a toast rather than asking first -- the server
 * keeps that batch stamped so Undo can bring it back.
 */
function rewrite(
  store: OptimisticLocalStore,
  next: (rows: InboxRow[]) => InboxRow[],
) {
  const rows = store.getQuery(api.inbox.list, {});
  if (!rows) return;
  const updated = next(rows);
  store.setQuery(api.inbox.list, {}, updated);
  store.setQuery(
    api.inbox.unreadCount,
    {},
    updated.filter((r) => r.readAt === undefined).length,
  );
}

const read = (row: InboxRow): InboxRow =>
  row.readAt === undefined ? { ...row, readAt: Date.now() } : row;

export default function InboxPage() {
  const { isAuthenticated } = useConvexAuth();
  const rows = useQuery(api.inbox.list, isAuthenticated ? {} : "skip");
  const now = useMinute();

  const markRead = useMutation(api.inbox.markRead).withOptimisticUpdate(
    (store, { id }) =>
      rewrite(store, (rs) => rs.map((r) => (r._id === id ? read(r) : r))),
  );
  const markAllRead = useMutation(api.inbox.markAllRead).withOptimisticUpdate(
    (store) => rewrite(store, (rs) => rs.map(read)),
  );
  const clear = useMutation(api.inbox.clear).withOptimisticUpdate(
    (store, { id }) => rewrite(store, (rs) => rs.filter((r) => r._id !== id)),
  );
  const clearAll = useMutation(api.inbox.clearAll).withOptimisticUpdate(
    (store) => rewrite(store, () => []),
  );
  const undoClearAll = useMutation(api.inbox.undoClearAll);

  const failed = (fallback: string) => (e: unknown) =>
    toast.error(userMessage(e, fallback));

  function clearEverything() {
    clearAll({})
      .then((clearedAt) =>
        toast("Cleared all notifications", {
          action: {
            label: "Undo",
            onClick: () =>
              void undoClearAll({ clearedAt }).catch(
                failed("Your notifications could not be restored."),
              ),
          },
        }),
      )
      .catch(failed("Your notifications could not be cleared."));
  }

  const unread = rows?.filter((r) => r.readAt === undefined).length ?? 0;

  return (
    <PageBody>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Inbox</h1>
          <div
            className="text-sm text-muted-foreground tabular-nums"
            aria-live="polite"
          >
            {rows === undefined ? (
              <Skeleton className="h-4 w-20" />
            ) : unread > 0 ? (
              `${unread} unread`
            ) : rows.length > 0 ? (
              "All read"
            ) : (
              "Nothing new"
            )}
          </div>
        </div>
        {rows && rows.length > 0 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              disabled={unread === 0}
              onClick={() =>
                void markAllRead({}).catch(
                  failed("Your notifications could not be marked as read."),
                )
              }
            >
              Mark all as read
            </Button>
            <Button variant="ghost" onClick={clearEverything}>
              Clear all
            </Button>
          </div>
        )}
      </div>

      {rows === undefined ? (
        <InboxSkeleton />
      ) : rows.length === 0 ? (
        <InboxEmpty />
      ) : (
        <InboxList
          rows={rows}
          now={now}
          onOpen={(id) =>
            void markRead({ id }).catch(
              failed("This notification could not be marked as read."),
            )
          }
          onClear={(id) =>
            void clear({ id }).catch(
              failed("This notification could not be cleared."),
            )
          }
        />
      )}
      {/* ponytail: mounted here because the inbox is the only screen that
          toasts; move it to the shell when a second one does. */}
      <Toaster />
    </PageBody>
  );
}
