import Link from "next/link";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { BellCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { groupByDay, inboxHref, timeLabel } from "@/lib/inbox";
import { cn } from "@/lib/utils";

export type InboxRow = FunctionReturnType<typeof api.inbox.list>[number];

/** Day groups of notification rows. Presentational: the route owns the writes. */
export function InboxList({
  rows,
  now,
  onOpen,
  onClear,
}: {
  rows: InboxRow[];
  now: number;
  onOpen: (id: Id<"notifications">) => void;
  onClear: (id: Id<"notifications">) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      {groupByDay(rows, now).map((group) => (
        <section
          key={group.label}
          aria-labelledby={`day-${group.label}`}
          className="flex flex-col gap-2"
        >
          <h2
            id={`day-${group.label}`}
            className="px-1 text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase"
          >
            {group.label}
          </h2>
          <ul className="divide-y divide-hairline overflow-hidden rounded-md border border-hairline bg-card">
            {group.rows.map((row) => (
              <InboxItem
                key={row._id}
                row={row}
                now={now}
                onOpen={() => onOpen(row._id)}
                onClear={() => onClear(row._id)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function InboxItem({
  row,
  now,
  onOpen,
  onClear,
}: {
  row: InboxRow;
  now: number;
  onOpen: () => void;
  onClear: () => void;
}) {
  const unread = row.readAt === undefined;
  const href = inboxHref(row.url);
  const content = (
    <>
      {/* The dot column is always there, so read and unread titles align. */}
      <span aria-hidden className="flex h-5 w-2 shrink-0 items-center">
        {unread && <span className="size-2 rounded-full bg-institution" />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-baseline gap-3">
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-sm",
              unread ? "font-semibold text-foreground" : "text-foreground",
            )}
          >
            {unread && <span className="sr-only">Unread: </span>}
            {row.title}
          </span>
          <time
            dateTime={new Date(row._creationTime).toISOString()}
            title={new Date(row._creationTime).toLocaleString()}
            className="shrink-0 text-xs text-muted-foreground tabular-nums"
          >
            {timeLabel(row._creationTime, now)}
          </time>
        </span>
        <span className="line-clamp-2 text-sm text-muted-foreground">
          {row.body}
        </span>
      </span>
    </>
  );
  const rowClass =
    "flex min-h-11 min-w-0 flex-1 items-start gap-3 py-3 pl-4 text-left -outline-offset-2";

  return (
    <li className="group flex items-center transition-colors duration-[var(--t-state)] hover:bg-accent">
      {href ? (
        <Link href={href} onClick={onOpen} className={rowClass}>
          {content}
        </Link>
      ) : (
        <button type="button" onClick={onOpen} className={rowClass}>
          {content}
        </button>
      )}
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Clear notification: ${row.title}`}
        onClick={onClear}
        // Hidden until the row is hovered or focused, so a long list reads as
        // messages rather than a column of crosses. A touch screen has no
        // hover, so there it is always shown, at a 44px target.
        className="mx-2 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:size-11 pointer-coarse:opacity-100"
      >
        <X />
      </Button>
    </li>
  );
}

/** An empty inbox is a finished one; say so, and point at what fills it. */
export function InboxEmpty() {
  return (
    <div className="flex flex-col items-start gap-4 rounded-md border border-hairline bg-card p-6 sm:flex-row sm:items-center">
      <BellCheck
        aria-hidden
        className="size-6 shrink-0 text-muted-foreground"
      />
      <div className="flex flex-1 flex-col gap-1">
        <p className="text-base font-semibold">You’re all caught up</p>
        <p className="text-sm text-muted-foreground">
          Updates land here as they happen. Choose which ones reach you in
          notification settings.
        </p>
      </div>
      <Button variant="outline" asChild>
        <Link href="/settings/notifications">Notification settings</Link>
      </Button>
    </div>
  );
}

/** Content-shaped, like `PagePending`: a day label and a card of rows. */
export function InboxSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      <Skeleton className="mx-1 h-3 w-16" />
      <div className="divide-y divide-hairline rounded-md border border-hairline bg-card">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 px-4 py-3">
            <Skeleton className="mt-1.5 size-2 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3.5 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
