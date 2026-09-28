/// <reference types="vite/client" />
import { afterEach, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { deliverNotification, INBOX_CAP } from "../../convex/lib/push/inbox";
import { harness, workspace, type T } from "./workspace/helpers";

/**
 * The inbox is written by the same helper that queues a push. These tests seed
 * rows directly for ownership and the cap. `web-push` is mocked and no VAPID keys are set, so a
 * queued send returns before it could reach the network.
 */

vi.mock("web-push", () => ({
  default: { setVapidDetails: vi.fn(), sendNotification: vi.fn() },
}));

afterEach(() => {
  vi.useRealTimers();
});

async function drain(t: T, run: () => Promise<unknown>) {
  vi.useFakeTimers();
  await run();
  await t.finishAllScheduledFunctions(vi.runAllTimers);
}

async function seed(t: T, orgId: Id<"orgs">, userId: string, count = 1) {
  await t.run(async (ctx) => {
    for (let seq = 1; seq <= count; seq++)
      await ctx.db.insert("notifications", {
        userId,
        orgId,
        event: "example",
        title: "Example",
        body: "Something happened.",
        url: "/dashboard",
        seq,
      });
  });
}

const rowsOf = (t: T, userId: string) =>
  t.run((ctx) =>
    ctx.db
      .query("notifications")
      .withIndex("by_userId_and_seq", (q) => q.eq("userId", userId))
      .collect(),
  );

test("nobody can read, mark or clear another person's notifications", async () => {
  const t = harness();
  const { orgId } = await workspace(t);
  await seed(t, orgId, "alice");
  const alice = t.withIdentity({ subject: "alice" });
  const bob = t.withIdentity({ subject: "bob" });
  const [row] = await alice.query(api.inbox.list, {});

  await expect(bob.query(api.inbox.list, {})).resolves.toEqual([]);
  await expect(bob.query(api.inbox.unreadCount, {})).resolves.toBe(0);
  await bob.mutation(api.inbox.markRead, { id: row._id });
  await bob.mutation(api.inbox.markAllRead, {});
  await bob.mutation(api.inbox.clear, { id: row._id });
  await bob.mutation(api.inbox.clearAll, {});

  await expect(alice.query(api.inbox.list, {})).resolves.toEqual([row]);
  await expect(t.query(api.inbox.list, {})).rejects.toThrow();

  await alice.mutation(api.inbox.markRead, { id: row._id });
  await expect(alice.query(api.inbox.unreadCount, {})).resolves.toBe(0);
  await alice.mutation(api.inbox.clear, { id: row._id });
  await expect(rowsOf(t, "alice")).resolves.toEqual([]);
});

test("clear all hides only the caller's rows, and undo brings back that batch", async () => {
  const t = harness();
  const { orgId } = await workspace(t);
  await seed(t, orgId, "alice", 3);
  await seed(t, orgId, "bob", 2);
  const alice = t.withIdentity({ subject: "alice" });
  const bob = t.withIdentity({ subject: "bob" });

  await alice.mutation(api.inbox.markAllRead, {});
  await expect(alice.query(api.inbox.unreadCount, {})).resolves.toBe(0);
  await expect(bob.query(api.inbox.unreadCount, {})).resolves.toBe(2);

  const clearedAt = await alice.mutation(api.inbox.clearAll, {});
  await expect(alice.query(api.inbox.list, {})).resolves.toEqual([]);
  await expect(bob.query(api.inbox.list, {})).resolves.toHaveLength(2);

  // Bob replaying Alice's stamp restores nothing of hers.
  await bob.mutation(api.inbox.undoClearAll, { clearedAt });
  await expect(alice.query(api.inbox.list, {})).resolves.toEqual([]);

  await alice.mutation(api.inbox.undoClearAll, { clearedAt });
  await expect(alice.query(api.inbox.list, {})).resolves.toHaveLength(3);
});

test(`a person keeps at most ${INBOX_CAP} notifications, trimming the oldest`, async () => {
  const t = harness();
  const { orgId } = await workspace(t);
  await seed(t, orgId, "alice", INBOX_CAP);

  await drain(t, () =>
    t.run((ctx) =>
      deliverNotification(
        ctx,
        { userId: "alice", orgId, event: "example" },
        {
          title: "Example",
          body: "Something happened.",
          url: "/",
        },
      ),
    ),
  );

  const rows = await rowsOf(t, "alice");
  expect(rows).toHaveLength(INBOX_CAP);
  expect(rows[0].seq).toBe(2);
  expect(rows.at(-1)).toMatchObject({ seq: INBOX_CAP + 1, url: "/" });
});
