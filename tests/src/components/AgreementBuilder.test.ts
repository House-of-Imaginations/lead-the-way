// @vitest-environment node
import type { FunctionReturnType } from "convex/server";
import { expect, test } from "vitest";
import type { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { contactOptionsOf } from "../../../src/app/(app)/manager/agreement/AgreementBuilder";

type Agreement = FunctionReturnType<typeof api.agreements.current>;

const me = "me" as Id<"people">;
const lead = "lead" as Id<"people">;
const options = [
  { value: me, label: "Priya Raman" },
  { value: "Privacy officer", label: "Privacy officer" },
];
const page = (contactPerson: Agreement["contactPerson"]) =>
  ({ contactOptions: options, contactPerson }) as Agreement;

test("a saved contact who is another manager is offered after the viewer", () => {
  expect(contactOptionsOf(page({ id: lead, name: "Sam Lee" }))).toEqual([
    options[0],
    { value: lead, label: "Sam Lee" },
    options[1],
  ]);
});

test("the viewer as contact, or none, keeps the options as they are", () => {
  expect(contactOptionsOf(page({ id: me, name: "Priya Raman" }))).toEqual(
    options,
  );
  expect(contactOptionsOf(page(null))).toEqual(options);
});
