import { expect, test } from "vitest";
import {
  crossing,
  crossingCopy,
} from "../../../src/app/(app)/workspace/settings/_components/RoleModal";

test("crossing names the people a save would move, and only them (R-b)", () => {
  const employee = { holders: 7, permissions: [] };
  // Widening a held role past the line moves its holders.
  expect(crossing(employee, ["team:insights"])).toEqual({
    holders: 7,
    toManager: true,
  });
  // Narrowing a manager's role back moves them the other way.
  expect(crossing({ holders: 1, permissions: ["team:insights"] }, [])).toEqual({
    holders: 1,
    toManager: false,
  });
  // A hidden teammate permission keeps them on the team side (M-e).
  expect(
    crossing(
      { holders: 2, permissions: ["members:read", "sprint:manage"] },
      [],
    ),
  ).toEqual({ holders: 2, toManager: false });
  // Same side, nobody holding it, or a new role: no confirm.
  expect(
    crossing({ holders: 3, permissions: ["team:insights"] }, ["sprint:manage"]),
  ).toBeNull();
  expect(crossing({ holders: 0, permissions: [] }, ["org:manage"])).toBeNull();
  expect(crossing(undefined, ["org:manage"])).toBeNull();
});

test("the confirm says how many people move and that totals may hide (R-b)", () => {
  expect(crossingCopy({ holders: 1, toManager: true })).toBe(
    "The 1 person with this role becomes a manager and leaves team totals. Changing roles during a sprint can hide the rest of that sprint's team totals.",
  );
  expect(crossingCopy({ holders: 7, toManager: false })).toBe(
    "The 7 people with this role stop being managers and join team totals. Changing roles during a sprint can hide the rest of that sprint's team totals.",
  );
});
