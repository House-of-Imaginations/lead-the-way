import { expect, test } from "vitest";
import { resolveActiveSeat } from "@/hooks/useActiveOrg";
import type { ActiveSeat } from "@/lib/workspace/types";

const seat: ActiveSeat = {
  org: { _id: "o1", name: "Acme", slug: "acme" },
  roleName: "Owner",
  isOwner: true,
  permissions: [],
};

test("loading is pending regardless of auth state", () => {
  expect(resolveActiveSeat(true, false, undefined)).toBeUndefined();
  expect(resolveActiveSeat(true, true, seat)).toBeUndefined();
});

test("signed out is pending, never 'no workspace' -- callers must not treat it as a redirect signal", () => {
  expect(resolveActiveSeat(false, false, undefined)).toBeUndefined();
  expect(resolveActiveSeat(false, false, null)).toBeUndefined();
});

test("signed in with a workspace returns the seat", () => {
  expect(resolveActiveSeat(false, true, seat)).toBe(seat);
});

test("signed in with no workspace is null", () => {
  expect(resolveActiveSeat(false, true, null)).toBeNull();
});

test("signed in but the query hasn't resolved yet is pending", () => {
  expect(resolveActiveSeat(false, true, undefined)).toBeUndefined();
});
