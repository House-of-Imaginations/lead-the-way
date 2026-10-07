import { expect, test } from "vitest";
import {
  boxState,
  crossing,
  crossingCopy,
  roleForm,
  startForm,
  submitStep,
  type RoleForm,
} from "../../../src/app/(app)/workspace/settings/_components/RoleModal";

const team = {
  name: "Employee",
  holders: 7,
  permissions: [] as never[],
};

test("create never confirms: a new role holds nobody (R-b)", () => {
  const form: RoleForm = {
    name: "Leads",
    ticked: ["team:insights"],
    confirming: false,
  };
  expect(submitStep(undefined, form)).toEqual({ kind: "save" });
});

test("an edit across the manager line confirms first, then saves on the second press (R-b)", () => {
  let form = roleForm(startForm(team), {
    type: "tick",
    permission: "team:insights",
    on: true,
  });
  const first = submitStep(team, form);
  expect(first).toEqual({
    kind: "confirm",
    moves: { holders: 7, toManager: true },
  });
  form = roleForm(form, { type: "confirm" });
  expect(submitStep(team, form)).toEqual({ kind: "save" });
});

test("an edit that stays on its side saves at once, and a blank name never saves", () => {
  const form = roleForm(startForm(team), { type: "name", name: "Staff" });
  expect(submitStep(team, form)).toEqual({ kind: "save" });
  expect(
    submitStep(team, roleForm(form, { type: "name", name: "  " })),
  ).toEqual({ kind: "blank" });
});

test("a change to the name or the ticks clears a shown confirm (R-b)", () => {
  const confirmed = roleForm(
    roleForm(startForm(team), {
      type: "tick",
      permission: "team:insights",
      on: true,
    }),
    { type: "confirm" },
  );
  expect(submitStep(team, confirmed).kind).toBe("save");
  // Each change asks again before a save, so "Save anyway" never sends a
  // set the person didn't see counted.
  const renamed = roleForm(confirmed, { type: "name", name: "Leads" });
  expect(submitStep(team, renamed).kind).toBe("confirm");
  const reticked = roleForm(confirmed, {
    type: "tick",
    permission: "org:manage",
    on: true,
  });
  expect(reticked.ticked).toEqual(["org:manage", "team:insights"]);
  expect(submitStep(team, reticked).kind).toBe("confirm");
});

test("a box the seat lacks is disabled with its reason; the launch role's all are, with none", () => {
  const held = ["roles:manage", "team:insights"] as const;
  expect(boxState("team:insights", held, false)).toEqual({
    disabled: false,
    helper: undefined,
  });
  expect(boxState("org:manage", held, false)).toEqual({
    disabled: true,
    helper: "Your role doesn't include this.",
  });
  // R-a: the launch role takes no permissions; its own helper says why (B-M-2).
  expect(boxState("team:insights", held, true)).toEqual({
    disabled: true,
    helper: undefined,
  });
  expect(boxState("org:manage", held, true)).toEqual({
    disabled: true,
    helper: undefined,
  });
  // While the seat's permissions load: disabled, no reason yet.
  expect(boxState("team:insights", undefined, false)).toEqual({
    disabled: true,
    helper: undefined,
  });
});

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
